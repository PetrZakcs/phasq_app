'use client';

import React from 'react';
import Link from 'next/link';
import { AOI, SentinelScene, Analysis } from '@/lib/data';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { ArrowLeft, Target, Calendar, BarChart3, Database } from 'lucide-react';

interface AoiDetailViewProps {
  aoi: AOI;
  scenes: SentinelScene[];
  analyses: Analysis[];
}

export default function AoiDetailView({ aoi, scenes, analyses }: AoiDetailViewProps) {
  
  // Format timeseries data from completed analyses
  const chartData = analyses
    .filter((a) => a.status === 'completed' && a.result_data?.timeseries)
    .flatMap((a) => {
      const type = a.analysis_type;
      return a.result_data.timeseries.map((t: any) => ({
        date: t.date,
        value: type === 'ndvi' ? t.ndvi : type === 'ndwi' ? t.ndwi : t.vv_db,
        type: type.toUpperCase(),
      }));
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Split into distinct indices
  const ndviData = chartData.filter((d) => d.type === 'NDVI');
  const ndwiData = chartData.filter((d) => d.type === 'NDWI');
  const sarData = chartData.filter((d) => d.type === 'RADIOMETRIC');

  // Merge them by date
  const uniqueDates = Array.from(new Set(chartData.map((d) => d.date))).sort();
  const mergedChartData = uniqueDates.map((date) => {
    const ndviPoint = ndviData.find((d) => d.date === date);
    const ndwiPoint = ndwiData.find((d) => d.date === date);
    const sarPoint = sarData.find((d) => d.date === date);
    
    return {
      date,
      NDVI: ndviPoint ? ndviPoint.value : null,
      NDWI: ndwiPoint ? ndwiPoint.value : null,
      SAR_VV: sarPoint ? sarPoint.value : null,
    };
  });

  return (
    <div className="flex-grow bg-bg-primary py-6 px-4 sm:px-6 lg:px-8 font-display select-none print:py-0 print:px-0">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Navigation back and quick run */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-border-default pb-4 gap-4">
          <div>
            <Link
              href="/aoi"
              className="flex items-center space-x-1.5 text-text-secondary hover:text-text-primary text-[10px] font-mono mb-1.5 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>RETURN_TO_DIRECTORY</span>
            </Link>
            <h1 className="text-lg font-bold tracking-wider font-mono uppercase">{aoi.name.toUpperCase()}</h1>
            <p className="text-[9px] text-text-secondary font-mono">// SECTOR_UUID: {aoi.id}</p>
          </div>
          <div>
            <Link
              href={`/analysis/new?aoi=${aoi.id}`}
              className="bg-accent-primary hover:bg-accent-primary/95 text-bg-primary px-4 py-2 rounded-sm text-xs font-bold tracking-wider uppercase transition-colors cursor-pointer min-h-[36px] flex items-center"
            >
              <BarChart3 className="w-4 h-4 mr-2" />
              Analyze Sector
            </Link>
          </div>
        </div>

        {/* 2-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left Main Panels */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Quick stats grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-bg-secondary border border-border-default rounded-sm p-4">
                <span className="text-[9px] font-mono text-text-secondary tracking-wider block">SECTOR_AREA</span>
                <div className="text-xl font-bold font-mono text-accent-primary mt-1">{aoi.area_ha} ha</div>
                <p className="text-[8px] text-text-muted mt-2 font-mono">// Total target size</p>
              </div>

              <div className="bg-bg-secondary border border-border-default rounded-sm p-4">
                <span className="text-[9px] font-mono text-text-secondary tracking-wider block">CREATION_STAMP</span>
                <div className="text-xs font-bold font-mono text-text-primary mt-1.5">
                  {new Date(aoi.created_at).toLocaleDateString()}
                </div>
                <p className="text-[8px] text-text-muted mt-2 font-mono">// Operator registration date</p>
              </div>

              <div className="bg-bg-secondary border border-border-default rounded-sm p-4">
                <span className="text-[9px] font-mono text-text-secondary tracking-wider block">GRID_CENTER_REF</span>
                <div className="text-[10px] font-bold font-mono text-text-primary mt-2">
                  {aoi.geometry?.coordinates?.[0]?.[0]?.[1]?.toFixed(4)}°N,{' '}
                  {aoi.geometry?.coordinates?.[0]?.[0]?.[0]?.toFixed(4)}°E
                </div>
                <p className="text-[8px] text-text-muted mt-2.5 font-mono">// WGS84 coordinates reference</p>
              </div>
            </div>

            {/* Historical Telemetry Graph */}
            <div className="bg-bg-secondary border border-border-default rounded-sm p-5 flex flex-col h-[320px]">
              <div className="flex justify-between items-center mb-3 border-b border-border-subtle pb-2">
                <span className="text-xs font-mono tracking-wider text-text-secondary uppercase">
                  Historical Telemetry Index Plots
                </span>
                <span className="text-[9px] font-mono text-text-muted">
                  PLOTTING: VALUES_CHRONO
                </span>
              </div>
              
              {mergedChartData.length === 0 ? (
                <div className="flex-1 flex flex-col justify-center items-center font-mono text-[9px] text-text-muted text-center">
                  <p>NO_TELEMETRY_DATA_RECORDED</p>
                  <p className="text-[8px] mt-1">Run an NDVI, NDWI, or SAR analysis to generate indices.</p>
                </div>
              ) : (
                <div className="flex-1 w-full text-text-secondary font-mono text-[9px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={mergedChartData} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                      <XAxis dataKey="date" stroke="#555" tick={{ fill: '#888' }} />
                      <YAxis stroke="#555" tick={{ fill: '#888' }} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#171c23', borderColor: '#2a3746', color: '#f5f8fa' }}
                        itemStyle={{ fontSize: 9 }}
                      />
                      {ndviData.length > 0 && (
                        <Line
                          type="monotone"
                          dataKey="NDVI"
                          stroke="#0f9960"
                          strokeWidth={1.5}
                          dot={{ r: 3 }}
                        />
                      )}
                      {ndwiData.length > 0 && (
                        <Line
                          type="monotone"
                          dataKey="NDWI"
                          stroke="#106ba3"
                          strokeWidth={1.5}
                          dot={{ r: 3 }}
                        />
                      )}
                      {sarData.length > 0 && (
                        <Line
                          type="monotone"
                          dataKey="SAR_VV"
                          stroke="#d97706"
                          strokeWidth={1.2}
                          dot={{ r: 2 }}
                        />
                      )}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Recent analyses history table */}
            <div className="bg-bg-secondary border border-border-default rounded-sm p-4">
              <div className="flex justify-between items-center mb-3 border-b border-border-subtle pb-2">
                <span className="text-xs font-mono tracking-wider text-text-secondary uppercase">
                  Historical Telemetry Jobs
                </span>
                <span className="text-[9px] font-mono text-text-muted">
                  TOTAL_LOGS: {analyses.length}
                </span>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left font-mono text-[11px]">
                  <thead>
                    <tr className="border-b border-border-subtle text-text-secondary text-[9px] bg-bg-primary/20">
                      <th className="p-3 font-semibold uppercase">Job Name</th>
                      <th className="p-3 font-semibold uppercase">Index</th>
                      <th className="p-3 font-semibold uppercase">Date Executed</th>
                      <th className="p-3 font-semibold uppercase">Status</th>
                      <th className="p-3 font-semibold uppercase text-right">Report</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle/40 text-text-secondary">
                    {analyses.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-4 text-center text-text-muted text-[9px]">
                          NO_RUNS_LOGGED
                        </td>
                      </tr>
                    ) : (
                      analyses.map((a) => (
                        <tr key={a.id} className="hover:bg-bg-surface/30">
                          <td className="p-3 font-semibold text-text-primary">{a.name}</td>
                          <td className="p-3">
                            <span className="px-1.5 py-0.5 border border-border-subtle rounded-sm text-[9px] text-text-primary bg-bg-surface uppercase">
                              {a.analysis_type}
                            </span>
                          </td>
                          <td className="p-3 text-[10px]">
                            {new Date(a.created_at).toLocaleString()}
                          </td>
                          <td className="p-3">
                            <span
                              className={`px-1.5 py-0.5 rounded-sm border text-[9px] font-bold ${
                                a.status === 'completed'
                                  ? 'bg-accent-primary/10 border-accent-primary/20 text-accent-primary'
                                  : 'bg-accent-danger/10 border-accent-danger/20 text-accent-danger'
                              }`}
                            >
                              {a.status.toUpperCase()}
                            </span>
                          </td>
                          <td className="p-3 text-right">
                            <Link href={`/analysis/${a.id}`} className="text-accent-primary hover:underline text-[10px] font-bold">
                              VIEW
                            </Link>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>

          {/* Right sidebar - Sentinel scenes acquisitions */}
          <div className="bg-bg-secondary border border-border-default rounded-sm p-4 flex flex-col h-fit">
            
            <div className="flex justify-between items-center mb-3 border-b border-border-subtle pb-2">
              <span className="text-xs font-mono tracking-wider text-text-secondary uppercase flex items-center">
                <Database className="w-3.5 h-3.5 text-text-muted mr-1.5" />
                Copernicus Acquisitions
              </span>
              <span className="text-[9px] text-text-muted font-mono">// IMAGES: {scenes.length}</span>
            </div>

            <p className="text-[10px] text-text-secondary mb-3 font-mono leading-relaxed">
              Available satellite scenes intersecting with this sector in Google Earth Engine collections cache.
            </p>

            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
              {scenes.map((s) => {
                const isOptical = s.scene_id.includes('S2');
                return (
                  <div
                    key={s.id}
                    className="p-3 border border-border-subtle rounded-sm bg-bg-surface hover:bg-bg-elevated transition-colors font-mono text-[9px]"
                  >
                    <div className="flex justify-between items-start mb-1.5">
                      <span className={`px-1 rounded-sm text-[8px] font-bold ${
                        isOptical ? 'bg-accent-primary/10 text-accent-primary border border-accent-primary/20' : 'bg-accent-info/10 text-accent-info border border-accent-info/20'
                      }`}>
                        {isOptical ? 'S2_OPTICAL' : 'S1_SAR'}
                      </span>
                      <span className="text-text-primary flex items-center">
                        <Calendar className="w-3 h-3 mr-1 text-text-muted" />
                        {s.acquisition_date}
                      </span>
                    </div>
                    <p className="text-text-muted text-[8px] truncate" title={s.scene_id}>
                      ID: {s.scene_id.split('/').pop()}
                    </p>
                    <div className="flex justify-between text-[8px] text-text-muted mt-2 border-t border-border-subtle/30 pt-1.5">
                      <span>ORBIT: {s.orbit_direction}</span>
                      {isOptical ? (
                        <span>CLOUDS: {s.cloud_cover_pct}%</span>
                      ) : (
                        <span>POLAR: {s.polarizations.join('/')}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

          </div>

        </div>

      </div>
    </div>
  );
}
