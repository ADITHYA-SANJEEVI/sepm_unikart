/**
 * Campus Safe Zones — Single source of truth for all campus meetup locations.
 *
 * Every component that references campus spots, meetup locations, or map markers
 * should import from this file instead of defining its own copy.
 *
 * Data shape:
 *   id           — unique slug (used as zoneId in meetup payloads)
 *   label        — human-readable full name
 *   shortLabel   — compact display name (for chips, badges, map labels)
 *   latitude     — WGS-84 latitude
 *   longitude    — WGS-84 longitude
 *   x / y        — projected board-coordinates (0-100 range, top-left origin)
 *   addressHint  — short description of the physical location
 *   description  — longer user-facing description (visible in map popups)
 */

export const CAMPUS_CENTER = { latitude: 12.8231, longitude: 80.0444 };

export const CAMPUS_BOUNDS = {
  minLatitude: 12.8204,
  maxLatitude: 12.8262,
  minLongitude: 80.0418,
  maxLongitude: 80.0474,
};

export const CAMPUS_SAFE_ZONES = [
  {
    id: "library-plaza",
    label: "University Library Plaza",
    shortLabel: "Library",
    x: 24,
    y: 34,
    latitude: 12.8239,
    longitude: 80.044,
    addressHint: "Main library front plaza",
    description: "Well-lit open plaza in front of the main library. High foot-traffic during daytime hours.",
  },
  {
    id: "tech-park-gate",
    label: "Tech Park Gate",
    shortLabel: "Tech Park",
    x: 69,
    y: 28,
    latitude: 12.8246,
    longitude: 80.0457,
    addressHint: "Near the tech park side entrance",
    description: "Covered area beside the tech park entrance. CCTV-monitored, open 7 AM – 10 PM.",
  },
  {
    id: "hostel-square",
    label: "Hostel Square",
    shortLabel: "Hostel Sq",
    x: 31,
    y: 71,
    latitude: 12.8219,
    longitude: 80.0435,
    addressHint: "Central hostel common area",
    description: "Central common area between hostels. Security desk nearby, well-lit at night.",
  },
  {
    id: "food-court",
    label: "Food Court Steps",
    shortLabel: "Food Court",
    x: 58,
    y: 58,
    latitude: 12.8225,
    longitude: 80.0451,
    addressHint: "Open seating beside the food court",
    description: "Open seating steps beside the main food court. Busy during lunch and dinner hours.",
  },
  {
    id: "admin-lawn",
    label: "Admin Block Lawn",
    shortLabel: "Admin Lawn",
    x: 47,
    y: 20,
    latitude: 12.8244,
    longitude: 80.0448,
    addressHint: "Open lawn near the admin block",
    description: "Spacious lawn in front of administration. Visible from multiple buildings, well-maintained.",
  },
];

/** Aliases that map shorthand text to canonical spot IDs. */
export const CAMPUS_SPOT_ALIASES = {
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

/** Route-graph nodes (includes safe zones + connecting walkway nodes). */
export const CAMPUS_ROUTE_NODES = [
  ...CAMPUS_SAFE_ZONES,
  { id: "north-walk", label: "North Walk", shortLabel: "North Walk", x: 42, y: 29, latitude: 12.8241, longitude: 80.0446 },
  { id: "central-court", label: "Central Court", shortLabel: "Central Court", x: 48, y: 43, latitude: 12.8232, longitude: 80.0448 },
  { id: "east-walk", label: "East Walk", shortLabel: "East Walk", x: 61, y: 41, latitude: 12.8234, longitude: 80.0452 },
  { id: "south-hub", label: "South Hub", shortLabel: "South Hub", x: 43, y: 61, latitude: 12.8223, longitude: 80.0442 },
];

/** Edges connecting the campus walking graph. */
export const CAMPUS_ROUTE_EDGES = [
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

/** Default origin for route planning. */
export const DEFAULT_ORIGIN_ID = "hostel-square";

/** Average campus walking speed in meters per minute. */
export const WALKING_SPEED_METERS_PER_MINUTE = 78;

/** Look up a safe zone by ID, falling back to the first zone. */
export function getSpotById(spotId) {
  return CAMPUS_SAFE_ZONES.find((spot) => spot.id === spotId) || CAMPUS_SAFE_ZONES[0];
}
