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
  async generateText(promptOrSystem, contentOrProvider = null, providerOverride = null) {
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
        return await this._generateWithGemini(systemPrompt, userPrompt);
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
  async _generateWithGemini(systemPrompt, userPrompt, maxRetries = 3) {
    if (!this.gemini) {
      throw new Error('Gemini API key no configurada');
    }

    let lastError = null;
    let tokensUsed = 0;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const model = this.gemini.getGenerativeModel({ 
          model: "gemini-2.5-pro",
          systemInstruction: systemPrompt,
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 8192
          }
        });

        const result = await model.generateContent(userPrompt);
        const response = await result.response;
        
        tokensUsed = response.usageMetadata?.totalTokenCount || 0;
        await this._trackUsage('gemini', 'generateContent', 'gemini-2.5-pro', tokensUsed, true, null);

        return response.text();
      } catch (error) {
        lastError = error;
        const errorMessage = error.message.toLowerCase();
        
        // Check for rate limit or quota exceeded
        if (errorMessage.includes('429') || errorMessage.includes('quota') || errorMessage.includes('too many requests')) {
          console.warn(`⏳ [Intento ${attempt}/${maxRetries}] Límite de cuota Gemini excedido. Esperando antes de reintentar...`);
          if (attempt < maxRetries) {
            // Exponential backoff: 23s, 46s
            const waitTime = 23000 * attempt; 
            await new Promise(resolve => setTimeout(resolve, waitTime));
            continue;
          }
        }
        
        // Track the failed usage if we've exhausted retries or it's a non-retryable error
        await this._trackUsage('gemini', 'generateContent', 'gemini-2.5-pro', 0, false, error.message);
        throw error;
      }
    }
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
