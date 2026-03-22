"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { X, Trash2 } from "lucide-react"
import { supabase, getCurrentUser } from "@/lib/supabase"
import { toast } from "sonner"

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
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [decisionResults, setDecisionResults] = useState<string[]>([])
  const [attendees, setAttendees] = useState<Attendee[]>([])

  const [parentDecision, setParentDecision] = useState<Decision | null>(null)

  const [showSuggestions, setShowSuggestions] = useState(false)
  const [suggestions, setSuggestions] = useState<Attendee[]>([])
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(0)
  const [cursorPosition, setCursorPosition] = useState(0)
  const [mentionStartIndex, setMentionStartIndex] = useState(-1)

  const [geniusWords, setGeniusWords] = useState<GeniusWord[]>([])
  const [showGeniusSuggestions, setShowGeniusSuggestions] = useState(false)
  const [geniusSuggestions, setGeniusSuggestions] = useState<GeniusWord[]>([])
  const [selectedGeniusIndex, setSelectedGeniusIndex] = useState(0)
  const [geniusStartIndex, setGeniusStartIndex] = useState(-1)

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
      fetchGeniusWords()

      if (editMode && existingDecisionId) {
        loadExistingDecision(existingDecisionId)
      }

      if (parentDecisionId) {
        loadParentDecision(parentDecisionId)
      }
    }
  }, [isOpen, meetingId, editMode, existingDecisionId, parentDecisionId])

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

      const { data: companyData, error: companyError } = await supabase
        .from("companies")
        .select("default_decision_results")
        .eq("id", buildingData.company_id)
        .single()

      if (companyError) {
        console.error("Error fetching company:", companyError)
        return
      }

      if (companyData?.default_decision_results) {
        setDecisionResults(companyData.default_decision_results)
      } else {
        setDecisionResults(["MSC", "Defeated", "Deferred"])
      }
    } catch (err) {
      console.error("Error fetching decision results:", err)
      setDecisionResults(["MSC", "Defeated", "Deferred"])
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
        setAttendees(meetingData.attendees as Attendee[])
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

        const filtered = attendees.filter(attendee =>
          attendee.name.toLowerCase().includes(textAfterAt.toLowerCase())
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

  const insertMention = (attendee: Attendee) => {
    if (mentionStartIndex === -1) return

    const beforeMention = motionText.substring(0, mentionStartIndex)
    const afterCursor = motionText.substring(cursorPosition)
    const newText = beforeMention + attendee.name + " " + afterCursor

    setMotionText(newText)
    setShowSuggestions(false)
    setMentionStartIndex(-1)

    setTimeout(() => {
      if (textareaRef.current) {
        const newCursorPos = mentionStartIndex + attendee.name.length + 1
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
            votes_for: votesFor === "" ? null : votesFor,
            votes_against: votesAgainst === "" ? null : votesAgainst,
            votes_abstain: votesAbstain === "" ? null : votesAbstain,
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
            votes_for: votesFor === "" ? null : votesFor,
            votes_against: votesAgainst === "" ? null : votesAgainst,
            votes_abstain: votesAbstain === "" ? null : votesAbstain,
            parent_decision_id: parentDecisionId,
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

  const handleClose = () => {
    setMotionText("")
    setResult("")
    setVotesFor("")
    setVotesAgainst("")
    setVotesAbstain("")
    setError(null)
    setShowSuggestions(false)
    setSuggestions([])
    setMentionStartIndex(-1)
    setShowGeniusSuggestions(false)
    setGeniusSuggestions([])
    setGeniusStartIndex(-1)
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
              {suggestions.map((attendee, index) => (
                <button
                  key={index}
                  onClick={() => insertMention(attendee)}
                  className={`w-full text-left px-4 py-2 hover:bg-muted transition-colors ${index === selectedSuggestionIndex ? 'bg-muted' : ''
                    }`}
                >
                  <div className="font-medium text-foreground">{attendee.name}</div>
                  {attendee.email && (
                    <div className="text-xs text-muted-foreground">{attendee.email}</div>
                  )}
                </button>
              ))}
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

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Votes For
            </label>
            <input
              type="number"
              min="0"
              value={votesFor}
              onChange={(e) => setVotesFor(e.target.value === "" ? "" : parseInt(e.target.value))}
              placeholder="0"
              className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              disabled={saving || deleting}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Votes Against
            </label>
            <input
              type="number"
              min="0"
              value={votesAgainst}
              onChange={(e) => setVotesAgainst(e.target.value === "" ? "" : parseInt(e.target.value))}
              placeholder="0"
              className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              disabled={saving || deleting}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Abstentions
            </label>
            <input
              type="number"
              min="0"
              value={votesAbstain}
              onChange={(e) => setVotesAbstain(e.target.value === "" ? "" : parseInt(e.target.value))}
              placeholder="0"
              className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              disabled={saving || deleting}
            />
          </div>
        </div>
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
          onClick={handleSave}
          className="flex-1 bg-decision-purple hover:bg-decision-purple/90 text-white"
          disabled={saving || deleting}
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
