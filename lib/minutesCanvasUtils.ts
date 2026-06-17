// lib/minutesCanvasUtils.ts
// Minutes-specific canvas utilities extending the base canvas system
// Supports dynamic fields specific to minutes (notes, tasks, decisions, votes)

export type MinutesDynamicFieldType =
  // Header fields (same as agenda)
  | "building_name"
  | "meeting_type"
  | "meeting_date"
  | "start_time"
  | "location"
  | "address"
  | "strata_plan"
  // NEW: Special layout fields
  | "document_heading"
  | "attendance_block"
  // Attendee fields
  | "attendee_list"
  | "attendee_names"
  | "attendee_roles"
  | "attendance_status"
  // Section/Topic fields
  | "section_titles"
  | "section_numbers"
  | "topic_titles"
  | "topic_numbers"
  | "topic_descriptions"
  // Minutes-specific content fields
  | "topic_notes"
  | "topic_tasks"
  | "topic_decisions"
  | "decision_votes"
  | "task_assignees"
  | "task_due_dates"
  // Footer fields
  | "footer_building_name"
  | "page_number"
  | "branding"
  | "adjournment_time"
  | "next_meeting_date"
  | "signatures"

export function getMinutesDynamicFieldName(type: MinutesDynamicFieldType): string {
  const names: Record<MinutesDynamicFieldType, string> = {
    // Header
    building_name: "Building Name",
    meeting_type: "Meeting Type",
    meeting_date: "Meeting Date",
    start_time: "Start Time",
    location: "Location",
    address: "Address",
    strata_plan: "Strata Plan Number",

    // Special layout
    document_heading: "Document Heading",
    attendance_block: "Attendance Block",

    // Attendees
    attendee_list: "Attendee List (Full)",
    attendee_names: "Attendee Names",
    attendee_roles: "Attendee Roles",
    attendance_status: "Attendance Status",

    // Sections/Topics
    section_titles: "Section Titles",
    section_numbers: "Section Numbers",
    topic_titles: "Topic Titles",
    topic_numbers: "Topic Numbers",
    topic_descriptions: "Topic Descriptions",

    // Minutes Content
    topic_notes: "Topic Notes",
    topic_tasks: "Topic Tasks",
    topic_decisions: "Topic Decisions",
    decision_votes: "Decision Vote Counts",
    task_assignees: "Task Assignees",
    task_due_dates: "Task Due Dates",

    // Footer
    footer_building_name: "Footer Building Name",
    page_number: "Page Number",
    branding: "Meeting Genius Branding",
    adjournment_time: "Adjournment Time",
    next_meeting_date: "Next Meeting Date",
    signatures: "Signature Lines",
  }

  return names[type] || type
}

export function getMinutesDynamicFieldDescription(type: MinutesDynamicFieldType): string {
  const descriptions: Record<MinutesDynamicFieldType, string> = {
    // Header
    building_name: "Name of the building/property",
    meeting_type: "Type of meeting (Council, AGM, etc.)",
    meeting_date: "Date of the meeting",
    start_time: "Meeting start time",
    location: "Meeting location",
    address: "Building address",
    strata_plan: "Strata plan number",

    // Special layout blocks
    document_heading: "Full formatted document heading with building, date and meeting type",
    attendance_block: "Complete attendance table or list with names, roles and status",

    // Attendees
    attendee_list: "Complete list of attendees with names, roles, and presence",
    attendee_names: "Names of all attendees",
    attendee_roles: "Roles of attendees (Chair, Secretary, etc.)",
    attendance_status: "Present/Absent status for each attendee",

    // Sections/Topics
    section_titles: "Titles of agenda sections",
    section_numbers: "Numbered list of sections (1., 2., 3.)",
    topic_titles: "Titles of discussion topics",
    topic_numbers: "Numbered list of topics (1.1, 1.2, etc.)",
    topic_descriptions: "Full descriptions of topics",

    // Minutes Content
    topic_notes: "Discussion notes for each topic",
    topic_tasks: "Action items/tasks for each topic",
    topic_decisions: "Decisions and motions recorded",
    decision_votes: "Vote counts (For/Against/Abstain)",
    task_assignees: "People assigned to tasks",
    task_due_dates: "Due dates for tasks",

    // Footer
    footer_building_name: "Building name in footer",
    page_number: "Current page number",
    branding: "Meeting Genius logo and branding",
    adjournment_time: "Time meeting was adjourned",
    next_meeting_date: "Date of next scheduled meeting",
    signatures: "Signature lines for chair and secretary",
  }

  return descriptions[type] || "Dynamic field from meeting data"
}

// Group fields by category for component library
export const MINUTES_FIELD_CATEGORIES: Record<string, MinutesDynamicFieldType[]> = {
  "🎨 Layout Blocks": [
    "document_heading",
    "attendance_block",
  ],

  "Header Information": [
    "building_name",
    "meeting_type",
    "meeting_date",
    "start_time",
    "location",
    "address",
    "strata_plan",
  ],

  Attendees: ["attendee_list", "attendee_names", "attendee_roles", "attendance_status"],

  Structure: [
    "section_titles",
    "section_numbers",
    "topic_titles",
    "topic_numbers",
    "topic_descriptions",
  ],

  Content: [
    "topic_notes",
    "topic_tasks",
    "topic_decisions",
    "decision_votes",
    "task_assignees",
    "task_due_dates",
  ],

  Footer: [
    "footer_building_name",
    "page_number",
    "branding",
    "adjournment_time",
    "next_meeting_date",
    "signatures",
  ],
}
