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
}



export default function CompanyCard({
  company,
  onEdit,
  onDelete,
  onViewDetails
}: CompanyCardProps) {


  return (
    <Card className="p-4 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 flex-1">
          {/* Company Logo or Default Icon */}
          {company.logo_url ? (
            <div className="relative w-12 h-12 rounded-full overflow-hidden bg-white border-2 border-border">
              <Image
                src={company.logo_url}
                alt={`${company.name} logo`}
                fill
                className="object-contain p-1"
                sizes="48px"
              />
            </div>
          ) : (
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600">
              <Building2 className="h-6 w-6 text-white" />
            </div>
          )}

          <div className="flex-1">
            <h3 className="font-semibold text-foreground text-lg">{company.name}</h3>
            <div className="flex items-center gap-4 mt-1">
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Users className="h-4 w-4" />
                <span>{company.user_count || 0} users</span>
              </div>
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Building2 className="h-4 w-4" />
                <span>{company.building_count || 0} buildings</span>
              </div>
              

            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onViewDetails(company)}
            title="View Details"
          >
            <Info className="h-4 w-4 mr-2" />
            Details
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => onEdit(company)}
            title="Edit Company"
          >
            <Edit2 className="h-4 w-4" />
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => onDelete(company)}
            title="Delete Company"
            className="text-red-600 hover:bg-red-50"
          >
            <Trash2 className="h-4 w-4" />
          </Button>

          <p className="text-sm text-muted-foreground whitespace-nowrap ml-2">
            {new Date(company.created_at).toLocaleDateString()}
          </p>
        </div>
      </div>
    </Card>
  )
}
