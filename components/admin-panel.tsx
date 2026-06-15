"use client"

import { useState, useEffect, useMemo } from "react"
import { ArrowLeft, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getCurrentUser, Company } from "@/lib/supabase"
import { supabase } from "@/lib/supabase"
import { canManageCompanies, canViewCompanies, canManageBuildings, shouldFilterByCompany, isMaster as checkIsMaster, isCorporateAdmin as checkIsCorporateAdmin, isPropertyManager as checkIsPropertyManager } from "@/lib/permissions"
import { triggerJanusResync } from "@/lib/janus-client"
import { 
  fetchBuildingsAction, 
  deleteBuildingAction, 
  archiveBuildingAction, 
  unarchiveBuildingAction 
} from "@/lib/api-actions"

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
import VotingTab from "./admin/VotingTab"


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
  company_name?: string | null
  buildings?: string[] // This can now be "Building Name (Unit #)"
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
  logo_url?: string | null
  is_archived: boolean
  archived_at?: string | null
  archived_by?: string | null
  archive_reason?: string | null
  companies?: { logo_url: string | null } | null
  users?: Array<{ id: number; name: string; email: string; user_type: string; unit_number?: string | null }>
  company?: { id: number; name: string } | null
  board_meeting_notice_days?: number | null
  general_meeting_notice_days?: number | null
  notification_recipient_type?: string | null
  timezone?: string | null
}

type TabType = "users" | "buildings" | "companies" | "minutes" | "agenda" | "voting" | "audit" | "settings" | "archive"

export default function AdminPanel({ onBack }: AdminPanelProps) {
  const [activeTab, setActiveTab] = useState<TabType>("users")
  const [users, setUsers] = useState<UserRow[]>([])
  const [propertyManagers, setPropertyManagers] = useState<PropertyManager[]>([])
  const [filteredUsers, setFilteredUsers] = useState<UserRow[]>([])
  const [buildings, setBuildings] = useState<Building[]>([])
  const [archivedBuildings, setArchivedBuildings] = useState<Building[]>([])
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
  const [masterViewCompanyId, setMasterViewCompanyId] = useState<number | null>(null)

  const rawCurrentUser = getCurrentUser()
  // Stabilize the reference so downstream useEffects don't re-fire on every render
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const currentUser = useMemo(() => rawCurrentUser, [rawCurrentUser?.id, rawCurrentUser?.user_type])

  // Document Management States
  const [buildingDocuments, setBuildingDocuments] = useState<Record<number, boolean>>({})
  const [showDocumentModal, setShowDocumentModal] = useState(false)
  const [documentFormUrl, setDocumentFormUrl] = useState("")
  const [showViewDocumentModal, setShowViewDocumentModal] = useState(false)
  const [viewingDocument, setViewingDocument] = useState<{
    building: Building
    content: string
  } | null>(null)

  // Context for creating a building from other modals (e.g. CreateUserModal)
  const [buildingCreationContext, setBuildingCreationContext] = useState<{
    managerId?: number
    companyId?: number
  } | null>(null)

  // Filters
  const [filterUserType, setFilterUserType] = useState<string>("all")
  const [filterBuilding, setFilterBuilding] = useState<string>("all")

  const [dbUser, setDbUser] = useState<any>(null)
  const [isIdentityLoaded, setIsIdentityLoaded] = useState(false)
  const [deleteConfirmBuilding, setDeleteConfirmBuilding] = useState<Building | null>(null)

  const isMaster = checkIsMaster(dbUser || currentUser)
  const isCorporateAdmin = checkIsCorporateAdmin(dbUser || currentUser)
  const isPropManager = checkIsPropertyManager(dbUser || currentUser)
  const canCreateUser =
    isMaster || isPropManager || isCorporateAdmin
  const canCreateBuilding =
    isMaster || isCorporateAdmin
  const userCanManageCompanies = canManageCompanies(dbUser || currentUser)
  const userCanViewCompanies = canViewCompanies(dbUser || currentUser)
  const userCanManageBuildings = canManageBuildings(dbUser || currentUser)
  const userShouldFilterByCompany = shouldFilterByCompany(dbUser || currentUser)

  // Helper: fetch from API with auth key
  const apiFetch = async (url: string) => {
    const apiKey = process.env.NEXT_PUBLIC_API_KEY || 'meeting-genius-secret-key-2026'
    const res = await fetch(url, { headers: { 'x-api-key': apiKey } })
    if (!res.ok) throw new Error(`API ${url} failed: ${res.status}`)
    return res.json()
  }

  // 1. REFRESH IDENTITY FROM DB
  useEffect(() => {
    const refreshIdentity = async () => {
      if (!currentUser?.id) return
      
      try {
        const json = await apiFetch(`/api/v1/users?id=${currentUser.id}`)
        const data = json.data?.[0] || null
        if (data) setDbUser(data)
      } catch (err) {
        console.error("Identity refresh error:", err)
      } finally {
        setIsIdentityLoaded(true)
      }
    }
    
    refreshIdentity()
  }, [])

  // 2. TRIGGER FETCHES ONLY AFTER IDENTITY IS LOADED
  useEffect(() => {
    if (!isIdentityLoaded) return

    fetchCompanies()
    fetchPropertyManagers()
    fetchUsers()
    fetchBuildings()
  }, [isIdentityLoaded, dbUser?.company_id])

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

      // 🔄 Notify Janus for real-time sync
      triggerJanusResync('user_deleted')

      await fetchUsers()
    } catch (err) {
      console.error("Unexpected error deleting user:", err)
      alert("Failed to delete user")
    }
  }

  const fetchCompanies = async () => {
    try {
      const activeUser = dbUser || currentUser
      let url = '/api/v1/companies'

      if (!isMaster) {
        if (activeUser?.company_id) {
          url += `?id=${activeUser.company_id}`
        } else {
          setCompanies([])
          setLoading(false)
          return
        }
      }

      const json = await apiFetch(url)
      setCompanies(json.data || [])
    } catch (err) {
      console.error("Error fetching companies:", err)
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

    const rulesEngineBase = process.env.NEXT_PUBLIC_RULESENGINE_URL || "https://rulesengine.asccreative.com"
    const updateFormId = process.env.NEXT_PUBLIC_DOC_UPDATE_FORM_ID || "8fe10f3e-bbb7-4ef0-8911-d43c27ad8666"
    const createFormId = process.env.NEXT_PUBLIC_DOC_CREATE_FORM_ID || "6a4fe687-c1f7-43ea-b6e3-687e5e9a47fa"

    const formUrl = hasDocuments
      ? `${rulesEngineBase}/form/${updateFormId}?Building Id=${building.id}&Building Name=${encodeURIComponent(building.name)}`
      : `${rulesEngineBase}/form/${createFormId}?Building Id=${building.id}&Building Name=${encodeURIComponent(building.name)}`

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
      let url = '/api/v1/users?user_type=property_manager'

      if (!isMaster && currentUser?.company_id) {
        url += `&company_id=${currentUser.company_id}`
      }

      const json = await apiFetch(url)
      setPropertyManagers(json.data || [])
    } catch (err) {
      console.error("Error fetching property managers:", err)
    }
  }

  const fetchUsers = async () => {
    try {
      setLoading(true)

      const activeUser = dbUser || currentUser
      let url = '/api/v1/users?include_buildings=true'

      if (isMaster) {
        // Master sees all — no filter
      } else if (isCorporateAdmin) {
        if (activeUser?.company_id) {
          url += `&company_id=${activeUser.company_id}`
        } else {
          setUsers([])
          setLoading(false)
          return
        }
      } else if (isPropManager) {
        if (activeUser?.company_id) {
          url += `&company_id=${activeUser.company_id}&include_null_company=true`
        } else {
          setUsers([])
          setLoading(false)
          return
        }
      }

      const json = await apiFetch(url)
      const usersData = json.data || []
      const userBuildingsData = json.userBuildings || []

      const usersWithBuildings = usersData.map((user: any) => {
        const userJunctions = userBuildingsData.filter((ub: any) => ub.user_id === user.id)
        
        const userBuildings = userJunctions
          .map((ub: any) => ub.unit_number ? `${ub.buildings?.name} (${ub.unit_number})` : ub.buildings?.name)
          .filter(Boolean) as string[]

        const isUserInManagedBuilding = userJunctions.some((ub: any) => ub.buildings?.manager_id === currentUser?.id)

        return {
          ...user,
          buildings: userBuildings,
          isUserInManagedBuilding,
          buildingIds: userJunctions.map((ub: any) => ub.building_id),
          company_name: user.companies?.name || null
        }
      })

      const myBuildingIds = userBuildingsData
        .filter((ub: any) => ub.user_id === currentUser?.id)
        .map((ub: any) => ub.building_id)

      if (isMaster || isCorporateAdmin) {
        setUsers(usersWithBuildings)
      } else if (isPropManager) {
        const filteredUsers = usersWithBuildings.filter(
          (user: any) => 
            user.assigned_pm_id === currentUser?.id || 
            user.id === currentUser?.id || 
            user.isUserInManagedBuilding ||
            user.buildingIds.some((id: number) => myBuildingIds.includes(id))
        )
        setUsers(filteredUsers)
      } else {
        const filteredUsers = usersWithBuildings.filter((user: any) => {
          if (user.id === currentUser?.id) return true
          return user.buildingIds.some((id: number) => myBuildingIds.includes(id))
        })
        setUsers(filteredUsers)
      }
    } catch (err) {
      console.error("Error fetching users:", err)
    } finally {
      setLoading(false)
    }
  }

  const fetchBuildings = async () => {
    try {
      const activeUser = dbUser || currentUser
      const userIsMaster = checkIsMaster(activeUser)
      const userIsCorporateAdmin = checkIsCorporateAdmin(activeUser)
      const userIsPropManager = checkIsPropertyManager(activeUser)

      let buildingsData: any[] = []
      
      if (userIsMaster) {
        buildingsData = await fetchBuildingsAction()
      } else if (userIsCorporateAdmin) {
        buildingsData = await fetchBuildingsAction({ company_id: activeUser.company_id! })
      } else {
        // PM or User role: fetch buildings they are explicitly assigned to or manage
        const { data: myBuildings } = await supabase.from("user_buildings").select("building_id").eq("user_id", activeUser.id)
        const myIds = myBuildings?.map(b => b.building_id) || []
        
        // Fetch buildings they manage + buildings they are assigned to
        const managedBuildings = await fetchBuildingsAction({ manager_id: activeUser.id })
        const assignedBuildings = myIds.length > 0 ? await fetchBuildingsAction({ building_ids: myIds }) : []
        
        // Merge and deduplicate
        const combined = [...(managedBuildings || []), ...(assignedBuildings || [])]
        const seen = new Set()
        buildingsData = combined.filter(b => {
          if (seen.has(b.id)) return false
          seen.add(b.id)
          return true
        })
      }
      
      // 2. Fetch Archived Buildings (Only for Master and Corp Admin)
      let archivedData: any[] = []
      if (userIsMaster || userIsCorporateAdmin) {
        const archivedBuildingsData = await fetchBuildingsAction({
          archived: true,
          ...(!userIsMaster && activeUser?.company_id ? { company_id: activeUser.company_id } : {})
        })
        archivedData = archivedBuildingsData || []
      }

      // 3. Fetch User Associations for all buildings
      const allBuildingIds = [...new Set([...(buildingsData?.map(b => b.id) || []), ...archivedData.map(b => b.id)])]
      
      if (allBuildingIds.length === 0) {
        setBuildings([])
        setArchivedBuildings([])
        return
      }

      let ubQueryBuildings = supabase
        .from("user_buildings")
        .select(`
          building_id,
          unit_number,
          users(id, name, email, user_type, roles, company_id)
        `)
        .in("building_id", allBuildingIds)

      // NOTE: Do NOT filter by users.company_id here — attendee-only users
      // legitimately have a null company_id and must remain visible in building
      // assignment lists. Company scoping is already applied on the buildings
      // query above, so only buildings belonging to the current company are in
      // allBuildingIds. Filtering further by user.company_id silently drops any
      // user (e.g. attendees) whose company_id is null.

      const { data: userBuildingsData } = await ubQueryBuildings

      const processBuildings = (data: any[]) => {
        // Deduplicate by id first (OR queries can return the same building multiple times)
        const seen = new Set<number>()
        const unique = data.filter(b => {
          if (seen.has(b.id)) {
            console.warn(`[admin-panel] Duplicate building found: ${b.id} "${b.name}"`)
            return false
          }
          seen.add(b.id)
          return true
        })
        console.log(`[admin-panel] processBuildings: ${data.length} raw → ${unique.length} unique`)
        return unique.map((building) => {
          const buildingUsers = (userBuildingsData || [])
            .filter((ub: any) => ub.building_id === building.id)
            .map((ub: any) => ({
              ...ub.users,
              unit_number: ub.unit_number
            }))
            .filter(Boolean)

          return {
            ...building,
            users: buildingUsers,
          }
        })
      }

      setBuildings(processBuildings(buildingsData || []))
      setArchivedBuildings(processBuildings(archivedData))
    } catch (err) {
      console.error("Unexpected error in fetchBuildings:", err)
    }
  }

  const applyFilters = () => {
    let filtered = [...users]

    if (filterUserType !== "all") {
      filtered = filtered.filter(
        (user) =>
          user.user_type === filterUserType ||
          (Array.isArray(user.roles) && user.roles.includes(filterUserType)),
      )
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
    triggerJanusResync('user_created')
  }

  const handleCreateBuildingSuccess = () => {
    setShowCreateBuildingModal(false)
    setBuildingCreationContext(null)
    fetchBuildings()
    fetchUsers()
    triggerJanusResync('building_created')
  }

  const handleBuildingDetailsSuccess = () => {
    setSelectedBuilding(null)
    fetchBuildings()
    fetchUsers()
    triggerJanusResync('building_updated')
  }

  const handleDeleteBuilding = async (building: Building) => {
    setDeleteConfirmBuilding(building)
  }

  const confirmDeleteBuilding = async () => {
    const building = deleteConfirmBuilding
    if (!building) return
    setDeleteConfirmBuilding(null)
    try {
      await deleteBuildingAction(building.id)
      fetchBuildings()
      fetchUsers()
      triggerJanusResync('building_deleted')
    } catch (err: any) {
      console.error('Error deleting building:', err)
      alert(err.message || 'Failed to delete building')
    }
  }
  const handleArchiveBuilding = async (building: Building) => {
    if (!confirm(`Archive "${building.name}"? It will be removed from active lists and can be restored from Archive Storage.`)) return
    try {
      await archiveBuildingAction(
        building.id,
        (dbUser || currentUser)?.name || (dbUser || currentUser)?.email || null,
        'Archived from admin panel'
      )
      fetchBuildings()
      triggerJanusResync('building_archived')
    } catch (err: any) {
      console.error('Error archiving building:', err)
      alert(err.message || 'Failed to archive building')
    }
  }

  const handleUnarchiveBuilding = async (building: Building) => {
    if (!confirm(`Restore "${building.name}" to active use?`)) return
    try {
      await unarchiveBuildingAction(building.id)
      fetchBuildings()
      triggerJanusResync('building_restored')
    } catch (err: any) {
      console.error('Error restoring building:', err)
      alert(err.message || 'Failed to restore building')
    }
  }

  const handleCreateCompanySuccess = () => {
    fetchCompanies()
    fetchPropertyManagers()
    fetchUsers()
    fetchBuildings()
    triggerJanusResync('company_created')
  }

  const handleEditCompanySuccess = () => {
    fetchCompanies()
    setSelectedCompany(null)
    triggerJanusResync('company_updated')
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

      // 🔄 Notify Janus for real-time sync
      triggerJanusResync('company_deleted')

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
    setMasterViewCompanyId(company.id)
    setShowEditCompanyModal(true)
  }

  const handleViewCompanyDetails = (company: Company) => {
    setSelectedCompany(company)
    setMasterViewCompanyId(company.id)
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
          u.assigned_pm_id === currentUser?.id || u.id === currentUser?.id
      )
      return filtered
    }

    return users
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted">
      <header className="border-b border-border bg-card shadow-sm sticky top-0 z-40">
        <div className="mx-auto max-w-7xl px-3 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 sm:gap-4 min-w-0">
              <Button
                variant="ghost"
                size="icon"
                onClick={onBack}
                className="hover:bg-muted flex-shrink-0"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="min-w-0">
                <h1 className="text-base sm:text-xl font-bold text-foreground truncate">Admin Panel</h1>
                <p className="hidden sm:block text-xs sm:text-sm text-muted-foreground">
                  Manage users, buildings, companies, minutes and agenda templates
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {activeTab === "users" && canCreateUser && (
                <Button
                  onClick={() => setShowCreateUserModal(true)}
                  size="sm"
                  className="bg-gradient-to-r from-primary to-decision-purple text-primary-foreground text-xs px-2 sm:px-4 h-8 sm:h-9"
                >
                  <Plus className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Create User</span>
                </Button>
              )}
              {activeTab === "buildings" && canCreateBuilding && (
                <Button
                  onClick={() => setShowCreateBuildingModal(true)}
                  size="sm"
                  className="bg-gradient-to-r from-primary to-decision-purple text-primary-foreground text-xs px-2 sm:px-4 h-8 sm:h-9"
                >
                  <Plus className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Create Building</span>
                </Button>
              )}
              {activeTab === "companies" && userCanManageCompanies && (
                <Button
                  onClick={() => setShowCreateCompanyModal(true)}
                  size="sm"
                  className="bg-gradient-to-r from-primary to-decision-purple text-primary-foreground text-xs px-2 sm:px-4 h-8 sm:h-9"
                >
                  <Plus className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Create Company</span>
                </Button>
              )}
            </div>
          </div>

          {/* ── Row 1: Core Navigation ── */}
          <div className="flex gap-4 mt-4 overflow-x-auto scrollbar-hide pb-1">
            <button
              onClick={() => setActiveTab("users")}
              className={`pb-2 px-1 font-medium text-xs sm:text-sm transition-colors whitespace-nowrap flex-shrink-0 ${activeTab === "users"
                  ? "text-primary border-b-2 border-primary"
                  : "text-muted-foreground hover:text-foreground"
                }`}
            >
              👥 Users
            </button>
            <button
              onClick={() => setActiveTab("buildings")}
              className={`pb-2 px-1 font-medium text-xs sm:text-sm transition-colors whitespace-nowrap flex-shrink-0 ${activeTab === "buildings"
                  ? "text-primary border-b-2 border-primary"
                  : "text-muted-foreground hover:text-foreground"
                }`}
            >
              🏢 Buildings
            </button>
            {userCanViewCompanies && (
              <button
                onClick={() => setActiveTab("companies")}
                className={`pb-2 px-1 font-medium text-xs sm:text-sm transition-colors whitespace-nowrap flex-shrink-0 ${activeTab === "companies"
                    ? "text-primary border-b-2 border-primary"
                    : "text-muted-foreground hover:text-foreground"
                  }`}
              >
                🏛️ Companies
              </button>
            )}
            <button
              onClick={() => setActiveTab("minutes")}
              className={`pb-2 px-1 font-medium text-xs sm:text-sm transition-colors whitespace-nowrap flex-shrink-0 ${activeTab === "minutes"
                  ? "text-primary border-b-2 border-primary"
                  : "text-muted-foreground hover:text-foreground"
                }`}
            >
              📄 Minutes
            </button>
            <button
              onClick={() => setActiveTab("agenda")}
              className={`pb-2 px-1 font-medium text-xs sm:text-sm transition-colors whitespace-nowrap flex-shrink-0 ${activeTab === "agenda"
                  ? "text-primary border-b-2 border-primary"
                  : "text-muted-foreground hover:text-foreground"
                }`}
            >
              📋 Agenda
            </button>
            {(isMaster || isCorporateAdmin) && (
              <button
                onClick={() => setActiveTab("archive")}
                className={`pb-2 px-1 font-medium text-xs sm:text-sm transition-colors whitespace-nowrap flex-shrink-0 ${activeTab === "archive"
                    ? "text-primary border-b-2 border-primary"
                    : "text-muted-foreground hover:text-foreground"
                  }`}
              >
                🗄️ Archive
              </button>
            )}
            <button
              onClick={() => setActiveTab("voting")}
              className={`pb-2 px-1 font-medium text-xs sm:text-sm transition-colors whitespace-nowrap flex-shrink-0 ${activeTab === "voting"
                  ? "text-primary border-b-2 border-primary"
                  : "text-muted-foreground hover:text-foreground"
                }`}
            >
              ⚖️ Voting
            </button>
            {(isMaster || isCorporateAdmin) && (
              <button
                onClick={() => setActiveTab("audit")}
                className={`pb-2 px-1 font-medium text-xs sm:text-sm transition-colors whitespace-nowrap flex-shrink-0 ${activeTab === "audit"
                    ? "text-primary border-b-2 border-primary"
                    : "text-muted-foreground hover:text-foreground"
                  }`}
              >
                🔍 Audit Logs
              </button>
            )}
            {isMaster && (
              <button
                onClick={() => setActiveTab("settings")}
                className={`pb-2 px-1 font-medium text-xs sm:text-sm transition-colors whitespace-nowrap flex-shrink-0 ${activeTab === "settings"
                    ? "text-primary border-b-2 border-primary"
                    : "text-muted-foreground hover:text-foreground"
                  }`}
              >
                ⚙️ AI Settings
              </button>
            )}
          </div>

          {/* ── Row 2: removed — Audit Logs and AI Settings moved to Row 1 ── */}
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
            isPropManager={isPropManager}
            isCorporateAdmin={isCorporateAdmin}
            currentUser={dbUser || currentUser}
            onFilterUserTypeChange={setFilterUserType}
            onFilterBuildingChange={setFilterBuilding}
            onEditUser={handleEditUser}
            onDeleteUser={handleDeleteUser}
            onCreateBuilding={() => setShowCreateBuildingModal(true)}
          />
        )}

        {activeTab === "buildings" && (
          <BuildingsTab
            buildings={buildings}
            buildingDocuments={buildingDocuments}
            loading={loading}
            isMaster={isMaster}
            onViewDetails={handleViewBuildingDetails}
            onViewDocument={handleViewDocument}
            onManageDocuments={handleManageDocuments}
            onDeleteBuilding={undefined} // No delete from active list
            onArchiveBuilding={handleArchiveBuilding}
            onUnarchiveBuilding={handleUnarchiveBuilding}
            currentUser={currentUser}
            canManage={userCanManageBuildings}
            mode="active"
          />
        )}

        {activeTab === "archive" && (isMaster || isCorporateAdmin) && (
          <BuildingsTab
            buildings={archivedBuildings}
            buildingDocuments={buildingDocuments}
            loading={loading}
            isMaster={isMaster}
            onViewDetails={handleViewBuildingDetails}
            onViewDocument={handleViewDocument}
            onManageDocuments={handleManageDocuments}
            onDeleteBuilding={isMaster ? handleDeleteBuilding : undefined} // Delete allowed for master in archive
            onArchiveBuilding={handleArchiveBuilding}
            onUnarchiveBuilding={handleUnarchiveBuilding}
            currentUser={currentUser}
            canManage={true}
            mode="archive"
          />
        )}

        {activeTab === "companies" && userCanViewCompanies && (
          <CompaniesTab
            companies={companies}
            loading={loading}
            onEdit={handleEditCompany}
            onDelete={handleDeleteCompany}
            onViewDetails={handleViewCompanyDetails}
            onAssignUsers={handleAssignUsers}
            onRefresh={fetchCompanies}
            canManage={userCanManageCompanies}
          />
        )}

        {/* UPDATED: Minutes templates now per building, via buildings + loading */}
        {activeTab === "minutes" && (
          <MinutesTemplatesTab buildings={getBuildingsList()} loading={loading} />
        )}

        {activeTab === "agenda" && (
          <AgendaTemplatesTab buildings={getBuildingsList()} loading={loading} />
        )}

        {activeTab === "voting" && (
          <VotingTab initialCompanyId={masterViewCompanyId} />
        )}

      </div>

      <CreateUserModal
        isOpen={showCreateUserModal}
        onClose={() => setShowCreateUserModal(false)}
        onSuccess={handleCreateUserSuccess}
        currentUser={dbUser || currentUser}
        propertyManagers={propertyManagers}
        buildings={getBuildingsList()}
        onCreateBuilding={(managerId, companyId) => {
          setBuildingCreationContext({ managerId, companyId })
          setShowCreateBuildingModal(true)
        }}
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
          currentUser={dbUser || currentUser}
          propertyManagers={propertyManagers}
          buildings={getBuildingsList()}
          onCreateBuilding={(managerId, companyId) => {
            setBuildingCreationContext({ managerId, companyId })
            setShowCreateBuildingModal(true)
          }}
          companies={companies}
          userId={editingUserId}
        />
      )}

      <CreateBuildingModal
        isOpen={showCreateBuildingModal}
        onClose={() => {
          setShowCreateBuildingModal(false)
          setBuildingCreationContext(null)
        }}
        onSuccess={handleCreateBuildingSuccess}
        currentUser={dbUser || currentUser}
        availableUsers={getAvailableUsers()}
        preselectedManagerId={buildingCreationContext?.managerId}
        preselectedCompanyId={buildingCreationContext?.companyId}
        existingBuildings={buildings}
        archivedBuildings={archivedBuildings}
      />

      <BuildingDetailsModal
        isOpen={showBuildingDetailsModal}
        onClose={() => {
          setShowBuildingDetailsModal(false)
          setSelectedBuilding(null)
        }}
        onSuccess={handleBuildingDetailsSuccess}
        building={selectedBuilding}
        currentUser={dbUser || currentUser}
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
        onBuildingsChanged={fetchBuildings}
        onUsersChanged={fetchUsers}
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

      {deleteConfirmBuilding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setDeleteConfirmBuilding(null)} />
          <div className="relative bg-popover border border-border rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6 z-10">
            <h3 className="text-base font-semibold text-foreground mb-3">
              Permanently delete &ldquo;{deleteConfirmBuilding.name}&rdquo;?
            </h3>
            <p className="text-sm text-muted-foreground mb-6">
              This will erase all meetings, topics, documents, and transcripts associated with this building. This action is irreversible.
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setDeleteConfirmBuilding(null)}>
                Cancel
              </Button>
              <Button
                className="bg-red-600 hover:bg-red-700 text-white"
                onClick={confirmDeleteBuilding}
              >
                OK
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )

}
