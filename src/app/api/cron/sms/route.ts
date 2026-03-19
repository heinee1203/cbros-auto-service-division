import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendCustomerSms, getDailySmsCount } from "@/lib/services/sms";
import { getSettingValue } from "@/lib/services/settings";
import { formatDate } from "@/lib/utils";
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
