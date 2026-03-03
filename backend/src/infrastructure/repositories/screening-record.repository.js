const database = require('../../config/database');
const ScreeningRecord = require('../../domain/models/screening-record.model');

/**
 * Repositorio para operaciones de Screening Records en PostgreSQL
 */
class ScreeningRecordRepository {
  /**
   * Crea un nuevo screening record
   */
  async create(recordData) {
    const record = new ScreeningRecord(recordData);
    record.validate();

    const query = `
      INSERT INTO screening_records (
        reference_id, project_id, user_id, stage, scores, 
        total_score, threshold, decision, exclusion_reasons, 
        comment, reviewed_at, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
      RETURNING *
    `;

    const values = [
      record.referenceId,
      record.projectId,
      record.userId,
      record.stage,
      JSON.stringify(record.scores),
      record.totalScore,
      record.threshold,
      record.decision,
      JSON.stringify(record.exclusionReasons),
      record.comment,
      record.reviewedAt
    ];

    const result = await database.query(query, values);
    return new ScreeningRecord(result.rows[0]);
  }

  /**
   * Encuentra todos los screening records de un proyecto
   */
  async findByProject(projectId, filters = {}) {
    let query = 'SELECT * FROM screening_records WHERE project_id = $1';
    const values = [projectId];
    let paramCount = 2;

    // Filtros opcionales
    if (filters.stage) {
      query += ` AND stage = $${paramCount++}`;
      values.push(filters.stage);
    }

    if (filters.decision) {
      query += ` AND decision = $${paramCount++}`;
      values.push(filters.decision);
    }

    if (filters.userId) {
      query += ` AND user_id = $${paramCount++}`;
      values.push(filters.userId);
    }

    query += ' ORDER BY reviewed_at DESC';

    const result = await database.query(query, values);
    return result.rows.map(row => new ScreeningRecord(row));
  }

  /**
   * Encuentra screening records de una referencia específica
   */
  async findByReference(referenceId) {
    const query = `
      SELECT * FROM screening_records 
      WHERE reference_id = $1 
      ORDER BY reviewed_at DESC
    `;

    const result = await database.query(query, [referenceId]);
    return result.rows.map(row => new ScreeningRecord(row));
  }

  /**
   * Encuentra el screening record más reciente de una referencia
   */
  async findLatestByReference(referenceId) {
    const query = `
      SELECT * FROM screening_records 
      WHERE reference_id = $1 
      ORDER BY reviewed_at DESC 
      LIMIT 1
    `;

    const result = await database.query(query, [referenceId]);
    return result.rows[0] ? new ScreeningRecord(result.rows[0]) : null;
  }

  /**
   * Actualiza un screening record existente
   */
  async update(id, updateData) {
    const fields = [];
    const values = [];
    let paramCount = 1;

    // Construir query dinámicamente según los campos a actualizar
    if (updateData.scores !== undefined) {
      fields.push(`scores = $${paramCount++}`);
      values.push(JSON.stringify(updateData.scores));
    }

    if (updateData.totalScore !== undefined) {
      fields.push(`total_score = $${paramCount++}`);
      values.push(updateData.totalScore);
    }

    if (updateData.threshold !== undefined) {
      fields.push(`threshold = $${paramCount++}`);
      values.push(updateData.threshold);
    }

    if (updateData.decision !== undefined) {
      fields.push(`decision = $${paramCount++}`);
      values.push(updateData.decision);
    }

    if (updateData.exclusionReasons !== undefined) {
      fields.push(`exclusion_reasons = $${paramCount++}`);
      values.push(JSON.stringify(updateData.exclusionReasons));
    }

    if (updateData.comment !== undefined) {
      fields.push(`comment = $${paramCount++}`);
      values.push(updateData.comment);
    }

    fields.push(`updated_at = NOW()`);

    if (fields.length === 1) { // Solo updated_at
      return this.findById(id);
    }

    values.push(id);
    const query = `
      UPDATE screening_records 
      SET ${fields.join(', ')} 
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await database.query(query, values);
    return result.rows[0] ? new ScreeningRecord(result.rows[0]) : null;
  }

  /**
   * Elimina un screening record
   */
  async delete(id) {
    const query = 'DELETE FROM screening_records WHERE id = $1 RETURNING *';
    const result = await database.query(query, [id]);
    return result.rows[0] ? new ScreeningRecord(result.rows[0]) : null;
  }

  /**
   * Encuentra un screening record por ID
   */
  async findById(id) {
    const query = 'SELECT * FROM screening_records WHERE id = $1';
    const result = await database.query(query, [id]);
    return result.rows[0] ? new ScreeningRecord(result.rows[0]) : null;
  }

  /**
   * Cuenta screening records por proyecto
   */
  async countByProject(projectId, filters = {}) {
    let query = 'SELECT COUNT(*) as count FROM screening_records WHERE project_id = $1';
    const values = [projectId];
    let paramCount = 2;

    if (filters.stage) {
      query += ` AND stage = $${paramCount++}`;
      values.push(filters.stage);
    }

    if (filters.decision) {
      query += ` AND decision = $${paramCount++}`;
      values.push(filters.decision);
    }

    const result = await database.query(query, values);
    return Number.parseInt(result.rows[0].count, 10);
  }

  /**
   * Obtiene estadísticas de puntajes para un proyecto
   */
  async getScoreStatistics(projectId, stage = 'fulltext') {
    const query = `
      SELECT 
        COUNT(*) as total_records,
        AVG(total_score) as mean_score,
        MIN(total_score) as min_score,
        MAX(total_score) as max_score,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY total_score) as median_score,
        PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY total_score) as p25_score,
        PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY total_score) as p75_score,
        STDDEV(total_score) as std_dev
      FROM screening_records
      WHERE project_id = $1 AND stage = $2
    `;

    const result = await database.query(query, [projectId, stage]);
    return result.rows[0];
  }

  /**
   * Obtiene la distribución de motivos de exclusión
   */
  async getExclusionReasonsDistribution(projectId, stage = 'fulltext') {
    const query = `
      SELECT exclusion_reasons
      FROM screening_records
      WHERE project_id = $1 
        AND stage = $2 
        AND decision = 'exclude'
        AND exclusion_reasons IS NOT NULL
    `;

    const result = await database.query(query, [projectId, stage]);

    // Agrupar y contar motivos
    const reasonCounts = {};
    result.rows.forEach(row => {
      const reasons = typeof row.exclusion_reasons === 'string'
        ? JSON.parse(row.exclusion_reasons)
        : row.exclusion_reasons;

      if (Array.isArray(reasons)) {
        reasons.forEach(reason => {
          reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
        });
      }
    });

    // Convertir a array y ordenar por frecuencia
    return Object.entries(reasonCounts)
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count);
  }

  /**
   * Obtiene todos los puntajes individuales ordenados descendientemente
   * Busca primero en references.screening_score (screening híbrido)
   * Si no hay, busca en screening_records.total_score (screening manual)
   */
  async getAllScores(projectId, stage = 'fulltext') {
    // Intentar desde references (screening híbrido)
    const refQuery = `
      SELECT similarity_score 
      FROM "references" 
      WHERE project_id = $1 AND similarity_score IS NOT NULL
      ORDER BY similarity_score DESC
    `;
    const refResult = await database.query(refQuery, [projectId]);
    
    if (refResult.rows.length > 0) {
      console.log(`📊 Scores encontrados en references: ${refResult.rows.length} puntos`);
      return refResult.rows.map(r => Number.parseFloat(r.similarity_score));
    }
    
    // Fallback: buscar en screening_records
    const query = `
      SELECT total_score 
      FROM screening_records 
      WHERE project_id = $1 AND stage = $2
      ORDER BY total_score DESC
    `;
    const result = await database.query(query, [projectId, stage]);
    console.log(`📊 Scores encontrados en screening_records: ${result.rows.length} puntos`);
    return result.rows.map(r => Number.parseFloat(r.total_score));
  }
}

module.exports = ScreeningRecordRepository;
