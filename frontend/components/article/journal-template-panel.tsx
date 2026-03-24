"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Loader2, Upload, FileText, CheckCircle2, Download, Copy, RefreshCcw, Sparkles } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { apiClient } from "@/lib/api-client"

interface JournalTemplatePanelProps {
    projectId: string
}

export function JournalTemplatePanel({ projectId }: JournalTemplatePanelProps) {
    const [file, setFile] = useState<File | null>(null)
    const [isProcessing, setIsProcessing] = useState(false)
    const [latexResult, setLatexResult] = useState<string | null>(null)
    const { toast } = useToast()

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const selectedFile = e.target.files[0]
            const ext = selectedFile.name.split('.').pop()?.toLowerCase()

            if (ext !== 'pdf' && ext !== 'tex') {
                toast({
                    title: "Formato no soportado",
                    description: "Por favor sube un archivo PDF o .tex",
                    variant: "destructive"
                })
                return
            }

            setFile(selectedFile)
        }
    }

    const handleProcessTemplate = async () => {
        if (!file) return

        try {
            setIsProcessing(true)
            setLatexResult(null)

            toast({
                title: "Procesando plantilla",
                description: "La IA está analizando el formato y estructurando tu artículo..."
            })

            const response = await apiClient.generateArticleFromTemplate(projectId, file)

            if (response.success && response.latex) {
                setLatexResult(response.latex)
                toast({
                    title: "¡Éxito!",
                    description: "Artículo formateado según la plantilla exitosamente."
                })
            }
        } catch (error: any) {
            console.error("Error processing template:", error)
            toast({
                title: "Error",
                description: error.message || "No se pudo procesar la plantilla",
                variant: "destructive"
            })
        } finally {
            setIsProcessing(false)
        }
    }

    const handleDownload = () => {
        if (!latexResult) return

        const blob = new Blob([latexResult], { type: 'text/plain;charset=utf-8' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `articulo_formateado_${projectId.substring(0, 8)}.tex`
        document.body.appendChild(a)
        a.click()
        a.remove()
        URL.revokeObjectURL(url)
    }

    const handleCopy = () => {
        if (!latexResult) return
        navigator.clipboard.writeText(latexResult)
        toast({
            title: "Copiado",
            description: "Código LaTeX copiado al portapapeles"
        })
    }

    return (
        <Card className="border-primary/20 shadow-md overflow-hidden relative group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity pointer-events-none">
                <Sparkles className="h-12 w-12 text-primary" />
            </div>
            <CardHeader className="bg-primary/5 pb-4">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                        <Sparkles className="h-4 w-4" />
                    </div>
                    <div>
                        <CardTitle className="text-lg">Formato de Revista Personalizado</CardTitle>
                        <CardDescription>Sube la plantilla de la revista (PDF o LaTeX) y la IA estructurará tu artículo</CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
                {!latexResult ? (
                    <>
                        <div className="space-y-4">
                            <div className="grid w-full items-center gap-1.5 font-medium">
                                <Label htmlFor="template-file">Plantilla de la Revista (PDF/LaTeX)</Label>
                                <div
                                    className={`mt-1 border-2 border-dashed rounded-lg p-8 transition-all flex flex-col items-center justify-center gap-3 cursor-pointer hover:bg-muted/50 ${file ? 'border-primary bg-primary/5' : 'border-muted-foreground/20'}`}
                                    onClick={() => document.getElementById('template-file')?.click()}
                                >
                                    {file ? (
                                        <>
                                            <FileText className="h-10 w-10 text-primary" />
                                            <div className="text-center">
                                                <p className="text-sm font-semibold">{file.name}</p>
                                                <p className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                                            </div>
                                            <Button variant="outline" size="sm" className="mt-2" onClick={(e) => { e.stopPropagation(); setFile(null); }}>
                                                Cambiar archivo
                                            </Button>
                                        </>
                                    ) : (
                                        <>
                                            <Upload className="h-10 w-10 text-muted-foreground" />
                                            <div className="text-center">
                                                <p className="text-sm font-medium">Haz clic para subir o arrastra el archivo</p>
                                                <p className="text-xs text-muted-foreground">Soportamos .pdf y .tex (Max 20MB)</p>
                                            </div>
                                        </>
                                    )}
                                    <Input
                                        id="template-file"
                                        type="file"
                                        className="hidden"
                                        onChange={handleFileChange}
                                        accept=".pdf,.tex"
                                    />
                                </div>
                            </div>

                            <Alert className="bg-secondary/30 border-secondary/50">
                                <Sparkles className="h-4 w-4 text-primary" />
                                <AlertTitle className="font-semibold text-primary">Análisis Inteligente</AlertTitle>
                                <AlertDescription className="text-xs">
                                    Gemini 1.5 Pro analizará el documento para extraer comandos, márgenes, tipos de letra y estructura de secciones para replicarlos exactamente.
                                </AlertDescription>
                            </Alert>
                        </div>

                        <Button
                            className="w-full flex gap-2 font-bold py-6 shadow-lg shadow-primary/20"
                            onClick={handleProcessTemplate}
                            disabled={!file || isProcessing}
                        >
                            {isProcessing ? (
                                <>
                                    <Loader2 className="h-5 w-5 animate-spin" />
                                    Analizando y Generando...
                                </>
                            ) : (
                                <>
                                    <RefreshCcw className="h-5 w-5" />
                                    Generar con este Formato
                                </>
                            )}
                        </Button>
                    </>
                ) : (
                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-green-600 font-semibold">
                                <CheckCircle2 className="h-5 w-5" />
                                <span>¡Artículo Formateado!</span>
                            </div>
                            <Button variant="ghost" size="sm" className="text-primary gap-1" onClick={() => setLatexResult(null)}>
                                <RefreshCcw className="h-3 w-3" />
                                Procesar otra plantilla
                            </Button>
                        </div>

                        <div className="relative border rounded-md bg-zinc-950 p-4 overflow-hidden h-64 shadow-inner">
                            <pre className="text-xs text-zinc-300 font-mono overflow-auto h-full scrollbar-thin scrollbar-thumb-zinc-800">
                                {latexResult}
                            </pre>
                            <div className="absolute top-2 right-2 flex gap-1">
                                <Button variant="secondary" size="icon" className="h-8 w-8" onClick={handleCopy}>
                                    <Copy className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <Button variant="outline" className="gap-2" onClick={handleCopy}>
                                <Copy className="h-4 w-4" />
                                Copiar Código
                            </Button>
                            <Button className="gap-2" onClick={handleDownload}>
                                <Download className="h-4 w-4" />
                                Descargar .tex
                            </Button>
                        </div>

                        <p className="text-[10px] text-center text-muted-foreground italic">
                            Este código LaTeX está optimizado para compilarse en Overleaf o con pdflatex.
                        </p>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
