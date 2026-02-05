"use client"

import { Type, Image, Square, Box, Zap } from "lucide-react"
import { Card } from "@/components/ui/card"
import { ElementType, DynamicFieldType, getDynamicFieldName } from "@/lib/canvasUtils"

interface ComponentLibraryProps {
  onAddElement: (type: ElementType, dynamicFieldType?: DynamicFieldType) => void
}

const COMPONENT_ITEMS = [
  {
    type: 'text' as ElementType,
    icon: Type,
    label: 'Text Block',
    description: 'Add custom text',
    color: 'text-blue-600'
  },
  {
    type: 'image' as ElementType,
    icon: Image,
    label: 'Image',
    description: 'Upload or link image',
    color: 'text-green-600'
  },
  {
    type: 'container' as ElementType,
    icon: Box,
    label: 'Container',
    description: 'Group elements together',
    color: 'text-purple-600'
  },
  {
    type: 'shape' as ElementType,
    icon: Square,
    label: 'Shape',
    description: 'Rectangle or box',
    color: 'text-orange-600'
  }
]

const DYNAMIC_FIELDS: DynamicFieldType[] = [
  'building_name',
  'meeting_title',
  'meeting_date',
  'meeting_time',
  'meeting_location',
  'topics_list',
  'attendees_list'
]

export default function ComponentLibrary({ onAddElement }: ComponentLibraryProps) {
  return (
    <div className="w-64 bg-background border-r border-border flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <h3 className="font-semibold text-foreground">Components</h3>
        <p className="text-xs text-muted-foreground mt-1">
          Click to add to canvas
        </p>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Basic Components */}
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-3">
            Basic Elements
          </h4>
          <div className="space-y-2">
            {COMPONENT_ITEMS.map((item) => {
              const Icon = item.icon
              return (
                <button
                  key={item.type}
                  onClick={() => onAddElement(item.type)}
                  className="w-full p-3 bg-card border border-border rounded-lg hover:border-primary hover:bg-primary/5 transition-all text-left group"
                >
                  <div className="flex items-start gap-3">
                    <div className={`${item.color} group-hover:scale-110 transition-transform`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">
                        {item.label}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {item.description}
                      </p>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Dynamic Fields */}
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-3 flex items-center gap-2">
            <Zap className="h-3 w-3" />
            Dynamic Fields
          </h4>
          <div className="space-y-2">
            {DYNAMIC_FIELDS.map((fieldType) => (
              <button
                key={fieldType}
                onClick={() => onAddElement('dynamic', fieldType)}
                className="w-full p-3 bg-blue-50 border border-blue-200 rounded-lg hover:border-blue-400 hover:bg-blue-100 transition-all text-left group"
              >
                <div className="flex items-start gap-3">
                  <div className="text-blue-600 group-hover:scale-110 transition-transform">
                    <Zap className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-blue-900">
                      {getDynamicFieldName(fieldType)}
                    </p>
                    <p className="text-xs text-blue-700">
                      Auto-populated from meeting data
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Footer Tip */}
      <div className="p-4 border-t border-border bg-muted/30">
        <div className="flex items-start gap-2">
          <div className="text-primary mt-0.5">
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <p className="text-xs text-muted-foreground">
            <strong>Tip:</strong> Click an element to add it to the canvas at the default position
          </p>
        </div>
      </div>
    </div>
  )
}
