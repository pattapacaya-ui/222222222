import type { Env } from '../types';

export async function signWebhookPayload(payload: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function dispatchWebhook(
  env: Env,
  appId: string,
  event: string,
  payload: Record<string, unknown>
): Promise<void> {
  const { results: webhooks } = await env.DB.prepare(
    `SELECT * FROM webhooks WHERE application_id = ? AND enabled = 1`
  ).bind(appId).all() as { results: Array<{ id: string; url: string; events: string; secret: string }> };

  const body = JSON.stringify({
    type: event,
    data: payload,
    timestamp: new Date().toISOString(),
  });

  for (const webhook of webhooks) {
    let events: string[] = [];
    try { events = JSON.parse(webhook.events) as string[]; } catch { continue; }
    if (!events.includes(event) && !events.includes('*')) continue;

    const signature = await signWebhookPayload(body, webhook.secret);
    const deliveryId = `whdel_${crypto.randomUUID().replace(/-/g, '')}`;
    const now = Date.now();

    try {
      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-LegionAuth-Signature': `sha256=${signature}`,
          'X-LegionAuth-Event': event,
          'X-Webhook-Id': deliveryId,
        },
        body,
        signal: AbortSignal.timeout(10000),
      });

      await env.DB.prepare(
        `INSERT INTO webhook_deliveries (id, webhook_id, event_type, payload, response_status, response_body, delivered_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        deliveryId, webhook.id, event, body,
        response.status,
        (await response.text()).slice(0, 1000),
        response.ok ? now : null,
        now
      ).run();
    } catch (err) {
      await env.DB.prepare(
        `INSERT INTO webhook_deliveries (id, webhook_id, event_type, payload, response_status, failed_at, created_at)
         VALUES (?, ?, ?, ?, NULL, ?, ?)`
      ).bind(deliveryId, webhook.id, event, body, now, now).run();
    }
  }
}
