import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://iehrlogqpsebhubbafxo.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImllaHJsb2dxcHNlYmh1YmJhZnhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA4OTMzNjIsImV4cCI6MjA3NjQ2OTM2Mn0.f00dmQAb0jNDni5hB_8seuHJwz_S3skkepmc_fIrEOk'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Company interface
export interface Company {
  id: number
  name: string
  created_at: string
  updated_at: string
}

// User interface - with all 6 user types + company_id
export interface User {
  id: number
  name: string
  email: string
  user_type: 'master' | 'property_manager' | 'user' | 'vendor' | 'attendee' | 'corporate_administrator'
  company_id?: number | null
}

// Get current user from localStorage
export function getCurrentUser(): User | null {
  if (typeof window === 'undefined') return null
  
  const userJson = localStorage.getItem('current_user')
  if (!userJson) return null
  
  try {
    return JSON.parse(userJson)
  } catch {
    return null
  }
}

// Set current user in localStorage
export function setCurrentUser(user: User) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('current_user', JSON.stringify(user))
  }
}

// Clear current user (logout)
export function clearCurrentUser() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('current_user')
  }
}

// Check if user is logged in
export function isLoggedIn(): boolean {
  return getCurrentUser() !== null
}

export type Database = {
  public: {
    Tables: {
      companies: {
        Row: {
          id: number
          name: string
          created_at: string
          updated_at: string
        }
        Insert: {
          name: string
        }
      }
      users: {
        Row: {
          id: number
          name: string
          email: string
          password_hash: string
          user_type: 'master' | 'property_manager' | 'user' | 'vendor' | 'attendee' | 'corporate_administrator'
          company_id: number | null
          smtp_config: any
          created_at: string
          updated_at: string
        }
      }
      buildings: {
        Row: {
          id: number
          manager_id: number
          name: string
          address: string | null
          company_id: number | null
          building_type: string
          logo_url: string | null
          header_text: string | null
          footer_text: string | null
          primary_color: string
          agenda_template: string | null
          minutes_template: string | null
          rules_document: any | null
          rules_filename: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          manager_id: number
          name: string
          address?: string | null
          company_id?: number | null
          building_type?: string
          logo_url?: string | null
          header_text?: string | null
          footer_text?: string | null
          primary_color?: string
        }
      }
      meetings: {
        Row: {
          id: number
          building_id: number
          title: string
          meeting_date: string
          location: string | null
          start_time: string | null
          meeting_type: string | null
          strata_plan_number: string | null
          status: 'working_agenda' | 'agenda' | 'working_minutes' | 'minutes'
          audio_file: any | null
          audio_filename: string | null
          audio_duration: number | null
          recording_started_at: string | null
          recording_ended_at: string | null
          attendees: any
          created_at: string
          updated_at: string
          finalized_at: string | null
        }
        Insert: {
          building_id: number
          title: string
          meeting_date: string
          location?: string | null
          start_time?: string | null
          meeting_type?: string | null
          strata_plan_number?: string | null
          status?: 'working_agenda' | 'agenda' | 'working_minutes' | 'minutes'
        }
      }
      sections: {
        Row: {
          id: number
          meeting_id: number
          title: string
          order_index: number
          created_at: string
          updated_at: string
        }
        Insert: {
          meeting_id: number
          title: string
          order_index?: number
        }
      }
      topics: {
        Row: {
          id: number
          meeting_id: number
          section_id: number | null
          title: string
          description: string | null
          order_index: number
          rolled_over_from_topic_id: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          meeting_id: number
          section_id?: number | null
          title: string
          description?: string | null
          order_index?: number
        }
      }
      notes: {
        Row: {
          id: number
          topic_id: number
          content: string
          created_by: number | null
          created_at: string
        }
        Insert: {
          topic_id: number
          content: string
          created_by?: number | null
        }
      }
      tasks: {
        Row: {
          id: number
          topic_id: number
          description: string
          assigned_name: string | null
          assigned_email: string | null
          due_date: string | null
          status: 'open' | 'in_progress' | 'completed'
          external_update_token: string | null
          token_expires_at: string | null
          created_by: number | null
          created_at: string
          updated_at: string
          completed_at: string | null
        }
        Insert: {
          topic_id: number
          description: string
          assigned_name?: string | null
          assigned_email?: string | null
          due_date?: string | null
          status?: 'open' | 'in_progress' | 'completed'
        }
      }
      decisions: {
        Row: {
          id: number
          topic_id: number
          motion_text: string
          result: 'moved' | 'seconded' | 'carried' | 'defeated' | 'deferred' | null
          votes_for: number | null
          votes_against: number | null
          recorded_by: number | null
          recorded_at: string
        }
        Insert: {
          topic_id: number
          motion_text: string
          result?: 'moved' | 'seconded' | 'carried' | 'defeated' | 'deferred' | null
          votes_for?: number | null
          votes_against?: number | null
          recorded_by?: number | null
        }
      }
    }
  }
}