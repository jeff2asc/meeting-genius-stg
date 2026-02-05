"use client"

import { useState, useEffect } from "react"
import { FileText, Pencil } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Company } from "@/lib/supabase"
import AgendaTemplateCanvas from "./AgendaTemplateCanvas"

interface Building {
  id: number
  name: string
  company_id: number | null
}

interface AgendaTemplatesTabProps {
  companies: Company[]
  buildings: Building[]
  loading: boolean
}

export default function AgendaTemplatesTab({ companies, buildings, loading }: AgendaTemplatesTabProps) {
  const [selectedBuildingId, setSelectedBuildingId] = useState<number | null>(null)
  const [showCanvas, setShowCanvas] = useState(false)

  useEffect(() => {
    if (buildings.length > 0 && !selectedBuildingId) {
      setSelectedBuildingId(buildings[0].id)
    }
  }, [buildings])

  const selectedBuilding = buildings.find((b) => b.id === selectedBuildingId)
  const editingCompany =
    selectedBuilding?.company_id != null
      ? companies.find((c) => c.id === selectedBuilding.company_id) ?? null
      : null

  if (editingCompany && showCanvas) {
    return (
      <AgendaTemplateCanvas
        company={editingCompany}
        onBack={() => setShowCanvas(false)}
      />
    )
  }

  return (
    <>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-foreground mb-2">Agenda Templates</h2>
        <p className="text-muted-foreground">
          Customize the layout and design of meeting agendas per company. All buildings in that company will use the saved template when downloading an agenda.
        </p>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      ) : buildings.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-border rounded-lg">
          <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
          <p className="text-muted-foreground mb-2">No buildings available</p>
          <p className="text-sm text-muted-foreground">Create a building first to manage agenda templates</p>
        </div>
      ) : (
        <Card className="p-4 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex-1 flex items-center gap-4">
              <label className="text-sm font-semibold text-foreground whitespace-nowrap">Select Building:</label>
              <select
                value={selectedBuildingId ?? ""}
                onChange={(e) => setSelectedBuildingId(e.target.value ? Number(e.target.value) : null)}
                className="flex-1 px-3 py-2 bg-background border border-border rounded focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                {buildings.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                    {b.company_id ? "" : " (no company)"}
                  </option>
                ))}
              </select>
            </div>
            {editingCompany ? (
              <Button
                onClick={() => setShowCanvas(true)}
                className="gap-2 shrink-0"
              >
                <Pencil className="h-4 w-4" />
                Edit
              </Button>
            ) : (
              <p className="text-sm text-muted-foreground shrink-0">
                Assign a company to this building to edit its agenda template.
              </p>
            )}
          </div>
          {editingCompany && (
            <p className="text-xs text-muted-foreground mt-3">
              Template will apply to <strong>{editingCompany.name}</strong> and all its buildings.
            </p>
          )}
        </Card>
      )}
    </>
  )
}
