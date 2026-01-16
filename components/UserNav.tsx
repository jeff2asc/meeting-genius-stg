"use client"

import { useState } from "react"
import { User, Settings, Key, Sparkles, LogOut, ChevronDown } from "lucide-react"
import { useRouter } from "next/navigation"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import ProfileSettingsModal from "./ProfileSettingsModal"
import { supabase } from "@/lib/supabase"

interface UserNavProps {
  user: {
    id: number
    name: string
    email: string
  }
}

export default function UserNav({ user }: UserNavProps) {
  const [showProfileModal, setShowProfileModal] = useState(false)
  const router = useRouter()

  const handleLogout = async () => {
    try {
      // Clear local storage
      localStorage.removeItem('mg_user')
      
      // Optionally update user session in Supabase if you track sessions
      // await supabase.auth.signOut()
      
      alert('Logged out successfully')
      router.push('/login')
    } catch (error) {
      console.error('Error logging out:', error)
      alert('Failed to logout')
    }
  }

  // Get initials for avatar
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="ghost" 
            className="flex items-center gap-2 px-3 py-2 h-auto hover:bg-muted"
          >
            {/* Avatar */}
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold text-sm">
              {getInitials(user.name)}
            </div>
            
            {/* User name (hidden on mobile) */}
            <div className="hidden md:flex flex-col items-start">
              <span className="text-sm font-medium text-foreground">
                {user.name}
              </span>
              <span className="text-xs text-muted-foreground">
                {user.email}
              </span>
            </div>
            
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium leading-none">{user.name}</p>
              <p className="text-xs leading-none text-muted-foreground">
                {user.email}
              </p>
            </div>
          </DropdownMenuLabel>
          
          <DropdownMenuSeparator />
          
          <DropdownMenuItem
            onClick={() => setShowProfileModal(true)}
            className="cursor-pointer"
          >
            <User className="mr-2 h-4 w-4" />
            <span>Profile Settings</span>
          </DropdownMenuItem>
          
          <DropdownMenuItem
            onClick={() => router.push('/genius-words')}
            className="cursor-pointer"
          >
            <Sparkles className="mr-2 h-4 w-4" />
            <span>GeniusWords</span>
          </DropdownMenuItem>
          
          <DropdownMenuSeparator />
          
          <DropdownMenuItem
            onClick={handleLogout}
            className="cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50"
          >
            <LogOut className="mr-2 h-4 w-4" />
            <span>Logout</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Profile Settings Modal */}
      {showProfileModal && (
        <ProfileSettingsModal
          user={user}
          onClose={() => setShowProfileModal(false)}
          onUpdate={() => {
            // Refresh page or update user data
            window.location.reload()
          }}
        />
      )}
    </>
  )
}
