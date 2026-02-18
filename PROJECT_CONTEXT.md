# Meeting Genius - Complete Project Context Documentation

## Table of Contents
1. [Project Overview](#project-overview)
2. [Technology Stack](#technology-stack)
3. [Database Schema (Supabase Tables)](#database-schema-supabase-tables)
4. [User Types & Permissions System](#user-types--permissions-system)
5. [Key Features](#key-features)
6. [Component Architecture](#component-architecture)
7. [Authentication System](#authentication-system)
8. [Key Workflows](#key-workflows)
9. [File Structure](#file-structure)
10. [Important Implementation Details](#important-implementation-details)

---

## Project Overview

**Meeting Genius** is a comprehensive meeting management system designed for property management companies. It allows users to create, manage, and track meetings (agendas and minutes) with features for topics, sections, tasks, decisions, notes, and attendee management.

### Core Purpose
- Manage meeting agendas and minutes for property management
- Track tasks, decisions, and notes from meetings
- Support multiple companies, buildings, and user types (including owners)
- Enable rollover of topics and tasks from previous meetings
- Provide role-based access control
- AI-powered analysis of topics and tasks using building documents
- Document management and text extraction for context
- Email notifications via company-specific SMTP configurations

---

## Technology Stack

### Frontend
- **Framework**: Next.js 15.2.4 (React 19)
- **Language**: TypeScript
- **Styling**: Tailwind CSS 4.1.9
- **UI Components**: Radix UI primitives (shadcn/ui style)
- **State Management**: React hooks (useState, useEffect)
- **Drag & Drop**: @hello-pangea/dnd (formerly react-beautiful-dnd)
- **Forms**: React Hook Form with Zod validation
- **Icons**: Lucide React
- **Theming**: next-themes (dark/light mode support)

### Backend/Database
- **Database**: Supabase (PostgreSQL)
- **Client**: @supabase/supabase-js 2.76.1
- **Authentication**: Custom (localStorage-based, password hashing with bcryptjs)
- **Storage**: Supabase Storage for files (documents, attachments, logos, transcripts)
- **AI Integration**: Google Gemini AI (@google/generative-ai 0.24.1) for transcript analysis

### Other Dependencies
- **Date Handling**: date-fns 4.1.0; **Timezone**: `lib/timezone.ts` for UTC ↔ local conversion (formatUtcToLocalLong, formatUtcToLocalShort, etc.)
- **Charts**: Recharts 2.15.4
- **Notifications**: Sonner (toast notifications)
- **Analytics**: Vercel Analytics 1.3.1
- **PDF Generation**: jspdf (^3.0.4)
- **HTML to Canvas**: html2canvas (^1.4.1)
- **Email**: nodemailer (^7.0.11) - For sending emails via SMTP
- **Document Processing**: 
  - react-pdftotext (^1.3.4) - Extract text from PDF files
  - mammoth (^1.11.0) - Extract text from DOCX files
  - pdf-parse (^2.4.5) - Additional PDF parsing support
  - pdfjs-dist (^5.4.449) - PDF.js library
- **AI/ML**: @google/generative-ai (0.24.1) - Google Gemini AI integration for transcript task extraction

---

## Database Schema (Supabase Tables)

### 1. **companies**
Multi-tenant company management table.

```typescript
{
  id: number (primary key, auto-increment)
  name: string
  created_at: timestamp
  updated_at: timestamp
  default_meeting_sections: string[] | null  // Array of default section names
  default_meeting_types: string[] | null      // Array of default meeting types
  default_decision_results: string[] | null   // Array of decision result options (e.g., ["M/S/C", "Defeated", "Deferred"])
  // SMTP Email Configuration
  smtp_host: string | null                    // SMTP server hostname
  smtp_port: number | null                    // SMTP server port (e.g., 587, 465)
  smtp_user: string | null                    // SMTP username/email
  smtp_password: string | null                // SMTP password
  smtp_from_name: string | null               // Display name for sender
  smtp_from_email: string | null              // From email address
  smtp_use_tls: boolean | null               // Use TLS encryption
  logo_url: string | null                      // URL to company logo in Supabase Storage
}
```

**Default Values** (used when company has no defaults):
- **Meeting Sections**: "Call to Order", "Approval of Agenda", "Old Business / Business Arising", "New Business", "Financial Report", "Maintenance & Operations", "Correspondence", "Council Roundtable", "Adjournment"
- **Meeting Types**: "Council Meeting", "AGM", "SGM", "Special Meeting", "Emergency Meeting"
- **Decision Results**: "M/S/C", "Defeated", "Deferred"

**Purpose**: Stores company information, default configurations for meetings, and SMTP email settings for sending emails.

**SMTP Configuration**:
- Companies can configure their own SMTP settings for sending emails
- Used by the email API (`/api/send-email`) to send notifications and task assignments
- Managed in CompanyDetailsModal → Overview tab
- Settings include host, port, authentication, and TLS configuration

**Company Logo**:
- Companies can upload a logo that appears in the dashboard header for all company users
- Logo is stored in Supabase Storage bucket: `company-logos`
- File path format: `{company_id}/logo.{ext}`
- Supported formats: PNG, JPG, SVG
- Maximum file size: 2MB
- Managed in CompanyDetailsModal → Logo tab
- Master users see default Meeting Genius logo; company users see their company logo

---

### 2. **users**
User accounts with role-based access.

```typescript
{
  id: number (primary key, auto-increment)
  name: string
  email: string (unique)
  password_hash: string
  user_type: 'master' | 'property_manager' | 'user' | 'vendor' | 'attendee' | 'corporate_administrator' | 'owner' | 'resident'
  company_id: number | null (foreign key → companies.id)
  assigned_pm_id: number | null (foreign key → users.id, references property_manager)
  smtp_config: any | null
  created_at: timestamp
  updated_at: timestamp
}
```

**Purpose**: Stores all user accounts with their roles and company associations.

**Key Fields**:
- `assigned_pm_id`: Links regular users to their assigned property manager (used for filtering and access control)
- `company_id`: Associates user with a company for multi-tenant isolation

**User Types** (8 total):
- `master`: Full system access across all companies
- `corporate_administrator`: Manages multiple property managers within their company
- `property_manager`: Manages buildings and meetings within their company
- `user`: Basic access to assigned buildings
- `owner`: Property owner with access to assigned buildings and meetings
  - Used for Strata/Condo and Rental buildings
  - Auto-assigned when creating users in these building types
  - Receives meeting notices via email
  - Displayed as "Owner" in UI with blue badge
- `resident`: Housing Co-op resident with access to assigned buildings
  - Used specifically for Housing Co-op building types
  - Similar permissions to 'owner' and 'user' types
  - Receives meeting notices via email
  - Displayed as "Resident" in UI
  - Separate database user_type (not just a display label)
- `vendor`: Receives and updates assigned tasks
- `attendee`: View-only access to meetings they attend

**Note**: 
- The `notification_recipient_type` field in buildings determines which user type receives meeting notifications
- User types are auto-set when creating users in BuildingDetailsModal based on building type:
  - Housing Co-op → 'resident' type
  - Strata/Condo/Rental → 'owner' type
- Send Notice feature filters recipients by user_type ('owner' OR 'resident') from user_buildings table

---

### 3. **buildings**
Properties/buildings managed by property managers.

```typescript
{
  id: number (primary key, auto-increment)
  manager_id: number (foreign key → users.id)
  name: string
  address: string | null
  company_id: number | null (foreign key → companies.id)
  building_type: string
  logo_url: string | null
  header_text: string | null
  footer_text: string | null
  primary_color: string
  agenda_template: string | null
  minutes_template: string | null
  rules_document: any | null
  rules_filename: string | null
  board_meeting_notice_days: number | null (default: 7)
  general_meeting_notice_days: number | null (default: 7)
  notification_recipient_type: string | null ('owner' or 'resident', default based on building_type)
  created_at: timestamp
  updated_at: timestamp
}
```

**Purpose**: Represents physical buildings/properties. Each building belongs to a property manager and optionally a company.

**Notification Settings**:
- `board_meeting_notice_days`: Number of days before board meetings to send notices/agendas (default: 7)
- `general_meeting_notice_days`: Number of days before general meetings to send notices (default: 7)
- `notification_recipient_type`: Who receives notifications - 'owner' for Strata/Condo/Rental, 'resident' for Housing Co-op
- Settings are managed in BuildingDetailsModal → Notifications tab
- Recipient type is auto-set based on building type but can be manually changed for Rental buildings

---

### 4. **meetings**
Meeting records (agendas and minutes).

```typescript
{
  id: number (primary key, auto-increment)
  building_id: number (foreign key → buildings.id)
  title: string
  meeting_date: date
  location: string | null
  start_time: time | null
  meeting_type: string | null (e.g., "Council Meeting", "AGM", "SGM")
  strata_plan_number: string | null
  status: 'working_agenda' | 'agenda' | 'working_minutes' | 'minutes'
  audio_file: any | null (binary/JSONB)
  audio_filename: string | null
  audio_duration: number | null (seconds)
  recording_started_at: timestamp | null
  recording_ended_at: timestamp | null
  attendees: any | null (JSONB array of attendee objects)
  is_incamera: boolean | null
  created_at: timestamp
  updated_at: timestamp
  finalized_at: timestamp | null
}
```

**Purpose**: Core meeting entity. Status flow: `working_agenda` → `agenda` → `working_minutes` → `minutes` (finalized).

**In-Camera Meetings**:
- `is_incamera`: Boolean flag to mark entire meeting as confidential/in-camera
- When enabled, meeting is marked as confidential
- Toggle available in meeting view header (only when meeting is not finalized)
- Displayed with red badge and warning banner

**Attendees Structure** (JSONB):
```json
[
  {
    "name": "John Doe",
    "email": "john@example.com",
    "role": "Chair",
    "user_id": 123,
    "present": true
  }
]
```

**Attendee Fields**:
- `name`: Required string - Attendee's full name
- `email`: Optional string - Attendee's email address
- `role`: Optional string - Attendee's role (e.g., "Chair", "Secretary", "Member", "Treasurer")
- `user_id`: Optional number - Reference to user in `users` table (if attendee is a system user)
- `present`: Boolean - Whether attendee was present at the meeting

---

### 5. **sections**
Meeting sections (organizational structure).

```typescript
{
  id: number (primary key, auto-increment)
  meeting_id: number (foreign key → meetings.id)
  title: string
  order_index: number
  created_at: timestamp
  updated_at: timestamp
}
```

**Purpose**: Organizes topics into sections (e.g., "Call to Order", "New Business", "Adjournment").

---

### 6. **topics**
Individual discussion topics within meetings.

```typescript
{
  id: number (primary key, auto-increment)
  meeting_id: number (foreign key → meetings.id)
  section_id: number | null (foreign key → sections.id)
  title: string
  description: string | null
  order_index: number
  rolled_over_from_topic_id: number | null (self-referential foreign key)
  is_incamera: boolean | null
  incamera_start_time: timestamp | null
  incamera_end_time: timestamp | null
  created_at: timestamp
  updated_at: timestamp
}
```

**Purpose**: Individual agenda items/topics. Can be rolled over from previous meetings via `rolled_over_from_topic_id`.

**In-Camera Topics**:
- `is_incamera`: Boolean flag to mark topic as confidential/in-camera
- `incamera_start_time`: Timestamp when topic went in-camera
- `incamera_end_time`: Timestamp when topic ended in-camera mode
- When enabled, topic content is hidden in published agendas and minutes
- Only "This topic is in-camera" notice is shown in PDF generation
- Toggle available during meeting (working_minutes or minutes status)
- Displayed with red badge and warning banner in topic card

---

### 7. **notes**
Notes attached to topics.

```typescript
{
  id: number (primary key, auto-increment)
  topic_id: number (foreign key → topics.id)
  content: string
  created_by: number | null (foreign key → users.id)
  created_at: timestamp
}
```

**Purpose**: Stores notes/discussion points for each topic.

---

### 8. **tasks**
Action items/tasks from topics.

```typescript
{
  id: number (primary key, auto-increment)
  topic_id: number (foreign key → topics.id)
  description: string
  assigned_name: string | null
  assigned_email: string | null
  assignees: any | null (JSONB array of assignee objects)
  due_date: date | null
  status: 'open' | 'in_progress' | 'completed' | 'blocked'
  external_update_token: string | null
  token_expires_at: timestamp | null
  created_by: number | null (foreign key → users.id)
  created_at: timestamp
  updated_at: timestamp
  completed_at: timestamp | null
}
```

**Purpose**: Tracks action items. Supports multiple assignees via JSONB array.

**Status Options**:
- `open`: Task is newly created
- `in_progress`: Task is being worked on
- `completed`: Task is finished
- `blocked`: Task is blocked and cannot proceed

**Note**: The database schema currently defines status as `'open' | 'in_progress' | 'completed'`, but the application supports `'blocked'` status in the UI. Ensure the database enum includes all four statuses.

**Assignees Structure** (JSONB):
```json
[
  {
    "name": "Jane Smith",
    "email": "jane@example.com",
    "present": true
  }
]
```

---

### 9. **decisions**
Decisions/motions recorded for topics with threading support.

```typescript
{
  id: number (primary key, auto-increment)
  topic_id: number (foreign key → topics.id)
  motion_text: string
  result: 'moved' | 'seconded' | 'carried' | 'defeated' | 'deferred' | null
  votes_for: number | null
  votes_against: number | null
  votes_abstain: number | null
  parent_decision_id: number | null (foreign key → decisions.id, self-referential for threading)
  recorded_by: number | null (foreign key → users.id)
  recorded_at: timestamp
  edited_at: timestamp | null (tracks when decision was last edited)
}
```

**Purpose**: Records formal decisions, motions, and voting results with support for threaded discussions.

**Decision Result Options**:
- Companies can customize decision result options via `default_decision_results` field
- Options are used in decision modal dropdown
- Default options: "M/S/C", "Defeated", "Deferred"
- Customizable in EditCompanyModal

**Decision Threading**:
- `parent_decision_id`: Links child decisions to parent decisions for threaded discussions
- Allows for follow-up motions and amendments to be connected
- UI displays threaded decisions hierarchically in TopicCard
- Edit/delete functionality available for decisions
- Threading icon displayed for child decisions

**Decision Features**:
- **@ Mention Autocomplete**: Type `@` to mention meeting attendees by name
- **# GeniusWords Autocomplete**: Type `#` to insert user-defined shortcuts
- **Edit Mode**: Modify existing decisions with edit history tracking
- **Threading Mode**: Add child decisions to create discussion threads

---

### 10. **task_notes**
Notes attached to individual tasks (separate from topic notes).

```typescript
{
  id: number (primary key, auto-increment)
  task_id: number (foreign key → tasks.id)
  content: string
  created_by: number | null (foreign key → users.id)
  created_at: timestamp
}
```

**Purpose**: Allows users to add notes and updates to specific tasks, tracking progress and communication.

---

### 11. **minutes_templates**
Customizable templates for generating minutes PDFs.

```typescript
{
  id: number (primary key, auto-increment)
  building_id: number (foreign key → buildings.id)
  blocks: any (JSONB - Template configuration)
  created_at: timestamp
  updated_at: timestamp
}
```

**Purpose**: Stores customizable templates for PDF minutes generation. Each building can have its own template configuration.

**Template Structure** (JSONB):
```json
{
  "sections": [
    {
      "id": "header",
      "label": "Header",
      "icon": "📋",
      "backgroundColor": "#f8fafc",
      "fields": [
        {
          "id": "building_name",
          "label": "Building Name",
          "visible": true,
          "order": 1
        }
      ]
    }
  ]
}
```

**Template Sections**:
- `header`: Building name, meeting type, date, time, location, strata plan
- `attendees`: Name, role, and present/absent status for each attendee
- `topics`: Discussion topics with descriptions, notes, tasks, and decisions
- `decisions`: Motions, results, vote counts
- `footer`: Adjournment, signatures, next meeting date

---

### 12. **user_buildings**
Junction table linking users to buildings (many-to-many relationship).

```typescript
{
  user_id: number (foreign key → users.id)
  building_id: number (foreign key → buildings.id)
}
```

**Purpose**: Establishes many-to-many relationship between users and buildings. Used to assign users to specific buildings they can access. Property managers see buildings via `manager_id` in buildings table, while regular users see buildings via this junction table.

**Usage**:
- When a user is assigned to a building, a record is created in this table
- Dashboard filters buildings for regular users based on entries in this table
- Admin panel allows assigning/removing users from buildings

---

### 13. **building_documents**
Stores documents associated with buildings for AI analysis and reference.

```typescript
{
  id: number (primary key, auto-increment)
  building_id: number (foreign key → buildings.id)
  document_type: string (e.g., "rules", "bylaws", "policies")
  filename: string
  file_url: string (URL to file in Supabase storage)
  file_size: number (bytes)
  mime_type: string (e.g., "application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
  created_at: timestamp
  updated_at: timestamp
}
```

**Purpose**: Stores building-related documents (rules, bylaws, policies) that can be extracted and used for AI analysis of meeting topics.

**Storage**:
- Files are stored in Supabase Storage bucket: `building-documents`
- File path format: `{building_id}/{timestamp}_{filename}`
- Supported file types: PDF, DOC, DOCX, plain text
- Maximum file size: 10MB

**Usage**:
- Documents are uploaded via BuildingDetailsModal → Documents tab
- Documents are extracted using `documentExtractor.ts` utility
- Extracted text is sent to AI analysis webhook for topic analysis

---

### 14. **ai_analyses**
Stores AI analysis results for topics.

```typescript
{
  id: number (primary key, auto-increment)
  topic_id: number | null (foreign key → topics.id)
  task_id: number | null (foreign key → tasks.id)  // Legacy field, may be null
  analysis_result: string (JSON or text)
  created_at: timestamp
}
```

**Purpose**: Stores AI-generated analysis results for meeting topics. Analysis is performed by external n8n webhook that processes topic descriptions along with extracted building documents.

**Usage**:
- AI analysis is triggered from TopicCard
- Analysis includes topic description and extracted building documents
- Results are stored and displayed in the topic card
- Webhook URL: `https://rulesengine.asccreative.com/webhook/843afc5f-abe0-4bb4-bb9f-369d2657c4d0`

---

### 15. **task_attachments**
Stores file attachments for tasks.

```typescript
{
  id: number (primary key, auto-increment)
  task_id: number (foreign key → tasks.id)
  filename: string
  file_url: string (URL to file in Supabase storage)
  file_size: number (bytes)
  mime_type: string (e.g., "application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "text/plain", "image/*")
  uploaded_by: number | null (foreign key → users.id)
  created_at: timestamp
  updated_at: timestamp
}
```

**Purpose**: Stores file attachments uploaded to tasks. Attachments can be PDF, DOCX, TXT, or image files. Text from attachments is extracted and used for AI analysis.

**Storage**:
- Files are stored in Supabase Storage bucket: `task-attachments`
- File path format: `{task_id}/{timestamp}_{filename}`
- Maximum file size: 10MB
- Supports: PDF, DOC, DOCX, TXT, and image files

**Usage**:
- Attachments are uploaded via TaskDetailsModal
- Attachments are extracted using `documentExtractor.ts` utility
- Extracted text from attachments is included in AI analysis for tasks
- Extracted text is sent to AI analysis webhook for task analysis

---

### 16. **task_analyses**
Stores AI analysis results specifically for tasks.

```typescript
{
  id: number (primary key, auto-increment)
  task_id: number (foreign key → tasks.id)
  task_description: string
  analysis_result: string (JSON or text)
  created_at: timestamp
}
```

**Purpose**: Stores AI-generated analysis results for tasks. Analysis is performed by external n8n webhook that processes task descriptions along with extracted building documents and task attachments.

**Usage**:
- AI analysis is triggered from TaskDetailsModal
- Analysis includes task description, building documents, and task attachments
- Results are stored and displayed in the task details modal
- Webhook URL: `https://rulesengine.asccreative.com/webhook/ac3f411b-401a-4a97-ae07-f241dbc2d1ed`

---

### 17. **topic_attachments**
Stores file attachments for topics.

```typescript
{
  id: number (primary key, auto-increment)
  topic_id: number (foreign key → topics.id)
  filename: string
  file_url: string (URL to file in Supabase storage)
  file_size: number (bytes)
  mime_type: string (e.g., "application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "text/plain", "image/*")
  uploaded_by: number | null (foreign key → users.id)
  created_at: timestamp
  updated_at: timestamp
}
```

**Purpose**: Stores file attachments uploaded to topics. Attachments can be PDF, DOCX, TXT, or image files. Text from attachments is extracted and used for AI analysis.

**Storage**:
- Files are stored in Supabase Storage bucket: `topic-attachments`
- File path format: `{topic_id}/{timestamp}_{filename}`
- Maximum file size: 10MB
- Supports: PDF, DOC, DOCX, TXT, and image files

**Usage**:
- Attachments are uploaded via TopicCard (when expanded)
- Attachments are extracted using `fetchAndExtractTopicAttachments()` from `documentExtractor.ts`
- Extracted text from attachments is included in AI analysis for topics
- Topic AI analysis now includes both building documents AND topic attachments

---

### 18. **building_document_urls**
Stores reference URLs (links) associated with buildings.

```typescript
{
  id: number (primary key, auto-increment)
  building_id: number (foreign key → buildings.id)
  document_type: string (e.g., "legislation", "policy", "reference", "other")
  url: string (the actual URL/link)
  title: string (display name for the URL)
  description: string | null (optional description)
  created_at: timestamp
}
```

**Purpose**: Stores reference URLs (links) for buildings, separate from uploaded document files. Useful for linking to external legislation, policies, or reference materials.

**Usage**:
- URLs are added via BuildingDetailsModal → Documents tab → Reference URLs section
- URLs are displayed alongside uploaded documents
- Different document types: legislation, policy, reference, other
- URLs can be opened in new tab for reference

---

### 19. **genius_words**
Stores user-specific text shortcuts (GeniusWords) for quick insertion of commonly used phrases.

```typescript
{
  id: number (primary key, auto-increment)
  user_id: number (foreign key → users.id)
  shortcode: string (must start with #, e.g., "#QuoteReq")
  description: string (the full text that replaces the shortcode)
  created_by: number | null (foreign key → users.id)
  created_at: timestamp
}
```

**Purpose**: Allows users to create personal shortcuts that expand to full text descriptions. Shortcuts work across all text inputs in the system (topics, tasks, notes, decisions).

**Usage**:
- Users create shortcuts via GeniusWordsManager screen
- Shortcodes must start with `#` and cannot contain spaces
- When typing `#` followed by a shortcode in any text field, autocomplete suggestions appear
- Selecting a suggestion replaces the shortcode with the full description
- Available in: decision modal, note modal, task modal, topic descriptions
- Each user has their own collection of GeniusWords

**Features**:
- Autocomplete dropdown with keyboard navigation (Arrow keys, Enter, Escape)
- Search functionality in GeniusWordsManager
- Edit and delete shortcuts
- User-specific (each user sees only their own shortcuts)

---

### 20. **meeting_transcripts**
Stores meeting transcript files and AI-extracted tasks.

```typescript
{
  id: number (primary key, auto-increment)
  meeting_id: number (foreign key → meetings.id)
  filename: string
  file_url: string (URL to file in Supabase storage)
  file_size: number (bytes)
  mime_type: string (e.g., "text/plain", "application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
  parsed_json: any (JSONB - Contains extracted tasks array)
  tasks_created_count: number (Number of tasks actually created from this transcript)
  uploaded_by: number | null (foreign key → users.id)
  created_at: timestamp
  updated_at: timestamp
}
```

**Purpose**: Stores meeting transcript files uploaded by users, along with AI-extracted tasks from Google Gemini.

**Storage**:
- Files are stored in Supabase Storage bucket: `meeting-transcripts`
- File path format: `{meeting_id}/{timestamp}_{filename}`
- Supported file types: TXT, PDF, DOCX
- Maximum file size: 10MB

**AI Task Extraction**:
- Uses Google Gemini AI (models/gemini-2.5-flash) to analyze transcript text
- Automatically extracts action items, tasks, and follow-ups
- For each task, AI provides:
  - `description`: Clear, actionable task description
  - `assigned_name`: Person assigned (if mentioned in transcript)
  - `due_date`: Due date in YYYY-MM-DD format (if mentioned)
  - `confidence`: AI confidence score (0-1, filtered to >= 0.5)
- Tasks stored in `parsed_json` field as JSON array
- Users review and approve tasks before they are created in the system

**Workflow**:
1. User uploads transcript file (TXT, PDF, or DOCX)
2. System extracts text using documentExtractor
3. Text sent to Google Gemini AI for task extraction
4. AI returns array of potential tasks with metadata
5. Transcript record saved with extracted tasks in `parsed_json`
6. User reviews extracted tasks in preview modal
7. User can edit task details and assign to topics
8. User approves tasks for creation
9. Tasks inserted into `tasks` table
10. `tasks_created_count` updated on transcript record

**Usage**:
- Upload via "Upload Transcript" button in meeting view (working_agenda status)
- View all uploaded transcripts via "View Transcripts" button
- Download or view transcript files
- Track how many tasks were created from each transcript

---

## User Types & Permissions System

The system uses a centralized permission checking system located in `lib/permissions.ts`.

### User Type Hierarchy

1. **master** (System Administrator)
   - Full access to everything across all companies
   - Can manage all companies, users, buildings
   - Can see all data
   - Sees default Meeting Genius logo in dashboard

2. **corporate_administrator** (Corporate Administrator)
   - Manages multiple property managers within their company
   - Can create/edit users, buildings, meetings
   - Can access admin panel
   - Sees only data within their company
   - Sees company logo in dashboard (if configured)

3. **property_manager** (Property Manager)
   - Manages buildings and meetings within their company
   - Can create/edit users, buildings, meetings
   - Can access admin panel
   - Sees only their assigned buildings
   - Sees company logo in dashboard (if configured)

4. **user** (Standard User)
   - Basic access to assigned buildings
   - Can view and edit meetings (not create)
   - Cannot access admin panel
   - Sees company logo in dashboard (if configured)

5. **owner** (Property Owner)
   - Similar permissions to standard users
   - Access to assigned buildings and meetings
   - Can view and edit meetings
   - Can update task status
   - Cannot create meetings or access admin panel
   - Sees company logo in dashboard (if configured)
   - Receives meeting notices via email

6. **resident** (Housing Co-op Resident)
   - Similar permissions to standard users and owners
   - Used specifically for Housing Co-op building types
   - Access to assigned buildings and meetings
   - Can view and edit meetings
   - Can update task status
   - Cannot create meetings or access admin panel
   - Sees company logo in dashboard (if configured)
   - Receives meeting notices via email

7. **vendor** (Vendor/Contractor)
   - Receives and updates assigned tasks
   - Can view meetings (read-only)
   - Can update task status for tasks assigned to them
   - Auto-redirected to dashboard on login
   - Sees company logo in dashboard (if configured)

8. **attendee** (Meeting Attendee)
   - View-only access to meetings they attend
   - Cannot edit anything
   - Cannot access admin panel
   - Auto-redirected to dashboard on login
   - Sees company logo in dashboard (if configured)

### Permission Functions

All permission checks are centralized in `lib/permissions.ts`:

- `canAccessAdmin(userType)`: Can access admin panel
- `canManageCompanies(userType)`: Can create/edit/delete companies
- `canCreateUser(userType)`: Can create new users
- `canCreateBuilding(userType)`: Can create new buildings
- `canCreateMeeting(userType)`: Can create meetings
- `canEditMeeting(userType)`: Can edit meetings
- `canManageAllBuildings(userType)`: Can see all buildings (master only)
- `canManageAllUsers(userType)`: Can see all users (master only)
- `canManageCompanyData(userType)`: Can see all company data
- `canAssignTasks(userType)`: Can assign tasks to others
- `isReadOnly(userType)`: Is read-only (attendees)
- `canUpdateTaskStatus(userType)`: Can update task status
- `canManageVendors(userType)`: Can manage vendors
- `shouldFilterByCompany(userType)`: Should filter data by company

---

## Key Features

### 1. **Meeting Management**
- Create meetings with customizable types and sections
- Four status states: working_agenda → agenda → working_minutes → minutes
- Drag-and-drop reordering of sections and topics
- Meeting rollover: copy topics and tasks from previous meetings
- **Attendee management** with presence tracking and role assignment
  - Add/edit/remove attendees during agenda phase
  - Assign roles to attendees (e.g., "Chair", "Secretary", "Member")
  - Track presence during meeting minutes phase
  - Roles displayed in PDF minutes generation
- **In-Camera (Confidential) Meetings**: 
  - Mark entire meetings or individual topics as confidential/in-camera
  - Visual indicators with lock icons for confidential content
  - Toggle in-camera status during working_agenda and working_minutes phases
  - Warning banners displayed for confidential meetings
- **Send Meeting Notices**:
  - One-click email distribution of meeting agendas to all building owners/residents
  - Beautiful HTML-formatted email templates with responsive design
  - Includes meeting details, date, time, location, and full agenda with sections/topics
  - Automatically filters recipients by user type (owner or resident) based on building settings
  - Available during working_agenda and agenda phases
- **In-Camera (Confidential) Meetings**
  - Mark entire meetings as in-camera/confidential
  - Toggle available in meeting view header
  - Displayed with red badge and warning banner
  - All content treated as confidential
- **In-Camera Topics**
  - Mark individual topics as in-camera during meeting
  - Track in-camera start and end times
  - Content hidden in published agendas and minutes PDFs
  - Only "This topic is in-camera" notice shown in PDFs
  - Toggle available in TopicCard during meeting (working_minutes/minutes status)

### 2. **Topic & Section Management**
- Organize topics into sections
- Add descriptions to topics
- Track rollover history (which topic came from which previous meeting)
- Drag-and-drop reordering

### 3. **Task Management**
- Create tasks from topics
- Assign to multiple people (from meeting attendees or manual entry)
- Track status: open → in_progress → completed → blocked
- Due date tracking
- External update tokens for vendor access
- Task notes: Add notes and updates to individual tasks
- Task details modal: View full task information with notes history

### 4. **Decision Recording & Threading**
- Record motions/resolutions
- Track voting results (for, against, abstain)
- Company-specific decision result options (customizable in EditCompanyModal)
- Link decisions to topics
- Decision result dropdown uses company's `default_decision_results` configuration
- **@ Mention Autocomplete**: Type `@` to mention meeting attendees by name
- **# GeniusWords Autocomplete**: Type `#` to insert user-defined shortcuts
- Both autocomplete features work in the motion text field with keyboard navigation
- **Decision Threading**: Create child decisions linked to parent decisions for follow-up motions
- **Edit Decisions**: Modify existing decisions with edit history tracking (`edited_at` field)
- **Delete Decisions**: Remove decisions (with confirmation)
- **Hierarchical Display**: Threaded decisions displayed with visual indentation and icons
- **Decision History**: Track when decisions are created and edited

### 5. **Notes System**
- Add notes to topics
- Track who created each note
- Timestamp tracking

### 6. **Admin Panel**
- **User Management**:
  - Create users with company and building assignment
  - Assign users to property managers via `assigned_pm_id`
  - Assign users to buildings via `user_buildings` junction table
  - Filter users by type, company, building
  - Inline user creation from BuildingDetailsModal and CompanyDetailsModal
  - **Bulk Import Users**: Import users from CSV per building (ImportUsersModal + `csvParser`)
- **Building Management**:
  - Create buildings with property manager assignment
  - Edit building details (name, address, type, manager)
  - Assign/unassign users to buildings
  - Inline user creation when assigning to buildings
  - View building users and metadata
  - **Document Management**: Upload, view, and delete building documents (PDF, DOC, DOCX)
    - Documents stored in Supabase Storage
    - Documents categorized by type (rules, bylaws, policies, etc.)
    - Documents used for AI analysis of meeting topics
  - **Notification Settings**: Configure meeting notification preferences
    - Set days before board meetings to send notices (default: 7)
    - Set days before general meetings to send notices (default: 7)
    - Configure notification recipient type (owner/resident)
    - Auto-configured based on building type
    - Quick presets for common notification schedules
  - **Reference URLs**: Add, view, and delete reference URLs for buildings
    - Separate from uploaded documents
    - Types: legislation, policy, reference, other
    - Displayed alongside uploaded documents in Documents tab
- **Company Management**:
  - Create companies with default configurations
  - Edit company details and defaults (meeting sections, types, decision results)
  - Configure SMTP email settings per company
  - View company statistics (users, buildings, admins)
  - Manage buildings within company (create, delete)
  - Manage users within company (create, filter, delete)
  - Manage corporate administrators
  - Inline creation of property managers, users, and administrators
  - **Company Logo Management**: Upload, view, and delete company logos
    - Logo appears in dashboard header for all company users
    - Stored in Supabase Storage (`company-logos` bucket)
    - Supports PNG, JPG, SVG (max 2MB)
    - Managed in CompanyDetailsModal → Logo tab
- **Document Management**: Upload/view building documents
- **Minutes Templates Management**: Customize PDF minutes templates per building (MinutesTemplatesTab)
- **Agenda Templates Management**: Customize PDF agenda templates per building (AgendaTemplatesTab)

### 7. **Multi-Tenancy**
- Company-level isolation
- Building-level organization
- User-level access control
- Default configurations per company

### 8. **Dashboard**
- View all meetings across buildings
- Filter by building and meeting type
- View all tasks
- Search functionality
- Meeting status indicators

### 9. **PDF Minutes Generation**
- Generate professional PDF minutes from finalized meetings
- Customizable templates per building (template editor in admin panel)
- Includes all meeting data: header, attendees, topics, notes, tasks, decisions
- Building or company logo in PDF header (building preferred, then company)
- Renders via off-screen iframe; html2canvas + jsPDF for multi-page PDF
- Available when meeting status is "minutes" (finalized)

### 10. **Email Configuration & Sending**
- **SMTP Configuration**: Companies can configure their own SMTP settings
  - Managed in CompanyDetailsModal → Overview tab
  - Settings include: host, port, username, password, from name/email, TLS
- **Email API**: `/api/send-email` endpoint for sending emails
  - Uses company's SMTP configuration
  - Verifies SMTP connection before sending
  - Supports HTML and plain text emails
  - Used for task assignments and notifications
- **Company-Level Email**: Each company has independent email configuration
- **Meeting Notice Emails**: Send formatted meeting agendas to owners/residents
  - Beautiful HTML-formatted emails with responsive design
  - Includes meeting header, details grid, full agenda with sections and topics
  - Professional styling with gradients, icons, and mobile responsiveness
  - Automatically sent to all owners or residents assigned to the building
  - Available via "Send Notice" button in meeting view
  - Filters recipients based on user_type ('owner' or 'resident')

### 11. **GeniusWords - User Text Shortcuts**
- **Personal Shortcuts**: Users can create custom shortcuts (starting with `#`) that expand to full text
- **Universal Usage**: Shortcuts work in all text inputs (topics, tasks, notes, decisions)
- **Autocomplete Integration**: Type `#` followed by shortcode to see suggestions
- **Management Interface**: Dedicated GeniusWordsManager screen for creating, editing, and deleting shortcuts
- **User-Specific**: Each user has their own collection of shortcuts
- **Keyboard Navigation**: Arrow keys to navigate, Enter to select, Escape to close
- **Validation**: Shortcodes must start with `#` and cannot contain spaces
- **Search**: Filter shortcuts by shortcode or description in manager interface
- **Components**: `GeniusWordsManager` for management, `GeniusWordsInput` reusable component

### 12. **Meeting Transcript Upload & AI Task Extraction**
- **Transcript Upload**: Upload meeting transcripts in TXT, PDF, or DOCX format (max 10MB)
- **AI-Powered Task Extraction**: Google Gemini AI automatically analyzes transcripts and extracts action items
- **Intelligent Recognition**: AI identifies tasks, assignees, due dates, and provides confidence scores
- **Task Preview & Editing**: Review extracted tasks before creation, edit descriptions, assignees, and due dates
- **Topic Assignment**: Assign each extracted task to specific meeting topics
- **Batch Task Creation**: Create multiple tasks at once from approved transcript tasks
- **Transcript History**: View all uploaded transcripts for a meeting with task creation counts
- **File Management**: Download or view transcript files directly from the system
- **Storage**: Transcripts stored in Supabase Storage (`meeting-transcripts` bucket)
- **Components**: 
  - `UploadTranscriptModal`: Upload transcript files
  - `PreviewTasksModal`: Review and edit AI-extracted tasks before creation
  - `ViewTranscriptsModal`: View all transcripts uploaded to a meeting
- **API Endpoints**:
  - `/api/transcripts/upload`: Upload and process transcript files
  - `/api/transcripts/list`: List all transcripts for a meeting
  - `/api/transcripts/create-tasks`: Batch create approved tasks
- **AI Model**: Uses Google Gemini 2.5 Flash for fast, accurate task extraction
- **Confidence Filtering**: Only tasks with 50%+ confidence are shown to users

### 13. **Document Management & AI Analysis**
- **Document Upload & Storage**:
  - Upload building documents via BuildingDetailsModal → Documents tab
  - Supports PDF, DOC, DOCX, and plain text files
  - Files stored in Supabase Storage (`building-documents` bucket)
  - Maximum file size: 10MB
  - Documents categorized by type (rules, bylaws, policies, etc.)
- **Reference URLs**:
  - Add reference URLs (links) to buildings via BuildingDetailsModal → Documents tab
  - Separate from uploaded document files
  - Types: legislation, policy, reference, other
  - Displayed alongside uploaded documents
  - URLs can be opened in new tab for reference
- **Document Text Extraction**:
  - `lib/documentExtractor.ts` utility extracts text from documents
  - Generic `extractTextFromFile()` function handles multiple file types
  - Supports PDF (react-pdftotext), DOCX (mammoth), plain text, and images
  - Image files return placeholder text (OCR can be added later)
  - Extracted text used for AI analysis context
    - Functions:
    - `fetchAndExtractBuildingDocuments(buildingId)`: Extracts text from building documents
    - `fetchAndExtractTaskAttachments(taskId)`: Extracts text from task attachments
    - `fetchAndExtractTopicAttachments(topicId)`: Extracts text from topic attachments
- **AI Analysis Integration**:
  - **Topic AI Analysis**:
    - Available in TopicCard "Analyze with AI" button
    - Sends topic description, extracted building documents, AND topic attachments to n8n webhook
    - Webhook URL: `https://rulesengine.asccreative.com/webhook/843afc5f-abe0-4bb4-bb9f-369d2657c4d0`
    - Analysis results stored in `ai_analyses` table
    - Results displayed in topic card with expandable view
  - **Task AI Analysis**:
    - Available in TaskDetailsModal "Analyze with AI" button
    - Sends task description, building documents, and task attachments to n8n webhook
    - Webhook URL: `https://rulesengine.asccreative.com/webhook/ac3f411b-401a-4a97-ae07-f241dbc2d1ed`
    - Analysis results stored in `task_analyses` table
    - Results displayed in task details modal
  - **Task Attachments**:
  - Users can upload files to tasks via TaskDetailsModal
  - Supports PDF, DOC, DOCX, TXT, and image files (max 10MB)
  - Files stored in Supabase Storage (`task-attachments` bucket)
  - Attachments can be viewed, downloaded, and deleted
  - Attachment text is extracted and included in task AI analysis
- **Topic Attachments**:
  - Users can upload files to topics via TopicCard (when expanded)
  - Supports PDF, DOC, DOCX, TXT, and image files (max 10MB)
  - Files stored in Supabase Storage (`topic-attachments` bucket)
  - Attachments can be viewed, downloaded, and deleted
  - Attachment text is extracted and included in topic AI analysis
  - Topic attachments displayed in expandable section within TopicCard

- **Workflows**:
  - **Topic AI Analysis**:
    1. User uploads documents to building via Documents tab (optional)
    2. User adds description to topic
    3. User optionally uploads attachments to topic
    4. User clicks "Analyze with AI" button in TopicCard
    5. System extracts text from all building documents (if any)
    6. System extracts text from all topic attachments (if any)
    7. System sends topic + building documents + topic attachments to n8n webhook
    8. AI processes and returns analysis
    9. Analysis stored in `ai_analyses` table and displayed in topic card
  - **Task AI Analysis**:
    1. User uploads documents to building via Documents tab
    2. User creates task and optionally uploads attachments
    3. User clicks "Analyze with AI" button in TaskDetailsModal
    4. System extracts text from building documents and task attachments
    5. System sends task + documents + attachments to n8n webhook
    6. AI processes and returns analysis
    7. Analysis stored in `task_analyses` table and displayed in task modal

---

## Component Architecture

### Main Application Flow

```
app/page.tsx (Root)
├── LoginForm (if not authenticated)
└── Main App (if authenticated)
    ├── Dashboard
    ├── MeetingView
    └── AdminPanel
```

### Key Components

#### **Core Components**

1. **`app/page.tsx`**
   - Main entry point
   - Handles authentication state
   - Routes between Dashboard, MeetingView, and AdminPanel
   - Manages modal states (Task, Note, Decision, CreateMeeting)
   - **Topic refresh callback system**: Stores callbacks from TopicCard to refresh history after modal saves
   - **Auto-redirect logic**: Redirects attendee and vendor user types to dashboard on login

2. **`components/dashboard.tsx`**
   - Lists all meetings and tasks
   - Building and meeting type filters
   - Search functionality
   - Meeting status display
   - Edit/delete meeting actions
   - **Company logo display**: Shows company logo in header (or default Meeting Genius logo for master users)

3. **`components/meeting-view.tsx`**
   - Main meeting interface
   - Displays sections and topics
   - Drag-and-drop reordering
  - Timer functionality
  - Status progression controls
  - Attendee management
  - Section/topic creation modals
  - In-camera toggle button (marks meeting as confidential)
  - Send Notice button (emails agenda to owners/residents)
  - **UnifiedItemModal**: Single modal with tabs for Tasks, Notes, and Decisions (per topic)
  - SelectRecorderModal (select recorder/device for meeting audio)
  - Upload Transcript button (upload meeting transcripts for AI task extraction)
  - View Transcripts button (view all uploaded transcripts)
  - Generate Agenda PDF button (during working_agenda/agenda phases)
  - Generate Minutes PDF button (when status is "minutes")
   - **Improved button layout**: All action buttons in single row with consistent sizing (h-8, px-3, text-xs)
   - **In-camera meeting toggle**: Mark entire meeting as confidential
   - **Header layout**: Back button, title, badges, and edit button properly aligned without overlap

4. **`components/admin-panel.tsx`**
   - Admin interface with tabs: Users, Buildings, Companies, Minutes Templates, Agenda Templates
   - Opens **BuildingDetailsModal** when clicking a building (main building management)
   - Modal management for CRUD (CreateUserModal, CreateBuildingModal, CreateCompanyModal, etc.)

5. **`app/task-update/[token]/page.tsx`**
   - **External task update page** – public route for vendors/assignees to update a task by token (no login)
   - Validates `external_update_token` and `token_expires_at` from `tasks` table
   - Allows updating task status, adding notes, uploading/deleting attachments
   - Link format: `/task-update/{token}` (token sent in task assignment email)

#### **Modal Components**

- `components/create-meeting-modal.tsx`: Create new meetings with rollover support
- `components/EditMeetingModal.tsx`: Edit meeting details
- `components/task-modal.tsx`: Create/edit tasks with GeniusWords support; uses **TaskEmailPreviewModal** to preview/customize task assignment email before sending
- `components/TaskEmailPreviewModal.tsx`: Preview and customize task assignment email (subject, greeting, body, additional notes, button/footer) before sending to assignees
- `components/UnifiedItemModal.tsx`: **Unified topic items modal** – single modal with tabs for Tasks, Notes, and Decisions (used from meeting-view for a topic)
- `components/TaskDetailsModal.tsx`: **Enhanced task details modal** with:
  - View task details (description, status, assignees, due date)
  - Task notes management (view, add notes)
  - **Task attachment upload/download/delete**
  - **AI analysis integration** (analyze task with building documents and attachments)
  - Status updates (open, in_progress, completed, blocked)
  - Delete task functionality
- `components/note-modal.tsx`: Add/edit notes with GeniusWords support
- `components/decision-modal.tsx`: **Enhanced decision modal** with:
  - Create new decisions
  - Edit existing decisions (edit mode)
  - Create threaded child decisions (threading mode)
  - @ mention autocomplete for meeting attendees
  - # GeniusWords autocomplete for user shortcuts
  - Company-specific decision result options
  - Vote tracking (for, against, abstain)
  - Parent decision display when threading
- `components/GeniusWordsManager.tsx`: Manage user's text shortcuts (create, edit, delete, search)
- `components/GeniusWordsInput.tsx`: Reusable input component with GeniusWords autocomplete support
- `components/create-section-modal.tsx`: Create sections
- `components/create-topic-modal.tsx`: Create topics with GeniusWords support
- `components/AttendeeManagement.tsx`: Manage meeting attendees with role assignment and presence tracking
- `components/GenerateMinutesButton.tsx`: Generate PDF minutes from finalized meetings (template-driven, building/company logo, iframe + html2canvas + jsPDF)
- `components/ProfileSettingsModal.tsx`: User profile settings (name, email, password)
- `components/SelectRecorderModal.tsx`: Select recorder/device for meeting audio recording
- `components/meetings/RecordingPlayerModal.tsx`: Play meeting recording – play/pause, progress bar, volume, mute, download (uses meeting audio from Supabase Storage)

#### **Layout & Navigation**

- `components/AuthenticatedLayout.tsx`: Wraps content with Header and main container (optional layout for authenticated pages)
- `components/Header.tsx`: App header – logo, brand, and UserNav (or Login link when not authenticated)
- `components/UserNav.tsx`: User dropdown menu – profile, settings, logout (used by Header)

#### **Admin Components** (`components/admin/`)

- `BuildingDetailsModal.tsx`: **Main building modal** (opened from admin Buildings tab when clicking a building). Tabs:
  - **Details Tab**: Edit building name, address, type, and property manager
  - **Users Tab**: Assign/unassign users to building, create new users inline
    - User type auto-set based on building type (owner for Strata/Condo/Rental, user/resident for Housing Co-op)
    - Visual badges for user types (Resident, Owner, Property Manager, etc.)
    - User type selector shows appropriate options based on building type
  - **Documents Tab**: **Full document management** - Upload, view, and delete building documents (PDF, DOC, DOCX)
    - Documents stored in Supabase Storage
    - Documents categorized by type
    - Documents used for AI analysis context
    - **Reference URLs**: Add, view, and delete reference URLs (legislation, policy, reference, other)
    - URLs displayed alongside uploaded documents
  - **Notifications Tab**: **Meeting notification settings**
    - Configure days before board meetings to send notices (default: 7 days, range: 1-90)
    - Configure days before general meetings to send notices (default: 7 days, range: 1-90)
    - Set notification recipient type (owner or resident)
    - Auto-set based on building type (Housing Co-op → resident, Strata/Condo/Rental → owner)
    - Quick presets: Minimal (3/7), Standard (7/14), Extended (14/21), Reset (7/7)
    - Information cards explaining how notifications work
    - Settings saved when building details are saved
- `EditBuildingModal.tsx`: Edit building details (used within BuildingDetailsModal Details tab)
- `CreateUserModal.tsx`: Create users with company and building assignment
- `CreateBuildingModal.tsx`: Create buildings with property manager assignment
- `CreateCompanyModal.tsx`: Create companies
- `EditCompanyModal.tsx`: Edit company details and defaults (meeting sections, types, decision results)
- `CompanyDetailsModal.tsx`: **Enhanced company management modal** with tabs:
  - **Overview Tab**: 
    - Company statistics (users, buildings, admins count)
    - **SMTP Email Configuration**: Configure company email settings (host, port, credentials, TLS)
  - **Buildings Tab**: View all buildings, create buildings inline, create property managers inline, delete buildings
  - **Users Tab**: View all company users with filtering by type, create users inline, delete users
  - **Administrators Tab**: View corporate administrators, create administrators inline, delete administrators
  - **Logo Tab**: Upload, view, and delete company logo
    - Logo appears in dashboard header for company users
    - Stored in Supabase Storage (`company-logos` bucket)
    - Supports PNG, JPG, SVG (max 2MB)
- `UsersTab.tsx`: User management interface with filtering
- `BuildingsTab.tsx`: Building management interface with user assignment
- `CompaniesTab.tsx`: Company management interface with statistics
- `MinutesTemplatesTab.tsx`: **Advanced minutes template designer** (root component imported into Admin Panel)
  - Per-building minutes templates with configurable cover page, info card, section header colors, motion/action/vote colors
  - Drag-and-drop ordering and toggling of fields (date, times, attendees, sections, actions, votes, etc.)
  - Uses real meeting data preview (latest meeting per building) to visualize minutes layout
- `AgendaTemplatesTab.tsx`: **Agenda template designer** (per-building)
  - Configurable cover page elements (logo, title, building name, meeting type, etc.) with free-positioning
  - Info card fields and colors for date/time/location/address/strata plan
  - Uses real meeting data preview for agendas
- `ImportUsersModal.tsx`: Bulk user import from CSV for a building
  - Uses `csvParser` to validate CSV rows (name, email, user_type, password, building info)
  - Shows parse errors by row; preview of users before import
  - Calls `/api/users/bulk-import` to create users, reporting created/skipped counts
- `DocumentManagementModal.tsx`: Upload/view documents
- `ViewDocumentModal.tsx`: View document content
- `AssignUsersToCompanyModal.tsx`: Assign users to companies
- `UserCard.tsx`: Card component for displaying user information
- `BuildingCard.tsx`: Card component for displaying building information
- `CompanyCard.tsx`: Card component for displaying company information
- `LogoTab.tsx`: Company logo management component (upload, delete, preview)

#### **UI Components** (`components/ui/`)

All shadcn/ui style components:
- Button, Card, Dialog, Input, Select, Textarea, Badge, etc.
- Full component library for consistent UI

#### **Card Components**

- `components/meeting-card.tsx`: Meeting display card
- `components/topic-card.tsx`: **Enhanced topic display** with:
  - Expandable/collapsible sections
  - Auto-save description with debounce
  - AI analysis integration with building documents and topic attachments
  - Topic refresh callback registration
  - Topic attachment upload/download/delete
  - GeniusWords support in descriptions
  - Decision display with threading support (hierarchical display)
  - Edit/delete buttons for decisions
  - Add threaded decision functionality
  - History display (notes, tasks, decisions)
  - Visual indicators for saving state
- `components/task-card.tsx`: Task display card with AI analysis integration
- `components/TaskDetailsModal.tsx`: **Enhanced task management** with attachments, AI analysis, and notes
- `components/GeniusWordsManager.tsx`: Full-screen interface for managing user's text shortcuts
- `components/GeniusWordsInput.tsx`: Reusable text input/textarea component with GeniusWords autocomplete
- `components/transcript/upload-transcript-modal.tsx`: Upload meeting transcript files
- `components/transcript/preview-tasks-modal.tsx`: Review and edit AI-extracted tasks
- `components/transcript/view-transcripts-modal.tsx`: View all uploaded transcripts for a meeting

#### **Utility Components**

- `components/timer.tsx`: Meeting timer
- `components/login-form.tsx`: Authentication form
- `components/theme-provider.tsx`: Theme management

---

## Authentication System

### Current Implementation

**Location**: `lib/auth.ts` and `lib/supabase.ts`

**Method**: Custom authentication using localStorage

**Flow**:
1. User enters email and password
2. System queries `users` table by email
3. Password validation (currently simple check - password "123456" for all users)
4. User object stored in localStorage as `current_user`
5. User object includes: `id`, `name`, `email`, `user_type`, `company_id`

### Authentication Functions

- `login(email, password)`: Authenticates user
- `getCurrentUser()`: Retrieves user from localStorage
- `setCurrentUser(user)`: Stores user in localStorage
- `clearCurrentUser()`: Removes user (logout)
- `isLoggedIn()`: Checks if user is logged in

### Password Hashing

- Uses `bcryptjs` for password hashing
- Functions available: `hashPassword()`, `verifyPassword()`
- **Note**: Currently not fully implemented (uses simple password check)

### Session Management

- No server-side sessions
- All authentication state in localStorage
- No automatic token refresh
- Logout clears localStorage

---

## Key Workflows

### 1. **Creating a Meeting**

1. User clicks "New Meeting" button
2. `CreateMeetingModal` opens
3. User selects building, enters meeting details
4. System fetches company defaults (meeting types, sections)
5. User can optionally rollover from previous meeting:
   - Select previous meeting of same type
   - System copies sections and topics
   - Open tasks from previous meeting are included
6. Meeting created with status `working_agenda`
7. Default sections created from company defaults
8. Dashboard refreshes

### 2. **Meeting Status Progression**

```
working_agenda → agenda → working_minutes → minutes
```

- **working_agenda**: Draft agenda being prepared
- **agenda**: Finalized agenda (meeting can start)
- **working_minutes**: Meeting in progress, taking minutes
- **minutes**: Finalized minutes (read-only)

### 3. **Topic Rollover**

1. When creating a new meeting, user can select previous meeting
2. System finds topics from previous meeting
3. Creates new topics with `rolled_over_from_topic_id` set
4. Copies open tasks from previous meeting
5. Links new tasks to new topics

### 4. **Task Assignment**

1. User clicks "Add Task" on a topic
2. `TaskModal` opens
3. System fetches meeting attendees
4. User can:
   - Add assignees from attendees list
   - Manually enter assignee name/email
5. Task created with assignees array (JSONB)
6. Task status: `open`

### 5. **Recording Decisions**

**Creating a New Decision**:
1. User clicks "Record Decision" on a topic
2. `DecisionModal` opens in create mode
3. System fetches company's decision result options
4. System fetches meeting attendees for @ mention autocomplete
5. System fetches user's GeniusWords for # shortcut autocomplete
6. User enters motion text with optional:
   - `@` mentions: Type `@` to autocomplete attendee names
   - `#` shortcuts: Type `#` to autocomplete GeniusWords shortcuts
7. User selects result and enters votes (for, against, abstain)
8. Decision saved to `decisions` table with `recorded_at` timestamp

**Editing an Existing Decision**:
1. User clicks edit button on a decision in TopicCard
2. `DecisionModal` opens in edit mode with `editMode: true`
3. System loads existing decision data (`existingDecisionId`)
4. Modal pre-fills with current decision data
5. User modifies motion text, result, or votes
6. On save, decision is updated with `edited_at` timestamp

**Creating a Threaded Decision**:
1. User clicks thread button on a parent decision in TopicCard
2. `DecisionModal` opens in threading mode with `parentDecisionId` set
3. System loads parent decision for display at top of modal
4. User creates new decision linked to parent via `parent_decision_id` field
5. Child decision saved and displayed hierarchically under parent

**Deleting a Decision**:
1. User clicks delete button on a decision in TopicCard
2. Confirmation prompt appears
3. On confirmation, decision deleted from database
4. Topic history refreshes to remove decision

**Decision Threading Display**:
- Parent decisions displayed normally
- Child decisions indented with `CornerDownRight` icon
- Edit and delete buttons available for all decisions
- Threaded structure maintained in database via `parent_decision_id`

### 6. **User Access Control**

1. User logs in
2. System checks `user_type`, `company_id`, and `assigned_pm_id`
3. Dashboard filters buildings based on:
   - **master**: All buildings
   - **corporate_administrator**: Buildings in their company (`company_id` filter)
   - **property_manager**: Buildings they manage (`manager_id` filter)
   - **user**: Buildings assigned via `user_buildings` junction table
   - **vendor/attendee**: Limited access
4. Admin panel filters users based on:
   - **master**: All users
   - **corporate_administrator**: Users in their company
   - **property_manager**: Users assigned to them (`assigned_pm_id` filter) or themselves

### 7. **Generating PDF Minutes**

1. Meeting must be finalized (status: "minutes")
2. User clicks "Download Minutes PDF" button in meeting view
3. System fetches building's minutes template from `minutes_templates` table
4. If no template exists, uses default template
5. System fetches all meeting data:
   - Meeting details (title, date, type, location, etc.)
   - Meeting in-camera status (`is_incamera`)
   - Attendees (name, email, role, present/absent status)
   - Sections and topics (including topic in-camera status and times)
   - Notes for each topic
   - Tasks for each topic
   - Decisions for each topic
6. **In-Camera Handling**: 
   - If meeting is in-camera, all content is treated as confidential
   - If topic is in-camera, only "This topic is in-camera" notice is shown in PDF
   - In-camera topics show start/end times if recorded
   - Normal topics show full content (description, notes, tasks, decisions)
6. Generates HTML from template and data
7. Creates isolated iframe for rendering
8. Converts HTML to canvas using html2canvas
9. Creates multi-page PDF using jsPDF
10. Downloads PDF with filename: `{meeting_title}_Minutes_{date}.pdf`

### 8. **Task Notes Management**

1. User opens task details modal (from dashboard or meeting view)
2. System displays task information: description, status, assignees, due date
3. User can:
   - View all notes attached to the task
   - Add new notes with timestamp and creator tracking
   - Update task status (open, in_progress, completed, blocked)
4. Notes are stored in `task_notes` table linked to task
5. Each note tracks creator and creation timestamp

### 9. **Building Management Workflow**

1. User opens BuildingDetailsModal from BuildingsTab
2. Modal displays four tabs:
   - **Details Tab**: Edit building name, address, building type, and property manager
   - **Users Tab**: 
     - View all users assigned to the building
     - Select/deselect users from company to assign/unassign
     - Create new users inline (automatically assigned to building and company)
     - User type auto-set based on building type (owner for Strata/Condo/Rental, user for Housing Co-op)
   - **Documents Tab**: Upload, view, and delete building documents and reference URLs
   - **Notifications Tab**: Configure meeting notification settings
     - Set days before board meetings to send notices (default: 7)
     - Set days before general meetings to send notices (default: 7)
     - Set notification recipient type (owner/resident)
     - Auto-set based on building type with manual override for Rental buildings
     - Quick presets available (Minimal, Standard, Extended, Reset)
3. Changes are saved to `buildings` table and `user_buildings` junction table
4. Building users are fetched via join query on `user_buildings` table
5. Notification settings are saved to `buildings` table and used for automated email notifications

### 10. **Company Management Workflow**

1. User opens CompanyDetailsModal from CompaniesTab
2. Modal displays four tabs:
   - **Overview Tab**: 
     - Statistics cards showing total users, corporate admins, and buildings
     - List of all company users
   - **Buildings Tab**:
     - View all buildings in company
     - Create buildings inline with property manager selection
     - Create property managers inline (automatically assigned to company)
     - Delete buildings
   - **Users Tab**:
     - View all company users with filtering by type
     - Create users inline with user type selection
     - Delete users
   - **Administrators Tab**:
     - View corporate administrators
     - Create administrators inline
     - Delete administrators
3. All inline creations automatically assign users to the company
4. Property managers created inline are automatically available for building assignment

### 11. **User-Building Assignment**

1. Users can be assigned to buildings via `user_buildings` junction table
2. Assignment happens in:
   - BuildingDetailsModal → Users tab (select existing users)
   - BuildingDetailsModal → Users tab (create new user inline)
   - CreateUserModal (during user creation)
3. Users see only buildings they're assigned to (unless they're property managers or higher)
4. Property managers see buildings via `buildings.manager_id` relationship
5. Regular users see buildings via `user_buildings` junction table entries

### 12. **Document Upload & Management**

1. User opens BuildingDetailsModal → Documents tab
2. User selects document type (rules, bylaws, policies, etc.)
3. User selects file (PDF, DOC, DOCX, or TXT, max 10MB)
4. File is uploaded to Supabase Storage (`building-documents` bucket)
5. Document metadata is saved to `building_documents` table
6. Document appears in documents list with type badge and download link
7. User can delete documents (removes from storage and database)

### 13. **AI Analysis Workflows**

**Topic AI Analysis**:
1. User adds description to a topic in meeting view
2. User clicks "Analyze with AI" button in TopicCard
3. System fetches building ID from topic's meeting
4. System calls `fetchAndExtractBuildingDocuments(buildingId)`:
   - Fetches all documents for building from `building_documents` table
   - Extracts text from each document using `extractTextFromFile()`
   - Returns array of documents with extracted text
5. System sends POST request to n8n webhook with:
   - Topic ID, title, description
   - Building ID and name
   - Array of extracted building documents
6. n8n webhook processes request and stores analysis in `ai_analyses` table
7. System polls for analysis result from `ai_analyses` table
8. Analysis result displayed in expandable section in TopicCard

**Task AI Analysis**:
1. User creates task and optionally uploads attachments
2. User opens TaskDetailsModal and clicks "Analyze with AI" button
3. System fetches building ID from task → topic → meeting → building
4. System calls `fetchAndExtractBuildingDocuments(buildingId)` for building documents
5. System calls `fetchAndExtractTaskAttachments(taskId)` for task attachments:
   - Fetches all attachments for task from `task_attachments` table
   - Extracts text from each attachment using `extractTextFromFile()`
   - Returns array of attachments with extracted text
6. System sends POST request to n8n webhook with:
   - Task ID, description
   - Building ID and name
   - Array of extracted building documents
   - Array of extracted task attachments
7. n8n webhook processes request and stores analysis in `task_analyses` table
8. System fetches analysis result from `task_analyses` table
9. Analysis result displayed in TaskDetailsModal

### 14. **Topic Refresh Callback System (Auto-Reload Fix)**

1. TopicCard registers a refresh callback via `onRegisterTopicRefresh` prop
2. Callback is stored in `topicRefreshCallbackRef` in `app/page.tsx`
3. When note/task/decision is created or edited via modal:
   - Modal calls `onSave` callback after successful save
   - `app/page.tsx` executes the stored refresh callback
   - TopicCard automatically refreshes its history and decisions display
4. This ensures topic history is updated immediately after adding/editing notes/tasks/decisions
5. **Fixed**: Previously required manual refresh; now automatically updates when modals save
6. Callback refreshes both history items AND decisions list for complete updates

### 15. **User Type Auto-Redirect**

1. User logs in
2. System checks `user_type` in `app/page.tsx`
3. Auto-redirect logic:
   - **Attendee**: Automatically redirected to dashboard (read-only access)
   - **Vendor**: Automatically redirected to dashboard (task-focused access)
   - **Other types**: Start at dashboard (can navigate to admin/meetings)
4. Prevents unauthorized access attempts

### 16. **In-Camera Meeting Workflow**

1. User opens meeting in meeting view
2. User clicks "In-Camera" button in header (available when meeting is not finalized)
3. System updates `meetings.is_incamera` to `true`
4. Meeting header displays red "IN-CAMERA" badge
5. Warning banner appears below header: "Confidential Meeting"
6. All meeting content is treated as confidential
7. User can toggle off by clicking "Remove In-Camera" button

### 17. **In-Camera Topic Workflow**

1. Meeting must be in `working_minutes` or `minutes` status
2. User expands topic card in meeting view
3. User clicks "Mark as In-Camera" button in topic card
4. System updates `topics.is_incamera` to `true` and sets `incamera_start_time`
5. Topic card displays red "IN-CAMERA" badge and warning banner
6. Topic content is hidden in published agendas and minutes PDFs
7. Only "This topic is in-camera (confidential)" notice appears in PDFs
8. User can set `incamera_end_time` when topic discussion ends
9. User can toggle off by clicking "In-Camera (Confidential)" button again
10. In-camera status and times are preserved in meeting records

### 18. **Send Meeting Notice Workflow**

1. User opens meeting in meeting view (meeting must be in `working_agenda` or `agenda` status)
2. User clicks "Send Notice" button in meeting header action row
3. System displays confirmation dialog:
   - Shows building name and meeting title
   - Warns that this will email the agenda to all assigned owners and residents
4. User confirms to proceed
5. System fetches building information and company_id
6. System queries `user_buildings` table for all users assigned to the building
7. System fetches user details filtered by `user_type` IN ('owner', 'resident')
8. System excludes users without email addresses
9. System generates beautiful HTML email with:
   - Professional header with gradient background (blue)
   - Building name and meeting title
   - Meeting information grid: type, date, time, location, strata plan
   - Complete agenda with numbered sections and topics
   - Topic descriptions included (if present)
   - Professional footer with Meeting Genius branding
   - Responsive design for mobile devices
10. System sends email via `/api/send-email` endpoint using company's SMTP configuration
11. Success/error message displayed via toast notification
12. All owners and residents receive the formatted meeting notice via email

**Email Features**:
- Professional design with gradients, icons, and spacing
- Responsive layout that adapts to mobile screens
- Visual hierarchy with clear sections
- Meeting details displayed in info grid with icons
- Sections numbered with circular badges
- Topics displayed as ordered lists under each section
- Footer with Meeting Genius branding
- Accessible HTML structure

### 19. **GeniusWords Management Workflow**

1. User navigates to GeniusWords screen from user menu
2. `GeniusWordsManager` component loads user's shortcuts
3. User can:
   - **Create**: Click "Add New", enter shortcode (must start with `#`) and description
   - **Edit**: Click edit button, modify shortcode or description
   - **Delete**: Click delete button, confirm deletion
   - **Search**: Filter shortcuts by shortcode or description
4. Shortcuts are saved to `genius_words` table with `user_id`
5. Shortcuts become available in all text inputs across the application

### 20. **GeniusWords Autocomplete Workflow**

1. User types in any text field (decision modal, note modal, task modal, topic description)
2. User types `#` followed by shortcode characters
3. System detects `#` trigger and filters user's GeniusWords
4. Autocomplete dropdown appears showing matching shortcuts
5. User navigates with Arrow keys, selects with Enter, or closes with Escape
6. Selected shortcut replaces `#shortcode` with full description text
7. Cursor positioned after inserted text

### 21. **Auto-save Topic Description Workflow**

1. User focuses on topic description field (GeniusWordsInput)
2. User types or modifies description
3. System debounces input (1 second delay)
4. Visual indicator changes to "Saving..."
5. System sends update to database via `supabase.from('topics').update()`
6. On success, visual indicator changes to "Saved" (green checkmark)
7. On error, toast notification displays error message
8. No manual save button needed

### 22. **Decision Threading Workflow**

**Creating a Thread**:
1. User has existing decision in topic
2. User clicks thread button (CornerDownRight icon) on decision
3. `DecisionModal` opens with `parentDecisionId` set
4. Parent decision displayed at top of modal for context
5. User creates new decision (child)
6. Child decision saved with `parent_decision_id` linking to parent
7. TopicCard displays child decision indented under parent with icon

**Displaying Threaded Decisions**:
1. TopicCard fetches all decisions for topic
2. System organizes decisions into parent-child relationships
3. Parent decisions displayed first
4. Child decisions displayed indented with `CornerDownRight` icon
5. Each decision shows edit, thread, and delete buttons
6. Hierarchical structure visually clear to users

**Editing Threaded Decisions**:
1. User can edit both parent and child decisions
2. Edit mode preserves threading relationships
3. `edited_at` timestamp updated on edit
4. Threading structure remains intact after edits

---

### 23. **Meeting Transcript Upload & AI Task Extraction Workflow**

**Uploading a Transcript**:
1. User opens meeting in meeting view (meeting must be in `working_agenda` status)
2. User clicks "Upload Transcript" button in meeting header
3. `UploadTranscriptModal` opens
4. User selects transcript file (TXT, PDF, or DOCX format, max 10MB)
5. File validated for type and size
6. User clicks "Upload & Extract Tasks" button
7. System uploads file to Supabase Storage (`meeting-transcripts/{meeting_id}/{timestamp}_{filename}`)
8. System gets public URL for uploaded file
9. System extracts text from file using `extractTextFromFile()` utility
10. System fetches meeting sections and topics for context
11. Transcript text sent to Google Gemini AI (`models/gemini-2.5-flash`) with detailed prompt
12. AI analyzes transcript and returns JSON array of extracted tasks with:
    - `description`: Clear, actionable task description
    - `assigned_name`: Person assigned (if mentioned)
    - `due_date`: Due date in YYYY-MM-DD format (if mentioned)
    - `confidence`: AI confidence score (0-1)
13. System filters tasks to only those with confidence >= 0.5
14. Transcript record saved to `meeting_transcripts` table with:
    - Meeting ID, filename, file URL, file size, mime type
    - `parsed_json`: Contains extracted tasks array
    - `tasks_created_count`: Initially 0
    - `uploaded_by`: Current user ID
15. Success message displayed with count of extracted tasks
16. `PreviewTasksModal` opens automatically to review tasks

**Reviewing & Approving Extracted Tasks**:
1. `PreviewTasksModal` displays all extracted tasks
2. Each task shows: description, assigned name, due date, topic assignment, confidence
3. User can:
   - **Edit** any task: modify description, assignee, due date
   - **Assign to Topic**: Select which section and topic the task belongs to
   - **Remove** task: Delete tasks that aren't relevant
4. Warning shown if any tasks don't have a topic assigned
5. User clicks "Approve & Create Tasks" button
6. System validates all tasks have `topic_id` assigned
7. Tasks sent to `/api/transcripts/create-tasks` endpoint
8. Tasks inserted into `tasks` table with:
   - `topic_id`, `description`, `assigned_name`, `due_date`, `status: 'open'`
   - `created_by`: Current user ID
9. `meeting_transcripts.tasks_created_count` updated with number of created tasks
10. Success message displayed
11. Meeting view refreshes to show newly created tasks
12. Modal closes

**Viewing Transcript History**:
1. User clicks "View Transcripts" button in meeting view
2. `ViewTranscriptsModal` opens
3. System fetches all transcripts for meeting via `/api/transcripts/list`
4. Each transcript displays:
   - Filename and upload date
   - File size (formatted as KB/MB)
   - Number of tasks created from transcript
   - Uploaded by user name
   - Action buttons: View (opens file) and Download
5. User can view or download any transcript file
6. Empty state shown if no transcripts uploaded yet

**AI Task Extraction Details**:
- **Model**: Google Gemini 2.5 Flash (fast, cost-effective)
- **Prompt Engineering**: Detailed instructions to extract only clear action items
- **Task Recognition**: Identifies explicit ("John will...") and implicit ("We need to...") assignments
- **Confidence Scoring**: Each task rated 0-1, filtered to >= 0.5 confidence
- **JSON Response**: Gemini returns structured JSON with tasks array
- **Error Handling**: Graceful fallback if AI fails (shows empty task list)
- **Text Cleanup**: Removes markdown code blocks from Gemini response

**Use Cases**:
- Import tasks from external meeting notes or recordings
- Quickly create multiple tasks from transcript analysis
- Reduce manual data entry after meetings
- Ensure no action items are missed from meeting discussions
- Track which transcripts contributed to which tasks

---

## File Structure

```
meeting-genius/
├── app/
│   ├── layout.tsx              # Root layout with metadata
│   ├── page.tsx                 # Main application entry point
│   ├── globals.css              # Global styles
│   ├── api/                     # API routes
│   │   ├── send-email/
│   │   │   └── route.ts         # Email sending (company SMTP)
│   │   ├── pricing/
│   │   │   └── company-data/
│   │   │       └── route.ts     # API-key protected company/PM/building data (pricing)
│   │   ├── signup/
│   │   │   └── route.ts         # Signup (company, admin, PM, building)
│   │   ├── users/
│   │   │   └── bulk-import/
│   │   │       └── route.ts     # Bulk create users from CSV (building + company context)
│   │   └── transcripts/
│   │       ├── upload/
│   │       │   └── route.ts     # Upload transcript + AI task extraction
│   │       ├── list/
│   │       │   └── route.ts     # List transcripts for a meeting
│   │       └── create-tasks/
│   │           └── route.ts     # Batch create tasks from transcript
│   ├── task-update/
│   │   └── [token]/
│   │       └── page.tsx         # External task update page (vendor/assignee by token, no login)
│   └── react-beautiful-dnd.d.ts
│
├── components/
│   ├── admin/                   # Admin panel components
│   │   ├── AgendaTemplatesTab.tsx      # Agenda PDF templates per building (cover page + info card designer)
│   │   ├── AssignUsersToCompanyModal.tsx
│   │   ├── BuildingCard.tsx
│   │   ├── BuildingDetailsModal.tsx    # Main building modal (tabs: Details, Users, Documents, Notifications)
│   │   ├── BuildingsTab.tsx
│   │   ├── CompanyCard.tsx
│   │   ├── CompanyDetailsModal.tsx
│   │   ├── CreateBuildingModal.tsx
│   │   ├── CreateCompanyModal.tsx
│   │   ├── CreateUserModal.tsx
│   │   ├── DocumentManagementModal.tsx
│   │   ├── EditBuildingModal.tsx
│   │   ├── EditCompanyModal.tsx
│   │   ├── ImportUsersModal.tsx        # Bulk user import from CSV for a building
│   │   ├── LogoTab.tsx                 # Company logo management
│   │   ├── MinutesTemplatesTabold.tsx  # Legacy minutes template editor (kept for reference)
│   │   ├── UserCard.tsx
│   │   ├── UsersTab.tsx
│   │   ├── ViewDocumentModal.tsx
│   │
│   ├── ui/                      # shadcn/ui components
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── dialog.tsx
│   │   └── ... (50+ components)
│   │
│   ├── admin-panel.tsx          # Main admin interface
│   ├── admin-panelbackup.txt     # Backup (optional, not imported)
│   ├── AuthenticatedLayout.tsx   # Layout wrapper: Header + main content (optional use)
│   ├── AttendeeManagement.tsx   # Attendee management
│   ├── create-meeting-modal.tsx  # Create meeting
│   ├── create-section-modal.tsx  # Create section
│   ├── create-topic-modal.tsx    # Create topic
│   ├── dashboard.tsx             # Main dashboard
│   ├── decision-modal.tsx        # Decision recording
│   ├── EditMeetingModal.tsx      # Edit meeting
│   ├── GenerateAgendaButton.tsx  # Generate PDF agendas
│   ├── GenerateMinutesButton.tsx # Generate PDF minutes
│   ├── GeniusWordsInput.tsx      # Reusable input with GeniusWords autocomplete
│   ├── GeniusWordsManager.tsx    # Manage user text shortcuts
│   ├── Header.tsx                 # App header (logo, UserNav / Login)
│   ├── meeting-view.tsx         # Meeting interface
│   ├── meeting-card.tsx          # Meeting display
│   ├── MinutesTemplatesTab.tsx   # Minutes templates designer (root; used by admin-panel)
│   ├── note-modal.tsx            # Note creation/editing
│   ├── page.tsx                   # Optional page wrapper component
│   ├── ProfileSettingsModal.tsx   # User profile (name, email, password)
│   ├── SelectRecorderModal.tsx   # Select recorder for meeting audio
│   ├── task-card.tsx             # Task display
│   ├── task-modal.tsx            # Task creation/editing (uses TaskEmailPreviewModal)
│   ├── TaskDetailsModal.tsx      # Task details with notes
│   ├── TaskEmailPreviewModal.tsx  # Preview/customize task assignment email
│   ├── topic-card.tsx            # Topic display
│   ├── timer.tsx                 # Meeting timer
│   ├── UnifiedItemModal.tsx      # Unified modal: Tasks / Notes / Decisions tabs per topic
│   ├── UserNav.tsx                # User dropdown (profile, settings, logout)
│   ├── meetings/                 # Meeting-related components
│   │   └── RecordingPlayerModal.tsx  # Play meeting recording (play/pause, progress, volume, download)
│   ├── transcript/               # Transcript management components
│   │   ├── upload-transcript-modal.tsx    # Upload transcript files
│   │   ├── preview-tasks-modal.tsx         # Review AI-extracted tasks
│   │   └── view-transcripts-modal.tsx      # View transcript history
│   ├── login-form.tsx            # Login form
│   └── theme-provider.tsx        # Theme management
│
├── lib/
│   ├── supabase.ts              # Supabase client & types
│   ├── auth.ts                   # Authentication functions
│   ├── permissions.ts            # Permission system
│   ├── documentExtractor.ts      # Document text extraction utility (PDF, DOCX, TXT)
│   ├── gemini.ts                 # Google Gemini AI integration for transcript task extraction
│   ├── pdfGenerator.ts           # jsPDF-based minutes PDF generator (template-driven)
│   ├── canvasPDFGenerator.ts     # Canvas-style agenda/minutes PDF renderer (CanvasElement layout)
│   ├── csvParser.ts              # CSV parser/validator for bulk user import
│   ├── timezone.ts               # Timezone utilities (UTC ↔ local for dates/times display)
│   └── utils.ts                  # Utility functions
│
├── hooks/
│   ├── use-mobile.ts            # Mobile detection hook
│   └── use-toast.ts             # Toast notifications
│
├── public/                       # Static assets
│   ├── MG2 logo.png
│   └── ...
│
├── MeetingGenius_API_Documentation.md       # API key + endpoints (current)
├── Meeting_Genius_Signup_API_Documentation.md # Legacy signup API doc
│
├── package.json                 # Dependencies
├── tsconfig.json                 # TypeScript config
├── next.config.mjs              # Next.js config
├── postcss.config.mjs           # PostCSS (Tailwind 4)
└── components.json               # shadcn/ui config
```

---

## Important Implementation Details

### 1. **Data Filtering by User Type**

The system automatically filters data based on user type:

```typescript
// Example from dashboard.tsx
if (currentUser.user_type === 'master') {
  // See all buildings
} else if (currentUser.user_type === 'corporate_administrator') {
  // Filter by company_id
  query = query.eq('company_id', currentUser.company_id)
} else if (currentUser.user_type === 'property_manager') {
  // Filter by manager_id
  query = query.eq('manager_id', currentUser.id)
} else {
  // Filter by user_buildings junction table
  const { data: userBuildings } = await supabase
    .from('user_buildings')
    .select('building_id')
    .eq('user_id', currentUser.id)
  const buildingIds = userBuildings?.map(ub => ub.building_id) || []
  query = query.in('id', buildingIds)
}
```

**User-Building Assignment**:
- Users are assigned to buildings via the `user_buildings` junction table
- Property managers see buildings via `buildings.manager_id`
- Regular users see buildings via `user_buildings` entries
- Users can be assigned to a property manager via `users.assigned_pm_id`

### 2. **Company Defaults**

Companies can set default configurations:
- `default_meeting_sections`: Default section names when creating meetings
- `default_meeting_types`: Available meeting types
- `default_decision_results`: Decision result options (customizable dropdown in decision modal)

These are used when creating new meetings. If a company doesn't have defaults set, the system falls back to standard defaults (see companies table documentation above).

**SMTP Email Configuration**:
- Companies can configure SMTP settings for sending emails
- Managed in CompanyDetailsModal → Overview tab
- Settings include: `smtp_host`, `smtp_port`, `smtp_user`, `smtp_password`, `smtp_from_name`, `smtp_from_email`, `smtp_use_tls`
- Used by `/api/send-email` endpoint for sending task assignments and notifications
- Each company has independent email configuration

### 3. **Drag and Drop**

Uses `@hello-pangea/dnd` for reordering:
- Sections can be reordered
- Topics can be reordered within sections
- Order stored in `order_index` field

### 4. **JSONB Fields**

Several fields use JSONB for flexible data:
- `meetings.attendees`: Array of attendee objects with name, email, role, user_id, present fields
- `tasks.assignees`: Array of assignee objects with name, email, present fields
- `buildings.rules_document`: Document content (legacy, now using building_documents table)
- `buildings.agenda_template`: Template content
- `buildings.minutes_template`: Template content (used by GenerateMinutesButton)
- `ai_analyses.analysis_result`: Topic AI analysis result (JSON or text)
- `task_analyses.analysis_result`: Task AI analysis result (JSON or text)
- `minutes_templates.blocks`: Template configuration for PDF generation (sections with fields)

**Note**: `genius_words` table uses standard columns (not JSONB) for shortcode and description storage.

**Attendee Object Structure**:
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "role": "Chair",
  "user_id": 123,
  "present": true
}
```

**Assignee Object Structure**:
```json
{
  "name": "Jane Smith",
  "email": "jane@example.com",
  "present": true
}
```

### 5. **Meeting Rollover Logic**

Located in `lib/supabase.ts`:
- `getPreviousMeetingOfSameType()`: Finds previous meeting
- `getSectionsFromMeeting()`: Gets sections
- `getTopicsFromMeeting()`: Gets topics
- `getOpenTasksFromMeeting()`: Gets open tasks

### 6. **Status Management**

Meeting status controls what actions are available:
- `working_agenda`: Can edit everything
- `agenda`: Can start meeting, begin minutes
- `working_minutes`: Can record decisions, tasks, notes
- `minutes`: Read-only, finalized, can generate PDF minutes

Task status options:
- `open`: Newly created task
- `in_progress`: Task being worked on
- `completed`: Task finished
- `blocked`: Task is blocked

### 7. **External Task Updates**

Tasks have `external_update_token` and `token_expires_at` fields for vendor/assignee access without full login. The **Task Update page** (`app/task-update/[token]/page.tsx`) is a public route: assignees open the link from the task assignment email, validate by token, and can update task status, add notes, and upload or delete attachments. Link format: `/task-update/{token}`.

### 8. **Timer Functionality**

Meeting timer tracks elapsed time and can record:
- `recording_started_at`
- `recording_ended_at`
- `audio_duration`

### 9. **Attendee Management**

Attendees stored as JSONB array in `meetings.attendees`:
```json
[
  {
    "name": "John Doe",
    "email": "john@example.com",
    "role": "Chair",
    "user_id": 123,
    "present": true
  }
]
```

**Attendee Management Features**:
- **Add Attendees**: During `working_agenda` phase, users can add attendees with name, email, and role
- **Edit Attendees**: In `working_agenda` phase, all attendee fields (name, email, role) are editable
- **Remove Attendees**: Attendees can be deleted during `working_agenda` phase
- **Track Presence**: During `working_minutes` phase, users can mark attendees as present/absent
- **Role Assignment**: Each attendee can have a role (e.g., "Chair", "Secretary", "Member", "Treasurer")
- **Role Display**: Roles are displayed in the attendees table and included in PDF minutes generation
- **Read-Only Mode**: In `minutes` (finalized) status, attendees are read-only

**Meeting recording playback**: `RecordingPlayerModal` (in `components/meetings/`) plays meeting audio from Supabase Storage with play/pause, progress, volume, and download.

### 10. **Date/Time and Timezone**

Dates and times are stored in UTC in the database. For display, `lib/timezone.ts` provides:
- `formatUtcToLocalLong(dateString, timeString?)` – full date (e.g. "Thursday, January 8, 2026")
- `formatUtcToLocalShort(timeString)` – time (e.g. "2:00 PM")
- Helpers to convert UTC to local for forms and labels

### 11. **TypeScript Types**

All database types defined in `lib/supabase.ts` as `Database` type:
- Ensures type safety
- Auto-completion in IDE
- Prevents typos in table/column names
- Includes SMTP fields in companies table
- Includes default_decision_results in companies table
- Includes logo_url in companies table
- Includes parent_decision_id, edited_at, votes_abstain in decisions table
- Includes all 7 user types (master, corporate_administrator, property_manager, user, owner, vendor, attendee)
- Interfaces for TaskAttachment, TopicAttachment, TaskAnalysis, Company, User
- Generic extractTextFromFile function for document processing
- Includes 8 user types: master, corporate_administrator, property_manager, user, owner, resident, vendor, attendee
- In-camera fields for meetings and topics (is_incamera, incamera_start_time, incamera_end_time)

### 12. **PDF Minutes Generation**

The system can generate professional PDF minutes from finalized meetings:
- Uses `GenerateMinutesButton` component
- Fetches template from `minutes_templates` table (building-specific)
- Falls back to default template if none exists
- Fetches meeting with building and company (for logo: building logo preferred, then company logo)
- Generates HTML from meeting data (sections, topics, notes, tasks, decisions), with in-camera filtering
- Renders HTML in an off-screen iframe (210mm width) for consistent print layout
- Converts iframe content to canvas using html2canvas, then multi-page PDF via jsPDF
- Downloads PDF with meeting title and date in filename
- Available only when meeting status is "minutes" (finalized)

**Template Configuration**:
- Managed in Admin Panel → Minutes Templates tab
- Each building can have custom template
- Template defines which sections and fields to include
- Fields can be shown/hidden and reordered

### 13. **Email Sending System**

The system includes comprehensive email functionality for sending notifications:
- **API Endpoint**: `/app/api/send-email/route.ts`
- **SMTP Configuration**: Per-company SMTP settings stored in `companies` table
- **Email Sending**:
  - Uses Nodemailer library
  - Verifies SMTP connection before sending
  - Supports HTML and plain text emails
  - Uses company's configured SMTP settings
  - Beautiful HTML email templates with professional design
- **Configuration Management**:
  - Managed in CompanyDetailsModal → Overview tab
  - Includes: host, port, username, password, from name/email, TLS settings
  - Password field is never prefilled for security
- **Use Cases**:
  - **Meeting Notice Distribution**: Send formatted agendas to all building owners/residents
    - Professional HTML email template with gradient headers
    - Complete meeting details and full agenda with sections/topics
    - Responsive design for mobile devices
    - Automatic recipient filtering by user_type ('owner' or 'resident')
    - Available via "Send Notice" button in meeting view
  - **Task Assignment Notifications**: Notify assignees of new tasks
  - **Meeting Invitations**: Send meeting invites and updates
  - **Other System Notifications**: General notification emails
- **Meeting Notice Email Features**:
  - Professional gradient header (blue theme) with building name
  - Meeting information grid with icons (date, time, location, type, strata plan)
  - Complete agenda display with numbered sections
  - Topics listed with descriptions under each section
  - Professional footer with Meeting Genius branding
  - Mobile-responsive design with media queries
  - Accessible HTML structure

### 14. **Signup API**

The system includes a programmatic signup API for creating new companies and users:
- **API Endpoint**: `/app/api/signup/route.ts`
- **Authentication**: API key-based authentication via `x-api-key` header
- **Purpose**: Create a complete company setup in one API call
- **Functionality**:
  - Creates a new company with optional default configurations
  - Creates a corporate administrator user
  - Optionally creates a property manager user
  - Optionally creates a building (assigned to PM or corporate admin)
  - Configures company defaults (meeting sections, types)
  - Optionally configures SMTP settings
- **Request Fields**:
  - **Required**: `company_name`, `corporate_admin_name`, `corporate_admin_email`, `corporate_admin_password`
  - **Optional**: `building_name`, `building_address`, `building_type`, `property_manager_name`, `property_manager_email`, `property_manager_password`, `default_meeting_sections`, `default_meeting_types`, `smtp_config`
- **Security**:
  - Passwords are automatically hashed with bcrypt (10 salt rounds)
  - API key validation required for all requests
  - Email uniqueness validation before user creation
  - Transaction rollback on errors (company deleted if admin creation fails)
- **Response**: Returns created company, corporate admin, building, and property manager IDs
- **Health Check**: GET endpoint available for API status checking
- **Documentation**: See `MeetingGenius_API_Documentation.md` (current) and `Meeting_Genius_Signup_API_Documentation.md` (legacy) for complete API documentation

---

## Development Notes

### Running the Project

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Lint code
npm run lint
```

### Environment

- **Supabase**: URL and keys are hardcoded in `lib/supabase.ts` and `app/api/send-email/route.ts`
  - Should be moved to `.env.local` file for security
  - Example `.env.local`:
    ```
    NEXT_PUBLIC_SUPABASE_URL=https://iehrlogqpsebhubbafxo.supabase.co
    NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
    ```
- No `.env` file currently used in the project

### Authentication

- **Current Implementation**: Simple password check (password: "123456" for all users)
- **Password Hashing**: bcryptjs library installed and functions available in `lib/auth.ts`
  - `hashPassword()` and `verifyPassword()` functions exist but not fully utilized
  - Should implement proper bcrypt password verification in production
- **Session Management**: localStorage-based authentication
  - User object stored in `localStorage` as `current_user`
  - No server-side sessions or JWT tokens
  - No automatic token refresh

### Database Connection

- **Supabase Client**: Initialized in `lib/supabase.ts`
- **Query Pattern**: All queries use Supabase client with async/await
- **No Pooling**: No connection pooling or special configuration
- **Storage**: Supabase Storage used for file uploads
  - Buckets: `company-logos`, `building-documents`, `task-attachments`, `topic-attachments`
  - Public access URLs generated for uploaded files

### Deployment

- **Deployment Scripts**: Several batch files in root directory
  - `deploy.bat`: Full deployment
  - `deploy-server-only.bat`: Server-only deployment
  - `deploy-git.bat`: Git-based deployment
- **Deploy Folder**: Contains separate `package.json` and `.next` build output
- **Production Build**: Next.js static export or server-side rendering

---

## Common Patterns

### Fetching Data

```typescript
const { data, error } = await supabase
  .from('table_name')
  .select('*')
  .eq('column', value)
  .order('created_at', { ascending: false })
```

### Creating Records

```typescript
const { data, error } = await supabase
  .from('table_name')
  .insert([{ field1: value1, field2: value2 }])
  .select()
```

### Updating Records

```typescript
const { error } = await supabase
  .from('table_name')
  .update({ field: newValue })
  .eq('id', recordId)
```

### Deleting Records

```typescript
const { error } = await supabase
  .from('table_name')
  .delete()
  .eq('id', recordId)
```

### Permission Checks

```typescript
import { canCreateMeeting, canAccessAdmin, isReadOnly } from '@/lib/permissions'

if (!canCreateMeeting(currentUser?.user_type)) {
  // Show error or hide button
}

if (canAccessAdmin(currentUser?.user_type)) {
  // Show admin panel link
}

if (isReadOnly(currentUser?.user_type)) {
  // Disable all edit functionality
}
```

### Document Text Extraction

```typescript
import { fetchAndExtractBuildingDocuments, fetchAndExtractTaskAttachments, fetchAndExtractTopicAttachments } from '@/lib/documentExtractor'

// Extract text from building documents
const buildingDocs = await fetchAndExtractBuildingDocuments(buildingId)

// Extract text from task attachments
const taskAttachments = await fetchAndExtractTaskAttachments(taskId)

// Extract text from topic attachments
const topicAttachments = await fetchAndExtractTopicAttachments(topicId)
```

### File Upload to Supabase Storage

```typescript
// Upload to Supabase Storage
const filePath = `${entityId}/${Date.now()}_${file.name}`
const { data, error } = await supabase.storage
  .from('bucket-name')
  .upload(filePath, file)

if (error) {
  console.error('Upload error:', error)
  return
}

// Get public URL
const { data: { publicUrl } } = supabase.storage
  .from('bucket-name')
  .getPublicUrl(filePath)
```

### Auto-save with Debounce

```typescript
import { useState, useEffect } from 'react'

// Custom debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)
  
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)
    
    return () => clearTimeout(handler)
  }, [value, delay])
  
  return debouncedValue
}

// Usage
const [description, setDescription] = useState('')
const debouncedDescription = useDebounce(description, 1000)

useEffect(() => {
  if (debouncedDescription !== originalDescription) {
    saveToDatabase(debouncedDescription)
  }
}, [debouncedDescription])
```

---

## Future Considerations

### Implemented ✅
- ✅ **Document Storage**: Supabase Storage for building documents, task attachments, topic attachments, company logos
- ✅ **Email Notifications**: Company-specific SMTP configuration and email sending API
- ✅ **AI Analysis**: Topic and task analysis with building documents and attachments
- ✅ **Decision Threading**: Parent-child relationships for decision discussions
- ✅ **Auto-save**: Debounced auto-save for topic descriptions
- ✅ **GeniusWords**: User-specific text shortcuts with autocomplete
- ✅ **Delete Confirmations**: Modals for meeting, task, and decision deletion
- ✅ **Company Logos**: Upload and display company logos in dashboard
- ✅ **User Type 'Owner'**: Property owner user type with appropriate permissions
- ✅ **Bulk User Import**: CSV-based user import per building (ImportUsersModal + `csvParser`)

### Remaining Considerations 🔄
1. **Authentication**: Implement proper password hashing and verification (bcryptjs functions exist but not fully used)
2. **Environment Variables**: Move Supabase credentials to `.env` file (currently hardcoded)
3. **Error Handling**: Add more comprehensive error handling and user feedback
4. **Testing**: Add unit and integration tests
5. **Documentation**: Add JSDoc comments to functions
6. **Performance**: 
   - Optimize queries, add pagination for large datasets
   - Implement caching for frequently accessed data
   - Lazy loading for large lists
7. **Security**: 
   - Implement Row Level Security (RLS) in Supabase
   - Add CSRF protection
   - Implement rate limiting for API endpoints
8. **Real-time**: Add Supabase real-time subscriptions for live updates (collaborative editing)
9. **Audio Recording**: Implement proper file storage and playback for meeting audio files
10. **Advanced AI Features**:
    - AI-generated meeting summaries
    - AI-suggested actions from meeting discussions
    - Sentiment analysis of meeting notes
11. **Mobile App**: React Native or Progressive Web App (PWA) version
12. **Integrations**:
    - Calendar integrations (Google Calendar, Outlook)
    - Slack/Teams notifications
    - Third-party document services
13. **Reporting & Analytics**:
    - Meeting attendance reports
    - Task completion metrics
    - Building-level analytics dashboards
14. **Advanced Search**: Full-text search across all meeting content
15. **Version History**: Track and display version history for all entities
16. **Bulk Operations**: Bulk edit/delete for tasks, meetings, users
17. **Export/Import**: Additional CSV/Excel export for reports and other data types (user CSV import implemented)
18. **Customization**: Theme customization per company (colors, fonts)
19. **Audit Logs**: Comprehensive audit trail for all changes

---

### 13. **Auto-save Functionality**
- **Topic Descriptions**: Auto-save with 1-second debounce delay
- **Visual Feedback**: "Saving..." and "Saved" indicators
- **No Manual Save**: No save button needed for topic descriptions
- **Error Handling**: Toast notifications for save errors
- **Optimistic Updates**: UI updates immediately while save happens in background

### 14. **Delete Confirmation Modals**
- **Meeting Deletion**: Confirmation modal before deleting meetings
- **Task Deletion**: Confirmation modal before deleting tasks
- **Decision Deletion**: Confirmation modal before deleting decisions
- **Cascading Deletes**: Warnings about related data being deleted
- **Loading States**: Disabled buttons during deletion process

### 15. **Google Gemini AI Integration**
- **Library**: @google/generative-ai (^0.24.1)
- **Model**: models/gemini-2.5-flash (fast, cost-effective)
- **API Key**: Hardcoded in `lib/gemini.ts` for MVP testing (should move to environment variable)
- **Use Case**: Extract action items and tasks from meeting transcripts
- **Prompt Engineering**: 
  - Detailed instructions for task extraction
  - JSON response format specification
  - Guidelines for identifying explicit and implicit assignments
  - Confidence scoring requirements
- **Response Processing**:
  - Removes markdown code blocks from response
  - Parses JSON response
  - Validates task structure
  - Filters tasks by confidence threshold (>= 0.5)
- **Error Handling**: Graceful fallback if AI fails (returns empty task array)
- **Extracted Data**:
  - `description`: Clear, actionable task description
  - `assigned_name`: Person assigned (null if not mentioned)
  - `due_date`: Due date in YYYY-MM-DD format (null if not mentioned)
  - `confidence`: AI confidence score (0-1)
- **Performance**: Fast processing with Gemini 2.5 Flash model
- **Cost**: Minimal cost due to efficient model selection

---

## Troubleshooting & Known Issues

### Common Issues

1. **File Upload Errors**
   - **Issue**: Files fail to upload to Supabase Storage
   - **Solution**: Check Supabase Storage bucket policies and authentication
   - **Prevention**: Ensure max file size limits are enforced on client side

2. **Document Text Extraction Failures**
   - **Issue**: PDF or DOCX text extraction returns empty or errors
   - **Solution**: Check file format and corruption, ensure libraries are installed
   - **Prevention**: Validate file types before upload

3. **AI Analysis Not Returning Results**
   - **Issue**: AI analysis webhook times out or returns no data
   - **Solution**: Check n8n webhook URL availability, verify payload format
   - **Debug**: Console log the request payload before sending

4. **SMTP Email Sending Fails**
   - **Issue**: Emails not sending despite SMTP configuration
   - **Solution**: 
     - Verify SMTP credentials are correct
     - Check SMTP port (587 for TLS, 465 for SSL)
     - Ensure `smtp_use_tls` setting matches server requirements
   - **Test**: Use `transporter.verify()` to test connection

5. **User Cannot See Buildings/Meetings**
   - **Issue**: User sees empty dashboard despite being assigned
   - **Solution**: 
     - Check user's `company_id` matches building's `company_id`
     - Verify user is in `user_buildings` junction table
     - For property managers, check `manager_id` on buildings
   - **Debug**: Log user type and query filters in dashboard

6. **Decision Threading Not Displaying Correctly**
   - **Issue**: Child decisions not showing under parent
   - **Solution**: Check `parent_decision_id` is set correctly in database
   - **Debug**: Verify TopicCard is organizing decisions by parent-child relationships

7. **Auto-save Not Working**
   - **Issue**: Topic descriptions not saving automatically
   - **Solution**: Check debounce timing, verify database connection
   - **Debug**: Add console logs in debounce effect and save function

8. **GeniusWords Autocomplete Not Appearing**
   - **Issue**: Typing `#` doesn't show suggestions
   - **Solution**: 
     - Verify user has GeniusWords created
     - Check `user_id` filter in query
     - Ensure `#` trigger detection is working
   - **Debug**: Console log fetched GeniusWords and trigger detection

### Performance Optimization Tips

1. **Large Meeting Lists**: Implement pagination or virtual scrolling
2. **Document Extraction**: Process documents asynchronously with progress indicators
3. **AI Analysis**: Add caching for repeated analyses
4. **Real-time Updates**: Consider Supabase real-time subscriptions instead of polling

### Security Best Practices

1. **Environment Variables**: Move all credentials to `.env.local` file
2. **Row Level Security**: Implement RLS policies in Supabase
3. **Password Hashing**: Enable bcrypt password verification
4. **CSRF Protection**: Add CSRF tokens for API endpoints
5. **Input Validation**: Validate all user inputs on server side
6. **File Upload**: Scan uploaded files for malware

---

## API Endpoints & External Integrations

### Internal API Endpoints

**Authentication note**: Some endpoints are **API-key protected** (e.g. `/api/signup`, `/api/pricing/company-data` use `x-api-key`). Other app-internal endpoints currently have **no auth** and should be protected before production.

#### 1. `/api/send-email` (POST)
- **Purpose**: Send emails using company-specific SMTP configuration
- **Authentication**: None (should be added for production)
- **Request Body**:
  ```json
  {
    "companyId": 123,
    "to": "recipient@example.com",
    "subject": "Email Subject",
    "html": "<p>HTML email content</p>",
    "text": "Plain text fallback (optional)"
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "messageId": "smtp-message-id"
  }
  ```
- **Error Handling**: Returns appropriate error messages if SMTP not configured or connection fails
- **Implementation**: Uses Nodemailer with company SMTP settings from database

#### 2. `/api/signup` (POST)
- **Purpose**: User signup endpoint (see `MeetingGenius_API_Documentation.md`; legacy: `Meeting_Genius_Signup_API_Documentation.md`)
- **Features**: User registration with validation
- **Implementation**: Located in `app/api/signup/route.ts`

#### 3. `/api/transcripts/upload` (POST)
- **Purpose**: Upload meeting transcript and extract tasks using Google Gemini AI
- **Authentication**: Requires user to be logged in
- **Request**: FormData with file, meeting_id, user_id
- **Process**:
  1. Validates file type (TXT, PDF, DOCX) and size (max 10MB)
  2. Uploads file to Supabase Storage (`meeting-transcripts` bucket)
  3. Extracts text from file using documentExtractor
  4. Fetches meeting sections and topics for context
  5. Sends text to Google Gemini AI for task extraction
  6. Filters tasks to confidence >= 0.5
  7. Saves transcript record with extracted tasks in `parsed_json`
  8. Returns transcript_id and extracted_tasks array
- **Response**:
  ```json
  {
    "success": true,
    "transcript_id": 123,
    "extracted_tasks": [
      {
        "description": "Task description",
        "assigned_name": "John Doe",
        "due_date": "2026-02-15",
        "confidence": 0.95
      }
    ],
    "message": "Successfully extracted 5 task(s)"
  }
  ```
- **Implementation**: Located in `app/api/transcripts/upload/route.ts`

#### 4. `/api/transcripts/list` (GET)
- **Purpose**: List all transcripts uploaded to a meeting
- **Authentication**: None (should be added for production)
- **Query Parameters**: `meeting_id` (required)
- **Response**:
  ```json
  {
    "transcripts": [
      {
        "id": 123,
        "meeting_id": 456,
        "filename": "meeting-notes.pdf",
        "file_url": "https://...",
        "file_size": 524288,
        "mime_type": "application/pdf",
        "tasks_created_count": 5,
        "created_at": "2026-01-27T10:00:00Z",
        "users": {
          "name": "John Doe"
        }
      }
    ]
  }
  ```
- **Implementation**: Located in `app/api/transcripts/list/route.ts`

#### 5. `/api/transcripts/create-tasks` (POST)
- **Purpose**: Batch create tasks from approved transcript extraction
- **Authentication**: Requires user to be logged in
- **Request Body**:
  ```json
  {
    "transcript_id": 123,
    "user_id": 456,
    "tasks": [
      {
        "description": "Task description",
        "assigned_name": "John Doe",
        "assigned_email": "john@example.com",
        "due_date": "2026-02-15",
        "topic_id": 789
      }
    ]
  }
  ```
- **Validation**: All tasks must have `topic_id` assigned
- **Process**:
  1. Validates all tasks have topic_id
  2. Bulk inserts tasks into `tasks` table
  3. Updates `meeting_transcripts.tasks_created_count`
  4. Returns created task IDs
- **Response**:
  ```json
  {
    "success": true,
    "created_count": 5,
    "task_ids": [101, 102, 103, 104, 105],
    "message": "Successfully created 5 task(s)"
  }
  ```
- **Implementation**: Located in `app/api/transcripts/create-tasks/route.ts`

#### 6. `/api/users/bulk-import` (POST)
- **Purpose**: Bulk create users from CSV data (used by ImportUsersModal)
- **Authentication**: None (internal UI endpoint; should be protected in production)
- **Request Body**:
  ```json
  {
    "users": [{ "name": "...", "email": "...", "user_type": "...", "password": "...", "building_name": "...", "building_id": "...", "row_number": 1 }],
    "buildingId": 123,
    "buildingType": "Strata/Condo",
    "companyId": 456,
    "managerId": 789
  }
  ```
- **Process**: Creates users, assigns to building via `user_buildings`, sets user_type from building type; skips duplicates by email
- **Response**: `{ "created": number, "skipped": number, "errors": string[] }`
- **Implementation**: Located in `app/api/users/bulk-import/route.ts`

#### 7. `/api/pricing/company-data` (GET/POST)
- **Purpose**: API-key protected endpoint to fetch company + property manager + building counts/data (used for dynamic pricing / reporting)
- **Authentication**: Requires `x-api-key` header (see `MeetingGenius_API_Documentation.md`)
- **GET**: Requires `company_id` query param; returns PM list, assigned/unassigned buildings, totals
- **POST**: Returns a list of companies (for discovering company IDs)
- **Implementation**: Located in `app/api/pricing/company-data/route.ts`

### External API Integrations

#### AI Analysis Webhooks (n8n)

**Topic AI Analysis**:
- **Webhook URL**: `https://rulesengine.asccreative.com/webhook/843afc5f-abe0-4bb4-bb9f-369d2657c4d0`
- **Method**: POST
- **Request Payload**:
  ```json
  {
    "topicId": 123,
    "topicTitle": "Topic Title",
    "topicDescription": "Topic description text",
    "buildingId": 456,
    "buildingName": "Building Name",
    "buildingDocuments": [
      {
        "type": "rules",
        "filename": "building-rules.pdf",
        "text": "Extracted text from document..."
      }
    ],
    "topicAttachments": [
      {
        "filename": "attachment.pdf",
        "text": "Extracted text from attachment..."
      }
    ]
  }
  ```
- **Response**: AI analysis result stored in `ai_analyses` table
- **Triggered From**: TopicCard "Analyze with AI" button

**Task AI Analysis**:
- **Webhook URL**: `https://rulesengine.asccreative.com/webhook/ac3f411b-401a-4a97-ae07-f241dbc2d1ed`
- **Method**: POST
- **Request Payload**:
  ```json
  {
    "taskId": 123,
    "taskDescription": "Task description text",
    "buildingId": 456,
    "buildingName": "Building Name",
    "buildingDocuments": [
      {
        "type": "rules",
        "filename": "building-rules.pdf",
        "text": "Extracted text from document..."
      }
    ],
    "taskAttachments": [
      {
        "filename": "attachment.pdf",
        "text": "Extracted text from attachment..."
      }
    ]
  }
  ```
- **Response**: AI analysis result stored in `task_analyses` table
- **Triggered From**: TaskDetailsModal "Analyze with AI" button

### Supabase Storage Buckets

1. **company-logos**
   - Purpose: Store company logo images
   - File Path Format: `{company_id}/logo.{ext}`
   - Max File Size: 2MB
   - Supported Formats: PNG, JPG, SVG
   - Access: Public read

2. **building-documents**
   - Purpose: Store building-related documents for AI analysis
   - File Path Format: `{building_id}/{timestamp}_{filename}`
   - Max File Size: 10MB
   - Supported Formats: PDF, DOC, DOCX, TXT
   - Access: Authenticated users

3. **task-attachments**
   - Purpose: Store files attached to tasks
   - File Path Format: `{task_id}/{timestamp}_{filename}`
   - Max File Size: 10MB
   - Supported Formats: PDF, DOC, DOCX, TXT, images
   - Access: Authenticated users

4. **topic-attachments**
   - Purpose: Store files attached to topics
   - File Path Format: `{topic_id}/{timestamp}_{filename}`
   - Max File Size: 10MB
   - Supported Formats: PDF, DOC, DOCX, TXT, images
   - Access: Authenticated users

5. **meeting-transcripts**
   - Purpose: Store meeting transcript files for AI task extraction
   - File Path Format: `{meeting_id}/{timestamp}_{filename}`
   - Max File Size: 10MB
   - Supported Formats: TXT, PDF, DOCX
   - Access: Authenticated users
   - AI Processing: Text extracted and analyzed by Google Gemini AI
   - Usage: Upload via meeting view, AI extracts tasks automatically

---

## Summary

This is a comprehensive meeting management system with:
- **20 main database tables** (companies, users, buildings, meetings, sections, topics, notes, tasks, decisions, task_notes, minutes_templates, user_buildings, building_documents, ai_analyses, task_attachments, task_analyses, topic_attachments, building_document_urls, genius_words, meeting_transcripts)
- **8 user types** with granular permissions (master, corporate_administrator, property_manager, user, owner, resident, vendor, attendee)
- **Multi-tenant architecture** (company → building → meeting hierarchy)
- **Full CRUD operations** for all entities
- **Meeting rollover** functionality
- **Task and decision tracking** with task notes and decision threading
- **Decision threading** for follow-up motions and amendments
- **PDF agenda and minutes generation** with customizable templates
- **Meeting notice distribution** via beautifully formatted HTML emails to owners/residents
- **AI-powered meeting transcript analysis** with automatic task extraction using Google Gemini
- **Comprehensive admin panel** with inline creation capabilities
- **User-building assignment** via junction table
- **Property manager assignment** for users
- **Enhanced company and building management** modals with tabbed interfaces
- **Topic and task attachments** for file management
- **Reference URLs** for building documents
- **Company logo management** with dashboard display
- **Signup API** for programmatic company and user creation
- **GeniusWords text shortcuts** for user productivity
- **Auto-save functionality** for topic descriptions
- **AI-powered analysis** of topics and tasks using extracted document text
- **AI-powered transcript task extraction** using Google Gemini AI
- **Meeting transcript upload and management** with automatic task extraction
- **Document text extraction** from PDFs, DOCX, and plain text files
- **Email notifications** via company-specific SMTP configurations
- **Meeting notification settings** per building (board/general meeting notice days, recipient types)
- **In-camera (confidential) meetings and topics** with meeting-level and topic-level privacy controls
- **Auto-reload functionality** for tasks, notes, and decisions
- **Modern React/Next.js** architecture with TypeScript

The system is designed for property management companies to manage their meeting workflows from agenda creation through minutes finalization and PDF generation, with support for multiple companies, buildings, and user roles. It includes robust privacy features (in-camera meetings/topics), comprehensive email notification system with professional HTML templates sent to owners and residents, detailed user role management distinguishing between owners and residents, and cutting-edge AI integration using Google Gemini for automatic task extraction from meeting transcripts.

---

**Last Updated**: January 27, 2026
**Version**: Current production codebase

**Recent Updates**:
- **Meeting Transcript Upload & AI Task Extraction** (NEW - Major Feature)
  - Added `meeting_transcripts` database table for storing transcript files
  - Integrated Google Gemini AI (models/gemini-2.5-flash) for intelligent task extraction
  - New dependency: @google/generative-ai (^0.24.1)
  - Upload transcripts in TXT, PDF, or DOCX format (max 10MB)
  - AI automatically analyzes transcripts and extracts action items with:
    - Task descriptions
    - Assigned persons (if mentioned)
    - Due dates (if mentioned)
    - Confidence scores (filtered to >= 0.5)
  - Three new API endpoints:
    - `/api/transcripts/upload`: Upload and process with AI
    - `/api/transcripts/list`: View transcript history
    - `/api/transcripts/create-tasks`: Batch create approved tasks
  - Three new modal components:
    - `UploadTranscriptModal`: Upload interface with file validation
    - `PreviewTasksModal`: Review/edit/approve AI-extracted tasks
    - `ViewTranscriptsModal`: View all uploaded transcripts with download/view options
  - Two new buttons in meeting view header:
    - "Upload Transcript" (purple button, working_agenda phase)
    - "View Transcripts" (gray button, working_agenda phase)
  - New Supabase Storage bucket: `meeting-transcripts`
  - Transcript records track: filename, file URL, size, mime type, extracted tasks, creation count
  - Users can edit extracted tasks before creating them
  - Assign each task to specific meeting topics before approval
  - Complete workflow with validation and error handling
  - AI prompt engineered to identify explicit and implicit task assignments
- **Send Meeting Notice Feature**: Email distribution system for meeting agendas (NEW)
  - Added "Send Notice" button in meeting view (available during working_agenda and agenda phases)
  - Sends beautifully formatted HTML emails to all owners/residents of building
  - Professional email template with gradients, icons, and responsive design
  - Includes full meeting details: title, date, time, location, strata plan
  - Shows complete agenda with all sections and topics (with descriptions)
  - Automatically filters recipients by user_type ('owner' or 'resident')
  - Fetches recipients from user_buildings junction table
  - Uses company SMTP configuration for sending emails
  - Confirmation dialog before sending with recipient count
  - Email includes Meeting Genius branding and professional footer
- **In-Camera (Confidential) Meetings & Topics**: Complete in-camera functionality
  - Added `is_incamera` field to `meetings` table for marking entire meetings as confidential
  - Added `is_incamera`, `incamera_start_time`, `incamera_end_time` fields to `topics` table
  - Meeting-level in-camera toggle in meeting view header
  - Topic-level in-camera toggle in TopicCard (available during meeting)
  - In-camera content hidden in published agendas and minutes PDFs
  - Only "This topic/meeting is in-camera" notices shown in PDFs
  - Visual indicators: red badges, lock icons, and warning banners
  - In-camera start/end time tracking for topics
  - Toggle available only when meeting is not finalized (for meeting-level)
- **Auto-Reload Fix**: Task, Note, and Decision auto-refresh
  - Fixed topic history and decisions not auto-reloading after creation
  - Implemented refresh callback system via `onRegisterTopicRefresh`
  - TopicCard automatically refreshes when modals save (TaskModal, NoteModal, DecisionModal)
  - No manual refresh needed - updates happen immediately
- **Meeting View UI Improvements**: Enhanced button layout
  - All action buttons now in single row with consistent sizing (h-8, px-3, text-xs)
  - Improved header layout: back button, title, badges, and edit button properly aligned
  - No overlap between admin button, user name, and meeting view buttons
  - Better responsive design with proper flex layouts
  - Added Send Notice button with email icon in action button row
- **Building Notification Settings**: Meeting notification configuration (Updated)
  - Added `board_meeting_notice_days`, `general_meeting_notice_days`, `notification_recipient_type` fields to buildings table
  - New Notifications tab in BuildingDetailsModal for configuring notification preferences
  - Auto-set recipient type based on building type (Housing Co-op → resident, Strata/Condo → owner)
  - Quick presets for notification schedules (Minimal, Standard, Extended, Reset)
  - Configurable days before meetings to send notices/agendas
  - Settings used for automated meeting notification emails
- **Owner User Type**: Added 'owner' as a distinct user type
  - Used for Strata/Condo and Rental buildings
  - Auto-assigned when creating users in these building types
  - Similar permissions to regular users
  - Receives meeting notifications based on building settings
- **User Type Auto-Assignment**: User type automatically set based on building type when creating users
  - Housing Co-op → 'user' type (displayed as 'resident')
  - Strata/Condo/Rental → 'owner' type
  - Visual badges for different user types in Users tab
- **Signup API**: Programmatic company creation endpoint
  - Added `/api/signup` endpoint for creating companies, corporate administrators, property managers, and buildings
  - API key-based authentication via `x-api-key` header
  - Creates complete company setup in one API call
  - Supports optional property manager and building creation
  - Configures company defaults (meeting sections, types) and SMTP settings
  - Automatic password hashing with bcrypt (10 salt rounds)
  - Transaction rollback on errors
  - Health check endpoint (GET `/api/signup`)
  - Complete API documentation in `MeetingGenius_API_Documentation.md` (legacy: `Meeting_Genius_Signup_API_Documentation.md`)
- **Decision Threading System**: Complete decision edit/thread/delete functionality
  - Added `parent_decision_id`, `edited_at` fields to decisions table
  - Edit existing decisions with history tracking
  - Create threaded child decisions for follow-up motions
  - Delete decisions (both parent and children)
  - Hierarchical display of threaded decisions in TopicCard
  - Icons and visual indicators for threaded decisions (CornerDownRight icon)
  - Edit and delete buttons inline for each decision

- **GeniusWords Feature**: User-specific text shortcuts system
  - Added `genius_words` table for storing user shortcuts (shortcode + description)
  - Created `GeniusWordsManager` component for managing shortcuts (create, edit, delete, search)
  - Created `GeniusWordsInput` reusable component with autocomplete support
  - Integrated GeniusWords autocomplete in decision modal, note modal, task modal, and topic descriptions
  - Shortcuts start with `#` and expand to full descriptions when selected
  - Keyboard navigation: Arrow keys, Enter to select, Escape to close

- **Decision Modal Enhancements**:
  - Added `@` mention autocomplete for meeting attendees
  - Added `#` GeniusWords autocomplete for user shortcuts
  - Both features work simultaneously with intelligent trigger detection
  - Autocomplete dropdowns with keyboard navigation
  - Attendee names and emails displayed in mention suggestions
  - Edit mode: Load and modify existing decisions
  - Threading mode: Create child decisions linked to parent

- **Auto-save Functionality**:
  - Topic descriptions auto-save with debounce (1 second delay)
  - Visual feedback with "Saving..." and "Saved" indicators
  - No manual save button needed for topic descriptions

- **Enhanced Topic Management**:
  - Topic attachments: Upload/download/delete files on topics
  - AI analysis includes both building documents AND topic attachments
  - Topic attachments stored in Supabase Storage (`topic-attachments` bucket)
  - Attachment management section with file list and upload button

- **User Type Addition**:
  - Added `owner` user type for property owners
  - Owners have similar permissions to regular users
  - Can view and edit meetings, update tasks, access assigned buildings

- **Attendee Roles**:
  - Added `role` field to attendee objects in `meetings.attendees` JSONB array
  - Enhanced AttendeeManagement component to support role assignment and editing
  - Roles displayed in attendees table and included in PDF minutes generation
  - Common roles: Chair, Secretary, Member, Treasurer

- **Document Management**:
  - Building document uploads and text extraction (PDF, DOCX, TXT)
  - Topic attachments for contextual file uploads
  - Task attachments for task-specific files
  - Reference URLs (building_document_urls table) for external links
  - Document types: rules, bylaws, policies, legislation, reference, other

- **Company Logo Management**:
  - Added `logo_url` field to `companies` table
  - Upload, view, and delete company logos via CompanyDetailsModal → Logo tab
  - Logo appears in dashboard header for all company users
  - Stored in Supabase Storage (`company-logos` bucket)
  - Supports PNG, JPG, SVG (max 2MB)
  - Master users see default Meeting Genius logo; company users see their company logo

- **AI Analysis Integration**:
  - Topic AI analysis: Analyzes topic description + building documents + topic attachments
  - Task AI analysis: Analyzes task description + building documents + task attachments
  - Results stored in `ai_analyses` and `task_analyses` tables
  - External n8n webhook integration for processing
  - Expandable analysis display in UI

- **Email System**:
  - Company-specific SMTP configuration in companies table
  - `/api/send-email` endpoint for sending emails via Nodemailer
  - SMTP settings managed in CompanyDetailsModal → Overview tab
  - Used for task assignment notifications and other system emails

- **UI/UX Improvements**:
  - Enhanced TopicCard with collapsible sections
  - Improved decision display with threading support
  - Delete confirmation modals for meetings and tasks
  - Toast notifications for user feedback (Sonner)
  - Loading states and error handling throughout

