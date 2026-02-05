"use client"

import { useState, useEffect } from "react"
import { GripVertical, Save, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { supabase } from "@/lib/supabase"
import { Company } from "@/lib/supabase"

interface SimpleAgendaEditorProps {
  company: Company
  onBack: () => void
}

type BlockId = "cover" | "meeting_info" | "agenda_items"

interface TemplateBlock {
  id: BlockId
  label: string
  icon: string
  description: string
  backgroundColor: string
}

const DEFAULT_BLOCKS: TemplateBlock[] = [
  {
    id: "cover",
    label: "Cover Page",
    icon: "📋",
    description: "Logo, meeting title, building name",
    backgroundColor: "#0f235a"
  },
  {
    id: "meeting_info",
    label: "Meeting Information",
    icon: "📅",
    description: "Date, time, location, address, strata plan",
    backgroundColor: "#ffffff"
  },
  {
    id: "agenda_items",
    label: "Agenda Items",
    icon: "📝",
    description: "Sections and topics",
    backgroundColor: "#648cff"
  }
]

export default function SimpleAgendaEditor({ company, onBack }: SimpleAgendaEditorProps) {
  const [blocks, setBlocks] = useState<TemplateBlock[]>(DEFAULT_BLOCKS)
  const [saving, setSaving] = useState(false)
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [hasChanges, setHasChanges] = useState(false)
  const [loadingTemplate, setLoadingTemplate] = useState(false)

  useEffect(() => {
    loadTemplate()
  }, [company.id])

  const loadTemplate = async () => {
    setLoadingTemplate(true)
    try {
      const { data, error } = await supabase
        .from("company_agenda_templates")
        .select("blocks")
        .eq("company_id", company.id)
        .single()

      if (error) {
        if (error.code === "PGRST116") {
          setBlocks(DEFAULT_BLOCKS)
        } else {
          console.error("Error loading template:", error)
        }
      } else if (data?.blocks?.simple) {
        const savedBlocks = data.blocks.simple as TemplateBlock[]
        setBlocks(savedBlocks)
      } else {
        setBlocks(DEFAULT_BLOCKS)
      }

      setHasChanges(false)
    } catch (err) {
      console.error("Unexpected error:", err)
    } finally {
      setLoadingTemplate(false)
    }
  }

  const handleDragStart = (index: number) => {
    setDraggedIndex(index)
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()

    if (draggedIndex === null || draggedIndex === index) return

    const newBlocks = [...blocks]
    const draggedBlock = newBlocks[draggedIndex]

    newBlocks.splice(draggedIndex, 1)
    newBlocks.splice(index, 0, draggedBlock)

    setBlocks(newBlocks)
    setDraggedIndex(index)
    setHasChanges(true)
  }

  const handleDragEnd = () => {
    setDraggedIndex(null)
  }

  const handleColorChange = (id: BlockId, color: string) => {
    const newBlocks = blocks.map((block) =>
      block.id === id ? { ...block, backgroundColor: color } : block
    )
    setBlocks(newBlocks)
    setHasChanges(true)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const { data: existing } = await supabase
        .from("company_agenda_templates")
        .select("id, blocks")
        .eq("company_id", company.id)
        .single()

      const templateData = {
        company_id: company.id,
        blocks: {
          ...(existing?.blocks || {}),
          simple: blocks
        }
      }

      if (existing) {
        const { error } = await supabase
          .from("company_agenda_templates")
          .update({
            blocks: templateData.blocks,
            updated_at: new Date().toISOString()
          })
          .eq("company_id", company.id)

        if (error) throw error
      } else {
        const { error } = await supabase
          .from("company_agenda_templates")
          .insert(templateData)

        if (error) throw error
      }

      setHasChanges(false)
      alert("✅ Template saved successfully!")
    } catch (err: any) {
      console.error("Error saving template:", err)
      alert("Failed to save template")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <div className="border-b border-border bg-card px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={onBack}>
            ← Back
          </Button>
          <div className="h-6 w-px bg-border" />
          <div>
            <h2 className="text-lg font-semibold text-foreground">Agenda Template</h2>
            <p className="text-xs text-muted-foreground">{company.name}</p>
          </div>
        </div>

        <Button
          onClick={handleSave}
          disabled={saving || !hasChanges}
          className="bg-gradient-to-r from-primary to-decision-purple text-primary-foreground"
        >
          <Save className="h-4 w-4 mr-2" />
          {saving ? "Saving..." : "Save Template"}
        </Button>
      </div>

      <div className="flex-1 p-8 max-w-4xl mx-auto w-full">
        <Card className="p-6 mb-6">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-foreground">Agenda Layout</h3>
            <p className="text-sm text-muted-foreground">
              Drag blocks to reorder them. Change colors for each section.
            </p>
          </div>

          {loadingTemplate ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Loading template...</p>
            </div>
          ) : (
            <div className="space-y-2">
              {blocks.map((block, index) => (
                <div
                  key={block.id}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragEnd={handleDragEnd}
                  className={`flex items-center gap-3 p-4 bg-background border-2 rounded-lg cursor-move transition-all ${
                    draggedIndex === index
                      ? "border-primary bg-primary/5 opacity-50"
                      : "border-border hover:border-primary/50 hover:shadow-md"
                  }`}
                >
                  <GripVertical className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  <div className="flex items-center gap-3 flex-1">
                    <span className="text-2xl">{block.icon}</span>
                    <div>
                      <p className="font-semibold text-foreground">{block.label}</p>
                      <p className="text-xs text-muted-foreground">{block.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-muted-foreground">Color:</label>
                    <input
                      type="color"
                      value={block.backgroundColor}
                      onChange={(e) => handleColorChange(block.id, e.target.value)}
                      className="w-12 h-8 rounded border border-border cursor-pointer"
                    />
                  </div>
                  <div className="text-sm text-muted-foreground font-mono">#{index + 1}</div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-4 bg-blue-50 border-blue-200">
          <div className="flex items-start gap-3">
            <FileText className="h-5 w-5 text-blue-600 mt-0.5" />
            <div>
              <h4 className="font-semibold text-blue-900 mb-1">Template Preview</h4>
              <p className="text-sm text-blue-800 mb-2">
                When generating agendas for <strong>{company.name}</strong>, sections will appear
                in this order:
              </p>
              <ol className="text-sm text-blue-800 space-y-1 ml-4">
                {blocks.map((block, index) => (
                  <li key={block.id}>
                    {index + 1}. {block.icon} {block.label}
                    <span
                      className="ml-2 inline-block w-4 h-4 rounded border border-blue-300"
                      style={{ backgroundColor: block.backgroundColor }}
                    />
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
