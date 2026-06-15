"use client"

import { Building2, Users, Edit2, Trash2, Info } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Company } from "@/lib/supabase"
import Image from "next/image"

interface CompanyWithCounts extends Company {
  user_count?: number
  building_count?: number
}

interface CompanyCardProps {
  company: CompanyWithCounts
  onEdit: (company: Company) => void
  onDelete: (company: Company) => void
  onViewDetails: (company: Company) => void
  canManage?: boolean
}



export default function CompanyCard({
  company,
  onEdit,
  onDelete,
  onViewDetails,
  canManage = false
}: CompanyCardProps) {


  return (
    <Card className="p-4 hover:shadow-md transition-shadow">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4 flex-1 min-w-0">
          {/* Company Logo or Default Icon */}
          {company.logo_url ? (
            <div className="relative w-12 h-12 rounded-full overflow-hidden bg-white border-2 border-border flex-shrink-0">
              <Image
                src={company.logo_url}
                alt={`${company.name} logo`}
                fill
                className="object-contain p-1"
                sizes="48px"
              />
            </div>
          ) : (
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex-shrink-0">
              <Building2 className="h-6 w-6 text-white" />
            </div>
          )}

          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground text-base sm:text-lg truncate">{company.name}</h3>
            <div className="flex flex-wrap items-center gap-3 mt-1 sm:gap-4">
              <div className="flex items-center gap-1 text-xs sm:text-sm text-muted-foreground">
                <Users className="h-3.5 w-3.5" />
                <span>{company.user_count || 0} users</span>
              </div>
              <div className="flex items-center gap-1 text-xs sm:text-sm text-muted-foreground">
                <Building2 className="h-3.5 w-3.5" />
                <span>{company.building_count || 0} buildings</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onViewDetails(company)}
            title="View Details"
            className="text-xs h-8 sm:h-9"
          >
            <Info className="h-3.5 w-3.5 mr-1 sm:mr-2" />
            Details
          </Button>

          {canManage && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onEdit(company)}
                title="Edit Company"
                className="h-8 w-8 p-0 sm:h-9 sm:w-9"
              >
                <Edit2 className="h-3.5 w-3.5" />
              </Button>

              <Button
                size="sm"
                variant="outline"
                onClick={() => onDelete(company)}
                title="Delete Company"
                className="text-red-600 hover:bg-red-50 h-8 w-8 p-0 sm:h-9 sm:w-9"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </>
          )}

          <p className="text-xs text-muted-foreground whitespace-nowrap ml-auto sm:ml-2">
            {new Date(company.created_at).toLocaleDateString()}
          </p>
        </div>
      </div>
    </Card>
  )
}
