/**
 * Modelo de dominio: Referencia
 * Representa una referencia bibliográfica para cribado
 */
class Reference {
  constructor(data) {
    this.id = data.id;
    this.projectId = data.project_id || data.projectId;
    
    // Información bibliográfica
    this.title = data.title;
    
    // Convertir authors a array si es string
    if (typeof data.authors === 'string') {
      // Si es un string separado por comas, punto y coma, o salto de línea
      this.authors = data.authors
        .split(/[,;]\s*|\n/)
        .map(a => a.trim())
        .filter(a => a.length > 0);
    } else if (Array.isArray(data.authors)) {
      this.authors = data.authors;
    } else {
      this.authors = [];
    }
    
    this.year = data.year;
    this.journal = data.journal;
    this.doi = data.doi;
    this.abstract = data.abstract;
    this.keywords = data.keywords;
    this.url = data.url;
    
    // Estado de cribado
    this.screeningStatus = data.screening_status || data.screeningStatus || 'pending';
    this.screeningScore = data.similarity_score || data.screening_score || data.screeningScore;
    this.exclusionReason = data.exclusion_reason || data.exclusionReason;
    this.isDuplicate = data.is_duplicate || data.isDuplicate || false;
    
    // IA y clasificación
    this.aiClassification = data.classification_method || data.ai_classification || data.aiClassification;
    this.aiConfidenceScore = data.priority_score || data.ai_confidence_score || data.aiConfidenceScore;
    this.aiReasoning = data.ai_reasoning || data.aiReasoning;
    
    // Revisión manual
    this.manualReviewStatus = data.manual_review_status || data.manualReviewStatus;
    this.manualReviewNotes = data.manual_review_notes || data.manualReviewNotes;
    this.reviewedBy = data.reviewed_by || data.reviewedBy;
    this.reviewedAt = data.reviewed_at || data.reviewedAt;
    
    // Metadatos
    this.source = data.source;
    this.bibtexEntry = data.bibtex_entry || data.bibtexEntry;
    this.citationKey = data.citation_key || data.citationKey;
    this.fullTextAvailable = data.full_text_status === 'available' || data.fullTextAvailable || false;
    this.fullTextUrl = data.full_text_path || data.fullTextUrl;
    
    // Datos extraídos de PDF (NUEVO)
    this.fullTextData = data.full_text_data || data.fullTextData;
    this.fullTextExtracted = data.full_text_extracted || data.fullTextExtracted || false;
    this.fullTextExtractedAt = data.full_text_extracted_at || data.fullTextExtractedAt;
    
    this.importedAt = data.imported_at || data.importedAt;
    this.createdAt = data.created_at || data.createdAt;
    this.updatedAt = data.updated_at || data.updatedAt;
  }

  /**
   * Estados válidos de cribado
   */
  static get VALID_SCREENING_STATUSES() {
    return ['pending', 'included', 'excluded', 'duplicate', 'maybe'];
  }

  /**
   * Convierte el modelo a un objeto plano para respuestas API
   */
  toJSON() {
    return {
      id: this.id,
      projectId: this.projectId,
      title: this.title,
      authors: this.authors,
      year: this.year,
      journal: this.journal,
      doi: this.doi,
      abstract: this.abstract,
      keywords: this.keywords,
      url: this.url,
      status: this.screeningStatus,
      screeningScore: this.screeningScore,
      exclusionReason: this.exclusionReason,
      isDuplicate: this.isDuplicate,
      aiClassification: this.aiClassification,
      aiConfidenceScore: this.aiConfidenceScore,
      aiReasoning: this.aiReasoning,
      manualReviewStatus: this.manualReviewStatus,
      manualReviewNotes: this.manualReviewNotes,
      reviewedBy: this.reviewedBy,
      reviewedAt: this.reviewedAt,
      source: this.source,
      bibtexEntry: this.bibtexEntry,
      citationKey: this.citationKey,
      fullTextAvailable: this.fullTextAvailable,
      fullTextUrl: this.fullTextUrl,
      fullTextData: this.fullTextData,
      fullTextExtracted: this.fullTextExtracted,
      fullTextExtractedAt: this.fullTextExtractedAt,
      importedAt: this.importedAt,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  /**
   * Convierte a formato snake_case para PostgreSQL
   */
  toDatabase() {
    return {
      id: this.id,
      project_id: this.projectId,
      title: this.title,
      authors: Array.isArray(this.authors) ? this.authors.join(', ') : this.authors,
      year: this.year,
      journal: this.journal,
      doi: this.doi,
      abstract: this.abstract,
      keywords: this.keywords,
      url: this.url,
      screening_status: this.screeningStatus,
      similarity_score: this.screeningScore,
      exclusion_reason: this.exclusionReason,
      is_duplicate: this.isDuplicate,
      classification_method: this.aiClassification,
      priority_score: this.aiConfidenceScore,
      ai_reasoning: this.aiReasoning,
      manual_review_status: this.manualReviewStatus,
      manual_review_notes: this.manualReviewNotes,
      reviewed_by: this.reviewedBy,
      reviewed_at: this.reviewedAt,
      source: this.source,
      bibtex_entry: this.bibtexEntry,
      citation_key: this.citationKey,
      full_text_status: this.fullTextAvailable ? 'available' : 'unavailable',
      full_text_path: this.fullTextUrl,
      full_text_data: typeof this.fullTextData === 'object' ? JSON.stringify(this.fullTextData) : this.fullTextData,
      full_text_extracted: this.fullTextExtracted,
      full_text_extracted_at: this.fullTextExtractedAt,
      imported_at: this.importedAt,
      created_at: this.createdAt,
      updated_at: this.updatedAt
    };
  }

  /**
   * Valida que la referencia tenga los campos requeridos
   */
  validate() {
    if (!this.title || this.title.trim().length === 0) {
      throw new Error('Título es requerido');
    }

    if (!this.projectId) {
      throw new Error('Project ID es requerido');
    }

    if (!Reference.VALID_SCREENING_STATUSES.includes(this.screeningStatus)) {
      throw new Error(`Estado de cribado debe ser uno de: ${Reference.VALID_SCREENING_STATUSES.join(', ')}`);
    }

    return true;
  }

  /**
   * Verifica si la referencia necesita revisión manual
   */
  needsManualReview() {
    // Si no hay clasificación de IA o la confianza es baja
    if (!this.aiClassification) return true;
    if (this.aiConfidenceScore && this.aiConfidenceScore < 0.7) return true;
    return false;
  }
}

module.exports = Reference;
