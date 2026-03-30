const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

class ValidateLatexUseCase {
  /**
   * Ejecuta la validación de un proyecto LaTeX compilándolo y parseando el log
   * @param {Object} latexFiles - Diccionario de archivos (ej: {'main.tex': content, ...})
   * @param {String} mainFileName - Archivo principal a compilar
   * @returns {Promise<Object>} Resultado de validación { status, issues, logContent }
   */
  async execute(latexFiles, mainFileName = 'main.tex') {
    let tmpDir = null;
    try {
      // 1. Crear directorio temporal
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'latex-val-'));

      // 2. Escribir archivos al directorio temporal
      for (const [filepath, content] of Object.entries(latexFiles)) {
        const fullPath = path.join(tmpDir, filepath);
        // Crear directorios intermedios si existen
        const dirName = path.dirname(fullPath);
        if (!fs.existsSync(dirName)) {
          fs.mkdirSync(dirName, { recursive: true });
        }
        // Solo escribir texto (en este caso latex/md)
        if (typeof content === 'string') {
          fs.writeFileSync(fullPath, content, 'utf8');
        }
      }

      // Si no hay archivo principal, nada que hacer
      if (!latexFiles[mainFileName]) {
        return { status: 'error', issues: [{ type: 'Error', message: 'Main file not found' }] };
      }

      // 3. Ejecutar pdflatex
      // interaction=nonstopmode forzará que no se detenga pidiendo input
      try {
        await execPromise(`pdflatex -interaction=nonstopmode ${mainFileName}`, {
          cwd: tmpDir,
          timeout: 60000 // 60s timeout
        });
      } catch (compileError) {
        // En pdflatex es normal que tire un exit code 1 si hay errores, igual generará main.log
      }

      // 4. Leer main.log
      const logFile = mainFileName.replace('.tex', '.log');
      const logPath = path.join(tmpDir, logFile);
      
      if (!fs.existsSync(logPath)) {
        return { 
          status: 'error', 
          issues: [{ type: 'System Error', message: 'Log file not generated, compilation failed completely' }] 
        };
      }

      const logContent = fs.readFileSync(logPath, 'utf8');
      
      // 5. Parsear log para encontrar warnings/errores específicos de LNCS
      const issues = this.parseLog(logContent);
      
      // 6. Determinar status
      let status = 'success';
      if (issues.some(i => i.type.includes('Error'))) {
        status = 'error';
      } else if (issues.length > 0) {
        status = 'warning';
      }

      return {
        status,
        issues,
        reportText: this.formatReport(issues)
      };

    } catch (error) {
      console.error('Error en ValidateLatexUseCase:', error);
      return { 
        status: 'error', 
        issues: [{ type: 'System Error', message: error.message }] 
      };
    } finally {
      // Limpiar directorio temporal
      if (tmpDir && fs.existsSync(tmpDir)) {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    }
  }

  parseLog(logContent) {
    const issues = [];
    const lines = logContent.split('\n');
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];

      // Detectar Overfull \hbox
      if (line.includes('Overfull \\hbox')) {
        let message = line.trim();
        // A veces el archivo/linea viene después o en la misma linea
        let fileLine = '';
        if (line.includes('lines ')) {
          fileLine = line.match(/lines (\d+--\d+)/)?.[0] || '';
        }
        issues.push({
          type: 'Overfull \\hbox',
          message: `${message}`,
          severity: 'warning'
        });
      }
      
      // Detectar Float too large for page
      else if (line.includes('Float too large for page')) {
        issues.push({
          type: 'Float too large',
          message: line.trim(),
          severity: 'error'
        });
      }
      
      // Errores severos (\Error)
      else if (line.startsWith('! ')) {
        issues.push({
          type: 'LaTeX Error',
          message: line.substring(2).trim(),
          severity: 'error'
        });
      }

      i++;
    }

    return issues;
  }

  formatReport(issues) {
    if (issues.length === 0) {
      return 'No compilation issues detected. Layout is fully compliant.';
    }
    
    let report = '--- LaTeX Validation Report ---\n\n';
    
    const errors = issues.filter(i => i.severity === 'error');
    const warnings = issues.filter(i => i.severity === 'warning');

    if (errors.length > 0) {
      report += `*** ERRORS (${errors.length}) ***\n`;
      errors.forEach(e => report += `- [${e.type}] ${e.message}\n`);
      report += '\n';
    }

    if (warnings.length > 0) {
      report += `*** WARNINGS (${warnings.length}) ***\n`;
      warnings.forEach(w => report += `- [${w.type}] ${w.message}\n`);
    }

    return report;
  }
}

module.exports = ValidateLatexUseCase;
