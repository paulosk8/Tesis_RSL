const { GoogleGenerativeAI } = require('@google/generative-ai');

class GenerateTitlesUseCase {
  constructor() {
    // Inicializar OpenAI/ChatGPT
    if (process.env.GEMINI_API_KEY) {
      this.gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    }
  }

  /**
   * Genera 5 opciones de títulos con validación Cochrane
   * @param {Object} params - Parámetros
   * @param {Object} params.matrixData - Datos de la matriz Es/No Es
   * @param {Object} params.picoData - Datos del marco PICO
   * @param {String} params.aiProvider - Proveedor de IA ('chatgpt', 'chatgpt' o 'gemini')
   * @returns {Object} Resultado con 5 títulos y validación
   */
  async execute({ matrixData, picoData, aiProvider = 'gemini' }) {
    try {
      console.log('Generando 5 títulos con validación Cochrane usando Gemini...');
      
      if (!this.gemini) {
        throw new Error('No hay proveedor de IA configurado');
      }
      
      // Construir contexto del proyecto
      const context = this._buildContext(matrixData, picoData);
      
      // Construir prompt para el AI
      const prompt = this._buildPrompt(context);
      
      // Llamar al servicio de IA
      let response;
      try {
        response = await this._generateWithChatGPT(prompt);
      } catch (error) {
        console.error(`Error con Gemini:`, error.message);
        throw error;
      }
      
      // Log de respuesta cruda para debugging
      console.log('Respuesta cruda de la IA:', JSON.stringify(response).substring(0, 500));
      
      // Parsear respuesta
      const titles = this._parseResponse(response);
      
      console.log(`Generados ${titles.length} títulos exitosamente con Gemini`);
      
      return {
        success: true,
        data: {
          titles,
          provider: 'gemini'
        }
      };
    } catch (error) {
      console.error('Error en GenerateTitlesUseCase:', error);
      throw new Error(`Error generando títulos: ${error.message}`);
    }
  }

  /**
   * Genera títulos usando ChatGPT/Gemini
   */
  async _generateWithChatGPT(prompt) {
    if (!this.gemini) {
      throw new Error('Gemini API key no configurada');
    }

    const model = this.gemini.getGenerativeModel({
      model: "gemini-2.5-pro",
      systemInstruction: "Eres un Editor en Jefe de un Journal de Ingeniería de alto impacto (Q1). Tu estándar de calidad es extremo. Generas títulos académicos con rigor metodológico PRISMA 2020. Respondes ÚNICAMENTE en formato JSON válido.",
      generationConfig: {
        temperature: 0.6,
        maxOutputTokens: 8192,
        responseMimeType: "application/json"
      }
    });

    const result = await model.generateContent(prompt);
    let content = result.response.text();
    
    // Limpiar posibles bloques de código markdown
    content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    try {
      return JSON.parse(content);
    } catch (error) {
       console.error("Error parseando JSON devuelto por Gemini:", error.message);
       console.error("Contenido recibido:", content.substring(0, 200) + '...');
       // Intentar reparar un JSON cortado agregando cierres básicos
       if (error.message.includes("Unterminated string") || error.message.includes("Unexpected end of JSON input")) {
         try {
           // Intento desesperado de cerrar el JSON de forma cruda si se cortó al final de un string/objeto
           let repairedContent = content;
           if (repairedContent.endsWith('"')) repairedContent += '}]}';
           else if (repairedContent.endsWith('}')) repairedContent += ']}';
           else repairedContent += '"]}]}';
           
           console.log("Intentando recuperar JSON cortado...");
           return JSON.parse(repairedContent);
         } catch(e) {
           throw new Error("El modelo generó un JSON truncado que no se pudo recuperar: " + error.message);
         }
       }
       throw error;
    }
  }

  /**
   * Construye el contexto del proyecto desde matriz y PICO
   */
  _buildContext(matrixData, picoData) {
    let context = '';
    
    if (matrixData) {
      context += '**Matriz Es/No Es:**\n';
      if (matrixData.population) context += `- Población: ${matrixData.population}\n`;
      if (matrixData.intervention) context += `- Intervención: ${matrixData.intervention}\n`;
      if (matrixData.need) context += `- Necesidad: ${matrixData.need}\n`;
      if (matrixData.outcomes) context += `- Resultados Esperados: ${matrixData.outcomes}\n`;
      if (matrixData.provider) context += `- Proveedor: ${matrixData.provider}\n`;
      if (matrixData.studyType) context += `- Tipo de Estudio: ${matrixData.studyType}\n`;
      if (matrixData.comparison) context += `- Comparación: ${matrixData.comparison}\n`;
      context += '\n';
    }
    
    if (picoData) {
      context += '**Marco PICO (definido en paso anterior):**\n';
      if (picoData.population) context += `- P (Población): ${picoData.population}\n`;
      if (picoData.intervention) context += `- I (Intervención): ${picoData.intervention}\n`;
      if (picoData.comparison) context += `- C (Comparación): ${picoData.comparison}\n`;
      if (picoData.outcome || picoData.outcomes) context += `- O (Resultados): ${picoData.outcome || picoData.outcomes}\n`;
    }
    
    return context;
  }

  /**
   * Construye el prompt para generar títulos usando los datos PICO ya definidos en el paso anterior
   */
  _buildPrompt(context) {
    return `Eres un Senior Research Editor especializado en metodología de investigación y PRISMA 2020. Tu objetivo es generar 5 títulos académicos Q1 de alto impacto para una Revisión Sistemática de Literatura.

═══════════════════════════════════════════════════════════════
DATOS PICO DEL PROTOCOLO (Ya definidos en paso anterior - USAR TAL CUAL)
═══════════════════════════════════════════════════════════════
${context}

⚠️ IMPORTANTE: Los datos PICO arriba ya fueron validados metodológicamente. NO los reinterpretes ni modifiques. Úsalos directamente como insumo para construir los títulos.

═══════════════════════════════════════════════════════════════
REGLAS DE REDACCIÓN ACADÉMICA PARA TÍTULOS (ESTRICTO)
═══════════════════════════════════════════════════════════════

1. **Etiquetado del Estudio (PRISMA Ítem 1)**: 
   - El título DEBE terminar OBLIGATORIAMENTE con ": A Systematic Literature Review" (o ": A Scoping Literature Review" si explícitamente aplica). 
   - ⚠️ PROHIBIDO usar la versión corta ": A Systematic Review". En ámbitos no médicos, es necesario especificar que la fuente es la literatura científica.

2. **Precisión de Componentes (Intervención y Comparador)**: 
   - ⚠️ REGLA DE PRECISIÓN TÉCNICA: NO utilices nombres genéricos para (I) o (C). 
   - Si el PICO especifica una marca, versión o estado específico (ej. "Official MongoDB Native Driver"), el título debe reflejar esa precisión técnica exacta, sin abstraerla.

3. **Jerarquía del Resultado (Outcome - O)**: 
   - El título debe estar construido alrededor del Outcome principal.
   - Utiliza sustantivos de acción académica ponderante, tales como:
     * "Comparative Performance Analysis of..."
     * "Impact Evaluation of..."
     * "Assessment of..."
     * "Efficacy of..." (Para entornos clínicos)
   - ⚠️ ESTRUCTURA PROHIBIDA: Evita títulos que parezcan "preguntas" o que usen lenguaje informal. PROHIBIDO usar estructuras chabacanas como "[Tech A] vs [Tech B] for [Outcome]".

4. **Adaptación por Dominio Cualitativo**:
   - Para títulos en **Ingeniería/Tecnología**, agrupa Outcomes bajo conceptos como: "Performance Overhead", "System Efficiency", "Architectural Impact", "Computational Cost".
   - Para títulos en **Salud/Ciencias Sociales**, agrupa Outcomes bajo conceptos como: "Patient Outcomes", "Prevalence", "Intervention Effectiveness", "Clinical Efficacy".

5. **Estructuras Altamente Recomendadas (Patrones Q1)**:
   - **Patrón C1**: "[Sustantivo de Acción Académica] of [Intervention] Compared to [Comparator] in [Population]: A Systematic Literature Review"
   - **Patrón C2**: "[Outcome Paraguas] Impact of [Intervention] Versus [Comparator] in [Population]: A Systematic Literature Review"
   - **Patrón A** (Si no hay Comparator): "[Sustantivo de Acción Académica] of [Intervention] on [Outcome] in [Population]: A Systematic Literature Review"

6. **Prohibiciones Totales**:
   - Cero buzzwords ("Moderno", "Avanzado", "Reciente", "Estudio sobre").
   - La extensión completa debe ser fluida, de 12 a 23 palabras.

═══════════════════════════════════════════════════════════════
JUSTIFICACIÓN (30-50 palabras en español)
═══════════════════════════════════════════════════════════════
Debe explicar el "Research Gap": por qué esa combinación de P + I + O merece ser investigada.
NO hablar de la gramática del título. Hablar del CONTENIDO y su relevancia científica.

═══════════════════════════════════════════════════════════════
FORMATO JSON DE RESPUESTA
═══════════════════════════════════════════════════════════════

{
  "titles": [
    {
      "title": "Título en INGLÉS académico fiel a las reglas de estructura y etiqueta",
      "spanishTitle": "Traducción profesional al ESPAÑOL",
      "justification": "Justificación en español (30-50 palabras)",
      "spanishJustification": "Misma justificación",
      "cochraneCompliance": "full|partial",
      "wordCount": 15,
      "pattern": "C1|C2|A",
      "components": {
        "population": "[Del PICO-P]",
        "intervention": "[Del PICO-I]",
        "comparator": "[Del PICO-C o null]",
        "outcome": "[Del PICO-O]",
        "naturaleza": "Systematic Literature Review"
      },
      "validation": {
        "explicitReview": true,
        "clearPhenomenon": true,
        "hasPopulation": true,
        "hasOutcome": true,
        "isSpecific": true,
        "lengthOK": true
      }
    }
  ]
}

═══════════════════════════════════════════════════════════════
INSTRUCCIONES FINALES
═══════════════════════════════════════════════════════════════

1. Genera EXACTAMENTE 5 títulos DISTINTOS y NO REDUNDANTES
2. Todo título DEBE acabar en ": A Systematic Literature Review" obligatoriamente.
3. Todo título DEBE usar un "Sustantivo de acción" para liderar el Outcome (Comparative Performance Analysis, Evaluación de Impacto, etc)
4. Ningún título debe usar la estructura burda "A vs B". Siempre conectar con "Compared to", "Versus" o "Assessment of A against B".
5. Responde ÚNICAMENTE con JSON válido, sin texto markdown adicional antes o después.

GENERA LOS 5 TÍTULOS AHORA:`;
  }

  /**
   * Parsea la respuesta del AI con validación completa
   */
  _parseResponse(parsedJson) {
    try {
      // La respuesta ya viene parseada desde los métodos de generación
      const parsed = parsedJson;
      
      // Validar estructura
      if (!parsed.titles || !Array.isArray(parsed.titles)) {
        throw new Error('Respuesta no contiene array de títulos');
      }
      
      if (parsed.titles.length < 5) {
        throw new Error(`Solo se generaron ${parsed.titles.length} títulos, se esperaban 5`);
      }
      
      // Validar cada título con schema completo
      const validatedTitles = parsed.titles.map((item, index) => {
        // Validar title
        if (!item.title || typeof item.title !== 'string') {
          throw new Error(`Título ${index + 1} inválido: falta propiedad 'title'`);
        }
        
        const title = item.title.trim();
        const wordCount = title.split(/\s+/).length;
        
        // Validar longitud (5-22 palabras)
        if (wordCount < 5) {
          console.warn(`Título ${index + 1} muy corto (${wordCount} palabras): "${title.substring(0, 50)}..."`);
        }
        if (wordCount > 22) {
          console.warn(`Título ${index + 1} muy largo (${wordCount} palabras): "${title.substring(0, 50)}..."`);
        }
        
        // Validar compliance
        const compliance = item.cochraneCompliance || 'partial';
        if (!['full', 'partial', 'none'].includes(compliance)) {
          console.warn(`Compliance inválido para título ${index + 1}, usando 'partial'`);
        }
        
        // Validar components (actualizado con validación de outcome)
        const components = item.components || {};
        
        // CRÍTICO: Validar que todos los componentes PICO estén presentes
        const missingComponents = [];
        if (!components.population) missingComponents.push('population');
        if (!components.intervention) missingComponents.push('intervention');
        if (!components.outcome) missingComponents.push('outcome'); // NUEVO: Outcome es obligatorio
        
        if (missingComponents.length > 0) {
          console.warn(`Título ${index + 1} falta components PICO requeridos: ${missingComponents.join(', ')}`);
        }
        
        // Validar que el outcome no sea genérico o vago
        if (components.outcome) {
          const vagueOutcomes = ['impacto', 'impact', 'mejora', 'improvement', 'resultados', 'results', 'efectos', 'effects'];
          const isVagueOutcome = vagueOutcomes.some(vague => 
            components.outcome.toLowerCase().includes(vague) && components.outcome.split(' ').length <= 2
          );
          
          if (isVagueOutcome) {
            console.warn(`Título ${index + 1} tiene outcome vago: "${components.outcome}" - debe ser más específico (ej: "diagnostic accuracy", "energy efficiency", "development time")`);
          }
        }
        
        // Validar justification (OBLIGATORIO)
        const justification = item.justification || item.reasoning || '';
        if (!justification || justification.length < 20) {
          console.warn(`Título ${index + 1} tiene justificación faltante o muy corta (${justification.length} caracteres)`);
        } else {
          console.log(`Título ${index + 1} tiene justificación (${justification.length} caracteres)`);
        }
        
        // Extraer título en español y justificación en español
        const spanishTitle = item.spanishTitle || title; // Si no hay traducción, usar el título original
        const spanishJustification = item.spanishJustification || justification;
        
        return {
          title: title,
          spanishTitle: spanishTitle,
          cochraneCompliance: ['full', 'partial', 'none'].includes(compliance) ? compliance : 'partial',
          justification: justification || 'Sin justificación proporcionada',
          spanishJustification: spanishJustification || 'Sin justificación proporcionada',
          reasoning: justification || 'Sin justificación proporcionada', // Mantener por compatibilidad
          components: {
            population: components.population || 'unspecified',
            intervention: components.intervention || 'unspecified',
            comparator: components.comparator || components.comparison || null, // Soportar ambos nombres
            outcome: components.outcome || 'unspecified' // CRÍTICO: Outcome debe estar presente
          },
          wordCount: wordCount,
          // Agregar flag de validación para outcome
          hasExplicitOutcome: components.outcome && components.outcome !== 'unspecified' && components.outcome.length > 3
        };
      });
      
      // Verificar que al menos 3 sean 'full' compliance
      const fullCount = validatedTitles.filter(t => t.cochraneCompliance === 'full').length;
      if (fullCount < 3) {
        console.warn(`Solo ${fullCount} títulos tienen 'full' compliance, se esperaban al menos 3`);
      }
      
      // NUEVA VALIDACIÓN: Verificar que al menos 4 títulos tengan outcomes explícitos
      const withExplicitOutcome = validatedTitles.filter(t => t.hasExplicitOutcome).length;
      if (withExplicitOutcome < 4) {
        console.warn(`⚠️ Solo ${withExplicitOutcome} títulos tienen outcome explícito, se esperaban al menos 4`);
        console.warn(`⚠️ Recordatorio: Los títulos deben incluir outcomes específicos y medibles (ej: "diagnostic accuracy", "development time", "energy efficiency")`);
      }
      
      console.log(`Validación exitosa: ${validatedTitles.length} títulos, ${fullCount} con full compliance, ${withExplicitOutcome} con outcome explícito`);
      
      return validatedTitles.slice(0, 5); // Retornar máximo 5
      
    } catch (error) {
      console.error('Error parseando respuesta:', error.message);
      console.error('   Respuesta recibida:', JSON.stringify(parsedJson).substring(0, 300));
      
      // Fallback: generar títulos de respaldo
      console.log('Usando títulos de respaldo...');
      return this._generateFallbackTitles();
    }
  }

  /**
   * Genera títulos de respaldo en caso de error
   */
  _generateFallbackTitles() {
    return [
      {
        title: 'Comparative Performance Analysis of Research Topic in Study Context: A Systematic Literature Review',
        spanishTitle: 'Análisis de Rendimiento Comparativo del Tema de Investigación en Contexto de Estudio: Una Revisión Sistemática de Literatura',
        cochraneCompliance: 'partial',
        justification: 'Título genérico de respaldo - requiere personalización con datos PICO',
        spanishJustification: 'Título genérico de respaldo - requiere personalización con datos PICO',
        reasoning: 'Título genérico de respaldo - requiere personalización con datos PICO',
        components: {
          population: 'unspecified population',
          intervention: 'unspecified intervention',
          comparator: null,
          outcome: 'unspecified outcomes'
        },
        wordCount: 14
      },
      {
        title: 'Impact Evaluation of Intervention Strategies on Target Outcomes: A Systematic Literature Review',
        spanishTitle: 'Evaluación de Impacto de las Estrategias de Intervención en los Resultados Objetivo: Una Revisión Sistemática de Literatura',
        cochraneCompliance: 'partial',
        justification: 'Título de respaldo - estructura básica correcta pero necesita especificación',
        spanishJustification: 'Título de respaldo - estructura básica correcta pero necesita especificación',
        reasoning: 'Título de respaldo - estructura básica correcta pero necesita especificación',
        components: {
          population: 'target population',
          intervention: 'intervention strategies',
          comparator: null,
          outcome: 'target outcomes'
        },
        wordCount: 13
      },
      {
        title: 'Assessment of Study Intervention Compared to Baseline in Primary Outcomes: A Systematic Literature Review',
        spanishTitle: 'Evaluación de Intervención de Estudio frente a Línea Base en Resultados Primarios: Una Revisión Sistemática de Literatura',
        cochraneCompliance: 'partial',
        justification: 'Título de respaldo - faltan detalles específicos de población y contexto',
        spanishJustification: 'Título de respaldo - faltan detalles específicos de población y contexto',
        reasoning: 'Título de respaldo - faltan detalles específicos de población y contexto',
        components: {
          population: 'study participants',
          intervention: 'study intervention',
          comparator: 'baseline',
          outcome: 'primary outcomes'
        },
        wordCount: 15
      },
      {
        title: 'System Efficiency Outcomes of Research Topic in Target Population: A Scoping Literature Review',
        spanishTitle: 'Resultados de Eficiencia Sistémica del Tema de Investigación en Población Objetivo: Una Revisión Exploratoria de Literatura',
        cochraneCompliance: 'partial',
        justification: 'Título de respaldo - requiere información específica de PICO',
        spanishJustification: 'Título de respaldo - requiere información específica de PICO',
        reasoning: 'Título de respaldo - requiere información específica de PICO',
        components: {
          population: 'target population',
          intervention: 'research topic',
          comparator: null,
          outcome: 'research findings'
        },
        wordCount: 14
      },
      {
        title: 'Efficacy Assessment of Implementation Strategies for Expected Results: A Systematic Literature Review',
        spanishTitle: 'Evaluación de Eficacia de Estrategias de Implementación para Resultados Esperados: Una Revisión Sistemática de Literatura',
        cochraneCompliance: 'partial',
        justification: 'Título de respaldo - estructura adecuada pero requiere datos específicos',
        spanishJustification: 'Título de respaldo - estructura adecuada pero requiere datos específicos',
        reasoning: 'Título de respaldo - estructura adecuada pero requiere datos específicos',
        components: {
          population: 'study context',
          intervention: 'implementation strategies',
          comparator: null,
          outcome: 'expected results'
        },
        wordCount: 13
      }
    ];
  }
}

module.exports = GenerateTitlesUseCase;

