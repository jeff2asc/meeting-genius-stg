"use client"

import { useState } from "react"
import { FileText, Download, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/supabase"

interface GenerateMinutesButtonProps {
  meetingId: string
  buildingId: number
}

interface TemplateField {
  id: string
  label: string
  visible: boolean
  order: number
}

interface TemplateSection {
  id: string
  label: string
  icon: string
  backgroundColor: string
  fields: TemplateField[]
}

interface TemplateConfig {
  sections: TemplateSection[]
}

export default function GenerateMinutesButton({ meetingId, buildingId }: GenerateMinutesButtonProps) {
  const [generating, setGenerating] = useState(false)

  const handleGenerateMinutes = async () => {
    setGenerating(true)
    try {
      // Step 1: Fetch template
      const { data: templateData, error: templateError } = await supabase
        .from('minutes_templates')
        .select('blocks')
        .eq('building_id', buildingId)
        .single()

      if (templateError && templateError.code !== 'PGRST116') {
        console.error('Error fetching template:', templateError)
        alert('Failed to load template')
        setGenerating(false)
        return
      }

      const template: TemplateConfig = templateData?.blocks || getDefaultTemplate()

      // Step 2: Fetch meeting data
      const { data: meeting, error: meetingError } = await supabase
        .from('meetings')
        .select(`
          *,
          buildings(name, address)
        `)
        .eq('id', meetingId)
        .single()

      if (meetingError || !meeting) {
        console.error('Error fetching meeting:', meetingError)
        alert('Failed to load meeting data')
        setGenerating(false)
        return
      }

      // Step 3: Fetch sections and topics
      const { data: sections, error: sectionsError } = await supabase
        .from('sections')
        .select(`
          *,
          topics(
            *,
            notes(*),
            tasks(*),
            decisions(*)
          )
        `)
        .eq('meeting_id', meetingId)
        .order('order_index')

      if (sectionsError) {
        console.error('Error fetching sections:', sectionsError)
        alert('Failed to load sections')
        setGenerating(false)
        return
      }

      // Step 4: Generate HTML
      const minutesHtml = generateMinutesHtml(template, meeting, sections || [])

      // Step 5: Open in new window for printing
      const printWindow = window.open('', '_blank')
      if (printWindow) {
        printWindow.document.write(minutesHtml)
        printWindow.document.close()
        printWindow.focus()
        
        // Auto-trigger print dialog after a short delay
        setTimeout(() => {
          printWindow.print()
        }, 500)
      }

    } catch (err) {
      console.error('Error generating minutes:', err)
      alert('Failed to generate minutes')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <Button
      onClick={handleGenerateMinutes}
      disabled={generating}
      className="bg-gradient-to-r from-primary to-decision-purple text-white"
    >
      {generating ? (
        <>
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          Generating...
        </>
      ) : (
        <>
          <FileText className="h-4 w-4 mr-2" />
          Generate Minutes PDF
        </>
      )}
    </Button>
  )
}

// Default template if none exists
function getDefaultTemplate(): TemplateConfig {
  return {
    sections: [
      {
        id: "header",
        label: "Header",
        icon: "📋",
        backgroundColor: "#f8fafc",
        fields: [
          { id: "building_name", label: "Building Name", visible: true, order: 1 },
          { id: "meeting_type", label: "Meeting Type", visible: true, order: 2 },
          { id: "meeting_date", label: "Meeting Date", visible: true, order: 3 },
          { id: "start_time", label: "Start Time", visible: true, order: 4 },
          { id: "location", label: "Location", visible: true, order: 5 },
          { id: "strata_plan", label: "Strata Plan Number", visible: true, order: 6 }
        ]
      },
      {
        id: "attendees",
        label: "Attendees",
        icon: "👥",
        backgroundColor: "#ffffff",
        fields: [
          { id: "present", label: "Present", visible: true, order: 1 },
          { id: "absent", label: "Absent", visible: true, order: 2 },
          { id: "regrets", label: "Regrets", visible: true, order: 3 }
        ]
      },
      {
        id: "topics",
        label: "Topics & Notes",
        icon: "📝",
        backgroundColor: "#ffffff",
        fields: []
      },
      {
        id: "decisions",
        label: "Decisions & Votes",
        icon: "⚖️",
        backgroundColor: "#ffffff",
        fields: []
      },
      {
        id: "footer",
        label: "Footer",
        icon: "✍️",
        backgroundColor: "#f8fafc",
        fields: [
          { id: "adjournment", label: "Meeting Adjourned", visible: true, order: 1 },
          { id: "next_meeting", label: "Next Meeting Date", visible: true, order: 2 },
          { id: "prepared_by", label: "Minutes Prepared By", visible: true, order: 3 },
          { id: "signatures", label: "Signatures", visible: true, order: 4 }
        ]
      }
    ]
  }
}

// Generate HTML for minutes
function generateMinutesHtml(template: TemplateConfig, meeting: any, sections: any[]): string {
  const building = meeting.buildings

  let html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>${meeting.title} - Minutes</title>
      <style>
        @media print {
          @page { margin: 0.5in; }
          body { margin: 0; }
        }
        body {
          font-family: Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 8.5in;
          margin: 0 auto;
          padding: 20px;
        }
        .section {
          margin-bottom: 30px;
          page-break-inside: avoid;
        }
        .section-header {
          padding: 12px;
          margin-bottom: 15px;
          border-radius: 4px;
          font-weight: bold;
          font-size: 18px;
        }
        .field-row {
          display: flex;
          margin-bottom: 8px;
        }
        .field-label {
          font-weight: bold;
          width: 180px;
          flex-shrink: 0;
        }
        .field-value {
          flex: 1;
        }
        .topic {
          margin-bottom: 25px;
          padding: 15px;
          border: 1px solid #ddd;
          border-radius: 4px;
          background: #fafafa;
        }
        .topic-title {
          font-weight: bold;
          font-size: 16px;
          margin-bottom: 10px;
          color: #1a1a1a;
        }
        .topic-description {
          margin-bottom: 15px;
          color: #555;
        }
        .note, .task, .decision {
          margin: 10px 0;
          padding: 10px;
          border-left: 4px solid;
          background: #fff;
        }
        .note { border-color: #3b82f6; }
        .task { border-color: #10b981; }
        .decision { border-color: #8b5cf6; }
        .attendee-table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 10px;
        }
        .attendee-table th, .attendee-table td {
          border: 1px solid #ddd;
          padding: 8px;
          text-align: left;
        }
        .attendee-table th {
          background-color: #f3f4f6;
          font-weight: bold;
        }
        h1 {
          text-align: center;
          color: #1a1a1a;
          border-bottom: 2px solid #333;
          padding-bottom: 10px;
          margin-bottom: 30px;
        }
      </style>
    </head>
    <body>
      <h1>${meeting.title}</h1>
  `

  // Render sections according to template
  template.sections.forEach(templateSection => {
    if (templateSection.id === 'header') {
      html += renderHeader(templateSection, meeting, building)
    } else if (templateSection.id === 'attendees') {
      html += renderAttendees(templateSection, meeting.attendees || [])
    } else if (templateSection.id === 'topics') {
      html += renderTopics(sections)
    } else if (templateSection.id === 'decisions') {
      // Decisions are rendered within topics
    } else if (templateSection.id === 'footer') {
      html += renderFooter(templateSection, meeting)
    }
  })

  html += `
    </body>
    </html>
  `

  return html
}

function renderHeader(section: TemplateSection, meeting: any, building: any): string {
  const visibleFields = section.fields.filter(f => f.visible).sort((a, b) => a.order - b.order)
  
  let html = `<div class="section">
    <div class="section-header" style="background-color: ${section.backgroundColor}">
      ${section.icon} ${section.label}
    </div>`

  visibleFields.forEach(field => {
    let value = ''
    switch (field.id) {
      case 'building_name':
        value = building?.name || 'N/A'
        break
      case 'meeting_type':
        value = meeting.meeting_type || 'N/A'
        break
      case 'meeting_date':
        value = meeting.meeting_date ? new Date(meeting.meeting_date + 'T00:00:00Z').toLocaleDateString('en-US', { 
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric',
          timeZone: 'UTC'
        }) : 'N/A'
        break
      case 'start_time':
        value = meeting.start_time || 'N/A'
        break
      case 'location':
        value = meeting.location || 'N/A'
        break
      case 'strata_plan':
        value = meeting.strata_plan_number || 'N/A'
        break
    }

    html += `
      <div class="field-row">
        <div class="field-label">${field.label}:</div>
        <div class="field-value">${value}</div>
      </div>`
  })

  html += `</div>`
  return html
}

function renderAttendees(section: TemplateSection, attendees: any[]): string {
  const present = attendees.filter(a => a.present)
  const absent = attendees.filter(a => !a.present)

  let html = `<div class="section">
    <div class="section-header" style="background-color: ${section.backgroundColor}">
      ${section.icon} ${section.label}
    </div>
    <table class="attendee-table">
      <thead>
        <tr>
          <th>Name</th>
          <th>Role</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>`

  attendees.forEach(attendee => {
    html += `
      <tr>
        <td>${attendee.name}</td>
        <td>${attendee.role || '-'}</td>
        <td>${attendee.present ? '✓ Present' : '✗ Absent'}</td>
      </tr>`
  })

  html += `
      </tbody>
    </table>
  </div>`

  return html
}

function renderTopics(sections: any[]): string {
  let html = `<div class="section">
    <div class="section-header" style="background-color: #ffffff">
      📝 Topics & Discussion
    </div>`

  sections.forEach((section, sIdx) => {
    html += `<h3>${sIdx + 1}. ${section.title}</h3>`

    if (section.topics && section.topics.length > 0) {
      section.topics.forEach((topic: any, tIdx: number) => {
        html += `
          <div class="topic">
            <div class="topic-title">${sIdx + 1}.${tIdx + 1} ${topic.title}</div>`

        if (topic.description) {
          html += `<div class="topic-description">${topic.description}</div>`
        }

        // Notes
        if (topic.notes && topic.notes.length > 0) {
          topic.notes.forEach((note: any) => {
            html += `<div class="note"><strong>📝 Note:</strong> ${note.content}</div>`
          })
        }

        // Tasks
        if (topic.tasks && topic.tasks.length > 0) {
          topic.tasks.forEach((task: any) => {
            const assignee = task.assigned_name || task.assigned_email || 'Unassigned'
            const dueDate = task.due_date ? ` (Due: ${new Date(task.due_date).toLocaleDateString()})` : ''
            html += `<div class="task"><strong>✓ Task:</strong> ${task.description} - Assigned to: ${assignee}${dueDate}</div>`
          })
        }

        // Decisions
        if (topic.decisions && topic.decisions.length > 0) {
          topic.decisions.forEach((decision: any) => {
            const votes = decision.votes_for !== null ? ` (For: ${decision.votes_for || 0}, Against: ${decision.votes_against || 0}, Abstain: ${decision.votes_abstain || 0})` : ''
            html += `<div class="decision"><strong>⚖️ Decision:</strong> ${decision.motion_text} - <strong>Result:</strong> ${decision.result}${votes}</div>`
          })
        }

        html += `</div>`
      })
    }
  })

  html += `</div>`
  return html
}

function renderFooter(section: TemplateSection, meeting: any): string {
  let html = `<div class="section">
    <div class="section-header" style="background-color: ${section.backgroundColor}">
      ${section.icon} ${section.label}
    </div>
    <div class="field-row">
      <div class="field-label">Meeting Adjourned:</div>
      <div class="field-value">_______________________</div>
    </div>
    <div class="field-row">
      <div class="field-label">Minutes Prepared By:</div>
      <div class="field-value">_______________________</div>
    </div>
    <div class="field-row">
      <div class="field-label">Signature:</div>
      <div class="field-value">_______________________</div>
    </div>
    <div class="field-row">
      <div class="field-label">Date:</div>
      <div class="field-value">_______________________</div>
    </div>
  </div>`

  return html
}
