"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useV2AppState } from "@/components/v2-app-providers";
import { Button, EmptyBlock, MetricTile, NoticeBanner, PageHeader, Surface } from "@/components/system/primitives";
import { SelectField } from "@/components/system/select-field";
import { TomTomCampusMap } from "@/components/workspace/tomtom-campus-map";
import { apiFetch, formatCurrency } from "@/lib/api";

const CAMPUS_CENTER = { latitude: 12.8231, longitude: 80.0444 };
const CAMPUS_BOUNDS = {
  minLatitude: 12.8204,
  maxLatitude: 12.8262,
  minLongitude: 80.0418,
  maxLongitude: 80.0474,
};
const DEFAULT_ORIGIN_ID = "hostel-square";
const WALKING_SPEED_METERS_PER_MINUTE = 78;
const CAMPUS_SPOT_ALIASES = {
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

const CAMPUS_SPOTS = [
  { id: "library-plaza", label: "University Library Plaza", shortLabel: "Library", x: 24, y: 34, latitude: 12.8239, longitude: 80.044, addressHint: "Main library front plaza" },
  { id: "tech-park-gate", label: "Tech Park Gate", shortLabel: "Tech Park", x: 69, y: 28, latitude: 12.8246, longitude: 80.0457, addressHint: "Near the tech park side entrance" },
  { id: "hostel-square", label: "Hostel Square", shortLabel: "Hostel Sq", x: 31, y: 71, latitude: 12.8219, longitude: 80.0435, addressHint: "Central hostel common area" },
  { id: "food-court", label: "Food Court Steps", shortLabel: "Food Court", x: 58, y: 58, latitude: 12.8225, longitude: 80.0451, addressHint: "Open seating beside the food court" },
  { id: "admin-lawn", label: "Admin Block Lawn", shortLabel: "Admin Lawn", x: 47, y: 20, latitude: 12.8244, longitude: 80.0448, addressHint: "Open lawn near the admin block" },
];

const CAMPUS_ROUTE_NODES = [
  ...CAMPUS_SPOTS,
  { id: "north-walk", label: "North Walk", shortLabel: "North Walk", x: 42, y: 29, latitude: 12.8241, longitude: 80.0446 },
  { id: "central-court", label: "Central Court", shortLabel: "Central Court", x: 48, y: 43, latitude: 12.8232, longitude: 80.0448 },
  { id: "east-walk", label: "East Walk", shortLabel: "East Walk", x: 61, y: 41, latitude: 12.8234, longitude: 80.0452 },
  { id: "south-hub", label: "South Hub", shortLabel: "South Hub", x: 43, y: 61, latitude: 12.8223, longitude: 80.0442 },
];

const CAMPUS_ROUTE_EDGES = [
  ["library-plaza", "north-walk"],
  ["admin-lawn", "north-walk"],
  ["north-walk", "central-court"],
  ["north-walk", "tech-park-gate"],
  ["north-walk", "east-walk"],
  ["central-court", "east-walk"],
  ["central-court", "south-hub"],
  ["central-court", "food-court"],
  ["east-walk", "food-court"],
  ["south-hub", "hostel-square"],
  ["south-hub", "food-court"],
];

function statusLabel(value) {
  return String(value || "proposed").replaceAll("_", " ");
}

function normalizeCampusText(value) {
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

function toDateTimeInputValue(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset();
  const next = new Date(date.getTime() - offset * 60 * 1000);
  return next.toISOString().slice(0, 16);
}

function getMinMeetupTimeValue() {
  return toDateTimeInputValue(new Date(Date.now() + 60 * 1000));
}

function isFutureLocalInputValue(value) {
  if (!value) return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && timestamp > Date.now();
}

function isScheduleParticipant(schedule, currentProfileId) {
  return !!schedule && !!currentProfileId && [schedule.buyerProfileId, schedule.sellerProfileId].includes(currentProfileId);
}

function hasParticipantConfirmed(schedule, currentProfileId) {
  if (!schedule || !currentProfileId) return false;
  if (currentProfileId === schedule.buyerProfileId) return !!schedule.buyerConfirmedAt;
  if (currentProfileId === schedule.sellerProfileId) return !!schedule.sellerConfirmedAt;
  return false;
}

function canConfirmSchedule(schedule, currentProfileId) {
  return ["proposed", "reschedule_requested", "confirmed"].includes(schedule?.status) && isScheduleParticipant(schedule, currentProfileId) && !hasParticipantConfirmed(schedule, currentProfileId);
}

function canCompleteSchedule(schedule, currentProfileId) {
  return schedule?.status === "confirmed" && isScheduleParticipant(schedule, currentProfileId);
}

function scheduleConfirmationSummary(schedule, currentProfileId = "") {
  if (!schedule) return "Waiting on both sides";
  const buyerReady = !!schedule.buyerConfirmedAt;
  const sellerReady = !!schedule.sellerConfirmedAt;
  if (buyerReady && sellerReady) return "Buyer and seller confirmed";
  if (currentProfileId && hasParticipantConfirmed(schedule, currentProfileId)) {
    return currentProfileId === schedule.buyerProfileId ? "You confirmed, waiting on seller" : "You confirmed, waiting on buyer";
  }
  if (buyerReady) return "Buyer confirmed, waiting on seller";
  if (sellerReady) return "Seller confirmed, waiting on buyer";
  return "Waiting on both sides to confirm";
}

function formatDate(value) {
  if (!value) return "Choose a time";
  try {
    return new Date(value).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
  } catch {
    return "Choose a time";
  }
}

function formatMeters(distanceMeters) {
  if (!Number.isFinite(distanceMeters) || distanceMeters <= 0) return "0 m";
  if (distanceMeters >= 1000) return `${(distanceMeters / 1000).toFixed(1)} km`;
  return `${Math.round(distanceMeters)} m`;
}

function formatDuration(durationMinutes) {
  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) return "0 min";
  if (durationMinutes >= 60) {
    const hours = Math.floor(durationMinutes / 60);
    const minutes = Math.round(durationMinutes % 60);
    return minutes ? `${hours} hr ${minutes} min` : `${hours} hr`;
  }
  return `${Math.round(durationMinutes)} min`;
}

function formatRouteSummary(route) {
  if (!route) return "Route preview unavailable";
  return `${formatDuration(route.durationMinutes)} walk / ${formatMeters(route.distanceMeters)}`;
}

function formatRouteProvider(provider) {
  if (provider === "tomtom") return "TomTom";
  if (provider === "google_maps") return "Google";
  return "Campus";
}

function formatMeetupLocation(location) {
  if (!location?.label) return "Choose a meetup location";
  const spot = location.zoneId ? getSpotById(location.zoneId) : null;
  const description = spot?.description ? ` — ${spot.description}` : "";
  return location.addressHint ? `${location.label} / ${location.addressHint}${description}` : `${location.label}${description}`;
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function toBoardPoint(latitude, longitude) {
  const xRatio = (longitude - CAMPUS_BOUNDS.minLongitude) / (CAMPUS_BOUNDS.maxLongitude - CAMPUS_BOUNDS.minLongitude);
  const yRatio = (CAMPUS_BOUNDS.maxLatitude - latitude) / (CAMPUS_BOUNDS.maxLatitude - CAMPUS_BOUNDS.minLatitude);
  return {
    x: Number(clamp(xRatio * 100, 6, 94).toFixed(2)),
    y: Number(clamp(yRatio * 100, 8, 92).toFixed(2)),
  };
}

function buildCustomMeetupLocation(pin, addressHint, resolvedLocation) {
  const normalizedHint = normalizeCampusText(addressHint);
  if (resolvedLocation?.latitude && resolvedLocation?.longitude) {
    return {
      label: normalizedHint || resolvedLocation.label || "Custom pin",
      latitude: resolvedLocation.latitude,
      longitude: resolvedLocation.longitude,
      campusId: "srm-ktr",
      zoneId: resolvedLocation.zoneId || "custom-pin",
      zoneLabel: resolvedLocation.zoneLabel || resolvedLocation.shortLabel || "Custom pin",
      placeType: resolvedLocation.placeType || "custom_pin",
      addressHint: normalizedHint || resolvedLocation.addressHint || null,
    };
  }
  const coordinate = {
    latitude: Number(pin?.latitude ?? CAMPUS_CENTER.latitude),
    longitude: Number(pin?.longitude ?? CAMPUS_CENTER.longitude),
  };
  return {
    label: normalizedHint || "Custom pin",
    latitude: coordinate.latitude,
    longitude: coordinate.longitude,
    campusId: "srm-ktr",
    zoneId: "custom-pin",
    zoneLabel: "Custom pin",
    placeType: "custom_pin",
    addressHint: normalizedHint || null,
  };
}

function getSpotById(spotId) {
  return CAMPUS_SPOTS.find((spot) => spot.id === spotId) || CAMPUS_SPOTS[0];
}

function findNearestSpotId(point) {
  return CAMPUS_SPOTS
    .map((spot) => ({ id: spot.id, distance: haversineMeters(point, spot) }))
    .sort((left, right) => left.distance - right.distance)[0]?.id || DEFAULT_ORIGIN_ID;
}

function buildSpotMeetupLocation(spotId) {
  const spot = getSpotById(spotId);
  return {
    label: spot.label,
    latitude: spot.latitude,
    longitude: spot.longitude,
    campusId: "srm-ktr",
    zoneId: spot.id,
    zoneLabel: spot.shortLabel,
    placeType: "campus_zone",
    addressHint: spot.addressHint,
  };
}

function resolveSpotIdFromQuery(value) {
  const normalized = normalizeCampusText(value).toLowerCase();
  if (!normalized) return "";
  if (CAMPUS_SPOT_ALIASES[normalized]) return CAMPUS_SPOT_ALIASES[normalized];
  const directMatch = CAMPUS_SPOTS.find((spot) => {
    const haystack = `${spot.label} ${spot.shortLabel} ${spot.addressHint || ""}`.toLowerCase();
    return haystack.includes(normalized);
  });
  return directMatch?.id || "";
}

function haversineMeters(left, right) {
  const toRad = (degrees) => (degrees * Math.PI) / 180;
  const latitudeDelta = toRad(right.latitude - left.latitude);
  const longitudeDelta = toRad(right.longitude - left.longitude);
  const latitudeA = toRad(left.latitude);
  const latitudeB = toRad(right.latitude);
  const a = Math.sin(latitudeDelta / 2) ** 2 + Math.cos(latitudeA) * Math.cos(latitudeB) * Math.sin(longitudeDelta / 2) ** 2;
  return 6371000 * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function toRoutePoint(node, kind = "waypoint") {
  const projected = Number.isFinite(node?.x) && Number.isFinite(node?.y) ? { x: node.x, y: node.y } : toBoardPoint(node.latitude, node.longitude);
  return { label: node.label, latitude: node.latitude, longitude: node.longitude, x: projected.x, y: projected.y, kind };
}

function buildGraph(point) {
  const nodes = new Map(CAMPUS_ROUTE_NODES.map((node) => [node.id, node]));
  const adjacency = new Map();

  function connect(leftId, rightId, leftNode = nodes.get(leftId), rightNode = nodes.get(rightId)) {
    if (!leftNode || !rightNode) return;
    const distance = haversineMeters(leftNode, rightNode);
    adjacency.set(leftId, [...(adjacency.get(leftId) || []), { id: rightId, distance }]);
    adjacency.set(rightId, [...(adjacency.get(rightId) || []), { id: leftId, distance }]);
  }

  CAMPUS_ROUTE_EDGES.forEach(([leftId, rightId]) => connect(leftId, rightId));

  if (point?.id && point.id !== point.zoneId) {
    nodes.set(point.id, point);
    [...nodes.values()]
      .filter((node) => node.id !== point.id)
      .map((node) => ({ id: node.id, distance: Math.hypot(node.x - point.x, node.y - point.y) }))
      .sort((left, right) => left.distance - right.distance)
      .slice(0, 3)
      .forEach(({ id }) => connect(point.id, id, point, nodes.get(id)));
  }

  return { nodes, adjacency };
}

function buildPath(nodeIds, nodes) {
  return nodeIds
    .map((nodeId, index) => {
      const node = nodes.get(nodeId);
      if (!node) return null;
      if (index === 0) return toRoutePoint(node, "origin");
      if (index === nodeIds.length - 1) return toRoutePoint(node, "destination");
      return toRoutePoint(node, "waypoint");
    })
    .filter(Boolean);
}

function buildStableRoutePath(shortestPath, nodes, originSpot, destinationNode) {
  const nextPath = buildPath(shortestPath.path, nodes);
  if (nextPath.length >= 2) return nextPath;
  return [toRoutePoint(originSpot, "origin"), toRoutePoint(destinationNode, "destination")];
}

function runDijkstra(startId, endId, nodes, adjacency) {
  const distances = new Map();
  const previous = new Map();
  const queue = new Set(nodes.keys());

  nodes.forEach((_, nodeId) => {
    distances.set(nodeId, nodeId === startId ? 0 : Number.POSITIVE_INFINITY);
  });

  while (queue.size) {
    let currentId = null;
    let currentDistance = Number.POSITIVE_INFINITY;

    queue.forEach((nodeId) => {
      const distance = distances.get(nodeId) ?? Number.POSITIVE_INFINITY;
      if (distance < currentDistance) {
        currentDistance = distance;
        currentId = nodeId;
      }
    });

    if (!currentId || currentId === endId) break;
    queue.delete(currentId);

    for (const neighbor of adjacency.get(currentId) || []) {
      if (!queue.has(neighbor.id)) continue;
      const candidateDistance = currentDistance + neighbor.distance;
      if (candidateDistance < (distances.get(neighbor.id) ?? Number.POSITIVE_INFINITY)) {
        distances.set(neighbor.id, candidateDistance);
        previous.set(neighbor.id, currentId);
      }
    }
  }

  const endDistance = distances.get(endId);
  if (!Number.isFinite(endDistance)) return null;

  const path = [];
  let cursor = endId;
  while (cursor) {
    path.unshift(cursor);
    cursor = previous.get(cursor) || null;
  }

  return { distanceMeters: endDistance, path };
}

function planCampusRoute(originSpotId, destinationLocation, destinationPoint) {
  const originSpot = getSpotById(originSpotId);
  const destinationNodeId =
    destinationLocation?.placeType === "campus_zone" && destinationLocation.zoneId ? destinationLocation.zoneId : "custom-destination";

  const destinationNode =
    destinationNodeId === "custom-destination"
      ? {
        id: destinationNodeId,
        zoneId: destinationLocation?.zoneId || null,
        label: destinationLocation?.label || "Custom destination",
        latitude: destinationLocation?.latitude || CAMPUS_CENTER.latitude,
        longitude: destinationLocation?.longitude || CAMPUS_CENTER.longitude,
        x: destinationPoint?.x ?? 50,
        y: destinationPoint?.y ?? 50,
      }
      : CAMPUS_ROUTE_NODES.find((node) => node.id === destinationNodeId);

  if (!destinationNode) return null;

  const { nodes, adjacency } = buildGraph(destinationNodeId === "custom-destination" ? destinationNode : null);
  const shortestPath = runDijkstra(originSpot.id, destinationNodeId, nodes, adjacency);

  if (!shortestPath) {
    const fallbackDistance = haversineMeters(originSpot, destinationNode);
    const fallbackDuration = Math.max(1, Math.round(fallbackDistance / WALKING_SPEED_METERS_PER_MINUTE));
    return {
      provider: "campus_graph",
      travelMode: "walking",
      originLabel: originSpot.label,
      originLatitude: originSpot.latitude,
      originLongitude: originSpot.longitude,
      destinationLabel: destinationNode.label,
      destinationLatitude: destinationNode.latitude,
      destinationLongitude: destinationNode.longitude,
      durationMinutes: fallbackDuration,
      distanceMeters: Math.round(fallbackDistance),
      summary: `${formatDuration(fallbackDuration)} walk from ${originSpot.shortLabel || originSpot.label}`,
      computedAt: new Date().toISOString(),
      path: [toRoutePoint(originSpot, "origin"), toRoutePoint(destinationNode, "destination")],
    };
  }

  const distanceMeters = Math.max(35, Math.round(shortestPath.distanceMeters));
  const durationMinutes = Math.max(1, Math.round(distanceMeters / WALKING_SPEED_METERS_PER_MINUTE));
  return {
    provider: "campus_graph",
    travelMode: "walking",
    originLabel: originSpot.label,
    originLatitude: originSpot.latitude,
    originLongitude: originSpot.longitude,
    destinationLabel: destinationNode.label,
    destinationLatitude: destinationNode.latitude,
    destinationLongitude: destinationNode.longitude,
    durationMinutes,
    distanceMeters,
    summary: `${formatDuration(durationMinutes)} walk from ${originSpot.shortLabel || originSpot.label}`,
    computedAt: new Date().toISOString(),
    path: buildStableRoutePath(shortestPath, nodes, originSpot, destinationNode),
  };
}

function buildSelectedLocation(spotId, customPin, customLocationHint, resolvedLocation) {
  if (spotId === "custom-pin") return buildCustomMeetupLocation(customPin, customLocationHint, resolvedLocation);
  return buildSpotMeetupLocation(spotId);
}

function buildDestinationPoint(spotId, customPin, resolvedLocation) {
  if (spotId === "custom-pin") {
    if (resolvedLocation?.latitude && resolvedLocation?.longitude) {
      return {
        x: Number.isFinite(resolvedLocation?.x) ? resolvedLocation.x : toBoardPoint(resolvedLocation.latitude, resolvedLocation.longitude).x,
        y: Number.isFinite(resolvedLocation?.y) ? resolvedLocation.y : toBoardPoint(resolvedLocation.latitude, resolvedLocation.longitude).y,
      };
    }
    return toBoardPoint(customPin?.latitude ?? CAMPUS_CENTER.latitude, customPin?.longitude ?? CAMPUS_CENTER.longitude);
  }
  const spot = getSpotById(spotId);
  return { x: spot.x, y: spot.y };
}

async function fetchRoutePreview(auth, origin, destination, fallbackRoute) {
  try {
    const params = new URLSearchParams({
      originLatitude: String(origin.latitude),
      originLongitude: String(origin.longitude),
      destinationLatitude: String(destination.latitude),
      destinationLongitude: String(destination.longitude),
    });
    if (origin.label) params.set("originLabel", origin.label);
    if (destination.label) params.set("destinationLabel", destination.label);
    const response = await apiFetch(`/maps/route?${params.toString()}`, auth, {
      cacheMs: 1800000,
      staleMs: 21600000,
    });
    return response.data || fallbackRoute;
  } catch {
    return fallbackRoute;
  }
}

function buildFallbackSearchResults(query = "") {
  const localSpotId = resolveSpotIdFromQuery(query || "");
  const fallbackResults = localSpotId
    ? [buildSpotMeetupLocation(localSpotId)]
    : CAMPUS_SPOTS.map((spot) => buildSpotMeetupLocation(spot.id));
  return fallbackResults.map((item) => ({
    ...item,
    id: item.zoneId || item.label,
    shortLabel: item.zoneLabel || item.label,
    source: item.zoneId ? "campus_spot" : "alias",
    ...toBoardPoint(item.latitude, item.longitude),
  }));
}

function longitudeToTileX(longitude, zoom) {
  return Math.floor(((longitude + 180) / 360) * 2 ** zoom);
}

function latitudeToTileY(latitude, zoom) {
  const radians = (latitude * Math.PI) / 180;
  return Math.floor(
    ((1 - Math.log(Math.tan(radians) + 1 / Math.cos(radians)) / Math.PI) / 2) * 2 ** zoom,
  );
}

function preloadTomTomCampusTiles() {
  if (typeof window === "undefined") return;
  const zoom = 17;
  const centerX = longitudeToTileX(CAMPUS_CENTER.longitude, zoom);
  const centerY = latitudeToTileY(CAMPUS_CENTER.latitude, zoom);
  for (let xOffset = -1; xOffset <= 1; xOffset += 1) {
    for (let yOffset = -1; yOffset <= 1; yOffset += 1) {
      const image = new window.Image();
      image.decoding = "async";
      image.src = `/api/backend/maps/tiles/${zoom}/${centerX + xOffset}/${centerY + yOffset}.png?style=street-light`;
    }
  }
}

function CampusGeoBoard({
  selectedSpotId,
  selectedLocation,
  selectedOriginId,
  customPin,
  route,
  tileUrlTemplate,
  onPickSpot,
  onPickCustomPin,
}) {
  return (
    <div className="v2-geo-board-wrap">
      <div className="v2-geo-board">
        <TomTomCampusMap
          tileUrlTemplate={tileUrlTemplate}
          selectedSpotId={selectedSpotId}
          selectedLocation={selectedLocation}
          selectedOriginId={selectedOriginId}
          customPin={customPin}
          route={route}
          spots={CAMPUS_SPOTS}
          onPickSpot={onPickSpot}
          onPickCustomPin={onPickCustomPin}
        />
        <div className="v2-geo-board-badge v2-geo-board-badge-origin">Start: {getSpotById(selectedOriginId).shortLabel}</div>
        <div className="v2-geo-board-badge v2-geo-board-badge-destination">Meet: {selectedLocation?.zoneLabel || selectedLocation?.label || "Campus spot"}</div>
      </div>

      <div className="v2-geo-board-caption">
        <strong>{selectedLocation?.label || "Campus meetup map"}</strong>
        <span>{formatMeetupLocation(selectedLocation)}</span>
      </div>
    </div>
  );
}

function ScheduleLocationOverlay({
  open,
  selectedSpotId,
  selectedLocation,
  selectedOriginId,
  route,
  routeLoading,
  customPin,
  customLocationHint,
  spotSearchValue,
  searchResults,
  searchBusy,
  locateBusy,
  locateMessage,
  tileUrlTemplate,
  onSpotSearchChange,
  onClose,
  onPickSpot,
  onPickSearchResult,
  onPickOrigin,
  onUseMyLocation,
  onPickCustomPin,
  onCustomLocationHintChange,
  onConfirm,
}) {
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    function handleKeydown(event) {
      if (event.key === "Escape") onClose?.();
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeydown);
    window.requestAnimationFrame(() => {
      if (panelRef.current) panelRef.current.scrollTop = 0;
    });

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeydown);
    };
  }, [onClose, open]);

  if (!open) return null;

  return (
    <>
      <button type="button" className="v2-modal-scrim" aria-label="Close location picker" onClick={onClose} />
      <section
        ref={panelRef}
        className="v2-modal-panel v2-compare-overlay v2-compare-overlay-ready v2-meetup-overlay"
        aria-label="Meetup location picker"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="v2-compare-overlay-head v2-meetup-overlay-head">
          <div className="v2-compare-overlay-copy">
            <p className="v2-eyebrow">Meetup Route Planner</p>
            <h2>Choose the spot and lock the campus route.</h2>
            <p>Pick the meetup point, confirm the likely start side, and save the same route context for both buyer and seller.</p>
          </div>
          <div className="v2-page-header-actions v2-meetup-overlay-actions">
            <Button variant="secondary" onClick={onConfirm}>Use this route</Button>
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
          </div>
        </header>

        <div className="v2-compare-overlay-metrics v2-meetup-overlay-metrics">
          <div className="v2-fact-card">
            <span>Meet at</span>
            <strong>{selectedLocation.label}</strong>
          </div>
          <div className="v2-fact-card">
            <span>{routeLoading ? "ETA status" : "Estimated walk"}</span>
            <strong>{routeLoading ? "Refining with TomTom" : formatDuration(route?.durationMinutes || 0)}</strong>
          </div>
          <div className="v2-fact-card">
            <span>Route quality</span>
            <strong>{route?.provider === "tomtom" ? "TomTom optimized" : "Campus fallback"}</strong>
          </div>
        </div>

        <div className="v2-meetup-overlay-grid">
          <div className="v2-meetup-overlay-map">
            <CampusGeoBoard
              selectedSpotId={selectedSpotId}
              selectedLocation={selectedLocation}
              selectedOriginId={selectedOriginId}
              customPin={customPin}
              route={route}
              tileUrlTemplate={tileUrlTemplate}
              onPickSpot={onPickSpot}
              onPickCustomPin={onPickCustomPin}
            />
          </div>

          <aside className="v2-meetup-overlay-side">
            <label className="v2-field">
              <span>Find a campus landmark</span>
              <input
                value={spotSearchValue}
                onChange={(event) => onSpotSearchChange(event.target.value)}
                placeholder="Try tp, lib, admin block, hostel square"
              />
            </label>

            {searchResults.length ? (
              <div className="v2-geo-search-results">
                {searchResults.map((result) => (
                  <button
                    key={result.id}
                    type="button"
                    className={`v2-geo-search-result ${selectedSpotId === result.zoneId || (selectedSpotId === "custom-pin" && selectedLocation?.label === result.label)
                        ? "v2-geo-search-result-active"
                        : ""
                      }`}
                    onClick={() => onPickSearchResult(result)}
                  >
                    <strong>{result.shortLabel || result.label}</strong>
                    <span>{result.addressHint || result.label}</span>
                    <small>{formatRouteProvider(result.source === "tomtom" ? "tomtom" : "campus_graph")} search</small>
                  </button>
                ))}
              </div>
            ) : searchBusy ? (
              <div className="v2-geo-search-empty">Searching SRM KTR landmarks…</div>
            ) : null}

            <div className="v2-route-panel">
              <span className="v2-eyebrow">Meet at</span>
              <div className="v2-geo-chip-row">
                {CAMPUS_SPOTS.map((spot) => (
                  <button
                    key={spot.id}
                    type="button"
                    className={`v2-filter-chip ${selectedSpotId === spot.id ? "v2-filter-chip-active" : ""}`}
                    onClick={() => onPickSpot(spot.id)}
                  >
                    {spot.shortLabel}
                  </button>
                ))}
                <button
                  type="button"
                  className={`v2-filter-chip ${selectedSpotId === "custom-pin" ? "v2-filter-chip-active" : ""}`}
                  onClick={() => onPickSpot("custom-pin")}
                >
                  Custom pin
                </button>
              </div>
            </div>

            <div className="v2-route-panel">
              <div className="v2-route-panel-head">
                <span className="v2-eyebrow">Start from</span>
                <button type="button" className="v2-inline-link-button" onClick={onUseMyLocation} disabled={locateBusy}>
                  {locateBusy ? "Locating…" : "Use my location"}
                </button>
              </div>
              <div className="v2-geo-chip-row">
                {CAMPUS_SPOTS.map((spot) => (
                  <button
                    key={`origin-${spot.id}`}
                    type="button"
                    className={`v2-filter-chip ${selectedOriginId === spot.id ? "v2-filter-chip-active" : ""}`}
                    onClick={() => onPickOrigin(spot.id)}
                  >
                    {spot.shortLabel}
                  </button>
                ))}
              </div>
              {locateMessage ? <small className="v2-route-helper-copy">{locateMessage}</small> : null}
            </div>

            {selectedSpotId === "custom-pin" ? (
              <label className="v2-field">
                <span>Custom pin label</span>
                <input
                  value={customLocationHint}
                  onChange={(event) => onCustomLocationHintChange(event.target.value)}
                  placeholder="Hostel D lobby, tp side gate, canteen entrance"
                />
              </label>
            ) : null}

            <div className="v2-route-stat-grid">
              <div className="v2-route-stat">
                <strong>{formatDuration(route?.durationMinutes || 0)}</strong>
                <span>{routeLoading ? "Refining ETA" : "Estimated walk"}</span>
              </div>
              <div className="v2-route-stat">
                <strong>{formatMeters(route?.distanceMeters || 0)}</strong>
                <span>{route?.provider === "tomtom" ? "Optimized walk" : routeLoading ? "Local fallback route" : "Shortest route"}</span>
              </div>
              <div className="v2-route-stat">
                <strong>{formatRouteProvider(route?.provider)}</strong>
                <span>Route provider</span>
              </div>
            </div>

            <div className="v2-geo-summary">
              <strong>{selectedLocation.label}</strong>
              <span>{formatMeetupLocation(selectedLocation)}</span>
              <small>
                {routeLoading
                  ? `Refining route from ${route?.originLabel || "Route origin"} with TomTom...`
                  : `${route?.originLabel || "Route origin"} / ${formatRouteSummary(route)}${route?.summary ? ` / ${route.summary}` : ""}`}
              </small>
            </div>

            <div className="v2-checklist v2-meetup-overlay-note">
              <span>Search stays restricted to SRM KTR and nearby campus landmarks.</span>
              <span>ETA and path are stored with the meetup so both sides see the same plan.</span>
              <span>TomTom handles live campus place lookup and walking-route geometry here.</span>
            </div>
          </aside>
        </div>
      </section>
    </>
  );
}

export function V2SchedulesPage() {
  const { auth, signedInLike } = useV2AppState();
  const searchParams = useSearchParams();
  const currentProfileId = auth.profile?.id || "";
  const tomtomTileUrlTemplate = "/api/backend/maps/tiles/{z}/{x}/{y}.png?style=street-light";
  const [listingId, setListingId] = useState("");
  const [requestedMode, setRequestedMode] = useState("meetup");
  const [proposedTime, setProposedTime] = useState("");
  const [notes, setNotes] = useState("");
  const [schedules, setSchedules] = useState([]);
  const [listingOptions, setListingOptions] = useState([]);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [selectedSpotId, setSelectedSpotId] = useState("library-plaza");
  const [originSpotId, setOriginSpotId] = useState(DEFAULT_ORIGIN_ID);
  const [customPin, setCustomPin] = useState({ latitude: CAMPUS_CENTER.latitude, longitude: CAMPUS_CENTER.longitude });
  const [customLocationHint, setCustomLocationHint] = useState("");
  const [selectedSearchLocation, setSelectedSearchLocation] = useState(null);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [locationOverlayOpen, setLocationOverlayOpen] = useState(false);
  const [draftSpotId, setDraftSpotId] = useState("library-plaza");
  const [draftOriginSpotId, setDraftOriginSpotId] = useState(DEFAULT_ORIGIN_ID);
  const [draftCustomPin, setDraftCustomPin] = useState({ latitude: CAMPUS_CENTER.latitude, longitude: CAMPUS_CENTER.longitude });
  const [draftCustomLocationHint, setDraftCustomLocationHint] = useState("");
  const [draftSearchLocation, setDraftSearchLocation] = useState(null);
  const [draftRoute, setDraftRoute] = useState(null);
  const [spotSearchValue, setSpotSearchValue] = useState("");
  const [minMeetupTime, setMinMeetupTime] = useState(getMinMeetupTimeValue());
  const [searchResults, setSearchResults] = useState([]);
  const [searchBusy, setSearchBusy] = useState(false);
  const [draftRouteLoading, setDraftRouteLoading] = useState(false);
  const [selectedRouteLoading, setSelectedRouteLoading] = useState(false);
  const [locateBusy, setLocateBusy] = useState(false);
  const [locateMessage, setLocateMessage] = useState("");
  const deferredSpotQuery = useDeferredValue(spotSearchValue);
  const selectedRouteRequestRef = useRef(0);
  const draftRouteRequestRef = useRef(0);

  async function loadSchedules() {
    const response = await apiFetch("/schedules", auth).catch(() => ({ data: [] }));
    setSchedules(response.data || []);
  }

  useEffect(() => {
    if (!signedInLike) return;
    loadSchedules().catch(() => setMessage("Could not load schedules."));
    apiFetch("/listings", auth)
      .then((response) => setListingOptions((response.data || []).slice(0, 24)))
      .catch(() => setListingOptions([]));
  }, [signedInLike, auth.accessToken, auth.overrideSecret, auth.devEmail]);

  useEffect(() => {
    if (!signedInLike) return;
    preloadTomTomCampusTiles();
    apiFetch("/maps/search?q=", auth, { cacheMs: 1800000, staleMs: 21600000 }).catch(() => null);
    const origin = buildSpotMeetupLocation(DEFAULT_ORIGIN_ID);
    const destination = buildSpotMeetupLocation("library-plaza");
    const params = new URLSearchParams({
      originLatitude: String(origin.latitude),
      originLongitude: String(origin.longitude),
      originLabel: origin.label,
      destinationLatitude: String(destination.latitude),
      destinationLongitude: String(destination.longitude),
      destinationLabel: destination.label,
    });
    apiFetch(`/maps/route?${params.toString()}`, auth, {
      cacheMs: 1800000,
      staleMs: 21600000,
    }).catch(() => null);
  }, [signedInLike, auth.accessToken, auth.overrideSecret, auth.devEmail]);

  useEffect(() => {
    const nextListingId = searchParams.get("listingId");
    if (nextListingId) setListingId(nextListingId);
  }, [searchParams]);

  useEffect(() => {
    if (!message) return undefined;
    const timer = window.setTimeout(() => setMessage(""), 2200);
    return () => window.clearTimeout(timer);
  }, [message]);

  useEffect(() => {
    setMinMeetupTime(getMinMeetupTimeValue());
    const timer = window.setInterval(() => setMinMeetupTime(getMinMeetupTimeValue()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!locationOverlayOpen) return;
    setSearchResults(buildFallbackSearchResults(deferredSpotQuery || ""));
    setSearchBusy(true);
    apiFetch(`/maps/search?q=${encodeURIComponent(deferredSpotQuery || "")}`, auth, {
      cacheMs: 300000,
      staleMs: 1800000,
    })
      .then((response) => setSearchResults((response.data || []).length ? response.data || [] : buildFallbackSearchResults(deferredSpotQuery || "")))
      .catch(() => {
        setSearchResults(buildFallbackSearchResults(deferredSpotQuery || ""));
      })
      .finally(() => setSearchBusy(false));
  }, [locationOverlayOpen, deferredSpotQuery, auth.accessToken, auth.overrideSecret, auth.devEmail]);

  const selectedLocation = useMemo(
    () => buildSelectedLocation(selectedSpotId, customPin, customLocationHint, selectedSearchLocation),
    [customLocationHint, customPin, selectedSearchLocation, selectedSpotId],
  );
  const draftSelectedLocation = useMemo(
    () => buildSelectedLocation(draftSpotId, draftCustomPin, draftCustomLocationHint, draftSearchLocation),
    [draftCustomLocationHint, draftCustomPin, draftSearchLocation, draftSpotId],
  );

  useEffect(() => {
    const fallbackRoute = planCampusRoute(
      originSpotId,
      selectedLocation,
      buildDestinationPoint(selectedSpotId, customPin, selectedSearchLocation),
    );
    setSelectedRoute(fallbackRoute);
    const requestId = selectedRouteRequestRef.current + 1;
    selectedRouteRequestRef.current = requestId;
    setSelectedRouteLoading(true);
    fetchRoutePreview(
      auth,
      buildSpotMeetupLocation(originSpotId),
      selectedLocation,
      fallbackRoute,
    )
      .then((route) => {
        if (selectedRouteRequestRef.current !== requestId) return;
        setSelectedRoute(route || fallbackRoute);
      })
      .finally(() => {
        if (selectedRouteRequestRef.current === requestId) {
          setSelectedRouteLoading(false);
        }
      });
  }, [
    auth.accessToken,
    auth.overrideSecret,
    auth.devEmail,
    originSpotId,
    selectedLocation,
    selectedSpotId,
    customPin,
    selectedSearchLocation,
  ]);

  useEffect(() => {
    if (!locationOverlayOpen) return;
    const fallbackRoute = planCampusRoute(
      draftOriginSpotId,
      draftSelectedLocation,
      buildDestinationPoint(draftSpotId, draftCustomPin, draftSearchLocation),
    );
    setDraftRoute(fallbackRoute);
    const requestId = draftRouteRequestRef.current + 1;
    draftRouteRequestRef.current = requestId;
    setDraftRouteLoading(true);
    fetchRoutePreview(
      auth,
      buildSpotMeetupLocation(draftOriginSpotId),
      draftSelectedLocation,
      fallbackRoute,
    )
      .then((route) => {
        if (draftRouteRequestRef.current !== requestId) return;
        setDraftRoute(route || fallbackRoute);
      })
      .finally(() => {
        if (draftRouteRequestRef.current === requestId) {
          setDraftRouteLoading(false);
        }
      });
  }, [
    locationOverlayOpen,
    auth.accessToken,
    auth.overrideSecret,
    auth.devEmail,
    draftOriginSpotId,
    draftSelectedLocation,
    draftSpotId,
    draftCustomPin,
    draftSearchLocation,
  ]);

  const stats = useMemo(
    () => ({
      proposed: schedules.filter((item) => item.status === "proposed").length,
      confirmed: schedules.filter((item) => item.status === "confirmed").length,
      reschedule: schedules.filter((item) => item.status === "reschedule_requested").length,
      completed: schedules.filter((item) => item.status === "completed").length,
    }),
    [schedules],
  );

  async function createSchedule(event) {
    event.preventDefault();
    if (!listingId || !proposedTime) return;
    if (!isFutureLocalInputValue(proposedTime)) {
      setMessage("Meetups must be proposed for a future time.");
      return;
    }
    setBusy("create");
    try {
      await apiFetch("/schedules", auth, {
        method: "POST",
        body: {
          listingId,
          requestedMode,
          proposedTime: new Date(proposedTime).toISOString(),
          notes: notes || undefined,
          meetupLocation: selectedLocation,
          meetupRoute: selectedRoute,
        },
        invalidatePaths: ["/schedules", "/chat"],
      });
      setNotes("");
      setProposedTime("");
      await loadSchedules();
      setMessage(`Meetup proposed for ${selectedLocation.label}. The other side still needs to confirm.`);
    } catch (error) {
      setMessage(error.message || "Could not create meetup.");
    } finally {
      setBusy("");
    }
  }

  async function updateSchedule(scheduleId, status) {
    setBusy(scheduleId);
    try {
      await apiFetch(`/schedules/${scheduleId}`, auth, {
        method: "PATCH",
        body: { status },
        invalidatePaths: ["/schedules", "/chat"],
      });
      await loadSchedules();
      setMessage(
        status === "confirmed"
          ? "Your confirmation is saved. The meetup locks once both sides confirm."
          : status === "completed"
            ? "Meetup marked as completed."
            : "Meetup updated.",
      );
    } catch (error) {
      setMessage(error.message || "Could not update meetup.");
    } finally {
      setBusy("");
    }
  }

  async function hydrateCustomPin(pin) {
    const coordinate = {
      latitude: Number(pin?.latitude ?? CAMPUS_CENTER.latitude),
      longitude: Number(pin?.longitude ?? CAMPUS_CENTER.longitude),
    };
    setDraftSearchLocation(null);
    setDraftCustomPin(pin);
    setSpotSearchValue("Custom pin");
    try {
      const response = await apiFetch(
        `/maps/reverse?latitude=${coordinate.latitude}&longitude=${coordinate.longitude}`,
        auth,
        { cacheMs: 600000, staleMs: 1800000 },
      );
      const location = response.data || null;
      if (location) {
        setDraftSearchLocation(location);
        setDraftCustomPin({
          latitude: Number(location.latitude),
          longitude: Number(location.longitude),
        });
        setDraftCustomLocationHint(location.addressHint || location.label || "");
        setSpotSearchValue(location.label || "Custom pin");
      }
    } catch {
      setDraftSearchLocation(null);
      setDraftCustomPin(pin);
    }
  }

  async function useCurrentLocation() {
    if (typeof window === "undefined" || !window.navigator?.geolocation) {
      setLocateMessage("Live location is unavailable in this browser.");
      return;
    }

    setLocateBusy(true);
    setLocateMessage("");
    window.navigator.geolocation.getCurrentPosition(
      (position) => {
        const coordinate = {
          latitude: Number(position.coords.latitude),
          longitude: Number(position.coords.longitude),
        };
        const outOfCampus =
          coordinate.latitude < CAMPUS_BOUNDS.minLatitude ||
          coordinate.latitude > CAMPUS_BOUNDS.maxLatitude ||
          coordinate.longitude < CAMPUS_BOUNDS.minLongitude ||
          coordinate.longitude > CAMPUS_BOUNDS.maxLongitude;
        if (outOfCampus) {
          setLocateMessage("You appear to be outside SRM KTR. Start side stays manual.");
          setLocateBusy(false);
          return;
        }
        const nearestSpotId = findNearestSpotId(coordinate);
        setDraftOriginSpotId(nearestSpotId);
        setLocateMessage(`Nearest campus start side selected: ${getSpotById(nearestSpotId).shortLabel}.`);
        setLocateBusy(false);
      },
      () => {
        setLocateMessage("Could not read your current location.");
        setLocateBusy(false);
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 },
    );
  }

  function openLocationOverlay() {
    setDraftSpotId(selectedSpotId);
    setDraftOriginSpotId(originSpotId);
    setDraftCustomPin(customPin);
    setDraftCustomLocationHint(customLocationHint);
    setDraftSearchLocation(selectedSearchLocation);
    setDraftRoute(selectedRoute);
    setSpotSearchValue(selectedLocation?.zoneLabel || selectedLocation?.label || "");
    setLocateMessage("");
    setLocationOverlayOpen(true);
  }

  function confirmLocationSelection() {
    setSelectedSpotId(draftSpotId);
    setOriginSpotId(draftOriginSpotId);
    setCustomPin(draftCustomPin);
    setCustomLocationHint(draftCustomLocationHint);
    setSelectedSearchLocation(draftSearchLocation);
    setSelectedRoute(draftRoute);
    setLocationOverlayOpen(false);
  }

  if (!signedInLike) {
    return (
      <div className="v2-workspace-page">
        <PageHeader compact eyebrow="Meetups" title="Sign in to coordinate handoffs and track meetup state." description="Meetup planning only works when it is tied to your actual buyer or seller identity." />
      </div>
    );
  }

  return (
    <div className="v2-workspace-page">
      <PageHeader compact eyebrow="Meetups" title="Coordinate your handoffs with time, place, and route." description="Meetups now keep a structured destination, TomTom-backed campus search, and a persisted walking route preview instead of burying the plan in notes." />

      <div className="v2-metric-grid v2-metric-grid-wide">
        <MetricTile label="Proposed" value={stats.proposed} detail="waiting on confirmations" tone="buying" />
        <MetricTile label="Confirmed" value={stats.confirmed} detail="locked by both sides" tone="selling" />
        <MetricTile label="Reschedule" value={stats.reschedule} detail="needs timing changes" tone="neutral" />
        <MetricTile label="Completed" value={stats.completed} detail="handoffs closed out" tone="safety" />
      </div>

      {message ? <NoticeBanner tone="neutral" title="Meetup update" description={message} className="v2-page-alert" /> : null}

      <div className="v2-workspace-layout">
        <Surface title="Propose meetup" description="Set the listing, time, and handoff spot first. The meetup only locks after both buyer and seller confirm it.">
          <form className="v2-field-stack" onSubmit={createSchedule}>
            <label className="v2-field">
              <span>Listing</span>
              <SelectField
                value={listingId}
                onChange={setListingId}
                placeholder="Choose a listing"
                options={[
                  { value: "", label: "Choose a listing" },
                  ...listingOptions.map((listing) => ({
                    value: listing.id,
                    label: listing.title || "Campus listing",
                    description: `${formatCurrency(listing.price)} / ${listing.area || "Campus"}`,
                  })),
                ]}
              />
            </label>

            <div className="v2-field-grid">
              <label className="v2-field">
                <span>Mode</span>
                <SelectField
                  value={requestedMode}
                  onChange={setRequestedMode}
                  options={[
                    { value: "meetup", label: "Meetup" },
                    { value: "pickup", label: "Pickup" },
                    { value: "campus-drop", label: "Campus drop" },
                    { value: "hostel-meetup", label: "Hostel meetup" },
                  ]}
                />
              </label>
              <label className="v2-field">
                <span>Proposed time</span>
                <input type="datetime-local" min={minMeetupTime} value={proposedTime} onChange={(event) => setProposedTime(event.target.value)} required />
              </label>
            </div>

            <div className="v2-field">
              <span>Meetup location</span>
              <div className="v2-geo-card">
                <div className="v2-geo-card-copy">
                  <strong>{selectedLocation.label}</strong>
                  <span>{formatMeetupLocation(selectedLocation)}</span>
                  <small>
                    {selectedRoute?.originLabel || "Route origin"} / {formatRouteSummary(selectedRoute)} / {formatRouteProvider(selectedRoute?.provider)}
                  </small>
                </div>
                <div className="v2-page-header-actions">
                  <Button type="button" variant="secondary" onClick={openLocationOverlay}>Search or choose on map</Button>
                </div>
              </div>
            </div>

            <div className="v2-route-stat-grid">
              <div className="v2-route-stat">
                <strong>{selectedRoute?.originLabel || "Hostel Sq"}</strong>
                <span>Starting side</span>
              </div>
              <div className="v2-route-stat">
                <strong>{selectedRouteLoading ? "..." : formatDuration(selectedRoute?.durationMinutes || 0)}</strong>
                <span>Estimated walk</span>
              </div>
              <div className="v2-route-stat">
                <strong>{selectedRouteLoading ? "..." : formatMeters(selectedRoute?.distanceMeters || 0)}</strong>
                <span>{selectedRoute?.provider === "tomtom" ? "TomTom path" : "Path length"}</span>
              </div>
            </div>

            <label className="v2-field">
              <span>Notes</span>
              <textarea rows={4} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Confirm inspection spot, timing, and anything the other side should bring." />
            </label>

            <div className="v2-geo-summary">
              <strong>{selectedLocation.label}</strong>
              <span>{formatMeetupLocation(selectedLocation)}</span>
              <small>{selectedRoute?.summary || "Campus route preview unavailable"} / shorthand like tp or lib is recognized and live campus lookup is on.</small>
            </div>

            <Button type="submit" loading={busy === "create"}>Send meetup proposal</Button>
          </form>
        </Surface>

        <Surface title="Upcoming coordination" description="Meetup cards now show route context, confirmation progress, and whether the handoff is only proposed or fully locked.">
          {schedules.length ? (
            <div className="v2-inline-list">
              {schedules
                .slice()
                .sort((left, right) => Date.parse(left.proposedTime) - Date.parse(right.proposedTime))
                .slice(0, 6)
                .map((schedule) => (
                  <div key={schedule.id} className="v2-inline-row v2-inline-row-stack">
                    <div>
                      <strong>{schedule.listingTitle || "Campus listing"}</strong>
                      <span>{statusLabel(schedule.requestedMode)} / {statusLabel(schedule.status)} / {formatDate(schedule.confirmedTime || schedule.proposedTime)}</span>
                      <span>{formatMeetupLocation(schedule.meetupLocation)}</span>
                      {schedule.meetupRoute ? <span>{schedule.meetupRoute.originLabel} / {formatRouteSummary(schedule.meetupRoute)}</span> : null}
                      <span>{scheduleConfirmationSummary(schedule, currentProfileId)}</span>
                    </div>
                    <div className="v2-inline-actions">
                      <Link href={`/listings/${schedule.listingId}`} className="v2-card-icon-button">Listing</Link>
                      {canConfirmSchedule(schedule, currentProfileId) ? (
                        <button type="button" className="v2-card-icon-button" onClick={() => updateSchedule(schedule.id, "confirmed")} disabled={busy === schedule.id}>Confirm</button>
                      ) : null}
                      {canCompleteSchedule(schedule, currentProfileId) ? (
                        <button type="button" className="v2-card-icon-button" onClick={() => updateSchedule(schedule.id, "completed")} disabled={busy === schedule.id}>Complete</button>
                      ) : null}
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <EmptyBlock title="No meetup plans yet" description="Create the first meetup from a listing or from this page." />
          )}
        </Surface>
      </div>

      <ScheduleLocationOverlay
        open={locationOverlayOpen}
        selectedSpotId={draftSpotId}
        selectedLocation={draftSelectedLocation}
        selectedOriginId={draftOriginSpotId}
        route={draftRoute}
        routeLoading={draftRouteLoading}
        customPin={draftCustomPin}
        customLocationHint={draftCustomLocationHint}
        spotSearchValue={spotSearchValue}
        searchResults={searchResults}
        searchBusy={searchBusy}
        locateBusy={locateBusy}
        locateMessage={locateMessage}
        tileUrlTemplate={tomtomTileUrlTemplate}
        onSpotSearchChange={setSpotSearchValue}
        onClose={() => setLocationOverlayOpen(false)}
        onPickSpot={(spotId) => {
          setDraftSpotId(spotId);
          setDraftSearchLocation(null);
          setSpotSearchValue(spotId === "custom-pin" ? "Custom pin" : getSpotById(spotId).shortLabel);
        }}
        onPickSearchResult={(result) => {
          if (result.zoneId && CAMPUS_SPOTS.some((spot) => spot.id === result.zoneId)) {
            setDraftSpotId(result.zoneId);
            setDraftSearchLocation(null);
            setDraftCustomLocationHint(result.addressHint || "");
          } else {
            setDraftSpotId("custom-pin");
            setDraftSearchLocation(result);
            setDraftCustomPin({
              latitude: Number(result.latitude),
              longitude: Number(result.longitude),
            });
            setDraftCustomLocationHint(result.addressHint || result.label || "");
          }
          setSpotSearchValue(result.shortLabel || result.label || "");
        }}
        onPickOrigin={setDraftOriginSpotId}
        onUseMyLocation={useCurrentLocation}
        onPickCustomPin={(pin) => {
          setDraftSpotId("custom-pin");
          hydrateCustomPin(pin).catch(() => {
            setDraftSearchLocation(null);
            setDraftCustomPin(pin);
            setSpotSearchValue("Custom pin");
          });
        }}
        onCustomLocationHintChange={setDraftCustomLocationHint}
        onConfirm={confirmLocationSelection}
      />
    </div>
  );
}
