"use client"

import { useState } from "react"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { supabase } from "@/lib/supabase"
import { fetchVotingParametersAction } from "@/lib/api-actions"
import { isMaster as checkIsMaster, isCorporateAdmin as checkIsCorporateAdmin, isPropertyManager as checkIsPropertyManager } from "@/lib/permissions"
import { triggerJanusResync } from "@/lib/janus-client"
import { useEffect } from "react"

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
    company_id?: number | null
  }>
  preselectedManagerId?: number
  preselectedCompanyId?: number
  existingBuildings?: any[]
  archivedBuildings?: any[]
}


export default function CreateBuildingModal({
  isOpen,
  onClose,
  onSuccess,
  currentUser,
  availableUsers,
  preselectedManagerId,
  preselectedCompanyId,
  existingBuildings = [],
  archivedBuildings = []
}: CreateBuildingModalProps) {
  const [buildingFormData, setBuildingFormData] = useState({
    name: "",
    street: "",
    city: "",
    province: "",
    postalCode: "",
    country: "Canada",
    managerId: preselectedManagerId !== undefined ? preselectedManagerId : (checkIsPropertyManager(currentUser) && !checkIsCorporateAdmin(currentUser) && !checkIsMaster(currentUser) ? currentUser.id : 0),
  })
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(preselectedCompanyId || null)
  const [companies, setCompanies] = useState<any[]>([])
  const [buildingType, setBuildingType] = useState<'Strata/Condo' | 'Rental' | 'Housing Co-op'>('Strata/Condo')
  const [selectedBuildingUsers, setSelectedBuildingUsers] = useState<number[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [buildingTypes, setBuildingTypes] = useState<string[]>([])
  const [buildingTimezone, setBuildingTimezone] = useState("America/Vancouver")

  const [isFirstRender, setIsFirstRender] = useState(true)

  const isMaster = checkIsMaster(currentUser)
  const isCorporateAdmin = checkIsCorporateAdmin(currentUser)
  const isPropertyManager = checkIsPropertyManager(currentUser)

  useEffect(() => {
    if (isOpen) {
      fetchBuildingTypes()
      fetchCompanies()
      setIsFirstRender(true)

      // Sync with preselected props when modal opens
      if (preselectedCompanyId !== undefined) {
        setSelectedCompanyId(preselectedCompanyId)
      }
      if (preselectedManagerId !== undefined) {
        setBuildingFormData(prev => ({ ...prev, managerId: preselectedManagerId }))
      } else if (isPropertyManager && !isCorporateAdmin && !isMaster) {
        setBuildingFormData(prev => ({ ...prev, managerId: currentUser.id }))
      }
    }
  }, [isOpen, preselectedCompanyId, preselectedManagerId])

  useEffect(() => {
    if (isMaster) {
      if (isFirstRender) {
        setIsFirstRender(false)
        return
      }
      // Reset PM and assigned users whenever company changes
      setBuildingFormData(prev => ({ ...prev, managerId: 0 }))
      setSelectedBuildingUsers([])
    }
  }, [selectedCompanyId, isMaster])

  const fetchCompanies = async () => {
    if (!isMaster) return
    const { data } = await supabase.from('companies').select('id, name').order('name')
    setCompanies(data || [])
  }

  const fetchBuildingTypes = async () => {
    const params = await fetchVotingParametersAction(currentUser?.company_id)
    const types = (params as Array<{ parameter_type: string; value: string }>)
      .filter(p => p.parameter_type === 'building_type')
      .map(p => p.value)
    setBuildingTypes([...new Set(types)] as string[])
  }

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

    // Determine companyId early for validation
    let companyIdToAssign = selectedCompanyId
    if (isMaster) {
      // Use selected company ID directly
    } else if (isCorporateAdmin || isPropertyManager) {
      companyIdToAssign = currentUser.company_id
    }

    // Check for duplicate names within the same company
    const newName = buildingFormData.name.trim().toLowerCase()
    const isDuplicate = [...existingBuildings, ...archivedBuildings].some(b => 
      b.name.trim().toLowerCase() === newName && 
      b.company_id === companyIdToAssign
    )

    if (isDuplicate) {
      setError(`A building named "${buildingFormData.name}" already exists for this company. Please choose a different name.`)
      return
    }

    setSaving(true)

    try {
      console.log('🏢 Creating building with company_id:', companyIdToAssign)

      const combinedAddress = [
        buildingFormData.street.trim(),
        buildingFormData.city.trim(),
        buildingFormData.province.trim(),
        buildingFormData.postalCode.trim(),
        buildingFormData.country.trim()
      ].filter(Boolean).join(', ')

      const { data: newBuilding, error: buildingError } = await supabase
        .from('buildings')
        .insert({
          name: buildingFormData.name.trim(),
          address: combinedAddress || null,
          manager_id: buildingFormData.managerId,
          company_id: companyIdToAssign,
          building_type: buildingType,
          primary_color: '#3b82f6',
          timezone: buildingTimezone || 'America/Vancouver',
        })
        .select()
        .single()

      if (buildingError) {
        console.error('Detailed Error creating building:', buildingError)
        
        // Handle 409 Conflict (Duplicate Name or Constraint Violation)
        if (buildingError.code === '23505') {
          setError(`Conflict: ${buildingError.details || 'The building name or ID already exists.'} If this is an ID conflict, please reset database sequences.`)
        } else {
          setError(`Failed to create building: ${buildingError.message}${buildingError.details ? ` (${buildingError.details})` : ''}`)
        }
        
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
        setError(`Building created, but failed to assign property manager: ${pmAssignError.message}`)
        setSaving(false)
        return
      }

      // Assign selected users to building (excluding the manager who was already added above)
      const otherUsersToAssign = selectedBuildingUsers.filter(id => id !== buildingFormData.managerId)
      
      if (otherUsersToAssign.length > 0) {
        const userAssignments = otherUsersToAssign.map(userId => ({
          user_id: userId,
          building_id: newBuilding.id
        }))

        const { error: usersError } = await supabase
          .from('user_buildings')
          .insert(userAssignments)

        if (usersError) {
          console.error('Error assigning users:', usersError)
          setError(`Building created, but failed to assign some users: ${usersError.message}`)
          setSaving(false)
          return
        }
      }

      console.log('✅ Building created successfully')

      // 🔄 Notify Janus for real-time sync with actual data
      triggerJanusResync('building_created', newBuilding, 'building')

      // Reset form
      setBuildingFormData({
        name: "",
        street: "",
        city: "",
        province: "",
        postalCode: "",
        country: "Canada",
        managerId: preselectedManagerId !== undefined ? preselectedManagerId : (checkIsPropertyManager(currentUser) && !checkIsCorporateAdmin(currentUser) && !checkIsMaster(currentUser) ? currentUser.id : 0),
      })
      setBuildingType('Strata/Condo')
      setSelectedBuildingUsers([])
      setBuildingTimezone('America/Vancouver')
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

  // Filter available property managers based on user type and selected company
  // Use Number() coercion to avoid type mismatches between string and number IDs
  const availablePropertyManagers = isMaster
    ? availableUsers.filter((user: any) =>
      (user.user_type === 'property_manager' || (Array.isArray(user.roles) && user.roles.includes('property_manager'))) &&
      (selectedCompanyId !== null
        ? Number(user.company_id) === Number(selectedCompanyId)
        : user.company_id === null || user.company_id === undefined)
    )
    : isCorporateAdmin
      ? availableUsers.filter((user: any) =>
        (user.user_type === 'property_manager' || (Array.isArray(user.roles) && user.roles.includes('property_manager'))) &&
        Number(user.company_id) === Number(currentUser.company_id)
      )
      : []

  // Filter available users to assign based on the selected company
  // Use Number() coercion to avoid type mismatches between string and number IDs
  const filteredAvailableUsers = isMaster
    ? availableUsers.filter((user: any) =>
        selectedCompanyId !== null
          ? Number(user.company_id) === Number(selectedCompanyId)
          : user.company_id === null || user.company_id === undefined
      )
    : isCorporateAdmin || isPropertyManager
      ? availableUsers.filter((user: any) => Number(user.company_id) === Number(currentUser.company_id))
      : []

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-in fade-in p-4 overflow-y-auto">
      <Card className="w-full max-w-2xl border-0 rounded-2xl shadow-2xl my-auto flex flex-col max-h-[95vh] overflow-hidden">
        <div className="flex-shrink-0 flex items-center justify-between border-b border-border bg-gradient-to-r from-primary/5 to-decision-purple/5 p-6">
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

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-foreground mb-2">
                  Street Address
                </label>
                <input
                  type="text"
                  name="street"
                  value={buildingFormData.street}
                  onChange={handleInputChange}
                  placeholder="e.g., 123 Main St"
                  disabled={saving}
                  className="w-full px-3 py-2 bg-background text-foreground rounded border border-border focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  City
                </label>
                <input
                  type="text"
                  name="city"
                  value={buildingFormData.city}
                  onChange={handleInputChange}
                  placeholder="e.g., Vancouver"
                  disabled={saving}
                  className="w-full px-3 py-2 bg-background text-foreground rounded border border-border focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Province / State
                </label>
                <input
                  type="text"
                  name="province"
                  value={buildingFormData.province}
                  onChange={handleInputChange}
                  placeholder="e.g., BC"
                  disabled={saving}
                  className="w-full px-3 py-2 bg-background text-foreground rounded border border-border focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Postal / Zip Code
                </label>
                <input
                  type="text"
                  name="postalCode"
                  value={buildingFormData.postalCode}
                  onChange={handleInputChange}
                  placeholder="e.g., V6B 1A1"
                  disabled={saving}
                  className="w-full px-3 py-2 bg-background text-foreground rounded border border-border focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Country
                </label>
                <input
                  type="text"
                  name="country"
                  value={buildingFormData.country}
                  onChange={handleInputChange}
                  placeholder="e.g., Canada"
                  disabled={saving}
                  className="w-full px-3 py-2 bg-background text-foreground rounded border border-border focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
                />
              </div>
            </div>

            {/* Timezone */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Building Timezone
              </label>
              <p className="text-xs text-muted-foreground mb-2">
                Meeting times will display in this timezone for all users.
              </p>
              <select
                value={buildingTimezone}
                onChange={(e) => setBuildingTimezone(e.target.value)}
                disabled={saving}
                className="w-full px-3 py-2 bg-background text-foreground rounded border border-border focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
              >
                <option value="America/Vancouver">Pacific Time — Vancouver / Victoria (PT)</option>
                <option value="America/Edmonton">Mountain Time — Calgary / Edmonton (MT)</option>
                <option value="America/Winnipeg">Central Time — Winnipeg (CT)</option>
                <option value="America/Toronto">Eastern Time — Toronto / Ottawa (ET)</option>
                <option value="America/Halifax">Atlantic Time — Halifax (AT)</option>
                <option value="America/St_Johns">Newfoundland Time — St. John's (NT)</option>
                <option value="America/New_York">Eastern Time — New York (ET)</option>
                <option value="America/Chicago">Central Time — Chicago (CT)</option>
                <option value="America/Denver">Mountain Time — Denver (MT)</option>
                <option value="America/Los_Angeles">Pacific Time — Los Angeles (PT)</option>
                <option value="America/Phoenix">Mountain Time (no DST) — Phoenix (MT)</option>
                <option value="America/Anchorage">Alaska Time — Anchorage (AKT)</option>
                <option value="Pacific/Honolulu">Hawaii Time — Honolulu (HT)</option>
                <option value="Europe/London">Greenwich Mean Time — London (GMT/BST)</option>
                <option value="Europe/Paris">Central European Time — Paris / Berlin (CET)</option>
                <option value="Asia/Dubai">Gulf Standard Time — Dubai (GST)</option>
                <option value="Asia/Singapore">Singapore Time (SGT)</option>
                <option value="Asia/Manila">Philippine Time — Manila (PHT)</option>
                <option value="Asia/Tokyo">Japan Standard Time — Tokyo (JST)</option>
                <option value="Australia/Sydney">Australian Eastern Time — Sydney (AEST)</option>
                <option value="Pacific/Auckland">New Zealand Time — Auckland (NZST)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Building Type *
              </label>
              <select
                value={buildingType}
                onChange={(e) => setBuildingType(e.target.value as any)}
                disabled={saving}
                className="w-full px-3 py-2 bg-background text-foreground rounded border border-border focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
              >
                {buildingTypes.length > 0 ? (
                  buildingTypes.map(t => <option key={t} value={t}>{t}</option>)
                ) : (
                  <option value="">No types defined in Voting Settings</option>
                )}
              </select>
              <p className="text-xs text-muted-foreground mt-1">
                Select the type of building for proper legislation handling
              </p>
            </div>

            {/* Master User - Can see all PMs and Companies */}
            {isMaster ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Company Assignment
                  </label>
                  <select
                    value={selectedCompanyId || "none"}
                    onChange={(e) => setSelectedCompanyId(e.target.value === "none" ? null : parseInt(e.target.value))}
                    disabled={saving}
                    className="w-full px-3 py-2 bg-background text-foreground rounded border border-border focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
                  >
                    <option value="none">No Company (Internal)</option>
                    {companies.map((c: any) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Property Manager *
                  </label>
                  <select
                    name="managerId"
                    value={buildingFormData.managerId}
                    onChange={handleInputChange}
                    disabled={saving || !selectedCompanyId}
                    required
                    className="w-full px-3 py-2 bg-background text-foreground rounded border border-border focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
                  >
                    <option value={0}>
                      {!selectedCompanyId
                        ? '— Select a company first —'
                        : availablePropertyManagers.length === 0
                          ? 'No Property Managers in this company'
                          : 'Select Property Manager'}
                    </option>
                    {availablePropertyManagers.map((pm: any) => (
                      <option key={pm.id} value={pm.id}>
                        {pm.name} ({pm.email})
                      </option>
                    ))}
                  </select>
                  {selectedCompanyId && availablePropertyManagers.length === 0 && (
                    <p className="text-xs text-amber-600 mt-1">
                      ⚠️ No Property Managers found for this company. Create one first via Users tab.
                    </p>
                  )}
                  {!selectedCompanyId && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Select a company above to see its Property Managers.
                    </p>
                  )}
                </div>
              </div>
            ) : (
              (isCorporateAdmin || isPropertyManager) && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">
                      Company Assignment
                    </label>
                    <div className="w-full px-3 py-2 bg-muted/50 text-primary font-bold rounded border border-dashed border-border text-sm">
                      {companies.find(c => c.id === currentUser?.company_id)?.name || "Your Company"}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1 italic">Building will be automatically assigned to your company</p>
                  </div>
                </div>
              )
            )}

            {/* Corporate Admin - Can see PMs from their company */}
            {isCorporateAdmin && !isMaster && (
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
                    availablePropertyManagers.map((pm: any) => (
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
                {filteredAvailableUsers.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No users available to assign
                  </p>
                ) : (
                  filteredAvailableUsers
                    .map((user: any) => (
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

          </div>

          <div className="flex-shrink-0 border-t border-border p-6 bg-muted/5 flex gap-3">
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
