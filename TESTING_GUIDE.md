# 🧪 Alpha Ultimate ERP v13 — Advanced Testing Guide

**Comprehensive testing strategies, automation, and quality assurance**

---

## 📋 Table of Contents

1. [Unit Testing](#unit-testing)
2. [Integration Testing](#integration-testing)
3. [API Testing](#api-testing)
4. [E2E Testing](#e2e-testing)
5. [Performance Testing](#performance-testing)
6. [Security Testing](#security-testing)
7. [Load Testing](#load-testing)
8. [Testing Tools & Setup](#testing-tools--setup)

---

## 🧪 Unit Testing

### Testing Framework Setup

```bash
npm install --save-dev vitest @testing-library/react @testing-library/jest-dom
```

### Example: Auth Context Tests

```typescript
// src/lib/__tests__/AuthContext.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { AuthProvider, useAuth } from '../AuthContext'

describe('AuthContext', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('should initialize with null user when no token', () => {
    const TestComponent = () => {
      const { user, ready } = useAuth()
      return <>{ready && !user ? 'logged-out' : 'logged-in'}</>
    }

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    expect(screen.getByText('logged-out')).toBeInTheDocument()
  })

  it('should restore user from localStorage', () => {
    const mockUser = {
      id: 'usr_123',
      username: 'admin',
      email: 'admin@example.com',
      full_name: 'Administrator',
      role: 'superuser',
      permissions: {},
    }

    localStorage.setItem('erp_token', 'test-token')
    localStorage.setItem('erp_user', JSON.stringify(mockUser))

    const TestComponent = () => {
      const { user } = useAuth()
      return <>{user?.username}</>
    }

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    expect(screen.getByText('admin')).toBeInTheDocument()
  })

  it('should handle login failure gracefully', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ error: 'Invalid credentials' }),
      })
    ) as any

    const TestComponent = () => {
      const { login, error } = useAuth()
      return (
        <>
          <button onClick={() => login('admin', 'wrong')}>Login</button>
          {error && <div>{error}</div>}
        </>
      )
    }

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    const button = screen.getByText('Login')
    button.click()

    await waitFor(() => {
      expect(screen.getByText('Invalid credentials')).toBeInTheDocument()
    })
  })
})
```

### Testing API Utility

```typescript
// src/lib/__tests__/api.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { api } from '../api'

describe('API Utility', () => {
  beforeEach(() => {
    global.fetch = vi.fn()
    localStorage.clear()
  })

  it('should attach authorization header', async () => {
    localStorage.setItem('erp_token', 'test-token-123')

    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ data: 'test' }),
      })
    ) as any

    await api.get('/invoices')

    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer test-token-123',
        }),
      })
    )
  })

  it('should retry on network errors', async () => {
    let attempts = 0
    global.fetch = vi.fn(() => {
      attempts++
      if (attempts < 3) {
        return Promise.reject(new TypeError('Network error'))
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      })
    }) as any

    const result = await api.get('/test')

    expect(attempts).toBe(3)
    expect(global.fetch).toHaveBeenCalledTimes(3)
  })

  it('should handle 401 by redirecting to login', async () => {
    const originalLocation = window.location
    delete (window as any).location
    window.location = { href: '' } as any

    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ error: 'Unauthorized' }),
      })
    ) as any

    try {
      await api.get('/protected')
    } catch (e) {
      // Expected
    }

    expect(window.location.href).toBe('/login')

    window.location = originalLocation
  })
})
```

---

## 🔗 Integration Testing

### Testing Complete Workflows

```typescript
// __tests__/workflows/invoice.workflow.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { api } from '@/lib/api'

describe('Invoice Workflow', () => {
  let invoiceId: string
  let customerId: string

  beforeEach(async () => {
    // Setup: Create test customer
    const customerRes = await api.post('/customers', {
      name: 'Test Customer',
      email: 'test@example.com',
      phone: '+1234567890',
    })
    customerId = customerRes.customer.id
  })

  it('should complete full invoice lifecycle', async () => {
    // Step 1: Create invoice
    const createRes = await api.post('/invoices', {
      customer_id: customerId,
      due_date: '2024-04-15',
      line_items: [
        {
          description: 'Service',
          quantity: 1,
          unit_price: 1000,
          tax_percent: 15,
        },
      ],
    })

    invoiceId = createRes.invoice.id
    expect(createRes.invoice.status).toBe('draft')
    expect(createRes.invoice.grand_total).toBe(1150)

    // Step 2: Approve invoice
    const approveRes = await api.post(`/invoices/${invoiceId}/approve`)
    expect(approveRes.invoice.status).toBe('approved')

    // Step 3: Publish invoice
    const publishRes = await api.post(`/invoices/${invoiceId}/publish`, {
      send_email: true,
    })
    expect(publishRes.email_sent).toBe(true)

    // Step 4: Verify invoice state
    const getRes = await api.get(`/invoices/${invoiceId}`)
    expect(getRes.invoice.status).toBe('published')
    expect(getRes.invoice.published_at).toBeDefined()
  })

  it('should handle approval workflow correctly', async () => {
    // Cannot approve already approved invoice
    const invoice = await api.post('/invoices', {
      customer_id: customerId,
      amount: 1000,
    })

    await api.post(`/invoices/${invoice.invoice.id}/approve`)

    // Try to approve again
    expect(async () => {
      await api.post(`/invoices/${invoice.invoice.id}/approve`)
    }).rejects.toThrow('Already approved')
  })
})
```

---

## 📡 API Testing

### Using Postman/Insomnia

**Test Collection Structure:**

```json
{
  "info": {
    "name": "Alpha ERP API Tests",
    "version": "1.0.0"
  },
  "auth": {
    "type": "bearer",
    "bearer": [
      {
        "key": "token",
        "value": "{{JWT_TOKEN}}",
        "type": "string"
      }
    ]
  },
  "item": [
    {
      "name": "Authentication",
      "item": [
        {
          "name": "Login",
          "request": {
            "method": "POST",
            "header": [
              {
                "key": "Content-Type",
                "value": "application/json"
              }
            ],
            "body": {
              "mode": "raw",
              "raw": "{\"username\":\"admin\",\"password\":\"Admin@12345\"}"
            },
            "url": {
              "raw": "{{BASE_URL}}/api/auth/login",
              "host": ["{{BASE_URL}}"],
              "path": ["api", "auth", "login"]
            }
          },
          "event": [
            {
              "listen": "test",
              "script": {
                "exec": [
                  "var jsonData = pm.response.json();",
                  "pm.environment.set(\"JWT_TOKEN\", jsonData.token);"
                ]
              }
            }
          ]
        }
      ]
    }
  ]
}
```

### cURL Testing Script

```bash
#!/bin/bash
# test-api.sh — Automated API testing

BASE_URL="http://localhost:3000"
ADMIN_USER="admin"
ADMIN_PASS="Admin@12345"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Function to test endpoint
test_endpoint() {
  local method=$1
  local endpoint=$2
  local data=$3
  local expected_status=$4
  local description=$5

  echo "Testing: $description"

  if [ -z "$TOKEN" ]; then
    response=$(curl -s -w "\n%{http_code}" -X "$method" \
      -H "Content-Type: application/json" \
      -d "$data" \
      "$BASE_URL/api$endpoint")
  else
    response=$(curl -s -w "\n%{http_code}" -X "$method" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $TOKEN" \
      -d "$data" \
      "$BASE_URL/api$endpoint")
  fi

  status=$(echo "$response" | tail -n1)
  body=$(echo "$response" | sed '$d')

  if [ "$status" -eq "$expected_status" ]; then
    echo -e "${GREEN}✓ PASSED${NC} (HTTP $status)"
    TESTS_PASSED=$((TESTS_PASSED + 1))
  else
    echo -e "${RED}✗ FAILED${NC} (Expected $expected_status, got $status)"
    echo "Response: $body"
    TESTS_FAILED=$((TESTS_FAILED + 1))
  fi
  echo ""
}

# 1. Test Login
echo "=== Testing Authentication ==="
login_response=$(curl -s -X POST \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$ADMIN_USER\",\"password\":\"$ADMIN_PASS\"}" \
  "$BASE_URL/api/auth/login")

TOKEN=$(echo $login_response | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo -e "${RED}✗ Login failed${NC}"
  exit 1
fi

echo -e "${GREEN}✓ Login successful${NC}"
echo ""

# 2. Test Protected Endpoints
echo "=== Testing Protected Endpoints ==="

test_endpoint "GET" "/auth/me" "" 200 "Get current user"

test_endpoint "GET" "/invoices" "" 200 "List invoices"

test_endpoint "GET" "/customers" "" 200 "List customers"

test_endpoint "GET" "/reports/financial" "" 200 "Get financial report"

# 3. Test Data Creation
echo "=== Testing Data Creation ==="

test_endpoint "POST" "/customers" \
  '{"name":"Test Customer","email":"test@example.com"}' \
  201 "Create customer"

test_endpoint "POST" "/invoices" \
  '{"customer_id":"cust_123","amount":1000}' \
  201 "Create invoice"

# 4. Test Error Handling
echo "=== Testing Error Handling ==="

test_endpoint "GET" "/invoices/nonexistent" "" 404 "Get nonexistent invoice"

test_endpoint "POST" "/invoices" \
  '{"invalid":"data"}' \
  400 "Create invoice with invalid data"

# Summary
echo "=== Test Summary ==="
echo -e "Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Failed: ${RED}$TESTS_FAILED${NC}"

if [ $TESTS_FAILED -eq 0 ]; then
  echo -e "${GREEN}All tests passed!${NC}"
  exit 0
else
  echo -e "${RED}Some tests failed!${NC}"
  exit 1
fi
```

---

## 🎬 E2E Testing

### Setup with Playwright

```bash
npm install --save-dev @playwright/test
npx playwright install
```

### Example E2E Tests

```typescript
// e2e/invoice.spec.ts
import { test, expect } from '@playwright/test'

test.describe('Invoice Management', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to login
    await page.goto('http://localhost:5173/login')

    // Login
    await page.fill('input[type="text"]', 'admin')
    await page.fill('input[type="password"]', 'Admin@12345')
    await page.click('button:has-text("Sign In")')

    // Wait for dashboard
    await page.waitForURL('http://localhost:5173/')
  })

  test('should create new invoice', async ({ page }) => {
    // Navigate to invoices
    await page.click('a:has-text("Invoices")')
    await page.waitForURL('**/invoices')

    // Click create button
    await page.click('button:has-text("New Invoice")')
    await page.waitForURL('**/invoices/new')

    // Fill form
    await page.click('input[placeholder="Select Customer"]')
    await page.click('text=Acme Corp')

    await page.fill('input[placeholder="Due Date"]', '2024-04-15')

    // Add line item
    await page.click('button:has-text("Add Item")')
    await page.fill('input[placeholder="Description"]', 'Service')
    await page.fill('input[placeholder="Quantity"]', '2')
    await page.fill('input[placeholder="Unit Price"]', '500')

    // Submit
    await page.click('button:has-text("Save")')

    // Verify success
    await expect(page).toHaveURL('**/invoices/*')
    await expect(page.locator('text=Invoice created successfully')).toBeVisible()
  })

  test('should approve invoice', async ({ page }) => {
    // Navigate to invoice detail
    await page.goto('http://localhost:5173/invoices/inv_123')

    // Click approve button
    await page.click('button:has-text("Approve")')

    // Confirm in dialog
    await page.click('button:has-text("Confirm")')

    // Verify status changed
    await expect(page.locator('text=Approved')).toBeVisible()
  })

  test('should filter invoices', async ({ page }) => {
    await page.goto('http://localhost:5173/invoices')

    // Filter by status
    await page.click('select[name="status"]')
    await page.click('option[value="pending"]')

    // Wait for filtered results
    await page.waitForLoadState('networkidle')

    // Verify only pending invoices shown
    const invoices = await page.locator('[data-status]').all()
    for (const invoice of invoices) {
      await expect(invoice).toHaveAttribute('data-status', 'pending')
    }
  })
})
```

---

## ⚡ Performance Testing

### Using Lighthouse

```bash
# Install Lighthouse CI
npm install --save-dev @lhci/cli@0.8.x @lhci/github-actions

# Run tests
lhci autorun

# Or manually
lighthouse http://localhost:5173 --view
```

### Web Vitals Testing

```typescript
// e2e/performance.spec.ts
import { test, expect } from '@playwright/test'

test('should meet Core Web Vitals thresholds', async ({ page }) => {
  await page.goto('http://localhost:5173/')

  const metrics = {
    LCP: 0, // Largest Contentful Paint
    FID: 0, // First Input Delay
    CLS: 0, // Cumulative Layout Shift
  }

  // Collect metrics
  const lcpEntry = await page.evaluate(() => {
    return new Promise((resolve) => {
      new PerformanceObserver((entryList) => {
        const entries = entryList.getEntries()
        const lastEntry = entries[entries.length - 1]
        resolve(lastEntry.renderTime || lastEntry.loadTime)
      }).observe({ entryTypes: ['largest-contentful-paint'] })
    })
  })

  metrics.LCP = (lcpEntry as number) / 1000

  // Verify thresholds
  expect(metrics.LCP).toBeLessThan(2.5) // Should be < 2.5s
  expect(metrics.FID).toBeLessThan(0.1) // Should be < 100ms
  expect(metrics.CLS).toBeLessThan(0.1) // Should be < 0.1
})
```

---

## 🔐 Security Testing

### OWASP Testing

```typescript
// e2e/security.spec.ts
import { test, expect } from '@playwright/test'

test.describe('Security Tests', () => {
  test('should prevent XSS attacks', async ({ page }) => {
    await page.goto('http://localhost:5173/login')

    // Attempt XSS in form
    const xssPayload = '<script>alert("XSS")</script>'

    await page.fill('input[type="text"]', xssPayload)
    await page.fill('input[type="password"]', 'password')

    // Script should not execute
    let scriptExecuted = false
    page.on('dialog', () => {
      scriptExecuted = true
    })

    await page.click('button:has-text("Sign In")')

    expect(scriptExecuted).toBe(false)
  })

  test('should enforce HTTPS in production', async ({ page }) => {
    // Only in production
    if (process.env.NODE_ENV === 'production') {
      const response = await page.goto('http://example.com/api/invoices')

      // Should redirect to HTTPS
      expect(response?.url()).toMatch(/^https:/)
    }
  })

  test('should not expose sensitive data in URLs', async ({ page }) => {
    await page.goto('http://localhost:5173/login')

    await page.fill('input[type="text"]', 'admin')
    await page.fill('input[type="password"]', 'Admin@12345')
    await page.click('button:has-text("Sign In")')

    await page.waitForURL('**/dashboard')

    // Check localStorage for token (should exist)
    const token = await page.evaluate(() => localStorage.getItem('erp_token'))
    expect(token).toBeTruthy()

    // But URL should NOT contain token
    expect(page.url()).not.toContain('token')
  })

  test('should prevent CSRF attacks', async ({ page, context }) => {
    // Set up authenticated session
    await page.goto('http://localhost:5173/login')
    await page.fill('input[type="text"]', 'admin')
    await page.fill('input[type="password"]', 'Admin@12345')
    await page.click('button:has-text("Sign In")')

    // Create request from different origin
    const response = await context.request.post(
      'http://localhost:3000/api/invoices',
      {
        data: { customer_id: 'cust_123', amount: 1000 },
        headers: {
          Origin: 'https://malicious-site.com',
        },
      }
    )

    // Should be rejected or require CSRF token
    expect(response.status()).not.toBe(200)
  })
})
```

---

## 📊 Load Testing

### Using k6

```bash
npm install -g k6
```

### Load Test Script

```javascript
// tests/load-test.js
import http from 'k6/http'
import { check, sleep } from 'k6'

export const options = {
  vus: 100,         // 100 virtual users
  duration: '30s',  // 30 second test
  thresholds: {
    http_req_duration: ['p(99)<1500'], // 99% of requests < 1.5s
    http_req_failed: ['<0.1'],          // Less than 10% failures
  },
}

let token = ''

export default function () {
  // Login once per user
  if (!token) {
    const loginRes = http.post('http://localhost:3000/api/auth/login', {
      username: 'admin',
      password: 'Admin@12345',
    })

    check(loginRes, {
      'login success': (r) => r.status === 200,
    })

    token = loginRes.json('token')
  }

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  }

  // Test invoices endpoint
  const invoicesRes = http.get('http://localhost:3000/api/invoices?limit=50', {
    headers,
  })

  check(invoicesRes, {
    'invoices list success': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  })

  sleep(1)

  // Test dashboard
  const dashboardRes = http.get('http://localhost:3000/api/reports/financial', {
    headers,
  })

  check(dashboardRes, {
    'dashboard success': (r) => r.status === 200,
  })

  sleep(2)
}
```

**Run Load Test:**

```bash
k6 run tests/load-test.js
```

---

## 🛠️ Testing Tools & Setup

### Complete Test Configuration

```bash
# Install all testing tools
npm install --save-dev \
  vitest \
  @testing-library/react \
  @testing-library/jest-dom \
  @playwright/test \
  jest-mock-extended \
  @vitest/ui
```

### Test Scripts in package.json

```json
{
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest --coverage",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:load": "k6 run tests/load-test.js",
    "test:api": "bash test-api.sh",
    "test:all": "npm run test && npm run test:e2e && npm run test:api"
  }
}
```

### Test Coverage Report

```bash
npm run test:coverage
```

Generates coverage report in `coverage/` directory.

---

## ✅ Testing Checklist

Before releasing to production:

```
✅ Unit Tests
   [ ] AuthContext tests passing
   [ ] API utility tests passing
   [ ] Component tests passing
   [ ] Coverage > 80%

✅ Integration Tests
   [ ] Login flow working
   [ ] Invoice workflow complete
   [ ] Data persistence verified
   [ ] Error handling tested

✅ API Tests
   [ ] All endpoints tested
   [ ] Error codes verified
   [ ] Authorization working
   [ ] Rate limiting tested

✅ E2E Tests
   [ ] Login flow working
   [ ] Invoice creation complete
   [ ] Approval workflow tested
   [ ] Filtering & search working

✅ Performance Tests
   [ ] Core Web Vitals met
   [ ] Page load < 2s
   [ ] API response < 500ms
   [ ] Bundle size optimized

✅ Security Tests
   [ ] XSS prevention verified
   [ ] CSRF protection working
   [ ] SQL injection prevented
   [ ] No sensitive data in logs

✅ Load Tests
   [ ] 100 concurrent users
   [ ] < 1500ms response time
   [ ] < 10% failure rate
   [ ] Database under load tested
```

---

## 📞 Continuous Integration

### GitHub Actions Example

```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432

    steps:
      - uses: actions/checkout@v3
      
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run unit tests
        run: npm run test

      - name: Build frontend
        run: npm run build

      - name: Run E2E tests
        run: npm run test:e2e

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/coverage-final.json
```

---

This comprehensive testing guide ensures your ERP system maintains high quality, security, and performance standards throughout development and production.

