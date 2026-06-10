'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { getAOIs, getAnalyses, getProfileQuota, AOI, Analysis, Profile } from '@/lib/data';
import { MapPin, Calendar, CheckCircle, Play, AlertTriangle, Cpu, Globe, History, ArrowRight } from 'lucide-react';

export default function DashboardPage() {
  const [aois, setAois] = useState<AOI[]>([]);
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboardData() {
      try {
        const [loadedAois, loadedAnalyses, loadedProfile] = await Promise.all([
          getAOIs(),
          getAnalyses(),
          getProfileQuota(),
        ]);
        setAois(loadedAois);
        setAnalyses(loadedAnalyses);
        setProfile(loadedProfile);
      } catch (err) {
        console.error('Error loading dashboard data', err);
      } finally {
        setLoading(false);
      }
    }
    loadDashboardData();
  }, []);

  if (loading) {
    return (
      <div className="flex-1 flex flex-col justify-center items-center bg-bg-primary font-mono text-xs text-text-secondary space-y-1.5">
        <Cpu className="w-5 h-5 animate-spin" />
        <span>LOAD_SYS_RESOURCES...</span>
      </div>
    );
  }

  // Count parameters
  const activeAoisCount = aois.length;
  const analysesCount = analyses.length;
  const hectareUsed = profile?.hectare_used || 0;
  const hectareQuota = profile?.hectare_quota || 100;
  const quotaPercent = Math.min(100, Math.round((hectareUsed / hectareQuota) * 100));

  const lastAnalysis = analyses[0];
  const lastAnalysisText = lastAnalysis 
    ? `${lastAnalysis.name} - ${lastAnalysis.status.toUpperCase()}`
    : 'NO_ACTIVE_TASKS';

  return (
    <div className="flex-grow bg-bg-primary py-6 px-4 sm:px-6 lg:px-8 select-none">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Dashboard Title & Quick Actions */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-border-default pb-4 gap-4">
          <div>
            <h1 className="text-lg font-bold tracking-wider font-mono uppercase">PHASQ_DASHBOARD_CONSOLE</h1>
            <p className="text-[10px] text-text-secondary font-mono mt-0.5">// OPERATOR NODE: CZECH_REPUBLIC_GRID</p>
          </div>
          <div className="flex space-x-2">
            <Link
              href="/aoi/new"
              className="bg-bg-secondary hover:bg-bg-surface border border-border-default text-text-primary px-3 py-1.5 rounded-sm text-[11px] font-mono tracking-wider transition-colors cursor-pointer min-h-[34px] flex items-center"
            >
              + REGISTER_SECTOR
            </Link>
            <Link
              href="/analysis/new"
              className="bg-accent-primary hover:bg-accent-primary/95 text-bg-primary px-3 py-1.5 rounded-sm text-[11px] font-bold tracking-wider uppercase transition-colors cursor-pointer min-h-[34px] flex items-center"
            >
              Run Analysis
            </Link>
          </div>
        </div>

        {/* Metric cards (4 cards) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Active AOIs */}
          <div className="bg-bg-secondary border border-border-default rounded-sm p-4 flex flex-col justify-between h-[100px]">
            <div className="flex justify-between items-center mb-2">
              <span className="text-[9px] font-mono text-text-secondary tracking-wider">ACTIVE_SECTORS</span>
              <Globe className="w-3.5 h-3.5 text-text-muted" />
            </div>
            <div>
              <div className="text-xl font-bold font-mono text-text-primary">{activeAoisCount}</div>
              <p className="text-[8px] text-text-muted font-mono mt-0.5">// REGISTERED_AOIS</p>
            </div>
          </div>

          {/* Analyses this month */}
          <div className="bg-bg-secondary border border-border-default rounded-sm p-4 flex flex-col justify-between h-[100px]">
            <div className="flex justify-between items-center mb-2">
              <span className="text-[9px] font-mono text-text-secondary tracking-wider">COMPLETED_RUNS</span>
              <History className="w-3.5 h-3.5 text-text-muted" />
            </div>
            <div>
              <div className="text-xl font-bold font-mono text-text-primary">{analysesCount}</div>
              <p className="text-[8px] text-text-muted font-mono mt-0.5">// HISTORICAL_METADATA_JOBS</p>
            </div>
          </div>

          {/* Ha monitored */}
          <div className="bg-bg-secondary border border-border-default rounded-sm p-4 flex flex-col justify-between h-[100px]">
            <div className="flex justify-between items-center mb-2">
              <span className="text-[9px] font-mono text-text-secondary tracking-wider">PLAN_CONSUMPTION</span>
              <MapPin className="w-3.5 h-3.5 text-text-muted" />
            </div>
            <div>
              <div className="text-xl font-bold font-mono text-text-primary">
                {hectareUsed} <span className="text-xs text-text-secondary">/ {hectareQuota} ha</span>
              </div>
              <div className="w-full bg-bg-primary h-1 rounded-none overflow-hidden border border-border-subtle mt-1.5">
                <div className="h-full bg-accent-primary" style={{ width: `${quotaPercent}%` }} />
              </div>
            </div>
          </div>

          {/* Last analysis status */}
          <div className="bg-bg-secondary border border-border-default rounded-sm p-4 flex flex-col justify-between h-[100px]">
            <div className="flex justify-between items-center mb-2">
              <span className="text-[9px] font-mono text-text-secondary tracking-wider">CONSOLE_STATUS</span>
              {lastAnalysis?.status === 'completed' ? (
                <CheckCircle className="w-3.5 h-3.5 text-accent-primary" />
              ) : lastAnalysis?.status === 'failed' ? (
                <AlertTriangle className="w-3.5 h-3.5 text-accent-danger" />
              ) : (
                <Cpu className="w-3.5 h-3.5 text-accent-info animate-pulse" />
              )}
            </div>
            <div>
              <div className="text-[10px] font-bold font-mono truncate text-text-primary uppercase" title={lastAnalysisText}>
                {lastAnalysisText}
              </div>
              <p className="text-[8px] text-text-muted font-mono mt-1">// RUNTIME_STAMP: {lastAnalysis ? new Date(lastAnalysis.created_at).toLocaleDateString() : 'NONE'}</p>
            </div>
          </div>
        </div>

        {/* Mapbox placeholder / visual grid and list grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Tactical map view */}
          <div className="lg:col-span-2 bg-bg-secondary border border-border-default rounded-sm p-4 flex flex-col h-[380px]">
            <div className="flex justify-between items-center mb-3 border-b border-border-subtle pb-2">
              <span className="text-[10px] font-mono tracking-wider text-text-secondary uppercase">
                Active AOI Spatial Coordinates
              </span>
              <span className="text-[9px] font-mono text-text-muted">
                COORDINATES_GRID_WGS84
              </span>
            </div>
            
            <div className="flex-grow bg-bg-primary rounded-sm border border-border-subtle relative overflow-hidden flex flex-col justify-center items-center">
              {/* Tactical grid background */}
              <div className="absolute inset-0 bg-[linear-gradient(to_right,#161d24_1px,transparent_1px),linear-gradient(to_bottom,#161d24_1px,transparent_1px)] bg-[size:2rem_2rem] opacity-55" />
              
              {/* Coordinates display */}
              <div className="z-10 text-center font-mono space-y-4">
                <Globe className="w-6 h-6 text-text-muted mx-auto" />
                <div className="space-y-1">
                  <p className="text-[11px] font-bold text-text-primary uppercase">Sector coordinates grid</p>
                  <p className="text-[9px] text-text-secondary max-w-sm px-4">
                    {aois.length > 0
                      ? `Rendering ${aois.length} defined polygons in GEE database: ` + aois.map((a) => a.name.split(' ')[0]).join(', ')
                      : 'Register coordinate sectors to render overlay.'}
                  </p>
                </div>
                
                {aois.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 justify-center max-w-md px-4">
                    {aois.map((a) => (
                      <Link
                        key={a.id}
                        href={`/aoi/${a.id}`}
                        className="px-2 py-1 bg-bg-secondary hover:bg-bg-surface border border-border-default hover:border-text-secondary text-[9px] text-text-secondary hover:text-text-primary rounded-sm transition-colors cursor-pointer"
                      >
                        {a.name.toUpperCase()} ({a.area_ha} ha)
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              {/* Grid Ref indicator */}
              <div className="absolute bottom-2 left-2 font-mono text-[8px] text-text-muted px-1.5 py-0.5 bg-bg-secondary border border-border-subtle rounded-sm">
                GRID_REF: 33UXQ
              </div>
            </div>
          </div>

          {/* Active AOI List */}
          <div className="bg-bg-secondary border border-border-default rounded-sm p-4 flex flex-col h-[380px]">
            <div className="flex justify-between items-center mb-3 border-b border-border-subtle pb-2">
              <span className="text-[10px] font-mono tracking-wider text-text-secondary uppercase">
                AOI Bounding Sectors
              </span>
              <span className="text-[9px] font-mono text-text-muted font-bold">
                COUNT: {aois.length}
              </span>
            </div>

            <div className="flex-grow overflow-y-auto space-y-2 pr-1">
              {aois.length === 0 ? (
                <div className="h-full flex flex-col justify-center items-center font-mono text-[9px] text-text-muted text-center py-8">
                  <p>NO_AOI_FOUND</p>
                  <Link href="/aoi/new" className="text-accent-primary hover:underline mt-1 font-bold">
                    INITIATE_NEW_SECTOR
                  </Link>
                </div>
              ) : (
                aois.map((a) => (
                  <Link
                    key={a.id}
                    href={`/aoi/${a.id}`}
                    className="block p-3 border border-border-subtle hover:border-text-secondary bg-bg-surface/35 hover:bg-bg-surface rounded-sm transition-all group"
                  >
                    <div className="flex justify-between items-start">
                      <h3 className="font-bold font-mono text-[11px] text-text-primary truncate max-w-[150px]">{a.name.toUpperCase()}</h3>
                      <span className="font-mono text-[10px] text-accent-primary font-semibold">
                        {a.area_ha} ha
                      </span>
                    </div>
                    {a.description && (
                      <p className="text-[9px] text-text-secondary mt-1 line-clamp-1 font-mono">
                        {a.description}
                      </p>
                    )}
                    <div className="flex items-center text-[8px] text-text-muted font-mono mt-3.5 justify-between border-t border-border-subtle/30 pt-2 bg-transparent">
                      <span>CREATED: {new Date(a.created_at).toLocaleDateString()}</span>
                      <span className="text-accent-primary group-hover:translate-x-0.5 transition-transform flex items-center font-bold">
                        OPEN_CONSOLE <ArrowRight className="w-2.5 h-2.5 ml-1" />
                      </span>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Analyses table */}
        <div className="bg-bg-secondary border border-border-default rounded-sm p-4">
          
          <div className="flex justify-between items-center mb-3 border-b border-border-subtle pb-2">
            <span className="text-[10px] font-mono tracking-wider text-text-secondary uppercase">
              Recent Telemetry Job Logs
            </span>
            <span className="text-[8px] font-mono text-text-muted font-bold">
              SYS_OPERATIONAL: S1_S2_CHANNELS
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse font-mono text-[11px]">
              <thead>
                <tr className="border-b border-border-subtle text-text-secondary text-[9px] bg-bg-primary/20">
                  <th className="p-3 font-semibold uppercase">Sector / AOI</th>
                  <th className="p-3 font-semibold uppercase">Analysis Type</th>
                  <th className="p-3 font-semibold uppercase">Date Run</th>
                  <th className="p-3 font-semibold uppercase">Status</th>
                  <th className="p-3 font-semibold uppercase text-right">Report</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle/50 text-text-secondary">
                {analyses.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-text-muted text-[9px]">
                      NO_HISTORICAL_RUNS_RECORDED
                    </td>
                  </tr>
                ) : (
                  analyses.map((a) => (
                    <tr key={a.id} className="hover:bg-bg-surface/30 transition-colors">
                      <td className="p-3 font-semibold text-text-primary">{a.aoi_name}</td>
                      <td className="p-3">
                        <span className="px-1.5 py-0.5 border border-border-subtle text-[9px] rounded-sm bg-bg-surface text-text-primary uppercase">
                          {a.analysis_type}
                        </span>
                      </td>
                      <td className="p-3 text-[10px]">
                        {new Date(a.created_at).toLocaleString()}
                      </td>
                      <td className="p-3">
                        <span
                          className={`inline-flex items-center space-x-1 text-[9px] font-bold px-1.5 py-0.5 rounded-sm border ${
                            a.status === 'completed'
                              ? 'bg-accent-primary/10 border-accent-primary/20 text-accent-primary'
                              : a.status === 'failed'
                              ? 'bg-accent-danger/10 border-accent-danger/20 text-accent-danger'
                              : 'bg-accent-info/10 border-accent-info/20 text-accent-info'
                          }`}
                        >
                          <span>{a.status.toUpperCase()}</span>
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <Link
                          href={`/analysis/${a.id}`}
                          className="inline-flex items-center text-accent-primary hover:underline text-[10px] font-bold"
                        >
                          VIEW_REPORT <Play className="w-2 h-2 ml-1" />
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
    </div>
  );
}
