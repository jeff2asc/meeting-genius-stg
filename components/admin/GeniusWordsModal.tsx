"use client"

import { useState, useEffect } from "react"
import { Plus, Edit2, Trash2, Save, X, Search, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/supabase"

interface GeniusWord {
  id: number
  shortcode: string
  description: string
  created_at: string
  user_id: number | null
}

interface GeniusWordsModalProps {
  targetUser: { id: number; name: string }
  onClose: () => void
}

export default function GeniusWordsModal({ targetUser, onClose }: GeniusWordsModalProps) {
  const [geniusWords, setGeniusWords] = useState<GeniusWord[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")

  // Inline form state
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [formData, setFormData] = useState({ shortcode: "", description: "" })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchGeniusWords()
  }, [targetUser.id])

  const fetchGeniusWords = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from("genius_words")
        .select("*")
        .eq("user_id", targetUser.id)
        .order("shortcode", { ascending: true })

      if (error) {
        console.error("Error fetching genius words:", error)
        alert("Failed to load GeniusWords: " + error.message)
        return
      }
      setGeniusWords(data || [])
    } catch (err) {
      console.error("Unexpected error:", err)
    } finally {
      setLoading(false)
    }
  }

  const openAdd = () => {
    setEditingId(null)
    setFormData({ shortcode: "", description: "" })
    setShowForm(true)
  }

  const openEdit = (word: GeniusWord) => {
    setEditingId(word.id)
    setFormData({ shortcode: word.shortcode, description: word.description })
    setShowForm(true)
  }

  const closeForm = () => {
    setShowForm(false)
    setEditingId(null)
    setFormData({ shortcode: "", description: "" })
  }

  const handleSave = async () => {
    const shortcode = formData.shortcode.trim()
    const description = formData.description.trim()

    if (!shortcode || !description) {
      alert("Shortcode and Description are required")
      return
    }
    if (!shortcode.startsWith("#")) {
      alert("Shortcode must start with #")
      return
    }
    if (shortcode.includes(" ")) {
      alert("Shortcode cannot contain spaces")
      return
    }

    setSaving(true)
    try {
      if (editingId) {
        const { error } = await supabase
          .from("genius_words")
          .update({ shortcode, description })
          .eq("id", editingId)

        if (error) {
          alert(error.code === "23505" ? "This shortcode already exists for this user" : "Failed to update: " + error.message)
          return
        }
      } else {
        const { error } = await supabase
          .from("genius_words")
          .insert({ user_id: targetUser.id, shortcode, description, created_by: targetUser.id })

        if (error) {
          alert(error.code === "23505" ? "This shortcode already exists for this user" : "Failed to create: " + error.message)
          return
        }
      }

      await fetchGeniusWords()
      closeForm()
    } catch (err) {
      console.error("Unexpected error:", err)
      alert("An unexpected error occurred")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: number, shortcode: string) => {
    if (!confirm(`Delete "${shortcode}"? This cannot be undone.`)) return

    try {
      const { error } = await supabase.from("genius_words").delete().eq("id", id)
      if (error) {
        alert("Failed to delete: " + error.message)
        return
      }
      await fetchGeniusWords()
    } catch (err) {
      console.error("Unexpected error:", err)
    }
  }

  const filtered = geniusWords.filter(
    (w) =>
      w.shortcode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      w.description.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Dialog */}
      <div className="relative z-10 w-full max-w-2xl mx-4 bg-background rounded-xl shadow-2xl border border-border flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border flex-shrink-0">
          <div>
            <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-600" />
              GeniusWords — {targetUser.name}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Managing shortcuts on behalf of this user
            </p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-3 px-6 py-3 border-b border-border flex-shrink-0">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search shortcode or description..."
              className="w-full pl-9 pr-3 py-2 bg-background text-foreground rounded border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <Button
            onClick={openAdd}
            size="sm"
            className="bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:opacity-90 flex-shrink-0"
          >
            <Plus className="h-4 w-4 mr-1" />
            Add New
          </Button>
        </div>

        {/* Inline add/edit form */}
        {showForm && (
          <div className="px-6 py-4 border-b border-border bg-muted/30 flex-shrink-0">
            <h4 className="text-sm font-semibold mb-3 text-foreground">
              {editingId ? "Edit GeniusWord" : "New GeniusWord"}
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  Shortcode <span className="text-red-500">*</span>{" "}
                  <span className="text-muted-foreground">(starts with #, no spaces)</span>
                </label>
                <input
                  type="text"
                  value={formData.shortcode}
                  onChange={(e) => setFormData({ ...formData, shortcode: e.target.value })}
                  placeholder="#QuoteReq"
                  autoFocus
                  className="w-full px-3 py-2 bg-background text-foreground rounded border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  Description <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="The board requested three quotes be obtained"
                  className="w-full px-3 py-2 bg-background text-foreground rounded border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button onClick={closeForm} variant="outline" size="sm" disabled={saving}>
                <X className="h-3 w-3 mr-1" /> Cancel
              </Button>
              <Button
                onClick={handleSave}
                size="sm"
                className="bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:opacity-90"
                disabled={saving}
              >
                <Save className="h-3 w-3 mr-1" />
                {saving ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="overflow-y-auto flex-1">
          <table className="w-full">
            <thead className="bg-muted/50 border-b border-border sticky top-0">
              <tr>
                <th className="text-left p-4 font-semibold text-foreground text-sm w-1/3">Shortcode</th>
                <th className="text-left p-4 font-semibold text-foreground text-sm">Description</th>
                <th className="text-right p-4 font-semibold text-foreground text-sm w-24">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={3} className="text-center p-8 text-muted-foreground text-sm">
                    Loading GeniusWords...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={3} className="text-center p-8 text-muted-foreground text-sm">
                    {searchQuery
                      ? "No GeniusWords match your search"
                      : `${targetUser.name} has no GeniusWords yet. Click 'Add New' to create one.`}
                  </td>
                </tr>
              ) : (
                filtered.map((word) => (
                  <tr key={word.id} className="border-b border-border hover:bg-muted/20 transition-colors">
                    <td className="p-4">
                      <code className="px-2 py-1 bg-purple-100 text-purple-800 rounded text-sm font-mono">
                        {word.shortcode}
                      </code>
                    </td>
                    <td className="p-4 text-foreground text-sm">{word.description}</td>
                    <td className="p-4">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => openEdit(word)}
                          className="flex h-7 w-7 items-center justify-center rounded-full border border-blue-200 text-blue-700 hover:bg-blue-50"
                          title="Edit"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(word.id, word.shortcode)}
                          className="flex h-7 w-7 items-center justify-center rounded-full border border-red-200 text-red-700 hover:bg-red-50"
                          title="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-border flex-shrink-0 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {filtered.length} of {geniusWords.length} GeniusWords
          </span>
          <Button onClick={onClose} variant="outline" size="sm">
            Close
          </Button>
        </div>
      </div>
    </div>
  )
}
