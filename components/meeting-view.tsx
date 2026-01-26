"use client"

import { useState, useEffect } from "react"
import GenerateAgendaButton from "./GenerateAgendaButton"
import GenerateMinutesButton from "./GenerateMinutesButton"
import {
  ArrowLeft, Plus, Trash, Pencil, ChevronDown, ChevronRight, Calendar,
  Clock, MapPin, FileText, Edit2, Play, CheckCircle, ChevronLeft, Users, Lock, Unlock, Mail
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
import SelectRecorderModal from "./SelectRecorderModal"
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
  onEditDecision?: (decisionId: number, topicId: number) => void
  onAddThreadedDecision?: (parentDecisionId: number, topicId: number) => void
  onEditTask?: (taskId: number, topicId: number) => void
  onEditNote?: (noteId: number, topicId: number) => void
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
  onRegisterTopicRefresh,
  onEditDecision,
  onAddThreadedDecision,
  onEditTask,
  onEditNote
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
  
  const [attendeesExpanded, setAttendeesExpanded] = useState(false)
  const [showRecorderModal, setShowRecorderModal] = useState(false)
  const [selectedSection, setSelectedSection] = useState<{ id: number; title: string } | null>(null)

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

  const handleMeetingIncameraToggle = async () => {
    if (!userCanEdit) {
      alert('You do not have permission to modify meetings.')
      return
    }

    const newValue = !meeting.is_incamera

    try {
      const { error } = await supabase
        .from("meetings")
        .update({ is_incamera: newValue })
        .eq("id", meetingId)

      if (error) {
        console.error("Error updating in-camera status:", error)
        alert("Failed to update in-camera status")
        return
      }

      setMeeting({ ...meeting, is_incamera: newValue })
      
      if (newValue) {
        alert('ðŸ”’ Entire meeting marked as In-Camera (Confidential)')
      } else {
        alert('ðŸ”“ In-Camera removed from meeting')
      }
    } catch (err) {
      console.error("Unexpected error:", err)
      alert("Failed to update in-camera status")
    }
  }

  const fetchOpenTasksFromPreviousMeetings = async () => {
    if (!meeting) return []

    try {
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

      const allOpenTasks = await fetchOpenTasksFromPreviousMeetings()

      const sectionsWithTopics: Section[] = (sectionsData || []).map((section) => ({
        id: section.id,
        title: section.title,
        order_index: section.order_index,
        isExpanded: false,
        topics: (topicsData || []).filter(
          (topic) => topic.section_id === section.id
        ).map((topic) => {
          const tasksForThisTopic = allOpenTasks.filter(
            task => task.topics?.title === topic.title
          ).length

          return {
            id: topic.id,
            title: topic.title,
            description: topic.description,
            section_id: topic.section_id,
            attachments: 0,
            tasks: tasksForThisTopic,
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

  // â­ UPDATED: Preserve section expanded state when editing topic title
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
      if (updates.title) {
        // â­ PRESERVE EXPANDED STATE: Save current expanded states before refresh
        const expandedStates = sections.reduce((acc, section) => {
          acc[section.id] = section.isExpanded
          return acc
        }, {} as Record<number, boolean>)
        
        await fetchSectionsAndTopics()
        
        // â­ RESTORE EXPANDED STATE: Restore after refresh
        setSections(prevSections => 
          prevSections.map(section => ({
            ...section,
            isExpanded: expandedStates[section.id] ?? section.isExpanded
          }))
        )
      }
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
        } catch (err) {
          console.error("Failed to update topic order:", err)
        }
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
        } catch (err) {
          console.error("Failed to update topics order:", err)
        }
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

  // â­ UPDATED: Added logic to reset attendee presence when going back to working_agenda
  const updateMeetingStatus = async (targetStatus: string, recorderName?: string, timekeeperName?: string | null) => {
    try {
      setLoading(true)
      
      const updateData: any = { status: targetStatus }
      
      if (targetStatus === "working_minutes" && recorderName) {
        updateData.recorder_name = recorderName
        updateData.timekeeper_name = timekeeperName
      }
      
      // â­ RESET ATTENDEE PRESENCE when going back to working_agenda
      if (targetStatus === "working_agenda" && meeting?.attendees) {
        const resetAttendees = (meeting.attendees as Attendee[]).map(attendee => ({
          ...attendee,
          present: false
        }))
        updateData.attendees = resetAttendees
      }
      
      const { error } = await supabase
        .from("meetings")
        .update(updateData)
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
    
    const [year, month, day] = dateString.split('-').map(Number)
    const date = new Date(Date.UTC(year, month - 1, day))
    
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "UTC"
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

  // â­ IMPROVED: Enhanced Email Design with Better Styling
  const handleSendNotice = async () => {
    if (!meeting) return

    const confirmed = confirm(
      `Send meeting notice to all owners/residents of ${meeting.building}?\n\n` +
      `This will email the agenda to all assigned owners and residents.`
    )
    
    if (!confirmed) return

    try {
      setLoading(true)

      // Fetch building to get company_id
      const { data: buildingData, error: buildingError } = await supabase
        .from('buildings')
        .select('company_id, name')
        .eq('id', meeting.building_id)
        .single()

      if (buildingError || !buildingData) {
        alert('Error: Could not fetch building information')
        return
      }

      // Fetch all users assigned to this building with owner or resident type
      const { data: userBuildings, error: userBuildingsError } = await supabase
        .from('user_buildings')
        .select('user_id')
        .eq('building_id', meeting.building_id)

      if (userBuildingsError) {
        alert('Error: Could not fetch building users')
        return
      }

      const userIds = userBuildings.map(ub => ub.user_id)

      if (userIds.length === 0) {
        alert('No owners/residents assigned to this building')
        return
      }

      // Fetch user details (only owners and residents)
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id, name, email, user_type')
        .in('id', userIds)
        .in('user_type', ['owner', 'resident'])

      if (usersError || !users || users.length === 0) {
        alert('No owners/residents found for this building')
        return
      }

      const recipients = users.filter(u => u.email).map(u => u.email).join(', ')

      if (!recipients) {
        alert('No email addresses found for owners/residents')
        return
      }

      // Prepare email content with enhanced design
      const subject = `Meeting Notice: ${meeting.title}`
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body {
              margin: 0;
              padding: 0;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              background-color: #f3f4f6;
            }
            .email-container {
              max-width: 600px;
              margin: 40px auto;
              background-color: #ffffff;
              border-radius: 12px;
              overflow: hidden;
              box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            }
            .header {
              background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
              color: #ffffff;
              padding: 32px 24px;
              text-align: center;
            }
            .header h1 {
              margin: 0 0 8px 0;
              font-size: 28px;
              font-weight: 700;
              letter-spacing: -0.5px;
            }
            .header .building-name {
              font-size: 16px;
              opacity: 0.95;
              font-weight: 500;
            }
            .content {
              padding: 32px 24px;
            }
            .info-grid {
              display: grid;
              gap: 16px;
              margin-bottom: 32px;
            }
            .info-item {
              display: flex;
              align-items: flex-start;
              padding: 12px;
              background-color: #f9fafb;
              border-radius: 8px;
              border-left: 3px solid #2563eb;
            }
            .info-item .icon {
              width: 20px;
              height: 20px;
              margin-right: 12px;
              flex-shrink: 0;
              color: #2563eb;
            }
            .info-item .label {
              font-weight: 600;
              color: #374151;
              margin-right: 8px;
              min-width: 100px;
            }
            .info-item .value {
              color: #1f2937;
            }
            .divider {
              height: 2px;
              background: linear-gradient(90deg, #e5e7eb 0%, #d1d5db 50%, #e5e7eb 100%);
              margin: 32px 0;
              border: none;
            }
            .agenda-title {
              font-size: 22px;
              font-weight: 700;
              color: #1f2937;
              margin-bottom: 24px;
              padding-bottom: 12px;
              border-bottom: 3px solid #2563eb;
              display: inline-block;
            }
            .section {
              margin-bottom: 24px;
              padding: 16px;
              background-color: #f9fafb;
              border-radius: 8px;
              border: 1px solid #e5e7eb;
            }
            .section-title {
              font-size: 18px;
              font-weight: 700;
              color: #1f2937;
              margin-bottom: 12px;
              display: flex;
              align-items: center;
            }
            .section-number {
              display: inline-flex;
              align-items: center;
              justify-content: center;
              width: 32px;
              height: 32px;
              background-color: #2563eb;
              color: #ffffff;
              border-radius: 50%;
              font-size: 16px;
              font-weight: 700;
              margin-right: 12px;
              flex-shrink: 0;
            }
            .topics-list {
              margin: 0;
              padding-left: 20px;
            }
            .topics-list li {
              margin-bottom: 8px;
              color: #4b5563;
              line-height: 1.6;
            }
            .topic-title {
              font-weight: 600;
              color: #1f2937;
            }
            .topic-description {
              color: #6b7280;
              font-style: italic;
            }
            .no-topics {
              color: #9ca3af;
              font-style: italic;
              padding-left: 44px;
            }
            .footer {
              background-color: #f9fafb;
              padding: 24px;
              text-align: center;
              border-top: 1px solid #e5e7eb;
            }
            .footer-text {
              color: #6b7280;
              font-size: 13px;
              margin: 0;
              line-height: 1.6;
            }
            .footer-logo {
              color: #2563eb;
              font-weight: 700;
              font-size: 14px;
              margin-top: 8px;
            }
            @media only screen and (max-width: 600px) {
              .email-container {
                margin: 0;
                border-radius: 0;
              }
              .header h1 {
                font-size: 24px;
              }
              .content {
                padding: 24px 16px;
              }
            }
          </style>
        </head>
        <body>
          <div class="email-container">
            <!-- Header -->
            <div class="header">
              <h1>${meeting.title}</h1>
              <div class="building-name">${buildingData.name}</div>
            </div>

            <!-- Content -->
            <div class="content">
              <!-- Meeting Information -->
              <div class="info-grid">
                ${meeting.meeting_type ? `
                  <div class="info-item">
                    <div class="icon">ðŸ“‹</div>
                    <div>
                      <span class="label">Meeting Type:</span>
                      <span class="value">${meeting.meeting_type}</span>
                    </div>
                  </div>
                ` : ''}
                
                <div class="info-item">
                  <div class="icon">ðŸ“…</div>
                  <div>
                    <span class="label">Date:</span>
                    <span class="value">${formatDate(meeting.meeting_date)}</span>
                  </div>
                </div>

                ${meeting.start_time ? `
                  <div class="info-item">
                    <div class="icon">ðŸ•</div>
                    <div>
                      <span class="label">Time:</span>
                      <span class="value">${formatTime(meeting.start_time)}</span>
                    </div>
                  </div>
                ` : ''}

                ${meeting.location ? `
                  <div class="info-item">
                    <div class="icon">ðŸ“</div>
                    <div>
                      <span class="label">Location:</span>
                      <span class="value">${meeting.location}</span>
                    </div>
                  </div>
                ` : ''}

                ${meeting.strata_plan_number ? `
                  <div class="info-item">
                    <div class="icon">ðŸ“„</div>
                    <div>
                      <span class="label">Strata Plan:</span>
                      <span class="value">${meeting.strata_plan_number}</span>
                    </div>
                  </div>
                ` : ''}
              </div>

              <hr class="divider">

              <!-- Agenda -->
              <h2 class="agenda-title">ðŸ“‹ Agenda</h2>

              ${sections.map((section, idx) => `
                <div class="section">
                  <div class="section-title">
                    <span class="section-number">${idx + 1}</span>
                    ${section.title}
                  </div>
                  ${section.topics.length > 0 ? `
                    <ul class="topics-list">
                      ${section.topics.map((topic, topicIdx) => `
                        <li>
                          <span class="topic-title">${topicIdx + 1}. ${topic.title}</span>
                          ${topic.description ? `<br><span class="topic-description">${topic.description}</span>` : ''}
                        </li>
                      `).join('')}
                    </ul>
                  ` : '<p class="no-topics">No topics</p>'}
                </div>
              `).join('')}
            </div>

            <!-- Footer -->
            <div class="footer">
              <p class="footer-text">
                This is an automated notice from Meeting Genius.<br>
                Please do not reply to this email.
              </p>
              <div class="footer-logo">Meeting Genius</div>
            </div>
          </div>
        </body>
        </html>
      `

      // Send email via API
      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId: buildingData.company_id,
          to: recipients,
          subject,
          html,
          text: `${meeting.title}\n\nBuilding: ${buildingData.name}\nDate: ${formatDate(meeting.meeting_date)}`
        })
      })

      const result = await response.json()

      if (response.ok) {
        alert(`âœ… Notice sent successfully to ${users.length} recipient(s)!`)
      } else {
        alert(`âŒ Failed to send notice: ${result.error || 'Unknown error'}`)
      }

    } catch (error) {
      console.error('Error sending notice:', error)
      alert('Error sending notice. Please try again.')
    } finally {
      setLoading(false)
    }
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

  const attendeeCount = (meeting.attendees as Attendee[] || []).length
  const presentCount = (meeting.attendees as Attendee[] || []).filter(a => a.present).length

  return (
    <>
      <header className="border-b border-border bg-card shadow-sm sticky top-0 z-40">
        <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
          {/* â­ ROW 1: Back button + Title + Status Badges */}
          <div className="flex items-center gap-3 mb-2">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={onBack} 
              className="hover:bg-muted flex-shrink-0 h-8 w-8"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-foreground truncate">{meeting.title}</h1>
                
                {meeting.is_incamera && (
                  <Badge variant="outline" className="bg-red-100 text-red-700 border-red-300 flex-shrink-0 text-xs h-6">
                    <Lock className="h-3 w-3 mr-1" />
                    IN-CAMERA
                  </Badge>
                )}
                
                <Badge variant="outline" className={`${getStatusColor(meeting.status)} flex-shrink-0 text-xs h-6`}>
                  {getStatusText(meeting.status)}
                </Badge>
                
                {userCanEdit && meeting.status === "working_agenda" && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowEditMeetingModal(true)}
                    className="hover:bg-muted border border-blue-500 h-6 w-6 p-0 flex-shrink-0"
                    title="Edit Meeting"
                  >
                    <Edit2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
              
              <p className="text-xs text-muted-foreground truncate">{meeting.building}</p>
            </div>
          </div>

          {/* â­ ROW 2: In-Camera Warning (if enabled) */}
          {meeting.is_incamera && (
            <div className="mb-2 p-2 bg-red-50 border border-red-200 rounded text-xs">
              <div className="flex items-center gap-1.5 text-red-800">
                <Lock className="h-3 w-3 flex-shrink-0" />
                <span className="font-semibold">Confidential Meeting</span>
              </div>
            </div>
          )}
          
          {/* â­ ROW 3: ALL ACTION BUTTONS - SINGLE LINE, SAME SIZE */}
          <div className="flex items-center gap-1.5 overflow-x-auto">
            {/* In-Camera Toggle */}
            {userCanEdit && meeting.status !== "minutes" && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleMeetingIncameraToggle}
                className={`h-8 px-3 text-xs whitespace-nowrap flex-shrink-0 ${meeting.is_incamera 
                  ? "bg-red-50 border-red-300 text-red-700" 
                  : "border-gray-300"}`}
              >
                {meeting.is_incamera ? (
                  <>
                    <Unlock className="h-3 w-3 mr-1" />
                    Remove In-Camera
                  </>
                ) : (
                  <>
                    <Lock className="h-3 w-3 mr-1" />
                    In-Camera
                  </>
                )}
              </Button>
            )}
            
            {/* Back to Previous Status */}
            {userCanEdit && canTransition(meeting.status, "backward") && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => updateMeetingStatus(prevStatus(meeting.status))}
                className="h-8 px-3 text-xs whitespace-nowrap flex-shrink-0 bg-gray-100 border-gray-400"
              >
                <ChevronLeft className="h-3 w-3 mr-1" />
                Back
              </Button>
            )}
            
            {/* Start/End Meeting */}
            {userCanEdit && canTransition(meeting.status, "forward") && (
              <Button
                size="sm"
                onClick={() => {
                  const target = nextStatus(meeting.status)
                  if (target === "working_minutes") {
                    setShowRecorderModal(true)
                  } else {
                    updateMeetingStatus(target)
                  }
                }}
                className="h-8 px-3 text-xs whitespace-nowrap flex-shrink-0 bg-green-600 text-white hover:bg-green-700"
              >
                {meeting.status === "working_agenda" && (
                  <>
                    <Play className="h-3 w-3 mr-1" />
                    Start
                  </>
                )}
                {meeting.status === "working_minutes" && (
                  <>
                    <CheckCircle className="h-3 w-3 mr-1" />
                    End
                  </>
                )}
              </Button>
            )}
            
            {/* Create Section */}
            {userCanEdit && (meeting.status === "working_agenda" || meeting.status === "working_minutes") && (
              <Button
                size="sm"
                onClick={handleCreateSection}
                variant="outline"
                className="h-8 px-3 text-xs whitespace-nowrap flex-shrink-0 border-primary text-primary"
              >
                <Plus className="h-3 w-3 mr-1" />
                Section
              </Button>
            )}

            {/* â­ Send Notice Button */}
            {userCanEdit && (meeting.status === "working_agenda" || meeting.status === "agenda") && (
              <Button
                size="sm"
                onClick={handleSendNotice}
                variant="outline"
                className="h-8 px-3 text-xs whitespace-nowrap flex-shrink-0 border-blue-500 text-blue-600 hover:bg-blue-50"
              >
                <Mail className="h-3 w-3 mr-1" />
                Send Notice
              </Button>
            )}

            {/* Generate Agenda */}
            {(meeting.status === "working_agenda" || meeting.status === "agenda") && (
              <div className="flex-shrink-0">
                <GenerateAgendaButton 
                  meetingId={parseInt(meetingId)} 
                  meetingStatus={meeting.status}
                />
              </div>
            )}
            
            {/* Generate Minutes */}
            {meeting.status === "minutes" && (
              <div className="flex-shrink-0">
                <GenerateMinutesButton 
                  meetingId={meetingId} 
                  buildingId={meeting.building_id} 
                />
              </div>
            )}
            
            {/* Timer (when recording) */}
            {isMounted && isRecording && (
              <div className="flex-shrink-0">
                <Timer elapsedTime={elapsedTime} />
              </div>
            )}

            {/* Recording Controls */}
            {isMounted && userCanEdit && (
              <>
                {!isRecording ? (
                  <Button
                    size="sm"
                    onClick={handleStartRecording}
                    className="h-8 px-3 text-xs whitespace-nowrap flex-shrink-0 bg-red-500 hover:bg-red-600 text-white"
                  >
                    <span className="h-2 w-2 rounded-full bg-white mr-1.5"></span>
                    Record
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    onClick={handleStopRecording}
                    variant="outline"
                    className="h-8 px-3 text-xs whitespace-nowrap flex-shrink-0 border-red-500 text-red-500"
                  >
                    <span className="h-2 w-2 rounded-sm bg-red-500 mr-1.5"></span>
                    Stop
                  </Button>
                )}
              </>
            )}
          </div>
          
          {/* â­ ROW 4: Meeting Metadata + Recorder Info */}
          <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground mt-2 pt-2 border-t border-border">
            <div className="flex items-center gap-3 overflow-x-auto">
              {meeting.meeting_type && (
                <div className="flex items-center gap-1 whitespace-nowrap">
                  <FileText className="h-3 w-3" />
                  <span>{meeting.meeting_type}</span>
                </div>
              )}
              {meeting.meeting_date && (
                <div className="flex items-center gap-1 whitespace-nowrap">
                  <Calendar className="h-3 w-3" />
                  <span>{formatDate(meeting.meeting_date)}</span>
                </div>
              )}
              {meeting.start_time && (
                <div className="flex items-center gap-1 whitespace-nowrap">
                  <Clock className="h-3 w-3" />
                  <span>{formatTime(meeting.start_time)}</span>
                </div>
              )}
              {meeting.location && (
                <div className="flex items-center gap-1 whitespace-nowrap">
                  <MapPin className="h-3 w-3" />
                  <span>{meeting.location}</span>
                </div>
              )}
              {meeting.strata_plan_number && (
                <div className="flex items-center gap-1 whitespace-nowrap">
                  <FileText className="h-3 w-3" />
                  <span>Plan: {meeting.strata_plan_number}</span>
                </div>
              )}
            </div>
            
            {/* Recorder/Timekeeper info on the right */}
            {meeting.status === "working_minutes" && (meeting.recorder_name || meeting.timekeeper_name) && (
              <div className="flex items-center gap-2 text-xs whitespace-nowrap flex-shrink-0">
                {meeting.recorder_name && (
                  <span>ðŸ“ <strong>{meeting.recorder_name}</strong></span>
                )}
                {meeting.timekeeper_name && (
                  <span>â±ï¸ <strong>{meeting.timekeeper_name}</strong></span>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ATTENDEES EXPANDABLE SECTION */}
      <div className="mx-auto max-w-4xl px-4 pt-0 sm:px-6 lg:px-8">
        <button
          onClick={() => setAttendeesExpanded(!attendeesExpanded)}
          className="w-full flex items-center justify-between px-4 py-2 bg-card border border-border rounded-lg hover:bg-muted/30 transition-colors shadow-sm"
        >
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-blue-600" />
            <span className="text-sm font-medium text-foreground">Attendees</span>
            <Badge variant="outline" className="bg-blue-50 text-blue-700 text-xs">
              {attendeeCount}
              {meeting.status === "working_minutes" || meeting.status === "minutes" 
                ? ` Â· ${presentCount} present` 
                : ''}
            </Badge>
          </div>
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${attendeesExpanded ? 'rotate-180' : ''}`} />
        </button>
        
        {attendeesExpanded && (
          <Card className="mt-2 border border-border shadow-sm">
            <div className="p-4">
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
                onClose={() => setAttendeesExpanded(false)}
              />
            </div>
          </Card>
        )}
      </div>

      {/* MEETING SECTIONS/TOPICS WITH DRAG AND DROP */}
      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="all-sections" type="SECTION">
          {(provided: any) => (
            <div
              {...provided.droppableProps}
              ref={provided.innerRef}
              className="mx-auto max-w-4xl px-4 py-0 sm:px-6 lg:px-8 space-y-1"
            >
              {sections.map((section, sectionIndex) => (
                <Draggable key={section.id} draggableId={section.id.toString()} index={sectionIndex}>
                  {(provided: any) => (
                    <div ref={provided.innerRef} {...provided.draggableProps}>
                      <Card className="border-0 bg-gradient-to-r from-primary/10 to-decision-purple/10 mb-1">
                      <div className="w-full py-0 px-3 flex items-center justify-between">
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
                                <span className="text-lg font-bold text-primary/70 min-w-[2rem]">{sectionIndex + 1}.</span>
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
                                className="space-y-1 ml-8 pb-0"
                              >
                                {section.topics.length > 0 ? (
                                  section.topics.map((topic, topicIndex) => (
                                    <Draggable
                                      key={topic.id}
                                      draggableId={`topic-${topic.id}`}
                                      index={topicIndex}
                                    >
                                      {(provided: any) => (
                                        <div
                                          ref={provided.innerRef}
                                          {...provided.draggableProps}
                                          {...provided.dragHandleProps}
                                        >
                                          <TopicCard
                                            topic={topic}
                                            topicNumber={topicIndex + 1}
                                            meetingId={parseInt(meetingId)}
                                            meetingStatus={meeting.status}
                                            onUpdate={updates => updateTopic(topic.id, updates)}
                                            onDelete={id => deleteTopic(id)}
                                            onTaskClick={() => onTaskClick(topic.id)}
                                            onNoteClick={() => onNoteClick(topic.id)}
                                            onDecisionClick={() => onDecisionClick(topic.id)}
                                            onRegisterRefresh={onRegisterTopicRefresh}
                                            isReadOnly={userIsReadOnly || meeting.status === "minutes"}
                                            onEditDecision={(decisionId, topicId) => {
                                              if (onEditDecision) {
                                                onEditDecision(decisionId, topicId)
                                              }
                                            }}
                                            onAddThreadedDecision={(parentId, topicId) => {
                                              if (onAddThreadedDecision) {
                                                onAddThreadedDecision(parentId, topicId)
                                              }
                                            }}
                                            onEditTask={(taskId, topicId) => {
                                              if (onEditTask) {
                                                onEditTask(taskId, topicId)
                                              }
                                            }}
                                            onEditNote={(noteId, topicId) => {
                                              if (onEditNote) {
                                                onEditNote(noteId, topicId)
                                              }
                                            }}
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

      {/* Recorder Selection Modal */}
      {showRecorderModal && (
        <SelectRecorderModal
          isOpen={showRecorderModal}
          onClose={() => setShowRecorderModal(false)}
          attendees={(meeting.attendees as Attendee[]) || []}
          onConfirm={(recorderName, timekeeperName) => {
            updateMeetingStatus("working_minutes", recorderName, timekeeperName)
            setShowRecorderModal(false)
          }}
        />
      )}

      {/* Modals */}
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