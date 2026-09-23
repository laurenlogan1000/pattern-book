# Pattern Book

Turn one photo, or a set of them, into a design system and a sample site. Each run is saved to a shared library, can be revised with plain-language feedback, and exports to Figma.

The method is a prompt with hard exclusions: no template defaults, no generated-UI clichés, one shape and one line taken from the photos, the front-page hero built first, and a self-audit. The page then checks the result against those rules (excluded fonts, default radii, 4px grids, text contrast in both themes).

## How it's built

| Part | Where | What it does |
|---|---|---|
| Frontend | `public/` | Static HTML and ES modules. No build step. |
| Prompt | `public/js/prompt.js` | The method, exclusions and output contract. Imported by both the browser and the API. |
| API | `functions/api/` | Cloudflare Pages Functions. |
| Database | `schema.sql` | Cloudflare D1 (SQLite): the library, earlier versions, and a rate-limit log. |

API routes:

- `GET /api/config`: whether a passcode is required.
- `POST /api/claude`: runs the method on Claude and streams the answer. The prompt is built on the server from fixed templates, so this route can't be used as a general Claude proxy.
- `GET /api/systems`, `POST /api/systems`: list the library, add to it.
- `GET`, `PATCH`, `DELETE /api/systems/:id`: read, revise (the old version is kept in `versions`), delete.

Every run is billed to **your** Anthropic API key. Anyone who can reach the site and knows the passcode can spend it, so set a passcode and keep the rate limits.

## Deploy (about 15 minutes)

You need a GitHub account, a free Cloudflare account, an Anthropic API key from https://platform.claude.com, and Node.js 20 or later.

1. **Put the code on GitHub.** Create an empty repository, then from this folder:
   ```sh
   git init && git add . && git commit -m "Pattern Book"
   git branch -M main
   git remote add origin https://github.com/YOUR-NAME/pattern-book.git
   git push -u origin main
   ```

2. **Create the database.**
   ```sh
   npm install
   npx wrangler login
   npx wrangler d1 create pattern-book
   ```
   Copy the `database_id` it prints into `wrangler.toml`, replacing `REPLACE_WITH_YOUR_DATABASE_ID`. Then create the tables and push the change:
   ```sh
   npm run db:init
   git commit -am "Set D1 database id" && git push
   ```

3. **Connect the repo to Cloudflare Pages.** In the Cloudflare dashboard: Workers & Pages → Create → Pages → Connect to Git → choose the repository. Framework preset: None. Build command: leave empty. Build output directory: `public`. Deploy.

4. **Add the secrets.** In the Pages project: Settings → Variables and Secrets → Add, for Production:
   - `ANTHROPIC_API_KEY` (type: Secret): your API key.
   - `APP_PASSCODE` (type: Secret): a passcode you give to people allowed to make and edit systems. Leave it unset only if you accept that anyone with the link can spend your key.

   Then Deployments → the latest deployment → Retry deployment, so the secrets take effect.

5. **Check the database binding.** Settings → Bindings should list a D1 database bound as `DB`. It comes from `wrangler.toml`; if it's missing, add it there by hand (variable name `DB`, database `pattern-book`).

6. Open `https://pattern-book.pages.dev` (or the address Cloudflare shows). Every push to `main` redeploys.

To use your own domain: the Pages project → Custom domains.

## Settings

Set in `wrangler.toml` under `[vars]`, or in the dashboard (dashboard values win):

| Name | Default | Meaning |
|---|---|---|
| `MODEL` | `claude-opus-5-5` | The Claude model. `claude-sonnet-5` is faster and cheaper; `claude-fable-5-1` is the most capable. |
| `MAX_TOKENS` | `32000` | Output budget per run, thinking included. |
| `RUNS_PER_HOUR` | `20` | Claude runs allowed per connection per hour. |
| `RUNS_PER_DAY` | `200` | Claude runs allowed for the whole site per day. |

Also set a spend limit on your key in the Anthropic console.

## Run it locally

```sh
cp .dev.vars.example .dev.vars   # then fill in your key and a passcode
npm run db:init:local
npm run dev                      # http://localhost:8788
```

## Figma

- **Tokens JSON**: load with the Tokens Studio plugin (Load from file). The two themes become variable modes.
- **Specimen SVG**: drag onto a Figma canvas; it arrives as editable vectors and text layers.
- **Site HTML**: open in a browser, or convert to layers with an HTML-to-Figma plugin such as html.to.design.

## Notes

- Claude Opus 5.5 always uses adaptive thinking, so the API call sends no `thinking` parameter. The stream carries thinking blocks first; the page reads only the text.
- Photos are resized in the browser to 1568px on the long edge before they're sent, and small thumbnails are stored with each entry. The full photos are not stored.
- Model output is treated as untrusted: text is escaped, and the CSS the model writes for the shape, line and pattern is filtered to a safe set of properties before it's rendered.
