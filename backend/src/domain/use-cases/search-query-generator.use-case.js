const { GoogleGenerativeAI } = require('@google/generative-ai');
const {
  sanitizeTerm,
  validateIEEE,
  validateScopus,
  validatePubMed,
  basicValidateQuery,
  safeParseJSON,
  generateQueriesFromGroups
} = require('./query-sanitizer');

/**
 * Use Case: Generador de Queries de Búsqueda Académica
 * 
 * Genera queries optimizadas para bases de datos académicas
 * basándose en el protocolo PICO del proyecto.
 */
class SearchQueryGenerator {
  constructor() {
    // Inicializar OpenAI/ChatGPT
    if (process.env.GEMINI_API_KEY) {
      this.gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    }
  }

  /**
   * Genera queries de búsqueda para múltiples bases de datos
   */
  async generate({ databases = ['scopus', 'ieee'], picoData = {}, protocolTerms = {}, researchArea = '', matrixData = {}, aiProvider = 'chatgpt', yearStart, yearEnd, selectedTitle }) {
    try {
      console.log('Generando queries de búsqueda...');
      console.log('Título RSL:', selectedTitle || 'No especificado');
      console.log('Rango temporal recibido: yearStart =', yearStart, ', yearEnd =', yearEnd);

      const prompt = this.buildPrompt({ databases, picoData, protocolTerms, researchArea, matrixData, yearStart, yearEnd, selectedTitle });
      
      let text;
      if (this.gemini) {
        const model = this.gemini.getGenerativeModel({
          model: 'gemini-2.5-pro',
          generationConfig: { temperature: 0.7 }
        });
        const result = await model.generateContent(prompt);
        text = result.response.text();
      } else {
        throw new Error('No hay proveedor de IA configurado (OpenAI API Key requerida)');
      }

      console.log('Respuesta COMPLETA de IA para búsquedas:');
      console.log('='.repeat(80));
      console.log(text);
      console.log('='.repeat(80));
      console.log(`Bases de datos solicitadas (${databases.length}):`, databases);

      // Parsear la respuesta
      const queries = this.parseResponse(text, databases, yearStart, yearEnd);
      
      console.log(`Resultado del parseo: ${queries.length} queries de ${databases.length} solicitadas`);
      
      // Verificar si faltan queries
      if (queries.length < databases.length) {
        console.warn(`PROBLEMA: Faltan ${databases.length - queries.length} queries`);
        const generatedDbs = queries.map(q => q.database.toLowerCase());
        const missingDbs = databases.filter(db => !generatedDbs.includes(db.toLowerCase()));
        console.warn(`Bases de datos faltantes: ${missingDbs.join(', ')}`);
      }

      console.log('Queries generadas exitosamente');
      console.log('   Total queries:', queries.length);

      return {
        success: true,
        data: {
          queries,
          metadata: {
            databases: databases,
            generatedAt: new Date().toISOString()
          }
        }
      };

    } catch (error) {
      console.error('Error generando queries:', error);
      throw new Error(`Error generando queries de búsqueda: ${error.message}`);
    }
  }

  /**
   * Construye el prompt consumiendo datos ya validados de pasos anteriores
   */
  buildPrompt({ databases, picoData, protocolTerms, researchArea, matrixData, yearStart, yearEnd, selectedTitle }) {
    // Extraer términos del protocolo (ya confirmados por el investigador en pasos anteriores)
    const technologies = protocolTerms?.tecnologia || protocolTerms?.technologies || [];
    const domains = protocolTerms?.dominio || protocolTerms?.applicationDomain || [];
    const themes = protocolTerms?.focosTematicos || protocolTerms?.thematicFocus || [];

    // Normalizar PICO outcome (frontend envía 'outcome' singular, legacy usa 'outcomes')
    const picoOutcome = picoData?.outcome || picoData?.outcomes || 'No especificado';

    return `Eres un Metadata Specialist y Bibliotecario Académico experto en Revisiones Sistemáticas (RSL) bajo PRISMA 2020. Tu tarea es traducir un protocolo de investigación en cadenas de búsqueda (Search Strings) BALANCEADAS, precisas y reproducibles.

═══════════════════════════════════════════════════════════════
DATOS DEL PROTOCOLO (ya validados en pasos anteriores — usar tal cual)
═══════════════════════════════════════════════════════════════

TÍTULO RSL: "${selectedTitle || 'No definido'}"

MARCO PICO (ya definido y editado por el investigador):
- P (Población/Contexto): ${picoData?.population || 'No especificado'}
- I (Intervención/Tecnología): ${picoData?.intervention || 'No especificado'}
- C (Comparación): ${picoData?.comparison || 'N/A'}
- O (Outcomes/Resultados): ${picoOutcome}

TÉRMINOS DEL PROTOCOLO (ya confirmados por el investigador):
- Tecnología (I): ${technologies.length ? technologies.join(' | ') : 'No especificado'}
- Dominio (P): ${domains.length ? domains.join(' | ') : 'No especificado'}
- Focos temáticos (O): ${themes.length ? themes.join(' | ') : 'No especificado'}
${picoData?.comparison && picoData.comparison.trim() && picoData.comparison !== 'N/A' && picoData.comparison !== 'No especificado' ? 
`- Comparación (C): ${picoData.comparison}` : ''}

RANGO TEMPORAL: ${yearStart && yearEnd ? `${yearStart}-${yearEnd}` : 'No especificado'}

═══════════════════════════════════════════════════════════════
REGLAS DE BALANCEO AND/OR (CRÍTICAS — LEER ANTES DE GENERAR)
═══════════════════════════════════════════════════════════════

⚠️ EL ERROR MÁS COMÚN: Saturar de OR cada bloque listando TODOS los sinónimos posibles.
Más OR = Mayor sensibilidad PERO mucho ruido (resultados irrelevantes).
Más AND = Mayor precisión PERO riesgo de perder estudios.

REGLA 1 — MÁXIMO 3 TÉRMINOS OR POR BLOQUE (IEEE: MÁXIMO 2):
  Prioriza términos "paraguas" (hiperónimos) que engloban subcategorías.
  
  ⚠️ LÍMITES CRÍTICOS POR PLATAFORMA:
  - IEEE Xplore: MÁXIMO 10 TÉRMINOS TOTALES en toda la query (incluye AND/OR)
    → Usar MÁXIMO 2 términos por bloque: 2+2+2+2 = 8 términos ✅
  - ScienceDirect: MÁXIMO 3-4 términos por grupo OR
  - Scopus/WoS: MÁXIMO 3 términos por bloque (total ~12 términos)
  
  ✅ CORRECTO: ("artificial intelligence" OR "machine learning")
  ❌ INCORRECTO: ("AI" OR "artificial intelligence" OR "machine learning" OR "deep learning" OR "neural networks" OR "CNN" OR "random forest")
  Razón: "machine learning" ya indexa estudios de DL, CNN, etc. en la mayoría de motores.

REGLA 2 — UN TÉRMINO CORE OBLIGATORIO POR BLOQUE:
  Cada bloque debe tener un término altamente específico que NO se negocia.
  ✅ CORRECTO: strawberry* AND ("machine learning" OR "computer vision")
  ❌ INCORRECTO: (strawberry OR raspberry OR blueberry) AND (AI OR ML OR DL OR CNN OR sensor)

REGLA 3 — USAR WILDCARDS (*) EN VEZ DE MÚLTIPLES OR:
  Donde la base lo soporte (Scopus, WoS), usar truncamiento.
  ✅ CORRECTO: agricultur* → captura: agriculture, agricultural
  ❌ INCORRECTO: ("agriculture" OR "agricultural" OR "agriculturist")
  Nota: IEEE Xplore NO soporta wildcards — allí usar los 2-3 términos más comunes.

REGLA 4 — NO INCLUIR TÉRMINOS REDUNDANTES:
  Si un término genérico ya cubre al específico, NO incluir ambos.
  ✅ "machine learning" (ya incluye deep learning en indexación)
  ❌ "machine learning" OR "deep learning" OR "neural networks" OR "supervised learning"
  Excepción: Si el estudio se enfoca ESPECÍFICAMENTE en un subtipo (ej: solo CNN), sí usar el término específico.

REGLA 5 — BLOQUE O (OUTCOMES) LIMITADO A 2 INDICADORES PRINCIPALES:
  El bloque de resultados debe contener SOLO los outcomes más críticos y medibles.
  ✅ CORRECTO: (yield OR "pest control")
  ❌ INCORRECTO: (yield OR productivity OR effectiveness OR "pest reduction" OR "pesticide usage" OR performance)

REGLA 6 — ELIMINAR TÉRMINOS QUE GENERAN RUIDO:
  Si un término es demasiado genérico y el contexto ya está cubierto por otro bloque, eliminarlo.
  ✅ Incluir: "strawberry cultivation" (específico)
  ❌ Excluir: "agriculture" (demasiado amplio si ya tienes "strawberry")

═══════════════════════════════════════════════════════════════
PROCESO DE SELECCIÓN DE TÉRMINOS
═══════════════════════════════════════════════════════════════

Para cada bloque, sigue este proceso:
1. De los términos del protocolo, identifica el TÉRMINO CORE (el más representativo)
2. Agrega MÁXIMO 1-2 sinónimos directos o el nombre científico/técnico alternativo
3. Si hay más de 3 opciones, elige los más usados en literatura académica indexada
4. Usa wildcards (*) para cubrir variantes morfológicas (solo en bases que lo soporten)
5. Los términos descartados deben mencionarse en EXPLANATION como "excluidos por redundancia"

═══════════════════════════════════════════════════════════════
ESTRUCTURA DE CADA QUERY
═══════════════════════════════════════════════════════════════

⚠️ AJUSTAR NÚMERO DE TÉRMINOS SEGÚN PLATAFORMA:

**ESTRUCTURA PICO COMPLETA:**
${picoData?.comparison && picoData.comparison.trim() && picoData.comparison !== 'N/A' && picoData.comparison !== 'No especificado' ? 
'(Bloque I: Intervención) AND (Bloque P: Población) AND (Bloque C: Comparación) AND (Bloque O: Outcomes)' : 
'(Bloque I: Intervención) AND (Bloque P: Población) AND (Bloque O: Outcomes)'}

**IEEE Xplore (RESTRICTIVO - MÁXIMO 10 TÉRMINOS TOTALES):**
${picoData?.comparison && picoData.comparison.trim() && picoData.comparison !== 'N/A' && picoData.comparison !== 'No especificado' ? 
'(Bloque I: 2 términos) AND (Bloque P: 2 términos) AND (Bloque C: 2 términos) AND (Bloque O: 2 términos)\nResultado: 2×2×2×2 = 8 términos ✅' : 
'(Bloque I: 2 términos) AND (Bloque P: 2 términos) AND (Bloque O: 2 términos)\nResultado: 2×2×2 = 8 términos ✅'}

**ScienceDirect (MODERADO - 3-4 TÉRMINOS POR GRUPO):**
${picoData?.comparison && picoData.comparison.trim() && picoData.comparison !== 'N/A' && picoData.comparison !== 'No especificado' ? 
'(Bloque I: 3 términos) AND (Bloque P: 3 términos) AND (Bloque C: 3 términos) AND (Bloque O: 3 términos)\nResultado: 3×3×3×3 = 12 términos' : 
'(Bloque I: 3-4 términos) AND (Bloque P: 3-4 términos) AND (Bloque O: 3-4 términos)\nResultado: 3×3×3 = 9 a 4×4×4 = 16 términos'}

**Scopus/WoS/ACM (ESTÁNDAR):**
${picoData?.comparison && picoData.comparison.trim() && picoData.comparison !== 'N/A' && picoData.comparison !== 'No especificado' ? 
'(Bloque I: 2-3 términos) AND (Bloque P: 2-3 términos) AND (Bloque C: 2-3 términos) AND (Bloque O: 2-3 términos)\nResultado: 2×2×2×2 = 8 a 3×3×3×3 = 16 términos' : 
'(Bloque I: 2-3 términos) AND (Bloque P: 2-3 términos) AND (Bloque O: 2-3 términos)\nResultado: 2×2×2 = 8 a 3×3×3 = 12 términos'}

═══════════════════════════════════════════════════════════════
SINTAXIS ESTRICTA POR BASE DE DATOS E INSTRUCCIONES FORMALES
═══════════════════════════════════════════════════════════════

REGLAS GLOBALES DE FORMATEO (APLICAN A TODAS LAS BASES):
1. **Gestión de Comillas:** TODO término compuesto (de 2 o más palabras, ej. "Native Driver", "Machine Learning", "Node.js") DEBE ir obligatoriamente entre comillas dobles ("") para garantizar búsqueda de frase exacta.
2. **Wildcards Inteligentes:** Emplea el asterisco (*) al final de raíces clave (ej. benchmark*, efficien*, optimiz*) para expandir a variantes morfológicas en bases compatibles (Scopus, ACM, Web of Science, PubMed).

${databases.map(db => {
  const dbLower = db.toLowerCase();
  if (dbLower === 'ieee' || dbLower === 'ieee xplore') return `**IEEE Xplore:** ⚠️ REGLA CRÍTICA SINTÁCTICA: Asegura el **doble paréntesis** envolviendo grupos complejos para evitar errores del motor de interpretación. Ejemplo: (("A" OR "B") AND ("C" OR "D")). NO usa wildcards (*). Máximo 10 términos totales.${yearStart ? ' Filtro temporal en la interfaz.' : ''}`;
  if (dbLower === 'scopus') return `**Scopus:** ⚠️ REGLA CRÍTICA SINTÁCTICA: Debes envolver TODA la consulta con el operador restrictivo **TITLE-ABS-KEY(...)**. Sí soporta wildcards (*).${yearStart && yearEnd ? ` ⚠️ Filtro de año INYECTADO ESTRICTAMENTE (AND PUBYEAR > ${yearStart - 1} AND PUBYEAR < ${yearEnd + 1}).` : ''}`;
  if (dbLower === 'pubmed') return `**PubMed:** Usar [Title/Abstract]. Soporta wildcards (*).${yearStart ? ' Filtro temporal en interfaz.' : ''}`;
  if (dbLower === 'webofscience' || dbLower === 'web of science') return `**Web of Science:** Formato TS=((...bloques...)). Soporta wildcards (*).${yearStart && yearEnd ? ` AND PY=(${yearStart}-${yearEnd})` : ''}`;
  if (dbLower === 'google_scholar' || dbLower === 'google scholar') return `**Google Scholar:** Búsqueda abierta, sin etiquetas complejas. NO comodines.${yearStart ? ' Filtro temporal en interfaz.' : ''}`;
  if (dbLower === 'acm') return `**ACM Digital Library:** Query con paréntesis de prioridad simple. MUY recomendado usar wildcards (*) en la raíz de térmnos ingenieriles.${yearStart ? ' Filtro temporal en interfaz.' : ''}`;
  if (dbLower === 'sciencedirect' || dbLower === 'science direct') return `**ScienceDirect:** ⚠️ LÍMITE INFRAESTRUCTURA: Mantén la cadena por debajo de los **8 conectores booleanos** en total (suma de ANDs + ORs) para prevenir cuelgues del sistema de Elsevier. Simplifica al máximo.${yearStart ? ' Filtro temporal en interfaz.' : ''}`;
  return `**${db}:** Formato condicional estándar. Máximo 4 términos por bloque.${yearStart ? ' Filtro temporal en interfaz.' : ''}`;
}).join('\n')}

═══════════════════════════════════════════════════════════════
FORMATO DE RESPUESTA (TEXTO PLANO, SIN MARKDOWN)
═══════════════════════════════════════════════════════════════

DATABASE: [Nombre exacto]
QUERY: [Cadena completa en una sola línea]
EXPLANATION: [Términos incluidos con origen PICO + términos EXCLUIDOS por redundancia y por qué]

---

GENERAR EXACTAMENTE ${databases.length} QUERIES para:
${databases.map((db, i) => `${i + 1}. ${db}`).join('\n')}

⚠️ REGLAS FINALES CRÍTICAS:
- UNA query por CADA base (${databases.length} total)
- NO omitir ninguna, NO generar extras
- Cada QUERY en una línea continua (sin saltos)
- La LÓGICA CONCEPTUAL debe ser idéntica entre bases — solo cambia la SINTAXIS
- IEEE: MÁXIMO 2 términos OR por bloque (total ≤ 10 términos)
- ScienceDirect: MÁXIMO 3-4 términos por grupo OR
- Otras bases: MÁXIMO 3 términos OR por bloque
- Wildcards (*) solo donde la base lo soporte (NO en IEEE)

⚠️ RECORDATORIOS PARA EXPLICACIÓN:
- Scopus/WoS: Mencionar que se debe filtrar por Subject Area (Computer Science/Engineering) en interfaz
- IEEE: Mencionar conteo de términos y verificación de paréntesis
- ScienceDirect: Confirmar que no se exceden 3-4 términos por grupo

GENERA LAS ${databases.length} CADENAS DE BÚSQUEDA BALANCEADAS AHORA:
`;
  }

  /**
   * Normaliza el nombre de una base de datos para matching
   */
  normalizeDatabaseName(dbName) {
    // Map de aliases comunes
    const aliases = {
      'ieee xplore': 'ieee',
      'ieee': 'ieee',
      'web of science': 'webofscience',
      'webofscience': 'webofscience',
      'web_of_science': 'webofscience',
      'scopus': 'scopus',
      'acm': 'acm',
      'acm digital library': 'acm',
      'springer': 'springer',
      'springerlink': 'springer',
      'pubmed': 'pubmed',
      'google scholar': 'google_scholar',
      'google_scholar': 'google_scholar',
      'sciencedirect': 'sciencedirect',
      'science direct': 'sciencedirect'
    };

    const normalized = dbName.toLowerCase().trim();
    return aliases[normalized] || normalized.replace(/\s+/g, '_');
  }

  /**
   * Parsea y sanitiza la respuesta de la IA con resilencia a múltiples formatos
   */
  parseResponse(text, databases, yearStart, yearEnd) {
    console.log('Parseando queries de búsqueda...');
    console.log(`Total de líneas a parsear: ${text.split('\n').length}`);
    console.log(`Bases de datos solicitadas: ${databases.join(', ')}`);

    // Eliminar bloques de código markdown si la IA los incluyó por error
    const cleanText = text.replace(/```[a-z]*\n/g, '').replace(/```/g, '');
    
    const queries = [];
    const requestedDatabaseIds = databases.map(db => this.normalizeDatabaseName(db));
    console.log(`IDs normalizados: ${requestedDatabaseIds.join(', ')}`);

    // Dividir por bloques usando DATABASE: como separador
    const blocks = cleanText.split(/DATABASE\s*:/i).filter(b => b.trim());

    for (const block of blocks) {
      const lines = block.split('\n');
      const dbName = lines[0].trim();
      
      // Buscar la línea que empieza con QUERY:
      const queryLine = lines.find(l => l.toUpperCase().startsWith('QUERY:'));
      const explanationLine = lines.find(l => l.toUpperCase().startsWith('EXPLANATION:'));

      if (dbName && queryLine) {
        const parsedQuery = {
          database: dbName,
          query: queryLine.replace(/QUERY\s*:/i, '').trim(),
          explanation: explanationLine ? explanationLine.replace(/EXPLANATION\s*:/i, '').trim() : ''
        };
        
        // Si la query se cortó, buscar líneas siguientes
        const queryIndex = lines.findIndex(l => l.toUpperCase().startsWith('QUERY:'));
        const explanationIndex = lines.findIndex(l => l.toUpperCase().startsWith('EXPLANATION:'));
        
        // Concatenar líneas adicionales de query (hasta EXPLANATION o fin de bloque)
        if (queryIndex !== -1) {
          const endIndex = explanationIndex !== -1 ? explanationIndex : lines.length;
          for (let i = queryIndex + 1; i < endIndex; i++) {
            const line = lines[i].trim();
            if (line && !line.match(/^---+$/) && !line.toUpperCase().startsWith('DATABASE:')) {
              parsedQuery.query += ' ' + line;
            }
          }
        }
        
        queries.push(parsedQuery);
        console.log(`Query parseada para: ${dbName}`);
      }
    }

    console.log(`Total queries parseadas (antes de filtrar): ${queries.length}`);
    console.log(`Queries parseadas:`, queries.map(q => q.database).join(', '));

    // Filtrar: Solo queries para bases de datos solicitadas
    const filteredQueries = queries.filter(q => {
      const normalizedDbName = this.normalizeDatabaseName(q.database);
      const isRequested = requestedDatabaseIds.includes(normalizedDbName);
      
      console.log(`Verificando "${q.database}" -> normalizado: "${normalizedDbName}" -> ${isRequested ? 'INCLUIDA' : 'DESCARTADA'}`);
      
      if (!isRequested) {
        console.log(`Descartando query no solicitada: ${q.database}`);
      }
      
      return isRequested;
    });

    console.log(`Total queries FILTRADAS: ${filteredQueries.length}`);
    console.log(`Queries filtradas:`, filteredQueries.map(q => q.database).join(', '));

    // Si no se parseó correctamente, usar fallback
    if (filteredQueries.length === 0) {
      console.warn('No se parsearon queries válidas, generando básicas como fallback');
      return this.generateBasicQueries(databases);
    }

    // SANITIZACIÓN Y VALIDACIÓN
    const sanitizedQueries = [];
    for (const q of filteredQueries) {
      // Limpieza básica
      q.query = q.query.trim().replace(/^(`+)/, '').replace(/(`+)$/, '').replace(/\s+/g, ' ');
      q.explanation = q.explanation.trim();
      
      const dbLower = q.database.toLowerCase();
      
      // Validación específica por base de datos
      if (dbLower === 'ieee') {
        console.log(`Validando IEEE query...`);
        while (!validateIEEE(q.query) && q.query.includes(' AND ')) {
          console.warn(`IEEE query inválida, reduciendo grupos AND...`);
          const parts = q.query.split(/\s+AND\s+/i);
          parts.pop();
          q.query = parts.join(' AND ');
        }
        console.log(`IEEE query validada`);
      } else if (dbLower === 'scopus') {
        if (!validateScopus(q.query)) {
          console.warn(`Scopus query sin TITLE-ABS-KEY, corrigiendo...`);
          if (!q.query.startsWith('TITLE-ABS-KEY')) {
            q.query = `TITLE-ABS-KEY(${q.query})`;
          }
        }
        
        // Agregar filtro temporal si falta
        if (yearStart && yearEnd && !q.query.includes('PUBYEAR')) {
          console.warn(`Scopus query sin filtro temporal, agregando PUBYEAR...`);
          q.query = `${q.query} AND PUBYEAR > ${yearStart - 1} AND PUBYEAR < ${yearEnd + 1}`;
          console.log(`Filtro temporal agregado: PUBYEAR > ${yearStart - 1} AND PUBYEAR < ${yearEnd + 1}`);
        }
      } else if (dbLower === 'pubmed') {
        if (!validatePubMed(q.query)) {
          console.warn(`PubMed query sin campos, agregando [Title/Abstract]...`);
          // Intento básico de corrección
          q.query = q.query.replace(/\b(\w+)\b/g, '$1[Title/Abstract]');
        }
      } else {
        // Validación básica para otras bases
        if (!basicValidateQuery(q.query)) {
          console.warn(`Query inválida para ${q.database}, aplicando limpieza...`);
          q.query = q.query.replace(/[{}\[\]^~?<>]/g, '');
        }
      }
      
      sanitizedQueries.push(q);
    }

    return sanitizedQueries;
  }

  /**
   * Genera queries básicas como fallback
   */
  generateBasicQueries(databases) {
    return databases.map(db => ({
      database: db,
      query: 'TITLE-ABS-KEY("systematic review")',
      explanation: 'Query básica generada como fallback'
    }));
  }
}

module.exports = SearchQueryGenerator;

