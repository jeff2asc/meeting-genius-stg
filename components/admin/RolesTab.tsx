"use client"

import { useState, useEffect } from "react"
import { Plus, Trash2, Edit2, Save, X, Shield, Lock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { CustomRole } from "@/lib/supabase"

interface RolesTabProps {
  companyId: number | null
  apiKey: string
  isMaster: boolean
}

const BUILT_IN_ROLES = [
  'master', 'corporate_administrator', 'property_manager', 'user',
  'owner', 'resident', 'vendor', 'attendee', 'supplier',
]

export default function RolesTab({ companyId, apiKey, isMaster }: RolesTabProps) {
  const [roles, setRoles] = useState<CustomRole[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState("")
  const [newLabel, setNewLabel] = useState("")
  const [newDesc, setNewDesc] = useState("")
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editLabel, setEditLabel] = useState("")
  const [editDesc, setEditDesc] = useState("")

  const headers = { "x-api-key": apiKey, "Content-Type": "application/json" }

  const fetchRoles = async () => {
    const url = companyId ? `/api/v1/custom-roles?company_id=${companyId}` : '/api/v1/custom-roles'
    const res = await fetch(url, { headers })
    const json = await res.json()
    setRoles(json.data || [])
    setLoading(false)
  }

  useEffect(() => { fetchRoles() }, [companyId])

  const handleAdd = async () => {
    if (!newName.trim() || !newLabel.trim()) { toast.error('Name and label are required'); return }
    setSaving(true)
    const res = await fetch('/api/v1/custom-roles', {
      method: 'POST', headers,
      body: JSON.stringify({ company_id: companyId, name: newName.trim(), label: newLabel.trim(), description: newDesc.trim() || null })
    })
    if (res.ok) {
      toast.success('Role created')
      setNewName(""); setNewLabel(""); setNewDesc(""); setAdding(false)
      fetchRoles()
    } else {
      const j = await res.json()
      toast.error(j.error || 'Failed to create role')
    }
    setSaving(false)
  }

  const handleUpdate = async (id: number) => {
    await fetch(`/api/v1/custom-roles/${id}`, {
      method: 'PATCH', headers,
      body: JSON.stringify({ label: editLabel.trim(), description: editDesc.trim() || null })
    })
    toast.success('Role updated')
    setEditingId(null)
    fetchRoles()
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this role? Users with this role will retain it until manually updated.')) return
    const res = await fetch(`/api/v1/custom-roles/${id}`, { method: 'DELETE', headers })
    if (res.ok) { toast.success('Role deleted'); fetchRoles() }
    else { const j = await res.json(); toast.error(j.error || 'Cannot delete this role') }
  }

  if (loading) return <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">Loading roles…</div>

  const globalRoles = roles.filter(r => r.company_id === null)
  const customRoles = roles.filter(r => r.company_id !== null)

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-foreground">Role Management</h2>
          <p className="text-xs text-muted-foreground">Define roles that can be assigned to users and suppliers.</p>
        </div>
        <Button size="sm" onClick={() => setAdding(true)} className="text-xs h-7 px-3">
          <Plus className="h-3 w-3 mr-1" />New Role
        </Button>
      </div>

      {/* Add new role form */}
      {adding && (
        <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl space-y-3">
          <h4 className="text-sm font-semibold">Create New Role</h4>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Internal Name (no spaces) *</label>
              <input value={newName} onChange={e => setNewName(e.target.value.toLowerCase().replace(/\s+/g, '_'))}
                placeholder="e.g. supplier" className="w-full px-3 py-1.5 text-sm rounded-lg border border-border bg-background focus:ring-2 focus:ring-primary/40" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Display Label *</label>
              <input value={newLabel} onChange={e => setNewLabel(e.target.value)}
                placeholder="e.g. Supplier" className="w-full px-3 py-1.5 text-sm rounded-lg border border-border bg-background focus:ring-2 focus:ring-primary/40" />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-medium text-muted-foreground block mb-1">Description</label>
              <input value={newDesc} onChange={e => setNewDesc(e.target.value)}
                placeholder="What this role can do" className="w-full px-3 py-1.5 text-sm rounded-lg border border-border bg-background" />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setAdding(false)} className="h-7">Cancel</Button>
            <Button size="sm" onClick={handleAdd} disabled={saving} className="h-7">{saving ? 'Creating…' : 'Create Role'}</Button>
          </div>
        </div>
      )}

      {/* Built-in / global roles */}
      <div className="space-y-2">
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <Lock className="h-3 w-3" />System Roles (built-in)
        </p>
        {globalRoles.map(role => (
          <div key={role.id} className="flex items-center justify-between px-4 py-2.5 rounded-xl border border-border/50 bg-muted/20">
            <div className="flex items-center gap-3">
              <Shield className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">{role.label}</p>
                <p className="text-xs text-muted-foreground font-mono">{role.name}</p>
              </div>
            </div>
            {role.description && <p className="text-xs text-muted-foreground max-w-xs text-right">{role.description}</p>}
            <Badge variant="secondary" className="text-[10px] ml-2">Built-in</Badge>
          </div>
        ))}
      </div>

      {/* Company-specific custom roles */}
      <div className="space-y-2">
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <Plus className="h-3 w-3" />Custom Roles
        </p>
        {customRoles.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4 bg-muted/10 rounded-xl border border-dashed border-border">
            No custom roles yet. Click "New Role" to create one.
          </p>
        )}
        {customRoles.map(role => (
          editingId === role.id ? (
            <div key={role.id} className="p-3 bg-primary/5 border border-primary/20 rounded-xl space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground">Display Label</label>
                  <input value={editLabel} onChange={e => setEditLabel(e.target.value)}
                    className="w-full px-2 py-1 text-sm rounded border border-border bg-background" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Description</label>
                  <input value={editDesc} onChange={e => setEditDesc(e.target.value)}
                    className="w-full px-2 py-1 text-sm rounded border border-border bg-background" />
                </div>
              </div>
              <div className="flex justify-end gap-1">
                <Button size="sm" variant="default" onClick={() => handleUpdate(role.id)} className="h-6 px-2 text-[10px]"><Save className="h-3 w-3 mr-1" />Save</Button>
                <Button size="sm" variant="ghost" onClick={() => setEditingId(null)} className="h-6 w-6 p-0"><X className="h-3 w-3" /></Button>
              </div>
            </div>
          ) : (
            <div key={role.id} className="flex items-center justify-between px-4 py-2.5 rounded-xl border border-border bg-card group">
              <div className="flex items-center gap-3">
                <Shield className="h-4 w-4 text-primary" />
                <div>
                  <p className="text-sm font-medium">{role.label}</p>
                  <p className="text-xs text-muted-foreground font-mono">{role.name}</p>
                </div>
              </div>
              {role.description && <p className="text-xs text-muted-foreground max-w-xs text-right">{role.description}</p>}
              <div className="flex gap-1 opacity-0 group-hover:opacity-100">
                <button onClick={() => { setEditingId(role.id); setEditLabel(role.label); setEditDesc(role.description || '') }}
                  className="p-1.5 rounded-lg hover:bg-muted"><Edit2 className="h-3.5 w-3.5" /></button>
                <button onClick={() => handleDelete(role.id)}
                  className="p-1.5 rounded-lg hover:bg-red-100 text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            </div>
          )
        ))}
      </div>
    </div>
  )
}
