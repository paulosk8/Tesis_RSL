"use client"

import { apiClient } from "@/lib/api-client"
import { WizardProvider, useWizard } from "@/components/project-wizard/wizard-context"
import { WizardHeader } from "@/components/project-wizard/wizard-header"
import { WizardNavigation } from "@/components/project-wizard/wizard-navigation"
import { ProposalStep } from "@/components/project-wizard/steps/1-proposal-step"
import { PicoMatrixStep } from "@/components/project-wizard/steps/2-pico-matrix-step"
import { TitlesStep } from "@/components/project-wizard/steps/4-titles-step"
import { CriteriaStep } from "@/components/project-wizard/steps/5-criteria-step"
import { ProtocolDefinitionStep } from "@/components/project-wizard/steps/6-protocol-definition-step"
import { SearchPlanStep } from "@/components/project-wizard/steps/7-search-plan-step"
import { PrismaCheckStep } from "@/components/project-wizard/steps/8-prisma-check-step"
import { useToast } from "@/hooks/use-toast"
import { useState } from "react"
import { useSearchParams } from "next/navigation"

function WizardContent() {
  const { data, currentStep, updateData } = useWizard()
  const { toast } = useToast()
  const [isSaving, setIsSaving] = useState(false)

  const handleCreateProject = async () => {
    setIsSaving(true)
    try {
      if (!data.projectId) {
        throw new Error("No hay un proyecto inicializado para finalizar.")
      }

      const updatePayload = {
        title: data.projectName,
        description: data.projectDescription || "Proyecto de revisión sistemática",
        researchArea: data.researchArea,
        status: "draft"
      }

      await apiClient.updateProject(data.projectId, updatePayload)

      toast({
        title: "✅ Proyecto finalizado",
        description: "Tu protocolo y referencias han sido guardados."
      })

      window.location.href = `/projects/${data.projectId}`
    } catch (err) {
      console.error(err)
      toast({
        title: "❌ Error finalizando proyecto",
        description: "Revisa los datos ingresados",
        variant: "destructive"
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleStartProject = async () => {
    setIsSaving(true)
    try {
      const payload = {
        title: `[BORRADOR] ${data.projectName}`,
        description: data.projectDescription || "Proyecto de revisión sistemática",
        researchArea: data.researchArea,
        status: "temporary"
      }

      const project = await apiClient.createProject(payload)
      updateData({ projectId: project.id })

      return project.id
    } catch (err) {
      console.error("Error al inicializar proyecto:", err)
      toast({
        title: "⚠️ Advertencia de conexión",
        description: "No se pudo sincronizar con el servidor, pero puedes continuar localmente.",
        variant: "default"
      })
      return null
    } finally {
      setIsSaving(false)
    }
  }

  const validateStep = () => {
    if (currentStep === 1) {
      return !!(data.projectName && data.projectDescription && data.researchArea)
    }
    if (currentStep === 2) {
      // Solo validar que haya algo generado, no requiere completitud
      return !!(data.pico?.population || data.pico?.intervention)
    }
    if (currentStep === 3) {
      // Validar que se haya seleccionado un título
      return !!data.selectedTitle
    }
    if (currentStep === 4) {
      // No validar criterios, permitir avanzar
      return true
    }
    if (currentStep === 5) {
      // Validar que haya términos generados
      const hasTerms =
        (data.protocolTerms?.tecnologia?.length ?? 0) > 0 ||
        (data.protocolTerms?.dominio?.length ?? 0) > 0 ||
        (data.protocolTerms?.focosTematicos?.length ?? 0) > 0

      // Validar que al menos un término esté confirmado
      const hasConfirmed =
        (data.confirmedTerms?.tecnologia?.size ?? 0) > 0 ||
        (data.confirmedTerms?.dominio?.size ?? 0) > 0 ||
        (data.confirmedTerms?.focosTematicos?.size ?? 0) > 0

      return hasTerms && hasConfirmed
    }
    if (currentStep === 4) {
      // No validar criterios, permitir avanzar
      return true
    }
    if (currentStep === 6) {
      // Requiere: bases de datos seleccionadas Y referencias cargadas para TODAS las bases seleccionadas
      const selectedDbs = (data.searchPlan?.databases || []).map((db: any) =>
        typeof db === 'object' && db !== null && 'id' in db ? db.id : db
      )
      const uploadedDbs = (data.searchPlan?.uploadedFiles || []).map((f: any) => f.databaseId)

      const hasDatabases = selectedDbs.length > 0
      const hasAllReferences = hasDatabases && selectedDbs.every((dbId: any) => uploadedDbs.includes(dbId))

      return hasDatabases && hasAllReferences
    }
    return true
  }

  const getValidationMessage = () => {
    // Solo mostrar mensajes en los pasos que requieren validación
    if (currentStep === 3) {
      if (!data.selectedTitle) return "Selecciona un título para continuar"
    }
    if (currentStep === 5) {
      const hasTerms =
        (data.protocolTerms?.tecnologia?.length ?? 0) > 0 ||
        (data.protocolTerms?.dominio?.length ?? 0) > 0 ||
        (data.protocolTerms?.focosTematicos?.length ?? 0) > 0

      const hasConfirmed =
        (data.confirmedTerms?.tecnologia?.size ?? 0) > 0 ||
        (data.confirmedTerms?.dominio?.size ?? 0) > 0 ||
        (data.confirmedTerms?.focosTematicos?.size ?? 0) > 0

      if (!hasTerms) return "Genera términos con IA o agrégalos manualmente"
      if (!hasConfirmed) return "Confirma al menos un término con ✓"
    }
    if (currentStep === 6) {
      const selectedDbs = (data.searchPlan?.databases || []).map((db: any) =>
        typeof db === 'object' && db !== null && 'id' in db ? db.id : db
      )
      const uploadedDbs = (data.searchPlan?.uploadedFiles || []).map((f: any) => f.databaseId)

      const hasDatabases = selectedDbs.length > 0
      const hasAllReferences = hasDatabases && selectedDbs.every((dbId: any) => uploadedDbs.includes(dbId))

      if (!hasDatabases) return "Genera las cadenas de búsqueda primero"
      if (!hasAllReferences) {
        const missingDbs = selectedDbs.filter((dbId: any) => !uploadedDbs.includes(dbId))
        return `Falta cargar referencias de: ${missingDbs.join(', ')}`
      }
    }

    // Si no hay mensaje de validación, retornar "Siguiente"
    return "Siguiente"
  }

  const canGoNext = validateStep()
  const validationMessage = getValidationMessage()

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return <ProposalStep />
      case 2:
        return <PicoMatrixStep />
      case 3:
        return <TitlesStep />
      case 4:
        return <CriteriaStep />
      case 5:
        return <ProtocolDefinitionStep />
      case 6:
        return <SearchPlanStep />
      case 7:
        return <PrismaCheckStep />
      default:
        return <ProposalStep />
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <WizardHeader />

      <main className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="mb-24">{renderStep()}</div>
      </main>

      <WizardNavigation
        canGoNext={canGoNext}
        isLastStep={currentStep === 7}
        nextLabel={validationMessage}
        onNext={async () => {
          if (!validateStep()) return

          if (currentStep === 1 && !data.projectId) {
            await handleStartProject()
          }

          if (currentStep === 7) {
            handleCreateProject()
          } else {
            updateData({ currentStep: currentStep + 1 })
            window.scrollTo({ top: 0, behavior: "smooth" })
          }
        }}
        onBack={() => {
          if (currentStep > 1) {
            updateData({ currentStep: currentStep - 1 })
            window.scrollTo({ top: 0, behavior: "smooth" })
          }
        }}
      />
    </div>
  )
}

export default function NewProjectWizardPage() {
  const searchParams = useSearchParams()
  const projectId = searchParams.get('projectId')

  // Si NO hay projectId, es un proyecto completamente nuevo - limpiar localStorage
  if (!projectId) {
    try {
      localStorage.removeItem('wizard-draft')
    } catch (e) {
      // Non-critical: localStorage may be unavailable (e.g., private browsing)
    }
  }

  return (
    <WizardProvider projectId={projectId || undefined}>
      <WizardContent />
    </WizardProvider>
  )
}
