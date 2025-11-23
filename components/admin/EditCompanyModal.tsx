"use client"

import { useState, useEffect } from "react"
import { X, Plus, Trash2, Edit2, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { supabase } from "@/lib/supabase"

interface Company {
  id: number
  name: string
  created_at: string
  default_meeting_sections?: string[]
  default_meeting_types?: string[]
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
  const [meetingTypes, setMeetingTypes] = useState<string[]>([])
  const [editingSectionIdx, setEditingSectionIdx] = useState<number | null>(null)
  const [editingTypeIdx, setEditingTypeIdx] = useState<number | null>(null)
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

          {/* Default Meeting Sections */}
          <div>
            <label className="block text-sm font-semibold text-foreground mb-3">
              Default Meeting Sections
            </label>
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {meetingSections.map((section, idx) =>
                editingSectionIdx === idx ? (
                  <div key={idx} className="flex items-center gap-2 p-3 bg-primary/5 border border-primary/20 rounded-lg">
                    <input
                      type="text"
                      value={editingValue}
                      onChange={e => setEditingValue(e.target.value)}
                      className="flex-1 px-3 py-2 bg-background text-foreground rounded-md border border-border focus:outline-none focus:ring-2 focus:ring-primary/50"
                      autoFocus
                    />
                    <Button 
                      variant="default" 
                      size="sm" 
                      onClick={handleSaveSectionEdit} 
                      type="button"
                      className="bg-primary hover:bg-primary/90"
                    >
                      <Save className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div key={idx} className="flex items-center justify-between gap-3 p-3 bg-muted/50 hover:bg-muted rounded-lg border border-border/50 transition-colors group">
                    <span className="flex-1 text-sm font-medium">{section}</span>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        title="Edit" 
                        type="button" 
                        onClick={() => handleEditSection(idx)}
                        className="h-8 w-8 p-0 hover:bg-primary/10 hover:text-primary"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        title="Delete" 
                        type="button" 
                        onClick={() => handleDeleteSection(idx)}
                        className="h-8 w-8 p-0 hover:bg-red-100 hover:text-red-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                )
              )}
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              type="button" 
              onClick={handleAddSection}
              className="w-full mt-3 border-dashed hover:bg-primary/5 hover:border-primary/50 hover:text-primary"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Section
            </Button>
          </div>

          {/* Default Meeting Types */}
          <div>
            <label className="block text-sm font-semibold text-foreground mb-3">
              Default Meeting Types
            </label>
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {meetingTypes.map((type, idx) =>
                editingTypeIdx === idx ? (
                  <div key={idx} className="flex items-center gap-2 p-3 bg-primary/5 border border-primary/20 rounded-lg">
                    <input
                      type="text"
                      value={editingValue}
                      onChange={e => setEditingValue(e.target.value)}
                      className="flex-1 px-3 py-2 bg-background text-foreground rounded-md border border-border focus:outline-none focus:ring-2 focus:ring-primary/50"
                      autoFocus
                    />
                    <Button 
                      variant="default" 
                      size="sm" 
                      onClick={handleSaveTypeEdit} 
                      type="button"
                      className="bg-primary hover:bg-primary/90"
                    >
                      <Save className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div key={idx} className="flex items-center justify-between gap-3 p-3 bg-muted/50 hover:bg-muted rounded-lg border border-border/50 transition-colors group">
                    <span className="flex-1 text-sm font-medium">{type}</span>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        title="Edit" 
                        type="button" 
                        onClick={() => handleEditType(idx)}
                        className="h-8 w-8 p-0 hover:bg-primary/10 hover:text-primary"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        title="Delete" 
                        type="button" 
                        onClick={() => handleDeleteType(idx)}
                        className="h-8 w-8 p-0 hover:bg-red-100 hover:text-red-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                )
              )}
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              type="button" 
              onClick={handleAddType}
              className="w-full mt-3 border-dashed hover:bg-primary/5 hover:border-primary/50 hover:text-primary"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Type
            </Button>
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