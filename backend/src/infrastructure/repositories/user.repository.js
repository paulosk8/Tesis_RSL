const database = require('../../config/database');
const User = require('../../domain/models/user.model');

/**
 * Repositorio para operaciones de Usuario en PostgreSQL
 */
class UserRepository {
  /**
   * Buscar usuario por ID
   */
  async findById(id) {
    const query = 'SELECT * FROM users WHERE id = $1';
    const result = await database.query(query, [id]);
    return result.rows[0] ? new User(result.rows[0]) : null;
  }

  /**
   * Buscar usuario por email
   */
  async findByEmail(email) {
    const query = 'SELECT * FROM users WHERE email = $1';
    const result = await database.query(query, [email]);
    return result.rows[0] ? new User(result.rows[0]) : null;
  }

  /**
   * Buscar usuario por Google ID
   */
  async findByGoogleId(googleId) {
    const query = 'SELECT * FROM users WHERE google_id = $1';
    const result = await database.query(query, [googleId]);
    return result.rows[0] ? new User(result.rows[0]) : null;
  }

  /**
   * Crear nuevo usuario
   */
  async create(userData) {
    const user = new User(userData);
    user.validate();

    // Para OAuth, no hay password_hash
    const hasPassword = user.passwordHash !== undefined && user.passwordHash !== null;

    const query = hasPassword
      ? `
          INSERT INTO users (email, name, role, avatar_url, google_id, password_hash)
          VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING *
        `
      : `
          INSERT INTO users (email, name, role, avatar_url, google_id)
          VALUES ($1, $2, $3, $4, $5)
          RETURNING *
        `;

    const values = hasPassword
      ? [user.email, user.fullName, user.role || 'researcher', user.avatarUrl, user.googleId, user.passwordHash]
      : [user.email, user.fullName, user.role || 'researcher', user.avatarUrl, user.googleId];

    const result = await database.query(query, values);
    return new User(result.rows[0]);
  }

  /**
   * Actualizar usuario
   */
  async update(id, userData) {
    const updates = [];
    const values = [];
    let paramCount = 1;

    // Construir dinámicamente la query según los campos proporcionados
    if (userData.fullName !== undefined) {
      updates.push(`name = $${paramCount++}`);
      values.push(userData.fullName);
    }
    if (userData.avatarUrl !== undefined) {
      updates.push(`avatar_url = $${paramCount++}`);
      values.push(userData.avatarUrl);
    }
    if (userData.googleId !== undefined) {
      updates.push(`google_id = $${paramCount++}`);
      values.push(userData.googleId);
    }
    if (userData.passwordHash !== undefined) {
      updates.push(`password_hash = $${paramCount++}`);
      values.push(userData.passwordHash);
    }

    if (updates.length === 0) {
      return this.findById(id);
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    const query = `
      UPDATE users
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await database.query(query, values);
    return result.rows[0] ? new User(result.rows[0]) : null;
  }

  /**
   * Eliminar usuario
   */
  async delete(id) {
    const query = 'DELETE FROM users WHERE id = $1';
    await database.query(query, [id]);
    return true;
  }

  /**
   * Listar todos los usuarios (paginado)
   */
  async findAll(limit = 50, offset = 0) {
    const query = `
      SELECT * FROM users
      ORDER BY created_at DESC
      LIMIT $1 OFFSET $2
    `;
    const result = await database.query(query, [limit, offset]);
    return result.rows.map(row => new User(row));
  }

  /**
   * Contar total de usuarios
   */
  async count() {
    const query = 'SELECT COUNT(*) as total FROM users';
    const result = await database.query(query);
    return parseInt(result.rows[0].total);
  }
}

module.exports = UserRepository;
