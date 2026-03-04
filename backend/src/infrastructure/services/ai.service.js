const { GoogleGenerativeAI } = require('@google/generative-ai');
const ApiUsageRepository = require('../repositories/api-usage.repository');

/**
 * Servicio centralizado para interacción con APIs de IA
 * Utiliza exclusivamente Google Gemini 2.5 Pro
 * INCLUYE REGISTRO AUTOMÁTICO DE USO
 */
class AIService {
  constructor(userId = null) {
    this.userId = userId;
    this.apiUsageRepository = new ApiUsageRepository();
    
    // Inicializar Gemini
    if (process.env.GEMINI_API_KEY) {
      this.gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    }

    if (!this.gemini) {
      console.warn('⚠️ No hay API de Gemini configurada');
    }
  }

  /**
   * Genera texto usando Gemini
   * Compatible con 2 modos:
   * - generateText(fullPromptWithContext) - Un solo string con todo
   * - generateText(systemInstructions, userContent) - Separado
   * 
   * @param {string} promptOrSystem - Prompt completo o instrucción del sistema
   * @param {string} contentOrProvider - Contenido del usuario o provider (ignorado ahora)
   * @param {string} providerOverride - Provider explícito (ignorado)
   * @returns {Promise<string>} Texto generado
   */
  async generateText(promptOrSystem, contentOrProvider = null, providerOverride = null, options = {}) {
    let systemPrompt, userPrompt;
    
    // Detectar modo de uso
    if (contentOrProvider === null || contentOrProvider === undefined) {
      // Modo 1: generateText(fullPrompt)
      systemPrompt = "Eres un asistente experto en análisis académico.";
      userPrompt = promptOrSystem;
    } else if (['chatgpt', 'gemini'].includes(contentOrProvider)) {
      // Modo 2: fallback compatibility
      systemPrompt = "Eres un asistente experto en análisis académico.";
      userPrompt = promptOrSystem;
    } else {
      // Modo 3: generateText(systemPrompt, userContent)
      systemPrompt = promptOrSystem;
      userPrompt = contentOrProvider;
    }

    try {
      if (this.gemini) {
        return await this._generateWithGemini(systemPrompt, userPrompt, 5, options);
      } else {
        throw new Error('No hay proveedores de IA configurados');
      }
    } catch (error) {
      console.error(`❌ Error con Gemini:`, error.message);
      throw error;
    }
  }

  /**
   * Genera texto con Gemini 2.5 Pro
   * @private
   */
  async _generateWithGemini(systemPrompt, userPrompt, maxRetries = 5, options = {}) {
    if (!this.gemini) {
      throw new Error('Gemini API key no configurada');
    }

    // Modelos a intentar en orden de preferencia
    const modelsToTry = ['gemini-1.5-pro', 'gemini-1.5-flash'];
    let lastError = null;
    let tokensUsed = 0;

    // Configuración de generación
    const generationConfig = {
      temperature: options.temperature !== undefined ? options.temperature : 0.3,
      maxOutputTokens: options.maxOutputTokens || 8192,
      topP: options.topP,
      topK: options.topK,
      responseMimeType: options.responseMimeType
    };

    console.log(`🧠 [AIService] Config:`, JSON.stringify(generationConfig));

    for (const modelName of modelsToTry) {
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          console.log(`🤖 [${modelName}] Intento ${attempt}/${maxRetries} (Temp: ${generationConfig.temperature})...`);
          const model = this.gemini.getGenerativeModel({ 
            model: modelName,
            systemInstruction: systemPrompt,
            generationConfig
          });

          const result = await model.generateContent(userPrompt);
          const response = await result.response;
          
          tokensUsed = response.usageMetadata?.totalTokenCount || 0;
          await this._trackUsage('gemini', 'generateContent', modelName, tokensUsed, true, null);
          console.log(`✅ Respuesta recibida de ${modelName} (intento ${attempt})`);
          return response.text();

        } catch (error) {
          lastError = error;
          const errorMessage = error.message.toLowerCase();

          // Errores de red transitorios: reintentar con backoff
          const isNetworkError = 
            errorMessage.includes('fetch failed') ||
            errorMessage.includes('econnreset') ||
            errorMessage.includes('enotfound') ||
            errorMessage.includes('etimedout') ||
            errorMessage.includes('socket hang up') ||
            errorMessage.includes('network') ||
            errorMessage.includes('connection');

          // Errores de rate limit: reintentar con backoff largo
          const isRateLimit =
            errorMessage.includes('429') ||
            errorMessage.includes('quota') ||
            errorMessage.includes('too many requests') ||
            errorMessage.includes('resource_exhausted');

          // Errores de modelo no disponible: saltar al siguiente modelo
          const isModelUnavailable =
            errorMessage.includes('404') ||
            errorMessage.includes('not found') ||
            errorMessage.includes('not supported') ||
            errorMessage.includes('model') && errorMessage.includes('unavailable');

          if (isModelUnavailable) {
            console.warn(`⚠️ Modelo ${modelName} no disponible, intentando siguiente modelo...`);
            await this._trackUsage('gemini', 'generateContent', modelName, 0, false, error.message);
            break; // Salir del bucle de reintentos para este modelo
          }

          if ((isNetworkError || isRateLimit) && attempt < maxRetries) {
            const waitSeconds = isRateLimit ? 25 * attempt : 5 * attempt;
            console.warn(`⏳ [${modelName}] Intento ${attempt}/${maxRetries} fallido (${isRateLimit ? 'rate limit' : 'error de red'}). Reintentando en ${waitSeconds}s...`);
            await new Promise(resolve => setTimeout(resolve, waitSeconds * 1000));
            continue;
          }

          // Error no recuperable en este modelo
          console.error(`❌ [${modelName}] Fallido definitivamente:`, error.message);
          await this._trackUsage('gemini', 'generateContent', modelName, 0, false, error.message);
          break; // Intentar el siguiente modelo
        }
      }
    }

    // Todos los modelos fallaron
    throw lastError || new Error('Todos los modelos de Gemini están no disponibles');
  }

  /**
   * Genera embeddings usando Gemini text-embedding-004
   * @param {string} text - Texto para generar embedding
   * @returns {Promise<number[]>} Vector de embedding
   */
  async generateEmbedding(text) {
    if (!this.gemini) {
      throw new Error('Gemini API key requerida para embeddings');
    }

    try {
      const model = this.gemini.getGenerativeModel({ model: "text-embedding-004"});
      const result = await model.embedContent(text);

      await this._trackUsage('embeddings', 'embedContent', 'text-embedding-004', 0, true, null);

      return result.embedding.values;
    } catch (error) {
      await this._trackUsage('embeddings', 'embedContent', 'text-embedding-004', 0, false, error.message);
      throw error;
    }
  }

  /**
   * Registra el uso de una API
   * @private
   */
  async _trackUsage(provider, endpoint, model, tokensTotal, success, errorMessage) {
    try {
      if (!this.userId) {
        return;
      }

      await this.apiUsageRepository.create({
        userId: this.userId,
        provider,
        endpoint,
        model,
        tokensPrompt: 0,
        tokensCompletion: 0,
        tokensTotal,
        success,
        errorMessage
      });
    } catch (error) {
      console.error('⚠️ Error registrando uso de API:', error.message);
    }
  }

  /**
   * Verifica si hay proveedores disponibles
   * @returns {Object} Estado de disponibilidad
   */
  getAvailability() {
    return {
      chatgpt: false,
      gemini: !!this.gemini,
      any: !!this.gemini
    };
  }
}

module.exports = AIService;
