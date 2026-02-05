"use client"

import { Button } from "@/components/ui/button"
import { X, Sparkles, FileText } from "lucide-react"
import { CANVAS_TEMPLATES, TemplateKey } from "@/lib/defaultCanvasTemplates"

interface TemplateGalleryModalProps {
  onClose: () => void
  onSelectTemplate: (key: TemplateKey | null | 'convert') => void
  hasSimpleTemplate?: boolean
}

export default function TemplateGalleryModal({
  onClose,
  onSelectTemplate,
  hasSimpleTemplate = false
}: TemplateGalleryModalProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-background rounded-lg shadow-2xl max-w-5xl w-full mx-4 max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Choose a Starting Template</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Select a pre-made template to customize, convert your existing template, or start with a blank canvas
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Templates Grid */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* Convert from Simple Template - Show if exists */}
            {hasSimpleTemplate && (
              <button
                onClick={() => onSelectTemplate('convert')}
                className="group p-6 border-2 border-primary bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg hover:border-primary hover:shadow-lg transition-all text-left relative overflow-hidden"
              >
                <div className="absolute top-2 right-2">
                  <span className="bg-primary text-white text-xs px-2 py-1 rounded-full font-semibold">
                    Recommended
                  </span>
                </div>
                <div className="text-6xl mb-4 group-hover:scale-110 transition-transform">
                  ✨
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  From Your Settings
                </h3>
                <p className="text-sm text-muted-foreground mb-3">
                  Convert your existing Simple Mode template to canvas elements
                </p>
                <div className="flex items-center gap-2 text-xs">
                  <FileText className="h-3 w-3 text-primary" />
                  <span className="text-primary font-medium">Uses your current layout & colors</span>
                </div>
              </button>
            )}

            {/* Pre-made Templates */}
            {(Object.keys(CANVAS_TEMPLATES) as TemplateKey[]).map((key) => {
              const template = CANVAS_TEMPLATES[key]
              return (
                <button
                  key={key}
                  onClick={() => onSelectTemplate(key)}
                  className="group p-6 border-2 border-border rounded-lg hover:border-primary hover:bg-primary/5 transition-all text-left"
                >
                  <div className="text-6xl mb-4 group-hover:scale-110 transition-transform">
                    {template.thumbnail}
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    {template.name}
                  </h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    {template.description}
                  </p>
                  <div className="text-xs text-muted-foreground">
                    {template.elements.length} elements
                  </div>
                </button>
              )
            })}

            {/* Blank Canvas Option */}
            <button
              onClick={() => onSelectTemplate(null)}
              className="group p-6 border-2 border-dashed border-border rounded-lg hover:border-primary hover:bg-primary/5 transition-all text-left"
            >
              <div className="text-6xl mb-4 group-hover:scale-110 transition-transform">
                ⬜
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                Blank Canvas
              </h3>
              <p className="text-sm text-muted-foreground mb-3">
                Start from scratch and build your own custom layout
              </p>
              <div className="text-xs text-muted-foreground">
                0 elements - Complete freedom
              </div>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border bg-muted/30 flex items-center justify-between">
          <div className="flex items-start gap-2">
            <div className="text-primary mt-0.5">
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <p className="text-xs text-muted-foreground">
              {hasSimpleTemplate ? (
                <>
                  <strong>💡 Tip:</strong> Choose "From Your Settings" to preserve your current layout, or pick a pre-made template to start fresh
                </>
              ) : (
                <>
                  <strong>💡 Tip:</strong> You can customize any template after selecting it
                </>
              )}
            </p>
          </div>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  )
}
