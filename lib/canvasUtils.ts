// lib/canvasUtils.ts

// ============== CONSTANTS ==============

// A4 dimensions at 96 DPI (for screen)
export const A4_WIDTH_MM = 210
export const A4_HEIGHT_MM = 297
export const A4_WIDTH_PX = A4_WIDTH_MM * 3.7795275591 // 793.7px
export const A4_HEIGHT_PX = A4_HEIGHT_MM * 3.7795275591 // 1122.5px
export const GRID_SIZE_PX = 10

// Multi-page constants
export const PAGE_GAP_PX = 40 // Gap between pages in canvas
export const MAX_PAGES = 10 // Maximum pages to show

// ============== HELPER: Generate unique ID ==============
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

// ============== TYPES ==============

export type ElementType = 'text' | 'image' | 'shape' | 'container' | 'dynamic'

export type DynamicFieldType =
  | 'company_logo'
  | 'building_name'
  | 'meeting_title'
  | 'meeting_type'
  | 'meeting_date'
  | 'meeting_time'
  | 'start_time'
  | 'meeting_location'
  | 'location'
  | 'address'
  | 'strata_plan'
  | 'topics_list'
  | 'sections_list'
  | 'attendees_list'

export interface CanvasElement {
  id: string
  type: ElementType
  position: { x: number; y: number } // in mm
  size: { width: number; height: number } // in mm
  content?: string | { type: DynamicFieldType } | null
  style?: {
    fontSize?: string | number
    fontFamily?: string
    fontWeight?: string
    color?: string
    backgroundColor?: string
    borderWidth?: string
    borderColor?: string
    borderRadius?: string | number
    textAlign?: string
  }
  zIndex?: number
  locked?: boolean
}

export interface RichTextBlock {
  id: string
  slot: 'header' | 'footer'
  order: number
  label: string
  content: string
  fontSize: number
  bold: boolean
  italic: boolean
  textAlign: 'left' | 'center' | 'right'
  meetingTypeFilter: string[]
}

// ============== HELPER FUNCTIONS ==============

export function createDefaultElement(
  type: ElementType,
  position: { x: number; y: number },
  size: { width: number; height: number }
): CanvasElement {
  const baseElement: CanvasElement = {
    id: generateId(),
    type,
    position,
    size,
    content: null,
    style: {},
    locked: false
  }

  switch (type) {
    case 'text':
      return {
        ...baseElement,
        content: 'New Text',
        style: {
          fontSize: 14,
          fontWeight: 'normal',
          color: '#000000',
          textAlign: 'left'
        }
      }

    case 'image':
      return {
        ...baseElement,
        content: null,
        style: {
          borderRadius: 0
        }
      }

    case 'shape':
      return {
        ...baseElement,
        style: {
          backgroundColor: '#e5e7eb',
          borderWidth: '1px',
          borderColor: '#9ca3af',
          borderRadius: 4
        }
      }

    case 'container':
      return {
        ...baseElement,
        style: {
          backgroundColor: '#ffffff',
          borderWidth: '1px',
          borderColor: '#d1d5db',
          borderRadius: 8
        }
      }

    case 'dynamic':
      return {
        ...baseElement,
        content: { type: 'building_name' },
        style: {
          fontSize: 14,
          fontWeight: 'normal',
          color: '#000000',
          textAlign: 'left'
        }
      }

    default:
      return baseElement
  }
}

export function duplicateElement(element: CanvasElement): CanvasElement {
  return {
    ...element,
    id: generateId(),
    position: {
      x: element.position.x + 5,
      y: element.position.y + 5
    }
  }
}

export function getDynamicFieldName(type: DynamicFieldType): string {
  const names: Record<DynamicFieldType, string> = {
    company_logo: 'Company Logo',
    building_name: 'Building Name',
    meeting_title: 'Meeting Title',
    meeting_type: 'Meeting Type',
    meeting_date: 'Meeting Date',
    meeting_time: 'Meeting Time',
    start_time: 'Start Time',
    meeting_location: 'Meeting Location',
    location: 'Location',
    address: 'Address',
    strata_plan: 'Strata Plan',
    topics_list: 'Agenda Items',
    sections_list: 'Sections List',
    attendees_list: 'Attendees List'
  }
  return names[type] || type
}

export function getElementTypeName(type: ElementType): string {
  const names: Record<ElementType, string> = {
    text: 'Text',
    image: 'Image',
    shape: 'Shape',
    container: 'Container',
    dynamic: 'Dynamic Field'
  }
  return names[type] || type
}

// Calculate which page an element is on (0-indexed)
export function getElementPage(element: CanvasElement): number {
  return Math.floor(element.position.y / A4_HEIGHT_MM)
}

// Get total canvas height based on elements
export function getCanvasHeight(elements: CanvasElement[]): number {
  if (elements.length === 0) return A4_HEIGHT_MM
  
  const maxY = Math.max(...elements.map(el => el.position.y + el.size.height))
  const maxPage = Math.ceil(maxY / A4_HEIGHT_MM)
  
  return Math.min(maxPage, MAX_PAGES) * A4_HEIGHT_MM
}

// Get page count
export function getPageCount(elements: CanvasElement[]): number {
  if (elements.length === 0) return 1
  
  const maxY = Math.max(...elements.map(el => el.position.y + el.size.height))
  return Math.max(1, Math.min(Math.ceil(maxY / A4_HEIGHT_MM), MAX_PAGES))
}
