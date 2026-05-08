"use client"

import { useState, useEffect } from "react"
import { X, Plus, Trash2, Edit2, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { supabase, Company } from "@/lib/supabase"
import { triggerJanusResync } from "@/lib/janus"


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
  const [meetingTypes, setMeetingTypes] = useState<string[]>([])
  const [decisionResults, setDecisionResults] = useState<string[]>([])  // ← NEW
  const [editingSectionIdx, setEditingSectionIdx] = useState<number | null>(null)
  const [editingTypeIdx, setEditingTypeIdx] = useState<number | null>(null)
  const [editingResultIdx, setEditingResultIdx] = useState<number | null>(null)  // ← NEW
  const [editingValue, setEditingValue] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
      setMeetingTypes(company.default_meeting_types || [
        "Council Meeting",
        "AGM",
        "SGM",
        "Special Meeting",
        "Emergency Meeting"
      ])
      // ← NEW: Decision Results
      setDecisionResults(company.default_decision_results || [
        "M/S/C",
        "Defeated",
        "Deferred",
        "AGM",
        "SGM"
      ])
    }
  }, [company])

  // Section editing
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

  // Meeting type editing
  const handleAddType = () => setMeetingTypes([...meetingTypes, "New Type"])
  const handleDeleteType = (idx: number) => setMeetingTypes(meetingTypes.filter((_, i) => i !== idx))
  const handleEditType = (idx: number) => {
    setEditingTypeIdx(idx)
    setEditingValue(meetingTypes[idx])
  }
  const handleSaveTypeEdit = () => {
    if (editingTypeIdx !== null) {
      const updated = [...meetingTypes]
      updated[editingTypeIdx] = editingValue
      setMeetingTypes(updated)
      setEditingTypeIdx(null)
      setEditingValue("")
    }
  }

  // ← NEW: Decision result editing
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
          default_meeting_types: meetingTypes,
          default_decision_results: decisionResults,  // ← NEW
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
      
      // 🔄 Notify Janus for real-time sync with actual data
      const companyData = {
        id: company.id,
        name: companyName.trim(),
        default_meeting_sections: meetingSections,
        default_meeting_types: meetingTypes,
        default_decision_results: decisionResults,
      }
      triggerJanusResync('company_updated', companyData, 'company')
      
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
              Update company info & meeting templates
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
              {/* Default Meeting Types */}
              <div className="space-y-3">
                <label className="block text-sm font-semibold text-foreground flex items-center justify-between">
                  Default Meeting Types
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    type="button" 
                    onClick={handleAddType}
                    className="h-6 px-2 text-[10px] uppercase tracking-wider font-bold hover:bg-primary/10"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add
                  </Button>
                </label>
                <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-2 custom-scrollbar">
                  {meetingTypes.map((type, idx) =>
                    editingTypeIdx === idx ? (
                      <div key={idx} className="flex items-center gap-2 p-1.5 bg-primary/5 border border-primary/20 rounded-lg">
                        <input
                          type="text"
                          value={editingValue}
                          onChange={e => setEditingValue(e.target.value)}
                          className="flex-1 px-2 py-1 bg-background text-sm rounded border border-border focus:ring-1 focus:ring-primary"
                          autoFocus
                        />
                        <Button variant="default" size="sm" onClick={handleSaveTypeEdit} type="button" className="h-7 w-7 p-0">
                          <Save className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <div key={idx} className="flex items-center justify-between gap-2 px-3 py-1.5 bg-muted/30 hover:bg-muted/60 rounded-md border border-border/40 group transition-all">
                        <span className="flex-1 text-xs font-medium truncate">{type}</span>
                        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100">
                          <Button variant="ghost" size="sm" type="button" onClick={() => handleEditType(idx)} className="h-6 w-6 p-0">
                            <Edit2 className="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="sm" type="button" onClick={() => handleDeleteType(idx)} className="h-6 w-6 p-0 text-red-500 hover:text-red-700">
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    )
                  )}
                </div>
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
