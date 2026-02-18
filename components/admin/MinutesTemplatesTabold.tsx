"use client"

import { useState, useEffect } from "react"
import { GripVertical, Save, FileText, ChevronDown, ChevronRight, Edit2, Eye, EyeOff, X } from "lucide-react"
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

type BlockType = "header" | "attendees" | "topics" | "footer"

interface TemplateField {
  id: string
  label: string
  visible: boolean
  order: number
}

interface TemplateSection {
  id: BlockType
  label: string
  icon: string
  description: string
  backgroundColor: string
  fields: TemplateField[]
}

interface TemplateConfig {
  sections: TemplateSection[]
}

const DEFAULT_TEMPLATE: TemplateConfig = {
  sections: [
    {
      id: "header",
      label: "Header",
      icon: "📋",
      description: "Building name, meeting type, date, time, location",
      backgroundColor: "#f8fafc",
      fields: [
        { id: "building_name", label: "Building Name", visible: true, order: 1 },
        { id: "meeting_type", label: "Meeting Type", visible: true, order: 2 },
        { id: "meeting_date", label: "Meeting Date", visible: true, order: 3 },
        { id: "start_time", label: "Start Time", visible: true, order: 4 },
        { id: "location", label: "Location", visible: true, order: 5 },
        { id: "strata_plan", label: "Strata Plan Number", visible: true, order: 6 },
      ],
    },
    {
      id: "attendees",
      label: "Attendees",
      icon: "👥",
      description: "Present, absent, regrets",
      backgroundColor: "#ffffff",
      fields: [
        { id: "present", label: "Present", visible: true, order: 1 },
        { id: "absent", label: "Absent", visible: true, order: 2 },
        { id: "regrets", label: "Regrets", visible: true, order: 3 },
      ],
    },
    {
      id: "topics",
      label: "Topics, Motions & Notes",
      icon: "📝",
      description: "Topics with descriptions, notes, and inline motions (Motion X.Y, Decision, Votes)",
      backgroundColor: "#ffffff",
      fields: [],
    },
    {
      id: "footer",
      label: "Footer",
      icon: "✍️",
      description: "Adjournment, signatures, next meeting",
      backgroundColor: "#f8fafc",
      fields: [
        { id: "adjournment", label: "Meeting Adjourned", visible: true, order: 1 },
        { id: "next_meeting", label: "Next Meeting Date", visible: true, order: 2 },
        { id: "prepared_by", label: "Minutes Prepared By", visible: true, order: 3 },
        { id: "signatures", label: "Signatures", visible: true, order: 4 },
      ],
    },
  ],
}

export default function MinutesTemplatesTab({ buildings, loading }: MinutesTemplatesTabProps) {
  const [selectedBuildingId, setSelectedBuildingId] = useState<number | null>(null)
  const [template, setTemplate] = useState<TemplateConfig>(DEFAULT_TEMPLATE)
  const [saving, setSaving] = useState(false)
  const [draggedSectionIndex, setDraggedSectionIndex] = useState<number | null>(null)
  const [draggedFieldIndex, setDraggedFieldIndex] = useState<number | null>(null)
  const [hasChanges, setHasChanges] = useState(false)
  const [loadingTemplate, setLoadingTemplate] = useState(false)
  const [expandedSectionId, setExpandedSectionId] = useState<BlockType | null>(null)
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null)
  const [editingFieldLabel, setEditingFieldLabel] = useState("")

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
        .from("minutes_templates")
        .select("blocks")
        .eq("building_id", selectedBuildingId)
        .single()

      if (error) {
        if (error.code === "PGRST116") {
          setTemplate(DEFAULT_TEMPLATE)
        } else {
          console.error("Error loading template:", error)
        }
      } else if (data && data.blocks) {
        // Old format: array of section ids
        if (Array.isArray(data.blocks) && typeof data.blocks[0] === "string") {
          const oldBlockIds = data.blocks as BlockType[]
          const migratedSections = oldBlockIds
            .map((id) => DEFAULT_TEMPLATE.sections.find((s) => s.id === id))
            .filter(Boolean) as TemplateSection[]

          setTemplate({ sections: migratedSections })
        } else {
          // New format - but strip any legacy "decisions" section if present
          const incoming = data.blocks as TemplateConfig
          const cleanedSections = (incoming.sections || []).filter(
            (s) => s.id !== ("decisions" as any)
          )
          // Ensure topics description matches new inline motion layout
          const adjustedSections = cleanedSections.map((s) =>
            s.id === "topics"
              ? {
                  ...s,
                  label: "Topics, Motions & Notes",
                  description:
                    "Topics with descriptions, notes, and inline motions (Motion X.Y, Decision, Votes)",
                }
              : s
          )
          setTemplate({ sections: adjustedSections.length ? adjustedSections : DEFAULT_TEMPLATE.sections })
        }
      }

      setHasChanges(false)
      setExpandedSectionId(null)
    } catch (err) {
      console.error("Unexpected error:", err)
    } finally {
      setLoadingTemplate(false)
    }
  }

  // Section drag handlers
  const handleSectionDragStart = (index: number) => {
    setDraggedSectionIndex(index)
  }

  const handleSectionDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()

    if (draggedSectionIndex === null || draggedSectionIndex === index) return

    const newSections = [...template.sections]
    const draggedSection = newSections[draggedSectionIndex]

    newSections.splice(draggedSectionIndex, 1)
    newSections.splice(index, 0, draggedSection)

    setTemplate({ sections: newSections })
    setDraggedSectionIndex(index)
    setHasChanges(true)
  }

  const handleSectionDragEnd = () => {
    setDraggedSectionIndex(null)
  }

  // Field drag handlers
  const handleFieldDragStart = (index: number) => {
    setDraggedFieldIndex(index)
  }

  const handleFieldDragOver = (e: React.DragEvent, sectionId: BlockType, index: number) => {
    e.preventDefault()
    e.stopPropagation()

    if (draggedFieldIndex === null || draggedFieldIndex === index) return

    const sectionIndex = template.sections.findIndex((s) => s.id === sectionId)
    if (sectionIndex === -1) return

    const newSections = [...template.sections]
    const fields = [...newSections[sectionIndex].fields]
    const draggedField = fields[draggedFieldIndex]

    fields.splice(draggedFieldIndex, 1)
    fields.splice(index, 0, draggedField)

    fields.forEach((field, idx) => {
      field.order = idx + 1
    })

    newSections[sectionIndex].fields = fields
    setTemplate({ sections: newSections })
    setDraggedFieldIndex(index)
    setHasChanges(true)
  }

  const handleFieldDragEnd = () => {
    setDraggedFieldIndex(null)
  }

  // Toggle field visibility
  const toggleFieldVisibility = (sectionId: BlockType, fieldId: string) => {
    const sectionIndex = template.sections.findIndex((s) => s.id === sectionId)
    if (sectionIndex === -1) return

    const newSections = [...template.sections]
    const fieldIndex = newSections[sectionIndex].fields.findIndex((f) => f.id === fieldId)
    if (fieldIndex === -1) return

    newSections[sectionIndex].fields[fieldIndex].visible =
      !newSections[sectionIndex].fields[fieldIndex].visible
    setTemplate({ sections: newSections })
    setHasChanges(true)
  }

  // Edit field label
  const startEditingField = (fieldId: string, currentLabel: string) => {
    setEditingFieldId(fieldId)
    setEditingFieldLabel(currentLabel)
  }

  const saveFieldLabel = (sectionId: BlockType, fieldId: string) => {
    const sectionIndex = template.sections.findIndex((s) => s.id === sectionId)
    if (sectionIndex === -1) return

    const newSections = [...template.sections]
    const fieldIndex = newSections[sectionIndex].fields.findIndex((f) => f.id === fieldId)
    if (fieldIndex === -1) return

    newSections[sectionIndex].fields[fieldIndex].label = editingFieldLabel
    setTemplate({ sections: newSections })
    setEditingFieldId(null)
    setEditingFieldLabel("")
    setHasChanges(true)
  }

  const cancelEditingField = () => {
    setEditingFieldId(null)
    setEditingFieldLabel("")
  }

  // Change background color
  const changeBackgroundColor = (sectionId: BlockType, color: string) => {
    const sectionIndex = template.sections.findIndex((s) => s.id === sectionId)
    if (sectionIndex === -1) return

    const newSections = [...template.sections]
    newSections[sectionIndex].backgroundColor = color
    setTemplate({ sections: newSections })
    setHasChanges(true)
  }

  const handleSave = async () => {
    if (!selectedBuildingId) {
      alert("Please select a building")
      return
    }

    setSaving(true)
    try {
      const { data: existing } = await supabase
        .from("minutes_templates")
        .select("id")
        .eq("building_id", selectedBuildingId)
        .single()

      if (existing) {
        const { error } = await supabase
          .from("minutes_templates")
          .update({ blocks: template, updated_at: new Date().toISOString() })
          .eq("building_id", selectedBuildingId)

        if (error) {
          console.error("Error updating template:", error)
          alert("Failed to save template")
          return
        }
      } else {
        const { error } = await supabase
          .from("minutes_templates")
          .insert({
            building_id: selectedBuildingId,
            blocks: template,
          })

        if (error) {
          console.error("Error creating template:", error)
          alert("Failed to save template")
          return
        }
      }

      setHasChanges(false)
      alert("✅ Template saved successfully!")
    } catch (err) {
      console.error("Unexpected error:", err)
      alert("Failed to save template")
    } finally {
      setSaving(false)
    }
  }

  const selectedBuilding = buildings.find((b) => b.id === selectedBuildingId)

  return (
    <>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-foreground mb-2">Minutes Templates</h2>
        <p className="text-muted-foreground">
          Customize the layout, fields, and styling of meeting minutes for each building
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
          <p className="text-sm text-muted-foreground">
            Create a building first to manage its minutes template
          </p>
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
                {buildings.map((building) => (
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
                    <p className="text-sm text-muted-foreground">
                      Drag sections to reorder, click to customize fields
                    </p>
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
                  {template.sections.map((section, sectionIndex) => (
                    <div
                      key={section.id}
                      className={`border-2 rounded-lg transition-all ${
                        draggedSectionIndex === sectionIndex
                          ? "border-primary bg-primary/5 opacity-50"
                          : "border-border hover:border-primary/50 hover:shadow-md"
                      }`}
                    >
                      {/* Section Header */}
                      <div
                        draggable
                        onDragStart={() => handleSectionDragStart(sectionIndex)}
                        onDragOver={(e) => handleSectionDragOver(e, sectionIndex)}
                        onDragEnd={handleSectionDragEnd}
                        className="flex items-center gap-3 p-4 bg-background cursor-move"
                      >
                        <GripVertical className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                        <button
                          onClick={() =>
                            setExpandedSectionId(
                              expandedSectionId === section.id ? null : section.id
                            )
                          }
                          className="flex items-center gap-3 flex-1 text-left"
                        >
                          {expandedSectionId === section.id ? (
                            <ChevronDown className="h-5 w-5 text-primary" />
                          ) : (
                            <ChevronRight className="h-5 w-5 text-muted-foreground" />
                          )}
                          <span className="text-2xl">{section.icon}</span>
                          <div>
                            <p className="font-semibold text-foreground">{section.label}</p>
                            <p className="text-xs text-muted-foreground">
                              {section.description}
                            </p>
                          </div>
                        </button>
                        <div className="flex items-center gap-2">
                          {section.fields.length > 0 && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                setExpandedSectionId(
                                  expandedSectionId === section.id ? null : section.id
                                )
                              }
                              className="text-primary"
                            >
                              <Edit2 className="h-4 w-4 mr-1" />
                              Customize
                            </Button>
                          )}
                          <div className="text-sm text-muted-foreground font-mono">
                            #{sectionIndex + 1}
                          </div>
                        </div>
                      </div>

                      {/* Expanded Field Editor */}
                      {expandedSectionId === section.id && section.fields.length > 0 && (
                        <div className="border-t border-border p-4 bg-muted/20">
                          <div className="mb-4 flex items-center gap-4">
                            <label className="text-sm font-medium text-foreground">
                              Background Color:
                            </label>
                            <input
                              type="color"
                              value={section.backgroundColor}
                              onChange={(e) =>
                                changeBackgroundColor(section.id, e.target.value)
                              }
                              className="h-10 w-20 rounded border border-border cursor-pointer"
                            />
                            <span className="text-xs text-muted-foreground font-mono">
                              {section.backgroundColor}
                            </span>
                          </div>

                          <h4 className="text-sm font-semibold text-foreground mb-3">
                            Fields (drag to reorder):
                          </h4>
                          <div className="space-y-2">
                            {section.fields.map((field, fieldIndex) => (
                              <div
                                key={field.id}
                                draggable
                                onDragStart={() => handleFieldDragStart(fieldIndex)}
                                onDragOver={(e) =>
                                  handleFieldDragOver(e, section.id, fieldIndex)
                                }
                                onDragEnd={handleFieldDragEnd}
                                className={`flex items-center gap-3 p-3 bg-background border rounded-lg cursor-move transition-all ${
                                  draggedFieldIndex === fieldIndex
                                    ? "border-primary opacity-50"
                                    : "border-border hover:border-primary/50"
                                }`}
                              >
                                <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />

                                {editingFieldId === field.id ? (
                                  <div className="flex-1 flex items-center gap-2">
                                    <input
                                      type="text"
                                      value={editingFieldLabel}
                                      onChange={(e) =>
                                        setEditingFieldLabel(e.target.value)
                                      }
                                      className="flex-1 px-2 py-1 border border-primary rounded text-sm"
                                      autoFocus
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter")
                                          saveFieldLabel(section.id, field.id)
                                        if (e.key === "Escape") cancelEditingField()
                                      }}
                                    />
                                    <Button
                                      size="sm"
                                      onClick={() =>
                                        saveFieldLabel(section.id, field.id)
                                      }
                                      className="bg-primary"
                                    >
                                      Save
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={cancelEditingField}
                                    >
                                      <X className="h-4 w-4" />
                                    </Button>
                                  </div>
                                ) : (
                                  <>
                                    <span className="flex-1 text-sm font-medium text-foreground">
                                      {field.label}
                                    </span>
                                    <div className="flex items-center gap-2">
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() =>
                                          startEditingField(field.id, field.label)
                                        }
                                        title="Edit label"
                                      >
                                        <Edit2 className="h-3 w-3" />
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() =>
                                          toggleFieldVisibility(section.id, field.id)
                                        }
                                        title={
                                          field.visible ? "Hide field" : "Show field"
                                        }
                                        className={
                                          field.visible
                                            ? "text-green-600"
                                            : "text-gray-400"
                                        }
                                      >
                                        {field.visible ? (
                                          <Eye className="h-4 w-4" />
                                        ) : (
                                          <EyeOff className="h-4 w-4" />
                                        )}
                                      </Button>
                                      <span className="text-xs text-muted-foreground font-mono w-8 text-center">
                                        #{field.order}
                                      </span>
                                    </div>
                                  </>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </Card>

              {/* Preview Info */}
              <Card className="p-4 bg-blue-50 border-blue-200">
                <div className="flex items-start gap-3">
                  <FileText className="h-5 w-5 text-blue-600 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-blue-900 mb-1">
                      Template Preview
                    </h4>
                    <p className="text-sm text-blue-800 mb-2">
                      When generating minutes for{" "}
                      <strong>{selectedBuilding?.name}</strong>, sections will appear
                      in this order:
                    </p>
                    <ol className="text-sm text-blue-800 space-y-1 ml-4">
                      {template.sections.map((section, index) => (
                        <li key={section.id}>
                          {index + 1}. {section.icon} {section.label}
                          {section.fields.length > 0 && (
                            <span className="text-blue-600 ml-2">
                              ({section.fields.filter((f) => f.visible).length} visible
                              fields)
                            </span>
                          )}
                        </li>
                      ))}
                    </ol>
                    <p className="text-xs text-blue-700 mt-3">
                      Motions are rendered inline under each topic as{" "}
                      <strong>Motion X.Y / Decision / Votes</strong> in the minutes
                      PDF.
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
