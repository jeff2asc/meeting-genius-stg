"use client"

import { useState, useEffect } from "react"
import { ChevronDown, User, Plus, Search, Calendar, FileText, Eye, Play, Edit2, CheckSquare, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { supabase, getCurrentUser } from "@/lib/supabase"
import EditMeetingModal from "./EditMeetingModal"
import TaskDetailsModal from "./TaskDetailsModal"

interface DashboardProps {
  onStartMeeting: (meetingId: string) => void
  onCreateMeeting?: () => void
  onBuildingsLoaded?: (buildings: any[]) => void
  onBuildingSelected?: (buildingName: string) => void
  userCanCreateMeeting?: boolean
}

type Tab = "meetings" | "tasks" | "all"

export default function Dashboard({
  onStartMeeting,
  onCreateMeeting,
  onBuildingsLoaded,
  onBuildingSelected,
  userCanCreateMeeting = true
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

  useEffect(() => {
    console.log('🚀 Dashboard mounted - starting fetchBuildings...')
    fetchBuildings()
    fetchCompanyLogo()
  }, [])

  useEffect(() => {
    if (selectedBuilding) {
      console.log('🔄 Selected building changed:', selectedBuilding)
      fetchMeetings()
      fetchTasks()
    }
  }, [selectedBuilding, selectedMeetingType])

  const fetchCompanyLogo = async () => {
    try {
      const currentUser = getCurrentUser()
      if (!currentUser) return

      if (currentUser.user_type === 'master') {
        setCompanyLogo('/MG2 logo.png')
        return
      }

      if (currentUser.company_id) {
        const { data, error } = await supabase
          .from('companies')
          .select('logo_url')
          .eq('id', currentUser.company_id)
          .single()

        if (error) {
          console.error('Error fetching company logo:', error)
          setCompanyLogo('/MG2 logo.png')
          return
        }

        if (data?.logo_url) {
          setCompanyLogo(data.logo_url)
        } else {
          setCompanyLogo('/MG2 logo.png')
        }
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
      console.log('🔍 Current User:', currentUser)

      if (!currentUser) {
        console.error('❌ No current user found!')
        return
      }

      let query = supabase.from('buildings').select('*')

      if (currentUser.user_type === 'master') {
        console.log('👑 Master user - fetching ALL buildings')
        query = query.order('name')
      } else if (currentUser.user_type === 'corporate_administrator') {
        if (currentUser.company_id) {
          console.log('🏢 Corporate Admin - fetching buildings for company_id:', currentUser.company_id)
          query = query.eq('company_id', currentUser.company_id).order('name')
        } else {
          console.warn('⚠️ Corporate Admin has no company_id')
          setBuildings([])
          setLoading(false)
          setSelectedBuilding("All")
          if (onBuildingSelected) {
            onBuildingSelected("All")
          }
          return
        }
      } else if (currentUser.user_type === 'property_manager') {
        console.log('🏘️ Property Manager - fetching buildings for manager_id:', currentUser.id)
        query = query.eq('manager_id', currentUser.id).order('name')
      } else {
        console.log('👤 Regular user - fetching assigned buildings')
        const { data: userBuildings, error: userBuildingsError } = await supabase
          .from('user_buildings')
          .select('building_id')
          .eq('user_id', currentUser.id)

        if (userBuildingsError) {
          console.error('❌ Error fetching user buildings:', userBuildingsError)
          setBuildings([])
          setLoading(false)
          setSelectedBuilding("All")
          if (onBuildingSelected) {
            onBuildingSelected("All")
          }
          return
        }

        const buildingIds = userBuildings?.map(ub => ub.building_id) || []
        console.log('📋 User building IDs:', buildingIds)

        if (buildingIds.length === 0) {
          console.warn('⚠️ User has no buildings assigned')
          setBuildings([])
          setLoading(false)
          setSelectedBuilding("All")
          if (onBuildingSelected) {
            onBuildingSelected("All")
          }
          return
        }

        query = query.in('id', buildingIds).order('name')
      }

      console.log('📤 Executing buildings query...')
      const { data, error } = await query

      console.log('📊 Buildings Query Result:', {
        success: !error,
        error: error,
        buildingCount: data?.length || 0,
        buildings: data
      })

      if (error) {
        console.error('❌ Error fetching buildings:', error)
        setBuildings([])
        setLoading(false)
        setSelectedBuilding("All")
        if (onBuildingSelected) {
          onBuildingSelected("All")
        }
        return
      }

      console.log('✅ Buildings fetched successfully:', data)
      console.log('📍 Setting buildings state with', data?.length || 0, 'buildings')

      setBuildings(data || [])

      if (onBuildingsLoaded) {
        onBuildingsLoaded(data || [])
      }

      setSelectedBuilding("All")
      console.log('✅ Selected building set to "All"')

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
      console.log('🏁 fetchBuildings completed, setting loading = false')
      setLoading(false)
    }
  }

  const fetchMeetings = async () => {
    try {
      console.log('📅 fetchMeetings called for building:', selectedBuilding)
      let query = supabase
        .from('meetings')
        .select('*, buildings(name)')
        .order('meeting_date', { ascending: false })

      if (selectedBuilding !== "All") {
        const building = buildings.find(b => b.name === selectedBuilding)
        if (building) {
          query = query.eq('building_id', building.id)
        }
      } else {
        const buildingIds = buildings.map(b => b.id)
        console.log('🏢 Building IDs for meetings query:', buildingIds)
        if (buildingIds.length > 0) {
          query = query.in('building_id', buildingIds)
        } else {
          console.warn('⚠️ No buildings to fetch meetings for')
          setMeetings([])
          setAvailableMeetingTypes([])
          return
        }
      }

      const { data, error } = await query

      if (error) {
        console.error('❌ Error fetching meetings:', error)
        return
      }

      console.log('✅ Meetings fetched:', data?.length || 0)

      const meetingTypes = Array.from(new Set(data?.map(m => m.meeting_type).filter(Boolean))) as string[]
      setAvailableMeetingTypes(meetingTypes.sort())

      const formattedMeetings = (data || []).map(meeting => ({
        id: String(meeting.id),
        building: meeting.buildings?.name || selectedBuilding,
        building_id: meeting.building_id,
        title: meeting.title,
        date: new Date(meeting.meeting_date).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        }) + (meeting.start_time ? ` at ${meeting.start_time}` : ''),
        meeting_date: meeting.meeting_date,
        location: meeting.location,
        start_time: meeting.start_time,
        meeting_type: meeting.meeting_type,
        strata_plan_number: meeting.strata_plan_number,
        status: meeting.status === 'working_agenda' ? 'Draft' :
          meeting.status === 'agenda' ? 'In Progress' :
            'Finalized'
      }))

      setMeetings(formattedMeetings)
    } catch (err) {
      console.error('❌ Unexpected error in fetchMeetings:', err)
    }
  }

  const fetchTasks = async () => {
    try {
      let meetingQuery = supabase
        .from('meetings')
        .select('id')

      if (selectedBuilding !== "All") {
        const building = buildings.find(b => b.name === selectedBuilding)
        if (building) {
          meetingQuery = meetingQuery.eq('building_id', building.id)
        }
      } else {
        const buildingIds = buildings.map(b => b.id)
        if (buildingIds.length > 0) {
          meetingQuery = meetingQuery.in('building_id', buildingIds)
        } else {
          setTasks([])
          return
        }
      }

      const { data: meetingsData, error: meetingsError } = await meetingQuery

      if (meetingsError) {
        console.error('Error fetching meetings for tasks:', meetingsError)
        return
      }

      const meetingIds = (meetingsData || []).map(m => m.id)

      if (meetingIds.length === 0) {
        setTasks([])
        return
      }

      const { data: topicsData, error: topicsError } = await supabase
        .from('topics')
        .select('id, title, meeting_id, meetings(id, title, building_id, buildings(name))')
        .in('meeting_id', meetingIds)

      if (topicsError) {
        console.error('Error fetching topics:', topicsError)
        return
      }

      const topicIds = (topicsData || []).map(t => t.id)

      if (topicIds.length === 0) {
        setTasks([])
        return
      }

      const { data: tasksData, error: tasksError } = await supabase
        .from('tasks')
        .select('*')
        .in('topic_id', topicIds)
        .order('created_at', { ascending: false })

      if (tasksError) {
        console.error('Error fetching tasks:', tasksError)
        return
      }

      const formattedTasks = (tasksData || []).map(task => {
        const topic = topicsData?.find(t => t.id === task.topic_id)
        const meeting = topic?.meetings as any
        const building = meeting?.buildings as any

        return {
          id: task.id,
          description: task.description,
          building: building?.name || 'Unknown',
          meeting: meeting?.title || 'Unknown Meeting',
          topic: topic?.title || 'Unknown Topic',
          assigned_name: task.assigned_name,
          assigned_email: task.assigned_email,
          assignees: task.assignees || [],
          status: task.status,
          due_date: task.due_date,
          created_at: task.created_at
        }
      })

      setTasks(formattedTasks)
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
      const { error } = await supabase
        .from('meetings')
        .delete()
        .eq('id', parseInt(meetingToDelete.id))

      if (error) {
        console.error('Error deleting meeting:', error)
        alert('Failed to delete meeting. Please try again.')
      } else {
        await fetchMeetings()
        setMeetingToDelete(null)
      }
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
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskToDelete.id)

      if (error) {
        console.error('Error deleting task:', error)
        alert('Failed to delete task. Please try again.')
      } else {
        await fetchTasks()
        setTaskToDelete(null)
      }
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

  const handleMeetingTypeSelect = (meetingType: string) => {
    setSelectedMeetingType(meetingType)
    setShowMeetingTypeDropdown(false)
  }

  const filteredMeetings = meetings.filter((meeting) => {
    const matchesSearch =
      meeting.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      meeting.date.toLowerCase().includes(searchQuery.toLowerCase()) ||
      meeting.building.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesMeetingType = selectedMeetingType === "All" || meeting.meeting_type === selectedMeetingType
    return matchesSearch && matchesMeetingType
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

  // Filter tasks by search and assignee
  const filteredTasks = tasks.filter((task) => {
    const q = searchQuery.toLowerCase()

    const matchesSearch =
      task.description.toLowerCase().includes(q) ||
      task.building.toLowerCase().includes(q) ||
      task.assigned_name?.toLowerCase().includes(q)

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

    return matchesSearch && matchesAssignee
  })

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
        primaryButton = (
          <Button
            onClick={() => onStartMeeting(meeting.id)}
            size="sm"
            className="bg-task-green text-white hover:bg-task-green/90"
          >
            <Play className="h-4 w-4 mr-2" />
            Continue
          </Button>
        )
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

    const showEdit = userCanCreateMeeting && meeting.status !== "Finalized"

    return (
      <div className="flex items-center gap-2">
        {primaryButton}
        {showEdit && (
          <>
            <Button
              onClick={() => handleEditMeeting(meeting)}
              size="sm"
              variant="ghost"
              className="hover:bg-muted"
              title="Edit Meeting Details"
            >
              <Edit2 className="h-4 w-4" />
            </Button>
            <Button
              onClick={() => setMeetingToDelete(meeting)}
              size="sm"
              variant="ghost"
              className="hover:bg-red-50 text-red-600 hover:text-red-700"
              title="Delete Meeting"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>
    )
  }

  console.log('🎨 Rendering dashboard - loading:', loading, 'buildings:', buildings.length, 'selectedBuilding:', selectedBuilding)

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted">
      {/* HEADER - Only MG Logo */}
      <header className="border-b border-border bg-card shadow-sm">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img
                src="/MG2 logo.png"
                alt="Meeting Genius Logo"
                className="h-10 w-auto object-contain"
              />
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* NEW LAYOUT: Logo LEFT, Title CENTER, Dropdown + Button RIGHT */}
        <div className="mb-6 flex items-center justify-between">
          {/* LEFT: Company Logo */}
          <div className="flex items-center">
            {companyLogo && (
              <img
                src={companyLogo}
                alt="Company Logo"
                className="h-16 w-16 rounded-full object-cover border-2 border-border shadow-sm"
              />
            )}
          </div>

          {/* CENTER: Building Name + Count */}
          <div className="flex-1 text-center">
            <h2 className="text-2xl font-bold text-foreground">
              {selectedBuilding === "All" ? "All Buildings" : selectedBuilding}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {activeTab === "meetings" && `${filteredMeetings.length} meeting${filteredMeetings.length !== 1 ? 's' : ''}`}
              {activeTab === "tasks" && `${filteredTasks.length} task${filteredTasks.length !== 1 ? 's' : ''}`}
              {activeTab === "all" && `${filteredMeetings.length} meetings, ${filteredTasks.length} tasks`}
            </p>
          </div>

          {/* RIGHT: All Dropdown + New Meeting Button (stacked) */}
          <div className="flex flex-col items-end gap-2">
            {/* Building Dropdown */}
            <div className="relative">
              <Button
                variant="outline"
                className="flex items-center gap-2 bg-card min-w-[180px] justify-center"
                onClick={(e) => {
                  e.stopPropagation()
                  console.log('🔽 Building dropdown clicked')
                  setShowBuildingDropdown(!showBuildingDropdown)
                }}
              >
                {selectedBuilding || "Select Building"}
                <ChevronDown className="h-4 w-4" />
              </Button>
              {showBuildingDropdown && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowBuildingDropdown(false)}
                  />
                  <div className="absolute right-0 mt-2 w-56 bg-card border border-border rounded-lg shadow-lg z-50">
                    <button
                      onClick={() => handleBuildingSelect("All")}
                      className={`w-full px-4 py-2 text-left hover:bg-muted transition-colors first:rounded-t-lg ${selectedBuilding === "All" ? "bg-muted font-semibold" : ""
                        }`}
                    >
                      All Buildings
                    </button>
                    {buildings.map((building) => (
                      <button
                        key={building.id}
                        onClick={() => handleBuildingSelect(building.name)}
                        className={`w-full px-4 py-2 text-left hover:bg-muted transition-colors last:rounded-b-lg ${building.name === selectedBuilding ? "bg-muted font-semibold" : ""
                          }`}
                      >
                        {building.name}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* New Meeting Button */}
            {userCanCreateMeeting && (
              <Button
                onClick={onCreateMeeting}
                disabled={buildings.length === 0}
                className="bg-gradient-to-r from-primary to-decision-purple text-primary-foreground hover:opacity-90 disabled:opacity-50 min-w-[180px]"
              >
                <Plus className="h-4 w-4 mr-2" />
                New Meeting
              </Button>
            )}
          </div>
        </div>

        <div className="mb-6 border-b border-border">
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
          </div>
        </div>

        {/* ✅ FIX: Added items-center to align search bar and assignee dropdown */}
        <div className="mb-6 flex gap-3 flex-wrap items-center">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder={`Search ${activeTab}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground"
            />
          </div>

          {(activeTab === "meetings" || activeTab === "all") && availableMeetingTypes.length > 0 && (
            <div className="relative">
              <Button
                variant="outline"
                className="flex items-center gap-2 bg-card"
                onClick={(e) => {
                  e.stopPropagation()
                  setShowMeetingTypeDropdown(!showMeetingTypeDropdown)
                }}
              >
                {selectedMeetingType === "All" ? "All Types" : selectedMeetingType}
                <ChevronDown className="h-4 w-4" />
              </Button>
              {showMeetingTypeDropdown && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowMeetingTypeDropdown(false)}
                  />
                  <div className="absolute right-0 mt-2 w-56 bg-card border border-border rounded-lg shadow-lg z-50">
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

          {/* ✅ FIX: Removed label and flex-col, now just a plain div with the select */}
          {(activeTab === "tasks" || activeTab === "all") && (
            <div className="min-w-[220px]">
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
            <div className="overflow-x-auto">
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
                          <span className={`px-3 py-1 rounded-full text-xs font-medium border ${statusStyles[meeting.status as MeetingStatus]}`}>
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
            <div className="overflow-x-auto">
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
                          key={task.id} 
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
          </Card>
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

      {meetingToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md p-6 m-4">
            <h3 className="text-lg font-semibold text-foreground mb-2">Delete Meeting</h3>
            <p className="text-muted-foreground mb-4">
              Are you sure you want to delete <strong>{meetingToDelete.title}</strong>?
              This action cannot be undone and will also delete all associated topics, tasks, decisions, and notes.
            </p>
            <div className="flex gap-3 justify-end">
              <Button
                onClick={() => setMeetingToDelete(null)}
                variant="outline"
                disabled={deleting}
              >
                Cancel
              </Button>
              <Button
                onClick={handleDeleteMeeting}
                disabled={deleting}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {deleting ? "Deleting..." : "Delete Meeting"}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {taskToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md p-6 m-4">
            <h3 className="text-lg font-semibold text-foreground mb-2">Delete Task</h3>
            <p className="text-muted-foreground mb-4">
              Are you sure you want to delete this task: <strong>{taskToDelete.description}</strong>?
              This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <Button
                onClick={() => setTaskToDelete(null)}
                variant="outline"
                disabled={deleting}
              >
                Cancel
              </Button>
              <Button
                onClick={handleDeleteTask}
                disabled={deleting}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {deleting ? "Deleting..." : "Delete Task"}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {selectedTaskId && (
        <TaskDetailsModal
          taskId={selectedTaskId}
          onClose={() => setSelectedTaskId(null)}
          onUpdate={() => {
            fetchTasks()
            setSelectedTaskId(null)
          }}
        />
      )}
    </div>
  )
}
