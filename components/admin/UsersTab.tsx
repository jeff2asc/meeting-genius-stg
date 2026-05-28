"use client"

import { useState, useMemo } from "react"
import { Filter, Search, X, Plus } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import UserCard from "./UserCard"
import GeniusWordsModal from "./GeniusWordsModal"
import SetPasswordModal from "./SetPasswordModal"
import { startImpersonation } from "@/lib/impersonation"
import type { User } from "@/lib/supabase"

interface UserRow {
  id: number
  name: string
  email: string
  user_type: string
  created_at: string
  assigned_pm_id: number | null
  company_name?: string | null
  buildings?: string[]
  roles?: string[] | null
  voting_weight?: number
}

interface Building {
  id: number
  name: string
}

interface UsersTabProps {
  users: UserRow[]
  filteredUsers: UserRow[]
  buildings: Building[]
  filterUserType: string
  filterBuilding: string
  loading: boolean
  isMaster: boolean
  isPropManager: boolean
  isCorporateAdmin: boolean
  currentUser: any
  onFilterUserTypeChange: (value: string) => void
  onFilterBuildingChange: (value: string) => void
  onEditUser: (userId: number) => void
  onDeleteUser: (userId: number) => void
  onCreateBuilding?: () => void
}

export default function UsersTab({
  users,
  filteredUsers,
  buildings,
  filterUserType,
  filterBuilding,
  loading,
  isMaster,
  isPropManager,
  isCorporateAdmin,
  currentUser,
  onFilterUserTypeChange,
  onFilterBuildingChange,
  onEditUser,
  onDeleteUser,
  onCreateBuilding,
}: UsersTabProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [geniusWordsTarget, setGeniusWordsTarget] = useState<{ id: number; name: string } | null>(null)
  const [setPasswordTarget, setSetPasswordTarget] = useState<{ id: number; name: string; email: string } | null>(null)

  const canManageUser = (targetUser: UserRow) => {
    if (isMaster || isCorporateAdmin || isPropManager) return true
    
    // Lower roles can only edit their OWN account
    return targetUser.id === currentUser?.id
  }

  const canDeleteUser = (targetUser: UserRow) => {
    // Only high roles can delete
    return isMaster || isCorporateAdmin
  }

  // Apply search filter on top of existing filters, always sorted A→Z by name
  const searchFilteredUsers = useMemo(() => {
    const base = searchQuery.trim()
      ? filteredUsers.filter((user) => {
          const query = searchQuery.toLowerCase()
          const matchesBasic =
            user.name.toLowerCase().includes(query) ||
            user.email.toLowerCase().includes(query) ||
            user.user_type.toLowerCase().replace(/_/g, " ").includes(query)

          const roles = user.roles || []
          const matchesRoles = roles.some((r) =>
            r.toLowerCase().replace(/_/g, " ").includes(query)
          )

          return matchesBasic || matchesRoles
        })
      : filteredUsers

    return [...base].sort((a, b) => a.name.localeCompare(b.name))
  }, [filteredUsers, searchQuery])

  return (
    <>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground mb-2">User Management</h2>
          <p className="text-muted-foreground">
            {isMaster
              ? "You have full access to manage all users"
              : "Manage users assigned to you or in your buildings"}
          </p>
        </div>

      </div>

      {/* Search Field */}
      <Card className="p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-semibold text-foreground">Search Users</h3>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, user type, or role..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-9"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 p-0"
              onClick={() => setSearchQuery("")}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
        {searchQuery && (
          <p className="text-xs text-muted-foreground mt-2">
            Found {searchFilteredUsers.length} user{searchFilteredUsers.length !== 1 ? "s" : ""} matching "{searchQuery}"
          </p>
        )}
      </Card>

      {/* Filters Card */}
      <Card className="p-4 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-semibold text-foreground">Filters</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {isMaster && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                User Type
              </label>
              <select
                value={filterUserType}
                onChange={(e) => onFilterUserTypeChange(e.target.value)}
                className="w-full px-3 py-2 bg-background text-foreground rounded border border-border focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                <option value="all">All Users</option>
                <option value="master">Master Only</option>
                <option value="property_manager">Property Managers Only</option>
                <option value="user">Users Only</option>
                <option value="vendor">Vendors Only</option>
                <option value="attendee">Attendees Only</option>
                <option value="corporate_administrator">Corporate Admins Only</option>
                <option value="owner">Owners Only</option>
                <option value="resident">Residents Only</option>
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Building
            </label>
            <select
              value={filterBuilding}
              onChange={(e) => onFilterBuildingChange(e.target.value)}
              className="w-full px-3 py-2 bg-background text-foreground rounded border border-border focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="all">All Buildings</option>
              <option value="unassigned">Not Assigned to Any Building</option>
              {buildings.map((building) => (
                <option key={building.id} value={building.name}>
                  {building.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          Showing {searchFilteredUsers.length} of {users.length} users
        </p>
      </Card>

      {loading ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading users...</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {searchFilteredUsers.map((user) => {
            const canManage = canManageUser(user)
            return (
              <UserCard
                key={user.id}
                user={user}
                onEdit={canManageUser(user) ? () => onEditUser(user.id) : undefined}
                onDelete={canDeleteUser(user) ? () => onDeleteUser(user.id) : undefined}
                onManageGeniusWords={isMaster ? (u) => setGeniusWordsTarget(u) : undefined}
                onSetPassword={isMaster ? (u) => setSetPasswordTarget(u) : undefined}
                onImpersonate={isMaster ? (u) => {
                  if (!confirm(`Sign in as ${u.name}? You'll see a banner to return to your account.`)) return
                  startImpersonation(u as User)
                } : undefined}
              />
            )
          })}
        </div>
      )}

      {searchFilteredUsers.length === 0 && !loading && (
        <div className="text-center py-12 border-2 border-dashed border-border rounded-lg">
          <p className="text-muted-foreground">
            {searchQuery
              ? `No users found matching "${searchQuery}"`
              : "No users found matching filters"}
          </p>
        </div>
      )}

      {geniusWordsTarget && (
        <GeniusWordsModal
          targetUser={geniusWordsTarget}
          onClose={() => setGeniusWordsTarget(null)}
        />
      )}

      {setPasswordTarget && (
        <SetPasswordModal
          targetUser={setPasswordTarget}
          onClose={() => setSetPasswordTarget(null)}
        />
      )}
    </>
  )
}
