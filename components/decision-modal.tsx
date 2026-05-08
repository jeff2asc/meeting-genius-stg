"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { X, Trash2 } from "lucide-react"
import { supabase, getCurrentUser, getVotingParameters } from "@/lib/supabase"
import { toast } from "sonner"
import { CheckCircle2, XCircle, AlertCircle, FileText, CheckSquare } from "lucide-react"

interface DecisionModalProps {
  isOpen: boolean
  onClose: () => void
  topicId: number
  meetingId: number | string  // ⭐ UPDATED: Allow string
  onSave?: () => void
  editMode?: boolean
  existingDecisionId?: number | null
  parentDecisionId?: number | null
  embedded?: boolean  // ⭐ NEW
}

interface Attendee {
  name: string
  email?: string
  present: boolean
}

interface GeniusWord {
  id: number
  shortcode: string
  description: string
}

interface Decision {
  id: number
  topic_id: number
  motion_text: string
  result: string | null
  votes_for: number | null
  votes_against: number | null
  votes_abstain: number | null
  parent_decision_id: number | null
  recorded_at: string
  edited_at: string | null
}

export default function DecisionModal({
  isOpen,
  onClose,
  topicId,
  meetingId,
  onSave,
  editMode = false,
  existingDecisionId = null,
  parentDecisionId = null,
  embedded = false  // ⭐ NEW
}: DecisionModalProps) {
  const [motionText, setMotionText] = useState("")
  const [result, setResult] = useState("")
  const [votesFor, setVotesFor] = useState<number | "">("")
  const [votesAgainst, setVotesAgainst] = useState<number | "">("")
  const [votesAbstain, setVotesAbstain] = useState<number | "">("")
  const [status, setStatus] = useState<"open" | "completed">("open")
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [decisionResults, setDecisionResults] = useState<string[]>([])
  const [attendees, setAttendees] = useState<Attendee[]>([])
  const [companyUsers, setCompanyUsers] = useState<any[]>([])
  const [votersFor, setVotersFor] = useState<string[]>([])
  const [votersAgainst, setVotersAgainst] = useState<string[]>([])
  const [votersAbstain, setVotersAbstain] = useState<string[]>([])
  const [openDropdown, setOpenDropdown] = useState<"for" | "against" | "abstain" | null>(null)
  const [votingTypes, setVotingTypes] = useState<string[]>([])
  const [selectedVotingType, setSelectedVotingType] = useState("")
  const [userTypeWeights, setUserTypeWeights] = useState<Record<string, number>>({})
  const [topicTitle, setTopicTitle] = useState<string>("")

  const [parentDecision, setParentDecision] = useState<Decision | null>(null)

  const [showSuggestions, setShowSuggestions] = useState(false)
  const [suggestions, setSuggestions] = useState<any[]>([])
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(0)
  const [cursorPosition, setCursorPosition] = useState(0)
  const [mentionStartIndex, setMentionStartIndex] = useState(-1)

  const [geniusWords, setGeniusWords] = useState<GeniusWord[]>([])
  const [showGeniusSuggestions, setShowGeniusSuggestions] = useState(false)
  const [geniusSuggestions, setGeniusSuggestions] = useState<GeniusWord[]>([])
  const [selectedGeniusIndex, setSelectedGeniusIndex] = useState(0)
  const [geniusStartIndex, setGeniusStartIndex] = useState(-1)
  const [topicNotes, setTopicNotes] = useState<any[]>([])
  const [topicTasks, setTopicTasks] = useState<any[]>([])
  const [showReferences, setShowReferences] = useState(false)

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const suggestionsRef = useRef<HTMLDivElement>(null)
  const geniusSuggestionsRef = useRef<HTMLDivElement>(null)

  const currentUser = getCurrentUser()

  // ⭐ NEW: Don't render if not open (for embedded mode)
  if (!isOpen && !embedded) return null

  useEffect(() => {
    if (isOpen) {
      fetchDecisionResults()
      fetchAttendees()
      fetchCompanyUsers()
      fetchGeniusWords()
      fetchTopicTitle()

      if (editMode && existingDecisionId) {
        loadExistingDecision(existingDecisionId)
      }

      if (parentDecisionId) {
        loadParentDecision(parentDecisionId)
      }
      fetchVotingTypes()
      fetchTopicContent()
    }
  }, [isOpen, meetingId, editMode, existingDecisionId, parentDecisionId, topicId])

  const fetchTopicContent = async () => {
    try {
      const { data: notes } = await supabase
        .from('notes')
        .select('*')
        .eq('topic_id', topicId)
      
      const { data: tasks } = await supabase
        .from('tasks')
        .select('*')
        .eq('topic_id', topicId)

      setTopicNotes(notes || [])
      setTopicTasks(tasks || [])
    } catch (err) {
      console.error('Error fetching topic content:', err)
    }
  }

  const insertReference = (content: string) => {
    const cleanContent = content.trim()
    if (!cleanContent) return
    
    if (motionText.trim()) {
      setMotionText(prev => prev + "\n" + cleanContent)
    } else {
      setMotionText(cleanContent)
    }
    toast.success("Content inserted into motion")
  }

  const fetchTopicTitle = async () => {
    try {
      const { data, error } = await supabase
        .from('topics')
        .select('title')
        .eq('id', topicId)
        .single()

      if (!error && data) {
        setTopicTitle(data.title)
      }
    } catch (err) {
      console.error('Error fetching topic title:', err)
    }
  }

  const fetchVotingTypes = async () => {
    try {
      const meetingIdNum = typeof meetingId === 'string' ? parseInt(meetingId) : meetingId
      const { data: meetingData } = await supabase
        .from("meetings")
        .select("building_id")
        .eq("id", meetingIdNum)
        .single()

      if (meetingData) {
        const { data: buildingData } = await supabase
          .from("buildings")
          .select("company_id")
          .eq("id", meetingData.building_id)
          .single()

        const params = await getVotingParameters(buildingData?.company_id)
        const vTypes = params
          .filter(p => p.parameter_type === 'voting_type')
          .map(p => p.value)
        
        setVotingTypes(vTypes.length > 0 ? vTypes : ["Majority Vote (50%+1)", "Three-Quarter Vote (75%)", "Unanimous Vote (100%)"])
        if (!editMode) {
          setSelectedVotingType(vTypes[0] || "Majority Vote (50%+1)")
        }

        const weights = params
          .filter(p => p.parameter_type === 'user_type')
          .reduce((acc, p) => {
            // Company-specific weights (p.company_id !== null) should always override system defaults
            if (!acc[p.value] || p.company_id !== null) {
              acc[p.value] = (p as any).weight || 1.0;
            }
            return acc;
          }, {} as Record<string, number>)
        setUserTypeWeights(weights)
      }
    } catch (err) {
      console.error("Error fetching voting types:", err)
    }
  }

  const loadExistingDecision = async (decisionId: number) => {
    try {
      const { data, error } = await supabase
        .from('decisions')
        .select('*')
        .eq('id', decisionId)
        .single()

      if (error) {
        console.error('Error loading decision:', error)
        setError('Failed to load decision')
        return
      }

      if (data) {
        setMotionText(data.motion_text)
        setResult(data.result || '')
        setVotesFor(data.votes_for ?? '')
        setVotesAgainst(data.votes_against ?? '')
        setVotesAbstain(data.votes_abstain ?? '')
        setStatus((data.status as "open" | "completed") || 'open')
        setSelectedVotingType(data.voting_type || '')
      }
    } catch (err) {
      console.error('Unexpected error loading decision:', err)
      setError('An unexpected error occurred')
    }
  }

  const loadParentDecision = async (decisionId: number) => {
    try {
      const { data, error } = await supabase
        .from('decisions')
        .select('*')
        .eq('id', decisionId)
        .single()

      if (error) {
        console.error('Error loading parent decision:', error)
        return
      }

      if (data) {
        setParentDecision(data)
      }
    } catch (err) {
      console.error('Unexpected error loading parent decision:', err)
    }
  }

  const fetchDecisionResults = async () => {
    try {
      const meetingIdNum = typeof meetingId === 'string' ? parseInt(meetingId) : meetingId

      const { data: meetingData, error: meetingError } = await supabase
        .from("meetings")
        .select("building_id")
        .eq("id", meetingIdNum)
        .single()

      if (meetingError || !meetingData) {
        console.error("Error fetching meeting:", meetingError)
        return
      }

      const { data: buildingData, error: buildingError } = await supabase
        .from("buildings")
        .select("company_id")
        .eq("id", meetingData.building_id)
        .single()

      if (buildingError || !buildingData || !buildingData.company_id) {
        console.error("Error fetching building:", buildingError)
        return
      }

      // 1. Get dynamic parameters from voting_parameters table
      const params = await getVotingParameters(buildingData.company_id)
      const dynamicResults = params
        .filter(p => p.parameter_type === 'decision_result')
        .map(p => p.value)

      // 2. Get static defaults from companies table
      const { data: companyData, error: companyError } = await supabase
        .from("companies")
        .select("default_decision_results")
        .eq("id", buildingData.company_id)
        .single()

      const companyResults = companyData?.default_decision_results || []

      // 3. Merge and deduplicate (Force AGM/SGM to be present)
      const baseDefaults = ["M/S/C", "Defeated", "Deferred", "AGM", "SGM"]
      const mergedResults = [...new Set([...baseDefaults, ...dynamicResults, ...companyResults])]
      setDecisionResults(mergedResults)
    } catch (err) {
      console.error("Error fetching decision results:", err)
      setDecisionResults(["M/S/C", "Defeated", "Deferred", "AGM", "SGM"])
    }
  }

  const fetchCompanyUsers = async () => {
    try {
      const meetingIdNum = typeof meetingId === 'string' ? parseInt(meetingId) : meetingId

      const { data: meetingData } = await supabase
        .from("meetings")
        .select("building_id")
        .eq("id", meetingIdNum)
        .single()

      if (!meetingData) return

      const { data: buildingData } = await supabase
        .from("buildings")
        .select("company_id")
        .eq("id", meetingData.building_id)
        .single()

      if (!buildingData?.company_id) return

      const { data: usersData, error: usersError } = await supabase
        .from("users")
        .select("id, name, email, user_type, roles, voting_weight")
        .eq("company_id", buildingData.company_id)
        .in("user_type", ["user", "owner", "property_manager", "corporate_administrator", "resident"])
        .order("name", { ascending: true })

      if (usersError) {
        console.error("Error fetching company users:", usersError)
        return
      }

      setCompanyUsers(usersData ?? [])
    } catch (err) {
      console.error("Error fetching company users:", err)
    }
  }

  const fetchAttendees = async () => {
    try {
      const meetingIdNum = typeof meetingId === 'string' ? parseInt(meetingId) : meetingId

      const { data: meetingData, error } = await supabase
        .from("meetings")
        .select("attendees")
        .eq("id", meetingIdNum)
        .single()

      if (error) {
        console.error("Error fetching attendees:", error)
        return
      }

      if (meetingData?.attendees) {
        setAttendees(meetingData.attendees as unknown as Attendee[])
      }
    } catch (err) {
      console.error("Error fetching attendees:", err)
    }
  }

  const fetchGeniusWords = async () => {
    if (!currentUser?.id) return

    try {
      const { data, error } = await supabase
        .from('genius_words')
        .select('id, shortcode, description')
        .eq('user_id', currentUser.id)
        .order('shortcode', { ascending: true })

      if (!error && data) {
        setGeniusWords(data)
      }
    } catch (err) {
      console.error('Error fetching genius words:', err)
    }
  }

  const handleMotionTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value
    const cursorPos = e.target.selectionStart

    setMotionText(text)
    setCursorPosition(cursorPos)

    const textBeforeCursor = text.substring(0, cursorPos)
    const atIndex = textBeforeCursor.lastIndexOf("@")
    const hashIndex = textBeforeCursor.lastIndexOf("#")

    const mostRecentIsAt = atIndex > hashIndex

    if (mostRecentIsAt && atIndex !== -1) {
      const textAfterAt = textBeforeCursor.substring(atIndex + 1)

      if (!textAfterAt.includes(" ") && !textAfterAt.includes("\n")) {
        setMentionStartIndex(atIndex)

        const filtered = companyUsers.filter(user =>
          user.name.toLowerCase().includes(textAfterAt.toLowerCase())
        )

        setSuggestions(filtered)
        setShowSuggestions(filtered.length > 0)
        setSelectedSuggestionIndex(0)
        setShowGeniusSuggestions(false)
      } else {
        setShowSuggestions(false)
      }
    } else if (!mostRecentIsAt && hashIndex !== -1) {
      const textAfterHash = textBeforeCursor.substring(hashIndex + 1)

      if (!textAfterHash.includes(" ") && !textAfterHash.includes("\n")) {
        setGeniusStartIndex(hashIndex)

        const searchTerm = textAfterHash.toLowerCase()
        const filtered = geniusWords.filter(gw => {
          const shortcodeWithoutHash = gw.shortcode.replace(/^#/, '').toLowerCase()
          return shortcodeWithoutHash.includes(searchTerm) ||
            gw.shortcode.toLowerCase().includes(`#${searchTerm}`)
        })

        setGeniusSuggestions(filtered)
        setShowGeniusSuggestions(filtered.length > 0)
        setSelectedGeniusIndex(0)
        setShowSuggestions(false)
      } else {
        setShowGeniusSuggestions(false)
      }
    } else {
      setShowSuggestions(false)
      setShowGeniusSuggestions(false)
    }
  }

  const insertMention = (user: any) => {
    if (mentionStartIndex === -1) return

    const beforeMention = motionText.substring(0, mentionStartIndex)
    const afterCursor = motionText.substring(cursorPosition)
    const newText = beforeMention + user.name + " " + afterCursor

    setMotionText(newText)
    setShowSuggestions(false)
    setMentionStartIndex(-1)

    setTimeout(() => {
      if (textareaRef.current) {
        const newCursorPos = mentionStartIndex + user.name.length + 1
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos)
        textareaRef.current.focus()
      }
    }, 0)
  }

  const insertGeniusWord = (geniusWord: GeniusWord) => {
    if (geniusStartIndex === -1) return

    const beforeGenius = motionText.substring(0, geniusStartIndex)
    const afterCursor = motionText.substring(cursorPosition)
    const newText = beforeGenius + geniusWord.description + " " + afterCursor

    setMotionText(newText)
    setShowGeniusSuggestions(false)
    setGeniusStartIndex(-1)

    setTimeout(() => {
      if (textareaRef.current) {
        const newCursorPos = geniusStartIndex + geniusWord.description.length + 1
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos)
        textareaRef.current.focus()
      }
    }, 0)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showSuggestions) {
      if (e.key === "ArrowDown") {
        e.preventDefault()
        setSelectedSuggestionIndex(prev =>
          prev < suggestions.length - 1 ? prev + 1 : prev
        )
      } else if (e.key === "ArrowUp") {
        e.preventDefault()
        setSelectedSuggestionIndex(prev => prev > 0 ? prev - 1 : 0)
      } else if (e.key === "Enter" && suggestions.length > 0) {
        e.preventDefault()
        insertMention(suggestions[selectedSuggestionIndex])
      } else if (e.key === "Escape") {
        setShowSuggestions(false)
      }
      return
    }

    if (showGeniusSuggestions) {
      if (e.key === "ArrowDown") {
        e.preventDefault()
        setSelectedGeniusIndex(prev =>
          prev < geniusSuggestions.length - 1 ? prev + 1 : prev
        )
      } else if (e.key === "ArrowUp") {
        e.preventDefault()
        setSelectedGeniusIndex(prev => prev > 0 ? prev - 1 : 0)
      } else if (e.key === "Enter" && geniusSuggestions.length > 0) {
        e.preventDefault()
        insertGeniusWord(geniusSuggestions[selectedGeniusIndex])
      } else if (e.key === "Escape") {
        setShowGeniusSuggestions(false)
      }
      return
    }
  }

  const handleDelete = async () => {
    if (!existingDecisionId || !editMode) return

    if (!confirm('Are you sure you want to delete this decision? This will also delete any threaded decisions under it. This action cannot be undone.')) {
      return
    }

    setDeleting(true)
    try {
      const { error: deleteError } = await supabase
        .from('decisions')
        .delete()
        .eq('id', existingDecisionId)

      if (deleteError) {
        console.error('Error deleting decision:', deleteError)
        toast.error('Failed to delete decision')
        setDeleting(false)
        return
      }

      toast.success('Decision deleted successfully')

      handleClose()

      setTimeout(() => {
        if (onSave) {
          onSave()
        }
      }, 100)
    } catch (err) {
      console.error('Unexpected error:', err)
      toast.error('An unexpected error occurred')
      setDeleting(false)
    }
  }

  const handleSave = async () => {
    if (!motionText.trim()) {
      setError("Motion text is required")
      return
    }

    setSaving(true)
    setError(null)

    try {
      if (editMode && existingDecisionId) {
        const { error: updateError } = await supabase
          .from("decisions")
          .update({
            motion_text: motionText,
            result: result || null,
            votes_for: votersFor.length || (votesFor === "" ? null : votesFor),
            votes_against: votersAgainst.length || (votesAgainst === "" ? null : votesAgainst),
            votes_abstain: votersAbstain.length || (votesAbstain === "" ? null : votesAbstain),
            voting_type: selectedVotingType || null,
            status: status as string,
            edited_at: new Date().toISOString()
          })
          .eq('id', existingDecisionId)

        if (updateError) {
          console.error("Error updating decision:", updateError)
          setError("Failed to update decision")
          setSaving(false)
          return
        }

        toast.success('Decision updated successfully')
      } else {
        const { error: insertError } = await supabase
          .from("decisions")
          .insert({
            topic_id: topicId,
            motion_text: motionText,
            result: result || null,
            votes_for: votersFor.length || (votesFor === "" ? null : votesFor),
            votes_against: votersAgainst.length || (votesAgainst === "" ? null : votesAgainst),
            votes_abstain: votersAbstain.length || (votesAbstain === "" ? null : votesAbstain),
            voting_type: selectedVotingType || null,
            parent_decision_id: parentDecisionId,
            status: status as string,
            recorded_at: new Date().toISOString()
          })

        if (insertError) {
          console.error("Error saving decision:", insertError)
          setError("Failed to save decision")
          setSaving(false)
          return
        }

        toast.success('Decision created successfully')

        // ✅ Reset state and clear form
        setSaving(false)
        setMotionText("")
        setResult("")
        setVotesFor("")
        setVotesAgainst("")
        setVotesAbstain("")
        setStatus("open")
        setError(null)

        // ✅ If embedded mode, stay open and ready for next decision
        if (embedded) {
          if (onSave) onSave()
          onClose() // Just marks data changed for when modal closes
          return
        }

        // ✅ If standalone modal, close it
        handleClose()
        if (onSave) {
          setTimeout(() => onSave(), 100)
        }
        return
      }

      // ✅ If it was an update (not create), close normally
      handleClose()

      setTimeout(() => {
        if (onSave) {
          onSave()
        }
      }, 100)

    } catch (err) {
      console.error("Unexpected error:", err)
      setError("An unexpected error occurred")
      setSaving(false)
    }
  }

  const toggleVote = (type: "for" | "against" | "abstain", name: string) => {
    if (type === "for") {
      setVotersFor(prev => prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name])
      setVotersAgainst(prev => prev.filter(n => n !== name))
      setVotersAbstain(prev => prev.filter(n => n !== name))
    } else if (type === "against") {
      setVotersAgainst(prev => prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name])
      setVotersFor(prev => prev.filter(n => n !== name))
      setVotersAbstain(prev => prev.filter(n => n !== name))
    } else {
      setVotersAbstain(prev => prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name])
      setVotersFor(prev => prev.filter(n => n !== name))
      setVotersAgainst(prev => prev.filter(n => n !== name))
    }
  }

  const getRoleBadge = (user: any) => {
    const t = user.user_type
    if (t === "corporate_administrator") return { label: "Corp Admin", color: "bg-purple-100 text-purple-700" }
    if (t === "property_manager") return { label: "PM", color: "bg-blue-100 text-blue-700" }
    if (t === "owner") return { label: "Owner", color: "bg-amber-100 text-amber-700" }
    return { label: "Resident", color: "bg-green-100 text-green-700" }
  }

  const renderVotingDropdown = (label: string, type: "for" | "against" | "abstain", selected: string[]) => {
    const isOpen = openDropdown === type;
    return (
      <div className="relative">
        <label className="block text-sm font-medium text-foreground mb-2">
          {label}
        </label>
        <button
          type="button"
          onClick={() => setOpenDropdown(isOpen ? null : type)}
          disabled={saving || deleting}
          className="w-full px-3 py-2 bg-background border border-border rounded-lg text-left flex justify-between items-center focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span className="truncate text-sm">
            {selected.length > 0 
              ? `${selected.length} selected` 
              : (type === 'for' ? votesFor : type === 'against' ? votesAgainst : votesAbstain) || "0"
            }
          </span>
          <span className="text-xs text-muted-foreground ml-2">{isOpen ? "▲" : "▼"}</span>
        </button>
        
        {isOpen && (
          <div className="absolute z-50 w-64 mt-1 bg-card border border-border rounded-lg shadow-xl max-h-56 overflow-y-auto">
            {companyUsers.length === 0 && (
              <div className="p-3 text-sm text-muted-foreground text-center">No users found for this company</div>
            )}
            {companyUsers.map((user) => {
              const badge = getRoleBadge(user)
              const isChecked = selected.includes(user.name)
              return (
                <div
                  key={user.id}
                  className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors ${
                    isChecked ? "bg-primary/5" : "hover:bg-muted"
                  }`}
                  onClick={() => toggleVote(type, user.name)}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    readOnly
                    className="h-4 w-4 rounded border-border text-primary focus:ring-primary cursor-pointer pointer-events-none shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground truncate">{user.name}</div>
                    <div className="text-xs text-muted-foreground truncate">{user.email}</div>
                  </div>
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${badge.color}`}>
                    {badge.label}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  const handleClose = () => {
    setMotionText("")
    setResult("")
    setVotesFor("")
    setVotesAgainst("")
    setVotesAbstain("")
    setStatus("open")
    setError(null)
    setShowSuggestions(false)
    setSuggestions([])
    setMentionStartIndex(-1)
    setShowGeniusSuggestions(false)
    setGeniusSuggestions([])
    setGeniusStartIndex(-1)
    setVotersFor([])
    setVotersAgainst([])
    setVotersAbstain([])
    setOpenDropdown(null)
    setParentDecision(null)
    onClose()
  }

  // ⭐ NEW: Form content (shared between embedded and modal)
  const formContent = (
    <div className="p-6 max-h-[80vh] overflow-y-auto">
      {parentDecision && (
        <div className="mb-4 p-3 bg-purple-50 border border-purple-200 rounded-lg">
          <div className="flex items-start gap-2">
            <div className="text-purple-600 font-semibold text-sm">Parent Motion:</div>
            <div className="flex-1">
              <p className="text-sm text-gray-700">{parentDecision.motion_text}</p>
              {parentDecision.result && (
                <p className="text-xs text-purple-600 mt-1">Result: {parentDecision.result}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded text-sm mb-4">
          {error}
        </div>
      )}

      <div className="space-y-4">
        <div className="bg-muted/30 rounded-lg p-3 border border-border/50">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground flex items-center gap-1.5">
              <AlertCircle className="h-3.5 w-3.5" />
              Topic Context
            </div>
            {(topicNotes.length > 0 || topicTasks.length > 0) && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setShowReferences(!showReferences)}
                className="h-6 px-2 text-[10px] font-bold text-primary hover:bg-primary/5"
              >
                {showReferences ? "Hide References" : `Show References (${topicNotes.length + topicTasks.length})`}
              </Button>
            )}
          </div>
          <div className="text-sm font-semibold text-foreground line-clamp-1 mb-1">
            {topicTitle || "Loading topic..."}
          </div>

          {showReferences && (
            <div className="mt-3 space-y-2 max-h-40 overflow-y-auto pr-1 animate-in slide-in-from-top-2 duration-200">
              {topicNotes.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-[9px] font-bold text-muted-foreground/70 uppercase px-1">Notes</div>
                  {topicNotes.map(note => (
                    <div 
                      key={note.id} 
                      onClick={() => insertReference(note.content)}
                      className="group flex items-start gap-2 p-2 rounded border border-dashed border-primary/20 bg-primary/5 hover:bg-primary/10 cursor-pointer transition-colors"
                    >
                      <FileText className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                      <div className="text-xs text-muted-foreground group-hover:text-foreground line-clamp-2">
                        {note.content}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              {topicTasks.length > 0 && (
                <div className="space-y-1.5 mt-3">
                  <div className="text-[9px] font-bold text-muted-foreground/70 uppercase px-1">Tasks</div>
                  {topicTasks.map(task => (
                    <div 
                      key={task.id} 
                      onClick={() => insertReference(`Task: ${task.description}`)}
                      className="group flex items-start gap-2 p-2 rounded border border-dashed border-green-600/20 bg-green-600/5 hover:bg-green-600/10 cursor-pointer transition-colors"
                    >
                      <CheckSquare className="h-3.5 w-3.5 text-green-600 mt-0.5 shrink-0" />
                      <div className="text-xs text-muted-foreground group-hover:text-foreground line-clamp-2">
                        {task.description}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="relative">
          <label className="block text-sm font-medium text-foreground mb-2">
            Motion / Resolution Text <span className="text-red-500">*</span>
          </label>
          <p className="text-xs text-muted-foreground mb-2">
            Type <strong>@</strong> to mention attendees by name, <strong>#</strong> for GeniusWords shortcuts
          </p>
          <textarea
            ref={textareaRef}
            value={motionText}
            onChange={handleMotionTextChange}
            onKeyDown={handleKeyDown}
            placeholder="E.g., Motion by @John Smith, seconded by @Jane Doe, to approve the budget..."
            className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary min-h-[120px]"
            disabled={saving || deleting}
          />

          {showSuggestions && (
            <div
              ref={suggestionsRef}
              className="absolute z-10 w-full mt-1 bg-card border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto"
            >
              {suggestions.map((user, index) => {
                const badge = getRoleBadge(user)
                return (
                  <button
                    key={index}
                    onClick={() => insertMention(user)}
                    className={`w-full text-left px-4 py-2 hover:bg-muted transition-colors ${index === selectedSuggestionIndex ? 'bg-muted' : ''
                      }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-foreground">{user.name}</div>
                        {user.email && (
                          <div className="text-xs text-muted-foreground">{user.email}</div>
                        )}
                      </div>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${badge.color}`}>
                        {badge.label}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          )}

          {showGeniusSuggestions && (
            <div
              ref={geniusSuggestionsRef}
              className="absolute z-10 w-full mt-1 bg-card border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto"
            >
              {geniusSuggestions.map((gw, index) => (
                <button
                  key={gw.id}
                  onClick={() => insertGeniusWord(gw)}
                  className={`w-full text-left px-4 py-2 hover:bg-muted transition-colors ${index === selectedGeniusIndex ? 'bg-muted' : ''
                    }`}
                >
                  <div className="flex items-start gap-2">
                    <code className="text-xs font-mono text-muted-foreground shrink-0">
                      {gw.shortcode}
                    </code>
                    <span className="text-sm text-foreground">
                      {gw.description}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className={`grid ${result === "AGM" || result === "SGM" ? "grid-cols-2" : "grid-cols-1"} gap-4`}>
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Result
            </label>
            <select
              value={result}
              onChange={(e) => setResult(e.target.value)}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              disabled={saving || deleting}
            >
              <option value="">Select result...</option>
              {decisionResults.map((res) => (
                <option key={res} value={res}>
                  {res}
                </option>
              ))}
            </select>
          </div>

          {(result === "AGM" || result === "SGM") && (
            <div className="animate-in slide-in-from-right-4 duration-300">
              <label className="block text-sm font-medium text-foreground mb-2">
                Voting Mechanism
              </label>
              <select
                value={selectedVotingType}
                onChange={(e) => setSelectedVotingType(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                disabled={saving || deleting}
              >
                <option value="">Select mechanism...</option>
                {votingTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {(result === "AGM" || result === "SGM") && (
          <div className="space-y-4 animate-in slide-in-from-bottom-4 duration-300">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {renderVotingDropdown("Votes For", "for", votersFor)}
              {renderVotingDropdown("Votes Against", "against", votersAgainst)}
              {renderVotingDropdown("Abstentions", "abstain", votersAbstain)}
            </div>
          </div>
        )}

        {/* Logic Calculation Preview */}
        {(votersFor.length > 0 || votersAgainst.length > 0 || votesFor !== "" || votesAgainst !== "") && (
          <div className="bg-muted/30 p-4 rounded-xl border border-border/50 animate-in fade-in zoom-in-95 duration-300">
            <div className="flex items-center justify-between mb-3">
               <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <AlertCircle className="h-3.5 w-3.5" />
                  Voting Logic Preview
               </h4>
               {selectedVotingType && (
                 <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                    {selectedVotingType}
                 </span>
               )}
            </div>
            
            {(() => {
              const vForRaw = votersFor.length || Number(votesFor) || 0;
              const vAgainstRaw = votersAgainst.length || Number(votesAgainst) || 0;
              
              // Calculate weighted totals
              const vFor = votersFor.length > 0 
                ? votersFor.reduce((sum, name) => {
                    const u = companyUsers.find(user => user.name === name);
                    const roleLabel = u ? getRoleBadge(u).label : "";
                    const roleWeight = userTypeWeights[u?.user_type || ""] || userTypeWeights[roleLabel] || 1.0;
                    // Use individual weight if set and not 1.0, otherwise use role weight
                    const weight = (u?.voting_weight && u.voting_weight !== 1.0) ? u.voting_weight : roleWeight;
                    return sum + weight;
                  }, 0)
                : Number(votesFor) || 0;
                
              const vAgainst = votersAgainst.length > 0 
                ? votersAgainst.reduce((sum, name) => {
                    const u = companyUsers.find(user => user.name === name);
                    const roleLabel = u ? getRoleBadge(u).label : "";
                    const roleWeight = userTypeWeights[u?.user_type || ""] || userTypeWeights[roleLabel] || 1.0;
                    // Use individual weight if set and not 1.0, otherwise use role weight
                    const weight = (u?.voting_weight && u.voting_weight !== 1.0) ? u.voting_weight : roleWeight;
                    return sum + weight;
                  }, 0)
                : Number(votesAgainst) || 0;

              const total = vFor + vAgainst;
              const totalRaw = vForRaw + vAgainstRaw;
              const percentage = total > 0 ? (vFor / total) * 100 : 0;
              
              let passed = false;
              let threshold = 50;
              
              if (selectedVotingType.includes("75") || selectedVotingType.includes("Three-Quarter")) {
                passed = percentage >= 75;
                threshold = 75;
              } else if (selectedVotingType.includes("100") || selectedVotingType.includes("Unanimous")) {
                passed = percentage >= 100 && vFor > 0;
                threshold = 100;
              } else {
                passed = percentage > 50;
                threshold = 50;
              }

              return (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {passed ? (
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-500" />
                      )}
                      <span className={`text-sm font-bold ${passed ? "text-green-700" : "text-red-700"}`}>
                        {passed ? "Motion Carried" : "Motion Defeated"}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-xl font-black text-foreground">{percentage.toFixed(1)}%</span>
                      <span className="text-[10px] text-muted-foreground block">
                        {total.toFixed(1)} weighted votes ({totalRaw} people)
                      </span>
                    </div>
                  </div>
                  
                  <div className="h-2 w-full bg-muted rounded-full overflow-hidden relative">
                    <div 
                      className={`h-full transition-all duration-500 ${passed ? "bg-green-500" : "bg-red-500"}`} 
                      style={{ width: `${percentage}%` }} 
                    />
                    {threshold < 100 && (
                      <div 
                        className="absolute h-4 w-0.5 bg-foreground/20 -mt-1 top-0" 
                        style={{ left: `${threshold}%` }}
                        title={`Threshold: ${threshold}%`}
                      />
                    )}
                  </div>
                  
                  <p className="text-[10px] text-muted-foreground italic text-center">
                    * Calculations exclude abstentions as per standard voting protocol.
                  </p>
                </div>
              );
            })()}
          </div>
        )}

        {editMode && (
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as "open" | "completed")}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              disabled={saving || deleting}
            >
              <option value="open">Open</option>
              <option value="completed">Completed</option>
            </select>
          </div>
        )}
      </div>

      <div className="flex gap-3 mt-6">
        {editMode && existingDecisionId && (
          <Button
            onClick={handleDelete}
            variant="outline"
            disabled={saving || deleting}
            className="text-red-600 border-red-600 hover:bg-red-50"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            {deleting ? "Deleting..." : "Delete"}
          </Button>
        )}

        <div className="flex-1"></div>

        <Button
          onClick={handleClose}
          variant="outline"
          className="flex-1"
          disabled={saving || deleting}
        >
          Cancel
        </Button>
        <Button
          type="button"
          onClick={handleSave}
          className="flex-1 bg-decision-purple hover:bg-decision-purple/90 text-white"
          disabled={saving || deleting || !motionText.trim()}
        >
          {saving ? "Saving..." : editMode ? "Update Decision" : "Save Decision"}
        </Button>
      </div>
    </div>
  )

  // ⭐ NEW: If embedded, return just the content
  if (embedded) {
    return formContent
  }

  // ⭐ Original modal with backdrop
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-in fade-in">
      <Card className="w-full max-w-2xl m-4 max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-xl font-bold text-foreground">
            {editMode ? "Edit Decision" : parentDecision ? "Add Threaded Decision" : "Record Decision"}
          </h2>
          <button
            onClick={handleClose}
            className="flex h-8 w-8 items-center justify-center rounded hover:bg-muted transition-colors"
            disabled={saving || deleting}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {formContent}
      </Card>
    </div>
  )
}
