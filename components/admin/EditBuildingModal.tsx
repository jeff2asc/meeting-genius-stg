"use client"

import { useState, useEffect } from "react"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { supabase, getVotingParameters } from "@/lib/supabase"
import { triggerJanusResync } from "@/lib/janus"

// Common IANA timezones — grouped for easy selection
const TIMEZONE_OPTIONS = [
  // Canada
  { value: "America/Vancouver",   label: "Pacific Time — Vancouver (PT)" },
  { value: "America/Edmonton",    label: "Mountain Time — Edmonton (MT)" },
  { value: "America/Winnipeg",    label: "Central Time — Winnipeg (CT)" },
  { value: "America/Toronto",     label: "Eastern Time — Toronto (ET)" },
  { value: "America/Halifax",     label: "Atlantic Time — Halifax (AT)" },
  { value: "America/St_Johns",    label: "Newfoundland Time — St. John's (NT)" },
  // USA
  { value: "America/Los_Angeles", label: "Pacific Time — Los Angeles (PT)" },
  { value: "America/Denver",      label: "Mountain Time — Denver (MT)" },
  { value: "America/Chicago",     label: "Central Time — Chicago (CT)" },
  { value: "America/New_York",    label: "Eastern Time — New York (ET)" },
  { value: "America/Phoenix",     label: "Arizona — Phoenix (no DST)" },
  { value: "Pacific/Honolulu",    label: "Hawaii — Honolulu (HT)" },
  { value: "America/Anchorage",   label: "Alaska — Anchorage (AKT)" },
  // International
  { value: "Europe/London",       label: "London (GMT/BST)" },
  { value: "Europe/Paris",        label: "Paris / Berlin (CET)" },
  { value: "Asia/Dubai",          label: "Dubai (GST)" },
  { value: "Asia/Singapore",      label: "Singapore (SGT)" },
  { value: "Asia/Manila",         label: "Manila (PHT)" },
  { value: "Asia/Tokyo",          label: "Tokyo (JST)" },
  { value: "Australia/Sydney",    label: "Sydney (AEST)" },
  { value: "Pacific/Auckland",    label: "Auckland (NZST)" },
  { value: "UTC",                 label: "UTC" },
]

interface Building {
  id: number
  name: string
  address: string | null
  city: string | null
  province: string | null
  postal_code: string | null
  country: string | null
  manager_id: number
  building_type?: string
  timezone?: string | null
  created_at: string
  users?: Array<{ id: number; name: string; email: string }>
}

interface EditBuildingModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  building: Building | null
  availableUsers: Array<{ id: number; name: string; email: string }>
  currentUser?: any
}

export default function EditBuildingModal({
  isOpen,
  onClose,
  onSuccess,
  building,
  availableUsers,
  currentUser
}: EditBuildingModalProps) {
  const [buildingFormData, setBuildingFormData] = useState({
    name: "",
    address: "",
    city: "",
    province: "",
    postalCode: "",
    country: ""
  })
  const [buildingType, setBuildingType] = useState<string>("")
  const [timezone, setTimezone] = useState<string>("America/Vancouver")
  const [selectedBuildingUsers, setSelectedBuildingUsers] = useState<number[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [buildingTypes, setBuildingTypes] = useState<string[]>([])

  useEffect(() => {
    if (isOpen) {
      const fetchTypes = async () => {
        const params = await getVotingParameters(currentUser?.company_id)
        const types = (params as Array<{ parameter_type: string; value: string }>)
          .filter(p => p.parameter_type === 'building_type')
          .map(p => p.value)
        setBuildingTypes([...new Set(types)] as string[])
      }
      fetchTypes()
    }
  }, [isOpen, currentUser])

  useEffect(() => {
    if (building) {
      setBuildingFormData({
        name: building.name,
        address: building.address || "",
        city: building.city || "",
        province: building.province || "",
        postalCode: building.postal_code || "",
        country: building.country || "Canada"
      })
      setBuildingType(building.building_type || "")
      setTimezone(building.timezone || "America/Vancouver")
      setSelectedBuildingUsers(building.users?.map(u => u.id) || [])
    }
  }, [building])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setBuildingFormData(prev => ({ ...prev, [name]: value }))
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
    if (!building) return

    setError(null)
    setSaving(true)

    try {
      const { error: updateError } = await supabase
        .from('buildings')
        .update({
          name: buildingFormData.name.trim(),
          address: buildingFormData.address.trim() || null,
          city: buildingFormData.city.trim() || null,
          province: buildingFormData.province.trim() || null,
          postal_code: buildingFormData.postalCode.trim() || null,
          country: buildingFormData.country.trim() || null,
          building_type: buildingType,
          timezone: timezone || "America/Vancouver",
        })
        .eq('id', building.id)

      if (updateError) {
        console.error('Error updating building:', updateError)
        setError('Failed to update building')
        setSaving(false)
        return
      }

      await supabase
        .from('user_buildings')
        .delete()
        .eq('building_id', building.id)

      const userAssignments = selectedBuildingUsers.map(userId => ({
        user_id: userId,
        building_id: building.id
      }))

      if (userAssignments.length > 0) {
        const { error: assignError } = await supabase
          .from('user_buildings')
          .insert(userAssignments)

        if (assignError) {
          console.error('Error assigning users:', assignError)
          setError('Building updated but failed to assign users')
          setSaving(false)
          return
        }
      }

      console.log('✅ Building updated successfully')
      
      // 🔄 Notify Janus for real-time sync with actual data
      triggerJanusResync('building_updated', {
        id: building.id,
        name: buildingFormData.name.trim(),
        address: buildingFormData.address.trim(),
        city: buildingFormData.city.trim(),
        province: buildingFormData.province.trim(),
        postal_code: buildingFormData.postalCode.trim(),
        country: buildingFormData.country.trim(),
        building_type: buildingType,
        manager_id: building.manager_id
      }, 'building')

      onSuccess()
      onClose()

    } catch (err) {
      console.error('Unexpected error:', err)
      setError('An unexpected error occurred')
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen || !building) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-in fade-in overflow-y-auto p-4">
      <Card className="w-full max-w-2xl border-0 rounded-2xl shadow-2xl my-8">
        <div className="flex items-center justify-between border-b border-border bg-gradient-to-r from-primary/5 to-decision-purple/5 p-6">
          <div>
            <h2 className="text-xl font-bold text-foreground">Edit Building</h2>
            <p className="text-sm text-muted-foreground">
              Update building details and manage users
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-foreground mb-2">
                Street Address
              </label>
              <input
                type="text"
                name="address"
                value={buildingFormData.address}
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
                placeholder="City"
                disabled={saving}
                className="w-full px-3 py-2 bg-background text-foreground rounded border border-border focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Province/State
              </label>
              <input
                type="text"
                name="province"
                value={buildingFormData.province}
                onChange={handleInputChange}
                placeholder="Province/State"
                disabled={saving}
                className="w-full px-3 py-2 bg-background text-foreground rounded border border-border focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Postal/Zip Code
              </label>
              <input
                type="text"
                name="postalCode"
                value={buildingFormData.postalCode}
                onChange={handleInputChange}
                placeholder="Postal Code"
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
                placeholder="Country"
                disabled={saving}
                className="w-full px-3 py-2 bg-background text-foreground rounded border border-border focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Building Type *
            </label>
            <select
              value={buildingType}
              onChange={(e) => setBuildingType(e.target.value)}
              disabled={saving}
              className="w-full px-3 py-2 bg-background text-foreground rounded border border-border focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
            >
              {buildingTypes.length > 0 ? (
                buildingTypes.map(t => <option key={t} value={t}>{t}</option>)
              ) : (
                <option value="">No types defined</option>
              )}
            </select>
            <p className="text-xs text-muted-foreground mt-1">
              Select the type of building for proper legislation handling
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Timezone
            </label>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              disabled={saving}
              className="w-full px-3 py-2 bg-background text-foreground rounded border border-border focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
            >
              {TIMEZONE_OPTIONS.map(tz => (
                <option key={tz.value} value={tz.value}>{tz.label}</option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground mt-1">
              Meeting times will be displayed in this timezone
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Manage Users
            </label>
            <div className="border border-border rounded p-4 space-y-2 max-h-48 overflow-y-auto">
              {availableUsers.length === 0 ? (
                <p className="text-sm text-muted-foreground">No users available</p>
              ) : (
                availableUsers.map((user) => (
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
                    <div className="flex-1">
                      <span className="text-sm text-foreground">{user.name}</span>
                      <span className="text-xs text-muted-foreground ml-2">({user.email})</span>
                    </div>
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
              {saving ? "Updating..." : "Update Building"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}