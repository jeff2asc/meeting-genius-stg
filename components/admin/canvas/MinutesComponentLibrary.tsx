"use client"

import { useState } from "react"
import { ElementType } from "@/lib/canvasUtils"
import { MinutesDynamicFieldType, getMinutesDynamicFieldName, MINUTES_FIELD_CATEGORIES } from "@/lib/minutesCanvasUtils"
import { ChevronDown, ChevronRight } from "lucide-react"

interface MinutesComponentLibraryProps {
  onAddElement: (type: ElementType, dynamicFieldType?: MinutesDynamicFieldType) => void
}

const STATIC_ELEMENTS: { type: ElementType; label: string; icon: string; description: string }[] = [
  { type: "text", label: "Text", icon: "T", description: "Static text block" },
  { type: "shape", label: "Shape / Divider", icon: "▬", description: "Rectangle, bar or divider" },
  { type: "container", label: "Container", icon: "⬜", description: "Bordered card container" },
  { type: "image", label: "Image", icon: "🖼️", description: "Static image / logo" },
  { type: "html_header", label: "HTML Header", icon: "🌐", description: "Custom HTML/CSS design block" },
]

const FIELD_ICONS: Partial<Record<MinutesDynamicFieldType, string>> = {
  document_heading: "📄",
  attendance_block: "👥",
  building_name: "🏢",
  meeting_type: "📋",
  meeting_date: "📅",
  start_time: "🕐",
  location: "📍",
  address: "🗺️",
  strata_plan: "#",
  attendee_list: "👤",
  topic_notes: "📝",
  topic_tasks: "✅",
  topic_decisions: "⚖️",
  signatures: "✍️",
  page_number: "🔢",
}

export default function MinutesComponentLibrary({ onAddElement }: MinutesComponentLibraryProps) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  const toggle = (key: string) => setCollapsed((p) => ({ ...p, [key]: !p[key] }))

  return (
    <div className="w-56 border-r border-border bg-card flex flex-col overflow-y-auto">
      <div className="p-3 border-b border-border">
        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Components</h3>
        <p className="text-[10px] text-muted-foreground mt-0.5">Minutes Edition</p>
      </div>

      {/* Static elements */}
      <div className="p-2">
        <button
          onClick={() => toggle("static")}
          className="flex items-center justify-between w-full px-2 py-1 text-xs font-semibold text-foreground hover:bg-muted/50 rounded mb-1"
        >
          <span>Static Elements</span>
          {collapsed["static"] ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>
        {!collapsed["static"] && (
          <div className="space-y-1 mb-2">
            {STATIC_ELEMENTS.map((el) => (
              <button
                key={el.type}
                onClick={() => onAddElement(el.type)}
                title={el.description}
                className="w-full flex items-center gap-2 px-2 py-2 rounded hover:bg-primary/10 hover:text-primary transition-all text-left group"
              >
                <span className="text-sm w-5 text-center flex-shrink-0">{el.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium truncate">{el.label}</div>
                  <div className="text-[10px] text-muted-foreground truncate group-hover:text-primary/70">{el.description}</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-border" />

      {/* Dynamic field groups */}
      <div className="p-2 flex-1">
        <p className="px-2 py-1 text-xs font-semibold text-foreground mb-1">Dynamic Fields</p>
        {Object.entries(MINUTES_FIELD_CATEGORIES).map(([groupLabel, fields]) => (
          <div key={groupLabel} className="mb-2">
            <button
              onClick={() => toggle(groupLabel)}
              className="flex items-center justify-between w-full px-2 py-1 text-[10px] font-bold text-muted-foreground uppercase tracking-widest hover:bg-muted/50 rounded"
            >
              <span>{groupLabel}</span>
              {collapsed[groupLabel] ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
            {!collapsed[groupLabel] && (
              <div className="space-y-0.5 mt-1">
                {fields.map((field) => {
                  const isSpecial = field === "document_heading" || field === "attendance_block"
                  return (
                    <button
                      key={field}
                      onClick={() => onAddElement("dynamic", field)}
                      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-primary/10 hover:text-primary transition-all text-left group ${
                        isSpecial ? "border border-primary/20 bg-primary/5" : ""
                      }`}
                    >
                      <span className="text-[10px] w-4 text-center flex-shrink-0">
                        {FIELD_ICONS[field] || "⚡"}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium truncate">{getMinutesDynamicFieldName(field)}</div>
                        {isSpecial && (
                          <div className="text-[10px] text-muted-foreground truncate">Orientation control</div>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
