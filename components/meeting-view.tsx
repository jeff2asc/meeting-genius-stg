"use client"

import { useState, useEffect } from "react"
import { ArrowLeft, Plus, ChevronDown, ChevronRight, Calendar, Clock, MapPin, FileText, Users, Edit2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import TopicCard from "./topic-card"
import Timer from "./timer"
import CreateSectionModal from "./create-section-modal"
import CreateTopicModal from "./create-topic-modal"
import EditMeetingModal from "./EditMeetingModal"
import { supabase, getCurrentUser } from "@/lib/supabase"
import { canEditMeeting, isReadOnly } from "@/lib/permissions"

interface MeetingViewProps {
  meetingId: string
  onBack: () => void
  onTaskClick: (topicId: number) => void
  onNoteClick: (topicId: number) => void
  onDecisionClick: (topicId: number) => void
}

interface Topic {
  id: number
  title: string
  description: string | null
  section_id: number | null
  attachments: number
  tasks: number
  decisions: number
}

interface Section {
  id: number
  title: string
  order_index: number
  topics: Topic[]
  isExpanded: boolean
}

export default function MeetingView({ 
  meetingId, 
  onBack, 
  onTaskClick,
  onNoteClick,
  onDecisionClick 
}: MeetingViewProps) {
  const [meeting, setMeeting] = useState<any>(null)
  const [sections, setSections] = useState<Section[]>([])
  const [elapsedTime, setElapsedTime] = useState(0)
  const [isRecording, setIsRecording] = useState(false)
  const [timerInterval, setTimerInterval] = useState<NodeJS.Timeout | null>(null)
  const [isMounted, setIsMounted] = useState(false)
  const [loading, setLoading] = useState(true)
  
  // Modal states
  const [showCreateSectionModal, setShowCreateSectionModal] = useState(false)
  const [showCreateTopicModal, setShowCreateTopicModal] = useState(false)
  const [showEditMeetingModal, setShowEditMeetingModal] = useState(false)
  const [selectedSection, setSelectedSection] = useState<{ id: number; title: string } | null>(null)

  // Permission checks
  const currentUser = getCurrentUser()
  const userCanEdit = currentUser ? canEditMeeting(currentUser.user_type) : false
  const userIsReadOnly = currentUser ? isReadOnly(currentUser.user_type) : false

  // DEBUG LOG
  console.log('🔍 Meeting View Permissions:', { 
    currentUser, 
    userCanEdit, 
    userIsReadOnly,
    userType: currentUser?.user_type 
  })

  useEffect(() => {
    setIsMounted(true)
  }, [])

  useEffect(() => {
    if (meetingId) {
      fetchMeetingData()
    }
  }, [meetingId])

  const fetchMeetingData = async () => {
    try {
      setLoading(true)

      const { data: meetingData, error: meetingError } = await supabase
        .from('meetings')
        .select('*, buildings(name)')
        .eq('id', meetingId)
        .single()

      if (meetingError) {
        console.error('Error fetching meeting:', meetingError)
        return
      }

      setMeeting({
        title: meetingData.title,
        building: meetingData.buildings?.name || 'Unknown',
        meeting_date: meetingData.meeting_date,
        location: meetingData.location,
        start_time: meetingData.start_time,
        meeting_type: meetingData.meeting_type,
        strata_plan_number: meetingData.strata_plan_number,
        status: meetingData.status,
      })

      await fetchSectionsAndTopics()

    } catch (err) {
      console.error('Unexpected error:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchSectionsAndTopics = async () => {
    try {
      // Fetch sections
      const { data: sectionsData, error: sectionsError } = await supabase
        .from('sections')
        .select('*')
        .eq('meeting_id', meetingId)
        .order('order_index')

      if (sectionsError) {
        console.error('Error fetching sections:', sectionsError)
        return
      }

      // Fetch topics
      const { data: topicsData, error: topicsError } = await supabase
        .from('topics')
        .select(`
          *,
          notes(count),
          tasks(count),
          decisions(count)
        `)
        .eq('meeting_id', meetingId)
        .order('order_index')

      if (topicsError) {
        console.error('Error fetching topics:', topicsError)
        return
      }

      // Group topics by section
      const sectionsWithTopics: Section[] = (sectionsData || []).map(section => ({
        id: section.id,
        title: section.title,
        order_index: section.order_index,
        isExpanded: true,
        topics: (topicsData || [])
          .filter(topic => topic.section_id === section.id)
          .map(topic => ({
            id: topic.id,
            title: topic.title,
            description: topic.description,
            section_id: topic.section_id,
            attachments: 0,
            tasks: topic.tasks?.[0]?.count || 0,
            decisions: topic.decisions?.[0]?.count || 0,
          }))
      }))

      setSections(sectionsWithTopics)
    } catch (err) {
      console.error('Unexpected error fetching sections/topics:', err)
    }
  }

  const toggleSection = (sectionId: number) => {
    setSections(sections.map(s => 
      s.id === sectionId ? { ...s, isExpanded: !s.isExpanded } : s
    ))
  }

  const handleAddTopic = (sectionId: number, sectionTitle: string) => {
    if (!userCanEdit) {
      alert('You do not have permission to add topics.')
      return
    }
    setSelectedSection({ id: sectionId, title: sectionTitle })
    setShowCreateTopicModal(true)
  }

  const updateTopic = async (id: number, updates: Partial<Topic>) => {
    if (!userCanEdit) {
      alert('You do not have permission to edit topics.')
      return
    }

    try {
      const { error } = await supabase
        .from('topics')
        .update({
          title: updates.title,
          description: updates.description,
        })
        .eq('id', id)

      if (error) {
        console.error('Error updating topic:', error)
        return
      }

      await fetchSectionsAndTopics()

    } catch (err) {
      console.error('Unexpected error:', err)
    }
  }

  const deleteTopic = async (id: number) => {
    if (!userCanEdit) {
      alert('You do not have permission to delete topics.')
      return
    }

    try {
      const { error } = await supabase
        .from('topics')
        .delete()
        .eq('id', id)

      if (error) {
        console.error('Error deleting topic:', error)
        return
      }

      console.log('Topic deleted:', id)
      await fetchSectionsAndTopics()

    } catch (err) {
      console.error('Unexpected error:', err)
    }
  }

  const handleStartRecording = () => {
    if (!userCanEdit) {
      alert('You do not have permission to record meetings.')
      return
    }

    setIsRecording(true)
    setElapsedTime(0)
    
    const interval = setInterval(() => {
      setElapsedTime(prev => prev + 1)
    }, 1000)
    setTimerInterval(interval)
    
    console.log("🎙️ Recording started")
  }

  const handleStopRecording = () => {
    setIsRecording(false)
    
    if (timerInterval) {
      clearInterval(timerInterval)
      setTimerInterval(null)
    }
    
    console.log("⏹️ Recording stopped. Duration:", elapsedTime, "seconds")
  }

  const handleCreateSection = () => {
    if (!userCanEdit) {
      alert('You do not have permission to create sections.')
      return
    }
    setShowCreateSectionModal(true)
  }

  // Helper function to format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { 
      weekday: 'long',
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    })
  }

  // Helper function to format time
  const formatTime = (timeString: string) => {
    if (!timeString) return null
    const [hours, minutes] = timeString.split(':')
    const hour = parseInt(hours)
    const ampm = hour >= 12 ? 'PM' : 'AM'
    const displayHour = hour % 12 || 12
    return `${displayHour}:${minutes} ${ampm}`
  }

  // Helper function to get status badge color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'working_agenda':
        return 'bg-blue-100 text-blue-800'
      case 'agenda':
        return 'bg-green-100 text-green-800'
      case 'working_minutes':
        return 'bg-yellow-100 text-yellow-800'
      case 'minutes':
        return 'bg-purple-100 text-purple-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  // Helper function to get status display text
  const getStatusText = (status: string) => {
    switch (status) {
      case 'working_agenda':
        return 'Working Agenda'
      case 'agenda':
        return 'Agenda'
      case 'working_minutes':
        return 'Working Minutes'
      case 'minutes':
        return 'Minutes'
      default:
        return status
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

  const totalTopics = sections.reduce((sum, section) => sum + section.topics.length, 0)

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted">
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
                  
                  {/* DEBUG: Show userCanEdit value */}
                  <span className="text-xs bg-red-100 px-2 py-1 rounded">
                    DEBUG: userCanEdit={String(userCanEdit)}
                  </span>
                  
                  {userCanEdit && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        console.log('✏️ Edit button clicked!')
                        setShowEditMeetingModal(true)
                      }}
                      className="hover:bg-muted border border-blue-500"
                      title="Edit Meeting"
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                  )}
                  
                  {!userCanEdit && (
                    <span className="text-xs bg-yellow-100 px-2 py-1 rounded">
                      Edit button hidden - userCanEdit is false
                    </span>
                  )}
                  
                  {userIsReadOnly && (
                    <Badge variant="outline" className="bg-yellow-100 text-yellow-800">
                      Read-Only
                    </Badge>
                  )}
                  <Badge variant="outline" className={getStatusColor(meeting.status)}>
                    {getStatusText(meeting.status)}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{meeting.building}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {userCanEdit && (
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

          {/* Meeting Details Row */}
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

      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        {sections.length > 0 ? (
          <div className="space-y-6">
            {sections.map((section) => (
              <div key={section.id}>
                {/* Section Header */}
                <Card className="border-0 bg-gradient-to-r from-primary/10 to-decision-purple/10 mb-3">
                  <button
                    onClick={() => toggleSection(section.id)}
                    className="w-full p-4 flex items-center justify-between hover:bg-muted/20 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {section.isExpanded ? (
                        <ChevronDown className="h-5 w-5 text-primary" />
                      ) : (
                        <ChevronRight className="h-5 w-5 text-primary" />
                      )}
                      <h2 className="text-lg font-bold text-foreground">{section.title}</h2>
                      <span className="text-sm text-muted-foreground">
                        ({section.topics.length} {section.topics.length === 1 ? 'topic' : 'topics'})
                      </span>
                    </div>
                    {userCanEdit && (
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
                  </button>
                </Card>

                {/* Section Topics */}
                {section.isExpanded && (
                  <div className="space-y-4 ml-8">
                    {section.topics.length > 0 ? (
                      section.topics.map((topic, index) => (
                        <TopicCard
                          key={topic.id}
                          topic={topic}
                          topicNumber={index + 1}
                          onUpdate={(updates) => updateTopic(topic.id, updates)}
                          onDelete={(id) => deleteTopic(id)}
                          onTaskClick={() => onTaskClick(topic.id)}
                          onNoteClick={() => onNoteClick(topic.id)}
                          onDecisionClick={() => onDecisionClick(topic.id)}
                          isReadOnly={userIsReadOnly}
                        />
                      ))
                    ) : (
                      <div className="text-center py-8 text-muted-foreground border-2 border-dashed border-border rounded-lg">
                        {userCanEdit 
                          ? 'No topics in this section yet. Click "Add Topic" to create one.'
                          : 'No topics in this section yet.'}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-muted-foreground mb-4">
              {userCanEdit 
                ? 'No sections found for this meeting.'
                : 'No sections in this meeting yet.'}
            </p>
            {userCanEdit && (
              <Button
                onClick={handleCreateSection}
                className="bg-gradient-to-r from-primary to-decision-purple text-primary-foreground"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create First Section
              </Button>
            )}
          </div>
        )}
      </div>

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
            setShowCreateTopicModal(false)
            setSelectedSection(null)
          }}
        />
      )}

      {/* Edit Meeting Modal */}
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
            title: meeting.title,
            meeting_date: meeting.meeting_date,
            location: meeting.location,
            start_time: meeting.start_time,
            meeting_type: meeting.meeting_type,
            strata_plan_number: meeting.strata_plan_number,
          }}
        />
      )}
    </div>
  )
}