const AIService = require('../../infrastructure/services/ai.service');

/**
 * Caso de uso: Cribado automático de referencias con IA
 * Analiza referencias bibliográficas y las clasifica según criterios de inclusión/exclusión
 */
class ScreenReferencesWithAIUseCase {
  constructor({ aiService } = {}) {
    this.aiService = aiService || new AIService();
  }

  /**
   * Analiza una referencia individual
   */
  async execute({ 
    reference, 
    inclusionCriteria, 
    exclusionCriteria, 
    researchQuestion,
    aiProvider = 'chatgpt',
    isFragmented = false 
  }) {
    if (!reference || !reference.title) {
      throw new Error('Referencia con título es requerida');
    }

    const prompt = this.buildPrompt(reference, inclusionCriteria, exclusionCriteria, researchQuestion, isFragmented);

    try {
      if (!this.aiService) {
        throw new Error('Servicio de IA no configurado');
      }

      const result = await this.generateWithChatGPT(prompt);

      return {
        success: true,
        data: result
      };
    } catch (error) {
      console.error('Error en screening con IA:', error);
      throw new Error(`Error al analizar referencia: ${error.message}`);
    }
  }

  /**
   * Analiza múltiples referencias en lote
   */
  async executeBatch({ 
    references, 
    inclusionCriteria, 
    exclusionCriteria,
    researchQuestion, 
    aiProvider = 'chatgpt',
    isFragmented = false
  }) {
    const results = [];
    
    // Procesar en grupos de 5 para no sobrecargar
    const batchSize = 5;
    for (let i = 0; i < references.length; i += batchSize) {
      const batch = references.slice(i, i + batchSize);
      const batchPromises = batch.map(ref => 
        this.execute({ 
          reference: ref, 
          inclusionCriteria, 
          exclusionCriteria,
          researchQuestion,
          aiProvider,
          isFragmented
        })
      );
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }
    
    return {
      success: true,
      data: results,
      summary: this.generateSummary(results)
    };
  }

  buildPrompt(reference, inclusionCriteria, exclusionCriteria, researchQuestion, isFragmented = false) {
    const fragmentedInstructions = isFragmented ? `
**MODO DE BÚSQUEDA FRAGMENTADA (Comparación Indirecta):**
Estamos en una fase de búsqueda fragmentada donde la literatura sobre comparaciones directas es escasa. 
- Sé más flexible con la inclusión: si un artículo no compara directamente ambas tecnologías pero aporta datos empíricos de rendimiento, benchmarks o análisis técnicos profundos de **al menos uno** de los componentes (Intervención o Comparador) dentro de la población y contexto definidos, cátegorízalo como "incluida" o "revisar_manual".
- No descartes estudios solo por ser "parciales" si su calidad técnica es alta.` : '';

    return `Eres un experto en revisión sistemática de literatura científica siguiendo metodología PRISMA.${fragmentedInstructions}

**PREGUNTA DE INVESTIGACIÓN:**
${researchQuestion || 'No especificada'}

**CRITERIOS DE INCLUSIÓN:**
${this.formatCriteria(inclusionCriteria)}

**CRITERIOS DE EXCLUSIÓN:**
${this.formatCriteria(exclusionCriteria)}

**REFERENCIA A ANALIZAR:**
- Título: ${reference.title}
- Autores: ${reference.authors || 'No especificado'}
- Año: ${reference.year || 'No especificado'}
- Resumen: ${reference.abstract || 'No disponible'}
- Palabras clave: ${reference.keywords || 'No especificadas'}

**TU TAREA:**
Analizar si esta referencia debe ser INCLUIDA o EXCLUIDA en la revisión sistemática.

**RESPONDE EN FORMATO JSON:**

{
  "decision": "incluida|excluida|revisar_manual",
  "confidence": 0.95,
  "razonamiento": "Explicación detallada de por qué se tomó esta decisión",
  "criterios_cumplidos": [
    "Lista de criterios de inclusión que cumple"
  ],
  "criterios_no_cumplidos": [
    "Lista de criterios de exclusión que aplican"
  ],
  "aspectos_relevantes": [
    "Aspectos clave de la referencia relacionados con la pregunta de investigación"
  ],
  "aspectos_preocupantes": [
    "Aspectos que generan dudas o preocupaciones"
  ],
  "recomendacion_revision_manual": "si|no",
  "motivo_revision_manual": "Razón por la cual requiere revisión manual (si aplica)"
}

**CRITERIOS DE CONFIANZA:**
- confidence >= 0.90: Alta confianza en la decisión
- 0.70 <= confidence < 0.90: Confianza media, considerar revisión
- confidence < 0.70: Baja confianza, requiere revisión manual obligatoria

**IMPORTANTE:**
- Sé conservador: si hay dudas significativas, marca como "revisar_manual"
- Basa tu decisión en evidencia del título y abstract
- No asumas información que no está presente
- Prioriza la calidad sobre la cantidad

Responde SOLO con JSON válido.`;
  }

  formatCriteria(criteria) {
    if (!criteria || criteria.length === 0) {
      return 'No especificados';
    }
    
    if (Array.isArray(criteria)) {
      return criteria.map((c, i) => `${i + 1}. ${typeof c === 'object' ? c.criterio : c}`).join('\n');
    }
    
    return JSON.stringify(criteria, null, 2);
  }

  generateSummary(results) {
    const total = results.length;
    const incluidas = results.filter(r => r.data.decision === 'incluida').length;
    const excluidas = results.filter(r => r.data.decision === 'excluida').length;
    const revisar = results.filter(r => r.data.decision === 'revisar_manual').length;
    const altaConfianza = results.filter(r => r.data.confidence >= 0.90).length;
    
    return {
      total,
      incluidas,
      excluidas,
      revisar_manual: revisar,
      alta_confianza: altaConfianza,
      porcentajes: {
        incluidas: ((incluidas / total) * 100).toFixed(1),
        excluidas: ((excluidas / total) * 100).toFixed(1),
        revisar: ((revisar / total) * 100).toFixed(1),
        alta_confianza: ((altaConfianza / total) * 100).toFixed(1)
      }
    };
  }

  async generateWithChatGPT(prompt) {
    const systemInstruction = "Eres un experto en revisión sistemática de literatura científica. Analizas referencias con rigor metodológico siguiendo PRISMA. Respondes en formato JSON válido.";
    
    const textResult = await this.aiService.generateText(systemInstruction, prompt, 'gemini', {
      temperature: 0.0,
      maxOutputTokens: 8000,
      responseMimeType: "application/json"
    });
    
    let text = this.aiService.cleanJson(textResult);
    
    try {
      return JSON.parse(text);
    } catch (e) {
      console.error("❌ Fallo parseando JSON de Gemini. Raw output:", text.substring(0, 200) + '...');
      // Intentar auto-reparar o retornar JSON por defecto estructurado en vez de explotar
      try {
        // En caso excepcional si devuelve un string incompleto, devolver dummy
        return {
          decision: "revisar_manual",
          confidence: 0,
          razonamiento: "Error de IA recuperado automáticamente: " + e.message,
          recomendacion_revision_manual: "si"
        };
      } catch(e2) {
        throw e;
      }
    }
  }
}

module.exports = ScreenReferencesWithAIUseCase;

