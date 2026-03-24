const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const ArticleController = require('../controllers/article.controller');
const { authMiddleware } = require('../../infrastructure/middlewares/auth.middleware');

const router = express.Router();
router.use(authMiddleware);

const controller = new ArticleController();

// Configurar multer para plantillas de revistas
const templateUploadDir = path.join(__dirname, '../../../uploads/templates');
if (!fs.existsSync(templateUploadDir)) {
  fs.mkdirSync(templateUploadDir, { recursive: true });
}

const templateUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, templateUploadDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `template-${req.params.projectId}-${uniqueSuffix}${ext}`);
    }
  }),
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB max
  },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.pdf' || ext === '.tex' || ext === '.txt') {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos PDF o LaTeX (.tex)'));
    }
  }
});

/**
 * Rutas de Artículo Científico
 * Todas requieren autenticación (middleware aplicado en server.js)
 * Prefijo: /api/projects
 */

// GET /api/projects/:projectId/article/status - Verificar si puede generar artículo
router.get('/:projectId/article/status', (req, res) => controller.getStatus(req, res));

// POST /api/projects/:projectId/article/generate - Generar artículo completo
router.post('/:projectId/article/generate', (req, res) => controller.generate(req, res));

// POST /api/projects/:projectId/article/generate-section - Generar sección específica
router.post('/:projectId/article/generate-section', (req, res) => controller.generateSection(req, res));

// POST /api/projects/:projectId/article/versions - Guardar versión del artículo
router.post('/:projectId/article/versions', (req, res) => controller.saveVersion(req, res));

// GET /api/projects/:projectId/article/versions - Obtener todas las versiones
router.get('/:projectId/article/versions', (req, res) => controller.getVersions(req, res));

// GET /api/projects/:projectId/article/versions/:versionId - Obtener versión específica
router.get('/:projectId/article/versions/:versionId', (req, res) => controller.getVersion(req, res));

// PUT /api/projects/:projectId/article/versions/:versionId - Actualizar versión
router.put('/:projectId/article/versions/:versionId', (req, res) => controller.updateVersion(req, res));

// POST /api/projects/:projectId/article/custom-template - Generar con plantilla personalizada
router.post('/:projectId/article/custom-template', templateUpload.single('template'), (req, res) => controller.generateCustomFormattedArticle(req, res));

// ============================================================================
// RUTAS DE EXPORTACIÓN
// ============================================================================

// GET /api/projects/:projectId/article/export/latex - Exportar LaTeX
router.get('/:projectId/article/export/latex', (req, res) => controller.exportLatex(req, res));

// GET /api/projects/:projectId/article/export/bibtex - Exportar BibTeX
router.get('/:projectId/article/export/bibtex', (req, res) => controller.exportBibtex(req, res));

// GET /api/projects/:projectId/article/export/data-csv - Exportar CSV
router.get('/:projectId/article/export/data-csv', (req, res) => controller.exportDataCSV(req, res));

// GET /api/projects/:projectId/article/export/charts-zip - Exportar gráficos ZIP (PNG + PDF vector)
router.get('/:projectId/article/export/charts-zip', (req, res) => controller.exportChartsZip(req, res));

// GET /api/projects/:projectId/article/export/python-scripts - Exportar scripts Python
router.get('/:projectId/article/export/python-scripts', (req, res) => controller.exportPythonScripts(req, res));

// GET /api/projects/:projectId/article/export/all-zip - Exportar paquete completo
router.get('/:projectId/article/export/all-zip', (req, res) => controller.exportAllZip(req, res));

module.exports = router;
