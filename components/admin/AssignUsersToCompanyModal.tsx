"use client"

import { useState, useEffect } from "react"
import { X, UserPlus, UserMinus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { supabase } from "@/lib/supabase"

interface Company {
  id: number
  name: string
  created_at: string
}

interface User {
  id: number
  name: string
  email: string
  user_type: string
  company_id: number | null
  roles?: string[] | null
}

interface AssignUsersToCompanyModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  company: Company | null
}

export default function AssignUsersToCompanyModal({
  isOpen,
  onClose,
  onSuccess,
  company
}: AssignUsersToCompanyModalProps) {
  const [allUsers, setAllUsers] = useState<User[]>([])
  const [usersInCompany, setUsersInCompany] = useState<User[]>([])
  const [usersNotInCompany, setUsersNotInCompany] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (company && isOpen) {
      fetchUsers()
    }
  }, [company, isOpen])

  const fetchUsers = async () => {
    if (!company) return

    setLoading(true)
    try {
      // Fetch all users that can be assigned to companies
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('id, name, email, user_type, roles, company_id')
        .neq('user_type', 'master') // Everyone except masters
        .order('name')

      if (usersError) {
        console.error('Error fetching users:', usersError)
        return
      }

      setAllUsers(usersData || [])

      // Split into users in company vs not in company
      const inCompany = (usersData || []).filter(u => u.company_id === company.id)
      const notInCompany = (usersData || []).filter(u => u.company_id !== company.id)

      setUsersInCompany(inCompany)
      setUsersNotInCompany(notInCompany)

    } catch (err) {
      console.error('Unexpected error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleAddUser = async (userId: number) => {
    setSaving(true)
    try {
      const { error } = await supabase
        .from('users')
        .update({ company_id: company!.id })
        .eq('id', userId)

      if (error) {
        console.error('Error assigning user:', error)
        alert('Failed to assign user to company')
        setSaving(false)
        return
      }

      console.log('✅ User assigned to company')
      await fetchUsers()
      onSuccess()

    } catch (err) {
      console.error('Unexpected error:', err)
      alert('Failed to assign user')
    } finally {
      setSaving(false)
    }
  }

  const handleRemoveUser = async (userId: number) => {
    setSaving(true)
    try {
      const { error } = await supabase
        .from('users')
        .update({ company_id: null })
        .eq('id', userId)

      if (error) {
        console.error('Error removing user:', error)
        alert('Failed to remove user from company')
        setSaving(false)
        return
      }

      console.log('✅ User removed from company')
      await fetchUsers()
      onSuccess()

    } catch (err) {
      console.error('Unexpected error:', err)
      alert('Failed to remove user')
    } finally {
      setSaving(false)
    }
  }

  const getUserTypeBadge = (userType: string) => {
    switch (userType) {
      case 'corporate_administrator':
        return <span className="text-[10px] px-2 py-0.5 rounded bg-purple-100 text-purple-800 border border-purple-200">Corp Admin</span>
      case 'property_manager':
        return <span className="text-[10px] px-2 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-200">PM</span>
      case 'vendor':
        return <span className="text-[10px] px-2 py-0.5 rounded bg-orange-100 text-orange-800 border border-orange-200">Vendor</span>
      default:
        return <span className="text-[10px] px-2 py-0.5 rounded bg-gray-100 text-gray-800 border border-gray-200">{userType.replace('_', ' ')}</span>
    }
  }

  if (!isOpen || !company) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-in fade-in overflow-y-auto p-4">
      <Card className="w-full max-w-4xl border-0 rounded-2xl shadow-2xl my-8 max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between border-b border-border bg-gradient-to-r from-primary/5 to-decision-purple/5 p-6">
          <div>
            <h2 className="text-xl font-bold text-foreground">Manage Users</h2>
            <p className="text-sm text-muted-foreground">
              Assign or remove users from {company.name}
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

        <div className="p-6 overflow-y-auto flex-1">
          {loading ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Loading users...</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-6">
              {/* Users IN Company */}
              <div>
                <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                  <UserMinus className="h-5 w-5 text-green-600" />
                  In Company ({usersInCompany.length})
                </h3>

                {usersInCompany.length === 0 ? (
                  <div className="text-center py-8 border-2 border-dashed border-border rounded-lg">
                    <p className="text-sm text-muted-foreground">No users in this company yet</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {usersInCompany.map((user) => (
                      <Card key={user.id} className="p-3 hover:shadow-sm transition-shadow">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex flex-wrap items-center gap-1 mb-1">
                              <p className="font-medium text-foreground text-sm">{user.name}</p>
                              {Array.from(new Set([user.user_type, ...(user.roles || [])])).map((role) => (
                                <span key={role}>{getUserTypeBadge(role)}</span>
                              ))}
                            </div>
                            <p className="text-xs text-muted-foreground">{user.email}</p>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleRemoveUser(user.id)}
                            disabled={saving}
                            className="text-red-600 hover:bg-red-50"
                          >
                            <UserMinus className="h-4 w-4" />
                          </Button>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </div>

              {/* Users NOT IN Company */}
              <div>
                <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                  <UserPlus className="h-5 w-5 text-blue-600" />
                  Available Users ({usersNotInCompany.length})
                </h3>

                {usersNotInCompany.length === 0 ? (
                  <div className="text-center py-8 border-2 border-dashed border-border rounded-lg">
                    <p className="text-sm text-muted-foreground">All eligible users are assigned</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {usersNotInCompany.map((user) => (
                      <Card key={user.id} className="p-3 hover:shadow-sm transition-shadow">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex flex-wrap items-center gap-1 mb-1">
                              <p className="font-medium text-foreground text-sm">{user.name}</p>
                              {Array.from(new Set([user.user_type, ...(user.roles || [])])).map((role) => (
                                <span key={role}>{getUserTypeBadge(role)}</span>
                              ))}
                              {user.company_id && (
                                <span className="text-xs px-2 py-1 rounded bg-yellow-100 text-yellow-800">
                                  In other company
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">{user.email}</p>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleAddUser(user.id)}
                            disabled={saving}
                            className="text-green-600 hover:bg-green-50"
                          >
                            <UserPlus className="h-4 w-4" />
                          </Button>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-border p-6">
          <Button
            onClick={onClose}
            className="w-full bg-gradient-to-r from-primary to-decision-purple text-primary-foreground"
            disabled={saving}
          >
            {saving ? "Saving..." : "Done"}
          </Button>
        </div>
      </Card>
    </div>
  )
}