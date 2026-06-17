"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { ZoomIn, ZoomOut, Maximize2, Save, Eye, Undo, Redo, Code2 } from "lucide-react"
import MinutesComponentLibrary from "@/components/admin/canvas/MinutesComponentLibrary"
import CanvasElementComponent from "@/components/admin/canvas/CanvasElement"
import PropertiesPanel from "@/components/admin/canvas/PropertiesPanel"
import HtmlHeaderImportModal from "@/components/admin/canvas/HtmlHeaderImportModal"
import {
  CanvasElement as CanvasElementType,
  ElementType,
  DynamicFieldType,
  createDefaultElement,
  duplicateElement,
  A4_WIDTH_PX,
  A4_HEIGHT_PX,
  GRID_SIZE_PX,
  PAGE_GAP_PX,
  getCanvasHeight,
  getPageCount,
} from "@/lib/canvasUtils"
import { MINUTES_CANVAS_TEMPLATES } from "@/lib/defaultMinutesCanvasTemplates"
import { supabase, type Company } from "@/lib/supabase"
import { generateMinutesCanvasPDF } from "@/lib/minutesCanvasPDFGenerator"
import { MinutesDynamicFieldType } from "@/lib/minutesCanvasUtils"

interface MinutesTemplateCanvasProps {
  company: Company
  onBack: () => void
}

export default function MinutesTemplateCanvas({
  company,
  onBack,
}: MinutesTemplateCanvasProps) {
  const [elements, setElements] = useState<CanvasElementType[]>([])
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null)
  const [scale, setScale] = useState(0.5)
  const [saving, setSaving] = useState(false)
  const [previewing, setPreviewing] = useState(false)
  const [history, setHistory] = useState<CanvasElementType[][]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [showHtmlImport, setShowHtmlImport] = useState(false)
  const [showTemplatePicker, setShowTemplatePicker] = useState(false)
  const canvasRef = useRef<HTMLDivElement>(null)

  const mockMeetingData = {
    title: "Sample Council Meeting",
    meeting_date: new Date().toISOString().split("T")[0],
    meeting_type: "Council Meeting",
    start_time: "7:00 PM",
    location: "Community Room",
    strata_plan_number: "VIS1234",
    status: "minutes",
    attendees: [
      { name: "John Smith", role: "Chair", present: true },
      { name: "Jane Doe", role: "Secretary", present: true },
      { name: "Bob Johnson", role: "Member", present: true },
      { name: "Sarah Williams", role: "Treasurer", present: true },
      { name: "Mike Davis", role: "Member", present: false },
    ],
  }

  const mockSections = [
    { id: 1, title: "Call to Order", order_index: 1 },
    { id: 2, title: "Approval of Agenda", order_index: 2 },
    { id: 3, title: "New Business", order_index: 3 },
    { id: 4, title: "Financial Report", order_index: 4 },
    { id: 5, title: "Maintenance & Operations", order_index: 5 },
    { id: 6, title: "Correspondence", order_index: 6 },
    { id: 7, title: "Council Roundtable", order_index: 7 },
    { id: 8, title: "Next Meeting Date", order_index: 8 },
    { id: 9, title: "Adjournment", order_index: 9 },
  ]

  const mockTopics = [
    {
      id: 1,
      section_id: 1,
      title: "Welcome and Opening Remarks",
      description:
        "The chair welcomed all attendees and called the meeting to order at 7:02 PM.",
      order_index: 1,
      is_incamera: false,
      notes: [{ content: "Quorum was confirmed.", created_at: new Date().toISOString() }],
      tasks: [],
      decisions: [],
    },
    {
      id: 2,
      section_id: 2,
      title: "Approval of Agenda",
      description: "Agenda was reviewed. No changes requested.",
      order_index: 1,
      is_incamera: false,
      notes: [],
      tasks: [],
      decisions: [
        {
          motion_text: "Approve the agenda as presented.",
          result: "Carried",
          votes_for: 4,
          votes_against: 0,
          votes_abstain: 0,
        },
      ],
    },
    {
      id: 3,
      section_id: 3,
      title: "Budget Discussion",
      description: "Review of proposed 2026 operating budget.",
      order_index: 1,
      is_incamera: true,
      notes: [],
      tasks: [],
      decisions: [],
    },
  ]

  const canvasHeightMM = getCanvasHeight(elements)
  const canvasHeightPX = canvasHeightMM * 3.7795275591
  const pageCount = getPageCount(elements)

  useEffect(() => {
    loadTemplate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company.id])

  const loadTemplate = async () => {
    try {
      const { data, error } = await supabase
        .from("minutes_templates")
        .select("canvas_content")
        .eq("company_id", company.id.toString())
        .maybeSingle()

      if (error && error.code !== "PGRST116") {
        console.error("Error loading minutes canvas template:", error)
      }

      const canvasContent = data?.canvas_content as any

      if (canvasContent?.canvas?.elements) {
        const loaded = canvasContent.canvas.elements as CanvasElementType[]
        setElements(loaded)
        addToHistory(loaded)
      } else {
        const template = MINUTES_CANVAS_TEMPLATES["corporate_gold"]
        const defaultElements = JSON.parse(
          JSON.stringify(template.elements)
        ) as CanvasElementType[]
        setElements(defaultElements)
        addToHistory(defaultElements)
      }
    } catch (err) {
      console.error("Unexpected error loading minutes canvas:", err)
    }
  }

  const saveTemplate = async () => {
    setSaving(true)
    try {
      const { data: existing } = await supabase
        .from("minutes_templates")
        .select("id, canvas_content, company_id")
        .eq("company_id", company.id.toString())
        .maybeSingle()

      const canvasContent = {
        ...((existing?.canvas_content as any) || {}),
        canvas: {
          mode: "advanced",
          elements,
        },
      }

      if (existing) {
        const { error } = await supabase
          .from("minutes_templates")
          .update({ canvas_content: canvasContent, updated_at: new Date().toISOString() })
          .eq("company_id", company.id.toString())

        if (error) {
          console.error("Error updating minutes canvas template:", error)
          alert("Failed to save minutes canvas template.")
          setSaving(false)
          return
        }
      } else {
        const { error } = await supabase
          .from("minutes_templates")
          .insert({
            company_id: company.id.toString(),
            canvas_content: canvasContent,
          })

        if (error) {
          console.error("Error creating minutes canvas template:", error)
          alert("Failed to save minutes canvas template.")
          setSaving(false)
          return
        }
      }

      alert("✅ Minutes canvas template saved successfully!")
    } catch (err) {
      console.error("Unexpected error saving minutes template:", err)
      alert("Failed to save minutes template.")
    } finally {
      setSaving(false)
    }
  }

  const handlePreviewPDF = async () => {
    setPreviewing(true)
    try {
      const mockMeeting = {
        title: mockMeetingData.title,
        meeting_date: mockMeetingData.meeting_date,
        meeting_type: mockMeetingData.meeting_type,
        start_time: mockMeetingData.start_time,
        location: mockMeetingData.location,
        strata_plan_number: mockMeetingData.strata_plan_number,
        attendees: mockMeetingData.attendees,
        status: "minutes",
        buildings: {
          name: company.name,
          address: "123 Main Street, Vancouver, BC",
          logo_url: company.logo_url || null,
          companies: {
            logo_url: company.logo_url || null,
          },
        },
      }

      await generateMinutesCanvasPDF(
        elements,
        mockMeeting as any,
        mockSections as any,
        mockTopics as any
      )
    } catch (error) {
      console.error("Error generating minutes preview:", error)
      alert("Failed to generate minutes preview PDF.")
    } finally {
      setPreviewing(false)
    }
  }

  const addToHistory = (newElements: CanvasElementType[]) => {
    setHistory((prev) => {
      const updated = prev.slice(0, historyIndex + 1)
      updated.push([...newElements])
      setHistoryIndex(updated.length - 1)
      return updated
    })
  }

  const undo = () => {
    setHistoryIndex((idx) => {
      if (idx <= 0) return idx
      setElements([...history[idx - 1]])
      return idx - 1
    })
  }

  const redo = () => {
    setHistoryIndex((idx) => {
      if (idx >= history.length - 1) return idx
      setElements([...history[idx + 1]])
      return idx + 1
    })
  }

  const handleAddElement = (type: ElementType, dynamicFieldType?: MinutesDynamicFieldType) => {
    const newElement = createDefaultElement(type, { x: 20, y: 20 }, { width: 80, height: 20 })

    if (type === "dynamic" && dynamicFieldType) {
      newElement.content = { type: dynamicFieldType as unknown as DynamicFieldType }
      // Default config for special layout fields
      if (dynamicFieldType === "document_heading") {
        newElement.config = { orientation: "horizontal", headingFormat: "full_sentence" }
        newElement.size = { width: 180, height: 25 }
        newElement.position = { x: 15, y: 20 }
      }
      if (dynamicFieldType === "attendance_block") {
        newElement.config = { orientation: "horizontal", attendanceStyle: "table" }
        newElement.size = { width: 180, height: 40 }
        newElement.position = { x: 15, y: 50 }
      }
    }

    const newElements = [...elements, newElement]
    setElements(newElements)
    setSelectedElementId(newElement.id)
    addToHistory(newElements)
  }

  const handleUpdateElement = (id: string, updates: Partial<CanvasElementType>) => {
    const newElements = elements.map((el) => (el.id === id ? { ...el, ...updates } : el))
    setElements(newElements)
    addToHistory(newElements)
  }

  const handleDeleteElement = (id: string) => {
    const newElements = elements.filter((el) => el.id !== id)
    setElements(newElements)
    setSelectedElementId(null)
    addToHistory(newElements)
  }

  const handleDuplicateElement = (id: string) => {
    const element = elements.find((el) => el.id === id)
    if (!element) return
    const duplicated = duplicateElement(element)
    const newElements = [...elements, duplicated]
    setElements(newElements)
    setSelectedElementId(duplicated.id)
    addToHistory(newElements)
  }

  const handleCanvasClick = () => setSelectedElementId(null)

  const zoomIn = () => setScale((s) => Math.min(s + 0.1, 1.5))
  const zoomOut = () => setScale((s) => Math.max(s - 0.1, 0.2))
  const zoomFit = () => setScale(0.5)

  const selectedElement = elements.find((el) => el.id === selectedElementId) || null

  // Handle HTML header import
  const handleHtmlImport = (htmlContent: string, heightMm: number) => {
    const newElement = createDefaultElement("html_header", { x: 0, y: 0 }, { width: 210, height: heightMm })
    newElement.content = htmlContent
    const newElements = [...elements, newElement]
    setElements(newElements)
    setSelectedElementId(newElement.id)
    addToHistory(newElements)
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Delete" && selectedElementId) {
        handleDeleteElement(selectedElementId)
      }
      if (e.key === "Escape") {
        setSelectedElementId(null)
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault()
        undo()
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
        e.preventDefault()
        redo()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [selectedElementId, history, historyIndex])

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Top Toolbar */}
      <div className="border-b border-border bg-card px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={onBack}>
            ← Back to Simple Minutes Editor
          </Button>
          <div className="h-6 w-px bg-border" />
          <div>
            <h2 className="text-lg font-semibold text-foreground">Minutes Canvas Builder</h2>
            <p className="text-xs text-muted-foreground">{company.name}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={undo}
            disabled={historyIndex <= 0}
            title="Undo (Ctrl+Z)"
          >
            <Undo className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={redo}
            disabled={historyIndex >= history.length - 1}
            title="Redo (Ctrl+Y)"
          >
            <Redo className="h-4 w-4" />
          </Button>

          <div className="h-6 w-px bg-border mx-2" />

          <Button variant="outline" size="sm" onClick={zoomOut} title="Zoom Out">
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground min-w-[50px] text-center">
            {Math.round(scale * 100)}%
          </span>
          <Button variant="outline" size="sm" onClick={zoomIn} title="Zoom In">
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={zoomFit} title="Fit to Screen">
            <Maximize2 className="h-4 w-4" />
          </Button>

          <div className="h-6 w-px bg-border mx-2" />

          {/* Load Template picker */}
          <div className="relative">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowTemplatePicker((v) => !v)}
              className="gap-2"
            >
              🎨 Load Template
            </Button>
            {showTemplatePicker && (
              <div className="absolute top-10 left-0 z-50 bg-white border border-border rounded-lg shadow-lg w-72 p-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-2 py-1 mb-1">Choose a Template</p>
                {Object.entries(MINUTES_CANVAS_TEMPLATES).map(([key, tmpl]) => (
                  <button
                    key={key}
                    className="w-full text-left px-3 py-2 rounded hover:bg-slate-50 flex items-start gap-3 transition-colors"
                    onClick={() => {
                      if (confirm(`Load the "${tmpl.name}" template? This will replace all current elements.`)) {
                        const fresh = JSON.parse(JSON.stringify(tmpl.elements)) as CanvasElementType[]
                        setElements(fresh)
                        addToHistory(fresh)
                        setSelectedElementId(null)
                      }
                      setShowTemplatePicker(false)
                    }}
                  >
                    <span className="text-2xl leading-none">{tmpl.thumbnail}</span>
                    <div>
                      <p className="text-sm font-medium text-slate-800">{tmpl.name}</p>
                      <p className="text-xs text-slate-500">{tmpl.description}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="h-6 w-px bg-border mx-2" />

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowHtmlImport(true)}
            className="gap-2"
          >
            <Code2 className="h-4 w-4" />
            Import HTML Header
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handlePreviewPDF}
            disabled={previewing}
            className="gap-2"
          >
            <Eye className="h-4 w-4" />
            {previewing ? "Generating..." : "Preview Minutes PDF"}
          </Button>

          <Button
            onClick={saveTemplate}
            disabled={saving}
            className="bg-gradient-to-r from-primary to-decision-purple text-primary-foreground"
            size="sm"
          >
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Saving..." : "Save Minutes Template"}
          </Button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        <MinutesComponentLibrary onAddElement={handleAddElement} />

        <div
          className="flex-1 overflow-auto bg-muted/30 p-8"
          onClick={handleCanvasClick}
        >
          <div className="flex flex-col items-center justify-start min-h-full gap-0">
            {Array.from({ length: pageCount }).map((_, pageIndex) => (
              <div key={pageIndex} className="relative">
                <div
                  ref={pageIndex === 0 ? canvasRef : undefined}
                  style={{
                    width: `${A4_WIDTH_PX * scale}px`,
                    height: `${A4_HEIGHT_PX * scale}px`,
                    backgroundColor: "#ffffff",
                    boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
                    position: "relative",
                    backgroundImage: `
                      linear-gradient(rgba(0,0,0,0.05) 1px, transparent 1px),
                      linear-gradient(90deg, rgba(0,0,0,0.05) 1px, transparent 1px)
                    `,
                    backgroundSize: `${GRID_SIZE_PX * scale}px ${GRID_SIZE_PX * scale}px`,
                    backgroundPosition: "0 0",
                    marginBottom:
                      pageIndex < pageCount - 1 ? `${PAGE_GAP_PX * scale}px` : 0,
                  }}
                >
                  {elements
                    .filter((el) => Math.floor(el.position.y / 297) === pageIndex)
                    .map((element) => (
                      <CanvasElementComponent
                        key={element.id}
                        element={element}
                        isSelected={element.id === selectedElementId}
                        scale={scale}
                        pageIndex={pageIndex}
                        onSelect={() => setSelectedElementId(element.id)}
                        onUpdate={(updates) => handleUpdateElement(element.id, updates)}
                        onDelete={() => handleDeleteElement(element.id)}
                        onDuplicate={() => handleDuplicateElement(element.id)}
                        companyData={{
                          name: company.name,
                          logo_url: company.logo_url || null,
                        }}
                        meetingData={mockMeetingData}
                        sections={mockSections}
                        topics={mockTopics}
                      />
                    ))}

                  <div
                    style={{
                      position: "absolute",
                      top: "8px",
                      right: "8px",
                      backgroundColor: "rgba(0,0,0,0.6)",
                      color: "white",
                      padding: "4px 12px",
                      borderRadius: "4px",
                      fontSize: `${10 * scale}px`,
                      fontWeight: "bold",
                      pointerEvents: "none",
                      zIndex: 10000,
                    }}
                  >
                    Page {pageIndex + 1} of {pageCount}
                  </div>

                  {pageIndex === 0 && (
                    <div
                      style={{
                        position: "absolute",
                        bottom: "8px",
                        right: "8px",
                        backgroundColor: "rgba(0,0,0,0.7)",
                        color: "white",
                        padding: "4px 8px",
                        borderRadius: "4px",
                        fontSize: "10px",
                        pointerEvents: "none",
                      }}
                    >
                      A4 (210mm × 297mm) • {elements.length} element
                      {elements.length !== 1 ? "s" : ""}
                    </div>
                  )}
                </div>

                {pageIndex < pageCount - 1 && (
                  <div
                    style={{
                      width: `${A4_WIDTH_PX * scale}px`,
                      height: `${PAGE_GAP_PX * scale}px`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      position: "relative",
                    }}
                  >
                    <div
                      style={{
                        width: "100%",
                        height: "2px",
                        background:
                          "repeating-linear-gradient(90deg, #999 0, #999 10px, transparent 10px, transparent 20px)",
                        position: "relative",
                      }}
                    >
                      <div
                        style={{
                          position: "absolute",
                          top: "-10px",
                          left: "50%",
                          transform: "translateX(-50%)",
                          backgroundColor: "#999",
                          color: "white",
                          padding: "2px 12px",
                          borderRadius: "12px",
                          fontSize: "10px",
                          fontWeight: "bold",
                          whiteSpace: "nowrap",
                        }}
                      >
                        ✂️ Page Break
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {elements.length === 0 && (
              <div
                style={{
                  width: `${A4_WIDTH_PX * scale}px`,
                  height: `${A4_HEIGHT_PX * scale}px`,
                  backgroundColor: "#ffffff",
                  boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <div className="text-center text-muted-foreground max-w-md">
                  <div className="mb-4 text-6xl">📝</div>
                  <p className="text-lg font-medium mb-2">Minutes Canvas is Empty</p>
                  <p className="text-sm mb-4">
                    Add components from the left sidebar to start designing your minutes
                    layout.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        <PropertiesPanel
          selectedElement={selectedElement}
          onUpdate={(updates) => {
            if (selectedElementId) {
              handleUpdateElement(selectedElementId, updates)
            }
          }}
          onClose={() => setSelectedElementId(null)}
        />
      </div>

      <div className="border-t border-border bg-card px-4 py-2 flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-4">
          <span>
            {selectedElement ? (
              <>
                Selected: <strong>{selectedElement.type}</strong> at (
                {Math.round(selectedElement.position.x)}mm,{" "}
                {Math.round(selectedElement.position.y)}mm)
              </>
            ) : (
              "No element selected"
            )}
          </span>
          <span>•</span>
          <span>
            📄 <strong>{pageCount} page{pageCount !== 1 ? "s" : ""}</strong>
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span>
            💡 Tip: Press <kbd className="px-1 bg-muted rounded">Delete</kbd> to remove
            selected element
          </span>
          <span>
            Press <kbd className="px-1 bg-muted rounded">Esc</kbd> to deselect
          </span>
        </div>
      </div>

      {showHtmlImport && (
        <HtmlHeaderImportModal
          onClose={() => setShowHtmlImport(false)}
          onImport={handleHtmlImport}
        />
      )}
    </div>
  )
}
