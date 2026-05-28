"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { GripVertical, Save, FileText, Loader2, Undo } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { supabase } from "@/lib/supabase"
import { getCurrentLocalDate } from "@/lib/timezone"

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
}

interface Template {
  id?: number
  buildingid: number
  coverpage_elements: CoverPageElement[]
  infocard_fields: TemplateField[]
  coverpage_color: string
  infocard_accent_color: string
  agenda_items_color: string
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
  { id: "title", label: "MEETING AGENDA", enabled: true, x: 50, y: 40, align: 'center' },
  { id: "building_name", label: "Building Name", enabled: true, x: 50, y: 60, align: 'center' },
  { id: "meeting_type", label: "Meeting Type", enabled: true, x: 50, y: 70, align: 'center' },
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
  const [saving, setSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const [loadingTemplate, setLoadingTemplate] = useState(false)
  const [templateId, setTemplateId] = useState<number | null>(null)

  // Undo history
  const [history, setHistory] = useState<TemplateState[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)

  // Free drag state
  const [draggingElementId, setDraggingElementId] = useState<string | null>(null)
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
    }

    setHistory(prev => {
      const newHistory = prev.slice(0, historyIndex + 1)
      newHistory.push(currentState)
      return newHistory.slice(-20)
    })
    setHistoryIndex(prev => Math.min(prev + 1, 19))
  }, [coverPageElements, infoCardFields, coverPageColor, infoCardAccentColor, agendaItemsColor, historyIndex])

  // Undo function
  const handleUndo = () => {
    if (historyIndex > 0) {
      const prevState = history[historyIndex - 1]
      setCoverPageElements(prevState.coverPageElements)
      setInfoCardFields(prevState.infoCardFields)
      setCoverPageColor(prevState.coverPageColor)
      setInfoCardAccentColor(prevState.infoCardAccentColor)
      setAgendaItemsColor(prevState.agendaItemsColor)
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
    }
  }, [selectedBuildingId])

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
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          setCoverPageElements(DEFAULT_COVERPAGE_ELEMENTS)
          setInfoCardFields(DEFAULT_INFOCARD_FIELDS)
          setCoverPageColor("#1e3a8a")
          setInfoCardAccentColor("#2563eb")
          setAgendaItemsColor("#2563eb")
          setTemplateId(null)
        }
      } else if (data) {
        setTemplateId(data.id)
        setCoverPageColor(data.coverpage_color || "#1e3a8a")
        setInfoCardAccentColor(data.infocard_accent_color || "#2563eb")
        setAgendaItemsColor(data.agenda_items_color || "#2563eb")
        setCoverPageElements((data.coverpage_elements as unknown as CoverPageElement[]) || DEFAULT_COVERPAGE_ELEMENTS)
        setInfoCardFields((data.infocard_fields as unknown as TemplateField[]) || DEFAULT_INFOCARD_FIELDS)
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
        coverpage_elements: coverPageElements,
        infocard_fields: infoCardFields,
        coverpage_color: coverPageColor,
        infocard_accent_color: infoCardAccentColor,
        agenda_items_color: agendaItemsColor,
        coverpage_height: COVER_PAGE_HEIGHT // ✅ Always saves 175
      }

      if (templateId) {
        const { error } = await supabase
          .from('agendatemplates')
          .update({
            ...templateData,
            coverpage_elements: coverPageElements as any,
            infocard_fields: infoCardFields as any,
            updatedat: new Date().toISOString()
          })
          .eq('id', templateId)

        if (error) throw error
      } else {
        const { data, error } = await supabase
          .from('agendatemplates')
          .insert({
            ...templateData,
            coverpage_elements: coverPageElements as any,
            infocard_fields: infoCardFields as any
          })
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
                  </Card>

                  <Card className="p-4">
                    <h3 className="text-sm font-semibold mb-3">Agenda Items</h3>
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
                      className="w-full px-2 py-1 border rounded text-sm"
                    />
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
                            onMouseDown={(e) => handleCoverMouseDown(e, element.id)}
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
                                <div className="text-center" style={{ width: '600px' }}>
                                  <div style={{
                                    fontWeight: 800,
                                    letterSpacing: '3px',
                                    fontSize: '48px',
                                    lineHeight: '1.1',
                                    textTransform: 'uppercase',
                                    textShadow: '0 2px 4px rgba(0,0,0,0.3)'
                                  }}>MEETING</div>
                                  <div style={{
                                    fontWeight: 800,
                                    letterSpacing: '3px',
                                    fontSize: '48px',
                                    lineHeight: '1.1',
                                    textTransform: 'uppercase',
                                    textShadow: '0 2px 4px rgba(0,0,0,0.3)'
                                  }}>AGENDA</div>
                                </div>
                              )}

                              {element.id === 'building_name' && (
                                <div className="text-2xl font-light tracking-wide text-center max-w-[80%]" style={{ color: 'rgba(200, 220, 255, 0.95)' }}>
                                  {meeting?.buildings?.name}
                                </div>
                              )}

                              {element.id === 'meeting_type' && (
                                <div className="text-lg font-normal tracking-wide text-center max-w-[80%]" style={{ color: 'rgba(200, 220, 255, 0.9)' }}>
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
                            className="px-4 py-3 text-white font-bold text-sm"
                            style={{ backgroundColor: infoCardAccentColor }}
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
                          className="px-4 py-3 text-white font-bold text-xl mb-6 rounded"
                          style={{ backgroundColor: agendaItemsColor }}
                        >
                          AGENDA ITEMS
                        </div>

                        {sections.map((section, sectionIdx) => {
                          const sectionTopics = (topicsBySection[section.id] || []).sort((a, b) => a.order_index - b.order_index)

                          return (
                            <div key={section.id} className="mb-6">
                              <div
                                className="p-3 rounded-lg mb-3 flex items-center gap-3"
                                style={{ backgroundColor: getLighterColor(agendaItemsColor) }}
                              >
                                <div
                                  className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm"
                                  style={{ backgroundColor: agendaItemsColor }}
                                >
                                  {sectionIdx + 1}
                                </div>
                                <span className="font-bold text-white uppercase">{section.title}</span>
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
