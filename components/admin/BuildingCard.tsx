"use client"

import { Building2, MapPin, Trash2, Archive, RotateCcw } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

interface Building {
  id: number
  name: string
  address: string | null
  manager_id: number
  company_id: number | null
  building_type?: string
  is_archived: boolean
  archived_at?: string | null
  archived_by?: string | null
  archive_reason?: string | null
  created_at: string
  users?: Array<{ id: number; name: string; email: string; user_type: string }>
  company?: { id: number; name: string } | null
}

interface BuildingCardProps {
  building: Building
  onViewDetails: (building: Building) => void
  isMaster?: boolean
  onDelete?: (building: Building) => void
  onArchive?: (building: Building) => void
  onUnarchive?: (building: Building) => void
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
  onViewDetails,
  isMaster = false,
  onDelete,
  onArchive,
  onUnarchive
}: BuildingCardProps) {
  const isArchived = building.is_archived

  return (
    <Card className={`p-4 hover:shadow-md transition-shadow ${isArchived ? 'opacity-75 bg-muted/30 border-dashed' : ''}`}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-4 flex-1 min-w-0">
          <div className={`flex items-center justify-center w-12 h-12 rounded-full flex-shrink-0 ${isArchived ? 'bg-slate-200' : 'bg-blue-100'}`}>
            <Building2 className={`h-6 w-6 ${isArchived ? 'text-slate-500' : 'text-blue-600'}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-col mb-1">
              {building.company?.name && (
                <span className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.1em] mb-0.5">
                  {building.company.name}
                </span>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <h3 className={`font-bold tracking-tight text-base sm:text-lg ${isArchived ? 'text-slate-500' : 'text-slate-900'}`}>{building.name}</h3>
                <Badge 
                  variant="outline" 
                  className={`text-[9px] sm:text-[10px] font-black uppercase tracking-wider py-0.5 ${isArchived ? 'bg-slate-100 text-slate-500' : getBuildingTypeColor(building.building_type || 'Strata/Condo')}`}
                >
                  {building.building_type || 'Strata/Condo'}
                </Badge>
                {isArchived && (
                  <Badge variant="secondary" className="bg-amber-100 text-amber-700 border-amber-200 text-[10px] font-bold uppercase">
                    Archived
                  </Badge>
                )}
              </div>
            </div>
            {building.address && (
              <p className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="truncate">{building.address}</span>
              </p>
            )}
            {isArchived && building.archived_at && (
              <p className="text-[10px] text-muted-foreground mt-1">
                Archived on {new Date(building.archived_at).toLocaleDateString()}
                {building.archive_reason && ` • ${building.archive_reason}`}
              </p>
            )}
            {!isArchived && building.users && building.users.length > 0 && (
              <div className="flex flex-wrap items-center gap-1 mt-2">
                <span className="text-xs text-muted-foreground mr-1">
                  Users ({building.users.length}):
                </span>
                {building.users.slice(0, 3).map((user, idx) => (
                  <span
                    key={idx}
                    className="text-xs bg-muted px-2 py-0.5 rounded truncate max-w-[120px]"
                  >
                    {user.name}
                  </span>
                ))}
                {building.users.length > 3 && (
                  <span className="text-xs text-muted-foreground font-medium">
                    +{building.users.length - 3} more
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          {!isArchived && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onViewDetails(building)}
              className="border-primary/30 text-primary hover:bg-primary/10 text-xs h-8 sm:h-9"
            >
              <Building2 className="h-3.5 w-3.5 mr-1.5" />
              View Details
            </Button>
          )}

          {isArchived ? (
            <>
              {onUnarchive && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onUnarchive(building)}
                  className="border-blue-200 text-blue-600 hover:bg-blue-50 text-xs h-8 sm:h-9"
                  title="Restore Building"
                >
                  <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                  Restore
                </Button>
              )}
              {isMaster && onDelete && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onDelete(building)}
                  className="border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 text-xs h-8 sm:h-9"
                  title="Permanently Delete"
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                  Delete
                </Button>
              )}
            </>
          ) : (
            <>
              {onArchive && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onArchive(building)}
                  className="border-amber-200 text-amber-600 hover:bg-amber-50 text-xs h-8 sm:h-9"
                  title="Archive Building"
                >
                  <Archive className="h-3.5 w-3.5 mr-1.5" />
                  Archive
                </Button>
              )}
            </>
          )}

          {!isArchived && (
            <p className="text-xs text-muted-foreground whitespace-nowrap ml-auto sm:ml-2">
              {new Date(building.created_at).toLocaleDateString()}
            </p>
          )}
        </div>
      </div>
    </Card>
  )
}
