// Event Invitation Writer - describe your event, and an AI on YOUR machine (QVAC) writes a headline and a message.
// The date, time and place are shown exactly as you typed them, never rewritten by the AI. Open http://localhost:3073 after starting.

import http from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

// The QVAC worker can be slow to start on some computers. Wait up to 3 minutes for it.
process.env.QVAC_RPC_INIT_TIMEOUT_MS ??= "180000";
const { loadModel, completion, LLAMA_3_2_1B_INST_Q4_0 } = await import("@qvac/sdk");

const PORT = 3073;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---- Step 1: load the AI model (downloads the first time, then it's cached) ----
let modelId = null;
const status = { ready: false, message: "Starting...", percent: null, error: null };
async function startModel() {
  try {
    status.message = "Loading the AI model (first run downloads it)...";
    modelId = await loadModel({
      modelSrc: LLAMA_3_2_1B_INST_Q4_0,
      modelType: "llm",
      onProgress: (p) => { const v = typeof p === "number" ? p : p?.percentage; if (typeof v === "number") status.percent = Math.round(v); },
    });
    status.ready = true; status.message = "AI invitation writer ready";
    console.log("Model loaded. Open http://localhost:" + PORT);
  } catch (err) { status.error = String(err?.message || err); console.error("Could not load model:", err); }
}

// One AI job at a time
let chain = Promise.resolve();
const enqueue = (job) => { const p = chain.then(job); chain = p.catch(() => {}); return p; };

function readBody(req, limit = 10000) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (c) => { data += c; if (data.length > limit) { reject(new Error("Too big")); req.destroy(); } });
    req.on("end", () => resolve(data)); req.on("error", reject);
  });
}
const json = (res, code, obj) => { res.writeHead(code, { "Content-Type": "application/json" }); res.end(JSON.stringify(obj)); };
const clean = (v, n) => String(v || "").replace(/\s+/g, " ").trim().slice(0, n);

// QVAC "structured output": just the words. Details like date, time and place stay exactly as typed on the page.
const SCHEMA = { type: "object", properties: { headline: { type: "string" }, message: { type: "string" } }, required: ["headline", "message"], additionalProperties: false };
const VIBES = { fun: "fun, playful and excited", elegant: "elegant and graceful", cozy: "warm, cozy and casual", formal: "polite and formal" };
const prompt = (vibe) => `You write invitation wording. Reply with JSON only. Style: ${VIBES[vibe]}.
headline: a short, catchy headline (maximum 8 words).
message: 2 or 3 short sentences inviting guests and saying what to expect.
Do NOT include the date, time, address or RSVP details: they are shown separately. Do not invent details like food, dress code or activities unless given.`;

// ---- Step 2: the web server ----
const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "GET" && req.url === "/") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      return res.end(await readFile(path.join(__dirname, "public", "index.html")));
    }
    if (req.method === "GET" && req.url === "/api/status") return json(res, 200, status);
    if (req.method === "POST" && req.url === "/api/invite") {
      if (!status.ready) return json(res, 503, { error: "The AI invitation writer is not ready yet." });
      const b = JSON.parse(await readBody(req)), kind = clean(b.kind, 40) || "party", title = clean(b.title, 80), host = clean(b.host, 80), notes = clean(b.notes, 300), vibe = VIBES[b.vibe] ? b.vibe : "fun";
      const ask = `Event: ${kind}${title ? " - " + title : ""}.` + (host ? `\nHosted by: ${host}.` : "") + (notes ? `\nExtra details from the host: ${notes}.` : "");
      const r = await enqueue(async () => {
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            // This is the QVAC call that runs the AI on-device
            const run = completion({ modelId, stream: true, history: [{ role: "system", content: prompt(vibe) }, { role: "user", content: ask }], responseFormat: { type: "json_schema", json_schema: { name: "Invite", schema: SCHEMA } } });
            let out = "";
            for await (const event of run.events) if (event.type === "contentDelta") out += event.text;
            const j = JSON.parse(out), headline = clean(j.headline, 80).replace(/^["\u201c]|["\u201d]$/g, ""), message = String(j.message || "").trim().slice(0, 600);
            if (headline && message) return { headline, message };
          } catch (err) { console.error("Invite attempt failed:", err.message); }
        }
        return null;
      });
      return r ? json(res, 200, r) : json(res, 502, { error: "The AI couldn't write the invitation. Try again." });
    }
    res.writeHead(404); res.end("Not found");
  } catch (err) { console.error(err); json(res, 500, { error: String(err?.message || err) }); }
});

// "127.0.0.1" means only YOUR computer can reach this app
server.listen(PORT, "127.0.0.1", () => console.log("Server running at http://localhost:" + PORT));
startModel();
