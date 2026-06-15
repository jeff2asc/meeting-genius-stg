/**
 * Meeting Genius API Client
 * 
 * This library provides a structured, versioned interface for all API calls,
 * replacing direct Supabase database queries in frontend components.
 */

import { User, supabase } from './supabase'

const isServer = typeof window === 'undefined'

function getBaseUrl() {
  if (!isServer) return '/api'
  
  // Use environment variables on the server.
  // We prefer 127.0.0.1 over localhost for server-side loopback on Windows/Node18+ 
  // to avoid DNS resolution issues.
  const envUrl = process.env.INTERNAL_APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://[::1]:3000'
  return `${envUrl.replace(/\/$/, '')}/api`
}

interface ApiResponse<T> {
  data?: T
  error?: string
  success: boolean
}

async function fetchApi<T>(
  endpoint: string,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE' = 'GET',
  body?: any,
  headersMap: Record<string, string> = {}
): Promise<T> {
  const baseUrl = getBaseUrl()

  // 1. Resolve Authorization (JWT)
  let authHeader: Record<string, string> = {}
  try {
    if (typeof window !== 'undefined') {
      const { data: { session }, error: sessionErr } = await supabase.auth.getSession()
      if (session?.access_token) {
        authHeader['Authorization'] = `Bearer ${session.access_token}`
      }
    }
  } catch (err) {
    console.warn('[apiClient] Could not get session:', err)
  }

  // 2. Resolve API Key
  const apiKey = isServer 
    ? (process.env.INTERNAL_API_KEY || process.env.NEXT_PUBLIC_API_KEY || '')
    : (process.env.NEXT_PUBLIC_API_KEY || '')
  
  if (apiKey) {
    authHeader['x-api-key'] = apiKey
  }

  console.log(`[apiClient] ${method} ${endpoint}`, { 
    hasAuth: !!authHeader['Authorization'], 
    hasApiKey: !!authHeader['x-api-key'] 
  })

  // 3. Perform Request
  const response = await fetch(`${baseUrl}${endpoint}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...authHeader,
      ...headersMap,
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store'
  })

  const result = await response.json()
  
  if (!response.ok) {
    throw new Error(result.error || `API Request failed with status ${response.status}`)
  }

  return result
}

export const apiClient = {
  v1: {
    buildings: {
      list: async (filters?: { company_id?: number; manager_id?: number; building_ids?: number[]; archived?: boolean }): Promise<any[]> => {
        let url = '/v1/buildings'
        const params = new URLSearchParams()
        if (filters?.company_id) params.append('company_id', String(filters.company_id))
        if (filters?.manager_id) params.append('manager_id', String(filters.manager_id))
        if (filters?.building_ids) params.append('building_ids', filters.building_ids.join(','))
        if (filters?.archived) params.append('archived', 'true')
        
        const queryString = params.toString()
        if (queryString) url += `?${queryString}`
        
        const response = await fetchApi<{ data: any[] }>(url)
        return response.data
      },
      get: async (id: number): Promise<any> => {
        const response = await fetchApi<{ data: any }>(`/v1/buildings/${id}`)
        return response.data
      },
      update: async (id: number, updates: any): Promise<any> => {
        const response = await fetchApi<{ data: any }>(`/v1/buildings/${id}`, 'PATCH', updates)
        return response.data
      },
      archive: async (id: number, archived_by?: string, archive_reason?: string): Promise<any> => {
        const response = await fetchApi<{ data: any }>(`/v1/buildings/${id}/archive`, 'POST', { archived_by, archive_reason })
        return response.data
      },
      unarchive: async (id: number): Promise<any> => {
        const response = await fetchApi<{ data: any }>(`/v1/buildings/${id}/unarchive`, 'POST')
        return response.data
      },
      delete: async (id: number): Promise<void> => {
        await fetchApi(`/v1/buildings/${id}`, 'DELETE')
      },
      addDocumentUrl: async (payload: { building_id: number; document_type: string; url: string; title: string; description?: string | null }): Promise<any> => {
        return await fetchApi('/v1/buildings/document-urls', 'POST', payload)
      },
      deleteDocumentUrl: async (urlId: number): Promise<void> => {
        await fetchApi(`/v1/buildings/document-urls?id=${urlId}`, 'DELETE')
      }
    },
    meetings: {
      get: async (id: string): Promise<any> => {
        const response = await fetchApi<{ data: any }>(`/v1/meetings/${id}`)
        return response.data
      },
      list: async (filters?: { building_id?: number; building_ids?: number[] }): Promise<any[]> => {
        let url = '/v1/meetings'
        const params = new URLSearchParams()
        if (filters?.building_id) params.append('building_id', String(filters.building_id))
        if (filters?.building_ids) params.append('building_ids', filters.building_ids.join(','))
        
        const queryString = params.toString()
        if (queryString) url += `?${queryString}`
        
        const response = await fetchApi<{ data: any[] }>(url)
        return response.data
      },
      delete: async (id: number): Promise<void> => {
        await fetchApi(`/v1/meetings/${id}`, 'DELETE')
      },
      updateStatus: async (id: string, status: string, additionalData?: any): Promise<void> => {
        await fetchApi(`/v1/meetings/${id}/status`, 'PATCH', { status, ...additionalData })
      },
      updateIncamera: async (id: string, is_incamera: boolean): Promise<void> => {
        await fetchApi(`/v1/meetings/${id}`, 'PATCH', { is_incamera })
      }
    },
    sections: {
      list: async (meetingId: string): Promise<any[]> => {
        const response = await fetchApi<{ data: any[] }>(`/v1/meetings/${meetingId}/sections`)
        return response.data
      },
      create: async (meetingId: string | number, sections: { title: string; order_index: number }[]): Promise<any[]> => {
        const response = await fetchApi<{ data: any[] }>(`/v1/meetings/${meetingId}/sections`, 'POST', sections)
        return response.data
      },
      update: async (id: number, title: string): Promise<void> => {
        await fetchApi(`/v1/sections/${id}`, 'PATCH', { title })
      },
      delete: async (id: number): Promise<void> => {
        await fetchApi(`/v1/sections/${id}`, 'DELETE')
      },
      updateOrder: async (sections: { id: number; order_index: number }[]): Promise<void> => {
        await fetchApi(`/v1/sections/reorder`, 'POST', { sections })
      }
    },
    topics: {
      list: async (meetingId: string): Promise<any[]> => {
        const response = await fetchApi<{ data: any[] }>(`/v1/meetings/${meetingId}/topics`)
        return response.data
      },
      update: async (id: number, updates: any): Promise<void> => {
        await fetchApi(`/v1/topics/${id}`, 'PATCH', updates)
      },
      delete: async (id: number): Promise<void> => {
        await fetchApi(`/v1/topics/${id}`, 'DELETE')
      },
      updateOrder: async (topics: { id: number; order_index: number; section_id?: number }[]): Promise<void> => {
        await fetchApi(`/v1/topics/reorder`, 'POST', { topics })
      }
    },
    tasks: {
      list: async (filters?: { building_id?: number; building_ids?: number[] }): Promise<any[]> => {
        let url = '/v1/tasks'
        const params = new URLSearchParams()
        if (filters?.building_id) params.append('building_id', String(filters.building_id))
        if (filters?.building_ids) params.append('building_ids', filters.building_ids.join(','))
        
        const queryString = params.toString()
        if (queryString) url += `?${queryString}`
        
        const response = await fetchApi<{ data: any[] }>(url)
        return response.data
      },
      delete: async (id: number): Promise<void> => {
        await fetchApi(`/v1/tasks/${id}`, 'DELETE')
      }
    },
    companies: {
      list: async (companyId?: number): Promise<any[]> => {
        let url = '/v1/companies'
        if (companyId) url += `?id=${companyId}`
        const response = await fetchApi<{ data: any[] }>(url)
        return response.data
      },
      delete: async (id: number): Promise<void> => {
        await fetchApi(`/v1/companies?id=${id}`, 'DELETE')
      },
      getLogo: async (companyId: number): Promise<string | null> => {
        const response = await fetchApi<{ logo_url: string | null }>(`/v1/companies/${companyId}/logo`)
        return response.logo_url
      },
      update: async (id: number, updates: any): Promise<any> => {
        const response = await fetchApi<{ data: any }>(`/v1/companies/${id}`, 'PATCH', updates)
        return response.data
      },
      createWithUsers: async (companyName: string, users: any[]): Promise<any> => {
        const response = await fetchApi<{ company: any; users: any[] }>(`/v1/companies/create-with-users`, 'POST', {
          companyName,
          users
        })
        return response
      }
    },
    votingParameters: {
      list: async (companyId?: number): Promise<any[]> => {
        let url = '/v1/voting-parameters'
        if (companyId) url += `?company_id=${companyId}`
        const response = await fetchApi<{ data: any[] }>(url)
        return response.data
      },
      insert: async (param: any): Promise<any> => {
        const response = await fetchApi<{ data: any }>('/v1/voting-parameters', 'POST', param)
        return response.data
      },
      upsert: async (param: any): Promise<any> => {
        const response = await fetchApi<{ data: any }>('/v1/voting-parameters', 'POST', { action: 'upsert', ...param })
        return response.data
      },
      countMeetingsForType: async (meetingType: string, companyId?: number | null): Promise<number> => {
        let url = `/v1/voting-parameters?meeting_type_count=${encodeURIComponent(meetingType)}`
        if (companyId != null) url += `&company_id=${companyId}`
        const response = await fetchApi<{ count: number }>(url)
        return response.count ?? 0
      },
      update: async (param: any): Promise<{ data: any; meetingsUpdated?: number; companiesUpdated?: number }> => {
        const response = await fetchApi<{
          data: any
          meetingsUpdated?: number
          companiesUpdated?: number
        }>('/v1/voting-parameters', 'PATCH', param)
        return {
          data: response.data,
          meetingsUpdated: response.meetingsUpdated,
          companiesUpdated: response.companiesUpdated,
        }
      },
      delete: async (id: number): Promise<void> => {
        await fetchApi(`/v1/voting-parameters?id=${id}`, 'DELETE')
      }
    },
    jurisdictionRules: {
      list: async (filters?: { building_type?: string; province_code?: string; voting_type?: string }): Promise<any[]> => {
        let url = '/v1/jurisdiction-rules'
        const params = new URLSearchParams()
        if (filters?.building_type) params.append('building_type', filters.building_type)
        if (filters?.province_code) params.append('province_code', filters.province_code)
        if (filters?.voting_type) params.append('voting_type', filters.voting_type)
        const qs = params.toString()
        if (qs) url += `?${qs}`
        const response = await fetchApi<{ data: any[] }>(url)
        return response.data
      },
      create: async (rule: any): Promise<any> => {
        const response = await fetchApi<{ data: any }>('/v1/jurisdiction-rules', 'POST', rule)
        return response.data
      },
      update: async (id: number, updates: any): Promise<any> => {
        const response = await fetchApi<{ data: any }>('/v1/jurisdiction-rules', 'PATCH', { id, ...updates })
        return response.data
      },
      delete: async (id: number): Promise<void> => {
        await fetchApi(`/v1/jurisdiction-rules?id=${id}`, 'DELETE')
      }
    },
    users: {
      list: async (filters?: { company_id?: number; user_type?: string; id?: number; include_buildings?: boolean; include_null_company?: boolean }): Promise<{ data: any[]; userBuildings?: any[] }> => {
        let url = '/v1/users'
        const params = new URLSearchParams()
        if (filters?.company_id) params.append('company_id', String(filters.company_id))
        if (filters?.user_type) params.append('user_type', filters.user_type)
        if (filters?.id) params.append('id', String(filters.id))
        if (filters?.include_buildings) params.append('include_buildings', 'true')
        if (filters?.include_null_company) params.append('include_null_company', 'true')
        
        const qs = params.toString()
        if (qs) url += `?${qs}`
        return await fetchApi<{ data: any[]; userBuildings?: any[]; success: boolean }>(url)
      },
      create: async (userData: any): Promise<any> => {
        return await fetchApi('/v1/users', 'POST', userData)
      },
      update: async (id: number, updates: any): Promise<any> => {
        return await fetchApi('/v1/users', 'PATCH', { id, ...updates })
      },
      delete: async (id: number): Promise<void> => {
        await fetchApi(`/v1/users?id=${id}`, 'DELETE')
      },
      bulkImport: async (data: {
        users: any[]
        buildingId: number
        buildingType: string
        companyId: number | null
        managerId: number
      }): Promise<any> => {
        return await fetchApi(`/users/bulk-import`, 'POST', data)
      }
    }
  }
}
