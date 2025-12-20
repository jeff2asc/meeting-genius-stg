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
  onViewDetails: (building: Building) => void
  onViewDocument: (building: Building) => void
  onManageDocuments: (building: Building) => void
}

export default function BuildingsTab({
  buildings,
  buildingDocuments,
  loading,
  isMaster,
  onViewDetails,
  onViewDocument,
  onManageDocuments
}: BuildingsTabProps) {
  const [typeFilter, setTypeFilter] = useState<string>('all')

  // Filter buildings by type
  const filteredBuildings = buildings.filter(building => {
    if (typeFilter === 'all') return true
    return building.building_type === typeFilter
  })

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
                onViewDetails={onViewDetails}
                onViewDocument={onViewDocument}
                onManageDocuments={onManageDocuments}
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
    </>
  )
}
