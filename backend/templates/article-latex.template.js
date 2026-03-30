/**
 * Template LaTeX para exportación de artículos científicos
 * Compatible con formato universal PRISMA 2020 para journals Q1 (IEEE, ACM, Elsevier, Springer, MDPI)
 * 
 * Target: ~7,200 palabras (~13 páginas)
 * Distribución: Abstract+Intro ~1,200 | Metodología ~2,000 | Resultados ~2,500 |
 *               Discusión+Conclusiones ~1,500 | Referencias N/A
 * 
 * Reglas de formato:
 * - Título: máx 25 palabras
 * - Abstract: 250-400 palabras, estructura IMRaD en un solo párrafo
 * - Keywords: 3-6 palabras clave
 * - Introduction: 800-1000 palabras, DEBE terminar con lista explícita de RQs
 * - Methods: ~2000 palabras, incluye sección 2.4 de screening IA + método del codo
 * - Results: ~2500 palabras, síntesis de datos SIN opiniones del autor
 * - Discussion: 800-1200 palabras, incluye subsección Threats to Validity
 * - Conclusions: 500-800 palabras (5-10%), estructura: respuestas RQ → contribución → práctica → futuro
 * - Gráficos: PDF vector (no PNG) para journals de alto impacto
 * 
 * Uso: 
 * const template = require('./article-latex.template');
 * const latex = template.generate(articleData, userProfile);
 */

/**
 * Genera documento LaTeX completo desde datos del artículo
 * @param {Object} articleData - Datos del artículo (title, abstract, sections, etc.)
 * @param {Object} userProfile - Datos del usuario (fullName, email, etc.)
 */
function generate(articleData, userProfile = null) {
  // Extraer datos del perfil de usuario para autor
  const defaultAuthor = userProfile ? {
    name: userProfile.fullName || 'Author Name',
    email: userProfile.email || 'email@espe.edu.ec',
    institution: 'Universidad de las Fuerzas Armadas ESPE',
    department: 'Departamento de Ciencias de la Computación',
    city: 'Sangolquí',
    country: 'Ecuador'
  } : null;

  return `\\documentclass[conference]{IEEEtran}

% -------------------- PAQUETES BÁSICOS --------------------
\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
\\usepackage[spanish]{babel}
\\usepackage{graphicx}
\\usepackage{float}
\\usepackage{booktabs}
\\usepackage{longtable}
\\usepackage{array}
\\usepackage{amsmath}
\\usepackage{amssymb}
\\usepackage{hyperref}
\\usepackage{cite}
\\usepackage{caption}
\\usepackage{rotating}

\\hypersetup{
  colorlinks=true,
  linkcolor=black,
  citecolor=black,
  urlcolor=black
}

% -------------------- TÍTULO --------------------
\\title{${escapeLatex(articleData.title || 'Systematic Literature Review')}}

% -------------------- AUTORES --------------------
\\author{
${generateUniversalAuthors(articleData.authors || (defaultAuthor ? [defaultAuthor] : []))}
}

\\begin{document}

\\maketitle

% -------------------- ABSTRACT --------------------
% 📏 250–400 palabras (IMRaD single paragraph — MDPI/IEEE extended SLR standard)
% 📌 Estructura: Un solo párrafo con 4 segmentos: Introducción/Métodos/Resultados/Discusión
% 📌 Sin citas, sin figuras, sin saltos de línea
\\begin{abstract}
${escapeLatex(articleData.abstract || 'This systematic review examines... Following PRISMA 2020 guidelines, a structured search and screening process was conducted... Results indicate... These findings suggest...')}
\\end{abstract}

% -------------------- KEYWORDS --------------------
% 📌 3–6 palabras clave (OBLIGATORIO)
\\begin{IEEEkeywords}
${generateUniversalKeywords(articleData.keywords || [])}
\\end{IEEEkeywords}

% -------------------- 1. INTRODUCTION --------------------
% 📏 800-1000 palabras
% 📌 Estructura: Contextualización → Importancia → Vacíos → Estado actual → Justificación → Objetivos
% 📌 DEBE terminar con lista explícita de Research Questions (RQ1, RQ2, RQ3)
\\section{INTRODUCTION}

% CONTEXTUALIZACIÓN GENERAL DEL TEMA
${convertMarkdownToLatex(articleData.introduction || `[Tu contexto general sobre el tema de investigación]

% IMPORTANCIA DEL PROBLEMA
El problema de investigación es relevante porque [razones de importancia].

% VACÍOS EXISTENTES EN LA LITERATURA
A pesar de los avances en el área, existen vacíos significativos en la literatura científica relacionados con [describir vacíos].

% VARIABLES PRINCIPALES
Las variables principales consideradas en este estudio incluyen [enumerar variables].

% ESTADO ACTUAL DEL CONOCIMIENTO
El estado actual del conocimiento sugiere que [describir estado actual].

% JUSTIFICACIÓN DE LA REVISIÓN SISTEMÁTICA
Esta revisión sistemática se justifica por la necesidad de [explicar justificación].

% OBJETIVO GENERAL
El objetivo general de esta revisión es [describir objetivo general].

% OBJETIVOS ESPECÍFICOS
Los objetivos específicos son:
\\begin{itemize}
    \\item [Objetivo específico 1]
    \\item [Objetivo específico 2]
    \\item [Objetivo específico 3]
\\end{itemize}`, 'ieee')}

% -------------------- 2. METHODOLOGÍA --------------------
% 📌 Sección PRISMA 2020 compliant con estructura clara
\\section{METODOLOGÍA}

\\subsection{Study Design}
This work corresponds to a systematic literature review developed according to the PRISMA 2020 guidelines, aiming to guarantee a structured, transparent, and reproducible process.

\\subsection{Search Strategy}
La búsqueda sistemática de literatura científica se realizó en las siguientes bases de datos académicas:

${generateMethodsSection(articleData.methods || '')}

% -------------------- 3. RESULTADOS --------------------
% 📌 PRISMA diagram + Caracterización + Análisis RQS + Síntesis
\\section{RESULTS}

${generateResultsSection(articleData.results || '')}

% -------------------- 4. DISCUSIÓN --------------------
% 📏 800-1200 palabras — Interpretación crítica, comparación con literatura, implicaciones
% 📌 DEBE incluir subsección "Threats to Validity" (sesgo publicación, BD, IA, idioma)
% 📌 NO repetir resultados, NO tablas nuevas
\\section{DISCUSSION}

${convertMarkdownToLatex(articleData.discussion || `Los hallazgos de esta revisión sistemática revelan [describe interpretación de hallazgos principales].

Al comparar estos resultados con la literatura previa, se observa [describir concordancia o discrepancia con otros estudios]. Por ejemplo, [Autor et al., año] reportan hallazgos similares en [contexto], lo cual refuerza [argumento]. Sin embargo, [Autor et al., año] presentan evidencia contradictoria respecto a [aspecto específico], lo que sugiere que [explicación posible].

Las implicaciones prácticas de estos resultados incluyen [describir aplicabilidad en contextos reales]. En particular, [hallazgo específico] podría [describir impacto potencial].

Desde una perspectiva teórica, estos hallazgos [describir contribución al conocimiento]. La [tendencia/patrón observado] sugiere que [interpretación teórica], lo cual [relevancia para la teoría/campo de estudio].

Es importante considerar que [contexto o matices que afectan la interpretación]. Además, [mencionar factores que puedan explicar variabilidad en hallazgos].`, 'ieee')}

% -------------------- 5. LIMITACIONES --------------------
% 📌 Reconocer debilidades metodológicas, sesgos potenciales, restricciones
\\section{LIMITATIONS}

${convertMarkdownToLatex(articleData.limitations || `Esta revisión sistemática presenta las siguientes limitaciones que deben considerarse al interpretar los hallazgos:

\\begin{itemize}
    \\item \\textbf{Sesgo de publicación:} La búsqueda se limitó a bases de datos académicas, lo que podría excluir estudios con resultados negativos o literatura gris relevante.
    
    \\item \\textbf{Restricción idiomática:} Solo se incluyeron estudios publicados en [idiomas considerados], lo cual podría sesgar los resultados hacia literatura de ciertas regiones geográficas.
    
    \\item \\textbf{Heterogeneidad metodológica:} La diversidad en diseños de estudio, poblaciones y métricas reportadas limitó la posibilidad de realizar meta-análisis cuantitativos, obligando a una síntesis narrativa.
    
    \\item \\textbf{Calidad metodológica variable:} Algunos estudios incluidos presentaron puntuaciones RQS moderadas o bajas, lo cual afecta la confiabilidad de sus conclusiones.
    
    \\item \\textbf{Sesgo de selección:} A pesar del uso de IA para priorización, el proceso de cribado humano puede estar sujeto a interpretación subjetiva de criterios de inclusión/exclusión.
\\end{itemize}

Estas limitaciones sugieren que los resultados deben interpretarse con cautela y considerarse como una síntesis del estado actual del conocimiento, sujeta a refinamiento conforme nueva evidencia esté disponible.`, 'ieee')}

% -------------------- 6. CONCLUSIONES Y LÍNEAS FUTURAS --------------------
% 📏 Síntesis concisa + Recomendaciones + Direcciones futuras
% 📌 Responde: ¿Qué se aprendió? ¿Qué implicaciones tiene? ¿Qué falta investigar?
\\section{CONCLUSIONS AND FUTURE WORK}

${convertMarkdownToLatex(articleData.conclusions || `Esta revisión sistemática, desarrollada conforme a las directrices PRISMA 2020, permitió alcanzar los siguientes hallazgos principales:

\\begin{itemize}
    \\item [Conclusión 1: Hallazgo clave relacionado con objetivo específico 1]
    \\item [Conclusión 2: Hallazgo clave relacionado con objetivo específico 2]
    \\item [Conclusión 3: Hallazgo clave relacionado con objetivo específico 3]
\\end{itemize}

Estos hallazgos evidencian que [sintetizar mensaje principal de la revisión]. La evidencia actual sugiere [implicación teórica o práctica principal].

\\textbf{Implicaciones prácticas:} Los resultados pueden orientar [describir aplicación práctica] y apoyar la toma de decisiones en [contexto específico].

\\textbf{Líneas futuras de investigación:}

Considerando las limitaciones identificadas y los vacíos detectados en la literatura, se recomienda:

\\begin{itemize}
    \\item Realizar estudios primarios con mayor rigor metodológico en [área específica identificada como deficiente].
    \\item Desarrollar meta-análisis cuantitativos cuando haya mayor homogeneidad en [aspecto metodológico].
    \\item Investigar el impacto de [variable/factor no suficientemente explorado] en [outcome de interés].
    \\item Expandir la evidencia hacia [contextos/poblaciones subrepresentadas].
    \\item Replicar revisiones sistemáticas incluyendo literatura gris y estudios en [idiomas adicionales].
\\end{itemize}

En conclusión, esta revisión contribuye a [describir aporte al campo] y establece una base sólida para futuras investigaciones en [tema principal].`, 'ieee')}

% -------------------- DECLARATIONS --------------------
% ⚠️ Opcional: Se puede omitir si el journal no lo requiere
\\section*{Financiamiento}
Esta investigación no recibió financiamiento externo.

\\section*{Conflicto de intereses}
Los autores declaran no tener conflictos de intereses.

\\section*{Registro del protocolo}
${convertMarkdownToLatex(articleData.declarations || 'El protocolo de esta revisión no fue registrado previamente en plataformas de registro internacional.', 'ieee')}

\\section*{Disponibilidad de datos}
Los datos están disponibles previa solicitud razonable al autor de correspondencia.

% -------------------- 7. REFERENCIAS --------------------
% 📌 Formato APA o IEEE según requerimiento del journal
\\section{REFERENCIAS}

\\begin{thebibliography}{${(articleData.references || []).length}}
${generateBibliography(articleData.references || [])}
\\end{thebibliography}

\\end{document}`;
}

/**
 * Genera sección de autores en formato universal simple
 * Compatible con plantilla de dos columnas estándar
 */
function generateUniversalAuthors(authors) {
  if (!Array.isArray(authors) || authors.length === 0) {
    return `\\IEEEauthorblockN{Nombre Apellido}
\\IEEEauthorblockA{\\textit{Afiliación institucional} \\\\
País \\\\
email@institucion.edu}`;
  }

  return authors.map((author) => {
    return `\\IEEEauthorblockN{${escapeLatex(author.name)}}
\\IEEEauthorblockA{\\textit{${escapeLatex(author.institution || 'Universidad de las Fuerzas Armadas ESPE')}} \\\\
${escapeLatex(author.city ? author.city + ', ' + author.country : author.country || 'Ecuador')} \\\\
${escapeLatex(author.email || 'email@institucion.edu')}}`;
  }).join('\\and ');
}

/**
 * Función legacy para compatibilidad con templates IEEEtran
 */
function generateAuthors(authors) {
  return generateUniversalAuthors(authors);
}

/**
 * Genera sección de Methods con estructura PRISMA 2020
 * Incluye gráfico de codo si está disponible en la ubicación correcta
 */
function generateMethodsSection(methodsContent, includeElbowPlot = true, format = 'ieee') {
  // Si hay contenido markdown, convertirlo
  if (methodsContent && typeof methodsContent === 'string') {
    let latex = convertMarkdownToLatex(methodsContent, format);
    
    // Si el contenido no incluye el gráfico de codo y debe incluirlo, agregarlo antes de Data Extraction
    if (includeElbowPlot && !latex.includes('elbow') && !latex.includes('codo')) {
      // Buscar la sección de Data Extraction y agregar el gráfico antes
      const extractionPattern = /(\\subsection\{.*Extracción de datos|\\subsection\{.*Data Extraction)/i;
      if (extractionPattern.test(latex)) {
        const elbowSection = `
% -------------------- PRIORIZACIÓN CON IA (Gráfico de Codo) --------------------
\\subsection{Priorización mediante Inteligencia Artificial}

Se utilizó un enfoque híbrido de cribado asistido por IA. Las referencias descargadas fueron analizadas semánticamente para generar un puntaje de relevancia (0-1). La Figura~\\ref{fig:codo} muestra la distribución de estos puntajes, permitiendo identificar el punto de inflexión (knee point) óptimo para maximizar la recuperación de estudios relevantes minimizando el esfuerzo de revisión manual.

\\begin{figure}[!htbp]
\\centering
\\includegraphics[width=\\linewidth]{scree_plot}
\\caption{Distribución visual de puntajes de relevancia ordenados de mayor a menor. La línea vertical indica el punto de inflexión utilizado como criterio de corte para priorizar la revisión manual.}
\\label{fig:codo}
\\end{figure}

`;
        latex = latex.replace(extractionPattern, elbowSection + '$1');
      }
    }
    
    return latex;
  }

  // Estructura PRISMA 2020 compliant con subsecciones 2.3-2.7 según estructura académica
  return `
\\subsection{Inclusion and Exclusion Criteria}

% ---- CRITERIOS DE INCLUSIÓN ----
The studies included in the review had to meet the following criteria:

\\begin{itemize}
    \\item \\textbf{Inclusion Criterion 1:} [Describe specific criterion]
    \\item \\textbf{Inclusion Criterion 2:} [Describe specific criterion]
    \\item \\textbf{Inclusion Criterion 3:} [Describe specific criterion]
    \\item \\textbf{Inclusion Criterion 4:} [Describe specific criterion]
\\end{itemize}

% ---- CRITERIOS DE EXCLUSIÓN ----
Conversely, the exclusion criteria were:

\\begin{itemize}
    \\item \\textbf{Exclusion Criterion 1:} [Describe specific criterion]
    \\item \\textbf{Exclusion Criterion 2:} [Describe specific criterion]
    \\item \\textbf{Exclusion Criterion 3:} [Describe specific criterion]
\\end{itemize}

\\subsection{AI-assisted Prioritization}

In order to optimize the screening process and reduce manual effort, a hybrid approach combining semantic analysis assisted by AI with expert human review was implemented.

The references obtained from the databases were processed using a semantic similarity model that assigns a relevance score in the range [0, 1], where values close to 1 indicate high relevance with respect to the defined inclusion criteria.

Figure~\\ref{fig:codo} presents the distribution of these scores sorted in descending order (scree plot curve), allowing the identification of the optimal knee point that balances maximizing retrieved relevant studies and minimizing the volume of references for manual review.

\\begin{figure}[!htbp]
\\centering
\\includegraphics[width=\\linewidth]{scree_plot}
\\caption{Scree plot: distribution of semantic relevance scores sorted decreasingly. The red vertical line points to the knee point used as the cut-off threshold to prioritize manual review.}
\\label{fig:codo}
\\end{figure}

This approach allowed prioritizing the studies most likely to meet the eligibility criteria, increasing the efficiency of the screening process without compromising the comprehensiveness of the review.

\\subsection{Data Extraction}

Data extraction was carried out using a structured form specifically designed to capture relevant information from the included studies. The extracted data comprised:

\\begin{itemize}
    \\item \\textbf{General characteristics:} author(s), publication year, country, study type
    \\item \\textbf{Methodological characteristics:} design, population/sample, evaluated intervention
    \\item \\textbf{Main results:} metrics, outcomes, key findings
    \\item \\textbf{Reported limitations:} biases, study restrictions
\\end{itemize}

The extraction was performed independently by [number] reviewers, resolving discrepancies through consensus or consultation with a third evaluator.

\\subsection{Methodological Quality Assessment (RQS)}

To guarantee the thoroughness of the included studies, a quality assessment was applied using a \\textbf{Research Quality Score (RQS)} schema. This instrument allows evaluating critical dimensions such as:

\\begin{itemize}
    \\item Clarity in the study's objectives and design
    \\item Adequacy of the applied methodology
    \\item Transparency in the reporting of results
    \\item Consideration of limitations and potential biases
    \\item Relevance and applicability of the conclusions
\\end{itemize}

The studies were classified into quality categories (high, moderate, low) based on their total RQS score, allowing findings to be interpreted with greater context and criticality.

\\subsection{PRISMA Flow Diagram}

The complete search, screening, and selection process for studies is summarized in the PRISMA flow diagram presented in Figure~\\ref{fig:prisma} (Section 3 - Results). This visual diagram illustrates the identification, screening, and eligibility stages, as well as the specific reasons for exclusion at each phase of the review process.`;
}


/**
 * Genera sección de Results con PRISMA diagram y subsecciones 3.1-3.3
 * El gráfico de codo (elbow) debe estar en Methods 2.4, no aquí
 */
function generateResultsSection(resultsContent, format = 'ieee') {
  // Si hay contenido markdown personalizado, usarlo
  if (resultsContent && typeof resultsContent === 'string') {
    let content = convertMarkdownToLatex(resultsContent, format);
    
    // Si no menciona PRISMA diagram, agregarlo al inicio
    if (!content.toLowerCase().includes('prisma') && !content.includes('figure')) {
      content = `\\subsection{PRISMA Flow Diagram}

The complete process for identification, screening, and study selection is summarized in the flow diagram in Figure~\\ref{fig:prisma}, elaborated following the PRISMA 2020 guidelines.

\\begin{figure*}[!htbp]
\\centering
\\includegraphics[width=0.9\\textwidth]{prisma_diagram}
\\caption{PRISMA 2020 flow diagram of the systematic review process. Reveals the phases of identification, screening, eligibility, and final inclusion, along with the specific exclusive reasoning for each stage.}
\\label{fig:prisma}
\\end{figure*}

` + content;
    }
    
    return content;
  }

  // Estructura por defecto con subsecciones 3.1-3.3 según estructura académica
  return `
% PRISMA DIAGRAM al inicio de Resultados  
\\subsection{PRISMA Flow Diagram}

The complete process for identification, screening, and selection of studies is summarized in the flow diagram in Figure~\\ref{fig:prisma}, elaborated following the PRISMA 2020 guidelines.

\\begin{figure*}[!htbp]
\\centering
\\includegraphics[width=0.9\\textwidth]{prisma_diagram}
\\caption{PRISMA 2020 flow diagram summarizing the systematic review process. Outlines the phases of identification, screening, eligibility, and final inclusion of studies, sorted by academic database and including specific reasons for exclusion continuously.}
\\label{fig:prisma}
\\end{figure*}

The initial search identified a total of [N] records in the consulted databases, of which [N] were eliminated due to duplication. After title and abstract screening of [N] records, [N] articles were selected for full-text review. Ultimately, [N] studies met all inclusion criteria and were incorporated into qualitative synthesis.

\\subsection{General Study Characteristics}

The [N] included studies were published between [year] and [year], presenting a higher concentration over the last [X] years, showcasing ascending interest natively. Geographically, a majority issue from [lead regions/countries].

Regarding the methodological design, [X\\%] embodied [study type], [X\\%] as [study type], alongside [other designs]. The surveyed populations varied broadly from [describe population spectrums].

Table~\\ref{tab:caracteristicas} details the structural properties of these studies.

\\subsection{Methodological Quality Assessment (RQS)}

The evaluative screening using the RQS scale exposed that [X\\%] realized an uppermost score (> [threshold]), [X\\%] ranked moderately ([range]), whilst [X\\%] scaled poorly (< [threshold]).

Optimal achievements corresponded with [criteria], highlighting a distinct lack predominantly concerning [poor criteria], systematically due to [describe typical inadequacies].

\\subsection{Synthesis of Key Findings}

Narrative alignment from included datasets unveiled primary contributions sequentially:

\\begin{itemize}
    \\item \\textbf{Finding 1:} [Characterize central deduction]
    \\item \\textbf{Finding 2:} [Characterize central deduction]
    \\item \\textbf{Finding 3:} [Characterize central deduction]
\\end{itemize}

It manifested logically that [characterize trends, gaps or dissonances]. Generally observed metrics involved [list metrics], scoring amidst [ranges].

% Placeholder para tabla de síntesis de evidencia`;
}

/**
 * Genera keywords en formato universal con punto y coma
 * 📌 3–6 palabras clave (estándar IEEE/Elsevier/Springer/MDPI)
 */
function generateUniversalKeywords(keywords) {
  // Si keywords es string (generado por sistema), usarlo directamente
  if (typeof keywords === 'string' && keywords.trim().length > 0) {
    return escapeLatex(keywords);
  }
  
  // Si es array, procesar
  if (!Array.isArray(keywords) || keywords.length === 0) {
    return 'Revisión Sistemática; PRISMA; Metodología de Investigación';
  }
  
  // Convertir array a string con punto y coma
  const keywordList = keywords.map(k => escapeLatex(k.trim())).slice(0, 6);
  
  // Asegurar que incluya "Revisión Sistemática" si no está
  if (!keywordList.some(k => k.toLowerCase().includes('revisión') || k.toLowerCase().includes('review'))) {
    keywordList.push('Revisión Sistemática');
  }
  
  return keywordList.slice(0, 6).join('; ');
}

/**
 * Genera keywords separados por comas (formato IEEEtran legacy)
 * 📌 4–6 palabras clave, coinciden con términos del protocolo
 */
function generateKeywords(keywords) {
  return generateUniversalKeywords(keywords).replace(/;/g, ',');
}

/**
 * Genera bibliografía en formato IEEE
 */
function generateBibliography(references) {
  if (!Array.isArray(references) || references.length === 0) {
    return '\\bibitem{ref1} Author, A. (2024). Title of the paper. \\textit{Journal Name}, vol(issue), pages.';
  }

  return references.map((ref, index) => {
    const authors = ref.authors || 'Unknown Author';
    const year = ref.year || new Date().getFullYear();
    const title = escapeLatex(ref.title || 'Untitled');
    const journal = escapeLatex(ref.journal || ref.source || 'Unknown Journal');
    
    let citation = `\\bibitem{ref${index + 1}} ${authors} (${year}). ${title}. \\textit{${journal}}`;
    
    if (ref.volume) citation += `, vol. ${ref.volume}`;
    if (ref.issue) citation += `, no. ${ref.issue}`;
    if (ref.pages) citation += `, pp. ${ref.pages}`;
    if (ref.doi) citation += `, doi: ${ref.doi}`;
    
    citation += '.';
    return citation;
  }).join('\n\n');
}

/**
 * Procesa tablas markdown y las convierte a formato LaTeX académico profesional
 * Compatible con formato de dos columnas y estándares de journals Q1
 */
function processMarkdownTables(text, format = 'ieee') {
  if (!text) return text;
  
  // Detectar bloques de tabla markdown completos
  const tableRegex = /((?:^\|.+\|\s*$\n)+)/gm;
  
  let tableCounter = 0;
  
  return text.replace(tableRegex, (tableBlock) => {
    tableCounter++;
    const lines = tableBlock.trim().split('\n').filter(line => line.trim());
    
    if (lines.length < 2) return tableBlock; // Necesita al menos header + separator
    
    // Parsear filas
    const rows = lines.map(line => 
      line.split('|')
        .filter(cell => cell.trim())
        .map(cell => cell.trim())
    );
    
    if (rows.length < 2) return tableBlock;
    
    const headers = rows[0];
    const dataRows = rows.slice(2); // Skip separator line
    
    // Determinar anchos de columna basados en número de columnas
    // Usando anchos relativos (\textwidth) para adaptabilidad universal
    const numCols = headers.length;
    let columnSpec = '';
    
    if (numCols === 2) {
      // Tabla de búsqueda: Base de datos + Cadena de búsqueda
      // Anchos optimizados que suman 0.95 para margen de seguridad
      columnSpec = 'p{0.22\\\\textwidth} p{0.73\\\\textwidth}';
    } else if (numCols === 6) {
      // Tabla de características: ID + 5 columnas de datos (Tabla 2 y 4)
      // Proporciones ajustadas para evitar compresión vertical: suma 0.96
      columnSpec = 'p{0.05\\\\textwidth} p{0.23\\\\textwidth} p{0.14\\\\textwidth} p{0.14\\\\textwidth} p{0.20\\\\textwidth} p{0.20\\\\textwidth}';
    } else if (numCols === 7) {
      // Tabla de evidencia y métricas: ID + 6 columnas (Tabla 3)
      // Proporciones ajustadas: ID pequeño, evidencia grande, métricas mediana, 3 RQs pequeños, calidad mediana (suma 0.96)
      columnSpec = 'p{0.05\\\\textwidth} p{0.25\\\\textwidth} p{0.20\\\\textwidth} p{0.10\\\\textwidth} p{0.10\\\\textwidth} p{0.10\\\\textwidth} p{0.16\\\\textwidth}';
    } else if (numCols === 5) {
      // Tabla de riesgo de sesgo: ID + 4 columnas
      columnSpec = 'p{0.08\\\\textwidth} p{0.22\\\\textwidth} p{0.22\\\\textwidth} p{0.22\\\\textwidth} p{0.20\\\\textwidth}';
    } else if (numCols <= 3) {
      // Tablas genéricas de 3 columnas o menos
      const colWidth = (0.95 / numCols).toFixed(2);
      columnSpec = headers.map(() => `p{${colWidth}\\\\textwidth}`).join(' ');
    } else if (numCols === 4) {
      // Tablas de 4 columnas
      columnSpec = 'p{0.20\\\\textwidth} p{0.25\\\\textwidth} p{0.25\\\\textwidth} p{0.24\\\\textwidth}';
    } else {
      // Fallback: distribuir equitativamente
      const colWidth = (0.95 / numCols).toFixed(2);
      columnSpec = headers.map(() => `p{${colWidth}\\\\textwidth}`).join(' ');
    }
    
    // Ajuste seguro de columnas con envoltura si es LNCS
    let formattedColumnSpec = columnSpec;
    if (format === 'lncs') {
      formattedColumnSpec = columnSpec.split(' ').map(col => {
        // Reemplazar la especificación de p{...} por una versión segura >{\raggedright...}p{...}
        if (col.startsWith('p{')) {
          return `>{\\raggedright\\arraybackslash\\hspace{0pt}}${col}`;
        }
        return col;
      }).join(' ');
      // Aplicar \LTleft=0pt y \LTright=0pt al inicio de columnSpec para abarcar ancho en longtable
      formattedColumnSpec = `@{\\extracolsep{\\fill}} ${formattedColumnSpec} @{}`;
    }
    
    // Generar label y caption
    const tableCaption = generateTableCaption(headers);
    const tableLabel = tableCaption.includes('Bases de datos') ? 'tab:busqueda' : `tab:table${tableCounter}`;
    
    const isHighDensity = numCols > 5;
    const isVeryLong = dataRows.length > 20;
    
    let latexTable = '\\vspace{0.3cm}\n';
    
    if (format === 'lncs') {
      // Modo seguro LNCS (Strict Compliance)
      latexTable += '{\n'; // Block para contener cambios temporales de estilo
      latexTable += '\\setlength{\\tabcolsep}{3pt}\n';
      latexTable += '\\setlength{\\LTleft}{0pt}\n';
      latexTable += '\\setlength{\\LTright}{0pt}\n';
      
      if (isVeryLong || isHighDensity) {
        // Usar longtable explícito
        latexTable += '\\begin{longtable}{' + formattedColumnSpec + '}\n';
        latexTable += '\\caption{' + tableCaption + '} \\label{' + tableLabel + '} \\\\\n';
        latexTable += '\\toprule\n';
        latexTable += '\\textbf{' + headers.map(h => escapeLatexTableCell(h)).join('} & \\textbf{') + '} \\\\\n';
        latexTable += '\\midrule\n';
        latexTable += '\\endfirsthead\n';
        
        latexTable += '\\multicolumn{' + numCols + '}{c} {{\\bfseries \\tablename\\ \\thetable{} -- continued from previous page}} \\\\\n';
        latexTable += '\\toprule\n';
        latexTable += '\\textbf{' + headers.map(h => escapeLatexTableCell(h)).join('} & \\textbf{') + '} \\\\\n';
        latexTable += '\\midrule\n';
        latexTable += '\\endhead\n';
        
        latexTable += '\\midrule\n';
        latexTable += '\\multicolumn{' + numCols + '}{r}{{Continued on next page}} \\\\\n';
        latexTable += '\\endfoot\n';
        
        latexTable += '\\bottomrule\n';
        latexTable += '\\endlastfoot\n';
        
        dataRows.forEach((row, index) => {
          latexTable += row.map(cell => escapeLatexTableCell(cell)).join(' & ') + ' \\\\\n';
          if (index < dataRows.length - 1) {
             latexTable += '\\midrule\n';
          }
        });
        latexTable += '\\end{longtable}\n';
      } else {
        // Tabla normal corta
        latexTable += '\\begin{table}[!htbp]\n';
        latexTable += '\\centering\n';
        latexTable += `\\caption{${tableCaption}}\n`;
        latexTable += `\\label{${tableLabel}}\n`;
        latexTable += `\\begin{tabular*}{\\textwidth}{${formattedColumnSpec}}\n`;
        latexTable += '\\toprule\n';
        latexTable += '\\textbf{' + headers.map(h => escapeLatexTableCell(h)).join('} & \\textbf{') + '} \\\\\n';
        latexTable += '\\midrule\n';
        
        dataRows.forEach((row, index) => {
          latexTable += row.map(cell => escapeLatexTableCell(cell)).join(' & ') + ' \\\\\n';
          if (index < dataRows.length - 1) {
             latexTable += '\\midrule\n';
          }
        });
        latexTable += '\\bottomrule\n';
        latexTable += '\\end{tabular*}\n';
        latexTable += '\\end{table}\n';
      }
      latexTable += '}\n\\vspace{0.3cm}\n';
      
    } else {
      // Formato IEEE/Elsevier legacy
      const envName = isHighDensity ? 'sidewaystable*' : 'table*';
  
      latexTable += `\n\\begin{${envName}}[!htbp]\n`;
      latexTable += '\\centering\n';
      latexTable += '\\renewcommand{\\arraystretch}{1.3}\n';
      latexTable += `\\caption{${tableCaption}}\n`;
      latexTable += `\\label{${tableLabel}}\n`;
      latexTable += `\\begin{tabular}{${columnSpec}}\n`;
      latexTable += '\\toprule\n';
      
      latexTable += '\\textbf{' + headers.map(h => escapeLatexTableCell(h)).join('} & \\textbf{') + '} \\\\\n';
      latexTable += '\\midrule\n';
      
      dataRows.forEach((row, index) => {
        latexTable += row.map(cell => escapeLatexTableCell(cell)).join(' & ') + ' \\\\\n';
        if (index < dataRows.length - 1) {
          latexTable += '\\midrule\n';
        }
      });
      
      latexTable += '\\bottomrule\n';
      latexTable += '\\end{tabular}\n';
      latexTable += `\\end{${envName}}\n\n`;
    }
    
    return latexTable;
  });
}

/**
 * Genera caption descriptivo para tabla basándose en los encabezados
 */
function generateTableCaption(headers) {
  // Intentar generar caption inteligente basado en headers
  const firstHeader = headers[0].toLowerCase();
  const secondHeader = headers.length > 1 ? headers[1].toLowerCase() : '';
  
  // Detectar tabla de búsqueda por patrón de headers
  if ((firstHeader.includes('base') && firstHeader.includes('datos')) || 
      (firstHeader.includes('database')) ||
      (secondHeader.includes('búsqueda') || secondHeader.includes('search') || secondHeader.includes('cadena'))) {
    return 'Bases de datos académicas y cadenas de búsqueda';
  }
  
  if (firstHeader.includes('id') || firstHeader.includes('estudio')) {
    if (headers.some(h => h.toLowerCase().includes('autor'))) {
      return 'Características generales de los estudios incluidos';
    }
    if (headers.some(h => h.toLowerCase().includes('evidencia'))) {
      return 'Síntesis de evidencia clave y métricas reportadas';
    }
    if (headers.some(h => h.toLowerCase().includes('sesgo') || h.toLowerCase().includes('riesgo'))) {
      return 'Evaluación del riesgo de sesgo y calidad metodológica';
    }
  }
  
  // Fallback genérico
  return 'Resumen de resultados';
}

/**
 * Convierte Markdown a LaTeX
 */
function convertMarkdownToLatex(markdown, format = 'ieee') {
  if (!markdown) return '';

  let latex = markdown;

  // Headers
  latex = latex.replace(/^#### (.*$)/gm, '\\subsubsection{$1}');
  latex = latex.replace(/^### (.*$)/gm, '\\subsection{$1}');
  latex = latex.replace(/^## (.*$)/gm, '\\subsection{$1}');
  latex = latex.replace(/^# (.*$)/gm, '\\section{$1}');

  // Bold y cursiva
  latex = latex.replace(/\*\*\*(.+?)\*\*\*/g, '\\textbf{\\textit{$1}}');
  latex = latex.replace(/\*\*(.+?)\*\*/g, '\\textbf{$1}');
  latex = latex.replace(/\*(.+?)\*/g, '\\textit{$1}');

  // Listas
  latex = latex.replace(/^\s*[-*]\s+(.+)$/gm, '\\item $1');
  latex = latex.replace(/(\n\\item .+?(?=\n[^\n\\]|\n\n|$))/gs, (match) => {
    return '\\begin{itemize}\n' + match + '\n\\end{itemize}\n';
  });

  // Listas numeradas
  latex = latex.replace(/^\s*\d+\.\s+(.+)$/gm, '\\item $1');
  latex = latex.replace(/(\n\\item .+?(?=\n[^\n\\]|\n\n|$))/gs, (match) => {
    if (!match.includes('itemize')) {
      return '\\begin{enumerate}\n' + match + '\n\\end{enumerate}\n';
    }
    return match;
  });

  // Código inline
  latex = latex.replace(/`([^`]+)`/g, '\\texttt{$1}');

  // Bloques de código
  latex = latex.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) => {
    return `\\begin{verbatim}\n${code}\\end{verbatim}`;
  });

  // URLs y enlaces
  latex = latex.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '\\href{$2}{$1}');

  // Tablas markdown a LaTeX profesional
  // IMPORTANTE: Las tablas deben procesarse DESPUÉS de escapar para preservar símbolos LaTeX
  const hasTable = latex.includes('|');
  
  if (hasTable) {
    // Guardar tablas temporalmente con placeholders únicos que no serán escapados
    const tables = [];
    const tableRegex = /((?:^\|.+\|\s*$\n)+)/gm;
    let tableIndex = 0;
    
    latex = latex.replace(tableRegex, (match) => {
      // Usar comando LaTeX como placeholder (no será escapado por escapeLatex)
      const placeholder = `\\TABLEPLACEHOLDER${tableIndex}`;
      tables.push(match);
      tableIndex++;
      return placeholder;
    });
    
    // Escapar caracteres especiales del texto (los placeholders con \ no se escapan)
    latex = escapeLatex(latex);
    
    // Procesar tablas y restaurarlas (sin escapar)
    tables.forEach((table, i) => {
      const processedTable = processMarkdownTables(table, format);
      latex = latex.replace(`\\TABLEPLACEHOLDER${i}`, processedTable);
    });
  } else {
    // No hay tablas, escapar normalmente
    latex = escapeLatex(latex);
  }

  return latex;
}

/**
 * Escapa caracteres especiales de LaTeX en celdas de tabla
 * Versión específica para celdas que siempre escapa (sin checks de comandos LaTeX)
 */
function escapeLatexTableCell(text) {
  if (!text) return '';
  
  const replacements = {
    '&': '\\&',
    '%': '\\%',
    '$': '\\$',
    '#': '\\#',
    '_': '\\_',
    '{': '\\{',
    '}': '\\}',
    '~': '\\textasciitilde{}',
    '^': '\\textasciicircum{}'
  };

  return String(text).replace(/[&%$#_{}~^]/g, char => replacements[char] || char);
}

/**
 * Escapa caracteres especiales de LaTeX
 */
function escapeLatex(text) {
  if (!text) return '';
  
  const replacements = {
    '&': '\\&',
    '%': '\\%',
    '$': '\\$',
    '#': '\\#',
    '_': '\\_',
    '{': '\\{',
    '}': '\\}',
    '~': '\\textasciitilde{}',
    '^': '\\textasciicircum{}'
  };

  // No escapar caracteres dentro de comandos LaTeX
  if (text.includes('\\')) {
    return text;
  }

  return text.replace(/[&%$#_{}~^]/g, char => replacements[char]);
}

/**
 * Genera template específico para Springer
 */
function generateSpringer(articleData) {
  return `\\documentclass[smallextended]{svjour3}
\\usepackage{graphicx}
\\usepackage{hyperref}
\\usepackage{rotating}

\\begin{document}

\\title{${escapeLatex(articleData.title)}}

\\author{${(articleData.authors || []).map(a => a.name).join(' \\and ')}}

\\institute{
${(articleData.authors || []).map(a => 
  `${a.name} \\at ${a.institution || 'Institution'} \\email{${a.email || 'email@'}}`
).join(' \\and ')}
}

\\maketitle

\\begin{abstract}
${escapeLatex(articleData.abstract || '')}
\\keywords{${generateKeywords(articleData.keywords || [])}}
\\end{abstract}

${convertMarkdownToLatex(articleData.introduction || '', 'lncs')}
${convertMarkdownToLatex(articleData.methods || '', 'lncs')}
${convertMarkdownToLatex(articleData.results || '', 'lncs')}
${convertMarkdownToLatex(articleData.discussion || '', 'lncs')}
${convertMarkdownToLatex(articleData.conclusions || '', 'lncs')}

\\begin{thebibliography}{${(articleData.references || []).length}}
${generateBibliography(articleData.references || [])}
\\end{thebibliography}

\\end{document}`;
}

/**
 * Genera template específico para Elsevier
 */
function generateElsevier(articleData) {
  return `\\documentclass[review]{elsarticle}

\\usepackage{lineno}
\\modulolinenumbers[5]

\\journal{Journal Name}

\\begin{document}

\\begin{frontmatter}

\\title{${escapeLatex(articleData.title)}}

${(articleData.authors || []).map(a => 
  `\\author{${escapeLatex(a.name)}}
\\address{${escapeLatex(a.institution || 'Institution')}}
\\ead{${a.email || 'email@address.com'}}`
).join('\n')}

\\begin{abstract}
${escapeLatex(articleData.abstract || '')}
\\end{abstract}

\\begin{keyword}
${generateKeywords(articleData.keywords || [])}
\\end{keyword}

\\end{frontmatter}

\\linenumbers

${convertMarkdownToLatex(articleData.introduction || '', 'elsevier')}
${convertMarkdownToLatex(articleData.methods || '', 'elsevier')}
${convertMarkdownToLatex(articleData.results || '', 'elsevier')}
${convertMarkdownToLatex(articleData.discussion || '', 'elsevier')}
${convertMarkdownToLatex(articleData.conclusions || '', 'elsevier')}

\\section*{References}
\\begin{thebibliography}{${(articleData.references || []).length}}
${generateBibliography(articleData.references || [])}
\\end{thebibliography}

\\end{document}`;
}

/**
 * Genera proyecto multi-archivo para Springer LNCS
 */
function generateSpringerProject(articleData, userProfile = null) {
  const defaultAuthor = userProfile ? {
    name: userProfile.fullName || 'Author Name',
    email: userProfile.email || 'email@espe.edu.ec',
    institution: 'Universidad de las Fuerzas Armadas ESPE',
    department: 'Departamento de Ciencias de la Computación',
    city: 'Sangolquí',
    country: 'Ecuador'
  } : null;

  const authorsList = articleData.authors || (defaultAuthor ? [defaultAuthor] : []);
  const authorNames = authorsList.map(a => escapeLatex(a.name)).join(' \\and ');
  const instituteInfos = authorsList.map(a => 
    `${escapeLatex(a.institution || 'Institution')}, ${escapeLatex(a.city || '')}, ${escapeLatex(a.country || '')}\\\\\\email{${escapeLatex(a.email || 'email@email.com')}}`
  ).join(' \\and\n');

  const mainTex = `\\documentclass[runningheads]{llncs}

\\usepackage[utf8]{inputenc}
\\usepackage{graphicx}
\\usepackage{hyperref}
\\usepackage{rotating}
\\usepackage{booktabs}
\\usepackage{longtable}
\\usepackage{array}

\\begin{document}

\\title{${escapeLatex(articleData.title || 'Systematic Literature Review')}}
\\author{${authorNames}}
\\institute{${instituteInfos}}

\\maketitle

\\input{sections/00_abstract.tex}
\\input{sections/01_introduction.tex}
\\input{sections/02_methodology.tex}
\\input{sections/03_results.tex}
\\input{sections/04_discussion.tex}
\\input{sections/05_conclusions.tex}

\\bibliographystyle{splncs04}
\\bibliography{references}

\\end{document}`;

  const abstractTex = `\\begin{abstract}
${escapeLatex(articleData.abstract || '')}
\\keywords{${generateKeywords(articleData.keywords || [])}}
\\end{abstract}`;

  return {
    'main.tex': mainTex,
    'sections/00_abstract.tex': abstractTex,
    'sections/01_introduction.tex': convertMarkdownToLatex(articleData.introduction || '', 'lncs'),
    'sections/02_methodology.tex': generateMethodsSection(articleData.methods || '', true, 'lncs'),
    'sections/03_results.tex': generateResultsSection(articleData.results || '', 'lncs'),
    'sections/04_discussion.tex': convertMarkdownToLatex(articleData.discussion || '', 'lncs'),
    'sections/05_conclusions.tex': convertMarkdownToLatex(articleData.conclusions || '', 'lncs')
  };
}

module.exports = {
  generate,
  generateSpringerProject,
  generateSpringer,
  generateElsevier,
  convertMarkdownToLatex,
  escapeLatex
};
