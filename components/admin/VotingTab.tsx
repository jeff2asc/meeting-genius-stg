"use client"

import { useState, useEffect } from "react"
import { supabase, getCurrentUser, getVotingParameters } from "@/lib/supabase"
import { apiClient } from "@/lib/api-client"
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

export default function VotingTab() {
  const [parameters, setParameters] = useState<VotingParameter[]>([])
  const [loading, setLoading] = useState(true)
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

  useEffect(() => {
    fetchParameters()
    fetchCompanyUsers()
    fetchJurisdictionRules()
  }, [])

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

  const fetchCompanyUsers = async () => {
    if (!companyId) return
    setUserLoading(true)
    try {
      const { data, error } = await supabase
        .from("users")
        .select("id, name, user_type, voting_weight")
        .eq("company_id", companyId)
        .order("name")
      
      if (error) throw error
      setCompanyUsers(data || [])
    } catch (err) {
      console.error("Error fetching company users:", err)
    } finally {
      setUserLoading(false)
    }
  }

  const fetchParameters = async () => {
    setLoading(true)
    try {
      const data = await getVotingParameters(companyId)
      setParameters((data as VotingParameter[]) || [])
    } catch (err) {
      console.error("Unexpected error fetching parameters:", err)
    } finally {
      setLoading(false)
    }
  }

  const fetchJurisdictionRules = async () => {
    setJRulesLoading(true)
    try {
      const data = await apiClient.v1.jurisdictionRules.list()
      setJurisdictionRules(data as JurisdictionRule[])
      setJRulesTableMissing(false)
    } catch (err: any) {
      // Gracefully handle the table-not-found case before migration is applied
      setJurisdictionRules([])
      setJRulesTableMissing(true)
    } finally {
      setJRulesLoading(false)
    }
  }

  const handleSaveRule = async () => {
    if (!editingRule) return
    setSavingRule(true)
    try {
      if (editingRule.id) {
        const { id, ...updates } = editingRule
        const updated = await apiClient.v1.jurisdictionRules.update(id, updates)
        setJurisdictionRules(prev => prev.map(r => r.id === id ? updated : r))
        toast.success("Rule updated")
      } else {
        const created = await apiClient.v1.jurisdictionRules.create(editingRule)
        setJurisdictionRules(prev => [...prev, created])
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
      await apiClient.v1.jurisdictionRules.delete(id)
      setJurisdictionRules(prev => prev.filter(r => r.id !== id))
      toast.success("Rule deleted")
    } catch (err: any) {
      toast.error(err.message || "Failed to delete rule")
    }
  }

  const handleAdd = async (type: ParameterType): Promise<boolean> => {
    if (!newValue.trim()) return false

    try {
      const data = await apiClient.v1.votingParameters.insert({
        company_id: companyId,
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
      const { data, meetingsUpdated, companiesUpdated } = await apiClient.v1.votingParameters.update({
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
      await apiClient.v1.votingParameters.delete(id)
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
    const sectionParams = parameters.filter(p => p.parameter_type === type)
    
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
              sectionParams.map(param => (
                <div key={param.id} className="p-4 flex items-center justify-between group hover:bg-muted/20 transition-colors">
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
                            setIsAdding(null)
                            setParamModalOpen(true)
                          }}
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
      <div className="bg-gradient-to-r from-decision-purple to-primary p-8 rounded-3xl text-white shadow-xl flex flex-col md:flex-row justify-between items-center gap-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Voting & Meeting Rules</h2>
          <p className="opacity-90 mt-2 text-lg">Configure how your organization handles decisions and user voting power.</p>
        </div>
        <Button 
          onClick={() => setShowUserModal(true)}
          className="bg-white text-primary hover:bg-white/90 font-bold px-8 h-14 rounded-2xl shadow-lg transition-transform hover:scale-105"
        >
          🎯 Manage Individual Weights
        </Button>
      </div>

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
                    Province-specific legislative rules that automatically set the correct denominator, abstention treatment, and
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
                      <th className="text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-4 py-3">Province</th>
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
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
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
        <DialogContent className="max-w-lg bg-background border-border rounded-2xl shadow-2xl">
          <DialogHeader className="space-y-2">
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Globe2 className="h-5 w-5 text-indigo-500" />
              {editingRule?.id ? 'Edit Jurisdiction Rule' : 'New Jurisdiction Rule'}
            </DialogTitle>
            <DialogDescription className="text-sm">
              Configure how votes are counted for this province, building type, and vote type combination.
            </DialogDescription>
          </DialogHeader>

          {editingRule && (
            <div className="grid grid-cols-2 gap-4 py-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Province Code</Label>
                <Input
                  placeholder="e.g. BC, ON"
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
        <DialogContent className="max-w-md bg-background border-border rounded-2xl shadow-2xl">
          <DialogHeader className="space-y-3">
            <DialogTitle className="text-2xl font-bold">
              {editingId ? "Edit Configuration" : `New ${isAdding?.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}`}
            </DialogTitle>
            <DialogDescription className="text-sm">
              {editingId ? "Update the details for this configuration rule." : "Define a new rule for your organization's voting system."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-6">

            {/* Available Voting Type — only shown for meeting_type parameters */}
            {(isAdding === 'meeting_type' || (editingId && parameters.find(p => p.id === editingId)?.parameter_type === 'meeting_type')) && (() => {
              // Build the same deduplicated list the decision modal uses:
              // company-specific row wins over global for the same name.
              const vtByName = new Map<string, VotingParameter>()
              parameters
                .filter(p => p.parameter_type === 'voting_type' && p.company_id === null)
                .forEach(p => vtByName.set(p.value.trim().toLowerCase(), p))
              parameters
                .filter(p => p.parameter_type === 'voting_type' && p.company_id !== null)
                .forEach(p => vtByName.set(p.value.trim().toLowerCase(), p))
              const votingTypeOptions = Array.from(vtByName.values())

              // currentValues: lowercase list of what's currently checked
              const currentValues = (editingId ? editLinkedVotingType : newLinkedVotingType)
                ?.split(',')
                .map((s: string) => s.trim().toLowerCase())
                .filter(Boolean) || []

              const toggleType = (canonicalName: string) => {
                const key = canonicalName.trim().toLowerCase()
                // Rebuild from canonical names to keep stored values clean
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
                <div className="space-y-3 p-4 bg-primary/5 border border-primary/20 rounded-xl">
                  <div>
                    <Label className="text-xs font-bold uppercase tracking-wider text-primary">⚖️ Available Voting Types</Label>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Select which voting types will be available during this meeting type.</p>
                  </div>
                  <div className="grid grid-cols-1 gap-2 mt-2">
                    {votingTypeOptions.map(vt => (
                      <div key={vt.id} className="flex items-center space-x-2 bg-background/50 p-2 rounded-lg border border-border/50 hover:border-primary/30 transition-colors">
                        <Checkbox 
                          id={`vt-${vt.id}`} 
                          checked={currentValues.includes(vt.value.trim().toLowerCase())}
                          onCheckedChange={() => toggleType(vt.value)}
                        />
                        <label 
                          htmlFor={`vt-${vt.id}`}
                          className="text-sm font-medium leading-none cursor-pointer flex-1"
                        >
                          {vt.value}
                        </label>
                      </div>
                    ))}
                  </div>
                  {currentValues.length === 0 && (
                    <p className="text-[10px] text-amber-600 font-medium">⚠️ No types selected. All types will be shown by default.</p>
                  )}
                </div>
              ) : (
                <div className="p-3 bg-muted/20 rounded-xl text-xs text-muted-foreground italic">
                  Create some Voting Types first to link them here.
                </div>
              )
            })()}

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
                      placeholder="e.g., Majority Vote"
                      className="h-11 rounded-xl bg-muted/20"
                      value={editingId ? editValue : newValue}
                      onChange={(e) => editingId ? setEditValue(e.target.value) : setNewValue(e.target.value)}
                    />
                    {isEditingMeetingType && (
                      <p className={`text-[10px] mt-1 ${isRenamingMeetingType ? 'text-amber-600' : 'text-muted-foreground'}`}>
                        {isRenamingMeetingType
                          ? renameCountLoading
                            ? 'Checking how many meetings use this type…'
                            : renameMeetingCount != null && renameMeetingCount > 0
                              ? `${renameMeetingCount} meeting(s) use "${editingParam?.value}". Click Save Changes to rename them too.`
                              : 'Click Save Changes to apply the new name.'
                          : 'Meeting type name shown in dropdowns and on meeting records.'}
                      </p>
                    )}
                  </div>
                )
              })()}

            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Description (Optional)</Label>
              <Input
                placeholder="Brief explanation..."
                className="h-11 rounded-xl bg-muted/20"
                value={editingId ? editDescription : newDescription}
                onChange={(e) => editingId ? setEditDescription(e.target.value) : setNewDescription(e.target.value)}
              />
            </div>

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

            {(isAdding === 'voting_type' || (editingId && parameters.find(p => p.id === editingId)?.parameter_type === 'voting_type')) && (
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Calculation Formula / Passing Threshold</Label>
                <Input
                  type="text"
                  className="w-full h-11 rounded-xl bg-muted/20 font-mono text-sm"
                  value={editingId ? editCalculationFormula : newCalculationFormula}
                  onChange={(e) => {
                    const val = e.target.value
                    if (editingId) setEditCalculationFormula(val)
                    else setNewCalculationFormula(val)
                  }}
                  placeholder="e.g. 75, PERCENTAGE >= 75, WEIGHT_PERCENTAGE >= 75"
                />
                <p className="text-[10px] text-muted-foreground leading-normal mt-1">
                  Enter a simple percentage number (e.g. <strong>75</strong>) or a custom expression using:<br/>
                  <code className="bg-muted px-1 py-0.5 rounded font-mono">PERCENTAGE</code>, <code className="bg-muted px-1 py-0.5 rounded font-mono">WEIGHT_PERCENTAGE</code>, <code className="bg-muted px-1 py-0.5 rounded font-mono">FOR</code>, <code className="bg-muted px-1 py-0.5 rounded font-mono">AGAINST</code>, <code className="bg-muted px-1 py-0.5 rounded font-mono">ABSTAIN</code>, <code className="bg-muted px-1 py-0.5 rounded font-mono">ACTIVE</code>, <code className="bg-muted px-1 py-0.5 rounded font-mono">TOTAL</code>, <code className="bg-muted px-1 py-0.5 rounded font-mono">WEIGHT_FOR</code>, <code className="bg-muted px-1 py-0.5 rounded font-mono">WEIGHT_AGAINST</code>, <code className="bg-muted px-1 py-0.5 rounded font-mono">WEIGHT_ACTIVE</code>.
                </p>
              </div>
            )}
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
