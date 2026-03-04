const ProtocolRepository = require('../../infrastructure/repositories/protocol.repository');
const ProjectRepository = require('../../infrastructure/repositories/project.repository');
const GenerateResearchQuestionsUseCase = require('../../domain/use-cases/generate-research-questions.use-case');
const AIService = require('../../infrastructure/services/ai.service');

/**
 * Controlador de protocolos
 */
class ProtocolController {
  constructor() {
    this.protocolRepository = new ProtocolRepository();
    this.projectRepository = new ProjectRepository();
  }

  /**
   * GET /api/projects/:projectId/protocol
   */
  async get(req, res) {
    try {
      const { projectId } = req.params;
      console.log('📋 GET Protocol - projectId:', projectId, 'userId:', req.userId);

      if (!req.userId) {
        console.error('❌ userId no está definido en req');
        return res.status(401).json({
          success: false,
          message: 'Usuario no autenticado'
        });
      }

      // Verificar permisos
      const isOwner = await this.projectRepository.isOwner(projectId, req.userId);
      console.log('🔐 isOwner:', isOwner);
      
      if (!isOwner) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permiso para ver este protocolo'
        });
      }

      let protocol = await this.protocolRepository.findByProjectId(projectId);
      console.log('📋 Protocol found:', !!protocol);

      // Si no existe, crear uno vacío
      if (!protocol) {
        console.log('⚠️ Protocolo no existe, creando uno nuevo');
        protocol = await this.protocolRepository.create({ projectId });
      }

      res.status(200).json({
        success: true,
        data: { protocol: protocol.toJSON() }
      });
    } catch (error) {
      console.error('❌ Error obteniendo protocolo:', error);
      console.error('Stack trace:', error.stack);
      res.status(500).json({
        success: false,
        message: 'Error al obtener protocolo',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * PUT /api/projects/:projectId/protocol
   */
  async update(req, res) {
    try {
      const { projectId } = req.params;

      // Verificar permisos
      const isOwner = await this.projectRepository.isOwner(projectId, req.userId);
      if (!isOwner) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permiso para actualizar este protocolo'
        });
      }

      // Verificar si el protocolo existe, si no, crearlo primero
      let protocol = await this.protocolRepository.findByProjectId(projectId);
      if (!protocol) {
        console.log('⚠️ Protocolo no existe, creándolo para proyecto:', projectId);
        protocol = await this.protocolRepository.create({ projectId });
      }

      console.log('🔍 DEBUG - Datos recibidos para actualizar protocolo:', JSON.stringify(req.body, null, 2));

      // Actualizar el protocolo
      protocol = await this.protocolRepository.update(projectId, req.body);

      if (!protocol) {
        return res.status(404).json({
          success: false,
          message: 'No se pudo actualizar el protocolo'
        });
      }

      console.log('✅ DEBUG - Protocolo actualizado y devuelto:', JSON.stringify(protocol.toJSON(), null, 2));

      res.status(200).json({
        success: true,
        message: 'Protocolo actualizado exitosamente',
        data: { protocol: protocol.toJSON() }
      });
    } catch (error) {
      console.error('Error actualizando protocolo:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Error al actualizar protocolo'
      });
    }
  }

  /**
   * POST /api/projects/:projectId/protocol/generate-rqs
   */
  async generateRQs(req, res) {
    try {
      const { projectId } = req.params;
      const userId = req.userId;

      // 1. Verificar permisos
      const isOwner = await this.projectRepository.isOwner(projectId, userId);
      if (!isOwner) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permiso para realizar esta acción'
        });
      }

      // 2. Obtener protocolo actual (crear si no existe)
      let protocol = await this.protocolRepository.findByProjectId(projectId);
      if (!protocol) {
        console.log('⚠️ Protocolo no existe al intentar generar RQs, creándolo para proyecto:', projectId);
        protocol = await this.protocolRepository.create({ projectId });
      }

      // 3. Obtener datos del proyecto para el contexto
      const project = await this.projectRepository.findById(projectId);

      // 4. Determinar datos PICO (priorizar body para evitar delay de auto-save)
      const bodyPico = req.body.picoData;
      const picoData = {
        population: bodyPico?.population || protocol.population,
        intervention: bodyPico?.intervention || protocol.intervention,
        comparison: bodyPico?.comparison || protocol.comparison,
        outcomes: bodyPico?.outcome || bodyPico?.outcomes || protocol.outcomes
      };

      console.log('🤖 Preparando generación de RQs con PICO (final):', picoData);

      const aiService = new AIService(userId);
      const generateUseCase = new GenerateResearchQuestionsUseCase({ aiService });
      const result = await generateUseCase.execute({
        projectTitle: project.name || project.title,
        projectDescription: project.description,
        researchArea: protocol.researchArea || project.area || project.researchArea,
        picoData
      });
      
      /*
      const result = {
        researchQuestions: [
          "MOCK Q1: ¿Cómo impacta la herramienta mockeada en el outcome mockeado?",
          "MOCK Q2: ¿Cuál es el nivel de mantenibilidad comparado con el control?",
          "MOCK Q3: ¿Qué factores técnicos moderan la escalabilidad del sistema abstracto?"
        ]
      }
      */
      
      console.log('✅ RQs generadas por Use Case:', JSON.stringify(result, null, 2));

      // 6. Persistir las RQs generadas
      const updatedProtocol = await this.protocolRepository.update(projectId, {
        researchQuestions: result.researchQuestions
      });

      res.status(200).json({
        success: true,
        message: 'Preguntas de investigación generadas exitosamente',
        data: {
          researchQuestions: result.researchQuestions,
          protocol: updatedProtocol.toJSON()
        }
      });

    } catch (error) {
      console.error('Error generando RQs:', error);
      res.status(500).json({
        success: false,
        message: 'Error al generar preguntas de investigación',
        error: error.message
      });
    }
  }
}

module.exports = new ProtocolController();
