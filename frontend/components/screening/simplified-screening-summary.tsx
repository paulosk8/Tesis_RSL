"use client"

import { useState, useMemo, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
    ArrowRight,
    Info,
    CheckCircle,
    XCircle,
    Upload,
    FileText
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { ApiClient } from "@/lib/api-client"
import { cn } from "@/lib/utils"

interface SimplifiedScreeningSummaryProps {
    projectId: string
    result: {
        summary: {
            total: number
            included: number
            excluded: number
            reviewManual: number
            phase1: {
                highConfidenceInclude: number
                highConfidenceExclude: number
                greyZone: number
            }
            phase2: {
                analyzed: number
            }
        }
        classifiedReferences?: {
            highConfidenceInclude: any[]
            highConfidenceExclude: any[]
            complementaryRelevant: any[]
            complementaryNotRelevant: any[]
        }
        statistics?: {
            min: number
            max: number
            mean: number
            median?: number
            percentile25?: number
            percentile50: number
            percentile75: number
            percentile90: number
            percentile95: number
        }
        recommendedCutoff?: {
            threshold: number
            articlesToReview: number
            percentageOfTotal: number
        }
    }
    onProceedToManualReview: (selectedIds: string[]) => void
    onReferenceStatusChange?: (referenceId: string, status: 'included' | 'excluded' | 'pending', exclusionReason?: string) => void
    isLocked?: boolean
}

export function SimplifiedScreeningSummary({ projectId, result, onProceedToManualReview, onReferenceStatusChange, isLocked = false }: Readonly<SimplifiedScreeningSummaryProps>) {
    const { toast } = useToast()
    const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null)
    const [selectedFile, setSelectedFile] = useState<File | null>(null)
    const [isSavingPaste, setIsSavingPaste] = useState(false)
    const [decision, setDecision] = useState<'include' | 'exclude' | null>(null)
    const [exclusionReason, setExclusionReason] = useState('')
    // Mapa local para rastrear decisiones de revisión (inmediato + persistido desde backend)
    const [reviewedArticles, setReviewedArticles] = useState<Map<string, 'included' | 'excluded'>>(new Map())

    const { summary, classifiedReferences, statistics, recommendedCutoff } = result

    // Inicializar el mapa de revisados desde manualReviewStatus (NO desde status, que es de la IA)
    useEffect(() => {
        const initialMap = new Map<string, 'included' | 'excluded'>()
        const allRefs = [
            ...(classifiedReferences?.highConfidenceInclude || []),
            ...(classifiedReferences?.complementaryRelevant || []),
            ...(classifiedReferences?.highConfidenceExclude || []),
            ...(classifiedReferences?.complementaryNotRelevant || [])
        ]
        allRefs.forEach((ref: any) => {
            // Solo usar manualReviewStatus (indica que el usuario revisó manualmente)
            if (ref.manualReviewStatus === 'included' || ref.manualReviewStatus === 'excluded') {
                initialMap.set(ref.id, ref.manualReviewStatus)
            }
        })
        if (initialMap.size > 0) {
            setReviewedArticles(prev => {
                const merged = new Map(prev)
                initialMap.forEach((val, key) => {
                    if (!merged.has(key)) merged.set(key, val)
                })
                return merged
            })
        }
    }, [classifiedReferences])

    // Helper para obtener el estado de revisión de un artículo
    const getReviewStatus = (refId: string): 'included' | 'excluded' | 'pending' => {
        return reviewedArticles.get(refId) || 'pending'
    }

    // Calcular artículos disponibles para selección
    const allRelevantArticles = [
        ...(classifiedReferences?.highConfidenceInclude || []),
        ...(classifiedReferences?.complementaryRelevant || [])
    ]

    // Ordenar por score descendente
    const sortedArticles = [...allRelevantArticles].sort((a, b) => {
        const scoreA = a.screeningScore || 0
        const scoreB = b.screeningScore || 0
        return scoreB - scoreA
    })

    // Calcular punto de codo (elbow) si no viene del backend - optimizado con useMemo
    const elbowIndex = useMemo(() => {
        if (recommendedCutoff?.articlesToReview) {
            return recommendedCutoff.articlesToReview
        }

        if (sortedArticles.length < 10) return Math.ceil(sortedArticles.length * 0.25)

        const derivatives: number[] = []
        for (let i = 1; i < sortedArticles.length - 1; i++) {
            const prevScore = sortedArticles[i - 1].screeningScore || 0
            const currScore = sortedArticles[i].screeningScore || 0
            const nextScore = sortedArticles[i + 1].screeningScore || 0
            const d2 = prevScore - 2 * currScore + nextScore
            derivatives.push(Math.abs(d2))
        }

        const maxDerivativeIndex = derivatives.indexOf(Math.max(...derivatives)) + 1
        const top10Index = Math.ceil(sortedArticles.length * 0.1)
        const top50Index = Math.ceil(sortedArticles.length * 0.5)

        if (maxDerivativeIndex < top10Index) return Math.ceil(sortedArticles.length * 0.25)
        if (maxDerivativeIndex > top50Index) return Math.ceil(sortedArticles.length * 0.25)

        return maxDerivativeIndex
    }, [sortedArticles, recommendedCutoff])

    // Usar el Top recomendado por el sistema (punto de codo)
    const recommendedCount = elbowIndex
    const recommendedArticles = sortedArticles.slice(0, Math.min(recommendedCount, sortedArticles.length))

    // Obtener artículos seleccionados (todos los recomendados)
    const getSelectedArticles = () => {
        return recommendedArticles.map(art => art.id)
    }

    const handleProceed = () => {
        const selectedIds = getSelectedArticles()

        // Validar que todos los artículos recomendados tengan una decisión manual
        const pendingArticles = recommendedArticles.filter(art =>
            !reviewedArticles.has(art.id)
        )

        if (pendingArticles.length > 0) {
            toast({
                title: "⚠️ Revisión incompleta",
                description: `Debes revisar los ${pendingArticles.length} artículo(s) pendiente(s) antes de continuar. Cada artículo debe ser marcado como Incluido o Excluido.`,
                variant: "destructive",
                duration: 6000
            })
            return
        }

        onProceedToManualReview(selectedIds)
    }

    const handleSavePastedResults = async (finalDecision: 'include' | 'exclude') => {
        if (!selectedArticleId) return
        if (finalDecision === 'exclude' && !exclusionReason.trim()) {
            toast({
                title: "Razón de exclusión requerida",
                description: "Debes especificar por qué excluyes este artículo",
                variant: "destructive"
            })
            return
        }

        setIsSavingPaste(true)
        try {
            const apiClient = new ApiClient()

            // Subir archivo PDF
            if (selectedFile) {
                toast({
                    title: finalDecision === 'include' ? "Incluyendo artículo..." : "Excluyendo artículo...",
                    description: `Subiendo archivo PDF (${(selectedFile.size / 1024).toFixed(1)} KB)`
                })
                await apiClient.uploadPdf(selectedArticleId, selectedFile)
            }

            // Enviar decisión al backend usando endpoint existente
            const mappedStatus = finalDecision === 'include' ? 'included' : 'excluded'
            const response = await apiClient.request(`/api/references/${selectedArticleId}/screening`, {
                method: "PUT",
                body: JSON.stringify({
                    status: mappedStatus,
                    manualReviewStatus: mappedStatus,
                    exclusionReason: finalDecision === 'exclude' ? exclusionReason : undefined
                })
            })

            // Actualizar mapa local de revisados inmediatamente
            const newStatus = finalDecision === 'include' ? 'included' as const : 'excluded' as const
            setReviewedArticles(prev => {
                const updated = new Map(prev)
                updated.set(selectedArticleId, newStatus)
                return updated
            })

            // Notificar cambio de estado al componente padre
            if (onReferenceStatusChange) {
                onReferenceStatusChange(
                    selectedArticleId,
                    newStatus,
                    finalDecision === 'exclude' ? exclusionReason : undefined
                )
            }

            toast({
                title: finalDecision === 'include' ? " Artículo incluido" : " Artículo excluido",
                description: finalDecision === 'include'
                    ? "El artículo ha sido incluido para el análisis final - Se reflejará en el diagrama PRISMA"
                    : "El artículo ha sido excluido de la revisión - Se reflejará en el diagrama PRISMA"
            })

            setSelectedFile(null)
            setDecision(null)
            setExclusionReason('')
        } catch (error: any) {
            toast({
                title: "Error al guardar",
                description: error.message || "No se pudieron guardar los resultados",
                variant: "destructive"
            })
        } finally {
            setIsSavingPaste(false)
        }
    }

    // Obtener el artículo seleccionado
    const selectedArticle = selectedArticleId
        ? [...recommendedArticles].find((r: any) => r.id === selectedArticleId)
        : null

    return (
        <div className="space-y-4">
            {/* Resumen en Texto Simple */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Resumen del Screening Automático</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Estadísticas Principales */}
                    {statistics && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Info className="h-5 w-5 text-primary" />
                                    Distribución de Puntajes de Prioridad
                                </CardTitle>
                                <CardDescription>
                                    Análisis estadístico de {summary.total} referencias ordenadas por similitud con el protocolo
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div className="p-3 border border-green-300 dark:border-green-700 rounded-lg">
                                        <p className="text-xs text-green-700 dark:text-green-400 font-semibold mb-1">Puntaje Máximo</p>
                                        <p className="text-2xl font-bold text-foreground">{(statistics.max * 100).toFixed(1)}%</p>
                                    </div>
                                    <div className="p-3 border border-blue-300 dark:border-blue-700 rounded-lg">
                                        <p className="text-xs text-blue-700 dark:text-blue-400 font-semibold mb-1">Top 10% (Percentil 90)</p>
                                        <p className="text-2xl font-bold text-foreground">{(statistics.percentile90 * 100).toFixed(1)}%</p>
                                    </div>
                                    <div className="p-3 border border-purple-300 dark:border-purple-700 rounded-lg">
                                        <p className="text-xs text-purple-700 dark:text-purple-400 font-semibold mb-1">Top 25% (Percentil 75)</p>
                                        <p className="text-2xl font-bold text-foreground">{(statistics.percentile75 * 100).toFixed(1)}%</p>
                                    </div>
                                    <div className="p-3 border border-orange-300 dark:border-orange-700 rounded-lg">
                                        <p className="text-xs text-orange-700 dark:text-orange-400 font-semibold mb-1">Mediana (Percentil 50)</p>
                                        <p className="text-2xl font-bold text-foreground">{(statistics.percentile50 * 100).toFixed(1)}%</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Gráfico de Punto de Inflexión (Codo) */}
                    {statistics && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Gráfico de Punto de Inflexión ("Codo")</CardTitle>
                                <CardDescription>
                                    Distribución visual de puntajes ordenados de mayor a menor
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="relative h-64 bg-muted/30 rounded-lg p-4 overflow-hidden">
                                    {/* Eje Y (Puntajes) */}
                                    <div className="absolute left-0 top-0 bottom-0 w-12 flex flex-col justify-between text-xs text-muted-foreground pl-2 z-10">
                                        <span>{(statistics.max * 100).toFixed(0)}%</span>
                                        <span>{(statistics.mean * 100).toFixed(0)}%</span>
                                        <span>{(statistics.min * 100).toFixed(0)}%</span>
                                    </div>

                                    {/* Área del gráfico */}
                                    <div className="ml-12 mr-1 h-full relative overflow-hidden">
                                        {/* Líneas de percentiles */}
                                        <div
                                            className="absolute left-0 right-0 border-t-2 border-dashed border-red-400 dark:border-red-600"
                                            style={{ top: `${(1 - statistics.percentile90 / statistics.max) * 100}%` }}
                                        >
                                            <span className="absolute -top-3 right-0 text-[10px] text-red-600 dark:text-red-400 bg-background/80 px-1 rounded whitespace-nowrap">
                                                Top 10%: {(statistics.percentile90 * 100).toFixed(1)}%
                                            </span>
                                        </div>
                                        <div
                                            className="absolute left-0 right-0 border-t-2 border-dashed border-green-400 dark:border-green-600"
                                            style={{ top: `${(1 - statistics.percentile75 / statistics.max) * 100}%` }}
                                        >
                                            <span className="absolute -top-3 right-0 text-[10px] text-green-600 dark:text-green-400 bg-background/80 px-1 rounded whitespace-nowrap">
                                                Top 25%: {(statistics.percentile75 * 100).toFixed(1)}%
                                            </span>
                                        </div>
                                        <div
                                            className="absolute left-0 right-0 border-t-2 border-dashed border-orange-400 dark:border-orange-600"
                                            style={{ top: `${(1 - statistics.percentile50 / statistics.max) * 100}%` }}
                                        >
                                            <span className="absolute -top-3 right-0 text-[10px] text-orange-600 dark:text-orange-400 bg-background/80 px-1 rounded whitespace-nowrap">
                                                Mediana: {(statistics.percentile50 * 100).toFixed(1)}%
                                            </span>
                                        </div>

                                        {/* Línea vertical del codo */}
                                        <div
                                            className="absolute top-0 bottom-0 border-l-2 border-dashed border-purple-600 dark:border-purple-400"
                                            style={{ left: `${Math.min((elbowIndex / sortedArticles.length) * 100, 95)}%` }}
                                        >
                                            <span className="absolute bottom-2 -left-8 text-xs text-purple-600 dark:text-purple-400 bg-background/80 px-1 font-semibold whitespace-nowrap">
                                                Codo ↓
                                            </span>
                                        </div>

                                        {/* Curva simulada (usando degradado) */}
                                        <div
                                            className="absolute inset-0 bg-gradient-to-br from-blue-500 via-blue-400 to-blue-100 dark:from-blue-700 dark:via-blue-600 dark:to-blue-900 opacity-30 rounded"
                                            style={{
                                                clipPath: 'polygon(0 0, 100% 0, 100% 100%, 0 90%)'
                                            }}
                                        />

                                        {/* Puntos de datos - TODOS los artículos */}
                                        {sortedArticles.map((ref, idx) => {
                                            const total = Math.max(sortedArticles.length - 1, 1)
                                            return (
                                                <div
                                                    key={ref.id}
                                                    className="absolute w-2 h-2 bg-blue-600 dark:bg-blue-400 rounded-full -translate-x-1 -translate-y-1"
                                                    style={{
                                                        left: `${(idx / total) * 100}%`,
                                                        top: `${(1 - (ref.screeningScore || 0) / statistics.max) * 100}%`
                                                    }}
                                                    title={`${ref.title.substring(0, 50)}... - ${((ref.screeningScore || 0) * 100).toFixed(1)}%`}
                                                />
                                            )
                                        })}
                                    </div>

                                    {/* Eje X (Número de artículo) */}
                                    <div className="absolute bottom-0 left-12 right-0 h-8 flex justify-between items-end text-xs text-muted-foreground px-1">
                                        <span>1</span>
                                        <span>{Math.floor(sortedArticles.length / 2)}</span>
                                        <span>{sortedArticles.length}</span>
                                    </div>
                                </div>

                                <p className="text-xs text-muted-foreground mt-4">
                                    <strong>Interpretación:</strong> La línea azul muestra la distribución de puntajes.
                                    El "codo" (línea púrpura vertical) marca el punto de inflexión donde la relevancia cae bruscamente.
                                </p>
                            </CardContent>
                        </Card>
                    )}
                </CardContent>
            </Card>

            {/* Diseño estilo Rayyan: Lista + Panel de Detalles */}
            <Card className="overflow-hidden">
                <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">Artículos Recomendados para Revisión Manual</CardTitle>
                        <Badge className="bg-purple-600">
                            RECOMENDADO POR IA
                        </Badge>
                    </div>
                    {isLocked && (
                        <Alert className="border-blue-400 bg-blue-50 dark:!bg-blue-950/60 dark:border-blue-700 mt-3">
                            <CheckCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                            <AlertDescription className="text-sm text-blue-800 dark:text-blue-200">
                                La revisión manual ha sido completada. Los artículos y sus decisiones están bloqueados.
                            </AlertDescription>
                        </Alert>
                    )}
                    {!isLocked && (
                        <Alert className="mt-3">
                            <Info className="h-4 w-4" />
                            <AlertDescription className="text-sm">
                                El sistema ha identificado automáticamente los <strong>{recommendedArticles.length} artículos más relevantes</strong> según el análisis del punto de inflexión (codo).
                                Haz clic en un artículo para revisarlo.
                            </AlertDescription>
                        </Alert>
                    )}
                </CardHeader>

                <CardContent className="p-0">
                    {/* Progreso de revisión */}
                    {(() => {
                        const reviewed = recommendedArticles.filter((r: any) => getReviewStatus(r.id) !== 'pending').length
                        const includedCount = recommendedArticles.filter((r: any) => getReviewStatus(r.id) === 'included').length
                        const excludedCount = recommendedArticles.filter((r: any) => getReviewStatus(r.id) === 'excluded').length
                        const total = recommendedArticles.length
                        const pct = total > 0 ? Math.round((reviewed / total) * 100) : 0
                        return (
                            <div className="px-6 pb-3 space-y-2">
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-muted-foreground">Progreso de revisión:</span>
                                    <span className="font-medium">
                                        {reviewed}/{total} revisados ({pct}%)
                                        {includedCount > 0 && <span className="text-green-600 dark:text-green-400 ml-2">{includedCount} incluidos</span>}
                                        {excludedCount > 0 && <span className="text-red-600 dark:text-red-400 ml-2">{excludedCount} excluidos</span>}
                                    </span>
                                </div>
                                <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                                    <div className="h-full flex">
                                        <div className="bg-green-500 transition-all" style={{ width: `${total > 0 ? (includedCount / total) * 100 : 0}%` }} />
                                        <div className="bg-red-500 transition-all" style={{ width: `${total > 0 ? (excludedCount / total) * 100 : 0}%` }} />
                                    </div>
                                </div>
                            </div>
                        )
                    })()}

                    {/* Layout de dos columnas estilo Rayyan */}
                    <div className="flex border-t">
                        {/* COLUMNA IZQUIERDA: Lista de artículos (35%) */}
                        <div className="w-[35%] border-r overflow-y-auto" style={{ height: '600px' }}>
                            <div className="divide-y">
                                {recommendedArticles.map((ref: any, idx) => {
                                    const reviewStatus = getReviewStatus(ref.id)
                                    const isIncluded = reviewStatus === 'included'
                                    const isExcluded = reviewStatus === 'excluded'
                                    const isReviewed = isIncluded || isExcluded
                                    const isSelected = selectedArticleId === ref.id

                                    return (
                                        <button
                                            key={ref.id}
                                            type="button"
                                            onClick={() => setSelectedArticleId(ref.id)}
                                            className={cn(
                                                "w-full p-4 cursor-pointer transition-all hover:bg-muted/50 border-l-4 text-left",
                                                isSelected && "bg-muted/80",
                                                isIncluded && "border-l-green-500 bg-green-50/30 dark:bg-green-950/20",
                                                isExcluded && "border-l-red-500 bg-red-50/30 dark:bg-red-950/20",
                                                !isReviewed && "border-l-blue-400"
                                            )}
                                        >
                                            <div className="flex items-start gap-3">
                                                {/* Indicador visual */}
                                                <div className={cn(
                                                    "rounded-full w-7 h-7 flex items-center justify-center font-bold text-xs flex-shrink-0",
                                                    isIncluded && "bg-green-600 text-white",
                                                    isExcluded && "bg-red-600 text-white",
                                                    !isReviewed && "bg-blue-400 text-white"
                                                )}>
                                                    {isIncluded && <CheckCircle className="h-4 w-4" />}
                                                    {isExcluded && <XCircle className="h-4 w-4" />}
                                                    {!isReviewed && (idx + 1)}
                                                </div>

                                                <div className="flex-1 min-w-0">
                                                    <h3 className={cn(
                                                        "font-semibold text-sm mb-1 line-clamp-2",
                                                        isExcluded && "line-through opacity-60"
                                                    )}>
                                                        {ref.title}
                                                    </h3>

                                                    <div className="text-xs text-muted-foreground mb-1">
                                                        {ref.authors?.[0] || 'Sin autor'} {ref.authors && ref.authors.length > 1 ? 'et al.' : ''}
                                                        {ref.year && ` • ${ref.year}`}
                                                    </div>

                                                    <div className="flex items-center gap-2 mt-2">
                                                        {ref.screeningScore && (
                                                            <Badge variant="outline" className="text-xs h-5">
                                                                {(ref.screeningScore * 100).toFixed(0)}%
                                                            </Badge>
                                                        )}
                                                        {isIncluded && (
                                                            <Badge className="bg-green-600 text-xs h-5">
                                                                Incluido
                                                            </Badge>
                                                        )}
                                                        {isExcluded && (
                                                            <Badge className="bg-red-600 text-xs h-5">
                                                                Excluido
                                                            </Badge>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </button>
                                    )
                                })}
                            </div>
                        </div>

                        {/* COLUMNA DERECHA: Panel de detalles (65%) */}
                        <div className="w-[65%] overflow-y-auto bg-muted/10" style={{ height: '600px' }}>
                            {selectedArticle ? (
                                <div className="p-6 space-y-6">
                                    {/* Encabezado del artículo */}
                                    <div>
                                        <h2 className="text-xl font-bold mb-3">{selectedArticle.title}</h2>
                                        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                                            <span className="font-medium">
                                                {selectedArticle.authors?.[0] || 'Sin autor'}
                                                {selectedArticle.authors && selectedArticle.authors.length > 1 ? ' et al.' : ''}
                                            </span>
                                            {selectedArticle.year && <span>• {selectedArticle.year}</span>}
                                            {selectedArticle.journal && <span>• {selectedArticle.journal}</span>}
                                        </div>
                                        {selectedArticle.screeningScore && (
                                            <div className="mt-3">
                                                <Badge variant="outline" className="text-sm">
                                                    Similitud con protocolo: {(selectedArticle.screeningScore * 100).toFixed(1)}%
                                                </Badge>
                                            </div>
                                        )}
                                    </div>

                                    {/* Resumen */}
                                    {selectedArticle.abstract && (
                                        <div>
                                            <h3 className="font-semibold mb-2">Resumen</h3>
                                            <p className="text-sm text-muted-foreground leading-relaxed">
                                                {selectedArticle.abstract}
                                            </p>
                                        </div>
                                    )}

                                    {/* Análisis de IA */}
                                    {selectedArticle.screeningReasoning && (
                                        <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                                            <div className="flex items-start gap-2 mb-2">
                                                <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                                                <h3 className="font-semibold text-blue-900 dark:text-blue-100">Análisis de IA</h3>
                                            </div>
                                            <p className="text-sm text-blue-800 dark:text-blue-200 leading-relaxed">
                                                {selectedArticle.screeningReasoning}
                                            </p>
                                        </div>
                                    )}

                                    {/* Decisión de revisión */}
                                    {!isLocked && (
                                        <div className="space-y-4">
                                            <h3 className="font-semibold">Decisión de Revisión</h3>

                                            {/* Sección de carga de PDF (compacta) */}
                                            <div className="flex items-center gap-3 p-3 border rounded-lg bg-muted/30">
                                                <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium">Cargar Texto Completo (PDF)</p>
                                                    {selectedFile && (
                                                        <p className="text-xs text-muted-foreground truncate">
                                                            {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                                                        </p>
                                                    )}
                                                </div>
                                                <input
                                                    type="file"
                                                    accept=".pdf"
                                                    onChange={(e) => {
                                                        const file = e.target.files?.[0]
                                                        if (file) {
                                                            if (file.type !== 'application/pdf') {
                                                                toast({
                                                                    title: "Tipo de archivo no válido",
                                                                    description: "Solo se permiten archivos PDF",
                                                                    variant: "destructive"
                                                                })
                                                                return
                                                            }
                                                            setSelectedFile(file)
                                                        }
                                                    }}
                                                    className="hidden"
                                                    id="pdf-upload"
                                                />
                                                <label htmlFor="pdf-upload">
                                                    <Button type="button" variant="outline" size="sm" className="cursor-pointer" asChild>
                                                        <span>
                                                            <Upload className="h-4 w-4 mr-2" />
                                                            {selectedFile ? 'Cambiar' : 'Seleccionar'}
                                                        </span>
                                                    </Button>
                                                </label>
                                            </div>

                                            {/* Botones de decisión (siempre visibles) */}
                                            {!decision && (
                                                <div className="flex gap-3">
                                                    <Button
                                                        onClick={() => setDecision('include')}
                                                        className="flex-1 bg-green-600 hover:bg-green-700"
                                                        size="lg"
                                                    >
                                                        <CheckCircle className="mr-2 h-5 w-5" />
                                                        Incluir
                                                    </Button>
                                                    <Button
                                                        onClick={() => setDecision('exclude')}
                                                        className="flex-1 bg-red-600 hover:bg-red-700"
                                                        size="lg"
                                                    >
                                                        <XCircle className="mr-2 h-5 w-5" />
                                                        Excluir
                                                    </Button>
                                                </div>
                                            )}

                                            {/* Confirmación después de decidir */}
                                            {decision && (
                                                <div className="space-y-3">
                                                    <Alert className={decision === 'include' ? 'border-green-500' : 'border-red-500'}>
                                                        <AlertDescription>
                                                            Has seleccionado: <strong>{decision === 'include' ? 'Incluir' : 'Excluir'}</strong> este artículo
                                                        </AlertDescription>
                                                    </Alert>

                                                    {decision === 'exclude' && (
                                                        <div>
                                                            <label htmlFor="exclusion-reason" className="text-sm font-medium mb-2 block">
                                                                Razón de exclusión (requerido)
                                                            </label>
                                                            <textarea
                                                                id="exclusion-reason"
                                                                value={exclusionReason}
                                                                onChange={(e) => setExclusionReason(e.target.value)}
                                                                placeholder="Especifica por qué este artículo debe ser excluido..."
                                                                className="w-full min-h-[100px] p-3 border rounded-lg resize-none"
                                                            />
                                                        </div>
                                                    )}

                                                    <div className="flex gap-2">
                                                        <Button
                                                            onClick={() => {
                                                                setDecision(null)
                                                                setExclusionReason('')
                                                                setSelectedFile(null)
                                                            }}
                                                            variant="outline"
                                                            disabled={isSavingPaste}
                                                        >
                                                            Cancelar
                                                        </Button>
                                                        <Button
                                                            onClick={() => handleSavePastedResults(decision)}
                                                            disabled={isSavingPaste || (decision === 'exclude' && !exclusionReason.trim())}
                                                            className="flex-1"
                                                        >
                                                            {isSavingPaste ? (
                                                                <>Guardando...</>
                                                            ) : (
                                                                <>Confirmar {decision === 'include' ? 'Inclusión' : 'Exclusión'}</>
                                                            )}
                                                        </Button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Mostrar estado si ya fue revisado */}
                                    {getReviewStatus(selectedArticle.id) !== 'pending' && (
                                        <Alert className={getReviewStatus(selectedArticle.id) === 'included' ? 'border-green-500 bg-green-50 dark:bg-green-950/30' : 'border-red-500 bg-red-50 dark:bg-red-950/30'}>
                                            <CheckCircle className="h-4 w-4" />
                                            <AlertDescription>
                                                Este artículo ya fue revisado: <strong>{getReviewStatus(selectedArticle.id) === 'included' ? 'Incluido' : 'Excluido'}</strong>
                                                {selectedArticle.exclusionReason && (
                                                    <span className="block mt-1 text-sm">Razón: {selectedArticle.exclusionReason}</span>
                                                )}
                                            </AlertDescription>
                                        </Alert>
                                    )}
                                </div>
                            ) : (
                                <div className="h-full flex items-center justify-center text-center p-6">
                                    <div>
                                        <FileText className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                                        <h3 className="text-lg font-semibold mb-2">Selecciona un artículo</h3>
                                        <p className="text-sm text-muted-foreground">
                                            Haz clic en un artículo de la lista para ver sus detalles y tomar una decisión
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Botón para proceder */}
                    <div className="p-6 border-t space-y-3">
                        {/* Contador de progreso */}
                        {!isLocked && (() => {
                            const totalArticles = getSelectedArticles().length
                            const reviewedCount = recommendedArticles.filter(art => reviewedArticles.has(art.id)).length
                            const pendingCount = totalArticles - reviewedCount

                            return (
                                <div className={cn(
                                    "text-sm flex items-center justify-between p-3 rounded-lg border",
                                    pendingCount > 0
                                        ? "bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/30 dark:border-amber-700 dark:text-amber-200"
                                        : "bg-green-50 border-green-200 text-green-800 dark:bg-green-950/30 dark:border-green-700 dark:text-green-200"
                                )}>
                                    <span className="font-medium">
                                        Progreso de revisión: {reviewedCount} de {totalArticles} artículos
                                    </span>
                                    {pendingCount > 0 && (
                                        <Badge variant="outline" className="bg-white dark:bg-slate-800">
                                            {pendingCount} pendientes
                                        </Badge>
                                    )}
                                </div>
                            )
                        })()}

                        {isLocked ? (
                            <div className="w-full text-center py-3 px-4 rounded-lg bg-green-50 border border-green-300 dark:!bg-green-950/60 dark:border-green-700">
                                <p className="text-sm font-medium text-green-700 dark:text-green-300 flex items-center justify-center gap-2">
                                    <CheckCircle className="h-4 w-4" />
                                    Revisión completada — {getSelectedArticles().length} artículos procesados
                                </p>
                            </div>
                        ) : (
                            <Button
                                onClick={handleProceed}
                                className="w-full"
                                size="lg"
                            >
                                Completar revisión y ver diagrama PRISMA ({getSelectedArticles().length} artículos)
                                <ArrowRight className="ml-2 h-4 w-4" />
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
