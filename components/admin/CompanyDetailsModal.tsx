"use client"

import { useState, useEffect } from "react"
import {
  X,
  Users,
  Building2,
  UserCheck,
  Home,
  Plus,
  Trash2,
  UserCog,
  Image as ImageIcon,
  Cpu,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import LogoTab from "./LogoTab"
import { Card } from "@/components/ui/card"
import { supabase, type Company, getCurrentUser } from "@/lib/supabase"
import { canManageCompanies } from "@/lib/permissions"
import { triggerJanusResync } from "@/lib/janus"

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
  roles?: string[] | null
  company_id?: number | null
}

interface Building {
  id: number
  name: string
  address: string | null
  manager_id: number | null
  company_id?: number | null
}

type Tab = "overview" | "buildings" | "admins" | "users" | "logo" | "usage_logs" | "llm_config"

import SystemAuditTab from "./SystemAuditTab"

const ALL_ROLES: { value: string; label: string }[] = [
  { value: "user", label: "User" },
  { value: "owner", label: "Owner" },
  { value: "property_manager", label: "Property Manager" },
  { value: "vendor", label: "Vendor" },
  { value: "attendee", label: "Attendee" },
  { value: "corporate_administrator", label: "Corporate Administrator" },
  { value: "master", label: "Master" },
]



export default function CompanyDetailsModal({
  isOpen,
  onClose,
  company,
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

  // Attach Existing Building State
  const [showAttachExisting, setShowAttachExisting] = useState(false)
  const [availableBuildings, setAvailableBuildings] = useState<Building[]>([])
  const [loadingAvailableBuildings, setLoadingAvailableBuildings] =
    useState(false)
  const [selectedExistingBuildingId, setSelectedExistingBuildingId] = useState<
    number | ""
  >("")

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
  // ⭐ NEW: promote existing user to admin
  const [selectedAdminUserId, setSelectedAdminUserId] = useState<number | ("")>("")
  const [promotingAdmin, setPromotingAdmin] = useState(false)

  // Add User State (for Users tab) – MULTI ROLE
  const [showAddUser, setShowAddUser] = useState(false)
  const [newUserName, setNewUserName] = useState("")
  const [newUserEmail, setNewUserEmail] = useState("")
  const [newUserPassword, setNewUserPassword] = useState("")
  const [selectedRoles, setSelectedRoles] = useState<string[]>(["user"])
  const [savingUser, setSavingUser] = useState(false)
  const [userTypeFilter, setUserTypeFilter] = useState<string>("all")

  // ⭐ NEW: Attach Existing User State
  const [showAttachExistingUser, setShowAttachExistingUser] = useState(false)
  const [availableUsersForAttachment, setAvailableUsersForAttachment] = useState<User[]>([])
  const [loadingAvailableUsers, setLoadingAvailableUsers] = useState(false)
  const [selectedExistingUserId, setSelectedExistingUserId] = useState<number | ("")>("")

  // SMTP form state
  const [smtpHost, setSmtpHost] = useState("")
  const [smtpPort, setSmtpPort] = useState<number | "">("")
  const [smtpUser, setSmtpUser] = useState("")
  const [smtpPassword, setSmtpPassword] = useState("")
  const [smtpFromName, setSmtpFromName] = useState("")
  const [smtpFromEmail, setSmtpFromEmail] = useState("")
  const [smtpUseTls, setSmtpUseTls] = useState(true)
  const [savingSmtp, setSavingSmtp] = useState(false)

  // LLM Config state
  const [llmProvider, setLlmProvider] = useState<string>("global")
  const [llmApiKey, setLlmApiKey] = useState("")
  const [llmModel, setLlmModel] = useState("")
  const [savingLlm, setSavingLlm] = useState(false)

  const [error, setError] = useState<string | null>(null)

  const currentUser = getCurrentUser()
  const userCanManageCompanies = canManageCompanies(currentUser?.user_type || "")
  const isMaster =
    currentUser?.user_type === "master" ||
    currentUser?.roles?.includes("master")

  // Existing: runs on modal open
  useEffect(() => {
    if (company && isOpen) {
      setActiveTab("overview")
      fetchCompanyDetails() // ⭐ Force fresh fetch of company columns
      fetchCompanyData()
      fetchPropertyManagers()

      // ... other resets
      setSmtpPassword("")
      setShowAttachExisting(false)
      setSelectedExistingBuildingId("")
      setAvailableBuildings([])
      setShowAttachExistingUser(false)
      setSelectedExistingUserId("")
      setAvailableUsersForAttachment([])
      setError(null)
    }
  }, [company, isOpen])

  // ⭐ FIX: Auto-fetch all users when admins tab is opened
  useEffect(() => {
    if (activeTab === "admins" && isOpen && company) {
      fetchAvailableUsersForAttachment()
    }
  }, [activeTab, isOpen])

  const fetchCompanyData = async () => {
    if (!company) return

    setLoading(true)
    try {
      const { data: usersData, error: usersError } = await supabase
        .from("users")
        .select("id, name, email, user_type, roles, company_id")
        .eq("company_id", company.id)
        .order("name")

      if (usersError) {
        console.error("Error fetching users:", usersError)
      } else {
        setUsers(usersData || [])
      }

      const { data: buildingsData, error: buildingsError } = await supabase
        .from("buildings")
        .select("id, name, address, manager_id")
        .eq("company_id", company.id)
        .order("name")

      if (buildingsError) {
        console.error("Error fetching buildings:", buildingsError)
      } else {
        setBuildings(buildingsData || [])
      }
    } catch (err) {
      console.error("Unexpected error:", err)
    } finally {
      setLoading(false)
    }
  }

  const fetchPropertyManagers = async () => {
    if (!company) return

    const { data } = await supabase
      .from("users")
      .select("id, name, email, user_type")
      .eq("company_id", company.id)
      .eq("user_type", "property_manager")
      .order("name")

    setPropertyManagers(data || [])
  }

  const fetchCompanyDetails = async () => {
    if (!company) return

    const { data, error } = await supabase
      .from("companies")
      .select("*")
      .eq("id", company.id)
      .single()

    if (error) {
      console.error("Error fetching company details:", error)
      return
    }

    if (data) {
      setSmtpHost(data.smtp_host || "")
      setSmtpPort(data.smtp_port ?? "")
      setSmtpUser(data.smtp_user || "")
      setSmtpFromName(data.smtp_from_name || "")
      setSmtpFromEmail(data.smtp_from_email || "")
      setSmtpUseTls(data.smtp_use_tls ?? true)

      setLlmProvider(data.llm_provider || "global")
      setLlmApiKey(data.llm_api_key || "")
      setLlmModel(data.llm_model || "")
    }
  }

  const fetchAvailableBuildings = async () => {
    try {
      setLoadingAvailableBuildings(true)
      setError(null)

      const { data, error: bError } = await supabase
        .from("buildings")
        .select("id, name, address, manager_id, company_id")
        .order("name")

      if (bError) {
        console.error("Error fetching available buildings:", bError)
        setError("Failed to load buildings.")
        setAvailableBuildings([])
        return
      }

      setAvailableBuildings(data || [])
    } catch (err) {
      console.error("Unexpected error fetching available buildings:", err)
      setError("Unexpected error while loading buildings.")
      setAvailableBuildings([])
    } finally {
      setLoadingAvailableBuildings(false)
    }
  }

  // ⭐ NEW: Fetch available users for attachment
  const fetchAvailableUsersForAttachment = async () => {
    if (!company || !currentUser) return

    try {
      setLoadingAvailableUsers(true)
      setError(null)

      let query = supabase
        .from("users")
        .select("id, name, email, user_type, company_id, roles")
        .order("name")

      // Permission-based filtering
      if (currentUser.user_type === "master" || currentUser.roles?.includes("master")) {
        // Master can see ALL users from ALL companies
      } else if (
        currentUser.user_type === "corporate_administrator" ||
        currentUser.user_type === "property_manager" ||
        currentUser.roles?.includes("corporate_administrator") ||
        currentUser.roles?.includes("property_manager")
      ) {
        query = query.eq("company_id", company.id)
      } else {
        setAvailableUsersForAttachment([])
        setLoadingAvailableUsers(false)
        return
      }

      const { data, error: fetchError } = await query

      if (fetchError) {
        console.error("Error fetching available users:", fetchError)
        setError("Failed to load users.")
        setAvailableUsersForAttachment([])
        return
      }

      setAvailableUsersForAttachment((data || []) as User[])
    } catch (err) {
      console.error("Unexpected error fetching users:", err)
      setError("Unexpected error while loading users.")
      setAvailableUsersForAttachment([])
    } finally {
      setLoadingAvailableUsers(false)
    }
  }

  // ⭐ NEW: Handle attaching existing user to company
  const handleAttachExistingUser = async () => {
    if (!company || !selectedExistingUserId) {
      setError("Please select a user to attach")
      return
    }

    try {
      setError(null)

      const { error: updateError } = await supabase
        .from("users")
        .update({ company_id: company.id })
        .eq("id", selectedExistingUserId)

      if (updateError) {
        console.error("Error attaching user:", updateError)
        setError("Failed to attach user to company")
        return
      }

      await fetchCompanyData()
      await fetchAvailableUsersForAttachment()

      setSelectedExistingUserId("")
      setShowAttachExistingUser(false)

      alert("✅ User attached to company successfully!")
    } catch (err) {
      console.error("Unexpected error attaching user:", err)
      setError("An unexpected error occurred while attaching user")
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
        .from("users")
        .insert({
          name: newPMName.trim(),
          email: newPMEmail.toLowerCase().trim(),
          password_hash:
            "$2a$10$rXqvFZnPzAMcLzCP2L4dxu7L6Y3Y5KjGNQQF6xZ4Y5Y5Y5Y5Y5Y5Y5",
          user_type: "property_manager",
          roles: ["property_manager"],
          company_id: company?.id,
        })
        .select()
        .single()

      if (insertError) {
        console.error("Error creating PM:", insertError)
        setError("Failed to create property manager. Email may already exist.")
        setSavingPM(false)
        return
      }

      await fetchPropertyManagers()
      await fetchCompanyData()
      setSelectedManagerId(newUser.id)
      setNewPMName("")
      setNewPMEmail("")
      setNewPMPassword("")
      setShowCreatePM(false)
      // 🔄 Notify Janus
      triggerJanusResync("user_created")
    } catch (err) {
      console.error("Unexpected error:", err)
      setError("An unexpected error occurred")
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
      const { error: insertError } = await supabase.from("buildings").insert({
        name: newBuildingName.trim(),
        address: newBuildingAddress.trim() || null,
        company_id: company?.id,
        manager_id: selectedManagerId,
      })

      if (insertError) {
        console.error("Error adding building:", insertError)
        setError("Failed to add building")
        setSavingBuilding(false)
        return
      }

      setNewBuildingName("")
      setNewBuildingAddress("")
      setSelectedManagerId(null)
      setShowAddBuilding(false)
      await fetchCompanyData()
      // 🔄 Notify Janus
      triggerJanusResync("building_created")
    } catch (err) {
      console.error("Unexpected error:", err)
      setError("An unexpected error occurred")
    } finally {
      setSavingBuilding(false)
    }
  }

  const handleDeleteBuilding = async (buildingId: number) => {
    if (
      !confirm(
        "Are you sure you want to delete this building? This action cannot be undone.",
      )
    ) {
      return
    }

    try {
      const { error } = await supabase
        .from("buildings")
        .delete()
        .eq("id", buildingId)

      if (error) {
        console.error("Error deleting building:", error)
        alert("Failed to delete building")
        return
      }

      await fetchCompanyData()
    } catch (err) {
      console.error("Unexpected error:", err)
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
      const { error: insertError } = await supabase.from("users").insert({
        name: newAdminName.trim(),
        email: newAdminEmail.toLowerCase().trim(),
        password_hash:
          "$2a$10$rXqvFZnPzAMcLzCP2L4dxu7L6Y3Y5KjGNQQF6xZ4Y5Y5Y5Y5Y5Y5Y5",
        user_type: "corporate_administrator",
        roles: ["corporate_administrator"],
        company_id: company?.id,
      })

      if (insertError) {
        console.error("Error adding admin:", insertError)
        setError("Failed to add administrator. Email may already exist.")
        setSavingAdmin(false)
        return
      }

      setNewAdminName("")
      setNewAdminEmail("")
      setNewAdminPassword("")
      setShowAddAdmin(false)
      await fetchCompanyData()
      // 🔄 Notify Janus
      triggerJanusResync("user_created")
    } catch (err) {
      console.error("Unexpected error:", err)
      setError("An unexpected error occurred")
    } finally {
      setSavingAdmin(false)
    }
  }

  // ⭐ NEW: promote existing user to corporate admin
  const handlePromoteToAdmin = async () => {
    if (!company) return

    if (!selectedAdminUserId) {
      setError("Please select a user to make administrator")
      return
    }

    setPromotingAdmin(true)
    setError(null)

    try {
      const user = availableUsersForAttachment.find((u) => u.id === selectedAdminUserId)
      const existingRoles = user?.roles || [user?.user_type || "user"]
      const newRoles = Array.from(new Set([...existingRoles, "corporate_administrator"]))

      const { error: updateError } = await supabase
        .from("users")
        .update({
          user_type: "corporate_administrator",
          roles: newRoles,
          company_id: company.id,
        })
        .eq("id", selectedAdminUserId)

      if (updateError) {
        console.error("Error promoting user to admin:", updateError)
        setError("Failed to make user administrator")
        return
      }

      setSelectedAdminUserId("")
      await fetchCompanyData()
      alert("✅ User promoted to Corporate Administrator!")
    } catch (err) {
      console.error("Unexpected error promoting admin:", err)
      setError("An unexpected error occurred while making user administrator")
    } finally {
      setPromotingAdmin(false)
    }
  }

  const handleAddUser = async () => {
    if (!newUserName.trim() || !newUserEmail.trim() || !newUserPassword.trim()) {
      setError("All fields are required")
      return
    }

    if (selectedRoles.length === 0) {
      setError("Select at least one role")
      return
    }

    const primaryRole = selectedRoles[0] || "user"

    setSavingUser(true)
    setError(null)

    try {
      const { error: insertError } = await supabase.from("users").insert({
        name: newUserName.trim(),
        email: newUserEmail.toLowerCase().trim(),
        password_hash:
          "$2a$10$rXqvFZnPzAMcLzCP2L4dxu7L6Y3Y5KjGNQQF6xZ4Y5Y5Y5Y5Y5Y5Y5",
        user_type: primaryRole,
        roles: selectedRoles,
        company_id: company?.id,
      })

      if (insertError) {
        console.error("Error adding user:", insertError)
        setError("Failed to add user. Email may already exist.")
        setSavingUser(false)
        return
      }

      setNewUserName("")
      setNewUserEmail("")
      setNewUserPassword("")
      setSelectedRoles(["user"])
      setShowAddUser(false)
      await fetchCompanyData()
      await fetchPropertyManagers()
      // 🔄 Notify Janus
      triggerJanusResync("user_created")
    } catch (err) {
      console.error("Unexpected error:", err)
      setError("An unexpected error occurred")
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

  const handleSaveLlm = async () => {
    if (!company) return

    setSavingLlm(true)
    setError(null)

    try {
      // Sanitize model name (replace spaces with dashes)
      const sanitizedModel = llmModel.trim().toLowerCase().replace(/\s+/g, '-');
      
      const { error } = await supabase
        .from("companies")
        .update({
          llm_provider: llmProvider === "global" ? null : llmProvider,
          llm_api_key: llmApiKey.trim() || null,
          llm_model: sanitizedModel || null,
        })
        .eq("id", company.id)

      if (error) {
        console.error("Error saving LLM settings:", error)
        setError("Failed to save LLM settings")
        return
      }

      alert("✅ LLM settings saved")
    } catch (err) {
      console.error("Unexpected error saving LLM:", err)
      setError("An unexpected error occurred")
    } finally {
      setSavingLlm(false)
    }
  }

  const handleDeleteUser = async (userId: number) => {
    if (
      !confirm(
        "Are you sure you want to delete this user? This action cannot be undone.",
      )
    ) {
      return
    }

    try {
      const { error } = await supabase.from("users").delete().eq("id", userId)

      if (error) {
        console.error("Error deleting user:", error)
        alert("Failed to delete user")
        return
      }

      await fetchCompanyData()
      await fetchPropertyManagers()
    } catch (err) {
      console.error("Unexpected error:", err)
    }
  }

  const getUserTypeBadge = (userType: string) => {
    const badges: Record<string, { color: string; label: string }> = {
      master: { color: "bg-red-100 text-red-800", label: "Master" },
      corporate_administrator: {
        color: "bg-purple-100 text-purple-800",
        label: "Corp Admin",
      },
      property_manager: { color: "bg-blue-100 text-blue-800", label: "PM" },
      user: { color: "bg-green-100 text-green-800", label: "User" },
      vendor: { color: "bg-orange-100 text-orange-800", label: "Vendor" },
      attendee: { color: "bg-gray-100 text-gray-800", label: "Attendee" },
      owner: { color: "bg-blue-100 text-blue-800", label: "Owner" },
    }

    const badge = badges[userType] || {
      color: "bg-gray-100 text-gray-800",
      label: userType,
    }

    return (
      <span className={`text-xs px-2 py-1 rounded ${badge.color}`}>
        {badge.label}
      </span>
    )
  }

  const getManagerName = (managerId: number | null) => {
    if (!managerId) return "No manager assigned"
    const manager = propertyManagers.find((pm) => pm.id === managerId)
    return manager ? manager.name : "Unknown manager"
  }

  const getFilteredUsers = () => {
    if (userTypeFilter === "all") return users
    return users.filter((u) => u.user_type === userTypeFilter)
  }

  const handleAttachExistingBuilding = async () => {
    if (!company) return

    if (!selectedExistingBuildingId) {
      setError("Please select a building to attach")
      return
    }

    try {
      setError(null)

      const { error: updateError } = await supabase
        .from("buildings")
        .update({ company_id: company.id })
        .eq("id", selectedExistingBuildingId)

      if (updateError) {
        console.error("Error attaching building:", updateError)
        setError("Failed to attach building")
        return
      }

      await fetchCompanyData()
      await fetchAvailableBuildings()
      setSelectedExistingBuildingId("")
      setShowAttachExisting(false)
    } catch (err) {
      console.error("Unexpected error attaching building:", err)
      setError("An unexpected error occurred while attaching building")
    }
  }

  const toggleRole = (role: string) => {
    setSelectedRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role],
    )
  }

  if (!isOpen || !company) return null

  const corporateAdmins = users.filter(
    (u) => u.user_type === "corporate_administrator",
  )
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
            <button
              onClick={() => setActiveTab("usage_logs")}
              className={`pb-3 px-1 font-medium text-sm transition-colors ${
                activeTab === "usage_logs"
                  ? "border-b-2 border-primary text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <UserCog className="h-4 w-4 inline mr-2" />
              AI Usage Logs
            </button>
            <button
              onClick={() => setActiveTab("llm_config")}
              className={`pb-3 px-1 font-medium text-sm transition-colors ${
                activeTab === "llm_config"
                  ? "border-b-2 border-primary text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Cpu className="h-4 w-4 inline mr-2" />
              AI Settings
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
              {activeTab === "usage_logs" && (
                <SystemAuditTab companyId={company.id} />
              )}
              {activeTab === "llm_config" && (
                <div className="space-y-6">
                  <Card className="p-6 border-border">
                    <h3 className="text-xl font-bold text-foreground mb-4">
                      Company AI Settings
                    </h3>
                    <p className="text-sm text-muted-foreground mb-6">
                      Override the global AI configuration for this specific company. 
                      If set to 'System Default', the company will use the global model configured in the Admin Panel.
                    </p>

                    <div className="space-y-4 max-w-2xl">
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-2">
                          AI Provider Preference
                        </label>
                        <select
                          value={llmProvider}
                          onChange={(e) => setLlmProvider(e.target.value)}
                          className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                        >
                          <option value="global">System Default (Inherit)</option>
                          <option value="ollama">Ollama (Llama 3.2 - Local)</option>
                          <option value="gemini">Google Gemini (Gemini 1.5 Flash)</option>
                          <option value="openai">OpenAI (GPT-4o Mini)</option>
                        </select>
                      </div>

                      {llmProvider !== 'global' && llmProvider !== 'ollama' && (
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-foreground mb-2">
                              Custom API Key (Optional)
                            </label>
                            <input
                              type="password"
                              value={llmApiKey}
                              onChange={(e) => setLlmApiKey(e.target.value)}
                              placeholder={`Enter custom ${llmProvider === 'openai' ? 'OpenAI' : 'Gemini'} API Key...`}
                              className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-foreground mb-2">
                              Custom Model Name (Optional)
                            </label>
                            <input
                              type="text"
                              value={llmModel}
                              onChange={(e) => setLlmModel(e.target.value)}
                              placeholder={llmProvider === 'openai' ? 'gpt-4o-mini' : 'gemini-1.5-flash'}
                              className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                            />
                            <p className="text-xs text-muted-foreground mt-1">
                              {llmProvider === 'gemini'
                                ? 'Valid models: gemini-1.5-flash (recommended), gemini-1.5-flash-8b, gemini-1.5-pro'
                                : 'Valid models: gpt-4o-mini (recommended), gpt-4o, gpt-3.5-turbo'}
                            </p>
                          </div>
                          <p className="col-span-2 text-xs text-muted-foreground mt-2">
                            Leave blank to use the system default model. Only change if you know the exact model ID.
                          </p>
                        </div>
                      )}

                      <div className="pt-4 flex justify-end gap-3">
                        <Button 
                          onClick={handleSaveLlm}
                          disabled={savingLlm}
                          className="font-medium"
                        >
                          {savingLlm ? "Saving..." : "Save AI Settings"}
                        </Button>
                      </div>
                    </div>
                  </Card>
                </div>
              )}
              {activeTab === "overview" && (
                <div className="space-y-6">
                  <div className="grid grid-cols-3 gap-4">
                    <Card className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200 shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className="p-3 bg-blue-500 rounded-lg">
                          <Users className="h-6 w-6 text-white" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-blue-900">
                            {users.length}
                          </p>
                          <p className="text-sm text-blue-700">Total Users</p>
                        </div>
                      </div>
                    </Card>

                    <Card className="p-4 bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200 shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className="p-3 bg-purple-500 rounded-lg">
                          <UserCheck className="h-6 w-6 text-white" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-purple-900">
                            {corporateAdmins.length}
                          </p>
                          <p className="text-sm text-purple-700">Corp Admins</p>
                        </div>
                      </div>
                    </Card>

                    <Card className="p-4 bg-gradient-to-br from-green-50 to-green-100 border-green-200 shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className="p-3 bg-green-500 rounded-lg">
                          <Building2 className="h-6 w-6 text-white" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-green-900">
                            {buildings.length}
                          </p>
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
                      Configure email account for sending tasks and notifications. Leave
                      blank to use system default.
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
                      <label
                        htmlFor="smtp_use_tls"
                        className="text-xs text-foreground"
                      >
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
                    <h3 className="text-lg font-semibold text-foreground mb-3">
                      All Users
                    </h3>
                    {users.length === 0 ? (
                      <div className="text-center py-8 border-2 border-dashed border-border rounded-lg">
                        <p className="text-muted-foreground">
                          No users in this company
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {users.map((user) => (
                          <Card
                            key={user.id}
                            className="p-3 hover:shadow-sm transition-shadow"
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-medium text-foreground">
                                  {user.name}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  {user.email}
                                </p>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {(user.roles && user.roles.length > 0
                                  ? user.roles
                                  : [user.user_type]
                                ).map((role) => (
                                  <span key={role}>
                                    {getUserTypeBadge(role)}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </Card>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === "buildings" && (
                <div className="space-y-4">
                  {error && (
                    <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded text-sm">
                      {error}
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-foreground">
                      Buildings
                    </h3>
                    {userCanManageCompanies && (
                      <div className="flex gap-2">
                        {isMaster && (
                          <Button
                            onClick={() =>
                              setShowAttachExisting((prev) => {
                                const next = !prev
                                if (next && availableBuildings.length === 0) {
                                  fetchAvailableBuildings()
                                }
                                if (!next) {
                                  setSelectedExistingBuildingId("")
                                }
                                return next
                              })
                            }
                            size="sm"
                            variant="outline"
                            className="text-blue-700 border-blue-300 hover:bg-blue-50"
                          >
                            <Building2 className="h-4 w-4 mr-2" />
                            Attach Existing
                          </Button>
                        )}
                        <Button
                          onClick={() => {
                            setShowAddBuilding(!showAddBuilding)
                            setError(null)
                          }}
                          size="sm"
                          className="bg-green-600 hover:bg-green-700 text-white"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add Building
                        </Button>
                      </div>
                    )}
                  </div>

                  {isMaster && showAttachExisting && (
                    <Card className="p-4 bg-blue-50 border-blue-200">
                      <h4 className="font-semibold text-foreground mb-3">
                        Attach Existing Building
                      </h4>
                      {loadingAvailableBuildings ? (
                        <p className="text-sm text-muted-foreground">
                          Loading buildings...
                        </p>
                      ) : availableBuildings.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          No buildings found.
                        </p>
                      ) : (
                        <div className="space-y-3">
                          <select
                            value={selectedExistingBuildingId || ""}
                            onChange={(e) =>
                              setSelectedExistingBuildingId(
                                e.target.value ? Number(e.target.value) : "",
                              )
                            }
                            className="w-full px-3 py-2 bg-white border border-border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="">
                              Select a building to attach
                            </option>
                            {availableBuildings.map((b) => (
                              <option key={b.id} value={b.id}>
                                {b.name}
                                {b.address ? ` – ${b.address}` : ""}
                                {b.company_id
                                  ? " (currently assigned)"
                                  : " (unassigned)"}
                              </option>
                            ))}
                          </select>
                          <p className="text-xs text-muted-foreground">
                            Attaching will set this building&apos;s company to{" "}
                            {company.name}. If it already belongs to another
                            company, it will be moved.
                          </p>
                          <div className="flex gap-2">
                            <Button
                              onClick={() => {
                                setShowAttachExisting(false)
                                setSelectedExistingBuildingId("")
                                setError(null)
                              }}
                              variant="outline"
                              size="sm"
                              className="flex-1"
                            >
                              Cancel
                            </Button>
                            <Button
                              onClick={handleAttachExistingBuilding}
                              size="sm"
                              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                            >
                              Attach Building
                            </Button>
                          </div>
                        </div>
                      )}
                    </Card>
                  )}

                  {userCanManageCompanies && showAddBuilding && (
                    <Card className="p-4 bg-green-50 border-green-200">
                      <h4 className="font-semibold text-foreground mb-3">
                        New Building
                      </h4>
                      <div className="space-y-3">
                        <input
                          type="text"
                          value={newBuildingName}
                          onChange={(e) => setNewBuildingName(e.target.value)}
                          placeholder="Building Name *"
                          className="w-full px-3 py-2 bg-white border border-border rounded"
                        />
                        <input
                          type="text"
                          value={newBuildingAddress}
                          onChange={(e) => setNewBuildingAddress(e.target.value)}
                          placeholder="Address (optional)"
                          className="w-full px-3 py-2 bg-white border border-border rounded"
                        />

                        <div className="space-y-2">
                          <select
                            value={selectedManagerId || ""}
                            onChange={(e) =>
                              setSelectedManagerId(Number(e.target.value))
                            }
                            className="w-full px-3 py-2 bg-white border border-border rounded focus:outline-none focus:ring-2 focus:ring-green-500"
                          >
                            <option value="">Select Property Manager *</option>
                            {propertyManagers.map((pm) => (
                              <option key={pm.id} value={pm.id}>
                                {pm.name} ({pm.email})
                              </option>
                            ))}
                          </select>

                          <Button
                            onClick={() => setShowCreatePM(!showCreatePM)}
                            size="sm"
                            variant="outline"
                            className="w-full"
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            {showCreatePM ? "Cancel" : "Create New Property Manager"}
                          </Button>
                        </div>

                        {showCreatePM && (
                          <Card className="p-3 bg-blue-50 border-blue-200">
                            <h5 className="text-sm font-semibold mb-2 text-foreground">
                              Create Property Manager
                            </h5>
                            <div className="space-y-2">
                              <input
                                type="text"
                                value={newPMName}
                                onChange={(e) => setNewPMName(e.target.value)}
                                placeholder="Name *"
                                className="w-full px-2 py-1.5 bg-white border border-border rounded text-sm"
                              />
                              <input
                                type="email"
                                value={newPMEmail}
                                onChange={(e) => setNewPMEmail(e.target.value)}
                                placeholder="Email *"
                                className="w-full px-2 py-1.5 bg-white border border-border rounded text-sm"
                              />
                              <input
                                type="password"
                                value={newPMPassword}
                                onChange={(e) => setNewPMPassword(e.target.value)}
                                placeholder="Password *"
                                className="w-full px-2 py-1.5 bg-white border border-border rounded text-sm"
                              />
                              <Button
                                onClick={handleCreatePM}
                                disabled={savingPM}
                                size="sm"
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                              >
                                {savingPM ? "Creating..." : "Create PM"}
                              </Button>
                            </div>
                          </Card>
                        )}

                        <div className="flex gap-2">
                          <Button
                            onClick={() => {
                              setShowAddBuilding(false)
                              setError(null)
                            }}
                            variant="outline"
                            size="sm"
                            className="flex-1"
                          >
                            Cancel
                          </Button>
                          <Button
                            onClick={handleAddBuilding}
                            disabled={savingBuilding}
                            size="sm"
                            className="flex-1 bg-green-600 hover:bg-green-700 text-white"
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
                      <p className="text-muted-foreground">
                        No buildings in this company
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {buildings.map((building) => (
                        <Card
                          key={building.id}
                          className="p-4 hover:shadow-sm transition-shadow"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium text-foreground">
                                {building.name}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {building.address || "No address"}
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">
                                Manager: {getManagerName(building.manager_id)}
                              </p>
                            </div>
                            {userCanManageCompanies && (
                              <Button
                                onClick={() => handleDeleteBuilding(building.id)}
                                size="sm"
                                variant="destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === "users" && (
                <div className="space-y-4">
                  {error && (
                    <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded text-sm">
                      {error}
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-foreground">
                      Users
                    </h3>
                    {userCanManageCompanies && (
                      <div className="flex gap-2">
                        {isMaster && (
                          <Button
                            onClick={() => {
                              setShowAttachExistingUser((prev) => {
                                const next = !prev
                                if (next && availableUsersForAttachment.length === 0) {
                                  fetchAvailableUsersForAttachment()
                                }
                                if (!next) {
                                  setSelectedExistingUserId("")
                                }
                                return next
                              })
                            }}
                            size="sm"
                            variant="outline"
                            className="text-blue-700 border-blue-300 hover:bg-blue-50"
                          >
                            <UserCog className="h-4 w-4 mr-2" />
                            Attach Existing
                          </Button>
                        )}
                        <Button
                          onClick={() => {
                            setShowAddUser(!showAddUser)
                            setError(null)
                          }}
                          size="sm"
                          className="bg-green-600 hover:bg-green-700 text-white"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add User
                        </Button>
                      </div>
                    )}
                  </div>

                  {isMaster && showAttachExistingUser && (
                    <Card className="p-4 bg-blue-50 border-blue-200">
                      <h4 className="font-semibold text-foreground mb-3">
                        Attach Existing User
                      </h4>
                      {loadingAvailableUsers ? (
                        <p className="text-sm text-muted-foreground">
                          Loading users...
                        </p>
                      ) : availableUsersForAttachment.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          No available users found.
                        </p>
                      ) : (
                        <div className="space-y-3">
                          <select
                            value={selectedExistingUserId || ""}
                            onChange={(e) =>
                              setSelectedExistingUserId(
                                e.target.value ? Number(e.target.value) : "",
                              )
                            }
                            className="w-full px-3 py-2 bg-white border border-border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="">Select a user to attach</option>
                            {availableUsersForAttachment.map((u) => (
                              <option key={u.id} value={u.id}>
                                {u.name} ({u.email}) - {u.user_type}
                                {u.company_id
                                  ? " (currently assigned)"
                                  : " (unassigned)"}
                              </option>
                            ))}
                          </select>
                          <p className="text-xs text-muted-foreground">
                            Attaching will set this user&apos;s company to{" "}
                            {company.name}. If they already belong to another
                            company, they will be moved.
                          </p>
                          <div className="flex gap-2">
                            <Button
                              onClick={() => {
                                setShowAttachExistingUser(false)
                                setSelectedExistingUserId("")
                                setError(null)
                              }}
                              variant="outline"
                              size="sm"
                              className="flex-1"
                            >
                              Cancel
                            </Button>
                            <Button
                              onClick={handleAttachExistingUser}
                              size="sm"
                              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                            >
                              Attach User
                            </Button>
                          </div>
                        </div>
                      )}
                    </Card>
                  )}

                  {userCanManageCompanies && showAddUser && (
                    <Card className="p-4 bg-green-50 border-green-200">
                      <h4 className="font-semibold text-foreground mb-3">
                        New User
                      </h4>
                      <div className="space-y-3">
                        <input
                          type="text"
                          value={newUserName}
                          onChange={(e) => setNewUserName(e.target.value)}
                          placeholder="Name *"
                          className="w-full px-3 py-2 bg-white border border-border rounded"
                        />
                        <input
                          type="email"
                          value={newUserEmail}
                          onChange={(e) => setNewUserEmail(e.target.value)}
                          placeholder="Email *"
                          className="w-full px-3 py-2 bg-white border border-border rounded"
                        />
                        <input
                          type="password"
                          value={newUserPassword}
                          onChange={(e) => setNewUserPassword(e.target.value)}
                          placeholder="Password *"
                          className="w-full px-3 py-2 bg-white border border-border rounded"
                        />

                        <div>
                          <p className="text-sm font-medium text-foreground mb-2">
                            Select Roles *
                          </p>
                          <div className="grid grid-cols-2 gap-2">
                            {ALL_ROLES.map((role) => (
                              <label
                                key={role.value}
                                className="flex items-center gap-2 text-sm"
                              >
                                <input
                                  type="checkbox"
                                  checked={selectedRoles.includes(role.value)}
                                  onChange={() => toggleRole(role.value)}
                                  className="h-4 w-4"
                                />
                                {role.label}
                              </label>
                            ))}
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <Button
                            onClick={() => {
                              setShowAddUser(false)
                              setError(null)
                            }}
                            variant="outline"
                            size="sm"
                            className="flex-1"
                          >
                            Cancel
                          </Button>
                          <Button
                            onClick={handleAddUser}
                            disabled={savingUser}
                            size="sm"
                            className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                          >
                            {savingUser ? "Adding..." : "Add User"}
                          </Button>
                        </div>
                      </div>
                    </Card>
                  )}

                  <div className="flex items-center gap-2 mb-2">
                    <label className="text-sm font-medium text-foreground">
                      Filter by Type:
                    </label>
                    <select
                      value={userTypeFilter}
                      onChange={(e) => setUserTypeFilter(e.target.value)}
                      className="px-3 py-1.5 bg-white border border-border rounded text-sm"
                    >
                      <option value="all">All Users</option>
                      <option value="user">Users</option>
                      <option value="owner">Owners</option>
                      <option value="property_manager">Property Managers</option>
                      <option value="vendor">Vendors</option>
                      <option value="attendee">Attendees</option>
                    </select>
                  </div>

                  {filteredUsers.length === 0 ? (
                    <div className="text-center py-12 border-2 border-dashed border-border rounded-lg">
                      <Users className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                      <p className="text-muted-foreground">
                        No users match this filter
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {filteredUsers.map((user) => (
                        <Card
                          key={user.id}
                          className="p-4 hover:shadow-sm transition-shadow"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium text-foreground">
                                {user.name}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {user.email}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="flex flex-wrap gap-1">
                                {(user.roles && user.roles.length > 0
                                  ? user.roles
                                  : [user.user_type]
                                ).map((role) => (
                                  <span key={role}>{getUserTypeBadge(role)}</span>
                                ))}
                              </div>
                              {userCanManageCompanies && (
                                <Button
                                  onClick={() => handleDeleteUser(user.id)}
                                  size="sm"
                                  variant="destructive"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === "admins" && (
                <div className="space-y-4">
                  {error && (
                    <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded text-sm">
                      {error}
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-foreground">
                      Corporate Administrators
                    </h3>
                    {isMaster && (
                      <Button
                        onClick={() => {
                          setShowAddAdmin(!showAddAdmin)
                          setError(null)
                        }}
                        size="sm"
                        className="bg-purple-600 hover:bg-purple-700 text-white"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Administrator
                      </Button>
                    )}
                  </div>

                  {/* ⭐ UPDATED: Load All Users button removed — users auto-load on tab open */}
                  {isMaster && (
                    <Card className="p-4 bg-purple-50 border-purple-200">
                      <h4 className="font-semibold text-foreground mb-3">
                        Make Existing User an Administrator
                      </h4>

                      <div className="space-y-3">
                        {loadingAvailableUsers ? (
                          <p className="text-sm text-muted-foreground">Loading users...</p>
                        ) : (
                          <select
                            value={selectedAdminUserId || ""}
                            onChange={(e) =>
                              setSelectedAdminUserId(
                                e.target.value ? Number(e.target.value) : ""
                              )
                            }
                            className="w-full px-3 py-2 bg-white border border-border rounded"
                          >
                            <option value="">Select user from all users *</option>
                            {availableUsersForAttachment.map((u) => (
                              <option key={u.id} value={u.id}>
                                {u.name} ({u.email}) - {u.user_type}
                              </option>
                            ))}
                          </select>
                        )}

                        <p className="text-xs text-muted-foreground">
                          This will update the selected user to a{" "}
                          <strong>Corporate Administrator</strong> for this company.
                        </p>

                        <div className="flex gap-2">
                          <Button
                            onClick={handlePromoteToAdmin}
                            size="sm"
                            className="flex-1 bg-purple-600 hover:bg-purple-700 text-white"
                            disabled={!selectedAdminUserId || promotingAdmin}
                          >
                            {promotingAdmin ? "Updating..." : "Make Administrator"}
                          </Button>
                          <Button
                            onClick={() => {
                              setSelectedAdminUserId("")
                              setError(null)
                            }}
                            variant="outline"
                            size="sm"
                            className="flex-1"
                          >
                            Clear Selection
                          </Button>
                        </div>
                      </div>
                    </Card>
                  )}

                  {/* Existing: Create brand-new admin - MASTER ONLY */}
                  {isMaster && showAddAdmin && (
                    <Card className="p-4 bg-purple-50 border-purple-200">
                      <h4 className="font-semibold text-foreground mb-3">
                        New Administrator
                      </h4>
                      <div className="space-y-3">
                        <input
                          type="text"
                          value={newAdminName}
                          onChange={(e) => setNewAdminName(e.target.value)}
                          placeholder="Name *"
                          className="w-full px-3 py-2 bg-white border border-border rounded"
                        />
                        <input
                          type="email"
                          value={newAdminEmail}
                          onChange={(e) => setNewAdminEmail(e.target.value)}
                          placeholder="Email *"
                          className="w-full px-3 py-2 bg-white border border-border rounded"
                        />
                        <input
                          type="password"
                          value={newAdminPassword}
                          onChange={(e) => setNewAdminPassword(e.target.value)}
                          placeholder="Password *"
                          className="w-full px-3 py-2 bg-white border border-border rounded"
                        />
                        <div className="flex gap-2">
                          <Button
                            onClick={() => {
                              setShowAddAdmin(false)
                              setError(null)
                            }}
                            variant="outline"
                            size="sm"
                            className="flex-1"
                          >
                            Cancel
                          </Button>
                          <Button
                            onClick={handleAddAdmin}
                            disabled={savingAdmin}
                            size="sm"
                            className="flex-1 bg-purple-600 hover:bg-purple-700 text-white"
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
                      <p className="text-muted-foreground">
                        No administrators in this company
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {corporateAdmins.map((admin) => (
                        <Card
                          key={admin.id}
                          className="p-4 hover:shadow-sm transition-shadow"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium text-foreground">{admin.name}</p>
                              <p className="text-sm text-muted-foreground">
                                {admin.email}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="flex flex-wrap gap-1">
                                {(admin.roles && admin.roles.length > 0
                                  ? admin.roles
                                  : [admin.user_type]
                                ).map((role) => (
                                  <span key={role}>{getUserTypeBadge(role)}</span>
                                ))}
                              </div>
                              {userCanManageCompanies && (
                                <Button
                                  onClick={() => handleDeleteUser(admin.id)}
                                  size="sm"
                                  variant="destructive"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === "logo" && company && (
                <LogoTab
                  companyId={company.id}
                  currentLogoUrl={company.logo_url || null}
                  onLogoUpdate={fetchCompanyDetails}
                />
              )}
            </>
          )}
        </div>
      </Card>
    </div>
  )
}
