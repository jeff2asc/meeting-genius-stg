"use client"

import { useState, useEffect } from "react"
import { ChevronDown, User, Plus, Search, Calendar, FileText, Eye, Play, Edit2 } from "lucide-react"
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
  const [loading, setLoading] = useState(true)

  // Edit Meeting Modal state
  const [showEditMeetingModal, setShowEditMeetingModal] = useState(false)
  const [selectedMeeting, setSelectedMeeting] = useState<any>(null)

  useEffect(() => {
    fetchBuildings()
  }, [])

  useEffect(() => {
    if (selectedBuilding) {
      fetchMeetings()
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
        setSelectedBuilding(data[0].name)
        if (onBuildingSelected) {
          onBuildingSelected(data[0].name)
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
      const building = buildings.find(b => b.name === selectedBuilding)
      if (!building) return

      const { data, error } = await supabase
        .from('meetings')
        .select('*')
        .eq('building_id', building.id)
        .order('meeting_date', { ascending: false })

      if (error) {
        console.error('Error fetching meetings:', error)
        return
      }

      // <-- FIXED: always include building_id so you avoid the EditMeetingModal error!
      const formattedMeetings = (data || []).map(meeting => ({
        id: String(meeting.id),
        building: selectedBuilding,
        building_id: meeting.building_id, // <-- added this property!
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

  const handleEditMeeting = (meeting: any) => {
    setSelectedMeeting(meeting)
    setShowEditMeetingModal(true)
  }

  const filteredMeetings = meetings.filter((meeting) => {
    const matchesSearch = meeting.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         meeting.date.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesSearch
  })

  type MeetingStatus = "Draft" | "In Progress" | "Finalized"

  const statusStyles: Record<MeetingStatus, string> = {
    Draft: "bg-blue-100 text-blue-800 border-blue-200",
    "In Progress": "bg-green-100 text-green-800 border-green-200",
    Finalized: "bg-purple-100 text-purple-800 border-purple-200",
  }

  // UPDATED: Only show Edit button for meetings NOT finalized
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

    // Show edit only for non-finalized
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
                      {buildings.map((building) => (
                        <button
                          key={building.id}
                          onClick={() => {
                            setSelectedBuilding(building.name)
                            setShowBuildingDropdown(false)
                            if (onBuildingSelected) {
                              onBuildingSelected(building.name)
                            }
                          }}
                          className={`w-full px-4 py-2 text-left hover:bg-muted transition-colors first:rounded-t-lg last:rounded-b-lg ${
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
              {selectedBuilding}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {filteredMeetings.length} meeting{filteredMeetings.length !== 1 ? 's' : ''}
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

        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search meetings by title or date..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground"
            />
          </div>
        </div>

        <Card className="border-0 bg-card shadow-md">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-border">
                <tr className="text-left">
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
                    <td colSpan={4} className="px-6 py-12 text-center">
                      <p className="text-muted-foreground mb-4">
                        {searchQuery 
                          ? `No meetings found matching "${searchQuery}"`
                          : `No meetings found for ${selectedBuilding}`
                        }
                      </p>
                      {userCanCreateMeeting && (
                        <Button
                          onClick={onCreateMeeting}
                          variant="outline"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Create Your First Meeting
                        </Button>
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
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
            building_id: selectedMeeting.building_id, // <- FIXED
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
