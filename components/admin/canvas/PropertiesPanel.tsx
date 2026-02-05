"use client"


import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { X, AlignLeft, AlignCenter, AlignRight } from "lucide-react"
import { 
  CanvasElement, 
  ElementType, 
  getElementTypeName,
  getDynamicFieldName,
  DynamicFieldType
} from "@/lib/canvasUtils"


interface PropertiesPanelProps {
  selectedElement: CanvasElement | null
  onUpdate: (updates: Partial<CanvasElement>) => void
  onClose: () => void
}


export default function PropertiesPanel({
  selectedElement,
  onUpdate,
  onClose
}: PropertiesPanelProps) {
  if (!selectedElement) {
    return (
      <div className="w-80 bg-background border-l border-border flex items-center justify-center p-8">
        <div className="text-center text-muted-foreground">
          <div className="mb-2">👈</div>
          <p className="text-sm">Select an element to edit its properties</p>
        </div>
      </div>
    )
  }


  const element = selectedElement


  return (
    <div className="w-80 bg-background border-l border-border flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-foreground">Properties</h3>
          <p className="text-xs text-muted-foreground">
            {getElementTypeName(element.type)}
          </p>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>


      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        
        {/* Position Section */}
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-3">
            Position
          </h4>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">X (mm)</label>
              <input
                type="number"
                value={Math.round(element.position.x * 10) / 10}
                onChange={(e) => onUpdate({
                  position: { ...element.position, x: parseFloat(e.target.value) || 0 }
                })}
                className="w-full px-2 py-1 border border-border rounded text-sm"
                step="0.5"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Y (mm)</label>
              <input
                type="number"
                value={Math.round(element.position.y * 10) / 10}
                onChange={(e) => onUpdate({
                  position: { ...element.position, y: parseFloat(e.target.value) || 0 }
                })}
                className="w-full px-2 py-1 border border-border rounded text-sm"
                step="0.5"
              />
            </div>
          </div>
        </div>


        {/* Size Section */}
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-3">
            Size
          </h4>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Width (mm)</label>
              <input
                type="number"
                value={Math.round(element.size.width * 10) / 10}
                onChange={(e) => onUpdate({
                  size: { ...element.size, width: parseFloat(e.target.value) || 1 }
                })}
                className="w-full px-2 py-1 border border-border rounded text-sm"
                step="0.5"
                min="1"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Height (mm)</label>
              <input
                type="number"
                value={Math.round(element.size.height * 10) / 10}
                onChange={(e) => onUpdate({
                  size: { ...element.size, height: parseFloat(e.target.value) || 1 }
                })}
                className="w-full px-2 py-1 border border-border rounded text-sm"
                step="0.5"
                min="1"
              />
            </div>
          </div>
        </div>


        {/* Content Section - Text and Dynamic elements */}
        {(element.type === 'text' || element.type === 'dynamic') && (
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-3">
              Content
            </h4>
            
            {element.type === 'text' ? (
              <textarea
                value={element.content as string || ''}
                onChange={(e) => onUpdate({ content: e.target.value })}
                className="w-full px-2 py-2 border border-border rounded text-sm font-mono resize-none"
                rows={4}
                placeholder="Enter text..."
              />
            ) : (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded">
                <p className="text-xs text-blue-900 font-medium mb-1">Dynamic Field</p>
                <p className="text-sm text-blue-700">
                  {typeof element.content === 'object' && element.content !== null && 'type' in element.content
                    ? getDynamicFieldName(element.content.type as DynamicFieldType)
                    : 'Unknown Field'}
                </p>
                <p className="text-xs text-blue-600 mt-2">
                  This field will be populated automatically from meeting data
                </p>
              </div>
            )}
          </div>
        )}


        {/* Text Style Section */}
        {(element.type === 'text' || element.type === 'dynamic') && (
          <>
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-3">
                Text Style
              </h4>
              
              <div className="space-y-3">
                {/* Font Size */}
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Font Size (pt)</label>
                  <input
                    type="number"
                    value={(element.style?.fontSize as number) || 12}
                    onChange={(e) => onUpdate({
                      style: { ...element.style, fontSize: parseInt(e.target.value) || 12 }
                    })}
                    className="w-full px-2 py-1 border border-border rounded text-sm"
                    min="6"
                    max="72"
                  />
                </div>


                {/* Font Weight */}
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Font Weight</label>
                  <select
                    value={element.style?.fontWeight || 'normal'}
                    onChange={(e) => onUpdate({
                      style: { ...element.style, fontWeight: e.target.value }
                    })}
                    className="w-full px-2 py-1 border border-border rounded text-sm"
                  >
                    <option value="normal">Normal</option>
                    <option value="bold">Bold</option>
                  </select>
                </div>


                {/* Text Color */}
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Text Color</label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={element.style?.color || '#000000'}
                      onChange={(e) => onUpdate({
                        style: { ...element.style, color: e.target.value }
                      })}
                      className="h-8 w-16 rounded border border-border cursor-pointer"
                    />
                    <input
                      type="text"
                      value={element.style?.color || '#000000'}
                      onChange={(e) => onUpdate({
                        style: { ...element.style, color: e.target.value }
                      })}
                      className="flex-1 px-2 py-1 border border-border rounded text-sm font-mono"
                      placeholder="#000000"
                    />
                  </div>
                </div>


                {/* Text Align */}
                <div>
                  <label className="text-xs text-muted-foreground block mb-2">Text Align</label>
                  <div className="flex gap-1">
                    <button
                      onClick={() => onUpdate({
                        style: { ...element.style, textAlign: 'left' }
                      })}
                      className={`flex-1 p-2 border rounded ${
                        element.style?.textAlign === 'left' 
                          ? 'bg-primary text-white border-primary' 
                          : 'bg-background border-border'
                      }`}
                    >
                      <AlignLeft className="h-4 w-4 mx-auto" />
                    </button>
                    <button
                      onClick={() => onUpdate({
                        style: { ...element.style, textAlign: 'center' }
                      })}
                      className={`flex-1 p-2 border rounded ${
                        element.style?.textAlign === 'center' 
                          ? 'bg-primary text-white border-primary' 
                          : 'bg-background border-border'
                      }`}
                    >
                      <AlignCenter className="h-4 w-4 mx-auto" />
                    </button>
                    <button
                      onClick={() => onUpdate({
                        style: { ...element.style, textAlign: 'right' }
                      })}
                      className={`flex-1 p-2 border rounded ${
                        element.style?.textAlign === 'right' 
                          ? 'bg-primary text-white border-primary' 
                          : 'bg-background border-border'
                      }`}
                    >
                      <AlignRight className="h-4 w-4 mx-auto" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}


        {/* Background Section */}
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-3">
            Background
          </h4>
          <div className="flex gap-2">
            <input
              type="color"
              value={element.style?.backgroundColor || '#ffffff'}
              onChange={(e) => onUpdate({
                style: { ...element.style, backgroundColor: e.target.value }
              })}
              className="h-8 w-16 rounded border border-border cursor-pointer"
            />
            <input
              type="text"
              value={element.style?.backgroundColor || '#ffffff'}
              onChange={(e) => onUpdate({
                style: { ...element.style, backgroundColor: e.target.value }
              })}
              className="flex-1 px-2 py-1 border border-border rounded text-sm font-mono"
              placeholder="#ffffff"
            />
          </div>
          
          {/* Transparent option */}
          <button
            onClick={() => onUpdate({
              style: { ...element.style, backgroundColor: 'transparent' }
            })}
            className="mt-2 text-xs text-primary hover:underline"
          >
            Make transparent
          </button>
        </div>


        {/* Border Section */}
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-3">
            Border
          </h4>
          
          <div className="space-y-3">
            {/* Border Width */}
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Width (px)</label>
              <input
                type="number"
                value={
                  element.style?.borderWidth 
                    ? (typeof element.style.borderWidth === 'string' 
                        ? parseInt(element.style.borderWidth) 
                        : element.style.borderWidth)
                    : 0
                }
                onChange={(e) => onUpdate({
                  style: { ...element.style, borderWidth: `${parseInt(e.target.value) || 0}px` }
                })}
                className="w-full px-2 py-1 border border-border rounded text-sm"
                min="0"
                max="10"
              />
            </div>


            {/* Border Color */}
            {element.style?.borderWidth && (
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Color</label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={element.style?.borderColor || '#cccccc'}
                    onChange={(e) => onUpdate({
                      style: { ...element.style, borderColor: e.target.value }
                    })}
                    className="h-8 w-16 rounded border border-border cursor-pointer"
                  />
                  <input
                    type="text"
                    value={element.style?.borderColor || '#cccccc'}
                    onChange={(e) => onUpdate({
                      style: { ...element.style, borderColor: e.target.value }
                    })}
                    className="flex-1 px-2 py-1 border border-border rounded text-sm font-mono"
                    placeholder="#cccccc"
                  />
                </div>
              </div>
            )}


            {/* Border Radius */}
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Radius (px)</label>
              <input
                type="number"
                value={
                  element.style?.borderRadius
                    ? (typeof element.style.borderRadius === 'string'
                        ? parseInt(element.style.borderRadius)
                        : element.style.borderRadius)
                    : 0
                }
                onChange={(e) => onUpdate({
                  style: { ...element.style, borderRadius: parseInt(e.target.value) || 0 }
                })}
                className="w-full px-2 py-1 border border-border rounded text-sm"
                min="0"
                max="50"
              />
            </div>
          </div>
        </div>


        {/* Lock Element Toggle */}
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-3">
            Options
          </h4>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={element.locked || false}
              onChange={(e) => onUpdate({ locked: e.target.checked })}
              className="h-4 w-4"
            />
            <span className="text-sm">Lock element</span>
          </label>
          <p className="text-xs text-muted-foreground mt-1">
            Prevent moving or editing this element
          </p>
        </div>


      </div>


      {/* Footer Info */}
      <div className="p-4 border-t border-border bg-muted/30">
        <div className="text-xs text-muted-foreground space-y-1">
          <p><strong>ID:</strong> {element.id}</p>
          <p><strong>Type:</strong> {getElementTypeName(element.type)}</p>
        </div>
      </div>
    </div>
  )
}
