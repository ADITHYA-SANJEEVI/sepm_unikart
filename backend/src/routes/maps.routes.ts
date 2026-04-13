import { Router } from "express";
import { z } from "zod";

import {
  calculateCampusWalkingRoute,
  getCampusTile,
  reverseGeocodeCampusLocation,
  searchCampusLocations,
} from "../services/maps.service";

const searchQuerySchema = z.object({
  q: z.string().trim().max(160).optional(),
});

const reverseQuerySchema = z.object({
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
});

const routeQuerySchema = z.object({
  originLatitude: z.coerce.number().min(-90).max(90),
  originLongitude: z.coerce.number().min(-180).max(180),
  originLabel: z.string().trim().max(160).optional(),
  destinationLatitude: z.coerce.number().min(-90).max(90),
  destinationLongitude: z.coerce.number().min(-180).max(180),
  destinationLabel: z.string().trim().max(160).optional(),
});

const routePointSchema = z.object({
  label: z.string().trim().max(160).optional().nullable(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

const routeBodySchema = z.object({
  origin: routePointSchema,
  destination: routePointSchema,
});

const tileParamsSchema = z.object({
  z: z.coerce.number().int().min(0).max(22),
  x: z.coerce.number().int().min(0),
  y: z.coerce.number().int().min(0),
});

const tileQuerySchema = z.object({
  style: z.string().trim().max(64).optional(),
});

export const mapsRouter = Router();

mapsRouter.get("/tiles/:z/:x/:y.png", async (request, response, next) => {
  const paramsResult = tileParamsSchema.safeParse(request.params);
  const queryResult = tileQuerySchema.safeParse(request.query);
  if (!paramsResult.success || !queryResult.success) {
    return response.status(400).json({
      success: false,
      error: {
        code: "INVALID_MAP_TILE_REQUEST",
        message: "A valid tile request is required.",
        details: {
          params: paramsResult.success ? undefined : paramsResult.error.flatten(),
          query: queryResult.success ? undefined : queryResult.error.flatten(),
        },
      },
    });
  }

  try {
    const tile = await getCampusTile(
      paramsResult.data.z,
      paramsResult.data.x,
      paramsResult.data.y,
      queryResult.data.style,
    );
    response.setHeader("Content-Type", tile.contentType);
    response.setHeader("Cache-Control", "public, max-age=1800, stale-while-revalidate=86400");
    return response.send(tile.buffer);
  } catch (error) {
    return next(error);
  }
});

mapsRouter.get("/search", async (request, response, next) => {
  const parseResult = searchQuerySchema.safeParse(request.query);
  if (!parseResult.success) {
    return response.status(400).json({
      success: false,
      error: {
        code: "INVALID_MAP_SEARCH_QUERY",
        message: "A valid campus search query is required.",
        details: parseResult.error.flatten(),
      },
    });
  }

  try {
    const results = await searchCampusLocations(parseResult.data.q || "");
    return response.json({ success: true, data: results });
  } catch (error) {
    return next(error);
  }
});

mapsRouter.get("/reverse", async (request, response, next) => {
  const parseResult = reverseQuerySchema.safeParse(request.query);
  if (!parseResult.success) {
    return response.status(400).json({
      success: false,
      error: {
        code: "INVALID_MAP_REVERSE_QUERY",
        message: "Valid campus coordinates are required.",
        details: parseResult.error.flatten(),
      },
    });
  }

  try {
    const data = await reverseGeocodeCampusLocation(
      parseResult.data.latitude,
      parseResult.data.longitude,
    );
    return response.json({ success: true, data });
  } catch (error) {
    return next(error);
  }
});

mapsRouter.get("/route", async (request, response, next) => {
  const parseResult = routeQuerySchema.safeParse(request.query);
  if (!parseResult.success) {
    return response.status(400).json({
      success: false,
      error: {
        code: "INVALID_MAP_ROUTE_QUERY",
        message: "A valid campus route query is required.",
        details: parseResult.error.flatten(),
      },
    });
  }

  try {
    const data = await calculateCampusWalkingRoute(
      {
        label: parseResult.data.originLabel || null,
        latitude: parseResult.data.originLatitude,
        longitude: parseResult.data.originLongitude,
      },
      {
        label: parseResult.data.destinationLabel || null,
        latitude: parseResult.data.destinationLatitude,
        longitude: parseResult.data.destinationLongitude,
      },
    );
    return response.json({ success: true, data });
  } catch (error) {
    return next(error);
  }
});

mapsRouter.post("/route", async (request, response, next) => {
  const parseResult = routeBodySchema.safeParse(request.body);
  if (!parseResult.success) {
    return response.status(400).json({
      success: false,
      error: {
        code: "INVALID_MAP_ROUTE_REQUEST",
        message: "A valid campus route payload is required.",
        details: parseResult.error.flatten(),
      },
    });
  }

  try {
    const data = await calculateCampusWalkingRoute(
      parseResult.data.origin,
      parseResult.data.destination,
    );
    return response.json({ success: true, data });
  } catch (error) {
    return next(error);
  }
});
