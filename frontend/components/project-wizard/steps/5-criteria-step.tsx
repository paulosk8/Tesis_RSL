"use client"

import { useState, useCallback } from "react"
import { useWizard } from "../wizard-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Sparkles, Loader2, RefreshCw, Pencil, Check } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { apiClient } from "@/lib/api-client"

// Helper function para obtener nombre del proveedor de IA
const getProviderName = (provider: 'chatgpt' | 'gemini') => {
  const names = {
    chatgpt: 'ChatGPT',
    gemini: 'Gemini'
  }
  return names[provider]
}

// Helper function para filtrar términos descartados
const filterDiscardedTerms = (protocolTerms: any, discardedTerms: any) => {
  if (!protocolTerms || !discardedTerms) return protocolTerms

  const filterArray = (terms: string[], discarded: Set<number>) => {
    return terms.filter((_, index) => !discarded.has(index))
  }

  return {
    tecnologia: filterArray(
      protocolTerms.tecnologia || protocolTerms.technologies || [],
      discardedTerms.tecnologia || new Set()
    ),
    dominio: filterArray(
      protocolTerms.dominio || protocolTerms.applicationDomain || [],
      discardedTerms.dominio || new Set()
    ),
    focosTematicos: filterArray(
      protocolTerms.focosTematicos || protocolTerms.thematicFocus || [],
      discardedTerms.focosTematicos || new Set()
    ),
    tipoEstudio: filterArray(
      protocolTerms.tipoEstudio || protocolTerms.studyType || [],
      discardedTerms.tipoEstudio || new Set()
    )
  }
}

export function CriteriaStep() {
  const { data, updateData } = useWizard()
  const { toast } = useToast()
  const [isGenerating, setIsGenerating] = useState(false)
  const [isRegenerating, setIsRegenerating] = useState(false)
  const [regenerateDialogOpen, setRegenerateDialogOpen] = useState(false)
  const [regenerateType, setRegenerateType] = useState<'inclusion' | 'exclusion' | null>(null)
  const [regenerateCategory, setRegenerateCategory] = useState<number | null>(null) // Índice de la categoría
  const [regenerateFocus, setRegenerateFocus] = useState('')
  const [editingCell, setEditingCell] = useState<string | null>(null) // e.g. "inc-0", "exc-3"
  const [editValue, setEditValue] = useState('')

  // Helper function para obtener términos rechazados
  const getRejectedTerms = useCallback(() => {
    const rejected: string[] = []

    // Agregar términos rechazados de tecnología
    data.discardedTerms?.tecnologia?.forEach((index: number) => {
      const term = data.protocolTerms?.tecnologia?.[index]
      if (term) rejected.push(term)
    })

    // Agregar términos rechazados de dominio
    data.discardedTerms?.dominio?.forEach((index: number) => {
      const term = data.protocolTerms?.dominio?.[index]
      if (term) rejected.push(term)
    })

    // Agregar términos rechazados de focos temáticos
    data.discardedTerms?.focosTematicos?.forEach((index: number) => {
      const term = data.protocolTerms?.focosTematicos?.[index]
      if (term) rejected.push(term)
    })

    return rejected
  }, [data.discardedTerms, data.protocolTerms])

  // Nombres de las categorías
  const categoryNames = [
    'Cobertura Temática (Contexto)',
    'Tecnologías (Intervención)',
    'Enfoque de Resultados (Outcomes)',
    'Tipo de Estudio',
    'Tipo de Documento',
    'Idioma y Temporalidad'
  ]

  const handleGenerateCriteria = async () => {
    if (!data.pico || (!data.pico.population && !data.pico.intervention)) {
      toast({
        title: "Marco PICO requerido",
        description: "Debes completar el Paso 2 (PICO) primero para generar los criterios de inclusión y exclusión",
        variant: "destructive"
      })
      return
    }

    setIsGenerating(true)
    try {
      toast({
        title: "Generando criterios...",
        description: `Usando ${getProviderName(data.aiProvider)} con términos confirmados del protocolo...`
      })

      // Filtrar términos descartados antes de enviar al backend
      const filteredTerms = filterDiscardedTerms(data.protocolTerms, data.discardedTerms)

      // Llamar al nuevo endpoint con términos normalizados y validados
      const result = await apiClient.generateInclusionExclusionCriteria(
        filteredTerms,
        data.pico,
        data.aiProvider,
        undefined, // specificType
        undefined, // customFocus
        undefined, // categoryIndex
        undefined, // categoryName
        data.yearStart,
        data.yearEnd,
        data.selectedTitle, // ← REGLA: Usar título RSL seleccionado para derivar criterios
        getRejectedTerms() // ← Términos rechazados por el investigador
      )

      // Backend returns structured criteria with categories
      // Convert to array format expected by UI
      const inclusionCriteria = result.inclusionCriteria.map((item: any) => item.criterio)
      const exclusionCriteria = result.exclusionCriteria.map((item: any) => item.criterio)

      updateData({
        inclusionCriteria,
        exclusionCriteria
      })

      toast({
        title: "Términos normalizados",
        description: `Se eliminaron duplicados y se validaron ${result.normalizedTerms?.tecnologia?.length || 0} términos tecnológicos`
      })

      toast({
        title: "Criterios generados",
        description: "Criterios de inclusión y exclusión creados basándose en tu proyecto"
      })
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "No se pudieron generar los criterios",
        variant: "destructive"
      })
    } finally {
      setIsGenerating(false)
    }
  }

  const updateCriterion = (type: 'inclusion' | 'exclusion', index: number, value: string) => {
    if (type === 'inclusion') {
      const newCriteria = [...data.inclusionCriteria]
      newCriteria[index] = value
      updateData({ inclusionCriteria: newCriteria })
    } else {
      const newCriteria = [...data.exclusionCriteria]
      newCriteria[index] = value
      updateData({ exclusionCriteria: newCriteria })
    }
  }

  const startEditing = useCallback((type: 'inclusion' | 'exclusion', index: number) => {
    const key = `${type === 'inclusion' ? 'inc' : 'exc'}-${index}`
    const currentValue = type === 'inclusion'
      ? data.inclusionCriteria[index] || ''
      : data.exclusionCriteria[index] || ''
    setEditValue(currentValue)
    setEditingCell(key)
  }, [data.inclusionCriteria, data.exclusionCriteria])

  const saveEditing = useCallback(() => {
    if (!editingCell) return
    const [prefix, idxStr] = editingCell.split('-')
    const type = prefix === 'inc' ? 'inclusion' : 'exclusion' as const
    const index = Number.parseInt(idxStr)
    updateCriterion(type, index, editValue)
    setEditingCell(null)
    setEditValue('')
  }, [editingCell, editValue])

  // Render a criteria cell: read-only with edit button, or textarea when editing
  const renderCriteriaCell = (type: 'inclusion' | 'exclusion', index: number, placeholder: string) => {
    const cellKey = `${type === 'inclusion' ? 'inc' : 'exc'}-${index}`
    const isEditing = editingCell === cellKey
    const value = type === 'inclusion' ? data.inclusionCriteria[index] || '' : data.exclusionCriteria[index] || ''
    const colorClass = type === 'inclusion'
      ? 'text-green-600 hover:text-green-700 hover:bg-green-50'
      : 'text-red-600 hover:text-red-700 hover:bg-red-50'

    return (
      <div className="space-y-2">
        {isEditing ? (
          <div className="relative">
            <Textarea
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              placeholder={placeholder}
              rows={3}
              className="resize-none pr-10"
              autoFocus
            />
            <button
              onClick={saveEditing}
              className="absolute right-2 top-2 p-1.5 rounded-md bg-green-100 hover:bg-green-200 text-green-700 transition-colors"
              title="Guardar"
            >
              <Check className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div
            role="button"
            tabIndex={0}
            className="relative group p-3 rounded-md border border-border min-h-[80px] cursor-pointer hover:border-primary/40 hover:bg-muted/30 transition-colors"
            onClick={() => startEditing(type, index)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') startEditing(type, index) }}
          >
            <p className="text-sm text-foreground pr-8 whitespace-pre-wrap">
              {value || <span className="text-muted-foreground italic">{placeholder}</span>}
            </p>
            <button
              className="absolute right-2 top-2 p-1.5 rounded-md opacity-60 group-hover:opacity-100 hover:bg-muted transition-all"
              title="Editar"
              onClick={(e) => { e.stopPropagation(); startEditing(type, index) }}
            >
              <Pencil className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={() => openRegenerateDialog(type, index)}
          disabled={isRegenerating}
          className={`w-full ${colorClass}`}
        >
          <RefreshCw className="h-3 w-3 mr-2" />
          Regenerar
        </Button>
      </div>
    )
  }

  const openRegenerateDialog = (type: 'inclusion' | 'exclusion', categoryIndex: number) => {
    setRegenerateType(type)
    setRegenerateCategory(categoryIndex)
    setRegenerateFocus('')
    setRegenerateDialogOpen(true)
  }

  const handleRegenerateCriteria = async () => {
    if (!regenerateType || regenerateCategory === null) return

    setIsRegenerating(true)
    try {
      const categoryName = categoryNames[regenerateCategory]

      toast({
        title: "Regenerando criterio...",
        description: `${categoryName} - ${regenerateType === 'inclusion' ? 'Inclusión' : 'Exclusión'}`
      })

      // Filtrar términos descartados antes de enviar al backend
      const filteredTerms = filterDiscardedTerms(data.protocolTerms, data.discardedTerms)

      // Llamar al endpoint con categoría específica
      const result = await apiClient.generateInclusionExclusionCriteria(
        filteredTerms,
        data.pico,
        data.aiProvider,
        regenerateType,
        regenerateFocus || undefined,
        regenerateCategory,
        categoryName,
        data.yearStart,
        data.yearEnd,
        data.selectedTitle, // ← REGLA: Usar título RSL seleccionado
        getRejectedTerms() // ← Términos rechazados
      )

      // Si el backend retorna ambos criterios (bothCriteria = true)  
      if (result.bothCriteria) {
        const inclusionCriteria = [...data.inclusionCriteria]
        const exclusionCriteria = [...data.exclusionCriteria]

        inclusionCriteria[result.categoryIndex] = result.inclusion
        exclusionCriteria[result.categoryIndex] = result.exclusion

        updateData({
          inclusionCriteria,
          exclusionCriteria
        })

        toast({
          title: "Ambos criterios actualizados",
          description: `${categoryName} - Inclusión y Exclusión regenerados para mantener coherencia`
        })
      }
      // Si el backend retorna un solo criterio (isSingleCriterion = true)
      else if (result.isSingleCriterion && result.singleCriterion) {
        if (regenerateType === 'inclusion') {
          const inclusionCriteria = [...data.inclusionCriteria]
          inclusionCriteria[regenerateCategory] = result.singleCriterion
          updateData({ inclusionCriteria })
        } else {
          const exclusionCriteria = [...data.exclusionCriteria]
          exclusionCriteria[regenerateCategory] = result.singleCriterion
          updateData({ exclusionCriteria })
        }

        toast({
          title: "Criterio individual actualizado",
          description: `${categoryName} - Solo ${regenerateType === 'inclusion' ? 'Inclusión' : 'Exclusión'} regenerado`
        })
      } else {
        // Fallback: usar el formato antiguo si el backend no retorna isSingleCriterion
        if (regenerateType === 'inclusion') {
          const inclusionCriteria = [...data.inclusionCriteria]
          const newCriterio = result.inclusionCriteria?.[regenerateCategory]?.criterio ||
            result.inclusionCriteria?.[0]?.criterio || ''
          inclusionCriteria[regenerateCategory] = newCriterio
          updateData({ inclusionCriteria })
        } else {
          const exclusionCriteria = [...data.exclusionCriteria]
          const newCriterio = result.exclusionCriteria?.[regenerateCategory]?.criterio ||
            result.exclusionCriteria?.[0]?.criterio || ''
          exclusionCriteria[regenerateCategory] = newCriterio
          updateData({ exclusionCriteria })
        }

        toast({
          title: "Criterio actualizado (formato legacy)",
          description: `${categoryName} - ${regenerateType === 'inclusion' ? 'Inclusión' : 'Exclusión'} regenerado`
        })
      }

      setRegenerateDialogOpen(false)
      setRegenerateFocus('')
      setRegenerateCategory(null)
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "No se pudo regenerar el criterio",
        variant: "destructive"
      })
    } finally {
      setIsRegenerating(false)
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="text-center space-y-3 mb-8">
        <h2 className="text-2xl font-bold">Criterios de Inclusión y Exclusión</h2>
        <p className="text-base text-muted-foreground">
          Define los criterios para seleccionar estudios relevantes según metodología PRISMA
        </p>
      </div>

      {/* AI Generation Card */}
      <Card className="border-primary/30 bg-card">
        <CardHeader>
          <CardTitle>Generar Criterios con IA</CardTitle>
          <CardDescription>
            La IA analizará tu marco PICO y generará criterios de inclusión/exclusión estructurados
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={handleGenerateCriteria}
            disabled={isGenerating}
            size="lg"
            className="w-full"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                Generando criterios...
              </>
            ) : (
              <>
                <Sparkles className="h-5 w-5 mr-2" />
                Generar Criterios I/E
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Criteria Table */}
      {(data.inclusionCriteria.length > 0 || data.exclusionCriteria.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle>Matriz de Criterios de Inclusión/Exclusión</CardTitle>
            <CardDescription>
              Criterios estructurados por categoría según metodología PRISMA. Al regenerar un criterio, ambos (inclusión y exclusión) se actualizarán automáticamente para mantener coherencia.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[180px] bg-muted/50 text-foreground font-semibold">Categoría</TableHead>
                  <TableHead className="bg-green-50 dark:bg-green-950/20 text-green-900 dark:text-green-100 font-semibold">✅ Criterios de Inclusión</TableHead>
                  <TableHead className="bg-red-50 dark:bg-red-950/20 text-red-900 dark:text-red-100 font-semibold">❌ Criterios de Exclusión</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categoryNames.map((category, idx) => (
                  <TableRow key={category} className="hover:bg-muted/50">
                    <TableCell className="font-semibold bg-muted/50 text-foreground">{category}</TableCell>
                    <TableCell>
                      {renderCriteriaCell('inclusion', idx, `Criterio de inclusión para ${category}...`)}
                    </TableCell>
                    <TableCell>
                      {renderCriteriaCell('exclusion', idx, `Criterio de exclusión para ${category}...`)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Regenerate Dialog */}
      <Dialog open={regenerateDialogOpen} onOpenChange={setRegenerateDialogOpen}>
        <DialogContent className="sm:max-w-[525px]">
          <DialogHeader>
            <DialogTitle>
              Regenerar: {regenerateCategory === null ? '' : categoryNames[regenerateCategory]} - {regenerateType === 'inclusion' ? 'Inclusión' : 'Exclusión'}
            </DialogTitle>
            <DialogDescription>
              Para mantener coherencia, se regenerarán AMBOS criterios (Inclusión y Exclusión) de esta categoría.
              Describe el enfoque específico que deseas (opcional).
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="criteria-focus">
                Enfoque específico (opcional)
              </Label>
              <Textarea
                id="criteria-focus"
                placeholder="Ej: Criterios más específicos para tecnologías de contenedores, enfoque en estudios empíricos recientes..."
                value={regenerateFocus}
                onChange={(e) => setRegenerateFocus(e.target.value)}
                rows={4}
                className="resize-none"
              />
              <p className="text-sm text-muted-foreground">
                Si dejas esto vacío, se usará el análisis predeterminado. Ambos criterios (inclusión y exclusión) serán regenerados para mantener coherencia.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRegenerateDialogOpen(false)}
              disabled={isRegenerating}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleRegenerateCriteria}
              disabled={isRegenerating}
              className={regenerateType === 'inclusion' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}
            >
              {isRegenerating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Regenerando...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Regenerar
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
