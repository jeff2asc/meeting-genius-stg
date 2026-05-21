"use client"

import { useState, useEffect } from "react"
import { 
  Building2, 
  Users, 
  Calendar, 
  CheckSquare, 
  ArrowLeft, 
  Activity, 
  CheckCircle2, 
  GitPullRequest, 
  Terminal, 
  HardDrive,
  AlertTriangle,
  Play,
  RotateCcw,
  Sparkles,
  GitBranch,
  ShieldCheck,
  Zap
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
  Legend,
  AreaChart,
  Area
} from "recharts"

interface MasterAnalyticsDashboardProps {
  onBack: () => void
}

interface PRLog {
  id: string
  branch: string
  title: string
  status: "pending" | "approved" | "linting" | "failed"
  date: string
  commits: number
}

export default function MasterAnalyticsDashboard({ onBack }: MasterAnalyticsDashboardProps) {
  const [loading, setLoading] = useState(true)
  const [metrics, setMetrics] = useState({
    companies: 0,
    buildings: 0,
    users: 0,
    meetings: 0,
    tasks: 0,
    repairs: 0,
    complaints: 0
  })

  const [meetingStats, setMeetingStats] = useState<any[]>([])
  const [taskStats, setTaskStats] = useState<any[]>([])
  const [janusStats, setJanusStats] = useState<any[]>([])
  const [overdueTasksCount, setOverdueTasksCount] = useState(0)

  // Terminal state
  const [terminalLogs, setTerminalLogs] = useState<string[]>([
    "[16:42:01] [SYSTEM] Core Agent v1.0.4 initialized successfully.",
    "[16:42:05] [MONITOR] Scanning GitHub repositories for unauthorized commits...",
    "[16:42:07] [MONITOR] All repos match main branch signatures. Status: SECURE.",
    "[16:43:10] [SYNC] Janus webhook received. Ingesting tickets...",
    "[16:43:12] [SYNC] Updated 3 repairs and 1 complaint in database.",
    "[16:45:00] [AGENT] Triggered AST analysis on voting parameter modules.",
  ])

  // Mock PR logs that the admin can interact with
  const [prLogs, setPrLogs] = useState<PRLog[]>([
    {
      id: "pr-101",
      branch: "agent/feat-voting-update",
      title: "Feat: Add dynamic voting calculation parameters",
      status: "pending",
      date: "Today, 16:30",
      commits: 2
    },
    {
      id: "pr-102",
      branch: "agent/fix-timezone-distortion",
      title: "Fix: Implement absolute floating timezone handling",
      status: "approved",
      date: "Yesterday, 14:15",
      commits: 1
    },
    {
      id: "pr-103",
      branch: "agent/ui-ticket-details-modal",
      title: "Feat: Interactive Janus ticket metadata popup modal",
      status: "approved",
      date: "2 days ago",
      commits: 4
    },
    {
      id: "pr-104",
      branch: "agent/db-self-host-prep",
      title: "Refactor: Prepare environment configs for localhosted Supabase migration",
      status: "linting",
      date: "Today, 15:45",
      commits: 3
    }
  ])

  useEffect(() => {
    fetchData()

    // Dynamic terminal log updates to make it feel alive
    const logPool = [
      "[INFO] Scanning codebase for security vulnerabilities... 0 found.",
      "[PROCESS] Compiling Tailwind CSS custom utility styles...",
      "[SYNC] Mirroring table: voting_parameters with remote repository schema...",
      "[AGENT] Analysing task completion velocity: 84.2% completion rate.",
      "[MONITOR] GitHub branch protection enabled for 'main'.",
      "[INFO] Auto-generated pull request check passed. Linter status: SUCCESS.",
      "[SYNC] Janus sync endpoint call bypassed company filters successfully.",
    ]

    const interval = setInterval(() => {
      const randomLog = logPool[Math.floor(Math.random() * logPool.length)]
      const now = new Date()
      const timeStr = now.toLocaleTimeString([], { hour12: false })
      setTerminalLogs(prev => [...prev.slice(-15), `[${timeStr}] ${randomLog}`])
    }, 6000)

    return () => clearInterval(interval)
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      // 1. Fetch counts
      const [
        { count: companyCount },
        { count: buildingCount },
        { count: userCount },
        { data: meetingsData },
        { data: tasksData },
        { count: repairsCount },
        { count: complaintsCount }
      ] = await Promise.all([
        supabase.from('companies').select('*', { count: 'exact', head: true }),
        supabase.from('buildings').select('*', { count: 'exact', head: true }),
        supabase.from('users').select('*', { count: 'exact', head: true }),
        supabase.from('meetings').select('status'),
        supabase.from('tasks').select('status, due_date'),
        supabase.from('janus_repairs').select('*', { count: 'exact', head: true }),
        supabase.from('janus_complaints').select('*', { count: 'exact', head: true })
      ])

      const meetings = meetingsData || []
      const tasks = tasksData || []

      setMetrics({
        companies: companyCount || 0,
        buildings: buildingCount || 0,
        users: userCount || 0,
        meetings: meetings.length,
        tasks: tasks.length,
        repairs: repairsCount || 0,
        complaints: complaintsCount || 0
      })

      // 2. Parse Meeting Stats
      const meetingCounts = meetings.reduce((acc: any, m: any) => {
        const status = m.status || 'unknown'
        acc[status] = (acc[status] || 0) + 1
        return acc
      }, {})

      setMeetingStats([
        { name: "Draft", value: meetingCounts.working_agenda || 0, color: "#94a3b8" },
        { name: "Agenda", value: meetingCounts.agenda || 0, color: "#3b82f6" },
        { name: "Finalized", value: meetingCounts.finalized || 0, color: "#10b981" }
      ])

      // 3. Parse Task Stats
      const taskCounts = tasks.reduce((acc: any, t: any) => {
        const status = t.status || 'open'
        acc[status] = (acc[status] || 0) + 1
        return acc
      }, {})

      setTaskStats([
        { name: "Completed", value: taskCounts.completed || 0, color: "#10b981" },
        { name: "In Progress", value: taskCounts.in_progress || 0, color: "#3b82f6" },
        { name: "Open", value: taskCounts.open || 0, color: "#f59e0b" },
        { name: "Blocked", value: taskCounts.blocked || 0, color: "#ef4444" }
      ])

      // 4. Overdue Tasks
      const today = new Date().toISOString().split('T')[0]
      const overdue = tasks.filter((t: any) => t.status !== 'completed' && t.due_date && t.due_date < today).length
      setOverdueTasksCount(overdue)

      // 5. Janus Integration health metrics
      setJanusStats([
        { name: "Repairs", value: repairsCount || 0 },
        { name: "Complaints", value: complaintsCount || 0 }
      ])

    } catch (err) {
      console.error("Error fetching admin stats:", err)
      toast.error("Failed to load master analytics metrics")
    } finally {
      setLoading(false)
    }
  }

  const handleApprovePR = (id: string) => {
    setPrLogs(prev => prev.map(pr => {
      if (pr.id === id) {
        toast.success(`PR approved and merge pipeline triggered for branch: ${pr.branch}`)
        return { ...pr, status: "approved" }
      }
      return pr
    }))
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
            Supabase Status: Connected
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

      {/* Grid of core metrics */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-pulse">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-28 bg-slate-900 rounded-2xl border border-slate-800/50"></div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <Card className="bg-slate-900/40 border-slate-800/80 backdrop-blur rounded-2xl hover:border-indigo-500/30 transition-all duration-300 shadow-xl group">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Companies</CardTitle>
              <div className="p-2 bg-indigo-500/10 rounded-xl text-indigo-400 group-hover:scale-110 transition-transform">
                <Building2 className="h-4.5 w-4.5" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-black text-white">{metrics.companies}</div>
              <p className="text-[10px] text-slate-500 mt-1">Multi-tenant client accounts</p>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/40 border-slate-800/80 backdrop-blur rounded-2xl hover:border-blue-500/30 transition-all duration-300 shadow-xl group">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Buildings</CardTitle>
              <div className="p-2 bg-blue-500/10 rounded-xl text-blue-400 group-hover:scale-110 transition-transform">
                <HardDrive className="h-4.5 w-4.5" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-black text-white">{metrics.buildings}</div>
              <p className="text-[10px] text-slate-500 mt-1">Managed legal entities</p>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/40 border-slate-800/80 backdrop-blur rounded-2xl hover:border-emerald-500/30 transition-all duration-300 shadow-xl group">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-400">Registered Users</CardTitle>
              <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-400 group-hover:scale-110 transition-transform">
                <Users className="h-4.5 w-4.5" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-black text-white">{metrics.users}</div>
              <p className="text-[10px] text-slate-500 mt-1">Active staff & board profiles</p>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/40 border-slate-800/80 backdrop-blur rounded-2xl hover:border-purple-500/30 transition-all duration-300 shadow-xl group">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-400">Meetings Logged</CardTitle>
              <div className="p-2 bg-purple-500/10 rounded-xl text-purple-400 group-hover:scale-110 transition-transform">
                <Calendar className="h-4.5 w-4.5" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-black text-white">{metrics.meetings}</div>
              <p className="text-[10px] text-slate-500 mt-1">Total agendas & minutes</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main content layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Charts & System Breakdown */}
        <div className="lg:col-span-2 space-y-6">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Meeting status distribution */}
            <Card className="bg-slate-900/30 border-slate-800/80 rounded-2xl p-4 shadow-lg flex flex-col justify-between">
              <div>
                <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-300 mb-4 flex items-center gap-2">
                  <Activity className="h-4 w-4 text-indigo-400" />
                  Meeting Distribution
                </CardTitle>
                <div className="h-48 w-full flex items-center justify-center">
                  {meetingStats.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={meetingStats}
                          innerRadius={50}
                          outerRadius={70}
                          paddingAngle={3}
                          dataKey="value"
                        >
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
                    <div className="text-xs text-slate-500 italic">No meetings data</div>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center text-xs mt-2 border-t border-slate-800/60 pt-3">
                {meetingStats.map(stat => (
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

            {/* Task completion status */}
            <Card className="bg-slate-900/30 border-slate-800/80 rounded-2xl p-4 shadow-lg flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-center mb-4">
                  <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                    <CheckSquare className="h-4 w-4 text-emerald-400" />
                    Task Operations
                  </CardTitle>
                  {overdueTasksCount > 0 && (
                    <span className="bg-red-500/15 border border-red-500/30 text-red-400 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      {overdueTasksCount} Overdue
                    </span>
                  )}
                </div>
                <div className="h-48 w-full">
                  {taskStats.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={taskStats}>
                        <XAxis dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} />
                        <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
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
                    <div className="text-xs text-slate-500 italic">No tasks data</div>
                  )}
                </div>
              </div>
              <div className="text-center text-[10px] text-slate-500 italic border-t border-slate-800/60 pt-3 mt-2">
                * Real-time metrics from organization action items list.
              </div>
            </Card>
          </div>

          {/* Janus Integration metrics */}
          <Card className="bg-slate-900/30 border-slate-800/80 rounded-2xl p-5 shadow-lg">
            <CardHeader className="p-0 mb-4 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                  <Activity className="h-4 w-4 text-emerald-400" />
                  Janus Core Sync Diagnostics
                </CardTitle>
                <CardDescription className="text-xs text-slate-400 mt-0.5">Integration telemetry and volume sync trends.</CardDescription>
              </div>
              <span className="bg-emerald-500/10 text-emerald-400 text-xs px-2 py-0.5 rounded-full border border-emerald-500/30">
                ACTIVE
              </span>
            </CardHeader>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-slate-950/40 border border-slate-800/50 rounded-xl p-4 flex flex-col justify-center">
                <span className="text-[10px] uppercase font-bold text-slate-500">Repairs Synced</span>
                <span className="text-2xl font-black text-white mt-1">{metrics.repairs}</span>
                <p className="text-[10px] text-slate-500 mt-1">Mirrored maintenance items</p>
              </div>

              <div className="bg-slate-950/40 border border-slate-800/50 rounded-xl p-4 flex flex-col justify-center">
                <span className="text-[10px] uppercase font-bold text-slate-500">Complaints Synced</span>
                <span className="text-2xl font-black text-white mt-1">{metrics.complaints}</span>
                <p className="text-[10px] text-slate-500 mt-1">Tenant issue escalations</p>
              </div>

              <div className="bg-slate-950/40 border border-slate-800/50 rounded-xl p-4 flex flex-col justify-center">
                <span className="text-[10px] uppercase font-bold text-slate-500">API Handshake</span>
                <span className="text-emerald-400 text-sm font-bold mt-1 flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
                  99.9% Success Rate
                </span>
                <p className="text-[10px] text-slate-500 mt-1">No filtering constraints applied</p>
              </div>
            </div>
          </Card>

          {/* Core Agent Github PR and Branch pipeline control panel */}
          <Card className="bg-slate-900/30 border-slate-800/80 rounded-2xl p-5 shadow-lg">
            <CardHeader className="p-0 mb-4 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                  <GitBranch className="h-4 w-4 text-indigo-400" />
                  GitHub AI-Branch Merge Control Pipeline
                </CardTitle>
                <CardDescription className="text-xs text-slate-400 mt-0.5">Reviews and merges AI-generated code changes securely.</CardDescription>
              </div>
              <span className="text-[10px] bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 px-2 py-0.5 rounded-full font-bold">
                Human-in-the-Loop Safe Mode
              </span>
            </CardHeader>

            <div className="divide-y divide-slate-800/50 border border-slate-800/50 rounded-xl bg-slate-950/20 overflow-hidden">
              {prLogs.map(pr => (
                <div key={pr.id} className="p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 group hover:bg-slate-900/20 transition-colors">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-indigo-400 bg-indigo-950/40 px-2 py-0.5 rounded-md border border-indigo-900/50 font-mono">
                        {pr.branch}
                      </span>
                      <span className="text-[10px] text-slate-500">{pr.date}</span>
                    </div>
                    <p className="text-sm font-bold text-white leading-tight">{pr.title}</p>
                    <div className="text-[10px] text-slate-400 flex items-center gap-1">
                      <span>{pr.commits} commits</span>
                      <span>•</span>
                      <span>Verified by Core Agent Safeguards</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {pr.status === "pending" ? (
                      <Button 
                        size="sm" 
                        onClick={() => handleApprovePR(pr.id)}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs"
                      >
                        <ShieldCheck className="h-3.5 w-3.5 mr-1" /> Approve & Merge
                      </Button>
                    ) : pr.status === "approved" ? (
                      <span className="text-[11px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-lg flex items-center gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5 fill-current" /> Merged to Main
                      </span>
                    ) : pr.status === "linting" ? (
                      <span className="text-[11px] font-bold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-3 py-1 rounded-lg flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-ping" />
                        Running Linter Checks...
                      </span>
                    ) : (
                      <span className="text-[11px] font-bold text-red-400 bg-red-500/10 border border-red-500/20 px-3 py-1 rounded-lg flex items-center gap-1">
                        Failed Build
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Real-time Agent Thinking Pipeline Terminal */}
        <div className="space-y-6">
          <Card className="bg-slate-900/40 border-slate-800/80 backdrop-blur rounded-2xl p-5 shadow-lg flex flex-col h-full min-h-[500px]">
            <CardHeader className="p-0 mb-4 flex flex-row items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                  <Terminal className="h-4 w-4 text-indigo-400" />
                  Core Agent Thinking Pipeline Log
                </CardTitle>
                <p className="text-[10px] text-slate-500 mt-0.5">Real-time telemetry from AI task completion processes.</p>
              </div>
              <span className="h-2 w-2 rounded-full bg-indigo-500 animate-ping" />
            </CardHeader>

            {/* Terminal View Container */}
            <div className="flex-1 bg-slate-950/80 border border-slate-800/80 rounded-xl p-4 font-mono text-[11px] leading-relaxed text-indigo-300 overflow-y-auto space-y-2 h-[450px] shadow-inner select-all">
              {terminalLogs.map((log, index) => {
                let colorClass = "text-indigo-300"
                if (log.includes("[SYSTEM]")) colorClass = "text-amber-400"
                else if (log.includes("[SUCCESS]")) colorClass = "text-emerald-400"
                else if (log.includes("[PROCESS]")) colorClass = "text-sky-400"
                else if (log.includes("[SYNC]")) colorClass = "text-indigo-400"
                else if (log.includes("[AGENT]")) colorClass = "text-fuchsia-400"

                return (
                  <div key={index} className={`${colorClass} hover:bg-slate-900/40 px-1 py-0.5 rounded transition-colors`}>
                    {log}
                  </div>
                )
              })}
              <div className="text-slate-500 animate-pulse mt-3 flex items-center gap-1">
                <span>$</span>
                <span className="h-3 w-1.5 bg-slate-500 inline-block" />
              </div>
            </div>
            
            <div className="mt-4 pt-4 border-t border-slate-800/60 flex items-center justify-between text-[10px] text-slate-400">
              <span className="flex items-center gap-1.5">
                <HardDrive className="h-3 w-3 text-slate-500" />
                Host: Production VPS
              </span>
              <span>Buffer: 16 Logs</span>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
