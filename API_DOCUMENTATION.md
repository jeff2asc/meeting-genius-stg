# Meeting Genius API Documentation

This document outlines all internal (private) and external (public/authenticated) API endpoints available in the Meeting Genius platform.

## Public / System APIs (Requires `x-api-key`)

All endpoints below require the `x-api-key` header to be sent with the request for security verification.

### 1. Janus Integration Sync
* **Endpoint**: `/api/janus/v1/sync`
* **Methods**: 
  * `GET`: Returns a complete, transformed payload of organizations (companies), properties (buildings), and audience (users) for the Janus integration.
  * `POST`: Handshake endpoint. 
    * Body: `{ "action": "handshake" }`
    * Response: Returns the active status and capabilities of the integration.

### 2. Pricing & Company Data
* **Endpoint**: `/api/pricing/company-data`
* **Methods**:
  * `GET`: Calculates the billing tier based on building counts.
    * Query Parameters: `?company_id=123`
    * Response: Total assigned/unassigned building counts, Property Manager breakdown, and target Odoo billing tier.
  * `POST`: Fetches a global list of all company IDs and names for usage references.

### 3. Email Dispatcher
* **Endpoint**: `/api/send-email`
* **Methods**:
  * `POST`: Dispatches an email using a company's custom SMTP configuration. 
    * Body: `{ "companyId": 123, "to": "user@email.com", "subject": "Hello", "html": "<b>Hello</b>", "text": "optional plaintext" }`

### 4. Company Onboarding / Signup
* **Endpoint**: `/api/signup`
* **Methods**:
  * `GET`: Quick health check.
  * `POST`: Core tenant initialization endpoint.
    * Body: `{ "company_name", "corporate_admin_name", "corporate_admin_email", "corporate_admin_password", "building_name", "building_address", "building_type", "property_manager_name", "property_manager_email", "property_manager_password", "default_meeting_sections", "default_meeting_types", "smtp_config": { "host": "...", "port": ..., "user": "...", "password": "...", "from_name": "...", "from_email": "...", "use_tls": true } }`
    * Behavior: Seeds the `companies`, `users`, and `buildings` tables in one atomic flow.

### 5. Transcript Upload & Analysis
* **Endpoint**: `/api/transcripts/upload`
* **Methods**:
  * `POST`: Uploads a meeting transcript and immediately runs the Gemini AI extraction for actionable tasks.
    * Body (Multipart Form): `file` (max 10MB limit, `.txt`, `.pdf`, `.docx`), `meeting_id`, `user_id`.

### 6. Bulk User Import
* **Endpoint**: `/api/users/bulk-import`
* **Methods**:
  * `POST`: Safely imports and maps hundreds of system users. 
    * Body: `{ "users": [ { "name": "...", "email": "...", "user_type": "...", "password": "...", "row_number": 1 } ], "buildingId": 1, "buildingType": "...", "companyId": 1, "managerId": 1 }`

---

## Public (Unauthenticated)

### 7. Reset Password Flow
* **Endpoint**: `/api/reset-password`
* **Methods**:
  * `POST`:
    * Request Link Body: `{ "action": "request", "email": "user@email.com" }`
    * Finalize Reset Body: `{ "action": "reset", "email": "user@email.com", "token": "uuid", "newPassword": "str" }`
    * Behavior: Uses the user's mapped company SMTP if available, otherwise falls back to a system-wide unified mailer configuration.

---

## Private / Internal APIs (Uses User Session RLS context)

These endpoints rely on `@/lib/supabase` configured for Next.js Server Components / Handlers. They enforce RLS (Row Level Security) implicitly via the user's active session. 

### 8. Fetch Meeting Transcripts
* **Endpoint**: `/api/transcripts/list`
* **Methods**:
  * `GET`: Fetches previous meeting transcripts along with their uploader metadata.
    * Query Parameters: `?meeting_id=123`

### 9. Create Derived Meeting Tasks
* **Endpoint**: `/api/transcripts/create-tasks`
* **Methods**:
  * `POST`: Commits AI-extracted actionable tasks into the database context for tracking.
    * Body: `{ "transcript_id": 1, "tasks": [ { "description": "...", "topic_id": 1, "assigned_name": "...", "assigned_email": "...", "due_date": "YYYY-MM-DD" } ], "user_id": 123 }`
