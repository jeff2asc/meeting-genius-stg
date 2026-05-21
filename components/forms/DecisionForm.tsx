"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { supabase, getCurrentUser, getVotingParameters } from "@/lib/supabase"
import { toast } from "sonner"
import { AlertCircle, FileText } from "lucide-react"
import type { JurisdictionRule } from "@/lib/voting-engine"
import { apiClient } from "@/lib/api-client"
import {
  evaluateDecisionVote,
  inferProvinceCode,
  toDecisionVoteSnapshot,
  type BuildingVotingContext,
  type VotingParameterRow,
} from "@/lib/voting-rules"
import VotingAnalysisPreview from "@/components/VotingAnalysisPreview"
import {
  buildMeetingVoters,
  getEligibleHeadcount,
  getEligibleWeight,
  getVoterWeight,
  type MeetingAttendeeRecord,
  type MeetingVoter,
} from "@/lib/meeting-voters"

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
  voting_weight?: number | null
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
  const [meetingVoters, setMeetingVoters] = useState<MeetingVoter[]>([])
  const [votingTypes, setVotingTypes] = useState<string[]>([])
  const [selectedVotingType, setSelectedVotingType] = useState("")
  const [customThreshold, setCustomThreshold] = useState<number>(50)
  const [topicTitle, setTopicTitle] = useState<string>("")
  const [meetingType, setMeetingType] = useState<string>("")
  const [buildingContext, setBuildingContext] = useState<BuildingVotingContext>({})
  const [votingParametersData, setVotingParametersData] = useState<VotingParameterRow[]>([])
  const [jurisdictionRules, setJurisdictionRules] = useState<JurisdictionRule[]>([])
  
  // @ Mention Autocomplete State
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [suggestions, setSuggestions] = useState<MeetingVoter[]>([])
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
          .select("company_id, building_type, province_code, address")
          .eq("id", meetingData.building_id)
          .single()

        const bCtx: BuildingVotingContext = {
          building_type: buildingData?.building_type,
          province_code: (buildingData as { province_code?: string })?.province_code,
          address: buildingData?.address,
        }
        setBuildingContext(bCtx)

        const provinceCode = inferProvinceCode(bCtx)
        try {
          const rules = await apiClient.v1.jurisdictionRules.list({
            building_type: bCtx.building_type || undefined,
            province_code: provinceCode,
          })
          setJurisdictionRules((rules || []) as JurisdictionRule[])
        } catch {
          setJurisdictionRules([])
        }

        const params = await getVotingParameters(buildingData?.company_id)
        const votingParams = params.filter((p: any) => p.parameter_type === "voting_type")
        setVotingParametersData(votingParams as VotingParameterRow[])
        const vTypes = votingParams.map((p: any) => p.value)
        
        let finalTypes = vTypes.length > 0 ? [...vTypes] : ["Majority Vote (50%+1)", "Three-Quarter Vote (75%)", "Unanimous Vote (100%)"]
        if (!finalTypes.includes("Custom Percentage (%)")) {
          finalTypes.push("Custom Percentage (%)")
        }
        if (provinceCode === "BC" && !finalTypes.includes("80% Vote")) {
          finalTypes.push("80% Vote")
        }
        if (provinceCode === "ON") {
          for (const t of [
            "Majority — Votes Cast (ON S.53)",
            "Majority — All Registered Units (ON By-law)",
            "Majority — Votes at Meeting (ON By-law)",
          ]) {
            if (!finalTypes.includes(t)) finalTypes.push(t)
          }
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
        .filter((p: any) => p.parameter_type === 'decision_result')
        .map((p: any) => p.value)

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
        .select("building_id, attendees")
        .eq("id", meetingId)
        .single()

      if (meetingError || !meetingData) return

      // Step 2: get company_id from building
      const { data: buildingData } = await supabase
        .from("buildings")
        .select("company_id")
        .eq("id", meetingData.building_id)
        .single()

      // ── 3. Users linked to this building via user_buildings ──
      const { data: userBuildings } = await supabase
        .from("user_buildings")
        .select("user_id")
        .eq("building_id", meetingData.building_id)

      const buildingUserIds = (userBuildings ?? []).map((ub: any) => ub.user_id).filter(Boolean)

      const buildingUsersPromise = buildingUserIds.length > 0
        ? supabase
            .from("users")
            .select("id, name, email, user_type, roles, voting_weight")
            .in("id", buildingUserIds)
        : Promise.resolve({ data: [] })

      // ── 4. Users linked via company_id (PMs, Corp Admins, etc.) ──
      const companyUsersPromise = buildingData?.company_id
        ? supabase
            .from("users")
            .select("id, name, email, user_type, roles, voting_weight")
            .eq("company_id", buildingData.company_id)
        : Promise.resolve({ data: [] })

      const [{ data: buildingUsers }, { data: companyUsers }] = await Promise.all([
        buildingUsersPromise,
        companyUsersPromise,
      ])

      // ── 5. Merge & deduplicate by id ──
      const merged = [...(buildingUsers ?? []), ...(companyUsers ?? [])]
      const unique = Array.from(
        new Map(merged.map((u: any) => [u.id, u])).values()
      ).sort((a: any, b: any) => a.name.localeCompare(b.name))

      setCompanyUsers(unique)
      setMeetingVoters(
        buildMeetingVoters(
          (meetingData.attendees as MeetingAttendeeRecord[] | null) ?? [],
          unique
        )
      )
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
        
        const filtered = meetingVoters.filter(u =>
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

  const insertMention = (user: MeetingVoter) => {
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
      let voteSnapshot = {
        vote_passed: null as boolean | null,
        vote_percentage: null as number | null,
        reconsideration_triggered: false,
        reconsideration_hold_days: 0,
        reconsideration_hold_until: null as string | null,
      }

      if (
        selectedVotingType &&
        (votesFor.length > 0 || votesAgainst.length > 0)
      ) {
        const { result: voteResult } = evaluateDecisionVote({
          votingType: selectedVotingType,
          votersFor: votesFor,
          votersAgainst: votesAgainst,
          votersAbstain: votesAbstain,
          votesFor: "",
          votesAgainst: "",
          votesAbstain: "",
          meetingVoters,
          getWeight: (name) => getVoterWeight(meetingVoters, name),
          eligibleHeadcount: getEligibleHeadcount(meetingVoters),
          eligibleWeight: getEligibleWeight(meetingVoters),
          jurisdictionRules,
          votingParameters: votingParametersData,
          building: buildingContext,
          customThreshold:
            selectedVotingType === "Custom Percentage (%)" ? customThreshold : undefined,
        })
        voteSnapshot = toDecisionVoteSnapshot(voteResult)
      }

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
          parent_decision_id: null,
          ...voteSnapshot,
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

  const getRoleBadge = (user: MeetingVoter | CompanyUser) => {
    const t = user.user_type
    if (t === "corporate_administrator") return { label: "Corp Admin", color: "bg-purple-100 text-purple-700" }
    if (t === "property_manager") return { label: "PM", color: "bg-blue-100 text-blue-700" }
    if (t === "owner") return { label: "Owner", color: "bg-amber-100 text-amber-700" }
    if (t === "resident") return { label: "Resident", color: "bg-green-100 text-green-700" }
    if (t === "attendee" || t === "user") {
      const roleLabel = "role" in user && user.role ? user.role : "Attendee"
      return { label: roleLabel, color: "bg-slate-100 text-slate-700" }
    }
    if ("role" in user && user.role) {
      return { label: user.role, color: "bg-slate-100 text-slate-700" }
    }
    return { label: "Member", color: "bg-slate-100 text-slate-700" }
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
            {meetingVoters.length === 0 && (
              <div className="p-3 text-sm text-muted-foreground text-center">No attendees on this meeting — add people under Attendees first</div>
            )}
            {meetingVoters.map((user) => {
              const badge = getRoleBadge(user)
              const isChecked = selected.includes(user.name)
              return (
                <div
                  key={String(user.id)}
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
                key={String(user.id)}
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

      <div className={`grid ${meetingType === "AGM" || meetingType === "SGM" ? "grid-cols-2" : "grid-cols-1"} gap-4`}>
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
 
        {(meetingType === "AGM" || meetingType === "SGM") && (
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
 
      <div className="space-y-4 animate-in slide-in-from-bottom-4 duration-300">
        <div className="grid grid-cols-3 gap-4">
          {renderDropdown("Votes For", "for", votesFor)}
          {renderDropdown("Votes Against", "against", votesAgainst)}
          {renderDropdown("Abstentions", "abstain", votesAbstain)}
        </div>
      </div>

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

      <VotingAnalysisPreview
        selectedVotingType={selectedVotingType}
        meetingVoters={meetingVoters}
        votersFor={votesFor}
        votersAgainst={votesAgainst}
        votersAbstain={votesAbstain}
        votesFor=""
        votesAgainst=""
        votesAbstain=""
        userTypeWeights={{}}
        jurisdictionRules={jurisdictionRules}
        votingParameters={votingParametersData}
        building={buildingContext}
        getWeight={(name) => getVoterWeight(meetingVoters, name)}
        eligibleHeadcount={getEligibleHeadcount(meetingVoters)}
        eligibleWeight={getEligibleWeight(meetingVoters)}
        customThreshold={
          selectedVotingType === "Custom Percentage (%)" ? customThreshold : undefined
        }
      />


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
