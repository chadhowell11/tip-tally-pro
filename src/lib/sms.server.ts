// Twilio SMS delivery through the Lovable connector gateway (server-only).

const GATEWAY_URL = "https://connector-gateway.lovable.dev/twilio";

export type SendResult =
  | { ok: true; sid: string | null }
  | { ok: false; error: string };

export function smsConfigured(): boolean {
  return !!process.env.LOVABLE_API_KEY && !!process.env.TWILIO_API_KEY;
}

export async function sendSms(to: string, from: string, body: string): Promise<SendResult> {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const twilioKey = process.env.TWILIO_API_KEY;
  if (!lovableKey || !twilioKey) {
    return { ok: false, error: "Text messaging isn't connected yet." };
  }

  try {
    const response = await fetch(`${GATEWAY_URL}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": twilioKey,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: to, From: from, Body: body }),
    });

    const text = await response.text();
    if (!response.ok) {
      console.error(`Twilio send failed [${response.status}]: ${text}`);
      return { ok: false, error: `Provider error [${response.status}]: ${text.slice(0, 300)}` };
    }
    let sid: string | null = null;
    try {
      sid = (JSON.parse(text) as { sid?: string }).sid ?? null;
    } catch {
      sid = null;
    }
    return { ok: true, sid };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Twilio send threw:", message);
    return { ok: false, error: message };
  }
}
