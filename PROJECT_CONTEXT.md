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
- Support multiple companies, buildings, and user types
- Enable rollover of topics and tasks from previous meetings
- Provide role-based access control

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

### Other Dependencies
- **Date Handling**: date-fns
- **Charts**: Recharts
- **Notifications**: Sonner (toast notifications)
- **Analytics**: Vercel Analytics

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
}
```

**Default Values** (used when company has no defaults):
- **Meeting Sections**: "Call to Order", "Approval of Agenda", "Old Business / Business Arising", "New Business", "Financial Report", "Maintenance & Operations", "Correspondence", "Council Roundtable", "Adjournment"
- **Meeting Types**: "Council Meeting", "AGM", "SGM", "Special Meeting", "Emergency Meeting"
- **Decision Results**: "M/S/C", "Defeated", "Deferred"

**Purpose**: Stores company information and default configurations for meetings.

---

### 2. **users**
User accounts with role-based access.

```typescript
{
  id: number (primary key, auto-increment)
  name: string
  email: string (unique)
  password_hash: string
  user_type: 'master' | 'property_manager' | 'user' | 'vendor' | 'attendee' | 'corporate_administrator'
  company_id: number | null (foreign key → companies.id)
  smtp_config: any | null
  created_at: timestamp
  updated_at: timestamp
}
```

**Purpose**: Stores all user accounts with their roles and company associations.

**User Types**:
- `master`: Full system access across all companies
- `corporate_administrator`: Manages multiple property managers within their company
- `property_manager`: Manages buildings and meetings within their company
- `user`: Basic access to assigned buildings
- `vendor`: Receives and updates assigned tasks
- `attendee`: View-only access to meetings they attend

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
  created_at: timestamp
  updated_at: timestamp
}
```

**Purpose**: Represents physical buildings/properties. Each building belongs to a property manager and optionally a company.

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
  created_at: timestamp
  updated_at: timestamp
  finalized_at: timestamp | null
}
```

**Purpose**: Core meeting entity. Status flow: `working_agenda` → `agenda` → `working_minutes` → `minutes` (finalized).

**Attendees Structure** (JSONB):
```json
[
  {
    "name": "John Doe",
    "email": "john@example.com",
    "present": true
  }
]
```

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
  created_at: timestamp
  updated_at: timestamp
}
```

**Purpose**: Individual agenda items/topics. Can be rolled over from previous meetings via `rolled_over_from_topic_id`.

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
  status: 'open' | 'in_progress' | 'completed'
  external_update_token: string | null
  token_expires_at: timestamp | null
  created_by: number | null (foreign key → users.id)
  created_at: timestamp
  updated_at: timestamp
  completed_at: timestamp | null
}
```

**Purpose**: Tracks action items. Supports multiple assignees via JSONB array.

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
Decisions/motions recorded for topics.

```typescript
{
  id: number (primary key, auto-increment)
  topic_id: number (foreign key → topics.id)
  motion_text: string
  result: 'moved' | 'seconded' | 'carried' | 'defeated' | 'deferred' | null
  votes_for: number | null
  votes_against: number | null
  votes_abstain: number | null
  recorded_by: number | null (foreign key → users.id)
  recorded_at: timestamp
}
```

**Purpose**: Records formal decisions, motions, and voting results.

---

### Additional Tables (Referenced but not fully defined in code)
- **user_buildings**: Junction table linking users to buildings (many-to-many relationship)

---

## User Types & Permissions System

The system uses a centralized permission checking system located in `lib/permissions.ts`.

### User Type Hierarchy

1. **master** (System Administrator)
   - Full access to everything across all companies
   - Can manage all companies, users, buildings
   - Can see all data

2. **corporate_administrator** (Corporate Administrator)
   - Manages multiple property managers within their company
   - Can create/edit users, buildings, meetings
   - Can access admin panel
   - Sees only data within their company

3. **property_manager** (Property Manager)
   - Manages buildings and meetings within their company
   - Can create/edit users, buildings, meetings
   - Can access admin panel
   - Sees only their assigned buildings

4. **user** (Standard User)
   - Basic access to assigned buildings
   - Can view and edit meetings (not create)
   - Cannot access admin panel

5. **vendor** (Vendor/Contractor)
   - Receives and updates assigned tasks
   - Can view meetings (read-only)
   - Can update task status for tasks assigned to them

6. **attendee** (Meeting Attendee)
   - View-only access to meetings they attend
   - Cannot edit anything
   - Cannot access admin panel

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
- Attendee management with presence tracking

### 2. **Topic & Section Management**
- Organize topics into sections
- Add descriptions to topics
- Track rollover history (which topic came from which previous meeting)
- Drag-and-drop reordering

### 3. **Task Management**
- Create tasks from topics
- Assign to multiple people (from meeting attendees or manual entry)
- Track status: open → in_progress → completed
- Due date tracking
- External update tokens for vendor access

### 4. **Decision Recording**
- Record motions/resolutions
- Track voting results (for, against, abstain)
- Company-specific decision result options
- Link decisions to topics

### 5. **Notes System**
- Add notes to topics
- Track who created each note
- Timestamp tracking

### 6. **Admin Panel**
- User management (create, edit, assign to companies/buildings)
- Building management (create, edit, configure templates)
- Company management (create, edit, set defaults)
- Document management (upload/view building documents)
- Minutes templates management

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

2. **`components/dashboard.tsx`**
   - Lists all meetings and tasks
   - Building and meeting type filters
   - Search functionality
   - Meeting status display
   - Edit/delete meeting actions

3. **`components/meeting-view.tsx`**
   - Main meeting interface
   - Displays sections and topics
   - Drag-and-drop reordering
   - Timer functionality
   - Status progression controls
   - Attendee management
   - Section/topic creation modals

4. **`components/admin-panel.tsx`**
   - Admin interface with tabs
   - Users, Buildings, Companies, Minutes Templates tabs
   - Modal management for CRUD operations

#### **Modal Components**

- `components/create-meeting-modal.tsx`: Create new meetings with rollover support
- `components/EditMeetingModal.tsx`: Edit meeting details
- `components/task-modal.tsx`: Create/edit tasks
- `components/note-modal.tsx`: Add/edit notes
- `components/decision-modal.tsx`: Record decisions
- `components/create-section-modal.tsx`: Create sections
- `components/create-topic-modal.tsx`: Create topics
- `components/AttendeeManagement.tsx`: Manage meeting attendees

#### **Admin Components** (`components/admin/`)

- `CreateUserModal.tsx`: Create users
- `CreateBuildingModal.tsx`: Create buildings
- `EditBuildingModal.tsx`: Edit buildings
- `CreateCompanyModal.tsx`: Create companies
- `EditCompanyModal.tsx`: Edit companies
- `CompanyDetailsModal.tsx`: View company details
- `UsersTab.tsx`: User management interface
- `BuildingsTab.tsx`: Building management interface
- `CompaniesTab.tsx`: Company management interface
- `MinutesTemplatesTab.tsx`: Template management
- `DocumentManagementModal.tsx`: Upload/view documents
- `ViewDocumentModal.tsx`: View document content
- `AssignUsersToCompanyModal.tsx`: Assign users to companies

#### **UI Components** (`components/ui/`)

All shadcn/ui style components:
- Button, Card, Dialog, Input, Select, Textarea, Badge, etc.
- Full component library for consistent UI

#### **Card Components**

- `components/meeting-card.tsx`: Meeting display card
- `components/topic-card.tsx`: Topic display with actions
- `components/task-card.tsx`: Task display card

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

1. User clicks "Record Decision" on a topic
2. `DecisionModal` opens
3. System fetches company's decision result options
4. User enters motion text, result, votes
5. Decision saved to `decisions` table

### 6. **User Access Control**

1. User logs in
2. System checks `user_type` and `company_id`
3. Dashboard filters buildings based on:
   - **master**: All buildings
   - **corporate_administrator**: Buildings in their company
   - **property_manager**: Buildings they manage
   - **user**: Buildings assigned to them
   - **vendor/attendee**: Limited access

---

## File Structure

```
meeting-genius/
├── app/
│   ├── layout.tsx              # Root layout with metadata
│   ├── page.tsx                 # Main application entry point
│   └── globals.css              # Global styles
│
├── components/
│   ├── admin/                   # Admin panel components
│   │   ├── CreateUserModal.tsx
│   │   ├── CreateBuildingModal.tsx
│   │   ├── EditBuildingModal.tsx
│   │   ├── CreateCompanyModal.tsx
│   │   ├── EditCompanyModal.tsx
│   │   ├── CompanyDetailsModal.tsx
│   │   ├── UsersTab.tsx
│   │   ├── BuildingsTab.tsx
│   │   ├── CompaniesTab.tsx
│   │   └── ...
│   │
│   ├── ui/                      # shadcn/ui components
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── dialog.tsx
│   │   └── ... (40+ components)
│   │
│   ├── admin-panel.tsx          # Main admin interface
│   ├── dashboard.tsx             # Main dashboard
│   ├── meeting-view.tsx         # Meeting interface
│   ├── create-meeting-modal.tsx  # Create meeting
│   ├── EditMeetingModal.tsx      # Edit meeting
│   ├── task-modal.tsx            # Task creation/editing
│   ├── note-modal.tsx            # Note creation/editing
│   ├── decision-modal.tsx        # Decision recording
│   ├── create-section-modal.tsx  # Create section
│   ├── create-topic-modal.tsx    # Create topic
│   ├── AttendeeManagement.tsx   # Attendee management
│   ├── topic-card.tsx            # Topic display
│   ├── task-card.tsx             # Task display
│   ├── meeting-card.tsx          # Meeting display
│   ├── timer.tsx                 # Meeting timer
│   ├── login-form.tsx            # Login form
│   └── theme-provider.tsx        # Theme management
│
├── lib/
│   ├── supabase.ts              # Supabase client & types
│   ├── auth.ts                   # Authentication functions
│   ├── permissions.ts            # Permission system
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
├── package.json                 # Dependencies
├── tsconfig.json                 # TypeScript config
├── next.config.mjs              # Next.js config
├── tailwind.config.js           # Tailwind config
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
}
```

### 2. **Company Defaults**

Companies can set default configurations:
- `default_meeting_sections`: Default section names when creating meetings
- `default_meeting_types`: Available meeting types
- `default_decision_results`: Decision result options

These are used when creating new meetings. If a company doesn't have defaults set, the system falls back to standard defaults (see companies table documentation above).

### 3. **Drag and Drop**

Uses `@hello-pangea/dnd` for reordering:
- Sections can be reordered
- Topics can be reordered within sections
- Order stored in `order_index` field

### 4. **JSONB Fields**

Several fields use JSONB for flexible data:
- `meetings.attendees`: Array of attendee objects
- `tasks.assignees`: Array of assignee objects
- `buildings.rules_document`: Document content
- `buildings.agenda_template`: Template content
- `buildings.minutes_template`: Template content

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
- `minutes`: Read-only, finalized

### 7. **External Task Updates**

Tasks have `external_update_token` and `token_expires_at` fields for vendor access without full login.

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
    "present": true
  }
]
```

### 10. **TypeScript Types**

All database types defined in `lib/supabase.ts` as `Database` type:
- Ensures type safety
- Auto-completion in IDE
- Prevents typos in table/column names

---

## Development Notes

### Running the Project

```bash
npm install
npm run dev
```

### Building for Production

```bash
npm run build
npm start
```

### Environment

- Supabase URL and keys are hardcoded in `lib/supabase.ts` (should be moved to env variables)
- No `.env` file currently used

### Authentication

- Currently uses simple password check ("123456" for all users)
- Password hashing functions exist but not fully implemented
- Should implement proper bcrypt password verification

### Database Connection

- Supabase client initialized in `lib/supabase.ts`
- All queries use the Supabase client
- No connection pooling or special configuration

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

### Permission Checks

```typescript
import { canCreateMeeting } from '@/lib/permissions'

if (!canCreateMeeting(currentUser?.user_type)) {
  // Show error or hide button
}
```

---

## Future Considerations

1. **Authentication**: Implement proper password hashing and verification
2. **Environment Variables**: Move Supabase credentials to `.env` file
3. **Error Handling**: Add comprehensive error handling and user feedback
4. **Testing**: Add unit and integration tests
5. **Documentation**: Add JSDoc comments to functions
6. **Performance**: Optimize queries, add pagination
7. **Security**: Implement Row Level Security (RLS) in Supabase
8. **Real-time**: Add Supabase real-time subscriptions for live updates
9. **File Storage**: Implement proper file storage for audio files and documents
10. **Email Notifications**: Implement email sending for task assignments

---

## Summary

This is a comprehensive meeting management system with:
- **9 main database tables** (companies, users, buildings, meetings, sections, topics, notes, tasks, decisions)
- **6 user types** with granular permissions
- **Multi-tenant architecture** (company → building → meeting hierarchy)
- **Full CRUD operations** for all entities
- **Meeting rollover** functionality
- **Task and decision tracking**
- **Admin panel** for system management
- **Modern React/Next.js** architecture with TypeScript

The system is designed for property management companies to manage their meeting workflows from agenda creation through minutes finalization.

---

**Last Updated**: Based on codebase analysis
**Version**: Current production codebase

