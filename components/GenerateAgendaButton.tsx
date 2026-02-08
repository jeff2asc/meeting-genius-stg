"use client"

import { useState } from "react"
import { Download, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/supabase"
import jsPDF from "jspdf"
import html2canvas from "html2canvas"

interface GenerateAgendaButtonProps {
  meetingId: number
  meetingStatus: string
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
}

interface AgendaTemplate {
  coverPageElements: CoverPageElement[]
  infoCardFields: TemplateField[]
  coverPageColor: string
  infoCardAccentColor: string
  agendaItemsColor: string
  coverPageHeight: number
}

export default function GenerateAgendaButton({
  meetingId,
  meetingStatus,
}: GenerateAgendaButtonProps) {
  const [generating, setGenerating] = useState(false)

  const handleGenerateAgenda = async () => {
    setGenerating(true)
    try {
      // 1) Load meeting with building & company for logo
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

      const buildingId = meeting.buildings?.id
      if (!buildingId) {
        alert("Building information not found")
        setGenerating(false)
        return
      }

      // 2) Load per-building agenda template (always latest)
      const { data: templateRow, error: templateError } = await supabase
        .from("agendatemplates")
        .select(
          `
          coverpage_elements,
          infocard_fields,
          coverpage_color,
          infocard_accent_color,
          agenda_items_color,
          coverpage_height,
          updatedat
        `
        )
        .eq("buildingid", buildingId)
        .maybeSingle()

      if (templateError) {
        console.error("Error loading agenda template:", templateError)
      }

      const defaultTemplate: AgendaTemplate = {
        coverPageElements: [
          {
            id: "logo",
            label: "Company Logo",
            enabled: true,
            x: 10,
            y: 15,
            align: "left",
          },
          {
            id: "title",
            label: "MEETING AGENDA",
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
          { id: "date", label: "Date", order: 1, enabled: true },
          { id: "time", label: "Time", order: 2, enabled: true },
          { id: "location", label: "Location", order: 3, enabled: true },
          { id: "address", label: "Address", order: 4, enabled: true },
          { id: "strata_plan", label: "Strata Plan", order: 5, enabled: true },
        ],
        coverPageColor: "#1e3a8a",
        infoCardAccentColor: "#2563eb",
        agendaItemsColor: "#2563eb",
        coverPageHeight: 500,
      }

      let template: AgendaTemplate = defaultTemplate

      if (templateRow) {
        template = {
          ...defaultTemplate,
          coverPageColor:
            templateRow.coverpage_color || defaultTemplate.coverPageColor,
          infoCardAccentColor:
            templateRow.infocard_accent_color ||
            defaultTemplate.infoCardAccentColor,
          agendaItemsColor:
            templateRow.agenda_items_color || defaultTemplate.agendaItemsColor,
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

      console.log("📋 Loaded agenda template for building", buildingId, templateRow)
      console.log("✅ Final template used:", {
        coverPageColor: template.coverPageColor,
        infoCardAccentColor: template.infoCardAccentColor,
        agendaItemsColor: template.agendaItemsColor,
        coverPageHeight: template.coverPageHeight,
        coverPageElements: template.coverPageElements,
        infoCardFields: template.infoCardFields,
      })

      const building = meeting.buildings
      const company = building?.companies
      const logoUrl: string | null =
        building?.logo_url || company?.logo_url || null

      // 3) Load sections and topics (ordered)
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

      // 4) Build HTML using the template
      const agendaHtml = buildAgendaHtml({
        template,
        meeting,
        sections: sections || [],
        topics: topics || [],
        logoUrl,
      })

      // 5) Render in hidden iframe and capture to PDF
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
              display: block;
            }

            .cover-inner {
              position: relative;
              width: 100%;
              height: 100%;
            }

            .cover-element {
              position: absolute;
              white-space: nowrap;
            }

            .cover-logo {
              background: white;
              border-radius: 50%;
              width: 80px;
              height: 80px;
              display: flex;
              align-items: center;
              justify-content: center;
              box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            }

            .cover-logo img {
              max-width: 70px;
              max-height: 70px;
              object-fit: contain;
            }

            .cover-title-line {
              font-weight: 800;
              letter-spacing: 3px;
              text-transform: uppercase;
              text-shadow: 0 2px 4px rgba(0,0,0,0.3);
            }

            .info-card {
              margin: 24px 0 20px 0;
              border-radius: 10px;
              overflow: hidden;
              border: 1px solid #e5e7eb;
              box-shadow: 0 2px 6px rgba(0,0,0,0.08);
              display: block;
              width: 100%;
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
              display: block;
            }

            .info-field {
              display: block;
              margin-bottom: 10px;
              font-size: 10px;
            }

            .info-field:last-child {
              margin-bottom: 0;
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

            .agenda-header {
              margin: 20px 0 12px 0;
              padding: 10px 14px;
              color: white;
              border-radius: 8px;
              font-size: 14px;
              font-weight: 700;
              letter-spacing: 1px;
              display: block;
              width: 100%;
            }

            .section-header {
              margin: 20px 0 12px 0;
              padding: 8px 12px;
              color: white;
              border-radius: 8px;
              font-size: 12px;
              font-weight: 700;
              display: block;
              width: 100%;
            }

            .topic-box {
              margin: 0 0 14px 0;
              padding: 12px 14px;
              border-radius: 8px;
              background: #ffffff;
              border: 1px solid #e5e7eb;
              border-left-width: 4px;
              display: block;
              width: 100%;
            }

            .topic-title {
              font-size: 11px;
              font-weight: 700;
              margin-bottom: 4px;
            }

            .topic-description {
              font-size: 10px;
              color: #4b5563;
              margin-top: 4px;
            }

            .topic-number {
              display: inline-block;
              width: 24px;
              height: 24px;
              border-radius: 50%;
              background: #2563eb;
              color: white;
              text-align: center;
              line-height: 24px;
              font-size: 10px;
              font-weight: 700;
              margin-right: 8px;
              vertical-align: middle;
            }

            .incamera-badge {
              display: inline-block;
              background: #fee2e2;
              color: #991b1b;
              padding: 2px 6px;
              border-radius: 4px;
              font-size: 9px;
              font-weight: 600;
              margin-left: 6px;
            }
          </style>
        </head>
        <body>${agendaHtml}</body>
        </html>
      `)
      iframeDoc.close()

      await new Promise((resolve) => setTimeout(resolve, 1500))

      // 6) Convert iframe content to multi-page PDF
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

      const fileName = `${safeTitle}_Agenda_${
        new Date().toISOString().split("T")[0]
      }.pdf`
      pdf.save(fileName)

      alert("✅ Agenda PDF downloaded successfully!")
    } catch (err) {
      console.error("Error generating agenda:", err)
      alert("Failed to generate PDF. Please try again.")
    } finally {
      setGenerating(false)
    }
  }

  return (
    <Button
      onClick={handleGenerateAgenda}
      disabled={generating}
      className="bg-gradient-to-r from-primary to-decision-purple text-white h-8 px-3 text-xs"
    >
      {generating ? (
        <>
          <Loader2 className="h-3 w-3 mr-2 animate-spin" />
          Generating...
        </>
      ) : (
        <>
          <Download className="h-3 w-3 mr-2" />
          Download Agenda
        </>
      )}
    </Button>
  )
}

// Helper to build agenda HTML
function buildAgendaHtml({
  template,
  meeting,
  sections,
  topics,
  logoUrl,
}: {
  template: AgendaTemplate
  meeting: any
  sections: any[]
  topics: any[]
  logoUrl: string | null
}): string {
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  }

  const hexToRgb = (hex: string): number[] => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    return result
      ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
      : [30, 58, 138]
  }

  const getLighterColor = (hex: string, amount: number = 80) => {
    const rgb = hexToRgb(hex)
    return `rgb(${Math.min(255, rgb[0] + amount)}, ${Math.min(255, rgb[1] + amount)}, ${Math.min(255, rgb[2] + amount)})`
  }

  const building = meeting.buildings
  const coverHeight = template.coverPageHeight || 500

  // Cover page
  let coverHtml = `<div class="cover" style="height: ${coverHeight}px; background-color: ${template.coverPageColor};">`
  coverHtml += '<div class="cover-inner">'

  template.coverPageElements
    .filter((el) => el.enabled)
    .forEach((element) => {
      const leftPos = `${element.x}%`
      const topPos = `${element.y}%`
      let transformStyle = ""

      if (element.align === "center") {
        transformStyle = "transform: translateX(-50%);"
      } else if (element.align === "right") {
        transformStyle = "transform: translateX(-100%);"
      }

      if (element.id === "logo" && logoUrl) {
        coverHtml += `<div class="cover-element cover-logo" style="left: ${leftPos}; top: ${topPos}; ${transformStyle}">
          <img src="${logoUrl}" alt="Logo" />
        </div>`
      } else if (element.id === "title") {
        coverHtml += `<div class="cover-element" style="left: ${leftPos}; top: ${topPos}; ${transformStyle}">
          <div class="cover-title-line" style="font-size: 48px;">MEETING</div>
          <div class="cover-title-line" style="font-size: 48px;">AGENDA</div>
        </div>`
      } else if (element.id === "building_name") {
        coverHtml += `<div class="cover-element" style="left: ${leftPos}; top: ${topPos}; ${transformStyle} font-size: 24px; color: rgba(200, 220, 255, 0.95);">
          ${building?.name || ""}
        </div>`
      } else if (element.id === "meeting_type") {
        coverHtml += `<div class="cover-element" style="left: ${leftPos}; top: ${topPos}; ${transformStyle} font-size: 18px; color: rgba(200, 220, 255, 0.9);">
          ${meeting.meeting_type || "Council Meeting"}
        </div>`
      }
    })

  coverHtml += "</div></div>"

  // Info card
  let infoCardHtml = `<div class="info-card">
    <div class="info-card-header" style="background-color: ${template.infoCardAccentColor};">
      MEETING INFORMATION
    </div>
    <div class="info-card-body">`

  template.infoCardFields
    .filter((f) => f.enabled)
    .sort((a, b) => a.order - b.order)
    .forEach((field) => {
      let value = "TBA"
      if (field.id === "date") {
        value = formatDate(meeting.meeting_date)
      } else if (field.id === "time") {
        value = meeting.start_time || "TBA"
      } else if (field.id === "location") {
        value = meeting.location || "TBA"
      } else if (field.id === "address") {
        value = building?.address || "TBA"
      } else if (field.id === "strata_plan") {
        value = meeting.strata_plan_number || "TBA"
      }

      infoCardHtml += `<div class="info-field">
        <div class="info-label">${field.label}</div>
        <div class="info-value">${value}</div>
      </div>`
    })

  infoCardHtml += "</div></div>"

  // Agenda items
  let agendaHtml = `<div class="agenda-header" style="background-color: ${template.agendaItemsColor};">
    AGENDA ITEMS
  </div>`

  const topicsBySection: Record<number, any[]> = {}
  const unsectionedTopics: any[] = []

  topics.forEach((topic) => {
    if (topic.section_id) {
      if (!topicsBySection[topic.section_id]) {
        topicsBySection[topic.section_id] = []
      }
      topicsBySection[topic.section_id].push(topic)
    } else {
      unsectionedTopics.push(topic)
    }
  })

  Object.keys(topicsBySection).forEach((sectionId) => {
    topicsBySection[Number(sectionId)].sort(
      (a, b) => a.order_index - b.order_index
    )
  })
  unsectionedTopics.sort((a, b) => a.order_index - b.order_index)

  sections
    .sort((a, b) => a.order_index - b.order_index)
    .forEach((section, sectionIdx) => {
      const sectionTopics = topicsBySection[section.id] || []
      const lighterColor = getLighterColor(template.agendaItemsColor)

      agendaHtml += `<div class="section-header" style="background-color: ${lighterColor};">
        <span style="display: inline-block; width: 28px; height: 28px; border-radius: 50%; background-color: ${template.agendaItemsColor}; color: white; text-align: center; line-height: 28px; font-size: 12px; font-weight: 700; margin-right: 8px; vertical-align: middle;">${sectionIdx + 1}</span>
        ${section.title.toUpperCase()}
      </div>`

      sectionTopics.forEach((topic, topicIdx) => {
        const borderColor = topic.is_incamera ? "#dc2626" : template.agendaItemsColor
        const bgColor = topic.is_incamera ? "#fef2f2" : "#ffffff"

        agendaHtml += `<div class="topic-box" style="border-left-color: ${borderColor}; background-color: ${bgColor};">
          <div>
            <span class="topic-number" style="background-color: ${topic.is_incamera ? "#dc2626" : template.agendaItemsColor};">${sectionIdx + 1}.${topicIdx + 1}</span>
            <span class="topic-title">${topic.title}${topic.is_incamera ? '<span class="incamera-badge">[CONFIDENTIAL]</span>' : ""}</span>
          </div>`

        if (topic.description && !topic.is_incamera) {
          agendaHtml += `<div class="topic-description">${topic.description}</div>`
        }

        agendaHtml += `</div>`
      })
    })

  if (unsectionedTopics.length > 0) {
    const lighterColor = getLighterColor(template.agendaItemsColor)
    agendaHtml += `<div class="section-header" style="background-color: ${lighterColor};">
      <span style="display: inline-block; width: 28px; height: 28px; border-radius: 50%; background-color: ${template.agendaItemsColor}; color: white; text-align: center; line-height: 28px; font-size: 12px; font-weight: 700; margin-right: 8px; vertical-align: middle;">${sections.length + 1}</span>
      OTHER BUSINESS
    </div>`

    unsectionedTopics.forEach((topic, idx) => {
      const borderColor = topic.is_incamera ? "#dc2626" : template.agendaItemsColor
      const bgColor = topic.is_incamera ? "#fef2f2" : "#ffffff"

      agendaHtml += `<div class="topic-box" style="border-left-color: ${borderColor}; background-color: ${bgColor};">
        <div>
          <span class="topic-number" style="background-color: ${topic.is_incamera ? "#dc2626" : template.agendaItemsColor};">${sections.length + 1}.${idx + 1}</span>
          <span class="topic-title">${topic.title}${topic.is_incamera ? '<span class="incamera-badge">[CONFIDENTIAL]</span>' : ""}</span>
        </div>`

      if (topic.description && !topic.is_incamera) {
        agendaHtml += `<div class="topic-description">${topic.description}</div>`
      }

      agendaHtml += `</div>`
    })
  }

  return coverHtml + infoCardHtml + agendaHtml
}
