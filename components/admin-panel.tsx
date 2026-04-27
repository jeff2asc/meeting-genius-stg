"use client"

import { useState, useEffect } from "react"
import { ArrowLeft, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getCurrentUser, Company } from "@/lib/supabase"
import { supabase } from "@/lib/supabase"
import { canManageCompanies, shouldFilterByCompany, isMaster as checkIsMaster, isCorporateAdmin as checkIsCorporateAdmin, isPropertyManager as checkIsPropertyManager } from "@/lib/permissions"

// Import all the separated components
import CreateUserModal from "./admin/CreateUserModal"
import CreateBuildingModal from "./admin/CreateBuildingModal"
import BuildingDetailsModal from "./admin/BuildingDetailsModal"
import DocumentManagementModal from "./admin/DocumentManagementModal"
import ViewDocumentModal from "./admin/ViewDocumentModal"
import UsersTab from "./admin/UsersTab"
import BuildingsTab from "./admin/BuildingsTab"
import CompaniesTab from "./admin/CompaniesTab"
import AgendaTemplatesTab from "./admin/AgendaTemplatesTab"
import CreateCompanyModal from "./admin/CreateCompanyModal"
import EditCompanyModal from "./admin/EditCompanyModal"
import CompanyDetailsModal from "./admin/CompanyDetailsModal"
import AssignUsersToCompanyModal from "./admin/AssignUsersToCompanyModal"

// UPDATED: Minutes templates designer (now per building via buildings+loading)
import MinutesTemplatesTab from "./MinutesTemplatesTab"
import SystemAuditTab from "./admin/SystemAuditTab"
import LlmSettingsTab from "./admin/LlmSettingsTab"


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
  roles?: string[] | null
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

type TabType = "users" | "buildings" | "companies" | "minutes" | "agenda" | "audit" | "settings"

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
  const [showBuildingDetailsModal, setShowBuildingDetailsModal] = useState(false)
  const [selectedBuilding, setSelectedBuilding] = useState<Building | null>(null)

  // Edit User Modal States
  const [showEditUserModal, setShowEditUserModal] = useState(false)
  const [editingUserId, setEditingUserId] = useState<number | null>(null)

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
  const [viewingDocument, setViewingDocument] = useState<{
    building: Building
    content: string
  } | null>(null)

  // Filters
  const [filterUserType, setFilterUserType] = useState<string>("all")
  const [filterBuilding, setFilterBuilding] = useState<string>("all")

  const isMaster = checkIsMaster(currentUser)
  const isCorporateAdmin = checkIsCorporateAdmin(currentUser)
  const isPropManager = checkIsPropertyManager(currentUser)
  const canCreateUser =
    isMaster || isPropManager || isCorporateAdmin
  const canCreateBuilding =
    isMaster || isPropManager || isCorporateAdmin
  const userCanManageCompanies = canManageCompanies(currentUser)
  const userShouldFilterByCompany = shouldFilterByCompany(currentUser)

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

  const handleEditUser = (userId: number) => {
    setEditingUserId(userId)
    setShowEditUserModal(true)
  }

  const handleDeleteUser = async (userId: number) => {
    const confirmed = window.confirm("Are you sure you want to delete this user?")
    if (!confirmed) return

    try {
      const { error } = await supabase.from("users").delete().eq("id", userId)

      if (error) {
        console.error("Error deleting user:", error)
        alert("Failed to delete user")
        return
      }

      await fetchUsers()
    } catch (err) {
      console.error("Unexpected error deleting user:", err)
      alert("Failed to delete user")
    }
  }

  const fetchCompanies = async () => {
    try {
      let companiesQuery = supabase.from("companies").select("*").order("name")

      if (isMaster) {
        // Master sees all companies
      } else if (isCorporateAdmin && currentUser?.company_id) {
        companiesQuery = companiesQuery.eq("id", currentUser.company_id)
      }

      const { data, error } = await companiesQuery

      if (error) {
        console.error("Error fetching companies:", error)
        return
      }

      setCompanies(data || [])
    } catch (err) {
      console.error("Unexpected error:", err)
    }
  }

  const fetchBuildingDocuments = async () => {
    try {
      const { data, error } = await supabase
        .from("building_documents")
        .select("building_id")

      if (error) {
        console.error("Error fetching building documents:", error)
        return
      }

      const documentsMap: Record<number, boolean> = {}
      data?.forEach((doc) => {
        documentsMap[doc.building_id] = true
      })

      setBuildingDocuments(documentsMap)
    } catch (err) {
      console.error("Unexpected error:", err)
    }
  }

  const handleManageDocuments = (building: Building) => {
    const hasDocuments = buildingDocuments[building.id] || false

    const formUrl = hasDocuments
      ? `https://rulesengine.asccreative.com/form/8fe10f3e-bbb7-4ef0-8911-d43c27ad8666?Building Id=${
          building.id
        }&Building Name=${encodeURIComponent(building.name)}`
      : `https://rulesengine.asccreative.com/form/6a4fe687-c1f7-43ea-b6e3-687e5e9a47fa?Building Id=${
          building.id
        }&Building Name=${encodeURIComponent(building.name)}`

    setDocumentFormUrl(formUrl)
    setShowDocumentModal(true)
  }

  const handleViewDocument = async (building: Building) => {
    try {
      const { data, error } = await supabase
        .from("building_documents")
        .select("rules_and_regulations")
        .eq("building_id", building.id)
        .single()

      if (error) {
        console.error("Error fetching document:", error)
        alert("Failed to load document")
        return
      }

      setViewingDocument({
        building,
        content: data.rules_and_regulations || "No content available",
      })
      setShowViewDocumentModal(true)
    } catch (err) {
      console.error("Unexpected error:", err)
      alert("Failed to load document")
    }
  }

  const fetchPropertyManagers = async () => {
    try {
      let query = supabase
        .from("users")
        .select("id, name, email, company_id")
        .eq("user_type", "property_manager")
        .order("name")

      if (isCorporateAdmin && currentUser?.company_id) {
        query = query.eq("company_id", currentUser.company_id)
      }

      const { data, error } = await query

      if (error) {
        console.error("Error fetching property managers:", error)
        return
      }

      setPropertyManagers(data || [])
    } catch (err) {
      console.error("Unexpected error:", err)
    }
  }

  const fetchUsers = async () => {
    try {
      setLoading(true)

      let usersQuery = supabase
        .from("users")
        .select("id, name, email, user_type, roles, assigned_pm_id, company_id, created_at")
        .order("created_at", { ascending: false })

      if (isCorporateAdmin && currentUser?.company_id) {
        usersQuery = usersQuery.eq("company_id", currentUser.company_id)
      }

      const { data: usersData, error: usersError } = await usersQuery

      if (usersError) {
        console.error("Error fetching users:", usersError)
        return
      }

      const { data: userBuildingsData } = await supabase
        .from("user_buildings")
        .select(
          `
          user_id,
          building_id,
          buildings!inner(id, name)
        `
        )

      const usersWithBuildings = (usersData || []).map((user) => {
        const userBuildings = (userBuildingsData || [])
          .filter((ub: any) => ub.user_id === user.id)
          .map((ub: any) => ub.buildings?.name)
          .filter(Boolean) as string[]

        return {
          ...user,
          buildings: userBuildings,
        }
      })

      if (!isMaster && !isCorporateAdmin && isPropManager) {
        const filteredUsers = usersWithBuildings.filter(
          (user) => user.assigned_pm_id === currentUser?.id || user.id === currentUser?.id
        )
        setUsers(filteredUsers)
      } else {
        setUsers(usersWithBuildings)
      }
    } catch (err) {
      console.error("Unexpected error:", err)
    } finally {
      setLoading(false)
    }
  }

  const fetchBuildings = async () => {
    try {
      let buildingsQuery = supabase
        .from("buildings")
        .select(
          "id, name, address, manager_id, company_id, building_type, created_at"
        )
        .order("name")

      if (isMaster) {
        // master sees all buildings
      } else if (isCorporateAdmin && currentUser?.company_id) {
        buildingsQuery = buildingsQuery.eq("company_id", currentUser.company_id)
      } else if (isPropManager) {
        buildingsQuery = buildingsQuery.eq("manager_id", currentUser?.id)
      } else {
        setBuildings([])
        return
      }

      const { data: buildingsData, error: buildingsError } = await buildingsQuery

      if (buildingsError) {
        console.error("Error fetching buildings:", buildingsError)
        return
      }

      const { data: userBuildingsData } = await supabase
        .from("user_buildings")
        .select(
          `
          building_id,
          users!inner(id, name, email, user_type)
        `
        )

      const buildingsWithUsers = (buildingsData || []).map((building) => {
        const buildingUsers = (userBuildingsData || [])
          .filter((ub: any) => ub.building_id === building.id)
          .map((ub: any) => ub.users)
          .filter(Boolean)

        return {
          ...building,
          users: buildingUsers,
        }
      })

      setBuildings(buildingsWithUsers)
    } catch (err) {
      console.error("Unexpected error:", err)
    }
  }

  const applyFilters = () => {
    let filtered = [...users]

    if (filterUserType !== "all") {
      filtered = filtered.filter((user) => user.user_type === filterUserType)
    }

    if (filterBuilding !== "all") {
      if (filterBuilding === "unassigned") {
        filtered = filtered.filter(
          (user) => !user.buildings || user.buildings.length === 0
        )
      } else {
        filtered = filtered.filter((user) =>
          user.buildings?.includes(filterBuilding)
        )
      }
    }

    setFilteredUsers(filtered)
  }

  const handleViewBuildingDetails = (building: Building) => {
    setSelectedBuilding(building)
    setShowBuildingDetailsModal(true)
  }

  const handleCreateUserSuccess = () => {
    fetchUsers()
    fetchPropertyManagers()
  }

  const handleCreateBuildingSuccess = () => {
    fetchBuildings()
    fetchUsers()
  }

  const handleBuildingDetailsSuccess = () => {
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
      .from("users")
      .select("*", { count: "exact", head: true })
      .eq("company_id", company.id)

    const { count: buildingCount } = await supabase
      .from("buildings")
      .select("*", { count: "exact", head: true })
      .eq("company_id", company.id)

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
      const { error } = await supabase.from("companies").delete().eq("id", company.id)

      if (error) {
        console.error("Error deleting company:", error)
        alert("Failed to delete company")
        return
      }

      fetchCompanies()
      fetchUsers()
      fetchBuildings()
    } catch (err) {
      console.error("Unexpected error:", err)
      alert("Failed to delete company")
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

  const getBuildingsList = () => buildings

  const getAvailableUsers = () => {
    if (isCorporateAdmin && currentUser?.company_id) {
      return users
    }

    if (isPropManager) {
      const filtered = users.filter(
        (u) =>
          (u.assigned_pm_id === currentUser?.id && u.user_type === "user") ||
          u.id === currentUser?.id
      )
      return filtered
    }

    return users
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted">
      <header className="border-b border-border bg-card shadow-sm sticky top-0 z-40">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={onBack}
                className="hover:bg-muted"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="min-w-0">
                <h1 className="text-lg sm:text-xl font-bold text-foreground truncate">Admin Panel</h1>
                <p className="text-[10px] sm:text-sm text-muted-foreground truncate sm:whitespace-normal">
                  Manage users, buildings, companies, minutes and agenda templates
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {activeTab === "users" && canCreateUser && (
                <Button
                  onClick={() => setShowCreateUserModal(true)}
                  size="sm"
                  className="bg-gradient-to-r from-primary to-decision-purple text-primary-foreground text-[10px] sm:text-sm px-2 sm:px-4"
                >
                  <Plus className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                  <span className="truncate">Create User</span>
                </Button>
              )}
              {activeTab === "buildings" && canCreateBuilding && (
                <Button
                  onClick={() => setShowCreateBuildingModal(true)}
                  size="sm"
                  className="bg-gradient-to-r from-primary to-decision-purple text-primary-foreground text-[10px] sm:text-sm px-2 sm:px-4"
                >
                  <Plus className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                  <span className="truncate">Create Building</span>
                </Button>
              )}
              {activeTab === "companies" && userCanManageCompanies && (
                <Button
                  onClick={() => setShowCreateCompanyModal(true)}
                  size="sm"
                  className="bg-gradient-to-r from-primary to-decision-purple text-primary-foreground text-[10px] sm:text-sm px-2 sm:px-4"
                >
                  <Plus className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                  <span className="truncate">Create Company</span>
                </Button>
              )}
            </div>
          </div>

          <div className="flex gap-4 mt-4 overflow-x-auto scrollbar-hide pb-1">
            <button
              onClick={() => setActiveTab("users")}
              className={`pb-2 px-1 font-medium text-xs sm:text-sm transition-colors whitespace-nowrap flex-shrink-0 ${
                activeTab === "users"
                  ? "text-primary border-b-2 border-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              👥 Users
            </button>
            <button
              onClick={() => setActiveTab("buildings")}
              className={`pb-2 px-1 font-medium text-xs sm:text-sm transition-colors whitespace-nowrap flex-shrink-0 ${
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
                className={`pb-2 px-1 font-medium text-xs sm:text-sm transition-colors whitespace-nowrap flex-shrink-0 ${
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
              className={`pb-2 px-1 font-medium text-xs sm:text-sm transition-colors whitespace-nowrap flex-shrink-0 ${
                activeTab === "minutes"
                  ? "text-primary border-b-2 border-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              📄 Minutes
            </button>
              <button
              onClick={() => setActiveTab("agenda")}
              className={`pb-2 px-1 font-medium text-xs sm:text-sm transition-colors whitespace-nowrap flex-shrink-0 ${
                activeTab === "agenda"
                  ? "text-primary border-b-2 border-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              📋 Agenda
            </button>
            {(isMaster || isCorporateAdmin) && (
              <button
                onClick={() => setActiveTab("audit")}
                className={`pb-2 px-1 font-medium text-xs sm:text-sm transition-colors whitespace-nowrap flex-shrink-0 ${
                  activeTab === "audit"
                    ? "text-primary border-b-2 border-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                🔍 Audit
              </button>
            )}
            {isMaster && (
              <button
                onClick={() => setActiveTab("settings")}
                className={`pb-2 px-1 font-medium text-xs sm:text-sm transition-colors whitespace-nowrap flex-shrink-0 ${
                  activeTab === "settings"
                    ? "text-primary border-b-2 border-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                ⚙️ Settings
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {activeTab === "audit" && (isMaster || isCorporateAdmin) && (
          <SystemAuditTab companyId={isCorporateAdmin ? (currentUser?.company_id ?? undefined) : undefined} />
        )}
        {activeTab === "settings" && isMaster && <LlmSettingsTab />}

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
            onEditUser={handleEditUser}
            onDeleteUser={handleDeleteUser}
          />
        )}

        {activeTab === "buildings" && (
          <BuildingsTab
            buildings={getBuildingsList()}
            buildingDocuments={buildingDocuments}
            loading={loading}
            isMaster={isMaster}
            onViewDetails={handleViewBuildingDetails}
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

        {/* UPDATED: Minutes templates now per building, via buildings + loading */}
        {activeTab === "minutes" && (
          <MinutesTemplatesTab buildings={getBuildingsList()} loading={loading} />
        )}

        {activeTab === "agenda" && (
          <AgendaTemplatesTab buildings={getBuildingsList()} loading={loading} />
        )}
      </div>

      <CreateUserModal
        isOpen={showCreateUserModal}
        onClose={() => setShowCreateUserModal(false)}
        onSuccess={handleCreateUserSuccess}
        currentUser={currentUser}
        propertyManagers={propertyManagers}
        buildings={getBuildingsList()}
        companies={companies}
      />

      {showEditUserModal && editingUserId && (
        <CreateUserModal
          isOpen={showEditUserModal}
          onClose={() => {
            setShowEditUserModal(false)
            setEditingUserId(null)
          }}
          onSuccess={() => {
            setShowEditUserModal(false)
            setEditingUserId(null)
            handleCreateUserSuccess()
          }}
          currentUser={currentUser}
          propertyManagers={propertyManagers}
          buildings={getBuildingsList()}
          companies={companies}
          userId={editingUserId}
        />
      )}

      <CreateBuildingModal
        isOpen={showCreateBuildingModal}
        onClose={() => setShowCreateBuildingModal(false)}
        onSuccess={handleCreateBuildingSuccess}
        currentUser={currentUser}
        availableUsers={getAvailableUsers()}
      />

      <BuildingDetailsModal
        isOpen={showBuildingDetailsModal}
        onClose={() => {
          setShowBuildingDetailsModal(false)
          setSelectedBuilding(null)
        }}
        onSuccess={handleBuildingDetailsSuccess}
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
