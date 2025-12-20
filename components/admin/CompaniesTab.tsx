"use client"

import { useState, useEffect } from "react"
import CompanyCard from "./CompanyCard"
import { supabase, Company } from "@/lib/supabase"

interface CompanyWithCounts extends Company {
  user_count?: number
  building_count?: number
}

interface CompaniesTabProps {
  companies: Company[]
  loading: boolean
  onEdit: (company: Company) => void
  onDelete: (company: Company) => void
  onViewDetails: (company: Company) => void
  onAssignUsers: (company: Company) => void  // ✅ ADD THIS LINE
  onRefresh: () => void
}


export default function CompaniesTab({
  companies,
  loading,
  onEdit,
  onDelete,
  onViewDetails,
  onRefresh
}: CompaniesTabProps) {
  const [companiesWithCounts, setCompaniesWithCounts] = useState<CompanyWithCounts[]>([])

  useEffect(() => {
    if (companies.length > 0) {
      fetchCompanyCounts()
    }
  }, [companies])

  const fetchCompanyCounts = async () => {
    try {
      const companiesWithStats = await Promise.all(
        companies.map(async (company) => {
          // Get user count
          const { count: userCount } = await supabase
            .from('users')
            .select('*', { count: 'exact', head: true })
            .eq('company_id', company.id)

          // Get building count
          const { count: buildingCount } = await supabase
            .from('buildings')
            .select('*', { count: 'exact', head: true })
            .eq('company_id', company.id)

          return {
            ...company,
            user_count: userCount || 0,
            building_count: buildingCount || 0
          }
        })
      )

      setCompaniesWithCounts(companiesWithStats)
    } catch (err) {
      console.error('Error fetching company counts:', err)
      setCompaniesWithCounts(companies)
    }
  }

  const handleDelete = async (company: Company) => {
    onDelete(company)
  }

  return (
    <>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-foreground mb-2">Company Management</h2>
        <p className="text-muted-foreground">
          Manage property management companies in the system
        </p>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading companies...</p>
        </div>
      ) : (
        <div className="space-y-4">
          {(companiesWithCounts.length > 0 ? companiesWithCounts : companies).map((company) => (
            <CompanyCard
              key={company.id}
              company={company}
              onEdit={onEdit}
              onDelete={handleDelete}
              onViewDetails={onViewDetails}
            />
          ))}
        </div>
      )}

      {companies.length === 0 && !loading && (
        <div className="text-center py-12 border-2 border-dashed border-border rounded-lg">
          <p className="text-muted-foreground mb-2">No companies found</p>
          <p className="text-sm text-muted-foreground">Click "Create Company" to add your first company</p>
        </div>
      )}
    </>
  )
}
