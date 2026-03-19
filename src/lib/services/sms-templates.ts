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
