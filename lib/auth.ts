import bcrypt from 'bcryptjs'
import { supabase, setCurrentUser, User } from './supabase'

// Login function
export async function login(
  email: string,
  password: string
): Promise<{ success: boolean; user?: User; error?: string }> {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('id, name, email, password_hash, user_type, company_id, assigned_pm_id, roles')
      .eq('email', email.toLowerCase().trim())
      .single()

    if (error || !user) {
      return { success: false, error: 'Invalid email or password' }
    }

    if (!user.password_hash) {
      return { success: false, error: 'Invalid email or password' }
    }

    const isPasswordValid = await bcrypt.compare(password, user.password_hash)

    if (!isPasswordValid) {
      return { success: false, error: 'Invalid email or password' }
    }

    const loggedInUser: User = {
      id: user.id,
      name: user.name,
      email: user.email,
      user_type: user.user_type as
        | 'master'
        | 'property_manager'
        | 'user'
        | 'vendor'
        | 'attendee'
        | 'corporate_administrator'
        | 'owner',
      company_id: user.company_id,
      assigned_pm_id: user.assigned_pm_id ?? null,
      roles: user.roles ?? [user.user_type],
    }

    console.log('✅ Login successful:', loggedInUser)
    setCurrentUser(loggedInUser)

    return { success: true, user: loggedInUser }
  } catch (err) {
    console.error('Login error:', err)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

// Hash a plain-text password — use this when CREATING users
export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10)
  return bcrypt.hash(password, salt)
}

// Verify a plain-text password against a stored hash
export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash)
}
