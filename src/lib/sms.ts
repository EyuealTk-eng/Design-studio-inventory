import "server-only";

/**
 * Sends one SMS through the provider named in SMS_PROVIDER:
 *   afromessage   — Ethiopian gateway (afromessage.com)
 *   africastalking
 *   twilio
 * Unset → messages are only printed to the server log (development).
 * Returns true when the provider accepted the message.
 */
export async function sendSms(to: string, message: string): Promise<boolean> {
  const provider = process.env.SMS_PROVIDER;
  const text = message.length > 450 ? `${message.slice(0, 447)}...` : message;
  try {
    switch (provider) {
      case "afromessage":
        return await afroMessage(to, text);
      case "africastalking":
        return await africasTalking(to, text);
      case "twilio":
        return await twilio(to, text);
      default:
        console.info(`[sms:dev] to=${to} text="${text}"`);
        return false;
    }
  } catch (err) {
    // An SMS failure must never break the action that triggered it.
    console.error(`SMS via ${provider} failed`, err);
    return false;
  }
}

export function smsConfigured() {
  return ["afromessage", "africastalking", "twilio"].includes(process.env.SMS_PROVIDER ?? "");
}

function need(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set`);
  return v;
}

async function afroMessage(to: string, message: string) {
  const params = new URLSearchParams({ to, message });
  if (process.env.AFROMESSAGE_IDENTIFIER_ID) params.set("from", process.env.AFROMESSAGE_IDENTIFIER_ID);
  if (process.env.AFROMESSAGE_SENDER_NAME) params.set("sender", process.env.AFROMESSAGE_SENDER_NAME);
  const res = await fetch(`https://api.afromessage.com/api/send?${params}`, {
    headers: { Authorization: `Bearer ${need("AFROMESSAGE_TOKEN")}` },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok || body?.acknowledge !== "success") throw new Error(`AfroMessage: ${res.status} ${JSON.stringify(body)}`);
  return true;
}

async function africasTalking(to: string, message: string) {
  const form = new URLSearchParams({ username: need("AT_USERNAME"), to, message });
  if (process.env.AT_SENDER_ID) form.set("from", process.env.AT_SENDER_ID);
  const host = process.env.AT_USERNAME === "sandbox" ? "api.sandbox.africastalking.com" : "api.africastalking.com";
  const res = await fetch(`https://${host}/version1/messaging`, {
    method: "POST",
    headers: { apiKey: need("AT_API_KEY"), Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
    body: form,
  });
  if (!res.ok) throw new Error(`Africa's Talking: ${res.status} ${await res.text()}`);
  return true;
}

async function twilio(to: string, message: string) {
  const sid = need("TWILIO_ACCOUNT_SID");
  const form = new URLSearchParams({ To: to, Body: message, From: need("TWILIO_FROM") });
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${sid}:${need("TWILIO_AUTH_TOKEN")}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form,
  });
  if (!res.ok) throw new Error(`Twilio: ${res.status} ${await res.text()}`);
  return true;
}
