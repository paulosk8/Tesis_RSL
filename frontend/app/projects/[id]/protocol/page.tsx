"use client"

import { useEffect, useState } from "react"
import { DashboardNav } from "@/components/dashboard/dashboard-nav"
import { apiClient } from "@/lib/api-client"
import { Loader2 } from "lucide-react"
import type { Project } from "@/lib/types"
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

function ProtocolWizardContent() {
  const { currentStep } = useWizard()

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
    <>
      <WizardHeader />
      <div className="max-w-6xl mx-auto">
        {renderStep()}
      </div>
      <WizardNavigation />
    </>
  )
}

export default function ProtocolPage({ params }: { readonly params: { id: string } }) {
  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadProject() {
      try {
        const data = await apiClient.getProject(params.id)
        setProject(data)
      } catch (error) {
        console.error("Error cargando proyecto:", error)
      } finally {
        setLoading(false)
      }
    }

    loadProject()
  }, [params.id])

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="text-muted-foreground">Cargando proyecto...</span>
        </div>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Proyecto no encontrado</h2>
          <p className="text-muted-foreground">No se pudo cargar el proyecto solicitado</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <DashboardNav />
      <main className="container mx-auto px-4 py-8">
        <WizardProvider
          projectId={params.id}
          projectData={{
            title: project.title,
            description: project.description || "",
            researchArea: project.researchArea
          }}
        >
          <ProtocolWizardContent />
        </WizardProvider>
      </main>
    </div>
  )
}
