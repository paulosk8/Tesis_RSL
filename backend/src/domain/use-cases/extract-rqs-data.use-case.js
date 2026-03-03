/**
 * Use Case: Extract RQS Data from PDFs
 * 
 * Extrae datos estructurados (RQS) de estudios incluidos usando IA,
 * analizando los PDFs completos para llenar el esquema de investigación.
 * 
 * IMPORTANTE: Solo analiza referencias con screeningStatus='included' o 'fulltext_included'
 */
const RQSEntry = require('../models/rqs-entry.model');
const fs = require('node:fs');
const path = require('node:path');

class ExtractRQSDataUseCase {
  constructor({
    rqsEntryRepository,
    referenceRepository,
    protocolRepository,
    aiService
  }) {
    this.rqsEntryRepository = rqsEntryRepository;
    this.referenceRepository = referenceRepository;
    this.protocolRepository = protocolRepository;
    this.aiService = aiService;
  }

  /**
   * Extraer RQS para todas las referencias incluidas de un proyecto
   */
  async execute(projectId, userId) {
    try {
      console.log(`📊 Extrayendo datos RQS para proyecto ${projectId}`);

      // 1. Obtener protocolo para RQs
      const protocol = await this.protocolRepository.findByProjectId(projectId);
      if (!protocol) {
        throw new Error('Protocolo no encontrado');
      }

      const researchQuestions = protocol.researchQuestions || [];

      // 2. Obtener referencias incluidas
      const references = await this.referenceRepository.findByProject(projectId);
      const includedReferences = references.filter(ref => 
        ref.screeningStatus === 'included' || 
        ref.screeningStatus === 'fulltext_included'
      );

      if (includedReferences.length === 0) {
        return {
          success: true,
          message: 'No hay referencias incluidas para extraer',
          extracted: 0
        };
      }

      console.log(`📄 Procesando ${includedReferences.length} referencias incluidas`);

      // 3. Extraer RQS para cada referencia
      const extracted = [];
      const errors = [];

      for (const reference of includedReferences) {
        try {
          // Verificar si ya existe entrada RQS
          const existing = await this.rqsEntryRepository.findByReference(reference.id);
          if (existing) {
            console.log(`⏭️  Saltando referencia ${reference.id} (ya tiene RQS)`);
            continue;
          }

          console.log(`🔍 Extrayendo RQS para: ${reference.title}`);

          // Extraer datos con IA
          const rqsData = await this.extractFromReference(reference, researchQuestions);

          // Crear instancia del modelo RQSEntry
          const rqsEntry = new RQSEntry({
            projectId: projectId,
            referenceId: reference.id,
            
            author: rqsData.author || reference.authors || 'Unknown',
            year: rqsData.year || reference.year || new Date().getFullYear(),
            title: reference.title,
            source: reference.journal || reference.source || '',
            
            studyType: rqsData.studyType,
            technology: rqsData.technology,
            context: rqsData.context,
            
            keyEvidence: rqsData.keyEvidence,
            metrics: rqsData.metrics,
            
            rq1Relation: rqsData.rq1Relation,
            rq2Relation: rqsData.rq2Relation,
            rq3Relation: rqsData.rq3Relation,
            rqNotes: rqsData.rqNotes,
            
            limitations: rqsData.limitations,
            qualityScore: rqsData.qualityScore,
            
            extractionMethod: 'ai_assisted',
            extractedBy: userId,
            extractedAt: new Date(),
            validated: false
          });

          // Guardar en base de datos
          const savedEntry = await this.rqsEntryRepository.create(rqsEntry);
          extracted.push(savedEntry);
          console.log(`✅ RQS extraído para referencia ${reference.id}`);

        } catch (error) {
          console.error(`❌ Error extrayendo RQS para referencia ${reference.id}:`, error.message);
          errors.push({
            referenceId: reference.id,
            title: reference.title,
            error: error.message
          });
        }
      }

      return {
        success: true,
        extracted: extracted.length,
        errors: errors.length,
        details: {
          processed: includedReferences.length,
          successful: extracted.length,
          failed: errors.length,
          errorDetails: errors
        }
      };

    } catch (error) {
      console.error('❌ Error en extracción RQS:', error);
      throw error;
    }
  }

  /**
   * Extraer texto de PDF si está disponible
   */
  async extractTextFromPDF(pdfPath) {
    try {
      console.log(`📄 Leyendo PDF: ${pdfPath}`);
      const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
      const dataBuffer = fs.readFileSync(pdfPath);
      const loadingTask = pdfjsLib.getDocument({
        data: new Uint8Array(dataBuffer),
        useWorkerFetch: false,
        isEvalSupported: false,
        useSystemFonts: true
      });
      const pdfDoc = await loadingTask.promise;
      let text = '';
      for (let i = 1; i <= pdfDoc.numPages; i++) {
        const page = await pdfDoc.getPage(i);
        const content = await page.getTextContent();
        text += content.items.map(item => item.str).join(' ') + '\n';
      }
      console.log(`✅ PDF leído exitosamente (${pdfDoc.numPages} páginas, ${text.length} caracteres)`);
      return text;
    } catch (error) {
      console.error(`❌ Error leyendo PDF ${pdfPath}:`, error);
      return null;
    }
  }

  /**
   * Convierte fullTextUrl (URL del backend) a ruta de archivo local
   */
  getLocalPdfPath(fullTextUrl) {
    if (!fullTextUrl) return null;
    
    // Extraer filename de la URL: http://localhost:3001/uploads/pdfs/ref-xxx.pdf
    const filename = fullTextUrl.split('/').pop();
    
    // Construir ruta local desde backend root (la DB guarda la URL con pdfs, multer guarda en pdfs)
    return path.resolve(__dirname, '../../../uploads/pdfs/', filename);
  }

  /**
   * Extraer datos RQS de una referencia usando IA
   */
  async extractFromReference(reference, researchQuestions) {
    // Intentar leer PDF completo si está disponible
    let fullText = null;
    if (reference.fullTextUrl) {
      const fullPath = this.getLocalPdfPath(reference.fullTextUrl);
      
      if (fullPath && fs.existsSync(fullPath)) {
        console.log(`📄 Leyendo PDF para RQS: ${reference.title?.substring(0, 50)}...`);
        fullText = await this.extractTextFromPDF(fullPath);
        console.log(`✅ PDF leído exitosamente (${fullText?.length || 0} caracteres)`);
      } else {
        console.warn(`⚠️ PDF no encontrado en: ${fullPath || 'ruta no generada'}`);
        console.warn(`   URL original: ${reference.fullTextUrl}`);
      }
    } else {
      console.log(`ℹ️ No hay PDF cargado para: ${reference.title?.substring(0, 50)}...`);
    }

    const systemPrompt = this.getSystemPrompt();
    const userPrompt = this.getUserPrompt(reference, researchQuestions, fullText);

    try {
      const response = await this.aiService.generateText(
        systemPrompt,
        userPrompt,
        'chatgpt' // Usar ChatGPT para extracción estructurada
      );

      // Parsear respuesta JSON si es string, o usar directamente si ya es objeto
      let data;
      if (typeof response === 'string') {
        try {
          // Remove Markdown block formatting if Gemini wraps it in ```json ... ```
          let cleanJson = response.trim();
          if (cleanJson.startsWith('```json')) {
            cleanJson = cleanJson.replace(/^```json\s*/i, '').replace(/\s*```$/i, '');
          } else if (cleanJson.startsWith('```')) {
            cleanJson = cleanJson.replace(/^```\s*/i, '').replace(/\s*```$/i, '');
          }
          data = JSON.parse(cleanJson);
        } catch (parseError) {
          console.error('Error parseando JSON string:', parseError);
          console.error('Respuesta recibida:', response);
          throw new Error('La respuesta de la IA no es JSON válido');
        }
      } else if (typeof response === 'object' && response !== null) {
        data = response;
      } else {
        throw new Error(`Tipo de respuesta inesperado: ${typeof response}`);
      }

      // ✅ SANITIZAR valores de enum antes de retornar
      const sanitizedStudyType = this.sanitizeEnumValue(
        data.studyType, 
        ['empirical', 'case_study', 'experiment', 'simulation', 'review', 'other'],
        'other'
      );
      
      const sanitizedContext = this.sanitizeEnumValue(
        data.context,
        ['industrial', 'enterprise', 'academic', 'experimental', 'mixed', 'other'],
        'other'
      );

      // Registrar si hubo cambios
      if (data.studyType !== sanitizedStudyType) {
        console.log(`📝 Mapeado studyType: "${data.studyType}" → "${sanitizedStudyType}" (${reference.title?.substring(0, 50)}...)`);
      }
      if (data.context !== sanitizedContext) {
        console.log(`📝 Mapeado context: "${data.context}" → "${sanitizedContext}" (${reference.title?.substring(0, 50)}...)`);
      }
      
      return {
        author: data.author,
        year: data.year,
        studyType: sanitizedStudyType,
        technology: data.technology,
        context: sanitizedContext,
        keyEvidence: data.keyEvidence,
        metrics: data.metrics || {},
        rq1Relation: data.rq1Relation,
        rq2Relation: data.rq2Relation,
        rq3Relation: data.rq3Relation,
        rqNotes: data.rqNotes,
        limitations: data.limitations,
        qualityScore: data.qualityScore
      };

    } catch (error) {
      console.error('Error parseando respuesta IA:', error);
      throw new Error('No se pudo extraer datos estructurados del estudio');
    }
  }

  /**
   * Sanitiza valores de enum mapeando valores de IA a valores permitidos por BD
   */
  sanitizeEnumValue(value, allowedValues, defaultValue = 'other') {
    if (!value) return defaultValue;
    
    const normalized = value.toLowerCase().trim().replaceAll('_', ' ');
    
    // 1. Coincidencia exacta (considerando que BD usa snake_case)
    const normalizedWithUnderscore = normalized.replaceAll(' ', '_');
    if (allowedValues.includes(normalizedWithUnderscore)) {
      return normalizedWithUnderscore;
    }
    
    // 2. Coincidencia parcial (fuzzy matching)
    for (const allowed of allowedValues) {
      if (normalized.includes(allowed.replaceAll('_', ' ')) || 
          allowed.replaceAll('_', ' ').includes(normalized)) {
        return allowed;
      }
    }
    
    // 3. Mapeos específicos conocidos (basados en errores reales de logs)
    const studyTypeMap = {
      'case studies': 'case_study',
      'case-study': 'case_study',
      'empirical study': 'empirical',
      'experimental study': 'experiment',
      'systematic review': 'review',
      'literature review': 'review',
      'survey': 'review'
    };
    
    const contextMap = {
      'technological perspective': 'academic',
      'background concepts': 'academic',
      'core concepts': 'academic',
      'theoretical': 'academic',
      'theory': 'academic',
      'research': 'academic',
      'laboratory': 'experimental',
      'lab': 'experimental',
      'real-world': 'industrial',
      'production': 'industrial',
      'business': 'enterprise',
      'corporate': 'enterprise',
      'company': 'enterprise'
    };
    
    // Buscar en mapeos específicos
    const allMaps = { ...studyTypeMap, ...contextMap };
    if (allMaps[normalized]) {
      return allMaps[normalized];
    }
    
    // 4. Default (previene violación de constraint)
    console.warn(`⚠️ Valor enum no reconocido "${value}", usando "${defaultValue}"`);
    return defaultValue;
  }

  /**
   * System Prompt para extracción RQS
   */
  getSystemPrompt() {
    return `Eres un EXTRACTOR EXPERTO de datos para revisiones sistemáticas en ingeniería/tecnología.

Tu tarea es ANALIZAR el estudio proporcionado y extraer información estructurada siguiendo el esquema RQS (Research Question Schema).

REGLAS OBLIGATORIAS:
1. ❌ NO inventes datos que no estén en el abstract/title
2. ❌ NO especules sobre tecnologías o métricas no mencionadas
3. ✅ Extrae SOLO lo explícitamente declarado en el texto
4. ✅ Si algo no está claro, usa "Unknown" o null
5. ✅ Sé preciso con tecnologías (nombres exactos: "5G", "MongoDB", "SDN")
6. ✅ Clasifica el tipo de estudio correctamente (empirical, case_study, experiment, simulation, review)
7. ✅ Identifica el contexto de aplicación (industrial, enterprise, academic, experimental)
8. ✅ Extrae métricas específicas reportadas (latencia, throughput, eficiencia, etc.)

FORMATO DE SALIDA: JSON estricto, sin texto adicional.`;
  }

  /**
   * User Prompt para extracción RQS
   */
  getUserPrompt(reference, researchQuestions, fullText = null) {
    const rqList = researchQuestions.map((rq, index) => 
      `RQ${index + 1}: ${rq}`
    ).join('\n');

    const contentSource = fullText 
      ? `**TEXTO COMPLETO DEL PDF:**\n${fullText.substring(0, 15000)}...\n\n(Texto truncado para análisis)\n\n⚠️ **PRIORIZA LA SECCIÓN DE RESULTADOS:** Busca específicamente en las secciones "Results", "Findings", "Experimental Results", "Evaluation" del artículo para extraer datos cuantitativos, métricas y evidencia empírica.` 
      : `**ABSTRACT:** ${reference.abstract || 'No disponible'}`;

    return `Extrae datos estructurados (RQS) del siguiente estudio:

**TÍTULO:** ${reference.title}
**AUTORES:** ${reference.authors || 'No disponible'}
**AÑO:** ${reference.year || 'No disponible'}
**FUENTE:** ${reference.journal || reference.source || 'No disponible'}
${contentSource}

**PREGUNTAS DE INVESTIGACIÓN DEL PROYECTO:**
${rqList || 'No definidas'}

---

EXTRAE los siguientes campos y responde SOLO con JSON:

**INSTRUCCIÓN CRÍTICA PARA RELACIONES CON RQs:**

⚠️ EVALÚA CUIDADOSAMENTE la relación del estudio con CADA pregunta de investigación:

- **"yes"** (directa): El estudio aborda EXPLÍCITAMENTE la pregunta y proporciona respuestas completas
- **"partial"** (parcial): El estudio menciona temas RELACIONADOS pero no responde completamente
- **"no"** (sin relación): El estudio NO aborda la pregunta en absoluto

🔍 **CÓMO EVALUAR:**

1. **RQ1** - Si la pregunta es sobre técnicas/métodos:
   - Busca: authentication, encryption, monitoring, blockchain, security frameworks
   - Si menciona alguna técnica específica → "partial" o "yes"

2. **RQ2** - Si la pregunta es sobre gestión de vulnerabilidades/amenazas:
   - Busca: detection, prevention, audit, incident response, risk management
   - Si describe cómo se gestionan amenazas → "partial" o "yes"

3. **RQ3** - Si la pregunta es sobre efectividad/evidencia:
   - Busca: metrics, latency, efficiency, performance, comparisons
   - Si reporta datos cuantitativos → "partial" o "yes"

❌ NO marques todo como "no". Si el estudio es relevante para el tema general, al menos una RQ debe tener "partial".

---

{
  "author": "Apellido, Nombre et al.",
  "year": 2024,
  "studyType": "empirical | case_study | experiment | simulation | review | other",
  "technology": "Tecnología principal evaluada (ej: 5G, MongoDB, Kubernetes)",
  "context": "industrial | enterprise | academic | experimental | mixed | other",
  "keyEvidence": "Hallazgos principales reportados (2-3 oraciones)",
  "metrics": {
    "nombreMetrica1EnIngles": "valor con unidad (ej: 15ms)",
    "nombreMetrica2EnIngles": "valor numérico (ej: 99.9%)"
  },
  "rq1Relation": "yes | no | partial",
  "rq2Relation": "yes | no | partial",
  "rq3Relation": "yes | no | partial",
  "rqNotes": "Justificación de relación con RQs",
  "limitations": "Limitaciones declaradas por autores (si existen)",
  "qualityScore": "high | medium | low"
}

**INSTRUCCIONES ESPECÍFICAS:**
- **studyType**: Identifica si es empírico (datos reales), caso de estudio (aplicación específica), experimento (controlado), simulación, o revisión
- **technology**: Extrae EXACTAMENTE el nombre de la tecnología evaluada
- **context**: Identifica si fue aplicado en industria real, empresa, laboratorio académico, etc.
- **keyEvidence**: Resume los resultados/hallazgos PRINCIPALES en 2-3 oraciones
- **metrics**: ⚠️ IMPORTANTE: Extrae CUALQUIER métrica con valor cuantitativo (precisión, velocidad, costo, tiempo, etc.). Pon los nombres de las métricas en INGLÉS. Si no hay métricas cuantitativas numéricas explícitas, deja este objeto vacío: {}
- **rqRelation**: Evalúa si el estudio responde cada RQ (yes=responde directamente, partial=responde indirectamente, no=no responde)
- **limitations**: Copia textualmente si los autores declaran limitaciones

Responde AHORA con el JSON:`;
  }

  /**
   * Extraer RQS para una sola referencia (endpoint individual)
   */
  async extractSingle(projectId, referenceId, userId) {
    try {
      // Verificar si ya existe
      const existing = await this.rqsEntryRepository.findByReference(referenceId);
      if (existing) {
        return {
          success: true,
          message: 'La referencia ya tiene datos RQS',
          rqsEntry: existing,
          alreadyExists: true
        };
      }

      // Obtener protocolo y referencia
      const protocol = await this.protocolRepository.findByProjectId(projectId);
      const reference = await this.referenceRepository.findById(referenceId);

      if (!reference) {
        throw new Error('Referencia no encontrada');
      }

      // Extraer datos
      const rqsData = await this.extractFromReference(
        reference,
        protocol?.researchQuestions || []
      );

      // Crear instancia del modelo RQSEntry
      const rqsEntry = new RQSEntry({
        projectId,
        referenceId,
        
        author: rqsData.author || reference.authors || 'Unknown',
        year: rqsData.year || reference.year || new Date().getFullYear(),
        title: reference.title,
        source: reference.journal || reference.source || '',
        
        studyType: rqsData.studyType,
        technology: rqsData.technology,
        context: rqsData.context,
        
        keyEvidence: rqsData.keyEvidence,
        metrics: rqsData.metrics,
        
        rq1Relation: rqsData.rq1Relation,
        rq2Relation: rqsData.rq2Relation,
        rq3Relation: rqsData.rq3Relation,
        rqNotes: rqsData.rqNotes,
        
        limitations: rqsData.limitations,
        qualityScore: rqsData.qualityScore,
        
        extractionMethod: 'ai_assisted',
        extractedBy: userId,
        extractedAt: new Date(),
        validated: false
      });

      // Guardar en base de datos
      const savedEntry = await this.rqsEntryRepository.create(rqsEntry);

      return {
        success: true,
        rqsEntry: savedEntry,
        alreadyExists: false
      };

    } catch (error) {
      console.error('Error en extracción individual RQS:', error);
      throw error;
    }
  }
}

module.exports = ExtractRQSDataUseCase;
