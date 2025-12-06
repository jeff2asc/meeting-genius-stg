"use client"

import { Building2, MapPin, Edit2, FileText, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

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

interface BuildingCardProps {
  building: Building
  hasDocuments: boolean
  onEdit: (building: Building) => void
  onViewDocument: (building: Building) => void
  onManageDocuments: (building: Building) => void
  onViewUsers: (building: Building) => void
}

const getBuildingTypeColor = (type: string) => {
  switch (type) {
    case 'Strata/Condo':
      return 'bg-blue-100 text-blue-800 border-blue-200'
    case 'Rental':
      return 'bg-green-100 text-green-800 border-green-200'
    case 'Housing Co-op':
      return 'bg-purple-100 text-purple-800 border-purple-200'
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200'
  }
}

export default function BuildingCard({
  building,
  hasDocuments,
  onEdit,
  onViewDocument,
  onManageDocuments,
  onViewUsers
}: BuildingCardProps) {
  return (
    <Card className="p-4 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 flex-1">
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-blue-100">
            <Building2 className="h-6 w-6 text-blue-600" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-foreground">{building.name}</h3>
              <Badge 
                variant="outline" 
                className={`text-xs ${getBuildingTypeColor(building.building_type || 'Strata/Condo')}`}
              >
                {building.building_type || 'Strata/Condo'}
              </Badge>
            </div>
            {building.address && (
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {building.address}
              </p>
            )}
            {building.users && building.users.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                <span className="text-xs text-muted-foreground">
                  Users ({building.users.length}):
                </span>
                {building.users.slice(0, 3).map((user, idx) => (
                  <span
                    key={idx}
                    className="text-xs bg-muted px-2 py-0.5 rounded"
                  >
                    {user.name}
                  </span>
                ))}
                {building.users.length > 3 && (
                  <span className="text-xs text-muted-foreground">
                    +{building.users.length - 3} more
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onEdit(building)}
          >
            <Edit2 className="h-4 w-4 mr-2" />
            Edit
          </Button>

          {/* View Users Button */}
          <Button
            size="sm"
            variant="outline"
            onClick={() => onViewUsers(building)}
            className="border-blue-200 text-blue-700 hover:bg-blue-50"
          >
            <Users className="h-4 w-4 mr-2" />
            View Users
          </Button>
          
          {/* Document Management Buttons */}
          {hasDocuments ? (
            <>
              <Button
                size="sm"
                onClick={() => onViewDocument(building)}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                <FileText className="h-4 w-4 mr-2" />
                View Document
              </Button>
              <Button
                size="sm"
                onClick={() => onManageDocuments(building)}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                <Edit2 className="h-4 w-4 mr-2" />
                Update Document
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              onClick={() => onManageDocuments(building)}
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              <FileText className="h-4 w-4 mr-2" />
              Add Document
            </Button>
          )}
          
          <p className="text-sm text-muted-foreground whitespace-nowrap ml-2">
            {new Date(building.created_at).toLocaleDateString()}
          </p>
        </div>
      </div>
    </Card>
  )
}
