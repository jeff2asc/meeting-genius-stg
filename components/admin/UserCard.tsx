"use client"

import { User, Building2, Shield, Briefcase, UserCheck, Users, Pencil, Trash2, Sparkles, KeyRound, LogIn } from "lucide-react"
import { Card } from "@/components/ui/card"

interface UserCardProps {
  user: {
    id: number
    name: string
    email: string
    user_type: string
    created_at: string
    buildings?: string[]
    roles?: string[] | null
    voting_weight?: number
    company_name?: string | null
    company_id?: number | null
    assigned_pm_id?: number | null
  }
  onEdit?: (userId: number) => void
  onDelete?: (userId: number) => void
  onManageGeniusWords?: (user: { id: number; name: string }) => void
  onSetPassword?: (user: { id: number; name: string; email: string }) => void
  onImpersonate?: (user: { id: number; name: string; email: string; user_type: string; roles?: string[] | null; company_id?: number | null; assigned_pm_id?: number | null }) => void
}

const getRoleIcon = (role: string) => {
  switch (role) {
    case "master":
      return <Shield className="h-4 w-4 text-purple-600" />
    case "property_manager":
      return <Building2 className="h-4 w-4 text-blue-600" />
    case "vendor":
      return <Briefcase className="h-4 w-4 text-orange-600" />
    case "attendee":
      return <UserCheck className="h-4 w-4 text-green-600" />
    case "corporate_administrator":
      return <Users className="h-4 w-4 text-indigo-600" />
    case "owner":
      return <UserCheck className="h-4 w-4 text-blue-600" />
    case "resident":
      return <UserCheck className="h-4 w-4 text-green-600" />
    default:
      return <User className="h-4 w-4 text-gray-600" />
  }
}

const getRoleBadge = (role: string) => {
  switch (role) {
    case "master":
      return "bg-purple-100 text-purple-800 border-purple-200"
    case "property_manager":
      return "bg-blue-100 text-blue-800 border-blue-200"
    case "vendor":
      return "bg-orange-100 text-orange-800 border-orange-200"
    case "attendee":
      return "bg-green-100 text-green-800 border-green-200"
    case "corporate_administrator":
      return "bg-indigo-100 text-indigo-800 border-indigo-200"
    case "owner":
      return "bg-blue-100 text-blue-800 border-blue-200"
    case "resident":
      return "bg-green-100 text-green-800 border-green-200"
    case "user":
      return "bg-gray-100 text-gray-800 border-gray-200"
    default:
      return "bg-gray-100 text-gray-800 border-gray-200"
  }
}

const formatRole = (role: string) => {
  return role.replace(/_/g, " ").toUpperCase()
}

export default function UserCard({ user, onEdit, onDelete, onManageGeniusWords, onSetPassword, onImpersonate }: UserCardProps) {
  // Use roles array if available, otherwise fall back to single user_type
  const roles = Array.from(new Set([user.user_type, ...(user.roles || [])]))
  const primaryRole = roles[0]

  return (
    <Card className="p-4 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 flex-1">
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/10">
            {getRoleIcon(primaryRole)}
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-foreground">{user.name}</h3>
            <p className="text-sm text-muted-foreground">{user.email}</p>

            {user.company_name && (
              <div className="mt-1">
                <span className="text-[11px] font-medium inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100">
                  <Briefcase className="h-3 w-3" />
                  {user.company_name}
                </span>
              </div>
            )}

            {user.buildings && user.buildings.length > 0 ? (
              <div className="flex flex-wrap gap-1 mt-2">
                {user.buildings.map((building, idx) => (
                  <span
                    key={idx}
                    className="text-xs bg-muted px-2 py-0.5 rounded"
                  >
                    {building}
                  </span>
                ))}
              </div>
            ) : (
              <div className="mt-2">
                <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">
                  No buildings assigned
                </span>
              </div>
            )}
            
            {user.voting_weight !== undefined && user.voting_weight !== 1.0 && (
              <div className="mt-2">
                <span className="text-[10px] font-bold bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-100">
                  Global Weight: {user.voting_weight}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-4">
            <div className="flex flex-wrap gap-1 justify-end">
              {roles.map((role) => (
                <span
                  key={role}
                  className={`text-xs font-medium px-3 py-1 rounded-full border ${getRoleBadge(
                    role
                  )}`}
                >
                  {formatRole(role)}
                </span>
              ))}
            </div>
            <p className="text-sm text-muted-foreground whitespace-nowrap">
              {new Date(user.created_at).toLocaleDateString()}
            </p>
          </div>

          {(onEdit || onDelete || onManageGeniusWords || onSetPassword || onImpersonate) && (
            <div className="flex gap-1">
              {onImpersonate && (
                <button
                  type="button"
                  onClick={() => onImpersonate({
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    user_type: user.user_type,
                    roles: user.roles,
                    company_id: user.company_id,
                    assigned_pm_id: user.assigned_pm_id,
                  })}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-green-200 text-green-700 hover:bg-green-50"
                  title="Sign in as this user"
                >
                  <LogIn className="h-4 w-4" />
                </button>
              )}
              {onSetPassword && (
                <button
                  type="button"
                  onClick={() => onSetPassword({ id: user.id, name: user.name, email: user.email })}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-amber-200 text-amber-700 hover:bg-amber-50"
                  title="Set password"
                >
                  <KeyRound className="h-4 w-4" />
                </button>
              )}
              {onManageGeniusWords && (
                <button
                  type="button"
                  onClick={() => onManageGeniusWords({ id: user.id, name: user.name })}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-purple-200 text-purple-700 hover:bg-purple-50"
                  title="Manage GeniusWords"
                >
                  <Sparkles className="h-4 w-4" />
                </button>
              )}
              {onEdit && (
                <button
                  type="button"
                  onClick={() => onEdit(user.id)}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-blue-200 text-blue-700 hover:bg-blue-50"
                  title="Edit user"
                >
                  <Pencil className="h-4 w-4" />
                </button>
              )}
              {onDelete && (
                <button
                  type="button"
                  onClick={() => onDelete(user.id)}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-red-200 text-red-700 hover:bg-red-50"
                  title="Delete user"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}
