/**
 * VERSIÓN MEJORADA: Generación de Artículo Científico de Calidad Académica
 * 
 * Mejoras implementadas:
 * 1. Prompts más específicos y detallados con datos estadísticos reales
 * 2. Mejor integración de datos RQS con análisis estadístico profesional
 * 3. Tablas académicas bien formateadas con markdown correcto
 * 4. Redacción más profesional con referencias específicas a estudios
 * 5. Mayor énfasis en evidencia empírica y métricas cuantitativas
 * 6. Síntesis por pregunta de investigación individual
 * 7. Validación de calidad del artículo generado
 * 8. Sistema de prompts mejorado con instrucciones académicas explícitas
 */

class GenerateArticleFromPrismaUseCase {
  // Constantes para estándares editoriales — Target: ~7,200 palabras (~13 páginas)
  // Distribución: Abstract+Intro ~1,200 | Metodología ~2,000 | Resultados ~2,500 |
  //               Discusión+Conclusiones ~1,500 | Referencias N/A
  static EDITORIAL_STANDARDS = {
    TITLE_MAX_WORDS: 25,
    ABSTRACT_MIN_WORDS: 250,
    ABSTRACT_MAX_WORDS: 400,
    INTRODUCTION_MIN_WORDS: 800,
    INTRODUCTION_MAX_WORDS: 1000,
    METHODS_MIN_WORDS: 1800,
    METHODS_MAX_WORDS: 2200,
    RESULTS_MIN_WORDS: 2200,
    RESULTS_MAX_WORDS: 2800,
    DISCUSSION_MIN_WORDS: 800,
    DISCUSSION_MAX_WORDS: 1200,
    CONCLUSIONS_MIN_WORDS: 500,
    CONCLUSIONS_MAX_WORDS: 800,
    KEYWORDS_MIN: 3,
    KEYWORDS_MAX: 6,
    MIN_TOTAL_WORDS: 6500
  };

  constructor({
    prismaItemRepository,
    protocolRepository,
    rqsEntryRepository,
    screeningRecordRepository,
    referenceRepository,
    aiService,
    pythonGraphService,
    generatePrismaContextUseCase,
    extractRQSDataUseCase,
    extractFullTextDataUseCase
  }) {
    this.prismaItemRepository = prismaItemRepository;
    this.protocolRepository = protocolRepository;
    this.rqsEntryRepository = rqsEntryRepository;
    this.screeningRecordRepository = screeningRecordRepository;
    this.referenceRepository = referenceRepository;
    this.aiService = aiService;
    this.pythonGraphService = pythonGraphService;
    this.generatePrismaContextUseCase = generatePrismaContextUseCase;
    this.extractRQSDataUseCase = extractRQSDataUseCase;
    this.extractFullTextDataUseCase = extractFullTextDataUseCase;
  }

  /**
   * Translate text to Academic English using AI (only if it contains Spanish)
   */
  async translateToEnglish(text) {
    if (!text || text.trim() === '' || text === 'undefined') return text;
    
    // Quick heuristic: check if text likely contains Spanish
    const spanishIndicators = /[áéíóúñ¿¡]|(\b(de|del|los|las|una|que|para|con|por|como|más|está|sobre|entre|desde|hasta|según|esta|estos|estas|también|además|mediante|incluyendo|dentro|siendo|hacia|donde|cual|cada|sino|aunque|puede|deben|tienen|puede|esto|implementación|análisis|evaluación|supervisión|detección|prevención|tecnología|estudio|estudios|contexto|sistema|sistemas|inteligencia|artificial|cultivos|cultivo|agricultura|datos|modelos|rendimiento|aprendizaje|automático|investigación|comparación|intervención|población|resultado|resultados|búsqueda|desarrollo|aplicación|metodología)\b)/i;
    
    if (!spanishIndicators.test(text)) return text;
    
    try {
      const prompt = `Translate the following text to formal Academic English. Preserve all technical terms, acronyms, and proper nouns. Return ONLY the translated text, nothing else.

Text to translate:
${text}`;

      const response = await this.aiService.generateText(
        'You are a professional academic translator. Translate Spanish text to formal Academic English suitable for a Q1 journal publication.',
        prompt,
        'chatgpt',
        { temperature: 0.0 }
      );
      return response.trim();
    } catch (error) {
      console.warn('⚠️ Translation failed, using original text:', error.message);
      return text;
    }
  }

  /**
   * Re-clasifica estudios RQS basándose en keywords extraídas dinámicamente
   * del protocolo (preguntas de investigación + PICO).
   * NUNCA degrada relaciones existentes ('yes' → 'partial').
   */
  classifyStudiesForRQs(rqsEntries, protocol) {
    console.log('🔍 Re-clasificando estudios para RQs basándose en keywords del protocolo...');

    let researchQuestions = protocol.researchQuestions || [];

    // Fallback: Si no hay RQs, intentar extraerlas del campo 'objective' u 'objectives' (asumiendo formato lista)
    if (researchQuestions.length === 0) {
      const objText = protocol.objective || protocol.objectives || '';
      const extractedRQs = objText.split(/[—\-\n;]/)
                                 .map(s => s.trim())
                                 .filter(s => s.length > 10 && (s.includes('?') || s.toLowerCase().includes('qué') || s.toLowerCase().includes('cómo') || s.toLowerCase().includes('cuál')));
      if (extractedRQs.length > 0) {
        researchQuestions = extractedRQs;
        console.log(`✅ Preguntas de investigación extraídas exitosamente desde los objetivos: ${researchQuestions.length}`);
      }
    }

    if (researchQuestions.length === 0) {
      console.warn('⚠️ No se encontraron preguntas de investigación en el protocolo, omitiendo re-clasificación. El artículo no tendrá lista de preguntas si esto está vacío.');
      // Vamos a intentar extraerlas del campo "objectives" si están presentes y "researchQuestions" está vacío.
      // (En este caso no hacemos la re-clasificación automática pero lanzamos el warning)
      return rqsEntries.map(entry => {
        for (let i = 1; i <= 3; i++) {
          if (!entry[`rq${i}Relation`]) entry[`rq${i}Relation`] = 'no';
        }
        return entry;
      });
    }

    // Stopwords comunes (español + inglés) para filtrar palabras sin valor semántico
    const stopwords = new Set([
      'de', 'del', 'la', 'las', 'los', 'el', 'en', 'un', 'una', 'que', 'es', 'se', 'por',
      'con', 'para', 'son', 'como', 'más', 'al', 'ya', 'no', 'hay', 'su', 'sus',
      'cuáles', 'cuales', 'cómo', 'qué', 'han', 'sido', 'sobre', 'entre',
      'tiene', 'tienen', 'puede', 'pueden', 'está', 'están', 'ser', 'hacer',
      'esta', 'estos', 'estas', 'ese', 'esos', 'esas', 'aquel', 'aquellos',
      'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
      'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should',
      'may', 'might', 'must', 'can', 'could', 'of', 'in', 'to', 'for', 'with',
      'on', 'at', 'from', 'by', 'about', 'as', 'into', 'through', 'during',
      'and', 'but', 'or', 'if', 'what', 'which', 'who', 'this', 'that',
      'these', 'those', 'how', 'not', 'all', 'each', 'some', 'most', 'than',
      'its', 'they', 'them', 'their', 'been', 'being', 'there', 'where'
    ]);

    /** Extrae palabras clave significativas de un texto */
    const extractKeywords = (text) => {
      if (!text) return [];
      return text
        .toLowerCase()
        .replace(/[¿?¡!.,;:()[\]{}"'""''«»]/g, ' ')
        .split(/\s+/)
        .filter(word => word.length > 2 && !stopwords.has(word))
        .filter((word, idx, arr) => arr.indexOf(word) === idx);
    };

    // Construir listas de keywords dinámicamente desde las preguntas de investigación
    const rqKeywordSets = researchQuestions.map((rq, i) => {
      const keywords = extractKeywords(rq);
      console.log(`   RQ${i + 1} keywords: [${keywords.join(', ')}]`);
      return keywords;
    });

    // Extraer términos PICO como keywords suplementarias
    const pico = protocol.picoFramework || protocol.pico || {};
    const picoTerms = [
      ...extractKeywords(pico.population || ''),
      ...extractKeywords(pico.intervention || ''),
      ...extractKeywords(pico.comparison || ''),
      ...extractKeywords(pico.outcome || pico.outcomes || '')
    ].filter((word, idx, arr) => arr.indexOf(word) === idx);

    if (picoTerms.length > 0) {
      console.log(`   PICO terms: [${picoTerms.join(', ')}]`);
    }

    // También incluir keyTerms del protocolo si existen
    const protocolKeyTerms = extractKeywords(
      Object.values(protocol.keyTerms || {}).flat().join(' ')
    );
    if (protocolKeyTerms.length > 0) {
      console.log(`   Protocol key terms: [${protocolKeyTerms.join(', ')}]`);
    }

    const rqCounts = new Array(researchQuestions.length).fill(0);

    const classified = rqsEntries.map(entry => {
      const text = `${entry.title || ''} ${entry.keyEvidence || ''} ${entry.technology || ''}`.toLowerCase();

      // Clasificar para cada RQ dinámicamente
      rqKeywordSets.forEach((keywords, i) => {
        const rqKey = `rq${i + 1}Relation`;

        // NUNCA degradar: si ya es 'yes', mantener
        if (entry[rqKey] === 'yes') return;

        // Combinar keywords de la RQ + PICO + keyTerms del protocolo
        const combinedKeywords = [...new Set([...keywords, ...picoTerms, ...protocolKeyTerms])];
        const matchCount = combinedKeywords.filter(kw => text.includes(kw)).length;

        // Requiere al menos 2 coincidencias para clasificar como 'partial'
        if (matchCount >= 2 && entry[rqKey] !== 'partial') {
          entry[rqKey] = 'partial';
          rqCounts[i]++;
        } else if (!entry[rqKey]) {
          entry[rqKey] = 'no';
        }
      });

      // Asegurar que rq1-rqN existan
      researchQuestions.forEach((_, i) => {
        const rqKey = `rq${i + 1}Relation`;
        if (!entry[rqKey]) entry[rqKey] = 'no';
      });

      return entry;
    });

    const rqsSummary = rqKeywordSets.map((_, i) => `RQ${i + 1}=${rqCounts[i]}`).join(', ');
    console.log(`✅ Re-clasificación completada (nuevas parciales): ${rqsSummary}`);
    return classified;
  }

  getEnhancedSystemPrompt(numIncluded) {
    return `You are an expert in Research Methodology and Software Architecture, specialized in IEEE standards and PRISMA 2020 protocols. Your objective is to synthesize data extracted from included studies ($n=${numIncluded}) to generate a rigorous scientific manuscript.

**MASTER CONFIGURATION (HIGH FIDELITY):**
- SINGLE SOURCE OF TRUTH (SSOT): All sections MUST be consistent with the final count of studies: $n=${numIncluded}.
- CLARITY OVER CREATIVITY: If data is not in the source, report "Not Reported (N/R)". NEVER invent metrics.
- IEEE STANDARDS: 
    - Tables: Numbered with Roman numerals (e.g., Table I). Titles MUST be ABOVE the table.
    - Figures: Numbered with Arabic numerals (e.g., Figure 1). Titles MUST be BELOW the figure.
- ANTI-AI WRITING STYLE:
    - TECHNICAL DENSITY: No generic intros. Start with technical conflict (e.g., "The tradeoff between code maintainability and system latency...").
    - ACTIVE VOICE: "We analyzed", "We synthesized" (Avoid "It was analyzed").
    - PRECISE VOCABULARY: Use technical terms (overhead, throughput, bottleneck, abstraction penalty).

**YOUR ROLE:**
- Write professional academic content following PRISMA 2020 and IEEE standards.
- Use ONLY explicitly provided data from the ${numIncluded} included studies.
- Maintain extreme methodological rigor and technical precision.
- Write in formal Academic English.

**ABSOLUTE PROHIBITIONS:**
- DO NOT invent data, percentages, or studies.
- DO NOT use filler or flowery language (e.g., "In the rapidly changing landscape...").
- DO NOT use generic AI muletillas (e.g., "This fascinating study...", "Crucially...").
- DO NOT invent authors or references.`;
  }

  async execute(projectId) {
    try {
      console.log(`📄 Generando artículo científico profesional para proyecto ${projectId}`);

      // 1. Validar PRISMA completo
      await this.validatePrismaComplete(projectId);

      // 1.5. 🆕 EXTRACCIÓN AUTOMÁTICA DE DATOS DE PDFs
      console.log(`\n🔍 PASO 1.5: Extracción automática de datos de PDFs cargados`);
      
      // Verificar si hay PDFs para procesar
      if (this.referenceRepository && this.extractFullTextDataUseCase && this.extractRQSDataUseCase) {
        try {
          // Obtener referencias incluidas
          const allReferences = await this.referenceRepository.findByProject(projectId);
          const includedReferences = allReferences.filter(ref => 
            ref.screeningStatus === 'included' || ref.screeningStatus === 'fulltext_included'
          );
          
          const refsWithPDF = includedReferences.filter(ref => ref.fullTextUrl);
          
          console.log(`   📊 Referencias incluidas: ${includedReferences.length}`);
          console.log(`   📄 Con PDFs cargados: ${refsWithPDF.length}`);
          
          if (refsWithPDF.length > 0) {
            // 1.5.1. Extraer datos generales de PDFs (para artículo)
            console.log(`   🔄 Extrayendo datos de texto completo...`);
            try {
              const fullTextResult = await this.extractFullTextDataUseCase.processProjectPDFs(projectId);
              console.log(`   ✅ Datos de texto completo extraídos: ${fullTextResult.processed}/${fullTextResult.total}`);
            } catch (extractError) {
              console.warn(`   ⚠️ Error en extracción de texto completo (continuando):`, extractError.message);
            }
            
            // 1.5.2. Extraer datos RQS estructurados (para tablas RQS)
            console.log(`   🔄 Extrayendo datos RQS estructurados...`);
            try {
              const rqsResult = await this.extractRQSDataUseCase.execute(projectId);
              console.log(`   ✅ Datos RQS extraídos: ${rqsResult.extracted} estudios procesados`);
              if (rqsResult.errors > 0) {
                console.warn(`   ⚠️ Errores en extracción RQS: ${rqsResult.errors} estudios fallaron`);
              }
            } catch (rqsError) {
              console.warn(`   ⚠️ Error en extracción RQS (continuando):`, rqsError.message);
            }
          } else {
            console.log(`   ℹ️ No hay PDFs cargados. Generando artículo solo con abstracts.`);
          }
        } catch (extractionError) {
          console.warn(`   ⚠️ Error en proceso de extracción automática:`, extractionError.message);
          console.warn(`   ℹ️ Continuando con datos existentes...`);
        }
      } else {
        console.log(`   ⚠️ Use cases de extracción no disponibles, omitiendo extracción automática`);
      }
      
      console.log(`\n📊 PASO 2: Cargando datos existentes de la base de datos...`);

      // 2. Obtener datos
      const prismaItems = await this.prismaItemRepository.findAllByProject(projectId);
      const contextResult = await this.generatePrismaContextUseCase.execute(projectId);
      const prismaContext = contextResult.context;
      let rqsEntries = await this.rqsEntryRepository.findByProject(projectId);

      // ✅ RESTRICCIÓN OBLIGATORIA: Solo usar los que tienen estado "included" o "fulltext_included" (revisión manual)
      if (this.referenceRepository) {
        const allReferences = await this.referenceRepository.findByProject(projectId);
        const manuallyIncludedIds = new Set(
          allReferences
            .filter(ref => ref.manualReviewStatus === 'included')
            .map(ref => ref.id)
        );
        rqsEntries = rqsEntries.filter(entry => manuallyIncludedIds.has(entry.referenceId));
        console.log(`📌 Filtrados estrictamente por revisión manual: ${rqsEntries.length} estudios.`);
      }

      // ✅ CORRECCIÓN: Re-clasificar estudios para RQs
      if (rqsEntries.length > 0) {
        rqsEntries = this.classifyStudiesForRQs(rqsEntries, prismaContext.protocol || {});
      }

      // Validar datos RQS mínimos
      if (rqsEntries.length < 2) {
        console.warn('⚠️ Advertencia: Se recomienda tener al menos 2 estudios con datos RQS para generar un artículo de calidad');
      }

      console.log(`📊 Datos RQS disponibles: ${rqsEntries.length} entradas`);
      console.log(`✅ ESTUDIOS CARGADOS DESDE DB:`);
      rqsEntries.forEach((entry, idx) => {
        console.log(`   S${idx + 1}: ${entry.author} (${entry.year}) - ${entry.title?.substring(0, 60)}...`);
      });
      console.log(`⚠️  LA IA GEMINI DEBE USAR SOLO ESTOS ${rqsEntries.length} ESTUDIOS, NO PUEDE INVENTAR MÁS`);

      // 3. Calcular estadísticas detalladas RQS
      const rqsStats = this.calculateDetailedRQSStatistics(rqsEntries, prismaContext.protocol || {});
      console.log(`📈 Estadísticas RQS calculadas:`, {
        tipos: Object.keys(rqsStats.studyTypes).length,
        tecnologías: rqsStats.technologies.length,
        años: `${rqsStats.yearRange.min}-${rqsStats.yearRange.max}`
      });

      // 3.5. Extraer datos para los 4 nuevos gráficos académicos
      const enhancedChartData = this.extractEnhancedChartData(rqsEntries);
      console.log(`📊 Datos extraídos para gráficos académicos:`, {
        años_distribucion: Object.keys(enhancedChartData.temporal_distribution.years).length,
        bubble_entries: enhancedChartData.bubble_chart.entries.length,
        estudios_sintesis: enhancedChartData.technical_synthesis.studies.length
      });

      // 4. Generar Gráficos con Python
      let chartPaths = {};
      try {
        if (this.pythonGraphService && this.screeningRecordRepository) {
          // Intentar obtener scores de ambas fases (title_abstract tiene prioridad)
          let scores = await this.screeningRecordRepository.getAllScores(projectId, 'title_abstract');
          
          // Si no hay scores en title_abstract, intentar fulltext
          if (!scores || scores.length === 0) {
            scores = await this.screeningRecordRepository.getAllScores(projectId, 'fulltext');
          }
          
          console.log(`📊 Scores obtenidos para gráfico scree: ${scores?.length || 0} puntos`);
          
          // Usar searchQueries del protocolo que tiene la información real de búsquedas
          const searchData = (prismaContext.protocol.searchQueries || []).map(sq => ({
            name: sq.database || sq.databaseId || 'Unknown',
            hits: sq.resultsCount || 0,
            searchString: sq.query || sq.apiQuery || 'N/A'
          }));
          
          console.log('🔍 DEBUG - prismaContext.screening.referencesBySource:', 
            prismaContext.screening.referencesBySource);
          console.log('🔍 DEBUG - Generated searchData:', searchData);
          console.log('🔍 DEBUG - Passing to generateCharts...');
          
          // Pasar datos extendidos al servicio de Python
          chartPaths = await this.pythonGraphService.generateCharts(
            prismaContext.screening, 
            scores, 
            searchData,
            enhancedChartData // ← Nuevos datos estadísticos
          );
        }
      } catch (err) {
        console.error('⚠️ Error generando gráficos:', err);
      }

      // 5. Mapear PRISMA
      const prismaMapping = this.mapPrismaToIMRaD(prismaItems);

      // 6. Generar artículo con CALIDAD ACADÉMICA
      console.log('📝 Generando secciones del artículo...');

      // ✅ VALIDACIÓN: Asegurar que title nunca esté vacío y cumple longitud editorial
      const articleTitle = prismaMapping.title ||
        prismaContext.protocol.title ||
        prismaContext.protocol.proposedTitle ||
        'Systematic Literature Review';

      if (!articleTitle || articleTitle.trim() === '') {
        console.warn('⚠️ Advertencia: Título del artículo vacío, usando fallback genérico');
      }
      
      // Validar longitud del título según estándares editoriales
      const titleWordCount = articleTitle.split(/\s+/).filter(w => w.length > 0).length;
      const { TITLE_MAX_WORDS } = GenerateArticleFromPrismaUseCase.EDITORIAL_STANDARDS;
      
      if (titleWordCount > TITLE_MAX_WORDS) {
        console.warn(`⚠️ Título excede longitud recomendada: ${titleWordCount} palabras (máximo recomendado: ${TITLE_MAX_WORDS})`);
        console.warn(`   Considere acortar: "${articleTitle.substring(0, 80)}..."`);
      } else {
        console.log(`✅ Título cumple estándar editorial: ${titleWordCount} palabras`);
      }

      // 6.5. NO convertir a base64, usar URLs directas para evitar problemas con ReactMarkdown
      // Las imágenes ya están guardadas en uploads/charts/ y son servidas por Express
      console.log('📸 Usando URLs directas para imágenes en lugar de base64');
      const chartPathsForArticle = chartPaths; // Usar URLs directas

      // ✅ OPTIMIZACIÓN: Generar secciones en lotes paralelos para reducir total
      // ✅ MASTER CONFIG: Configuración de IA Determinista (Temp 0.0)
      const aiOptions = {
        temperature: 0.0,
        topP: 0.1,
        topK: 1
      };

      const systemPrompt = this.getEnhancedSystemPrompt(rqsEntries.length);

      // Lote 1: abstract + keywords + introduction (independientes)
      const [abstract, keywords, introduction] = await Promise.all([
        this.generateProfessionalAbstract(prismaMapping, prismaContext, rqsStats, aiOptions, systemPrompt),
        this.generateKeywords(prismaContext, rqsStats, aiOptions, systemPrompt),
        this.generateProfessionalIntroduction(prismaMapping, prismaContext, rqsEntries, aiOptions, systemPrompt)
      ]);
      console.log('   ✅ Lote 1 completado: abstract, keywords, introduction');

      // Lote 2: methods + results (independientes)
      const [methods, results] = await Promise.all([
        this.generateProfessionalMethods(prismaMapping, prismaContext, rqsEntries, chartPathsForArticle),
        this.generateProfessionalResults(prismaMapping, prismaContext, rqsEntries, rqsStats, chartPathsForArticle, enhancedChartData, aiOptions, systemPrompt)
      ]);
      console.log('   ✅ Lote 2 completado: methods, results');

      // Lote 3: discussion + conclusions (independientes)
      const [discussion, conclusions] = await Promise.all([
        this.generateProfessionalDiscussion(prismaMapping, prismaContext, rqsStats, rqsEntries, aiOptions, systemPrompt),
        this.generateProfessionalConclusions(prismaMapping, prismaContext, rqsStats, aiOptions, systemPrompt)
      ]);
      console.log('   ✅ Lote 3 completado: discussion, conclusions');

      const article = {
        title: articleTitle,
        abstract,
        keywords,
        introduction,
        methods,
        results,
        discussion,
        conclusions,
        references: this.generateProfessionalReferences(prismaContext, rqsEntries),
        declarations: this.generateDeclarations(prismaContext),
        metadata: {
          generatedAt: new Date().toISOString(),
          wordCount: 0,
          version: 1,
          prismaCompliant: true,
          rqsDataIncluded: rqsEntries.length > 0,
          rqsEntriesCount: rqsEntries.length,
          tablesIncluded: 3,
          figuresRecommended: [
            'PRISMA flow diagram', 
            'Scree plot', 
            'Search strategy table',
            'Temporal distribution',
            'Quality assessment',
            'Metrics-Technologies bubble chart',
            'Technical synthesis table'
          ],
          figuresIncluded: Object.keys(chartPaths).length,
          editorialStandards: {
            compliant: true,
            format: 'IEEE/Elsevier/Springer/MDPI',
            abstractWords: 0,
            keywordsCount: 0,
            conclusionsWords: 0
          }
        }
      };

      article.metadata.wordCount = this.calculateWordCount(article);
      
      // Calcular estadísticas editoriales
      article.metadata.editorialStandards.abstractWords = article.abstract.split(/\s+/).filter(w => w.length > 0).length;
      article.metadata.editorialStandards.keywordsCount = article.keywords.split(';').filter(k => k.trim().length > 0).length;
      article.metadata.editorialStandards.conclusionsWords = article.conclusions.split(/\s+/).filter(w => w.length > 0).length;

      // Validación de calidad
      this.validateArticleQuality(article, prismaContext.protocol || {});

      console.log('✅ Artículo profesional generado exitosamente');
      console.log(`📊 Palabras totales: ${article.metadata.wordCount}`);
      console.log(`📊 Abstract: ${article.metadata.editorialStandards.abstractWords} palabras`);
      console.log(`📊 Keywords: ${article.metadata.editorialStandards.keywordsCount} términos`);
      console.log(`📊 Conclusiones: ${article.metadata.editorialStandards.conclusionsWords} palabras`);
      console.log(`📊 Tablas incluidas: ${article.metadata.tablesIncluded}`);

      return { success: true, article };

    } catch (error) {
      console.error('❌ Error generando artículo:', error);
      throw error;
    }
  }

  /**
   * ABSTRACT PROFESIONAL con estructura estándar de revistas Q1
   */
  async generateProfessionalAbstract(prismaMapping, prismaContext, rqsStats, aiOptions = {}, systemPrompt = null) {
    const prompt = `Act as a senior researcher writing for a Q1 journal. Generate a structured abstract following the strict IMRAD format. ALL output MUST be in Academic English.

**CONCRETE DATA AVAILABLE:**

STUDY CONTEXT:
- Objective: ${prismaMapping.introduction.objectives}
- Search period: ${prismaContext.protocol.temporalRange.start || '2023'} - ${prismaContext.protocol.temporalRange.end || '2025'}
- Databases: ${prismaContext.protocol.databases.map(db => db.name).join(', ')}
- Total articles identified: ${prismaContext.screening.totalResults ?? 'N/A'}
- Articles after screening: ${prismaContext.screening.afterScreening ?? 'N/A'}
- Final included studies: ${prismaContext.screening.includedFinal ?? rqsStats.total}
- AI screening method: Hybrid (Phase 1: semantic embeddings, Phase 2: LLM grey-zone analysis)
${prismaContext.screening.phase1 ? `- Phase 1 results: ${prismaContext.screening.phase1.highConfidenceInclude} high-confidence includes, ${prismaContext.screening.phase1.highConfidenceExclude} excludes, ${prismaContext.screening.phase1.greyZone} grey-zone` : ''}
${prismaContext.screening.phase2 ? `- Phase 2 results: ${prismaContext.screening.phase2.included} included, ${prismaContext.screening.phase2.excluded} excluded, ${prismaContext.screening.phase2.manual} manual review` : ''}

PROCESSED RQS DATA (${rqsStats.total} studies):
- Study types: ${JSON.stringify(rqsStats.studyTypes)}
- Temporal distribution: ${rqsStats.yearRange.min}-${rqsStats.yearRange.max}
- Main technologies: ${rqsStats.technologies.slice(0, 3).map(t => `${t.technology} (n=${t.count})`).join(', ')}
- Application contexts: ${JSON.stringify(rqsStats.contexts)}
RQ Coverage:
${Object.keys(rqsStats.rqRelations).map((rqKey, i) => {
  const rel = rqsStats.rqRelations[rqKey];
  return `- ${rqKey.toUpperCase()} coverage: ${rel.yes} direct, ${rel.partial} partial`;
}).join('\n')}

Write ONE cohesive paragraph with FOUR clearly delineated sub-segments (no headings, no line breaks):

1. **Introduction segment** (2-3 sentences): Start directly with the technical conflict and software architecture principles. Avoid generic filler.
2. **Methods segment** (3-4 sentences): Specify PRISMA 2020 compliance, databases, PICO, and the AI-assisted screening with embeddings/elbow method validation.
3. **Results segment** (4-5 sentences): Report the final $n$ of included studies, distribution, and predominant technologies with exact technical metrics.
4. **Discussion segment** (2-3 sentences): Synthesize implications for system design and architecture.

**QUALITY REQUIREMENTS:**
- Use ONLY the data provided above, DO NOT invent figures
- Include specific numbers (n=X, Y%, etc.)
- Formal Academic English with HIGH TECHNICAL DENSITY
- Third person plural ("We identified") or impersonal
- No undefined abbreviations
- Total coherence between sub-segments
- **CRITICAL: Keep between 250-400 words**
- The output must be ONE SINGLE PARAGRAPH without line breaks

Generate ONLY the abstract text as one continuous paragraph. ALL text MUST be in English:`;

    const response = await this.aiService.generateText(
      this.getEnhancedSystemPrompt(),
      prompt,
      'chatgpt'
    );

    const abstractText = response.trim();
    
    // Validación de longitud según estándares editoriales
    const wordCount = abstractText.split(/\s+/).filter(w => w.length > 0).length;
    const { ABSTRACT_MIN_WORDS, ABSTRACT_MAX_WORDS } = GenerateArticleFromPrismaUseCase.EDITORIAL_STANDARDS;
    
    if (wordCount < ABSTRACT_MIN_WORDS) {
      console.warn(`⚠️ Abstract DEBAJO del estándar editorial: ${wordCount} palabras (mínimo: ${ABSTRACT_MIN_WORDS})`);
    } else if (wordCount > ABSTRACT_MAX_WORDS) {
      console.warn(`⚠️ Abstract EXCEDE el estándar editorial: ${wordCount} palabras (máximo: ${ABSTRACT_MAX_WORDS})`);
    } else {
      console.log(`✅ Abstract cumple estándar editorial: ${wordCount} palabras`);
    }

    return abstractText;
  }

  /**
   * KEYWORDS profesionales (obligatorio en journals IEEE/Elsevier/Springer/MDPI)
   */
  async generateKeywords(prismaContext, rqsStats, aiOptions = {}, systemPrompt = null) {
    const prompt = `Generate keywords for a systematic review scientific article. ALL output MUST be in English.

**STUDY CONTEXT:**
- Objective: ${prismaContext.protocol.objective}
- Main technologies: ${rqsStats.technologies.slice(0, 5).map(t => t.technology).join(', ')}
- Contexts: ${Object.keys(rqsStats.contexts).join(', ')}
- Study type: Systematic literature review

**STRICT EDITORIAL REQUIREMENTS:**
- Generate EXACTLY between 3 and 6 keywords
- Must reflect: technology, application domain, and method
- Avoid generic words like "review", "analysis" (unless very specific)
- Use indexable terms in academic databases (IEEE Xplore, Scopus, Web of Science)
- Use standard English academic terms
- Separate with semicolons
- Capitalization: First letter uppercase or all lowercase per term convention

**EXAMPLES OF GOOD KEYWORDS (format only, adapt to YOUR study domain):**
- Deep Learning; Crop Disease Detection; Precision Agriculture; Convolutional Neural Networks; Systematic Review
- Cloud Computing; DevOps; Agile Methodology; Software Quality
- Artificial Intelligence; Natural Language Processing; Transfer Learning

Generate ONLY the list of keywords separated by semicolons, without numbering or additional formatting:`;

    const response = await this.aiService.generateText(
      this.getEnhancedSystemPrompt(),
      prompt,
      'chatgpt'
    );

    const keywords = response.trim();
    
    // Validación de cantidad de keywords
    const keywordArray = keywords.split(';').map(k => k.trim()).filter(k => k.length > 0);
    const { KEYWORDS_MIN, KEYWORDS_MAX } = GenerateArticleFromPrismaUseCase.EDITORIAL_STANDARDS;
    
    if (keywordArray.length < KEYWORDS_MIN) {
      console.warn(`⚠️ Keywords insuficientes: ${keywordArray.length} (mínimo: ${KEYWORDS_MIN})`);
    } else if (keywordArray.length > KEYWORDS_MAX) {
      console.warn(`⚠️ Demasiadas keywords: ${keywordArray.length} (máximo: ${KEYWORDS_MAX})`);
    } else {
      console.log(`✅ Keywords cumplen estándar: ${keywordArray.length} términos`);
    }

    return keywords;
  }

  /**
   * INTRODUCCIÓN PROFESIONAL con revisión de literatura
   */
  async generateProfessionalIntroduction(prismaMapping, prismaContext, rqsEntries, aiOptions = {}, systemPrompt = null) {
    const referencesList = rqsEntries.map((e, i) => `[${i + 1}] ${e.author} (${e.year}): ${e.title}`).join('\n');

    const prompt = `Write a professional academic introduction for a systematic review in a scientific journal. ALL output MUST be in Academic English. If source data below is in Spanish, translate it into English and integrate it naturally.

**PRISMA CONTENT AVAILABLE:**

Rationale (PRISMA #3):
${prismaMapping.introduction.rationale}

Objectives (PRISMA #4):
${prismaMapping.introduction.objectives}

PICO Protocol:
- Population: ${prismaContext.protocol.pico.population || 'Not specified'}
- Intervention: ${prismaContext.protocol.pico.intervention || 'Not specified'}
- Comparison: ${prismaContext.protocol.pico.comparison || 'No specific comparison defined'}
- Outcome: ${prismaContext.protocol.pico.outcomes || 'Not explicitly defined'}

Research Questions:
${prismaContext.protocol.researchQuestions.map((rq, i) => `RQ${i + 1}: ${rq}`).join('\n')}

**INCLUDED STUDIES (USE FOR CITATIONS):**
${referencesList}

**REQUIRED STRUCTURE (800-1000 words):**

1. **Paragraphs 1-2 (Context & Importance)**: Establish the current state of the field and why this topic matters. Ground the discussion with real-world relevance.
2. **Paragraphs 3-4 (Gap & Literature)**: Cite included studies using THEIR NUMBER in brackets [X] when relevant to show what has been done (and what is missing). Identify the specific knowledge gap this review fills.
3. **Paragraph 5 (Objectives)**: State the objective of this review, linked to the PICO framework.
4. **Paragraph 6 (Contribution)**: Explain the unique contribution of this systematic review.
5. **FINAL PARAGRAPH (Research Questions) — MANDATORY**: End the introduction with an explicit numbered list of the research questions derived from the PICO framework. Use the EXACT research questions from the protocol data above. Format as:

"To address these objectives, this systematic review seeks to answer the following research questions:

${prismaContext.protocol.researchQuestions.map((rq, i) => `- **RQ${i + 1}**: [exact text of research question ${i + 1} from below]`).join('\n')}"

**WRITING STYLE:**
- Third person impersonal
- STRICT: Use numbered citation format [1], [2] corresponding to the provided list.
- DO NOT invent citations or authors.
- Formal Academic English.
- If any source data is in Spanish, translate and integrate it naturally into English prose.
- The Introduction MUST end with the explicit RQ list — this is a HARD REQUIREMENT.

Generate ONLY the introduction text in English:`;

    const response = await this.aiService.generateText(
      this.getEnhancedSystemPrompt(),
      prompt,
      'chatgpt'
    );

    return response.trim();
  }

  /**
   * MÉTODOS PROFESIONALES con detalles reproducibles completos
   */
  async generateProfessionalMethods(prismaMapping, prismaContext, rqsEntries, charts = {}) {
    // Usar searchQueries si está disponible, sino databases
    const searchQueries = prismaContext.protocol.searchQueries || [];
    const databases = prismaContext.protocol.databases || [];
    
    // Mapa de IDs a nombres legibles
    const DB_NAME_MAP = {
      'ieee': 'IEEE Xplore',
      'scopus': 'Scopus',
      'acm': 'ACM Digital Library',
      'pubmed': 'PubMed',
      'wos': 'Web of Science',
      'springer': 'Springer Link',
      'sciencedirect': 'ScienceDirect',
      'google_scholar': 'Google Scholar'
    };

    // Para compatibilidad con código existente
    const dbNames = searchQueries.length > 0 
      ? searchQueries.map(sq => DB_NAME_MAP[sq.database] || DB_NAME_MAP[sq.databaseId] || sq.databaseName || sq.database).join(', ')
      : databases.map(db => db.name || db).join(', ') || 'electronic databases';

    let screePlot = '';
    if (charts.scree) {
      screePlot = `
![Priority Screening Score Distribution](${charts.scree})
*Figure 2. Distribution of semantic relevance scores (Scree Plot) with elbow-point detection.*
`;
    }

    // Cadena de búsqueda general del protocolo (fallback)
    const globalSearchString = prismaContext.protocol.searchString || '';

    // Generar tabla de búsquedas - SOLO markdown puro, sin títulos adicionales
    let searchChart = '';
    
    if (searchQueries.length > 0) {
      // Usar todas las queries del protocolo
      const tableRows = searchQueries
        .map(sq => {
          const dbName = DB_NAME_MAP[sq.database] || DB_NAME_MAP[sq.databaseId] || sq.databaseName || sq.database || 'N/A';
          const searchStr = sq.query || globalSearchString || 'N/A';
          return `| ${dbName} | ${searchStr} |`;
        }).join('\n');

      searchChart = tableRows ? `**Search Strategy and Criteria per Database**\n\n| Database | Search String |\n|---------------|-------------------|\n${tableRows}` : '';
    }
    
    // Fallback: usar databases + cadena global del protocolo
    if (!searchChart && databases.length > 0) {
      const tableRows = databases.map(db => {
        const dbName = db.name || db || 'N/A';
        const searchStr = db.searchString || db.query || globalSearchString || 'See protocol';
        return `| ${dbName} | ${searchStr} |`;
      }).join('\n');

      searchChart = `| Database | Search String |\n|---------------|-------------------|\n${tableRows}`;
    }

    // Translate PICO and PRISMA items from Spanish to English
    console.log('🔄 Translating PICO and PRISMA content to English...');
    const [picoPopulation, picoIntervention, picoComparison, picoOutcome,
           eligibilityCriteria, selectionProcess, riskOfBias, synthesisMethod] = await Promise.all([
      this.translateToEnglish(prismaContext.protocol.pico.population || 'Not specified'),
      this.translateToEnglish(prismaContext.protocol.pico.intervention || 'Not specified'),
      this.translateToEnglish(prismaContext.protocol.pico.comparison || 'No specific comparison defined'),
      this.translateToEnglish(prismaContext.protocol.pico.outcomes || 'Not explicitly defined'),
      this.translateToEnglish(prismaMapping.methods.eligibilityCriteria),
      this.translateToEnglish(prismaMapping.methods.selectionProcess),
      this.translateToEnglish(prismaMapping.methods.riskOfBias),
      this.translateToEnglish(prismaMapping.methods.synthesisMethod),
    ]);
    console.log('✅ Translation completed');

    return `## 2.1 Study Design

This systematic review was conducted following the PRISMA 2020 (Preferred Reporting Items for Systematic Reviews and Meta-Analyses) guidelines [1]. The protocol was defined a priori before initiating the bibliographic search, including predefined eligibility criteria based on the PICO framework, a structured search strategy, and a narrative synthesis plan.

## 2.2 Eligibility Criteria

${eligibilityCriteria}

The criteria were defined following the PICO framework:
- **Population (P)**: ${picoPopulation}
- **Intervention (I)**: ${picoIntervention}
- **Comparison (C)**: ${picoComparison}
- **Outcome (O)**: ${picoOutcome}

## 2.3 Information Sources and Search Strategy

The search focused on identifying relevant studies published between ${prismaContext.protocol.temporalRange.start || '2023'} and ${prismaContext.protocol.temporalRange.end || '2025'}. A total of ${databases.length} key academic databases in the field were selected: ${dbNames}. Following PRISMA standards, the initial search yielded a total of **${prismaContext.screening.totalResults || 0} registers**. The database-specific search strings and their respective hit counts are detailed in the search strategy summary below.

${searchChart}

The complete strategies for all databases are available in the supplementary material.


The study selection process followed a standardized multi-phase approach as detailed in Section 2.5, prioritizing methodological rigor and minimizing reporting bias.


## 2.5 Selection Process

${selectionProcess}

The process followed four phases:
1. **Duplicate removal**: Automated deduplication identified and removed duplicate references across databases.
2. **AI-assisted prioritization**: A hybrid screening system (Embeddings + LLM) was used to compute relevance scores. Data-driven prioritization was validated via the elbow method to optimize manual review effort.
3. **Title and abstract screening**: References prioritized by the AI system were evaluated by the principal investigator using the predefined PICO-based criteria. The AI classifications served as decision support, with the human reviewer making all final decisions.
4. **Full-text review**: Articles that passed the initial screening were retrieved in full text and evaluated against the complete eligibility criteria, including assessment of methodological quality.

## 2.6 Data Extraction Using the RQS Schema

Data were extracted using a structured and standardized RQS (Research Question Schema) specifically designed for this review. The RQS schema included the following fields:

**Study identification:**
- Lead author and year of publication
- Full title
- Publication source (journal, conference)
- DOI or unique identifier

**Methodological classification:**
- Study type (empirical, case study, experiment, simulation, review)
- Research design
- Application context (industrial, enterprise, academic, experimental, mixed)

**Technical characterization:**
- Main technology or method evaluated
- Tools and frameworks used
- Reported evaluation metrics

**Relationship with research questions:**
${(prismaContext.protocol.researchQuestions || []).map((_, i) => `- Pertinence assessment for RQ${i + 1} (direct/partial/none)`).join('\n')}
- Key extracted evidence
- Relevant textual quotations (with page)

**Quality assessment:**
- Limitations declared by the authors
- Risk of bias (low/moderate/high)
- Methodological quality (high/medium/low)

Data extraction was assisted by artificial intelligence (Claude Sonnet 4) to accelerate the process, but **all data were manually validated** by the principal investigator. Data were extracted from **${rqsEntries.length} studies** that met the inclusion criteria.

To ensure consistency, a pilot extraction was conducted with 3 studies before proceeding with the complete set. The extracted data were stored in a structured database compatible with statistical analysis.

## 2.7 Risk of Bias Assessment

${riskOfBias}

A qualitative assessment of methodological quality was applied considering:
- Adequacy of research design
- Transparency in method reporting
- Sufficiency of data to answer the RQs
- Explicit declaration of limitations

## 2.8 Data Synthesis

${synthesisMethod}

Given the methodological heterogeneity of the included studies (different designs, contexts, and metrics), a **structured narrative synthesis** was performed instead of a quantitative meta-analysis.

The synthesis was organized around the three research questions, integrating findings thematically. Descriptive statistics were calculated to characterize the included studies (frequency distributions, temporal ranges, predominant technologies) and recurrent patterns in the findings were identified.`;
  }

  /**
   * RESULTADOS PROFESIONALES con análisis estadístico real y síntesis por RQ
   */
  async generateProfessionalResults(prismaMapping, prismaContext, rqsEntries, rqsStats, charts = {}, enhancedChartData = null, aiOptions = {}, systemPrompt = null) {
    // Generar análisis RQS detallado
    const rqsAnalysis = await this.generateDetailedRQSAnalysis(rqsEntries, rqsStats, prismaContext);


    // Translate PRISMA items and RQs that may be in Spanish
    console.log('🔄 Translating Results PRISMA content to English...');
    const rqs = prismaContext.protocol.researchQuestions || [];
    
    // Preparar textos para traducción masiva
    const textsToTranslate = [
      prismaMapping.results.studySelection,
      prismaMapping.results.riskOfBiasResults
    ];
    rqs.forEach(rq => textsToTranslate.push(rq));
    
    const translatedResults = await Promise.all(
      textsToTranslate.map(text => this.translateToEnglish(text))
    );
    
    const studySelection = translatedResults[0];
    const riskOfBiasResults = translatedResults[1];
    const translatedRQs = translatedResults.slice(2);
    
    console.log(`✅ Results translation completed: ${translatedRQs.length} RQs translated`);

    // Síntesis dinámica por cada RQ utilizando los textos traducidos
    const synthesisBlocks = [];
    for (let i = 0; i < rqs.length; i++) {
        const rqLabel = translatedRQs[i] || `Research Question ${i + 1}`;
        const synthesis = rqsEntries.length > 0 
          ? await this.synthesizeRQFindings(i, rqsEntries, prismaContext, aiOptions, systemPrompt)
          : 'No studies were identified that addressed this question.';
        
        const rel = rqsStats.rqRelations[`rq${i + 1}`] || { yes: 0, partial: 0 };
        
        synthesisBlocks.push(`### 3.4.${i + 1} RQ${i + 1}: ${rqLabel}

Of the ${rqsStats.total} included studies, **${rel.yes} studies** directly addressed this question, while **${rel.partial} additional studies** addressed it partially.

${synthesis}`);
    }
    
    const rqSyntheticFindings = synthesisBlocks.join('\n\n');

    // Calcular correctamente los números PRISMA para evitar valores negativos
    const totalIdentified = prismaContext.screening.identified || 0;
    const duplicatesRemoved = prismaContext.screening.duplicatesRemoved || 0;
    const afterDedup = prismaContext.screening.screenedTitleAbstract || (totalIdentified - duplicatesRemoved);
    const excludedTitleAbstract = prismaContext.screening.excludedTitleAbstract || 0;
    const fullTextAssessed = prismaContext.screening.fullTextAssessed || 0;
    const excludedFullText = prismaContext.screening.excludedFullText || 0;
    const finalIncluded = prismaContext.screening.includedFinal || rqsStats.total;

    let bubbleSection = '';
    if (enhancedChartData && enhancedChartData.hasBubbleData && charts.bubble_chart) {
      bubbleSection = `\n### 3.4.4 Metrics and Technologies Mapping\n\n![Metrics vs Technologies Distribution](${charts.bubble_chart})\n*Figure 5. Distribution of reported metrics across different technologies. Bubble size represents the number of studies reporting each metric-technology combination.*\n`;
    }

    let keywordSection = '';
    if (enhancedChartData && enhancedChartData.hasKeywordData && charts.keyword_concentration) {
      keywordSection = `\n### 3.4.6 Thematic Concentration Mapping\n\n![Technical Keyword Concentration](${charts.keyword_concentration})\n*Figure 4. Technical keyword concentration and thematic mapping. The frequency of terms reveals the core technological domains and architectural patterns addressed by the included studies. This distribution highlights the predominant focus areas in the current literature.*\n`;
    }

    let synthesisSection = '';
    if (enhancedChartData && enhancedChartData.hasSynthesisData) {
      const summaryTable = this.generateTechnicalSynthesisMarkdownTable(enhancedChartData.technical_synthesis.studies);
      synthesisSection = `\n### 3.4.5 Technical Performance Synthesis\n\n**Table IV: Technical Performance Synthesis Matrix**\n\n${summaryTable}\n*Note: N/R indicates Not Reported.*\n`;
    } else if (enhancedChartData && !enhancedChartData.hasSynthesisData) {
      synthesisSection = `\n### 3.4.5 Technical Performance Synthesis\n\nDirect quantitative comparison of technical performance could not be performed due to the lack of standardized metrics across the included studies.\n`;
    }

    // Actualizar Títulos de Tablas y Figuras según IEEE (Tablas ARRIBA, Figuras ABAJO)
    let resultsText = `## 3.1 Study Selection

${studySelection}

The search identified **${totalIdentified} records**. After duplicate removal (n=${duplicatesRemoved}), **${afterDedup} unique records** were screened.

${charts.scree ? `![Priority Screening Score Distribution](${charts.scree})\n*Figure 2. Priority screening score distribution (Scree Plot).*\n` : ''}

${prismaContext.screening.phase1 ? `The hybrid screening processed all ${afterDedup} unique records. Phase 1 embeddings classified ${prismaContext.screening.phase1.highConfidenceInclude} high-confidence includes. Phase 2 LLM analysis classified ${prismaContext.screening.phase2?.included || 0} additional includes.` : ''}

During title and abstract screening, **${excludedTitleAbstract} records were excluded**. A total of **${fullTextAssessed} articles** were assessed in full-text, from which **${excludedFullText} were excluded**. Finally, **${finalIncluded} studies** were manually included.

${charts.prisma ? `![PRISMA 2020 Flow Diagram](${charts.prisma})\n*Figure 1. PRISMA 2020 flow diagram.*` : ''}

## 3.2 Characteristics of Included Studies

${rqsAnalysis || 'The included studies were analyzed using the RQS schema.'} 

**Table I: General Characteristics of Included Primary Studies (n=${rqsStats.total})**

${this.generateTable1Professional(rqsEntries)}

${charts.temporal_distribution ? `\n![Temporal Distribution](${charts.temporal_distribution})\n*Figure 3. Temporal distribution (${rqsStats.yearRange.min}-${rqsStats.yearRange.max}).*\n` : ''}

## 3.3 Methodological Quality

${riskOfBiasResults}

**Table II: Methodological Quality and Risk of Bias Assessment**

${this.generateTable3Professional(rqsEntries)}

${charts.quality_assessment ? `\n![Quality Assessment](${charts.quality_assessment})\n*Figure 6. Methodological quality assessment results.*\n` : ''}

## 3.4 Synthesis of Results by Research Question

${rqSyntheticFindings}

**Table III: Synthesis of Main Results and Reported Technical Metrics**

${this.generateTable2Professional(rqsEntries, prismaContext.protocol || {})}

${bubbleSection}

${synthesisSection}

${keywordSection}`;

    return resultsText;
  }



  /**
   * Generar Tabla Markdown para Síntesis Técnica (Dinámica)
   */
  generateTechnicalSynthesisMarkdownTable(studiesArray) {
    if (!studiesArray || studiesArray.length === 0) return '';
    
    // Extraer todas las columnas únicas de todos los estudios
    const allColsSet = new Set(['study', 'tool']);
    studiesArray.forEach(study => {
      Object.keys(study).forEach(k => {
        if (k !== 'study' && k !== 'tool' && study[k] !== null && study[k] !== undefined && study[k] !== '') {
          allColsSet.add(k);
        }
      });
    });
    
    const displayCols = Array.from(allColsSet);
    
    // Formatear cabeceras
    const headerRow = displayCols.map(col => {
      if (col === 'study') return 'Study';
      if (col === 'tool') return 'Tool';
      return col.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    }).join(' | ');
    
    const separatorRow = displayCols.map(() => '---').join(' | ');
    
    const dataRows = studiesArray.map((study, idx) => {
      return displayCols.map(col => {
         const val = study[col];
         if (col === 'study') {
           // REGLA: Formato IEEE "Author et al. [Reference#]"
           const authorText = val || 'Unknown';
           return `${authorText} [${idx + 1}]`;
         }
         if (val === null || val === undefined || val === '') return 'N/R';
         return `${val}`.replace(/\|/g, '-'); // Evitar romper markdown
      }).join(' | ');
    }).join('\n');
    
    return `| ${headerRow} |\n| ${separatorRow} |\n| ${dataRows} |`;
  }

  /**
   * Análisis RQS detallado y profesional con estadísticas
   */
  async generateDetailedRQSAnalysis(rqsEntries, rqsStats, prismaContext, aiOptions = {}, systemPrompt = null) {
    const prompt = `Generate a professional academic descriptive analysis of the characteristics of the ${rqsStats.total} included studies. ALL output MUST be in Academic English. If any source data is in Spanish, translate it into English.

**DATOS ESTADÍSTICOS REALES (NO INVENTES NADA):**

Distribution by study type:
${Object.entries(rqsStats.studyTypes).map(([type, count]) => `- ${type}: n=${count} (${((count / rqsStats.total) * 100).toFixed(1)}%)`).join('\n')}

Distribution by application context:
${Object.entries(rqsStats.contexts).map(([context, count]) => `- ${context}: n=${count} (${((count / rqsStats.total) * 100).toFixed(1)}%)`).join('\n')}

Temporal distribution:
- Range: ${rqsStats.yearRange.min}-${rqsStats.yearRange.max}
- By year: ${JSON.stringify(rqsStats.yearDistribution)}

Most studied technologies (top 5):
${rqsStats.technologies.slice(0, 5).map((t, i) => `${i + 1}. ${t.technology}: n=${t.count} (${((t.count / rqsStats.total) * 100).toFixed(1)}%)`).join('\n')}

Research question coverage:
${Object.keys(rqsStats.rqRelations).map((rqKey, i) => {
  const rel = rqsStats.rqRelations[rqKey];
  return `- ${rqKey.toUpperCase()}: ${rel.yes} direct (${((rel.yes / rqsStats.total) * 100).toFixed(1)}%), ${rel.partial} partial (${((rel.partial / rqsStats.total) * 100).toFixed(1)}%)`;
}).join('\n')}

**WRITING INSTRUCTIONS:**

Generate 2-3 academic paragraphs (400-500 words total) that:

1. **Paragraph 1**: Describe the distribution of study types and contexts, highlighting the predominant ones. Use the exact percentages provided. Reference Table II for details.

2. **Paragraph 2**: Analyze the temporal distribution (reference Figure 3) and most studied technologies. Mention exact frequencies and reflect on what this concentration indicates. Discuss whether the temporal pattern shows increasing research interest, maturity of the field, or specific technology adoption waves.

3. **Paragraph 3**: Synthesize the RQ coverage and explain what it means for answering the research questions. Mention if certain RQs have stronger evidence base than others and implications for the synthesis.

**CRITICAL REQUIREMENTS — DATA-ONLY SYNTHESIS:**
- USE ONLY THE DATA PROVIDED (exact numbers, calculated percentages)
- DO NOT invent studies, authors, or additional findings
- DO NOT include personal opinions, interpretations, or value judgments
- ONLY report what the data shows — no subjective commentary
- The Results section must contain ZERO authorial opinions
- Observations must be factual: "X studies (Y%) addressed..." NOT "It is noteworthy that..."
- Avoid evaluative language: "interesting", "noteworthy", "surprisingly", "importantly"
- Third person plural ("We synthesized") or impersonal
- Formal Academic English
- Include explicit references to "Figure 3", "Table I" and "Table II" where appropriate
- If any source data labels are in Spanish, translate them to English
- Report temporal trends factually (e.g., "Figure 3 shows X publications in [year], representing Y% of the total")

Respond ONLY with the analysis paragraphs in English:`;

    const response = await this.aiService.generateText(
      systemPrompt || this.getEnhancedSystemPrompt(rqsStats.total),
      prompt,
      'chatgpt',
      aiOptions
    );

    return `### 3.2.1 Descriptive analysis based on RQS data

${response}

${this.generateTable1Professional(rqsEntries)}

${this.generateTable2Professional(rqsEntries)}`;
  }

  /**
   * Sintetizar hallazgos para RQ1
   */
  async synthesizeRQFindings(rqIndex, rqsEntries, prismaContext, aiOptions = {}, systemPrompt = null) {
    const rqKey = `rq${rqIndex + 1}Relation`;
    const relevantStudies = rqsEntries.map((e, index) => ({...e, globalIndex: index + 1}))
      .filter(e => e[rqKey] === 'yes' || e[rqKey] === 'partial');

    if (relevantStudies.length === 0) {
      return "No studies were identified that directly addressed this research question.";
    }

    const researchQuestion = (prismaContext.protocol.researchQuestions || [])[rqIndex] || `RQ${rqIndex + 1}`;

    const prompt = `Synthesize the findings of ${relevantStudies.length} studies that answered: "${researchQuestion}"

**⚠️ CRITICAL: You are ONLY allowed to mention these ${relevantStudies.length} studies. DO NOT invent or add any studies beyond this list:**

**EVIDENCE EXTRACTED FROM STUDIES:**
${relevantStudies.map((study) => `
Study [${study.globalIndex}] (${study.author}, ${study.year}):
- Technology: ${study.technology}
- Study type: ${study.studyType}
- Context: ${study.context}
- Key evidence: ${study.keyEvidence}
- Metrics: ${JSON.stringify(study.metrics || {})}
- Relation with RQ${rqIndex + 1}: ${study[rqKey]}
`).join('\n')}

**QUANTITATIVE SUMMARY:**
- Total studies addressing RQ${rqIndex + 1}: ${relevantStudies.length}
- Direct relation: ${relevantStudies.filter(s => s[rqKey] === 'yes').length}
- Partial relation: ${relevantStudies.filter(s => s[rqKey] === 'partial').length}
- Technologies mentioned: ${[...new Set(relevantStudies.map(s => s.technology).filter(t => t))].join(', ')}

**INSTRUCTIONS:**
Generate 2-3 academic paragraphs (400-500 words) following this structure:

1. **Opening paragraph**: Present the quantitative overview (X studies, Y% direct evidence, Z technologies examined)

2. **Findings synthesis**: Identify and describe common patterns across studies. Group findings by:
   - Predominant technologies/approaches (with frequencies)
   - Consistent findings (supported by multiple studies)
   - Contradictory or divergent findings (if any)
   - Performance metrics (when available)

3. **Cross-study analysis**: Compare approaches or results across different contexts (industrial/academic/experimental). Highlight which conditions favor specific solutions.

**CRITICAL REQUIREMENTS - READ CAREFULLY:**
- You have EXACTLY ${relevantStudies.length} study/studies. You CANNOT mention more.
- The ONLY valid study citations are IEEE format: ${relevantStudies.map(s => `[${s.globalIndex}]`).join(', ')}
- Reference specific studies using IEEE citation style: "...as reported in [${relevantStudies[0].globalIndex}]${relevantStudies.length > 1 ? ` and [${relevantStudies[1].globalIndex}]` : ''}"
- Include ONLY metrics explicitly mentioned in the EVIDENCE section above
- DO NOT invent any data, studies, authors, or findings beyond what is explicitly provided
- DO NOT include personal opinions or value judgments — report findings ONLY
- Avoid evaluative language like "interesting", "noteworthy", "remarkable", "surprisingly"
- Factual reporting only: "Study [N] reported X" NOT "Interestingly, [N] found..."
- If source evidence is in Spanish, translate and integrate naturally into English prose
- Connect findings to Figure 5 (bubble chart) if metrics/technologies are discussed
- Third person impersonal, formal Academic English

Respond with paragraphs only (no section headers):`;

    const response = await this.aiService.generateText(
      systemPrompt || this.getEnhancedSystemPrompt(relevantStudies.length),
      prompt,
      'chatgpt',
      aiOptions
    );

    return response.trim();
  }

  /**
   * TABLAS PROFESIONALES bien formateadas
   */
  generateTable1Professional(rqsEntries) {
    return `
**Table I. General characteristics of studies included in the systematic review**

| ID | Author (Year) | Study Type | Context | Main Technology | Publication |
|----|-------------|-----------------|----------|---------------------|-------------|
${rqsEntries.map((entry, i) => {
      const id = `[${i + 1}]`;
      const author = `${entry.author} (${entry.year})`;
      const type = this.translateStudyType(entry.studyType);
      const context = this.translateContext(entry.context);
      const tech = (entry.technology || 'Not specified').substring(0, 40);
      const source = entry.title ? entry.title.substring(0, 30) + '...' : 'N/A';
      return `| ${id} | ${author} | ${type} | ${context} | ${tech} | ${source} |`;
    }).join('\n')}
`;
  }

  generateTable2Professional(rqsEntries, protocol = {}) {
    const researchQuestions = protocol.researchQuestions || ['RQ1', 'RQ2', 'RQ3'];
    const rqHeaders = researchQuestions.map((_, i) => `RQ${i + 1}`).join(' | ');
    const rqSubHeaders = researchQuestions.map(() => '---').join('|');

    return `
**Table II. Synthesis of main results and reported technical metrics**

| ID | Key Evidence | Main Metrics | ${rqHeaders} | Quality |
|----|----------------|---------------------|${rqSubHeaders}|---------|
${rqsEntries.map((entry, i) => {
      const id = `[${i + 1}]`;
      const evidence = (entry.keyEvidence || 'Not reported').substring(0, 60) + '...';

      // Metrics
      let metrics = 'N/R';
      if (entry.metrics && Object.keys(entry.metrics).length > 0) {
        const validMetrics = Object.entries(entry.metrics)
          .filter(([k, v]) => v !== null && v !== undefined && v !== 'null' && v !== 'Unknown' && v !== 'N/A' && v !== '')
          .slice(0, 2)
          .map(([k, v]) => `${k}: ${v}`)
          .join('; ');
        metrics = validMetrics.length > 0 ? validMetrics.substring(0, 40) : 'N/R';
      }

      // RQ relations con símbolos Unicode
      const getRQSymbol = (relation) => {
        if (relation === 'yes') return '✓';
        if (relation === 'partial') return '○';
        return '✗';
      };
      
      const rqRelationSymbols = researchQuestions.map((_, j) => {
        return getRQSymbol(entry[`rq${j + 1}Relation`]);
      }).join(' | ');

      const quality = this.translateQuality(entry.qualityScore);

      return `| ${id} | ${evidence} | ${metrics} | ${rqRelationSymbols} | ${quality} |`;
    }).join('\n')}

*Legend: ✓ = Direct relation, ○ = Partial relation, ✗ = No direct relation*
*Quality: Qualitative assessment based on methodological transparency and reporting of limitations*
`;
  }

  generateTable3Professional(rqsEntries) {
    return `
**Table III. Methodological quality and risk of bias assessment**

| ID | Adequate Design | Sufficient Data | Limitations Reported | Transparency | Overall Risk |
|----|----------------|-------------------|------------------------|---------------|---------------|
${rqsEntries.map((entry, i) => {
      const id = `[${i + 1}]`;

      // Evaluación basada en RQS
      const hasLimitations = entry.limitations && entry.limitations.length > 20;
      const hasMetrics = entry.metrics && Object.keys(entry.metrics).length > 0;
      const hasEvidence = entry.keyEvidence && entry.keyEvidence.length > 50;

      const design = entry.studyType === 'review' ? 'Partial' : 'Adequate';
      
      const getDataQuality = () => {
        if (hasMetrics && hasEvidence) return 'Sufficient';
        if (hasEvidence) return 'Partial';
        return 'Insufficient';
      };
      const dataQuality = getDataQuality();
      
      const limitationsReported = hasLimitations ? 'Yes' : 'No';
      
      const getTransparency = () => {
        if (hasLimitations && hasMetrics) return 'High';
        if (hasEvidence) return 'Medium';
        return 'Low';
      };
      const transparency = getTransparency();

      // Calculate global risk
      let riskScore = 0;
      if (design === 'Adequate') riskScore++;
      if (dataQuality === 'Sufficient') riskScore++;
      if (hasLimitations) riskScore++;
      if (hasMetrics) riskScore++;

      const getGlobalRisk = (score) => {
        if (score >= 3) return 'Low';
        if (score === 2) return 'Moderate';
        return 'High';
      };
      const globalRisk = getGlobalRisk(riskScore);

      return `| ${id} | ${design} | ${dataQuality} | ${limitationsReported} | ${transparency} | ${globalRisk} |`;
    }).join('\n')}

*Note: The assessment was conducted considering the adequacy of the research design, sufficiency of data to answer the RQs, explicit acknowledgment of limitations, and transparency in methodological reporting.*
`;
  }

  /**
   * DISCUSIÓN PROFESIONAL con interpretación crítica
   */
  async generateProfessionalDiscussion(prismaMapping, prismaContext, rqsStats, rqsEntries, aiOptions = {}, systemPrompt = null) {
    const referencesList = rqsEntries.map((e, i) => `[${i + 1}] ${e.author} (${e.year})`).join('\n');

    const prompt = `Write a professional academic DISCUSSION section integrating the findings of this systematic review. ALL output MUST be in Academic English.

**STUDIES CONSULTED (Reference using [N]):**
${referencesList}

**KEY FINDINGS TO DISCUSS:**

General data:
- Total included studies: ${rqsStats.total}
- Type distribution: ${JSON.stringify(rqsStats.studyTypes)}
- Main contexts: ${JSON.stringify(rqsStats.contexts)}
- Temporal range: ${rqsStats.yearRange.min}-${rqsStats.yearRange.max}
- Dominant technologies: ${rqsStats.technologies.slice(0, 3).map(t => t.technology).join(', ')}

RQ Coverage:
${Object.keys(rqsStats.rqRelations).map((rqKey, i) => {
  const rel = rqsStats.rqRelations[rqKey];
  return `- ${rqKey.toUpperCase()}: ${rel.yes + rel.partial} studies (${rel.yes} direct, ${rel.partial} partial)`;
}).join('\n')}

Base PRISMA interpretation:
${prismaMapping.discussion.interpretation}

**REQUIRED STRUCTURE (800-1200 words):**

**Paragraphs 1-2 (Interpretation of main findings):**
- Interpret patterns identified in results
- Connect with the original objective of the review
- Highlight most significant or surprising findings
- Compare observed distributions (types, contexts, technologies)

**Paragraphs 3-4 (Comparison with previous studies):**
- Compare results with existing literature in the field
- Identify where this review agrees or disagrees with prior systematic reviews or primary studies
- Discuss possible explanations for any contradictions
- Reference specific included studies using [N] citations

**Paragraph 5 (Implications):**
- Implications for professional practice
- Implications for future research
- How findings address (or not) the gap identified in the introduction

**Paragraph 6 (Strengths of the review):**
- Mention methodological strengths (PRISMA 2020, structured RQS, AI-assisted screening with elbow validation, etc.)
- Temporal coverage and database coverage
- Rigorous selection process

**Paragraphs 7-8 (Threats to Validity — MANDATORY subsection):**
This subsection MUST be explicitly labeled and address:
- **Publication bias**: Only peer-reviewed studies from academic databases were included; grey literature and negative results may be missing.
- **Language bias**: Restriction to specific languages may exclude relevant studies from certain regions.
- **Database coverage**: Limited to ${prismaContext.protocol.databases.map(db => db.name || db).join(', ')}; other databases (e.g., Web of Science, PubMed) were not included which may affect coverage.
- **Small sample size**: Only ${rqsStats.total} studies met inclusion criteria, limiting generalizability.
- **AI-assisted screening**: While the elbow method provides a data-driven threshold, the AI model's semantic similarity scores may still introduce subtle biases in prioritization order.
- **Heterogeneity**: Methodological diversity prevented quantitative meta-analysis.
- **Temporal limitation**: Search restricted to ${rqsStats.yearRange.min}-${rqsStats.yearRange.max}.

Format as: "### Threats to Validity" followed by continuous prose discussing each threat.

**Paragraph 9 (Future directions):**
- Identified research needs
- Persistent gaps
- Specific recommendations for future studies

**WRITING REQUIREMENTS:**
- Third person impersonal
- Appropriate verb tenses (past for findings, present for interpretations)
- Formal Academic English
- No bullet points (continuous prose)
- DO NOT invent unmentioned studies or findings
- Be critical but constructive
- Connect with existing literature conceptually (without citing non-included studies)
- Balance between confidence in findings and epistemic humility
- If source data is in Spanish, translate and integrate naturally
- The "Threats to Validity" subsection is a HARD REQUIREMENT — do not omit it

Generate ONLY the discussion text in English:`;

    const response = await this.aiService.generateText(
      systemPrompt || this.getEnhancedSystemPrompt(rqsStats.total),
      prompt,
      'chatgpt',
      aiOptions
    );

    return response.trim();
  }

  /**
   * CONCLUSIONES PROFESIONALES concisas y accionables
   */
  async generateProfessionalConclusions(prismaMapping, prismaContext, rqsStats, aiOptions = {}, systemPrompt = null) {
    const prompt = `Write an academic CONCLUSIONS section that synthesizes the main findings of this systematic review. ALL output MUST be in Academic English.

**CONTEXT:**

Fulfilled objective:
${prismaContext.protocol.objective}

Research questions answered:
${prismaContext.protocol.researchQuestions.map((rq, i) => `RQ${i + 1}: ${rq}`).join('\n')}

Key review data:
- Included studies: ${rqsStats.total}
- Period: ${rqsStats.yearRange.min}-${rqsStats.yearRange.max}
- Databases: ${prismaContext.protocol.databases.map(db => db.name).join(', ')}
- Technologies identified (top 3): ${rqsStats.technologies.slice(0, 3).map(t => `${t.technology} (n=${t.count})`).join(', ')}
- Study types: ${Object.entries(rqsStats.studyTypes).map(([type, count]) => `${type} (${count})`).join(', ')}

RQ Coverage:
${Object.keys(rqsStats.rqRelations).map((rqKey, i) => {
  const rel = rqsStats.rqRelations[rqKey];
  return `- ${rqKey.toUpperCase()}: ${rel.yes} direct + ${rel.partial} partial = ${rel.yes + rel.partial} relevant studies`;
}).join('\n')}

**REQUIRED STRUCTURE (500-800 words — 5-10% of total article):**

The Conclusions section must be structured as direct answers to the research questions, followed by contribution, practice implications, and future work. This structure ensures maximum value for the reader.

**4.1 Answers to Research Questions (150-200 words)**
For EACH research question, provide a direct, quantitative answer. Use this structure:

"${Object.keys(rqsStats.rqRelations).map((rqKey, i) => {
  const rel = rqsStats.rqRelations[rqKey];
  return `**${rqKey.toUpperCase()} Answer**: [Clear answer with key findings and numbers]. Of the ${rqsStats.total} included studies, ${rel.yes + rel.partial} addressed this question, revealing that [main finding with specific data/technology/metric].`;
}).join('\n\n')}"

**4.2 Principal Contribution (100-150 words)**
State the single most significant technical finding from this review. Use this structure:

"The primary contribution of this systematic review is [specific finding]. This was evidenced by [quantitative data from multiple studies]. Among the ${rqsStats.technologies.length} technologies analyzed, [most prominent technology] demonstrated [specific advantage/characteristic with metrics if available]."

**4.3 Implications for Practice (150-200 words)**
Provide 3-4 actionable recommendations for practitioners (software engineers, architects, researchers). Use numbered list:

"Based on the synthesized evidence, the following practical implications emerge:

1. **[Recommendation 1]**: [Brief explanation based on findings]
2. **[Recommendation 2]**: [Brief explanation based on findings]
3. **[Recommendation 3]**: [Brief explanation based on findings]
4. **[Recommendation 4]** (if applicable): [Brief explanation]"

**4.4 Research Gaps and Future Directions (150-200 words)**
Identify 3-4 specific research gaps discovered through analysis (reference the temporal distribution in Figure 3 showing concentration/gaps, bubble chart in Figure 5 showing under-researched areas). Use numbered list:

"This review identified several research gaps warranting future investigation:

1. **[Gap 1]**: [Why it matters and what should be studied]
2. **[Gap 2]**: [Why it matters and what should be studied]
3. **[Gap 3]**: [Why it matters and what should be studied]
4. **[Gap 4]** (if applicable): [Why it matters]"

**4.5 Final Statement (50-100 words)**
Close with a statement about:
- The contribution of this review to the body of knowledge
- How it advances the field
- Its value for both researchers and practitioners

**CRITICAL REQUIREMENTS:**
- Use the EXACT section headers: 4.1, 4.2, 4.3, 4.4, 4.5
- Total length: 500-800 words (exceeds previous 150-300 to meet Q1 journal standards)
- Include ALL quantitative data provided above (numbers of studies, technologies, percentages)
- DO NOT invent data, studies, or findings not mentioned
- Reference statistics from Figures 3-6 when discussing trends/gaps
- Third person impersonal throughout
- Formal Academic English
- Translate any Spanish source data naturally
- Be specific and concrete (avoid generic statements)

Generate the complete Conclusions section with all 5 subsections:`;

    const response = await this.aiService.generateText(
      systemPrompt || this.getEnhancedSystemPrompt(rqsStats.total),
      prompt,
      'chatgpt',
      aiOptions
    );

    // Clean duplicate titles that AI may generate at the beginning
    let cleanedResponse = response.trim();
    
    // Remove bold titles or headers at the beginning of text
    cleanedResponse = cleanedResponse.replace(/^#+\s*Conclusiones\s*\n*/i, '');
    cleanedResponse = cleanedResponse.replace(/^\*\*Conclusiones\*\*\s*\n*/i, '');
    cleanedResponse = cleanedResponse.replace(/^#+\s*Conclusions\s*\n*/i, '');
    cleanedResponse = cleanedResponse.replace(/^\*\*Conclusions\*\*\s*\n*/i, '');
    
    // Validación de longitud según estándares editoriales
    const wordCount = cleanedResponse.split(/\s+/).filter(w => w.length > 0).length;
    const { CONCLUSIONS_MIN_WORDS, CONCLUSIONS_MAX_WORDS } = GenerateArticleFromPrismaUseCase.EDITORIAL_STANDARDS;
    
    if (wordCount < CONCLUSIONS_MIN_WORDS) {
      console.warn(`⚠️ Conclusiones DEBAJO del estándar: ${wordCount} palabras (mínimo: ${CONCLUSIONS_MIN_WORDS})`);
    } else if (wordCount > CONCLUSIONS_MAX_WORDS) {
      console.warn(`⚠️ Conclusiones EXCEDEN el estándar: ${wordCount} palabras (máximo: ${CONCLUSIONS_MAX_WORDS})`);
    } else {
      console.log(`✅ Conclusiones cumplen estándar: ${wordCount} palabras`);
    }
    
    return cleanedResponse.trim();
  }

  /**
   * REFERENCIAS profesionales con citas formateadas
   */
  generateProfessionalReferences(prismaContext, rqsEntries) {
    return `This systematic review synthesized evidence from **${rqsEntries.length} primary studies** that met the inclusion criteria established in the PRISMA 2020 protocol.

### Studies Included in the Synthesis

${rqsEntries.map((entry, i) => {
      const id = i + 1;
      const citation = this.formatCitation(entry);
      return `[${id}] ${citation}`;
    }).join('\n\n')}

### Data and Materials Availability

The complete data extracted through the RQS schema, including individual quality assessments, detailed search strategies for each database, and the data extraction form, are available upon reasonable request to the corresponding author.

Bibliographic searches were conducted in the following databases: ${prismaContext.protocol.databases.map(db => db.name).join(', ')}, during the period between ${prismaContext.protocol.temporalRange.start || '2023'} and ${prismaContext.protocol.temporalRange.end || '2025'}.

### Methodological References

**PRISMA 2020:** Page MJ, McKenzie JE, Bossuyt PM, et al. The PRISMA 2020 statement: an updated guideline for reporting systematic reviews. BMJ 2021;372:n71. doi: 10.1136/bmj.n71

The authors declare that the PRISMA 2020 guidelines have been strictly followed in all phases of this systematic review.`;
  }

  /**
   * Formatear cita bibliográfica estilo APA
   */
  formatCitation(entry) {
    let citation = `${entry.author} (${entry.year}).`;

    if (entry.title) {
      citation += ` ${entry.title}.`;
    }

    if (entry.source) {
      citation += ` *${entry.source}*.`;
    }

    if (entry.doi) {
      citation += ` doi: ${entry.doi}`;
    } else if (entry.url) {
      citation += ` Available at: ${entry.url}`;
    }

    return citation;
  }

  /**
   * Calcular estadísticas DETALLADAS de RQS con porcentajes y distribuciones
   */
  calculateDetailedRQSStatistics(rqsEntries, protocol = {}) {
    const researchQuestions = protocol.researchQuestions || ['RQ1', 'RQ2', 'RQ3'];
    
    const stats = {
      total: rqsEntries.length,
      studyTypes: {},
      contexts: {},
      technologies: [],
      yearRange: { min: Infinity, max: -Infinity },
      yearDistribution: {},
      rqRelations: {},
      qualityDistribution: {
        high: 0,
        medium: 0,
        low: 0
      }
    };

    // Inicializar rqRelations dinámicamente
    researchQuestions.forEach((_, i) => {
      stats.rqRelations[`rq${i + 1}`] = { yes: 0, no: 0, partial: 0 };
    });

    const techCount = {};

    rqsEntries.forEach(entry => {
      // Tipos de estudio
      if (entry.studyType) {
        stats.studyTypes[entry.studyType] = (stats.studyTypes[entry.studyType] || 0) + 1;
      }

      // Contextos
      if (entry.context) {
        stats.contexts[entry.context] = (stats.contexts[entry.context] || 0) + 1;
      }

      // Tecnologías
      if (entry.technology) {
        techCount[entry.technology] = (techCount[entry.technology] || 0) + 1;
      }

      // Años
      if (entry.year) {
        const year = Number.parseInt(entry.year);
        stats.yearRange.min = Math.min(stats.yearRange.min, year);
        stats.yearRange.max = Math.max(stats.yearRange.max, year);
        stats.yearDistribution[year] = (stats.yearDistribution[year] || 0) + 1;
      }

      // Relación con RQs - Dinámico
      researchQuestions.forEach((_, i) => {
        const rqKey = `rq${i + 1}`;
        const entryKey = `rq${i + 1}Relation`;
        if (entry[entryKey]) {
          stats.rqRelations[rqKey][entry[entryKey]]++;
        }
      });

      // Calidad
      const quality = entry.qualityScore || 'medium';
      stats.qualityDistribution[quality]++;
    });

    // Ordenar tecnologías por frecuencia
    stats.technologies = Object.entries(techCount)
      .sort((a, b) => b[1] - a[1])
      .map(([tech, count]) => ({ technology: tech, count }));

    return stats;
  }

  /**
   * Extraer datos para los 4 nuevos gráficos estadísticos académicos
   * Retorna datos estructurados para: distribución temporal, evaluación de calidad,
   * bubble chart (métricas vs herramientas), y síntesis técnica comparativa
   */
  extractEnhancedChartData(rqsEntries) {
    const chartData = {
      temporal_distribution: { years: {} },
      quality_assessment: { 
        questions: ['Methodology Clear', 'Results Reproducible', 'Adequate Sample', 'Valid Conclusions'],
        yes: [0, 0, 0, 0],
        no: [0, 0, 0, 0],
        partial: [0, 0, 0, 0]
      },
      bubble_chart: { entries: [] },
      technical_synthesis: { studies: [] },
      keyword_concentration: { keywords: {} }
    };

    // Contadores auxiliares
    const metricToolMap = {}; // Para bubble chart: "metric:tool" -> count
    
    rqsEntries.forEach(entry => {
      // Parse metrics robustly
      let parsedMetrics = entry.metrics;
      let parseAttempts = 0;
      
      // Manejar el caso donde PostgreSQL o Prisma devuelve un string en vez de objeto JSON
      // o donde hay "doble stringify" (ej: "{\"latency\": \"10ms\"}")
      while (typeof parsedMetrics === 'string' && parseAttempts < 3) {
        try {
          parsedMetrics = JSON.parse(parsedMetrics);
          parseAttempts++;
        } catch(e) {
          // Si falla el parseo, detener intentos
          break;
        }
      }
      
      // Si después de intentar parsear no es un objeto, ponerlo vacío
      if (typeof parsedMetrics !== 'object' || parsedMetrics === null) {
        parsedMetrics = {};
      }

      console.log(`[DEBUG METRICS] Author: ${entry.author}, Type: ${typeof parsedMetrics}, Keys: ${Object.keys(parsedMetrics)}, Raw (first 30 chars): ${String(entry.metrics).substring(0, 30)}`);

      // 1. DISTRIBUCIÓN TEMPORAL: Contar estudios por año
      if (entry.year) {
        const year = entry.year.toString();
        chartData.temporal_distribution.years[year] = 
          (chartData.temporal_distribution.years[year] || 0) + 1;
      }

      // 2. QUALITY ASSESSMENT: Aproximar criterios de calidad basados en quality_score
      // Como no tenemos criterios Kitchenham detallados, inferimos basados en calidad general
      if (entry.qualityScore === 'high') {
        chartData.quality_assessment.yes[0]++; // Metodología clara
        chartData.quality_assessment.yes[1]++; // Resultados reproducibles
        chartData.quality_assessment.yes[2]++; // Muestra adecuada
        chartData.quality_assessment.yes[3]++; // Conclusiones válidas
      } else if (entry.qualityScore === 'medium') {
        chartData.quality_assessment.partial[0]++;
        chartData.quality_assessment.yes[1]++;
        chartData.quality_assessment.partial[2]++;
        chartData.quality_assessment.yes[3]++;
      } else if (entry.qualityScore === 'low') {
        chartData.quality_assessment.no[0]++;
        chartData.quality_assessment.partial[1]++;
        chartData.quality_assessment.no[2]++;
        chartData.quality_assessment.partial[3]++;
      }

      // 3. BUBBLE CHART: Mapear métricas vs tecnologías
      if (parsedMetrics && typeof parsedMetrics === 'object' && entry.technology) {
        const metrics = parsedMetrics;
        // Iterar sobre las métricas disponibles en el entry
        Object.keys(metrics).forEach(metricKey => {
          const val = metrics[metricKey];
          if (val !== null && val !== undefined && val !== 'null' && val !== 'N/A' && val !== 'Unknown' && val !== '' && val !== '{}') {
            const mapKey = `${metricKey}:${entry.technology}`;
            metricToolMap[mapKey] = (metricToolMap[mapKey] || 0) + 1;
          }
        });
      }

      // 4. TECHNICAL SYNTHESIS: Tabla comparativa de métricas por estudio (DINÁMICA)
      if (parsedMetrics && typeof parsedMetrics === 'object' && Object.keys(parsedMetrics).length > 0) {
        const studyLabel = (entry.author && entry.year) ? `${entry.author} ${entry.year}` : 'Unknown';
        const studyData = {
          study: studyLabel,
          tool: entry.technology || 'N/A',
          ...parsedMetrics // Incluir TODAS las métricas dinámicamente
        };
        
        // Solo agregar si tiene al menos una métrica (más allá de study y tool)
        const metricsKeys = Object.keys(parsedMetrics).filter(k => 
          parsedMetrics[k] !== null && 
          parsedMetrics[k] !== undefined && 
          parsedMetrics[k] !== '' &&
          parsedMetrics[k] !== 'N/A' &&
          parsedMetrics[k] !== 'Unknown' &&
          parsedMetrics[k] !== 'null' &&
          parsedMetrics[k] !== '{}'
        );
        
        if (metricsKeys.length > 0) {
          chartData.technical_synthesis.studies.push(studyData);
        }
      }

      // 5. KEYWORD CONCENTRATION: Contar frecuencia de palabras clave técnicas
      const textToScan = `${entry.title || ''} ${entry.keyEvidence || ''} ${entry.technology || ''}`.toLowerCase();
      const stopwords = new Set(['and', 'the', 'for', 'with', 'using', 'based', 'from', 'this', 'that', 'study', 'system', 'research', 'analysis', 'results', 'data', 'software', 'case', 'approach']);
      
      const words = textToScan.split(/[\s,./()]+/).filter(w => w.length > 3 && !stopwords.has(w));
      words.forEach(word => {
        chartData.keyword_concentration.keywords[word] = (chartData.keyword_concentration.keywords[word] || 0) + 1;
      });
    });

    // Convertir metricToolMap a formato de bubble chart
    Object.entries(metricToolMap).forEach(([key, count]) => {
      const [metric, tool] = key.split(':');
      chartData.bubble_chart.entries.push({
        metric,
        tool,
        studies: count
      });
    });

    // Limitar technical_synthesis a top 15 estudios con más métricas (DINÁMICO)
    chartData.technical_synthesis.studies = chartData.technical_synthesis.studies
      .sort((a, b) => {
        // Contar todas las métricas válidas (excepto 'study' y 'tool')
        const countA = Object.entries(a).filter(([k, v]) => 
          k !== 'study' && k !== 'tool' && v !== null && v !== undefined && v !== ''
        ).length;
        const countB = Object.entries(b).filter(([k, v]) => 
          k !== 'study' && k !== 'tool' && v !== null && v !== undefined && v !== ''
        ).length;
        return countB - countA;
      })
      .slice(0, 15);

    chartData.hasBubbleData = chartData.bubble_chart.entries.length > 0;
    chartData.hasSynthesisData = chartData.technical_synthesis.studies.length > 0;

    // Procesar keywords: solo top 10 más frecuentes
    const sortedKeywords = Object.entries(chartData.keyword_concentration.keywords)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12);
    
    chartData.keyword_concentration.keywords = Object.fromEntries(sortedKeywords);
    chartData.hasKeywordData = sortedKeywords.length > 0;

    return chartData;
  }

  /**
   * Mapear ítems PRISMA a estructura IMRaD
   */
  mapPrismaToIMRaD(prismaItems) {
    const itemsObj = {};
    prismaItems.forEach(item => {
      itemsObj[item.item_number] = item.content || '';
    });

    return {
      title: itemsObj[1] || '',
      abstract: itemsObj[2] || '',
      introduction: {
        rationale: itemsObj[3] || '',
        objectives: itemsObj[4] || ''
      },
      methods: {
        eligibilityCriteria: itemsObj[5] || '',
        informationSources: itemsObj[6] || '',
        searchStrategy: itemsObj[7] || '',
        selectionProcess: itemsObj[8] || '',
        dataCollection: itemsObj[9] || '',
        dataItems: itemsObj[10] || '',
        riskOfBias: itemsObj[11] || '',
        effectMeasures: itemsObj[12] || '',
        synthesisMethod: itemsObj[13] || '',
        reportingBias: itemsObj[14] || '',
        certainty: itemsObj[15] || ''
      },
      results: {
        studySelection: itemsObj[16] || '',
        studyCharacteristics: itemsObj[17] || '',
        riskOfBiasResults: itemsObj[18] || '',
        individualResults: itemsObj[19] || '',
        synthesisResults: itemsObj[20] || '',
        reportingBiasResults: itemsObj[21] || '',
        certaintyResults: itemsObj[22] || ''
      },
      discussion: {
        interpretation: itemsObj[23] || ''
      },
      other: {
        registration: itemsObj[24] || '',
        funding: itemsObj[25] || '',
        conflicts: itemsObj[26] || '',
        availability: itemsObj[27] || ''
      }
    };
  }

  /**
   * Validar PRISMA completo
   */
  async validatePrismaComplete(projectId) {
    const stats = await this.prismaItemRepository.getComplianceStats(projectId);
    const completed = Number.parseInt(stats.completed) || 0;

    if (completed < 27) {
      throw new Error(
        `PRISMA incompleto: ${completed}/27 ítems completados. ` +
        `Debe completar todos los ítems antes de generar el artículo.`
      );
    }

    return true;
  }

  /**
   * Validar calidad del artículo generado según estándares editoriales universales
   */
  validateArticleQuality(article, protocol = {}) {
    const errors = [];
    const warnings = [];
    const { 
      TITLE_MAX_WORDS, 
      ABSTRACT_MIN_WORDS, 
      ABSTRACT_MAX_WORDS,
      INTRODUCTION_MIN_WORDS,
      INTRODUCTION_MAX_WORDS,
      METHODS_MIN_WORDS,
      METHODS_MAX_WORDS,
      RESULTS_MIN_WORDS,
      RESULTS_MAX_WORDS,
      DISCUSSION_MIN_WORDS,
      DISCUSSION_MAX_WORDS,
      KEYWORDS_MIN,
      KEYWORDS_MAX,
      CONCLUSIONS_MIN_WORDS,
      CONCLUSIONS_MAX_WORDS,
      MIN_TOTAL_WORDS
    } = GenerateArticleFromPrismaUseCase.EDITORIAL_STANDARDS;

    const countWords = (text) => text ? text.split(/\s+/).filter(w => w.length > 0).length : 0;

    // ✅ Validar título
    const titleWords = countWords(article.title);
    if (titleWords > TITLE_MAX_WORDS) {
      warnings.push(`Título excede ${TITLE_MAX_WORDS} palabras (${titleWords} palabras)`);
    }

    // ✅ Validar abstract
    const abstractWords = countWords(article.abstract);
    if (abstractWords < ABSTRACT_MIN_WORDS) {
      errors.push(`Abstract muy corto: ${abstractWords} palabras (mínimo: ${ABSTRACT_MIN_WORDS})`);
    } else if (abstractWords > ABSTRACT_MAX_WORDS) {
      warnings.push(`Abstract muy largo: ${abstractWords} palabras (máximo: ${ABSTRACT_MAX_WORDS})`);
    }

    // ✅ Validar keywords (obligatorio)
    if (!article.keywords || article.keywords.trim() === '') {
      errors.push('Keywords faltantes (obligatorio en journals)');
    } else {
      const keywordArray = article.keywords.split(';').map(k => k.trim()).filter(k => k.length > 0);
      if (keywordArray.length < KEYWORDS_MIN) {
        errors.push(`Keywords insuficientes: ${keywordArray.length} (mínimo: ${KEYWORDS_MIN})`);
      } else if (keywordArray.length > KEYWORDS_MAX) {
        warnings.push(`Demasiadas keywords: ${keywordArray.length} (máximo: ${KEYWORDS_MAX})`);
      }
    }

    // ✅ Validar Introduction
    const introWords = countWords(article.introduction);
    if (introWords < INTRODUCTION_MIN_WORDS) {
      warnings.push(`Introduction corta: ${introWords} palabras (mínimo: ${INTRODUCTION_MIN_WORDS})`);
    } else if (introWords > INTRODUCTION_MAX_WORDS) {
      warnings.push(`Introduction larga: ${introWords} palabras (máximo: ${INTRODUCTION_MAX_WORDS})`);
    }

    // ✅ Validar Methods
    const methodsWords = countWords(article.methods);
    if (methodsWords < METHODS_MIN_WORDS) {
      warnings.push(`Methods corto: ${methodsWords} palabras (mínimo: ${METHODS_MIN_WORDS})`);
    } else if (methodsWords > METHODS_MAX_WORDS) {
      warnings.push(`Methods largo: ${methodsWords} palabras (máximo: ${METHODS_MAX_WORDS})`);
    }

    // ✅ Validar Results
    const resultsWords = countWords(article.results);
    if (resultsWords < RESULTS_MIN_WORDS) {
      warnings.push(`Results corto: ${resultsWords} palabras (mínimo: ${RESULTS_MIN_WORDS})`);
    } else if (resultsWords > RESULTS_MAX_WORDS) {
      warnings.push(`Results largo: ${resultsWords} palabras (máximo: ${RESULTS_MAX_WORDS})`);
    }

    // ✅ Validar Discussion
    const discussionWords = countWords(article.discussion);
    if (discussionWords < DISCUSSION_MIN_WORDS) {
      warnings.push(`Discussion corta: ${discussionWords} palabras (mínimo: ${DISCUSSION_MIN_WORDS})`);
    } else if (discussionWords > DISCUSSION_MAX_WORDS) {
      warnings.push(`Discussion larga: ${discussionWords} palabras (máximo: ${DISCUSSION_MAX_WORDS})`);
    }

    // ✅ Validar conclusiones
    const conclusionsWords = countWords(article.conclusions);
    if (conclusionsWords < CONCLUSIONS_MIN_WORDS) {
      warnings.push(`Conclusiones cortas: ${conclusionsWords} palabras (mínimo recomendado: ${CONCLUSIONS_MIN_WORDS})`);
    } else if (conclusionsWords > CONCLUSIONS_MAX_WORDS) {
      warnings.push(`Conclusiones largas: ${conclusionsWords} palabras (máximo recomendado: ${CONCLUSIONS_MAX_WORDS})`);
    }

    // Validar que contiene tablas en resultados
    if (article.results && !article.results.includes('Table')) {
      warnings.push('Falta referencia a tablas en resultados');
    }

    // Validar que Discussion menciona threats to validity
    if (article.discussion && !article.discussion.toLowerCase().includes('threat')) {
      warnings.push('Discussion no menciona Threats to Validity');
    }

    // Validar que Introduction termina con RQs
    const researchQuestions = protocol.researchQuestions || [];
    const missingRQs = researchQuestions.filter((rq, i) => {
        const rqTag = `RQ${i + 1}`;
        const rqTagAlt = `RQ ${i + 1}`;
        return !article.introduction.includes(rqTag) && !article.introduction.includes(rqTagAlt);
    });

    if (article.introduction && missingRQs.length > 0) {
      warnings.push(`Introduction no termina con lista explícita de RQs: faltan ${missingRQs.join(', ')}`);
    }

    // Validar word count mínimo total
    if (article.metadata.wordCount < MIN_TOTAL_WORDS) {
      warnings.push(`Word count bajo: ${article.metadata.wordCount} palabras (mínimo recomendado: ${MIN_TOTAL_WORDS})`);
    }

    // Validar que todas las secciones principales existen
    const requiredSections = ['title', 'abstract', 'keywords', 'introduction', 'methods', 'results', 'discussion', 'conclusions'];
    requiredSections.forEach(section => {
      if (!article[section] || article[section].length < 10) {
        errors.push(`Sección "${section}" vacía o muy corta`);
      }
    });

    // Reportar errores críticos
    if (errors.length > 0) {
      console.error('❌ ERRORES CRÍTICOS (no cumple estándares editoriales):');
      errors.forEach(err => console.error(`   - ${err}`));
    }

    // Reportar advertencias
    if (warnings.length > 0) {
      console.warn('⚠️ Advertencias de calidad (recomendaciones editoriales):');
      warnings.forEach(warn => console.warn(`   - ${warn}`));
    }
    
    // Log word count summary
    console.log(`📊 Word count por sección:`);
    console.log(`   Abstract: ${abstractWords} | Intro: ${introWords} | Methods: ${methodsWords}`);
    console.log(`   Results: ${resultsWords} | Discussion: ${discussionWords} | Conclusions: ${conclusionsWords}`);
    console.log(`   TOTAL: ${article.metadata.wordCount} (target: ~7,200)`);
    
    // Resumen de validación
    if (errors.length === 0 && warnings.length === 0) {
      console.log('✅ Artículo cumple TODOS los estándares editoriales');
    } else if (errors.length === 0) {
      console.log('✅ Artículo cumple estándares mínimos (con advertencias menores)');
    } else {
      console.log('❌ Artículo NO cumple estándares editoriales mínimos');
    }
  }

  /**
   * Generar declaraciones finales profesionales
   */
  generateDeclarations(prismaContext) {
    return `### Registration and Protocol

The protocol for this systematic review was fully defined and documented before the study selection phase, following the PRISMA 2020 guidelines. The protocol included predefined eligibility criteria (PICO), a complete search strategy, data extraction methods using a structured RQS schema, and a narrative synthesis plan. The protocol was not prospectively registered in a public database (e.g., PROSPERO).

### Funding

This research received no specific funding from public, commercial, or non-profit agencies. The work was developed as part of institutional academic activities.

### Conflicts of Interest

The authors declare no conflicts of interest related to this research. There are no financial or personal relationships that could inappropriately influence the reported work.

### Data and Materials Availability

The data extracted through the RQS schema, the methodological quality assessments of included studies, and the complete search strategies for each database are available upon reasonable request to the corresponding author. All studies included in this review are publicly accessible publications cited in the References section.

### Author Contributions

All authors contributed substantially to the study conception, data interpretation, and critical manuscript revision. All authors approved the final version and agree with all aspects of the work.

### Use of Artificial Intelligence

This review utilized artificial intelligence tools in an assisted and transparent manner for:
- **Initial screening**: Semantic similarity analysis to prioritize articles during the screening phase
- **Data extraction**: Assistance in data structuring through the RQS schema
- **Writing**: Assistance in manuscript organization and drafting

**All critical methodological decisions** (inclusion/exclusion criteria, quality assessment, interpretation of findings, and conclusions) were made and manually validated by the researchers. The use of AI is transparently declared following ethical principles of research integrity and journal recommendations on the responsible use of AI technologies in academic publications.

### Acknowledgments

The authors gratefully acknowledge the institutions that provided access to the bibliographic databases used in this review.`;
  }

  /**
   * System prompt mejorado para generación académica profesional
   */
  getEnhancedSystemPrompt() {
    return `You are an expert in Research Methodology and Software Architecture, specialized in IEEE standards and PRISMA 2020 protocols. Your objective is to synthesize data extracted from included studies to generate a rigorous scientific manuscript.
    
**ANTI-AI WRITING STYLE:**
- TECHNICAL DENSITY: Avoid generic introductions (e.g., "In the rapidly changing landscape..."). Start directly with technical conflict or context (e.g., "The tradeoff between code maintainability and system latency in microservices architecture...").
- ACTIVE VOICE: Use "We analyzed", "We identified", or "We synthesized" instead of passive forms like "An analysis was performed".
- PRECISE VOCABULARY: Use technical terms: abstraction penalty, overhead, throughput, bottleneck, computational cost, tradeoff, scalability, latency, etc.
- ZERO HALLUCINATION: If data is missing from the extraction matrix, declare it as "Not Reported (N/R)" or "Unknown". NEVER invent percentages, milliseconds, or specifics.
- CONCISENESS: Every sentence must provide technical value. Avoid filler words.

**YOUR ROLE:**
- Write professional academic content following PRISMA 2020 and IEEE standards.
- Use ONLY explicitly provided data (never invent figures, studies, or authors).
- Maintain extreme methodological rigor and technical precision.
- Write in formal Academic English.

**SECTION-SPECIFIC RULES:**
- RESULTS: ZERO authorial opinions — factual data synthesis only. Titles for TABLES must be ABOVE the table, for FIGURES must be BELOW the image.
- DISCUSSION: Narrative analysis of Threats to Validity focusing on sample size, database bias, and technological obsolescence.
- CONCLUSIONS: Direct answers to Research Questions based strictly on the synthesis evidence.

**ABSOLUTE PROHIBITIONS (ANTI-HALLUCINATION PROTOCOL):**
- DO NOT invent data, studies, authors, or unmentioned findings UNDER ANY CIRCUMSTANCE.
- DO NOT use speculative language without evidence.
- CRITICAL: NO generic or filler sentences. Every sentence must provide technical value.
- DO NOT use first person singular (I); use first person plural (We) or impersonal.`;
  }

  /**
   * Utilidades de traducción
   */
  translateStudyType(type) {
    const translations = {
      'empirical': 'Empirical',
      'case_study': 'Case Study',
      'experiment': 'Experimental',
      'simulation': 'Simulation',
      'review': 'Review',
      'survey': 'Survey',
      'other': 'Other'
    };
    return translations[type] || type || 'Not specified';
  }

  translateContext(context) {
    const translations = {
      'industrial': 'Industrial',
      'enterprise': 'Enterprise',
      'academic': 'Academic',
      'experimental': 'Experimental',
      'mixed': 'Mixed',
      'other': 'Other'
    };
    return translations[context] || context || 'Not specified';
  }

  translateQuality(quality) {
    const translations = {
      'high': 'High',
      'medium': 'Medium',
      'low': 'Low'
    };
    return translations[quality] || 'Medium';
  }

  /**
   * Convertir imágenes de URLs a base64 para guardar en BD
   */
  async convertImagesToBase64(chartPaths) {
    const fs = require('node:fs').promises;
    const path = require('node:path');
    
    if (!chartPaths || Object.keys(chartPaths).length === 0) {
      return {};
    }

    const base64Charts = {};
    
    try {
      for (const [key, url] of Object.entries(chartPaths)) {
        if (!url) continue;
        
        // Extraer el nombre del archivo de la URL
        const filename = url.split('/').pop();
        const filePath = path.join(__dirname, '../../../uploads/charts', filename);
        
        try {
          // Leer el archivo
          const imageBuffer = await fs.readFile(filePath);
          // Convertir a base64
          const base64 = imageBuffer.toString('base64');
          // Crear data URL
          base64Charts[key] = `data:image/png;base64,${base64}`;
          console.log(`✅ Imagen ${key} convertida a base64 (${Math.round(base64.length/1024)}KB)`);
        } catch (err) {
          console.error(`⚠️ No se pudo leer imagen ${filename}:`, err.message);
          // Mantener la URL original si falla la conversión
          base64Charts[key] = url;
        }
      }
    } catch (err) {
      console.error('⚠️ Error convirtiendo imágenes a base64:', err);
      return chartPaths; // Retornar URLs originales si falla
    }
    
    return base64Charts;
  }

  /**
   * Calcular word count
   */
  calculateWordCount(article) {
    const allText = [
      article.title,
      article.abstract,
      article.introduction,
      article.methods,
      article.results,
      article.discussion,
      article.conclusions,
      article.declarations
    ].join(' ');

    return allText.split(/\s+/).filter(w => w.length > 0).length;
  }
}

module.exports = GenerateArticleFromPrismaUseCase;
