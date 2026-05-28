"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { GripVertical, Save, FileText, Loader2, Undo, Home } from "lucide-react"
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
  building_type?: string
  created_at: string;
  logo_url?: string | null;
  companies?: { logo_url: string | null } | null;
}

interface MinutesTemplatesTabProps {
  buildings: Building[]
  loading: boolean
}

interface CoverPageElement {
  id: string
  label: string
  enabled: boolean
  x: number
  y: number
  align: "left" | "center" | "right"
}

interface TemplateField {
  id: string
  label: string
  order: number
  enabled: boolean
  showFullList?: boolean
}

interface TemplateState {
  coverPageElements: CoverPageElement[]
  infoCardFields: TemplateField[]
  coverPageColor: string
  infoCardAccentColor: string
  sectionHeadersColor: string
  motionBoxesColor: string
  actionItemsColor: string
  voteResultsColor: string
  coverPageHeight: number
}

interface Template {
  id?: number
  building_id: number
  coverpage_elements: CoverPageElement[]
  infocard_fields: TemplateField[]
  coverpage_color: string
  infocard_accent_color: string
  section_headers_color: string
  motion_boxes_color: string
  action_items_color: string
  vote_results_color: string
  coverpage_height: number
}

interface Meeting {
  id: number
  title: string
  meeting_date: string
  start_time: string | null
  end_time: string | null
  location: string | null
  meeting_type: string | null
  chair_person: string | null
  minute_taker: string | null
  attendees: any[] | null
  status: string
  buildings: {
    id: number
    name: string
    address: string | null
    logo_url: string | null
    company_id: number | null
    companies: {
      logo_url: string | null
    } | null
  }
}

interface Attendee {
  name: string
  email?: string | null
  role?: string | null
  present?: boolean
  attendance_status?: "present" | "absent" | "proxy"
}

const DEFAULT_COVERPAGE_ELEMENTS: CoverPageElement[] = [
  {
    id: "logo",
    label: "Building / Company Logo",
    enabled: true,
    x: 10,
    y: 15,
    align: "left",
  },
  {
    id: "title",
    label: "MEETING MINUTES",
    enabled: true,
    x: 50,
    y: 40,
    align: "center",
  },
  {
    id: "building_name",
    label: "Building Name",
    enabled: true,
    x: 50,
    y: 60,
    align: "center",
  },
  {
    id: "meeting_type",
    label: "Meeting Type",
    enabled: true,
    x: 50,
    y: 70,
    align: "center",
  },
]

const DEFAULT_INFOCARD_FIELDS: TemplateField[] = [
  { id: "date", label: "Meeting Date", order: 1, enabled: true },
  { id: "start_time", label: "Start Time", order: 2, enabled: true },
  { id: "end_time", label: "End Time", order: 3, enabled: true },
  { id: "location", label: "Location", order: 4, enabled: true },
  {
    id: "attendees",
    label: "Attendees",
    order: 5,
    enabled: true,
    showFullList: false,
  },
  { id: "chair_person", label: "Chair Person", order: 6, enabled: true },
  { id: "minute_taker", label: "Minute Taker", order: 7, enabled: true },
]

const SAMPLE_MEETING: Meeting = {
  id: 0,
  title: "Sample Annual General Meeting",
  meeting_date: new Date().toISOString(),
  start_time: "7:00 PM",
  end_time: "9:00 PM",
  location: "Main Clubhouse / Zoom",
  meeting_type: "AGM",
  chair_person: "Jane Smith (Council President)",
  minute_taker: "John Doe (Property Manager)",
  status: "minutes",
  attendees: [
    { name: "John Doe", role: "Property Manager", attendance_status: "present" },
    { name: "Jane Smith", role: "Council President", attendance_status: "present" },
    { name: "Robert Brown", role: "Owner", attendance_status: "absent" },
    { name: "Linda White", role: "Owner", attendance_status: "proxy" },
  ],
  buildings: {
    id: 0,
    name: "Sample Building Name",
    address: "123 Sample Street, Vancouver, BC",
    logo_url: null,
    company_id: null,
    companies: null
  }
}

const SAMPLE_SECTIONS = [
  { id: 1, title: "Call to Order", order_index: 1 },
  { id: 2, title: "Approval of Previous Minutes", order_index: 2 },
  { id: 3, title: "Financial Report", order_index: 3 },
]

const SAMPLE_TOPICS = [
  { id: 1, section_id: 1, title: "Meeting Commencement", order_index: 1 },
  { id: 2, section_id: 2, title: "Review of Minutes from Oct 2025", order_index: 1 },
  { id: 3, section_id: 3, title: "2026 Budget Approval", order_index: 1 },
]

const SAMPLE_DECISIONS = [
  { id: 1, topic_id: 3, title: "Budget approved with 95% majority", recorded_at: new Date().toISOString() }
]

const SAMPLE_TASKS = [
  { id: 1, topic_id: 3, title: "Update monthly strata fees", created_at: new Date().toISOString() }
]

export default function MinutesTemplatesTab({
  buildings,
  loading,
}: MinutesTemplatesTabProps) {
  const [selectedBuildingId, setSelectedBuildingId] = useState<number | null>(
    null
  )

  const [coverPageElements, setCoverPageElements] =
    useState<CoverPageElement[]>(DEFAULT_COVERPAGE_ELEMENTS)
  const [infoCardFields, setInfoCardFields] =
    useState<TemplateField[]>(DEFAULT_INFOCARD_FIELDS)
  const [coverPageColor, setCoverPageColor] = useState("#1e3a8a")
  const [infoCardAccentColor, setInfoCardAccentColor] = useState("#2563eb")
  const [sectionHeadersColor, setSectionHeadersColor] = useState("#2563eb")
  const [motionBoxesColor, setMotionBoxesColor] = useState("#10b981")
  const [actionItemsColor, setActionItemsColor] = useState("#f59e0b")
  const [voteResultsColor, setVoteResultsColor] = useState("#8b5cf6")
  const [coverPageHeight, setCoverPageHeight] = useState(175)

  const [saving, setSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const [loadingTemplate, setLoadingTemplate] = useState(false)
  const [templateId, setTemplateId] = useState<number | null>(null)

  const [history, setHistory] = useState<TemplateState[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)

  const [draggingElementId, setDraggingElementId] = useState<string | null>(
    null
  )
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const coverPageRef = useRef<HTMLDivElement>(null)

  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)

  const [meeting, setMeeting] = useState<Meeting | null>(null)
  const [attendees, setAttendees] = useState<Attendee[]>([])
  const [loadingMeeting, setLoadingMeeting] = useState(false)
  const [companyLogoUrl, setCompanyLogoUrl] = useState<string | null>(null)

  const [sectionsData, setSectionsData] = useState<any[]>([])
  const [topicsData, setTopicsData] = useState<any[]>([])
  const [decisionsData, setDecisionsData] = useState<any[]>([])
  const [tasksData, setTasksData] = useState<any[]>([])
  const [notesData, setNotesData] = useState<any[]>([])

  useEffect(() => {
    if (buildings.length > 0 && !selectedBuildingId) {
      setSelectedBuildingId(buildings[0].id)
    }
  }, [buildings, selectedBuildingId])

  const saveToHistory = useCallback(() => {
    const currentState: TemplateState = {
      coverPageElements: [...coverPageElements],
      infoCardFields: [...infoCardFields],
      coverPageColor,
      infoCardAccentColor,
      sectionHeadersColor,
      motionBoxesColor,
      actionItemsColor,
      voteResultsColor,
      coverPageHeight,
    }

    setHistory((prev) => {
      const newHistory = prev.slice(0, historyIndex + 1)
      newHistory.push(currentState)
      return newHistory.slice(-20)
    })
    setHistoryIndex((prev) => Math.min(prev + 1, 19))
  }, [
    coverPageElements,
    infoCardFields,
    coverPageColor,
    infoCardAccentColor,
    sectionHeadersColor,
    motionBoxesColor,
    actionItemsColor,
    voteResultsColor,
    coverPageHeight,
    historyIndex,
  ])

  const handleUndo = () => {
    if (historyIndex > 0) {
      const prevState = history[historyIndex - 1]
      setCoverPageElements(prevState.coverPageElements)
      setInfoCardFields(prevState.infoCardFields)
      setCoverPageColor(prevState.coverPageColor)
      setInfoCardAccentColor(prevState.infoCardAccentColor)
      setSectionHeadersColor(prevState.sectionHeadersColor)
      setMotionBoxesColor(prevState.motionBoxesColor)
      setActionItemsColor(prevState.actionItemsColor)
      setVoteResultsColor(prevState.voteResultsColor)
      setCoverPageHeight(prevState.coverPageHeight)
      setHistoryIndex((prev) => prev - 1)
      setHasChanges(true)
    }
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        e.preventDefault()
        handleUndo()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [historyIndex, history])

  useEffect(() => {
    if (!selectedBuildingId) return
    loadTemplate(selectedBuildingId)
    loadMostRecentMeeting(selectedBuildingId)
  }, [selectedBuildingId])

  const loadMostRecentMeeting = async (buildingId: number) => {
    setLoadingMeeting(true)
    try {
      // Fetch company logo directly — reliable regardless of meeting state
      const building = buildings.find(b => b.id === buildingId)
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

      let { data: meetingData, error } = await supabase
        .from("meetings")
        .select(
          `
          *,
          buildings(
            id,
            name,
            address,
            logo_url,
            company_id,
            companies(
              logo_url
            )
          )
        `
        )
        .eq("building_id", buildingId)
        .in("status", ["minutes", "working_minutes"])
        .order("meeting_date", { ascending: false })
        .limit(1)
        .maybeSingle()

      if ((error && (error as any).code === "PGRST116") || !meetingData) {
        const fallback = await supabase
          .from("meetings")
          .select(
            `
            *,
            buildings(
              id,
              name,
              address,
              logo_url,
              company_id,
              companies(
                logo_url
              )
            )
          `
          )
          .eq("building_id", buildingId)
          .order("meeting_date", { ascending: false })
          .limit(1)
          .maybeSingle()

        meetingData = fallback.data as any
        error = fallback.error
      }

      if (error || !meetingData) {
        // Fallback to company defaults if no meetings exist
        const building = buildings.find(b => b.id === buildingId)
        
        let defaultSections: any[] = []
        if (building?.company_id) {
          const { data: company } = await supabase
            .from("companies")
            .select("default_meeting_sections, name")
            .eq("id", building.company_id)
            .single()
          
          if (company?.default_meeting_sections) {
            defaultSections = company.default_meeting_sections.map((title: string, idx: number) => ({
              id: -(idx + 1), // Use negative IDs for transient preview sections
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
            id: buildingId,
            name: building?.name || "Select a Building",
            address: building?.address || "",
            logo_url: building?.logo_url || null,
            company_id: building?.company_id || null,
            companies: (building as any)?.companies || null
          }
        }

        setMeeting(customSample)
        setAttendees([])
        setSectionsData(defaultSections)
        setTopicsData([])
        setDecisionsData([])
        setTasksData([])
        setNotesData([])
        return
      }

      setMeeting(meetingData as any)
      setAttendees((meetingData.attendees as unknown as Attendee[]) || [])
      await loadMinutesContent(meetingData.id)
    } catch (err) {
      console.error("Error loading meeting", err)
      setMeeting(SAMPLE_MEETING)
      setAttendees(SAMPLE_MEETING.attendees as Attendee[])
      setSectionsData(SAMPLE_SECTIONS)
      setTopicsData(SAMPLE_TOPICS)
      setDecisionsData(SAMPLE_DECISIONS)
      setTasksData(SAMPLE_TASKS)
    } finally {
      setLoadingMeeting(false)
    }
  }

  const loadMinutesContent = async (meetingId: number) => {
    try {
      const { data: sections, error: sectionsError } = await supabase
        .from("sections")
        .select("*")
        .eq("meeting_id", meetingId)
        .order("order_index")

      if (sectionsError) throw sectionsError

      const { data: topics, error: topicsError } = await supabase
        .from("topics")
        .select("*")
        .eq("meeting_id", meetingId)
        .order("order_index")

      if (topicsError) throw topicsError

      const topicIds = (topics || []).map((t: any) => t.id)

      let decisions: any[] = []
      let tasks: any[] = []

      if (topicIds.length > 0) {
        const { data: decisionsData, error: decisionsError } = await supabase
          .from("decisions")
          .select("*")
          .in("topic_id", topicIds)
          .order("recorded_at")

        if (decisionsError) throw decisionsError

        const { data: tasksDataFromDb, error: tasksError } = await supabase
          .from("tasks")
          .select("*")
          .in("topic_id", topicIds)
          .order("created_at")

        if (tasksError) throw tasksError

        const { data: notesDataFromDb, error: notesError } = await supabase
          .from("notes")
          .select("*")
          .in("topic_id", topicIds)
          .eq("visibility", "public")
          .order("created_at")

        if (notesError) throw notesError

        decisions = decisionsData || []
        tasks = tasksDataFromDb || []
        const notes = notesDataFromDb || []
        setNotesData(notes)
      } else {
        setNotesData([])
      }

      setSectionsData(sections || [])
      setTopicsData(topics || [])
      setDecisionsData(decisions)
      setTasksData(tasks)
    } catch (err) {
      console.error("Error loading minutes content", err)
      setSectionsData([])
      setTopicsData([])
      setDecisionsData([])
      setTasksData([])
    }
  }

  const loadTemplate = async (buildingId: number) => {
    setLoadingTemplate(true)
    try {
      const { data, error } = await supabase
        .from("minutes_templates")
        .select("*")
        .eq("building_id", buildingId)
        .maybeSingle()

      if (error && (error as any).code !== "PGRST116") {
        console.error("Error loading template", error)
      }

      if (!data) {
        setCoverPageElements(DEFAULT_COVERPAGE_ELEMENTS)
        setInfoCardFields(DEFAULT_INFOCARD_FIELDS)
        setCoverPageColor("#1e3a8a")
        setInfoCardAccentColor("#2563eb")
        setSectionHeadersColor("#2563eb")
        setMotionBoxesColor("#10b981")
        setActionItemsColor("#f59e0b")
        setVoteResultsColor("#8b5cf6")
        setCoverPageHeight(175)
        setTemplateId(null)
        setHasChanges(false)
        saveToHistory()
        return
      }

      setTemplateId(data.id)
      setCoverPageColor(data.coverpage_color || "#1e3a8a")
      setInfoCardAccentColor(data.infocard_accent_color || "#2563eb")
      setSectionHeadersColor(data.section_headers_color || "#2563eb")
      setMotionBoxesColor(data.motion_boxes_color || "#10b981")
      setActionItemsColor(data.action_items_color || "#f59e0b")
      setVoteResultsColor(data.vote_results_color || "#8b5cf6")
      setCoverPageHeight(175)
      setCoverPageElements((data.coverpage_elements as unknown as CoverPageElement[]) || DEFAULT_COVERPAGE_ELEMENTS)
      setInfoCardFields((data.infocard_fields as unknown as TemplateField[]) || DEFAULT_INFOCARD_FIELDS)
      setHasChanges(false)
      saveToHistory()
    } catch (err) {
      console.error("Error loading template", err)
    } finally {
      setLoadingTemplate(false)
    }
  }

  const handleCoverMouseDown = (
    e: React.MouseEvent,
    elementId: string
  ): void => {
    saveToHistory()
    const element = coverPageElements.find((el) => el.id === elementId)
    if (!element || !coverPageRef.current) return

    const rect = coverPageRef.current.getBoundingClientRect()
    const elementX = (element.x / 100) * rect.width
    const elementY = (element.y / 100) * rect.height

    setDraggingElementId(elementId)
    setDragOffset({ x: e.clientX - elementX, y: e.clientY - elementY })
  }

  const handleCoverMouseMove = (e: React.MouseEvent): void => {
    if (!draggingElementId || !coverPageRef.current) return

    const rect = coverPageRef.current.getBoundingClientRect()
    const newX = ((e.clientX - dragOffset.x) / rect.width) * 100
    const newY = ((e.clientY - dragOffset.y) / rect.height) * 100

    const clampedX = Math.max(0, Math.min(100, newX))
    const clampedY = Math.max(0, Math.min(100, newY))

    setCoverPageElements((prev) =>
      prev.map((el) =>
        el.id === draggingElementId ? { ...el, x: clampedX, y: clampedY } : el
      )
    )
    setHasChanges(true)
  }

  const handleCoverMouseUp = (): void => {
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
    fields.forEach((field, i) => (field.order = i + 1))

    setInfoCardFields(fields)
    setDraggedIndex(index)
    setHasChanges(true)
  }

  const handleInfoDragEnd = () => {
    setDraggedIndex(null)
  }

  const toggleAttendeesDisplay = (fieldId: string) => {
    saveToHistory()
    setInfoCardFields((prev) =>
      prev.map((f) =>
        f.id === fieldId ? { ...f, showFullList: !f.showFullList } : f
      )
    )
    setHasChanges(true)
  }

  const handleSave = async () => {
    if (!selectedBuildingId) {
      alert("Please select a building first.")
      return
    }

    setSaving(true)
    try {
      const templateData: Partial<Template> = {
        building_id: selectedBuildingId,
        coverpage_elements: coverPageElements,
        infocard_fields: infoCardFields,
        coverpage_color: coverPageColor,
        infocard_accent_color: infoCardAccentColor,
        section_headers_color: sectionHeadersColor,
        motion_boxes_color: motionBoxesColor,
        action_items_color: actionItemsColor,
        vote_results_color: voteResultsColor,
        coverpage_height: coverPageHeight,
      }

      if (templateId) {
        const { error } = await supabase
          .from("minutes_templates")
          .update({
            ...templateData,
            coverpage_elements: coverPageElements as any,
            infocard_fields: infoCardFields as any,
            updated_at: new Date().toISOString(),
          })
          .eq("id", templateId)

        if (error) throw error
      } else {
        const { data, error } = await supabase
          .from("minutes_templates")
          .insert({
            ...templateData,
            coverpage_elements: coverPageElements as any,
            infocard_fields: infoCardFields as any
          } as any)
          .select()
          .single()

        if (error) throw error
        if (data) setTemplateId(data.id)
      }

      setHasChanges(false)
      alert(
        "Minutes template saved. Minutes for this building will use this design."
      )
    } catch (err) {
      console.error("Error saving template", err)
      alert("Failed to save template.")
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
      day: "numeric",
    })
  }

  const getAttendeesCount = () => {
    const present = attendees.filter(
      (a) => a.attendance_status === "present" || a.present === true
    ).length
    const absent = attendees.filter(
      (a) => a.attendance_status === "absent" || a.present === false
    ).length
    const proxy = attendees.filter(
      (a) => a.attendance_status === "proxy"
    ).length
    return { present, absent, proxy }
  }

  const hexToRgb = (hex: string): [number, number, number] => {
    const result =
      /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    return result
      ? [
        parseInt(result[1], 16),
        parseInt(result[2], 16),
        parseInt(result[3], 16),
      ]
      : [30, 58, 138]
  }

  const getLighterColor = (hex: string, amount: number = 80) => {
    const [r, g, b] = hexToRgb(hex)
    return `rgb(${Math.min(255, r + amount)}, ${Math.min(
      255,
      g + amount
    )}, ${Math.min(255, b + amount)})`
  }

  const attendeesCounts = getAttendeesCount()

  if (loading) {
    return (
      <div className="text-center py-12">
        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-primary" />
        <p className="text-muted-foreground">Loading buildings...</p>
      </div>
    )
  }

  if (!loading && buildings.length === 0) {
    return (
      <div className="text-center py-12 border-2 border-dashed border-border rounded-lg">
        <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
        <p className="text-muted-foreground mb-2">No buildings available</p>
        <p className="text-sm text-muted-foreground">
          Create a building first to manage its minutes template.
        </p>
      </div>
    )
  }

  return (
    <div className="mb-6">
      <h2 className="text-2xl font-bold text-foreground mb-1">
        Minutes Templates
      </h2>
      <p className="text-muted-foreground mb-4">
        Building-specific template: choose a building, then design its minutes
        layout. The preview below uses the latest meeting’s minutes for that
        building.
      </p>

      <div className="mb-4">
        <Card className="p-4 mb-6">
          <div className="flex items-center gap-4">
            <Home className="h-5 w-5 text-primary" />
            <span className="text-sm font-semibold">Select Building</span>
            <select
              value={selectedBuildingId ?? ""}
              onChange={(e) =>
                setSelectedBuildingId(
                  e.target.value ? Number(e.target.value) : null
                )
              }
              className="flex-1 px-3 py-2 bg-background border border-border rounded focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              {buildings.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>

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

        <Card className="p-4 mb-6">
          {loadingTemplate || loadingMeeting ? (
            <div className="text-center py-12">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-primary" />
              <p className="text-muted-foreground">
                Loading template preview...
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-12 gap-6 mb-6">
              {/* Left controls */}
              <div className="col-span-12 lg:col-span-3 space-y-4">
                <div className="flex items-center justify-between mb-2">
                   <h3 className="text-sm font-bold text-primary flex items-center gap-2">
                     <Save className="h-4 w-4" /> Template Editor
                   </h3>
                   {meeting?.id === 0 && (
                     <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-black uppercase tracking-wider">Default Template</span>
                   )}
                </div>


                <Card className="p-4">
                  <h3 className="text-sm font-semibold mb-3">
                    Cover Background
                  </h3>
                  <input
                    type="color"
                    value={coverPageColor}
                    onChange={(e) => {
                      saveToHistory()
                      setCoverPageColor(e.target.value)
                      setHasChanges(true)
                    }}
                    className="w-full h-16 rounded border cursor-pointer mb-2"
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
                  <h3 className="text-sm font-semibold mb-3">
                    Info Card Accent
                  </h3>
                  <input
                    type="color"
                    value={infoCardAccentColor}
                    onChange={(e) => {
                      saveToHistory()
                      setInfoCardAccentColor(e.target.value)
                      setHasChanges(true)
                    }}
                    className="w-full h-16 rounded border cursor-pointer mb-2"
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
                  <h3 className="text-sm font-semibold mb-3">
                    Section Headers
                  </h3>
                  <input
                    type="color"
                    value={sectionHeadersColor}
                    onChange={(e) => {
                      saveToHistory()
                      setSectionHeadersColor(e.target.value)
                      setHasChanges(true)
                    }}
                    className="w-full h-16 rounded border cursor-pointer mb-2"
                  />
                  <input
                    type="text"
                    value={sectionHeadersColor}
                    onChange={(e) => {
                      setSectionHeadersColor(e.target.value)
                      setHasChanges(true)
                    }}
                    className="w-full px-2 py-1 border rounded text-sm"
                  />
                </Card>

                <Card className="p-4">
                  <h3 className="text-sm font-semibold mb-3">
                    Motion Boxes
                  </h3>
                  <input
                    type="color"
                    value={motionBoxesColor}
                    onChange={(e) => {
                      saveToHistory()
                      setMotionBoxesColor(e.target.value)
                      setHasChanges(true)
                    }}
                    className="w-full h-16 rounded border cursor-pointer mb-2"
                  />
                  <input
                    type="text"
                    value={motionBoxesColor}
                    onChange={(e) => {
                      setMotionBoxesColor(e.target.value)
                      setHasChanges(true)
                    }}
                    className="w-full px-2 py-1 border rounded text-sm"
                  />
                </Card>

                <Card className="p-4">
                  <h3 className="text-sm font-semibold mb-3">
                    Vote Results
                  </h3>
                  <input
                    type="color"
                    value={voteResultsColor}
                    onChange={(e) => {
                      saveToHistory()
                      setVoteResultsColor(e.target.value)
                      setHasChanges(true)
                    }}
                    className="w-full h-16 rounded border cursor-pointer mb-2"
                  />
                  <input
                    type="text"
                    value={voteResultsColor}
                    onChange={(e) => {
                      setVoteResultsColor(e.target.value)
                      setHasChanges(true)
                    }}
                    className="w-full px-2 py-1 border rounded text-sm"
                  />
                </Card>
              </div>

              {/* Right live preview */}
              <div className="col-span-12 lg:col-span-9">
                <Card className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">
                      Live Minutes Preview
                    </h3>
                    <span className="text-xs bg-purple-100 text-purple-800 px-3 py-1 rounded-full font-semibold">
                      {meeting?.title}
                    </span>
                  </div>

                  <div className="border-4 border-gray-400 rounded-lg overflow-y-auto bg-white shadow-2xl max-h-[1000px]">
                    {/* Cover */}
                    <div
                      ref={coverPageRef}
                      className="relative text-white cursor-crosshair select-none"
                      style={{
                        backgroundColor: coverPageColor,
                        height: `${coverPageHeight}px`,
                        position: "relative",
                      }}
                      onMouseMove={handleCoverMouseMove}
                      onMouseUp={handleCoverMouseUp}
                      onMouseLeave={handleCoverMouseUp}
                    >
                      {coverPageElements
                        .filter((el) => el.enabled)
                        .map((element) => (
                          <div
                            key={element.id}
                            className={`absolute cursor-move transition-opacity ${draggingElementId === element.id
                              ? "opacity-70 scale-105"
                              : "hover:opacity-90"
                              }`}
                            style={{
                              left: `${element.x}%`,
                              top: `${element.y}%`,
                              transform:
                                element.align === "center"
                                  ? "translate(-50%, -50%)"
                                  : element.align === "right"
                                    ? "translate(-100%, -50%)"
                                    : "translate(0, -50%)",
                              zIndex:
                                draggingElementId === element.id ? 50 : 10,
                            }}
                            onMouseDown={(e) =>
                              handleCoverMouseDown(e, element.id)
                            }
                          >
                            <div className="relative group">
                              <GripVertical className="absolute -left-7 top-1/2 -translate-y-1/2 h-5 w-5 opacity-50 group-hover:opacity-100" />
                              {element.id === "logo" && (
                                <div
                                  className="bg-white rounded-full flex items-center justify-center shadow-lg"
                                  style={{ width: 80, height: 80 }}
                                >
                                  {meeting?.buildings?.logo_url ||
                                    meeting?.buildings?.companies?.logo_url ||
                                    companyLogoUrl ? (
                                    <img
                                      src={
                                        meeting?.buildings?.logo_url ||
                                        meeting?.buildings?.companies?.logo_url ||
                                        companyLogoUrl ||
                                        ""
                                      }
                                      alt="Logo"
                                      className="w-16 h-16 object-contain"
                                    />
                                  ) : (
                                    <span className="text-5xl">🏢</span>
                                  )}
                                </div>
                              )}

                              {element.id === "title" && (
                                <div className="text-center">
                                  <div className="text-5xl font-bold tracking-wider leading-tight">
                                    MEETING
                                  </div>
                                  <div className="text-5xl font-bold tracking-wider leading-tight">
                                    MINUTES
                                  </div>
                                </div>
                              )}

                              {element.id === "building_name" && (
                                <div
                                  className="text-2xl font-light tracking-wide text-center max-w-[80%]"
                                  style={{
                                    color: "rgba(200, 220, 255, 0.95)",
                                  }}
                                >
                                  {meeting?.buildings?.name}
                                </div>
                              )}

                              {element.id === "meeting_type" && (
                                <div
                                  className="text-lg font-normal tracking-wide text-center max-w-[80%]"
                                  style={{
                                    color: "rgba(200, 220, 255, 0.9)",
                                  }}
                                >
                                  {meeting?.meeting_type || "Council Meeting"}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                    </div>

                    {/* Info card */}
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
                            .filter((f) => f.enabled)
                            .sort((a, b) => a.order - b.order)
                            .map((field, index) => (
                              <div
                                key={field.id}
                                draggable
                                onDragStart={() => handleInfoDragStart(index)}
                                onDragOver={(e) =>
                                  handleInfoDragOver(e, index)
                                }
                                onDragEnd={handleInfoDragEnd}
                                className={`group cursor-move transition-all ${draggedIndex === index
                                  ? "scale-105 bg-blue-50 p-2 rounded"
                                  : "hover:bg-gray-50 p-2 rounded"
                                  } ${field.id === "attendees" ? "col-span-2" : ""
                                  }`}
                              >
                                <div className="flex items-start gap-2">
                                  <GripVertical className="h-4 w-4 text-gray-300 mt-0.5 opacity-0 group-hover:opacity-100" />
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                      <div className="text-[10px] font-bold text-gray-600 uppercase">
                                        {field.label}
                                      </div>
                                      {field.id === "attendees" && (
                                        <button
                                          onClick={() =>
                                            toggleAttendeesDisplay(field.id)
                                          }
                                          className="text-[9px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded hover:bg-blue-200"
                                        >
                                          {field.showFullList
                                            ? "Show Count"
                                            : "Show List"}
                                        </button>
                                      )}
                                    </div>
                                    <div className="text-xs text-gray-900 font-medium">
                                      {field.id === "date" &&
                                        meeting && formatMeetingDate(meeting.meeting_date)}
                                      {field.id === "start_time" &&
                                        (meeting?.start_time || "TBA")}
                                      {field.id === "end_time" &&
                                        (meeting?.end_time || "TBA")}
                                      {field.id === "location" &&
                                        (meeting?.location || "TBA")}
                                      {field.id === "chair_person" &&
                                        (meeting?.chair_person || "TBA")}
                                      {field.id === "minute_taker" &&
                                        (meeting?.minute_taker || "TBA")}
                                      {field.id === "attendees" &&
                                        (field.showFullList ? (
                                          <div className="space-y-1 mt-1">
                                            {attendees.length === 0 ? (
                                              <div>No attendees recorded</div>
                                            ) : (
                                              <>
                                                {attendees.filter(
                                                  (a) =>
                                                    a.attendance_status ===
                                                    "present" ||
                                                    a.present === true
                                                ).length > 0 && (
                                                    <div>
                                                      <span className="font-bold text-green-700">
                                                        Present:
                                                      </span>{" "}
                                                      {attendees
                                                        .filter(
                                                          (a) =>
                                                            a.attendance_status ===
                                                            "present" ||
                                                            a.present === true
                                                        )
                                                        .map((a) => a.name)
                                                        .join(", ")}
                                                    </div>
                                                  )}
                                                {attendees.filter(
                                                  (a) =>
                                                    a.attendance_status ===
                                                    "absent" ||
                                                    a.present === false
                                                ).length > 0 && (
                                                    <div>
                                                      <span className="font-bold text-red-700">
                                                        Absent:
                                                      </span>{" "}
                                                      {attendees
                                                        .filter(
                                                          (a) =>
                                                            a.attendance_status ===
                                                            "absent" ||
                                                            a.present === false
                                                        )
                                                        .map((a) => a.name)
                                                        .join(", ")}
                                                    </div>
                                                  )}
                                                {attendees.filter(
                                                  (a) =>
                                                    a.attendance_status ===
                                                    "proxy"
                                                ).length > 0 && (
                                                    <div>
                                                      <span className="font-bold text-blue-700">
                                                        Proxy:
                                                      </span>{" "}
                                                      {attendees
                                                        .filter(
                                                          (a) =>
                                                            a.attendance_status ===
                                                            "proxy"
                                                        )
                                                        .map((a) => a.name)
                                                        .join(", ")}
                                                    </div>
                                                  )}
                                              </>
                                            )}
                                          </div>
                                        ) : (
                                          `${attendeesCounts.present} Present, ${attendeesCounts.absent} Absent, ${attendeesCounts.proxy} Proxy`
                                        ))}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                        </div>
                      </div>
                    </div>

                    {/* Attendees table (matches minutes PDF) */}
                    <div className="px-6 pb-6">
                      {attendees.length > 0 && (
                        <div className="rounded-lg overflow-hidden border shadow-sm">
                          <div
                            className="px-4 py-2 text-white text-xs font-bold tracking-wide"
                            style={{ backgroundColor: infoCardAccentColor }}
                          >
                            👥 ATTENDEES
                          </div>
                          <table className="w-full border-collapse bg-gray-50">
                            <thead>
                              <tr className="border-b border-gray-200">
                                <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase w-10">
                                  #
                                </th>
                                <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase">
                                  Name
                                </th>
                                <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase w-32">
                                  Role
                                </th>
                                <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase w-48">
                                  Email
                                </th>
                                <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase w-20">
                                  Status
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {attendees.map((a, idx) => {
                                const isPresent =
                                  a.present === true ||
                                  a.attendance_status === "present"
                                const statusClass = isPresent
                                  ? "bg-emerald-100 text-emerald-800"
                                  : "bg-rose-100 text-rose-800"
                                const statusText = isPresent
                                  ? "Present"
                                  : "Absent"
                                const role = a.role || "—"
                                const email = a.email || "—"

                                return (
                                  <tr
                                    key={idx}
                                    className="border-b border-gray-200 last:border-b-0 bg-white"
                                  >
                                    <td className="px-3 py-2 text-[11px] text-gray-700">
                                      {idx + 1}
                                    </td>
                                    <td className="px-3 py-2 text-[11px] text-gray-900">
                                      {a.name}
                                    </td>
                                    <td className="px-3 py-2 text-[11px] text-gray-700">
                                      {role}
                                    </td>
                                    <td className="px-3 py-2 text-[11px] text-gray-700">
                                      {email}
                                    </td>
                                    <td className="px-3 py-2 text-[11px]">
                                      <span
                                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold ${statusClass}`}
                                      >
                                        {statusText}
                                      </span>
                                    </td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>

                    {/* Sections / topics / decisions (no actions, no summary) */}
                    <div className="p-6 bg-white space-y-6">
                      {sectionsData.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground border-2 border-dashed border-border rounded-lg">
                          No sections/topics/decisions recorded for this
                          meeting.
                        </div>
                      ) : (
                        <>
                          {sectionsData.map((section, sIdx) => {
                            const sectionTopics = topicsData.filter(
                              (t: any) => t.section_id === section.id
                            )

                            return (
                              <div key={section.id} className="space-y-3">
                                <div
                                  className="px-4 py-3 text-white font-bold text-lg rounded"
                                  style={{
                                    backgroundColor: sectionHeadersColor,
                                  }}
                                >
                                  {sIdx + 1}. {section.title}
                                </div>

                                {sectionTopics.map(
                                  (topic: any, tIdx: number) => {
                                    const topicDecisions = decisionsData.filter(
                                      (d: any) => d.topic_id === topic.id
                                    )
                                    const isInCamera =
                                      topic.isincamera === true

                                    return (
                                      <div
                                        key={topic.id}
                                        className="mt-2 ml-4 space-y-3"
                                      >
                                        <h3 className="text-base font-bold text-gray-900">
                                          {sIdx + 1}.{tIdx + 1} {topic.title}
                                        </h3>

                                        {isInCamera ? (
                                          <div className="text-xs text-red-700 bg-red-50 border border-red-200 px-3 py-2 rounded">
                                            This topic is in-camera. Content is
                                            confidential.
                                          </div>
                                        ) : (
                                          <>
                                            {topic.description && (
                                              <p className="text-sm text-gray-600">
                                                {topic.description}
                                              </p>
                                            )}

                                            {/* Public Notes Inline */}
                                            {notesData
                                              .filter(
                                                (n: any) =>
                                                  n.topic_id === topic.id
                                              )
                                              .map((note: any) => (
                                                <div
                                                  key={note.id}
                                                  className="text-xs text-blue-800 bg-blue-50/50 border-l-2 border-blue-400 px-3 py-2 rounded flex items-start gap-2"
                                                >
                                                  <span className="mt-0.5">🌐</span>
                                                  <div>
                                                    <span className="font-bold">NOTE:</span> {note.content}
                                                  </div>
                                                </div>
                                              ))}

                                            {/* Action Items (Tasks) Inline */}
                                            {tasksData
                                              .filter(
                                                (t: any) =>
                                                  t.topic_id === topic.id
                                              )
                                              .map((task: any) => (
                                                <div
                                                  key={task.id}
                                                  className="text-xs text-amber-800 bg-amber-50/50 border-l-2 border-amber-400 px-3 py-2 rounded flex items-start gap-2"
                                                >
                                                  <span className="mt-0.5">✅</span>
                                                  <div>
                                                    <span className="font-bold">
                                                      TASK:
                                                    </span>{" "}
                                                    {task.description}
                                                    {(task.assigned_name ||
                                                      task.assigned_email) && (
                                                        <span className="ml-1 text-amber-600 italic">
                                                          -{" "}
                                                          {task.assigned_name ||
                                                            task.assigned_email}
                                                        </span>
                                                      )}
                                                    {task.due_date && (
                                                      <span className="ml-1 text-amber-600">
                                                        (Due: {task.due_date})
                                                      </span>
                                                    )}
                                                  </div>
                                                </div>
                                              ))}

                                            {/* Decisions / Motions inline with topic */}
                                            {topicDecisions.map(
                                              (decision: any, dIdx: number) => (
                                                <div
                                                  key={decision.id}
                                                  className="border-2 rounded-lg p-4"
                                                  style={{
                                                    borderColor:
                                                      motionBoxesColor,
                                                    backgroundColor:
                                                      getLighterColor(
                                                        motionBoxesColor,
                                                        230
                                                      ),
                                                  }}
                                                >
                                                  <div className="flex items-center gap-2 mb-2">
                                                    <div
                                                      className="px-3 py-1 rounded text-white font-bold text-xs"
                                                      style={{
                                                        backgroundColor:
                                                          motionBoxesColor,
                                                      }}
                                                    >
                                                      {`MOTION ${sIdx + 1}.${tIdx + 1}`}
                                                    </div>
                                                  </div>
                                                  <div className="text-sm font-semibold text-gray-800 mb-3">
                                                    {decision.motion_text}
                                                  </div>
                                                  {decision.result && (
                                                    <div
                                                      className="text-xs px-3 py-2 rounded mb-2 inline-block"
                                                      style={{
                                                        backgroundColor:
                                                          voteResultsColor,
                                                        color: "white",
                                                      }}
                                                    >
                                                      <strong>Decision:</strong>{" "}
                                                      {decision.result}
                                                    </div>
                                                  )}
                                                  {decision.votes_for !==
                                                    null && (
                                                      <div
                                                        className="flex items-center gap-4 text-xs p-3 rounded"
                                                        style={{
                                                          backgroundColor:
                                                            voteResultsColor,
                                                          color: "white",
                                                        }}
                                                      >
                                                        <div>
                                                          <span className="font-bold">
                                                            FOR:
                                                          </span>{" "}
                                                          {decision.votes_for ||
                                                            0}
                                                        </div>
                                                        <div>
                                                          <span className="font-bold">
                                                            AGAINST:
                                                          </span>{" "}
                                                          {decision.votes_against ||
                                                            0}
                                                        </div>
                                                        <div>
                                                          <span className="font-bold">
                                                            ABSTAIN:
                                                          </span>{" "}
                                                          {decision.votes_abstain ||
                                                            0}
                                                        </div>
                                                      </div>
                                                    )}
                                                </div>
                                              )
                                            )}
                                          </>
                                        )}
                                      </div>
                                    )
                                  }
                                )}
                              </div>
                            )
                          })}
                        </>
                      )}
                    </div>

                    {/* Summary note */}
                    <div className="mt-6 p-4 bg-gradient-to-r from-purple-50 to-blue-50 border-2 border-purple-300 rounded-lg">
                      <p className="text-sm font-semibold text-purple-900">
                        This preview uses the latest meeting for this building
                        and applies your template. Motions are shown inline
                        under each topic (Motion X.Y, Decision, Votes) just like
                        the minutes PDF; only the layout/colors change here.
                      </p>
                    </div>
                  </div>

                  <div className="flex justify-center mt-6">
                    <Button
                      onClick={handleSave}
                      disabled={saving || !hasChanges}
                      size="lg"
                      className="px-12 py-6 text-lg shadow-lg"
                    >
                      <Save className="h-5 w-5 mr-3" />
                      {saving
                        ? "Saving..."
                        : hasChanges
                          ? "Save Template"
                          : "No Changes"}
                    </Button>
                  </div>
                </Card>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
