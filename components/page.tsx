"use client"

import { useState, useEffect, useRef } from "react"
import Dashboard from "@/components/dashboard"
import MeetingView from "@/components/meeting-view"
import AdminPanel from "@/components/admin-panel"
import TaskModal from "@/components/task-modal"
import NoteModal from "@/components/note-modal"
import DecisionModal from "@/components/decision-modal"
import CreateMeetingModal from "@/components/create-meeting-modal"
import LoginForm from "@/components/login-form"
import { isLoggedIn, getCurrentUser, clearCurrentUser } from "@/lib/supabase"
import { canAccessAdmin, canCreateMeeting, getUserTypeDisplayName } from "@/lib/permissions"
import { Button } from "@/components/ui/button"
import { LogOut, Settings } from "lucide-react"

type Screen = "dashboard" | "meeting" | "admin"

export default function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [currentScreen, setCurrentScreen] = useState<Screen>("dashboard")
  const [showTaskModal, setShowTaskModal] = useState(false)
  const [showNoteModal, setShowNoteModal] = useState(false)
  const [showDecisionModal, setShowDecisionModal] = useState(false)
  const [showCreateMeetingModal, setShowCreateMeetingModal] = useState(false)
  const [selectedMeeting, setSelectedMeeting] = useState<string | null>(null)
  const [selectedTopicId, setSelectedTopicId] = useState<number | null>(null)
  const [selectedMeetingId, setSelectedMeetingId] = useState<number | null>(null)
  const [buildings, setBuildings] = useState<any[]>([])
  const [refreshKey, setRefreshKey] = useState(0)
  const [currentUser, setCurrentUser] = useState<any>(null)

  // Store the callback to refresh TopicCard history
  const topicRefreshCallbackRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    const loggedIn = isLoggedIn()
    setIsAuthenticated(loggedIn)
    if (loggedIn) {
      const user = getCurrentUser()
      setCurrentUser(user)
      
      // Auto-redirect based on user type
      if (user?.user_type === 'attendee') {
        // Attendees start at dashboard (read-only meetings)
        setCurrentScreen("dashboard")
      } else if (user?.user_type === 'vendor') {
        // Vendors start at dashboard (see their tasks)
        setCurrentScreen("dashboard")
      }
    }
  }, [])

  const handleLoginSuccess = () => {
    setIsAuthenticated(true)
    const user = getCurrentUser()
    setCurrentUser(user)
    
    // Set initial screen based on user type
    if (user?.user_type === 'attendee' || user?.user_type === 'vendor') {
      setCurrentScreen("dashboard")
    }
  }

  const handleLogout = () => {
    clearCurrentUser()
    setIsAuthenticated(false)
    setCurrentUser(null)
    setCurrentScreen("dashboard")
  }

  const handleStartMeeting = (meetingId: string) => {
    setSelectedMeeting(meetingId)
    setCurrentScreen("meeting")
  }

  const handleCreateMeeting = () => {
    // Check permission before opening modal
    if (!canCreateMeeting(currentUser?.user_type)) {
      alert(`${getUserTypeDisplayName(currentUser?.user_type)} cannot create meetings.`)
      return
    }
    setShowCreateMeetingModal(true)
  }

  const handleMeetingCreated = () => {
    setShowCreateMeetingModal(false)
    setRefreshKey(prev => prev + 1)
  }

  const handleBackToDashboard = () => {
    setCurrentScreen("dashboard")
    setSelectedMeeting(null)
  }

  // Function to register the refresh callback from TopicCard
  const registerTopicRefresh = (topicId: number, callback: () => void) => {
    topicRefreshCallbackRef.current = callback
  }

  const handleNoteClick = (topicId: number) => {
    setSelectedTopicId(topicId)
    setShowNoteModal(true)
  }

  const handleDecisionClick = (topicId: number) => {
    setSelectedTopicId(topicId)
    // Get meeting ID from the current meeting
    if (selectedMeeting) {
      setSelectedMeetingId(parseInt(selectedMeeting))
    }
    setShowDecisionModal(true)
  }

  const handleTaskClick = (topicId: number) => {
    setSelectedTopicId(topicId)
    setShowTaskModal(true)
  }

  // Called after modal saves successfully
  const handleNoteSave = () => {
    if (topicRefreshCallbackRef.current) {
      topicRefreshCallbackRef.current()
    }
  }

  const handleTaskSave = () => {
    if (topicRefreshCallbackRef.current) {
      topicRefreshCallbackRef.current()
    }
  }

  const handleDecisionSave = () => {
    if (topicRefreshCallbackRef.current) {
      topicRefreshCallbackRef.current()
    }
  }

  const handleAdminClick = () => {
    // Check permission before navigating
    if (!canAccessAdmin(currentUser?.user_type)) {
      alert(`${getUserTypeDisplayName(currentUser?.user_type)} cannot access the Admin Panel.`)
      return
    }
    setCurrentScreen("admin")
  }

  // Permission checks
  const userCanAccessAdmin = canAccessAdmin(currentUser?.user_type)
  const userCanCreateMeeting = canCreateMeeting(currentUser?.user_type)

  if (!isAuthenticated) {
    return <LoginForm onSuccess={handleLoginSuccess} />
  }

  return (
    <main className="min-h-screen bg-background">
      {/* Top Navigation */}
      <div className="fixed top-4 right-4 z-50 flex items-center gap-2">
        {userCanAccessAdmin && currentScreen !== "admin" && (
          <Button
            onClick={handleAdminClick}
            variant="outline"
            size="sm"
            className="bg-background/80 backdrop-blur"
          >
            <Settings className="h-4 w-4 mr-2" />
            Admin
          </Button>
        )}
        <Button
          onClick={handleLogout}
          variant="outline"
          size="sm"
          className="bg-background/80 backdrop-blur"
        >
          <LogOut className="h-4 w-4 mr-2" />
          Logout ({currentUser?.name})
        </Button>
      </div>

      {/* Screen Router */}
      {currentScreen === "dashboard" && (
        <Dashboard 
          key={refreshKey}
          onStartMeeting={handleStartMeeting}
          onCreateMeeting={handleCreateMeeting}
          onBuildingsLoaded={setBuildings}
          userCanCreateMeeting={userCanCreateMeeting}
        />
      )}

      {currentScreen === "meeting" && (
        <MeetingView
          meetingId={selectedMeeting || ""}
          onBack={handleBackToDashboard}
          onTaskClick={handleTaskClick}
          onNoteClick={handleNoteClick}
          onDecisionClick={handleDecisionClick}
          onRegisterTopicRefresh={registerTopicRefresh}
        />
      )}

      {currentScreen === "admin" && userCanAccessAdmin && (
        <AdminPanel onBack={handleBackToDashboard} />
      )}
      
      {/* Modals */}
      {showTaskModal && selectedTopicId && (
        <TaskModal 
          topicId={selectedTopicId}
          onClose={() => {
            setShowTaskModal(false)
            setSelectedTopicId(null)
          }}
          onSave={handleTaskSave}
        />
      )}
      
      {showNoteModal && selectedTopicId && (
        <NoteModal 
          topicId={selectedTopicId}
          onClose={() => {
            setShowNoteModal(false)
            setSelectedTopicId(null)
          }}
          onSave={handleNoteSave}
        />
      )}
      
      {showDecisionModal && selectedTopicId && selectedMeetingId && (
        <DecisionModal 
          topicId={selectedTopicId}
          meetingId={selectedMeetingId}
          isOpen={showDecisionModal}
          onClose={() => {
            setShowDecisionModal(false)
            setSelectedTopicId(null)
            setSelectedMeetingId(null)
          }}
          onSave={() => {
            handleDecisionSave()
            setShowDecisionModal(false)
            setSelectedTopicId(null)
            setSelectedMeetingId(null)
          }}
        />
      )}
      
      {showCreateMeetingModal && userCanCreateMeeting && (
        <CreateMeetingModal
          onClose={() => setShowCreateMeetingModal(false)}
          onSuccess={handleMeetingCreated}
          buildings={buildings}
        />
      )}
    </main>
  )
}
