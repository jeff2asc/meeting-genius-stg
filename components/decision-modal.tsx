"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { X, Trash2 } from "lucide-react"
import { supabase, getCurrentUser, getVotingParameters } from "@/lib/supabase"
import { toast } from "sonner"
import { AlertCircle, FileText, CheckSquare } from "lucide-react"
import {
  buildMeetingVoters,
  getEligibleHeadcount,
  getEligibleWeight,
  getVoterWeight,
  type MeetingAttendeeRecord,
  type MeetingVoter,
} from "@/lib/meeting-voters"
import { apiClient } from "@/lib/api-client"
import type { JurisdictionRule } from "@/lib/voting-engine"
import {
  evaluateDecisionVote,
  inferProvinceCode,
  toDecisionVoteSnapshot,
  type BuildingVotingContext,
  type VotingParameterRow,
} from "@/lib/voting-rules"
import VotingAnalysisPreview from "@/components/VotingAnalysisPreview"

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
  /** Live attendee list from meeting view — keeps voters in sync after Attendees save */
  meetingAttendees?: MeetingAttendeeRecord[]
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
  embedded = false,  // ⭐ NEW
  meetingAttendees,
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
  const [meetingVoters, setMeetingVoters] = useState<MeetingVoter[]>([])
  const [votersFor, setVotersFor] = useState<string[]>([])
  const [votersAgainst, setVotersAgainst] = useState<string[]>([])
  const [votersAbstain, setVotersAbstain] = useState<string[]>([])
  const [openDropdown, setOpenDropdown] = useState<"for" | "against" | "abstain" | null>(null)
  const [votingTypes, setVotingTypes] = useState<string[]>([])
  const [selectedVotingType, setSelectedVotingType] = useState("")
  const [userTypeWeights, setUserTypeWeights] = useState<Record<string, number>>({})
  const [votingParametersData, setVotingParametersData] = useState<VotingParameterRow[]>([])
  const [jurisdictionRules, setJurisdictionRules] = useState<JurisdictionRule[]>([])
  const [buildingContext, setBuildingContext] = useState<BuildingVotingContext>({})
  const [topicTitle, setTopicTitle] = useState<string>("")
  const [meetingType, setMeetingType] = useState<string>("")

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
      fetchVotingTypesAndResults()
      fetchCompanyUsers()
      fetchGeniusWords()
      fetchTopicTitle()

      if (editMode && existingDecisionId) {
        loadExistingDecision(existingDecisionId)
      }

      if (parentDecisionId) {
        loadParentDecision(parentDecisionId)
      }
      fetchTopicContent()
    }
  }, [isOpen, meetingId, editMode, existingDecisionId, parentDecisionId, topicId, meetingAttendees])

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

  const fetchVotingTypesAndResults = async () => {
    try {
      const meetingIdNum = typeof meetingId === 'string' ? parseInt(meetingId) : meetingId
      
      // 1. Get meeting and building context
      const { data: meetingData } = await supabase
        .from("meetings")
        .select("building_id, meeting_type")
        .eq("id", meetingIdNum)
        .single()

      if (!meetingData) return

      const currentMeetingType = meetingData.meeting_type || ""
      setMeetingType(currentMeetingType)

      const { data: buildingData } = await supabase
        .from("buildings")
        .select("company_id, building_type, province_code, address")
        .eq("id", meetingData.building_id)
        .single()

      const companyId = buildingData?.company_id

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

      // 2. Fetch all relevant parameters (Voting Types, Dynamic Decision Results, User Weights)
      type RawParam = {
        id: number
        company_id: number | null
        parameter_type: string
        value: string
        description: string | null
        weight?: number
        linked_voting_type?: string | null
        calculation_formula?: string | null
        is_default?: boolean
      }
      const params = (await getVotingParameters(companyId)) as RawParam[]
      setVotingParametersData(
        params.filter((p) => p.parameter_type === "voting_type") as VotingParameterRow[],
      )
      
      // 3. Process Voting Types
      // Build the resolved list: for each unique voting type name, prefer the
      // company-specific row over the global one. This is the same set the admin
      // sees in the checkboxes, so names always match what was saved in linked_voting_type.
      const vtByName = new Map<string, string>() // lowercase name → canonical name
      // Globals first (lower priority)
      params
        .filter((p: RawParam) => p.parameter_type === 'voting_type' && p.company_id === null)
        .forEach((p: RawParam) => vtByName.set(p.value.trim().toLowerCase(), p.value.trim()))
      // Company-specific overrides (higher priority — replaces global with same name)
      params
        .filter((p: RawParam) => p.parameter_type === 'voting_type' && p.company_id !== null)
        .forEach((p: RawParam) => vtByName.set(p.value.trim().toLowerCase(), p.value.trim()))

      const allVTypes = Array.from(vtByName.values())

      // meeting_type and voting_type are global-only (company_id = null).
      // Just find the single global row for this meeting type.
      const meetingTypeParam = params.find(
        (p: RawParam) => p.parameter_type === 'meeting_type' &&
                         p.value === currentMeetingType &&
                         p.company_id === null
      )

      const allowedTypesStr = meetingTypeParam?.linked_voting_type

      let filteredVTypes: string[]
      if (allowedTypesStr && allowedTypesStr.trim()) {
        // Filter to only the voting types checked in the admin
        const allowedList = allowedTypesStr
          .split(',')
          .map((s: string) => s.trim().toLowerCase())
          .filter(Boolean)
        filteredVTypes = allVTypes.filter((vt: string) =>
          allowedList.includes(vt.trim().toLowerCase())
        )
        // Safety: if nothing matched (stale data) show all
        if (filteredVTypes.length === 0) filteredVTypes = allVTypes
      } else {
        // No voting types marked for this meeting type — show nothing
        // Voting Mechanism dropdown will be hidden
        filteredVTypes = []
      }

      const finalVTypes = filteredVTypes

      setVotingTypes(finalVTypes)

      if (!editMode && !selectedVotingType) {
        setSelectedVotingType(finalVTypes[0] || "")
      }

      // 4. Process Decision Results
      // a. dynamic results from parameters
      const dynamicResults = params
        .filter((p: RawParam) => p.parameter_type === 'decision_result')
        .map((p: RawParam) => p.value)

      // b. static results from company record
      let companyResults: string[] = []
      if (companyId) {
        const { data: companyData } = await supabase
          .from("companies")
          .select("default_decision_results")
          .eq("id", companyId)
          .single()
        companyResults = companyData?.default_decision_results || []
      }

      // c. system defaults
      const baseDefaults = ["M/S/C", "Defeated", "Deferred"]
      
      // Merge all unique results
      const mergedResults = [...new Set([...baseDefaults, ...dynamicResults, ...companyResults])]
      setDecisionResults(mergedResults)

      // 5. Process User Type Weights
      const weights = params
        .filter((p: RawParam) => p.parameter_type === 'user_type')
        .reduce((acc: Record<string, number>, p: RawParam) => {
          if (!acc[p.value] || p.company_id !== null) {
            acc[p.value] = p.weight ?? 1.0;
          }
          return acc;
        }, {} as Record<string, number>)
      setUserTypeWeights(weights)

    } catch (err) {
      console.error("Error fetching voting context:", err)
      // Leave lists empty — admin must configure types via the Voting tab
      setVotingTypes([])
      setDecisionResults([])
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

  const fetchCompanyUsers = async () => {
    try {
      const meetingIdNum = typeof meetingId === 'string' ? parseInt(meetingId) : meetingId

      const { data: meetingData } = await supabase
        .from("meetings")
        .select("building_id, attendees")
        .eq("id", meetingIdNum)
        .single()

      if (!meetingData) return

      const { data: buildingData } = await supabase
        .from("buildings")
        .select("company_id")
        .eq("id", meetingData.building_id)
        .single()

      // ── 1. Users linked to this building via user_buildings ──
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

      // ── 2. Users linked via company_id (PMs, Corp Admins, etc.) ──
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

      // ── 3. Merge & deduplicate by id ──
      const merged = [...(buildingUsers ?? []), ...(companyUsers ?? [])]
      const unique = Array.from(
        new Map(merged.map((u: any) => [u.id, u])).values()
      ).sort((a: any, b: any) => a.name.localeCompare(b.name))

      setCompanyUsers(unique)

      const attendeeList: MeetingAttendeeRecord[] =
        meetingAttendees ??
        ((meetingData.attendees as MeetingAttendeeRecord[] | null) ?? [])

      setMeetingVoters(buildMeetingVoters(attendeeList, unique))
      setAttendees(attendeeList as unknown as Attendee[])
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

        const filtered = meetingVoters.filter(user =>
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

  const buildVoteSnapshotFields = () => {
    const hasVotes =
      votersFor.length > 0 ||
      votersAgainst.length > 0 ||
      votesFor !== "" ||
      votesAgainst !== ""

    if (!selectedVotingType || !hasVotes) {
      return {
        vote_passed: null,
        vote_percentage: null,
        reconsideration_triggered: false,
        reconsideration_hold_days: 0,
        reconsideration_hold_until: null,
      }
    }

    const { result } = evaluateDecisionVote({
      votingType: selectedVotingType,
      votersFor,
      votersAgainst,
      votersAbstain,
      votesFor,
      votesAgainst,
      votesAbstain,
      meetingVoters,
      getWeight: (name) => getVoterWeight(meetingVoters, name),
      eligibleHeadcount: getEligibleHeadcount(meetingVoters),
      eligibleWeight: getEligibleWeight(meetingVoters),
      jurisdictionRules,
      votingParameters: votingParametersData,
      building: buildingContext,
      useWeighted: false,
    })

    return toDecisionVoteSnapshot(result)
  }

  const handleSave = async () => {
    if (!motionText.trim()) {
      setError("Motion text is required")
      return
    }

    setSaving(true)
    setError(null)

    const voteSnapshot = buildVoteSnapshotFields()

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
            edited_at: new Date().toISOString(),
            ...voteSnapshot,
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
            recorded_at: new Date().toISOString(),
            ...voteSnapshot,
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

  const getRoleBadge = (user: MeetingVoter | any) => {
    const t = user.user_type
    if (t === "corporate_administrator") return { label: "Corp Admin", color: "bg-purple-100 text-purple-700" }
    if (t === "property_manager") return { label: "PM", color: "bg-blue-100 text-blue-700" }
    if (t === "owner") return { label: "Owner", color: "bg-amber-100 text-amber-700" }
    if (t === "resident") return { label: "Resident", color: "bg-green-100 text-green-700" }
    if (t === "attendee" || t === "user") {
      const roleLabel = user.role ? user.role : "Attendee"
      return { label: roleLabel, color: "bg-slate-100 text-slate-700" }
    }
    if (user.role) {
      return { label: user.role, color: "bg-slate-100 text-slate-700" }
    }
    return { label: "Member", color: "bg-slate-100 text-slate-700" }
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
          <div className="absolute z-50 w-64 bottom-full mb-1 bg-card border border-border rounded-lg shadow-xl max-h-44 overflow-y-auto">
            {meetingVoters.length === 0 && (
              <div className="p-3 text-sm text-muted-foreground text-center">
                No voters — open <strong>Attendees</strong>, add people, click <strong>Save Attendees</strong>, then reopen this decision.
              </div>
            )}
            {meetingVoters.map((user) => {
              const badge = getRoleBadge(user)
              const isChecked = selected.includes(user.name)
              return (
                <div
                  key={String(user.id)}
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
    <div className="flex flex-col max-h-[80vh]">
      {/* ── Scrollable top section ── */}
      <div className="p-6 pb-4 overflow-y-auto flex-1 min-h-0">
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

        <VotingAnalysisPreview
          selectedVotingType={selectedVotingType}
          meetingVoters={meetingVoters}
          votersFor={votersFor}
          votersAgainst={votersAgainst}
          votersAbstain={votersAbstain}
          votesFor={votesFor}
          votesAgainst={votesAgainst}
          votesAbstain={votesAbstain}
          userTypeWeights={userTypeWeights}
          jurisdictionRules={jurisdictionRules}
          votingParameters={votingParametersData}
          building={buildingContext}
          getWeight={(name) => getVoterWeight(meetingVoters, name)}
          eligibleHeadcount={getEligibleHeadcount(meetingVoters)}
          eligibleWeight={getEligibleWeight(meetingVoters)}
        />

        <div className={`grid ${votingTypes.length > 0 ? "grid-cols-2" : "grid-cols-1"} gap-4`}>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5 flex items-center gap-2">
              Result
            </label>
            <select
              value={result}
              onChange={(e) => setResult(e.target.value)}
              className="w-full h-11 px-4 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary/20 outline-none transition-all"
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

          {votingTypes.length > 0 && (
            <div className="animate-in slide-in-from-right-4 duration-300">
              <label className="block text-sm font-medium text-foreground mb-1.5 flex items-center gap-2">
                Voting Mechanism
              </label>
              <select
                value={selectedVotingType}
                onChange={(e) => setSelectedVotingType(e.target.value)}
                className="w-full h-11 px-4 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                disabled={saving || deleting}
              >
                {votingTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>{/* close grid: result + voting mechanism */}

        </div>{/* close space-y-4 */}
      </div>{/* end scrollable section */}

      {/* ── Non-clipping bottom section: vote dropdowns, preview, buttons ── */}
      <div className="px-6 pt-2 pb-4 space-y-3">
        <div className="space-y-2 animate-in slide-in-from-bottom-4 duration-300">
          <div className="grid grid-cols-3 gap-4">
            {renderVotingDropdown("Votes For", "for", votersFor)}
            {renderVotingDropdown("Votes Against", "against", votersAgainst)}
            {renderVotingDropdown("Abstentions", "abstain", votersAbstain)}
          </div>
        </div>



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
      </div>{/* end non-clipping section */}

      {/* Action buttons — also outside the scroll zone */}
      <div className="flex gap-3 px-6 pb-4 pt-1 border-t border-border/40">
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
