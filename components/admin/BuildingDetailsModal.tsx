"use client"

import { useState, useEffect } from "react"
import { X, Building2, Users, FileText, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { supabase } from "@/lib/supabase"

interface User {
  id: number
  name: string
  email: string
  user_type: string
  company_id: number | null
}

interface Building {
  id: number
  name: string
  address: string | null
  manager_id: number
  company_id: number | null
  building_type?: string
  created_at: string
  users?: Array<{ id: number; name: string; email: string; user_type: string }>
}

interface BuildingDetailsModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  building: Building | null
  availableUsers: User[]
}

type TabType = "details" | "users" | "documents"

export default function BuildingDetailsModal({
  isOpen,
  onClose,
  onSuccess,
  building,
  availableUsers,
}: BuildingDetailsModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>("details")
  const [buildingName, setBuildingName] = useState("")
  const [buildingAddress, setBuildingAddress] = useState("")
  const [buildingType, setBuildingType] = useState("")
  const [managerId, setManagerId] = useState<number | null>(null)
  const [selectedUsers, setSelectedUsers] = useState<number[]>([])
  const [propertyManagers, setPropertyManagers] = useState<User[]>([])
  const [submitting, setSubmitting] = useState(false)

  // inline “add user” state (like CompanyDetailsModal)
  const [showAddUserForm, setShowAddUserForm] = useState(false)
  const [newUserName, setNewUserName] = useState("")
  const [newUserEmail, setNewUserEmail] = useState("")
  const [newUserPassword, setNewUserPassword] = useState("")
  const [creatingUser, setCreatingUser] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen && building) {
      setBuildingName(building.name)
      setBuildingAddress(building.address || "")
      setBuildingType(building.building_type || "Strata/Condo")
      setManagerId(building.manager_id)
      setSelectedUsers(building.users?.map((u) => u.id) || [])
      setActiveTab("details")
      fetchPropertyManagers()
    }
  }, [isOpen, building])

  const fetchPropertyManagers = async () => {
    if (!building) return

    try {
      let query = supabase
        .from("users")
        .select("id, name, email, user_type, company_id")
        .eq("user_type", "property_manager")
        .order("name")

      if (building.company_id) {
        query = query.eq("company_id", building.company_id)
      }

      const { data, error } = await query

      if (error) {
        console.error("Error fetching property managers:", error)
        return
      }

      setPropertyManagers((data || []) as User[])
    } catch (err) {
      console.error("Unexpected error:", err)
    }
  }

  // Create user inline in this company & assign to building
  const handleCreateNewUser = async () => {
    if (!building) return

    if (!newUserName.trim() || !newUserEmail.trim() || !newUserPassword.trim()) {
      setError("Name, email and password are required")
      return
    }

    setCreatingUser(true)
    setError(null)

    try {
      // Mirror the pattern from CompanyDetailsModal: insert into users with a password_hash
      const { data: newUser, error: userError } = await supabase
        .from("users")
        .insert({
          name: newUserName.trim(),
          email: newUserEmail.toLowerCase().trim(),
          // placeholder hash, same idea as in CompanyDetailsModal
          password_hash:
            "$2a$10$rXqvFZnPzAMcLzCP2L4dxu7L6Y3Y5KjGNQQF6xZ4Y5Y5Y5Y5Y5Y5Y5",
          user_type: "user",
          company_id: building.company_id,
          assigned_pm_id: managerId,
        })
        .select()
        .single()

      if (userError || !newUser) {
        console.error("Error creating user:", userError)
        setError("Failed to create user. Email may already exist.")
        setCreatingUser(false)
        return
      }

      // Attach new user to this building
      const { error: assignError } = await supabase
        .from("user_buildings")
        .insert({
          user_id: newUser.id,
          building_id: building.id,
        })

      if (assignError) {
        console.error("Error assigning user to building:", assignError)
        setError("User created but failed to assign to building.")
        setCreatingUser(false)
        return
      }

      setSelectedUsers((prev) => [...prev, newUser.id])

      setNewUserName("")
      setNewUserEmail("")
      setNewUserPassword("")
      setShowAddUserForm(false)

      await onSuccess()
    } catch (err) {
      console.error("Unexpected error:", err)
      setError("Unexpected error creating user.")
    } finally {
      setCreatingUser(false)
    }
  }

  const handleSubmit = async () => {
    if (!buildingName.trim() || !managerId || !building) {
      alert("Please fill in all required fields")
      return
    }

    setSubmitting(true)

    try {
      const { error: updateError } = await supabase
        .from("buildings")
        .update({
          name: buildingName.trim(),
          address: buildingAddress.trim() || null,
          building_type: buildingType,
          manager_id: managerId,
        })
        .eq("id", building.id)

      if (updateError) {
        console.error("Error updating building:", updateError)
        alert("Failed to update building")
        return
      }

      const currentUserIds = building.users?.map((u) => u.id) || []
      const usersToAdd = selectedUsers.filter((id) => !currentUserIds.includes(id))
      const usersToRemove = currentUserIds.filter((id) => !selectedUsers.includes(id))

      if (usersToRemove.length > 0) {
        const { error: deleteError } = await supabase
          .from("user_buildings")
          .delete()
          .eq("building_id", building.id)
          .in("user_id", usersToRemove)

        if (deleteError) {
          console.error("Error removing users:", deleteError)
        }
      }

      if (usersToAdd.length > 0) {
        const insertData = usersToAdd.map((userId) => ({
          building_id: building.id,
          user_id: userId,
        }))

        const { error: insertError } = await supabase
          .from("user_buildings")
          .insert(insertData)

        if (insertError) {
          console.error("Error adding users:", insertError)
        }
      }

      await onSuccess()
      onClose()
    } catch (err) {
      console.error("Unexpected error:", err)
      alert("Failed to update building")
    } finally {
      setSubmitting(false)
    }
  }

  const toggleUserSelection = (userId: number) => {
    setSelectedUsers((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    )
  }

  // Only users from the same company can be assigned
  const filteredAvailableUsers = building
    ? availableUsers.filter(
        (user) => !building.company_id || user.company_id === building.company_id
      )
    : []

  if (!isOpen || !building) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-border flex items-center justify-between bg-gradient-to-r from-primary/10 to-decision-purple/10">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Building Details</h2>
            <p className="text-sm text-muted-foreground mt-1">{building.name}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 px-6 pt-4 border-b border-border">
          <button
            onClick={() => setActiveTab("details")}
            className={`pb-3 px-1 font-medium text-sm transition-colors flex items-center gap-2 ${
              activeTab === "details"
                ? "text-primary border-b-2 border-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Building2 className="h-4 w-4" />
            Details
          </button>
          <button
            onClick={() => setActiveTab("users")}
            className={`pb-3 px-1 font-medium text-sm transition-colors flex items-center gap-2 ${
              activeTab === "users"
                ? "text-primary border-b-2 border-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Users className="h-4 w-4" />
            Users ({selectedUsers.length})
          </button>
          <button
            onClick={() => setActiveTab("documents")}
            className={`pb-3 px-1 font-medium text-sm transition-colors flex items-center gap-2 ${
              activeTab === "documents"
                ? "text-primary border-b-2 border-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <FileText className="h-4 w-4" />
            Documents
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === "details" && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="buildingName">Building Name *</Label>
                <Input
                  id="buildingName"
                  value={buildingName}
                  onChange={(e) => setBuildingName(e.target.value)}
                  placeholder="Enter building name"
                />
              </div>

              <div>
                <Label htmlFor="buildingAddress">Address</Label>
                <Input
                  id="buildingAddress"
                  value={buildingAddress}
                  onChange={(e) => setBuildingAddress(e.target.value)}
                  placeholder="Enter building address"
                />
              </div>

              <div>
                <Label htmlFor="buildingType">Building Type *</Label>
                <Select value={buildingType} onValueChange={setBuildingType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select building type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Strata/Condo">Strata/Condo</SelectItem>
                    <SelectItem value="Rental">Rental Building</SelectItem>
                    <SelectItem value="Housing Co-op">Housing Co-op</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="manager">Property Manager *</Label>
                <Select
                  value={managerId?.toString() || ""}
                  onValueChange={(value) => setManagerId(parseInt(value))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select property manager" />
                  </SelectTrigger>
                  <SelectContent>
                    {propertyManagers.map((pm) => (
                      <SelectItem key={pm.id} value={pm.id.toString()}>
                        {pm.name} ({pm.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="bg-muted/50 p-4 rounded-lg">
                <h3 className="font-medium text-sm text-muted-foreground mb-2">Metadata</h3>
                <div className="space-y-1 text-sm">
                  <p>
                    <span className="font-medium">Building ID:</span> {building.id}
                  </p>
                  <p>
                    <span className="font-medium">Company ID:</span>{" "}
                    {building.company_id || "None"}
                  </p>
                  <p>
                    <span className="font-medium">Created:</span>{" "}
                    {new Date(building.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === "users" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-foreground">Manage Building Users</h3>
                <Button
                  onClick={() => setShowAddUserForm(!showAddUserForm)}
                  size="sm"
                  className="bg-gradient-to-r from-primary to-decision-purple"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add New User
                </Button>
              </div>

              {error && (
                <p className="text-sm text-red-500">
                  {error}
                </p>
              )}

              {showAddUserForm && (
                <Card className="p-4 bg-muted/50 border-2 border-primary/20">
                  <h4 className="font-medium text-sm mb-3">Create New User</h4>
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="newUserName">Name *</Label>
                      <Input
                        id="newUserName"
                        value={newUserName}
                        onChange={(e) => setNewUserName(e.target.value)}
                        placeholder="Enter user name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="newUserEmail">Email *</Label>
                      <Input
                        id="newUserEmail"
                        type="email"
                        value={newUserEmail}
                        onChange={(e) => setNewUserEmail(e.target.value)}
                        placeholder="Enter user email"
                      />
                    </div>
                    <div>
                      <Label htmlFor="newUserPassword">Password *</Label>
                      <Input
                        id="newUserPassword"
                        type="password"
                        value={newUserPassword}
                        onChange={(e) => setNewUserPassword(e.target.value)}
                        placeholder="Enter temporary password"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={handleCreateNewUser}
                        disabled={creatingUser}
                        size="sm"
                        className="bg-gradient-to-r from-primary to-decision-purple"
                      >
                        {creatingUser ? "Creating..." : "Create & Assign User"}
                      </Button>
                      <Button
                        onClick={() => {
                          setShowAddUserForm(false)
                          setNewUserName("")
                          setNewUserEmail("")
                          setNewUserPassword("")
                          setError(null)
                        }}
                        variant="outline"
                        size="sm"
                      >
                        Cancel
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      User will be created with company ID: {building.company_id || "None"} and
                      automatically assigned to this building.
                    </p>
                  </div>
                </Card>
              )}

              {filteredAvailableUsers.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No users available in this company. Create a new user above.
                </p>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    Select users to assign to this building (showing{" "}
                    {filteredAvailableUsers.length} users from company{" "}
                    {building.company_id || "N/A"}):
                  </p>
                  <div className="border border-border rounded-lg max-h-[400px] overflow-y-auto">
                    {filteredAvailableUsers.map((user) => (
                      <label
                        key={user.id}
                        className="flex items-center gap-3 p-3 hover:bg-muted cursor-pointer border-b border-border last:border-b-0"
                      >
                        <input
                          type="checkbox"
                          checked={selectedUsers.includes(user.id)}
                          onChange={() => toggleUserSelection(user.id)}
                          className="h-4 w-4"
                        />
                        <div className="flex-1">
                          <p className="font-medium text-sm">{user.name}</p>
                          <p className="text-xs text-muted-foreground">{user.email}</p>
                        </div>
                        <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                          {user.user_type}
                        </span>
                      </label>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === "documents" && (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-medium text-foreground mb-2">Documents</h3>
              <p className="text-sm text-muted-foreground">
                Document management will be available here
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-border flex justify-end gap-3">
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="bg-gradient-to-r from-primary to-decision-purple"
          >
            {submitting ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </Card>
    </div>
  )
}
