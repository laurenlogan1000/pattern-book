// Public settings the page needs before it can offer a run.
import { json } from "../../lib/http.js";

export const onRequestGet = ({ env }) =>
  json({ passcodeRequired: Boolean(env.APP_PASSCODE), model: env.MODEL || "claude-opus-5-5", maxPhotos: 6 });
