"use client"

import { LogOut } from "lucide-react"
import { getImpersonator, stopImpersonation } from "@/lib/impersonation"

interface ImpersonationBannerProps {
  viewingAs: string
}

export default function ImpersonationBanner({ viewingAs }: ImpersonationBannerProps) {
  const impersonator = getImpersonator()

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] bg-amber-500 text-white px-4 py-2 flex items-center justify-between shadow-lg">
      <div className="flex items-center gap-2 text-sm font-medium">
        <span className="text-lg">👁️</span>
        <span>
          You ({impersonator?.name}) are viewing as <strong>{viewingAs}</strong>
        </span>
      </div>
      <button
        onClick={stopImpersonation}
        className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 transition-colors px-3 py-1 rounded-full text-sm font-semibold"
      >
        <LogOut className="h-3.5 w-3.5" />
        Return to my account
      </button>
    </div>
  )
}
