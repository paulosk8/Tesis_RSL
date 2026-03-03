const GenerateProtocolAnalysisUseCase = require('../../domain/use-cases/generate-protocol-analysis.use-case');
const GenerateProtocolJustificationUseCase = require('../../domain/use-cases/generate-protocol-justification.use-case');
const ScreenReferencesWithAIUseCase = require('../../domain/use-cases/screen-references-with-ai.use-case');
const ScreenReferencesWithEmbeddingsUseCase = require('../../domain/use-cases/screen-references-embeddings.use-case');
const GenerateTitlesUseCase = require('../../domain/use-cases/generate-titles.use-case');
const SearchQueryGenerator = require('../../domain/use-cases/search-query-generator.use-case');
const GenerateProtocolTermsUseCase = require('../../domain/use-cases/generate-protocol-terms.use-case');
const GenerateInclusionExclusionCriteriaUseCase = require('../../domain/use-cases/generate-inclusion-exclusion-criteria.use-case');
const RunProjectScreeningUseCase = require('../../domain/use-cases/run-project-screening.use-case');
const AnalyzeScreeningResultsUseCase = require('../../domain/use-cases/analyze-screening-results.use-case');
const ReferenceRepository = require('../../infrastructure/repositories/reference.repository');
const ProtocolRepository = require('../../infrastructure/repositories/protocol.repository');
const ApiUsageRepository = require('../../infrastructure/repositories/api-usage.repository');
const { detectResearchArea, getDatabasesByArea } = require('../../config/academic-databases');

const referenceRepository = new ReferenceRepository();
const protocolRepository = new ProtocolRepository();
const apiUsageRepository = new ApiUsageRepository();
const generateProtocolAnalysisUseCase = new GenerateProtocolAnalysisUseCase();
const generateProtocolJustificationUseCase = new GenerateProtocolJustificationUseCase();
const screenReferencesUseCase = new ScreenReferencesWithAIUseCase();
const screenEmbeddingsUseCase = new ScreenReferencesWithEmbeddingsUseCase();
const generateTitlesUseCase = new GenerateTitlesUseCase();
const searchQueryGenerator = new SearchQueryGenerator();
const generateProtocolTermsUseCase = new GenerateProtocolTermsUseCase();
const generateInclusionExclusionCriteriaUseCase = new GenerateInclusionExclusionCriteriaUseCase();
const runProjectScreeningUseCase = new RunProjectScreeningUseCase();
const analyzeScreeningResultsUseCase = new AnalyzeScreeningResultsUseCase({ referenceRepository });

// Helper function para obtener el modelo correcto según el proveedor
const getModelByProvider = (provider) => {
  const models = {
    'chatgpt': 'gpt-4o-mini',
    'gemini': 'gemini-2.0-flash-exp'
  };
  return models[provider] || 'gpt-4o-mini';
};

/**
 * Helper: Registrar uso de API en la base de datos
 */
async function trackApiUsage({ userId, provider, endpoint, model, tokensPrompt = 0, tokensCompletion = 0, success = true, errorMessage = null }) {
  try {
    await apiUsageRepository.create({
      userId,
      provider,
      endpoint,
      model,
      tokensPrompt,
      tokensCompletion,
      tokensTotal: tokensPrompt + tokensCompletion,
      requestCount: 1,
      success,
      errorMessage
    });
  } catch (error) {
    console.error('⚠️  Error registrando uso de API:', error.message);
    // No lanzar error para no interrumpir la operación principal
  }
}

/**
 * POST /api/ai/protocol-analysis
 * Genera análisis de protocolo con IA
 */
const generateProtocolAnalysis = async (req, res) => {
  try {
    const { title, description, area, yearStart, yearEnd, aiProvider } = req.body;

    console.log('📥 DEBUG - req.body completo:', JSON.stringify(req.body, null, 2));

    // Validaciones
    if (!title || !description) {
      return res.status(400).json({
        success: false,
        message: 'Título y descripción son requeridos'
      });
    }

    console.log('🤖 Generando análisis de protocolo con IA...');
    console.log('   Proveedor:', aiProvider || 'chatgpt');
    console.log('   Título:', title.substring(0, 50) + '...');
    console.log('   Área:', area || 'No especificada');
    console.log('   Rango temporal:', yearStart || 2019, '-', yearEnd || 2025);

    const result = await generateProtocolAnalysisUseCase.execute({
      title,
      description,
      area,
      yearStart,
      yearEnd,
      aiProvider: aiProvider || 'chatgpt' // ChatGPT por defecto
    });

    // Registrar uso de API
    const usedProvider = result.data?.provider || aiProvider || 'chatgpt';
    await trackApiUsage({
      userId: req.user?.id,
      provider: usedProvider,
      endpoint: '/api/ai/protocol-analysis',
      model: getModelByProvider(usedProvider),
      tokensPrompt: 1500,
      tokensCompletion: 2000,
      success: true
    });

    console.log('✅ Análisis generado exitosamente');
    console.log('📊 DEBUG - Estructura de fase2_matriz_es_no_es:', JSON.stringify(result.data?.fase2_matriz_es_no_es, null, 2));

    res.status(200).json(result);
  } catch (error) {
    console.error('❌ Error generando análisis:', error);
    
    // Registrar error de API
    const errorProvider = req.body.aiProvider || 'chatgpt';
    await trackApiUsage({
      userId: req.user?.id,
      provider: errorProvider,
      endpoint: '/api/ai/protocol-analysis',
      model: getModelByProvider(errorProvider),
      success: false,
      errorMessage: error.message
    });
    
    res.status(500).json({
      success: false,
      message: error.message || 'Error al generar análisis con IA'
    });
  }
};

/**
 * POST /api/ai/screen-reference
 * Analiza una referencia individual con IA
 */
const screenReference = async (req, res) => {
  try {
    const { reference, inclusionCriteria, exclusionCriteria, researchQuestion, aiProvider } = req.body;

    if (!reference || !reference.title) {
      return res.status(400).json({
        success: false,
        message: 'Referencia con título es requerida'
      });
    }

    console.log('🤖 Analizando referencia con IA...');
    console.log('   Título:', reference.title.substring(0, 50) + '...');
    console.log('   Proveedor:', aiProvider || 'chatgpt');

    const result = await screenReferencesUseCase.execute({
      reference,
      inclusionCriteria,
      exclusionCriteria,
      researchQuestion,
      aiProvider: aiProvider || 'chatgpt'
    });

    // Registrar uso de API
    const usedProvider = result.data?.provider || aiProvider || 'chatgpt';
    await trackApiUsage({
      userId: req.user?.id,
      provider: usedProvider,
      endpoint: '/api/ai/screen-reference',
      model: getModelByProvider(usedProvider),
      tokensPrompt: 800,
      tokensCompletion: 600,
      success: true
    });

    console.log('✅ Referencia analizada:', result.data.decision);

    res.status(200).json(result);
  } catch (error) {
    console.error('❌ Error en screening:', error);
    
    // Registrar error de API
    const errorProvider = req.body.aiProvider || 'chatgpt';
    await trackApiUsage({
      userId: req.user?.id,
      provider: errorProvider,
      endpoint: '/api/ai/screen-reference',
      model: getModelByProvider(errorProvider),
      success: false,
      errorMessage: error.message
    });
    
    res.status(500).json({
      success: false,
      message: error.message || 'Error al analizar referencia con IA'
    });
  }
};

/**
 * POST /api/ai/screen-references-batch
 * Analiza múltiples referencias en lote
 */
const screenReferencesBatch = async (req, res) => {
  try {
    const { references, inclusionCriteria, exclusionCriteria, researchQuestion, aiProvider } = req.body;

    if (!references || !Array.isArray(references) || references.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Array de referencias es requerido'
      });
    }

    console.log('🤖 Analizando lote de referencias con IA...');
    console.log('   Cantidad:', references.length);
    console.log('   Proveedor:', aiProvider || 'chatgpt');

    const result = await screenReferencesUseCase.executeBatch({
      references,
      inclusionCriteria,
      exclusionCriteria,
      researchQuestion,
      aiProvider: aiProvider || 'chatgpt'
    });

    console.log('✅ Lote analizado exitosamente');
    console.log('   Incluidas:', result.summary.incluidas);
    console.log('   Excluidas:', result.summary.excluidas);
    console.log('   A revisar:', result.summary.revisar_manual);

    res.status(200).json(result);
  } catch (error) {
    console.error('❌ Error en screening por lotes:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error al analizar referencias con IA'
    });
  }
};

/**
 * POST /api/ai/generate-titles
 * Genera 5 opciones de títulos con validación Cochrane
 */
const generateTitles = async (req, res) => {
  try {
    const { matrixData, picoData, aiProvider } = req.body;

    // Validaciones básicas
    if (!matrixData && !picoData) {
      return res.status(400).json({
        success: false,
        message: 'Se requiere al menos matrixData o picoData'
      });
    }

    console.log('🤖 Generando 5 títulos con validación Cochrane...');
    console.log('   Proveedor:', aiProvider || 'chatgpt');
    console.log('   Matriz:', matrixData ? '✓' : '✗');
    console.log('   PICO:', picoData ? '✓' : '✗');

    const result = await generateTitlesUseCase.execute({
      matrixData,
      picoData,
      aiProvider: aiProvider || 'chatgpt'
    });

    // Registrar uso de API
    const usedProvider = result.data?.provider || aiProvider || 'chatgpt';
    await trackApiUsage({
      userId: req.user?.id,
      provider: usedProvider,
      endpoint: '/api/ai/generate-titles',
      model: getModelByProvider(usedProvider),
      tokensPrompt: 1200,
      tokensCompletion: 1800,
      success: true
    });

    console.log('✅ Títulos generados exitosamente');
    console.log('   Cantidad:', result.data?.titles?.length || 0);

    res.status(200).json(result);
  } catch (error) {
    console.error('❌ Error generando títulos:', error);
    
    // Registrar error de API
    const errorProvider = req.body.aiProvider || 'chatgpt';
    await trackApiUsage({
      userId: req.user?.id,
      provider: errorProvider,
      endpoint: '/api/ai/generate-titles',
      model: getModelByProvider(errorProvider),
      success: false,
      errorMessage: error.message
    });
    
    res.status(500).json({
      success: false,
      message: error.message || 'Error al generar títulos con IA'
    });
  }
};

/**
 * POST /api/ai/generate-search-strategies
 * Genera estrategias de búsqueda específicas por base de datos usando SearchQueryGenerator
 */
const generateSearchStrategies = async (req, res) => {
  try {
    const { matrixData, picoData, databases, researchArea, protocolTerms, yearStart, yearEnd, selectedTitle } = req.body;

    // Validaciones
    if (!picoData && !matrixData) {
      return res.status(400).json({
        success: false,
        message: 'Se requiere al menos picoData o matrixData'
      });
    }

    if (!databases || !Array.isArray(databases) || databases.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Se requiere un array de bases de datos'
      });
    }

    console.log('🔍 Generando cadenas de búsqueda con SearchQueryGenerator...');
    console.log('   Bases de datos:', databases.join(', '));
    console.log('   Área de investigación:', researchArea || 'No especificada');
    console.log('   Términos del protocolo:', Object.keys(protocolTerms || {}).join(', '));
    console.log('   Título RSL:', selectedTitle || 'No especificado');
    console.log('   📅 Rango temporal: yearStart =', yearStart, ', yearEnd =', yearEnd);
    
    const result = await searchQueryGenerator.generate({
      databases,
      picoData: picoData || {},
      protocolTerms: protocolTerms || {},
      researchArea: researchArea || '',
      matrixData: matrixData || {},
      yearStart,
      yearEnd,
      selectedTitle
    });

    // Registrar uso de API (una llamada por cada base de datos)
    if (result.data?.queries) {
      for (const query of result.data.queries) {
        const provider = query.provider || 'gemini';
        await trackApiUsage({
          userId: req.user?.id,
          provider: provider,
          endpoint: '/api/ai/generate-search-queries',
          model: provider === 'chatgpt' ? 'gpt-4o-mini' : 'gemini-2.0-flash-exp',
          tokensPrompt: 1500,
          tokensCompletion: 1000,
          success: true
        });
      }
    }

    console.log('✅ Cadenas generadas exitosamente');
    console.log('   Total consultas:', result.data?.queries?.length || 0);

    res.status(200).json(result);
  } catch (error) {
    console.error('❌ Error generando cadenas:', error);
    
    // Registrar error de API
    await trackApiUsage({
      userId: req.user?.id,
      provider: 'gemini',
      endpoint: '/api/ai/generate-search-queries',
      model: 'gemini-2.0-flash-exp',
      success: false,
      errorMessage: error.message
    });
    
    res.status(500).json({
      success: false,
      message: error.message || 'Error al generar cadenas de búsqueda'
    });
  }
};

/**
 * POST /api/ai/screen-reference-embeddings
 * Analiza una referencia usando embeddings y similitud de coseno
 */
const screenReferenceEmbeddings = async (req, res) => {
  try {
    const { reference, protocol, threshold } = req.body;

    if (!reference || !reference.title) {
      return res.status(400).json({
        success: false,
        message: 'Referencia con título es requerida'
      });
    }

    if (!protocol) {
      return res.status(400).json({
        success: false,
        message: 'Protocolo PICO es requerido'
      });
    }

    console.log('🔬 Analizando referencia con embeddings...');
    console.log('   Título:', reference.title.substring(0, 50) + '...');
    console.log('   Umbral:', threshold || 0.7);

    const result = await screenEmbeddingsUseCase.execute({
      reference,
      protocol,
      threshold: threshold || 0.7
    });

    console.log('✅ Referencia analizada:', result.data.recommendation);
    console.log('   Similitud:', (result.data.similarity * 100).toFixed(1) + '%');

    res.status(200).json(result);
  } catch (error) {
    console.error('❌ Error en screening con embeddings:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error al analizar referencia con embeddings'
    });
  }
};

/**
 * POST /api/ai/screen-references-batch-embeddings
 * Analiza múltiples referencias en lote usando embeddings
 */
const screenReferencesBatchEmbeddings = async (req, res) => {
  try {
    const { references, protocol, threshold } = req.body;

    if (!references || !Array.isArray(references) || references.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Array de referencias es requerido'
      });
    }

    if (!protocol) {
      return res.status(400).json({
        success: false,
        message: 'Protocolo PICO es requerido'
      });
    }

    console.log('🔬 Analizando lote de referencias con embeddings...');
    console.log('   Cantidad:', references.length);
    console.log('   Umbral:', threshold || 0.7);

    // Callback para enviar progreso (opcional)
    const onProgress = (current, total) => {
      const percentage = ((current / total) * 100).toFixed(0);
      console.log(`   Progreso: ${current}/${total} (${percentage}%)`);
    };

    const result = await screenEmbeddingsUseCase.executeBatch({
      references,
      protocol,
      threshold: threshold || 0.7,
      onProgress
    });

    console.log('✅ Lote analizado exitosamente');
    console.log('   Resumen:', result.summary);

    res.status(200).json(result);
  } catch (error) {
    console.error('❌ Error en screening batch con embeddings:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error al analizar lote con embeddings'
    });
  }
};

/**
 * POST /api/ai/ranking-embeddings
 * Genera ranking de referencias por similitud usando embeddings
 */
const generateRankingEmbeddings = async (req, res) => {
  try {
    const { references, protocol, models } = req.body;

    if (!references || !Array.isArray(references) || references.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Array de referencias es requerido'
      });
    }

    if (!protocol) {
      return res.status(400).json({
        success: false,
        message: 'Protocolo PICO es requerido'
      });
    }

    console.log('📊 Generando ranking de referencias con embeddings...');
    console.log('   Cantidad de referencias:', references.length);
    console.log('   Modelos:', models || ['Xenova/all-MiniLM-L6-v2']);

    const result = await screenEmbeddingsUseCase.generateRanking({
      references,
      protocol,
      models: models || ['Xenova/all-MiniLM-L6-v2']
    });

    console.log('✅ Ranking generado exitosamente');
    console.log('   Top 5:');
    result.data.slice(0, 5).forEach((item, idx) => {
      console.log(`   ${idx + 1}. ${item.referenceTitle.substring(0, 50)}... (${(item.avgSimilarity * 100).toFixed(1)}%)`);
    });

    res.status(200).json(result);
  } catch (error) {
    console.error('❌ Error generando ranking:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error al generar ranking con embeddings'
    });
  }
};

/**
 * POST /api/ai/generate-protocol-terms
 * Genera términos del protocolo basados en el contexto del proyecto
 */
const generateProtocolTerms = async (req, res) => {
  try {
    const { selectedTitle, projectTitle, projectDescription, picoData, matrixData, aiProvider, specificSection, customFocus } = req.body;

    // Validaciones
    if (!projectTitle && !selectedTitle) {
      return res.status(400).json({
        success: false,
        message: 'Se requiere al menos un título (RSL o proyecto)'
      });
    }

    if (!projectDescription) {
      return res.status(400).json({
        success: false,
        message: 'La descripción del proyecto es requerida'
      });
    }

    console.log('🔍 Generando términos del protocolo con IA...');
    console.log('   Proveedor:', aiProvider || 'chatgpt');
    console.log('   Título RSL:', (selectedTitle || projectTitle).substring(0, 50) + '...');
    if (specificSection) {
      console.log('   Sección específica:', specificSection);
      console.log('   Enfoque personalizado:', customFocus || 'predeterminado');
    }

    const result = await generateProtocolTermsUseCase.execute({
      selectedTitle,  // ← Nuevo: Título de la RSL seleccionado
      projectTitle,
      projectDescription,
      picoData: picoData || {},
      matrixData: matrixData || {},
      aiProvider: aiProvider || 'chatgpt',
      specificSection,
      customFocus
    });

    // Registrar uso de API
    const usedProvider = result.data?.provider || aiProvider || 'chatgpt';
    await trackApiUsage({
      userId: req.user?.id,
      provider: usedProvider,
      endpoint: '/api/ai/generate-protocol-terms',
      model: getModelByProvider(usedProvider),
      tokensPrompt: 1100,
      tokensCompletion: 1300,
      success: true
    });

    console.log('✅ Términos del protocolo generados exitosamente');

    res.status(200).json(result);
  } catch (error) {
    console.error('❌ Error generando términos del protocolo:', error);
    
    // Registrar error de API
    const errorProvider = req.body.aiProvider || 'chatgpt';
    await trackApiUsage({
      userId: req.user?.id,
      provider: errorProvider,
      endpoint: '/api/ai/generate-protocol-terms',
      model: getModelByProvider(errorProvider),
      success: false,
      errorMessage: error.message
    });
    
    res.status(500).json({
      success: false,
      message: error.message || 'Error al generar términos del protocolo con IA'
    });
  }
};

/**
 * POST /api/ai/run-project-screening-embeddings
 * Ejecuta cribado HÍBRIDO: Embeddings + ChatGPT para zona gris
 * MÉTODO RECOMENDADO (Opción 3)
 */
const runProjectScreeningEmbeddings = async (req, res) => {
  try {
    const { projectId, threshold, aiProvider } = req.body;

    if (!projectId) {
      return res.status(400).json({
        success: false,
        message: 'ID del proyecto es requerido'
      });
    }

    // Obtener protocolo del proyecto
    const protocol = await protocolRepository.findByProjectId(projectId);
    
    if (!protocol) {
      return res.status(404).json({
        success: false,
        message: 'Protocolo no encontrado. Crea un protocolo antes de ejecutar el cribado.'
      });
    }

    console.log('🔬 Ejecutando cribado HÍBRIDO...');
    console.log('   Proyecto:', projectId);
    console.log('   Umbral embeddings:', threshold || 0.15);
    console.log('   Proveedor IA:', aiProvider || 'chatgpt');

    const result = await runProjectScreeningUseCase.executeHybrid({
      projectId,
      protocol,
      embeddingThreshold: threshold || 0.15, // Umbral más bajo para español/inglés
      aiProvider: aiProvider || 'chatgpt'
    });

    res.status(200).json(result);
  } catch (error) {
    console.error('❌ Error en cribado híbrido:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error al ejecutar cribado híbrido'
    });
  }
};

  // GET /api/ai/run-project-screening-stream
  // Ejecuta cribado HÍBRIDO con Server-Sent Events para progreso en tiempo real
  const runProjectScreeningStream = async (req, res) => {
    try {
      const { projectId, threshold, aiProvider, token } = req.query;

      if (!projectId) {
        return res.status(400).json({
          success: false,
          message: 'ID del proyecto es requerido'
        });
      }

      // Si se proporciona token en query, validarlo manualmente
      if (token) {
        try {
          const jwt = require('jsonwebtoken');
          const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
          req.user = decoded; // Adjuntar usuario al request
        } catch (tokenError) {
          return res.status(401).json({
            success: false,
            message: 'Token inválido o expirado'
          });
        }
      }

      // Obtener protocolo del proyecto
      const protocol = await protocolRepository.findByProjectId(projectId);
      
      if (!protocol) {
        return res.status(404).json({
          success: false,
          message: 'Protocolo no encontrado. Crea un protocolo antes de ejecutar el cribado.'
        });
      }

      // Configurar SSE
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no' // Para Nginx
      });

      // Implementar Ping Keep-Alive para evitar Timeouts de Proxy
      const keepAliveInterval = setInterval(() => {
        res.write(': keepalive\n\n');
      }, 15000);

      const cleanup = () => {
        clearInterval(keepAliveInterval);
      };

      req.on('close', () => {
        cleanup();
      });

      // Helper para enviar eventos SSE
      const sendEvent = (data) => {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
      };

      // Callback para recibir progreso del use case
      const progressCallback = (event) => {
        sendEvent(event);
      };

      console.log('🔬 Ejecutando cribado HÍBRIDO con SSE...');
      console.log('   Proyecto:', projectId);
      console.log('   Umbral embeddings:', threshold || 0.15);
      console.log('   Proveedor IA:', aiProvider || 'chatgpt');

      try {
        const result = await runProjectScreeningUseCase.executeHybrid({
          projectId,
          protocol,
          embeddingThreshold: parseFloat(threshold) || 0.15,
          aiProvider: aiProvider || 'gemini', // Forzado Gemini defaults
          progressCallback // Pasar callback para eventos de progreso
        });

        // Enviar resultado final
        sendEvent({
          type: 'complete',
          data: result
        });

        cleanup();
        res.end();
      } catch (error) {
        console.error('❌ Error en cribado híbrido con SSE:', error);
        sendEvent({
          type: 'error',
          message: error.message || 'Error al ejecutar cribado híbrido'
        });
        cleanup();
        res.end();
      }
    } catch (error) {
      console.error('❌ Error configurando SSE:', error);
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: error.message || 'Error al configurar streaming'
        });
      }
    }
  };

/**
 * POST /api/ai/run-project-screening-llm
 * Ejecuta cribado completo del proyecto con LLM
 */
const runProjectScreeningLLM = async (req, res) => {
  try {
    const { projectId, llmProvider } = req.body;

    if (!projectId) {
      return res.status(400).json({
        success: false,
        message: 'ID del proyecto es requerido'
      });
    }

    console.log('🤖 Ejecutando cribado con LLM...');
    console.log('   Proyecto:', projectId);
    console.log('   Proveedor:', llmProvider || 'gemini');

    const result = await runProjectScreeningUseCase.executeLLM({
      projectId,
      llmProvider: llmProvider || 'gemini'
    });

    res.status(200).json(result);
  } catch (error) {
    console.error('❌ Error en cribado con LLM:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error al ejecutar cribado con LLM'
    });
  }
};

/**
 * GET /api/ai/analyze-screening-results/:projectId
 * Analiza los resultados de screening y proporciona estadísticas y recomendaciones
 */
const analyzeScreeningResults = async (req, res) => {
  try {
    const { projectId } = req.params;

    if (!projectId) {
      return res.status(400).json({
        success: false,
        message: 'Project ID es requerido'
      });
    }

    console.log(`📊 Analizando resultados de screening para proyecto: ${projectId}`);

    const result = await analyzeScreeningResultsUseCase.execute(projectId);

    if (!result.success) {
      return res.status(400).json(result);
    }

    console.log(`✅ Análisis completado: ${result.data.scoredReferences} referencias analizadas`);

    return res.status(200).json(result);
  } catch (error) {
    console.error('❌ Error al analizar resultados:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al analizar resultados de screening',
      error: error.message
    });
  }
};

/**
 * POST /api/ai/generate-inclusion-exclusion-criteria
 * Genera criterios de inclusión y exclusión basados en términos del protocolo confirmados
 */
const generateInclusionExclusionCriteria = async (req, res) => {
  try {
    const { selectedTitle, protocolTerms, picoData, aiProvider, specificType, customFocus, categoryIndex, categoryName, yearStart, yearEnd, rejectedTerms } = req.body;

    // Validaciones
    if (!protocolTerms) {
      return res.status(400).json({
        success: false,
        message: 'Los términos del protocolo son requeridos'
      });
    }

    console.log('🤖 Generando criterios de inclusión/exclusión...');
    console.log('   Proveedor:', aiProvider || 'chatgpt');
    console.log('   Título RSL:', (selectedTitle || req.body.projectTitle || 'Proyecto').substring(0, 50) + '...');
    console.log('   Términos tecnología:', protocolTerms.tecnologia?.length || 0);
    console.log('   Términos dominio:', protocolTerms.dominio?.length || 0);
    console.log('   ⏰ Rango temporal recibido: yearStart =', yearStart, ', yearEnd =', yearEnd);
    console.log('   ❌ Términos rechazados:', rejectedTerms?.length || 0);
    
    if (specificType) {
      console.log('   Tipo específico:', specificType);
      console.log('   Categoría específica:', categoryName || categoryIndex);
      console.log('   Enfoque personalizado:', customFocus || 'predeterminado');
    }

    const result = await generateInclusionExclusionCriteriaUseCase.execute({
      selectedTitle,  // ← REGLA: Priorizar título RSL seleccionado
      protocolTerms,
      picoData: picoData || {},
      projectTitle: req.body.projectTitle || 'Proyecto',
      aiProvider: aiProvider || 'chatgpt',
      specificType,
      customFocus,
      categoryIndex,
      categoryName,
      yearStart,
      yearEnd,
      rejectedTerms: rejectedTerms || [] // ← NUEVO: Términos rechazados por el investigador
    });

    // Registrar uso de API
    const usedProvider = aiProvider || 'chatgpt';
    await trackApiUsage({
      userId: req.user?.id,
      provider: usedProvider,
      endpoint: '/api/ai/generate-inclusion-exclusion-criteria',
      model: getModelByProvider(usedProvider),
      tokensPrompt: 1300,
      tokensCompletion: 1500,
      success: true
    });

    console.log('✅ Criterios I/E generados exitosamente');
    console.log('   Total categorías:', result.data.criteria?.length || 0);

    res.status(200).json(result);
  } catch (error) {
    console.error('❌ Error generando criterios I/E:', error);
    
    // Registrar error de API
    const errorProvider = req.body.aiProvider || 'chatgpt';
    await trackApiUsage({
      userId: req.user?.id,
      provider: errorProvider,
      endpoint: '/api/ai/generate-inclusion-exclusion-criteria',
      model: getModelByProvider(errorProvider),
      success: false,
      errorMessage: error.message
    });
    
    res.status(500).json({
      success: false,
      message: error.message || 'Error al generar criterios de inclusión/exclusión'
    });
  }
};

/**
 * POST /api/ai/generate-search-queries
 * DEPRECADO: Redirige al nuevo sistema de SearchQueryGenerator
 */
const generateSearchQueries = async (req, res) => {
  try {
    const { protocolTerms, picoData, selectedDatabases, researchArea, matrixData, yearStart, yearEnd, selectedTitle } = req.body;

    console.log('⚠️  Endpoint deprecado: /generate-search-queries - Usando nuevo sistema');

    // Usar el nuevo sistema SearchQueryGenerator
    const result = await searchQueryGenerator.generate({
      databases: selectedDatabases || [],
      picoData,
      matrixData,
      researchArea,
      protocolTerms,
      yearStart,
      yearEnd,
      selectedTitle
    });

    res.json(result);

  } catch (error) {
    console.error('❌ Error generando cadenas de búsqueda:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error al generar cadenas de búsqueda'
    });
  }
};

/**
 * POST /api/ai/scopus-count
 * Cuenta resultados en Scopus usando API
 */
const scopusCount = async (req, res) => {
  try {
    const { query } = req.body;

    if (!query) {
      return res.status(400).json({
        success: false,
        message: 'Query es requerida'
      });
    }

    // Obtener API Key del .env
    const apiKey = process.env.SCOPUS_API_KEY;
    
    if (!apiKey) {
      return res.status(500).json({
        success: false,
        message: 'API Key de Scopus no configurada en el servidor'
      });
    }

    console.log('🔍 Contando resultados en Scopus...');
    console.log('   Query:', query.substring(0, 100) + '...');

    const result = await scopusSearchUseCase.count({ query, apiKey });

    // Devolver en el formato esperado por el frontend
    res.json({
      success: result.success,
      count: result.total,
      total: result.total,
      query: result.query
    });

  } catch (error) {
    console.error('❌ Error en Scopus count:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error al conectar con Scopus'
    });
  }
};

/**
 * POST /api/ai/scopus-search
 * Busca artículos en Scopus usando API (con paginación)
 */
const scopusSearch = async (req, res) => {
  try {
    const { query, start = 0, count = 25, sortBy = 'relevance' } = req.body;

    if (!query) {
      return res.status(400).json({
        success: false,
        message: 'Query es requerida'
      });
    }

    // Obtener API Key del .env
    const apiKey = process.env.SCOPUS_API_KEY;
    
    if (!apiKey) {
      return res.status(500).json({
        success: false,
        message: 'API Key de Scopus no configurada en el servidor'
      });
    }

    console.log('🔍 Buscando en Scopus...');
    console.log('   Query:', query.substring(0, 100) + '...');
    console.log('   Paginación: start=' + start + ', count=' + count);

    const result = await scopusSearchUseCase.search({ 
      query, 
      apiKey, 
      start, 
      count, 
      sortBy 
    });

    res.json(result);

  } catch (error) {
    console.error('❌ Error en Scopus search:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error al conectar con Scopus'
    });
  }
};

/**
 * GET /api/ai/scopus-validate
 * Valida API Key de Scopus (desde .env)
 */
const scopusValidate = async (req, res) => {
  try {
    // Obtener API Key del .env
    const apiKey = process.env.SCOPUS_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        success: false,
        valid: false,
        message: 'API Key de Scopus no configurada en el servidor'
      });
    }

    console.log('🔑 Validando API Key de Scopus desde .env...');

    const result = await scopusSearchUseCase.validateConnection(apiKey);

    res.json(result);

  } catch (error) {
    console.error('❌ Error validando Scopus:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error al validar API Key'
    });
  }
};

/**
 * GET /api/ai/supported-databases
 * Obtiene lista de todas las bases de datos soportadas (todas las áreas)
 */
const getSupportedDatabases = async (req, res) => {
  try {
    const { getAllAreas } = require('../../config/academic-databases');
    const areas = getAllAreas();
    
    // Recopilar todas las bases de datos únicas de todas las áreas
    const allDatabasesMap = new Map();
    areas.forEach(area => {
      area.databases.forEach(db => {
        if (!allDatabasesMap.has(db.id)) {
          allDatabasesMap.set(db.id, {
            id: db.id,
            name: db.name,
            url: db.url,
            hasAPI: ['scopus', 'ieee', 'pubmed', 'springer'].includes(db.id),
            areas: [area.key]
          });
        } else {
          allDatabasesMap.get(db.id).areas.push(area.key);
        }
      });
    });
    
    res.json({
      success: true,
      databases: Array.from(allDatabasesMap.values())
    });
  } catch (error) {
    console.error('❌ Error obteniendo bases de datos:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error al obtener bases de datos'
    });
  }
};

/**
 * POST /api/ai/scopus-fetch
 * Busca artículos en Scopus y los guarda automáticamente en la BD del proyecto
 */
const scopusFetch = async (req, res) => {
  try {
    const { query, projectId, count = 25 } = req.body;

    if (!query || !projectId) {
      return res.status(400).json({
        success: false,
        message: 'Query y projectId son requeridos'
      });
    }

    // Obtener API Key del .env
    const apiKey = process.env.SCOPUS_API_KEY;
    
    if (!apiKey) {
      return res.status(500).json({
        success: false,
        message: 'API Key de Scopus no configurada en el servidor'
      });
    }

    console.log('🔍 Buscando y guardando artículos de Scopus...');
    console.log('   Proyecto:', projectId);
    console.log('   Query:', query.substring(0, 100) + '...');
    console.log('   Límite:', count);

    // El use case ahora guardará automáticamente si projectId está presente
    const result = await scopusSearchUseCase.search({ 
      query, 
      apiKey, 
      count,
      projectId // ← Esto activa el guardado automático
    });

    if (result.success) {
      console.log(`✅ ${result.savedCount} artículos guardados en BD`);
    }

    res.json(result);

  } catch (error) {
    console.error('❌ Error en Scopus fetch:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error al buscar y guardar artículos de Scopus'
    });
  }
};

/**
 * GET /api/ai/databases-by-area?area=ingenieria-tecnologia
 * Obtiene las bases de datos académicas filtradas por área de investigación
 */
const getDatabasesByResearchArea = async (req, res) => {
  try {
    const { area } = req.query;

    if (!area) {
      // Si no se especifica área, devolver todas las áreas disponibles
      const allAreas = getAllAreas();
      return res.status(200).json({
        success: true,
        data: {
          areas: allAreas
        }
      });
    }

    console.log('🔍 Obteniendo bases de datos para área:', area);
    
    const databases = getDatabasesByArea(area);
    
    if (!databases || databases.length === 0) {
      return res.status(404).json({
        success: false,
        message: `No se encontraron bases de datos para el área: ${area}`
      });
    }

    console.log('✅ Bases de datos encontradas:', databases.length);

    res.status(200).json({
      success: true,
      data: {
        area,
        databases: databases.map(db => ({
          id: db.id,
          name: db.name,
          url: db.url,
          syntax: db.syntax
        }))
      }
    });
  } catch (error) {
    console.error('❌ Error obteniendo bases de datos por área:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error al obtener bases de datos'
    });
  }
};

/**
 * POST /api/ai/detect-research-area
 * Detecta automáticamente el área de investigación basado en descripción
 */
const detectArea = async (req, res) => {
  try {
    const { researchArea, description } = req.body;

    if (!researchArea && !description) {
      return res.status(400).json({
        success: false,
        message: 'Se requiere researchArea o description'
      });
    }

    console.log('🔍 Detectando área de investigación...');
    
    const detectedArea = detectResearchArea(researchArea, description);
    
    console.log('✅ Área detectada:', detectedArea);

    // Obtener bases de datos para el área detectada
    const databases = getDatabasesByArea(detectedArea);

    res.status(200).json({
      success: true,
      data: {
        detectedArea,
        databases: databases.map(db => ({
          id: db.id,
          name: db.name,
          url: db.url,
          syntax: db.syntax,
          requiresPremium: db.requiresPremium || false,
          premiumNote: db.premiumNote || null
        }))
      }
    });
  } catch (error) {
    console.error('❌ Error detectando área:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error al detectar área de investigación'
    });
  }
};

/**
 * POST /api/ai/google-scholar-count
 * Cuenta resultados en Google Scholar usando SerpApi
 */
const googleScholarCount = async (req, res) => {
  try {
    const { query, startYear, endYear } = req.body;
    if (!query) {
      return res.status(400).json({ success: false, message: 'Query es requerida' });
    }
    const result = await GoogleScholarSearch.count({ query, startYear, endYear });
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Error al contar en Google Scholar' });
  }
};

/**
 * POST /api/ai/analyze-similarity-distribution
 * Analiza la distribución de similitudes y recomienda punto de corte
 */
const analyzeSimilarityDistribution = async (req, res) => {
  try {
    const { projectId } = req.body;

    if (!projectId) {
      return res.status(400).json({
        success: false,
        message: 'ID del proyecto es requerido'
      });
    }

    console.log('📊 Analizando distribución de similitudes...');
    console.log('   Proyecto:', projectId);

    // Obtener referencias del proyecto
    const references = await referenceRepository.findByProject(projectId);

    if (!references || references.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No se encontraron referencias para analizar'
      });
    }

    // Obtener protocolo del proyecto
    const protocol = await protocolRepository.findByProjectId(projectId);

    if (!protocol) {
      return res.status(404).json({
        success: false,
        message: 'No se encontró el protocolo del proyecto'
      });
    }

    // Analizar distribución con embeddings
    const analysis = await screenEmbeddingsUseCase.analyzeDistribution({
      references,
      protocol
    });

    console.log('✅ Análisis de distribución completado');
    console.log('   Referencias analizadas:', analysis.totalReferences);
    console.log('   Punto de corte recomendado:', analysis.recommendedCutoff?.threshold);
    console.log('   Artículos a revisar:', analysis.recommendedCutoff?.articlesToReview);

    res.status(200).json({
      success: true,
      data: analysis
    });

  } catch (error) {
    console.error('❌ Error analizando distribución:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error al analizar distribución de similitudes'
    });
  }
};

/**
 * POST /api/ai/protocol-justification
 * Genera la justificación del protocolo siguiendo metodología PRISMA/Cochrane
 */
const generateProtocolJustification = async (req, res) => {
  try {
    const { title, description, area, yearStart, yearEnd, pico, matrixData, aiProvider } = req.body;

    console.log('📥 DEBUG - Generando justificación del protocolo');
    console.log('   Título:', title);
    console.log('   Área:', area);
    console.log('   Rango temporal:', yearStart, '-', yearEnd);

    // Validaciones
    if (!title || !description) {
      return res.status(400).json({
        success: false,
        message: 'Título y descripción son requeridos'
      });
    }

    if (!pico || !pico.population) {
      return res.status(400).json({
        success: false,
        message: 'Datos PICO son requeridos. Completa el paso anterior primero.'
      });
    }

    console.log('🤖 Generando justificación con IA...');
    console.log('   Proveedor:', aiProvider || 'chatgpt');

    const result = await generateProtocolJustificationUseCase.execute({
      title,
      description,
      area,
      yearStart,
      yearEnd,
      pico,
      matrixData,
      aiProvider: aiProvider || 'chatgpt'
    });

    // Registrar uso de API
    const usedProvider = aiProvider || 'chatgpt';
    await trackApiUsage({
      userId: req.user?.id,
      provider: usedProvider,
      endpoint: '/api/ai/protocol-justification',
      model: getModelByProvider(usedProvider),
      tokensPrompt: 1000,
      tokensCompletion: 1500,
      success: true
    });

    console.log('✅ Justificación generada exitosamente');
    console.log('   Párrafos:', result.justificacion ? '4 párrafos' : 'estructura inesperada');
    console.log('   Palabras:', result.justificacion?.wordCount || 'N/A');
    console.log('   Compliance:', result.justificacion?.prismaCompliance || 'N/A');

    res.status(200).json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('❌ Error generando justificación:', error);
    
    // Registrar error de API
    const errorProvider = req.body.aiProvider || 'chatgpt';
    await trackApiUsage({
      userId: req.user?.id,
      provider: errorProvider,
      endpoint: '/api/ai/protocol-justification',
      model: getModelByProvider(errorProvider),
      success: false,
      errorMessage: error.message
    });
    
    res.status(500).json({
      success: false,
      message: error.message || 'Error al generar justificación con IA'
    });
  }
};

/**
 * POST /api/ai/translate
 * Traduce un texto entre inglés y español usando IA
 */
const translateText = async (req, res) => {
  try {
    const { text, from, to } = req.body;

    if (!text || !from || !to) {
      return res.status(400).json({
        success: false,
        message: 'Se requiere text, from y to (ej: "en", "es")'
      });
    }

    const AIService = require('../../infrastructure/services/ai.service');
    const aiService = new AIService(req.user?.id);

    const langNames = { en: 'English', es: 'Spanish' };
    const fromLang = langNames[from] || from;
    const toLang = langNames[to] || to;

    const systemPrompt = `You are a professional academic translator. Translate the following text from ${fromLang} to ${toLang}. 
Rules:
- Maintain the academic and formal tone
- Keep technical terms accurate
- Return ONLY the translated text, nothing else
- Do not add quotes, explanations, or any extra text`;

    const translatedText = await aiService.generateText(systemPrompt, text, 'chatgpt');

    // Track API usage
    await trackApiUsage({
      userId: req.user?.id,
      provider: 'chatgpt',
      endpoint: '/api/ai/translate',
      model: 'gpt-4o-mini',
      success: true
    });

    res.status(200).json({
      success: true,
      data: {
        translatedText: translatedText.trim(),
        from,
        to
      }
    });
  } catch (error) {
    console.error('❌ Error traduciendo texto:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error al traducir el texto'
    });
  }
};

module.exports = {
  generateProtocolAnalysis,
  generateProtocolJustification,
  screenReference,
  screenReferencesBatch,
  generateTitles,
  generateSearchStrategies,
  screenReferenceEmbeddings,
  screenReferencesBatchEmbeddings,
  generateRankingEmbeddings,
  analyzeSimilarityDistribution,
  generateProtocolTerms,
  generateInclusionExclusionCriteria,
  runProjectScreeningEmbeddings,
  runProjectScreeningStream,
  runProjectScreeningLLM,
  analyzeScreeningResults,
  generateSearchQueries,
  getSupportedDatabases,
  getDatabasesByResearchArea,
  detectArea,
  translateText,
};



