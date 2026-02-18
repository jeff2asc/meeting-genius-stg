# Meeting Genius API Documentation

**Version:** 1.0  
**Base URL (Production):** `http://45.59.114.16:3000/api`  
**Base URL (Local):** `http://localhost:3000/api`  
**Authentication:** API Key via `x-api-key` header  
**API Key:** `meeting-genius-secret-key-2026`

---

## Table of Contents
1. [Authentication](#authentication)
2. [Company Signup API](#1-company-signup-api)
3. [Send Email API](#2-send-email-api)
4. [Dynamic Pricing API](#3-dynamic-pricing-api)
5. [Transcript APIs](#4-transcript-apis)
6. [Bulk User Import API](#5-bulk-user-import-api)
7. [Error Codes](#error-codes)

---

## Authentication

All API endpoints require authentication via the `x-api-key` header.

**Header Format:**
```
x-api-key: meeting-genius-secret-key-2026
```

**Example Request (cURL):**
```bash
curl -H "x-api-key: meeting-genius-secret-key-2026" \
  http://45.59.114.16:3000/api/pricing/company-data?company_id=8
```

**Example Request (PowerShell):**
```powershell
Invoke-RestMethod -Uri "http://45.59.114.16:3000/api/pricing/company-data?company_id=8" \
  -Method GET -Headers @{"x-api-key"="meeting-genius-secret-key-2026"}
```

---

## 1. Company Signup API

Create a complete company setup including corporate administrator, property manager, and building in one API call.

### **Endpoint**
```
POST /api/signup
```

### **Request Body**
```json
{
  "company_name": "New Life Housing",
  "corporate_admin_name": "John Doe",
  "corporate_admin_email": "john@newlife.com",
  "corporate_admin_password": "SecurePassword123",
  "building_name": "Main Building",
  "building_address": "123 Main St, City, State",
  "building_type": "Strata/Condo",
  "property_manager_name": "Jane Smith",
  "property_manager_email": "jane@newlife.com",
  "property_manager_password": "SecurePassword456",
  "default_meeting_sections": [
    "Call to Order",
    "Approval of Minutes",
    "New Business",
    "Adjournment"
  ],
  "default_meeting_types": [
    "Board Meeting",
    "Annual General Meeting"
  ],
  "smtp_config": {
    "host": "smtp.gmail.com",
    "port": 587,
    "user": "noreply@newlife.com",
    "password": "smtp_password",
    "from_name": "New Life Housing",
    "from_email": "noreply@newlife.com",
    "use_tls": true
  }
}
```

### **Required Fields**
- `company_name` (string)
- `corporate_admin_name` (string)
- `corporate_admin_email` (string)
- `corporate_admin_password` (string)

### **Optional Fields**
- `building_name` (string)
- `building_address` (string)
- `building_type` (string) - Options: "Strata/Condo", "Rental", "Housing Co-op"
- `property_manager_name` (string)
- `property_manager_email` (string)
- `property_manager_password` (string)
- `default_meeting_sections` (array of strings)
- `default_meeting_types` (array of strings)
- `smtp_config` (object)

### **Response (Success - 201)**
```json
{
  "success": true,
  "message": "Signup completed successfully",
  "data": {
    "company": {
      "id": 1,
      "name": "New Life Housing"
    },
    "corporate_admin": {
      "id": 10,
      "name": "John Doe",
      "email": "john@newlife.com"
    },
    "building": {
      "id": 5,
      "name": "Main Building"
    },
    "property_manager": {
      "id": 11,
      "name": "Jane Smith",
      "email": "jane@newlife.com"
    }
  }
}
```

### **Response (Error - 400)**
```json
{
  "error": "Missing required fields: company_name, corporate_admin_name, corporate_admin_email, corporate_admin_password"
}
```

### **Response (Error - 409)**
```json
{
  "error": "Corporate admin email already exists"
}
```

### **Health Check**
```
GET /api/signup
```

**Response:**
```json
{
  "status": "ok",
  "message": "Signup API is running",
  "timestamp": "2026-02-15T18:00:00.000Z"
}
```

---

## 2. Send Email API

Send emails using company-specific SMTP configuration.

### **Endpoint**
```
POST /api/send-email
```

### **Request Body**
```json
{
  "company_id": 8,
  "to": "recipient@example.com",
  "subject": "Meeting Agenda - February 15, 2026",
  "html": "<h1>Meeting Agenda</h1><p>Your meeting is scheduled for...</p>",
  "text": "Meeting Agenda\n\nYour meeting is scheduled for..."
}
```

### **Required Fields**
- `company_id` (number) - Company ID for SMTP configuration
- `to` (string) - Recipient email address
- `subject` (string) - Email subject line
- `html` (string) - HTML email content

### **Optional Fields**
- `text` (string) - Plain text fallback

### **Response (Success - 200)**
```json
{
  "success": true,
  "messageId": "<smtp-message-id@example.com>"
}
```

### **Response (Error - 400)**
```json
{
  "error": "SMTP not configured for this company"
}
```

### **Response (Error - 500)**
```json
{
  "error": "Failed to connect to SMTP server",
  "details": "Connection timeout"
}
```

---

## 3. Dynamic Pricing API

Get company billing data for Odoo integration. Returns property manager counts and building counts per company.

### **Endpoint 1: Get All Companies List**
```
POST /api/pricing/company-data
```

### **Request Headers**
```
x-api-key: meeting-genius-secret-key-2026
```

### **Response (Success - 200)**
```json
{
  "success": true,
  "total_companies": 11,
  "companies": [
    {
      "id": 8,
      "name": "Sunrise Property Management"
    },
    {
      "id": 9,
      "name": "Metro Property Groupz"
    },
    {
      "id": 10,
      "name": "Coast Property Management"
    }
  ]
}
```

---

### **Endpoint 2: Get Company Billing Data**
```
GET /api/pricing/company-data?company_id={id}
```

### **Query Parameters**
- `company_id` (number, required) - Company ID to fetch data for

### **Request Headers**
```
x-api-key: meeting-genius-secret-key-2026
```

### **Response (Success - 200)**
```json
{
  "success": true,
  "company_id": 8,
  "company_name": "Sunrise Property Management",
  "total_pm_count": 2,
  "total_building_count": 15,
  "property_managers": [
    {
      "pm_id": 24,
      "pm_name": "John Smith",
      "pm_email": "john@sunrise.com",
      "building_count": 8,
      "buildings": [
        {
          "building_id": 1,
          "building_name": "Building A",
          "building_address": "123 Main St"
        },
        {
          "building_id": 2,
          "building_name": "Building B",
          "building_address": "456 Oak Ave"
        }
      ]
    },
    {
      "pm_id": 25,
      "pm_name": "Jane Doe",
      "pm_email": "jane@sunrise.com",
      "building_count": 5,
      "buildings": [
        {
          "building_id": 10,
          "building_name": "Tower C",
          "building_address": "789 Pine Rd"
        }
      ]
    }
  ],
  "unassigned_buildings": [
    {
      "building_id": 99,
      "building_name": "New Building - Unassigned",
      "building_address": "999 New St"
    },
    {
      "building_id": 100,
      "building_name": "Building Z",
      "building_address": "N/A"
    }
  ],
  "unassigned_building_count": 2
}
```

### **Response Fields Explained**
- `total_pm_count`: Total number of property managers in the company
- `total_building_count`: Total buildings (assigned + unassigned)
- `property_managers`: Array of PMs with their assigned buildings
- `unassigned_buildings`: Buildings with no property manager assigned
- `unassigned_building_count`: Count of unassigned buildings

### **Response (Error - 400)**
```json
{
  "error": "Missing required parameter: company_id"
}
```

### **Response (Error - 404)**
```json
{
  "error": "Company not found",
  "details": "No company with ID 999"
}
```

### **Use Case: Odoo Billing Integration**

Odoo can call this API daily to calculate billing based on building count:

1. Call `POST /api/pricing/company-data` to get all companies
2. For each company, call `GET /api/pricing/company-data?company_id=X`
3. Use `total_building_count` to calculate monthly billing
4. Invoice corporate administrator based on building count

**Pricing Example:**
- 1-5 buildings: $X/month
- 6-20 buildings: $Y/month
- 21+ buildings: $Z/month

---

## 4. Transcript APIs

Upload meeting transcripts and extract tasks using Google Gemini AI.

### **Endpoint 1: Upload Transcript**
```
POST /api/transcripts/upload
```

### **Request Body (FormData)**
```
file: [transcript file - PDF, TXT, or DOCX]
meeting_id: 123
user_id: 456
```

### **Response (Success - 200)**
```json
{
  "success": true,
  "transcript_id": 789,
  "extracted_tasks": [
    {
      "description": "Follow up with vendor about plumbing repairs",
      "assigned_name": "John Smith",
      "due_date": "2026-02-20",
      "confidence": 0.95
    },
    {
      "description": "Schedule annual general meeting",
      "assigned_name": null,
      "due_date": "2026-03-01",
      "confidence": 0.85
    }
  ],
  "message": "Successfully extracted 2 tasks"
}
```

---

### **Endpoint 2: List Transcripts**
```
GET /api/transcripts/list?meeting_id={id}
```

### **Query Parameters**
- `meeting_id` (number, required)

### **Response (Success - 200)**
```json
{
  "transcripts": [
    {
      "id": 789,
      "meeting_id": 123,
      "filename": "meeting-notes.pdf",
      "file_url": "https://supabase.co/storage/...",
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

---

### **Endpoint 3: Create Tasks from Transcript**
```
POST /api/transcripts/create-tasks
```

### **Request Body**
```json
{
  "transcript_id": 789,
  "user_id": 456,
  "tasks": [
    {
      "description": "Follow up with vendor",
      "assigned_name": "John Smith",
      "assigned_email": "john@example.com",
      "due_date": "2026-02-20",
      "topic_id": 100
    },
    {
      "description": "Schedule AGM",
      "assigned_name": "Jane Doe",
      "assigned_email": "jane@example.com",
      "due_date": "2026-03-01",
      "topic_id": 101
    }
  ]
}
```

### **Response (Success - 200)**
```json
{
  "success": true,
  "created_count": 2,
  "task_ids": [500, 501],
  "message": "Successfully created 2 tasks"
}
```

---

## 5. Bulk User Import API

Import multiple users from CSV data.

### **Endpoint**
```
POST /api/users/bulk-import
```

### **Request Body**
```json
{
  "users": [
    {
      "name": "John Doe",
      "email": "john@example.com",
      "user_type": "owner",
      "password": "password123",
      "building_name": "Building A",
      "building_id": 5,
      "row_number": 1
    },
    {
      "name": "Jane Smith",
      "email": "jane@example.com",
      "user_type": "resident",
      "password": "password456",
      "building_name": "Building A",
      "building_id": 5,
      "row_number": 2
    }
  ],
  "building_id": 5,
  "building_type": "Strata/Condo",
  "company_id": 8,
  "manager_id": 24
}
```

### **Response (Success - 200)**
```json
{
  "created": 2,
  "skipped": 0,
  "errors": []
}
```

### **Response (With Errors)**
```json
{
  "created": 1,
  "skipped": 1,
  "errors": [
    "Row 2: Email already exists: jane@example.com"
  ]
}
```

---

## Error Codes

| Status Code | Description |
|-------------|-------------|
| 200 | Success |
| 201 | Created successfully |
| 400 | Bad Request - Missing or invalid parameters |
| 401 | Unauthorized - Invalid API key |
| 404 | Not Found - Resource does not exist |
| 405 | Method Not Allowed - Wrong HTTP method |
| 409 | Conflict - Resource already exists |
| 500 | Internal Server Error - Server-side error |

---

## Common Error Response Format

All errors follow this format:

```json
{
  "error": "Error message description",
  "details": "Additional error details (optional)"
}
```

---

## Rate Limiting

Currently, there are no rate limits enforced. However, it's recommended to:
- Implement rate limiting for production use
- Cache responses when possible
- Avoid excessive API calls (max 1 call per second recommended)

---

## Support

For API support or questions, contact:
- **Email:** support@meetinggenius.ca
- **Documentation:** http://meetinggenius.ca/docs

---

## Changelog

### Version 1.0 (February 15, 2026)
- ✅ Company Signup API
- ✅ Send Email API
- ✅ Dynamic Pricing API (NEW)
- ✅ Transcript Upload & AI Task Extraction APIs
- ✅ Bulk User Import API

---

**End of API Documentation**
