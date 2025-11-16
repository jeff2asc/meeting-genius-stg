"use client"

import { useState } from "react"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { supabase, Company } from "@/lib/supabase"

interface CreateUserModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  currentUser: any
  propertyManagers: Array<{ id: number; name: string; email: string }>
  buildings: Array<{ id: number; name: string }>
  companies: Company[]
}

export default function CreateUserModal({
  isOpen,
  onClose,
  onSuccess,
  currentUser,
  propertyManagers,
  buildings,
  companies
}: CreateUserModalProps) {
  const [userFormData, setUserFormData] = useState({
    name: "",
    email: "",
    password: "",
    userType: "user" as "master" | "property_manager" | "user" | "vendor" | "attendee" | "corporate_administrator",
    assignedPmId: 0,
    companyId: 0,
  })
  const [selectedUserBuildings, setSelectedUserBuildings] = useState<number[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isMaster = currentUser?.user_type === 'master'
  const isCorporateAdmin = currentUser?.user_type === 'corporate_administrator'

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    
    // Parse numeric fields as integers
    if (name === 'assignedPmId' || name === 'companyId') {
      setUserFormData(prev => ({ ...prev, [name]: parseInt(value) || 0 }))
    } else {
      setUserFormData(prev => ({ ...prev, [name]: value }))
    }
  }

  const toggleUserBuilding = (buildingId: number) => {
    setSelectedUserBuildings(prev => 
      prev.includes(buildingId)
        ? prev.filter(id => id !== buildingId)
        : [...prev, buildingId]
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!userFormData.name.trim() || !userFormData.email.trim() || !userFormData.password.trim()) {
      setError("All fields are required")
      return
    }

    // Validation for Master creating corporate_administrator or property_manager
    if (isMaster) {
      if (userFormData.userType === 'corporate_administrator' || userFormData.userType === 'property_manager') {
        if (!userFormData.companyId || userFormData.companyId === 0) {
          setError("Please select a company for this user")
          return
        }
      }

      if (userFormData.userType === 'property_manager') {
        if (selectedUserBuildings.length === 0) {
          setError("Please select at least one building for the Property Manager")
          return
        }
      } else if (userFormData.userType === 'user') {
        if (!userFormData.assignedPmId || userFormData.assignedPmId === 0) {
          setError("Please select a Property Manager for this user")
          return
        }
      }
    }

    // Validation for Corporate Admin creating property_manager
    if (isCorporateAdmin) {
      if (userFormData.userType === 'property_manager' && selectedUserBuildings.length === 0) {
        setError("Please select at least one building for the Property Manager")
        return
      }
    }

    setSaving(true)

    try {
      // Determine company_id based on user type
      let companyIdToAssign = null
      
      if (isMaster) {
        // Master manually selects company for corporate_administrator and property_manager
        if (userFormData.userType === 'corporate_administrator' || userFormData.userType === 'property_manager') {
          companyIdToAssign = userFormData.companyId
          console.log('🏢 Assigning company_id:', companyIdToAssign, 'to', userFormData.userType)
        }
      } else if (isCorporateAdmin) {
        // Corporate Admin automatically assigns their company to new property_manager
        if (userFormData.userType === 'property_manager') {
          companyIdToAssign = currentUser.company_id
          console.log('🏢 Corporate Admin assigning their company_id:', companyIdToAssign)
        }
      } else if (currentUser?.user_type === 'property_manager') {
        // Property Manager doesn't assign company_id to regular users
        companyIdToAssign = null
      }

      console.log('📋 Creating user with data:', {
        name: userFormData.name.trim(),
        email: userFormData.email.toLowerCase().trim(),
        user_type: userFormData.userType,
        company_id: companyIdToAssign,
        assigned_pm_id: isMaster && userFormData.userType === 'user' ? userFormData.assignedPmId : null
      })

      const { data: newUser, error: userError } = await supabase
        .from('users')
        .insert({
          name: userFormData.name.trim(),
          email: userFormData.email.toLowerCase().trim(),
          password_hash: '$2a$10$rXqvFZnPzAMcLzCP2L4dxu7L6Y3Y5KjGNQQF6xZ4Y5Y5Y5Y5Y5Y5Y5',
          user_type: isMaster ? userFormData.userType : (isCorporateAdmin && userFormData.userType === 'property_manager' ? 'property_manager' : 'user'),
          company_id: companyIdToAssign,
          assigned_pm_id: isMaster && userFormData.userType === 'user' 
            ? userFormData.assignedPmId 
            : (currentUser?.user_type === 'property_manager' ? currentUser.id : null)
        })
        .select()
        .single()

      if (userError) {
        console.error('❌ Error creating user:', userError)
        setError('Failed to create user. Email may already exist.')
        setSaving(false)
        return
      }

      console.log('✅ User created successfully:', newUser)

      if (selectedUserBuildings.length > 0) {
        const buildingAssignments = selectedUserBuildings.map(buildingId => ({
          user_id: newUser.id,
          building_id: buildingId
        }))

        const { error: buildingsError } = await supabase
          .from('user_buildings')
          .insert(buildingAssignments)

        if (buildingsError) {
          console.error('Error assigning buildings:', buildingsError)
          setError('User created but failed to assign buildings')
          setSaving(false)
          return
        }

        console.log('✅ Buildings assigned successfully')
      }

      // Reset form
      setUserFormData({
        name: "",
        email: "",
        password: "",
        userType: "user",
        assignedPmId: 0,
        companyId: 0,
      })
      setSelectedUserBuildings([])
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-in fade-in overflow-y-auto p-4">
      <Card className="w-full max-w-2xl border-0 rounded-2xl shadow-2xl my-8">
        <div className="flex items-center justify-between border-b border-border bg-gradient-to-r from-primary/5 to-decision-purple/5 p-6">
          <div>
            <h2 className="text-xl font-bold text-foreground">Create New User</h2>
            <p className="text-sm text-muted-foreground">
              {isMaster ? 'Create any user type' : isCorporateAdmin ? 'Create a Property Manager or User' : 'Create a User for your team'}
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

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded text-sm">
              {error}
            </div>
          )}

          {(isMaster || isCorporateAdmin) && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                User Type *
              </label>
              <select
                name="userType"
                value={userFormData.userType}
                onChange={handleInputChange}
                disabled={saving}
                className="w-full px-3 py-2 bg-background text-foreground rounded border border-border focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
              >
                <option value="user">User</option>
                <option value="property_manager">Property Manager</option>
                {isMaster && (
                  <>
                    <option value="vendor">Vendor</option>
                    <option value="attendee">Attendee</option>
                    <option value="corporate_administrator">Corporate Administrator</option>
                  </>
                )}
              </select>
            </div>
          )}

          {!isMaster && !isCorporateAdmin && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                User Type
              </label>
              <input
                type="text"
                value="User"
                disabled
                className="w-full px-3 py-2 bg-muted text-muted-foreground rounded border border-border"
              />
              <p className="text-xs text-muted-foreground mt-1">
                This user will be assigned to you
              </p>
            </div>
          )}

          {/* Company Selection - Master only, for corporate_administrator and property_manager */}
          {isMaster && (userFormData.userType === 'corporate_administrator' || userFormData.userType === 'property_manager') && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Company *
              </label>
              <select
                name="companyId"
                value={userFormData.companyId}
                onChange={handleInputChange}
                disabled={saving}
                required
                className="w-full px-3 py-2 bg-background text-foreground rounded border border-border focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
              >
                <option value={0}>Select Company</option>
                {companies.map(company => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground mt-1">
                This user will belong to the selected company
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Full Name *
            </label>
            <input
              type="text"
              name="name"
              value={userFormData.name}
              onChange={handleInputChange}
              placeholder="John Doe"
              required
              disabled={saving}
              className="w-full px-3 py-2 bg-background text-foreground rounded border border-border focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Email Address *
            </label>
            <input
              type="email"
              name="email"
              value={userFormData.email}
              onChange={handleInputChange}
              placeholder="john@example.com"
              required
              disabled={saving}
              className="w-full px-3 py-2 bg-background text-foreground rounded border border-border focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Temporary Password *
            </label>
            <input
              type="text"
              name="password"
              value={userFormData.password}
              onChange={handleInputChange}
              placeholder="e.g., welcome123"
              required
              disabled={saving}
              className="w-full px-3 py-2 bg-background text-foreground rounded border border-border focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
            />
            <p className="text-xs text-muted-foreground mt-1">
              User will use this password to login
            </p>
          </div>

          {isMaster && userFormData.userType === 'user' && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Assign to Property Manager *
              </label>
              <select
                name="assignedPmId"
                value={userFormData.assignedPmId}
                onChange={handleInputChange}
                disabled={saving}
                required
                className="w-full px-3 py-2 bg-background text-foreground rounded border border-border focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
              >
                <option value={0}>Select Property Manager</option>
                {propertyManagers.map(pm => (
                  <option key={pm.id} value={pm.id}>
                    {pm.name} ({pm.email})
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground mt-1">
                This Property Manager will manage this user
              </p>
            </div>
          )}

          {(userFormData.userType === 'property_manager' || (!isMaster && !isCorporateAdmin)) && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Assign Buildings {userFormData.userType === 'property_manager' && '*'}
              </label>
              <div className="border border-border rounded p-4 space-y-2 max-h-48 overflow-y-auto">
                {buildings.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No buildings available
                  </p>
                ) : (
                  buildings.map((building) => (
                    <label
                      key={building.id}
                      className="flex items-center gap-2 cursor-pointer hover:bg-muted p-2 rounded"
                    >
                      <input
                        type="checkbox"
                        checked={selectedUserBuildings.includes(building.id)}
                        onChange={() => toggleUserBuilding(building.id)}
                        disabled={saving}
                        className="h-4 w-4 rounded border-border cursor-pointer"
                      />
                      <span className="text-sm text-foreground">{building.name}</span>
                    </label>
                  ))
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {userFormData.userType === 'property_manager' 
                  ? 'Property Managers need at least one building'
                  : 'Optional - You can assign buildings later'}
              </p>
            </div>
          )}

          <div className="flex gap-3 pt-4">
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
              {saving ? "Creating..." : "Create User"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}