// lib/minutesCanvasPDFGenerator.ts
// @ts-nocheck
import jsPDF from "jspdf"
import { CanvasElement } from "@/lib/canvasUtils"
import { MinutesDynamicFieldType } from "@/lib/minutesCanvasUtils"
import { formatMeetingDate } from "@/lib/canvasFormatters"

// ============== TYPES ==============

interface Attendee {
  name: string
  email?: string
  role?: string
  userid?: number
  present?: boolean
}

interface Meeting {
  title: string
  meeting_date: string
  meeting_type: string | null
  start_time: string | null
  location: string | null
  strata_plan_number: string | null
  attendees?: Attendee[] | any
  status?: string
  buildings: {
    name: string
    address: string | null
    logo_url: string | null
    companies?: {
      logo_url: string | null
    }
  }
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
  notes?: { content: string; created_at: string }[]
  tasks?: {
    description: string
    assigned_name: string | null
    assigned_email: string | null
    due_date: string | null
    status: string
  }[]
  decisions?: {
    motion_text: string
    result: string | null
    votes_for: number | null
    votes_against: number | null
    votes_abstain: number | null
  }[]
}

// ============== CONSTANTS ==============

const MM_TO_PT = 2.83465
const PAGE_HEIGHT = 841.89 // A4 height in points
const PAGE_MARGIN_TOP = 50
const PAGE_MARGIN_BOTTOM = 50

// ============== MAIN FUNCTION ==============

export async function generateMinutesCanvasPDF(
  elements: CanvasElement[],
  meeting: Meeting,
  sections: Section[],
  topics: Topic[]
) {
  console.log("📝 Generating Minutes Canvas PDF with", elements.length, "elements")

  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "pt",
    format: "a4",
  })

  const logoUrl =
    meeting.buildings?.logo_url || meeting.buildings?.companies?.logo_url || null
  console.log("📷 Minutes Canvas PDF - Logo URL:", logoUrl)

  for (const element of elements) {
    await renderMinutesElement(pdf, element, meeting, sections, topics, logoUrl)
  }

  const safeTitle = (meeting.title || "Meeting")
    .replace(/[^a-z0-9]/gi, "_")
    .substring(0, 80)

  const fileName = `${safeTitle}_Minutes_${meeting.meeting_date}.pdf`
  pdf.save(fileName)

  console.log("✅ Minutes Canvas PDF generated successfully")
}

// ============== RENDER FUNCTIONS ==============

async function renderMinutesElement(
  pdf: jsPDF,
  element: CanvasElement,
  meeting: Meeting,
  sections: Section[],
  topics: Topic[],
  logoUrl: string | null
) {
  const x = element.position.x * MM_TO_PT
  const y = element.position.y * MM_TO_PT
  const width = element.size.width * MM_TO_PT
  const height = element.size.height * MM_TO_PT

  switch (element.type) {
    case "text":
      renderTextElement(pdf, element, x, y, width, height)
      break
    case "shape":
      renderShapeElement(pdf, element, x, y, width, height)
      break
    case "container":
      renderContainerElement(pdf, element, x, y, width, height)
      break
    case "image":
      await renderImageElement(pdf, element, x, y, width, height, logoUrl)
      break
    case "dynamic":
      await renderMinutesDynamicElement(
        pdf,
        element,
        x,
        y,
        width,
        height,
        meeting,
        sections,
        topics,
        logoUrl
      )
      break
    case "html_header":
      await renderHtmlHeaderElement(pdf, element, x, y, width, height)
      break
    default:
      console.warn("Unknown element type in minutes canvas:", element.type)
  }
}

// Reuse same helpers as agenda version where possible

function renderTextElement(
  pdf: jsPDF,
  element: CanvasElement,
  x: number,
  y: number,
  width: number,
  height: number
) {
  if (!element.content || typeof element.content !== "string") return

  const fontSize = element.style?.fontSize ? parseInt(element.style.fontSize) : 12
  const fontWeight = element.style?.fontWeight === "bold" ? "bold" : "normal"
  const textAlign = element.style?.textAlign || "left"
  const color = element.style?.color || "#000000"

  pdf.setFontSize(fontSize)
  pdf.setFont("helvetica", fontWeight)
  pdf.setTextColor(color)

  const textY = y + fontSize * 0.75
  const content = element.content

  if (textAlign === "center") {
    pdf.text(content, x + width / 2, textY, { align: "center", maxWidth: width })
  } else if (textAlign === "right") {
    pdf.text(content, x + width, textY, { align: "right", maxWidth: width })
  } else {
    pdf.text(content, x, textY, { maxWidth: width })
  }
}

function renderShapeElement(
  pdf: jsPDF,
  element: CanvasElement,
  x: number,
  y: number,
  width: number,
  height: number
) {
  const bgColor = element.style?.backgroundColor || "#f0f0f0"
  const borderColor = element.style?.borderColor || "#000000"
  const borderWidth = element.style?.borderWidth ? parseInt(element.style.borderWidth) : 0

  pdf.setFillColor(bgColor)

  if (borderWidth > 0) {
    pdf.setDrawColor(borderColor)
    pdf.setLineWidth(borderWidth)
    pdf.rect(x, y, width, height, "FD")
  } else {
    pdf.rect(x, y, width, height, "F")
  }
}

function renderContainerElement(
  pdf: jsPDF,
  element: CanvasElement,
  x: number,
  y: number,
  width: number,
  height: number
) {
  const bgColor = element.style?.backgroundColor || "#ffffff"
  const borderColor = element.style?.borderColor || "#cccccc"
  const borderWidth = element.style?.borderWidth ? parseInt(element.style.borderWidth) : 1

  pdf.setFillColor(bgColor)
  pdf.setDrawColor(borderColor)
  pdf.setLineWidth(borderWidth)
  pdf.rect(x, y, width, height, "FD")
}

async function renderImageElement(
  pdf: jsPDF,
  element: CanvasElement,
  x: number,
  y: number,
  width: number,
  height: number,
  logoUrl: string | null
) {
  let imageUrl = element.content as string

  // If this is a logo placeholder, use actual logo URL
  if (imageUrl === "COMPANY_LOGO" && logoUrl) {
    imageUrl = logoUrl
  }

  if (!imageUrl) {
    console.warn("⚠️ No image URL provided for image element (minutes)")
    return
  }

  try {
    const base64Image = await imageUrlToBase64(imageUrl)

    let format = "JPEG"
    if (base64Image.includes("data:image/png")) {
      format = "PNG"
    } else if (
      base64Image.includes("data:image/jpeg") ||
      base64Image.includes("data:image/jpg")
    ) {
      format = "JPEG"
    }

    pdf.addImage(base64Image, format, x, y, width, height)
  } catch (error) {
    console.error("❌ Failed to load image in minutes canvas:", imageUrl, error)

    pdf.setFillColor("#f8f9fa")
    pdf.setDrawColor("#dee2e6")
    pdf.setLineWidth(1)
    pdf.rect(x, y, width, height, "FD")

    pdf.setFontSize(12)
    pdf.setTextColor("#6c757d")
    pdf.text("Logo", x + width / 2, y + height / 2, { align: "center" })
  }
}

async function renderMinutesDynamicElement(
  pdf: jsPDF,
  element: CanvasElement,
  x: number,
  y: number,
  width: number,
  height: number,
  meeting: Meeting,
  sections: Section[],
  topics: Topic[],
  logoUrl: string | null
) {
  if (!element.content || typeof element.content !== "object" || !("type" in element.content)) {
    console.log("⚠️ renderMinutesDynamicElement: content is not an object", element.id, element.content)
    return
  }

  const fieldType = element.content.type as MinutesDynamicFieldType
  console.log("⚡ renderMinutesDynamicElement processing:", element.id, "fieldType:", fieldType)

  // Company logo handling
  if (fieldType === ("company_logo" as any)) {
    if (!logoUrl) {
      pdf.setFillColor("#f8f9fa")
      pdf.setDrawColor("#dee2e6")
      pdf.setLineWidth(1)
      pdf.rect(x, y, width, height, "FD")

      pdf.setFontSize(10)
      pdf.setTextColor("#6c757d")
      pdf.text("Logo", x + width / 2, y + height / 2, { align: "center" })
      return
    }

    try {
      const base64Image = await imageUrlToBase64(logoUrl)
      let format = "JPEG"
      if (base64Image.includes("data:image/png")) {
        format = "PNG"
      } else if (
        base64Image.includes("data:image/jpeg") ||
        base64Image.includes("data:image/jpg")
      ) {
        format = "JPEG"
      }

      pdf.addImage(base64Image, format, x, y, width, height)
    } catch (error) {
      console.error("❌ Failed to load company logo in minutes canvas:", logoUrl, error)
      pdf.setFillColor("#f8f9fa")
      pdf.setDrawColor("#dee2e6")
      pdf.setLineWidth(1)
      pdf.rect(x, y, width, height, "FD")
      pdf.setFontSize(10)
      pdf.setTextColor("#6c757d")
      pdf.text("Logo", x + width / 2, y + height / 2, { align: "center" })
    }
    return
  }

  // Minutes-specific dynamic fields
  switch (fieldType) {
    case "building_name":
    case "footer_building_name":
      renderSimpleTextDynamic(
        pdf,
        element,
        x,
        y,
        width,
        meeting.buildings?.name || ""
      )
      return

    case "meeting_type":
      renderSimpleTextDynamic(pdf, element, x, y, width, meeting.meeting_type || "")
      return

    case "meeting_date":
      renderSimpleTextDynamic(pdf, element, x, y, width, formatMeetingDate(meeting.meeting_date))
      return

    case "start_time":
      renderSimpleTextDynamic(pdf, element, x, y, width, meeting.start_time || "")
      return

    case "location":
      renderSimpleTextDynamic(pdf, element, x, y, width, meeting.location || "")
      return

    case "address":
      renderSimpleTextDynamic(pdf, element, x, y, width, meeting.buildings?.address || "")
      return

    case "strata_plan":
      renderSimpleTextDynamic(
        pdf,
        element,
        x,
        y,
        width,
        meeting.strata_plan_number || ""
      )
      return

    case "document_heading": {
      const buildingName = meeting.buildings?.name || ""
      const meetingType = meeting.meeting_type || "Council Meeting"
      const strataNo = meeting.strata_plan_number || ""
      const dateStr = formatMeetingDate(meeting.meeting_date)
      const timeStr = meeting.start_time || ""
      const location = meeting.location || ""
      const cfg = element.config || {}
      const headingFormat = cfg.headingFormat || "full_sentence"
      const orientation = cfg.orientation || "horizontal"

      if (headingFormat === "full_sentence" || headingFormat === "inline") {
        const sentence = `Minutes of the ${meetingType} of ${buildingName}, Strata Plan ${strataNo}, held on ${dateStr}${timeStr ? " at " + timeStr : ""}${location ? " in " + location : ""}.`
        renderSimpleTextDynamic(pdf, element, x, y, width, sentence)
      } else {
        const fontSize = element.style?.fontSize ? parseInt(element.style.fontSize) : 12
        const fontWeight = element.style?.fontWeight === "bold" ? "bold" : "normal"
        const color = element.style?.color || "#000000"
        
        pdf.setFontSize(fontSize)
        pdf.setFont("helvetica", fontWeight)
        pdf.setTextColor(color)
        
        let currentY = y + fontSize * 0.75
        
        pdf.setFont("helvetica", "bold")
        pdf.setFontSize(fontSize + 2)
        pdf.text(`Minutes of the ${meetingType}`, x, currentY)
        currentY += (fontSize + 2) * 1.3
        
        pdf.setFont("helvetica", "normal")
        pdf.setFontSize(fontSize)
        pdf.text(`${buildingName} · Strata Plan ${strataNo}`, x, currentY)
        currentY += fontSize * 1.3
        
        if (orientation === "vertical") {
          pdf.text(`📅 ${dateStr}`, x, currentY)
          currentY += fontSize * 1.2
          if (timeStr) {
            pdf.text(`🕐 ${timeStr}`, x, currentY)
            currentY += fontSize * 1.2
          }
          if (location) {
            pdf.text(`📍 ${location}`, x, currentY)
          }
        } else {
          const details = `📅 ${dateStr}${timeStr ? "  🕐 " + timeStr : ""}${location ? "  📍 " + location : ""}`
          pdf.text(details, x, currentY)
        }
      }
      return
    }

    case "attendance_block": {
      const attendees = meeting.attendees || []
      const cfg = element.config || {}
      const attendanceStyle = cfg.attendanceStyle || "table"
      const orientation = cfg.orientation || "horizontal"

      const fontSize = element.style?.fontSize ? parseInt(element.style.fontSize) : 10
      const color = element.style?.color || "#000000"
      const bgColor = element.style?.backgroundColor || "#f3f4f6"

      pdf.setFontSize(fontSize)
      pdf.setFont("helvetica", "normal")
      pdf.setTextColor(color)

      if (!attendees || !Array.isArray(attendees) || attendees.length === 0) {
        pdf.text("No attendees recorded.", x, y + fontSize)
        return
      }

      let currentY = y + fontSize

      if (attendanceStyle === "table" || orientation === "horizontal") {
        const rowHeight = fontSize * 1.8
        const colWidths = [width * 0.45, width * 0.4, width * 0.15]
        
        pdf.setFillColor(bgColor)
        pdf.rect(x, currentY - fontSize * 0.8, width, rowHeight, "F")
        
        pdf.setFont("helvetica", "bold")
        pdf.text("Name", x + 4, currentY + fontSize * 0.1)
        pdf.text("Role", x + colWidths[0] + 4, currentY + fontSize * 0.1)
        pdf.text("Present", x + colWidths[0] + colWidths[1], currentY + fontSize * 0.1, { align: "center" })
        
        currentY += rowHeight
        pdf.setFont("helvetica", "normal")

        attendees.forEach((a: any, i: number) => {
          if (currentY > PAGE_HEIGHT - PAGE_MARGIN_BOTTOM) {
            pdf.addPage()
            currentY = PAGE_MARGIN_TOP + rowHeight
          }
          
          if (i % 2 === 1) {
            pdf.setFillColor("#f8fafc")
            pdf.rect(x, currentY - fontSize * 0.8, width, rowHeight, "F")
          }
          
          pdf.text(a.name || "", x + 4, currentY + fontSize * 0.1)
          pdf.setTextColor("#6b7280")
          pdf.text(a.role || "", x + colWidths[0] + 4, currentY + fontSize * 0.1)
          pdf.setTextColor(color)
          pdf.text(a.present ? "Yes" : "No", x + colWidths[0] + colWidths[1], currentY + fontSize * 0.1, { align: "center" })
          
          currentY += rowHeight
        })
      } else {
        attendees.forEach((a: any, i: number) => {
          if (currentY > PAGE_HEIGHT - PAGE_MARGIN_BOTTOM) {
            pdf.addPage()
            currentY = PAGE_MARGIN_TOP
          }
          
          const statusBullet = a.present ? "Present" : "Absent"
          const roleText = a.role ? ` (${a.role})` : ""
          const lineText = `• ${a.name}${roleText} - ${statusBullet}`
          
          pdf.text(lineText, x, currentY)
          currentY += fontSize * 1.3
        })
      }
      return
    }

    case "attendee_list":
    case "attendee_names":
    case "attendee_roles":
    case "attendance_status":
      renderMinutesAttendeesBlock(pdf, element, x, y, width, meeting.attendees || [])
      return

    case "topics_list":
    case "section_titles":
    case "section_numbers":
    case "topic_titles":
    case "topic_numbers":
    case "topic_descriptions":
    case "topic_notes":
    case "topic_tasks":
    case "topic_decisions":
    case "decision_votes":
    case "task_assignees":
    case "task_due_dates":
      renderMinutesTopicsBlock(pdf, element, x, y, width, sections, topics, fieldType)
      return

    case "page_number":
      renderPageNumber(pdf, element, x, y, width)
      return

    case "branding":
      renderSimpleTextDynamic(
        pdf,
        element,
        x,
        y,
        width,
        "Generated by Meeting Genius"
      )
      return

    case "adjournment_time":
      renderSimpleTextDynamic(pdf, element, x, y, width, "")
      return

    case "next_meeting_date":
      renderSimpleTextDynamic(pdf, element, x, y, width, "")
      return

    case "signatures":
      renderSignatureLines(pdf, element, x, y, width)
      return

    default:
      renderSimpleTextDynamic(pdf, element, x, y, width, `[${fieldType}]`)
      return
  }
}

// Simple text dynamic renderer
function renderSimpleTextDynamic(
  pdf: jsPDF,
  element: CanvasElement,
  x: number,
  y: number,
  width: number,
  value: string
) {
  const fontSize = element.style?.fontSize ? parseInt(element.style.fontSize) : 11
  const fontWeight = element.style?.fontWeight === "bold" ? "bold" : "normal"
  const textAlign = element.style?.textAlign || "left"
  const color = element.style?.color || "#000000"

  pdf.setFontSize(fontSize)
  pdf.setFont("helvetica", fontWeight)
  pdf.setTextColor(color)

  const lines = pdf.splitTextToSize(value || "", width)
  const lineHeight = fontSize * 1.2

  lines.forEach((line: string, index: number) => {
    let currentY = y + fontSize * 0.75 + index * lineHeight

    if (currentY > PAGE_HEIGHT - PAGE_MARGIN_BOTTOM) {
      pdf.addPage()
      currentY = PAGE_MARGIN_TOP
    }

    if (textAlign === "center") {
      pdf.text(line, x + width / 2, currentY, { align: "center" })
    } else if (textAlign === "right") {
      pdf.text(line, x + width, currentY, { align: "right" })
    } else {
      pdf.text(line, x, currentY)
    }
  })
}

// Attendees block for minutes
function renderMinutesAttendeesBlock(
  pdf: jsPDF,
  element: CanvasElement,
  x: number,
  y: number,
  width: number,
  attendees: Attendee[] | any
) {
  const fontSize = element.style?.fontSize ? parseInt(element.style.fontSize) : 10
  const color = element.style?.color || "#000000"

  pdf.setFontSize(fontSize)
  pdf.setFont("helvetica", "normal")
  pdf.setTextColor(color)

  if (!attendees || !Array.isArray(attendees) || attendees.length === 0) {
    pdf.text("No attendees recorded for this meeting.", x, y + fontSize)
    return
  }

  const present = attendees.filter((a) => a.present === true)
  const absent = attendees.filter((a) => a.present === false)
  const unknown = attendees.filter(
    (a) => a.present === undefined || a.present === null
  )

  let currentY = y + fontSize

  const drawGroup = (label: string, list: any[]) => {
    if (!list.length) return

    if (currentY > PAGE_HEIGHT - PAGE_MARGIN_BOTTOM - 40) {
      pdf.addPage()
      currentY = PAGE_MARGIN_TOP
    }

    pdf.setFont("helvetica", "bold")
    pdf.text(label, x, currentY)
    currentY += fontSize * 1.4

    pdf.setFont("helvetica", "normal")
    list.forEach((a, idx) => {
      if (currentY > PAGE_HEIGHT - PAGE_MARGIN_BOTTOM) {
        pdf.addPage()
        currentY = PAGE_MARGIN_TOP
      }
      const roleText = a.role ? ` - ${a.role}` : ""
      pdf.text(`${idx + 1}. ${a.name}${roleText}`, x + 10, currentY)
      currentY += fontSize * 1.3
    })

    currentY += fontSize * 0.8
  }

  drawGroup("Present:", present)
  drawGroup("Absent:", absent)
  drawGroup("Status Pending:", unknown)

  if (currentY > PAGE_HEIGHT - PAGE_MARGIN_BOTTOM - 20) {
    pdf.addPage()
    currentY = PAGE_MARGIN_TOP
  }

  pdf.setFont("helvetica", "bold")
  pdf.text(`Total Attendees: ${attendees.length}`, x, currentY)
}

// Topics, notes, tasks, decisions
function renderMinutesTopicsBlock(
  pdf: jsPDF,
  element: CanvasElement,
  x: number,
  y: number,
  width: number,
  sections: Section[],
  topics: Topic[],
  fieldType: MinutesDynamicFieldType
) {
  console.log("📝 renderMinutesTopicsBlock fieldType:", fieldType, "sections count:", sections?.length, "topics count:", topics?.length)
  const fontSize = element.style?.fontSize ? parseInt(element.style.fontSize) : 10
  const color = element.style?.color || "#000000"

  pdf.setFontSize(fontSize)
  pdf.setFont("helvetica", "normal")
  pdf.setTextColor(color)

  let currentY = y + fontSize

  sections.forEach((section, sIdx) => {
    if (currentY > PAGE_HEIGHT - PAGE_MARGIN_BOTTOM - 40) {
      pdf.addPage()
      currentY = PAGE_MARGIN_TOP
    }

    const sectionNumber = sIdx + 1
    pdf.setFont("helvetica", "bold")
    pdf.text(
      `${sectionNumber}. ${section.title.toUpperCase()}`,
      x,
      currentY
    )
    currentY += fontSize * 1.5

    const sectionTopics = topics.filter((t) => t.section_id === section.id)

    if (!sectionTopics.length) {
      pdf.setFont("helvetica", "normal")
      pdf.text("No topics recorded.", x + 10, currentY)
      currentY += fontSize * 1.5
      return
    }

    sectionTopics.forEach((topic, tIdx) => {
      const isIncamera = topic.is_incamera === true

      // In-camera: show only label, no content
      if (isIncamera) {
        if (currentY > PAGE_HEIGHT - PAGE_MARGIN_BOTTOM - 20) {
          pdf.addPage()
          currentY = PAGE_MARGIN_TOP
        }

        pdf.setFont("helvetica", "bold")
        pdf.text(
          `${sectionNumber}.${tIdx + 1} ${topic.title} [IN-CAMERA]`,
          x + 10,
          currentY
        )
        currentY += fontSize * 1.5
        return
      }

      if (currentY > PAGE_HEIGHT - PAGE_MARGIN_BOTTOM - 30) {
        pdf.addPage()
        currentY = PAGE_MARGIN_TOP
      }

      // Topic title
      pdf.setFont("helvetica", "bold")
      pdf.text(
        `${sectionNumber}.${tIdx + 1} ${topic.title}`,
        x + 10,
        currentY
      )
      currentY += fontSize * 1.3

      pdf.setFont("helvetica", "normal")

      // Description
      if (
        fieldType === "topic_descriptions" ||
        fieldType === "topic_notes" ||
        fieldType === "topic_tasks" ||
        fieldType === "topic_decisions" ||
        fieldType === "decision_votes" ||
        fieldType === "task_assignees" ||
        fieldType === "task_due_dates" ||
        fieldType === "topics_list"
      ) {
        if (topic.description) {
          const descLines = pdf.splitTextToSize(topic.description, width - 20)
          descLines.forEach((line: string) => {
            if (currentY > PAGE_HEIGHT - PAGE_MARGIN_BOTTOM) {
              pdf.addPage()
              currentY = PAGE_MARGIN_TOP
            }
            pdf.text(line, x + 15, currentY)
            currentY += fontSize * 1.3
          })
          currentY += fontSize * 0.5
        }
      }

      // Notes
      if ((fieldType === "topic_notes" || fieldType === "topics_list") && topic.notes && topic.notes.length > 0) {
        pdf.setFont("helvetica", "bold")
        pdf.text("Notes:", x + 15, currentY)
        currentY += fontSize * 1.2
        pdf.setFont("helvetica", "normal")

        topic.notes.forEach((note) => {
          const lines = pdf.splitTextToSize(note.content, width - 25)
          lines.forEach((line: string) => {
            if (currentY > PAGE_HEIGHT - PAGE_MARGIN_BOTTOM) {
              pdf.addPage()
              currentY = PAGE_MARGIN_TOP
            }
            pdf.text(`• ${line}`, x + 20, currentY)
            currentY += fontSize * 1.2
          })
          currentY += fontSize * 0.4
        })
      }

      // Tasks
      if ((fieldType === "topic_tasks" || fieldType === "topics_list") && topic.tasks && topic.tasks.length > 0) {
        pdf.setFont("helvetica", "bold")
        pdf.text("Tasks:", x + 15, currentY)
        currentY += fontSize * 1.2
        pdf.setFont("helvetica", "normal")

        topic.tasks.forEach((task) => {
          const assignee = task.assigned_name || task.assigned_email || ""
          const due =
            task.due_date != null ? ` (Due: ${task.due_date})` : ""
          const status = task.status ? ` [${task.status}]` : ""
          const full = `${task.description}${assignee ? ` - ${assignee}` : ""}${due}${status}`

          const lines = pdf.splitTextToSize(full, width - 25)
          lines.forEach((line: string) => {
            if (currentY > PAGE_HEIGHT - PAGE_MARGIN_BOTTOM) {
              pdf.addPage()
              currentY = PAGE_MARGIN_TOP
            }
            pdf.text(`• ${line}`, x + 20, currentY)
            currentY += fontSize * 1.2
          })
          currentY += fontSize * 0.4
        })
      }

      // Motions / Decisions / Votes (new layout)
      if (
        (fieldType === "topic_decisions" ||
          fieldType === "decision_votes" ||
          fieldType === "topics_list") &&
        topic.decisions &&
        topic.decisions.length > 0
      ) {
        topic.decisions.forEach((decision, dIdx) => {
          const motionNumber = `${sectionNumber}.${dIdx + 1}`
          const votesFor = decision.votes_for || 0
          const votesAgainst = decision.votes_against || 0
          const votesAbstain = decision.votes_abstain || 0

          // Motion line
          if (currentY > PAGE_HEIGHT - PAGE_MARGIN_BOTTOM - 30) {
            pdf.addPage()
            currentY = PAGE_MARGIN_TOP
          }

          pdf.setFont("helvetica", "bold")
          const motionLine = `Motion ${motionNumber}: ${decision.motion_text}`
          const motionLines = pdf.splitTextToSize(motionLine, width - 25)
          motionLines.forEach((line: string) => {
            if (currentY > PAGE_HEIGHT - PAGE_MARGIN_BOTTOM) {
              pdf.addPage()
              currentY = PAGE_MARGIN_TOP
            }
            pdf.text(line, x + 15, currentY)
            currentY += fontSize * 1.2
          })

          // Decision line
          if (decision.result) {
            pdf.setFont("helvetica", "normal")
            const decisionLine = `Decision: ${decision.result}`
            const decisionLines = pdf.splitTextToSize(decisionLine, width - 25)
            decisionLines.forEach((line: string) => {
              if (currentY > PAGE_HEIGHT - PAGE_MARGIN_BOTTOM) {
                pdf.addPage()
                currentY = PAGE_MARGIN_TOP
              }
              pdf.text(line, x + 15, currentY)
              currentY += fontSize * 1.2
            })
          }

          // Votes line
          const votesLine = `Votes: For: ${votesFor} | Against: ${votesAgainst} | Abstain: ${votesAbstain}`
          const votesLines = pdf.splitTextToSize(votesLine, width - 25)
          votesLines.forEach((line: string) => {
            if (currentY > PAGE_HEIGHT - PAGE_MARGIN_BOTTOM) {
              pdf.addPage()
              currentY = PAGE_MARGIN_TOP
            }
            pdf.text(line, x + 15, currentY)
            currentY += fontSize * 1.2
          })

          currentY += fontSize * 0.8
        })
      }

      currentY += fontSize * 0.8
    })

    currentY += fontSize * 1.2
  })
}

// Page number renderer
function renderPageNumber(
  pdf: jsPDF,
  element: CanvasElement,
  x: number,
  y: number,
  width: number
) {
  const pageNumber = (pdf as any).internal.getNumberOfPages?.() || 1
  const fontSize = element.style?.fontSize ? parseInt(element.style.fontSize) : 9
  const color = element.style?.color || "#6b7280"

  pdf.setFontSize(fontSize)
  pdf.setFont("helvetica", "normal")
  pdf.setTextColor(color)

  pdf.text(`Page ${pageNumber}`, x + width, y + fontSize, { align: "right" })
}

// Signature lines (for footer)
function renderSignatureLines(
  pdf: jsPDF,
  element: CanvasElement,
  x: number,
  y: number,
  width: number
) {
  const fontSize = element.style?.fontSize ? parseInt(element.style.fontSize) : 10
  const color = element.style?.color || "#000000"

  pdf.setFontSize(fontSize)
  pdf.setFont("helvetica", "normal")
  pdf.setTextColor(color)

  const lineY1 = y + fontSize * 2
  const lineY2 = lineY1 + fontSize * 4

  const halfWidth = width / 2 - 10

  // Chair
  pdf.line(x, lineY1, x + halfWidth, lineY1)
  pdf.text("Chair", x, lineY1 + fontSize * 1.1)

  // Secretary
  pdf.line(x + halfWidth + 20, lineY1, x + halfWidth * 2 + 20, lineY1)
  pdf.text("Secretary", x + halfWidth + 20, lineY1 + fontSize * 1.1)

  // Date line
  pdf.line(x, lineY2, x + halfWidth, lineY2)
  pdf.text("Date", x, lineY2 + fontSize * 1.1)
}

// ============== IMAGE HELPERS ==============

async function imageUrlToBase64(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    fetch(url, { mode: "cors" })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }
        return response.blob()
      })
      .then((blob) => {
        const reader = new FileReader()
        reader.onloadend = () => {
          const base64 = reader.result as string
          resolve(base64)
        }
        reader.onerror = reject
        reader.readAsDataURL(blob)
      })
      .catch((error) => {
        console.warn("Fetch failed, trying Image fallback for minutes:", error)
        loadImageAsBase64(url).then(resolve).catch(reject)
      })
  })
}

function loadImageAsBase64(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = "anonymous"

    img.onload = () => {
      try {
        const canvas = document.createElement("canvas")
        canvas.width = img.width
        canvas.height = img.height

        const ctx = canvas.getContext("2d")
        if (!ctx) {
          reject(new Error("Could not get canvas context"))
          return
        }

        ctx.drawImage(img, 0, 0)
        const base64 = canvas.toDataURL("image/png")
        resolve(base64)
      } catch (error) {
        reject(error)
      }
    }

    img.onerror = () => {
      reject(new Error(`Failed to load image: ${url}`))
    }

    img.src = url
  })
}

async function renderHtmlHeaderElement(
  pdf: jsPDF,
  element: CanvasElement,
  x: number,
  y: number,
  width: number,
  height: number
) {
  if (!element.content || typeof element.content !== "string") return

  try {
    const html2canvas = (await import("html2canvas")).default
    
    const container = document.createElement("div")
    container.style.position = "absolute"
    container.style.left = "-9999px"
    container.style.top = "-9999px"
    
    const mmToPx = 3.7795275591
    const elementWidthPx = element.size.width * mmToPx
    const elementHeightPx = element.size.height * mmToPx
    
    container.style.width = `${elementWidthPx}px`
    container.style.height = `${elementHeightPx}px`
    container.style.overflow = "hidden"
    container.innerHTML = element.content

    document.body.appendChild(container)

    // Wait a brief moment for assets
    await new Promise((resolve) => setTimeout(resolve, 150))

    const canvas = await html2canvas(container, {
      width: elementWidthPx,
      height: elementHeightPx,
      backgroundColor: null,
      logging: false,
      useCORS: true,
      scale: 2
    })

    document.body.removeChild(container)

    const base64Image = canvas.toDataURL("image/png")
    pdf.addImage(base64Image, "PNG", x, y, width, height)
  } catch (error) {
    console.error("❌ Failed to render HTML Header to PDF:", error)
    pdf.setFillColor("#1e3a8a")
    pdf.rect(x, y, width, height, "F")
    pdf.setFontSize(10)
    pdf.setTextColor("#ffffff")
    pdf.text("HTML Header Render Failed", x + 10, y + 20)
  }
}
