import { useState, useEffect } from "react"
import { supabase, getCurrentUser } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export default function LlmSettingsTab() {
  const [primaryLlm, setPrimaryLlm] = useState<string>("ollama")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  const [globalApiKey, setGlobalApiKey] = useState("")

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from("system_settings")
        .select("key, value")
        .in("key", ["primary_llm", "global_llm_api_key"])

      if (error) {
        if (error.code !== "PGRST116") { // Ignore 'no rows' error since it might not be initialized
           console.error("Error fetching LLM settings:", error)
        }
        return
      }

      if (data) {
        data.forEach(setting => {
           if (setting.key === 'primary_llm') setPrimaryLlm(setting.value);
           if (setting.key === 'global_llm_api_key') setGlobalApiKey(setting.value);
        });
      }
    } catch (err) {
      console.error("Unexpected error fetching settings:", err)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setSaveMessage(null)
    const currentUser = getCurrentUser()
    try {
      const { error } = await supabase
        .from("system_settings")
        .upsert([
          { 
            key: "primary_llm", 
            value: primaryLlm,
            updated_by: currentUser?.id || null 
          },
          {
            key: "global_llm_api_key",
            value: globalApiKey,
            updated_by: currentUser?.id || null
          }
        ])

      if (error) {
        console.error("Error saving LLM settings:", error)
        setSaveMessage({ type: "error", text: "Failed to save settings. Make sure you migrated the database." })
        return
      }

      setSaveMessage({ type: "success", text: "Settings saved successfully! Future LLM requests will use this selection." })
    } catch (err) {
      console.error("Unexpected error saving settings:", err)
      setSaveMessage({ type: "error", text: "An unexpected error occurred." })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-card p-6 rounded-xl border border-border shadow-sm">
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Global LLM Configuration</h2>
        <p className="text-muted-foreground mt-1">Configure which Artificial Intelligence model the system uses for transcript and document processing.</p>
      </div>

      <Card className="border-border max-w-2xl">
        <CardHeader className="bg-muted/30 border-b border-border">
          <CardTitle className="text-lg">Primary AI Provider</CardTitle>
          <CardDescription>Select the default Large Language Model to route tasks to.</CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          {loading ? (
            <div className="animate-pulse space-y-4">
              <div className="h-10 bg-muted rounded w-full"></div>
            </div>
          ) : (
            <div className="space-y-4">
               <div>
                  <label htmlFor="llm_select" className="block text-sm font-medium text-foreground mb-2">
                     Select Provider
                  </label>
                  <select
                     id="llm_select"
                     value={primaryLlm}
                     onChange={(e) => setPrimaryLlm(e.target.value)}
                     className="w-full h-10 px-3 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                     <option value="ollama">Ollama (Llama 3.2 - Local Server)</option>
                     <option value="gemini">Google Gemini (Gemini 2.5 Flash)</option>
                     <option value="openai">OpenAI (GPT-4o Mini)</option>
                  </select>
                  
                  {primaryLlm !== 'ollama' && (
                     <div className="mt-4">
                        <label className="block text-sm font-medium text-foreground mb-2">
                           Global {primaryLlm === 'openai' ? 'OpenAI' : 'Gemini'} API Key
                        </label>
                        <input
                           type="password"
                           value={globalApiKey}
                           onChange={(e) => setGlobalApiKey(e.target.value)}
                           placeholder={`Enter global ${primaryLlm === 'openai' ? 'OpenAI' : 'Gemini'} API Key...`}
                           className="w-full h-10 px-3 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                        <p className="text-xs text-muted-foreground mt-2">
                          This API key acts as the system default. Individual companies can override this in their own Company Details settings. If left blank, the server environment variables will be used.
                        </p>
                     </div>
                  )}

                  <p className="text-xs text-muted-foreground mt-4">
                     Changing this value immediately affects all new meeting transcripts globally. If Ollama fails, the system will automatically fallback to Gemini regardless of this setting.
                  </p>
               </div>
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
           <Button 
              onClick={handleSave} 
              disabled={loading || saving}
              className="bg-primary text-primary-foreground ml-4"
           >
              {saving ? "Saving..." : "Save Configuration"}
           </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
