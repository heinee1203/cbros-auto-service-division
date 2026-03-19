# SMS Notifications Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add customer-facing SMS notifications via Semaphore to AutoServ Pro — 10 notification types (5 inline, 5 cron-scheduled), with owner-customizable templates, logging, opt-out, and daily limits.

**Architecture:** Three-layer service (provider → templates → orchestrator). Event-driven SMS fires inline from existing service functions. Scheduled SMS (appointment reminders, follow-ups) dispatched by a cron API route every 15 minutes, protected by CRON_SECRET.

**Tech Stack:** Semaphore SMS API (v4), Next.js API routes, Prisma/SQLite, Zod validation

---

### Task 1: Schema — Add SmsLog model, Customer.smsOptOut, and SmsType enum

**Files:**
- Modify: `prisma/schema.prisma` — add SmsLog model at end, add smsOptOut to Customer model
- Modify: `src/types/enums.ts` — add SmsType enum + labels
- Modify: `src/lib/utils.ts` — add `normalizeToE164()` helper

**Step 1: Add `smsOptOut` field to Customer model in `prisma/schema.prisma`**

Find the Customer model (line ~67). Add after the `tags` field (line 77):

```prisma
  smsOptOut     Boolean   @default(false)
```

**Step 2: Add SmsLog model at end of `prisma/schema.prisma`**

After the CommissionEntry model, add:

```prisma
// ============================================================================
// SMS LOG (Append-only — NO soft delete)
// ============================================================================

model SmsLog {
  id                String    @id @default(cuid())
  recipientPhone    String
  recipientName     String?
  customerId        String?
  type              String    // SmsType
  message           String
  status            String    @default("SENT")  // SENT, FAILED
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

**Step 3: Add SmsType enum to `src/types/enums.ts`**

Append after the CommissionPeriodStatus section:

```typescript
// SMS
export const SmsType = {
  APPOINTMENT_REMINDER: "APPOINTMENT_REMINDER",
  VEHICLE_CHECKED_IN: "VEHICLE_CHECKED_IN",
  VEHICLE_READY: "VEHICLE_READY",
  PAYMENT_RECEIVED: "PAYMENT_RECEIVED",
  ESTIMATE_READY: "ESTIMATE_READY",
  SUPPLEMENT_APPROVAL: "SUPPLEMENT_APPROVAL",
  FOLLOWUP_7DAY: "FOLLOWUP_7DAY",
  FOLLOWUP_30DAY: "FOLLOWUP_30DAY",
  FOLLOWUP_6MONTH: "FOLLOWUP_6MONTH",
  FOLLOWUP_1YEAR: "FOLLOWUP_1YEAR",
} as const;
export type SmsType = (typeof SmsType)[keyof typeof SmsType];

export const SMS_TYPE_LABELS: Record<SmsType, string> = {
  APPOINTMENT_REMINDER: "Appointment Reminder",
  VEHICLE_CHECKED_IN: "Vehicle Checked In",
  VEHICLE_READY: "Vehicle Ready",
  PAYMENT_RECEIVED: "Payment Received",
  ESTIMATE_READY: "Estimate Ready",
  SUPPLEMENT_APPROVAL: "Supplement Approval",
  FOLLOWUP_7DAY: "7-Day Follow-Up",
  FOLLOWUP_30DAY: "30-Day Follow-Up",
  FOLLOWUP_6MONTH: "6-Month Follow-Up",
  FOLLOWUP_1YEAR: "1-Year Follow-Up",
};

export const SMS_STATUS_COLORS: Record<string, string> = {
  SENT: "bg-success-100 text-success-600",
  FAILED: "bg-danger-100 text-danger-600",
};
```

**Step 4: Add `normalizeToE164()` to `src/lib/utils.ts`**

Append after `formatPlateNumber()`:

```typescript
// Normalize Philippine phone number to E.164 format for SMS
// "09171234567" → "+639171234567"
// "+639171234567" → "+639171234567"
export function normalizeToE164(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("09") && digits.length === 11) {
    return `+63${digits.slice(1)}`;
  }
  if (digits.startsWith("639") && digits.length === 12) {
    return `+${digits}`;
  }
  if (digits.startsWith("9") && digits.length === 10) {
    return `+63${digits}`;
  }
  return null; // invalid format
}
```

**Step 5: Push schema and verify**

Run: `npx prisma db push`
Expected: "Your database is now in sync"

**Step 6: Commit**

```bash
git add prisma/schema.prisma src/types/enums.ts src/lib/utils.ts
git commit -m "schema: add SmsLog model, Customer.smsOptOut, SmsType enum, normalizeToE164"
```

---

### Task 2: Seed SMS settings and templates

**Files:**
- Modify: `prisma/seed.ts` — add SMS settings after the commission settings block

**Step 1: Add SMS settings to seed data**

In `prisma/seed.ts`, find the commission settings block (search for `commission_include_only_released`). After that block, add:

```typescript
    // SMS
    { key: "sms_enabled", value: "false", category: "sms", description: "Enable SMS notifications" },
    { key: "sms_api_key", value: '""', category: "sms", description: "Semaphore API key" },
    { key: "sms_sender_name", value: '"AutoServ"', category: "sms", description: "SMS sender name (max 11 chars)" },
    { key: "sms_daily_limit", value: "100", category: "sms", description: "Maximum SMS per day" },
    { key: "sms_appointment_reminder_hours", value: "24", category: "sms", description: "Hours before appointment to send reminder" },
    { key: "sms_template_appointment_reminder", value: '"Hi {customerName}, reminder: your appointment at {shopName} is on {scheduledDate} at {scheduledTime}. Call us: {shopPhone}"', category: "sms", description: "Appointment reminder SMS template" },
    { key: "sms_template_vehicle_checked_in", value: '"Hi {customerName}, your {vehiclePlate} has been checked in. Job #{jobNumber}. We\'ll keep you updated! - {shopName}"', category: "sms", description: "Vehicle checked in SMS template" },
    { key: "sms_template_vehicle_ready", value: '"Hi {customerName}, your {vehiclePlate} is ready for pickup! Visit us at your convenience. - {shopName} {shopPhone}"', category: "sms", description: "Vehicle ready SMS template" },
    { key: "sms_template_payment_received", value: '"Hi {customerName}, we received your payment of {amount}. Thank you! - {shopName}"', category: "sms", description: "Payment received SMS template" },
    { key: "sms_template_estimate_ready", value: '"Hi {customerName}, your estimate for {vehiclePlate} is ready for review: {link} - {shopName}"', category: "sms", description: "Estimate ready SMS template" },
    { key: "sms_template_supplement_approval", value: '"Hi {customerName}, additional work is needed on your {vehiclePlate}. Please review: {link} - {shopName}"', category: "sms", description: "Supplement approval SMS template" },
    { key: "sms_template_followup_7day", value: '"Hi {customerName}, how\'s your vehicle after the service? Any concerns? Call us: {shopPhone} - {shopName}"', category: "sms", description: "7-day follow-up SMS template" },
    { key: "sms_template_followup_30day", value: '"Hi {customerName}, it\'s been a month since your service. How are we doing? Feedback appreciated! - {shopName} {shopPhone}"', category: "sms", description: "30-day follow-up SMS template" },
    { key: "sms_template_followup_6month", value: '"Hi {customerName}, time for a check-up! It\'s been 6 months since your last service. Book now: {shopPhone} - {shopName}"', category: "sms", description: "6-month follow-up SMS template" },
    { key: "sms_template_followup_1year", value: '"Hi {customerName}, it\'s been a year! Schedule your annual service today: {shopPhone} - {shopName}"', category: "sms", description: "1-year follow-up SMS template" },
```

**Step 2: Run seed**

Run: `npx tsx prisma/seed.ts`
Expected: Settings count increases by 15

**Step 3: Commit**

```bash
git add prisma/seed.ts
git commit -m "seed: add SMS settings and default message templates"
```

---

### Task 3: Semaphore provider service

**Files:**
- Create: `src/lib/services/sms-provider.ts`

**Step 1: Create the Semaphore API wrapper**

```typescript
import { getSettingValue } from "@/lib/services/settings";

interface SendResult {
  success: boolean;
  messageId: string | null;
  error: string | null;
}

interface BalanceResult {
  balance: number | null;
  error: string | null;
}

const SEMAPHORE_API_URL = "https://api.semaphore.co/api/v4";

export async function sendSms(
  phone: string,
  message: string,
  senderName: string
): Promise<SendResult> {
  const apiKey = await getSettingValue<string>("sms_api_key", "");
  if (!apiKey) {
    return { success: false, messageId: null, error: "SMS API key not configured" };
  }

  // Semaphore expects phone without the + prefix
  const cleanPhone = phone.startsWith("+") ? phone.slice(1) : phone;

  try {
    const res = await fetch(`${SEMAPHORE_API_URL}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apikey: apiKey,
        number: cleanPhone,
        message,
        sendername: senderName,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return { success: false, messageId: null, error: `Semaphore HTTP ${res.status}: ${text}` };
    }

    const data = await res.json();

    // Semaphore returns an array of message objects
    if (Array.isArray(data) && data.length > 0 && data[0].message_id) {
      return { success: true, messageId: String(data[0].message_id), error: null };
    }

    // Error response format
    if (data.error || data.message) {
      return { success: false, messageId: null, error: data.error || data.message };
    }

    return { success: true, messageId: null, error: null };
  } catch (err) {
    return { success: false, messageId: null, error: (err as Error).message };
  }
}

export async function getBalance(): Promise<BalanceResult> {
  const apiKey = await getSettingValue<string>("sms_api_key", "");
  if (!apiKey) {
    return { balance: null, error: "SMS API key not configured" };
  }

  try {
    const res = await fetch(`${SEMAPHORE_API_URL}/account?apikey=${apiKey}`);
    if (!res.ok) {
      return { balance: null, error: `HTTP ${res.status}` };
    }
    const data = await res.json();
    return { balance: data.credit_balance ?? null, error: null };
  } catch (err) {
    return { balance: null, error: (err as Error).message };
  }
}
```

**Step 2: Commit**

```bash
git add src/lib/services/sms-provider.ts
git commit -m "feat: add Semaphore SMS provider service"
```

---

### Task 4: SMS template engine

**Files:**
- Create: `src/lib/services/sms-templates.ts`

**Step 1: Create template service**

```typescript
import { getSettingValue } from "@/lib/services/settings";
import type { SmsType } from "@/types/enums";

const SETTING_KEY_MAP: Record<SmsType, string> = {
  APPOINTMENT_REMINDER: "sms_template_appointment_reminder",
  VEHICLE_CHECKED_IN: "sms_template_vehicle_checked_in",
  VEHICLE_READY: "sms_template_vehicle_ready",
  PAYMENT_RECEIVED: "sms_template_payment_received",
  ESTIMATE_READY: "sms_template_estimate_ready",
  SUPPLEMENT_APPROVAL: "sms_template_supplement_approval",
  FOLLOWUP_7DAY: "sms_template_followup_7day",
  FOLLOWUP_30DAY: "sms_template_followup_30day",
  FOLLOWUP_6MONTH: "sms_template_followup_6month",
  FOLLOWUP_1YEAR: "sms_template_followup_1year",
};

const DEFAULT_TEMPLATES: Record<SmsType, string> = {
  APPOINTMENT_REMINDER: "Hi {customerName}, reminder: your appointment at {shopName} is on {scheduledDate} at {scheduledTime}. Call us: {shopPhone}",
  VEHICLE_CHECKED_IN: "Hi {customerName}, your {vehiclePlate} has been checked in. Job #{jobNumber}. We'll keep you updated! - {shopName}",
  VEHICLE_READY: "Hi {customerName}, your {vehiclePlate} is ready for pickup! Visit us at your convenience. - {shopName} {shopPhone}",
  PAYMENT_RECEIVED: "Hi {customerName}, we received your payment of {amount}. Thank you! - {shopName}",
  ESTIMATE_READY: "Hi {customerName}, your estimate for {vehiclePlate} is ready for review: {link} - {shopName}",
  SUPPLEMENT_APPROVAL: "Hi {customerName}, additional work is needed on your {vehiclePlate}. Please review: {link} - {shopName}",
  FOLLOWUP_7DAY: "Hi {customerName}, how's your vehicle after the service? Any concerns? Call us: {shopPhone} - {shopName}",
  FOLLOWUP_30DAY: "Hi {customerName}, it's been a month since your service. How are we doing? Feedback appreciated! - {shopName} {shopPhone}",
  FOLLOWUP_6MONTH: "Hi {customerName}, time for a check-up! It's been 6 months since your last service. Book now: {shopPhone} - {shopName}",
  FOLLOWUP_1YEAR: "Hi {customerName}, it's been a year! Schedule your annual service today: {shopPhone} - {shopName}",
};

// Variables available per SMS type (for UI hints)
export const TEMPLATE_VARIABLES: Record<SmsType, string[]> = {
  APPOINTMENT_REMINDER: ["customerName", "shopName", "shopPhone", "scheduledDate", "scheduledTime"],
  VEHICLE_CHECKED_IN: ["customerName", "vehiclePlate", "jobNumber", "shopName", "shopPhone"],
  VEHICLE_READY: ["customerName", "vehiclePlate", "shopName", "shopPhone"],
  PAYMENT_RECEIVED: ["customerName", "amount", "jobNumber", "shopName", "shopPhone"],
  ESTIMATE_READY: ["customerName", "vehiclePlate", "link", "shopName", "shopPhone"],
  SUPPLEMENT_APPROVAL: ["customerName", "vehiclePlate", "link", "shopName", "shopPhone"],
  FOLLOWUP_7DAY: ["customerName", "shopName", "shopPhone"],
  FOLLOWUP_30DAY: ["customerName", "shopName", "shopPhone"],
  FOLLOWUP_6MONTH: ["customerName", "shopName", "shopPhone"],
  FOLLOWUP_1YEAR: ["customerName", "shopName", "shopPhone"],
};

export async function renderTemplate(
  type: SmsType,
  variables: Record<string, string>
): Promise<string> {
  const settingKey = SETTING_KEY_MAP[type];
  const template = await getSettingValue<string>(settingKey, DEFAULT_TEMPLATES[type]);

  let rendered = template || DEFAULT_TEMPLATES[type];
  for (const [key, value] of Object.entries(variables)) {
    rendered = rendered.replace(new RegExp(`\\{${key}\\}`, "g"), value);
  }

  return rendered;
}
```

**Step 2: Commit**

```bash
git add src/lib/services/sms-templates.ts
git commit -m "feat: add SMS template engine with settings-stored templates"
```

---

### Task 5: SMS orchestrator service

**Files:**
- Create: `src/lib/services/sms.ts`

**Step 1: Create the main SMS orchestrator**

```typescript
import { prisma } from "@/lib/prisma";
import { getSettingValue } from "@/lib/services/settings";
import { sendSms } from "@/lib/services/sms-provider";
import { renderTemplate } from "@/lib/services/sms-templates";
import { normalizeToE164 } from "@/lib/utils";
import type { SmsType } from "@/types/enums";

interface SmsResult {
  sent: boolean;
  error?: string;
  skippedReason?: string;
}

export async function sendCustomerSms(
  customerId: string,
  type: SmsType,
  variables: Record<string, string>,
  jobOrderId?: string
): Promise<SmsResult> {
  // 1. Check SMS enabled
  const enabled = await getSettingValue<boolean>("sms_enabled", false);
  if (!enabled) {
    return { sent: false, skippedReason: "SMS disabled" };
  }

  // 2. Look up customer, check opt-out
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { phone: true, firstName: true, lastName: true, smsOptOut: true },
  });
  if (!customer) {
    return { sent: false, error: "Customer not found" };
  }
  if (customer.smsOptOut) {
    return { sent: false, skippedReason: "Customer opted out" };
  }

  // 3. Check daily limit
  const dailyLimit = await getSettingValue<number>("sms_daily_limit", 100);
  const todayCount = await getDailySmsCount();
  if (todayCount >= dailyLimit) {
    console.warn(`[SMS] Daily limit reached (${todayCount}/${dailyLimit})`);
    return { sent: false, skippedReason: "Daily limit reached" };
  }

  // 4. Normalize phone
  const phone = normalizeToE164(customer.phone);
  if (!phone) {
    return { sent: false, error: `Invalid phone format: ${customer.phone}` };
  }

  // 5. Inject shop info into variables
  const shopName = await getSettingValue<string>("shop_name", "AutoServ Pro");
  const shopPhone = await getSettingValue<string>("shop_phone", "");
  const enrichedVars = {
    customerName: customer.firstName,
    shopName,
    shopPhone,
    ...variables,
  };

  // 6. Render template
  const message = await renderTemplate(type, enrichedVars);

  // 7. Send via provider
  const senderName = await getSettingValue<string>("sms_sender_name", "AutoServ");
  const result = await sendSms(phone, message, senderName);

  // 8. Log
  await prisma.smsLog.create({
    data: {
      recipientPhone: phone,
      recipientName: `${customer.firstName} ${customer.lastName}`,
      customerId,
      type,
      message,
      status: result.success ? "SENT" : "FAILED",
      provider: "semaphore",
      providerMessageId: result.messageId,
      error: result.error,
      jobOrderId: jobOrderId ?? null,
    },
  });

  if (!result.success) {
    console.error(`[SMS] Failed to send ${type} to ${phone}: ${result.error}`);
    return { sent: false, error: result.error ?? undefined };
  }

  return { sent: true };
}

export async function getDailySmsCount(): Promise<number> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return prisma.smsLog.count({
    where: { createdAt: { gte: today } },
  });
}

// Send a test SMS (for settings page)
export async function sendTestSms(phone: string): Promise<SmsResult> {
  const enabled = await getSettingValue<boolean>("sms_enabled", false);
  if (!enabled) return { sent: false, error: "SMS is disabled" };

  const normalized = normalizeToE164(phone);
  if (!normalized) return { sent: false, error: "Invalid phone number" };

  const shopName = await getSettingValue<string>("shop_name", "AutoServ Pro");
  const senderName = await getSettingValue<string>("sms_sender_name", "AutoServ");
  const message = `Test SMS from ${shopName}. If you received this, SMS is working!`;

  const result = await sendSms(normalized, message, senderName);

  await prisma.smsLog.create({
    data: {
      recipientPhone: normalized,
      type: "TEST",
      message,
      status: result.success ? "SENT" : "FAILED",
      provider: "semaphore",
      providerMessageId: result.messageId,
      error: result.error,
    },
  });

  return result.success
    ? { sent: true }
    : { sent: false, error: result.error ?? "Send failed" };
}

// Get recent SMS logs for the SMS log page
export async function getSmsLogs(options?: {
  status?: string;
  limit?: number;
}) {
  return prisma.smsLog.findMany({
    where: options?.status ? { status: options.status } : undefined,
    orderBy: { createdAt: "desc" },
    take: options?.limit ?? 50,
  });
}
```

**Step 2: Commit**

```bash
git add src/lib/services/sms.ts
git commit -m "feat: add SMS orchestrator with opt-out, daily limit, and logging"
```

---

### Task 6: SMS server actions

**Files:**
- Create: `src/lib/actions/sms-actions.ts`

**Step 1: Create SMS actions for the settings UI**

```typescript
"use server";

import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import type { UserRole } from "@/types/enums";
import { sendTestSms } from "@/lib/services/sms";
import { getBalance } from "@/lib/services/sms-provider";

export type ActionResult = {
  success: boolean;
  error?: string;
  data?: Record<string, unknown>;
};

export async function sendTestSmsAction(
  phone: string
): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: "Unauthorized" };
  if (!can(session.user.role as UserRole, "settings:manage")) {
    return { success: false, error: "Permission denied" };
  }

  const result = await sendTestSms(phone);
  if (result.sent) {
    return { success: true };
  }
  return { success: false, error: result.error || "Send failed" };
}

export async function getSmsBalanceAction(): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: "Unauthorized" };
  if (!can(session.user.role as UserRole, "settings:manage")) {
    return { success: false, error: "Permission denied" };
  }

  const result = await getBalance();
  if (result.error) {
    return { success: false, error: result.error };
  }
  return { success: true, data: { balance: result.balance } };
}
```

**Step 2: Commit**

```bash
git add src/lib/actions/sms-actions.ts
git commit -m "feat: add SMS server actions for test send and balance check"
```

---

### Task 7: Inline SMS integration — 5 event triggers

**Files:**
- Modify: `src/lib/services/release.ts` — after line ~416 in `completeRelease()`
- Modify: `src/lib/services/payments.ts` — after line ~110 in `recordPayment()`
- Modify: `src/lib/services/supplements.ts` — after line ~392 in `approveWithSignature()`
- Modify: `src/lib/actions/intake-actions.ts` — after line ~190 in `completeIntakeAction()`
- Modify: `src/lib/actions/estimate-actions.ts` — after line ~269 in `updateEstimateStatusAction()`

**Step 1: Add to `release.ts` → `completeRelease()`**

At the top, add import:
```typescript
import { sendCustomerSms } from "@/lib/services/sms";
```

After the last notification creation block (after the 6-month follow-up notification), add:
```typescript
  // SMS — vehicle ready for pickup
  sendCustomerSms(
    jobOrder.customerId,
    "VEHICLE_READY",
    { vehiclePlate: jobOrder.vehicle.plateNumber },
    jobOrder.id
  ).catch((err) => console.error("[SMS] VEHICLE_READY failed:", err));
```

Note: Use fire-and-forget (`.catch()`) so SMS failures don't block release.

**Step 2: Add to `payments.ts` → `recordPayment()`**

At the top, add import:
```typescript
import { sendCustomerSms } from "@/lib/services/sms";
import { formatPeso } from "@/lib/utils";
```

After manager notifications, add:
```typescript
  // SMS — payment confirmation
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      jobOrder: {
        select: { id: true, customerId: true, jobOrderNumber: true },
      },
    },
  });
  if (invoice?.jobOrder) {
    sendCustomerSms(
      invoice.jobOrder.customerId,
      "PAYMENT_RECEIVED",
      { amount: formatPeso(amount), jobNumber: invoice.jobOrder.jobOrderNumber },
      invoice.jobOrder.id
    ).catch((err) => console.error("[SMS] PAYMENT_RECEIVED failed:", err));
  }
```

**Step 3: Add to `supplements.ts` → `approveWithSignature()`**

At the top, add import:
```typescript
import { sendCustomerSms } from "@/lib/services/sms";
```

After manager notifications, add:
```typescript
  // SMS — supplement approved confirmation
  if (supplement.jobOrder) {
    sendCustomerSms(
      supplement.jobOrder.customerId,
      "SUPPLEMENT_APPROVAL",
      {
        vehiclePlate: supplement.jobOrder.vehicle?.plateNumber ?? "",
        link: "", // supplement approval is inbound, not outbound link
      },
      supplement.jobOrderId
    ).catch((err) => console.error("[SMS] SUPPLEMENT_APPROVAL failed:", err));
  }
```

**Step 4: Add to `intake-actions.ts` → `completeIntakeAction()`**

At the top, add import:
```typescript
import { sendCustomerSms } from "@/lib/services/sms";
```

After the `completeIntake()` call and before `revalidatePath`, add:
```typescript
  // SMS — vehicle checked in
  if (result.customerId) {
    sendCustomerSms(
      result.customerId,
      "VEHICLE_CHECKED_IN",
      {
        vehiclePlate: result.vehicle?.plateNumber ?? "",
        jobNumber: result.jobOrderNumber ?? "",
      },
      result.id
    ).catch((err) => console.error("[SMS] VEHICLE_CHECKED_IN failed:", err));
  }
```

**Step 5: Add to `estimate-actions.ts` → `updateEstimateStatusAction()`**

At the top, add import:
```typescript
import { sendCustomerSms } from "@/lib/services/sms";
```

After the approval token is generated and saved, add:
```typescript
  // SMS — estimate ready for review
  if (approvalToken && estimate.estimateRequest?.customerId) {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    sendCustomerSms(
      estimate.estimateRequest.customerId,
      "ESTIMATE_READY",
      {
        vehiclePlate: estimate.estimateRequest.vehicle?.plateNumber ?? "",
        link: `${baseUrl}/approve/estimate/${approvalToken}`,
      }
    ).catch((err) => console.error("[SMS] ESTIMATE_READY failed:", err));
  }
```

**Step 6: Commit**

```bash
git add src/lib/services/release.ts src/lib/services/payments.ts src/lib/services/supplements.ts src/lib/actions/intake-actions.ts src/lib/actions/estimate-actions.ts
git commit -m "feat: add inline SMS sends for 5 event-driven notification types"
```

---

### Task 8: Cron route for scheduled SMS

**Files:**
- Create: `src/app/api/cron/sms/route.ts`

**Step 1: Create the cron endpoint**

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendCustomerSms, getDailySmsCount } from "@/lib/services/sms";
import { getSettingValue } from "@/lib/services/settings";
import { formatDate, formatTime } from "@/lib/utils";
import type { SmsType } from "@/types/enums";

export async function GET(req: Request) {
  // Verify cron secret
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const enabled = await getSettingValue<boolean>("sms_enabled", false);
  if (!enabled) {
    return NextResponse.json({ skipped: true, reason: "SMS disabled" });
  }

  const dailyLimit = await getSettingValue<number>("sms_daily_limit", 100);
  let sent = 0;
  let failed = 0;
  let skipped = 0;

  // --- Appointment Reminders ---
  const reminderHours = await getSettingValue<number>("sms_appointment_reminder_hours", 24);
  const reminderCutoff = new Date();
  reminderCutoff.setHours(reminderCutoff.getHours() + reminderHours);

  const appointments = await prisma.appointment.findMany({
    where: {
      reminderSent: false,
      status: { in: ["SCHEDULED", "CONFIRMED"] },
      scheduledDate: { lte: reminderCutoff },
      deletedAt: null,
    },
    include: {
      customer: { select: { id: true, firstName: true, phone: true } },
    },
    take: 50,
  });

  for (const appt of appointments) {
    if ((await getDailySmsCount()) >= dailyLimit) { skipped++; break; }

    const result = await sendCustomerSms(
      appt.customerId,
      "APPOINTMENT_REMINDER" as SmsType,
      {
        scheduledDate: formatDate(appt.scheduledDate),
        scheduledTime: appt.scheduledTime,
      }
    );

    if (result.sent) {
      await prisma.appointment.update({
        where: { id: appt.id },
        data: { reminderSent: true },
      });
      sent++;
    } else if (result.error) {
      failed++;
    } else {
      skipped++;
    }
  }

  // --- Follow-Up SMS ---
  const now = new Date();
  const followUpTypes: Array<{
    dateField: string;
    sentField: string;
    smsType: SmsType;
    settingKey: string;
  }> = [
    { dateField: "followUp7DayDate", sentField: "followUp7DaySent", smsType: "FOLLOWUP_7DAY" as SmsType, settingKey: "followup_7day_enabled" },
    { dateField: "followUp30DayDate", sentField: "followUp30DaySent", smsType: "FOLLOWUP_30DAY" as SmsType, settingKey: "followup_30day_enabled" },
    { dateField: "followUp6MonthDate", sentField: "followUp6MonthSent", smsType: "FOLLOWUP_6MONTH" as SmsType, settingKey: "followup_6month_enabled" },
    { dateField: "followUp1YearDate", sentField: "followUp1YearSent", smsType: "FOLLOWUP_1YEAR" as SmsType, settingKey: "followup_1year_enabled" },
  ];

  for (const fu of followUpTypes) {
    const isEnabled = await getSettingValue<boolean>(fu.settingKey, true);
    if (!isEnabled) continue;

    const records = await prisma.releaseRecord.findMany({
      where: {
        [fu.dateField]: { lte: now },
        [fu.sentField]: false,
        deletedAt: null,
      },
      include: {
        jobOrder: {
          select: {
            id: true,
            customerId: true,
            customer: { select: { id: true } },
          },
        },
      },
      take: 50,
    });

    for (const record of records) {
      if ((await getDailySmsCount()) >= dailyLimit) { skipped++; break; }
      if (!record.jobOrder?.customerId) { skipped++; continue; }

      const result = await sendCustomerSms(
        record.jobOrder.customerId,
        fu.smsType,
        {},
        record.jobOrder.id
      );

      if (result.sent || result.skippedReason) {
        // Mark as sent even if skipped (opt-out, etc.) to avoid retrying
        await prisma.releaseRecord.update({
          where: { id: record.id },
          data: { [fu.sentField]: true },
        });
        if (result.sent) sent++;
        else skipped++;
      } else {
        failed++;
      }
    }
  }

  return NextResponse.json({ sent, failed, skipped });
}
```

**Step 2: Add CRON_SECRET to `.env`**

Append to `.env`:
```
CRON_SECRET=your-secret-here-change-in-production
```

**Step 3: Commit**

```bash
git add src/app/api/cron/sms/route.ts
git commit -m "feat: add cron route for scheduled SMS (reminders + follow-ups)"
```

---

### Task 9: Settings UI — SMS category + SMS log page

**Files:**
- Modify: `src/app/(dashboard)/settings/settings-client.tsx` — add "sms" to CATEGORY_CONFIG
- Create: `src/app/(dashboard)/settings/sms-log/page.tsx` — SMS log server component
- Create: `src/app/(dashboard)/settings/sms-log/sms-log-client.tsx` — SMS log client component

**Step 1: Add SMS category to settings page**

In `settings-client.tsx`, find the `CATEGORY_CONFIG` array (line ~36). Add the SMS category entry after the `integrations` entry. Import the `MessageSquare` icon from lucide-react.

**Step 2: Create SMS log page**

Server component at `src/app/(dashboard)/settings/sms-log/page.tsx`:
- Fetch recent SMS logs via `getSmsLogs({ limit: 50 })`
- Fetch today's count via `getDailySmsCount()`
- Fetch daily limit via `getSettingValue("sms_daily_limit", 100)`
- Pass to `SmsLogClient`

**Step 3: Create SMS log client component**

At `src/app/(dashboard)/settings/sms-log/sms-log-client.tsx`:
- Table: time, recipient phone (formatted), type (label from `SMS_TYPE_LABELS`), status (badge with `SMS_STATUS_COLORS`), message (truncated)
- Status filter: ALL / SENT / FAILED tabs
- Header: "SMS Log — 42 / 100 sent today"
- Back button linking to `/settings`

**Step 4: Commit**

```bash
git add "src/app/(dashboard)/settings/settings-client.tsx" "src/app/(dashboard)/settings/sms-log/"
git commit -m "feat: add SMS settings category and SMS log viewer page"
```

---

### Task 10: Customer detail — SMS opt-out toggle

**Files:**
- Modify: `src/app/(dashboard)/customers/[id]/page.tsx` — pass smsOptOut to client
- Modify: customer detail client component — add toggle
- Modify: `src/lib/actions/customer-actions.ts` — add `toggleSmsOptOutAction`

**Step 1: Add toggle action to `customer-actions.ts`**

```typescript
export async function toggleSmsOptOutAction(
  customerId: string,
  smsOptOut: boolean
): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: "Unauthorized" };

  await prisma.customer.update({
    where: { id: customerId },
    data: { smsOptOut },
  });

  revalidatePath(`/customers/${customerId}`);
  return { success: true };
}
```

Add `import { prisma } from "@/lib/prisma";` if not already imported — or call via a service function.

**Step 2: Pass `smsOptOut` to client in customer detail page and add toggle UI**

In the customer detail client, add a small toggle in the contact info section:
```
SMS Notifications: [ON/OFF toggle]
```

**Step 3: Commit**

```bash
git add "src/app/(dashboard)/customers/" src/lib/actions/customer-actions.ts
git commit -m "feat: add SMS opt-out toggle on customer detail page"
```

---

### Task 11: Build verification and final commit

**Step 1: Run build**

Run: `npx next build`
Expected: "Compiled successfully" with 0 errors

**Step 2: Fix any type errors**

Address any TypeScript issues found during build.

**Step 3: Final verification commit**

```bash
git add -A
git commit -m "fix: resolve build errors for SMS notification system"
```

---

## Execution Notes

- **Do NOT add `.env` to git** — it contains CRON_SECRET
- All SMS sends use fire-and-forget (`.catch()`) to avoid blocking user-facing actions
- The cron route marks follow-ups as sent even if the customer opted out, to prevent retry loops
- Template variables are case-sensitive: `{customerName}` not `{customername}`
- Semaphore sender name max 11 characters — validated in the settings UI
