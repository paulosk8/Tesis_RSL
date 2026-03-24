const AIService = require('../../infrastructure/services/ai.service');

class GenerateResearchQuestionsUseCase {
  constructor({ aiService } = {}) {
    this.aiService = aiService || new AIService();
  }

  /**
   * Ejecuta la generación de RQs
   * @param {Object} params - Datos del proyecto y PICO
   */
  async execute({ projectTitle, projectDescription, researchArea, picoData }) {
    if (!picoData || !picoData.population || !picoData.intervention) {
      throw new Error('El marco PICO (Población e Intervención) es obligatorio para generar RQs');
    }

    const systemPrompt = `Eres Antigravity, un experto en Metodología de la Investigación y Arquitectura de Software de alta fidelidad.
Tu objetivo es sintetizar Preguntas de Investigación (RQs) rigurosas basadas EXCLUSIVAMENTE en el marco PICO proporcionado.

REGLAS DE ORO:
1. Determinismo Total: Usa una temperatura de 0.0. No inventes contextos fuera del PICO.
2. Anti-AI Style: Evita introducciones genéricas. Usa terminología técnica densa (throughput, overhead, scalability, maintainability, abstraction penalty).
3. Estándares: Cumple estrictamente con PRISMA 2020 e IEEE.
4. Voz Activa: Usa "Analizamos", "Evaluamos", "Cuantificamos".`;

    const prompt = this._buildPrompt({ projectTitle, projectDescription, researchArea, picoData });

    const responseText = await this.aiService.generateText(systemPrompt, prompt, 'gemini', {
      temperature: 0.0,
      topP: 0.1,
      topK: 1,
      responseMimeType: "application/json"
    });

    return this._parseResponse(responseText);
  }

  /**
   * Construye el prompt para la IA basándose en las instrucciones del usuario
   */
  _buildPrompt({ projectTitle, projectDescription, researchArea, picoData }) {
    return `
Genera exactamente 3 Preguntas de Investigación (RQs) multidimensionales para esta Revisión Sistemática (RSL).

CONTEXTO TÉCNICO:
- Título: ${projectTitle}
- Descripción: ${projectDescription}
- Área: ${researchArea}

MARCO PICO (Única Fuente de Verdad):
- P (Población): ${picoData.population}
- I (Intervención): ${picoData.intervention}
- C (Comparación): ${picoData.comparison || 'Estado del arte / Alternativas convencionales'}
- O (Outcomes): ${picoData.outcomes || picoData.outcome}

REQUERIMIENTOS DE LAS RQS:
- RQ1 (Impacto/Magnitud): Debe enfocarse en el efecto medible y directo de la Intervención sobre los Outcomes en la Población.
- RQ2 (Eficiencia/Comparación): Debe contrastar la Intervención frente a la Comparación en términos de recursos técnicos.
- RQ3 (Factores Moderadores): Debe investigar qué variables técnicas o de entorno influyen en el éxito de la Intervención.

No generes preguntas de "Sí/No". Cada pregunta debe empezar con "Cómo", "En qué medida" o "Cuál es el impacto".

FORMATO DE SALIDA (JSON ESTRICTO):
{
  "researchQuestions": [
    "Pregunta 1...",
    "Pregunta 2...",
    "Pregunta 3..."
  ]
}
`;
  }

  _parseResponse(text) {
    try {
      let cleanJson = this.aiService.cleanJson(text);
      
      const parsed = JSON.parse(cleanJson);
      
      // Asegurar que todas las preguntas sean strings (por si la IA devuelve objetos)
      const sanitizedRQs = parsed.researchQuestions.map(rq => {
        if (typeof rq === 'string') return rq;
        if (typeof rq === 'object' && rq !== null) {
          return rq.question || rq.text || JSON.stringify(rq);
        }
        return String(rq);
      });

      return { researchQuestions: sanitizedRQs };
    } catch (error) {
      console.error('Error parseando RQs JSON:', error, 'Texto original:', text);
      throw new Error('La respuesta de la IA no pudo ser procesada como el formato de RQs requerido.');
    }
  }
}

module.exports = GenerateResearchQuestionsUseCase;
