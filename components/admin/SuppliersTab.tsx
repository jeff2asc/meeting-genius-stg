"use client"

import { useState, useEffect, useRef } from "react"
import { Plus, Trash2, Edit2, Save, X, Upload, Building, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { SupplierCategory, Supplier } from "@/lib/supabase"

interface SuppliersTabProps {
  companyId: number
  apiKey: string
}

interface InlineEdit {
  supplierId: number
  field: 'limit_amount' | 'approval_gate'
}

export default function SuppliersTab({ companyId, apiKey }: SuppliersTabProps) {
  const [categories, setCategories] = useState<SupplierCategory[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  // Category add/edit
  const [addingCategory, setAddingCategory] = useState(false)
  const [newCatName, setNewCatName] = useState("")
  const [newCatDesc, setNewCatDesc] = useState("")
  const [editingCatId, setEditingCatId] = useState<number | null>(null)
  const [editCatName, setEditCatName] = useState("")
  const [editCatDesc, setEditCatDesc] = useState("")

  // Supplier add
  const [addingSupplier, setAddingSupplier] = useState(false)
  const [newSupName, setNewSupName] = useState("")
  const [newSupEmail, setNewSupEmail] = useState("")
  const [newSupPhone, setNewSupPhone] = useState("")
  const [newSupLimit, setNewSupLimit] = useState("")
  const [newSupGate, setNewSupGate] = useState("")

  // Inline editing
  const [inlineEdit, setInlineEdit] = useState<InlineEdit | null>(null)
  const [inlineValue, setInlineValue] = useState("")

  // Supplier detail modal
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null)

  // Import
  const [showImport, setShowImport] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const [importing, setImporting] = useState(false)

  const headers = { "x-api-key": apiKey, "Content-Type": "application/json" }

  const fetchCategories = async () => {
    const res = await fetch(`/api/v1/supplier-categories?company_id=${companyId}`, { headers })
    const json = await res.json()
    setCategories(json.data || [])
    if (!selectedCategoryId && json.data?.length > 0) setSelectedCategoryId(json.data[0].id)
  }

  const fetchSuppliers = async () => {
    const res = await fetch(`/api/v1/suppliers?company_id=${companyId}`, { headers })
    const json = await res.json()
    setSuppliers(json.data || [])
  }

  useEffect(() => {
    setLoading(true)
    Promise.all([fetchCategories(), fetchSuppliers()]).finally(() => setLoading(false))
  }, [companyId])

  const visibleSuppliers = selectedCategoryId
    ? suppliers.filter(s => s.category_id === selectedCategoryId)
    : suppliers

  const handleAddCategory = async () => {
    if (!newCatName.trim()) return
    const res = await fetch('/api/v1/supplier-categories', {
      method: 'POST', headers,
      body: JSON.stringify({ company_id: companyId, name: newCatName.trim(), description: newCatDesc.trim() || null })
    })
    if (res.ok) {
      toast.success('Category added')
      setNewCatName(""); setNewCatDesc(""); setAddingCategory(false)
      fetchCategories()
    } else {
      const j = await res.json()
      toast.error(j.error || 'Failed to add category')
    }
  }

  const handleUpdateCategory = async (id: number) => {
    await fetch(`/api/v1/supplier-categories/${id}`, {
      method: 'PATCH', headers,
      body: JSON.stringify({ name: editCatName.trim(), description: editCatDesc.trim() || null })
    })
    toast.success('Category updated')
    setEditingCatId(null)
    fetchCategories()
  }

  const handleDeleteCategory = async (id: number) => {
    if (!confirm('Delete this category and all its suppliers?')) return
    await fetch(`/api/v1/supplier-categories/${id}`, { method: 'DELETE', headers })
    toast.success('Category deleted')
    if (selectedCategoryId === id) setSelectedCategoryId(null)
    fetchCategories()
    fetchSuppliers()
  }

  const handleAddSupplier = async () => {
    if (!newSupName.trim()) return
    const res = await fetch('/api/v1/suppliers', {
      method: 'POST', headers,
      body: JSON.stringify({
        company_id: companyId,
        category_id: selectedCategoryId,
        name: newSupName.trim(),
        email: newSupEmail.trim() || null,
        phone: newSupPhone.trim() || null,
        limit_amount: newSupLimit ? parseFloat(newSupLimit) : null,
        approval_gate: newSupGate.trim() || null,
      })
    })
    if (res.ok) {
      toast.success('Supplier added')
      setNewSupName(""); setNewSupEmail(""); setNewSupPhone(""); setNewSupLimit(""); setNewSupGate("")
      setAddingSupplier(false)
      fetchSuppliers()
    } else {
      const j = await res.json()
      toast.error(j.error || 'Failed to add supplier')
    }
  }

  const handleDeleteSupplier = async (id: number) => {
    if (!confirm('Delete this supplier?')) return
    await fetch(`/api/v1/suppliers/${id}`, { method: 'DELETE', headers })
    toast.success('Supplier deleted')
    fetchSuppliers()
  }

  const startInlineEdit = (supplier: Supplier, field: 'limit_amount' | 'approval_gate') => {
    setInlineEdit({ supplierId: supplier.id, field })
    setInlineValue(field === 'limit_amount' ? String(supplier.limit_amount ?? '') : String(supplier.approval_gate ?? ''))
  }

  const saveInlineEdit = async () => {
    if (!inlineEdit) return
    const payload: any = {}
    payload[inlineEdit.field] = inlineEdit.field === 'limit_amount'
      ? (inlineValue ? parseFloat(inlineValue) : null)
      : (inlineValue.trim() || null)
    await fetch(`/api/v1/suppliers/${inlineEdit.supplierId}`, {
      method: 'PATCH', headers, body: JSON.stringify(payload)
    })
    toast.success('Saved')
    setInlineEdit(null)
    fetchSuppliers()
  }

  const handleSaveSupplierDetail = async () => {
    if (!editingSupplier) return
    await fetch(`/api/v1/suppliers/${editingSupplier.id}`, {
      method: 'PATCH', headers, body: JSON.stringify(editingSupplier)
    })
    toast.success('Supplier updated')
    setEditingSupplier(null)
    fetchSuppliers()
  }

  const handleImportCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    const text = await file.text()
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
    const headerLine = lines.shift()?.split(',') || []
    const idxOf = (h: string) => headerLine.findIndex(c => c.trim().toLowerCase() === h)
    const rows = lines.map(line => {
      const cols = line.split(',')
      return {
        name: cols[idxOf('name')]?.trim() || '',
        email: cols[idxOf('email')]?.trim(),
        phone: cols[idxOf('phone')]?.trim(),
        category: cols[idxOf('category')]?.trim(),
        contact_person: cols[idxOf('contact_person')]?.trim(),
        limit_amount: cols[idxOf('limit_amount')]?.trim(),
        approval_gate: cols[idxOf('approval_gate')]?.trim(),
        notes: cols[idxOf('notes')]?.trim(),
      }
    }).filter(r => r.name)

    const res = await fetch('/api/v1/suppliers/bulk-import', {
      method: 'POST', headers, body: JSON.stringify({ company_id: companyId, rows })
    })
    const json = await res.json()
    if (res.ok) {
      toast.success(`Imported ${json.created} suppliers (${json.errors} errors)`)
      fetchCategories()
      fetchSuppliers()
    } else {
      toast.error(json.error || 'Import failed')
    }
    setImporting(false)
    setShowImport(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  if (loading) return <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">Loading suppliers…</div>

  return (
    <div className="flex gap-4 h-full min-h-[600px]">
      {/* ── Left: Category sidebar ── */}
      <div className="w-56 flex-shrink-0 border-r border-border pr-4 space-y-1">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Categories</span>
          <button onClick={() => setAddingCategory(true)} className="p-1 rounded hover:bg-muted">
            <Plus className="h-3.5 w-3.5 text-primary" />
          </button>
        </div>

        {addingCategory && (
          <div className="p-2 bg-primary/5 border border-primary/20 rounded-lg space-y-1.5 mb-2">
            <input autoFocus value={newCatName} onChange={e => setNewCatName(e.target.value)}
              placeholder="Category name" className="w-full px-2 py-1 text-xs rounded border border-border bg-background focus:ring-1 focus:ring-primary" />
            <input value={newCatDesc} onChange={e => setNewCatDesc(e.target.value)}
              placeholder="Description (optional)" className="w-full px-2 py-1 text-xs rounded border border-border bg-background focus:ring-1 focus:ring-primary" />
            <div className="flex gap-1 justify-end">
              <Button size="sm" variant="default" onClick={handleAddCategory} className="h-6 px-2 text-[10px]"><Save className="h-3 w-3 mr-1" />Add</Button>
              <Button size="sm" variant="ghost" onClick={() => setAddingCategory(false)} className="h-6 w-6 p-0"><X className="h-3 w-3" /></Button>
            </div>
          </div>
        )}

        <button
          onClick={() => setSelectedCategoryId(null)}
          className={`w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-colors ${!selectedCategoryId ? 'bg-primary text-primary-foreground font-semibold' : 'hover:bg-muted text-muted-foreground'}`}
        >
          All suppliers
          <Badge variant="secondary" className="ml-auto text-[10px] h-4 px-1">{suppliers.length}</Badge>
        </button>

        {categories.map(cat => {
          const count = suppliers.filter(s => s.category_id === cat.id).length
          return editingCatId === cat.id ? (
            <div key={cat.id} className="p-1.5 bg-primary/5 border border-primary/20 rounded-lg space-y-1">
              <input autoFocus value={editCatName} onChange={e => setEditCatName(e.target.value)}
                className="w-full px-2 py-0.5 text-xs rounded border border-border bg-background" />
              <input value={editCatDesc} onChange={e => setEditCatDesc(e.target.value)}
                placeholder="Description" className="w-full px-2 py-0.5 text-xs rounded border border-border bg-background" />
              <div className="flex gap-0.5 justify-end">
                <Button size="sm" variant="default" onClick={() => handleUpdateCategory(cat.id)} className="h-5 px-1.5 text-[10px]"><Save className="h-2.5 w-2.5" /></Button>
                <Button size="sm" variant="ghost" onClick={() => setEditingCatId(null)} className="h-5 w-5 p-0"><X className="h-2.5 w-2.5" /></Button>
              </div>
            </div>
          ) : (
            <div key={cat.id}
              className={`group w-full flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs cursor-pointer transition-colors ${selectedCategoryId === cat.id ? 'bg-primary text-primary-foreground font-semibold' : 'hover:bg-muted text-foreground'}`}
              onClick={() => setSelectedCategoryId(cat.id)}>
              <ChevronRight className="h-3 w-3 flex-shrink-0" />
              <span className="flex-1 truncate">{cat.name}</span>
              <Badge variant="secondary" className={`text-[10px] h-4 px-1 flex-shrink-0 ${selectedCategoryId === cat.id ? 'bg-white/20 text-white' : ''}`}>{count}</Badge>
              <div className="hidden group-hover:flex gap-0.5">
                <button onClick={e => { e.stopPropagation(); setEditingCatId(cat.id); setEditCatName(cat.name); setEditCatDesc(cat.description || '') }}
                  className="p-0.5 rounded hover:bg-black/10"><Edit2 className="h-2.5 w-2.5" /></button>
                <button onClick={e => { e.stopPropagation(); handleDeleteCategory(cat.id) }}
                  className="p-0.5 rounded hover:bg-red-100 text-red-500"><Trash2 className="h-2.5 w-2.5" /></button>
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Right: Supplier list ── */}
      <div className="flex-1 space-y-3 overflow-y-auto">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">
            {selectedCategoryId ? categories.find(c => c.id === selectedCategoryId)?.name : 'All Suppliers'}
            <span className="text-muted-foreground font-normal ml-2 text-xs">({visibleSuppliers.length})</span>
          </h3>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setShowImport(!showImport)} className="text-[11px] h-7 px-2.5">
              <Upload className="h-3 w-3 mr-1" />CSV Import
            </Button>
            <Button size="sm" onClick={() => setAddingSupplier(true)} className="text-[11px] h-7 px-2.5">
              <Plus className="h-3 w-3 mr-1" />Add Supplier
            </Button>
          </div>
        </div>

        {showImport && (
          <div className="p-3 bg-muted/30 border border-border rounded-xl space-y-2">
            <p className="text-xs text-muted-foreground">CSV columns: <code>name,email,phone,category,contact_person,limit_amount,approval_gate,notes</code></p>
            <input ref={fileRef} type="file" accept=".csv" onChange={handleImportCSV} disabled={importing}
              className="text-xs file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:bg-primary file:text-primary-foreground" />
            {importing && <p className="text-xs text-muted-foreground animate-pulse">Importing…</p>}
          </div>
        )}

        {/* Column headers */}
        <div className="grid grid-cols-[2fr_2fr_1fr_1fr_1fr_auto] gap-2 px-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          <span>Name / Contact</span><span>Email / Phone</span><span>Category</span><span>Limit</span><span>Gate</span><span></span>
        </div>

        {/* Add new supplier row */}
        {addingSupplier && (
          <div className="grid grid-cols-[2fr_2fr_1fr_1fr_1fr_auto] gap-2 px-3 py-2 bg-primary/5 border border-primary/20 rounded-xl items-center">
            <input autoFocus value={newSupName} onChange={e => setNewSupName(e.target.value)} placeholder="Supplier name *"
              className="px-2 py-1 text-xs rounded border border-border bg-background focus:ring-1 focus:ring-primary" />
            <div className="flex flex-col gap-1">
              <input value={newSupEmail} onChange={e => setNewSupEmail(e.target.value)} placeholder="Email"
                className="px-2 py-1 text-xs rounded border border-border bg-background" />
              <input value={newSupPhone} onChange={e => setNewSupPhone(e.target.value)} placeholder="Phone"
                className="px-2 py-1 text-xs rounded border border-border bg-background" />
            </div>
            <span className="text-xs text-muted-foreground truncate">{selectedCategoryId ? categories.find(c => c.id === selectedCategoryId)?.name : '—'}</span>
            <input value={newSupLimit} onChange={e => setNewSupLimit(e.target.value)} placeholder="$0.00" type="number"
              className="px-2 py-1 text-xs rounded border border-border bg-background" />
            <input value={newSupGate} onChange={e => setNewSupGate(e.target.value)} placeholder="Gate"
              className="px-2 py-1 text-xs rounded border border-border bg-background" />
            <div className="flex gap-1">
              <Button size="sm" variant="default" onClick={handleAddSupplier} className="h-7 px-2 text-[10px]"><Save className="h-3 w-3 mr-1" />Save</Button>
              <Button size="sm" variant="ghost" onClick={() => setAddingSupplier(false)} className="h-7 w-7 p-0"><X className="h-3 w-3" /></Button>
            </div>
          </div>
        )}

        {visibleSuppliers.length === 0 && !addingSupplier && (
          <p className="text-sm text-muted-foreground text-center py-8">No suppliers in this category yet.</p>
        )}

        {visibleSuppliers.map(supplier => (
          <div key={supplier.id}
            className="grid grid-cols-[2fr_2fr_1fr_1fr_1fr_auto] gap-2 px-3 py-2 bg-muted/20 hover:bg-muted/40 rounded-xl items-center border border-border/40 group transition-all">
            {/* Name + contact — click to open full edit */}
            <div className="min-w-0 cursor-pointer" onClick={() => setEditingSupplier({...supplier})}>
              <p className="text-xs font-semibold truncate hover:text-primary transition-colors">{supplier.name}</p>
              {supplier.contact_person && <p className="text-[10px] text-muted-foreground truncate">{supplier.contact_person}</p>}
            </div>
            <div className="min-w-0">
              <p className="text-xs truncate">{supplier.email || '—'}</p>
              <p className="text-[10px] text-muted-foreground truncate">{supplier.phone || ''}</p>
            </div>
            <span className="text-xs text-muted-foreground truncate">{supplier.category?.name || '—'}</span>

            {/* Limit amount — inline editable */}
            {inlineEdit?.supplierId === supplier.id && inlineEdit.field === 'limit_amount' ? (
              <input autoFocus type="number" value={inlineValue} onChange={e => setInlineValue(e.target.value)}
                onBlur={saveInlineEdit} onKeyDown={e => { if (e.key === 'Enter') saveInlineEdit(); if (e.key === 'Escape') setInlineEdit(null) }}
                className="px-1.5 py-0.5 text-xs rounded border border-primary bg-background w-full" />
            ) : (
              <span onClick={() => startInlineEdit(supplier, 'limit_amount')}
                className="text-xs cursor-pointer hover:bg-primary/10 rounded px-1 py-0.5 transition-colors">
                {supplier.limit_amount ? `$${supplier.limit_amount.toLocaleString()}` : <span className="text-muted-foreground/50">click to set</span>}
              </span>
            )}

            {/* Approval gate — inline editable */}
            {inlineEdit?.supplierId === supplier.id && inlineEdit.field === 'approval_gate' ? (
              <input autoFocus value={inlineValue} onChange={e => setInlineValue(e.target.value)}
                onBlur={saveInlineEdit} onKeyDown={e => { if (e.key === 'Enter') saveInlineEdit(); if (e.key === 'Escape') setInlineEdit(null) }}
                className="px-1.5 py-0.5 text-xs rounded border border-primary bg-background w-full" />
            ) : (
              <span onClick={() => startInlineEdit(supplier, 'approval_gate')}
                className="text-xs cursor-pointer hover:bg-primary/10 rounded px-1 py-0.5 transition-colors truncate">
                {supplier.approval_gate || <span className="text-muted-foreground/50">click to set</span>}
              </span>
            )}

            <button onClick={() => handleDeleteSupplier(supplier.id)}
              className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-100 text-red-500 transition-all">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>

      {/* ── Supplier Detail Modal ── */}
      {editingSupplier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-lg border border-border p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">Edit Supplier</h3>
              <button onClick={() => setEditingSupplier(null)} className="p-1.5 rounded-lg hover:bg-muted"><X className="h-4 w-4" /></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Name *', field: 'name', type: 'text' },
                { label: 'Email', field: 'email', type: 'email' },
                { label: 'Phone', field: 'phone', type: 'tel' },
                { label: 'Contact Person', field: 'contact_person', type: 'text' },
                { label: 'Address', field: 'address', type: 'text' },
                { label: 'Limit Amount ($)', field: 'limit_amount', type: 'number' },
                { label: 'Approval Gate', field: 'approval_gate', type: 'text' },
                { label: 'Notes', field: 'notes', type: 'text' },
              ].map(({ label, field, type }) => (
                <div key={field} className={field === 'address' || field === 'notes' ? 'col-span-2' : ''}>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
                  <input
                    type={type}
                    value={(editingSupplier as any)[field] ?? ''}
                    onChange={e => setEditingSupplier({ ...editingSupplier, [field]: e.target.value } as Supplier)}
                    className="w-full px-3 py-1.5 text-sm rounded-lg border border-border bg-background focus:ring-2 focus:ring-primary/40 focus:border-primary/50"
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setEditingSupplier(null)}>Cancel</Button>
              <Button onClick={handleSaveSupplierDetail}>Save Changes</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
