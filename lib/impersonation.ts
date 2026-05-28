import { User } from './supabase'

const IMPERSONATOR_KEY = 'impersonator_user'
const CURRENT_USER_KEY = 'current_user'

export function startImpersonation(targetUser: User) {
  if (typeof window === 'undefined') return

  // Save the real master session before overwriting
  const current = localStorage.getItem(CURRENT_USER_KEY)
  if (current) {
    localStorage.setItem(IMPERSONATOR_KEY, current)
  }

  localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(targetUser))
  window.location.reload()
}

export function stopImpersonation() {
  if (typeof window === 'undefined') return

  const master = localStorage.getItem(IMPERSONATOR_KEY)
  if (master) {
    localStorage.setItem(CURRENT_USER_KEY, master)
    localStorage.removeItem(IMPERSONATOR_KEY)
  }
  window.location.reload()
}

export function getImpersonator(): User | null {
  if (typeof window === 'undefined') return null
  const raw = localStorage.getItem(IMPERSONATOR_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as User
  } catch {
    return null
  }
}

export function isImpersonating(): boolean {
  if (typeof window === 'undefined') return false
  return !!localStorage.getItem(IMPERSONATOR_KEY)
}
