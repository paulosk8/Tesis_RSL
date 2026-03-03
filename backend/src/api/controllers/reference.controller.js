const ReferenceRepository = require('../../infrastructure/repositories/reference.repository');
const ImportReferencesUseCase = require('../../domain/use-cases/import-references.use-case');
const ExportReferencesUseCase = require('../../domain/use-cases/export-references.use-case');
const DetectDuplicatesUseCase = require('../../domain/use-cases/detect-duplicates.use-case');

const referenceRepository = new ReferenceRepository();
const importReferences = new ImportReferencesUseCase({ referenceRepository });
const exportReferences = new ExportReferencesUseCase(referenceRepository);
const detectDuplicates = new DetectDuplicatesUseCase();

/**
 * GET /api/references/:projectId
 * Obtener referencias de un proyecto
 */
const getProjectReferences = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { status, year, source, limit = 100, offset = 0 } = req.query;

    console.log(`📊 GET References - projectId: ${projectId}, limit: ${limit}, offset: ${offset}, userId: ${req.userId}`);

    if (!req.userId) {
      console.error('❌ userId no está definido en req');
      return res.status(401).json({
        success: false,
        message: 'Usuario no autenticado'
      });
    }

    const filters = {};
    if (status) filters.screeningStatus = status;
    if (year) filters.year = parseInt(year);
    if (source) filters.source = source;

    const references = await referenceRepository.findByProjectId(
      projectId, 
      filters, 
      parseInt(limit), 
      parseInt(offset)
    );
    console.log(`✅ Referencias encontradas: ${references.length}`);

    const total = await referenceRepository.countByProject(projectId, filters);

    // Calcular estadísticas
    const stats = {
      total: await referenceRepository.countByProject(projectId),
      pending: await referenceRepository.countByProject(projectId, { screeningStatus: 'pending' }),
      included: await referenceRepository.countByProject(projectId, { screeningStatus: 'included' }),
      excluded: await referenceRepository.countByProject(projectId, { screeningStatus: 'excluded' }),
      maybe: await referenceRepository.countByProject(projectId, { screeningStatus: 'maybe' }),
      duplicates: 0 // La columna is_duplicate no existe en la BD, siempre es 0
    };

    res.status(200).json({
      success: true,
      data: {
        references: references.map(ref => ref.toJSON()),
        stats,
        pagination: {
          total,
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: parseInt(offset) + references.length < total
        }
      }
    });
  } catch (error) {
    console.error('❌ Error obteniendo referencias:', error);
    console.error('Stack trace:', error.stack);
    res.status(500).json({
      success: false,
      message: error.message || 'Error al obtener referencias',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * POST /api/references/:projectId
 * Crear una nueva referencia
 */
const createReference = async (req, res) => {
  try {
    const { projectId } = req.params;
    const referenceData = req.body;

    const reference = await referenceRepository.create(projectId, referenceData);

    res.status(201).json({
      success: true,
      data: reference
    });
  } catch (error) {
    console.error('Error creando referencia:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error al crear referencia'
    });
  }
};

/**
 * POST /api/references/:projectId/batch
 * Crear múltiples referencias
 */
const createReferencesBatch = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { references } = req.body;

    if (!Array.isArray(references) || references.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Array de referencias es requerido'
      });
    }

    const createdReferences = await referenceRepository.createBatch(projectId, references);

    res.status(201).json({
      success: true,
      data: createdReferences,
      count: createdReferences.length
    });
  } catch (error) {
    console.error('Error creando referencias en lote:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error al crear referencias'
    });
  }
};

/**
 * PUT /api/references/:id/screening
 * Actualizar estado de screening
 */
const updateScreeningStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, aiData, exclusionReason, manualReviewStatus } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'Estado es requerido'
      });
    }

    const updateData = {
      screeningStatus: status
    };

    // Si hay datos de IA, agregarlos
    if (aiData) {
      if (aiData.classification) updateData.aiClassification = aiData.classification;
      if (aiData.confidence) updateData.aiConfidenceScore = aiData.confidence;
      if (aiData.reasoning) updateData.aiReasoning = aiData.reasoning;
    }

    // Si se proporciona razón de exclusión, guardarla
    if (exclusionReason) {
      updateData.exclusionReason = exclusionReason;
    }

    // Si se proporciona estado de revisión manual, guardarla
    if (manualReviewStatus) {
      updateData.manualReviewStatus = manualReviewStatus;
      updateData.reviewedAt = new Date().toISOString();
    }

    const reference = await referenceRepository.update(id, updateData);

    if (!reference) {
      return res.status(404).json({
        success: false,
        message: 'Referencia no encontrada'
      });
    }

    res.status(200).json({
      success: true,
      data: reference.toJSON()
    });
  } catch (error) {
    console.error('Error actualizando referencia:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error al actualizar referencia'
    });
  }
};

/**
 * PUT /api/references/batch-update
 * Actualizar múltiples referencias
 */
const updateReferencesBatch = async (req, res) => {
  try {
    const { updates } = req.body;

    if (!Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Array de actualizaciones es requerido'
      });
    }

    const updatedReferences = await referenceRepository.updateBatch(updates);

    res.status(200).json({
      success: true,
      data: updatedReferences,
      count: updatedReferences.length
    });
  } catch (error) {
    console.error('Error actualizando referencias:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error al actualizar referencias'
    });
  }
};

/**
 * GET /api/references/:projectId/stats
 * Obtener estadísticas de screening
 */
const getScreeningStats = async (req, res) => {
  try {
    const { projectId } = req.params;

    const stats = await referenceRepository.getScreeningStats(projectId);

    res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error obteniendo estadísticas:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error al obtener estadísticas'
    });
  }
};

/**
 * GET /api/references/:id/duplicates
 * Buscar duplicados potenciales
 */
const findDuplicates = async (req, res) => {
  try {
    const { id } = req.params;
    const { projectId } = req.query;

    if (!projectId) {
      return res.status(400).json({
        success: false,
        message: 'projectId es requerido'
      });
    }

    const duplicates = await referenceRepository.findPotentialDuplicates(projectId, id);

    res.status(200).json({
      success: true,
      data: duplicates,
      count: duplicates.length
    });
  } catch (error) {
    console.error('Error buscando duplicados:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error al buscar duplicados'
    });
  }
};

/**
 * POST /api/references/:projectId/detect-duplicates
 * Detectar y marcar duplicados en un proyecto
 */
const detectProjectDuplicates = async (req, res) => {
  try {
    const { projectId } = req.params;

    const result = await detectDuplicates.execute(projectId);

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error detectando duplicados:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error al detectar duplicados'
    });
  }
};

/**
 * POST /api/references/:projectId/resolve-duplicate
 * Resolver un grupo de duplicados manteniendo una referencia
 */
const resolveDuplicateGroup = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { groupId, keepReferenceId } = req.body;

    if (!groupId || !keepReferenceId) {
      return res.status(400).json({
        success: false,
        message: 'groupId y keepReferenceId son requeridos'
      });
    }

    // Obtener el grupo de duplicados
    const result = await detectDuplicates.execute(projectId);
    const group = result.groups.find(g => g.id === groupId);

    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Grupo de duplicados no encontrado'
      });
    }

    // Eliminar todas las referencias del grupo excepto la que se va a mantener
    const referencesToDelete = group.references
      .filter(ref => ref.id !== keepReferenceId)
      .map(ref => ref.id);

    // Eliminar las referencias duplicadas
    await Promise.all(referencesToDelete.map(id => referenceRepository.delete(id)));

    res.status(200).json({
      success: true,
      data: {
        kept: keepReferenceId,
        deleted: referencesToDelete.length,
        message: `Se mantuvieron 1 referencia y se eliminaron ${referencesToDelete.length} duplicados`
      }
    });
  } catch (error) {
    console.error('Error resolviendo grupo de duplicados:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error al resolver grupo de duplicados'
    });
  }
};

/**
 * DELETE /api/references/:id
 * Eliminar una referencia
 */
const deleteReference = async (req, res) => {
  try {
    const { id } = req.params;

    const reference = await referenceRepository.delete(id);

    if (!reference) {
      return res.status(404).json({
        success: false,
        message: 'Referencia no encontrada'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Referencia eliminada exitosamente'
    });
  } catch (error) {
    console.error('Error eliminando referencia:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error al eliminar referencia'
    });
  }
};

/**
 * GET /api/references/:projectId/year-distribution
 * Obtener distribución por año
 */
const getYearDistribution = async (req, res) => {
  try {
    const { projectId } = req.params;

    const distribution = await referenceRepository.getYearDistribution(projectId);

    res.status(200).json({
      success: true,
      data: distribution
    });
  } catch (error) {
    console.error('Error obteniendo distribución:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error al obtener distribución'
    });
  }
};

/**
 * GET /api/references/:projectId/source-distribution
 * Obtener distribución por fuente
 */
const getSourceDistribution = async (req, res) => {
  try {
    const { projectId } = req.params;

    const distribution = await referenceRepository.getSourceDistribution(projectId);

    res.status(200).json({
      success: true,
      data: distribution
    });
  } catch (error) {
    console.error('Error obteniendo distribución:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error al obtener distribución'
    });
  }
};

/**
 * POST /api/references/search-academic
 * Buscar referencias en bases de datos académicas (DESHABILITADO)
 */
const searchAcademicReferences = async (req, res) => {
  try {
    return res.status(501).json({
      success: false,
      message: 'Búsqueda API deshabilitada. Use carga manual de archivos BibTeX/RIS/CSV.'
    });
  } catch (error) {
    console.error('Error en búsqueda académica:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error al buscar referencias académicas'
    });
  }
};

/**
 * POST /api/references/:projectId/import
 * Importar referencias desde archivos (BibTeX, RIS, CSV)
 */
const importReferencesFromFiles = async (req, res) => {
  try {
    const { projectId } = req.params;
    
    console.log('📥 POST /api/references/:projectId/import');
    console.log('   Project ID:', projectId);
    console.log('   Files recibidos:', req.files ? req.files.length : 0);
    
    if (req.files) {
      req.files.forEach((file, i) => {
        console.log(`   Archivo ${i + 1}:`, {
          nombre: file.originalname,
          tipo: file.mimetype,
          tamaño: file.size,
          extensión: file.originalname.split('.').pop()
        });
      });
    }
    
    if (!req.files || req.files.length === 0) {
      console.log('❌ No se proporcionaron archivos');
      return res.status(400).json({
        success: false,
        message: 'No se proporcionaron archivos para importar'
      });
    }

    console.log('🔄 Ejecutando importación...');
    const result = await importReferences.execute(projectId, req.files);
    
    console.log('✅ Importación completada:', result);

    // Ejecutar detección automática de duplicados después de la importación
    let duplicateDetectionResult = null;
    if (result.success > 0) {
      try {
        console.log('🔍 Ejecutando detección automática de duplicados...');
        duplicateDetectionResult = await detectDuplicates.execute(projectId);
        console.log('✅ Detección de duplicados completada:', duplicateDetectionResult.stats);
      } catch (error) {
        console.error('⚠️ Error en detección de duplicados (no crítico):', error.message);
        // No fallar la importación si falla la detección de duplicados
      }
    }

    // Construir mensaje informativo
    let message = `Se importaron ${result.success} referencias exitosamente`;
    
    if (result.duplicates > 0) {
      message += ` (${result.duplicates} duplicados evitados durante carga)`;
    }
    
    if (duplicateDetectionResult && duplicateDetectionResult.stats.duplicates > 0) {
      message += `. Detección avanzada encontró ${duplicateDetectionResult.stats.duplicates} duplicados adicionales`;
    }

    res.status(200).json({
      success: true,
      message: message,
      data: {
        ...result,
        duplicateDetection: duplicateDetectionResult
      }
    });
  } catch (error) {
    console.error('❌ Error importando referencias:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error al importar referencias'
    });
  }
};

/**
 * GET /api/references/:projectId/export
 * Exportar referencias a diferentes formatos
 */
const exportReferencesToFile = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { format = 'bibtex', status } = req.query;

    const filters = {};
    if (status) filters.screeningStatus = status;

    const result = await exportReferences.execute(projectId, format, filters);

    res.setHeader('Content-Type', result.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="references-${projectId}.${result.extension}"`);
    res.status(200).send(result.content);
  } catch (error) {
    console.error('Error exportando referencias:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error al exportar referencias'
    });
  }
};

/**
 * POST /api/references/:id/upload-pdf
 * Subir archivo de resultados de texto completo
 */
const uploadPdf = async (req, res) => {
  try {
    const { id } = req.params;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No se proporcionó ningún archivo'
      });
    }

    console.log(`📄 Subiendo archivo de resultados para referencia ${id}...`);
    console.log(`   Tipo: ${req.file.mimetype}`);
    console.log(`   Nombre: ${req.file.originalname}`);

    // Construir URL absoluta del archivo apuntando al backend
    const backendUrl = process.env.BACKEND_URL || process.env.FRONTEND_URL?.replace('3000', '3001') || 'http://localhost:3001';
    const fileUrl = `${backendUrl}/uploads/pdfs/${req.file.filename}`;

    // Actualizar la referencia en la base de datos
    const updated = await referenceRepository.update(id, {
      fullTextAvailable: true,
      fullTextUrl: fileUrl
    });

    if (!updated) {
      // Si falla, eliminar el archivo subido
      const fs = require('fs');
      fs.unlinkSync(req.file.path);
      
      return res.status(404).json({
        success: false,
        message: 'Referencia no encontrada'
      });
    }

    console.log(`✅ Archivo subido exitosamente: ${fileUrl}`);

    res.status(200).json({
      success: true,
      message: 'Archivo de resultados subido exitosamente',
      data: {
        reference: updated.toJSON(),
        pdfUrl: fileUrl // Mantener el nombre pdfUrl por compatibilidad
      }
    });
  } catch (error) {
    console.error('❌ Error subiendo archivo:', error);
    
    // Eliminar archivo si existe
    if (req.file && req.file.path) {
      try {
        const fs = require('fs');
        fs.unlinkSync(req.file.path);
      } catch (unlinkError) {
        console.error('Error eliminando archivo:', unlinkError);
      }
    }

    res.status(500).json({
      success: false,
      message: error.message || 'Error al subir el archivo de resultados'
    });
  }
};

/**
 * DELETE /api/references/:id/pdf
 * Eliminar archivo de resultados de una referencia
 */
const deletePdf = async (req, res) => {
  try {
    const { id } = req.params;

    console.log(`🗑️  Eliminando archivo de resultados de referencia ${id}...`);

    // Obtener la referencia para conseguir la URL del archivo
    const reference = await referenceRepository.findById(id);

    if (!reference) {
      return res.status(404).json({
        success: false,
        message: 'Referencia no encontrada'
      });
    }

    // Eliminar archivo físico si existe
    if (reference.fullTextUrl) {
      const path = require('path');
      const fs = require('fs');
      // Extraer la ruta relativa del archivo desde la URL
      const filename = reference.fullTextUrl.split('/').pop();
      const filePath = path.join(__dirname, '../../../uploads/pdfs', filename);
      
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          console.log(`✅ Archivo eliminado: ${filePath}`);
        }
      } catch (error) {
        console.error('⚠️  Error eliminando archivo físico:', error);
        // Continuar aunque falle la eliminación del archivo
      }
    }

    // Actualizar la referencia en la base de datos
    const updated = await referenceRepository.update(id, {
      fullTextAvailable: false,
      fullTextUrl: null
    });

    console.log(`✅ PDF eliminado exitosamente`);

    res.status(200).json({
      success: true,
      message: 'PDF eliminado exitosamente',
      data: {
        reference: updated.toJSON()
      }
    });
  } catch (error) {
    console.error('❌ Error eliminando PDF:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error al eliminar el PDF'
    });
  }
};

module.exports = {
  getProjectReferences,
  createReference,
  createReferencesBatch,
  updateScreeningStatus,
  updateReferencesBatch,
  getScreeningStats,
  findDuplicates,
  detectProjectDuplicates,
  resolveDuplicateGroup,
  deleteReference,
  getYearDistribution,
  getSourceDistribution,
  searchAcademicReferences,
  importReferencesFromFiles,
  exportReferencesToFile,
  uploadPdf,
  deletePdf
};
