"use client"

import { useState } from "react"
import { X, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { supabase } from "@/lib/supabase"
import { triggerJanusResync } from "@/lib/janus"

interface CreateCompanyModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

interface NewUser {
  name: string
  email: string
  password: string
  role: 'corporate_administrator' | 'property_manager'
}

const DEFAULT_SECTIONS = [
  "Call to Order",
  "Approval of Agenda",
  "Old Business / Business Arising",
  "New Business",
  "Financial Report",
  "Maintenance & Operations",
  "Correspondence",
  "Council Roundtable",
  "Adjournment",
]
const DEFAULT_TYPES = [
  "Council Meeting",
  "AGM",
  "SGM",
  "Special Meeting",
  "Emergency Meeting",
]

export default function CreateCompanyModal({
  isOpen,
  onClose,
  onSuccess
}: CreateCompanyModalProps) {
  const [companyName, setCompanyName] = useState("")
  const [newUsers, setNewUsers] = useState<NewUser[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const addUser = (role: 'corporate_administrator' | 'property_manager') => {
    setNewUsers([...newUsers, {
      name: "",
      email: "",
      password: "",
      role: role
    }])
  }

  const removeUser = (index: number) => {
    setNewUsers(newUsers.filter((_, i) => i !== index))
  }

  const updateUser = (index: number, field: keyof NewUser, value: string) => {
    const updated = [...newUsers]
    updated[index] = { ...updated[index], [field]: value }
    setNewUsers(updated)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!companyName.trim()) {
      setError("Company name is required")
      return
    }

    const emailMap = new Map<string, string>()
    for (const user of newUsers) {
      const email = user.email.toLowerCase().trim()
      if (!user.name.trim() || !user.email.trim() || !user.password.trim()) {
        setError("Please fill in all fields for all users")
        return
      }
      if (emailMap.has(email) && emailMap.get(email) !== user.name.trim()) {
        setError(`Consistency error: Different names provided for the same email (${email})`)
        return
      }
      emailMap.set(email, user.name.trim())
    }

    setSaving(true)

    try {
      // 1. Create company with meeting section/type defaults
      const { data: newCompany, error: companyError } = await supabase
        .from('companies')
        .insert({
          name: companyName.trim(),
          default_meeting_sections: DEFAULT_SECTIONS,
          default_meeting_types: DEFAULT_TYPES
        })
        .select()
        .single()

      if (companyError) {
        console.error('Error creating company:', companyError)
        setError('Failed to create company.')
        setSaving(false)
        return
      }
      console.log('✅ Company created:', newCompany.id)

      // 2. Create users (Deduplicate by email and handle multiple roles)
      const uniqueUsersMap = new Map<string, { 
        name: string, 
        email: string, 
        password: string, 
        roles: Set<string> 
      }>()

      for (const u of newUsers) {
        const email = u.email.toLowerCase().trim()
        if (!uniqueUsersMap.has(email)) {
          uniqueUsersMap.set(email, {
            name: u.name.trim(),
            email: email,
            password: u.password.trim(),
            roles: new Set([u.role])
          })
        } else {
          uniqueUsersMap.get(email)!.roles.add(u.role)
        }
      }

      for (const [email, u] of uniqueUsersMap.entries()) {
        const rolesArray = Array.from(u.roles)
        const primaryRole = rolesArray[0]
        const extraRoles = rolesArray.slice(1)

        const { error: userError } = await supabase
          .from('users')
          .upsert({
            name: u.name,
            email: u.email,
            password_hash: '$2a$10$rXqvFZnPzAMcLzCP2L4dxu7L6Y3Y5KjGNQQF6xZ4Y5Y5Y5Y5Y5Y5Y5', // Replace with secure hash logic
            user_type: primaryRole,
            roles: rolesArray,
            company_id: newCompany.id
          }, { onConflict: 'email' })

        if (userError) {
          console.error('Error creating/updating user:', userError)
          setError(`Failed to process user: ${email}. ${userError.message}`)
          setSaving(false)
          return
        }

        console.log('✅ User processed:', email)
      }

      setCompanyName("")
      setNewUsers([])
      // 🔄 Notify Janus of new company + initial users
      const usersToSync = Array.from(uniqueUsersMap.values()).map(u => ({
        name: u.name,
        email: u.email,
        roles: Array.from(u.roles),
        company_id: newCompany.id
      }))

      triggerJanusResync("company_created", {
        ...newCompany,
        users: usersToSync
      }, "company")
      onSuccess()
      onClose()
    } catch (err) {
      console.error('Unexpected error:', err)
      setError('An unexpected error occurred')
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  const corpAdmins = newUsers.filter(u => u.role === 'corporate_administrator')
  const propertyManagers = newUsers.filter(u => u.role === 'property_manager')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-in fade-in overflow-y-auto p-4">
      <Card className="w-full max-w-3xl border-0 rounded-2xl shadow-2xl my-8 max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between border-b border-border bg-gradient-to-r from-primary/5 to-decision-purple/5 p-6">
          <div>
            <h2 className="text-xl font-bold text-foreground">Create New Company</h2>
            <p className="text-sm text-muted-foreground">
              Add a company and create users for it
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded hover:bg-muted transition-colors"
            disabled={saving}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded text-sm">
                {error}
              </div>
            )}
            {/* Company Name */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Company Name *
              </label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="e.g., ABC Property Management"
                required
                disabled={saving}
                className="w-full px-3 py-2 bg-background text-foreground rounded border border-border focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
              />
            </div>

            {/* Corporate Administrators Section */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-foreground">
                  Corporate Administrators
                </h3>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => addUser('corporate_administrator')}
                  disabled={saving}
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Corp Admin
                </Button>
              </div>
              {corpAdmins.length === 0 ? (
                <div className="text-center py-4 border-2 border-dashed border-border rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    No corporate administrators added yet
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {newUsers.map((user, index) => (
                    user.role === 'corporate_administrator' && (
                      <Card key={index} className="p-4 bg-purple-50 border-purple-200">
                        <div className="flex items-start gap-3">
                          <div className="flex-1 space-y-3">
                            <input
                              type="text"
                              value={user.name}
                              onChange={(e) => updateUser(index, 'name', e.target.value)}
                              placeholder="Full Name *"
                              required
                              disabled={saving}
                              className="w-full px-3 py-2 bg-white text-foreground rounded border border-border focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
                            />
                            <input
                              type="email"
                              value={user.email}
                              onChange={(e) => updateUser(index, 'email', e.target.value)}
                              placeholder="Email Address *"
                              required
                              disabled={saving}
                              className="w-full px-3 py-2 bg-white text-foreground rounded border border-border focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
                            />
                            <input
                              type="text"
                              value={user.password}
                              onChange={(e) => updateUser(index, 'password', e.target.value)}
                              placeholder="Temporary Password *"
                              required
                              disabled={saving}
                              className="w-full px-3 py-2 bg-white text-foreground rounded border border-border focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
                            />
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => removeUser(index)}
                            disabled={saving}
                            className="text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </Card>
                    )
                  ))}
                </div>
              )}
            </div>

            {/* Property Managers Section */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-foreground">
                  Property Managers
                </h3>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => addUser('property_manager')}
                  disabled={saving}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Property Manager
                </Button>
              </div>
              {propertyManagers.length === 0 ? (
                <div className="text-center py-4 border-2 border-dashed border-border rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    No property managers added yet
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {newUsers.map((user, index) => (
                    user.role === 'property_manager' && (
                      <Card key={index} className="p-4 bg-blue-50 border-blue-200">
                        <div className="flex items-start gap-3">
                          <div className="flex-1 space-y-3">
                            <input
                              type="text"
                              value={user.name}
                              onChange={(e) => updateUser(index, 'name', e.target.value)}
                              placeholder="Full Name *"
                              required
                              disabled={saving}
                              className="w-full px-3 py-2 bg-white text-foreground rounded border border-border focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                            />
                            <input
                              type="email"
                              value={user.email}
                              onChange={(e) => updateUser(index, 'email', e.target.value)}
                              placeholder="Email Address *"
                              required
                              disabled={saving}
                              className="w-full px-3 py-2 bg-white text-foreground rounded border border-border focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                            />
                            <input
                              type="text"
                              value={user.password}
                              onChange={(e) => updateUser(index, 'password', e.target.value)}
                              placeholder="Temporary Password *"
                              required
                              disabled={saving}
                              className="w-full px-3 py-2 bg-white text-foreground rounded border border-border focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                            />
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => removeUser(index)}
                            disabled={saving}
                            className="text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </Card>
                    )
                  ))}
                </div>
              )}
            </div>
            <div className="bg-blue-50 border border-blue-200 p-3 rounded text-sm text-blue-800">
              <strong>💡 Tip:</strong> You can create the company without users and add them later, or add multiple users here and they'll all be assigned to this company automatically.
            </div>
          </div>
          <div className="border-t border-border p-6 bg-muted/20">
            <div className="flex gap-3">
              <Button 
                type="button" 
                variant="outline" 
                onClick={onClose} 
                className="flex-1"
                disabled={saving}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1 bg-gradient-to-r from-primary to-decision-purple text-primary-foreground hover:opacity-90"
                disabled={saving}
              >
                {(() => {
                  const uniqueCount = new Set(newUsers.map(u => u.email.toLowerCase().trim())).size
                  if (saving) return "Creating..."
                  if (uniqueCount === 0) return "Create Company"
                  return `Create Company + ${uniqueCount} User${uniqueCount > 1 ? 's' : ''}`
                })()}
              </Button>
            </div>
          </div>
        </form>
      </Card>
    </div>
  )
}
