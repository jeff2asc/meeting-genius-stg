"use client"

import { useState, useEffect } from "react"
import { X, Check, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { supabase, Company, getVotingParameters } from "@/lib/supabase"
import { hashPassword } from "@/lib/auth"
import { isMaster as checkIsMaster, isCorporateAdmin as checkIsCorporateAdmin, isPropertyManager as checkIsPropertyManager } from "@/lib/permissions"
import { triggerJanusResync } from "@/lib/janus"
import { fetchJanusUserByEmail } from "@/lib/janus-client"

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
  buildings: Array<{ id: number; name: string; company_id?: number | null }>
  onCreateBuilding?: (managerId: number, companyId: number) => void
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
  | "resident"

export default function CreateUserModal({
  isOpen,
  onClose,
  onSuccess,
  currentUser,
  propertyManagers,
  buildings,
  companies,
  onCreateBuilding,
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
    voting_weight: number
  }>({
    name: "",
    email: "",
    password: "",
    userType: "user",
    assignedPmId: 0,
    companyId: 0,
    roles: ["user"] as string[],
    voting_weight: 1.0,
  })
  const [selectedUserBuildings, setSelectedUserBuildings] = useState<Array<{ id: number; unit_number: string; voting_weight: string }>>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [userTypes, setUserTypes] = useState<string[]>([])

  useEffect(() => {
    if (isOpen) {
      fetchUserTypes()
    }
  }, [isOpen])

  const fetchUserTypes = async () => {
    const params = await getVotingParameters(currentUser?.company_id)
    const types = params.filter(p => p.parameter_type === 'user_type').map(p => p.value)
    setUserTypes([...new Set(types)])
  }

  const isMaster = checkIsMaster(currentUser)
  const isCorporateAdmin = checkIsCorporateAdmin(currentUser)
  const isPropertyManager = checkIsPropertyManager(currentUser)
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
        .eq("id", userId!)
        .single()

      if (userError) throw userError

      if (userData) {
        const rolesFromDb: string[] = Array.from(
          new Set(
            [userData.user_type, ...(userData.roles || [])].filter(Boolean),
          ),
        ) as string[]

        if (rolesFromDb.length === 0) rolesFromDb.push("user")

        setUserFormData({
          name: userData.name || "",
          email: userData.email || "",
          password: "",
          userType: (rolesFromDb[0] || "user") as UserType,
          assignedPmId: userData.assigned_pm_id || 0,
          companyId: userData.company_id || 0,
          roles: rolesFromDb,
          voting_weight: userData.voting_weight ?? 1.0,
        })

        const { data: userBuildings } = await supabase
          .from("user_buildings")
          .select("building_id, unit_number, voting_weight")
          .eq("user_id", userId!)

        if (userBuildings) {
          setSelectedUserBuildings(userBuildings.map((ub) => ({ 
            id: ub.building_id, 
            unit_number: ub.unit_number || "",
            voting_weight: (ub.voting_weight ?? 1.00).toString()
          })))
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
      voting_weight: 1.0,
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
    setSelectedUserBuildings((prev) => {
      const exists = prev.find((b) => b.id === buildingId)
      if (exists) {
        return prev.filter((b) => b.id !== buildingId)
      } else {
        // Auto-select company if Master and no company selected
        if (isMaster && (userFormData.companyId === 0)) {
          const building = buildings.find(b => b.id === buildingId)
          if (building?.company_id) {
            setUserFormData(prev => ({ ...prev, companyId: building.company_id as number }))
          }
        }
        return [...prev, { id: buildingId, unit_number: "", voting_weight: "1.00" }]
      }
    })
  }

  const updateBuildingUnit = (buildingId: number, unit: string) => {
    setSelectedUserBuildings((prev) =>
      prev.map((b) => (b.id === buildingId ? { ...b, unit_number: unit } : b)),
    )
  }

  const updateBuildingWeight = (buildingId: number, weight: string) => {
    setSelectedUserBuildings((prev) =>
      prev.map((b) => (b.id === buildingId ? { ...b, voting_weight: weight } : b)),
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

  const handleEmailBlur = async () => {
    if (isEditMode || !userFormData.email.includes("@")) return

    console.log("🔍 Checking Janus for existing user:", userFormData.email)
    const janusUser = await fetchJanusUserByEmail(userFormData.email)

    if (janusUser) {
      console.log("✅ Janus user found:", janusUser)
      
      // Auto-fill name if empty
      if (!userFormData.name) {
        setUserFormData(prev => ({ ...prev, name: janusUser.name || "" }))
      }

      // Auto-fill buildings/units
      if (janusUser.properties && janusUser.properties.length > 0) {
        const newBuildings = janusUser.properties
          .filter((p: any) => buildings.some(b => b.id === p.building_id))
          .map((p: any) => ({
            id: p.building_id,
            unit_number: p.unit_number || "",
            voting_weight: "1.00"
          }))

        if (newBuildings.length > 0) {
          setSelectedUserBuildings(newBuildings)
          
          // If Master, also auto-fill company from the first building
          if (isMaster) {
            const firstProp = janusUser.properties[0]
            if (firstProp.company_id) {
              setUserFormData(prev => ({ ...prev, companyId: firstProp.company_id }))
            }
          }
        }
      }

      setError("ℹ️ This user exists in Janus. We've auto-filled their details.")
      setTimeout(() => setError(null), 5000)
    }
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

    }

    if (isCorporateAdmin && !isEditMode) {
      if (primaryRole === "property_manager" && selectedUserBuildings.length === 0) {
        console.log(
          "⚠️ Creating Property Manager without buildings - they can be assigned later via Admin Panel",
        )
      }
    }

    setSaving(true)
    
    let userIdToAssign: number | null = userId
    let finalUserType: UserType = primaryRole
    let companyIdToAssign: number | null = null

    try {
      // ✅ Hash the password properly using bcrypt
      const hashedPassword = userFormData.password.trim()
        ? await hashPassword(userFormData.password.trim())
        : null

      if (isEditMode) {
        const updateData: any = {
          name: userFormData.name.trim(),
          email: userFormData.email.toLowerCase().trim(),
          user_type: primaryRole,
          roles: effectiveRoles,
          company_id: userFormData.companyId || null,
          assigned_pm_id: userFormData.assignedPmId || null,
          voting_weight: userFormData.voting_weight ?? 1.0,
        }
        
        companyIdToAssign = userFormData.companyId || null

        // ✅ Only update password_hash if a new password was provided
        if (hashedPassword) {
          updateData.password_hash = hashedPassword
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
          const buildingAssignments = selectedUserBuildings.map((b) => ({
            user_id: userId,
            building_id: b.id,
            unit_number: b.unit_number.trim() || null,
            voting_weight: parseFloat(b.voting_weight) ?? 1.00,
            user_building_type: userFormData.userType
          }))

          const { error: buildingsError } = await supabase
            .from("user_buildings")
            .insert(buildingAssignments)

          if (buildingsError) {
            console.error("Error updating buildings:", buildingsError)
          }
        }
      } else {
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
        } else if (isCorporateAdmin || isPropertyManager) {
          companyIdToAssign = currentUser.company_id
        }

        finalUserType =
          isMaster && primaryRole
            ? primaryRole
            : isCorporateAdmin && primaryRole === "property_manager"
              ? "property_manager"
              : primaryRole

        // ⭐ NEW: Check if user already exists by email
        const { data: existingUser } = await supabase
          .from("users")
          .select("id, roles, user_type, company_id")
          .eq("email", userFormData.email.toLowerCase().trim())
          .maybeSingle()

        if (existingUser) {
          console.log("ℹ️ User with this email already exists. Updating roles and company.")
          
          // Merge roles: existing roles + new roles
          const existingRoles = Array.isArray(existingUser.roles) ? existingUser.roles : [existingUser.user_type]
          const mergedRoles = Array.from(new Set([...existingRoles, ...effectiveRoles]))
          
          const { data: updatedUser, error: updateError } = await supabase
            .from("users")
            .update({
              name: userFormData.name.trim(),
              user_type: finalUserType,
              roles: mergedRoles,
              company_id: companyIdToAssign || existingUser.company_id, // Keep existing if not providing new
              assigned_pm_id:
                isMaster && (primaryRole === "user" || primaryRole === "owner")
                  ? userFormData.assignedPmId
                  : isPropertyManager && !isCorporateAdmin && !isMaster
                    ? currentUser.id
                    : null,
            })
            .eq("id", existingUser.id)
            .select()
            .single()

          if (updateError) {
            console.error("❌ Error updating existing user:", updateError)
            setError("Failed to update existing user.")
            setSaving(false)
            return
          }
          userIdToAssign = existingUser.id
        } else {
          // Normal Insert
          const { data: newUser, error: userError } = await supabase
            .from("users")
            .insert({
              name: userFormData.name.trim(),
              email: userFormData.email.toLowerCase().trim(),
              password_hash: hashedPassword as string, // ✅ Real bcrypt hash
              user_type: finalUserType,
              roles: effectiveRoles,
              company_id: companyIdToAssign,
              assigned_pm_id:
                isMaster && (primaryRole === "user" || primaryRole === "owner")
                  ? userFormData.assignedPmId
                  : isPropertyManager && !isCorporateAdmin && !isMaster
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
          userIdToAssign = newUser.id
        }

        if (selectedUserBuildings.length > 0) {
          // For existing users, we might want to append buildings instead of just inserting
          // But usually we want to assign them to these new ones.
          // Let's check existing assignments
          const { data: existingAssignments } = await supabase
            .from("user_buildings")
            .select("building_id, unit_number")
            .eq("user_id", userIdToAssign)
          
          const existingKeys = (existingAssignments || []).map(a => `${a.building_id}-${a.unit_number || ''}`)
          const newAssignments = selectedUserBuildings.filter(b => !existingKeys.includes(`${b.id}-${b.unit_number}`))

          if (newAssignments.length > 0) {
            const buildingAssignments = newAssignments.map((b) => ({
              user_id: userIdToAssign as number,
              building_id: b.id,
              unit_number: b.unit_number.trim() || null,
              voting_weight: parseFloat(b.voting_weight) ?? 1.00,
              user_building_type: userFormData.userType as string
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
          }
        }
        
        finalUserType = finalUserType // Already set in creation logic
        companyIdToAssign = companyIdToAssign // Already set in creation logic
      }

      resetForm()
      
      // 🔄 Notify Janus for real-time sync with actual data
      const syncData = {
        id: userIdToAssign,
        name: userFormData.name.trim(),
        email: userFormData.email.toLowerCase().trim(),
        user_type: finalUserType,
        roles: effectiveRoles,
        company_id: companyIdToAssign,
        assigned_pm_id: isMaster && (primaryRole === "user" || primaryRole === "owner")
          ? userFormData.assignedPmId
          : isPropertyManager && !isCorporateAdmin && !isMaster
            ? currentUser.id
            : null,
        units: selectedUserBuildings.map(b => ({
          building_id: b.id,
          unit_number: b.unit_number,
          company_id: companyIdToAssign // Janus will fallback to this if not set per unit
        }))
      }
      triggerJanusResync(isEditMode ? 'user_updated' : 'user_created', syncData, 'user')
      
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
    { value: "vendor", label: "Vendor" },
    { value: "attendee", label: "Attendee" },
    { value: "corporate_administrator", label: "Corporate Manager" },
    { value: "resident", label: "Resident" },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-in fade-in overflow-y-auto p-4">
      <Card className="w-full max-w-2xl border-0 rounded-2xl shadow-2xl my-8 overflow-hidden">
        <div className="bg-gradient-to-r from-primary/10 to-decision-purple/10 p-8 border-b border-border/50">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-foreground tracking-tight">
                {isEditMode ? "Edit User" : "Create New User"}
              </h2>
              <p className="text-sm text-muted-foreground mt-1 font-medium">
                {isEditMode ? "Update information and permissions" : "Add a new member to your team"}
              </p>
            </div>
            <button
              onClick={onClose}
              className="h-10 w-10 flex items-center justify-center rounded-xl hover:bg-background/80 hover:shadow-sm transition-all duration-200"
              disabled={saving}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
          {error && (
            <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-xl text-sm font-medium flex items-center gap-3">
              <span className="h-2 w-2 rounded-full bg-destructive animate-pulse" />
              {error}
            </div>
          )}

          {/* Core Information Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">Full Name *</label>
              <input
                type="text"
                name="name"
                value={userFormData.name}
                onChange={handleInputChange}
                placeholder="John Doe"
                required
                disabled={saving}
                className="w-full h-11 px-4 bg-muted/30 border border-border rounded-xl focus:ring-2 focus:ring-primary/20 outline-none transition-all placeholder:text-muted-foreground/50"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">Email Address *</label>
              <input
                type="email"
                name="email"
                value={userFormData.email}
                onChange={handleInputChange}
                onBlur={handleEmailBlur}
                placeholder="john@example.com"
                required
                disabled={saving}
                className="w-full h-11 px-4 bg-muted/30 border border-border rounded-xl focus:ring-2 focus:ring-primary/20 outline-none transition-all placeholder:text-muted-foreground/50"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">
                {isEditMode ? "Change Password" : "Temporary Password *"}
              </label>
              <input
                type="text"
                name="password"
                value={userFormData.password}
                onChange={handleInputChange}
                placeholder={isEditMode ? "Leave blank to keep" : "e.g., welcome123"}
                required={!isEditMode}
                disabled={saving}
                className="w-full h-11 px-4 bg-muted/30 border border-border rounded-xl focus:ring-2 focus:ring-primary/20 outline-none transition-all placeholder:text-muted-foreground/50"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">Voting Weight</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={userFormData.voting_weight}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setUserFormData(prev => ({ ...prev, voting_weight: isNaN(val) ? 0 : val }));
                }}
                className="w-full h-11 px-4 bg-muted/30 border border-border rounded-xl focus:ring-2 focus:ring-primary/20 outline-none transition-all font-semibold"
                disabled={saving}
              />
            </div>
          </div>

          {(isMaster || isCorporateAdmin) && (
            <div className="space-y-3 pt-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">Assign Roles (Primary first)</label>
              <div className="bg-muted/10 border border-border rounded-2xl p-4 grid grid-cols-2 gap-3">
                {allRoleOptions.map((role) => (
                  <label key={role.value} className="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-muted/50 transition-colors group">
                    <div className={`h-5 w-5 rounded border flex items-center justify-center transition-all ${userFormData.roles.includes(role.value) ? 'bg-primary border-primary' : 'border-border group-hover:border-primary/50'}`}>
                      {userFormData.roles.includes(role.value) && <Check className="h-3 w-3 text-white" />}
                      <input
                        type="checkbox"
                        checked={userFormData.roles.includes(role.value)}
                        onChange={() => toggleRole(role.value)}
                        disabled={saving}
                        className="hidden"
                      />
                    </div>
                    <span className="text-sm font-medium">{role.label}</span>
                  </label>
                ))}
                {userTypes
                  .filter(t => !allRoleOptions.some(r => r.value === t))
                  .map(t => (
                    <label key={t} className="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-muted/50 transition-colors group">
                      <div className={`h-5 w-5 rounded border flex items-center justify-center transition-all ${userFormData.roles.includes(t) ? 'bg-primary border-primary' : 'border-border group-hover:border-primary/50'}`}>
                        {userFormData.roles.includes(t) && <Check className="h-3 w-3 text-white" />}
                        <input
                          type="checkbox"
                          checked={userFormData.roles.includes(t)}
                          onChange={() => toggleRole(t)}
                          disabled={saving}
                          className="hidden"
                        />
                      </div>
                      <span className="text-sm font-medium text-primary">{t}</span>
                    </label>
                  ))
                }
              </div>
            </div>
          )}

          {isMaster ? (
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">Company Association</label>
              <select
                name="companyId"
                value={userFormData.companyId}
                onChange={handleInputChange}
                disabled={saving}
                className="w-full h-11 px-4 bg-muted/30 border border-border rounded-xl focus:ring-2 focus:ring-primary/20 outline-none transition-all"
              >
                <option value={0}>Select Company</option>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>{company.name}</option>
                ))}
              </select>
            </div>
          ) : (
            (isCorporateAdmin || isPropertyManager) && (
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">Company Association</label>
                <div className="w-full h-11 px-4 bg-muted/10 border border-dashed border-border rounded-xl flex items-center">
                  <span className="text-sm font-bold text-primary">
                    {companies.find(c => c.id === currentUser?.company_id)?.name || "Your Company"}
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground ml-1 italic">Locked: Assigned based on your account</p>
              </div>
            )
          )}

          {(userFormData.roles.includes("property_manager") || 
            userFormData.roles.includes("owner") || 
            userFormData.roles.includes("resident") || 
            userFormData.roles.includes("attendee") ||
            (!isMaster && !isCorporateAdmin)) && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between ml-1">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Building Assignments</label>
                {userFormData.roles.includes("property_manager") && isEditMode && (
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => onCreateBuilding?.(userId || 0, userFormData.companyId)}
                    className="h-7 px-2 text-[10px] font-bold text-primary hover:bg-primary/5 uppercase"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Create New Building
                  </Button>
                )}
              </div>
              <div className="bg-muted/10 border border-border rounded-2xl p-2 max-h-56 overflow-y-auto space-y-1">
                {(() => {
                  const filteredBuildings = buildings.filter(b => 
                    !userFormData.companyId || userFormData.companyId === 0 || b.company_id === userFormData.companyId
                  )
                  
                  if (filteredBuildings.length === 0) {
                    return <p className="p-4 text-sm text-center text-muted-foreground italic">No buildings available for this company.</p>
                  }
                  
                  return filteredBuildings.map((building) => {
                    const selection = selectedUserBuildings.find(b => b.id === building.id)
                    const isSelected = !!selection
                    return (
                      <div key={building.id} className={`flex items-center justify-between p-3 rounded-xl transition-all ${isSelected ? 'bg-background shadow-sm border border-border' : 'hover:bg-muted/30 border border-transparent'}`}>
                        <label className="flex items-center gap-3 cursor-pointer flex-1">
                          <div className={`h-5 w-5 rounded border flex items-center justify-center transition-all ${isSelected ? 'bg-primary border-primary' : 'border-border'}`}>
                            {isSelected && <Check className="h-3 w-3 text-white" />}
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleUserBuilding(building.id)}
                              disabled={saving}
                              className="hidden"
                            />
                          </div>
                          <span className="text-sm font-semibold">{building.name}</span>
                        </label>
                        {isSelected && (
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={selection.unit_number}
                              onChange={(e) => updateBuildingUnit(building.id, e.target.value)}
                              placeholder="Unit"
                              className="w-16 h-8 text-xs bg-muted/50 border border-border rounded-lg px-2 focus:ring-1 focus:ring-primary outline-none"
                            />
                            <input
                              type="number"
                              step="0.01"
                              value={selection.voting_weight}
                              onChange={(e) => updateBuildingWeight(building.id, e.target.value)}
                              placeholder="Weight"
                              className="w-14 h-8 text-xs bg-muted/50 border border-border rounded-lg px-2 focus:ring-1 focus:ring-primary outline-none"
                            />
                          </div>
                        )}
                      </div>
                    )
                  })
                })()}
              </div>
            </div>
          )}

          <div className="flex gap-4 pt-4 sticky bottom-0 bg-background pb-2">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              className="flex-1 h-12 rounded-xl font-bold hover:bg-muted"
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-[2] h-12 rounded-xl bg-gradient-to-r from-primary to-decision-purple text-white font-bold shadow-lg shadow-primary/20 hover:opacity-90 transition-all active:scale-[0.98]"
              disabled={saving}
            >
              {saving ? "Processing..." : isEditMode ? "Save Changes" : "Create User Account"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
