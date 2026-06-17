// @ts-nocheck
import jsPDF from 'jspdf'
import { CanvasElement } from '@/lib/canvasUtils'
import { formatMeetingDate } from '@/lib/canvasFormatters'

// ============== TYPES ==============

interface Attendee {
  name: string
  email?: string
  role?: string
  userid?: number
  present?: boolean
}

interface Meeting {
  title: string
  meeting_date: string
  meeting_type: string | null
  start_time: string | null
  location: string | null
  strata_plan_number: string | null
  attendees?: Attendee[] | any
  buildings: {
    name: string
    address: string | null
    logo_url: string | null
    companies?: {
      logo_url: string | null
    }
  }
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

// ============== CONSTANTS ==============

const MM_TO_PT = 2.83465
const PAGE_HEIGHT = 841.89 // A4 height in points
const PAGE_MARGIN_BOTTOM = 50 // Bottom margin in points

// ============== MAIN FUNCTION ==============

export async function generateCanvasPDF(
  elements: CanvasElement[],
  meeting: Meeting,
  sections: Section[],
  topics: Topic[]
) {
  console.log('🎨 Generating Canvas PDF with', elements.length, 'elements')

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4'
  })

  const logoUrl = meeting.buildings?.logo_url || meeting.buildings?.companies?.logo_url || null
  console.log('📷 Canvas PDF - Logo URL:', logoUrl)

  for (const element of elements) {
    await renderElement(pdf, element, meeting, sections, topics, logoUrl)
  }

  const fileName = `${meeting.buildings?.name || 'Meeting'}_Agenda_${meeting.meeting_date}.pdf`
  pdf.save(fileName)
  
  console.log('✅ Canvas PDF generated successfully')
}

// ============== RENDER FUNCTIONS ==============

async function renderElement(
  pdf: jsPDF,
  element: CanvasElement,
  meeting: Meeting,
  sections: Section[],
  topics: Topic[],
  logoUrl: string | null
) {
  const x = element.position.x * MM_TO_PT
  const y = element.position.y * MM_TO_PT
  const width = element.size.width * MM_TO_PT
  const height = element.size.height * MM_TO_PT

  console.log(`Rendering ${element.type} at (${element.position.x}, ${element.position.y})`)

  switch (element.type) {
    case 'text':
      renderTextElement(pdf, element, x, y, width, height)
      break
    case 'shape':
      renderShapeElement(pdf, element, x, y, width, height)
      break
    case 'container':
      renderContainerElement(pdf, element, x, y, width, height)
      break
    case 'image':
      await renderImageElement(pdf, element, x, y, width, height, logoUrl)
      break
    case 'dynamic':
      await renderDynamicElement(pdf, element, x, y, width, height, meeting, sections, topics, logoUrl)
      break
    case 'html_header':
      await renderHtmlHeaderElement(pdf, element, x, y, width, height)
      break
    default:
      console.warn('Unknown element type:', element.type)
  }
}

function renderTextElement(
  pdf: jsPDF,
  element: CanvasElement,
  x: number,
  y: number,
  width: number,
  height: number
) {
  if (!element.content || typeof element.content !== 'string') return

  const fontSize = element.style?.fontSize ? parseInt(element.style.fontSize) : 12
  const fontWeight = element.style?.fontWeight === 'bold' ? 'bold' : 'normal'
  const textAlign = element.style?.textAlign || 'left'
  const color = element.style?.color || '#000000'

  pdf.setFontSize(fontSize)
  pdf.setFont('helvetica', fontWeight)
  pdf.setTextColor(color)

  const textY = y + (fontSize * 0.75)
  const content = element.content
  
  if (textAlign === 'center') {
    pdf.text(content, x + width / 2, textY, { align: 'center', maxWidth: width })
  } else if (textAlign === 'right') {
    pdf.text(content, x + width, textY, { align: 'right', maxWidth: width })
  } else {
    pdf.text(content, x, textY, { maxWidth: width })
  }
}

function renderShapeElement(
  pdf: jsPDF,
  element: CanvasElement,
  x: number,
  y: number,
  width: number,
  height: number
) {
  const bgColor = element.style?.backgroundColor || '#f0f0f0'
  const borderColor = element.style?.borderColor || '#000000'
  const borderWidth = element.style?.borderWidth ? parseInt(element.style.borderWidth) : 0

  pdf.setFillColor(bgColor)
  
  if (borderWidth > 0) {
    pdf.setDrawColor(borderColor)
    pdf.setLineWidth(borderWidth)
    pdf.rect(x, y, width, height, 'FD')
  } else {
    pdf.rect(x, y, width, height, 'F')
  }
}

function renderContainerElement(
  pdf: jsPDF,
  element: CanvasElement,
  x: number,
  y: number,
  width: number,
  height: number
) {
  const bgColor = element.style?.backgroundColor || '#ffffff'
  const borderColor = element.style?.borderColor || '#cccccc'
  const borderWidth = element.style?.borderWidth ? parseInt(element.style.borderWidth) : 1

  pdf.setFillColor(bgColor)
  pdf.setDrawColor(borderColor)
  pdf.setLineWidth(borderWidth)
  pdf.rect(x, y, width, height, 'FD')
}

async function renderImageElement(
  pdf: jsPDF,
  element: CanvasElement,
  x: number,
  y: number,
  width: number,
  height: number,
  logoUrl: string | null
) {
  let imageUrl = element.content as string

  // If this is a logo placeholder, use actual logo URL
  if (imageUrl === 'COMPANY_LOGO' && logoUrl) {
    imageUrl = logoUrl
  }

  if (!imageUrl) {
    console.warn('⚠️ No image URL provided for image element')
    return
  }

  console.log('🖼️ Attempting to load image from:', imageUrl)

  try {
    // Convert image to base64 first to avoid CORS issues
    const base64Image = await imageUrlToBase64(imageUrl)
    
    // Determine format from base64 prefix or URL
    let format = 'JPEG'
    if (base64Image.includes('data:image/png')) {
      format = 'PNG'
    } else if (base64Image.includes('data:image/jpeg') || base64Image.includes('data:image/jpg')) {
      format = 'JPEG'
    }
    
    pdf.addImage(base64Image, format, x, y, width, height)
    console.log('✅ Image loaded successfully')
  } catch (error) {
    console.error('❌ Failed to load image:', imageUrl, error)
    
    // Draw a visible placeholder with border
    pdf.setFillColor('#f8f9fa')
    pdf.setDrawColor('#dee2e6')
    pdf.setLineWidth(1)
    pdf.rect(x, y, width, height, 'FD')
    
    // Add "Logo" text
    pdf.setFontSize(12)
    pdf.setTextColor('#6c757d')
    pdf.text('Logo', x + width / 2, y + height / 2, { align: 'center' })
  }
}

async function renderDynamicElement(
  pdf: jsPDF,
  element: CanvasElement,
  x: number,
  y: number,
  width: number,
  height: number,
  meeting: Meeting,
  sections: Section[],
  topics: Topic[],
  logoUrl: string | null
) {
  if (!element.content || typeof element.content !== 'object' || !('type' in element.content)) return

  const fieldType = element.content.type as string

  // Handle company_logo as a special dynamic type
  if (fieldType === 'company_logo') {
    console.log('🖼️ Rendering company logo as dynamic element')
    
    if (!logoUrl) {
      console.warn('⚠️ No company logo URL available')
      
      // Draw placeholder
      pdf.setFillColor('#f8f9fa')
      pdf.setDrawColor('#dee2e6')
      pdf.setLineWidth(1)
      pdf.rect(x, y, width, height, 'FD')
      
      pdf.setFontSize(10)
      pdf.setTextColor('#6c757d')
      pdf.text('Logo', x + width / 2, y + height / 2, { align: 'center' })
      return
    }

    try {
      console.log('🖼️ Loading company logo from:', logoUrl)
      const base64Image = await imageUrlToBase64(logoUrl)
      
      // Determine format
      let format = 'JPEG'
      if (base64Image.includes('data:image/png')) {
        format = 'PNG'
      } else if (base64Image.includes('data:image/jpeg') || base64Image.includes('data:image/jpg')) {
        format = 'JPEG'
      }
      
      pdf.addImage(base64Image, format, x, y, width, height)
      
      console.log('✅ Company logo rendered successfully')
    } catch (error) {
      console.error('❌ Failed to load company logo:', logoUrl, error)
      
      // Draw placeholder on error
      pdf.setFillColor('#f8f9fa')
      pdf.setDrawColor('#dee2e6')
      pdf.setLineWidth(1)
      pdf.rect(x, y, width, height, 'FD')
      
      pdf.setFontSize(10)
      pdf.setTextColor('#6c757d')
      pdf.text('Logo', x + width / 2, y + height / 2, { align: 'center' })
    }
    return
  }

  // Handle other dynamic fields
  let value = ''

  switch (fieldType) {
    case 'document_heading': {
      const buildingName = meeting.buildings?.name || ''
      const meetingType = meeting.meeting_type || 'Council Meeting'
      const strataNo = meeting.strata_plan_number || ''
      const dateStr = formatMeetingDate(meeting.meeting_date)
      const timeStr = meeting.start_time || ''
      const location = meeting.location || ''
      const cfg = element.config || {}
      const headingFormat = cfg.headingFormat || 'full_sentence'
      const orientation = cfg.orientation || 'horizontal'

      const isMinutes = meeting.status === 'minutes' || (meeting.title && meeting.title.toLowerCase().includes('minutes'))
      const docLabel = isMinutes ? 'Minutes' : 'Agenda'

      if (headingFormat === 'full_sentence' || headingFormat === 'inline') {
        const sentence = `${docLabel} of the ${meetingType} of ${buildingName}, Strata Plan ${strataNo}, held on ${dateStr}${timeStr ? ' at ' + timeStr : ''}${location ? ' in ' + location : ''}.`
        renderSimpleTextDynamic(pdf, element, x, y, width, sentence)
      } else {
        const fontSize = element.style?.fontSize ? parseInt(element.style.fontSize) : 12
        const fontWeight = element.style?.fontWeight === 'bold' ? 'bold' : 'normal'
        const color = element.style?.color || '#000000'
        
        pdf.setFontSize(fontSize)
        pdf.setFont('helvetica', fontWeight)
        pdf.setTextColor(color)
        
        let currentY = y + fontSize * 0.75
        
        pdf.setFont('helvetica', 'bold')
        pdf.setFontSize(fontSize + 2)
        pdf.text(`${docLabel} of the ${meetingType}`, x, currentY)
        currentY += (fontSize + 2) * 1.3
        
        pdf.setFont('helvetica', 'normal')
        pdf.setFontSize(fontSize)
        pdf.text(`${buildingName} · Strata Plan ${strataNo}`, x, currentY)
        currentY += fontSize * 1.3
        
        if (orientation === 'vertical') {
          pdf.text(`📅 ${dateStr}`, x, currentY)
          currentY += fontSize * 1.2
          if (timeStr) {
            pdf.text(`🕐 ${timeStr}`, x, currentY)
            currentY += fontSize * 1.2
          }
          if (location) {
            pdf.text(`📍 ${location}`, x, currentY)
          }
        } else {
          const details = `📅 ${dateStr}${timeStr ? '  🕐 ' + timeStr : ''}${location ? '  📍 ' + location : ''}`
          pdf.text(details, x, currentY)
        }
      }
      return
    }

    case 'attendance_block': {
      const attendees = meeting.attendees || []
      const cfg = element.config || {}
      const attendanceStyle = cfg.attendanceStyle || 'table'
      const orientation = cfg.orientation || 'horizontal'

      const fontSize = element.style?.fontSize ? parseInt(element.style.fontSize) : 10
      const color = element.style?.color || '#000000'
      const bgColor = element.style?.backgroundColor || '#f3f4f6'

      pdf.setFontSize(fontSize)
      pdf.setFont('helvetica', 'normal')
      pdf.setTextColor(color)

      if (!attendees || !Array.isArray(attendees) || attendees.length === 0) {
        pdf.text('No attendees recorded.', x, y + fontSize)
        return
      }

      let currentY = y + fontSize

      if (attendanceStyle === 'table' || orientation === 'horizontal') {
        const rowHeight = fontSize * 1.8
        const colWidths = [width * 0.45, width * 0.4, width * 0.15]
        
        pdf.setFillColor(bgColor)
        pdf.rect(x, currentY - fontSize * 0.8, width, rowHeight, 'F')
        
        pdf.setFont('helvetica', 'bold')
        pdf.text('Name', x + 4, currentY + fontSize * 0.1)
        pdf.text('Role', x + colWidths[0] + 4, currentY + fontSize * 0.1)
        pdf.text('Present', x + colWidths[0] + colWidths[1], currentY + fontSize * 0.1, { align: 'center' })
        
        currentY += rowHeight
        pdf.setFont('helvetica', 'normal')

        attendees.forEach((a: any, i: number) => {
          if (currentY > PAGE_HEIGHT - PAGE_MARGIN_BOTTOM) {
            pdf.addPage()
            currentY = 50 + rowHeight
          }
          
          if (i % 2 === 1) {
            pdf.setFillColor('rgba(0,0,0,0.02)')
            pdf.rect(x, currentY - fontSize * 0.8, width, rowHeight, 'F')
          }
          
          pdf.text(a.name || '', x + 4, currentY + fontSize * 0.1)
          pdf.setTextColor('#6b7280')
          pdf.text(a.role || '', x + colWidths[0] + 4, currentY + fontSize * 0.1)
          pdf.setTextColor(color)
          pdf.text(a.present ? 'Yes' : 'No', x + colWidths[0] + colWidths[1], currentY + fontSize * 0.1, { align: "center" })
          
          currentY += rowHeight
        })
      } else {
        attendees.forEach((a: any, i: number) => {
          if (currentY > PAGE_HEIGHT - PAGE_MARGIN_BOTTOM) {
            pdf.addPage()
            currentY = 50
          }
          
          const statusBullet = a.present ? 'Present' : 'Absent'
          const roleText = a.role ? ` (${a.role})` : ''
          const lineText = `• ${a.name}${roleText} - ${statusBullet}`
          
          pdf.text(lineText, x, currentY)
          currentY += fontSize * 1.3
        })
      }
      return
    }

    case 'building_name':
      value = meeting.buildings?.name || ''
      break
    case 'meeting_title':
    case 'meeting_type':
      value = meeting.meeting_type || ''
      break
    case 'meeting_date':
      value = formatMeetingDate(meeting.meeting_date)
      break
    case 'meeting_time':
    case 'start_time':
      value = meeting.start_time || ''
      break
    case 'meeting_location':
    case 'location':
      value = meeting.location || ''
      break
    case 'address':
      value = meeting.buildings?.address || ''
      break
    case 'strata_plan':
      value = meeting.strata_plan_number || ''
      break
    case 'topics_list':
    case 'sections_list':
      renderSectionsAndTopicsWithPagination(pdf, sections, topics, x, y, width)
      return // Exit early since we handled rendering directly
    case 'attendees_list':
      renderAttendeesListWithPagination(pdf, meeting.attendees, x, y, width)
      return // Exit early since we handled rendering directly
    default:
      value = `[${fieldType}]`
  }

  const fontSize = element.style?.fontSize ? parseInt(element.style.fontSize) : 11
  const fontWeight = element.style?.fontWeight === 'bold' ? 'bold' : 'normal'
  const textAlign = element.style?.textAlign || 'left'
  const color = element.style?.color || '#000000'

  pdf.setFontSize(fontSize)
  pdf.setFont('helvetica', fontWeight)
  pdf.setTextColor(color)

  // Split text by lines and render with proper line breaks
  const lines = pdf.splitTextToSize(value, width)
  const lineHeight = fontSize * 1.2
  
  lines.forEach((line: string, index: number) => {
    const currentY = y + (fontSize * 0.75) + (index * lineHeight)
    
    // Check if we need a new page
    if (currentY > PAGE_HEIGHT - PAGE_MARGIN_BOTTOM) {
      pdf.addPage()
      const newY = 50 // Start from top of new page
      pdf.text(line, x, newY, { maxWidth: width })
    } else {
      if (textAlign === 'center') {
        pdf.text(line, x + width / 2, currentY, { align: 'center' })
      } else if (textAlign === 'right') {
        pdf.text(line, x + width, currentY, { align: 'right' })
      } else {
        pdf.text(line, x, currentY)
      }
    }
  })
}

// ============== HELPER FUNCTIONS ==============

// Multi-page rendering for sections and topics
function renderSectionsAndTopicsWithPagination(
  pdf: jsPDF,
  sections: Section[],
  topics: Topic[],
  startX: number,
  startY: number,
  maxWidth: number
) {
  let currentY = startY
  const lineHeight = 14
  const fontSize = 11
  
  pdf.setFontSize(fontSize)
  pdf.setFont('helvetica', 'normal')
  pdf.setTextColor('#000000')
  
  sections.forEach((section, sectionIndex) => {
    const sectionNumber = sectionIndex + 1
    
    // Check if we need a new page before section header
    if (currentY > PAGE_HEIGHT - PAGE_MARGIN_BOTTOM - 50) {
      pdf.addPage()
      currentY = 50
    }
    
    // Section header - BOLD
    pdf.setFont('helvetica', 'bold')
    const sectionHeader = `${sectionNumber}. ${section.title.toUpperCase()}`
    pdf.text(sectionHeader, startX, currentY)
    currentY += lineHeight + 5
    
    // Separator line
    const separatorLine = '_'.repeat(80)
    pdf.setFont('helvetica', 'normal')
    pdf.text(separatorLine, startX, currentY)
    currentY += lineHeight + 5
    
    const sectionTopics = topics.filter(t => t.section_id === section.id)
    
    if (sectionTopics.length === 0) {
      pdf.text('   No items scheduled', startX, currentY)
      currentY += lineHeight + 10
    } else {
      sectionTopics.forEach((topic, topicIndex) => {
        const topicNumber = `${sectionNumber}.${topicIndex + 1}`
        const incameraTag = topic.is_incamera ? ' [IN-CAMERA]' : ''
        
        // Check if we need a new page before topic
        if (currentY > PAGE_HEIGHT - PAGE_MARGIN_BOTTOM - 30) {
          pdf.addPage()
          currentY = 50
        }
        
        // Topic number and title
        pdf.setFont('helvetica', 'bold')
        const topicHeader = `   ${topicNumber}  ${topic.title}${incameraTag}`
        const topicLines = pdf.splitTextToSize(topicHeader, maxWidth - 20)
        topicLines.forEach((line: string) => {
          pdf.text(line, startX, currentY)
          currentY += lineHeight
        })
        currentY += 5
        
        // Topic description
        if (topic.description) {
          pdf.setFont('helvetica', 'normal')
          const descLines = pdf.splitTextToSize(`        ${topic.description}`, maxWidth - 40)
          descLines.forEach((line: string) => {
            // Check if we need a new page
            if (currentY > PAGE_HEIGHT - PAGE_MARGIN_BOTTOM) {
              pdf.addPage()
              currentY = 50
            }
            pdf.text(line, startX, currentY)
            currentY += lineHeight
          })
          currentY += 10
        } else {
          currentY += 5
        }
      })
    }
    
    // Spacing between sections
    currentY += 15
  })
}

// Multi-page rendering for attendees
function renderAttendeesListWithPagination(
  pdf: jsPDF,
  attendees: Attendee[] | any,
  startX: number,
  startY: number,
  maxWidth: number
) {
  let currentY = startY
  const lineHeight = 14
  const fontSize = 11
  
  pdf.setFontSize(fontSize)
  pdf.setFont('helvetica', 'normal')
  pdf.setTextColor('#000000')
  
  if (!attendees || !Array.isArray(attendees) || attendees.length === 0) {
    pdf.text('No attendees recorded for this meeting.', startX, currentY)
    return
  }
  
  // Separate attendees by status
  const presentAttendees = attendees.filter(a => a.present === true)
  const absentAttendees = attendees.filter(a => a.present === false)
  const unknownAttendees = attendees.filter(a => a.present === undefined || a.present === null)
  
  // Header
  pdf.setFont('helvetica', 'bold')
  pdf.text('ATTENDEES', startX, currentY)
  currentY += lineHeight + 5
  
  const separatorLine = '_'.repeat(80)
  pdf.setFont('helvetica', 'normal')
  pdf.text(separatorLine, startX, currentY)
  currentY += lineHeight + 10
  
  // Present attendees
  if (presentAttendees.length > 0) {
    // Check page break
    if (currentY > PAGE_HEIGHT - PAGE_MARGIN_BOTTOM - 50) {
      pdf.addPage()
      currentY = 50
    }
    
    pdf.setFont('helvetica', 'bold')
    pdf.text('PRESENT:', startX, currentY)
    currentY += lineHeight + 3
    
    pdf.setFont('helvetica', 'normal')
    presentAttendees.forEach((attendee, index) => {
      if (currentY > PAGE_HEIGHT - PAGE_MARGIN_BOTTOM) {
        pdf.addPage()
        currentY = 50
      }
      const roleText = attendee.role ? ` - ${attendee.role}` : ''
      pdf.text(`   ${index + 1}. ${attendee.name}${roleText}`, startX, currentY)
      currentY += lineHeight
    })
    currentY += 10
  }
  
  // Absent attendees
  if (absentAttendees.length > 0) {
    if (currentY > PAGE_HEIGHT - PAGE_MARGIN_BOTTOM - 50) {
      pdf.addPage()
      currentY = 50
    }
    
    pdf.setFont('helvetica', 'bold')
    pdf.text('ABSENT:', startX, currentY)
    currentY += lineHeight + 3
    
    pdf.setFont('helvetica', 'normal')
    absentAttendees.forEach((attendee, index) => {
      if (currentY > PAGE_HEIGHT - PAGE_MARGIN_BOTTOM) {
        pdf.addPage()
        currentY = 50
      }
      const roleText = attendee.role ? ` - ${attendee.role}` : ''
      pdf.text(`   ${index + 1}. ${attendee.name}${roleText}`, startX, currentY)
      currentY += lineHeight
    })
    currentY += 10
  }
  
  // Unknown status
  if (unknownAttendees.length > 0) {
    if (currentY > PAGE_HEIGHT - PAGE_MARGIN_BOTTOM - 50) {
      pdf.addPage()
      currentY = 50
    }
    
    pdf.setFont('helvetica', 'bold')
    pdf.text('STATUS PENDING:', startX, currentY)
    currentY += lineHeight + 3
    
    pdf.setFont('helvetica', 'normal')
    unknownAttendees.forEach((attendee, index) => {
      if (currentY > PAGE_HEIGHT - PAGE_MARGIN_BOTTOM) {
        pdf.addPage()
        currentY = 50
      }
      const roleText = attendee.role ? ` - ${attendee.role}` : ''
      pdf.text(`   ${index + 1}. ${attendee.name}${roleText}`, startX, currentY)
      currentY += lineHeight
    })
    currentY += 10
  }
  
  // Total summary
  if (currentY > PAGE_HEIGHT - PAGE_MARGIN_BOTTOM - 20) {
    pdf.addPage()
    currentY = 50
  }
  
  pdf.setFont('helvetica', 'bold')
  pdf.text(`Total Attendees: ${attendees.length}`, startX, currentY)
  currentY += lineHeight
  pdf.text(`Quorum: ${presentAttendees.length} present`, startX, currentY)
}

// Convert image URL to base64
async function imageUrlToBase64(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    fetch(url, { mode: 'cors' })
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }
        return response.blob()
      })
      .then(blob => {
        const reader = new FileReader()
        reader.onloadend = () => {
          const base64 = reader.result as string
          resolve(base64)
        }
        reader.onerror = reject
        reader.readAsDataURL(blob)
      })
      .catch(error => {
        console.warn('Fetch failed, trying Image fallback:', error)
        loadImageAsBase64(url).then(resolve).catch(reject)
      })
  })
}

// Fallback method using Image and Canvas
function loadImageAsBase64(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = img.width
        canvas.height = img.height
        
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('Could not get canvas context'))
          return
        }
        
        ctx.drawImage(img, 0, 0)
        const base64 = canvas.toDataURL('image/png')
        resolve(base64)
      } catch (error) {
        reject(error)
      }
    }
    
    img.onerror = () => {
      reject(new Error(`Failed to load image: ${url}`))
    }
    
    img.src = url
  })
}

function renderSimpleTextDynamic(
  pdf: jsPDF,
  element: CanvasElement,
  x: number,
  y: number,
  width: number,
  value: string
) {
  const fontSize = element.style?.fontSize ? parseInt(element.style.fontSize) : 11
  const fontWeight = element.style?.fontWeight === 'bold' ? 'bold' : 'normal'
  const textAlign = element.style?.textAlign || 'left'
  const color = element.style?.color || '#000000'

  pdf.setFontSize(fontSize)
  pdf.setFont('helvetica', fontWeight)
  pdf.setTextColor(color)

  const lines = pdf.splitTextToSize(value || '', width)
  const lineHeight = fontSize * 1.2

  lines.forEach((line: string, index: number) => {
    let currentY = y + fontSize * 0.75 + index * lineHeight

    if (currentY > PAGE_HEIGHT - PAGE_MARGIN_BOTTOM) {
      pdf.addPage()
      currentY = 50
    }

    if (textAlign === 'center') {
      pdf.text(line, x + width / 2, currentY, { align: 'center' })
    } else if (textAlign === 'right') {
      pdf.text(line, x + width, currentY, { align: 'right' })
    } else {
      pdf.text(line, x, currentY)
    }
  })
}

async function renderHtmlHeaderElement(
  pdf: jsPDF,
  element: CanvasElement,
  x: number,
  y: number,
  width: number,
  height: number
) {
  if (!element.content || typeof element.content !== 'string') return

  try {
    const html2canvas = (await import('html2canvas')).default
    
    const container = document.createElement('div')
    container.style.position = 'absolute'
    container.style.left = '-9999px'
    container.style.top = '-9999px'
    
    const mmToPx = 3.7795275591
    const elementWidthPx = element.size.width * mmToPx
    const elementHeightPx = element.size.height * mmToPx
    
    container.style.width = `${elementWidthPx}px`
    container.style.height = `${elementHeightPx}px`
    container.style.overflow = 'hidden'
    container.innerHTML = element.content

    document.body.appendChild(container)

    // Wait a brief moment for assets
    await new Promise((resolve) => setTimeout(resolve, 150))

    const canvas = await html2canvas(container, {
      width: elementWidthPx,
      height: elementHeightPx,
      backgroundColor: null,
      logging: false,
      useCORS: true,
      scale: 2
    })

    document.body.removeChild(container)

    const base64Image = canvas.toDataURL('image/png')
    pdf.addImage(base64Image, 'PNG', x, y, width, height)
  } catch (error) {
    console.error('❌ Failed to render HTML Header to PDF:', error)
    pdf.setFillColor('#1e3a8a')
    pdf.rect(x, y, width, height, 'F')
    pdf.setFontSize(10)
    pdf.setTextColor('#ffffff')
    pdf.text('HTML Header Render Failed', x + 10, y + 20)
  }
}
