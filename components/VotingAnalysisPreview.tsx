"use client"

import { CheckCircle2, XCircle, AlertCircle, CheckSquare, Clock } from "lucide-react"
import type { JurisdictionRule } from "@/lib/voting-engine"
import {
  evaluateDecisionVote,
  type BuildingVotingContext,
  type VotingParameterRow,
} from "@/lib/voting-rules"
import type { MeetingVoter } from "@/lib/meeting-voters"

export interface VotingAnalysisPreviewProps {
  selectedVotingType: string
  meetingVoters: MeetingVoter[]
  votersFor: string[]
  votersAgainst: string[]
  votersAbstain: string[]
  votesFor: number | ""
  votesAgainst: number | ""
  votesAbstain: number | ""
  userTypeWeights: Record<string, number>
  jurisdictionRules: JurisdictionRule[]
  votingParameters: VotingParameterRow[]
  building: BuildingVotingContext
  getWeight: (name: string) => number
  eligibleHeadcount: number
  eligibleWeight: number
  customThreshold?: number
  className?: string
}

export default function VotingAnalysisPreview({
  selectedVotingType,
  meetingVoters,
  votersFor,
  votersAgainst,
  votersAbstain,
  votesFor,
  votesAgainst,
  votesAbstain,
  userTypeWeights,
  jurisdictionRules,
  votingParameters,
  building,
  getWeight,
  eligibleHeadcount,
  eligibleWeight,
  customThreshold,
  className = "",
}: VotingAnalysisPreviewProps) {
  const hasVotes =
    votersFor.length > 0 ||
    votersAgainst.length > 0 ||
    votesFor !== "" ||
    votesAgainst !== ""

  if (!selectedVotingType || !hasVotes) return null

  const { result, activeRule } = evaluateDecisionVote({
    votingType: selectedVotingType,
    votersFor,
    votersAgainst,
    votersAbstain,
    votesFor,
    votesAgainst,
    votesAbstain,
    meetingVoters,
    getWeight,
    eligibleHeadcount,
    eligibleWeight,
    jurisdictionRules,
    votingParameters,
    building,
    customThreshold,
    useWeighted: false,
  })

  const displayPct = result.percentage.toDecimalPlaces(1).toNumber()
  const displayThreshold = result.threshold.toNumber()
  const abstainNote =
    activeRule?.denominator_source === "eligible"
      ? "Abstentions count against (denominator = all eligible)."
      : activeRule?.abstention_treatment === "against"
        ? "Abstentions included in denominator as votes against."
        : "Abstentions excluded from denominator (votes cast only)."

  return (
    <div
      className={`bg-gradient-to-br from-primary/5 to-decision-purple/5 p-5 rounded-2xl border border-primary/20 shadow-sm animate-in fade-in zoom-in-95 duration-500 ${className}`}
    >
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-[11px] font-bold uppercase tracking-widest text-primary flex items-center gap-2">
          <CheckSquare className="h-4 w-4" />
          Live Decision Analysis
        </h4>
        <span className="text-[10px] bg-white dark:bg-card border border-primary/20 text-primary px-2.5 py-1 rounded-lg font-bold shadow-sm">
          {selectedVotingType}
        </span>
      </div>

      <div className="space-y-4">
        <div
          className={`flex items-center justify-between p-3 rounded-xl border ${
            result.passed ? "bg-green-50 border-green-200 dark:bg-green-950/30" : "bg-red-50 border-red-200 dark:bg-red-950/30"
          }`}
        >
          <div className="flex items-center gap-3">
            {result.passed ? (
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            ) : (
              <XCircle className="h-5 w-5 text-red-600" />
            )}
            <div>
              <div
                className={`text-sm font-black ${
                  result.passed ? "text-green-800 dark:text-green-400" : "text-red-800 dark:text-red-400"
                }`}
              >
                {result.passed ? "MOTION CARRIED" : "MOTION DEFEATED"}
              </div>
              <div className="text-[10px] font-medium text-muted-foreground">
                {displayPct.toFixed(1)}% support · requires {displayThreshold}%
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-black text-foreground leading-none">
              {displayPct.toFixed(1)}%
            </div>
            <div className="text-[9px] font-bold text-muted-foreground mt-1 uppercase">
              of {result.denominatorUsed} in denominator
            </div>
          </div>
        </div>

        <div className="h-3 w-full bg-muted/50 rounded-full overflow-hidden relative border border-border/20">
          <div
            className={`h-full transition-all duration-500 ${result.passed ? "bg-green-500" : "bg-amber-500"}`}
            style={{ width: `${Math.min(displayPct, 100)}%` }}
          />
          {displayThreshold < 100 && (
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-foreground/40"
              style={{ left: `${displayThreshold}%` }}
              title={`Threshold: ${displayThreshold}%`}
            />
          )}
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="bg-background/60 p-2 rounded-lg border border-border/30 text-center">
            <div className="text-[9px] text-muted-foreground font-bold uppercase">For</div>
            <div className="text-xs font-black text-green-700">{result.numeratorUsed}</div>
          </div>
          <div className="bg-background/60 p-2 rounded-lg border border-border/30 text-center">
            <div className="text-[9px] text-muted-foreground font-bold uppercase">Against</div>
            <div className="text-xs font-black text-red-700">
              {votersAgainst.length > 0
                ? votersAgainst.length
                : Number(votesAgainst) || 0}
            </div>
          </div>
          <div className="bg-background/60 p-2 rounded-lg border border-border/30 text-center">
            <div className="text-[9px] text-muted-foreground font-bold uppercase">Abstain</div>
            <div className="text-xs font-black">
              {votersAbstain.length || Number(votesAbstain) || 0}
            </div>
          </div>
        </div>

        <p className="text-[9px] text-muted-foreground italic text-center flex items-center justify-center gap-1">
          <AlertCircle className="h-3 w-3 shrink-0" />
          {result.formulaDescription}. {abstainNote}
        </p>
      </div>

      {result.reconsiderationTriggered && (
        <div className="mt-4 relative overflow-hidden rounded-xl border border-amber-400/50 bg-amber-500/10 p-4">
          <div className="flex items-start gap-3">
            <Clock className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-amber-800 dark:text-amber-400">
                {result.holdDays}-Day Implementation Hold Required
              </p>
              <p className="text-xs text-amber-700/80 dark:text-amber-400/70 mt-1 leading-relaxed">
                Motion passed the {displayThreshold}% threshold but received less than{" "}
                {activeRule?.reconsideration_threshold_percent ?? 50}% of all eligible votes.
                Implementation must wait {result.holdDays} days for reconsideration.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
