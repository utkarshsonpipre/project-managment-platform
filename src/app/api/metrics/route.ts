import { getRegistry } from "@/lib/metrics";

// GET /api/metrics — Prometheus scrape endpoint.
// In production this should be restricted to the monitoring network (e.g. via Nginx).
export async function GET() {
  const registry = getRegistry();
  return new Response(await registry.metrics(), {
    headers: { "Content-Type": registry.contentType },
  });
}
