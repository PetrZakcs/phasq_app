'use client';

import React, { useState, useRef, useEffect } from 'react';
import { calculatePolygonArea } from '@/lib/geo';
import { MapPin, Crosshair, Check, RotateCcw, AlertCircle, HelpCircle } from 'lucide-react';

import 'maplibre-gl/dist/maplibre-gl.css';

interface AoiDrawerMapProps {
  onPolygonCreated: (geojson: any, areaHa: number) => void;
  maxQuota: number;
  initialGeometry?: any;
  mapCenterLngLat?: [number, number];
}

export default function AoiDrawerMap({ onPolygonCreated, maxQuota, initialGeometry, mapCenterLngLat }: AoiDrawerMapProps) {
  const [mapLoaded, setMapLoaded] = useState(false);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  
  const [coords, setCoords] = useState<[number, number][]>([]);
  const [isClosed, setIsClosed] = useState(false);
  const [area, setArea] = useState(0);

  // Ref to store coordinates/isClosed for map click callback closures
  const stateRef = useRef({ coords: [] as [number, number][], isClosed: false });

  useEffect(() => {
    stateRef.current = { coords, isClosed };
  }, [coords, isClosed]);

  // 1. Initialize MapLibre GL Map
  useEffect(() => {
    if (typeof window === 'undefined' || !mapContainerRef.current) return;

    // Load MapLibre GL dynamically to prevent SSR failures
    const maplibregl = require('maplibre-gl');

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: {
        version: 8,
        sources: {
          'esri-satellite': {
            type: 'raster',
            tiles: [
              'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
            ],
            tileSize: 256,
            attribution: 'Esri, Maxar'
          },
          'esri-labels': {
            type: 'raster',
            tiles: [
              'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}'
            ],
            tileSize: 256
          }
        },
        layers: [
          {
            id: 'esri-satellite-layer',
            type: 'raster',
            source: 'esri-satellite',
            minzoom: 0,
            maxzoom: 20
          },
          {
            id: 'esri-labels-layer',
            type: 'raster',
            source: 'esri-labels',
            minzoom: 0,
            maxzoom: 20
          }
        ]
      },
      center: [15.60, 49.40], // Centered around Jihlava/Vysočina, Czech Republic
      zoom: 13,
      attributionControl: false
    });

    mapRef.current = map;

    map.on('load', () => {
      setMapLoaded(true);

      // Add GeoJSON source for custom polygon drawing
      map.addSource('drawn-polygon', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: []
        }
      });

      // Polygon interior fill
      map.addLayer({
        id: 'drawn-polygon-fill',
        type: 'fill',
        source: 'drawn-polygon',
        paint: {
          'fill-color': '#cc0000',
          'fill-opacity': 0.15
        },
        filter: ['==', '$type', 'Polygon']
      });

      // Line outlines
      map.addLayer({
        id: 'drawn-polygon-outline',
        type: 'line',
        source: 'drawn-polygon',
        paint: {
          'line-color': '#cc0000',
          'line-width': 2.5
        }
      });

      // Vertices circles
      map.addLayer({
        id: 'drawn-polygon-points',
        type: 'circle',
        source: 'drawn-polygon',
        paint: {
          'circle-radius': 5,
          'circle-color': '#cc0000',
          'circle-stroke-color': '#000000',
          'circle-stroke-width': 1.5
        },
        filter: ['==', '$type', 'Point']
      });

      // Snap target (First point) indicator
      map.addLayer({
        id: 'drawn-polygon-first-point',
        type: 'circle',
        source: 'drawn-polygon',
        paint: {
          'circle-radius': 7,
          'circle-color': '#ff9500',
          'circle-stroke-color': '#000000',
          'circle-stroke-width': 2
        },
        filter: ['==', 'isFirst', true]
      });
    });

    // Map Click: place coordinate point
    map.on('click', (e: any) => {
      const { coords: currentCoords, isClosed: currentClosed } = stateRef.current;
      if (currentClosed) return;

      // Snap-to-first-vertex check (closes polygon if clicks is close to first vertex)
      if (currentCoords.length >= 3) {
        const firstPointPix = map.project(currentCoords[0]);
        const mousePix = e.point;
        const dist = Math.hypot(firstPointPix.x - mousePix.x, firstPointPix.y - mousePix.y);

        if (dist < 15) {
          setIsClosed(true);
          const closedCoords = [...currentCoords, currentCoords[0]];
          const computedArea = calculatePolygonArea(closedCoords);
          setArea(computedArea);

          const geojson = {
            type: 'Polygon',
            coordinates: [closedCoords]
          };
          onPolygonCreated(geojson, computedArea);
          return;
        }
      }

      // Append standard coordinate point
      const newCoord: [number, number] = [e.lngLat.lng, e.lngLat.lat];
      setCoords([...currentCoords, newCoord]);
    });

    // Mouse Move: pointer update on snap hover
    map.on('mousemove', (e: any) => {
      const { coords: currentCoords, isClosed: currentClosed } = stateRef.current;
      if (currentClosed || currentCoords.length < 3) {
        map.getCanvas().style.cursor = 'crosshair';
        return;
      }

      const firstPointPix = map.project(currentCoords[0]);
      const dist = Math.hypot(firstPointPix.x - e.point.x, firstPointPix.y - e.point.y);

      if (dist < 15) {
        map.getCanvas().style.cursor = 'pointer';
      } else {
        map.getCanvas().style.cursor = 'crosshair';
      }
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // 2. Synchronize coordinates states into map geojson source
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    const source = map.getSource('drawn-polygon');
    if (!source) return;

    const features: any[] = [];

    // Map individual coordinates to point features
    coords.forEach((c, idx) => {
      features.push({
        type: 'Feature',
        properties: {
          isFirst: idx === 0 && !isClosed && coords.length >= 3
        },
        geometry: {
          type: 'Point',
          coordinates: c
        }
      });
    });

    // Map paths / polygon shape
    if (coords.length > 1) {
      if (isClosed) {
        features.push({
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'Polygon',
            coordinates: [[...coords, coords[0]]]
          }
        });
      } else {
        features.push({
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: coords
          }
        });
      }
    }

    source.setData({
      type: 'FeatureCollection',
      features
    });
  }, [coords, isClosed, mapLoaded]);

  // 3. Handle external geometry changes (e.g. LPIS search selection)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    if (!initialGeometry || !initialGeometry.coordinates || !initialGeometry.coordinates[0]) {
      if (initialGeometry === null && isClosed) {
        setCoords([]);
        setIsClosed(false);
        setArea(0);
        onPolygonCreated(null, 0);
      }
      return;
    }

    const polygonCoords = initialGeometry.coordinates[0];
    const rawCoords = polygonCoords.slice(0, -1);

    if (rawCoords.length > 0) {
      setCoords(rawCoords);
      setIsClosed(true);

      const computedArea = calculatePolygonArea(polygonCoords);
      setArea(computedArea);

      // Fit map canvas viewport around the injected coordinates
      const maplibregl = require('maplibre-gl');
      const bounds = rawCoords.reduce(
        (b: any, coord: any) => b.extend(coord),
        new maplibregl.LngLatBounds(rawCoords[0], rawCoords[0])
      );

      map.fitBounds(bounds, { padding: 50, duration: 1200 });
    }
  }, [initialGeometry, mapLoaded]);

  // 4. Handle fly-to coordinate updates from parent geocoding queries
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded || !mapCenterLngLat) return;

    map.flyTo({
      center: mapCenterLngLat,
      zoom: 15,
      duration: 1500
    });
  }, [mapCenterLngLat, mapLoaded]);

  const handleReset = () => {
    setCoords([]);
    setIsClosed(false);
    setArea(0);
    onPolygonCreated(null, 0);
  };

  return (
    <div className="flex-grow flex flex-col relative bg-bg-primary rounded-sm border border-border-default overflow-hidden min-h-[450px]">
      
      {/* MapContainer Reference */}
      <div
        ref={mapContainerRef}
        className="w-full h-full relative z-0"
      />

      {/* Target Crosshairs */}
      <div className="absolute top-4 left-4 font-mono text-[9px] text-text-secondary bg-bg-surface/90 border border-border-subtle rounded-sm px-2.5 py-1.5 space-y-1 z-10">
        <div className="flex items-center space-x-1">
          <Crosshair className="w-3 h-3 text-accent-primary animate-pulse" />
          <span>GRID: CZECH_REPUBLIC_ESRI_HYBRID</span>
        </div>
        <p className="text-[8px] text-text-muted">// CLICK SATELLITE TO PLACE SECTOR VERTICES</p>
      </div>

      {/* Reset control */}
      <div className="absolute bottom-4 right-4 flex space-x-2 z-10">
        <button
          type="button"
          onClick={handleReset}
          className="bg-bg-surface hover:bg-bg-elevated border border-border-default rounded-sm px-3 py-1.5 text-[10px] font-mono tracking-wider flex items-center space-x-1 cursor-pointer transition-colors"
        >
          <RotateCcw className="w-3 h-3 text-accent-primary" />
          <span>RESET_BOARD</span>
        </button>
      </div>

      {/* Info indicator */}
      <div className="absolute bottom-4 left-4 z-10">
        {coords.length === 0 ? (
          <div className="bg-bg-surface/90 border border-border-subtle rounded-sm px-3 py-2 text-[10px] font-mono text-text-secondary flex items-center space-x-1.5">
            <HelpCircle className="w-3.5 h-3.5 text-accent-primary" />
            <span>Click 3+ points on map, then click orange starting node to lock bounds.</span>
          </div>
        ) : isClosed ? (
          <div className="bg-accent-primary/10 border border-accent-primary/30 rounded-sm px-3 py-2 text-[10px] font-mono text-accent-primary flex items-center space-x-1.5">
            <Check className="w-3.5 h-3.5" />
            <span>BOUNDS SECURED // AREA: {area.toFixed(2)} ha</span>
          </div>
        ) : (
          <div className="bg-bg-surface/90 border border-border-subtle rounded-sm px-3 py-2 text-[10px] font-mono text-text-primary flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-sm bg-accent-warning animate-pulse" />
            <span>PLACING NODES: {coords.length} ({coords[coords.length - 1]?.[1].toFixed(4)}°N, {coords[coords.length - 1]?.[0].toFixed(4)}°E)</span>
          </div>
        )}
      </div>

      {/* Warning indicator */}
      {area > maxQuota && (
        <div className="absolute top-4 right-4 bg-accent-danger/10 border border-accent-danger/30 rounded-sm p-2 text-[10px] font-mono text-accent-danger flex items-center space-x-1.5 z-10">
          <AlertCircle className="w-3.5 h-3.5" />
          <span>QUOTA EXCEEDED (Max: {maxQuota} ha)</span>
        </div>
      )}
    </div>
  );
}
