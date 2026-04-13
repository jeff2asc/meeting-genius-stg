"use client"

import { useState, useEffect } from "react"
import { 
  Plus, 
  ExternalLink, 
  CheckCircle2, 
  Settings, 
  Cloud, 
  Zap, 
  ArrowRight,
  ShieldCheck,
  Building2,
  Users,
  Briefcase,
  ArrowLeft,
  Trash2,
  Search,
  Home as HomeIcon
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import { supabase, getCurrentUser } from "@/lib/supabase"
import { canAccessIntegrations, isMaster as checkIsMaster, isCorporateAdmin as checkIsCorporateAdmin, isPropertyManager as checkIsPropertyManager } from "@/lib/permissions"
import { toast } from "sonner"

interface Integration {
  id: string
  name: string
  description: string
  logo: string
  website: string
  installed: boolean
}

export default function IntegrationsPage({ onBack }: { onBack: () => void }) {
  const user = getCurrentUser()
  
  if (!user || !canAccessIntegrations(user)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4">
        <ShieldCheck className="h-12 w-12 text-muted-foreground opacity-20" />
        <h2 className="text-xl font-bold">Access Restricted</h2>
        <p className="text-muted-foreground">Only Corporate Administrators can manage integrations.</p>
        <Button onClick={onBack} variant="outline">Go Back</Button>
      </div>
    )
  }

  const [integrations, setIntegrations] = useState<Integration[]>([
    {
      id: "janus",
      name: "Janus",
      description: "AI-powered property management automation for email triage and ticketing.",
      logo: "https://api.dicebear.com/7.x/initials/svg?seed=JA&backgroundColor=6366f1",
      website: "https://janus.asccreative.com",
      installed: false
    },
    {
      id: "jobber",
      name: "Jobber",
      description: "Organize your business/home service and impress your clients.",
      logo: "https://api.dicebear.com/7.x/initials/svg?seed=JO&backgroundColor=10b981",
      website: "https://getjobber.com",
      installed: false
    },
    {
      id: "zoom",
      name: "Zoom",
      description: "Video conferencing for board meetings and virtual walk-throughs.",
      logo: "https://api.dicebear.com/7.x/initials/svg?seed=ZO&backgroundColor=3b82f6",
      website: "https://zoom.us",
      installed: false
    }
  ])

  const [isJanusModalOpen, setIsJanusModalOpen] = useState(false)
  const [isLoadingData, setIsLoadingData] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncStep, setSyncStep] = useState(0) // 0=idle, 1=fetching, 2=pushing, 3=done
  const [syncLog, setSyncLog] = useState<string[]>([])
  const [mgSummary, setMgSummary] = useState({
    companies: 0,
    buildings: 0,
    users: 0,
    vendors: 0
  })

  // Configuration States
  const [configStep, setConfigStep] = useState<"prepare" | "configure" | "syncing">("prepare")
  const [availableData, setAvailableData] = useState<{
    companies: any[],
    buildings: any[],
    users: any[],
    vendors: any[],
    junctions: any[]
  }>({ companies: [], buildings: [], users: [], vendors: [], junctions: [] })
  
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("all")
  const [selectedBuildingIds, setSelectedBuildingIds] = useState<number[]>([])
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([])
  const [userUnits, setUserUnits] = useState<Record<number, string>>({})

  useEffect(() => {
    // Check local storage for installed integrations for demo purposes
    // NEW: Scope this to the current user ID
    const user = getCurrentUser()
    if (!user) return

    const storageKey = `mg_integrations_${user.id}`
    const installed = typeof window !== 'undefined' ? localStorage.getItem(storageKey) : null
    if (installed) {
      const installedIds = JSON.parse(installed)
      setIntegrations(prev => prev.map(int => ({
        ...int,
        installed: installedIds.includes(int.id)
      })))
    }
  }, [])

  const fetchMgDataSummary = async () => {
    setIsLoadingData(true)
    try {
      const user = getCurrentUser()
      if (!user) return

      // Summary counts from tables
      const { count: companyCount } = await supabase
        .from("companies")
        .select("*", { count: "exact", head: true })

      const { count: buildingCount } = await supabase
        .from("buildings")
        .select("*", { count: "exact", head: true })

      const { count: userCount } = await supabase
        .from("users")
        .select("*", { count: "exact", head: true })
        .neq("user_type", "vendor" as any)

      const { count: vendorCount } = await supabase
        .from("users")
        .select("*", { count: "exact", head: true })
        .eq("user_type", "vendor" as any)

      setMgSummary({
        companies: companyCount || 0,
        buildings: buildingCount || 0,
        users: userCount || 0,
        vendors: vendorCount || 0
      })
    } catch (error) {
      console.error("Error fetching MG data summary:", error)
    } finally {
      setIsLoadingData(false)
    }
  }

  const handleInstallJanus = async () => {
    setIsJanusModalOpen(true)
    setConfigStep("prepare")
    setIsLoadingData(true)
    
    // Fetch everything needed for configuration
    try {
      const documentedSecret = "meeting-genius-secret-key-2026"
      const res = await fetch(`${window.location.origin}/api/janus/v1/sync`, {
        headers: { "x-api-key": documentedSecret }
      })
      if (!res.ok) throw new Error("Could not fetch MG data")
      
      const payload = await res.json()
      const data = payload.data
      
      const user = getCurrentUser()
      const isMaster = checkIsMaster(user)
      const isCorpAdmin = checkIsCorporateAdmin(user)
      
      // Filter available data based on role permissions
      let companies = data.companies || []
      let buildings = data.buildings || []
      let users = data.users || []
      let vendors = data.vendors || []
      let junctions = data.user_buildings || []

      // 1. Cross-Company Filtering (Master vs others)
      if (!isMaster) {
        if (user?.company_id) {
          companies = companies.filter((c: any) => c.id === user.company_id)
          buildings = buildings.filter((b: any) => b.company_id === user.company_id)
          users = users.filter((u: any) => u.company_id === user.company_id)
          vendors = vendors.filter((v: any) => v.company_id === user.company_id)
          junctions = junctions.filter((j: any) => {
            const b = buildings.find((b: any) => b.id === j.building_id)
            return !!b
          })
        } else {
          // No company ID and not master? Minimal access.
          companies = []
          buildings = []
          users = users.filter((u: any) => u.id === user?.id)
          vendors = []
        }
      }

      // 2. Intra-Company Filtering (Admin vs PM vs Resident)
      if (!isMaster && !isCorpAdmin) {
        if (checkIsPropertyManager(user)) {
          // PMs see buildings they manage OR buildings they are assigned to
          buildings = buildings.filter((b: any) => b.manager_id === user?.id)
          const buildingIds = buildings.map((b: any) => b.id)
          
          const allowedUserIds = junctions
            .filter((j: any) => buildingIds.includes(j.building_id))
            .map((j: any) => j.user_id)
          
          users = users.filter((u: any) => allowedUserIds.includes(u.id) || u.id === user?.id)
        } 
        else {
          // Check for regular user/owner via user_type since we don't have helpers for those yet or just check directly
          const isRegularUser = user?.user_type === "user" || user?.user_type === "owner" || (user?.roles || []).includes("user") || (user?.roles || []).includes("owner")
          
          if (isRegularUser) {
            const userBuildingIds = junctions.filter((j: any) => j.user_id === user?.id).map((j: any) => j.building_id)
            buildings = buildings.filter((b: any) => userBuildingIds.includes(b.id))
            users = users.filter((u: any) => u.id === user?.id)
            vendors = []
          }
        }
      }
      
      setAvailableData({
        companies,
        buildings,
        users,
        vendors,
        junctions
      })

      setMgSummary({
        companies: companies.length,
        buildings: buildings.length,
        users: users.length,
        vendors: vendors.length
      })

      // Default selections (all visible items for limited roles)
      setSelectedBuildingIds(buildings.map((b: any) => b.id))
      setSelectedUserIds([...users, ...vendors].map((u: any) => u.id))
      
      // Select the first company by default if "all" isn't allowed or preferred
      if (companies.length > 0) {
        setSelectedCompanyId(companies[0].id.toString())
      }
      
      setConfigStep("configure")

    } catch (err) {
      console.error("Config fetch error:", err)
      toast.error("Failed to load connection data")
    } finally {
      setIsLoadingData(false)
    }
  }

  const confirmJanusIntegration = async () => {
    setIsSyncing(true)
    setConfigStep("syncing")
    setSyncStep(1)
    setSyncLog(["⏳ Filtering data based on your selections..."])
    
    // Universal URL Logic: Detect if we are running locally or on a server
    const isLocal = typeof window !== 'undefined' && window.location.hostname === 'localhost';
    const JANUS_SYNC_URL = isLocal 
      ? "http://localhost:3001/api/janus/v1/sync"
      : (process.env.NEXT_PUBLIC_JANUS_URL || "https://janusapp.meetinggenius.ca/api/janus/v1/sync");

    const API_KEY = "meeting-genius-secret-key-2026"

    try {
      // 1. Filter selection
      const filteredCompanies = selectedCompanyId === "all" 
        ? availableData.companies 
        : availableData.companies.filter(c => c.id.toString() === selectedCompanyId)
      
      const filteredBuildings = availableData.buildings.filter(b => selectedBuildingIds.includes(b.id))
      const allUsers = [...availableData.users, ...availableData.vendors]
      const filteredUsers = allUsers.filter(u => selectedUserIds.includes(u.id))
      const filteredJunctions = availableData.junctions.filter(j => 
        selectedBuildingIds.includes(j.building_id) && selectedUserIds.includes(j.user_id)
      )

      setSyncLog(prev => [
        ...prev,
        `✅ Filtered to ${filteredCompanies.length} companies`,
        `✅ Filtered to ${filteredBuildings.length} buildings`,
        `✅ Filtered to ${filteredUsers.length} users`,
        ``,
        `⏳ Preparing payload for Janus...`
      ])
      setSyncStep(2)

      // Step 2: Merge user_buildings into each user for Janus direct mapping
      const userBuildingsMap: Record<number, number> = {}
      for (const ub of filteredJunctions) {
        userBuildingsMap[ub.user_id] = ub.building_id
      }

      const enrichedUsers = filteredUsers.map((u: any) => ({
        ...u,
        building_id: userBuildingsMap[u.id] || u.building_id || null,
        role: u.user_type || u.role || "resident",
        user_type: u.user_type || "resident",
        suite_number: userUnits[u.id] || u.suite_number || ""
      }))

      const payload = {
        companies: filteredCompanies,
        buildings: filteredBuildings,
        users: enrichedUsers,
        user_buildings: filteredJunctions
      }

      setSyncLog(prev => [
        ...prev,
        `→ Sending selected data to Janus (${isLocal ? 'Local' : 'Production'})...`,
      ])

      // Step 3: Push to Janus
      const janusRes = await fetch(JANUS_SYNC_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": API_KEY
        },
        body: JSON.stringify(payload)
      })

      const janusResult = await janusRes.json()

      if (janusResult?.summary) {
        const s = janusResult.summary
        setSyncLog(prev => [
          ...prev,
          ``,
          `✅ ${s.companies?.success ?? 0}/${s.companies?.found ?? 0} companies synced`,
          `✅ ${s.buildings?.success ?? 0}/${s.buildings?.found ?? 0} buildings synced`,
          `✅ ${s.users?.success ?? 0}/${s.users?.found ?? 0} users synced`,
        ])
        toast.success("Sync Complete!", {
          description: `Successfully synced ${s.buildings?.success || 0} buildings to Janus`
        })
      }
    } catch (error: any) {
      console.error("Janus sync error:", error)
      setSyncLog(prev => [...prev, `❌ Error: ${error.message}`])
      toast.warning("Sync attempted", {
        description: "Could not reach Janus. Integration saved locally — retry sync after Janus is running."
      })
    }

    // Always mark as installed locally per account
    const user = getCurrentUser()
    if (user) {
      const storageKey = `mg_integrations_${user.id}`
      const installed = JSON.parse(localStorage.getItem(storageKey) || "[]")
      if (!installed.includes("janus")) {
        installed.push("janus")
        localStorage.setItem(storageKey, JSON.stringify(installed))
        localStorage.setItem(`mg_janus_token_${user.id}`, API_KEY)
      }
    }
    
    setIntegrations(prev => prev.map(int => 
      int.id === "janus" ? { ...int, installed: true } : int
    ))

    setSyncStep(3) // Step 3: Done
    await new Promise(r => setTimeout(r, 1000)) // Show done briefly
    setIsJanusModalOpen(false)
    setIsLoadingData(false)
    setIsSyncing(false)
    setSyncStep(0)
  }

  const handleOpenJanus = () => {
    const user = getCurrentUser()
    const email = user?.email || ""
    const token = (typeof window !== 'undefined' ? localStorage.getItem(`mg_janus_token_${user?.id}`) : null) || "meeting-genius-secret-key-2026"
    
    // Auto-detect environment for the dashboard link
    const isLocal = typeof window !== 'undefined' && window.location.hostname === 'localhost';
    const JANUS_BASE_URL = isLocal 
      ? "http://localhost:3001" 
      : (process.env.NEXT_PUBLIC_JANUS_URL || "https://janusapp.meetinggenius.ca/api/janus/v1/sync").replace('/api/janus/v1/sync', '').replace(/\/$/, "");
      
    const autoLoginUrl = `${JANUS_BASE_URL}/login?email=${encodeURIComponent(email)}&bridge_token=${token}`
    
    window.open(autoLoginUrl, "_blank")
  }

  const handleUninstallJanus = () => {
    const user = getCurrentUser()
    if (!user) return

    const storageKey = `mg_integrations_${user.id}`
    const installed = JSON.parse(localStorage.getItem(storageKey) || "[]")
    const newInstalled = installed.filter((id: string) => id !== "janus")
    localStorage.setItem(storageKey, JSON.stringify(newInstalled))
    localStorage.removeItem(`mg_janus_token_${user.id}`)
    
    setIntegrations(prev => prev.map(int => 
      int.id === "janus" ? { ...int, installed: false } : int
    ))
    toast.info("Integration disconnected", {
      description: "You can now re-run the synchronization."
    })
  }

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onBack}
            className="mb-2 -ml-2 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Integrations</h1>
          <p className="text-muted-foreground mt-1">
            Connect Meeting Genius with your favorite tools to automate your workflows.
          </p>
        </div>
        <div className="hidden sm:flex items-center gap-2 px-4 py-2 bg-primary/5 rounded-lg border border-primary/20">
          <Zap className="h-5 w-5 text-primary" />
          <span className="text-sm font-medium text-primary">Automation Hub Live</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {integrations.map((int) => (
          <Card key={int.id} className="overflow-hidden border-border bg-card hover:shadow-lg transition-all duration-300">
            <CardHeader className="pb-4">
              <div className="flex justify-between items-start mb-4">
                <div className="h-14 w-14 rounded-2xl overflow-hidden shadow-sm border border-border">
                  <img src={int.logo} alt={int.name} className="h-full w-full object-cover" />
                </div>
                {int.installed && (
                  <Badge variant="secondary" className="bg-green-100 text-green-700 hover:bg-green-100 border-green-200">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Installed
                  </Badge>
                )}
              </div>
              <CardTitle className="text-xl">{int.name}</CardTitle>
              <CardDescription className="line-clamp-2 min-h-[3rem]">
                {int.description}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center">
                    <ShieldCheck className="h-4 w-4 mr-1 text-primary" />
                    Secure
                  </div>
                  <div className="flex items-center">
                    <Cloud className="h-4 w-4 mr-1 text-primary" />
                    Cloud Sync
                  </div>
                </div>

                {int.id === "janus" && int.installed && (
                  <div className="mt-4 p-3 rounded-md bg-muted/50 border border-border text-[11px] font-mono space-y-2">
                    <div className="flex justify-between items-center text-muted-foreground uppercase text-[9px] font-bold">
                      Connection Endpoint
                    </div>
                    <div className="truncate text-foreground border-b border-border/50 pb-1">
                      {typeof window !== 'undefined' ? window.location.origin : ''}/api/janus/v1/sync
                    </div>
                    <div className="flex justify-between items-center text-muted-foreground uppercase text-[9px] font-bold">
                      API Secret Key
                    </div>
                    <div className="text-foreground">
                      meeting-genius-secret-key-2026
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
            <CardFooter className="pt-4 border-t border-border bg-muted/30 flex flex-wrap gap-2">
              {int.id === "janus" ? (
                int.installed ? (
                  <>
                    <Button onClick={handleOpenJanus} className="flex-1 bg-indigo-600 hover:bg-indigo-700 min-w-[80px]">
                      <Eye className="h-4 w-4 mr-2" />
                      View
                    </Button>
                    <Button onClick={handleInstallJanus} variant="outline" className="flex-1 min-w-[120px] border-indigo-200 text-indigo-700 hover:bg-indigo-50">
                      <Settings className="h-4 w-4 mr-2" />
                      Sync Settings
                    </Button>
                    <Button onClick={handleUninstallJanus} variant="outline" size="icon" className="border-destructive text-destructive hover:bg-destructive/10" title="Disconnect">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                ) : (
                  <Button onClick={handleInstallJanus} variant="outline" className="w-full border-primary text-primary hover:bg-primary/5">
                    <Plus className="h-4 w-4 mr-2" />
                    Install Integration
                  </Button>
                )
              ) : (
                <Button variant="outline" disabled className="w-full">
                  Coming Soon
                </Button>
              )}
            </CardFooter>
          </Card>
        ))}
      </div>

      <Dialog open={isJanusModalOpen} onOpenChange={setIsJanusModalOpen}>
        <DialogContent className="sm:max-w-[950px] p-0 overflow-hidden border-none shadow-2xl">
          <div className="bg-indigo-600 p-8 text-white relative">
            <div className="absolute top-0 right-0 p-8 opacity-10">
              <Zap className="h-32 w-32" />
            </div>
            <DialogHeader className="relative z-10 w-full text-left">
              <div className="flex items-center gap-3 mb-2">
                <div className="h-10 w-10 bg-white/20 backdrop-blur rounded-lg flex items-center justify-center">
                  <Settings className="h-6 w-6 text-white" />
                </div>
                <div className="h-8 w-8 bg-white/20 backdrop-blur rounded-lg flex items-center justify-center">
                  <Settings className="h-5 w-5 text-white" />
                </div>
                <DialogTitle className="text-xl text-white">Connect Janus to Meeting Genius</DialogTitle>
              </div>
              <DialogDescription className="text-indigo-100 text-sm">
                Synchronize your property management data for automated triage and ticketing.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="p-8 space-y-6 bg-background max-h-[65vh] overflow-y-auto">
            {configStep === "prepare" ? (
              <div className="flex flex-col items-center justify-center py-12 space-y-4">
                <div className="relative">
                  <div className="h-12 w-12 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
                  <Zap className="h-4 w-4 text-indigo-600 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
                </div>
                <div className="text-center">
                  <p className="text-base font-bold text-foreground">Mapping your portfolio...</p>
                  <p className="text-xs text-muted-foreground">Preparing selection data.</p>
                </div>
              </div>
            ) : configStep === "configure" ? (
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
                {/* Organization Selection */}
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                    <Briefcase className="h-3 w-3 text-indigo-600" />
                    Organization Scope
                  </Label>
                  <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
                    <SelectTrigger className="w-full h-10 bg-muted/20 border-border/50 rounded-lg">
                      <SelectValue placeholder="Select organization to link" />
                    </SelectTrigger>
                    <SelectContent className="rounded-lg">
                      {availableData.companies.map(c => (
                        <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  {/* Building Selection */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                        <Building2 className="h-3 w-3 text-indigo-600" />
                        Buildings
                      </Label>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1 border-r pr-2 border-border">
                          <button 
                            className="text-[8px] font-bold text-indigo-600 hover:underline"
                            onClick={() => setSelectedBuildingIds(availableData.buildings.map(b => b.id))}
                          >
                            ALL
                          </button>
                          <span className="text-[8px] text-muted-foreground">/</span>
                          <button 
                            className="text-[8px] font-bold text-muted-foreground hover:underline"
                            onClick={() => setSelectedBuildingIds([])}
                          >
                            NONE
                          </button>
                        </div>
                        <Badge variant="secondary" className="text-[9px] h-4 bg-indigo-50 text-indigo-700 px-1">{selectedBuildingIds.length}</Badge>
                      </div>
                    </div>
                    <div className="border rounded-xl bg-muted/5 p-1">
                      <div className="grid grid-cols-1 gap-0.5">
                        {availableData.buildings
                          .filter(b => selectedCompanyId === "all" || b.company_id?.toString() === selectedCompanyId)
                          .map(b => (
                          <div 
                            key={b.id} 
                            onClick={() => {
                              const checked = !selectedBuildingIds.includes(b.id)
                              if (checked) setSelectedBuildingIds([...selectedBuildingIds, b.id])
                              else setSelectedBuildingIds(selectedBuildingIds.filter(id => id !== b.id))
                            }}
                            className={`flex items-center space-x-3 p-2 rounded-lg cursor-pointer transition-all ${
                              selectedBuildingIds.includes(b.id) ? "bg-white shadow-sm ring-1 ring-indigo-50" : "hover:bg-white/30"
                            }`}
                          >
                            <Checkbox id={`b-${b.id}`} checked={selectedBuildingIds.includes(b.id)} onCheckedChange={() => {}} />
                            <div className="flex flex-col min-w-0">
                              <span className="text-xs font-bold truncate">{b.name}</span>
                              <span className="text-[9px] text-muted-foreground truncate">{b.address || 'No address'}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                        <Users className="h-3 w-3 text-indigo-600" />
                        Residents & Staff
                      </Label>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1 border-r pr-2 border-border">
                          <button 
                            className="text-[8px] font-bold text-indigo-600 hover:underline"
                            onClick={() => setSelectedUserIds([...availableData.users, ...availableData.vendors].map(u => u.id))}
                          >
                            ALL
                          </button>
                          <span className="text-[8px] text-muted-foreground">/</span>
                          <button 
                            className="text-[8px] font-bold text-muted-foreground hover:underline"
                            onClick={() => setSelectedUserIds([])}
                          >
                            NONE
                          </button>
                        </div>
                        <Badge variant="secondary" className="text-[9px] h-4 bg-indigo-50 text-indigo-700 px-1">{selectedUserIds.length}</Badge>
                      </div>
                    </div>
                    <div className="border rounded-xl bg-muted/5 p-1">
                      <div className="grid grid-cols-1 gap-0.5">
                        {[...availableData.users, ...availableData.vendors]
                          .filter(u => selectedCompanyId === "all" || u.company_id?.toString() === selectedCompanyId)
                          .map(u => (
                          <div 
                            key={u.id} 
                            onClick={() => {
                              const checked = !selectedUserIds.includes(u.id)
                              if (checked) setSelectedUserIds([...selectedUserIds, u.id])
                              else setSelectedUserIds(selectedUserIds.filter(id => id !== u.id))
                            }}
                            className={`flex items-center space-x-3 p-2.5 rounded-lg cursor-pointer transition-all ${
                              selectedUserIds.includes(u.id) ? "bg-white shadow-sm ring-1 ring-indigo-50" : "hover:bg-white/30"
                            }`}
                          >
                            <Checkbox id={`u-${u.id}`} checked={selectedUserIds.includes(u.id)} onCheckedChange={() => {}} />
                            <div className="flex flex-col min-w-0 flex-1">
                              <span className="text-xs font-bold truncate text-foreground">{u.name || (u.email?.split('@')[0])}</span>
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className="text-[9px] text-muted-foreground truncate">{u.email}</span>
                                <Badge variant="outline" className="text-[7px] h-2.5 px-0.5 border-indigo-200 text-indigo-600 shrink-0">{u.user_type}</Badge>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                              <Input 
                                id={`unit-${u.id}`}
                                placeholder="Unit #" 
                                className="h-8 w-24 text-[11px] bg-white border-indigo-200 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm" 
                                value={userUnits[u.id] || ""}
                                onChange={(e) => setUserUnits(prev => ({ ...prev, [u.id]: e.target.value }))}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-5 animate-in fade-in duration-500 py-2">
                <div className="w-full space-y-5">
                  <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider">
                    {[
                      { step: 1, label: "Preparing" },
                      { step: 2, label: "Sending" },
                      { step: 3, label: "Complete" },
                    ].map(({ step, label }) => (
                      <div key={step} className={`flex flex-col items-center gap-1.5 flex-1 ${
                        syncStep >= step ? "text-indigo-600" : "text-muted-foreground/40"
                      }`}>
                        <div className={`h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-black border-2 transition-all duration-700 ${
                          syncStep > step
                            ? "bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-200"
                            : syncStep === step
                            ? "border-indigo-600 text-indigo-600 animate-pulse bg-indigo-50"
                            : "border-muted-foreground/20 text-muted-foreground"
                        }`}>
                          {syncStep > step ? "✓" : step}
                        </div>
                        <span>{label}</span>
                      </div>
                    ))}
                  </div>

                  <div className="w-full h-2 bg-muted/50 rounded-full overflow-hidden border border-border/50">
                    <div
                      className="h-full bg-indigo-600 rounded-full transition-all duration-1000 ease-in-out shadow-[0_0_8px_rgba(99,102,241,0.5)]"
                      style={{ width: syncStep === 1 ? "33%" : syncStep === 2 ? "66%" : "100%" }}
                    />
                  </div>

                  <div className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 h-40 overflow-y-auto font-mono text-[10px] space-y-1.5 shadow-inner">
                    <div className="text-indigo-400/80 mb-1.5 border-b border-white/5 pb-1 flex justify-between">
                      <span>Sync Engine v1.0.4</span>
                      <span className="animate-pulse">● LIVE</span>
                    </div>
                    {syncLog.map((line, i) => (
                      <div key={i} className={`flex gap-1.5 ${
                        line.startsWith("✅") ? "text-emerald-400" :
                        line.startsWith("→")  ? "text-indigo-300" :
                        line.startsWith("❌") ? "text-rose-400" :
                        line === "" ? "" :
                        "text-slate-400"
                      }`}>
                        <span className="opacity-30">[{i.toString().padStart(2, '0')}]</span>
                        <span>{line || "\u00A0"}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {configStep !== "prepare" && (
            <div className="p-6 border-t border-border bg-muted/20 flex flex-col sm:flex-row gap-3">
              {configStep === "configure" ? (
                <>
                  <Button 
                    onClick={confirmJanusIntegration} 
                    disabled={selectedBuildingIds.length === 0}
                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 h-12 text-sm font-bold shadow-lg shadow-indigo-600/20 rounded-xl transition-all active:scale-[0.98]"
                  >
                    Confirm & Sync {selectedBuildingIds.length} Properties
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                  <Button variant="ghost" className="h-12 px-8 rounded-xl" onClick={() => setIsJanusModalOpen(false)}>
                    Cancel
                  </Button>
                </>
              ) : syncStep === 3 ? (
                <Button onClick={() => setIsJanusModalOpen(false)} className="w-full bg-indigo-600 hover:bg-indigo-700 h-12 text-sm font-bold rounded-xl shadow-lg transition-all active:scale-[0.98]">
                  Return to Dashboard
                </Button>
              ) : null}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Eye(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}
