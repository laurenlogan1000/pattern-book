// The library: list everything, or add a new system.
import { HttpError, json, fail, requirePasscode, readJson, rowToSystem, checkSpec } from "../../../lib/http.js";

export async function onRequestGet({ env }) {
  try {
    const { results } = await env.DB.prepare(
      "SELECT id, created_at, updated_at, name, tagline, rev, brief, author, thumbs, spec FROM systems ORDER BY created_at DESC LIMIT 200"
    ).all();
    return json({ systems: results.map(rowToSystem) });
  } catch (e) { return fail(e); }
}

const validImage = (s) => typeof s === "string" && s.startsWith("data:image/jpeg;base64,") && /^[A-Za-z0-9+/]+=*$/.test(s.slice(23));

export async function onRequestPost({ request, env }) {
  try {
    requirePasscode(request, env);
    const b = await readJson(request, 1_000_000);
    const spec = checkSpec(b.spec);
    const thumbs = (Array.isArray(b.thumbs) ? b.thumbs : []).slice(0, 6).filter(validImage);
    const thumbsJson = JSON.stringify(thumbs);
    if (thumbsJson.length > 300_000) throw new HttpError(413, "Thumbnails are too large");
    const hero = validImage(b.hero) && b.hero.length <= 300_000 ? b.hero : null;
    const id = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
    const now = new Date().toISOString();
    await env.DB.prepare(
      "INSERT INTO systems (id, created_at, updated_at, name, tagline, rev, brief, author, thumbs, spec, hero) VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?)"
    ).bind(id, now, now, String(b.spec.name || "Untitled").slice(0, 40), String(b.spec.tagline || "").slice(0, 160),
      String(b.brief || "").slice(0, 1200), String(b.author || "").slice(0, 40), thumbsJson, spec, hero).run();
    return json({ id }, 201);
  } catch (e) { return fail(e); }
}
