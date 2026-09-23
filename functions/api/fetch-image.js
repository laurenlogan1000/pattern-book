// Fetches an image from a URL the user pasted in (e.g. copied from a Pinterest pin) and hands
// it back same-origin, so the browser can resize it exactly like an uploaded file without hitting
// CORS/tainted-canvas trouble on hosts that don't send permissive CORS headers.
import { HttpError, fail, requirePasscode } from "../../lib/http.js";

const TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_BYTES = 12_000_000;
const BLOCKED_HOST = /^(localhost|127\.|0\.|10\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1\]?)/i;

export async function onRequestGet({ request, env }) {
  try {
    requirePasscode(request, env);
    const target = new URL(request.url).searchParams.get("url") || "";
    let u;
    try { u = new URL(target); } catch { throw new HttpError(400, "That's not a valid URL"); }
    if (u.protocol !== "https:" && u.protocol !== "http:") throw new HttpError(400, "URL must be http or https");
    if (BLOCKED_HOST.test(u.hostname)) throw new HttpError(400, "That host isn't allowed");

    const upstream = await fetch(u.toString(), { headers: { "user-agent": "Mozilla/5.0 (compatible; PatternBook/1.0)" } });
    if (!upstream.ok) throw new HttpError(502, "Couldn't fetch that URL (" + upstream.status + ")");
    const type = (upstream.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    if (!TYPES.has(type)) throw new HttpError(415, "That URL isn't a JPEG, PNG or WebP image");
    const len = Number(upstream.headers.get("content-length") || 0);
    if (len > MAX_BYTES) throw new HttpError(413, "That image is too large");

    const buf = await upstream.arrayBuffer();
    if (buf.byteLength > MAX_BYTES) throw new HttpError(413, "That image is too large");
    return new Response(buf, { headers: { "content-type": type, "cache-control": "no-store" } });
  } catch (e) { return fail(e); }
}
