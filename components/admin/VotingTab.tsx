"use client"

import { useState, useEffect } from "react"
import { supabase, getCurrentUser, getVotingParameters, createAdminClient } from "@/lib/supabase"
import { apiClient } from "@/lib/api-client"
import UserWeightsModal from "./UserWeightsModal"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Plus, Trash2, Edit2, Check, X, RotateCcw } from "lucide-react"
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
  created_at: string
  updated_at: string
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
  const [companyUsers, setCompanyUsers] = useState<any[]>([])
  const [userLoading, setUserLoading] = useState(false)
  const [showUserModal, setShowUserModal] = useState(false)
  const [paramModalOpen, setParamModalOpen] = useState(false)

  const currentUser = getCurrentUser()
  const companyId = currentUser?.company_id

  useEffect(() => {
    fetchParameters()
    fetchCompanyUsers()
  }, [])

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

  const handleAdd = async (type: ParameterType) => {
    if (!newValue.trim()) return

    try {
      const data = await apiClient.v1.votingParameters.insert({
        company_id: companyId,
        parameter_type: type,
        value: newValue,
        description: newDescription || null,
        weight: type === 'user_type' ? newWeight : 1.0,
        linked_voting_type: type === 'meeting_type' ? newLinkedVotingType || null : null
      })

      setParameters([...parameters, data as VotingParameter])
      setNewValue("")
      setNewDescription("")
      setNewLinkedVotingType("")
      setIsAdding(null)
      toast.success("Parameter added")
    } catch (err: any) {
      toast.error(err.message || "Failed to add parameter")
    }
  }

  const handleUpdate = async (id: number) => {
    if (!editValue.trim()) return

    const param = parameters.find(p => p.id === id)
    if (!param) return

    try {
      // If editing a global default parameter, create a company-specific override instead of updating the global template.
      // For meeting_type: ALWAYS preserve the original value (name) so it stays in sync with meetings.meeting_type.
      // Use upsert so repeated saves don't fail on the UNIQUE (company_id, parameter_type, value) constraint.
      if (param.company_id === null && companyId) {
        const overrideValue = param.parameter_type === 'meeting_type' ? param.value : editValue

        const data = await apiClient.v1.votingParameters.upsert({
          company_id: companyId,
          parameter_type: param.parameter_type,
          value: overrideValue,
          description: editDescription || null,
          weight: editWeight,
          is_default: false,
          linked_voting_type: param.parameter_type === 'meeting_type' ? editLinkedVotingType || null : null
        })

        // Replace the global default in local state with the company override
        setParameters(parameters.map(p => p.id === id ? (data as VotingParameter) : p))
        setEditingId(null)
        toast.success("Configuration saved")
        return
      }

      // Normal update (either company specific parameter or global default updated by master admin)
      const data = await apiClient.v1.votingParameters.update({
        id,
        value: editValue,
        description: editDescription || null,
        weight: editWeight,
        parameter_type: param.parameter_type,
        linked_voting_type: param.parameter_type === 'meeting_type' ? editLinkedVotingType || null : null
      })

      setParameters(parameters.map(p => p.id === id ? (data as VotingParameter) : p))
      setEditingId(null)
      toast.success("Parameter updated")
    } catch (err: any) {
      toast.error(err.message || "Failed to update parameter")
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
      const adminClient = createAdminClient()
      const { error } = await adminClient
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
                        {param.company_id === null ? (
                          <span className="text-[9px] bg-primary/10 text-primary px-1.5 py-0.5 rounded uppercase font-bold border border-primary/20">Default</span>
                        ) : (
                          <span className="text-[9px] bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded uppercase font-bold border border-amber-200">Company ID: {param.company_id}</span>
                        )}
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
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {(param.company_id === companyId || 
                      (currentUser?.user_type as any) === 'master' || 
                      (currentUser?.roles as any)?.includes('master') ||
                      (currentUser?.user_type as any) === 'corporate_administrator' ||
                      (currentUser?.roles as any)?.includes('corporate_administrator') ||
                      (currentUser?.user_type as any) === 'corporate_admin' ||
                      (currentUser?.roles as any)?.includes('corporate_admin')) && (
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
                            setEditLinkedVotingType((param as any).linked_voting_type || "")
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
              const votingTypeOptions = parameters.filter(p => p.parameter_type === 'voting_type')
              const currentValues = (editingId ? editLinkedVotingType : newLinkedVotingType)?.split(',').filter(Boolean) || []
              
              const toggleType = (val: string) => {
                let nextValues
                if (currentValues.includes(val)) {
                  nextValues = currentValues.filter(v => v !== val)
                } else {
                  nextValues = [...currentValues, val]
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
                          checked={currentValues.includes(vt.value)}
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
                // For global default meeting types, lock the name so it stays in sync with meetings.meeting_type
                const editingParam = editingId ? parameters.find(p => p.id === editingId) : null
                const isLockedGlobalMeetingType = editingParam?.company_id === null && editingParam?.parameter_type === 'meeting_type'
                return (
                  <div>
                    <Input
                      placeholder="e.g., Majority Vote"
                      className={`h-11 rounded-xl bg-muted/20 ${isLockedGlobalMeetingType ? 'opacity-60 cursor-not-allowed' : ''}`}
                      value={editingId ? editValue : newValue}
                      onChange={(e) => editingId ? setEditValue(e.target.value) : setNewValue(e.target.value)}
                      disabled={isLockedGlobalMeetingType}
                    />
                    {isLockedGlobalMeetingType && (
                      <p className="text-[10px] text-amber-600 mt-1">⚠️ Name is locked — renaming would break sync with existing meetings.</p>
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
          </div>

          <DialogFooter className="gap-3 pt-4">
            <Button variant="ghost" className="h-11 rounded-xl px-6" onClick={() => setParamModalOpen(false)}>Cancel</Button>
            <Button 
              className="bg-primary text-white font-bold h-11 rounded-xl px-8 shadow-lg shadow-primary/20"
              onClick={() => {
                if (editingId) handleUpdate(editingId)
                else if (isAdding) handleAdd(isAdding)
                setParamModalOpen(false)
              }}
            >
              {editingId ? "Save Changes" : "Create Parameter"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
