import jsPDF from "jspdf"

interface Topic {
  id: number
  title: string
  description: string | null
  section_id: number | null
  order_index: number
  is_incamera?: boolean
  incamera_start_time?: string | null
  incamera_end_time?: string | null
}

interface Section {
  id: number
  title: string
  order_index: number
}

interface TemplateField {
  id: string
  label: string
  visible: boolean
  order: number
}

interface TemplateSection {
  id: string
  label: string
  icon: string
  backgroundColor: string
  layoutStyle?: string
  fields: TemplateField[]
}

interface TemplateConfig {
  sections: TemplateSection[]
}

const loadImageAsDataUrl = async (url: string): Promise<string | null> => {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const blob = await res.blob()
    return await new Promise((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.readAsDataURL(blob)
    })
  } catch (e) {
    return null
  }
}

export const generatePDF = async (
  meeting: any,
  sections: Section[],
  topics: Topic[],
  template: TemplateConfig | null
) => {
  const pdf = new jsPDF("p", "mm", "a4")
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const margin = 18
  let yPosition = margin
  let currentPage = 1

  const building = meeting.buildings
  const company = building?.companies

  const meetingDate = new Date(meeting.meeting_date).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric"
  })

  const logoUrl: string | null = building?.logo_url || company?.logo_url || null
  let logoDataUrl: string | null = null
  
  if (logoUrl) {
    logoDataUrl = await loadImageAsDataUrl(logoUrl)
  }

  // Get template configuration or use defaults
  const headerSection = template?.sections.find(s => s.id === "header")
  const sectionsSection = template?.sections.find(s => s.id === "sections")
  const footerSection = template?.sections.find(s => s.id === "footer")

  // Get layout styles
  const headerLayout = headerSection?.layoutStyle || "vertical"
  const sectionsLayout = sectionsSection?.layoutStyle || "full_width"
  const footerLayout = footerSection?.layoutStyle || "three_column"

  // Helper to check if field is visible
  const isFieldVisible = (sectionFields: TemplateField[] | undefined, fieldId: string) => {
    if (!sectionFields) return true
    const field = sectionFields.find(f => f.id === fieldId)
    return field ? field.visible : true
  }

  // Get colors from template or use defaults
  const headerBg = headerSection?.backgroundColor || "#0f235a"
  const sectionsBg = sectionsSection?.backgroundColor || "#648cff"
  const footerBg = footerSection?.backgroundColor || "#0f235a"

  // Convert hex to RGB
  const hexToRgb = (hex: string): number[] => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    return result ? [
      parseInt(result[1], 16),
      parseInt(result[2], 16),
      parseInt(result[3], 16)
    ] : [15, 35, 90]
  }

  const colors = {
    navy: hexToRgb(headerBg),
    blue: [41, 98, 255],
    lightBlue: hexToRgb(sectionsBg),
    skyBlue: [220, 235, 255],
    red: [220, 38, 38],
    white: [255, 255, 255],
    lightGray: [245, 248, 250],
    mediumGray: [156, 163, 175],
    darkGray: [31, 41, 55],
    border: [209, 213, 219]
  }

  const setColor = (color: number[], type: 'fill' | 'text' | 'draw' = 'fill') => {
    if (type === 'fill') pdf.setFillColor(color[0], color[1], color[2])
    else if (type === 'text') pdf.setTextColor(color[0], color[1], color[2])
    else if (type === 'draw') pdf.setDrawColor(color[0], color[1], color[2])
  }

  const drawStripedBackground = () => {
    setColor(colors.skyBlue, 'fill')
    pdf.rect(0, 0, pageWidth, 80, "F")
    
    pdf.setLineWidth(0.5)
    setColor([210, 230, 255], 'draw')
    for (let i = -80; i < pageWidth + 80; i += 8) {
      pdf.line(i, 0, i + 80, 80)
    }
  }

  const addContinuationHeader = () => {
    setColor(colors.navy, 'fill')
    pdf.rect(0, 0, pageWidth, 8, "F")
    
    pdf.setFontSize(9)
    setColor(colors.white, 'text')
    pdf.setFont("helvetica", "bold")
    pdf.text(meeting.title || "Meeting Agenda", margin, 5.5)
    
    yPosition = 16
  }

  const addNewPage = () => {
    pdf.addPage()
    currentPage++
    addContinuationHeader()
  }

  const checkPageBreak = (spaceNeeded: number) => {
    if (yPosition + spaceNeeded > pageHeight - 18) {
      addNewPage()
      return true
    }
    return false
  }

  const addPageFooter = () => {
    const footerY = pageHeight - 10
    
    setColor(hexToRgb(footerBg), 'fill')
    pdf.rect(0, footerY - 3, pageWidth, 15, "F")

    pdf.setFontSize(8)
    setColor(colors.white, 'text')
    pdf.setFont("helvetica", "normal")
    
    if (footerLayout === "centered") {
      let centerY = footerY + 1
      if (isFieldVisible(footerSection?.fields, "building_name")) {
        pdf.text(building?.name || "", pageWidth / 2, centerY, { align: "center" })
        centerY += 3
      }
      if (isFieldVisible(footerSection?.fields, "page_number")) {
        pdf.text(`Page ${currentPage}`, pageWidth / 2, centerY, { align: "center" })
        centerY += 3
      }
      if (isFieldVisible(footerSection?.fields, "branding")) {
        pdf.text("Meeting Genius", pageWidth / 2, centerY, { align: "center" })
      }
    } else if (footerLayout === "stacked") {
      let stackY = footerY + 1
      if (isFieldVisible(footerSection?.fields, "building_name")) {
        pdf.text(building?.name || "", margin, stackY)
        stackY += 3
      }
      if (isFieldVisible(footerSection?.fields, "page_number")) {
        pdf.text(`Page ${currentPage}`, margin, stackY)
        stackY += 3
      }
      if (isFieldVisible(footerSection?.fields, "branding")) {
        pdf.text("Meeting Genius", margin, stackY)
      }
    } else {
      if (isFieldVisible(footerSection?.fields, "building_name")) {
        pdf.text(building?.name || "", margin, footerY + 1)
      }
      if (isFieldVisible(footerSection?.fields, "page_number")) {
        pdf.text(`Page ${currentPage}`, pageWidth / 2, footerY + 1, { align: "center" })
      }
      if (isFieldVisible(footerSection?.fields, "branding")) {
        pdf.text("Meeting Genius", pageWidth - margin, footerY + 1, { align: "right" })
      }
    }
  }

  // ==================== COVER PAGE ====================
  
  drawStripedBackground()

  setColor(colors.navy, 'fill')
  pdf.rect(0, 0, pageWidth, 80, "F")

  if (logoDataUrl) {
    try {
      setColor(colors.white, 'fill')
      pdf.circle(margin + 12, 18, 10, "F")
      
      pdf.addImage(logoDataUrl, "PNG", margin + 2, 8, 20, 20, undefined, 'FAST')
    } catch (e) {
      console.error("Logo error:", e)
    }
  }

  pdf.setFontSize(42)
  setColor(colors.white, 'text')
  pdf.setFont("helvetica", "bold")
  pdf.text("MEETING", pageWidth / 2, 38, { align: "center" })
  pdf.text("AGENDA", pageWidth / 2, 52, { align: "center" })

  if (isFieldVisible(headerSection?.fields, "building_name")) {
    pdf.setFontSize(16)
    setColor(colors.lightBlue, 'text')
    pdf.setFont("helvetica", "normal")
    pdf.text(building?.name || "Building", pageWidth / 2, 64, { align: "center" })
  }

  if (isFieldVisible(headerSection?.fields, "meeting_type")) {
    pdf.setFontSize(11)
    setColor([200, 220, 255], 'text')
    pdf.text(meeting.meeting_type || "Council Meeting", pageWidth / 2, 72, { align: "center" })
  }

  yPosition = 92

  // ==================== INFO CARD ====================
  
  checkPageBreak(50)
  
  const cardWidth = pageWidth - 2 * margin

  if (headerLayout === "compact") {
    const compactHeight = 32
    
    setColor([180, 190, 200], 'fill')
    pdf.roundedRect(margin + 1, yPosition + 1, cardWidth, compactHeight, 5, 5, "F")
    
    setColor(colors.white, 'fill')
    pdf.roundedRect(margin, yPosition, cardWidth, compactHeight, 5, 5, "F")
    
    setColor(colors.blue, 'fill')
    pdf.roundedRect(margin, yPosition, cardWidth, 6, 5, 5, "F")
    pdf.rect(margin, yPosition + 4, cardWidth, 2, "F")
    
    pdf.setFontSize(9)
    setColor(colors.white, 'text')
    pdf.setFont("helvetica", "bold")
    pdf.text("MEETING INFORMATION", margin + 4, yPosition + 4)

    let compactY = yPosition + 12
    const col1X = margin + 4
    const col2X = margin + cardWidth/2 + 2

    const addCompactItem = (label: string, value: string, column: 1 | 2) => {
      const x = column === 1 ? col1X : col2X
      pdf.setFontSize(7)
      setColor(colors.navy, 'text')
      pdf.setFont("helvetica", "bold")
      pdf.text(label.toUpperCase(), x, compactY)
      pdf.setFontSize(8)
      setColor(colors.darkGray, 'text')
      pdf.setFont("helvetica", "normal")
      pdf.text(value, x, compactY + 3)
    }

    if (isFieldVisible(headerSection?.fields, "meeting_date")) {
      addCompactItem("Date", meetingDate, 1)
    }
    if (meeting.start_time && isFieldVisible(headerSection?.fields, "start_time")) {
      addCompactItem("Time", meeting.start_time, 2)
    }
    
    compactY += 7
    
    if (meeting.location && isFieldVisible(headerSection?.fields, "location")) {
      addCompactItem("Location", meeting.location, 1)
    }
    if (building?.address && isFieldVisible(headerSection?.fields, "address")) {
      addCompactItem("Address", building.address, 2)
    }

    yPosition += compactHeight + 8

  } else if (headerLayout === "horizontal") {
    const gridHeight = 42
    
    setColor([180, 190, 200], 'fill')
    pdf.roundedRect(margin + 1, yPosition + 1, cardWidth, gridHeight, 5, 5, "F")
    
    setColor(colors.white, 'fill')
    pdf.roundedRect(margin, yPosition, cardWidth, gridHeight, 5, 5, "F")
    
    setColor(colors.blue, 'fill')
    pdf.roundedRect(margin, yPosition, cardWidth, 8, 5, 5, "F")
    pdf.rect(margin, yPosition + 5, cardWidth, 3, "F")
    
    pdf.setFontSize(11)
    setColor(colors.white, 'text')
    pdf.setFont("helvetica", "bold")
    pdf.text("MEETING INFORMATION", margin + 6, yPosition + 5.5)

    let gridY = yPosition + 14
    const col1X = margin + 6
    const col2X = margin + cardWidth/2 + 3

    const addGridItem = (label: string, value: string, column: 1 | 2) => {
      const x = column === 1 ? col1X : col2X
      pdf.setFontSize(8)
      setColor(colors.navy, 'text')
      pdf.setFont("helvetica", "bold")
      pdf.text(label.toUpperCase(), x, gridY)
      pdf.setFontSize(9)
      setColor(colors.darkGray, 'text')
      pdf.setFont("helvetica", "normal")
      const lines = pdf.splitTextToSize(value, cardWidth/2 - 12)
      pdf.text(lines[0], x, gridY + 3.5)
    }

    if (isFieldVisible(headerSection?.fields, "meeting_date")) {
      addGridItem("Date", meetingDate, 1)
    }
    if (meeting.start_time && isFieldVisible(headerSection?.fields, "start_time")) {
      addGridItem("Time", meeting.start_time, 2)
    }
    
    gridY += 9
    
    if (meeting.location && isFieldVisible(headerSection?.fields, "location")) {
      addGridItem("Location", meeting.location, 1)
    }
    if (building?.address && isFieldVisible(headerSection?.fields, "address")) {
      addGridItem("Address", building.address, 2)
    }
    
    gridY += 9
    
    if (meeting.strata_plan_number && isFieldVisible(headerSection?.fields, "strata_plan")) {
      addGridItem("Strata Plan", meeting.strata_plan_number, 1)
    }

    yPosition += gridHeight + 8

  } else if (headerLayout === "centered") {
    const centeredHeight = 48
    
    setColor([180, 190, 200], 'fill')
    pdf.roundedRect(margin + 1, yPosition + 1, cardWidth, centeredHeight, 5, 5, "F")
    
    setColor(colors.white, 'fill')
    pdf.roundedRect(margin, yPosition, cardWidth, centeredHeight, 5, 5, "F")
    
    setColor(colors.blue, 'fill')
    pdf.roundedRect(margin, yPosition, cardWidth, 8, 5, 5, "F")
    pdf.rect(margin, yPosition + 5, cardWidth, 3, "F")
    
    pdf.setFontSize(11)
    setColor(colors.white, 'text')
    pdf.setFont("helvetica", "bold")
    pdf.text("MEETING INFORMATION", pageWidth / 2, yPosition + 5.5, { align: "center" })

    let centerY = yPosition + 16

    const addCenteredItem = (label: string, value: string) => {
      pdf.setFontSize(8)
      setColor(colors.navy, 'text')
      pdf.setFont("helvetica", "bold")
      pdf.text(label.toUpperCase(), pageWidth / 2, centerY, { align: "center" })
      pdf.setFontSize(9)
      setColor(colors.darkGray, 'text')
      pdf.setFont("helvetica", "normal")
      pdf.text(value, pageWidth / 2, centerY + 3.5, { align: "center" })
      centerY += 8
    }

    if (isFieldVisible(headerSection?.fields, "meeting_date")) {
      addCenteredItem("Date", meetingDate)
    }
    if (meeting.start_time && isFieldVisible(headerSection?.fields, "start_time")) {
      addCenteredItem("Time", meeting.start_time)
    }
    if (meeting.location && isFieldVisible(headerSection?.fields, "location")) {
      addCenteredItem("Location", meeting.location)
    }

    yPosition += centeredHeight + 8

  } else {
    // VERTICAL LAYOUT (DEFAULT)
    setColor([180, 190, 200], 'fill')
    pdf.roundedRect(margin + 1, yPosition + 1, cardWidth, 48, 5, 5, "F")
    
    setColor(colors.white, 'fill')
    pdf.roundedRect(margin, yPosition, cardWidth, 48, 5, 5, "F")
    
    setColor(colors.blue, 'fill')
    pdf.roundedRect(margin, yPosition, cardWidth, 8, 5, 5, "F")
    pdf.rect(margin, yPosition + 5, cardWidth, 3, "F")
    
    pdf.setFontSize(11)
    setColor(colors.white, 'text')
    pdf.setFont("helvetica", "bold")
    pdf.text("MEETING INFORMATION", margin + 6, yPosition + 5.5)

    let infoY = yPosition + 16
    const col1X = margin + 6
    const col2X = margin + cardWidth/2 + 3

    const addInfoItem = (label: string, value: string, column: 1 | 2) => {
      const x = column === 1 ? col1X : col2X
      
      pdf.setFontSize(9)
      setColor(colors.navy, 'text')
      pdf.setFont("helvetica", "bold")
      pdf.text(label.toUpperCase(), x, infoY)
      
      pdf.setFontSize(10)
      setColor(colors.darkGray, 'text')
      pdf.setFont("helvetica", "normal")
      const lines = pdf.splitTextToSize(value, cardWidth/2 - 12)
      pdf.text(lines[0], x, infoY + 4)
    }

    if (isFieldVisible(headerSection?.fields, "meeting_date")) {
      addInfoItem("Date", meetingDate, 1)
    }
    if (meeting.start_time && isFieldVisible(headerSection?.fields, "start_time")) {
      addInfoItem("Time", meeting.start_time, 2)
    }
    
    infoY += 10
    
    if (meeting.location && isFieldVisible(headerSection?.fields, "location")) {
      addInfoItem("Location", meeting.location, 1)
    }
    if (building?.address && isFieldVisible(headerSection?.fields, "address")) {
      addInfoItem("Address", building.address, 2)
    }
    
    infoY += 10
    
    if (meeting.strata_plan_number && isFieldVisible(headerSection?.fields, "strata_plan")) {
      addInfoItem("Strata Plan", meeting.strata_plan_number, 1)
    }

    yPosition += 56
  }

  // ==================== AGENDA ITEMS ====================
  
  checkPageBreak(25)
  
  setColor(colors.navy, 'fill')
  pdf.rect(margin - 5, yPosition - 3, pageWidth - 2 * margin + 10, 14, "F")
  
  pdf.setFontSize(20)
  setColor(colors.white, 'text')
  pdf.setFont("helvetica", "bold")
  pdf.text("AGENDA ITEMS", margin, yPosition + 6)
  
  yPosition += 18

  const topicsBySection = topics.reduce((acc, topic) => {
    const sectionId = topic.section_id || "unsectioned"
    if (!acc[sectionId]) acc[sectionId] = []
    acc[sectionId].push(topic)
    return acc
  }, {} as Record<string | number, Topic[]>)

  let sectionNum = 1

  const showSectionNumbers = isFieldVisible(sectionsSection?.fields, "section_numbers")
  const showTopicNumbers = isFieldVisible(sectionsSection?.fields, "topic_numbers")
  const showTopicDescriptions = isFieldVisible(sectionsSection?.fields, "topic_descriptions")
  const showIncameraIndicator = isFieldVisible(sectionsSection?.fields, "incamera_indicator")

  const renderTopicCard = (topic: Topic, topicNum: string, columnWidth?: number) => {
    const isIncamera = topic.is_incamera === true
    const hasDesc = !isIncamera && showTopicDescriptions && topic.description
    const cardHeight = hasDesc ? 22 : 13
    const effectiveWidth = columnWidth || (pageWidth - 2 * margin - 16)
    
    checkPageBreak(cardHeight + 4)

    setColor([210, 210, 210], 'fill')
    pdf.roundedRect(margin + 9, yPosition + 0.8, effectiveWidth, cardHeight, 3, 3, "F")
    
    setColor(isIncamera ? [255, 240, 240] : colors.white, 'fill')
    pdf.roundedRect(margin + 8, yPosition, effectiveWidth, cardHeight, 3, 3, "F")
    
    setColor(isIncamera ? colors.red : colors.blue, 'fill')
    pdf.rect(margin + 8, yPosition, 4, cardHeight, "F")

    if (showTopicNumbers) {
      setColor(isIncamera ? colors.red : colors.navy, 'fill')
      pdf.circle(margin + 18, yPosition + 5, 3, "F")
      
      pdf.setFontSize(8)
      setColor(colors.white, 'text')
      pdf.setFont("helvetica", "bold")
      pdf.text(topicNum, margin + 18, yPosition + 6.2, { align: "center" })
    }

    pdf.setFontSize(11)
    setColor(colors.darkGray, 'text')
    pdf.setFont("helvetica", "bold")
    
    let title = topic.title
    if (isIncamera && showIncameraIndicator) title += " [CONFIDENTIAL]"
    
    const titleX = showTopicNumbers ? margin + 24 : margin + 14
    const titleLines = pdf.splitTextToSize(title, effectiveWidth - 20)
    pdf.text(titleLines[0], titleX, yPosition + 6)

    if (isIncamera && showIncameraIndicator) {
      pdf.setFontSize(9)
      pdf.setFont("helvetica", "italic")
      setColor(colors.red, 'text')
      pdf.text("CONFIDENTIAL - In-Camera Session", titleX, yPosition + 11)
    } else if (hasDesc) {
      pdf.setFontSize(9)
      pdf.setFont("helvetica", "normal")
      setColor(colors.mediumGray, 'text')
      const descLines = pdf.splitTextToSize(topic.description!, effectiveWidth - 26)
      let descY = yPosition + 11
      descLines.slice(0, 3).forEach((line: string) => {
        pdf.text(line, titleX, descY)
        descY += 3.5
      })
      if (descLines.length > 3) {
        pdf.setFont("helvetica", "italic")
        pdf.text("(continued...)", titleX, descY)
      }
    }

    yPosition += cardHeight + 4
  }

  sections.forEach((section) => {
    const sectionTopics = topicsBySection[section.id] || []
    const sortedTopics = [...sectionTopics].sort((a, b) => (a.order_index || 0) - (b.order_index || 0))

    checkPageBreak(20)
    
    const sectionHeaderHeight = 10
    
    setColor(colors.lightBlue, 'fill')
    pdf.roundedRect(margin, yPosition, pageWidth - 2 * margin, sectionHeaderHeight, 3, 3, "F")
    
    if (showSectionNumbers) {
      setColor(colors.navy, 'fill')
      pdf.circle(margin + 5, yPosition + 5, 4, "F")
      
      pdf.setFontSize(10)
      setColor(colors.white, 'text')
      pdf.setFont("helvetica", "bold")
      pdf.text(sectionNum.toString(), margin + 5, yPosition + 6.5, { align: "center" })
    }
    
    pdf.setFontSize(13)
    setColor(colors.white, 'text')
    const sectionTextX = showSectionNumbers ? margin + 12 : margin + 6
    pdf.text(section.title.toUpperCase(), sectionTextX, yPosition + 6.5)
    
    yPosition += sectionHeaderHeight + 5

    if (sortedTopics.length > 0) {
      if (sectionsLayout === "compact") {
        sortedTopics.forEach((topic: Topic, idx: number) => {
          const isIncamera = topic.is_incamera === true
          const cardHeight = 10
          
          checkPageBreak(cardHeight + 2)

          setColor(isIncamera ? [255, 240, 240] : colors.lightGray, 'fill')
          pdf.roundedRect(margin + 8, yPosition, pageWidth - 2 * margin - 16, cardHeight, 2, 2, "F")
          
          setColor(isIncamera ? colors.red : colors.blue, 'fill')
          pdf.rect(margin + 8, yPosition, 3, cardHeight, "F")

          if (showTopicNumbers) {
            pdf.setFontSize(9)
            setColor(colors.navy, 'text')
            pdf.setFont("helvetica", "bold")
            pdf.text(`${sectionNum}.${idx + 1}`, margin + 14, yPosition + 6)
          }

          pdf.setFontSize(10)
          setColor(colors.darkGray, 'text')
          pdf.setFont("helvetica", "normal")
          
          let title = topic.title
          if (isIncamera && showIncameraIndicator) title += " [CONFIDENTIAL]"
          
          const titleX = showTopicNumbers ? margin + 28 : margin + 14
          const titleLines = pdf.splitTextToSize(title, pageWidth - 2 * margin - 50)
          pdf.text(titleLines[0], titleX, yPosition + 6)

          yPosition += cardHeight + 2
        })
      } else {
        sortedTopics.forEach((topic: Topic, idx: number) => {
          renderTopicCard(topic, `${sectionNum}.${idx + 1}`)
        })
      }
    } else {
      setColor(colors.lightGray, 'fill')
      pdf.roundedRect(margin + 8, yPosition, pageWidth - 2 * margin - 16, 10, 2, 2, "F")
      
      pdf.setFontSize(9)
      setColor(colors.mediumGray, 'text')
      pdf.setFont("helvetica", "italic")
      pdf.text("No items scheduled for this section", margin + 12, yPosition + 6)
      yPosition += 13
    }

    sectionNum++
    yPosition += 2
  })

  // Unsectioned topics
  const unsectionedTopics = topicsBySection["unsectioned"] || []
  if (unsectionedTopics.length > 0) {
    const sortedUnsectioned = [...unsectionedTopics].sort((a, b) => (a.order_index || 0) - (b.order_index || 0))
    
    checkPageBreak(20)
    
    setColor(colors.lightBlue, 'fill')
    pdf.roundedRect(margin, yPosition, pageWidth - 2 * margin, 10, 3, 3, "F")
    
    if (showSectionNumbers) {
      setColor(colors.navy, 'fill')
      pdf.circle(margin + 5, yPosition + 5, 4, "F")
      
      pdf.setFontSize(10)
      setColor(colors.white, 'text')
      pdf.setFont("helvetica", "bold")
      pdf.text(sectionNum.toString(), margin + 5, yPosition + 6.5, { align: "center" })
    }
    
    pdf.setFontSize(13)
    const sectionTextX = showSectionNumbers ? margin + 12 : margin + 6
    pdf.text("OTHER BUSINESS", sectionTextX, yPosition + 6.5)
    
    yPosition += 15

    if (sectionsLayout === "compact") {
      sortedUnsectioned.forEach((topic: Topic, idx: number) => {
        const isIncamera = topic.is_incamera === true
        const cardHeight = 10
        
        checkPageBreak(cardHeight + 2)

        setColor(isIncamera ? [255, 240, 240] : colors.lightGray, 'fill')
        pdf.roundedRect(margin + 8, yPosition, pageWidth - 2 * margin - 16, cardHeight, 2, 2, "F")
        
        setColor(isIncamera ? colors.red : colors.blue, 'fill')
        pdf.rect(margin + 8, yPosition, 3, cardHeight, "F")

        if (showTopicNumbers) {
          pdf.setFontSize(9)
          setColor(colors.navy, 'text')
          pdf.setFont("helvetica", "bold")
          pdf.text(`${sectionNum}.${idx + 1}`, margin + 14, yPosition + 6)
        }

        pdf.setFontSize(10)
        setColor(colors.darkGray, 'text')
        pdf.setFont("helvetica", "normal")
        
        let title = topic.title
        if (isIncamera && showIncameraIndicator) title += " [CONFIDENTIAL]"
        
        const titleX = showTopicNumbers ? margin + 28 : margin + 14
        const titleLines = pdf.splitTextToSize(title, pageWidth - 2 * margin - 50)
        pdf.text(titleLines[0], titleX, yPosition + 6)

        yPosition += cardHeight + 2
      })
    } else {
      sortedUnsectioned.forEach((topic: Topic, idx: number) => {
        renderTopicCard(topic, `${sectionNum}.${idx + 1}`)
      })
    }
  }

  // Add footers to all pages
  const totalPages = (pdf as any).internal.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i)
    currentPage = i
    addPageFooter()
  }

  const fileName = `${meeting.title || "Meeting"}_Agenda_${new Date().toISOString().split("T")[0]}.pdf`
  pdf.save(fileName)
}
