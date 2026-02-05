"use client"

import { useState, useEffect } from "react"
import { GripVertical, Save, FileText, ChevronDown, ChevronRight, Edit2, Eye, EyeOff, X, Layout, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { supabase, Company } from "@/lib/supabase"
import AgendaTemplateCanvas from "./AgendaTemplateCanvas"

interface AgendaTemplatesTabProps {
  companies: Company[]
  loading: boolean
}

type BlockType = "header" | "sections" | "footer"
type EditorMode = "simple" | "advanced"

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
  layoutStyle?: string
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
      backgroundColor: "#0f235a",
      layoutStyle: "vertical",
      fields: [
        { id: "building_name", label: "Building Name", visible: true, order: 1 },
        { id: "meeting_type", label: "Meeting Type", visible: true, order: 2 },
        { id: "meeting_date", label: "Meeting Date", visible: true, order: 3 },
        { id: "start_time", label: "Start Time", visible: true, order: 4 },
        { id: "location", label: "Location", visible: true, order: 5 },
        { id: "address", label: "Building Address", visible: true, order: 6 },
        { id: "strata_plan", label: "Strata Plan Number", visible: true, order: 7 }
      ]
    },
    {
      id: "sections",
      label: "Agenda Sections & Topics",
      icon: "📝",
      description: "Meeting agenda items organized by sections",
      backgroundColor: "#648cff",
      layoutStyle: "full_width",
      fields: [
        { id: "section_numbers", label: "Show Section Numbers", visible: true, order: 1 },
        { id: "topic_numbers", label: "Show Topic Numbers", visible: true, order: 2 },
        { id: "topic_descriptions", label: "Show Topic Descriptions", visible: true, order: 3 },
        { id: "incamera_indicator", label: "Show In-Camera Badge", visible: true, order: 4 }
      ]
    },
    {
      id: "footer",
      label: "Footer",
      icon: "✍️",
      description: "Footer information and branding",
      backgroundColor: "#0f235a",
      layoutStyle: "three_column",
      fields: [
        { id: "building_name", label: "Building Name", visible: true, order: 1 },
        { id: "page_number", label: "Page Number", visible: true, order: 2 },
        { id: "branding", label: "Meeting Genius Branding", visible: true, order: 3 }
      ]
    }
  ]
}

const LAYOUT_OPTIONS: Record<BlockType, { value: string; label: string; description: string }[]> = {
  header: [
    { value: "vertical", label: "Vertical (Default)", description: "Information stacked vertically" },
    { value: "horizontal", label: "Horizontal Grid", description: "Information in 2-column grid" },
    { value: "centered", label: "Centered", description: "All information centered" },
    { value: "compact", label: "Compact", description: "Smaller header with tight spacing" }
  ],
  sections: [
    { value: "full_width", label: "Full Width (Default)", description: "Topics in full-width cards" },
    { value: "two_column", label: "Two Columns", description: "Topics side-by-side in 2 columns" },
    { value: "compact", label: "Compact List", description: "Condensed list without descriptions" }
  ],
  footer: [
    { value: "three_column", label: "Three Column (Default)", description: "Left, Center, Right alignment" },
    { value: "centered", label: "Centered", description: "All footer items centered" },
    { value: "stacked", label: "Stacked", description: "Footer items stacked vertically" }
  ]
}

export default function AgendaTemplatesTab({ companies, loading }: AgendaTemplatesTabProps) {
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null)
  const [editorMode, setEditorMode] = useState<EditorMode>("simple")
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
    if (companies.length > 0 && !selectedCompanyId) {
      setSelectedCompanyId(companies[0].id)
    }
  }, [companies])

  useEffect(() => {
    if (selectedCompanyId) {
      loadTemplate()
    }
  }, [selectedCompanyId])

  const loadTemplate = async () => {
    if (!selectedCompanyId) return

    setLoadingTemplate(true)
    try {
      const { data, error } = await supabase
        .from('company_agenda_templates')
        .select('blocks')
        .eq('company_id', selectedCompanyId)
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          setTemplate(DEFAULT_TEMPLATE)
        } else {
          console.error('Error loading template:', error)
        }
      } else if (data && data.blocks) {
        const loadedTemplate = data.blocks as TemplateConfig
        loadedTemplate.sections = loadedTemplate.sections.map(section => ({
          ...section,
          layoutStyle: section.layoutStyle || getDefaultLayoutStyle(section.id)
        }))
        setTemplate(loadedTemplate)
      }
      
      setHasChanges(false)
      setExpandedSectionId(null)
    } catch (err) {
      console.error('Unexpected error:', err)
    } finally {
      setLoadingTemplate(false)
    }
  }

  const getDefaultLayoutStyle = (sectionId: BlockType): string => {
    if (sectionId === "header") return "vertical"
    if (sectionId === "sections") return "full_width"
    if (sectionId === "footer") return "three_column"
    return "vertical"
  }

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

  const handleFieldDragStart = (index: number) => {
    setDraggedFieldIndex(index)
  }

  const handleFieldDragOver = (e: React.DragEvent, sectionId: BlockType, index: number) => {
    e.preventDefault()
    e.stopPropagation()
    
    if (draggedFieldIndex === null || draggedFieldIndex === index) return

    const sectionIndex = template.sections.findIndex(s => s.id === sectionId)
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

  const toggleFieldVisibility = (sectionId: BlockType, fieldId: string) => {
    const sectionIndex = template.sections.findIndex(s => s.id === sectionId)
    if (sectionIndex === -1) return

    const newSections = [...template.sections]
    const fieldIndex = newSections[sectionIndex].fields.findIndex(f => f.id === fieldId)
    if (fieldIndex === -1) return

    newSections[sectionIndex].fields[fieldIndex].visible = !newSections[sectionIndex].fields[fieldIndex].visible
    setTemplate({ sections: newSections })
    setHasChanges(true)
  }

  const startEditingField = (fieldId: string, currentLabel: string) => {
    setEditingFieldId(fieldId)
    setEditingFieldLabel(currentLabel)
  }

  const saveFieldLabel = (sectionId: BlockType, fieldId: string) => {
    const sectionIndex = template.sections.findIndex(s => s.id === sectionId)
    if (sectionIndex === -1) return

    const newSections = [...template.sections]
    const fieldIndex = newSections[sectionIndex].fields.findIndex(f => f.id === fieldId)
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

  const changeBackgroundColor = (sectionId: BlockType, color: string) => {
    const sectionIndex = template.sections.findIndex(s => s.id === sectionId)
    if (sectionIndex === -1) return

    const newSections = [...template.sections]
    newSections[sectionIndex].backgroundColor = color
    setTemplate({ sections: newSections })
    setHasChanges(true)
  }

  const changeLayoutStyle = (sectionId: BlockType, style: string) => {
    const sectionIndex = template.sections.findIndex(s => s.id === sectionId)
    if (sectionIndex === -1) return

    const newSections = [...template.sections]
    newSections[sectionIndex].layoutStyle = style
    setTemplate({ sections: newSections })
    setHasChanges(true)
  }

  const handleSave = async () => {
    if (!selectedCompanyId) {
      alert('Please select a company')
      return
    }

    setSaving(true)
    try {
      const { data: existing } = await supabase
        .from('company_agenda_templates')
        .select('id')
        .eq('company_id', selectedCompanyId)
        .single()

      if (existing) {
        const { error } = await supabase
          .from('company_agenda_templates')
          .update({ blocks: template, updated_at: new Date().toISOString() })
          .eq('company_id', selectedCompanyId)

        if (error) {
          console.error('Error updating template:', error)
          alert('Failed to save template')
          return
        }
      } else {
        const { error } = await supabase
          .from('company_agenda_templates')
          .insert({
            company_id: selectedCompanyId,
            blocks: template
          })

        if (error) {
          console.error('Error creating template:', error)
          alert('Failed to save template')
          return
        }
      }

      setHasChanges(false)
      alert('✅ Agenda template saved successfully!')
    } catch (err) {
      console.error('Unexpected error:', err)
      alert('Failed to save template')
    } finally {
      setSaving(false)
    }
  }

  const selectedCompany = companies.find(c => c.id === selectedCompanyId)

  // If in advanced mode, show canvas builder
  if (editorMode === "advanced" && selectedCompany) {
    return (
      <AgendaTemplateCanvas
        company={selectedCompany}
        onBack={() => setEditorMode("simple")}
      />
    )
  }

  // Simple mode (existing editor)
  return (
    <>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-foreground mb-2">Agenda Templates</h2>
        <p className="text-muted-foreground">
          Customize the layout, fields, and styling of meeting agendas for each company
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
        <>
          <Card className="p-4 mb-6">
            <div className="flex items-center gap-4">
              <label className="text-sm font-semibold text-foreground">Select Company:</label>
              <select
                value={selectedCompanyId || ""}
                onChange={(e) => setSelectedCompanyId(Number(e.target.value))}
                className="flex-1 px-3 py-2 bg-background border border-border rounded focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                {companies.map(company => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>
            </div>
          </Card>

          {/* Mode Switcher */}
          <Card className="p-4 mb-6 bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-1">Choose Your Editor</h3>
                <p className="text-xs text-muted-foreground">
                  Simple editor for quick presets, or advanced canvas for complete control
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant={editorMode === "simple" ? "default" : "outline"}
                  onClick={() => setEditorMode("simple")}
                  className="gap-2"
                >
                  <Layout className="h-4 w-4" />
                  Simple Editor
                </Button>
                <Button
                  variant={editorMode === "advanced" ? "default" : "outline"}
                  onClick={() => setEditorMode("advanced")}
                  className="gap-2 bg-gradient-to-r from-primary to-decision-purple text-primary-foreground hover:opacity-90"
                >
                  <Sparkles className="h-4 w-4" />
                  Advanced Canvas
                </Button>
              </div>
            </div>
          </Card>

          {loadingTemplate ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Loading template...</p>
            </div>
          ) : (
            <>
              <Card className="p-6 mb-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">Agenda Layout</h3>
                    <p className="text-sm text-muted-foreground">Drag sections to reorder, click to customize fields and layout</p>
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
                      <div
                        draggable
                        onDragStart={() => handleSectionDragStart(sectionIndex)}
                        onDragOver={(e) => handleSectionDragOver(e, sectionIndex)}
                        onDragEnd={handleSectionDragEnd}
                        className="flex items-center gap-3 p-4 bg-background cursor-move"
                      >
                        <GripVertical className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                        <button
                          onClick={() => setExpandedSectionId(expandedSectionId === section.id ? null : section.id)}
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
                            <p className="text-xs text-muted-foreground">{section.description}</p>
                          </div>
                        </button>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setExpandedSectionId(expandedSectionId === section.id ? null : section.id)}
                            className="text-primary"
                          >
                            <Edit2 className="h-4 w-4 mr-1" />
                            Customize
                          </Button>
                          <div className="text-sm text-muted-foreground font-mono">
                            #{sectionIndex + 1}
                          </div>
                        </div>
                      </div>

                      {expandedSectionId === section.id && (
                        <div className="border-t border-border p-4 bg-muted/20">
                          <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                            <div className="flex items-center gap-2 mb-3">
                              <Layout className="h-5 w-5 text-blue-600" />
                              <label className="text-sm font-semibold text-blue-900">Layout Style</label>
                            </div>
                            <select
                              value={section.layoutStyle || getDefaultLayoutStyle(section.id)}
                              onChange={(e) => changeLayoutStyle(section.id, e.target.value)}
                              className="w-full px-3 py-2 bg-white border border-blue-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                              {LAYOUT_OPTIONS[section.id].map(option => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                            <p className="text-xs text-blue-700 mt-2">
                              {LAYOUT_OPTIONS[section.id].find(opt => opt.value === (section.layoutStyle || getDefaultLayoutStyle(section.id)))?.description}
                            </p>
                          </div>

                          <div className="mb-4 flex items-center gap-4">
                            <label className="text-sm font-medium text-foreground">Background Color:</label>
                            <input
                              type="color"
                              value={section.backgroundColor}
                              onChange={(e) => changeBackgroundColor(section.id, e.target.value)}
                              className="h-10 w-20 rounded border border-border cursor-pointer"
                            />
                            <span className="text-xs text-muted-foreground font-mono">{section.backgroundColor}</span>
                          </div>

                          {section.fields.length > 0 && (
                            <>
                              <h4 className="text-sm font-semibold text-foreground mb-3">Fields (drag to reorder):</h4>
                              <div className="space-y-2">
                                {section.fields.map((field, fieldIndex) => (
                                  <div
                                    key={field.id}
                                    draggable
                                    onDragStart={() => handleFieldDragStart(fieldIndex)}
                                    onDragOver={(e) => handleFieldDragOver(e, section.id, fieldIndex)}
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
                                          onChange={(e) => setEditingFieldLabel(e.target.value)}
                                          className="flex-1 px-2 py-1 border border-primary rounded text-sm"
                                          autoFocus
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter') saveFieldLabel(section.id, field.id)
                                            if (e.key === 'Escape') cancelEditingField()
                                          }}
                                        />
                                        <Button
                                          size="sm"
                                          onClick={() => saveFieldLabel(section.id, field.id)}
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
                                        <span className="flex-1 text-sm font-medium text-foreground">{field.label}</span>
                                        <div className="flex items-center gap-2">
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => startEditingField(field.id, field.label)}
                                            title="Edit label"
                                          >
                                            <Edit2 className="h-3 w-3" />
                                          </Button>
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => toggleFieldVisibility(section.id, field.id)}
                                            title={field.visible ? "Hide field" : "Show field"}
                                            className={field.visible ? "text-green-600" : "text-gray-400"}
                                          >
                                            {field.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
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
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </Card>

              <Card className="p-4 bg-blue-50 border-blue-200">
                <div className="flex items-start gap-3">
                  <FileText className="h-5 w-5 text-blue-600 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-blue-900 mb-1">Template Preview</h4>
                    <p className="text-sm text-blue-800 mb-2">
                      When generating agendas for <strong>{selectedCompany?.name}</strong>, sections will appear in this order:
                    </p>
                    <ol className="text-sm text-blue-800 space-y-1 ml-4">
                      {template.sections.map((section, index) => (
                        <li key={section.id}>
                          {index + 1}. {section.icon} {section.label}
                          {section.fields.length > 0 && (
                            <span className="text-blue-600 ml-2">
                              ({section.fields.filter(f => f.visible).length} visible fields)
                            </span>
                          )}
                          <span className="text-blue-500 ml-2 text-xs font-mono">
                            [{LAYOUT_OPTIONS[section.id].find(opt => opt.value === (section.layoutStyle || getDefaultLayoutStyle(section.id)))?.label}]
                          </span>
                        </li>
                      ))}
                    </ol>
                    <p className="text-xs text-blue-700 mt-3">
                      💡 This template will be used for all buildings in this company
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
