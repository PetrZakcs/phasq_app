'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { getAnalyses, Analysis } from '@/lib/data';
import { FileText, Download, Play, Search, Target } from 'lucide-react';

export default function ReportsPage() {
  const [reports, setReports] = useState<Analysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');

  useEffect(() => {
    async function loadReports() {
      try {
        const loadedAnalyses = await getAnalyses();
        // Show only completed analyses which have visual results & reports
        setReports(loadedAnalyses.filter((a) => a.status === 'completed'));
      } catch (err) {
        console.error('Error loading reports', err);
      } finally {
        setLoading(false);
      }
    }
    loadReports();
  }, []);

  if (loading) {
    return (
      <div className="flex-1 flex flex-col justify-center items-center bg-bg-primary font-mono text-xs text-accent-primary">
        <span>FETCHING_COMPLETED_REPORTS...</span>
      </div>
    );
  }

  // Filter reports
  const filteredReports = reports.filter((r) => {
    const matchesSearch = 
      r.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      (r.aoi_name && r.aoi_name.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesType = filterType === 'all' || r.analysis_type === filterType;
    
    return matchesSearch && matchesType;
  });

  return (
    <div className="flex-1 bg-bg-primary py-8 px-4 sm:px-6 lg:px-8 font-display select-none">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Title */}
        <div className="border-b border-border-default pb-5">
          <h1 className="text-2xl font-bold tracking-wider font-mono">REPORTS_ARCHIVE_CONSOLE</h1>
          <p className="text-xs text-text-secondary font-mono mt-1">// OPERATIONAL RECORDS & EXPORTS</p>
        </div>

        {/* Filters and search toolbar */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-bg-secondary border border-border-default rounded-sm p-4">
          
          {/* Search bar */}
          <div className="relative flex items-center md:col-span-2">
            <Search className="absolute left-3 w-4 h-4 text-text-secondary pointer-events-none" />
            <input
              type="text"
              placeholder="Search by sector name or job title..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-bg-primary border border-border-default hover:border-text-muted focus:border-accent-primary rounded-sm pl-10 pr-4 py-2 text-xs font-mono text-text-primary focus:outline-none transition-colors min-h-[38px]"
            />
          </div>

          {/* Filter selection */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="bg-bg-primary border border-border-default hover:border-text-muted focus:border-accent-primary rounded-sm px-3 py-2 text-xs font-mono text-text-primary focus:outline-none transition-colors cursor-pointer min-h-[38px]"
          >
            <option value="all">ALL_TELEM_INDICES</option>
            <option value="ndvi">SENTINEL-2 NDVI (VEGETATION)</option>
            <option value="ndwi">SENTINEL-2 NDWI (WATER)</option>
            <option value="radiometric">SENTINEL-1 SAR (MOISTURE)</option>
            <option value="polarimetric">SENTINEL-1 POLSAR (BIOMASS)</option>
            <option value="interferometric">SENTINEL-1 INSAR (SUBSIDENCE)</option>
          </select>
        </div>

        {/* Reports log list */}
        <div className="bg-bg-secondary border border-border-default rounded-sm p-5">
          {filteredReports.length === 0 ? (
            <div className="py-12 text-center font-mono text-[10px] text-text-muted">
              NO_MATCHING_REPORTS_FOUND_IN_ARCHIVE
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse font-mono text-xs">
                <thead>
                  <tr className="border-b border-border-subtle text-text-secondary text-[10px]">
                    <th className="py-2.5 font-semibold">REPORT / JOB_NAME</th>
                    <th className="py-2.5 font-semibold">SECTOR</th>
                    <th className="py-2.5 font-semibold">TYPE</th>
                    <th className="py-2.5 font-semibold">DATE_GENERATED</th>
                    <th className="py-2.5 font-semibold text-right">ACTION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle/50 text-text-secondary">
                  {filteredReports.map((r) => (
                    <tr key={r.id} className="hover:bg-bg-elevated/30 transition-colors">
                      <td className="py-3.5 flex items-center space-x-2 font-semibold text-text-primary">
                        <FileText className="w-4 h-4 text-accent-primary flex-shrink-0" />
                        <span>{r.name.toUpperCase()}</span>
                      </td>
                      <td className="py-3.5">{r.aoi_name}</td>
                      <td className="py-3.5">
                        <span className="px-1.5 py-0.5 border border-border-subtle text-[9px] rounded-sm bg-bg-surface text-text-primary">
                          {r.analysis_type.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3.5 text-[10px]">
                        {new Date(r.completed_at || r.created_at).toLocaleString()}
                      </td>
                      <td className="py-3.5 text-right space-x-3">
                        <Link
                          href={`/analysis/${r.id}`}
                          className="inline-flex items-center text-accent-primary hover:underline text-[10px]"
                        >
                          OPEN <Play className="w-2.5 h-2.5 ml-1" />
                        </Link>
                        <button
                          onClick={() => window.print()}
                          className="inline-flex items-center text-text-primary hover:text-accent-primary text-[10px] cursor-pointer"
                        >
                          PDF <Download className="w-2.5 h-2.5 ml-1" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
