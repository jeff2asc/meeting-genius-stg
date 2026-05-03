"use client"

import { useState, useEffect } from "react"
import { X, Building2, Users, FileText, Plus, Upload, Trash2, ExternalLink, Loader2, Link as LinkIcon, Bell } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { supabase } from "@/lib/supabase"
import { triggerJanusResync } from "@/lib/janus"
import { toast } from "sonner"
import ImportUsersModal from "./ImportUsersModal"

interface User {
  id: number
  name: string
  email: string
  user_type: string
  company_id: number | null
  roles?: string[] | null
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
  board_meeting_notice_days?: number
  general_meeting_notice_days?: number
  notification_recipient_type?: string
}

interface BuildingDetailsModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  building: Building | null
  availableUsers: User[]
}

type TabType = "details" | "users" | "documents" | "notifications"

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

  const [boardMeetingNoticeDays, setBoardMeetingNoticeDays] = useState(7)
  const [generalMeetingNoticeDays, setGeneralMeetingNoticeDays] = useState(7)
  const [notificationRecipientType, setNotificationRecipientType] = useState("owner")

  const [showAddUserForm, setShowAddUserForm] = useState(false)
  const [newUserName, setNewUserName] = useState("")
  const [newUserEmail, setNewUserEmail] = useState("")
  const [newUserPassword, setNewUserPassword] = useState("")
  const [newUserType, setNewUserType] = useState("user")
  const [creatingUser, setCreatingUser] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [showImportModal, setShowImportModal] = useState(false)

  // ⭐ NEW: Assign Existing User State
  const [showAssignExisting, setShowAssignExisting] = useState(false)
  const [availableUsersForAssignment, setAvailableUsersForAssignment] = useState<User[]>([])
  const [loadingAvailableUsers, setLoadingAvailableUsers] = useState(false)
  const [selectedExistingUserId, setSelectedExistingUserId] = useState<number | "">("")
  const [currentUser, setCurrentUser] = useState<User | null>(null)

  useEffect(() => {
    if (isOpen && building && currentUser) {
      setBuildingName(building.name)
      setBuildingAddress(building.address || "")
      setBuildingType(building.building_type || "Strata/Condo")
      setManagerId(building.manager_id)
      setSelectedUsers(building.users?.map((u) => u.id) || [])
      
      setBoardMeetingNoticeDays(building.board_meeting_notice_days || 7)
      setGeneralMeetingNoticeDays(building.general_meeting_notice_days || 7)
      setNotificationRecipientType(
        building.notification_recipient_type ||
        getDefaultRecipientType(building.building_type || "Strata/Condo")
      )
  
      setActiveTab("details")
      fetchPropertyManagers()
    }
  }, [isOpen, building, currentUser])  

  // ⭐ NEW: Get current user on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const userJson = localStorage.getItem('current_user')
      if (userJson) {
        try {
          setCurrentUser(JSON.parse(userJson))
        } catch (err) {
          console.error('Error parsing current user:', err)
        }
      }
    }
  }, [])

  const getDefaultRecipientType = (buildingType: string): string => {
    if (buildingType === "Housing Co-op") return "resident"
    return "owner"
  }

  useEffect(() => {
    if (buildingType === "Housing Co-op") {
      setNotificationRecipientType("resident")
    } else if (buildingType === "Strata/Condo" || buildingType === "Rental") {
      setNotificationRecipientType("owner")
    }
  }, [buildingType])

  useEffect(() => {
    if (buildingType === "Housing Co-op") {
      setNewUserType("resident")
    } else if (buildingType === "Strata/Condo" || buildingType === "Rental") {
      setNewUserType("owner")
    } else {
      setNewUserType("user")
    }
  }, [buildingType])

  const fetchPropertyManagers = async () => {
    if (!building) return
  
    try {
      let query = supabase
        .from("users")
        .select("id, name, email, user_type, company_id")
        .order("name")
  
      if (!(currentUser?.user_type === "master" || currentUser?.roles?.includes("master"))) {
        if (building.company_id) {
          query = query.eq("company_id", building.company_id)
        } else {
          setPropertyManagers([])
          return
        }
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

  // ⭐ NEW: Fetch available users for assignment based on permissions
  const fetchAvailableUsersForAssignment = async () => {
    if (!building || !currentUser) return

    try {
      setLoadingAvailableUsers(true)
      setError(null)

      let query = supabase
        .from("users")
        .select("id, name, email, user_type, company_id")
        .order("name")

      if (currentUser.user_type === "master" || currentUser.roles?.includes("master")) {
        // Master can see ALL users
      } else if (
        currentUser.user_type === "corporate_administrator" ||
        currentUser.user_type === "property_manager" ||
        currentUser.roles?.includes("corporate_administrator") ||
        currentUser.roles?.includes("property_manager")
      ) {
        if (building.company_id) {
          query = query.eq("company_id", building.company_id)
        } else {
          setAvailableUsersForAssignment([])
          setLoadingAvailableUsers(false)
          return
        }
      } else {
        setAvailableUsersForAssignment([])
        setLoadingAvailableUsers(false)
        return
      }

      const { data, error: fetchError } = await query

      if (fetchError) {
        console.error("Error fetching available users:", fetchError)
        setError("Failed to load users.")
        setAvailableUsersForAssignment([])
        return
      }

      const alreadyAssignedIds = selectedUsers
      const availableUsers = (data || []).filter(
        (user) => !alreadyAssignedIds.includes(user.id)
      )

      setAvailableUsersForAssignment(availableUsers as User[])
    } catch (err) {
      console.error("Unexpected error fetching users:", err)
      setError("Unexpected error while loading users.")
      setAvailableUsersForAssignment([])
    } finally {
      setLoadingAvailableUsers(false)
    }
  }

  // ⭐ NEW: Assign existing user to building
  const handleAssignExistingUser = async () => {
    if (!building || !selectedExistingUserId) {
      setError("Please select a user to assign")
      return
    }

    try {
      setError(null)

      if (selectedUsers.includes(selectedExistingUserId as number)) {
        setError("This user is already assigned to this building")
        return
      }

      const { error: insertError } = await supabase
        .from("user_buildings")
        .insert({
          user_id: selectedExistingUserId,
          building_id: building.id,
        })

      if (insertError) {
        console.error("Error assigning user:", insertError)
        setError("Failed to assign user to building")
        return
      }

      setSelectedUsers((prev) => [...prev, selectedExistingUserId as number])
      setSelectedExistingUserId("")
      setShowAssignExisting(false)
      
      toast.success("User assigned successfully!")
      
      await fetchAvailableUsersForAssignment()
      await onSuccess()
    } catch (err) {
      console.error("Unexpected error assigning user:", err)
      setError("An unexpected error occurred while assigning user")
    }
  }

  const handleCreateNewUser = async () => {
    if (!building) return

    if (!newUserName.trim() || !newUserEmail.trim() || !newUserPassword.trim()) {
      setError("Name, email and password are required")
      return
    }

    setCreatingUser(true)
    setError(null)

    try {
      const { data: newUser, error: userError } = await supabase
        .from("users")
        .insert({
          name: newUserName.trim(),
          email: newUserEmail.toLowerCase().trim(),
          password_hash:
            "$2a$10$rXqvFZnPzAMcLzCP2L4dxu7L6Y3Y5KjGNQQF6xZ4Y5Y5Y5Y5Y5Y5Y5",
          user_type: newUserType,
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
      setNewUserType(buildingType === "Housing Co-op" ? "resident" : buildingType === "Strata/Condo" || buildingType === "Rental" ? "owner" : "user")
      setShowAddUserForm(false)

      const userTypeLabel = newUserType === 'resident' ? 'Resident' : newUserType === 'owner' ? 'Owner' : 'User'
      toast.success(`${userTypeLabel} created successfully!`)

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
          board_meeting_notice_days: boardMeetingNoticeDays,
          general_meeting_notice_days: generalMeetingNoticeDays,
          notification_recipient_type: notificationRecipientType,
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

      toast.success("Building settings updated successfully!")
      
      // 🔄 Notify Janus for real-time sync
      triggerJanusResync('building_updated')
      
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

  // ⭐ NEW: Helper function to format user type display
  const getUserTypeDisplay = (userType: string) => {
    switch (userType) {
      case 'resident':
        return { label: '🏠 Resident', className: 'bg-green-100 text-green-800 border border-green-200' }
      case 'owner':
        return { label: '👤 Owner', className: 'bg-blue-100 text-blue-800 border border-blue-200' }
      case 'property_manager':
        return { label: '🏢 Property Manager', className: 'bg-purple-100 text-purple-800 border border-purple-200' }
      case 'corporate_administrator':
        return { label: '🏛️ Corporate Admin', className: 'bg-orange-100 text-orange-800 border border-orange-200' }
      case 'master':
        return { label: '⭐ Master', className: 'bg-red-100 text-red-800 border border-red-200' }
      default:
        return { 
          label: userType.replace('_', ' ').charAt(0).toUpperCase() + userType.slice(1).replace('_', ' '), 
          className: 'bg-gray-100 text-gray-800 border border-gray-200' 
        }
    }
  }

  const filteredAvailableUsers = building
    ? availableUsers.filter(
        (user) => !building.company_id || user.company_id === building.company_id
      )
    : []

  if (!isOpen || !building) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b border-border flex items-center justify-between bg-gradient-to-r from-primary/10 to-decision-purple/10">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Building Details</h2>
            <p className="text-sm text-muted-foreground mt-1">{building.name}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex gap-4 px-6 pt-4 border-b border-border overflow-x-auto">
          <button
            onClick={() => setActiveTab("details")}
            className={`pb-3 px-1 font-medium text-sm transition-colors flex items-center gap-2 whitespace-nowrap ${
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
            className={`pb-3 px-1 font-medium text-sm transition-colors flex items-center gap-2 whitespace-nowrap ${
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
            className={`pb-3 px-1 font-medium text-sm transition-colors flex items-center gap-2 whitespace-nowrap ${
              activeTab === "documents"
                ? "text-primary border-b-2 border-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <FileText className="h-4 w-4" />
            Documents
          </button>
          <button
            onClick={() => setActiveTab("notifications")}
            className={`pb-3 px-1 font-medium text-sm transition-colors flex items-center gap-2 whitespace-nowrap ${
              activeTab === "notifications"
                ? "text-primary border-b-2 border-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Bell className="h-4 w-4" />
            Notifications
          </button>
        </div>

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
                <div className="flex gap-2">
                  {currentUser && (
                    currentUser.user_type === "master" ||
                    currentUser.user_type === "corporate_administrator" ||
                    currentUser.user_type === "property_manager" ||
                    currentUser.roles?.includes("master") ||
                    currentUser.roles?.includes("corporate_administrator") ||
                    currentUser.roles?.includes("property_manager")
                  ) && (
                    <Button
                      onClick={() => {
                        setShowAssignExisting(!showAssignExisting)
                        if (!showAssignExisting && availableUsersForAssignment.length === 0) {
                          fetchAvailableUsersForAssignment()
                        }
                        if (showAssignExisting) {
                          setSelectedExistingUserId("")
                        }
                      }}
                      size="sm"
                      variant="outline"
                      className="border-blue-500 text-blue-700 hover:bg-blue-50"
                    >
                      <Users className="h-4 w-4 mr-2" />
                      Assign Existing User
                    </Button>
                  )}
                  <Button
                    onClick={() => setShowImportModal(true)}
                    size="sm"
                    variant="outline"
                    className="border-primary text-primary hover:bg-primary hover:text-white"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Import Users
                  </Button>
                  <Button
                    onClick={() => setShowAddUserForm(!showAddUserForm)}
                    size="sm"
                    className="bg-gradient-to-r from-primary to-decision-purple"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add New User
                  </Button>
                </div>
              </div>

              {error && (
                <p className="text-sm text-red-500">
                  {error}
                </p>
              )}

              {showAssignExisting && (
                <Card className="p-4 bg-blue-50 border-2 border-blue-300">
                  <h4 className="font-medium text-sm mb-3 text-blue-900">
                    Assign Existing User to Building
                  </h4>
                  {loadingAvailableUsers ? (
                    <p className="text-sm text-muted-foreground">Loading users...</p>
                  ) : availableUsersForAssignment.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No available users to assign. All users from this company are already assigned to this building.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      <div>
                        <Label htmlFor="existingUser">Select User *</Label>
                        <Select
                          value={selectedExistingUserId.toString()}
                          onValueChange={(value) => setSelectedExistingUserId(value ? Number(value) : "")}
                        >
                          <SelectTrigger id="existingUser" className="bg-white">
                            <SelectValue placeholder="Select a user to assign" />
                          </SelectTrigger>
                          <SelectContent>
                            {availableUsersForAssignment.map((user) => (
                              <SelectItem key={user.id} value={user.id.toString()}>
                                {user.name} ({user.email}) - {user.user_type}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground mt-1">
                          {currentUser?.user_type === "master" 
                            ? "Master can assign users from any company"
                            : `Showing users from company ID: ${building.company_id || "None"}`
                          }
                        </p>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          onClick={handleAssignExistingUser}
                          size="sm"
                          className="bg-blue-600 hover:bg-blue-700 text-white flex-1"
                          disabled={!selectedExistingUserId || loadingAvailableUsers}
                        >
                          Assign User
                        </Button>
                        <Button
                          onClick={() => {
                            setShowAssignExisting(false)
                            setSelectedExistingUserId("")
                            setError(null)
                          }}
                          variant="outline"
                          size="sm"
                          className="flex-1"
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </Card>
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
                    
                    <div>
                      <Label htmlFor="newUserType">User Type *</Label>
                      <Select value={newUserType} onValueChange={setNewUserType}>
                        <SelectTrigger id="newUserType" className="mt-1">
                          <SelectValue placeholder="Select user type" />
                        </SelectTrigger>
                        <SelectContent>
                          {buildingType === "Housing Co-op" && (
                            <SelectItem value="resident">Resident</SelectItem>
                          )}
                          {(buildingType === "Strata/Condo" || buildingType === "Rental") && (
                            <SelectItem value="owner">Owner</SelectItem>
                          )}
                          <SelectItem value="user">User</SelectItem>
                          <SelectItem value="property_manager">Property Manager</SelectItem>
                          <SelectItem value="vendor">Vendor</SelectItem>
                          <SelectItem value="attendee">Attendee</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground mt-1">
                        {buildingType === "Housing Co-op" && "Housing Co-ops use Resident type"}
                        {buildingType === "Strata/Condo" && "Strata/Condo buildings use Owner type"}
                        {buildingType === "Rental" && "Rental buildings use Owner type"}
                      </p>
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
                          setNewUserType(buildingType === "Housing Co-op" ? "resident" : "owner")
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
                    {filteredAvailableUsers.map((user) => {
                      const userTypeDisplay = getUserTypeDisplay(user.user_type)
                      return (
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
                          <span className={`text-xs px-2 py-1 rounded font-medium ${userTypeDisplay.className}`}>
                            {userTypeDisplay.label}
                          </span>
                        </label>
                      )
                    })}
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === "documents" && (
            <DocumentsTab building={building} onSuccess={onSuccess} />
          )}

          {activeTab === "notifications" && (
            <NotificationsTab
              boardMeetingNoticeDays={boardMeetingNoticeDays}
              setBoardMeetingNoticeDays={setBoardMeetingNoticeDays}
              generalMeetingNoticeDays={generalMeetingNoticeDays}
              setGeneralMeetingNoticeDays={setGeneralMeetingNoticeDays}
              notificationRecipientType={notificationRecipientType}
              setNotificationRecipientType={setNotificationRecipientType}
              buildingType={buildingType}
            />
          )}
        </div>

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

      {/* Import Users Modal */}
      <ImportUsersModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onSuccess={onSuccess}
        buildingId={building.id}
        buildingName={building.name}
        buildingType={buildingType}
        companyId={building.company_id}
        managerId={managerId || building.manager_id}
      />
    </div>
  )
}
// ============================================
// Notifications Tab Component
// ============================================

interface NotificationsTabProps {
  boardMeetingNoticeDays: number
  setBoardMeetingNoticeDays: (days: number) => void
  generalMeetingNoticeDays: number
  setGeneralMeetingNoticeDays: (days: number) => void
  notificationRecipientType: string
  setNotificationRecipientType: (type: string) => void
  buildingType: string
}

function NotificationsTab({
  boardMeetingNoticeDays,
  setBoardMeetingNoticeDays,
  generalMeetingNoticeDays,
  setGeneralMeetingNoticeDays,
  notificationRecipientType,
  setNotificationRecipientType,
  buildingType,
}: NotificationsTabProps) {
  return (
    <div className="space-y-6">
      <Card className="p-6 bg-gradient-to-br from-blue-50 to-purple-50 border-blue-200">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-100">
            <Bell className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h3 className="font-semibold text-lg">Meeting Notification Settings</h3>
            <p className="text-sm text-muted-foreground">
              Configure how many days before meetings to send notices/agendas
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <Label htmlFor="boardNoticeDays" className="text-sm font-medium">
              Days Before Board Meeting Notice *
            </Label>
            <div className="flex items-center gap-3 mt-2">
              <Input
                id="boardNoticeDays"
                type="number"
                min="1"
                max="90"
                value={boardMeetingNoticeDays}
                onChange={(e) => setBoardMeetingNoticeDays(parseInt(e.target.value) || 7)}
                className="w-24"
              />
              <span className="text-sm text-muted-foreground">
                days before sending notice/agenda for Board Meetings
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Default: 7 days. This is when the system will automatically send meeting notices and agendas to board members.
            </p>
          </div>

          <div>
            <Label htmlFor="generalNoticeDays" className="text-sm font-medium">
              Days Before General Meeting Notice *
            </Label>
            <div className="flex items-center gap-3 mt-2">
              <Input
                id="generalNoticeDays"
                type="number"
                min="1"
                max="90"
                value={generalMeetingNoticeDays}
                onChange={(e) => setGeneralMeetingNoticeDays(parseInt(e.target.value) || 7)}
                className="w-24"
              />
              <span className="text-sm text-muted-foreground">
                days before sending notice for General Meetings
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Default: 7 days. This is when the system will automatically send meeting notices to all {notificationRecipientType}s.
            </p>
          </div>

          <div>
            <Label htmlFor="recipientType" className="text-sm font-medium">
              Send Notifications To *
            </Label>
            <Select
              value={notificationRecipientType}
              onValueChange={setNotificationRecipientType}
              disabled={buildingType === "Housing Co-op" || buildingType === "Strata/Condo"}
            >
              <SelectTrigger id="recipientType" className="mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {buildingType === "Housing Co-op" ? (
                  <SelectItem value="resident">Residents</SelectItem>
                ) : (
                  <SelectItem value="owner">Owners</SelectItem>
                )}
              </SelectContent>
            </Select>
            <div className="mt-2 p-3 bg-white rounded-lg border">
              <p className="text-xs text-muted-foreground">
                <strong>Building Type: {buildingType}</strong>
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {buildingType === "Housing Co-op" && "Housing Co-ops send notifications to "}
                {(buildingType === "Strata/Condo" || buildingType === "Rental") && "Strata/Condo buildings send notifications to "}
                {buildingType === "Housing Co-op" ? <strong>Residents</strong> : <strong>Owners</strong>}.
              </p>
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-4 bg-blue-50 border-blue-200">
        <div className="flex gap-3">
          <Bell className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-semibold text-sm text-blue-900 mb-1">How Notifications Work</h4>
            <ul className="text-xs text-blue-800 space-y-1">
              <li>Notices/agendas will be automatically sent to {notificationRecipientType}s based on the configured days</li>
              <li>Board meetings typically require shorter notice periods</li>
              <li>General meetings may require longer notice periods per local regulations</li>
              <li>The system will send reminders via email to all assigned {notificationRecipientType}s</li>
            </ul>
          </div>
        </div>
      </Card>

      <Card className="p-4 bg-muted/50">
        <h4 className="font-medium text-sm mb-3">Quick Presets</h4>
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setBoardMeetingNoticeDays(3); setGeneralMeetingNoticeDays(7) }}
            className="text-xs"
          >
            Minimal (3/7 days)
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setBoardMeetingNoticeDays(7); setGeneralMeetingNoticeDays(14) }}
            className="text-xs"
          >
            Standard (7/14 days)
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setBoardMeetingNoticeDays(14); setGeneralMeetingNoticeDays(21) }}
            className="text-xs"
          >
            Extended (14/21 days)
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setBoardMeetingNoticeDays(7); setGeneralMeetingNoticeDays(7) }}
            className="text-xs"
          >
            Reset to Default (7/7)
          </Button>
        </div>
      </Card>
    </div>
  )
}

// ============================================
// Documents Tab Component
// ============================================

interface DocumentsTabProps {
  building: Building
  onSuccess: () => void
}

interface DocumentURL {
  id: number
  building_id: number
  document_type: string
  url: string
  title: string
  description: string | null
  created_at: string
}

function DocumentsTab({ building, onSuccess }: DocumentsTabProps) {
  const [documents, setDocuments] = useState<any[]>([])
  const [documentUrls, setDocumentUrls] = useState<DocumentURL[]>([])
  const [uploading, setUploading] = useState(false)
  const [selectedDocType, setSelectedDocType] = useState("rules")
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(true)
  const [showUrlForm, setShowUrlForm] = useState(false)
  const [urlTitle, setUrlTitle] = useState("")
  const [urlLink, setUrlLink] = useState("")
  const [urlType, setUrlType] = useState("legislation")
  const [urlDescription, setUrlDescription] = useState("")
  const [savingUrl, setSavingUrl] = useState(false)

  useEffect(() => {
    fetchDocuments()
    fetchDocumentUrls()
  }, [])

  const fetchDocuments = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from("building_documents")
        .select("*")
        .eq("building_id", building.id)
        .order("created_at", { ascending: false })

      if (error) {
        console.error("Error fetching documents:", error)
        return
      }

      setDocuments(data || [])
    } catch (err) {
      console.error("Unexpected error fetching documents:", err)
    } finally {
      setLoading(false)
    }
  }

  const fetchDocumentUrls = async () => {
    try {
      const { data, error } = await supabase
        .from("building_document_urls")
        .select("*")
        .eq("building_id", building.id)
        .order("created_at", { ascending: false })

      if (error) {
        console.error("Error fetching document URLs:", error)
        return
      }

      setDocumentUrls(data || [])
    } catch (err) {
      console.error("Unexpected error fetching URLs:", err)
    }
  }

  const handleSaveUrl = async () => {
    if (!urlTitle.trim() || !urlLink.trim()) {
      toast.error("Title and URL are required")
      return
    }

    try {
      new URL(urlLink)
    } catch {
      toast.error("Please enter a valid URL")
      return
    }

    setSavingUrl(true)
    try {
      const { error } = await supabase
        .from("building_document_urls")
        .insert({
          building_id: building.id,
          document_type: urlType,
          url: urlLink.trim(),
          title: urlTitle.trim(),
          description: urlDescription.trim() || null,
        })

      if (error) {
        console.error("Error saving URL:", error)
        toast.error("Failed to save URL")
        return
      }

      toast.success("Reference URL added successfully!")
      setUrlTitle("")
      setUrlLink("")
      setUrlType("legislation")
      setUrlDescription("")
      setShowUrlForm(false)
      await fetchDocumentUrls()
      await onSuccess()
    } catch (err) {
      console.error("Unexpected error:", err)
      toast.error("Failed to save URL")
    } finally {
      setSavingUrl(false)
    }
  }

  const handleDeleteUrl = async (urlId: number) => {
    if (!confirm("Are you sure you want to delete this reference URL?")) return

    try {
      const { error } = await supabase
        .from("building_document_urls")
        .delete()
        .eq("id", urlId)

      if (error) {
        toast.error("Failed to delete URL")
        return
      }

      toast.success("Reference URL deleted")
      await fetchDocumentUrls()
      await onSuccess()
    } catch (err) {
      console.error("Delete error:", err)
      toast.error("Failed to delete URL")
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const validTypes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ]

    if (!validTypes.includes(file.type)) {
      alert("Please select a PDF, DOC, or DOCX file")
      return
    }

    // ✅ UPDATED: Increased limit to 50MB
    if (file.size > 50 * 1024 * 1024) {
      alert("File size must be less than 50MB")
      return
    }

    setSelectedFile(file)
  }

  const handleUpload = async () => {
    if (!selectedFile) {
      alert("Please select a file")
      return
    }

    setUploading(true)
    try {
      const fileName = `${building.id}/${Date.now()}_${selectedFile.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("building-documents")
        .upload(fileName, selectedFile, {
          cacheControl: "3600",
          upsert: false,
        })

      if (uploadError) {
        console.error("Upload error:", uploadError)
        throw new Error("Failed to upload file to storage")
      }

      const { data: { publicUrl } } = supabase.storage
        .from("building-documents")
        .getPublicUrl(fileName)

      const { error: dbError } = await supabase
        .from("building_documents")
        .insert({
          building_id: building.id,
          document_type: selectedDocType,
          filename: selectedFile.name,
          file_url: publicUrl,
          file_size: selectedFile.size,
          mime_type: selectedFile.type,
        })

      if (dbError) {
        console.error("Database error:", dbError)
        throw new Error("Failed to save document metadata")
      }

      alert("Document uploaded successfully!")
      setSelectedFile(null)
      await fetchDocuments()
      await onSuccess()
    } catch (error: any) {
      console.error("Upload error:", error)
      alert(error.message || "Upload failed")
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (docId: number, fileUrl: string) => {
    if (!confirm("Are you sure you want to delete this document?")) return

    try {
      const filePath = fileUrl.split("building-documents/")[1]
      if (filePath) {
        await supabase.storage
          .from("building-documents")
          .remove([filePath])
      }

      const { error: dbError } = await supabase
        .from("building_documents")
        .delete()
        .eq("id", docId)

      if (dbError) throw new Error("Failed to delete document")

      alert("Document deleted successfully")
      await fetchDocuments()
      await onSuccess()
    } catch (error: any) {
      console.error("Delete error:", error)
      alert(error.message || "Delete failed")
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes"
    const k = 1024
    const sizes = ["Bytes", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i]
  }

  return (
    <div className="space-y-6">
      <Card className="p-4 bg-gradient-to-br from-green-50 to-blue-50 border-green-200">
        <h3 className="font-semibold text-lg mb-3">Upload Document</h3>
        <div className="space-y-3">
          <div>
            <Label htmlFor="docType">Document Type</Label>
            <Select value={selectedDocType} onValueChange={setSelectedDocType}>
              <SelectTrigger id="docType">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="rules">Rules</SelectItem>
                <SelectItem value="bylaws">Bylaws</SelectItem>
                <SelectItem value="policies">Policies</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            {/* ✅ UPDATED: Label now shows Max 50MB */}
            <Label htmlFor="fileUpload">Select File (PDF, DOC, DOCX - Max 50MB)</Label>
            <Input
              id="fileUpload"
              type="file"
              accept=".pdf,.doc,.docx"
              onChange={handleFileSelect}
              className="cursor-pointer"
            />
            {selectedFile && (
              <p className="text-xs text-muted-foreground mt-1">
                Selected: {selectedFile.name} ({formatFileSize(selectedFile.size)})
              </p>
            )}
          </div>

          <Button
            onClick={handleUpload}
            disabled={!selectedFile || uploading}
            className="w-full bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600"
          >
            {uploading ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Uploading...</>
            ) : (
              <><Upload className="h-4 w-4 mr-2" />Upload Document</>
            )}
          </Button>
        </div>
      </Card>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-lg">Uploaded Documents</h3>
        </div>

        {loading ? (
          <div className="text-center py-8">
            <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
            <p className="text-sm text-muted-foreground mt-2">Loading documents...</p>
          </div>
        ) : documents.length === 0 ? (
          <Card className="p-8 text-center border-dashed">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">No documents uploaded yet</p>
          </Card>
        ) : (
          <div className="space-y-2">
            {documents.map((doc) => (
              <Card key={doc.id} className="p-4 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1">
                    <FileText className="h-5 w-5 text-primary flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{doc.filename}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Badge variant="outline" className="text-xs">{doc.document_type}</Badge>
                        <span>{formatFileSize(doc.file_size)}</span>
                        <span>·</span>
                        <span>{new Date(doc.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => window.open(doc.file_url, "_blank")}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDelete(doc.id, doc.file_url)}
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

      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-lg">Reference URLs</h3>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowUrlForm(!showUrlForm)}
            className="border-blue-500 text-blue-700 hover:bg-blue-50"
          >
            <LinkIcon className="h-4 w-4 mr-2" />
            {showUrlForm ? "Cancel" : "Add URL"}
          </Button>
        </div>

        {showUrlForm && (
          <Card className="p-4 bg-blue-50 border-blue-200 mb-4">
            <h4 className="font-medium text-sm mb-3">Add Reference URL</h4>
            <div className="space-y-3">
              <div>
                <Label htmlFor="urlTitle">Title *</Label>
                <Input
                  id="urlTitle"
                  value={urlTitle}
                  onChange={(e) => setUrlTitle(e.target.value)}
                  placeholder="e.g., Provincial Strata Property Act"
                />
              </div>
              <div>
                <Label htmlFor="urlLink">URL *</Label>
                <Input
                  id="urlLink"
                  type="url"
                  value={urlLink}
                  onChange={(e) => setUrlLink(e.target.value)}
                  placeholder="https://example.com/document"
                />
              </div>
              <div>
                <Label htmlFor="urlType">Type</Label>
                <Select value={urlType} onValueChange={setUrlType}>
                  <SelectTrigger id="urlType">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="legislation">Legislation</SelectItem>
                    <SelectItem value="policy">Policy</SelectItem>
                    <SelectItem value="reference">Reference</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="urlDescription">Description (Optional)</Label>
                <Textarea
                  id="urlDescription"
                  value={urlDescription}
                  onChange={(e) => setUrlDescription(e.target.value)}
                  placeholder="Brief description of this reference"
                  rows={2}
                />
              </div>
              <Button
                onClick={handleSaveUrl}
                disabled={savingUrl || !urlTitle.trim() || !urlLink.trim()}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                {savingUrl ? "Saving..." : "Save URL"}
              </Button>
            </div>
          </Card>
        )}

        {documentUrls.length === 0 ? (
          <Card className="p-8 text-center border-dashed">
            <LinkIcon className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">No reference URLs added yet</p>
          </Card>
        ) : (
          <div className="space-y-2">
            {documentUrls.map((urlDoc) => (
              <Card key={urlDoc.id} className="p-4 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1">
                    <LinkIcon className="h-5 w-5 text-blue-600 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{urlDoc.title}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Badge variant="outline" className="text-xs">{urlDoc.document_type}</Badge>
                        <span>·</span>
                        <span className="truncate max-w-xs">{urlDoc.url}</span>
                      </div>
                      {urlDoc.description && (
                        <p className="text-xs text-muted-foreground mt-1">{urlDoc.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => window.open(urlDoc.url, "_blank")}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDeleteUrl(urlDoc.id)}
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
    </div>
  )
}
