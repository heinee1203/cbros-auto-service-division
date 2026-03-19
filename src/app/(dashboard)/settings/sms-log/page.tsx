import { getSmsLogs, getDailySmsCount } from "@/lib/services/sms";
import { getSettingValue } from "@/lib/services/settings";
import { SmsLogClient } from "./sms-log-client";

export default async function SmsLogPage() {
  const [logs, dailyCount, dailyLimit] = await Promise.all([
    getSmsLogs({ limit: 50 }),
    getDailySmsCount(),
    getSettingValue<number>("sms_daily_limit", 100),
  ]);

  return (
    <SmsLogClient
      initialLogs={JSON.parse(JSON.stringify(logs))}
      dailyCount={dailyCount}
      dailyLimit={dailyLimit}
    />
  );
}
