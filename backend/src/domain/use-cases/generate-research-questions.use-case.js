/**
 * Use Case: Generate Research Questions (RQs)
 * 
 * Genera de 3 a 4 preguntas de investigación basadas en el marco PICO,
 * siguiendo criterios de multidimensionalidad y rigor académico.
 */
const { GoogleGenerativeAI } = require('@google/generative-ai');

class GenerateResearchQuestionsUseCase {
  constructor({ geminiApiKey = process.env.GEMINI_API_KEY } = {}) {
    if (geminiApiKey) {
      this.gemini = new GoogleGenerativeAI(geminiApiKey);
    }
  }

  /**
   * Ejecuta la generación de RQs
   * @param {Object} params - Datos del proyecto y PICO
   */
  async execute({ projectTitle, projectDescription, researchArea, picoData }) {
    if (!picoData) {
      throw new Error('El marco PICO es obligatorio para generar RQs');
    }

    const model = this.gemini.getGenerativeModel({
      model: "gemini-1.5-pro",
      systemInstruction: `Eres un experto en Metodología de la Investigación y Arquitectura de Software. 
Tus respuestas deben ser técnicas, objetivas y seguir estrictamente los estándares PRISMA 2020 y IEEE.
Generas Preguntas de Investigación (RQs) que cierran la brecha de conocimiento entre el marco PICO y el análisis técnico.`,
    });

    const prompt = this._buildPrompt({ projectTitle, projectDescription, researchArea, picoData });

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.3,
        responseMimeType: "application/json",
      }
    });

    const responseText = result.response.text();
    return this._parseResponse(responseText);
  }

  /**
   * Construye el prompt para la IA basándose en las instrucciones del usuario
   */
  _buildPrompt({ projectTitle, projectDescription, researchArea, picoData }) {
    return `
Genera un bloque de 3 a 4 Preguntas de Investigación (RQs) para la siguiente Revisión Sistemática de Literatura (RSL).

DATOS DEL PROYECTO:
- Título: ${projectTitle}
- Descripción: ${projectDescription}
- Área: ${researchArea}

MARCO PICO DEFINIDO:
- P (Población/Contexto Técnico): ${picoData.population || 'No especificada'}
- I (Intervención/Tecnología): ${picoData.intervention || 'No especificada'}
- C (Comparación): ${picoData.comparison || 'N/A'}
- O (Resultados/Outcomes): ${picoData.outcomes || picoData.outcome || 'No especificados'}

INSTRUCCIONES DE DISEÑO (OBLIGATORIAS):
1. Derivación Directa del PICO: Cada RQ debe ser una extensión lógica de los componentes P, I, C y O.
2. Multidimensionalidad: No generes preguntas binarias (de "sí" o "no"). Las RQs deben cubrir:
   - Magnitud/Impacto (RQ1): ¿Cuál es el efecto medible de la intervención?
   - Eficiencia/Comparación (RQ2): ¿Cómo se comporta frente al comparador en recursos/tiempo?
   - Variables Moderadoras (RQ3/RQ4): ¿Qué factores técnicos influyen en el resultado?
3. Redacción Académica: Usa verbos como Analizar, Evaluar, Cuantificar, Contrastar. Terminología técnica densa (Anti-AI style).

FORMATO DE SALIDA (JSON):
{
  "researchQuestions": [
    {
      "id": "RQ1",
      "question": "Pregunta completa...",
      "justification": "Breve justificación metodológica de cómo cierra la brecha de conocimiento."
    },
    ...
  ]
}
`;
  }

  _parseResponse(text) {
    try {
      let cleanJson = text.trim();
      if (cleanJson.startsWith('```json')) {
        cleanJson = cleanJson.replace(/^```json\s*/i, '').replace(/\s*```$/i, '');
      }
      return JSON.parse(cleanJson);
    } catch (error) {
      console.error('Error parseando RQs JSON:', error);
      throw new Error('La respuesta de la IA no es un JSON válido');
    }
  }
}

module.exports = GenerateResearchQuestionsUseCase;
