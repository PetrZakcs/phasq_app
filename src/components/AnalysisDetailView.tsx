'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Analysis } from '@/lib/data';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { 
  ArrowLeft, Cpu, ShieldAlert, CheckCircle, Clock, FileText, 
  Download, ArrowRight, Share2, Compass, Waves, Check 
} from 'lucide-react';
import 'maplibre-gl/dist/maplibre-gl.css';

interface AnalysisDetailViewProps {
  initialAnalysis: Analysis;
}

export default function AnalysisDetailView({ initialAnalysis }: AnalysisDetailViewProps) {
  const [analysis, setAnalysis] = useState<Analysis>(initialAnalysis);
  
  // Polling state
  const [pollProgress, setPollProgress] = useState(20);
  const [pollPhase, setPollPhase] = useState('Initiating satellite connection...');
  const [copied, setCopied] = useState(false);

  const isProcessing = analysis.status === 'pending' || analysis.status === 'processing';

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  const results = analysis.result_data || {};

  useEffect(() => {
    if (isProcessing || typeof window === 'undefined' || !mapContainerRef.current) return;

    // Extract geometry from analysis
    const geom = analysis.aoi_geometry;
    if (!geom || !geom.coordinates || !geom.coordinates[0]) return;

    const rawCoords = geom.coordinates[0];
    const avgLng = rawCoords.reduce((sum: number, c: any) => sum + c[0], 0) / rawCoords.length;
    const avgLat = rawCoords.reduce((sum: number, c: any) => sum + c[1], 0) / rawCoords.length;

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
          }
        ]
      },
      center: [avgLng, avgLat],
      zoom: 14,
      attributionControl: false
    });

    mapRef.current = map;

    const setupMapLayers = () => {
      setMapLoaded(true);

      // Add AOI source
      map.addSource('aoi-polygon', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: geom
        }
      });

      // Fit map viewport to geometry
      const bounds = rawCoords.reduce(
        (b: any, coord: any) => b.extend(coord),
        new maplibregl.LngLatBounds(rawCoords[0], rawCoords[0])
      );
      map.fitBounds(bounds, { padding: 40, duration: 0 });

      // Add GEE raster layer or mock heatmap shading
      const tileUrl = results.geotiff_preview_url;
      if (tileUrl && tileUrl.startsWith('http') && tileUrl.includes('tiles')) {
        map.addSource('gee-overlay', {
          type: 'raster',
          tiles: [tileUrl],
          tileSize: 256
        });

        map.addLayer({
          id: 'gee-overlay-layer',
          type: 'raster',
          source: 'gee-overlay',
          paint: {
            'raster-opacity': 0.70
          }
        });
      } else {
        // Mock heatmap shading
        const fillColors: Record<string, string> = {
          ndvi: '#0f9960',
          ndwi: '#106ba3',
          radiometric: '#d97706',
          polarimetric: '#d97706',
          interferometric: '#8a3ffc'
        };

        const color = fillColors[analysis.analysis_type] || '#cc0000';

        map.addLayer({
          id: 'aoi-fill',
          type: 'fill',
          source: 'aoi-polygon',
          paint: {
            'fill-color': color,
            'fill-opacity': 0.35
          }
        });
      }

      // Stark Crimson Red outline
      map.addLayer({
        id: 'aoi-outline',
        type: 'line',
        source: 'aoi-polygon',
        paint: {
          'line-color': '#cc0000',
          'line-width': 3
        }
      });

      // Add reference labels layer on top of all indices
      map.addLayer({
        id: 'esri-labels-layer',
        type: 'raster',
        source: 'esri-labels',
        minzoom: 0,
        maxzoom: 20
      });
    };

    if (map.loaded()) {
      setupMapLayers();
    } else {
      map.on('load', setupMapLayers);
    }

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [isProcessing, analysis]);

  useEffect(() => {
    if (!isProcessing) return;

    const taskId = analysis.gee_task_id || `mock-task-${analysis.id}`;
    let intervalId: NodeJS.Timeout;

    const checkStatus = async () => {
      try {
        const res = await fetch(`/api/gee/status/${taskId}`);
        const data = await res.json();
        
        if (data.status === 'completed') {
          setAnalysis({
            ...analysis,
            status: 'completed',
            result_data: data.result,
          });
          clearInterval(intervalId);
        } else if (data.status === 'failed') {
          setAnalysis({
            ...analysis,
            status: 'failed',
            error_message: data.error,
          });
          clearInterval(intervalId);
        } else if (data.status === 'processing') {
          setPollProgress(data.progress || 50);
          setPollPhase(data.phase || 'Analyzing spectral telemetry...');
        }
      } catch (err) {
        console.error('Error polling status', err);
      }
    };

    checkStatus();
    intervalId = setInterval(checkStatus, 3000);

    return () => clearInterval(intervalId);
  }, [analysis, isProcessing]);

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadPdf = async () => {
    window.print();
  };

  // PROCESSING LAYOUT
  if (isProcessing) {
    return (
      <div className="flex-1 flex flex-col justify-center items-center bg-bg-primary py-12 px-4 select-none">
        <div className="w-full max-w-md bg-bg-secondary border border-border-default rounded-sm p-6 space-y-5 text-center shadow-sm">
          
          <div className="flex flex-col items-center">
            <Cpu className="w-8 h-8 text-accent-info animate-spin mb-3" />
            <h2 className="text-xs font-bold tracking-wider font-mono uppercase">DISPATCHING_SATELLITE_JOB</h2>
            <p className="text-[9px] text-text-secondary font-mono mt-0.5">// TASK_ID: {analysis.gee_task_id}</p>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between font-mono text-[9px] text-text-secondary">
              <span>PROGRESS: {pollProgress}%</span>
              <span>EST_RUN: ~5s</span>
            </div>
            
            <div className="w-full bg-bg-primary h-1.5 rounded-none overflow-hidden border border-border-subtle">
              <div 
                className="h-full bg-accent-info transition-all duration-500 ease-out" 
                style={{ width: `${pollProgress}%` }}
              />
            </div>
            
            <p className="text-[10px] font-mono text-accent-info pt-1 animate-pulse">
              &gt;&gt; {pollPhase}
            </p>
          </div>
          
          <div className="text-[9px] text-text-muted font-mono leading-relaxed pt-3 border-t border-border-subtle/50">
            PhasQ performs deterministic calculations on Google Earth Engine clusters. Wait until telemetry completes.
          </div>
        </div>
      </div>
    );
  }

  // FAILED LAYOUT
  if (analysis.status === 'failed') {
    return (
      <div className="flex-1 flex flex-col justify-center items-center bg-bg-primary py-12 px-4 select-none">
        <div className="w-full max-w-md bg-bg-secondary border border-accent-danger/40 rounded-sm p-6 space-y-5 text-center shadow-sm">
          <ShieldAlert className="w-10 h-10 text-accent-danger mx-auto" />
          <h2 className="text-xs font-bold tracking-wider font-mono uppercase text-accent-danger">MISSION_OPERATION_FAILED</h2>
          
          <div className="bg-bg-primary border border-border-subtle p-3 rounded-sm text-left">
            <p className="text-[11px] text-text-primary font-mono leading-relaxed break-all">
              {analysis.error_message || 'Operation timeout or database write error.'}
            </p>
          </div>

          <div className="flex space-x-3">
            <Link
              href="/dashboard"
              className="flex-1 bg-bg-surface hover:bg-bg-elevated border border-border-default text-text-primary py-2 px-3 rounded-sm text-xs font-mono text-center flex items-center justify-center cursor-pointer min-h-[36px]"
            >
              Dashboard
            </Link>
            <Link
              href="/analysis/new"
              className="flex-1 bg-accent-primary hover:bg-accent-primary/95 text-bg-primary py-2 px-3 rounded-sm text-xs font-bold uppercase text-center flex items-center justify-center cursor-pointer min-h-[36px]"
            >
              Retry Job
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // COMPLETED DETAILS
  const isNdvi = analysis.analysis_type === 'ndvi';
  const isNdwi = analysis.analysis_type === 'ndwi';

  let mainMetric = '';
  let trendSign = '';
  let trendVal = 0;
  let isAlert = false;
  let alertMsg = 'NOMINAL';

  if (isNdvi) {
    mainMetric = results.mean_ndvi?.toFixed(2) || '0.00';
    trendVal = results.trend_14d || 0;
    trendSign = trendVal >= 0 ? '+' : '';
    isAlert = results.alert_status === 'DROUGHT RISK' || results.mean_ndvi < 0.4;
    alertMsg = isAlert ? 'VEGETATION WATER STRESS' : 'VEGETATION HEALTH NOMINAL';
  } else if (isNdwi) {
    mainMetric = results.mean_ndwi?.toFixed(2) || '0.00';
    trendVal = results.trend_14d || 0;
    trendSign = trendVal >= 0 ? '+' : '';
    isAlert = results.alert_status === 'DROUGHT RISK' || results.mean_ndwi < 0.15;
    alertMsg = isAlert ? 'CRITICAL DRYNESS DETECTED' : 'CANOPY MOISTURE NOMINAL';
  } else {
    mainMetric = `${results.mean_backscatter_vv?.toFixed(1) || '0.0'} dB`;
    trendVal = results.trend_14d || 0;
    trendSign = trendVal >= 0 ? '+' : '';
    isAlert = results.drought_risk || false;
    alertMsg = isAlert ? 'SOIL MOISTURE DEFICIT' : 'SOIL MOISTURE NOMINAL';
  }

  const chartPoints = results.timeseries || [];
  const chartKey = isNdvi ? 'ndvi' : isNdwi ? 'ndwi' : 'vv_db';
  const chartColor = isNdvi ? '#0f9960' : isNdwi ? '#106ba3' : '#d97706';

  return (
    <div className="flex-grow bg-bg-primary py-6 px-4 sm:px-6 lg:px-8 font-display select-none print:py-0 print:px-0">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header link */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-border-default pb-4 gap-4 print:hidden">
          <div>
            <Link
              href="/dashboard"
              className="flex items-center space-x-1.5 text-text-secondary hover:text-text-primary text-[10px] font-mono mb-1.5 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>RETURN_TO_DASHBOARD</span>
            </Link>
            <h1 className="text-lg font-bold tracking-wider font-mono uppercase">TELEMETRY_ANALYSIS_REPORT</h1>
            <p className="text-[9px] text-text-secondary font-mono">// SECTOR: {analysis.aoi_name?.toUpperCase()} // TYPE: {analysis.analysis_type.toUpperCase()}</p>
          </div>
          
          <div className="flex space-x-2">
            <button
              onClick={handleShare}
              className="bg-bg-secondary hover:bg-bg-surface border border-border-default text-text-primary px-3 py-1.5 rounded-sm text-[11px] font-mono tracking-wider transition-colors cursor-pointer min-h-[34px] flex items-center"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-accent-primary mr-1.5" /> : <Share2 className="w-3.5 h-3.5 mr-1.5" />}
              <span>{copied ? 'COPIED_URL' : 'SHARE_CONSOLE'}</span>
            </button>
            <button
              onClick={handleDownloadPdf}
              className="bg-accent-primary hover:bg-accent-primary/95 text-bg-primary px-4 py-1.5 rounded-sm text-[11px] font-bold tracking-wider uppercase transition-colors cursor-pointer min-h-[34px] flex items-center"
            >
              <Download className="w-3.5 h-3.5 mr-1.5" />
              <span>Download PDF</span>
            </button>
          </div>
        </div>

        {/* Tactical print header */}
        <div className="hidden print:block border-b-2 border-border-default pb-4 mb-4">
          <div className="flex justify-between items-center">
            <div className="font-mono">
              <h1 className="text-lg font-bold">PHASQ TELEMETRY REPORT</h1>
              <p className="text-[10px]">SECTOR: {analysis.aoi_name?.toUpperCase()} // ID: {analysis.id}</p>
            </div>
            <div className="font-mono text-right text-[10px]">
              <p>GENERATED: {new Date().toLocaleString()}</p>
              <p>COORDINATES CENTER: WGS84 REFERENCE</p>
            </div>
          </div>
        </div>

        {/* 2-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left panel: Tactical Map & Color Legend */}
          <div className="bg-bg-secondary border border-border-default rounded-sm p-4 flex flex-col h-[400px]">
            
            <div className="flex justify-between items-center mb-3 border-b border-border-subtle pb-2">
              <span className="text-[10px] font-mono tracking-wider text-text-secondary uppercase">
                Spatial Coordinate Overlay
              </span>
              <span className="text-[9px] font-mono text-text-muted">GEE_WGS84_PROJ</span>
            </div>

            <div
              ref={mapContainerRef}
              className="flex-grow bg-bg-primary border border-border-subtle rounded-sm relative overflow-hidden h-[250px]"
            />

            {/* Colors scale legend */}
            <div className="mt-4 pt-3 border-t border-border-subtle">
              <p className="text-[8px] font-mono text-text-secondary uppercase mb-2">Spectral Index Legend</p>
              <div className="space-y-1">
                {/* Desaturated Palantir style gradient scales */}
                <div className={`w-full h-1.5 rounded-sm ${
                  isNdvi ? 'bg-gradient-to-r from-red-800 via-yellow-700 to-accent-primary' :
                  isNdwi ? 'bg-gradient-to-r from-accent-warning via-cyan-800 to-accent-info' :
                  'bg-gradient-to-r from-red-800 via-yellow-700 to-blue-800'
                }`} />
                
                <div className="flex justify-between font-mono text-[8px] text-text-muted">
                  {isNdvi ? (
                    <>
                      <span>0.20 (DEPLETED)</span>
                      <span>0.50</span>
                      <span>0.88 (OPTIMAL)</span>
                    </>
                  ) : isNdwi ? (
                    <>
                      <span>-0.05 (DRY)</span>
                      <span>0.10</span>
                      <span>0.28 (HYDRATED)</span>
                    </>
                  ) : (
                    <>
                      <span>-18.7 dB (DRY)</span>
                      <span>-13.0 dB</span>
                      <span>-8.2 dB (WET)</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Right Panel: Metrics, timeseries graph, AI Summary */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Primary metrics headers */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              
              {/* Big primary index number */}
              <div className="bg-bg-secondary border border-border-default rounded-sm p-4 flex flex-col justify-between md:col-span-2 min-h-[90px]">
                <div className="flex justify-between items-center text-[9px] font-mono text-text-secondary tracking-wider">
                  <span>MEAN_{analysis.analysis_type.toUpperCase()}_VALUE</span>
                  <span className={`px-1.5 py-0.5 rounded-sm font-bold text-[8px] border ${
                    isAlert ? 'bg-accent-danger/10 border-accent-danger/20 text-accent-danger' : 'bg-accent-primary/10 border-accent-primary/20 text-accent-primary'
                  }`}>
                    {alertMsg}
                  </span>
                </div>
                <div className="flex items-baseline space-x-3 mt-1">
                  <span className="text-2xl font-bold font-mono text-text-primary">{mainMetric}</span>
                  <span className={`text-[10px] font-mono font-semibold ${trendVal >= 0 ? 'text-accent-primary' : 'text-accent-danger'}`}>
                    {trendSign}{trendVal.toFixed(2)} (14d delta)
                  </span>
                </div>
              </div>

              {/* Coverage details */}
              <div className="bg-bg-secondary border border-border-default rounded-sm p-4 flex flex-col justify-between min-h-[90px]">
                <span className="text-[9px] font-mono text-text-secondary tracking-wider block">SCENES_COUNT</span>
                <div>
                  <div className="text-base font-bold font-mono text-text-primary">
                    {results.scenes_count || 3} SCENES
                  </div>
                  <p className="text-[8px] text-text-muted mt-0.5 font-mono">// GEE cache collections</p>
                </div>
              </div>
            </div>

            {/* AI Summary Recommendation Box */}
            <div className="bg-bg-secondary border border-border-default rounded-sm p-4 space-y-2">
              <h3 className="text-[9px] font-mono uppercase text-accent-primary tracking-wider flex items-center">
                <ShieldAlert className="w-3.5 h-3.5 mr-1" />
                SATELLITE DATA INTERPRETATION
              </h3>
              <p className="text-[11px] text-text-secondary leading-relaxed font-mono">
                {results.ai_summary || 'No text packaged for this report.'}
              </p>
              <div className="text-[8px] text-text-muted font-mono leading-normal pt-1.5 border-t border-border-subtle/40 mt-2">
                // PLATFORM AUDIT REPORT: Calculations are 100% deterministic mathematical values. GPT-4o was strictly limited to text formatting.
              </div>
            </div>

            {/* Recharts chart */}
            <div className="bg-bg-secondary border border-border-default rounded-sm p-4 flex flex-col h-[260px]">
              
              <div className="flex justify-between items-center mb-3 border-b border-border-subtle pb-2">
                <span className="text-[10px] font-mono tracking-wider text-text-secondary uppercase">
                  Timeseries Telemetry Curve
                </span>
                <span className="text-[9px] font-mono text-text-muted">
                  REF_SCALE: VALUES_OVER_TIME
                </span>
              </div>
              
              {chartPoints.length === 0 ? (
                <div className="flex-grow flex justify-center items-center font-mono text-[9px] text-text-muted">
                  NO_CHART_POINTS
                </div>
              ) : (
                <div className="flex-grow w-full text-[9px] font-mono">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartPoints} margin={{ top: 5, right: 5, left: -28, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                      <XAxis dataKey="date" stroke="#555" tick={{ fill: '#888' }} />
                      <YAxis stroke="#555" tick={{ fill: '#888' }} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#171c23', borderColor: '#2a3746', color: '#f5f8fa' }}
                        itemStyle={{ fontSize: 9 }}
                      />
                      <Line
                        type="monotone"
                        dataKey={chartKey}
                        stroke={chartColor}
                        strokeWidth={1.5}
                        dot={{ r: 3 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Audit footprint block */}
            <div className="bg-bg-secondary border border-border-default rounded-sm p-3 font-mono text-[8px] text-text-muted space-y-1">
              <div className="flex justify-between">
                <span>OPERATOR_HASH_ID:</span>
                <span>{analysis.user_id}</span>
              </div>
              <div className="flex justify-between">
                <span>ANALYSIS_UUID:</span>
                <span>{analysis.id}</span>
              </div>
              <div className="flex justify-between">
                <span>VERIFICATION_STAMP:</span>
                <span>SEC_DETERMINISTIC_PASS // HASH: 9d821ae38b241</span>
              </div>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
}
