const ReferenceRepository = require('../../infrastructure/repositories/reference.repository');
const ScreenReferencesWithAIUseCase = require('./screen-references-with-ai.use-case');
const ScreenReferencesWithEmbeddingsUseCase = require('./screen-references-embeddings.use-case');

/**
 * Use Case: Ejecutar Cribado Completo de Proyecto
 * 
 * Ejecuta el cribado automático de todas las referencias pendientes
 * de un proyecto utilizando IA (LLM o Embeddings).
 */
class RunProjectScreeningUseCase {
  constructor() {
    this.referenceRepository = new ReferenceRepository();
    this.screenAIUseCase = new ScreenReferencesWithAIUseCase();
    this.screenEmbeddingsUseCase = new ScreenReferencesWithEmbeddingsUseCase();
  }

  /**
   * Calcula un percentil de un array ordenado
   */
  calculatePercentile(sortedArray, percentile) {
    if (sortedArray.length === 0) return 0;
    
    // Ajuste: El array entra en orden DESCENDENTE (mayor a menor).
    // Por tanto, el percentil 75 (top 25%) está en el índice 25%.
    // Invertimos el percentil: p75 -> busca en el 25% inicial del array
    const invertedPercentile = 100 - percentile;
    const index = (invertedPercentile / 100) * (sortedArray.length - 1);
    
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index % 1;

    if (lower === upper) {
      return sortedArray[lower];
    }

    // Como está descendente, sortedArray[lower] > sortedArray[upper]
    return sortedArray[lower] * (1 - weight) + sortedArray[upper] * weight;
  }

  /**
   * Encuentra el punto de inflexión (elbow point) en la distribución
   * Usa el método de la segunda derivada
   */
  findElbowPoint(sortedScoresDesc) {
    if (sortedScoresDesc.length < 10) {
      // Para datasets pequeños, usar percentil 75
      const threshold = this.calculatePercentile(sortedScoresDesc, 75);
      const elbowIndex = sortedScoresDesc.findIndex(s => s <= threshold);
      
      return {
        threshold: parseFloat(threshold.toFixed(4)),
        position: elbowIndex,
        percentageOfTotal: parseFloat(((elbowIndex / sortedScoresDesc.length) * 100).toFixed(1)),
        articlesToReview: elbowIndex + 1
      };
    }

    // Calcular la segunda derivada (aceleración de la caída)
    const derivatives = [];
    for (let i = 1; i < sortedScoresDesc.length - 1; i++) {
      const secondDerivative = sortedScoresDesc[i - 1] - 2 * sortedScoresDesc[i] + sortedScoresDesc[i + 1];
      derivatives.push({ index: i, value: secondDerivative });
    }

    // Encontrar el punto con mayor aceleración (mayor segunda derivada)
    derivatives.sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
    const elbowIndex = derivatives[0]?.index || Math.floor(sortedScoresDesc.length * 0.25);

    return {
      threshold: parseFloat(sortedScoresDesc[elbowIndex].toFixed(4)),
      position: elbowIndex,
      percentageOfTotal: parseFloat(((elbowIndex / sortedScoresDesc.length) * 100).toFixed(1)),
      articlesToReview: elbowIndex + 1
    };
  }

  /**
   * Ejecuta cribado con embeddings para todo el proyecto
   */
  async executeEmbeddings({ projectId, protocol, threshold = 0.7 }) {
    try {
      console.log(`🔍 Ejecutando cribado con embeddings para proyecto ${projectId}...`);

      // Obtener referencias pendientes
      const references = await this.referenceRepository.getPendingReferences(projectId);
      
      if (references.length === 0) {
        return {
          success: true,
          message: 'No hay referencias pendientes para cribar',
          summary: {
            total: 0,
            processed: 0,
            included: 0,
            excluded: 0
          }
        };
      }

      console.log(`📚 Encontradas ${references.length} referencias pendientes`);

      // Ejecutar cribado batch con embeddings
      const result = await this.screenEmbeddingsUseCase.executeBatch({
        references,
        protocol,
        threshold
      });

      // Actualizar referencias en la base de datos
      let included = 0;
      let excluded = 0;

      for (const screening of result.results) {
        if (screening.success) {
          await this.referenceRepository.updateScreeningResult({
            referenceId: screening.referenceId,
            aiRecommendation: screening.recommendation,
            aiReasoning: screening.reasoning,
            aiConfidence: screening.confidence,
            similarityScore: screening.similarity,
            screeningStatus: 'pending' // El usuario debe revisar
          });

          if (screening.recommendation === 'include') included++;
          else excluded++;
        }
      }

      console.log(`✅ Cribado completado: ${included} incluir, ${excluded} excluir`);

      return {
        success: true,
        summary: {
          total: references.length,
          processed: result.summary.successful,
          failed: result.summary.failed,
          included,
          excluded,
          avgSimilarity: result.summary.avgSimilarity,
          durationMs: result.summary.durationMs
        }
      };

    } catch (error) {
      console.error('❌ Error ejecutando cribado con embeddings:', error);
      throw error;
    }
  }

  /**
   * Ejecuta cribado HÍBRIDO: Embeddings + ChatGPT para zona gris
   * OPCIÓN 3 RECOMENDADA
   */
  async executeHybrid({ projectId, protocol, embeddingThreshold = 0.15, aiProvider = 'chatgpt', progressCallback = null }) {
    try {
      console.log(`[HYBRID] Ejecutando cribado HÍBRIDO para proyecto ${projectId}...`);
      console.log(`[HYBRID] Fase 1: Embeddings (threshold: ${embeddingThreshold})`);
      console.log(`[HYBRID] Fase 2: ${aiProvider.toUpperCase()} para zona gris`);

      // Helper para emitir eventos de progreso
      const emitProgress = (event) => {
        if (progressCallback) {
          progressCallback(event);
        }
      };

      // Obtener referencias pendientes
      let references = await this.referenceRepository.getPendingReferences(projectId);
      
      // Flag para indicar si es una re-ejecución
      const isRerun = references.length === 0;
      
      // Si no hay referencias pendientes, re-ejecutar sobre TODAS las referencias (sin límite de paginación)
      if (isRerun) {
        console.log(`[HYBRID] No hay referencias pendientes. Obteniendo TODAS las referencias para re-ejecución...`);
        references = await this.referenceRepository.findByProject(projectId);
        console.log(`[HYBRID] Encontradas ${references.length} referencias totales para re-análisis`);
        
        if (references.length === 0) {
          return {
            success: true,
            message: 'No hay referencias en el proyecto',
            summary: {
              total: 0,
              processed: 0,
              included: 0,
              excluded: 0,
              reviewManual: 0
            }
          };
        }
        
        // ⚠️ IMPORTANTE: Al re-ejecutar, LIMPIAR todos los estados previos
        console.log(`[HYBRID] 🧹 LIMPIANDO estados previos de revisión manual...`);
        try {
          // 1. Resetear manual_review_status y manual_review_notes en TODAS las referencias
          const database = require('../../config/database');
          await database.query(`
            UPDATE "references"
            SET manual_review_status = NULL,
                manual_review_notes = NULL
            WHERE project_id = $1
          `, [projectId]);
          console.log(`[HYBRID] ✅ Referencias reseteadas: manual_review_status y manual_review_notes eliminados`);
          
          // 2. Limpiar selectedForFullText y flags de finalización en protocolo
          const ProtocolRepository = require('../../infrastructure/repositories/protocol.repository');
          const protocolRepository = new ProtocolRepository();
          await protocolRepository.update(projectId, {
            selectedForFullText: [],
            manualReviewFinalized: false,
            screeningFinalized: false,
            fase2Unlocked: false // Se desbloqueará al finalizar el cribado
          });
          console.log(`[HYBRID] ✅ Protocolo reseteado: selectedForFullText limpiado, flags de finalización eliminados`);
        } catch (resetError) {
          console.error(`[HYBRID] ⚠️  Error al limpiar estados previos:`, resetError.message);
          // Continuar de todas formas
        }
      } else {
        console.log(`[HYBRID] Encontradas ${references.length} referencias pendientes`);
      }

      const startTime = Date.now();

      // FASE 1: Embeddings para todas las referencias
      console.log('\n[PHASE 1] Análisis con Embeddings...');
      console.log(`[PHASE 1] Procesando ${references.length} referencias en batch...`);
      const embeddingsStartTime = Date.now();
      
      emitProgress({
        type: 'phase',
        phase: 1,
        message: `Fase 1: Calculando similitudes con Embeddings (${references.length} referencias)`,
        progress: 10,
        total: references.length
      });
      
      const embeddingsResult = await this.screenEmbeddingsUseCase.executeBatch({
        references: references,
        protocol,
        threshold: embeddingThreshold
      });
      
      const embeddingsDuration = ((Date.now() - embeddingsStartTime) / 1000).toFixed(1);
      console.log(`[PHASE 1] Completada en ${embeddingsDuration}s`);

      // Calcular umbrales adaptativos basados en distribución
      const similarities = embeddingsResult.results
        .filter(r => r.success)
        .map(r => r.similarity)
        .sort((a, b) => b - a);

      // Calcular percentiles para umbrales adaptativos
      const p75 = this.calculatePercentile(similarities, 75); // Top 25% -> Alta confianza INCLUIR
      const p25 = this.calculatePercentile(similarities, 25); // Bottom 25% -> Alta confianza EXCLUIR
      
      // Ajustar umbrales para que sean más exigentes y dejen menos en la zona gris
      // Cuando hay pocas referencias, la distribución puede ser estrecha
      const mean = similarities.reduce((a, b) => a + b, 0) / similarities.length;
      const stdDev = Math.sqrt(similarities.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b, 0) / similarities.length);
      
      // Basado en z-scores adaptativos, pero manteniendo topes de seguridad sensatos
      const dynamicUpper = mean + (stdDev * 0.5); // +0.5 std dev
      const dynamicLower = mean - (stdDev * 0.5); // -0.5 std dev

      const upperThreshold = Math.max(dynamicUpper, p75); // Priorizar el más exigente (mayor)
      const lowerThreshold = Math.min(dynamicLower, p25); // Priorizar el más selectivo (menor)

      console.log(`[PHASE 1] Umbrales adaptativos calculados:`);
      console.log(`[PHASE 1]   Alta confianza INCLUIR: >= ${(upperThreshold * 100).toFixed(1)}%`);
      console.log(`[PHASE 1]   Alta confianza EXCLUIR: <= ${(lowerThreshold * 100).toFixed(1)}%`);
      console.log(`[PHASE 1]   Zona gris (LLM limit): ${(lowerThreshold * 100).toFixed(1)}% - ${(upperThreshold * 100).toFixed(1)}%`);

      // Clasificar por confianza con umbrales adaptativos
      const highConfidenceInclude = [];
      const highConfidenceExclude = [];
      const greyZone = [];

      for (const screening of embeddingsResult.results) {
        if (!screening.success) continue;

        const ref = references.find(r => r.id === screening.referenceId);
        if (!ref) continue;

        if (screening.similarity >= upperThreshold) {
          highConfidenceInclude.push({ ...screening, reference: ref });
        } else if (screening.similarity <= lowerThreshold) {
          highConfidenceExclude.push({ ...screening, reference: ref });
        } else {
          greyZone.push({ ...screening, reference: ref });
        }
      }

      console.log(`[PHASE 1]   Alta confianza INCLUIR: ${highConfidenceInclude.length}`);
      console.log(`[PHASE 1]   Alta confianza EXCLUIR: ${highConfidenceExclude.length}`);
      console.log(`[PHASE 1]   Zona gris (para ${aiProvider}): ${greyZone.length}`);

      emitProgress({
        type: 'phase',
        phase: 1,
        message: `Fase 1 completada: ${highConfidenceInclude.length} incluidas, ${highConfidenceExclude.length} excluidas, ${greyZone.length} en zona gris`,
        progress: 30,
        stats: {
          highConfidenceInclude: highConfidenceInclude.length,
          highConfidenceExclude: highConfidenceExclude.length,
          greyZone: greyZone.length
        }
      });

      // FASE 2: ChatGPT solo para zona gris
      console.log(`\n[PHASE 2] Análisis con ${aiProvider.toUpperCase()} (zona gris)...`);
      console.log(`[PHASE 2] Iniciando análisis secuencial de ${greyZone.length} referencias...`);
      const llmResults = [];
      const llmStartTime = Date.now();
      
      emitProgress({
        type: 'phase',
        phase: 2,
        message: `Fase 2: Analizando zona gris con ${aiProvider.toUpperCase()} (${greyZone.length} referencias)`,
        progress: 35,
        total: greyZone.length,
        current: 0
      });
      
      for (let i = 0; i < greyZone.length; i++) {
        const item = greyZone[i];
        const refStartTime = Date.now();
        try {
          const title = item.reference.title.substring(0, 60);
          console.log(`[PHASE 2] [${i + 1}/${greyZone.length}] Procesando: ${title}...`);
          
          const llmResult = await this.screenAIUseCase.execute({
            reference: item.reference,
            inclusionCriteria: protocol.inclusionCriteria || [],
            exclusionCriteria: protocol.exclusionCriteria || [],
            researchQuestion: protocol.researchQuestion || '',
            aiProvider
          });

          const refDuration = ((Date.now() - refStartTime) / 1000).toFixed(1);
          console.log(`[PHASE 2] [${i + 1}/${greyZone.length}] Completado en ${refDuration}s - Decisión: ${llmResult.data.decision}`);

          llmResults.push({
            ...item,
            llmDecision: llmResult.data.decision,
            llmConfidence: llmResult.data.confidence,
            llmReasoning: llmResult.data.razonamiento,
            llmCriteriosCumplidos: llmResult.data.criterios_cumplidos,
            llmCriteriosNoCumplidos: llmResult.data.criterios_no_cumplidos
          });

          // Emitir progreso después de cada referencia procesada
          const progressPercent = 35 + Math.floor(((i + 1) / greyZone.length) * 55);
          emitProgress({
            type: 'progress',
            phase: 2,
            message: `Procesando referencia ${i + 1} de ${greyZone.length}`,
            progress: progressPercent,
            total: greyZone.length,
            current: i + 1
          });

        } catch (error) {
          const refDuration = ((Date.now() - refStartTime) / 1000).toFixed(1);
          console.error(`[PHASE 2] [${i + 1}/${greyZone.length}] Error después de ${refDuration}s:`, error.message);
          llmResults.push({
            ...item,
            llmDecision: 'revisar_manual',
            llmReasoning: `Error en análisis LLM: ${error.message}`
          });
        }
      }
      
      const llmDuration = ((Date.now() - llmStartTime) / 1000).toFixed(1);
      console.log(`[PHASE 2] Completada en ${llmDuration}s (${greyZone.length} referencias)`);
      console.log(`[PHASE 2] Promedio: ${(parseFloat(llmDuration) / greyZone.length).toFixed(1)}s por referencia`);

      // FASE 3: Guardar resultados en base de datos
      console.log('\n[PHASE 3] Guardando resultados...');
      
      emitProgress({
        type: 'phase',
        phase: 3,
        message: 'Fase 3: Guardando resultados en la base de datos',
        progress: 90
      });
      
      let totalIncluded = 0;
      let totalExcluded = 0;
      let totalReviewManual = 0;

      // Guardar alta confianza INCLUIR - Auto-aprobadas
      console.log(`[PHASE 3] Guardando ${highConfidenceInclude.length} referencias de alta confianza INCLUIR...`);
      for (const item of highConfidenceInclude) {
        try {
          await this.referenceRepository.updateScreeningResult({
            referenceId: item.referenceId,
            aiRecommendation: 'include',
            aiReasoning: `Embeddings: Alta similitud (${(item.similarity * 100).toFixed(1)}%). ${item.reasoning}`,
            aiConfidence: item.confidence,
            similarityScore: item.similarity,
            screeningStatus: 'included' // Auto-aprobado por alta confianza
          });
          totalIncluded++;
        } catch (error) {
          console.error(`[PHASE 3] Error guardando referencia ${item.referenceId}:`, error.message);
        }
      }
      console.log(`[PHASE 3] Guardadas ${totalIncluded} referencias de alta confianza INCLUIR`);

      // Guardar alta confianza EXCLUIR - Auto-aprobadas
      console.log(`[PHASE 3] Guardando ${highConfidenceExclude.length} referencias de alta confianza EXCLUIR...`);
      for (const item of highConfidenceExclude) {
        try {
          await this.referenceRepository.updateScreeningResult({
            referenceId: item.referenceId,
            aiRecommendation: 'exclude',
            aiReasoning: `Embeddings: Baja similitud (${(item.similarity * 100).toFixed(1)}%). ${item.reasoning}`,
            aiConfidence: item.confidence,
            similarityScore: item.similarity,
            screeningStatus: 'excluded' // Auto-aprobado por alta confianza
          });
          totalExcluded++;
        } catch (error) {
          console.error(`[PHASE 3] Error guardando referencia ${item.referenceId}:`, error.message);
        }
      }
      console.log(`[PHASE 3] Guardadas ${totalExcluded} referencias de alta confianza EXCLUIR`);

      // Guardar resultados de zona gris con LLM - Auto-aprobados
      console.log(`[PHASE 3] Guardando ${llmResults.length} referencias de zona gris con LLM...`);
      for (let i = 0; i < llmResults.length; i++) {
        const item = llmResults[i];
        try {
          let recommendation = 'review';
          let status = 'pending'; // Por defecto pending para revisión manual
          
          if (item.llmDecision === 'incluida') {
            recommendation = 'include';
            status = 'included'; // Auto-aprobar inclusiones de ChatGPT
            totalIncluded++;
          } else if (item.llmDecision === 'excluida') {
            recommendation = 'exclude';
            status = 'excluded'; // Auto-aprobar exclusiones de ChatGPT
            totalExcluded++;
          } else {
            totalReviewManual++;
          }

          const combinedReasoning = `
Embeddings (${(item.similarity * 100).toFixed(1)}%): ${item.reasoning}

${aiProvider.toUpperCase()} (${((item.llmConfidence || 0) * 100).toFixed(0)}% confianza): ${item.llmReasoning || 'Sin análisis'}
${item.llmCriteriosCumplidos ? `\nCumple: ${item.llmCriteriosCumplidos.join(', ')}` : ''}
${item.llmCriteriosNoCumplidos ? `\nNo cumple: ${item.llmCriteriosNoCumplidos.join(', ')}` : ''}
          `.trim();

          await this.referenceRepository.updateScreeningResult({
            referenceId: item.referenceId,
            aiRecommendation: recommendation,
            aiReasoning: combinedReasoning,
            aiConfidence: item.llmConfidence || item.confidence,
            similarityScore: item.similarity,
            screeningStatus: status // Auto-aprobar o dejar pending
          });
          
          if ((i + 1) % 10 === 0 || i === llmResults.length - 1) {
            console.log(`[PHASE 3] Progreso: ${i + 1}/${llmResults.length} referencias guardadas...`);
          }
        } catch (error) {
          console.error(`[PHASE 3] Error guardando referencia ${item.referenceId}:`, error.message);
        }
      }
      console.log(`[PHASE 3] Guardado completado. Total incluidas: ${totalIncluded}, excluidas: ${totalExcluded}, manual: ${totalReviewManual}`);

      const duration = Date.now() - startTime;

      console.log(`\n[HYBRID] CRIBADO HÍBRIDO COMPLETADO en ${(duration / 1000).toFixed(1)}s`);
      console.log(`[HYBRID] Total procesadas: ${references.length}`);
      console.log(`[HYBRID] Recomendadas INCLUIR: ${totalIncluded}`);
      console.log(`[HYBRID] Recomendadas EXCLUIR: ${totalExcluded}`);
      console.log(`[HYBRID] Requieren revisión manual: ${totalReviewManual}`);

      // Calcular estadísticas del análisis Elbow
      console.log('\n[STATS] Calculando estadísticas de distribución...');
      const sortedSimilarities = similarities.sort((a, b) => a - b);
      const sum = sortedSimilarities.reduce((acc, val) => acc + val, 0);
      
      const statistics = {
        min: Number.parseFloat(sortedSimilarities[0].toFixed(4)),
        max: Number.parseFloat(sortedSimilarities[sortedSimilarities.length - 1].toFixed(4)),
        mean: Number.parseFloat((sum / sortedSimilarities.length).toFixed(4)),
        median: this.calculatePercentile(sortedSimilarities, 50),
        percentile25: this.calculatePercentile(sortedSimilarities, 25),
        percentile50: this.calculatePercentile(sortedSimilarities, 50),
        percentile75: this.calculatePercentile(sortedSimilarities, 75),
        percentile90: this.calculatePercentile(sortedSimilarities, 90),
        percentile95: this.calculatePercentile(sortedSimilarities, 95)
      };

      // Calcular punto de inflexión (Elbow Point)
      const sortedDescending = [...sortedSimilarities].sort((a, b) => b - a);
      const elbowPoint = this.findElbowPoint(sortedDescending);
      
      const recommendedCutoff = {
        threshold: Number.parseFloat(elbowPoint.threshold.toFixed(4)),
        articlesToReview: elbowPoint.articlesToReview,
        percentageOfTotal: elbowPoint.percentageOfTotal.toFixed(1)
      };

      console.log(`[STATS] Estadísticas calculadas:`, {
        min: `${(statistics.min * 100).toFixed(2)}%`,
        max: `${(statistics.max * 100).toFixed(2)}%`,
        mean: `${(statistics.mean * 100).toFixed(2)}%`,
        elbowThreshold: `${(recommendedCutoff.threshold * 100).toFixed(2)}%`
      });

      // FASE 4: Guardar resultados en el protocolo y desbloquear fase 2 (PRISMA)
      console.log('\n[PHASE 4] Guardando resultados en protocolo y desbloqueando Fase 2...');
      const screeningResults = {
        success: true,
        method: 'hybrid',
        summary: {
          total: references.length,
          processed: references.length,
          included: totalIncluded,
          excluded: totalExcluded,
          reviewManual: totalReviewManual,
          durationMs: duration,
          phase1: {
            method: 'embeddings',
            highConfidenceInclude: highConfidenceInclude.length,
            highConfidenceExclude: highConfidenceExclude.length,
            greyZone: greyZone.length,
            avgSimilarity: embeddingsResult.summary.avgSimilarity,
            thresholds: {
              upper: upperThreshold,
              lower: lowerThreshold
            }
          },
          phase2: {
            method: aiProvider,
            analyzed: greyZone.length,
            included: llmResults.filter(r => r.llmDecision === 'incluida').length,
            excluded: llmResults.filter(r => r.llmDecision === 'excluida').length,
            manual: llmResults.filter(r => r.llmDecision === 'revisar_manual').length
          }
        },
        statistics,
        recommendedCutoff,
        thresholds: {
          embeddings: embeddingThreshold,
          upperAdaptive: upperThreshold,
          lowerAdaptive: lowerThreshold
        },
        cutoffMethod: 'adaptive-percentile',
        timestamp: new Date().toISOString()
      };

      try {
        const ProtocolRepository = require('../../infrastructure/repositories/protocol.repository');
        const protocolRepository = new ProtocolRepository();
        
        console.log(`[PHASE 4] Guardando en protocolo del proyecto ${projectId}...`);
        console.log(`[PHASE 4] Datos a guardar:`, {
          screeningResults: screeningResults.summary,
          fase2Unlocked: true
        });
        
        await protocolRepository.update(projectId, {
          screeningResults: screeningResults,  // Ya está en formato objeto, el repository lo convierte a JSON
          fase2Unlocked: true  // Desbloquear PRISMA
        });
        
        console.log('[PHASE 4] ✅ Resultados guardados en protocolo y Fase 2 desbloqueada');
      } catch (protocolError) {
        console.error('[PHASE 4] ⚠️  Error guardando en protocolo:', protocolError.message);
        console.error('[PHASE 4] Stack:', protocolError.stack);
        console.error('[PHASE 4] Referencias ya fueron actualizadas, pero el protocolo no se actualizó');
      }

      return screeningResults;

    } catch (error) {
      console.error('[HYBRID] Error ejecutando cribado híbrido:', error);
      throw error;
    }
  }

  /**
   * Ejecuta cribado con LLM para todo el proyecto
   */
  async executeLLM({ projectId, protocol, model = 'gemini-2.0-flash-exp' }) {
    try {
      console.log(`🔍 Ejecutando cribado con LLM para proyecto ${projectId}...`);

      // Obtener referencias pendientes
      const references = await this.referenceRepository.getPendingReferences(projectId);
      
      if (references.length === 0) {
        return {
          success: true,
          message: 'No hay referencias pendientes para cribar',
          summary: {
            total: 0,
            processed: 0,
            included: 0,
            excluded: 0
          }
        };
      }

      console.log(`📚 Encontradas ${references.length} referencias pendientes`);

      // Procesar referencias una por una con LLM
      let included = 0;
      let excluded = 0;
      let processed = 0;
      const errors = [];

      for (const reference of references) {
        try {
          const result = await this.screenAIUseCase.execute({
            reference,
            protocol,
            model
          });

          await this.referenceRepository.updateScreeningResult({
            referenceId: reference.id,
            aiRecommendation: result.recommendation,
            aiReasoning: result.reasoning,
            aiConfidence: result.confidence,
            screeningStatus: 'pending'
          });

          if (result.recommendation === 'include') included++;
          else excluded++;
          processed++;

          console.log(`✓ ${processed}/${references.length}: ${reference.title.substring(0, 50)}...`);

        } catch (error) {
          console.error(`❌ Error procesando referencia ${reference.id}:`, error);
          errors.push({ referenceId: reference.id, error: error.message });
        }
      }

      console.log(`✅ Cribado completado: ${included} incluir, ${excluded} excluir`);

      return {
        success: true,
        summary: {
          total: references.length,
          processed,
          failed: errors.length,
          included,
          excluded
        },
        errors: errors.length > 0 ? errors : undefined
      };

    } catch (error) {
      console.error('❌ Error ejecutando cribado con LLM:', error);
      throw error;
    }
  }
}

module.exports = RunProjectScreeningUseCase;

