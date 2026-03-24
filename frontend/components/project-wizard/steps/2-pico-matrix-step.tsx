"use client"

import { useState } from "react"
import { useWizard } from "../wizard-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Textarea } from "@/components/ui/textarea"
import { Sparkles, Loader2, Info, Pencil, Save, Brain, ListChecks } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { apiClient } from "@/lib/api-client"

// Helper function para obtener icono y label del componente PICO
const getPicoComponent = (pregunta: string) => {
  if (pregunta.includes('Población')) return { icon: 'P', label: 'Población' }
  if (pregunta.includes('Intervención')) return { icon: 'I', label: 'Intervención' }
  if (pregunta.includes('Comparación')) return { icon: 'C', label: 'Comparador' }
  if (pregunta.includes('Resultado') || pregunta.includes('Outcome')) return { icon: 'O', label: 'Outcomes' }
  return { icon: '?', label: pregunta }
}

export function PicoMatrixStep() {
  const { data, updateData } = useWizard()
  const { toast } = useToast()
  const [isGenerating, setIsGenerating] = useState(false)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [editValue, setEditValue] = useState("")

  const [editingRQIndex, setEditingRQIndex] = useState<number | null>(null)
  const [editRQValue, setEditRQValue] = useState("")

  // Map index to PICO field key
  const picoFieldMap: Record<number, keyof typeof data.pico> = {
    0: 'population',
    1: 'intervention',
    2: 'comparison',
    3: 'outcome'
  }

  const handleStartEdit = (index: number, currentValue: string) => {
    setEditingIndex(index)
    setEditValue(currentValue)
  }

  const handleCancelEdit = () => {
    setEditingIndex(null)
    setEditValue("")
  }

  const handleSaveEdit = (index: number) => {
    const fieldKey = picoFieldMap[index]
    if (!fieldKey) return

    // Update PICO data
    updateData({
      pico: {
        ...data.pico,
        [fieldKey]: editValue
      }
    })

    // Update matrixTable contenido
    if (data.matrixTable) {
      const updatedTable = [...data.matrixTable]
      updatedTable[index] = {
        ...updatedTable[index],
        contenido: editValue
      }
      updateData({ matrixTable: updatedTable })
    }

    setEditingIndex(null)
    setEditValue("")

    toast({
      title: "Campo actualizado",
      description: `${fieldKey.charAt(0).toUpperCase() + fieldKey.slice(1)} actualizado correctamente.`
    })
  }

  const handleGenerateWithAI = async () => {
    if (!data.projectName || !data.projectDescription) {
      toast({
        title: "Información incompleta",
        description: "Necesitas completar el Paso 1 primero",
        variant: "destructive"
      })
      return
    }

    let currentProjectId = data.projectId;

    // Fallback: Si por alguna razón el proyecto no se inicializó en el Paso 1, inicializarlo ahora
    if (!currentProjectId) {
      try {
        toast({
          title: "Inicializando proyecto...",
          description: "Guardando datos base antes de conectarse a la IA."
        })
        const payload = {
          title: `[BORRADOR] ${data.projectName || "Nuevo Proyecto"}`,
          description: data.projectDescription || "Proyecto de revisión sistemática",
          researchArea: data.researchArea || "",
          status: "temporary"
        }
        const response = await apiClient.createProject(payload)
        const newId = response?.data?.project?.id || response?.data?.id || response?.project?.id

        if (!newId) throw new Error("No se pudo obtener el ID del proyecto creado.")

        updateData({ projectId: newId })
        currentProjectId = newId;
      } catch (err) {
        toast({
          title: "Error Fatal",
          description: "No se ha inicializado el proyecto correctamente ni se pudo crear uno de respaldo.",
          variant: "destructive"
        })
        return
      }
    }

    setIsGenerating(true)
    try {
      toast({
        title: "Generando análisis...",
        description: "Esto puede tomar 20-30 segundos..."
      })

      // Obtener área legible desde el valor del select
      const areaMap: Record<string, string> = {
        'ingenieria-tecnologia': 'Ingeniería y Tecnología',
        'medicina-salud': 'Medicina y Ciencias de la Salud',
        'ciencias-sociales': 'Ciencias Sociales y Humanidades',
        'arquitectura-diseño': 'Arquitectura, Diseño y Urbanismo'
      }
      const areaTexto = data.researchArea ? areaMap[data.researchArea] : undefined
      const result = await apiClient.generateProtocolAnalysis(
        data.projectName,
        data.projectDescription,
        'gemini', // Usar Gemini ya que el modelo pro ha sido conectado
        areaTexto,
        data.yearStart,
        data.yearEnd
      )

      // Extraer PICO
      const pico = result.fase1_marco_pico?.marco_pico || {}

      // Extraer Matriz Es/No Es y crear tabla unificada
      const matrizData = result.fase2_matriz_es_no_es || {}

      // Crear tabla unificada con componentes PICO + Justificación Es/No Es
      const tablaUnificada: Array<{
        pregunta: string
        contenido?: string
        presente: 'si' | 'no' | 'parcial'
        justificacion: string
      }> = [
          {
            pregunta: "Población / Contexto",
            contenido: pico.population?.descripcion || "",
            presente: "si",
            justificacion: `ES: ${pico.population?.justificacion || 'El tema define claramente el contexto de aplicación'}`
          },
          {
            pregunta: "Intervención / Tecnología",
            contenido: pico.intervention?.descripcion || "",
            presente: "si",
            justificacion: `ES: ${pico.intervention?.justificacion || 'La tecnología o fenómeno de interés está especificado'}`
          },
          {
            pregunta: "Comparación",
            contenido: pico.comparison?.descripcion || "No especificado",
            presente: pico.comparison?.descripcion ? "si" : "parcial",
            justificacion: pico.comparison?.descripcion
              ? `ES: ${pico.comparison?.justificacion || 'Se definen comparadores explícitos'}`
              : "NO ES explícito: El tema no menciona comparadores directos, aunque se pueden inferir alternativas"
          },
          {
            pregunta: "Outcomes / Resultados",
            contenido: pico.outcomes?.descripcion || "",
            presente: "si",
            justificacion: `ES: ${pico.outcomes?.justificacion || 'Los resultados esperados están claramente definidos'}`
          }
        ]
      const mappedPico = {
        population: pico.population?.descripcion || data.pico?.population || "Población del sistema objetivo",
        intervention: pico.intervention?.descripcion || data.pico?.intervention || "Herramienta o metodología principal",
        comparison: pico.comparison?.descripcion || data.pico?.comparison || "Estado del arte o enfoques tradicionales",
        outcome: pico.outcomes?.descripcion || pico.outcome?.descripcion || data.pico?.outcome || "Métricas de rendimiento o mejora"
      }

      // Con el PICO generado, generar automáticamente las preguntas de investigación (RQs)
      toast({
        title: "PICO completado",
        description: "Generando preguntas de investigación a partir de los datos PICO..."
      })
      let derivedRQs: string[] = []
      try {
        if (currentProjectId) {
          const rqResult = await apiClient.generateResearchQuestions(currentProjectId, mappedPico)
          if (rqResult?.researchQuestions && Array.isArray(rqResult.researchQuestions)) {
            derivedRQs = rqResult.researchQuestions
          }
        }
      } catch (err) {
        console.error("Error derivando RQs automáticamente:", err)
        toast({
          title: "Generación Parcial",
          description: "Se generó la matriz correctamente, pero hubo un error al derivar las Preguntas de Investigación (RQs). Intenta generarlas manualmente o recarga la página.",
          variant: "destructive",
        })
      }

      updateData({
        pico: mappedPico,
        matrixTable: tablaUnificada, // Tabla unificada PICO + Es/No Es
        matrixIsNot: {
          is: matrizData.es || [],
          isNot: matrizData.no_es || []
        },
        researchQuestions: derivedRQs, // Guardando las Preguntas de Investigación generadas
        aiProvider: 'chatgpt'
      })
      toast({
        title: "✅ Análisis finalizado",
        description: `Se han configurado tu PICO, la Matriz Es/No Es y generado ${derivedRQs.length} RQs.`
      })
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "No se pudo generar el análisis",
        variant: "destructive"
      })
    } finally {
      setIsGenerating(false)
    }
  }

  const handleGenerateRQsOnly = async () => {
    if (!data.projectId || !data.pico) {
      toast({
        title: "Falta Contexto",
        description: "Necesitas generar primero el marco PICO antes de derivar las RQs.",
        variant: "destructive"
      })
      return
    }

    setIsGenerating(true)
    toast({
      title: "Generando RQs...",
      description: "Conectando con IA para derivar tus preguntas de investigación."
    })

    try {
      const rqResult = await apiClient.generateResearchQuestions(data.projectId, data.pico)
      if (rqResult?.researchQuestions && Array.isArray(rqResult.researchQuestions)) {
        updateData({ researchQuestions: rqResult.researchQuestions })
        toast({
          title: "Éxito",
          description: `Se han generado ${rqResult.researchQuestions.length} RQs exitosamente.`
        })
      } else {
        throw new Error("El formato de respuesta de la IA no es válido.")
      }
    } catch (err: any) {
      console.error("Error al derivar RQs:", err)
      toast({
        title: "Error Generando RQs",
        description: err.message || "No se pudo derivar con IA. Inténtalo de nuevo.",
        variant: "destructive"
      })
    } finally {
      setIsGenerating(false)
    }
  }

  const handleStartEditRQ = (index: number, value: string) => {
    setEditingRQIndex(index)
    setEditRQValue(value)
  }

  const handleSaveEditRQ = (index: number) => {
    if (!data.researchQuestions) return
    const updatedRQs = [...data.researchQuestions]
    updatedRQs[index] = editRQValue
    updateData({ researchQuestions: updatedRQs })
    setEditingRQIndex(null)
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="text-center space-y-3 mb-8">
        <h2 className="text-2xl font-bold">PICO + Matriz Es/No Es</h2>
        <p className="text-base text-muted-foreground">
          Estructura tu pregunta y delimita el alcance de tu investigación
        </p>
      </div>

      {/* Texto Introductorio */}
      <Alert className="border-blue-300 dark:border-blue-700">
        <Info className="h-5 w-5 text-blue-600 dark:text-blue-400" />
        <AlertDescription className="text-sm text-foreground leading-relaxed">
          <p className="font-semibold mb-2">Análisis Preliminar Integrado</p>
          <p>
            En esta sección se genera el <strong>análisis preliminar del tema</strong> mediante la integración del{' '}
            <strong>Marco PICO</strong> y la <strong>Matriz Es/No Es</strong>, con el objetivo de clarificar la población,
            intervención, comparadores y resultados esperados, así como validar qué elementos están presentes o ausentes
            en la pregunta de investigación.
          </p>
          <p className="mt-2">
            Una vez que hagas clic en "Generar", se creará automáticamente la <strong>tabla unificada</strong> con
            población, contenido generado por IA y la justificación Es/No Es.
          </p>
        </AlertDescription>
      </Alert>

      {/* AI Generation Panel */}
      <Card className="border-2 border-primary/20">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            <CardTitle className="text-foreground">Generar automáticamente con IA</CardTitle>
          </div>
          <CardDescription className="text-muted-foreground">
            La IA analizará tu propuesta y generará la tabla unificada PICO + Es/No Es
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            onClick={handleGenerateWithAI}
            disabled={isGenerating}
            size="lg"
            className="w-full"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                Generando análisis completo...
              </>
            ) : (
              <>
                <Sparkles className="h-5 w-5 mr-2" />
                Generar PICO + Matriz
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Tabla Unificada PICO + Es/No Es - Solo visible después de generar */}
      {data.matrixTable && data.matrixTable.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Tabla Unificada: Marco PICO + Matriz Es/No Es</CardTitle>
            <CardDescription>
              Análisis integrado de la población, intervención, comparadores y resultados esperados
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b-2 bg-muted">
                      <th className="text-left p-4 font-semibold text-foreground w-1/5">
                        Componente PICO
                      </th>
                      <th className="text-left p-4 font-semibold text-foreground w-1/3">
                        Contenido Generado por IA
                      </th>
                      <th className="text-left p-4 font-semibold text-foreground w-5/12">
                        Justificación (Es / No Es)
                      </th>
                      <th className="text-center p-4 font-semibold text-foreground w-16">
                        Editar
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.matrixTable.map((elemento, index) => {
                      const { icon, label } = getPicoComponent(elemento.pregunta)
                      const isEditing = editingIndex === index
                      const picoValues = [data.pico.population, data.pico.intervention, data.pico.comparison, data.pico.outcome]
                      const cellContent = elemento.contenido || picoValues[index] || ""
                      return (
                        <tr key={`pico-${label}-${index}`} className="border-b hover:bg-muted/30 transition-colors">
                          <td className="p-4 align-top">
                            <div className="flex items-start gap-2">
                              <span className="font-semibold text-primary text-base">
                                {icon}
                              </span>
                              <div>
                                <span className="font-bold text-sm">
                                  {label}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="p-4 align-top">
                            {isEditing ? (
                              <Textarea
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                className="min-h-[100px] text-sm"
                                autoFocus
                              />
                            ) : (
                              <p className="text-sm leading-relaxed">
                                {cellContent}
                              </p>
                            )}
                          </td>
                          <td className="p-4 align-top">
                            <div className="flex items-start gap-2">
                              {elemento.presente === 'si' && (
                                <span className="text-green-600 dark:text-green-400 font-bold flex-shrink-0 mt-0.5">
                                  ES:
                                </span>
                              )}
                              {elemento.presente === 'no' && (
                                <span className="text-red-600 dark:text-red-400 font-bold flex-shrink-0 mt-0.5">
                                  NO ES:
                                </span>
                              )}
                              {elemento.presente === 'parcial' && (
                                <span className="text-amber-600 dark:text-amber-400 font-bold flex-shrink-0 mt-0.5">
                                  PARCIAL:
                                </span>
                              )}
                              <span className="text-sm text-muted-foreground leading-relaxed">
                                {elemento.justificacion}
                              </span>
                            </div>
                          </td>
                          <td className="p-4 align-top text-center">
                            {isEditing ? (
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-100 dark:hover:bg-green-900/30"
                                onClick={() => handleSaveEdit(index)}
                                title="Guardar"
                              >
                                <Save className="h-4 w-4" />
                              </Button>
                            ) : (
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                onClick={() => handleStartEdit(index, cellContent)}
                                title="Editar contenido"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <Alert className="border-amber-300 dark:border-amber-700">
                <Info className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                <AlertDescription className="text-sm text-foreground">
                  <p className="font-semibold mb-1">Nota Metodológica:</p>
                  <p>
                    El marco PICO se realizó integrando la matriz Es/No Es con otros marcos metodológicos,
                    no solo PICO, para mejorar y validar el planteamiento de la pregunta de investigación según
                    las guías <strong>PRISMA 2020</strong> y <strong>Cochrane</strong>.
                    Puedes <strong>editar cada campo</strong> haciendo clic en el ícono de lápiz (✏️) si necesitas
                    ajustar el contenido generado por la IA.
                  </p>
                </AlertDescription>
              </Alert>

              {/* Lista de RQs integrada dentro del diseño de la matriz (Siempre Visible luego de PICO) */}
              {data.matrixTable && data.matrixTable.length > 0 && (
                <div className="space-y-4 pt-8 border-t mt-8 border-border/50">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-2 px-1">
                    <div className="flex items-center gap-2">
                      <ListChecks className="h-6 w-6 text-primary" />
                      <h3 className="text-xl font-bold">Preguntas Propuestas (RQs) - En base a matriz</h3>
                    </div>
                  </div>

                  <Alert className="bg-blue-50/50 border-blue-100 text-blue-900 mb-6">
                    <Info className="h-4 w-4 text-blue-600" />
                    <AlertDescription>
                      <span className="font-semibold block mb-1">¿Por qué de la mano con PICO?</span>
                      Las RQs definen el alcance final de tu investigación basadas directamente en tu población e intervención. Cada pregunta generada explora una dimensión específica.
                    </AlertDescription>
                  </Alert>

                  {(!data.researchQuestions || data.researchQuestions.length === 0) ? (
                    <div className="text-center p-8 border border-dashed rounded-lg bg-muted/20">
                      <p className="text-muted-foreground mb-4">La Inteligencia Artificial no derivó las preguntas en la primera pasada o están pendientes.</p>
                      <div className="flex flex-col sm:flex-row justify-center gap-4">
                        <Button
                          onClick={handleGenerateRQsOnly}
                          disabled={isGenerating}
                          className="bg-primary text-primary-foreground hover:bg-primary/90"
                        >
                          {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Brain className="mr-2 h-4 w-4" />}
                          Generar RQs con Gemini IA
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {data.researchQuestions.map((rq, index) => (
                        <Card key={index} className="group hover:border-primary/40 transition-all duration-300 bg-muted/10 shadow-sm border border-border/60">
                          <CardContent className="p-5">
                            <div className="flex items-start gap-4">
                              <div className="bg-primary/10 text-primary font-bold rounded-full h-8 w-8 flex items-center justify-center shrink-0 mt-1">
                                {index + 1}
                              </div>

                              <div className="flex-1 space-y-3">
                                {editingRQIndex === index ? (
                                  <div className="space-y-3">
                                    <Textarea
                                      value={editRQValue}
                                      onChange={(e) => setEditRQValue(e.target.value)}
                                      className="min-h-[80px] text-base leading-relaxed focus:ring-2 focus:ring-primary/20 bg-background"
                                      placeholder="Escribe tu pregunta de investigación aquí..."
                                      autoFocus
                                    />
                                    <div className="flex justify-end gap-2">
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setEditingRQIndex(null)}
                                      >
                                        Cancelar
                                      </Button>
                                      <Button
                                        size="sm"
                                        onClick={() => handleSaveEditRQ(index)}
                                        className="bg-green-600 hover:bg-green-700"
                                      >
                                        <Save className="h-4 w-4 mr-2" />
                                        Guardar
                                      </Button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex justify-between items-start gap-4">
                                    <p className="text-base font-medium leading-relaxed text-foreground">
                                      {rq}
                                    </p>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 text-muted-foreground hover:text-primary"
                                      onClick={() => handleStartEditRQ(index, rq)}
                                    >
                                      <Pencil className="h-4 w-4" />
                                    </Button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}

                  <div className="bg-muted/30 border rounded-lg p-3 flex gap-3 items-start mt-4">
                    <Info className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                    <p className="text-xs text-muted-foreground italic">
                      Estas preguntas son el núcleo de la investigación y se utilizarán en todas las derivaciones subsiguientes.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

