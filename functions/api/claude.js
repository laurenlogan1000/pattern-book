// Runs the method on Claude and streams the answer back.
// The prompt is built here from fixed templates, so this endpoint can't be used as a general Claude proxy.
import { buildPrompt, buildRevise } from "../../public/js/prompt.js";
import { HttpError, fail, requirePasscode, readJson, rateLimit, checkSpec } from "../../lib/http.js";

const TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function onRequestPost({ request, env }) {
  try {
    requirePasscode(request, env);
    if (!env.ANTHROPIC_API_KEY) throw new HttpError(500, "ANTHROPIC_API_KEY is not set on the server");
    const body = await readJson(request, 40_000_000);

    let prompt, images = [];
    if (body.mode === "create") {
      images = Array.isArray(body.images) ? body.images : [];
      if (images.length < 1 || images.length > 6) throw new HttpError(400, "Send between 1 and 6 photos");
      for (const im of images) {
        if (!TYPES.has(im?.media_type) || typeof im.data !== "string" || im.data.length > 7_000_000 || !/^[A-Za-z0-9+/]+=*$/.test(im.data))
          throw new HttpError(400, "One of the photos isn't a valid JPEG, PNG or WebP");
      }
      const anchor = Number.isInteger(body.anchor) && body.anchor >= 1 && body.anchor <= images.length ? body.anchor : 0;
      prompt = buildPrompt(images.length, anchor, String(body.brief || "").slice(0, 1200));
    } else if (body.mode === "revise") {
      checkSpec(body.spec);
      const feedback = String(body.feedback || "").trim();
      if (!feedback) throw new HttpError(400, "Feedback is empty");
      prompt = buildRevise(body.spec, feedback.slice(0, 1500));
    } else {
      throw new HttpError(400, "Unknown mode");
    }

    await rateLimit(env, request);

    // Claude Opus 5.5 always thinks (adaptive); don't send a thinking parameter. Thinking arrives as
    // thinking blocks in the stream and the page reads only the text blocks.
    const upstream = await fetch((env.ANTHROPIC_BASE_URL || "https://api.anthropic.com") + "/v1/messages", {
      method: "POST",
      headers: { "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: env.MODEL || "claude-opus-5-5",
        max_tokens: parseInt(env.MAX_TOKENS || "32000", 10),
        stream: true,
        messages: [{
          role: "user",
          content: [
            ...images.map((im) => ({ type: "image", source: { type: "base64", media_type: im.media_type, data: im.data } })),
            { type: "text", text: prompt },
          ],
        }],
      }),
    });
    if (!upstream.ok) {
      const t = await upstream.text();
      let msg = t;
      try { msg = JSON.parse(t).error?.message || t; } catch {}
      throw new HttpError(upstream.status === 429 ? 429 : 502, "Claude API: " + String(msg).slice(0, 300));
    }
    return new Response(upstream.body, { headers: { "content-type": "text/event-stream", "cache-control": "no-store" } });
  } catch (e) {
    return fail(e);
  }
}
