/**
 * Routes: RQS (Research Question Schema)
 * 
 * Endpoints para gestión de datos RQS extraídos de estudios incluidos.
 */

const express = require('express');
const router = express.Router();
const rqsController = require('../controllers/rqs.controller');
const { authMiddleware } = require('../../infrastructure/middlewares/auth.middleware');

router.use(authMiddleware);

/**
 * GET /api/projects/:projectId/rqs
 * Obtener todas las entradas RQS de un proyecto
 */
router.get('/:projectId/rqs', rqsController.getAll);

/**
 * GET /api/projects/:projectId/rqs/stats
 * Obtener estadísticas RQS del proyecto
 */
router.get('/:projectId/rqs/stats', rqsController.getStats);

/**
 * POST /api/projects/:projectId/rqs/extract
 * Extraer datos RQS de todas las referencias incluidas (masivo)
 */
router.post('/:projectId/rqs/extract', rqsController.extractAll);

/**
 * POST /api/projects/:projectId/rqs/extract/:referenceId
 * Extraer datos RQS de una referencia específica
 */
router.post('/:projectId/rqs/extract/:referenceId', rqsController.extractSingle);

/**
 * PUT /api/projects/:projectId/rqs/:rqsId
 * Actualizar entrada RQS (validación manual)
 */
router.put('/:projectId/rqs/:rqsId', rqsController.update);

/**
 * DELETE /api/projects/:projectId/rqs/:rqsId
 * Eliminar entrada RQS
 */
router.delete('/:projectId/rqs/:rqsId', rqsController.delete);

/**
 * GET /api/projects/:projectId/rqs/export/csv
 * Exportar tabla RQS a CSV
 */
router.get('/:projectId/rqs/export/csv', rqsController.exportCSV);

module.exports = router;
