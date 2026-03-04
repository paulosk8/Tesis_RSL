"use client"

import { useState } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import type { Reference } from "@/lib/types"
import { Eye, CheckCircle, XCircle, Trash2 } from "lucide-react"
import { ReferenceDetailDialog } from "./reference-detail-dialog"

interface ReferenceTableProps {
  references: Reference[]
  onStatusChange: (id: string, status: Reference["status"]) => void
  onDelete?: (id: string) => void
  selectedIds: string[]
  onSelectionChange: (ids: string[]) => void
  showActions?: boolean // Si es false, solo muestra el botón de ver detalles
  enableSelection?: boolean // Si es false, no muestra los checkboxes de selección
}

const statusConfig = {
  pending: { label: "Pendiente", variant: "secondary" as const, color: "text-yellow-600" },
  included: { label: "Incluido", variant: "default" as const, color: "text-green-600" },
  excluded: { label: "Excluido", variant: "destructive" as const, color: "text-red-600" },
  duplicate: { label: "Duplicado", variant: "outline" as const, color: "text-gray-600" },
  maybe: { label: "Revisar", variant: "secondary" as const, color: "text-orange-600" },
  fulltext_included: { label: "Incluido (Texto)", variant: "default" as const, color: "text-green-600" },
  fulltext_excluded: { label: "Excluido (Texto)", variant: "destructive" as const, color: "text-red-600" },
  phase1_included: { label: "Fase 1: Incluido", variant: "default" as const, color: "text-green-600" },
  phase1_excluded: { label: "Fase 1: Excluido", variant: "destructive" as const, color: "text-red-600" },
  phase2_included: { label: "Fase 2: Incluido", variant: "default" as const, color: "text-green-600" },
  phase2_excluded: { label: "Fase 2: Excluido", variant: "destructive" as const, color: "text-red-600" },
  Pendiente: { label: "Pendiente", variant: "secondary" as const, color: "text-yellow-600" },
  'En Revisión': { label: "En Revisión", variant: "secondary" as const, color: "text-blue-600" },
  Incluida: { label: "Incluida", variant: "default" as const, color: "text-green-600" },
  Excluida: { label: "Excluida", variant: "destructive" as const, color: "text-red-600" },
  Duplicada: { label: "Duplicada", variant: "outline" as const, color: "text-gray-600" },
}

export function ReferenceTable({ references, onStatusChange, onDelete, selectedIds, onSelectionChange, showActions = true, enableSelection = true }: ReferenceTableProps) {
  const [selectedReference, setSelectedReference] = useState<Reference | null>(null)

  const toggleSelection = (id: string) => {
    if (selectedIds.includes(id)) {
      onSelectionChange(selectedIds.filter((selectedId) => selectedId !== id))
    } else {
      onSelectionChange([...selectedIds, id])
    }
  }

  const toggleSelectAll = () => {
    if (selectedIds.length === references.length) {
      onSelectionChange([])
    } else {
      onSelectionChange(references.map((ref) => ref.id))
    }
  }

  const getScoreColor = (score?: number) => {
    if (!score) return "text-muted-foreground"
    if (score >= 0.8) return "text-green-600 font-semibold"
    if (score >= 0.6) return "text-yellow-600 font-semibold"
    return "text-red-600 font-semibold"
  }

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                {enableSelection && (
                  <Checkbox checked={selectedIds.length === references.length} onCheckedChange={toggleSelectAll} />
                )}
              </TableHead>
              <TableHead>Título</TableHead>
              <TableHead>Autores</TableHead>
              <TableHead>Año</TableHead>
              <TableHead>Fuente</TableHead>
              <TableHead>Score IA</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {references.map((reference) => {
              // Usar screeningStatus si está disponible, si no, usar status
              const statusKey = (reference.screeningStatus || reference.status) as keyof typeof statusConfig
              const statusInfo = statusConfig[statusKey] || statusConfig.pending
              return (
                <TableRow key={reference.id}>
                  <TableCell>
                    {enableSelection && (
                      <Checkbox
                        checked={selectedIds.includes(reference.id)}
                        onCheckedChange={() => toggleSelection(reference.id)}
                      />
                    )}
                  </TableCell>
                  <TableCell className="max-w-md">
                    <p className="font-medium line-clamp-2">{reference.title}</p>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-xs">
                    {(() => {
                      if (!reference.authors) return '-'

                      if (Array.isArray(reference.authors)) {
                        const authors = reference.authors.filter(a => a && a.trim())
                        if (authors.length === 0) return '-'
                        if (authors.length === 1) return authors[0]
                        if (authors.length === 2) return authors.join(', ')
                        return `${authors.slice(0, 2).join(', ')} et al.`
                      }

                      if (typeof reference.authors === 'string') {
                        const authors = (reference.authors as string)
                          .split(/[;,]/)
                          .map((a: string) => a.trim())
                          .filter((a: string) => a)
                        if (authors.length === 0) return '-'
                        if (authors.length === 1) return authors[0]
                        if (authors.length === 2) return authors.join(', ')
                        return `${authors.slice(0, 2).join(', ')} et al.`
                      }

                      return String(reference.authors)
                    })()}
                  </TableCell>
                  <TableCell>{reference.year}</TableCell>
                  <TableCell className="text-sm">{reference.source}</TableCell>
                  <TableCell>
                    {reference.screeningScore ? (
                      <div className="flex flex-col gap-1">
                        <span className={getScoreColor(reference.screeningScore)}>
                          {(reference.screeningScore * 100).toFixed(0)}%
                        </span>
                        {reference.aiReasoning && (
                          <Badge
                            variant="outline"
                            className="text-[10px]"
                          >
                            {reference.aiReasoning.includes('🤖 Embeddings') && reference.aiReasoning.includes('🧠 CHATGPT')
                              ? '🔀 Híbrido'
                              : reference.aiReasoning.includes('🧠 CHATGPT')
                                ? '🧠 ChatGPT'
                                : '🤖 Embeddings'}
                          </Badge>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                      {reference.aiClassification && (
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${reference.aiClassification === 'include'
                              ? 'border-green-300 dark:border-green-700 text-green-700 dark:text-green-400'
                              : reference.aiClassification === 'exclude'
                                ? 'border-red-300 dark:border-red-700 text-red-700 dark:text-red-400'
                                : 'border-yellow-300 dark:border-yellow-700 text-yellow-700 dark:text-yellow-400'
                            }`}
                        >
                          {reference.aiClassification === 'include'
                            ? '✅ IA: Incluir'
                            : reference.aiClassification === 'exclude'
                              ? '❌ IA: Excluir'
                              : '🤔 IA: Revisar'}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setSelectedReference(reference)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      {showActions && reference.status === "pending" && (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => onStatusChange(reference.id, "included")}
                            className="text-green-600 hover:text-green-700"
                          >
                            <CheckCircle className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => onStatusChange(reference.id, "excluded")}
                            className="text-red-600 hover:text-red-700"
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                      {showActions && onDelete && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            if (confirm('¿Estás seguro de que deseas eliminar esta referencia?')) {
                              onDelete(reference.id)
                            }
                          }}
                          className="text-destructive hover:text-destructive/80"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      {selectedReference && (
        <ReferenceDetailDialog
          reference={selectedReference}
          open={!!selectedReference}
          onOpenChange={(open) => !open && setSelectedReference(null)}
          onStatusChange={onStatusChange}
        />
      )}
    </>
  )
}
