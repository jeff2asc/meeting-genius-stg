"use client"

import { useState } from "react"
import { Download, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/supabase"
import jsPDF from "jspdf"
import html2canvas from "html2canvas"
import { formatUtcToLocalLong, formatUtcToLocalShort } from "@/lib/timezone"

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
  sectionHeaderTextColor: string
  richTextBlocks: any[]
}

const COVER_PAGE_HEIGHT = 175
const COVER_PAGE_WIDTH = 794

export default function GenerateAgendaButton({
  meetingId,
  meetingStatus,
}: GenerateAgendaButtonProps) {
  const [generating, setGenerating] = useState(false)

  const handleGenerateAgenda = async () => {
    setGenerating(true)
    try {
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

      const meetingData = meeting as any

      if (meetingError || !meeting) {
        console.error("Failed to load meeting data:", meetingError)
        alert("Failed to load meeting data")
        setGenerating(false)
        return
      }

      const buildingId = meetingData?.buildings?.id
      if (!buildingId) {
        alert("Building information not found")
        setGenerating(false)
        return
      }

      const { data: templateRow, error: templateError } = await supabase
        .from("agendatemplates")
        .select(
          `
          coverpage_elements,
          infocard_fields,
          coverpage_color,
          infocard_accent_color,
          agenda_items_color,
          section_header_text_color,
          rich_text_blocks,
          updatedat
        `
        )
        .eq("buildingid", buildingId)
        .order("updatedat", { ascending: false })
        .limit(1)
        .maybeSingle()

      if (templateError) {
        console.error("Error loading agenda template:", templateError)
      }

      const defaultTemplate: AgendaTemplate = {
        coverPageElements: [
          { id: "logo", label: "Company Logo", enabled: true, x: 10, y: 15, align: "left" },
          { id: "title", label: "MEETING AGENDA", enabled: true, x: 50, y: 40, align: "center" },
          { id: "building_name", label: "Building Name", enabled: true, x: 50, y: 60, align: "center" },
          { id: "meeting_type", label: "Meeting Type", enabled: true, x: 50, y: 70, align: "center" },
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
        coverPageHeight: COVER_PAGE_HEIGHT,
        sectionHeaderTextColor: "white",
        richTextBlocks: [],
      }

      let template: AgendaTemplate = defaultTemplate

      if (templateRow) {
        const row = templateRow as any
        template = {
          ...defaultTemplate,
          coverPageColor: row.coverpage_color || defaultTemplate.coverPageColor,
          infoCardAccentColor: row.infocard_accent_color || defaultTemplate.infoCardAccentColor,
          agendaItemsColor: row.agenda_items_color || defaultTemplate.agendaItemsColor,
          coverPageHeight: COVER_PAGE_HEIGHT,
          coverPageElements:
            Array.isArray(row.coverpage_elements) && row.coverpage_elements.length > 0
              ? (row.coverpage_elements as unknown as CoverPageElement[])
              : defaultTemplate.coverPageElements,
          infoCardFields:
            Array.isArray(row.infocard_fields) && row.infocard_fields.length > 0
              ? (row.infocard_fields as unknown as TemplateField[])
              : defaultTemplate.infoCardFields,
          sectionHeaderTextColor: row.section_header_text_color || defaultTemplate.sectionHeaderTextColor,
          richTextBlocks: Array.isArray(row.rich_text_blocks) ? row.rich_text_blocks : defaultTemplate.richTextBlocks,
        }
      }

      const building = meetingData?.buildings
      const company = building?.companies
      const logoUrl: string | null = building?.logo_url || company?.logo_url || null

      const { data: sections, error: sectionsError } = await supabase
        .from("sections")
        .select("*")
        .eq("meeting_id", meetingId)
        .order("order_index")

      if (sectionsError) console.error("Error loading sections:", sectionsError)

      const { data: topics, error: topicsError } = await supabase
        .from("topics")
        .select("id, title, description, section_id, order_index, is_incamera, time_per_topic")
        .eq("meeting_id", meetingId)
        .order("order_index")

      if (topicsError) console.error("Error loading topics:", topicsError)

      const agendaHtml = buildAgendaHtml({
        template,
        meeting: meetingData,
        sections: sections || [],
        topics: topics || [],
        logoUrl,
        meetingStartTime: meetingData?.start_time || null,
      })

      const iframe = document.createElement("iframe")
      iframe.style.position = "absolute"
      iframe.style.left = "-9999px"
      iframe.style.width = `${COVER_PAGE_WIDTH}px`
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
            @page { size: letter; margin: 0.75in; }
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              font-size: 11pt;
              line-height: 1.6;
              color: #1f2937;
              background: white;
              width: ${COVER_PAGE_WIDTH}px;
            }
            .cover {
              width: 100%;
              height: ${COVER_PAGE_HEIGHT}px;
              position: relative;
              overflow: hidden;
              color: white;
            }
            .cover-element {
              position: absolute;
              max-width: 80%;
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
              line-height: 1.1;
            }
            .info-card {
              margin: 24px 0 20px 0;
              border-radius: 10px;
              overflow: hidden;
              border: 1px solid #e5e7eb;
              box-shadow: 0 2px 6px rgba(0,0,0,0.08);
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
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: 16px;
            }
            .info-field {
              display: block;
              font-size: 10px;
            }
            .info-label {
              font-weight: 700;
              text-transform: uppercase;
              color: #6b7280;
              margin-bottom: 3px;
              font-size: 9px;
            }
            .info-value {
              font-size: 11px;
              color: #111827;
              font-weight: 600;
              white-space: pre-wrap;
            }
            .agenda-header {
              margin: 20px 0 12px 0;
              padding: 10px 14px;
              color: white;
              border-radius: 8px;
              font-size: 14px;
              font-weight: 700;
              letter-spacing: 1px;
              width: 100%;
            }
            .section-header {
              margin: 20px 0 12px 0;
              padding: 8px 12px;
              color: white;
              border-radius: 8px;
              font-size: 12px;
              font-weight: 700;
              width: 100%;
            }
            .topic-box {
              margin: 0 0 14px 0;
              padding: 12px 14px;
              border-radius: 8px;
              background: #ffffff;
              border: 1px solid #e5e7eb;
              border-left-width: 4px;
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
              white-space: pre-wrap;
            }
            .topic-number {
              display: inline-block;
              width: 26px;
              height: 26px;
              border-radius: 50%;
              color: white;
              font-size: 9px;
              font-weight: 700;
              margin-right: 8px;
              vertical-align: middle;
              text-align: center;
              line-height: 1;
              padding-top: 10px;
              box-sizing: border-box;
            }
            .topic-time-chip {
              display: inline-flex;
              align-items: center;
              gap: 3px;
              background: #f0f4ff;
              border: 1px solid #c7d7fa;
              color: #3b5bdb;
              padding: 2px 7px;
              border-radius: 20px;
              font-size: 9px;
              font-weight: 700;
              letter-spacing: 0.3px;
              margin-top: 5px;
              white-space: nowrap;
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

      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "letter",
      })

      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()
      const margin = 10
      const usablePageHeight = pageHeight - margin * 2

      // ── Collect element boundaries BEFORE removing iframe ──────────────
      const CANVAS_SCALE = 2 // must match html2canvas scale above
      const BOUNDARY_PADDING = 8 * CANVAS_SCALE

      const getDocumentOffset = (el: HTMLElement): number => {
        let top = 0
        let current: HTMLElement | null = el
        while (current) {
          top += current.offsetTop
          current = current.offsetParent as HTMLElement | null
        }
        return top
      }

      const avoidBreakSelectors = [
        ".topic-box",
        ".section-header",
        ".info-card",
      ]
      const breakBoundaries: Array<{ top: number; bottom: number }> = []

      const bodyRect = iframeDoc.documentElement.getBoundingClientRect()

      avoidBreakSelectors.forEach((sel) => {
        iframeDoc.querySelectorAll(sel).forEach((el) => {
          const htmlEl = el as HTMLElement
          const rect = htmlEl.getBoundingClientRect()
          const domTop = rect.top - bodyRect.top
          const domBottom = rect.bottom - bodyRect.top

          breakBoundaries.push({
            top: Math.floor(domTop * CANVAS_SCALE - BOUNDARY_PADDING),
            bottom: Math.ceil(domBottom * CANVAS_SCALE + BOUNDARY_PADDING),
          })
        })
      })
      breakBoundaries.sort((a, b) => a.top - b.top)

      const canvas = await html2canvas(iframeDoc.body, {
        scale: CANVAS_SCALE,
        backgroundColor: "#ffffff",
        logging: false,
        useCORS: true,
        windowWidth: COVER_PAGE_WIDTH,
      })

      document.body.removeChild(iframe)

      const fullWidth = canvas.width
      const fullHeight = canvas.height
      const pageCanvasHeight = (usablePageHeight * canvas.width) / (pageWidth - margin * 2)

      const findSafeBreak = (naturalCut: number): number => {
        if (naturalCut >= fullHeight) return naturalCut

        let bestBreak = naturalCut

        for (const boundary of breakBoundaries) {
          // If the natural cut falls inside this protected element
          if (naturalCut > boundary.top && naturalCut < boundary.bottom) {
            // Push the cut back to the top of this element
            if (boundary.top < bestBreak) {
              bestBreak = boundary.top
            }
          }
        }

        // Safety: If pushing back would result in a zero-height page, cut it
        if (bestBreak <= renderedHeight + 50) {
          return naturalCut
        }

        return bestBreak
      }

      let renderedHeight = 0
      let pageIndex = 0

      while (renderedHeight < fullHeight) {
        const naturalCut = Math.min(renderedHeight + pageCanvasHeight, fullHeight)

        let cutAt = naturalCut
        if (naturalCut < fullHeight) {
          cutAt = findSafeBreak(Math.floor(naturalCut))
        }

        const sliceHeight = Math.min(cutAt - renderedHeight, fullHeight - renderedHeight)

        if (sliceHeight <= 0) {
          renderedHeight += 10
          continue
        }

        const pageCanvas = document.createElement("canvas")
        pageCanvas.width = fullWidth
        pageCanvas.height = Math.ceil(sliceHeight)

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

        if (pageIndex > 0) pdf.addPage()

        const imgWidth = pageWidth - margin * 2
        const imgHeight = (pageCanvas.height * imgWidth) / fullWidth

        pdf.addImage(imgData, "JPEG", margin, margin, imgWidth, imgHeight)

        renderedHeight += pageCanvas.height
        pageIndex++
      }

      const safeTitle = (meetingData?.title || "Meeting")
        .replace(/[^a-z0-9]/gi, "_")
        .substring(0, 80)

      const fileName = `${safeTitle}_Agenda_${new Date().toISOString().split("T")[0]}.pdf`
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

function buildAgendaHtml({
  template,
  meeting,
  sections,
  topics,
  logoUrl,
  meetingStartTime,
}: {
  template: AgendaTemplate
  meeting: any
  sections: any[]
  topics: any[]
  logoUrl: string | null
  meetingStartTime: string | null
}): string {
  const formatDate = (dateStr: string) => {
    return formatUtcToLocalLong(dateStr)
  }

  const formatTime = (timeStr: string | null) => {
    return formatUtcToLocalShort(timeStr || "", meeting.meeting_date)
  }

  const escapeHtml = (text: any): string => {
    if (!text) return ""
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;")
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

  // ⭐ NEW: Build a flat ordered list of topics (section-ordered, topic-ordered)
  // so we can compute a running timeline across all topics.
  const orderedSections = [...sections].sort((a, b) => a.order_index - b.order_index)
  const flatTopics: Array<{ sectionId: number; topic: any }> = []
  orderedSections.forEach((section) => {
    const sectionTopics = topics
      .filter((t) => t.section_id === section.id)
      .sort((a, b) => a.order_index - b.order_index)
    sectionTopics.forEach((t) => flatTopics.push({ sectionId: section.id, topic: t }))
  })

  // Parse meeting start time into minutes we can advance
  let runningMinutes: number | null = null
  if (meetingStartTime) {
    try {
      // start_time is stored as "HH:MM:SS" — parse parts directly (new Date on a time-only string is invalid)
      const timeParts = meetingStartTime.split(':').map(Number)
      if (timeParts.length >= 2 && !isNaN(timeParts[0]) && !isNaN(timeParts[1])) {
        runningMinutes = timeParts[0] * 60 + timeParts[1]
      }
    } catch { /* ignore */ }
  }

  // Build a map: topicId -> { startMin, endMin } for display
  const topicTimings = new Map<number, { startMin: number; endMin: number }>()
  if (runningMinutes !== null) {
    flatTopics.forEach(({ topic: t }) => {
      const alloc = typeof t.time_per_topic === 'number' ? t.time_per_topic : null
      if (alloc !== null && alloc > 0) {
        topicTimings.set(t.id, { startMin: runningMinutes!, endMin: runningMinutes! + alloc })
        runningMinutes! // TS narrowing
        ;(runningMinutes as number) += alloc
      }
    })
  }

  const fmtMinutes = (totalMin: number): string => {
    const h = Math.floor(totalMin / 60) % 24
    const m = totalMin % 60
    const ampm = h >= 12 ? 'PM' : 'AM'
    const displayH = h % 12 === 0 ? 12 : h % 12
    return `${displayH}:${String(m).padStart(2, '0')} ${ampm}`
  }

  let coverHtml = `<div class="cover" style="background-color: ${template.coverPageColor};">`

  template.coverPageElements
    .filter((el) => el.enabled)
    .forEach((element) => {
      // Use EXACT same positioning as the template editor:
      // left/top as percentages + CSS transform for alignment
      let transformStyle = "translate(0, -50%)"
      if (element.align === "center") {
        transformStyle = "translate(-50%, -50%)"
      } else if (element.align === "right") {
        transformStyle = "translate(-100%, -50%)"
      }

      const posStyle = `left: ${element.x}%; top: ${element.y}%; transform: ${transformStyle};`

      if (element.id === "logo" && logoUrl) {
        coverHtml += `<div class="cover-element cover-logo" style="${posStyle}">
          <img src="${logoUrl}" alt="Logo" />
        </div>`
      } else if (element.id === "title") {
        coverHtml += `<div class="cover-element" style="${posStyle} text-align: center;">
          <div class="cover-title-line" style="font-size: 46px;">MEETING</div>
          <div class="cover-title-line" style="font-size: 46px;">AGENDA</div>
        </div>`
      } else if (element.id === "building_name") {
        coverHtml += `<div class="cover-element" style="${posStyle} font-size: 24px; color: rgba(200, 220, 255, 0.95); text-align: ${element.align};">
          ${escapeHtml(building?.name || "")}
        </div>`
      } else if (element.id === "meeting_type") {
        coverHtml += `<div class="cover-element" style="${posStyle} font-size: 18px; color: rgba(200, 220, 255, 0.9); text-align: ${element.align};">
          ${escapeHtml(meeting.meeting_type || "Council Meeting")}
        </div>`
      }
    })

  coverHtml += "</div>"

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
      if (field.id === "date") value = formatDate(meeting.meeting_date)
      else if (field.id === "time") value = formatTime(meeting.start_time) || "TBA"
      else if (field.id === "location") value = meeting.location || "TBA"
      else if (field.id === "address") value = building?.address || "TBA"
      else if (field.id === "strata_plan") value = meeting.strata_plan_number || "TBA"

      infoCardHtml += `<div class="info-field">
        <div class="info-label">${escapeHtml(field.label)}</div>
        <div class="info-value">${escapeHtml(value)}</div>
      </div>`
    })

  infoCardHtml += "</div></div>"

  // Feature 1 & 3: Render Header Text Blocks
  let headerBlocksHtml = ""
  const meetingType = meeting.meeting_type || ""
  if (Array.isArray(template.richTextBlocks)) {
    template.richTextBlocks
      .filter(b => b.slot === 'header')
      .filter(b => {
        if (!b.meetingTypeFilter || b.meetingTypeFilter.length === 0) return true
        return b.meetingTypeFilter.some((f: string) => 
          meetingType.toLowerCase().includes(f.toLowerCase()) || 
          f.toLowerCase().includes(meetingType.toLowerCase())
        )
      })
      .sort((a, b) => a.order - b.order)
      .forEach(block => {
        headerBlocksHtml += `
          <div style="
            margin: 0 0 16px 0;
            padding: 0 4px;
            font-size: ${block.fontSize}pt;
            text-align: ${block.textAlign};
            font-weight: ${block.bold ? 'bold' : 'normal'};
            font-style: ${block.italic ? 'italic' : 'normal'};
            white-space: pre-wrap;
            color: #1f2937;
            line-height: 1.4;
          ">
            ${escapeHtml(block.content)}
          </div>`
      })
  }

  let agendaHtml = `<div class="agenda-header" style="background-color: ${template.agendaItemsColor};">
    AGENDA ITEMS
  </div>`

  const topicsBySection: Record<number, any[]> = {}
  topics.forEach((topic) => {
    if (topic.section_id) {
      if (!topicsBySection[topic.section_id]) topicsBySection[topic.section_id] = []
      topicsBySection[topic.section_id].push(topic)
    }
  })

  Object.keys(topicsBySection).forEach((sectionId) => {
    topicsBySection[Number(sectionId)].sort((a, b) => a.order_index - b.order_index)
  })

  const makeCircle = (text: string, color: string) => {
    const fontSize = text.length > 2 ? 7 : 9
    return `<svg width="24" height="24" viewBox="0 0 24 24" style="display:inline-block;vertical-align:middle;margin-right:8px;" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="12" fill="${color}"/>
      <text x="12" y="12" text-anchor="middle" dominant-baseline="central" font-size="${fontSize}" font-weight="700" fill="white" font-family="Segoe UI,sans-serif">${text}</text>
    </svg>`
  }

  sections
    .sort((a, b) => a.order_index - b.order_index)
    .forEach((section, sectionIdx) => {
      const sectionTopics = topicsBySection[section.id] || []
      const lighterColor = getLighterColor(template.agendaItemsColor)

      agendaHtml += `<div class="section-header" style="background-color: ${lighterColor}; color: ${template.sectionHeaderTextColor || 'white'};">
        ${makeCircle(String(sectionIdx + 1), template.agendaItemsColor)}
        ${section.title.toUpperCase()}
      </div>`

      sectionTopics.forEach((topic, topicIdx) => {
        const borderColor = topic.is_incamera ? "#dc2626" : template.agendaItemsColor
        const bgColor = topic.is_incamera ? "#fef2f2" : "#ffffff"
        const topicColor = topic.is_incamera ? "#dc2626" : template.agendaItemsColor

        // ⭐ NEW: Compute time chip HTML
        let timeChipHtml = ""
        const timing = topicTimings.get(topic.id)
        if (timing) {
          const alloc = topic.time_per_topic as number
          timeChipHtml = `<div class="topic-time-chip">&#9201; ${fmtMinutes(timing.startMin)} &ndash; ${fmtMinutes(timing.endMin)} &nbsp;(${alloc} min)</div>`
        } else if (typeof topic.time_per_topic === 'number' && topic.time_per_topic > 0) {
          // Has time but no start_time on meeting → show duration only
          timeChipHtml = `<div class="topic-time-chip">&#9201; ${topic.time_per_topic} min</div>`
        }

        agendaHtml += `<div class="topic-box" style="border-left-color: ${borderColor}; background-color: ${bgColor};">
          <div>
            ${makeCircle(`${sectionIdx + 1}.${topicIdx + 1}`, topicColor)}
            <span class="topic-title">${topic.title}${topic.is_incamera ? '<span class="incamera-badge">[CONFIDENTIAL]</span>' : ""}</span>
          </div>`

        if (timeChipHtml) {
          agendaHtml += timeChipHtml
        }

        if (topic.description && !topic.is_incamera) {
          agendaHtml += `<div class="topic-description">${escapeHtml(topic.description)}</div>`
        }

        agendaHtml += `</div>`
      })
    })

  // Feature 1 & 3: Render Footer Text Blocks
  let footerBlocksHtml = ""
  if (Array.isArray(template.richTextBlocks)) {
    template.richTextBlocks
      .filter(b => b.slot === 'footer')
      .filter(b => {
        if (!b.meetingTypeFilter || b.meetingTypeFilter.length === 0) return true
        return b.meetingTypeFilter.some((f: string) => 
          meetingType.toLowerCase().includes(f.toLowerCase()) || 
          f.toLowerCase().includes(meetingType.toLowerCase())
        )
      })
      .sort((a, b) => a.order - b.order)
      .forEach(block => {
        footerBlocksHtml += `
          <div style="
            margin: 24px 0 0 0;
            padding: 12px 4px 0 4px;
            border-top: 1px solid #e5e7eb;
            font-size: ${block.fontSize}pt;
            text-align: ${block.textAlign};
            font-weight: ${block.bold ? 'bold' : 'normal'};
            font-style: ${block.italic ? 'italic' : 'normal'};
            white-space: pre-wrap;
            color: #4b5563;
            line-height: 1.4;
          ">
            ${escapeHtml(block.content)}
          </div>`
      })
  }

  return headerBlocksHtml + coverHtml + infoCardHtml + agendaHtml + footerBlocksHtml
}
