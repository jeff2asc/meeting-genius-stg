"use client"

import { useState } from "react"
import { KeyRound, Save, X, Eye, EyeOff } from "lucide-react"
import { Button } from "@/components/ui/button"

interface SetPasswordModalProps {
  targetUser: { id: number; name: string; email: string }
  onClose: () => void
}

export default function SetPasswordModal({ targetUser, onClose }: SetPasswordModalProps) {
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const handleSave = async () => {
    setError("")

    if (!newPassword) {
      setError("Password is required")
      return
    }
    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters")
      return
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match")
      return
    }

    setSaving(true)
    try {
      const res = await fetch("/api/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "admin-set",
          userId: targetUser.id,
          newPassword,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || "Failed to set password")
        return
      }

      alert(`✅ Password updated for ${targetUser.name}`)
      onClose()
    } catch (err) {
      console.error("Unexpected error:", err)
      setError("An unexpected error occurred")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Dialog */}
      <div className="relative z-10 w-full max-w-md mx-4 bg-background rounded-xl shadow-2xl border border-border">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div>
            <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-amber-600" />
              Set Password
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {targetUser.name} &middot; {targetUser.email}
            </p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              New Password <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Min. 6 characters"
                autoFocus
                className="w-full px-3 py-2 pr-10 bg-background text-foreground rounded border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Confirm Password <span className="text-red-500">*</span>
            </label>
            <input
              type={showPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repeat password"
              className="w-full px-3 py-2 bg-background text-foreground rounded border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 pb-6">
          <Button onClick={onClose} variant="outline" className="flex-1" disabled={saving}>
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            className="flex-1 bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:opacity-90"
            disabled={saving}
          >
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Saving..." : "Set Password"}
          </Button>
        </div>
      </div>
    </div>
  )
}
