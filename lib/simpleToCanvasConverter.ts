import { CanvasElement } from "./canvasUtils"


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


interface SimpleTemplate {
  sections: TemplateSection[]
}


// Convert Simple Mode template to Canvas elements
export function convertSimpleTemplateToCanvas(simpleTemplate: SimpleTemplate): CanvasElement[] {
  const elements: CanvasElement[] = []
  let currentY = 0


  const headerSection = simpleTemplate.sections.find(s => s.id === "header")
  const sectionsSection = simpleTemplate.sections.find(s => s.id === "sections")
  const footerSection = simpleTemplate.sections.find(s => s.id === "footer")


  // ==========================================
  // HEADER SECTION
  // ==========================================
  if (headerSection) {
    const headerLayout = headerSection.layoutStyle || "vertical"
    const headerBg = headerSection.backgroundColor || "#0f235a"
    const visibleFields = headerSection.fields.filter(f => f.visible)


    if (headerLayout === "vertical") {
      // Vertical layout - Navy background with logo and stacked info
      
      // Header background
      elements.push({
        id: "header-bg",
        type: "shape",
        position: { x: 0, y: 0 },
        size: { width: 210, height: 80 },
        style: { backgroundColor: headerBg, borderRadius: 0 },
        zIndex: 0
      })


      // Logo placeholder (white circle)
      elements.push({
        id: "logo-circle",
        type: "shape",
        position: { x: 6, y: 8 },
        size: { width: 24, height: 24 },
        style: { backgroundColor: "#ffffff", borderRadius: 12 },
        zIndex: 1
      })


      // ⭐ UPDATED: Logo image changed to dynamic type
      elements.push({
        id: "logo",
        type: "dynamic",
        position: { x: 8, y: 10 },
        size: { width: 20, height: 20 },
        style: { backgroundColor: "transparent", borderRadius: 10 },
        content: { type: "company_logo" },
        zIndex: 2
      })


      // MEETING AGENDA title
      elements.push({
        id: "title-meeting",
        type: "text",
        position: { x: 40, y: 30 },
        size: { width: 130, height: 12 },
        style: {
          fontSize: 42,
          fontFamily: "helvetica",
          fontWeight: "bold",
          color: "#ffffff",
          textAlign: "center",
          backgroundColor: "transparent"
        },
        content: "MEETING",
        zIndex: 1
      })


      elements.push({
        id: "title-agenda",
        type: "text",
        position: { x: 40, y: 44 },
        size: { width: 130, height: 12 },
        style: {
          fontSize: 42,
          fontFamily: "helvetica",
          fontWeight: "bold",
          color: "#ffffff",
          textAlign: "center",
          backgroundColor: "transparent"
        },
        content: "AGENDA",
        zIndex: 1
      })


      // Building name (if visible)
      if (visibleFields.find(f => f.id === "building_name")) {
        elements.push({
          id: "building-name",
          type: "dynamic",
          position: { x: 40, y: 64 },
          size: { width: 130, height: 6 },
          style: {
            fontSize: 16,
            fontFamily: "helvetica",
            fontWeight: "normal",
            color: "#648cff",
            textAlign: "center",
            backgroundColor: "transparent"
          },
          content: { type: "building_name" },
          zIndex: 1
        })
      }


      // Meeting type (if visible)
      if (visibleFields.find(f => f.id === "meeting_type")) {
        elements.push({
          id: "meeting-type",
          type: "dynamic",
          position: { x: 40, y: 72 },
          size: { width: 130, height: 5 },
          style: {
            fontSize: 11,
            fontFamily: "helvetica",
            fontWeight: "normal",
            color: "#c8dcff",
            textAlign: "center",
            backgroundColor: "transparent"
          },
          content: { type: "meeting_title" },
          zIndex: 1
        })
      }


      currentY = 92


      // Info Card
      const cardWidth = 174
      const cardHeight = 48


      // Card shadow
      elements.push({
        id: "info-card-shadow",
        type: "shape",
        position: { x: 19, y: currentY + 1 },
        size: { width: cardWidth, height: cardHeight },
        style: { backgroundColor: "#b4bec8", borderRadius: 5 },
        zIndex: 0
      })


      // Card background
      elements.push({
        id: "info-card-bg",
        type: "shape",
        position: { x: 18, y: currentY },
        size: { width: cardWidth, height: cardHeight },
        style: { backgroundColor: "#ffffff", borderRadius: 5 },
        zIndex: 1
      })


      // Card header bar
      elements.push({
        id: "info-card-header",
        type: "shape",
        position: { x: 18, y: currentY },
        size: { width: cardWidth, height: 8 },
        style: { backgroundColor: "#2962ff", borderRadius: 5 },
        zIndex: 2
      })


      elements.push({
        id: "info-card-header-ext",
        type: "shape",
        position: { x: 18, y: currentY + 4 },
        size: { width: cardWidth, height: 4 },
        style: { backgroundColor: "#2962ff", borderRadius: 0 },
        zIndex: 2
      })


      // MEETING INFORMATION text
      elements.push({
        id: "info-card-title",
        type: "text",
        position: { x: 24, y: currentY + 5 },
        size: { width: 100, height: 4 },
        style: {
          fontSize: 11,
          fontFamily: "helvetica",
          fontWeight: "bold",
          color: "#ffffff",
          textAlign: "left",
          backgroundColor: "transparent"
        },
        content: "MEETING INFORMATION",
        zIndex: 3
      })


      let infoY = currentY + 14
      const col1X = 24
      const col2X = 110


      // Meeting Date
      if (visibleFields.find(f => f.id === "meeting_date")) {
        elements.push({
          id: "date-label",
          type: "text",
          position: { x: col1X, y: infoY },
          size: { width: 40, height: 4 },
          style: {
            fontSize: 8,
            fontFamily: "helvetica",
            fontWeight: "bold",
            color: "#0f235a",
            textAlign: "left",
            backgroundColor: "transparent"
          },
          content: "DATE",
          zIndex: 3
        })


        elements.push({
          id: "meeting-date",
          type: "dynamic",
          position: { x: col1X, y: infoY + 4 },
          size: { width: 80, height: 4 },
          style: {
            fontSize: 9,
            fontFamily: "helvetica",
            fontWeight: "normal",
            color: "#1f2937",
            textAlign: "left",
            backgroundColor: "transparent"
          },
          content: { type: "meeting_date" },
          zIndex: 3
        })
      }


      // Start Time
      if (visibleFields.find(f => f.id === "start_time")) {
        elements.push({
          id: "time-label",
          type: "text",
          position: { x: col2X, y: infoY },
          size: { width: 40, height: 4 },
          style: {
            fontSize: 8,
            fontFamily: "helvetica",
            fontWeight: "bold",
            color: "#0f235a",
            textAlign: "left",
            backgroundColor: "transparent"
          },
          content: "TIME",
          zIndex: 3
        })


        elements.push({
          id: "meeting-time",
          type: "dynamic",
          position: { x: col2X, y: infoY + 4 },
          size: { width: 80, height: 4 },
          style: {
            fontSize: 9,
            fontFamily: "helvetica",
            fontWeight: "normal",
            color: "#1f2937",
            textAlign: "left",
            backgroundColor: "transparent"
          },
          content: { type: "meeting_time" },
          zIndex: 3
        })
      }


      infoY += 11


      // Location
      if (visibleFields.find(f => f.id === "location")) {
        elements.push({
          id: "location-label",
          type: "text",
          position: { x: col1X, y: infoY },
          size: { width: 40, height: 4 },
          style: {
            fontSize: 8,
            fontFamily: "helvetica",
            fontWeight: "bold",
            color: "#0f235a",
            textAlign: "left",
            backgroundColor: "transparent"
          },
          content: "LOCATION",
          zIndex: 3
        })


        elements.push({
          id: "meeting-location",
          type: "dynamic",
          position: { x: col1X, y: infoY + 4 },
          size: { width: 80, height: 4 },
          style: {
            fontSize: 9,
            fontFamily: "helvetica",
            fontWeight: "normal",
            color: "#1f2937",
            textAlign: "left",
            backgroundColor: "transparent"
          },
          content: { type: "meeting_location" },
          zIndex: 3
        })
      }


      // Address
      if (visibleFields.find(f => f.id === "address")) {
        elements.push({
          id: "address-label",
          type: "text",
          position: { x: col2X, y: infoY },
          size: { width: 40, height: 4 },
          style: {
            fontSize: 8,
            fontFamily: "helvetica",
            fontWeight: "bold",
            color: "#0f235a",
            textAlign: "left",
            backgroundColor: "transparent"
          },
          content: "ADDRESS",
          zIndex: 3
        })


        elements.push({
          id: "building-address",
          type: "text",
          position: { x: col2X, y: infoY + 4 },
          size: { width: 80, height: 4 },
          style: {
            fontSize: 9,
            fontFamily: "helvetica",
            fontWeight: "normal",
            color: "#1f2937",
            textAlign: "left",
            backgroundColor: "transparent"
          },
          content: "[Building Address]",
          zIndex: 3
        })
      }


      infoY += 11


      // Strata Plan
      if (visibleFields.find(f => f.id === "strata_plan")) {
        elements.push({
          id: "strata-label",
          type: "text",
          position: { x: col1X, y: infoY },
          size: { width: 40, height: 4 },
          style: {
            fontSize: 8,
            fontFamily: "helvetica",
            fontWeight: "bold",
            color: "#0f235a",
            textAlign: "left",
            backgroundColor: "transparent"
          },
          content: "STRATA PLAN",
          zIndex: 3
        })


        elements.push({
          id: "strata-plan",
          type: "text",
          position: { x: col1X, y: infoY + 4 },
          size: { width: 80, height: 4 },
          style: {
            fontSize: 9,
            fontFamily: "helvetica",
            fontWeight: "normal",
            color: "#1f2937",
            textAlign: "left",
            backgroundColor: "transparent"
          },
          content: "[Strata Plan #]",
          zIndex: 3
        })
      }


      currentY += cardHeight + 10


    } else if (headerLayout === "horizontal") {
      // Horizontal layout
      elements.push({
        id: "header-bg-horizontal",
        type: "shape",
        position: { x: 0, y: 0 },
        size: { width: 210, height: 60 },
        style: { backgroundColor: headerBg, borderRadius: 0 },
        zIndex: 0
      })


      elements.push({
        id: "title-horizontal",
        type: "text",
        position: { x: 10, y: 20 },
        size: { width: 190, height: 20 },
        style: {
          fontSize: 32,
          fontFamily: "helvetica",
          fontWeight: "bold",
          color: "#ffffff",
          textAlign: "center",
          backgroundColor: "transparent"
        },
        content: "MEETING AGENDA",
        zIndex: 1
      })


      currentY = 70


    } else if (headerLayout === "centered") {
      // Centered layout
      elements.push({
        id: "header-bg-centered",
        type: "shape",
        position: { x: 0, y: 0 },
        size: { width: 210, height: 65 },
        style: { backgroundColor: headerBg, borderRadius: 0 },
        zIndex: 0
      })


      elements.push({
        id: "title-centered",
        type: "text",
        position: { x: 20, y: 25 },
        size: { width: 170, height: 15 },
        style: {
          fontSize: 36,
          fontFamily: "helvetica",
          fontWeight: "bold",
          color: "#ffffff",
          textAlign: "center",
          backgroundColor: "transparent"
        },
        content: "MEETING AGENDA",
        zIndex: 1
      })


      currentY = 75


    } else if (headerLayout === "compact") {
      // Compact layout
      elements.push({
        id: "header-bg-compact",
        type: "shape",
        position: { x: 0, y: 0 },
        size: { width: 210, height: 35 },
        style: { backgroundColor: headerBg, borderRadius: 0 },
        zIndex: 0
      })


      elements.push({
        id: "title-compact",
        type: "text",
        position: { x: 10, y: 12 },
        size: { width: 190, height: 12 },
        style: {
          fontSize: 24,
          fontFamily: "helvetica",
          fontWeight: "bold",
          color: "#ffffff",
          textAlign: "center",
          backgroundColor: "transparent"
        },
        content: "MEETING AGENDA",
        zIndex: 1
      })


      currentY = 45
    }
  }


  // ==========================================
  // AGENDA ITEMS HEADER
  // ==========================================
  const agendaHeaderBg = headerSection?.backgroundColor || "#0f235a"
  
  elements.push({
    id: "agenda-items-header",
    type: "shape",
    position: { x: 18, y: currentY },
    size: { width: 174, height: 12 },
    style: { backgroundColor: agendaHeaderBg, borderRadius: 0 },
    zIndex: 1
  })


  elements.push({
    id: "agenda-items-title",
    type: "text",
    position: { x: 24, y: currentY + 4 },
    size: { width: 100, height: 6 },
    style: {
      fontSize: 14,
      fontFamily: "helvetica",
      fontWeight: "bold",
      color: "#ffffff",
      textAlign: "left",
      backgroundColor: "transparent"
    },
    content: "AGENDA ITEMS",
    zIndex: 2
  })


  currentY += 18


  // ==========================================
  // SAMPLE SECTION HEADER
  // ==========================================
  const sectionBg = sectionsSection?.backgroundColor || "#648cff"


  elements.push({
    id: "section-header-bg",
    type: "shape",
    position: { x: 18, y: currentY },
    size: { width: 174, height: 10 },
    style: { backgroundColor: sectionBg, borderRadius: 3 },
    zIndex: 1
  })


  // Section number circle
  elements.push({
    id: "section-number-circle",
    type: "shape",
    position: { x: 22, y: currentY + 2 },
    size: { width: 6, height: 6 },
    style: { backgroundColor: "#0f235a", borderRadius: 3 },
    zIndex: 2
  })


  elements.push({
    id: "section-number",
    type: "text",
    position: { x: 22, y: currentY + 3 },
    size: { width: 6, height: 4 },
    style: {
      fontSize: 10,
      fontFamily: "helvetica",
      fontWeight: "bold",
      color: "#ffffff",
      textAlign: "center",
      backgroundColor: "transparent"
    },
    content: "1",
    zIndex: 3
  })


  elements.push({
    id: "section-title",
    type: "text",
    position: { x: 32, y: currentY + 3 },
    size: { width: 150, height: 5 },
    style: {
      fontSize: 12,
      fontFamily: "helvetica",
      fontWeight: "bold",
      color: "#ffffff",
      textAlign: "left",
      backgroundColor: "transparent"
    },
    content: "CALL TO ORDER",
    zIndex: 2
  })


  currentY += 14


  // ==========================================
  // SAMPLE TOPIC CARD
  // ==========================================
  const topicCardHeight = 18


  // Topic card background
  elements.push({
    id: "topic-card-bg",
    type: "shape",
    position: { x: 18, y: currentY },
    size: { width: 174, height: topicCardHeight },
    style: { backgroundColor: "#ffffff", borderRadius: 2 },
    zIndex: 1
  })


  // Blue left border
  elements.push({
    id: "topic-left-border",
    type: "shape",
    position: { x: 18, y: currentY },
    size: { width: 1.5, height: topicCardHeight },
    style: { backgroundColor: sectionBg, borderRadius: 0 },
    zIndex: 2
  })


  // Topic number circle
  elements.push({
    id: "topic-number-circle",
    type: "shape",
    position: { x: 24, y: currentY + 3 },
    size: { width: 5, height: 5 },
    style: { backgroundColor: "#0f235a", borderRadius: 2.5 },
    zIndex: 2
  })


  elements.push({
    id: "topic-number",
    type: "text",
    position: { x: 24, y: currentY + 3.5 },
    size: { width: 5, height: 4 },
    style: {
      fontSize: 8,
      fontFamily: "helvetica",
      fontWeight: "bold",
      color: "#ffffff",
      textAlign: "center",
      backgroundColor: "transparent"
    },
    content: "1.1",
    zIndex: 3
  })


  // Topic title
  elements.push({
    id: "topic-title",
    type: "text",
    position: { x: 32, y: currentY + 3 },
    size: { width: 155, height: 5 },
    style: {
      fontSize: 11,
      fontFamily: "helvetica",
      fontWeight: "bold",
      color: "#1e293b",
      textAlign: "left",
      backgroundColor: "transparent"
    },
    content: "Sample Topic Title",
    zIndex: 2
  })


  // Topic description (if visible)
  if (sectionsSection?.fields.find(f => f.id === "topic_descriptions" && f.visible)) {
    elements.push({
      id: "topic-description",
      type: "text",
      position: { x: 32, y: currentY + 9 },
      size: { width: 155, height: 8 },
      style: {
        fontSize: 9,
        fontFamily: "helvetica",
        fontWeight: "normal",
        color: "#64748b",
        textAlign: "left",
        backgroundColor: "transparent"
      },
      content: "This is a sample topic description that provides additional details about the agenda item.",
      zIndex: 2
    })
  }


  currentY += topicCardHeight + 6


  // ==========================================
  // ANOTHER SAMPLE TOPIC (Optional)
  // ==========================================
  elements.push({
    id: "topic-card-bg-2",
    type: "shape",
    position: { x: 18, y: currentY },
    size: { width: 174, height: topicCardHeight },
    style: { backgroundColor: "#ffffff", borderRadius: 2 },
    zIndex: 1
  })


  elements.push({
    id: "topic-left-border-2",
    type: "shape",
    position: { x: 18, y: currentY },
    size: { width: 1.5, height: topicCardHeight },
    style: { backgroundColor: sectionBg, borderRadius: 0 },
    zIndex: 2
  })


  elements.push({
    id: "topic-number-circle-2",
    type: "shape",
    position: { x: 24, y: currentY + 3 },
    size: { width: 5, height: 5 },
    style: { backgroundColor: "#0f235a", borderRadius: 2.5 },
    zIndex: 2
  })


  elements.push({
    id: "topic-number-2",
    type: "text",
    position: { x: 24, y: currentY + 3.5 },
    size: { width: 5, height: 4 },
    style: {
      fontSize: 8,
      fontFamily: "helvetica",
      fontWeight: "bold",
      color: "#ffffff",
      textAlign: "center",
      backgroundColor: "transparent"
    },
    content: "1.2",
    zIndex: 3
  })


  elements.push({
    id: "topic-title-2",
    type: "text",
    position: { x: 32, y: currentY + 3 },
    size: { width: 155, height: 5 },
    style: {
      fontSize: 11,
      fontFamily: "helvetica",
      fontWeight: "bold",
      color: "#1e293b",
      textAlign: "left",
      backgroundColor: "transparent"
    },
    content: "Another Topic",
    zIndex: 2
  })


  if (sectionsSection?.fields.find(f => f.id === "topic_descriptions" && f.visible)) {
    elements.push({
      id: "topic-description-2",
      type: "text",
      position: { x: 32, y: currentY + 9 },
      size: { width: 155, height: 8 },
      style: {
        fontSize: 9,
        fontFamily: "helvetica",
        fontWeight: "normal",
        color: "#64748b",
        textAlign: "left",
        backgroundColor: "transparent"
      },
      content: "Additional topic for demonstration purposes.",
      zIndex: 2
    })
  }


  currentY += topicCardHeight + 10


  // ==========================================
  // FOOTER SECTION
  // ==========================================
  const footerBg = footerSection?.backgroundColor || "#0f235a"
  const footerY = 277 // Fixed position at bottom of page


  // Footer background
  elements.push({
    id: "footer-bg",
    type: "shape",
    position: { x: 0, y: footerY },
    size: { width: 210, height: 10 },
    style: { backgroundColor: footerBg, borderRadius: 0 },
    zIndex: 0
  })


  // Building name (left)
  if (footerSection?.fields.find(f => f.id === "building_name" && f.visible)) {
    elements.push({
      id: "footer-building-name",
      type: "dynamic",
      position: { x: 8, y: footerY + 4 },
      size: { width: 60, height: 4 },
      style: {
        fontSize: 8,
        fontFamily: "helvetica",
        fontWeight: "normal",
        color: "#ffffff",
        textAlign: "left",
        backgroundColor: "transparent"
      },
      content: { type: "building_name" },
      zIndex: 1
    })
  }


  // Page number (center)
  if (footerSection?.fields.find(f => f.id === "page_number" && f.visible)) {
    elements.push({
      id: "footer-page-number",
      type: "text",
      position: { x: 85, y: footerY + 4 },
      size: { width: 40, height: 4 },
      style: {
        fontSize: 8,
        fontFamily: "helvetica",
        fontWeight: "normal",
        color: "#ffffff",
        textAlign: "center",
        backgroundColor: "transparent"
      },
      content: "Page 1",
      zIndex: 1
    })
  }


  // Meeting Genius branding (right)
  if (footerSection?.fields.find(f => f.id === "branding" && f.visible)) {
    elements.push({
      id: "footer-branding",
      type: "text",
      position: { x: 142, y: footerY + 4 },
      size: { width: 60, height: 4 },
      style: {
        fontSize: 8,
        fontFamily: "helvetica",
        fontWeight: "normal",
        color: "#ffffff",
        textAlign: "right",
        backgroundColor: "transparent"
      },
      content: "Meeting Genius",
      zIndex: 1
    })
  }


  return elements
}
