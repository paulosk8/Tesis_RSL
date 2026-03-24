"use client"

import { useState, useEffect } from "react"
import React from "react"
import { useRouter } from "next/navigation"
import { DashboardNav } from "@/components/dashboard/dashboard-nav"
import { ProjectBreadcrumb } from "@/components/project-breadcrumb"
import { ProjectHeader } from "@/components/project-header"
import { ReferenceTable } from "@/components/screening/reference-table"
import { AIScreeningPanel } from "@/components/screening/ai-screening-panel"
import { ScreeningFilters } from "@/components/screening/screening-filters"
import { DuplicateDetectionDialog } from "@/components/screening/duplicate-detection-dialog"
import { HybridScreeningStats } from "@/components/screening/hybrid-screening-stats"
import { SimplifiedScreeningSummary } from "@/components/screening/simplified-screening-summary"
import { PrismaFlowDiagram } from "@/components/screening/prisma-flow-diagram"
import { apiClient } from "@/lib/api-client"
import type { Reference } from "@/lib/types"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Loader2, AlertCircle, Database, Copy, CheckCircle2, Brain, Download, ArrowRight } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

export default function ScreeningPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const { toast } = useToast()
  const [project, setProject] = useState<any>(null)
  const [references, setReferences] = useState<Reference[]>([])
  const [statusFilter, setStatusFilter] = useState("all")
  const [methodFilter, setMethodFilter] = useState("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isExporting, setIsExporting] = useState(false)
  const [activeTab, setActiveTab] = useState<"fase1" | "priorizacion" | "revision" | "resultados" | "prisma">("fase1")
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    included: 0,
    excluded: 0
  })
  const [keyTerms, setKeyTerms] = useState<any>(null)
  const [duplicatesStats, setDuplicatesStats] = useState<any>(null)
  const [isDetectingDuplicates, setIsDetectingDuplicates] = useState(false)
  const [duplicateGroups, setDuplicateGroups] = useState<any[]>([])
  const [showDuplicatesDialog, setShowDuplicatesDialog] = useState(false)
  const [lastScreeningResult, setLastScreeningResult] = useState<any>(null)
  const [fase2Unlocked, setFase2Unlocked] = useState(false)
  const [selectedForFullText, setSelectedForFullText] = useState<Set<string>>(new Set())
  const [screeningFinalized, setScreeningFinalized] = useState(false)
  const [manualReviewCompleted, setManualReviewCompleted] = useState(false)
  const [isFinalizingScreening, setIsFinalizingScreening] = useState(false)

  // Helper: Verificar si TODOS los artículos seleccionados han sido revisados manualmente
  const areAllArticlesReviewed = (): boolean => {
    if (selectedForFullText.size === 0) return false

    const selectedIds = Array.from(selectedForFullText)
    const selectedRefs = references.filter(r => selectedIds.includes(r.id))

    // Todos deben tener manualReviewStatus = 'included' o 'excluded' (NO 'pending' ni null)
    const allReviewed = selectedRefs.every(ref =>
      ref.manualReviewStatus === 'included' || ref.manualReviewStatus === 'excluded'
    )

    return allReviewed
  }

  // Cargar referencias del proyecto y protocolo - EN PARALELO
  useEffect(() => {
    async function loadData() {
      setIsLoading(true)
      setError(null)
      try {
        const [projectData, refData, protocol] = await Promise.all([
          apiClient.getProject(params.id),
          apiClient.getAllReferences(params.id),
          apiClient.getProtocol(params.id).catch(err => null)
        ])

        setProject(projectData)
        setReferences(refData.references || [])
        setStats(refData.stats || { total: 0, pending: 0, included: 0, excluded: 0 })

        if (protocol) {
          if (protocol?.keyTerms) {
            setKeyTerms(protocol.keyTerms)
          }
          if (protocol?.screeningResults) {
            if (protocol.screeningResults.summary?.phase1 && protocol.screeningResults.summary?.phase2) {
              setLastScreeningResult(protocol.screeningResults)
            } else {
              setLastScreeningResult(null)
            }
          }
          if (protocol?.fase2Unlocked) {
            setFase2Unlocked(protocol.fase2Unlocked)
          }
          if (protocol?.selectedForFullText && Array.isArray(protocol.selectedForFullText) && protocol.selectedForFullText.length > 0) {
            setSelectedForFullText(new Set(protocol.selectedForFullText))
          } else if (refData?.references) {
            const reviewedIds = (refData.references as any[]).filter(
              (r: any) => r.manualReviewStatus === 'included' || r.manualReviewStatus === 'excluded'
            ).map((r: any) => r.id)
            if (reviewedIds.length > 0) {
              setSelectedForFullText(new Set(reviewedIds))
            }
          }
          if (protocol?.screeningFinalized) {
            setScreeningFinalized(protocol.screeningFinalized)
          }
          if (protocol?.manualReviewFinalized) {
            setManualReviewCompleted(protocol.manualReviewFinalized)
          }
        }
      } catch (err: any) {
        console.error("Error cargando datos:", err)
        setError(err.message || "No se pudieron cargar los datos")
      } finally {
        setIsLoading(false)
      }
    }
    loadData()
  }, [params.id])

  useEffect(() => {
    if (screeningFinalized && activeTab === 'priorizacion') {
      setActiveTab('revision')
    }
  }, [screeningFinalized, activeTab])

  const reloadReferences = async () => {
    try {
      const refData = await apiClient.getAllReferences(params.id)
      setReferences(refData.references || [])
      setStats(refData.stats || { total: 0, pending: 0, included: 0, excluded: 0 })
    } catch (err) {
      console.error('Error recargando referencias:', err)
    }
  }

  const handleStatusChange = async (id: string, status: Reference["status"], exclusionReason?: string) => {
    try {
      await apiClient.updateReferenceStatus(id, { status, exclusionReason })
      setReferences((prev) => prev.map((ref) => (ref.id === id ? { ...ref, status, exclusionReason } : ref)))

      setStats(prev => {
        const newStats = { ...prev }
        const ref = references.find(r => r.id === id)
        if (ref && ref.status !== status) {
          if (ref.status === 'pending') newStats.pending--
          else if (ref.status === 'included') newStats.included--
          else if (ref.status === 'excluded') newStats.excluded--

          if (status === 'pending') newStats.pending++
          else if (status === 'included') newStats.included++
          else if (status === 'excluded') newStats.excluded++
        }
        return newStats
      })

      toast({ title: "Estado actualizado", description: `Referencia marcada como ${status}` })
    } catch (error) {
      toast({ title: "Error", description: "No se pudo actualizar el estado", variant: "destructive" })
      throw error
    }
  }

  const handleSelectForFullText = async (referenceIds: string[], count: number, phase: string) => {
    try {
      const classifiedRefs = references.filter(r =>
        r.aiClassification || (r as any).similarity_score !== undefined || (r as any).screeningScore !== undefined
      )

      const selectedIds = new Set(referenceIds)
      const notSelectedRefs = classifiedRefs.filter(r => !selectedIds.has(r.id))

      const previouslySelected = Array.from(selectedForFullText)
      if (previouslySelected.length > 0) {
        await Promise.all(
          previouslySelected.map(id => apiClient.updateReferenceStatus(id, { status: 'pending' }))
        )
      }

      await Promise.all(
        referenceIds.map(id => apiClient.updateReferenceStatus(id, { status: 'pending' }))
      )

      if (notSelectedRefs.length > 0) {
        await Promise.all(notSelectedRefs.map(ref =>
          apiClient.updateReferenceStatus(ref.id, {
            status: 'excluded',
            exclusionReason: `No alcanzó el criterio de corte de ${phase}. Score insuficiente para revisión de texto completo.`
          })
        ))
      }

      setReferences((prev) =>
        prev.map((ref) => {
          if (referenceIds.includes(ref.id)) {
            return { ...ref, status: "pending" as const }
          } else if (notSelectedRefs.some(r => r.id === ref.id)) {
            return { ...ref, status: "excluded" as const }
          }
          return ref
        })
      )

      setSelectedForFullText(new Set(referenceIds))

      try {
        await apiClient.updateProtocol(params.id, {
          selectedForFullText: referenceIds
        })
      } catch (protocolError) { }

      setStats(prev => {
        const newStats = { ...prev }
        newStats.pending = referenceIds.length
        newStats.excluded = prev.excluded + notSelectedRefs.length
        return newStats
      })

      toast({
        title: "✅ Selección completada",
        description: `${count} artículos para revisión • ${notSelectedRefs.length} excluidos automáticamente`
      })

      setActiveTab("revision")
    } catch (error) {
      console.error('❌ Error en selección:', error)
      toast({ title: "Error", description: "No se pudieron seleccionar los artículos", variant: "destructive" })
    }
  }

  const handleDeleteReference = async (id: string) => {
    try {
      await apiClient.deleteReference(id)
      const ref = references.find(r => r.id === id)
      setReferences((prev) => prev.filter((r) => r.id !== id))

      if (ref) {
        setStats((prev) => {
          const newStats = { ...prev }
          newStats.total--
          if (ref.status === 'pending') newStats.pending--
          else if (ref.status === 'included') newStats.included--
          else if (ref.status === 'excluded') newStats.excluded--
          return newStats
        })
      }

      toast({ title: "Referencia eliminada", description: "La referencia ha sido eliminada permanentemente" })
    } catch (error) {
      toast({ title: "Error", description: "No se pudo eliminar la referencia", variant: "destructive" })
    }
  }

  const handleDetectDuplicates = async () => {
    setIsDetectingDuplicates(true)
    try {
      toast({ title: "🔍 Detectando duplicados...", description: "Analizando referencias para encontrar duplicados" })

      const result = await apiClient.detectDuplicates(params.id)
      setDuplicatesStats(result.stats)
      setDuplicateGroups(result.groups || [])

      if (result.groups && result.groups.length > 0) {
        setShowDuplicatesDialog(true)
        toast({ title: "✅ Detección completada", description: `Se encontraron ${result.stats.duplicates} duplicados en ${result.stats.duplicateGroups} grupos` })
      } else {
        toast({ title: "✅ Sin duplicados", description: "No se encontraron referencias duplicadas" })
      }
    } catch (error: any) {
      toast({ title: "❌ Error", description: error.message || "No se pudieron detectar duplicados", variant: "destructive" })
    } finally {
      setIsDetectingDuplicates(false)
    }
  }

  const handleKeepReference = async (groupId: string, referenceId: string) => {
    try {
      await apiClient.resolveDuplicateGroup(params.id, groupId, referenceId)
      const data = await apiClient.getReferences(params.id)
      setReferences(data.references || [])
      setStats(data.stats || { total: 0, pending: 0, included: 0, excluded: 0 })
      setDuplicateGroups(prev => prev.filter(g => g.id !== groupId))
      if (duplicateGroups.length <= 1) {
        setShowDuplicatesDialog(false)
      }
    } catch (error: any) {
      throw new Error(error.message || "No se pudo resolver el grupo de duplicados")
    }
  }

  const handleRunScreening = async (threshold: number, method: 'embeddings' | 'llm', llmProvider?: 'gemini' | 'chatgpt') => {
    try {
      const totalRefs = references.length
      if (totalRefs === 0) {
        toast({ title: "Sin referencias", description: "No hay referencias para analizar", variant: "destructive" })
        return
      }

      const methodName = method === 'embeddings' ? 'Híbrido (Embeddings + ChatGPT)' : (llmProvider === 'gemini' ? 'Gemini' : 'ChatGPT')
      toast({ title: "Ejecutando cribado...", description: `Analizando ${totalRefs} referencias con ${methodName}` })

      if (method === 'embeddings') {
        const result = await apiClient.runScreeningEmbeddings(params.id, { threshold })
        if (result.success && result.summary) {
          await handleScreeningComplete(result)
          const { included, excluded, phase1, phase2 } = result.summary
          toast({
            title: "✅ Cribado híbrido completado",
            description: `Fase 1: ${phase1.highConfidenceInclude} inc, ${phase1.highConfidenceExclude} exc. Fase 2: ${phase2.analyzed} analizadas.`,
            duration: 8000
          })
        }
      } else {
        const result = await apiClient.runScreeningLLM(params.id, { llmProvider: llmProvider! })
        if (result.results) {
          setReferences(prev => prev.map(ref => {
            const updated = result.results.find((r: any) => r.referenceId === ref.id)
            return updated ? { ...ref, status: updated.decision as Reference["status"] } : ref
          }))
          toast({ title: "Cribado completado", description: "Proceso finalizado" })
        }
      }
    } catch (error: any) {
      toast({ title: "Error en cribado", description: error.message, variant: "destructive" })
    }
  }

  const handleScreeningComplete = async (resultData?: any) => {
    try {
      if (resultData) setLastScreeningResult(resultData)
      const refData = await apiClient.getAllReferences(params.id)
      setReferences(refData.references || [])
      setStats(prev => ({
        ...prev,
        ...(refData.stats || {})
      }))

      const protocol = await apiClient.getProtocol(params.id)
      if (protocol) {
        if (protocol.screeningResults?.summary?.phase1) setLastScreeningResult(protocol.screeningResults)
        if (!protocol.selectedForFullText?.length) {
          setSelectedForFullText(new Set())
          setScreeningFinalized(false)
          setFase2Unlocked(protocol.fase2Unlocked || false)
        } else {
          setSelectedForFullText(new Set(protocol.selectedForFullText))
          setManualReviewCompleted(protocol.manualReviewFinalized || false)
          setScreeningFinalized(protocol.screeningFinalized || false)
          setFase2Unlocked(protocol.fase2Unlocked || false)
        }
      }
    } catch (error) {
      console.error('❌ Error recargando datos:', error)
    }
  }

  const handleExport = async () => {
    setIsExporting(true)
    try {
      const blob = await apiClient.exportReferences(params.id, 'bibtex')
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `references-${params.id}.bib`
      a.click()
      window.URL.revokeObjectURL(url)
      toast({ title: "✅ Exportación exitosa", description: "Referencias exportadas" })
    } catch (error: any) {
      toast({ title: "Error al exportar", description: error.message, variant: "destructive" })
    } finally {
      setIsExporting(false)
    }
  }

  const filteredReferences = references.filter((ref) => {
    const matchesStatus = statusFilter === "all" || ref.status === statusFilter
    let matchesMethod = true
    if (methodFilter !== 'all' && ref.aiReasoning) {
      const reasoning = ref.aiReasoning.toLowerCase()
      if (methodFilter === 'embeddings') matchesMethod = reasoning.includes('embeddings') && !reasoning.includes('chatgpt')
      else if (methodFilter === 'chatgpt') matchesMethod = reasoning.includes('chatgpt') && !reasoning.includes('embeddings')
      else if (methodFilter === 'hybrid') matchesMethod = reasoning.includes('embeddings') && reasoning.includes('chatgpt')
      else if (methodFilter === 'manual') matchesMethod = !ref.aiReasoning
    } else if (methodFilter === 'manual') matchesMethod = !ref.aiReasoning

    const matchesSearch = searchQuery === "" ||
      ref.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (Array.isArray(ref.authors) ? ref.authors.join(' ').toLowerCase().includes(searchQuery.toLowerCase()) : (ref.authors || '').toLowerCase().includes(searchQuery.toLowerCase()))

    return matchesStatus && matchesMethod && matchesSearch
  })

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <DashboardNav />
        <main className="container mx-auto px-4 py-8 flex flex-col items-center justify-center h-[60vh]">
          <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
          <p className="text-lg font-medium">Cargando referencias...</p>
        </main>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background">
        <DashboardNav />
        <main className="container mx-auto px-4 py-8">
          <Card className="border-red-200 bg-red-50">
            <CardHeader><CardTitle className="text-red-700">Error al cargar referencias</CardTitle></CardHeader>
            <CardContent>
              <p className="text-red-600 mb-4">{error}</p>
              <Button onClick={() => router.push(`/projects/${params.id}`)}>Volver</Button>
            </CardContent>
          </Card>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <DashboardNav />
      <main className="container mx-auto px-4 py-8">
        <div className="space-y-6">
          {project && <ProjectHeader project={project} />}

          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="space-y-6">
            <TabsList className="grid w-full grid-cols-3 h-auto">
              <TabsTrigger value="fase1" className="flex flex-col items-center gap-1 py-3">
                <Brain className="h-4 w-4" /><span className="font-semibold">Clasificación IA</span>
                <span className="text-xs text-muted-foreground">Screening Automático</span>
              </TabsTrigger>
              <TabsTrigger value="prisma" className="flex flex-col items-center gap-1 py-3">
                <Database className="h-4 w-4" /><span className="font-semibold">Diagrama PRISMA</span>
                <span className="text-xs text-muted-foreground">Flujo de Selección</span>
              </TabsTrigger>
              <TabsTrigger value="resultados" className="flex flex-col items-center gap-1 py-3">
                <AlertCircle className="h-4 w-4" /><span className="font-semibold">Resultados Detallado</span>
                <span className="text-xs text-muted-foreground">Resumen final</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="fase1" className="space-y-6">
              <AIScreeningPanel 
                totalReferences={stats.total} 
                pendingReferences={stats.pending} 
                projectId={params.id} 
                isFragmented={project?.protocol?.searchPlan?.isFragmentedMode}
                onRunScreening={handleRunScreening} 
                onScreeningComplete={handleScreeningComplete} 
              />
              {lastScreeningResult && (
                <SimplifiedScreeningSummary
                  projectId={params.id}
                  result={{
                    ...lastScreeningResult,
                    classifiedReferences: {
                      highConfidenceInclude: references.filter(r => 
                        ((r as any).screeningScore > 0.15 && !r.aiReasoning?.toLowerCase().includes('chatgpt')) || 
                        (r.status === 'included' && !r.aiReasoning?.toLowerCase().includes('chatgpt'))
                      ),
                      highConfidenceExclude: references.filter(r => 
                        ((r as any).screeningScore < 0.10 && !r.aiReasoning?.toLowerCase().includes('chatgpt') && r.status !== 'included')
                      ),
                      complementaryRelevant: references.filter(r => 
                        (r.aiClassification === 'include' || r.status === 'included') && r.aiReasoning?.toLowerCase().includes('chatgpt')
                      ),
                      complementaryNotRelevant: references.filter(r => 
                        r.aiClassification === 'exclude' && r.aiReasoning?.toLowerCase().includes('chatgpt') && r.status !== 'included'
                      )
                    }
                  }}
                  onProceedToManualReview={(ids) => handleSelectForFullText(ids, ids.length, 'Fase 1')}
                />
              )}
              <Card>
                <CardHeader><CardTitle>Listado de Referencias ({filteredReferences.length})</CardTitle></CardHeader>
                <CardContent>
                  <ScreeningFilters 
                    statusFilter={statusFilter} 
                    onStatusFilterChange={setStatusFilter} 
                    methodFilter={methodFilter} 
                    onMethodFilterChange={setMethodFilter} 
                    searchQuery={searchQuery} 
                    onSearchQueryChange={setSearchQuery} 
                  />
                  <ReferenceTable references={filteredReferences} onStatusChange={handleStatusChange} onDelete={handleDeleteReference} selectedIds={[]} onSelectionChange={() => { }} showActions={false} enableSelection={false} />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="prisma" className="space-y-6">
              {(() => {
                const totalRefs = references.length
                const classifiedRefs = references.filter(r => r.aiClassification)
                const selectedForReview = references.filter(r => selectedForFullText.has(r.id))
                const excludedManual = selectedForReview.filter(r => r.manualReviewStatus === 'excluded')
                const includedRefs = selectedForReview.filter(r => r.manualReviewStatus === 'included')
                const pendingReview = selectedForReview.filter(r => !r.manualReviewStatus || r.manualReviewStatus === 'pending')

                const dbCounts: Record<string, number> = {}
                references.forEach(r => { dbCounts[r.source || 'Unknown'] = (dbCounts[r.source || 'Unknown'] || 0) + 1 })
                const databases = Object.entries(dbCounts).filter(([n]) => n !== 'Unknown').map(([name, hits]) => ({ name, hits }))

                const scrExcReasons: Record<string, number> = {}
                classifiedRefs.filter(r => !selectedForFullText.has(r.id)).forEach(r => {
                  const reason = r.exclusionReason || 'Baja relevancia'
                  scrExcReasons[reason] = (scrExcReasons[reason] || 0) + 1
                })

                const prismaStats = {
                  identified: totalRefs,
                  duplicates: (stats as any).duplicates || 0,
                  afterDedup: totalRefs,
                  screenedTitleAbstract: classifiedRefs.length || totalRefs,
                  excludedTitleAbstract: classifiedRefs.length - selectedForReview.length,
                  fullTextAssessed: selectedForReview.length,
                  excludedFullText: excludedManual.length,
                  includedFinal: includedRefs.length,
                  pendingReview: pendingReview.length,
                  databases: databases.length ? databases : undefined,
                  screeningExclusionReasons: Object.keys(scrExcReasons).length ? scrExcReasons : undefined
                }

                return (
                  <div className="space-y-6">
                    <PrismaFlowDiagram stats={prismaStats} />
                    <Card>
                      <CardHeader><CardTitle>Continuar al Resumen Final</CardTitle></CardHeader>
                      <CardContent><Button onClick={() => setActiveTab('resultados')} className="w-full" size="lg">Ver Resultados Detallado <ArrowRight className="h-5 w-5 ml-2" /></Button></CardContent>
                    </Card>
                  </div>
                )
              })()}
            </TabsContent>

            <TabsContent value="resultados" className="space-y-6">
              {(() => {
                const totalRefs = references.length
                const selectedRefs = references.filter(r => selectedForFullText.has(r.id))
                const includedRefs = selectedRefs.filter(r => r.manualReviewStatus === 'included')
                const excludedManualRefs = selectedRefs.filter(r => r.manualReviewStatus === 'excluded')

                return (
                  <div className="grid gap-6">
                    <Card>
                      <CardHeader><CardTitle>Resumen del Proceso</CardTitle></CardHeader>
                      <CardContent>
                        <PrismaFlowDiagram stats={{
                          identified: totalRefs,
                          duplicates: 0,
                          afterDedup: totalRefs,
                          screenedTitleAbstract: totalRefs,
                          excludedTitleAbstract: totalRefs - selectedRefs.length,
                          fullTextAssessed: selectedRefs.length,
                          excludedFullText: excludedManualRefs.length,
                          includedFinal: includedRefs.length
                        }} />
                      </CardContent>
                    </Card>

                    <Card className="border-2 border-primary bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-950/40 dark:to-blue-950/40">
                      <CardHeader>
                        <CardTitle className="text-green-800 dark:text-green-300">Finalizar Proceso de Cribado</CardTitle>
                        <CardDescription>Una vez finalizado, podrá generar su borrador completo.</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 text-center">
                          <div className="p-4 border rounded bg-white dark:bg-slate-800"><div className="text-2xl font-bold">{totalRefs}</div>Identificados</div>
                          <div className="p-4 border rounded bg-white dark:bg-slate-800"><div className="text-2xl font-bold">{selectedRefs.length}</div>Evaluados</div>
                          <div className="p-4 border rounded bg-white dark:bg-slate-800"><div className="text-2xl font-bold">{includedRefs.length}</div>Incluidos</div>
                          <div className="p-4 border rounded bg-white dark:bg-slate-800"><div className="text-2xl font-bold">{excludedManualRefs.length}</div>Excluidos</div>
                        </div>

                        <Button
                          onClick={async () => {
                            setIsFinalizingScreening(true)
                            try {
                              const databasesWithRefs: Record<string, number> = {}
                              references.forEach(r => { databasesWithRefs[r.source || 'Unknown'] = (databasesWithRefs[r.source || 'Unknown'] || 0) + 1 })
                              const activeDbs = Object.keys(databasesWithRefs)

                              const protocolQueries = project?.protocol?.searchStrategy?.searchQueries || project?.protocol?.searchQueries || []
                              const cleanedQueries = protocolQueries.filter((q: any) => activeDbs.some(n => n.toLowerCase().includes((q.databaseName || q.databaseId || '').toLowerCase())))

                              await apiClient.updateProtocol(params.id, {
                                screeningFinalized: true,
                                prismaUnlocked: true,
                                analysisCompleted: true,
                                databases: activeDbs,
                                searchQueries: cleanedQueries
                              })

                              setScreeningFinalized(true)
                              toast({ title: "Cribado Finalizado" })
                              await apiClient.completePrismaByBlocks(params.id, 'all')
                              setTimeout(() => router.push(`/projects/${params.id}/article`), 2000)
                            } catch (error: any) {
                              toast({ title: "Error", description: error.message, variant: "destructive" })
                            } finally {
                              setIsFinalizingScreening(false)
                            }
                          }}
                          disabled={screeningFinalized || isFinalizingScreening || selectedForFullText.size === 0}
                          className="w-full bg-gradient-to-r from-green-600 to-blue-600"
                          size="lg"
                        >
                          {isFinalizingScreening ? <Loader2 className="animate-spin h-5 w-5 mr-2" /> : "Finalizar Cribado y Generar Artículo"}
                        </Button>
                      </CardContent>
                    </Card>
                  </div>
                )
              })()}
            </TabsContent>
          </Tabs>
        </div>
      </main>

      <DuplicateDetectionDialog open={showDuplicatesDialog} onOpenChange={setShowDuplicatesDialog} duplicateGroups={duplicateGroups} onKeepReference={handleKeepReference} isProcessing={isDetectingDuplicates} />
    </div>
  )
}
