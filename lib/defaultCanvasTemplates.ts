import { CanvasElement } from "./canvasUtils"


// ==========================================
// DEFAULT CANVAS TEMPLATES
// ==========================================


// Professional Meeting Agenda Template
export const PROFESSIONAL_TEMPLATE: CanvasElement[] = [
  // Header Background
  {
    id: "header-bg",
    type: "shape",
    position: { x: 0, y: 0 },
    size: { width: 210, height: 35 },
    style: {
      backgroundColor: "#0f235a",
      borderRadius: 0
    },
    zIndex: 0
  },


  // Building Logo Placeholder Circle
  {
    id: "logo-placeholder",
    type: "shape",
    position: { x: 15, y: 8 },
    size: { width: 20, height: 20 },
    style: {
      backgroundColor: "#ffffff",
      borderRadius: 10
    },
    zIndex: 1
  },


  // ⭐ UPDATED: Company Logo (Dynamic)
  {
    id: "logo",
    type: "dynamic",
    position: { x: 15, y: 8 },
    size: { width: 20, height: 20 },
    style: {
      backgroundColor: "transparent",
      borderRadius: 10
    },
    content: { type: "company_logo" },
    zIndex: 2
  },


  // Title - MEETING AGENDA
  {
    id: "main-title",
    type: "text",
    position: { x: 40, y: 10 },
    size: { width: 130, height: 10 },
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
  },


  // Building Name (Dynamic)
  {
    id: "building-name",
    type: "dynamic",
    position: { x: 40, y: 22 },
    size: { width: 130, height: 8 },
    style: {
      fontSize: 14,
      fontFamily: "helvetica",
      fontWeight: "normal",
      color: "#ffffff",
      textAlign: "center",
      backgroundColor: "transparent"
    },
    content: { type: "building_name" },
    zIndex: 1
  },


  // Info Card Background
  {
    id: "info-card-bg",
    type: "container",
    position: { x: 15, y: 42 },
    size: { width: 180, height: 45 },
    style: {
      backgroundColor: "#ffffff",
      borderWidth: 1,
      borderColor: "#e5e7eb",
      borderRadius: 8,
      padding: 10
    },
    zIndex: 0
  },


  // Meeting Date Label
  {
    id: "date-label",
    type: "text",
    position: { x: 20, y: 48 },
    size: { width: 80, height: 5 },
    style: {
      fontSize: 9,
      fontFamily: "helvetica",
      fontWeight: "bold",
      color: "#6b7280",
      textAlign: "left",
      backgroundColor: "transparent"
    },
    content: "MEETING DATE",
    zIndex: 1
  },


  // Meeting Date (Dynamic)
  {
    id: "meeting-date",
    type: "dynamic",
    position: { x: 20, y: 53 },
    size: { width: 80, height: 6 },
    style: {
      fontSize: 11,
      fontFamily: "helvetica",
      fontWeight: "normal",
      color: "#1f2937",
      textAlign: "left",
      backgroundColor: "transparent"
    },
    content: { type: "meeting_date" },
    zIndex: 1
  },


  // Meeting Time Label
  {
    id: "time-label",
    type: "text",
    position: { x: 110, y: 48 },
    size: { width: 80, height: 5 },
    style: {
      fontSize: 9,
      fontFamily: "helvetica",
      fontWeight: "bold",
      color: "#6b7280",
      textAlign: "left",
      backgroundColor: "transparent"
    },
    content: "TIME",
    zIndex: 1
  },


  // Meeting Time (Dynamic)
  {
    id: "meeting-time",
    type: "dynamic",
    position: { x: 110, y: 53 },
    size: { width: 80, height: 6 },
    style: {
      fontSize: 11,
      fontFamily: "helvetica",
      fontWeight: "normal",
      color: "#1f2937",
      textAlign: "left",
      backgroundColor: "transparent"
    },
    content: { type: "meeting_time" },
    zIndex: 1
  },


  // Location Label
  {
    id: "location-label",
    type: "text",
    position: { x: 20, y: 63 },
    size: { width: 80, height: 5 },
    style: {
      fontSize: 9,
      fontFamily: "helvetica",
      fontWeight: "bold",
      color: "#6b7280",
      textAlign: "left",
      backgroundColor: "transparent"
    },
    content: "LOCATION",
    zIndex: 1
  },


  // Meeting Location (Dynamic)
  {
    id: "meeting-location",
    type: "dynamic",
    position: { x: 20, y: 68 },
    size: { width: 170, height: 6 },
    style: {
      fontSize: 11,
      fontFamily: "helvetica",
      fontWeight: "normal",
      color: "#1f2937",
      textAlign: "left",
      backgroundColor: "transparent"
    },
    content: { type: "meeting_location" },
    zIndex: 1
  },


  // Agenda Section Header
  {
    id: "agenda-header",
    type: "text",
    position: { x: 15, y: 95 },
    size: { width: 180, height: 8 },
    style: {
      fontSize: 16,
      fontFamily: "helvetica",
      fontWeight: "bold",
      color: "#0f235a",
      textAlign: "left",
      backgroundColor: "transparent",
      borderWidth: 0,
      borderColor: "#0f235a"
    },
    content: "AGENDA ITEMS",
    zIndex: 1
  },


  // Topics List (Dynamic)
  {
    id: "topics-list",
    type: "dynamic",
    position: { x: 15, y: 108 },
    size: { width: 180, height: 150 },
    style: {
      fontSize: 11,
      fontFamily: "helvetica",
      fontWeight: "normal",
      color: "#1f2937",
      textAlign: "left",
      backgroundColor: "#f9fafb",
      padding: 8,
      borderRadius: 4
    },
    content: { type: "topics_list" },
    zIndex: 1
  }
]


// Modern Minimal Template
export const MINIMAL_TEMPLATE: CanvasElement[] = [
  // ⭐ UPDATED: Company Logo (Dynamic)
  {
    id: "logo",
    type: "dynamic",
    position: { x: 95, y: 15 },
    size: { width: 20, height: 20 },
    style: {
      backgroundColor: "transparent",
      borderRadius: 10
    },
    content: { type: "company_logo" },
    zIndex: 2
  },

  // Title
  {
    id: "title",
    type: "text",
    position: { x: 20, y: 40 },
    size: { width: 170, height: 15 },
    style: {
      fontSize: 32,
      fontFamily: "helvetica",
      fontWeight: "bold",
      color: "#1f2937",
      textAlign: "center",
      backgroundColor: "transparent"
    },
    content: "Meeting Agenda",
    zIndex: 1
  },


  // Building Name
  {
    id: "building-name",
    type: "dynamic",
    position: { x: 20, y: 58 },
    size: { width: 170, height: 8 },
    style: {
      fontSize: 14,
      fontFamily: "helvetica",
      fontWeight: "normal",
      color: "#6b7280",
      textAlign: "center",
      backgroundColor: "transparent"
    },
    content: { type: "building_name" },
    zIndex: 1
  },


  // Divider Line
  {
    id: "divider",
    type: "shape",
    position: { x: 60, y: 70 },
    size: { width: 90, height: 0.5 },
    style: {
      backgroundColor: "#e5e7eb",
      borderRadius: 0
    },
    zIndex: 1
  },


  // Meeting Details
  {
    id: "meeting-date",
    type: "dynamic",
    position: { x: 20, y: 78 },
    size: { width: 170, height: 6 },
    style: {
      fontSize: 11,
      fontFamily: "helvetica",
      fontWeight: "normal",
      color: "#1f2937",
      textAlign: "center",
      backgroundColor: "transparent"
    },
    content: { type: "meeting_date" },
    zIndex: 1
  },


  {
    id: "meeting-time",
    type: "dynamic",
    position: { x: 20, y: 86 },
    size: { width: 170, height: 6 },
    style: {
      fontSize: 11,
      fontFamily: "helvetica",
      fontWeight: "normal",
      color: "#1f2937",
      textAlign: "center",
      backgroundColor: "transparent"
    },
    content: { type: "meeting_time" },
    zIndex: 1
  },


  // Topics
  {
    id: "topics-list",
    type: "dynamic",
    position: { x: 20, y: 105 },
    size: { width: 170, height: 180 },
    style: {
      fontSize: 11,
      fontFamily: "helvetica",
      fontWeight: "normal",
      color: "#1f2937",
      textAlign: "left",
      backgroundColor: "transparent",
      padding: 0
    },
    content: { type: "topics_list" },
    zIndex: 1
  }
]


// Compact Template
export const COMPACT_TEMPLATE: CanvasElement[] = [
  // Header bar
  {
    id: "header-bar",
    type: "shape",
    position: { x: 0, y: 0 },
    size: { width: 210, height: 12 },
    style: {
      backgroundColor: "#3b82f6",
      borderRadius: 0
    },
    zIndex: 0
  },

  // ⭐ UPDATED: Company Logo (Dynamic)
  {
    id: "logo",
    type: "dynamic",
    position: { x: 8, y: 2 },
    size: { width: 8, height: 8 },
    style: {
      backgroundColor: "transparent",
      borderRadius: 4
    },
    content: { type: "company_logo" },
    zIndex: 2
  },


  // Meeting Title
  {
    id: "meeting-title",
    type: "dynamic",
    position: { x: 20, y: 2 },
    size: { width: 170, height: 8 },
    style: {
      fontSize: 16,
      fontFamily: "helvetica",
      fontWeight: "bold",
      color: "#ffffff",
      textAlign: "center",
      backgroundColor: "transparent"
    },
    content: { type: "meeting_title" },
    zIndex: 1
  },


  // Info row
  {
    id: "building-name",
    type: "dynamic",
    position: { x: 10, y: 18 },
    size: { width: 60, height: 5 },
    style: {
      fontSize: 9,
      fontFamily: "helvetica",
      fontWeight: "normal",
      color: "#1f2937",
      textAlign: "left",
      backgroundColor: "transparent"
    },
    content: { type: "building_name" },
    zIndex: 1
  },


  {
    id: "meeting-date",
    type: "dynamic",
    position: { x: 75, y: 18 },
    size: { width: 60, height: 5 },
    style: {
      fontSize: 9,
      fontFamily: "helvetica",
      fontWeight: "normal",
      color: "#1f2937",
      textAlign: "center",
      backgroundColor: "transparent"
    },
    content: { type: "meeting_date" },
    zIndex: 1
  },


  {
    id: "meeting-time",
    type: "dynamic",
    position: { x: 140, y: 18 },
    size: { width: 60, height: 5 },
    style: {
      fontSize: 9,
      fontFamily: "helvetica",
      fontWeight: "normal",
      color: "#1f2937",
      textAlign: "right",
      backgroundColor: "transparent"
    },
    content: { type: "meeting_time" },
    zIndex: 1
  },


  // Topics
  {
    id: "topics-list",
    type: "dynamic",
    position: { x: 10, y: 28 },
    size: { width: 190, height: 240 },
    style: {
      fontSize: 10,
      fontFamily: "helvetica",
      fontWeight: "normal",
      color: "#1f2937",
      textAlign: "left",
      backgroundColor: "transparent",
      padding: 0
    },
    content: { type: "topics_list" },
    zIndex: 1
  }
]


// Template registry
export const CANVAS_TEMPLATES = {
  professional: {
    name: "Professional",
    description: "Clean and professional layout with header banner and info card",
    thumbnail: "📋",
    elements: PROFESSIONAL_TEMPLATE
  },
  minimal: {
    name: "Modern Minimal",
    description: "Minimalist design with centered layout and simple divider",
    thumbnail: "✨",
    elements: MINIMAL_TEMPLATE
  },
  compact: {
    name: "Compact",
    description: "Space-efficient layout with top banner and condensed info",
    thumbnail: "📄",
    elements: COMPACT_TEMPLATE
  }
}


export type TemplateKey = keyof typeof CANVAS_TEMPLATES
