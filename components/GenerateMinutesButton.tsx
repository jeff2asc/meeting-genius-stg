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

      // Step 4: Generate HTML (with logo)
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
            .page-header {
              text-align: center;
              border-bottom: 2px solid #1f2937;
              padding-bottom: 12px;
              margin-bottom: 25px;
            }
            .page-header-logo {
              max-height: 60px;
              max-width: 180px;
              object-fit: contain;
              margin-bottom: 8px;
            }
            .section { 
              margin-bottom: 25px;
              page-break-inside: avoid;
            }
            .section-header {
              background-color: #f0f4f8;
              padding: 10px 15px;
              border-left: 4px solid #2563eb;
              margin-bottom: 12px;
              font-size: 14pt;
              font-weight: bold;
            }
            .field-row {
              padding: 5px 0;
              display: flex;
            }
            .field-label {
              font-weight: 600;
              min-width: 160px;
              color: #1f2937;
            }
            .field-value {
              color: #4b5563;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin: 10px 0;
            }
            th {
              background-color: #e5e7eb;
              padding: 8px 12px;
              text-align: left;
              font-weight: 600;
              border: 1px solid #d1d5db;
            }
            td {
              padding: 8px 12px;
              border: 1px solid #d1d5db;
            }
            .topic-box {
              border: 1px solid #e5e7eb;
              border-radius: 6px;
              padding: 15px;
              margin-bottom: 15px;
              background: #fafbfc;
              page-break-inside: avoid;
            }
            .topic-title {
              font-weight: bold;
              font-size: 12pt;
              color: #1f2937;
              margin-bottom: 8px;
            }
            .topic-description {
              color: #6b7280;
              margin-bottom: 10px;
              line-height: 1.6;
            }
            .item {
              margin: 8px 0;
              padding: 10px 12px;
              border-left: 3px solid;
              background: white;
              font-size: 10pt;
            }
            .item-note { border-color: #3b82f6; }
            .item-task { border-color: #10b981; }
            .item-decision { border-color: #8b5cf6; }
            .item-label {
              font-weight: 600;
              margin-right: 5px;
            }
            .footer-signatures {
              margin-top: 30px;
              padding-top: 20px;
              border-top: 1px solid #e5e7eb;
            }
            .signature-line {
              margin: 15px 0;
              padding: 8px 0;
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

  let html = `
    <div class="page-header">
      ${
        logoUrl
          ? `<img src="${escapeHtml(logoUrl)}" alt="Logo" class="page-header-logo" />`
          : ""
      }
      <h1>${escapeHtml(meeting.title)}</h1>
    </div>
  `

  template.sections.forEach((templateSection) => {
    if (templateSection.id === "header") {
      html += renderHeader(templateSection, meeting, building)
    } else if (templateSection.id === "attendees") {
      html += renderAttendees(templateSection, meeting.attendees || [])
    } else if (templateSection.id === "topics") {
      html += renderTopics(sections)
    } else if (templateSection.id === "footer") {
      html += renderFooter(templateSection)
    }
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

function renderHeader(section: TemplateSection, meeting: any, building: any): string {
  const visibleFields = section.fields
    .filter((f) => f.visible)
    .sort((a, b) => a.order - b.order)

  let html = `
    <div class="section">
      <div class="section-header">
        ${section.icon} ${section.label}
      </div>`

  visibleFields.forEach((field) => {
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
        value = meeting.start_time || "N/A"
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
        html += `
          <div class="topic-box">
            <div class="topic-title">${sIdx + 1}.${tIdx + 1} ${escapeHtml(
              topic.title
            )}</div>`

        if (topic.description) {
          html += `<div class="topic-description">${escapeHtml(
            topic.description
          )}</div>`
        }

        if (topic.notes && topic.notes.length > 0) {
          topic.notes.forEach((note: any) => {
            html += `<div class="item item-note"><span class="item-label">📝 Note:</span>${escapeHtml(
              note.content
            )}</div>`
          })
        }

        if (topic.tasks && topic.tasks.length > 0) {
          topic.tasks.forEach((task: any) => {
            const assignee =
              task.assigned_name || task.assigned_email || "Unassigned"
            const dueDate = task.due_date
              ? ` (Due: ${new Date(task.due_date).toLocaleDateString()})`
              : ""
            html += `<div class="item item-task"><span class="item-label">✓ Task:</span>${escapeHtml(
              task.description
            )} - Assigned: ${escapeHtml(assignee)}${dueDate}</div>`
          })
        }

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

        html += `</div>`
      })
    } else {
      html += `<p style="padding: 15px; color: #6b7280; font-style: italic;">No topics recorded for this section.</p>`
    }
  })

  html += `</div>`
  return html
}

function renderFooter(section: TemplateSection): string {
  return `
    <div class="footer-signatures">
      <div class="section-header">
        ${section.icon} ${section.label}
      </div>
      <div class="signature-line">
        <strong>Meeting Adjourned:</strong> ________________________________
      </div>
      <div class="signature-line">
        <strong>Minutes Prepared By:</strong> ________________________________
      </div>
      <div class="signature-line">
        <strong>Signature:</strong> ________________________________
      </div>
      <div class="signature-line">
        <strong>Date:</strong> ________________________________
      </div>
    </div>`
}
