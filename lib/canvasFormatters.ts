// lib/canvasFormatters.ts
// Shared formatting functions for both Canvas Preview and PDF Generation

interface Attendee {
    name: string
    email?: string
    role?: string
    userid?: number
    present?: boolean
  }
  
  interface Section {
    id: number
    title: string
    order_index: number
  }
  
  interface Topic {
    id: number
    section_id: number | null
    title: string
    description: string | null
    order_index: number
    is_incamera: boolean
  }
  
  // ============== DATE/TIME FORMATTERS ==============
  
  export function formatMeetingDate(dateStr: string): string {
    if (!dateStr) return ""
    // Ensure date is treated as local to avoid UTC shift (e.g. "2026-05-14" -> local midnight)
    const date = dateStr.includes('T') ? new Date(dateStr) : new Date(dateStr + 'T00:00:00')
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }
  
  export function formatMeetingTime(timeStr: string): string {
    return timeStr // Already formatted (e.g., "7:00 PM")
  }
  
  // ============== AGENDA FORMATTERS ==============
  
  export function formatAgendaItems(sections: Section[], topics: Topic[]): string {
    let output = ''
    
    sections.forEach((section, sectionIndex) => {
      const sectionNumber = sectionIndex + 1
      
      // Section header - UPPERCASE
      output += `${sectionNumber}. ${section.title.toUpperCase()}\n`
      output += '_'.repeat(50) + '\n\n'
      
      const sectionTopics = topics.filter(t => t.section_id === section.id)
      
      if (sectionTopics.length === 0) {
        output += '   No items scheduled\n\n'
      } else {
        sectionTopics.forEach((topic, topicIndex) => {
          const topicNumber = `${sectionNumber}.${topicIndex + 1}`
          const incameraTag = topic.is_incamera ? ' [IN-CAMERA]' : ''
          
          // Topic number and title
          output += `   ${topicNumber}  ${topic.title}${incameraTag}\n\n`
          
          // Topic description with indentation
          if (topic.description) {
            // Indent description
            const descLines = topic.description.split('\n')
            descLines.forEach(line => {
              output += `        ${line}\n`
            })
            output += '\n'
          }
        })
      }
      
      // Spacing between sections
      output += '\n'
    })
    
    // Add preview note at the end
    const totalSections = sections.length
    output += `\n[Preview showing ${Math.min(totalSections, 9)} of ${totalSections} sections]`
    
    return output
  }
  
  // ============== ATTENDEES FORMATTERS ==============
  
  export function formatAttendeesList(attendees: Attendee[] | any): string {
    if (!attendees || !Array.isArray(attendees) || attendees.length === 0) {
      return 'No attendees recorded for this meeting.'
    }
    
    let output = ''
    
    // Separate by status
    const presentAttendees = attendees.filter(a => a.present === true)
    const absentAttendees = attendees.filter(a => a.present === false)
    const unknownAttendees = attendees.filter(a => a.present === undefined || a.present === null)
    
    // Header
    output += 'ATTENDEES\n'
    output += '_'.repeat(50) + '\n\n'
    
    // Present
    if (presentAttendees.length > 0) {
      output += 'PRESENT:\n'
      presentAttendees.forEach((attendee, index) => {
        const roleText = attendee.role ? ` - ${attendee.role}` : ''
        output += `   ${index + 1}. ${attendee.name}${roleText}\n`
      })
      output += '\n'
    }
    
    // Absent
    if (absentAttendees.length > 0) {
      output += 'ABSENT:\n'
      absentAttendees.forEach((attendee, index) => {
        const roleText = attendee.role ? ` - ${attendee.role}` : ''
        output += `   ${index + 1}. ${attendee.name}${roleText}\n`
      })
      output += '\n'
    }
    
    // Unknown status
    if (unknownAttendees.length > 0) {
      output += 'STATUS PENDING:\n'
      unknownAttendees.forEach((attendee, index) => {
        const roleText = attendee.role ? ` - ${attendee.role}` : ''
        output += `   ${index + 1}. ${attendee.name}${roleText}\n`
      })
      output += '\n'
    }
    
    // Summary
    output += `\nTotal Attendees: ${attendees.length}\n`
    output += `Quorum: ${presentAttendees.length} present`
    
    return output
  }
  
  // ============== BUILDING INFO FORMATTERS ==============
  
  export function formatBuildingName(buildingName: string): string {
    return buildingName || 'Building Name'
  }
  
  export function formatAddress(address: string): string {
    return address || '123 Main Street, Vancouver, BC'
  }
  
  export function formatStrataPlan(strataPlan: string): string {
    return strataPlan || 'VIS1234'
  }
  
  // ============== AUDIT LOG FORMATTERS ==============
  
  export function formatAuditSummary(logs: any[]): string {
    if (!logs || !Array.isArray(logs) || logs.length === 0) {
      return 'No AI activity recorded in the system audit logs yet.'
    }
    
    let output = 'SYSTEM AUDIT - RECENT AI ACTIVITY\n'
    output += '='.repeat(50) + '\n\n'
    
    // Header for the list
    output += 'STATUS | MODEL | ACTION | DURATION | TIMESTAMP\n'
    output += '-'.repeat(50) + '\n'
    
    logs.slice(0, 20).forEach(log => {
      const statusIcon = log.status === 'success' ? '✓' : '✗'
      const timestamp = new Date(log.created_at).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
      const model = log.model_name || 'Unknown'
      const action = log.action_type || 'Unknown Action'
      const duration = log.duration_ms ? `${log.duration_ms}ms` : '---'
      
      output += `${statusIcon.padEnd(6)} | ${model.padEnd(12)} | ${action.padEnd(20)} | ${duration.padEnd(8)} | ${timestamp}\n`
      
      if (log.error_message) {
        output += `      ERROR: ${log.error_message}\n`
      }
    })
    
    output += '\n' + '='.repeat(50) + '\n'
    output += `Total Events: ${logs.length}`
    
    return output
  }
  