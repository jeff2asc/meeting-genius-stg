import { createClient as createSupabaseClient } from '@supabase/supabase-js'


const supabaseUrl = 'https://iehrlogqpsebhubbafxo.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImllaHJsb2dxcHNlYmh1YmJhZnhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA4OTMzNjIsImV4cCI6MjA3NjQ2OTM2Mn0.f00dmQAb0jNDni5hB_8seuHJwz_S3skkepmc_fIrEOk'


export const supabase = createSupabaseClient(supabaseUrl, supabaseAnonKey)

// ⭐ NEW: Export createClient function for API routes
export function createClient() {
  return supabase
}


// Company interface -- updated to include new fields
export interface Company {
  id: number
  name: string
  created_at: string
  updated_at: string
  default_meeting_sections?: string[]
  default_meeting_types?: string[]
  // ⭐ SMTP fields added
  smtp_host?: string | null
  smtp_port?: number | null
  smtp_user?: string | null
  smtp_password?: string | null
  smtp_from_name?: string | null
  smtp_from_email?: string | null
  smtp_use_tls?: boolean | null
  // ⭐ NEW: Company logo
  logo_url?: string | null
}


// User interface - with all 7 user types + company_id (added 'owner')
export interface User {
  id: number
  name: string
  email: string
  user_type: 'master' | 'property_manager' | 'user' | 'vendor' | 'attendee' | 'corporate_administrator' | 'owner'
  company_id?: number | null
}


// ⭐ TaskAttachment interface
export interface TaskAttachment {
  id: number
  task_id: number
  filename: string
  file_url: string
  file_size: number
  mime_type: string
  uploaded_by: number | null
  created_at: string
  updated_at: string
}


// ⭐ TopicAttachment interface
export interface TopicAttachment {
  id: number
  topic_id: number
  filename: string
  file_url: string
  file_size: number
  mime_type: string
  uploaded_by: number | null
  created_at: string
  updated_at: string
}


// ⭐ TaskAnalysis interface
export interface TaskAnalysis {
  id: number
  task_id: number
  task_description: string
  analysis_result: string
  created_at: string
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


// ⭐ NEW: Get Supabase authenticated user (for file uploads)
export async function getSupabaseUser() {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) {
    console.error('Error getting authenticated user:', error)
    return null
  }
  return user
}


// Database type -- updated for companies table fields
export type Database = {
  public: {
    Tables: {
      companies: {
        Row: {
          id: number
          name: string
          created_at: string
          updated_at: string
          default_meeting_sections: string[] | null
          default_meeting_types: string[] | null
          // ⭐ SMTP fields added
          smtp_host: string | null
          smtp_port: number | null
          smtp_user: string | null
          smtp_password: string | null
          smtp_from_name: string | null
          smtp_from_email: string | null
          smtp_use_tls: boolean | null
          // ⭐ NEW: Company logo
          logo_url: string | null
        }
        Insert: {
          name: string
          default_meeting_sections?: string[] | null
          default_meeting_types?: string[] | null
          // ⭐ SMTP fields optional on insert
          smtp_host?: string | null
          smtp_port?: number | null
          smtp_user?: string | null
          smtp_password?: string | null
          smtp_from_name?: string | null
          smtp_from_email?: string | null
          smtp_use_tls?: boolean | null
          // ⭐ NEW: Company logo optional on insert
          logo_url?: string | null
        }
      }
      users: {
        Row: {
          id: number
          name: string
          email: string
          password_hash: string
          user_type: 'master' | 'property_manager' | 'user' | 'vendor' | 'attendee' | 'corporate_administrator' | 'owner'
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
          // ⭐ NEW: In-camera fields
          is_incamera: boolean
          incamera_start_time: string | null
          incamera_end_time: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          meeting_id: number
          section_id?: number | null
          title: string
          description?: string | null
          order_index?: number
          // ⭐ NEW: In-camera fields optional on insert
          is_incamera?: boolean
          incamera_start_time?: string | null
          incamera_end_time?: string | null
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
          assignees: any | null
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
          assignees?: any | null
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
          votes_abstain: number | null  // ⭐ NEW
          parent_decision_id: number | null  // ⭐ NEW - for threading
          recorded_by: number | null
          recorded_at: string
          edited_at: string | null  // ⭐ NEW - for edit tracking
        }
        Insert: {
          topic_id: number
          motion_text: string
          result?: 'moved' | 'seconded' | 'carried' | 'defeated' | 'deferred' | null
          votes_for?: number | null
          votes_against?: number | null
          votes_abstain?: number | null  // ⭐ NEW
          parent_decision_id?: number | null  // ⭐ NEW
          recorded_by?: number | null
          edited_at?: string | null  // ⭐ NEW
        }
      }
      // ⭐ task_attachments table
      task_attachments: {
        Row: {
          id: number
          task_id: number
          filename: string
          file_url: string
          file_size: number
          mime_type: string
          uploaded_by: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          task_id: number
          filename: string
          file_url: string
          file_size: number
          mime_type: string
          uploaded_by?: number | null
        }
      }
      // ⭐ topic_attachments table
      topic_attachments: {
        Row: {
          id: number
          topic_id: number
          filename: string
          file_url: string
          file_size: number
          mime_type: string
          uploaded_by: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          topic_id: number
          filename: string
          file_url: string
          file_size: number
          mime_type: string
          uploaded_by?: number | null
        }
      }
      // ⭐ task_analyses table
      task_analyses: {
        Row: {
          id: number
          task_id: number
          task_description: string
          analysis_result: string
          created_at: string
        }
        Insert: {
          task_id: number
          task_description: string
          analysis_result: string
        }
      }
    }
  }
}


// ============================================
// ROLLOVER HELPER FUNCTIONS
// ============================================


/**
 * Get the most recent finalized meeting of the same type for a building
 */
export async function getPreviousMeetingOfSameType(
  buildingId: number,
  meetingType: string
) {
  const { data, error } = await supabase
    .from('meetings')
    .select('id, title, meeting_date, attendees')
    .eq('building_id', buildingId)
    .eq('meeting_type', meetingType)
    .eq('status', 'minutes') // Only finalized meetings
    .order('meeting_date', { ascending: false })
    .limit(1)
    .single()


  if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
    console.error('Error fetching previous meeting:', error)
    return null
  }


  return data
}


/**
 * Get all sections from a meeting
 */
export async function getSectionsFromMeeting(meetingId: number) {
  const { data, error } = await supabase
    .from('sections')
    .select('*')
    .eq('meeting_id', meetingId)
    .order('order_index')


  if (error) {
    console.error('Error fetching sections:', error)
    return []
  }


  return data || []
}


/**
 * Get all topics from a meeting
 */
export async function getTopicsFromMeeting(meetingId: number) {
  const { data, error } = await supabase
    .from('topics')
    .select('*')
    .eq('meeting_id', meetingId)
    .order('order_index')


  if (error) {
    console.error('Error fetching topics:', error)
    return []
  }


  return data || []
}


/**
 * Get all open tasks from a meeting (via topics)
 */
export async function getOpenTasksFromMeeting(meetingId: number) {
  // First get all topic IDs from the meeting
  const { data: topics, error: topicsError } = await supabase
    .from('topics')
    .select('id')
    .eq('meeting_id', meetingId)


  if (topicsError || !topics || topics.length === 0) {
    return []
  }


  const topicIds = topics.map(t => t.id)


  // Then get open tasks from those topics
  const { data: tasks, error: tasksError } = await supabase
    .from('tasks')
    .select('*')
    .in('topic_id', topicIds)
    .in('status', ['open', 'in_progress']) // Only incomplete tasks


  if (tasksError) {
    console.error('Error fetching open tasks:', tasksError)
    return []
  }


  return tasks || []
}


/**
 * Get company default sections
 */
export async function getCompanyDefaultSections(companyId: number) {
  const { data, error } = await supabase
    .from('companies')
    .select('default_meeting_sections')
    .eq('id', companyId)
    .single()


  if (error) {
    console.error('Error fetching company defaults:', error)
    return null
  }


  return data?.default_meeting_sections || null
}
