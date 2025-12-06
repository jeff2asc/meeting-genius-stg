"use client"

import { useState, useEffect } from "react"
import {
  ArrowLeft, Plus, Trash, Pencil, ChevronDown, ChevronRight, Calendar,
  Clock, MapPin, FileText, Edit2, Play, CheckCircle, ChevronLeft
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import TopicCard from "./topic-card"
import Timer from "./timer"
import CreateSectionModal from "./create-section-modal"
import CreateTopicModal from "./create-topic-modal"
import EditMeetingModal from "./EditMeetingModal"
import AttendeeManagement, { Attendee } from "./AttendeeManagement"
import { supabase, getCurrentUser } from "@/lib/supabase"
import { canEditMeeting, isReadOnly } from "@/lib/permissions"
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'


interface MeetingViewProps {
  meetingId: string
  onBack: () => void
  onTaskClick: (topicId: number) => void
  onNoteClick: (topicId: number) => void
  onDecisionClick: (topicId: number) => void
  onRegisterTopicRefresh?: (topicId: number, callback: () => void) => void
}


interface Topic {
  id: number
  title: string
  description: string | null
  section_id: number | null
  attachments: number
  tasks: number
  decisions: number
  order_index?: number
}


interface Section {
  id: number
  title: string
  order_index: number
  topics: Topic[]
  isExpanded: boolean
}


const STATUS_FLOW = [
  "working_agenda",
  "working_minutes",
  "minutes"
] as const


export default function MeetingView({
  meetingId,
  onBack,
  onTaskClick,
  onNoteClick,
  onDecisionClick,
  onRegisterTopicRefresh
}: MeetingViewProps) {
  const [meeting, setMeeting] = useState<any>(null)
  const [sections, setSections] = useState<Section[]>([])
  const [elapsedTime, setElapsedTime] = useState(0)
  const [isRecording, setIsRecording] = useState(false)
  const [timerInterval, setTimerInterval] = useState<NodeJS.Timeout | null>(null)
  const [isMounted, setIsMounted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showCreateSectionModal, setShowCreateSectionModal] = useState(false)
  const [showCreateTopicModal, setShowCreateTopicModal] = useState(false)
  const [showEditMeetingModal, setShowEditMeetingModal] = useState(false)
  const [showAttendeesModal, setShowAttendeesModal] = useState(false)
  const [selectedSection, setSelectedSection] = useState<{ id: number; title: string } | null>(null)


  // Section Editing/Removal State
  const [editingSection, setEditingSection] = useState<{ id: number, title: string } | null>(null)
  const [sectionRenameValue, setSectionRenameValue] = useState("")
  const [sectionToDelete, setSectionToDelete] = useState<Section | null>(null)


  const currentUser = getCurrentUser()
  const userCanEdit = currentUser ? canEditMeeting(currentUser.user_type) : false
  const userIsReadOnly = currentUser ? isReadOnly(currentUser.user_type) : false
  const editingLocked = !userCanEdit || (meeting?.status === "minutes")


  useEffect(() => { setIsMounted(true) }, [])
  useEffect(() => { if (meetingId) fetchMeetingData() }, [meetingId])


  const fetchMeetingData = async () => {
    try {
      setLoading(true)
      const { data: meetingData, error: meetingError } = await supabase
        .from("meetings")
        .select("*, buildings(name)")
        .eq("id", meetingId)
        .single()
      if (meetingError) {
        console.error("Error fetching meeting:", meetingError)
        return
      }
      setMeeting({
        ...meetingData,
        building: meetingData.buildings?.name || "Unknown"
      })
      await fetchSectionsAndTopics()
    } catch (err) {
      console.error("Unexpected error:", err)
    } finally {
      setLoading(false)
    }
  }


  // NEW HELPER: Fetch open tasks from all previous meetings of same building + meeting type
  const fetchOpenTasksFromPreviousMeetings = async () => {
    if (!meeting) return []

    try {
      // Get all meetings of same building + meeting type (including current)
      const { data: allMeetings, error: meetingsError } = await supabase
        .from("meetings")
        .select("id, meeting_date, title")
        .eq("building_id", meeting.building_id)
        .eq("meeting_type", meeting.meeting_type)
        .order("meeting_date", { ascending: false })

      if (meetingsError || !allMeetings) {
        console.error("Error fetching previous meetings:", meetingsError)
        return []
      }

      // Get all topic IDs from all these meetings
      const meetingIds = allMeetings.map(m => m.id)
      
      const { data: allTopics, error: topicsError } = await supabase
        .from("topics")
        .select("id, title, meeting_id")
        .in("meeting_id", meetingIds)

      if (topicsError || !allTopics) {
        console.error("Error fetching topics:", topicsError)
        return []
      }

      const topicIds = allTopics.map(t => t.id)

      // Get all open tasks from these topics
      const { data: openTasks, error: tasksError } = await supabase
        .from("tasks")
        .select("*, topics!inner(id, title, meeting_id)")
        .in("topic_id", topicIds)
        .in("status", ["open", "in_progress"])

      if (tasksError) {
        console.error("Error fetching open tasks:", tasksError)
        return []
      }

      return openTasks || []
    } catch (err) {
      console.error("Error in fetchOpenTasksFromPreviousMeetings:", err)
      return []
    }
  }


  const fetchSectionsAndTopics = async () => {
    try {
      const { data: sectionsData, error: sectionsError } = await supabase
        .from("sections")
        .select("*")
        .eq("meeting_id", meetingId)
        .order("order_index")
      
      if (sectionsError) {
        console.error("Error fetching sections:", sectionsError)
        return
      }

      const { data: topicsData, error: topicsError } = await supabase
        .from("topics")
        .select(`
          *,
          notes(count),
          decisions(count)
        `)
        .eq("meeting_id", meetingId)
        .order("order_index")
      
      if (topicsError) {
        console.error("Error fetching topics:", topicsError)
        return
      }

      // Fetch open tasks from all previous meetings
      const allOpenTasks = await fetchOpenTasksFromPreviousMeetings()

      const sectionsWithTopics: Section[] = (sectionsData || []).map((section) => ({
        id: section.id,
        title: section.title,
        order_index: section.order_index,
        isExpanded: false,
        topics: (topicsData || []).filter(
          (topic) => topic.section_id === section.id
        ).map((topic) => {
          // Count tasks for THIS topic title from ALL meetings
          const tasksForThisTopic = allOpenTasks.filter(
            task => task.topics?.title === topic.title
          ).length

          return {
            id: topic.id,
            title: topic.title,
            description: topic.description,
            section_id: topic.section_id,
            attachments: 0,
            tasks: tasksForThisTopic, // Now includes open tasks from previous meetings
            decisions: topic.decisions?.[0]?.count || 0,
            order_index: topic.order_index
          }
        })
      }))

      setSections(sectionsWithTopics)
    } catch (err) {
      console.error("Unexpected error fetching sections/topics:", err)
    }
  }


  const handleAddTopic = (sectionId: number, sectionTitle: string) => {
    if (!userCanEdit) {
      alert("You do not have permission to add topics.")
      return
    }
    setSelectedSection({ id: sectionId, title: sectionTitle })
    setShowCreateTopicModal(true)
  }


  // Section Rename/Remove Logic
  const beginSectionRename = (section: Section) => {
    setEditingSection({ id: section.id, title: section.title })
    setSectionRenameValue(section.title)
  }
  const saveSectionRename = async () => {
    if (!editingSection) return
    await supabase.from("sections")
      .update({ title: sectionRenameValue })
      .eq("id", editingSection.id)
    setEditingSection(null)
    setSectionRenameValue("")
    await fetchSectionsAndTopics()
  }
  const askDeleteSection = (section: Section) => setSectionToDelete(section)
  const confirmDeleteSection = async () => {
    if (!sectionToDelete) return
    await supabase.from("sections").delete().eq("id", sectionToDelete.id)
    setSectionToDelete(null)
    await fetchSectionsAndTopics()
  }
  const cancelDeleteSection = () => setSectionToDelete(null)


  const updateTopic = async (id: number, updates: Partial<Topic>) => {
    if (!userCanEdit) {
      alert("You do not have permission to edit topics.")
      return
    }
    try {
      const { error } = await supabase
        .from("topics")
        .update({
          title: updates.title,
          description: updates.description
        })
        .eq("id", id)
      if (error) {
        console.error("Error updating topic:", error)
        return
      }
      await fetchSectionsAndTopics()
    } catch (err) {
      console.error("Unexpected error:", err)
    }
  }


  const deleteTopic = async (id: number) => {
    if (!userCanEdit) {
      alert("You do not have permission to delete topics.")
      return
    }
    try {
      const { error } = await supabase
        .from("topics")
        .delete()
        .eq("id", id)
      if (error) {
        console.error("Error deleting topic:", error)
        return
      }
      await fetchSectionsAndTopics()
    } catch (err) {
      console.error("Unexpected error:", err)
    }
  }


  const toggleSection = (sectionId: number) => {
    setSections(
      sections.map((s) =>
        s.id === sectionId
          ? {
              ...s,
              isExpanded: !s.isExpanded
            }
          : s
      )
    )
  }


  const onDragEnd = async (result: any) => {
    if (!result.destination) return
    const { source, destination, type } = result
    if (type === "SECTION") {
      const newSections = Array.from(sections)
      const [removed] = newSections.splice(source.index, 1)
      newSections.splice(destination.index, 0, removed)
      newSections.forEach((s, idx) => {
        s.order_index = idx + 1
      })
      setSections(newSections)
      try {
        await Promise.all(
          newSections.map((section) =>
            supabase.from("sections")
              .update({ order_index: section.order_index })
              .eq("id", section.id)
          )
        )
      } catch (err) {
        console.error("Failed to update sections order:", err)
      }
    } else if (type === "TOPIC") {
      const fromIdx = sections.findIndex((s) => s.id === Number(source.droppableId))
      const toIdx = sections.findIndex((s) => s.id === Number(destination.droppableId))
      if (fromIdx === -1 || toIdx === -1) return
      const fromSection = sections[fromIdx]
      const toSection = sections[toIdx]
      const sourceTopics = Array.from(fromSection.topics)
      const destTopics = Array.from(toSection.topics)
      const [removed] = sourceTopics.splice(source.index, 1)
      if (fromIdx === toIdx) {
        sourceTopics.splice(destination.index, 0, removed)
        const newSections = [...sections]
        newSections[fromIdx].topics = sourceTopics
        newSections[fromIdx].topics.forEach((t, idx) => t.order_index = idx + 1)
        setSections(newSections)
        try {
          await Promise.all(
            newSections[fromIdx].topics.map((topic) =>
              supabase.from("topics").update({ order_index: topic.order_index }).eq("id", topic.id)
            )
          )
        } catch (err) { }
      } else {
        destTopics.splice(destination.index, 0, removed)
        const newSections = [...sections]
        newSections[fromIdx].topics = sourceTopics
        newSections[toIdx].topics = destTopics
        removed.section_id = newSections[toIdx].id
        newSections[fromIdx].topics.forEach((t, idx) => t.order_index = idx + 1)
        newSections[toIdx].topics.forEach((t, idx) => t.order_index = idx + 1)
        setSections(newSections)
        try {
          await Promise.all([
            ...newSections[fromIdx].topics.map((topic) =>
              supabase.from("topics").update({ order_index: topic.order_index }).eq("id", topic.id)
            ),
            ...newSections[toIdx].topics.map((topic) =>
              supabase.from("topics").update({
                order_index: topic.order_index,
                section_id: newSections[toIdx].id,
              }).eq("id", topic.id)
            )
          ])
        } catch (err) { }
      }
    }
  }


  const getStatusColor = (status: string) => {
    switch (status) {
      case "working_agenda":
        return "bg-blue-100 text-blue-800"
      case "agenda":
      case "working_minutes":
        return "bg-green-100 text-green-800"
      case "minutes":
        return "bg-purple-100 text-purple-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }


  const getStatusText = (status: string) => {
    switch (status) {
      case "working_agenda":
        return "Working Agenda"
      case "agenda":
      case "working_minutes":
        return "Working Minutes"
      case "minutes":
        return "Final Minutes"
      default:
        return status
    }
  }


  const canTransition = (from: string, direction: "forward" | "backward") => {
    const index = STATUS_FLOW.indexOf(from as any)
    if (direction === "forward") return index < STATUS_FLOW.length - 1
    if (direction === "backward") return index > 0
    return false
  }


  const nextStatus = (current: string) => {
    const index = STATUS_FLOW.indexOf(current as any)
    return index < STATUS_FLOW.length - 1 ? STATUS_FLOW[index + 1] : current
  }


  const prevStatus = (current: string) => {
    const index = STATUS_FLOW.indexOf(current as any)
    return index > 0 ? STATUS_FLOW[index - 1] : current
  }


  const updateMeetingStatus = async (targetStatus: string) => {
    try {
      setLoading(true)
      const { error } = await supabase
        .from("meetings")
        .update({ status: targetStatus })
        .eq("id", meetingId)
      if (!error) {
        await fetchMeetingData()
      }
    } catch (err) {
      console.error("Error updating meeting status:", err)
    } finally {
      setLoading(false)
    }
  }


  const handleCreateSection = () => {
    if (!userCanEdit) {
      alert("You do not have permission to create sections.")
      return
    }
    setShowCreateSectionModal(true)
  }


  const handleStartRecording = () => {
    if (!userCanEdit) {
      alert("You do not have permission to record meetings.")
      return
    }
    setIsRecording(true)
    setElapsedTime(0)
    const interval = setInterval(() => setElapsedTime(prev => prev + 1), 1000)
    setTimerInterval(interval)
  }


  const handleStopRecording = () => {
    setIsRecording(false)
    if (timerInterval) {
      clearInterval(timerInterval)
      setTimerInterval(null)
    }
  }


  const formatDate = (dateString: string) => {
    if (!dateString) return "No date"
    
    // Parse as UTC to avoid timezone shifts
    const [year, month, day] = dateString.split('-').map(Number)
    const date = new Date(Date.UTC(year, month - 1, day))
    
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "UTC" // Force UTC interpretation
    })
  }
  


  const formatTime = (timeString: string) => {
    if (!timeString) return null
    const [hours, minutes] = timeString.split(":")
    const hour = parseInt(hours)
    const ampm = hour >= 12 ? "PM" : "AM"
    const displayHour = hour % 12 || 12
    return `${displayHour}:${minutes} ${ampm}`
  }


  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted flex items-center justify-center">
        <p className="text-muted-foreground">Loading meeting...</p>
      </div>
    )
  }


  if (!meeting) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted flex items-center justify-center">
        <p className="text-muted-foreground">Meeting not found</p>
      </div>
    )
  }


  const totalTopics = sections.reduce((sum, section) => sum + section.topics.length, 0)


  return (
    <>
      <header className="border-b border-border bg-card shadow-sm sticky top-0 z-40">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={onBack} className="hover:bg-muted">
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold text-foreground">{meeting.title}</h1>
                  {userCanEdit && meeting.status === "working_agenda" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setShowEditMeetingModal(true)}
                      className="hover:bg-muted border border-blue-500"
                      title="Edit Meeting"
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                  )}
                  <Badge variant="outline" className={getStatusColor(meeting.status)}>
                    {getStatusText(meeting.status)}
                  </Badge>
                  {userCanEdit && (
                    <>
                      {canTransition(meeting.status, "backward") && (
                        <Button
                          variant="outline"
                          onClick={() => updateMeetingStatus(prevStatus(meeting.status))}
                          className="bg-gray-100 border border-gray-400 ml-2"
                        >
                          <ChevronLeft className="h-4 w-4" />
                          Back to {getStatusText(prevStatus(meeting.status))}
                        </Button>
                      )}
                      {canTransition(meeting.status, "forward") && (
                        <Button
                          onClick={() => updateMeetingStatus(nextStatus(meeting.status))}
                          className="bg-green-600 text-white ml-2"
                        >
                          {meeting.status === "working_agenda" && (
                            <>
                              <Play className="h-4 w-4 mr-2" />
                              Start Meeting
                            </>
                          )}
                          {meeting.status === "working_minutes" && (
                            <>
                              <CheckCircle className="h-4 w-4 mr-2" />
                              End Meeting
                            </>
                          )}
                        </Button>
                      )}
                    </>
                  )}
                  <Button
                    onClick={() => setShowAttendeesModal(true)}
                    variant="outline"
                  >
                    View Attendeesssszz
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">{meeting.building}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {userCanEdit &&
                (meeting.status === "working_agenda" || meeting.status === "working_minutes") && (
                  <Button
                    onClick={handleCreateSection}
                    variant="outline"
                    className="border-primary text-primary hover:bg-primary/10"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create Section
                  </Button>
                )}
              {isMounted && isRecording && <Timer elapsedTime={elapsedTime} />}
              {isMounted && userCanEdit && (
                <>
                  {!isRecording ? (
                    <Button
                      onClick={handleStartRecording}
                      className="bg-red-500 hover:bg-red-600 text-white"
                    >
                      <span className="flex items-center gap-2">
                        <span className="h-3 w-3 rounded-full bg-white"></span>
                        Start Recording
                      </span>
                    </Button>
                  ) : (
                    <Button
                      onClick={handleStopRecording}
                      variant="outline"
                      className="border-red-500 text-red-500 hover:bg-red-50"
                    >
                      <span className="flex items-center gap-2">
                        <span className="h-3 w-3 rounded-sm bg-red-500"></span>
                        Stop Recording
                      </span>
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            {meeting.meeting_type && (
              <div className="flex items-center gap-1">
                <FileText className="h-4 w-4" />
                <span>{meeting.meeting_type}</span>
              </div>
            )}
            {meeting.meeting_date && (
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                <span>{formatDate(meeting.meeting_date)}</span>
              </div>
            )}
            {meeting.start_time && (
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                <span>{formatTime(meeting.start_time)}</span>
              </div>
            )}
            {meeting.location && (
              <div className="flex items-center gap-1">
                <MapPin className="h-4 w-4" />
                <span>{meeting.location}</span>
              </div>
            )}
            {meeting.strata_plan_number && (
              <div className="flex items-center gap-1">
                <FileText className="h-4 w-4" />
                <span>Plan: {meeting.strata_plan_number}</span>
              </div>
            )}
          </div>
        </div>
      </header>


      {/* Attendees POPUP MODAL */}
      {showAttendeesModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
          <div className="bg-card p-4 rounded-lg shadow-lg max-w-lg w-full">
            <AttendeeManagement
              meetingId={meetingId}
              attendees={(meeting.attendees as Attendee[]) || []}
              status={meeting.status}
              userCanEdit={userCanEdit}
              onUpdate={async updatedAttendees => {
                await supabase.from("meetings")
                  .update({ attendees: updatedAttendees })
                  .eq("id", meetingId)
                await fetchMeetingData()
              }}
            />
            <Button
              onClick={() => setShowAttendeesModal(false)}
              className="mt-4 w-full"
              variant="outline"
            >
              Close
            </Button>
          </div>
        </div>
      )}


      {/* MEETING SECTIONS/TOPICS WITH DRAG AND DROP */}
      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="all-sections" type="SECTION">
          {(provided: any) => (
            <div
              {...provided.droppableProps}
              ref={provided.innerRef}
              className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8 space-y-6"
            >
              {sections.map((section, index) => (
                <Draggable key={section.id} draggableId={section.id.toString()} index={index}>
                  {(provided: any) => (
                    <div ref={provided.innerRef} {...provided.draggableProps}>
                      <Card className="border-0 bg-gradient-to-r from-primary/10 to-decision-purple/10 mb-3">
                        <div className="w-full p-4 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div {...provided.dragHandleProps} onClick={() => toggleSection(section.id)} className="cursor-pointer">
                              {section.isExpanded ? (
                                <ChevronDown className="h-5 w-5 text-primary" />
                              ) : (
                                <ChevronRight className="h-5 w-5 text-primary" />
                              )}
                            </div>
                            {editingSection?.id === section.id ? (
                              <form
                                onSubmit={e => {
                                  e.preventDefault()
                                  saveSectionRename()
                                }}
                                className="flex items-center gap-2"
                              >
                                <input
                                  value={sectionRenameValue}
                                  onChange={e => setSectionRenameValue(e.target.value)}
                                  className="text-lg font-bold border px-2 py-1 rounded"
                                  autoFocus
                                  onBlur={saveSectionRename}
                                />
                              </form>
                            ) : (
                              <>
                                <h2 className="text-lg font-bold text-foreground">{section.title}</h2>
                                <span className="text-sm text-muted-foreground">
                                  ({section.topics.length} {section.topics.length === 1 ? 'topic' : 'topics'})
                                </span>
                              </>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {!editingLocked && editingSection?.id !== section.id && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => beginSectionRename(section)}
                                  title="Edit section name"
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => askDeleteSection(section)}
                                  title="Delete section"
                                >
                                  <Trash className="h-4 w-4 text-red-600" />
                                </Button>
                              </>
                            )}
                            {userCanEdit && meeting.status !== "minutes" && (
                              <Button
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleAddTopic(section.id, section.title)
                                }}
                                className="bg-primary hover:bg-primary/90"
                              >
                                <Plus className="h-4 w-4 mr-2" />
                                Add Topic
                              </Button>
                            )}
                          </div>
                        </div>
                        {section.isExpanded && (
                          <Droppable droppableId={section.id.toString()} type="TOPIC">
                            {(provided: any) => (
                              <div
                                {...provided.droppableProps}
                                ref={provided.innerRef}
                                className="space-y-4 ml-8 pb-4"
                              >
                                {section.topics.length > 0 ? (
                                  section.topics.map((topic, idx) => (
                                    <Draggable
                                      key={topic.id}
                                      draggableId={`topic-${topic.id}`}
                                      index={idx}
                                    >
                                      {(provided: any) => (
                                        <div
                                          ref={provided.innerRef}
                                          {...provided.draggableProps}
                                          {...provided.dragHandleProps}
                                        >
                                          <TopicCard
                                            topic={topic}
                                            topicNumber={idx + 1}
                                            meetingId={parseInt(meetingId)}
                                            onUpdate={updates => updateTopic(topic.id, updates)}
                                            onDelete={id => deleteTopic(id)}
                                            onTaskClick={() => onTaskClick(topic.id)}
                                            onNoteClick={() => onNoteClick(topic.id)}
                                            onDecisionClick={() => onDecisionClick(topic.id)}
                                            onRegisterRefresh={onRegisterTopicRefresh}
                                            isReadOnly={userIsReadOnly || meeting.status === "minutes"}
                                          />
                                        </div>
                                      )}
                                    </Draggable>
                                  ))
                                ) : (
                                  <div className="text-center py-8 text-muted-foreground border-2 border-dashed border-border rounded-lg">
                                    {userCanEdit && meeting.status !== "minutes"
                                      ? 'No topics in this section yet. Click "Add Topic" to create one.'
                                      : 'No topics in this section yet.'}
                                  </div>
                                )}
                                {provided.placeholder}
                              </div>
                            )}
                          </Droppable>
                        )}
                      </Card>
                    </div>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>


      {/* Section Delete Confirmation Modal */}
      {sectionToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex items-center justify-center">
          <div className="bg-white border p-6 rounded-lg shadow-lg max-w-md w-full">
            <h2 className="text-xl font-bold mb-2">Delete Section?</h2>
            <p className="mb-4">
              Are you sure you want to permanently delete <b>{sectionToDelete.title}</b> and all its topics? This cannot be undone.
            </p>
            <div className="flex gap-4 justify-end">
              <Button variant="outline" onClick={cancelDeleteSection}>Cancel</Button>
              <Button className="bg-red-600 text-white" onClick={confirmDeleteSection}>Delete</Button>
            </div>
          </div>
        </div>
      )}


      {/* Modals for Section/Topic Creation and Editing */}
      {showCreateSectionModal && userCanEdit && (
        <CreateSectionModal
          meetingId={meetingId}
          onClose={() => setShowCreateSectionModal(false)}
          onSuccess={() => {
            fetchSectionsAndTopics()
            setShowCreateSectionModal(false)
          }}
        />
      )}
      {showCreateTopicModal && selectedSection && userCanEdit && (
        <CreateTopicModal
          meetingId={meetingId}
          sectionId={selectedSection.id}
          sectionTitle={selectedSection.title}
          onClose={() => {
            setShowCreateTopicModal(false)
            setSelectedSection(null)
          }}
          onSuccess={() => {
            fetchSectionsAndTopics()
            setShowCreateTopicModal(false)
            setSelectedSection(null)
          }}
        />
      )}
      {showEditMeetingModal && userCanEdit && meeting && (
        <EditMeetingModal
          isOpen={showEditMeetingModal}
          onClose={() => setShowEditMeetingModal(false)}
          onSuccess={() => {
            fetchMeetingData()
            setShowEditMeetingModal(false)
          }}
          meeting={{
            id: parseInt(meetingId),
            building_id: meeting.building_id,
            title: meeting.title,
            meeting_date: meeting.meeting_date,
            location: meeting.location,
            start_time: meeting.start_time,
            meeting_type: meeting.meeting_type,
            strata_plan_number: meeting.strata_plan_number,
          }}
          
        />
      )}
    </>
  )
}
