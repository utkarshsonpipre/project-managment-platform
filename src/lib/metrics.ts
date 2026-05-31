import client from "prom-client";

const globalForMetrics = globalThis as unknown as {
  metricsRegistry?: client.Registry;
  apiRequests?: client.Counter<"status">;
};

/** Shared Prometheus registry (singleton across hot reloads). */
export function getRegistry(): client.Registry {
  if (!globalForMetrics.metricsRegistry) {
    const registry = new client.Registry();
    registry.setDefaultLabels({ app: "pmp-web" });
    client.collectDefaultMetrics({ register: registry });
    globalForMetrics.metricsRegistry = registry;
  }
  return globalForMetrics.metricsRegistry;
}

/** Counter of handled API requests, labelled by response status. */
export function apiRequestsCounter(): client.Counter<"status"> {
  if (!globalForMetrics.apiRequests) {
    globalForMetrics.apiRequests = new client.Counter({
      name: "pmp_api_requests_total",
      help: "Total API requests handled, by response status",
      labelNames: ["status"],
      registers: [getRegistry()],
    });
  }
  return globalForMetrics.apiRequests;
}
