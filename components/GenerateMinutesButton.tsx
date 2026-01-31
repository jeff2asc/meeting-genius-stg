"use client"

import { useState } from "react"
import { Download, Loader2 } from "lucide-react"
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

export default function GenerateMinutesButton({
  meetingId,
  buildingId,
}: GenerateMinutesButtonProps) {
  const [generating, setGenerating] = useState(false)

  const handleGenerateMinutes = async () => {
    setGenerating(true)
    try {
      // Step 1: Fetch template
      const { data: templateData } = await supabase
        .from("minutes_templates")
        .select("*")
        .eq("building_id", buildingId)
        .maybeSingle()

      const template: TemplateConfig =
        templateData?.blocks?.sections ? templateData.blocks : getDefaultTemplate()

      // Step 2: Fetch meeting data + building + company logo
      const { data: meeting, error: meetingError } = await supabase
        .from("meetings")
        .select(
          `
          *,
          buildings(
            name,
            address,
            logo_url,
            building_type,
            company_id,
            companies(
              logo_url
            )
          )
        `
        )
        .eq("id", meetingId)
        .single()

      if (meetingError || !meeting) {
        console.error("Failed to load meeting data:", meetingError)
        alert("Failed to load meeting data")
        setGenerating(false)
        return
      }

      const building = meeting.buildings
      const company = building?.companies
      const logoUrl: string | null =
        building?.logo_url || company?.logo_url || null

      // Step 3: Fetch sections and topics
      const { data: sections } = await supabase
        .from("sections")
        .select(
          `
          *,
          topics(
            *,
            notes(content, created_at),
            tasks(description, assigned_name, assigned_email, due_date, status),
            decisions(motion_text, result, votes_for, votes_against, votes_abstain)
          )
        `
        )
        .eq("meeting_id", meetingId)
        .order("order_index")

      // Step 4: Generate HTML (with logo and in-camera filtering)
      const minutesHtml = generateMinutesHtml(
        template,
        meeting,
        sections || [],
        logoUrl
      )

      // Step 5: Create isolated iframe
      const iframe = document.createElement("iframe")
      iframe.style.position = "absolute"
      iframe.style.left = "-9999px"
      iframe.style.width = "210mm"
      iframe.style.border = "none"
      document.body.appendChild(iframe)

      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document
      if (!iframeDoc) throw new Error("Cannot access iframe document")

      iframeDoc.open()
      iframeDoc.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            @page { 
              size: letter; 
              margin: 0.75in; 
            }
            * { 
              margin: 0; 
              padding: 0; 
              box-sizing: border-box; 
            }
            body { 
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
              font-size: 11pt;
              line-height: 1.5;
              color: #333;
              background: white;
              padding: 0;
              margin: 0;
            }
            h1 { 
              font-size: 20pt; 
              margin-bottom: 20px;
              page-break-after: avoid;
            }
            h2 { 
              font-size: 14pt; 
              margin: 15px 0 10px 0;
              page-break-after: avoid;
            }
            h3 { 
              font-size: 12pt; 
              margin: 12px 0 8px 0;
              page-break-after: avoid;
            }
            
            /* ⭐ Professional Header Layout */
            .page-header {
              display: flex;
              align-items: flex-start;
              justify-content: space-between;
              padding-bottom: 15px;
              margin-bottom: 25px;
              border-bottom: 3px solid #1f2937;
            }
            
            .page-header-left {
              flex-shrink: 0;
            }
            
            .page-header-logo {
              max-height: 70px;
              max-width: 200px;
              object-fit: contain;
            }
            
            .page-header-right {
              flex-grow: 1;
              text-align: right;
              padding-left: 20px;
            }
            
            .page-title {
              font-size: 28pt;
              font-weight: bold;
              color: #1f2937;
              margin-bottom: 5px;
              letter-spacing: 0.5px;
              text-transform: uppercase;
            }
            
            .page-subtitle {
              font-size: 16pt;
              color: #6b7280;
              font-weight: 500;
              margin-top: 5px;
            }
            
            .section { 
              margin-bottom: 25px;
              page-break-inside: avoid;
            }
            .section-header {
              background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%);
              color: white;
              padding: 12px 18px;
              margin-bottom: 15px;
              font-size: 13pt;
              font-weight: bold;
              border-radius: 4px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            .field-row {
              padding: 8px 0;
              display: flex;
              border-bottom: 1px solid #f3f4f6;
            }
            .field-row:last-child {
              border-bottom: none;
            }
            .field-label {
              font-weight: 600;
              min-width: 160px;
              color: #374151;
            }
            .field-value {
              color: #1f2937;
              flex: 1;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin: 10px 0;
              box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            }
            th {
              background: linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%);
              padding: 10px 12px;
              text-align: left;
              font-weight: 600;
              border: 1px solid #d1d5db;
              color: #374151;
            }
            td {
              padding: 10px 12px;
              border: 1px solid #d1d5db;
              background: white;
            }
            tr:hover td {
              background-color: #f9fafb;
            }
            .topic-box {
              border: 1px solid #e5e7eb;
              border-radius: 6px;
              padding: 18px;
              margin-bottom: 18px;
              background: #fafbfc;
              page-break-inside: avoid;
              box-shadow: 0 1px 3px rgba(0,0,0,0.05);
            }
            .topic-title {
              font-weight: bold;
              font-size: 12pt;
              color: #1f2937;
              margin-bottom: 10px;
              padding-bottom: 8px;
              border-bottom: 2px solid #e5e7eb;
            }
            .topic-description {
              color: #4b5563;
              margin-bottom: 12px;
              line-height: 1.6;
            }
            .item {
              margin: 10px 0;
              padding: 12px 15px;
              border-left: 4px solid;
              background: white;
              font-size: 10pt;
              border-radius: 0 4px 4px 0;
              box-shadow: 0 1px 2px rgba(0,0,0,0.05);
            }
            .item-decision { 
              border-color: #8b5cf6;
              background: #faf5ff;
            }
            .item-label {
              font-weight: 600;
              margin-right: 8px;
            }
            
            /* ⭐ In-camera styling */
            .incamera-notice {
              background-color: #fef2f2;
              border: 2px solid #dc2626;
              border-radius: 6px;
              padding: 15px;
              margin: 10px 0;
              color: #991b1b;
              font-style: italic;
            }
            .incamera-badge {
              display: inline-block;
              background-color: #dc2626;
              color: white;
              padding: 4px 10px;
              border-radius: 4px;
              font-size: 9pt;
              font-weight: bold;
              margin-left: 8px;
            }
          </style>
        </head>
        <body>${minutesHtml}</body>
        </html>
      `)
      iframeDoc.close()

      // Wait for fonts and layout
      await new Promise((resolve) => setTimeout(resolve, 1500))

      // Step 6: Generate PDF using jsPDF with proper canvas slicing
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "letter",
      })

      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()
      const margin = 10
      const usablePageHeight = pageHeight - margin * 2

      const canvas = await html2canvas(iframeDoc.body, {
        scale: 2,
        backgroundColor: "#ffffff",
        logging: false,
        useCORS: true,
        windowWidth: 210 * 3.7795275591,
      })

      document.body.removeChild(iframe)

      const fullWidth = canvas.width
      const fullHeight = canvas.height

      // How many canvas pixels fit into one PDF page in height
      const pageCanvasHeight =
        (usablePageHeight * canvas.width) / (pageWidth - margin * 2)

      let renderedHeight = 0
      let pageIndex = 0

      while (renderedHeight < fullHeight) {
        // Create a temporary canvas for each page slice
        const pageCanvas = document.createElement("canvas")
        pageCanvas.width = fullWidth
        pageCanvas.height = Math.min(
          pageCanvasHeight,
          fullHeight - renderedHeight
        )

        const pageCtx = pageCanvas.getContext("2d")
        if (!pageCtx) break

        pageCtx.drawImage(
          canvas,
          0,
          renderedHeight,
          fullWidth,
          pageCanvas.height,
          0,
          0,
          fullWidth,
          pageCanvas.height
        )

        const imgData = pageCanvas.toDataURL("image/jpeg", 0.95)

        if (pageIndex > 0) {
          pdf.addPage()
        }

        const imgWidth = pageWidth - margin * 2
        const imgHeight = (pageCanvas.height * imgWidth) / fullWidth

        pdf.addImage(imgData, "JPEG", margin, margin, imgWidth, imgHeight)

        renderedHeight += pageCanvasHeight
        pageIndex++
      }

      const safeTitle = (meeting.title || "Meeting")
        .replace(/[^a-z0-9]/gi, "_")
        .substring(0, 80)

      const fileName = `${safeTitle}_Minutes_${
        new Date().toISOString().split("T")[0]
      }.pdf`
      pdf.save(fileName)

      alert("✅ Minutes PDF downloaded successfully!")
    } catch (err) {
      console.error("Error generating minutes:", err)
      alert("Failed to generate PDF. Please try again.")
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
          {
            id: "strata_plan",
            label: "Strata Plan Number",
            visible: true,
            order: 6,
          },
        ],
      },
      {
        id: "attendees",
        label: "Attendees",
        icon: "👥",
        backgroundColor: "#ffffff",
        fields: [
          { id: "present", label: "Present", visible: true, order: 1 },
          { id: "absent", label: "Absent", visible: true, order: 2 },
          { id: "regrets", label: "Regrets", visible: true, order: 3 },
        ],
      },
      {
        id: "topics",
        label: "Topics & Notes",
        icon: "📝",
        backgroundColor: "#ffffff",
        fields: [],
      },
      {
        id: "decisions",
        label: "Decisions & Votes",
        icon: "⚖️",
        backgroundColor: "#ffffff",
        fields: [],
      },
      {
        id: "footer",
        label: "Footer",
        icon: "✍️",
        backgroundColor: "#f8fafc",
        fields: [
          { id: "adjournment", label: "Meeting Adjourned", visible: true, order: 1 },
          { id: "next_meeting", label: "Next Meeting Date", visible: true, order: 2 },
          {
            id: "prepared_by",
            label: "Minutes Prepared By",
            visible: true,
            order: 3,
          },
          { id: "signatures", label: "Signatures", visible: true, order: 4 },
        ],
      },
    ],
  }
}

function generateMinutesHtml(
  template: TemplateConfig,
  meeting: any,
  sections: any[],
  logoUrl: string | null
): string {
  const building = meeting.buildings

  // ⭐ Determine if this is MINUTES or AGENDA based on meeting status
  const isMinutes = meeting.status === 'minutes' || meeting.status === 'working_minutes'
  const documentType = isMinutes ? 'MEETING MINUTES' : 'MEETING AGENDA'

  // ⭐ Professional header with logo on left, title on right
  let html = `
    <div class="page-header">
      <div class="page-header-left">
        ${
          logoUrl
            ? `<img src="${escapeHtml(logoUrl)}" alt="Logo" class="page-header-logo" />`
            : ""
        }
      </div>
      <div class="page-header-right">
        <div class="page-title">${documentType}</div>
        <div class="page-subtitle">${escapeHtml(meeting.title)}</div>
      </div>
    </div>
  `

  template.sections.forEach((templateSection) => {
    if (templateSection.id === "header") {
      html += renderHeader(templateSection, meeting, building)
    } else if (templateSection.id === "attendees") {
      html += renderAttendees(templateSection, meeting.attendees || [])
    } else if (templateSection.id === "topics") {
      html += renderTopics(sections)
    }
    // ⭐ Footer removed - not included in minutes PDF
  })

  return html
}

function escapeHtml(text: string): string {
  if (!text) return ""
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

// ⭐ Helper function to format time without seconds
function formatTimeWithoutSeconds(timeString: string | null): string {
  if (!timeString) return "N/A"
  
  // Handle different time formats
  // If it contains AM/PM, just remove seconds if present
  if (timeString.includes('AM') || timeString.includes('PM')) {
    return timeString.replace(/:\d{2}\s*(AM|PM)/i, ' $1')
  }
  
  // If it's in 24-hour format (HH:MM:SS or HH:MM)
  const timeParts = timeString.split(':')
  if (timeParts.length >= 2) {
    const hours = parseInt(timeParts[0])
    const minutes = timeParts[1]
    
    // Convert to 12-hour format without seconds
    const period = hours >= 12 ? 'PM' : 'AM'
    const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours
    
    return `${displayHours}:${minutes} ${period}`
  }
  
  return timeString
}

// ⭐ CORRECTED: renderHeader - ONLY hide Strata Plan if empty
function renderHeader(section: TemplateSection, meeting: any, building: any): string {
  const visibleFields = section.fields
    .filter((f) => f.visible)
    .sort((a, b) => a.order - b.order)

  // ⭐ NO section header - just the fields directly
  let html = `<div class="section">`

  visibleFields.forEach((field) => {
    // ⭐ ONLY skip Strata Plan if it's empty/null
    if (field.id === "strata_plan" && !meeting.strata_plan_number) {
      return
    }

    let value = ""
    switch (field.id) {
      case "building_name":
        value = building?.name || "N/A"
        break
      case "meeting_type":
        value = meeting.meeting_type || "N/A"
        break
      case "meeting_date":
        value = meeting.meeting_date
          ? new Date(meeting.meeting_date + "T00:00:00Z").toLocaleDateString(
              "en-US",
              {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
                timeZone: "UTC",
              }
            )
          : "N/A"
        break
      case "start_time":
        // ⭐ Format time without seconds
        value = formatTimeWithoutSeconds(meeting.start_time)
        break
      case "location":
        value = meeting.location || "N/A"
        break
      case "strata_plan":
        value = meeting.strata_plan_number || "N/A"
        break
    }

    html += `
      <div class="field-row">
        <span class="field-label">${escapeHtml(field.label)}:</span>
        <span class="field-value">${escapeHtml(value)}</span>
      </div>`
  })

  html += `</div>`
  return html
}

function renderAttendees(section: TemplateSection, attendees: any[]): string {
  let html = `
    <div class="section">
      <div class="section-header">
        ${section.icon} ${section.label}
      </div>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Role</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>`

  attendees.forEach((attendee) => {
    html += `
      <tr>
        <td>${escapeHtml(attendee.name)}</td>
        <td>${escapeHtml(attendee.role || "-")}</td>
        <td>${attendee.present ? "✓ Present" : "✗ Absent"}</td>
      </tr>`
  })

  html += `</tbody></table></div>`
  return html
}

// ⭐ UPDATED: renderTopics - Tasks and Notes removed, only Decisions shown
function renderTopics(sections: any[]): string {
  let html = `
    <div class="section">
      <div class="section-header">
        📝 Topics & Discussion
      </div>`

  sections.forEach((section, sIdx) => {
    const rawTitle = typeof section.title === "string" ? section.title : ""
    const cleanedTitle = rawTitle.replace(/^\s*\d+(\.\d+)*\s*[\).\-\:]*\s*/, "")

    html += `<h2>${sIdx + 1}. ${escapeHtml(cleanedTitle || rawTitle)}</h2>`

    if (section.topics && section.topics.length > 0) {
      section.topics.forEach((topic: any, tIdx: number) => {
        // ⭐ Check if topic is in-camera
        const isIncamera = topic.is_incamera === true

        html += `
          <div class="topic-box">
            <div class="topic-title">
              ${sIdx + 1}.${tIdx + 1} ${escapeHtml(topic.title)}
              ${isIncamera ? '<span class="incamera-badge">🔒 IN-CAMERA</span>' : ''}
            </div>`

        // ⭐ If in-camera, show notice instead of content
        if (isIncamera) {
          html += `
            <div class="incamera-notice">
              <strong>🔒 This topic is in-camera (confidential).</strong><br/>
              Content has been withheld due to the sensitive nature of the discussion.`
          
          // Show times if recorded
          if (topic.incamera_start_time || topic.incamera_end_time) {
            html += `<br/><br/>`
            if (topic.incamera_start_time) {
              const startTime = new Date(topic.incamera_start_time).toLocaleString()
              html += `Started: ${escapeHtml(startTime)}`
            }
            if (topic.incamera_end_time) {
              const endTime = new Date(topic.incamera_end_time).toLocaleString()
              html += `${topic.incamera_start_time ? ' | ' : ''}Ended: ${escapeHtml(endTime)}`
            }
          }
          
          html += `</div>`
        } else {
          // ⭐ NORMAL: Show content for non-in-camera topics
          if (topic.description) {
            html += `<div class="topic-description">${escapeHtml(
              topic.description
            )}</div>`
          }

          // ⭐ Notes removed - not included in minutes PDF
          // ⭐ Tasks removed - managed separately through task interface

          // ✅ Decisions are kept - they are formal records that belong in minutes
          if (topic.decisions && topic.decisions.length > 0) {
            topic.decisions.forEach((decision: any) => {
              const votes =
                decision.votes_for !== null
                  ? ` (For: ${decision.votes_for || 0}, Against: ${
                      decision.votes_against || 0
                    }, Abstain: ${decision.votes_abstain || 0})`
                  : ""
              html += `<div class="item item-decision"><span class="item-label">⚖️ Decision:</span>${escapeHtml(
                decision.motion_text
              )} - Result: ${escapeHtml(decision.result || "N/A")}${votes}</div>`
            })
          }
        }

        html += `</div>`
      })
    } else {
      html += `<p style="padding: 15px; color: #6b7280; font-style: italic;">No topics recorded for this section.</p>`
    }
  })

  html += `</div>`
  return html
}
