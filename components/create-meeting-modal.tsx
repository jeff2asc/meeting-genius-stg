"use client"

import { useState, useEffect, useRef } from "react"
import { 
  X, 
  ChevronRight, 
  ChevronLeft, 
  Check, 
  Layout, 
  ListTodo, 
  Users, 
  StickyNote, 
  FileCheck, 
  Info,
  Calendar,
  Clock,
  MapPin,
  Building2,
  Hash,
  Globe
} from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { 
  supabase, 
  getPreviousMeetingOfSameType,
  getTopicsFromMeeting
} from "@/lib/supabase"
import { fetchVotingParametersAction } from "@/lib/api-actions"
import { apiClient } from "@/lib/api-client"
import { getCurrentLocalDate, getCurrentLocalTime } from "@/lib/timezone"

interface CreateMeetingModalProps {
  onClose: () => void
  onSuccess: () => void
  buildings: Array<{ id: number; name: string; company_id: number }>
  selectedBuildingName?: string
}

export default function CreateMeetingModal({ onClose, onSuccess, buildings }: CreateMeetingModalProps) {
  const [formData, setFormData] = useState({
    title: "",
    meetingDate: getCurrentLocalDate(),
    location: "",
    startTime: getCurrentLocalTime(),
    meetingType: "",
    strataPlanNumber: "",
    buildingId: buildings[0]?.id || 0,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [step, setStep] = useState(0) // 0: Details, 1: Rollover Selection
  const [meetingTypes, setMeetingTypes] = useState<string[]>([])
  const [meetingSections, setMeetingSections] = useState<string[]>([])
  // Ref mirrors meetingSections so createMeeting always reads the latest value
  // even if called before the async fetchCompanyDefaults effect resolves.
  const meetingSectionsRef = useRef<string[]>([])
  
  // Rollover Preview Data
  const [prevMeeting, setPrevMeeting] = useState<any>(null)
  const [prevSections, setPrevSections] = useState<any[]>([])
  const [prevTopics, setPrevTopics] = useState<any[]>([])
  const [prevAttendees, setPrevAttendees] = useState<any[]>([])
  const [loadingPrev, setLoadingPrev] = useState(false)

  // Explicit Selections
  const [selectedTopicIds, setSelectedTopicIds] = useState<number[]>([])
  const [selectedTaskIds, setSelectedTaskIds] = useState<number[]>([])
  const [selectedNoteIds, setSelectedNoteIds] = useState<number[]>([])
  const [selectedDecisionIds, setSelectedDecisionIds] = useState<number[]>([])
  const [selectedAttendeeIds, setSelectedAttendeeIds] = useState<any[]>([])

  // Collapsed state for topics in selection view
  const [expandedTopics, setExpandedTopics] = useState<number[]>([])
  
  // Storage for all items to display in selection
  const [prevTasks, setPrevTasks] = useState<any[]>([])
  const [prevNotes, setPrevNotes] = useState<any[]>([])
  const [prevDecisions, setPrevDecisions] = useState<any[]>([])

  useEffect(() => {
    async function fetchCompanyDefaults() {
      const selectedBuilding = buildings.find(b => b.id === formData.buildingId)

      // Single source of truth: voting_parameters for meeting types
      const votingParams = await fetchVotingParametersAction(selectedBuilding?.company_id)
      const meetingTypesFromVoting = votingParams
        .filter((p: any) => p.parameter_type === 'meeting_type')
        .map((p: any) => p.value)

      const fallbackTypes = ["Council Meeting", "AGM", "SGM", "Special Meeting", "Emergency Meeting"]
      const finalMeetingTypes = meetingTypesFromVoting.length > 0 ? meetingTypesFromVoting : fallbackTypes

      if (!selectedBuilding || !selectedBuilding.company_id) {
        const defaultSections = ["Call to Order", "Approval of Agenda", "Old Business / Business Arising", "New Business", "Financial Report", "Maintenance & Operations", "Correspondence", "Council Roundtable", "Adjournment"]
        setMeetingTypes(finalMeetingTypes)
        setMeetingSections(defaultSections)
        meetingSectionsRef.current = defaultSections
        setFormData(f => ({ ...f, meetingType: finalMeetingTypes[0] || "Council Meeting" }))
        return
      }

      // Only fetch meeting sections from the company record (sections are still company-specific)
      const { data: company } = await supabase
        .from("companies")
        .select("default_meeting_sections")
        .eq("id", selectedBuilding.company_id)
        .single()

      const resolvedSections = company?.default_meeting_sections || ["Call to Order", "Approval of Agenda", "Old Business / Business Arising", "New Business", "Financial Report", "Maintenance & Operations", "Correspondence", "Council Roundtable", "Adjournment"]
      setMeetingTypes(finalMeetingTypes)
      setMeetingSections(resolvedSections)
      meetingSectionsRef.current = resolvedSections
      setFormData(f => ({ ...f, meetingType: finalMeetingTypes[0] || "Council Meeting" }))
    }

    fetchCompanyDefaults()
  }, [formData.buildingId, buildings])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: name === "buildingId" ? parseInt(value) : value,
    }))
  }

  const handleNext = async () => {
    if (!formData.title || !formData.meetingDate || !formData.meetingType) {
      setError("Please fill in all required fields")
      return
    }

    setLoadingPrev(true)
    setError("")
    try {
      const previous = await getPreviousMeetingOfSameType(formData.buildingId, formData.meetingType)
      
      if (previous) {
        setPrevMeeting(previous)
        const topics = await getTopicsFromMeeting(previous.id)
        setPrevTopics(topics || [])
        setSelectedTopicIds([])

        const [tasksRes, notesRes, decisionsRes, sectionsRes] = await Promise.all([
          supabase.from('tasks').select('*').in('topic_id', (topics || []).map(t => t.id)),
          supabase.from('notes').select('*').in('topic_id', (topics || []).map(t => t.id)),
          supabase.from('decisions').select('*').in('topic_id', (topics || []).map(t => t.id)),
          supabase.from('sections').select('*').eq('meeting_id', previous.id).order('order_index')
        ])
        
        setPrevTasks(tasksRes.data || [])
        setPrevNotes(notesRes.data || [])
        setPrevDecisions(decisionsRes.data || [])
        setPrevAttendees((previous.attendees as any[]) || [])
        setPrevSections(sectionsRes.data || [])

        // Default selections (Attendees and New Business items selected by default)
        const newBusinessSection = sectionsRes.data?.find((s: any) => s.title === "New Business")
        const newBusinessTopics = newBusinessSection 
          ? (topics || []).filter((t: any) => t.section_id === newBusinessSection.id)
          : []
        const newBusinessTopicIds = newBusinessTopics.map((t: any) => t.id)

        setSelectedTopicIds(newBusinessTopicIds)
        setSelectedTaskIds((tasksRes.data || []).filter((t: any) => newBusinessTopicIds.includes(t.topic_id)).map((t: any) => t.id))
        setSelectedNoteIds((notesRes.data || []).filter((n: any) => newBusinessTopicIds.includes(n.topic_id)).map((n: any) => n.id))
        setSelectedDecisionIds((decisionsRes.data || []).filter((d: any) => newBusinessTopicIds.includes(d.topic_id)).map((d: any) => d.id))
        
        // For attendees, use name fallback string as an identifier since some might be custom guests
        setSelectedAttendeeIds(((previous.attendees as any[]) || []).map((a: any) => a.user_id?.toString() || a.name || a.email))

        // Pre-expand topics that have tasks, notes, or decisions
        const topicsWithItems = (topics || []).filter(t => 
           (tasksRes.data || []).some(task => task.topic_id === t.id) ||
           (notesRes.data || []).some(note => note.topic_id === t.id) ||
           (decisionsRes.data || []).some(dec => dec.topic_id === t.id)
        ).map(t => t.id)
        setExpandedTopics(topicsWithItems)
        
        setStep(1)
      } else {
        await createMeeting(false)
      }
    } catch (err) {
      console.error("Error fetching rollover data:", err)
      setError("Could not fetch previous meeting data")
    } finally {
      setLoadingPrev(false)
    }
  }

  // Auto-populate attendees from company users with user_type/role 'attendee'.
  // Used by both the fresh-create and rollover paths.
  const autoPopulateAttendees = async (meetingId: number) => {
    const selectedBuilding = buildings.find(b => b.id === formData.buildingId)
    if (!selectedBuilding?.company_id) return

    const { data: users } = await supabase
      .from("users")
      .select("id, name, email, user_type, roles")
      .eq("company_id", selectedBuilding.company_id)

    if (!users) return

    const autoAttendees = users
      .filter(u => {
        const typeMatch = u.user_type?.toLowerCase() === 'attendee'
        const roleMatch = Array.isArray(u.roles) && u.roles.some((r: string) => r.toLowerCase().includes('attendee'))
        const stringRoleMatch = typeof u.roles === 'string' && (u.roles as string).toLowerCase().includes('attendee')
        return typeMatch || roleMatch || stringRoleMatch
      })
      .map(u => ({
        name: u.name,
        email: u.email,
        role: 'Attendee',
        user_id: u.id,
        present: false,
      }))

    if (autoAttendees.length > 0) {
      await supabase
        .from("meetings")
        .update({ attendees: autoAttendees })
        .eq("id", meetingId)
    }
  }

  const createMeeting = async (withRollover: boolean) => {
    setLoading(true)
    setError("")

    try {
      const { data: meetingData, error: insertError } = await supabase
        .from("meetings")
        .insert([
          {
            building_id: formData.buildingId,
            title: formData.title,
            meeting_date: formData.meetingDate,
            location: formData.location || null,
            start_time: formData.startTime || null,
            meeting_type: formData.meetingType,
            strata_plan_number: formData.strataPlanNumber || null,
            status: "working_agenda",
          },
        ])
        .select()
        .single()

      if (insertError) throw insertError

      if (withRollover && prevMeeting) {
        // Rollover: sections come from company defaults (see runExplicitRollover),
        // attendees come from the user's selection in step 2.
        await runExplicitRollover(meetingData.id)
      } else {
        // No previous meeting for this building + type → use company default sections.
        const fallbackSections = ["Call to Order", "Approval of Agenda", "Old Business / Business Arising", "New Business", "Financial Report", "Maintenance & Operations", "Correspondence", "Council Roundtable", "Adjournment"]
        const sectionsSource = meetingSectionsRef.current.length > 0 ? meetingSectionsRef.current : fallbackSections
        const sectionsToInsert = sectionsSource.map((title, index) => ({
          title,
          order_index: index + 1,
        }))
        await apiClient.v1.sections.create(meetingData.id, sectionsToInsert)

        // Auto-populate attendees from company users
        await autoPopulateAttendees(meetingData.id)
      }

      onSuccess()
      onClose()
    } catch (err: any) {
      console.error("Error creating meeting:", err)
      setError(err.message || "Failed to create meeting")
    } finally {
      setLoading(false)
    }
  }

  const runExplicitRollover = async (newMeetingId: number) => {
    if (!prevMeeting) return

    const adminSupabase = supabase
    const { data: oldSections } = await adminSupabase.from('sections').select('*').eq('meeting_id', prevMeeting.id).order('order_index')
    if (!oldSections) return

    // ── Use the company's default section arrangement (not the previous meeting's) ──
    const fallbackSections = ["Call to Order", "Approval of Agenda", "Old Business / Business Arising", "New Business", "Financial Report", "Maintenance & Operations", "Correspondence", "Council Roundtable", "Adjournment"]
    const companySections = meetingSectionsRef.current.length > 0 ? meetingSectionsRef.current : fallbackSections

    // Build a union: company defaults first (in order), then any extra sections from the
    // previous meeting that aren't already covered by the company defaults.
    const companyTitlesLower = companySections.map(s => s.toLowerCase())
    const extraOldSections = oldSections.filter(s => !companyTitlesLower.includes(s.title.toLowerCase()))
    const allNewSectionTitles = [...companySections, ...extraOldSections.map(s => s.title)]

    const sectionIdMap: Record<number, number> = {}
    const newSectionTitleMap: Record<string, number> = {}

    // Check if sections were already inserted (idempotency guard)
    const alreadyInserted = await apiClient.v1.sections.list(String(newMeetingId))
    if (alreadyInserted && alreadyInserted.length > 0) {
      // Sections exist — just build the maps from what's already there
      for (const sec of alreadyInserted) {
        newSectionTitleMap[sec.title.toLowerCase()] = sec.id
        for (const oldSec of oldSections) {
          if (oldSec.title.toLowerCase() === sec.title.toLowerCase()) {
            sectionIdMap[oldSec.id] = sec.id
          }
        }
      }
    } else {
      // Insert all sections in one batch call
      const sectionsPayload = allNewSectionTitles.map((title, i) => ({ title, order_index: i + 1 }))
      const inserted = await apiClient.v1.sections.create(newMeetingId, sectionsPayload)

      for (const newSec of (inserted || [])) {
        newSectionTitleMap[newSec.title.toLowerCase()] = newSec.id
        for (const oldSec of oldSections) {
          if (oldSec.title.toLowerCase() === newSec.title.toLowerCase()) {
            sectionIdMap[oldSec.id] = newSec.id
          }
        }
      }
    }

    const topicsToClone = prevTopics.filter(t => selectedTopicIds.includes(t.id))
    const movedTopics: any[] = []
    const sectionTopicCount: Record<number, number> = {}

    for (const topic of topicsToClone) {
      const isNewBusiness = oldSections.find(s => s.id === topic.section_id)?.title === "New Business"
      
      if (isNewBusiness) {
        movedTopics.push(topic)
        continue
      }

      const newSectionId = topic.section_id ? sectionIdMap[topic.section_id] : null
      if (newSectionId) {
        sectionTopicCount[newSectionId] = (sectionTopicCount[newSectionId] || 0) + 1
        
        const { data: newTopic } = await adminSupabase
          .from('topics')
          .insert({
            meeting_id: newMeetingId,
            section_id: newSectionId,
            title: topic.title,
            description: topic.description,
            order_index: sectionTopicCount[newSectionId],
            rolled_over_from_topic_id: topic.id,
            created_at: topic.created_at // Preserve original creation date
          })
          .select()
          .single()
        
        if (newTopic) {
          await cloneTopicItems(topic.id, newTopic.id)
        }
      }
    }

    const targetOldBusinessId = newSectionTitleMap["old business / business arising"]
    if (targetOldBusinessId && movedTopics.length > 0) {
      for (const topic of movedTopics) {
        sectionTopicCount[targetOldBusinessId] = (sectionTopicCount[targetOldBusinessId] || 0) + 1
        const { data: newTopic } = await adminSupabase
          .from('topics')
          .insert({
            meeting_id: newMeetingId,
            section_id: targetOldBusinessId,
            title: topic.title,
            description: topic.description,
            order_index: sectionTopicCount[targetOldBusinessId],
            rolled_over_from_topic_id: topic.id,
            created_at: topic.created_at // Preserve original creation date
          })
          .select()
          .single()
        
        if (newTopic) {
          await cloneTopicItems(topic.id, newTopic.id)
        }
      }
    }

    if (selectedAttendeeIds.length > 0) {
      const attendeesToInsert = prevAttendees
        .filter((a: any) => {
           const id = a.user_id?.toString() || a.name || a.email
           return selectedAttendeeIds.includes(id)
        })
        .map((a: any) => ({
          name: a.name || a.users?.name || a.users?.email?.split('@')[0],
          email: a.email || a.users?.email,
          role: a.role || 'Member',
          user_id: a.user_id,
          present: false
        }))
      await adminSupabase.from('meetings').update({ attendees: attendeesToInsert }).eq('id', newMeetingId)
    }
  }

  async function cloneTopicItems(oldTopicId: number, newTopicId: number) {
    const adminSupabase = supabase
    
    // Clone selected tasks
    const tasksToClone = prevTasks.filter(t => t.topic_id === oldTopicId && selectedTaskIds.includes(t.id))
    if (tasksToClone.length > 0) {
      const toInsert = tasksToClone.map(t => {
        const { id, updated_at, ...rest } = t;
        return { ...rest, topic_id: newTopicId };
      })
      await adminSupabase.from('tasks').insert(toInsert)
    }

    // Clone selected notes
    const notesToClone = prevNotes.filter(n => n.topic_id === oldTopicId && selectedNoteIds.includes(n.id))
    if (notesToClone.length > 0) {
      const toInsert = notesToClone.map(n => {
        const { id, updated_at, ...rest } = n;
        return { ...rest, topic_id: newTopicId };
      })
      await adminSupabase.from('notes').insert(toInsert)
    }

    // Clone selected decisions
    const decisionsToClone = prevDecisions.filter(d => d.topic_id === oldTopicId && selectedDecisionIds.includes(d.id))
    if (decisionsToClone.length > 0) {
      const toInsert = decisionsToClone.map(d => {
        const { id, edited_at, ...rest } = d;
        return { ...rest, topic_id: newTopicId };
      })
      await adminSupabase.from('decisions').insert(toInsert)
    }
  }

  const toggleTopicCascade = (topicId: number, checked: boolean) => {
    if (checked) {
      setSelectedTopicIds(prev => [...prev, topicId])
      setSelectedTaskIds(prev => [...prev, ...prevTasks.filter(t => t.topic_id === topicId).map(t => t.id)])
      setSelectedNoteIds(prev => [...prev, ...prevNotes.filter(n => n.topic_id === topicId).map(n => n.id)])
      setSelectedDecisionIds(prev => [...prev, ...prevDecisions.filter(d => d.topic_id === topicId).map(d => d.id)])
    } else {
      setSelectedTopicIds(prev => prev.filter(id => id !== topicId))
      setSelectedTaskIds(prev => prev.filter(id => !prevTasks.some(t => t.topic_id === topicId && t.id === id)))
      setSelectedNoteIds(prev => prev.filter(id => !prevNotes.some(n => n.topic_id === topicId && n.id === id)))
      setSelectedDecisionIds(prev => prev.filter(id => !prevDecisions.some(d => d.topic_id === topicId && d.id === id)))
    }
  }

  const toggleAllTopics = (checked: boolean) => {
    if (checked) {
      setSelectedTopicIds(prevTopics.map(t => t.id))
      setSelectedTaskIds(prevTasks.map(t => t.id))
      setSelectedNoteIds(prevNotes.map(n => n.id))
      setSelectedDecisionIds(prevDecisions.map(d => d.id))
    } else {
      setSelectedTopicIds([])
      setSelectedTaskIds([])
      setSelectedNoteIds([])
      setSelectedDecisionIds([])
    }
  }

  const toggleAllAttendees = (checked: boolean) => {
    if (checked) setSelectedAttendeeIds(prevAttendees.map((a: any) => a.user_id?.toString() || a.name || a.email))
    else setSelectedAttendeeIds([])
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in p-4 overflow-y-auto">
      <Card className="w-full max-w-[850px] border-0 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border bg-gradient-to-r from-primary/10 via-background to-decision-purple/10 p-6">
          <div className="flex items-center gap-3">
             <div className="h-10 w-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
                {step === 0 ? <Calendar className="h-6 w-6" /> : <ListTodo className="h-6 w-6" />}
             </div>
             <div>
                <h2 className="text-xl font-bold text-foreground">
                  {step === 0 ? "Create New Meeting" : "Rollover Selection"}
                </h2>
                <p className="text-xs text-muted-foreground">
                  {step === 0 ? "Step 1: Meeting Details" : `Step 2: Choose contents from ${prevMeeting?.title}`}
                </p>
             </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-muted transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-800 rounded-xl text-sm flex items-center gap-3 animate-in slide-in-from-top-2">
              <Info className="h-5 w-5 text-red-500" />
              {error}
            </div>
          )}

          {step === 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in slide-in-from-left-4 duration-300">
              {/* Basic Fields ... existing logic is fine here ... I will just focus on Step 1 below */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                    <Building2 className="h-3 w-3" />
                    Building
                  </label>
                  <select
                    name="buildingId"
                    value={formData.buildingId}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2.5 bg-muted/20 border-border/50 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                  >
                    {buildings.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                    <Layout className="h-3 w-3" />
                    Meeting Title
                  </label>
                  <input
                    type="text"
                    name="title"
                    value={formData.title}
                    onChange={handleInputChange}
                    placeholder="e.g., October 2024 Board Meeting"
                    className="w-full px-4 py-2.5 bg-muted/20 border-border/50 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                      <Calendar className="h-3 w-3" />
                      Type
                    </label>
                    <select
                      name="meetingType"
                      value={formData.meetingType}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2.5 bg-muted/20 border-border/50 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                    >
                      {meetingTypes.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                      <Clock className="h-3 w-3" />
                      Starts At
                    </label>
                    <input
                      type="time"
                      name="startTime"
                      value={formData.startTime}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2.5 bg-muted/20 border-border/50 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                    />
                  </div>
                </div>
                <div className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1 px-1">
                  <Globe className="h-2.5 w-2.5" />
                  Times are stored exactly as entered — no timezone conversion applied
                </div>
              </div>

              <div className="space-y-4">
                 <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                      <Calendar className="h-3 w-3" />
                      Meeting Date
                    </label>
                    <input
                      type="date"
                      name="meetingDate"
                      value={formData.meetingDate}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2.5 bg-muted/20 border-border/50 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                    />
                 </div>

                 <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                      <MapPin className="h-3 w-3" />
                      Location
                    </label>
                    <input
                      type="text"
                      name="location"
                      value={formData.location}
                      onChange={handleInputChange}
                      placeholder="e.g., Amenity Room / Zoom"
                      className="w-full px-4 py-2.5 bg-muted/20 border-border/50 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                    />
                 </div>

                 <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                      <Hash className="h-3 w-3" />
                      Strata Plan
                    </label>
                    <input
                      type="text"
                      name="strataPlanNumber"
                      value={formData.strataPlanNumber}
                      onChange={handleInputChange}
                      placeholder="e.g., BCS1234"
                      className="w-full px-4 py-2.5 bg-muted/20 border-border/50 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                    />
                 </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-[500px]">
                {/* Agenda Outline Selection */}
                <div className="flex flex-col space-y-3 p-4 bg-muted/20 rounded-2xl border border-border/50 overflow-hidden">
                  <div className="flex items-center justify-between px-1">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                       <Layout className="h-3 w-3 text-primary" />
                       Agenda Outline
                    </label>
                    <div className="flex items-center gap-2">
                       <button onClick={() => toggleAllTopics(true)} className="text-[9px] font-bold text-primary hover:underline">ALL</button>
                       <span className="text-[10px] text-muted-foreground/30">|</span>
                       <button onClick={() => toggleAllTopics(false)} className="text-[9px] font-bold text-muted-foreground hover:underline">NONE</button>
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto pr-3 min-h-0 custom-scrollbar">
                    <div className="space-y-4">
                      {prevSections.map((section, sIdx) => {
                        const sectionTopics = prevTopics.filter(t => t.section_id === section.id)
                        if (sectionTopics.length === 0) return null

                        return (
                          <div key={section.id} className="space-y-2">
                            <h4 className="text-xs font-bold text-primary flex items-center gap-2 px-1">
                              <span className="text-primary/70">{sIdx + 1}.</span>
                              {section.title}
                            </h4>
                            <div className="pl-3 space-y-2 border-l-2 border-primary/10 ml-2">
                              {sectionTopics.map(topic => {
                                const topicTasks = prevTasks.filter(t => t.topic_id === topic.id)
                                const topicNotes = prevNotes.filter(n => n.topic_id === topic.id)
                                const topicDecisions = prevDecisions.filter(d => d.topic_id === topic.id)
                                const isExpanded = expandedTopics.includes(topic.id)
                                const hasItems = topicTasks.length > 0 || topicNotes.length > 0 || topicDecisions.length > 0
        
                                return (
                                  <div key={topic.id} className="space-y-1">
                                    <div 
                                      className={`flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-all border ${
                                        selectedTopicIds.includes(topic.id) 
                                          ? "bg-white border-primary/20 shadow-sm shadow-primary/5" 
                                          : "border-transparent hover:bg-white/50"
                                      }`}
                                      onClick={() => {
                                        const checked = !selectedTopicIds.includes(topic.id)
                                        toggleTopicCascade(topic.id, checked)
                                      }}
                                    >
                               <Checkbox checked={selectedTopicIds.includes(topic.id)} onCheckedChange={() => {}} />
                               <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <p className="text-xs font-bold truncate leading-none">{topic.title}</p>
                                    {topic.is_archived && (
                                      <Badge variant="outline" className="text-[8px] h-3.5 leading-none px-1 border-amber-500 text-amber-600 bg-amber-50">ARCHIVED</Badge>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2">
                                     <Badge variant="outline" className="text-[8px] h-3.5 leading-none px-1 border-muted-foreground/10 text-muted-foreground">Topics</Badge>
                                     {hasItems && (
                                       <button 
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            setExpandedTopics(prev => isExpanded ? prev.filter(id => id !== topic.id) : [...prev, topic.id])
                                          }}
                                          className="text-[9px] text-primary hover:underline font-bold"
                                       >
                                          {isExpanded ? 'Collapse' : `Select Items (${topicTasks.length + topicNotes.length + topicDecisions.length})`}
                                       </button>
                                     )}
                                  </div>
                               </div>
                            </div>
                            
                            {isExpanded && (
                               <div className="ml-8 space-y-3 py-2 border-l-2 border-primary/10 pl-4 animate-in slide-in-from-top-2 duration-200">
                                  {topicTasks.length > 0 && (
                                     <div className="space-y-1.5">
                                        <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                           <ListTodo className="h-2.5 w-2.5" />
                                           Tasks
                                        </p>
                                        {topicTasks.map(t => (
                                           <label key={t.id} className="flex items-start gap-2.5 group cursor-pointer">
                                              <Checkbox 
                                                checked={selectedTaskIds.includes(t.id)} 
                                                onCheckedChange={(c) => {
                                                   if (c) setSelectedTaskIds(prev => [...prev, t.id])
                                                   else setSelectedTaskIds(prev => prev.filter(id => id !== t.id))
                                                }}
                                              />
                                              <span className="text-[11px] leading-tight text-foreground/80 group-hover:text-foreground transition-colors">{t.description}</span>
                                           </label>
                                        ))}
                                     </div>
                                  )}

                                  {topicNotes.length > 0 && (
                                     <div className="space-y-1.5">
                                        <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                           <StickyNote className="h-2.5 w-2.5" />
                                           Notes
                                        </p>
                                        {topicNotes.map(n => (
                                           <label key={n.id} className="flex items-start gap-2.5 group cursor-pointer">
                                              <Checkbox 
                                                checked={selectedNoteIds.includes(n.id)} 
                                                onCheckedChange={(c) => {
                                                   if (c) setSelectedNoteIds(prev => [...prev, n.id])
                                                   else setSelectedNoteIds(prev => prev.filter(id => id !== n.id))
                                                }}
                                              />
                                              <span className="text-[11px] leading-tight text-foreground/80 group-hover:text-foreground transition-colors line-clamp-2">{n.content}</span>
                                           </label>
                                        ))}
                                     </div>
                                  )}

                                  {topicDecisions.length > 0 && (
                                     <div className="space-y-1.5">
                                        <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                           <FileCheck className="h-2.5 w-2.5" />
                                           Decisions
                                        </p>
                                        {topicDecisions.map(d => (
                                           <label key={d.id} className="flex items-start gap-2.5 group cursor-pointer">
                                              <Checkbox 
                                                checked={selectedDecisionIds.includes(d.id)} 
                                                onCheckedChange={(c) => {
                                                   if (c) setSelectedDecisionIds(prev => [...prev, d.id])
                                                   else setSelectedDecisionIds(prev => prev.filter(id => id !== d.id))
                                                }}
                                              />
                                              <span className="text-[11px] leading-tight text-foreground/80 group-hover:text-foreground transition-colors">{d.motion_text}</span>
                                           </label>
                                        ))}
                                     </div>
                                  )}
                               </div>
                            )}
                          </div>
                        )
                      })}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>

                {/* Attendees Selection */}
                <div className="flex flex-col space-y-3 p-4 bg-muted/20 rounded-2xl border border-border/50 overflow-hidden">
                   <div className="flex items-center justify-between px-1">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                       <Users className="h-3 w-3 text-decision-purple" />
                       Attendees
                    </label>
                    <div className="flex items-center gap-2">
                       <button onClick={() => toggleAllAttendees(true)} className="text-[9px] font-bold text-primary hover:underline">ALL</button>
                       <span className="text-[10px] text-muted-foreground/30">|</span>
                       <button onClick={() => toggleAllAttendees(false)} className="text-[9px] font-bold text-muted-foreground hover:underline">NONE</button>
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto pr-3 min-h-0 custom-scrollbar">
                    <div className="space-y-1.5">
                      {prevAttendees.map((att: any, idx) => {
                        const uniqueId = att.user_id?.toString() || att.name || att.email || String(idx)
                        return (
                        <div 
                          key={uniqueId}
                          onClick={() => {
                            if (selectedAttendeeIds.includes(uniqueId)) setSelectedAttendeeIds(selectedAttendeeIds.filter(id => id !== uniqueId))
                            else setSelectedAttendeeIds([...selectedAttendeeIds, uniqueId])
                          }}
                          className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all border ${
                            selectedAttendeeIds.includes(uniqueId) 
                              ? "bg-white border-decision-purple/20 shadow-sm shadow-decision-purple/5" 
                              : "border-transparent hover:bg-white/50"
                          }`}
                        >
                           <Checkbox checked={selectedAttendeeIds.includes(uniqueId)} onCheckedChange={() => {}} />
                           <div className="min-w-0 flex-1">
                              <p className="text-xs font-bold truncate leading-none mb-1">{att.name || att.users?.name || att.users?.email?.split('@')[0]}</p>
                              <p className="text-[9px] text-muted-foreground truncate">{att.role || 'Member'}</p>
                           </div>
                        </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-border bg-muted/20 flex items-center justify-between gap-3">
           {step === 0 ? (
              <Button variant="ghost" onClick={onClose} disabled={loadingPrev}>Cancel</Button>
           ) : (
              <Button variant="ghost" onClick={() => setStep(0)} className="gap-2">
                 <ChevronLeft className="h-4 w-4" />
                 Back to Details
              </Button>
           )}
           
           <div className="flex items-center gap-3">
              {step === 0 ? (
                 <Button 
                   onClick={handleNext} 
                   disabled={loadingPrev}
                   className="min-w-[140px] bg-primary hover:bg-primary/90 text-primary-foreground gap-2 font-bold shadow-lg shadow-primary/10"
                 >
                   {loadingPrev ? (
                      <>
                        <div className="h-3 w-3 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                        Analyzing...
                      </>
                   ) : (
                      <>
                        Configure Rollover
                        <ChevronRight className="h-4 w-4" />
                      </>
                   )}
                 </Button>
              ) : (
                 <Button 
                   onClick={() => createMeeting(true)}
                   disabled={loading}
                   className="min-w-[140px] bg-gradient-to-r from-primary to-decision-purple text-primary-foreground font-bold shadow-xl animate-in zoom-in-95 duration-200"
                 >
                   {loading ? "Creating..." : "Finalize & Create"}
                   {!loading && <Check className="h-4 w-4 ml-2" />}
                 </Button>
              )}
           </div>
        </div>
      </Card>
    </div>
  )
}