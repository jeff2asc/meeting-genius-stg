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
import { canAccessAdmin, canCreateMeeting, getUserTypeDisplayName } from "@/lib/permissions"
import { Button } from "@/components/ui/button"
import { LogOut, Settings, User, Key, Sparkles, ChevronDown } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

type Screen = "dashboard" | "meeting" | "admin" | "genius-words"

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

  const topicRefreshCallbackRef = useRef<(() => void) | null>(null)

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

  const registerTopicRefresh = (topicId: number, callback: () => void) => {
    topicRefreshCallbackRef.current = callback
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
    if (!canAccessAdmin(currentUser?.user_type)) {
      alert(`${getUserTypeDisplayName(currentUser?.user_type)} cannot access the Admin Panel.`)
      return
    }
    setCurrentScreen("admin")
  }

  const handleGeniusWordsClick = () => {
    setCurrentScreen("genius-words")
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

        {/* User Dropdown Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="outline" 
              size="sm"
              className="bg-background/80 backdrop-blur flex items-center gap-2 px-3 py-2 h-auto"
            >
              {/* Avatar */}
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold text-xs">
                {getInitials(currentUser?.name || 'User')}
              </div>
              
              {/* User name */}
              <span className="text-sm font-medium">
                {currentUser?.name || 'User'}
              </span>
              
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
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
        />
      )}

      {currentScreen === "admin" && userCanAccessAdmin && (
        <AdminPanel onBack={handleBackToDashboard} />
      )}

      {currentScreen === "genius-words" && (
        <GeniusWordsManager onBack={handleBackToDashboard} />
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
