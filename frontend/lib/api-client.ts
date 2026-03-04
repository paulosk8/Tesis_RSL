const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

class ApiClient {
  private baseUrl: string
  private token: string | null = null

  constructor() {
    this.baseUrl = API_URL

    // Cargar token del localStorage o cookies si existe
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('token')

      // Si no está en localStorage, intentar obtenerlo de las cookies
      if (!this.token) {
        const cookies = document.cookie.split(';')
        const authCookie = cookies.find(c => c.trim().startsWith('authToken='))
        if (authCookie) {
          this.token = authCookie.split('=')[1]
          localStorage.setItem('token', this.token)
        }
      }
    }
  }

  setToken(token: string) {
    this.token = token
    if (typeof window !== 'undefined') {
      localStorage.setItem('token', token)

      // También guardar en cookies para el middleware
      document.cookie = `authToken=${token}; path=/; max-age=${7 * 24 * 60 * 60}; SameSite=Lax`
    }
  }

  clearToken() {
    this.token = null
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token')
      localStorage.removeItem('user')

      // Limpiar cookie de forma agresiva (múltiples paths y dominios)
      document.cookie = 'authToken=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT'
      document.cookie = 'authToken=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax'
      // También limpiar para el dominio actual sin path específico
      document.cookie = 'authToken=; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT'

      // Limpiar sessionStorage también
      try { sessionStorage.clear() } catch { /* ignore */ }
    }
  }

  getToken(): string | null {
    return this.token
  }

  async request(endpoint: string, options: RequestInit = {}) {
    const headers: Record<string, string> = {
      ...options.headers as Record<string, string>,
    }

    // Solo agregar Content-Type si no es FormData
    if (!(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json'
    }

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`
    }

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers,
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Error en la petición')
      }

      return data
    } catch (err: any) {
      console.error(`🚨 FATAL FETCH ERROR on ${endpoint}:`, err.message, err);
      throw err;
    }
  }

  // Auth
  async register(email: string, fullName: string, password: string) {
    const data = await this.request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, fullName, password }),
    })

    if (data.data.token) {
      this.setToken(data.data.token)
    }

    return data.data
  }

  async login(email: string, password: string) {
    const data = await this.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })

    if (data.data.token) {
      this.setToken(data.data.token)
    }

    // Mapear 'name' a 'fullName' si es necesario
    if (data.data.user) {
      data.data.user.fullName = data.data.user.fullName || data.data.user.name || data.data.user.email?.split('@')[0] || 'Usuario'
    }

    return data.data
  }

  async getMe() {
    const data = await this.request('/api/auth/me')
    const user = data.data.user

    // Mapear 'name' a 'fullName' si es necesario
    const mappedUser = {
      ...user,
      fullName: user.fullName || user.name || user.email?.split('@')[0] || 'Usuario'
    }

    return mappedUser
  }

  getGoogleAuthUrl() {
    return `${this.baseUrl}/api/auth/google`
  }

  // Projects
  async getProjects(limit = 50, offset = 0) {
    const data = await this.request(
      `/api/projects?limit=${limit}&offset=${offset}`
    )
    return data.data
  }

  async getProject(id: string) {
    const data = await this.request(`/api/projects/${id}`)
    return data.data.project
  }

  async createProject(projectData: { title: string; description?: string; deadline?: string }) {
    const data = await this.request('/api/projects', {
      method: 'POST',
      body: JSON.stringify(projectData),
    })
    return data // Retorna el objeto completo con success, message y data
  }

  async updateProject(id: string, updates: any) {
    const data = await this.request(`/api/projects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    })
    return data.data.project
  }

  async deleteProject(id: string) {
    await this.request(`/api/projects/${id}`, {
      method: 'DELETE',
    })
  }

  // AI Methods
  async generateProtocolAnalysis(
    title: string,
    description: string,
    aiProvider: 'chatgpt' | 'gemini' = 'chatgpt',
    area?: string,
    yearStart?: number,
    yearEnd?: number
  ) {
    const data = await this.request('/api/ai/protocol-analysis', {
      method: 'POST',
      body: JSON.stringify({ title, description, area, yearStart, yearEnd, aiProvider }),
    })
    return data.data
  }

  async generateTitles(matrixData: any, picoData: any, aiProvider: 'chatgpt' | 'gemini' = 'gemini') {
    const data = await this.request('/api/ai/generate-titles', {
      method: 'POST',
      body: JSON.stringify({ matrixData, picoData, aiProvider }),
    })
    return data.data
  }

  async translateText(text: string, from: string, to: string): Promise<string> {
    const data = await this.request('/api/ai/translate', {
      method: 'POST',
      body: JSON.stringify({ text, from, to }),
    })
    return data.data.translatedText
  }

  async generateProtocolJustification(
    title: string,
    description: string,
    area: string,
    yearStart: number,
    yearEnd: number,
    pico: any,
    matrixData: any,
    aiProvider: 'chatgpt' | 'gemini' = 'chatgpt'
  ) {
    const data = await this.request('/api/ai/protocol-justification', {
      method: 'POST',
      body: JSON.stringify({ title, description, area, yearStart, yearEnd, pico, matrixData, aiProvider }),
    })
    return data.data
  }

  async generateSearchStrategies(
    protocolTerms: any,
    picoData: any,
    databases: string[],
    researchArea?: string,
    aiProvider: 'chatgpt' | 'gemini' = 'gemini'
  ) {
    const data = await this.request('/api/ai/generate-search-strategies', {
      method: 'POST',
      body: JSON.stringify({ protocolTerms, picoData, databases, researchArea, aiProvider }),
    })
    return data.data
  }

  async generateProtocolTerms(
    projectTitle: string,  // Puede ser selectedTitle o projectName (frontend decide)
    projectDescription: string,
    picoData: any,
    matrixData: any,
    aiProvider: 'chatgpt' | 'gemini' = 'gemini',
    specificSection?: 'tecnologia' | 'dominio' | 'focosTematicos',
    customFocus?: string
  ) {
    const data = await this.request('/api/ai/generate-protocol-terms', {
      method: 'POST',
      body: JSON.stringify({
        selectedTitle: projectTitle,  // ← REGLA: Frontend envía título seleccionado en este parámetro
        projectTitle,  // Mantener compatibilidad con código existente
        projectDescription,
        picoData,
        matrixData,
        aiProvider,
        specificSection,
        customFocus
      }),
    })
    return data.data
  }

  async generateInclusionExclusionCriteria(
    protocolTerms: {
      tecnologia?: string[]
      dominio?: string[]
      tipoEstudio?: string[]
      focosTematicos?: string[]
    },
    picoData: any,
    aiProvider: 'chatgpt' | 'gemini' = 'gemini',
    specificType?: 'inclusion' | 'exclusion',
    customFocus?: string,
    categoryIndex?: number,
    categoryName?: string,
    yearStart?: number,
    yearEnd?: number,
    selectedTitle?: string,
    rejectedTerms?: string[] // ← NUEVO: Términos rechazados por el investigador
  ) {
    const data = await this.request('/api/ai/generate-inclusion-exclusion-criteria', {
      method: 'POST',
      body: JSON.stringify({
        protocolTerms,
        picoData,
        aiProvider,
        specificType,
        customFocus,
        categoryIndex,
        categoryName,
        yearStart,
        yearEnd,
        selectedTitle,  // ← REGLA: Título RSL seleccionado para derivar criterios
        rejectedTerms // ← NUEVO: Términos rechazados por el investigador
      }),
    })
    return data.data
  }

  // Search Strategies - New Query Generator
  async generateSearchQueries(
    protocolTerms: {
      tecnologia?: string[]
      dominio?: string[]
      tipoEstudio?: string[]
      focosTematicos?: string[]
    },
    picoData: any,
    selectedDatabases: string[],
    researchArea?: string,
    matrixData?: any,
    yearStart?: number,
    yearEnd?: number,
    selectedTitle?: string
  ) {
    const data = await this.request('/api/ai/generate-search-strategies', {
      method: 'POST',
      body: JSON.stringify({
        databases: selectedDatabases,
        picoData,
        matrixData,
        researchArea,
        protocolTerms,
        yearStart,
        yearEnd,
        selectedTitle
      }),
    })
    return data.data
  }

  async getSupportedDatabases() {
    const data = await this.request('/api/ai/supported-databases')
    return data
  }

  async scopusCount(query: string) {
    const data = await this.request('/api/ai/scopus-count', {
      method: 'POST',
      body: JSON.stringify({ query }),
    })
    return data
  }

  async googleScholarCount(query: string, startYear?: number, endYear?: number) {
    const data = await this.request('/api/ai/google-scholar-count', {
      method: 'POST',
      body: JSON.stringify({ query, startYear, endYear }),
    })
    return data
  }

  async scopusSearch(query: string, start = 0, count = 25, sortBy = 'relevance') {
    const data = await this.request('/api/ai/scopus-search', {
      method: 'POST',
      body: JSON.stringify({ query, start, count, sortBy }),
    })
    return data
  }

  async scopusValidate() {
    const data = await this.request('/api/ai/scopus-validate')
    return data
  }

  async scopusFetch(query: string, projectId: string, count = 25) {
    const data = await this.request('/api/ai/scopus-fetch', {
      method: 'POST',
      body: JSON.stringify({ query, projectId, count }),
    })
    return data
  }

  // Protocol
  async getProtocol(projectId: string) {
    const data = await this.request(`/api/projects/${projectId}/protocol`)
    return data.data.protocol // Retorna solo el objeto protocol
  }

  async updateProtocol(projectId: string, protocolData: any) {
    const data = await this.request(`/api/projects/${projectId}/protocol`, {
      method: 'PUT',
      body: JSON.stringify(protocolData),
    })
    return data.data.protocol
  }

  async generateResearchQuestions(projectId: string, picoData?: any) {
    try {
      console.log(`[API CLIENT] Enviando request a ${this.baseUrl}/api/projects/${projectId}/protocol/generate-rqs`);
      const data = await this.request(`/api/projects/${projectId}/protocol/generate-rqs`, {
        method: 'POST',
        body: picoData ? JSON.stringify({ picoData }) : undefined,
      })
      console.log(`[API CLIENT] Respuesta Exitosa RQs:`, data);
      return data.data
    } catch (error: any) {
      console.error(`[API CLIENT] Falló el Fetch de RQs:`, error);
      throw error;
    }
  }

  // PRISMA Items
  async getPrismaItems(projectId: string) {
    const data = await this.request(`/api/projects/${projectId}/prisma`)
    return data.data
  }

  async getPrismaItem(projectId: string, itemNumber: number) {
    const data = await this.request(`/api/projects/${projectId}/prisma/${itemNumber}`)
    return data.data.item
  }

  async updatePrismaItem(projectId: string, itemNumber: number, updates: { content?: string; completed?: boolean }) {
    const data = await this.request(`/api/projects/${projectId}/prisma/${itemNumber}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    })
    return data.data.item
  }

  async updatePrismaItemContent(projectId: string, itemNumber: number, content: string) {
    const data = await this.request(`/api/projects/${projectId}/prisma/${itemNumber}/content`, {
      method: 'PUT',
      body: JSON.stringify({ content }),
    })
    return data.data.item
  }

  async validatePrismaItemWithAI(projectId: string, itemNumber: number) {
    const data = await this.request(`/api/projects/${projectId}/prisma/${itemNumber}/validate`, {
      method: 'POST',
    })
    return data.data
  }

  async getPrismaStats(projectId: string) {
    const data = await this.request(`/api/projects/${projectId}/prisma/stats`)
    return data.data
  }

  // Referencias
  async getReferences(projectId: string, filters: any = {}) {
    const params = new URLSearchParams()
    if (filters.status) params.append('status', filters.status)
    if (filters.year) params.append('year', filters.year)
    if (filters.source) params.append('source', filters.source)
    if (filters.limit !== undefined) params.append('limit', filters.limit.toString())

    const query = params.toString()
    const data = await this.request(`/api/references/${projectId}${query ? '?' + query : ''}`)
    return data.data
  }

  async getAllReferences(projectId: string) {
    // Obtener TODAS las referencias sin límite de paginación
    return this.getReferences(projectId, { limit: 10000 })
  }

  async createReference(projectId: string, referenceData: any) {
    const data = await this.request(`/api/references/${projectId}`, {
      method: 'POST',
      body: JSON.stringify(referenceData),
    })
    return data.data
  }

  async createReferencesBatch(projectId: string, references: any[]) {
    const data = await this.request(`/api/references/${projectId}/batch`, {
      method: 'POST',
      body: JSON.stringify({ references }),
    })
    return data.data
  }

  async updateReferenceScreening(referenceId: string, status: string, aiData?: any) {
    const data = await this.request(`/api/references/${referenceId}/screening`, {
      method: 'PUT',
      body: JSON.stringify({ status, aiData }),
    })
    return data.data
  }

  // Alias para updateReferenceScreening (más simple)
  async updateReferenceStatus(referenceId: string, statusData: { status: string; exclusionReason?: string; notes?: string }) {
    return this.updateReferenceScreening(referenceId, statusData.status, {
      exclusionReason: statusData.exclusionReason,
      notes: statusData.notes
    })
  }

  async updateReferencesBatch(updates: any[]) {
    const data = await this.request('/api/references/batch-update', {
      method: 'PUT',
      body: JSON.stringify({ updates }),
    })
    return data.data
  }

  async getScreeningStats(projectId: string) {
    const data = await this.request(`/api/references/${projectId}/stats`)
    return data.data
  }

  async detectDuplicates(projectId: string) {
    const data = await this.request(`/api/references/${projectId}/detect-duplicates`, {
      method: 'POST',
    })
    return data.data
  }

  async findDuplicates(referenceId: string, projectId: string) {
    const data = await this.request(`/api/references/${referenceId}/duplicates?projectId=${projectId}`)
    return data.data
  }

  async deleteReference(referenceId: string) {
    await this.request(`/api/references/${referenceId}`, {
      method: 'DELETE',
    })
  }

  async resolveDuplicateGroup(projectId: string, groupId: string, keepReferenceId: string) {
    const data = await this.request(`/api/references/${projectId}/resolve-duplicate`, {
      method: 'POST',
      body: JSON.stringify({
        groupId,
        keepReferenceId
      })
    })
    return data
  }

  async getYearDistribution(projectId: string) {
    const data = await this.request(`/api/references/${projectId}/year-distribution`)
    return data.data
  }

  async getSourceDistribution(projectId: string) {
    const data = await this.request(`/api/references/${projectId}/source-distribution`)
    return data.data
  }

  async importReferences(projectId: string, formData: FormData) {
    const response = await fetch(`${this.baseUrl}/api/references/${projectId}/import`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
      },
      body: formData, // FormData se envía directamente sin Content-Type
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Error al importar referencias')
    }

    return response.json()
  }

  async exportReferences(projectId: string, format: string = 'bibtex') {
    const response = await fetch(`${this.baseUrl}/api/references/${projectId}/export?format=${format}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.token}`,
      },
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Error al exportar referencias')
    }

    return response.blob()
  }

  // IA - Screening automático
  async runScreeningEmbeddings(projectId: string, options: { threshold?: number } = {}) {
    // Timeout extendido para procesos largos (10 minutos)
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 600000) // 10 minutos

    try {
      const response = await fetch(`${this.baseUrl}/api/ai/run-project-screening-embeddings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`,
        },
        body: JSON.stringify({
          projectId,
          threshold: options.threshold || 0.15,
          aiProvider: 'chatgpt'
        }),
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Error en el screening')
      }

      return data
    } catch (error: any) {
      clearTimeout(timeoutId)
      if (error.name === 'AbortError') {
        throw new Error('El proceso tardó demasiado tiempo. Intenta con menos referencias.')
      }
      throw error
    }
  }

  async runScreeningLLM(projectId: string, options: { llmProvider?: 'gemini' | 'chatgpt' } = {}) {
    const data = await this.request('/api/ai/run-project-screening-llm', {
      method: 'POST',
      body: JSON.stringify({
        projectId,
        llmProvider: options.llmProvider || 'gemini'
      }),
    })
    return data
  }

  async searchAcademicReferences(searchData: {
    query: string
    database?: 'scopus' | 'ieee'
    maxResultsPerSource?: number
  }) {
    const data = await this.request('/api/references/search-academic', {
      method: 'POST',
      body: JSON.stringify(searchData),
    })
    return data.data
  }

  // PDF Upload
  async uploadPdf(referenceId: string, file: File) {
    const formData = new FormData()
    formData.append('pdf', file)

    const data = await this.request(`/api/references/${referenceId}/upload-pdf`, {
      method: 'POST',
      body: formData,
      // No establecer Content-Type, el browser lo hace automáticamente con el boundary correcto
      headers: {
        // Remover Content-Type para que FormData funcione correctamente
      }
    })
    return data.data
  }

  async deletePdf(referenceId: string) {
    const data = await this.request(`/api/references/${referenceId}/pdf`, {
      method: 'DELETE',
    })
    return data.data
  }

  // AI Screening with Embeddings
  async screenReferenceWithEmbeddings(referenceData: {
    reference: any
    protocol: any
    threshold?: number
  }) {
    const data = await this.request('/api/ai/screen-reference-embeddings', {
      method: 'POST',
      body: JSON.stringify(referenceData),
    })
    return data.data
  }

  async screenReferencesBatchWithEmbeddings(batchData: {
    references: any[]
    protocol: any
    threshold?: number
  }) {
    const data = await this.request('/api/ai/screen-references-batch-embeddings', {
      method: 'POST',
      body: JSON.stringify(batchData),
    })
    return data
  }

  // Análisis de distribución de similitudes (Elbow Analysis)
  async analyzeSimilarityDistribution(projectId: string) {
    const data = await this.request('/api/ai/analyze-similarity-distribution', {
      method: 'POST',
      body: JSON.stringify({ projectId }),
    })
    return data // Retornar el objeto completo { success, data }
  }

  async generateRankingWithEmbeddings(rankingData: {
    references: any[]
    protocol: any
    models?: string[]
  }) {
    const data = await this.request('/api/ai/ranking-embeddings', {
      method: 'POST',
      body: JSON.stringify(rankingData),
    })
    return data.data
  }

  // AI Screening with LLM (existing)
  async screenReferenceWithLLM(referenceData: {
    reference: any
    inclusionCriteria?: string[]
    exclusionCriteria?: string[]
    researchQuestion?: string
    aiProvider?: 'chatgpt' | 'gemini'
  }) {
    const data = await this.request('/api/ai/screen-reference', {
      method: 'POST',
      body: JSON.stringify(referenceData),
    })
    return data.data
  }

  async screenReferencesBatchWithLLM(batchData: {
    references: any[]
    inclusionCriteria?: string[]
    exclusionCriteria?: string[]
    researchQuestion?: string
    aiProvider?: 'chatgpt' | 'gemini'
  }) {
    const data = await this.request('/api/ai/screen-references-batch', {
      method: 'POST',
      body: JSON.stringify(batchData),
    })
    return data.data
  }

  async analyzeScreeningResults(projectId: string) {
    const data = await this.request(`/api/ai/analyze-screening-results/${projectId}`, {
      method: 'GET',
    })
    return data.data
  }

  // === API USAGE STATS ===
  async getApiUsageStats() {
    const data = await this.request('/api/usage/stats', {
      method: 'GET',
    })
    return data.data
  }

  async getRecentApiUsage(days: number = 30) {
    const data = await this.request(`/api/usage/recent?days=${days}`, {
      method: 'GET',
    })
    return data.data
  }

  // === PRISMA ENDPOINTS ===

  /**
   * Extrae datos estructurados de PDFs completos
   */
  async extractPDFsData(projectId: string) {
    const data = await this.request(`/api/projects/${projectId}/prisma/extract-pdfs`, {
      method: 'POST',
    })
    return data
  }

  /**
   * Genera el PRISMA Context Object
   */
  async generatePrismaContext(projectId: string) {
    const data = await this.request(`/api/projects/${projectId}/prisma/generate-context`, {
      method: 'POST',
    })
    return data
  }

  /**
   * Completa ítems PRISMA por bloques académicos
   */
  async completePrismaByBlocks(projectId: string, block: 'all' | 'methods' | 'results' | 'discussion' | 'other' = 'all') {
    const data = await this.request(`/api/projects/${projectId}/prisma/complete-by-blocks`, {
      method: 'POST',
      body: JSON.stringify({ block }),
    })
    return data
  }

  /**
   * Obtiene el estado de PRISMA (si está completo y puede generar artículo)
   */
  async getPrismaStatus(projectId: string) {
    const data = await this.request(`/api/projects/${projectId}/prisma/status`, {
      method: 'GET',
    })
    return data
  }

  // === ARTICLE ENDPOINTS ===

  /**
   * Obtiene el estado del artículo (si puede ser generado)
   */
  async getArticleStatus(projectId: string) {
    const data = await this.request(`/api/projects/${projectId}/article/status`, {
      method: 'GET',
    })
    return data
  }

  /**
   * Genera artículo científico completo desde PRISMA cerrado
   * @param editedPICO - PICO editado por el usuario (opcional)
   */
  async generateArticle(projectId: string) {
    // Timeout extendido: la generación de artículo hace múltiples llamadas IA (puede tomar 3-8 min)
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 600000) // 10 minutos

    try {
      const response = await fetch(`${this.baseUrl}/api/projects/${projectId}/article/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`,
        },
        signal: controller.signal
      })

      clearTimeout(timeoutId)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Error al generar artículo')
      }

      return data
    } catch (error: any) {
      clearTimeout(timeoutId)
      if (error.name === 'AbortError') {
        throw new Error('La generación del artículo tardó demasiado. Intenta de nuevo (los datos ya extraídos se reutilizarán).')
      }
      throw error
    }
  }

  /**
   * Genera una sección específica del artículo
   */
  async generateArticleSection(projectId: string, section: 'introduction' | 'methods' | 'results' | 'discussion' | 'conclusions') {
    const data = await this.request(`/api/projects/${projectId}/article/generate-section`, {
      method: 'POST',
      body: JSON.stringify({ section }),
    })
    return data
  }

  /**
   * Guarda una versión del artículo
   */
  async saveArticleVersion(projectId: string, versionData: {
    title: string;
    sections: {
      abstract: string;
      introduction: string;
      methods: string;
      results: string;
      discussion: string;
      conclusions: string;
      references: string;
      declarations?: string;
    };
    changeDescription?: string;
  }) {
    const data = await this.request(`/api/projects/${projectId}/article/versions`, {
      method: 'POST',
      body: JSON.stringify(versionData),
    })
    return data
  }

  /**
   * Obtiene todas las versiones del artículo
   */
  async getArticleVersions(projectId: string) {
    const data = await this.request(`/api/projects/${projectId}/article/versions`, {
      method: 'GET',
    })
    return data
  }

  /**
   * Obtiene una versión específica del artículo
   */
  async getArticleVersion(projectId: string, versionId: string) {
    const data = await this.request(`/api/projects/${projectId}/article/versions/${versionId}`, {
      method: 'GET',
    })
    return data
  }

  /**
   * Actualiza una versión del artículo
   */
  async updateArticleVersion(projectId: string, versionId: string, versionData: {
    title?: string;
    sections?: {
      abstract?: string;
      introduction?: string;
      methods?: string;
      results?: string;
      discussion?: string;
      conclusions?: string;
      references?: string;
      declarations?: string;
    };
  }) {
    const data = await this.request(`/api/projects/${projectId}/article/versions/${versionId}`, {
      method: 'PUT',
      body: JSON.stringify(versionData),
    })
    return data
  }

  // === RQS (Research Question Schema) ENDPOINTS ===

  /**
   * Obtiene todas las entradas RQS de un proyecto
   */
  async getRQSEntries(projectId: string) {
    const data = await this.request(`/api/projects/${projectId}/rqs`, {
      method: 'GET',
    })
    return data
  }

  /**
   * Obtiene estadísticas RQS del proyecto
   */
  async getRQSStats(projectId: string) {
    const data = await this.request(`/api/projects/${projectId}/rqs/stats`, {
      method: 'GET',
    })
    return data
  }

  /**
   * Extrae datos RQS de todas las referencias incluidas (masivo)
   */
  async extractRQSData(projectId: string) {
    const data = await this.request(`/api/projects/${projectId}/rqs/extract`, {
      method: 'POST',
    })
    return data
  }

  /**
   * Extrae datos RQS de una referencia específica
   */
  async extractSingleRQS(projectId: string, referenceId: string) {
    const data = await this.request(`/api/projects/${projectId}/rqs/extract/${referenceId}`, {
      method: 'POST',
    })
    return data
  }

  /**
   * Actualiza una entrada RQS (validación manual)
   */
  async updateRQSEntry(projectId: string, rqsId: number, updates: Partial<RQSEntry>) {
    const data = await this.request(`/api/projects/${projectId}/rqs/${rqsId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    })
    return data
  }

  /**
   * Elimina una entrada RQS
   */
  async deleteRQSEntry(projectId: string, rqsId: number) {
    const data = await this.request(`/api/projects/${projectId}/rqs/${rqsId}`, {
      method: 'DELETE',
    })
    return data
  }

  /**
   * Exporta tabla RQS a CSV
   */
  getRQSExportURL(projectId: string): string {
    return `${this.baseUrl}/api/projects/${projectId}/rqs/export/csv`
  }
}

// Tipos para RQS
type RQRelation = 'yes' | 'no' | 'partial'

export interface RQSEntry {
  id: number
  projectId: string
  referenceId: string
  author: string
  year: number
  title?: string
  source?: string
  studyType?: 'empirical' | 'case_study' | 'experiment' | 'simulation' | 'review' | 'other'
  technology?: string
  context?: 'industrial' | 'enterprise' | 'academic' | 'experimental' | 'mixed' | 'other'
  keyEvidence?: string
  metrics?: Record<string, any>
  rq1Relation?: RQRelation
  rq2Relation?: RQRelation
  rq3Relation?: RQRelation
  rqNotes?: string
  limitations?: string
  qualityScore?: 'high' | 'medium' | 'low'
  extractionMethod?: 'ai_assisted' | 'manual' | 'hybrid'
  extractedBy?: string
  extractedAt?: string
  validated?: boolean
  validatedBy?: string
  validatedAt?: string
  createdAt?: string
  updatedAt?: string
}

export interface RQSStats {
  total: number
  validated: number
  ai_extracted: number
  manual_extracted: number
  empirical: number
  case_studies: number
  experiments: number
  completionRate: number
  studyTypeDistribution: Record<string, number>
  contextDistribution: Record<string, number>
  technologyDistribution: Array<{ technology: string; count: number }>
  yearDistribution: Record<string, number>
}

export { ApiClient }
export const apiClient = new ApiClient()
