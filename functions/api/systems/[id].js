// One system: read it, revise it (keeping the old version), or delete it.
import { HttpError, json, fail, requirePasscode, readJson, rowToSystem, checkSpec } from "../../../lib/http.js";

const getRow = (env, id) => env.DB.prepare("SELECT * FROM systems WHERE id = ?").bind(id).first();

export async function onRequestGet({ env, params }) {
  try {
    const row = await getRow(env, params.id);
    if (!row) throw new HttpError(404, "Not found");
    return json(rowToSystem(row));
  } catch (e) { return fail(e); }
}

export async function onRequestPatch({ request, env, params }) {
  try {
    requirePasscode(request, env);
    const b = await readJson(request, 200_000);
    const spec = checkSpec(b.spec);
    const row = await getRow(env, params.id);
    if (!row) throw new HttpError(404, "Not found");
    const now = new Date().toISOString();
    const rev = (row.rev || 1) + 1;
    await env.DB.batch([
      env.DB.prepare("INSERT INTO versions (system_id, rev, at, spec) VALUES (?, ?, ?, ?)").bind(row.id, row.rev || 1, now, row.spec),
      env.DB.prepare("UPDATE systems SET spec = ?, name = ?, tagline = ?, rev = ?, updated_at = ?, last_feedback = ? WHERE id = ?")
        .bind(spec, String(b.spec.name || row.name).slice(0, 40), String(b.spec.tagline || "").slice(0, 160), rev, now,
          String(b.feedback || "").slice(0, 1500), row.id),
    ]);
    return json({ id: row.id, rev });
  } catch (e) { return fail(e); }
}

export async function onRequestDelete({ request, env, params }) {
  try {
    requirePasscode(request, env);
    await env.DB.batch([
      env.DB.prepare("DELETE FROM versions WHERE system_id = ?").bind(params.id),
      env.DB.prepare("DELETE FROM systems WHERE id = ?").bind(params.id),
    ]);
    return new Response(null, { status: 204 });
  } catch (e) { return fail(e); }
}
