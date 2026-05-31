import { io } from "socket.io-client";

const APP = "http://localhost:3001";
const RT = "http://localhost:4001";
const email = `rt_${Math.random().toString(16).slice(2, 8)}@test.com`;

const json = { "content-type": "application/json" };

async function main() {
  const reg = await fetch(`${APP}/api/auth/register`, {
    method: "POST",
    headers: json,
    body: JSON.stringify({ name: "RT User", email, password: "password123" }),
  });
  const cookie = reg.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");

  const me = await (
    await fetch(`${APP}/api/auth/me`, { headers: { cookie } })
  ).json();
  const orgId = me.user.memberships[0].org.id;

  const proj = await (
    await fetch(`${APP}/api/orgs/${orgId}/projects`, {
      method: "POST",
      headers: { ...json, cookie },
      body: JSON.stringify({ name: "RT Project", key: "RTP" }),
    })
  ).json();
  const projectId = proj.project.id;

  const socket = io(RT, { transports: ["websocket"], extraHeaders: { Cookie: cookie } });

  const result = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout: no project:updated")), 8000);
    socket.on("connect", () => {
      console.log("socket connected:", socket.id);
      socket.emit("join:project", projectId);
      setTimeout(() => {
        fetch(`${APP}/api/projects/${projectId}/tasks`, {
          method: "POST",
          headers: { ...json, cookie },
          body: JSON.stringify({ title: "realtime task" }),
        }).then(() => console.log("task created (should trigger broadcast)"));
      }, 400);
    });
    socket.on("connect_error", (e) => {
      clearTimeout(timer);
      reject(new Error("connect_error: " + e.message));
    });
    socket.on("project:updated", () => {
      clearTimeout(timer);
      resolve("project:updated RECEIVED");
    });
  });

  console.log("RESULT:", result);
  socket.close();
  process.exit(0);
}

main().catch((e) => {
  console.error("FAIL:", e.message);
  process.exit(1);
});
