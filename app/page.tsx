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
import ProfileSettingsModal from "@/components/ProfileSettingsModal"
import GeniusWordsManager from "@/components/GeniusWordsManager"
import { isLoggedIn, getCurrentUser, clearCurrentUser } from "@/lib/supabase"
import { canAccessAdmin, canCreateMeeting, getUserTypeDisplayName, canAccessIntegrations } from "@/lib/permissions"
import IntegrationsPage from "@/components/IntegrationsPage"
import { Button } from "@/components/ui/button"
import { LogOut, Settings, User, Sparkles, ChevronDown, Share2 } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

type Screen = "dashboard" | "meeting" | "admin" | "genius-words" | "integrations"

export default function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [currentScreen, setCurrentScreen] = useState<Screen>("dashboard")
  const [showTaskModal, setShowTaskModal] = useState(false)
  const [showNoteModal, setShowNoteModal] = useState(false)
  const [showDecisionModal, setShowDecisionModal] = useState(false)
  const [showCreateMeetingModal, setShowCreateMeetingModal] = useState(false)
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [selectedMeeting, setSelectedMeeting] = useState<string | null>(null)
  const [selectedTopicId, setSelectedTopicId] = useState<number | null>(null)
  const [selectedMeetingId, setSelectedMeetingId] = useState<number | null>(null)
  const [buildings, setBuildings] = useState<any[]>([])
  const [refreshKey, setRefreshKey] = useState(0)
  const [currentUser, setCurrentUser] = useState<any>(null)

  // ⭐ NEW: Decision modal state for edit/threading
  const [decisionEditMode, setDecisionEditMode] = useState(false)
  const [editingDecisionId, setEditingDecisionId] = useState<number | null>(null)
  const [parentDecisionId, setParentDecisionId] = useState<number | null>(null)

  // ⭐ NEW: Task modal state for edit
  const [taskEditMode, setTaskEditMode] = useState(false)
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null)

  // ⭐ NEW: Note modal state for edit
  const [noteEditMode, setNoteEditMode] = useState(false)
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null)

  const topicRefreshCallbackRef = useRef<Map<number, () => void>>(new Map())

  useEffect(() => {
    const loggedIn = isLoggedIn()
    setIsAuthenticated(loggedIn)
    if (loggedIn) {
      const user = getCurrentUser()
      setCurrentUser(user)

      if (user?.user_type === 'attendee') {
        setCurrentScreen("dashboard")
      } else if (user?.user_type === 'vendor') {
        setCurrentScreen("dashboard")
      }
    }
  }, [])

  const handleLoginSuccess = () => {
    setIsAuthenticated(true)
    const user = getCurrentUser()
    setCurrentUser(user)

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
    if (!canCreateMeeting(currentUser)) {
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

  const registerTopicRefresh = (topicId: number, callback: () => void) => {
    topicRefreshCallbackRef.current.set(topicId, callback)
  }

  // ⭐ UPDATED: Note click for new note
  const handleNoteClick = (topicId: number) => {
    setSelectedTopicId(topicId)
    // Reset to create mode
    setNoteEditMode(false)
    setEditingNoteId(null)
    setShowNoteModal(true)
  }

  // ⭐ NEW: Edit existing note
  const handleEditNote = (noteId: number, topicId: number) => {
    console.log('handleEditNote called:', noteId, topicId)
    setSelectedTopicId(topicId)
    setNoteEditMode(true)
    setEditingNoteId(noteId)
    setShowNoteModal(true)
  }

  // ⭐ UPDATED: Decision click for new decision
  const handleDecisionClick = (topicId: number) => {
    console.log('handleDecisionClick called with topicId:', topicId)
    setSelectedTopicId(topicId)
    if (selectedMeeting) {
      setSelectedMeetingId(parseInt(selectedMeeting))
    }
    // Reset to create mode
    setDecisionEditMode(false)
    setEditingDecisionId(null)
    setParentDecisionId(null)
    setShowDecisionModal(true)
  }

  // ⭐ FIXED: Edit existing decision with topicId parameter
  const handleEditDecision = (decisionId: number, topicId: number) => {
    console.log('handleEditDecision called:', decisionId, topicId)
    setSelectedTopicId(topicId)
    if (selectedMeeting) {
      setSelectedMeetingId(parseInt(selectedMeeting))
    }
    setDecisionEditMode(true)
    setEditingDecisionId(decisionId)
    setParentDecisionId(null)
    setShowDecisionModal(true)
  }

  // ⭐ FIXED: Add threaded decision with topicId parameter
  const handleAddThreadedDecision = (parentId: number, topicId: number) => {
    console.log('handleAddThreadedDecision called:', parentId, topicId)
    setSelectedTopicId(topicId)
    if (selectedMeeting) {
      setSelectedMeetingId(parseInt(selectedMeeting))
    }
    setDecisionEditMode(false)
    setEditingDecisionId(null)
    setParentDecisionId(parentId)
    setShowDecisionModal(true)
  }

  // ⭐ UPDATED: Task click for new task
  const handleTaskClick = (topicId: number) => {
    setSelectedTopicId(topicId)
    // Reset to create mode
    setTaskEditMode(false)
    setEditingTaskId(null)
    setShowTaskModal(true)
  }

  // ⭐ NEW: Edit existing task
  const handleEditTask = (taskId: number, topicId: number) => {
    console.log('handleEditTask called:', taskId, topicId)
    setSelectedTopicId(topicId)
    setTaskEditMode(true)
    setEditingTaskId(taskId)
    setShowTaskModal(true)
  }

  const handleNoteSave = (topicId: number) => {
    const callback = topicRefreshCallbackRef.current.get(topicId)
    if (callback) {
      callback()
    }
  }

  const handleTaskSave = () => {
    if (selectedTopicId !== null) {
      const callback = topicRefreshCallbackRef.current.get(selectedTopicId)
      if (callback) callback()
    }
  }

  const handleDecisionSave = () => {
    if (selectedTopicId !== null) {
      const callback = topicRefreshCallbackRef.current.get(selectedTopicId)
      if (callback) callback()
    }
  }

  const handleAdminClick = () => {
    if (!canAccessAdmin(currentUser)) {
      alert(`${getUserTypeDisplayName(currentUser?.user_type)} cannot access the Admin Panel.`)
      return
    }
    setCurrentScreen("admin")
  }

  const handleGeniusWordsClick = () => {
    setCurrentScreen("genius-words")
  }

  const handleIntegrationsClick = () => {
    setCurrentScreen("integrations")
  }

  // Get user initials for avatar
  const getInitials = (name: string) => {
    if (!name) return "U"
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  const userCanAccessAdmin = canAccessAdmin(currentUser)
  const userCanCreateMeeting = canCreateMeeting(currentUser)

  if (!isAuthenticated) {
    return <LoginForm onSuccess={handleLoginSuccess} />
  }

  return (
    <main className="min-h-screen bg-background">
      {/* Top Navigation */}
      <div className="fixed top-2.5 right-2.5 sm:top-4 sm:right-4 z-50 flex items-center gap-1.5 sm:gap-2">
        {userCanAccessAdmin && currentScreen !== "admin" && (
          <Button
            onClick={handleAdminClick}
            variant="outline"
            size="sm"
            className="bg-background/80 backdrop-blur h-8 sm:h-9 px-2 sm:px-3"
          >
            <Settings className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Admin</span>
          </Button>
        )}

        {/* User Dropdown Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="bg-background/80 backdrop-blur flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1 sm:py-2 h-8 sm:h-auto"
            >
              {/* Avatar */}
              <div className="flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold text-[10px] sm:text-xs">
                {getInitials(currentUser?.name || 'User')}
              </div>

              {/* User name */}
              <span className="text-xs sm:text-sm font-medium max-w-[80px] sm:max-w-none truncate">
                {currentUser?.name || 'User'}
              </span>

              <ChevronDown className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">{currentUser?.name}</p>
                <p className="text-xs leading-none text-muted-foreground">
                  {currentUser?.email}
                </p>
                <p className="text-xs leading-none text-muted-foreground">
                  {getUserTypeDisplayName(currentUser?.user_type)}
                </p>
              </div>
            </DropdownMenuLabel>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              onClick={() => setShowProfileModal(true)}
              className="cursor-pointer"
            >
              <User className="mr-2 h-4 w-4" />
              <span>Profile Settings</span>
            </DropdownMenuItem>

            <DropdownMenuItem
              onClick={handleGeniusWordsClick}
              className="cursor-pointer"
            >
              <Sparkles className="mr-2 h-4 w-4" />
              <span>GeniusWords</span>
            </DropdownMenuItem>

            {canAccessIntegrations(currentUser) && (
              <DropdownMenuItem
                onClick={handleIntegrationsClick}
                className="cursor-pointer"
              >
                <Share2 className="mr-2 h-4 w-4" />
                <span>Integrations</span>
              </DropdownMenuItem>
            )}

            <DropdownMenuSeparator />

            <DropdownMenuItem
              onClick={handleLogout}
              className="cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50"
            >
              <LogOut className="mr-2 h-4 w-4" />
              <span>Logout</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
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
          // ⭐ FIXED: Pass handlers with topicId support
          onEditDecision={handleEditDecision}
          onAddThreadedDecision={handleAddThreadedDecision}
          // ⭐ NEW: Pass edit handlers for task and note
          onEditTask={handleEditTask}
          onEditNote={handleEditNote}
          onTopicSave={handleNoteSave}
        />
      )}

      {currentScreen === "admin" && userCanAccessAdmin && (
        <AdminPanel onBack={handleBackToDashboard} />
      )}

      {currentScreen === "genius-words" && (
        <GeniusWordsManager onBack={handleBackToDashboard} />
      )}

      {currentScreen === "integrations" && (
        <IntegrationsPage onBack={handleBackToDashboard} />
      )}

      {/* ⭐ UPDATED: Task Modal with edit mode support */}
      {showTaskModal && selectedTopicId && (
        <TaskModal
          topicId={selectedTopicId}
          onClose={() => {
            setShowTaskModal(false)
            setSelectedTopicId(null)
            setTaskEditMode(false)
            setEditingTaskId(null)
          }}
          onSave={handleTaskSave}
          editMode={taskEditMode}
          existingTaskId={editingTaskId}
        />
      )}

      {/* ⭐ UPDATED: Note Modal with edit mode support */}
      {showNoteModal && selectedTopicId && (
        <NoteModal
          topicId={selectedTopicId}
          onClose={() => {
            setShowNoteModal(false)
            setSelectedTopicId(null)
            setNoteEditMode(false)
            setEditingNoteId(null)
          }}
          onSave={handleNoteSave}
          editMode={noteEditMode}
          existingNoteId={editingNoteId}
        />
      )}

      {/* ⭐ FIXED: Decision Modal with edit/threading support - onSave only calls handleDecisionSave */}
      {showDecisionModal && selectedTopicId && selectedMeetingId && (
        <DecisionModal
          topicId={selectedTopicId}
          meetingId={selectedMeetingId}
          isOpen={showDecisionModal}
          editMode={decisionEditMode}
          existingDecisionId={editingDecisionId}
          parentDecisionId={parentDecisionId}
          onClose={() => {
            setShowDecisionModal(false)
            setSelectedTopicId(null)
            setSelectedMeetingId(null)
            setDecisionEditMode(false)
            setEditingDecisionId(null)
            setParentDecisionId(null)
          }}
          onSave={handleDecisionSave}
        />
      )}

      {showCreateMeetingModal && userCanCreateMeeting && (
        <CreateMeetingModal
          onClose={() => setShowCreateMeetingModal(false)}
          onSuccess={handleMeetingCreated}
          buildings={buildings}
        />
      )}

      {/* Profile Settings Modal */}
      {showProfileModal && currentUser && (
        <ProfileSettingsModal
          user={currentUser}
          onClose={() => setShowProfileModal(false)}
          onUpdate={() => {
            setShowProfileModal(false)
            const updatedUser = getCurrentUser()
            setCurrentUser(updatedUser)
          }}
        />
      )}
    </main>
  )
}
