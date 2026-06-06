/**
 * Voting Engine — Meeting Genius
 *
 * High-precision vote evaluation using decimal.js to avoid JS floating-point
 * rounding errors (e.g. 62.80 vs 62.7525 edge cases).
 *
 * This module is the single source of truth for all pass/fail decisions.
 * It reads a JurisdictionRule (from the jurisdiction_rules table) and applies
 * the correct denominator source and abstention treatment per legislation.
 *
 * BC Strata Property Act:
 *   - Majority / 3/4: denominator = FOR + AGAINST (abstentions excluded)
 *   - 3/4 carry < 50% of eligible → 7-day implementation hold
 *   - 80% / Unanimous: denominator = total eligible (abstentions count against)
 *
 * Ontario Condominium Act:
 *   - Simple majority / 75%: denominator = FOR + AGAINST (abstentions excluded)
 *   - Unanimous: denominator = all eligible units
 */

import Decimal from "decimal.js"

// ─────────────────────────────────────────────────────────────────────────────
// Public Interfaces
// ─────────────────────────────────────────────────────────────────────────────

/** Raw vote counts and weights to pass into the engine. */
export interface VotingContext {
  /** Headcount of FOR votes */
  votesFor: number
  /** Headcount of AGAINST votes */
  votesAgainst: number
  /** Headcount of ABSTAIN votes */
  votesAbstain: number
  /** Weighted sum of FOR votes (user voting_weight) */
  weightedFor: number
  /** Weighted sum of AGAINST votes */
  weightedAgainst: number
  /** Weighted sum of ABSTAIN votes */
  weightedAbstain: number
  /** Total number of eligible voters in the corporation/building */
  eligibleHeadcount: number
  /** Total weighted eligible votes in the corporation/building */
  eligibleWeight: number
  /** Total lots/units in the building (for absolute majority and bypass) */
  totalLots: number
}

/**
 * A row from the jurisdiction_rules table that describes how a specific
 * voting type must be evaluated for a given province + building type.
 */
export interface JurisdictionRule {
  id?: number
  province_code: string
  building_type: string
  voting_type: string
  /** Required percentage (e.g. 50.00, 75.00, 80.00, 100.00) */
  threshold_percent: number
  /** 'exclude' = abstentions don't count in denominator; 'against' = they do */
  abstention_treatment: "exclude" | "against"
  /** 'active' = FOR+AGAINST; 'eligible' = total eligible weight; 'all_units' = count of units */
  denominator_source: "active" | "eligible" | "all_units"
  /** Whether passing this vote can trigger the reconsideration hold */
  reconsideration_trigger: boolean
  /**
   * If reconsideration_trigger=true: the minimum % of eligible votes required
   * to avoid the hold (e.g. 50.00 for BC 3/4 rule).
   */
  reconsideration_threshold_percent: number | null
  /** Number of hold days (e.g. 7 for BC 3/4) */
  reconsideration_hold_days: number
  /** Human-readable legislative description shown in the UI */
  description: string | null
  created_at?: string
  updated_at?: string
}

/** Full result of a vote evaluation, ready to render. */
export interface VotingResult {
  /** Whether the motion carried (FOR% >= threshold%) */
  passed: boolean
  /** The actual support percentage achieved, high-precision Decimal */
  percentage: Decimal
  /** The required threshold percentage */
  threshold: Decimal
  /** The denominator value that was used in the calculation */
  denominatorUsed: number
  /** The numerator value (FOR count or weight) */
  numeratorUsed: number
  /** True if the BC 3/4 reconsideration hold is triggered */
  reconsiderationTriggered: boolean
  /** Days of hold (0 unless reconsiderationTriggered) */
  holdDays: number
  /** True if the BC Unanimous court bypass is eligible */
  courtBypassEligible: boolean
  /** Human-readable description of the rule applied */
  formulaDescription: string
  /** Whether weighted votes were used in this evaluation */
  useWeighted: boolean
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Export
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Evaluate a vote to determine pass/fail and any reconsideration triggers.
 *
 * @param votingType    The label of the selected voting mechanism (e.g. "Three-Quarter Vote (75%)")
 * @param context       Raw vote counts and weights
 * @param rule          The jurisdiction rule from the DB (or null for legacy fallback)
 * @param useWeighted   Whether to use weighted votes instead of headcount
 * @param customThreshold  For "Custom Percentage (%)" mode only
 */
export function evaluateVoting(
  votingType: string,
  context: VotingContext,
  rule: JurisdictionRule | null,
  useWeighted: boolean = false,
  customThreshold?: number,
): VotingResult {
  // ── Custom Percentage shortcut ────────────────────────────────────────────
  if (votingType === "Custom Percentage (%)" && customThreshold !== undefined) {
    const numer = useWeighted ? context.weightedFor : context.votesFor
    const denom = useWeighted
      ? context.weightedFor + context.weightedAgainst
      : context.votesFor + context.votesAgainst
    const pct = denom > 0 ? new Decimal(numer).div(denom).times(100) : new Decimal(0)
    const thr = new Decimal(customThreshold)
    
    // Majority (50.00) must be strictly greater than
    const passed = customThreshold === 50 ? pct.gt(thr) : pct.gte(thr)

    return {
      passed,
      percentage: pct,
      threshold: thr,
      denominatorUsed: denom,
      numeratorUsed: numer,
      reconsiderationTriggered: false,
      holdDays: 0,
      courtBypassEligible: false,
      formulaDescription: `Custom ${customThreshold}% threshold (votes cast)`,
      useWeighted,
    }
  }

  // ── Jurisdiction rule path ────────────────────────────────────────────────
  if (rule) {
    let numer: number
    let denom: number

    if (rule.denominator_source === "eligible") {
      // 80% / Unanimous: denominator = ALL eligible weight
      numer = useWeighted ? context.weightedFor : context.votesFor
      denom = useWeighted ? context.eligibleWeight : context.eligibleHeadcount
    } else if (rule.denominator_source === "all_units") {
      // Ontario s.56/s.33: denominator = ALL units (regardless of weighted mode, it's typically units)
      numer = useWeighted ? context.weightedFor : context.votesFor
      denom = context.totalLots
    } else {
      // 'active' denominator
      if (rule.abstention_treatment === "against") {
        // Abstentions explicitly added to denominator (treated as NO)
        numer = useWeighted ? context.weightedFor : context.votesFor
        const abstainAdd = useWeighted ? context.weightedAbstain : context.votesAbstain
        denom = useWeighted
          ? context.weightedFor + context.weightedAgainst + abstainAdd
          : context.votesFor + context.votesAgainst + abstainAdd
      } else {
        // Pure 'exclude': denominator = FOR + AGAINST only
        numer = useWeighted ? context.weightedFor : context.votesFor
        denom = useWeighted
          ? context.weightedFor + context.weightedAgainst
          : context.votesFor + context.votesAgainst
      }
    }

    const dNumer = new Decimal(numer)
    const dDenom = new Decimal(denom)
    const pct = dDenom.gt(0) ? dNumer.div(dDenom).times(100) : new Decimal(0)
    const thr = new Decimal(rule.threshold_percent)
    
    // Majority (50.00) must be strictly greater than
    // Unanimous (100.00) must have zero dissenting or abstaining votes
    let passed = rule.threshold_percent === 50 ? pct.gt(thr) : pct.gte(thr)
    
    if (rule.threshold_percent === 100 && rule.denominator_source === "eligible") {
      const hasDissent = context.votesAgainst > 0 || context.votesAbstain > 0 || (useWeighted && (context.weightedAgainst > 0 || context.weightedAbstain > 0))
      if (hasDissent) passed = false
    }

    // ── BC 3/4 Reconsideration Check ─────────────────────────────────────
    let reconsiderationTriggered = false
    if (passed && rule.reconsideration_trigger && rule.reconsideration_threshold_percent !== null) {
      const eligDenom = useWeighted ? context.eligibleWeight : context.eligibleHeadcount
      const eligPct =
        eligDenom > 0 ? dNumer.div(new Decimal(eligDenom)).times(100) : new Decimal(0)
      const reconThr = new Decimal(rule.reconsideration_threshold_percent)
      reconsiderationTriggered = !eligPct.gte(reconThr)
    }

    // ── BC Unanimous Court Bypass Check ──────────────────────────────────
    let courtBypassEligible = false
    if (
      !passed &&
      rule.province_code === "BC" &&
      rule.threshold_percent === 100 &&
      context.totalLots >= 10
    ) {
      const eligWeight = useWeighted ? context.eligibleWeight : context.eligibleHeadcount
      const dissentingWeight = eligWeight - numer
      const nWeight = useWeighted ? context.weightedAgainst : context.votesAgainst
      const aWeight = useWeighted ? context.weightedAbstain : context.votesAbstain
      
      // Bypass condition (a): only one lot failed
      // Note: check for exactly one lot might be complex with weighted voting, 
      // but if we use headcount (useWeighted=false), it's N+A === 1.
      // If weighted, we check if dissenting weight matches approx one lot.
      const oneLotFail = useWeighted 
        ? (dissentingWeight > 0 && dissentingWeight <= (eligWeight / context.totalLots) * 1.01)
        : (context.votesAgainst + context.votesAbstain === 1)
        
      // Bypass condition (b): lots representing less than 5% of E
      const fivePctFail = dissentingWeight < (eligWeight * 0.05)
      
      courtBypassEligible = oneLotFail || fivePctFail
    }

    return {
      passed,
      percentage: pct,
      threshold: thr,
      denominatorUsed: denom,
      numeratorUsed: numer,
      reconsiderationTriggered,
      holdDays: reconsiderationTriggered ? (rule.reconsideration_hold_days ?? 7) : 0,
      courtBypassEligible,
      formulaDescription:
        rule.description ||
        `${rule.threshold_percent}% (${rule.abstention_treatment} abstentions, ${rule.denominator_source} denominator)`,
      useWeighted,
    }
  }

  // ── Legacy fallback: no jurisdiction rule in DB ───────────────────────────
  const name = votingType.toLowerCase()

  if (name.includes("advisory")) {
    const numer = useWeighted ? context.weightedFor : context.votesFor
    const denom = useWeighted
      ? context.weightedFor + context.weightedAgainst
      : context.votesFor + context.votesAgainst
    const pct = denom > 0 ? new Decimal(numer).div(denom).times(100) : new Decimal(0)
    return {
      passed: true,
      percentage: pct,
      threshold: new Decimal(0),
      denominatorUsed: denom,
      numeratorUsed: numer,
      reconsiderationTriggered: false,
      holdDays: 0,
      courtBypassEligible: false,
      formulaDescription: "Advisory vote (always passes)",
      useWeighted,
    }
  }

  // Infer legislative-style rule from voting type label
  const isUnanimous = name.includes("100") || name.includes("unanimous")
  const is80 = name.includes("80")
  const is90 = name.includes("90")
  const isS107 = name.includes("s.107") || name.includes("declaration amendment")
  const isThreeQuarter =
    name.includes("75") || name.includes("three-quarter") || name.includes("special")
  
  // S.107 and Unanimous/80 often use eligible or all_units denominator
  const isEligibleDenom = isUnanimous || (is80 && !isS107)
  const isAllUnitsDenom = isS107

  const numer = useWeighted ? context.weightedFor : context.votesFor
  let denom: number

  if (isEligibleDenom) {
    denom = useWeighted ? context.eligibleWeight : context.eligibleHeadcount
  } else if (isAllUnitsDenom) {
    denom = context.totalLots
  } else {
    denom = useWeighted
      ? context.weightedFor + context.weightedAgainst
      : context.votesFor + context.votesAgainst
  }

  const pct = denom > 0 ? new Decimal(numer).div(denom).times(100) : new Decimal(0)

  let thrValue = 50
  let desc = "Majority (votes cast, abstentions excluded)"

  if (isUnanimous) {
    thrValue = 100
    desc = "Unanimous (100% of all eligible; abstentions count against)"
  } else if (is90) {
    thrValue = 90
    desc = "90% of all registered units (Ontario s.107)"
  } else if (is80) {
    thrValue = 80
    desc = isS107 ? "80% of all registered units (Ontario s.107)" : "80% of all eligible voters (abstentions count against)"
  } else if (isThreeQuarter) {
    thrValue = 75
    desc = "Three-Quarter (75% of votes cast, abstentions excluded)"
  }

  const thr = new Decimal(thrValue)
  const passed = thrValue === 50 ? pct.gt(thr) : pct.gte(thr)

  let reconsiderationTriggered = false
  if (passed && isThreeQuarter) {
    const eligDenom = useWeighted ? context.eligibleWeight : context.eligibleHeadcount
    const eligPct =
      eligDenom > 0 ? new Decimal(numer).div(eligDenom).times(100) : new Decimal(0)
    reconsiderationTriggered = !eligPct.gte(new Decimal(50))
  }

  return {
    passed,
    percentage: pct,
    threshold: thr,
    denominatorUsed: denom,
    numeratorUsed: numer,
    reconsiderationTriggered,
    holdDays: reconsiderationTriggered ? 7 : 0,
    courtBypassEligible: false, // Legacy fallback doesn't support complex bypass logic
    formulaDescription: desc,
    useWeighted,
  }
}
