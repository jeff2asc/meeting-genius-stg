"use client"


import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { ZoomIn, ZoomOut, Maximize2, Save, Eye, Undo, Redo, Layout } from "lucide-react"
import ComponentLibrary from "./canvas/ComponentLibrary"
import CanvasElement from "./canvas/CanvasElement"
import PropertiesPanel from "./canvas/PropertiesPanel"
import TemplateGalleryModal from "./canvas/TemplateGalleryModal"
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
  getPageCount
} from "@/lib/canvasUtils"
import { CANVAS_TEMPLATES, TemplateKey } from "@/lib/defaultCanvasTemplates"
import { convertSimpleTemplateToCanvas } from "@/lib/simpleToCanvasConverter"
import { supabase, type Company } from "@/lib/supabase"
import { generateCanvasPDF } from "@/lib/canvasPDFGenerator"


interface AgendaTemplateCanvasProps {
  company: Company
  onBack: () => void
}


export default function AgendaTemplateCanvas({ company, onBack }: AgendaTemplateCanvasProps) {
  const [elements, setElements] = useState<CanvasElementType[]>([])
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null)
  const [scale, setScale] = useState(0.5)
  const [saving, setSaving] = useState(false)
  const [previewing, setPreviewing] = useState(false)
  const [history, setHistory] = useState<CanvasElementType[][]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [showTemplateGallery, setShowTemplateGallery] = useState(false)
  const [hasLoadedInitial, setHasLoadedInitial] = useState(false)
  const [hasSimpleTemplate, setHasSimpleTemplate] = useState(false)
  const canvasRef = useRef<HTMLDivElement>(null)


  // MOCK DATA FOR PREVIEW - EXPANDED TO 9 SECTIONS
  const mockMeetingData = {
    title: "Sample Council Meeting",
    meeting_date: new Date().toISOString().split('T')[0],
    meeting_type: "Council Meeting",
    start_time: "7:00 PM",
    location: "Community Room",
    strata_plan_number: "VIS1234",
    attendees: [
      { name: "John Smith", role: "Chair", present: true },
      { name: "Jane Doe", role: "Secretary", present: true },
      { name: "Bob Johnson", role: "Member", present: true },
      { name: "Sarah Williams", role: "Treasurer", present: true },
      { name: "Mike Davis", role: "Member", present: false }
    ]
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
    { id: 9, title: "Adjournment", order_index: 9 }
  ]


  const mockTopics = [
    // Section 1: Call to Order
    { id: 1, section_id: 1, title: "Welcome and Opening Remarks", description: "The chair will welcome all attendees and formally open the meeting.", order_index: 1, is_incamera: false },
    { id: 2, section_id: 1, title: "Roll Call and Quorum Verification", description: "Secretary will verify attendance and confirm quorum is present to conduct business.", order_index: 2, is_incamera: false },
    
    // Section 2: Approval of Agenda
    { id: 3, section_id: 2, title: "Review Agenda Items", description: "Council will review the proposed agenda and make any necessary modifications.", order_index: 1, is_incamera: false },
    
    // Section 3: New Business
    { id: 4, section_id: 3, title: "Budget Discussion", description: "Review and discuss the proposed annual budget for fiscal year 2026. This item contains confidential financial information.", order_index: 1, is_incamera: true },
    { id: 5, section_id: 3, title: "Building Maintenance Updates", description: "Discuss upcoming repairs and maintenance schedule for common areas including elevator servicing, roof inspection, and parking lot resurfacing.", order_index: 2, is_incamera: false },
    
    // Section 4: Financial Report
    { id: 6, section_id: 4, title: "Quarterly Financial Statements", description: "Treasurer to present Q4 financial results and year-end projections. Review of operating fund, contingency reserve fund, and special levy status.", order_index: 1, is_incamera: false },
    { id: 7, section_id: 4, title: "Approve Payment of Outstanding Invoices", description: "Council to approve payment of invoices totaling $45,320 for January expenses.", order_index: 2, is_incamera: false },
    
    // Section 5: Maintenance & Operations
    { id: 8, section_id: 5, title: "Elevator Modernization Project Update", description: "Property manager to provide update on elevator modernization project timeline and budget.", order_index: 1, is_incamera: false },
    { id: 9, section_id: 5, title: "Landscape Contract Renewal", description: "Review proposals for landscape maintenance contract renewal for 2026-2028 term.", order_index: 2, is_incamera: false },
    
    // Section 6: Correspondence
    { id: 10, section_id: 6, title: "Owner Request - Balcony Railing Modification", description: "Review request from owner in Unit 304 to modify balcony railing design. Architectural drawings attached.", order_index: 1, is_incamera: false },
    { id: 11, section_id: 6, title: "Notice from City - Water Main Replacement", description: "Review notice from city regarding upcoming water main replacement on adjacent street. Work scheduled for March 2026.", order_index: 2, is_incamera: false },
    
    // Section 7: Council Roundtable
    { id: 12, section_id: 7, title: "Council Member Updates and Comments", description: "Open forum for council members to share updates, concerns, or suggestions for future consideration.", order_index: 1, is_incamera: false },
    
    // Section 8: Next Meeting Date
    { id: 13, section_id: 8, title: "Confirm Next Meeting Date", description: "Confirm date and time for next scheduled council meeting. Proposed date: March 15, 2026 at 7:00 PM.", order_index: 1, is_incamera: false },
    
    // Section 9: Adjournment
    { id: 14, section_id: 9, title: "Motion to Adjourn", description: "Council to vote on motion to adjourn the meeting.", order_index: 1, is_incamera: false }
  ]


  // Calculate canvas height based on elements
  const canvasHeightMM = getCanvasHeight(elements)
  const canvasHeightPX = canvasHeightMM * 3.7795275591
  const pageCount = getPageCount(elements)


  // Load template from database on mount
  useEffect(() => {
    loadTemplate()
  }, [])


  const loadTemplate = async () => {
    try {
      const { data, error } = await supabase
        .from('company_agenda_templates')
        .select('blocks')
        .eq('company_id', company.id)
        .single()


      if (error && error.code !== 'PGRST116') {
        console.error('Error loading template:', error)
        return
      }


      if (data?.blocks?.canvas?.elements) {
        console.log('Loading saved Canvas template...')
        setElements(data.blocks.canvas.elements)
        addToHistory(data.blocks.canvas.elements)
        setHasLoadedInitial(true)
        
        if (data?.blocks?.sections) {
          setHasSimpleTemplate(true)
        }
      } else if (data?.blocks?.sections) {
        console.log('Converting Simple template to Canvas...')
        setHasSimpleTemplate(true)
        
        const convertedElements = convertSimpleTemplateToCanvas(data.blocks)
        setElements(convertedElements)
        addToHistory(convertedElements)
        setHasLoadedInitial(true)
      } else {
        console.log('No template found. Loading default Professional template...')
        setHasSimpleTemplate(false)
        
        const template = CANVAS_TEMPLATES['professional']
        const defaultElements = JSON.parse(JSON.stringify(template.elements)) as CanvasElementType[]
        setElements(defaultElements)
        addToHistory(defaultElements)
        setHasLoadedInitial(true)
      }
    } catch (err) {
      console.error('Unexpected error:', err)
    }
  }


  const extractVisibleFields = (elements: CanvasElementType[]) => {
    const visibleFields: string[] = []


    elements.forEach(el => {
      if (el.type === 'dynamic' && el.content && typeof el.content === 'object' && 'type' in el.content) {
        visibleFields.push(el.content.type as string)
      }
    })


    if (visibleFields.length === 0) {
      return [
        'building_name', 'meeting_type', 'meeting_date', 'start_time', 
        'location', 'address', 'strata_plan', 'section_numbers', 
        'topic_numbers', 'topic_descriptions', 'incamera_indicator',
        'footer_building_name', 'page_number', 'branding'
      ]
    }


    return visibleFields
  }


  const determineLayout = (elements: CanvasElementType[]) => {
    if (elements.length === 0) return "vertical"


    const avgX = elements.reduce((sum, el) => sum + el.position.x, 0) / elements.length


    const isCentered = avgX > 80 && avgX < 120


    const leftElements = elements.filter(el => el.position.x < 105)
    const rightElements = elements.filter(el => el.position.x >= 105)
    const hasTwoColumns = leftElements.length > 0 && rightElements.length > 0


    const heights = elements.map(el => el.position.y)
    const heightRange = Math.max(...heights) - Math.min(...heights)
    const isCompact = heightRange < 30


    if (isCentered) return "centered"
    if (hasTwoColumns && !isCompact) return "horizontal"
    if (isCompact) return "compact"
    return "vertical"
  }


  const convertCanvasToSimpleTemplate = () => {
    console.log('🎨 Converting canvas with', elements.length, 'elements')
    
    const headerElements = elements.filter(el => el.position.y < 100)
    const footerElements = elements.filter(el => el.position.y > 250)
    const bodyElements = elements.filter(el => el.position.y >= 100 && el.position.y <= 250)


    console.log('📍 Header elements:', headerElements.length)
    console.log('📍 Body elements:', bodyElements.length)
    console.log('📍 Footer elements:', footerElements.length)


    let headerBgColor = "#0f235a"
    let sectionsBgColor = "#648cff"
    let footerBgColor = "#0f235a"


    for (const el of headerElements) {
      if (el.style?.backgroundColor) {
        headerBgColor = el.style.backgroundColor
        console.log('🎨 Found header color:', headerBgColor, 'from element type:', el.type)
        break
      }
    }


    for (const el of bodyElements) {
      if (el.style?.backgroundColor) {
        sectionsBgColor = el.style.backgroundColor
        console.log('🎨 Found sections color:', sectionsBgColor, 'from element type:', el.type)
        break
      }
    }


    for (const el of footerElements) {
      if (el.style?.backgroundColor) {
        footerBgColor = el.style.backgroundColor
        console.log('🎨 Found footer color:', footerBgColor, 'from element type:', el.type)
        break
      }
    }


    const headerLayout = determineLayout(headerElements)
    const sectionsLayout = determineLayout(bodyElements)
    const footerLayout = determineLayout(footerElements)


    console.log('📐 Layouts:', { headerLayout, sectionsLayout, footerLayout })


    const visibleFields = extractVisibleFields(elements)
    console.log('👁️ Visible fields:', visibleFields)


    const template = {
      sections: [
        {
          id: "header",
          label: "Header",
          icon: "LayoutDashboard",
          backgroundColor: headerBgColor,
          layoutStyle: headerLayout,
          fields: [
            { id: "building_name", label: "Building Name", visible: visibleFields.includes('building_name'), order: 1 },
            { id: "meeting_type", label: "Meeting Type", visible: visibleFields.includes('meeting_type'), order: 2 },
            { id: "meeting_date", label: "Meeting Date", visible: visibleFields.includes('meeting_date'), order: 3 },
            { id: "start_time", label: "Start Time", visible: visibleFields.includes('start_time'), order: 4 },
            { id: "location", label: "Location", visible: visibleFields.includes('location'), order: 5 },
            { id: "address", label: "Address", visible: visibleFields.includes('address'), order: 6 },
            { id: "strata_plan", label: "Strata Plan", visible: visibleFields.includes('strata_plan'), order: 7 }
          ]
        },
        {
          id: "sections",
          label: "Sections",
          icon: "List",
          backgroundColor: sectionsBgColor,
          layoutStyle: sectionsLayout,
          fields: [
            { id: "section_numbers", label: "Section Numbers", visible: visibleFields.includes('section_numbers'), order: 1 },
            { id: "topic_numbers", label: "Topic Numbers", visible: visibleFields.includes('topic_numbers'), order: 2 },
            { id: "topic_descriptions", label: "Topic Descriptions", visible: visibleFields.includes('topic_descriptions'), order: 3 },
            { id: "incamera_indicator", label: "In-Camera Indicator", visible: visibleFields.includes('incamera_indicator'), order: 4 }
          ]
        },
        {
          id: "footer",
          label: "Footer",
          icon: "AlignBottom",
          backgroundColor: footerBgColor,
          layoutStyle: footerLayout,
          fields: [
            { id: "building_name", label: "Building Name", visible: visibleFields.includes('footer_building_name'), order: 1 },
            { id: "page_number", label: "Page Number", visible: visibleFields.includes('page_number'), order: 2 },
            { id: "branding", label: "Meeting Genius Branding", visible: visibleFields.includes('branding'), order: 3 }
          ]
        }
      ]
    }


    console.log('✅ Final converted template:', JSON.stringify(template, null, 2))
    return template
  }


  const saveTemplate = async () => {
    setSaving(true)
    try {
      const { data: existing, error: fetchError } = await supabase
        .from('company_agenda_templates')
        .select('id, blocks')
        .eq('company_id', company.id)
        .single()


      console.log('Existing template:', existing)
      console.log('Fetch error:', fetchError)


      const simpleTemplate = convertCanvasToSimpleTemplate()


      const templateData = {
        company_id: company.id,
        blocks: {
          ...(existing?.blocks || {}),
          canvas: {
            mode: 'advanced',
            elements: elements
          },
          sections: simpleTemplate.sections
        }
      }


      console.log('Attempting to save:', templateData)


      if (existing) {
        const { error, data } = await supabase
          .from('company_agenda_templates')
          .update({ 
            blocks: templateData.blocks, 
            updated_at: new Date().toISOString() 
          })
          .eq('company_id', company.id)
          .select()


        console.log('Update result:', { error, data })
        
        if (error) {
          console.error('Update error details:', error)
          throw error
        }
      } else {
        const { error, data } = await supabase
          .from('company_agenda_templates')
          .insert(templateData)
          .select()


        console.log('Insert result:', { error, data })
        
        if (error) {
          console.error('Insert error details:', error)
          throw error
        }
      }


      alert('✅ Canvas template saved successfully! Your exact canvas layout will appear in generated PDFs.')
    } catch (err: any) {
      console.error('Error saving template:', err)
      
      let errorMessage = 'Failed to save template'
      
      if (err.code === '42501') {
        errorMessage = '🔒 Permission denied. Please check your Supabase RLS policies for the company_agenda_templates table.'
      } else if (err.message) {
        errorMessage = `Failed to save template: ${err.message}`
      }
      
      alert(errorMessage)
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
        buildings: {
          name: company.name,
          address: "123 Main Street, Vancouver, BC",
          building_type: "Strata",
          logo_url: company.logo_url || null,
          company_id: company.id,
          companies: {
            logo_url: company.logo_url || null
          }
        }
      }


      console.log('🚀 Using Canvas PDF Generator - WYSIWYG rendering')
      console.log('📄 Generating', pageCount, 'page(s)')
      await generateCanvasPDF(elements, mockMeeting, mockSections, mockTopics)
      
    } catch (error) {
      console.error('Error generating preview:', error)
      alert('Failed to generate preview PDF.')
    } finally {
      setPreviewing(false)
    }
  }


  const handleSelectTemplate = async (key: TemplateKey | null | 'convert') => {
    if (key === 'convert') {
      try {
        const { data } = await supabase
          .from('company_agenda_templates')
          .select('blocks')
          .eq('company_id', company.id)
          .single()


        if (data?.blocks?.sections) {
          const convertedElements = convertSimpleTemplateToCanvas(data.blocks)
          setElements(convertedElements)
          addToHistory(convertedElements)
        }
      } catch (err) {
        console.error('Error converting template:', err)
        alert('Failed to convert template')
      }
    } else if (key === null) {
      const newElements: CanvasElementType[] = []
      setElements(newElements)
      addToHistory(newElements)
    } else {
      const template = CANVAS_TEMPLATES[key]
      const newElements = JSON.parse(JSON.stringify(template.elements)) as CanvasElementType[]
      setElements(newElements)
      addToHistory(newElements)
    }
    
    setShowTemplateGallery(false)
    setHasLoadedInitial(true)
  }


  const addToHistory = (newElements: CanvasElementType[]) => {
    const newHistory = history.slice(0, historyIndex + 1)
    newHistory.push([...newElements])
    setHistory(newHistory)
    setHistoryIndex(newHistory.length - 1)
  }


  const undo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1)
      setElements([...history[historyIndex - 1]])
    }
  }


  const redo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1)
      setElements([...history[historyIndex + 1]])
    }
  }


  const handleAddElement = (type: ElementType, dynamicFieldType?: DynamicFieldType) => {
    const newElement = createDefaultElement(type, { x: 20, y: 20 }, { width: 80, height: 20 })
    
    if (type === 'dynamic' && dynamicFieldType) {
      newElement.content = { type: dynamicFieldType }
    }


    const newElements = [...elements, newElement]
    setElements(newElements)
    setSelectedElementId(newElement.id)
    addToHistory(newElements)
  }


  const handleUpdateElement = (id: string, updates: Partial<CanvasElementType>) => {
    const newElements = elements.map(el =>
      el.id === id ? { ...el, ...updates } : el
    )
    setElements(newElements)
    addToHistory(newElements)
  }


  const handleDeleteElement = (id: string) => {
    const newElements = elements.filter(el => el.id !== id)
    setElements(newElements)
    setSelectedElementId(null)
    addToHistory(newElements)
  }


  const handleDuplicateElement = (id: string) => {
    const element = elements.find(el => el.id === id)
    if (element) {
      const duplicated = duplicateElement(element)
      const newElements = [...elements, duplicated]
      setElements(newElements)
      setSelectedElementId(duplicated.id)
      addToHistory(newElements)
    }
  }


  const handleCanvasClick = () => {
    setSelectedElementId(null)
  }


  const zoomIn = () => setScale(Math.min(scale + 0.1, 1.5))
  const zoomOut = () => setScale(Math.max(scale - 0.1, 0.2))
  const zoomFit = () => setScale(0.5)


  const selectedElement = elements.find(el => el.id === selectedElementId) || null


  const handleLoadTemplateClick = () => {
    if (elements.length > 0) {
      const confirmed = confirm('⚠️ Loading a new template will replace your current canvas. Any unsaved changes will be lost. Continue?')
      if (confirmed) {
        setShowTemplateGallery(true)
      }
    } else {
      setShowTemplateGallery(true)
    }
  }


  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' && selectedElementId) {
        handleDeleteElement(selectedElementId)
      }
      if (e.key === 'Escape') {
        setSelectedElementId(null)
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault()
        redo()
      }
    }


    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedElementId, historyIndex, history])


  return (
    <div className="flex flex-col min-h-screen bg-background overflow-y-auto">
      {/* Top Toolbar */}
      <div className="border-b border-border bg-card px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={onBack}>
            ← Back
          </Button>
          <div className="h-6 w-px bg-border" />
          <div>
            <h2 className="text-lg font-semibold text-foreground">Advanced Canvas Builder</h2>
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


          <Button 
            variant="outline" 
            size="sm"
            onClick={handleLoadTemplateClick}
            className="gap-2"
          >
            <Layout className="h-4 w-4" />
            Load Template
          </Button>
          
          <Button 
            variant="outline" 
            size="sm"
            onClick={handlePreviewPDF}
            disabled={previewing}
            className="gap-2"
          >
            <Eye className="h-4 w-4" />
            {previewing ? 'Generating...' : 'Preview PDF'}
          </Button>
          
          <Button
            onClick={saveTemplate}
            disabled={saving}
            className="bg-gradient-to-r from-primary to-decision-purple text-primary-foreground"
            size="sm"
          >
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Saving...' : 'Save Template'}
          </Button>
        </div>
      </div>


      {/* Main Content Area - no inner scroll; page scrolls with content */}
      <div className="flex-1 flex min-h-0">
        <ComponentLibrary onAddElement={handleAddElement} />


        {/* MULTI-PAGE CANVAS */}
        <div className="flex-1 overflow-visible bg-muted/30 p-8" onClick={handleCanvasClick}>
          <p className="text-xs text-muted-foreground mb-2 text-center">
            Preview uses sample data. The downloaded agenda PDF will use the meeting&apos;s actual sections and topics, so page count may differ.
          </p>
          <div className="flex flex-col items-center justify-start min-h-full gap-0">
            {Array.from({ length: pageCount }).map((_, pageIndex) => (
              <div key={pageIndex} className="relative">
                {/* Page Container */}
                <div
                  ref={pageIndex === 0 ? canvasRef : undefined}
                  style={{
                    width: `${A4_WIDTH_PX * scale}px`,
                    height: `${A4_HEIGHT_PX * scale}px`,
                    backgroundColor: '#ffffff',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                    position: 'relative',
                    backgroundImage: `
                      linear-gradient(rgba(0,0,0,0.05) 1px, transparent 1px),
                      linear-gradient(90deg, rgba(0,0,0,0.05) 1px, transparent 1px)
                    `,
                    backgroundSize: `${GRID_SIZE_PX * scale}px ${GRID_SIZE_PX * scale}px`,
                    backgroundPosition: '0 0',
                    marginBottom: pageIndex < pageCount - 1 ? `${PAGE_GAP_PX * scale}px` : 0
                  }}
                >
                  {/* Render elements for this page */}
                  {elements
                    .filter(el => {
                      const elPage = Math.floor(el.position.y / 297)
                      return elPage === pageIndex
                    })
                    .map(element => (
                      <CanvasElement
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
                          logo_url: company.logo_url || null
                        }}
                        meetingData={mockMeetingData}
                        sections={mockSections}
                        topics={mockTopics}
                      />
                    ))}


                  {/* Page Number Indicator */}
                  <div
                    style={{
                      position: 'absolute',
                      top: '8px',
                      right: '8px',
                      backgroundColor: 'rgba(0,0,0,0.6)',
                      color: 'white',
                      padding: '4px 12px',
                      borderRadius: '4px',
                      fontSize: `${10 * scale}px`,
                      fontWeight: 'bold',
                      pointerEvents: 'none',
                      zIndex: 10000
                    }}
                  >
                    Page {pageIndex + 1} of {pageCount}
                  </div>


                  {/* Canvas Info Overlay */}
                  {pageIndex === 0 && (
                    <div
                      style={{
                        position: 'absolute',
                        bottom: '8px',
                        right: '8px',
                        backgroundColor: 'rgba(0,0,0,0.7)',
                        color: 'white',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '10px',
                        pointerEvents: 'none'
                      }}
                    >
                      A4 (210mm × 297mm) • {elements.length} element{elements.length !== 1 ? 's' : ''}
                    </div>
                  )}
                </div>


                {/* Page Break Indicator */}
                {pageIndex < pageCount - 1 && (
                  <div
                    style={{
                      width: `${A4_WIDTH_PX * scale}px`,
                      height: `${PAGE_GAP_PX * scale}px`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      position: 'relative'
                    }}
                  >
                    <div
                      style={{
                        width: '100%',
                        height: '2px',
                        background: 'repeating-linear-gradient(90deg, #999 0, #999 10px, transparent 10px, transparent 20px)',
                        position: 'relative'
                      }}
                    >
                      <div
                        style={{
                          position: 'absolute',
                          top: '-10px',
                          left: '50%',
                          transform: 'translateX(-50%)',
                          backgroundColor: '#999',
                          color: 'white',
                          padding: '2px 12px',
                          borderRadius: '12px',
                          fontSize: '10px',
                          fontWeight: 'bold',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        ✂️ Page Break
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}


            {/* Empty state */}
            {elements.length === 0 && (
              <div
                style={{
                  width: `${A4_WIDTH_PX * scale}px`,
                  height: `${A4_HEIGHT_PX * scale}px`,
                  backgroundColor: '#ffffff',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <div className="text-center text-muted-foreground max-w-md">
                  <div className="mb-4 text-6xl">📋</div>
                  <p className="text-lg font-medium mb-2">Canvas is Empty</p>
                  <p className="text-sm mb-4">
                    Add components from the left sidebar, or load a starter template
                  </p>
                  <Button
                    onClick={() => setShowTemplateGallery(true)}
                    variant="default"
                    className="gap-2 bg-gradient-to-r from-primary to-decision-purple"
                  >
                    <Layout className="h-4 w-4" />
                    Load Starter Template
                  </Button>
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


      {/* Bottom Status Bar */}
      <div className="border-t border-border bg-card px-4 py-2 flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-4">
          <span>
            {selectedElement ? (
              <>
                Selected: <strong>{selectedElement.type}</strong> at ({Math.round(selectedElement.position.x)}mm, {Math.round(selectedElement.position.y)}mm)
              </>
            ) : (
              'No element selected'
            )}
          </span>
          <span>•</span>
          <span>
            📄 <strong>{pageCount} page{pageCount !== 1 ? 's' : ''}</strong>
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span>💡 Tip: Press <kbd className="px-1 bg-muted rounded">Delete</kbd> to remove selected element</span>
          <span>Press <kbd className="px-1 bg-muted rounded">Esc</kbd> to deselect</span>
        </div>
      </div>


      {showTemplateGallery && (
        <TemplateGalleryModal
          onClose={() => {
            setShowTemplateGallery(false)
          }}
          onSelectTemplate={handleSelectTemplate}
          hasSimpleTemplate={hasSimpleTemplate}
        />
      )}
    </div>
  )
}
