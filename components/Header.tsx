"use client"

import { useState } from "react"
import Link from "next/link"
import { User } from "lucide-react"
import { getCurrentUser } from "@/lib/supabase"
import UserNav from "./UserNav"

export default function Header() {
  const currentUser = getCurrentUser()

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between px-4">
        {/* Logo/Brand */}
        <Link href="/" className="flex items-center gap-2">
          <img 
            src="/MG2 logo.png" 
            alt="Meeting Genius" 
            className="h-8 w-8"
          />
          <span className="text-xl font-bold text-foreground">
            Meeting Genius
          </span>
        </Link>

        {/* Right side - User menu */}
        <div className="flex items-center gap-4">
          {currentUser ? (
            <UserNav user={currentUser} />
          ) : (
            <Link href="/login">
              <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90">
                <User className="h-4 w-4" />
                Login
              </button>
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}
