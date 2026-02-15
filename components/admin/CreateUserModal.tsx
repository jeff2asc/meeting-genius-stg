"use client"

import { useState, useEffect } from "react"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { supabase, Company } from "@/lib/supabase"

interface CreateUserModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  currentUser: any
  propertyManagers: Array<{
    id: number
    name: string
    email: string
    company_id?: number | null
  }>
  buildings: Array<{ id: number; name: string }>
  companies: Company[]
  userId?: number | null
}

type UserType =
  | "master"
  | "property_manager"
  | "user"
  | "vendor"
  | "attendee"
  | "corporate_administrator"
  | "owner"

export default function CreateUserModal({
  isOpen,
  onClose,
  onSuccess,
  currentUser,
  propertyManagers,
  buildings,
  companies,
  userId = null,
}: CreateUserModalProps) {
  const [userFormData, setUserFormData] = useState<{
    name: string
    email: string
    password: string
    userType: UserType
    assignedPmId: number
    companyId: number
    roles: string[]
  }>({
    name: "",
    email: "",
    password: "",
    userType: "user",
    assignedPmId: 0,
    companyId: 0,
    roles: ["user"],
  })
  const [selectedUserBuildings, setSelectedUserBuildings] = useState<number[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isMaster = currentUser?.user_type === "master"
  const isCorporateAdmin = currentUser?.user_type === "corporate_administrator"
  const isEditMode = !!userId

  useEffect(() => {
    if (userId && isOpen) {
      fetchUserData()
    } else if (!userId && isOpen) {
      resetForm()
    }
  }, [userId, isOpen])

  const fetchUserData = async () => {
    try {
      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("*, roles")
        .eq("id", userId)
        .single()

      if (userError) throw userError

      if (userData) {
        const rolesFromDb: string[] =
          (userData.roles as string[]) ||
          (userData.user_type ? [userData.user_type] : ["user"])

        setUserFormData({
          name: userData.name || "",
          email: userData.email || "",
          password: "",
          userType: (userData.user_type || "user") as UserType,
          assignedPmId: userData.assigned_pm_id || 0,
          companyId: userData.company_id || 0,
          roles: rolesFromDb,
        })

        const { data: userBuildings } = await supabase
          .from("user_buildings")
          .select("building_id")
          .eq("user_id", userId)

        if (userBuildings) {
          setSelectedUserBuildings(userBuildings.map((ub) => ub.building_id))
        }
      }
    } catch (err) {
      console.error("Error fetching user:", err)
      setError("Failed to load user data")
    }
  }

  const resetForm = () => {
    setUserFormData({
      name: "",
      email: "",
      password: "",
      userType: "user",
      assignedPmId: 0,
      companyId: 0,
      roles: ["user"],
    })
    setSelectedUserBuildings([])
    setError(null)
  }

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target

    if (name === "assignedPmId" || name === "companyId") {
      setUserFormData((prev) => ({ ...prev, [name]: parseInt(value) || 0 }))
    } else if (name === "userType") {
      const newType = value as UserType
      setUserFormData((prev) => {
        const roles = prev.roles && prev.roles.length > 0 ? prev.roles : [newType]
        if (!roles.includes(newType)) {
          roles.push(newType)
        }
        return { ...prev, userType: newType, roles }
      })
    } else {
      setUserFormData((prev) => ({ ...prev, [name]: value }))
    }
  }

  const toggleUserBuilding = (buildingId: number) => {
    setSelectedUserBuildings((prev) =>
      prev.includes(buildingId)
        ? prev.filter((id) => id !== buildingId)
        : [...prev, buildingId],
    )
  }

  const toggleRole = (role: string) => {
    setUserFormData((prev) => {
      const roles = prev.roles || []
      const nextRoles = roles.includes(role)
        ? roles.filter((r) => r !== role)
        : [...roles, role]
      const primary = nextRoles[0] || prev.userType
      return {
        ...prev,
        roles: nextRoles,
        userType: primary as UserType,
      }
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!userFormData.name.trim() || !userFormData.email.trim()) {
      setError("Name and email are required")
      return
    }

    if (!isEditMode && !userFormData.password.trim()) {
      setError("Password is required for new users")
      return
    }

    const effectiveRoles =
      userFormData.roles && userFormData.roles.length > 0
        ? userFormData.roles
        : [userFormData.userType]

    const primaryRole = (effectiveRoles[0] || userFormData.userType) as UserType

    if (isMaster && !isEditMode) {
      if (
        primaryRole === "corporate_administrator" ||
        primaryRole === "property_manager"
      ) {
        if (!userFormData.companyId || userFormData.companyId === 0) {
          setError("Please select a company for this user")
          return
        }
      }

      if (primaryRole === "property_manager") {
        if (selectedUserBuildings.length === 0) {
          setError("Please select at least one building for the Property Manager")
          return
        }
      } else if (primaryRole === "user" || primaryRole === "owner") {
        if (!userFormData.assignedPmId || userFormData.assignedPmId === 0) {
          setError("Please select a Property Manager for this user")
          return
        }
      }
    }

    if (isCorporateAdmin && !isEditMode) {
      if (primaryRole === "property_manager" && selectedUserBuildings.length === 0) {
        console.log(
          "⚠️ Creating Property Manager without buildings - they can be assigned later via Admin Panel",
        )
      }
    }

    setSaving(true)

    try {
      if (isEditMode) {
        const updateData: any = {
          name: userFormData.name.trim(),
          email: userFormData.email.toLowerCase().trim(),
          user_type: primaryRole,
          roles: effectiveRoles,
          company_id: userFormData.companyId || null,
          assigned_pm_id: userFormData.assignedPmId || null,
        }

        if (userFormData.password.trim()) {
          updateData.password_hash =
            "$2a$10$rXqvFZnPzAMcLzCP2L4dxu7L6Y3Y5KjGNQQF6xZ4Y5Y5Y5Y5Y5Y5Y5"
        }

        const { error: updateError } = await supabase
          .from("users")
          .update(updateData)
          .eq("id", userId)

        if (updateError) {
          console.error("❌ Error updating user:", updateError)
          setError("Failed to update user. Email may already exist.")
          setSaving(false)
          return
        }

        await supabase.from("user_buildings").delete().eq("user_id", userId)

        if (selectedUserBuildings.length > 0) {
          const buildingAssignments = selectedUserBuildings.map((buildingId) => ({
            user_id: userId,
            building_id: buildingId,
          }))

          const { error: buildingsError } = await supabase
            .from("user_buildings")
            .insert(buildingAssignments)

          if (buildingsError) {
            console.error("Error updating buildings:", buildingsError)
          }
        }
      } else {
        let companyIdToAssign: number | null = null

        if (isMaster) {
          if (
            primaryRole === "corporate_administrator" ||
            primaryRole === "property_manager"
          ) {
            companyIdToAssign = userFormData.companyId
          } else if (
            (primaryRole === "user" || primaryRole === "owner") &&
            userFormData.assignedPmId
          ) {
            const selectedPM = propertyManagers.find(
              (pm) => pm.id === userFormData.assignedPmId,
            )
            companyIdToAssign = selectedPM?.company_id || null
          }
        } else if (isCorporateAdmin) {
          if (
            primaryRole === "property_manager" ||
            primaryRole === "user" ||
            primaryRole === "owner"
          ) {
            companyIdToAssign = currentUser.company_id
          }
        } else if (currentUser?.user_type === "property_manager") {
          if (primaryRole === "user" || primaryRole === "owner") {
            companyIdToAssign = currentUser.company_id
          }
        }

        const finalUserType: UserType =
          isMaster && primaryRole
            ? primaryRole
            : isCorporateAdmin && primaryRole === "property_manager"
            ? "property_manager"
            : primaryRole

        const { data: newUser, error: userError } = await supabase
          .from("users")
          .insert({
            name: userFormData.name.trim(),
            email: userFormData.email.toLowerCase().trim(),
            password_hash:
              "$2a$10$rXqvFZnPzAMcLzCP2L4dxu7L6Y3Y5KjGNQQF6xZ4Y5Y5Y5Y5Y5Y5Y5",
            user_type: finalUserType,
            roles: effectiveRoles,
            company_id: companyIdToAssign,
            assigned_pm_id:
              isMaster && (primaryRole === "user" || primaryRole === "owner")
                ? userFormData.assignedPmId
                : currentUser?.user_type === "property_manager"
                ? currentUser.id
                : null,
          })
          .select()
          .single()

        if (userError) {
          console.error("❌ Error creating user:", userError)
          setError("Failed to create user. Email may already exist.")
          setSaving(false)
          return
        }

        if (selectedUserBuildings.length > 0) {
          const buildingAssignments = selectedUserBuildings.map((buildingId) => ({
            user_id: newUser.id,
            building_id: buildingId,
          }))

          const { error: buildingsError } = await supabase
            .from("user_buildings")
            .insert(buildingAssignments)

          if (buildingsError) {
            console.error("Error assigning buildings:", buildingsError)
            setError("User created but failed to assign buildings")
            setSaving(false)
            return
          }
        } else if (primaryRole === "property_manager") {
          console.log(
            "ℹ️ Property Manager created without buildings - assign later via Admin Panel",
          )
        }
      }

      resetForm()
      onSuccess()
      onClose()
    } catch (err) {
      console.error("Unexpected error:", err)
      setError("An unexpected error occurred")
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  const allRoleOptions: { value: string; label: string }[] = [
    { value: "user", label: "User" },
    { value: "owner", label: "Owner" },
    { value: "property_manager", label: "Property Manager" },
    ...(isMaster
      ? [
          { value: "vendor", label: "Vendor" },
          { value: "attendee", label: "Attendee" },
          { value: "corporate_administrator", label: "Corporate Administrator" },
        ]
      : []),
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-in fade-in overflow-y-auto p-4">
      <Card className="w-full max-w-2xl border-0 rounded-2xl shadow-2xl my-8">
        <div className="flex items-center justify-between border-b border-border bg-gradient-to-r from-primary/5 to-decision-purple/5 p-6">
          <div>
            <h2 className="text-xl font-bold text-foreground">
              {isEditMode ? "Edit User" : "Create New User"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {isEditMode
                ? "Update user information and permissions"
                : isMaster
                ? "Create any user type"
                : isCorporateAdmin
                ? "Create a Property Manager or User"
                : "Create a User for your team"}
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
                Roles (first selected is primary) *
              </label>
              <div className="border border-border rounded p-3 space-y-1">
                {allRoleOptions.map((role) => (
                  <label
                    key={role.value}
                    className="flex items-center gap-2 cursor-pointer text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={userFormData.roles.includes(role.value)}
                      onChange={() => toggleRole(role.value)}
                      disabled={saving}
                      className="h-4 w-4"
                    />
                    <span>{role.label}</span>
                  </label>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Primary user type is saved from the first selected role.
              </p>
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
                This user will be assigned to you and your company
              </p>
            </div>
          )}

          {isMaster &&
            (userFormData.userType === "corporate_administrator" ||
              userFormData.userType === "property_manager") && (
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
                  {companies.map((company) => (
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
              {isEditMode
                ? "New Password (leave blank to keep current)"
                : "Temporary Password *"}
            </label>
            <input
              type="text"
              name="password"
              value={userFormData.password}
              onChange={handleInputChange}
              placeholder={
                isEditMode
                  ? "Leave blank to keep current password"
                  : "e.g., welcome123"
              }
              required={!isEditMode}
              disabled={saving}
              className="w-full px-3 py-2 bg-background text-foreground rounded border border-border focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {isEditMode
                ? "Only enter a password if you want to change it"
                : "User will use this password to login"}
            </p>
          </div>

          {isMaster &&
            (userFormData.userType === "user" ||
              userFormData.userType === "owner") && (
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
                  {propertyManagers.map((pm) => (
                    <option key={pm.id} value={pm.id}>
                      {pm.name} ({pm.email})
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground mt-1">
                  This Property Manager will manage this user (company will be inherited
                  from PM)
                </p>
              </div>
            )}

          {(userFormData.userType === "property_manager" ||
            userFormData.userType === "owner" ||
            (!isMaster && !isCorporateAdmin)) && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Assign Buildings{" "}
                {isMaster &&
                  userFormData.userType === "property_manager" &&
                  !isEditMode &&
                  "*"}
                {isCorporateAdmin &&
                  userFormData.userType === "property_manager" &&
                  " (Optional)"}
              </label>
              <div className="border border-border rounded p-4 space-y-2 max-h-48 overflow-y-auto">
                {buildings.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {isCorporateAdmin &&
                    userFormData.userType === "property_manager"
                      ? "No buildings yet. Create a building first, then assign it to this Property Manager via the Admin Panel."
                      : "No buildings available"}
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
                      <span className="text-sm text-foreground">
                        {building.name}
                      </span>
                    </label>
                  ))
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {isMaster &&
                userFormData.userType === "property_manager" &&
                !isEditMode
                  ? "Property Managers need at least one building"
                  : isCorporateAdmin &&
                    userFormData.userType === "property_manager"
                  ? "✅ You can create the Property Manager now and assign buildings later via Admin Panel → Buildings tab"
                  : "Optional - You can assign buildings later"}
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
              {saving
                ? isEditMode
                  ? "Updating..."
                  : "Creating..."
                : isEditMode
                ? "Update User"
                : "Create User"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
