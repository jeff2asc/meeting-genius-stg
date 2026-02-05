"use client"

import { useState } from "react"
import { FileText, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Company } from "@/lib/supabase"
import AgendaTemplateCanvas from "./AgendaTemplateCanvas"

interface AgendaTemplatesTabProps {
  companies: Company[]
  loading: boolean
}

export default function AgendaTemplatesTab({ companies, loading }: AgendaTemplatesTabProps) {
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null)
  const [showCanvas, setShowCanvas] = useState(false)

  const selectedCompany = companies.find(c => c.id === selectedCompanyId)

  // Only show Advanced Canvas when user has selected a company and opened the editor
  if (selectedCompany && showCanvas) {
    return (
      <AgendaTemplateCanvas
        company={selectedCompany}
        onBack={() => setShowCanvas(false)}
      />
    )
  }

  // Company selection only (dropdown); no Simple Editor
  return (
    <>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-foreground mb-2">Agenda Templates</h2>
        <p className="text-muted-foreground">
          Customize the layout and styling of meeting agendas for each company using the Advanced Editor
        </p>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading companies...</p>
        </div>
      ) : companies.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-border rounded-lg">
          <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
          <p className="text-muted-foreground mb-2">No companies available</p>
          <p className="text-sm text-muted-foreground">Create a company first to manage its agenda template</p>
        </div>
      ) : (
        <Card className="p-4 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex-1 flex items-center gap-4">
              <label className="text-sm font-semibold text-foreground whitespace-nowrap">Select Company:</label>
              <select
                value={selectedCompanyId ?? ""}
                onChange={(e) => {
                  const val = e.target.value
                  setSelectedCompanyId(val ? Number(val) : null)
                  setShowCanvas(false)
                }}
                className="flex-1 px-3 py-2 bg-background border border-border rounded focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                <option value="">Select a company...</option>
                {companies.map(company => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>
            </div>
            {selectedCompanyId && (
              <Button
                onClick={() => setShowCanvas(true)}
                className="gap-2 bg-gradient-to-r from-primary to-decision-purple text-primary-foreground hover:opacity-90 shrink-0"
              >
                <Sparkles className="h-4 w-4" />
                Open Advanced Editor
              </Button>
            )}
          </div>
        </Card>
      )}
    </>
  )
}
