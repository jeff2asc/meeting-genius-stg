import { CanvasElement } from "./canvasUtils"

// ==========================================
// DEFAULT MINUTES CANVAS TEMPLATES
// ==========================================

// Professional Meeting Minutes Template
export const PROFESSIONAL_MINUTES_TEMPLATE: CanvasElement[] = [
  // Header Background
  {
    id: "header-bg",
    type: "shape",
    position: { x: 0, y: 0 },
    size: { width: 210, height: 40 },
    content: null,
    style: {
      backgroundColor: "#1e3a8a",
      borderRadius: 0
    },
    locked: false
  },

  // Company Logo
  {
    id: "logo",
    type: "dynamic",
    position: { x: 15, y: 10 },
    size: { width: 25, height: 20 },
    style: {
      backgroundColor: "transparent",
      borderRadius: 8
    },
    content: { type: "company_logo" },
    locked: false
  },

  // Title - MEETING MINUTES
  {
    id: "main-title",
    type: "text",
    position: { x: 45, y: 12 },
    size: { width: 150, height: 10 },
    style: {
      fontSize: 26,
      fontWeight: "bold",
      color: "#ffffff",
      textAlign: "center",
      backgroundColor: "transparent"
    },
    content: "MEETING MINUTES",
    locked: false
  },

  // Building Name (Dynamic)
  {
    id: "building-name",
    type: "dynamic",
    position: { x: 45, y: 25 },
    size: { width: 150, height: 8 },
    style: {
      fontSize: 14,
      fontWeight: "normal",
      color: "#dbeafe",
      textAlign: "center",
      backgroundColor: "transparent"
    },
    content: { type: "building_name" },
    locked: false
  },

  // Meeting Details Card Background
  {
    id: "details-card-bg",
    type: "container",
    position: { x: 15, y: 48 },
    size: { width: 180, height: 50 },
    content: null,
    style: {
      backgroundColor: "#f9fafb",
      borderWidth: "2px",
      borderColor: "#e5e7eb",
      borderRadius: 8
    },
    locked: false
  },

  // Meeting Type Label
  {
    id: "type-label",
    type: "text",
    position: { x: 20, y: 53 },
    size: { width: 80, height: 5 },
    style: {
      fontSize: 9,
      fontWeight: "bold",
      color: "#6b7280",
      textAlign: "left",
      backgroundColor: "transparent"
    },
    content: "MEETING TYPE",
    locked: false
  },

  // Meeting Type (Dynamic)
  {
    id: "meeting-type",
    type: "dynamic",
    position: { x: 20, y: 58 },
    size: { width: 80, height: 6 },
    style: {
      fontSize: 11,
      fontWeight: "normal",
      color: "#1f2937",
      textAlign: "left",
      backgroundColor: "transparent"
    },
    content: { type: "meeting_type" },
    locked: false
  },

  // Meeting Date Label
  {
    id: "date-label",
    type: "text",
    position: { x: 110, y: 53 },
    size: { width: 80, height: 5 },
    style: {
      fontSize: 9,
      fontWeight: "bold",
      color: "#6b7280",
      textAlign: "left",
      backgroundColor: "transparent"
    },
    content: "DATE",
    locked: false
  },

  // Meeting Date (Dynamic)
  {
    id: "meeting-date",
    type: "dynamic",
    position: { x: 110, y: 58 },
    size: { width: 80, height: 6 },
    style: {
      fontSize: 11,
      fontWeight: "normal",
      color: "#1f2937",
      textAlign: "left",
      backgroundColor: "transparent"
    },
    content: { type: "meeting_date" },
    locked: false
  },

  // Time Label
  {
    id: "time-label",
    type: "text",
    position: { x: 20, y: 68 },
    size: { width: 80, height: 5 },
    style: {
      fontSize: 9,
      fontWeight: "bold",
      color: "#6b7280",
      textAlign: "left",
      backgroundColor: "transparent"
    },
    content: "TIME",
    locked: false
  },

  // Start Time (Dynamic)
  {
    id: "start-time",
    type: "dynamic",
    position: { x: 20, y: 73 },
    size: { width: 80, height: 6 },
    style: {
      fontSize: 11,
      fontWeight: "normal",
      color: "#1f2937",
      textAlign: "left",
      backgroundColor: "transparent"
    },
    content: { type: "start_time" },
    locked: false
  },

  // Location Label
  {
    id: "location-label",
    type: "text",
    position: { x: 110, y: 68 },
    size: { width: 80, height: 5 },
    style: {
      fontSize: 9,
      fontWeight: "bold",
      color: "#6b7280",
      textAlign: "left",
      backgroundColor: "transparent"
    },
    content: "LOCATION",
    locked: false
  },

  // Location (Dynamic)
  {
    id: "location",
    type: "dynamic",
    position: { x: 110, y: 73 },
    size: { width: 80, height: 6 },
    style: {
      fontSize: 11,
      fontWeight: "normal",
      color: "#1f2937",
      textAlign: "left",
      backgroundColor: "transparent"
    },
    content: { type: "location" },
    locked: false
  },

  // Strata Plan Label
  {
    id: "strata-label",
    type: "text",
    position: { x: 20, y: 83 },
    size: { width: 170, height: 5 },
    style: {
      fontSize: 9,
      fontWeight: "bold",
      color: "#6b7280",
      textAlign: "left",
      backgroundColor: "transparent"
    },
    content: "STRATA PLAN",
    locked: false
  },

  // Strata Plan (Dynamic)
  {
    id: "strata-plan",
    type: "dynamic",
    position: { x: 20, y: 88 },
    size: { width: 170, height: 6 },
    style: {
      fontSize: 11,
      fontWeight: "normal",
      color: "#1f2937",
      textAlign: "left",
      backgroundColor: "transparent"
    },
    content: { type: "strata_plan" },
    locked: false
  },

  // Attendees Header
  {
    id: "attendees-header",
    type: "text",
    position: { x: 15, y: 105 },
    size: { width: 180, height: 8 },
    style: {
      fontSize: 16,
      fontWeight: "bold",
      color: "#1e3a8a",
      textAlign: "left",
      backgroundColor: "transparent"
    },
    content: "ATTENDEES",
    locked: false
  },

  // Attendees List (Dynamic) - FIXED
  {
    id: "attendees-list",
    type: "dynamic",
    position: { x: 15, y: 116 },
    size: { width: 180, height: 40 },
    style: {
      fontSize: 10,
      fontWeight: "normal",
      color: "#1f2937",
      textAlign: "left",
      backgroundColor: "#ffffff",
      borderWidth: "1px",
      borderColor: "#e5e7eb",
      borderRadius: 6
    },
    content: { type: "attendees_list" },
    locked: false
  },

  // Discussion & Decisions Header
  {
    id: "content-header",
    type: "text",
    position: { x: 15, y: 162 },
    size: { width: 180, height: 8 },
    style: {
      fontSize: 16,
      fontWeight: "bold",
      color: "#1e3a8a",
      textAlign: "left",
      backgroundColor: "transparent"
    },
    content: "DISCUSSION & DECISIONS",
    locked: false
  },

  // Topics with Notes, Tasks, Decisions (Dynamic)
  {
    id: "topics-content",
    type: "dynamic",
    position: { x: 15, y: 173 },
    size: { width: 180, height: 400 },
    style: {
      fontSize: 10,
      fontWeight: "normal",
      color: "#1f2937",
      textAlign: "left",
      backgroundColor: "transparent"
    },
    content: { type: "topics_list" },
    locked: false
  }
]

// Modern Minimal Minutes Template
export const MINIMAL_MINUTES_TEMPLATE: CanvasElement[] = [
  // Company Logo (Centered)
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
    locked: false
  },

  // Title
  {
    id: "title",
    type: "text",
    position: { x: 20, y: 40 },
    size: { width: 170, height: 12 },
    style: {
      fontSize: 28,
      fontWeight: "bold",
      color: "#1f2937",
      textAlign: "center",
      backgroundColor: "transparent"
    },
    content: "Meeting Minutes",
    locked: false
  },

  // Building Name
  {
    id: "building-name",
    type: "dynamic",
    position: { x: 20, y: 55 },
    size: { width: 170, height: 8 },
    style: {
      fontSize: 14,
      fontWeight: "normal",
      color: "#6b7280",
      textAlign: "center",
      backgroundColor: "transparent"
    },
    content: { type: "building_name" },
    locked: false
  },

  // Divider
  {
    id: "divider",
    type: "shape",
    position: { x: 60, y: 67 },
    size: { width: 90, height: 0.5 },
    content: null,
    style: {
      backgroundColor: "#d1d5db",
      borderRadius: 0
    },
    locked: false
  },

  // Meeting Date
  {
    id: "meeting-date",
    type: "dynamic",
    position: { x: 20, y: 75 },
    size: { width: 170, height: 6 },
    style: {
      fontSize: 11,
      fontWeight: "normal",
      color: "#1f2937",
      textAlign: "center",
      backgroundColor: "transparent"
    },
    content: { type: "meeting_date" },
    locked: false
  },

  // Meeting Time
  {
    id: "meeting-time",
    type: "dynamic",
    position: { x: 20, y: 82 },
    size: { width: 170, height: 6 },
    style: {
      fontSize: 11,
      fontWeight: "normal",
      color: "#1f2937",
      textAlign: "center",
      backgroundColor: "transparent"
    },
    content: { type: "start_time" },
    locked: false
  },

  // Attendees - FIXED
  {
    id: "attendees-list",
    type: "dynamic",
    position: { x: 20, y: 95 },
    size: { width: 170, height: 35 },
    style: {
      fontSize: 10,
      fontWeight: "normal",
      color: "#1f2937",
      textAlign: "left",
      backgroundColor: "#f9fafb",
      borderRadius: 6
    },
    content: { type: "attendees_list" },
    locked: false
  },

  // Topics Content
  {
    id: "topics-content",
    type: "dynamic",
    position: { x: 20, y: 137 },
    size: { width: 170, height: 450 },
    style: {
      fontSize: 10,
      fontWeight: "normal",
      color: "#1f2937",
      textAlign: "left",
      backgroundColor: "transparent"
    },
    content: { type: "topics_list" },
    locked: false
  }
]

// Compact Minutes Template
export const COMPACT_MINUTES_TEMPLATE: CanvasElement[] = [
  // Header Bar
  {
    id: "header-bar",
    type: "shape",
    position: { x: 0, y: 0 },
    size: { width: 210, height: 15 },
    content: null,
    style: {
      backgroundColor: "#059669",
      borderRadius: 0
    },
    locked: false
  },

  // Logo
  {
    id: "logo",
    type: "dynamic",
    position: { x: 8, y: 3 },
    size: { width: 9, height: 9 },
    style: {
      backgroundColor: "transparent",
      borderRadius: 4
    },
    content: { type: "company_logo" },
    locked: false
  },

  // Title
  {
    id: "title",
    type: "text",
    position: { x: 20, y: 3 },
    size: { width: 170, height: 9 },
    style: {
      fontSize: 18,
      fontWeight: "bold",
      color: "#ffffff",
      textAlign: "center",
      backgroundColor: "transparent"
    },
    content: "MEETING MINUTES",
    locked: false
  },

  // Info Row - Building
  {
    id: "building-name",
    type: "dynamic",
    position: { x: 10, y: 20 },
    size: { width: 60, height: 5 },
    style: {
      fontSize: 9,
      fontWeight: "bold",
      color: "#1f2937",
      textAlign: "left",
      backgroundColor: "transparent"
    },
    content: { type: "building_name" },
    locked: false
  },

  // Info Row - Date
  {
    id: "meeting-date",
    type: "dynamic",
    position: { x: 75, y: 20 },
    size: { width: 60, height: 5 },
    style: {
      fontSize: 9,
      fontWeight: "normal",
      color: "#1f2937",
      textAlign: "center",
      backgroundColor: "transparent"
    },
    content: { type: "meeting_date" },
    locked: false
  },

  // Info Row - Time
  {
    id: "start-time",
    type: "dynamic",
    position: { x: 140, y: 20 },
    size: { width: 60, height: 5 },
    style: {
      fontSize: 9,
      fontWeight: "normal",
      color: "#1f2937",
      textAlign: "right",
      backgroundColor: "transparent"
    },
    content: { type: "start_time" },
    locked: false
  },

  // Attendees (Compact) - FIXED
  {
    id: "attendees-list",
    type: "dynamic",
    position: { x: 10, y: 30 },
    size: { width: 190, height: 25 },
    style: {
      fontSize: 9,
      fontWeight: "normal",
      color: "#1f2937",
      textAlign: "left",
      backgroundColor: "#f0fdf4",
      borderRadius: 4
    },
    content: { type: "attendees_list" },
    locked: false
  },

  // Topics Content
  {
    id: "topics-content",
    type: "dynamic",
    position: { x: 10, y: 60 },
    size: { width: 190, height: 500 },
    style: {
      fontSize: 9,
      fontWeight: "normal",
      color: "#1f2937",
      textAlign: "left",
      backgroundColor: "transparent"
    },
    content: { type: "topics_list" },
    locked: false
  }
]

// Detailed Minutes Template (with sections for tasks/decisions)
export const DETAILED_MINUTES_TEMPLATE: CanvasElement[] = [
  // Header Background (Purple gradient theme)
  {
    id: "header-bg",
    type: "shape",
    position: { x: 0, y: 0 },
    size: { width: 210, height: 45 },
    content: null,
    style: {
      backgroundColor: "#7c3aed",
      borderRadius: 0
    },
    locked: false
  },

  // Logo
  {
    id: "logo",
    type: "dynamic",
    position: { x: 15, y: 12 },
    size: { width: 22, height: 22 },
    style: {
      backgroundColor: "transparent",
      borderRadius: 8
    },
    content: { type: "company_logo" },
    locked: false
  },

  // Main Title
  {
    id: "main-title",
    type: "text",
    position: { x: 42, y: 14 },
    size: { width: 150, height: 10 },
    style: {
      fontSize: 24,
      fontWeight: "bold",
      color: "#ffffff",
      textAlign: "center",
      backgroundColor: "transparent"
    },
    content: "MEETING MINUTES",
    locked: false
  },

  // Building Name
  {
    id: "building-name",
    type: "dynamic",
    position: { x: 42, y: 27 },
    size: { width: 150, height: 7 },
    style: {
      fontSize: 13,
      fontWeight: "normal",
      color: "#e9d5ff",
      textAlign: "center",
      backgroundColor: "transparent"
    },
    content: { type: "building_name" },
    locked: false
  },

  // Meeting Info Grid
  {
    id: "info-grid-bg",
    type: "container",
    position: { x: 15, y: 53 },
    size: { width: 180, height: 32 },
    content: null,
    style: {
      backgroundColor: "#faf5ff",
      borderWidth: "2px",
      borderColor: "#ddd6fe",
      borderRadius: 8
    },
    locked: false
  },

  // Type
  {
    id: "type-label",
    type: "text",
    position: { x: 20, y: 58 },
    size: { width: 50, height: 4 },
    style: {
      fontSize: 8,
      fontWeight: "bold",
      color: "#6b21a8",
      textAlign: "left",
      backgroundColor: "transparent"
    },
    content: "TYPE",
    locked: false
  },

  {
    id: "meeting-type",
    type: "dynamic",
    position: { x: 20, y: 62 },
    size: { width: 50, height: 5 },
    style: {
      fontSize: 10,
      fontWeight: "normal",
      color: "#1f2937",
      textAlign: "left",
      backgroundColor: "transparent"
    },
    content: { type: "meeting_type" },
    locked: false
  },

  // Date
  {
    id: "date-label",
    type: "text",
    position: { x: 75, y: 58 },
    size: { width: 50, height: 4 },
    style: {
      fontSize: 8,
      fontWeight: "bold",
      color: "#6b21a8",
      textAlign: "left",
      backgroundColor: "transparent"
    },
    content: "DATE",
    locked: false
  },

  {
    id: "meeting-date",
    type: "dynamic",
    position: { x: 75, y: 62 },
    size: { width: 50, height: 5 },
    style: {
      fontSize: 10,
      fontWeight: "normal",
      color: "#1f2937",
      textAlign: "left",
      backgroundColor: "transparent"
    },
    content: { type: "meeting_date" },
    locked: false
  },

  // Time
  {
    id: "time-label",
    type: "text",
    position: { x: 130, y: 58 },
    size: { width: 60, height: 4 },
    style: {
      fontSize: 8,
      fontWeight: "bold",
      color: "#6b21a8",
      textAlign: "left",
      backgroundColor: "transparent"
    },
    content: "TIME",
    locked: false
  },

  {
    id: "start-time",
    type: "dynamic",
    position: { x: 130, y: 62 },
    size: { width: 60, height: 5 },
    style: {
      fontSize: 10,
      fontWeight: "normal",
      color: "#1f2937",
      textAlign: "left",
      backgroundColor: "transparent"
    },
    content: { type: "start_time" },
    locked: false
  },

  // Location
  {
    id: "location-label",
    type: "text",
    position: { x: 20, y: 71 },
    size: { width: 50, height: 4 },
    style: {
      fontSize: 8,
      fontWeight: "bold",
      color: "#6b21a8",
      textAlign: "left",
      backgroundColor: "transparent"
    },
    content: "LOCATION",
    locked: false
  },

  {
    id: "location",
    type: "dynamic",
    position: { x: 20, y: 75 },
    size: { width: 170, height: 5 },
    style: {
      fontSize: 10,
      fontWeight: "normal",
      color: "#1f2937",
      textAlign: "left",
      backgroundColor: "transparent"
    },
    content: { type: "location" },
    locked: false
  },

  // Attendees Section
  {
    id: "attendees-header",
    type: "text",
    position: { x: 15, y: 92 },
    size: { width: 180, height: 7 },
    style: {
      fontSize: 14,
      fontWeight: "bold",
      color: "#7c3aed",
      textAlign: "left",
      backgroundColor: "transparent"
    },
    content: "👥 ATTENDEES",
    locked: false
  },

  // FIXED
  {
    id: "attendees-list",
    type: "dynamic",
    position: { x: 15, y: 102 },
    size: { width: 180, height: 38 },
    style: {
      fontSize: 10,
      fontWeight: "normal",
      color: "#1f2937",
      textAlign: "left",
      backgroundColor: "#ffffff",
      borderWidth: "1px",
      borderColor: "#ddd6fe",
      borderRadius: 6
    },
    content: { type: "attendees_list" },
    locked: false
  },

  // Topics Section
  {
    id: "topics-header",
    type: "text",
    position: { x: 15, y: 146 },
    size: { width: 180, height: 7 },
    style: {
      fontSize: 14,
      fontWeight: "bold",
      color: "#7c3aed",
      textAlign: "left",
      backgroundColor: "transparent"
    },
    content: "📝 DISCUSSION & DECISIONS",
    locked: false
  },

  {
    id: "topics-content",
    type: "dynamic",
    position: { x: 15, y: 156 },
    size: { width: 180, height: 400 },
    style: {
      fontSize: 10,
      fontWeight: "normal",
      color: "#1f2937",
      textAlign: "left",
      backgroundColor: "transparent"
    },
    content: { type: "topics_list" },
    locked: false
  }
]

// Corporate Gold Template — premium dark navy + gold accent
export const CORPORATE_GOLD_MINUTES_TEMPLATE: CanvasElement[] = [
  // Top navy bar (full width)
  {
    id: "cg-header-bg",
    type: "shape",
    position: { x: 0, y: 0 },
    size: { width: 210, height: 45 },
    content: null,
    style: { backgroundColor: "#0f172a", borderRadius: 0 },
    locked: false,
  },
  // Gold accent strip
  {
    id: "cg-gold-strip",
    type: "shape",
    position: { x: 0, y: 45 },
    size: { width: 210, height: 3 },
    content: null,
    style: { backgroundColor: "#d4a017", borderRadius: 0 },
    locked: false,
  },
  // Logo (top-left)
  {
    id: "cg-logo",
    type: "dynamic",
    position: { x: 12, y: 10 },
    size: { width: 24, height: 24 },
    style: { backgroundColor: "transparent", borderRadius: 4 },
    content: { type: "company_logo" },
    locked: false,
  },
  // MEETING MINUTES title
  {
    id: "cg-title",
    type: "text",
    position: { x: 42, y: 11 },
    size: { width: 140, height: 12 },
    style: {
      fontSize: 26,
      fontWeight: "bold",
      color: "#ffffff",
      textAlign: "center",
      backgroundColor: "transparent",
    },
    content: "MEETING MINUTES",
    locked: false,
  },
  // Building name subtitle
  {
    id: "cg-building",
    type: "dynamic",
    position: { x: 42, y: 26 },
    size: { width: 140, height: 8 },
    style: {
      fontSize: 13,
      fontWeight: "normal",
      color: "#d4a017",
      textAlign: "center",
      backgroundColor: "transparent",
    },
    content: { type: "building_name" },
    locked: false,
  },
  // Strata plan (small, below building)
  {
    id: "cg-strata",
    type: "dynamic",
    position: { x: 42, y: 36 },
    size: { width: 140, height: 6 },
    style: {
      fontSize: 9,
      fontWeight: "normal",
      color: "#94a3b8",
      textAlign: "center",
      backgroundColor: "transparent",
    },
    content: { type: "strata_plan" },
    locked: false,
  },
  // Document Heading block (full formatted sentence)
  {
    id: "cg-doc-heading",
    type: "dynamic",
    position: { x: 12, y: 54 },
    size: { width: 186, height: 16 },
    style: {
      fontSize: 10,
      fontWeight: "normal",
      color: "#1e293b",
      textAlign: "left",
      backgroundColor: "#fefce8",
      borderWidth: "1px",
      borderColor: "#d4a017",
      borderRadius: 4,
    },
    content: { type: "document_heading" },
    config: { headingFormat: "full_sentence", orientation: "horizontal" },
    locked: false,
  },
  // Meeting details row — info card background
  {
    id: "cg-info-bg",
    type: "container",
    position: { x: 12, y: 76 },
    size: { width: 186, height: 28 },
    content: null,
    style: {
      backgroundColor: "#f8fafc",
      borderWidth: "1px",
      borderColor: "#e2e8f0",
      borderRadius: 6,
    },
    locked: false,
  },
  // Type label
  {
    id: "cg-type-lbl",
    type: "text",
    position: { x: 17, y: 80 },
    size: { width: 44, height: 4 },
    style: { fontSize: 7, fontWeight: "bold", color: "#d4a017", textAlign: "left", backgroundColor: "transparent" },
    content: "MEETING TYPE",
    locked: false,
  },
  {
    id: "cg-type-val",
    type: "dynamic",
    position: { x: 17, y: 85 },
    size: { width: 44, height: 6 },
    style: { fontSize: 10, fontWeight: "normal", color: "#1e293b", textAlign: "left", backgroundColor: "transparent" },
    content: { type: "meeting_type" },
    locked: false,
  },
  // Date label
  {
    id: "cg-date-lbl",
    type: "text",
    position: { x: 68, y: 80 },
    size: { width: 44, height: 4 },
    style: { fontSize: 7, fontWeight: "bold", color: "#d4a017", textAlign: "left", backgroundColor: "transparent" },
    content: "DATE",
    locked: false,
  },
  {
    id: "cg-date-val",
    type: "dynamic",
    position: { x: 68, y: 85 },
    size: { width: 44, height: 6 },
    style: { fontSize: 10, fontWeight: "normal", color: "#1e293b", textAlign: "left", backgroundColor: "transparent" },
    content: { type: "meeting_date" },
    locked: false,
  },
  // Time label
  {
    id: "cg-time-lbl",
    type: "text",
    position: { x: 119, y: 80 },
    size: { width: 35, height: 4 },
    style: { fontSize: 7, fontWeight: "bold", color: "#d4a017", textAlign: "left", backgroundColor: "transparent" },
    content: "TIME",
    locked: false,
  },
  {
    id: "cg-time-val",
    type: "dynamic",
    position: { x: 119, y: 85 },
    size: { width: 35, height: 6 },
    style: { fontSize: 10, fontWeight: "normal", color: "#1e293b", textAlign: "left", backgroundColor: "transparent" },
    content: { type: "start_time" },
    locked: false,
  },
  // Location label
  {
    id: "cg-loc-lbl",
    type: "text",
    position: { x: 160, y: 80 },
    size: { width: 35, height: 4 },
    style: { fontSize: 7, fontWeight: "bold", color: "#d4a017", textAlign: "left", backgroundColor: "transparent" },
    content: "LOCATION",
    locked: false,
  },
  {
    id: "cg-loc-val",
    type: "dynamic",
    position: { x: 160, y: 85 },
    size: { width: 35, height: 6 },
    style: { fontSize: 10, fontWeight: "normal", color: "#1e293b", textAlign: "left", backgroundColor: "transparent" },
    content: { type: "location" },
    locked: false,
  },
  // Section divider — ATTENDEES
  {
    id: "cg-att-divider",
    type: "shape",
    position: { x: 12, y: 109 },
    size: { width: 186, height: 0.5 },
    content: null,
    style: { backgroundColor: "#d4a017", borderRadius: 0 },
    locked: false,
  },
  {
    id: "cg-att-title",
    type: "text",
    position: { x: 12, y: 112 },
    size: { width: 80, height: 7 },
    style: { fontSize: 11, fontWeight: "bold", color: "#0f172a", textAlign: "left", backgroundColor: "transparent" },
    content: "ATTENDEES",
    locked: false,
  },
  // Attendance block
  {
    id: "cg-attendance",
    type: "dynamic",
    position: { x: 12, y: 121 },
    size: { width: 186, height: 42 },
    style: {
      fontSize: 9,
      fontWeight: "normal",
      color: "#1e293b",
      textAlign: "left",
      backgroundColor: "#ffffff",
      borderWidth: "1px",
      borderColor: "#e2e8f0",
      borderRadius: 4,
    },
    content: { type: "attendance_block" },
    config: { attendanceStyle: "table", orientation: "horizontal" },
    locked: false,
  },
  // Section divider — DISCUSSION
  {
    id: "cg-disc-divider",
    type: "shape",
    position: { x: 12, y: 168 },
    size: { width: 186, height: 0.5 },
    content: null,
    style: { backgroundColor: "#d4a017", borderRadius: 0 },
    locked: false,
  },
  {
    id: "cg-disc-title",
    type: "text",
    position: { x: 12, y: 171 },
    size: { width: 180, height: 7 },
    style: { fontSize: 11, fontWeight: "bold", color: "#0f172a", textAlign: "left", backgroundColor: "transparent" },
    content: "DISCUSSION & DECISIONS",
    locked: false,
  },
  // Topics content
  {
    id: "cg-topics",
    type: "dynamic",
    position: { x: 12, y: 181 },
    size: { width: 186, height: 400 },
    style: { fontSize: 9, fontWeight: "normal", color: "#1e293b", textAlign: "left", backgroundColor: "transparent" },
    content: { type: "topics_list" },
    locked: false,
  },
  // Footer bar
  {
    id: "cg-footer-bg",
    type: "shape",
    position: { x: 0, y: 284 },
    size: { width: 210, height: 13 },
    content: null,
    style: { backgroundColor: "#0f172a", borderRadius: 0 },
    locked: false,
  },
  {
    id: "cg-footer-building",
    type: "dynamic",
    position: { x: 12, y: 287 },
    size: { width: 100, height: 6 },
    style: { fontSize: 7, fontWeight: "normal", color: "#94a3b8", textAlign: "left", backgroundColor: "transparent" },
    content: { type: "footer_building_name" },
    locked: false,
  },
  {
    id: "cg-footer-page",
    type: "dynamic",
    position: { x: 170, y: 287 },
    size: { width: 28, height: 6 },
    style: { fontSize: 7, fontWeight: "normal", color: "#94a3b8", textAlign: "right", backgroundColor: "transparent" },
    content: { type: "page_number" },
    locked: false,
  },
]

// Template Registry
export const MINUTES_CANVAS_TEMPLATES = {
  corporate_gold: {
    name: "Corporate Gold ⭐",
    description: "Premium dark navy + gold accent with document heading, attendance table, and full content layout",
    thumbnail: "🏆",
    elements: CORPORATE_GOLD_MINUTES_TEMPLATE,
  },
  professional: {
    name: "Professional",
    description: "Clean professional layout with blue gradient header and detailed sections",
    thumbnail: "📋",
    elements: PROFESSIONAL_MINUTES_TEMPLATE,
  },
  minimal: {
    name: "Modern Minimal",
    description: "Minimalist centered design with simple divider and clean typography",
    thumbnail: "✨",
    elements: MINIMAL_MINUTES_TEMPLATE,
  },
  compact: {
    name: "Compact",
    description: "Space-efficient layout with green accent and condensed sections",
    thumbnail: "📄",
    elements: COMPACT_MINUTES_TEMPLATE,
  },
  detailed: {
    name: "Detailed",
    description: "Comprehensive layout with purple theme, perfect for formal minutes",
    thumbnail: "📚",
    elements: DETAILED_MINUTES_TEMPLATE,
  },
}

export type MinutesTemplateKey = keyof typeof MINUTES_CANVAS_TEMPLATES

