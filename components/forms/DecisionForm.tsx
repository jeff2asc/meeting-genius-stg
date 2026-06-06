"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { supabase, getCurrentUser, getVotingParameters } from "@/lib/supabase"
import { toast } from "sonner"
import { AlertCircle, CheckSquare, FileText, Plus, Edit3 } from "lucide-react"
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
  const [tieBrokenByChair, setTieBrokenByChair] = useState(false)
  const [totalLots, setTotalLots] = useState(0)
  const [totalUE, setTotalUE] = useState(0)
  
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [suggestions, setSuggestions] = useState<MeetingVoter[]>([])
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
      const { data: notes } = await supabase.from('notes').select('*').eq('topic_id', topicId)
      const { data: tasks } = await supabase.from('tasks').select('*').eq('topic_id', topicId)
      setTopicNotes(notes || [])
      setTopicTasks(tasks || [])
    } catch (err) { console.error('Error fetching topic content:', err) }
  }

  const insertReference = (content: string) => {
    const cleanContent = content.trim()
    if (!cleanContent) return
    setMotionText(prev => prev.trim() ? prev + "\n" + cleanContent : cleanContent)
    toast.success("Content inserted into motion")
  }

  const fetchVotingTypes = async () => {
    try {
      const { data: meetingData } = await supabase.from("meetings").select("building_id, meeting_type").eq("id", meetingId).single()
      if (meetingData) {
        setMeetingType(meetingData.meeting_type || "")
        const { data: buildingData } = await supabase.from("buildings").select("company_id, building_type, province_code, address").eq("id", meetingData.building_id).single()
        const bCtx: BuildingVotingContext = { building_type: buildingData?.building_type, province_code: (buildingData as any)?.province_code, address: buildingData?.address }
        setBuildingContext(bCtx)
        const provinceCode = inferProvinceCode(bCtx)
        try {
          const rules = await apiClient.v1.jurisdictionRules.list({ building_type: bCtx.building_type || undefined, province_code: provinceCode })
          setJurisdictionRules((rules || []) as JurisdictionRule[])
        } catch { setJurisdictionRules([]) }
        const params = await getVotingParameters(buildingData?.company_id)
        const votingParams = params.filter((p: any) => p.parameter_type === "voting_type")
        setVotingParametersData(votingParams as VotingParameterRow[])
        const vTypes = votingParams.map((p: any) => p.value)
        let finalTypes = vTypes.length > 0 ? [...vTypes] : ["Majority Vote (50%+1)", "Three-Quarter Vote (75%)", "Unanimous Vote (100%)"]
        if (!finalTypes.includes("Custom Percentage (%)")) finalTypes.push("Custom Percentage (%)")
        if (provinceCode === "BC" && !finalTypes.includes("80% Vote")) finalTypes.push("80% Vote")
        if (provinceCode === "ON") {
          for (const t of [
            "Majority — Votes Cast (ON S.53)", 
            "Majority — All Registered Units (ON By-law)", 
            "Majority — Votes at Meeting (ON By-law)",
            "ON S.107 Declaration Amendment (80% units)",
            "ON S.107 Declaration Amendment (90% units)"
          ]) {
            if (!finalTypes.includes(t)) finalTypes.push(t)
          }
        }
        setVotingTypes(finalTypes)
        setSelectedVotingType(finalTypes[0])
      }
    } catch (err) { console.error("Error fetching voting types:", err) }
  }

  const fetchTopicTitle = async () => {
    try {
      const { data, error } = await supabase.from('topics').select('title').eq('id', topicId).single()
      if (!error && data) setTopicTitle(data.title)
    } catch (err) { console.error('Error fetching topic title:', err) }
  }

  const fetchDecisionResults = async () => {
    try {
      const { data: meetingData, error: meetingError } = await supabase.from("meetings").select("building_id").eq("id", meetingId).single()
      if (meetingError || !meetingData) { setDecisionResults(["M/S/C", "Defeated", "Deferred"]); return; }
      const { data: buildingData, error: buildingError } = await supabase.from("buildings").select("company_id").eq("id", meetingData.building_id).single()
      if (buildingError || !buildingData || !buildingData.company_id) { setDecisionResults(["M/S/C", "Defeated", "Deferred"]); return; }
      const params = await getVotingParameters(buildingData.company_id)
      const dynamicResults = params.filter((p: any) => p.parameter_type === 'decision_result').map((p: any) => p.value)
      const { data: companyData } = await supabase.from("companies").select("default_decision_results").eq("id", buildingData.company_id).single()
      const merged = [...new Set(["M/S/C", "Defeated", "Deferred", ...dynamicResults, ...(companyData?.default_decision_results || [])])]
      setDecisionResults(merged)
    } catch (err) { setDecisionResults(["M/S/C", "Defeated", "Deferred"]) }
  }

  const fetchCompanyUsers = async () => {
    try {
      const { data: meetingData, error: meetingError } = await supabase.from("meetings").select("building_id, attendees").eq("id", meetingId).single()
      if (meetingError || !meetingData) return
      const { data: buildingData } = await supabase.from("buildings").select("company_id").eq("id", meetingData.building_id).single()
      const { data: userBuildings } = await supabase.from("user_buildings").select("user_id").eq("building_id", meetingData.building_id)
      const buildingUserIds = (userBuildings ?? []).map((ub: any) => ub.user_id).filter(Boolean)
      const buildingUsersPromise = buildingUserIds.length > 0 ? supabase.from("users").select("id, name, email, user_type, roles, voting_weight").in("id", buildingUserIds) : Promise.resolve({ data: [] })
      const companyUsersPromise = buildingData?.company_id ? supabase.from("users").select("id, name, email, user_type, roles, voting_weight").eq("company_id", buildingData.company_id) : Promise.resolve({ data: [] })
      const [{ data: buildingUsers }, { data: companyUsers }] = await Promise.all([buildingUsersPromise, companyUsersPromise])
      const unique = Array.from(new Map([...(buildingUsers ?? []), ...(companyUsers ?? [])].map((u: any) => [u.id, u])).values()) as CompanyUser[]
      const eligibleUsers = unique.filter(u => u.user_type === 'owner' || u.user_type === 'resident')
      setTotalLots(eligibleUsers.length)
      setTotalUE(eligibleUsers.reduce((sum, u) => sum + (u.voting_weight ?? 1), 0))
      setCompanyUsers(unique.sort((a, b) => a.name.localeCompare(b.name)))
      setMeetingVoters(buildMeetingVoters((meetingData.attendees as any) ?? [], unique))
    } catch (err) { console.error("Error fetching company users:", err) }
  }

  const fetchGeniusWords = async () => {
    if (!currentUser?.id) return
    try {
      const { data, error } = await supabase.from('genius_words').select('id, shortcode, description').eq('user_id', currentUser.id).order('shortcode', { ascending: true })
      if (!error && data) setGeniusWords(data)
    } catch (err) { console.error('Error fetching genius words:', err) }
  }

  const handleMotionTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value
    const cursorPos = e.target.selectionStart
    setMotionText(text); setCursorPosition(cursorPos)
    const textBeforeCursor = text.substring(0, cursorPos)
    const atIndex = textBeforeCursor.lastIndexOf("@")
    const hashIndex = textBeforeCursor.lastIndexOf("#")
    const mostRecentIsAt = atIndex > hashIndex
    if (mostRecentIsAt && atIndex !== -1) {
      const textAfterAt = textBeforeCursor.substring(atIndex + 1)
      if (!textAfterAt.includes(" ") && !textAfterAt.includes("\n")) {
        setMentionStartIndex(atIndex)
        const filtered = meetingVoters.filter(u => u.name.toLowerCase().includes(textAfterAt.toLowerCase()))
        setSuggestions(filtered); setShowSuggestions(filtered.length > 0); setSelectedSuggestionIndex(0); setShowGeniusSuggestions(false)
      } else { setShowSuggestions(false) }
    } else if (!mostRecentIsAt && hashIndex !== -1) {
      const textAfterHash = textBeforeCursor.substring(hashIndex + 1)
      if (!textAfterHash.includes(" ") && !textAfterHash.includes("\n")) {
        setGeniusStartIndex(hashIndex)
        const filtered = geniusWords.filter(gw => gw.shortcode.toLowerCase().includes(textAfterHash.toLowerCase()))
        setGeniusSuggestions(filtered); setShowGeniusSuggestions(filtered.length > 0); setSelectedGeniusIndex(0); setShowSuggestions(false)
      } else { setShowGeniusSuggestions(false) }
    } else { setShowSuggestions(false); setShowGeniusSuggestions(false) }
  }

  const insertMention = (user: MeetingVoter) => {
    if (mentionStartIndex === -1) return
    const newText = motionText.substring(0, mentionStartIndex) + user.name + " " + motionText.substring(cursorPosition)
    setMotionText(newText); setShowSuggestions(false); setMentionStartIndex(-1)
    setTimeout(() => { if (textareaRef.current) { const pos = mentionStartIndex + user.name.length + 1; textareaRef.current.setSelectionRange(pos, pos); textareaRef.current.focus() } }, 0)
  }

  const insertGeniusWord = (geniusWord: GeniusWord) => {
    if (geniusStartIndex === -1) return
    const newText = motionText.substring(0, geniusStartIndex) + geniusWord.description + " " + motionText.substring(cursorPosition)
    setMotionText(newText); setShowGeniusSuggestions(false); setGeniusStartIndex(-1)
    setTimeout(() => { if (textareaRef.current) { const pos = geniusStartIndex + geniusWord.description.length + 1; textareaRef.current.setSelectionRange(pos, pos); textareaRef.current.focus() } }, 0)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showSuggestions) {
      if (e.key === "ArrowDown") { e.preventDefault(); setSelectedSuggestionIndex(prev => prev < suggestions.length - 1 ? prev + 1 : prev) }
      else if (e.key === "ArrowUp") { e.preventDefault(); setSelectedSuggestionIndex(prev => prev > 0 ? prev - 1 : 0) }
      else if (e.key === "Enter" && suggestions.length > 0) { e.preventDefault(); insertMention(suggestions[selectedSuggestionIndex]) }
      else if (e.key === "Escape") setShowSuggestions(false)
      return
    }
    if (showGeniusSuggestions) {
      if (e.key === "ArrowDown") { e.preventDefault(); setSelectedGeniusIndex(prev => prev < geniusSuggestions.length - 1 ? prev + 1 : prev) }
      else if (e.key === "ArrowUp") { e.preventDefault(); setSelectedGeniusIndex(prev => prev > 0 ? prev - 1 : 0) }
      else if (e.key === "Enter" && geniusSuggestions.length > 0) { e.preventDefault(); insertGeniusWord(geniusSuggestions[selectedGeniusIndex]) }
      else if (e.key === "Escape") setShowGeniusSuggestions(false)
      return
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!motionText.trim()) { setError("Motion text is required"); return }
    try {
      setSaving(true); setError(null)
      const currentEligibleWeight = getEligibleWeight(meetingVoters)
      const currentEligibleHeadcount = getEligibleHeadcount(meetingVoters)
      let quorumMet = true
      const province = inferProvinceCode(buildingContext)
      if (province === "BC") { if (currentEligibleHeadcount < Math.ceil(totalLots / 3) || currentEligibleWeight < (totalUE / 3)) quorumMet = false }
      else if (province === "ON") { if (currentEligibleHeadcount < Math.ceil(totalLots * 0.25)) quorumMet = false }
      if (!quorumMet) toast.error("Quorum not met. Decision can be saved but may be invalid.")
      let vs: any = {}
      if (selectedVotingType && (votesFor.length > 0 || votesAgainst.length > 0 || votesAbstain.length > 0)) {
        const { result: vr, activeRule } = evaluateDecisionVote({
          votingType: selectedVotingType, votersFor: votesFor, votersAgainst: votesAgainst, votersAbstain: votesAbstain, votesFor: "", votesAgainst: "", votesAbstain: "", meetingVoters,
          getWeight: (name) => getVoterWeight(meetingVoters, name), eligibleHeadcount: currentEligibleHeadcount, eligibleWeight: currentEligibleWeight, totalLots, jurisdictionRules, votingParameters: votingParametersData, building: buildingContext,
          customThreshold: selectedVotingType === "Custom Percentage (%)" ? customThreshold : undefined,
        })
        vs = toDecisionVoteSnapshot(vr, activeRule, {
          votesFor: votesFor.length, votesAgainst: votesAgainst.length, votesAbstain: votesAbstain.length,
          weightedFor: votesFor.reduce((s, n) => s + getVoterWeight(meetingVoters, n), 0),
          weightedAgainst: votesAgainst.reduce((s, n) => s + getVoterWeight(meetingVoters, n), 0),
          weightedAbstain: votesAbstain.reduce((s, n) => s + getVoterWeight(meetingVoters, n), 0),
          eligibleHeadcount: currentEligibleHeadcount, eligibleWeight: currentEligibleWeight, totalLots,
        }, tieBrokenByChair)
      }
      const weightFor = votesFor.reduce((s, n) => s + getVoterWeight(meetingVoters, n), 0)
      const weightAgainst = votesAgainst.reduce((s, n) => s + getVoterWeight(meetingVoters, n), 0)
      const weightAbstain = votesAbstain.reduce((s, n) => s + getVoterWeight(meetingVoters, n), 0)
      const { error: insertError } = await supabase.from("decisions").insert({
        topic_id: topicId, motion_text: motionText, result: result || (vs.vote_passed ? "Carried" : "Defeated"),
        voting_type: selectedVotingType === "Custom Percentage (%)" ? `Custom (${customThreshold}%)` : (selectedVotingType || null),
        votes_for: votesFor.length || null, votes_against: votesAgainst.length || null, votes_abstain: votesAbstain.length || null,
        votes_for_weight: weightFor, votes_against_weight: weightAgainst, votes_abstain_weight: weightAbstain, 
        quorum_met: quorumMet, total_lots: totalLots, total_ue: totalUE, ...vs,
      })
      if (insertError) { setError("Failed to save decision"); setSaving(false); return }
      toast.success('Decision created successfully')
      setMotionText(""); setResult(""); setVotesFor([]); setVotesAgainst([]); setVotesAbstain([]); setOpenDropdown(null); if (onSave) onSave()
      setSaving(false)
    } catch (err) { setError("An unexpected error occurred"); setSaving(false) }
  }

  const toggleVote = (type: "for" | "against" | "abstain", name: string) => {
    if (type === "for") { setVotesFor(p => p.includes(name) ? p.filter(n => n !== name) : [...p, name]); setVotesAgainst(p => p.filter(n => n !== name)); setVotesAbstain(p => p.filter(n => n !== name)) }
    else if (type === "against") { setVotesAgainst(p => p.includes(name) ? p.filter(n => n !== name) : [...p, name]); setVotesFor(p => p.filter(n => n !== name)); setVotesAbstain(p => p.filter(n => n !== name)) }
    else { setVotesAbstain(p => p.includes(name) ? p.filter(n => n !== name) : [...p, name]); setVotesFor(p => p.filter(n => n !== name)); setVotesAgainst(p => p.filter(n => n !== name)) }
  }

  const getRoleBadge = (user: MeetingVoter | CompanyUser) => {
    const t = user.user_type
    if (t === "corporate_administrator") return { label: "Corp Admin", color: "bg-purple-100 text-purple-700" }
    if (t === "property_manager") return { label: "PM", color: "bg-blue-100 text-blue-700" }
    if (t === "owner") return { label: "Owner", color: "bg-amber-100 text-amber-700" }
    if (t === "resident") return { label: "Resident", color: "bg-green-100 text-green-700" }
    return { label: "Member", color: "bg-slate-100 text-slate-700" }
  }

  const renderDropdown = (label: string, type: "for" | "against" | "abstain", selected: string[]) => {
    const isOpen = openDropdown === type
    return (
      <div className="relative">
        <label className="block text-[10px] items-center gap-1 font-black uppercase tracking-widest text-muted-foreground/80 mb-2">{label}</label>
        <button type="button" onClick={() => setOpenDropdown(isOpen ? null : type)} className="w-full h-10 px-3 bg-background border border-border rounded-lg text-left flex justify-between items-center text-xs font-bold shadow-sm">
          <span className="truncate">{selected.length > 0 ? `${selected.length} Selected` : "Select..."}</span>
          <span>{isOpen ? "▲" : "▼"}</span>
        </button>
        {isOpen && (
          <div className="absolute z-[100] w-64 mt-1 bg-card border border-border rounded-xl shadow-2xl max-h-60 overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
            {meetingVoters.map((user) => {
              const badge = getRoleBadge(user); const isChecked = selected.includes(user.name)
              return (
                <div key={user.name} className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-muted ${isChecked ? "bg-primary/5" : ""}`} onClick={() => toggleVote(type, user.name)}>
                  <input type="checkbox" checked={isChecked} readOnly className="h-4 w-4 rounded border-border text-primary" />
                  <div className="flex-1 min-w-0"><div className="text-xs font-bold truncate">{user.name}</div><div className="text-[10px] text-muted-foreground truncate">{user.email}</div></div>
                  <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded ${badge.color}`}>{badge.label}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col bg-card overflow-hidden rounded-2xl border border-border shadow-2xl h-full max-h-[90vh]">
      <form onSubmit={handleSubmit} className="flex flex-col w-full h-full">
        {/* 🏆 GLOBAL CONTROL HEADER (TITLE + ACTIONS LEVEL) */}
        <div className="px-6 py-3.5 border-b border-border bg-muted/50 flex items-center justify-between z-50">
          <div className="flex flex-col">
            <h2 className="text-sm font-black text-foreground flex items-center gap-2">
              <CheckSquare className="h-4 w-4 text-decision-purple" />
              Record Decision
            </h2>
            <div className="flex items-center gap-1.5 text-[8px] font-black text-green-600 uppercase tracking-widest mt-0.5">
              <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
              VoteCapture™ Certified
            </div>
          </div>
          
          <div className="flex items-center gap-2.5">
            <Button 
              type="button" 
              variant="outline" 
              className="h-9 px-4 text-[10px] font-black rounded-xl border-2 hover:bg-muted"
              onClick={() => { if (onSave) onSave() }}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              className="h-9 px-6 bg-decision-purple hover:bg-decision-purple/90 text-white text-[10px] font-black rounded-xl shadow-lg active:scale-95 flex items-center justify-center gap-2" 
              disabled={saving || !motionText.trim()}
            >
              {saving ? (
                <div className="h-3 w-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                "Save Decision"
              )}
            </Button>
          </div>
        </div>

        {/* 📜 SCROLLABLE WORKSPACE */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6 bg-background/20">
          {/* Topic Context Pill */}
          <div className="bg-primary/5 rounded-2xl p-4 border border-primary/10">
            <div className="text-[9px] uppercase font-black tracking-widest text-primary mb-1">Current Topic</div>
            <div className="text-sm font-black text-foreground/80 leading-tight">
              {topicTitle || "Meeting Topic"}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground px-1 flex items-center gap-1.5">
              <Edit3 className="h-3 w-3" /> Motion / Resolution Text
            </label>
            <textarea 
              ref={textareaRef} 
              className="w-full min-h-[90px] p-4 text-xs bg-background border-2 border-muted focus:border-decision-purple rounded-2xl resize-none shadow-sm transition-all" 
              value={motionText} 
              onChange={handleMotionTextChange} 
              onKeyDown={handleKeyDown} 
              placeholder="Motion by @Name, seconded by @Name..." 
            />
          </div>

          {(meetingType === "AGM" || meetingType === "SGM") && (
            <div className="space-y-2">
              <div className="text-[10px] uppercase font-black tracking-widest text-muted-foreground px-1">Legislative Audit Analytics</div>
              <div className="rounded-2xl border-2 border-primary/20 overflow-hidden bg-white shadow-sm">
                <div className="max-h-[180px] overflow-y-auto custom-scrollbar">
                  <VotingAnalysisPreview 
                    selectedVotingType={selectedVotingType} meetingVoters={meetingVoters} 
                    votersFor={votesFor} votersAgainst={votesAgainst} votersAbstain={votesAbstain} 
                    votesFor="" votesAgainst="" votesAbstain="" userTypeWeights={{}} 
                    jurisdictionRules={jurisdictionRules} votingParameters={votingParametersData} building={buildingContext} 
                    getWeight={(n) => getVoterWeight(meetingVoters, n)} eligibleHeadcount={getEligibleHeadcount(meetingVoters)} 
                    eligibleWeight={getEligibleWeight(meetingVoters)} totalLots={totalLots} 
                    customThreshold={selectedVotingType === "Custom Percentage (%)" ? customThreshold : undefined} 
                    className="shadow-none border-0"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground px-1">Result Status</label>
              <select className="w-full h-11 px-4 text-xs bg-background border-2 border-muted rounded-2xl font-bold" value={result} onChange={(e) => setResult(e.target.value)}>
                <option value="">Select status...</option>
                {decisionResults.map(res => <option key={res}>{res}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground px-1">Voting Logic</label>
              <select className="w-full h-11 px-4 text-xs bg-background border-2 border-muted rounded-2xl font-bold" value={selectedVotingType} onChange={(e) => setSelectedVotingType(e.target.value)}>
                {votingTypes.map(vt => <option key={vt}>{vt}</option>)}
              </select>
            </div>
          </div>

          {selectedVotingType.includes("Majority") && (
            <div className="flex items-center gap-3 px-4 py-3 bg-primary/5 rounded-2xl border border-primary/10">
              <input type="checkbox" id="tie-break" checked={tieBrokenByChair} onChange={(e) => setTieBrokenByChair(e.target.checked)} className="h-4 w-4 rounded border-primary/30 text-primary cursor-pointer" />
              <label htmlFor="tie-break" className="text-[11px] font-extrabold text-primary/80 cursor-pointer">
                Chair Tie-break used (SPA s.2.2)
              </label>
            </div>
          )}

          <div className="space-y-4 pt-2">
            <div className="text-[10px] uppercase font-black tracking-widest text-muted-foreground px-1">Voter Attendance Selection</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {renderDropdown("Votes For", "for", votesFor)}
              {renderDropdown("Votes Against", "against", votesAgainst)}
              {renderDropdown("Abstentions", "abstain", votesAbstain)}
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}
