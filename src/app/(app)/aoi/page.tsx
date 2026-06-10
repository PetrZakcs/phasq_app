'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { getAOIs, AOI } from '@/lib/data';
import { Globe, MapPin, Plus, ArrowRight, Eye, Calendar, AreaChart } from 'lucide-react';

export default function AoiListPage() {
  const [aois, setAois] = useState<AOI[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadAois() {
      try {
        const data = await getAOIs();
        setAois(data);
      } catch (err) {
        console.error('Error fetching AOIs', err);
      } finally {
        setLoading(false);
      }
    }
    loadAois();
  }, []);

  if (loading) {
    return (
      <div className="flex-1 flex flex-col justify-center items-center bg-bg-primary font-mono text-xs text-accent-primary">
        <span>FETCHING_ACTIVE_SECTORS...</span>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-bg-primary py-8 px-4 sm:px-6 lg:px-8 font-display select-none">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header Console */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-border-default pb-4 gap-4">
          <div>
            <h1 className="text-xl font-bold tracking-wider font-mono uppercase">SECTOR_AOI_DIRECTORY</h1>
            <p className="text-xs text-text-secondary font-mono mt-1">// OPERATOR SECTOR LISTING</p>
          </div>
          <Link
            href="/aoi/new"
            className="bg-accent-primary hover:bg-accent-primary/90 text-bg-primary px-4 py-2 rounded-sm text-xs font-bold tracking-wider uppercase transition-colors cursor-pointer min-h-[38px] flex items-center"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            <span>Define New Sector</span>
          </Link>
        </div>

        {/* Directory Layout */}
        <div className="bg-bg-secondary border border-border-default rounded-sm overflow-hidden">
          
          <div className="p-4 border-b border-border-subtle bg-bg-secondary/40 flex justify-between items-center text-xs font-mono text-text-secondary">
            <span>ACTIVE MONITORED CORE AREA OF INTERESTS</span>
            <span>TOTAL: {aois.length} UNITS</span>
          </div>

          {aois.length === 0 ? (
            <div className="p-12 text-center font-mono text-[10px] text-text-muted">
              NO_MONITORED_SECTORS_FOUND_IN_NODE
              <p className="mt-2">
                <Link href="/aoi/new" className="text-accent-primary hover:underline font-bold">
                  INITIALIZE_NEW_AOI_SECTOR
                </Link>
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse font-mono text-xs">
                <thead>
                  <tr className="border-b border-border-subtle text-text-secondary text-[10px] bg-bg-primary/20">
                    <th className="p-4 font-semibold uppercase">Sector Name</th>
                    <th className="p-4 font-semibold uppercase">Area</th>
                    <th className="p-4 font-semibold uppercase">Coordinates</th>
                    <th className="p-4 font-semibold uppercase">Created Date</th>
                    <th className="p-4 font-semibold uppercase text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle/50 text-text-secondary">
                  {aois.map((a) => {
                    const firstCoord = a.geometry?.coordinates?.[0]?.[0];
                    const latVal = firstCoord ? firstCoord[1].toFixed(4) : 'N/A';
                    const lngVal = firstCoord ? firstCoord[0].toFixed(4) : 'N/A';
                    
                    return (
                      <tr key={a.id} className="hover:bg-bg-surface/30 transition-colors">
                        <td className="p-4 font-semibold text-text-primary">
                          <Link href={`/aoi/${a.id}`} className="hover:underline flex items-center space-x-2">
                            <Globe className="w-4 h-4 text-text-muted" />
                            <span>{a.name.toUpperCase()}</span>
                          </Link>
                          {a.description && (
                            <p className="text-[10px] text-text-muted mt-1 font-normal line-clamp-1">
                              {a.description}
                            </p>
                          )}
                        </td>
                        <td className="p-4 text-text-primary font-semibold">
                          {a.area_ha} ha
                        </td>
                        <td className="p-4 text-[10px] text-text-muted">
                          {latVal}°N, {lngVal}°E
                        </td>
                        <td className="p-4 text-[10px]">
                          {new Date(a.created_at).toLocaleDateString()}
                        </td>
                        <td className="p-4 text-right space-x-2">
                          <Link
                            href={`/aoi/${a.id}`}
                            className="inline-flex items-center bg-bg-surface hover:bg-bg-elevated border border-border-default hover:border-text-secondary text-text-primary px-2.5 py-1.5 rounded-sm text-[10px] transition-colors cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5 mr-1" />
                            <span>CONSOLE</span>
                          </Link>
                          <Link
                            href={`/analysis/new?aoi=${a.id}`}
                            className="inline-flex items-center bg-bg-surface hover:bg-bg-elevated border border-border-default hover:border-accent-primary text-accent-primary px-2.5 py-1.5 rounded-sm text-[10px] transition-colors cursor-pointer"
                          >
                            <AreaChart className="w-3.5 h-3.5 mr-1" />
                            <span>ANALYZE</span>
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
