"use client"
import { useState, useEffect } from "react"
import { supabase, getCurrentUser } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { isMaster as checkIsMaster } from "@/lib/permissions"

const PROVIDER_DEFAULTS: Record<string, string> = {
  gemini: 'gemini-2.5-flash',
  openai: 'gpt-4o-mini',
  ollama: 'llama3.2',
}

export default function LlmSettingsTab() {
  const currentUser = getCurrentUser()
  const isMaster = checkIsMaster(currentUser)

  // Company selector (master only)
  const [companies, setCompanies] = useState<any[]>([])
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("global")
  const [loadingCompanies, setLoadingCompanies] = useState(false)

  // Form fields
  const [provider, setProvider] = useState("ollama")
  const [model, setModel] = useState("")
  const [apiKey, setApiKey] = useState("")
  const [ollamaHost, setOllamaHost] = useState("")

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  useEffect(() => {
    if (isMaster) {
      setLoadingCompanies(true)
      supabase.from('companies').select('id, name, llm_provider, llm_api_key, llm_model').order('name')
        .then(({ data }) => { setCompanies(data || []); setLoadingCompanies(false) })
    }
    loadGlobalSettings()
  }, [])

  // When company selection changes, load that company's settings
  useEffect(() => {
    if (selectedCompanyId === "global") {
      loadGlobalSettings()
    } else {
      const company = companies.find(c => String(c.id) === selectedCompanyId)
      if (company) {
        setProvider(company.llm_provider || 'global')
        setModel(company.llm_model || '')
        setApiKey('')  // never prefill API key for security
        setOllamaHost('')
      }
    }
  }, [selectedCompanyId, companies])

  const loadGlobalSettings = async () => {
    setLoading(true)
    try {
      const { data } = await supabase
        .from("system_settings")
        .select("key, value")
        .in("key", ["primary_llm", "primary_llm_model", "global_llm_api_key", "ollama_host"])
      if (data) {
        data.forEach(s => {
          if (s.key === 'primary_llm') setProvider(s.value || 'ollama')
          if (s.key === 'primary_llm_model') setModel(s.value || '')
          if (s.key === 'global_llm_api_key') setApiKey(s.value || '')
          if (s.key === 'ollama_host') setOllamaHost(s.value || '')
        })
      }
    } catch (err) {
      console.error("Error loading settings:", err)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setSaveMessage(null)

    try {
      if (selectedCompanyId === "global") {
        // Save to system_settings
        const { error } = await supabase.from("system_settings").upsert([
          { key: "primary_llm", value: provider },
          { key: "primary_llm_model", value: model },
          { key: "global_llm_api_key", value: apiKey },
          { key: "ollama_host", value: ollamaHost },
          { key: "ollama_api_key", value: apiKey },
        ])
        if (error) throw error
        setSaveMessage({ type: "success", text: "Global settings saved. All companies without overrides will use this." })
      } else {
        // Save to companies table
        const updates: any = {
          llm_provider: provider === 'global' ? null : provider,
          llm_model: model.trim() || null,
        }
        if (apiKey.trim()) updates.llm_api_key = apiKey.trim()
        const { error } = await supabase.from('companies').update(updates).eq('id', parseInt(selectedCompanyId))
        if (error) throw error
        // Refresh company list
        const { data } = await supabase.from('companies').select('id, name, llm_provider, llm_api_key, llm_model').order('name')
        setCompanies(data || [])
        setSaveMessage({ type: "success", text: "Company AI settings saved." })
      }
    } catch (err: any) {
      setSaveMessage({ type: "error", text: err.message || "Failed to save settings." })
    } finally {
      setSaving(false)
    }
  }

  const selectedCompany = selectedCompanyId !== "global"
    ? companies.find(c => String(c.id) === selectedCompanyId)
    : null

  const isCompanyUsingGlobal = selectedCompanyId !== "global" && !selectedCompany?.llm_provider

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-card p-6 rounded-xl border border-border shadow-sm">
        <h2 className="text-2xl font-bold tracking-tight text-foreground">AI Settings</h2>
        <p className="text-muted-foreground mt-1">
          Configure the AI provider for transcript analysis and task extraction.
          {isMaster && " Select a company to override its settings, or configure the global default."}
        </p>
      </div>

      <Card className="border-border max-w-2xl">
        <CardHeader className="bg-muted/30 border-b border-border">
          <CardTitle className="text-lg">LLM Configuration</CardTitle>
          {isMaster && (
            <div className="mt-3">
              <label className="block text-sm font-medium text-foreground mb-2">Configure settings for</label>
              <select
                value={selectedCompanyId}
                onChange={e => { setSelectedCompanyId(e.target.value); setSaveMessage(null) }}
                disabled={loadingCompanies}
                className="w-full h-10 px-3 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="global">⚙️ Global (System Default)</option>
                {companies.map(c => (
                  <option key={c.id} value={String(c.id)}>
                    🏛️ {c.name}{c.llm_provider ? ` — ${c.llm_provider}` : ' — inherits global'}
                  </option>
                ))}
              </select>
              {selectedCompanyId !== "global" && (
                <p className="text-xs text-muted-foreground mt-1.5">
                  {isCompanyUsingGlobal
                    ? "This company currently inherits the global setting. Set a provider below to override it."
                    : `This company uses its own AI configuration.`}
                </p>
              )}
            </div>
          )}
          <CardDescription className="mt-2">
            {selectedCompanyId === "global"
              ? "System-wide default — applies to all companies that don't have their own override."
              : `Override AI settings for ${selectedCompany?.name || '...'} only.`}
          </CardDescription>
        </CardHeader>

        <CardContent className="p-6">
          {loading ? (
            <div className="animate-pulse space-y-4">
              <div className="h-10 bg-muted rounded w-full" />
              <div className="h-10 bg-muted rounded w-full" />
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">AI Provider</label>
                <select
                  value={provider}
                  onChange={e => {
                    const p = e.target.value
                    setProvider(p)
                    setModel(p !== 'global' ? (PROVIDER_DEFAULTS[p] || '') : '')
                  }}
                  className="w-full h-10 px-3 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {selectedCompanyId !== "global" && (
                    <option value="global">Use global default</option>
                  )}
                  <option value="ollama">Ollama (local server)</option>
                  <option value="gemini">Google Gemini</option>
                  <option value="openai">OpenAI</option>
                </select>
              </div>

              {provider === 'global' ? (
                <p className="text-sm text-muted-foreground bg-muted/30 px-4 py-3 rounded-lg border border-border">
                  This company will use whatever the global system default is configured as.
                </p>
              ) : provider === 'ollama' ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">Ollama Host URL</label>
                      <input type="text" value={ollamaHost} onChange={e => setOllamaHost(e.target.value)}
                        placeholder="http://38.49.216.119:11434"
                        className="w-full h-10 px-3 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">Model Name</label>
                      <input type="text" value={model} onChange={e => setModel(e.target.value)}
                        placeholder="llama3.2"
                        className="w-full h-10 px-3 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">API Key / Token (optional)</label>
                    <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)}
                      placeholder="Leave blank if no auth required"
                      className="w-full h-10 px-3 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      {provider === 'openai' ? 'OpenAI' : 'Gemini'} API Key
                      {selectedCompanyId !== "global" && <span className="text-muted-foreground font-normal"> (leave blank to keep existing)</span>}
                    </label>
                    <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)}
                      placeholder={selectedCompanyId !== "global" ? "Leave blank to keep existing key" : `Enter ${provider === 'openai' ? 'OpenAI' : 'Gemini'} API key`}
                      className="w-full h-10 px-3 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">Model Name</label>
                    <input type="text" value={model} onChange={e => setModel(e.target.value)}
                      placeholder={provider === 'openai' ? 'gpt-4o-mini' : 'gemini-2.5-flash'}
                      className="w-full h-10 px-3 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>

        <CardFooter className="bg-muted/10 border-t border-border flex items-center justify-between p-6">
          <div className="flex-1">
            {saveMessage && (
              <span className={`text-sm ${saveMessage.type === "error" ? "text-red-500" : "text-green-500"}`}>
                {saveMessage.text}
              </span>
            )}
          </div>
          <Button onClick={handleSave} disabled={loading || saving} className="bg-primary text-primary-foreground ml-4">
            {saving ? "Saving..." : "Save Configuration"}
          </Button>
        </CardFooter>
      </Card>

      {/* Quick overview of all companies — master only */}
      {isMaster && companies.length > 0 && (
        <Card className="border-border max-w-2xl">
          <CardHeader className="bg-muted/30 border-b border-border py-3 px-4">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">All Companies Overview</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="border-b border-border">
                <tr className="text-left">
                  <th className="px-4 py-2.5 text-xs font-semibold text-muted-foreground">Company</th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-muted-foreground">Provider</th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-muted-foreground">Model</th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-muted-foreground">Key</th>
                </tr>
              </thead>
              <tbody>
                {companies.map(company => (
                  <tr
                    key={company.id}
                    className={`border-b border-border cursor-pointer transition-colors ${String(company.id) === selectedCompanyId ? 'bg-primary/5' : 'hover:bg-muted/30'}`}
                    onClick={() => setSelectedCompanyId(String(company.id))}
                  >
                    <td className="px-4 py-2.5 font-medium text-sm">{company.name}</td>
                    <td className="px-4 py-2.5">
                      {company.llm_provider ? (
                        <Badge variant="secondary" className={`text-[10px] uppercase font-bold ${
                          company.llm_provider === 'gemini' ? 'bg-blue-50 text-blue-700' :
                          company.llm_provider === 'openai' ? 'bg-green-50 text-green-700' :
                          'bg-orange-50 text-orange-700'
                        }`}>{company.llm_provider}</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">Global</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground font-mono">{company.llm_model || '—'}</td>
                    <td className="px-4 py-2.5">
                      {company.llm_api_key
                        ? <span className="text-xs text-green-600 font-medium">✓ Set</span>
                        : <span className="text-xs text-muted-foreground">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

