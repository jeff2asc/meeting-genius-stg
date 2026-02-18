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

type Align = "left" | "center" | "right"

interface CoverPageElement {
  id: string
  label: string
  enabled: boolean
  x: number
  y: number
  align: Align
}

interface TemplateField {
  id: string
  label: string
  order: number
  enabled: boolean
  showFullList?: boolean
}

interface MinutesTemplate {
  coverPageElements: CoverPageElement[]
  infoCardFields: TemplateField[]
  coverPageColor: string
  infoCardAccentColor: string
  sectionHeadersColor: string
  motionBoxesColor: string
  actionItemsColor: string
  voteResultsColor: string
  coverPageHeight: number
}

export default function GenerateMinutesButton({
  meetingId,
  buildingId,
}: GenerateMinutesButtonProps) {
  const [generating, setGenerating] = useState(false)

  const handleGenerateMinutes = async () => {
    setGenerating(true)
    try {
      // 1) Load per-building minutes template from DB (colors + layout)
      const { data: templateRow, error: templateError } = await supabase
        .from("minutes_templates")
        .select(
          `
          coverpage_elements,
          infocard_fields,
          coverpage_color,
          infocard_accent_color,
          section_headers_color,
          motion_boxes_color,
          action_items_color,
          vote_results_color,
          coverpage_height
        `
        )
        .eq("building_id", buildingId)
        .maybeSingle()

      if (templateError) {
        console.error("Error loading minutes template:", templateError)
      }

      const defaultTemplate: MinutesTemplate = {
        coverPageElements: [
          {
            id: "logo",
            label: "Building / Company Logo",
            enabled: true,
            x: 10,
            y: 15,
            align: "left",
          },
          {
            id: "title",
            label: "MEETING MINUTES",
            enabled: true,
            x: 50,
            y: 40,
            align: "center",
          },
          {
            id: "building_name",
            label: "Building Name",
            enabled: true,
            x: 50,
            y: 60,
            align: "center",
          },
          {
            id: "meeting_type",
            label: "Meeting Type",
            enabled: true,
            x: 50,
            y: 70,
            align: "center",
          },
        ],
        infoCardFields: [
          { id: "date", label: "Meeting Date", order: 1, enabled: true },
          { id: "start_time", label: "Start Time", order: 2, enabled: true },
          { id: "end_time", label: "End Time", order: 3, enabled: true },
          { id: "location", label: "Location", order: 4, enabled: true },
          {
            id: "attendees",
            label: "Attendees",
            order: 5,
            enabled: true,
            showFullList: false,
          },
          { id: "chair_person", label: "Chair Person", order: 6, enabled: true },
          { id: "minute_taker", label: "Minute Taker", order: 7, enabled: true },
        ],
        coverPageColor: "#1e3a8a",
        infoCardAccentColor: "#2563eb",
        sectionHeadersColor: "#2563eb",
        motionBoxesColor: "#10b981",
        actionItemsColor: "#f59e0b",
        voteResultsColor: "#8b5cf6",
        coverPageHeight: 500,
      }

      let template: MinutesTemplate = defaultTemplate

      if (templateRow) {
        template = {
          ...defaultTemplate,
          coverPageColor:
            templateRow.coverpage_color || defaultTemplate.coverPageColor,
          infoCardAccentColor:
            templateRow.infocard_accent_color ||
            defaultTemplate.infoCardAccentColor,
          sectionHeadersColor:
            templateRow.section_headers_color ||
            defaultTemplate.sectionHeadersColor,
          motionBoxesColor:
            templateRow.motion_boxes_color || defaultTemplate.motionBoxesColor,
          actionItemsColor:
            templateRow.action_items_color || defaultTemplate.actionItemsColor,
          voteResultsColor:
            templateRow.vote_results_color || defaultTemplate.voteResultsColor,
          coverPageHeight:
            templateRow.coverpage_height || defaultTemplate.coverPageHeight,
          coverPageElements:
            Array.isArray(templateRow.coverpage_elements) &&
            templateRow.coverpage_elements.length > 0
              ? (templateRow.coverpage_elements as CoverPageElement[])
              : defaultTemplate.coverPageElements,
          infoCardFields:
            Array.isArray(templateRow.infocard_fields) &&
            templateRow.infocard_fields.length > 0
              ? (templateRow.infocard_fields as TemplateField[])
              : defaultTemplate.infoCardFields,
        }
      }

      // 2) Load meeting (with building + company logos)
      const { data: meeting, error: meetingError } = await supabase
        .from("meetings")
        .select(
          `
          *,
          buildings(
            id,
            name,
            address,
            logo_url,
            building_type,
            company_id,
            companies(
              id,
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

      // 3) Load sections/topics/decisions/tasks
      const { data: sections, error: sectionsError } = await supabase
        .from("sections")
        .select("*")
        .eq("meeting_id", meetingId)
        .order("order_index")

      if (sectionsError) {
        console.error("Error loading sections:", sectionsError)
      }

      const { data: topics, error: topicsError } = await supabase
        .from("topics")
        .select("*")
        .eq("meeting_id", meetingId)
        .order("order_index")

      if (topicsError) {
        console.error("Error loading topics:", topicsError)
      }

      const topicIds = (topics || []).map((t: any) => t.id)

      let decisions: any[] = []
      let tasks: any[] = []

      if (topicIds.length > 0) {
        const { data: decisionsData, error: decisionsError } = await supabase
          .from("decisions")
          .select("*")
          .in("topic_id", topicIds)
          .order("recorded_at")

        if (decisionsError) {
          console.error("Error loading decisions:", decisionsError)
        }

        const { data: tasksData, error: tasksError } = await supabase
          .from("tasks")
          .select("*")
          .in("topic_id", topicIds)
          .order("created_at")

        if (tasksError) {
          console.error("Error loading tasks:", tasksError)
        }

        decisions = decisionsData || []
        tasks = tasksData || []
      }

      const sectionsWithTopics = (sections || []).map((section: any) => ({
        ...section,
        topics: (topics || [])
          .filter((t: any) => t.section_id === section.id)
          .map((topic: any) => ({
            ...topic,
            decisions: decisions.filter((d: any) => d.topic_id === topic.id),
            tasks: tasks.filter((t: any) => t.topic_id === topic.id),
          })),
      }))

      // 4) Use attendees from meeting.attendees JSONB
      const attendees = (meeting.attendees as any[]) || []

      // 5) Build HTML using the template
      const minutesHtml = buildMinutesHtml({
        template,
        meeting,
        sections: sectionsWithTopics,
        attendees,
        logoUrl,
      })

      // 6) Render in hidden iframe and capture to PDF
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
              line-height: 1.6;
              color: #1f2937;
              background: white;
              padding: 0;
              margin: 0;
            }

            .cover {
              width: 100%;
              position: relative;
              overflow: hidden;
              color: white;
            }

            .cover-inner {
              position: relative;
              width: 100%;
              height: 100%;
            }

            .cover-element {
              position: absolute;
              transform: translate(-50%, -50%);
              white-space: nowrap;
            }

            .cover-element-left {
              transform: translate(0, -50%);
            }

            .cover-element-right {
              transform: translate(-100%, -50%);
            }

            .cover-logo {
              background: white;
              border-radius: 999px;
              display: flex;
              align-items: center;
              justify-content: center;
              box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            }

            .cover-logo img {
              max-width: 80px;
              max-height: 80px;
              object-fit: contain;
            }

            .cover-title-line {
              font-weight: 800;
              letter-spacing: 3px;
              text-transform: uppercase;
              text-shadow: 0 2px 4px rgba(0,0,0,0.3);
            }

            .info-card {
              margin: 24px 20px 20px 20px;
              border-radius: 10px;
              overflow: hidden;
              border: 1px solid #e5e7eb;
              box-shadow: 0 2px 6px rgba(0,0,0,0.08);
            }

            .info-card-header {
              color: white;
              padding: 10px 14px;
              font-size: 11px;
              font-weight: 700;
              letter-spacing: 1px;
            }

            .info-card-body {
              background: #f9fafb;
              padding: 14px 18px;
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 10px 24px;
            }

            .info-field {
              display: flex;
              flex-direction: column;
              font-size: 10px;
            }

            .info-label {
              font-weight: 700;
              text-transform: uppercase;
              color: #6b7280;
              margin-bottom: 3px;
            }

            .info-value {
              font-size: 11px;
              color: #111827;
            }

            .attendees-section {
              margin: 16px 20px 20px 20px;
              border-radius: 10px;
              overflow: hidden;
              border: 1px solid #e5e7eb;
              box-shadow: 0 2px 6px rgba(0,0,0,0.04);
            }
            .attendees-header {
              color: white;
              padding: 10px 14px;
              font-size: 11px;
              font-weight: 700;
              letter-spacing: 1px;
            }
            .attendees-table {
              width: 100%;
              border-collapse: collapse;
              background: #f9fafb;
            }
            .attendees-table th {
              padding: 8px 12px;
              text-align: left;
              font-size: 10px;
              font-weight: 700;
              text-transform: uppercase;
              color: #6b7280;
              border-bottom: 2px solid #e5e7eb;
            }
            .attendees-table td {
              padding: 8px 12px;
              font-size: 10px;
              border-bottom: 1px solid #e5e7eb;
            }
            .attendees-table tr:last-child td {
              border-bottom: none;
            }
            .status-badge {
              display: inline-block;
              padding: 3px 8px;
              border-radius: 4px;
              font-size: 9px;
              font-weight: 600;
            }
            .status-present {
              background: #d1fae5;
              color: #065f46;
            }
            .status-absent {
              background: #fee2e2;
              color: #991b1b;
            }

            .section-header {
              margin: 20px 20px 12px 20px;
              padding: 8px 12px;
              color: white;
              border-radius: 8px;
              font-size: 12px;
              font-weight: 700;
              display: inline-block;
            }

            .topic-box {
              margin: 0 20px 14px 20px;
              padding: 12px 14px;
              border-radius: 8px;
              background: #ffffff;
              border: 1px solid #e5e7eb;
            }

            .topic-title {
              font-size: 11px;
              font-weight: 700;
              margin-bottom: 6px;
              border-bottom: 2px solid #e5e7eb;
              padding-bottom: 4px;
            }

            .topic-description {
              font-size: 10px;
              color: #4b5563;
              margin-bottom: 8px;
            }

            .item {
              margin-top: 6px;
              padding: 8px 10px;
              border-radius: 6px;
              font-size: 9.5px;
            }

            .item-motion {
              border-left: 3px solid;
              background: #f9fafb;
            }

            .item-label {
              font-weight: 700;
              margin-right: 4px;
            }

            .incamera-strip {
              margin: 16px 20px;
              padding: 8px 10px;
              border-radius: 6px;
              background: #fef2f2;
              border: 1px solid #fecaca;
              font-size: 10px;
              color: #b91c1c;
            }
          </style>
        </head>
        <body>${minutesHtml}</body>
        </html>
      `)
      iframeDoc.close()

      await new Promise((resolve) => setTimeout(resolve, 1500))

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
      const pageCanvasHeight =
        (usablePageHeight * canvas.width) / (pageWidth - margin * 2)

      let renderedHeight = 0
      let pageIndex = 0

      while (renderedHeight < fullHeight) {
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

// -------- Helpers to build HTML from template --------

function buildMinutesHtml({
  template,
  meeting,
  sections,
  attendees,
  logoUrl,
}: {
  template: MinutesTemplate
  meeting: any
  sections: any[]
  attendees: any[]
  logoUrl: string | null
}): string {
  const isMinutes =
    meeting.status === "minutes" || meeting.status === "workingminutes"
  const documentType = isMinutes ? "MEETING MINUTES" : "MEETING AGENDA"

  const building = meeting.buildings

  let html = ""

  const safeCoverColor =
    template.coverPageColor && template.coverPageColor.trim()
      ? template.coverPageColor
      : "#1e3a8a"

  // COVER
  html += `
    <div class="cover" style="height:${template.coverPageHeight}px;background:${safeCoverColor};">
      <div class="cover-inner">
        ${renderCoverElements(template.coverPageElements, {
          logoUrl,
          meeting,
          building,
          documentType,
        })}
      </div>
    </div>
  `

  // INFO CARD
  html += renderInfoCard(template, meeting, attendees)

  // ATTENDEES SECTION
  html += renderAttendeesSection(template, attendees)

  // SECTIONS / TOPICS / DECISIONS
  html += renderSectionsAndTopics(template, sections, isMinutes)

  return html
}

function renderCoverElements(
  elements: CoverPageElement[],
  ctx: {
    logoUrl: string | null
    meeting: any
    building: any
    documentType: string
  }
): string {
  if (!elements || elements.length === 0) return ""

  return elements
    .filter((el) => el.enabled)
    .map((el) => {
      const alignClass =
        el.align === "center"
          ? ""
          : el.align === "left"
          ? "cover-element-left"
          : "cover-element-right"

      let inner = ""

      if (el.id === "logo") {
        inner = `
          <div class="cover-logo" style="width:90px;height:90px;">
            ${
              ctx.logoUrl
                ? `<img src="${escapeHtml(ctx.logoUrl)}" />`
                : `<span style="font-size:42px;">🏢</span>`
            }
          </div>
        `
      } else if (el.id === "title") {
        inner = `
          <div style="text-align:center;">
            <div class="cover-title-line" style="font-size:26px;">${escapeHtml(
              "MEETING"
            )}</div>
            <div class="cover-title-line" style="font-size:26px;">${escapeHtml(
              "MINUTES"
            )}</div>
          </div>
        `
      } else if (el.id === "building_name") {
        inner = `
          <div style="font-size:18px;font-weight:500;letter-spacing:1px;opacity:0.95;">
            ${escapeHtml(ctx.building?.name || "")}
          </div>
        `
      } else if (el.id === "meeting_type") {
        inner = `
          <div style="font-size:14px;opacity:0.9;">
            ${escapeHtml(ctx.meeting.meeting_type || "Council Meeting")}
          </div>
        `
      } else {
        inner = `<div>${escapeHtml(el.label)}</div>`
      }

      return `
        <div 
          class="cover-element ${alignClass}"
          style="left:${el.x}%;top:${el.y}%;"
        >
          ${inner}
        </div>
      `
    })
    .join("")
}

function renderInfoCard(
  template: MinutesTemplate,
  meeting: any,
  attendees: any[]
): string {
  const fields = (template.infoCardFields || [])
    .filter((f) => f.enabled)
    .filter((f) => f.id !== "attendees")
    .sort((a, b) => a.order - b.order)

  if (fields.length === 0) return ""

  let body = ""

  fields.forEach((field) => {
    let value = ""

    switch (field.id) {
      case "date":
        value = meeting.meeting_date
          ? formatMeetingDate(meeting.meeting_date)
          : "TBA"
        break
      case "start_time":
        value = formatTimeWithoutSeconds(meeting.start_time) || "TBA"
        break
      case "end_time":
        value = formatTimeWithoutSeconds(meeting.end_time) || "TBA"
        break
      case "location":
        value = meeting.location || "TBA"
        break
      case "chair_person":
        value = meeting.chair_person || "TBA"
        break
      case "minute_taker":
        value = meeting.minute_taker || "TBA"
        break
      default:
        value = ""
    }

    body += `
      <div class="info-field">
        <div class="info-label">${escapeHtml(field.label)}</div>
        <div class="info-value">${escapeHtml(value)}</div>
      </div>
    `
  })

  return `
    <div class="info-card">
      <div 
        class="info-card-header"
        style="background:${template.infoCardAccentColor};"
      >
        MEETING INFORMATION
      </div>
      <div class="info-card-body">
        ${body}
      </div>
    </div>
  `
}

function renderAttendeesSection(
  template: MinutesTemplate,
  attendees: any[]
): string {
  if (!attendees || attendees.length === 0) return ""

  const rows = attendees
    .map((a, idx) => {
      const isPresent =
        a.present === true || a.attendance_status === "present"
      const statusClass = isPresent ? "status-present" : "status-absent"
      const statusText = isPresent ? "Present" : "Absent"
      const role = a.role ? escapeHtml(a.role) : "—"
      const email = a.email ? escapeHtml(a.email) : "—"

      return `
        <tr>
          <td>${idx + 1}</td>
          <td>${escapeHtml(a.name)}</td>
          <td>${role}</td>
          <td>${email}</td>
          <td><span class="status-badge ${statusClass}">${statusText}</span></td>
        </tr>
      `
    })
    .join("")

  return `
    <div class="attendees-section">
      <div 
        class="attendees-header"
        style="background:${template.infoCardAccentColor};"
      >
        👥 ATTENDEES
      </div>
      <table class="attendees-table">
        <thead>
          <tr>
            <th style="width:40px;">#</th>
            <th>Name</th>
            <th style="width:120px;">Role</th>
            <th style="width:180px;">Email</th>
            <th style="width:80px;">Status</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>
  `
}

function renderSectionsAndTopics(
  template: MinutesTemplate,
  sections: any[],
  isMinutes: boolean
): string {
  let html = ""

  html += `
    <div class="section-header" style="background:${template.sectionHeadersColor};">
      📝 Topics & Discussion
    </div>
  `

  sections.forEach((section, sectionIndex) => {
    const rawTitle = typeof section.title === "string" ? section.title : ""
    const cleanedTitle = rawTitle.replace(
      /^\s*\d+(\.\d+)*\s*[\).\-\:]*\s*/,
      ""
    )

    html += `
      <div class="topic-box">
        <div class="topic-title">${escapeHtml(
          `${sectionIndex + 1}. ${cleanedTitle || rawTitle}`
        )}</div>
    `

    if (section.topics && section.topics.length > 0) {
      section.topics.forEach((topic: any) => {
        const isIncamera = topic.isincamera === true
        if (isIncamera) {
          html += `
            <div class="incamera-strip">
              <strong>IN-CAMERA:</strong> ${escapeHtml(topic.title)}
            </div>
          `
          return
        }

        html += `
          <div class="topic-description">${escapeHtml(
            topic.title
          )}</div>
        `

        if (topic.description) {
          html += `
            <div class="topic-description">${escapeHtml(
              topic.description
            )}</div>
          `
        }

        // Motions (with section.motion numbering)
        if (topic.decisions && topic.decisions.length > 0) {
          topic.decisions.forEach((decision: any, decisionIdx: number) => {
            const motionNumber = `${sectionIndex + 1}.${decisionIdx + 1}`
            const votesFor = decision.votes_for || 0
            const votesAgainst = decision.votes_against || 0
            const votesAbstain = decision.votes_abstain || 0

            html += `
              <div class="item item-motion" style="border-color:${template.motionBoxesColor};">
                <div style="font-weight:700;margin-bottom:4px;">
                  Motion ${motionNumber}: ${escapeHtml(decision.motion_text)}
                </div>
                ${
                  decision.result
                    ? `<div style="margin-top:4px;font-size:9px;">
                        <strong>Decision:</strong> ${escapeHtml(decision.result)}
                      </div>`
                    : ""
                }
                <div style="margin-top:4px;font-size:9px;">
                  <strong>Votes:</strong> For: ${votesFor} | Against: ${votesAgainst} | Abstain: ${votesAbstain}
                </div>
              </div>
            `
          })
        }

        // Actions removed from minutes body
      })
    } else {
      html += `
        <div class="topic-description" style="font-style:italic;color:#9ca3af;">
          No topics recorded for this section.
        </div>
      `
    }

    html += `</div>`
  })

  // No separate Decisions & Votes summary anymore
  return html
}

// ------------ small helpers ------------

function escapeHtml(text: any): string {
  if (!text) return ""
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

function formatMeetingDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}

function formatTimeWithoutSeconds(timeString: string | null): string {
  if (!timeString) return ""
  if (timeString.includes("AM") || timeString.includes("PM")) {
    return timeString.replace(/:\d{2}\s*(AM|PM)/i, " $1")
  }
  const timeParts = timeString.split(":")
  if (timeParts.length >= 2) {
    const hours = parseInt(timeParts[0])
    const minutes = timeParts[1]
    const period = hours >= 12 ? "PM" : "AM"
    const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours
    return `${displayHours}:${minutes} ${period}`
  }
  return timeString
}
