"use client"

import { useState } from "react"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { supabase } from "@/lib/supabase"
import { isMaster as checkIsMaster, isCorporateAdmin as checkIsCorporateAdmin, isPropertyManager as checkIsPropertyManager } from "@/lib/permissions"

interface CreateBuildingModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  currentUser: any
  availableUsers: Array<{ 
    id: number
    name: string
    email: string
    user_type: string
    company_id?: number | null  // ✅ Add this - changed to accept null
  }>
}


export default function CreateBuildingModal({
  isOpen,
  onClose,
  onSuccess,
  currentUser,
  availableUsers
}: CreateBuildingModalProps) {
  const [buildingFormData, setBuildingFormData] = useState({
    name: "",
    address: "",
    managerId: checkIsPropertyManager(currentUser) && !checkIsCorporateAdmin(currentUser) && !checkIsMaster(currentUser) ? currentUser.id : 0,
  })
  const [buildingType, setBuildingType] = useState<'Strata/Condo' | 'Rental' | 'Housing Co-op'>('Strata/Condo')
  const [selectedBuildingUsers, setSelectedBuildingUsers] = useState<number[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isMaster = checkIsMaster(currentUser)
  const isCorporateAdmin = checkIsCorporateAdmin(currentUser)
  const isPropertyManager = checkIsPropertyManager(currentUser)

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setBuildingFormData(prev => ({ ...prev, [name]: name === 'managerId' ? parseInt(value) || 0 : value }))
  }

  const toggleBuildingUser = (userId: number) => {
    setSelectedBuildingUsers(prev => 
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!buildingFormData.name.trim()) {
      setError("Building name is required")
      return
    }

    if (!buildingFormData.managerId || buildingFormData.managerId === 0) {
      setError("Please select a property manager")
      return
    }

    setSaving(true)

    try {
      // Determine company_id based on user type
      let companyIdToAssign = null
      
      if (isMaster) {
        // Master needs to get company_id from the selected property manager
        const { data: pmData } = await supabase
          .from('users')
          .select('company_id')
          .eq('id', buildingFormData.managerId)
          .single()
        
        companyIdToAssign = pmData?.company_id || null
      } else if (isCorporateAdmin || isPropertyManager) {
        // Corporate Admin and Property Manager use their own company_id
        companyIdToAssign = currentUser.company_id
      }

      console.log('🏢 Creating building with company_id:', companyIdToAssign)

      const { data: newBuilding, error: buildingError } = await supabase
        .from('buildings')
        .insert({
          name: buildingFormData.name.trim(),
          address: buildingFormData.address.trim() || null,
          manager_id: buildingFormData.managerId,
          company_id: companyIdToAssign,
          building_type: buildingType,
        })
        .select()
        .single()

      if (buildingError) {
        console.error('Error creating building:', buildingError)
        setError('Failed to create building.')
        setSaving(false)
        return
      }

      // Assign property manager to building
      const { error: pmAssignError } = await supabase
        .from('user_buildings')
        .insert({
          user_id: buildingFormData.managerId,
          building_id: newBuilding.id
        })

      if (pmAssignError) {
        console.error('Error assigning property manager:', pmAssignError)
      }

      // Assign selected users to building
      if (selectedBuildingUsers.length > 0) {
        const userAssignments = selectedBuildingUsers.map(userId => ({
          user_id: userId,
          building_id: newBuilding.id
        }))

        const { error: usersError } = await supabase
          .from('user_buildings')
          .insert(userAssignments)

        if (usersError) {
          console.error('Error assigning users:', usersError)
        }
      }

      console.log('✅ Building created successfully')

      // Reset form
      setBuildingFormData({
        name: "",
        address: "",
        managerId: checkIsPropertyManager(currentUser) && !checkIsCorporateAdmin(currentUser) && !checkIsMaster(currentUser) ? currentUser.id : 0,
      })
      setBuildingType('Strata/Condo')
      setSelectedBuildingUsers([])
      onSuccess()
      onClose()

    } catch (err) {
      console.error('Unexpected error:', err)
      setError('An unexpected error occurred')
    } finally {
      setSaving(false)
    }
  }

  // Filter available property managers based on user type
  const availablePropertyManagers = isMaster 
    ? availableUsers.filter(user => user.user_type === 'property_manager')
    : isCorporateAdmin
    ? availableUsers.filter(user => user.user_type === 'property_manager' && user.company_id === currentUser.company_id)
    : []

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-in fade-in overflow-y-auto p-4">
      <Card className="w-full max-w-2xl border-0 rounded-2xl shadow-2xl my-8">
        <div className="flex items-center justify-between border-b border-border bg-gradient-to-r from-primary/5 to-decision-purple/5 p-6">
          <div>
            <h2 className="text-xl font-bold text-foreground">Create New Building</h2>
            <p className="text-sm text-muted-foreground">
              Add a new building to manage
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

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Building Name *
            </label>
            <input
              type="text"
              name="name"
              value={buildingFormData.name}
              onChange={handleInputChange}
              placeholder="e.g., Sunset Apartments"
              required
              disabled={saving}
              className="w-full px-3 py-2 bg-background text-foreground rounded border border-border focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Address
            </label>
            <input
              type="text"
              name="address"
              value={buildingFormData.address}
              onChange={handleInputChange}
              placeholder="e.g., 123 Main St, Vancouver, BC"
              disabled={saving}
              className="w-full px-3 py-2 bg-background text-foreground rounded border border-border focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Building Type *
            </label>
            <select
              value={buildingType}
              onChange={(e) => setBuildingType(e.target.value as 'Strata/Condo' | 'Rental' | 'Housing Co-op')}
              disabled={saving}
              className="w-full px-3 py-2 bg-background text-foreground rounded border border-border focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
            >
              <option value="Strata/Condo">Strata/Condo</option>
              <option value="Rental">Rental Building</option>
              <option value="Housing Co-op">Housing Co-op</option>
            </select>
            <p className="text-xs text-muted-foreground mt-1">
              Select the type of building for proper legislation handling
            </p>
          </div>

          {/* Master User - Can see all PMs */}
          {isMaster && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Property Manager *
              </label>
              <select
                name="managerId"
                value={buildingFormData.managerId}
                onChange={handleInputChange}
                disabled={saving}
                required
                className="w-full px-3 py-2 bg-background text-foreground rounded border border-border focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
              >
                <option value={0}>Select Property Manager</option>
                {availablePropertyManagers.map(pm => (
                  <option key={pm.id} value={pm.id}>
                    {pm.name} ({pm.email})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Corporate Admin - Can see PMs from their company */}
          {isCorporateAdmin && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Property Manager *
              </label>
              <select
                name="managerId"
                value={buildingFormData.managerId}
                onChange={handleInputChange}
                disabled={saving}
                required
                className="w-full px-3 py-2 bg-background text-foreground rounded border border-border focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
              >
                <option value={0}>Select Property Manager</option>
                {availablePropertyManagers.length === 0 ? (
                  <option disabled>No Property Managers available - Create one first</option>
                ) : (
                  availablePropertyManagers.map(pm => (
                    <option key={pm.id} value={pm.id}>
                      {pm.name} ({pm.email})
                    </option>
                  ))
                )}
              </select>
              <p className="text-xs text-muted-foreground mt-1">
                {availablePropertyManagers.length === 0 
                  ? '⚠️ Create a Property Manager first via Admin Panel → Users tab'
                  : 'Select from your company\'s Property Managers'}
              </p>
            </div>
          )}

          {/* Property Manager - Auto-assigned */}
          {isPropertyManager && !isCorporateAdmin && !isMaster && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Property Manager
              </label>
              <input
                type="text"
                value={currentUser?.name || 'You'}
                disabled
                className="w-full px-3 py-2 bg-muted text-muted-foreground rounded border border-border"
              />
              <p className="text-xs text-muted-foreground mt-1">
                You will be assigned as the property manager
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Assign Users (Optional)
            </label>
            <div className="border border-border rounded p-4 space-y-2 max-h-48 overflow-y-auto">
              {availableUsers.filter(u => u.user_type === 'user').length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No users available to assign
                </p>
              ) : (
                availableUsers
                  .filter(u => u.user_type === 'user')
                  .map((user) => (
                    <label
                      key={user.id}
                      className="flex items-center gap-2 cursor-pointer hover:bg-muted p-2 rounded"
                    >
                      <input
                        type="checkbox"
                        checked={selectedBuildingUsers.includes(user.id)}
                        onChange={() => toggleBuildingUser(user.id)}
                        disabled={saving}
                        className="h-4 w-4 rounded border-border cursor-pointer"
                      />
                      <span className="text-sm text-foreground">{user.name}</span>
                      <span className="text-xs text-muted-foreground">({user.email})</span>
                    </label>
                  ))
              )}
            </div>
          </div>

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
              {saving ? "Creating..." : "Create Building"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
