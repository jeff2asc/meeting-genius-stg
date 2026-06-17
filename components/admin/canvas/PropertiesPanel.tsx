"use client"

import { CanvasElement, ElementConfig, getDynamicFieldName } from "@/lib/canvasUtils"
import { X, Lock, Unlock } from "lucide-react"

interface PropertiesPanelProps {
  selectedElement: CanvasElement | null
  onUpdate: (updates: Partial<CanvasElement>) => void
  onClose: () => void
}

export default function PropertiesPanel({ selectedElement, onUpdate, onClose }: PropertiesPanelProps) {
  if (!selectedElement) {
    return (
      <div className="w-64 border-l border-border bg-card flex flex-col">
        <div className="p-4 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">Properties</h3>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <p className="text-xs text-muted-foreground text-center">Click an element to edit its properties</p>
        </div>
      </div>
    )
  }

  const el = selectedElement
  const s = el.style || {}
  const cfg = el.config || {}

  const updateStyle = (patch: Partial<typeof s>) => onUpdate({ style: { ...s, ...patch } })
  const updateConfig = (patch: Partial<ElementConfig>) => onUpdate({ config: { ...cfg, ...patch } })

  const isDynamicHeading = el.type === "dynamic" && (el.content as any)?.type === "document_heading"
  const isDynamicAttendance = el.type === "dynamic" && (el.content as any)?.type === "attendance_block"
  const isHtmlHeader = el.type === "html_header"
  const isOrientable = isDynamicHeading || isDynamicAttendance

  const fieldType = el.type === "dynamic" ? (el.content as any)?.type : null

  return (
    <div className="w-64 border-l border-border bg-card flex flex-col overflow-y-auto">
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Properties</h3>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="p-4 space-y-5">

        {/* Element type badge */}
        <div className="flex items-center gap-2">
          <span className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded-full font-mono">
            {el.type}{fieldType ? ` · ${getDynamicFieldName(fieldType)}` : ""}
          </span>
        </div>

        {/* Lock */}
        <Section label="Element">
          <ToggleRow
            label="Lock position"
            value={!!el.locked}
            onChange={(v) => onUpdate({ locked: v })}
            iconOn={<Lock className="h-3 w-3" />}
            iconOff={<Unlock className="h-3 w-3" />}
          />
        </Section>

        {/* Position & Size */}
        <Section label="Position & Size">
          <div className="grid grid-cols-2 gap-2">
            <NumberInput label="X (mm)" value={el.position.x} step={0.5}
              onChange={(v) => onUpdate({ position: { ...el.position, x: v } })} />
            <NumberInput label="Y (mm)" value={el.position.y} step={0.5}
              onChange={(v) => onUpdate({ position: { ...el.position, y: v } })} />
            <NumberInput label="W (mm)" value={el.size.width} step={1}
              onChange={(v) => onUpdate({ size: { ...el.size, width: Math.max(5, v) } })} />
            <NumberInput label="H (mm)" value={el.size.height} step={1}
              onChange={(v) => onUpdate({ size: { ...el.size, height: Math.max(2, v) } })} />
          </div>
        </Section>

        {/* ── Special: Document Heading config ── */}
        {isDynamicHeading && (
          <Section label="🎨 Document Heading">
            <OrientationToggle
              value={cfg.orientation || "horizontal"}
              onChange={(v) => updateConfig({ orientation: v })}
            />
            <div className="mt-3">
              <label className="text-xs font-medium text-muted-foreground block mb-1">Format</label>
              <div className="grid grid-cols-1 gap-1">
                {(["full_sentence", "stacked", "inline"] as const).map((fmt) => (
                  <button
                    key={fmt}
                    onClick={() => updateConfig({ headingFormat: fmt })}
                    className={`px-2 py-1.5 rounded text-xs font-medium transition-all text-left ${
                      (cfg.headingFormat || "full_sentence") === fmt
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    {fmt === "full_sentence" && "📄 Full sentence (one paragraph)"}
                    {fmt === "stacked" && "📋 Stacked (label per line)"}
                    {fmt === "inline" && "▶ Inline (compact)"}
                  </button>
                ))}
              </div>
            </div>
          </Section>
        )}

        {/* ── Special: Attendance Block config ── */}
        {isDynamicAttendance && (
          <Section label="👥 Attendance Block">
            <OrientationToggle
              value={cfg.orientation || "horizontal"}
              onChange={(v) => updateConfig({ orientation: v })}
            />
            <div className="mt-3">
              <label className="text-xs font-medium text-muted-foreground block mb-1">Display Style</label>
              <div className="grid grid-cols-1 gap-1">
                {(["table", "list", "compact"] as const).map((style) => (
                  <button
                    key={style}
                    onClick={() => updateConfig({ attendanceStyle: style })}
                    className={`px-2 py-1.5 rounded text-xs font-medium transition-all text-left ${
                      (cfg.attendanceStyle || "table") === style
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    {style === "table" && "📊 Table (name | role | ✓)"}
                    {style === "list" && "📝 List (one per row)"}
                    {style === "compact" && "⬛ Compact (multi-column)"}
                  </button>
                ))}
              </div>
            </div>
          </Section>
        )}

        {/* ── HTML Header raw editor ── */}
        {isHtmlHeader && (
          <Section label="🌐 HTML Content">
            <p className="text-xs text-muted-foreground mb-2">Edit HTML directly or use the toolbar "Import HTML Header" button for a full editor.</p>
            <textarea
              value={el.content as string || ""}
              onChange={(e) => onUpdate({ content: e.target.value })}
              rows={6}
              className="w-full text-xs font-mono bg-muted rounded border border-border p-2 resize-y"
              placeholder="<div style='...'>...</div>"
            />
          </Section>
        )}

        {/* Text styling (shown for text and non-special dynamic fields) */}
        {(el.type === "text" || (el.type === "dynamic" && !isDynamicAttendance)) && (
          <Section label="Typography">
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Font Size (pt)</label>
                <input
                  type="number"
                  value={typeof s.fontSize === "number" ? s.fontSize : 12}
                  onChange={(e) => updateStyle({ fontSize: Number(e.target.value) })}
                  className="w-full px-2 py-1 border border-border rounded text-xs bg-background"
                  min={6} max={72}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Weight</label>
                <div className="flex gap-1">
                  {(["normal", "bold"] as const).map((w) => (
                    <button key={w} onClick={() => updateStyle({ fontWeight: w })}
                      className={`flex-1 py-1 rounded text-xs font-medium transition-all ${(s.fontWeight || "normal") === w ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                      {w === "bold" ? "Bold" : "Normal"}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Align</label>
                <div className="flex gap-1">
                  {(["left", "center", "right"] as const).map((a) => (
                    <button key={a} onClick={() => updateStyle({ textAlign: a })}
                      className={`flex-1 py-1 rounded text-xs transition-all ${(s.textAlign || "left") === a ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                      {a === "left" ? "◀" : a === "center" ? "▬" : "▶"}
                    </button>
                  ))}
                </div>
              </div>
              <ColorInput label="Text Color" value={s.color || "#000000"} onChange={(v) => updateStyle({ color: v })} />
            </div>
          </Section>
        )}

        {/* Background color for shapes, containers, dynamic */}
        {(el.type === "shape" || el.type === "container" || el.type === "dynamic") && (
          <Section label="Background">
            <ColorInput label="Background" value={s.backgroundColor || "#ffffff"} onChange={(v) => updateStyle({ backgroundColor: v })} />
          </Section>
        )}

        {/* Border (shapes/containers) */}
        {(el.type === "shape" || el.type === "container") && (
          <Section label="Border">
            <div className="space-y-2">
              <ColorInput label="Border Color" value={s.borderColor || "#9ca3af"} onChange={(v) => updateStyle({ borderColor: v })} />
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Border Width</label>
                <select value={s.borderWidth || "0px"} onChange={(e) => updateStyle({ borderWidth: e.target.value })}
                  className="w-full px-2 py-1 border border-border rounded text-xs bg-background">
                  {["0px", "1px", "2px", "3px", "4px"].map((w) => <option key={w} value={w}>{w}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Border Radius</label>
                <input type="number" value={typeof s.borderRadius === "number" ? s.borderRadius : 0}
                  onChange={(e) => updateStyle({ borderRadius: Number(e.target.value) })}
                  className="w-full px-2 py-1 border border-border rounded text-xs bg-background"
                  min={0} max={50} />
              </div>
            </div>
          </Section>
        )}
      </div>
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">{label}</p>
      {children}
    </div>
  )
}

function NumberInput({ label, value, step, onChange }: { label: string; value: number; step: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label className="text-xs text-muted-foreground block mb-1">{label}</label>
      <input
        type="number"
        value={Math.round(value * 10) / 10}
        step={step}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full px-2 py-1 border border-border rounded text-xs bg-background"
      />
    </div>
  )
}

function ColorInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)}
        className="w-8 h-8 rounded cursor-pointer border border-border flex-shrink-0" />
      <div className="flex-1">
        <label className="text-xs text-muted-foreground block">{label}</label>
        <input type="text" value={value} onChange={(e) => onChange(e.target.value)}
          className="w-full px-1 py-0.5 border border-border rounded text-xs bg-background font-mono" />
      </div>
    </div>
  )
}

function ToggleRow({ label, value, onChange, iconOn, iconOff }: {
  label: string; value: boolean; onChange: (v: boolean) => void
  iconOn?: React.ReactNode; iconOff?: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {value ? iconOn : iconOff}
        <span>{label}</span>
      </div>
      <button
        onClick={() => onChange(!value)}
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${value ? "bg-primary" : "bg-muted"}`}
      >
        <span className={`inline-block h-3 w-3 transform rounded-full bg-white shadow transition-transform ${value ? "translate-x-5" : "translate-x-1"}`} />
      </button>
    </div>
  )
}

function OrientationToggle({ value, onChange }: { value: "horizontal" | "vertical"; onChange: (v: "horizontal" | "vertical") => void }) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground block mb-1">Orientation</label>
      <div className="flex gap-1">
        <button
          onClick={() => onChange("horizontal")}
          className={`flex-1 py-2 rounded text-xs font-medium transition-all flex items-center justify-center gap-1 ${value === "horizontal" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
        >
          <span>⟷</span> Horizontal
        </button>
        <button
          onClick={() => onChange("vertical")}
          className={`flex-1 py-2 rounded text-xs font-medium transition-all flex items-center justify-center gap-1 ${value === "vertical" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
        >
          <span>↕</span> Vertical
        </button>
      </div>
    </div>
  )
}
