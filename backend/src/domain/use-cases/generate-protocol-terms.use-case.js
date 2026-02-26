const { GoogleGenerativeAI } = require('@google/generative-ai');

/**
 * Use Case: Generador de Términos del Protocolo
 * 
 * Genera términos clave y sinónimos para cada componente del protocolo PICO
 * para ayudar en la búsqueda bibliográfica.
 */
class GenerateProtocolTermsUseCase {
  constructor() {
    if (process.env.GEMINI_API_KEY) {
      this.gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    }
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
      
      if (!this.gemini) {
        throw new Error('Gemini no está configurado');
      }
      
      let terms = null;
      let retryCount = 0;
      const maxRetries = 2;

      while (!terms && retryCount < maxRetries) {
        try {
          const model = this.gemini.getGenerativeModel({
            model: "gemini-2.5-pro",
            generationConfig: {
              temperature: 0.4,
              maxOutputTokens: 800
            }
          });
          const result = await model.generateContent(prompt);
          const text = result.response.text();
          console.log('Respuesta raw (primeros 300 chars):', text.substring(0, 300));

          // Parsear la respuesta
          terms = this.parseResponse(text);

          // Normalizar y validar términos (3-6 por categoría)
          terms = this.normalizeTerms(terms);

        } catch (parseError) {
          retryCount++;
          console.warn(`Intento ${retryCount} falló:`, parseError.message);
          
          if (retryCount >= maxRetries) {
            throw parseError;
          }
          
          // Reintentar con instrucción más estricta
          console.log('Reintentando con temperatura más baja...');
        }
      }

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
Tu objetivo es generar términos de búsqueda bilingües (ES-EN) para construir cadenas booleanas en bases académicas.

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
INSTRUCCIONES DE GENERACIÓN
═══════════════════════════════════════════════════════════════

OBJETIVO: Maximizar la SENSIBILIDAD (Recall). Debemos encontrar TODOS los papers relevantes, incluso si usan terminología diferente.

Genera 3 categorías de términos derivados del TÍTULO y del PICO ya validado:

1. **technologies** (4-6 términos CLAVE) — Basado en PICO-I: "${I}"
   - SOLO nombres propios técnicos y conceptos clave específicos.
   - ❌ NO atomizar: Si es "MongoDB" → incluir "MongoDB", NO "Mongoose", "Schema", "Collection" como términos separados.
   - ✅ PREFERIR: Tecnologías/frameworks principales mencionados explícitamente en PICO-I.
   - Ejemplo: Si PICO-I dice "MongoDB como ODM" → términos: "MongoDB", "ODM", "NoSQL Database".
   - ❌ EVITAR términos amplios: "Database", "Software", "Technology", "System".
   - **NOMBRES PROPIOS TÉCNICOS NO SE TRADUCEN**: "MongoDB - MongoDB", "Mongoose - Mongoose".

2. **applicationDomain** (3-5 términos CLAVE) — Basado en PICO-P: "${P}"
   - Contexto/dominio específico DONDE se aplica (del PICO-P).
   - ¡CRÍTICO! KEYWORDS CORTAS (1-3 palabras máximo) y ESPECÍFICAS.
   - ❌ EVITAR frases largas: "Interacción con...", "Sistemas que utilizan...".
   - ❌ EVITAR términos muy amplios: "Software", "Technology", "Engineering".
   - ✅ PREFERIR términos concretos: "Backend Systems", "Node.js Applications", "RESTful APIs".
   - Incluir variantes técnicas si aplica (ej: "Web Services", "Microservices").
   - NO incluir variables medibles aquí.

3. **thematicFocus** (4-6 términos CLAVE, OBLIGATORIO) — Basado en PICO-O: "${O}"
   - Variables/métricas específicas que se miden (responde "¿Qué se evalúa exactamente?").
   - DEBE incluir los outcomes ESPECÍFICOS del PICO-O (ej: "Query Performance", "Response Time").
   - ❌ EVITAR términos muy amplios: "Performance" solo, "Efficiency" solo, "Quality" solo.
   - ✅ PREFERIR términos compuestos específicos: "Query Performance", "Developer Productivity", "Code Maintainability".
   - Si es comparativo, incluir "Comparative Analysis", "Trade-off Analysis".

REGLA CLAVE: 
- Nombres propios técnicos (MongoDB, React, Docker) → NO traducir, usar "Término - Término".
- Conceptos técnicos (Base de datos, Rendimiento) → traducir "Español - English".
- EVITAR atomización: 4-6 términos clave por categoría, NO listas exhaustivas de sinónimos.

═══════════════════════════════════════════════════════════════
FORMATO DE SALIDA (JSON ESTRICTO)
═══════════════════════════════════════════════════════════════

- Formato BILINGÜE en una sola línea: "Español - English" (español primero)
- **NOMBRES PROPIOS TÉCNICOS**: usar el mismo término en ambos lados ("MongoDB - MongoDB", "React - React")
- **CONCEPTOS TÉCNICOS**: traducir cuando sea relevante ("Base de datos - Database", "Rendimiento - Performance")
- Máximo 4 palabras por idioma
- Términos ESPECÍFICOS, NO genéricos
- Términos buscables en bases académicas (Scopus, IEEE, WoS, ACM)

{
  "technologies": [
    "Término 1 ES - Term 1 EN",
    "Término 2 ES - Term 2 EN",
    "Término 3 ES - Term 3 EN",
    "Término 4 ES - Term 4 EN"
  ],
  "applicationDomain": [
    "Dominio 1 ES - Domain 1 EN",
    "Dominio 2 ES - Domain 2 EN",
    "Dominio 3 ES - Domain 3 EN"
  ],
  "thematicFocus": [
    "Foco 1 ES - Focus 1 EN",
    "Foco 2 ES - Focus 2 EN",
    "Foco 3 ES - Focus 3 EN",
    "Foco 4 ES - Focus 4 EN"
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
Eres un experto en metodología PRISMA para revisiones sistemáticas. Tu tarea: regenerar ÚNICAMENTE la sección "${jsonKey}" con enfoque personalizado.

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
${jsonKey === 'technologies' ? `- Derivar de PICO-I: "${I}"
- 4-6 términos CLAVE: nombres propios técnicos específicos.
- ❌ NO atomizar: MongoDB (SÍ), Mongoose/Schema/Collection como términos separados (NO).
- Nombres propios técnicos NO se traducen: "MongoDB - MongoDB".` : ''}
${jsonKey === 'applicationDomain' ? `- Derivar de PICO-P: "${P}"
- 3-5 términos ESPECÍFICOS: contexto/dominio DONDE se aplica.
- ¡KEYWORDS CORTAS! (Backend Systems, Node.js, RESTful APIs).
- ❌ EVITAR términos amplios: "Software", "Technology", "Engineering".` : ''}
${jsonKey === 'thematicFocus' ? `- Derivar de PICO-O: "${O}"
- 4-6 métricas ESPECÍFICAS que respondan "¿Qué se mide exactamente?"
- ✅ Términos compuestos específicos: "Query Performance", "Developer Productivity".
- ❌ EVITAR términos solos muy amplios: "Performance" solo, "Efficiency" solo.
- NUNCA dejar vacío.` : ''}

FORMATO JSON (devolver las 3 categorías, solo "${jsonKey}" será usada):
{
  "technologies": ["Español - English", ...],
  "applicationDomain": ["Español - English", ...],
  "thematicFocus": ["Español - English", ...]
}

- Formato BILINGÜE: "Español - English" (español primero)
- Máximo 5 palabras por idioma
- Aplicar enfoque personalizado: ${customFocus}

RESPONDE SOLO CON EL JSON. NADA MÁS.
`.trim();
  }

  /**
   * Parsea la respuesta de la IA con parsing robusto de JSON
   */
  parseResponse(text) {
    // 1) Buscar el primer bloque JSON en el texto
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    
    if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
      console.error('No se encontró JSON válido en la respuesta');
      console.error('Respuesta completa:', text);
      throw new Error('No se encontró JSON en la respuesta de la IA');
    }

    let jsonStr = text.substring(firstBrace, lastBrace + 1);

    // 2) Limpiar backticks de markdown (```json o ```)
    jsonStr = jsonStr.replace(/```json\s*/g, '').replace(/```/g, '').trim();

    // 3) Reemplazar comillas "curly" si existen
    jsonStr = jsonStr
      .replace(/[\u2018\u2019]/g, "'")  // comillas simples curly
      .replace(/[\u201C\u201D]/g, '"'); // comillas dobles curly

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

