"use client"

import { useState } from "react"
import { ElementType, DynamicFieldType, getDynamicFieldName } from "@/lib/canvasUtils"
import { ChevronDown, ChevronRight } from "lucide-react"

interface ComponentLibraryProps {
  onAddElement: (type: ElementType, dynamicFieldType?: DynamicFieldType) => void
}

const STATIC_ELEMENTS: { type: ElementType; label: string; icon: string; description: string }[] = [
  { type: "text", label: "Text", icon: "T", description: "Static text block" },
  { type: "shape", label: "Shape / Divider", icon: "▬", description: "Rectangle, bar or divider" },
  { type: "container", label: "Container", icon: "⬜", description: "Bordered card container" },
  { type: "image", label: "Image", icon: "🖼️", description: "Static image / logo" },
  { type: "html_header", label: "HTML Header", icon: "🌐", description: "Custom HTML/CSS design block" },
]

const DYNAMIC_GROUPS: { label: string; fields: DynamicFieldType[] }[] = [
  {
    label: "🎨 Layout Blocks",
    fields: ["document_heading", "attendance_block"],
  },
  {
    label: "Header Information",
    fields: ["company_logo", "building_name", "meeting_type", "meeting_date", "start_time", "meeting_location", "address", "strata_plan"],
  },
  {
    label: "Agenda Content",
    fields: ["topics_list", "sections_list", "attendees_list"],
  },
]

const FIELD_DESCRIPTIONS: Partial<Record<DynamicFieldType, string>> = {
  document_heading: "Full meeting heading sentence with orientation control",
  attendance_block: "Attendee table/list with horizontal or vertical layout",
  company_logo: "Company/building logo image",
  building_name: "Name of the building",
  meeting_type: "Type of meeting (Council, AGM...)",
  meeting_date: "Formatted meeting date",
  start_time: "Meeting start time",
  meeting_location: "Meeting room / location",
  address: "Building address",
  strata_plan: "Strata plan number",
  topics_list: "Full agenda items list",
  sections_list: "Section headings only",
  attendees_list: "Simple attendee list",
}

export default function ComponentLibrary({ onAddElement }: ComponentLibraryProps) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  const toggle = (key: string) => setCollapsed((p) => ({ ...p, [key]: !p[key] }))

  return (
    <div className="w-56 border-r border-border bg-card flex flex-col overflow-y-auto">
      <div className="p-3 border-b border-border">
        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Components</h3>
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

      {/* Dynamic groups */}
      <div className="p-2 flex-1">
        <p className="px-2 py-1 text-xs font-semibold text-foreground mb-1">Dynamic Fields</p>
        {DYNAMIC_GROUPS.map((group) => (
          <div key={group.label} className="mb-2">
            <button
              onClick={() => toggle(group.label)}
              className="flex items-center justify-between w-full px-2 py-1 text-[10px] font-bold text-muted-foreground uppercase tracking-widest hover:bg-muted/50 rounded"
            >
              <span>{group.label}</span>
              {collapsed[group.label] ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
            {!collapsed[group.label] && (
              <div className="space-y-0.5 mt-1">
                {group.fields.map((field) => (
                  <button
                    key={field}
                    onClick={() => onAddElement("dynamic", field)}
                    title={FIELD_DESCRIPTIONS[field]}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-primary/10 hover:text-primary transition-all text-left group ${
                      field === "document_heading" || field === "attendance_block"
                        ? "border border-primary/20 bg-primary/5"
                        : ""
                    }`}
                  >
                    <span className="text-[10px] w-4 text-center flex-shrink-0">
                      {field === "document_heading" ? "📄" : field === "attendance_block" ? "👥" : "⚡"}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium truncate">{getDynamicFieldName(field)}</div>
                      {(field === "document_heading" || field === "attendance_block") && (
                        <div className="text-[10px] text-muted-foreground truncate">Orientation control</div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
