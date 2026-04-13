"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";

const CAMPUS_BOUNDS = [
  [12.8204, 80.0418],
  [12.8262, 80.0474],
];

const CAMPUS_CENTER = [12.8231, 80.0444];
let leafletWarmed = false;

function buildDivIcon(className, label) {
  return L.divIcon({
    className: "v2-leaflet-icon-root",
    html: `<span class="${className}"></span>${label ? `<small>${label}</small>` : ""}`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
}

export function TomTomCampusMap({
  tileUrlTemplate,
  selectedSpotId,
  selectedLocation,
  selectedOriginId,
  customPin,
  route,
  onPickSpot,
  onPickCustomPin,
  spots = [],
  readonly = false,
}) {
  const mapNodeRef = useRef(null);
  const mapRef = useRef(null);
  const layerGroupRef = useRef(null);
  const [mapLoading, setMapLoading] = useState(true);
  const [mapError, setMapError] = useState("");

  useEffect(() => {
    if (!tileUrlTemplate) {
      setMapLoading(false);
      setMapError("TomTom tile service is not configured.");
      return;
    }
    if (!mapNodeRef.current || mapRef.current) return;

    if (!leafletWarmed) {
      setMapLoading(true);
      leafletWarmed = true;
    }
    setMapError("");

    const map = L.map(mapNodeRef.current, {
      center: CAMPUS_CENTER,
      zoom: 17,
      minZoom: 16,
      maxZoom: 19,
      zoomControl: false,
      attributionControl: false,
      maxBounds: CAMPUS_BOUNDS,
      maxBoundsViscosity: 1,
      dragging: !readonly,
      touchZoom: !readonly,
      doubleClickZoom: !readonly,
      scrollWheelZoom: !readonly,
      boxZoom: !readonly,
      keyboard: !readonly,
    });

    if (!readonly) {
      L.control
        .zoom({
          position: "bottomright",
        })
        .addTo(map);
    }

    const invalidateTimers = [];
    const queueInvalidate = (delay = 0) => {
      const timer = window.setTimeout(() => {
        map.invalidateSize({ pan: false, animate: false });
      }, delay);
      invalidateTimers.push(timer);
    };

    const tileLayer = L.tileLayer(
      tileUrlTemplate,
      {
        tileSize: 256,
        crossOrigin: true,
        updateWhenIdle: false,
        keepBuffer: 4,
      },
    );
    tileLayer.on("loading", () => {
      setMapLoading(true);
      setMapError("");
    });
    tileLayer.on("load", () => {
      setMapLoading(false);
      setMapError("");
      queueInvalidate(0);
    });
    tileLayer.on("tileerror", () => {
      setMapLoading(false);
      setMapError("TomTom tiles could not load. Refresh after the frontend restarts with the public map key.");
    });
    tileLayer.addTo(map);

    map.whenReady(() => {
      queueInvalidate(0);
      queueInvalidate(120);
      queueInvalidate(360);
    });

    if (!readonly) {
      map.on("click", (event) => {
        onPickCustomPin?.({
          latitude: Number(event.latlng.lat.toFixed(6)),
          longitude: Number(event.latlng.lng.toFixed(6)),
        });
      });
    }

    layerGroupRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    return () => {
      invalidateTimers.forEach((timer) => window.clearTimeout(timer));
      map.remove();
      mapRef.current = null;
      layerGroupRef.current = null;
    };
  }, [tileUrlTemplate, onPickCustomPin]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const timer = window.setTimeout(() => {
      map.invalidateSize({ pan: false, animate: false });
    }, 40);
    return () => window.clearTimeout(timer);
  }, [selectedSpotId, selectedOriginId, selectedLocation, route]);

  useEffect(() => {
    const map = mapRef.current;
    const layerGroup = layerGroupRef.current;
    if (!map || !layerGroup) return;

    layerGroup.clearLayers();

    const bounds = [];
    const originMarkerSpot = spots.find((spot) => spot.id === selectedOriginId) || null;

    if (originMarkerSpot) {
      const marker = L.marker([originMarkerSpot.latitude, originMarkerSpot.longitude], {
        icon: buildDivIcon("v2-leaflet-marker-origin", originMarkerSpot.shortLabel),
      });
      marker.addTo(layerGroup);
      bounds.push([originMarkerSpot.latitude, originMarkerSpot.longitude]);
    }

    for (const spot of spots) {
      const isSelected = selectedSpotId === spot.id;
      const isOrigin = selectedOriginId === spot.id;
      const marker = L.marker([spot.latitude, spot.longitude], {
        icon: buildDivIcon(
          isOrigin
            ? "v2-leaflet-marker-origin"
            : isSelected
              ? "v2-leaflet-marker-selected"
              : "v2-leaflet-marker-spot",
          spot.shortLabel,
        ),
      });
      if (!readonly) {
        marker.on("click", () => onPickSpot?.(spot.id));
      }
      marker.addTo(layerGroup);
    }

    if (selectedSpotId === "custom-pin") {
      const lat =
        selectedLocation?.latitude ?? customPin?.latitude ?? CAMPUS_CENTER[0];
      const lon =
        selectedLocation?.longitude ?? customPin?.longitude ?? CAMPUS_CENTER[1];
      const marker = L.marker([lat, lon], {
        icon: buildDivIcon("v2-leaflet-marker-custom", "Pin"),
      });
      marker.addTo(layerGroup);
      bounds.push([lat, lon]);
    }

    const pathPoints = Array.isArray(route?.path)
      ? route.path
          .map((point) => [Number(point.latitude), Number(point.longitude)])
          .filter((point) => Number.isFinite(point[0]) && Number.isFinite(point[1]))
      : [];

    if (pathPoints.length >= 2) {
      L.polyline(pathPoints, {
        color: "rgba(255,255,255,0.92)",
        weight: 9,
        opacity: 0.42,
        lineCap: "round",
        lineJoin: "round",
      }).addTo(layerGroup);
      L.polyline(pathPoints, {
        color: "#7C3AED",
        weight: 5,
        opacity: 0.95,
        lineCap: "round",
        lineJoin: "round",
      }).addTo(layerGroup);
      bounds.push(...pathPoints);
    }

    if (selectedLocation?.latitude && selectedLocation?.longitude) {
      bounds.push([selectedLocation.latitude, selectedLocation.longitude]);
    }

    if (bounds.length) {
      map.fitBounds(bounds, { padding: [34, 34], maxZoom: 18, animate: true, duration: 0.45 });
      return;
    }

    map.setView(CAMPUS_CENTER, 17, { animate: true });
  }, [
    customPin,
    onPickSpot,
    route,
    selectedLocation,
    selectedOriginId,
    selectedSpotId,
    spots,
  ]);

  return (
    <>
      <div ref={mapNodeRef} className="v2-leaflet-map" aria-label="Interactive SRM KTR meetup map" />
      {mapError ? (
        <div className="v2-map-loading-overlay">
          <div className="v2-map-loading-card v2-map-loading-card-error">
            <strong>Map unavailable</strong>
            <span>{mapError}</span>
          </div>
        </div>
      ) : null}
      {mapLoading ? (
        <div className="v2-map-loading-overlay">
          <div className="v2-map-loading-card">
            <strong>Loading live campus map</strong>
            <span>Fetching TomTom tiles and route geometry for SRM KTR.</span>
          </div>
        </div>
      ) : null}
    </>
  );
}
