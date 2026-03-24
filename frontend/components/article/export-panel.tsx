"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  FileCode,
  FileText,
  Database,
  Image,
  Package,
  Download,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Code2
} from "lucide-react"
import { apiClient } from "@/lib/api-client"
import { useToast } from "@/hooks/use-toast"

interface ExportPanelProps {
  projectId: string
  canExport: boolean
  blockingReason?: string
  onRegenerate?: () => void
  isRegenerating?: boolean
}

export function ExportPanel({ projectId, canExport, blockingReason, onRegenerate, isRegenerating = false }: ExportPanelProps) {
  const [loading, setLoading] = useState<string | null>(null)
  const { toast } = useToast()

  const handleExport = async (type: string, endpoint: string, filename: string) => {
    try {
      setLoading(type)

      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
      const response = await fetch(`${API_URL}/api/projects/${projectId}/article/export/${endpoint}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Error al exportar')
      }

      // Descargar archivo
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      toast({
        title: "✅ Exportación exitosa",
        description: `${filename} descargado correctamente`,
      })
    } catch (error: any) {
      console.error(`Error exporting ${type}:`, error)
      toast({
        title: "❌ Error en exportación",
        description: error.message || `No se pudo exportar ${type}`,
        variant: "destructive",
      })
    } finally {
      setLoading(null)
    }
  }

  const exportItems = [
    {
      id: 'latex',
      title: 'LaTeX (.tex)',
      description: 'Código fuente listo para Overleaf o Texmaker',
      icon: FileCode,
      endpoint: 'latex',
      filename: `article_${projectId.substring(0, 8)}.tex`,
      color: 'text-blue-600',
    },
    {
      id: 'bibtex',
      title: 'BibTeX (.bib)',
      description: 'Referencias para bibliografía automática',
      icon: FileText,
      endpoint: 'bibtex',
      filename: `references_${projectId.substring(0, 8)}.bib`,
      color: 'text-green-600',
    },
    {
      id: 'csv',
      title: 'Datos CSV',
      description: 'Datos RQS para análisis estadístico',
      icon: Database,
      endpoint: 'data-csv',
      filename: `rqs_data_${projectId.substring(0, 8)}.csv`,
      color: 'text-yellow-600',
    },
    {
      id: 'charts',
      title: 'Gráficos (PNG + PDF)',
      description: 'Raster (300 DPI) + Vector (PDF) para journals',
      icon: Image,
      endpoint: 'charts-zip',
      filename: `charts_${projectId.substring(0, 8)}.zip`,
      color: 'text-purple-600',
    },
    {
      id: 'python',
      title: 'Scripts Python',
      description: 'Código para regenerar/personalizar gráficos',
      icon: Code2,
      endpoint: 'python-scripts',
      filename: `python_scripts_${projectId.substring(0, 8)}.zip`,
      color: 'text-orange-600',
    },
    {
      id: 'all',
      title: 'Paquete Completo (ZIP)',
      description: 'LaTeX + BibTeX + CSV + Gráficos + Python',
      icon: Package,
      endpoint: 'all-zip',
      filename: `article_complete_${projectId.substring(0, 8)}.zip`,
      color: 'text-indigo-600',
    },
  ]

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              Exportación de Activos Académicos
            </CardTitle>
            <CardDescription>
              Descarga todos los archivos necesarios para publicación académica
            </CardDescription>
          </div>
          {onRegenerate && (
            <Button
              size="sm"
              variant="outline"
              onClick={onRegenerate}
              disabled={!canExport || isRegenerating}
            >
              {isRegenerating ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  Regenerando...
                </>
              ) : (
                <>
                  <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                  Regenerar
                </>
              )}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!canExport && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {blockingReason === 'PRISMA_INCOMPLETE'
                ? 'Complete todos los ítems PRISMA antes de exportar el artículo.'
                : 'Debe generar el artículo antes de poder exportar los activos.'}
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {exportItems.map((item) => {
            const Icon = item.icon
            const isLoading = loading === item.id
            const isDisabled = !canExport || isLoading || loading !== null

            return (
              <Button
                key={item.id}
                variant="outline"
                className="h-auto p-4 justify-start items-start text-left hover:bg-accent"
                onClick={() => handleExport(item.id, item.endpoint, item.filename)}
                disabled={isDisabled}
              >
                <div className="flex items-start gap-3 w-full">
                  <div className={`mt-0.5 ${item.color}`}>
                    {isLoading ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <Icon className="h-5 w-5" />
                    )}
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="font-medium">{item.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {item.description}
                    </div>
                  </div>
                </div>
              </Button>
            )
          })}
        </div>

        <Alert>
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription className="text-xs">
            <strong>Nota:</strong> Los gráficos incluyen versiones vectoriales (PDF) requeridas por
            journals de alto impacto (IEEE, Elsevier, Springer, MDPI). El paquete completo incluye
            todo lo necesario para compilar en Overleaf o LaTeX local.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  )
}
