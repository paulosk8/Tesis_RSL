const { GoogleGenerativeAI } = require('@google/generative-ai');

/**
 * Use Case: Generador de Criterios de Inclusión y Exclusión
 * 
 * Genera criterios de inclusión y exclusión basados en el protocolo PICO
 * para ayudar en la selección de estudios en una revisión sistemática.
 */
class GenerateInclusionExclusionCriteriaUseCase {
  constructor() {
    // Inicializar OpenAI/ChatGPT
    if (process.env.GEMINI_API_KEY) {
      this.gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    }
  }

  /**
   * Genera criterios de inclusión y exclusión
   */
  async execute({ selectedTitle, protocolTerms, picoData, projectTitle, aiProvider = 'chatgpt', specificType, customFocus, categoryIndex, categoryName, yearStart, yearEnd, rejectedTerms }) {
    try {
      // REGLA METODOLÓGICA: Los criterios DEBEN basarse en el título de la RSL seleccionado
      const rslTitle = selectedTitle || projectTitle || 'Proyecto sin título';
      
      console.log('Generando criterios de inclusión/exclusión...');
      console.log('Título RSL:', rslTitle.substring(0, 60) + '...');
      console.log('Rango temporal para prompt: yearStart =', yearStart, ', yearEnd =', yearEnd);
      console.log('Términos rechazados (NO usar):', rejectedTerms?.length || 0);
      
      if (specificType) {
        console.log('Regenerando tipo específico:', specificType);
        console.log('Categoría específica:', categoryName || categoryIndex);
        console.log('Enfoque personalizado:', customFocus || 'predeterminado');
      }

      console.log('Construyendo prompt con años:', { yearStart, yearEnd });

      const prompt = this.buildPrompt({ 
        rslTitle,
        protocolTerms, 
        picoData, 
        projectTitle, 
        specificType, 
        customFocus, 
        categoryIndex, 
        categoryName, 
        yearStart, 
        yearEnd,
        rejectedTerms // ← NUEVO: Términos que el investigador rechazó
      });
      
      let text;
      if (!this.gemini) {
        throw new Error('No hay proveedor de IA configurado');
      }
      
      const model = this.gemini.getGenerativeModel({
        model: 'gemini-2.5-pro',
        generationConfig: { temperature: 0.7 }
      });
      const result = await model.generateContent(prompt);
      text = result.response.text();

      console.log('Respuesta completa de IA:');
      console.log(text);
      console.log('─────────────────────────────────────');

      // Parsear la respuesta
      const isSingleCriterion = categoryIndex !== undefined && categoryName;
      const criteria = this.parseResponse(text, isSingleCriterion, categoryIndex, categoryName);

      console.log('Criterios generados exitosamente');

      return {
        success: true,
        data: criteria,
        isSingleCriterion
      };

    } catch (error) {
      console.error('Error generando criterios:', error);
      throw new Error(`Error generando criterios: ${error.message}`);
    }
  }

  /**
   * Construye el prompt para la IA
   */
  buildPrompt({ rslTitle, protocolTerms, picoData, projectTitle, specificType, customFocus, categoryIndex, categoryName, yearStart, yearEnd, rejectedTerms }) {
    // Usar título de la RSL seleccionado como fuente principal
    const title = rslTitle || projectTitle || 'Proyecto sin título';
    
    // Extraer términos del protocolo (ya validados en pasos anteriores)
    const technologies = protocolTerms?.tecnologia || protocolTerms?.technologies || [];
    const domains = protocolTerms?.dominio || protocolTerms?.applicationDomain || [];
    const studyTypes = protocolTerms?.tipoEstudio || protocolTerms?.studyType || [];
    const themes = protocolTerms?.focosTematicos || protocolTerms?.thematicFocus || [];

    // Normalizar PICO outcome (frontend envía 'outcome' singular, legacy usa 'outcomes')
    const picoOutcome = picoData?.outcome || picoData?.outcomes || 'No especificado';

    // Si hay categoría específica, generar AMBOS criterios (inclusión Y exclusión)
    if (categoryIndex !== undefined && categoryName && specificType) {
      return this.buildBothCriteriaPrompt({
        title,
        technologies,
        domains,
        studyTypes,
        themes,
        picoData,
        picoOutcome,
        specificType,
        customFocus,
        categoryIndex,
        categoryName,
        yearStart,
        yearEnd,
        rejectedTerms
      });
    }

    // Si hay tipo específico y enfoque personalizado, generar prompt especializado
    if (specificType && customFocus) {
      return this.buildSpecificTypePrompt({
        title,
        technologies,
        domains,
        studyTypes,
        themes,
        picoData,
        picoOutcome,
        specificType,
        customFocus,
        yearStart,
        yearEnd,
        rejectedTerms
      });
    }

    return `
Eres un experto en Metodología PRISMA 2020. Genera la tabla de Criterios de Elegibilidad (Inclusión/Exclusión) para una RSL.

REGLA DE ORO: Los criterios no son "opuestos". Inclusión = PERTINENCIA. Exclusión = RUIDO o falta de CALIDAD/ACCESO.

RESPONDE ÚNICAMENTE con la TABLA en formato de texto (sin markdown, sin JSON).

${rejectedTerms && rejectedTerms.length > 0 ? `
RESTRICCIÓN CRÍTICA - LEER PRIMERO
═══════════════════════════════════════════════════════════════
TÉRMINOS PROHIBIDOS (el investigador los rechazó explícitamente):
${rejectedTerms.map(t => `- ${t}`).join('\n')}

INSTRUCCIONES OBLIGATORIAS:
1. NO mencionar estos términos en NINGÚN criterio (inclusión ni exclusión)
2. NO usar sinónimos o variantes de estos términos
3. NO derivarlos del título aunque aparezcan ahí
4. Si el título contiene estos términos, IGNORARLOS y basar criterios SOLO en los términos confirmados
5. Reformular criterios usando términos MÁS ESPECÍFICOS o subcampos técnicos

Ejemplo: Si "Inteligencia Artificial" está rechazado pero aparece en título:
   MAL: "Estudios sobre inteligencia artificial..."
   BIEN: "Estudios sobre técnicas de detección algorítmica..." (usando términos confirmados)
═══════════════════════════════════════════════════════════════

` : ''}
═══════════════════════════════════════════════════════════════
DATOS DEL PROTOCOLO (ya validados en pasos anteriores — usar tal cual)
═══════════════════════════════════════════════════════════════

TÍTULO RSL: "${title}"
${rejectedTerms && rejectedTerms.length > 0 ? '\nRECORDATORIO: Ignorar términos rechazados que aparezcan en el título\n' : ''}
MARCO PICO (ya definido y editado por el investigador):
- P (Población): ${picoData?.population || 'No especificado'}
- I (Intervención): ${picoData?.intervention || 'No especificado'}
- C (Comparación): ${picoData?.comparison || 'N/A'}
- O (Outcomes): ${picoOutcome}

TÉRMINOS DEL PROTOCOLO (ya confirmados por el investigador - USAR SOLO ESTOS):
- Tecnologías: ${technologies.length ? technologies.join(' | ') : 'No especificado'}
- Dominio: ${domains.length ? domains.join(' | ') : 'No especificado'}
- Focos Temáticos: ${themes.length ? themes.join(' | ') : 'No especificado'}
${rejectedTerms && rejectedTerms.length > 0 ? '\nLos términos CONFIRMADOS arriba son los ÚNICOS que debes usar. NO agregar términos rechazados.\n' : ''}
RANGO TEMPORAL: ${yearStart || 2019} - ${yearEnd || 2025}

═══════════════════════════════════════════════════════════════
INSTRUCCIONES
═══════════════════════════════════════════════════════════════

Genera 6 filas de criterios alineados con la estrategia de búsqueda:

1. COBERTURA TEMÁTICA (Contexto): 
   - Inclusión: Estudios que relacionen [I] con [P] (Dominio).
   - Exclusión: ¡CRÍTICO! Excluir estudios donde [I] aparece fuera del [Dominio] (Ej: Mongoose en Zoología vs API). Resolver Ambigüedad de Contexto.

2. ENFOQUE DE LA SOLUCIÓN (Tecnologías):
   - Inclusión: [I] y sus sinónimos/variantes validadas.
   - Exclusión: Tecnologías similares pero no equivalentes.

3. FOCO DE LOS RESULTADOS (Outcomes):
   - Inclusión: Estudios que evalúen [Focos Temáticos] (incluyendo Umbrella Terms y Causas Raíz como 'Overhead', 'Abstracción', 'Trade-offs').
   - Exclusión: Estudios puramente descriptivos sin evaluación de métricas de interés.

4. TIPO DE ESTUDIO: Inclusión=empíricos/experimentales. Exclusión=opiniones/tutoriales sin validación.
5. TIPO DE DOCUMENTO: Inclusión=journals/conferencias peer-reviewed. Exclusión=blogs/white papers.
6. IDIOMA/TEMPORALIDAD: Inglés, Periodo ${yearStart || 2019}-${yearEnd || 2025}.

REGLAS:
- Mantener consistencia con las Queries Generadas: Si buscamos "Performance", el criterio debe incluir "Evaluación de Performance".
- Explicitar el contexto para filtrar el ruido.

═══════════════════════════════════════════════════════════════
FORMATO DE SALIDA (TABLA con 6 filas, 3 columnas separadas por " | ")
═══════════════════════════════════════════════════════════════

Categoría | Criterio de Inclusión | Criterio de Exclusión
Cobertura Temática (Contexto) | [...] | [...]
Tecnologías (Intervención) | [...] | [...]
Enfoque de Resultados (Outcomes) | [...] | [...]
Tipo de estudio | [...] | [...]
Tipo de documento | [...] | [...]
Idioma y Temporalidad | [...] | [...]

GENERA LA TABLA AHORA:
`.trim();
  }

  /**
   * Construye un prompt específico para regenerar solo criterios de inclusión o exclusión
   */
  buildSpecificTypePrompt({ title, technologies, domains, studyTypes, themes, picoData, picoOutcome, specificType, customFocus, yearStart, yearEnd, rejectedTerms }) {
    const typeLabel = specificType === 'inclusion' ? 'INCLUSIÓN' : 'EXCLUSIÓN';
    const oppositeLabel = specificType === 'inclusion' ? 'exclusión' : 'inclusión';

    return `
Eres un experto en PRISMA 2020. Regenera criterios de ${typeLabel} con enfoque personalizado.

RESPONDE ÚNICAMENTE con la TABLA en formato texto (sin markdown).

${rejectedTerms && rejectedTerms.length > 0 ? `TÉRMINOS PROHIBIDOS (NO mencionar en criterios):
${rejectedTerms.map(t => `- ${t}`).join(', ')}
NO usar estos términos aunque aparezcan en el título. Basar criterios SOLO en términos confirmados.

` : ''}TÍTULO RSL: "${title}"
${rejectedTerms && rejectedTerms.length > 0 ? '\nIgnorar términos rechazados del título\n' : ''}
MARCO PICO (ya validado):
- P: ${picoData?.population || 'No especificado'}
- I: ${picoData?.intervention || 'No especificado'}
- C: ${picoData?.comparison || 'N/A'}
- O: ${picoOutcome}

TÉRMINOS DEL PROTOCOLO CONFIRMADOS (USAR SOLO ESTOS):
- Tecnología: ${technologies.join(', ')}
- Dominio: ${domains.join(', ')}
- Focos: ${themes.join(', ')}

ENFOQUE PERSONALIZADO: "${customFocus}"

Genera TABLA con 6 categorías (Categoría | Inclusión | Exclusión).
Los criterios de ${typeLabel} deben ser MUY ESPECÍFICOS y reflejar el enfoque personalizado.
Los criterios de ${oppositeLabel} pueden ser genéricos.
Rango temporal: ${yearStart && yearEnd ? `${yearStart}-${yearEnd}` : '2019-2025'}

GENERA LA TABLA AHORA:
`.trim();
  }

  /**
   * Construye un prompt para regenerar AMBOS criterios (inclusión Y exclusión) de una categoría específica
   * Esto mantiene la coherencia entre criterios complementarios
   */
  buildBothCriteriaPrompt({ title, technologies, domains, studyTypes, themes, picoData, picoOutcome, specificType, customFocus, categoryIndex, categoryName, yearStart, yearEnd, rejectedTerms }) {
    return `
Eres un experto en PRISMA 2020. El usuario quiere regenerar el criterio de ${specificType === 'inclusion' ? 'INCLUSIÓN' : 'EXCLUSIÓN'} de la categoría "${categoryName}".

TAREA: Regenerar AMBOS criterios (inclusión Y exclusión) para mantener COHERENCIA y COMPLEMENTARIEDAD.

${rejectedTerms && rejectedTerms.length > 0 ? `TÉRMINOS PROHIBIDOS - NO MENCIONAR:
${rejectedTerms.map(t => `- ${t}`).join(', ')}
Usar SOLO los términos confirmados abajo. NO derivar términos prohibidos del título o PICO.

` : ''}CONTEXTO DEL PROTOCOLO (USAR SOLO ESTOS TÉRMINOS CONFIRMADOS):
- Título RSL: "${title}"
- Tecnología central: ${technologies.join(', ')}
- Dominio/Contexto: ${domains.join(', ')}
- Focos temáticos: ${themes.join(', ')}
- PICO-P (Población): ${picoData?.population || 'N/A'}
- PICO-I (Intervención): ${picoData?.intervention || 'N/A'}
- PICO-O (Outcomes): ${picoOutcome}
- Rango temporal: ${yearStart || 2019} a ${yearEnd || 2025}

ENFOQUE SOLICITADO POR EL USUARIO:
"${customFocus}"

REGLAS DE COHERENCIA:
1. El criterio de EXCLUSIÓN NO debe ser simplemente "No cumplir el de inclusión"
2. INCLUSIÓN = Características técnicas que DEBEN estar presentes
3. EXCLUSIÓN = Motivos técnicos específicos para descartar (contexto inadecuado, metodología deficiente, escala incorrecta)
4. Máximo 25 palabras por criterio
5. Usar términos técnicos precisos, evitar palabras vagas como "relevante"

INSTRUCCIONES ESPECÍFICAS PARA "${categoryName}":

${categoryName.toLowerCase().includes('cobertura') ? `
- INCLUSIÓN: Estudios que analicen la relación técnica específica entre [${technologies.join(', ')}] y [${domains.join(', ')}]
- EXCLUSIÓN: Estudios donde los términos aparecen en contextos ajenos o sin relación técnica directa
` : ''}

${categoryName.toLowerCase().includes('tecnolog') ? `
- INCLUSIÓN: Uso específico de [${technologies.join(', ')}] como tecnología principal o arquitectural
- EXCLUSIÓN: Tecnologías obsoletas, mencionadas tangencialmente, o fuera del ecosistema técnico definido
` : ''}

${categoryName.toLowerCase().includes('resultado') || categoryName.toLowerCase().includes('outcome') ? `
- INCLUSIÓN: Estudios que evalúen específicamente [${themes.join(', ')}] con métricas cuantificables
- EXCLUSIÓN: Estudios puramente descriptivos sin evaluación empírica de los focos temáticos
` : ''}

${categoryName.toLowerCase().includes('tipo de estudio') ? `
- INCLUSIÓN: Investigaciones empíricas, experimentales, comparativas o estudios de caso técnicos
- EXCLUSIÓN: Opiniones, tutoriales, discusiones conceptuales sin validación experimental
` : ''}

${categoryName.toLowerCase().includes('documento') ? `
- INCLUSIÓN: Artículos de revistas científicas y conferencias indexadas (peer-reviewed)
- EXCLUSIÓN: Blogs, white papers, libros de texto, documentación oficial de proveedores
` : ''}

${categoryName.toLowerCase().includes('temporal') || categoryName.toLowerCase().includes('idioma') ? `
- INCLUSIÓN: Artículos en inglés publicados entre ${yearStart || 2019} y ${yearEnd || 2025}
- EXCLUSIÓN: Estudios anteriores a ${yearStart || 2019} o en otros idiomas sin traducción técnica certificada
` : ''}

FORMATO DE SALIDA:
Responde ÚNICAMENTE con DOS líneas:
INCLUSIÓN: [criterio de inclusión]
EXCLUSIÓN: [criterio de exclusión]
`;
  }

  /**
   * Construye un prompt para regenerar ÚNICAMENTE un criterio específico
   */
  buildSingleCriterionPrompt({ title, technologies, domains, studyTypes, themes, picoData, picoOutcome, specificType, customFocus, categoryIndex, categoryName, yearStart, yearEnd, rejectedTerms }) {
    const typeLabel = specificType === 'inclusion' ? 'INCLUSIÓN' : 'EXCLUSIÓN';
    const isInclusion = specificType === 'inclusion';

    return `
Eres un revisor metodológico de la metodología PRISMA 2020.
Tarea: Redactar UN SOLO criterio de ${typeLabel} para la categoría "${categoryName}".

${rejectedTerms && rejectedTerms.length > 0 ? `TÉRMINOS PROHIBIDOS - NO MENCIONAR:
${rejectedTerms.map(t => `- ${t}`).join(', ')}
Usar SOLO los términos confirmados abajo. NO derivar términos prohibidos del PICO.

` : ''}CONTEXTO PARA COHERENCIA (USAR SOLO ESTOS TÉRMINOS CONFIRMADOS):
- Tecnología central: ${technologies.join(', ')}
- Dominio/Contexto: ${domains.join(', ')}
- Focos temáticos: ${themes.join(', ')}
- PICO-I: ${picoData?.intervention || 'N/A'}
- PICO-P: ${picoData?.population || 'N/A'}
- PICO-O: ${picoOutcome}
- Rango temporal: ${yearStart || 2019} a ${yearEnd || 2025}

ENFOQUE SOLICITADO POR EL USUARIO:
"${customFocus}"

REGLAS DE ORO PARA EL CRITERIO:
1. Sé ultra-específico. Evita palabras como "relevante" o "importante".
2. Si es INCLUSIÓN: Describe la característica técnica que DEBE estar presente.
3. Si es EXCLUSIÓN: Describe el motivo por el cual un estudio, aunque parezca tratar el tema, debe ser descartado (ej: falta de rigor, escala inadecuada, tipo de documento).
4. No uses más de 25 palabras.
5. El criterio de EXCLUSIÓN NO debe ser simplemente "No cumplir el de inclusión", sino justificar técnicamente POR QUÉ se descarta.

INSTRUCCIONES SEGÚN CATEGORÍA "${categoryName}":

${categoryName.toLowerCase().includes('cobertura') ? `
- Mencionar explícitamente la relación entre ${technologies.join(', ')} y ${domains.join(', ')}
- ${isInclusion ? 'INCLUSIÓN: Estudios que analicen [I] aplicados a [P] para [O]' : 'EXCLUSIÓN: Estudios donde el tema es tangencial o no aborda la relación técnica central'}
` : ''}

${categoryName.toLowerCase().includes('tecnolog') ? `
- Especificar el ROL de la tecnología (ej: "como arquitectura principal")
- ${isInclusion ? 'INCLUSIÓN: Uso específico de [tecnología] en el diseño o implementación' : 'EXCLUSIÓN: Tecnologías obsoletas o fuera del ecosistema definido en el protocolo'}
` : ''}

${categoryName.toLowerCase().includes('tipo de estudio') ? `
- ${isInclusion ? 'INCLUSIÓN: Investigaciones empíricas, experimentales, comparativas técnicas' : 'EXCLUSIÓN: Artículos de opinión, tutoriales sin validación, discusiones conceptuales sin datos'}
` : ''}

${categoryName.toLowerCase().includes('documento') ? `
- ${isInclusion ? 'INCLUSIÓN: Artículos de revistas científicas y conferencias indexadas (peer-reviewed)' : 'EXCLUSIÓN: Blogs, white papers, libros de texto o documentación oficial de proveedores'}
` : ''}

${categoryName.toLowerCase().includes('temporal') ? `
- OBLIGATORIO: Usar exactamente ${yearStart || 2019}-${yearEnd || 2025}
- ${isInclusion ? `INCLUSIÓN: Publicaciones realizadas entre ${yearStart || 2019} y ${yearEnd || 2025}` : `EXCLUSIÓN: Estudios publicados antes de ${yearStart || 2019} o sin relevancia para el estado del arte actual`}
` : ''}

${categoryName.toLowerCase().includes('idioma') ? `
- ${isInclusion ? 'INCLUSIÓN: Artículos en Inglés (idioma dominante en literatura técnica)' : 'EXCLUSIÓN: Artículos en otros idiomas sin traducción técnica certificada o resumen detallado'}
` : ''}

RESPONDE SOLO CON EL TEXTO DEL CRITERIO (máximo 25 palabras):
`;
  }

  /**
   * Parsea la respuesta de la IA en formato tabla o criterio único
   */
  parseResponse(text, isSingleCriterion = false, categoryIndex = null, categoryName = null) {
    console.log('Parseando respuesta de criterios...');
    console.log('Texto completo:', text.substring(0, 500));

    // Si es regeneración de categoría específica, buscar formato "INCLUSIÓN: ... EXCLUSIÓN: ..."
    if (isSingleCriterion && categoryIndex !== null && categoryName !== null) {
      const inclusionMatch = text.match(/INCLUSI[ÓO]N:\s*(.+)/i);
      const exclusionMatch = text.match(/EXCLUSI[ÓO]N:\s*(.+)/i);
      
      if (inclusionMatch && exclusionMatch) {
        const inclusion = inclusionMatch[1].trim().replace(/^["']|["']$/g, '');
        const exclusion = exclusionMatch[1].trim().replace(/^["']|["']$/g, '');
        
        console.log('Ambos criterios parseados:', { inclusion, exclusion });
        
        return { 
          bothCriteria: true,
          categoryIndex,
          categoryName,
          inclusion,
          exclusion
        };
      }
      
      // Fallback: buscar criterio único (formato anterior)
      const cleanedText = text.trim()
        .replace(/^["']|["']$/g, '') 
        .replace(/^\*\*|\*\*$/g, '');
      
      console.log('Criterio único parseado (fallback):', cleanedText);
      return { singleCriterion: cleanedText };
    }

    const criteria = [];

    // Método 1: Intentar extraer tabla (con o sin pipes al inicio/final)
    const cleanedText = text.replace(/\|\s*\n\s+/g, ' | '); // Unir líneas dentro de celdas
    const lines = cleanedText.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      // Ignorar líneas vacías o separadores
      if (!trimmed || 
          trimmed.toUpperCase().includes('CATEGORÍA') && trimmed.toUpperCase().includes('INCLUSIÓN') ||
          trimmed.match(/^[\|:\-\s]+$/)) {
        continue;
      }
      
      // Si la línea contiene pipes, intentar parsearla
      if (trimmed.includes('|')) {
        // Remover pipes al inicio y final si existen
        let cleanLine = trimmed;
        if (cleanLine.startsWith('|')) cleanLine = cleanLine.substring(1);
        if (cleanLine.endsWith('|')) cleanLine = cleanLine.substring(0, cleanLine.length - 1);
        
        const parts = cleanLine.split('|')
          .map(p => p.trim())
          .filter(p => p.length > 0);
        
        // Debe tener al menos 3 partes: categoría, inclusión, exclusión
        if (parts.length >= 3) {
          const category = parts[0];
          const inclusion = parts[1];
          const exclusion = parts[2];
          
          // Validar que no sea una línea de encabezado
          if (category && inclusion && exclusion &&
              !category.match(/^[-:\s]+$/) &&
              !category.toLowerCase().includes('criterio') &&
              category.length > 3 && // Categoría debe tener contenido
              inclusion.length > 10) { // Inclusión debe tener contenido real
            
            criteria.push({
              category: category,
              inclusion: inclusion,
              exclusion: exclusion
            });
            console.log(`Criterio parseado: ${category}`);
          }
        }
      }
    }

    console.log(`Total criterios parseados: ${criteria.length}`);

    // Si no se encontró formato de tabla, intentar buscar las 6 categorías directamente
    if (criteria.length === 0) {
      console.warn('No se encontró formato de tabla estándar, buscando categorías directamente...');
      return this.parseByCategories(text);
    }

    // Asegurar que haya exactamente 6 categorías (nivel protocolo PRISMA)
    if (criteria.length < 6) {
      console.warn(`Solo se encontraron ${criteria.length} categorías, buscando las faltantes...`);
      const foundCategories = new Set(criteria.map(c => c.category.toLowerCase()));
      
      const defaultCategories = [
        { name: 'Cobertura temática', aliases: ['cobertura', 'tematica', 'temática'] },
        { name: 'Tecnologías abordadas', aliases: ['tecnologías', 'tecnologia', 'abordadas'] },
        { name: 'Tipo de estudio', aliases: ['tipo de estudio', 'tipo estudio', 'estudio'] },
        { name: 'Tipo de documento', aliases: ['tipo de documento', 'tipo documento', 'documento'] },
        { name: 'Rango temporal', aliases: ['rango temporal', 'rango', 'temporal'] },
        { name: 'Idioma', aliases: ['idioma', 'lenguaje', 'language'] }
      ];

      for (const defaultCat of defaultCategories) {
        const hasCategory = foundCategories.has(defaultCat.name.toLowerCase()) ||
                           defaultCat.aliases.some(alias => foundCategories.has(alias));
        
        if (!hasCategory && criteria.length < 6) {
          criteria.push({
            category: defaultCat.name,
            inclusion: 'Definir criterio de inclusión específico',
            exclusion: 'Definir criterio de exclusión específico'
          });
        }
      }
    }

    // Convertir a formato esperado por el frontend: dos arrays separados
    const inclusionCriteria = criteria.map(c => ({
      categoria: c.category,
      criterio: c.inclusion
    }));
    
    const exclusionCriteria = criteria.map(c => ({
      categoria: c.category,
      criterio: c.exclusion
    }));

    return { 
      criteria,  // Mantener formato antiguo por compatibilidad
      inclusionCriteria, 
      exclusionCriteria 
    };
  }

  /**
   * Parser que busca categorías específicas en el texto
   */
  parseByCategories(text) {
    const categories = [
      { 
        name: 'Cobertura temática',
        patterns: [/cobertura\s+tem[aá]tica/gi, /cobertura/gi]
      },
      { 
        name: 'Tecnologías abordadas',
        patterns: [/tecnolog[ií]as?\s+abordadas?/gi, /tecnolog[ií]as?/gi]
      },
      { 
        name: 'Tipo de estudio',
        patterns: [/tipo\s+de\s+estudio/gi, /tipo\s+estudio/gi]
      },
      { 
        name: 'Tipo de documento',
        patterns: [/tipo\s+de\s+documento/gi, /tipo\s+documento/gi]
      },
      { 
        name: 'Rango temporal',
        patterns: [/rango\s+temporal/gi, /rango/gi]
      },
      { 
        name: 'Idioma',
        patterns: [/idioma/gi, /lenguaje/gi]
      }
    ];

    const criteria = [];

    // Dividir en filas de tabla por el separador |
    const rows = text.split('\n').filter(line => {
      const trimmed = line.trim();
      return trimmed.startsWith('|') && trimmed.endsWith('|') && 
             !trimmed.match(/^[\|:\-\s]+$/); // No es separador
    });

    console.log(`Encontradas ${rows.length} filas de tabla`);

    for (const category of categories) {
      // Buscar la fila que contiene esta categoría
      for (const row of rows) {
        let found = false;
        for (const pattern of category.patterns) {
          if (pattern.test(row)) {
            found = true;
            break;
          }
        }

        if (found) {
          // Extraer las 3 columnas
          const columns = row.split('|')
            .map(col => col.trim())
            .filter(col => col.length > 0);

          if (columns.length >= 3) {
            criteria.push({
              category: category.name,
              inclusion: columns[1],
              exclusion: columns[2]
            });
            console.log(`Categoría encontrada: ${category.name}`);
            break;
          }
        }
      }
    }

    console.log(`Total categorías encontradas: ${criteria.length}`);

    // Si aún no tenemos 6, agregar valores predeterminados
    if (criteria.length < 6) {
      for (const category of categories) {
        if (!criteria.find(c => c.category === category.name)) {
          criteria.push({
            category: category.name,
            inclusion: 'Definir criterio de inclusión',
            exclusion: 'Definir criterio de exclusión'
          });
        }
      }
    }

    // Convertir a formato esperado por el frontend
    const inclusionCriteriaFormatted = criteria.map(c => ({
      categoria: c.category,
      criterio: c.inclusion
    }));
    
    const exclusionCriteriaFormatted = criteria.map(c => ({
      categoria: c.category,
      criterio: c.exclusion
    }));

    return { 
      criteria,
      inclusionCriteria: inclusionCriteriaFormatted, 
      exclusionCriteria: exclusionCriteriaFormatted 
    };
  }
}

module.exports = GenerateInclusionExclusionCriteriaUseCase;

