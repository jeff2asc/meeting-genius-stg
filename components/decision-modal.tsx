"use client"

import { useState, useEffect } from "react"
import { X, Users, ThumbsUp, ThumbsDown, Minus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { supabase, getCurrentUser } from "@/lib/supabase"
import GeniusWordsInput from "./GeniusWordsInput"

interface DecisionModalProps {
  topicId: number
  meetingId: number
  isOpen: boolean
  onClose: () => void
  onSave: () => void
}

interface VotingEligibleOwner {
  id: number
  name: string
  email: string
  voting_units: number
}

export default function DecisionModal({ topicId, meetingId, isOpen, onClose, onSave }: DecisionModalProps) {
  const [formData, setFormData] = useState({
    motion_text: "",
    result: "pending" as "approved" | "rejected" | "pending" | "deferred",
    votes_for: null as number | null,
    votes_against: null as number | null,
    abstentions: null as number | null,
  })

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Voting eligibility
  const [votingEligibleOwners, setVotingEligibleOwners] = useState<VotingEligibleOwner[]>([])
  const [totalVotingUnits, setTotalVotingUnits] = useState(0)
  const [attendeeVotingUnits, setAttendeeVotingUnits] = useState(0)
  const [loadingVoters, setLoadingVoters] = useState(false)

  // Individual voter tracking
  const [individualVotes, setIndividualVotes] = useState<
    { owner_id: number; vote: "for" | "against" | "abstain" | null }[]
  >([])

  useEffect(() => {
    if (isOpen) {
      fetchVotingEligibleOwners()
    }
  }, [isOpen, meetingId])

  const fetchVotingEligibleOwners = async () => {
    setLoadingVoters(true)
    try {
      const { data: meetingData, error: meetingError } = await supabase
        .from("meetings")
        .select("building_id, attendees")
        .eq("id", meetingId)
        .single()

      if (meetingError || !meetingData) {
        console.error("Error fetching meeting:", meetingError)
        setLoadingVoters(false)
        return
      }

      const buildingId = meetingData.building_id
      const attendeesData = meetingData.attendees || []

      const { data: ownersData, error: ownersError } = await supabase
        .from("owners")
        .select("id, name, email, voting_units")
        .eq("building_id", buildingId)
        .gt("voting_units", 0)

      if (ownersError || !ownersData) {
        console.error("Error fetching owners:", ownersError)
        setLoadingVoters(false)
        return
      }

      setVotingEligibleOwners(ownersData)

      const total = ownersData.reduce((sum, owner) => sum + owner.voting_units, 0)
      setTotalVotingUnits(total)

      const attendeeEmails = attendeesData
        .filter((a: any) => a.present)
        .map((a: any) => a.email.toLowerCase())

      const attendeeTotal = ownersData
        .filter((owner) => attendeeEmails.includes(owner.email.toLowerCase()))
        .reduce((sum, owner) => sum + owner.voting_units, 0)

      setAttendeeVotingUnits(attendeeTotal)

      const initialVotes = ownersData.map((owner) => ({
        owner_id: owner.id,
        vote: null as "for" | "against" | "abstain" | null,
      }))
      setIndividualVotes(initialVotes)
    } catch (err) {
      console.error("Unexpected error:", err)
    } finally {
      setLoadingVoters(false)
    }
  }

  const handleVoteChange = (ownerId: number, vote: "for" | "against" | "abstain" | null) => {
    setIndividualVotes((prev) =>
      prev.map((v) => (v.owner_id === ownerId ? { ...v, vote } : v))
    )
  }

  useEffect(() => {
    const votesFor = individualVotes
      .filter((v) => v.vote === "for")
      .reduce((sum, v) => {
        const owner = votingEligibleOwners.find((o) => o.id === v.owner_id)
        return sum + (owner?.voting_units || 0)
      }, 0)

    const votesAgainst = individualVotes
      .filter((v) => v.vote === "against")
      .reduce((sum, v) => {
        const owner = votingEligibleOwners.find((o) => o.id === v.owner_id)
        return sum + (owner?.voting_units || 0)
      }, 0)

    const abstentions = individualVotes
      .filter((v) => v.vote === "abstain")
      .reduce((sum, v) => {
        const owner = votingEligibleOwners.find((o) => o.id === v.owner_id)
        return sum + (owner?.voting_units || 0)
      }, 0)

    setFormData((prev) => ({
      ...prev,
      votes_for: votesFor || null,
      votes_against: votesAgainst || null,
      abstentions: abstentions || null,
    }))
  }, [individualVotes, votingEligibleOwners])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.motion_text.trim()) {
      setError("Motion text is required")
      return
    }

    setSaving(true)
    setError(null)

    try {
      const currentUser = getCurrentUser()

      const { error: insertError } = await supabase.from("decisions").insert({
        topic_id: topicId,
        meeting_id: meetingId,
        motion_text: formData.motion_text.trim(),
        result: formData.result,
        votes_for: formData.votes_for,
        votes_against: formData.votes_against,
        abstentions: formData.abstentions,
        total_voting_units: totalVotingUnits,
        attendee_voting_units: attendeeVotingUnits,
        individual_votes: individualVotes,
        recorded_by: currentUser?.id,
      })

      if (insertError) {
        console.error("Error inserting decision:", insertError)
        setError(`Failed to save decision: ${insertError.message}`)
        setSaving(false)
        return
      }

      console.log("✅ Decision saved successfully")
      onSave()
    } catch (err) {
      console.error("Unexpected error:", err)
      setError("An unexpected error occurred")
      setSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 animate-in fade-in">
      <Card className="w-full sm:max-w-3xl border-0 rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-border bg-gradient-to-r from-decision-purple/10 to-decision-purple/5 p-6 sticky top-0 bg-card z-10">
          <h2 className="text-xl font-bold text-foreground">Record Decision</h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded hover:bg-muted transition-colors"
            disabled={saving}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded text-sm">
              {error}
            </div>
          )}

          {/* ⭐ UPDATED: Motion Text with GeniusWords */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Motion Text *
            </label>
            <GeniusWordsInput
              value={formData.motion_text}
              onChange={(value) => setFormData({ ...formData, motion_text: value })}
              placeholder="Enter the motion text... (Type # for shortcuts)"
              rows={4}
              disabled={saving}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Result</label>
            <select
              value={formData.result}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  result: e.target.value as "approved" | "rejected" | "pending" | "deferred",
                })
              }
              disabled={saving}
              className="w-full px-3 py-2 bg-background text-foreground rounded border border-border focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="deferred">Deferred</option>
            </select>
          </div>

          {/* Voting Units Summary */}
          <Card className="p-4 bg-muted/20 border-border">
            <div className="flex items-center gap-2 mb-3">
              <Users className="h-5 w-5 text-primary" />
              <h3 className="font-semibold text-foreground">Voting Units Summary</h3>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Total Voting Units:</span>
                <span className="ml-2 font-semibold text-foreground">{totalVotingUnits}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Present Voting Units:</span>
                <span className="ml-2 font-semibold text-foreground">{attendeeVotingUnits}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Votes For:</span>
                <span className="ml-2 font-semibold text-green-600">{formData.votes_for || 0}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Votes Against:</span>
                <span className="ml-2 font-semibold text-red-600">{formData.votes_against || 0}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Abstentions:</span>
                <span className="ml-2 font-semibold text-gray-600">{formData.abstentions || 0}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Not Voted:</span>
                <span className="ml-2 font-semibold text-gray-400">
                  {attendeeVotingUnits -
                    (formData.votes_for || 0) -
                    (formData.votes_against || 0) -
                    (formData.abstentions || 0)}
                </span>
              </div>
            </div>
          </Card>

          {/* Individual Voters */}
          <div>
            <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
              <Users className="h-4 w-4" />
              Individual Votes ({votingEligibleOwners.length} voters)
            </h3>

            {loadingVoters ? (
              <div className="text-center py-4 text-muted-foreground">Loading voters...</div>
            ) : votingEligibleOwners.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground border border-dashed border-border rounded-lg">
                No voting-eligible owners found for this building
              </div>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto border border-border rounded-lg p-2">
                {votingEligibleOwners.map((owner) => {
                  const currentVote = individualVotes.find((v) => v.owner_id === owner.id)?.vote
                  return (
                    <div
                      key={owner.id}
                      className="flex items-center justify-between bg-background border border-border rounded-lg p-3"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm text-foreground truncate">{owner.name}</div>
                        <div className="text-xs text-muted-foreground truncate">{owner.email}</div>
                        <div className="text-xs text-primary font-semibold">
                          {owner.voting_units} {owner.voting_units === 1 ? "unit" : "units"}
                        </div>
                      </div>
                      <div className="flex gap-1 ml-2">
                        <Button
                          type="button"
                          size="sm"
                          variant={currentVote === "for" ? "default" : "outline"}
                          onClick={() => handleVoteChange(owner.id, currentVote === "for" ? null : "for")}
                          disabled={saving}
                          className={
                            currentVote === "for"
                              ? "bg-green-600 hover:bg-green-700 text-white"
                              : "text-green-600 hover:bg-green-50"
                          }
                        >
                          <ThumbsUp className="h-3 w-3" />
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant={currentVote === "against" ? "default" : "outline"}
                          onClick={() =>
                            handleVoteChange(owner.id, currentVote === "against" ? null : "against")
                          }
                          disabled={saving}
                          className={
                            currentVote === "against"
                              ? "bg-red-600 hover:bg-red-700 text-white"
                              : "text-red-600 hover:bg-red-50"
                          }
                        >
                          <ThumbsDown className="h-3 w-3" />
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant={currentVote === "abstain" ? "default" : "outline"}
                          onClick={() =>
                            handleVoteChange(owner.id, currentVote === "abstain" ? null : "abstain")
                          }
                          disabled={saving}
                          className={
                            currentVote === "abstain"
                              ? "bg-gray-600 hover:bg-gray-700 text-white"
                              : "text-gray-600 hover:bg-gray-50"
                          }
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1" disabled={saving}>
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-decision-purple text-white hover:bg-decision-purple/90"
              disabled={saving || !formData.motion_text.trim()}
            >
              {saving ? "Saving..." : "Save Decision"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
