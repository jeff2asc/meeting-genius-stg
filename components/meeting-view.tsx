"use client"

import React, { useState, useEffect, useRef } from "react"
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
  Wrench,
  AlertTriangle,
  RefreshCw,
  CornerDownRight,
} from "lucide-react"

import { UploadTranscriptModal } from "@/components/transcript/upload-transcript-modal"
import { PreviewTasksModal } from "@/components/transcript/preview-tasks-modal"
import { ViewTranscriptsModal } from "@/components/transcript/view-transcripts-modal"
import RolloverTopicModal from "./rollover-topic-modal"
import { getCurrentLocalDate } from "@/lib/timezone"
import { Clock as ClockIcon } from "lucide-react"

function CurrentTime() {
  const [time, setTime] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className="flex items-center gap-1.5 text-[10px] sm:text-xs font-medium text-muted-foreground bg-muted/30 px-2 py-1 rounded-md border border-border/50">
      <ClockIcon className="h-3 w-3 text-primary" />
      <span className="whitespace-nowrap font-bold">
        {time.toLocaleDateString([], { month: 'short', day: 'numeric' })}
      </span>
      <span className="opacity-20 font-light">|</span>
      <span className="whitespace-nowrap">
        {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </span>
    </div>
  )
}
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import TopicCard from "./topic-card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import Timer from "./timer"
import CreateSectionModal from "./create-section-modal"
import CreateTopicModal from "./create-topic-modal"
import EditMeetingModal from "./EditMeetingModal"
import AttendeeManagement, { Attendee } from "./AttendeeManagement"
import SelectRecorderModal from "./SelectRecorderModal"
import { supabase, getCurrentUser } from "@/lib/supabase"
import { apiClient } from "@/lib/api-client"
import { canEditMeeting, isReadOnly, isMaster as checkIsMaster } from "@/lib/permissions"
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd"
import UnifiedItemModal from "./UnifiedItemModal"
import { formatFloatingDate, formatFloatingTime, formatUtcToLocalLong } from "@/lib/timezone"
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
  // ⭐ NEW: Time allocation (minutes) for agenda PDF
  time_per_topic?: number | null
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
  const [browserTranscript, setBrowserTranscript] = useState("") 
  const [interimTranscript, setInterimTranscript] = useState("") 
  const transcriptRef = useRef("") // ⭐ The Black Box (Safe from re-renders)
  const [recognition, setRecognition] = useState<any>(null)
  const [showUnifiedModal, setShowUnifiedModal] = useState(false)
  const [selectedTopicForModal, setSelectedTopicForModal] = useState<number | null>(null)
  const [defaultTab, setDefaultTab] = useState<"task" | "note" | "decision">("task")
  const [initialDataForModal, setInitialDataForModal] = useState<{ description?: string; status?: string; budget?: string; cost?: string } | undefined>(undefined)
  const [activeSectionId, setActiveSectionId] = useState<number | null>(null)
  const [showRolloverModal, setShowRolloverModal] = useState(false)
  
  // ⭐ JANUS INTEGRATION STATES
  const [isJanusIntegrated, setIsJanusIntegrated] = useState(false)
  const [sidebarTab, setSidebarTab] = useState<"agenda" | "repairs" | "complaints">("agenda")
  const [janusData, setJanusData] = useState<{ repairs: any[], complaints: any[] }>({ repairs: [], complaints: [] })
  const [isResyncing, setIsResyncing] = useState(false)

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

  // ⭐ NEW: Fetch Janus Data
  const fetchJanusData = async (forceResync = false) => {
    if (!currentUser) return
    
    // ✅ Check Database: Is Janus integrated for this company?
    let isIntegrated = false
    const companyId = meeting?.buildings?.company_id || currentUser.company_id
    
    if (companyId) {
      const adminClient = supabase
      const { data: company } = await adminClient
        .from('companies')
        .select('janus_integrated')
        .eq('id', companyId)
        .single()
      
      isIntegrated = !!company?.janus_integrated
    }

    // Fallback to localStorage
    if (!isIntegrated) {
      const storageKey = `mg_integrations_${currentUser.id}`
      const installed = typeof window !== 'undefined' ? localStorage.getItem(storageKey) : null
      isIntegrated = installed ? JSON.parse(installed).includes("janus") : false
    }

    setIsJanusIntegrated(isIntegrated)
    
    if (!isIntegrated) return

    if (forceResync) setIsResyncing(true)
    
    try {
      const documentedSecret = process.env.NEXT_PUBLIC_API_KEY || ""
      const companyParam = currentUser?.id ? `?user_id=${currentUser.id}` : ""
      const res = await fetch(`${window.location.origin}/api/janus/v1/sync${companyParam}`, {
        headers: { "x-api-key": documentedSecret }
      })
      if (!res.ok) throw new Error("Could not fetch Janus data")
      
      const payload = await res.json()
      
      // ⭐ FILTER BY BUILDING AND STATUS
      const buildingId = meeting?.building_id
      const buildingName = meeting?.buildings?.name?.toLowerCase()
      const companyId = meeting?.buildings?.company_id
      const currentUser = getCurrentUser()
      const isMaster = currentUser ? checkIsMaster(currentUser) : false
      
      const filteredRepairs = (payload.data.repairs || []).filter((r: any) => {
        if (isMaster) return true;
        
        // 1. MUST match company if both have it
        if (companyId && r.company_id && String(r.company_id) !== String(companyId)) return false;

        // 2. Match building
        const rBuildingName = r.building_name?.toLowerCase() || ""
        const matchesBuildingId = (buildingId && String(r.building_id) === String(buildingId))
        const matchesBuildingName = (buildingName && rBuildingName && rBuildingName.includes(buildingName))
        
        return matchesBuildingId || matchesBuildingName
      })

      const filteredComplaints = (payload.data.complaints || []).filter((c: any) => {
        if (isMaster) return true;
        
        // 1. MUST match company if both have it
        if (companyId && c.company_id && String(c.company_id) !== String(companyId)) return false;

        // 2. Match building
        const cBuildingName = c.building_name?.toLowerCase() || ""
        const matchesBuildingId = (buildingId && String(c.building_id) === String(buildingId))
        const matchesBuildingName = (buildingName && cBuildingName && cBuildingName.includes(buildingName))
        
        return matchesBuildingId || matchesBuildingName
      })

      setJanusData({
        repairs: filteredRepairs,
        complaints: filteredComplaints
      })
      
      if (forceResync) {
        toast.success("Data resynced from Janus", {
          description: "Latest repairs and complaints have been updated."
        })
      }
    } catch (err) {
      // Janus is an optional integration — silently ignore errors unless user triggered a manual resync
      if (forceResync) {
        console.error("Janus fetch error:", err)
        toast.error("Failed to resync data from Janus")
      }
    } finally {
      setIsResyncing(false)
    }
  }

  // ⭐ AUTO-SYNC: Run when building is loaded and then every 30 seconds
  useEffect(() => {
    if (meeting?.building_id) {
      fetchJanusData()
    }
    
    const heartbeat = setInterval(() => {
      if (meeting?.building_id) {
        fetchJanusData()
      }
    }, 30000)

    return () => clearInterval(heartbeat)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meeting?.building_id])

  const fetchOpenTasksFromPreviousMeetings = async () => {
    if (!meeting) return []

    try {
      const adminClient = supabase
      const { data: allMeetings, error: meetingsError } = await adminClient
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

      const { data: allTopics, error: topicsError } = await adminClient
        .from("topics")
        .select("id, title, meeting_id")
        .in("meeting_id", meetingIds)

      if (topicsError || !allTopics) {
        console.error("Error fetching topics:", topicsError)
        return []
      }

      const topicIds = allTopics.map((t) => t.id)

      const { data: openTasks, error: tasksError } = await adminClient
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

      const archived = (topicsData || []).filter((t: any) => t.is_archived)
      const visibleTopics = (topicsData || []).filter((t: any) => !t.is_archived)

      let taskCounts: any[] = []
      let attachmentCounts: any[] = []
      let sectionAttachments: any[] = []

      if (visibleTopics.length > 0) {
        const topicIds = visibleTopics.map((t: any) => t.id)
        const adminClient = supabase

        try {
          const { data: tc, error: tcError } = await adminClient
            .from("tasks")
            .select("topic_id")
            .in("topic_id", topicIds)

          if (tcError) {
            console.error("Task counts query failed:", tcError)
          } else {
            taskCounts = tc || []
          }
        } catch (err) {
          console.error("Task counts query crashed:", err)
        }

        try {
          const { data: ac, error: acError } = await adminClient
            .from("topic_attachments")
            .select("topic_id")
            .in("topic_id", topicIds)

          if (acError) {
            console.error("Topic attachments query failed:", acError)
          } else {
            attachmentCounts = ac || []
          }
        } catch (err) {
          console.error("Topic attachments query crashed:", err)
        }
      }

      if ((sectionsData || []).length > 0) {
        const sectionIds = (sectionsData || []).map((s: any) => s.id)
        const adminClient = supabase

        try {
          const { data: sa, error: saError } = await adminClient
            .from("section_attachments")
            .select("*")
            .in("section_id", sectionIds)

          if (saError) {
            console.error("Section attachments query failed:", saError)
          } else {
            sectionAttachments = sa || []
          }
        } catch (err) {
          console.error("Section attachments query crashed:", err)
        }
      }

      const mapTopic = (t: any): Topic => ({
        ...t,
        tasks: taskCounts.filter(tc => tc.topic_id === t.id).length || 0,
        decisions: t.decisions?.[0]?.count || 0,
        attachments: attachmentCounts.filter(ac => ac.topic_id === t.id).length || 0,
      })

      // Build all sections (including empty ones so newly-created meetings show their structure)
      const builtSections: Section[] = (sectionsData || []).map((section: any) => ({
        ...section,
        isExpanded: expandedStates[section.id] ?? true,
        attachments: sectionAttachments.filter(sa => sa.section_id === section.id),
        topics: visibleTopics
          .filter((t: any) => t.section_id === section.id)
          .map(mapTopic),
      }))

      // Topics not assigned to any section
      const unsectionedTopics: Topic[] = visibleTopics
        .filter((t: any) => t.section_id == null)
        .map(mapTopic)

      // Show all sections if any exist; otherwise group unsectioned topics under a fallback section
      const finalSections: Section[] =
        builtSections.length > 0
          ? builtSections
          : unsectionedTopics.length > 0
          ? [
              {
                id: -1,
                title: "Agenda Items",
                order_index: 0,
                topics: unsectionedTopics,
                attachments: [],
                isExpanded: expandedStates[-1] ?? true,
              },
            ]
          : []

      setSections(finalSections)
      setArchivedTopics(archived)
    } catch (err) {
      console.error("Unexpected error fetching sections/topics:", err)
      setSections([])
      setArchivedTopics([])
    }
  }

  const checkForTranscripts = async () => {
    try {
      const adminClient = supabase
      const { data, error } = await adminClient
        .from("meeting_transcripts")
        .select("id")
        .eq("meeting_id", parseInt(meetingId))
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
      const adminClient = supabase
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

      const { data: userData } = await adminClient.auth.getUser()
      const userId = userData.user?.id

      const { error: dbError } = await adminClient
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
      const adminClient = supabase
      const { error } = await adminClient
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
    chairPerson?: string | null
  ) => {
    try {
      setLoading(true)

      const updateData: any = {}

      if (targetStatus === "working_minutes" && recorderName) {
        updateData.recorder_name = recorderName
        updateData.timekeeper_name = timekeeperName
        updateData.start_time = actualStartTime
        updateData.chair_person = chairPerson
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

    // 🎙️ Setup Browser Speech Recognition Fallback
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (SpeechRecognition) {
      const rec = new SpeechRecognition()
      rec.continuous = true
      rec.interimResults = true
      rec.lang = 'en-US'
      rec.maxAlternatives = 1 // ⭐ Simple setting for Brave
      
      rec.onresult = (event: any) => {
        let final = ""
        let interim = ""
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            final += event.results[i][0].transcript + " "
          } else {
            interim += event.results[i][0].transcript
          }
        }
        transcriptRef.current += final // ⭐ Lock it into the Ref
        setBrowserTranscript(prev => prev + final)
        setInterimTranscript(interim)
      }

      rec.onerror = (event: any) => {
        console.error("Speech Recognition Error:", event.error)
        if (event.error === 'network') {
           toast.error("Brave blocked speech recognition. Check brave://settings/shields")
        }
      }

      rec.start()
      setRecognition(rec)
    }

    setIsRecording(true)
    setElapsedTime(0)
    setBrowserTranscript("")
    setInterimTranscript("")
    transcriptRef.current = "" // ⭐ Clear the box for the new meeting
    const interval = setInterval(() => setElapsedTime((prev) => prev + 1), 1000)
    setTimerInterval(interval)
  }

  const handleStopRecording = () => {
    setIsRecording(false)
    if (timerInterval) {
      clearInterval(timerInterval)
      setTimerInterval(null)
    }
    if (recognition) {
      recognition.stop()
      setRecognition(null)
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

      // 🎙️ Capture the Live Transcript and add the Speaker Name
      const rawText = (transcriptRef.current + " " + interimTranscript).trim()
      const speakerName = currentUser?.name || "Attendee"
      const fullBrowserText = rawText ? `${speakerName}: ${rawText}` : null

      console.log("💾 Saving everything to database...")
      
      const { data: updateResult, error: updateError } = await supabase
        .from("meetings")
        .update({
          audio_filename: filename,
          audio_file: { url: publicUrl, path: filePath },
          audio_duration: duration,
          recording_ended_at: new Date().toISOString(),
          status: "minutes",
          meeting_transcript: fullBrowserText // ⭐ Now includes speaker name!
        })
        .eq("id", parseInt(meetingId))
        .select()
        .single()

      if (updateError) {
        console.error("❌ Database update error:", updateError)
        alert(`Failed to save: ${updateError.message}`)
        return
      }

      console.log("✅ Meeting and Transcript saved successfully!")
      if (fullBrowserText) {
        toast.success("Transcript captured successfully!")
        setHasTranscript(true)
      }

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

  const formatDate = (dateString: string) => formatFloatingDate(dateString, "long")

  const formatTime = (timeString: string) => formatFloatingTime(timeString)

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
          'x-api-key': process.env.NEXT_PUBLIC_API_KEY || ''
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

  const handlePushToTask = (topicId: number, data: { description: string }) => {
    setSelectedTopicForModal(topicId)
    setInitialDataForModal({ description: data.description })
    setDefaultTab('task')
    setShowUnifiedModal(true)
  }

  const handlePushAsTopic = async (item: any, sectionId: number) => {
    if (!userCanEdit) return
    
    try {
      setLoading(true)
      // Get the highest order_index for this section
      const { data: existingTopics } = await supabase
        .from('topics')
        .select('order_index')
        .eq('section_id', sectionId)
        .order('order_index', { ascending: false })
        .limit(1)

      const nextOrderIndex = existingTopics && existingTopics.length > 0
        ? existingTopics[0].order_index + 1
        : 1

      let description = item.description || ""
      if (item.budget || item.estimated_cost) {
        description += "\n\nFinancial Context:"
        if (item.budget) description += `\n- Budget Allocation: ${item.budget}`
        if (item.estimated_cost) description += `\n- Estimated Repair Cost: ${item.estimated_cost}`
        if (item.quoted_amount) description += `\n- Quoted Amount: ${item.quoted_amount}`
      }

      const { data: newTopic, error: insertError } = await supabase
        .from('topics')
        .insert({
          meeting_id: parseInt(meetingId),
          section_id: sectionId,
          title: item.title,
          description: description || null,
          order_index: nextOrderIndex,
          created_by_name: currentUser?.name || "User"
        })
        .select()
        .single()

      if (insertError) throw insertError

      toast.success(`Created new topic: ${item.title}`)
      await fetchSectionsAndTopics()
    } catch (err: any) {
      console.error("Error pushing as topic:", err)
      toast.error(`Failed to create topic: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleAutoImportHighPriority = async () => {
    if (!userCanEdit || sections.length === 0) return
    
    const highPriorityItems = [
      ...janusData.repairs.filter(r => r.priority === "High"),
      ...janusData.complaints.filter(c => c.priority === "High")
    ]

    if (highPriorityItems.length === 0) {
      toast.info("No high priority items to import.")
      return
    }

    if (!confirm(`Import ${highPriorityItems.length} high priority items into the first section?`)) return

    const targetSectionId = sections[0].id
    
    try {
      setLoading(true)
      for (const item of highPriorityItems) {
        // Simple sequential import for now to keep order_index correct
        // In a real app, we might want to batch this
        await handlePushAsTopic(item, targetSectionId)
      }
      toast.success("Successfully imported high priority items.")
    } catch (err) {
      console.error("Auto-import error:", err)
      toast.error("Some items failed to import.")
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

  const attendeeCount = ((meeting.attendees as Attendee[]) || []).length
  const presentCount = ((meeting.attendees as Attendee[]) || []).filter(
    (a) => a.present
  ).length;

  return (
    <>
      <div className="flex flex-col h-screen overflow-hidden bg-background">
      <header className="border-b border-border bg-card shadow-sm sticky top-0 z-40 flex-shrink-0">
        <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 mb-2 sm:mb-3">
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleBackClick}
                className="hover:bg-muted h-8 w-8"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>

              <Button
                variant="default"
                size="icon"
                onClick={() => setShowSidebar(!showSidebar)}
                className={`h-8 w-8 sm:h-9 sm:w-9 rounded-full transition-all ${
                  showSidebar 
                    ? 'bg-primary text-primary-foreground shadow-md' 
                    : 'bg-primary text-primary-foreground shadow-lg hover:bg-primary/90'
                }`}
                title={showSidebar ? "Hide Sidebar" : "Show Sidebar"}
              >
                <FileText className="h-4 w-4 sm:h-5 sm:w-5" />
              </Button>
              <CurrentTime />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2 min-w-0">
                  <h1 className="text-sm sm:text-lg font-bold text-foreground truncate">
                    {meeting.title}
                  </h1>
                  {meeting.is_incamera && meeting.status === "working_minutes" && (
                    <Badge
                      variant="outline"
                      className="bg-red-100 text-red-700 border-red-300 flex-shrink-0 text-[9px] sm:text-[10px] h-4 sm:h-5 px-1 sm:px-2"
                    >
                      <Lock className="h-2 w-2 sm:h-2.5 sm:w-2.5 mr-0.5 sm:mr-1" />
                      <span className="hidden xs:inline">IN-CAMERA</span>
                    </Badge>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={`${getStatusColor(
                      meeting.status
                    )} flex-shrink-0 text-[9px] sm:text-[10px] h-4 sm:h-5 px-1 sm:px-2`}
                  >
                    {getStatusText(meeting.status)}
                  </Badge>

                  {userCanEdit && meeting.status === "working_agenda" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setShowEditMeetingModal(true)}
                      className="hover:bg-muted border border-blue-500 h-4 w-4 sm:h-5 sm:w-5 p-0 flex-shrink-0"
                      title="Edit Meeting"
                    >
                      <Edit2 className="h-2 w-2 sm:h-2.5 sm:w-2.5" />
                    </Button>
                  )}
                  
                  <span className="text-[9px] sm:text-xs text-muted-foreground truncate font-medium">
                    {meeting.building}
                  </span>
                </div>
              </div>
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

          <div className="flex overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide gap-1.5 items-center">
            {userCanEdit && meeting.status === "working_minutes" && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleMeetingIncameraToggle}
                className={`h-8 px-2.5 text-xs flex-shrink-0 rounded-lg ${meeting.is_incamera
                  ? "bg-red-50 border-red-300 text-red-700"
                  : "bg-white dark:bg-card border-border"
                  }`}
              >
                {meeting.is_incamera ? (
                  <>
                    <Unlock className="h-3.5 w-3.5" />
                    <span className="ml-1.5">Remove In-Camera</span>
                  </>
                ) : (
                  <>
                    <Lock className="h-3.5 w-3.5" />
                    <span className="ml-1.5">In-Camera</span>
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
                className="h-8 px-2.5 text-xs flex-shrink-0 bg-gray-50 border-gray-300 dark:bg-muted dark:border-border"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                <span className="ml-1">Back</span>
              </Button>
            )}

            {/* Start button */}
            {userCanEdit && meeting.status === "working_agenda" && (
              <Button
                size="sm"
                onClick={() => setShowRecorderModal(true)}
                className="h-8 px-3 text-xs flex-shrink-0 bg-green-600 text-white hover:bg-green-700 shadow-sm rounded-lg"
              >
                <Play className="h-3.5 w-3.5 mr-1.5" />
                Start
              </Button>
            )}

            {/* End button */}
            {userCanEdit && meeting.status === "working_minutes" && (
              <Button
                size="sm"
                onClick={() => updateMeetingStatus("minutes")}
                className="h-8 px-3 text-xs flex-shrink-0 bg-green-600 text-white hover:bg-green-700 shadow-sm rounded-lg"
              >
                <CheckCircle className="h-3.5 w-3.5 mr-1.5" />
                End
              </Button>
            )}

            {userCanEdit &&
              (meeting.status === "working_agenda" ||
                meeting.status === "working_minutes") && (
                <Button
                  size="sm"
                  onClick={handleCreateSection}
                  variant="outline"
                  className="h-8 px-2.5 text-xs flex-shrink-0 border-primary text-primary bg-primary/5 hover:bg-primary/10 rounded-lg"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Section
                </Button>
              )}

            {userCanEdit &&
              (meeting.status === "working_agenda" ||
                meeting.status === "agenda") && (
                <Button
                  size="sm"
                  onClick={handleSendNotice}
                  variant="outline"
                  className="h-8 px-2.5 text-xs flex-shrink-0 border-blue-500 text-blue-600 hover:bg-blue-50 rounded-lg"
                >
                  <Mail className="h-3.5 w-3.5 mr-1" />
                  Notice
                </Button>
              )}

            {/* Upload Transcript button */}
            {userCanEdit && meeting.status === "working_minutes" && (
              <Button
                size="sm"
                onClick={() => setShowUploadTranscript(true)}
                variant="outline"
                className="h-8 px-2.5 text-xs flex-shrink-0 border-purple-500 text-purple-600 hover:bg-purple-50 rounded-lg"
              >
                <FileUp className="h-3.5 w-3.5 mr-1" />
                Transcript
              </Button>
            )}

            {/* View Transcripts button */}
            {(meeting.status === "working_minutes" || meeting.status === "minutes") && (
              <Button
                size="sm"
                onClick={() => setShowViewTranscripts(true)}
                variant="outline"
                className="h-8 px-2.5 text-xs flex-shrink-0 border-primary/50 text-primary hover:bg-primary/5 rounded-lg"
              >
                <FileText className="h-3.5 w-3.5 mr-1" />
                Transcripts
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
                className={`h-8 px-2.5 text-xs flex-shrink-0 border-amber-500 text-amber-700 hover:bg-amber-50 rounded-lg ${
                  showArchived ? "bg-amber-100" : ""
                }`}
              >
                <Archive className="h-3.5 w-3.5 mr-1" />
                Archive ({archivedTopics.length})
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
                      className="h-8 px-3 text-xs whitespace-nowrap flex-shrink-0 border-blue-500 text-blue-600 hover:bg-blue-50 disabled:opacity-50 rounded-lg"
                    >
                      <Download className="h-3.5 w-3.5 mr-1" />
                      {downloadingAudio ? "Wait..." : "Audio"}
                    </Button>
                  )}
              </>
            )}

            {isMounted && isRecording && (
              <div className="flex items-center gap-3">
                <Timer
                  elapsedTime={elapsedTime}
                  isRecording={isRecording}
                  meetingId={meetingId}
                  onRecordingComplete={handleRecordingComplete}
                />
                <div className="hidden sm:flex flex-col max-w-[200px] border-l border-border pl-3">
                   <span className="text-[10px] font-bold text-red-500 animate-pulse">LIVE TRANSCRIPT</span>
                   <span className="text-[10px] text-muted-foreground truncate italic">
                      {interimTranscript || browserTranscript.slice(-30) || "Listening..."}
                   </span>
                </div>
              </div>
            )}

            {/* Record/Stop button */}
            {isMounted && userCanEdit && meeting.status === "working_minutes" && (
              <>
                {uploadingRecording ? (
                  <Button
                    size="sm"
                    disabled
                    className="h-8 px-2.5 text-xs flex-shrink-0 bg-blue-500 text-white rounded-lg"
                  >
                    <span className="h-2 w-2 rounded-full bg-white mr-1.5 animate-pulse"></span>
                    Up...
                  </Button>
                ) : !isRecording ? (
                  <Button
                    size="sm"
                    onClick={handleStartRecording}
                    className="h-8 px-2.5 text-xs flex-shrink-0 bg-red-500 hover:bg-red-600 text-white shadow-sm rounded-lg"
                  >
                    <span className="h-2 w-2 rounded-full bg-white mr-1.5"></span>
                    Record
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    onClick={handleStopRecording}
                    variant="outline"
                    className="h-8 px-2.5 text-xs flex-shrink-0 border-red-500 text-red-500 bg-red-50 rounded-lg"
                  >
                    <span className="h-2 w-2 rounded-sm bg-red-500 mr-1.5"></span>
                    Stop
                  </Button>
                )}
              </>
            )}
          </div>

          <div className="flex overflow-x-auto scrollbar-hide items-center gap-3 text-[10px] sm:text-xs text-muted-foreground mt-2 pt-2 border-t border-border -mx-1 px-1">
            {meeting.meeting_type && (
              <div className="flex items-center gap-1 flex-shrink-0">
                <FileText className="h-3 w-3" />
                <span>{meeting.meeting_type}</span>
              </div>
            )}
            {meeting.meeting_date && (
              <div className="flex items-center gap-1 flex-shrink-0">
                <Calendar className="h-3 w-3" />
                <span>{formatDate(meeting.meeting_date)}</span>
              </div>
            )}
            {meeting.start_time && (
              <div className="flex items-center gap-1 flex-shrink-0">
                <Clock className="h-3 w-3" />
                <span>{formatTime(meeting.start_time)}</span>
              </div>
            )}
            {meeting.location && (
              <div className="flex items-center gap-1 flex-shrink-0">
                <MapPin className="h-3 w-3" />
                <span className="truncate max-w-[120px]">{meeting.location}</span>
              </div>
            )}
            {meeting.strata_plan_number && (
              <div className="flex items-center gap-1 flex-shrink-0">
                <FileText className="h-3 w-3" />
                <span>Plan: {meeting.strata_plan_number}</span>
              </div>
            )}
            {meeting.status === "working_minutes" &&
              (meeting.recorder_name || meeting.chair_person || meeting.minute_taker || meeting.timekeeper_name) && (
                <div className="flex items-center gap-2 flex-shrink-0">
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
              <div className="flex flex-col mb-4 border-b border-border pb-2">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-bold text-primary flex items-center gap-2">
                    {sidebarTab === "agenda" && <FileText className="h-4 w-4" />}
                    {sidebarTab === "repairs" && <Wrench className="h-4 w-4" />}
                    {sidebarTab === "complaints" && <AlertTriangle className="h-4 w-4" />}
                    {sidebarTab === "agenda" ? "AGENDA OUTLINE" : sidebarTab.toUpperCase()}
                  </h3>
                  <div className="flex items-center gap-1">
                    {sidebarTab === "agenda" && userCanEdit && (meeting.status === "working_agenda" || meeting.status === "working_minutes") && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setShowRolloverModal(true)}
                        className="h-7 px-2 text-[10px] text-primary hover:bg-primary/5 flex items-center gap-1 font-bold"
                      >
                        <RefreshCw className="h-3 w-3" />
                        Import
                      </Button>
                    )}
                    <button
                      onClick={() => setShowSidebar(false)}
                      className="h-7 w-7 flex items-center justify-center rounded-full hover:bg-muted text-muted-foreground text-xl font-light"
                    >
                      ×
                    </button>
                  </div>
                </div>
                
                {isJanusIntegrated && (janusData.repairs.length > 0 || janusData.complaints.length > 0) && (
                  <div className="flex gap-1 p-0.5 bg-muted rounded-lg">
                    <button
                      onClick={() => setSidebarTab("agenda")}
                      className={`flex-1 text-[10px] py-1 rounded-md transition-all ${sidebarTab === "agenda" ? "bg-white shadow-sm font-bold text-primary" : "text-muted-foreground hover:bg-white/50"}`}
                    >
                      Agenda
                    </button>
                    {janusData.repairs.length > 0 && (
                      <button
                        onClick={() => setSidebarTab("repairs")}
                        className={`flex-1 text-[10px] py-1 rounded-md transition-all ${sidebarTab === "repairs" ? "bg-white shadow-sm font-bold text-primary" : "text-muted-foreground hover:bg-white/50"}`}
                      >
                        Repairs
                      </button>
                    )}
                    {janusData.complaints.length > 0 && (
                      <button
                        onClick={() => setSidebarTab("complaints")}
                        className={`flex-1 text-[10px] py-1 rounded-md transition-all ${sidebarTab === "complaints" ? "bg-white shadow-sm font-bold text-primary" : "text-muted-foreground hover:bg-white/50"}`}
                      >
                        Complaints
                      </button>
                    )}
                  </div>
                )}
              </div>
              
              {sidebarTab === "agenda" ? (
                sections.length === 0 ? (
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
                )
              ) : sidebarTab === "repairs" ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-6 bg-red-100 rounded-md flex items-center justify-center">
                        <Wrench className="h-3.5 w-3.5 text-red-600" />
                      </div>
                      <span className="text-[10px] font-black text-foreground uppercase tracking-wider">Active Repairs</span>
                    </div>
                    {userCanEdit && (janusData.repairs.length > 0 || janusData.complaints.length > 0) && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-6 px-2 text-[8px] font-bold border-red-200 text-red-700 hover:bg-red-50"
                        onClick={handleAutoImportHighPriority}
                        title="Auto-import High Priority items to Agenda"
                      >
                        Auto-Agenda
                      </Button>
                    )}
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-6 w-6" 
                      onClick={() => fetchJanusData(true)}
                      disabled={isResyncing}
                    >
                      <RefreshCw className={`h-3 w-3 ${isResyncing ? "animate-spin" : ""}`} />
                    </Button>
                  </div>
                  {janusData.repairs.length === 0 ? (
                    <div className="text-center py-8 bg-muted/20 rounded-xl border border-dashed border-border">
                      <Wrench className="h-8 w-8 text-muted-foreground/20 mx-auto mb-2" />
                      <p className="text-xs text-muted-foreground">No active repairs found.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {janusData.repairs.map(repair => (
                        <div key={repair.id} className="p-3 bg-white dark:bg-card border-l-4 border-l-red-500 border border-border rounded-lg shadow-sm hover:shadow-md transition-all">
                          <div className="flex items-start justify-between mb-1.5">
                            <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${
                              repair.priority === "High" ? "bg-red-100 text-red-700" : 
                              repair.priority === "Medium" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"
                            }`}>
                              {repair.priority}
                            </span>
                            <Badge variant="outline" className="text-[8px] h-4 border-muted-foreground/20">{repair.status}</Badge>
                          </div>
                          <h4 className="text-xs font-bold leading-tight mb-1 text-foreground">{repair.title}</h4>
                          {(repair.budget || repair.estimated_cost) && (
                            <div className="flex gap-2 mt-1 mb-1">
                              {repair.budget && (
                                <span className="text-[8px] bg-green-50 text-green-700 px-1 py-0.5 rounded border border-green-100">
                                  Bud: {repair.budget}
                                </span>
                              )}
                              {repair.estimated_cost && (
                                <span className="text-[8px] bg-blue-50 text-blue-700 px-1 py-0.5 rounded border border-blue-100">
                                  Est: {repair.estimated_cost}
                                </span>
                              )}
                            </div>
                          )}
                          <div className="flex items-center justify-between mt-2">
                            <p className="text-[9px] text-muted-foreground flex items-center gap-1">
                              <Calendar className="h-2.5 w-2.5" />
                              {new Date(repair.created_at).toLocaleDateString()}
                            </p>
                            {userCanEdit && sections.length > 0 && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-6 w-6 text-primary hover:bg-primary/10">
                                    <CornerDownRight className="h-3.5 w-3.5" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-56">
                                  <DropdownMenuLabel>Push to Agenda</DropdownMenuLabel>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuLabel className="text-[10px] font-normal text-muted-foreground">AS NEW TOPIC</DropdownMenuLabel>
                                  <div className="max-h-40 overflow-y-auto">
                                    {sections.map(s => (
                                      <DropdownMenuItem key={s.id} onClick={() => handlePushAsTopic(repair, s.id)}>
                                        <Plus className="h-3 w-3 mr-2" />
                                        <span className="truncate">Add to "{s.title}"</span>
                                      </DropdownMenuItem>
                                    ))}
                                  </div>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuLabel className="text-[10px] font-normal text-muted-foreground">AS TASK IN TOPIC</DropdownMenuLabel>
                                  <div className="max-h-60 overflow-y-auto">
                                    {sections.flatMap(s => s.topics).map(t => (
                                      <DropdownMenuItem key={t.id} onClick={() => handlePushToTask(t.id, { description: `Repair: ${repair.title}` })}>
                                        <span className="truncate">{t.title}</span>
                                      </DropdownMenuItem>
                                    ))}
                                  </div>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-6 bg-amber-100 rounded-md flex items-center justify-center">
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                      </div>
                      <span className="text-[10px] font-black text-foreground uppercase tracking-wider">Open Complaints</span>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-6 w-6" 
                      onClick={() => fetchJanusData(true)}
                      disabled={isResyncing}
                    >
                      <RefreshCw className={`h-3 w-3 ${isResyncing ? "animate-spin" : ""}`} />
                    </Button>
                  </div>
                  {janusData.complaints.length === 0 ? (
                    <div className="text-center py-8 bg-muted/20 rounded-xl border border-dashed border-border">
                      <AlertTriangle className="h-8 w-8 text-muted-foreground/20 mx-auto mb-2" />
                      <p className="text-xs text-muted-foreground">No active complaints found.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {janusData.complaints.map(complaint => (
                        <div key={complaint.id} className="p-3 bg-white dark:bg-card border-l-4 border-l-amber-500 border border-border rounded-lg shadow-sm hover:shadow-md transition-all">
                          <div className="flex items-start justify-between mb-1.5">
                            <Badge className="text-[8px] h-4 bg-amber-100 text-amber-700 border-0">
                              {complaint.status}
                            </Badge>
                          </div>
                          <h4 className="text-xs font-bold leading-tight mb-1 text-foreground">{complaint.title}</h4>
                          {(complaint.budget || complaint.estimated_cost) && (
                            <div className="flex gap-2 mt-1 mb-1">
                              {complaint.budget && (
                                <span className="text-[8px] bg-green-50 text-green-700 px-1 py-0.5 rounded border border-green-100">
                                  Bud: {complaint.budget}
                                </span>
                              )}
                              {complaint.estimated_cost && (
                                <span className="text-[8px] bg-blue-50 text-blue-700 px-1 py-0.5 rounded border border-blue-100">
                                  Est: {complaint.estimated_cost}
                                </span>
                              )}
                            </div>
                          )}
                          <p className="text-[10px] text-muted-foreground line-clamp-2 italic mb-1 bg-muted/30 p-1.5 rounded">"{complaint.description}"</p>
                          <div className="flex items-center justify-between mt-2">
                            <p className="text-[9px] text-muted-foreground flex items-center gap-1 mt-1">
                              <Calendar className="h-2.5 w-2.5" />
                              {new Date(complaint.created_at).toLocaleDateString()}
                            </p>
                            {userCanEdit && sections.length > 0 && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-6 w-6 text-primary hover:bg-primary/10">
                                    <CornerDownRight className="h-3.5 w-3.5" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-56">
                                  <DropdownMenuLabel>Push to Agenda</DropdownMenuLabel>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuLabel className="text-[10px] font-normal text-muted-foreground">AS NEW TOPIC</DropdownMenuLabel>
                                  <div className="max-h-40 overflow-y-auto">
                                    {sections.map(s => (
                                      <DropdownMenuItem key={s.id} onClick={() => handlePushAsTopic(complaint, s.id)}>
                                        <Plus className="h-3 w-3 mr-2" />
                                        <span className="truncate">Add to "{s.title}"</span>
                                      </DropdownMenuItem>
                                    ))}
                                  </div>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuLabel className="text-[10px] font-normal text-muted-foreground">AS TASK IN TOPIC</DropdownMenuLabel>
                                  <div className="max-h-60 overflow-y-auto">
                                    {sections.flatMap(s => s.topics).map(t => (
                                      <DropdownMenuItem key={t.id} onClick={() => handlePushToTask(t.id, { 
                                        description: `Complaint: ${complaint.title}\n\n${complaint.description}` 
                                      })}>
                                        <span className="truncate">{t.title}</span>
                                      </DropdownMenuItem>
                                    ))}
                                  </div>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </aside>
          </div>
        )}

        {/* ── DESKTOP: Side Panel ── */}
        {showSidebar && (
          <aside className="hidden lg:flex w-64 border-r border-border bg-background flex-col shrink-0 h-full overflow-y-auto px-4 pt-2 pb-4 transition-all duration-300 shadow-sm">
            <div className="flex flex-col mb-4 border-b border-border pb-2">
              <div className="flex items-center gap-2 mb-3">
                <h3 className="text-sm font-bold text-primary flex items-center gap-2">
                  {sidebarTab === "agenda" && <FileText className="h-4 w-4" />}
                  {sidebarTab === "repairs" && <Wrench className="h-4 w-4" />}
                  {sidebarTab === "complaints" && <AlertTriangle className="h-4 w-4" />}
                  {sidebarTab === "agenda" ? "AGENDA OUTLINE" : sidebarTab.toUpperCase()}
                </h3>
                {sidebarTab === "agenda" && userCanEdit && (meeting.status === "working_agenda" || meeting.status === "working_minutes") && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowRolloverModal(true)}
                    className="ml-auto h-7 px-2 text-[10px] text-primary hover:bg-primary/5 flex items-center gap-1 font-bold"
                  >
                    <RefreshCw className="h-3 w-3" />
                    Import
                  </Button>
                )}
              </div>
              
              {isJanusIntegrated && (janusData.repairs.length > 0 || janusData.complaints.length > 0) && (
                <div className="flex gap-1 p-0.5 bg-muted rounded-lg">
                  <button
                    onClick={() => setSidebarTab("agenda")}
                    className={`flex-1 text-[10px] py-1 rounded-md transition-all ${sidebarTab === "agenda" ? "bg-white shadow-sm font-bold text-primary" : "text-muted-foreground hover:bg-white/50"}`}
                  >
                    Agenda
                  </button>
                  {janusData.repairs.length > 0 && (
                    <button
                      onClick={() => setSidebarTab("repairs")}
                      className={`flex-1 text-[10px] py-1 rounded-md transition-all ${sidebarTab === "repairs" ? "bg-white shadow-sm font-bold text-primary" : "text-muted-foreground hover:bg-white/50"}`}
                    >
                      Repairs
                    </button>
                  )}
                  {janusData.complaints.length > 0 && (
                    <button
                      onClick={() => setSidebarTab("complaints")}
                      className={`flex-1 text-[10px] py-1 rounded-md transition-all ${sidebarTab === "complaints" ? "bg-white shadow-sm font-bold text-primary" : "text-muted-foreground hover:bg-white/50"}`}
                    >
                      Complaints
                    </button>
                  )}
                </div>
              )}
            </div>
            
            {sidebarTab === "agenda" ? (
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
            ) : sidebarTab === "repairs" ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-6 bg-red-100 rounded-md flex items-center justify-center">
                      <Wrench className="h-3.5 w-3.5 text-red-600" />
                    </div>
                    <span className="text-[10px] font-black text-foreground uppercase tracking-wider">Active Repairs</span>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-6 w-6" 
                    onClick={() => fetchJanusData(true)}
                    disabled={isResyncing}
                  >
                    <RefreshCw className={`h-3 w-3 ${isResyncing ? "animate-spin" : ""}`} />
                  </Button>
                </div>
                {janusData.repairs.length === 0 ? (
                  <div className="text-center py-8 bg-muted/20 rounded-xl border border-dashed border-border">
                    <Wrench className="h-8 w-8 text-muted-foreground/20 mx-auto mb-2" />
                    <p className="text-xs text-muted-foreground">No active repairs found.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {janusData.repairs.map(repair => (
                      <div key={repair.id} className="p-3 bg-white dark:bg-card border-l-4 border-l-red-500 border border-border rounded-lg shadow-sm hover:shadow-md transition-all">
                        <div className="flex items-start justify-between mb-1.5">
                          <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${
                            repair.priority === "High" ? "bg-red-100 text-red-700" : 
                            repair.priority === "Medium" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"
                          }`}>
                            {repair.priority}
                          </span>
                          <Badge variant="outline" className="text-[8px] h-4 border-muted-foreground/20">{repair.status}</Badge>
                        </div>
                        <h4 className="text-xs font-bold leading-tight mb-1 text-foreground">{repair.title}</h4>
                        <div className="flex items-center justify-between mt-2">
                          <p className="text-[9px] text-muted-foreground flex items-center gap-1">
                            <Calendar className="h-2.5 w-2.5" />
                            {new Date(repair.created_at).toLocaleDateString()}
                          </p>
                          {userCanEdit && sections.length > 0 && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-6 w-6 text-primary hover:bg-primary/10">
                                  <CornerDownRight className="h-3.5 w-3.5" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-56">
                                <DropdownMenuLabel>Push to Topic Task</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <div className="max-h-60 overflow-y-auto">
                                  {sections.flatMap(s => s.topics).map(t => (
                                    <DropdownMenuItem key={t.id} onClick={() => handlePushToTask(t.id, { description: `Repair: ${repair.title}` })}>
                                      <span className="truncate">{t.title}</span>
                                    </DropdownMenuItem>
                                  ))}
                                </div>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-6 bg-amber-100 rounded-md flex items-center justify-center">
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                    </div>
                    <span className="text-[10px] font-black text-foreground uppercase tracking-wider">Open Complaints</span>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-6 w-6" 
                    onClick={() => fetchJanusData(true)}
                    disabled={isResyncing}
                  >
                    <RefreshCw className={`h-3 w-3 ${isResyncing ? "animate-spin" : ""}`} />
                  </Button>
                </div>
                {janusData.complaints.length === 0 ? (
                  <div className="text-center py-8 bg-muted/20 rounded-xl border border-dashed border-border">
                    <AlertTriangle className="h-8 w-8 text-muted-foreground/20 mx-auto mb-2" />
                    <p className="text-xs text-muted-foreground">No active complaints found.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {janusData.complaints.map(complaint => (
                      <div key={complaint.id} className="p-3 bg-white dark:bg-card border-l-4 border-l-amber-500 border border-border rounded-lg shadow-sm hover:shadow-md transition-all">
                        <div className="flex items-start justify-between mb-1.5">
                          <Badge className="text-[8px] h-4 bg-amber-100 text-amber-700 border-0">
                            {complaint.status}
                          </Badge>
                        </div>
                        <h4 className="text-xs font-bold leading-tight mb-1 text-foreground">{complaint.title}</h4>
                        <p className="text-[10px] text-muted-foreground line-clamp-2 italic mb-1 bg-muted/30 p-1.5 rounded">"{complaint.description}"</p>
                        <div className="flex items-center justify-between mt-2">
                          <p className="text-[9px] text-muted-foreground flex items-center gap-1 mt-1">
                            <Calendar className="h-2.5 w-2.5" />
                            {new Date(complaint.created_at).toLocaleDateString()}
                          </p>
                          {userCanEdit && sections.length > 0 && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-6 w-6 text-primary hover:bg-primary/10">
                                  <CornerDownRight className="h-3.5 w-3.5" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-56">
                                <DropdownMenuLabel>Push to Topic Task</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <div className="max-h-60 overflow-y-auto">
                                  {sections.flatMap(s => s.topics).map(t => (
                                    <DropdownMenuItem key={t.id} onClick={() => handlePushToTask(t.id, { description: `Complaint: ${complaint.title}\n\n${complaint.description}` })}>
                                      <span className="truncate">{t.title}</span>
                                    </DropdownMenuItem>
                                  ))}
                                </div>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) }
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
                    .update({ attendees: updatedAttendees as any })
                    .eq("id", parseInt(meetingId))
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
                          <div className="flex items-center justify-between gap-2 min-w-0">
                            <div className="flex items-center gap-2 min-w-0 flex-1">
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
                                    className="text-sm sm:text-base font-bold border px-2 py-1 rounded flex-1"
                                    autoFocus
                                    onBlur={saveSectionRename}
                                  />
                                </form>
                              ) : (
                                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                  <span className="text-xs sm:text-sm font-bold text-primary/70 flex-shrink-0">
                                    {sectionIndex + 1}.
                                  </span>
                                  <h2 className="text-sm sm:text-base font-bold text-foreground truncate">
                                    {section.title}
                                  </h2>
                                  <span className="text-[10px] sm:text-xs text-muted-foreground flex-shrink-0 whitespace-nowrap">
                                    ({section.topics.length})
                                  </span>
                                </div>
                              )}
                            </div>

                            {/* Section action buttons - right aligned */}
                            <div className="flex items-center gap-0.5 sm:gap-1 flex-shrink-0">
                              {!editingLocked && editingSection?.id !== section.id && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => beginSectionRename(section)}
                                    title="Edit section name"
                                    className="h-7 w-7 sm:h-8 sm:w-8"
                                  >
                                    <Pencil className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => askDeleteSection(section)}
                                    title="Delete section"
                                    className="h-7 w-7 sm:h-8 sm:w-8"
                                  >
                                    <Trash className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-red-600" />
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
                                  className="bg-primary hover:bg-primary/90 h-7 sm:h-8 px-2 sm:px-3 text-[10px] sm:text-xs rounded-lg"
                                >
                                  <Plus className="h-3 w-3 sm:mr-1" />
                                  <span className="hidden sm:inline">Add Topic</span>
                                </Button>
                              )}
                            </div>
                          </div>

                          {/* Section attachments row deleted */}
                        </div>
                        {section.isExpanded && (
                          <div className="px-12 pb-2">
                            {section.attachments && section.attachments.length > 0 && (
                              <div className="flex flex-wrap gap-2 mb-3">
                                {section.attachments.map((att: any) => (
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
                                    section.topics.map((topic: any, topicIndex: number) => (
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
          onConfirm={(recorderName, timekeeperName, actualStartTime, chairPerson) => {
            updateMeetingStatus("working_minutes", recorderName, timekeeperName, actualStartTime, chairPerson)
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

      <RolloverTopicModal 
        isOpen={showRolloverModal}
        onClose={() => setShowRolloverModal(false)}
        meetingId={meetingId}
        buildingId={meeting?.building_id}
        meetingType={meeting?.meeting_type}
        sections={sections.map(s => ({ id: s.id, title: s.title }))}
        onSuccess={fetchSectionsAndTopics}
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
            setInitialDataForModal(undefined)
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
          initialData={initialDataForModal}
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
        </div>
      </div>
    </>
  )
}
