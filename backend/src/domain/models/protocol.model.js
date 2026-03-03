/**
 * Modelo de dominio: Protocolo
 * Representa el protocolo de revisión sistemática de un proyecto
 */
class Protocol {
  constructor(data) {
    this.id = data.id;
    this.projectId = data.project_id || data.projectId;
    
    // Título propuesto por IA
    this.proposedTitle = data.proposed_title || data.proposedTitle;
    
    // Matriz Es/No Es
    this.isMatrix = data.is_matrix || data.isMatrix || [];
    this.isNotMatrix = data.is_not_matrix || data.isNotMatrix || [];
    this.refinedQuestion = data.refined_question || data.refinedQuestion;
    
    // Framework PICO
    this.population = data.population;
    this.intervention = data.intervention;
    this.comparison = data.comparison;
    this.outcomes = data.outcomes;
    
    // Preguntas de Investigación (RQs)
    this.researchQuestions = data.research_questions || data.researchQuestions || [];
    
    // Criterios
    this.inclusionCriteria = data.inclusion_criteria || data.inclusionCriteria || [];
    this.exclusionCriteria = data.exclusion_criteria || data.exclusionCriteria || [];
    
    // Estrategia de búsqueda
    this.databases = data.databases || [];
    this.searchString = data.search_string || data.searchString;
    this.searchQueries = data.search_queries || data.searchQueries || [];
    this.temporalRange = data.temporal_range || data.temporalRange || {};
    this.keyTerms = data.key_terms || data.keyTerms || {};
    
    // Área de investigación (para restaurar borradores)
    this.researchArea = data.research_area || data.researchArea || '';
    
    // NOTA: prismaCompliance se gestiona en tabla prisma_items
    // this.prismaCompliance campo deprecado - usar prisma_items
    this.prismaLocked = data.prisma_locked || data.prismaLocked || false;
    this.prismaCompletedAt = data.prisma_completed_at || data.prismaCompletedAt;
    
    // Resultados de cribado (embeddings + ChatGPT)
    this.screeningResults = data.screening_results || data.screeningResults || null;
    
    // Fase 2 desbloqueada (Revisión Manual)
    this.fase2Unlocked = data.fase2Unlocked !== undefined ? data.fase2Unlocked : (data.fase2_unlocked || false);
    
    // Referencias seleccionadas para full-text
    this.selectedForFullText = data.selected_for_full_text || data.selectedForFullText || [];
    
    // Screening finalizado
    this.screeningFinalized = data.screening_finalized || data.screeningFinalized || false;
    
    // Revisión manual finalizada explícitamente por el usuario
    this.manualReviewFinalized = data.manual_review_finalized || data.manualReviewFinalized || false;
    
    // PRISMA desbloqueado
    this.prismaUnlocked = data.prisma_unlocked || data.prismaUnlocked || false;
    
    // Metadatos
    this.completed = data.completed || false;
    this.createdAt = data.created_at || data.createdAt;
    this.updatedAt = data.updated_at || data.updatedAt;
  }

  /**
   * Convierte el modelo a un objeto plano para respuestas API
   */
  toJSON() {
    return {
      id: this.id,
      projectId: this.projectId,
      proposedTitle: this.proposedTitle,
      isMatrix: this.isMatrix,
      isNotMatrix: this.isNotMatrix,
      refinedQuestion: this.refinedQuestion,
      picoFramework: {
        population: this.population,
        intervention: this.intervention,
        comparison: this.comparison,
        outcomes: this.outcomes
      },
      researchQuestions: this.researchQuestions,
      inclusionCriteria: this.inclusionCriteria,
      exclusionCriteria: this.exclusionCriteria,
      searchStrategy: {
        databases: this.databases,
        searchString: this.searchString,
        searchQueries: this.searchQueries,
        temporalRange: this.temporalRange
      },
      keyTerms: this.keyTerms,
      researchArea: this.researchArea,
      // prismaCompliance ahora se lee de tabla prisma_items
      prismaLocked: this.prismaLocked,
      prismaCompletedAt: this.prismaCompletedAt,
      screeningResults: this.screeningResults,
      fase2Unlocked: this.fase2Unlocked,
      selectedForFullText: this.selectedForFullText,
      screeningFinalized: this.screeningFinalized,
      manualReviewFinalized: this.manualReviewFinalized,
      prismaUnlocked: this.prismaUnlocked,
      completed: this.completed,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  /**
   * Convierte a formato snake_case para PostgreSQL
   * Maneja correctamente la serialización de arrays/objetos a JSONB
   */
  toDatabase() {
    // Helper para serializar solo si no es ya un string
    const safeStringify = (value) => {
      if (value === null || value === undefined) return null;
      if (typeof value === 'string') return value; // Ya es string, no re-serializar
      return JSON.stringify(value);
    };

    return {
      id: this.id,
      project_id: this.projectId,
      proposed_title: this.proposedTitle,
      is_matrix: safeStringify(this.isMatrix),
      is_not_matrix: safeStringify(this.isNotMatrix),
      refined_question: this.refinedQuestion,
      population: this.population,
      intervention: this.intervention,
      comparison: this.comparison,
      outcomes: this.outcomes,
      research_questions: safeStringify(this.researchQuestions),
      inclusion_criteria: safeStringify(this.inclusionCriteria),
      exclusion_criteria: safeStringify(this.exclusionCriteria),
      databases: safeStringify(this.databases),
      search_string: this.searchString,
      search_queries: safeStringify(this.searchQueries),
      temporal_range: safeStringify(this.temporalRange),
      key_terms: safeStringify(this.keyTerms),
      research_area: this.researchArea,
      // prisma_compliance deprecado - usar tabla prisma_items
      prisma_locked: this.prismaLocked,
      prisma_completed_at: this.prismaCompletedAt,
      screening_results: safeStringify(this.screeningResults),
      fase2_unlocked: this.fase2Unlocked,
      selected_for_full_text: safeStringify(this.selectedForFullText),
      screening_finalized: this.screeningFinalized,
      manual_review_finalized: this.manualReviewFinalized,
      prisma_unlocked: this.prismaUnlocked,
      completed: this.completed,
      created_at: this.createdAt,
      updated_at: this.updatedAt
    };
  }

  /**
   * Valida que el protocolo tenga los campos requeridos
   */
  validate() {
    if (!this.projectId) {
      throw new Error('Project ID es requerido');
    }

    return true;
  }

  /**
   * Calcula el porcentaje de completitud del protocolo
   */
  getCompletionPercentage() {
    const sections = [
      this.isMatrix.length > 0,
      this.isNotMatrix.length > 0,
      this.population && this.population.trim().length > 0,
      this.intervention && this.intervention.trim().length > 0,
      this.outcomes && this.outcomes.trim().length > 0,
      this.inclusionCriteria.length > 0,
      this.exclusionCriteria.length > 0,
      this.databases.length > 0,
      this.searchString && this.searchString.trim().length > 0,
      this.temporalRange && this.temporalRange.start && this.temporalRange.end
    ];

    const completedSections = sections.filter(Boolean).length;
    return Math.round((completedSections / sections.length) * 100);
  }
}

module.exports = Protocol;
