"use client"

import React, { useState, useEffect } from "react"
import { useWizard } from "../wizard-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

import {
  Sparkles,
  Loader2,
  Search,
  Copy,
  AlertCircle,
  CheckCircle2,
  Database,
  Upload,
  Save,
  Edit,
  Check,
  X,
  Trash2
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { apiClient } from "@/lib/api-client"
import { ImportReferencesButton } from "@/components/screening/import-references-button"
import { ManualReferenceDialog } from "./manual-reference-dialog"
import { Plus } from "lucide-react"

// Wrapper component para manejar la creación de proyecto temporal antes de la importación
interface ImportReferencesWrapperProps {
  query: any
  data: any
  updateData: (updates: any) => void
  createTemporaryProjectForImport: () => Promise<string> | Promise<void>
  setImportedCounts: React.Dispatch<React.SetStateAction<Record<string, number>>>
  importedCounts: Record<string, number>
  toast: any
}

function ImportReferencesWrapper({
  query,
  data,
  updateData,
  createTemporaryProjectForImport,
  setImportedCounts,
  importedCounts,
  toast
}: ImportReferencesWrapperProps) {
  const [isCreatingProject, setIsCreatingProject] = useState(false)

  const handleImportClick = async () => {
    if (data.projectId) {
      // Proyecto ya existe, proceder normalmente
      return
    }

    // Crear proyecto temporal antes de la importación
    setIsCreatingProject(true)
    try {
      await createTemporaryProjectForImport()
    } catch (error) {
      console.error('Error creando proyecto para importación:', error)
      return // Abortar importación si falla crear proyecto
    } finally {
      setIsCreatingProject(false)
    }
  }

  const projectId = data.projectId
  const [showManualDialog, setShowManualDialog] = useState(false)

  const handleManualSuccess = (count: number) => {
    // Actualizar contador local usando clave compuesta databaseId + block
    const countKey = query.block ? `${query.databaseId}_${query.block}` : query.databaseId;
    setImportedCounts((prev: any) => ({
      ...prev,
      [countKey]: (prev[countKey] || 0) + count
    }))

    // Agregar a uploadedFiles para que el sistema sepa que hay datos
    const manualEntry = {
      filename: `manual_entry_${query.databaseName}.csv`,
      format: 'manual',
      recordCount: count,
      uploadedAt: new Date().toISOString(),
      databaseId: query.databaseId,
      databaseName: query.databaseName,
      data: []
    }

    updateData({
      searchPlan: {
        ...data.searchPlan,
        uploadedFiles: [
          ...(data.searchPlan?.uploadedFiles || []),
          manualEntry
        ]
      }
    })
  }

  return (
    <div className="text-center">
      {projectId ? (
        <>
          <ImportReferencesButton
            projectId={projectId}
            size="sm"
            showLabel={true}
            onImportSuccess={(count: number, fileInfo?: any) => {
              // Actualizar contador local usando clave compuesta databaseId + block
              const countKey = query.block ? `${query.databaseId}_${query.block}` : query.databaseId;
              setImportedCounts((prev: any) => ({
                ...prev,
                [countKey]: (prev[countKey] || 0) + count
              }))

              // Actualizar uploadedFiles en el context
              const newUploadedFile = {
                filename: fileInfo?.filename || `import_${query.databaseName}.csv`,
                format: fileInfo?.format || 'csv',
                recordCount: count,
                uploadedAt: new Date().toISOString(),
                databaseId: query.databaseId,
                databaseName: query.databaseName,
                data: []
              }

              updateData({
                searchPlan: {
                  ...data.searchPlan,
                  uploadedFiles: [
                    ...(data.searchPlan?.uploadedFiles || []),
                    newUploadedFile
                  ]
                }
              })

              toast({
                title: "✅ Referencias importadas",
                description: `${count} referencias cargadas de ${query.databaseName}`
              })
            }}
          />
          
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.preventDefault()
              setShowManualDialog(true)
            }}
            className="w-full text-[10px] h-7 mt-2"
          >
            <Plus className="h-3 w-3 mr-1" />
            Manual
          </Button>

          <ManualReferenceDialog
            projectId={projectId}
            databaseId={query.databaseId}
            databaseName={query.databaseName}
            open={showManualDialog}
            onOpenChange={setShowManualDialog}
            onSuccess={handleManualSuccess}
          />
        </>
      ) : (
        <div className="flex flex-col gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={isCreatingProject}
            onClick={async (e) => {
              e.preventDefault()
              await handleImportClick()
            }}
            className="w-full"
          >
            {isCreatingProject ? (
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            ) : (
              <Upload className="h-3 w-3 mr-1" />
            )}
            Cargar
          </Button>
          
          <Button
            size="sm"
            variant="ghost"
            disabled={isCreatingProject}
            onClick={async (e) => {
              e.preventDefault()
              if (!projectId) {
                await handleImportClick()
              }
              setShowManualDialog(true)
            }}
            className="w-full text-[10px] h-7"
          >
            <Plus className="h-3 w-3 mr-1" />
            Manual
          </Button>

          {projectId && (
            <ManualReferenceDialog
              projectId={projectId}
              databaseId={query.databaseId}
              databaseName={query.databaseName}
              open={showManualDialog}
              onOpenChange={setShowManualDialog}
              onSuccess={handleManualSuccess}
            />
          )}
        </div>
      )}
      {(() => {
        const countKey = query.block ? `${query.databaseId}_${query.block}` : query.databaseId;
        const count = importedCounts[countKey] || 0;
        return count > 0 && (
          <div className="text-xs text-green-600 mt-1">
            ✅ {count} referencias
          </div>
        );
      })()}
    </div>
  )
}

// Mapa de iconos para bases de datos
const DATABASE_ICONS: Record<string, string> = {
  scopus: "🔵",
  ieee: "⚡",
  acm: "💻",
  springer: "📚",
  arxiv: "📄",
  pubmed: "🏥",
  embase: "💊",
  cochrane: "🩺",
  eric: "📖",
  psycinfo: "🧠",
  webofscience: "🌐",
  google_scholar: "🔍",
  sciencedirect: "🔬",
  cinahl: "💉",
  econlit: "💰",
  jstor: "📜",
  sage: "📘",
  avery: "🏛️",
  taylor: "📗",
  wiley: "📙"
}

// URLs de búsqueda avanzada por base de datos
const DATABASE_ADVANCED_SEARCH_URLS: Record<string, string> = {
  // Ingeniería y Tecnología
  ieee: "https://ieeexplore.ieee.org/search/advanced",
  acm: "https://dl.acm.org/search/advanced",
  scopus: "https://www.scopus.com/search/form.uri?display=advanced",
  sciencedirect: "https://www.sciencedirect.com/search/advanced",
  springer: "https://link.springer.com/advanced-search",
  wiley: "https://onlinelibrary.wiley.com/advanced/search",
  webofscience: "https://www.webofscience.com/wos/woscc/advanced-search",

  // Medicina y Ciencias de la Salud
  pubmed: "https://pubmed.ncbi.nlm.nih.gov/advanced/",
  cinahl: "https://www.ebsco.com/products/research-databases/cinahl-database",
  cochrane: "https://www.cochranelibrary.com/advanced-search",
  embase: "https://www.embase.com/search/advanced",
  lilacs: "https://lilacs.bvsalud.org/en/",
  psycinfo: "https://www.apa.org/pubs/databases/psycinfo",

  // Ciencias Sociales y Humanidades
  eric: "https://eric.ed.gov/?advanced",
  jstor: "https://www.jstor.org/action/doAdvancedSearch",
  sage: "https://journals.sagepub.com/action/doSearch",
  taylor: "https://www.tandfonline.com/action/advancedSearch",
  econlit: "https://www.aeaweb.org/econlit",
  sociological: "https://journals.sagepub.com/home/abs",

  // Arquitectura, Diseño y Urbanismo
  avery: "https://library.columbia.edu/libraries/avery.html",
  artbibliographies: "https://about.proquest.com/en/products-services/art_sales/",
  designandapplied: "https://about.proquest.com/en/products-services/daai/",

  // Generales
  google_scholar: "https://scholar.google.com/advanced_scholar_search",
  doaj: "https://doaj.org/search",
  arxiv: "https://arxiv.org/search/advanced"
}

// Nombres de áreas (para display)
const ACADEMIC_DATABASES: Record<string, { name: string }> = {
  'ingenieria-tecnologia': { name: '🟦 Ingeniería y Tecnología' },
  'medicina-salud': { name: '🟥 Medicina y Ciencias de la Salud' },
  'ciencias-sociales': { name: '🟩 Ciencias Sociales y Humanidades' },
  'arquitectura-diseño': { name: '🟪 Arquitectura, Diseño y Urbanismo' }
}

export function SearchPlanStep() {
  const { data, updateData } = useWizard()
  const { toast } = useToast()

  const [selectedDatabases, setSelectedDatabases] = useState<string[]>(
    (data.searchPlan?.databases as any[])?.map((db: any) => typeof db === 'string' ? db : (db.id || db.name.toLowerCase().replace(/\s+/g, '_'))) || []
  )
  const [queries, setQueries] = useState<any[]>(data.searchPlan?.searchQueries || [])
  const [isGenerating, setIsGenerating] = useState(false)
  const [countingDatabases, setCountingDatabases] = useState<Set<string>>(new Set())
  const [availableDatabases, setAvailableDatabases] = useState<any[]>([])
  const [disabledDatabases, setDisabledDatabases] = useState<string[]>([]) // Bases de datos que el usuario no puede usar
  const [loadingDatabases, setLoadingDatabases] = useState(false)
  const [detectedArea, setDetectedArea] = useState<string>("")
  const [importedCounts, setImportedCounts] = useState<Record<string, number>>({})
  const [editedQueries, setEditedQueries] = useState<Set<string>>(new Set())
  const [showRegenerateDialog, setShowRegenerateDialog] = useState(false)
  const [editingQueries, setEditingQueries] = useState<Set<string>>(new Set())
  const [isFragmentedMode, setIsFragmentedMode] = useState<boolean>(data.searchPlan?.isFragmentedMode || false)

  // 🔍 LOG INICIAL
  // Cargar bases de datos filtradas por área de investigación
  useEffect(() => {
    const fetchDatabasesByArea = async () => {
      if (!data.researchArea) {
        toast({
          title: "⚠️ Falta seleccionar área",
          description: "Por favor, volvé al Paso 1 y seleccioná un área de investigación del dropdown",
          variant: "destructive",
          duration: 5000
        })
        setLoadingDatabases(false)
        return
      }
      setLoadingDatabases(true)

      try {
        const result = await apiClient.request('/api/ai/detect-research-area', {
          method: 'POST',
          body: JSON.stringify({
            researchArea: data.researchArea,
            description: data.projectDescription
          })
        })
        if (result.success && result.data) {
          setDetectedArea(result.data.detectedArea)
          setAvailableDatabases(result.data.databases.map((db: any) => ({
            id: db.id,
            name: db.name,
            url: db.url,
            icon: DATABASE_ICONS[db.id] || "📚",
            hasAPI: ['scopus', 'ieee', 'pubmed', 'springer'].includes(db.id),
            requiresPremium: db.requiresPremium || false,
            premiumNote: db.premiumNote || null
          })))
        }
      } catch (error) {
        console.error('⚠️ Error llamando al backend, usando bases de datos locales:', error)

        // FALLBACK: Usar bases de datos predefinidas localmente
        const localDatabases = getLocalDatabasesByArea(data.researchArea)
        setDetectedArea(data.researchArea)
        setAvailableDatabases(localDatabases)
        toast({
          title: "📚 Bases de datos cargadas",
          description: `Se cargaron ${localDatabases.length} bases de datos para ${ACADEMIC_DATABASES[data.researchArea]?.name || data.researchArea}`,
          duration: 3000
        })
      } finally {
        setLoadingDatabases(false)
      }
    }

    fetchDatabasesByArea()
  }, [data.researchArea])

  // Función fallback para obtener bases de datos localmente
  const getLocalDatabasesByArea = (area: string) => {
    const databasesByArea: Record<string, any[]> = {
      'ingenieria-tecnologia': [
        { id: 'scopus', name: 'Scopus', url: 'https://www.scopus.com', hasAPI: false },
        { id: 'ieee', name: 'IEEE Xplore', url: 'https://ieeexplore.ieee.org', hasAPI: false },
        { id: 'acm', name: 'ACM Digital Library', url: 'https://dl.acm.org', hasAPI: false },
        { id: 'springer', name: 'Springer Link', url: 'https://link.springer.com', hasAPI: false },
        { id: 'sciencedirect', name: 'ScienceDirect', url: 'https://www.sciencedirect.com', hasAPI: false },
        { id: 'webofscience', name: 'Web of Science', url: 'https://www.webofscience.com', hasAPI: false }
      ],
      'medicina-salud': [
        { id: 'pubmed', name: 'PubMed', url: 'https://pubmed.ncbi.nlm.nih.gov', hasAPI: false },
        { id: 'scopus', name: 'Scopus', url: 'https://www.scopus.com', hasAPI: false },
        { id: 'embase', name: 'Embase', url: 'https://www.embase.com', hasAPI: false },
        { id: 'cochrane', name: 'Cochrane Library', url: 'https://www.cochranelibrary.com', hasAPI: false },
        { id: 'cinahl', name: 'CINAHL', url: 'https://www.ebsco.com/products/research-databases/cinahl-database', hasAPI: false },
        { id: 'webofscience', name: 'Web of Science', url: 'https://www.webofscience.com', hasAPI: false }
      ],
      'ciencias-sociales': [
        { id: 'scopus', name: 'Scopus', url: 'https://www.scopus.com', hasAPI: false },
        { id: 'webofscience', name: 'Web of Science', url: 'https://www.webofscience.com', hasAPI: false },
        { id: 'eric', name: 'ERIC', url: 'https://eric.ed.gov', hasAPI: false },
        { id: 'psycinfo', name: 'PsycINFO', url: 'https://www.apa.org/pubs/databases/psycinfo', hasAPI: false },
        { id: 'jstor', name: 'JSTOR', url: 'https://www.jstor.org', hasAPI: false },
        { id: 'sage', name: 'SAGE Journals', url: 'https://journals.sagepub.com', hasAPI: false }
      ],
      'arquitectura-diseño': [
        { id: 'scopus', name: 'Scopus', url: 'https://www.scopus.com', hasAPI: false },
        { id: 'avery', name: 'Avery Index', url: 'https://www.averyindex.com', hasAPI: false },
        { id: 'jstor', name: 'JSTOR', url: 'https://www.jstor.org', hasAPI: false },
        { id: 'taylor', name: 'Taylor & Francis', url: 'https://www.tandfonline.com', hasAPI: false },
        { id: 'springer', name: 'Springer Link', url: 'https://link.springer.com', hasAPI: true },
        { id: 'webofscience', name: 'Web of Science', url: 'https://www.webofscience.com', hasAPI: false }
      ]
    }

    const databases = databasesByArea[area] || databasesByArea['ingenieria-tecnologia']

    return databases.map(db => ({
      ...db,
      icon: DATABASE_ICONS[db.id] || "📚"
    }))
  }

  // VALIDAR PROYECTO EXISTENTE: Verificar que existe proyecto antes de importar referencias
  // Ya no crear proyecto temporal - usar el proyecto creado en step 3
  const createTemporaryProjectForImport = async () => {
    // Verificar si ya existe projectId (creado en step 3)
    if (data.projectId) {
      return data.projectId
    }

    // Si no existe proyecto, significa que el usuario se saltó el step 3 o hubo un error
    throw new Error('Debes seleccionar un título en el paso anterior para crear el proyecto antes de importar referencias')
  }

  // Sincronizar con context
  useEffect(() => {
    if (queries.length > 0) {
      updateData({
        searchPlan: {
          ...data.searchPlan,
          databases: selectedDatabases as any,
          searchQueries: queries as any
        }
      })
    }
  }, [queries, selectedDatabases])

  // Función para eliminar una base de datos ya seleccionada
  const removeDatabaseFromSelection = (databaseId: string) => {
    // Validar que no sea la última base de datos
    if (selectedDatabases.length === 1) {
      toast({
        title: "⚠️ No se puede eliminar",
        description: "Debes mantener al menos una base de datos seleccionada",
        variant: "destructive"
      })
      return
    }

    // Remover de bases seleccionadas
    setSelectedDatabases(prev => prev.filter(id => id !== databaseId))

    // Remover queries relacionadas
    const updatedQueries = queries.filter(q => q.databaseId !== databaseId)
    setQueries(updatedQueries)

    // Remover contador de importaciones (incluyendo bloques)
    setImportedCounts(prev => {
      const newCounts = { ...prev }
      delete newCounts[databaseId]
      delete newCounts[`${databaseId}_A`]
      delete newCounts[`${databaseId}_B`]
      delete newCounts[`${databaseId}_U`]
      return newCounts
    })

    // Actualizar contexto del wizard
    updateData({
      searchPlan: {
        ...data.searchPlan,
        databases: selectedDatabases.filter(id => id !== databaseId) as any,
        searchQueries: updatedQueries as any,
        uploadedFiles: (data.searchPlan?.uploadedFiles || []).filter(
          (file: any) => file.databaseId !== databaseId
        )
      }
    })

    const dbName = availableDatabases.find(db => db.id === databaseId)?.name || databaseId
    toast({
      title: "✅ Base de datos eliminada",
      description: `${dbName} ha sido removida de tu selección`
    })
  }

  const toggleDatabase = (dbId: string) => {
    if (disabledDatabases.includes(dbId)) {
      // No permitir seleccionar bases de datos deshabilitadas
      return
    }

    setSelectedDatabases(prev =>
      prev.includes(dbId) ? prev.filter(id => id !== dbId) : [...prev, dbId]
    )
  }

  const handleGenerateQueries = async (forceFragmented = false) => {
    if (selectedDatabases.length === 0) {
      toast({
        title: "⚠️ Selecciona bases de datos",
        description: "Debes seleccionar al menos una base de datos",
        variant: "destructive"
      })
      return
    }

    if (!data.protocolTerms?.tecnologia?.length && !data.protocolTerms?.dominio?.length) {
      toast({
        title: "⚠️ Faltan términos del protocolo",
        description: "Debes completar el Paso 4 (Definición) primero",
        variant: "destructive"
      })
      return
    }

    const useFragmented = typeof forceFragmented === 'boolean' ? forceFragmented : isFragmentedMode;

    setIsGenerating(true)
    try {
      toast({
        title: "🔄 Generando cadenas de búsqueda...",
        description: `Para ${selectedDatabases.length} bases de datos${useFragmented ? ' (Modo Fragmentado)' : ''}`
      })
      const result = await apiClient.generateSearchQueries(
        data.protocolTerms,
        data.pico,
        selectedDatabases,
        data.researchArea,
        data.matrixIsNot,
        data.yearStart,
        data.yearEnd,
        data.selectedTitle,
        useFragmented
      )
      // Log de cada query individual
      if (result?.queries) {
        result.queries.forEach((q: any, i: number) => {
        })
      }

      if (result?.queries && Array.isArray(result.queries)) {
        // Transformar la respuesta del backend
        const formattedQueries = result.queries.map((q: any) => {
          // Buscar el ID correcto desde availableDatabases comparando el nombre
          const matchedDb = availableDatabases.find(db =>
            db.name.toLowerCase() === q.database.toLowerCase() ||
            db.id.toLowerCase() === q.database.toLowerCase().replace(/\s+/g, '')
          )
          const dbId = matchedDb?.id || q.database.toLowerCase().replace(/\s+/g, '_')

          const formatted = {
            databaseId: dbId,
            databaseName: q.database,
            block: q.block || null,
            query: q.query,
            explanation: q.explanation || '',
            terms: q.terms || [],
            filters: q.filters || [],
            estimatedResults: null,
            status: null,
            resultCount: null,
            hasAPI: matchedDb?.hasAPI || false
          }
          return formatted
        })

        // PRESERVAR QUERIES QUE YA TENÍAN RESULTADOS
        // Si ya había queries con resultados cargados, las mantenemos en la lista
        const queriesWithResults = queries.filter(q => {
          const countKey = q.block ? `${q.databaseId}_${q.block}` : q.databaseId;
          return importedCounts[countKey] > 0 || (q.uploadedFiles && q.uploadedFiles.length > 0);
        });

        // Combinar: Filtramos las nuevas para no duplicar si ya están en queriesWithResults
        // (Aunque normalmente el generador reemplaza todo, esto permite "convivencia")
        const finalQueries = [...queriesWithResults];
        
        formattedQueries.forEach((newQ: any) => {
          const exists = finalQueries.some(q => 
            q.databaseId === newQ.databaseId && 
            q.block === newQ.block
          );
          if (!exists) {
            finalQueries.push(newQ);
          }
        });

        // VERIFICACIÓN AUTOMÁTICA SCOPUS (SOLO SI NO ESTÁ FRAGMENTADO AÚN)
        if (!useFragmented) {
          const scopusQuery = formattedQueries.find((q: any) => q.databaseId === 'scopus');
          if (scopusQuery && data.pico?.comparison && data.pico.comparison !== 'N/A') {
            try {
              toast({
                title: "🔍 Verificando sensibilidad...",
                description: "Consultando volumen de resultados en Scopus."
              });
              const countResult = await apiClient.scopusCount(scopusQuery.query);
              if (countResult && countResult.count !== undefined && countResult.count < 10) {
                toast({
                  title: "⚠️ Escasa evidencia detectada",
                  description: `Se detectaron pocos resultados (${countResult.count}). Activando Protocolo de Búsqueda Fragmentada...`,
                  variant: "destructive"
                });
                setIsFragmentedMode(true);
                
                // Modificar criterios temporalmente
                const currentInclusion = data.inclusionCriteria || [];
                const fragmentedCriterion = "ESTUDIOS INDEPENDIENTES: Estudios que analicen el rendimiento de la Intervención o del Comparador de forma independiente (Comparación Indirecta).";
                
                if (!currentInclusion.includes(fragmentedCriterion)) {
                  updateData({
                    inclusionCriteria: [...currentInclusion, fragmentedCriterion]
                  });
                }
                
                // Si la búsqueda unificada ya tenía resultados, los preservamos antes de re-generar
                if (countResult.count > 0) {
                   setQueries(finalQueries);
                }

                // Reiniciar el spinner oculto de la nueva llamada
                setIsGenerating(false);
                return handleGenerateQueries(true);
              }
            } catch (err) {
              console.error("Scopus count fail, proceeding normally:", err);
            }
          }
        }

        setQueries(finalQueries)

        // También actualizar el wizard context
        updateData({
          searchPlan: {
            ...data.searchPlan,
            searchQueries: finalQueries,
            isFragmentedMode: useFragmented
          }
        })

        toast({
          title: "✅ Cadenas generadas exitosamente",
          description: `${formattedQueries.length} consultas listas para usar`
        })
      } else {
        console.error('❌ Formato de respuesta inválido:', result)
        toast({
          title: "❌ Error de formato",
          description: "La respuesta del servidor no tiene el formato esperado",
          variant: "destructive"
        })
      }
    } catch (error: any) {
      console.error("Error generando queries:", error)
      toast({
        title: "❌ Error",
        description: error.message || "No se pudieron generar las cadenas",
        variant: "destructive"
      })
    } finally {
      setIsGenerating(false)
    }
  }

  // Funcionalidad de conteo API deshabilitada - importación manual
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast({
      title: "📋 Copiado",
      description: "Cadena de búsqueda copiada al portapapeles"
    })
  }

  const enableEditMode = (databaseId: string, block?: string) => {
    const key = block ? `${databaseId}_${block}` : `${databaseId}_U`;
    setEditingQueries(prev => new Set(prev).add(key))
  }

  const cancelEditMode = (databaseId: string, block?: string) => {
    const key = block ? `${databaseId}_${block}` : `${databaseId}_U`;
    setEditingQueries(prev => {
      const newSet = new Set(prev)
      newSet.delete(key)
      return newSet
    })
    // Recargar el query original si no se guardó
    const originalQuery = (data.searchPlan?.searchQueries as any[])?.find((q: any) => 
      q.databaseId === databaseId && q.block === block
    )
    if (originalQuery) {
      setQueries(prev => prev.map(q =>
        (q.databaseId === databaseId && q.block === block) ? originalQuery : q
      ))
    }
  }

  const saveEditedQuery = (databaseId: string, block?: string) => {
    const key = block ? `${databaseId}_${block}` : `${databaseId}_U`;
    const currentQuery = queries.find(q => q.databaseId === databaseId && q.block === block)
    if (currentQuery) {
      // Marcar como editado
      setEditedQueries(prev => new Set(prev).add(key))

      // Guardar en el context
      updateData({
        searchPlan: {
          ...data.searchPlan,
          searchQueries: queries
        }
      })

      toast({
        title: "✅ Cambios guardados",
        description: `Cadena de ${currentQuery.databaseName} actualizada`
      })
    }

    // Salir del modo edición
    setEditingQueries(prev => {
      const newSet = new Set(prev)
      newSet.delete(key)
      return newSet
    })
  }

  const handleQueryEdit = (databaseId: string, block: string | undefined, newQuery: string) => {
    // Actualizar el query en el estado local (temporal hasta que se guarde)
    const updatedQueries = queries.map(q =>
      (q.databaseId === databaseId && q.block === block) ? { ...q, query: newQuery } : q
    )
    setQueries(updatedQueries)
  }

  const handleRegenerateConfirmation = () => {
    if (queries.length > 0 && editedQueries.size > 0) {
      setShowRegenerateDialog(true)
    } else {
      handleGenerateQueries(isFragmentedMode)
    }
  }

  const handleConfirmedRegenerate = () => {
    setShowRegenerateDialog(false)
    setEditedQueries(new Set())
    handleGenerateQueries(isFragmentedMode)
  }

  const forceFragmentedMode = () => {
    setIsFragmentedMode(true);
    handleGenerateQueries(true);
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="text-center space-y-3 mb-8">
        <h2 className="text-2xl font-bold">Estrategia de Búsqueda</h2>
        <p className="text-base text-muted-foreground">
          Define las bases de datos académicas y las cadenas de búsqueda para tu revisión
        </p>
      </div>

      {/* SELECCIÓN DE BASES DE DATOS */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Seleccionar Bases de Datos
          </CardTitle>
          <CardDescription>
            {detectedArea && (
              <Badge variant="outline" className="mr-2">
                Área: {detectedArea.replace('-', ' ')}
              </Badge>
            )}
            Bases de datos recomendadas para tu área de investigación
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingDatabases ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">Cargando bases de datos...</span>
            </div>
          ) : availableDatabases.length === 0 ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                No se encontraron bases de datos. Por favor, verifica que hayas seleccionado un área de investigación en el paso 1.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {availableDatabases.map((db) => {
                const isDisabled = disabledDatabases.includes(db.id)
                const isSelected = selectedDatabases.includes(db.id)

                return (
                  <div
                    key={db.id}
                    className={`flex flex-col space-y-2 p-3 rounded-lg border-2 transition-colors relative ${isDisabled
                      ? 'border-gray-300 bg-gray-50 opacity-60'
                      : isSelected
                        ? 'border-primary bg-primary/5 cursor-pointer'
                        : 'border-border hover:border-primary/50 cursor-pointer'
                      }`}
                    onClick={() => !isDisabled && toggleDatabase(db.id)}
                    onKeyDown={(e) => e.key === 'Enter' && !isDisabled && toggleDatabase(db.id)}
                    role="button"
                    tabIndex={isDisabled ? -1 : 0}
                  >
                    {/* Badge de estado deshabilitado */}
                    {isDisabled && (
                      <div className="absolute -top-2 -right-2 bg-red-500 text-white text-xs px-2 py-1 rounded-full z-10">
                        Deshabilitada
                      </div>
                    )}

                    <div className="flex items-center space-x-3">
                      <Checkbox
                        id={db.id}
                        checked={isSelected && !isDisabled}
                        disabled={isDisabled}
                        onCheckedChange={() => !isDisabled && toggleDatabase(db.id)}
                      />
                      <label
                        htmlFor={db.id}
                        className={`text-sm font-medium leading-none flex items-center gap-2 ${isDisabled ? 'cursor-not-allowed text-gray-500' : 'cursor-pointer'
                          }`}
                      >
                        <span>{db.icon}</span>
                        <span>{db.name}</span>
                      </label>
                    </div>

                    {/* Información de acceso premium */}
                    {db.requiresPremium && (
                      <div className="ml-8 text-xs text-amber-600 flex items-center gap-1">
                        <span>🔐</span>
                        <span>{db.premiumNote}</span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {selectedDatabases.length > 0 && (
            <div className="mt-6">
              <Button
                onClick={handleRegenerateConfirmation}
                disabled={isGenerating}
                size="lg"
                className="w-full"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Generando cadenas...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-5 w-5" />
                    {queries.length > 0 ? 'Regenerar Cadenas de Búsqueda' : 'Generar Cadenas de Búsqueda'} ({selectedDatabases.length})
                  </>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* TABLA DE CADENAS DE BÚSQUEDA */}
      {queries.length > 0 && (
        <>
          {/* Alert de validación - debe cargar referencias */}
          {(!data.searchPlan?.uploadedFiles || data.searchPlan.uploadedFiles.length === 0) && (
            <Alert className="border-amber-300 dark:border-amber-700">
              <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <AlertDescription className="text-foreground">
                <strong>⚠️ Acción requerida:</strong> Debes cargar las referencias desde TODAS las bases de datos seleccionadas antes de continuar al siguiente paso.
                <br /><br />
                <strong>Instrucciones:</strong>
                <ol className="list-decimal ml-5 mt-2 space-y-1">
                  <li>Haz clic en el botón <strong>"Ir al sitio oficial"</strong> de la base de datos que deseas consultar</li>
                  <li>Copia y pega la <strong>cadena de búsqueda</strong> proporcionada en el campo de búsqueda avanzada del sitio</li>
                  <li>Ejecuta la búsqueda y <strong>exporta las referencias</strong> en formato CSV, RIS o BibTeX desde el sitio oficial</li>
                  <li>Regresa aquí y usa el botón <strong>"Cargar Referencias"</strong> para importar el archivo descargado</li>
                </ol>
              </AlertDescription>
            </Alert>
          )}

          <Card className="border-2 border-primary/20 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-primary/5 to-primary/10">
              <CardTitle className="flex items-center gap-3 text-xl">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Database className="h-6 w-6 text-primary" />
                </div>
                Cadenas de Búsqueda por Base de Datos
              </CardTitle>
              <CardDescription className="mt-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {detectedArea && (
                    <Badge variant="outline" className="bg-primary/5 border-primary/20">
                      📊 Área: {ACADEMIC_DATABASES[detectedArea]?.name || detectedArea}
                    </Badge>
                  )}
                  {data.searchPlan?.uploadedFiles && data.searchPlan.uploadedFiles.length > 0 && (
                    <Badge variant="outline" className="bg-green-50 border-green-200 text-green-700">
                      ✓ {data.searchPlan.uploadedFiles.reduce((sum, f) => sum + f.recordCount, 0)} referencias cargadas
                    </Badge>
                  )}
                  <span className="text-sm">Queries optimizadas para cada base de datos académica</span>
                </div>
                {!isFragmentedMode && data.pico?.comparison && data.pico.comparison !== 'N/A' && (
                  <Button variant="outline" size="sm" onClick={forceFragmentedMode} disabled={isGenerating}>
                    Forzar Búsqueda Fragmentada
                  </Button>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              {isFragmentedMode && (
                <Alert className="mb-6 border-blue-400 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-800">
                  <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <AlertDescription className="text-blue-800 dark:text-blue-300">
                    <strong>Protocolo de Búsqueda Fragmentada Activo (Comparación Indirecta)</strong>
                    <p className="mt-2 text-sm">
                      Dado el bajo volumen de literatura sobre comparaciones directas, el sistema ha generado dos bloques independientes por cada base de datos.
                    </p>
                    <ul className="list-disc ml-5 mt-2 space-y-1 text-sm">
                      <li>Se ha modificado automáticamente el <strong>Criterio de Inclusión</strong> permitiendo métricas aisladas.</li>
                      <li>En la síntesis de datos, se dispondrán columnas de <strong>Comparación Indirecta</strong>.</li>
                      <li>Al redactar el manuscrito, se agregará un <em>Threat to Validity</em> especificando la Heterogeneidad de Entornos (comparación basada en benchmarks independientes).</li>
                    </ul>
                  </AlertDescription>
                </Alert>
              )}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[180px]">Base de Datos</TableHead>
                    <TableHead>Cadena de Búsqueda (Search String)</TableHead>
                    <TableHead className="w-[130px] text-center">Enlace Sitio</TableHead>
                    <TableHead className="w-[100px] text-center">Registros</TableHead>
                    <TableHead className="w-[150px] text-center">Acciones</TableHead>
                    <TableHead className="w-[60px] text-center">Eliminar</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {queries.map((query) => {
                    const qKey = query.block ? `${query.databaseId}_${query.block}` : `${query.databaseId}_U`;
                    const isEditing = editingQueries.has(qKey);
                    const isEdited = editedQueries.has(qKey);
                    const dbIcon = availableDatabases.find(db => db.id === query.databaseId)?.icon || DATABASE_ICONS[query.databaseId] || "📚";

                    return (
                      <TableRow key={`${query.databaseId}_${query.block || 'U'}`} className="hover:bg-muted/50">
                        <TableCell className="align-top">
                          <div className="flex flex-col gap-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xl">{dbIcon}</span>
                              <div className="font-semibold">{query.databaseName}</div>
                            </div>
                            {query.block === 'U' || !query.block ? (
                              <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 w-fit text-[10px]">
                                ✨ Unificada (P∩I∩C∩O)
                              </Badge>
                            ) : query.block === 'A' ? (
                              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 w-fit text-[10px]">
                                🧩 Bloque A (Intervención)
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 w-fit text-[10px]">
                                🧩 Bloque B (Comparador)
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="align-top">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2"
                                onClick={() => copyToClipboard(query.query)}
                              >
                                <Copy className="h-3 w-3 mr-1" />
                                <span className="text-xs">Copiar</span>
                              </Button>

                              {!isEditing ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 px-2"
                                  onClick={() => enableEditMode(query.databaseId, query.block)}
                                >
                                  <Edit className="h-3 w-3 mr-1" />
                                  <span className="text-xs">Editar</span>
                                </Button>
                              ) : (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 px-2 text-green-600 hover:text-green-700"
                                    onClick={() => saveEditedQuery(query.databaseId, query.block)}
                                  >
                                    <Check className="h-3 w-3 mr-1" />
                                    <span className="text-xs">Guardar</span>
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 px-2 text-red-600 hover:text-red-700"
                                    onClick={() => cancelEditMode(query.databaseId, query.block)}
                                  >
                                    <X className="h-3 w-3 mr-1" />
                                    <span className="text-xs">Cancelar</span>
                                  </Button>
                                </>
                              )}

                              {isEdited && !isEditing && (
                                <Badge variant="outline" className="text-[10px] bg-blue-50 border-blue-200 text-blue-700 py-0 h-4">
                                  ✏️ Modificada
                                </Badge>
                              )}
                            </div>
                            <Textarea
                              value={query.query}
                              onChange={(e) => handleQueryEdit(query.databaseId, query.block, e.target.value)}
                              readOnly={!isEditing}
                              rows={query.block === 'U' || !query.block ? 4 : 3}
                              className={`text-xs font-mono resize-none transition-all ${isEditing
                                ? 'bg-background border-primary focus:border-primary ring-2 ring-primary/20'
                                : 'bg-muted/30 border-muted-foreground/10 cursor-default'
                                }`}
                              placeholder="Cadena de búsqueda..."
                            />
                            {isEditing && (
                              <p className="text-[10px] text-amber-600 font-medium">Modifica el texto y guarda los cambios</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="align-top text-center w-[130px]">
                          {DATABASE_ADVANCED_SEARCH_URLS[query.databaseId] ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => window.open(DATABASE_ADVANCED_SEARCH_URLS[query.databaseId], '_blank')}
                              className="w-full h-8"
                            >
                              <Search className="h-3 w-3 mr-1" />
                              <span className="text-xs">Ir al sitio</span>
                            </Button>
                          ) : (
                            <div className="text-[10px] text-muted-foreground italic">Manual</div>
                          )}
                        </TableCell>
                        <TableCell className="align-top text-center w-[100px]">
                          {(() => {
                            const countKey = query.block ? `${query.databaseId}_${query.block}` : query.databaseId;
                            const count = importedCounts[countKey];
                            return count ? (
                              <div className="flex flex-col items-center">
                                <span className="text-lg font-bold text-primary">
                                  {count.toLocaleString()}
                                </span>
                                <span className="text-[9px] text-muted-foreground uppercase font-semibold">citas</span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground italic text-xs">-</span>
                            );
                          })()}
                        </TableCell>
                        <TableCell className="align-top text-center w-[150px]">
                          <ImportReferencesWrapper
                            query={query}
                            data={data}
                            updateData={updateData}
                            createTemporaryProjectForImport={createTemporaryProjectForImport}
                            setImportedCounts={setImportedCounts}
                            importedCounts={importedCounts}
                            toast={toast}
                          />
                        </TableCell>
                        <TableCell className="align-top text-center">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => removeDatabaseFromSelection(query.databaseId)}
                            className="h-8 px-2 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                            title={`Eliminar base de datos`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}

      {/* DIÁLOGO DE CONFIRMACIÓN PARA REGENERAR */}
      <AlertDialog open={showRegenerateDialog} onOpenChange={setShowRegenerateDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              ¿Regenerar cadenas de búsqueda?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                Has editado manualmente <strong>{editedQueries.size}</strong> cadena{editedQueries.size > 1 ? 's' : ''} de búsqueda.
              </p>
              <p className="text-foreground font-medium">
                ¿Qué deseas hacer?
              </p>
              <div className="bg-muted/50 p-3 rounded-lg space-y-2 text-sm">
                <div className="flex items-start gap-2">
                  <span className="text-green-600">✓</span>
                  <div>
                    <strong>Mantener:</strong> Conservar tus ediciones actuales (recomendado si ya ajustaste las cadenas)
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-amber-600">⚠️</span>
                  <div>
                    <strong>Regenerar:</strong> Crear nuevas cadenas desde cero (perderás todos los cambios manuales)
                  </div>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Mantener mis ediciones
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmedRegenerate}
              className="bg-amber-600 hover:bg-amber-700"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Regenerar todo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  )
}
