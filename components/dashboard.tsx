"use client"

import { useState, useEffect } from "react"
import { ChevronDown, User, Plus, Search, Calendar, FileText, Eye, Play, Edit2, CheckSquare } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { supabase, getCurrentUser } from "@/lib/supabase"
import EditMeetingModal from "./EditMeetingModal"

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
  const [searchQuery, setSearchQuery] = useState("")
  const [buildings, setBuildings] = useState<any[]>([])
  const [meetings, setMeetings] = useState<any[]>([])
  const [tasks, setTasks] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>("meetings")

  // Edit Meeting Modal state
  const [showEditMeetingModal, setShowEditMeetingModal] = useState(false)
  const [selectedMeeting, setSelectedMeeting] = useState<any>(null)

  useEffect(() => {
    fetchBuildings()
  }, [])

  useEffect(() => {
    if (selectedBuilding) {
      fetchMeetings()
      fetchTasks()
    }
  }, [selectedBuilding])

  const fetchBuildings = async () => {
    try {
      const currentUser = getCurrentUser()
      if (!currentUser) return

      let query = supabase.from('buildings').select('*')

      // Filter based on user type
      if (currentUser.user_type === 'master') {
        query = query.order('name')
      } else if (currentUser.user_type === 'corporate_administrator') {
        if (currentUser.company_id) {
          query = query.eq('company_id', currentUser.company_id).order('name')
        } else {
          console.warn('Corporate Admin has no company_id')
          setBuildings([])
          setLoading(false)
          return
        }
      } else if (currentUser.user_type === 'property_manager') {
        query = query.eq('manager_id', currentUser.id).order('name')
      } else {
        const { data: userBuildings, error: userBuildingsError } = await supabase
          .from('user_buildings')
          .select('building_id')
          .eq('user_id', currentUser.id)

        if (userBuildingsError) {
          console.error('Error fetching user buildings:', userBuildingsError)
          setBuildings([])
          setLoading(false)
          return
        }

        const buildingIds = userBuildings?.map(ub => ub.building_id) || []
        if (buildingIds.length === 0) {
          setBuildings([])
          setLoading(false)
          return
        }

        query = query.in('id', buildingIds).order('name')
      }

      const { data, error } = await query

      if (error) {
        console.error('Error fetching buildings:', error)
        setBuildings([])
        setLoading(false)
        return
      }

      setBuildings(data || [])
      if (onBuildingsLoaded) {
        onBuildingsLoaded(data || [])
      }

      if (data && data.length > 0) {
        setSelectedBuilding("All") // Default to "All"
        if (onBuildingSelected) {
          onBuildingSelected("All")
        }
      }
    } catch (err) {
      console.error('Unexpected error:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchMeetings = async () => {
    try {
      let query = supabase
        .from('meetings')
        .select('*, buildings(name)')
        .order('meeting_date', { ascending: false })

      // Filter by building if not "All"
      if (selectedBuilding !== "All") {
        const building = buildings.find(b => b.name === selectedBuilding)
        if (building) {
          query = query.eq('building_id', building.id)
        }
      } else {
        // Get all buildings' IDs that user has access to
        const buildingIds = buildings.map(b => b.id)
        if (buildingIds.length > 0) {
          query = query.in('building_id', buildingIds)
        }
      }

      const { data, error } = await query

      if (error) {
        console.error('Error fetching meetings:', error)
        return
      }

      const formattedMeetings = (data || []).map(meeting => ({
        id: String(meeting.id),
        building: meeting.buildings?.name || selectedBuilding,
        building_id: meeting.building_id,
        title: meeting.title,
        date: new Date(meeting.meeting_date).toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric', 
          year: 'numeric' 
        }),
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
      console.error('Unexpected error:', err)
    }
  }

  const fetchTasks = async () => {
    try {
      // First, get all meetings for the selected building(s)
      let meetingQuery = supabase
        .from('meetings')
        .select('id')
  
      if (selectedBuilding !== "All") {
        const building = buildings.find(b => b.name === selectedBuilding)
        if (building) {
          meetingQuery = meetingQuery.eq('building_id', building.id)
        }
      } else {
        // Get all buildings' IDs that user has access to
        const buildingIds = buildings.map(b => b.id)
        if (buildingIds.length > 0) {
          meetingQuery = meetingQuery.in('building_id', buildingIds)
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
  
      // Now get topics from those meetings
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
  
      // Finally get tasks from those topics
      const { data: tasksData, error: tasksError } = await supabase
        .from('tasks')
        .select('*')
        .in('topic_id', topicIds)
        .order('created_at', { ascending: false })
  
      if (tasksError) {
        console.error('Error fetching tasks:', tasksError)
        return
      }
  
      // Map tasks with their topic/meeting/building info
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

  const handleBuildingSelect = (buildingName: string) => {
    setSelectedBuilding(buildingName)
    setShowBuildingDropdown(false)
    if (onBuildingSelected) {
      onBuildingSelected(buildingName)
    }
  }

  const filteredMeetings = meetings.filter((meeting) => {
    const matchesSearch = meeting.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         meeting.date.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         meeting.building.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesSearch
  })

  const filteredTasks = tasks.filter((task) => {
    const matchesSearch = task.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         task.building.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         task.assigned_name?.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesSearch
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
          <Button
            onClick={() => handleEditMeeting(meeting)}
            size="sm"
            variant="ghost"
            className="hover:bg-muted"
            title="Edit Meeting Details"
          >
            <Edit2 className="h-4 w-4" />
          </Button>
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
            <div className="flex items-center gap-4">
              <div className="relative">
                <Button
                  variant="outline"
                  className="flex items-center gap-2 bg-card"
                  onClick={(e) => {
                    e.stopPropagation()
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
                        className={`w-full px-4 py-2 text-left hover:bg-muted transition-colors first:rounded-t-lg ${
                          selectedBuilding === "All" ? "bg-muted font-semibold" : ""
                        }`}
                      >
                        All Buildings
                      </button>
                      {buildings.map((building) => (
                        <button
                          key={building.id}
                          onClick={() => handleBuildingSelect(building.name)}
                          className={`w-full px-4 py-2 text-left hover:bg-muted transition-colors last:rounded-b-lg ${
                            building.name === selectedBuilding ? "bg-muted font-semibold" : ""
                          }`}
                        >
                          {building.name}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
              <button className="flex h-10 w-10 items-center justify-center rounded-full bg-muted hover:bg-muted/80">
                <User className="h-5 w-5 text-foreground" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-foreground">
              {selectedBuilding === "All" ? "All Buildings" : selectedBuilding}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {activeTab === "meetings" && `${filteredMeetings.length} meeting${filteredMeetings.length !== 1 ? 's' : ''}`}
              {activeTab === "tasks" && `${filteredTasks.length} task${filteredTasks.length !== 1 ? 's' : ''}`}
              {activeTab === "all" && `${filteredMeetings.length} meetings, ${filteredTasks.length} tasks`}
            </p>
          </div>
          {userCanCreateMeeting && (
            <Button
              onClick={onCreateMeeting}
              disabled={buildings.length === 0}
              className="bg-gradient-to-r from-primary to-decision-purple text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              <Plus className="h-4 w-4 mr-2" />
              New Meeting
            </Button>
          )}
        </div>

        {/* Tabs */}
        <div className="mb-6 border-b border-border">
          <div className="flex gap-4">
            <button
              onClick={() => setActiveTab("meetings")}
              className={`pb-3 px-1 font-medium text-sm transition-colors ${
                activeTab === "meetings"
                  ? "border-b-2 border-primary text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Calendar className="h-4 w-4 inline mr-2" />
              Meetings
            </button>
            <button
              onClick={() => setActiveTab("tasks")}
              className={`pb-3 px-1 font-medium text-sm transition-colors ${
                activeTab === "tasks"
                  ? "border-b-2 border-primary text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <CheckSquare className="h-4 w-4 inline mr-2" />
              Tasks
            </button>
            <button
              onClick={() => setActiveTab("all")}
              className={`pb-3 px-1 font-medium text-sm transition-colors ${
                activeTab === "all"
                  ? "border-b-2 border-primary text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <FileText className="h-4 w-4 inline mr-2" />
              All
            </button>
          </div>
        </div>

        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder={`Search ${activeTab}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground"
            />
          </div>
        </div>

        {/* Meetings Tab */}
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
                      <td colSpan={selectedBuilding === "All" ? 5 : 4} className="px-6 py-12 text-center">
                        <p className="text-muted-foreground mb-4">
                          {searchQuery 
                            ? `No meetings found matching "${searchQuery}"`
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

        {/* Tasks Tab */}
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
                  </tr>
                </thead>
                <tbody>
                  {filteredTasks.length > 0 ? (
                    filteredTasks.map((task) => (
                      <tr key={task.id} className="border-b border-border hover:bg-muted/50 transition-colors">
                        {selectedBuilding === "All" && (
                          <td className="px-6 py-4 text-sm text-muted-foreground">{task.building}</td>
                        )}
                        <td className="px-6 py-4">
                          <p className="font-medium text-foreground">{task.description}</p>
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
                        <td className="px-6 py-4 text-sm text-muted-foreground">
                          {task.due_date ? new Date(task.due_date).toLocaleDateString() : '-'}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={selectedBuilding === "All" ? 6 : 5} className="px-6 py-12 text-center">
                        <p className="text-muted-foreground">
                          {searchQuery 
                            ? `No tasks found matching "${searchQuery}"`
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
      
      {/* Edit Meeting Modal */}
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
    </div>
  )
}
