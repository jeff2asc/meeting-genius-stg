"use client"

import { useRef, useState } from "react"
import { Trash2, Copy } from "lucide-react"
import {
  CanvasElement as CanvasElementType,
  A4_WIDTH_MM,
  A4_HEIGHT_MM,
} from "@/lib/canvasUtils"

interface CanvasElementProps {
  element: CanvasElementType
  isSelected: boolean
  scale: number
  pageIndex: number
  onSelect: () => void
  onUpdate: (updates: Partial<CanvasElementType>) => void
  onDelete: () => void
  onDuplicate: () => void
  companyData: { name: string; logo_url: string | null }
  meetingData: any
  sections: any[]
  topics: any[]
}

const MM_TO_PX = 3.7795275591

function formatDate(dateStr: string) {
  if (!dateStr) return ""
  try {
    const d = dateStr.includes("T") ? new Date(dateStr) : new Date(dateStr + "T00:00:00")
    return d.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })
  } catch { return dateStr }
}

export default function CanvasElement({
  element,
  isSelected,
  scale,
  pageIndex,
  onSelect,
  onUpdate,
  onDelete,
  onDuplicate,
  companyData,
  meetingData,
  sections,
  topics,
}: CanvasElementProps) {
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null)
  const resizeRef = useRef<{ startX: number; startY: number; origW: number; origH: number } | null>(null)
  const [isEditing, setIsEditing] = useState(false)

  const pageOffsetY = pageIndex * A4_HEIGHT_MM
  const left = element.position.x * MM_TO_PX * scale
  const top = (element.position.y - pageOffsetY) * MM_TO_PX * scale
  const width = element.size.width * MM_TO_PX * scale
  const height = element.size.height * MM_TO_PX * scale

  // ── Drag ──────────────────────────────────────────────────────────────────
  const handleMouseDown = (e: React.MouseEvent) => {
    if (element.locked) return
    e.stopPropagation()
    onSelect()
    dragRef.current = {
      startX: e.clientX, startY: e.clientY,
      origX: element.position.x, origY: element.position.y,
    }
    const onMove = (mv: MouseEvent) => {
      if (!dragRef.current) return
      const dx = (mv.clientX - dragRef.current.startX) / scale / MM_TO_PX
      const dy = (mv.clientY - dragRef.current.startY) / scale / MM_TO_PX
      const nx = Math.max(0, Math.min(A4_WIDTH_MM - element.size.width, dragRef.current.origX + dx))
      const ny = Math.max(pageOffsetY, dragRef.current.origY + dy)
      onUpdate({ position: { x: Math.round(nx * 10) / 10, y: Math.round(ny * 10) / 10 } })
    }
    const onUp = () => {
      dragRef.current = null
      window.removeEventListener("mousemove", onMove)
      window.removeEventListener("mouseup", onUp)
    }
    window.addEventListener("mousemove", onMove)
    window.addEventListener("mouseup", onUp)
  }

  // ── Resize ─────────────────────────────────────────────────────────────────
  const handleResizeDown = (e: React.MouseEvent) => {
    e.stopPropagation()
    resizeRef.current = {
      startX: e.clientX, startY: e.clientY,
      origW: element.size.width, origH: element.size.height,
    }
    const onMove = (mv: MouseEvent) => {
      if (!resizeRef.current) return
      const dx = (mv.clientX - resizeRef.current.startX) / scale / MM_TO_PX
      const dy = (mv.clientY - resizeRef.current.startY) / scale / MM_TO_PX
      onUpdate({
        size: {
          width: Math.max(10, Math.round((resizeRef.current.origW + dx) * 10) / 10),
          height: Math.max(5, Math.round((resizeRef.current.origH + dy) * 10) / 10),
        }
      })
    }
    const onUp = () => {
      resizeRef.current = null
      window.removeEventListener("mousemove", onMove)
      window.removeEventListener("mouseup", onUp)
    }
    window.addEventListener("mousemove", onMove)
    window.addEventListener("mouseup", onUp)
  }

  // ── Content rendering ──────────────────────────────────────────────────────
  const renderContent = () => {
    const s = element.style || {}
    const fs = typeof s.fontSize === "number" ? s.fontSize * scale : 12 * scale
    const baseTextStyle: React.CSSProperties = {
      fontSize: `${fs}px`,
      fontWeight: s.fontWeight || "normal",
      color: s.color || "#000",
      textAlign: (s.textAlign as any) || "left",
      fontFamily: s.fontFamily || "sans-serif",
      width: "100%",
      height: "100%",
      overflow: "hidden",
      padding: `${2 * scale}px`,
      boxSizing: "border-box",
      whiteSpace: "pre-wrap",
      wordBreak: "break-word",
    }

    if (element.type === "text") {
      if (isEditing) {
        return (
          <textarea
            autoFocus
            value={element.content as string}
            onChange={(e) => onUpdate({ content: e.target.value })}
            onBlur={() => setIsEditing(false)}
            style={{ ...baseTextStyle, background: "transparent", border: "none", outline: "none", resize: "none" }}
          />
        )
      }
      return (
        <div style={baseTextStyle} onDoubleClick={() => setIsEditing(true)}>
          {element.content as string || ""}
        </div>
      )
    }

    if (element.type === "shape" || element.type === "container") {
      return null // background rendered via wrapper styles
    }

    if (element.type === "image") {
      return element.content ? (
        <img src={element.content as string} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
      ) : (
        <div style={{ ...baseTextStyle, display: "flex", alignItems: "center", justifyContent: "center", color: "#9ca3af", fontSize: `${10 * scale}px` }}>
          🖼️ No image
        </div>
      )
    }

    if (element.type === "html_header") {
      const htmlContent = element.content as string || ""
      return (
        <div
          style={{ overflow: "hidden", transform: `scale(${scale})`, transformOrigin: "top left", width: `${element.size.width * MM_TO_PX}px`, height: `${element.size.height * MM_TO_PX}px` }}
          dangerouslySetInnerHTML={{ __html: htmlContent }}
        />
      )
    }

    if (element.type === "dynamic") {
      const contentObj = element.content as any
      const fieldType = contentObj?.type
      const cfg = element.config || {}
      const orientation = cfg.orientation || "horizontal"

      if (!fieldType) return <div style={baseTextStyle}>⚡ Dynamic field</div>

      // ── Document Heading ───────────────────────────────────────────────────
      if (fieldType === "document_heading") {
        const buildingName = companyData.name
        const meetingType = meetingData.meeting_type || "Council Meeting"
        const strataNo = meetingData.strata_plan_number || "VIS1234"
        const dateStr = formatDate(meetingData.meeting_date)
        const timeStr = meetingData.start_time || ""
        const location = meetingData.location || ""
        const headingFormat = cfg.headingFormat || "full_sentence"

        const headingStyle: React.CSSProperties = {
          ...baseTextStyle,
          display: "flex",
          flexDirection: orientation === "vertical" ? "column" : "row",
          flexWrap: "wrap",
          alignItems: orientation === "vertical" ? "flex-start" : "center",
          gap: `${4 * scale}px`,
        }

        if (headingFormat === "full_sentence" || headingFormat === "inline") {
          const sentence = `Minutes of the ${meetingType} of ${buildingName}, Strata Plan ${strataNo}, held on ${dateStr}${timeStr ? " at " + timeStr : ""}${location ? " in " + location : ""}.`
          return <div style={{ ...baseTextStyle, whiteSpace: "normal" }}>{sentence}</div>
        }

        // stacked
        return (
          <div style={{ ...baseTextStyle, display: "flex", flexDirection: "column", gap: `${2 * scale}px`, padding: `${4 * scale}px` }}>
            <div style={{ fontWeight: "bold", fontSize: `${(fs) + 1}px` }}>Minutes of the {meetingType}</div>
            <div>{buildingName} · Strata Plan {strataNo}</div>
            {orientation === "vertical" ? (
              <>
                <div>📅 {dateStr}</div>
                {timeStr && <div>🕐 {timeStr}</div>}
                {location && <div>📍 {location}</div>}
              </>
            ) : (
              <div style={{ display: "flex", gap: `${8 * scale}px`, flexWrap: "wrap" }}>
                <span>📅 {dateStr}</span>
                {timeStr && <span>🕐 {timeStr}</span>}
                {location && <span>📍 {location}</span>}
              </div>
            )}
          </div>
        )
      }

      // ── Attendance Block ───────────────────────────────────────────────────
      if (fieldType === "attendance_block") {
        const attendees = meetingData.attendees || []
        const attendanceStyle = cfg.attendanceStyle || "table"

        if (attendanceStyle === "table" || orientation === "horizontal") {
          return (
            <div style={{ width: "100%", height: "100%", overflow: "hidden", padding: `${2 * scale}px` }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: `${fs}px`, fontFamily: s.fontFamily || "sans-serif", color: s.color || "#000" }}>
                <thead>
                  <tr style={{ backgroundColor: s.backgroundColor || "#f3f4f6" }}>
                    <th style={{ textAlign: "left", padding: `${2 * scale}px ${4 * scale}px`, borderBottom: "1px solid #e5e7eb", fontWeight: "bold" }}>Name</th>
                    <th style={{ textAlign: "left", padding: `${2 * scale}px ${4 * scale}px`, borderBottom: "1px solid #e5e7eb", fontWeight: "bold" }}>Role</th>
                    <th style={{ textAlign: "center", padding: `${2 * scale}px ${4 * scale}px`, borderBottom: "1px solid #e5e7eb", fontWeight: "bold" }}>Present</th>
                  </tr>
                </thead>
                <tbody>
                  {attendees.map((a: any, i: number) => (
                    <tr key={i} style={{ backgroundColor: i % 2 === 0 ? "transparent" : "rgba(0,0,0,0.02)" }}>
                      <td style={{ padding: `${2 * scale}px ${4 * scale}px` }}>{a.name}</td>
                      <td style={{ padding: `${2 * scale}px ${4 * scale}px`, color: "#6b7280" }}>{a.role}</td>
                      <td style={{ padding: `${2 * scale}px ${4 * scale}px`, textAlign: "center" }}>
                        {a.present ? "✓" : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }

        // compact / vertical list
        return (
          <div style={{ ...baseTextStyle, display: "flex", flexDirection: orientation === "vertical" ? "column" : "row", flexWrap: "wrap", gap: `${4 * scale}px` }}>
            {attendees.map((a: any, i: number) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: `${4 * scale}px`, minWidth: orientation !== "vertical" ? "30%" : "100%" }}>
                <span style={{ opacity: 0.5 }}>{a.present ? "●" : "○"}</span>
                <span>{a.name}</span>
                {a.role && <span style={{ color: "#6b7280", fontSize: `${fs - 1}px` }}>({a.role})</span>}
              </div>
            ))}
          </div>
        )
      }

      // ── Other dynamic fields ──────────────────────────────────────────────
      const dynamicValue = getDynamicValue(fieldType, companyData, meetingData, sections, topics)
      return <div style={baseTextStyle}>{dynamicValue}</div>
    }

    return null
  }

  // ── Wrapper styles ─────────────────────────────────────────────────────────
  const s = element.style || {}
  const wrapperStyle: React.CSSProperties = {
    position: "absolute",
    left,
    top,
    width,
    height,
    zIndex: element.zIndex || 1,
    cursor: element.locked ? "default" : "move",
    boxSizing: "border-box",
    overflow: element.type === "html_header" ? "hidden" : "visible",
  }

  if (element.type === "shape" || element.type === "container") {
    wrapperStyle.backgroundColor = s.backgroundColor || (element.type === "shape" ? "#e5e7eb" : "#fff")
    if (s.borderWidth && s.borderWidth !== "0px") {
      wrapperStyle.border = `${s.borderWidth} solid ${s.borderColor || "#000"}`
    }
    if (s.borderRadius !== undefined) {
      wrapperStyle.borderRadius = typeof s.borderRadius === "number" ? `${s.borderRadius}px` : s.borderRadius
    }
  }

  if (isSelected) {
    wrapperStyle.outline = "2px solid #3b82f6"
    wrapperStyle.outlineOffset = "1px"
  }

  return (
    <div style={wrapperStyle} onMouseDown={handleMouseDown} onClick={(e) => { e.stopPropagation(); onSelect() }}>
      {renderContent()}

      {/* Toolbar */}
      {isSelected && !element.locked && (
        <div style={{
          position: "absolute", top: -28 * scale, right: 0,
          display: "flex", gap: `${4 * scale}px`,
          backgroundColor: "#1e293b", borderRadius: `${4 * scale}px`,
          padding: `${2 * scale}px ${4 * scale}px`, zIndex: 9999,
        }}>
          <button onClick={(e) => { e.stopPropagation(); onDuplicate() }}
            style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: `${10 * scale}px`, padding: `${2 * scale}px` }}
            title="Duplicate">
            <Copy size={10 * scale} />
          </button>
          <button onClick={(e) => { e.stopPropagation(); onDelete() }}
            style={{ background: "none", border: "none", color: "#f87171", cursor: "pointer", fontSize: `${10 * scale}px`, padding: `${2 * scale}px` }}
            title="Delete">
            <Trash2 size={10 * scale} />
          </button>
        </div>
      )}

      {/* Resize handle */}
      {isSelected && !element.locked && (
        <div
          onMouseDown={handleResizeDown}
          style={{
            position: "absolute", right: -4, bottom: -4,
            width: 8 * scale, height: 8 * scale,
            backgroundColor: "#3b82f6", borderRadius: "2px",
            cursor: "se-resize", zIndex: 9999,
          }}
        />
      )}
    </div>
  )
}

// ── Dynamic field value resolver ──────────────────────────────────────────────
function getDynamicValue(
  fieldType: string,
  companyData: { name: string; logo_url: string | null },
  meetingData: any,
  sections: any[],
  topics: any[]
): string {
  switch (fieldType) {
    case "company_logo": return companyData.logo_url ? "[Logo]" : "[No Logo]"
    case "building_name": return companyData.name || "Building Name"
    case "meeting_title": return meetingData.title || "Meeting Title"
    case "meeting_type": return meetingData.meeting_type || "Council Meeting"
    case "meeting_date": return formatDate(meetingData.meeting_date)
    case "meeting_time":
    case "start_time": return meetingData.start_time || "7:00 PM"
    case "meeting_location":
    case "location": return meetingData.location || "Community Room"
    case "address": return "123 Main Street, Vancouver, BC"
    case "strata_plan": return meetingData.strata_plan_number || "VIS1234"
    case "topics_list": return sections.map((sec, si) => {
      const secTopics = topics.filter((t) => t.section_id === sec.id)
      return `${si + 1}. ${sec.title}\n` + secTopics.map((t, ti) => `   ${si + 1}.${ti + 1} ${t.title}`).join("\n")
    }).join("\n\n")
    case "sections_list": return sections.map((s, i) => `${i + 1}. ${s.title}`).join("\n")
    case "attendees_list": return (meetingData.attendees || []).map((a: any, i: number) => `${i + 1}. ${a.name}${a.role ? " (" + a.role + ")" : ""}${a.present === false ? " [Absent]" : ""}`).join("\n")
    case "page_number": return "Page 1"
    case "branding": return "Generated by Meeting Genius"
    default: return `[${fieldType}]`
  }
}
