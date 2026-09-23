// Small helpers shared by the API functions.
export class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }

export const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

export const fail = (e) => {
  if (!(e instanceof HttpError)) console.error(e);
  return json({ error: e instanceof HttpError ? e.message : "Server error" }, e instanceof HttpError ? e.status : 500);
};

// Writes and Claude calls need APP_PASSCODE when it is set. Constant-time compare.
export function requirePasscode(request, env) {
  const need = env.APP_PASSCODE || "";
  if (!need) return;
  const got = request.headers.get("x-passcode") || "";
  let diff = got.length ^ need.length;
  for (let i = 0; i < need.length; i++) diff |= need.charCodeAt(i) ^ (got.charCodeAt(i) || 0);
  if (diff !== 0) throw new HttpError(401, "Passcode required");
}

export async function readJson(request, maxBytes) {
  const declared = Number(request.headers.get("content-length") || 0);
  if (declared > maxBytes) throw new HttpError(413, "Request too large");
  const text = await request.text();
  if (text.length > maxBytes) throw new HttpError(413, "Request too large");
  try { return JSON.parse(text); } catch { throw new HttpError(400, "Body must be JSON"); }
}

// Per-IP hourly cap and a site-wide daily cap on Claude calls, both configurable.
export async function rateLimit(env, request) {
  const ip = request.headers.get("cf-connecting-ip") || "local";
  const perHour = parseInt(env.RUNS_PER_HOUR || "20", 10);
  const perDay = parseInt(env.RUNS_PER_DAY || "200", 10);
  const now = Date.now();
  await env.DB.prepare("DELETE FROM runs WHERE at < ?").bind(now - 86400e3).run();
  const mine = await env.DB.prepare("SELECT COUNT(*) AS n FROM runs WHERE ip = ? AND at >= ?").bind(ip, now - 3600e3).first();
  if ((mine?.n || 0) >= perHour) throw new HttpError(429, "Hourly limit reached for this connection");
  const all = await env.DB.prepare("SELECT COUNT(*) AS n FROM runs").first();
  if ((all?.n || 0) >= perDay) throw new HttpError(429, "Daily limit reached for this site");
  await env.DB.prepare("INSERT INTO runs (ip, at) VALUES (?, ?)").bind(ip, now).run();
}

// Row -> API shape.
export function rowToSystem(r) {
  const parse = (s, d) => { try { return JSON.parse(s); } catch { return d; } };
  return {
    id: r.id, createdAt: r.created_at, updatedAt: r.updated_at, name: r.name, tagline: r.tagline,
    rev: r.rev, brief: r.brief, author: r.author, thumbs: parse(r.thumbs, []), spec: parse(r.spec, {}),
  };
}

export function checkSpec(spec) {
  if (!spec || typeof spec !== "object" || Array.isArray(spec)) throw new HttpError(400, "spec must be an object");
  const s = JSON.stringify(spec);
  if (s.length > 120000) throw new HttpError(413, "spec is too large");
  return s;
}
