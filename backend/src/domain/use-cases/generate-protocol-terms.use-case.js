const AIService = require('../../infrastructure/services/ai.service');

/**
 * Use Case: Generador de Términos del Protocolo
 * 
 * Genera términos clave y sinónimos para cada componente del protocolo PICO
 * para ayudar en la búsqueda bibliográfica.
 */
class GenerateProtocolTermsUseCase {
  constructor({ aiService } = {}) {
    this.aiService = aiService || new AIService();
  }

  /**
   * Genera términos y sinónimos para el protocolo
   * @param {string} selectedTitle - Título de la RSL seleccionado en el paso 3
   * @param {string} projectTitle - Título del proyecto (legacy, se usa selectedTitle si está disponible)
   */
  async execute({ selectedTitle, projectTitle, projectDescription, picoData, matrixData, aiProvider, specificSection, customFocus }) {
    try {
      // REGLA METODOLÓGICA: Los términos DEBEN basarse en el título de la RSL seleccionado
      const rslTitle = selectedTitle || projectTitle;
      
      console.log('Generando términos del protocolo...');
      console.log('Título RSL:', rslTitle);
      
      if (specificSection) {
        console.log('Regenerando sección específica:', specificSection);
        console.log('Enfoque personalizado:', customFocus || 'predeterminado');
      }

      const prompt = this.buildPrompt({
        rslTitle,
        projectTitle,
        projectDescription,
        picoData,
        matrixData,
        specificSection,
        customFocus
      });
      
      if (!this.aiService) {
        throw new Error('Servicio de IA no configurado');
      }
      
      const systemInstruction = "Eres un experto en Bibliometría y Revisiones Sistemáticas (RSL) bajo estándares PRISMA 2020. Respondes ÚNICAMENTE en formato JSON válido.";
      
      const text = await this.aiService.generateText(systemInstruction, prompt, 'gemini', {
        temperature: 0.1,
        maxOutputTokens: 8192,
        responseMimeType: "application/json"
      });

      console.log('Respuesta raw (primeros 300 chars):', text.substring(0, 300));

      // Parsear la respuesta
      let terms = this.parseResponse(text);

      // Normalizar y validar términos (3-6 por categoría)
      terms = this.normalizeTerms(terms);

      console.log('Términos generados y validados exitosamente');
      console.log('Términos finales:', JSON.stringify(terms, null, 2));

      return {
        success: true,
        data: {
          technologies: terms.technologies,
          applicationDomain: terms.applicationDomain,
          thematicFocus: terms.thematicFocus,
          provider: 'chatgpt'
        }
      };

    } catch (error) {
      console.error('Error generando términos:', error);
      throw new Error(`Error generando términos del protocolo: ${error.message}`);
    }
  }

  /**
   * Construye el prompt para la IA (refinado para sincronización PICO y Matriz de Síntesis)
   */
  buildPrompt({ rslTitle, projectTitle, projectDescription, picoData, matrixData, specificSection, customFocus }) {
    // Usar título de la RSL seleccionado como fuente principal
    const title = (rslTitle || projectTitle || 'Tema no especificado').replace(/\n/g, ' ').trim();
    const description = (projectDescription || 'Sin descripción').replace(/\n/g, ' ').trim();
    
    // Extraer datos PICO para sincronización (acepta outcome singular o plural)
    const P = picoData?.population?.descripcion || picoData?.population || 'No definida';
    const I = picoData?.intervention?.descripcion || picoData?.intervention || 'No definida';
    const C = picoData?.comparison?.descripcion || picoData?.comparison || 'No definida';
    const O = picoData?.outcome?.descripcion || picoData?.outcome || picoData?.outcomes?.descripcion || picoData?.outcomes || 'No definida';
    
    // Extraer matriz Es/No Es
    const isIncluded = (matrixData?.is || []).slice(0, 10);
    const isNotIncluded = (matrixData?.isNot || []).slice(0, 10);

    // Si hay sección específica y enfoque personalizado, generar prompt especializado
    if (specificSection && customFocus) {
      return this.buildSpecificSectionPrompt({
        title,
        description,
        P, I, C, O,
        isIncluded,
        isNotIncluded,
        specificSection,
        customFocus
      });
    }

    return `
Eres un experto en Bibliometría y Revisiones Sistemáticas (RSL) bajo estándares PRISMA 2020.
Tu objetivo es generar términos de búsqueda bilingües (ES-EN) para construir cadenas booleanas en bases académicas, garantizando alto nivel de Recall (Sensibilidad).

RESPONDE ÚNICAMENTE con JSON válido (sin texto adicional, sin markdown, sin comentarios).

═══════════════════════════════════════════════════════════════
DATOS DEL PROTOCOLO (ya validados en pasos anteriores)
═══════════════════════════════════════════════════════════════

TÍTULO RSL SELECCIONADO: "${title}"
⚠️ NOTA: El título es referencial. Basar términos en PICO y Matriz validados por el investigador.

MARCO PICO (ya definido y editado por el investigador — usar tal cual):
- P (Población/Contexto): ${P}
- I (Intervención/Tecnología): ${I}
- C (Comparación): ${C}
- O (Resultado/Variable): ${O}

Matriz ES (Inclusión): ${isIncluded.length ? isIncluded.join(' | ') : 'No definida'}
Matriz NO ES (Exclusión): ${isNotIncluded.length ? isNotIncluded.join(' | ') : 'No definida'}

═══════════════════════════════════════════════════════════════
INSTRUCCIONES DE GENERACIÓN (NUEVO PROTOCOLO DE RECALL)
═══════════════════════════════════════════════════════════════

1. **Expansión de Sinónimos Técnicos (technologies)**:
   - Deriva de PICO-I: "${I}" y PICO-C: "${C}" 
   - ⚠️ REGLA CRÍTICA: Identifica tecnologías e INCLUYE SIEMPRE sus acrónimos y variantes de la industria.
   - Ejemplo: Si la tecnología es "Object Relational Mapping", añade "ORM". Si es "Object Document Mapper", añade "ODM".

2. **Dominio de Aplicación (applicationDomain)**:
   - Deriva de PICO-P: "${P}"
   - Keywords MUY cortas y específicas sobre el ecosistema técnico o dominio de estudio.

3. **Inclusión de Metodologías de Medición (thematicFocus)**:
   - Deriva de PICO-O: "${O}"
   - ⚠️ OBLIGATORIO: Además de las métricas (ej. Latency, Throughput), INCLUYE términos relacionados con la obtención empírica de datos.
   - Ejemplos obligatorios a considerar: "Benchmark", "Benchmarking", "Empirical Study", "Comparative Study", "Performance Evaluation".

4. **Prioridad Lingüística (Inglés Técnico)**:
   - Genera siempre una versión en **Inglés Técnico de alta fidelidad** (escala global de indexación).
   - Formato de respuesta por elemento: "Término en Español - Technical Term in English".
   - Marcas registradas NO se traducen ("MongoDB - MongoDB").

5. **Adaptación Multidisciplinaria**:
   - Si detectas **Ingeniería**: Asegura la presencia de términos de arquitectura y eficiencia ("Overhead", "Throughput", "Latency", "Scalability").
   - Si detectas **Ciencias de la Salud/Sociales**: Asegura la presencia de validez y metodologías clínicas ("Control Group", "Randomized Trial", "Clinical Efficacy", "Psychometric Properties").

═══════════════════════════════════════════════════════════════
NORMALIZACIÓN PARA BÚSQUEDA BOOLEANA Y FORMATO JSON
═══════════════════════════════════════════════════════════════

- Los términos deben ser mutuamente excluyentes entre categorías para usarse como grupos AND en la búsqueda, mientras operan con OR dentro de la lista.
- Formato BILINGÜE: "Español - English" (español primero)
- Máximo 4-5 palabras por idioma.
- Extrae exactamente 4 a 6 términos por categoría.

{
  "technologies": [
    "Mapeo Objeto-Documento - Object Document Mapping (ODM)",
    "Controlador Nativo - Native Driver",
    "MongoDB - MongoDB"
  ],
  "applicationDomain": [
    "Sistemas Backend - Backend Systems",
    "Aplicaciones Node.js - Node.js Applications"
  ],
  "thematicFocus": [
    "Evaluación de Rendimiento - Performance Evaluation",
    "Prueba de Referencia - Benchmark",
    "Estudio Comparativo - Comparative Study",
    "Latencia - Latency",
    "Rendimiento del Sistema - System Throughput"
  ]
}

RESPONDE SOLO CON EL JSON. NADA MÁS.
`.trim();
  }

  /**
   * Construye un prompt específico para regenerar una sección con enfoque personalizado
   */
  buildSpecificSectionPrompt({ title, description, P, I, C, O, isIncluded, isNotIncluded, specificSection, customFocus }) {
    // Mapeo de secciones a nombres legibles
    const sectionNames = {
      tecnologia: 'technologies',
      dominio: 'applicationDomain',
      focosTematicos: 'thematicFocus'
    };

    const jsonKey = sectionNames[specificSection] || specificSection;

    return `
Eres un experto en metodología PRISMA para revisiones sistemáticas. Tu tarea: regenerar ÚNICAMENTE la sección "${jsonKey}" con enfoque personalizado, maximizando el Recall (Sensibilidad).

RESPONDE ÚNICAMENTE con JSON válido (sin texto adicional, sin markdown, sin comentarios).

TÍTULO RSL: "${title}"
⚠️ El título es solo contexto. Basar términos en PICO y enfoque personalizado del usuario.

MARCO PICO (ya validado por el investigador — usar tal cual):
- P (Población): ${P}
- I (Intervención): ${I}  
- C (Comparación): ${C || 'ninguna'}
- O (Resultados): ${O}

Matriz ES: ${isIncluded.join(' | ')}
Matriz NO ES: ${isNotIncluded.join(' | ')}

ENFOQUE PERSONALIZADO DEL USUARIO: ${customFocus}

REGLAS PARA "${jsonKey}":
${jsonKey === 'technologies' ? `- Deriva de PICO-I: "${I}" y PICO-C: "${C}"
- ⚠️ REGLA CRÍTICA: Identifica tecnologías e INCLUYE SIEMPRE sus acrónimos (ej. Object Relational Mapping → ORM).
- 4-6 términos CLAVE: nombres propios técnicos específicos.
- Nombres propios técnicos NO se traducen: "MongoDB - MongoDB".` : ''}
${jsonKey === 'applicationDomain' ? `- Deriva de PICO-P: "${P}"
- 3-5 términos ESPECÍFICOS: contexto/dominio DONDE se aplica.
- ¡KEYWORDS CORTAS! (Backend Systems, Node.js, RESTful APIs).
- ❌ EVITAR términos amplios: "Software", "Technology", "Engineering".` : ''}
${jsonKey === 'thematicFocus' ? `- Deriva de PICO-O: "${O}"
- 4-6 métricas ESPECÍFICAS que respondan "¿Qué se mide exactamente?"
- ⚠️ OBLIGATORIO: INCLUYE términos relacionados con la obtención empírica de datos (ej. "Benchmark", "Empirical Study", "Performance Evaluation").
- Adaptativo: Para ingeniería usa "Overhead", "Throughput". Para salud usa "Randomized Trial", "Efficacy".` : ''}

FORMATO JSON (devolver las 3 categorías, solo "${jsonKey}" será usada):
{
  "technologies": ["Español - English", ...],
  "applicationDomain": ["Español - English", ...],
  "thematicFocus": ["Español - English", ...]
}

- Formato BILINGÜE: "Español - English" (español primero), asegurando la Inglés Técnico de Alta Fidelidad.
- Máximo 5 palabras por idioma. Asegurar exclusión mutua para facilitar ramas AND/OR.
- Aplicar enfoque personalizado: ${customFocus}

RESPONDE SOLO CON EL JSON. NADA MÁS.
`.trim();
  }

  /**
   * Parsea la respuesta de la IA con parsing robusto de JSON
   */
  parseResponse(text) {
    // 1) Limpiar JSON usando la utilidad centralizada
    let jsonStr = this.aiService.cleanJson(text);

    // 2) Asegurar que tomamos solo el objeto JSON (fallback si hay texto extra)
    const firstBrace = jsonStr.indexOf('{');
    const lastBrace = jsonStr.lastIndexOf('}');
    
    if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
      console.error('No se encontró JSON válido en la respuesta');
      console.error('Respuesta completa:', text);
      throw new Error('No se encontró JSON en la respuesta de la IA');
    }

    jsonStr = jsonStr.substring(firstBrace, lastBrace + 1);

    // 4) Intentar parsear
    let parsed;
    try {
      parsed = JSON.parse(jsonStr);
    } catch (err) {
      console.error('JSON inválido:', err.message);
      console.error('JSON extraído (primeros 500 chars):', jsonStr.substring(0, 500));
      
      // Intentar fallback a formato de texto
      console.warn('Intentando parseResponseFlexible como fallback...');
      return this.parseResponseFlexible(text);
    }

    // 5) Validar estructura y limpiar arrays
    const ensureArray = (v) => {
      if (!Array.isArray(v)) return [];
      return v
        .map(item => String(item).trim())
        .filter(item => item.length > 2);
    };

    const terms = {
      technologies: ensureArray(parsed.technologies),
      applicationDomain: ensureArray(parsed.applicationDomain),
      thematicFocus: ensureArray(parsed.thematicFocus)
    };

    // REGLA METODOLÓGICA: NO rellenar con 'No especificado'
    // Si una categoría queda vacía, es responsabilidad del investigador definir términos manualmente
    for (const key of Object.keys(terms)) {
      if (terms[key].length === 0) {
        console.warn(`Categoría ${key} vacía - El investigador debe definir términos manualmente`);
        
        // ⚠️ EXCEPCIÓN CRÍTICA: thematicFocus nunca debe estar vacío
        // Si la IA no generó términos, sugerir términos genéricos basados en contexto académico
        if (key === 'thematicFocus') {
          console.warn('⚠️ FALLBACK ACTIVADO: Generando thematicFocus genéricos para evitar array vacío');
          terms[key] = [
            "Rendimiento - Performance",
            "Eficiencia - Efficiency",
            "Efectividad - Effectiveness"
          ];
          console.warn(' Se agregaron términos genéricos. El investigador DEBE revisarlos y personalizarlos según su PICO-O');
        }
      }
    }

    return terms;
  }

  /**
   * Parser flexible como fallback (formato de texto) - Mejorado para español y formato bilingüe
   */
  parseResponseFlexible(text) {
    const terms = {
      technologies: [],
      applicationDomain: [],
      thematicFocus: []
    };

    const lines = text.split('\n');
    let currentSection = null;

    for (const line of lines) {
      const trimmed = line.trim();

      // Detectar secciones (inglés y español)
      if (trimmed.match(/^(TECHNOLOGIES?|TECNOLOGÍAS?|TECNOLOGIES?)\s*:/i)) {
        currentSection = 'technologies';
      } else if (trimmed.match(/^(APPLICATION[_ ]DOMAIN|DOMINIO DE APLICACI[OÓ]N|DOMINIO)\s*:/i)) {
        currentSection = 'applicationDomain';
      } else if (trimmed.match(/^(THEMATIC[_ ]FOCUS|FOCOS? TEM[AÁ]TICOS?|FOCO)\s*:/i)) {
        currentSection = 'thematicFocus';
      } else if (currentSection) {
        // Detectar items: guion (-), bullet (•) o numeración (1., 2., etc.)
        const itemMatch = trimmed.match(/^[-•]\s*(.+)/) || trimmed.match(/^\d+\.\s*(.+)/);
        if (itemMatch) {
          const term = itemMatch[1].trim();
          if (term.length > 0) {
            terms[currentSection].push(term);
          }
        }
      }
    }

    return terms;
  }

  /**
   * Normaliza y valida términos (3-6 por categoría)
   */
  normalizeTerms(terms) {
    const categories = ['technologies', 'applicationDomain', 'thematicFocus'];
    
    for (const category of categories) {
      if (!Array.isArray(terms[category])) {
        terms[category] = [];
      }

      // Limpiar términos inválidos
      terms[category] = terms[category]
        .map(t => String(t).trim())
        .filter(t => t.length > 2);

      // Si tiene más de 10, truncar (límite metodología ampliado para Recall)
      if (terms[category].length > 10) {
        console.warn(`Categoría ${category} tiene ${terms[category].length} términos, truncando a 10`);
        terms[category] = terms[category].slice(0, 10);
      }

      // REGLA METODOLÓGICA: NO completar artificialmente
      // Si la IA no generó suficientes términos válidos, el investigador debe agregarlos manualmente
      if (terms[category].length < 3) {
        console.warn(`Categoría ${category} tiene solo ${terms[category].length} términos válidos`);
        console.warn(`El investigador debe revisar y agregar términos manualmente si es necesario`);
      }
    }

    return terms;
  }
}

module.exports = GenerateProtocolTermsUseCase;

