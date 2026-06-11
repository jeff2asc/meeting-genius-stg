"use client"

import { useState, useEffect, useRef } from "react"
import { X, Building2, Users, FileText, Trash2, ExternalLink, Loader2, Link as LinkIcon, Bell, Upload, ChevronDown, UserPlus } from "lucide-react"
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { supabase, getVotingParameters, Company } from "@/lib/supabase"
import { triggerJanusResync } from "@/lib/janus"
import { toast } from "sonner"
import { apiClient } from "@/lib/api-client"

import { isPropertyManager as checkIsPropertyManager, isCorporateAdmin as checkIsCorporateAdmin, isMaster as checkIsMaster } from "@/lib/permissions"
import AssignUsersToBuildingModal from "./AssignUsersToBuildingModal"
import CreateUserModal from "./CreateUserModal"

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
  board_meeting_notice_days?: number | null
  general_meeting_notice_days?: number | null
  notification_recipient_type?: string | null
  timezone?: string | null
  company?: { id: number; name: string } | null
}

interface BuildingDetailsModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  building: Building | null
  currentUser?: any
}

type TabType = "details" | "users" | "documents" | "notifications"

export default function BuildingDetailsModal({
  isOpen,
  onClose,
  onSuccess,
  building,
  currentUser
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
  const [companies, setCompanies] = useState<Company[]>([])
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // PM search combobox
  const [pmSearch, setPmSearch] = useState("")
  const [showPmDropdown, setShowPmDropdown] = useState(false)

  const [boardMeetingNoticeDays, setBoardMeetingNoticeDays] = useState(7)
  const [generalMeetingNoticeDays, setGeneralMeetingNoticeDays] = useState(7)
  const [notificationRecipientTypes, setNotificationRecipientTypes] = useState<string[]>(["owner"])
  const [buildingTimezone, setBuildingTimezone] = useState("America/Vancouver")

  const [assignedUsers, setAssignedUsers] = useState<any[]>([])

  // Fetch assigned users directly from user_buildings — never rely on the
  // building prop, which may have been filtered to exclude attendees.
  const fetchAssignedUsers = async (buildingId: number) => {
    try {
      const { data, error } = await supabase
        .from("user_buildings")
        .select(`
          unit_number,
          users(id, name, email, user_type, roles)
        `)
        .eq("building_id", buildingId)

      if (error) {
        console.error("Error fetching assigned users:", error)
        return
      }

      const formatted = (data || [])
        .map((ub: any) => ({
          id: ub.users?.id,
          name: ub.users?.name,
          email: ub.users?.email,
          user_type: ub.users?.user_type,
          roles: ub.users?.roles,
          unit_number: ub.unit_number,
        }))
        .filter((u: any) => u.id)

      setAssignedUsers(formatted)
    } catch (err) {
      console.error("Unexpected error fetching assigned users:", err)
    }
  }

  // Ref to hold DocumentsTab's auto-save function for unsaved URL
  const pendingUrlSaveRef = useRef<(() => Promise<void>) | null>(null)

  const [buildingTypes, setBuildingTypes] = useState<string[]>([])
  const [userBuildingTypes, setUserBuildingTypes] = useState<string[]>([])
  
  const [showAssignUserModal, setShowAssignUserModal] = useState(false)
  const [showCreateUserModal, setShowCreateUserModal] = useState(false)
  const [availableBuildings, setAvailableBuildings] = useState<Array<{ id: number; name: string; company_id?: number | null }>>([])

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
      // Do NOT seed from building.users prop — it may exclude attendees due to
      // company_id filtering in the parent query. Always fetch fresh from DB.
      setSelectedUsers(building.users?.map((u) => u.id) || [])
      setSelectedCompanyId(building.company_id)      
      setBoardMeetingNoticeDays(building.board_meeting_notice_days || 7)
      setGeneralMeetingNoticeDays(building.general_meeting_notice_days || 7)
      const savedRecipients = building.notification_recipient_type
      if (savedRecipients) {
        // Support both legacy single values and new comma-separated multi-values
        setNotificationRecipientTypes(savedRecipients.split(',').map(s => s.trim()).filter(Boolean))
      } else {
        setNotificationRecipientTypes([getDefaultRecipientType(building.building_type || "Strata/Condo")])
      }
      setBuildingTimezone(building.timezone || "America/Vancouver")
  
      fetchPropertyManagers()
      fetchCompanies()
      fetchDynamicParams()
      fetchAvailableBuildings()
      fetchAssignedUsers(building.id)
    }
  }, [isOpen, building?.id, currentUser?.id])

  const fetchCompanies = async () => {
    try {
      const { data, error } = await supabase
        .from("companies")
        .select("id, name, created_at, updated_at")
        .order("name")

      if (error) {
        console.error("Error fetching companies:", error)
        return
      }

      // Deduplicate by id in case the DB has duplicate rows
      const seen = new Set<number>()
      const unique = (data || []).filter(c => {
        if (seen.has(c.id)) return false
        seen.add(c.id)
        return true
      })
      setCompanies(unique)
    } catch (err) {
      console.error("Unexpected error:", err)
    }
  }

  const fetchDynamicParams = async () => {
    const params = await getVotingParameters(building?.company_id) as Array<{ parameter_type: string; value: string }>
    
    // Deduplicate values for Master users who see multiple company parameters
    const types = params.filter(p => p.parameter_type === 'building_type').map(p => p.value)
    setBuildingTypes([...new Set(types)] as string[])

    const userTypes = params.filter(p => p.parameter_type === 'user_type').map(p => p.value)
    setUserBuildingTypes([...new Set(userTypes)] as string[])
  }  



  const getDefaultRecipientType = (buildingType: string): string => {
    if (buildingType === "Housing Co-op") return "resident"
    return "owner"
  }

  useEffect(() => {
    // Only nudge to a sensible default when building type changes AND nothing is selected.
    // Skip on initial mount (when the modal is closed) to avoid racing with the main
    // useEffect that loads saved recipients from the building record.
    if (!isOpen) return
    if (notificationRecipientTypes.length === 0) {
      setNotificationRecipientTypes([getDefaultRecipientType(buildingType)])
    }
  }, [buildingType]) // eslint-disable-line react-hooks/exhaustive-deps



  const fetchPropertyManagers = async () => {
    if (!building) return
  
    try {
      const isMasterUser = currentUser?.user_type === "master" || currentUser?.roles?.includes("master")

      // Fetch users who are property managers via user_type OR roles array
      // We fetch from the company and filter client-side to support both conventions
      let query = supabase
        .from("users")
        .select("id, name, email, user_type, company_id, roles")
        .order("name")
  
      if (!isMasterUser) {
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

      // Filter client-side: include users who are PMs by user_type OR by roles array
      const pms = (data || []).filter((u: any) =>
        u.user_type === "property_manager" ||
        u.user_type === "corporate_administrator" ||
        u.user_type === "master" ||
        (Array.isArray(u.roles) && u.roles.includes("property_manager"))
      )
  
      setPropertyManagers(pms as User[])
    } catch (err) {
      console.error("Unexpected error:", err)
    }
  }

  const fetchAvailableBuildings = async () => {
    try {
      const isMasterUser = currentUser?.user_type === "master" || currentUser?.roles?.includes("master")

      let query = supabase
        .from("buildings")
        .select("id, name, company_id")
        .order("name")

      if (!isMasterUser && building?.company_id) {
        query = query.eq("company_id", building.company_id)
      }

      const { data, error } = await query

      if (error) {
        console.error("Error fetching buildings:", error)
        return
      }

      setAvailableBuildings(data || [])
    } catch (err) {
      console.error("Unexpected error fetching buildings:", err)
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

      const provinceCode =
        province.trim().toUpperCase() === "BRITISH COLUMBIA" || province.trim().toUpperCase() === "BC"
          ? "BC"
          : province.trim().toUpperCase() === "ONTARIO" || province.trim().toUpperCase() === "ON"
            ? "ON"
            : province.trim().length <= 3
              ? province.trim().toUpperCase()
              : null

      try {
        await apiClient.v1.buildings.update(building.id, {
          name: buildingName.trim(),
          address: combinedAddress || null,
          building_type: buildingType,
          province_code: provinceCode,
          manager_id: managerId,
          company_id: selectedCompanyId,
          board_meeting_notice_days: boardMeetingNoticeDays,
          general_meeting_notice_days: generalMeetingNoticeDays,
          notification_recipient_type: notificationRecipientTypes.length > 0 ? notificationRecipientTypes.join(',') : null,
          timezone: buildingTimezone || null,
        })
      } catch (err: any) {
        console.error("Error updating building:", err)
        alert(`Failed to update building: ${err.message || 'Unknown error'}`)
        return
      }

      // Auto-save any unsaved URL form data in DocumentsTab before closing
      if (activeTab === "documents" && pendingUrlSaveRef.current) {
        try {
          await pendingUrlSaveRef.current()
        } catch (err) {
          console.error("Error auto-saving URL:", err)
          // Don't block the close on URL save failure
        }
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
        company_id: selectedCompanyId,
        board_meeting_notice_days: boardMeetingNoticeDays,
        general_meeting_notice_days: generalMeetingNoticeDays,
        notification_recipient_type: notificationRecipientTypes.length > 0 ? notificationRecipientTypes.join(',') : null
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

      // Re-fetch from DB so the list stays accurate
      await fetchAssignedUsers(building.id)
      await onSuccess()    } catch (err) {
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

  const filteredAvailableUsers = []

  if (!isOpen || !building) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 sm:p-4">
      <Card className="w-full sm:max-w-4xl h-[92vh] sm:max-h-[90vh] overflow-hidden flex flex-col rounded-t-2xl sm:rounded-2xl">
        <div className="p-4 sm:p-6 border-b border-border flex items-center justify-between bg-gradient-to-r from-primary/10 to-decision-purple/10 flex-shrink-0">
          <div className="min-w-0">
            <h2 className="text-lg sm:text-2xl font-bold text-foreground">Building Details</h2>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 truncate">{building.name}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="flex-shrink-0">
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex gap-1 sm:gap-4 px-3 sm:px-6 pt-3 sm:pt-4 border-b border-border overflow-x-auto scrollbar-hide flex-shrink-0">
          <button
            onClick={() => setActiveTab("details")}
            className={`pb-3 px-1 sm:px-2 font-medium text-xs sm:text-sm transition-colors flex items-center gap-1 sm:gap-2 whitespace-nowrap flex-shrink-0 ${
              activeTab === "details"
                ? "text-primary border-b-2 border-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Building2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            Details
          </button>
          <button
            onClick={() => setActiveTab("users")}
            className={`pb-3 px-1 sm:px-2 font-medium text-xs sm:text-sm transition-colors flex items-center gap-1 sm:gap-2 whitespace-nowrap flex-shrink-0 ${
              activeTab === "users"
                ? "text-primary border-b-2 border-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            Users ({assignedUsers.length})
          </button>
          <button
            onClick={() => setActiveTab("documents")}
            className={`pb-3 px-1 sm:px-2 font-medium text-xs sm:text-sm transition-colors flex items-center gap-1 sm:gap-2 whitespace-nowrap flex-shrink-0 ${
              activeTab === "documents"
                ? "text-primary border-b-2 border-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <FileText className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            Docs
          </button>
          <button
            onClick={() => setActiveTab("notifications")}
            className={`pb-3 px-1 sm:px-2 font-medium text-xs sm:text-sm transition-colors flex items-center gap-1 sm:gap-2 whitespace-nowrap flex-shrink-0 ${
              activeTab === "notifications"
                ? "text-primary border-b-2 border-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Bell className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            Alerts
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {activeTab === "details" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="buildingName">Property Name *</Label>
                  <Input
                    id="buildingName"
                    value={buildingName}
                    onChange={(e) => setBuildingName(e.target.value)}
                    placeholder="Enter building name"
                    readOnly={!(checkIsMaster(currentUser) || checkIsCorporateAdmin(currentUser) || checkIsPropertyManager(currentUser))}
                    className={!(checkIsMaster(currentUser) || checkIsCorporateAdmin(currentUser) || checkIsPropertyManager(currentUser)) ? "bg-muted cursor-not-allowed" : ""}
                  />
                </div>
                <div>
                  <Label htmlFor="buildingType">Classification *</Label>
                  <Select 
                    value={buildingType} 
                    onValueChange={setBuildingType}
                    disabled={!(checkIsMaster(currentUser) || checkIsCorporateAdmin(currentUser) || checkIsPropertyManager(currentUser))}
                  >
                    <SelectTrigger className={!(checkIsMaster(currentUser) || checkIsCorporateAdmin(currentUser) || checkIsPropertyManager(currentUser)) ? "bg-muted cursor-not-allowed" : ""}>
                      <SelectValue placeholder="Select classification" />
                    </SelectTrigger>
                    <SelectContent>
                      {buildingTypes.length > 0 ? (
                        buildingTypes.map(t => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))
                      ) : (
                        <SelectItem value="none" disabled>No types defined in Voting Settings</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="company">Property Management</Label>
                {currentUser?.user_type === "master" || currentUser?.roles?.includes("master") ? (
                  <Select 
                    value={selectedCompanyId?.toString() || "none"} 
                    onValueChange={(value) => setSelectedCompanyId(value === "none" ? null : parseInt(value))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Assign to property management" />
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
              </div>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="street">Street Address</Label>
                  <Input
                    id="street"
                    value={street}
                    onChange={(e) => setStreet(e.target.value)}
                    placeholder="Enter street address"
                    readOnly={!(checkIsMaster(currentUser) || checkIsCorporateAdmin(currentUser) || checkIsPropertyManager(currentUser))}
                    className={!(checkIsMaster(currentUser) || checkIsCorporateAdmin(currentUser) || checkIsPropertyManager(currentUser)) ? "bg-muted cursor-not-allowed" : ""}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="municipality">Municipality</Label>
                    <Input
                      id="municipality"
                      value={province}
                      onChange={(e) => setProvince(e.target.value)}
                      placeholder="Enter municipality"
                      readOnly={!(checkIsMaster(currentUser) || checkIsCorporateAdmin(currentUser) || checkIsPropertyManager(currentUser))}
                      className={!(checkIsMaster(currentUser) || checkIsCorporateAdmin(currentUser) || checkIsPropertyManager(currentUser)) ? "bg-muted cursor-not-allowed" : ""}
                    />
                  </div>
                  <div>
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="Enter city"
                      readOnly={!(checkIsMaster(currentUser) || checkIsCorporateAdmin(currentUser) || checkIsPropertyManager(currentUser))}
                      className={!(checkIsMaster(currentUser) || checkIsCorporateAdmin(currentUser) || checkIsPropertyManager(currentUser)) ? "bg-muted cursor-not-allowed" : ""}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="postalCode">Postal Code</Label>
                    <Input
                      id="postalCode"
                      value={postalCode}
                      onChange={(e) => setPostalCode(e.target.value)}
                      placeholder="Enter postal code"
                      readOnly={!(checkIsMaster(currentUser) || checkIsCorporateAdmin(currentUser) || checkIsPropertyManager(currentUser))}
                      className={!(checkIsMaster(currentUser) || checkIsCorporateAdmin(currentUser) || checkIsPropertyManager(currentUser)) ? "bg-muted cursor-not-allowed" : ""}
                    />
                  </div>
                  <div>
                    <Label htmlFor="country">Country</Label>
                    <Input
                      id="country"
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      placeholder="Enter country"
                      readOnly={!(checkIsMaster(currentUser) || checkIsCorporateAdmin(currentUser) || checkIsPropertyManager(currentUser))}
                      className={!(checkIsMaster(currentUser) || checkIsCorporateAdmin(currentUser) || checkIsPropertyManager(currentUser)) ? "bg-muted cursor-not-allowed" : ""}
                    />
                  </div>
                </div>

                {/* Timezone */}
                <div>
                  <Label htmlFor="timezone">Building Timezone</Label>
                  <p className="text-xs text-muted-foreground mb-1.5">
                    Meeting times will display in this timezone for all users.
                  </p>
                  <Select
                    value={buildingTimezone}
                    onValueChange={setBuildingTimezone}
                    disabled={!(checkIsMaster(currentUser) || checkIsCorporateAdmin(currentUser) || checkIsPropertyManager(currentUser))}
                  >
                    <SelectTrigger
                      id="timezone"
                      className={!(checkIsMaster(currentUser) || checkIsCorporateAdmin(currentUser) || checkIsPropertyManager(currentUser)) ? "bg-muted cursor-not-allowed" : ""}
                    >
                      <SelectValue placeholder="Select timezone" />
                    </SelectTrigger>
                    <SelectContent className="max-h-72">
                      <SelectItem value="America/Vancouver">Pacific Time — Vancouver / Victoria (PT)</SelectItem>
                      <SelectItem value="America/Edmonton">Mountain Time — Calgary / Edmonton (MT)</SelectItem>
                      <SelectItem value="America/Winnipeg">Central Time — Winnipeg (CT)</SelectItem>
                      <SelectItem value="America/Toronto">Eastern Time — Toronto / Ottawa (ET)</SelectItem>
                      <SelectItem value="America/Halifax">Atlantic Time — Halifax (AT)</SelectItem>
                      <SelectItem value="America/St_Johns">Newfoundland Time — St. John's (NT)</SelectItem>
                      <SelectItem value="America/New_York">Eastern Time — New York (ET)</SelectItem>
                      <SelectItem value="America/Chicago">Central Time — Chicago (CT)</SelectItem>
                      <SelectItem value="America/Denver">Mountain Time — Denver (MT)</SelectItem>
                      <SelectItem value="America/Los_Angeles">Pacific Time — Los Angeles (PT)</SelectItem>
                      <SelectItem value="America/Phoenix">Mountain Time (no DST) — Phoenix (MT)</SelectItem>
                      <SelectItem value="America/Anchorage">Alaska Time — Anchorage (AKT)</SelectItem>
                      <SelectItem value="Pacific/Honolulu">Hawaii Time — Honolulu (HT)</SelectItem>
                      <SelectItem value="Europe/London">Greenwich Mean Time — London (GMT/BST)</SelectItem>
                      <SelectItem value="Europe/Paris">Central European Time — Paris / Berlin (CET)</SelectItem>
                      <SelectItem value="Asia/Dubai">Gulf Standard Time — Dubai (GST)</SelectItem>
                      <SelectItem value="Asia/Singapore">Singapore Time (SGT)</SelectItem>
                      <SelectItem value="Asia/Manila">Philippine Time — Manila (PHT)</SelectItem>
                      <SelectItem value="Asia/Tokyo">Japan Standard Time — Tokyo (JST)</SelectItem>
                      <SelectItem value="Australia/Sydney">Australian Eastern Time — Sydney (AEST)</SelectItem>
                      <SelectItem value="Pacific/Auckland">New Zealand Time — Auckland (NZST)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="manager">Link Registered Property Manager *</Label>
                {/* Searchable PM Combobox */}
                <div className="relative mt-1.5">
                  <input
                    id="manager"
                    type="text"
                    autoComplete="off"
                    disabled={!(checkIsMaster(currentUser) || checkIsCorporateAdmin(currentUser) || checkIsPropertyManager(currentUser))}
                    placeholder="Search property manager..."
                    value={showPmDropdown ? pmSearch : (propertyManagers.find(pm => pm.id === managerId)?.name || pmSearch)}
                    onChange={(e) => {
                      setPmSearch(e.target.value)
                      setShowPmDropdown(true)
                    }}
                    onFocus={() => {
                      setPmSearch("")
                      setShowPmDropdown(true)
                    }}
                    onBlur={() => {
                      // Delay to allow click on dropdown item to register
                      setTimeout(() => setShowPmDropdown(false), 180)
                    }}
                    className={`w-full px-3 py-2 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 transition-shadow ${
                      !(checkIsMaster(currentUser) || checkIsCorporateAdmin(currentUser) || checkIsPropertyManager(currentUser))
                        ? "bg-muted cursor-not-allowed opacity-60"
                        : ""
                    }`}
                  />
                  {showPmDropdown && (
                    <div className="absolute z-50 w-full mt-1 bg-card border border-border rounded-lg shadow-xl max-h-52 overflow-y-auto">
                      {propertyManagers
                        .filter(pm =>
                          !pmSearch ||
                          pm.name.toLowerCase().includes(pmSearch.toLowerCase()) ||
                          (pm.email || "").toLowerCase().includes(pmSearch.toLowerCase())
                        )
                        .map(pm => (
                          <button
                            key={pm.id}
                            type="button"
                            onMouseDown={() => {
                              setManagerId(pm.id)
                              setPmSearch(pm.name)
                              setShowPmDropdown(false)
                            }}
                            className={`w-full text-left px-3 py-2.5 text-sm hover:bg-primary/5 transition-colors border-b border-border/40 last:border-0 ${
                              pm.id === managerId ? "bg-primary/10 text-primary font-semibold" : ""
                            }`}
                          >
                            <span className="font-medium">{pm.name}</span>
                            {pm.email && <span className="text-xs text-muted-foreground ml-2">{pm.email}</span>}
                          </button>
                        ))
                      }
                      {propertyManagers.filter(pm =>
                        !pmSearch ||
                        pm.name.toLowerCase().includes(pmSearch.toLowerCase()) ||
                        (pm.email || "").toLowerCase().includes(pmSearch.toLowerCase())
                      ).length === 0 && (
                        <div className="px-3 py-4 text-sm text-muted-foreground text-center italic">
                          No matching property managers found
                        </div>
                      )}
                    </div>
                  )}
                </div>
                {managerId && (() => {
                  const selectedPm = propertyManagers.find(pm => pm.id === managerId)
                  return selectedPm ? (
                    <div className="grid grid-cols-2 gap-4 mt-3">
                      <div>
                        <Label htmlFor="managerContactName">Manager Contact Name</Label>
                        <Input
                          id="managerContactName"
                          value={selectedPm.name}
                          readOnly
                          className="bg-muted/50 text-muted-foreground cursor-not-allowed"
                        />
                      </div>
                      <div>
                        <Label htmlFor="professionalEmail">Professional Email</Label>
                        <Input
                          id="professionalEmail"
                          value={selectedPm.email}
                          readOnly
                          className="bg-muted/50 text-muted-foreground cursor-not-allowed"
                        />
                      </div>
                    </div>
                  ) : null
                })()}
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
            <div className="space-y-4 sm:space-y-6">
              <div className="flex items-start sm:items-center justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-base sm:text-lg font-bold text-foreground">Building Assignments</h3>
                  <p className="text-xs sm:text-sm text-muted-foreground hidden sm:block">Users who have access to this building and their unit numbers</p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" className="bg-gradient-to-r from-primary to-decision-purple text-primary-foreground text-xs h-8 sm:h-9 px-2 sm:px-3">
                        <UserPlus className="h-3.5 w-3.5 sm:mr-2" />
                        <span className="hidden sm:inline">Add User</span>
                        <ChevronDown className="h-3 w-3 ml-1" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-52">
                      <DropdownMenuItem
                        onClick={() => setShowCreateUserModal(true)}
                        className="cursor-pointer"
                      >
                        <UserPlus className="h-4 w-4 mr-2" />
                        <div>
                          <p className="font-medium text-sm">Create New User</p>
                          <p className="text-xs text-muted-foreground">Register and assign a new user</p>
                        </div>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setShowAssignUserModal(true)}
                        className="cursor-pointer"
                      >
                        <Users className="h-4 w-4 mr-2" />
                        <div>
                          <p className="font-medium text-sm">Assign Existing User</p>
                          <p className="text-xs text-muted-foreground">Add a registered user</p>
                        </div>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {/* Desktop table */}
              <div className="hidden sm:block border border-border rounded-xl overflow-hidden bg-card">
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
                                  const roleDisplay = getUserTypeDisplay(role)
                                  return (
                                    <span
                                      key={role}
                                      className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${roleDisplay.className}`}
                                    >
                                      {roleDisplay.label}
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

              {/* Mobile card list */}
              <div className="sm:hidden space-y-2">
                {assignedUsers.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground py-8">No users assigned yet.</p>
                ) : (
                  assignedUsers.map((user, idx) => (
                    <div key={`${user.id}-${user.unit_number}-${idx}`} className="border border-border rounded-xl p-3 bg-card">
                      <div className="flex justify-between items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-sm truncate">{user.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {Array.from(new Set([user.user_type, ...(Array.isArray(user.roles) ? user.roles : [])])).map((role) => {
                              const roleDisplay = getUserTypeDisplay(role)
                              return (
                                <span key={role} className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${roleDisplay.className}`}>
                                  {roleDisplay.label}
                                </span>
                              )
                            })}
                            {user.unit_number && (
                              <Badge variant="secondary" className="text-[10px] bg-blue-50 text-blue-700 border-blue-100">
                                Unit {user.unit_number}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50 flex-shrink-0"
                          onClick={() => handleRemoveAssignment(user.id, user.unit_number)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {activeTab === "documents" && (
            <DocumentsTab key={building.id} building={building} onSuccess={onSuccess} pendingUrlSaveRef={pendingUrlSaveRef} />
          )}

          {activeTab === "notifications" && (
            <NotificationsTab
              boardMeetingNoticeDays={boardMeetingNoticeDays}
              setBoardMeetingNoticeDays={setBoardMeetingNoticeDays}
              generalMeetingNoticeDays={generalMeetingNoticeDays}
              setGeneralMeetingNoticeDays={setGeneralMeetingNoticeDays}
              notificationRecipientTypes={notificationRecipientTypes}
              setNotificationRecipientTypes={setNotificationRecipientTypes}
              buildingType={buildingType}
            />
          )}
        </div>

        <div className="p-4 sm:p-6 border-t border-border flex justify-end gap-3 flex-shrink-0">
          <Button variant="outline" onClick={onClose} disabled={submitting} className="h-9 sm:h-10">
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="bg-gradient-to-r from-primary to-decision-purple h-9 sm:h-10"
          >
            {submitting ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </Card>

      {/* Assign Users Modal */}
      <AssignUsersToBuildingModal
        isOpen={showAssignUserModal}
        onClose={() => setShowAssignUserModal(false)}
        onSuccess={async () => {
          if (building) await fetchAssignedUsers(building.id)
          onSuccess()
        }}
        building={building}
        currentUser={currentUser}
      />

      {/* Create New User Modal */}
      <CreateUserModal
        isOpen={showCreateUserModal}
        onClose={() => setShowCreateUserModal(false)}
        onSuccess={async () => {
          if (building) await fetchAssignedUsers(building.id)
          onSuccess()
        }}
        currentUser={currentUser}
        propertyManagers={propertyManagers}
        buildings={availableBuildings}
        companies={companies}
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
  notificationRecipientTypes: string[]
  setNotificationRecipientTypes: (types: string[]) => void
  buildingType: string
}

const RECIPIENT_OPTIONS = [
  { value: "owner",                   label: "Owners",           description: "Unit owners / strata lot owners" },
  { value: "resident",                label: "Residents",        description: "Tenants and co-op members" },
  { value: "property_manager",        label: "Property Manager", description: "Assigned property manager" },
  { value: "corporate_administrator", label: "Corporate Admin",  description: "Company-level administrators" },
  { value: "attendee",                label: "Attendees",        description: "Meeting attendees" },
]

function recipientLabel(types: string[]): string {
  if (types.length === 0) return "No one selected"
  if (types.length === RECIPIENT_OPTIONS.length) return "All Users"
  return types
    .map(v => RECIPIENT_OPTIONS.find(o => o.value === v)?.label ?? v)
    .join(", ")
}

function NotificationsTab({
  boardMeetingNoticeDays,
  setBoardMeetingNoticeDays,
  generalMeetingNoticeDays,
  setGeneralMeetingNoticeDays,
  notificationRecipientTypes,
  setNotificationRecipientTypes,
  buildingType,
}: NotificationsTabProps) {
  const toggle = (value: string) => {
    setNotificationRecipientTypes(
      notificationRecipientTypes.includes(value)
        ? notificationRecipientTypes.filter(v => v !== value)
        : [...notificationRecipientTypes, value]
    )
  }

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
              Default: 7 days. This is when the system will automatically send meeting notices to{" "}
              <strong>{recipientLabel(notificationRecipientTypes)}</strong>.
            </p>
          </div>

          {/* Multi-select recipient checkboxes */}
          <div>
            <Label className="text-sm font-medium">Send Notifications To *</Label>
            <p className="text-xs text-muted-foreground mb-3 mt-0.5">
              Select one or more recipient groups. <strong>Building Type: {buildingType}</strong>
            </p>
            <div className="grid grid-cols-1 gap-2">
              {RECIPIENT_OPTIONS.map(option => {
                const checked = notificationRecipientTypes.includes(option.value)
                return (
                  <label
                    key={option.value}
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      checked
                        ? "bg-primary/5 border-primary/40"
                        : "bg-white border-border hover:bg-muted/30"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(option.value)}
                      className="mt-0.5 h-4 w-4 rounded border-border accent-primary cursor-pointer"
                    />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-foreground">{option.label}</span>
                      <p className="text-xs text-muted-foreground">{option.description}</p>
                    </div>
                  </label>
                )
              })}
            </div>
            {notificationRecipientTypes.length === 0 && (
              <p className="text-xs text-red-500 mt-2">Please select at least one recipient group.</p>
            )}
            {notificationRecipientTypes.length > 0 && (
              <div className="mt-3 p-3 bg-white rounded-lg border text-xs text-muted-foreground">
                Notices will be sent to: <strong>{recipientLabel(notificationRecipientTypes)}</strong>
              </div>
            )}
          </div>
        </div>
      </Card>

      <Card className="p-4 bg-blue-50 border-blue-200">
        <div className="flex gap-3">
          <Bell className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-semibold text-sm text-blue-900 mb-1">How Notifications Work</h4>
            <ul className="text-xs text-blue-800 space-y-1">
              <li>Notices/agendas will be automatically sent to <strong>{recipientLabel(notificationRecipientTypes)}</strong> based on the configured days</li>
              <li>Board meetings typically require shorter notice periods</li>
              <li>General meetings may require longer notice periods per local regulations</li>
              <li>The system will send reminders via email to all assigned recipients</li>
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
  pendingUrlSaveRef?: React.MutableRefObject<(() => Promise<void>) | null>
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

function DocumentsTab({ building, onSuccess, pendingUrlSaveRef }: DocumentsTabProps) {
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

  // Expose auto-save function to parent via ref
  useEffect(() => {
    if (pendingUrlSaveRef) {
      pendingUrlSaveRef.current = async () => {
        // Only save if there's actual data in the URL form
        if (urlTitle.trim() && urlLink.trim()) {
          await handleSaveUrl()
        }
      }
    }
    return () => {
      if (pendingUrlSaveRef) {
        pendingUrlSaveRef.current = null
      }
    }
  }, [urlTitle, urlLink, urlType, urlDescription])

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

      // Deduplicate by id
      const seen = new Set<number>()
      const unique = (data || []).filter(d => {
        if (seen.has(d.id)) {
          console.warn(`[DocumentsTab] Duplicate document ID: ${d.id}`)
          return false
        }
        seen.add(d.id)
        return true
      })
      console.log(`[DocumentsTab] fetchDocuments: ${data?.length || 0} raw → ${unique.length} unique`)
      setDocuments(unique)
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

      // Deduplicate by id
      const seen = new Set<number>()
      const unique = (data || []).filter(d => {
        if (seen.has(d.id)) {
          console.warn(`[DocumentsTab] Duplicate documentUrl ID: ${d.id}`)
          return false
        }
        seen.add(d.id)
        return true
      })
      console.log(`[DocumentsTab] fetchDocumentUrls: ${data?.length || 0} raw → ${unique.length} unique`)
      setDocumentUrls(unique)
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
