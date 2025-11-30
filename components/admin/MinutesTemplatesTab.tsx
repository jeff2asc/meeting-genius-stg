"use client"

import { useState, useEffect } from "react"
import { GripVertical, Save, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { supabase } from "@/lib/supabase"

interface Building {
  id: number
  name: string
  address: string | null
  manager_id: number
  company_id: number | null
  created_at: string
}

interface MinutesTemplatesTabProps {
  buildings: Building[]
  loading: boolean
}

type BlockType = "header" | "attendees" | "topics" | "decisions" | "footer"

interface TemplateBlock {
  id: BlockType
  label: string
  icon: string
  description: string
}

const DEFAULT_BLOCKS: TemplateBlock[] = [
  { id: "header", label: "Header", icon: "📋", description: "Building name, meeting type, date, time, location" },
  { id: "attendees", label: "Attendees", icon: "👥", description: "Present, absent, regrets" },
  { id: "topics", label: "Topics & Notes", icon: "📝", description: "Discussion topics with descriptions and notes" },
  { id: "decisions", label: "Decisions & Votes", icon: "⚖️", description: "Motions, results, vote counts" },
  { id: "footer", label: "Footer", icon: "✍️", description: "Adjournment, signatures, next meeting" }
]

export default function MinutesTemplatesTab({ buildings, loading }: MinutesTemplatesTabProps) {
  const [selectedBuildingId, setSelectedBuildingId] = useState<number | null>(null)
  const [blocks, setBlocks] = useState<TemplateBlock[]>(DEFAULT_BLOCKS)
  const [saving, setSaving] = useState(false)
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [hasChanges, setHasChanges] = useState(false)
  const [loadingTemplate, setLoadingTemplate] = useState(false)

  useEffect(() => {
    if (buildings.length > 0 && !selectedBuildingId) {
      setSelectedBuildingId(buildings[0].id)
    }
  }, [buildings])

  useEffect(() => {
    if (selectedBuildingId) {
      loadTemplate()
    }
  }, [selectedBuildingId])

  const loadTemplate = async () => {
    if (!selectedBuildingId) return

    setLoadingTemplate(true)
    try {
      const { data, error } = await supabase
        .from('minutes_templates')
        .select('blocks')
        .eq('building_id', selectedBuildingId)
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          // No template exists yet, use defaults
          setBlocks(DEFAULT_BLOCKS)
        } else {
          console.error('Error loading template:', error)
        }
      } else if (data && data.blocks) {
        // Reconstruct blocks from saved IDs
        const savedBlockIds = data.blocks as BlockType[]
        const reconstructedBlocks = savedBlockIds
          .map(id => DEFAULT_BLOCKS.find(b => b.id === id))
          .filter(Boolean) as TemplateBlock[]
        
        setBlocks(reconstructedBlocks)
      }
      
      setHasChanges(false)
    } catch (err) {
      console.error('Unexpected error:', err)
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

  const handleSave = async () => {
    if (!selectedBuildingId) {
      alert('Please select a building')
      return
    }

    setSaving(true)
    try {
      const blockIds = blocks.map(b => b.id)

      // Check if template exists
      const { data: existing } = await supabase
        .from('minutes_templates')
        .select('id')
        .eq('building_id', selectedBuildingId)
        .single()

      if (existing) {
        // Update existing
        const { error } = await supabase
          .from('minutes_templates')
          .update({ blocks: blockIds, updated_at: new Date().toISOString() })
          .eq('building_id', selectedBuildingId)

        if (error) {
          console.error('Error updating template:', error)
          alert('Failed to save template')
          return
        }
      } else {
        // Insert new
        const { error } = await supabase
          .from('minutes_templates')
          .insert({
            building_id: selectedBuildingId,
            blocks: blockIds
          })

        if (error) {
          console.error('Error creating template:', error)
          alert('Failed to save template')
          return
        }
      }

      setHasChanges(false)
      alert('✅ Template saved successfully!')
    } catch (err) {
      console.error('Unexpected error:', err)
      alert('Failed to save template')
    } finally {
      setSaving(false)
    }
  }

  const selectedBuilding = buildings.find(b => b.id === selectedBuildingId)

  return (
    <>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-foreground mb-2">Minutes Templates</h2>
        <p className="text-muted-foreground">
          Customize the layout and order of sections in meeting minutes for each building
        </p>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading buildings...</p>
        </div>
      ) : buildings.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-border rounded-lg">
          <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
          <p className="text-muted-foreground mb-2">No buildings available</p>
          <p className="text-sm text-muted-foreground">Create a building first to manage its minutes template</p>
        </div>
      ) : (
        <>
          {/* Building Selector */}
          <Card className="p-4 mb-6">
            <div className="flex items-center gap-4">
              <label className="text-sm font-semibold text-foreground">Select Building:</label>
              <select
                value={selectedBuildingId || ""}
                onChange={(e) => setSelectedBuildingId(Number(e.target.value))}
                className="flex-1 px-3 py-2 bg-background border border-border rounded focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                {buildings.map(building => (
                  <option key={building.id} value={building.id}>
                    {building.name}
                  </option>
                ))}
              </select>
            </div>
          </Card>

          {loadingTemplate ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Loading template...</p>
            </div>
          ) : (
            <>
              {/* Template Editor */}
              <Card className="p-6 mb-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">Minutes Layout</h3>
                    <p className="text-sm text-muted-foreground">Drag blocks to reorder them</p>
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
                      <div className="text-sm text-muted-foreground font-mono">
                        #{index + 1}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              {/* Preview Info */}
              <Card className="p-4 bg-blue-50 border-blue-200">
                <div className="flex items-start gap-3">
                  <FileText className="h-5 w-5 text-blue-600 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-blue-900 mb-1">Template Preview</h4>
                    <p className="text-sm text-blue-800 mb-2">
                      When generating minutes for <strong>{selectedBuilding?.name}</strong>, sections will appear in this order:
                    </p>
                    <ol className="text-sm text-blue-800 space-y-1 ml-4">
                      {blocks.map((block, index) => (
                        <li key={block.id}>
                          {index + 1}. {block.icon} {block.label}
                        </li>
                      ))}
                    </ol>
                    <p className="text-xs text-blue-700 mt-3">
                      💡 <strong>Coming soon:</strong> Generate Minutes button in meeting view
                    </p>
                  </div>
                </div>
              </Card>
            </>
          )}
        </>
      )}
    </>
  )
}
