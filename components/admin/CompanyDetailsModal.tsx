"use client"

import { useState, useEffect } from "react"
import { X, Users, Building2, UserCheck, Home, Plus, Trash2, UserCog, Image as ImageIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import LogoTab from "./LogoTab"
import { Card } from "@/components/ui/card"
import { supabase } from "@/lib/supabase"

interface Company {
  id: number
  name: string
  created_at: string
  smtp_host: string | null
  smtp_port: number | null
  logo_url: string | null
  smtp_user: string | null
  smtp_password: string | null
  smtp_from_name: string | null
  smtp_from_email: string | null
  smtp_use_tls: boolean | null
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
  manager_id: number | null
}

type Tab = "overview" | "buildings" | "admins" | "users" | "logo"

export default function CompanyDetailsModal({
  isOpen,
  onClose,
  company
}: CompanyDetailsModalProps) {
  const [users, setUsers] = useState<User[]>([])
  const [buildings, setBuildings] = useState<Building[]>([])
  const [propertyManagers, setPropertyManagers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>("overview")

  // Add Building State
  const [showAddBuilding, setShowAddBuilding] = useState(false)
  const [newBuildingName, setNewBuildingName] = useState("")
  const [newBuildingAddress, setNewBuildingAddress] = useState("")
  const [selectedManagerId, setSelectedManagerId] = useState<number | null>(null)
  const [savingBuilding, setSavingBuilding] = useState(false)

  // Create PM inline
  const [showCreatePM, setShowCreatePM] = useState(false)
  const [newPMName, setNewPMName] = useState("")
  const [newPMEmail, setNewPMEmail] = useState("")
  const [newPMPassword, setNewPMPassword] = useState("")
  const [savingPM, setSavingPM] = useState(false)

  // Add Admin State
  const [showAddAdmin, setShowAddAdmin] = useState(false)
  const [newAdminName, setNewAdminName] = useState("")
  const [newAdminEmail, setNewAdminEmail] = useState("")
  const [newAdminPassword, setNewAdminPassword] = useState("")
  const [savingAdmin, setSavingAdmin] = useState(false)

  // ⭐ NEW: Add User State (for Users tab)
  const [showAddUser, setShowAddUser] = useState(false)
  const [newUserName, setNewUserName] = useState("")
  const [newUserEmail, setNewUserEmail] = useState("")
  const [newUserPassword, setNewUserPassword] = useState("")
  const [newUserType, setNewUserType] = useState<string>("user")
  const [savingUser, setSavingUser] = useState(false)
  const [userTypeFilter, setUserTypeFilter] = useState<string>("all")

    // SMTP form state
    const [smtpHost, setSmtpHost] = useState("")
    const [smtpPort, setSmtpPort] = useState<number | "">("")
    const [smtpUser, setSmtpUser] = useState("")
    const [smtpPassword, setSmtpPassword] = useState("")
    const [smtpFromName, setSmtpFromName] = useState("")
    const [smtpFromEmail, setSmtpFromEmail] = useState("")
    const [smtpUseTls, setSmtpUseTls] = useState(true)
    const [savingSmtp, setSavingSmtp] = useState(false)
  

  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (company && isOpen) {
      setActiveTab("overview")
      fetchCompanyData()
      fetchPropertyManagers()

      // Init SMTP form from company
      setSmtpHost(company.smtp_host || "")
      setSmtpPort(company.smtp_port ?? "")
      setSmtpUser(company.smtp_user || "")
      setSmtpPassword("") // never prefill password
      setSmtpFromName(company.smtp_from_name || "")
      setSmtpFromEmail(company.smtp_from_email || "")
      setSmtpUseTls(company.smtp_use_tls ?? true)
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
        .select('id, name, address, manager_id')
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

  const fetchPropertyManagers = async () => {
    if (!company) return
    
    const { data } = await supabase
      .from('users')
      .select('id, name, email, user_type')
      .eq('company_id', company.id)
      .eq('user_type', 'property_manager')
      .order('name')
    
    setPropertyManagers(data || [])
  }
  const fetchCompanyDetails = async () => {
    if (!company) return
    
    const { data, error } = await supabase
      .from('companies')
      .select('*')
      .eq('id', company.id)
      .single()
    
    if (error) {
      console.error('Error fetching company details:', error)
      return
    }
    
    // Update the company object with latest data
    if (data) {
      Object.assign(company, data)
    }
  }
  

  const handleCreatePM = async () => {
    if (!newPMName.trim() || !newPMEmail.trim() || !newPMPassword.trim()) {
      setError("All fields are required for new Property Manager")
      return
    }

    setSavingPM(true)
    setError(null)

    try {
      const { data: newUser, error: insertError } = await supabase
        .from('users')
        .insert({
          name: newPMName.trim(),
          email: newPMEmail.toLowerCase().trim(),
          password_hash: '$2a$10$rXqvFZnPzAMcLzCP2L4dxu7L6Y3Y5KjGNQQF6xZ4Y5Y5Y5Y5Y5Y5Y5',
          user_type: 'property_manager',
          company_id: company?.id
        })
        .select()
        .single()

      if (insertError) {
        console.error('Error creating PM:', insertError)
        setError('Failed to create property manager. Email may already exist.')
        setSavingPM(false)
        return
      }

      // Refresh and auto-select
      await fetchPropertyManagers()
      await fetchCompanyData()
      setSelectedManagerId(newUser.id)
      setNewPMName("")
      setNewPMEmail("")
      setNewPMPassword("")
      setShowCreatePM(false)
    } catch (err) {
      console.error('Unexpected error:', err)
      setError('An unexpected error occurred')
    } finally {
      setSavingPM(false)
    }
  }

  const handleAddBuilding = async () => {
    if (!newBuildingName.trim()) {
      setError("Building name is required")
      return
    }

    if (!selectedManagerId) {
      setError("Please select a property manager")
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
          company_id: company?.id,
          manager_id: selectedManagerId
        })

      if (insertError) {
        console.error('Error adding building:', insertError)
        setError('Failed to add building')
        setSavingBuilding(false)
        return
      }

      setNewBuildingName("")
      setNewBuildingAddress("")
      setSelectedManagerId(null)
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
          password_hash: '$2a$10$rXqvFZnPzAMcLzCP2L4dxu7L6Y3Y5KjGNQQF6xZ4Y5Y5Y5Y5Y5Y5Y5',
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

  // ⭐ NEW: Handle Add User (for Users tab)
  const handleAddUser = async () => {
    if (!newUserName.trim() || !newUserEmail.trim() || !newUserPassword.trim()) {
      setError("All fields are required")
      return
    }

    setSavingUser(true)
    setError(null)

    try {
      const { error: insertError } = await supabase
        .from('users')
        .insert({
          name: newUserName.trim(),
          email: newUserEmail.toLowerCase().trim(),
          password_hash: '$2a$10$rXqvFZnPzAMcLzCP2L4dxu7L6Y3Y5KjGNQQF6xZ4Y5Y5Y5Y5Y5Y5Y5',
          user_type: newUserType,
          company_id: company?.id
        })

      if (insertError) {
        console.error('Error adding user:', insertError)
        setError('Failed to add user. Email may already exist.')
        setSavingUser(false)
        return
      }

      setNewUserName("")
      setNewUserEmail("")
      setNewUserPassword("")
      setNewUserType("user")
      setShowAddUser(false)
      await fetchCompanyData()
      await fetchPropertyManagers()
    } catch (err) {
      console.error('Unexpected error:', err)
      setError('An unexpected error occurred')
    } finally {
      setSavingUser(false)
    }
  }

  const handleSaveSmtp = async () => {
    if (!company) return

    setSavingSmtp(true)
    setError(null)

    try {
      const updatePayload: any = {
        smtp_host: smtpHost.trim() || null,
        smtp_port: smtpPort === "" ? null : Number(smtpPort),
        smtp_user: smtpUser.trim() || null,
        smtp_from_name: smtpFromName.trim() || null,
        smtp_from_email: smtpFromEmail.trim() || null,
        smtp_use_tls: smtpUseTls,
      }

      // Only update password if user typed something
      if (smtpPassword.trim()) {
        updatePayload.smtp_password = smtpPassword.trim()
      }

      const { error } = await supabase
        .from("companies")
        .update(updatePayload)
        .eq("id", company.id)

      if (error) {
        console.error("Error saving SMTP:", error)
        setError("Failed to save SMTP settings")
        return
      }

      alert("✅ SMTP settings saved")
    } catch (err) {
      console.error("Unexpected error saving SMTP:", err)
      setError("An unexpected error occurred")
    } finally {
      setSavingSmtp(false)
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
      await fetchPropertyManagers()
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

  const getManagerName = (managerId: number | null) => {
    if (!managerId) return "No manager assigned"
    const manager = propertyManagers.find(pm => pm.id === managerId)
    return manager ? manager.name : "Unknown manager"
  }

  // ⭐ NEW: Filter users by type
  const getFilteredUsers = () => {
    if (userTypeFilter === "all") return users
    return users.filter(u => u.user_type === userTypeFilter)
  }

  if (!isOpen || !company) return null

  const corporateAdmins = users.filter(u => u.user_type === 'corporate_administrator')
  const filteredUsers = getFilteredUsers()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-in fade-in overflow-y-auto p-4">
      <Card className="w-full max-w-5xl border-0 rounded-2xl shadow-2xl my-8 max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between border-b border-border bg-gradient-to-r from-primary/5 to-decision-purple/5 p-6">
          <div>
            <h2 className="text-xl font-bold text-foreground">{company.name}</h2>
            <p className="text-sm text-muted-foreground">
              Manage company buildings, users, and administrators
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded hover:bg-muted transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* ⭐ UPDATED: Tabs - Added Users tab */}
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
              onClick={() => setActiveTab("users")}
              className={`pb-3 px-1 font-medium text-sm transition-colors ${
                activeTab === "users"
                  ? "border-b-2 border-primary text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Users className="h-4 w-4 inline mr-2" />
              Users ({users.length})
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
            <button
  onClick={() => setActiveTab("logo")}
  className={`pb-3 px-1 font-medium text-sm transition-colors ${
    activeTab === "logo"
      ? "border-b-2 border-primary text-primary"
      : "text-muted-foreground hover:text-foreground"
  }`}
>
  <ImageIcon className="h-4 w-4 inline mr-2" />
  Logo
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
                  <Card className="p-4 bg-muted/40 border-border">
      <h3 className="text-sm font-semibold text-foreground mb-2">
        SMTP Settings (Optional)
      </h3>
      <p className="text-xs text-muted-foreground mb-3">
        Configure email account for sending tasks and notifications. Leave blank to use system default.
      </p>

      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label className="block text-xs font-medium text-foreground mb-1">
            SMTP Host
          </label>
          <input
            type="text"
            value={smtpHost}
            onChange={(e) => setSmtpHost(e.target.value)}
            className="w-full px-2 py-1.5 rounded border border-border text-sm bg-background"
            placeholder="smtp.gmail.com"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-foreground mb-1">
            SMTP Port
          </label>
          <input
            type="number"
            value={smtpPort}
            onChange={(e) =>
              setSmtpPort(e.target.value ? Number(e.target.value) : "")
            }
            className="w-full px-2 py-1.5 rounded border border-border text-sm bg-background"
            placeholder="587"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-foreground mb-1">
            SMTP Username
          </label>
          <input
            type="text"
            value={smtpUser}
            onChange={(e) => setSmtpUser(e.target.value)}
            className="w-full px-2 py-1.5 rounded border border-border text-sm bg-background"
            placeholder="myemail@gmail.com"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-foreground mb-1">
            SMTP Password / App Password
          </label>
          <input
            type="password"
            value={smtpPassword}
            onChange={(e) => setSmtpPassword(e.target.value)}
            className="w-full px-2 py-1.5 rounded border border-border text-sm bg-background"
            placeholder="App password"
          />
          <p className="text-[10px] text-muted-foreground mt-1">
            Leave blank to keep existing password.
          </p>
        </div>

        <div>
          <label className="block text-xs font-medium text-foreground mb-1">
            From Name
          </label>
          <input
            type="text"
            value={smtpFromName}
            onChange={(e) => setSmtpFromName(e.target.value)}
            className="w-full px-2 py-1.5 rounded border border-border text-sm bg-background"
            placeholder="Ocean View Towers Management"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-foreground mb-1">
            From Email
          </label>
          <input
            type="email"
            value={smtpFromEmail}
            onChange={(e) => setSmtpFromEmail(e.target.value)}
            className="w-full px-2 py-1.5 rounded border border-border text-sm bg-background"
            placeholder="myemail@gmail.com"
          />
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <input
          id="smtp_use_tls"
          type="checkbox"
          checked={smtpUseTls}
          onChange={(e) => setSmtpUseTls(e.target.checked)}
          className="h-4 w-4"
        />
        <label htmlFor="smtp_use_tls" className="text-xs text-foreground">
          Use TLS (recommended for Gmail on port 587)
        </label>
      </div>

      <div className="mt-4 flex justify-end">
        <Button
          size="sm"
          onClick={handleSaveSmtp}
          disabled={savingSmtp}
          className="bg-gradient-to-r from-primary to-decision-purple text-primary-foreground"
        >
          {savingSmtp ? "Saving..." : "Save SMTP Settings"}
        </Button>
      </div>
    </Card>

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
                        
                        {/* Property Manager Selector */}
                        <div>
                          {!showCreatePM ? (
                            <>
                              <select
                                value={selectedManagerId || ""}
                                onChange={(e) => setSelectedManagerId(Number(e.target.value))}
                                className="w-full px-3 py-2 bg-white border border-border rounded focus:outline-none focus:ring-2 focus:ring-green-500"
                              >
                                <option value="">Select Property Manager *</option>
                                {propertyManagers.map(pm => (
                                  <option key={pm.id} value={pm.id}>
                                    {pm.name} ({pm.email})
                                  </option>
                                ))}
                              </select>
                              
                              <Button
                                type="button"
                                onClick={() => setShowCreatePM(true)}
                                size="sm"
                                variant="outline"
                                className="w-full mt-2 text-blue-600 border-blue-300 hover:bg-blue-50"
                              >
                                <Plus className="h-4 w-4 mr-2" />
                                Create New Property Manager
                              </Button>
                            </>
                          ) : (
                            <Card className="p-3 bg-blue-50 border-blue-200">
                              <h5 className="text-sm font-semibold mb-2">New Property Manager</h5>
                              <div className="space-y-2">
                                <input
                                  type="text"
                                  value={newPMName}
                                  onChange={(e) => setNewPMName(e.target.value)}
                                  placeholder="Full Name *"
                                  className="w-full px-2 py-1.5 text-sm bg-white border border-border rounded"
                                />
                                <input
                                  type="email"
                                  value={newPMEmail}
                                  onChange={(e) => setNewPMEmail(e.target.value)}
                                  placeholder="Email *"
                                  className="w-full px-2 py-1.5 text-sm bg-white border border-border rounded"
                                />
                                <input
                                  type="text"
                                  value={newPMPassword}
                                  onChange={(e) => setNewPMPassword(e.target.value)}
                                  placeholder="Password *"
                                  className="w-full px-2 py-1.5 text-sm bg-white border border-border rounded"
                                />
                                <div className="flex gap-2">
                                  <Button
                                    type="button"
                                    onClick={() => {
                                      setShowCreatePM(false)
                                      setNewPMName("")
                                      setNewPMEmail("")
                                      setNewPMPassword("")
                                    }}
                                    size="sm"
                                    variant="outline"
                                    className="flex-1"
                                  >
                                    Cancel
                                  </Button>
                                  <Button
                                    type="button"
                                    onClick={handleCreatePM}
                                    size="sm"
                                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                                    disabled={savingPM}
                                  >
                                    {savingPM ? "Creating..." : "Create PM"}
                                  </Button>
                                </div>
                              </div>
                            </Card>
                          )}
                        </div>
                        
                        <div className="flex gap-2">
                          <Button
                            onClick={() => {
                              setShowAddBuilding(false)
                              setNewBuildingName("")
                              setNewBuildingAddress("")
                              setSelectedManagerId(null)
                              setShowCreatePM(false)
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
                            disabled={savingBuilding || !selectedManagerId}
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
                                <p className="text-xs text-muted-foreground mt-1">
                                  Manager: {getManagerName(building.manager_id)}
                                </p>
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

              {/* ⭐ NEW: Users Tab */}
              {activeTab === "users" && (
                <div className="space-y-4">
                  {error && (
                    <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded text-sm">
                      {error}
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-foreground">All Company Users</h3>
                    <Button
                      onClick={() => setShowAddUser(!showAddUser)}
                      size="sm"
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add User
                    </Button>
                  </div>

                  {/* User Type Filter */}
                  <div className="flex gap-2">
                    <Button
                      onClick={() => setUserTypeFilter("all")}
                      size="sm"
                      variant={userTypeFilter === "all" ? "default" : "outline"}
                    >
                      All ({users.length})
                    </Button>
                    <Button
                      onClick={() => setUserTypeFilter("property_manager")}
                      size="sm"
                      variant={userTypeFilter === "property_manager" ? "default" : "outline"}
                    >
                      Property Managers ({users.filter(u => u.user_type === 'property_manager').length})
                    </Button>
                    <Button
                      onClick={() => setUserTypeFilter("user")}
                      size="sm"
                      variant={userTypeFilter === "user" ? "default" : "outline"}
                    >
                      Users ({users.filter(u => u.user_type === 'user').length})
                    </Button>
                    <Button
                      onClick={() => setUserTypeFilter("vendor")}
                      size="sm"
                      variant={userTypeFilter === "vendor" ? "default" : "outline"}
                    >
                      Vendors ({users.filter(u => u.user_type === 'vendor').length})
                    </Button>
                  </div>

                  {showAddUser && (
                    <Card className="p-4 bg-blue-50 border-blue-200">
                      <h4 className="font-semibold text-foreground mb-3">New User</h4>
                      <div className="space-y-3">
                        <input
                          type="text"
                          value={newUserName}
                          onChange={(e) => setNewUserName(e.target.value)}
                          placeholder="Full Name *"
                          className="w-full px-3 py-2 bg-white border border-border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <input
                          type="email"
                          value={newUserEmail}
                          onChange={(e) => setNewUserEmail(e.target.value)}
                          placeholder="Email Address *"
                          className="w-full px-3 py-2 bg-white border border-border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <input
                          type="text"
                          value={newUserPassword}
                          onChange={(e) => setNewUserPassword(e.target.value)}
                          placeholder="Temporary Password *"
                          className="w-full px-3 py-2 bg-white border border-border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <select
                          value={newUserType}
                          onChange={(e) => setNewUserType(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="user">User</option>
                          <option value="property_manager">Property Manager</option>
                          <option value="vendor">Vendor</option>
                          <option value="attendee">Attendee</option>
                        </select>
                        <div className="flex gap-2">
                          <Button
                            onClick={() => {
                              setShowAddUser(false)
                              setNewUserName("")
                              setNewUserEmail("")
                              setNewUserPassword("")
                              setNewUserType("user")
                              setError(null)
                            }}
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            disabled={savingUser}
                          >
                            Cancel
                          </Button>
                          <Button
                            onClick={handleAddUser}
                            size="sm"
                            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                            disabled={savingUser}
                          >
                            {savingUser ? "Adding..." : "Add User"}
                          </Button>
                        </div>
                      </div>
                    </Card>
                  )}

                  {filteredUsers.length === 0 ? (
                    <div className="text-center py-12 border-2 border-dashed border-border rounded-lg">
                      <UserCog className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                      <p className="text-muted-foreground">
                        {userTypeFilter === "all" ? "No users yet" : `No ${userTypeFilter.replace('_', ' ')}s yet`}
                      </p>
                      <p className="text-sm text-muted-foreground">Click "Add User" to create one</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {filteredUsers.map((user) => (
                        <Card key={user.id} className="p-4 hover:shadow-sm transition-shadow">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-blue-100 rounded-full">
                                <UserCog className="h-5 w-5 text-blue-600" />
                              </div>
                              <div>
                                <p className="font-semibold text-foreground">{user.name}</p>
                                <p className="text-sm text-muted-foreground">{user.email}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {getUserTypeBadge(user.user_type)}
                              <Button
                                onClick={() => handleDeleteUser(user.id)}
                                size="sm"
                                variant="ghost"
                                className="text-red-600 hover:bg-red-50"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
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
              {/* ⭐ Logo Tab - SEPARATE FROM ADMINISTRATORS */}
{activeTab === "logo" && company && (
  <LogoTab
    companyId={company.id}
    currentLogoUrl={company.logo_url}
    onLogoUpdate={fetchCompanyDetails}
  />
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
