"use client"

import { useState, useEffect } from "react"
import { X, Users, Building2, UserCheck, Home, Plus, Trash2, Edit2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { supabase } from "@/lib/supabase"

interface Company {
  id: number
  name: string
  created_at: string
}

interface CompanyDetailsModalProps {
  isOpen: boolean
  onClose: () => void
  company: Company | null
}

interface User {
  id: number
  name: string
  email: string
  user_type: string
}

interface Building {
  id: number
  name: string
  address: string | null
}

type Tab = "overview" | "buildings" | "admins"

export default function CompanyDetailsModal({
  isOpen,
  onClose,
  company
}: CompanyDetailsModalProps) {
  const [users, setUsers] = useState<User[]>([])
  const [buildings, setBuildings] = useState<Building[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>("overview")

  // Add Building State
  const [showAddBuilding, setShowAddBuilding] = useState(false)
  const [newBuildingName, setNewBuildingName] = useState("")
  const [newBuildingAddress, setNewBuildingAddress] = useState("")
  const [savingBuilding, setSavingBuilding] = useState(false)

  // Add Admin State
  const [showAddAdmin, setShowAddAdmin] = useState(false)
  const [newAdminName, setNewAdminName] = useState("")
  const [newAdminEmail, setNewAdminEmail] = useState("")
  const [newAdminPassword, setNewAdminPassword] = useState("")
  const [savingAdmin, setSavingAdmin] = useState(false)

  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (company && isOpen) {
      fetchCompanyData()
    }
  }, [company, isOpen])

  const fetchCompanyData = async () => {
    if (!company) return

    setLoading(true)
    try {
      // Fetch users in this company
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('id, name, email, user_type')
        .eq('company_id', company.id)
        .order('name')

      if (usersError) {
        console.error('Error fetching users:', usersError)
      } else {
        setUsers(usersData || [])
      }

      // Fetch buildings in this company
      const { data: buildingsData, error: buildingsError } = await supabase
        .from('buildings')
        .select('id, name, address')
        .eq('company_id', company.id)
        .order('name')

      if (buildingsError) {
        console.error('Error fetching buildings:', buildingsError)
      } else {
        setBuildings(buildingsData || [])
      }

    } catch (err) {
      console.error('Unexpected error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleAddBuilding = async () => {
    if (!newBuildingName.trim()) {
      setError("Building name is required")
      return
    }

    setSavingBuilding(true)
    setError(null)

    try {
      const { error: insertError } = await supabase
        .from('buildings')
        .insert({
          name: newBuildingName.trim(),
          address: newBuildingAddress.trim() || null,
          company_id: company?.id
        })

      if (insertError) {
        console.error('Error adding building:', insertError)
        setError('Failed to add building')
        setSavingBuilding(false)
        return
      }

      setNewBuildingName("")
      setNewBuildingAddress("")
      setShowAddBuilding(false)
      await fetchCompanyData()
    } catch (err) {
      console.error('Unexpected error:', err)
      setError('An unexpected error occurred')
    } finally {
      setSavingBuilding(false)
    }
  }

  const handleDeleteBuilding = async (buildingId: number) => {
    if (!confirm('Are you sure you want to delete this building? This action cannot be undone.')) {
      return
    }

    try {
      const { error } = await supabase
        .from('buildings')
        .delete()
        .eq('id', buildingId)

      if (error) {
        console.error('Error deleting building:', error)
        alert('Failed to delete building')
        return
      }

      await fetchCompanyData()
    } catch (err) {
      console.error('Unexpected error:', err)
    }
  }

  const handleAddAdmin = async () => {
    if (!newAdminName.trim() || !newAdminEmail.trim() || !newAdminPassword.trim()) {
      setError("All fields are required")
      return
    }

    setSavingAdmin(true)
    setError(null)

    try {
      const { error: insertError } = await supabase
        .from('users')
        .insert({
          name: newAdminName.trim(),
          email: newAdminEmail.toLowerCase().trim(),
          password_hash: '$2a$10$rXqvFZnPzAMcLzCP2L4dxu7L6Y3Y5KjGNQQF6xZ4Y5Y5Y5Y5Y5Y5Y5', // Replace with actual hash
          user_type: 'corporate_administrator',
          company_id: company?.id
        })

      if (insertError) {
        console.error('Error adding admin:', insertError)
        setError('Failed to add administrator. Email may already exist.')
        setSavingAdmin(false)
        return
      }

      setNewAdminName("")
      setNewAdminEmail("")
      setNewAdminPassword("")
      setShowAddAdmin(false)
      await fetchCompanyData()
    } catch (err) {
      console.error('Unexpected error:', err)
      setError('An unexpected error occurred')
    } finally {
      setSavingAdmin(false)
    }
  }

  const handleDeleteUser = async (userId: number) => {
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      return
    }

    try {
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', userId)

      if (error) {
        console.error('Error deleting user:', error)
        alert('Failed to delete user')
        return
      }

      await fetchCompanyData()
    } catch (err) {
      console.error('Unexpected error:', err)
    }
  }

  const getUserTypeBadge = (userType: string) => {
    const badges: Record<string, { color: string; label: string }> = {
      master: { color: 'bg-red-100 text-red-800', label: 'Master' },
      corporate_administrator: { color: 'bg-purple-100 text-purple-800', label: 'Corp Admin' },
      property_manager: { color: 'bg-blue-100 text-blue-800', label: 'PM' },
      user: { color: 'bg-green-100 text-green-800', label: 'User' },
      vendor: { color: 'bg-orange-100 text-orange-800', label: 'Vendor' },
      attendee: { color: 'bg-gray-100 text-gray-800', label: 'Attendee' }
    }

    const badge = badges[userType] || { color: 'bg-gray-100 text-gray-800', label: userType }

    return (
      <span className={`text-xs px-2 py-1 rounded ${badge.color}`}>
        {badge.label}
      </span>
    )
  }

  if (!isOpen || !company) return null

  const corporateAdmins = users.filter(u => u.user_type === 'corporate_administrator')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-in fade-in overflow-y-auto p-4">
      <Card className="w-full max-w-5xl border-0 rounded-2xl shadow-2xl my-8 max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between border-b border-border bg-gradient-to-r from-primary/5 to-decision-purple/5 p-6">
          <div>
            <h2 className="text-xl font-bold text-foreground">{company.name}</h2>
            <p className="text-sm text-muted-foreground">
              Manage company buildings and administrators
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded hover:bg-muted transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-border px-6">
          <div className="flex gap-4">
            <button
              onClick={() => setActiveTab("overview")}
              className={`pb-3 px-1 font-medium text-sm transition-colors ${
                activeTab === "overview"
                  ? "border-b-2 border-primary text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab("buildings")}
              className={`pb-3 px-1 font-medium text-sm transition-colors ${
                activeTab === "buildings"
                  ? "border-b-2 border-primary text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Building2 className="h-4 w-4 inline mr-2" />
              Buildings ({buildings.length})
            </button>
            <button
              onClick={() => setActiveTab("admins")}
              className={`pb-3 px-1 font-medium text-sm transition-colors ${
                activeTab === "admins"
                  ? "border-b-2 border-primary text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <UserCheck className="h-4 w-4 inline mr-2" />
              Administrators ({corporateAdmins.length})
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {loading ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Loading...</p>
            </div>
          ) : (
            <>
              {/* Overview Tab */}
              {activeTab === "overview" && (
                <div className="space-y-6">
                  <div className="grid grid-cols-3 gap-4">
                    <Card className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
                      <div className="flex items-center gap-3">
                        <div className="p-3 bg-blue-500 rounded-lg">
                          <Users className="h-6 w-6 text-white" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-blue-900">{users.length}</p>
                          <p className="text-sm text-blue-700">Total Users</p>
                        </div>
                      </div>
                    </Card>

                    <Card className="p-4 bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
                      <div className="flex items-center gap-3">
                        <div className="p-3 bg-purple-500 rounded-lg">
                          <UserCheck className="h-6 w-6 text-white" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-purple-900">{corporateAdmins.length}</p>
                          <p className="text-sm text-purple-700">Corp Admins</p>
                        </div>
                      </div>
                    </Card>

                    <Card className="p-4 bg-gradient-to-br from-green-50 to-green-100 border-green-200">
                      <div className="flex items-center gap-3">
                        <div className="p-3 bg-green-500 rounded-lg">
                          <Building2 className="h-6 w-6 text-white" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-green-900">{buildings.length}</p>
                          <p className="text-sm text-green-700">Buildings</p>
                        </div>
                      </div>
                    </Card>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-foreground mb-3">All Users</h3>
                    {users.length === 0 ? (
                      <div className="text-center py-8 border-2 border-dashed border-border rounded-lg">
                        <p className="text-muted-foreground">No users in this company</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {users.map((user) => (
                          <Card key={user.id} className="p-3 hover:shadow-sm transition-shadow">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-medium text-foreground">{user.name}</p>
                                <p className="text-sm text-muted-foreground">{user.email}</p>
                              </div>
                              {getUserTypeBadge(user.user_type)}
                            </div>
                          </Card>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Buildings Tab */}
              {activeTab === "buildings" && (
                <div className="space-y-4">
                  {error && (
                    <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded text-sm">
                      {error}
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-foreground">Buildings</h3>
                    <Button
                      onClick={() => setShowAddBuilding(!showAddBuilding)}
                      size="sm"
                      className="bg-green-600 hover:bg-green-700 text-white"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Building
                    </Button>
                  </div>

                  {showAddBuilding && (
                    <Card className="p-4 bg-green-50 border-green-200">
                      <h4 className="font-semibold text-foreground mb-3">New Building</h4>
                      <div className="space-y-3">
                        <input
                          type="text"
                          value={newBuildingName}
                          onChange={(e) => setNewBuildingName(e.target.value)}
                          placeholder="Building Name *"
                          className="w-full px-3 py-2 bg-white border border-border rounded focus:outline-none focus:ring-2 focus:ring-green-500"
                        />
                        <input
                          type="text"
                          value={newBuildingAddress}
                          onChange={(e) => setNewBuildingAddress(e.target.value)}
                          placeholder="Address (optional)"
                          className="w-full px-3 py-2 bg-white border border-border rounded focus:outline-none focus:ring-2 focus:ring-green-500"
                        />
                        <div className="flex gap-2">
                          <Button
                            onClick={() => {
                              setShowAddBuilding(false)
                              setNewBuildingName("")
                              setNewBuildingAddress("")
                              setError(null)
                            }}
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            disabled={savingBuilding}
                          >
                            Cancel
                          </Button>
                          <Button
                            onClick={handleAddBuilding}
                            size="sm"
                            className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                            disabled={savingBuilding}
                          >
                            {savingBuilding ? "Adding..." : "Add Building"}
                          </Button>
                        </div>
                      </div>
                    </Card>
                  )}

                  {buildings.length === 0 ? (
                    <div className="text-center py-12 border-2 border-dashed border-border rounded-lg">
                      <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                      <p className="text-muted-foreground">No buildings yet</p>
                      <p className="text-sm text-muted-foreground">Click "Add Building" to create one</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {buildings.map((building) => (
                        <Card key={building.id} className="p-4 hover:shadow-sm transition-shadow">
                          <div className="flex items-start justify-between">
                            <div className="flex items-start gap-3 flex-1">
                              <Home className="h-5 w-5 text-green-600 mt-0.5" />
                              <div>
                                <p className="font-semibold text-foreground">{building.name}</p>
                                {building.address && (
                                  <p className="text-sm text-muted-foreground">{building.address}</p>
                                )}
                              </div>
                            </div>
                            <Button
                              onClick={() => handleDeleteBuilding(building.id)}
                              size="sm"
                              variant="ghost"
                              className="text-red-600 hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Administrators Tab */}
              {activeTab === "admins" && (
                <div className="space-y-4">
                  {error && (
                    <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded text-sm">
                      {error}
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-foreground">Corporate Administrators</h3>
                    <Button
                      onClick={() => setShowAddAdmin(!showAddAdmin)}
                      size="sm"
                      className="bg-purple-600 hover:bg-purple-700 text-white"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Administrator
                    </Button>
                  </div>

                  {showAddAdmin && (
                    <Card className="p-4 bg-purple-50 border-purple-200">
                      <h4 className="font-semibold text-foreground mb-3">New Administrator</h4>
                      <div className="space-y-3">
                        <input
                          type="text"
                          value={newAdminName}
                          onChange={(e) => setNewAdminName(e.target.value)}
                          placeholder="Full Name *"
                          className="w-full px-3 py-2 bg-white border border-border rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                        <input
                          type="email"
                          value={newAdminEmail}
                          onChange={(e) => setNewAdminEmail(e.target.value)}
                          placeholder="Email Address *"
                          className="w-full px-3 py-2 bg-white border border-border rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                        <input
                          type="text"
                          value={newAdminPassword}
                          onChange={(e) => setNewAdminPassword(e.target.value)}
                          placeholder="Temporary Password *"
                          className="w-full px-3 py-2 bg-white border border-border rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                        <div className="flex gap-2">
                          <Button
                            onClick={() => {
                              setShowAddAdmin(false)
                              setNewAdminName("")
                              setNewAdminEmail("")
                              setNewAdminPassword("")
                              setError(null)
                            }}
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            disabled={savingAdmin}
                          >
                            Cancel
                          </Button>
                          <Button
                            onClick={handleAddAdmin}
                            size="sm"
                            className="flex-1 bg-purple-600 hover:bg-purple-700 text-white"
                            disabled={savingAdmin}
                          >
                            {savingAdmin ? "Adding..." : "Add Admin"}
                          </Button>
                        </div>
                      </div>
                    </Card>
                  )}

                  {corporateAdmins.length === 0 ? (
                    <div className="text-center py-12 border-2 border-dashed border-border rounded-lg">
                      <UserCheck className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                      <p className="text-muted-foreground">No administrators yet</p>
                      <p className="text-sm text-muted-foreground">Click "Add Administrator" to create one</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {corporateAdmins.map((admin) => (
                        <Card key={admin.id} className="p-4 hover:shadow-sm transition-shadow">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-purple-100 rounded-full">
                                <UserCheck className="h-5 w-5 text-purple-600" />
                              </div>
                              <div>
                                <p className="font-semibold text-foreground">{admin.name}</p>
                                <p className="text-sm text-muted-foreground">{admin.email}</p>
                              </div>
                            </div>
                            <Button
                              onClick={() => handleDeleteUser(admin.id)}
                              size="sm"
                              variant="ghost"
                              className="text-red-600 hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <div className="border-t border-border p-6 bg-muted/20">
          <Button 
            onClick={onClose} 
            className="w-full bg-gradient-to-r from-primary to-decision-purple text-primary-foreground"
          >
            Close
          </Button>
        </div>
      </Card>
    </div>
  )
}
