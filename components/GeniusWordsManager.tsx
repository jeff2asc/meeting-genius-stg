"use client"

import { useState, useEffect } from "react"
import { Plus, Edit2, Trash2, Save, X, Search, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { supabase, getCurrentUser } from "@/lib/supabase"

interface GeniusWord {
  id: number
  shortcode: string
  description: string
  created_at: string
  user_id: number | null
}

interface GeniusWordsManagerProps {
  onBack: () => void
}

export default function GeniusWordsManager({ onBack }: GeniusWordsManagerProps) {
  const [geniusWords, setGeniusWords] = useState<GeniusWord[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")

  // Modal state
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [isAdding, setIsAdding] = useState(false)

  // Form state
  const [formData, setFormData] = useState({
    shortcode: "",
    description: ""
  })

  const [saving, setSaving] = useState(false)

  const currentUser = getCurrentUser()

  useEffect(() => {
    fetchGeniusWords()
  }, [])

  const fetchGeniusWords = async () => {
    setLoading(true)
    try {
      if (!currentUser?.id) {
        console.error('No user found:', currentUser)
        alert('User information is missing. Please log in again.')
        setLoading(false)
        return
      }

      const { data, error } = await supabase
        .from('genius_words')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('shortcode', { ascending: true })

      if (error) {
        console.error('Error fetching genius words:', error)
        alert('Failed to load GeniusWords: ' + error.message)
        return
      }

      // Deduplicate by shortcode (case-insensitive) — keeps the first occurrence.
      // Guards against any duplicate rows that may already exist in the DB.
      const seen = new Set<string>()
      const unique = (data || []).filter((w) => {
        const key = w.shortcode.toLowerCase()
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })

      setGeniusWords(unique)
    } catch (err) {
      console.error('Unexpected error:', err)
      alert('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleAdd = () => {
    setIsAdding(true)
    setEditingId(null)
    setFormData({ shortcode: "", description: "" })
    setShowModal(true)
  }

  const handleEdit = (word: GeniusWord) => {
    setEditingId(word.id)
    setIsAdding(false)
    setFormData({ shortcode: word.shortcode, description: word.description })
    setShowModal(true)
  }

  const handleCancel = () => {
    setShowModal(false)
    setIsAdding(false)
    setEditingId(null)
    setFormData({ shortcode: "", description: "" })
  }

  const handleSave = async () => {
    if (!formData.shortcode.trim() || !formData.description.trim()) {
      alert('Shortcode and Description are required')
      return
    }

    const shortcode = formData.shortcode.trim()
    if (!shortcode.startsWith('#')) {
      alert('Shortcode must start with #')
      return
    }

    if (shortcode.includes(' ')) {
      alert('Shortcode cannot contain spaces')
      return
    }

    setSaving(true)
    try {
      if (isAdding) {
        if (!currentUser?.id) {
          alert('User information is missing')
          setSaving(false)
          return
        }

        // Client-side duplicate check to prevent duplicate entries
        const duplicate = geniusWords.find(
          (w) => w.shortcode.toLowerCase() === shortcode.toLowerCase()
        )
        if (duplicate) {
          alert('This shortcode already exists in your collection')
          setSaving(false)
          return
        }

        const { error } = await supabase
          .from('genius_words')
          .insert({
            user_id: currentUser.id,
            shortcode: shortcode,
            description: formData.description.trim(),
            created_by: currentUser.id
          })

        if (error) {
          console.error('Error creating genius word:', error)
          if (error.code === '23505') {
            alert('This shortcode already exists in your collection')
          } else {
            alert('Failed to create GeniusWord: ' + error.message)
          }
          setSaving(false)
          return
        }

        alert('GeniusWord created successfully')
      } else if (editingId) {
        // Client-side duplicate check when editing (exclude current record)
        const duplicate = geniusWords.find(
          (w) => w.shortcode.toLowerCase() === shortcode.toLowerCase() && w.id !== editingId
        )
        if (duplicate) {
          alert('This shortcode already exists in your collection')
          setSaving(false)
          return
        }

        const { error } = await supabase
          .from('genius_words')
          .update({
            shortcode: shortcode,
            description: formData.description.trim()
          })
          .eq('id', editingId)

        if (error) {
          console.error('Error updating genius word:', error)
          if (error.code === '23505') {
            alert('This shortcode already exists in your collection')
          } else {
            alert('Failed to update GeniusWord: ' + error.message)
          }
          setSaving(false)
          return
        }

        alert('GeniusWord updated successfully')
      }

      await fetchGeniusWords()
      handleCancel()
    } catch (err) {
      console.error('Unexpected error:', err)
      alert('An unexpected error occurred')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: number, shortcode: string) => {
    if (!confirm(`Delete "${shortcode}"? This action cannot be undone.`)) return

    try {
      const { error } = await supabase
        .from('genius_words')
        .delete()
        .eq('id', id)

      if (error) {
        console.error('Error deleting genius word:', error)
        alert('Failed to delete GeniusWord: ' + error.message)
        return
      }

      alert('GeniusWord deleted successfully')
      await fetchGeniusWords()
    } catch (err) {
      console.error('Unexpected error:', err)
      alert('An unexpected error occurred')
    }
  }

  const filteredWords = geniusWords.filter(word =>
    word.shortcode.toLowerCase().includes(searchQuery.toLowerCase()) ||
    word.description.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      {/* Header */}
      <div className="mb-6">
        <Button onClick={onBack} variant="outline" className="mb-4">
          ← Back to Dashboard
        </Button>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
              <Sparkles className="h-8 w-8 text-purple-600" />
              My GeniusWords
            </h1>
            <p className="text-muted-foreground mt-1">
              Create shortcuts that work everywhere - topics, tasks, notes, and decisions
            </p>
          </div>
          <Button
            onClick={handleAdd}
            className="bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:opacity-90"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add New
          </Button>
        </div>
      </div>

      {/* Search */}
      <Card className="p-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">Search</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search shortcode or description..."
              className="w-full pl-10 pr-3 py-2 bg-background text-foreground rounded border border-border focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
        </div>
      </Card>

      {/* List */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="text-left p-4 font-semibold text-foreground w-1/4">Shortcode</th>
                <th className="text-left p-4 font-semibold text-foreground">Description</th>
                <th className="text-right p-4 font-semibold text-foreground w-32">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={3} className="text-center p-8 text-muted-foreground">
                    Loading GeniusWords...
                  </td>
                </tr>
              ) : filteredWords.length === 0 ? (
                <tr>
                  <td colSpan={3} className="text-center p-8 text-muted-foreground">
                    {searchQuery
                      ? "No GeniusWords match your search"
                      : "No GeniusWords yet. Click 'Add New' to create one."}
                  </td>
                </tr>
              ) : (
                filteredWords.map((word) => (
                  <tr key={word.id} className="border-b border-border hover:bg-muted/20 transition-colors">
                    <td className="p-4">
                      <code className="px-2 py-1 bg-purple-100 text-purple-800 rounded text-sm font-mono">
                        {word.shortcode}
                      </code>
                    </td>
                    <td className="p-4 text-foreground">{word.description}</td>
                    <td className="p-4">
                      <div className="flex justify-end gap-2">
                        <Button
                          onClick={() => handleEdit(word)}
                          variant="ghost"
                          size="sm"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          onClick={() => handleDelete(word.id, word.shortcode)}
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Stats */}
      <div className="mt-6 text-sm text-muted-foreground text-center">
        Showing {filteredWords.length} of {geniusWords.length} GeniusWords
      </div>

      {/* ── Modal ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={handleCancel}
          />

          {/* Dialog */}
          <div className="relative z-10 w-full max-w-md mx-4 bg-background rounded-xl shadow-2xl border border-border">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-border">
              <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-purple-600" />
                {isAdding ? 'Add New GeniusWord' : 'Edit GeniusWord'}
              </h3>
              <button
                onClick={handleCancel}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Shortcode <span className="text-red-500">*</span>{" "}
                  <span className="text-xs text-muted-foreground">(must start with #, no spaces)</span>
                </label>
                <input
                  type="text"
                  value={formData.shortcode}
                  onChange={(e) => setFormData({ ...formData, shortcode: e.target.value })}
                  placeholder="#QuoteReq"
                  autoFocus
                  className="w-full px-3 py-2 bg-background text-foreground rounded border border-border focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Description <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="The board requested that three quotes be obtained"
                  rows={3}
                  className="w-full px-3 py-2 bg-background text-foreground rounded border border-border focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex gap-3 px-6 pb-6">
              <Button
                onClick={handleCancel}
                variant="outline"
                className="flex-1"
                disabled={saving}
              >
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:opacity-90"
                disabled={saving}
              >
                <Save className="h-4 w-4 mr-2" />
                {saving ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
