"use client"

import { useState } from "react"
import { Download, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/supabase"
import jsPDF from "jspdf"
import html2canvas from "html2canvas"

interface GenerateMinutesButtonProps {
  meetingId: number
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

const COVER_PAGE_HEIGHT = 175
const COVER_PAGE_WIDTH = 794

interface EditableMinutesInfo {
  startTime: string
  endTime: string
  chairPerson: string
  minuteTaker: string
}

export default function GenerateMinutesButton({
  meetingId,
  buildingId,
}: GenerateMinutesButtonProps) {
  const [generating, setGenerating] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editableInfo, setEditableInfo] = useState<EditableMinutesInfo>({
    startTime: "",
    endTime: "",
    chairPerson: "",
    minuteTaker: "",
  })

  // Load initial values from meeting data
  const loadInitialInfo = async () => {
    const { data: meeting } = await supabase
      .from("meetings")
      .select("start_time, end_time, chair_person, minute_taker")
      .eq("id", meetingId)
      .single()

    if (meeting) {
      setEditableInfo({
        startTime: meeting.start_time || "",
        endTime: meeting.end_time || "",
        chairPerson: meeting.chair_person || "",
        minuteTaker: meeting.minute_taker || "",
      })
    }
    setShowEditModal(true)
  }

  const handleGenerateMinutes = async (finalInfo: EditableMinutesInfo) => {
    setShowEditModal(false)
    setGenerating(true)
    try {
      // 1) Load per-building minutes template from DB
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

      // 2) Load meeting
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
      let notes: any[] = []

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

        const { data: notesData, error: notesError } = await supabase
          .from("notes")
          .select("*")
          .in("topic_id", topicIds)
          .eq("visibility", "public")
          .order("created_at")

        if (notesError) {
          console.error("Error loading notes:", notesError)
        }

        decisions = decisionsData || []
        tasks = tasksData || []
        notes = notesData || []
      }

      const sectionsWithTopics = (sections || []).map((section: any) => ({
        ...section,
        topics: (topics || [])
          .filter((t: any) => t.section_id === section.id)
          .map((topic: any) => ({
            ...topic,
            decisions: decisions.filter((d: any) => d.topic_id === topic.id),
            tasks: tasks.filter((t: any) => t.topic_id === topic.id),
            notes: notes.filter((n: any) => n.topic_id === topic.id),
          })),
      }))

      // 4) Update meeting data with final edited info for PDF generation
      const meetingForPdf = {
        ...meeting,
        start_time: finalInfo.startTime,
        end_time: finalInfo.endTime,
        chair_person: finalInfo.chairPerson,
        minute_taker: finalInfo.minuteTaker,
      }

      // 5) Attendees from meeting.attendees JSONB
      const attendees = (meeting.attendees as any[]) || []

      // 6) Build HTML
      const minutesHtml = buildMinutesHtml({
        template,
        meeting: meetingForPdf,
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
              max-width: 80%;
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
              margin: 16px 20px 20px 20px;
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
              white-space: pre-wrap;
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

            /* ⭐ FIX 1: Full-width section header bar */
            .section-header-bar {
              width: 100%;
              padding: 8px 20px;
              color: white;
              font-size: 13px;
              font-weight: 700;
              display: block;
              margin: 12px 0 0 0;
              border-radius: 0;
              letter-spacing: 0.5px;
            }

            /* ⭐ FIX 3: Section wrapper card contains all topics */
            .section-card {
              margin: 0 0 8px 0;
              border: none;
              background: #ffffff;
            }

            .task-box {
              margin: 6px 16px;
              padding: 8px 12px;
              background: #fff9f0;
              border-left: 3px solid #f59e0b;
              border-radius: 6px;
              font-size: 10px;
              color: #92400e;
            }

            .note-box {
              margin: 4px 16px 8px 16px;
              padding: 8px 12px;
              background: #f0f7ff;
              border-left: 3px solid #3b82f6;
              border-radius: 6px;
              font-size: 10px;
              color: #1e40af;
            }

            .note-icon {
              margin-right: 4px;
              vertical-align: middle;
              display: inline-block;
            }

            .topic-block {
              padding: 6px 16px 12px 16px;
              margin-bottom: 8px;
            }

            /* ⭐ FIX 2: Topic sub-number title */
            .topic-subtitle {
              font-size: 11px;
              font-weight: 700;
              color: #1f2937;
              margin-bottom: 4px;
            }

            .topic-description {
              font-size: 10px;
              color: #4b5563;
              margin-bottom: 6px;
              white-space: pre-wrap;
            }

            .motion-box {
              margin-top: 10px;
              padding: 12px 14px 14px 14px;
              border-radius: 8px;
              border-width: 2px;
              border-style: solid;
            }

            .motion-badge {
              display: inline-block;
              color: white;
              font-weight: 700;
              font-size: 8.5px;
              padding: 4px 10px 5px 10px;
              border-radius: 4px;
              margin-bottom: 8px;
              line-height: normal;
              text-transform: uppercase;
            }

            .motion-text {
              font-size: 10px;
              font-weight: 600;
              color: #1f2937;
              margin-bottom: 10px;
              white-space: pre-wrap;
              display: block;
            }

            .decision-badge {
              display: inline-block;
              color: white;
              font-size: 8.5px;
              padding: 4px 10px 5px 10px;
              border-radius: 4px;
              margin-bottom: 10px;
              line-height: normal;
              text-transform: uppercase;
            }

            .votes-bar {
              color: white;
              font-size: 9px;
              padding: 6px 10px;
              border-radius: 4px;
              display: flex;
              gap: 16px;
            }

            .incamera-strip {
              margin: 8px 16px;
              padding: 8px 10px;
              border-radius: 6px;
              background: #fef2f2;
              border: 1px solid #fecaca;
              font-size: 10px;
              color: #b91c1c;
            }

            /* Topics & Discussion badge */
            .topics-badge {
              display: inline-block;
              margin: 12px 20px 8px 20px;
              padding: 8px 14px;
              color: white;
              border-radius: 8px;
              font-size: 12px;
              font-weight: 700;
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

      // ── Collect element boundaries BEFORE removing iframe ──────────────
      // We query all "avoid-break" elements and store their top/bottom in
      // canvas pixels (DOM px × scale factor) so we can snap page cuts to gaps.
      const CANVAS_SCALE = 2 // must match html2canvas scale above
      const BOUNDARY_PADDING = 4 * CANVAS_SCALE // use small 4px buffer so gaps remain unprotected for cutting

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
        ".motion-box",
        ".section-header-bar",
        ".attendees-section",
        ".info-card",
        ".note-box",
        ".task-box",
        ".topic-meta",
        ".incamera-strip",
        ".topics-badge",
      ]
      const breakBoundaries: Array<{ top: number; bottom: number }> = []

      const bodyRect = iframeDoc.documentElement.getBoundingClientRect()

      avoidBreakSelectors.forEach((sel) => {
        iframeDoc.querySelectorAll(sel).forEach((el) => {
          const htmlEl = el as HTMLElement
          const rect = htmlEl.getBoundingClientRect()

          // Absolute Y relative to the top of the iframe document
          const domTop = rect.top - bodyRect.top
          const domBottom = rect.bottom - bodyRect.top

          breakBoundaries.push({
            // Floor/Ceil to ensure we don't slice due to sub-pixels
            top: Math.floor(domTop * CANVAS_SCALE - BOUNDARY_PADDING),
            bottom: Math.ceil(domBottom * CANVAS_SCALE + BOUNDARY_PADDING),
          })
        })
      })
      // Sort boundaries by position
      breakBoundaries.sort((a, b) => a.top - b.top)

      document.body.removeChild(iframe)

      const fullWidth = canvas.width
      const fullHeight = canvas.height
      const pageCanvasHeight =
        (usablePageHeight * canvas.width) / (pageWidth - margin * 2)

      /**
       * Given a naturalCut Y, return the best safe Y to cut at.
       * If naturalCut is inside a protected boundary, move it back to boundary.top.
       */
      const findSafeBreak = (naturalCut: number): number => {
        if (naturalCut >= fullHeight) return naturalCut

        let bestBreak = naturalCut

        for (const boundary of breakBoundaries) {
          // If the natural cut falls inside this protected element
          if (naturalCut > boundary.top && naturalCut < boundary.bottom) {
            // Push the cut back to the top of this element
            // We take the minimum to handle overlapping/nested protections
            if (boundary.top < bestBreak) {
              bestBreak = boundary.top
            }
          }
        }

        // Safety: If pushing back would result in a zero-height page 
        // (meaning the element is taller than a page), we MUST cut it.
        // Or if we pushed back more than 90% of a page (rare).
        if (bestBreak <= renderedHeight + 50) {
          return naturalCut
        }

        return bestBreak
      }

      let renderedHeight = 0
      let pageIndex = 0

      while (renderedHeight < fullHeight) {
        let naturalCut = Math.floor(Math.min(renderedHeight + pageCanvasHeight, fullHeight))

        let cutAt = naturalCut
        if (naturalCut < fullHeight) {
          cutAt = Math.floor(findSafeBreak(naturalCut))
        }

        const sliceHeight = Math.floor(Math.min(cutAt - renderedHeight, fullHeight - renderedHeight))

        // Safety guard: if no progress is made, force advance
        if (sliceHeight <= 10) {
          const forceHeight = Math.floor(Math.min(200, fullHeight - renderedHeight))
          const pageCanvas = document.createElement("canvas")
          pageCanvas.width = fullWidth
          pageCanvas.height = forceHeight
          const pageCtx = pageCanvas.getContext("2d")
          if (pageCtx) {
            pageCtx.drawImage(canvas, 0, renderedHeight, fullWidth, forceHeight, 0, 0, fullWidth, forceHeight)
            const imgData = pageCanvas.toDataURL("image/jpeg", 0.95)
            if (pageIndex > 0) pdf.addPage()
            pdf.addImage(imgData, "JPEG", margin, margin, pageWidth - margin * 2, (forceHeight * (pageWidth - margin * 2)) / fullWidth)
            renderedHeight += forceHeight
            pageIndex++
          } else {
            renderedHeight += 10
          }
          continue
        }

        const pageCanvas = document.createElement("canvas")
        pageCanvas.width = fullWidth
        pageCanvas.height = sliceHeight

        const pageCtx = pageCanvas.getContext("2d")
        if (!pageCtx) break

        pageCtx.drawImage(
          canvas,
          0,
          renderedHeight,
          fullWidth,
          sliceHeight,
          0,
          0,
          fullWidth,
          sliceHeight
        )

        const imgData = pageCanvas.toDataURL("image/jpeg", 0.95)

        if (pageIndex > 0) {
          pdf.addPage()
        }

        const imgWidth = pageWidth - margin * 2
        const imgHeight = (sliceHeight * imgWidth) / fullWidth

        pdf.addImage(imgData, "JPEG", margin, margin, imgWidth, imgHeight)

        renderedHeight += sliceHeight
        pageIndex++
      }

      const safeTitle = (meeting.title || "Meeting")
        .replace(/[^a-z0-9]/gi, "_")
        .substring(0, 80)

      const fileName = `${safeTitle}_Minutes_${new Date().toISOString().split("T")[0]
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
    <>
      <Button
        onClick={loadInitialInfo}
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

      {/* Edit Info Dialog */}
      {showEditModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="bg-gradient-to-r from-primary to-primary/80 px-6 py-4">
              <h3 className="text-xl font-bold text-white">Finalize Meeting Info</h3>
              <p className="text-white/80 text-sm">Verify details before generating minutes</p>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Start Time</label>
                  <input
                    type="time"
                    value={editableInfo.startTime}
                    onChange={(e) => setEditableInfo({ ...editableInfo, startTime: e.target.value })}
                    className="w-full px-3 py-2 bg-muted/30 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase">End Time</label>
                  <input
                    type="time"
                    value={editableInfo.endTime}
                    onChange={(e) => setEditableInfo({ ...editableInfo, endTime: e.target.value })}
                    className="w-full px-3 py-2 bg-muted/30 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase">Chair Person</label>
                <input
                  type="text"
                  placeholder="e.g. John Doe"
                  value={editableInfo.chairPerson}
                  onChange={(e) => setEditableInfo({ ...editableInfo, chairPerson: e.target.value })}
                  className="w-full px-3 py-2 bg-muted/30 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase">Minute Taker</label>
                <input
                  type="text"
                  placeholder="e.g. Jane Smith"
                  value={editableInfo.minuteTaker}
                  onChange={(e) => setEditableInfo({ ...editableInfo, minuteTaker: e.target.value })}
                  className="w-full px-3 py-2 bg-muted/30 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
            </div>

            <div className="px-6 py-4 bg-muted/30 flex justify-end gap-3">
              <button
                onClick={() => setShowEditModal(false)}
                className="px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleGenerateMinutes(editableInfo)}
                className="px-6 py-2 bg-primary text-white text-sm font-bold rounded-lg shadow-lg hover:bg-primary/90 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                Generate PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// -------- Helpers --------

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
    meeting.status === "minutes" || meeting.status === "working_minutes"

  const building = meeting.buildings

  let html = ""

  const safeCoverColor =
    template.coverPageColor && template.coverPageColor.trim()
      ? template.coverPageColor
      : "#1e3a8a"

  // COVER
  html += `
    <div class="cover" style="height:${COVER_PAGE_HEIGHT}px;background:${safeCoverColor};">
      <div class="cover-inner">
        ${renderCoverElements(template.coverPageElements, {
    logoUrl,
    meeting,
    building,
    documentType: "MEETING MINUTES",
  })}
      </div>
    </div>
  `

  // INFO CARD
  html += renderInfoCard(template, meeting, attendees)

  // ATTENDEES
  html += renderAttendeesSection(template, attendees)

  // TOPICS & DISCUSSION badge
  html += `
    <div class="topics-badge" style="background:${template.sectionHeadersColor};">
      📝 Topics &amp; Discussion
    </div>
  `

  // SECTIONS
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
            ${ctx.logoUrl
            ? `<img src="${escapeHtml(ctx.logoUrl)}" />`
            : `<span style="font-size:42px;">🏢</span>`
          }
          </div>
        `
      } else if (el.id === "title") {
        inner = `
          <div style="text-align:center;">
            <div class="cover-title-line" style="font-size:26px;">MEETING</div>
            <div class="cover-title-line" style="font-size:26px;">MINUTES</div>
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
          style="left:${el.x}%;top:${el.y}%;text-align:${el.align};"
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
      <div class="info-card-header" style="background:${template.infoCardAccentColor};">
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
      <div class="attendees-header" style="background:${template.infoCardAccentColor};">
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
        <tbody>${rows}</tbody>
      </table>
    </div>
  `
}

// ⭐ FULLY UPDATED: Matches template editor preview exactly
function renderSectionsAndTopics(
  template: MinutesTemplate,
  sections: any[],
  isMinutes: boolean
): string {
  let html = ""

  sections.forEach((section, sectionIndex) => {
    const rawTitle = typeof section.title === "string" ? section.title : ""
    const cleanedTitle = rawTitle.replace(
      /^\s*\d+(\.\d+)*\s*[\).\-\:]*\s*/,
      ""
    )
    html += `<div class="section-header-bar" style="background:${template.sectionHeadersColor};">${escapeHtml(`${sectionIndex + 1}. ${(cleanedTitle || rawTitle).trim()}`)}</div>`

    // ⭐ FIX 3: One section card wrapping all topics
    html += `<div class="section-card">`

    if (section.topics && section.topics.length > 0) {
      section.topics.forEach((topic: any, topicIndex: number) => {
        const isIncamera = topic.is_incamera === true

        if (isIncamera) {
          html += `
            <div class="incamera-strip">
              <strong>IN-CAMERA:</strong> ${escapeHtml(topic.title)}
            </div>
          `
          return
        }

        html += `<div class="topic-block">`

        // NEW: Group the topic header info so it stays together
        html += `<div class="topic-meta">`
        html += `<div class="topic-subtitle">${escapeHtml(`${sectionIndex + 1}.${topicIndex + 1} ${(topic.title || "").trim()}`)}</div>`

        if (topic.description && topic.description.trim()) {
          html += `<div class="topic-description">${escapeHtml(topic.description.trim())}</div>`
        }
        html += `</div>` // close topic-meta

        // Reordered: Decisions (Motions) first, then Public Notes. Tasks removed.
        
        // Motion boxes matching the editor preview
        if (topic.decisions && topic.decisions.length > 0) {
          topic.decisions.forEach((decision: any, decisionIdx: number) => {
            const motionNumber = `${sectionIndex + 1}.${topicIndex + 1}`
            const votesFor = decision.votes_for || 0
            const votesAgainst = decision.votes_against || 0
            const votesAbstain = decision.votes_abstain || 0

            // Light background from motionBoxesColor
            const hex = template.motionBoxesColor.replace("#", "")
            const r = Math.min(255, parseInt(hex.substring(0, 2), 16) + 220)
            const g = Math.min(255, parseInt(hex.substring(2, 4), 16) + 220)
            const b = Math.min(255, parseInt(hex.substring(4, 6), 16) + 220)
            const lightBg = `rgb(${r},${g},${b})`

            html += `
              <div 
                class="motion-box"
                style="border-color:${template.motionBoxesColor};background:${lightBg};"
              >
                <div><span class="motion-badge" style="background:${template.motionBoxesColor};">MOTION ${escapeHtml(motionNumber)}</span></div>
                <div class="motion-text">${escapeHtml((decision.motion_text || "").trim())}</div>
                ${decision.result && decision.result.trim()
                ? `<div><span class="decision-badge" style="background:${template.voteResultsColor};"><strong>Decision:</strong> ${escapeHtml(decision.result.trim())}</span></div>`
                : ""
              }
                <div class="votes-bar" style="background:${template.voteResultsColor};">
                  <span><strong>FOR:</strong> ${votesFor}</span>
                  <span><strong>AGAINST:</strong> ${votesAgainst}</span>
                  <span><strong>ABSTAIN:</strong> ${votesAbstain}</span>
                </div>
              </div>
            `
          })
        }

        if (topic.notes && topic.notes.length > 0) {
          topic.notes.forEach((note: any) => {
            const content = (note.content || "").trim()
            if (!content) return
            html += `<div class="note-box"><span class="note-icon">🌐</span><strong>NOTE:</strong> ${escapeHtml(content)}</div>`
          })
        }

        html += `</div>` // close topic-block
      })
    } else {
      html += `
        <div class="topic-block" style="font-style:italic;color:#9ca3af;font-size:10px;">
          No topics recorded for this section.
        </div>
      `
    }

    html += `</div>` // close section-card
  })

  return html
}

// ------------ Small helpers ------------

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
