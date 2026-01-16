"use client"

import { useState } from "react"
import { X, User, Key, Check } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/supabase"

interface ProfileSettingsModalProps {
  user: {
    id: number
    name: string
    email: string
  }
  onClose: () => void
  onUpdate: () => void
}

export default function ProfileSettingsModal({ user, onClose, onUpdate }: ProfileSettingsModalProps) {
  const [activeTab, setActiveTab] = useState<'profile' | 'password'>('profile')
  
  // Profile form
  const [name, setName] = useState(user.name)
  const [savingProfile, setSavingProfile] = useState(false)
  
  // Password form
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)

  const handleSaveProfile = async () => {
    if (!name.trim()) {
      alert('Name is required')
      return
    }

    setSavingProfile(true)
    try {
      const { error } = await supabase
        .from('users')
        .update({ name: name.trim() })
        .eq('id', user.id)

      if (error) {
        console.error('Error updating profile:', error)
        alert('Failed to update profile')
        setSavingProfile(false)
        return
      }

      // Update local storage
      const storedUser = localStorage.getItem('mg_user')
      if (storedUser) {
        const userData = JSON.parse(storedUser)
        userData.name = name.trim()
        localStorage.setItem('mg_user', JSON.stringify(userData))
      }

      alert('Profile updated successfully')
      onUpdate()
    } catch (err) {
      console.error('Unexpected error:', err)
      alert('An unexpected error occurred')
    } finally {
      setSavingProfile(false)
    }
  }

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      alert('All password fields are required')
      return
    }

    if (newPassword !== confirmPassword) {
      alert('New passwords do not match')
      return
    }

    if (newPassword.length < 6) {
      alert('Password must be at least 6 characters')
      return
    }

    setSavingPassword(true)
    try {
      // Verify current password
      const { data: userData, error: verifyError } = await supabase
        .from('users')
        .select('password')
        .eq('id', user.id)
        .single()

      if (verifyError || !userData) {
        alert('Failed to verify current password')
        setSavingPassword(false)
        return
      }

      // In production, you should use proper password hashing (bcrypt, etc.)
      // For now, simple comparison (REPLACE THIS WITH PROPER HASHING)
      if (userData.password !== currentPassword) {
        alert('Current password is incorrect')
        setSavingPassword(false)
        return
      }

      // Update password
      const { error: updateError } = await supabase
        .from('users')
        .update({ password: newPassword })
        .eq('id', user.id)

      if (updateError) {
        console.error('Error updating password:', updateError)
        alert('Failed to update password')
        setSavingPassword(false)
        return
      }

      alert('Password changed successfully')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      console.error('Unexpected error:', err)
      alert('An unexpected error occurred')
    } finally {
      setSavingPassword(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-in fade-in">
      <Card className="w-full max-w-md border-0 rounded-2xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border bg-gradient-to-r from-primary/5 to-decision-purple/5 p-6">
          <h2 className="text-xl font-bold text-foreground">Profile Settings</h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded hover:bg-muted transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border">
          <button
            onClick={() => setActiveTab('profile')}
            className={`flex-1 py-3 px-4 font-medium text-sm transition-colors ${
              activeTab === 'profile'
                ? 'text-primary border-b-2 border-primary bg-primary/5'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            }`}
          >
            <User className="h-4 w-4 inline mr-2" />
            Profile
          </button>
          <button
            onClick={() => setActiveTab('password')}
            className={`flex-1 py-3 px-4 font-medium text-sm transition-colors ${
              activeTab === 'password'
                ? 'text-primary border-b-2 border-primary bg-primary/5'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            }`}
          >
            <Key className="h-4 w-4 inline mr-2" />
            Password
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {activeTab === 'profile' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Full Name *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your name"
                  className="w-full px-3 py-2 bg-background text-foreground rounded border border-border focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={user.email}
                  disabled
                  className="w-full px-3 py-2 bg-muted text-muted-foreground rounded border border-border cursor-not-allowed"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Email cannot be changed
                </p>
              </div>

              <Button
                onClick={handleSaveProfile}
                disabled={savingProfile || name === user.name}
                className="w-full bg-primary hover:bg-primary/90"
              >
                <Check className="h-4 w-4 mr-2" />
                {savingProfile ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          )}

          {activeTab === 'password' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Current Password *
                </label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                  className="w-full px-3 py-2 bg-background text-foreground rounded border border-border focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  New Password *
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  className="w-full px-3 py-2 bg-background text-foreground rounded border border-border focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Minimum 6 characters
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Confirm New Password *
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  className="w-full px-3 py-2 bg-background text-foreground rounded border border-border focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>

              <Button
                onClick={handleChangePassword}
                disabled={savingPassword}
                className="w-full bg-primary hover:bg-primary/90"
              >
                <Key className="h-4 w-4 mr-2" />
                {savingPassword ? 'Changing...' : 'Change Password'}
              </Button>
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}
