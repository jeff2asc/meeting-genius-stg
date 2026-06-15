"use client"

import { useState, useEffect } from "react"
import { ChevronDown, User, Plus, Search, Calendar, FileText, Eye, Play, Edit2, CheckSquare, Trash2, Wrench, AlertTriangle, RefreshCw, Settings } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { supabase, getCurrentUser } from "@/lib/supabase"
import { apiClient } from "@/lib/api-client"
import { formatFloatingDate, formatFloatingTime, formatFloatingTimeWithZone } from "@/lib/timezone"
import { toast } from "sonner"
import EditMeetingModal from "./EditMeetingModal"
import TaskDetailsModal from "./TaskDetailsModal"
import TicketDetailsModal from "./TicketDetailsModal"
import { formatJanusTicketDisplayLabel, getJanusTicketRef } from "@/lib/janus"

function enrichJanusTicket(ticket: any, kind: "repair" | "complaint") {
  const ref = getJanusTicketRef(ticket)
  return {
    ...ticket,
    _type: kind,
    type: ticket.type || kind,
    janus_ticket_id: ref,
    ticket_id: ticket.ticket_id || ref,
  }
}
import { isMaster as checkIsMaster, isCorporateAdmin as checkIsCorporateAdmin, isPropertyManager as checkIsPropertyManager } from "@/lib/permissions"
import { Badge } from "@/components/ui/badge"
import UserClock from "@/components/UserClock"
import { 
  fetchBuildingsAction, 
  fetchMeetingsAction, 
  fetchTasksAction, 
  getCompanyLogoAction, 
  getJanusSyncDataAction 
} from "@/lib/api-actions"

interface DashboardProps {
  onStartMeeting: (meetingId: string) => void
  onCreateMeeting?: () => void
  onBuildingsLoaded?: (buildings: any[]) => void
  onBuildingSelected?: (buildingName: string) => void
  userCanCreateMeeting?: boolean
  onAdminClick?: () => void
  onLogout?: () => void
  currentUser?: any
}

type Tab = "meetings" | "tasks" | "all" | "repairs" | "complaints"

export default function Dashboard({
  onStartMeeting,
  onCreateMeeting,
  onBuildingsLoaded,
  onBuildingSelected,
  userCanCreateMeeting = true,
  onAdminClick,
  onLogout,
  currentUser,
}: DashboardProps) {
  const [selectedBuilding, setSelectedBuilding] = useState("")
  const [showBuildingDropdown, setShowBuildingDropdown] = useState(false)
  const [selectedMeetingType, setSelectedMeetingType] = useState("All")
  const [showMeetingTypeDropdown, setShowMeetingTypeDropdown] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [buildings, setBuildings] = useState<any[]>([])
  const [meetings, setMeetings] = useState<any[]>([])
  const [tasks, setTasks] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>("meetings")
  const [availableMeetingTypes, setAvailableMeetingTypes] = useState<string[]>([])

  const [showEditMeetingModal, setShowEditMeetingModal] = useState(false)
  const [selectedMeeting, setSelectedMeeting] = useState<any>(null)
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null)
  const [companyLogo, setCompanyLogo] = useState<string | null>(null)
  const [meetingToDelete, setMeetingToDelete] = useState<any>(null)
  const [taskToDelete, setTaskToDelete] = useState<any>(null)
  const [deleting, setDeleting] = useState(false)

  // NEW: assignee filter state
  const [assigneeFilter, setAssigneeFilter] = useState<string>("All")

  // ⭐ JANUS INTEGRATION STATES
  const [isJanusIntegrated, setIsJanusIntegrated] = useState(false)
  const [janusData, setJanusData] = useState<{ repairs: any[], complaints: any[] }>({ repairs: [], complaints: [] })
  const [isResyncing, setIsResyncing] = useState(false)

  // ⭐ IMPORT TO MEETING STATES
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)
  const [selectedTicketToImport, setSelectedTicketToImport] = useState<any>(null)
  const [targetMeetingId, setTargetMeetingId] = useState<string>("")
  const [isImporting, setIsImporting] = useState(false)

  // ⭐ TICKET DETAILS MODAL STATES
  const [isTicketDetailsModalOpen, setIsTicketDetailsModalOpen] = useState(false)
  const [selectedTicketDetails, setSelectedTicketDetails] = useState<any>(null)

  useEffect(() => {
    const user = getCurrentUser()
    if (user && checkIsMaster(user)) {
      setIsJanusIntegrated(true)
    }
    fetchBuildings()
    fetchCompanyLogo()
    fetchJanusData()
  }, [])

  // ⭐ Auto-sync when switching to Janus tab
  useEffect(() => {
    if (activeTab === "repairs" || activeTab === "complaints") {
      fetchJanusData(true)
    }
  }, [activeTab])

  // Stable key from building IDs — avoids re-firing effect on every array reference change
  const buildingIdsKey = buildings.map(b => b.id).sort().join(',')

  useEffect(() => {
    if (selectedBuilding) {
      fetchMeetings()
      fetchTasks()
      // Only re-fetch Janus data if already known to be integrated
      if (isJanusIntegrated) {
        fetchJanusData()
      }
    }
  }, [selectedBuilding, selectedMeetingType, buildingIdsKey, isJanusIntegrated])

  const fetchJanusData = async (forceResync = false) => {
    const currentUser = getCurrentUser()
    if (!currentUser) return
    
    // ✅ Check Database: Is Janus integrated for this company?
    let isIntegrated = false
    if (currentUser.company_id) {
      const adminClient = supabase
      const { data: company } = await adminClient
        .from('companies')
        .select('janus_integrated')
        .eq('id', currentUser.company_id)
        .single()
      
      isIntegrated = !!company?.janus_integrated
    }

    // Fallback to localStorage for legacy or personal overrides
    if (!isIntegrated) {
      const storageKey = `mg_integrations_${currentUser.id}`
      const installed = typeof window !== 'undefined' ? localStorage.getItem(storageKey) : null
      isIntegrated = installed ? JSON.parse(installed).includes("janus") : false
    }

    const isMasterUser = checkIsMaster(currentUser)
    setIsJanusIntegrated(isIntegrated || isMasterUser)
    
    if (!isIntegrated && !isMasterUser) return

    try {
      const payload = await getJanusSyncDataAction({
        user_id: currentUser.id,
        ...(isMasterUser ? { scope: "master" } : { company_id: currentUser.company_id! })
      })
      
      let repairs = (payload.data?.repairs || []).map((t: any) => enrichJanusTicket(t, "repair"))
      let complaints = (payload.data?.complaints || []).map((t: any) => enrichJanusTicket(t, "complaint"))
      
      // Fallback to payload.data.buildings if component buildings state is still empty on initial mount
      const currentBuildings = buildings.length > 0 ? buildings : (payload.data?.buildings || [])

      // ✅ Override building_name with the authoritative MG name to prevent Janus/MG name mismatches
      const resolveBuildingName = (ticket: any) => {
        if (!ticket.building_id) return ticket
        const match = currentBuildings.find((b: any) => String(b.id) === String(ticket.building_id))
        if (match) return { ...ticket, building_name: match.name }
        return ticket
      }
      repairs = repairs.map(resolveBuildingName)
      complaints = complaints.map(resolveBuildingName)

      if (selectedBuilding !== "All" && selectedBuilding) {
        const building = currentBuildings.find((b: any) => b.name === selectedBuilding)
        if (building) {
          repairs = repairs.filter((r: any) => 
            String(r.building_id) === String(building.id) || 
            (r.building_name && r.building_name.toLowerCase().includes((building.name || "").toLowerCase()))
          )
          complaints = complaints.filter((c: any) => 
            String(c.building_id) === String(building.id) || 
            (c.building_name && c.building_name.toLowerCase().includes((building.name || "").toLowerCase()))
          )
        }
      } else {
        // ⭐ SECURITY FILTER: Only show tickets for buildings this user is authorized to see
        if (!isMasterUser) {
          const authorizedNames = currentBuildings.map((b: any) => (b.name || "").toLowerCase()).filter(Boolean);
          const authorizedIds = currentBuildings.map((b: any) => String(b.id || ""));

          repairs = repairs.filter((r: any) => 
            authorizedIds.includes(String(r.building_id)) || 
            (r.building_name && authorizedNames.some((name: string) => r.building_name.toLowerCase().includes(name)))
          );
          complaints = complaints.filter((c: any) => 
            authorizedIds.includes(String(c.building_id)) || 
            (c.building_name && authorizedNames.some((name: string) => c.building_name.toLowerCase().includes(name)))
          );
        }
      }
      
      setJanusData({ repairs, complaints })
    } catch (err) {
      console.error("Janus fetch error:", err)
    } finally {
      setIsResyncing(false)
    }
  }

  const handleImportToMeeting = async () => {
    if (!selectedTicketToImport || !targetMeetingId) return
    setIsImporting(true)
    
    try {
      const adminClient = supabase
      // 1. Get the sections of the target meeting to find where to put the new topic
      const { data: sections } = await adminClient
        .from('sections')
        .select('*')
        .eq('meeting_id', parseInt(targetMeetingId))
        .order('order_index', { ascending: false })
        .limit(1)
      
      const sectionId = sections?.[0]?.id || null
      
      // 2. Get the last topic order index
      const { data: topics } = await adminClient
        .from('topics')
        .select('order_index')
        .eq('meeting_id', parseInt(targetMeetingId))
        .order('order_index', { ascending: false })
        .limit(1)
      
      const nextOrder = (topics?.[0]?.order_index || 0) + 1
      
      // 3. Create the new topic from the Janus ticket
      const { error } = await adminClient
        .from('topics')
        .insert({
          meeting_id: parseInt(targetMeetingId),
          section_id: sectionId,
          title: `[JANUS] ${selectedTicketToImport.title}`,
          description: selectedTicketToImport.description || `Priority: ${selectedTicketToImport.priority || 'N/A'}. Status: ${selectedTicketToImport.status}. Sync ID: ${selectedTicketToImport.id}`,
          order_index: nextOrder
        })
      
      if (error) throw error
      
      toast.success("Successfully imported to meeting!", {
        description: "The Janus ticket is now an agenda topic."
      })
      setIsImportModalOpen(false)
      setSelectedTicketToImport(null)
      setTargetMeetingId("")
    } catch (err: any) {
      console.error("Import error:", err)
      toast.error("Failed to import to meeting", { description: err.message })
    } finally {
      setIsImporting(false)
    }
  }

  const fetchCompanyLogo = async () => {
    try {
      const currentUser = getCurrentUser()
      if (!currentUser) return

      if (checkIsMaster(currentUser)) {
        setCompanyLogo('/MG2 logo.png')
        return
      }

      if (currentUser.company_id) {
        const logoUrl = await getCompanyLogoAction(currentUser.company_id)
        setCompanyLogo(logoUrl || '/MG2 logo.png')
      } else {
        setCompanyLogo('/MG2 logo.png')
      }
    } catch (err) {
      console.error('Error fetching company logo:', err)
      setCompanyLogo('/MG2 logo.png')
    }
  }

  const fetchBuildings = async () => {
    try {
      const currentUser = getCurrentUser()

      if (!currentUser) {
        console.error('❌ No current user found!')
        return
      }

      let data: any[] = []
      
      if (checkIsMaster(currentUser)) {
        data = await fetchBuildingsAction()
      } else if (checkIsCorporateAdmin(currentUser)) {
        data = await fetchBuildingsAction({ company_id: currentUser.company_id! })
      } else {
        // PM or User role: fetch buildings they are explicitly assigned to or manage
        const { data: myBuildings } = await supabase.from("user_buildings").select("building_id").eq("user_id", currentUser.id)
        const myIds = myBuildings?.map(b => b.building_id) || []
        
        // Fetch managed and assigned buildings
        const managed = checkIsPropertyManager(currentUser) ? await fetchBuildingsAction({ manager_id: currentUser.id }) : []
        const assigned = myIds.length > 0 ? await fetchBuildingsAction({ building_ids: myIds }) : []
        
        // Merge and deduplicate
        const combined = [...(managed || []), ...(assigned || [])]
        const seen = new Set()
        data = combined.filter(b => {
          if (seen.has(b.id)) return false
          seen.add(b.id)
          return true
        })
      }

      setBuildings(data || [])

      if (onBuildingsLoaded) {
        onBuildingsLoaded(data || [])
      }

      setSelectedBuilding("All")

      if (onBuildingSelected) {
        onBuildingSelected("All")
      }
    } catch (err) {
      console.error('❌ Unexpected error in fetchBuildings:', err)
      setSelectedBuilding("All")
      if (onBuildingSelected) {
        onBuildingSelected("All")
      }
    } finally {
      setLoading(false)
    }
  }

  const fetchMeetings = async () => {
    try {
      let data: any[] = []
      
      if (selectedBuilding !== "All") {
        const building = buildings.find(b => b.name === selectedBuilding)
        if (building) {
          data = await fetchMeetingsAction({ building_id: building.id })
        }
      } else {
        const buildingIds = buildings.map(b => b.id)
        if (buildingIds.length > 0) {
          data = await fetchMeetingsAction({ building_ids: buildingIds })
        } else {
          setMeetings([])
          setAvailableMeetingTypes([])
          return
        }
      }

      const meetingTypes = Array.from(new Set(data?.map(m => m.meeting_type).filter(Boolean))) as string[]
      setAvailableMeetingTypes(meetingTypes.sort())

      const formattedMeetings = (data || []).map(meeting => ({
        id: String(meeting.id),
        building: meeting.buildings?.name || selectedBuilding,
        building_id: meeting.building_id,
        title: meeting.title,
        date: formatFloatingDate(meeting.meeting_date, 'short') + (meeting.start_time ? ` at ${formatFloatingTimeWithZone(meeting.start_time, meeting.buildings?.timezone)}` : ''),
        company_id: meeting.buildings?.company_id,
        meeting_date: meeting.meeting_date,
        location: meeting.location,
        start_time: meeting.start_time,
        meeting_type: meeting.meeting_type,
        strata_plan_number: meeting.strata_plan_number,
        status: meeting.status === 'working_agenda' ? 'Draft' :
          (meeting.status === 'working_minutes' || meeting.status === 'agenda') ? 'In Progress' :
            'Finalized'
      }))

      setMeetings(formattedMeetings)
    } catch (err) {
      console.error('❌ Unexpected error in fetchMeetings:', err)
    }
  }

  const fetchTasks = async () => {
    try {
      let data: any[] = []
      
      if (selectedBuilding !== "All") {
        const building = buildings.find(b => b.name === selectedBuilding)
        if (building) {
          data = await fetchTasksAction({ building_id: building.id })
        }
      } else {
        const buildingIds = buildings.map(b => b.id)
        if (buildingIds.length > 0) {
          data = await fetchTasksAction({ building_ids: buildingIds })
        } else {
          setTasks([])
          return
        }
      }

      const formattedTasks = (data || []).map(task => {
        return {
          id: task.id,
          description: task.description,
          building: task.building_name,
          meeting: task.meeting_title,
          topic: task.topic_title,
          assigned_name: task.assigned_name,
          assigned_email: task.assigned_email,
          assignees: task.assignees || [],
          status: task.status,
          due_date: task.due_date,
          created_at: task.created_at
        }
      })

      // Deduplicate by id to prevent duplicate key warnings from concurrent fetches
      // Use string comparison to handle mixed number/string id types
      const seen = new Set<string>()
      const dedupedTasks = formattedTasks.filter(t => {
        const key = String(t.id)
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })

      setTasks(dedupedTasks)
    } catch (err) {
      console.error('Unexpected error:', err)
    }
  }

  const handleEditMeeting = (meeting: any) => {
    setSelectedMeeting(meeting)
    setShowEditMeetingModal(true)
  }

  const handleDeleteMeeting = async () => {
    if (!meetingToDelete) return

    setDeleting(true)
    try {
      await apiClient.v1.meetings.delete(parseInt(meetingToDelete.id))
      await fetchMeetings()
      setMeetingToDelete(null)
    } catch (err) {
      console.error('Unexpected error:', err)
      alert('An error occurred while deleting the meeting.')
    } finally {
      setDeleting(false)
    }
  }

  const handleDeleteTask = async () => {
    if (!taskToDelete) return

    setDeleting(true)
    try {
      await apiClient.v1.tasks.delete(taskToDelete.id)
      await fetchTasks()
      setTaskToDelete(null)
    } catch (err) {
      console.error('Unexpected error:', err)
      alert('An error occurred while deleting the task.')
    } finally {
      setDeleting(false)
    }
  }

  const handleBuildingSelect = (buildingName: string) => {
    setSelectedBuilding(buildingName)
    setShowBuildingDropdown(false)
    if (onBuildingSelected) {
      onBuildingSelected(buildingName)
    }
  }

  const handleBuildingChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    handleBuildingSelect(e.target.value)
  }

  const handleMeetingTypeSelect = (meetingType: string) => {
    setSelectedMeetingType(meetingType)
    setShowMeetingTypeDropdown(false)
  }

  const filteredMeetings = meetings.filter((meeting) => {
    const matchesSearch =
      (meeting.title || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (meeting.date || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (meeting.building || "").toLowerCase().includes(searchQuery.toLowerCase())
    const matchesMeetingType = selectedMeetingType === "All" || meeting.meeting_type === selectedMeetingType
    const matchesBuilding = selectedBuilding === "All" || meeting.building === selectedBuilding
    return matchesSearch && matchesMeetingType && matchesBuilding
  })

  // Build list of unique assignee names for filter
  const allAssigneeNames = tasks.flatMap((task) => {
    if (task.assignees && task.assignees.length > 0) {
      return task.assignees
        .map((a: any) => a?.name)
        .filter((name: string | undefined) => !!name)
    }
    return task.assigned_name ? [task.assigned_name] : []
  })
  const uniqueAssigneeNames = Array.from(new Set(allAssigneeNames)).sort()

  // Filter tasks by search and assignee — deduplicate by id as final safety net
  const filteredTasks = Array.from(
    new Map(
      tasks.filter((task) => {
        const q = searchQuery.toLowerCase()

        const matchesSearch =
          (task.description || "").toLowerCase().includes(q) ||
          (task.building || "").toLowerCase().includes(q) ||
          (task.assigned_name || "").toLowerCase().includes(q)

        const assigneeNames =
          task.assignees && task.assignees.length > 0
            ? task.assignees
              .map((a: any) => a?.name?.toLowerCase())
              .filter(Boolean)
            : task.assigned_name
              ? [task.assigned_name.toLowerCase()]
              : []

        const matchesAssignee =
          assigneeFilter === "All" ||
          assigneeNames.includes(assigneeFilter.toLowerCase())

        const matchesBuilding =
          selectedBuilding === "All" ||
          (task.building || "").toLowerCase() === selectedBuilding.toLowerCase()

        return matchesSearch && matchesAssignee && matchesBuilding
      }).map(task => [task.id, task])
    ).values()
  )

  type MeetingStatus = "Draft" | "In Progress" | "Finalized"

  const statusStyles: Record<MeetingStatus, string> = {
    Draft: "bg-blue-100 text-blue-800 border-blue-200",
    "In Progress": "bg-green-100 text-green-800 border-green-200",
    Finalized: "bg-purple-100 text-purple-800 border-purple-200",
  }

  const taskStatusStyles: Record<string, string> = {
    open: "bg-blue-100 text-blue-800",
    in_progress: "bg-yellow-100 text-yellow-800",
    completed: "bg-green-100 text-green-800",
    blocked: "bg-red-100 text-red-800",
  }

  const getActionButtons = (meeting: typeof meetings[0]) => {
    let primaryButton

    switch (meeting.status) {
      case "Draft":
        primaryButton = (
          <Button
            onClick={() => onStartMeeting(meeting.id)}
            size="sm"
            variant="outline"
          >
            <FileText className="h-4 w-4 mr-2" />
            Edit Agenda
          </Button>
        )
        break
      case "In Progress":
        primaryButton = null; // Removed 'Continue' button as requested; users can click the meeting title
        break
      case "Finalized":
        primaryButton = (
          <Button
            onClick={() => onStartMeeting(meeting.id)}
            size="sm"
            variant="outline"
          >
            <Eye className="h-4 w-4 mr-2" />
            View
          </Button>
        )
        break
    }

    const showEdit = userCanCreateMeeting

    return (
      <div className="flex items-center gap-2">
        <div className="w-[120px] flex-shrink-0">
          {primaryButton}
        </div>
        {showEdit && (
          <div className="flex items-center gap-1">
            <Button
              onClick={() => handleEditMeeting(meeting)}
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0 hover:bg-muted"
              title="Edit Meeting Details"
            >
              <Edit2 className="h-4 w-4" />
            </Button>
            <Button
              onClick={() => setMeetingToDelete(meeting)}
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0 hover:bg-red-50 text-red-600 hover:text-red-700"
              title="Delete Meeting"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    )
  }


  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted">
      {/* HEADER - MG Logo + Clock */}
      <header className="border-b border-border bg-card shadow-sm sticky top-0 z-40 sm:static">
        <div className="mx-auto max-w-7xl px-4 py-3 sm:py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-2">
            {/* Left: Logo + Clock */}
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <img
                src="/MG2 logo.png"
                alt="Meeting Genius Logo"
                className="h-8 sm:h-10 w-auto object-contain flex-shrink-0"
              />
              <UserClock
                compact
                className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground bg-muted/50 px-2 py-1 rounded-full border border-border/50 truncate"
                iconClassName="h-3 w-3 text-primary animate-pulse flex-shrink-0"
              />
            </div>
            {/* Right: Admin + User */}
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {onAdminClick && (
                <Button
                  onClick={onAdminClick}
                  variant="outline"
                  size="sm"
                  className="h-8 px-2 sm:px-3 text-xs"
                >
                  <Settings className="h-3.5 w-3.5 sm:mr-1.5" />
                  <span className="hidden sm:inline">Admin</span>
                </Button>
              )}
              {onLogout && (
                <Button
                  onClick={onLogout}
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 rounded-full bg-primary text-primary-foreground font-semibold text-xs hover:bg-primary/90 flex-shrink-0"
                  title={`Logout (${currentUser?.name})`}
                >
                  {currentUser?.name?.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) || 'U'}
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Mobile Header: Centered title + full-width button */}
        <div className="md:hidden mb-6">
          <h2 className="text-2xl font-bold text-center text-foreground mb-3">
            {selectedBuilding === "All" ? "All Buildings" : selectedBuilding}
          </h2>

          <div className="relative mb-3">
            <select
              className="w-full px-4 py-3 bg-card border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground"
              value={selectedBuilding}
              onChange={handleBuildingChange}
            >
              <option value="All">All Buildings</option>
              {buildings.map((building) => (
                <option key={building.id} value={building.name}>
                  {building.name}
                </option>
              ))}
            </select>
          </div>

          {/* Full-width New Meeting Button */}
          {userCanCreateMeeting && (
            <Button
              onClick={onCreateMeeting}
              disabled={buildings.length === 0}
              className="w-full py-3 text-base font-semibold bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl disabled:opacity-50"
            >
              <Plus className="h-5 w-5 mr-2" />
              New Meeting
            </Button>
          )}
        </div>

        {/* Desktop Header */}
        <div className="hidden md:flex mb-6 flex-col md:flex-row md:items-center justify-between gap-4 md:gap-6">
          <div className="flex items-center gap-4">
            {companyLogo && (
              <img
                src={companyLogo}
                alt="Company Logo"
                className="h-14 w-14 md:h-16 md:w-16 rounded-full object-cover border-2 border-border shadow-sm flex-shrink-0"
              />
            )}
            <div className="flex-1">
              <h2 className="text-xl md:text-2xl font-bold text-foreground line-clamp-1">
                {selectedBuilding === "All" ? "All Buildings" : selectedBuilding}
              </h2>
              <p className="text-xs md:text-sm text-muted-foreground mt-0.5">
                {activeTab === "meetings" && `${filteredMeetings.length} meeting${filteredMeetings.length !== 1 ? 's' : ''}`}
                {activeTab === "tasks" && `${filteredTasks.length} task${filteredTasks.length !== 1 ? 's' : ''}`}
                {activeTab === "all" && `${filteredMeetings.length} meetings, ${filteredTasks.length} tasks`}
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row md:flex-col items-stretch sm:items-center md:items-end gap-2 w-full md:w-auto">
            {userCanCreateMeeting && (
              <Button
                onClick={onCreateMeeting}
                disabled={buildings.length === 0}
                className="bg-gradient-to-r from-primary to-decision-purple text-primary-foreground hover:opacity-90 disabled:opacity-50 w-full sm:min-w-[180px]"
              >
                <Plus className="h-4 w-4 mr-2" />
                New Meeting
              </Button>
            )}
          </div>
        </div>

        <div className="mb-6 border-b border-border overflow-x-auto scrollbar-hide">
          <div className="flex items-end justify-between gap-4 min-w-max">
            <div className="flex gap-4">
              <button
                onClick={() => setActiveTab("meetings")}
                className={`pb-3 px-1 font-medium text-sm transition-colors ${activeTab === "meetings"
                    ? "border-b-2 border-primary text-primary"
                    : "text-muted-foreground hover:text-foreground"
                  }`}
              >
                <Calendar className="h-4 w-4 inline mr-2" />
                Meetings
              </button>
              <button
                onClick={() => setActiveTab("tasks")}
                className={`pb-3 px-1 font-medium text-sm transition-colors ${activeTab === "tasks"
                    ? "border-b-2 border-primary text-primary"
                    : "text-muted-foreground hover:text-foreground"
                  }`}
              >
                <CheckSquare className="h-4 w-4 inline mr-2" />
                Tasks
              </button>
              <button
                onClick={() => setActiveTab("all")}
                className={`pb-3 px-1 font-medium text-sm transition-colors ${activeTab === "all"
                    ? "border-b-2 border-primary text-primary"
                    : "text-muted-foreground hover:text-foreground"
                  }`}
              >
                <FileText className="h-4 w-4 inline mr-2" />
                All
              </button>
              {isJanusIntegrated && (
                <>
                  <button
                    onClick={() => setActiveTab("repairs")}
                    className={`pb-3 px-1 font-medium text-sm transition-colors ${activeTab === "repairs"
                        ? "border-b-2 border-primary text-primary"
                        : "text-muted-foreground hover:text-foreground"
                      }`}
                  >
                    <Wrench className="h-4 w-4 inline mr-2" />
                    Repairs
                  </button>
                  <button
                    onClick={() => setActiveTab("complaints")}
                    className={`pb-3 px-1 font-medium text-sm transition-colors ${activeTab === "complaints"
                        ? "border-b-2 border-primary text-primary"
                        : "text-muted-foreground hover:text-foreground"
                      }`}
                  >
                    <AlertTriangle className="h-4 w-4 inline mr-2" />
                    Complaints
                  </button>
                </>
              )}
            </div>

            {/* Building filter — inline with tabs */}
            <div className="relative pb-2 flex-shrink-0">
              <select
                className="bg-card text-sm h-8 px-2 border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary/50 text-foreground"
                value={selectedBuilding}
                onChange={handleBuildingChange}
              >
                <option value="All">All Buildings</option>
                {buildings.map((building) => (
                  <option key={building.id} value={building.name}>
                    {building.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* ✅ FIX: Added items-center to align search bar and assignee dropdown */}
        <div className="mb-6 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder={`Search ${activeTab}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground"
            />
          </div>

          <div className="flex gap-3 items-center">
            {(activeTab === "meetings" || activeTab === "all") && availableMeetingTypes.length > 0 && (
              <div className="relative flex-1 sm:flex-initial">
                <Button
                  variant="outline"
                  className="flex items-center gap-2 bg-card w-full sm:w-auto justify-between"
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowMeetingTypeDropdown(!showMeetingTypeDropdown)
                  }}
                >
                  <span className="truncate">{selectedMeetingType === "All" ? "All Types" : selectedMeetingType}</span>
                  <ChevronDown className="h-4 w-4 flex-shrink-0" />
                </Button>
                {showMeetingTypeDropdown && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setShowMeetingTypeDropdown(false)}
                    />
                    <div className="absolute right-0 mt-2 w-full sm:w-56 bg-card border border-border rounded-lg shadow-lg z-50">
                      <button
                        onClick={() => handleMeetingTypeSelect("All")}
                        className={`w-full px-4 py-2 text-left hover:bg-muted transition-colors first:rounded-t-lg ${selectedMeetingType === "All" ? "bg-muted font-semibold" : ""
                          }`}
                      >
                        All Types
                      </button>
                      {availableMeetingTypes.map((type) => (
                        <button
                          key={type}
                          onClick={() => handleMeetingTypeSelect(type)}
                          className={`w-full px-4 py-2 text-left hover:bg-muted transition-colors last:rounded-b-lg ${type === selectedMeetingType ? "bg-muted font-semibold" : ""
                            }`}
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {(activeTab === "tasks" || activeTab === "all") && (
              <div className="flex-1 sm:flex-initial min-w-0">
                <select
                  className="w-full px-3 py-2 bg-card border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  value={assigneeFilter}
                  onChange={(e) => setAssigneeFilter(e.target.value)}
                >
                  <option value="All">All assignees</option>
                  {uniqueAssigneeNames.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {(activeTab === "meetings" || activeTab === "all") && (
          <Card className="border-0 bg-card shadow-md mb-6">
            {activeTab === "all" && (
              <div className="p-4 border-b border-border">
                <h3 className="font-semibold text-foreground flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-primary" />
                  Meetings
                </h3>
              </div>
            )}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-border">
                  <tr className="text-left">
                    {selectedBuilding === "All" && (
                      <th className="px-6 py-4 text-sm font-semibold text-muted-foreground">Building</th>
                    )}
                    <th className="px-6 py-4 text-sm font-semibold text-muted-foreground">Meeting</th>
                    <th className="px-6 py-4 text-sm font-semibold text-muted-foreground">Type</th>
                    <th className="px-6 py-4 text-sm font-semibold text-muted-foreground">Date</th>
                    <th className="px-6 py-4 text-sm font-semibold text-muted-foreground">Status</th>
                    <th className="px-6 py-4 text-sm font-semibold text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMeetings.length > 0 ? (
                    filteredMeetings.map((meeting) => (
                      <tr key={meeting.id} className="border-b border-border hover:bg-muted/50 transition-colors">
                        {selectedBuilding === "All" && (
                          <td className="px-6 py-4 text-sm text-muted-foreground">{meeting.building}</td>
                        )}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <Calendar className="h-5 w-5 text-primary" />
                            <button
                              className="font-medium text-foreground underline hover:text-primary focus:outline-none ml-1"
                              onClick={() => onStartMeeting(meeting.id)}
                              title="Open Meeting"
                            >
                              {meeting.title}
                            </button>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-muted-foreground">
                          <span className="px-2 py-1 rounded bg-muted text-foreground text-xs font-medium">
                            {meeting.meeting_type || 'N/A'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-muted-foreground">{meeting.date}</td>
                        <td className="px-6 py-4">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium border whitespace-nowrap ${statusStyles[meeting.status as MeetingStatus]}`}>
                            {meeting.status}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {getActionButtons(meeting)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={selectedBuilding === "All" ? 6 : 5} className="px-6 py-12 text-center">
                        <p className="text-muted-foreground mb-4">
                          {searchQuery
                            ? `No meetings found matching "${searchQuery}"`
                            : selectedMeetingType !== "All"
                              ? `No ${selectedMeetingType} meetings found`
                              : `No meetings found`
                          }
                        </p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View for Meetings */}
            <div className="md:hidden p-3 space-y-3">
              {filteredMeetings.length > 0 ? (
                filteredMeetings.map((meeting) => (
                  <div
                    key={meeting.id}
                    className="w-full text-left bg-white dark:bg-card rounded-2xl shadow-sm border border-border p-4 hover:shadow-md active:scale-[0.99] transition-all cursor-pointer"
                    onClick={() => onStartMeeting(meeting.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onStartMeeting(meeting.id);
                      }
                    }}
                  >
                    <div className="flex justify-between items-start gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="mt-0.5 h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <Calendar className="h-4 w-4 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-foreground text-sm leading-snug line-clamp-2">
                            {meeting.title}
                          </p>
                          {selectedBuilding === "All" && (
                            <p className="text-xs text-muted-foreground mt-0.5">{meeting.building}</p>
                          )}
                        </div>
                      </div>
                      <span className={`flex-shrink-0 px-2.5 py-1 rounded-full text-[10px] font-semibold border whitespace-nowrap ${statusStyles[meeting.status as MeetingStatus]}`}>
                        {meeting.status}
                      </span>
                    </div>

                    <div className="mt-3 flex items-center justify-between pl-11">
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {meeting.date}
                        </span>
                        {meeting.meeting_type && (
                          <span className="bg-muted px-2 py-0.5 rounded-full font-medium text-foreground">
                            {meeting.meeting_type}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        {userCanCreateMeeting && (
                          <>
                            <Button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleEditMeeting(meeting)
                              }}
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0 text-muted-foreground hover:text-primary hover:bg-primary/5"
                              title="Edit Meeting"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              onClick={(e) => {
                                e.stopPropagation()
                                setMeetingToDelete(meeting)
                              }}
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0 text-muted-foreground hover:text-red-600 hover:bg-red-50"
                              title="Delete Meeting"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-12 text-center">
                  <Calendar className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-muted-foreground text-sm">No meetings found</p>
                </div>
              )}
            </div>
          </Card>
        )}

        {(activeTab === "tasks" || activeTab === "all") && (
          <Card className="border-0 bg-card shadow-md">
            {activeTab === "all" && (
              <div className="p-4 border-b border-border">
                <h3 className="font-semibold text-foreground flex items-center gap-2">
                  <CheckSquare className="h-5 w-5 text-task-green" />
                  Tasks
                </h3>
              </div>
            )}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-border">
                  <tr className="text-left">
                    {selectedBuilding === "All" && (
                      <th className="px-6 py-4 text-sm font-semibold text-muted-foreground">Building</th>
                    )}
                    <th className="px-6 py-4 text-sm font-semibold text-muted-foreground">Task</th>
                    <th className="px-6 py-4 text-sm font-semibold text-muted-foreground">Meeting</th>
                    <th className="px-6 py-4 text-sm font-semibold text-muted-foreground">Assigned To</th>
                    <th className="px-6 py-4 text-sm font-semibold text-muted-foreground">Status</th>
                    <th className="px-6 py-4 text-sm font-semibold text-muted-foreground">Due Date</th>
                    <th className="px-6 py-4 text-sm font-semibold text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTasks.length > 0 ? (
                    filteredTasks.map((task) => {
                      const isOverdue = task.due_date && 
                        new Date(task.due_date) < new Date() && 
                        task.status !== 'completed';
                        
                      return (
                        <tr 
                          key={`desktop-task-${task.id}`} 
                          className={`border-b border-border transition-colors ${
                            isOverdue ? 'bg-red-50 hover:bg-red-100' : 'hover:bg-muted/50'
                          }`}
                        >
                          {selectedBuilding === "All" && (
                            <td className="px-6 py-4 text-sm text-muted-foreground">{task.building}</td>
                          )}
                          <td className="px-6 py-4">
                            <button
                              onClick={() => setSelectedTaskId(task.id)}
                              className="font-medium text-foreground underline hover:text-task-green focus:outline-none text-left"
                            >
                              {task.description}
                            </button>
                            <p className="text-xs text-muted-foreground mt-1">Topic: {task.topic}</p>
                          </td>
                          <td className="px-6 py-4 text-sm text-muted-foreground">{task.meeting}</td>
                          <td className="px-6 py-4 text-sm">
                            {task.assignees && task.assignees.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {task.assignees.map((assignee: any, idx: number) => (
                                  <span key={idx} className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                                    {assignee.name}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">{task.assigned_name}</span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${taskStatusStyles[task.status] || 'bg-gray-100 text-gray-800'}`}>
                              {task.status.replace('_', ' ')}
                            </span>
                          </td>
                          <td className={`px-6 py-4 text-sm ${isOverdue ? 'text-red-700 font-semibold' : 'text-muted-foreground'}`}>
                            {task.due_date ? new Date(task.due_date).toLocaleDateString() : '-'}
                          </td>
                          <td className="px-6 py-4">
                            <Button
                              onClick={() => setTaskToDelete(task)}
                              size="sm"
                              variant="ghost"
                              className="hover:bg-red-50 text-red-600 hover:text-red-700"
                              title="Delete Task"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      )
                    })
                  ) : (
                    <tr>
                      <td colSpan={selectedBuilding === "All" ? 7 : 6} className="px-6 py-12 text-center">
                        <p className="text-muted-foreground">
                          {searchQuery
                            ? `No tasks found matching "${searchQuery}"`
                            : assigneeFilter !== "All"
                              ? `No tasks found for ${assigneeFilter}`
                              : `No tasks found`
                          }
                        </p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View for Tasks */}
            <div className="md:hidden p-3 space-y-3">
              {filteredTasks.length > 0 ? (
                filteredTasks.map((task) => {
                  const isOverdue = task.due_date &&
                    new Date(task.due_date) < new Date() &&
                    task.status !== 'completed';

                  return (
                    <div
                      key={`mobile-task-${task.id}`}
                      className={`bg-white dark:bg-card rounded-2xl shadow-sm border p-4 ${isOverdue ? 'border-red-200 bg-red-50/30 dark:bg-red-900/10' : 'border-border'}`}
                    >
                      {/* Title row */}
                      <div className="flex justify-between items-start gap-3 mb-3">
                        <button
                          onClick={() => setSelectedTaskId(task.id)}
                          className="font-semibold text-foreground text-sm text-left leading-snug line-clamp-3 flex-1"
                        >
                          {task.description}
                        </button>
                        <span className={`flex-shrink-0 px-2.5 py-1 rounded-full text-[10px] font-semibold ${taskStatusStyles[task.status] || 'bg-gray-100 text-gray-800'}`}>
                          {task.status.replace('_', ' ')}
                        </span>
                      </div>

                      {/* Meeting + Topic */}
                      <p className="text-xs text-muted-foreground mb-2 truncate">
                        {task.meeting}{task.topic ? ` · ${task.topic}` : ''}
                      </p>

                      {/* Assignees */}
                      {(task.assignees?.length > 0 || task.assigned_name) && (
                        <div className="flex flex-wrap gap-1 mb-3">
                          {task.assignees && task.assignees.length > 0 ? (
                            task.assignees.map((assignee: any, idx: number) => (
                              <span key={idx} className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                                {assignee.name}
                              </span>
                            ))
                          ) : (
                            <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                              {task.assigned_name}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Due date + delete */}
                      <div className="flex justify-between items-center">
                        <span className={`text-xs flex items-center gap-1 ${isOverdue ? 'text-red-600 font-semibold' : 'text-muted-foreground'}`}>
                          <CheckSquare className="h-3 w-3" />
                          Due: {task.due_date ? new Date(task.due_date).toLocaleDateString() : 'No date'}
                        </span>
                        <Button
                          onClick={() => setTaskToDelete(task)}
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  )
                })
              ) : (
                <div className="py-12 text-center">
                  <CheckSquare className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-muted-foreground text-sm">No tasks found</p>
                </div>
              )}
            </div>
          </Card>
        )}

        {activeTab === "repairs" && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                <Wrench className="h-5 w-5 text-primary" />
                Repairs
              </h3>
              {isResyncing && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground animate-pulse">
                  <RefreshCw className="h-3 w-3 animate-spin" />
                  Syncing with Janus...
                </div>
              )}
            </div>
            
            {janusData.repairs.length === 0 ? (
              <Card className="p-20 text-center border-dashed bg-muted/20 rounded-3xl">
                <Wrench className="h-12 w-12 text-muted-foreground/20 mx-auto mb-4" />
                <p className="text-muted-foreground font-medium">No active Janus repair tickets found for this building.</p>
              </Card>
            ) : (
              <Card className="border-0 bg-card shadow-md">
                {/* Desktop table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full">
                    <thead className="border-b border-border">
                      <tr className="text-left">
                        <th className="px-6 py-4 text-sm font-semibold text-muted-foreground">Ticket</th>
                        {selectedBuilding === "All" && (
                          <th className="px-6 py-4 text-sm font-semibold text-muted-foreground">Building</th>
                        )}
                        <th className="px-6 py-4 text-sm font-semibold text-muted-foreground">Priority</th>
                        <th className="px-6 py-4 text-sm font-semibold text-muted-foreground">Status</th>
                        <th className="px-6 py-4 text-sm font-semibold text-muted-foreground">Budget / Est.</th>
                        <th className="px-6 py-4 text-sm font-semibold text-muted-foreground">Date</th>
                        <th className="px-6 py-4 text-sm font-semibold text-muted-foreground">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {janusData.repairs
                        .filter(t => {
                          const q = searchQuery.toLowerCase();
                          const matchesSearch = !q || 
                            (t.title || "").toLowerCase().includes(q) || 
                            (t.description || "").toLowerCase().includes(q) ||
                            (t.building_name || "").toLowerCase().includes(q) ||
                            formatJanusTicketDisplayLabel(t, "repair").toLowerCase().includes(q);
                          
                          const matchesBuilding = selectedBuilding === "All" || t.building_name === selectedBuilding;
                          return matchesSearch && matchesBuilding;
                        })
                        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                        .map((ticket: any) => (
                          <tr
                            key={`repair-${ticket.id}`}
                            className={`border-b border-border hover:bg-muted/50 transition-colors cursor-pointer ${ticket.status?.toLowerCase() === 'closed' ? 'opacity-60' : ''}`}
                            onClick={() => { setSelectedTicketDetails({...ticket, _type: 'repair'}); setIsTicketDetailsModalOpen(true) }}
                          >
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className={`h-2 w-2 rounded-full flex-shrink-0 ${ticket.status?.toLowerCase() === 'closed' ? 'bg-muted-foreground/40' : 'bg-primary'}`} />
                                <div>
                                  <p className="font-medium text-foreground text-sm line-clamp-1">{ticket.title}</p>
                                  {ticket.description && (
                                    <p className="text-xs text-muted-foreground line-clamp-1 italic mt-0.5">{ticket.description}</p>
                                  )}
                                  <p className="text-[10px] font-mono text-muted-foreground mt-0.5">{formatJanusTicketDisplayLabel(ticket, "repair")}</p>
                                </div>
                              </div>
                            </td>
                            {selectedBuilding === "All" && (
                              <td className="px-6 py-4 text-sm text-muted-foreground">{ticket.building_name || '—'}</td>
                            )}
                            <td className="px-6 py-4">
                              <Badge variant="secondary" className={`text-[10px] uppercase font-black tracking-wider ${
                                ticket.priority?.toUpperCase() === 'HIGH' ? 'bg-red-50 text-red-700 border-red-100' :
                                ticket.priority?.toUpperCase() === 'MEDIUM' ? 'bg-yellow-50 text-yellow-700 border-yellow-100' :
                                'bg-primary/10 text-primary'
                              }`}>
                                {ticket.priority || 'MEDIUM'}
                              </Badge>
                            </td>
                            <td className="px-6 py-4">
                              <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${
                                ticket.status?.toLowerCase() === 'closed' ? 'bg-muted text-muted-foreground border-border' :
                                ticket.status?.toLowerCase() === 'in_progress' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                                'bg-green-50 text-green-700 border-green-100'
                              }`}>
                                {ticket.status || 'Open'}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex flex-col gap-0.5">
                                {ticket.budget && <span className="text-xs text-green-700 font-bold">${ticket.budget}</span>}
                                {ticket.estimated_cost && <span className="text-xs text-blue-600">Est: ${ticket.estimated_cost}</span>}
                                {!ticket.budget && !ticket.estimated_cost && <span className="text-xs text-muted-foreground">—</span>}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-sm text-muted-foreground whitespace-nowrap">
                              {ticket.created_at ? new Date(ticket.created_at).toLocaleDateString() : '—'}
                            </td>
                            <td className="px-6 py-4">
                              {ticket.status?.toLowerCase() !== 'closed' && (
                                <Button
                                  size="sm" variant="ghost"
                                  className="h-7 text-[10px] gap-1 text-primary hover:bg-primary/10"
                                  onClick={(e) => { e.stopPropagation(); setSelectedTicketToImport({...ticket, _type: 'repair'}); setIsImportModalOpen(true) }}
                                >
                                  <Plus className="h-3 w-3" /> Import
                                </Button>
                              )}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
                {/* Mobile card view */}
                <div className="md:hidden p-3 space-y-3">
                  {janusData.repairs
                    .filter(t => {
                      const q = searchQuery.toLowerCase();
                      const matchesSearch = !q || 
                        (t.title || "").toLowerCase().includes(q) || 
                        (t.description || "").toLowerCase().includes(q) ||
                        (t.building_name || "").toLowerCase().includes(q) ||
                        formatJanusTicketDisplayLabel(t, "repair").toLowerCase().includes(q);
                      
                      const matchesBuilding = selectedBuilding === "All" || t.building_name === selectedBuilding;
                      return matchesSearch && matchesBuilding;
                    })
                    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                    .map((ticket: any) => (
                      <div
                        key={`mobile-repair-${ticket.id}`}
                        className={`bg-white dark:bg-card rounded-2xl shadow-sm border border-border p-4 cursor-pointer ${ticket.status?.toLowerCase() === 'closed' ? 'opacity-60' : ''}`}
                        onClick={() => { setSelectedTicketDetails({...ticket, _type: 'repair'}); setIsTicketDetailsModalOpen(true) }}
                      >
                        <div className="flex justify-between items-start gap-2 mb-2">
                          <p className="font-semibold text-sm line-clamp-2 flex-1">{ticket.title}</p>
                          <Badge variant="secondary" className={`text-[10px] uppercase font-black flex-shrink-0 ${
                            ticket.priority?.toUpperCase() === 'HIGH' ? 'bg-red-50 text-red-700' : 'bg-yellow-50 text-yellow-700'
                          }`}>{ticket.priority || 'MEDIUM'}</Badge>
                        </div>
                        {ticket.description && <p className="text-xs text-muted-foreground italic mb-2 line-clamp-1">{ticket.description}</p>}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span className="font-mono">{formatJanusTicketDisplayLabel(ticket, "repair")}</span>
                            {ticket.building_name && selectedBuilding === "All" && <span>· {ticket.building_name}</span>}
                          </div>
                          {ticket.status?.toLowerCase() !== 'closed' && (
                            <Button size="sm" variant="ghost" className="h-6 text-[10px] gap-1 text-primary"
                              onClick={(e) => { e.stopPropagation(); setSelectedTicketToImport({...ticket, _type: 'repair'}); setIsImportModalOpen(true) }}>
                              <Plus className="h-3 w-3" /> Import
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              </Card>
            )}
          </div>
        )}

        {activeTab === "complaints" && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                Complaints
              </h3>
              {isResyncing && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground animate-pulse">
                  <RefreshCw className="h-3 w-3 animate-spin" />
                  Syncing with Janus...
                </div>
              )}
            </div>
            
            {janusData.complaints.length === 0 ? (
              <Card className="p-20 text-center border-dashed bg-muted/20 rounded-3xl">
                <AlertTriangle className="h-12 w-12 text-muted-foreground/20 mx-auto mb-4" />
                <p className="text-muted-foreground font-medium">No active Janus complaint tickets found for this building.</p>
              </Card>
            ) : (
              <Card className="border-0 bg-card shadow-md">
                {/* Desktop table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full">
                    <thead className="border-b border-border">
                      <tr className="text-left">
                        <th className="px-6 py-4 text-sm font-semibold text-muted-foreground">Ticket</th>
                        {selectedBuilding === "All" && (
                          <th className="px-6 py-4 text-sm font-semibold text-muted-foreground">Building</th>
                        )}
                        <th className="px-6 py-4 text-sm font-semibold text-muted-foreground">Priority</th>
                        <th className="px-6 py-4 text-sm font-semibold text-muted-foreground">Status</th>
                        <th className="px-6 py-4 text-sm font-semibold text-muted-foreground">Budget / Est.</th>
                        <th className="px-6 py-4 text-sm font-semibold text-muted-foreground">Date</th>
                        <th className="px-6 py-4 text-sm font-semibold text-muted-foreground">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {janusData.complaints
                        .filter(t => {
                          const q = searchQuery.toLowerCase();
                          const matchesSearch = !q || 
                            (t.title || "").toLowerCase().includes(q) || 
                            (t.description || "").toLowerCase().includes(q) ||
                            (t.building_name || "").toLowerCase().includes(q) ||
                            formatJanusTicketDisplayLabel(t, "complaint").toLowerCase().includes(q);
                          
                          const matchesBuilding = selectedBuilding === "All" || t.building_name === selectedBuilding;
                          return matchesSearch && matchesBuilding;
                        })
                        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                        .map((ticket: any) => (
                          <tr
                            key={`complaint-${ticket.id}`}
                            className={`border-b border-border hover:bg-muted/50 transition-colors cursor-pointer ${ticket.status?.toLowerCase() === 'closed' ? 'opacity-60' : ''}`}
                            onClick={() => { setSelectedTicketDetails({...ticket, _type: 'complaint'}); setIsTicketDetailsModalOpen(true) }}
                          >
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className={`h-2 w-2 rounded-full flex-shrink-0 ${ticket.status?.toLowerCase() === 'closed' ? 'bg-muted-foreground/40' : 'bg-amber-500'}`} />
                                <div>
                                  <p className="font-medium text-foreground text-sm line-clamp-1">{ticket.title}</p>
                                  {ticket.description && (
                                    <p className="text-xs text-muted-foreground line-clamp-1 italic mt-0.5">{ticket.description}</p>
                                  )}
                                  <p className="text-[10px] font-mono text-muted-foreground mt-0.5">{formatJanusTicketDisplayLabel(ticket, "complaint")}</p>
                                </div>
                              </div>
                            </td>
                            {selectedBuilding === "All" && (
                              <td className="px-6 py-4 text-sm text-muted-foreground">{ticket.building_name || '—'}</td>
                            )}
                            <td className="px-6 py-4">
                              <Badge variant="secondary" className={`text-[10px] uppercase font-black tracking-wider ${
                                ticket.priority?.toUpperCase() === 'HIGH' ? 'bg-red-50 text-red-700 border-red-100' :
                                'bg-amber-100 text-amber-700'
                              }`}>
                                {ticket.priority || 'MEDIUM'}
                              </Badge>
                            </td>
                            <td className="px-6 py-4">
                              <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${
                                ticket.status?.toLowerCase() === 'closed' ? 'bg-muted text-muted-foreground border-border' :
                                ticket.status?.toLowerCase() === 'in_progress' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                                'bg-amber-50 text-amber-700 border-amber-100'
                              }`}>
                                {ticket.status || 'Open'}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex flex-col gap-0.5">
                                {ticket.budget && <span className="text-xs text-green-700 font-bold">${ticket.budget}</span>}
                                {ticket.estimated_cost && <span className="text-xs text-blue-600">Est: ${ticket.estimated_cost}</span>}
                                {!ticket.budget && !ticket.estimated_cost && <span className="text-xs text-muted-foreground">—</span>}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-sm text-muted-foreground whitespace-nowrap">
                              {ticket.created_at ? new Date(ticket.created_at).toLocaleDateString() : '—'}
                            </td>
                            <td className="px-6 py-4">
                              {ticket.status?.toLowerCase() !== 'closed' && (
                                <Button
                                  size="sm" variant="ghost"
                                  className="h-7 text-[10px] gap-1 text-amber-600 hover:bg-amber-50"
                                  onClick={(e) => { e.stopPropagation(); setSelectedTicketToImport({...ticket, _type: 'complaint'}); setIsImportModalOpen(true) }}
                                >
                                  <Plus className="h-3 w-3" /> Import
                                </Button>
                              )}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
                {/* Mobile card view */}
                <div className="md:hidden p-3 space-y-3">
                  {janusData.complaints
                    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                    .map((ticket: any) => (
                      <div
                        key={`mobile-complaint-${ticket.id}`}
                        className={`bg-white dark:bg-card rounded-2xl shadow-sm border border-border p-4 cursor-pointer ${ticket.status?.toLowerCase() === 'closed' ? 'opacity-60' : ''}`}
                        onClick={() => { setSelectedTicketDetails({...ticket, _type: 'complaint'}); setIsTicketDetailsModalOpen(true) }}
                      >
                        <div className="flex justify-between items-start gap-2 mb-2">
                          <p className="font-semibold text-sm line-clamp-2 flex-1">{ticket.title}</p>
                          <Badge variant="secondary" className={`text-[10px] uppercase font-black flex-shrink-0 ${
                            ticket.priority?.toUpperCase() === 'HIGH' ? 'bg-red-50 text-red-700' : 'bg-amber-100 text-amber-700'
                          }`}>{ticket.priority || 'MEDIUM'}</Badge>
                        </div>
                        {ticket.description && <p className="text-xs text-muted-foreground italic mb-2 line-clamp-1">{ticket.description}</p>}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span className="font-mono">{formatJanusTicketDisplayLabel(ticket, "complaint")}</span>
                            {ticket.building_name && selectedBuilding === "All" && <span>· {ticket.building_name}</span>}
                          </div>
                          {ticket.status?.toLowerCase() !== 'closed' && (
                            <Button size="sm" variant="ghost" className="h-6 text-[10px] gap-1 text-amber-600"
                              onClick={(e) => { e.stopPropagation(); setSelectedTicketToImport({...ticket, _type: 'complaint'}); setIsImportModalOpen(true) }}>
                              <Plus className="h-3 w-3" /> Import
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              </Card>
            )}
          </div>
        )}
      </div>

      {showEditMeetingModal && selectedMeeting && (
        <EditMeetingModal
          isOpen={showEditMeetingModal}
          onClose={() => {
            setShowEditMeetingModal(false)
            setSelectedMeeting(null)
          }}
          onSuccess={() => {
            fetchMeetings()
            setShowEditMeetingModal(false)
            setSelectedMeeting(null)
          }}
          meeting={{
            id: parseInt(selectedMeeting.id),
            building_id: selectedMeeting.building_id,
            title: selectedMeeting.title,
            meeting_date: selectedMeeting.meeting_date,
            location: selectedMeeting.location,
            start_time: selectedMeeting.start_time,
            meeting_type: selectedMeeting.meeting_type,
            strata_plan_number: selectedMeeting.strata_plan_number,
          }}
        />
      )}

      {isImportModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <Card className="w-full max-w-md p-6 rounded-2xl shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 bg-primary/10 rounded-full flex items-center justify-center">
                <Plus className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-foreground">Import to Meeting</h3>
                <p className="text-xs text-muted-foreground">Add this Janus ticket to an agenda.</p>
              </div>
            </div>

            <div className="space-y-4 my-6">
              <div className="p-3 bg-muted rounded-lg border border-border">
                <p className="text-[10px] font-black uppercase text-muted-foreground mb-1">Ticket Title</p>
                <p className="text-sm font-bold text-foreground">{selectedTicketToImport?.title}</p>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-muted-foreground">Select Target Meeting</label>
                <select 
                  className="w-full h-10 px-3 bg-background border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/20"
                  value={targetMeetingId}
                  onChange={(e) => setTargetMeetingId(e.target.value)}
                >
                  <option value="">-- Choose an upcoming meeting --</option>
                  {meetings
                    .filter(m => m.status !== 'Finalized')
                    .filter(m => {
                      const ticketCid = selectedTicketToImport?.company_id;
                      const meetingCid = m.company_id;
                      
                      // If either is missing, allow the choice (safety fallback)
                      if (ticketCid == null || meetingCid == null) return true;
                      
                      // Filter if both present
                      return String(ticketCid) === String(meetingCid);
                    })
                    .map(m => (
                      <option key={m.id} value={m.id}>
                        [{m.building}] {m.title} ({formatFloatingDate(m.meeting_date, 'short')})
                      </option>
                    ))}
                </select>
                {meetings.filter(m => m.status !== 'Finalized').length === 0 && (
                  <p className="text-[10px] text-red-500 italic">No upcoming meetings found for this building.</p>
                )}
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button 
                variant="outline" 
                className="flex-1" 
                onClick={() => {
                  setIsImportModalOpen(false)
                  setSelectedTicketToImport(null)
                  setTargetMeetingId("")
                }}
              >
                Cancel
              </Button>
              <Button 
                className="flex-1" 
                disabled={!targetMeetingId || isImporting}
                onClick={handleImportToMeeting}
              >
                {isImporting ? "Importing..." : "Add to Agenda"}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {meetingToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md p-6 rounded-2xl shadow-2xl">
            <h3 className="text-lg font-bold text-foreground mb-2">Delete Meeting</h3>
            <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
              Are you sure you want to delete <strong className="text-foreground">{meetingToDelete.title}</strong>?
              This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <Button
                onClick={() => setMeetingToDelete(null)}
                variant="outline"
                disabled={deleting}
                className="flex-1 rounded-xl"
              >
                Cancel
              </Button>
              <Button
                onClick={handleDeleteMeeting}
                disabled={deleting}
                className="flex-1 rounded-xl bg-red-600 hover:bg-red-700 text-white"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {deleting ? "Deleting..." : "Delete"}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {taskToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md p-6 rounded-2xl shadow-2xl">
            <h3 className="text-lg font-bold text-foreground mb-2">Delete Task</h3>
            <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
              Are you sure you want to delete this task: <strong className="text-foreground">{taskToDelete.description}</strong>?
              This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <Button
                onClick={() => setTaskToDelete(null)}
                variant="outline"
                disabled={deleting}
                className="flex-1 rounded-xl"
              >
                Cancel
              </Button>
              <Button
                onClick={handleDeleteTask}
                disabled={deleting}
                className="flex-1 rounded-xl bg-red-600 hover:bg-red-700 text-white"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {deleting ? "Deleting..." : "Delete"}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {selectedTaskId && (
        <TaskDetailsModal
          taskId={selectedTaskId}
          initialData={tasks.find(t => t.id === selectedTaskId)}
          onClose={() => setSelectedTaskId(null)}
          onUpdate={() => {
            fetchTasks()
            setSelectedTaskId(null)
          }}
        />
      )}

      <TicketDetailsModal
        isOpen={isTicketDetailsModalOpen}
        onClose={() => {
          setIsTicketDetailsModalOpen(false)
          setSelectedTicketDetails(null)
        }}
        ticket={selectedTicketDetails}
      />
    </div>
  )
}
