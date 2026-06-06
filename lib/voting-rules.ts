/**
 * Resolve jurisdiction rules and voting parameters for decision evaluation.
 */

import type { JurisdictionRule, VotingContext, VotingResult } from "./voting-engine"
import { evaluateVoting } from "./voting-engine"

export interface VotingParameterRow {
  value: string
  parameter_type?: string
  calculation_formula?: string | null
  weight?: number | null
}

export interface BuildingVotingContext {
  building_type?: string | null
  province_code?: string | null
  address?: string | null
}

/** Infer BC / ON from dedicated column or address string. */
export function inferProvinceCode(input: BuildingVotingContext): string {
  const code = (input.province_code || "").trim().toUpperCase()
  if (code === "BC" || code === "ON") return code

  const addr = (input.address || "").toUpperCase()
  if (addr.includes("BRITISH COLUMBIA") || /, BC\b|,BC\b|\bBC,/.test(addr)) return "BC"
  if (addr.includes("ONTARIO") || /, ON\b|,ON\b|\bON,/.test(addr)) return "ON"

  const type = (input.building_type || "").toLowerCase()
  if (type.includes("condominium") || type.includes("condo")) return "ON"
  if (type.includes("strata")) return "BC"

  return "BC"
}

export function findJurisdictionRule(
  rules: JurisdictionRule[],
  votingType: string,
  provinceCode?: string,
  buildingType?: string,
): JurisdictionRule | null {
  const normalized = votingType.trim()
  const matches = rules.filter((r) => r.voting_type === normalized)
  if (matches.length === 0) return null

  if (provinceCode && buildingType) {
    const exact = matches.find(
      (r) => r.province_code === provinceCode && r.building_type === buildingType,
    )
    if (exact) return exact
  }
  if (provinceCode) {
    const byProv = matches.find((r) => r.province_code === provinceCode)
    if (byProv) return byProv
  }
  if (buildingType) {
    const byBldg = matches.find((r) => r.building_type === buildingType)
    if (byBldg) return byBldg
  }
  return matches[0]
}

/** Build a synthetic jurisdiction rule from voting_parameters.calculation_formula. */
export function ruleFromCalculationFormula(
  votingType: string,
  formula: string,
  provinceCode: string,
  buildingType: string,
): JurisdictionRule | null {
  const pct = parseFloat(String(formula).replace(/%/g, ""))
  if (isNaN(pct)) return null

  const name = votingType.toLowerCase()
  const isUnanimous = pct >= 100 || name.includes("unanimous")
  const is80 = (pct >= 80 && pct < 100) || name.includes("80")
  const isEligibleDenom = isUnanimous || is80
  const isThreeQuarter =
    pct === 75 ||
    name.includes("three-quarter") ||
    name.includes("special") ||
    name.includes("3/4")

  return {
    province_code: provinceCode,
    building_type: buildingType,
    voting_type: votingType,
    threshold_percent: pct,
    abstention_treatment: isEligibleDenom ? "against" : "exclude",
    denominator_source: isEligibleDenom ? "eligible" : "active",
    reconsideration_trigger: isThreeQuarter && provinceCode === "BC",
    reconsideration_threshold_percent: isThreeQuarter && provinceCode === "BC" ? 50 : null,
    reconsideration_hold_days: isThreeQuarter && provinceCode === "BC" ? 7 : 0,
    description: `Parameter formula: ${pct}% (${isEligibleDenom ? "all eligible" : "votes cast"}, abstentions ${isEligibleDenom ? "count against" : "excluded"})`,
  }
}

export function resolveVotingRule(
  votingType: string,
  jurisdictionRules: JurisdictionRule[],
  votingParameters: VotingParameterRow[],
  building: BuildingVotingContext,
): JurisdictionRule | null {
  const provinceCode = inferProvinceCode(building)
  const buildingType =
    building.building_type ||
    (provinceCode === "ON" ? "Condominium Corporation" : "Strata Corporation")

  const fromTable = findJurisdictionRule(
    jurisdictionRules,
    votingType,
    provinceCode,
    buildingType,
  )
  if (fromTable) return fromTable

  const param = votingParameters.find(
    (p) => p.parameter_type === "voting_type" && p.value === votingType,
  )
  if (param?.calculation_formula) {
    return ruleFromCalculationFormula(
      votingType,
      param.calculation_formula,
      provinceCode,
      buildingType,
    )
  }

  return null
}

export interface DecisionVoteInput {
  votingType: string
  votersFor: string[]
  votersAgainst: string[]
  votersAbstain: string[]
  votesFor: number | ""
  votesAgainst: number | ""
  votesAbstain: number | ""
  meetingVoters: { name: string; voting_weight?: number | null; user_type?: string }[]
  getWeight: (name: string) => number
  eligibleHeadcount: number
  eligibleWeight: number
  totalLots: number
  jurisdictionRules: JurisdictionRule[]
  votingParameters: VotingParameterRow[]
  building: BuildingVotingContext
  customThreshold?: number
  useWeighted?: boolean
}

export function buildVotingContext(input: DecisionVoteInput): VotingContext {
  const forCount =
    input.votersFor.length > 0
      ? input.votersFor.length
      : Number(input.votesFor) || 0
  const againstCount =
    input.votersAgainst.length > 0
      ? input.votersAgainst.length
      : Number(input.votesAgainst) || 0
  const abstainCount =
    input.votersAbstain.length > 0
      ? input.votersAbstain.length
      : Number(input.votesAbstain) || 0

  const sumWeight = (names: string[]) =>
    names.reduce((s, n) => s + input.getWeight(n), 0)

  return {
    votesFor: forCount,
    votesAgainst: againstCount,
    votesAbstain: abstainCount,
    weightedFor:
      input.votersFor.length > 0 ? sumWeight(input.votersFor) : forCount,
    weightedAgainst:
      input.votersAgainst.length > 0
        ? sumWeight(input.votersAgainst)
        : againstCount,
    weightedAbstain:
      input.votersAbstain.length > 0
        ? sumWeight(input.votersAbstain)
        : abstainCount,
    eligibleHeadcount: input.eligibleHeadcount,
    eligibleWeight: input.eligibleWeight,
    totalLots: input.totalLots,
  }
}

export function evaluateDecisionVote(input: DecisionVoteInput): {
  result: VotingResult
  activeRule: JurisdictionRule | null
} {
  const ctx = buildVotingContext(input)
  const activeRule = resolveVotingRule(
    input.votingType,
    input.jurisdictionRules,
    input.votingParameters,
    input.building,
  )

  const result = evaluateVoting(
    input.votingType,
    ctx,
    activeRule,
    input.useWeighted ?? false,
    input.votingType === "Custom Percentage (%)" ? input.customThreshold : undefined,
  )

  return { result, activeRule }
}

export interface DecisionVoteSnapshot {
  vote_passed: boolean | null
  vote_percentage: number | null
  reconsideration_triggered: boolean
  reconsideration_hold_days: number
  reconsideration_hold_until: string | null
  court_bypass_eligible: boolean
  
  // High-fidelity audit fields (§7)
  formula_denominator: string | null
  abstention_treatment: string | null
  total_eligible_weight: number | null
  total_votes_present: number | null
  votes_cast_total: number | null
  threshold_value: number | null
  calculated_at: string | null
  votes_for_weight: number | null
  votes_against_weight: number | null
  votes_abstain_weight: number | null
  tie_broken_by_chair: boolean
}

export function toDecisionVoteSnapshot(
  result: VotingResult,
  activeRule: JurisdictionRule | null,
  context: VotingContext,
  tieBrokenByChair: boolean = false
): DecisionVoteSnapshot {
  const holdUntil =
    result.reconsiderationTriggered && result.holdDays > 0
      ? new Date(Date.now() + result.holdDays * 24 * 60 * 60 * 1000).toISOString()
      : null

  return {
    vote_passed: result.passed,
    vote_percentage: result.percentage.toDecimalPlaces(4).toNumber(),
    reconsideration_triggered: result.reconsiderationTriggered,
    reconsideration_hold_days: result.reconsiderationTriggered ? result.holdDays : 0,
    reconsideration_hold_until: holdUntil,
    court_bypass_eligible: result.courtBypassEligible,
    
    formula_denominator: activeRule?.denominator_source || "active",
    abstention_treatment: activeRule?.abstention_treatment || "exclude",
    total_eligible_weight: context.eligibleWeight,
    total_votes_present: result.useWeighted 
      ? (context.weightedFor + context.weightedAgainst + context.weightedAbstain) 
      : (context.votesFor + context.votesAgainst + context.votesAbstain),
    votes_cast_total: result.denominatorUsed,
    threshold_value: result.threshold.toNumber(),
    calculated_at: new Date().toISOString(),
    votes_for_weight: context.weightedFor,
    votes_against_weight: context.weightedAgainst,
    votes_abstain_weight: context.weightedAbstain,
    tie_broken_by_chair: tieBrokenByChair
  }
}
