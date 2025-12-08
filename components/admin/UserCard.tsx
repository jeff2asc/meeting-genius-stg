"use client"

import { User, Building2, Shield, Briefcase, UserCheck, Users } from "lucide-react"
import { Card } from "@/components/ui/card"

interface UserCardProps {
  user: {
    id: number
    name: string
    email: string
    user_type: string
    created_at: string
    buildings?: string[]
  }
  onEdit?: (userId: number) => void
  onDelete?: (userId: number) => void
}

export default function UserCard({ user, onEdit, onDelete }: UserCardProps) {
  const getUserTypeIcon = (userType: string) => {
    switch (userType) {
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
      default:
        return <User className="h-4 w-4 text-gray-600" />
    }
  }

  const getUserTypeBadge = (userType: string) => {
    switch (userType) {
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
      default:
        return "bg-gray-100 text-gray-800 border-gray-200"
    }
  }

  const formatUserType = (userType: string) => {
    return userType.replace("_", " ").toUpperCase()
  }

  return (
    <Card className="p-4 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 flex-1">
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/10">
            {getUserTypeIcon(user.user_type)}
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-foreground">{user.name}</h3>
            <p className="text-sm text-muted-foreground">{user.email}</p>

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
          </div>
        </div>

        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-4">
            <span
              className={`text-xs font-medium px-3 py-1 rounded-full border ${getUserTypeBadge(
                user.user_type
              )}`}
            >
              {formatUserType(user.user_type)}
            </span>
            <p className="text-sm text-muted-foreground whitespace-nowrap">
              {new Date(user.created_at).toLocaleDateString()}
            </p>
          </div>

          {(onEdit || onDelete) && (
            <div className="flex gap-2">
              {onEdit && (
                <button
                  type="button"
                  onClick={() => onEdit(user.id)}
                  className="text-xs px-2 py-1 rounded border border-blue-200 text-blue-700 hover:bg-blue-50"
                >
                  Edit
                </button>
              )}
              {onDelete && (
                <button
                  type="button"
                  onClick={() => onDelete(user.id)}
                  className="text-xs px-2 py-1 rounded border border-red-200 text-red-700 hover:bg-red-50"
                >
                  Delete
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}
