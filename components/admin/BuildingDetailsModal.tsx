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
import { supabase, getVotingParameters } from "@/lib/supabase"
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
  unit_number?: string | null
}

interface Building {
  id: number
  name: string
  address: string | null
  manager_id: number
  company_id: number | null
  building_type?: string
  created_at: string
  users?: Array<{ id: number; name: string; email: string; user_type: string; roles?: string[] | null; unit_number?: string | null }>
  board_meeting_notice_days?: number
  general_meeting_notice_days?: number
  notification_recipient_type?: string
  company?: { id: number; name: string } | null
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
  const [street, setStreet] = useState("")
  const [city, setCity] = useState("")
  const [province, setProvince] = useState("")
  const [postalCode, setPostalCode] = useState("")
  const [country, setCountry] = useState("Canada")
  const [buildingType, setBuildingType] = useState("")
  const [managerId, setManagerId] = useState<number | null>(null)
  const [selectedUsers, setSelectedUsers] = useState<number[]>([])
  const [propertyManagers, setPropertyManagers] = useState<User[]>([])
  const [companies, setCompanies] = useState<Array<{ id: number; name: string }>>([])
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const [boardMeetingNoticeDays, setBoardMeetingNoticeDays] = useState(7)
  const [generalMeetingNoticeDays, setGeneralMeetingNoticeDays] = useState(7)
  const [notificationRecipientType, setNotificationRecipientType] = useState("owner")

  const [showAddUserForm, setShowAddUserForm] = useState(false)
  const [newUserName, setNewUserName] = useState("")
  const [newUserEmail, setNewUserEmail] = useState("")
  const [newUserPassword, setNewUserPassword] = useState("")
  const [newUserType, setNewUserType] = useState("user")
  const [newUserUnit, setNewUserUnit] = useState("")
  const [creatingUser, setCreatingUser] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const [assignedUsers, setAssignedUsers] = useState<any[]>([])
  const [assignmentUnit, setAssignmentUnit] = useState("")

  const [showImportModal, setShowImportModal] = useState(false)

  // ⭐ NEW: Assign Existing User State
  const [showAssignExisting, setShowAssignExisting] = useState(false)
  const [availableUsersForAssignment, setAvailableUsersForAssignment] = useState<User[]>([])
  const [loadingAvailableUsers, setLoadingAvailableUsers] = useState(false)
  const [selectedExistingUserId, setSelectedExistingUserId] = useState<number | "">("")
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  
  const [buildingTypes, setBuildingTypes] = useState<string[]>([])
  const [userBuildingTypes, setUserBuildingTypes] = useState<string[]>([])
  const [votingWeight, setVotingWeight] = useState("1.00")
  const [newUserVotingWeight, setNewUserVotingWeight] = useState("1.00")

  useEffect(() => {
    if (isOpen && building && currentUser) {
      setBuildingName(building.name)
      if (building.address) {
        const parts = building.address.split(',').map(s => s.trim())
        setStreet(parts[0] || "")
        setCity(parts[1] || "")
        setProvince(parts[2] || "")
        setPostalCode(parts[3] || "")
        setCountry(parts[4] || "Canada")
      } else {
        setStreet("")
        setCity("")
        setProvince("")
        setPostalCode("")
        setCountry("Canada")
      }
      setBuildingType(building.building_type || "Strata/Condo")
      setManagerId(building.manager_id)
      setSelectedUsers(building.users?.map((u) => u.id) || [])
      setAssignedUsers(building.users || [])
      setSelectedCompanyId(building.company_id)
      
      setBoardMeetingNoticeDays(building.board_meeting_notice_days || 7)
      setGeneralMeetingNoticeDays(building.general_meeting_notice_days || 7)
      setNotificationRecipientType(
        building.notification_recipient_type ||
        getDefaultRecipientType(building.building_type || "Strata/Condo")
      )
  
      fetchPropertyManagers()
      fetchCompanies()
      fetchDynamicParams()
    }
  }, [isOpen, building?.id, currentUser])

  const fetchCompanies = async () => {
    try {
      const { data, error } = await supabase
        .from("companies")
        .select("id, name")
        .order("name")

      if (error) {
        console.error("Error fetching companies:", error)
        return
      }

      setCompanies(data || [])
    } catch (err) {
      console.error("Unexpected error:", err)
    }
  }

  const fetchDynamicParams = async () => {
    const params = await getVotingParameters(building?.company_id)
    
    setBuildingTypes(params.filter(p => p.parameter_type === 'building_type').map(p => p.value))
    setUserBuildingTypes(params.filter(p => p.parameter_type === 'user_type').map(p => p.value))
  }  

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
          unit_number: assignmentUnit.trim() || null,
          voting_weight: parseFloat(votingWeight) || 1.00,
          user_building_type: availableUsersForAssignment.find(u => u.id === selectedExistingUserId)?.user_type || null
        })

      if (insertError) {
        console.error("Error assigning user:", insertError)
        setError("Failed to assign user to building")
        return
      }

      setAssignedUsers((prev) => [
        ...prev, 
        { 
          id: selectedExistingUserId, 
          ...availableUsersForAssignment.find(u => u.id === selectedExistingUserId),
          unit_number: assignmentUnit.trim() || null 
        }
      ])
      setSelectedExistingUserId("")
      setAssignmentUnit("")
      setShowAssignExisting(false)
      
      toast.success("User assigned successfully!")
      
      // 🔄 Notify Janus with full user data including unit
      const u = availableUsersForAssignment.find(u => u.id === selectedExistingUserId)
      if (u) {
        triggerJanusResync("user_assigned_to_building", {
          ...u,
          units: [{ building_id: building.id, unit_number: assignmentUnit.trim() }]
        }, "user")
      }
      
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
          unit_number: newUserUnit.trim() || null,
          voting_weight: parseFloat(newUserVotingWeight) || 1.00,
          user_building_type: newUserType
        })

      if (assignError) {
        console.error("Error assigning user to building:", assignError)
        setError("User created but failed to assign to building.")
        setCreatingUser(false)
        return
      }

      setAssignedUsers((prev) => [
        ...prev, 
        { 
          id: newUser.id, 
          name: newUser.name, 
          email: newUser.email, 
          user_type: newUser.user_type, 
          unit_number: newUserUnit.trim() || null 
        }
      ])
      setNewUserName("")
      setNewUserEmail("")
      setNewUserPassword("")
      setNewUserUnit("")
      setNewUserType(buildingType === "Housing Co-op" ? "resident" : buildingType === "Strata/Condo" || buildingType === "Rental" ? "owner" : "user")
      setShowAddUserForm(false)

      const userTypeLabel = newUserType === 'resident' ? 'Resident' : newUserType === 'owner' ? 'Owner' : 'User'
      toast.success(`${userTypeLabel} created successfully!`)

      // 🔄 Notify Janus with full user data including unit
      triggerJanusResync("user_created", {
        ...newUser,
        units: [{ building_id: building.id, unit_number: newUserUnit.trim() }]
      }, "user")

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
      const combinedAddress = [
        street.trim(),
        city.trim(),
        province.trim(),
        postalCode.trim(),
        country.trim()
      ].filter(Boolean).join(', ')

      const { error: updateError } = await supabase
        .from("buildings")
        .update({
          name: buildingName.trim(),
          address: combinedAddress || null,
          building_type: buildingType,
          manager_id: managerId,
          company_id: selectedCompanyId,
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

      // We no longer need to diff here because assignments are handled individually now.
      // But we'll keep the building metadata update.
      
      toast.success("Building settings updated successfully!")
      
      // 🔄 Notify Janus for real-time sync with full data
      triggerJanusResync('building_updated', {
        id: building.id,
        name: buildingName.trim(),
        address: [street, city, province, postalCode, country].filter(Boolean).join(', '),
        building_type: buildingType,
        manager_id: managerId,
        company_id: selectedCompanyId
      }, 'building')
      
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

  const handleRemoveAssignment = async (userId: number, unitNumber: string | null) => {
    if (!building) return
    
    const confirmMsg = unitNumber 
      ? `Are you sure you want to remove user from Unit ${unitNumber}?`
      : "Are you sure you want to remove this user from the building?"
      
    if (!confirm(confirmMsg)) return

    try {
      let query = supabase
        .from("user_buildings")
        .delete()
        .eq("building_id", building.id)
        .eq("user_id", userId)
      
      if (unitNumber) {
        query = query.eq("unit_number", unitNumber)
      } else {
        query = query.is("unit_number", null)
      }

      const { error } = await query

      if (error) {
        console.error("Error removing assignment:", error)
        toast.error("Failed to remove assignment")
        return
      }

      setAssignedUsers((prev) => 
        prev.filter((u) => !(u.id === userId && u.unit_number === unitNumber))
      )
      toast.success("Assignment removed")
      
      // 🔄 Notify Janus
      triggerJanusResync('user_removed_from_building')
      
      await onSuccess()
    } catch (err) {
      console.error("Unexpected error:", err)
      toast.error("Failed to remove assignment")
    }
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
                <Label htmlFor="company">Company Assignment</Label>
                {currentUser?.user_type === "master" || currentUser?.roles?.includes("master") ? (
                  <Select 
                    value={selectedCompanyId?.toString() || "none"} 
                    onValueChange={(value) => setSelectedCompanyId(value === "none" ? null : parseInt(value))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Assign to company" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No Company (Internal)</SelectItem>
                      {companies.map(c => (
                        <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="bg-muted/50 px-3 py-2 rounded-md text-sm font-medium border border-border">
                    {building.company?.name || "No Company Assigned"}
                  </div>
                )}
                <p className="text-[10px] text-muted-foreground mt-1">
                  Only System Administrators can transfer buildings between companies.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <Label htmlFor="street">Street Address</Label>
                  <Input
                    id="street"
                    value={street}
                    onChange={(e) => setStreet(e.target.value)}
                    placeholder="Enter street address"
                  />
                </div>
                <div>
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Enter city"
                  />
                </div>
                <div>
                  <Label htmlFor="province">Province / State</Label>
                  <Input
                    id="province"
                    value={province}
                    onChange={(e) => setProvince(e.target.value)}
                    placeholder="Enter province or state"
                  />
                </div>
                <div>
                  <Label htmlFor="postalCode">Postal / Zip Code</Label>
                  <Input
                    id="postalCode"
                    value={postalCode}
                    onChange={(e) => setPostalCode(e.target.value)}
                    placeholder="Enter postal code"
                  />
                </div>
                <div>
                  <Label htmlFor="country">Country</Label>
                  <Input
                    id="country"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    placeholder="Enter country"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="buildingType">Building Type *</Label>
                <Select value={buildingType} onValueChange={setBuildingType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select building type" />
                  </SelectTrigger>
                  <SelectContent>
                    {buildingTypes.length > 0 ? (
                      buildingTypes.map(t => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))
                    ) : (
                      <>
                        <SelectItem value="Strata Corporation">Strata Corporation</SelectItem>
                        <SelectItem value="Condominium Corporation">Condominium Corporation</SelectItem>
                        <SelectItem value="Equity Co-op">Equity Co-op</SelectItem>
                        <SelectItem value="Non-Profit Co-op">Non-Profit Co-op</SelectItem>
                        <SelectItem value="Tenant Association">Tenant Association</SelectItem>
                        <SelectItem value="Non-Profit Society">Non-Profit Society</SelectItem>
                        <SelectItem value="Trade Association">Trade Association</SelectItem>
                        <SelectItem value="Professional Association">Professional Association</SelectItem>
                      </>
                    )}
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
                  {building.company?.name && (
                    <p>
                      <span className="font-medium">Company Name:</span>{" "}
                      {building.company.name}
                    </p>
                  )}
                  <p>
                    <span className="font-medium">Created:</span>{" "}
                    {new Date(building.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === "users" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-foreground">Building Assignments</h3>
                  <p className="text-sm text-muted-foreground">Users who have access to this building and their unit numbers</p>
                </div>
                <div className="flex gap-2">
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
                    variant="outline"
                    className="border-primary/50 text-primary hover:bg-primary/5"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    New Resident
                  </Button>
                </div>
              </div>

              {/* Assignments Table */}
              <div className="border border-border rounded-xl overflow-hidden bg-card">
                <table className="w-full text-left text-sm">
                  <thead className="bg-muted/50 border-b border-border">
                    <tr>
                      <th className="px-4 py-3 font-semibold">User</th>
                      <th className="px-4 py-3 font-semibold">Type</th>
                      <th className="px-4 py-3 font-semibold">Unit #</th>
                      <th className="px-4 py-3 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {assignedUsers.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                          No users assigned to this building yet.
                        </td>
                      </tr>
                    ) : (
                      assignedUsers.map((user, idx) => {
                        const userTypeDisplay = getUserTypeDisplay(user.user_type)
                        return (
                          <tr key={`${user.id}-${user.unit_number}-${idx}`} className="hover:bg-muted/30 transition-colors">
                            <td className="px-4 py-3">
                              <div className="font-medium">{user.name}</div>
                              <div className="text-xs text-muted-foreground">{user.email}</div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex flex-wrap gap-1">
                                {Array.from(
                                  new Set([
                                    user.user_type,
                                    ...(Array.isArray(user.roles) ? user.roles : []),
                                  ]),
                                ).map((role) => {
                                  const userTypeDisplay = getUserTypeDisplay(role)
                                  return (
                                    <span
                                      key={role}
                                      className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${userTypeDisplay.className}`}
                                    >
                                      {userTypeDisplay.label}
                                    </span>
                                  )
                                })}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              {user.unit_number ? (
                                <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-100">
                                  {user.unit_number}
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground italic">None</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                                onClick={() => handleRemoveAssignment(user.id, user.unit_number)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Assign Existing User Form */}
              <Card className="p-4 bg-blue-50/50 border border-blue-200">
                <div className="flex items-center gap-2 mb-4">
                  <Users className="h-5 w-5 text-blue-600" />
                  <h4 className="font-bold text-blue-900">Assign Existing User to Building</h4>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                  <div className="md:col-span-1">
                    <Label htmlFor="existingUser" className="text-blue-900">Select User *</Label>
                    <Select
                      value={selectedExistingUserId.toString()}
                      onValueChange={(value) => {
                        setSelectedExistingUserId(value ? Number(value) : "")
                        if (availableUsersForAssignment.length === 0) fetchAvailableUsersForAssignment()
                      }}
                    >
                      <SelectTrigger id="existingUser" className="bg-white mt-1 border-blue-200">
                        <SelectValue placeholder="Choose a user" />
                      </SelectTrigger>
                      <SelectContent>
                        {loadingAvailableUsers ? (
                          <div className="p-2 text-center text-xs text-muted-foreground">Loading...</div>
                        ) : availableUsersForAssignment.length === 0 ? (
                          <div className="p-2 text-center text-xs text-muted-foreground">No users found</div>
                        ) : (
                          availableUsersForAssignment.map((user) => (
                            <SelectItem key={user.id} value={user.id.toString()}>
                              {user.name} ({user.email})
                            </SelectItem>
                          ))
                        )}
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="w-full text-xs mt-1 border-t rounded-none" 
                          onClick={(e) => {
                            e.stopPropagation()
                            fetchAvailableUsersForAssignment()
                          }}
                        >
                          Refresh List
                        </Button>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label htmlFor="unitNumber" className="text-blue-900">Unit # (Optional)</Label>
                    <Input
                      id="unitNumber"
                      value={assignmentUnit}
                      onChange={(e) => setAssignmentUnit(e.target.value)}
                      placeholder="e.g. 101, PH1"
                      className="bg-white mt-1 border-blue-200"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="votingWeight" className="text-blue-900">Voting Weight</Label>
                    <Input
                      id="votingWeight"
                      type="number"
                      step="0.01"
                      value={votingWeight}
                      onChange={(e) => setVotingWeight(e.target.value)}
                      placeholder="1.00"
                      className="bg-white mt-1 border-blue-200"
                    />
                  </div>
                  
                  <Button
                    onClick={handleAssignExistingUser}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                    disabled={!selectedExistingUserId}
                  >
                    Assign
                  </Button>
                </div>
                <p className="text-[10px] text-blue-700 mt-2">
                  Tip: A user can be assigned to multiple units by adding them multiple times with different unit numbers.
                </p>
              </Card>

              {showAddUserForm && (
                <Card className="p-6 border-2 border-primary/20 bg-muted/30">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-bold text-foreground">Create & Assign New User</h4>
                    <Button variant="ghost" size="sm" onClick={() => setShowAddUserForm(false)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="newUserName">Full Name *</Label>
                      <Input
                        id="newUserName"
                        value={newUserName}
                        onChange={(e) => setNewUserName(e.target.value)}
                        placeholder="John Doe"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="newUserEmail">Email Address *</Label>
                      <Input
                        id="newUserEmail"
                        type="email"
                        value={newUserEmail}
                        onChange={(e) => setNewUserEmail(e.target.value)}
                        placeholder="john@example.com"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="newUserPassword">Temporary Password *</Label>
                      <Input
                        id="newUserPassword"
                        type="password"
                        value={newUserPassword}
                        onChange={(e) => setNewUserPassword(e.target.value)}
                        placeholder="e.g. Welcome2026"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="newUserType">User Type *</Label>
                      <Select value={newUserType} onValueChange={setNewUserType}>
                        <SelectTrigger className="bg-background mt-1">
                          <SelectValue placeholder="Select user type" />
                        </SelectTrigger>
                        <SelectContent>
                          {userBuildingTypes.length > 0 ? (
                            userBuildingTypes.map(t => (
                              <SelectItem key={t} value={t}>{t}</SelectItem>
                            ))
                          ) : (
                            <>
                              <SelectItem value="owner">Owner</SelectItem>
                              <SelectItem value="resident">Resident</SelectItem>
                              <SelectItem value="user">Standard User</SelectItem>
                            </>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="newUserUnit">Unit Number</Label>
                      <Input
                        id="newUserUnit"
                        value={newUserUnit}
                        onChange={(e) => setNewUserUnit(e.target.value)}
                        placeholder="e.g. 101"
                        className="bg-background mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="newUserWeight">Voting Weight</Label>
                      <Input
                        id="newUserWeight"
                        type="number"
                        step="0.01"
                        value={newUserVotingWeight}
                        onChange={(e) => setNewUserVotingWeight(e.target.value)}
                        placeholder="1.00"
                        className="bg-background mt-1"
                      />
                    </div>
                    
                    <div className="md:col-span-2 pt-2">
                      <Button
                        onClick={handleCreateNewUser}
                        disabled={creatingUser}
                        className="w-full bg-gradient-to-r from-primary to-decision-purple"
                      >
                        {creatingUser ? "Creating..." : "Create and Assign User"}
                      </Button>
                    </div>
                  </div>
                </Card>
              )}
            </div>
          )}

          {activeTab === "documents" && (
            <DocumentsTab key={building.id} building={building} onSuccess={onSuccess} />
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
          building_id: Number(building.id),
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
      // Removed onSuccess call to keep modal open
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
      // Removed onSuccess call to keep modal open
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
      // Removed onSuccess call to keep modal open
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
      // Removed onSuccess call to keep modal open
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
