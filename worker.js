// worker.js
// Cron + HTTP (pour tester manuellement en GET)
export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(checkTunnelsAndNotify(env));
  },
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname === "/run") {
      const auth = req.headers.get("Authorization");
      if (!env.RUN_SECRET || auth !== `Bearer ${env.RUN_SECRET}`) {
        return new Response("Unauthorized", { status: 401 });
      }
      return checkTunnelsAndNotify(env).then(() => new Response("ok"));
    }
    return new Response("use /run or cron");
  }
};

async function isTunnelUp(accountId, tid, headers) {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/cfd_tunnel/${tid}/connections`,
    { headers }
  );
  const json = await res.json();
  const conns = json.result || [];
  return Array.isArray(conns) && conns.length > 0;
}

async function checkTunnelsAndNotify(env) {
  const headers = {
    "Authorization": `Bearer ${env.CF_API_TOKEN}`,
    "Content-Type": "application/json"
  };

  // 1) Lister les tunnels
  const listRes = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/cfd_tunnel`,
    { headers }
  );
  const listJson = await listRes.json();
  if (!listJson.success) throw new Error("CF list tunnels failed");

  const tunnels = listJson.result || [];
  const messages = [];

  for (const t of tunnels) {
    const tid = t.id || t.uuid || t.tunnel_id;
    const name = t.name || tid;

    // 2) Connections du tunnel
    const up = await isTunnelUp(env.CF_ACCOUNT_ID, tid, headers);

    // 3) If down, re-check immediately to confirm
    const confirmedUp = up || await isTunnelUp(env.CF_ACCOUNT_ID, tid, headers);

    // 4) Dédup via KV: notifier seulement si changement
    const key = `tunnel:${tid}:status`;
    const prev = (await env.STATE.get(key)) || "unknown";
    const now = confirmedUp ? "up" : "down";

    if (prev !== now) {
      await env.STATE.put(key, now);
      const emoji = confirmedUp ? "✅" : "⚠️";
      messages.push(`${emoji} *${name}* → ${now.toUpperCase()}`);
    }
  }

  // 4) Envoi Telegram si au moins un changement
  if (messages.length) {
    const text = messages.join("\n");
    await fetch(`https://api.telegram.org/bot${env.TG_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: env.TG_CHAT_ID,
        text,
        parse_mode: "Markdown"
      })
    });
  }
}
