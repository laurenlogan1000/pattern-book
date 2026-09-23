# Pattern Book: context for Claude Code

This project was designed and built in a claude.ai conversation, then moved here. This file carries that context. Read it before changing anything.

## What it is

A web tool: upload 1–6 photos (plus an optional brief), Claude extracts a design system from them, and the page renders it as a live sample site. Every run is saved to a shared library, can be revised with plain-language feedback, and exports to Figma (tokens JSON, specimen SVG, site HTML).

Started as a claude.ai artifact; this repo is the standalone version on Cloudflare Pages + Pages Functions + D1. README.md has the deploy steps.

## The method (the point of the whole tool)

It lives in `public/js/prompt.js` and was refined over several rounds with the user. Protect these properties when editing it:

- **Hard exclusions beat preferences.** "Bias toward the less popular option" produced average results; explicit bans moved the output. Banned: shadcn/Tailwind/Material defaults (uniform 4–16px radius, 1px four-sided borders, elevation ladders, 4/8px grids), fonts common in generated UI (list in the prompt and in `BANNED_FONTS` in core.js; keep them in sync), generated-UI palettes (cream + serif + terracotta; near-black + one acid accent; purple-blue gradients), headline-left/image-right heroes, tracked uppercase eyebrows and mono labels.
- **One shape and one line**, taken from a named photo region. Every container uses the shape at two sizes; every divider, focus mark and error mark uses the line. This single constraint is what made the results feel like brands rather than templates.
- **Front page first**: the hero is designed before the UI.
- **Multi-photo**: pick an anchor (most distinctive, not most typical); colours recurring in ≥ half the photos are identity, single-photo colours are accents; cite photo + region for everything.
- **Audit**: (a) describe the result as if a default AI tool made it and change what's true; (b) could other photos from the same industry produce this? change what's interchangeable; (c) name photos that contributed nothing.

The user's taste, from feedback: they liked the extracted colours and the asymmetric "petal" buttons; they disliked mismatched radii between buttons and cards, and anything that reads as "a shadcn template with small twists". They want "front-site / brand-worthy", not "average safe".

## Architecture

- `public/js/prompt.js`: METHOD, CONTRACT, SCHEMA, `buildPrompt`, `buildRevise`. Imported by the browser (for the "download prompt" export) and by `functions/api/claude.js`, which builds the prompt server-side so the endpoint can't be used as a general Claude proxy.
- `public/js/core.js`: `normalize()` (validates model JSON, fills defaults, clamps values), `cleanCss()` (filters model-written CSS to safe properties; it's rendered into pages, so treat it as untrusted), `lint()` (checks the result against the prompt's rules), the sample-site and specimen renderers, and the exports.
- `public/js/app.js`: UI, state, API calls, SSE parsing. Plain ES modules, no build step, no framework.
- `functions/api/claude.js`: streams from the Anthropic Messages API. Model `claude-opus-5-5`, which always uses adaptive thinking: send **no** `thinking` parameter. The stream has thinking blocks first; the client reads only `text_delta`.
- `functions/api/systems/*`: library CRUD on D1. PATCH saves the previous spec into `versions`.
- `lib/http.js`: passcode check (`APP_PASSCODE`, header `x-passcode`), JSON helpers, rate limiting (`runs` table: per-IP hourly, site-wide daily).

The model returns colours as fixed roles (ground, surface, surface-2, ink, ink-muted, action, action-ink, accent, line, link, signal, success, fill-1..4) with values for two themes `a`/`b`, so the renderer is generic. Shape and line come back as CSS declarations (clip-path / mask / per-corner radius); focus and errors are drawn as the line under an element, never an outline, because masks clip outlines.

## Status

Tested on Cloudflare's local runtime (`wrangler pages dev`) with `scripts/mock-claude.mjs` standing in for the API: create, wrong passcode, save, revise (rev 2 + version kept), export, delete, rate limit, and malicious-thumbnail filtering all pass, with no page errors at phone width.

**Not yet verified:**
1. A real Claude call. First live run is the test; the API's error message is shown on screen.
2. That the D1 binding in `wrangler.toml` is picked up by a Git-connected Pages project (README tells the user to check Settings → Bindings).
3. Tokens JSON import in Tokens Studio, and whether Figma's native variable import accepts it.
4. The `claude.ai` artifact version used `window.claude` runtime APIs; none of that remains here. If you see `window.claude`, it's a leftover.

## Next steps the user was heading toward

- Deploy: `npx wrangler d1 create pattern-book` → paste id into `wrangler.toml` → `npm run db:init` → connect repo in Cloudflare Pages (output dir `public`) → add secrets `ANTHROPIC_API_KEY`, `APP_PASSCODE` → redeploy.
- Then run a real generation and fix whatever the live model output breaks (most likely: CSS the filter drops, or JSON wrapped in prose; `parseJson` in app.js handles fences and surrounding text).

## Local development

```sh
npm install
cp .dev.vars.example .dev.vars        # real key, or the mock values below
npm run db:init:local
npm run dev                            # http://localhost:8788
```

To test without a key, put these in `.dev.vars` and run `npm run mock` in a second terminal:

```
ANTHROPIC_API_KEY=test-key
ANTHROPIC_BASE_URL=http://127.0.0.1:9999
APP_PASSCODE=tulip
```

## Conventions

- No build step and no framework; keep it that way unless the user asks.
- Everything from the model is untrusted: escape text with `esc()`, pass CSS through `cleanCss()`, validate thumbnails as `data:image/jpeg;base64,`.
- The user reads on a phone: keep the UI working at 390px wide.
