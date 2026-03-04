"use client"

import { useWizard } from "../wizard-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Sparkles, Loader2, Wrench, Microscope, Focus, Check, X, Pencil, Save, RefreshCw, Trash2 } from "lucide-react"
import { useState, useEffect, useRef } from "react"
import { useToast } from "@/hooks/use-toast"
import { apiClient } from "@/lib/api-client"

export function ProtocolDefinitionStep() {
  const { data, updateData } = useWizard()
  const { toast } = useToast()
  const [isGenerating, setIsGenerating] = useState(false)
  const [isRegenerating, setIsRegenerating] = useState(false)
  const [regenerateDialogOpen, setRegenerateDialogOpen] = useState(false)
  const [regenerateSection, setRegenerateSection] = useState<'tecnologia' | 'dominio' | 'focosTematicos' | null>(null)
  const [regenerateFocus, setRegenerateFocus] = useState('')
  
  // Estado para términos confirmados - inicializar desde contexto si existe
  const [confirmedTerms, setConfirmedTerms] = useState<{
    tecnologia: Set<number>
    dominio: Set<number>
    tipoEstudio: Set<number>
    focosTematicos: Set<number>
  }>(() => ({
    tecnologia: data.confirmedTerms?.tecnologia instanceof Set ? data.confirmedTerms.tecnologia : new Set(data.confirmedTerms?.tecnologia || []),
    dominio: data.confirmedTerms?.dominio instanceof Set ? data.confirmedTerms.dominio : new Set(data.confirmedTerms?.dominio || []),
    tipoEstudio: data.confirmedTerms?.tipoEstudio instanceof Set ? data.confirmedTerms.tipoEstudio : new Set(data.confirmedTerms?.tipoEstudio || []),
    focosTematicos: data.confirmedTerms?.focosTematicos instanceof Set ? data.confirmedTerms.focosTematicos : new Set(data.confirmedTerms?.focosTematicos || [])
  }))

  // Estado para términos descartados - inicializar desde contexto si existe
  const [discardedTerms, setDiscardedTerms] = useState<{
    tecnologia: Set<number>
    dominio: Set<number>
    tipoEstudio: Set<number>
    focosTematicos: Set<number>
  }>(() => ({
    tecnologia: data.discardedTerms?.tecnologia instanceof Set ? data.discardedTerms.tecnologia : new Set(data.discardedTerms?.tecnologia || []),
    dominio: data.discardedTerms?.dominio instanceof Set ? data.discardedTerms.dominio : new Set(data.discardedTerms?.dominio || []),
    tipoEstudio: data.discardedTerms?.tipoEstudio instanceof Set ? data.discardedTerms.tipoEstudio : new Set(data.discardedTerms?.tipoEstudio || []),
    focosTematicos: data.discardedTerms?.focosTematicos instanceof Set ? data.discardedTerms.focosTematicos : new Set(data.discardedTerms?.focosTematicos || [])
  }))

  // Estado para términos en modo edición
  const [editingTerms, setEditingTerms] = useState<{
    tecnologia: Set<number>
    dominio: Set<number>
    tipoEstudio: Set<number>
    focosTematicos: Set<number>
  }>({
    tecnologia: new Set(),
    dominio: new Set(),
    tipoEstudio: new Set(),
    focosTematicos: new Set()
  })

  // Estados para traducción y edición
  const [translating, setTranslating] = useState<{section: string, index: number} | null>(null)
  const [modifiedSide, setModifiedSide] = useState<{section: string, index: number, side: 'es'|'en'} | null>(null)

  // Inicializar valores por defecto si no existen
  const protocolTerms = {
    tecnologia: data.protocolTerms?.tecnologia || [],
    dominio: data.protocolTerms?.dominio || [],
    tipoEstudio: data.protocolTerms?.tipoEstudio || [],
    focosTematicos: data.protocolTerms?.focosTematicos || []
  }

  // Ref para evitar sincronización en el montaje inicial
  const isFirstMount = useRef(true)

  // Sincronizar estados locales con el contexto del wizard (solo después del primer mount)
  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false
      return
    }
    updateData({ confirmedTerms, discardedTerms })
  }, [confirmedTerms, discardedTerms])

  const toggleConfirmTerm = (field: keyof typeof protocolTerms, index: number) => {
    setConfirmedTerms(prev => {
      const newSet = new Set(prev[field])
      if (newSet.has(index)) {
        newSet.delete(index)
      } else {
        newSet.add(index)
      }
      return { ...prev, [field]: newSet }
    })
    
    // Si confirmamos un término, quitarlo de descartados
    setDiscardedTerms(prev => {
      const newSet = new Set(prev[field])
      newSet.delete(index)
      return { ...prev, [field]: newSet }
    })

    // Salir de modo edición al confirmar
    setEditingTerms(prev => {
      const newSet = new Set(prev[field])
      newSet.delete(index)
      return { ...prev, [field]: newSet }
    })
  }

  const handleGenerateDefinitions = async () => {
    if (!data.pico.population || !data.pico.intervention) {
      toast({
        title: "Información incompleta",
        description: "Completa el marco PICO en el paso anterior",
        variant: "destructive"
      })
      return
    }

    setIsGenerating(true)
    try {
      toast({
        title: "Generando definiciones...",
        description: "La IA está analizando tu proyecto para extraer términos específicos..."
      })

      // Llamar al nuevo endpoint específico para términos del protocolo
      const result = await apiClient.generateProtocolTerms(
        data.selectedTitle || data.projectName, // ← REGLA: Priorizar título RSL seleccionado
        data.projectDescription,
        data.pico,
        data.matrixIsNot,
        data.aiProvider
      )

      // Actualizar con los términos generados por la IA
      updateData({
        protocolTerms: {
          tecnologia: result.technologies || [],
          dominio: result.applicationDomain || [],
          tipoEstudio: result.studyType || [],
          focosTematicos: result.thematicFocus || []
        },
        protocolDefinition: {
          technologies: result.technologies || [],
          applicationDomain: result.applicationDomain || [],
          studyType: result.studyType || [],
          thematicFocus: result.thematicFocus || []
        }
      })

      toast({
        title: "Definiciones generadas",
        description: `Términos específicos de "${data.projectName}" extraídos exitosamente`
      })
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "No se pudieron generar las definiciones",
        variant: "destructive"
      })
    } finally {
      setIsGenerating(false)
    }
  }

  // Mapeo de campos protocolTerms -> protocolDefinition
  const fieldToDefinitionMap: Record<string, string> = {
    tecnologia: 'technologies',
    dominio: 'applicationDomain',
    tipoEstudio: 'studyType',
    focosTematicos: 'thematicFocus'
  }

  const updateArrayField = (field: keyof typeof protocolTerms, index: number, value: string) => {
    const newArray = [...protocolTerms[field]]
    newArray[index] = value
    
    // Actualizar AMBAS estructuras para mantener sincronía
    const definitionField = fieldToDefinitionMap[field]
    const currentDefinition = data.protocolDefinition || {}
    
    updateData({
      protocolTerms: {
        ...protocolTerms,
        [field]: newArray
      },
      protocolDefinition: {
        ...currentDefinition,
        [definitionField]: newArray
      }
    })
  }

  const handleTermChange = (section: keyof typeof protocolTerms, index: number, newValue: string, side: 'es' | 'en', originalOtherSide: string) => {
     const currentTerm = protocolTerms[section][index]
     const isNewTerm = !currentTerm || currentTerm.trim() === '' || !currentTerm.includes(' - ')
     
     // Si es término nuevo (vacío o sin formato bilingüe), permitir editar ambos lados manualmente
     if (isNewTerm) {
       // Para términos nuevos, construir formato bilingüe desde cero
       const parts = currentTerm.includes(' - ') ? currentTerm.split(' - ') : ['', '']
       const esPart = side === 'es' ? newValue : (parts[0] || '')
       const enPart = side === 'en' ? newValue : (parts[1] || originalOtherSide || '')
       const newFullString = `${esPart} - ${enPart}`
       updateArrayField(section, index, newFullString)
       setModifiedSide({ section, index, side })
       return
     }
     
     // Para términos generados por IA, solo permitir modificar el lado español
     if (side !== 'es') return
     
     const newFullString = `${newValue} - ${originalOtherSide}`
     updateArrayField(section, index, newFullString)
     setModifiedSide({ section, index, side: 'es' })
  }

  const addArrayItem = (field: keyof typeof protocolTerms) => {
    const newArray = [...protocolTerms[field], ""]
    const definitionField = fieldToDefinitionMap[field]
    const currentDefinition = data.protocolDefinition || {}
    
    updateData({
      protocolTerms: {
        ...protocolTerms,
        [field]: newArray
      },
      protocolDefinition: {
        ...currentDefinition,
        [definitionField]: newArray
      }
    })
  }

  const toggleDiscardTerm = (field: keyof typeof protocolTerms, index: number) => {
    setDiscardedTerms(prev => {
      const newSet = new Set(prev[field])
      if (newSet.has(index)) {
        newSet.delete(index)
      } else {
        newSet.add(index)
      }
      return { ...prev, [field]: newSet }
    })
    
    // Si descartamos un término, quitarlo de confirmados
    setConfirmedTerms(prev => {
      const newSet = new Set(prev[field])
      newSet.delete(index)
      return { ...prev, [field]: newSet }
    })

    // Salir de modo edición al descartar
    setEditingTerms(prev => {
      const newSet = new Set(prev[field])
      newSet.delete(index)
      return { ...prev, [field]: newSet }
    })
  }

  const toggleEditMode = async (field: keyof typeof protocolTerms, index: number) => {
    const isCurrentlyEditing = editingTerms[field].has(index)

    // Logica de guardado con traducción automática
    if (isCurrentlyEditing && modifiedSide && modifiedSide.section === field && modifiedSide.index === index) {
        const currentTerm = protocolTerms[field][index]
        const parts = currentTerm.includes(' - ') ? currentTerm.split(' - ') : [currentTerm, '']
        const esTerm = parts[0].trim()
        const enTerm = parts.slice(1).join(' - ').trim()
        
        // Detectar si es un término nuevo (usuario escribió ambos lados manualmente)
        const isNewTerm = !currentTerm || modifiedSide.side === 'en' || (esTerm && enTerm && modifiedSide.side !== 'es')
        
        // Si ambos lados tienen contenido Y el usuario editó manualmente, solo guardar sin traducir
        if (isNewTerm && esTerm && enTerm) {
            setModifiedSide(null)
            setTranslating(null)
            toast({ title: "Guardado", description: "Término bilingüe guardado", duration: 2000 })
        } else if (modifiedSide.side === 'es' && esTerm) {
            // Solo traducir si editó el español y NO tiene inglés todavía
            try {
                setTranslating({ section: field, index })
                toast({ title: "Traduciendo...", description: "Generando término en inglés..." })
                const translated = await apiClient.translateText(esTerm, 'es', 'en')
                const newFullString = `${esTerm} - ${translated}`
                updateArrayField(field, index, newFullString)
                setModifiedSide(null)
                toast({ title: "Guardado y traducido", duration: 2000 })
            } catch (e) {
                console.error(e)
                toast({ variant: "destructive", title: "Error al traducir, pero se guardó el cambio manual." })
            } finally {
                setTranslating(null)
            }
        } else {
            // Otros casos: simplemente guardar
            setModifiedSide(null)
            setTranslating(null)
            toast({ title: "Guardado", duration: 2000 })
        }
    }

    setEditingTerms(prev => {
      const newSet = new Set(prev[field])
      if (newSet.has(index)) {
        newSet.delete(index)
      } else {
        newSet.add(index)
      }
      return { ...prev, [field]: newSet }
    })
  }

  const openRegenerateDialog = (section: 'tecnologia' | 'dominio' | 'focosTematicos') => {
    setRegenerateSection(section)
    setRegenerateFocus('')
    setRegenerateDialogOpen(true)
  }

  const handleRegenerateSection = async () => {
    if (!regenerateSection) return

    setIsRegenerating(true)
    try {
      toast({
        title: "Regenerando sección...",
        description: `Analizando con enfoque personalizado: ${regenerateFocus || 'predeterminado'}`
      })

      // Llamar al endpoint con contexto adicional
      const result = await apiClient.generateProtocolTerms(
        data.selectedTitle || data.projectName, // ← REGLA: Priorizar título RSL seleccionado
        data.projectDescription,
        data.pico,
        data.matrixIsNot,
        data.aiProvider,
        regenerateSection,
        regenerateFocus
      )

      // Actualizar solo la sección regenerada
      const sectionMap: Record<typeof regenerateSection, keyof typeof result> = {
        tecnologia: 'technologies',
        dominio: 'applicationDomain',
        focosTematicos: 'thematicFocus'
      }

      const resultKey = sectionMap[regenerateSection]
      const newProtocolTerms = {
        ...protocolTerms,
        [regenerateSection]: result[resultKey] || []
      }
      
      updateData({
        protocolTerms: newProtocolTerms,
        protocolDefinition: {
          technologies: newProtocolTerms.tecnologia,
          applicationDomain: newProtocolTerms.dominio,
          studyType: newProtocolTerms.tipoEstudio,
          thematicFocus: newProtocolTerms.focosTematicos
        }
      })

      // Limpiar estados de confirmación/descarte para la sección regenerada
      setConfirmedTerms(prev => ({ ...prev, [regenerateSection]: new Set() }))
      setDiscardedTerms(prev => ({ ...prev, [regenerateSection]: new Set() }))
      setEditingTerms(prev => ({ ...prev, [regenerateSection]: new Set() }))

      toast({
        title: "Sección regenerada",
        description: "Los términos se han actualizado con tu enfoque personalizado"
      })

      setRegenerateDialogOpen(false)
      setRegenerateFocus('')
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "No se pudo regenerar la sección",
        variant: "destructive"
      })
    } finally {
      setIsRegenerating(false)
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="text-center space-y-3 mb-8">
        <h2 className="text-2xl font-bold">Definición de Términos del Protocolo</h2>
        <p className="text-base text-muted-foreground">
          Rellena la parte inicial del protocolo con la definición de los términos clave
        </p>
        <div className="border border-blue-200 dark:border-blue-800 rounded-lg p-4 mt-4">
          <p className="text-sm text-foreground">
            <strong>Instrucciones:</strong> Usa el botón <Check className="inline h-4 w-4 text-green-600" /> para confirmar términos que incluirás en tu protocolo, 
            y el botón <X className="inline h-4 w-4 text-red-600" /> para marcar términos como rechazados (se mostrarán tachados pero no se eliminarán). 
            Una vez confirmado o rechazado un término, no podrá editarse. Debes confirmar al menos un término para continuar al siguiente paso.
          </p>
        </div>
      </div>

      {/* AI Generation Card */}
      {protocolTerms.tecnologia.length === 0 && (
        <Card className="border-2 border-primary/20">
          <CardHeader>
            <CardTitle className="text-gray-900 dark:text-gray-100">Generar Definiciones con IA</CardTitle>
            <CardDescription className="text-gray-700 dark:text-gray-300">
              La IA analizará tu proyecto y generará términos específicos basados en tu tema, PICO y matriz Es/No Es. 
              Los términos estarán personalizados para "{data.projectName}" (no serán ejemplos genéricos).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={handleGenerateDefinitions}
              disabled={isGenerating}
              size="lg"
              className="w-full"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Analizando "{data.projectName}"...
                </>
              ) : (
                <>
                  <Sparkles className="h-5 w-5 mr-2" />
                  Generar Términos Personalizados
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Technologies Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wrench className="h-5 w-5 text-blue-600" />
              <CardTitle>Tecnología / Herramientas</CardTitle>
            </div>
            {protocolTerms.tecnologia.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => openRegenerateDialog('tecnologia')}
                disabled={isRegenerating}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Regenerar
              </Button>
            )}
          </div>
          <CardDescription>
            Tecnologías, herramientas y frameworks principales del estudio
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {protocolTerms.tecnologia.length === 0 && (
            <p className="text-sm text-muted-foreground italic text-center py-4">
              Genera definiciones con IA o agrega manualmente
            </p>
          )}
          {protocolTerms.tecnologia.map((tech, index) => {
            const isEditing = editingTerms.tecnologia.has(index)
            const isDiscarded = discardedTerms.tecnologia.has(index)
            const isConfirmed = confirmedTerms.tecnologia.has(index)
            const isTranslating = translating?.section === 'tecnologia' && translating?.index === index
            
            const parts = tech.includes(' - ') ? tech.split(' - ') : [tech, ''];
            const esTerm = parts[0].trim();
            const enTerm = parts.slice(1).join(' - ').trim();

            const getFieldStyles = () => `resize-none transition-all disabled:opacity-100 font-medium ${
                      isDiscarded
                        ? 'opacity-50 bg-red-50 dark:bg-red-950/30 border-red-300 dark:border-red-700 line-through text-red-600 dark:text-red-400'
                        : isConfirmed
                        ? 'border-2 border-green-500 dark:border-green-600 bg-green-50 dark:bg-green-950/30 text-foreground' 
                        : !isEditing
                        ? 'cursor-default bg-muted/30 dark:bg-gray-800/50 border-transparent shadow-none text-foreground'
                        : 'bg-background text-foreground'
                    }`;

            return (
              <div key={index} className="flex gap-3 items-center group">
                <div className={`flex-1 grid grid-cols-1 md:grid-cols-12 gap-4 p-4 border rounded-xl transition-all relative ${
                  isConfirmed ? 'bg-green-50/50 border-green-200' : 
                  isDiscarded ? 'bg-red-50/30 border-red-100' :
                  'bg-card hover:shadow-md'
                }`}>
                   <div className="col-span-1 md:col-span-5 space-y-2">
                      <Label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-yellow-400"></span> Español
                      </Label>
                      <Textarea
                        value={esTerm}
                        onChange={(e) => handleTermChange('tecnologia', index, e.target.value, 'es', enTerm)}
                        placeholder="Término en Español"
                        rows={2}
                        disabled={!isEditing || isTranslating}
                        className={getFieldStyles()}
                      />
                   </div>
                   
                   {/* Divider */}
                   <div className="hidden md:flex col-span-1 items-center justify-center">
                      <div className="h-full w-px bg-border/50"></div>
                   </div>

                   <div className="col-span-1 md:col-span-6 space-y-2 relative">
                      <Label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center justify-between gap-2">
                        <span className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-blue-400"></span> Inglés (Search Query)
                        </span>
                        {isEditing && tech.includes(' - ') && esTerm && enTerm && (
                          <span className="text-[10px] text-blue-600 dark:text-blue-400 font-medium bg-blue-50 dark:bg-blue-950/30 px-2 py-0.5 rounded">
                            AUTO-TRADUCCIÓN
                          </span>
                        )}
                      </Label>
                      <Textarea
                        value={enTerm}
                        onChange={(e) => handleTermChange('tecnologia', index, e.target.value, 'en', esTerm)}
                        placeholder="English Term"
                        rows={2}
                        disabled={!isEditing || isTranslating || (tech.includes(' - ') && esTerm && enTerm)}
                        className={`${getFieldStyles()} ${(isEditing && tech.includes(' - ') && esTerm && enTerm) ? 'cursor-not-allowed opacity-60' : ''}`}
                        title={(isEditing && tech.includes(' - ') && esTerm && enTerm) ? "Este campo se traduce automáticamente al guardar" : ""}
                      />
                   </div>
                   
                   {/* Edit Button */}
                   <div className="absolute top-2 right-2">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => toggleEditMode('tecnologia', index)}
                        className="h-8 w-8 hover:bg-muted rounded-full transition-opacity"
                        title={isEditing ? "Guardar y traducir" : "Editar término"}
                        disabled={isConfirmed || isDiscarded || isTranslating}
                      >
                        {isTranslating ? (
                           <Loader2 className="h-4 w-4 animate-spin text-primary" />
                        ) : isEditing ? (
                           <Save className="h-4 w-4 text-primary" />
                        ) : (
                           <Pencil className="h-4 w-4 text-muted-foreground" />
                        )}
                      </Button>
                   </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-2">
                  <Button
                    size="icon"
                    variant={isConfirmed ? "default" : "outline"}
                    onClick={() => toggleConfirmTerm('tecnologia', index)}
                    className={`rounded-full h-10 w-10 shadow-sm transition-all ${
                      isConfirmed 
                      ? "bg-green-600 hover:bg-green-700 ring-2 ring-green-200 ring-offset-1" 
                      : "border-2 hover:border-green-500 hover:text-green-600 hover:bg-green-50"
                    }`}
                    title={isConfirmed ? "Término confirmado" : "Confirmar término"}
                  >
                    <Check className="h-5 w-5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => toggleDiscardTerm('tecnologia', index)}
                    className={`rounded-full h-10 w-10 transition-all ${
                      isDiscarded 
                      ? "bg-red-100 text-red-700 ring-2 ring-red-200 ring-offset-1" 
                      : "text-muted-foreground hover:bg-red-50 hover:text-red-600"
                    }`}
                    title={isDiscarded ? "Restaurar término" : "Descartar término"}
                  >
                    <Trash2 className="h-5 w-5" />
                  </Button>
                </div>
              </div>
            )
          })}
          <Button
            variant="outline"
            onClick={() => addArrayItem('tecnologia')}
            className="w-full"
          >
            + Agregar Tecnología
          </Button>
          {protocolTerms.tecnologia.length > 0 && (
            <div className="text-sm text-muted-foreground text-center pt-2">
              {confirmedTerms.tecnologia.size} confirmado{confirmedTerms.tecnologia.size !== 1 ? 's' : ''} · {' '}
              {discardedTerms.tecnologia.size} rechazado{discardedTerms.tecnologia.size !== 1 ? 's' : ''} · {' '}
              {protocolTerms.tecnologia.length - confirmedTerms.tecnologia.size - discardedTerms.tecnologia.size} pendiente{(protocolTerms.tecnologia.length - confirmedTerms.tecnologia.size - discardedTerms.tecnologia.size) !== 1 ? 's' : ''}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Application Domain Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Microscope className="h-5 w-5 text-green-600" />
              <CardTitle>Dominio de Aplicación</CardTitle>
            </div>
            {protocolTerms.dominio.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => openRegenerateDialog('dominio')}
                disabled={isRegenerating}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Regenerar
              </Button>
            )}
          </div>
          <CardDescription>
            Contexto y ámbito de aplicación del estudio
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {protocolTerms.dominio.length === 0 && (
            <p className="text-sm text-muted-foreground italic text-center py-4">
              Genera definiciones con IA o agrega manualmente
            </p>
          )}
          {protocolTerms.dominio.map((domain, index) => {
            const isEditing = editingTerms.dominio.has(index)
            const isDiscarded = discardedTerms.dominio.has(index)
            const isConfirmed = confirmedTerms.dominio.has(index)
            const isTranslating = translating?.section === 'dominio' && translating?.index === index
            
            const parts = domain.includes(' - ') ? domain.split(' - ') : [domain, ''];
            const esTerm = parts[0].trim();
            const enTerm = parts.slice(1).join(' - ').trim();

            const getFieldStyles = () => `resize-none transition-all disabled:opacity-100 font-medium ${
                      isDiscarded
                        ? 'opacity-50 bg-red-50 dark:bg-red-950/30 border-red-300 dark:border-red-700 line-through text-red-600 dark:text-red-400'
                        : isConfirmed
                        ? 'border-2 border-green-500 dark:border-green-600 bg-green-50 dark:bg-green-950/30 text-foreground' 
                        : !isEditing
                        ? 'cursor-default bg-muted/30 dark:bg-gray-800/50 border-transparent shadow-none text-foreground'
                        : 'bg-background text-foreground'
                    }`;

            return (
              <div key={index} className="flex gap-3 items-center group">
                <div className={`flex-1 grid grid-cols-1 md:grid-cols-12 gap-4 p-4 border rounded-xl transition-all relative ${
                  isConfirmed ? 'bg-green-50/50 border-green-200' : 
                  isDiscarded ? 'bg-red-50/30 border-red-100' :
                  'bg-card hover:shadow-md'
                }`}>
                   <div className="col-span-1 md:col-span-5 space-y-2">
                       <Label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-green-400"></span> Español
                      </Label>
                      <Textarea
                        value={esTerm}
                        onChange={(e) => handleTermChange('dominio', index, e.target.value, 'es', enTerm)}
                        placeholder="Término en Español"
                        rows={2}
                        disabled={!isEditing || isTranslating}
                        className={getFieldStyles()}
                      />
                   </div>
                   
                   {/* Divider */}
                   <div className="hidden md:flex col-span-1 items-center justify-center">
                      <div className="h-full w-px bg-border/50"></div>
                   </div>

                   <div className="col-span-1 md:col-span-6 space-y-2 relative">
                      <Label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center justify-between gap-2">
                        <span className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-blue-400"></span> Inglés (Search Query)
                        </span>
                        {isEditing && domain.includes(' - ') && esTerm && enTerm && (
                          <span className="text-[10px] text-blue-600 dark:text-blue-400 font-medium bg-blue-50 dark:bg-blue-950/30 px-2 py-0.5 rounded">
                            AUTO-TRADUCCIÓN
                          </span>
                        )}
                      </Label>
                      <Textarea
                        value={enTerm}
                        onChange={(e) => handleTermChange('dominio', index, e.target.value, 'en', esTerm)}
                        placeholder="English Term"
                        rows={2}
                        disabled={!isEditing || isTranslating || (domain.includes(' - ') && esTerm && enTerm)}
                        className={`${getFieldStyles()} ${(isEditing && domain.includes(' - ') && esTerm && enTerm) ? 'cursor-not-allowed opacity-60' : ''}`}
                        title={(isEditing && domain.includes(' - ') && esTerm && enTerm) ? "Este campo se traduce automáticamente al guardar" : ""}
                      />
                   </div>
                   
                   {/* Edit Button */}
                   <div className="absolute top-2 right-2">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => toggleEditMode('dominio', index)}
                        className="h-8 w-8 hover:bg-muted rounded-full transition-opacity"
                        title={isEditing ? "Guardar y traducir" : "Editar término"}
                        disabled={isConfirmed || isDiscarded || isTranslating}
                      >
                       {isTranslating ? (
                           <Loader2 className="h-4 w-4 animate-spin text-green-600" />
                        ) : isEditing ? (
                           <Save className="h-4 w-4 text-green-600" />
                        ) : (
                           <Pencil className="h-4 w-4 text-muted-foreground" />
                        )}
                      </Button>
                   </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-2">
                  <Button
                    size="icon"
                    variant={isConfirmed ? "default" : "outline"}
                    onClick={() => toggleConfirmTerm('dominio', index)}
                    className={`rounded-full h-10 w-10 shadow-sm transition-all ${
                      isConfirmed 
                      ? "bg-green-600 hover:bg-green-700 ring-2 ring-green-200 ring-offset-1" 
                      : "border-2 hover:border-green-500 hover:text-green-600 hover:bg-green-50"
                    }`}
                    title={isConfirmed ? "Término confirmado" : "Confirmar término"}
                  >
                    <Check className="h-5 w-5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => toggleDiscardTerm('dominio', index)}
                    className={`rounded-full h-10 w-10 transition-all ${
                      isDiscarded 
                      ? "bg-red-100 text-red-700 ring-2 ring-red-200 ring-offset-1" 
                      : "text-muted-foreground hover:bg-red-50 hover:text-red-600"
                    }`}
                    title={isDiscarded ? "Restaurar término" : "Descartar término"}
                  >
                    <Trash2 className="h-5 w-5" />
                  </Button>
                </div>
              </div>
            )
          })}
          <Button
            variant="outline"
            onClick={() => addArrayItem('dominio')}
            className="w-full"
          >
            + Agregar Dominio
          </Button>
          {protocolTerms.dominio.length > 0 && (
            <div className="text-sm text-muted-foreground text-center pt-2">
              {confirmedTerms.dominio.size} confirmado{confirmedTerms.dominio.size !== 1 ? 's' : ''} · {' '}
              {discardedTerms.dominio.size} rechazado{discardedTerms.dominio.size !== 1 ? 's' : ''} · {' '}
              {protocolTerms.dominio.length - confirmedTerms.dominio.size - discardedTerms.dominio.size} pendiente{(protocolTerms.dominio.length - confirmedTerms.dominio.size - discardedTerms.dominio.size) !== 1 ? 's' : ''}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Thematic Focus Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Focus className="h-5 w-5 text-orange-600" />
              <CardTitle>Focos Temáticos</CardTitle>
            </div>
            {protocolTerms.focosTematicos.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => openRegenerateDialog('focosTematicos')}
                disabled={isRegenerating}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Regenerar
              </Button>
            )}
          </div>
          <CardDescription>
            Áreas temáticas y aspectos específicos a investigar
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {protocolTerms.focosTematicos.length === 0 && (
            <p className="text-sm text-muted-foreground italic text-center py-4">
              Genera definiciones con IA o agrega manualmente
            </p>
          )}
          {protocolTerms.focosTematicos.map((focus, index) => {
            const isEditing = editingTerms.focosTematicos.has(index)
            const isDiscarded = discardedTerms.focosTematicos.has(index)
            const isConfirmed = confirmedTerms.focosTematicos.has(index)
            const isTranslating = translating?.section === 'focosTematicos' && translating?.index === index
            
            const parts = focus.includes(' - ') ? focus.split(' - ') : [focus, ''];
            const esTerm = parts[0].trim();
            const enTerm = parts.slice(1).join(' - ').trim();

            const getFieldStyles = () => `resize-none transition-all disabled:opacity-100 font-medium ${
                      isDiscarded
                        ? 'opacity-50 bg-red-50 dark:bg-red-950/30 border-red-300 dark:border-red-700 line-through text-red-600 dark:text-red-400'
                        : isConfirmed
                        ? 'border-2 border-green-500 dark:border-green-600 bg-green-50 dark:bg-green-950/30 text-foreground' 
                        : !isEditing
                        ? 'cursor-default bg-muted/30 dark:bg-gray-800/50 border-transparent shadow-none text-foreground'
                        : 'bg-background text-foreground'
                    }`;
            
            return (
              <div key={index} className="flex gap-3 items-center group">
                <div className={`flex-1 grid grid-cols-1 md:grid-cols-12 gap-4 p-4 border rounded-xl transition-all relative ${
                  isConfirmed ? 'bg-green-50/50 border-green-200' : 
                  isDiscarded ? 'bg-red-50/30 border-red-100' :
                  'bg-card hover:shadow-md'
                }`}>
                   <div className="col-span-1 md:col-span-5 space-y-2">
                      <Label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-orange-400"></span> Español
                      </Label>
                      <Textarea
                        value={esTerm}
                        onChange={(e) => handleTermChange('focosTematicos', index, e.target.value, 'es', enTerm)}
                        placeholder="Término en Español"
                        rows={2}
                        disabled={!isEditing || isTranslating}
                        className={getFieldStyles()}
                      />
                   </div>
                   
                   {/* Divider */}
                   <div className="hidden md:flex col-span-1 items-center justify-center">
                      <div className="h-full w-px bg-border/50"></div>
                   </div>

                   <div className="col-span-1 md:col-span-6 space-y-2 relative">
                      <Label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center justify-between gap-2">
                        <span className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-blue-400"></span> Inglés (Search Query)
                        </span>
                        {isEditing && focus.includes(' - ') && esTerm && enTerm && (
                          <span className="text-[10px] text-blue-600 dark:text-blue-400 font-medium bg-blue-50 dark:bg-blue-950/30 px-2 py-0.5 rounded">
                            AUTO-TRADUCCIÓN
                          </span>
                        )}
                      </Label>
                      <Textarea
                        value={enTerm}
                        onChange={(e) => handleTermChange('focosTematicos', index, e.target.value, 'en', esTerm)}
                        placeholder="English Term"
                        rows={2}
                        disabled={!isEditing || isTranslating || (focus.includes(' - ') && esTerm && enTerm)}
                        className={`${getFieldStyles()} ${(isEditing && focus.includes(' - ') && esTerm && enTerm) ? 'cursor-not-allowed opacity-60' : ''}`}
                        title={(isEditing && focus.includes(' - ') && esTerm && enTerm) ? "Este campo se traduce automáticamente al guardar" : ""}
                      />
                   </div>
                   
                   {/* Edit Button */}
                   <div className="absolute top-2 right-2">
                       <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => toggleEditMode('focosTematicos', index)}
                        className="h-8 w-8 hover:bg-muted rounded-full transition-opacity"
                        title={isEditing ? "Guardar y traducir" : "Editar término"}
                        disabled={isConfirmed || isDiscarded || isTranslating}
                      >
                         {isTranslating ? (
                           <Loader2 className="h-4 w-4 animate-spin text-orange-600" />
                        ) : isEditing ? (
                           <Save className="h-4 w-4 text-orange-600" />
                        ) : (
                           <Pencil className="h-4 w-4 text-muted-foreground" />
                        )}
                      </Button>
                   </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-2">
                  <Button
                    size="icon"
                    variant={isConfirmed ? "default" : "outline"}
                    onClick={() => toggleConfirmTerm('focosTematicos', index)}
                    className={`rounded-full h-10 w-10 shadow-sm transition-all ${
                      isConfirmed 
                      ? "bg-green-600 hover:bg-green-700 ring-2 ring-green-200 ring-offset-1" 
                      : "border-2 hover:border-green-500 hover:text-green-600 hover:bg-green-50"
                    }`}
                    title={isConfirmed ? "Término confirmado" : "Confirmar término"}
                  >
                    <Check className="h-5 w-5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => toggleDiscardTerm('focosTematicos', index)}
                    className={`rounded-full h-10 w-10 transition-all ${
                      isDiscarded 
                      ? "bg-red-100 text-red-700 ring-2 ring-red-200 ring-offset-1" 
                      : "text-muted-foreground hover:bg-red-50 hover:text-red-600"
                    }`}
                    title={isDiscarded ? "Restaurar término" : "Descartar término"}
                  >
                    <Trash2 className="h-5 w-5" />
                  </Button>
                </div>
              </div>
            )
          })}
          <Button
            variant="outline"
            onClick={() => addArrayItem('focosTematicos')}
            className="w-full"
          >
            + Agregar Foco Temático
          </Button>
          {protocolTerms.focosTematicos.length > 0 && (
            <div className="text-sm text-muted-foreground text-center pt-2">
              {confirmedTerms.focosTematicos.size} confirmado{confirmedTerms.focosTematicos.size !== 1 ? 's' : ''} · {' '}
              {discardedTerms.focosTematicos.size} rechazado{discardedTerms.focosTematicos.size !== 1 ? 's' : ''} · {' '}
              {protocolTerms.focosTematicos.length - confirmedTerms.focosTematicos.size - discardedTerms.focosTematicos.size} pendiente{(protocolTerms.focosTematicos.length - confirmedTerms.focosTematicos.size - discardedTerms.focosTematicos.size) !== 1 ? 's' : ''}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Regenerate Dialog */}
      <Dialog open={regenerateDialogOpen} onOpenChange={setRegenerateDialogOpen}>
        <DialogContent className="sm:max-w-[525px]">
          <DialogHeader>
            <DialogTitle>Regenerar Sección</DialogTitle>
            <DialogDescription>
              Describe en qué quieres centrar el análisis para {' '}
              {regenerateSection === 'tecnologia' && 'Tecnología / Herramientas'}
              {regenerateSection === 'dominio' && 'Dominio de Aplicación'}
              {regenerateSection === 'focosTematicos' && 'Focos Temáticos'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="focus">
                Enfoque específico (opcional)
              </Label>
              <Textarea
                id="focus"
                placeholder="Ej: Quiero centrarme más en aspectos de rendimiento y escalabilidad..."
                value={regenerateFocus}
                onChange={(e) => setRegenerateFocus(e.target.value)}
                rows={4}
                className="resize-none"
              />
              <p className="text-sm text-muted-foreground">
                Si dejas esto en blanco, se usará el análisis predeterminado
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
              onClick={handleRegenerateSection}
              disabled={isRegenerating}
            >
              {isRegenerating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Regenerando...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Regenerar Sección
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
