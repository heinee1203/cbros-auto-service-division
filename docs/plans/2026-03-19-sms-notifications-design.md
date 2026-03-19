# SMS Notifications — Design Document

**Date:** 2026-03-19
**Status:** Approved

## Overview

Add SMS notifications to AutoServ Pro via Semaphore (Philippine SMS provider). The system sends 10 types of customer-facing SMS: 5 event-driven (inline) and 5 scheduled (cron). Messages use owner-customizable templates stored in Settings.

## Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Provider | Semaphore | PH-focused, simple API, ~₱0.35/SMS |
| Architecture | Layered (provider → templates → orchestrator) | Clean separation, swappable provider |
| Dispatch | Inline for events + cron for scheduled | No delay on real-time notifications |
| Logging | New `SmsLog` model | Separate from in-app Notification model |
| Templates | Settings-stored with `{variable}` interpolation | Owner can customize without code changes |
| Opt-out | `smsOptOut` Boolean on Customer | Trivial to implement, respects customer preference |
| Daily limit | Setting-based cap (default 100) | Safety net against accidental cost overruns |

## SMS Types

### Event-Driven (inline, immediate)

| Type | Trigger | Key Variables |
|---|---|---|
| `VEHICLE_CHECKED_IN` | Job intake completed | customerName, jobNumber, vehiclePlate, shopPhone |
| `VEHICLE_READY` | Job released via `completeRelease()` | customerName, vehiclePlate, shopName, shopPhone |
| `PAYMENT_RECEIVED` | Payment processed | customerName, amount, jobNumber |
| `ESTIMATE_READY` | Estimate approval link created | customerName, vehiclePlate, link |
| `SUPPLEMENT_APPROVAL` | Supplement needs customer approval | customerName, vehiclePlate, link |

### Scheduled (cron, every 15 minutes)

| Type | Trigger | Key Variables |
|---|---|---|
| `APPOINTMENT_REMINDER` | Day before appointment (`reminderSent = false`) | customerName, scheduledDate, scheduledTime, shopPhone |
| `FOLLOWUP_7DAY` | 7 days post-release (`followUp7DaySent = false`) | customerName, shopPhone |
| `FOLLOWUP_30DAY` | 30 days post-release | customerName, shopPhone |
| `FOLLOWUP_6MONTH` | 6 months post-release | customerName, shopName, shopPhone |
| `FOLLOWUP_1YEAR` | 1 year post-release | customerName, shopName, shopPhone |

## Schema Changes

### New Model: `SmsLog`

```prisma
model SmsLog {
  id                String    @id @default(cuid())
  recipientPhone    String    // E.164: +639171234567
  recipientName     String?
  customerId        String?
  type              String    // SmsType
  message           String
  status            String    @default("SENT")  // SENT, FAILED, DELIVERED
  provider          String    @default("semaphore")
  providerMessageId String?
  costCentavos      Int?
  error             String?
  jobOrderId        String?
  createdAt         DateTime  @default(now())

  @@index([customerId])
  @@index([type])
  @@index([status])
  @@index([createdAt])
}
```

No soft delete — append-only audit log.

### Customer Model Addition

```prisma
smsOptOut  Boolean  @default(false)
```

### New Enum: `SmsType`

```typescript
APPOINTMENT_REMINDER, VEHICLE_CHECKED_IN, VEHICLE_READY,
PAYMENT_RECEIVED, ESTIMATE_READY, SUPPLEMENT_APPROVAL,
FOLLOWUP_7DAY, FOLLOWUP_30DAY, FOLLOWUP_6MONTH, FOLLOWUP_1YEAR
```

### New Settings Keys (category: `sms`)

```
sms_enabled                        = false
sms_api_key                        = ""
sms_sender_name                    = "AutoServ"
sms_daily_limit                    = 100
sms_appointment_reminder_hours     = 24
sms_template_appointment_reminder  = "Hi {customerName}, reminder: your appointment at {shopName} is on {scheduledDate} at {scheduledTime}. Call us: {shopPhone}"
sms_template_vehicle_checked_in    = "Hi {customerName}, your {vehiclePlate} has been checked in. Job #{jobNumber}. We'll keep you updated! - {shopName}"
sms_template_vehicle_ready         = "Hi {customerName}, your {vehiclePlate} is ready for pickup! Visit us at your convenience. - {shopName} {shopPhone}"
sms_template_payment_received      = "Hi {customerName}, we received your payment of {amount}. Thank you! - {shopName}"
sms_template_estimate_ready        = "Hi {customerName}, your estimate for {vehiclePlate} is ready for review: {link} - {shopName}"
sms_template_supplement_approval   = "Hi {customerName}, additional work is needed on your {vehiclePlate}. Please review: {link} - {shopName}"
sms_template_followup_7day         = "Hi {customerName}, how's your vehicle after the service? Any concerns? Call us: {shopPhone} - {shopName}"
sms_template_followup_30day        = "Hi {customerName}, it's been a month since your service. How are we doing? Feedback appreciated! - {shopName} {shopPhone}"
sms_template_followup_6month       = "Hi {customerName}, time for a check-up! It's been 6 months since your last service. Book now: {shopPhone} - {shopName}"
sms_template_followup_1year        = "Hi {customerName}, it's been a year! Schedule your annual service today: {shopPhone} - {shopName}"
```

## Service Layer

### `src/lib/services/sms-provider.ts` — Semaphore API wrapper

- `sendSms(phone, message, senderName)` → `{ success, messageId, error }`
- `getBalance()` → `{ balance }`
- HTTP calls to `https://api.semaphore.co/api/v4/messages`
- API key from `getSettingValue("sms_api_key")`

### `src/lib/services/sms-templates.ts` — Template engine

- `renderTemplate(type, variables)` → rendered string
- Loads from settings, falls back to hardcoded defaults
- Simple `{variable}` replacement

### `src/lib/services/sms.ts` — Business logic orchestrator

- `sendCustomerSms(customerId, type, variables, jobOrderId?)` — main entry:
  1. Check `sms_enabled` → bail if false
  2. Look up customer → check `smsOptOut` → bail if true
  3. Check daily limit → bail if exceeded
  4. Normalize phone → `normalizeToE164(customer.phone)`
  5. Render template
  6. Call provider
  7. Write `SmsLog` row
  8. Return `{ sent, error? }`
- `getDailySmsCount()` — today's SmsLog count
- `normalizeToE164(phone)` — `09171234567` → `+639171234567`

### Integration Points (inline sends)

| Trigger | File to modify | SMS Type |
|---|---|---|
| Intake completed | intake action | `VEHICLE_CHECKED_IN` |
| Job released | `release.ts` → `completeRelease()` | `VEHICLE_READY` |
| Payment processed | `payments.ts` | `PAYMENT_RECEIVED` |
| Estimate link sent | estimate actions | `ESTIMATE_READY` |
| Supplement approval | `supplements.ts` | `SUPPLEMENT_APPROVAL` |

### Cron Route: `/api/cron/sms/route.ts`

- GET endpoint, called every 15 minutes by external cron
- Protected by `CRON_SECRET` env var (bearer token)
- Queries:
  1. Appointments where `scheduledDate` within reminder window, `reminderSent = false`
  2. ReleaseRecords where `followUp*Date <= now()`, `followUp*Sent = false`
- Sends SMS, flips `*Sent` flags
- Respects daily limit

## UI

### Settings Page — "SMS" category

- SMS Enabled toggle
- API Key (password input)
- Sender Name (max 11 chars)
- Daily Limit (number)
- Appointment Reminder Hours (number)
- Test SMS button (sends to entered phone number)
- Semaphore Balance display
- 10 template textareas with variable hints

### SMS Log — `/settings/sms-log`

- Recent sends table: time, recipient, type, status, message preview
- Filter by status (ALL / SENT / FAILED)
- Daily count vs limit in header

### Customer Detail — Opt-out toggle

- "SMS Notifications: ON/OFF" toggle on customer detail page
- Writes to `customer.smsOptOut`
