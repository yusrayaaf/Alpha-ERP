# 📊 Alpha Ultimate ERP v13 — Advanced Monitoring & Observability Guide

**Production monitoring, logging, metrics, and observability best practices**

---

## 🎯 Observability Stack

### The Three Pillars

1. **Logs** — Application event records
2. **Metrics** — Quantitative measurements (CPU, memory, requests)
3. **Traces** — Request flow through system

---

## 📝 Logging Strategy

### Structured Logging Setup

```typescript
// src/lib/logger.ts
interface LogContext {
  userId?: string
  requestId?: string
  [key: string]: unknown
}

class Logger {
  private context: LogContext = {}

  setContext(ctx: LogContext) {
    this.context = { ...this.context, ...ctx }
  }

  private formatLog(level: string, message: string, data?: unknown) {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: this.context,
      data,
      environment: process.env.NODE_ENV,
    }
  }

  debug(message: string, data?: unknown) {
    if (process.env.NODE_ENV !== 'production') {
      console.log(JSON.stringify(this.formatLog('DEBUG', message, data)))
    }
  }

  info(message: string, data?: unknown) {
    console.log(JSON.stringify(this.formatLog('INFO', message, data)))
  }

  warn(message: string, data?: unknown) {
    console.warn(JSON.stringify(this.formatLog('WARN', message, data)))
  }

  error(message: string, error?: Error, data?: unknown) {
    const errorData = error
      ? {
          message: error.message,
          stack: error.stack,
          name: error.name,
        }
      : undefined

    console.error(
      JSON.stringify(this.formatLog('ERROR', message, { ...data, error: errorData }))
    )
  }

  fatal(message: string, error?: Error, data?: unknown) {
    const errorData = error
      ? {
          message: error.message,
          stack: error.stack,
          name: error.name,
        }
      : undefined

    console.error(
      JSON.stringify(this.formatLog('FATAL', message, { ...data, error: errorData }))
    )
    process.exit(1)
  }
}

export const logger = new Logger()
```

### API Request Logging

```typescript
// api/middleware/logging.js
export function requestLogger(req, res, next) {
  const requestId = crypto.randomUUID()
  const startTime = Date.now()

  req.requestId = requestId
  req.logger = logger
  req.logger.setContext({ requestId })

  res.on('finish', () => {
    const duration = Date.now() - startTime
    
    logger.info('API Request', {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration,
      userId: req.user?.id,
      ip: req.ip,
    })
  })

  next()
}
```

### Client-Side Logging

```typescript
// src/lib/clientLogger.ts
export function setupClientLogging() {
  // Log unhandled errors
  window.addEventListener('error', (event) => {
    logger.error('Unhandled Error', event.error, {
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    })
  })

  // Log unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    logger.error('Unhandled Promise Rejection', event.reason, {
      promise: event.promise,
    })
  })

  // Log navigation
  window.addEventListener('popstate', () => {
    logger.info('Navigation', {
      url: window.location.href,
    })
  })
}
```

---

## 📊 Metrics Collection

### Application Metrics

```typescript
// api/middleware/metrics.js
import promClient from 'prom-client'

// Create metrics
const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.1, 0.5, 1, 2, 5, 10],
})

const dbQueryDuration = new promClient.Histogram({
  name: 'db_query_duration_seconds',
  help: 'Duration of database queries',
  labelNames: ['query_type', 'table'],
})

const activeConnections = new promClient.Gauge({
  name: 'active_connections',
  help: 'Number of active connections',
})

const errorRate = new promClient.Counter({
  name: 'errors_total',
  help: 'Total number of errors',
  labelNames: ['type', 'status'],
})

// Middleware to record metrics
export function metricsMiddleware(req, res, next) {
  const start = Date.now()
  activeConnections.inc()

  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000
    const route = req.route?.path || req.path

    httpRequestDuration
      .labels(req.method, route, res.statusCode)
      .observe(duration)

    if (res.statusCode >= 400) {
      errorRate
        .labels(
          res.statusCode >= 500 ? 'server_error' : 'client_error',
          res.statusCode
        )
        .inc()
    }

    activeConnections.dec()
  })

  next()
}

// Expose metrics endpoint
export function metricsEndpoint(req, res) {
  res.set('Content-Type', promClient.register.contentType)
  res.end(promClient.register.metrics())
}
```

### Business Metrics

```typescript
// api/metrics/business.js
export const businessMetrics = {
  invoices: {
    created: new Counter({
      name: 'invoices_created_total',
      help: 'Total invoices created',
      labelNames: ['status'],
    }),
    
    approved: new Counter({
      name: 'invoices_approved_total',
      help: 'Total invoices approved',
    }),

    value: new Gauge({
      name: 'invoices_total_value',
      help: 'Total value of all invoices',
    }),

    pending: new Gauge({
      name: 'invoices_pending_count',
      help: 'Number of pending invoices',
    }),

    overdue: new Gauge({
      name: 'invoices_overdue_count',
      help: 'Number of overdue invoices',
    }),
  },

  expenses: {
    created: new Counter({
      name: 'expenses_created_total',
      help: 'Total expenses created',
    }),

    approved: new Counter({
      name: 'expenses_approved_total',
      help: 'Total expenses approved',
    }),
  },

  users: {
    active: new Gauge({
      name: 'active_users',
      help: 'Number of active users',
    }),

    created: new Counter({
      name: 'users_created_total',
      help: 'Total users created',
    }),
  },
}
```

---

## 🔍 Distributed Tracing

### Jaeger/OpenTelemetry Setup

```typescript
// api/tracing.js
import { NodeTracerProvider } from '@opentelemetry/node'
import { JaegerExporter } from '@opentelemetry/exporter-jaeger'
import { SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base'
import { registerInstrumentations } from '@opentelemetry/auto-instrumentations-node'

export function setupTracing() {
  const jaegerExporter = new JaegerExporter({
    endpoint: process.env.JAEGER_ENDPOINT || 'http://localhost:14268/api/traces',
  })

  const tracerProvider = new NodeTracerProvider()
  tracerProvider.addSpanProcessor(new SimpleSpanProcessor(jaegerExporter))

  tracerProvider.register()

  registerInstrumentations()

  console.log('Tracing initialized')
}

// Create custom spans
import { trace } from '@opentelemetry/api'

const tracer = trace.getTracer('alpha-erp')

export function traceOperation(name: string, fn: () => Promise<any>) {
  return tracer.startActiveSpan(name, async (span) => {
    try {
      const result = await fn()
      span.setStatus({ code: SpanStatusCode.OK })
      return result
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error.message,
      })
      throw error
    } finally {
      span.end()
    }
  })
}
```

---

## 🚨 Error Tracking (Sentry)

### Sentry Configuration

```typescript
// api/sentry.js
import * as Sentry from '@sentry/node'
import * as Tracing from '@sentry/tracing'

export function initSentry() {
  if (!process.env.SENTRY_DSN) {
    console.warn('Sentry DSN not configured')
    return
  }

  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 1.0,
    integrations: [
      new Sentry.Integrations.Http({ tracing: true }),
      new Tracing.Express({
        app: true,
        request: true,
      }),
    ],
  })

  return Sentry
}

// Express middleware
export function sentryMiddleware(app) {
  app.use(Sentry.Handlers.requestHandler())
  app.use(Sentry.Handlers.tracingHandler())

  // Error handler
  app.use(Sentry.Handlers.errorHandler())
}

// Manual error reporting
export function captureException(error, context = {}) {
  Sentry.captureException(error, { extra: context })
}

export function captureMessage(message, level = 'info') {
  Sentry.captureMessage(message, level)
}
```

### Frontend Sentry Setup

```typescript
// src/lib/sentry.ts
import * as Sentry from '@sentry/react'
import { BrowserTracing } from '@sentry/tracing'

export function initSentry() {
  if (!import.meta.env.VITE_SENTRY_DSN) {
    console.warn('Sentry DSN not configured')
    return
  }

  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE,
    tracesSampleRate: 1.0,
    integrations: [
      new BrowserTracing(),
      new Sentry.Replay({
        maskAllText: false,
        blockAllMedia: false,
      }),
    ],
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
  })
}
```

---

## 📈 Alerting Rules

### Prometheus Alerting Rules

```yaml
# prometheus/rules.yml
groups:
  - name: alpha-erp
    rules:
      # High error rate
      - alert: HighErrorRate
        expr: |
          (sum(rate(errors_total[5m])) / sum(rate(http_requests_total[5m]))) > 0.05
        for: 5m
        annotations:
          summary: "High error rate detected"
          description: "Error rate is above 5%"

      # Slow response times
      - alert: SlowResponseTime
        expr: |
          histogram_quantile(0.99, http_request_duration_seconds) > 1.0
        for: 5m
        annotations:
          summary: "Slow response times"
          description: "99th percentile response time > 1s"

      # Database issues
      - alert: HighDatabaseLatency
        expr: |
          histogram_quantile(0.95, db_query_duration_seconds) > 0.5
        for: 5m
        annotations:
          summary: "High database latency"

      # High memory usage
      - alert: HighMemoryUsage
        expr: |
          process_resident_memory_bytes / 1e9 > 1.0
        for: 10m
        annotations:
          summary: "High memory usage"
          description: "Node process using over 1GB"

      # Pending invoices threshold
      - alert: HighPendingInvoices
        expr: |
          invoices_pending_count > 100
        for: 1h
        annotations:
          summary: "High number of pending invoices"

      # Overdue invoices alert
      - alert: OverdueInvoices
        expr: |
          invoices_overdue_count > 10
        for: 30m
        annotations:
          summary: "Overdue invoices detected"
```

---

## 🎯 Dashboard Setup

### Grafana Dashboard Configuration

```json
{
  "dashboard": {
    "title": "Alpha ERP v13",
    "panels": [
      {
        "title": "Request Rate",
        "targets": [
          {
            "expr": "rate(http_requests_total[5m])"
          }
        ]
      },
      {
        "title": "Error Rate",
        "targets": [
          {
            "expr": "rate(errors_total[5m]) / rate(http_requests_total[5m])"
          }
        ]
      },
      {
        "title": "Response Time (p99)",
        "targets": [
          {
            "expr": "histogram_quantile(0.99, http_request_duration_seconds)"
          }
        ]
      },
      {
        "title": "Active Users",
        "targets": [
          {
            "expr": "active_users"
          }
        ]
      },
      {
        "title": "Invoices Created (Today)",
        "targets": [
          {
            "expr": "increase(invoices_created_total[24h])"
          }
        ]
      },
      {
        "title": "Pending Invoices",
        "targets": [
          {
            "expr": "invoices_pending_count"
          }
        ]
      },
      {
        "title": "Database Latency",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, db_query_duration_seconds)"
          }
        ]
      },
      {
        "title": "Memory Usage",
        "targets": [
          {
            "expr": "process_resident_memory_bytes"
          }
        ]
      }
    ]
  }
}
```

---

## 🔔 Notification Setup

### Alert Routing

```yaml
# alertmanager/alertmanager.yml
global:
  resolve_timeout: 5m

route:
  receiver: 'team-slack'
  group_by: ['alertname', 'cluster']
  routes:
    - match:
        severity: critical
      receiver: 'critical-slack'
      continue: true
      group_wait: 0s
      group_interval: 1m

    - match:
        severity: warning
      receiver: 'warnings-slack'
      group_wait: 5m
      group_interval: 15m

receivers:
  - name: 'team-slack'
    slack_configs:
      - api_url: '${SLACK_WEBHOOK_URL}'
        channel: '#alerts'
        title: '{{ .GroupLabels.alertname }}'

  - name: 'critical-slack'
    slack_configs:
      - api_url: '${SLACK_WEBHOOK_CRITICAL}'
        channel: '#critical-alerts'
        title: '🚨 CRITICAL: {{ .GroupLabels.alertname }}'

  - name: 'warnings-slack'
    slack_configs:
      - api_url: '${SLACK_WEBHOOK_URL}'
        channel: '#warnings'
```

---

## 📊 Health Checks

### Comprehensive Health Endpoint

```typescript
// api/health.js
export async function healthCheck(req, res) {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
    version: '13.0.0',
    checks: {
      database: { status: 'unknown', latency: 0 },
      cache: { status: 'unknown', latency: 0 },
      storage: { status: 'unknown', latency: 0 },
      api: { status: 'ok', latency: 0 },
    },
  }

  // Check database
  const dbStart = Date.now()
  try {
    const result = await sql`SELECT NOW()`
    health.checks.database = {
      status: 'ok',
      latency: Date.now() - dbStart,
      database: result[0].current_database,
    }
  } catch (error) {
    health.status = 'degraded'
    health.checks.database = {
      status: 'error',
      error: error.message,
    }
  }

  // Check cache (Redis)
  if (redis) {
    const cacheStart = Date.now()
    try {
      await redis.ping()
      health.checks.cache = {
        status: 'ok',
        latency: Date.now() - cacheStart,
      }
    } catch (error) {
      health.checks.cache = {
        status: 'error',
        error: error.message,
      }
    }
  }

  // Check file storage
  if (process.env.CF_ACCOUNT_ID) {
    const storageStart = Date.now()
    try {
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${process.env.CF_ACCOUNT_ID}/r2/buckets`,
        {
          headers: {
            Authorization: `Bearer ${process.env.CF_ACCESS_KEY_ID}`,
          },
        }
      )
      health.checks.storage = {
        status: response.ok ? 'ok' : 'error',
        latency: Date.now() - storageStart,
      }
    } catch (error) {
      health.checks.storage = {
        status: 'error',
        error: error.message,
      }
    }
  }

  const statusCode =
    health.status === 'ok'
      ? 200
      : health.status === 'degraded'
        ? 503
        : 500

  res.status(statusCode).json(health)
}
```

---

## 🎯 Monitoring Checklist

```
✅ Logging
   [ ] Structured logging configured
   [ ] Request logging enabled
   [ ] Error logging working
   [ ] Client-side logging setup

✅ Metrics
   [ ] Application metrics collected
   [ ] Business metrics tracked
   [ ] Database metrics monitored
   [ ] Memory/CPU metrics available

✅ Tracing
   [ ] Distributed tracing enabled
   [ ] Trace sampling configured
   [ ] Custom spans created
   [ ] Request flow tracked

✅ Error Tracking
   [ ] Sentry integrated
   [ ] Error reports working
   [ ] Performance monitoring enabled
   [ ] Session replay enabled

✅ Alerting
   [ ] Prometheus rules configured
   [ ] Alert routing setup
   [ ] Slack integration working
   [ ] Critical alerts setup

✅ Dashboards
   [ ] Grafana dashboard created
   [ ] Key metrics visible
   [ ] Alert status shown
   [ ] Business metrics displayed

✅ Health Checks
   [ ] /api/health endpoint working
   [ ] Database checked
   [ ] Cache checked
   [ ] Storage checked
```

---

## 📞 On-Call Support

### Escalation Policy

```yaml
escalation_policy:
  oncall:
    level_1:
      - team: platform-engineers
        response_time: 15min
        acknowledgement: required

    level_2:
      - team: senior-engineers
        response_time: 30min
        
    level_3:
      - team: devops-leads
        response_time: 1hour

incident_severity:
  critical:
    response_time: 5min
    escalation: immediate
    notify: all

  high:
    response_time: 15min
    escalation: level_2

  medium:
    response_time: 1hour
    escalation: level_1

  low:
    response_time: 24hour
    escalation: none
```

This comprehensive monitoring guide ensures your ERP system maintains high availability, performance, and reliability in production.

