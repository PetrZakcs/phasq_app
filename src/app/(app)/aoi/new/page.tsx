'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponent } from '@/lib/supabase';
import { getProfileQuota, Profile } from '@/lib/data';
import AoiDrawerMap from '@/components/AoiDrawerMap';
import { Target, ArrowLeft, ShieldAlert, Check, Search, Globe, Loader2 } from 'lucide-react';
import Link from 'next/link';

export default function NewAoiPage() {
  const router = useRouter();
  const supabase = createClientComponent();
  const [profile, setProfile] = useState<Profile | null>(null);
  
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [geometry, setGeometry] = useState<any>(null);
  const [areaHa, setAreaHa] = useState(0);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // LPIS Importer States
  const [activeTab, setActiveTab] = useState<'draw' | 'lpis'>('draw');
  const [lpisSearchType, setLpisSearchType] = useState<'farmer' | 'block'>('farmer');
  const [lpisFarmerId, setLpisFarmerId] = useState('');
  const [lpisSquare, setLpisSquare] = useState('');
  const [lpisBlock, setLpisBlock] = useState('');
  const [lpisSearching, setLpisSearching] = useState(false);
  const [lpisResults, setLpisResults] = useState<any[]>([]);
  const [lpisSearchError, setLpisSearchError] = useState<string | null>(null);
  const [selectedLpisId, setSelectedLpisId] = useState<string | null>(null);

  useEffect(() => {
    async function loadQuota() {
      const data = await getProfileQuota();
      if (data) setProfile(data);
    }
    loadQuota();
  }, []);

  const handlePolygonCreated = (geojson: any, computedArea: number) => {
    setGeometry(geojson);
    setAreaHa(computedArea);
    setError(null);
  };

  const handleLpisSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setLpisSearching(true);
    setLpisSearchError(null);
    setLpisResults([]);
    setSelectedLpisId(null);

    try {
      let url = '/api/lpis/import?';
      if (lpisSearchType === 'farmer') {
        if (!lpisFarmerId.trim()) throw new Error('Zadejte prosím ID uživatele (IČO / ID_UZ).');
        url += `farmerId=${encodeURIComponent(lpisFarmerId.trim())}`;
      } else {
        if (!lpisSquare.trim() || !lpisBlock.trim()) throw new Error('Zadejte prosím kód čtverce a zkrácený kód DPB.');
        url += `square=${encodeURIComponent(lpisSquare.trim())}&block=${encodeURIComponent(lpisBlock.trim())}`;
      }

      const res = await fetch(url);
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Nepodařilo se načíst data z LPIS.');
      }

      setLpisResults(data.features || []);
      if (data.features?.length === 0) {
        setLpisSearchError('Nebyl nalezen žádný odpovídající půdní blok (DPB) v registru LPIS.');
      }
    } catch (err: any) {
      console.error(err);
      setLpisSearchError(err.message || 'Chyba při komunikaci s LPIS API.');
    } finally {
      setLpisSearching(false);
    }
  };

  const handleSelectLpisBlock = (block: any) => {
    setSelectedLpisId(block.id);
    setName(block.name);
    setDescription(`Importováno z registru LPIS. Čtverec: ${block.square || ''}, Zkrácený kód DPB: ${block.block_code || ''}, Plodina: ${block.crop || ''}.`);
    setGeometry(block.geometry);
    setAreaHa(block.area_ha);
    setError(null);
  };

  const handleResetSelection = () => {
    setSelectedLpisId(null);
    setName('');
    setDescription('');
    setGeometry(null);
    setAreaHa(0);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!geometry) {
      setError('Please draw a valid polygon on the grid first.');
      return;
    }
    if (areaHa < 1.0) {
      setError('Minimum monitoring area is 1.0 hectare.');
      return;
    }

    const maxAllowed = profile ? profile.hectare_quota - profile.hectare_used : 500;
    if (areaHa > maxAllowed) {
      setError(`Requested sector size (${areaHa} ha) exceeds remaining quota (${maxAllowed} ha).`);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        setError('Session expired. Please log in again.');
        return;
      }

      // 1. Insert AOI into Database
      const { data: aoiData, error: insertError } = await supabase
        .from('aoi')
        .insert({
          user_id: session.user.id,
          name,
          description,
          geometry,
          area_ha: areaHa,
        })
        .select()
        .single();

      if (insertError) {
        throw insertError;
      }

      // 2. Add log entry
      await supabase.from('audit_log').insert({
        user_id: session.user.id,
        action: 'CREATE_AOI',
        resource_type: 'aoi',
        resource_id: aoiData.id,
        metadata: { name, area_ha: areaHa },
      });

      // Redirect to the AOI detail page
      router.push(`/aoi/${aoiData.id}`);
    } catch (err: any) {
      console.error(err);
      setError(`Failed to save sector: ${err.message || 'Database error'}`);
    } finally {
      setLoading(false);
    }
  };

  const remainingQuota = profile ? profile.hectare_quota - profile.hectare_used : 500;

  return (
    <div className="flex-1 flex flex-col lg:flex-row bg-bg-primary overflow-hidden select-none">
      
      {/* Sidebar form panel */}
      <div className="w-full lg:w-[380px] bg-bg-secondary border-r border-border-default flex flex-col justify-between p-6 h-full overflow-y-auto">
        <div className="space-y-6">
          
          {/* Header Link */}
          <Link
            href="/dashboard"
            className="flex items-center space-x-2 text-text-secondary hover:text-text-primary text-xs font-mono transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>RETURN_TO_DASHBOARD</span>
          </Link>

          <div>
            <h1 className="text-xl font-bold tracking-wider font-mono">DEFINE_NEW_SECTOR</h1>
            <p className="text-[10px] text-text-secondary font-mono mt-1">// TARGET REGISTRATION CONSOLE</p>
          </div>

          {/* Tabs bar */}
          <div className="flex border-b border-border-default font-mono text-[9px]">
            <button
              type="button"
              onClick={() => {
                setActiveTab('draw');
                handleResetSelection();
              }}
              className={`flex-1 py-2 text-center uppercase tracking-wider font-bold transition-colors border-b-2 cursor-pointer ${
                activeTab === 'draw'
                  ? 'border-accent-primary text-text-primary bg-bg-surface/25'
                  : 'border-transparent text-text-muted hover:text-text-primary'
              }`}
            >
              [Draw Custom]
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('lpis');
                handleResetSelection();
              }}
              className={`flex-1 py-2 text-center uppercase tracking-wider font-bold transition-colors border-b-2 cursor-pointer ${
                activeTab === 'lpis'
                  ? 'border-accent-primary text-text-primary bg-bg-surface/25'
                  : 'border-transparent text-text-muted hover:text-text-primary'
              }`}
            >
              [LPIS Import]
            </button>
          </div>

          {/* LPIS Search section */}
          {activeTab === 'lpis' && (
            <div className="space-y-4 border border-border-subtle p-3 rounded-sm bg-bg-surface/40">
              <h3 className="text-[10px] font-mono text-accent-primary uppercase tracking-wider font-bold">// LPIS registry query</h3>
              
              <div className="flex space-x-2 border-b border-border-subtle pb-2 font-mono text-[9px]">
                <button
                  type="button"
                  onClick={() => setLpisSearchType('farmer')}
                  className={`px-2 py-1 border transition-colors cursor-pointer ${
                    lpisSearchType === 'farmer' 
                      ? 'bg-accent-primary text-bg-primary font-bold border-accent-primary' 
                      : 'bg-bg-primary text-text-secondary border-border-default'
                  }`}
                >
                  Farmer ID (ID_UZ)
                </button>
                <button
                  type="button"
                  onClick={() => setLpisSearchType('block')}
                  className={`px-2 py-1 border transition-colors cursor-pointer ${
                    lpisSearchType === 'block' 
                      ? 'bg-accent-primary text-bg-primary font-bold border-accent-primary' 
                      : 'bg-bg-primary text-text-secondary border-border-default'
                  }`}
                >
                  Square & Block
                </button>
              </div>

              <form onSubmit={handleLpisSearch} className="space-y-3">
                {lpisSearchType === 'farmer' ? (
                  <div className="space-y-1">
                    <label htmlFor="farmer-id" className="block text-[9px] font-mono uppercase text-text-secondary">Farmer ID (ID_UZ / IČO)</label>
                    <input
                      id="farmer-id"
                      type="text"
                      required
                      placeholder="e.g. 52409"
                      value={lpisFarmerId}
                      onChange={(e) => setLpisFarmerId(e.target.value)}
                      className="w-full bg-bg-primary border border-border-default rounded-sm px-2.5 py-1.5 text-xs text-text-primary font-mono focus:outline-none focus:border-accent-primary min-h-[34px]"
                    />
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label htmlFor="square" className="block text-[9px] font-mono uppercase text-text-secondary">Square</label>
                      <input
                        id="square"
                        type="text"
                        required
                        placeholder="e.g. 330-105"
                        value={lpisSquare}
                        onChange={(e) => setLpisSquare(e.target.value)}
                        className="w-full bg-bg-primary border border-border-default rounded-sm px-2.5 py-1.5 text-xs text-text-primary font-mono focus:outline-none focus:border-accent-primary min-h-[34px]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label htmlFor="block-code" className="block text-[9px] font-mono uppercase text-text-secondary">Block Code</label>
                      <input
                        id="block-code"
                        type="text"
                        required
                        placeholder="e.g. 12"
                        value={lpisBlock}
                        onChange={(e) => setLpisBlock(e.target.value)}
                        className="w-full bg-bg-primary border border-border-default rounded-sm px-2.5 py-1.5 text-xs text-text-primary font-mono focus:outline-none focus:border-accent-primary min-h-[34px]"
                      />
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={lpisSearching}
                  className="w-full bg-bg-surface hover:bg-bg-elevated border border-border-default hover:border-accent-primary text-text-primary py-1.5 rounded-sm text-[10px] font-mono uppercase transition-colors cursor-pointer min-h-[34px] flex items-center justify-center space-x-1.5"
                >
                  {lpisSearching ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-accent-primary" />
                      <span>Querying LPIS...</span>
                    </>
                  ) : (
                    <>
                      <Search className="w-3.5 h-3.5 text-accent-primary" />
                      <span>Search LPIS Registry</span>
                    </>
                  )}
                </button>
              </form>

              {lpisSearchError && (
                <p className="text-[9px] font-mono text-accent-danger break-words leading-relaxed pt-1">
                  // [LPIS_ERROR]: {lpisSearchError}
                </p>
              )}

              {/* LPIS results listing */}
              {lpisResults.length > 0 && (
                <div className="space-y-2 border-t border-border-subtle/50 pt-3">
                  <span className="text-[9px] font-mono text-text-muted uppercase block">// Found land blocks ({lpisResults.length}):</span>
                  <div className="max-h-[160px] overflow-y-auto space-y-1.5 pr-1 font-mono text-[9px]">
                    {lpisResults.map((r) => {
                      const isSelected = selectedLpisId === r.id;
                      return (
                        <div
                          key={r.id}
                          onClick={() => handleSelectLpisBlock(r)}
                          className={`p-2 border rounded-sm cursor-pointer transition-colors text-left ${
                            isSelected 
                              ? 'border-accent-primary bg-accent-primary/5 text-text-primary' 
                              : 'border-border-default hover:border-text-secondary bg-bg-primary/50 text-text-secondary'
                          }`}
                        >
                          <div className="flex justify-between font-bold text-text-primary text-[10px]">
                            <span>DPB: {r.block_code}</span>
                            <span>{r.area_ha.toFixed(2)} ha</span>
                          </div>
                          <div className="flex justify-between text-[8px] text-text-muted mt-1">
                            <span>{r.crop || 'Crop unspecified'}</span>
                            <span>Square: {r.square}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            
            {error && (
              <div className="p-3 bg-accent-danger/10 border border-accent-danger/30 rounded-sm text-accent-danger text-xs font-mono flex items-start space-x-2">
                <ShieldAlert className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {geometry && activeTab === 'lpis' && (
              <div className="p-2 bg-accent-primary/10 border border-accent-primary/30 rounded-sm text-accent-primary text-[9px] font-mono flex items-center space-x-2">
                <Check className="w-3.5 h-3.5 flex-shrink-0" />
                <span>LPIS PARCEL GEOMETRY INJECTED</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label htmlFor="sector-name" className="block text-xs font-mono uppercase tracking-wider text-text-secondary">
                Sector / Name
              </label>
              <input
                id="sector-name"
                type="text"
                required
                placeholder="Crop plot Vysocina C"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-bg-surface border border-border-default rounded-sm px-3 py-2 text-sm text-text-primary font-mono placeholder:text-text-muted focus:outline-none focus:border-accent-primary transition-colors min-h-[42px]"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="sector-desc" className="block text-xs font-mono uppercase tracking-wider text-text-secondary">
                Description
              </label>
              <textarea
                id="sector-desc"
                placeholder="Details about seed type, crop cycle or soil structures."
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-bg-surface border border-border-default rounded-sm px-3 py-2 text-sm text-text-primary font-mono placeholder:text-text-muted focus:outline-none focus:border-accent-primary transition-colors resize-none"
              />
            </div>

            {/* Geometry specifications */}
            <div className="border border-border-default rounded-sm p-4 bg-bg-surface space-y-3 font-mono text-[10px] text-text-secondary">
              <div className="flex justify-between border-b border-border-subtle pb-2">
                <span>SECTOR SIZE:</span>
                <span className="font-bold text-text-primary">
                  {areaHa > 0 ? `${areaHa.toFixed(2)} ha` : 'NOT_DEFINED'}
                </span>
              </div>
              <div className="flex justify-between border-b border-border-subtle pb-2">
                <span>REMAINING QUOTA:</span>
                <span className="font-bold text-accent-primary">{remainingQuota.toFixed(2)} ha</span>
              </div>
              <div className="flex justify-between">
                <span>STATUS:</span>
                <span className={`font-bold ${geometry ? 'text-accent-primary' : 'text-accent-warning'}`}>
                  {geometry ? 'GRID_LOCKED' : 'PENDING_INPUT'}
                </span>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !geometry || areaHa > remainingQuota}
              className="w-full bg-accent-primary hover:bg-accent-primary/95 text-bg-primary font-bold py-2.5 px-4 rounded-sm text-xs tracking-wider uppercase flex items-center justify-center transition-colors disabled:opacity-50 cursor-pointer min-h-[44px]"
            >
              {loading ? (
                <span className="animate-pulse">SAVING_SECTOR...</span>
              ) : (
                <>
                  <span>Save Sector Coordinates</span>
                  <Check className="w-4 h-4 ml-2" />
                </>
              )}
            </button>

          </form>
        </div>

        {/* Footer logo reference */}
        <div className="mt-8 pt-4 border-t border-border-subtle flex items-center space-x-2 text-[10px] font-mono text-text-muted">
          <Target className="w-3.5 h-3.5" />
          <span>PHASQ TELEMETRY SYSTEM v1.0</span>
        </div>
      </div>

      {/* Main map section */}
      <div className="flex-1 flex flex-col p-4 sm:p-6 relative">
        <AoiDrawerMap
          onPolygonCreated={handlePolygonCreated}
          maxQuota={remainingQuota}
          initialGeometry={geometry}
        />
      </div>

    </div>
  );
}
