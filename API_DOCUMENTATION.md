# 📚 Alpha Ultimate ERP v13 — API Documentation

## Base URL

```
Development:  http://localhost:3000/api
Production:   https://your-domain.com/api
```

## Authentication

All endpoints (except `/auth/login`) require Bearer token authentication:

```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     -H "Content-Type: application/json" \
     https://api.example.com/api/invoices
```

## Response Format

### Success Response (2xx)
```json
{
  "status": "ok",
  "data": { /* endpoint-specific data */ }
}
```

### Error Response (4xx, 5xx)
```json
{
  "error": "Descriptive error message",
  "status": 400,
  "timestamp": "2024-03-14T10:30:00Z"
}
```

---

## 🔐 Authentication Endpoints

### POST `/auth/login`

Login with credentials.

**Request:**
```json
{
  "username": "admin",
  "password": "Admin@12345"
}
```

**Response (200):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "usr_123",
    "username": "admin",
    "full_name": "Administrator",
    "email": "admin@example.com",
    "role": "superuser",
    "department": "IT",
    "avatar_url": null,
    "permissions": {
      "finance": "full_control",
      "invoices": "full_control",
      "expenses": "full_control"
    }
  }
}
```

**Errors:**
- `400` — Username and password required
- `401` — Invalid credentials
- `500` — Server error

---

### GET `/auth/me`

Get current logged-in user info.

**Headers:**
```
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json
```

**Response (200):**
```json
{
  "user": {
    "id": "usr_123",
    "username": "admin",
    "full_name": "Administrator",
    "email": "admin@example.com",
    "role": "superuser",
    "department": "IT",
    "phone": "+1234567890",
    "whatsapp_number": "+1234567890",
    "avatar_url": "https://...",
    "id_photo_url": "https://...",
    "id_number": "ID12345",
    "nationality": "US",
    "permissions": {
      "finance": "full_control",
      "invoices": "full_control"
    }
  }
}
```

**Errors:**
- `401` — Unauthorized / Token invalid
- `404` — User not found

---

## 💰 Invoices Endpoints

### GET `/invoices`

Get all invoices (with filters).

**Query Parameters:**
```
status=draft|pending|approved|paid|cancelled
customer_id=cust_123
date_from=2024-01-01
date_to=2024-12-31
limit=50
offset=0
```

**Response (200):**
```json
{
  "invoices": [
    {
      "id": "inv_123",
      "invoice_number": "INV-2024-001",
      "customer_id": "cust_456",
      "customer_name": "Acme Corp",
      "amount": 1500.00,
      "tax_amount": 225.00,
      "grand_total": 1725.00,
      "status": "draft",
      "created_at": "2024-03-10T10:00:00Z",
      "due_date": "2024-04-10",
      "line_items": [
        {
          "id": "li_789",
          "description": "Service delivery",
          "quantity": 2,
          "unit_price": 500.00,
          "tax_percent": 15,
          "amount": 1000.00
        }
      ]
    }
  ],
  "total": 150,
  "limit": 50,
  "offset": 0
}
```

---

### POST `/invoices`

Create new invoice.

**Request:**
```json
{
  "customer_id": "cust_456",
  "due_date": "2024-04-10",
  "line_items": [
    {
      "description": "Service delivery",
      "quantity": 2,
      "unit_price": 500.00,
      "tax_percent": 15
    }
  ],
  "notes": "Payment due within 30 days"
}
```

**Response (201):**
```json
{
  "invoice": {
    "id": "inv_123",
    "invoice_number": "INV-2024-001",
    "customer_id": "cust_456",
    "amount": 1000.00,
    "tax_amount": 150.00,
    "grand_total": 1150.00,
    "status": "draft",
    "created_at": "2024-03-14T10:30:00Z"
  }
}
```

---

### PATCH `/invoices/:id`

Update invoice.

**Request:**
```json
{
  "status": "pending",
  "due_date": "2024-04-15",
  "notes": "Updated notes"
}
```

**Response (200):**
```json
{
  "invoice": { /* updated invoice */ }
}
```

---

### POST `/invoices/:id/approve`

Approve invoice (moves to approved status).

**Response (200):**
```json
{
  "message": "Invoice approved successfully",
  "invoice": { /* updated invoice */ }
}
```

---

### POST `/invoices/:id/publish`

Publish invoice (send to customer).

**Request:**
```json
{
  "send_email": true,
  "email_message": "Your invoice is ready for payment"
}
```

**Response (200):**
```json
{
  "message": "Invoice published successfully",
  "email_sent": true
}
```

---

### DELETE `/invoices/:id`

Delete invoice (draft only).

**Response (200):**
```json
{
  "message": "Invoice deleted successfully"
}
```

**Error (400):** Cannot delete non-draft invoice

---

## 💸 Expenses Endpoints

### GET `/expenses`

Get all expenses.

**Query Parameters:**
```
status=draft|pending|approved|rejected
category=office|travel|supplies|other
date_from=2024-01-01
date_to=2024-12-31
```

**Response (200):**
```json
{
  "expenses": [
    {
      "id": "exp_123",
      "description": "Office supplies",
      "amount": 150.50,
      "category": "supplies",
      "status": "pending",
      "created_by": "usr_123",
      "created_at": "2024-03-14T10:00:00Z",
      "receipts": [
        {
          "url": "https://...",
          "filename": "receipt.pdf"
        }
      ]
    }
  ],
  "total": 50
}
```

---

### POST `/expenses`

Create new expense.

**Request:**
```json
{
  "description": "Office supplies",
  "amount": 150.50,
  "category": "supplies",
  "date": "2024-03-14",
  "notes": "Printer ink and paper"
}
```

**Response (201):**
```json
{
  "expense": {
    "id": "exp_123",
    "description": "Office supplies",
    "amount": 150.50,
    "status": "draft"
  }
}
```

---

## 👥 Users Endpoints

### GET `/users`

Get all users.

**Query Parameters:**
```
role=admin|user|viewer
is_active=true|false
department=IT|HR|Finance
```

**Response (200):**
```json
{
  "users": [
    {
      "id": "usr_123",
      "username": "john.doe",
      "full_name": "John Doe",
      "email": "john@example.com",
      "role": "user",
      "department": "IT",
      "is_active": true,
      "last_login": "2024-03-14T10:00:00Z",
      "created_at": "2024-01-01T00:00:00Z"
    }
  ],
  "total": 25
}
```

---

### POST `/users`

Create new user (admin only).

**Request:**
```json
{
  "username": "jane.doe",
  "full_name": "Jane Doe",
  "email": "jane@example.com",
  "password": "SecurePassword123!",
  "role": "user",
  "department": "HR"
}
```

**Response (201):**
```json
{
  "user": {
    "id": "usr_456",
    "username": "jane.doe",
    "full_name": "Jane Doe",
    "email": "jane@example.com",
    "role": "user"
  }
}
```

---

## 📊 Reports Endpoints

### GET `/reports/financial`

Get financial report.

**Query Parameters:**
```
start_date=2024-01-01
end_date=2024-03-31
group_by=daily|weekly|monthly
```

**Response (200):**
```json
{
  "report": {
    "period": "2024-Q1",
    "revenue": 25000.00,
    "expenses": 8500.00,
    "profit": 16500.00,
    "trend": [
      { "date": "2024-01-01", "revenue": 8000, "expenses": 3000 },
      { "date": "2024-02-01", "revenue": 9000, "expenses": 2800 },
      { "date": "2024-03-01", "revenue": 8000, "expenses": 2700 }
    ]
  }
}
```

---

### GET `/reports/invoices`

Get invoice report.

**Query Parameters:**
```
status=all|paid|pending|overdue
date_from=2024-01-01
date_to=2024-12-31
```

**Response (200):**
```json
{
  "report": {
    "total_invoices": 45,
    "total_value": 125000.00,
    "paid": 35,
    "pending": 8,
    "overdue": 2,
    "by_customer": [
      {
        "customer_id": "cust_123",
        "customer_name": "Acme Corp",
        "invoice_count": 5,
        "total_value": 25000.00,
        "paid": 4,
        "pending": 1
      }
    ]
  }
}
```

---

## 🏷️ Customers Endpoints

### GET `/customers`

Get all customers.

**Query Parameters:**
```
status=active|inactive
search=keyword
limit=50
offset=0
```

**Response (200):**
```json
{
  "customers": [
    {
      "id": "cust_123",
      "name": "Acme Corporation",
      "email": "contact@acme.com",
      "phone": "+1234567890",
      "city": "New York",
      "country": "US",
      "is_active": true,
      "total_invoices": 15,
      "total_paid": 75000.00,
      "balance_due": 5000.00
    }
  ],
  "total": 120
}
```

---

### POST `/customers`

Create new customer.

**Request:**
```json
{
  "name": "Acme Corporation",
  "email": "contact@acme.com",
  "phone": "+1234567890",
  "address": "123 Main St",
  "city": "New York",
  "country": "US",
  "tax_id": "12-3456789"
}
```

**Response (201):**
```json
{
  "customer": {
    "id": "cust_123",
    "name": "Acme Corporation",
    "email": "contact@acme.com"
  }
}
```

---

## 📁 Files/Media Endpoints

### POST `/upload`

Upload file (image, PDF, document).

**Form Data:**
```
file: <binary file data>
entity_type: invoice|expense|customer|user
entity_id: <id>
```

**Response (200):**
```json
{
  "file": {
    "id": "media_123",
    "url": "https://cdn.example.com/uploads/media_123.pdf",
    "filename": "invoice.pdf",
    "size": 245632,
    "type": "application/pdf"
  }
}
```

---

## ⚠️ Error Codes

| Code | Meaning | Solution |
|------|---------|----------|
| 400 | Bad Request | Check request format and parameters |
| 401 | Unauthorized | Login again or refresh token |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource doesn't exist |
| 409 | Conflict | Duplicate or conflicting data |
| 422 | Unprocessable | Validation error — check data |
| 429 | Too Many Requests | Rate limited — wait before retry |
| 500 | Server Error | Contact support |

---

## 🔄 Pagination

Endpoints that return lists use pagination:

```json
{
  "items": [ /* array of items */ ],
  "total": 500,
  "limit": 50,
  "offset": 0,
  "has_more": true
}
```

**To get next page:**
```
GET /endpoint?limit=50&offset=50
```

---

## 🔐 Permission Levels

When calling APIs, your permissions determine what you can access:

| Level | Can Read | Can Create | Can Update | Can Delete | Can Approve |
|-------|----------|-----------|-----------|-----------|------------|
| `none` | ❌ | ❌ | ❌ | ❌ | ❌ |
| `view_own` | Own only | ❌ | Own only | ❌ | ❌ |
| `view_all` | All | ❌ | ❌ | ❌ | ❌ |
| `submit_only` | Own | ✅ | Own | ❌ | ❌ |
| `view_with_details` | All | ❌ | ❌ | ❌ | ❌ |
| `report_view` | All | ❌ | ❌ | ❌ | ❌ |
| `report_with_details` | All | ❌ | ❌ | ❌ | ❌ |
| `full_control` | All | ✅ | All | ✅ | ✅ |

---

## 💻 SDK Usage

### JavaScript/TypeScript

```typescript
import { api } from './lib/api'

// Get invoices
const { invoices } = await api.get<{ invoices: Invoice[] }>('/invoices')

// Create invoice
const { invoice } = await api.post<{ invoice: Invoice }>('/invoices', {
  customer_id: 'cust_123',
  amount: 1000,
  due_date: '2024-04-15'
})

// Update invoice
await api.patch('/invoices/inv_123', {
  status: 'approved'
})

// Delete invoice
await api.delete('/invoices/inv_123')
```

---

## 🧪 Testing API

### Using cURL

```bash
# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"Admin@12345"}'

# Use returned token
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# Get invoices
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/invoices

# Create invoice
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "customer_id":"cust_123",
    "amount":1000,
    "due_date":"2024-04-15"
  }' \
  http://localhost:3000/api/invoices
```

### Using Postman

1. Import the included `Postman Collection.json`
2. Set environment variables:
   - `BASE_URL`: http://localhost:3000
   - `TOKEN`: (auto-populated after login)
3. Run pre-configured requests

---

## 📞 Support

For API issues:
1. Check status endpoint: `/api/health`
2. Review error response message
3. Check logs: `npm run logs`
4. Contact: support@alpha-01.com

