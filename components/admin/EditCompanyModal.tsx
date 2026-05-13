"use client"

import { useState, useEffect } from "react"
import { X, Plus, Trash2, Edit2, Save, Loader2, Globe } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { supabase, Company, createAdminClient } from "@/lib/supabase"
import { triggerJanusResync } from "@/lib/janus"
import { toast } from "sonner"

interface VotingParameter {
  id: number
  company_id: number | null
  parameter_type: string
  value: string
  description: string | null
  is_default: boolean
}

interface EditCompanyModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  company: Company | null
}

export default function EditCompanyModal({
  isOpen,
  onClose,
  onSuccess,
  company
}: EditCompanyModalProps) {
  const [companyName, setCompanyName] = useState("")
  const [meetingSections, setMeetingSections] = useState<string[]>([])

  // Meeting types — sourced from voting_parameters
  const [meetingTypeParams, setMeetingTypeParams] = useState<VotingParameter[]>([])
  const [votingTypeOptions, setVotingTypeOptions] = useState<VotingParameter[]>([])
  const [loadingTypes, setLoadingTypes] = useState(false)

  // Decision results — still stored on the company record
  const [decisionResults, setDecisionResults] = useState<string[]>([])

  const [editingSectionIdx, setEditingSectionIdx] = useState<number | null>(null)
  const [editingResultIdx, setEditingResultIdx] = useState<number | null>(null)
  const [editingValue, setEditingValue] = useState("")

  // Inline add/edit state for meeting types (voting_parameters)
  const [editingTypeId, setEditingTypeId] = useState<number | null>(null)
  const [editingTypeValue, setEditingTypeValue] = useState("")
  const [editingTypeLinkedVotingType, setEditingTypeLinkedVotingType] = useState("")
  const [addingNewType, setAddingNewType] = useState(false)
  const [newTypeValue, setNewTypeValue] = useState("")
  const [newTypeLinkedVotingType, setNewTypeLinkedVotingType] = useState("")

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ─── Fetch voting_parameters meeting types for this company ─────────────────
  const fetchMeetingTypes = async (companyId: number) => {
    setLoadingTypes(true)
    try {
      const adminClient = createAdminClient()
      const { data, error } = await adminClient
        .from("voting_parameters")
        .select("*")
        .or(`company_id.eq.${companyId},company_id.is.null`)
        .order("is_default", { ascending: false })
        .order("value")

      if (error) throw error
      const allParams = (data as VotingParameter[]) || []
      setMeetingTypeParams(allParams.filter(p => p.parameter_type === 'meeting_type'))
      setVotingTypeOptions(allParams.filter(p => p.parameter_type === 'voting_type'))
    } catch (err) {
      console.error("Error fetching meeting types:", err)
    } finally {
      setLoadingTypes(false)
    }
  }

  useEffect(() => {
    if (company) {
      setCompanyName(company.name)
      setMeetingSections(company.default_meeting_sections || [
        "Call to Order",
        "Approval of Agenda",
        "Old Business / Business Arising",
        "New Business",
        "Financial Report",
        "Maintenance & Operations",
        "Correspondence",
        "Council Roundtable",
        "Adjournment"
      ])
      setDecisionResults(company.default_decision_results || [
        "M/S/C",
        "Defeated",
        "Deferred",
      ])
      fetchMeetingTypes(company.id)
    }
  }, [company])

  // ─── Meeting Sections ────────────────────────────────────────────────────────
  const handleAddSection = () => setMeetingSections([...meetingSections, "New Section"])
  const handleDeleteSection = (idx: number) => setMeetingSections(meetingSections.filter((_, i) => i !== idx))
  const handleEditSection = (idx: number) => {
    setEditingSectionIdx(idx)
    setEditingValue(meetingSections[idx])
  }
  const handleSaveSectionEdit = () => {
    if (editingSectionIdx !== null) {
      const updated = [...meetingSections]
      updated[editingSectionIdx] = editingValue
      setMeetingSections(updated)
      setEditingSectionIdx(null)
      setEditingValue("")
    }
  }

  // ─── Meeting Types — write directly to voting_parameters ────────────────────
  const handleAddMeetingType = async () => {
    if (!newTypeValue.trim() || !company) return
    try {
      const adminClient = createAdminClient()
      const { data, error } = await adminClient
        .from("voting_parameters")
        .insert({
          company_id: company.id,
          parameter_type: "meeting_type",
          value: newTypeValue.trim(),
          linked_voting_type: newTypeLinkedVotingType || null,
          is_default: false,
          weight: 1.0,
        })
        .select()
        .single()

      if (error) throw error
      setMeetingTypeParams(prev => [...prev, data as VotingParameter])
      setNewTypeValue("")
      setNewTypeLinkedVotingType("")
      setAddingNewType(false)
      toast.success("Meeting type added")
    } catch (err) {
      toast.error("Failed to add meeting type")
    }
  }

  const handleUpdateMeetingType = async (id: number) => {
    if (!editingTypeValue.trim()) return
    try {
      const adminClient = createAdminClient()
      const { error } = await adminClient
        .from("voting_parameters")
        .update({
          value: editingTypeValue.trim(),
          linked_voting_type: editingTypeLinkedVotingType || null,
        })
        .eq("id", id)

      if (error) throw error
      setMeetingTypeParams(prev =>
        prev.map(p => p.id === id
          ? { ...p, value: editingTypeValue.trim(), linked_voting_type: editingTypeLinkedVotingType || null } as any
          : p
        )
      )
      setEditingTypeId(null)
      setEditingTypeValue("")
      setEditingTypeLinkedVotingType("")
      toast.success("Meeting type updated")
    } catch (err) {
      toast.error("Failed to update meeting type")
    }
  }

  const handleDeleteMeetingType = async (id: number) => {
    const param = meetingTypeParams.find(p => p.id === id)
    if (param?.is_default || param?.company_id === null) {
      toast.error("Cannot delete a global default — edit it in Admin → Voting instead.")
      return
    }
    if (!confirm("Delete this meeting type?")) return
    try {
      const adminClient = createAdminClient()
      const { error } = await adminClient
        .from("voting_parameters")
        .delete()
        .eq("id", id)

      if (error) throw error
      setMeetingTypeParams(prev => prev.filter(p => p.id !== id))
      toast.success("Meeting type deleted")
    } catch (err) {
      toast.error("Failed to delete meeting type")
    }
  }

  // ─── Decision Results ────────────────────────────────────────────────────────
  const handleAddResult = () => setDecisionResults([...decisionResults, "New Result"])
  const handleDeleteResult = (idx: number) => setDecisionResults(decisionResults.filter((_, i) => i !== idx))
  const handleEditResult = (idx: number) => {
    setEditingResultIdx(idx)
    setEditingValue(decisionResults[idx])
  }
  const handleSaveResultEdit = () => {
    if (editingResultIdx !== null) {
      const updated = [...decisionResults]
      updated[editingResultIdx] = editingValue
      setDecisionResults(updated)
      setEditingResultIdx(null)
      setEditingValue("")
    }
  }

  // ─── Save (only sections + decision results go to companies table) ───────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!companyName.trim()) {
      setError("Company name is required")
      return
    }
    if (!company) return

    setSaving(true)

    try {
      const { error: updateError } = await supabase
        .from('companies')
        .update({
          name: companyName.trim(),
          default_meeting_sections: meetingSections,
          default_decision_results: decisionResults,
          updated_at: new Date().toISOString()
        })
        .eq('id', company.id)

      if (updateError) {
        console.error('Error updating company:', updateError)
        setError('Failed to update company.')
        setSaving(false)
        return
      }

      console.log('✅ Company updated successfully')
      triggerJanusResync('company_updated', {
        id: company.id,
        name: companyName.trim(),
        default_meeting_sections: meetingSections,
        default_decision_results: decisionResults,
      }, 'company')

      onSuccess()
      onClose()
    } catch (err) {
      console.error('Unexpected error:', err)
      setError('An unexpected error occurred')
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen || !company) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-in fade-in overflow-y-auto p-4">
      <Card className="w-full max-w-2xl border-0 rounded-2xl shadow-2xl my-8">
        <div className="flex items-center justify-between border-b border-border bg-gradient-to-r from-primary/5 to-decision-purple/5 p-6">
          <div>
            <h2 className="text-xl font-bold text-foreground">Edit Company</h2>
            <p className="text-sm text-muted-foreground">
              Update company info &amp; meeting templates
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-muted/80 transition-colors"
            disabled={saving}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-8">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm font-medium flex items-start gap-2">
              <span className="text-red-500 text-lg">⚠</span>
              <span className="flex-1">{error}</span>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Company Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={companyName}
              onChange={e => setCompanyName(e.target.value)}
              placeholder="e.g., ABC Property Management"
              required
              disabled={saving}
              className="w-full px-4 py-2.5 bg-background text-foreground rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 disabled:opacity-50 transition-all"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Default Meeting Sections */}
            <div className="space-y-3">
              <label className="block text-sm font-semibold text-foreground flex items-center justify-between">
                Default Meeting Sections
                <Button
                  variant="ghost"
                  size="sm"
                  type="button"
                  onClick={handleAddSection}
                  className="h-6 px-2 text-[10px] uppercase tracking-wider font-bold hover:bg-primary/10"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Add
                </Button>
              </label>
              <div className="space-y-1.5 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                {meetingSections.map((section, idx) =>
                  editingSectionIdx === idx ? (
                    <div key={idx} className="flex items-center gap-2 p-1.5 bg-primary/5 border border-primary/20 rounded-lg">
                      <input
                        type="text"
                        value={editingValue}
                        onChange={e => setEditingValue(e.target.value)}
                        className="flex-1 px-2 py-1 bg-background text-sm rounded border border-border focus:ring-1 focus:ring-primary"
                        autoFocus
                      />
                      <Button variant="default" size="sm" onClick={handleSaveSectionEdit} type="button" className="h-7 w-7 p-0">
                        <Save className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <div key={idx} className="flex items-center justify-between gap-2 px-3 py-1.5 bg-muted/30 hover:bg-muted/60 rounded-md border border-border/40 group transition-all">
                      <span className="flex-1 text-xs font-medium truncate">{section}</span>
                      <div className="flex gap-0.5 opacity-0 group-hover:opacity-100">
                        <Button variant="ghost" size="sm" type="button" onClick={() => handleEditSection(idx)} className="h-6 w-6 p-0">
                          <Edit2 className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="sm" type="button" onClick={() => handleDeleteSection(idx)} className="h-6 w-6 p-0 text-red-500 hover:text-red-700">
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  )
                )}
              </div>
            </div>

            <div className="space-y-8">
              {/* Default Meeting Types — from voting_parameters */}
              <div className="space-y-3">
                <label className="block text-sm font-semibold text-foreground flex items-center justify-between">
                  Default Meeting Types
                  <span className="text-[9px] text-muted-foreground font-normal italic">Shared with Voting tab</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    type="button"
                    onClick={() => { setAddingNewType(true); setNewTypeValue("") }}
                    className="h-6 px-2 text-[10px] uppercase tracking-wider font-bold hover:bg-primary/10"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add
                  </Button>
                </label>

                {loadingTypes ? (
                  <div className="flex items-center justify-center py-4 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    <span className="text-xs">Loading...</span>
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-2 custom-scrollbar">
                    {meetingTypeParams.map((param) =>
                      editingTypeId === param.id ? (
                        <div key={param.id} className="flex flex-col gap-1.5 p-2 bg-primary/5 border border-primary/20 rounded-lg">
                          <input
                            type="text"
                            value={editingTypeValue}
                            onChange={e => setEditingTypeValue(e.target.value)}
                            className="w-full px-2 py-1 bg-background text-sm rounded border border-border focus:ring-1 focus:ring-primary"
                            autoFocus
                            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleUpdateMeetingType(param.id) } }}
                          />
                          {votingTypeOptions.length > 0 && (
                            <div className="space-y-1.5 p-2 bg-muted/20 rounded border border-border/50">
                              <label className="text-[9px] font-bold uppercase text-muted-foreground">Available Voting Types</label>
                              <div className="grid grid-cols-1 gap-1 max-h-[100px] overflow-y-auto pr-1">
                                {votingTypeOptions.map(vt => {
                                  const currentList = editingTypeLinkedVotingType?.split(',').filter(Boolean) || []
                                  const isChecked = currentList.includes(vt.value)
                                  const toggle = () => {
                                    const nextList = isChecked 
                                      ? currentList.filter(v => v !== vt.value)
                                      : [...currentList, vt.value]
                                    setEditingTypeLinkedVotingType(nextList.join(','))
                                  }
                                  return (
                                    <div key={vt.id} className="flex items-center gap-1.5">
                                      <Checkbox 
                                        id={`edit-vt-${vt.id}`}
                                        checked={isChecked}
                                        onCheckedChange={toggle}
                                        className="h-3 w-3"
                                      />
                                      <label htmlFor={`edit-vt-${vt.id}`} className="text-[10px] cursor-pointer truncate flex-1">{vt.value}</label>
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          )}
                          <div className="flex gap-1 justify-end">
                            <Button variant="default" size="sm" onClick={() => handleUpdateMeetingType(param.id)} type="button" className="h-6 px-2 text-[10px]">
                              <Save className="h-3 w-3 mr-1" /> Save
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => setEditingTypeId(null)} type="button" className="h-6 w-6 p-0">
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div key={param.id} className="flex items-center justify-between gap-2 px-3 py-1.5 bg-muted/30 hover:bg-muted/60 rounded-md border border-border/40 group transition-all">
                          <div className="flex flex-col flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="flex-1 text-xs font-medium truncate">{param.value}</span>
                              {(param.is_default || param.company_id === null) && (
                                <span className="text-[9px] bg-primary/10 text-primary px-1.5 py-0.5 rounded uppercase font-bold border border-primary/20 shrink-0">Default</span>
                              )}
                            </div>
                            {(param as any).linked_voting_type && (
                              <span className="text-[9px] text-muted-foreground mt-0.5">⚖️ {(param as any).linked_voting_type}</span>
                            )}
                          </div>
                          <div className="flex gap-0.5 opacity-0 group-hover:opacity-100">
                            <Button
                              variant="ghost" size="sm" type="button"
                              onClick={() => {
                                setEditingTypeId(param.id)
                                setEditingTypeValue(param.value)
                                setEditingTypeLinkedVotingType((param as any).linked_voting_type || "")
                              }}
                              className="h-6 w-6 p-0"
                              disabled={param.company_id === null && !param.is_default}
                              title={param.company_id === null ? "Edit in Admin → Voting tab" : "Edit"}
                            >
                              <Edit2 className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost" size="sm" type="button"
                              onClick={() => handleDeleteMeetingType(param.id)}
                              className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                              disabled={param.company_id === null}
                              title={param.company_id === null ? "Cannot delete global defaults" : "Delete"}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      )
                    )}

                    {/* Inline add row */}
                    {addingNewType && (
                      <div className="flex flex-col gap-1.5 p-2 bg-primary/5 border border-primary/20 rounded-lg">
                        <input
                          type="text"
                          value={newTypeValue}
                          onChange={e => setNewTypeValue(e.target.value)}
                          placeholder="e.g., Emergency Meeting"
                          className="w-full px-2 py-1 bg-background text-sm rounded border border-border focus:ring-1 focus:ring-primary"
                          autoFocus
                          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddMeetingType() } }}
                        />
                        {votingTypeOptions.length > 0 && (
                          <div className="space-y-1.5 p-2 bg-muted/20 rounded border border-border/50">
                            <label className="text-[9px] font-bold uppercase text-muted-foreground">Available Voting Types</label>
                            <div className="grid grid-cols-1 gap-1 max-h-[100px] overflow-y-auto pr-1">
                              {votingTypeOptions.map(vt => {
                                const currentList = newTypeLinkedVotingType?.split(',').filter(Boolean) || []
                                const isChecked = currentList.includes(vt.value)
                                const toggle = () => {
                                  const nextList = isChecked 
                                    ? currentList.filter(v => v !== vt.value)
                                    : [...currentList, vt.value]
                                  setNewTypeLinkedVotingType(nextList.join(','))
                                }
                                return (
                                  <div key={vt.id} className="flex items-center gap-1.5">
                                    <Checkbox 
                                      id={`new-vt-${vt.id}`}
                                      checked={isChecked}
                                      onCheckedChange={toggle}
                                      className="h-3 w-3"
                                    />
                                    <label htmlFor={`new-vt-${vt.id}`} className="text-[10px] cursor-pointer truncate flex-1">{vt.value}</label>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )}
                        <div className="flex gap-1 justify-end">
                          <Button variant="default" size="sm" onClick={handleAddMeetingType} type="button" className="h-6 px-2 text-[10px]">
                            <Save className="h-3 w-3 mr-1" /> Add
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setAddingNewType(false)} type="button" className="h-6 w-6 p-0">
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    )}

                    {meetingTypeParams.length === 0 && !addingNewType && (
                      <p className="text-xs text-muted-foreground italic text-center py-2">No meeting types defined yet.</p>
                    )}
                  </div>
                )}
              </div>

              {/* Decision Result Options */}
              <div className="space-y-3 pt-4 border-t border-border/50">
                <label className="block text-sm font-semibold text-foreground flex items-center justify-between">
                  Decision Results
                  <Button
                    variant="ghost"
                    size="sm"
                    type="button"
                    onClick={handleAddResult}
                    className="h-6 px-2 text-[10px] uppercase tracking-wider font-bold hover:bg-primary/10"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add
                  </Button>
                </label>
                <div className="flex flex-wrap gap-2">
                  {decisionResults.map((result, idx) =>
                    editingResultIdx === idx ? (
                      <div key={idx} className="flex items-center gap-2 p-1 bg-primary/5 border border-primary/20 rounded-lg">
                        <input
                          type="text"
                          value={editingValue}
                          onChange={e => setEditingValue(e.target.value)}
                          className="w-24 px-2 py-0.5 bg-background text-xs rounded border border-border focus:ring-1 focus:ring-primary"
                          autoFocus
                        />
                        <Button variant="default" size="sm" onClick={handleSaveResultEdit} type="button" className="h-6 w-6 p-0">
                          <Save className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <div key={idx} className="flex items-center gap-1.5 px-2.5 py-1 bg-primary/5 text-primary border border-primary/10 rounded-full group hover:bg-primary/10 transition-colors">
                        <span className="text-[11px] font-bold">{result}</span>
                        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button type="button" onClick={() => handleEditResult(idx)} className="hover:text-primary-foreground">
                            <Edit2 className="h-2.5 w-2.5" />
                          </button>
                          <button type="button" onClick={() => handleDeleteResult(idx)} className="hover:text-red-500">
                            <Trash2 className="h-2.5 w-2.5" />
                          </button>
                        </div>
                      </div>
                    )
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Save/Cancel buttons */}
          <div className="flex gap-3 pt-6 border-t border-border">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1 h-11"
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1 h-11 bg-gradient-to-r from-primary to-decision-purple text-primary-foreground hover:opacity-90 font-medium shadow-sm"
              disabled={saving}
            >
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
