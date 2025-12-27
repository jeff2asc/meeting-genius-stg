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

interface Building {
  id: number
  name: string
  address: string | null
  manager_id: number
  company_id: number | null
  building_type?: string
  created_at: string
  users?: Array<{ id: number; name: string; email: string; user_type: string }>
  company?: { id: number; name: string } | null
}

interface BuildingsTabProps {
  buildings: Building[]  // ✅ Changed from 'building'
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
  const [companyFilter, setCompanyFilter] = useState<string>('all')
  const [buildingsWithCompany, setBuildingsWithCompany] = useState<Building[]>([])
  const [companies, setCompanies] = useState<Array<{ id: number; name: string }>>([])

  // Fetch company data for all buildings
  useEffect(() => {
    fetchCompanyData()
  }, [buildings])

  const fetchCompanyData = async () => {
    try {
      const companyIds = [...new Set(buildings.map(b => b.company_id).filter(Boolean))]
      
      if (companyIds.length === 0) {
        setBuildingsWithCompany(buildings)
        return
      }

      const { data: companiesData } = await supabase
        .from('companies')
        .select('id, name')
        .in('id', companyIds)

      setCompanies(companiesData || [])

      const buildingsWithCompanyData = buildings.map(building => ({
        ...building,
        company: building.company_id 
          ? companiesData?.find(c => c.id === building.company_id) || null
          : null
      }))

      setBuildingsWithCompany(buildingsWithCompanyData)
    } catch (error) {
      console.error('Error fetching company data:', error)
      setBuildingsWithCompany(buildings)
    }
  }

  const filteredBuildings = buildingsWithCompany.filter(building => {
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
    
    return true
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

      <div className="mb-4 flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">Type:</span>
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

        {(typeFilter !== 'all' || companyFilter !== 'all') && (
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
              onViewDetails={onViewDetails}  // ✅ Keep only this
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
