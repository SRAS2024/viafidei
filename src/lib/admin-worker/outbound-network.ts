/**
 * Outbound network setup — lets the Admin Worker reach the open internet in a
 * RESTRICTED / PROXIED deployment.
 *
 * Node's built-in `fetch` (undici) does NOT honour the standard proxy env vars
 * (`HTTPS_PROXY` / `HTTP_PROXY` / `ALL_PROXY` / `NO_PROXY`) on its own. In a
 * locked-down environment where outbound egress is only permitted THROUGH a
 * proxy — common on managed PaaS, corporate networks, and firewalled hosts —
 * every `fetch()` the worker makes silently fails (connection refused / timeout),
 * even though egress IS available via the proxy. That is a leading cause of
 * "structured source unreachable" (Wikidata/Wikipedia) and low web-fetch yield.
 *
 * `installOutboundProxy()` fixes that: when a proxy env var is present it installs
 * a proxy-aware global dispatcher, so ALL outbound `fetch()` in this process —
 * the web fetcher, the Wikidata/Wikipedia structured ingest, everything — routes
 * through the proxy. It is idempotent, fail-open (never throws), and a complete
 * no-op when no proxy env var is set (direct egress is used, unchanged). This is
 * how the operator grants "go outbound to anywhere": set `HTTPS_PROXY` (and, if
 * the proxy uses a private CA, `NODE_EXTRA_CA_CERTS`) in the deployment.
 */

const PROXY_ENV_KEYS = [
  "HTTPS_PROXY",
  "https_proxy",
  "HTTP_PROXY",
  "http_proxy",
  "ALL_PROXY",
  "all_proxy",
] as const;

export interface OutboundProxyState {
  installed: boolean;
  proxyUrl: string | null;
  mode: "env-http-proxy-agent" | "proxy-agent" | "none";
  reason: string;
}

let cached: OutboundProxyState | null = null;

/** The first proxy URL found among the standard env vars (redacted-safe host). */
export function resolveProxyUrl(): string | null {
  for (const k of PROXY_ENV_KEYS) {
    const v = (process.env[k] ?? "").trim();
    if (v) return v;
  }
  return null;
}

/** Redact any credentials in a proxy URL before it is logged/surfaced. */
export function redactProxyUrl(url: string | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.username || u.password) {
      u.username = "***";
      u.password = "***";
    }
    return u.toString();
  } catch {
    return url.replace(/\/\/[^@/]+@/, "//***@");
  }
}

/**
 * Install a proxy-aware global dispatcher for `fetch` when a proxy env var is
 * set. Idempotent (subsequent calls return the cached state) and fail-open.
 */
export async function installOutboundProxy(): Promise<OutboundProxyState> {
  if (cached) return cached;
  const proxyUrl = resolveProxyUrl();
  if (!proxyUrl) {
    cached = {
      installed: false,
      proxyUrl: null,
      mode: "none",
      reason: "No proxy env var set — using direct outbound egress.",
    };
    return cached;
  }
  try {
    // Dynamic import so a missing/older undici degrades to a no-op instead of a
    // hard crash. undici's global dispatcher is the same one Node's built-in
    // `fetch` reads, so setting it here proxies all `fetch()` in this process.
    const undici = (await import("undici")) as {
      setGlobalDispatcher: (d: unknown) => void;
      EnvHttpProxyAgent?: new () => unknown;
      ProxyAgent?: new (uri: string) => unknown;
    };
    // Prefer EnvHttpProxyAgent — it honours HTTP_PROXY/HTTPS_PROXY/NO_PROXY the
    // way the rest of the ecosystem expects. Fall back to a plain ProxyAgent
    // built from the resolved URL if that class isn't available.
    if (typeof undici.EnvHttpProxyAgent === "function") {
      undici.setGlobalDispatcher(new undici.EnvHttpProxyAgent());
      cached = {
        installed: true,
        proxyUrl: redactProxyUrl(proxyUrl),
        mode: "env-http-proxy-agent",
        reason: "Outbound fetch routed through the environment proxy (NO_PROXY honoured).",
      };
    } else if (typeof undici.ProxyAgent === "function") {
      undici.setGlobalDispatcher(new undici.ProxyAgent(proxyUrl));
      cached = {
        installed: true,
        proxyUrl: redactProxyUrl(proxyUrl),
        mode: "proxy-agent",
        reason: "Outbound fetch routed through the environment proxy.",
      };
    } else {
      cached = {
        installed: false,
        proxyUrl: redactProxyUrl(proxyUrl),
        mode: "none",
        reason: "undici present but exposes no proxy agent — outbound fetch NOT proxied.",
      };
    }
  } catch (err) {
    cached = {
      installed: false,
      proxyUrl: redactProxyUrl(proxyUrl),
      mode: "none",
      reason: `Proxy install failed (${err instanceof Error ? err.message : String(err)}) — direct egress.`,
    };
  }
  return cached;
}

export interface HostReachability {
  host: string;
  reachable: boolean;
  status: number | null;
  detail: string;
  /** Critical hosts must be reachable for growth; best-effort hosts have a
   * working fallback, so their being blocked is tolerated (informational). */
  critical: boolean;
}

/**
 * The keyless data sources the worker depends on for bulk growth. If these are
 * unreachable, structured ingest (saints/popes/etc.) and web extraction can't
 * grow — which is exactly what the operator needs to see to fix egress.
 *
 * `query.wikidata.org` is best-effort, NOT critical: many managed hosts'
 * datacenter IPs are rate-limited/blocked by Wikidata's WDQS specifically, and
 * the worker already falls back to alternate SPARQL endpoints (structured/
 * wikidata.ts) and to en.wikipedia.org for the same structured facts. So a
 * blocked WDQS with reachable Wikipedia + Vatican is a HEALTHY, handled state,
 * not an egress failure.
 */
const KEY_OUTBOUND_HOSTS: ReadonlyArray<{ host: string; url: string; critical: boolean }> = [
  {
    host: "query.wikidata.org",
    url: "https://query.wikidata.org/bigdata/namespace/wdq/sparql",
    critical: false,
  },
  {
    host: "en.wikipedia.org",
    url: "https://en.wikipedia.org/api/rest_v1/page/summary/Catholic_Church",
    critical: true,
  },
  { host: "www.vatican.va", url: "https://www.vatican.va/content/vatican/en.html", critical: true },
  // Best-effort: the OpenStreetMap Overpass API is the bulk PARISH source
  // (parish-osm.ts). If it's egress-blocked, parishes can't grow at scale — but
  // it's not critical for the rest of the catalog and parishes have a curated
  // fallback, so surface it without failing the overall reachability rating.
  {
    host: "overpass-api.de",
    url: "https://overpass-api.de/api/status",
    critical: false,
  },
];

/**
 * Probe outbound reachability to the key data hosts (after ensuring the proxy is
 * installed). Short per-host timeout; fail-open. Used by the diagnostics rating
 * so the operator can SEE exactly which egress works vs is blocked by the
 * deployment's network policy.
 */
export async function probeOutboundReachability(
  timeoutMs = 8000,
): Promise<{ proxy: OutboundProxyState; hosts: HostReachability[] }> {
  const proxy = await installOutboundProxy();
  if ((process.env.ADMIN_WORKER_SKIP_NETWORK ?? "") === "1") {
    return {
      proxy,
      hosts: KEY_OUTBOUND_HOSTS.map((h) => ({
        host: h.host,
        reachable: false,
        status: null,
        detail: "skipped (ADMIN_WORKER_SKIP_NETWORK=1)",
        critical: h.critical,
      })),
    };
  }
  const hosts = await Promise.all(
    KEY_OUTBOUND_HOSTS.map(async ({ host, url, critical }): Promise<HostReachability> => {
      try {
        const res = await fetch(url, {
          method: "GET",
          headers: { "User-Agent": "ViaFideiAdminWorker/1.0 (+reachability-probe)" },
          signal: AbortSignal.timeout(timeoutMs),
        });
        // Any HTTP response (even 4xx) means egress reached the host — the
        // network path is open. Only a thrown error is a true reachability fail.
        return {
          host,
          reachable: true,
          status: res.status,
          detail: `HTTP ${res.status}`,
          critical,
        };
      } catch (err) {
        const code =
          (err as { cause?: { code?: string } })?.cause?.code ??
          (err instanceof Error ? err.name : "error");
        return { host, reachable: false, status: null, detail: `blocked: ${code}`, critical };
      }
    }),
  );
  return { proxy, hosts };
}
