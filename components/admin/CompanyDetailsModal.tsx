"use client"

import { useState, useEffect } from "react"
import { X, Users, Building2, UserCheck, Home } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { supabase } from "@/lib/supabase"

interface Company {
  id: number
  name: string
  created_at: string
}

interface CompanyDetailsModalProps {
  isOpen: boolean
  onClose: () => void
  company: Company | null
}

interface User {
  id: number
  name: string
  email: string
  user_type: string
}

interface Building {
  id: number
  name: string
  address: string | null
}

export default function CompanyDetailsModal({
  isOpen,
  onClose,
  company
}: CompanyDetailsModalProps) {
  const [users, setUsers] = useState<User[]>([])
  const [buildings, setBuildings] = useState<Building[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (company && isOpen) {
      fetchCompanyData()
    }
  }, [company, isOpen])

  const fetchCompanyData = async () => {
    if (!company) return

    setLoading(true)
    try {
      // Fetch users in this company
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('id, name, email, user_type')
        .eq('company_id', company.id)
        .order('name')

      if (usersError) {
        console.error('Error fetching users:', usersError)
      } else {
        setUsers(usersData || [])
      }

      // Fetch buildings in this company
      const { data: buildingsData, error: buildingsError } = await supabase
        .from('buildings')
        .select('id, name, address')
        .eq('company_id', company.id)
        .order('name')

      if (buildingsError) {
        console.error('Error fetching buildings:', buildingsError)
      } else {
        setBuildings(buildingsData || [])
      }

    } catch (err) {
      console.error('Unexpected error:', err)
    } finally {
      setLoading(false)
    }
  }

  const getUserTypeBadge = (userType: string) => {
    const badges: Record<string, { color: string; label: string }> = {
      master: { color: 'bg-red-100 text-red-800', label: 'Master' },
      corporate_administrator: { color: 'bg-purple-100 text-purple-800', label: 'Corp Admin' },
      property_manager: { color: 'bg-blue-100 text-blue-800', label: 'PM' },
      user: { color: 'bg-green-100 text-green-800', label: 'User' },
      vendor: { color: 'bg-orange-100 text-orange-800', label: 'Vendor' },
      attendee: { color: 'bg-gray-100 text-gray-800', label: 'Attendee' }
    }

    const badge = badges[userType] || { color: 'bg-gray-100 text-gray-800', label: userType }

    return (
      <span className={`text-xs px-2 py-1 rounded ${badge.color}`}>
        {badge.label}
      </span>
    )
  }

  if (!isOpen || !company) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-in fade-in overflow-y-auto p-4">
      <Card className="w-full max-w-4xl border-0 rounded-2xl shadow-2xl my-8 max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between border-b border-border bg-gradient-to-r from-primary/5 to-decision-purple/5 p-6">
          <div>
            <h2 className="text-xl font-bold text-foreground">{company.name}</h2>
            <p className="text-sm text-muted-foreground">
              Company Details & Statistics
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded hover:bg-muted transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {loading ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Loading company data...</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Statistics */}
              <div className="grid grid-cols-3 gap-4">
                <Card className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-blue-500 rounded-lg">
                      <Users className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-blue-900">{users.length}</p>
                      <p className="text-sm text-blue-700">Total Users</p>
                    </div>
                  </div>
                </Card>

                <Card className="p-4 bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-purple-500 rounded-lg">
                      <UserCheck className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-purple-900">
                        {users.filter(u => u.user_type === 'property_manager').length}
                      </p>
                      <p className="text-sm text-purple-700">Property Managers</p>
                    </div>
                  </div>
                </Card>

                <Card className="p-4 bg-gradient-to-br from-green-50 to-green-100 border-green-200">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-green-500 rounded-lg">
                      <Building2 className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-green-900">{buildings.length}</p>
                      <p className="text-sm text-green-700">Buildings</p>
                    </div>
                  </div>
                </Card>
              </div>

              {/* Users Section */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Users className="h-5 w-5 text-primary" />
                  <h3 className="text-lg font-semibold text-foreground">Users in Company</h3>
                </div>

                {users.length === 0 ? (
                  <div className="text-center py-8 border-2 border-dashed border-border rounded-lg">
                    <p className="text-muted-foreground">No users assigned to this company yet</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {users.map((user) => (
                      <Card key={user.id} className="p-3 hover:shadow-sm transition-shadow">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-foreground">{user.name}</p>
                            <p className="text-sm text-muted-foreground">{user.email}</p>
                          </div>
                          {getUserTypeBadge(user.user_type)}
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </div>

              {/* Buildings Section */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Building2 className="h-5 w-5 text-primary" />
                  <h3 className="text-lg font-semibold text-foreground">Buildings in Company</h3>
                </div>

                {buildings.length === 0 ? (
                  <div className="text-center py-8 border-2 border-dashed border-border rounded-lg">
                    <p className="text-muted-foreground">No buildings assigned to this company yet</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {buildings.map((building) => (
                      <Card key={building.id} className="p-3 hover:shadow-sm transition-shadow">
                        <div className="flex items-center gap-3">
                          <Home className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <p className="font-medium text-foreground">{building.name}</p>
                            {building.address && (
                              <p className="text-sm text-muted-foreground">{building.address}</p>
                            )}
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-border p-6">
          <Button 
            onClick={onClose} 
            className="w-full bg-gradient-to-r from-primary to-decision-purple text-primary-foreground"
          >
            Close
          </Button>
        </div>
      </Card>
    </div>
  )
}