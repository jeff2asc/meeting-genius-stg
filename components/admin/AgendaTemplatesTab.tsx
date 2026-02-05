"use client"

import { useState, useEffect } from "react"
import { FileText, CheckCircle2 } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Company } from "@/lib/supabase"

interface AgendaTemplatesTabProps {
  companies: Company[]
  loading: boolean
}

export default function AgendaTemplatesTab({ companies, loading }: AgendaTemplatesTabProps) {
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null)

  useEffect(() => {
    if (companies.length > 0 && !selectedCompanyId) {
      setSelectedCompanyId(companies[0].id)
    }
  }, [companies])

  return (
    <>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-foreground mb-2">Agenda Templates</h2>
        <p className="text-muted-foreground">
          Meeting agendas use the built-in default template. Download from any meeting in Working Agenda or Agenda status.
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
          <p className="text-sm text-muted-foreground">Create a company first</p>
        </div>
      ) : (
        <Card className="p-6">
          <div className="flex items-start gap-4">
            <div className="rounded-full bg-primary/10 p-2 shrink-0">
              <CheckCircle2 className="h-6 w-6 text-primary" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-foreground mb-1">Default template in use</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Agendas are generated with the standard layout: cover page, meeting information, and agenda items by section. No setup required.
              </p>
              <label className="text-sm font-medium text-foreground">Company (for reference)</label>
              <select
                value={selectedCompanyId ?? ""}
                onChange={(e) => setSelectedCompanyId(e.target.value ? Number(e.target.value) : null)}
                className="mt-2 w-full max-w-xs px-3 py-2 bg-background border border-border rounded focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </Card>
      )}
    </>
  )
}
