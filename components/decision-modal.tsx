"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { X, Sparkles, AtSign } from "lucide-react"
import { supabase, getCurrentUser } from "@/lib/supabase"

interface DecisionModalProps {
  isOpen: boolean
  onClose: () => void
  topicId: number
  meetingId: number
  onSave?: () => void
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

export default function DecisionModal({
  isOpen,
  onClose,
  topicId,
  meetingId,
  onSave
}: DecisionModalProps) {
  const [motionText, setMotionText] = useState("")
  const [result, setResult] = useState("")
  const [votesFor, setVotesFor] = useState<number | "">("")
  const [votesAgainst, setVotesAgainst] = useState<number | "">("")
  const [votesAbstain, setVotesAbstain] = useState<number | "">("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [decisionResults, setDecisionResults] = useState<string[]>([])
  const [attendees, setAttendees] = useState<Attendee[]>([])
  
  // @ Mention Autocomplete State
  const [showMentionSuggestions, setShowMentionSuggestions] = useState(false)
  const [mentionSuggestions, setMentionSuggestions] = useState<Attendee[]>([])
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0)
  const [mentionStartIndex, setMentionStartIndex] = useState(-1)
  
  // # GeniusWords Autocomplete State
  const [geniusWords, setGeniusWords] = useState<GeniusWord[]>([])
  const [showGeniusSuggestions, setShowGeniusSuggestions] = useState(false)
  const [geniusSuggestions, setGeniusSuggestions] = useState<GeniusWord[]>([])
  const [selectedGeniusIndex, setSelectedGeniusIndex] = useState(0)
  const [geniusStartIndex, setGeniusStartIndex] = useState(-1)
  
  const [cursorPosition, setCursorPosition] = useState(0)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const mentionSuggestionsRef = useRef<HTMLDivElement>(null)
  const geniusSuggestionsRef = useRef<HTMLDivElement>(null)

  const currentUser = getCurrentUser()

  useEffect(() => {
    if (isOpen) {
      fetchDecisionResults()
      fetchAttendees()
      fetchGeniusWords()
    }
  }, [isOpen, meetingId])

  const fetchDecisionResults = async () => {
    try {
      const { data: meetingData, error: meetingError } = await supabase
        .from("meetings")
        .select("building_id")
        .eq("id", meetingId)
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
      const { data: meetingData, error } = await supabase
        .from("meetings")
        .select("attendees")
        .eq("id", meetingId)
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

    // Check for @ mention
    const atIndex = textBeforeCursor.lastIndexOf("@")
    const hashIndex = textBeforeCursor.lastIndexOf("#")
    
    // Determine which autocomplete to show (prioritize the most recent trigger)
    if (atIndex > hashIndex && atIndex !== -1) {
      const textAfterAt = textBeforeCursor.substring(atIndex + 1)
      
      if (!textAfterAt.includes(" ") && !textAfterAt.includes("\n")) {
        setMentionStartIndex(atIndex)
        
        const filtered = attendees.filter(attendee =>
          attendee.name.toLowerCase().includes(textAfterAt.toLowerCase())
        )
        
        setMentionSuggestions(filtered)
        setShowMentionSuggestions(filtered.length > 0)
        setSelectedMentionIndex(0)
        setShowGeniusSuggestions(false)
      } else {
        setShowMentionSuggestions(false)
      }
    } else if (hashIndex > atIndex && hashIndex !== -1) {
      const textAfterHash = textBeforeCursor.substring(hashIndex + 1)
      
      if (!textAfterHash.includes(" ") && !textAfterHash.includes("\n")) {
        setGeniusStartIndex(hashIndex)
        
        const searchTerm = textAfterHash.toLowerCase()
        const filtered = geniusWords.filter(gw =>
          gw.shortcode.toLowerCase().includes(`#${searchTerm}`)
        )
        
        setGeniusSuggestions(filtered)
        setShowGeniusSuggestions(filtered.length > 0)
        setSelectedGeniusIndex(0)
        setShowMentionSuggestions(false)
      } else {
        setShowGeniusSuggestions(false)
      }
    } else {
      setShowMentionSuggestions(false)
      setShowGeniusSuggestions(false)
    }
  }

  const insertMention = (attendee: Attendee) => {
    if (mentionStartIndex === -1) return

    const beforeMention = motionText.substring(0, mentionStartIndex)
    const afterCursor = motionText.substring(cursorPosition)
    const newText = beforeMention + attendee.name + " " + afterCursor
    
    setMotionText(newText)
    setShowMentionSuggestions(false)
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
    // Handle @ mention suggestions
    if (showMentionSuggestions) {
      if (e.key === "ArrowDown") {
        e.preventDefault()
        setSelectedMentionIndex(prev => 
          prev < mentionSuggestions.length - 1 ? prev + 1 : prev
        )
      } else if (e.key === "ArrowUp") {
        e.preventDefault()
        setSelectedMentionIndex(prev => prev > 0 ? prev - 1 : 0)
      } else if (e.key === "Enter" && mentionSuggestions.length > 0) {
        e.preventDefault()
        insertMention(mentionSuggestions[selectedMentionIndex])
      } else if (e.key === "Escape") {
        setShowMentionSuggestions(false)
      }
      return
    }

    // Handle # GeniusWords suggestions
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

  const handleSave = async () => {
    if (!motionText.trim()) {
      setError("Motion text is required")
      return
    }

    setSaving(true)
    setError(null)

    try {
      const { error: insertError } = await supabase
        .from("decisions")
        .insert({
          topic_id: topicId,
          motion_text: motionText,
          result: result || null,
          votes_for: votesFor === "" ? null : votesFor,
          votes_against: votesAgainst === "" ? null : votesAgainst,
          votes_abstain: votesAbstain === "" ? null : votesAbstain
        })

      if (insertError) {
        console.error("Error saving decision:", insertError)
        setError("Failed to save decision")
        return
      }

      if (onSave) onSave()
      handleClose()
    } catch (err) {
      console.error("Unexpected error:", err)
      setError("An unexpected error occurred")
    } finally {
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
    setShowMentionSuggestions(false)
    setShowGeniusSuggestions(false)
    setMentionSuggestions([])
    setGeniusSuggestions([])
    setMentionStartIndex(-1)
    setGeniusStartIndex(-1)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-in fade-in">
      <Card className="w-full max-w-2xl p-6 m-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-foreground">Record Decision</h2>
          <button
            onClick={handleClose}
            className="flex h-8 w-8 items-center justify-center rounded hover:bg-muted transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded text-sm mb-4">
            {error}
          </div>
        )}

        <div className="space-y-4">
          {/* Motion Text with @ and # Autocomplete */}
          <div className="relative">
            <label className="block text-sm font-medium text-foreground mb-2">
              Motion / Resolution Text <span className="text-red-500">*</span>
            </label>
            <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <AtSign className="h-3 w-3" />
                <span>Type <strong>@</strong> to mention attendees</span>
              </div>
              <span>•</span>
              <div className="flex items-center gap-1">
                <Sparkles className="h-3 w-3" />
                <span>Type <strong>#</strong> for shortcuts</span>
              </div>
            </div>
            <textarea
              ref={textareaRef}
              value={motionText}
              onChange={handleMotionTextChange}
              onKeyDown={handleKeyDown}
              placeholder="E.g., Motion by @John Smith, seconded by @Jane Doe, to #ApprovalMotion..."
              className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary min-h-[120px]"
              disabled={saving}
            />
            
            {/* @ Mention Suggestions Dropdown */}
            {showMentionSuggestions && (
              <div
                ref={mentionSuggestionsRef}
                className="absolute z-10 w-full mt-1 bg-card border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto"
              >
                <div className="p-2 border-b border-border bg-muted/30 flex items-center gap-2">
                  <AtSign className="h-4 w-4 text-blue-600" />
                  <span className="text-xs font-medium text-muted-foreground">
                    Mention Attendee
                  </span>
                </div>
                {mentionSuggestions.map((attendee, index) => (
                  <button
                    key={index}
                    onClick={() => insertMention(attendee)}
                    className={`w-full text-left px-4 py-2 hover:bg-muted transition-colors ${
                      index === selectedMentionIndex ? 'bg-primary/10' : ''
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

            {/* # GeniusWords Suggestions Dropdown */}
            {showGeniusSuggestions && (
              <div
                ref={geniusSuggestionsRef}
                className="absolute z-10 w-full mt-1 bg-card border border-border rounded-lg shadow-lg max-h-60 overflow-y-auto"
              >
                <div className="p-2 border-b border-border bg-muted/30 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-purple-600" />
                  <span className="text-xs font-medium text-muted-foreground">
                    GeniusWords Shortcuts
                  </span>
                </div>
                {geniusSuggestions.map((gw, index) => (
                  <button
                    key={gw.id}
                    onClick={() => insertGeniusWord(gw)}
                    className={`w-full text-left px-3 py-2 hover:bg-muted transition-colors ${
                      index === selectedGeniusIndex ? 'bg-primary/10' : ''
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <code className="px-2 py-0.5 bg-purple-100 text-purple-800 rounded text-xs font-mono shrink-0">
                        {gw.shortcode}
                      </code>
                      <span className="text-sm text-foreground flex-1">
                        {gw.description}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Result Dropdown */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Result
            </label>
            <select
              value={result}
              onChange={(e) => setResult(e.target.value)}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              disabled={saving}
            >
              <option value="">Select result...</option>
              {decisionResults.map((res) => (
                <option key={res} value={res}>
                  {res}
                </option>
              ))}
            </select>
          </div>

          {/* Voting Counts */}
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
                disabled={saving}
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
                disabled={saving}
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
                disabled={saving}
              />
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <Button
            onClick={handleClose}
            variant="outline"
            className="flex-1"
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            className="flex-1 bg-decision-purple hover:bg-decision-purple/90 text-white"
            disabled={saving}
          >
            {saving ? "Saving..." : "Save Decision"}
          </Button>
        </div>
      </Card>
    </div>
  )
}
