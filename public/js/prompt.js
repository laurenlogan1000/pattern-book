// The method, exclusions and output contract. Shared by the browser and the API function.
/* ---------- the prompt ---------- */
export const METHOD=`Method
1. Number the photos and describe each in one line. Give each a role: anchor, palette, texture, or dropped. The anchor is the most distinctive photo, not the most typical.
2. Colour: extract per photo. Colours that recur across at least half the set are identity; colours from one photo only are accents or signals. Name the photo and region for every colour. Build two themes from the same photos; theme "a" is the one closest to the anchor's light.
3. ONE shape and ONE line texture, taken from the anchor or from something that recurs across the set. Name the photo and region. Every container uses that shape at two sizes (small for controls, large for panels). Every divider, focus mark and error mark uses that line.
4. Mine real marks first: signage, labels, stamps, tape, numbers, materials, construction. Use them before inventing.
5. Six words that describe the photos. Turn them into three Google Fonts families (display, body, label), each chosen by one named word. When there is a choice, take the less-travelled option.
6. Build the front-page hero from the anchor first, then the UI.
7. Audit before you answer: (a) describe the result as if a default AI tool had made it, and change whatever in that description is true; (b) could a different set of photos from the same industry have produced this? Change what is interchangeable; (c) name any photo that contributed nothing. Report each change as what the default was and what it is now.

Hard exclusions
- Nothing shadcn, Tailwind or Material ship by default: no uniform 4-16px border-radius, no 1px border on all four sides of a box, no elevation ladder or grey drop shadows, no 16px card padding, no 4px or 8px spacing grid.
- No fonts common in generated UI: Inter, Roboto, Open Sans, Lato, Montserrat, Poppins, Geist, DM Sans, Manrope, Plus Jakarta Sans, Space Grotesk, Space Mono, JetBrains Mono, IBM Plex, Playfair Display, Fraunces, Instrument Serif, Instrument Sans, Bricolage Grotesque, Syne, Figtree, Outfit, Sora, Work Sans, Lora, Merriweather, Nunito, Raleway, Oswald. Nothing in the top 100 Google Fonts.
- No generated-UI palettes: warm cream ground with a serif and a terracotta accent; near-black with one acid-green or vermilion accent; purple-blue gradients; gradients as decoration.
- No generated-UI layouts: headline-left / image-right hero; identical rounded cards; broadsheet hairline columns with zero radius.
- No template chrome: tracked-out uppercase eyebrow above every heading, letterspaced mono labels, "A · B · C" meta strings, arrows on buttons, 01/02/03 markers on things that are not sequences.
- Name three visual cliches of this subject or industry in audit.industry_cliches and do not use them.
- Sample-site copy is about the real subject of the photos: plain, specific, active voice; buttons say what happens.`;
export const CONTRACT=`CSS contract (the page renders your CSS directly; break it and the sample site breaks)
- Colours are CSS custom properties named after the roles: var(--ground), var(--surface), var(--surface-2), var(--ink), var(--ink-muted), var(--action), var(--action-ink), var(--accent), var(--line), var(--link), var(--signal), var(--success), var(--fill-1) to var(--fill-4). Spacing: var(--s1) to var(--s6).
- shape.small_css and shape.large_css: CSS declarations only (no selectors, no braces), applied to an element whose background the page sets. Use per-corner border-radius, clip-path (polygon(), inset(), ellipse(), path()) or mask / -webkit-mask with gradients. Never width, height, margin, padding, position, display, background, color, border, shadow or font. No url(), no @rules. Small goes on buttons and inputs (about 48px tall); large on panels (200 to 400px). Content sits inside with padding, so keep cut-ins within about 10px of the edge for small and 28px for large.
- The page draws focus and form errors as your line under the element, never as an outline, so clip freely.
- line.css: declarations for a full-width block element: set height and background (layered linear-gradients allowed). Use var(--line) as the main colour: the page recolours --line for focus (ink) and errors (signal). No borders.
- line.svg_rects: the same line as rectangles [y, height] inside a 16px-tall strip, for the Figma export.
- pattern.css: background declarations for a decorative layer drawn only inside colour blocks, never behind text: background-image with repeating gradients, background-size, opacity. Colours via var().
- shape.svg_path: the large shape as one SVG path inside a 240x160 box, for the Figma export.
- Every text pair reaches 4.5:1 in both themes: ink on ground and on surface, ink-muted on ground, action-ink on action, link, signal and success on ground. The page checks.
- Fonts: real Google Fonts family names, spelled exactly as Google spells them.`;
export const SCHEMA=`{
 "name":"one or two words","tagline":"one sentence in the system's voice",
 "photos":[{"n":1,"desc":"one line","role":"anchor|palette|texture|dropped","note":"what it contributed, or why dropped"}],
 "anchor":1,"words":["six","words"],
 "themes":[{"id":"a","name":"short name"},{"id":"b","name":"short name"}],
 "colors":{"ground":{"label":"evocative name","a":"#rrggbb","b":"#rrggbb","usage":"when to use it","source":"photo 2, region"}, "...":"one entry for EVERY role: ground, surface, surface-2, ink, ink-muted, action, action-ink, accent, line, link, signal, success, fill-1, fill-2, fill-3, fill-4"},
 "type":{"display":{"family":"Google Fonts name","word":"which of the six words","why":"one sentence"},"body":{"family":"","word":"","why":""},"label":{"family":"","word":"","why":""},"display_size":96,"display_leading":0.92,"display_weight":400,"display_case":"none|upper","body_size":17,"label_case":"none|upper","label_tracking":0.02},
 "spacing":[3,9,15,27,45,81],
 "shape":{"name":"","source":"photo n, region","why":"","small_css":"","large_css":"","svg_path":""},
 "line":{"name":"","source":"photo n, region","css":"","svg_rects":[[0,3],[6,1]]},
 "pattern":{"name":"","css":""},
 "hero":{"layout":"centered|offset|stacked|banded","eyebrow":"optional, usually empty","headline":"","sub":"","cta":"","secondary_cta":""},
 "site":{"brand":"","nav":["","",""],"features":[{"title":"","body":""},{"title":"","body":""},{"title":"","body":""}],"form":{"title":"","body":"","label":"","placeholder":"","cta":"","error":"an example validation message"},"list":{"title":"","rows":[["","",""],["","",""],["","",""],["","",""]]},"footer":""},
 "rules":["6 to 8 usage rules that name roles and the shape and line"],
 "audit":{"generic_description":"","changes":[{"was":"","now":""},{"was":"","now":""},{"was":"","now":""}],"industry_cliches":["","",""],"interchangeable_check":"","dropped_photos":[{"n":0,"why":""}]}
}`;
export function buildPrompt(n,anchor,brief){return `You are a design lead extracting a brand design system from ${n} photo${n>1?"s":""}, attached in order as photo 1${n>1?" to "+n:""}. ${anchor?`The user chose photo ${anchor} as the anchor.`:(n>1?"Choose the anchor yourself.":"Photo 1 is the anchor.")}
Brief from the user: ${brief?brief.slice(0,1200):"(none: infer the subject from the photos)"}
Front page first, product UI second.

${METHOD}

${CONTRACT}

Reply with ONLY one JSON object in exactly this shape (the values show types, not suggestions):
${SCHEMA}`}
export function buildRevise(spec,feedback){return `Here is a design system as JSON. Revise it according to the feedback below. Keep everything the feedback does not touch. Keep the same schema and every rule of the method, exclusions and CSS contract. Add one entry to audit.changes describing this revision.

Feedback: ${feedback.slice(0,1500)}

${METHOD}

${CONTRACT}

Current system:
${JSON.stringify(spec)}

Reply with ONLY the full revised JSON object, same shape.`}

