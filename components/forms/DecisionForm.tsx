"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { supabase, getCurrentUser, getVotingParameters } from "@/lib/supabase"
import { toast } from "sonner"
import { CheckCircle2, XCircle, AlertCircle, FileText, CheckSquare } from "lucide-react"

interface DecisionFormProps {
  topicId: number
  meetingId: number
  onSave?: () => void
}

interface CompanyUser {
  id: number
  name: string
  email: string
  user_type: string
  roles: string[] | null
}

interface GeniusWord {
  id: number
  shortcode: string
  description: string
}

export default function DecisionForm({ topicId, meetingId, onSave }: DecisionFormProps) {
  const [motionText, setMotionText] = useState("")
  const [result, setResult] = useState("")
  const [votesFor, setVotesFor] = useState<string[]>([])
  const [votesAgainst, setVotesAgainst] = useState<string[]>([])
  const [votesAbstain, setVotesAbstain] = useState<string[]>([])
  const [openDropdown, setOpenDropdown] = useState<"for" | "against" | "abstain" | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [decisionResults, setDecisionResults] = useState<string[]>([])
  const [companyUsers, setCompanyUsers] = useState<CompanyUser[]>([])
  const [votingTypes, setVotingTypes] = useState<string[]>([])
  const [selectedVotingType, setSelectedVotingType] = useState("")
  const [customThreshold, setCustomThreshold] = useState<number>(50)
  const [topicTitle, setTopicTitle] = useState<string>("")
  const [meetingType, setMeetingType] = useState<string>("")
  
  // @ Mention Autocomplete State
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [suggestions, setSuggestions] = useState<CompanyUser[]>([])
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(0)
  const [cursorPosition, setCursorPosition] = useState(0)
  const [mentionStartIndex, setMentionStartIndex] = useState(-1)
  
  // # GeniusWords Autocomplete State
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

  useEffect(() => {
    fetchDecisionResults()
    fetchCompanyUsers()
    fetchGeniusWords()
    fetchVotingTypes()
    fetchTopicTitle()
    fetchTopicContent()
  }, [meetingId, topicId])

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

  const fetchVotingTypes = async () => {
    try {
      const { data: meetingData } = await supabase
        .from("meetings")
        .select("building_id, meeting_type")
        .eq("id", meetingId)
        .single()

      if (meetingData) {
        setMeetingType(meetingData.meeting_type || "")
        const { data: buildingData } = await supabase
          .from("buildings")
          .select("company_id")
          .eq("id", meetingData.building_id)
          .single()

        const params = await getVotingParameters(buildingData?.company_id)
        const vTypes = params
          .filter(p => p.parameter_type === 'voting_type')
          .map(p => p.value)
        
        const baseTypes = vTypes.length > 0 ? vTypes : ["Majority Vote (50%+1)", "Three-Quarter Vote (75%)", "Unanimous Vote (100%)"]
        const finalTypes = [...baseTypes]
        if (!finalTypes.includes("Custom Percentage (%)")) {
          finalTypes.push("Custom Percentage (%)")
        }
        setVotingTypes(finalTypes)
        setSelectedVotingType(finalTypes[0])
      }
    } catch (err) {
      console.error("Error fetching voting types:", err)
    }
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

  const fetchDecisionResults = async () => {
    try {
      const { data: meetingData, error: meetingError } = await supabase
        .from("meetings")
        .select("building_id")
        .eq("id", meetingId)
        .single()

      if (meetingError || !meetingData) {
        console.error("Error fetching meeting:", meetingError)
        setDecisionResults(["M/S/C", "Defeated", "Deferred"])
        return
      }

      const { data: buildingData, error: buildingError } = await supabase
        .from("buildings")
        .select("company_id")
        .eq("id", meetingData.building_id)
        .single()

      if (buildingError || !buildingData || !buildingData.company_id) {
        console.error("Error fetching building:", buildingError)
        setDecisionResults(["M/S/C", "Defeated", "Deferred"])
        return
      }

      // 1. Get dynamic results from voting_parameters
      const params = await getVotingParameters(buildingData.company_id)
      const dynamicResults = params
        .filter(p => p.parameter_type === 'decision_result')
        .map(p => p.value)

      // 2. Get company defaults
      const { data: companyData } = await supabase
        .from("companies")
        .select("default_decision_results")
        .eq("id", buildingData.company_id)
        .single()

      const companyResults = companyData?.default_decision_results || []

      // 3. Merge and deduplicate (Force AGM/SGM to be present)
      const baseDefaults = ["M/S/C", "Defeated", "Deferred"]
      const merged = [...new Set([...baseDefaults, ...dynamicResults, ...companyResults])]
      setDecisionResults(merged)
    } catch (err) {
      console.error("Error fetching decision results:", err)
      setDecisionResults(["M/S/C", "Defeated", "Deferred"])
    }
  }

  const fetchCompanyUsers = async () => {
    try {
      // Step 1: get building_id from meeting
      const { data: meetingData, error: meetingError } = await supabase
        .from("meetings")
        .select("building_id")
        .eq("id", meetingId)
        .single()

      if (meetingError || !meetingData) return

      // Step 2: get company_id from building
      const { data: buildingData, error: buildingError } = await supabase
        .from("buildings")
        .select("company_id")
        .eq("id", meetingData.building_id)
        .single()

      if (buildingError || !buildingData?.company_id) return

      // Step 3: fetch all users in this company with the eligible roles
      const { data: usersData, error: usersError } = await supabase
        .from("users")
        .select("id, name, email, user_type, roles")
        .eq("company_id", buildingData.company_id)
        .in("user_type", ["user", "owner", "property_manager", "corporate_administrator"])
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
        
        const filtered = companyUsers.filter(u =>
          u.name.toLowerCase().includes(textAfterAt.toLowerCase())
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

  const insertMention = (user: CompanyUser) => {
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
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
          voting_type: selectedVotingType === "Custom Percentage (%)" 
            ? `Custom (${customThreshold}%)` 
            : (selectedVotingType || null),
          votes_for: votesFor.length === 0 ? null : votesFor.length,
          votes_against: votesAgainst.length === 0 ? null : votesAgainst.length,
          votes_abstain: votesAbstain.length === 0 ? null : votesAbstain.length,
          parent_decision_id: null
        })

      if (insertError) {
        console.error("Error saving decision:", insertError)
        setError("Failed to save decision")
        setSaving(false)
        return
      }

      console.log('✅ Decision saved successfully')
      toast.success('Decision created successfully')

      // ⭐ Clear form after success
      setMotionText("")
      setResult("")
      setVotesFor([])
      setVotesAgainst([])
      setVotesAbstain([])
      setOpenDropdown(null)
      setError(null)

      // ⭐ Trigger refresh
      if (onSave) {
        onSave()
      }

      setSaving(false)
    } catch (err) {
      console.error("Unexpected error:", err)
      setError("An unexpected error occurred")
      setSaving(false)
    }
  }

  const toggleVote = (type: "for" | "against" | "abstain", name: string) => {
    if (type === "for") {
      setVotesFor(prev => prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name])
      setVotesAgainst(prev => prev.filter(n => n !== name))
      setVotesAbstain(prev => prev.filter(n => n !== name))
    } else if (type === "against") {
      setVotesAgainst(prev => prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name])
      setVotesFor(prev => prev.filter(n => n !== name))
      setVotesAbstain(prev => prev.filter(n => n !== name))
    } else {
      setVotesAbstain(prev => prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name])
      setVotesFor(prev => prev.filter(n => n !== name))
      setVotesAgainst(prev => prev.filter(n => n !== name))
    }
  }

  const getRoleBadge = (user: CompanyUser) => {
    const t = user.user_type
    if (t === "corporate_administrator") return { label: "Corp Admin", color: "bg-purple-100 text-purple-700" }
    if (t === "property_manager") return { label: "PM", color: "bg-blue-100 text-blue-700" }
    if (t === "owner") return { label: "Owner", color: "bg-amber-100 text-amber-700" }
    return { label: "Resident", color: "bg-green-100 text-green-700" }
  }

  const renderDropdown = (label: string, type: "for" | "against" | "abstain", selected: string[]) => {
    const isOpen = openDropdown === type;
    return (
      <div className="relative">
        <label className="block text-sm font-medium text-foreground mb-2">
          {label}
        </label>
        <button
          type="button"
          onClick={() => setOpenDropdown(isOpen ? null : type)}
          disabled={saving}
          className="w-full px-3 py-2 bg-background border border-border rounded-lg text-left flex justify-between items-center focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span className="truncate text-sm">
            {selected.length > 0 ? `${selected.length} selected` : "0"}
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
                    isChecked ? "bg-primary/8" : "hover:bg-muted"
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

  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded text-sm">
          {error}
        </div>
      )}

      <div className="bg-muted/30 rounded-lg p-3 border border-border/50">
        <div className="flex items-center justify-between mb-2">
          <div className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground flex items-center gap-1.5">
            <AlertCircle className="h-3.5 w-3.5" />
            Topic Context
          </div>
          {(topicNotes.length > 0 || topicTasks.length > 0) && (
            <Button 
              type="button"
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
          disabled={saving}
        />
        
        {showSuggestions && (
          <div
            ref={suggestionsRef}
            className="absolute z-10 w-full mt-1 bg-card border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto"
          >
            {suggestions.map((user, index) => (
              <button
                key={user.id}
                onClick={() => insertMention(user)}
                className={`w-full text-left px-4 py-2 hover:bg-muted transition-colors ${
                  index === selectedSuggestionIndex ? 'bg-muted' : ''
                }`}
              >
                <div className="font-medium text-foreground">{user.name}</div>
                <div className="text-xs text-muted-foreground">{user.email}</div>
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
                className={`w-full text-left px-4 py-2 hover:bg-muted transition-colors ${
                  index === selectedGeniusIndex ? 'bg-muted' : ''
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

      <div className={`grid ${result === "M/S/C" || result === "Defeated" || meetingType === "AGM" || meetingType === "SGM" ? "grid-cols-2" : "grid-cols-1"} gap-4`}>
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
 
        {(result === "M/S/C" || result === "Defeated" || meetingType === "AGM" || meetingType === "SGM") && (
          <div className="animate-in slide-in-from-right-4 duration-300">
            <label className="block text-sm font-medium text-foreground mb-2">
              Voting Mechanism
            </label>
            <select
              value={selectedVotingType}
              onChange={(e) => setSelectedVotingType(e.target.value)}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              disabled={saving}
            >
              {votingTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
 
      {(result === "M/S/C" || result === "Defeated" || meetingType === "AGM" || meetingType === "SGM") && (
        <div className="space-y-4 animate-in slide-in-from-bottom-4 duration-300">
          <div className="grid grid-cols-3 gap-4">
            {renderDropdown("Votes For", "for", votesFor)}
            {renderDropdown("Votes Against", "against", votesAgainst)}
            {renderDropdown("Abstentions", "abstain", votesAbstain)}
          </div>
        </div>
      )}

      {selectedVotingType === "Custom Percentage (%)" && (
        <div className="bg-primary/5 p-4 rounded-lg border border-primary/20 animate-in slide-in-from-top-2 duration-300">
          <label className="block text-xs font-bold uppercase tracking-wider text-primary mb-2">
            Set Threshold Percentage (51-100)
          </label>
          <div className="flex items-center gap-4">
            <input
              type="range"
              min="51"
              max="100"
              value={customThreshold}
              onChange={(e) => setCustomThreshold(parseInt(e.target.value))}
              className="flex-1 accent-primary"
            />
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="51"
                max="100"
                value={customThreshold}
                onChange={(e) => setCustomThreshold(Math.min(100, Math.max(51, parseInt(e.target.value) || 51)))}
                className="w-16 px-2 py-1 bg-background border border-border rounded text-center font-bold"
              />
              <span className="font-bold text-primary">%</span>
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground mt-2">
            The motion will require at least {customThreshold}% of active votes to pass.
          </p>
        </div>
      )}

      {/* Dropdowns moved inside conditional block above */}

      {/* Logic Calculation Preview */}
      {(result === "M/S/C" || result === "Defeated" || meetingType === "AGM" || meetingType === "SGM") && (votesFor.length > 0 || votesAgainst.length > 0) && (
        <div className="bg-muted/30 p-4 rounded-xl border border-border/50 animate-in fade-in zoom-in-95 duration-300">
          <div className="flex items-center justify-between mb-3">
             <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <AlertCircle className="h-3.5 w-3.5" />
                Voting Logic Preview
             </h4>
             <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                {selectedVotingType}
             </span>
          </div>
          
          {(() => {
            const vFor = votesFor.length;
            const vAgainst = votesAgainst.length;
            const total = vFor + vAgainst;
            const percentage = total > 0 ? (vFor / total) * 100 : 0;
            
            let passed = false;
            let threshold = 50;
            
            if (selectedVotingType.toLowerCase().includes("75") || 
                selectedVotingType.toLowerCase().includes("three-quarter") ||
                selectedVotingType.toLowerCase().includes("special resolution")) {
              passed = percentage >= 75;
              threshold = 75;
            } else if (selectedVotingType.toLowerCase().includes("100") || 
                       selectedVotingType.toLowerCase().includes("unanimous")) {
              passed = percentage >= 100 && vFor > 0;
              threshold = 100;
            } else if (selectedVotingType.toLowerCase().includes("80")) {
              passed = percentage >= 80;
              threshold = 80;
            } else if (selectedVotingType === "Custom Percentage (%)") {
              passed = percentage >= customThreshold;
              threshold = customThreshold;
            } else if (selectedVotingType.toLowerCase().includes("advisory")) {
              passed = true; // Advisory votes are always "carried" in terms of recording
              threshold = 0;
            } else {
              // Default to 50%+1 (Majority / Ordinary Resolution)
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
                    <span className="text-[10px] text-muted-foreground block">of {total} active votes</span>
                  </div>
                </div>
                
                <div className="h-2 w-full bg-muted rounded-full overflow-hidden flex">
                  <div 
                    className={`h-full transition-all duration-500 ${passed ? "bg-green-500" : "bg-red-500"}`} 
                    style={{ width: `${percentage}%` }} 
                  />
                  {threshold < 100 && (
                    <div 
                      className="absolute h-4 w-0.5 bg-foreground/20 -mt-1" 
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

      <div className="flex gap-3 pt-4">
        <Button
          type="submit"
          className="w-full bg-decision-purple hover:bg-decision-purple/90 text-white"
          disabled={saving || !motionText.trim()}
        >
          {saving ? "Saving..." : "Save Decision"}
        </Button>
      </div>
    </form>
  )
}
