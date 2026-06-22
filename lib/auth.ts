import { setCurrentUser, User, UserRole } from './supabase'
import bcrypt from 'bcryptjs'

export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10)
  return bcrypt.hash(password, salt)
}

// Login function — calls server-side API to avoid Mixed Content + RLS issues
export async function login(
  email: string,
  password: string
): Promise<{ success: boolean; user?: User; error?: string }> {
  try {
    const response = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })

    const result = await response.json()

    if (!result.success) {
      return { success: false, error: result.error || 'Invalid email or password' }
    }

    const loggedInUser: User = {
      id: result.user.id,
      name: result.user.name,
      email: result.user.email,
      user_type: result.user.user_type as
        | 'master'
        | 'property_manager'
        | 'user'
        | 'vendor'
        | 'attendee'
        | 'corporate_administrator'
        | 'owner',
      company_id: result.user.company_id,
      assigned_pm_id: result.user.assigned_pm_id ?? null,
      roles: (result.user.roles as UserRole[]) ?? [result.user.user_type as UserRole],
    }

    console.log('✅ Login successful:', loggedInUser)
    setCurrentUser(loggedInUser)

    return { success: true, user: loggedInUser }
  } catch (err) {
    console.error('Login error:', err)
    return { success: false, error: 'An unexpected error occurred' }
  }
}
