const fs = require('fs');

class GenerateArticleFromTemplateUseCase {
  constructor({ articleVersionRepository, aiService }) {
    this.articleVersionRepository = articleVersionRepository;
    this.aiService = aiService;
  }

  async execute(projectId, templateFile) {
    // 1. Obtener la última versión del artículo
    const latestVersion = await this.articleVersionRepository.findLatestByProject(projectId);
    if (!latestVersion) {
      console.warn(`⚠️ [UseCase] No se encontró versión para el proyecto ${projectId}`);
      throw new Error('No se encontró una versión previa del artículo para reformatear.');
    }
    console.log(`📑 [UseCase] Versión encontrada: ${latestVersion.versionNumber}`);

    // 2. Preparar el contenido del artículo como texto
    let refsContent = latestVersion.referencesSection || '';
    if (Array.isArray(latestVersion.referencesSection)) {
      refsContent = latestVersion.referencesSection.map((r, i) => 
        `[${i+1}] Autor(es): ${r.authors || r.author || 'N/A'}. Título: ${r.title || 'N/A'}. Año: ${r.year || 'N/A'}. Fuente: ${r.journal || r.source || 'N/A'}`
      ).join('\\n');
    } else {
      try {
        const parsed = JSON.parse(latestVersion.referencesSection);
        if (Array.isArray(parsed)) {
          refsContent = parsed.map((r, i) => 
            `[${i+1}] Autor(es): ${r.authors || r.author || 'N/A'}. Título: ${r.title || 'N/A'}. Año: ${r.year || 'N/A'}. Fuente: ${r.journal || r.source || 'N/A'}`
          ).join('\\n');
        }
      } catch (e) {
        // Es texto plano u otro formato, dejar como está
      }
    }

    const articleContent = `
TITULO: ${latestVersion.title || ''}
RESUMEN: ${latestVersion.abstract || ''}
INTRODUCCION: ${latestVersion.introduction || ''}
METODOLOGIA: ${latestVersion.methods || ''}
RESULTADOS: ${latestVersion.results || ''}
DISCUSION: ${latestVersion.discussion || ''}
CONCLUSIONES: ${latestVersion.conclusions || ''}
REFERENCIAS: ${refsContent || ''}
DECLARACIONES: ${latestVersion.declarations || ''}
    `.trim();

    if (!articleContent || articleContent.length < 50) {
      throw new Error('El contenido del artículo es demasiado corto o está vacío para ser procesado.');
    }

    // 3. Preparar el archivo de plantilla para Gemini
    console.log(`📁 [UseCase] Leyendo archivo de plantilla: ${templateFile.path}`);
    const fileData = fs.readFileSync(templateFile.path);
    const mimeType = templateFile.mimetype === 'application/pdf' ? 'application/pdf' : 'text/plain';
    console.log(`📄 [UseCase] MIME Type: ${mimeType}, Size: ${fileData.length} bytes`);
    
    // 4. Prompt especializado
    const systemPrompt = `
Eres un experto en edición científica y tipografía LaTeX. 
Tu tarea es analizar una PLANTILLA (PDF o LaTeX) de una revista científica y RE-ESTRUCTURAR el contenido de un artículo proporcionado siguiendo estrictamente ese formato.

REGLAS CRÍTICAS:
1. Extrae los comandos LaTeX específicos de la plantilla (clase de documento, paquetes, comandos de autor, etc.).
2. Si la plantilla es un PDF, deduce la estructura (ej: dos columnas, tipo de fuente, secciones) y genera el código LaTeX que lo replique.
3. Inserta TODO el contenido del artículo en el lugar correspondiente de la plantilla.
4. Mantén las referencias bibliográficas en el formato que pida la plantilla (BibTeX o \`thebibliography\`).
5. Genera un CÓDIGO LATEX COMPLETO y LISTO PARA COMPILAR.
6. NO incluyas explicaciones fuera del bloque de código. Solo el código LaTeX.
7. OBLIGATORIO: NO DEBES resumir, omitir, ni acortar ninguna sección. El texto generado DEBE contener exactamente el mismo contenido (todas las palabras, oraciones y párrafos) que el artículo original proporcionado.
8. NO uses placeholders como "[Insertar texto aquí...]". Todo el texto del artículo provisto DEBE ser transferido íntegramente a la estructura de la plantilla de destino.
9. TRADUCCIÓN: Si la plantilla o el journal destino está en un idioma distinto al artículo (ej. plantilla en inglés y artículo en español), DEBES TRADUCIR OBLIGATORIAMENTE el Título, Resumen, y TODO el contenido al idioma nativo de la plantilla.
10. TABLAS Y FIGURAS: Convierte las tablas Markdown a código LaTeX (\\begin{table}). Incluye placeholders para figuras estándar mencionadas (ej. \\includegraphics{prisma_diagram} y \\includegraphics{scree_plot}).
11. BIBLIOGRAFÍA: Convierte la sección de Referencias ("REFERENCIAS:") provista en comandos \\bibitem dentro de un entorno thebibliography, o en el formato exacto requerido por la plantilla.
    `;

    const userPromptParts = [
      { text: `Aquí tienes la PLANTILLA a seguir (analízala detalladamente):` },
      { 
        inlineData: {
          data: fileData.toString('base64'),
          mimeType: mimeType
        }
      },
      { text: `Y aquí tienes el CONTENIDO de mi artículo para que lo insertes en ese formato:\n\n${articleContent}` }
    ];

    console.log(`🧠 [UseCase] Enviando plantilla y artículo a Gemini para formateo personalizado...`);
    
    // 5. Llamar a la IA
    const formattedLatex = await this.aiService.generateText(systemPrompt, userPromptParts);

    // Extraer código LaTeX si la IA incluyó backticks
    let finalCode = formattedLatex;
    if (finalCode.includes('```latex')) {
      finalCode = finalCode.split('```latex')[1].split('```')[0].trim();
    } else if (finalCode.includes('```')) {
      finalCode = finalCode.split('```')[1].split('```')[0].trim();
    }

    return {
      success: true,
      latex: finalCode,
      message: 'Artículo formateado según la plantilla de la revista exitosamente.'
    };
  }
}

module.exports = GenerateArticleFromTemplateUseCase;
