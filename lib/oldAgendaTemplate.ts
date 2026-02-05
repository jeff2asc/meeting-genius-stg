import { CanvasElement } from "./canvasUtils"

// This is the DEFAULT template - matches the old hardcoded PDF exactly
export const OLD_AGENDA_DEFAULT_TEMPLATE: CanvasElement[] = [
  // ==================== COVER PAGE ====================
  
  // Navy background
  {
    id: "cover-bg",
    type: "shape",
    position: { x: 0, y: 0 },
    size: { width: 210, height: 80 },
    content: null,
    style: {
      backgroundColor: "#0f235a",
      borderRadius: 0
    },
    locked: true // Background is locked
  },

  // Logo white circle background
  {
    id: "logo-circle-bg",
    type: "shape",
    position: { x: 18, y: 8 },
    size: { width: 20, height: 20 },
    content: null,
    style: {
      backgroundColor: "#ffffff",
      borderRadius: "50%"
    }
  },

  // Company Logo (dynamic)
  {
    id: "company-logo",
    type: "dynamic",
    position: { x: 20, y: 10 },
    size: { width: 16, height: 16 },
    content: { type: "company_logo" },
    style: {
      backgroundColor: "transparent"
    }
  },

  // "MEETING" text
  {
    id: "meeting-text",
    type: "text",
    position: { x: 0, y: 28 },
    size: { width: 210, height: 15 },
    content: "MEETING",
    style: {
      fontSize: 42,
      fontWeight: "bold",
      color: "#ffffff",
      textAlign: "center",
      backgroundColor: "transparent"
    }
  },

  // "AGENDA" text
  {
    id: "agenda-text",
    type: "text",
    position: { x: 0, y: 42 },
    size: { width: 210, height: 15 },
    content: "AGENDA",
    style: {
      fontSize: 42,
      fontWeight: "bold",
      color: "#ffffff",
      textAlign: "center",
      backgroundColor: "transparent"
    }
  },

  // Building Name (dynamic)
  {
    id: "building-name",
    type: "dynamic",
    position: { x: 0, y: 58 },
    size: { width: 210, height: 8 },
    content: { type: "building_name" },
    style: {
      fontSize: 16,
      fontWeight: "normal",
      color: "#648cff",
      textAlign: "center",
      backgroundColor: "transparent"
    }
  },

  // Meeting Type (dynamic)
  {
    id: "meeting-type",
    type: "dynamic",
    position: { x: 0, y: 66 },
    size: { width: 210, height: 6 },
    content: { type: "meeting_type" },
    style: {
      fontSize: 11,
      fontWeight: "normal",
      color: "#c8dcff",
      textAlign: "center",
      backgroundColor: "transparent"
    }
  },

  // ==================== MEETING INFO CARD ====================

  // Card shadow
  {
    id: "info-card-shadow",
    type: "shape",
    position: { x: 19, y: 93 },
    size: { width: 174, height: 48 },
    content: null,
    style: {
      backgroundColor: "#b4bec8",
      borderRadius: 5
    },
    locked: true
  },

  // Card white background
  {
    id: "info-card-bg",
    type: "shape",
    position: { x: 18, y: 92 },
    size: { width: 174, height: 48 },
    content: null,
    style: {
      backgroundColor: "#ffffff",
      borderRadius: 5
    },
    locked: true
  },

  // Card blue header
  {
    id: "info-header-bg",
    type: "shape",
    position: { x: 18, y: 92 },
    size: { width: 174, height: 8 },
    content: null,
    style: {
      backgroundColor: "#2962ff",
      borderRadius: 5
    }
  },

  // "MEETING INFORMATION" text
  {
    id: "info-header-text",
    type: "text",
    position: { x: 24, y: 95 },
    size: { width: 100, height: 6 },
    content: "MEETING INFORMATION",
    style: {
      fontSize: 11,
      fontWeight: "bold",
      color: "#ffffff",
      textAlign: "left",
      backgroundColor: "transparent"
    }
  },

  // Date Label
  {
    id: "date-label",
    type: "text",
    position: { x: 24, y: 108 },
    size: { width: 80, height: 4 },
    content: "DATE",
    style: {
      fontSize: 9,
      fontWeight: "bold",
      color: "#0f235a",
      textAlign: "left",
      backgroundColor: "transparent"
    }
  },

  // Date Value (dynamic)
  {
    id: "date-value",
    type: "dynamic",
    position: { x: 24, y: 112 },
    size: { width: 80, height: 6 },
    content: { type: "meeting_date" },
    style: {
      fontSize: 10,
      fontWeight: "normal",
      color: "#1f2937",
      textAlign: "left",
      backgroundColor: "transparent"
    }
  },

  // Time Label
  {
    id: "time-label",
    type: "text",
    position: { x: 111, y: 108 },
    size: { width: 80, height: 4 },
    content: "TIME",
    style: {
      fontSize: 9,
      fontWeight: "bold",
      color: "#0f235a",
      textAlign: "left",
      backgroundColor: "transparent"
    }
  },

  // Time Value (dynamic)
  {
    id: "time-value",
    type: "dynamic",
    position: { x: 111, y: 112 },
    size: { width: 80, height: 6 },
    content: { type: "start_time" },
    style: {
      fontSize: 10,
      fontWeight: "normal",
      color: "#1f2937",
      textAlign: "left",
      backgroundColor: "transparent"
    }
  },

  // Location Label
  {
    id: "location-label",
    type: "text",
    position: { x: 24, y: 122 },
    size: { width: 80, height: 4 },
    content: "LOCATION",
    style: {
      fontSize: 9,
      fontWeight: "bold",
      color: "#0f235a",
      textAlign: "left",
      backgroundColor: "transparent"
    }
  },

  // Location Value (dynamic)
  {
    id: "location-value",
    type: "dynamic",
    position: { x: 24, y: 126 },
    size: { width: 80, height: 6 },
    content: { type: "location" },
    style: {
      fontSize: 10,
      fontWeight: "normal",
      color: "#1f2937",
      textAlign: "left",
      backgroundColor: "transparent"
    }
  },

  // Address Label
  {
    id: "address-label",
    type: "text",
    position: { x: 111, y: 122 },
    size: { width: 80, height: 4 },
    content: "ADDRESS",
    style: {
      fontSize: 9,
      fontWeight: "bold",
      color: "#0f235a",
      textAlign: "left",
      backgroundColor: "transparent"
    }
  },

  // Address Value (dynamic)
  {
    id: "address-value",
    type: "dynamic",
    position: { x: 111, y: 126 },
    size: { width: 80, height: 6 },
    content: { type: "address" },
    style: {
      fontSize: 10,
      fontWeight: "normal",
      color: "#1f2937",
      textAlign: "left",
      backgroundColor: "transparent"
    }
  },

  // Strata Plan Label
  {
    id: "strata-label",
    type: "text",
    position: { x: 24, y: 136 },
    size: { width: 80, height: 4 },
    content: "STRATA PLAN",
    style: {
      fontSize: 9,
      fontWeight: "bold",
      color: "#0f235a",
      textAlign: "left",
      backgroundColor: "transparent"
    }
  },

  // Strata Plan Value (dynamic)
  {
    id: "strata-value",
    type: "dynamic",
    position: { x: 24, y: 140 },
    size: { width: 80, height: 6 },
    content: { type: "strata_plan" },
    style: {
      fontSize: 10,
      fontWeight: "normal",
      color: "#1f2937",
      textAlign: "left",
      backgroundColor: "transparent"
    }
  },

  // ==================== AGENDA ITEMS SECTION ====================
  // (LOCKED FOR MVP - users can't move these)

  // Agenda Items Header Background
  {
    id: "agenda-header-bg",
    type: "shape",
    position: { x: 13, y: 145 },
    size: { width: 184, height: 14 },
    content: null,
    style: {
      backgroundColor: "#0f235a",
      borderRadius: 0
    },
    locked: true
  },

  // "AGENDA ITEMS" text
  {
    id: "agenda-items-text",
    type: "text",
    position: { x: 18, y: 149 },
    size: { width: 100, height: 10 },
    content: "AGENDA ITEMS",
    style: {
      fontSize: 20,
      fontWeight: "bold",
      color: "#ffffff",
      textAlign: "left",
      backgroundColor: "transparent"
    },
    locked: true
  },

  // Topics List (dynamic - contains all sections/topics)
  {
    id: "topics-list",
    type: "dynamic",
    position: { x: 18, y: 163 },
    size: { width: 174, height: 120 },
    content: { type: "topics_list" },
    style: {
      fontSize: 11,
      fontWeight: "normal",
      color: "#1f2937",
      textAlign: "left",
      backgroundColor: "transparent"
    },
    locked: true // Locked for MVP
  }
]
