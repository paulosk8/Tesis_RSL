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
   * @param {string|Object} contentOrProvider - Contenido del usuario o provider
   * @param {string} providerOverride - Provider explícito (ignorado)
   * @param {Object} options - Opciones de generación (temperature, responseMimeType, etc)
   * @returns {Promise<string>} Texto generado
   */
  async generateText(promptOrSystem, contentOrProvider = null, providerOverride = null, options = {}) {
    let systemPrompt, userContent;
    
    // Detectar modo de uso
    if (contentOrProvider === null || contentOrProvider === undefined) {
      // Modo 1: generateText(fullPrompt)
      systemPrompt = "Eres un asistente experto en análisis académico.";
      userContent = promptOrSystem;
    } else if (contentOrProvider === 'chatgpt' || contentOrProvider === 'gemini') {
      // Modo 2: fallback compatibility
      systemPrompt = "Eres un asistente experto en análisis académico.";
      userContent = promptOrSystem;
    } else {
      // Modo 3: generateText(systemPrompt, userContent)
      systemPrompt = promptOrSystem;
      userContent = contentOrProvider;
    }

    try {
      if (this.gemini) {
        // userContent puede ser string o array de partes [{text: '...'}, {inlineData: {...}}]
        return await this._generateWithGemini(systemPrompt, userContent, 5, options);
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
  async _generateWithGemini(systemPrompt, userContent, maxRetries = 5, options = {}) {
    if (!this.gemini) {
      throw new Error('Gemini API key no configurada');
    }

    // Modelos a intentar en orden de preferencia (V1beta tiene mejor soporte para archivos/LaTeX)
    // Se usan los nombres confirmados mediante discovery en la cuenta del usuario
    const modelsToTry = [
      'gemini-2.5-pro',
      'gemini-2.5-flash',
      'gemini-2.0-flash',
      'gemini-flash-latest',
      'gemini-pro-latest',
      'gemini-1.5-pro',
      'gemini-1.5-flash'
    ];
    let lastError = null;
    let tokensUsed = 0;

    // Configuración de generación
    const generationConfig = {
      temperature: options.temperature !== undefined ? options.temperature : 0.1,
      maxOutputTokens: options.maxOutputTokens || 8192,
      topP: options.topP,
      topK: options.topK,
      responseMimeType: options.responseMimeType
    };

    console.log(`🧠 [AIService] Config:`, JSON.stringify(generationConfig));

    for (const modelName of modelsToTry) {
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          console.log(`🤖 [${modelName}] Intento ${attempt}/${maxRetries} (API: v1beta)...`);
          
          // Usar v1beta para soporte multimodal completo
          // IMPORTANTE: NO usamos systemInstruction en el constructor para evitar errores 400 en algunas regiones
          const model = this.gemini.getGenerativeModel(
            { model: modelName },
            { apiVersion: 'v1beta' }
          );

          // CONSTRUIR PROMPT MANUALMENTE (Máxima compatibilidad)
          // Prependemos las instrucciones del sistema al contenido del usuario
          let requestContents = [];
          
          if (Array.isArray(userContent)) {
            // Si es un array de partes (texto + archivos/inlineData)
            requestContents = [
              { role: 'user', parts: [{ text: `INSTRUCCIONES DEL SISTEMA:\n${systemPrompt}\n\n---\n\n` }, ...userContent] }
            ];
          } else {
            // Si es solo texto
            requestContents = [
              { role: 'user', parts: [{ text: `${systemPrompt}\n\n---\n\n${userContent}` }] }
            ];
          }

          let fullText = "";
          let currentRequestContents = [...requestContents];
          let isDone = false;
          let continuationAttempts = 0;
          const MAX_CONTINUATIONS = 5;

          while (!isDone && continuationAttempts < MAX_CONTINUATIONS) {
            const result = await model.generateContent({
              contents: currentRequestContents,
              generationConfig
            });

            const response = await result.response;
            const textChunk = response.text();
            fullText += textChunk;
            
            const finishReason = response.candidates?.[0]?.finishReason;
            const currentTokens = response.usageMetadata?.totalTokenCount || 0;
            tokensUsed += currentTokens;

            if (finishReason === 'MAX_TOKENS') {
              console.log(`⚠️ Límite de tokens alcanzado. Solicitando continuación... (Intento ${continuationAttempts + 1}/${MAX_CONTINUATIONS})`);
              // Añadir la respuesta del asistente al historial
              currentRequestContents.push({ role: 'model', parts: [{ text: textChunk }] });
              // Añadir instrucción de continuar
              currentRequestContents.push({ 
                role: 'user', 
                parts: [{ text: "La respuesta se cortó por límite de longitud. Continúa generando EXACTAMENTE desde donde te quedaste, sin repetir palabras previas, sin saludos, sin formato extra. SOLO LA CONTINUACIÓN DIRECTA del código o texto." }] 
              });
              continuationAttempts++;
            } else {
              isDone = true;
            }
          }

          if (continuationAttempts >= MAX_CONTINUATIONS) {
            console.warn(`⚠️ Se alcanzó el número máximo de continuaciones (${MAX_CONTINUATIONS}). El texto podría estar incompleto.`);
          }

          await this._trackUsage('gemini', 'generateContent', modelName, tokensUsed, true, null);
          console.log(`✅ Respuesta recibida de ${modelName} (intento ${attempt}), continuaciones: ${continuationAttempts}`);
          return fullText;

        } catch (error) {
          lastError = error;
          const errorMessage = error.message.toLowerCase();
          console.warn(`⚠️ [${modelName}] Error en intento ${attempt}: ${error.message}`);

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

          // Errores de modelo no disponible
          const isModelUnavailable =
            errorMessage.includes('404') ||
            errorMessage.includes('not found') ||
            errorMessage.includes('not supported') ||
            errorMessage.includes('unsupported') ||
            (errorMessage.includes('model') && errorMessage.includes('unavailable'));

          if (isModelUnavailable || errorMessage.includes('limit: 0')) {
            const reason = isModelUnavailable ? 'no disponible' : 'con cuota 0';
            console.warn(`⚠️ Modelo ${modelName} ${reason}, saltando al siguiente...`);
            await this._trackUsage('gemini', 'generateContent', modelName, 0, false, error.message);
            break; // Salir del bucle de reintentos para este modelo
          }

          if ((isNetworkError || isRateLimit) && attempt < maxRetries) {
            const waitSeconds = isRateLimit ? 25 * attempt : 5 * attempt;
            console.warn(`⏳ [${modelName}] Reintentando en ${waitSeconds}s...`);
            await new Promise(resolve => setTimeout(resolve, waitSeconds * 1000));
            continue;
          }

          // Error no recuperable en este modelo
          console.error(`❌ [${modelName}] Fallido definitivamente en este modelo.`);
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
   * Limpia y sanea una cadena JSON proveniente de la IA
   * Elimina bloques de código markdown y caracteres de control problemáticos
   * @param {string} content 
   * @returns {string}
   */
  cleanJson(content) {
    if (!content || typeof content !== 'string') return content;
    
    let cleaned = content.trim();
    
    // 1. Eliminar bloques de código markdown
    cleaned = cleaned.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    // 2. Extraer solo el objeto JSON inicial si hay basura antes o después
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      cleaned = cleaned.substring(firstBrace, lastBrace + 1);
    }
    
    // 3. Limpiar caracteres de control ilegales, PERO dejar \n, \r y \t que son estructurales
    cleaned = cleaned.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '');

    return cleaned;
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
