"use client"

import { useState } from "react"
import { FileText, Download, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/supabase"
import jsPDF from "jspdf"
import html2canvas from "html2canvas"

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
      // Step 1: Fetch template with proper headers
      const { data: templateData, error: templateError } = await supabase
        .from('minutes_templates')
        .select('*')
        .eq('building_id', buildingId)
        .maybeSingle()

      if (templateError) {
        console.error('Error fetching template:', templateError)
      }

      const template: TemplateConfig = templateData?.blocks?.sections 
        ? templateData.blocks 
        : getDefaultTemplate()

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

      // Step 5: Create a temporary div to render HTML
      const tempDiv = document.createElement('div')
      tempDiv.innerHTML = minutesHtml
      tempDiv.style.position = 'absolute'
      tempDiv.style.left = '-9999px'
      tempDiv.style.width = '816px' // 8.5 inches at 96 DPI
      tempDiv.style.padding = '20px'
      tempDiv.style.backgroundColor = '#ffffff'
      document.body.appendChild(tempDiv)

      // Wait for fonts and images to load
      await new Promise(resolve => setTimeout(resolve, 500))

      // Step 6: Convert HTML to Canvas
      const canvas = await html2canvas(tempDiv, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: 816,
        windowHeight: tempDiv.scrollHeight
      })

      // Step 7: Remove temporary div
      document.body.removeChild(tempDiv)

      // Step 8: Create PDF
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'px',
        format: [816, 1056] // Letter size at 96 DPI
      })

      const imgData = canvas.toDataURL('image/png')
      const imgWidth = 816
      const pageHeight = 1056
      const imgHeight = canvas.height
      let heightLeft = imgHeight
      let position = 0

      // Add first page
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
      heightLeft -= pageHeight

      // Add additional pages if needed
      while (heightLeft > 0) {
        position = heightLeft - imgHeight
        pdf.addPage()
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
        heightLeft -= pageHeight
      }

      // Step 9: Download PDF
      const fileName = `${meeting.title.replace(/[^a-z0-9]/gi, '_')}_Minutes_${new Date().toISOString().split('T')[0]}.pdf`
      pdf.save(fileName)

      alert('✅ Minutes PDF downloaded successfully!')
    } catch (err) {
      console.error('Error generating minutes:', err)
      alert('Failed to generate PDF. Please try again.')
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
          <Download className="h-4 w-4 mr-2" />
          Download Minutes PDF
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

// Convert any CSS color to hex (fix for oklch issue)
function convertToHex(color: string): string {
  // If already hex, return as is
  if (color.startsWith('#')) return color
  
  // Common color name mappings
  const colorMap: Record<string, string> = {
    'white': '#ffffff',
    'black': '#000000',
    'transparent': '#ffffff'
  }
  
  if (colorMap[color.toLowerCase()]) {
    return colorMap[color.toLowerCase()]
  }
  
  // Default to white if we can't parse
  return '#ffffff'
}

// Generate HTML for minutes
function generateMinutesHtml(template: TemplateConfig, meeting: any, sections: any[]): string {
  const building = meeting.buildings

  let html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
      <h1 style="text-align: center; color: #1a1a1a; border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 30px;">
        ${meeting.title}
      </h1>
  `

  // Render sections according to template
  template.sections.forEach(templateSection => {
    if (templateSection.id === 'header') {
      html += renderHeader(templateSection, meeting, building)
    } else if (templateSection.id === 'attendees') {
      html += renderAttendees(templateSection, meeting.attendees || [])
    } else if (templateSection.id === 'topics') {
      html += renderTopics(sections)
    } else if (templateSection.id === 'footer') {
      html += renderFooter(templateSection, meeting)
    }
  })

  html += `</div>`
  return html
}

function renderHeader(section: TemplateSection, meeting: any, building: any): string {
  const visibleFields = section.fields.filter(f => f.visible).sort((a, b) => a.order - b.order)
  const bgColor = convertToHex(section.backgroundColor)
  
  let html = `
    <div style="margin-bottom: 30px;">
      <div style="padding: 12px; margin-bottom: 15px; border-radius: 4px; font-weight: bold; font-size: 18px; background-color: ${bgColor};">
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
      <div style="display: flex; margin-bottom: 8px;">
        <div style="font-weight: bold; width: 180px;">${field.label}:</div>
        <div style="flex: 1;">${value}</div>
      </div>`
  })

  html += `</div>`
  return html
}

function renderAttendees(section: TemplateSection, attendees: any[]): string {
  const bgColor = convertToHex(section.backgroundColor)

  let html = `
    <div style="margin-bottom: 30px;">
      <div style="padding: 12px; margin-bottom: 15px; border-radius: 4px; font-weight: bold; font-size: 18px; background-color: ${bgColor};">
        ${section.icon} ${section.label}
      </div>
      <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
        <thead>
          <tr>
            <th style="border: 1px solid #ddd; padding: 8px; text-align: left; background-color: #f3f4f6; font-weight: bold;">Name</th>
            <th style="border: 1px solid #ddd; padding: 8px; text-align: left; background-color: #f3f4f6; font-weight: bold;">Role</th>
            <th style="border: 1px solid #ddd; padding: 8px; text-align: left; background-color: #f3f4f6; font-weight: bold;">Status</th>
          </tr>
        </thead>
        <tbody>`

  attendees.forEach(attendee => {
    html += `
      <tr>
        <td style="border: 1px solid #ddd; padding: 8px;">${attendee.name}</td>
        <td style="border: 1px solid #ddd; padding: 8px;">${attendee.role || '-'}</td>
        <td style="border: 1px solid #ddd; padding: 8px;">${attendee.present ? '✓ Present' : '✗ Absent'}</td>
      </tr>`
  })

  html += `
        </tbody>
      </table>
    </div>`

  return html
}

function renderTopics(sections: any[]): string {
  let html = `
    <div style="margin-bottom: 30px;">
      <div style="padding: 12px; margin-bottom: 15px; border-radius: 4px; font-weight: bold; font-size: 18px; background-color: #ffffff;">
        📝 Topics & Discussion
      </div>`

  sections.forEach((section, sIdx) => {
    html += `<h3 style="margin-top: 20px; margin-bottom: 10px;">${sIdx + 1}. ${section.title}</h3>`

    if (section.topics && section.topics.length > 0) {
      section.topics.forEach((topic: any, tIdx: number) => {
        html += `
          <div style="margin-bottom: 25px; padding: 15px; border: 1px solid #ddd; border-radius: 4px; background: #fafafa;">
            <div style="font-weight: bold; font-size: 16px; margin-bottom: 10px; color: #1a1a1a;">
              ${sIdx + 1}.${tIdx + 1} ${topic.title}
            </div>`

        if (topic.description) {
          html += `<div style="margin-bottom: 15px; color: #555;">${topic.description}</div>`
        }

        // Notes
        if (topic.notes && topic.notes.length > 0) {
          topic.notes.forEach((note: any) => {
            html += `<div style="margin: 10px 0; padding: 10px; border-left: 4px solid #3b82f6; background: #fff;"><strong>📝 Note:</strong> ${note.content}</div>`
          })
        }

        // Tasks
        if (topic.tasks && topic.tasks.length > 0) {
          topic.tasks.forEach((task: any) => {
            const assignee = task.assigned_name || task.assigned_email || 'Unassigned'
            const dueDate = task.due_date ? ` (Due: ${new Date(task.due_date).toLocaleDateString()})` : ''
            html += `<div style="margin: 10px 0; padding: 10px; border-left: 4px solid #10b981; background: #fff;"><strong>✓ Task:</strong> ${task.description} - Assigned to: ${assignee}${dueDate}</div>`
          })
        }

        // Decisions
        if (topic.decisions && topic.decisions.length > 0) {
          topic.decisions.forEach((decision: any) => {
            const votes = decision.votes_for !== null ? ` (For: ${decision.votes_for || 0}, Against: ${decision.votes_against || 0}, Abstain: ${decision.votes_abstain || 0})` : ''
            html += `<div style="margin: 10px 0; padding: 10px; border-left: 4px solid #8b5cf6; background: #fff;"><strong>⚖️ Decision:</strong> ${decision.motion_text} - <strong>Result:</strong> ${decision.result}${votes}</div>`
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
  const bgColor = convertToHex(section.backgroundColor)
  
  let html = `
    <div style="margin-bottom: 30px;">
      <div style="padding: 12px; margin-bottom: 15px; border-radius: 4px; font-weight: bold; font-size: 18px; background-color: ${bgColor};">
        ${section.icon} ${section.label}
      </div>
      <div style="display: flex; margin-bottom: 8px;">
        <div style="font-weight: bold; width: 180px;">Meeting Adjourned:</div>
        <div style="flex: 1;">_______________________</div>
      </div>
      <div style="display: flex; margin-bottom: 8px;">
        <div style="font-weight: bold; width: 180px;">Minutes Prepared By:</div>
        <div style="flex: 1;">_______________________</div>
      </div>
      <div style="display: flex; margin-bottom: 8px;">
        <div style="font-weight: bold; width: 180px;">Signature:</div>
        <div style="flex: 1;">_______________________</div>
      </div>
      <div style="display: flex; margin-bottom: 8px;">
        <div style="font-weight: bold; width: 180px;">Date:</div>
        <div style="flex: 1;">_______________________</div>
      </div>
    </div>`

  return html
}
