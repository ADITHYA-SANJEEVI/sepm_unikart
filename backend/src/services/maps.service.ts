import { env } from "../config/env";

type CampusCoordinate = {
  latitude: number;
  longitude: number;
};

type CampusSpot = CampusCoordinate & {
  id: string;
  label: string;
  shortLabel: string;
  addressHint: string;
};

type CampusSearchResult = {
  id: string;
  label: string;
  shortLabel?: string | null;
  addressHint?: string | null;
  latitude: number;
  longitude: number;
  campusId: "srm-ktr";
  zoneId?: string | null;
  zoneLabel?: string | null;
  placeType: "campus_zone" | "custom_pin";
  source: "alias" | "campus_spot" | "tomtom" | "reverse_geocode";
  x: number;
  y: number;
  distanceMeters?: number | null;
};

type RouteRequestPoint = {
  label?: string | null;
  latitude: number;
  longitude: number;
};

const CAMPUS_ID = "srm-ktr" as const;
const CAMPUS_CENTER = { latitude: 12.8231, longitude: 80.0444 };
const CAMPUS_BOUNDS = {
  minLatitude: 12.8204,
  maxLatitude: 12.8262,
  minLongitude: 80.0418,
  maxLongitude: 80.0474,
};
const CAMPUS_SEARCH_RADIUS_METERS = 1500;
const SEARCH_CACHE_TTL_MS = 5 * 60 * 1000;
const REVERSE_CACHE_TTL_MS = 10 * 60 * 1000;
const ROUTE_CACHE_TTL_MS = 10 * 60 * 1000;
const TILE_CACHE_TTL_MS = 30 * 60 * 1000;
const TOMTOM_TIMEOUT_MS = 5000;

const CAMPUS_SPOTS: CampusSpot[] = [
  {
    id: "library-plaza",
    label: "University Library Plaza",
    shortLabel: "Library",
    addressHint: "Main library front plaza",
    latitude: 12.8239,
    longitude: 80.044,
  },
  {
    id: "tech-park-gate",
    label: "Tech Park Gate",
    shortLabel: "Tech Park",
    addressHint: "Near the tech park side entrance",
    latitude: 12.8246,
    longitude: 80.0457,
  },
  {
    id: "hostel-square",
    label: "Hostel Square",
    shortLabel: "Hostel Sq",
    addressHint: "Central hostel common area",
    latitude: 12.8219,
    longitude: 80.0435,
  },
  {
    id: "food-court",
    label: "Food Court Steps",
    shortLabel: "Food Court",
    addressHint: "Open seating beside the food court",
    latitude: 12.8225,
    longitude: 80.0451,
  },
  {
    id: "admin-lawn",
    label: "Admin Block Lawn",
    shortLabel: "Admin Lawn",
    addressHint: "Open lawn near the admin block",
    latitude: 12.8244,
    longitude: 80.0448,
  },
];

const CAMPUS_SPOT_ALIASES: Record<string, string> = {
  tp: "tech-park-gate",
  "tech park": "tech-park-gate",
  "tp gate": "tech-park-gate",
  lib: "library-plaza",
  library: "library-plaza",
  "library plaza": "library-plaza",
  hs: "hostel-square",
  hostel: "hostel-square",
  "hostel square": "hostel-square",
  fc: "food-court",
  food: "food-court",
  "food court": "food-court",
  admin: "admin-lawn",
  "admin block": "admin-lawn",
  "admin lawn": "admin-lawn",
};

const searchCache = new Map<string, { expiresAt: number; data: CampusSearchResult[] }>();
const reverseCache = new Map<string, { expiresAt: number; data: CampusSearchResult | null }>();
const routeCache = new Map<string, { expiresAt: number; data: any }>();
const tileCache = new Map<string, { expiresAt: number; data: { contentType: string; buffer: Buffer } }>();

function readCache<T>(cache: Map<string, { expiresAt: number; data: T }>, key: string) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function writeCache<T>(cache: Map<string, { expiresAt: number; data: T }>, key: string, data: T, ttlMs: number) {
  cache.set(key, {
    data,
    expiresAt: Date.now() + ttlMs,
  });
}

function normalizeCampusText(value: string) {
  return String(value || "")
    .replace(/\btp gate\b/gi, "Tech Park Gate")
    .replace(/\btp\b/gi, "Tech Park")
    .replace(/\blib\b/gi, "Library")
    .replace(/\bfc\b/gi, "Food Court")
    .replace(/\badmin\b/gi, "Admin Block")
    .replace(/\bhs\b/gi, "Hostel Square")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function haversineMeters(left: CampusCoordinate, right: CampusCoordinate) {
  const toRad = (degrees: number) => (degrees * Math.PI) / 180;
  const latitudeDelta = toRad(right.latitude - left.latitude);
  const longitudeDelta = toRad(right.longitude - left.longitude);
  const latitudeA = toRad(left.latitude);
  const latitudeB = toRad(right.latitude);
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(latitudeA) * Math.cos(latitudeB) * Math.sin(longitudeDelta / 2) ** 2;
  return 6371000 * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}

function isWithinCampus(point: CampusCoordinate) {
  const withinBounds =
    point.latitude >= CAMPUS_BOUNDS.minLatitude &&
    point.latitude <= CAMPUS_BOUNDS.maxLatitude &&
    point.longitude >= CAMPUS_BOUNDS.minLongitude &&
    point.longitude <= CAMPUS_BOUNDS.maxLongitude;
  if (withinBounds) return true;
  return haversineMeters(point, CAMPUS_CENTER) <= CAMPUS_SEARCH_RADIUS_METERS;
}

function toBoardPoint(point: CampusCoordinate) {
  const xRatio =
    (point.longitude - CAMPUS_BOUNDS.minLongitude) /
    (CAMPUS_BOUNDS.maxLongitude - CAMPUS_BOUNDS.minLongitude);
  const yRatio =
    (CAMPUS_BOUNDS.maxLatitude - point.latitude) /
    (CAMPUS_BOUNDS.maxLatitude - CAMPUS_BOUNDS.minLatitude);
  return {
    x: Number(clamp(xRatio * 100, 6, 94).toFixed(2)),
    y: Number(clamp(yRatio * 100, 8, 92).toFixed(2)),
  };
}

function buildCampusResult(
  spot: CampusSpot,
  source: CampusSearchResult["source"] = "campus_spot",
  queryAnchor?: CampusCoordinate,
): CampusSearchResult {
  return {
    id: spot.id,
    label: spot.label,
    shortLabel: spot.shortLabel,
    addressHint: spot.addressHint,
    latitude: spot.latitude,
    longitude: spot.longitude,
    campusId: CAMPUS_ID,
    zoneId: spot.id,
    zoneLabel: spot.shortLabel,
    placeType: "campus_zone",
    source,
    ...toBoardPoint(spot),
    distanceMeters: queryAnchor ? Math.round(haversineMeters(queryAnchor, spot)) : null,
  };
}

function dedupeResults(results: CampusSearchResult[]) {
  const seen = new Set<string>();
  return results.filter((item) => {
    const key = [
      item.zoneId || "",
      item.label.toLowerCase(),
      item.latitude.toFixed(5),
      item.longitude.toFixed(5),
    ].join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function resolveLocalResults(query: string) {
  const normalized = normalizeCampusText(query).toLowerCase();
  if (!normalized) {
    return CAMPUS_SPOTS.map((spot) => buildCampusResult(spot));
  }

  const aliasId = CAMPUS_SPOT_ALIASES[normalized];
  const direct = CAMPUS_SPOTS.filter((spot) => {
    const haystack = `${spot.label} ${spot.shortLabel} ${spot.addressHint}`.toLowerCase();
    return haystack.includes(normalized);
  });

  const ordered = [
    ...(aliasId ? CAMPUS_SPOTS.filter((spot) => spot.id === aliasId) : []),
    ...direct,
  ];

  return dedupeResults(ordered.map((spot) => buildCampusResult(spot, aliasId === spot.id ? "alias" : "campus_spot")));
}

function createMapError(message: string, statusCode = 400) {
  const error = new Error(message) as Error & { statusCode?: number };
  error.statusCode = statusCode;
  return error;
}

async function fetchTomTomJson(url: URL) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TOMTOM_TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw createMapError(`TomTom request failed with status ${response.status}.`, response.status);
    }
    return response.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchTomTomBuffer(url: URL) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TOMTOM_TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw createMapError(`TomTom tile request failed with status ${response.status}.`, response.status);
    }
    return {
      contentType: response.headers.get("content-type") || "image/png",
      buffer: Buffer.from(await response.arrayBuffer()),
    };
  } finally {
    clearTimeout(timeout);
  }
}

function toTomTomSearchResult(item: any) {
  const latitude = Number(item?.position?.lat);
  const longitude = Number(item?.position?.lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  const coordinate = { latitude, longitude };
  if (!isWithinCampus(coordinate)) return null;

  const label =
    item?.poi?.name ||
    item?.address?.freeformAddress ||
    item?.address?.streetName ||
    item?.address?.municipalitySubdivision ||
    item?.address?.municipality ||
    "Campus result";

  const addressParts = [
    item?.address?.streetName,
    item?.address?.municipalitySubdivision,
    item?.address?.municipality,
  ]
    .map((value: unknown) => String(value || "").trim())
    .filter(Boolean);

  return {
    id: `tomtom-${item?.id || `${latitude}:${longitude}`}`,
    label: normalizeCampusText(label),
    shortLabel: null,
    addressHint: addressParts.length ? normalizeCampusText(addressParts.join(", ")) : null,
    latitude,
    longitude,
    campusId: CAMPUS_ID,
    zoneId: null,
    zoneLabel: null,
    placeType: "custom_pin" as const,
    source: "tomtom" as const,
    ...toBoardPoint(coordinate),
    distanceMeters: Math.round(haversineMeters(CAMPUS_CENTER, coordinate)),
  };
}

function buildFallbackRoute(origin: RouteRequestPoint, destination: RouteRequestPoint) {
  const distanceMeters = Math.max(25, Math.round(haversineMeters(origin, destination)));
  const durationMinutes = Math.max(1, Math.round(distanceMeters / 78));
  const originBoard = toBoardPoint(origin);
  const destinationBoard = toBoardPoint(destination);
  return {
    provider: "campus_graph",
    travelMode: "walking",
    originLabel: origin.label || "Campus origin",
    originLatitude: origin.latitude,
    originLongitude: origin.longitude,
    destinationLabel: destination.label || "Campus destination",
    destinationLatitude: destination.latitude,
    destinationLongitude: destination.longitude,
    durationMinutes,
    distanceMeters,
    summary: `${durationMinutes} min walk within SRM KTR`,
    computedAt: new Date().toISOString(),
    path: [
      { label: origin.label || "Origin", latitude: origin.latitude, longitude: origin.longitude, ...originBoard, kind: "origin" },
      { label: destination.label || "Destination", latitude: destination.latitude, longitude: destination.longitude, ...destinationBoard, kind: "destination" },
    ],
  };
}

export async function searchCampusLocations(query: string) {
  const normalized = normalizeCampusText(query);
  const cacheKey = normalized.toLowerCase();
  const cached = readCache(searchCache, cacheKey);
  if (cached) return cached;

  const localResults = resolveLocalResults(normalized);
  if (!normalized) {
    writeCache(searchCache, cacheKey, localResults, SEARCH_CACHE_TTL_MS);
    return localResults;
  }

  if (!env.TOMTOM_API_KEY) {
    writeCache(searchCache, cacheKey, localResults, SEARCH_CACHE_TTL_MS);
    return localResults;
  }

  const url = new URL(`${env.TOMTOM_SEARCH_BASE_URL}/search/2/search/${encodeURIComponent(normalized)}.json`);
  url.searchParams.set("key", env.TOMTOM_API_KEY);
  url.searchParams.set("limit", "6");
  url.searchParams.set("lat", String(CAMPUS_CENTER.latitude));
  url.searchParams.set("lon", String(CAMPUS_CENTER.longitude));
  url.searchParams.set("radius", String(CAMPUS_SEARCH_RADIUS_METERS));
  url.searchParams.set("countrySet", "IN");
  url.searchParams.set("language", "en-IN");
  url.searchParams.set("view", "IN");
  url.searchParams.set("typeahead", "true");
  url.searchParams.set("topLeft", `${CAMPUS_BOUNDS.maxLatitude},${CAMPUS_BOUNDS.minLongitude}`);
  url.searchParams.set("btmRight", `${CAMPUS_BOUNDS.minLatitude},${CAMPUS_BOUNDS.maxLongitude}`);

  try {
    const payload = await fetchTomTomJson(url);
    const remoteResults = Array.isArray(payload?.results)
      ? payload.results.map(toTomTomSearchResult).filter(Boolean)
      : [];
    const merged = dedupeResults([...localResults, ...remoteResults]).slice(0, 8);
    writeCache(searchCache, cacheKey, merged, SEARCH_CACHE_TTL_MS);
    return merged;
  } catch {
    writeCache(searchCache, cacheKey, localResults, SEARCH_CACHE_TTL_MS);
    return localResults;
  }
}

export async function reverseGeocodeCampusLocation(latitude: number, longitude: number) {
  const coordinate = { latitude, longitude };
  if (!isWithinCampus(coordinate)) {
    throw createMapError("Selected point is outside the SRM KTR campus boundary.", 400);
  }

  const cacheKey = `${latitude.toFixed(5)}:${longitude.toFixed(5)}`;
  const cached = readCache(reverseCache, cacheKey);
  if (cached) return cached;

  if (!env.TOMTOM_API_KEY) {
    const nearestSpot = CAMPUS_SPOTS
      .map((spot) => ({ spot, distance: haversineMeters(coordinate, spot) }))
      .sort((left, right) => left.distance - right.distance)[0]?.spot;
    const fallback = {
      id: `reverse-${cacheKey}`,
      label: nearestSpot?.label || "SRM KTR meetup pin",
      shortLabel: null,
      addressHint: nearestSpot?.addressHint || "Campus custom pin",
      latitude,
      longitude,
      campusId: CAMPUS_ID,
      zoneId: null,
      zoneLabel: null,
      placeType: "custom_pin" as const,
      source: "reverse_geocode" as const,
      ...toBoardPoint(coordinate),
      distanceMeters: null,
    };
    writeCache(reverseCache, cacheKey, fallback, REVERSE_CACHE_TTL_MS);
    return fallback;
  }

  const url = new URL(
    `${env.TOMTOM_SEARCH_BASE_URL}/search/2/reverseGeocode/${latitude},${longitude}.json`,
  );
  url.searchParams.set("key", env.TOMTOM_API_KEY);
  url.searchParams.set("radius", "120");
  url.searchParams.set("language", "en-IN");
  url.searchParams.set("view", "IN");

  try {
    const payload = await fetchTomTomJson(url);
    const address = payload?.addresses?.[0]?.address;
    const label = normalizeCampusText(
      address?.streetName ||
        address?.freeformAddress ||
        address?.municipalitySubdivision ||
        "SRM KTR meetup pin",
    );
    const result = {
      id: `reverse-${cacheKey}`,
      label,
      shortLabel: null,
      addressHint: normalizeCampusText(address?.freeformAddress || "Campus custom pin"),
      latitude,
      longitude,
      campusId: CAMPUS_ID,
      zoneId: null,
      zoneLabel: null,
      placeType: "custom_pin" as const,
      source: "reverse_geocode" as const,
      ...toBoardPoint(coordinate),
      distanceMeters: null,
    };
    writeCache(reverseCache, cacheKey, result, REVERSE_CACHE_TTL_MS);
    return result;
  } catch {
    const fallback = {
      id: `reverse-${cacheKey}`,
      label: "SRM KTR meetup pin",
      shortLabel: null,
      addressHint: "Campus custom pin",
      latitude,
      longitude,
      campusId: CAMPUS_ID,
      zoneId: null,
      zoneLabel: null,
      placeType: "custom_pin" as const,
      source: "reverse_geocode" as const,
      ...toBoardPoint(coordinate),
      distanceMeters: null,
    };
    writeCache(reverseCache, cacheKey, fallback, REVERSE_CACHE_TTL_MS);
    return fallback;
  }
}

export async function calculateCampusWalkingRoute(origin: RouteRequestPoint, destination: RouteRequestPoint) {
  if (!isWithinCampus(origin) || !isWithinCampus(destination)) {
    throw createMapError("Routing is restricted to the SRM KTR campus area.", 400);
  }

  const cacheKey = JSON.stringify({
    origin: [origin.latitude.toFixed(5), origin.longitude.toFixed(5)],
    destination: [destination.latitude.toFixed(5), destination.longitude.toFixed(5)],
  });
  const cached = readCache(routeCache, cacheKey);
  if (cached) return cached;

  if (!env.TOMTOM_API_KEY) {
    const fallback = buildFallbackRoute(origin, destination);
    writeCache(routeCache, cacheKey, fallback, ROUTE_CACHE_TTL_MS);
    return fallback;
  }

  const url = new URL(
    `${env.TOMTOM_ROUTING_BASE_URL}/routing/1/calculateRoute/${origin.latitude},${origin.longitude}:${destination.latitude},${destination.longitude}/json`,
  );
  url.searchParams.set("key", env.TOMTOM_API_KEY);
  url.searchParams.set("travelMode", "pedestrian");
  url.searchParams.set("routeType", "shortest");
  url.searchParams.set("traffic", "false");
  url.searchParams.set("computeTravelTimeFor", "all");
  url.searchParams.set("routeRepresentation", "polyline");
  url.searchParams.set("instructionsType", "tagged");
  url.searchParams.set("language", "en-IN");

  try {
    const payload = await fetchTomTomJson(url);
    const route = Array.isArray(payload?.routes) ? payload.routes[0] : null;
    const summary = route?.summary;
    const rawPoints = Array.isArray(route?.legs)
      ? route.legs.flatMap((leg: any) => leg?.points || [])
      : Array.isArray(route?.points)
        ? route.points
        : [];

    if (!summary || rawPoints.length < 2) {
      throw createMapError("TomTom route response did not include a usable path.", 502);
    }

    const path = rawPoints
      .map((point: any, index: number) => {
        const latitude = Number(point?.latitude ?? point?.lat);
        const longitude = Number(point?.longitude ?? point?.lon);
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
        const boardPoint = toBoardPoint({ latitude, longitude });
        return {
          label:
            index === 0
              ? origin.label || "Origin"
              : index === rawPoints.length - 1
                ? destination.label || "Destination"
                : null,
          latitude,
          longitude,
          x: boardPoint.x,
          y: boardPoint.y,
          kind:
            index === 0
              ? "origin"
              : index === rawPoints.length - 1
                ? "destination"
                : "waypoint",
        };
      })
      .filter(Boolean);

    if (path.length < 2) {
      throw createMapError("TomTom route response did not include a usable campus path.", 502);
    }

    const result = {
      provider: "tomtom",
      travelMode: "walking",
      originLabel: origin.label || "Campus origin",
      originLatitude: origin.latitude,
      originLongitude: origin.longitude,
      destinationLabel: destination.label || "Campus destination",
      destinationLatitude: destination.latitude,
      destinationLongitude: destination.longitude,
      durationMinutes: Math.max(1, Math.round(Number(summary?.travelTimeInSeconds || 0) / 60)),
      distanceMeters: Math.max(1, Math.round(Number(summary?.lengthInMeters || 0))),
      summary: `${Math.max(1, Math.round(Number(summary?.travelTimeInSeconds || 0) / 60))} min walk within SRM KTR`,
      computedAt: new Date().toISOString(),
      path,
    };
    writeCache(routeCache, cacheKey, result, ROUTE_CACHE_TTL_MS);
    return result;
  } catch {
    const fallback = buildFallbackRoute(origin, destination);
    writeCache(routeCache, cacheKey, fallback, ROUTE_CACHE_TTL_MS);
    return fallback;
  }
}

export async function getCampusTile(z: number, x: number, y: number, style = "street-light") {
  if (!env.TOMTOM_API_KEY) {
    throw createMapError("TomTom tile service is not configured on the server.", 503);
  }

  const safeStyle = String(style || "street-light").trim() || "street-light";
  const cacheKey = `${z}:${x}:${y}:${safeStyle}`;
  const cached = readCache(tileCache, cacheKey);
  if (cached) return cached;

  const url = new URL(`${env.TOMTOM_MAPS_BASE_URL}/maps/orbis/map-display/tile/${z}/${x}/${y}.png`);
  url.searchParams.set("apiVersion", "1");
  url.searchParams.set("style", safeStyle);
  url.searchParams.set("tileSize", "256");
  url.searchParams.set("view", "IN");
  url.searchParams.set("language", "en-GB");
  url.searchParams.set("key", env.TOMTOM_API_KEY);

  const data = await fetchTomTomBuffer(url);
  writeCache(tileCache, cacheKey, data, TILE_CACHE_TTL_MS);
  return data;
}
