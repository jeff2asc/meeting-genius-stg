"use client"

import { useState, useEffect, useRef } from "react"
import {
  Building2,
  Users,
  Calendar,
  CheckSquare,
  ArrowLeft,
  Activity,
  CheckCircle2,
  Terminal,
  HardDrive,
  AlertTriangle,
  RotateCcw,
  Zap,
  Wrench,
  MessageSquareWarning,
  TrendingUp,
  Clock,
  ShieldAlert,
  ChevronRight,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from "recharts"

interface MasterAnalyticsDashboardProps {
  onBack: () => void
}

interface AuditLog {
  id: string
  action_type: string
  model_name: string | null
  status: string
  duration_ms: number | null
  error_message: string | null
  created_at: string
  user_name?: string
  company_name?: string
}

interface CompanyRow {
  id: number
  name: string
  janus_integrated: boolean | null
  building_count: number
  user_count: number
}

export default function MasterAnalyticsDashboard({ onBack }: MasterAnalyticsDashboardProps) {
  const [loading, setLoading] = useState(true)
  const terminalRef = useRef<HTMLDivElement>(null)

  const [metrics, setMetrics] = useState({
    companies: 0,
    buildings: 0,
    users: 0,
    meetings: 0,
    tasks: 0,
    repairs: 0,
    complaints: 0,
  })

  const [meetingStats, setMeetingStats] = useState<any[]>([])
  const [taskStats, setTaskStats] = useState<any[]>([])
  const [overdueTasksCount, setOverdueTasksCount] = useState(0)
  const [userRoleStats, setUserRoleStats] = useState<any[]>([])
  const [companyRows, setCompanyRows] = useState<CompanyRow[]>([])
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const [recentUsers, setRecentUsers] = useState<any[]>([])
  const [janusIntegratedCount, setJanusIntegratedCount] = useState(0)

  useEffect(() => {
    fetchData()
  }, [])

  // Auto-scroll terminal to bottom when new logs arrive
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight
    }
  }, [auditLogs])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [
        { count: companyCount },
        { count: buildingCount },
        { count: userCount },
        { data: meetingsData },
        { data: tasksData },
        { count: repairsCount },
        { count: complaintsCount },
        { data: usersData },
        { data: companiesData },
        { data: auditData },
        { data: buildingsData },
      ] = await Promise.all([
        supabase.from("companies").select("*", { count: "exact", head: true }),
        supabase.from("buildings").select("*", { count: "exact", head: true }),
        supabase.from("users").select("*", { count: "exact", head: true }),
        supabase.from("meetings").select("status"),
        supabase.from("tasks").select("status, due_date"),
        supabase.from("janus_repairs").select("*", { count: "exact", head: true }),
        supabase.from("janus_complaints").select("*", { count: "exact", head: true }),
        supabase
          .from("users")
          .select("id, name, email, user_type, roles, created_at, company_id")
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("companies")
          .select("id, name, janus_integrated")
          .order("name"),
        supabase
          .from("audit_logs")
          .select(`*, users:user_id(name), companies:company_id(name)`)
          .order("created_at", { ascending: false })
          .limit(40),
        supabase
          .from("buildings")
          .select("id, company_id"),
      ])

      const meetings = meetingsData || []
      const tasks = tasksData || []
      const allUsers = usersData || []
      const companies = companiesData || []
      const logs = auditData || []
      const buildings = buildingsData || []

      setMetrics({
        companies: companyCount || 0,
        buildings: buildingCount || 0,
        users: userCount || 0,
        meetings: meetings.length,
        tasks: tasks.length,
        repairs: repairsCount || 0,
        complaints: complaintsCount || 0,
      })

      // Meeting status distribution
      const meetingCounts = meetings.reduce((acc: any, m: any) => {
        const s = m.status || "unknown"
        acc[s] = (acc[s] || 0) + 1
        return acc
      }, {})
      setMeetingStats([
        { name: "Draft", value: meetingCounts.working_agenda || 0, color: "#94a3b8" },
        { name: "Agenda", value: meetingCounts.agenda || 0, color: "#3b82f6" },
        { name: "Finalized", value: meetingCounts.finalized || 0, color: "#10b981" },
      ])

      // Task status breakdown
      const taskCounts = tasks.reduce((acc: any, t: any) => {
        const s = t.status || "open"
        acc[s] = (acc[s] || 0) + 1
        return acc
      }, {})
      setTaskStats([
        { name: "Completed", value: taskCounts.completed || 0, color: "#10b981" },
        { name: "In Progress", value: taskCounts.in_progress || 0, color: "#3b82f6" },
        { name: "Open", value: taskCounts.open || 0, color: "#f59e0b" },
        { name: "Blocked", value: taskCounts.blocked || 0, color: "#ef4444" },
      ])

      // Overdue tasks
      const today = new Date().toISOString().split("T")[0]
      const overdue = tasks.filter(
        (t: any) => t.status !== "completed" && t.due_date && t.due_date < today
      ).length
      setOverdueTasksCount(overdue)

      // User role breakdown (fetch all users for this)
      const { data: allUsersForRoles } = await supabase
        .from("users")
        .select("user_type, roles")
      const roleCounts: Record<string, number> = {}
      ;(allUsersForRoles || []).forEach((u: any) => {
        const roles: string[] = Array.isArray(u.roles) && u.roles.length > 0 ? u.roles : [u.user_type || "user"]
        roles.forEach((r: string) => {
          roleCounts[r] = (roleCounts[r] || 0) + 1
        })
      })
      const roleColors: Record<string, string> = {
        master: "#ef4444",
        corporate_administrator: "#f59e0b",
        property_manager: "#3b82f6",
        owner: "#8b5cf6",
        attendee: "#10b981",
        resident: "#06b6d4",
        user: "#94a3b8",
        vendor: "#f97316",
      }
      const roleStats = Object.entries(roleCounts)
        .map(([role, count]) => ({
          name: role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
          value: count,
          color: roleColors[role] || "#64748b",
        }))
        .sort((a, b) => b.value - a.value)
      setUserRoleStats(roleStats)

      // Janus integrated count
      const janusCount = companies.filter((c: any) => c.janus_integrated).length
      setJanusIntegratedCount(janusCount)

      // Company rows enriched with building + user counts
      const { data: allUsersForCompany } = await supabase
        .from("users")
        .select("company_id")

      const buildingsByCompany: Record<number, number> = {}
      buildings.forEach((b: any) => {
        if (b.company_id) buildingsByCompany[b.company_id] = (buildingsByCompany[b.company_id] || 0) + 1
      })

      const usersByCompany: Record<number, number> = {}
      ;(allUsersForCompany || []).forEach((u: any) => {
        if (u.company_id) usersByCompany[u.company_id] = (usersByCompany[u.company_id] || 0) + 1
      })

      const enrichedCompanies: CompanyRow[] = companies.map((c: any) => ({
        id: c.id,
        name: c.name,
        janus_integrated: c.janus_integrated,
        building_count: buildingsByCompany[c.id] || 0,
        user_count: usersByCompany[c.id] || 0,
      }))
      setCompanyRows(enrichedCompanies)

      // Recent users
      setRecentUsers(allUsers)

      // Audit logs formatted
      const formattedLogs: AuditLog[] = logs.map((log: any) => ({
        ...log,
        user_name: log.users?.name,
        company_name: log.companies?.name,
      }))
      setAuditLogs(formattedLogs)
    } catch (err) {
      console.error("Error fetching master analytics:", err)
      toast.error("Failed to load master analytics metrics")
    } finally {
      setLoading(false)
    }
  }

  // Format audit log entry as a terminal line
  const formatTerminalLine = (log: AuditLog) => {
    const time = new Date(log.created_at).toLocaleTimeString([], { hour12: false })
    const who = log.user_name ? log.user_name : "System"
    const company = log.company_name ? ` @ ${log.company_name}` : ""
    const model = log.model_name ? ` [${log.model_name}]` : ""
    const duration = log.duration_ms ? ` ${log.duration_ms}ms` : ""
    const status = log.status === "success" ? "OK" : "ERR"
    return `[${time}] [${status}]${model} ${log.action_type} — ${who}${company}${duration}`
  }

  const getTerminalColor = (log: AuditLog) => {
    if (log.status === "error") return "text-red-400"
    if (log.action_type?.includes("generate")) return "text-fuchsia-400"
    if (log.action_type?.includes("minutes")) return "text-sky-400"
    if (log.action_type?.includes("agenda")) return "text-indigo-400"
    return "text-emerald-400"
  }

  const userTypeBadge = (type: string) => {
    const map: Record<string, string> = {
      master: "bg-red-500/15 text-red-400 border-red-500/30",
      corporate_administrator: "bg-amber-500/15 text-amber-400 border-amber-500/30",
      property_manager: "bg-blue-500/15 text-blue-400 border-blue-500/30",
      owner: "bg-purple-500/15 text-purple-400 border-purple-500/30",
      attendee: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
      resident: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
      vendor: "bg-orange-500/15 text-orange-400 border-orange-500/30",
      user: "bg-slate-500/15 text-slate-400 border-slate-500/30",
    }
    return map[type] || "bg-slate-500/15 text-slate-400 border-slate-500/30"
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-8 space-y-8 font-sans selection:bg-indigo-500/30">

      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-6">
        <div className="flex items-center gap-4">
          <Button
            onClick={onBack}
            variant="ghost"
            size="icon"
            className="rounded-full h-10 w-10 border border-slate-800 text-slate-400 hover:text-slate-100 hover:bg-slate-900"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <span className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 text-[10px] font-black tracking-widest uppercase px-2.5 py-1 rounded-full">
                System Administrator
              </span>
            </div>
            <h1 className="text-3xl font-black tracking-tight mt-1 bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
              Master Control Center
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold px-3 py-1.5 rounded-full">
            <Zap className="h-3.5 w-3.5 fill-current animate-pulse" />
            Supabase: Connected
          </div>
          <Button
            onClick={fetchData}
            variant="outline"
            size="sm"
            className="border-slate-800 bg-slate-900/50 hover:bg-slate-900 text-slate-300 rounded-xl"
          >
            <RotateCcw className="h-4 w-4 mr-2" /> Refresh
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-pulse">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-slate-900 rounded-2xl border border-slate-800/50" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
          <Card className="bg-slate-900/40 border-slate-800/80 backdrop-blur rounded-2xl hover:border-indigo-500/30 transition-all duration-300 shadow-xl group">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-400">Companies</CardTitle>
              <div className="p-2 bg-indigo-500/10 rounded-xl text-indigo-400 group-hover:scale-110 transition-transform">
                <Building2 className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black text-white">{metrics.companies}</div>
              <p className="text-[10px] text-slate-500 mt-1">{janusIntegratedCount} Janus integrated</p>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/40 border-slate-800/80 backdrop-blur rounded-2xl hover:border-blue-500/30 transition-all duration-300 shadow-xl group">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-400">Buildings</CardTitle>
              <div className="p-2 bg-blue-500/10 rounded-xl text-blue-400 group-hover:scale-110 transition-transform">
                <HardDrive className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black text-white">{metrics.buildings}</div>
              <p className="text-[10px] text-slate-500 mt-1">Managed legal entities</p>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/40 border-slate-800/80 backdrop-blur rounded-2xl hover:border-emerald-500/30 transition-all duration-300 shadow-xl group">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-400">Users</CardTitle>
              <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-400 group-hover:scale-110 transition-transform">
                <Users className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black text-white">{metrics.users}</div>
              <p className="text-[10px] text-slate-500 mt-1">Registered profiles</p>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/40 border-slate-800/80 backdrop-blur rounded-2xl hover:border-purple-500/30 transition-all duration-300 shadow-xl group">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-400">Meetings</CardTitle>
              <div className="p-2 bg-purple-500/10 rounded-xl text-purple-400 group-hover:scale-110 transition-transform">
                <Calendar className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black text-white">{metrics.meetings}</div>
              <p className="text-[10px] text-slate-500 mt-1">Agendas & minutes logged</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Second row KPIs */}
      {!loading && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
          <Card className="bg-slate-900/40 border-slate-800/80 backdrop-blur rounded-2xl hover:border-amber-500/30 transition-all duration-300 shadow-xl group">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-400">Tasks</CardTitle>
              <div className="p-2 bg-amber-500/10 rounded-xl text-amber-400 group-hover:scale-110 transition-transform">
                <CheckSquare className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black text-white">{metrics.tasks}</div>
              {overdueTasksCount > 0 && (
                <p className="text-[10px] text-red-400 mt-1 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> {overdueTasksCount} overdue
                </p>
              )}
              {overdueTasksCount === 0 && <p className="text-[10px] text-slate-500 mt-1">No overdue tasks</p>}
            </CardContent>
          </Card>

          <Card className="bg-slate-900/40 border-slate-800/80 backdrop-blur rounded-2xl hover:border-orange-500/30 transition-all duration-300 shadow-xl group">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-400">Repairs</CardTitle>
              <div className="p-2 bg-orange-500/10 rounded-xl text-orange-400 group-hover:scale-110 transition-transform">
                <Wrench className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black text-white">{metrics.repairs}</div>
              <p className="text-[10px] text-slate-500 mt-1">Janus maintenance items</p>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/40 border-slate-800/80 backdrop-blur rounded-2xl hover:border-rose-500/30 transition-all duration-300 shadow-xl group">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-400">Complaints</CardTitle>
              <div className="p-2 bg-rose-500/10 rounded-xl text-rose-400 group-hover:scale-110 transition-transform">
                <MessageSquareWarning className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black text-white">{metrics.complaints}</div>
              <p className="text-[10px] text-slate-500 mt-1">Tenant escalations</p>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/40 border-slate-800/80 backdrop-blur rounded-2xl hover:border-cyan-500/30 transition-all duration-300 shadow-xl group">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-400">AI Events</CardTitle>
              <div className="p-2 bg-cyan-500/10 rounded-xl text-cyan-400 group-hover:scale-110 transition-transform">
                <TrendingUp className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black text-white">{auditLogs.length > 0 ? `${auditLogs.length}+` : "0"}</div>
              <p className="text-[10px] text-slate-500 mt-1">Recent LLM events logged</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left: charts + company table */}
        <div className="lg:col-span-2 space-y-6">

          {/* Charts row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* Meeting distribution */}
            <Card className="bg-slate-900/30 border-slate-800/80 rounded-2xl p-4 shadow-lg flex flex-col justify-between">
              <div>
                <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-300 mb-4 flex items-center gap-2">
                  <Activity className="h-4 w-4 text-indigo-400" />
                  Meeting Distribution
                </CardTitle>
                <div className="h-48 w-full flex items-center justify-center">
                  {meetingStats.some((s) => s.value > 0) ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={meetingStats} innerRadius={50} outerRadius={70} paddingAngle={3} dataKey="value">
                          {meetingStats.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: "8px" }}
                          itemStyle={{ color: "#fff" }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="text-xs text-slate-500 italic">No meetings yet</div>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center text-xs mt-2 border-t border-slate-800/60 pt-3">
                {meetingStats.map((stat) => (
                  <div key={stat.name} className="flex flex-col items-center">
                    <span className="flex items-center gap-1.5 text-slate-400">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: stat.color }} />
                      {stat.name}
                    </span>
                    <span className="font-bold text-white mt-0.5">{stat.value}</span>
                  </div>
                ))}
              </div>
            </Card>

            {/* Task status */}
            <Card className="bg-slate-900/30 border-slate-800/80 rounded-2xl p-4 shadow-lg flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-center mb-4">
                  <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                    <CheckSquare className="h-4 w-4 text-emerald-400" />
                    Task Status
                  </CardTitle>
                  {overdueTasksCount > 0 && (
                    <span className="bg-red-500/15 border border-red-500/30 text-red-400 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      {overdueTasksCount} Overdue
                    </span>
                  )}
                </div>
                <div className="h-48 w-full">
                  {taskStats.some((s) => s.value > 0) ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={taskStats}>
                        <XAxis dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} />
                        <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} allowDecimals={false} />
                        <Tooltip
                          contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: "8px" }}
                          itemStyle={{ color: "#fff" }}
                          cursor={{ fill: "rgba(255,255,255,0.05)" }}
                        />
                        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                          {taskStats.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-xs text-slate-500 italic">No tasks yet</div>
                  )}
                </div>
              </div>
              <div className="text-center text-[10px] text-slate-500 italic border-t border-slate-800/60 pt-3 mt-2">
                Live data from all organization task lists
              </div>
            </Card>
          </div>

          {/* User role breakdown */}
          <Card className="bg-slate-900/30 border-slate-800/80 rounded-2xl p-5 shadow-lg">
            <CardHeader className="p-0 mb-4">
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                <Users className="h-4 w-4 text-purple-400" />
                User Role Breakdown
              </CardTitle>
              <CardDescription className="text-xs text-slate-500 mt-0.5">Distribution of all registered user roles across the platform.</CardDescription>
            </CardHeader>
            {loading ? (
              <div className="space-y-2 animate-pulse">
                {[1, 2, 3].map((i) => <div key={i} className="h-8 bg-slate-800 rounded-lg" />)}
              </div>
            ) : userRoleStats.length === 0 ? (
              <p className="text-xs text-slate-500 italic">No users found.</p>
            ) : (
              <div className="space-y-2">
                {userRoleStats.map((role) => {
                  const pct = metrics.users > 0 ? Math.round((role.value / metrics.users) * 100) : 0
                  return (
                    <div key={role.name} className="flex items-center gap-3">
                      <span className="text-xs text-slate-400 w-40 shrink-0">{role.name}</span>
                      <div className="flex-1 bg-slate-800/50 rounded-full h-2 overflow-hidden">
                        <div
                          className="h-2 rounded-full transition-all duration-700"
                          style={{ width: `${pct}%`, backgroundColor: role.color }}
                        />
                      </div>
                      <span className="text-xs font-bold text-white w-8 text-right">{role.value}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </Card>

          {/* Company breakdown table */}
          <Card className="bg-slate-900/30 border-slate-800/80 rounded-2xl p-5 shadow-lg">
            <CardHeader className="p-0 mb-4 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-indigo-400" />
                  Company Overview
                </CardTitle>
                <CardDescription className="text-xs text-slate-500 mt-0.5">All registered client companies and their resource counts.</CardDescription>
              </div>
              <span className="text-[10px] bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 px-2 py-0.5 rounded-full font-bold">
                {companyRows.length} Total
              </span>
            </CardHeader>
            {loading ? (
              <div className="space-y-2 animate-pulse">
                {[1, 2, 3].map((i) => <div key={i} className="h-12 bg-slate-800 rounded-xl" />)}
              </div>
            ) : companyRows.length === 0 ? (
              <p className="text-xs text-slate-500 italic">No companies found.</p>
            ) : (
              <div className="divide-y divide-slate-800/50 border border-slate-800/50 rounded-xl bg-slate-950/20 overflow-hidden">
                {companyRows.map((company) => (
                  <div key={company.id} className="flex items-center justify-between px-4 py-3 hover:bg-slate-900/30 transition-colors group">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-8 w-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 font-black text-xs shrink-0">
                        {company.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-white truncate">{company.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {company.janus_integrated ? (
                            <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                              JANUS ✓
                            </span>
                          ) : (
                            <span className="text-[9px] font-bold text-slate-500 bg-slate-800/50 px-1.5 py-0.5 rounded border border-slate-700/50">
                              No Janus
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 shrink-0 text-right">
                      <div className="text-center">
                        <div className="text-xs font-black text-white">{company.building_count}</div>
                        <div className="text-[9px] text-slate-500">buildings</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xs font-black text-white">{company.user_count}</div>
                        <div className="text-[9px] text-slate-500">users</div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-slate-600 group-hover:text-slate-400 transition-colors" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Right: Real AI audit log terminal + recent users */}
        <div className="space-y-6">

          {/* Real AI Audit Log Terminal */}
          <Card className="bg-slate-900/40 border-slate-800/80 backdrop-blur rounded-2xl p-5 shadow-lg flex flex-col" style={{ minHeight: "460px" }}>
            <CardHeader className="p-0 mb-4 flex flex-row items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                  <Terminal className="h-4 w-4 text-indigo-400" />
                  AI Activity Log
                </CardTitle>
                <p className="text-[10px] text-slate-500 mt-0.5">Live feed from <code className="text-indigo-400">audit_logs</code> table</p>
              </div>
              <span className="h-2 w-2 rounded-full bg-indigo-500 animate-ping" />
            </CardHeader>

            <div
              ref={terminalRef}
              className="flex-1 bg-slate-950/80 border border-slate-800/80 rounded-xl p-4 font-mono text-[11px] leading-relaxed overflow-y-auto space-y-1.5 shadow-inner"
              style={{ maxHeight: "380px" }}
            >
              {loading ? (
                <div className="text-slate-500 animate-pulse">Loading audit logs...</div>
              ) : auditLogs.length === 0 ? (
                <div className="text-slate-500 italic">No AI activity logged yet.</div>
              ) : (
                auditLogs.slice().reverse().map((log) => (
                  <div
                    key={log.id}
                    className={`${getTerminalColor(log)} hover:bg-slate-900/40 px-1 py-0.5 rounded transition-colors`}
                  >
                    {formatTerminalLine(log)}
                    {log.status === "error" && log.error_message && (
                      <div className="text-red-300/70 pl-4 text-[10px] mt-0.5 truncate">
                        ↳ {log.error_message}
                      </div>
                    )}
                  </div>
                ))
              )}
              <div className="text-slate-500 animate-pulse mt-3 flex items-center gap-1">
                <span>$</span>
                <span className="h-3 w-1.5 bg-slate-500 inline-block" />
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between text-[10px] text-slate-500">
              <span className="flex items-center gap-1.5">
                <ShieldAlert className="h-3 w-3 text-slate-600" />
                Source: audit_logs (last 40 events)
              </span>
              <span>
                {auditLogs.filter((l) => l.status === "error").length} errors
              </span>
            </div>
          </Card>

          {/* Recent Registrations */}
          <Card className="bg-slate-900/40 border-slate-800/80 backdrop-blur rounded-2xl p-5 shadow-lg">
            <CardHeader className="p-0 mb-4 flex flex-row items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                  <Clock className="h-4 w-4 text-emerald-400" />
                  Recent Users
                </CardTitle>
                <p className="text-[10px] text-slate-500 mt-0.5">Latest 5 registered profiles</p>
              </div>
            </CardHeader>
            {loading ? (
              <div className="space-y-3 animate-pulse">
                {[1, 2, 3].map((i) => <div key={i} className="h-10 bg-slate-800 rounded-lg" />)}
              </div>
            ) : recentUsers.length === 0 ? (
              <p className="text-xs text-slate-500 italic">No users found.</p>
            ) : (
              <div className="space-y-2">
                {recentUsers.map((user: any) => (
                  <div key={user.id} className="flex items-center gap-3 py-2 border-b border-slate-800/40 last:border-0">
                    <div className="h-8 w-8 rounded-full bg-gradient-to-br from-indigo-500/30 to-purple-500/30 border border-indigo-500/20 flex items-center justify-center text-indigo-300 font-black text-xs shrink-0">
                      {user.name?.charAt(0)?.toUpperCase() || "?"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-white truncate">{user.name}</p>
                      <p className="text-[10px] text-slate-500 truncate">{user.email}</p>
                    </div>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded border shrink-0 ${userTypeBadge(user.user_type)}`}>
                      {(user.user_type || "user").replace(/_/g, " ")}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Janus sync status */}
          <Card className="bg-slate-900/40 border-slate-800/80 backdrop-blur rounded-2xl p-5 shadow-lg">
            <CardHeader className="p-0 mb-4">
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                <Activity className="h-4 w-4 text-emerald-400" />
                Janus Sync Status
              </CardTitle>
            </CardHeader>
            <div className="space-y-3">
              <div className="flex justify-between items-center bg-slate-950/40 border border-slate-800/50 rounded-xl px-4 py-3">
                <div>
                  <p className="text-[10px] uppercase font-bold text-slate-500">Repairs</p>
                  <p className="text-xl font-black text-white">{metrics.repairs}</p>
                </div>
                <Wrench className="h-6 w-6 text-orange-400/40" />
              </div>
              <div className="flex justify-between items-center bg-slate-950/40 border border-slate-800/50 rounded-xl px-4 py-3">
                <div>
                  <p className="text-[10px] uppercase font-bold text-slate-500">Complaints</p>
                  <p className="text-xl font-black text-white">{metrics.complaints}</p>
                </div>
                <MessageSquareWarning className="h-6 w-6 text-rose-400/40" />
              </div>
              <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 fill-current" />
                <div>
                  <p className="text-[10px] font-bold text-emerald-400">
                    {janusIntegratedCount} of {metrics.companies} companies integrated
                  </p>
                  <p className="text-[9px] text-slate-500">Janus webhook active</p>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
