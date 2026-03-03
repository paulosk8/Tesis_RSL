/**
 * Caso de uso: Importar referencias desde archivos
 * Versión simplificada - parsea formatos básicos
 */
class ImportReferencesUseCase {
  constructor({ referenceRepository }) {
    this.referenceRepository = referenceRepository;
  }

  /**
   * Detecta la base de datos de origen desde el nombre del archivo o metadatos
   * @param {string} filename - Nombre del archivo
   * @param {Object} ref - Objeto de referencia parseado
   * @returns {string} - Nombre de la base de datos
   */
  detectDatabaseSource(filename, ref = {}) {
    const lowerFilename = filename.toLowerCase();
    
    // Detección por nombre de archivo
    if (lowerFilename.includes('ieee')) return 'IEEE Xplore';
    if (lowerFilename.includes('scopus')) return 'Scopus';
    if (lowerFilename.includes('acm')) return 'ACM Digital Library';
    if (lowerFilename.includes('pubmed') || lowerFilename.includes('.nb ib')) return 'PubMed';
    if (lowerFilename.includes('wos') || lowerFilename.includes('webofscience') || lowerFilename.endsWith('.ciw')) return 'Web of Science';
    if (lowerFilename.includes('springer')) return 'Springer';
    if (lowerFilename.includes('sciencedirect') || lowerFilename.includes('elsevier')) return 'ScienceDirect';
    if (lowerFilename.includes('arxiv')) return 'arXiv';
    
    // Detección por metadatos de la referencia (para CSV normalizado)
    if (ref.database) return ref.database;
    
    // Detección por identificadores únicos
    if (ref.externalId) {
      const id = String(ref.externalId).toLowerCase();
      if (id.startsWith('2-s2.0-')) return 'Scopus'; // Scopus EID format
      if (id.match(/^\d{8}$/)) return 'PubMed'; // PMID format
      if (id.startsWith('wos:')) return 'Web of Science';
      if (id.length === 7 && !isNaN(id)) return 'IEEE Xplore'; // IEEE Document ID
    }
    
    // Detección por formato de DOI o estructuras específicas
    if (ref.doi && ref.doi.includes('10.1109')) return 'IEEE Xplore';
    if (ref.doi && ref.doi.includes('10.1145')) return 'ACM Digital Library';
    if (ref.doi && ref.doi.includes('10.1007')) return 'Springer';
    if (ref.doi && ref.doi.includes('101016')) return 'ScienceDirect';
    
    // Por defecto
    return null;
  }

  /**
   * Ejecuta la importación de referencias
   * @param {string} projectId - ID del proyecto
   * @param {Array} files - Archivos subidos (req.files)
   * @returns {Promise<Object>} - Resultado de la importación
   */
  async execute(projectId, files) {
    console.log('ImportReferencesUseCase.execute()');
    console.log('   Project ID:', projectId);
    console.log('   Archivos:', files.length);
    
    if (!files || files.length === 0) {
      throw new Error('No se proporcionaron archivos para importar');
    }

    const results = {
      success: 0,
      failed: 0,
      duplicates: 0,
      skippedValidation: 0,
      references: [],
      errors: [],
      warnings: [],
      validationDetails: {
        missingAbstract: [],
        missingAuthors: [],
        missingYear: [],
        missingDoi: [],
        missingJournal: [],
        rejected: []
      },
      bySource: {} // Nuevo: estadísticas por base de datos
    };

    for (const file of files) {
      try {
        const fileExtension = file.originalname.split('.').pop().toLowerCase();
        console.log(`Procesando archivo: ${file.originalname}`);
        console.log(`   Extensión: ${fileExtension}`);
        console.log(`   Tamaño: ${file.buffer ? file.buffer.length : 0} bytes`);
        
        const content = file.buffer.toString('utf-8');
        console.log(`   Primeros 200 caracteres:`, content.substring(0, 200));
        
        let parsedReferences = [];

        try {
          // Parsear según el tipo de archivo
          if (fileExtension === 'csv') {
            console.log('Parseando como CSV...');
            parsedReferences = this.parseCSV(content);
          } else if (fileExtension === 'json') {
            console.log('Parseando como JSON...');
            parsedReferences = JSON.parse(content);
          } else if (fileExtension === 'ris' || fileExtension === 'txt') {
            console.log('Parseando como RIS...');
            parsedReferences = this.parseRIS(content);
          } else if (fileExtension === 'bib') {
            console.log('Parseando como BibTeX...');
            parsedReferences = this.parseBibTeX(content);
          } else if (fileExtension === 'nbib') {
            console.log('Parseando como PubMed (nbib)...');
            parsedReferences = this.parseRIS(content); // nbib usa formato similar a RIS
          } else if (fileExtension === 'ciw') {
            console.log('Parseando como Web of Science (ciw)...');
            parsedReferences = this.parseRIS(content); // ciw usa formato similar a RIS
          } else {
            console.log(`Formato no soportado: ${fileExtension}`);
            throw new Error(`Formato de archivo no soportado: ${fileExtension}. Formatos soportados: CSV, JSON, RIS, BibTeX, nbib, ciw.`);
          }
        } catch (parseError) {
          console.error(`Error parseando archivo ${file.originalname}:`, parseError);
          throw new Error(`Error al procesar el archivo ${file.originalname}: ${parseError.message}. Verifica que el archivo tenga el formato correcto y no esté corrupto.`);
        }
        
        console.log(`Parseadas ${parsedReferences.length} referencias del archivo`);

        // Detectar la fuente del archivo para estadísticas
        const fileSource = this.detectDatabaseSource(file.originalname, parsedReferences[0] || {});
        if (!results.bySource[fileSource]) {
          results.bySource[fileSource] = {
            fileName: file.originalname,
            parsed: 0,
            imported: 0,
            duplicates: 0
          };
        }
        results.bySource[fileSource].parsed = parsedReferences.length;

        // ═══ VALIDACIÓN DE DATOS MÍNIMOS ═══
        console.log(`Validando ${parsedReferences.length} referencias...`);
        const validatedReferences = [];
        
        for (const refData of parsedReferences) {
          const validation = this.validateMinimumFields(refData);
          
          if (!validation.isValid) {
            // Referencia rechazada: le faltan campos obligatorios
            const titlePreview = refData.title ? refData.title.substring(0, 60) : 'SIN TÍTULO';
            console.log(`   ✗ Rechazada: ${titlePreview} - Faltan: ${validation.missingRequired.join(', ')}`);
            results.skippedValidation++;
            
            // Registrar en detalle qué campo falta para cada referencia rechazada
            results.validationDetails.rejected.push({
              title: refData.title || 'Sin título',
              missingFields: validation.missingRequired
            });
            
            // También registrar cada campo faltante individualmente para el reporte
            for (const field of validation.missingRequired) {
              if (field === 'autores') {
                results.validationDetails.missingAuthors.push(refData.title || 'Sin título');
              } else if (field === 'año') {
                results.validationDetails.missingYear.push(refData.title || 'Sin título');
              } else if (field === 'DOI') {
                results.validationDetails.missingDoi.push(refData.title || 'Sin título');
              } else if (field === 'revista/conferencia') {
                results.validationDetails.missingJournal.push(refData.title || 'Sin título');
              }
            }
            continue;
          }
          
          // Registrar warnings por campos no bloqueantes (abstract)
          if (validation.warnings.length > 0) {
            for (const warn of validation.warnings) {
              if (warn.field === 'abstract') {
                results.validationDetails.missingAbstract.push(refData.title || 'Sin título');
              }
            }
          }
          
          validatedReferences.push(refData);
        }
        
        console.log(`Validación: ${validatedReferences.length} válidas, ${results.skippedValidation} rechazadas`);

        // Guardar referencias VALIDADAS en la base de datos
        console.log(`Guardando ${validatedReferences.length} referencias en BD...`);
        
        for (const refData of validatedReferences) {
          try {
            console.log(`   Procesando: ${refData.title || 'Sin título'}`);
            
            // Verificar si ya existe (por DOI o título)
            const existing = refData.doi || refData.title ? 
              await this.referenceRepository.findByDoiOrTitle(
                projectId,
                refData.doi,
                refData.title
              ) : null;

            if (existing) {
              console.log(`   Duplicado: ${refData.title}`);
              results.duplicates++;
              results.bySource[fileSource].duplicates++;
              continue;
            }

            // Crear la referencia
            console.log(`   Insertando en BD...`);
            
            // Detectar database source
            const detectedSource = this.detectDatabaseSource(file.originalname, refData);
            console.log(`   Detected source: ${detectedSource || 'Unknown'}`);
            
            const reference = await this.referenceRepository.create({
              ...refData,
              projectId: projectId,
              source: detectedSource || refData.database || refData.source || null,  // Map database → source
              screeningStatus: refData.screeningStatus || 'pending',
              importedFrom: file.originalname,
              importedAt: new Date()
            });

            console.log(`   Insertado ID: ${reference.id}`);
            results.references.push(reference);
            results.success++;
            results.bySource[fileSource].imported++;
          } catch (error) {
            console.log(`   Error insertando: ${error.message}`);
            results.failed++;
            results.errors.push({
              title: refData.title || 'Unknown',
              error: error.message
            });
          }
        }
      } catch (error) {
        results.errors.push({
          file: file.originalname,
          error: error.message
        });
      }
    }

    // ═══ RESUMEN DE VALIDACIÓN ═══
    const vd = results.validationDetails;
    if (vd.rejected.length > 0) {
      // Agrupar rechazadas por campos faltantes para mejor reporte
      const rejectedSummary = {};
      for (const r of vd.rejected) {
        const key = r.missingFields.sort().join(', ');
        if (!rejectedSummary[key]) rejectedSummary[key] = [];
        rejectedSummary[key].push(r.title);
      }
      
      results.warnings.push({
        type: 'rejected',
        severity: 'error',
        count: vd.rejected.length,
        message: `❌ ${vd.rejected.length} referencia(s) RECHAZADAS por datos incompletos. Campos obligatorios: título, autores, año, revista/conferencia y DOI.`,
        articles: vd.rejected.map(r => `${r.title.substring(0, 70)}${r.title.length > 70 ? '...' : ''} → falta: ${r.missingFields.join(', ')}`).slice(0, 15),
        details: rejectedSummary
      });
      console.log(`❌ RECHAZADAS: ${vd.rejected.length} referencias por datos incompletos`);
      
      // Desglose por campo faltante
      if (vd.missingAuthors.length > 0) {
        results.warnings.push({
          type: 'missing_authors',
          severity: 'error',
          count: vd.missingAuthors.length,
          message: `${vd.missingAuthors.length} referencia(s) sin autores. Necesarios para identificar duplicados y citación final.`,
          articles: vd.missingAuthors.slice(0, 10)
        });
      }
      if (vd.missingYear.length > 0) {
        results.warnings.push({
          type: 'missing_year',
          severity: 'error',
          count: vd.missingYear.length,
          message: `${vd.missingYear.length} referencia(s) sin año de publicación. Crítico para verificar criterios de inclusión temporal.`,
          articles: vd.missingYear.slice(0, 10)
        });
      }
      if (vd.missingDoi.length > 0) {
        results.warnings.push({
          type: 'missing_doi',
          severity: 'error',
          count: vd.missingDoi.length,
          message: `${vd.missingDoi.length} referencia(s) sin DOI. Identificador único necesario para localizar el artículo.`,
          articles: vd.missingDoi.slice(0, 10)
        });
      }
      if (vd.missingJournal.length > 0) {
        results.warnings.push({
          type: 'missing_journal',
          severity: 'error',
          count: vd.missingJournal.length,
          message: `${vd.missingJournal.length} referencia(s) sin revista/conferencia. Necesario para validar literatura revisada por pares.`,
          articles: vd.missingJournal.slice(0, 10)
        });
      }
    }
    if (vd.missingAbstract.length > 0) {
      results.warnings.push({
        type: 'missing_abstract',
        severity: 'critical',
        count: vd.missingAbstract.length,
        message: `⚠️ ${vd.missingAbstract.length} referencia(s) importadas SIN Abstract/Resumen. El sistema usa el abstract para clasificar artículos por IA. Sin él, la clasificación automática no será precisa.`,
        articles: vd.missingAbstract.slice(0, 10)
      });
      console.log(`⚠️ ALERTA: ${vd.missingAbstract.length} referencias importadas sin abstract`);
    }

    return results;
  }

  /**
   * Valida que una referencia tenga los datos mínimos obligatorios
   * Para que una referencia sea válida en el Diagrama PRISMA necesita:
   *   - Título (obligatorio): Para la primera fase de cribado
   *   - Autores (obligatorio): Para identificar duplicados y citación final
   *   - Año (obligatorio): Para verificar criterios de inclusión temporal
   *   - Revista/Conferencia (obligatorio): Para validar literatura revisada por pares
   *   - DOI (obligatorio): Identificador único, permite localizar el artículo si falta el abstract
   *   - Abstract (advertencia): Crítico para IA pero no bloquea la importación
   * 
   * @param {Object} refData - Datos de la referencia parseada
   * @returns {Object} - { isValid, missingRequired, warnings }
   */
  validateMinimumFields(refData) {
    const result = {
      isValid: true,
      missingRequired: [],
      warnings: []
    };

    // ═══ CAMPOS OBLIGATORIOS (bloquean la importación si faltan) ═══

    // 1. Título - Sin título no se puede hacer absolutamente nada
    const title = refData.title?.trim();
    if (!title || title.length < 5) {
      result.isValid = false;
      result.missingRequired.push('título');
    }

    // 2. Autores - necesarios para identificar duplicados y citación final
    const authors = refData.authors;
    const hasAuthors = Array.isArray(authors) 
      ? authors.length > 0 && authors.some(a => a?.trim())
      : typeof authors === 'string' && authors.trim().length > 0;
    if (!hasAuthors) {
      result.isValid = false;
      result.missingRequired.push('autores');
    }

    // 3. Año - crítico para verificar criterio de inclusión temporal
    const year = refData.year;
    if (!year || (typeof year === 'number' && (year < 1900 || year > 2100))) {
      result.isValid = false;
      result.missingRequired.push('año');
    }

    // 4. Revista/Conferencia - para validar literatura revisada por pares
    const journal = refData.journal?.trim();
    if (!journal) {
      result.isValid = false;
      result.missingRequired.push('revista/conferencia');
    }

    // 5. DOI - identificador único, permite localizar el artículo original
    const doi = refData.doi?.trim();
    if (!doi) {
      result.isValid = false;
      result.missingRequired.push('DOI');
    }

    // ═══ CAMPO CRÍTICO PARA IA (warning, no bloquea) ═══

    // Abstract - lo que usa la IA para clasificar artículos
    // No bloquea porque el DOI permite localizar el artículo manualmente
    const abstract = refData.abstract?.trim();
    if (!abstract || abstract.length < 20) {
      result.warnings.push({ 
        field: 'abstract', 
        message: 'Sin Abstract/Resumen - EL SISTEMA USA EL ABSTRACT PARA CLASIFICAR ARTÍCULOS POR IA. Sin él, la clasificación automática no será precisa. Usa el DOI para buscar el abstract manualmente.' 
      });
    }

    return result;
  }

  /**
   * Parser mejorado de CSV que maneja comillas y campos complejos
   */
  parseCSV(content) {
    const lines = content.split('\n').filter(line => line.trim());
    if (lines.length < 2) return [];

    // Parser de CSV que maneja comillas correctamente
    const parseCSVLine = (line) => {
      const values = [];
      let current = '';
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        const nextChar = line[i + 1];
        
        if (char === '"') {
          if (inQuotes && nextChar === '"') {
            // Comilla escapada ""
            current += '"';
            i++; // Saltar la siguiente comilla
          } else {
            // Toggle estado de comillas
            inQuotes = !inQuotes;
          }
        } else if (char === ',' && !inQuotes) {
          // Fin de campo
          values.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      
      // Agregar el último campo
      values.push(current.trim());
      
      return values;
    };

    // Parsear headers
    const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim());
    console.log('Headers detectados:', headers);
    
    const references = [];

    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      
      // Crear objeto de referencia mapeando los headers a campos estándar
      // IMPORTANTE: Normalizar headers a minúsculas para comparación case-insensitive
      const rawRef = {};
      headers.forEach((header, index) => {
        const normalizedHeader = header.toLowerCase().trim();
        rawRef[normalizedHeader] = values[index] || '';
      });
      
      // Mapear campos comunes a nombres estándar
      const ref = this.normalizeCSVFields(rawRef);
      
      // Solo agregar si tiene al menos título
      if (ref.title && ref.title.trim().length > 0) {
        references.push(ref);
      } else {
        console.warn(`Fila ${i + 1}: Sin título válido, saltando...`);
      }
    }

    return references;
  }

  /**
   * Normaliza los campos del CSV a nombres estándar
   * Soporta formatos de: Scopus, IEEE Xplore, Web of Science, PubMed, ACM, SpringerLink, ScienceDirect, etc.
   */
  normalizeCSVFields(rawRef) {
    const normalized = {
      title: '',
      abstract: '',
      authors: [],
      year: null,
      journal: '',
      doi: '',
      keywords: [],
      database: 'CSV Import',
      externalId: null,
      url: '',
      citationCount: 0
    };

    // ============ TITLE ============
    // Mapear Title (muchas variaciones de diferentes bases de datos)
    const titleFields = [
      'title', 
      'article title', 
      'document title',      // IEEE Xplore
      'item title', 
      'publication title',   // Generalmente es el journal, pero a veces es título
      'article name',
      'paper title',
      'ti',                  // RIS format
      'bt'                   // Book title en RIS
    ];
    for (const field of titleFields) {
      if (rawRef[field] && rawRef[field].trim() && rawRef[field].trim() !== '') {
        normalized.title = rawRef[field].trim();
        break;
      }
    }

    // ============ ABSTRACT ============
    const abstractFields = [
      'abstract', 
      'summary', 
      'description',
      'ab',                  // RIS format
      'abstract note'
    ];
    for (const field of abstractFields) {
      if (rawRef[field] && rawRef[field].trim()) {
        normalized.abstract = rawRef[field].trim();
        break;
      }
    }

    // ============ AUTHORS ============
    const authorFields = [
      'authors',             // IEEE Xplore, Scopus
      'author', 
      'author names', 
      'creators',
      'au',                  // RIS format
      'a1',
      'author full names',
      'inventor'             // Para patentes
    ];
    for (const field of authorFields) {
      if (rawRef[field] && rawRef[field].trim()) {
        const authorStr = rawRef[field].trim();
        // Detectar separadores: ; para IEEE/Scopus, , para otros
        if (authorStr.includes(';')) {
          normalized.authors = authorStr.split(';').map(a => a.trim()).filter(a => a);
        } else if (authorStr.includes('|')) {
          normalized.authors = authorStr.split('|').map(a => a.trim()).filter(a => a);
        } else {
          // Intentar detectar si hay varios autores por patrón "Apellido, Nombre"
          const parts = authorStr.split(',');
          if (parts.length > 2) {
            // Probablemente formato "Apellido1, Nombre1, Apellido2, Nombre2"
            normalized.authors = [];
            for (let i = 0; i < parts.length; i += 2) {
              if (parts[i] && parts[i + 1]) {
                normalized.authors.push(`${parts[i].trim()}, ${parts[i + 1].trim()}`);
              }
            }
          } else {
            normalized.authors = [authorStr];
          }
        }
        break;
      }
    }

    // ============ YEAR ============
    const yearFields = [
      'year', 
      'publication year',    // IEEE Xplore, Scopus
      'date', 
      'year published',
      'py',                  // RIS format
      'yr',
      'date added to xplore',
      'online date',
      'issue date',
      'cover date'
    ];
    for (const field of yearFields) {
      if (rawRef[field]) {
        const yearMatch = String(rawRef[field]).match(/\d{4}/);
        if (yearMatch) {
          normalized.year = parseInt(yearMatch[0]);
          break;
        }
      }
    }

    // ============ JOURNAL/SOURCE ============
    const journalFields = [
      'publication title',   // IEEE Xplore - nombre de conferencia/journal
      'journal', 
      'source', 
      'publication name', 
      'source title',
      'journal title',
      'jo',                  // RIS format
      'jf',                  // Full journal name
      'ja',                  // Abbreviated journal
      'booktitle',
      'proceedings'
    ];
    for (const field of journalFields) {
      if (rawRef[field] && rawRef[field].trim()) {
        normalized.journal = rawRef[field].trim();
        break;
      }
    }

    // ============ DOI ============
    const doiFields = [
      'doi',                 // Todos
      'digital object identifier',
      'do'                   // RIS format
    ];
    for (const field of doiFields) {
      if (rawRef[field] && rawRef[field].trim()) {
        let doi = rawRef[field].trim();
        // Limpiar URL si viene con https://doi.org/
        doi = doi.replace('https://doi.org/', '').replace('http://dx.doi.org/', '');
        normalized.doi = doi;
        break;
      }
    }

    // ============ KEYWORDS ============
    const keywordFields = [
      'author keywords',     // IEEE Xplore, Scopus
      'keywords', 
      'index terms',
      'ieee terms',          // IEEE Xplore
      'mesh_terms',          // PubMed
      'kw',                  // RIS format
      'subject',
      'descriptors'
    ];
    for (const field of keywordFields) {
      if (rawRef[field] && rawRef[field].trim()) {
        const keywordStr = rawRef[field].trim();
        if (keywordStr.includes(';')) {
          normalized.keywords = keywordStr.split(';').map(k => k.trim()).filter(k => k);
        } else if (keywordStr.includes('|')) {
          normalized.keywords = keywordStr.split('|').map(k => k.trim()).filter(k => k);
        } else {
          normalized.keywords = keywordStr.split(',').map(k => k.trim()).filter(k => k);
        }
        break;
      }
    }

    // ============ EXTERNAL ID ============
    const idFields = [
      'eid',                 // Scopus EID
      'scopus id', 
      'pubmed id',
      'pmid',
      'wos id',
      'accession number',
      'document identifier', // IEEE Xplore
      'id',
      'an'                   // RIS format
    ];
    for (const field of idFields) {
      if (rawRef[field] && rawRef[field].trim()) {
        normalized.externalId = rawRef[field].trim();
        break;
      }
    }

    // ============ URL ============
    const urlFields = [
      'url',
      'pdf link',            // IEEE Xplore
      'link',
      'ur',                  // RIS format
      'article url',
      'online link'
    ];
    for (const field of urlFields) {
      if (rawRef[field] && rawRef[field].trim()) {
        normalized.url = rawRef[field].trim();
        break;
      }
    }

    // ============ CITATION COUNT ============
    const citationFields = [
      'article citation count', // IEEE Xplore
      'times cited',            // Web of Science
      'cited by',               // Scopus
      'citations',
      'citation count'
    ];
    for (const field of citationFields) {
      if (rawRef[field]) {
        const count = parseInt(rawRef[field]);
        if (!isNaN(count)) {
          normalized.citationCount = count;
          break;
        }
      }
    }

    // ============ DATABASE SOURCE ============
    // Detectar automáticamente la base de datos por los campos presentes
    if (rawRef['document identifier'] || rawRef['ieee terms']) {
      normalized.database = 'IEEE Xplore';
    } else if (rawRef['eid'] || rawRef['scopus id']) {
      normalized.database = 'Scopus';
    } else if (rawRef['pmid'] || rawRef['mesh_terms']) {
      normalized.database = 'PubMed';
    } else if (rawRef['wos id'] || rawRef['times cited']) {
      normalized.database = 'Web of Science';
    } else if (rawRef['database']) {
      normalized.database = rawRef['database'].trim();
    } else if (rawRef['source database']) {
      normalized.database = rawRef['source database'].trim();
    }

    return normalized;
  }

  /**
   * Parser simple de RIS (Research Information Systems)
   * Formato usado por EndNote, RefWorks, Mendeley, Zotero, etc.
   * También compatible con nbib (PubMed) y ciw (Web of Science)
   */
  parseRIS(content) {
    console.log('parseRIS: Iniciando parsing...');
    console.log('parseRIS: Contenido length:', content.length);
    console.log('parseRIS: Primeros 500 caracteres:', content.substring(0, 500));
    
    const references = [];
    
    // Normalizar saltos de línea (algunos archivos usan \r\n, otros \n)
    const normalizedContent = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    
    // Split by ER tag (end of record) - MUY flexible con variaciones
    // Soporta: "ER  -", "ER-", "ER -", "ER  - \n\n", etc.
    // IEEE usa: "ER  - \n\n\n" (dos espacios, guion, espacios, múltiples saltos)
    const records = normalizedContent.split(/\nER\s+-?\s*\n/).filter(r => r.trim());
    console.log(`parseRIS: Encontrados ${records.length} registros`);

    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      console.log(`\nparseRIS: Procesando registro ${i + 1}/${records.length}`);
      console.log(`parseRIS: Primeras 200 caracteres del registro:`, record.substring(0, 200));
      
      const lines = record.split('\n');
      const ref = {
        title: '',
        authors: [],
        year: null,
        journal: '',
        volume: '',
        issue: '',
        pages: '',
        doi: '',
        abstract: '',
        keywords: [],
        url: '',
        type: 'article',
        database: null,  // Add database field
        externalId: null  // Add externalId field
      };

      let currentTag = null;
      let currentValue = '';

      for (const line of lines) {
        // Regex MUY flexible: permite múltiples espacios antes y después del guion
        // Soporta: "TY  - JOUR", "TY - JOUR", "TY- JOUR", "TY-JOUR", "TYJOUR"
        const match = line.match(/^([A-Z0-9]{2})\s*-?\s*(.*)$/);
        
        if (match) {
          // Procesar el tag anterior si existía
          if (currentTag && currentValue) {
            this.processRISTag(ref, currentTag, currentValue.trim());
          }
          
          // Nueva tag
          const [, tag, value] = match;
          currentTag = tag;
          currentValue = value;
        } else if (currentTag && line.trim()) {
          // Continuación de valor multi-línea
          currentValue += ' ' + line.trim();
        }
      }

      // Procesar el último tag
      if (currentTag && currentValue) {
        this.processRISTag(ref, currentTag, currentValue.trim());
      }

      // Solo agregar si tiene al menos título
      if (ref.title) {
        console.log(`parseRIS: ✓ Registro válido - Título: ${ref.title.substring(0, 60)}...`);
        references.push({
          ...ref,
          authors: ref.authors.join('; '),
          keywords: ref.keywords.join('; ')
        });
      } else {
        console.log(`parseRIS: ✗ Registro descartado - Sin título`);
        console.log(`parseRIS: Contenido del registro:`, JSON.stringify(ref, null, 2));
      }
    }

    console.log(`parseRIS: Total referencias parseadas: ${references.length}`);
    return references;
  }

  /**
   * Procesa un tag RIS y actualiza el objeto de referencia
   */
  processRISTag(ref, tag, value) {
    const cleanValue = value.trim();
    if (!cleanValue) return;

    switch (tag) {
      case 'TI': // Title
      case 'T1':
      case 'CT': // Title (algunos formatos)
        if (!ref.title) ref.title = cleanValue;
        break;
      case 'AU': // Author
      case 'A1':
      case 'A2': // Secondary author
        ref.authors.push(cleanValue);
        break;
      case 'PY': // Publication Year
      case 'Y1':
        const year = parseInt(cleanValue);
        if (!isNaN(year) && year > 1900 && year < 2100) {
          ref.year = year;
        }
        break;
      case 'JO': // Journal (full)
      case 'JF': // Journal (full)
      case 'JA': // Journal (abbreviated)
      case 'T2': // Secondary title (often journal for articles)
        if (!ref.journal) ref.journal = cleanValue;
        break;
      case 'VL': // Volume
      case 'VO': // Volume (alternate)
        ref.volume = cleanValue;
        break;
      case 'IS': // Issue
        ref.issue = cleanValue;
        break;
      case 'SP': // Start Page
        ref.pages = cleanValue;
        break;
      case 'EP': // End Page
        if (ref.pages) ref.pages += `-${cleanValue}`;
        else ref.pages = cleanValue;
        break;
      case 'DO': // DOI
        ref.doi = cleanValue;
        break;
      case 'AB': // Abstract
      case 'N2': // Abstract (alternate)
        if (!ref.abstract) ref.abstract = cleanValue;
        break;
      case 'KW': // Keywords
        ref.keywords.push(cleanValue);
        break;
      case 'UR': // URL
      case 'L1': // PDF Link
      case 'L2': // Full text link
      case 'L3': // Related records link
        if (!ref.url) ref.url = cleanValue;
        break;
      case 'TY': // Type of reference
        ref.type = this.mapRISType(cleanValue);
        break;
      case 'DB': // Database name
        ref.database = cleanValue;
        break;
      case 'AN': // Accession Number / External ID
      case 'ID': // Reference ID
        if (!ref.externalId) ref.externalId = cleanValue;
        break;
      case 'SN': // ISSN
      case 'BN': // ISBN
        // Podríamos agregar estos campos si los necesitamos
        break;
      case 'M3': // Type of work (for Scopus)
      case 'N1': // Notes (puede contener información adicional en Scopus)
        // Ignorar por ahora, pero reconocer
        break;
    }
  }

  /**
   * Mapea tipos RIS a tipos internos
   */
  mapRISType(risType) {
    const typeMap = {
      'JOUR': 'article',
      'CONF': 'conference',
      'BOOK': 'book',
      'CHAP': 'chapter',
      'THES': 'thesis',
      'RPRT': 'report',
      'GEN': 'generic'
    };
    return typeMap[risType] || 'article';
  }

  /**
   * Limpia un valor BibTeX eliminando llaves de protección de mayúsculas
   * y caracteres LaTeX comunes.
   * Ej: "{MERN} {Stack} {Web}-{Based}" → "MERN Stack Web-Based"
   */
  cleanBibTeXValue(value) {
    if (!value) return value;
    let clean = value
      // Quitar llaves de protección: {Word} → Word
      .replace(/\{([^{}]*)\}/g, '$1')
      // Quitar cualquier llave suelta restante
      .replace(/[{}]/g, '')
      // Limpiar comandos LaTeX comunes tipo \emph{...} (ya sin llaves)
      .replace(/\\[a-zA-Z]+/g, '')
      // Normalizar espacios múltiples
      .replace(/\s{2,}/g, ' ')
      .trim();
    return clean;
  }

  /**
   * Parser simple de BibTeX
   * Formato usado por LaTeX, BibDesk, JabRef, etc.
   */
  parseBibTeX(content) {
    console.log('parseBibTeX: Iniciando parsing...');
    console.log('parseBibTeX: Contenido length:', content.length);
    console.log('parseBibTeX: Primeros 500 caracteres:', content.substring(0, 500));
    
    const references = [];
    
    // Normalizar: separar entradas pegadas y limpiar
    let normalizedContent = content
      .replace(/\}@/g, '}\n\n@')  // Separar entradas pegadas
      .replace(/\r\n/g, '\n')      // Normalizar saltos de línea
      .replace(/\r/g, '\n');
    
    // Encontrar todas las entradas @TYPE{...}
    // Usar regex que busca desde @ hasta } balanceado
    const entryPattern = /@(\w+)\s*\{([^@]*?)(?=\n@|\n*$)/gs;
    const matches = [...normalizedContent.matchAll(entryPattern)];
    
    console.log(`parseBibTeX: Encontradas ${matches.length} entradas`);
    
    for (let i = 0; i < matches.length; i++) {
      const match = matches[i];
      const type = match[1];
      let entryContent = match[2];
      
      console.log(`\nparseBibTeX: Procesando entrada ${i + 1}/${matches.length} - Tipo: ${type}`);
      console.log(`parseBibTeX: Primeros 200 caracteres:`, entryContent.substring(0, 200));
      
      // Extraer citation key (primer valor después de la llave)
      const keyMatch = entryContent.match(/^\s*([^,\s]+)\s*,/);
      if (!keyMatch) {
        console.log(`parseBibTeX: No se pudo extraer citation key`);
        continue;
      }
      
      const citationKey = keyMatch[1];
      console.log(`parseBibTeX: Citation Key: ${citationKey}`);
      
      // Remover el citation key del contenido para procesar solo los campos
      entryContent = entryContent.substring(keyMatch[0].length);
      
      const ref = {
        type: this.mapBibTeXType(type.toLowerCase()),
        citationKey: citationKey.trim(),
        title: '',
        authors: '',
        year: null,
        journal: '',
        volume: '',
        issue: '',
        pages: '',
        doi: '',
        abstract: '',
        keywords: '',
        url: '',
        database: null,
        externalId: null
      };

      // Parsear campos
      const fields = this.extractBibTeXFields(entryContent);
      console.log(`parseBibTeX: Extraídos ${Object.keys(fields).length} campos`);
      
      for (const [key, value] of Object.entries(fields)) {
        // Limpiar llaves BibTeX de protección de mayúsculas ({MERN} → MERN)
        const cleanValue = this.cleanBibTeXValue(value.trim());
        
        switch (key.toLowerCase()) {
          case 'title':
            ref.title = cleanValue;
            break;
          case 'author':
            // Reemplazar 'and' por '; ' para separar autores
            ref.authors = cleanValue.replace(/ and /g, '; ');
            break;
          case 'year':
            const year = parseInt(cleanValue);
            if (!isNaN(year) && year > 1900 && year < 2100) {
              ref.year = year;
            }
            break;
          case 'journal':
          case 'booktitle':
            if (!ref.journal) ref.journal = cleanValue;
            break;
          case 'volume':
            ref.volume = cleanValue;
            break;
          case 'number':
          case 'issue':
            ref.issue = cleanValue;
            break;
          case 'pages':
            ref.pages = cleanValue;
            break;
          case 'doi':
            ref.doi = cleanValue;
            break;
          case 'abstract':
            ref.abstract = cleanValue;
            break;
          case 'keywords':
            ref.keywords = cleanValue;
            break;
          case 'url':
          case 'link':
            if (!ref.url) ref.url = cleanValue;
            break;
          case 'database':
          case 'source':
            ref.database = cleanValue;
            break;
          case 'eprint':
          case 'id':
          case 'articleid':
            if (!ref.externalId) ref.externalId = cleanValue;
            break;
          case 'issn':
          case 'isbn':
          case 'month':
            // Ignorar por ahora
            break;
        }
      }

      // Solo agregar si tiene título
      if (ref.title) {
        console.log(`parseBibTeX: ✓ Entrada válida - Título: ${ref.title.substring(0, 60)}...`);
        references.push(ref);
      } else {
        console.log(`parseBibTeX: ✗ Entrada descartada - Sin título`);
        console.log(`parseBibTeX: Campos extraídos:`, Object.keys(fields));
      }
    }

    console.log(`parseBibTeX: Total referencias parseadas: ${references.length}`);
    return references;
  }

  /**
   * Extrae campos de una entrada BibTeX manejando llaves balanceadas
   */
  extractBibTeXFields(content) {
    const fields = {};
    
    // Limpiar: quitar llaves finales de la entrada y espacios
    content = content.trim();
    if (content.endsWith('}')) {
      content = content.substring(0, content.length - 1);
    }
    
    // Buscar campos: key = {value} o key = "value" o key = value
    let pos = 0;
    while (pos < content.length) {
      // Buscar nombre del campo
      const keyMatch = content.substring(pos).match(/^\s*(\w+)\s*=/);
      if (!keyMatch) {
        // Si no hay más campos, salir
        break;
      }
      
      const key = keyMatch[1];
      pos += keyMatch[0].length;
      
      // Saltar espacios después del =
      while (pos < content.length && /\s/.test(content[pos])) pos++;
      
      if (pos >= content.length) break;
      
      // Extraer valor según el delimitador
      let value = '';
      const delimiter = content[pos];
      
      if (delimiter === '{') {
        // Manejar llaves balanceadas
        let braceCount = 1;
        pos++; // Saltar la llave de apertura
        let start = pos;
        
        while (pos < content.length && braceCount > 0) {
          if (content[pos] === '\\' && pos + 1 < content.length) {
            // Saltar secuencias de escape
            pos += 2;
            continue;
          }
          if (content[pos] === '{') braceCount++;
          else if (content[pos] === '}') braceCount--;
          if (braceCount > 0) pos++;
        }
        
        value = content.substring(start, pos);
        pos++; // Saltar la llave de cierre
      } else if (delimiter === '"') {
        // Manejar comillas
        pos++; // Saltar la comilla de apertura
        let start = pos;
        
        while (pos < content.length && content[pos] !== '"') {
          if (content[pos] === '\\' && pos + 1 < content.length) {
            pos += 2; // Saltar caracteres escapados
            continue;
          }
          pos++;
        }
        
        value = content.substring(start, pos);
        if (pos < content.length) pos++; // Saltar la comilla de cierre
      } else {
        // Valor sin delimitadores (número o texto simple)
        let start = pos;
        while (pos < content.length && content[pos] !== ',' && content[pos] !== '}' && content[pos] !== '\n') {
          pos++;
        }
        value = content.substring(start, pos).trim();
      }
      
      // Solo agregar si el valor no está vacío
      if (value.trim()) {
        fields[key] = value;
      }
      
      // Saltar la coma y espacios si existen
      while (pos < content.length && (content[pos] === ',' || /\s/.test(content[pos]))) {
        pos++;
      }
    }
    
    return fields;
  }

  /**
   * Mapea tipos BibTeX a tipos internos
   */
  mapBibTeXType(bibType) {
    const typeMap = {
      'article': 'article',
      'inproceedings': 'conference',
      'conference': 'conference',
      'book': 'book',
      'incollection': 'chapter',
      'phdthesis': 'thesis',
      'mastersthesis': 'thesis',
      'techreport': 'report',
      'misc': 'generic'
    };
    return typeMap[bibType] || 'article';
  }
}

module.exports = ImportReferencesUseCase;

