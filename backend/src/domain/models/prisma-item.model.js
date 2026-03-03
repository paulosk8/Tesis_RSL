/**
 * Modelo de dominio: PrismaItem
 * Representa un ítem de la guía PRISMA 2020
 * 
 * Tipos de contenido:
 * - 'automated': Generado automáticamente desde datos del sistema
 * - 'human': Escrito manualmente por el usuario
 * - 'hybrid': Generado automáticamente pero editado por humano
 * - 'pending': Sin completar
 */
class PrismaItem {
  constructor(data) {
    this.id = data.id;
    this.projectId = data.project_id || data.projectId;
    this.itemNumber = data.item_number || data.itemNumber;
    this.section = data.section;
    
    // Estado y contenido
    this.completed = data.completed || false;
    this.content = data.content;
    
    // Tipo y fuente de contenido (CRÍTICO PARA TRANSPARENCIA METODOLÓGICA)
    this.contentType = data.content_type || data.contentType || 'pending';
    this.dataSource = data.data_source || data.dataSource; // ej: 'protocol.pico', 'screening.results'
    this.automatedContent = data.automated_content || data.automatedContent; // Preservar original
    this.lastHumanEdit = data.last_human_edit || data.lastHumanEdit;
    
    // Validación con IA
    this.aiValidated = data.ai_validated || data.aiValidated || false;
    
    let parsedNotes = { suggestions: null, issues: [] };
    if (data.validation_notes) {
      if (typeof data.validation_notes === 'string') {
        try { parsedNotes = JSON.parse(data.validation_notes); } catch (e) {}
      } else {
        parsedNotes = data.validation_notes;
      }
    }
    
    this.aiSuggestions = data.ai_suggestions || data.aiSuggestions || parsedNotes.suggestions;
    this.aiIssues = data.ai_issues || data.aiIssues || parsedNotes.issues || [];
    
    // Metadatos
    this.completedAt = data.completed_at || data.completedAt;
    this.updatedAt = data.updated_at || data.updatedAt;
  }

  /**
   * Tipos de contenido válidos
   */
  static get CONTENT_TYPES() {
    return {
      AUTOMATED: 'automated',      // Generado completamente por el sistema
      HUMAN: 'human',              // Escrito manualmente
      HYBRID: 'hybrid',            // Automatizado + editado
      PENDING: 'pending'           // Sin completar
    };
  }

  /**
   * Secciones válidas de PRISMA
   */
  static get VALID_SECTIONS() {
    return [
      'Title',
      'Abstract',
      'Introduction',
      'Methods',
      'Results',
      'Discussion',
      'Funding'
    ];
  }

  /**
   * Convierte el modelo a un objeto plano para respuestas API
   */
  toJSON() {
    return {
      id: this.id,
      projectId: this.projectId,
      itemNumber: this.itemNumber,
      section: this.section,
      completed: this.completed,
      content: this.content,
      contentType: this.contentType,
      dataSource: this.dataSource,
      automatedContent: this.automatedContent,
      lastHumanEdit: this.lastHumanEdit,
      aiValidation: {
        validated: this.aiValidated,
        suggestions: this.aiSuggestions,
        issues: this.aiIssues
      },
      completedAt: this.completedAt,
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
      item_number: this.itemNumber,
      section: this.section,
      completed: this.completed,
      content: this.content,
      content_type: this.contentType,
      data_source: this.dataSource,
      automated_content: this.automatedContent,
      last_human_edit: this.lastHumanEdit,
      ai_validated: this.aiValidated,
      validation_notes: JSON.stringify({
        suggestions: this.aiSuggestions,
        issues: this.aiIssues
      }),
      updated_at: this.updatedAt
    };
  }

  /**
   * Valida que el ítem PRISMA tenga los campos requeridos
   */
  validate() {
    if (!this.projectId) {
      throw new Error('Project ID es requerido');
    }

    if (!this.itemNumber || this.itemNumber < 1 || this.itemNumber > 27) {
      throw new Error('Item Number debe estar entre 1 y 27');
    }

    if (!this.section || !PrismaItem.VALID_SECTIONS.includes(this.section)) {
      throw new Error(`Section debe ser una de: ${PrismaItem.VALID_SECTIONS.join(', ')}`);
    }

    if (this.contentType && !Object.values(PrismaItem.CONTENT_TYPES).includes(this.contentType)) {
      throw new Error(`Content Type debe ser uno de: ${Object.values(PrismaItem.CONTENT_TYPES).join(', ')}`);
    }

    return true;
  }

  /**
   * Marca el ítem como completado
   */
  markAsCompleted() {
    this.completed = true;
    this.completedAt = new Date();
  }

  /**
   * Marca el contenido como editado por humano
   */
  markAsHumanEdited() {
    // Si era automatizado, preservar el contenido original
    if (this.contentType === PrismaItem.CONTENT_TYPES.AUTOMATED) {
      this.automatedContent = this.content;
      this.contentType = PrismaItem.CONTENT_TYPES.HYBRID;
    } else if (this.contentType === PrismaItem.CONTENT_TYPES.PENDING) {
      this.contentType = PrismaItem.CONTENT_TYPES.HUMAN;
    }
    
    this.lastHumanEdit = new Date();
  }

  /**
   * Establece contenido automatizado
   */
  setAutomatedContent(content, dataSource) {
    this.content = content;
    this.automatedContent = content;
    this.contentType = PrismaItem.CONTENT_TYPES.AUTOMATED;
    this.dataSource = dataSource;
    this.completed = true;
    this.completedAt = new Date();
  }

  /**
   * Verifica si el contenido tiene la longitud mínima requerida
   */
  hasMinimumContent() {
    if (!this.content) return false;
    return this.content.trim().length >= 50; // Al menos 50 caracteres
  }

  /**
   * Verifica si el ítem fue modificado por un humano
   */
  isHumanModified() {
    return this.contentType === PrismaItem.CONTENT_TYPES.HUMAN || 
           this.contentType === PrismaItem.CONTENT_TYPES.HYBRID;
  }

  /**
   * Verifica si el contenido es completamente automatizado
   */
  isFullyAutomated() {
    return this.contentType === PrismaItem.CONTENT_TYPES.AUTOMATED;
  }
}

module.exports = PrismaItem;
