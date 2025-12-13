"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { supabase, getCurrentUser } from "@/lib/supabase"

interface DecisionModalProps {
  topicId: number
  onClose: () => void
  onSave?: () => void
}

export default function DecisionModal({ topicId, onClose, onSave }: DecisionModalProps) {
  const [formData, setFormData] = useState({
    motionText: "",
    result: "",
    votesFor: 0,
    votesAgainst: 0,
    votesAbstain: 0,  // ← NEW: Abstain field
  })
  const [decisionResultOptions, setDecisionResultOptions] = useState<string[]>([
    "M/S/C",
    "Defeated", 
    "Deferred"
  ])  // ← NEW: Company-specific options
  const [fileName, setFileName] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ← NEW: Fetch company's decision result options
  useEffect(() => {
    async function fetchCompanyDecisionOptions() {
      try {
        // Get the topic to find the meeting
        const { data: topic } = await supabase
          .from('topics')
          .select('meeting_id')
          .eq('id', topicId)
          .single()

        if (!topic) return

        // Get the meeting to find the building
        const { data: meeting } = await supabase
          .from('meetings')
          .select('building_id')
          .eq('id', topic.meeting_id)
          .single()

        if (!meeting) return

        // Get the building to find the company
        const { data: building } = await supabase
          .from('buildings')
          .select('company_id')
          .eq('id', meeting.building_id)
          .single()

        if (!building?.company_id) return

        // Get the company's decision result options
        const { data: company } = await supabase
          .from('companies')
          .select('default_decision_results')
          .eq('id', building.company_id)
          .single()

        if (company?.default_decision_results && company.default_decision_results.length > 0) {
          setDecisionResultOptions(company.default_decision_results)
          setFormData(prev => ({ ...prev, result: company.default_decision_results[0] }))
        } else {
          // Fallback to defaults
          setFormData(prev => ({ ...prev, result: "M/S/C" }))
        }
      } catch (err) {
        console.error('Error fetching company decision options:', err)
        setFormData(prev => ({ ...prev, result: "M/S/C" }))
      }
    }

    fetchCompanyDecisionOptions()
  }, [topicId])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: name === "votesFor" || name === "votesAgainst" || name === "votesAbstain" 
        ? parseInt(value) || 0 
        : value,
    }))
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setFileName(e.target.files[0].name)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    console.log('DEBUG - topicId:', topicId, 'Type:', typeof topicId)
    
    if (!formData.motionText.trim()) {
      setError("Motion/Resolution text is required")
      return
    }

    setSaving(true)
    setError(null)

    try {
      const currentUser = getCurrentUser()

      const insertData = {
        topic_id: topicId,
        motion_text: formData.motionText.trim(),
        result: formData.result,
        votes_for: formData.votesFor,
        votes_against: formData.votesAgainst,
        votes_abstain: formData.votesAbstain // ← NEW
        //recorded_by: currentUser.id
      }

      console.log('Inserting decision with data:', insertData)

      const { data, error: insertError } = await supabase
        .from('decisions')
        .insert(insertData)
        .select()

      if (insertError) {
        console.error('Full error object:', JSON.stringify(insertError, null, 2))
        setError(`Failed to save decision: ${insertError.message}`)
        setSaving(false)
        return
      }

      console.log('✅ Decision saved successfully:', data)

      if (onSave) {
        onSave()
      }

      onClose()
    } catch (err) {
      console.error('Unexpected error:', err)
      setError('An unexpected error occurred')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 animate-in fade-in">
      <Card className="w-full sm:max-w-md border-0 rounded-t-2xl sm:rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between border-b border-border bg-gradient-to-r from-decision-purple/10 to-decision-purple/5 p-6">
          <h2 className="text-xl font-bold text-foreground">Record Decision</h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded hover:bg-muted transition-colors"
            disabled={saving}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Motion/Resolution *</label>
            <textarea
              name="motionText"
              value={formData.motionText}
              onChange={handleInputChange}
              placeholder="Enter the motion or resolution text..."
              required
              disabled={saving}
              className="w-full px-3 py-2 bg-background text-foreground rounded border border-border focus:outline-none focus:ring-2 focus:ring-decision-purple/50 resize-none min-h-24 disabled:opacity-50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Result *</label>
            <select
              name="result"
              value={formData.result}
              onChange={handleInputChange}
              disabled={saving}
              required
              className="w-full px-3 py-2 bg-background text-foreground rounded border border-border focus:outline-none focus:ring-2 focus:ring-decision-purple/50 disabled:opacity-50"
            >
              {decisionResultOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          {/* ← NEW: 3-column grid with Abstain */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Votes For</label>
              <input
                type="number"
                name="votesFor"
                value={formData.votesFor}
                onChange={handleInputChange}
                min="0"
                disabled={saving}
                className="w-full px-3 py-2 bg-background text-foreground rounded border border-border focus:outline-none focus:ring-2 focus:ring-decision-purple/50 disabled:opacity-50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Votes Against</label>
              <input
                type="number"
                name="votesAgainst"
                value={formData.votesAgainst}
                onChange={handleInputChange}
                min="0"
                disabled={saving}
                className="w-full px-3 py-2 bg-background text-foreground rounded border border-border focus:outline-none focus:ring-2 focus:ring-decision-purple/50 disabled:opacity-50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Abstain</label>
              <input
                type="number"
                name="votesAbstain"
                value={formData.votesAbstain}
                onChange={handleInputChange}
                min="0"
                disabled={saving}
                className="w-full px-3 py-2 bg-background text-foreground rounded border border-border focus:outline-none focus:ring-2 focus:ring-decision-purple/50 disabled:opacity-50"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={onClose} 
              className="flex-1 bg-transparent"
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-decision-purple text-white hover:bg-decision-purple/90"
              disabled={saving || !formData.motionText.trim()}
            >
              {saving ? "Saving..." : "Save Decision"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
