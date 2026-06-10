'use client';

import React, { useState, useRef, useEffect } from 'react';
import { calculatePolygonArea } from '@/lib/geo';
import { MapPin, Crosshair, Check, RotateCcw, AlertCircle, HelpCircle } from 'lucide-react';

interface AoiDrawerMapProps {
  onPolygonCreated: (geojson: any, areaHa: number) => void;
  maxQuota: number;
  initialGeometry?: any;
}

export default function AoiDrawerMap({ onPolygonCreated, maxQuota, initialGeometry }: AoiDrawerMapProps) {
  const [points, setPoints] = useState<[number, number][]>([]); // pixel points for rendering
  const [coords, setCoords] = useState<[number, number][]>([]); // projected lat/lng points
  const [isClosed, setIsClosed] = useState(false);
  const [area, setArea] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Default coordinate center (Czech Republic - Vysocina area)
  const [centerLng, setCenterLng] = useState(15.60);
  const [centerLat, setCenterLat] = useState(49.40);
  const mapZoom = 13; // Zoom scale level

  // Convert lat/lng to container pixels (tactical grid map projection)
  const getPixelsFromLatLng = (lng: number, lat: number, width: number, height: number) => {
    // Simple equirectangular projection centered around CR Vysocina coordinates
    const scaleX = (width * mapZoom) / 360;
    const scaleY = (height * mapZoom) / 180;
    
    const x = width / 2 + (lng - centerLng) * scaleX;
    const y = height / 2 - (lat - centerLat) * scaleY;
    return [x, y];
  };

  // Convert container pixels back to lat/lng
  const getLatLngFromPixels = (x: number, y: number, width: number, height: number) => {
    const scaleX = (width * mapZoom) / 360;
    const scaleY = (height * mapZoom) / 180;

    const lng = centerLng + (x - width / 2) / scaleX;
    const lat = centerLat - (y - height / 2) / scaleY;
    
    // Round for precision
    return [Math.round(lng * 10000) / 10000, Math.round(lat * 10000) / 10000] as [number, number];
  };

  // Effect to load initial geometry from parent (e.g. LPIS import)
  useEffect(() => {
    if (!initialGeometry || !initialGeometry.coordinates || !initialGeometry.coordinates[0]) {
      if (initialGeometry === null && isClosed) {
        setPoints([]);
        setCoords([]);
        setIsClosed(false);
        setArea(0);
      }
      return;
    }

    const polygonCoords = initialGeometry.coordinates[0];
    const rawCoords = polygonCoords.slice(0, -1); // Remove closing duplicate point

    if (rawCoords.length > 0) {
      const avgLng = rawCoords.reduce((sum: number, c: any) => sum + c[0], 0) / rawCoords.length;
      const avgLat = rawCoords.reduce((sum: number, c: any) => sum + c[1], 0) / rawCoords.length;
      setCenterLng(avgLng);
      setCenterLat(avgLat);
      setCoords(rawCoords);
      setIsClosed(true);

      const computedArea = calculatePolygonArea(polygonCoords);
      setArea(computedArea);
    }
  }, [initialGeometry]);

  // Recalculate projected pixel coordinates whenever lat/lng coordinates or map center changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const width = canvas.width || canvas.offsetWidth || 500;
    const height = canvas.height || canvas.offsetHeight || 350;

    const projected = coords.map(([lng, lat]) => 
      getPixelsFromLatLng(lng, lat, width, height) as [number, number]
    );
    setPoints(projected);
  }, [coords, centerLng, centerLat]);

  // Redraw canvas loop
  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (points.length === 0) return;

    // Draw polygon interior shadow
    if (isClosed && points.length >= 3) {
      ctx.beginPath();
      ctx.moveTo(points[0][0], points[0][1]);
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i][0], points[i][1]);
      }
      ctx.closePath();
      ctx.fillStyle = 'rgba(204, 0, 0, 0.08)';
      ctx.fill();
    }

    // Draw connecting lines
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i][0], points[i][1]);
    }
    if (isClosed) {
      ctx.closePath();
      ctx.strokeStyle = '#cc0000';
      ctx.lineWidth = 2.5;
    } else {
      ctx.strokeStyle = 'rgba(204, 0, 0, 0.6)';
      ctx.lineWidth = 2;
    }
    ctx.shadowBlur = 8;
    ctx.shadowColor = '#cc0000';
    ctx.stroke();
    ctx.shadowBlur = 0; // reset

    // Draw vertex indicators
    points.forEach((pt, idx) => {
      ctx.beginPath();
      ctx.arc(pt[0], pt[1], idx === 0 && !isClosed ? 6 : 4, 0, 2 * Math.PI);
      if (idx === 0 && !isClosed) {
        ctx.fillStyle = '#ff9500'; // Snap target indicator
      } else {
        ctx.fillStyle = '#cc0000';
      }
      ctx.fill();
      ctx.strokeStyle = '#0a0a0a';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    });
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const updateSize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      draw();
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, [points, isClosed]);

  // Click handler to place vertices
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isClosed) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Check snap-to-first-vertex (closes polygon if points >= 3)
    if (points.length >= 3) {
      const dist = Math.hypot(x - points[0][0], y - points[0][1]);
      if (dist < 15) {
        setIsClosed(true);
        // Compute area in hectares
        const polygonCoords = [...coords, coords[0]];
        const computedArea = calculatePolygonArea(polygonCoords);
        setArea(computedArea);
        
        // Output GeoJSON Polygon format
        const geojson = {
          type: 'Polygon',
          coordinates: [polygonCoords],
        };
        onPolygonCreated(geojson, computedArea);
        return;
      }
    }

    // Place point
    const newPt: [number, number] = [x, y];
    const newCoord = getLatLngFromPixels(x, y, canvas.width, canvas.height);

    setPoints([...points, newPt]);
    setCoords([...coords, newCoord]);
  };

  const handleReset = () => {
    setPoints([]);
    setCoords([]);
    setIsClosed(false);
    setArea(0);
    onPolygonCreated(null, 0);
  };

  return (
    <div className="flex-1 flex flex-col relative bg-bg-primary rounded-sm border border-border-default overflow-hidden min-h-[350px]">
      
      {/* Grid Canvas Overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1b1b1b_1px,transparent_1px),linear-gradient(to_bottom,#1b1b1b_1px,transparent_1px)] bg-[size:1.5rem_1.5rem] opacity-35 pointer-events-none" />
      
      {/* Target Crosshairs */}
      <div className="absolute top-4 left-4 font-mono text-[9px] text-text-secondary bg-bg-surface/80 border border-border-subtle rounded-sm px-2.5 py-1.5 space-y-1 z-10">
        <div className="flex items-center space-x-1">
          <Crosshair className="w-3 h-3 text-accent-primary" />
          <span>GRID: CZECH_REPUBLIC_WGS84</span>
        </div>
        <p className="text-[8px] text-text-muted">// CLICK MAP TO PLACE SECTOR VERTICES</p>
      </div>

      <canvas
        ref={canvasRef}
        onClick={handleCanvasClick}
        className="w-full h-full cursor-crosshair relative z-0"
      />

      {/* Control overlay */}
      <div className="absolute bottom-4 right-4 flex space-x-2 z-10">
        <button
          type="button"
          onClick={handleReset}
          className="bg-bg-surface hover:bg-bg-elevated border border-border-default rounded-sm px-3 py-1.5 text-[10px] font-mono tracking-wider flex items-center space-x-1 cursor-pointer transition-colors"
        >
          <RotateCcw className="w-3 h-3" />
          <span>RESET_BOARD</span>
        </button>
      </div>

      {/* Info indicator */}
      <div className="absolute bottom-4 left-4 z-10">
        {points.length === 0 ? (
          <div className="bg-bg-surface/90 border border-border-subtle rounded-sm px-3 py-2 text-[10px] font-mono text-text-secondary flex items-center space-x-1.5">
            <HelpCircle className="w-3.5 h-3.5 text-accent-info" />
            <span>Click 3 or more points on the grid, then click the orange starting point to close.</span>
          </div>
        ) : isClosed ? (
          <div className="bg-accent-primary/10 border border-accent-primary/30 rounded-sm px-3 py-2 text-[10px] font-mono text-accent-primary flex items-center space-x-1.5">
            <Check className="w-3.5 h-3.5" />
            <span>POLYGON CLOSED // SECTOR AREA: {area} ha</span>
          </div>
        ) : (
          <div className="bg-bg-surface/90 border border-border-subtle rounded-sm px-3 py-2 text-[10px] font-mono text-text-primary flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-sm bg-accent-warning animate-pulse" />
            <span>PLACING VERTICES: {points.length} ({coords[coords.length-1]?.join(', ')})</span>
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
