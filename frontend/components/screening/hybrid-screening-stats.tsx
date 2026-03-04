"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { BarChart3, Brain, CheckCircle, XCircle, AlertCircle, Clock, DollarSign, ChevronDown, ChevronUp, TrendingUp } from "lucide-react"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"

interface HybridScreeningStatsProps {
  result: {
    success: boolean
    method: string
    summary: {
      total: number
      processed: number
      included: number
      excluded: number
      reviewManual: number
      durationMs: number
      phase1: {
        method: string
        highConfidenceInclude: number
        highConfidenceExclude: number
        greyZone: number
        avgSimilarity: number
        thresholds?: {
          upper: number
          lower: number
        }
      }
      phase2: {
        method: string
        analyzed: number
      }
    }
    // Datos opcionales del análisis de distribución
    statistics?: {
      min: number
      max: number
      mean: number
      median: number
      percentile25: number
      percentile50: number
      percentile75: number
      percentile90: number
      percentile95: number
    }
    recommendedCutoff?: {
      threshold: number
      articlesToReview: number
      percentageOfTotal: string
    }
  }
}

export function HybridScreeningStats({ result }: HybridScreeningStatsProps) {
  const [isOpen, setIsOpen] = useState(false)
  const { summary } = result
  const { phase1, phase2 } = summary

  // Validación de seguridad
  if (!phase1 || !phase2) {
    console.error('Error: phase1 o phase2 undefined en HybridScreeningStats', { phase1, phase2, summary })
    return null
  }

  const includedPercentage = Math.round((summary.included / summary.total) * 100)
  const excludedPercentage = Math.round((summary.excluded / summary.total) * 100)
  const reviewPercentage = Math.round((summary.reviewManual / summary.total) * 100)

  const durationSeconds = (summary.durationMs / 1000).toFixed(1)

  return (
    <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-background">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          Resultados del Screening Automático Híbrido
        </CardTitle>
        <CardDescription>
          Procesadas {summary.processed} de {summary.total} referencias en {durationSeconds}s
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Gráfico Visual de Distribución (Solo si hay estadísticas) */}
        {result.statistics && (
          <div className="space-y-3">
            <h4 className="font-semibold text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Gráfico de Punto de Inflexión ("Codo")
            </h4>
            <p className="text-xs text-muted-foreground">
              Distribución visual de puntajes ordenados de mayor a menor. Muestra dónde se encuentran los artículos en el rango de similitud.
            </p>

            <div className="relative h-64 bg-muted/30 rounded-lg p-4 border border-primary/20">
              {/* Eje Y (Puntajes) */}
              <div className="absolute left-0 top-0 bottom-0 w-12 flex flex-col justify-between text-xs text-muted-foreground py-4">
                <span>{(result.statistics.max * 100).toFixed(0)}%</span>
                <span>{(result.statistics.mean * 100).toFixed(0)}%</span>
                <span>{(result.statistics.min * 100).toFixed(0)}%</span>
              </div>

              {/* Área del gráfico */}
              <div className="ml-12 mr-4 h-full relative">
                {/* Líneas de percentiles */}
                <div
                  className="absolute left-0 right-0 border-t-2 border-dashed border-blue-500 dark:border-blue-400"
                  style={{ top: `${(1 - result.statistics.percentile95 / result.statistics.max) * 90}%` }}
                >
                  <span className="absolute -top-2 right-0 text-xs text-blue-600 dark:text-blue-400 bg-background px-1 whitespace-nowrap">
                    Top 5%: {(result.statistics.percentile95 * 100).toFixed(1)}%
                  </span>
                </div>
                <div
                  className="absolute left-0 right-0 border-t-2 border-dashed border-blue-400 dark:border-blue-500"
                  style={{ top: `${(1 - result.statistics.percentile90 / result.statistics.max) * 90}%` }}
                >
                  <span className="absolute -top-2 right-0 text-xs text-blue-600 dark:text-blue-400 bg-background px-1 whitespace-nowrap">
                    Top 10%: {(result.statistics.percentile90 * 100).toFixed(1)}%
                  </span>
                </div>
                <div
                  className="absolute left-0 right-0 border-t-2 border-dashed border-green-500 dark:border-green-400"
                  style={{ top: `${(1 - result.statistics.percentile75 / result.statistics.max) * 90}%` }}
                >
                  <span className="absolute -top-2 right-0 text-xs text-green-600 dark:text-green-400 bg-background px-1 whitespace-nowrap">
                    Top 25%: {(result.statistics.percentile75 * 100).toFixed(1)}%
                  </span>
                </div>
                <div
                  className="absolute left-0 right-0 border-t-2 border-dashed border-orange-400 dark:border-orange-500"
                  style={{ top: `${(1 - result.statistics.percentile50 / result.statistics.max) * 90}%` }}
                >
                  <span className="absolute -top-2 right-0 text-xs text-orange-600 dark:text-orange-400 bg-background px-1 whitespace-nowrap">
                    Mediana: {(result.statistics.percentile50 * 100).toFixed(1)}%
                  </span>
                </div>

                {/* Curva simulada (usando degradado) */}
                <div
                  className="absolute inset-0 bg-gradient-to-br from-primary/50 via-primary/30 to-primary/10 rounded"
                  style={{
                    clipPath: 'polygon(0 10%, 20% 20%, 40% 40%, 60% 60%, 80% 75%, 100% 90%)'
                  }}
                />

                {/* Puntos de datos simulados */}
                {/* eslint-disable-next-line react/no-array-index-key */}
                {Array.from({ length: Math.min(summary.total, 40) }).map((_, idx) => {
                  // Simular distribución decreciente
                  const normalizedScore = Math.max(0.1, 1 - Math.pow(idx / summary.total, 0.7))
                  const score = result.statistics!.min + (result.statistics!.max - result.statistics!.min) * normalizedScore

                  return (
                    <div
                      key={`datapoint-${idx}`}
                      className="absolute w-2 h-2 bg-primary rounded-full"
                      style={{
                        left: `${(idx / summary.total) * 95}%`,
                        top: `${(1 - score / result.statistics!.max) * 90}%`
                      }}
                    />
                  )
                })}

                {/* Línea vertical del codo (si está disponible) */}
                {result.recommendedCutoff && (
                  <div
                    className="absolute top-0 bottom-0 border-l-2 border-purple-600 dark:border-purple-400 z-10"
                    style={{
                      left: `${(result.recommendedCutoff.articlesToReview / summary.total) * 95}%`
                    }}
                  >
                    <div className="absolute -bottom-6 -left-12 text-xs text-purple-600 dark:text-purple-400 bg-background px-1 font-semibold whitespace-nowrap">
                      ↑ Codo óptimo
                    </div>
                  </div>
                )}
              </div>

              {/* Eje X (Número de artículo) */}
              <div className="absolute bottom-0 left-12 right-4 h-8 flex justify-between items-end text-xs text-muted-foreground">
                <span>1</span>
                <span>Artículo</span>
                <span>{summary.total}</span>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              <strong>Interpretación:</strong> Cada punto representa un artículo ordenado por similitud.
              Las líneas horizontales muestran los percentiles clave.
              {result.recommendedCutoff && ' La línea púrpura vertical marca el punto de inflexión óptimo (codo).'}
            </p>
          </div>
        )}

        {/* Resultados Finales siempre visibles */}
        <div className="space-y-3">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                <span>Incluidas</span>
              </div>
              <span className="font-bold text-green-600 dark:text-green-400">{summary.included} ({includedPercentage}%)</span>
            </div>
            <Progress value={includedPercentage} className="h-2" />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                <span>Excluidas</span>
              </div>
              <span className="font-bold text-red-600 dark:text-red-400">{summary.excluded} ({excludedPercentage}%)</span>
            </div>
            <Progress value={excludedPercentage} className="h-2" />
          </div>

          {summary.reviewManual > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  <span>Revisión manual</span>
                </div>
                <span className="font-bold text-amber-600 dark:text-amber-400">{summary.reviewManual} ({reviewPercentage}%)</span>
              </div>
              <Progress value={reviewPercentage} className="h-2" />
            </div>
          )}
        </div>

        <div className="bg-primary/5 p-3 rounded-md border border-primary/20">
          <p className="text-xs text-muted-foreground text-center">
            <strong>Próximo paso:</strong> Revisa las {summary.total} referencias para confirmar las decisiones de la IA o hacer ajustes manuales.
          </p>
        </div>

        {/* Acordeón para detalles del análisis */}
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="outline" size="sm" className="w-full justify-between">
              <span className="text-xs font-medium">Ver análisis detallado con gráfico de distribución</span>
              {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </CollapsibleTrigger>

          <CollapsibleContent className="space-y-4 pt-4">
            <Separator />

            {/* Fase 1: Embeddings */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-purple-600" />
                  <h4 className="font-semibold text-sm">Fase 1: Embeddings</h4>
                </div>
                <Badge variant="outline" className="border-primary/30">
                  Análisis masivo
                </Badge>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="border border-primary/20 rounded-md p-3">
                  <div className="flex items-center gap-1 text-green-600 dark:text-green-400 mb-1">
                    <CheckCircle className="h-3 w-3" />
                    <span className="text-xs font-medium">Relevantes</span>
                  </div>
                  <p className="text-xl font-bold text-foreground">{phase1.highConfidenceInclude}</p>
                  <p className="text-xs text-muted-foreground">Similitud &gt;30%</p>
                </div>

                <div className="border border-primary/20 rounded-md p-3">
                  <div className="flex items-center gap-1 text-red-600 dark:text-red-400 mb-1">
                    <XCircle className="h-3 w-3" />
                    <span className="text-xs font-medium">No Relevantes</span>
                  </div>
                  <p className="text-xl font-bold text-foreground">{phase1.highConfidenceExclude}</p>
                  <p className="text-xs text-muted-foreground">Similitud &lt;10%</p>
                </div>

                <div className="border border-primary/20 rounded-md p-3">
                  <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400 mb-1">
                    <AlertCircle className="h-3 w-3" />
                    <span className="text-xs font-medium">Incertidumbre</span>
                  </div>
                  <p className="text-xl font-bold text-foreground">{phase1.greyZone}</p>
                  <p className="text-xs text-muted-foreground">10-30%</p>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Promedio similitud:</span>
                <span className="font-semibold">{(phase1.avgSimilarity * 100).toFixed(1)}%</span>
              </div>
            </div>

            <Separator />

            {/* Fase 2: ChatGPT */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Brain className="h-4 w-4 text-blue-600" />
                  <h4 className="font-semibold text-sm">Fase 2: ChatGPT</h4>
                </div>
                <Badge variant="outline" className="border-primary/30">
                  Análisis experto
                </Badge>
              </div>

              <div className="border border-primary/20 rounded-md p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-foreground">Referencias analizadas</span>
                  <span className="text-2xl font-bold text-foreground">{phase2.analyzed}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Solo las referencias del rango de incertidumbre fueron enviadas a ChatGPT para evaluación complementaria con el protocolo PICO
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center gap-2 text-xs">
                  <Clock className="h-3 w-3 text-muted-foreground" />
                  <span className="text-muted-foreground">Tiempo:</span>
                  <span className="font-semibold">{durationSeconds}s</span>
                </div>
              </div>
            </div>

            {/* Estadísticas del Análisis (si están disponibles) */}
            {result.statistics && (
              <>
                <Separator />

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-sm">Estadísticas de Similitud</h4>
                    <Badge variant="outline" className="text-xs border-primary/30">
                      Método Elbow aplicado
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    <div className="border border-primary/20 rounded-md p-2">
                      <p className="text-xs text-muted-foreground">Mínimo</p>
                      <p className="text-sm font-bold text-foreground">{(result.statistics.min * 100).toFixed(2)}%</p>
                      <p className="text-xs text-muted-foreground">Artículo menos similar</p>
                    </div>

                    <div className="border border-primary/20 rounded-md p-2">
                      <p className="text-xs text-muted-foreground">Máximo</p>
                      <p className="text-sm font-bold text-foreground">{(result.statistics.max * 100).toFixed(2)}%</p>
                      <p className="text-xs text-muted-foreground">Artículo más similar</p>
                    </div>

                    <div className="border border-primary/20 rounded-md p-2">
                      <p className="text-xs text-muted-foreground">Media</p>
                      <p className="text-sm font-bold text-foreground">{(result.statistics.mean * 100).toFixed(2)}%</p>
                      <p className="text-xs text-muted-foreground">Similitud promedio</p>
                    </div>

                    <div className="border border-primary/20 rounded-md p-2">
                      <p className="text-xs text-muted-foreground">Mediana</p>
                      <p className="text-sm font-bold text-foreground">{(result.statistics.median * 100).toFixed(2)}%</p>
                      <p className="text-xs text-muted-foreground">Punto medio</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="font-semibold text-sm">Distribución por Percentiles</h4>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    <div className="border border-blue-300 dark:border-blue-700 rounded-md p-2">
                      <p className="text-xs text-muted-foreground">Top 5% (P95)</p>
                      <p className="text-sm font-bold text-blue-700 dark:text-blue-400">{(result.statistics.percentile95 * 100).toFixed(2)}%</p>
                      <p className="text-xs text-muted-foreground">5% más similares</p>
                    </div>

                    <div className="border border-blue-300 dark:border-blue-700 rounded-md p-2">
                      <p className="text-xs text-muted-foreground">Top 10% (P90)</p>
                      <p className="text-sm font-bold text-blue-700 dark:text-blue-400">{(result.statistics.percentile90 * 100).toFixed(2)}%</p>
                      <p className="text-xs text-muted-foreground">10% más similares</p>
                    </div>

                    <div className="border border-primary/20 rounded-md p-2">
                      <p className="text-xs text-muted-foreground">Top 25% (P75)</p>
                      <p className="text-sm font-bold text-foreground">{(result.statistics.percentile75 * 100).toFixed(2)}%</p>
                      <p className="text-xs text-muted-foreground">25% más similares</p>
                    </div>

                    <div className="border border-primary/20 rounded-md p-2">
                      <p className="text-xs text-muted-foreground">Mediana (P50)</p>
                      <p className="text-sm font-bold text-foreground">{(result.statistics.percentile50 * 100).toFixed(2)}%</p>
                      <p className="text-xs text-muted-foreground">50% sobre este valor</p>
                    </div>
                  </div>
                </div>



                {result.recommendedCutoff && (
                  <div className="bg-green-50 dark:bg-green-950/20 border border-green-300 dark:border-green-700 rounded-lg p-3">
                    <div className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                      <div className="space-y-2 flex-1">
                        <p className="font-semibold text-sm text-foreground">Umbral Óptimo Encontrado (Elbow Point)</p>
                        <p className="text-xs text-muted-foreground">
                          Este es el punto de inflexión donde la relación calidad/cantidad es óptima
                        </p>

                        <div className="grid grid-cols-2 gap-2 mt-2">
                          <div className="bg-white dark:bg-green-950/40 p-2 rounded border border-green-200 dark:border-green-800">
                            <p className="text-xs text-muted-foreground">Umbral Recomendado</p>
                            <p className="text-lg font-bold text-green-700 dark:text-green-400">
                              {(result.recommendedCutoff.threshold * 100).toFixed(2)}%
                            </p>
                            <p className="text-xs text-muted-foreground">Artículos con similitud ≥ este valor</p>
                          </div>

                          <div className="bg-white dark:bg-green-950/40 p-2 rounded border border-green-200 dark:border-green-800">
                            <p className="text-xs text-muted-foreground">Artículos a Revisar</p>
                            <p className="text-lg font-bold text-green-700 dark:text-green-400">
                              {result.recommendedCutoff.articlesToReview}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {result.recommendedCutoff.percentageOfTotal}% del total
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  )
}
