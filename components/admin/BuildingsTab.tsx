"use client"

import { useState } from "react"
import BuildingCard from "./BuildingCard"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Users, X } from "lucide-react"

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

interface BuildingsTabProps {
  buildings: Building[]
  buildingDocuments: Record<number, boolean>
  loading: boolean
  isMaster: boolean
  onEditBuilding: (building: Building) => void
  onViewDocument: (building: Building) => void
  onManageDocuments: (building: Building) => void
}

export default function BuildingsTab({
  buildings,
  buildingDocuments,
  loading,
  isMaster,
  onEditBuilding,
  onViewDocument,
  onManageDocuments
}: BuildingsTabProps) {
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [selectedBuilding, setSelectedBuilding] = useState<Building | null>(null)
  const [showUsersModal, setShowUsersModal] = useState(false)

  // Filter buildings by type
  const filteredBuildings = buildings.filter(building => {
    if (typeFilter === 'all') return true
    return building.building_type === typeFilter
  })

  const handleViewUsers = (building: Building) => {
    setSelectedBuilding(building)
    setShowUsersModal(true)
  }

  return (
    <>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-foreground mb-2">Building Management</h2>
        <p className="text-muted-foreground">
          {isMaster
            ? 'Manage all buildings in the system'
            : 'Manage your assigned buildings'}
        </p>
      </div>

      {/* Filter Dropdown */}
      <div className="mb-4 flex items-center gap-2">
        <span className="text-sm font-medium text-foreground">Filter by Type:</span>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="Strata/Condo">Strata/Condo</SelectItem>
            <SelectItem value="Rental">Rental Building</SelectItem>
            <SelectItem value="Housing Co-op">Housing Co-op</SelectItem>
          </SelectContent>
        </Select>
        {typeFilter !== 'all' && (
          <span className="text-sm text-muted-foreground">
            ({filteredBuildings.length} of {buildings.length})
          </span>
        )}
      </div>

      {loading ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading buildings...</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredBuildings.map((building) => {
            const hasDocuments = buildingDocuments[building.id] || false
            
            return (
              <BuildingCard
                key={building.id}
                building={building}
                hasDocuments={hasDocuments}
                onEdit={onEditBuilding}
                onViewDocument={onViewDocument}
                onManageDocuments={onManageDocuments}
                onViewUsers={handleViewUsers}
              />
            )
          })}
        </div>
      )}

      {filteredBuildings.length === 0 && !loading && (
        <div className="text-center py-12 border-2 border-dashed border-border rounded-lg">
          <p className="text-muted-foreground">
            {typeFilter === 'all' 
              ? 'No buildings found' 
              : `No ${typeFilter} buildings found`}
          </p>
        </div>
      )}

      {/* View Users Modal */}
      {showUsersModal && selectedBuilding && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="p-6 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-foreground flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  Users in {selectedBuilding.name}
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {selectedBuilding.users?.length || 0} user{(selectedBuilding.users?.length || 0) !== 1 ? 's' : ''} assigned
                </p>
              </div>
              <Button
                onClick={() => {
                  setShowUsersModal(false)
                  setSelectedBuilding(null)
                }}
                variant="ghost"
                size="sm"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            {/* Users List */}
            <div className="flex-1 overflow-y-auto p-6">
              {selectedBuilding.users && selectedBuilding.users.length > 0 ? (
                <div className="space-y-3">
                  {selectedBuilding.users.map((user) => (
                    <div
                      key={user.id}
                      className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border border-border hover:bg-muted transition-colors"
                    >
                      <div className="flex-1">
                        <div className="font-medium text-foreground">{user.name}</div>
                        <div className="text-sm text-muted-foreground">{user.email}</div>
                      </div>
                      <div className="ml-4">
                        <span className="px-3 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">
                          {user.user_type.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                  <p className="text-muted-foreground">No users assigned to this building</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Assign users to this building in the Users tab
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-border">
              <Button
                onClick={() => {
                  setShowUsersModal(false)
                  setSelectedBuilding(null)
                }}
                variant="outline"
                className="w-full"
              >
                Close
              </Button>
            </div>
          </Card>
        </div>
      )}
    </>
  )
}
