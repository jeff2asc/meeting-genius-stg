import bcrypt from 'bcryptjs'
import { supabase, setCurrentUser, User } from './supabase'

// Login function
export async function login(email: string, password: string): Promise<{ success: boolean; user?: User; error?: string }> {
  try {
    // Fetch user from database - INCLUDING company_id
    const { data: user, error } = await supabase
      .from('users')
      .select('id, name, email, password_hash, user_type, company_id')
      .eq('email', email.toLowerCase().trim())
      .single()

    if (error || !user) {
      return { success: false, error: 'Invalid email or password' }
    }

    // For now, simple password check (we'll implement bcrypt later)
    // Temporary: just check if password matches "123456"
    const isPasswordValid = password === '123456'

    if (!isPasswordValid) {
      return { success: false, error: 'Invalid email or password' }
    }

    // Create user object - INCLUDING company_id
    const loggedInUser: User = {
      id: user.id,
      name: user.name,
      email: user.email,
      user_type: user.user_type as 'master' | 'property_manager' | 'user' | 'vendor' | 'attendee' | 'corporate_administrator',
      company_id: user.company_id  // ← ADDED THIS!
    }

    console.log('✅ Login successful with company_id:', loggedInUser)

    // Store in localStorage
    setCurrentUser(loggedInUser)

    return { success: true, user: loggedInUser }

  } catch (err) {
    console.error('Login error:', err)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

// Hash password (for future use when we properly implement password hashing)
export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10)
  return bcrypt.hash(password, salt)
}

// Verify password (for future use)
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}