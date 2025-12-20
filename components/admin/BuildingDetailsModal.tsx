"use client"

import { useState, useEffect } from "react"
import { X, Building2, Settings, Users, FileText, Edit2, Trash2, Upload, Eye, Home } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { supabase } from "@/lib/supabase"

interface Building {
  id: number
  name: string
  address: string | null
  manager_id: number
  company_id: number | null
  building_type?: string
  logo_url?: string | null
  header_text?: string | null
  footer_text?: string | null
  primary_color?: string
  created_at: string
}

interface User {
  id: number
  name: string
  email: string
  user_type: string
}

interface BuildingDetailsModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  building: Building | null
  availableUsers: User[]
}

type Tab = "overview" | "settings" | "users" | "documents"

export default function BuildingDetailsModal({
  isOpen,
  onClose,
  onSuccess,
  building,
  availableUsers
}: BuildingDetailsModalProps) {
  const [activeTab, setActiveTab] = useState<Tab>("overview")
  const [loading, setLoading] = useState(true)
  
  // Building data
  const [buildingUsers, setBuildingUsers] = useState<User[]>([])
  const [propertyManager, setPropertyManager] = useState<User | null>(null)
  const [company, setCompany] = useState<{ id: number; name: string } | null>(null)
  const [meetingsCount, setMeetingsCount] = useState(0)
  const [hasDocument, setHasDocument] = useState(false)
  
  // Settings form
  const [editMode, setEditMode] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    address: "",
    building_type: "Strata/Condo" as 'Strata/Condo' | 'Rental' | 'Housing Co-op'
  })
  
  // Users management
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([])
  const [savingUsers, setSavingUsers] = useState(false)
  
  // General state
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (building && isOpen) {
      fetchBuildingData()
    }
  }, [building, isOpen])

  const fetchBuildingData = async () => {
    if (!building) return

    setLoading(true)
    try {
      // Fetch building users
      const { data: userBuildingsData } = await supabase
        .from('user_buildings')
        .select('user_id')
        .eq('building_id', building.id)

      const userIds = userBuildingsData?.map(ub => ub.user_id) || []
      setSelectedUserIds(userIds)

      if (userIds.length > 0) {
        const { data: usersData } = await supabase
          .from('users')
          .select('id, name, email, user_type')
          .in('id', userIds)
        
        setBuildingUsers(usersData || [])
      } else {
        setBuildingUsers([])
      }

      // Fetch property manager
      if (building.manager_id) {
        const { data: managerData } = await supabase
          .from('users')
          .select('id, name, email, user_type')
          .eq('id', building.manager_id)
          .single()
        
        setPropertyManager(managerData)
      }

      // Fetch company
      if (building.company_id) {
        const { data: companyData } = await supabase
          .from('companies')
          .select('id, name')
          .eq('id', building.company_id)
          .single()
        
        setCompany(companyData)
      }

      // Count meetings
      const { count } = await supabase
        .from('meetings')
        .select('*', { count: 'exact', head: true })
        .eq('building_id', building.id)
      
      setMeetingsCount(count || 0)

      // Check for documents
      setHasDocument(!!(building as any).rules_document)

      // Set form data
      setFormData({
        name: building.name,
        address: building.address || "",
        building_type: (building.building_type as any) || "Strata/Condo"
      })

    } catch (err) {
      console.error('Error fetching building data:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateSettings = async () => {
    if (!building) return

    setSaving(true)
    setError(null)

    try {
      const { error: updateError } = await supabase
        .from('buildings')
        .update({
          name: formData.name.trim(),
          address: formData.address.trim() || null,
          building_type: formData.building_type
        })
        .eq('id', building.id)

      if (updateError) {
        setError('Failed to update building')
        setSaving(false)
        return
      }

      setEditMode(false)
      onSuccess()
      await fetchBuildingData()
    } catch (err) {
      setError('An unexpected error occurred')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveUsers = async () => {
    if (!building) return

    setSavingUsers(true)
    setError(null)

    try {
      // Delete existing assignments
      await supabase
        .from('user_buildings')
        .delete()
        .eq('building_id', building.id)

      // Insert new assignments
      if (selectedUserIds.length > 0) {
        const assignments = selectedUserIds.map(userId => ({
          user_id: userId,
          building_id: building.id
        }))

        const { error: insertError } = await supabase
          .from('user_buildings')
          .insert(assignments)

        if (insertError) {
          setError('Failed to update user assignments')
          setSavingUsers(false)
          return
        }
      }

      await fetchBuildingData()
      onSuccess()
    } catch (err) {
      setError('An unexpected error occurred')
    } finally {
      setSavingUsers(false)
    }
  }

  const toggleUser = (userId: number) => {
    setSelectedUserIds(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    )
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

  const getBuildingTypeColor = (type: string) => {
    switch (type) {
      case 'Strata/Condo':
        return 'bg-blue-100 text-blue-800'
      case 'Rental':
        return 'bg-green-100 text-green-800'
      case 'Housing Co-op':
        return 'bg-purple-100 text-purple-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  if (!isOpen || !building) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-in fade-in overflow-y-auto p-4">
      <Card className="w-full max-w-5xl border-0 rounded-2xl shadow-2xl my-8 max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between border-b border-border bg-gradient-to-r from-primary/5 to-decision-purple/5 p-6">
          <div>
            <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
              <Building2 className="h-6 w-6 text-primary" />
              {building.name}
            </h2>
            <p className="text-sm text-muted-foreground">
              Manage building details, users, and documents
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
              onClick={() => setActiveTab("settings")}
              className={`pb-3 px-1 font-medium text-sm transition-colors ${
                activeTab === "settings"
                  ? "border-b-2 border-primary text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Settings className="h-4 w-4 inline mr-2" />
              Settings
            </button>
            <button
              onClick={() => setActiveTab("users")}
              className={`pb-3 px-1 font-medium text-sm transition-colors ${
                activeTab === "users"
                  ? "border-b-2 border-primary text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Users className="h-4 w-4 inline mr-2" />
              Users ({buildingUsers.length})
            </button>
            <button
              onClick={() => setActiveTab("documents")}
              className={`pb-3 px-1 font-medium text-sm transition-colors ${
                activeTab === "documents"
                  ? "border-b-2 border-primary text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <FileText className="h-4 w-4 inline mr-2" />
              Documents
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
                  {/* Stats Cards */}
                  <div className="grid grid-cols-3 gap-4">
                    <Card className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
                      <div className="flex items-center gap-3">
                        <div className="p-3 bg-blue-500 rounded-lg">
                          <Users className="h-6 w-6 text-white" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-blue-900">{buildingUsers.length}</p>
                          <p className="text-sm text-blue-700">Users</p>
                        </div>
                      </div>
                    </Card>

                    <Card className="p-4 bg-gradient-to-br from-green-50 to-green-100 border-green-200">
                      <div className="flex items-center gap-3">
                        <div className="p-3 bg-green-500 rounded-lg">
                          <FileText className="h-6 w-6 text-white" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-green-900">{meetingsCount}</p>
                          <p className="text-sm text-green-700">Meetings</p>
                        </div>
                      </div>
                    </Card>

                    <Card className="p-4 bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
                      <div className="flex items-center gap-3">
                        <div className="p-3 bg-purple-500 rounded-lg">
                          <Home className="h-6 w-6 text-white" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-purple-900">
                            <span className={`text-base px-2 py-1 rounded ${getBuildingTypeColor(formData.building_type)}`}>
                              {formData.building_type}
                            </span>
                          </p>
                          <p className="text-sm text-purple-700">Type</p>
                        </div>
                      </div>
                    </Card>
                  </div>

                  {/* Building Info */}
                  <div className="grid grid-cols-2 gap-4">
                    <Card className="p-4">
                      <h3 className="font-semibold text-foreground mb-3">Building Details</h3>
                      <div className="space-y-2">
                        <div>
                          <p className="text-xs text-muted-foreground">Address</p>
                          <p className="text-sm text-foreground">{building.address || "No address set"}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Property Manager</p>
                          <p className="text-sm text-foreground">{propertyManager?.name || "Not assigned"}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Company</p>
                          <p className="text-sm text-foreground">{company?.name || "Not assigned"}</p>
                        </div>
                      </div>
                    </Card>

                    <Card className="p-4">
                      <h3 className="font-semibold text-foreground mb-3">Recent Activity</h3>
                      <div className="space-y-2">
                        <div>
                          <p className="text-xs text-muted-foreground">Created</p>
                          <p className="text-sm text-foreground">{new Date(building.created_at).toLocaleDateString()}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Total Meetings</p>
                          <p className="text-sm text-foreground">{meetingsCount}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Documents</p>
                          <p className="text-sm text-foreground">{hasDocument ? "✓ Rules uploaded" : "No documents"}</p>
                        </div>
                      </div>
                    </Card>
                  </div>
                </div>
              )}

              {/* Settings Tab */}
              {activeTab === "settings" && (
                <div className="space-y-4">
                  {error && (
                    <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded text-sm">
                      {error}
                    </div>
                  )}

                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-foreground">Building Settings</h3>
                    {!editMode ? (
                      <Button
                        onClick={() => setEditMode(true)}
                        size="sm"
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                      >
                        <Edit2 className="h-4 w-4 mr-2" />
                        Edit Settings
                      </Button>
                    ) : null}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Building Name *
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      disabled={!editMode}
                      className="w-full px-3 py-2 bg-background text-foreground rounded border border-border focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Address
                    </label>
                    <textarea
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      disabled={!editMode}
                      rows={2}
                      className="w-full px-3 py-2 bg-background text-foreground rounded border border-border focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none disabled:opacity-50"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Building Type *
                    </label>
                    <select
                      value={formData.building_type}
                      onChange={(e) => setFormData({ ...formData, building_type: e.target.value as any })}
                      disabled={!editMode}
                      className="w-full px-3 py-2 bg-background text-foreground rounded border border-border focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
                    >
                      <option value="Strata/Condo">Strata/Condo</option>
                      <option value="Rental">Rental Building</option>
                      <option value="Housing Co-op">Housing Co-op</option>
                    </select>
                  </div>

                  {editMode && (
                    <div className="flex gap-2 pt-4">
                      <Button
                        onClick={() => {
                          setEditMode(false)
                          setFormData({
                            name: building.name,
                            address: building.address || "",
                            building_type: (building.building_type as any) || "Strata/Condo"
                          })
                          setError(null)
                        }}
                        variant="outline"
                        className="flex-1"
                        disabled={saving}
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleUpdateSettings}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                        disabled={saving}
                      >
                        {saving ? "Saving..." : "Save Changes"}
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* Users Tab */}
              {activeTab === "users" && (
                <div className="space-y-4">
                  {error && (
                    <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded text-sm">
                      {error}
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-foreground">Manage Building Users</h3>
                    <Button
                      onClick={handleSaveUsers}
                      size="sm"
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                      disabled={savingUsers}
                    >
                      {savingUsers ? "Saving..." : "Save Changes"}
                    </Button>
                  </div>

                  <div className="border border-border rounded p-4 space-y-2 max-h-96 overflow-y-auto">
                    {availableUsers.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-8">No users available</p>
                    ) : (
                      availableUsers.map((user) => (
                        <label
                          key={user.id}
                          className="flex items-center gap-3 cursor-pointer hover:bg-muted p-3 rounded transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={selectedUserIds.includes(user.id)}
                            onChange={() => toggleUser(user.id)}
                            disabled={savingUsers}
                            className="h-4 w-4 rounded border-border cursor-pointer"
                          />
                          <div className="flex-1">
                            <p className="text-sm font-medium text-foreground">{user.name}</p>
                            <p className="text-xs text-muted-foreground">{user.email}</p>
                          </div>
                          {getUserTypeBadge(user.user_type)}
                        </label>
                      ))
                    )}
                  </div>

                  <p className="text-xs text-muted-foreground">
                    {selectedUserIds.length} user{selectedUserIds.length !== 1 ? 's' : ''} selected
                  </p>
                </div>
              )}

              {/* Documents Tab */}
              {activeTab === "documents" && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-foreground">Building Documents</h3>
                  
                  <Card className="p-6 text-center">
                    <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground mb-4">
                      {hasDocument ? "Document management coming soon" : "No documents uploaded yet"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Use the "Manage Documents" button in the Buildings tab for now
                    </p>
                  </Card>
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
