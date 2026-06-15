"use client"

import { useState, useEffect } from "react"
import BuildingCard from "./BuildingCard"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { supabase } from "@/lib/supabase"
import { fetchVotingParametersAction } from "@/lib/api-actions"
import { isMaster as checkIsMaster } from "@/lib/permissions"

interface Building {
  id: number
  name: string
  address: string | null
  manager_id: number
  company_id: number | null
  building_type?: string
  is_archived: boolean
  created_at: string
  users?: Array<{ id: number; name: string; email: string; user_type: string }>
  company?: { id: number; name: string } | null
}

interface BuildingsTabProps {
  buildings: Building[]
  buildingDocuments: Record<number, boolean>
  loading: boolean
  isMaster: boolean
  onViewDetails: (building: Building) => void
  onViewDocument: (building: Building) => void
  onManageDocuments: (building: Building) => void
  onDeleteBuilding?: (building: Building) => Promise<void>
  onArchiveBuilding?: (building: Building) => Promise<void>
  onUnarchiveBuilding?: (building: Building) => Promise<void>
  currentUser?: any
  canManage?: boolean
  mode?: 'active' | 'archive'
}

export default function BuildingsTab({
  buildings,
  buildingDocuments,
  loading,
  isMaster,
  onViewDetails,
  onViewDocument,
  onManageDocuments,
  onDeleteBuilding,
  onArchiveBuilding,
  onUnarchiveBuilding,
  currentUser,
  canManage = false,
  mode = 'active'
}: BuildingsTabProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [companyFilter, setCompanyFilter] = useState('all')
  const [buildingsWithCompany, setBuildingsWithCompany] = useState<Building[]>([])
  const [companies, setCompanies] = useState<Array<{ id: number; name: string }>>([])
  const [buildingTypes, setBuildingTypes] = useState<string[]>([])
  const [deletingId, setDeletingId] = useState<number | null>(null)

  useEffect(() => {
    const fetchBuildingTypes = async () => {
      const params = await fetchVotingParametersAction(currentUser?.company_id)
      if (Array.isArray(params)) {
        const types = params
          .filter(p => p.parameter_type === 'building_type')
          .map(p => p.value)
        setBuildingTypes([...new Set(types)])
      }
    }
    fetchBuildingTypes()
  }, [currentUser])

  // Fetch company data for all buildings
  useEffect(() => {
    fetchCompanyData()
  }, [buildings])

  const fetchCompanyData = async () => {
    try {
      const companyIds = buildings
        .map(b => b.company_id)
        .filter((id): id is number => id !== null && id !== undefined)
      
      const uniqueCompanyIds = [...new Set(companyIds)]
      
      if (uniqueCompanyIds.length === 0) {
        setBuildingsWithCompany(
          buildings.filter((b, idx, self) => self.findIndex(x => x.id === b.id) === idx)
        )
        return
      }

      const { data: companiesData } = await supabase
        .from('companies')
        .select('id, name')
        .in('id', uniqueCompanyIds)

      setCompanies(companiesData || [])

      const buildingsWithCompanyData = buildings
        .filter((building, idx, self) => self.findIndex(b => b.id === building.id) === idx) // deduplicate
        .map(building => ({
          ...building,
          company: building.company_id 
            ? companiesData?.find(c => c.id === building.company_id) || null
            : null
        }))

      setBuildingsWithCompany(buildingsWithCompanyData)
    } catch (error) {
      console.error('Error fetching company data:', error)
      setBuildingsWithCompany(
        buildings.filter((b, idx, self) => self.findIndex(x => x.id === b.id) === idx)
      )
    }
  }

  const filteredBuildings = buildingsWithCompany
    .filter((b, idx, self) => self.findIndex(x => x.id === b.id) === idx) // final dedup guard
    .filter(building => {
    if (typeFilter !== 'all' && building.building_type !== typeFilter) {
      return false
    }
    
    if (companyFilter !== 'all') {
      if (companyFilter === 'none' && building.company_id !== null) {
        return false
      }
      if (companyFilter !== 'none' && building.company_id !== parseInt(companyFilter)) {
        return false
      }
    }

    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase()
      const nameMatch = (building.name || '').toLowerCase().includes(q)
      const addressMatch = (building.address || '').toLowerCase().includes(q)
      if (!nameMatch && !addressMatch) {
        return false
      }
    }
    
    return true
  })

  const handleDeleteBuilding = async (building: Building) => {
    setDeletingId(building.id)
    try {
      await onDeleteBuilding?.(building)
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-foreground mb-2">
          {mode === 'active' ? 'Building Management' : 'Archive Storage'}
        </h2>
        <p className="text-muted-foreground">
          {mode === 'active' 
            ? (isMaster ? 'Manage all buildings in the system' : 'Manage your assigned buildings')
            : (isMaster ? 'View and restore archived buildings across all companies' : 'View and restore archived buildings for your company')
          }
        </p>
      </div>

      <div className="mb-4 flex items-center gap-4 flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <input
            type="text"
            placeholder="Search by name or address..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-2 bg-card border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">Type:</span>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {buildingTypes.map(type => (
                <SelectItem key={type} value={type}>{type}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isMaster && companies.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground">Company:</span>
            <Select value={companyFilter} onValueChange={setCompanyFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="All Companies" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Companies</SelectItem>
                <SelectItem value="none">No Company</SelectItem>
                {companies.map(company => (
                  <SelectItem key={company.id} value={company.id.toString()}>
                    {company.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {(typeFilter !== 'all' || companyFilter !== 'all' || searchQuery.trim() !== '') && (
          <span className="text-sm text-muted-foreground">
            Showing {filteredBuildings.length} of {buildings.length}
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
                onViewDetails={onViewDetails}
                isMaster={isMaster}
                onDelete={isMaster && mode === 'archive' ? handleDeleteBuilding : undefined}
                onArchive={mode === 'active' && canManage ? (b) => onArchiveBuilding?.(b) : undefined}
                onUnarchive={mode === 'archive' && canManage ? (b) => onUnarchiveBuilding?.(b) : undefined}
              />
            
            )
          })}
        </div>
      )}

      {filteredBuildings.length === 0 && !loading && (
        <div className="text-center py-12 border-2 border-dashed border-border rounded-lg">
          <p className="text-muted-foreground">
            {typeFilter === 'all' && companyFilter === 'all'
              ? 'No buildings found' 
              : `No buildings found matching filters`}
          </p>
        </div>
      )}
    </>
  )
}
