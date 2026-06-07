// Verifies the PRODUCTION-style realtime flow: get a handshake token from
// /api/realtime-info, then connect the socket with auth.token (no cookie).
import { io } from "socket.io-client";

const APP = process.env.APP_URL ?? "http://localhost:3001";
const RT = process.env.RT_URL ?? "http://localhost:4001";
const email = `rttok_${Math.random().toString(16).slice(2, 8)}@test.com`;
const json = { "content-type": "application/json" };

async function main() {
  const reg = await fetch(`${APP}/api/auth/register`, {
    method: "POST",
    headers: json,
    body: JSON.stringify({ name: "RT", email, password: "password123" }),
  });
  const cookie = reg.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");

  const me = await (await fetch(`${APP}/api/auth/me`, { headers: { cookie } })).json();
  const orgId = me.user.memberships[0].org.id;
  const proj = await (
    await fetch(`${APP}/api/orgs/${orgId}/projects`, {
      method: "POST",
      headers: { ...json, cookie },
      body: JSON.stringify({ name: "RT", key: "RTT" }),
    })
  ).json();
  const projectId = proj.project.id;

  // The key step: fetch realtime info (url + token) like the browser does.
  const info = await (
    await fetch(`${APP}/api/realtime-info`, { headers: { cookie } })
  ).json();
  console.log("realtime-info →", { url: info.url, hasToken: !!info.token });
  if (!info.token) throw new Error("no token returned");

  // Connect with the token ONLY (no cookie) — exactly how it works cross-origin.
  const socket = io(RT, { transports: ["websocket"], auth: { token: info.token } });

  const result = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), 8000);
    socket.on("connect", () => {
      socket.emit("join:project", projectId);
      setTimeout(() => {
        fetch(`${APP}/api/projects/${projectId}/tasks`, {
          method: "POST",
          headers: { ...json, cookie },
          body: JSON.stringify({ title: "token-flow task" }),
        });
      }, 400);
    });
    socket.on("connect_error", (e) => { clearTimeout(timer); reject(new Error("connect_error: " + e.message)); });
    socket.on("project:updated", () => { clearTimeout(timer); resolve("project:updated RECEIVED via token auth"); });
  });

  console.log("RESULT:", result);
  socket.close();
  process.exit(0);
}
main().catch((e) => { console.error("FAIL:", e.message); process.exit(1); });
