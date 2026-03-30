"use client"

import React, { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, PlusCircle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { apiClient } from "@/lib/api-client"

interface ManualReferenceDialogProps {
  projectId: string
  databaseId: string
  databaseName: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: (count: number) => void
}

export function ManualReferenceDialog({
  projectId,
  databaseId,
  databaseName,
  open,
  onOpenChange,
  onSuccess
}: ManualReferenceDialogProps) {
  const { toast } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    title: "",
    authors: "",
    year: new Date().getFullYear().toString(),
    journal: "",
    doi: "",
    abstract: "",
    source: databaseName
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { id, value } = e.target
    setFormData(prev => ({ ...prev, [id]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validaciones básicas
    if (!formData.title || !formData.authors || !formData.year || !formData.journal) {
      toast({
        title: "⚠️ Campos incompletos",
        description: "Por favor completa el título, autores, año y fuente.",
        variant: "destructive"
      })
      return
    }

    setIsSubmitting(true)
    try {
      const referenceData = {
        ...formData,
        year: parseInt(formData.year),
        source: databaseName,
        screeningStatus: 'pending'
      }

      const result = await apiClient.createReference(projectId, referenceData)
      
      toast({
        title: "✅ Referencia añadida",
        description: "La referencia se ha guardado correctamente."
      })
      
      onSuccess(1)
      onOpenChange(false)
      
      // Reset form
      setFormData({
        title: "",
        authors: "",
        year: new Date().getFullYear().toString(),
        journal: "",
        doi: "",
        abstract: "",
        source: databaseName
      })
    } catch (error: any) {
      console.error("Error al crear referencia manual:", error)
      toast({
        title: "❌ Error",
        description: error.message || "No se pudo guardar la referencia.",
        variant: "destructive"
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Añadir Referencia Manualmente</DialogTitle>
          <DialogDescription>
            Ingresa los datos para la base de datos: <strong>{databaseName}</strong>
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-2">
              <Label htmlFor="title">Título del Artículo *</Label>
              <Input 
                id="title" 
                placeholder="Ej: A Systematic Literature Review of Node.js performance..." 
                value={formData.title}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="authors">Autores * (separados por punto y coma)</Label>
              <Input 
                id="authors" 
                placeholder="Ej: Smith, J.; Doe, A." 
                value={formData.authors}
                onChange={handleChange}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="year">Año de Publicación *</Label>
              <Input 
                id="year" 
                type="number" 
                min="1900" 
                max="2100" 
                value={formData.year}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="journal">Revista / Conferencia *</Label>
              <Input 
                id="journal" 
                placeholder="Ej: IEEE Access, Nature..." 
                value={formData.journal}
                onChange={handleChange}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="doi">DOI (Identificador Único)</Label>
              <Input 
                id="doi" 
                placeholder="Ej: 10.1109/ACCESS.2024.123456" 
                value={formData.doi}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="abstract">Resumen (Abstract)</Label>
            <Textarea 
              id="abstract" 
              placeholder="Pega el resumen aquí..." 
              value={formData.abstract}
              onChange={handleChange}
              className="min-h-[120px]"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Añadir Referencia
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
