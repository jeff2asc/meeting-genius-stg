"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { login } from "@/lib/auth"
import { CheckCircle, ArrowLeft, Lock, Eye, EyeOff } from "lucide-react"
import ReCAPTCHA from "react-google-recaptcha"

interface LoginFormProps {
  onSuccess: () => void
}

type Mode = "login" | "forgot" | "reset"

export default function LoginForm({ onSuccess }: LoginFormProps) {
  const [mode, setMode] = useState<Mode>("login")

  // Login fields
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")

  // Forgot password fields
  const [forgotEmail, setForgotEmail] = useState("")
  const [forgotSent, setForgotSent] = useState(false)

  // Reset password fields
  const [resetToken, setResetToken] = useState("")
  const [resetEmail, setResetEmail] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [resetDone, setResetDone] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  const captchaRef = useRef<ReCAPTCHA>(null)

  // Check URL for reset token on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const token = params.get("reset_token")
    if (token) {
      setResetToken(token)
      setMode("reset")
    }
  }, [])

  // ── LOGIN ─────────────────────────────────────────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!captchaToken) {
      setError("Please complete the CAPTCHA verification")
      return
    }

    setLoading(true)

    const result = await login(email, password)

    if (result.success && result.user) {
      onSuccess()
    } else {
      setError(result.error || "Login failed")
      // Reset captcha on failure so user must verify again
      captchaRef.current?.reset()
      setCaptchaToken(null)
    }

    setLoading(false)
  }

  // ── FORGOT PASSWORD ───────────────────────────────────────────────────
  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const res = await fetch("/api/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "request", email: forgotEmail }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Something went wrong")
      setForgotSent(true)
    } catch (err: any) {
      setError(err.message)
    }

    setLoading(false)
  }

  // ── RESET PASSWORD ────────────────────────────────────────────────────
  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!resetEmail) {
      setError("Please enter your email for confirmation")
      return
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match")
      return
    }
    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters")
      return
    }

    setLoading(true)

    try {
      const res = await fetch("/api/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reset",
          token: resetToken,
          email: resetEmail,
          newPassword
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Something went wrong")

      // Clear the token from the URL without reloading
      window.history.replaceState({}, document.title, "/")
      setResetDone(true)
    } catch (err: any) {
      setError(err.message)
    }

    setLoading(false)
  }

  // ── SHARED WRAPPER ────────────────────────────────────────────────────
  const wrapper = (children: React.ReactNode) => (
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
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-decision-purple bg-clip-text text-transparent">
            Meeting Genius
          </h1>
        </div>
        {children}
      </Card>
    </div>
  )

  // ── RESET DONE ────────────────────────────────────────────────────────
  if (mode === "reset" && resetDone) {
    return wrapper(
      <div className="text-center space-y-4">
        <CheckCircle className="h-14 w-14 text-green-500 mx-auto" />
        <h2 className="text-xl font-semibold text-foreground">Password Updated!</h2>
        <p className="text-muted-foreground text-sm">
          Your password has been changed successfully. You can now log in with your new password.
        </p>
        <Button className="w-full mt-4" onClick={() => { setMode("login"); setResetDone(false) }}>
          Go to Login
        </Button>
      </div>
    )
  }

  // ── RESET FORM ────────────────────────────────────────────────────────
  if (mode === "reset") {
    return wrapper(
      <>
        <div className="flex items-center gap-2 mb-6">
          <Lock className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Set New Password</h2>
        </div>

        <form onSubmit={handleReset} className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded text-sm">{error}</div>
          )}

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Email for Confirmation</label>
            <input
              type="email"
              value={resetEmail}
              onChange={(e) => setResetEmail(e.target.value)}
              placeholder="you@example.com"
              required
              disabled={loading}
              className="w-full px-4 py-2 bg-background text-foreground rounded border border-border focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">New Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                required
                disabled={loading}
                className="w-full px-4 py-2 bg-background text-foreground rounded border border-border focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Confirm New Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                required
                disabled={loading}
                className="w-full px-4 py-2 bg-background text-foreground rounded border border-border focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-primary to-decision-purple text-primary-foreground hover:opacity-90 py-6 text-lg"
          >
            {loading ? "Saving..." : "Set New Password"}
          </Button>
        </form>
      </>
    )
  }

  // ── FORGOT SENT ───────────────────────────────────────────────────────
  if (mode === "forgot" && forgotSent) {
    return wrapper(
      <div className="text-center space-y-4">
        <CheckCircle className="h-14 w-14 text-green-500 mx-auto" />
        <h2 className="text-xl font-semibold text-foreground">Check Your Email</h2>
        <p className="text-muted-foreground text-sm">
          If <span className="font-medium text-foreground">{forgotEmail}</span> is registered, you'll receive a
          password reset link shortly. The link expires in 1 hour.
        </p>
        <Button
          variant="outline"
          className="w-full mt-4"
          onClick={() => { setMode("login"); setForgotSent(false); setForgotEmail("") }}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Login
        </Button>
      </div>
    )
  }

  // ── FORGOT FORM ───────────────────────────────────────────────────────
  if (mode === "forgot") {
    return wrapper(
      <>
        <button
          onClick={() => { setMode("login"); setError(null) }}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Login
        </button>

        <h2 className="text-lg font-semibold text-foreground mb-1">Forgot Password?</h2>
        <p className="text-muted-foreground text-sm mb-6">
          Enter your email and we'll send you a reset link.
        </p>

        <form onSubmit={handleForgot} className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded text-sm">{error}</div>
          )}

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Email Address</label>
            <input
              type="email"
              value={forgotEmail}
              onChange={(e) => setForgotEmail(e.target.value)}
              placeholder="you@example.com"
              required
              disabled={loading}
              className="w-full px-4 py-2 bg-background text-foreground rounded border border-border focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
            />
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-primary to-decision-purple text-primary-foreground hover:opacity-90 py-6 text-lg"
          >
            {loading ? "Sending..." : "Send Reset Email"}
          </Button>
        </form>
      </>
    )
  }

  // ── LOGIN FORM ────────────────────────────────────────────────────────
  return wrapper(
    <>
      <p className="text-muted-foreground -mt-4 mb-6 text-center text-sm">Sign in to your account</p>

      <form onSubmit={handleLogin} className="space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded text-sm">{error}</div>
        )}

        <div>
          <label className="block text-sm font-medium text-foreground mb-2">Email Address</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            disabled={loading}
            className="w-full px-4 py-2 bg-background text-foreground rounded border border-border focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-2">Password</label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              disabled={loading}
              className="w-full px-4 py-2 bg-background text-foreground rounded border border-border focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50 pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Forgot password link */}
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => { setMode("forgot"); setError(null) }}
            className="text-sm text-primary hover:underline"
          >
            Forgot password?
          </button>
        </div>

        {/* reCAPTCHA Widget */}
        <div className="flex justify-center">
          <ReCAPTCHA
            ref={captchaRef}
            sitekey={process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY!}
            onChange={(token) => setCaptchaToken(token)}
            onExpired={() => setCaptchaToken(null)}
            theme="light"
          />
        </div>

        <Button
          type="submit"
          disabled={loading || !captchaToken}
          className="w-full bg-gradient-to-r from-primary to-decision-purple text-primary-foreground hover:opacity-90 py-6 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Signing in..." : "Sign In"}
        </Button>
      </form>
    </>
  )
}
