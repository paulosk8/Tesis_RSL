const database = require('../../config/database');
const Reference = require('../../domain/models/reference.model');

/**
 * Repositorio para operaciones de Referencias en PostgreSQL
 */
class ReferenceRepository {
  async findById(id) {
    const query = 'SELECT * FROM "references" WHERE id = $1';
    const result = await database.query(query, [id]);
    return result.rows[0] ? new Reference(result.rows[0]) : null;
  }

  async findByProjectId(projectId, filters = {}, limit = 100, offset = 0) {
    let query = 'SELECT * FROM "references" WHERE project_id = $1';
    const values = [projectId];
    let paramCount = 2;

    // Filtros opcionales
    if (filters.screeningStatus) {
      query += ` AND screening_status = $${paramCount++}`;
      values.push(filters.screeningStatus);
    }

    if (filters.year) {
      query += ` AND year = $${paramCount++}`;
      values.push(filters.year);
    }

    if (filters.source) {
      query += ` AND source = $${paramCount++}`;
      values.push(filters.source);
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramCount++} OFFSET $${paramCount}`;
    values.push(limit, offset);

    const result = await database.query(query, values);
    return result.rows.map(row => new Reference(row));
  }

  // Método para exportación (sin límites)
  async findByProject(projectId, filters = {}) {
    let query = 'SELECT * FROM "references" WHERE project_id = $1';
    const values = [projectId];
    let paramCount = 2;

    // Filtros opcionales
    if (filters.screeningStatus) {
      query += ` AND screening_status = $${paramCount++}`;
      values.push(filters.screeningStatus);
    }

    if (filters.year) {
      query += ` AND year = $${paramCount++}`;
      values.push(filters.year);
    }

    if (filters.source) {
      query += ` AND source = $${paramCount++}`;
      values.push(filters.source);
    }

    query += ` ORDER BY created_at DESC`;

    const result = await database.query(query, values);
    return result.rows.map(row => new Reference(row));
  }

  async create(referenceData) {
    const reference = new Reference(referenceData);
    reference.validate();

    const query = `
      INSERT INTO "references" (
        project_id, title, authors, year, journal, doi, abstract,
        keywords, url, screening_status, source
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `;

    // Convertir array de autores a string separado por comas
    const authorsStr = Array.isArray(reference.authors) 
      ? reference.authors.join(', ') 
      : reference.authors;

    const values = [
      reference.projectId, reference.title, authorsStr,
      reference.year, reference.journal, reference.doi, reference.abstract,
      reference.keywords, reference.url, reference.screeningStatus, reference.source
    ];

    const result = await database.query(query, values);
    return new Reference(result.rows[0]);
  }

  async update(id, referenceData) {
    const updates = [];
    const values = [];
    let paramCount = 1;

    const allowedFields = [
      'title', 'authors', 'year', 'journal', 'doi', 'abstract', 'keywords', 'url',
      'screeningStatus', 'aiClassification', 'aiConfidenceScore', 'aiReasoning',
      'manualReviewStatus', 'manualReviewNotes', 'reviewedBy', 'reviewedAt',
      'fullTextAvailable', 'fullTextUrl', 'screeningScore', 'aiDecision', 'exclusionReason',
      'fullTextData', 'fullTextExtracted', 'isDuplicate'
    ];

    const fieldMap = {
      screeningStatus: 'screening_status',
      aiClassification: 'classification_method',
      aiConfidenceScore: 'priority_score',
      aiReasoning: 'ai_reasoning',
      manualReviewStatus: 'manual_review_status',
      manualReviewNotes: 'manual_review_notes',
      reviewedBy: 'reviewed_by',
      reviewedAt: 'reviewed_at',
      fullTextAvailable: 'full_text_status',
      fullTextUrl: 'full_text_path',
      screeningScore: 'similarity_score',
      aiDecision: 'status',
      exclusionReason: 'exclusion_reason',
      fullTextData: 'full_text_data',
      fullTextExtracted: 'full_text_extracted',
      isDuplicate: 'is_duplicate'
    };

    for (const field of allowedFields) {
      if (referenceData[field] !== undefined) {
        const dbField = fieldMap[field] || field;
        updates.push(`${dbField} = $${paramCount++}`);
        
        // Convertir objetos a JSON string para JSONB
        if (field === 'fullTextData' && typeof referenceData[field] === 'object') {
          values.push(JSON.stringify(referenceData[field]));
        }
        else if (field === 'fullTextAvailable') {
          // El booleano del frontend se guarda como string en BD
          // o se pasa a boolean si en el futuro lo regresan a boolean... Pero asumo string 'available'/'unavailable'
          values.push(referenceData[field] ? 'available' : 'unavailable');
        } else {
          values.push(referenceData[field]);
        }
      }
    }

    if (referenceData.reviewedBy) {
      updates.push(`reviewed_at = NOW()`);
    }

    if (updates.length === 0) {
      return this.findById(id);
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    const query = `
      UPDATE "references"
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await database.query(query, values);
    return result.rows[0] ? new Reference(result.rows[0]) : null;
  }

  async delete(id) {
    await database.query('DELETE FROM "references" WHERE id = $1', [id]);
    return true;
  }

  /**
   * Actualizar resultado de screening automático
   */
  async updateScreeningResult({ referenceId, aiRecommendation, aiReasoning, aiConfidence, similarityScore, screeningStatus }) {
    const query = `
      UPDATE "references"
      SET 
        classification_method = $2,
        ai_reasoning = $3,
        priority_score = $4,
        similarity_score = $5,
        screening_status = $6,
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;

    const values = [
      referenceId,
      aiRecommendation || null,
      aiReasoning || null,
      aiConfidence || null,
      similarityScore || null,
      screeningStatus || 'pending'
    ];

    const result = await database.query(query, values);
    return result.rows[0] ? new Reference(result.rows[0]) : null;
  }

  async countByProject(projectId, filters = {}) {
    let query = 'SELECT COUNT(*) as total FROM "references" WHERE project_id = $1';
    const values = [projectId];
    let paramCount = 2;

    if (filters.screeningStatus) {
      query += ` AND screening_status = $${paramCount++}`;
      values.push(filters.screeningStatus);
    }

    const result = await database.query(query, values);
    return Number.parseInt(result.rows[0].total);
  }

  async bulkCreate(references) {
    const client = await database.getPool().connect();
    try {
      await client.query('BEGIN');
      const created = [];

      for (const refData of references) {
        const reference = new Reference(refData);
        const query = `
          INSERT INTO "references" (
            project_id, title, authors, year, journal, doi, abstract,
            keywords, url, screening_status, source
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          RETURNING *
        `;

        // Convertir array de autores a string separado por comas
        const authorsStr = Array.isArray(reference.authors) 
          ? reference.authors.join(', ') 
          : reference.authors;

        const values = [
          reference.projectId, reference.title, authorsStr,
          reference.year, reference.journal, reference.doi, reference.abstract,
          reference.keywords, reference.url, reference.screeningStatus, reference.source
        ];

        const result = await client.query(query, values);
        created.push(new Reference(result.rows[0]));
      }

      await client.query('COMMIT');
      return created;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Obtener referencias con sus puntajes de screening para análisis estadístico
   */
  async findByProjectWithScores(projectId) {
    const query = `
      SELECT 
        id, title, authors, year, abstract, keywords,
        screening_status, similarity_score, classification_method,
        priority_score, created_at
      FROM "references" 
      WHERE project_id = $1
      ORDER BY similarity_score DESC NULLS LAST, created_at DESC
    `;
    
    const result = await database.query(query, [projectId]);
    return result.rows.map(row => new Reference(row));
  }

  /**
   * Buscar referencia por DOI o título (para detección de duplicados durante importación)
   */
  async findByDoiOrTitle(projectId, doi, title) {
    let query = 'SELECT * FROM "references" WHERE project_id = $1 AND (';
    const conditions = [];
    const values = [projectId];
    let paramCount = 2;

    if (doi) {
      conditions.push(`doi = $${paramCount++}`);
      values.push(doi);
    }

    if (title) {
      conditions.push(`LOWER(title) = LOWER($${paramCount++})`);
      values.push(title);
    }

    if (conditions.length === 0) {
      return null;
    }

    query += conditions.join(' OR ') + ') LIMIT 1';

    const result = await database.query(query, values);
    return result.rows[0] ? new Reference(result.rows[0]) : null;
  }

  /**
   * Obtener referencias pendientes de un proyecto
   */
  async getPendingReferences(projectId) {
    const query = `
      SELECT * FROM "references" 
      WHERE project_id = $1 
      AND screening_status = 'pending'
      ORDER BY created_at DESC
    `;
    const result = await database.query(query, [projectId]);
    return result.rows.map(row => new Reference(row));
  }

  /**
   * Obtener estadísticas de screening para un proyecto
   */
  async getScreeningStats(projectId) {
    const query = `
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE screening_status = 'included') as included,
        COUNT(*) FILTER (WHERE screening_status = 'excluded') as excluded,
        COUNT(*) FILTER (WHERE screening_status = 'pending') as pending,
        COUNT(DISTINCT source) as sources,
        AVG(CASE WHEN ai_confidence_score IS NOT NULL THEN ai_confidence_score ELSE NULL END) as avg_confidence,
        COUNT(*) FILTER (WHERE ai_classification IS NOT NULL) as ai_reviewed
      FROM "references"
      WHERE project_id = $1
    `;

    const result = await database.query(query, [projectId]);
    const stats = result.rows[0];

    return {
      total: parseInt(stats.total) || 0,
      included: parseInt(stats.included) || 0,
      excluded: parseInt(stats.excluded) || 0,
      pending: parseInt(stats.pending) || 0,
      duplicates: 0, // La columna is_duplicate no existe, por lo tanto no hay duplicados marcados
      sources: parseInt(stats.sources) || 0,
      avgConfidence: parseFloat(stats.avg_confidence) || 0,
      aiReviewed: parseInt(stats.ai_reviewed) || 0
    };
  }
}

module.exports = ReferenceRepository;
