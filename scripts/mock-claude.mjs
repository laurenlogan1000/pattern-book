// Stand-in for the Anthropic Messages API, for local testing without a key.
// Streams a thinking block, then fixtures/sample-spec.json as text, in the real SSE event format.
// Use: node scripts/mock-claude.mjs, and set ANTHROPIC_BASE_URL=http://127.0.0.1:9999 and ANTHROPIC_API_KEY=test-key in .dev.vars.
import http from "node:http";
import fs from "node:fs";
const spec = fs.readFileSync(new URL("../fixtures/sample-spec.json", import.meta.url), "utf8");
http.createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", async () => {
    const j = JSON.parse(body);
    if (req.headers["x-api-key"] !== "test-key") {
      res.writeHead(401, { "content-type": "application/json" });
      return res.end(JSON.stringify({ type: "error", error: { message: "bad key" } }));
    }
    res.writeHead(200, { "content-type": "text/event-stream" });
    const send = (e, d) => res.write(`event: ${e}\ndata: ${JSON.stringify(d)}\n\n`);
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    send("message_start", { type: "message_start", message: { id: "mock", model: j.model } });
    send("content_block_start", { type: "content_block_start", index: 0, content_block: { type: "thinking", thinking: "" } });
    send("content_block_delta", { type: "content_block_delta", index: 0, delta: { type: "thinking_delta", thinking: "…" } });
    send("content_block_stop", { type: "content_block_stop", index: 0 });
    await wait(800);
    const revise = j.messages[0].content.at(-1).text.startsWith("Here is");
    const out = "```json\n" + (revise ? spec.replace('"name":"Cartouche"', '"name":"Cartouche Revised"') : spec) + "\n```";
    send("content_block_start", { type: "content_block_start", index: 1, content_block: { type: "text", text: "" } });
    for (let i = 0; i < out.length; i += 400) {
      send("content_block_delta", { type: "content_block_delta", index: 1, delta: { type: "text_delta", text: out.slice(i, i + 400) } });
      await wait(40);
    }
    send("content_block_stop", { type: "content_block_stop", index: 1 });
    send("message_delta", { type: "message_delta", delta: { stop_reason: "end_turn" } });
    send("message_stop", { type: "message_stop" });
    res.end();
  });
}).listen(9999, () => console.log("Mock Claude API on http://127.0.0.1:9999"));
