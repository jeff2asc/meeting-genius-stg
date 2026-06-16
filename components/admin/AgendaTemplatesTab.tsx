"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { GripVertical, Save, FileText, Loader2, Undo, Plus, Trash2, AlignLeft, AlignCenter, AlignRight, ChevronUp, ChevronDown, Link as LinkIcon, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { supabase } from "@/lib/supabase"
import { getCurrentLocalDate } from "@/lib/timezone"

// ─── Rich Text Block (Feature 1 & 3) ───────────────────────────────────────
interface RichTextBlock {
  id: string
  slot: 'header' | 'footer'
  order: number
  label: string
  content: string
  fontSize: number
  bold: boolean
  italic: boolean
  textAlign: 'left' | 'center' | 'right'
  meetingTypeFilter: string[]  // empty = all meeting types
  attachmentPath?: string
  attachmentName?: string
}

// Dynamic Meeting Types will be fetched from voting_parameters

function generateBlockId(): string {
  return `block-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`
}

interface Building {
  id: number
  name: string
  address: string | null
  manager_id: number
  company_id: number | null
  created_at: string;
  logo_url?: string | null;
  companies?: { logo_url: string | null } | null;
}

interface AgendaTemplatesTabProps {
  buildings: Building[]
  loading: boolean
}

interface CoverPageElement {
  id: string
  label: string
  enabled: boolean
  x: number
  y: number
  align: 'left' | 'center' | 'right'
  fontSize?: number
  bold?: boolean
  italic?: boolean
  uppercase?: boolean
  letterSpacing?: number
}

interface TemplateField {
  id: string
  label: string
  order: number
  enabled: boolean
}
interface TemplateState {
  coverPageElements: CoverPageElement[]
  infoCardFields: TemplateField[]
  coverPageColor: string
  infoCardAccentColor: string
  agendaItemsColor: string
  sectionHeaderTextColor: 'black' | 'white'
  agendaHeaderTextColor: 'black' | 'white'
  coverPageTextColor: 'black' | 'white'
  infoCardHeaderTextColor: 'black' | 'white'
  richTextBlocks: RichTextBlock[]
}

interface Template {
  id?: number
  buildingid: number
  coverpage_elements: CoverPageElement[]
  infocard_fields: TemplateField[]
  coverpage_color: string
  infocard_accent_color: string
  agenda_items_color: string
  section_header_text_color: string
  agenda_header_text_color: string
  coverpage_text_color: string
  infocard_header_text_color: string
  rich_text_blocks: RichTextBlock[]
}

interface Meeting {
  id: number
  title: string
  meeting_date: string
  start_time: string | null
  location: string | null
  meeting_type: string | null
  strata_plan_number: string | null
  buildings: {
    id: number
    name: string
    address: string | null
    logo_url: string | null
    companies: {
      logo_url: string | null
    } | null
  }
}

interface Section {
  id: number
  title: string
  order_index: number
}

interface Topic {
  id: number
  title: string
  description: string | null
  section_id: number | null
  order_index: number
  is_incamera?: boolean
}

const COVER_PAGE_HEIGHT = 175 // ✅ Fixed at 175px

const DEFAULT_COVERPAGE_ELEMENTS: CoverPageElement[] = [
  { id: "logo", label: "Company Logo", enabled: true, x: 10, y: 15, align: 'left' },
  { id: "title", label: "MEETING AGENDA", enabled: true, x: 50, y: 40, align: 'center', fontSize: 48, bold: true, uppercase: true, letterSpacing: 3 },
  { id: "building_name", label: "Building Name", enabled: true, x: 50, y: 60, align: 'center', fontSize: 24, bold: false, uppercase: false, letterSpacing: 1 },
  { id: "meeting_type", label: "Meeting Type", enabled: true, x: 50, y: 70, align: 'center', fontSize: 18, bold: false, uppercase: false, letterSpacing: 0.5 },
]

const DEFAULT_INFOCARD_FIELDS: TemplateField[] = [
  { id: "date", label: "Date", order: 1, enabled: true },
  { id: "time", label: "Time", order: 2, enabled: true },
  { id: "location", label: "Location", order: 3, enabled: true },
  { id: "address", label: "Address", order: 4, enabled: true },
  { id: "strata_plan", label: "Strata Plan", order: 5, enabled: true },
]

const SAMPLE_MEETING: Meeting = {
  id: 0,
  title: "Sample Meeting Title",
  meeting_date: new Date().toISOString(),
  start_time: "6:30 PM",
  location: "Boardroom / Microsoft Teams",
  meeting_type: "Council Meeting",
  strata_plan_number: "BCS 1234",
  buildings: {
    id: 0,
    name: "Sample Building",
    address: "789 Preview Lane, Vancouver, BC",
    logo_url: null,
    companies: null
  }
}

const SAMPLE_SECTIONS: Section[] = [
  { id: 1, title: "Call to Order", order_index: 1 },
  { id: 2, title: "Approval of Agenda", order_index: 2 },
  { id: 3, title: "New Business", order_index: 3 },
]

const SAMPLE_TOPICS: Topic[] = [
  { id: 1, section_id: 1, title: "Roll Call", description: "Taking attendance and checking for quorum.", order_index: 1 },
  { id: 2, section_id: 2, title: "Vote on Today's Agenda", description: null, order_index: 1 },
  { id: 3, section_id: 3, title: "Elevator Modernization Project", description: "Reviewing bids from contractors.", order_index: 1 },
]

export default function AgendaTemplatesTab({ buildings, loading }: AgendaTemplatesTabProps) {
  const [selectedBuildingId, setSelectedBuildingId] = useState<number | null>(null)
  const [coverPageElements, setCoverPageElements] = useState<CoverPageElement[]>(DEFAULT_COVERPAGE_ELEMENTS)
  const [infoCardFields, setInfoCardFields] = useState<TemplateField[]>(DEFAULT_INFOCARD_FIELDS)
  const [coverPageColor, setCoverPageColor] = useState("#1e3a8a")
  const [infoCardAccentColor, setInfoCardAccentColor] = useState("#2563eb")
  const [agendaItemsColor, setAgendaItemsColor] = useState("#2563eb")
  // Feature 2 — section header text color
  const [sectionHeaderTextColor, setSectionHeaderTextColor] = useState<'black' | 'white'>('white')
  const [agendaHeaderTextColor, setAgendaHeaderTextColor] = useState<'black' | 'white'>('white')
  const [coverPageTextColor, setCoverPageTextColor] = useState<'black' | 'white'>('white')
  const [infoCardHeaderTextColor, setInfoCardHeaderTextColor] = useState<'black' | 'white'>('white')
  // Feature 1 — rich text blocks
  const [richTextBlocks, setRichTextBlocks] = useState<RichTextBlock[]>([])
  const [saving, setSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const [loadingTemplate, setLoadingTemplate] = useState(false)
  const [templateId, setTemplateId] = useState<number | null>(null)
  const [availableMeetingTypes, setAvailableMeetingTypes] = useState<string[]>([])

  // Undo history
  const [history, setHistory] = useState<TemplateState[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)

  // Free drag state
  const [draggingElementId, setDraggingElementId] = useState<string | null>(null)
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const coverPageRef = useRef<HTMLDivElement>(null)

  // Info card drag state
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)

  // Real meeting data
  const [meeting, setMeeting] = useState<Meeting | null>(null)
  const [sections, setSections] = useState<Section[]>([])
  const [topics, setTopics] = useState<Topic[]>([])
  const [loadingMeeting, setLoadingMeeting] = useState(false)
  const [companyLogoUrl, setCompanyLogoUrl] = useState<string | null>(null)

  // Save to history
  const saveToHistory = useCallback(() => {
    const currentState: TemplateState = {
      coverPageElements: [...coverPageElements],
      infoCardFields: [...infoCardFields],
      coverPageColor,
      infoCardAccentColor,
      agendaItemsColor,
      sectionHeaderTextColor,
      agendaHeaderTextColor,
      coverPageTextColor,
      infoCardHeaderTextColor,
      richTextBlocks: [...richTextBlocks],
    }

    setHistory(prev => {
      const newHistory = prev.slice(0, historyIndex + 1)
      newHistory.push(currentState)
      return newHistory.slice(-20)
    })
    setHistoryIndex(prev => Math.min(prev + 1, 19))
  }, [coverPageElements, infoCardFields, coverPageColor, infoCardAccentColor, agendaItemsColor, sectionHeaderTextColor, richTextBlocks, historyIndex])

  // Undo function
  const handleUndo = () => {
    if (historyIndex > 0) {
      const prevState = history[historyIndex - 1]
      setCoverPageElements(prevState.coverPageElements)
      setInfoCardFields(prevState.infoCardFields)
      setCoverPageColor(prevState.coverPageColor)
      setInfoCardAccentColor(prevState.infoCardAccentColor)
      setAgendaItemsColor(prevState.agendaItemsColor)
      setSectionHeaderTextColor(prevState.sectionHeaderTextColor || 'white')
      setAgendaHeaderTextColor(prevState.agendaHeaderTextColor || 'white')
      setCoverPageTextColor(prevState.coverPageTextColor || 'white')
      setInfoCardHeaderTextColor(prevState.infoCardHeaderTextColor || 'white')
      setRichTextBlocks(prevState.richTextBlocks || [])
      setHistoryIndex(prev => prev - 1)
      setHasChanges(true)
    }
  }

  // Keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault()
        handleUndo()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [historyIndex, history])

  useEffect(() => {
    if (buildings.length > 0 && !selectedBuildingId) {
      setSelectedBuildingId(buildings[0].id)
    }
  }, [buildings])

  useEffect(() => {
    if (selectedBuildingId) {
      loadTemplate()
      loadMostRecentMeeting()
      fetchMeetingTypes()
    }
  }, [selectedBuildingId])

  const fetchMeetingTypes = async () => {
    if (!selectedBuildingId) return
    const building = buildings.find(b => b.id === selectedBuildingId)
    const companyId = building?.company_id
    
    try {
      const { data, error } = await supabase
        .from('voting_parameters')
        .select('value, parameter_type, company_id')
        .eq('parameter_type', 'meeting_type')
        .or(`company_id.eq.${companyId || -1},company_id.is.null`)
      
      if (error) throw error
      
      // Deduplicate by value (company override wins)
      const seen = new Map<string, string>()
      // Global first
      data.filter(p => !p.company_id).forEach(p => seen.set(p.value.trim().toLowerCase(), p.value))
      // Company specific wins
      data.filter(p => p.company_id).forEach(p => seen.set(p.value.trim().toLowerCase(), p.value))
      
      setAvailableMeetingTypes(Array.from(seen.values()))
    } catch (err) {
      console.error("Error fetching meeting types for agenda:", err)
      // Fallback
      setAvailableMeetingTypes(['Council Meeting', 'AGM', 'SGM', 'Special Meeting', 'Emergency Meeting'])
    }
  }

  const loadMostRecentMeeting = async () => {
    if (!selectedBuildingId) return

    setLoadingMeeting(true)
    try {
      // Fetch company logo directly from the building's company
      const building = buildings.find(b => b.id === selectedBuildingId)
      if (building?.company_id) {
        const { data: companyData } = await supabase
          .from("companies")
          .select("logo_url")
          .eq("id", building.company_id)
          .single()
        setCompanyLogoUrl(companyData?.logo_url || null)
      } else {
        setCompanyLogoUrl(building?.logo_url || null)
      }

      const { data: meetingData, error: meetingError } = await supabase
        .from("meetings")
        .select(`
          *,
          buildings!inner(
            id,
            name,
            address,
            logo_url,
            company_id,
            companies (
              logo_url
            )
          )
        `)
        .eq("building_id", selectedBuildingId)
        .order("meeting_date", { ascending: false })
        .limit(1)
        .single()

      if (meetingError) {
        // Fallback to company defaults if no meetings exist
        const building = buildings.find(b => b.id === selectedBuildingId)
        
        let defaultSections: any[] = []
        if (building?.company_id) {
          const { data: company } = await supabase
            .from("companies")
            .select("default_meeting_sections")
            .eq("id", building.company_id)
            .single()
          
          if (company?.default_meeting_sections) {
            defaultSections = company.default_meeting_sections.map((title: string, idx: number) => ({
              id: -(idx + 1),
              title,
              order_index: idx + 1
            }))
          }
        }

        const customSample: Meeting = {
          ...SAMPLE_MEETING,
          title: "Template Preview",
          meeting_date: new Date().toISOString(),
          buildings: {
            id: selectedBuildingId,
            name: building?.name || "Select a Building",
            address: building?.address || "",
            logo_url: building?.logo_url || null,
            companies: (building as any)?.companies || null
          }
        }

        setMeeting(customSample)
        setSections(defaultSections)
        setTopics([])
        return
      }

      setMeeting(meetingData)

      const { data: sectionsData } = await supabase
        .from("sections")
        .select("*")
        .eq("meeting_id", meetingData.id)
        .order("order_index")

      setSections(sectionsData || [])

      const { data: topicsData } = await supabase
        .from("topics")
        .select("*")
        .eq("meeting_id", meetingData.id)
        .order("order_index")

      setTopics(topicsData || [])

    } catch (err) {
      console.error("Error loading meeting:", err)
      setMeeting(SAMPLE_MEETING)
      setSections(SAMPLE_SECTIONS)
      setTopics(SAMPLE_TOPICS)
    } finally {
      setLoadingMeeting(false)
    }
  }

  const loadTemplate = async () => {
    if (!selectedBuildingId) return

    setLoadingTemplate(true)
    try {
      const { data, error } = await supabase
        .from('agendatemplates')
        .select('*')
        .eq('buildingid', selectedBuildingId)
        .order('updatedat', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (error) {
        if (error.code === 'PGRST116') {
          setCoverPageElements(DEFAULT_COVERPAGE_ELEMENTS)
          setInfoCardFields(DEFAULT_INFOCARD_FIELDS)
          setCoverPageColor("#1e3a8a")
          setInfoCardAccentColor("#2563eb")
          setAgendaItemsColor("#2563eb")
          setSectionHeaderTextColor('white')
          setRichTextBlocks([])
          setTemplateId(null)
        }
      } else if (data) {
        const row = data as any
        setTemplateId(row.id)
        setCoverPageColor(row.coverpage_color || "#1e3a8a")
        setInfoCardAccentColor(row.infocard_accent_color || "#2563eb")
        setAgendaItemsColor(row.agenda_items_color || "#2563eb")
        setSectionHeaderTextColor((row.section_header_text_color as 'black' | 'white') || 'white')
        setAgendaHeaderTextColor((row.agenda_header_text_color as 'black' | 'white') || 'white')
        setCoverPageTextColor((row.coverpage_text_color as 'black' | 'white') || 'white')
        setInfoCardHeaderTextColor((row.infocard_header_text_color as 'black' | 'white') || 'white')
        setRichTextBlocks((row.rich_text_blocks as unknown as RichTextBlock[]) || [])
        setCoverPageElements((row.coverpage_elements as unknown as CoverPageElement[]) || DEFAULT_COVERPAGE_ELEMENTS)
        setInfoCardFields((row.infocard_fields as unknown as TemplateField[]) || DEFAULT_INFOCARD_FIELDS)
      }

      setHasChanges(false)
      saveToHistory()
    } catch (err) {
      console.error('Error loading template:', err)
    } finally {
      setLoadingTemplate(false)
    }
  }

  const handleCoverMouseDown = (e: React.MouseEvent, elementId: string) => {
    saveToHistory()
    const element = coverPageElements.find(el => el.id === elementId)
    if (!element || !coverPageRef.current) return

    const rect = coverPageRef.current.getBoundingClientRect()
    const elementX = (element.x / 100) * rect.width
    const elementY = (element.y / 100) * rect.height

    setDraggingElementId(elementId)
    setDragOffset({
      x: e.clientX - elementX,
      y: e.clientY - elementY
    })
  }

  const handleCoverMouseMove = (e: React.MouseEvent) => {
    if (!draggingElementId || !coverPageRef.current) return

    const rect = coverPageRef.current.getBoundingClientRect()
    const newX = ((e.clientX - dragOffset.x) / rect.width) * 100
    const newY = ((e.clientY - dragOffset.y) / rect.height) * 100

    const clampedX = Math.max(0, Math.min(100, newX))
    const clampedY = Math.max(0, Math.min(100, newY))

    setCoverPageElements(prev => prev.map(el =>
      el.id === draggingElementId
        ? { ...el, x: clampedX, y: clampedY }
        : el
    ))
    setHasChanges(true)
  }

  const handleCoverMouseUp = () => {
    setDraggingElementId(null)
  }

  const handleInfoDragStart = (index: number) => {
    saveToHistory()
    setDraggedIndex(index)
  }

  const handleInfoDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    if (draggedIndex === null || draggedIndex === index) return

    const fields = [...infoCardFields]
    const draggedField = fields[draggedIndex]

    fields.splice(draggedIndex, 1)
    fields.splice(index, 0, draggedField)

    fields.forEach((field, i) => {
      field.order = i + 1
    })

    setInfoCardFields(fields)
    setDraggedIndex(index)
    setHasChanges(true)
  }

  const handleInfoDragEnd = () => {
    setDraggedIndex(null)
  }

  const handleSave = async () => {
    if (!selectedBuildingId) {
      alert('Please select a building')
      return
    }

    setSaving(true)
    try {
      const templateData = {
        buildingid: selectedBuildingId,
        coverpage_elements: coverPageElements as any,
        infocard_fields: infoCardFields as any,
        coverpage_color: coverPageColor,
        infocard_accent_color: infoCardAccentColor,
        agenda_items_color: agendaItemsColor,
        coverpage_height: COVER_PAGE_HEIGHT,
        section_header_text_color: sectionHeaderTextColor,
        agenda_header_text_color: agendaHeaderTextColor,
        coverpage_text_color: coverPageTextColor,
        infocard_header_text_color: infoCardHeaderTextColor,
        rich_text_blocks: richTextBlocks as any,
      }

      if (templateId) {
        const { error } = await supabase
          .from('agendatemplates')
          .update({
            ...templateData,
            updatedat: new Date().toISOString()
          })
          .eq('id', templateId)

        if (error) throw error
      } else {
        const { data, error } = await supabase
          .from('agendatemplates')
          .insert(templateData)
          .select()
          .single()

        if (error) throw error
        if (data) setTemplateId(data.id)
      }

      setHasChanges(false)
      alert('✅ Template saved! PDFs will now use this design.')
    } catch (err) {
      console.error('Error saving template:', err)
      alert('Failed to save template')
    } finally {
      setSaving(false)
    }
  }

  const formatMeetingDate = (dateStr: string) => {
    if (!dateStr) return ""
    const date = dateStr.includes('T') ? new Date(dateStr) : new Date(dateStr + 'T00:00:00')
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric"
    })
  }

  const hexToRgb = (hex: string): number[] => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    return result
      ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
      : [30, 58, 138]
  }

  const getLighterColor = (hex: string, amount: number = 80) => {
    const rgb = hexToRgb(hex)
    return `rgb(${Math.min(255, rgb[0] + amount)}, ${Math.min(255, rgb[1] + amount)}, ${Math.min(255, rgb[2] + amount)})`
  }

  const topicsBySection = topics.reduce((acc, topic) => {
    if (topic.section_id) {
      if (!acc[topic.section_id]) acc[topic.section_id] = []
      acc[topic.section_id].push(topic)
    }
    return acc
  }, {} as Record<number, Topic[]>)

  return (
    <>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-foreground mb-2">Agenda Templates</h2>
        <p className="text-muted-foreground">
          Drag elements, change colors - Press Ctrl+Z to undo
        </p>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading buildings...</p>
        </div>
      ) : buildings.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-border rounded-lg">
          <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
          <p className="text-muted-foreground">No buildings available</p>
        </div>
      ) : (
        <>
          <Card className="p-4 mb-6">
            <div className="flex items-center gap-4">
              <label className="text-sm font-semibold">Select Building:</label>
              <select
                value={selectedBuildingId || ""}
                onChange={(e) => setSelectedBuildingId(Number(e.target.value))}
                className="flex-1 px-3 py-2 border rounded"
              >
                {buildings.map(building => (
                  <option key={building.id} value={building.id}>
                    {building.name}
                  </option>
                ))}
              </select>
              {meeting && (
                <span className="text-sm text-muted-foreground">
                  Previewing: <strong>{meeting.title}</strong>
                </span>
              )}
              <Button
                onClick={handleUndo}
                disabled={historyIndex <= 0}
                variant="outline"
                size="sm"
                className="gap-2"
              >
                <Undo className="h-4 w-4" />
                Undo (Ctrl+Z)
              </Button>
            </div>
          </Card>

          {loadingTemplate || loadingMeeting ? (
            <div className="text-center py-12">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-primary" />
              <p className="text-muted-foreground">Loading...</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-12 gap-6 mb-6">
                <div className="col-span-12 lg:col-span-3 space-y-4">
                  <div className="flex items-center justify-between mb-2 px-1">
                     <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Template Editor</h3>
                     {meeting?.id === 0 && (
                       <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-black uppercase tracking-wider">Default Template</span>
                     )}
                  </div>

                  <Card className="p-4">
                    <h3 className="text-sm font-semibold mb-3">Cover Background</h3>
                    <input
                      type="color"
                      value={coverPageColor}
                      onChange={(e) => {
                        saveToHistory()
                        setCoverPageColor(e.target.value)
                        setHasChanges(true)
                      }}
                      className="w-full h-20 rounded border cursor-pointer mb-2"
                    />
                    <input
                      type="text"
                      value={coverPageColor}
                      onChange={(e) => {
                        setCoverPageColor(e.target.value)
                        setHasChanges(true)
                      }}
                      className="w-full px-2 py-1 border rounded text-sm"
                    />
                    <div className="mt-3">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Header Text Color</p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => { saveToHistory(); setCoverPageTextColor('white'); setHasChanges(true) }}
                          className={`flex-1 py-1.5 text-xs font-semibold rounded border transition-all ${
                            coverPageTextColor === 'white'
                              ? 'bg-gray-800 text-white border-gray-800'
                              : 'bg-white text-gray-700 border-gray-300 hover:border-gray-500'
                          }`}
                        >
                          ◉ White
                        </button>
                        <button
                          onClick={() => { saveToHistory(); setCoverPageTextColor('black'); setHasChanges(true) }}
                          className={`flex-1 py-1.5 text-xs font-semibold rounded border transition-all ${
                            coverPageTextColor === 'black'
                              ? 'bg-white text-black border-black ring-2 ring-black'
                              : 'bg-white text-gray-700 border-gray-300 hover:border-gray-500'
                          }`}
                        >
                          ○ Black
                        </button>
                      </div>
                    </div>
                  </Card>

                  <Card className="p-4">
                    <h3 className="text-sm font-semibold mb-3">Info Card Accent</h3>
                    <input
                      type="color"
                      value={infoCardAccentColor}
                      onChange={(e) => {
                        saveToHistory()
                        setInfoCardAccentColor(e.target.value)
                        setHasChanges(true)
                      }}
                      className="w-full h-20 rounded border cursor-pointer mb-2"
                    />
                    <input
                      type="text"
                      value={infoCardAccentColor}
                      onChange={(e) => {
                        setInfoCardAccentColor(e.target.value)
                        setHasChanges(true)
                      }}
                      className="w-full px-2 py-1 border rounded text-sm"
                    />
                    <div className="mt-3">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Info Header Text</p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => { saveToHistory(); setInfoCardHeaderTextColor('white'); setHasChanges(true) }}
                          className={`flex-1 py-1.5 text-xs font-semibold rounded border transition-all ${
                            infoCardHeaderTextColor === 'white'
                              ? 'bg-gray-800 text-white border-gray-800'
                              : 'bg-white text-gray-700 border-gray-300 hover:border-gray-500'
                          }`}
                        >
                          ◉ White
                        </button>
                        <button
                          onClick={() => { saveToHistory(); setInfoCardHeaderTextColor('black'); setHasChanges(true) }}
                          className={`flex-1 py-1.5 text-xs font-semibold rounded border transition-all ${
                            infoCardHeaderTextColor === 'black'
                              ? 'bg-white text-black border-black ring-2 ring-black'
                              : 'bg-white text-gray-700 border-gray-300 hover:border-gray-500'
                          }`}
                        >
                          ○ Black
                        </button>
                      </div>
                    </div>
                  </Card>

                  <Card className="p-4">
                    <h3 className="text-sm font-semibold mb-3">Agenda Items / Section Headers</h3>
                    <input
                      type="color"
                      value={agendaItemsColor}
                      onChange={(e) => {
                        saveToHistory()
                        setAgendaItemsColor(e.target.value)
                        setHasChanges(true)
                      }}
                      className="w-full h-20 rounded border cursor-pointer mb-2"
                    />
                    <input
                      type="text"
                      value={agendaItemsColor}
                      onChange={(e) => {
                        setAgendaItemsColor(e.target.value)
                        setHasChanges(true)
                      }}
                      className="w-full px-2 py-1 border rounded text-sm mb-3"
                    />
                    {/* Feature 2 — Section header text color toggle */}
                    <div className="border-t pt-4">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Section Header Text</p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => { saveToHistory(); setSectionHeaderTextColor('white'); setHasChanges(true) }}
                          className={`flex-1 py-1.5 text-xs font-semibold rounded border transition-all ${
                            sectionHeaderTextColor === 'white'
                              ? 'bg-gray-800 text-white border-gray-800'
                              : 'bg-white text-gray-700 border-gray-300 hover:border-gray-500'
                          }`}
                        >
                          ◉ White
                        </button>
                        <button
                          onClick={() => { saveToHistory(); setSectionHeaderTextColor('black'); setHasChanges(true) }}
                          className={`flex-1 py-1.5 text-xs font-semibold rounded border transition-all ${
                            sectionHeaderTextColor === 'black'
                              ? 'bg-white text-black border-black ring-2 ring-black'
                              : 'bg-white text-gray-700 border-gray-300 hover:border-gray-500'
                          }`}
                        >
                          ○ Black
                        </button>
                      </div>
                    </div>

                    <div className="mt-4 border-t pt-4">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Agenda Header Text</p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => { saveToHistory(); setAgendaHeaderTextColor('white'); setHasChanges(true) }}
                          className={`flex-1 py-1.5 text-xs font-semibold rounded border transition-all ${
                            agendaHeaderTextColor === 'white'
                              ? 'bg-gray-800 text-white border-gray-800'
                              : 'bg-white text-gray-700 border-gray-300 hover:border-gray-500'
                          }`}
                        >
                          ◉ White
                        </button>
                        <button
                          onClick={() => { saveToHistory(); setAgendaHeaderTextColor('black'); setHasChanges(true) }}
                          className={`flex-1 py-1.5 text-xs font-semibold rounded border transition-all ${
                            agendaHeaderTextColor === 'black'
                              ? 'bg-white text-black border-black ring-2 ring-black'
                              : 'bg-white text-gray-700 border-gray-300 hover:border-gray-500'
                          }`}
                        >
                          ○ Black
                        </button>
                      </div>
                    </div>
                  </Card>

                  {/* Header Styles Sidebar Card */}
                  {selectedElementId && coverPageElements.find(el => el.id === selectedElementId) && selectedElementId !== 'logo' && (
                    <Card className="p-4 border-2 border-blue-500 shadow-md">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-bold text-blue-900 uppercase tracking-tight">Element Styles</h3>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => setSelectedElementId(null)}
                          className="h-6 px-2 text-[10px]"
                        >
                          CLOSE
                        </Button>
                      </div>

                      <div className="space-y-4">
                        {/* Font Size Slider */}
                        <div>
                          <div className="flex justify-between mb-1">
                            <label className="text-[10px] font-bold text-muted-foreground uppercase">Font Size</label>
                            <span className="text-[10px] font-mono font-bold text-blue-600">{coverPageElements.find(el => el.id === selectedElementId)?.fontSize || 20}pt</span>
                          </div>
                          <input 
                            type="range" min="10" max="100" 
                            value={coverPageElements.find(el => el.id === selectedElementId)?.fontSize || 20}
                            onChange={(e) => {
                              saveToHistory();
                              setCoverPageElements(prev => prev.map(el => 
                                el.id === selectedElementId ? { ...el, fontSize: Number(e.target.value) } : el
                              ));
                              setHasChanges(true);
                            }}
                            className="w-full h-1.5 bg-blue-100 rounded-lg appearance-none cursor-pointer accent-blue-600"
                          />
                        </div>

                        {/* Letter Spacing Slider */}
                        <div>
                          <div className="flex justify-between mb-1">
                            <label className="text-[10px] font-bold text-muted-foreground uppercase">Tracking</label>
                            <span className="text-[10px] font-mono font-bold text-blue-600">{coverPageElements.find(el => el.id === selectedElementId)?.letterSpacing || 0}px</span>
                          </div>
                          <input 
                            type="range" min="0" max="20" step="0.5"
                            value={coverPageElements.find(el => el.id === selectedElementId)?.letterSpacing || 0}
                            onChange={(e) => {
                              saveToHistory();
                              setCoverPageElements(prev => prev.map(el => 
                                el.id === selectedElementId ? { ...el, letterSpacing: Number(e.target.value) } : el
                              ));
                              setHasChanges(true);
                            }}
                            className="w-full h-1.5 bg-blue-100 rounded-lg appearance-none cursor-pointer accent-blue-600"
                          />
                        </div>

                        {/* Style Toggles */}
                        <div className="grid grid-cols-3 gap-2">
                          <button
                            onClick={() => {
                              saveToHistory();
                              setCoverPageElements(prev => prev.map(el => 
                                el.id === selectedElementId ? { ...el, bold: !el.bold } : el
                              ));
                              setHasChanges(true);
                            }}
                            className={`py-1.5 text-[10px] font-bold rounded border transition-all ${
                              coverPageElements.find(el => el.id === selectedElementId)?.bold 
                                ? 'bg-blue-600 text-white border-blue-600 shadow-sm' 
                                : 'bg-white text-blue-700 border-blue-100 hover:border-blue-300'
                            }`}
                          >
                            BOLD
                          </button>
                          
                          <button
                            onClick={() => {
                              saveToHistory();
                              setCoverPageElements(prev => prev.map(el => 
                                el.id === selectedElementId ? { ...el, italic: !el.italic } : el
                              ));
                              setHasChanges(true);
                            }}
                            className={`py-1.5 text-[10px] font-bold rounded border transition-all ${
                              coverPageElements.find(el => el.id === selectedElementId)?.italic 
                                ? 'bg-blue-600 text-white border-blue-600 shadow-sm' 
                                : 'bg-white text-blue-700 border-blue-100 hover:border-blue-300'
                            }`}
                          >
                            ITALIC
                          </button>

                          <button
                            onClick={() => {
                              saveToHistory();
                              setCoverPageElements(prev => prev.map(el => 
                                el.id === selectedElementId ? { ...el, uppercase: !el.uppercase } : el
                              ));
                              setHasChanges(true);
                            }}
                            className={`py-1.5 text-[10px] font-bold rounded border transition-all ${
                              coverPageElements.find(el => el.id === selectedElementId)?.uppercase 
                                ? 'bg-blue-600 text-white border-blue-600 shadow-sm' 
                                : 'bg-white text-blue-700 border-blue-100 hover:border-blue-300'
                            }`}
                          >
                            UPPER
                          </button>
                        </div>
                      </div>
                    </Card>
                  )}

                  {/* Feature 1 — Rich Text Blocks */}
                  <Card className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold">📝 Text Blocks</h3>
                      <span className="text-[10px] text-muted-foreground">Header &amp; Footer</span>
                    </div>

                    {/* Header blocks */}
                    <div className="mb-3">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-[11px] font-bold text-blue-700 uppercase tracking-wider">▲ Before Header</p>
                        <button
                          onClick={() => {
                            saveToHistory()
                            const headerBlocks = richTextBlocks.filter(b => b.slot === 'header')
                            const newBlock: RichTextBlock = {
                              id: generateBlockId(),
                              slot: 'header',
                              order: headerBlocks.length,
                              label: `Header Block ${headerBlocks.length + 1}`,
                              content: '',
                              fontSize: 11,
                              bold: false,
                              italic: false,
                              textAlign: 'left',
                              meetingTypeFilter: [],
                            }
                            setRichTextBlocks(prev => [...prev, newBlock])
                            setHasChanges(true)
                          }}
                          className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-semibold"
                        >
                          <Plus className="h-3 w-3" /> Add
                        </button>
                      </div>
                      {richTextBlocks.filter(b => b.slot === 'header').sort((a,b) => a.order - b.order).map(block => (
                        <RichTextBlockEditor
                          key={block.id}
                          block={block}
                          availableMeetingTypes={availableMeetingTypes}
                          buildingId={selectedBuildingId || undefined}
                          onUpdate={(updated) => {
                            setRichTextBlocks(prev => prev.map(b => b.id === updated.id ? updated : b))
                            setHasChanges(true)
                          }}
                          onDelete={() => {
                            saveToHistory()
                            setRichTextBlocks(prev => prev.filter(b => b.id !== block.id))
                            setHasChanges(true)
                          }}
                          onMove={(dir) => {
                            saveToHistory()
                            const slotBlocks = richTextBlocks.filter(b => b.slot === 'header').sort((a,b) => a.order - b.order)
                            const idx = slotBlocks.findIndex(b => b.id === block.id)
                            if (dir === 'up' && idx === 0) return
                            if (dir === 'down' && idx === slotBlocks.length - 1) return
                            const swapIdx = dir === 'up' ? idx - 1 : idx + 1
                            const newSlotBlocks = [...slotBlocks]
                            ;[newSlotBlocks[idx], newSlotBlocks[swapIdx]] = [newSlotBlocks[swapIdx], newSlotBlocks[idx]]
                            newSlotBlocks.forEach((b, i) => { b.order = i })
                            setRichTextBlocks(prev => [
                              ...prev.filter(b => b.slot !== 'header'),
                              ...newSlotBlocks,
                            ])
                            setHasChanges(true)
                          }}
                        />
                      ))}
                      {richTextBlocks.filter(b => b.slot === 'header').length === 0 && (
                        <p className="text-xs text-muted-foreground italic py-2 text-center border border-dashed rounded">No header blocks</p>
                      )}
                    </div>

                    {/* Footer blocks */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-[11px] font-bold text-green-700 uppercase tracking-wider">▼ After Footer</p>
                        <button
                          onClick={() => {
                            saveToHistory()
                            const footerBlocks = richTextBlocks.filter(b => b.slot === 'footer')
                            const newBlock: RichTextBlock = {
                              id: generateBlockId(),
                              slot: 'footer',
                              order: footerBlocks.length,
                              label: `Footer Block ${footerBlocks.length + 1}`,
                              content: '',
                              fontSize: 11,
                              bold: false,
                              italic: false,
                              textAlign: 'left',
                              meetingTypeFilter: [],
                            }
                            setRichTextBlocks(prev => [...prev, newBlock])
                            setHasChanges(true)
                          }}
                          className="flex items-center gap-1 text-xs text-green-600 hover:text-green-800 font-semibold"
                        >
                          <Plus className="h-3 w-3" /> Add
                        </button>
                      </div>
                      {richTextBlocks.filter(b => b.slot === 'footer').sort((a,b) => a.order - b.order).map(block => (
                        <RichTextBlockEditor
                          key={block.id}
                          block={block}
                          availableMeetingTypes={availableMeetingTypes}
                          buildingId={selectedBuildingId || undefined}
                          onUpdate={(updated) => {
                            setRichTextBlocks(prev => prev.map(b => b.id === updated.id ? updated : b))
                            setHasChanges(true)
                          }}
                          onDelete={() => {
                            saveToHistory()
                            setRichTextBlocks(prev => prev.filter(b => b.id !== block.id))
                            setHasChanges(true)
                          }}
                          onMove={(dir) => {
                            saveToHistory()
                            const slotBlocks = richTextBlocks.filter(b => b.slot === 'footer').sort((a,b) => a.order - b.order)
                            const idx = slotBlocks.findIndex(b => b.id === block.id)
                            if (dir === 'up' && idx === 0) return
                            if (dir === 'down' && idx === slotBlocks.length - 1) return
                            const swapIdx = dir === 'up' ? idx - 1 : idx + 1
                            const newSlotBlocks = [...slotBlocks]
                            ;[newSlotBlocks[idx], newSlotBlocks[swapIdx]] = [newSlotBlocks[swapIdx], newSlotBlocks[idx]]
                            newSlotBlocks.forEach((b, i) => { b.order = i })
                            setRichTextBlocks(prev => [
                              ...prev.filter(b => b.slot !== 'footer'),
                              ...newSlotBlocks,
                            ])
                            setHasChanges(true)
                          }}
                        />
                      ))}
                      {richTextBlocks.filter(b => b.slot === 'footer').length === 0 && (
                        <p className="text-xs text-muted-foreground italic py-2 text-center border border-dashed rounded">No footer blocks</p>
                      )}
                    </div>
                  </Card>
                </div>

                {/* LIVE PREVIEW */}
                <div className="col-span-12 lg:col-span-9">
                  <Card className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold">📄 Live PDF Preview</h3>
                      {meeting && (
                        <span className="text-xs bg-green-100 text-green-800 px-3 py-1 rounded-full font-semibold">
                          ● {meeting.title}
                        </span>
                      )}
                    </div>

                    <div
                      className="border-4 border-gray-400 rounded-lg overflow-y-auto bg-white shadow-2xl"
                      style={{ maxHeight: '1000px' }}
                    >
                      {/* PREVIEW: Before Header Rich Text Blocks */}
                      <div className="bg-white px-6 py-2 space-y-2">
                        {richTextBlocks
                          .filter(b => b.slot === 'header')
                          .filter(b => !meeting || b.meetingTypeFilter.length === 0 || (meeting.meeting_type && b.meetingTypeFilter.some(mt => meeting.meeting_type?.toLowerCase().includes(mt.toLowerCase()) || mt.toLowerCase().includes(meeting.meeting_type?.toLowerCase() || ""))))
                          .sort((a,b) => a.order - b.order)
                          .map(block => (
                            <div key={block.id}>
                              <div 
                                style={{
                                  fontSize: `${block.fontSize}pt`,
                                  textAlign: block.textAlign as any,
                                  fontWeight: block.bold ? 'bold' : 'normal',
                                  fontStyle: block.italic ? 'italic' : 'normal',
                                  whiteSpace: 'pre-wrap',
                                  color: '#374151'
                                }}
                              >
                                {block.content || <span className="text-gray-300 italic">(Empty {block.label})</span>}
                              </div>
                              {block.attachmentName && (
                                <div className="mt-1 inline-flex items-center gap-1.5 bg-blue-50 border border-blue-200 text-blue-700 rounded px-2 py-0.5">
                                  <FileText className="h-3 w-3 flex-shrink-0" />
                                  <span className="text-[10px] font-medium">📎 {block.attachmentName}</span>
                                </div>
                              )}
                            </div>
                          ))}
                      </div>

                      {/* COVER PAGE - FIXED 175px */}
                      <div
                        ref={coverPageRef}
                        className="relative text-white cursor-crosshair select-none"
                        style={{
                          backgroundColor: coverPageColor,
                          height: `${COVER_PAGE_HEIGHT}px`,
                          position: 'relative'
                        }}
                        onMouseMove={handleCoverMouseMove}
                        onMouseUp={handleCoverMouseUp}
                        onMouseLeave={handleCoverMouseUp}
                      >
                        {meeting && coverPageElements.filter(el => el.enabled).map(element => (
                          <div
                            key={element.id}
                            className={`absolute cursor-move transition-opacity ${draggingElementId === element.id ? 'opacity-70 scale-105' : 'hover:opacity-90'
                              }`}
                            style={{
                              left: `${element.x}%`,
                              top: `${element.y}%`,
                              transform: element.align === 'center' ? 'translate(-50%, -50%)' :
                                element.align === 'right' ? 'translate(-100%, -50%)' :
                                  'translate(0, -50%)',
                              zIndex: draggingElementId === element.id ? 50 : 10
                            }}
                            onMouseDown={(e) => {
                              handleCoverMouseDown(e, element.id);
                              setSelectedElementId(element.id);
                            }}
                          >
                            <div className="relative group">
                              <GripVertical className="absolute -left-7 top-1/2 -translate-y-1/2 h-5 w-5 opacity-50 group-hover:opacity-100" />

                              {element.id === 'logo' && (
                                <div
                                  className="bg-white rounded-full flex items-center justify-center shadow-lg"
                                  style={{
                                    width: '80px',
                                    height: '80px',
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                                  }}
                                >
                                  {meeting?.buildings?.logo_url || meeting?.buildings?.companies?.logo_url || companyLogoUrl ? (
                                    <img
                                      src={meeting?.buildings?.logo_url || meeting?.buildings?.companies?.logo_url || companyLogoUrl || ''}
                                      alt="Logo"
                                      style={{
                                        maxWidth: '70px',
                                        maxHeight: '70px',
                                        objectFit: 'contain'
                                      }}
                                    />
                                  ) : (
                                    <span style={{ fontSize: '42px' }}>🏢</span>
                                  )}
                                </div>
                              )}

                              {element.id === 'title' && (
                                <div 
                                  className="text-center" 
                                  style={{ 
                                    width: '600px',
                                    color: coverPageTextColor === 'black' ? '#000000' : '#ffffff'
                                  }}
                                >
                                  <div style={{
                                    fontWeight: element.bold ? 800 : 400,
                                    fontStyle: element.italic ? 'italic' : 'normal',
                                    letterSpacing: `${element.letterSpacing || 3}px`,
                                    fontSize: `${element.fontSize || 48}px`,
                                    lineHeight: '1.1',
                                    textTransform: element.uppercase !== false ? 'uppercase' : 'none',
                                    textShadow: coverPageTextColor === 'white' ? '0 2px 4px rgba(0,0,0,0.3)' : 'none'
                                  }}>MEETING</div>
                                  <div style={{
                                    fontWeight: element.bold ? 800 : 400,
                                    fontStyle: element.italic ? 'italic' : 'normal',
                                    letterSpacing: `${element.letterSpacing || 3}px`,
                                    fontSize: `${element.fontSize || 48}px`,
                                    lineHeight: '1.1',
                                    textTransform: element.uppercase !== false ? 'uppercase' : 'none',
                                    textShadow: coverPageTextColor === 'white' ? '0 2px 4px rgba(0,0,0,0.3)' : 'none'
                                  }}>AGENDA</div>
                                </div>
                              )}

                              {element.id === 'building_name' && (
                                <div 
                                  className="text-center max-w-[80%]" 
                                  style={{ 
                                    color: coverPageTextColor === 'black' ? 'rgba(0, 0, 0, 0.85)' : 'rgba(255, 255, 255, 0.95)',
                                    fontSize: `${element.fontSize || 24}px`,
                                    fontWeight: element.bold ? 'bold' : 'normal',
                                    fontStyle: element.italic ? 'italic' : 'normal',
                                    letterSpacing: `${element.letterSpacing || 1}px`,
                                    textTransform: element.uppercase ? 'uppercase' : 'none'
                                  }}
                                >
                                  {meeting?.buildings?.name}
                                </div>
                              )}

                              {element.id === 'meeting_type' && (
                                <div 
                                  className="text-center max-w-[80%]" 
                                  style={{ 
                                    color: coverPageTextColor === 'black' ? 'rgba(0, 0, 0, 0.75)' : 'rgba(255, 255, 255, 0.85)',
                                    fontSize: `${element.fontSize || 18}px`,
                                    fontWeight: element.bold ? 'bold' : 'normal',
                                    fontStyle: element.italic ? 'italic' : 'normal',
                                    letterSpacing: `${element.letterSpacing || 0.5}px`,
                                    textTransform: element.uppercase ? 'uppercase' : 'none'
                                  }}
                                >
                                  {meeting?.meeting_type || "Council Meeting"}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* INFO CARD */}
                      <div className="p-6 bg-gray-50">
                        <div className="bg-white rounded-lg shadow-xl overflow-hidden border">
                          <div
                            className="px-4 py-3 font-bold text-sm"
                            style={{ 
                              backgroundColor: infoCardAccentColor,
                              color: infoCardHeaderTextColor === 'black' ? '#000000' : '#ffffff'
                            }}
                          >
                            MEETING INFORMATION
                          </div>

                          <div className="p-4 grid grid-cols-2 gap-x-6 gap-y-4">
                            {infoCardFields
                              .filter(f => f.enabled)
                              .sort((a, b) => a.order - b.order)
                              .map((field, index) => (
                                <div
                                  key={field.id}
                                  draggable
                                  onDragStart={() => handleInfoDragStart(index)}
                                  onDragOver={(e) => handleInfoDragOver(e, index)}
                                  onDragEnd={handleInfoDragEnd}
                                  className={`group cursor-move transition-all ${draggedIndex === index ? "scale-105 bg-blue-50 p-2 rounded" : "hover:bg-gray-50 p-2 rounded"
                                    }`}
                                >
                                  <div className="flex items-start gap-2">
                                    <GripVertical className="h-4 w-4 text-gray-300 mt-0.5 opacity-0 group-hover:opacity-100" />
                                    <div className="flex-1">
                                      <div className="text-[10px] font-bold text-gray-600 uppercase mb-1">
                                        {field.label}
                                      </div>
                                      <div className="text-xs text-gray-900 font-medium">
                                        {field.id === 'date' && meeting && formatMeetingDate(meeting.meeting_date)}
                                        {field.id === 'time' && (meeting?.start_time || 'TBA')}
                                        {field.id === 'location' && (meeting?.location || 'TBA')}
                                        {field.id === 'address' && (meeting?.buildings?.address || 'TBA')}
                                        {field.id === 'strata_plan' && (meeting?.strata_plan_number || 'TBA')}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ))}
                          </div>
                        </div>
                      </div>

                      {/* AGENDA ITEMS */}
                      <div className="p-6 bg-white">
                        <div
                          className="px-4 py-3 font-bold text-xl mb-6 rounded"
                          style={{ 
                            backgroundColor: agendaItemsColor,
                            color: agendaHeaderTextColor === 'black' ? '#000000' : '#ffffff'
                          }}
                        >
                          AGENDA ITEMS
                        </div>

                        {sections.map((section, sectionIdx) => {
                          const sectionTopics = (topicsBySection[section.id] || []).sort((a, b) => a.order_index - b.order_index)

                          return (
                            <div key={section.id} className="mb-6">
                              <div
                                className="p-3 rounded-lg mb-3 flex items-center gap-3"
                                style={{ backgroundColor: agendaItemsColor }}
                              >
                                <div
                                  className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm"
                                  style={{ backgroundColor: agendaItemsColor === '#ffffff' || agendaItemsColor === 'white' ? '#000' : 'rgba(0,0,0,0.25)', color: sectionHeaderTextColor === 'black' ? '#000' : '#fff' }}
                                >
                                  {sectionIdx + 1}
                                </div>
                                <span className="font-bold uppercase" style={{ color: sectionHeaderTextColor }}>{section.title}</span>
                              </div>

                              <div className="ml-6 space-y-3">
                                {sectionTopics.map((topic, topicIdx) => (
                                  <div
                                    key={topic.id}
                                    className={`border rounded-lg p-3 shadow-sm ${topic.is_incamera ? 'bg-red-50 border-red-200' : 'bg-white'
                                      }`}
                                    style={{
                                      borderLeftWidth: '4px',
                                      borderLeftColor: topic.is_incamera ? '#dc2626' : agendaItemsColor
                                    }}
                                  >
                                    <div className="flex items-start gap-3">
                                      <div
                                        className="w-7 h-7 rounded-full flex items-center justify-center text-white font-bold text-xs"
                                        style={{ backgroundColor: topic.is_incamera ? '#dc2626' : agendaItemsColor }}
                                      >
                                        {sectionIdx + 1}.{topicIdx + 1}
                                      </div>
                                      <div className="flex-1">
                                        <div className="font-bold text-gray-800 text-sm">
                                          {topic.title}
                                          {topic.is_incamera && <span className="ml-2 text-red-600 text-xs">[CONFIDENTIAL]</span>}
                                        </div>
                                        {topic.description && !topic.is_incamera && (
                                          <div className="text-xs text-gray-600 mt-1">
                                            {topic.description}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )
                        })}
                      </div>

                      {/* PREVIEW: Footer Rich Text Blocks */}
                      <div className="bg-white px-6 py-4 border-t space-y-2 mt-auto">
                        {richTextBlocks
                          .filter(b => b.slot === 'footer')
                          .filter(b => !meeting || b.meetingTypeFilter.length === 0 || (meeting.meeting_type && b.meetingTypeFilter.some(mt => meeting.meeting_type?.toLowerCase().includes(mt.toLowerCase()) || mt.toLowerCase().includes(meeting.meeting_type?.toLowerCase() || ""))))
                          .sort((a,b) => a.order - b.order)
                          .map(block => (
                            <div key={block.id}>
                              <div 
                                style={{
                                  fontSize: `${block.fontSize}pt`,
                                  textAlign: block.textAlign as any,
                                  fontWeight: block.bold ? 'bold' : 'normal',
                                  fontStyle: block.italic ? 'italic' : 'normal',
                                  whiteSpace: 'pre-wrap',
                                  color: '#374151'
                                }}
                              >
                                {block.content || <span className="text-gray-300 italic">(Empty {block.label})</span>}
                              </div>
                              {block.attachmentName && (
                                <div className="mt-1 inline-flex items-center gap-1.5 bg-blue-50 border border-blue-200 text-blue-700 rounded px-2 py-0.5">
                                  <FileText className="h-3 w-3 flex-shrink-0" />
                                  <span className="text-[10px] font-medium">📎 {block.attachmentName}</span>
                                </div>
                              )}
                            </div>
                          ))}
                      </div>
                    </div>
                  </Card>
                </div>
              </div>

              <div className="mt-6 p-4 bg-gradient-to-r from-green-50 to-blue-50 border-2 border-green-300 rounded-lg">
                <p className="text-sm font-semibold text-green-900">
                  🎯 Drag elements, change colors. Press <kbd className="px-2 py-1 bg-white rounded border">Ctrl+Z</kbd> to undo!
                </p>
              </div>

              <div className="flex justify-center mt-8">
                <Button
                  onClick={handleSave}
                  disabled={saving || !hasChanges}
                  size="lg"
                  className="px-12 py-6 text-lg shadow-lg"
                >
                  <Save className="h-5 w-5 mr-3" />
                  {saving ? "Saving..." : hasChanges ? "Save Template" : "No Changes"}
                </Button>
              </div>
            </>
          )}
        </>
      )}
    </>
  )
}

// ─── Sub-component: Rich Text Block Editor ─────────────────────────────────
function RichTextBlockEditor({
  block,
  availableMeetingTypes,
  onUpdate,
  onDelete,
  onMove,
  buildingId,
}: {
  block: RichTextBlock
  availableMeetingTypes: string[]
  onUpdate: (updated: RichTextBlock) => void
  onDelete: () => void
  onMove: (dir: 'up' | 'down') => void
  buildingId?: number
}) {
  const [expanded, setExpanded] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !buildingId) return

    if (file.type !== 'application/pdf') {
      alert('Please select a PDF file')
      return
    }

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('buildingId', String(buildingId))

      const response = await fetch('/api/templates/upload-attachment', {
        method: 'POST',
        headers: {
          'x-api-key': process.env.NEXT_PUBLIC_API_KEY || '',
        },
        body: formData,
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Upload failed')
      }

      onUpdate({
        ...block,
        attachmentPath: result.filePath,
        attachmentName: result.fileName,
      })
    } catch (err) {
      console.error('Error uploading template attachment:', err)
      alert('Failed to upload PDF. Please try again.')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const removeAttachment = () => {
    onUpdate({
      ...block,
      attachmentPath: undefined,
      attachmentName: undefined
    })
  }

  return (
    <div className="border rounded-lg mb-2 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      {/* Collapsed header row */}
      <div
        className="flex items-center gap-2 px-2 py-1.5 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        <GripVertical className="h-3 w-3 text-gray-400 flex-shrink-0" />
        <span className="text-xs font-semibold text-gray-700 flex-1 truncate">{block.label || '(untitled)'}</span>
        {block.attachmentPath && (
          <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full flex items-center gap-1">
            <LinkIcon className="h-2.5 w-2.5" /> PDF
          </span>
        )}
        <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
          <button onClick={() => onMove('up')} className="p-0.5 hover:bg-gray-200 rounded"><ChevronUp className="h-3 w-3" /></button>
          <button onClick={() => onMove('down')} className="p-0.5 hover:bg-gray-200 rounded"><ChevronDown className="h-3 w-3" /></button>
          <button onClick={onDelete} className="p-0.5 hover:bg-red-100 rounded text-red-500"><Trash2 className="h-3 w-3" /></button>
        </div>
      </div>

      {/* Expanded editor */}
      {expanded && (
        <div className="p-2 space-y-3 bg-white">
          {/* Label */}
          <div>
            <label className="text-[10px] font-bold uppercase text-muted-foreground">Label</label>
            <input
              type="text"
              value={block.label}
              onChange={e => onUpdate({ ...block, label: e.target.value })}
              className="w-full px-2 py-1 border rounded text-xs mt-0.5"
              placeholder="e.g. Zoom Details"
            />
          </div>

          {/* Content */}
          <div>
            <label className="text-[10px] font-bold uppercase text-muted-foreground">Text Content</label>
            <textarea
              value={block.content}
              onChange={e => onUpdate({ ...block, content: e.target.value })}
              className="w-full px-2 py-1 border rounded text-xs mt-0.5 resize-y min-h-[60px]"
              placeholder="Enter text here. Use Enter for new lines."
            />
          </div>

          <div className="flex flex-col gap-2 p-2 bg-gray-50 rounded border border-dashed">
            <label className="text-[10px] font-bold uppercase text-muted-foreground">Attached PDF (Sent in Email)</label>
            
            {block.attachmentPath ? (
              <div className="flex items-center justify-between bg-white p-1.5 rounded border shadow-sm">
                <div className="flex items-center gap-2 truncate">
                  <div className="bg-blue-100 p-1.5 rounded">
                    <FileText className="h-3.5 w-3.5 text-blue-600" />
                  </div>
                  <span className="text-[11px] font-medium truncate max-w-[150px]">{block.attachmentName}</span>
                </div>
                <button 
                  onClick={removeAttachment}
                  className="p-1 hover:bg-red-50 rounded text-red-500 transition-colors"
                  title="Remove attachment"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  accept=".pdf"
                  onChange={handleFileSelect}
                  className="hidden"
                  ref={fileInputRef}
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading || !buildingId}
                  className="h-7 text-[10px] font-bold uppercase bg-white border-blue-200 text-blue-600 hover:bg-blue-50"
                >
                  {uploading ? (
                    <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Uploading...</>
                  ) : (
                    <><Plus className="h-3 w-3 mr-1" /> Attach PDF</>
                  )}
                </Button>
                {!buildingId && <span className="text-[9px] text-red-500 font-bold">SELECT BUILDING FIRST</span>}
                <p className="text-[9px] text-muted-foreground">PDFs only. Max 50MB.</p>
              </div>
            )}
          </div>

          {/* Style row */}
          <div className="flex items-center gap-2">
            <div>
              <label className="text-[10px] font-bold uppercase text-muted-foreground block">Size</label>
              <select
                value={block.fontSize}
                onChange={e => onUpdate({ ...block, fontSize: Number(e.target.value) })}
                className="px-1.5 py-1 border rounded text-xs"
              >
                {[8,9,10,11,12,13,14].map(s => <option key={s} value={s}>{s}pt</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase text-muted-foreground block">Style</label>
              <div className="flex gap-1">
                <button
                  onClick={() => onUpdate({ ...block, bold: !block.bold })}
                  className={`px-2 py-1 text-xs font-bold rounded border transition-colors ${
                    block.bold ? 'bg-gray-800 text-white border-gray-800 shadow-sm' : 'bg-white border-gray-300 hover:border-gray-500'
                  }`}
                >
                  B
                </button>
                <button
                  onClick={() => onUpdate({ ...block, italic: !block.italic })}
                  className={`px-2 py-1 text-xs italic rounded border transition-colors ${
                    block.italic ? 'bg-gray-800 text-white border-gray-800 shadow-sm' : 'bg-white border-gray-300 hover:border-gray-500'
                  }`}
                >
                  I
                </button>
              </div>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase text-muted-foreground block">Align</label>
              <div className="flex gap-1">
                {(['left','center','right'] as const).map(a => (
                  <button
                    key={a}
                    onClick={() => onUpdate({ ...block, textAlign: a })}
                    className={`px-1.5 py-1 rounded border transition-colors ${
                      block.textAlign === a ? 'bg-gray-800 text-white border-gray-800 shadow-sm' : 'bg-white border-gray-300 hover:border-gray-500'
                    }`}
                  >
                    {a === 'left' ? <AlignLeft className="h-3 w-3" /> : a === 'center' ? <AlignCenter className="h-3 w-3" /> : <AlignRight className="h-3 w-3" />}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Feature 3 — Meeting Type Filter */}
          <div>
            <label className="text-[10px] font-bold uppercase text-muted-foreground">Show only for (leave empty = all)</label>
            <div className="flex flex-wrap gap-1 mt-1">
              {availableMeetingTypes.map((mt: string) => {
                const active = block.meetingTypeFilter.includes(mt)
                return (
                  <button
                    key={mt}
                    onClick={() => {
                      const next = active
                        ? block.meetingTypeFilter.filter(x => x !== mt)
                        : [...block.meetingTypeFilter, mt]
                      onUpdate({ ...block, meetingTypeFilter: next })
                    }}
                    className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border transition-colors ${
                      active
                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                        : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
                    }`}
                  >
                    {mt}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
