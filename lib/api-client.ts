/**
 * Meeting Genius API Client
 * 
 * This library provides a structured, versioned interface for all API calls,
 * replacing direct Supabase database queries in frontend components.
 */

import { User } from './supabase'

const BASE_URL = '/api'

interface ApiResponse<T> {
  data?: T
  error?: string
  success: boolean
}

async function fetchApi<T>(
  endpoint: string,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE' = 'GET',
  body?: any,
  headers: Record<string, string> = {}
): Promise<T> {
  const response = await fetch(`${BASE_URL}${endpoint}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.NEXT_PUBLIC_API_KEY || '',
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
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
      list: async (filters?: { company_id?: number; manager_id?: number; building_ids?: number[] }): Promise<any[]> => {
        let url = '/v1/buildings'
        const params = new URLSearchParams()
        if (filters?.company_id) params.append('company_id', String(filters.company_id))
        if (filters?.manager_id) params.append('manager_id', String(filters.manager_id))
        if (filters?.building_ids) params.append('building_ids', filters.building_ids.join(','))
        
        const queryString = params.toString()
        if (queryString) url += `?${queryString}`
        
        const response = await fetchApi<{ data: any[] }>(url)
        return response.data
      },
      get: async (id: number): Promise<any> => {
        const response = await fetchApi<{ data: any }>(`/v1/buildings/${id}`)
        return response.data
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
      getLogo: async (companyId: number): Promise<string | null> => {
        const response = await fetchApi<{ logo_url: string | null }>(`/v1/companies/${companyId}/logo`)
        return response.logo_url
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
    }
  }
}
