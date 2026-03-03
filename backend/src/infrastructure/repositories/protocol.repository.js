const database = require('../../config/database');
const Protocol = require('../../domain/models/protocol.model');

/**
 * Repositorio para operaciones de Protocolo en PostgreSQL
 */
class ProtocolRepository {
  async findByProjectId(projectId) {
    const query = 'SELECT * FROM protocols WHERE project_id = $1';
    const result = await database.query(query, [projectId]);
    if (!result.rows[0]) return null;
    
    // Parsear campos JSONB
    const row = result.rows[0];
    const jsonbFields = [
      'is_matrix', 'is_not_matrix', 'research_questions', 'inclusion_criteria',
      'exclusion_criteria', 'databases', 'evaluation_initial', 'matrix_elements',
      'key_terms', 'search_queries', 'temporal_range', 'screening_results',
      'selected_for_full_text'
      // 'prisma_compliance' deprecado - usar tabla prisma_items
    ];
    
    jsonbFields.forEach(field => {
      if (row[field] && typeof row[field] === 'string') {
        row[field] = JSON.parse(row[field]);
      }
    });
    
    return new Protocol(row);
  }

  async create(protocolData) {
    const protocol = new Protocol(protocolData);
    protocol.validate();

    const query = `
      INSERT INTO protocols (
        project_id, proposed_title, is_matrix, is_not_matrix, refined_question,
        population, intervention, comparison, outcomes, 
        inclusion_criteria, exclusion_criteria, 
        databases, search_string, search_queries, key_terms, temporal_range,
        completed
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      RETURNING *
    `;

    const db = protocol.toDatabase();
    const values = [
      db.project_id, 
      db.proposed_title,
      db.is_matrix, 
      db.is_not_matrix,
      db.refined_question,
      db.population,
      db.intervention, 
      db.comparison, 
      db.outcomes,
      db.inclusion_criteria, 
      db.exclusion_criteria, 
      db.databases,
      db.search_string,
      db.search_queries,
      db.key_terms, 
      db.temporal_range,
      db.completed
    ];

    const result = await database.query(query, values);
    return this.findByProjectId(protocol.projectId);
  }

  async update(projectId, protocolData) {
    const updates = [];
    const values = [];
    let paramCount = 1;

    const fieldMap = {
      // Título propuesto por IA
      proposedTitle: 'proposed_title',
      
      // Matriz Es/No Es
      isMatrix: 'is_matrix',
      isNotMatrix: 'is_not_matrix',
      refinedQuestion: 'refined_question',
      
      // Marco PICO
      population: 'population',
      intervention: 'intervention',
      comparison: 'comparison',
      outcomes: 'outcomes',
      
      // Criterios
      inclusionCriteria: 'inclusion_criteria',
      exclusionCriteria: 'exclusion_criteria',
      
      // Estrategia de búsqueda
      databases: 'databases',
      searchQueries: 'search_queries',
      searchString: 'search_string',
      keyTerms: 'key_terms',
      temporalRange: 'temporal_range',
      researchArea: 'research_area',
      
      // Cumplimiento PRISMA - deprecado, usar tabla prisma_items
      // prismaCompliance: 'prisma_compliance',
      prismaLocked: 'prisma_locked',
      prismaCompletedAt: 'prisma_completed_at',
      
      // Resultados del screening
      screeningResults: 'screening_results',
      
      // Fase 2
      fase2Unlocked: 'fase2_unlocked',
      
      // Referencias seleccionadas para full-text
      selectedForFullText: 'selected_for_full_text',
      
      // Revisión manual finalizada
      manualReviewFinalized: 'manual_review_finalized',
      
      // Screening finalizado
      screeningFinalized: 'screening_finalized',
      
      // PRISMA desbloqueado
      prismaUnlocked: 'prisma_unlocked',
      
      researchQuestions: 'research_questions',
      
      // Estado
      completed: 'completed'
    };

    // MAPEO ESPECÍFICO PARA DATOS DEL WIZARD
    // Los datos del wizard vienen con estructura anidada que necesitamos aplanar
    let mappedData = { ...protocolData };

    // 1. Mapear datos del marco PICO si vienen en estructura anidada
    if (protocolData.pico && typeof protocolData.pico === 'object') {
      console.log('📊 Mapeando datos PICO desde estructura wizard:', protocolData.pico);
      mappedData.population = protocolData.pico.population;
      mappedData.intervention = protocolData.pico.intervention;  
      mappedData.comparison = protocolData.pico.comparison;
      mappedData.outcomes = protocolData.pico.outcome || protocolData.pico.outcomes; // Singular/plural compatibility
    }

    // 2. Mapear matriz Es/No Es si viene en estructura anidada
    if (protocolData.matrixIsNot && typeof protocolData.matrixIsNot === 'object') {
      console.log('📋 Mapeando matriz Es/No Es desde estructura wizard:', protocolData.matrixIsNot);
      mappedData.isMatrix = protocolData.matrixIsNot.is || [];
      mappedData.isNotMatrix = protocolData.matrixIsNot.isNot || [];
    }

    // 3. Mapear datos del searchPlan si vienen en estructura anidada
    if (protocolData.searchPlan && typeof protocolData.searchPlan === 'object') {
      console.log('🔍 Mapeando plan de búsqueda desde estructura wizard');
      if (protocolData.searchPlan.databases) {
        mappedData.databases = protocolData.searchPlan.databases;
      }
      if (protocolData.searchPlan.searchQueries) {
        mappedData.searchQueries = protocolData.searchPlan.searchQueries;
      }
      if (protocolData.searchPlan.temporalRange) {
        mappedData.temporalRange = protocolData.searchPlan.temporalRange;
      }
    }

    // 4. Mapear términos del protocolo si viene en estructura anidada  
    if (protocolData.protocolDefinition && typeof protocolData.protocolDefinition === 'object') {
      console.log('🏷️ Mapeando términos del protocolo desde estructura wizard:', protocolData.protocolDefinition);
      mappedData.keyTerms = protocolData.protocolDefinition;
    }

    // 5. Mapear RQs si vienen en estructura anidada o directa
    if (protocolData.researchQuestions && Array.isArray(protocolData.researchQuestions)) {
      console.log('❓ Mapeando preguntas de investigación:', protocolData.researchQuestions.length);
      mappedData.researchQuestions = protocolData.researchQuestions;
    }

    // Usar el modelo Protocol para manejar la serialización correctamente
    const Protocol = require('../../domain/models/protocol.model');
    
    // Crear instancia del modelo con los datos mapeados
    const protocolInstance = new Protocol({
      ...mappedData,
      projectId: projectId
    });
    
    // Obtener datos serializados correctamente
    const dbData = protocolInstance.toDatabase();
    
    // Mapear los campos del modelo a la base de datos
    for (const [jsKey, dbKey] of Object.entries(fieldMap)) {
      // Solo actualizar campos que están presentes en mappedData
      if (mappedData[jsKey] !== undefined) {
        const snakeKey = dbKey;
        const valueToUpdate = dbData[snakeKey];
        
        console.log(`   📦 Campo ${jsKey} → ${dbKey}:`, 
          typeof valueToUpdate === 'string' 
            ? valueToUpdate.substring(0, 100) + '...' 
            : valueToUpdate);
        
        updates.push(`${dbKey} = $${paramCount++}`);
        values.push(valueToUpdate);
      }
    }

    if (updates.length === 0) {
      return this.findByProjectId(projectId);
    }

    updates.push(`updated_at = NOW()`);
    values.push(projectId);

    // Detectar si projectId es un UUID de protocolo o de proyecto
    // Si el protocolo existe con este ID, usar id en lugar de project_id
    const checkQuery = 'SELECT id, project_id FROM protocols WHERE id = $1 OR project_id = $1';
    const checkResult = await database.query(checkQuery, [projectId]);
    
    const whereClause = checkResult.rows.length > 0 && checkResult.rows[0].id === projectId
      ? `id = $${paramCount}`
      : `project_id = $${paramCount}`;

    const query = `
      UPDATE protocols
      SET ${updates.join(', ')}
      WHERE ${whereClause}
      RETURNING *
    `;

    const result = await database.query(query, values);
    
    // Retornar por project_id para consistencia
    const finalProjectId = result.rows[0]?.project_id || projectId;
    return this.findByProjectId(finalProjectId);
  }

  async delete(projectId) {
    await database.query('DELETE FROM protocols WHERE project_id = $1', [projectId]);
    return true;
  }
}

module.exports = ProtocolRepository;
