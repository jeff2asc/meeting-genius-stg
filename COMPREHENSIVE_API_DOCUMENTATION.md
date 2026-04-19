# Comprehensive API Documentation: Meeting Genius & Janus

This document provides a unified catalog of all API endpoints for both the **Meeting Genius** and **Janus** platforms. It covers public, private, and planned endpoints to support a transition toward a headless architecture and third-party integrations.

---

## 1. Meeting Genius APIs

Meeting Genius uses Next.js API routes with Supabase for data persistence. Most internal APIs enforce Row Level Security (RLS) via the user's session.

### Public / System APIs (Requires `x-api-key`)
**Header:** `x-api-key: meeting-genius-secret-key-2026`

#### **Janus Integration Sync**
*   **Endpoint:** `/api/janus/v1/sync`
*   **Methods:**
    *   `GET`: Returns a counts summary (companies, buildings, users) to verify bridge health.
    *   `POST`: Receives a push payload from Meeting Genius to sync data into Janus.
*   **Description:** Facilitates the 1:1 data bridge between platforms.

#### **Company Signup / Onboarding**
*   **Endpoint:** `/api/signup`
*   **Methods:**
    *   `POST`: Creates a company, corporate admin, property manager, and initial building in one atomic operation.
    *   `GET`: Health check for the signup service.
*   **Key Fields:** `company_name`, `corporate_admin_email`, `smtp_config`.

#### **Dynamic Pricing & Company Data**
*   **Endpoint:** `/api/pricing/company-data`
*   **Methods:**
    *   `GET`: Returns billing tier and building counts for a specific `company_id`.
    *   `POST`: Generic list of all companies for reference.
*   **Use Case:** Integration with Odoo for automated billing.

#### **Email Dispatcher**
*   **Endpoint:** `/api/send-email`
*   **Method:** `POST`
*   **Description:** Dispatches emails using the custom SMTP configuration of a specific company.

#### **Transcript Upload & AI Analysis**
*   **Endpoint:** `/api/transcripts/upload`
*   **Method:** `POST` (Multipart)
*   **Description:** Uploads a meeting transcript and triggers Gemini AI to extract actionable tasks.

#### **Bulk User Import**
*   **Endpoint:** `/api/users/bulk-import`
*   **Method:** `POST`
*   **Description:** Batch imports users into a building context.

### Private / Internal APIs (Session Auth)

#### **Meeting Transcripts Management**
*   **Endpoint:** `/api/transcripts/list` (`GET`) - Returns transcripts for a `meeting_id`.
*   **Endpoint:** `/api/transcripts/create-tasks` (`POST`) - Saves AI-extracted tasks into the database.

#### **Authentication & Security**
*   **Endpoint:** `/api/reset-password`
    *   `POST { action: "request" }`: Sends a reset link via SMTP.
    *   `POST { action: "reset" }`: Updates the password using a secure token.
*   **Endpoint:** `/api/verify-captcha` (Planned) - Placeholder for future bot protection.

---

## 2. Janus APIs

Janus is the AI-powered triage and workflow engine. It features extensive automation for email intake and ticket management.

### Public APIs (Requires `x-api-key`)
**Header:** `x-api-key: meeting-genius-secret-key-2026`

#### **Bridge Sync Service**
*   **Endpoints:** `GET /api/mg/sync`, `POST /api/mg/sync`, `POST /api/janus/v1/sync`
*   **Description:** Mirroring endpoints for the Meeting Genius bridge. `v1/sync` supports CORS for browser-side calls.

#### **Resident Self-Help Action**
*   **Endpoint:** `GET /api/self-help/action?ticket_id={id}&action={yes|no}`
*   **Description:** Open endpoint (no auth) for residents to accept/decline AI-generated DIY repair guides via email buttons.

### Private / Core Automation

#### **Email Intake Triage**
*   **Endpoint:** `/api/email-intake` (`POST`)
*   **Description:** The "brain" of Janus. Classifies incoming emails (Repair, Complaint, Self-Help) using AI and triggers workflows.

#### **3-Way Communication**
*   **Endpoint:** `/api/send-reply` (`POST`)
*   **Description:** PM dashboard reply tool. Mirrors messages to Resident, Vendor, and External Authorities based on ticket type.

#### **Vendor Management**
*   **Endpoint:** `/api/notify-vendor` (`POST`) - Dispatches work orders.
*   **Endpoint:** `DELETE /api/admin/vendors/[id]` - Removes vendor records.

### AI & Admin Utilities
*   **`/api/extract-rules`**: Uses Gemini to parse building bylaws from PDFs.
*   **`/api/admin/sync-emails`**: Manual/Cron trigger for IMAP email polling.
*   **`/api/admin/test-smtp`**: Validation tool for SMTP credentials.
*   **`/api/admin/bridge/pull`**: Manually pulls data from Meeting Genius Cloud.

---

## 3. Future / Planned Endpoints (Roadmap)

To support a full "Headless" architecture, the following endpoints are planned for retrofit:

| Endpoint | Method | Priority | Target |
|---|---|---|---|
| `/api/v1/meetings` | `GET/POST` | High | Wrap direct Supabase queries for agendas/minutes |
| `/api/v1/tasks` | `GET/PATCH` | High | Programmatic task updates for external vendors |
| `/api/v1/buildings` | `GET` | Medium | Role-aware building directory |
| `/api/v1/workflows`| `POST` | Low | Dynamic creation of Janus automation rules |

---

## 4. Shared Security Standards

*   **Authentication:** 
    *   **External:** Static API Key (`x-api-key`). Transitioning to rotated env-based keys in Phase 2.
    *   **Internal:** NextAuth / Supabase session context (RLS).
*   **Error Format:**
    ```json
    {
      "error": "Short description",
      "details": "Extended technical info (optional)",
      "success": false
    }
    ```
*   **Base URLs:**
    *   **Meeting Genius:** `https://meetinggenius.ca/api`
    *   **Janus:** `https://janus.asccreative.com/api`
