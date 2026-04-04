import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

interface AuditLog {
  id: string
  user_id: number | null
  company_id: number | null
  action_type: string
  model_name: string | null
  status: string
  duration_ms: number | null
  error_message: string | null
  created_at: string
  user_name?: string
  company_name?: string
}

export default function SystemAuditTab({ companyId }: { companyId?: number }) {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchLogs()
  }, [companyId])

  const fetchLogs = async () => {
    setLoading(true)
    try {
      let query = supabase
        .from("audit_logs")
        .select(`
          *,
          users:user_id(name),
          companies:company_id(name)
        `)
        .order("created_at", { ascending: false })
        .limit(100)
        
      if (companyId) {
         query = query.eq("company_id", companyId)
      }

      const { data, error } = await query

      if (error) {
        console.error("Error fetching audit logs:", error)
        return
      }

      if (data && data.length > 0) {
        const formattedData = data.map((log: any) => ({
          ...log,
          user_name: log.users?.name,
          company_name: log.companies?.name,
        }))
        setLogs(formattedData)
      } else {
        // Mock data for visualization if table is empty
        const mockLogs: AuditLog[] = [
          {
            id: "1",
            user_id: 123,
            company_id: 45,
            action_type: "transcript_summary",
            model_name: "gpt-4o-mini",
            status: "success",
            duration_ms: 1240,
            error_message: null,
            created_at: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
            user_name: "Jeffrey Domingo",
            company_name: "ABC Corp"
          },
          {
            id: "2",
            user_id: 124,
            company_id: 45,
            action_type: "task_extraction",
            model_name: "gemini-2.5-flash",
            status: "success",
            duration_ms: 850,
            error_message: null,
            created_at: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
            user_name: "Sarah Smith",
            company_name: "ABC Corp"
          },
          {
            id: "3",
            user_id: 123,
            company_id: null,
            action_type: "agenda_generation",
            model_name: "ollama (llama3)",
            status: "failure",
            duration_ms: 4200,
            error_message: "Connection refused to local Ollama server",
            created_at: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
            user_name: "Jeffrey Domingo",
            company_name: "No Company"
          },
          {
            id: "4",
            user_id: null,
            company_id: 46,
            action_type: "transcript_analysis",
            model_name: "gpt-4o-mini",
            status: "success",
            duration_ms: 1540,
            error_message: null,
            created_at: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
            user_name: "System System",
            company_name: "Global Property Group"
          }
        ]
        setLogs(mockLogs)
      }
    } catch (err) {
      console.error("Unexpected error:", err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-center bg-card p-6 rounded-xl border border-border shadow-sm">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">System Audit Logs</h2>
          <p className="text-muted-foreground mt-1">Review LLM usage, performance, and errors across the system.</p>
        </div>
        <button 
          onClick={fetchLogs} 
          className="px-4 py-2 bg-secondary text-secondary-foreground rounded-md text-sm font-medium hover:bg-secondary/80 transition-colors"
        >
          Refresh Logs
        </button>
      </div>

      <Card className="border-border">
        <CardHeader className="bg-muted/30 border-b border-border">
          <CardTitle className="text-lg">Recent AI Activity</CardTitle>
          <CardDescription>Showing the last 100 LLM events</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50 text-muted-foreground">
                  <th className="py-3 px-4 text-left font-medium">Timestamp</th>
                  <th className="py-3 px-4 text-left font-medium">Model</th>
                  <th className="py-3 px-4 text-left font-medium">Action</th>
                  <th className="py-3 px-4 text-left font-medium">Duration</th>
                  <th className="py-3 px-4 text-left font-medium">Status</th>
                  <th className="py-3 px-4 text-left font-medium">User / Company</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      <td className="py-4 px-4"><div className="h-4 bg-muted rounded animate-pulse w-3/4"></div></td>
                      <td className="py-4 px-4"><div className="h-4 bg-muted rounded animate-pulse w-3/4"></div></td>
                      <td className="py-4 px-4"><div className="h-4 bg-muted rounded animate-pulse w-3/4"></div></td>
                      <td className="py-4 px-4"><div className="h-4 bg-muted rounded animate-pulse w-1/2"></div></td>
                      <td className="py-4 px-4"><div className="h-4 bg-muted rounded animate-pulse w-1/2"></div></td>
                      <td className="py-4 px-4"><div className="h-4 bg-muted rounded animate-pulse w-full"></div></td>
                    </tr>
                  ))
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-muted-foreground">
                      No audit logs found.
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4 whitespace-nowrap text-muted-foreground">
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 font-medium">
                        {log.model_name || "Unknown"}
                      </td>
                      <td className="py-3 px-4">{log.action_type}</td>
                      <td className="py-3 px-4">
                        {log.duration_ms ? `${log.duration_ms}ms` : "-"}
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant={log.status === "success" ? "default" : "destructive"}>
                          {log.status}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-col">
                          <span className="font-medium text-foreground">{log.user_name || `ID: ${log.user_id}`}</span>
                          <span className="text-xs text-muted-foreground">{log.company_name || "No Company"}</span>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
