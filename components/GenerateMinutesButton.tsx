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
      // Step 1: Fetch template
      const { data: templateData } = await supabase
        .from('minutes_templates')
        .select('*')
        .eq('building_id', buildingId)
        .maybeSingle()

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
        alert('Failed to load meeting data')
        setGenerating(false)
        return
      }

      // Step 3: Fetch sections and topics
      const { data: sections } = await supabase
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

      // Step 4: Generate HTML
      const minutesHtml = generateMinutesHtml(template, meeting, sections || [])

      // Step 5: Create isolated iframe
      const iframe = document.createElement('iframe')
      iframe.style.position = 'absolute'
      iframe.style.left = '-9999px'
      iframe.style.width = '816px'
      iframe.style.height = '1056px'
      document.body.appendChild(iframe)

      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document
      if (!iframeDoc) throw new Error('Cannot access iframe document')

      iframeDoc.open()
      iframeDoc.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
              font-family: Arial, sans-serif; 
              width: 816px; 
              padding: 40px;
              background: white;
            }
          </style>
        </head>
        <body>${minutesHtml}</body>
        </html>
      `)
      iframeDoc.close()

      // Wait for content to render
      await new Promise(resolve => setTimeout(resolve, 1000))

      // Step 6: Capture iframe content
      const canvas = await html2canvas(iframeDoc.body, {
        scale: 2,
        backgroundColor: '#ffffff',
        logging: false,
        width: 816,
        height: iframeDoc.body.scrollHeight
      })

      // Step 7: Remove iframe
      document.body.removeChild(iframe)

      // Step 8: Create PDF
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'px',
        format: [816, 1056]
      })

      const imgData = canvas.toDataURL('image/png', 1.0)
      const imgWidth = 816
      const imgHeight = canvas.height
      const pageHeight = 1056
      let heightLeft = imgHeight
      let position = 0

      // First page
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
      heightLeft -= pageHeight

      // Additional pages
      while (heightLeft > 0) {
        position = heightLeft - imgHeight
        pdf.addPage()
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
        heightLeft -= pageHeight
      }

      // Step 9: Download
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

function generateMinutesHtml(template: TemplateConfig, meeting: any, sections: any[]): string {
  const building = meeting.buildings

  let html = `
    <div style="color: #333;">
      <h1 style="text-align: center; color: #1a1a1a; border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 30px; font-size: 24px;">
        ${escapeHtml(meeting.title)}
      </h1>
  `

  template.sections.forEach(templateSection => {
    if (templateSection.id === 'header') {
      html += renderHeader(templateSection, meeting, building)
    } else if (templateSection.id === 'attendees') {
      html += renderAttendees(templateSection, meeting.attendees || [])
    } else if (templateSection.id === 'topics') {
      html += renderTopics(sections)
    } else if (templateSection.id === 'footer') {
      html += renderFooter(templateSection)
    }
  })

  html += `</div>`
  return html
}

function escapeHtml(text: string): string {
  if (!text) return ''
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

function renderHeader(section: TemplateSection, meeting: any, building: any): string {
  const visibleFields = section.fields.filter(f => f.visible).sort((a, b) => a.order - b.order)
  
  let html = `
    <div style="margin-bottom: 30px;">
      <div style="padding: 12px; margin-bottom: 15px; background-color: #f8f9fa; font-weight: bold; font-size: 18px; border-radius: 4px;">
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
      <div style="margin-bottom: 8px; line-height: 1.6;">
        <strong>${escapeHtml(field.label)}:</strong> ${escapeHtml(value)}
      </div>`
  })

  html += `</div>`
  return html
}

function renderAttendees(section: TemplateSection, attendees: any[]): string {
  let html = `
    <div style="margin-bottom: 30px;">
      <div style="padding: 12px; margin-bottom: 15px; background-color: #f8f9fa; font-weight: bold; font-size: 18px; border-radius: 4px;">
        ${section.icon} ${section.label}
      </div>
      <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
        <thead>
          <tr style="background-color: #f3f4f6;">
            <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Name</th>
            <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Role</th>
            <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Status</th>
          </tr>
        </thead>
        <tbody>`

  attendees.forEach(attendee => {
    html += `
      <tr>
        <td style="border: 1px solid #ddd; padding: 8px;">${escapeHtml(attendee.name)}</td>
        <td style="border: 1px solid #ddd; padding: 8px;">${escapeHtml(attendee.role || '-')}</td>
        <td style="border: 1px solid #ddd; padding: 8px;">${attendee.present ? '✓ Present' : '✗ Absent'}</td>
      </tr>`
  })

  html += `</tbody></table></div>`
  return html
}

function renderTopics(sections: any[]): string {
  let html = `
    <div style="margin-bottom: 30px;">
      <div style="padding: 12px; margin-bottom: 15px; background-color: #f8f9fa; font-weight: bold; font-size: 18px; border-radius: 4px;">
        📝 Topics & Discussion
      </div>`

  sections.forEach((section, sIdx) => {
    html += `<h3 style="margin: 20px 0 10px 0; font-size: 16px;">${sIdx + 1}. ${escapeHtml(section.title)}</h3>`

    if (section.topics && section.topics.length > 0) {
      section.topics.forEach((topic: any, tIdx: number) => {
        html += `
          <div style="margin-bottom: 20px; padding: 15px; border: 1px solid #ddd; background: #fafafa; border-radius: 4px;">
            <div style="font-weight: bold; margin-bottom: 10px; font-size: 15px;">
              ${sIdx + 1}.${tIdx + 1} ${escapeHtml(topic.title)}
            </div>`

        if (topic.description) {
          html += `<div style="margin-bottom: 10px; color: #555;">${escapeHtml(topic.description)}</div>`
        }

        if (topic.notes && topic.notes.length > 0) {
          topic.notes.forEach((note: any) => {
            html += `<div style="margin: 10px 0; padding: 10px; border-left: 4px solid #3b82f6; background: white;"><strong>📝 Note:</strong> ${escapeHtml(note.content)}</div>`
          })
        }

        if (topic.tasks && topic.tasks.length > 0) {
          topic.tasks.forEach((task: any) => {
            const assignee = task.assigned_name || task.assigned_email || 'Unassigned'
            const dueDate = task.due_date ? ` (Due: ${new Date(task.due_date).toLocaleDateString()})` : ''
            html += `<div style="margin: 10px 0; padding: 10px; border-left: 4px solid #10b981; background: white;"><strong>✓ Task:</strong> ${escapeHtml(task.description)} - Assigned to: ${escapeHtml(assignee)}${dueDate}</div>`
          })
        }

        if (topic.decisions && topic.decisions.length > 0) {
          topic.decisions.forEach((decision: any) => {
            const votes = decision.votes_for !== null ? ` (For: ${decision.votes_for || 0}, Against: ${decision.votes_against || 0}, Abstain: ${decision.votes_abstain || 0})` : ''
            html += `<div style="margin: 10px 0; padding: 10px; border-left: 4px solid #8b5cf6; background: white;"><strong>⚖️ Decision:</strong> ${escapeHtml(decision.motion_text)} - <strong>Result:</strong> ${escapeHtml(decision.result || 'N/A')}${votes}</div>`
          })
        }

        html += `</div>`
      })
    }
  })

  html += `</div>`
  return html
}

function renderFooter(section: TemplateSection): string {
  return `
    <div style="margin-top: 40px;">
      <div style="padding: 12px; margin-bottom: 15px; background-color: #f8f9fa; font-weight: bold; font-size: 18px; border-radius: 4px;">
        ${section.icon} ${section.label}
      </div>
      <div style="margin-bottom: 20px; line-height: 2;">
        <div><strong>Meeting Adjourned:</strong> _______________________</div>
        <div><strong>Minutes Prepared By:</strong> _______________________</div>
        <div><strong>Signature:</strong> _______________________</div>
        <div><strong>Date:</strong> _______________________</div>
      </div>
    </div>`
}
