"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Slider } from "@/components/ui/slider"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Sparkles, BarChart3, Info, Brain, CheckCircle2, Loader2, TrendingUp, Zap } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { apiClient } from "@/lib/api-client"

interface AIScreeningPanelProps {
  totalReferences: number
  pendingReferences: number
  projectId: string
  isFragmented?: boolean
  onRunScreening: (threshold: number, method: 'embeddings' | 'llm', provider?: 'chatgpt' | 'gemini') => void
  onScreeningComplete?: (resultData?: any) => void // Aceptar datos del resultado
}

export function AIScreeningPanel({ totalReferences, pendingReferences, projectId, isFragmented = false, onRunScreening, onScreeningComplete }: AIScreeningPanelProps) {
  const [method, setMethod] = useState<'embeddings' | 'llm'>('embeddings');
  const [threshold, setThreshold] = useState([0.15]);
  const [recommendedThreshold, setRecommendedThreshold] = useState<number | null>(null);
  const [analysisData, setAnalysisData] = useState<any>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentPhase, setCurrentPhase] = useState<string>('');
  const [processedCount, setProcessedCount] = useState(0);
  const [totalToProcess, setTotalToProcess] = useState(0);

  const onThresholdRecommended = (newThreshold: number) => {
    setRecommendedThreshold(newThreshold);
    setThreshold([newThreshold]);
  };

  const onAnalysisComplete = (data: any) => {
    setAnalysisData(data);
    if (data?.recommendedCutoff?.threshold) {
      setRecommendedThreshold(data.recommendedCutoff.threshold);
      setThreshold([data.recommendedCutoff.threshold]);
    }
  };

  const handleRunScreening = async () => {
    setIsRunning(true);
    setProgress(0);
    setProcessedCount(0);
    setTotalToProcess(totalReferences);

    try {
      // Paso 1: Ejecutar análisis de similitudes automáticamente (5% del progreso)
      setCurrentPhase('Analizando similitudes con Elbow Method...');
      setProgress(2);
      try {
        const analysisResult = await apiClient.analyzeSimilarityDistribution(projectId);
        if (analysisResult?.data) {
          onAnalysisComplete(analysisResult.data);
          setProgress(5);
        }
      } catch (analysisError) {
        setProgress(5);
      }

      // Paso 2: Ejecutar el cribado híbrido con SSE para progreso en tiempo real
      setCurrentPhase('Iniciando cribado automático...');
      setProgress(10);
      // Construir URL del endpoint SSE con token
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const token = localStorage.getItem('token');
      const eventSourceUrl = `${baseUrl}/api/ai/run-project-screening-stream?projectId=${projectId}&threshold=${threshold[0]}&aiProvider=${method === 'llm' ? 'gemini' : 'chatgpt'}&token=${token}&isFragmented=${isFragmented}`;

      // Crear EventSource para SSE
      const eventSource = new EventSource(eventSourceUrl);

      // Escuchar eventos de progreso
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          switch (data.type) {
            case 'phase':
              // Actualizar fase y progreso
              setCurrentPhase(data.message);
              setProgress(data.progress);
              if (data.total) {
                setTotalToProcess(data.total);
              }
              if (data.current !== undefined) {
                setProcessedCount(data.current);
              }
              break;

            case 'progress':
              // Actualizar progreso incremental
              setCurrentPhase(data.message);
              setProgress(data.progress);
              if (data.current !== undefined) {
                setProcessedCount(data.current);
              }
              break;

            case 'complete':
              // Proceso completado
              setProgress(100);
              setCurrentPhase('✅ Cribado completado exitosamente');
              eventSource.close();

              // Notificar al padre que recargue los datos y actualice el estado
              setTimeout(() => {
                setIsRunning(false);
                setProgress(0);
                setCurrentPhase('');
                setProcessedCount(0);

                // Llamar al callback del padre para que actualice todo
                // Pasar también los datos del resultado para que se guarden correctamente
                if (onScreeningComplete) {
                  onScreeningComplete(data.data);
                }
              }, 2000);
              break;

            case 'error':
              // Error en el proceso
              console.error('❌ Error en cribado:', data.message);
              setCurrentPhase('❌ Error: ' + data.message);
              eventSource.close();
              setTimeout(() => {
                setIsRunning(false);
                setProgress(0);
                setCurrentPhase('');
                setProcessedCount(0);
              }, 3000);
              break;
          }
        } catch (parseError) {
          console.error('❌ Error parseando evento SSE:', parseError);
        }
      };

      eventSource.onerror = (error) => {
        console.error('❌ Error en conexión SSE:', error);
        eventSource.close();
        setCurrentPhase('❌ Error de conexión con el servidor');
        setTimeout(() => {
          setIsRunning(false);
          setProgress(0);
          setCurrentPhase('');
          setProcessedCount(0);
        }, 3000);
      };

    } catch (error: any) {
      console.error('❌ Error en el proceso de cribado:', error);
      setIsRunning(false);
      setProgress(0);
      setCurrentPhase('');
      setProcessedCount(0);
    }
  };

  return (
    <div className="space-y-6">
      {/* Card Único y Simplificado */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Cribado Automático con IA
          </CardTitle>
          <CardDescription>
            El sistema analiza automáticamente todas las referencias usando similitud semántica
            e inteligencia artificial para clasificarlas en categorías de relevancia según los criterios de tu protocolo.
            {isFragmented && (
              <Badge variant="secondary" className="ml-2 bg-amber-100 text-amber-800 border-amber-200">
                🧩 Modo Fragmentado Activo
              </Badge>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">

          {/* Estadísticas - Más conciso */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-muted p-4 rounded-lg text-center">
              <p className="text-muted-foreground text-sm mb-1">Total Referencias</p>
              <p className="text-3xl font-bold">{totalReferences}</p>
            </div>
            <div className="bg-muted p-4 rounded-lg text-center">
              <p className="text-muted-foreground text-sm mb-1">Pendientes</p>
              <p className="text-3xl font-bold text-amber-600">{pendingReferences}</p>
            </div>
          </div>

          {/* Botón de acción — SOLO se muestra si hay pendientes (no se permite re-ejecutar) */}
          {pendingReferences > 0 && (
            <Button
              onClick={handleRunScreening}
              disabled={isRunning || totalReferences === 0 || method === 'llm'}
              className="w-full"
              size="lg"
            >
              {isRunning ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Procesando...
                </>
              ) : method === 'llm' ? (
                "⚠️ Cuota de API Agotada"
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Ejecutar Cribado Híbrido
                </>
              )}
            </Button>
          )}
          {pendingReferences === 0 && !isRunning && (
            <div className="space-y-3">
              <div className="w-full p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-center">
                <div className="flex items-center justify-center gap-2 text-green-700 dark:text-green-400">
                  <CheckCircle2 className="h-5 w-5" />
                  <span className="font-semibold">Cribado completado</span>
                </div>
                <p className="text-xs text-green-600 dark:text-green-500 mt-1">Todas las referencias han sido procesadas. Continúe con la Fase 2.</p>
              </div>
              
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full text-xs"
                onClick={handleRunScreening}
                disabled={isRunning}
              >
                <Zap className="h-3 w-3 mr-1" />
                Reiniciar Cribado (Modo Fragmentado)
              </Button>
            </div>
          )}

          {method === 'llm' && (
            <Alert variant="destructive">
              <Info className="h-4 w-4" />
              <AlertDescription>
                Por favor selecciona el método de <strong>Embeddings</strong> para continuar
              </AlertDescription>
            </Alert>
          )}

          {pendingReferences === 0 && totalReferences > 0 && (
            <Alert>
              <CheckCircle2 className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-600">
                ℹ️ Las referencias ya fueron procesadas. Puedes re-ejecutar el análisis para actualizar los resultados con la nueva lógica.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Modal de Progreso */}
      <Dialog open={isRunning} onOpenChange={() => { }}>
        <DialogContent className="sm:max-w-[600px]" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              Ejecutando Cribado Automático
            </DialogTitle>
            <DialogDescription>
              Por favor espera mientras el sistema procesa todas las referencias con IA
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Barra de progreso principal */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">
                  {currentPhase || 'Iniciando proceso...'}
                </span>
                <span className="text-2xl font-bold text-primary">{progress}%</span>
              </div>
              <Progress value={progress} className="h-3" />
            </div>

            {/* Información de referencias */}
            {totalToProcess > 0 && (
              <div className="grid grid-cols-2 gap-3">
                <Card className="border-primary/20">
                  <CardContent className="p-4">
                    <div className="text-xs text-muted-foreground mb-1">Total Referencias</div>
                    <div className="text-3xl font-bold text-foreground">{totalToProcess}</div>
                  </CardContent>
                </Card>
                <Card className="border-primary/20">
                  <CardContent className="p-4">
                    <div className="text-xs text-muted-foreground mb-1">Tiempo Estimado</div>
                    <div className="text-3xl font-bold text-foreground">
                      {totalToProcess < 50 ? '1-2' : totalToProcess < 100 ? '2-3' : '3-5'}
                      <span className="text-lg ml-1">min</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Fases del proceso */}
            <div className="space-y-2">
              <div className="text-sm font-semibold text-foreground mb-2">Fases del Proceso:</div>
              <div className={`flex items-start gap-3 p-3 rounded-lg border-2 ${progress < 10 ? 'border-primary bg-primary/10' : 'border-muted bg-muted/30'
                }`}>
                <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${progress < 10 ? 'bg-primary text-primary-foreground' : 'bg-green-500 text-white'
                  }`}>
                  {progress < 10 ? <Loader2 className="h-4 w-4 animate-spin" /> : '✓'}
                </div>
                <div>
                  <div className="text-sm font-medium">Análisis de Similitudes</div>
                  <div className="text-xs text-muted-foreground">Determinando umbral óptimo con Elbow Method</div>
                </div>
              </div>

              <div className={`flex items-start gap-3 p-3 rounded-lg border-2 ${progress >= 10 && progress < 35 ? 'border-primary bg-primary/10' :
                  progress >= 35 ? 'border-muted bg-muted/30' : 'border-muted/50'
                }`}>
                <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${progress >= 10 && progress < 35 ? 'bg-primary text-primary-foreground' :
                    progress >= 35 ? 'bg-green-500 text-white' : 'bg-muted text-muted-foreground'
                  }`}>
                  {progress >= 10 && progress < 35 ? <Loader2 className="h-4 w-4 animate-spin" /> :
                    progress >= 35 ? '✓' : '1'}
                </div>
                <div>
                  <div className="text-sm font-medium">Fase 1: Clasificación con Embeddings</div>
                  <div className="text-xs text-muted-foreground">
                    Separando referencias de alta/baja confianza (Rápido)
                  </div>
                </div>
              </div>

              <div className={`flex items-start gap-3 p-3 rounded-lg border-2 ${progress >= 35 && progress < 95 ? 'border-primary bg-primary/10' :
                  progress >= 95 ? 'border-muted bg-muted/30' : 'border-muted/50'
                }`}>
                <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${progress >= 35 && progress < 95 ? 'bg-primary text-primary-foreground' :
                    progress >= 95 ? 'bg-green-500 text-white' : 'bg-muted text-muted-foreground'
                  }`}>
                  {progress >= 35 && progress < 95 ? <Loader2 className="h-4 w-4 animate-spin" /> :
                    progress >= 95 ? '✓' : '2'}
                </div>
                <div>
                  <div className="text-sm font-medium">Fase 2: Análisis con ChatGPT</div>
                  <div className="text-xs text-muted-foreground">
                    Procesando rango de incertidumbre secuencialmente (Lento - puede tardar)
                  </div>
                  {progress >= 35 && progress < 95 && (
                    <div className="mt-2 flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400">
                      <Zap className="h-3 w-3" />
                      <span className="font-medium">Esta fase procesa cada referencia individualmente con IA</span>
                    </div>
                  )}
                </div>
              </div>

              <div className={`flex items-start gap-3 p-3 rounded-lg border-2 ${progress >= 95 ? 'border-primary bg-primary/10' : 'border-muted/50'
                }`}>
                <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${progress >= 95 && progress < 100 ? 'bg-primary text-primary-foreground' :
                    progress === 100 ? 'bg-green-500 text-white' : 'bg-muted text-muted-foreground'
                  }`}>
                  {progress >= 95 && progress < 100 ? <Loader2 className="h-4 w-4 animate-spin" /> :
                    progress === 100 ? '✓' : '3'}
                </div>
                <div>
                  <div className="text-sm font-medium">Fase 3: Guardando Resultados</div>
                  <div className="text-xs text-muted-foreground">Persistiendo datos en base de datos</div>
                </div>
              </div>
            </div>

            {/* Advertencia de tiempo */}
            {progress >= 35 && progress < 95 && (
              <Alert className="border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20">
                <Info className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                <AlertDescription className="text-xs text-amber-900 dark:text-amber-100">
                  ⏳ <strong>Proceso en curso:</strong> ChatGPT está analizando cada referencia del rango de incertidumbre.
                  Este proceso puede tardar varios minutos dependiendo de la cantidad de referencias.
                  Por favor no cierres esta ventana.
                </AlertDescription>
              </Alert>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
