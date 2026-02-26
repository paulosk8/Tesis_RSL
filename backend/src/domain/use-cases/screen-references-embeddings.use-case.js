/**
 * Use Case: Cribado de Referencias con Embeddings Semánticos
 * 
 * Utiliza modelos de transformers para generar embeddings y calcular similitud de coseno
 * entre el protocolo PICO y las referencias bibliográficas.
 */
class ScreenReferencesWithEmbeddingsUseCase {
  constructor() {
    this.model = null;
    this.modelName = 'Xenova/all-MiniLM-L6-v2';
    this.pipeline = null;
  }

  /**
   * Inicializa el modelo de embeddings (lazy loading)
   */
  async initializeModel() {
    if (!this.model) {
      console.log(`\n⏳ IMPORTANTE: Cargando modelo de embeddings: ${this.modelName}...`);
      console.log(`   (Esto puede tardar 30-60 segundos la primera vez)`);
      const loadStartTime = Date.now();
      try {
        if (!this.pipeline) {
          const transformers = await import('@xenova/transformers');
          this.pipeline = transformers.pipeline;
        }
        this.model = await this.pipeline('feature-extraction', this.modelName);
        const loadDuration = ((Date.now() - loadStartTime) / 1000).toFixed(1);
        console.log(`✅ Modelo de embeddings cargado correctamente en ${loadDuration}s\n`);
      } catch (error) {
        console.error('❌ Error cargando modelo de embeddings:', error);
        throw new Error(`No se pudo cargar el modelo de embeddings: ${error.message}`);
      }
    }
    return this.model;
  }

  /**
   * Genera el embedding de un texto
   */
  async generateEmbedding(text) {
    const model = await this.initializeModel();
    
    try {
      const output = await model(text, { pooling: 'mean', normalize: true });
      return Array.from(output.data);
    } catch (error) {
      console.error('❌ Error generando embedding:', error);
      throw error;
    }
  }

  /**
   * Calcula la similitud de coseno entre dos vectores
   */
  cosineSimilarity(vecA, vecB) {
    if (!vecA || !vecB || vecA.length !== vecB.length) {
      throw new Error('Los vectores deben tener la misma longitud');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    const similarity = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    return similarity;
  }

  /**
   * Construye el texto del protocolo para generar embedding
   */
  buildCategoryText(protocol) {
    const {
      researchQuestion = '',
      population = '',
      intervention = '',
      comparison = '',
      outcome = '',
      inclusionCriteria = [],
      exclusionCriteria = []
    } = protocol;

    return `
Pregunta de investigación: ${researchQuestion}
Población: ${population}
Intervención: ${intervention}
Comparación: ${comparison}
Resultado: ${outcome}
Criterios de inclusión: ${inclusionCriteria.join('; ')}
Criterios de exclusión: ${exclusionCriteria.join('; ')}
    `.trim();
  }

  /**
   * Construye el texto de la referencia para generar embedding
   */
  buildReferenceText(reference) {
    const {
      title = '',
      abstract = '',
      keywords = []
    } = reference;

    // Convertir keywords a array si es necesario
    let keywordsArray = [];
    if (Array.isArray(keywords)) {
      keywordsArray = keywords;
    } else if (typeof keywords === 'string') {
      keywordsArray = keywords.split(',').map(k => k.trim()).filter(k => k);
    }

    return `
Título: ${title}
Resumen: ${abstract}
Palabras clave: ${keywordsArray.join(', ')}
    `.trim();
  }

  /**
   * Ejecuta el cribado de una referencia individual
   */
  async execute({ reference, protocol, threshold = 0.7 }) {
    try {
      console.log('🔍 Cribando referencia con embeddings:', reference.id);

      // Construir textos
      const categoryText = this.buildCategoryText(protocol);
      const referenceText = this.buildReferenceText(reference);

      // Generar embeddings
      const categoryEmbedding = await this.generateEmbedding(categoryText);
      const referenceEmbedding = await this.generateEmbedding(referenceText);

      // Calcular similitud
      const similarity = this.cosineSimilarity(categoryEmbedding, referenceEmbedding);

      // Determinar recomendación
      const recommendation = similarity >= threshold ? 'include' : 'exclude';
      
      // Calcular confianza normalizada
      const confidence = similarity >= threshold 
        ? (similarity - threshold) / (1 - threshold)
        : (threshold - similarity) / threshold;

      const reasoning = `La similitud semántica entre la referencia y el protocolo es de ${(similarity * 100).toFixed(2)}%. ${
        similarity >= threshold 
          ? `Supera el umbral de ${(threshold * 100).toFixed(0)}%, por lo que se recomienda INCLUIR.`
          : `No alcanza el umbral de ${(threshold * 100).toFixed(0)}%, por lo que se recomienda EXCLUIR.`
      }`;

      return {
        referenceId: reference.id,
        similarity: parseFloat(similarity.toFixed(4)),
        threshold,
        recommendation,
        confidence: parseFloat(confidence.toFixed(3)),
        reasoning,
        model: this.modelName
      };

    } catch (error) {
      console.error('❌ Error en cribado con embeddings:', error);
      throw error;
    }
  }

  /**
   * Ejecuta el cribado en lote de múltiples referencias
   */
  async executeBatch({ references, protocol, threshold = 0.7 }) {
    try {
      console.log(`🔍 Cribando ${references.length} referencias en lote con embeddings...`);
      const startTime = Date.now();

      // Generar embedding del protocolo una sola vez
      console.log(`📝 Generando embedding del protocolo...`);
      const categoryText = this.buildCategoryText(protocol);
      const categoryEmbedding = await this.generateEmbedding(categoryText);
      console.log(`✅ Embedding del protocolo generado (dimensión: ${categoryEmbedding.length})`);

      const results = [];
      let toInclude = 0;
      let toExclude = 0;
      let totalSimilarity = 0;

      // Procesar cada referencia
      console.log(`🔄 Procesando ${references.length} referencias...`);
      for (let i = 0; i < references.length; i++) {
        const reference = references[i];
        try {
          // Log cada 10 referencias para no saturar
          if (i % 10 === 0 || i === references.length - 1) {
            console.log(`   [${i + 1}/${references.length}] Procesando embeddings...`);
          }
          
          const referenceText = this.buildReferenceText(reference);
          const referenceEmbedding = await this.generateEmbedding(referenceText);
          const similarity = this.cosineSimilarity(categoryEmbedding, referenceEmbedding);
          const recommendation = similarity >= threshold ? 'include' : 'exclude';
          const confidence = similarity >= threshold 
            ? (similarity - threshold) / (1 - threshold)
            : (threshold - similarity) / threshold;

          const reasoning = `Similitud: ${(similarity * 100).toFixed(2)}%. ${
            similarity >= threshold ? 'INCLUIR' : 'EXCLUIR'
          } (umbral: ${(threshold * 100).toFixed(0)}%)`;

          results.push({
            success: true,
            referenceId: reference.id,
            similarity: parseFloat(similarity.toFixed(4)),
            threshold,
            recommendation,
            confidence: parseFloat(confidence.toFixed(3)),
            reasoning,
            model: this.modelName
          });

          totalSimilarity += similarity;
          if (recommendation === 'include') toInclude++;
          else toExclude++;

        } catch (error) {
          console.error(`❌ Error procesando referencia ${reference.id}:`, error);
          results.push({
            success: false,
            referenceId: reference.id,
            error: error.message
          });
        }
      }

      const duration = Date.now() - startTime;
      const avgSimilarity = totalSimilarity / references.length;

      console.log(`✅ Cribado completado en ${(duration / 1000).toFixed(2)}s`);
      console.log(`   Incluir: ${toInclude} | Excluir: ${toExclude}`);

      return {
        results,
        summary: {
          total: references.length,
          successful: results.filter(r => r.success).length,
          failed: results.filter(r => !r.success).length,
          toInclude,
          toExclude,
          avgSimilarity: parseFloat(avgSimilarity.toFixed(4)),
          percentageToInclude: ((toInclude / references.length) * 100).toFixed(1),
          durationMs: duration,
          model: this.modelName
        }
      };

    } catch (error) {
      console.error('❌ Error en cribado batch con embeddings:', error);
      throw error;
    }
  }

  /**
   * Genera ranking de referencias por similitud
   */
  async generateRanking({ references, protocol, models = [this.modelName] }) {
    try {
      console.log(`🏆 Generando ranking de ${references.length} referencias...`);

      const categoryText = this.buildCategoryText(protocol);
      const categoryEmbedding = await this.generateEmbedding(categoryText);

      const rankings = [];

      for (const reference of references) {
        const referenceText = this.buildReferenceText(reference);
        const referenceEmbedding = await this.generateEmbedding(referenceText);
        const similarity = this.cosineSimilarity(categoryEmbedding, referenceEmbedding);

        rankings.push({
          referenceId: reference.id,
          referenceTitle: reference.title,
          avgSimilarity: parseFloat(similarity.toFixed(4)),
          rankings: [{
            model: this.modelName,
            similarity: parseFloat(similarity.toFixed(4))
          }]
        });
      }

      // Ordenar por similitud descendente
      rankings.sort((a, b) => b.avgSimilarity - a.avgSimilarity);

      console.log('✅ Ranking generado exitosamente');

      return {
        rankings,
        modelsUsed: [this.modelName]
      };

    } catch (error) {
      console.error('❌ Error generando ranking:', error);
      throw error;
    }
  }

  /**
   * Analiza la distribución de similitudes y recomienda punto de corte
   * Similar al análisis del Colab del docente
   */
  async analyzeDistribution({ references, protocol }) {
    try {
      console.log(`📊 Analizando distribución de similitudes para ${references.length} referencias...`);

      const categoryText = this.buildCategoryText(protocol);
      const categoryEmbedding = await this.generateEmbedding(categoryText);

      const similarities = [];

      for (const reference of references) {
        const referenceText = this.buildReferenceText(reference);
        const referenceEmbedding = await this.generateEmbedding(referenceText);
        const similarity = this.cosineSimilarity(categoryEmbedding, referenceEmbedding);
        
        similarities.push({
          referenceId: reference.id,
          title: reference.title,
          similarity: parseFloat(similarity.toFixed(4))
        });
      }

      // Ordenar por similitud descendente
      similarities.sort((a, b) => b.similarity - a.similarity);

      // Calcular estadísticas
      const scores = similarities.map(s => s.similarity);
      const stats = this.calculateStatistics(scores);

      // Calcular punto de corte recomendado (elbow point)
      const recommendedCutoff = this.findElbowPoint(scores);

      // Calcular cuántos artículos quedarían con diferentes umbrales
      const thresholdAnalysis = this.analyzeThresholds(scores);

      console.log('✅ Análisis de distribución completado');

      return {
        similarities,
        statistics: stats,
        recommendedCutoff,
        thresholdAnalysis,
        totalReferences: references.length
      };

    } catch (error) {
      console.error('❌ Error analizando distribución:', error);
      throw error;
    }
  }

  /**
   * Calcula estadísticas descriptivas de los puntajes
   */
  calculateStatistics(scores) {
    if (scores.length === 0) return null;

    const sorted = [...scores].sort((a, b) => a - b);
    const sum = sorted.reduce((acc, val) => acc + val, 0);
    
    return {
      count: sorted.length,
      min: parseFloat(sorted[0].toFixed(4)),
      max: parseFloat(sorted[sorted.length - 1].toFixed(4)),
      mean: parseFloat((sum / sorted.length).toFixed(4)),
      median: this.calculatePercentile(sorted, 50),
      percentile50: this.calculatePercentile(sorted, 50), // Alias para compatibilidad
      percentile25: this.calculatePercentile(sorted, 25),
      percentile75: this.calculatePercentile(sorted, 75),
      percentile90: this.calculatePercentile(sorted, 90),
      percentile95: this.calculatePercentile(sorted, 95),
      stdDev: this.calculateStdDev(sorted, sum / sorted.length)
    };
  }

  /**
   * Calcula un percentil específico
   */
  calculatePercentile(sortedArray, percentile) {
    const index = (percentile / 100) * (sortedArray.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index % 1;

    if (lower === upper) {
      return parseFloat(sortedArray[lower].toFixed(4));
    }

    return parseFloat(
      (sortedArray[lower] * (1 - weight) + sortedArray[upper] * weight).toFixed(4)
    );
  }

  /**
   * Calcula desviación estándar
   */
  calculateStdDev(values, mean) {
    const squareDiffs = values.map(value => Math.pow(value - mean, 2));
    const avgSquareDiff = squareDiffs.reduce((acc, val) => acc + val, 0) / values.length;
    return parseFloat(Math.sqrt(avgSquareDiff).toFixed(4));
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
   * Analiza cuántos artículos quedarían con diferentes umbrales
   */
  analyzeThresholds(sortedScoresDesc) {
    const thresholds = [0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8];
    
    return thresholds.map(threshold => {
      const included = sortedScoresDesc.filter(s => s >= threshold).length;
      const excluded = sortedScoresDesc.length - included;
      
      return {
        threshold: parseFloat(threshold.toFixed(2)),
        included,
        excluded,
        inclusionRate: parseFloat(((included / sortedScoresDesc.length) * 100).toFixed(1))
      };
    });
  }
}

module.exports = ScreenReferencesWithEmbeddingsUseCase;

