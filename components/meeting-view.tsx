"use client"

import React, { useState, useEffect } from "react"
import GenerateAgendaButton from "./GenerateAgendaButton"
import GenerateMinutesButton from "./GenerateMinutesButton"
import {
  ArrowLeft,
  Plus,
  Trash,
  Pencil,
  ChevronDown,
  ChevronRight,
  Calendar,
  Clock,
  MapPin,
  FileText,
  Edit2,
  Play,
  CheckCircle,
  ChevronLeft,
  Users,
  Lock,
  Unlock,
  Mail,
  FileUp,
  Download,
  X,
  Paperclip,
  Archive,
  Trash2,
} from "lucide-react"

import { UploadTranscriptModal } from "@/components/transcript/upload-transcript-modal"
import { PreviewTasksModal } from "@/components/transcript/preview-tasks-modal"
import { ViewTranscriptsModal } from "@/components/transcript/view-transcripts-modal"
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
import { apiClient } from "@/lib/api-client"
import { canEditMeeting, isReadOnly } from "@/lib/permissions"
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd"
import UnifiedItemModal from "./UnifiedItemModal"
import { formatUtcToLocalLong, formatUtcToLocalShort } from "@/lib/timezone"
import { toast } from "sonner"

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
  onTopicSave?: (topicId: number) => void
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
  is_incamera?: boolean
  incamera_start_time?: string | null
  incamera_end_time?: string | null
}

interface Section {
  id: number
  title: string
  order_index: number
  topics: Topic[]
  attachments: any[]
  isExpanded: boolean
}

const STATUS_FLOW = ["working_agenda", "working_minutes", "minutes"] as const

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
  onEditNote,
  onTopicSave,
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
  const [showSidebar, setShowSidebar] = useState(true)
  const [showArchived, setShowArchived] = useState(false)
  const [archivedTopics, setArchivedTopics] = useState<any[]>([])

  // ⭐ NEW: Recording upload state
  const [uploadingRecording, setUploadingRecording] = useState(false)
  const [downloadingAudio, setDownloadingAudio] = useState(false)

  const [attendeesExpanded, setAttendeesExpanded] = useState(false)
  const [showRecorderModal, setShowRecorderModal] = useState(false)
  const [selectedSection, setSelectedSection] = useState<{
    id: number
    title: string
  } | null>(null)

  const [editingSection, setEditingSection] = useState<{
    id: number
    title: string
  } | null>(null)
  const [sectionRenameValue, setSectionRenameValue] = useState("")
  const [sectionToDelete, setSectionToDelete] = useState<Section | null>(null)
  const [showUploadTranscript, setShowUploadTranscript] = useState(false)
  const [showPreviewTasks, setShowPreviewTasks] = useState(false)
  const [transcriptId, setTranscriptId] = useState<number | null>(null)
  const [extractedTasks, setExtractedTasks] = useState<any[]>([])
  const [showViewTranscripts, setShowViewTranscripts] = useState(false)
  const [hasTranscript, setHasTranscript] = useState(false)
  const [showUnifiedModal, setShowUnifiedModal] = useState(false)
  const [selectedTopicForModal, setSelectedTopicForModal] = useState<number | null>(null)
  const [defaultTab, setDefaultTab] = useState<"task" | "note" | "decision">("task")
  const [activeSectionId, setActiveSectionId] = useState<number | null>(null)

  const currentUser = getCurrentUser()
  const userCanEdit = currentUser ? canEditMeeting(currentUser.user_type) : false
  const userIsReadOnly = currentUser ? isReadOnly(currentUser.user_type) : false
  const editingLocked = !userCanEdit || meeting?.status === "minutes"

  useEffect(() => {
    setIsMounted(true)
  }, [])

  useEffect(() => {
    if (meetingId) fetchMeetingData()
  }, [meetingId])

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const id = parseInt(entry.target.id.replace("section-", ""))
            if (!isNaN(id)) setActiveSectionId(id)
          }
        })
      },
      { rootMargin: "-10% 0px -80% 0px" }
    )
    sections.forEach((s) => {
      const el = document.getElementById(`section-${s.id}`)
      if (el) observer.observe(el)
    })
    return () => observer.disconnect()
  }, [sections])

  const fetchMeetingData = async () => {
    try {
      setLoading(true)
      const meetingData = await apiClient.v1.meetings.get(meetingId)

      setMeeting({
        ...meetingData,
        building: meetingData.buildings?.name || "Unknown",
      })

      await fetchSectionsAndTopics()
      await checkForTranscripts()
    } catch (err) {
      console.error("Unexpected error:", err)
    } finally {
      setLoading(false)
    }
  }

  const handleMeetingIncameraToggle = async () => {
    if (!userCanEdit) {
      alert("You do not have permission to modify meetings.")
      return
    }

    const newValue = !meeting.is_incamera

    try {
      await apiClient.v1.meetings.updateIncamera(meetingId, newValue)

      setMeeting({ ...meeting, is_incamera: newValue })

      if (newValue) {
        alert("🔒 Entire meeting marked as In-Camera (Confidential)")
      } else {
        alert("🔓 In-Camera removed from meeting")
      }
      await fetchSectionsAndTopics()
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

      const meetingIds = allMeetings.map((m) => m.id)

      const { data: allTopics, error: topicsError } = await supabase
        .from("topics")
        .select("id, title, meeting_id")
        .in("meeting_id", meetingIds)

      if (topicsError || !allTopics) {
        console.error("Error fetching topics:", topicsError)
        return []
      }

      const topicIds = allTopics.map((t) => t.id)

      const { data: openTasks, error: tasksError } = await supabase
        .from("tasks")
        .select("*, topics(id, title, meeting_id)")
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
      const expandedStates = sections.reduce((acc, section) => {
        acc[section.id] = section.isExpanded
        return acc
      }, {} as Record<number, boolean>)

      const sectionsData = await apiClient.v1.sections.list(meetingId)
      const topicsData = await apiClient.v1.topics.list(meetingId)

      const archived = topicsData.filter((t: any) => t.is_archived)

      // Fetch all task counts and attachment counts for topics in this meeting
      let taskCounts: any[] = []
      let attachmentCounts: any[] = []

      if (topicsData && topicsData.length > 0) {
        const topicIds = topicsData.map((t: any) => t.id)
        
        const { data: tc } = await supabase
          .from('tasks')
          .select('topic_id')
          .in('topic_id', topicIds)
        
        const { data: ac } = await supabase
          .from('topic_attachments')
          .select('topic_id')
          .in('topic_id', topicIds)
          
        taskCounts = tc || []
        attachmentCounts = ac || []
      }

      // Fetch section attachments
      let sectionAttachments: any[] = []
      if (sectionsData && sectionsData.length > 0) {
        const sectionIds = sectionsData.map((s: any) => s.id)
        const { data: sa } = await supabase
          .from('section_attachments')
          .select('*')
          .in('section_id', sectionIds)
        sectionAttachments = sa || []
      }

      const sectionsWithTopics: Section[] = (sectionsData || []).map((section) => ({
        ...section,
        isExpanded: expandedStates[section.id] ?? true,
        attachments: sectionAttachments.filter(sa => sa.section_id === section.id),
        topics: topicsData
          .filter((t: any) => t.section_id === section.id && !t.is_archived)
          .map((t: any) => ({
            ...t,
            tasks: taskCounts?.filter(tc => tc.topic_id === t.id).length || 0,
            decisions: t.decisions?.[0]?.count || 0,
            attachments: attachmentCounts?.filter(ac => ac.topic_id === t.id).length || 0
          }))
      }))

      setSections(sectionsWithTopics)
      setArchivedTopics(archived)
    } catch (err) {
      console.error("Unexpected error fetching sections/topics:", err)
    }
  }

  const checkForTranscripts = async () => {
    try {
      const { data, error } = await supabase
        .from("meeting_transcripts")
        .select("id")
        .eq("meeting_id", meetingId)
        .limit(1)

      if (!error && data && data.length > 0) {
        setHasTranscript(true)
      } else {
        setHasTranscript(false)
      }
    } catch (err) {
      console.error("Error checking transcripts:", err)
      setHasTranscript(false)
    }
  }

  const handleSectionFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, sectionId: number) => {
    const file = e.target.files?.[0]
    if (!file || !meeting) return

    try {
      setLoading(true)
      const fileExt = file.name.split('.').pop()
      const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`
      const filePath = `section-attachments/${sectionId}/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('topic-attachments') // Reusing the same bucket for simplicity
        .upload(filePath, file)

      if (uploadError) throw uploadError

      const { data: publicUrlData } = supabase.storage
        .from('topic-attachments')
        .getPublicUrl(filePath)

      const { data: userData } = await supabase.auth.getUser()
      const userId = userData.user?.id

      const { error: dbError } = await supabase
        .from('section_attachments')
        .insert({
          section_id: sectionId,
          filename: file.name,
          file_url: publicUrlData.publicUrl,
          file_size: file.size,
          mime_type: file.type,
          uploaded_by: userId || null
        })

      if (dbError) throw dbError

      toast.success("File uploaded to section successfully!")
      await fetchSectionsAndTopics()
    } catch (err: any) {
      console.error("Upload error:", err)
      toast.error(`Upload failed: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteSectionAttachment = async (attachmentId: number) => {
    if (!confirm("Are you sure you want to remove this attachment?")) return

    try {
      const { error } = await supabase
        .from('section_attachments')
        .delete()
        .eq('id', attachmentId)

      if (error) throw error

      toast.success("Attachment removed")
      await fetchSectionsAndTopics()
    } catch (err: any) {
      toast.error(`Delete failed: ${err.message}`)
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
    await apiClient.v1.sections.update(editingSection.id, sectionRenameValue)
    setEditingSection(null)
    setSectionRenameValue("")
    await fetchSectionsAndTopics()
    await checkForTranscripts()
  }

  const askDeleteSection = (section: Section) => setSectionToDelete(section)

  const confirmDeleteSection = async () => {
    if (!sectionToDelete) return
    await apiClient.v1.sections.delete(sectionToDelete.id)
    setSectionToDelete(null)
    await fetchSectionsAndTopics()
    await checkForTranscripts()
  }

  const cancelDeleteSection = () => setSectionToDelete(null)

  const updateTopic = async (id: number, updates: Partial<Topic>) => {
    if (!userCanEdit) {
      alert("You do not have permission to edit topics.")
      return
    }
    try {
      const updatePayload: any = {}

      if (updates.title !== undefined) updatePayload.title = updates.title
      if (updates.description !== undefined)
        updatePayload.description = updates.description
      if (updates.is_incamera !== undefined)
        updatePayload.is_incamera = updates.is_incamera
      if (updates.incamera_start_time !== undefined)
        updatePayload.incamera_start_time = updates.incamera_start_time
      if (updates.incamera_end_time !== undefined)
        updatePayload.incamera_end_time = updates.incamera_end_time

      await apiClient.v1.topics.update(id, updatePayload)

      if (updates.title) {
        const expandedStates = sections.reduce((acc, section) => {
          acc[section.id] = section.isExpanded
          return acc
        }, {} as Record<number, boolean>)

        await fetchSectionsAndTopics()
        await checkForTranscripts()

        setSections((prevSections) =>
          prevSections.map((section) => ({
            ...section,
            isExpanded: expandedStates[section.id] ?? section.isExpanded,
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
      await apiClient.v1.topics.delete(id)
      await fetchSectionsAndTopics()
      await checkForTranscripts()
    } catch (err) {
      console.error("Unexpected error:", err)
    }
  }

  const archiveTopic = async () => {
    // Just refresh the data after archiving is handled in TopicCard
    await fetchSectionsAndTopics()
    await checkForTranscripts()
  }

  const toggleSection = (sectionId: number) => {
    setSections(
      sections.map((s) =>
        s.id === sectionId
          ? {
            ...s,
            isExpanded: !s.isExpanded,
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
        await apiClient.v1.sections.updateOrder(
          newSections.map(s => ({ id: s.id, order_index: s.order_index }))
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
        newSections[fromIdx].topics.forEach((t, idx) => (t.order_index = idx + 1))
        setSections(newSections)
        try {
          await apiClient.v1.topics.updateOrder(
            newSections[fromIdx].topics.map(t => ({ id: t.id, order_index: t.order_index! }))
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
        newSections[fromIdx].topics.forEach((t, idx) => (t.order_index = idx + 1))
        newSections[toIdx].topics.forEach((t, idx) => (t.order_index = idx + 1))
        setSections(newSections)
        try {
          const updates = [
            ...newSections[fromIdx].topics.map((t) => ({
              id: t.id,
              order_index: t.order_index!,
            })),
            ...newSections[toIdx].topics.map((t) => ({
              id: t.id,
              order_index: t.order_index!,
              section_id: newSections[toIdx].id,
            })),
          ]
          await apiClient.v1.topics.updateOrder(updates)
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

  const updateMeetingStatus = async (
    targetStatus: string,
    recorderName?: string,
    timekeeperName?: string | null,
    actualStartTime?: string | null,
    chairPerson?: string | null,
    minuteTaker?: string | null
  ) => {
    try {
      setLoading(true)

      const updateData: any = {}

      if (targetStatus === "working_minutes" && recorderName) {
        updateData.recorder_name = recorderName
        updateData.timekeeper_name = timekeeperName
        updateData.start_time = actualStartTime
        updateData.chair_person = chairPerson
        updateData.minute_taker = minuteTaker
      }

      if (targetStatus === "working_agenda" && meeting?.attendees) {
        const resetAttendees = (meeting.attendees as Attendee[]).map((attendee) => ({
          ...attendee,
          present: false,
        }))
        updateData.attendees = resetAttendees
      }

      await apiClient.v1.meetings.updateStatus(meetingId, targetStatus, updateData)
      await fetchMeetingData()
    } catch (err) {
      console.error("Error updating meeting status:", err)
    } finally {
      setLoading(false)
    }
  }

  // ⚠️ Warn before leaving if recording is active
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isRecording) {
        e.preventDefault()
        e.returnValue = "Recording in progress. Leaving will stop the recording."
        return e.returnValue
      }
    }
    window.addEventListener("beforeunload", handleBeforeUnload)
    return () => window.removeEventListener("beforeunload", handleBeforeUnload)
  }, [isRecording])

  // ⚠️ Warn before going back if recording
  const handleBackClick = () => {
    if (isRecording) {
      const confirmed = confirm(
        "⚠️ Recording in Progress!\n\n" +
        "Going back will STOP the current recording.\n" +
        "The recording will be lost and cannot be recovered.\n\n" +
        "Are you sure you want to leave?"
      )

      if (!confirmed) {
        return
      }

      handleStopRecording()
    }

    onBack()
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
    const interval = setInterval(() => setElapsedTime((prev) => prev + 1), 1000)
    setTimerInterval(interval)
  }

  const handleStopRecording = () => {
    setIsRecording(false)
    if (timerInterval) {
      clearInterval(timerInterval)
      setTimerInterval(null)
    }
  }

  // ⭐ Handle recording completion and upload (NO auto transcript)
  const handleRecordingComplete = async (audioBlob: Blob, duration: number) => {
    try {
      setUploadingRecording(true)
      console.log("📤 Uploading recording...")

      const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
      const filename = `${meetingId}_${timestamp}.webm`
      const filePath = `meeting-recordings/${filename}`

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("meeting-recordings")
        .upload(filePath, audioBlob, {
          contentType: "audio/webm",
          upsert: false,
        })

      if (uploadError) {
        console.error("❌ Upload error:", uploadError)
        alert("Failed to upload recording. Please try again.")
        return
      }

      console.log("✅ Recording uploaded to storage")

      const { data: urlData } = supabase.storage
        .from("meeting-recordings")
        .getPublicUrl(filePath)

      const publicUrl = urlData.publicUrl

      const { data: updateData, error: updateError } = await supabase
        .from("meetings")
        .update({
          audio_filename: filename,
          audio_file: { url: publicUrl, path: filePath },
          audio_duration: duration,
          recording_ended_at: new Date().toISOString(),
        })
        .eq("id", meetingId)

      console.log("🔍 UPDATE RESULT:", { updateData, updateError, meetingId })
      console.log("🔍 Data sent:", {
        audio_filename: filename,
        audio_file: { url: publicUrl, path: filePath },
        audio_duration: duration,
      })

      if (updateError) {
        console.error("❌ Database update error:", updateError)
        alert("Recording saved but failed to update meeting. Please contact support.")
        return
      }

      console.log("✅ Meeting record updated")
      alert(
        `✅ Recording saved successfully! (${Math.floor(duration / 60)}:${String(
          duration % 60,
        ).padStart(2, "0")})`,
      )

      await fetchMeetingData()
    } catch (error) {
      console.error("❌ Unexpected error:", error)
      alert("Failed to save recording. Please try again.")
    } finally {
      setUploadingRecording(false)
    }
  }

  const handleUploadSuccess = (transcriptId: number, tasks: any[]) => {
    setTranscriptId(transcriptId)
    setExtractedTasks(tasks)
    setShowUploadTranscript(false)
    setShowPreviewTasks(true)
  }

  const handleTasksCreated = () => {
    fetchMeetingData()
    setShowPreviewTasks(false)
  }

  const formatDate = (dateString: string) => {
    if (!dateString) return "No date"
    const combinedIso = `${dateString}T00:00:00Z`
    const date = new Date(combinedIso)

    return date.toLocaleDateString(undefined, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  }

  const formatTime = (timeString: string) => {
    if (!timeString) return null

    // ⭐ FIXED: Use the actual meeting date for correct DST offset handling
    // instead of always using "today".
    const referenceDate = meeting?.meeting_date || new Date().toISOString().split('T')[0]
    const combinedIso = `${referenceDate}T${timeString}Z`

    const date = new Date(combinedIso)
    return date.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
  }

  const handleSendNotice = async () => {
    if (!meeting) return

    const confirmed = confirm(
      `Send meeting notice to all owners/residents of ${meeting.building}?\n\n` +
      `This will email the agenda to all assigned owners and residents.`
    )

    if (!confirmed) return

    try {
      setLoading(true)

      const { data: buildingData, error: buildingError } = await supabase
        .from("buildings")
        .select("company_id, name")
        .eq("id", meeting.building_id)
        .single()

      if (buildingError || !buildingData) {
        alert("Error: Could not fetch building information")
        return
      }

      const { data: userBuildings, error: userBuildingsError } = await supabase
        .from("user_buildings")
        .select("user_id")
        .eq("building_id", meeting.building_id)

      if (userBuildingsError) {
        alert("Error: Could not fetch building users")
        return
      }

      const userIds = userBuildings.map((ub) => ub.user_id)

      if (userIds.length === 0) {
        alert("No owners/residents assigned to this building")
        return
      }

      const { data: users, error: usersError } = await supabase
        .from("users")
        .select("id, name, email, user_type")
        .in("id", userIds)
        .in("user_type", ["owner", "resident"])

      if (usersError || !users || users.length === 0) {
        alert("No owners/residents found for this building")
        return
      }

      const recipients = users.filter((u) => u.email).map((u) => u.email).join(", ")

      if (!recipients) {
        alert("No email addresses found for owners/residents")
        return
      }

      const subject = `Meeting Notice: ${meeting.title}`
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              background-color: #f5f7fa;
              padding: 20px 0;
            }
            .email-wrapper {
              max-width: 650px;
              margin: 0 auto;
              background: #ffffff;
              border-radius: 16px;
              overflow: hidden;
              box-shadow: 0 10px 40px rgba(0, 0, 0, 0.08);
            }
            .header {
              background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%);
              padding: 48px 32px;
              text-align: center;
              position: relative;
            }
            .header h1 {
              color: #ffffff;
              font-size: 32px;
              font-weight: 800;
              margin-bottom: 12px;
              text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
            }
            .building-badge {
              display: inline-block;
              background: rgba(255, 255, 255, 0.2);
              backdrop-filter: blur(10px);
              color: #ffffff;
              padding: 8px 20px;
              border-radius: 20px;
              font-size: 15px;
              font-weight: 600;
              border: 1px solid rgba(255, 255, 255, 0.3);
            }
            .content { padding: 40px 32px; }
            .info-grid {
              display: grid;
              grid-template-columns: 1fr;
              gap: 12px;
              margin-bottom: 36px;
            }
            .info-card {
              background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
              border-left: 4px solid #3b82f6;
              border-radius: 10px;
              padding: 18px 20px;
              display: flex;
              align-items: center;
            }
            .info-icon {
              font-size: 24px;
              margin-right: 16px;
              flex-shrink: 0;
            }
            .info-content { flex: 1; }
            .info-label {
              font-size: 12px;
              font-weight: 700;
              text-transform: uppercase;
              color: #64748b;
              letter-spacing: 0.5px;
              margin-bottom: 4px;
            }
            .info-value {
              font-size: 16px;
              font-weight: 600;
              color: #1e293b;
            }
            .divider {
              height: 2px;
              background: linear-gradient(90deg, transparent 0%, #cbd5e1 50%, transparent 100%);
              margin: 36px 0;
            }
            .agenda-header {
              text-align: center;
              margin-bottom: 32px;
            }
            .agenda-title {
              font-size: 28px;
              font-weight: 800;
              color: #1e293b;
              margin-bottom: 8px;
            }
            .agenda-subtitle {
              font-size: 14px;
              color: #64748b;
              font-weight: 500;
            }
            .section-card {
              background: #ffffff;
              border: 2px solid #e2e8f0;
              border-radius: 12px;
              margin-bottom: 20px;
              overflow: hidden;
            }
            .section-header {
              background: linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%);
              padding: 16px 24px 16px 32px;
              display: flex;
              align-items: center;
              border-bottom: 2px solid #cbd5e1;
            }
            .section-number {
              width: 44px;
              height: 44px;
              min-width: 44px;
              min-height: 44px;
              background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
              color: #ffffff;
              border-radius: 12px;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 20px;
              font-weight: 700;
              margin-right: 16px;
              flex-shrink: 0;
              box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
              line-height: 2;
              padding: 2;
            }
            .section-title {
              font-size: 20px;
              font-weight: 700;
              color: #1e293b;
              line-height: 1.2;
            }
            .section-body { padding: 24px; }
            .topics-list {
              list-style: none;
              padding: 0;
              margin: 0;
            }
            .topic-item {
              padding: 16px;
              background: #f8fafc;
              border-radius: 8px;
              margin-bottom: 12px;
              border-left: 3px solid #3b82f6;
            }
            .topic-item:last-child { margin-bottom: 0; }
            .topic-number {
              display: inline-flex;
              align-items: center;
              justify-content: center;
              background: #3b82f6;
              color: #ffffff;
              font-size: 12px;
              font-weight: 700;
              padding: 4px 10px;
              border-radius: 6px;
              margin-right: 10px;
              vertical-align: middle;
              line-height: 1;
            }
            .topic-title {
              font-size: 16px;
              font-weight: 700;
              color: #1e293b;
              line-height: 1.5;
            }
            .topic-description {
              font-size: 14px;
              color: #64748b;
              margin-top: 8px;
              line-height: 1.6;
              font-style: italic;
            }
            .no-topics {
              text-align: center;
              padding: 24px;
              color: #94a3b8;
              font-size: 14px;
              font-style: italic;
            }
            .footer {
              background: linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%);
              padding: 32px;
              text-align: center;
              border-top: 2px solid #cbd5e1;
            }
            .footer-text {
              font-size: 13px;
              color: #64748b;
              line-height: 1.8;
              margin-bottom: 12px;
            }
            .footer-brand {
              font-size: 16px;
              font-weight: 800;
              background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
              -webkit-background-clip: text;
              -webkit-text-fill-color: transparent;
              background-clip: text;
            }
            @media only screen and (max-width: 600px) {
              .email-wrapper { margin: 0; border-radius: 0; }
              .header { padding: 36px 24px; }
              .header h1 { font-size: 26px; }
              .content { padding: 32px 20px; }
            }
          </style>
        </head>
        <body>
          <div class="email-wrapper">
            <div class="header">
              <h1>📋 Meeting Notice</h1>
              <div class="building-badge">${buildingData.name}</div>
            </div>
            <div class="content">
              <div class="info-grid">
                <div class="info-card">
                  <div class="info-icon">📋</div>
                  <div class="info-content">
                    <div class="info-label">Meeting Title</div>
                    <div class="info-value">${meeting.title}</div>
                  </div>
                </div>
                ${meeting.meeting_type
          ? `
                  <div class="info-card">
                    <div class="info-icon">🏢</div>
                    <div class="info-content">
                      <div class="info-label">Meeting Type</div>
                      <div class="info-value">${meeting.meeting_type}</div>
                    </div>
                  </div>
                `
          : ""
        }
                <div class="info-card">
                  <div class="info-icon">📅</div>
                  <div class="info-content">
                    <div class="info-label">Date</div>
                    <div class="info-value">${formatDate(meeting.meeting_date)}</div>
                  </div>
                </div>
                ${meeting.start_time
          ? `
                  <div class="info-card">
                    <div class="info-icon">🕐</div>
                    <div class="info-content">
                      <div class="info-label">Time</div>
                      <div class="info-value">${formatTime(meeting.start_time)}</div>
                    </div>
                  </div>
                `
          : ""
        }
                ${meeting.location
          ? `
                  <div class="info-card">
                    <div class="info-icon">📍</div>
                    <div class="info-content">
                      <div class="info-label">Location</div>
                      <div class="info-value">${meeting.location}</div>
                    </div>
                  </div>
                `
          : ""
        }
                ${meeting.strata_plan_number
          ? `
                  <div class="info-card">
                    <div class="info-icon">📄</div>
                    <div class="info-content">
                      <div class="info-label">Strata Plan Number</div>
                      <div class="info-value">${meeting.strata_plan_number}</div>
                    </div>
                  </div>
                `
          : ""
        }
              </div>
              <div class="divider"></div>
              <div class="agenda-header">
                <h2 class="agenda-title">📋 Meeting Agenda</h2>
                <p class="agenda-subtitle">Topics to be discussed during this meeting</p>
              </div>
              ${sections
          .map(
            (section, idx) => `
                <div class="section-card">
                  <div class="section-header">
                    <div class="section-number">${idx + 1}</div>
                    <div class="section-title">${section.title}</div>
                  </div>
                  <div class="section-body">
                    ${section.attachments && section.attachments.length > 0
                ? `
                      <div style="margin-bottom: 16px; padding: 12px; background: #eff6ff; border-radius: 8px; border: 1px solid #bfdbfe;">
                        <div style="font-size: 12px; font-weight: 700; color: #1e40af; text-transform: uppercase; margin-bottom: 8px;">📎 Section Attachments:</div>
                        ${section.attachments.map(att => `<div style="font-size: 13px; color: #1e3a8a; margin-bottom: 4px;">• ${att.filename}</div>`).join("")}
                      </div>
                    `
                : ""
              }
                    ${section.topics.length > 0
                ? `
                      <ul class="topics-list">
                        ${section.topics
                  .map(
                    (topic, topicIdx) => `
                          <li class="topic-item">
                            <span class="topic-number">${idx + 1}.${topicIdx + 1}</span>
                            <span class="topic-title">${topic.title}</span>
                            ${topic.description
                        ? `<div class="topic-description">${topic.description}</div>`
                        : ""
                      }
                          </li>
                        `
                  )
                  .join("")}
                      </ul>
                    `
                : '<div class="no-topics">No topics scheduled for this section</div>'
              }
                  </div>
                </div>
              `
          )
          .join("")}
            </div>
            <div class="footer">
              <p class="footer-text">
                This is an automated meeting notice from Meeting Genius.<br>
                Please do not reply to this email.
              </p>
              <div class="footer-brand">Meeting Genius</div>
            </div>
          </div>
        </body>
        </html>
      `

      // Fetch all attachments for the meeting topics and sections
      const allTopicIds = sections.flatMap(s => s.topics.map(t => t.id))
      let emailAttachments: any[] = []

      // Add section-level attachments
      sections.forEach(s => {
        if (s.attachments && s.attachments.length > 0) {
          s.attachments.forEach(att => {
            emailAttachments.push({
              filename: att.filename,
              path: encodeURI(att.file_url)
            })
          })
        }
      })

      if (allTopicIds.length > 0) {
        const { data: attachmentsData } = await supabase
          .from('topic_attachments')
          .select('filename, file_url')
          .in('topic_id', allTopicIds)

        const topicAtts = (attachmentsData || []).map(att => ({
          filename: att.filename,
          path: encodeURI(att.file_url)
        }))
        emailAttachments = [...emailAttachments, ...topicAtts]
      }

      const response = await fetch("/api/send-email", {
        method: "POST",
        headers: { 
          'Content-Type': 'application/json',
          'x-api-key': process.env.NEXT_PUBLIC_API_KEY || 'meeting-genius-secret-key-2026'
        },
        body: JSON.stringify({
          companyId: buildingData.company_id,
          to: recipients,
          subject,
          html,
          text: `${meeting.title}\n\nBuilding: ${buildingData.name}\nDate: ${formatDate(
            meeting.meeting_date
          )}`,
          attachments: emailAttachments,
        }),
      })

      const result = await response.json()

      if (response.ok) {
        alert(`✅ Notice sent successfully to ${users.length} recipient(s)!`)
      } else {
        alert(`❌ Failed to send notice: ${result.error || "Unknown error"}`)
      }
    } catch (error) {
      console.error("Error sending notice:", error)
      alert("Error sending notice. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const handleDownloadAudioRecording = async () => {
    if (downloadingAudio) {
      console.log("⏳ Download already in progress, please wait...")
      return
    }

    setDownloadingAudio(true)
    try {
      let audioPath: string | null = null
      let audioUrl: string | null = null

      if (meeting?.audio_file) {
        if (typeof meeting.audio_file === 'string') {
          try {
            let jsonString = meeting.audio_file.trim()

            if (jsonString.startsWith('\\x') || jsonString.includes('\\x')) {
              const hexPattern = /\\x([0-9a-fA-F]{2})/g
              jsonString = jsonString.replace(hexPattern, (match: string, hex: string): string => {
                return String.fromCharCode(parseInt(hex, 16))
              })
            }

            if (jsonString.startsWith('{') || jsonString.startsWith('[')) {
              const parsed = JSON.parse(jsonString)
              audioPath = parsed?.path || null
              audioUrl = parsed?.url || null
            } else {
              audioUrl = jsonString
            }
          } catch (parseError) {
            console.warn("⚠️ Failed to parse audio_file JSON:", parseError)
            if (meeting?.audio_filename) {
              audioPath = `meeting-recordings/${meeting.audio_filename}`
            }
          }
        } else if (typeof meeting.audio_file === 'object' && meeting.audio_file !== null) {
          audioPath = meeting.audio_file.path || null
          audioUrl = meeting.audio_file.url || null
        }
      }

      if (!audioPath && meeting?.audio_filename) {
        audioPath = meeting.audio_filename.includes('meeting-recordings/')
          ? meeting.audio_filename
          : `meeting-recordings/${meeting.audio_filename}`
      }

      if (!audioPath && meeting?.audio_filename) {
        audioPath = meeting.audio_filename
      }

      console.log("🔍 Audio download - Path:", audioPath, "URL:", audioUrl, "Filename:", meeting?.audio_filename)
      console.log("🔍 Raw audio_file type:", typeof meeting?.audio_file, "Value:", meeting?.audio_file)

      if (audioPath) {
        try {
          let pathsToTry = [audioPath]

          if (audioPath.includes('meeting-recordings/')) {
            pathsToTry.push(audioPath.replace('meeting-recordings/', ''))
          } else {
            pathsToTry.push(`meeting-recordings/${audioPath}`)
          }

          console.log("🔍 Trying paths for signed URL:", pathsToTry)

          let signedUrlData = null
          let signedUrlError = null

          for (const tryPath of pathsToTry) {
            const result = await supabase.storage
              .from('meeting-recordings')
              .createSignedUrl(tryPath, 3600)

            if (result.data?.signedUrl && !result.error) {
              signedUrlData = result.data
              console.log("✅ Signed URL created for path:", tryPath)
              break
            } else {
              signedUrlError = result.error
              console.log("⚠️ Failed for path:", tryPath, result.error)
            }
          }

          if (!signedUrlData?.signedUrl) {
            throw signedUrlError || new Error("Failed to create signed URL")
          }

          if (signedUrlData?.signedUrl) {
            console.log("✅ Using signed URL for download")

            const downloadUrl = signedUrlData.signedUrl
            const response = await fetch(downloadUrl, {
              cache: 'no-cache',
            })

            if (!response.ok) {
              throw new Error(`Failed to fetch signed URL: ${response.statusText}`)
            }

            const blob = await response.blob()
            const objectUrl = window.URL.createObjectURL(blob)

            const downloadFilename = meeting.audio_filename || `meeting-${meetingId}-recording.webm`

            const a = document.createElement("a")
            a.href = objectUrl
            a.download = downloadFilename
            a.style.display = 'none'
            a.setAttribute('download', downloadFilename)

            const existingDownloads = document.querySelectorAll('a[download="' + downloadFilename + '"]')
            existingDownloads.forEach(el => {
              try {
                document.body.removeChild(el)
              } catch (e) { }
            })

            document.body.appendChild(a)

            requestAnimationFrame(() => {
              setTimeout(() => {
                a.click()

                setTimeout(() => {
                  try {
                    if (document.body.contains(a)) {
                      document.body.removeChild(a)
                    }
                    window.URL.revokeObjectURL(objectUrl)
                  } catch (e) {
                    console.warn("Cleanup error (safe to ignore):", e)
                  }
                }, 200)
              }, 10)
            })

            console.log("✅ Audio download triggered successfully")
            toast.success("Audio recording downloaded successfully!")
            return
          }
        } catch (signedUrlError) {
          console.warn("⚠️ Signed URL failed, trying public URL:", signedUrlError)
        }
      }

      if (audioUrl) {
        console.log("🔍 Trying public URL:", audioUrl)
        const response = await fetch(audioUrl)
        if (!response.ok) {
          throw new Error(`Failed to fetch public URL: ${response.statusText}`)
        }

        const blob = await response.blob()
        const objectUrl = window.URL.createObjectURL(blob)
        const downloadFilename = meeting.audio_filename || `meeting-${meetingId}-recording.webm`

        const a = document.createElement("a")
        a.href = objectUrl
        a.download = downloadFilename
        a.style.display = 'none'
        a.setAttribute('download', downloadFilename)

        const existingDownloads = document.querySelectorAll('a[download="' + downloadFilename + '"]')
        existingDownloads.forEach(el => {
          try {
            document.body.removeChild(el)
          } catch (e) { }
        })

        document.body.appendChild(a)

        requestAnimationFrame(() => {
          setTimeout(() => {
            a.click()

            setTimeout(() => {
              try {
                if (document.body.contains(a)) {
                  document.body.removeChild(a)
                }
                window.URL.revokeObjectURL(objectUrl)
              } catch (e) {
                console.warn("Cleanup error (safe to ignore):", e)
              }
            }, 200)
          }, 10)
        })

        console.log("✅ Audio download triggered successfully via public URL")
        toast.success("Audio recording downloaded successfully!")
        return
      }

      throw new Error("No audio file path or URL available")

    } catch (error: any) {
      console.error("❌ Download error:", error)
      const errorMessage = error.message || "Unknown error"
      toast.error(`Failed to download audio recording: ${errorMessage}`)
      alert(`Failed to download audio recording: ${errorMessage}\n\nPlease check:\n1. File exists in storage\n2. Storage bucket permissions\n3. Browser console for details`)
    } finally {
      setDownloadingAudio(false)
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

  const attendeeCount = ((meeting.attendees as Attendee[]) || []).length
  const presentCount = ((meeting.attendees as Attendee[]) || []).filter(
    (a) => a.present
  ).length;

  return (
    <>
      <div className="flex flex-col h-screen overflow-hidden bg-background">
      <header className="border-b border-border bg-card shadow-sm sticky top-0 z-40 flex-shrink-0">
        <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 mb-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleBackClick}
              className="hover:bg-muted flex-shrink-0 h-8 w-8"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>

            <Button
              variant="default"
              size="icon"
              onClick={() => setShowSidebar(!showSidebar)}
              className={`flex-shrink-0 h-9 w-9 rounded-full transition-all ${
                showSidebar 
                  ? 'bg-primary text-primary-foreground shadow-md' 
                  : 'bg-primary text-primary-foreground shadow-lg hover:bg-primary/90'
              }`}
              title={showSidebar ? "Hide Sidebar" : "Show Sidebar"}
            >
              <FileText className="h-5 w-5" />
            </Button>

            <div className="flex-1 min-w-0">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <h1 className="text-lg font-bold text-foreground truncate">
                    {meeting.title}
                  </h1>
                  {meeting.is_incamera && meeting.status === "working_minutes" && (
                    <Badge
                      variant="outline"
                      className="bg-red-100 text-red-700 border-red-300 flex-shrink-0 text-[10px] h-5"
                    >
                      <Lock className="h-2.5 w-2.5 mr-1" />
                      IN-CAMERA
                    </Badge>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={`${getStatusColor(
                      meeting.status
                    )} flex-shrink-0 text-[10px] h-5`}
                  >
                    {getStatusText(meeting.status)}
                  </Badge>

                  {userCanEdit && meeting.status === "working_agenda" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setShowEditMeetingModal(true)}
                      className="hover:bg-muted border border-blue-500 h-5 w-5 p-0 flex-shrink-0"
                      title="Edit Meeting"
                    >
                      <Edit2 className="h-2.5 w-2.5" />
                    </Button>
                  )}
                </div>
              </div>

              <p className="text-[10px] sm:text-xs text-muted-foreground truncate mt-0.5">
                {meeting.building}
              </p>
            </div>
          </div>

          {meeting.is_incamera && meeting.status === "working_minutes" && (
            <div className="mb-2 p-2 bg-red-50 border border-red-200 rounded text-xs">
              <div className="flex items-center gap-1.5 text-red-800">
                <Lock className="h-3 w-3 flex-shrink-0" />
                <span className="font-semibold">Confidential Meeting</span>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-1">

            {userCanEdit && meeting.status === "working_minutes" && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleMeetingIncameraToggle}
                className={`h-7 px-2 text-[10px] sm:text-xs flex-shrink-0 ${meeting.is_incamera
                  ? "bg-red-50 border-red-300 text-red-700"
                  : "border-gray-300"
                  }`}
              >
                {meeting.is_incamera ? (
                  <>
                    <Unlock className="h-3 w-3" />
                    <span className="hidden sm:inline ml-1">Remove In-Camera</span>
                  </>
                ) : (
                  <>
                    <Lock className="h-3 w-3" />
                    <span className="hidden sm:inline ml-1">In-Camera</span>
                  </>
                )}
              </Button>
            )}

            {/* Back button */}
            {userCanEdit && (meeting.status === "working_minutes" || meeting.status === "minutes") && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => updateMeetingStatus(prevStatus(meeting.status))}
                className="h-7 px-2 text-[10px] sm:text-xs flex-shrink-0 bg-gray-100 border-gray-400"
              >
                <ChevronLeft className="h-3 w-3" />
                <span className="hidden sm:inline ml-1">Back</span>
              </Button>
            )}

            {/* Start button */}
            {userCanEdit && meeting.status === "working_agenda" && (
              <Button
                size="sm"
                onClick={() => setShowRecorderModal(true)}
                className="h-7 px-2 text-[10px] sm:text-xs flex-shrink-0 bg-green-600 text-white hover:bg-green-700"
              >
                <Play className="h-3 w-3" />
                <span className="sm:inline ml-1">Start</span>
              </Button>
            )}

            {/* End button */}
            {userCanEdit && meeting.status === "working_minutes" && (
              <Button
                size="sm"
                onClick={() => updateMeetingStatus("minutes")}
                className="h-7 px-2 text-[10px] sm:text-xs flex-shrink-0 bg-green-600 text-white hover:bg-green-700"
              >
                <CheckCircle className="h-3 w-3" />
                <span className="hidden sm:inline ml-1">End</span>
              </Button>
            )}

            {userCanEdit &&
              (meeting.status === "working_agenda" ||
                meeting.status === "working_minutes") && (
                <Button
                  size="sm"
                  onClick={handleCreateSection}
                  variant="outline"
                  className="h-7 px-2 text-[10px] sm:text-xs flex-shrink-0 border-primary text-primary"
                >
                  <Plus className="h-3 w-3" />
                  <span className="hidden sm:inline ml-1">Section</span>
                </Button>
              )}

            {userCanEdit &&
              (meeting.status === "working_agenda" ||
                meeting.status === "agenda") && (
                <Button
                  size="sm"
                  onClick={handleSendNotice}
                  variant="outline"
                  className="h-7 px-2 text-[10px] sm:text-xs flex-shrink-0 border-blue-500 text-blue-600 hover:bg-blue-50"
                >
                  <Mail className="h-3 w-3" />
                  <span className="hidden sm:inline ml-1">Send Notice</span>
                </Button>
              )}

            {/* Upload Transcript button */}
            {userCanEdit && meeting.status === "working_minutes" && (
              <Button
                size="sm"
                onClick={() => setShowUploadTranscript(true)}
                variant="outline"
                className="h-7 px-2 text-[10px] sm:text-xs flex-shrink-0 border-purple-500 text-purple-600 hover:bg-purple-50"
              >
                <FileUp className="h-3 w-3" />
                <span className="hidden sm:inline ml-1">Upload Transcript</span>
              </Button>
            )}

            {/* View Transcripts button */}
            {meeting.status === "working_minutes" && (
              <Button
                size="sm"
                onClick={() => setShowViewTranscripts(true)}
                variant="outline"
                className="h-7 px-2 text-[10px] sm:text-xs flex-shrink-0 border-gray-500 text-gray-600 hover:bg-gray-50"
              >
                <FileText className="h-3 w-3" />
                <span className="hidden sm:inline ml-1">View Transcripts</span>
              </Button>
            )}

            {(meeting.status === "working_agenda" ||
              meeting.status === "agenda") && (
                <div className="flex-shrink-0">
                  <GenerateAgendaButton
                    meetingId={parseInt(meetingId)}
                    meetingStatus={meeting.status}
                  />
                </div>
              )}

            {archivedTopics.length > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowArchived(!showArchived)}
                className={`h-7 px-2 text-[10px] sm:text-xs flex-shrink-0 border-amber-500 text-amber-700 hover:bg-amber-50 rounded-lg ${
                  showArchived ? "bg-amber-100" : ""
                }`}
              >
                <Archive className="h-3 w-3" />
                <span className="hidden sm:inline ml-1">Archive</span>
                <span className="ml-0.5">({archivedTopics.length})</span>
              </Button>
            )}

            {meeting.status === "minutes" && (
              <>
                <div className="flex-shrink-0">
                  <GenerateMinutesButton
                    meetingId={parseInt(meetingId)}
                    buildingId={meeting.building_id}
                  />
                </div>
                {((typeof meeting.audio_file === 'object' && meeting.audio_file?.url) ||
                  (typeof meeting.audio_file === 'string' && meeting.audio_file) ||
                  meeting.audio_filename) && (
                    <Button
                      size="sm"
                      onClick={handleDownloadAudioRecording}
                      variant="outline"
                      disabled={downloadingAudio}
                      className="h-8 px-3 text-xs whitespace-nowrap flex-shrink-0 border-blue-500 text-blue-600 hover:bg-blue-50 disabled:opacity-50"
                    >
                      <Download className="h-3 w-3 mr-1" />
                      {downloadingAudio ? "Downloading..." : "Download Audio"}
                    </Button>
                  )}
              </>
            )}

            {isMounted && isRecording && (
              <div className="flex-shrink-0">
                <Timer
                  elapsedTime={elapsedTime}
                  isRecording={isRecording}
                  meetingId={meetingId}
                  onRecordingComplete={handleRecordingComplete}
                />
              </div>
            )}

            {/* Record/Stop button */}
            {isMounted && userCanEdit && meeting.status === "working_minutes" && (
              <>
                {uploadingRecording ? (
                  <Button
                    size="sm"
                    disabled
                    className="h-7 px-2 text-[10px] sm:text-xs flex-shrink-0 bg-blue-500 text-white"
                  >
                    <span className="h-2 w-2 rounded-full bg-white mr-1 animate-pulse"></span>
                    <span className="hidden sm:inline">Uploading...</span>
                  </Button>
                ) : !isRecording ? (
                  <Button
                    size="sm"
                    onClick={handleStartRecording}
                    className="h-7 px-2 text-[10px] sm:text-xs flex-shrink-0 bg-red-500 hover:bg-red-600 text-white"
                  >
                    <span className="h-2 w-2 rounded-full bg-white mr-1"></span>
                    <span className="sm:inline">Record</span>
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    onClick={handleStopRecording}
                    variant="outline"
                    className="h-7 px-2 text-[10px] sm:text-xs flex-shrink-0 border-red-500 text-red-500"
                  >
                    <span className="h-2 w-2 rounded-sm bg-red-500 mr-1"></span>
                    <span className="sm:inline">Stop</span>
                  </Button>
                )}
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground mt-2 pt-2 border-t border-border">
            {meeting.meeting_type && (
              <div className="flex items-center gap-1">
                <FileText className="h-3 w-3" />
                <span>{meeting.meeting_type}</span>
              </div>
            )}
            {meeting.meeting_date && (
              <div className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                <span>{formatDate(meeting.meeting_date)}</span>
              </div>
            )}
            {meeting.start_time && (
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                <span>{formatTime(meeting.start_time)}</span>
              </div>
            )}
            {meeting.location && (
              <div className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                <span className="truncate max-w-[120px] sm:max-w-none">{meeting.location}</span>
              </div>
            )}
            {meeting.strata_plan_number && (
              <div className="flex items-center gap-1">
                <FileText className="h-3 w-3" />
                <span>Plan: {meeting.strata_plan_number}</span>
              </div>
            )}
            {meeting.status === "working_minutes" &&
              (meeting.recorder_name || meeting.chair_person || meeting.minute_taker || meeting.timekeeper_name) && (
                <div className="flex flex-wrap items-center gap-2 text-xs w-full sm:w-auto">
                  {meeting.chair_person && (
                    <span>👑 <strong>{meeting.chair_person}</strong></span>
                  )}
                  {meeting.recorder_name && (
                    <span>📝 <strong>{meeting.recorder_name}</strong></span>
                  )}
                  {meeting.minute_taker && (
                    <span>🖋️ <strong>{meeting.minute_taker}</strong></span>
                  )}
                  {meeting.timekeeper_name && (
                    <span>⏱️ <strong>{meeting.timekeeper_name}</strong></span>
                  )}
                </div>
              )}
          </div>
        </div>
      </header>
      
      <div className="flex flex-1 overflow-hidden relative">
        {/* ── MOBILE: Slide-in Drawer Overlay ── */}
        {showSidebar && (
          <div className="lg:hidden fixed inset-0 z-[999] flex">
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/50"
              onClick={() => setShowSidebar(false)}
            />
            {/* Drawer panel */}
            <aside className="relative z-10 w-72 max-w-[85vw] bg-white dark:bg-card border-r border-border flex flex-col h-full overflow-y-auto px-4 pt-4 pb-6 shadow-2xl">
              {/* Drawer header */}
              <div className="flex items-center justify-between mb-5 border-b border-border pb-3">
                <h3 className="text-sm font-bold text-primary flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  AGENDA OUTLINE
                </h3>
                <button
                  onClick={() => setShowSidebar(false)}
                  className="h-7 w-7 flex items-center justify-center rounded-full hover:bg-muted text-muted-foreground text-xl font-light"
                >
                  ×
                </button>
              </div>
              {sections.length === 0 ? (
                <p className="text-xs text-muted-foreground">No sections yet.</p>
              ) : (
                <nav className="space-y-1">
                  {sections.map((section, idx) => (
                    <div key={section.id} className="space-y-0.5">
                      <button
                        onClick={() => {
                          if (!section.isExpanded) toggleSection(section.id)
                          const element = document.getElementById(`section-${section.id}`)
                          element?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                          setShowSidebar(false)
                        }}
                        className={`w-full text-left text-xs font-bold px-2 py-2 rounded-lg transition-colors flex items-center gap-2 ${
                          activeSectionId === section.id
                            ? "bg-primary/10 text-primary"
                            : "hover:bg-muted text-foreground"
                        }`}
                      >
                        <span className="text-primary/60 flex-shrink-0">{idx + 1}.</span>
                        <span className="truncate">{section.title}</span>
                        <span className="ml-auto text-[10px] text-muted-foreground flex-shrink-0">
                          {section.topics.length}
                        </span>
                      </button>
                      {section.topics.length > 0 && (
                        <div className="ml-5 pl-2 border-l-2 border-primary/15 space-y-0.5">
                          {section.topics.map((topic, tIdx) => (
                            <button
                              key={topic.id}
                              onClick={() => {
                                if (!section.isExpanded) toggleSection(section.id)
                                const element = document.getElementById(`topic-${topic.id}`)
                                element?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                                setShowSidebar(false)
                              }}
                              className="w-full text-left text-[11px] px-2 py-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground flex items-center gap-1"
                            >
                              <span className="text-primary/40 flex-shrink-0">{idx + 1}.{tIdx + 1}</span>
                              <span className="truncate">{topic.title}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </nav>
              )}
            </aside>
          </div>
        )}

        {/* ── DESKTOP: Side Panel ── */}
        {showSidebar && (
          <aside className="hidden lg:flex w-64 border-r border-border bg-background flex-col shrink-0 h-full overflow-y-auto px-4 pt-2 pb-4 transition-all duration-300 shadow-sm">
            <h3 className="text-sm font-bold text-primary flex items-center gap-2 mb-4">
              <FileText className="h-4 w-4" />
              AGENDA OUTLINE
            </h3>
            <nav className="space-y-1">
              {sections.map((section, idx) => (
                <div key={section.id} className="space-y-1">
                  <button
                    onClick={() => {
                      if (!section.isExpanded) toggleSection(section.id)
                      const element = document.getElementById(`section-${section.id}`)
                      element?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                    }}
                    className={`w-full text-left text-xs font-bold px-2 py-1.5 rounded transition-colors flex items-center gap-2 ${
                      activeSectionId === section.id
                        ? "bg-primary/10 text-primary border-r-2 border-primary"
                        : "hover:bg-primary/5 text-foreground"
                    }`}
                  >
                    <span className="text-primary/70">{idx + 1}.</span>
                    <span className="truncate">{section.title}</span>
                  </button>
                  <div className="ml-4 space-y-0.5 border-l-2 border-primary/10 pl-2">
                    {section.topics.map((topic, tIdx) => (
                      <button
                        key={topic.id}
                        onClick={() => {
                          if (!section.isExpanded) toggleSection(section.id)
                          const element = document.getElementById(`topic-${topic.id}`)
                          element?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                        }}
                        className="w-full text-left text-[11px] px-2 py-1 rounded hover:bg-primary/5 text-muted-foreground hover:text-foreground truncate"
                      >
                        <span className="mr-1">{idx + 1}.{tIdx + 1}</span>
                        {topic.title}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </nav>
          </aside>
        )}


        <div className="flex-1 overflow-y-auto relative">
          {/* Main Content Container */}
          <div className="mx-auto max-w-4xl px-4 pt-1 sm:px-6 lg:px-8">
            <button
              onClick={() => setAttendeesExpanded(!attendeesExpanded)}
              className="w-full flex items-center justify-between px-4 py-2 bg-card border border-border rounded-lg hover:bg-muted/30 transition-colors shadow-sm"
            >
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-blue-600" />
            <span className="text-sm font-medium text-foreground">Attendees</span>
            <Badge variant="outline" className="bg-blue-50 text-blue-700 text-xs">
              {attendeeCount}
              {meeting.status === "working_minutes" ||
                meeting.status === "minutes"
                ? ` · ${presentCount} present`
                : ""}
            </Badge>
          </div>
          <ChevronDown
            className={`h-4 w-4 text-muted-foreground transition-transform ${attendeesExpanded ? "rotate-180" : ""
              }`}
          />
        </button>

        {attendeesExpanded && (
          <Card className="mt-2 border border-border shadow-sm">
            <div className="p-4">
              <AttendeeManagement
                meetingId={meetingId}
                attendees={(meeting.attendees as Attendee[]) || []}
                status={meeting.status}
                userCanEdit={userCanEdit}
                companyId={(meeting as any)?.buildings?.company_id ?? null}
                onUpdate={async (updatedAttendees) => {
                  await supabase
                    .from("meetings")
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

      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="all-sections" type="SECTION">
          {(provided: any) => (
            <div
              {...provided.droppableProps}
              ref={provided.innerRef}
              className="mx-auto max-w-4xl px-4 pt-0 pb-10 sm:px-6 lg:px-8 space-y-1"
            >
              {sections.map((section, sectionIndex) => (
                <Draggable
                  key={section.id}
                  draggableId={section.id.toString()}
                  index={sectionIndex}
                >
                  {(provided: any) => (
                    <div ref={provided.innerRef} {...provided.draggableProps} id={`section-${section.id}`}>
                      <Card className="border-0 bg-gradient-to-r from-primary/10 to-decision-purple/10 mb-1">
                        <div className="w-full py-1 px-3">
                          {/* Section title row */}
                          <div className="flex items-center gap-2 min-w-0">
                            <div
                              {...provided.dragHandleProps}
                              onClick={() => toggleSection(section.id)}
                              className="cursor-pointer flex-shrink-0"
                            >
                              {section.isExpanded ? (
                                <ChevronDown className="h-5 w-5 text-primary" />
                              ) : (
                                <ChevronRight className="h-5 w-5 text-primary" />
                              )}
                            </div>
                            {editingSection?.id === section.id ? (
                              <form
                                onSubmit={(e) => {
                                  e.preventDefault()
                                  saveSectionRename()
                                }}
                                className="flex items-center gap-2 flex-1"
                              >
                                <input
                                  value={sectionRenameValue}
                                  onChange={(e) => setSectionRenameValue(e.target.value)}
                                  className="text-base font-bold border px-2 py-1 rounded flex-1"
                                  autoFocus
                                  onBlur={saveSectionRename}
                                />
                              </form>
                            ) : (
                              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                <span className="text-sm font-bold text-primary/70 flex-shrink-0">
                                  {sectionIndex + 1}.
                                </span>
                                <h2 className="text-sm sm:text-base font-bold text-foreground truncate">
                                  {section.title}
                                </h2>
                                <span className="text-xs text-muted-foreground flex-shrink-0 whitespace-nowrap">
                                  ({section.topics.length} {section.topics.length === 1 ? "topic" : "topics"})
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Section action buttons row */}
                          <div className="flex items-center gap-1 mt-1 pl-7">
                            {!editingLocked && editingSection?.id !== section.id && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => beginSectionRename(section)}
                                  title="Edit section name"
                                  className="h-7 w-7"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => askDeleteSection(section)}
                                  title="Delete section"
                                  className="h-7 w-7"
                                >
                                  <Trash className="h-3.5 w-3.5 text-red-600" />
                                </Button>
                              </>
                            )}
                            {userCanEdit && meeting.status !== "minutes" && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2 text-[10px] sm:text-xs text-muted-foreground hover:text-primary"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const input = document.getElementById(`section-file-${section.id}`) as HTMLInputElement;
                                    input?.click();
                                  }}
                                >
                                  <Paperclip className="h-3 w-3 mr-1" />
                                  <span className="hidden sm:inline">Attach</span>
                                </Button>
                                <input
                                  id={`section-file-${section.id}`}
                                  type="file"
                                  className="hidden"
                                  onChange={(e) => handleSectionFileUpload(e, section.id)}
                                />
                                <Button
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleAddTopic(section.id, section.title)
                                  }}
                                  className="bg-primary hover:bg-primary/90 h-7 px-2 sm:px-3 text-[10px] sm:text-xs"
                                >
                                  <Plus className="h-3 w-3 mr-1" />
                                  Add Topic
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                        {section.isExpanded && (
                          <div className="px-12 pb-2">
                            {section.attachments && section.attachments.length > 0 && (
                              <div className="flex flex-wrap gap-2 mb-3">
                                {section.attachments.map((att) => (
                                  <div
                                    key={att.id}
                                    className="flex items-center gap-2 bg-white/50 border border-primary/20 rounded-full px-3 py-1 text-xs text-primary"
                                  >
                                    <Paperclip className="h-3 w-3" />
                                    <a
                                      href={att.file_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="hover:underline max-w-[150px] truncate"
                                    >
                                      {att.filename}
                                    </a>
                                    {userCanEdit && (
                                      <button
                                        onClick={() => handleDeleteSectionAttachment(att.id)}
                                        className="text-red-500 hover:text-red-700 ml-1"
                                      >
                                        <X className="h-3 w-3" />
                                      </button>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}

                                           <Droppable droppableId={section.id.toString()} type="TOPIC">
                              {(provided: any) => (
                                <div
                                  {...provided.droppableProps}
                                  ref={provided.innerRef}
                                  className="space-y-1 pb-0"
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
                                            id={`topic-${topic.id}`}
                                          >
                                            <TopicCard
                                              topic={topic}
                                              topicNumber={topicIndex + 1}
                                              meetingId={parseInt(meetingId)}
                                              meetingStatus={meeting.status}
                                              isReadOnly={userIsReadOnly}
                                              onUpdate={(updates) => updateTopic(topic.id, updates)}
                                              onDelete={(id) => deleteTopic(id)}
                                              onArchive={() => archiveTopic()}
                                              onTaskClick={() => onTaskClick(topic.id)}
                                              onNoteClick={() => onNoteClick(topic.id)}
                                              onDecisionClick={() => onDecisionClick(topic.id)}
                                              onRegisterRefresh={onRegisterTopicRefresh}
                                              onEditDecision={(decisionId, topicId) => {
                                                if (onEditDecision) {
                                                  onEditDecision(decisionId, topicId)
                                                }
                                              }}
                                              onAddThreadedDecision={(
                                                parentId,
                                                topicId
                                              ) => {
                                                if (onAddThreadedDecision) {
                                                  onAddThreadedDecision(
                                                    parentId,
                                                    topicId
                                                  )
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
                                        : "No topics in this section yet."}
                                    </div>
                                  )}
                                  {provided.placeholder}
                                </div>
                              )}
                            </Droppable>
                          </div>
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

        {archivedTopics.length > 0 && (
          <div className="mx-auto max-w-4xl px-4 pt-8 pb-32 sm:px-6 lg:px-8 border-t-2 border-dashed border-amber-200 mt-12">
            <h2 className="text-xl font-bold text-amber-800 mb-6 flex items-center gap-2">
              <Download className="h-5 w-5" />
              Archived Topics (Historical)
            </h2>
            <div className="space-y-4">
              {archivedTopics.map((topic) => (
                <div key={topic.id} id={`topic-${topic.id}`}>
                  <TopicCard
                    topic={topic}
                    topicNumber={0}
                    meetingId={parseInt(meetingId)}
                    meetingStatus={meeting.status}
                    isReadOnly={true} // Archived topics are read-only
                    onUpdate={(_updates) => {}}
                    onDelete={(_topicId) => {}}
                    onTaskClick={() => {}}
                    onNoteClick={() => {}}
                    onDecisionClick={() => {}}
                    onRestore={async (id) => {
                      console.log("Restoring topic:", id)
                      await fetchSectionsAndTopics()
                      await checkForTranscripts()
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </DragDropContext>
          </div> {/* Close max-w-4xl container */}
        </div> {/* Close the flex-1 container */}

      {/* Archive / Topic Bank Modal/Card */}
      {showArchived && archivedTopics.length > 0 && (
        <div className="fixed bottom-20 right-6 z-50 animate-in slide-in-from-bottom-5">
          <Card className="w-80 shadow-2xl border-amber-200 overflow-hidden shadow-amber-200/20">
            <div className="bg-amber-50 px-4 py-2 border-b border-amber-100 flex items-center justify-between">
              <span className="text-[10px] font-bold text-amber-800 uppercase flex items-center gap-2">
                <Download className="h-3.5 w-3.5" />
                Topic Bank
              </span>
              <button 
                onClick={() => setShowArchived(false)}
                className="text-amber-800 hover:bg-amber-100 p-1 rounded"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-2 max-h-[400px] overflow-y-auto bg-white">
              {archivedTopics.map((topic) => (
                <button
                  key={topic.id}
                  onClick={() => {
                    const element = document.getElementById(`topic-${topic.id}`)
                    element?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                    setShowArchived(false)
                  }}
                  className="w-full text-left text-sm px-3 py-2 rounded hover:bg-amber-50 text-amber-900 border-b border-amber-50 last:border-0 transition-colors"
                >
                  <div className="font-medium truncate">{topic.title}</div>
                  <div className="text-[10px] text-amber-600/70 italic">Click to view in archive below</div>
                </button>
              ))}
            </div>
          </Card>
        </div>
      )}

      {sectionToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex items-center justify-center">
          <div className="bg-white border p-6 rounded-lg shadow-lg max-w-md w-full">
            <h2 className="text-xl font-bold mb-2">Delete Section?</h2>
            <p className="mb-4">
              <b>{sectionToDelete?.title || "this section"}</b>
            </p>
            <div className="flex gap-4 justify-end">
              <Button variant="outline" onClick={cancelDeleteSection}>
                Cancel
              </Button>
              <Button
                className="bg-red-600 text-white"
                onClick={confirmDeleteSection}
              >
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}

      {showRecorderModal && (
        <SelectRecorderModal
          isOpen={showRecorderModal}
          onClose={() => setShowRecorderModal(false)}
          attendees={(meeting.attendees as Attendee[]) || []}
          initialStartTime={meeting.start_time}
          initialChairPerson={meeting.chair_person}
          initialMinuteTaker={meeting.minute_taker}
          onConfirm={(recorderName, timekeeperName, actualStartTime, chairPerson, minuteTaker) => {
            updateMeetingStatus("working_minutes", recorderName, timekeeperName, actualStartTime, chairPerson, minuteTaker)
            setShowRecorderModal(false)
          }}
        />
      )}

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
          sectionId={selectedSection?.id || 0}
          sectionTitle={selectedSection?.title || ""}
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

      <UploadTranscriptModal
        isOpen={showUploadTranscript}
        onClose={() => setShowUploadTranscript(false)}
        meetingId={parseInt(meetingId)}
        onUploadSuccess={handleUploadSuccess}
      />

      <PreviewTasksModal
        isOpen={showPreviewTasks}
        onClose={() => setShowPreviewTasks(false)}
        transcriptId={transcriptId || 0}
        extractedTasks={extractedTasks}
        sections={sections}
        onTasksCreated={handleTasksCreated}
      />

      <ViewTranscriptsModal
        isOpen={showViewTranscripts}
        onClose={() => setShowViewTranscripts(false)}
        meetingId={parseInt(meetingId)}
      />

      {showUnifiedModal && selectedTopicForModal && (
        <UnifiedItemModal
          isOpen={showUnifiedModal}
          onClose={() => {
            setShowUnifiedModal(false)
          }}
          topicId={selectedTopicForModal}
          meetingId={meetingId}
          onSave={() => {
            // ✅ Trigger the refresh callback for this topic
            if (onTopicSave && selectedTopicForModal) {
              onTopicSave(selectedTopicForModal)
            }
          }}
          defaultTab={defaultTab}
        />
      )}

      {/* Floating Agenda Button for Mobile */}
      {!showSidebar && (
        <Button
          onClick={() => setShowSidebar(true)}
          className="lg:hidden fixed bottom-8 right-6 h-14 w-14 rounded-full shadow-2xl bg-primary text-primary-foreground z-40 flex items-center justify-center border-2 border-white dark:border-gray-800 transition-all hover:scale-105 active:scale-95"
          size="icon"
        >
          <FileText className="h-7 w-7" />
        </Button>
      )}
      </div>
    </>
  )
}
