"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Mail, ArrowRight, Loader2 } from "lucide-react"

interface Attendee {
  name: string
  email?: string
  role?: string
  present: boolean
}

interface ExternalAccessLoginProps {
  attendees: Attendee[]
  onSuccess: (attendee: Attendee) => void
}

export default function ExternalAccessLogin({ attendees, onSuccess }: ExternalAccessLoginProps) {
  const [email, setEmail] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const trimmedEmail = email.toLowerCase().trim()
    
    // Find attendee by email
    const attendee = attendees.find(a => a.email?.toLowerCase().trim() === trimmedEmail)

    if (attendee) {
      onSuccess(attendee)
    } else {
      setError("This email address was not found in the attendee list for this meeting.")
    }
    
    setLoading(false)
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 relative"
      style={{
        backgroundImage: "url(/timeisprecious.jpg)",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
      <Card className="w-full max-w-md p-8 shadow-2xl relative z-10 bg-card/95 backdrop-blur-md border-2">
        <div className="text-center mb-8">
          <img src="/MG2 logo.png" alt="Meeting Genius" className="h-12 w-auto mx-auto mb-4" />
          <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-decision-purple bg-clip-text text-transparent">
            Attendee Access
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Enter your email to verify your attendance and access the meeting data.
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded text-sm animate-in fade-in slide-in-from-top-1">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground ml-1">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                disabled={loading}
                className="pl-10 h-12 bg-background/50 border-border focus:ring-primary/20"
              />
            </div>
          </div>

          <Button
            type="submit"
            disabled={loading || !email.trim()}
            className="w-full h-12 bg-gradient-to-r from-primary to-decision-purple text-primary-foreground hover:opacity-90 transition-opacity font-semibold"
          >
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin mx-auto" />
            ) : (
              <span className="flex items-center justify-center gap-2">
                Verify Access <ArrowRight className="h-4 w-4" />
              </span>
            )}
          </Button>

          <p className="text-[10px] text-muted-foreground text-center mt-6">
            Only invited attendees can access this meeting. If you are having trouble, please contact the meeting organizer.
          </p>
        </form>
      </Card>
    </div>
  )
}
