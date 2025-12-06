"use client"

import { useState, useEffect } from "react"
import { ArrowLeft, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getCurrentUser, Company } from "@/lib/supabase"
import { supabase } from "@/lib/supabase"
import { canManageCompanies, shouldFilterByCompany } from "@/lib/permissions"

// Import all the separated components
import CreateUserModal from "./admin/CreateUserModal"
import CreateBuildingModal from "./admin/CreateBuildingModal"
import EditBuildingModal from "./admin/EditBuildingModal"
import DocumentManagementModal from "./admin/DocumentManagementModal"
import ViewDocumentModal from "./admin/ViewDocumentModal"
import UsersTab from "./admin/UsersTab"
import BuildingsTab from "./admin/BuildingsTab"
import CompaniesTab from "./admin/CompaniesTab"
import MinutesTemplatesTab from "./admin/MinutesTemplatesTab"
import CreateCompanyModal from "./admin/CreateCompanyModal"
import EditCompanyModal from "./admin/EditCompanyModal"
import CompanyDetailsModal from "./admin/CompanyDetailsModal"
import AssignUsersToCompanyModal from "./admin/AssignUsersToCompanyModal"

interface AdminPanelProps {
  onBack: () => void
}

interface UserRow {
  id: number
  name: string
  email: string
  user_type: string
  created_at: string
  assigned_pm_id: number | null
  company_id: number | null
  buildings?: string[]
}

interface PropertyManager {
  id: number
  name: string
  email: string
}

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

type TabType = "users" | "buildings" | "companies" | "minutes"

export default function AdminPanel({ onBack }: AdminPanelProps) {
  const [activeTab, setActiveTab] = useState<TabType>("users")
  const [users, setUsers] = useState<UserRow[]>([])
  const [propertyManagers, setPropertyManagers] = useState<PropertyManager[]>([])
  const [filteredUsers, setFilteredUsers] = useState<UserRow[]>([])
  const [buildings, setBuildings] = useState<Building[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateUserModal, setShowCreateUserModal] = useState(false)
  const [showCreateBuildingModal, setShowCreateBuildingModal] = useState(false)
  const [showCreateCompanyModal, setShowCreateCompanyModal] = useState(false)
  const [showEditBuildingModal, setShowEditBuildingModal] = useState(false)
  const [selectedBuilding, setSelectedBuilding] = useState<Building | null>(null)
  
  // Company modals
  const [showEditCompanyModal, setShowEditCompanyModal] = useState(false)
  const [showCompanyDetailsModal, setShowCompanyDetailsModal] = useState(false)
  const [showAssignUsersModal, setShowAssignUsersModal] = useState(false)
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null)

  const currentUser = getCurrentUser()

  // Document Management States
  const [buildingDocuments, setBuildingDocuments] = useState<Record<number, boolean>>({})
  const [showDocumentModal, setShowDocumentModal] = useState(false)
  const [documentFormUrl, setDocumentFormUrl] = useState("")
  const [showViewDocumentModal, setShowViewDocumentModal] = useState(false)
  const [viewingDocument, setViewingDocument] = useState<{ building: Building; content: string } | null>(null)

  // Filters
  const [filterUserType, setFilterUserType] = useState<string>("all")
  const [filterBuilding, setFilterBuilding] = useState<string>("all")

  const isMaster = currentUser?.user_type === 'master'
  const isCorporateAdmin = currentUser?.user_type === 'corporate_administrator'
  const canCreateUser = isMaster || currentUser?.user_type === 'property_manager' || isCorporateAdmin
  const canCreateBuilding = isMaster || currentUser?.user_type === 'property_manager' || isCorporateAdmin
  const userCanManageCompanies = canManageCompanies(currentUser?.user_type || '')
  const userShouldFilterByCompany = shouldFilterByCompany(currentUser?.user_type || '')

  useEffect(() => {
    fetchCompanies()
    fetchPropertyManagers()
    fetchUsers()
    fetchBuildings()
  }, [])

  useEffect(() => {
    applyFilters()
  }, [users, filterUserType, filterBuilding])

  useEffect(() => {
    if (buildings.length > 0) {
      fetchBuildingDocuments()
    }
  }, [buildings])

  const fetchCompanies = async () => {
    try {
      let companiesQuery = supabase
        .from('companies')
        .select('*')
        .order('name')
  
      // Apply filtering based on user type
      if (isMaster) {
        // Master sees ALL companies - no filter needed
      } else if (isCorporateAdmin && currentUser?.company_id) {
        // Corporate Admin sees ONLY their company
        companiesQuery = companiesQuery.eq('id', currentUser.company_id)
      }
  
      const { data, error } = await companiesQuery
  
      if (error) {
        console.error('Error fetching companies:', error)
        return
      }
  
      setCompanies(data || [])
    } catch (err) {
      console.error('Unexpected error:', err)
    }
  }

  const fetchBuildingDocuments = async () => {
    try {
      const { data, error } = await supabase
        .from('building_documents')
        .select('building_id')

      if (error) {
        console.error('Error fetching building documents:', error)
        return
      }

      const documentsMap: Record<number, boolean> = {}
      data?.forEach(doc => {
        documentsMap[doc.building_id] = true
      })

      setBuildingDocuments(documentsMap)
    } catch (err) {
      console.error('Unexpected error:', err)
    }
  }

  const handleManageDocuments = (building: Building) => {
    const hasDocuments = buildingDocuments[building.id] || false
    
    const formUrl = hasDocuments
      ? `https://rulesengine.asccreative.com/form/8fe10f3e-bbb7-4ef0-8911-d43c27ad8666?Building Id=${building.id}&Building Name=${encodeURIComponent(building.name)}`
      : `https://rulesengine.asccreative.com/form/6a4fe687-c1f7-43ea-b6e3-687e5e9a47fa?Building Id=${building.id}&Building Name=${encodeURIComponent(building.name)}`

    setDocumentFormUrl(formUrl)
    setShowDocumentModal(true)
  }

  const handleViewDocument = async (building: Building) => {
    try {
      const { data, error } = await supabase
        .from('building_documents')
        .select('rules_and_regulations')
        .eq('building_id', building.id)
        .single()

      if (error) {
        console.error('Error fetching document:', error)
        alert('Failed to load document')
        return
      }

      setViewingDocument({
        building: building,
        content: data.rules_and_regulations || 'No content available'
      })
      setShowViewDocumentModal(true)
    } catch (err) {
      console.error('Unexpected error:', err)
      alert('Failed to load document')
    }
  }

  const fetchPropertyManagers = async () => {
    try {
      let query = supabase
        .from('users')
        .select('id, name, email, company_id')
        .eq('user_type', 'property_manager')
        .order('name')

      if (userShouldFilterByCompany && currentUser?.company_id) {
        query = query.eq('company_id', currentUser.company_id)
      }

      const { data, error } = await query

      if (error) {
        console.error('Error fetching property managers:', error)
        return
      }

      setPropertyManagers(data || [])
    } catch (err) {
      console.error('Unexpected error:', err)
    }
  }

  const fetchUsers = async () => {
    try {
      setLoading(true)

      let usersQuery = supabase
        .from('users')
        .select('id, name, email, user_type, assigned_pm_id, company_id, created_at')
        .order('created_at', { ascending: false })

      if (userShouldFilterByCompany && currentUser?.company_id) {
        usersQuery = usersQuery.eq('company_id', currentUser.company_id)
      }

      const { data: usersData, error: usersError } = await usersQuery

      if (usersError) {
        console.error('Error fetching users:', usersError)
        return
      }

      console.log('👥 Admin Panel - Users fetched:', usersData)

      const { data: userBuildingsData } = await supabase
        .from('user_buildings')
        .select(`
          user_id,
          building_id,
          buildings!inner(id, name)
        `)

      const usersWithBuildings = (usersData || []).map(user => {
        const userBuildings = (userBuildingsData || [])
          .filter((ub: any) => ub.user_id === user.id)
          .map((ub: any) => ub.buildings?.name)
          .filter(Boolean) as string[]

        return {
          ...user,
          buildings: userBuildings
        }
      })

      if (currentUser?.user_type === 'property_manager') {
        const filteredUsers = usersWithBuildings.filter(user => 
          user.assigned_pm_id === currentUser.id || user.id === currentUser.id
        )
        setUsers(filteredUsers)
      } else {
        setUsers(usersWithBuildings)
      }

    } catch (err) {
      console.error('Unexpected error:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchBuildings = async () => {
    try {
      let buildingsQuery = supabase
        .from('buildings')
        .select('id, name, address, manager_id, company_id, building_type, created_at')
        .order('name')

      // Apply filtering based on user type
      if (isMaster) {
        // Master sees ALL buildings - no filter needed
      } else if (isCorporateAdmin && currentUser?.company_id) {
        // Corporate Admin sees all buildings in their company
        buildingsQuery = buildingsQuery.eq('company_id', currentUser.company_id)
      } else if (currentUser?.user_type === 'property_manager') {
        // Property Manager sees only their buildings
        buildingsQuery = buildingsQuery.eq('manager_id', currentUser.id)
      } else {
        // Other users see buildings they're assigned to (handled separately)
        // For now, empty array
        setBuildings([])
        return
      }

      const { data: buildingsData, error: buildingsError } = await buildingsQuery

      if (buildingsError) {
        console.error('Error fetching buildings:', buildingsError)
        return
      }

      console.log('🏢 Admin Panel - Buildings fetched for', currentUser?.user_type, ':', buildingsData)

      // Fetch users for each building with user_type included
      const { data: userBuildingsData } = await supabase
        .from('user_buildings')
        .select(`
          building_id,
          users!inner(id, name, email, user_type)
        `)

      const buildingsWithUsers = (buildingsData || []).map(building => {
        const buildingUsers = (userBuildingsData || [])
          .filter((ub: any) => ub.building_id === building.id)
          .map((ub: any) => ub.users)
          .filter(Boolean)

        return {
          ...building,
          users: buildingUsers
        }
      })

      setBuildings(buildingsWithUsers)
    } catch (err) {
      console.error('Unexpected error:', err)
    }
  }

  const applyFilters = () => {
    let filtered = [...users]

    if (filterUserType !== "all") {
      filtered = filtered.filter(user => user.user_type === filterUserType)
    }

    if (filterBuilding !== "all") {
      if (filterBuilding === "unassigned") {
        filtered = filtered.filter(user => !user.buildings || user.buildings.length === 0)
      } else {
        filtered = filtered.filter(user => user.buildings?.includes(filterBuilding))
      }
    }

    setFilteredUsers(filtered)
  }

  const handleEditBuilding = (building: Building) => {
    setSelectedBuilding(building)
    setShowEditBuildingModal(true)
  }

  const handleCreateUserSuccess = () => {
    fetchUsers()
    fetchPropertyManagers()
  }

  const handleCreateBuildingSuccess = () => {
    fetchBuildings()
    fetchUsers()
  }

  const handleEditBuildingSuccess = () => {
    setSelectedBuilding(null)
    fetchBuildings()
    fetchUsers()
  }

  const handleCreateCompanySuccess = () => {
    fetchCompanies()
  }

  const handleEditCompanySuccess = () => {
    fetchCompanies()
    setSelectedCompany(null)
  }

  const handleDeleteCompany = async (company: Company) => {
    const { count: userCount } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', company.id)
  
    const { count: buildingCount } = await supabase
      .from('buildings')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', company.id)
  
    const confirmed = confirm(
      `⚠️ PERMANENT DELETE: "${company.name}"\n\n` +
      `This will DELETE FOREVER:\n` +
      `❌ ${userCount || 0} user(s)\n` +
      `❌ ${buildingCount || 0} building(s)\n` +
      `❌ All meetings, notes, tasks, decisions\n\n` +
      `This CANNOT be undone!\n\n` +
      `Type the company name to confirm deletion.`
    )
    
    if (!confirmed) return
  
    try {
      const { error } = await supabase
        .from('companies')
        .delete()
        .eq('id', company.id)
  
      if (error) {
        console.error('Error deleting company:', error)
        alert('Failed to delete company')
        return
      }
  
      console.log('✅ Company and ALL related data deleted permanently')
      fetchCompanies()
      fetchUsers()
      fetchBuildings()
    } catch (err) {
      console.error('Unexpected error:', err)
      alert('Failed to delete company')
    }
  }

  const handleEditCompany = (company: Company) => {
    setSelectedCompany(company)
    setShowEditCompanyModal(true)
  }

  const handleViewCompanyDetails = (company: Company) => {
    setSelectedCompany(company)
    setShowCompanyDetailsModal(true)
  }

  const handleAssignUsers = (company: Company) => {
    setSelectedCompany(company)
    setShowAssignUsersModal(true)
  }

  const getBuildingsList = () => {
    return buildings
  }

  const getAvailableUsers = () => {
    console.log('🔍 getAvailableUsers called - currentUser:', currentUser?.user_type, currentUser?.company_id)
    console.log('🔍 Total users available:', users.length, users)
    
    if (isCorporateAdmin && currentUser?.company_id) {
      console.log('🔍 Corporate Admin - returning all company users')
      const filtered = users
      console.log('🔍 Filtered users for Corporate Admin:', filtered)
      return filtered
    }
    
    if (currentUser?.user_type === 'property_manager') {
      const filtered = users.filter(u => 
        (u.assigned_pm_id === currentUser.id && u.user_type === 'user') ||
        u.id === currentUser.id
      )
      console.log('🔍 Property Manager - filtered users:', filtered)
      return filtered
    }
    
    console.log('🔍 Master - returning all users')
    return users
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted">
      <header className="border-b border-border bg-card shadow-sm sticky top-0 z-40">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={onBack} className="hover:bg-muted">
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-xl font-bold text-foreground">Admin Panel</h1>
                <p className="text-sm text-muted-foreground">Manage users, buildings, companies and minutes templates</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {activeTab === "users" && canCreateUser && (
                <Button
                  onClick={() => setShowCreateUserModal(true)}
                  className="bg-gradient-to-r from-primary to-decision-purple text-primary-foreground"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create User
                </Button>
              )}
              {activeTab === "buildings" && canCreateBuilding && (
                <Button
                  onClick={() => setShowCreateBuildingModal(true)}
                  className="bg-gradient-to-r from-primary to-decision-purple text-primary-foreground"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create Building
                </Button>
              )}
              {activeTab === "companies" && userCanManageCompanies && (
                <Button
                  onClick={() => setShowCreateCompanyModal(true)}
                  className="bg-gradient-to-r from-primary to-decision-purple text-primary-foreground"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create Company
                </Button>
              )}
            </div>
          </div>

          <div className="flex gap-4 mt-4">
            <button
              onClick={() => setActiveTab("users")}
              className={`pb-2 px-1 font-medium text-sm transition-colors ${
                activeTab === "users"
                  ? "text-primary border-b-2 border-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              👥 Users
            </button>
            <button
              onClick={() => setActiveTab("buildings")}
              className={`pb-2 px-1 font-medium text-sm transition-colors ${
                activeTab === "buildings"
                  ? "text-primary border-b-2 border-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              🏢 Buildings
            </button>
            {userCanManageCompanies && (
              <button
                onClick={() => setActiveTab("companies")}
                className={`pb-2 px-1 font-medium text-sm transition-colors ${
                  activeTab === "companies"
                    ? "text-primary border-b-2 border-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                🏛️ Companies
              </button>
            )}
            <button
              onClick={() => setActiveTab("minutes")}
              className={`pb-2 px-1 font-medium text-sm transition-colors ${
                activeTab === "minutes"
                  ? "text-primary border-b-2 border-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              📄 Minutes Templates
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {activeTab === "users" && (
          <UsersTab
            users={users}
            filteredUsers={filteredUsers}
            buildings={getBuildingsList()}
            filterUserType={filterUserType}
            filterBuilding={filterBuilding}
            loading={loading}
            isMaster={isMaster}
            onFilterUserTypeChange={setFilterUserType}
            onFilterBuildingChange={setFilterBuilding}
          />
        )}

        {activeTab === "buildings" && (
          <BuildingsTab
            buildings={getBuildingsList()}
            buildingDocuments={buildingDocuments}
            loading={loading}
            isMaster={isMaster}
            onEditBuilding={handleEditBuilding}
            onViewDocument={handleViewDocument}
            onManageDocuments={handleManageDocuments}
          />
        )}

        {activeTab === "companies" && userCanManageCompanies && (
          <CompaniesTab
            companies={companies}
            loading={loading}
            onEdit={handleEditCompany}
            onDelete={handleDeleteCompany}
            onViewDetails={handleViewCompanyDetails}
            onAssignUsers={handleAssignUsers}
            onRefresh={fetchCompanies}
          />
        )}

        {activeTab === "minutes" && (
          <MinutesTemplatesTab
            buildings={getBuildingsList()}
            loading={loading}
          />
        )}
      </div>

      {/* ALL MODALS */}
      <CreateUserModal
        isOpen={showCreateUserModal}
        onClose={() => setShowCreateUserModal(false)}
        onSuccess={handleCreateUserSuccess}
        currentUser={currentUser}
        propertyManagers={propertyManagers}
        buildings={getBuildingsList()}
        companies={companies}
      />

      <CreateBuildingModal
        isOpen={showCreateBuildingModal}
        onClose={() => setShowCreateBuildingModal(false)}
        onSuccess={handleCreateBuildingSuccess}
        currentUser={currentUser}
        availableUsers={getAvailableUsers()}
      />

      <EditBuildingModal
        isOpen={showEditBuildingModal}
        onClose={() => {
          setShowEditBuildingModal(false)
          setSelectedBuilding(null)
        }}
        onSuccess={handleEditBuildingSuccess}
        building={selectedBuilding}
        availableUsers={getAvailableUsers()}
      />

      <CreateCompanyModal
        isOpen={showCreateCompanyModal}
        onClose={() => setShowCreateCompanyModal(false)}
        onSuccess={handleCreateCompanySuccess}
      />

      <EditCompanyModal
        isOpen={showEditCompanyModal}
        onClose={() => {
          setShowEditCompanyModal(false)
          setSelectedCompany(null)
        }}
        onSuccess={handleEditCompanySuccess}
        company={selectedCompany}
      />

      <CompanyDetailsModal
        isOpen={showCompanyDetailsModal}
        onClose={() => {
          setShowCompanyDetailsModal(false)
          setSelectedCompany(null)
        }}
        company={selectedCompany}
      />

      <AssignUsersToCompanyModal
        isOpen={showAssignUsersModal}
        onClose={() => {
          setShowAssignUsersModal(false)
          setSelectedCompany(null)
        }}
        onSuccess={() => {
          fetchCompanies()
          fetchUsers()
        }}
        company={selectedCompany}
      />

      <DocumentManagementModal
        isOpen={showDocumentModal}
        onClose={() => {
          setShowDocumentModal(false)
          fetchBuildingDocuments()
        }}
        documentFormUrl={documentFormUrl}
      />

      <ViewDocumentModal
        isOpen={showViewDocumentModal}
        onClose={() => {
          setShowViewDocumentModal(false)
          setViewingDocument(null)
        }}
        viewingDocument={viewingDocument}
      />
    </div>
  )
}
