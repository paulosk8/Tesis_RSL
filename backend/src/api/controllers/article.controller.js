const ProjectRepository = require('../../infrastructure/repositories/project.repository');
const PrismaItemRepository = require('../../infrastructure/repositories/prisma-item.repository');
const ProtocolRepository = require('../../infrastructure/repositories/protocol.repository');
const ReferenceRepository = require('../../infrastructure/repositories/reference.repository');
const RQSEntryRepository = require('../../infrastructure/repositories/rqs-entry.repository');
const ArticleVersionRepository = require('../../infrastructure/repositories/article-version.repository');
const ScreeningRecordRepository = require('../../infrastructure/repositories/screening-record.repository');
const PythonGraphService = require('../../infrastructure/services/python-graph.service');
const GenerateArticleFromPrismaUseCase = require('../../domain/use-cases/generate-article-from-prisma.use-case');
const GeneratePrismaContextUseCase = require('../../domain/use-cases/generate-prisma-context.use-case');
const ExtractRQSDataUseCase = require('../../domain/use-cases/extract-rqs-data.use-case');
const ExtractFullTextDataUseCase = require('../../domain/use-cases/extract-fulltext-data.use-case');
const AIService = require('../../infrastructure/services/ai.service');
const ArticleVersion = require('../../domain/models/article-version.model');
const latexTemplate = require('../../../templates/article-latex.template');
const { v4: uuidv4 } = require('uuid');
const database = require('../../config/database');
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

/**
 * Controlador de Artículo Científico
 */
class ArticleController {
  constructor() {
    this.projectRepository = new ProjectRepository();
    this.prismaItemRepository = new PrismaItemRepository();
    this.protocolRepository = new ProtocolRepository();
    this.referenceRepository = new ReferenceRepository();
    this.rqsEntryRepository = new RQSEntryRepository();
    this.articleVersionRepository = new ArticleVersionRepository(database);
    this.screeningRecordRepository = new ScreeningRecordRepository();
    this.pythonGraphService = new PythonGraphService();
    // AIService se creará por método para incluir userId
  }

  /**
   * GET /api/projects/:projectId/article/status
   * Verificar si el artículo puede ser generado
   */
  async getStatus(req, res) {
    try {
      const { projectId } = req.params;

      // Verificar permisos
      const isOwner = await this.projectRepository.isOwner(projectId, req.userId);
      if (!isOwner) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permiso para acceder a este artículo'
        });
      }

      // Verificar estado de PRISMA
      const stats = await this.prismaItemRepository.getComplianceStats(projectId);
      const completed = parseInt(stats.completed) || 0;
      const isPrismaComplete = completed === 27;

      res.status(200).json({
        success: true,
        data: {
          canGenerate: isPrismaComplete,
          prismaCompleted: completed,
          prismaTotal: 27,
          message: isPrismaComplete
            ? 'PRISMA completo. El artículo puede ser generado.'
            : `Debe completar PRISMA primero: ${completed}/27 ítems completados.`,
          blockingReason: isPrismaComplete ? null : 'PRISMA_INCOMPLETE'
        }
      });

    } catch (error) {
      console.error('❌ Error obteniendo estado del artículo:', error);
      res.status(500).json({
        success: false,
        message: 'Error al verificar estado del artículo',
        error: error.message
      });
    }
  }

  /**
   * POST /api/projects/:projectId/article/generate
   * Generar artículo científico completo desde PRISMA cerrado
   */
  async generate(req, res) {
    try {
      const { projectId } = req.params;

      // Verificar permisos
      const isOwner = await this.projectRepository.isOwner(projectId, req.userId);
      if (!isOwner) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permiso para generar artículo'
        });
      }

      console.log(`📄 Iniciando generación de artículo para proyecto ${projectId}`);

      // ✅ Extender timeout del request a 10 minutos (artículo hace muchas llamadas IA)
      if (req.setTimeout) req.setTimeout(600000);
      if (res.setTimeout) res.setTimeout(600000);

      // Crear use cases
      const aiService = new AIService(req.userId);
      
      const generateContextUseCase = new GeneratePrismaContextUseCase({
        protocolRepository: this.protocolRepository,
        referenceRepository: this.referenceRepository,
        projectRepository: this.projectRepository
      });

      const extractRQSDataUseCase = new ExtractRQSDataUseCase({
        rqsEntryRepository: this.rqsEntryRepository,
        referenceRepository: this.referenceRepository,
        protocolRepository: this.protocolRepository,
        aiService: aiService
      });

      const extractFullTextDataUseCase = new ExtractFullTextDataUseCase({
        referenceRepository: this.referenceRepository,
        aiService: aiService
      });

      const generateArticleUseCase = new GenerateArticleFromPrismaUseCase({
        prismaItemRepository: this.prismaItemRepository,
        protocolRepository: this.protocolRepository,
        rqsEntryRepository: this.rqsEntryRepository,
        screeningRecordRepository: this.screeningRecordRepository,
        referenceRepository: this.referenceRepository,
        aiService: aiService,
        pythonGraphService: this.pythonGraphService,
        generatePrismaContextUseCase: generateContextUseCase,
        extractRQSDataUseCase: extractRQSDataUseCase,
        extractFullTextDataUseCase: extractFullTextDataUseCase
      });

      const result = await generateArticleUseCase.execute(projectId);

      // Transformar a formato esperado por frontend (claves en inglés)
      const article = result.article;
      const sections = {
        abstract: article.abstract,
        introduction: article.introduction,
        methods: article.methods,
        results: article.results,
        discussion: article.discussion,
        conclusions: article.conclusions,
        references: article.references,
        declarations: article.declarations || ''
      };

      res.status(200).json({
        success: true,
        data: {
          title: article.title,
          sections: sections,
          metadata: article.metadata
        },
        message: 'Artículo científico generado exitosamente'
      });

    } catch (error) {
      console.error('❌ Error generando artículo:', error);

      // Error específico si PRISMA incompleto
      if (error.message.includes('PRISMA incompleto')) {
        return res.status(400).json({
          success: false,
          message: error.message,
          code: 'PRISMA_INCOMPLETE'
        });
      }

      res.status(500).json({
        success: false,
        message: 'Error al generar artículo científico',
        error: error.message
      });
    }
  }

  /**
   * POST /api/projects/:projectId/article/generate-section
   * Generar una sección específica del artículo
   * Body: { section: 'introduction' | 'methods' | 'results' | 'discussion' | 'conclusions' }
   */
  async generateSection(req, res) {
    try {
      const { projectId } = req.params;
      const { section } = req.body;

      // Verificar permisos
      const isOwner = await this.projectRepository.isOwner(projectId, req.userId);
      if (!isOwner) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permiso para generar secciones'
        });
      }

      // Validar sección
      const validSections = ['introduction', 'methods', 'results', 'discussion', 'conclusions'];
      if (!validSections.includes(section)) {
        return res.status(400).json({
          success: false,
          message: `Sección inválida. Debe ser una de: ${validSections.join(', ')}`
        });
      }

      // Crear use cases
      const aiService = new AIService(req.userId);
      
      const generateContextUseCase = new GeneratePrismaContextUseCase({
        protocolRepository: this.protocolRepository,
        referenceRepository: this.referenceRepository,
        projectRepository: this.projectRepository
      });

      const extractRQSDataUseCase = new ExtractRQSDataUseCase({
        rqsEntryRepository: this.rqsEntryRepository,
        referenceRepository: this.referenceRepository,
        protocolRepository: this.protocolRepository,
        aiService: aiService
      });

      const extractFullTextDataUseCase = new ExtractFullTextDataUseCase({
        referenceRepository: this.referenceRepository,
        aiService: aiService
      });

      const generateArticleUseCase = new GenerateArticleFromPrismaUseCase({
        prismaItemRepository: this.prismaItemRepository,
        protocolRepository: this.protocolRepository,
        rqsEntryRepository: this.rqsEntryRepository,
        screeningRecordRepository: this.screeningRecordRepository,
        referenceRepository: this.referenceRepository,
        aiService: aiService,
        pythonGraphService: this.pythonGraphService,
        generatePrismaContextUseCase: generateContextUseCase,
        extractRQSDataUseCase: extractRQSDataUseCase,
        extractFullTextDataUseCase: extractFullTextDataUseCase
      });

      // Validar PRISMA completo
      await generateArticleUseCase.validatePrismaComplete(projectId);

      // Obtener datos necesarios
      const prismaItems = await this.prismaItemRepository.findAllByProject(projectId);
      const contextResult = await generateContextUseCase.execute(projectId);
      const prismaMapping = generateArticleUseCase.mapPrismaToIMRaD(prismaItems);

      // Generar solo la sección solicitada
      let content;
      switch (section) {
        case 'introduction':
          content = await generateArticleUseCase.generateIntroduction(prismaMapping, contextResult.context);
          break;
        case 'methods':
          content = await generateArticleUseCase.generateMethods(prismaMapping, contextResult.context);
          break;
        case 'results':
          content = await generateArticleUseCase.generateResults(prismaMapping, contextResult.context);
          break;
        case 'discussion':
          content = await generateArticleUseCase.generateDiscussion(prismaMapping, contextResult.context);
          break;
        case 'conclusions':
          content = await generateArticleUseCase.generateConclusions(prismaMapping, contextResult.context);
          break;
      }

      res.status(200).json({
        success: true,
        data: {
          section,
          content,
          wordCount: content.split(/\s+/).filter(w => w.length > 0).length
        },
        message: `Sección ${section} generada exitosamente`
      });

    } catch (error) {
      console.error(`❌ Error generando sección ${req.body.section}:`, error);

      if (error.message.includes('PRISMA incompleto')) {
        return res.status(400).json({
          success: false,
          message: error.message,
          code: 'PRISMA_INCOMPLETE'
        });
      }

      res.status(500).json({
        success: false,
        message: 'Error al generar sección del artículo',
        error: error.message
      });
    }
  }

  /**
   * POST /api/projects/:projectId/article/versions
   * Guardar una versión del artículo
   */
  async saveVersion(req, res) {
    try {
      const { projectId } = req.params;
      const { title, sections, changeDescription } = req.body;

      // Verificar permisos
      const isOwner = await this.projectRepository.isOwner(projectId, req.userId);
      if (!isOwner) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permiso para guardar versiones de este artículo'
        });
      }

      // Obtener siguiente número de versión
      const nextVersion = await this.articleVersionRepository.getNextVersionNumber(projectId);

      // Crear objeto de versión
      const versionData = {
        id: uuidv4(),
        projectId,
        versionNumber: nextVersion,
        title,
        abstract: sections.abstract || '',
        introduction: sections.introduction || '',
        methods: sections.methods || '',
        results: sections.results || '',
        discussion: sections.discussion || '',
        conclusions: sections.conclusions || '',
        referencesSection: sections.references || '',
        declarations: sections.declarations || '',
        description: changeDescription || `Versión ${nextVersion}`,
        wordCount: 0,
        createdBy: req.userId,
        createdAt: new Date()
      };

      const articleVersion = new ArticleVersion(versionData);
      articleVersion.calculateWordCount();

      // Guardar en la base de datos
      const savedVersion = await this.articleVersionRepository.create(articleVersion);

      res.status(201).json({
        success: true,
        data: savedVersion.toJSON()
      });
    } catch (error) {
      console.error('Error al guardar versión del artículo:', error);
      res.status(500).json({
        success: false,
        message: 'Error al guardar versión del artículo',
        error: error.message
      });
    }
  }

  /**
   * GET /api/projects/:projectId/article/versions
   * Obtener todas las versiones del artículo
   */
  async getVersions(req, res) {
    try {
      const { projectId } = req.params;

      // Verificar permisos
      const isOwner = await this.projectRepository.isOwner(projectId, req.userId);
      if (!isOwner) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permiso para acceder a las versiones de este artículo'
        });
      }

      // Obtener versiones
      const versions = await this.articleVersionRepository.findByProject(projectId);

      res.status(200).json({
        success: true,
        data: versions.map(v => v.toJSON())
      });
    } catch (error) {
      console.error('Error al obtener versiones del artículo:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener versiones del artículo',
        error: error.message
      });
    }
  }

  /**
   * GET /api/projects/:projectId/article/versions/:versionId
   * Obtener una versión específica del artículo
   */
  async getVersion(req, res) {
    try {
      const { projectId, versionId } = req.params;

      // Verificar permisos
      const isOwner = await this.projectRepository.isOwner(projectId, req.userId);
      if (!isOwner) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permiso para acceder a esta versión del artículo'
        });
      }

      // Obtener versión
      const version = await this.articleVersionRepository.findById(versionId);

      if (!version) {
        return res.status(404).json({
          success: false,
          message: 'Versión no encontrada'
        });
      }

      res.status(200).json({
        success: true,
        data: version.toJSON()
      });
    } catch (error) {
      console.error('Error al obtener versión del artículo:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener versión del artículo',
        error: error.message
      });
    }
  }

  /**
   * PUT /api/projects/:projectId/article/versions/:versionId
   * Actualizar una versión del artículo
   */
  async updateVersion(req, res) {
    try {
      const { projectId, versionId } = req.params;
      const { title, sections } = req.body;

      // Verificar permisos
      const isOwner = await this.projectRepository.isOwner(projectId, req.userId);
      if (!isOwner) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permiso para actualizar esta versión del artículo'
        });
      }

      // Actualizar versión
      const updatedVersion = await this.articleVersionRepository.update(versionId, {
        title,
        sections
      });

      if (!updatedVersion) {
        return res.status(404).json({
          success: false,
          message: 'Versión no encontrada'
        });
      }

      // Recalcular palabras
      updatedVersion.calculateWordCount();
      await this.articleVersionRepository.update(versionId, {
        wordCount: updatedVersion.wordCount
      });

      res.status(200).json({
        success: true,
        data: updatedVersion.toJSON()
      });
    } catch (error) {
      console.error('Error al actualizar versión del artículo:', error);
      res.status(500).json({
        success: false,
        message: 'Error al actualizar versión del artículo',
        error: error.message
      });
    }
  }

  /**
   * GET /api/projects/:projectId/article/export/latex
   * Exportar artículo en formato LaTeX
   */
  async exportLatex(req, res) {
    try {
      const { projectId } = req.params;

      // Verificar permisos
      const isOwner = await this.projectRepository.isOwner(projectId, req.userId);
      if (!isOwner) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permiso para exportar este artículo'
        });
      }

      // Generar artículo si no se ha generado aún
      const aiService = new AIService(req.userId);
      
      const generateContextUseCase = new GeneratePrismaContextUseCase({
        protocolRepository: this.protocolRepository,
        referenceRepository: this.referenceRepository,
        projectRepository: this.projectRepository
      });

      const extractRQSDataUseCase = new ExtractRQSDataUseCase({
        rqsEntryRepository: this.rqsEntryRepository,
        referenceRepository: this.referenceRepository,
        protocolRepository: this.protocolRepository,
        aiService: aiService
      });

      const extractFullTextDataUseCase = new ExtractFullTextDataUseCase({
        referenceRepository: this.referenceRepository,
        aiService: aiService
      });

      const generateArticleUseCase = new GenerateArticleFromPrismaUseCase({
        prismaItemRepository: this.prismaItemRepository,
        protocolRepository: this.protocolRepository,
        rqsEntryRepository: this.rqsEntryRepository,
        screeningRecordRepository: this.screeningRecordRepository,
        referenceRepository: this.referenceRepository,
        aiService: aiService,
        pythonGraphService: this.pythonGraphService,
        generatePrismaContextUseCase: generateContextUseCase,
        extractRQSDataUseCase: extractRQSDataUseCase,
        extractFullTextDataUseCase: extractFullTextDataUseCase
      });

      const result = await generateArticleUseCase.execute(projectId);
      const article = result.article;

      // Obtener perfil de usuario para autor
      const userProfile = { email: req.user?.email, fullName: req.user?.fullName };

      // Generar LaTeX
      const latexContent = latexTemplate.generate(article, userProfile);

      // Configurar headers para descarga
      const filename = `article_${projectId.substring(0, 8)}.tex`;
      res.setHeader('Content-Type', 'application/x-latex');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(latexContent);

    } catch (error) {
      console.error('❌ Error exportando LaTeX:', error);
      res.status(500).json({
        success: false,
        message: 'Error al exportar artículo en formato LaTeX',
        error: error.message
      });
    }
  }

  /**
   * GET /api/projects/:projectId/article/export/bibtex
   * Exportar referencias en formato BibTeX
   */
  async exportBibtex(req, res) {
    try {
      const { projectId } = req.params;

      // Verificar permisos
      const isOwner = await this.projectRepository.isOwner(projectId, req.userId);
      if (!isOwner) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permiso para exportar referencias'
        });
      }

      // Obtener RQS entries (estudios incluidos)
      const rqsEntries = await this.rqsEntryRepository.findByProject(projectId);

      if (rqsEntries.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No hay estudios incluidos para exportar'
        });
      }

      // Generar BibTeX
      const bibtexContent = this.generateBibtexFromRQS(rqsEntries);

      // Configurar headers para descarga
      const filename = `references_${projectId.substring(0, 8)}.bib`;
      res.setHeader('Content-Type', 'application/x-bibtex');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(bibtexContent);

    } catch (error) {
      console.error('❌ Error exportando BibTeX:', error);
      res.status(500).json({
        success: false,
        message: 'Error al exportar referencias en formato BibTeX',
        error: error.message
      });
    }
  }

  /**
   * GET /api/projects/:projectId/article/export/data-csv
   * Exportar datos RQS en formato CSV
   */
  async exportDataCSV(req, res) {
    try {
      const { projectId } = req.params;

      // Verificar permisos
      const isOwner = await this.projectRepository.isOwner(projectId, req.userId);
      if (!isOwner) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permiso para exportar datos'
        });
      }

      // Obtener RQS entries
      const rqsEntries = await this.rqsEntryRepository.findByProject(projectId);

      if (rqsEntries.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No hay datos RQS para exportar'
        });
      }

      // Generar CSV
      const csvContent = this.generateCSVFromRQS(rqsEntries);

      // Configurar headers para descarga
      const filename = `rqs_data_${projectId.substring(0, 8)}.csv`;
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send('\uFEFF' + csvContent); // BOM para UTF-8

    } catch (error) {
      console.error('❌ Error exportando CSV:', error);
      res.status(500).json({
        success: false,
        message: 'Error al exportar datos en formato CSV',
        error: error.message
      });
    }
  }

  /**
   * GET /api/projects/:projectId/article/export/charts-zip
   * Exportar gráficos en formato ZIP
   */
  async exportChartsZip(req, res) {
    try {
      const { projectId } = req.params;

      // Verificar permisos
      const isOwner = await this.projectRepository.isOwner(projectId, req.userId);
      if (!isOwner) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permiso para exportar gráficos'
        });
      }

      const chartsDir = path.join(__dirname, '../../../uploads/charts');
      
      // Verificar que existan gráficos
      if (!fs.existsSync(chartsDir)) {
        return res.status(404).json({
          success: false,
          message: 'No se encontraron gráficos generados'
        });
      }

      const chartFiles = fs.readdirSync(chartsDir).filter(file => 
        file.endsWith('.png') || file.endsWith('.pdf') || file.endsWith('.eps')
      );

      if (chartFiles.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'No hay gráficos disponibles para exportar'
        });
      }

      // Crear ZIP
      const archive = archiver('zip', { zlib: { level: 9 } });
      const filename = `charts_${projectId.substring(0, 8)}.zip`;

      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

      archive.pipe(res);

      // Agregar archivos al ZIP organizados por formato
      chartFiles.forEach(file => {
        const filePath = path.join(chartsDir, file);
        const ext = path.extname(file).toLowerCase();
        const subfolder = ext === '.pdf' ? 'vector/' : ext === '.eps' ? 'vector/' : 'raster/';
        archive.file(filePath, { name: `${subfolder}${file}` });
      });

      await archive.finalize();

    } catch (error) {
      console.error('❌ Error exportando gráficos:', error);
      res.status(500).json({
        success: false,
        message: 'Error al exportar gráficos',
        error: error.message
      });
    }
  }

  /**
   * GET /api/projects/:projectId/article/export/python-scripts
   * Exportar script Python para generación de gráficos
   */
  async exportPythonScripts(req, res) {
    try {
      const { projectId } = req.params;

      // Verificar permisos
      const isOwner = await this.projectRepository.isOwner(projectId, req.userId);
      if (!isOwner) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permiso para exportar scripts'
        });
      }

      const pythonScriptPath = path.join(__dirname, '../../../scripts/generate_charts.py');
      
      if (!fs.existsSync(pythonScriptPath)) {
        return res.status(404).json({
          success: false,
          message: 'Script Python no encontrado'
        });
      }

      // Crear ZIP con el script + un README de uso + requirements
      const archive = archiver('zip', { zlib: { level: 9 } });
      const filename = `python_scripts_${projectId.substring(0, 8)}.zip`;

      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

      archive.pipe(res);

      // 1. Script principal
      archive.file(pythonScriptPath, { name: 'generate_charts.py' });

      // 2. Requirements
      const requirementsContent = `# Python dependencies for chart generation
matplotlib>=3.7.0
pandas>=2.0.0
numpy>=1.24.0
`;
      archive.append(requirementsContent, { name: 'requirements.txt' });

      // 3. README con instrucciones
      const readmeContent = `# Chart Generation Scripts

## Setup

\`\`\`bash
pip install -r requirements.txt
\`\`\`

## Usage

The script reads JSON data from stdin and outputs charts to the specified directory:

\`\`\`bash
echo '{"prisma": {...}, "scree": {"scores": [...]}}' | python generate_charts.py --output-dir ./output
\`\`\`

## Output Formats

Each chart is automatically saved in two formats:
- **PNG** (300 DPI raster) — for screen display and web
- **PDF** (vector) — for high-impact journal publication (required by IEEE, Elsevier, Springer, MDPI)

## Available Charts

1. **prisma_flow** — PRISMA 2020 flow diagram
2. **scree_plot** — AI screening relevance scores with elbow detection
3. **chart1_search** — Database search strategy table
4. **temporal_distribution** — Publication year distribution
5. **quality_assessment** — Methodological quality assessment
6. **bubble_chart** — Metrics vs Technologies mapping
7. **technical_synthesis** — Comparative technical performance table

## Customization

You can modify:
- Colors: Edit the color constants at the top of each draw function
- Fonts: Change \`plt.rcParams\` in the global style section
- Labels: Modify axis labels and titles in each function
- DPI: Adjust the \`dpi\` parameter in \`save_figure()\`
`;
      archive.append(readmeContent, { name: 'README.md' });

      await archive.finalize();

    } catch (error) {
      console.error('❌ Error exportando scripts Python:', error);
      res.status(500).json({
        success: false,
        message: 'Error al exportar scripts Python',
        error: error.message
      });
    }
  }

  /**
   * GET /api/projects/:projectId/article/export/all-zip
   * Exportar todo (LaTeX, BibTeX, CSV, Gráficos, Script Python)
   */
  async exportAllZip(req, res) {
    try {
      const { projectId } = req.params;

      // Verificar permisos
      const isOwner = await this.projectRepository.isOwner(projectId, req.userId);
      if (!isOwner) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permiso para exportar este proyecto'
        });
      }

      // Generar artículo
      const aiService = new AIService(req.userId);
      
      const generateContextUseCase = new GeneratePrismaContextUseCase({
        protocolRepository: this.protocolRepository,
        referenceRepository: this.referenceRepository,
        projectRepository: this.projectRepository
      });

      const extractRQSDataUseCase = new ExtractRQSDataUseCase({
        rqsEntryRepository: this.rqsEntryRepository,
        referenceRepository: this.referenceRepository,
        protocolRepository: this.protocolRepository,
        aiService: aiService
      });

      const extractFullTextDataUseCase = new ExtractFullTextDataUseCase({
        referenceRepository: this.referenceRepository,
        aiService: aiService
      });

      const generateArticleUseCase = new GenerateArticleFromPrismaUseCase({
        prismaItemRepository: this.prismaItemRepository,
        protocolRepository: this.protocolRepository,
        rqsEntryRepository: this.rqsEntryRepository,
        screeningRecordRepository: this.screeningRecordRepository,
        referenceRepository: this.referenceRepository,
        aiService: aiService,
        pythonGraphService: this.pythonGraphService,
        generatePrismaContextUseCase: generateContextUseCase,
        extractRQSDataUseCase: extractRQSDataUseCase,
        extractFullTextDataUseCase: extractFullTextDataUseCase
      });

      const result = await generateArticleUseCase.execute(projectId);
      const article = result.article;
      const rqsEntries = await this.rqsEntryRepository.findByProject(projectId);

      // Crear ZIP
      const archive = archiver('zip', { zlib: { level: 9 } });
      const filename = `article_complete_${projectId.substring(0, 8)}.zip`;

      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

      archive.pipe(res);

      // 1. LaTeX
      const userProfile = { email: req.user?.email, fullName: req.user?.fullName };
      const latexContent = latexTemplate.generate(article, userProfile);
      archive.append(latexContent, { name: 'article.tex' });

      // 2. BibTeX
      if (rqsEntries.length > 0) {
        const bibtexContent = this.generateBibtexFromRQS(rqsEntries);
        archive.append(bibtexContent, { name: 'references.bib' });
      }

      // 3. CSV
      if (rqsEntries.length > 0) {
        const csvContent = this.generateCSVFromRQS(rqsEntries);
        archive.append('\uFEFF' + csvContent, { name: 'rqs_data.csv' });
      }

      // 4. Gráficos
      const chartsDir = path.join(__dirname, '../../../uploads/charts');
      if (fs.existsSync(chartsDir)) {
        const chartFiles = fs.readdirSync(chartsDir).filter(file => 
          file.endsWith('.png') || file.endsWith('.pdf') || file.endsWith('.eps')
        );
        chartFiles.forEach(file => {
          const filePath = path.join(chartsDir, file);
          const ext = path.extname(file).toLowerCase();
          const subfolder = ext === '.pdf' || ext === '.eps' ? 'charts/vector/' : 'charts/raster/';
          archive.file(filePath, { name: `${subfolder}${file}` });
        });
      }

      // 5. Script Python
      const pythonScriptPath = path.join(__dirname, '../../../scripts/generate_charts.py');
      if (fs.existsSync(pythonScriptPath)) {
        archive.file(pythonScriptPath, { name: 'generate_charts.py' });
      }

      // 6. README con instrucciones
      const readmeContent = this.generateExportReadme(article);
      archive.append(readmeContent, { name: 'README.md' });

      await archive.finalize();

    } catch (error) {
      console.error('❌ Error exportando paquete completo:', error);
      res.status(500).json({
        success: false,
        message: 'Error al exportar paquete completo',
        error: error.message
      });
    }
  }

  // ============================================================================
  // MÉTODOS AUXILIARES
  // ============================================================================

  /**
   * Generar BibTeX desde RQS entries
   */
  generateBibtexFromRQS(rqsEntries) {
    let bibtex = '% BibTeX entries for included studies\n';
    bibtex += `% Generated: ${new Date().toISOString()}\n\n`;

    rqsEntries.forEach((entry, index) => {
      const id = `study${index + 1}`;
      const author = entry.author || 'Unknown';
      const year = entry.year || '0000';
      const title = entry.title || 'Untitled';
      const source = entry.source || 'Unknown Source';

      bibtex += `@article{${id},\n`;
      bibtex += `  author = {${author}},\n`;
      bibtex += `  title = {${title}},\n`;
      bibtex += `  journal = {${source}},\n`;
      bibtex += `  year = {${year}},\n`;
      
      if (entry.technology) {
        bibtex += `  keywords = {${entry.technology}},\n`;
      }
      
      bibtex += `}\n\n`;
    });

    return bibtex;
  }

  /**
   * Generar CSV desde RQS entries
   */
  generateCSVFromRQS(rqsEntries) {
    let csv = 'ID,Author,Year,Title,Source,Study Type,Technology,Context,Quality Score,RQ1,RQ2,RQ3\n';

    rqsEntries.forEach((entry, index) => {
      const row = [
        index + 1,
        this.escapeCsv(entry.author || ''),
        entry.year || '',
        this.escapeCsv(entry.title || ''),
        this.escapeCsv(entry.source || ''),
        entry.studyType || '',
        this.escapeCsv(entry.technology || ''),
        entry.context || '',
        entry.qualityScore || '',
        entry.rq1Relation || '',
        entry.rq2Relation || '',
        entry.rq3Relation || ''
      ];
      csv += row.join(',') + '\n';
    });

    return csv;
  }

  /**
   * Escapar valores CSV
   */
  escapeCsv(value) {
    if (value === null || value === undefined) return '';
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  /**
   * Generar README para exportación
   */
  generateExportReadme(article) {
    return `# Scientific Article Export Package

## Contents

1. **article.tex** - LaTeX source file (ready to compile with pdflatex or Overleaf)
2. **references.bib** - BibTeX references for automatic bibliography
3. **rqs_data.csv** - Research Question Schema data (importable to Excel/R/Python)
4. **charts/raster/** - All generated charts in PNG format (300 DPI)
5. **charts/vector/** - All generated charts in PDF vector format (required by high-impact journals)
6. **generate_charts.py** - Python script to regenerate/customize charts

## Compilation Instructions

### LaTeX
\`\`\`bash
pdflatex article.tex
bibtex article
pdflatex article.tex
pdflatex article.tex
\`\`\`

Or use Overleaf: Upload all files to a new project.

### Python Charts
\`\`\`bash
pip install matplotlib pandas numpy
python generate_charts.py
\`\`\`

## Vector Graphics for Journals

High-impact journals (IEEE, Elsevier, Springer, MDPI) require vector graphics (PDF/EPS).
Use the files in \`charts/vector/\` for submission. The PDF files can be included directly
in LaTeX with \\includegraphics{}.

## Article Metadata

- **Title**: ${article.title}
- **Generated**: ${article.metadata?.generatedAt || new Date().toISOString()}
- **Word Count**: ${article.metadata?.wordCount || 'N/A'}
- **Included Studies**: ${article.metadata?.rqsEntriesCount || 'N/A'}
- **PRISMA Compliant**: ${article.metadata?.prismaCompliant ? 'Yes' : 'No'}

## Data Analysis

The CSV file contains structured data for further analysis:
- Import into Excel for pivot tables
- Load into R/Python for statistical tests
- Visualize with Tableau/PowerBI

## Support

For issues or questions about this export, consult the system documentation.
`;
  }

}

module.exports = ArticleController;

