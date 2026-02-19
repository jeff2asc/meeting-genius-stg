import bcrypt from 'bcryptjs'
import { supabase, setCurrentUser, User } from './supabase'

// Login function
export async function login(email: string, password: string): Promise<{ success: boolean; user?: User; error?: string }> {
  try {
    // Fetch user from database
    const { data: user, error } = await supabase
      .from('users')
      .select('id, name, email, password_hash, user_type, company_id')
      .eq('email', email.toLowerCase().trim())
      .single()

    if (error || !user) {
      return { success: false, error: 'Invalid email or password' }
    }

    // ✅ FIXED: Use bcrypt.compare instead of hardcoded password check
    const isPasswordValid = await bcrypt.compare(password, user.password_hash)

    if (!isPasswordValid) {
      return { success: false, error: 'Invalid email or password' }
    }

    // Create user object
    const loggedInUser: User = {
      id: user.id,
      name: user.name,
      email: user.email,
      user_type: user.user_type as 'master' | 'property_manager' | 'user' | 'vendor' | 'attendee' | 'corporate_administrator',
      company_id: user.company_id
    }

    console.log('✅ Login successful:', loggedInUser)

    // Store in localStorage
    setCurrentUser(loggedInUser)

    return { success: true, user: loggedInUser }

  } catch (err) {
    console.error('Login error:', err)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

// Hash password
export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10)
  return bcrypt.hash(password, salt)
}

// Verify password
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}
