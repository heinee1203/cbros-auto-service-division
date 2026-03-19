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
  const enabled = await getSettingValue<boolean>("sms_enabled", false);
  if (!enabled) {
    return { sent: false, skippedReason: "SMS disabled" };
  }

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

  const dailyLimit = await getSettingValue<number>("sms_daily_limit", 100);
  const todayCount = await getDailySmsCount();
  if (todayCount >= dailyLimit) {
    console.warn(`[SMS] Daily limit reached (${todayCount}/${dailyLimit})`);
    return { sent: false, skippedReason: "Daily limit reached" };
  }

  const phone = normalizeToE164(customer.phone);
  if (!phone) {
    return { sent: false, error: `Invalid phone format: ${customer.phone}` };
  }

  const shopName = await getSettingValue<string>("shop_name", "AutoServ Pro");
  const shopPhone = await getSettingValue<string>("shop_phone", "");
  const enrichedVars = {
    customerName: customer.firstName,
    shopName,
    shopPhone,
    ...variables,
  };

  const message = await renderTemplate(type, enrichedVars);

  const senderName = await getSettingValue<string>("sms_sender_name", "AutoServ");
  const result = await sendSms(phone, message, senderName);

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
