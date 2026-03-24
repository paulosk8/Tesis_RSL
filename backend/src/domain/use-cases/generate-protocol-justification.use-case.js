const AIService = require('../../infrastructure/services/ai.service');

/**
 * Use Case: Genera la JUSTIFICACIÓN del protocolo de revisión sistemática
 * siguiendo metodología PRISMA/Cochrane
 * 
 * Estructura generada:
 * - Párrafo 1: Contextualización del problema
 * - Párrafo 2: Brechas, inconsistencias o limitaciones de estudios previos
 * - Párrafo 3: Relevancia científica y práctica
 * - Párrafo 4: Necesidad de la revisión sistemática
 */
class GenerateProtocolJustificationUseCase {
  constructor({ aiService } = {}) {
    this.aiService = aiService || new AIService();
  }

  /**
   * Ejecuta la generación de justificación usando ChatGPT
   */
  async execute({ title, description, area, yearStart, yearEnd, pico, matrixData, aiProvider = 'chatgpt' }) {
    console.log(`\nGenerando JUSTIFICACIÓN...`);
    console.log(`   Título: ${title}`);
    console.log(`   Área: ${area}`);
    console.log(`   Rango temporal: ${yearStart} - ${yearEnd}`);

    if (!this.aiService) {
      throw new Error('Servicio de IA no configurado');
    }

    try {
      const result = await this._generateWithChatGPT({ title, description, area, yearStart, yearEnd, pico, matrixData });
      console.log('Justificación generada exitosamente');
      return result;
    } catch (error) {
      console.error('Error generando justificación:', error.message);
      throw error;
    }
  }

  /**
   * Genera justificación usando ChatGPT
   */
  async _generateWithChatGPT({ title, description, area, yearStart, yearEnd, pico, matrixData }) {
    const prompt = this._buildPrompt({ title, description, area, yearStart, yearEnd, pico, matrixData });
    const systemInstruction = 'Eres un experto en metodología PRISMA/Cochrane especializado en redacción de justificaciones académicas para protocolos de revisión sistemática.';

    const text = await this.aiService.generateText(systemInstruction, prompt, 'gemini', {
      temperature: 0.1,
      maxOutputTokens: 2000,
      responseMimeType: "application/json"
    });

    return JSON.parse(this.aiService.cleanJson(text));
  }

  /**
   * Construye el contexto PICO y matriz para el prompt
   */
  _buildContext(pico, matrixData) {
    let context = '';
    
    if (pico) {
      context += '**Marco PICO:**\n';
      if (pico.population) context += `- P (Población): ${pico.population.descripcion || pico.population}\n`;
      if (pico.intervention) context += `- I (Intervención): ${pico.intervention.descripcion || pico.intervention}\n`;
      if (pico.comparison) context += `- C (Comparación): ${pico.comparison.descripcion || pico.comparison}\n`;
      if (pico.outcomes) context += `- O (Resultados): ${pico.outcomes.descripcion || pico.outcomes}\n`;
      context += '\n';
    }
    
    if (matrixData && matrixData.es) {
      context += '**Matriz ES / NO ES:**\n';
      context += `- ES: ${Array.isArray(matrixData.es) ? matrixData.es.join('; ') : matrixData.es}\n`;
      context += `- NO ES: ${Array.isArray(matrixData.no_es) ? matrixData.no_es.join('; ') : matrixData.no_es}\n`;
    }
    
    return context;
  }

  /**
   * Construye el prompt para generar la justificación
   */
  _buildPrompt({ title, description, area, yearStart, yearEnd, pico, matrixData }) {
    const context = this._buildContext(pico, matrixData);

    return `Eres un experto en metodología PRISMA/Cochrane especializado en redacción de justificaciones para protocolos de revisión sistemática.

═══════════════════════════════════════════════════════════════
CONTEXTO DEL PROTOCOLO
═══════════════════════════════════════════════════════════════
• Título: ${title}
• Descripción: ${description}
• Área de conocimiento: ${area}
• Rango temporal: ${yearStart} - ${yearEnd}

${context}

═══════════════════════════════════════════════════════════════
TAREA: GENERAR JUSTIFICACIÓN DEL PROTOCOLO
═══════════════════════════════════════════════════════════════

Debes redactar una justificación académica rigurosa que explique **por qué debe realizarse esta revisión sistemática**.

═══════════════════════════════════════════════════════════════
REGLAS METODOLÓGICAS OBLIGATORIAS
═══════════════════════════════════════════════════════════════

1️⃣ **BASE EN LITERATURA EXISTENTE**:
   - Debe basarse en literatura existente (mínimo 5-10 referencias del estado actual)
   - Mencionar estudios representativos del área (puedes usar nombres genéricos como "Smith et al., 2022" o "recientes investigaciones")
   - NO es necesario que las referencias sean reales, pero deben ser plausibles

2️⃣ **SEÑALAR CONTRADICCIONES Y VACÍOS**:
   - Identificar brechas de investigación en el área
   - Señalar contradicciones entre estudios previos
   - Indicar falta de claridad en la literatura actual
   - Mencionar problemas metodológicos de estudios anteriores

3️⃣ **CONEXIÓN DIRECTA CON RSL**:
   - Debe conectar directamente la problemática con la necesidad de una revisión sistemática
   - Explicar por qué una RSL es el método adecuado (vs. estudio primario, scoping review, etc.)

4️⃣ **NO ES UN RESUMEN DEL ESTADO DEL ARTE**:
   - NO debe limitarse a describir lo que existe
   - DEBE argumentar la necesidad del estudio

5️⃣ **RESPONDER TRES PREGUNTAS CLAVE**:
   a) ¿Cuál es el problema?
   b) ¿Por qué es importante estudiarlo ahora?
   c) ¿Por qué una revisión sistemática es el método adecuado?

═══════════════════════════════════════════════════════════════
ESTRUCTURA OBLIGATORIA (4 PÁRRAFOS)
═══════════════════════════════════════════════════════════════

**PÁRRAFO 1: CONTEXTUALIZACIÓN DEL PROBLEMA (100-150 palabras)**
- Presentar el problema o fenómeno de estudio
- Explicar su relevancia en el área de ${area}
- Contextualizar temporalmente (tendencias actuales, evolución reciente)
- Mencionar 2-3 estudios representativos que abordan el tema

Ejemplo de inicio:
"En el contexto de ${area}, el fenómeno de [tema] ha cobrado relevancia significativa durante el período ${yearStart}-${yearEnd}, como evidencian estudios recientes (Author et al., ${yearEnd-1})..."

**PÁRRAFO 2: BRECHAS, INCONSISTENCIAS Y LIMITACIONES (120-180 palabras)**
- Identificar BRECHAS específicas en la literatura actual
- Señalar CONTRADICCIONES entre estudios previos
- Mencionar LIMITACIONES metodológicas de investigaciones anteriores
- Explicar qué aspectos NO han sido estudiados suficientemente
- Citar 3-4 ejemplos de estudios con resultados contradictorios o incompletos

Palabras clave a usar: "sin embargo", "no obstante", "limitaciones", "falta de consenso", "vacío de investigación", "estudios fragmentados"

**PÁRRAFO 3: RELEVANCIA CIENTÍFICA Y PRÁCTICA (100-150 palabras)**
- Explicar el IMPACTO CIENTÍFICO de llenar las brechas identificadas
- Describir el IMPACTO PRÁCTICO para profesionales del área
- Conectar con desafíos actuales en ${area}
- Mencionar beneficiarios directos e indirectos
- Justificar la urgencia temporal (por qué ahora, en ${yearStart}-${yearEnd})

Palabras clave: "contribución", "beneficios", "implicaciones prácticas", "aplicabilidad", "transferencia de conocimiento"

**PÁRRAFO 4: NECESIDAD DE LA REVISIÓN SISTEMÁTICA (80-120 palabras)**
- Explicar por qué se necesita específicamente una REVISIÓN SISTEMÁTICA
- Argumentar por qué un estudio primario NO sería suficiente
- Mencionar ventajas del método sistemático:
  * Síntesis rigurosa de evidencia dispersa
  * Identificación de patrones y tendencias
  * Evaluación crítica de calidad metodológica
  * Generación de conclusiones basadas en evidencia
- Conectar con criterios PRISMA/Cochrane

Frase de cierre sugerida:
"Por tanto, una revisión sistemática siguiendo directrices PRISMA/Cochrane permitirá sintetizar rigurosamente la evidencia disponible, identificar patrones robustos y generar conclusiones metodológicamente sólidas sobre [tema central]."

═══════════════════════════════════════════════════════════════
VALIDACIÓN DE CALIDAD
═══════════════════════════════════════════════════════════════

Autoevaluar usando estos criterios:

✅ **JUSTIFICACIÓN VÁLIDA si cumple TODO esto:**
1. ¿Identifica claramente la brecha? (párrafo 2)
2. ¿Justifica la pertinencia del método sistemático? (párrafo 4)
3. ¿Relaciona literatura actual? (menciona 5-10 estudios o tendencias)
4. ¿Presenta impacto académico Y práctico? (párrafo 3)
5. ¿Es coherente con la pregunta PICO? (elementos P, I, C, O presentes)

═══════════════════════════════════════════════════════════════
FORMATO DE RESPUESTA (JSON ESTRICTO)
═══════════════════════════════════════════════════════════════

IMPORTANTE: Genera un texto INTEGRADO Y FLUIDO de 400-600 palabras con los 4 párrafos conectados naturalmente.
NO uses subtítulos ni divisiones. El texto debe leerse como una justificación académica continua.

{
  "justificacion": {
    "texto_completo": "[OBLIGATORIO: 400-600 palabras] Texto integrado de 4 párrafos con conectores naturales:\n\nPárrafo 1 (Contextualización): Presenta el problema/fenómeno en el área de ${area}, menciona su relevancia ${yearStart}-${yearEnd}, cita 2-3 estudios representativos.\n\nPárrafo 2 (Brechas): Identifica contradicciones, limitaciones metodológicas, vacíos de investigación. Usa conectores como 'Sin embargo', 'No obstante', 'A pesar de'. Cita 3-4 estudios con resultados contradictorios.\n\nPárrafo 3 (Relevancia): Explica impacto científico y práctico, beneficiarios directos/indirectos, urgencia temporal, aplicabilidad en ${area}.\n\nPárrafo 4 (Necesidad RSL): Justifica por qué se necesita específicamente una revisión sistemática, ventajas del método PRISMA/Cochrane, qué aportará la síntesis rigurosa.",
    "referencias_mencionadas": [
      "Formato: Author et al. (año) - aporte breve",
      "Mínimo 5-10 referencias plausibles"
    ],
    "wordCount": [número de palabras del texto_completo],
    "prismaCompliance": "full|partial|low",
    "validacion": {
      "identifica_brecha": true|false,
      "justifica_metodo_sistematico": true|false,
      "relaciona_literatura": true|false,
      "presenta_impacto": true|false,
      "coherente_con_pico": true|false
    }
  }
}

EJEMPLO DE TEXTO COMPLETO INTEGRADO:

"Las enfermedades cardiovasculares constituyen una de las principales causas de morbilidad y mortalidad a nivel mundial, generando una carga significativa sobre los sistemas de salud. En los últimos años, el aprendizaje automático ha emergido como una herramienta prometedora para la detección temprana (Smith et al., 2023), análisis de datos clínicos complejos (Jones & Lee, 2022) y predicción del riesgo cardiovascular con mayor precisión que los enfoques estadísticos tradicionales.

A pesar del creciente número de estudios en este ámbito, la literatura presenta marcada heterogeneidad en algoritmos utilizados, conjuntos de datos y criterios de evaluación. Esta diversidad metodológica dificulta la comparación de resultados, genera inconsistencias en la evidencia reportada (García et al., 2023) y limita la identificación de modelos robustos. Estudios recientes muestran resultados contradictorios: mientras Anderson et al. (2022) reportan precisión del 92%, Chen et al. (2023) obtuvieron solo 78% en poblaciones similares, evidenciando la necesidad de síntesis crítica.

Desde una perspectiva científica y práctica, resulta fundamental sintetizar sistemáticamente la evidencia para comprender qué técnicas han demostrado mayor efectividad, bajo qué condiciones y con qué limitaciones. Esta síntesis aportaría insumos relevantes para investigadores, profesionales de la salud y responsables de decisiones en el diseño de sistemas de apoyo al diagnóstico clínico, con impacto directo en la reducción de costos y mejora de resultados en salud.

En este contexto, una revisión sistemática se presenta como el método más adecuado para integrar, evaluar críticamente y sintetizar la evidencia empírica disponible. Este enfoque metodológico permite garantizar transparencia, reproducibilidad y reducción de sesgos, proporcionando una visión estructurada y confiable del estado actual del conocimiento, identificando patrones robustos y direcciones futuras de investigación con rigor científico."

═══════════════════════════════════════════════════════════════
CRITERIOS DE COMPLIANCE
═══════════════════════════════════════════════════════════════

**"prismaCompliance": "full"**:
- Los 4 párrafos presentes y con longitud adecuada
- Menciona 5-10 estudios/tendencias
- Todos los campos de validación en true
- Coherencia con PICO
- Responde las 3 preguntas clave

**"prismaCompliance": "partial"**:
- Falta UN elemento de validación
- O longitud total 300-400 palabras (ligeramente corta)
- O menciona menos de 5 referencias

**"prismaCompliance": "low"**:
- Falta 2+ elementos de validación
- Justificación genérica sin especificidad
- No conecta con PICO
- Menos de 300 palabras

═══════════════════════════════════════════════════════════════
IMPORTANTE: RESPONDE ÚNICAMENTE CON JSON VÁLIDO
═══════════════════════════════════════════════════════════════

No agregues markdown, comentarios ni explicaciones fuera del JSON.
Usa SOLO comillas dobles (") en el JSON.`;
  }
}

module.exports = GenerateProtocolJustificationUseCase;
