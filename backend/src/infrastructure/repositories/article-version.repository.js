const ArticleVersion = require('../../domain/models/article-version.model');

/**
 * Repositorio para gestionar versiones de artículos
 */
class ArticleVersionRepository {
  constructor(database) {
    this.db = database;
  }

  /**
   * Guardar nueva versión del artículo
   */
  async create(articleVersion) {
    const query = `
      INSERT INTO article_versions (
        id, project_id, version_number, title,
        abstract, introduction, methods, results,
        discussion, conclusions, references_section,
        word_count, change_description, created_by, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *
    `;

    const values = [
      articleVersion.id,
      articleVersion.projectId,
      articleVersion.versionNumber,
      articleVersion.title,
      articleVersion.sections?.abstract || articleVersion.abstract || '',
      articleVersion.sections?.introduction || articleVersion.introduction || '',
      articleVersion.sections?.methods || articleVersion.methods || '',
      articleVersion.sections?.results || articleVersion.results || '',
      articleVersion.sections?.discussion || articleVersion.discussion || '',
      articleVersion.sections?.conclusions || articleVersion.conclusions || '',
      articleVersion.sections?.references || articleVersion.referencesSection || '',
      articleVersion.wordCount,
      articleVersion.changeDescription || articleVersion.description,
      articleVersion.createdBy,
      articleVersion.createdAt
    ];

    const result = await this.db.query(query, values);
    return ArticleVersion.fromDatabase(result.rows[0]);
  }

  /**
   * Obtener todas las versiones de un proyecto
   */
  async findByProject(projectId) {
    const query = `
      SELECT 
        av.*,
        u.name as creator_name
      FROM article_versions av
      LEFT JOIN users u ON u.id = av.created_by
      WHERE av.project_id = $1
      ORDER BY av.version_number DESC
    `;

    const result = await this.db.query(query, [projectId]);
    return result.rows.map(row => {
      const version = ArticleVersion.fromDatabase(row);
      // Sobrescribir createdBy con el nombre completo si está disponible
      if (row.creator_name) {
        version.createdBy = row.creator_name;
      }
      return version;
    });
  }

  /**
   * Obtener última versión
   */
  async findLatestByProject(projectId) {
    const query = `
      SELECT 
        av.*,
        u.name as creator_name
      FROM article_versions av
      LEFT JOIN users u ON u.id = av.created_by
      WHERE av.project_id = $1
      ORDER BY av.version_number DESC
      LIMIT 1
    `;

    const result = await this.db.query(query, [projectId]);
    if (result.rows.length === 0) return null;

    const version = ArticleVersion.fromDatabase(result.rows[0]);
    // Sobrescribir createdBy con el nombre completo si está disponible
    if (result.rows[0].creator_name) {
      version.createdBy = result.rows[0].creator_name;
    }
    return version;
  }

  /**
   * Obtener versión específica
   */
  async findById(id) {
    const query = `
      SELECT 
        av.*,
        u.name as creator_name
      FROM article_versions av
      LEFT JOIN users u ON u.id = av.created_by
      WHERE av.id = $1
    `;

    const result = await this.db.query(query, [id]);
    if (result.rows.length === 0) return null;

    const version = ArticleVersion.fromDatabase(result.rows[0]);
    // Sobrescribir createdBy con el nombre completo si está disponible
    if (result.rows[0].creator_name) {
      version.createdBy = result.rows[0].creator_name;
    }
    return version;
  }

  /**
   * Actualizar versión
   */
  async update(id, updates) {
    const fields = [];
    const values = [];
    let paramCount = 1;

    if (updates.title !== undefined) {
      fields.push(`title = $${paramCount++}`);
      values.push(updates.title);
    }
    if (updates.sections) {
      if (updates.sections.abstract !== undefined) {
        fields.push(`abstract = $${paramCount++}`);
        values.push(updates.sections.abstract);
      }
      if (updates.sections.introduction !== undefined) {
        fields.push(`introduction = $${paramCount++}`);
        values.push(updates.sections.introduction);
      }
      if (updates.sections.methods !== undefined) {
        fields.push(`methods = $${paramCount++}`);
        values.push(updates.sections.methods);
      }
      if (updates.sections.results !== undefined) {
        fields.push(`results = $${paramCount++}`);
        values.push(updates.sections.results);
      }
      if (updates.sections.discussion !== undefined) {
        fields.push(`discussion = $${paramCount++}`);
        values.push(updates.sections.discussion);
      }
      if (updates.sections.conclusions !== undefined) {
        fields.push(`conclusions = $${paramCount++}`);
        values.push(updates.sections.conclusions);
      }
      if (updates.sections.references !== undefined) {
        fields.push(`references_section = $${paramCount++}`);
        values.push(updates.sections.references);
      }
    }
    if (updates.wordCount !== undefined) {
      fields.push(`word_count = $${paramCount++}`);
      values.push(updates.wordCount);
    }

    if (fields.length === 0) {
      return await this.findById(id);
    }

    values.push(id);
    const query = `
      UPDATE article_versions
      SET ${fields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await this.db.query(query, values);
    return result.rows.length > 0 ? ArticleVersion.fromDatabase(result.rows[0]) : null;
  }

  /**
   * Eliminar versión
   */
  async delete(id) {
    const query = `DELETE FROM article_versions WHERE id = $1`;
    await this.db.query(query, [id]);
  }

  /**
   * Obtener número de próxima versión
   */
  async getNextVersionNumber(projectId) {
    const query = `
      SELECT COALESCE(MAX(version_number), 0) + 1 as next_version
      FROM article_versions
      WHERE project_id = $1
    `;

    const result = await this.db.query(query, [projectId]);
    return result.rows[0].next_version;
  }
}

module.exports = ArticleVersionRepository;
