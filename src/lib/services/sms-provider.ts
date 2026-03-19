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

    if (Array.isArray(data) && data.length > 0 && data[0].message_id) {
      return { success: true, messageId: String(data[0].message_id), error: null };
    }

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
