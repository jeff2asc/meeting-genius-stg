"use client"

import { CANVAS_TEMPLATES, TemplateKey } from "@/lib/defaultCanvasTemplates"
import { X } from "lucide-react"

interface TemplateGalleryModalProps {
  onClose: () => void
  onSelectTemplate: (key: TemplateKey | null | "convert") => void
  hasSimpleTemplate?: boolean
}

export default function TemplateGalleryModal({ onClose, onSelectTemplate, hasSimpleTemplate }: TemplateGalleryModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div>
            <h2 className="text-lg font-bold text-foreground">Load Starter Template</h2>
            <p className="text-sm text-muted-foreground">Choose a layout to start from — you can customise everything after</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Templates */}
        <div className="p-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
          {(Object.keys(CANVAS_TEMPLATES) as TemplateKey[]).map((key) => {
            const tmpl = CANVAS_TEMPLATES[key]
            return (
              <button
                key={key}
                onClick={() => onSelectTemplate(key)}
                className="flex flex-col items-center gap-3 p-4 rounded-lg border border-border hover:border-primary hover:bg-primary/5 transition-all text-left group"
              >
                <div className="text-4xl">{tmpl.thumbnail}</div>
                <div className="text-center">
                  <div className="text-sm font-semibold text-foreground group-hover:text-primary">{tmpl.name}</div>
                  <div className="text-xs text-muted-foreground mt-1">{tmpl.description}</div>
                </div>
              </button>
            )
          })}
        </div>

        {/* Divider */}
        <div className="border-t border-border mx-6" />

        {/* Extra options */}
        <div className="p-6 flex flex-wrap gap-3">
          {hasSimpleTemplate && (
            <button
              onClick={() => onSelectTemplate("convert")}
              className="flex-1 min-w-[200px] flex items-center justify-center gap-2 px-4 py-3 rounded-lg border border-primary/30 bg-primary/5 hover:bg-primary/10 text-primary text-sm font-medium transition-all"
            >
              ♻️ Import my Simple Mode template
            </button>
          )}
          <button
            onClick={() => onSelectTemplate(null)}
            className="flex-1 min-w-[140px] flex items-center justify-center gap-2 px-4 py-3 rounded-lg border border-border bg-muted/30 hover:bg-muted text-muted-foreground text-sm font-medium transition-all"
          >
            🗑️ Start blank canvas
          </button>
        </div>
      </div>
    </div>
  )
}
