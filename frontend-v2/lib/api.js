"use client";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "/api/backend";
const DIRECT_BACKEND_FALLBACK =
  typeof window !== "undefined" ? `${window.location.protocol}//localhost:4000` : "http://localhost:4000";
const responseCache = new Map();
const binaryResponseCache = new Map();
const inflightRequests = new Map();
const inflightBinaryRequests = new Map();
const CACHE_TTL_MS = 300_000;
const CACHE_STALE_MS = 3_600_000;
const DOWNLOAD_CACHE_TTL_MS = 600_000;
const PERSISTENT_CACHE_PREFIX = "unikart-next-api::";
const PERSISTENT_CACHE_MAX_BYTES = 1_000_000;

function buildCacheKey(path, auth) {
  return JSON.stringify({
    path,
    auth: auth?.profile?.id || auth?.user?.id || auth?.devEmail || auth?.overrideSecret || "guest",
  });
}

export const swrFetcher = (url) => fetch(url).then(r => r.json());

function createApiError(payload, fallbackMessage) {
  const error = new Error(payload?.error?.message || fallbackMessage || "Request failed");
  error.code = payload?.error?.code || "REQUEST_FAILED";
  error.details = payload?.error?.details;
  return error;
}

function buildRequestHeaders(auth, headers = {}) {
  const nextHeaders = {
    "Content-Type": "application/json",
    ...headers,
  };

  if (auth?.overrideSecret) nextHeaders["x-admin-override"] = auth.overrideSecret;
  if (auth?.devEmail) nextHeaders["x-dev-auth-email"] = auth.devEmail;
  if (auth?.devRole) nextHeaders["x-dev-auth-role"] = auth.devRole;
  if (auth?.devFullName) nextHeaders["x-dev-auth-name"] = auth.devFullName;
  if (auth?.accessToken) nextHeaders.authorization = `Bearer ${auth.accessToken}`;

  return nextHeaders;
}

function buildApiUrls(path) {
  return [`${API_BASE}${path}`, `${DIRECT_BACKEND_FALLBACK}${path}`];
}

function getSessionStore() {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function getPersistentCacheKey(cacheKey) {
  return `${PERSISTENT_CACHE_PREFIX}${cacheKey}`;
}

function readPersistentCache(cacheKey) {
  const store = getSessionStore();
  if (!store) return null;
  try {
    const raw = store.getItem(getPersistentCacheKey(cacheKey));
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writePersistentCache(cacheKey, entry) {
  const store = getSessionStore();
  if (!store) return;
  try {
    const serialized = JSON.stringify(entry);
    if (serialized.length > PERSISTENT_CACHE_MAX_BYTES) return;
    store.setItem(getPersistentCacheKey(cacheKey), serialized);
  } catch {
    // Ignore storage failures and keep runtime caching only.
  }
}

function clearPersistentCache() {
  const store = getSessionStore();
  if (!store) return;
  try {
    const keysToDelete = [];
    for (let index = 0; index < store.length; index += 1) {
      const key = store.key(index);
      if (key?.startsWith(PERSISTENT_CACHE_PREFIX)) keysToDelete.push(key);
    }
    keysToDelete.forEach((key) => store.removeItem(key));
  } catch {
    // Ignore storage clear failures.
  }
}

function matchesInvalidationPath(path, invalidationPaths = []) {
  return invalidationPaths.some((candidate) => typeof candidate === "string" && candidate && path.startsWith(candidate));
}

function invalidateApiCacheEntries(invalidationPaths = []) {
  if (!Array.isArray(invalidationPaths) || !invalidationPaths.length) return;

  for (const cacheKey of [...responseCache.keys()]) {
    try {
      const parsed = JSON.parse(cacheKey);
      if (matchesInvalidationPath(parsed?.path || "", invalidationPaths)) {
        responseCache.delete(cacheKey);
      }
    } catch {
      // Ignore malformed keys.
    }
  }

  const store = getSessionStore();
  if (!store) return;
  try {
    const keysToDelete = [];
    for (let index = 0; index < store.length; index += 1) {
      const storageKey = store.key(index);
      if (!storageKey?.startsWith(PERSISTENT_CACHE_PREFIX)) continue;
      const raw = store.getItem(storageKey);
      if (!raw) continue;
      const cacheKey = storageKey.slice(PERSISTENT_CACHE_PREFIX.length);
      try {
        const parsed = JSON.parse(cacheKey);
        if (matchesInvalidationPath(parsed?.path || "", invalidationPaths)) {
          keysToDelete.push(storageKey);
        }
      } catch {
        // Ignore malformed cache entries.
      }
    }
    keysToDelete.forEach((key) => store.removeItem(key));
  } catch {
    // Ignore storage invalidation failures.
  }
}

async function fetchWithFallback(path, requestInit, options = {}) {
  const urls = buildApiUrls(path);
  let lastNetworkError;

  for (let index = 0; index < urls.length; index += 1) {
    try {
      const response = await fetch(urls[index], requestInit);
      if (
        response.ok ||
        index === urls.length - 1 ||
        options.retryOnHttpError !== true ||
        response.status === 401 ||
        response.status === 403
      ) {
        return response;
      }
    } catch (error) {
      lastNetworkError = error;
      if (index === urls.length - 1) {
        throw error;
      }
    }
  }

  if (lastNetworkError) throw lastNetworkError;
  throw new Error("Request failed");
}

function extractFilename(contentDisposition, fallbackFileName) {
  const utf8Match = /filename\*=UTF-8''([^;]+)/i.exec(contentDisposition || "");
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1]);
    } catch {
      return utf8Match[1];
    }
  }

  const asciiMatch = /filename="?([^"]+)"?/i.exec(contentDisposition || "");
  return asciiMatch?.[1] || fallbackFileName;
}

export async function apiFetch(path, auth, options = {}) {
  const method = options.method || "GET";
  const headers = buildRequestHeaders(auth, options.headers || {});
  const ttlMs = options.cacheMs ?? CACHE_TTL_MS;
  const staleMs = options.staleMs ?? Math.max(CACHE_STALE_MS, ttlMs);

  const requestInit = {
    method,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
    cache: "no-store",
  };

  const cacheKey = method === "GET" ? buildCacheKey(path, auth) : null;

  if (cacheKey && !options.bypassCache) {
    const cached = responseCache.get(cacheKey);
    if (cached) {
      const age = Date.now() - cached.timestamp;
      if (age < ttlMs) {
        return cached.payload;
      }
      if (age < staleMs) {
        apiFetch(path, auth, { ...options, bypassCache: true }).catch(() => null);
        return cached.payload;
      }
    }
    const inflight = inflightRequests.get(cacheKey);
    if (inflight) {
      return inflight;
    }

    const persisted = readPersistentCache(cacheKey);
    if (persisted) {
      const age = Date.now() - persisted.timestamp;
      if (age < staleMs) {
        responseCache.set(cacheKey, persisted);
        if (age >= ttlMs) {
          apiFetch(path, auth, { ...options, bypassCache: true }).catch(() => null);
        }
        return persisted.payload;
      }
    }
  }

  const requestPromise = (async () => {
    let response;
    try {
      response = await fetchWithFallback(path, requestInit, { retryOnHttpError: true });
    } catch {
      throw new Error(
        "UniKart could not reach the backend service. Make sure the local backend is running before retrying.",
      );
    }

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw createApiError(payload, "Request failed");
    }

    if (cacheKey) {
      const entry = {
        payload,
        timestamp: Date.now(),
      };
      responseCache.set(cacheKey, entry);
      writePersistentCache(cacheKey, entry);
    } else if (method !== "GET") {
      invalidateApiCacheEntries(options.invalidatePaths || []);
    }

    return payload;
  })();

  if (cacheKey) {
    inflightRequests.set(cacheKey, requestPromise);
  }

  try {
    return await requestPromise;
  } finally {
    if (cacheKey) {
      inflightRequests.delete(cacheKey);
    }
  }
}

export async function apiFetchBinary(path, auth, options = {}) {
  const method = options.method || "GET";
  const rawHeaders = buildRequestHeaders(auth, options.headers || {});
  if (!options.body) {
    delete rawHeaders["Content-Type"];
  }

  const requestInit = {
    method,
    headers: rawHeaders,
    body: options.body ? JSON.stringify(options.body) : undefined,
    cache: "no-store",
  };
  const cacheTtlMs = options.cacheMs ?? DOWNLOAD_CACHE_TTL_MS;
  const binaryCacheKey = method === "GET" ? buildCacheKey(`binary:${path}`, auth) : null;

  if (binaryCacheKey && !options.bypassCache) {
    const cached = binaryResponseCache.get(binaryCacheKey);
    if (cached && Date.now() - cached.timestamp < cacheTtlMs) {
      return cached.payload;
    }

    const inflight = inflightBinaryRequests.get(binaryCacheKey);
    if (inflight) {
      return inflight;
    }
  }

  const requestPromise = (async () => {
    let response;
    try {
      response = await fetchWithFallback(path, requestInit, { retryOnHttpError: true });
    } catch {
      throw new Error(
        "UniKart could not reach the backend service. Make sure the local backend is running before retrying.",
      );
    }

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw createApiError(payload, "Download failed");
    }

    const payload = {
      blob: await response.blob(),
      fileName: response.headers.get("content-disposition") || "",
      contentType: response.headers.get("content-type") || "application/octet-stream",
    };

    if (binaryCacheKey) {
      binaryResponseCache.set(binaryCacheKey, {
        payload,
        timestamp: Date.now(),
      });
    }

    return payload;
  })();

  if (binaryCacheKey) {
    inflightBinaryRequests.set(binaryCacheKey, requestPromise);
  }

  try {
    return await requestPromise;
  } finally {
    if (binaryCacheKey) {
      inflightBinaryRequests.delete(binaryCacheKey);
    }
  }
}

export async function downloadApiFile(path, auth, fallbackFileName = "download.bin") {
  const { blob, fileName } = await apiFetchBinary(path, auth);
  const resolvedName = extractFilename(fileName, fallbackFileName);
  const objectUrl = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = resolvedName;
  anchor.rel = "noopener";
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => window.URL.revokeObjectURL(objectUrl), 4000);
  return resolvedName;
}

export function peekApiCache(path, auth, options = {}) {
  const cacheKey = buildCacheKey(path, auth);
  const cached = responseCache.get(cacheKey) || readPersistentCache(cacheKey);
  const maxAgeMs = options.maxAgeMs ?? options.staleMs ?? options.cacheMs ?? CACHE_STALE_MS;
  if (!cached || Date.now() - cached.timestamp >= maxAgeMs) {
    responseCache.delete(cacheKey);
    return null;
  }
  responseCache.set(cacheKey, cached);
  return cached.payload;
}

export function clearApiCache() {
  responseCache.clear();
  binaryResponseCache.clear();
  inflightRequests.clear();
  inflightBinaryRequests.clear();
  clearPersistentCache();
}

export function prefetchApi(path, auth, options = {}) {
  return apiFetch(path, auth, { ...options, method: options.method || "GET" }).catch(() => null);
}

export async function loadCompareListings(listingIds, auth, options = {}) {
  const ids = (listingIds || []).filter(Boolean).slice(0, 3);
  if (!ids.length) return [];

  try {
    const response = await apiFetch(`/listings/compare?ids=${ids.join(",")}`, auth, options);
    const listings = response.data || [];
    if (listings.length) {
      return ids
        .map((id) => listings.find((item) => item.id === id))
        .filter(Boolean);
    }
  } catch {
    // Fall back to individual listing reads when the dedicated compare route
    // is unavailable or an older backend process is still running.
  }

  const items = await Promise.all(
    ids.map((id) =>
      apiFetch(`/listings/${id}`, auth, options)
        .then((response) => response.data || null)
        .catch(() => null),
    ),
  );

  return items.filter(Boolean);
}

export function formatCurrency(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value || 0);
}
