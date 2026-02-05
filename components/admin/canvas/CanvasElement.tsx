"use client"

import { useRef, useEffect, useState } from "react"
import { Trash2, Copy, Lock, Unlock, GripVertical } from "lucide-react"
import { CanvasElement as CanvasElementType, getDynamicFieldName, A4_HEIGHT_MM } from "@/lib/canvasUtils"
import { 
  formatAgendaItems, 
  formatAttendeesList, 
  formatMeetingDate,
  formatBuildingName,
  formatAddress,
  formatStrataPlan
} from "@/lib/canvasFormatters"

interface Attendee {
  name: string
  email?: string
  role?: string
  userid?: number
  present?: boolean
}

interface Section {
  id: number
  title: string
  order_index: number
}

interface Topic {
  id: number
  section_id: number | null
  title: string
  description: string | null
  order_index: number
  is_incamera: boolean
}

interface MeetingData {
  title?: string
  meeting_date?: string
  meeting_type?: string
  start_time?: string
  location?: string
  strata_plan_number?: string
  attendees?: Attendee[]
}

interface CanvasElementProps {
  element: CanvasElementType
  isSelected: boolean
  scale: number
  pageIndex: number
  onSelect: () => void
  onUpdate: (updates: Partial<CanvasElementType>) => void
  onDelete: () => void
  onDuplicate: () => void
  companyData?: {
    name: string
    logo_url: string | null
  }
  meetingData?: MeetingData
  sections?: Section[]
  topics?: Topic[]
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
  sections = [],
  topics = []
}: CanvasElementProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [resizeStart, setResizeStart] = useState({ width: 0, height: 0, mouseX: 0, mouseY: 0 })
  const elementRef = useRef<HTMLDivElement>(null)

  // Convert mm to pixels for rendering - adjust for page offset
  const pageOffsetMM = pageIndex * A4_HEIGHT_MM
  const relativeY = element.position.y - pageOffsetMM
  
  const x = element.position.x * 3.7795275591 * scale
  const y = relativeY * 3.7795275591 * scale
  const width = element.size.width * 3.7795275591 * scale
  const height = element.size.height * 3.7795275591 * scale

  // Handle drag start
  const handleMouseDown = (e: React.MouseEvent) => {
    if (element.locked || (e.target as HTMLElement).classList.contains('resize-handle')) return
    
    e.stopPropagation()
    onSelect()
    setIsDragging(true)
    setDragStart({
      x: e.clientX - x,
      y: e.clientY - y
    })
  }

  // Handle resize start
  const handleResizeStart = (e: React.MouseEvent) => {
    if (element.locked) return
    
    e.stopPropagation()
    setIsResizing(true)
    setResizeStart({
      width: element.size.width,
      height: element.size.height,
      mouseX: e.clientX,
      mouseY: e.clientY
    })
  }

  // Handle mouse move (drag or resize)
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        const newX = (e.clientX - dragStart.x) / scale / 3.7795275591
        const newY = ((e.clientY - dragStart.y) / scale / 3.7795275591) + pageOffsetMM
        
        onUpdate({
          position: {
            x: Math.max(0, Math.min(210, newX)),
            y: Math.max(0, newY)
          }
        })
      } else if (isResizing) {
        const deltaX = (e.clientX - resizeStart.mouseX) / scale / 3.7795275591
        const deltaY = (e.clientY - resizeStart.mouseY) / scale / 3.7795275591
        
        onUpdate({
          size: {
            width: Math.max(10, resizeStart.width + deltaX),
            height: Math.max(10, resizeStart.height + deltaY)
          }
        })
      }
    }

    const handleMouseUp = () => {
      setIsDragging(false)
      setIsResizing(false)
    }

    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, isResizing, dragStart, resizeStart, scale, pageOffsetMM, onUpdate])

  // Render content based on element type
  const renderContent = () => {
    const fontSize = element.style?.fontSize ? parseInt(String(element.style.fontSize)) : 12
    const fontWeight = element.style?.fontWeight || 'normal'
    const textAlign = element.style?.textAlign || 'left'
    const color = element.style?.color || '#000000'

    switch (element.type) {
      case 'text':
        return (
          <div
            style={{
              fontSize: `${fontSize * scale}px`,
              fontWeight,
              textAlign: textAlign as any,
              color,
              width: '100%',
              height: '100%',
              overflow: 'hidden',
              wordWrap: 'break-word',
              display: 'flex',
              alignItems: 'flex-start',
              padding: `${4 * scale}px`
            }}
          >
            {element.content as string || 'Text'}
          </div>
        )

      case 'image':
        const imageUrl = element.content as string
        if (imageUrl && imageUrl !== 'COMPANY_LOGO') {
          return (
            <img
              src={imageUrl}
              alt="Canvas image"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                borderRadius: `${Number(element.style?.borderRadius || 0)}px`
              }}
            />
          )
        }
        return (
          <div className="w-full h-full flex items-center justify-center bg-gray-100 text-gray-400 text-xs">
            <div className="text-center">
              <div className="text-2xl mb-1">🖼️</div>
              Image Placeholder
            </div>
          </div>
        )

      case 'shape':
      case 'container':
        return null

      case 'dynamic':
        return renderDynamicField()

      default:
        return null
    }
  }

  const renderDynamicField = () => {
    if (!element.content || typeof element.content !== 'object' || !('type' in element.content)) {
      return <div className="text-xs text-gray-400">Invalid dynamic field</div>
    }

    const fieldType = element.content.type as string
    const fontSize = element.style?.fontSize ? parseInt(String(element.style.fontSize)) : 11
    const fontWeight = element.style?.fontWeight || 'normal'
    const textAlign = element.style?.textAlign || 'left'
    const color = element.style?.color || '#000000'

    // Handle company_logo with LIVE PREVIEW
    if (fieldType === 'company_logo') {
      if (companyData?.logo_url) {
        return (
          <img
            src={companyData.logo_url}
            alt="Company Logo"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              borderRadius: `${Number(element.style?.borderRadius || 0)}px`
            }}
            onError={(e) => {
              e.currentTarget.style.display = 'none'
              if (e.currentTarget.parentElement) {
                e.currentTarget.parentElement.innerHTML = `
                  <div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:#f3f4f6;color:#9ca3af;font-size:10px;border-radius:${Number(element.style?.borderRadius || 0)}px">
                    <div style="text-align:center">
                      <div style="font-size:20px;margin-bottom:4px">🏢</div>
                      Logo
                    </div>
                  </div>
                `
              }
            }}
          />
        )
      }
      return (
        <div 
          className="w-full h-full flex items-center justify-center bg-gray-100 text-gray-400" 
          style={{ 
            fontSize: '10px', 
            borderRadius: `${Number(element.style?.borderRadius || 0)}px`
          }}
        >
          <div className="text-center">
            <div className="text-xl mb-1">🏢</div>
            Logo
          </div>
        </div>
      )
    }

    // USE SHARED FORMATTERS
    let previewValue = ''
    
    switch (fieldType) {
      case 'building_name':
        previewValue = formatBuildingName(companyData?.name || meetingData?.title || '')
        break
      
      case 'meeting_title':
      case 'meeting_type':
        previewValue = meetingData?.meeting_type || 'Council Meeting'
        break
      
      case 'meeting_date':
        previewValue = meetingData?.meeting_date 
          ? formatMeetingDate(meetingData.meeting_date)
          : formatMeetingDate(new Date().toISOString())
        break
      
      case 'meeting_time':
      case 'start_time':
        previewValue = meetingData?.start_time || '7:00 PM'
        break
      
      case 'meeting_location':
      case 'location':
        previewValue = meetingData?.location || 'Community Room'
        break
      
      case 'address':
        previewValue = formatAddress(meetingData?.strata_plan_number || '')
        break
      
      case 'strata_plan':
        previewValue = formatStrataPlan(meetingData?.strata_plan_number || '')
        break
      
      case 'topics_list':
      case 'sections_list':
        previewValue = formatAgendaItems(sections, topics)
        break
      
      case 'attendees_list':
        previewValue = formatAttendeesList(meetingData?.attendees || [])
        break
      
      default:
        previewValue = getDynamicFieldName(fieldType as any)
    }

    const isAgendaOrAttendees = fieldType === 'topics_list' || fieldType === 'sections_list' || fieldType === 'attendees_list'
    return (
      <div
        style={{
          fontSize: `${fontSize * scale}px`,
          fontWeight,
          textAlign: textAlign as any,
          color,
          width: '100%',
          height: '100%',
          overflow: isAgendaOrAttendees ? 'visible' : 'auto',
          wordWrap: 'break-word',
          whiteSpace: 'pre-wrap',
          fontFamily: isAgendaOrAttendees
            ? 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'
            : 'inherit',
          display: 'flex',
          alignItems: 'flex-start',
          padding: `${4 * scale}px`,
          lineHeight: 1.5
        }}
      >
        {previewValue}
      </div>
    )
  }

  // Element styles
  const elementStyle: React.CSSProperties = {
    position: 'absolute',
    left: `${x}px`,
    top: `${y}px`,
    width: `${width}px`,
    height: `${height}px`,
    backgroundColor: element.style?.backgroundColor || 'transparent',
    border: isSelected 
      ? '2px solid #3b82f6' 
      : element.style?.borderWidth 
        ? `${element.style.borderWidth} solid ${element.style.borderColor || '#000'}` 
        : 'none',
    borderRadius: `${Number(element.style?.borderRadius || 0)}px`,
    cursor: element.locked ? 'not-allowed' : isDragging ? 'grabbing' : 'grab',
    userSelect: 'none',
    boxShadow: isSelected ? '0 0 0 1px #3b82f6' : 'none',
    zIndex: isSelected ? 1000 : element.position.y * 10,
    opacity: element.locked ? 0.6 : 1
  }

  return (
    <>
      <div
        ref={elementRef}
        style={elementStyle}
        onMouseDown={handleMouseDown}
        onClick={(e) => {
          e.stopPropagation()
          onSelect()
        }}
      >
        {renderContent()}

        {/* Selection toolbar */}
        {isSelected && !element.locked && (
          <>
            {/* Top toolbar */}
            <div
              style={{
                position: 'absolute',
                top: '-32px',
                left: '0',
                display: 'flex',
                gap: '4px',
                backgroundColor: '#3b82f6',
                padding: '4px',
                borderRadius: '4px',
                zIndex: 1001
              }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onDuplicate()
                }}
                style={{
                  padding: '4px 8px',
                  backgroundColor: 'white',
                  border: 'none',
                  borderRadius: '2px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '11px'
                }}
                title="Duplicate"
              >
                <Copy className="h-3 w-3" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onUpdate({ locked: !element.locked })
                }}
                style={{
                  padding: '4px 8px',
                  backgroundColor: 'white',
                  border: 'none',
                  borderRadius: '2px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '11px'
                }}
                title={element.locked ? "Unlock" : "Lock"}
              >
                {element.locked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete()
                }}
                style={{
                  padding: '4px 8px',
                  backgroundColor: '#ef4444',
                  color: 'white',
                  border: 'none',
                  borderRadius: '2px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '11px'
                }}
                title="Delete"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>

            {/* Resize handle */}
            <div
              className="resize-handle"
              onMouseDown={handleResizeStart}
              style={{
                position: 'absolute',
                right: '-4px',
                bottom: '-4px',
                width: '12px',
                height: '12px',
                backgroundColor: '#3b82f6',
                border: '2px solid white',
                borderRadius: '50%',
                cursor: 'nwse-resize',
                zIndex: 1002
              }}
            />

            {/* Drag handle */}
            <div
              style={{
                position: 'absolute',
                top: '4px',
                right: '4px',
                backgroundColor: 'rgba(59, 130, 246, 0.8)',
                borderRadius: '2px',
                padding: '2px',
                cursor: 'grab',
                zIndex: 1001
              }}
            >
              <GripVertical className="h-3 w-3 text-white" />
            </div>
          </>
        )}

        {/* Locked Indicator */}
        {element.locked && (
          <div
            style={{
              position: 'absolute',
              top: '4px',
              left: '4px',
              backgroundColor: 'rgba(0,0,0,0.7)',
              color: 'white',
              padding: '2px 6px',
              borderRadius: '3px',
              fontSize: `${10 * scale}px`,
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <Lock className="h-3 w-3" />
            Locked
          </div>
        )}
      </div>
    </>
  )
}
