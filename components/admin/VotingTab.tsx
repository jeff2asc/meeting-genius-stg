"use client"

import { useState, useEffect, useRef } from "react"
import { supabase, getCurrentUser } from "@/lib/supabase"
import { apiClient } from "@/lib/api-client"
import { 
  fetchVotingParametersAction, 
  fetchJurisdictionRulesAction,
  fetchVotingTabDataAction, 
  saveVotingParameterAction, 
  deleteVotingParameterAction,
  saveJurisdictionRuleAction,
  deleteJurisdictionRuleAction
} from "@/lib/api-actions"
import { isMaster, isCorporateAdmin } from "@/lib/permissions"
import UserWeightsModal from "./UserWeightsModal"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Plus, Trash2, Edit2, Globe2, Shield, BookOpen, AlertTriangle } from "lucide-react"
import { toast } from "sonner"
import { Checkbox } from "@/components/ui/checkbox"

type ParameterType = 'meeting_type' | 'voting_type' | 'user_type' | 'building_type' | 'decision_result'

interface VotingParameter {
  id: number
  company_id: number | null
  parameter_type: ParameterType
  value: string
  description: string | null
  is_default: boolean
  weight: number
  calculation_formula?: string | null
  created_at: string
  updated_at: string
}

interface JurisdictionRule {
  id: number
  province_code: string
  building_type: string
  voting_type: string
  threshold_percent: number
  abstention_treatment: 'exclude' | 'against'
  denominator_source: 'active' | 'eligible'
  reconsideration_trigger: boolean
  reconsideration_threshold_percent: number | null
  reconsideration_hold_days: number
  description: string | null
}

interface VotingTabProps {
  initialCompanyId?: number | null
}

export default function VotingTab({ initialCompanyId }: VotingTabProps) {
  const [parameters, setParameters] = useState<VotingParameter[]>([])
  const [loading, setLoading] = useState(true)
  const lastFetchId = useRef(0)
  const lastUsersFetchId = useRef(0)
  const lastRulesFetchId = useRef(0)
  const [showHelp, setShowHelp] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editValue, setEditValue] = useState("")
  const [editDescription, setEditDescription] = useState("")
  const [isAdding, setIsAdding] = useState<ParameterType | null>(null)
  const [newValue, setNewValue] = useState("resident")
  const [newDescription, setNewDescription] = useState("")
  const [editWeight, setEditWeight] = useState<number>(1.0)
  const [newWeight, setNewWeight] = useState<number>(1.0)
  const [editLinkedVotingType, setEditLinkedVotingType] = useState("")
  const [newLinkedVotingType, setNewLinkedVotingType] = useState("")
  const [editCalculationFormula, setEditCalculationFormula] = useState("")
  const [newCalculationFormula, setNewCalculationFormula] = useState("")
  // Formula UI mode: 'simple' = percentage slider, 'custom' = expression builder
  const [formulaMode, setFormulaMode] = useState<'simple' | 'custom'>('simple')
  const [companyUsers, setCompanyUsers] = useState<any[]>([])
  const [userLoading, setUserLoading] = useState(false)
  const [showUserModal, setShowUserModal] = useState(false)
  const [paramModalOpen, setParamModalOpen] = useState(false)
  const [renameConfirmOpen, setRenameConfirmOpen] = useState(false)
  const [renameMeetingCount, setRenameMeetingCount] = useState<number | null>(null)
  const [renameCountLoading, setRenameCountLoading] = useState(false)
  const [savingParam, setSavingParam] = useState(false)

  // ── Jurisdiction Rules state ──
  const [jurisdictionRules, setJurisdictionRules] = useState<JurisdictionRule[]>([])
  const [jRulesLoading, setJRulesLoading] = useState(false)
  const [jRulesTableMissing, setJRulesTableMissing] = useState(false)
  const [editingRule, setEditingRule] = useState<Partial<JurisdictionRule> | null>(null)
  const [ruleModalOpen, setRuleModalOpen] = useState(false)
  const [savingRule, setSavingRule] = useState(false)

  const currentUser = getCurrentUser()
  const companyId = currentUser?.company_id
  const isMasterUser = isMaster(currentUser)
  const isCorporateAdminUser = isCorporateAdmin(currentUser)

  const [companies, setCompanies] = useState<any[]>([])
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(initialCompanyId || companyId || null)
  const [fetchingCompanies, setFetchingCompanies] = useState(false)

  useEffect(() => {
    if (isMasterUser) {
      fetchCompanies()
    }
  }, [isMasterUser])

  useEffect(() => {
    loadTabData()
  }, [selectedCompanyId])

  // Sync prop changes if component stays mounted
  useEffect(() => {
    if (initialCompanyId !== undefined && initialCompanyId !== selectedCompanyId) {
      setSelectedCompanyId(initialCompanyId)
    }
  }, [initialCompanyId])

  const fetchCompanies = async () => {
    setFetchingCompanies(true)
    try {
      const { data, error } = await supabase.from('companies').select('id, name').order('name')
      if (error) throw error
      setCompanies(data || [])
    } catch (err) {
      console.error("Error fetching companies:", err)
    } finally {
      setFetchingCompanies(false)
    }
  }

  // Preview how many meetings will be updated when renaming a meeting type
  useEffect(() => {
    if (!paramModalOpen || !editingId) {
      setRenameMeetingCount(null)
      setRenameCountLoading(false)
      return
    }

    const param = parameters.find((p) => p.id === editingId)
    if (!param || param.parameter_type !== "meeting_type") {
      setRenameMeetingCount(null)
      return
    }

    const trimmed = editValue.trim()
    if (!trimmed || trimmed === param.value) {
      setRenameMeetingCount(null)
      setRenameCountLoading(false)
      return
    }

    let cancelled = false
    setRenameCountLoading(true)

    async function loadMeetingCount() {
      try {
        let query = supabase
          .from("meetings")
          .select("id", { count: "exact", head: true })
          .eq("meeting_type", param!.value)

        if (param!.company_id != null) {
          const { data: buildings, error: buildingsError } = await supabase
            .from("buildings")
            .select("id")
            .eq("company_id", param!.company_id)

          if (buildingsError) throw buildingsError
          const buildingIds = (buildings || []).map((b) => b.id)
          if (buildingIds.length === 0) {
            if (!cancelled) setRenameMeetingCount(0)
            return
          }
          query = query.in("building_id", buildingIds)
        }

        const { count, error } = await query
        if (error) throw error
        if (!cancelled) setRenameMeetingCount(count ?? 0)
      } catch {
        if (!cancelled) setRenameMeetingCount(null)
      } finally {
        if (!cancelled) setRenameCountLoading(false)
      }
    }

    loadMeetingCount()
    return () => {
      cancelled = true
    }
  }, [paramModalOpen, editingId, editValue, parameters])

  const loadTabData = async () => {
    const requestId = ++lastFetchId.current
    setLoading(true)
    setJRulesLoading(true)
    setUserLoading(true)

    try {
      console.log(`[VotingTab] Loading all data for companyId: ${selectedCompanyId}`)
      const { parameters: pData, rules: rData, users: uData } = await fetchVotingTabDataAction(selectedCompanyId)
      
      if (requestId === lastFetchId.current) {
        setParameters((pData as VotingParameter[]) || [])
        setJurisdictionRules(rData as JurisdictionRule[])
        setCompanyUsers(uData || [])
        setJRulesTableMissing(false)
        console.log(`[VotingTab] Consolidated load complete: ${pData.length} params, ${rData.length} rules, ${uData.length} users`)
      }
    } catch (err) {
      console.error("Critical error loading voting tab data:", err)
      if (requestId === lastFetchId.current) {
        setJRulesTableMissing(true)
      }
    } finally {
      if (requestId === lastFetchId.current) {
        setLoading(false)
        setJRulesLoading(false)
        setUserLoading(false)
      }
    }
  }

  // Keep these wrappers for manual refreshes if needed elsewhere
  const fetchParameters = loadTabData
  const fetchCompanyUsers = loadTabData
  const fetchJurisdictionRules = loadTabData

  const handleSaveRule = async () => {
    if (!editingRule) return
    setSavingRule(true)
    try {
      const saved = await saveJurisdictionRuleAction(editingRule) as JurisdictionRule
      if (editingRule.id) {
        setJurisdictionRules(prev => prev.map(r => r.id === editingRule.id ? saved : r))
        toast.success("Rule updated")
      } else {
        setJurisdictionRules(prev => [...prev, saved])
        toast.success("Rule created")
      }
      setRuleModalOpen(false)
      setEditingRule(null)
    } catch (err: any) {
      toast.error(err.message || "Failed to save rule")
    } finally {
      setSavingRule(false)
    }
  }

  const handleDeleteRule = async (id: number) => {
    if (!confirm("Delete this jurisdiction rule? This cannot be undone.")) return
    try {
      await deleteJurisdictionRuleAction(id)
      setJurisdictionRules(prev => prev.filter(r => r.id !== id))
      toast.success("Rule deleted")
    } catch (err: any) {
      toast.error(err.message || "Failed to delete rule")
    }
  }

  const handleAdd = async (type: ParameterType): Promise<boolean> => {
    if (!newValue.trim()) return false

    try {
      const { data } = await saveVotingParameterAction({
        company_id: selectedCompanyId,
        parameter_type: type,
        value: newValue,
        description: newDescription || null,
        weight: type === 'user_type' ? newWeight : 1.0,
        calculation_formula: type === 'voting_type' ? newCalculationFormula || null : null,
        linked_voting_type: type === 'meeting_type' ? newLinkedVotingType || null : null
      })

      setParameters([...parameters, data as VotingParameter])
      setNewValue("")
      setNewDescription("")
      setNewLinkedVotingType("")
      setNewCalculationFormula("")
      setIsAdding(null)
      toast.success("Parameter added")
      return true
    } catch (err: any) {
      toast.error(err.message || "Failed to add parameter")
      return false
    }
  }

  const handleUpdate = async (id: number): Promise<boolean> => {
    if (!editValue.trim()) return false

    const param = parameters.find(p => p.id === id)
    if (!param) return false

    const newValue = editValue.trim()
    const isMeetingTypeRename =
      param.parameter_type === 'meeting_type' && newValue !== param.value

    setSavingParam(true)
    try {
      const { data, meetingsUpdated, companiesUpdated } = await saveVotingParameterAction({
        id,
        value: newValue,
        description: editDescription || null,
        weight: editWeight,
        calculation_formula: param.parameter_type === 'voting_type' ? editCalculationFormula || null : null,
        parameter_type: param.parameter_type,
        linked_voting_type: param.parameter_type === 'meeting_type' ? editLinkedVotingType || null : null
      })

      setParameters(parameters.map(p => p.id === id ? (data as VotingParameter) : p))
      setEditingId(null)

      if (isMeetingTypeRename && (meetingsUpdated ?? 0) > 0) {
        const extras = (companiesUpdated ?? 0) > 0 ? ` and ${companiesUpdated} company default list(s)` : ''
        toast.success(`Meeting type renamed — updated ${meetingsUpdated} meeting(s)${extras}`)
      } else {
        toast.success("Parameter updated")
      }
      return true
    } catch (err: any) {
      toast.error(err.message || "Failed to update parameter")
      return false
    } finally {
      setSavingParam(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this parameter?")) return

    try {
      await deleteVotingParameterAction(id)
      setParameters(parameters.filter(p => p.id !== id))
      toast.success("Parameter deleted")
    } catch (err: any) {
      toast.error(err.message || "Failed to delete parameter")
    }
  }

  const handleUserWeightUpdate = async (userId: number, weight: number) => {
    try {
      const { error } = await supabase
        .from("users")
        .update({ voting_weight: weight })
        .eq("id", userId)

      if (error) {
        toast.error("Failed to update user weight")
        return
      }

      setCompanyUsers(prev => prev.map(u => u.id === userId ? { ...u, voting_weight: weight } : u))
      toast.success("User weight updated")
    } catch (err) {
      toast.error("An error occurred")
    }
  }

  const renderSection = (type: ParameterType, title: string, description: string) => {
    // Deduplicate: if a company-specific row and a global row share the same value,
    // show only the company-specific one (mirrors getVotingParameters merge logic).
    const raw = parameters.filter(p => p.parameter_type === type)
    const seen = new Map<string, VotingParameter>()
    // Global rows first (lower priority)
    raw.filter(p => p.company_id === null).forEach(p => seen.set(p.value.trim().toLowerCase(), p))
    // Company rows win
    raw.filter(p => p.company_id !== null).forEach(p => seen.set(p.value.trim().toLowerCase(), p))
    const sectionParams = Array.from(seen.values())
    
    return (
      <Card className="border-border shadow-sm hover:shadow-md transition-shadow duration-300 overflow-hidden rounded-2xl">
        <CardHeader className="bg-muted/30 border-b border-border pb-4">
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-lg font-bold">{title}</CardTitle>
              <CardDescription className="text-xs">{description}</CardDescription>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => {
                setIsAdding(type)
                setNewValue(type === 'user_type' ? "resident" : "")
                setNewDescription("")
                setNewWeight(1.0)
                setNewLinkedVotingType("")
                setNewCalculationFormula("")
                setEditingId(null)
                setFormulaMode('simple')
                setParamModalOpen(true)
              }}
              className="h-8 rounded-lg font-bold border-primary/20 text-primary hover:bg-primary/5"
            >
              <Plus className="h-4 w-4 mr-1" /> Add
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {sectionParams.length === 0 ? (
              <div className="p-10 text-center text-muted-foreground text-sm italic bg-muted/5">
                No custom settings defined.
              </div>
            ) : (
              sectionParams.map((param, index) => (
                <div key={`${param.parameter_type}-${param.id}-${index}`} className="p-4 flex items-center justify-between group hover:bg-muted/20 transition-colors">
                  <div className="flex-1 min-w-0 mr-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">{param.value}</span>

                      </div>
                      {param.description && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{param.description}</p>
                      )}
                      {param.parameter_type === 'user_type' && (
                        <div className="flex items-center gap-1 mt-1">
                          <span className="text-[10px] font-bold bg-muted px-2 py-0.5 rounded text-muted-foreground border border-border/50">
                            Weight: {param.weight ?? 1.0}
                          </span>
                        </div>
                      )}
                      {param.parameter_type === 'voting_type' && param.calculation_formula && (
                        <div className="flex items-center gap-1 mt-1">
                          <span className="text-[10px] font-bold bg-primary/10 px-2 py-0.5 rounded text-primary border border-primary/20">
                            Formula: {param.calculation_formula}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {(param.company_id === companyId || 
                      isMasterUser || 
                      isCorporateAdminUser) && (
                      <>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-full"
                          onClick={() => {
                            setEditingId(param.id)
                            setEditValue(param.value)
                            setEditDescription(param.description || "")
                            setEditWeight(param.weight ?? 1.0)
                            setEditLinkedVotingType(
                              ((param as any).linked_voting_type || "")
                                .split(',')
                                .map((s: string) => s.trim())
                                .filter(Boolean)
                                .join(',')
                            )
                            setEditCalculationFormula(param.calculation_formula || "")
                            // Auto-detect mode: simple if it's just a number, custom otherwise
                            const f = param.calculation_formula || ""
                            setFormulaMode(/^\d+(\.\d+)?$/.test(f.trim()) || f.trim() === "" ? 'simple' : 'custom')
                            setIsAdding(null)
                            setParamModalOpen(true)                          }}
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-muted-foreground hover:text-red-600 hover:bg-red-50 rounded-full"
                          onClick={() => handleDelete(param.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-gradient-to-r from-decision-purple to-primary p-6 sm:p-8 rounded-2xl sm:rounded-3xl text-white shadow-xl flex flex-col md:flex-row justify-between items-stretch md:items-center gap-6">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-3 mb-2">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Voting & Meeting Rules</h2>
            {isMasterUser && (
              <div className="bg-white/10 px-3 py-1 rounded-full border border-white/20 flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest opacity-70">Master View</span>
                <select 
                  className="bg-transparent border-none text-xs font-bold focus:ring-0 cursor-pointer text-white"
                  value={selectedCompanyId || ""}
                  onChange={(e) => setSelectedCompanyId(e.target.value ? parseInt(e.target.value) : null)}
                >
                  <option value="" className="text-black">Global Defaults</option>
                  {companies.map(c => (
                    <option key={c.id} value={c.id} className="text-black">{c.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <p className="opacity-90 text-sm sm:text-base md:text-lg">
            {selectedCompanyId 
              ? `Customizing parameters for ${companies.find(c => c.id === selectedCompanyId)?.name || 'Selected Company'}`
              : "Configure global defaults and user voting power across the system."
            }
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
          <Button 
            variant="outline"
            onClick={() => setShowHelp(!showHelp)}
            className="bg-white/10 border-white/20 text-white hover:bg-white/20 font-bold px-4 sm:px-6 h-11 sm:h-14 rounded-xl sm:rounded-2xl text-xs sm:text-sm md:text-base flex-1 sm:flex-none justify-center"
          >
            <BookOpen className="h-4 sm:h-5 w-4 sm:w-5 mr-2 flex-shrink-0" /> {showHelp ? 'Hide Help' : 'Help & Formulas'}
          </Button>
          <Button 
            onClick={() => setShowUserModal(true)}
            className="bg-white text-primary hover:bg-white/90 font-bold px-5 sm:px-8 h-11 sm:h-14 rounded-xl sm:rounded-2xl shadow-lg transition-transform hover:scale-105 text-xs sm:text-sm md:text-base flex-1 sm:flex-none justify-center"
          >
            🎯 Individual Weights
          </Button>
        </div>
      </div>

      {showHelp && (
        <Card className="border-primary/20 bg-primary/5 rounded-3xl overflow-hidden animate-in slide-in-from-top-4 duration-300">
          <CardHeader className="pb-2">
            <CardTitle className="text-xl flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              Voting & Formula Documentation
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 text-sm">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <h4 className="font-bold text-primary uppercase tracking-wider text-xs">Threshold Calculation</h4>
                <p>The system uses two modes for calculating if a motion passes:</p>
                <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
                  <li><strong>Simple (0-100%):</strong> Specify a percentage. The system checks if <code>(Votes For / Total Cast) &gt; %</code>.</li>
                  <li><strong>Custom Formula:</strong> Use a full mathematical expression for complex legal requirements.</li>
                </ul>
                
                <h4 className="font-bold text-primary uppercase tracking-wider text-xs mt-6">Denominator Sources</h4>
                <p>Determined by Jurisdiction Rules:</p>
                <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
                  <li><strong>Active:</strong> Denominator is <code>For + Against</code>. Abstentions are ignored.</li>
                  <li><strong>Eligible:</strong> Denominator is the total possible weight of all registered attendees. Abstentions count as "No".</li>
                </ul>
              </div>

              <div className="space-y-4">
                <h4 className="font-bold text-primary uppercase tracking-wider text-xs">Variable Reference</h4>
                <div className="grid grid-cols-2 gap-2 bg-card p-4 rounded-xl border border-border/50">
                  <div className="font-mono text-indigo-600">for_weight</div>
                  <div className="text-xs text-muted-foreground">Total weight of 'For' votes</div>
                  <div className="font-mono text-indigo-600">against_weight</div>
                  <div className="text-xs text-muted-foreground">Total weight of 'Against' votes</div>
                  <div className="font-mono text-indigo-600">eligible_weight</div>
                  <div className="text-xs text-muted-foreground">Total weight of all eligible voters</div>
                  <div className="font-mono text-indigo-600">cast_weight</div>
                  <div className="text-xs text-muted-foreground">for_weight + against_weight</div>
                </div>

                <h4 className="font-bold text-primary uppercase tracking-wider text-xs mt-6">Example Formulas</h4>
                <div className="space-y-2">
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <p className="font-mono text-xs text-indigo-600">for_weight &gt; (cast_weight * 0.5)</p>
                    <p className="text-[10px] text-muted-foreground mt-1">Simple Majority (over 50% of votes cast)</p>
                  </div>
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <p className="font-mono text-xs text-indigo-600">for_weight &gt;= (eligible_weight * 0.75)</p>
                    <p className="text-[10px] text-muted-foreground mt-1">Super Majority (75% of ALL eligible owners)</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-800">
                <strong>Important:</strong> Custom formulas override standard threshold percentage logic. If a formula is present, the percentage slider will be disabled. Ensure your formula evaluates to a boolean (true/false).
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-48 bg-muted animate-pulse rounded-3xl"></div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pb-12">
          {renderSection('meeting_type', '📋 Meeting Types', 'Define the types of meetings (e.g., AGM, Board Meeting).')}
          {renderSection('voting_type', '⚖️ Voting Types', 'Define voting thresholds and resolution types (e.g., Majority, 75%).')}
          {renderSection('building_type', '🏢 Organization Types', 'Classify the legal entity or building structure.')}
          {renderSection('decision_result', '✅ Decision Results', 'Define common outcomes for motions (e.g., M/S/C, Defeated).')}
        </div>
      )}

      {/* ── Jurisdiction & Compliance Rules Panel ── */}
      <div className="mt-2">
        <Card className="border-border shadow-sm rounded-2xl overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-indigo-600/10 via-purple-600/8 to-blue-600/10 border-b border-border pb-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-xl bg-indigo-600/15 border border-indigo-500/30 flex items-center justify-center shrink-0">
                  <Globe2 className="h-5 w-5 text-indigo-500" />
                </div>
                <div>
                  <CardTitle className="text-lg font-bold">🌏 Jurisdiction &amp; Compliance Rules</CardTitle>
                  <CardDescription className="text-xs mt-1 max-w-lg">
                    Location-specific legislative rules that automatically set the correct denominator, abstention treatment, and
                    reconsideration hold for each vote type. Apply the migration SQL first if this panel shows empty.
                  </CardDescription>
                </div>
              </div>
              {(isMasterUser || isCorporateAdminUser) && (
                <Button
                  size="sm"
                  onClick={() => {
                    setEditingRule({
                      province_code: 'BC',
                      building_type: 'Strata Corporation',
                      voting_type: '',
                      threshold_percent: 50,
                      abstention_treatment: 'exclude',
                      denominator_source: 'active',
                      reconsideration_trigger: false,
                      reconsideration_threshold_percent: null,
                      reconsideration_hold_days: 0,
                      description: '',
                    })
                    setRuleModalOpen(true)
                  }}
                  className="h-9 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-4 shrink-0"
                >
                  <Plus className="h-4 w-4 mr-1" /> Add Rule
                </Button>
              )}
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {jRulesLoading ? (
              <div className="p-8 flex items-center justify-center">
                <div className="h-6 w-6 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
              </div>
            ) : jRulesTableMissing ? (
              <div className="p-8 flex flex-col items-center gap-3 text-center">
                <div className="h-12 w-12 rounded-2xl bg-amber-500/10 border border-amber-400/30 flex items-center justify-center">
                  <AlertTriangle className="h-6 w-6 text-amber-500" />
                </div>
                <div>
                  <p className="font-semibold text-sm">Migration Not Applied</p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                    Run the SQL in <code className="bg-muted px-1 rounded font-mono">supabase/migrations/20260522_create_jurisdiction_rules.sql</code> in your Supabase Dashboard to enable this panel.
                  </p>
                </div>
              </div>
            ) : jurisdictionRules.length === 0 ? (
              <div className="p-10 text-center text-muted-foreground text-sm italic">
                No jurisdiction rules defined yet. Click “Add Rule” to create one.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-4 py-3">Location</th>
                      <th className="text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-4 py-3">Building Type</th>
                      <th className="text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-4 py-3">Voting Type</th>
                      <th className="text-center text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-4 py-3">Threshold</th>
                      <th className="text-center text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-4 py-3">Abstentions</th>
                      <th className="text-center text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-4 py-3">Denominator</th>
                      <th className="text-center text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-4 py-3">Hold?</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {jurisdictionRules.map((rule) => (
                      <tr key={rule.id} className="hover:bg-muted/20 transition-colors group">
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1.5 font-bold text-xs bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 px-2.5 py-1 rounded-lg border border-indigo-500/20">
                            {rule.province_code}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground max-w-[160px] truncate">{rule.building_type}</td>
                        <td className="px-4 py-3 text-xs font-medium max-w-[180px] truncate">{rule.voting_type}</td>
                        <td className="px-4 py-3 text-center">
                          <span className="font-black text-sm text-foreground">{rule.threshold_percent}%</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                            rule.abstention_treatment === 'against'
                              ? 'bg-red-500/10 text-red-600 border border-red-500/20'
                              : 'bg-green-500/10 text-green-600 border border-green-500/20'
                          }`}>
                            {rule.abstention_treatment === 'against' ? 'Counts Against' : 'Excluded'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                            rule.denominator_source === 'eligible'
                              ? 'bg-purple-500/10 text-purple-600 border border-purple-500/20'
                              : 'bg-blue-500/10 text-blue-600 border border-blue-500/20'
                          }`}>
                            {rule.denominator_source === 'eligible' ? 'All Eligible' : 'Votes Cast'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {rule.reconsideration_trigger ? (
                            <span className="text-[10px] font-bold text-amber-600 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-400/30">
                              {rule.reconsideration_hold_days}d Hold
                            </span>
                          ) : (
                            <span className="text-[10px] text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                            <Button
                              variant="ghost" size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded-lg"
                              onClick={() => { setEditingRule({ ...rule }); setRuleModalOpen(true) }}
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost" size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg"
                              onClick={() => handleDeleteRule(rule.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Rule Edit / Create Modal ── */}
      <Dialog open={ruleModalOpen} onOpenChange={setRuleModalOpen}>
        <DialogContent className="max-w-lg bg-background border-border rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="space-y-2">
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Globe2 className="h-5 w-5 text-indigo-500" />
              {editingRule?.id ? 'Edit Jurisdiction Rule' : 'New Jurisdiction Rule'}
            </DialogTitle>
            <DialogDescription className="text-sm">
              Configure how votes are counted for this location, building type, and vote type combination.
            </DialogDescription>
          </DialogHeader>

          {editingRule && (
            <div className="grid grid-cols-2 gap-4 py-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Location Code</Label>
                <Input
                  placeholder="e.g. BC, ON, WA"
                  className="h-10 rounded-xl bg-muted/20 font-mono"
                  value={editingRule.province_code || ''}
                  onChange={e => setEditingRule(r => r ? { ...r, province_code: e.target.value.toUpperCase() } : r)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Threshold %</Label>
                <Input
                  type="number" min="0" max="100" step="0.01"
                  className="h-10 rounded-xl bg-muted/20 font-bold"
                  value={editingRule.threshold_percent ?? 50}
                  onChange={e => setEditingRule(r => r ? { ...r, threshold_percent: parseFloat(e.target.value) } : r)}
                />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Building Type</Label>
                <Input
                  placeholder="e.g. Strata Corporation"
                  className="h-10 rounded-xl bg-muted/20"
                  value={editingRule.building_type || ''}
                  onChange={e => setEditingRule(r => r ? { ...r, building_type: e.target.value } : r)}
                />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Voting Type (must match exactly)</Label>
                <Input
                  placeholder="e.g. Three-Quarter Vote (75%)"
                  className="h-10 rounded-xl bg-muted/20"
                  value={editingRule.voting_type || ''}
                  onChange={e => setEditingRule(r => r ? { ...r, voting_type: e.target.value } : r)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Abstention Treatment</Label>
                <select
                  className="w-full h-10 px-3 bg-muted/20 border border-input rounded-xl text-sm outline-none"
                  value={editingRule.abstention_treatment || 'exclude'}
                  onChange={e => setEditingRule(r => r ? { ...r, abstention_treatment: e.target.value as any } : r)}
                >
                  <option value="exclude">Excluded from denominator</option>
                  <option value="against">Counts as Against</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Denominator Source</Label>
                <select
                  className="w-full h-10 px-3 bg-muted/20 border border-input rounded-xl text-sm outline-none"
                  value={editingRule.denominator_source || 'active'}
                  onChange={e => setEditingRule(r => r ? { ...r, denominator_source: e.target.value as any } : r)}
                >
                  <option value="active">Votes Cast (FOR + AGAINST)</option>
                  <option value="eligible">All Eligible (headcount/weight)</option>
                </select>
              </div>
              <div className="col-span-2 flex items-center gap-3 p-3 bg-amber-500/5 border border-amber-400/20 rounded-xl">
                <Checkbox
                  id="recon-trigger"
                  checked={editingRule.reconsideration_trigger ?? false}
                  onCheckedChange={v => setEditingRule(r => r ? { ...r, reconsideration_trigger: !!v } : r)}
                />
                <label htmlFor="recon-trigger" className="text-xs font-semibold cursor-pointer">
                  Enable reconsideration hold (e.g. BC 3/4 rule)
                </label>
              </div>
              {editingRule.reconsideration_trigger && (
                <>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Min Eligible % to Skip Hold</Label>
                    <Input
                      type="number" min="0" max="100"
                      className="h-10 rounded-xl bg-muted/20"
                      value={editingRule.reconsideration_threshold_percent ?? 50}
                      onChange={e => setEditingRule(r => r ? { ...r, reconsideration_threshold_percent: parseFloat(e.target.value) } : r)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Hold Days</Label>
                    <Input
                      type="number" min="1"
                      className="h-10 rounded-xl bg-muted/20"
                      value={editingRule.reconsideration_hold_days ?? 7}
                      onChange={e => setEditingRule(r => r ? { ...r, reconsideration_hold_days: parseInt(e.target.value) } : r)}
                    />
                  </div>
                </>
              )}
              <div className="space-y-1.5 col-span-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Description (shown in voting preview)</Label>
                <Input
                  placeholder="e.g. Strata Property Act: 3/4 vote excluding abstentions..."
                  className="h-10 rounded-xl bg-muted/20"
                  value={editingRule.description || ''}
                  onChange={e => setEditingRule(r => r ? { ...r, description: e.target.value } : r)}
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-3">
            <Button variant="ghost" className="h-10 rounded-xl px-5" onClick={() => { setRuleModalOpen(false); setEditingRule(null) }}>Cancel</Button>
            <Button
              className="h-10 rounded-xl px-6 bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
              onClick={handleSaveRule}
              disabled={savingRule}
            >
              {savingRule ? 'Saving…' : (editingRule?.id ? 'Save Changes' : 'Create Rule')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 🚀 Modal for Adding/Editing Parameters */}
      <Dialog open={paramModalOpen} onOpenChange={setParamModalOpen}>
        <DialogContent className="max-w-md bg-background border-border rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="space-y-3">
            <DialogTitle className="text-2xl font-bold">
              {editingId ? "Edit Configuration" : `New ${isAdding?.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}`}
            </DialogTitle>
            <DialogDescription className="text-sm">
              {editingId ? "Update the details for this configuration rule." : "Define a new rule for your organization's voting system."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-6">

            {/* 1. Primary Metadata (Name & Description) */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Value / Name</Label>
                {isAdding === 'user_type' || (editingId && parameters.find(p => p.id === editingId)?.parameter_type === 'user_type') ? (
                  <select
                    value={editingId ? editValue : (newValue || 'resident')}
                    onChange={(e) => editingId ? setEditValue(e.target.value) : setNewValue(e.target.value)}
                    className="w-full h-11 px-3 bg-muted/20 border border-input rounded-xl text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-shadow"
                  >
                    <option value="resident">Resident</option>
                    <option value="owner">Owner</option>
                    <option value="property_manager">Property Manager</option>
                    <option value="corporate_administrator">Corporate Administrator</option>
                    <option value="user">General User</option>
                    <option value="vendor">Vendor</option>
                  </select>
                ) : (() => {
                  const editingParam = editingId ? parameters.find(p => p.id === editingId) : null
                  const isEditingMeetingType = editingParam?.parameter_type === 'meeting_type'
                  const isRenamingMeetingType =
                    isEditingMeetingType &&
                    editingParam &&
                    editValue.trim() !== '' &&
                    editValue.trim() !== editingParam.value
                  return (
                    <div>
                      <Input
                        placeholder="e.g., AGM, Board Meeting"
                        className="h-11 rounded-xl bg-muted/20 border-border/50 focus:border-primary/50 transition-colors"
                        value={editingId ? editValue : newValue}
                        onChange={(e) => editingId ? setEditValue(e.target.value) : setNewValue(e.target.value)}
                      />
                      {isEditingMeetingType && (
                        <p className={`text-[10px] mt-1 ${isRenamingMeetingType ? 'text-amber-600 font-medium' : 'text-muted-foreground'}`}>
                          {isRenamingMeetingType
                            ? renameCountLoading
                              ? 'Checking impact...'
                              : renameMeetingCount != null && renameMeetingCount > 0
                                ? `⚠️ ${renameMeetingCount} existing meeting(s) will be updated.`
                                : 'Applying new name to configuration.'
                            : 'This name appears in meeting lists and reports.'}
                        </p>
                      )}
                    </div>
                  )
                })()}
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Description (Optional)</Label>
                <Input
                  placeholder="e.g., Annual general meeting for all owners"
                  className="h-11 rounded-xl bg-muted/20 border-border/50"
                  value={editingId ? editDescription : newDescription}
                  onChange={(e) => editingId ? setEditDescription(e.target.value) : setNewDescription(e.target.value)}
                />
              </div>
            </div>

            {/* 2. Linked Voting Types (Conditional) */}
            {(isAdding === 'meeting_type' || (editingId && parameters.find(p => p.id === editingId)?.parameter_type === 'meeting_type')) && (() => {
              const vtByName = new Map<string, VotingParameter>()
              parameters
                .filter(p => p.parameter_type === 'voting_type' && p.company_id === null)
                .forEach(p => vtByName.set(p.value.trim().toLowerCase(), p))
              parameters
                .filter(p => p.parameter_type === 'voting_type' && p.company_id !== null)
                .forEach(p => vtByName.set(p.value.trim().toLowerCase(), p))
              const votingTypeOptions = Array.from(vtByName.values())

              const currentValues = (editingId ? editLinkedVotingType : newLinkedVotingType)
                ?.split(',')
                .map((s: string) => s.trim().toLowerCase())
                .filter(Boolean) || []

              const toggleType = (canonicalName: string) => {
                const key = canonicalName.trim().toLowerCase()
                const currentCanonical = (editingId ? editLinkedVotingType : newLinkedVotingType)
                  ?.split(',').map((s: string) => s.trim()).filter(Boolean) || []
                let nextValues: string[]
                if (currentCanonical.map(s => s.toLowerCase()).includes(key)) {
                  nextValues = currentCanonical.filter(v => v.toLowerCase() !== key)
                } else {
                  nextValues = [...currentCanonical, canonicalName.trim()]
                }
                const joined = nextValues.join(',')
                if (editingId) setEditLinkedVotingType(joined)
                else setNewLinkedVotingType(joined)
              }

              return votingTypeOptions.length > 0 ? (
                <div className="space-y-3 p-5 bg-primary/5 border border-primary/15 rounded-2xl">
                  <div>
                    <Label className="text-[11px] font-black uppercase tracking-widest text-primary flex items-center gap-2">
                      <Shield className="h-3 w-3" /> Enabled Voting Rules
                    </Label>
                    <p className="text-[10px] text-muted-foreground mt-1">Restrict which voting types can be used for this meeting.</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-3">
                    {votingTypeOptions.map((vt, idx) => (
                      <div 
                        key={`vt-opt-${vt.id}-${idx}`} 
                        className={`flex items-center space-x-2 p-2.5 rounded-xl border transition-all duration-200 cursor-pointer ${
                          currentValues.includes(vt.value.trim().toLowerCase())
                            ? 'bg-background border-primary/40 shadow-sm ring-1 ring-primary/10' 
                            : 'bg-background/40 border-border/50 hover:border-primary/20'
                        }`}
                        onClick={() => toggleType(vt.value)}
                      >
                        <Checkbox 
                          id={`vt-${vt.id}-${idx}`} 
                          checked={currentValues.includes(vt.value.trim().toLowerCase())}
                          onCheckedChange={() => {}} // onClick handles this
                          className="rounded-md border-muted-foreground/30 data-[state=checked]:bg-primary"
                        />
                        <label 
                          htmlFor={`vt-${vt.id}-${idx}`}
                          className="text-[11px] font-bold leading-tight cursor-pointer flex-1 truncate"
                        >
                          {vt.value}
                        </label>
                      </div>
                    ))}
                  </div>
                  {currentValues.length === 0 && (
                    <div className="flex items-center gap-2 p-2 bg-amber-500/10 rounded-lg mt-1 border border-amber-500/20">
                      <AlertTriangle className="h-3 w-3 text-amber-600" />
                      <p className="text-[10px] text-amber-700 font-semibold italic">Show all voting types by default.</p>
                    </div>
                  )}
                </div>
              ) : null
            })()}

            {(isAdding === 'user_type' || (editingId && parameters.find(p => p.id === editingId)?.parameter_type === 'user_type')) && (
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Voting Weight (Multiplier)</Label>
                <div className="flex items-center gap-3">
                  <Input
                    type="number"
                    step="0.1"
                    className="flex-1 h-11 rounded-xl bg-muted/20 font-bold"
                    value={editingId ? editWeight : newWeight}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value)
                      if (editingId) setEditWeight(val)
                      else setNewWeight(val)
                    }}
                  />
                </div>
              </div>
            )}

            {(isAdding === 'voting_type' || (editingId && parameters.find(p => p.id === editingId)?.parameter_type === 'voting_type')) && (() => {
              const formula = editingId ? editCalculationFormula : newCalculationFormula
              const setFormula = (val: string) => editingId ? setEditCalculationFormula(val) : setNewCalculationFormula(val)

              // Parse simple % value from formula string
              const simplePercent = /^\d+(\.\d+)?$/.test(formula.trim())
                ? parseFloat(formula.trim())
                : 50

              // Validate custom expression
              const VALID_TOKENS = ['PERCENTAGE','WEIGHT_PERCENTAGE','FOR','AGAINST','ABSTAIN','ACTIVE','TOTAL','WEIGHT_FOR','WEIGHT_AGAINST','WEIGHT_ACTIVE']
              const isValidExpression = (expr: string): boolean => {
                if (!expr.trim()) return true
                if (/^\d+(\.\d+)?$/.test(expr.trim())) return true
                // Replace all valid tokens with a number placeholder, then check if it's a valid comparison
                let sanitized = expr.trim()
                VALID_TOKENS.forEach(t => { sanitized = sanitized.replace(new RegExp(t, 'g'), '1') })
                // Should look like: 1 >= 1, 1 > 1, etc.
                return /^[\d\s\+\-\*\/\.\(\)>=<!&|]+$/.test(sanitized)
              }

              const isCustomValid = isValidExpression(formula)

              // Plain-English preview for simple mode
              const previewText = (pct: number) => {
                if (pct === 50) return `Passes when FOR votes exceed 50% of active votes (simple majority)`
                if (pct === 100) return `Requires unanimous support — all active votes must be FOR`
                if (pct > 66 && pct < 68) return `Passes when FOR votes reach a two-thirds (≈67%) majority`
                if (pct === 75) return `Passes when FOR votes reach a three-quarter (75%) majority`
                return `Passes when FOR votes reach ${pct}% of active votes`
              }

              const TOKENS = [
                { label: 'PERCENTAGE', desc: '% of active votes' },
                { label: 'WEIGHT_%', insert: 'WEIGHT_PERCENTAGE', desc: 'weighted %' },
                { label: 'FOR', desc: 'votes for' },
                { label: 'AGAINST', desc: 'votes against' },
                { label: 'ABSTAIN', desc: 'abstentions' },
                { label: 'ACTIVE', desc: 'total active' },
                { label: 'TOTAL', desc: 'all voters' },
                { label: 'W_FOR', insert: 'WEIGHT_FOR', desc: 'weighted for' },
                { label: 'W_AGAINST', insert: 'WEIGHT_AGAINST', desc: 'weighted against' },
                { label: 'W_ACTIVE', insert: 'WEIGHT_ACTIVE', desc: 'weighted active' },
              ]

              return (
                <div className="space-y-3">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Calculation Formula / Passing Threshold
                  </Label>

                  {/* Mode toggle */}
                  <div className="flex rounded-xl overflow-hidden border border-border bg-muted/20 p-0.5 gap-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        setFormulaMode('simple')
                        // When switching to simple, reset to a clean number
                        if (!/^\d+(\.\d+)?$/.test(formula.trim())) setFormula('50')
                      }}
                      className={`flex-1 text-xs font-semibold py-2 rounded-lg transition-all ${
                        formulaMode === 'simple'
                          ? 'bg-background shadow text-foreground'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Simple %
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormulaMode('custom')}
                      className={`flex-1 text-xs font-semibold py-2 rounded-lg transition-all ${
                        formulaMode === 'custom'
                          ? 'bg-background shadow text-foreground'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Custom Expression
                    </button>
                  </div>

                  {formulaMode === 'simple' ? (
                    <div className="space-y-3 p-4 bg-muted/20 rounded-xl border border-border">
                      {/* Number + slider row */}
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <input
                            type="number"
                            min={1}
                            max={100}
                            step={1}
                            value={simplePercent}
                            onChange={e => {
                              const v = Math.min(100, Math.max(1, parseFloat(e.target.value) || 1))
                              setFormula(String(v))
                            }}
                            className="w-20 h-10 text-center font-black text-lg bg-background border border-border rounded-xl outline-none focus:ring-2 focus:ring-primary/30 pr-1"
                          />
                          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground pointer-events-none">%</span>
                        </div>
                        <input
                          type="range"
                          min={1}
                          max={100}
                          step={1}
                          value={simplePercent}
                          onChange={e => setFormula(String(e.target.value))}
                          className="flex-1 accent-primary h-2 cursor-pointer"
                        />
                      </div>
                      {/* Quick presets */}
                      <div className="flex gap-1.5 flex-wrap">
                        {[50, 67, 75, 100].map(pct => (
                          <button
                            key={pct}
                            type="button"
                            onClick={() => setFormula(String(pct))}
                            className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border transition-all ${
                              simplePercent === pct
                                ? 'bg-primary text-white border-primary shadow-sm'
                                : 'bg-background border-border text-muted-foreground hover:border-primary/40 hover:text-foreground'
                            }`}
                          >
                            {pct === 50 ? '50% Majority' : pct === 67 ? '67% Super' : pct === 75 ? '75% Three-Quarter' : '100% Unanimous'}
                          </button>
                        ))}
                      </div>
                      {/* Preview */}
                      <div className="flex items-start gap-2 p-2.5 bg-primary/5 border border-primary/20 rounded-lg">
                        <span className="text-primary text-sm mt-0.5">✓</span>
                        <p className="text-[11px] text-muted-foreground leading-relaxed">{previewText(simplePercent)}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* ── HOW IT WORKS banner ── */}
                      <div className="p-3 bg-indigo-500/8 border border-indigo-500/20 rounded-xl space-y-2">
                        <p className="text-[11px] font-bold text-indigo-600 uppercase tracking-wider flex items-center gap-1.5">
                          <span>💡</span> How Custom Expressions Work
                        </p>
                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                          Write a condition using the variables below. When a vote is cast, the system replaces each variable with the real vote counts, then checks if the condition is <strong className="text-foreground">true</strong> (= motion passes) or <strong className="text-foreground">false</strong> (= motion fails).
                        </p>
                        <div className="flex items-center gap-2 text-[11px] font-mono bg-background rounded-lg px-3 py-2 border border-border">
                          <span className="text-blue-500 font-bold">PERCENTAGE</span>
                          <span className="text-muted-foreground">&gt;=</span>
                          <span className="text-green-600 font-bold">75</span>
                          <span className="text-muted-foreground mx-1">→</span>
                          <span className="text-[10px] text-muted-foreground">replaces with actual % →</span>
                          <span className="text-orange-500 font-bold">82.5</span>
                          <span className="text-muted-foreground">&gt;=</span>
                          <span className="text-green-600 font-bold">75</span>
                          <span className="text-muted-foreground mx-1">→</span>
                          <span className="text-green-600 font-bold text-[10px]">✓ PASSES</span>
                        </div>
                      </div>

                      {/* ── Variable reference ── */}
                      <div className="space-y-2">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Variables you can use:</p>
                        <div className="grid grid-cols-1 gap-1">
                          {[
                            { token: 'PERCENTAGE', color: 'text-blue-600', bg: 'bg-blue-500/8 border-blue-500/20', meaning: '% of active votes that are FOR  (e.g. 75 means 75%)' },
                            { token: 'WEIGHT_PERCENTAGE', color: 'text-purple-600', bg: 'bg-purple-500/8 border-purple-500/20', meaning: 'Weighted % — same as above but uses owner voting weights' },
                            { token: 'FOR', color: 'text-green-600', bg: 'bg-green-500/8 border-green-500/20', meaning: 'Number (or weight) of FOR votes' },
                            { token: 'AGAINST', color: 'text-red-600', bg: 'bg-red-500/8 border-red-500/20', meaning: 'Number (or weight) of AGAINST votes' },
                            { token: 'ABSTAIN', color: 'text-amber-600', bg: 'bg-amber-500/8 border-amber-500/20', meaning: 'Number (or weight) of ABSTAIN votes' },
                            { token: 'ACTIVE', color: 'text-slate-600', bg: 'bg-slate-500/8 border-slate-500/20', meaning: 'Total active votes = FOR + AGAINST (abstentions excluded)' },
                            { token: 'TOTAL', color: 'text-slate-600', bg: 'bg-slate-500/8 border-slate-500/20', meaning: 'Total voters present = FOR + AGAINST + ABSTAIN' },
                            { token: 'W_FOR', color: 'text-green-700', bg: 'bg-green-500/8 border-green-500/20', meaning: 'Total weighted FOR votes (owners with weight > 1)' },
                            { token: 'W_AGAINST', color: 'text-red-700', bg: 'bg-red-500/8 border-red-500/20', meaning: 'Total weighted AGAINST votes' },
                            { token: 'W_ACTIVE', color: 'text-slate-700', bg: 'bg-slate-500/8 border-slate-500/20', meaning: 'Total weighted active (W_FOR + W_AGAINST)' },
                          ].map(v => (
                            <div key={v.token} className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border ${v.bg} cursor-pointer hover:opacity-80 transition-opacity`}
                              onClick={() => {
                                const insert = v.token === 'W_FOR' ? 'WEIGHT_FOR' : v.token === 'W_AGAINST' ? 'WEIGHT_AGAINST' : v.token === 'W_ACTIVE' ? 'WEIGHT_ACTIVE' : v.token
                                setFormula(formula ? `${formula} ${insert}` : insert)
                              }}
                              title="Click to insert"
                            >
                              <span className={`font-mono font-bold text-[11px] min-w-[130px] ${v.color}`}>{v.token}</span>
                              <span className="text-[10px] text-muted-foreground leading-tight">{v.meaning}</span>
                            </div>
                          ))}
                        </div>
                        <p className="text-[10px] text-muted-foreground italic">↑ Click any variable to insert it into your expression</p>
                      </div>

                      {/* ── Expression input ── */}
                      <div className="space-y-2">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Your expression:</p>
                        <div className="relative">
                          <input
                            type="text"
                            spellCheck={false}
                            value={formula}
                            onChange={e => setFormula(e.target.value)}
                            placeholder="e.g.  PERCENTAGE >= 75   or   FOR > AGAINST"
                            className={`w-full h-11 px-3 font-mono text-sm bg-background border rounded-xl outline-none focus:ring-2 transition-all ${
                              formula && !isCustomValid
                                ? 'border-red-400 focus:ring-red-400/30 text-red-600'
                                : formula && isCustomValid
                                ? 'border-green-400 focus:ring-green-400/30'
                                : 'border-border focus:ring-primary/30'
                            }`}
                          />
                          {formula && (
                            <span className={`absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold ${isCustomValid ? 'text-green-500' : 'text-red-500'}`}>
                              {isCustomValid ? '✓ Valid' : '✗ Invalid'}
                            </span>
                          )}
                        </div>

                        {/* Operator shortcuts */}
                        <div className="flex flex-wrap gap-1.5">
                          {(['>=', '>', '<=', '<', '&&', '||'] as const).map(op => (
                            <button
                              key={op}
                              type="button"
                              onClick={() => setFormula(formula ? `${formula} ${op} ` : `${op} `)}
                              className="text-[11px] font-mono font-bold px-2.5 py-1 rounded-lg bg-background border border-dashed border-border hover:border-primary/50 hover:bg-primary/5 hover:text-primary transition-all text-muted-foreground"
                              title={op === '>=' ? 'Greater than or equal to' : op === '>' ? 'Greater than' : op === '<=' ? 'Less than or equal to' : op === '<' ? 'Less than' : op === '&&' ? 'AND (both conditions must be true)' : 'OR (either condition is true)'}
                            >
                              {op}
                            </button>
                          ))}
                          <button type="button" onClick={() => setFormula('')} className="text-[11px] px-2.5 py-1 rounded-lg border border-dashed border-red-300 text-red-400 hover:bg-red-50 hover:text-red-600 transition-all">✕ Clear</button>
                        </div>

                        {formula && !isCustomValid && (
                          <p className="text-[11px] text-red-500 font-medium">✗ Unknown token detected. Only use the variables listed above, numbers, and operators.</p>
                        )}
                      </div>

                      {/* ── Live plain-English preview ── */}
                      {formula && isCustomValid && (() => {
                        const f = formula.trim()
                        let preview = ''
                        if (/^[\d.]+$/.test(f)) {
                          preview = `Motion passes when FOR votes reach ${f}% of active votes (votes cast, abstentions excluded).`
                        } else if (/WEIGHT_PERCENTAGE\s*>=\s*([\d.]+)/.test(f)) {
                          const m = f.match(/WEIGHT_PERCENTAGE\s*>=\s*([\d.]+)/)
                          preview = `Motion passes when weighted FOR votes reach ${m?.[1]}% or more of weighted active votes (owner weight applied).`
                        } else if (/PERCENTAGE\s*>=\s*([\d.]+)/.test(f)) {
                          const m = f.match(/PERCENTAGE\s*>=\s*([\d.]+)/)
                          preview = `Motion passes when FOR votes reach ${m?.[1]}% or more of active votes cast.`
                        } else if (/PERCENTAGE\s*>\s*([\d.]+)/.test(f)) {
                          const m = f.match(/PERCENTAGE\s*>\s*([\d.]+)/)
                          preview = `Motion passes when FOR votes exceed ${m?.[1]}% of active votes cast (strictly greater).`
                        } else if (/^FOR\s*>\s*AGAINST$/.test(f)) {
                          preview = `Motion passes when there are more FOR votes than AGAINST votes (simple majority by count).`
                        } else if (/^FOR\s*>=\s*AGAINST$/.test(f)) {
                          preview = `Motion passes when FOR votes are equal to or greater than AGAINST votes.`
                        } else if (f.includes('&&')) {
                          preview = `Motion passes only when ALL conditions in this expression are true simultaneously.`
                        } else if (f.includes('||')) {
                          preview = `Motion passes when ANY one of the conditions in this expression is true.`
                        } else {
                          preview = `Custom expression — the motion passes when this condition evaluates to true.`
                        }
                        return (
                          <div className="flex items-start gap-2 p-3 bg-green-500/8 border border-green-500/20 rounded-xl">
                            <span className="text-green-600 text-sm mt-0.5 shrink-0">✓</span>
                            <div>
                              <p className="text-[10px] font-bold text-green-600 uppercase tracking-wider mb-0.5">Plain-English Preview</p>
                              <p className="text-[11px] text-muted-foreground leading-relaxed">{preview}</p>
                            </div>
                          </div>
                        )
                      })()}

                      {/* ── Recipe examples ── */}
                      <div className="space-y-2">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">📋 Click a recipe to use it:</p>
                        <div className="grid gap-1.5">
                          {[
                            { label: 'Simple Majority (50%)', formula: 'PERCENTAGE >= 50', desc: 'More than half of votes cast are FOR' },
                            { label: '¾ Three-Quarter Vote', formula: 'PERCENTAGE >= 75', desc: '75% of votes cast must be FOR' },
                            { label: 'Unanimous (100%)', formula: 'PERCENTAGE >= 100', desc: 'Every single active vote must be FOR' },
                            { label: 'More FOR than AGAINST', formula: 'FOR > AGAINST', desc: 'Simplest form of majority — any lead wins' },
                            { label: 'Weighted 75% Majority', formula: 'WEIGHT_PERCENTAGE >= 75', desc: 'Uses owner voting weights instead of headcount' },
                            { label: 'Weighted + Headcount (AGM)', formula: 'WEIGHT_PERCENTAGE >= 50 && PERCENTAGE >= 50', desc: 'Must pass BOTH by weight AND by headcount' },
                          ].map(r => (
                            <button
                              key={r.formula}
                              type="button"
                              onClick={() => setFormula(r.formula)}
                              className={`text-left px-3 py-2.5 rounded-xl border transition-all ${formula === r.formula ? 'bg-primary/10 border-primary/40 ring-1 ring-primary/20' : 'bg-background border-border hover:border-primary/30 hover:bg-primary/5'}`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-[11px] font-bold text-foreground">{r.label}</span>
                                {formula === r.formula && <span className="text-[10px] text-primary font-bold">● Selected</span>}
                              </div>
                              <span className="font-mono text-[10px] text-indigo-600">{r.formula}</span>
                              <p className="text-[10px] text-muted-foreground mt-0.5">{r.desc}</p>
                            </button>
                          ))}
                        </div>
                      </div>

                      {!formula && (
                        <p className="text-[10px] text-muted-foreground italic">Leave blank for no threshold, or pick a recipe above to get started.</p>
                      )}
                    </div>
                  )}
                </div>
              )
            })()}
          </div>

          <DialogFooter className="gap-3 pt-4">
            <Button variant="ghost" className="h-11 rounded-xl px-6" onClick={() => setParamModalOpen(false)}>Cancel</Button>
            <Button 
              className="bg-primary text-white font-bold h-11 rounded-xl px-8 shadow-lg shadow-primary/20"
              disabled={savingParam}
              onClick={async () => {
                if (editingId) {
                  const param = parameters.find((p) => p.id === editingId)
                  const trimmed = editValue.trim()
                  const isRename =
                    param?.parameter_type === "meeting_type" &&
                    trimmed &&
                    trimmed !== param.value
                  if (isRename) {
                    setRenameConfirmOpen(true)
                    return
                  }
                  const ok = await handleUpdate(editingId)
                  if (ok) setParamModalOpen(false)
                } else if (isAdding) {
                  const ok = await handleAdd(isAdding)
                  if (ok) setParamModalOpen(false)
                }
              }}
            >
              {savingParam ? "Saving…" : editingId ? "Save Changes" : "Create Parameter"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={renameConfirmOpen} onOpenChange={setRenameConfirmOpen}>
        <AlertDialogContent className="z-[200]">
          <AlertDialogHeader>
            <AlertDialogTitle>Rename meeting type?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                {(() => {
                  const param = editingId ? parameters.find((p) => p.id === editingId) : null
                  if (!param) return null
                  const trimmed = editValue.trim()
                  return (
                    <>
                      <p>
                        <strong className="text-foreground">{param.value}</strong>
                        {" → "}
                        <strong className="text-foreground">{trimmed}</strong>
                      </p>
                      {renameMeetingCount != null && renameMeetingCount > 0 ? (
                        <p>
                          This will update <strong className="text-foreground">{renameMeetingCount}</strong> existing
                          meeting(s) so they stay in sync with the new name.
                        </p>
                      ) : (
                        <p>No existing meetings use the current name. Only the configuration label will change.</p>
                      )}
                    </>
                  )
                })()}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={savingParam}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={savingParam}
              className="bg-primary text-white"
              onClick={async (e) => {
                e.preventDefault()
                if (!editingId) return
                const ok = await handleUpdate(editingId)
                if (ok) {
                  setRenameConfirmOpen(false)
                  setParamModalOpen(false)
                }
              }}
            >
              {savingParam ? "Saving…" : "Rename & sync meetings"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 🎯 Individual User Overrides Pop-up */}
      <UserWeightsModal 
        isOpen={showUserModal}
        onClose={() => setShowUserModal(false)}
        users={companyUsers}
        loading={userLoading}
        onUpdateWeight={handleUserWeightUpdate}
      />
    </div>
  )
}
