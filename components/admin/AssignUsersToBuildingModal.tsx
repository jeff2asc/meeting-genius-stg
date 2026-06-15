"use client"

import { useState, useEffect } from "react"
import { X, UserPlus, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"
import { triggerJanusResync } from "@/lib/janus-client"

interface Building {
  id: number
  name: string
  company_id: number | null
}

interface User {
  id: number
  name: string
  email: string
  user_type: string
  company_id: number | null
  roles?: string[] | null
}

interface AssignUsersToBuildingModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  building: Building | null
  currentUser?: any
}

export default function AssignUsersToBuildingModal({
  isOpen,
  onClose,
  onSuccess,
  building,
  currentUser
}: AssignUsersToBuildingModalProps) {
  const [availableUsers, setAvailableUsers] = useState<User[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [unitNumber, setUnitNumber] = useState("")
  const [votingWeight, setVotingWeight] = useState<number>(1)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null)

  useEffect(() => {
    if (building && isOpen) {
      fetchAvailableUsers()
    }
  }, [building, isOpen])

  const fetchAvailableUsers = async () => {
    if (!building) return

    setLoading(true)
    try {
      const isMasterUser = currentUser?.user_type === "master" || currentUser?.roles?.includes("master")

      // Fetch all users
      let query = supabase
        .from("users")
        .select("id, name, email, user_type, company_id, roles")
        .order("name")

      // Filter by company if not master user
      if (!isMasterUser && building.company_id) {
        query = query.eq("company_id", building.company_id)
      }

      const { data: usersData, error: usersError } = await query

      if (usersError) {
        console.error("Error fetching users:", usersError)
        toast.error("Failed to fetch users")
        return
      }

      setAvailableUsers(usersData || [])
    } catch (err) {
      console.error("Unexpected error:", err)
      toast.error("Failed to load users")
    } finally {
      setLoading(false)
    }
  }

  const handleAssignUser = async () => {
    if (!selectedUserId || !building) {
      toast.error("Please select a user")
      return
    }

    setSaving(true)
    try {
      // Check if assignment already exists
      let existingQuery = supabase
        .from("user_buildings")
        .select("id")
        .eq("building_id", building.id)
        .eq("user_id", selectedUserId)

      if (unitNumber) {
        existingQuery = existingQuery.eq("unit_number", unitNumber)
      } else {
        existingQuery = existingQuery.is("unit_number", null)
      }

      const { data: existingAssignment } = await existingQuery.maybeSingle()

      if (existingAssignment) {
        toast.error("This user is already assigned to this building/unit")
        setSaving(false)
        return
      }

      // Insert new assignment
      const { error } = await supabase
        .from("user_buildings")
        .insert({
          building_id: building.id,
          user_id: selectedUserId,
          unit_number: unitNumber || null,
          voting_weight: votingWeight || 1
        })

      if (error) {
        console.error("Error assigning user:", error)
        toast.error("Failed to assign user to building")
        setSaving(false)
        return
      }

      toast.success("User assigned to building successfully")
      
      // Trigger Janus resync for real-time updates
      triggerJanusResync("user_added_to_building", {
        building_id: building.id,
        user_id: selectedUserId
      })

      // Reset form
      setSelectedUserId(null)
      setUnitNumber("")
      setVotingWeight(1)
      setSearchQuery("")

      await onSuccess()
    } catch (err) {
      console.error("Unexpected error:", err)
      toast.error("Failed to assign user")
    } finally {
      setSaving(false)
    }
  }

  const getUserTypeDisplay = (userType: string) => {
    switch (userType) {
      case "resident":
        return { label: "🏠 Resident", className: "bg-green-100 text-green-800 border border-green-200" }
      case "owner":
        return { label: "👤 Owner", className: "bg-blue-100 text-blue-800 border border-blue-200" }
      case "property_manager":
        return { label: "🏢 Property Manager", className: "bg-purple-100 text-purple-800 border border-purple-200" }
      case "corporate_administrator":
        return { label: "🏛️ Corporate Admin", className: "bg-orange-100 text-orange-800 border border-orange-200" }
      case "master":
        return { label: "⭐ Master", className: "bg-red-100 text-red-800 border border-red-200" }
      default:
        return {
          label: userType.replace("_", " ").charAt(0).toUpperCase() + userType.slice(1).replace("_", " "),
          className: "bg-gray-100 text-gray-800 border border-gray-200"
        }
    }
  }

  const filteredUsers = availableUsers.filter((user) => {
    const searchLower = searchQuery.toLowerCase()
    return (
      user.name.toLowerCase().includes(searchLower) ||
      user.email.toLowerCase().includes(searchLower)
    )
  })

  if (!isOpen || !building) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 animate-in fade-in">
      <Card className="w-full sm:max-w-2xl border-0 rounded-t-2xl sm:rounded-2xl shadow-2xl sm:my-8 max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between border-b border-border bg-gradient-to-r from-primary/5 to-decision-purple/5 p-4 sm:p-6 flex-shrink-0">
          <div className="min-w-0">
            <h2 className="text-lg sm:text-xl font-bold text-foreground">Add User to Building</h2>
            <p className="text-xs sm:text-sm text-muted-foreground truncate">
              Assign a user to {building.name}
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded hover:bg-muted transition-colors flex-shrink-0"
            disabled={saving}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-5">
          {loading ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Loading users...</p>
            </div>
          ) : (
            <>
              {/* User Selection */}
              <div>
                <Label htmlFor="userSearch">Select User *</Label>
                <div className="relative mt-2">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="userSearch"
                    placeholder="Search by name or email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>

                {/* User List */}
                <div className="mt-3 border border-border rounded-lg max-h-48 sm:max-h-64 overflow-y-auto">
                  {filteredUsers.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-sm text-muted-foreground">
                        {searchQuery ? "No users found matching your search" : "No users available"}
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y divide-border">
                      {filteredUsers.map((user) => (
                        <button
                          key={user.id}
                          type="button"
                          onClick={() => setSelectedUserId(user.id)}
                          className={`w-full text-left p-3 hover:bg-muted/50 transition-colors ${
                            selectedUserId === user.id ? "bg-primary/10 border-l-4 border-primary" : ""
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <p className="font-medium text-foreground text-sm">{user.name}</p>
                              <p className="text-xs text-muted-foreground">{user.email}</p>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {Array.from(new Set([user.user_type, ...(user.roles || [])])).map((role) => {
                                  const typeDisplay = getUserTypeDisplay(role)
                                  return (
                                    <span
                                      key={role}
                                      className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${typeDisplay.className}`}
                                    >
                                      {typeDisplay.label}
                                    </span>
                                  )
                                })}
                              </div>
                            </div>
                            {selectedUserId === user.id && (
                              <div className="ml-2 flex items-center justify-center w-5 h-5 rounded-full bg-primary">
                                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              </div>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Unit Number */}
              <div>
                <Label htmlFor="unitNumber">Unit Number (Optional)</Label>
                <Input
                  id="unitNumber"
                  placeholder="e.g., 101, A-5, etc."
                  value={unitNumber}
                  onChange={(e) => setUnitNumber(e.target.value)}
                  className="mt-2"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Leave blank if user doesn't belong to a specific unit
                </p>
              </div>

              {/* Voting Weight */}
              <div>
                <Label htmlFor="votingWeight">Voting Weight</Label>
                <Input
                  id="votingWeight"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="1"
                  value={votingWeight}
                  onChange={(e) => setVotingWeight(parseFloat(e.target.value) || 1)}
                  className="mt-2"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Default is 1. Adjust for weighted voting scenarios.
                </p>
              </div>
            </>
          )}
        </div>

        <div className="border-t border-border p-4 sm:p-6 flex gap-3 flex-shrink-0">
          <Button variant="outline" onClick={onClose} disabled={saving} className="flex-1">
            Cancel
          </Button>
          <Button
            onClick={handleAssignUser}
            disabled={saving || !selectedUserId}
            className="flex-1 bg-gradient-to-r from-primary to-decision-purple text-primary-foreground"
          >
            {saving ? "Assigning..." : "Assign User"}
          </Button>
        </div>
      </Card>
    </div>
  )
}
