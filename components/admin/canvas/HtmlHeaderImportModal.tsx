"use client"

import { useState, useRef } from "react"
import { X, Code2, Eye, Upload, Sparkles } from "lucide-react"

interface HtmlHeaderImportModalProps {
  onClose: () => void
  onImport: (htmlContent: string, heightMm: number) => void
}

const SAMPLE_TEMPLATES = [
  {
    name: "Blue Gradient Bar",
    html: `<div style="background:linear-gradient(135deg,#1e3a8a 0%,#3b82f6 100%);color:white;padding:20px 28px;font-family:'Helvetica Neue',sans-serif;display:flex;align-items:center;justify-content:space-between;min-height:60px;">
  <div style="display:flex;align-items:center;gap:16px;">
    <div style="width:44px;height:44px;background:rgba(255,255,255,0.2);border-radius:50%;border:2px solid rgba(255,255,255,0.4);display:flex;align-items:center;justify-content:center;font-size:20px;">🏢</div>
    <div>
      <div style="font-size:20px;font-weight:700;letter-spacing:1px;">MEETING MINUTES</div>
      <div style="font-size:11px;opacity:0.75;margin-top:2px;">Strata Council Meeting</div>
    </div>
  </div>
  <div style="text-align:right;font-size:11px;opacity:0.8;">
    <div>VIS 1234</div>
    <div>January 29, 2026</div>
  </div>
</div>`,
    height: 25,
  },
  {
    name: "Teal Side Accent",
    html: `<div style="font-family:'Helvetica Neue',sans-serif;display:flex;min-height:50px;overflow:hidden;">
  <div style="width:8px;background:#0d9488;flex-shrink:0;"></div>
  <div style="padding:14px 20px;flex:1;background:#f0fdfa;border-bottom:2px solid #0d9488;">
    <div style="font-size:18px;font-weight:700;color:#0f172a;">MINUTES OF THE STRATA COUNCIL MEETING</div>
    <div style="font-size:11px;color:#475569;margin-top:4px;">Building Name · Strata Plan VIS 1234 · January 29, 2026</div>
  </div>
</div>`,
    height: 22,
  },
  {
    name: "Dark Navy Premium",
    html: `<div style="background:#0f172a;color:white;font-family:'Helvetica Neue',sans-serif;padding:18px 28px;display:flex;align-items:center;gap:20px;min-height:56px;">
  <div style="width:2px;height:40px;background:linear-gradient(180deg,#3b82f6,#8b5cf6);border-radius:2px;flex-shrink:0;"></div>
  <div style="flex:1;">
    <div style="font-size:9px;letter-spacing:3px;text-transform:uppercase;color:#94a3b8;font-weight:600;margin-bottom:4px;">Minutes of the</div>
    <div style="font-size:17px;font-weight:700;color:white;">Strata Council Meeting</div>
  </div>
  <div style="background:rgba(59,130,246,0.2);border:1px solid rgba(59,130,246,0.4);border-radius:8px;padding:8px 16px;text-align:center;">
    <div style="font-size:9px;color:#93c5fd;text-transform:uppercase;letter-spacing:1px;">Strata Plan</div>
    <div style="font-size:14px;font-weight:700;color:white;">VIS 1234</div>
  </div>
</div>`,
    height: 24,
  },
  {
    name: "Classic Corporate",
    html: `<div style="font-family:'Times New Roman',serif;border-bottom:3px solid #1e3a8a;padding:16px 24px 12px;background:white;">
  <div style="text-align:center;">
    <div style="font-size:14px;font-weight:700;color:#1e3a8a;letter-spacing:2px;text-transform:uppercase;">Minutes of the Strata Council Meeting</div>
    <div style="font-size:11px;color:#374151;margin-top:6px;">of <strong>Oceanview Towers</strong>, Strata Plan VIS 1234</div>
    <div style="width:60px;height:1px;background:#1e3a8a;margin:8px auto;"></div>
    <div style="font-size:10px;color:#6b7280;">held on Thursday, January 29, 2026 at 7:00 PM in the Community Room</div>
  </div>
</div>`,
    height: 28,
  },
]

export default function HtmlHeaderImportModal({ onClose, onImport }: HtmlHeaderImportModalProps) {
  const [htmlCode, setHtmlCode] = useState(SAMPLE_TEMPLATES[0].html)
  const [heightMm, setHeightMm] = useState(SAMPLE_TEMPLATES[0].height)
  const [activeTab, setActiveTab] = useState<"templates" | "custom">("templates")
  const [selectedTemplate, setSelectedTemplate] = useState(0)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  const handleSelectTemplate = (idx: number) => {
    setSelectedTemplate(idx)
    setHtmlCode(SAMPLE_TEMPLATES[idx].html)
    setHeightMm(SAMPLE_TEMPLATES[idx].height)
  }

  const handleImport = () => {
    if (!htmlCode.trim()) return
    onImport(htmlCode.trim(), heightMm)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-4xl mx-4 overflow-hidden flex flex-col" style={{ maxHeight: "90vh" }}>

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Code2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">Import HTML Header</h2>
              <p className="text-xs text-muted-foreground">Design a custom header with full HTML & CSS control</p>
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors p-1">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border flex-shrink-0">
          <button
            onClick={() => setActiveTab("templates")}
            className={`px-5 py-3 text-sm font-medium transition-all border-b-2 ${activeTab === "templates" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            <Sparkles className="h-4 w-4 inline mr-2" />
            Starter Templates
          </button>
          <button
            onClick={() => setActiveTab("custom")}
            className={`px-5 py-3 text-sm font-medium transition-all border-b-2 ${activeTab === "custom" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            <Code2 className="h-4 w-4 inline mr-2" />
            Custom HTML
          </button>
        </div>

        <div className="flex-1 overflow-hidden flex">

          {/* Left: Editor/Templates */}
          <div className="w-1/2 flex flex-col border-r border-border overflow-hidden">
            {activeTab === "templates" ? (
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {SAMPLE_TEMPLATES.map((tmpl, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSelectTemplate(idx)}
                    className={`w-full text-left rounded-lg border transition-all overflow-hidden ${selectedTemplate === idx ? "border-primary ring-2 ring-primary/30" : "border-border hover:border-primary/50"}`}
                  >
                    {/* Preview of template */}
                    <div style={{ height: 64, overflow: "hidden", background: "#fff" }}>
                      <div
                        style={{ transform: "scale(0.55)", transformOrigin: "top left", width: "182%", pointerEvents: "none" }}
                        dangerouslySetInnerHTML={{ __html: tmpl.html }}
                      />
                    </div>
                    <div className="px-3 py-2 bg-muted/30 border-t border-border">
                      <span className="text-xs font-semibold text-foreground">{tmpl.name}</span>
                      <span className="text-xs text-muted-foreground ml-2">{tmpl.height}mm tall</span>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex-1 flex flex-col p-4 gap-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">HTML Code</label>
                  <span className="text-xs text-muted-foreground">{htmlCode.length} chars</span>
                </div>
                <textarea
                  value={htmlCode}
                  onChange={(e) => setHtmlCode(e.target.value)}
                  className="flex-1 font-mono text-xs bg-muted border border-border rounded-lg p-3 resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
                  placeholder={`Paste your HTML here...\n\n<div style="background:#1e3a8a;color:white;padding:20px;">\n  Your custom header design\n</div>`}
                  spellCheck={false}
                />
                <div className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
                  💡 Use inline <code>style=""</code> attributes for PDF compatibility. External CSS classes won't work in the PDF output.
                </div>
              </div>
            )}
          </div>

          {/* Right: Live Preview */}
          <div className="w-1/2 flex flex-col overflow-hidden">
            <div className="p-4 border-b border-border flex-shrink-0 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Eye className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Live Preview</span>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground">Height:</label>
                <input
                  type="number"
                  value={heightMm}
                  onChange={(e) => setHeightMm(Math.max(10, Math.min(80, Number(e.target.value))))}
                  className="w-16 px-2 py-1 text-xs border border-border rounded bg-background"
                  min={10}
                  max={80}
                />
                <span className="text-xs text-muted-foreground">mm</span>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-4 bg-gray-100">
              {/* A4-width preview */}
              <div className="bg-white shadow-lg mx-auto" style={{ width: "100%", maxWidth: 595 }}>
                {/* Header preview */}
                <div style={{ overflow: "hidden" }} dangerouslySetInnerHTML={{ __html: htmlCode }} />
                {/* Body placeholder */}
                <div className="p-6">
                  <div className="space-y-2">
                    {[100, 80, 90, 70, 85].map((w, i) => (
                      <div key={i} className="h-2 bg-gray-100 rounded" style={{ width: `${w}%` }} />
                    ))}
                    <div className="h-4" />
                    {[95, 75, 88, 65].map((w, i) => (
                      <div key={i} className="h-2 bg-gray-100 rounded" style={{ width: `${w}%` }} />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-5 border-t border-border flex-shrink-0 bg-muted/20">
          <p className="text-xs text-muted-foreground">
            The header will be placed at the top of the canvas (position 0,0). Adjust height above to fit your design.
          </p>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-4 py-2 text-sm text-muted-foreground border border-border rounded-lg hover:bg-muted transition-colors">
              Cancel
            </button>
            <button
              onClick={handleImport}
              disabled={!htmlCode.trim()}
              className="px-5 py-2 text-sm font-semibold bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              <Upload className="h-4 w-4" />
              Add to Canvas
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
