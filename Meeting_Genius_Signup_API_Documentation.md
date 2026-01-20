# Meeting Genius - Signup API Documentation

## Overview

The **Signup API** creates a new company, corporate administrator, optional property manager, and optional building in one request.

- **Base URL (dev):** `http://localhost:3000`
- **Base URL (prod):** `https://yourdomain.com`
- **Endpoint:** `POST /api/signup`
- **Auth:** Static API key in header

---

## Authentication

Every request must include a valid API key.

**Header:**
```
x-api-key: meeting-genius-secret-key-2026
```

**Note:** Replace with your actual production API key.

---

## Endpoint: Create Company + Admin + Optional PM & Building

### URL

```
POST /api/signup
```

### Headers

```
Content-Type: application/json
x-api-key: YOUR_API_KEY
```

---

## Request Body

Send a JSON object with the following fields:

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `company_name` | string | Name of the company |
| `corporate_admin_name` | string | Full name of the corporate administrator |
| `corporate_admin_email` | string | Email address (must be unique) |
| `corporate_admin_password` | string | Password (will be hashed) |

### Optional Fields

| Field | Type | Description |
|-------|------|-------------|
| `building_name` | string | Name of the building to create |
| `building_address` | string | Street address of the building |
| `building_type` | string | One of: `Strata/Condo`, `Rental Building`, `Housing Co-op` (default: `Strata/Condo`) |
| `property_manager_name` | string | Full name of property manager |
| `property_manager_email` | string | Email address for property manager |
| `property_manager_password` | string | Password for property manager (will be hashed) |
| `default_meeting_sections` | array | Array of default section names for meetings |
| `default_meeting_types` | array | Array of default meeting type names |
| `smtp_config` | object | SMTP email configuration (see below) |

### SMTP Config Object

```json
{
  "host": "smtp.example.com",
  "port": 587,
  "user": "noreply@example.com",
  "password": "smtp_password",
  "from_name": "Company Name",
  "from_email": "noreply@example.com",
  "use_tls": true
}
```

---

## Business Logic

1. **Company** is created first
2. **Corporate Administrator** is created and linked to the company
3. **Property Manager** (optional) is created if credentials are provided
4. **Building** (optional) is created with:
   - `manager_id` = Property Manager ID (if provided)
   - `manager_id` = Corporate Admin ID (if no property manager)

---

## Example Requests

### Minimal Request (Company + Corporate Admin only)

```json
{
  "company_name": "Acme Properties",
  "corporate_admin_name": "John Smith",
  "corporate_admin_email": "john@acme.com",
  "corporate_admin_password": "SecurePass123!"
}
```

### Full Request (With Property Manager + Building)

```json
{
  "company_name": "Success Co",
  "corporate_admin_name": "Admin User",
  "corporate_admin_email": "admin@success.com",
  "corporate_admin_password": "Pass123!",
  "building_name": "Victory Tower",
  "building_address": "500 Success Blvd",
  "building_type": "Strata/Condo",
  "property_manager_name": "Manager Jane",
  "property_manager_email": "jane@success.com",
  "property_manager_password": "Manager789!",
  "default_meeting_sections": [
    "Call to Order",
    "Approval of Minutes",
    "Old Business",
    "New Business",
    "Adjournment"
  ],
  "default_meeting_types": [
    "Board Meeting",
    "Annual General Meeting",
    "Special General Meeting"
  ],
  "smtp_config": {
    "host": "smtp.gmail.com",
    "port": 587,
    "user": "noreply@success.com",
    "password": "smtp_password_here",
    "from_name": "Success Co",
    "from_email": "noreply@success.com",
    "use_tls": true
  }
}
```

### Request with Rental Building Type

```json
{
  "company_name": "Rental Properties Inc",
  "corporate_admin_name": "Sarah Johnson",
  "corporate_admin_email": "sarah@rental.com",
  "corporate_admin_password": "Pass456!",
  "building_name": "Downtown Apartments",
  "building_address": "123 Main Street",
  "building_type": "Rental Building"
}
```

---

## Response Format

### Success Response (201 Created)

```json
{
  "success": true,
  "message": "Signup completed successfully",
  "data": {
    "company": {
      "id": 18,
      "name": "Success Co"
    },
    "corporate_admin": {
      "id": 50,
      "name": "Admin User",
      "email": "admin@success.com"
    },
    "building": {
      "id": 20,
      "name": "Victory Tower"
    },
    "property_manager": {
      "id": 51,
      "name": "Manager Jane",
      "email": "jane@success.com"
    }
  }
}
```

**Note:** `building` and `property_manager` will be `null` if not provided in the request.

---

## Error Responses

### 401 Unauthorized - Invalid API Key

```json
{
  "error": "Unauthorized: Invalid API key"
}
```

### 400 Bad Request - Missing Required Fields

```json
{
  "error": "Missing required fields: company_name, corporate_admin_name, corporate_admin_email, corporate_admin_password"
}
```

### 409 Conflict - Email Already Exists

```json
{
  "error": "Corporate admin email already exists"
}
```

### 500 Internal Server Error

```json
{
  "error": "Failed to create company",
  "details": { ... }
}
```

---

## cURL Examples

### PowerShell (Windows)

```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/signup" `
  -Method Post `
  -Headers @{"Content-Type"="application/json";"x-api-key"="meeting-genius-secret-key-2026"} `
  -Body '{
    "company_name":"Test Co",
    "corporate_admin_name":"John Doe",
    "corporate_admin_email":"john@test.com",
    "corporate_admin_password":"Pass123!",
    "building_name":"Test Building",
    "building_address":"123 Test St"
  }'
```

### Bash/Linux/Mac

```bash
curl -X POST http://localhost:3000/api/signup \
  -H "Content-Type: application/json" \
  -H "x-api-key: meeting-genius-secret-key-2026" \
  -d '{
    "company_name": "Test Co",
    "corporate_admin_name": "John Doe",
    "corporate_admin_email": "john@test.com",
    "corporate_admin_password": "Pass123!",
    "building_name": "Test Building",
    "building_address": "123 Test St"
  }'
```

### JavaScript (Fetch API)

```javascript
const response = await fetch('http://localhost:3000/api/signup', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': 'meeting-genius-secret-key-2026'
  },
  body: JSON.stringify({
    company_name: 'Test Co',
    corporate_admin_name: 'John Doe',
    corporate_admin_email: 'john@test.com',
    corporate_admin_password: 'Pass123!',
    building_name: 'Test Building',
    building_address: '123 Test St'
  })
});

const data = await response.json();
console.log(data);
```

### Python

```python
import requests

url = 'http://localhost:3000/api/signup'
headers = {
    'Content-Type': 'application/json',
    'x-api-key': 'meeting-genius-secret-key-2026'
}
payload = {
    'company_name': 'Test Co',
    'corporate_admin_name': 'John Doe',
    'corporate_admin_email': 'john@test.com',
    'corporate_admin_password': 'Pass123!',
    'building_name': 'Test Building',
    'building_address': '123 Test St'
}

response = requests.post(url, json=payload, headers=headers)
print(response.json())
```

---

## Health Check Endpoint

### URL

```
GET /api/signup
```

### Response

```json
{
  "status": "ok",
  "message": "Signup API is running",
  "timestamp": "2026-01-19T14:35:00.000Z"
}
```

---

## Security Notes

1. **API Key:** Store in environment variables, never commit to version control
2. **Passwords:** Automatically hashed with bcrypt (salt rounds: 10)
3. **Email Validation:** Checks for duplicate emails before creating users
4. **HTTPS:** Always use HTTPS in production
5. **Rate Limiting:** Consider implementing rate limiting for production

---

## Support

For questions or issues, contact your development team.

**Last Updated:** January 19, 2026  
**Version:** 1.0
