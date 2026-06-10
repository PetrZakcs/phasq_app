'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { getAOIs, getProfileQuota, AOI, Profile } from '@/lib/data';
import { Terminal, Shield, ArrowRight, Zap, Target, Edit3, Settings, ShieldAlert } from 'lucide-react';


function AnalysisNewWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedAoiId = searchParams.get('aoi');

  const [aois, setAois] = useState<AOI[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  // Step state
  const [step, setStep] = useState(1); // 1 = Input, 2 = Confirm

  // Form states
  const [selectedAoiId, setSelectedAoiId] = useState('');
  const [prompt, setPrompt] = useState('Detect soil moisture stress for the last 2 weeks and flag any drought risk areas');
  const [advancedMode, setAdvancedMode] = useState(false);

  // Manual override states
  const [analysisType, setAnalysisType] = useState('ndvi');
  const [startDate, setStartDate] = useState('2026-05-26');
  const [endDate, setEndDate] = useState('2026-06-09');
  const [polarization, setPolarization] = useState('VV');

  // AI parsed outputs (Step 2)
  const [parsedParams, setParsedParams] = useState<any>(null);
  const [orchestrating, setOrchestrating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const [loadedAois, loadedProfile] = await Promise.all([getAOIs(), getProfileQuota()]);
        setAois(loadedAois);
        setProfile(loadedProfile);
        
        if (loadedAois.length > 0) {
          // Select pre-selected or default first AOI
          if (preselectedAoiId && loadedAois.some((a) => a.id === preselectedAoiId)) {
            setSelectedAoiId(preselectedAoiId);
          } else {
            setSelectedAoiId(loadedAois[0].id);
          }
        }
      } catch (err) {
        console.error('Error loading config data', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [preselectedAoiId]);

  const selectedAoi = aois.find((a) => a.id === selectedAoiId);

  // Submit Step 1: Translate prompt into GEE parameters
  const handleNextStep = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAoiId) {
      setError('Please select an Area of Interest (AOI).');
      return;
    }

    setOrchestrating(true);
    setError(null);

    // If advanced manual overrides are on, we bypass OpenAI and compile ourselves
    if (advancedMode) {
      const compiled = {
        analysis_type: analysisType,
        date_range: { start: startDate, end: endDate },
        polarization,
        orbit_direction: 'BOTH',
        specific_focus: 'manual configuration settings',
        alert_threshold: analysisType === 'radiometric' ? -17 : 0.35,
        confidence_level: 'high',
        human_summary: `Executing manual index query for ${analysisType.toUpperCase()} on chosen coordinates.`
      };
      setParsedParams(compiled);
      setStep(2);
      setOrchestrating(false);
      return;
    }

    // Call OpenAI prompt orchestrator
    try {
      const res = await fetch('/api/ai/orchestrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'OpenAI API failure');
      }

      setParsedParams(data.params);
      setStep(2);
    } catch (err: any) {
      console.error(err);
      setError(`Orchestrator failed: ${err.message || 'Connecting to model'}. Try Advanced Mode manually.`);
    } finally {
      setOrchestrating(false);
    }
  };

  // Submit Step 2: Trigger GEE Task & Save Analysis
  const handleConfirmAnalysis = async () => {
    if (!selectedAoi || !parsedParams) return;

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/gee/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          aoi_id: selectedAoi.id,
          params: parsedParams,
          prompt: advancedMode ? '[MANUAL_CONFIGURATION]' : prompt,
        }),
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Google Earth Engine trigger error');
      }

      // Redirect to the newly created analysis details polling page
      router.push(`/analysis/${data.analysis_id}`);
    } catch (err: any) {
      console.error(err);
      setError(`GEE task schedule failed: ${err.message || 'Internal API handler error'}`);
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col justify-center items-center bg-bg-primary font-mono text-xs text-accent-primary space-y-1">
        <span>CONNECTING_OPERATOR_CHANNELS...</span>
      </div>
    );
  }

  if (aois.length === 0) {
    return (
      <div className="flex-1 flex flex-col justify-center items-center bg-bg-primary text-center px-4 font-mono select-none">
        <ShieldAlert className="w-8 h-8 text-accent-warning mb-4" />
        <h2 className="text-sm font-bold uppercase tracking-wider text-text-primary mb-1">NO_ACTIVE_AOI_FOUND</h2>
        <p className="text-[10px] text-text-secondary max-w-sm mb-4">
          You must define at least one Area of Interest boundary sector before launching an analysis task.
        </p>
        <Link
          href="/aoi/new"
          className="bg-accent-primary hover:bg-accent-primary/95 text-bg-primary px-4 py-2 rounded-sm text-xs font-bold uppercase cursor-pointer"
        >
          Define AOI Sector
        </Link>
      </div>
    );
  }

  const hectareUsed = profile ? profile.hectare_used : 0;
  const hectareQuota = profile ? profile.hectare_quota : 500;
  const remainingQuota = hectareQuota - hectareUsed;
  const analysisSize = selectedAoi ? selectedAoi.area_ha : 0;
  const isQuotaExceeded = analysisSize > remainingQuota;


  return (
    <div className="flex-1 bg-bg-primary py-12 px-4 sm:px-6 lg:px-8 font-display select-none">
      <div className="max-w-[580px] mx-auto bg-bg-secondary border border-border-default rounded-sm p-8 shadow-2xl relative">
        
        {/* Progress tracker */}
        <nav aria-label="Progress" className="mb-8 border-b border-border-subtle pb-4">
          <ol className="flex justify-between font-mono text-[9px] text-text-secondary tracking-widest uppercase">
            <li className={`flex items-center space-x-1.5 ${step === 1 ? 'text-accent-primary font-bold' : ''}`}>
              <span className={`w-3.5 h-3.5 rounded-sm flex items-center justify-center text-[8px] ${step === 1 ? 'bg-accent-primary text-bg-primary' : 'bg-bg-surface border border-border-default'}`}>1</span>
              <span>INPUT_PARAMETERS</span>
            </li>
            <li className={`flex items-center space-x-1.5 ${step === 2 ? 'text-accent-primary font-bold' : ''}`}>
              <span className={`w-3.5 h-3.5 rounded-sm flex items-center justify-center text-[8px] ${step === 2 ? 'bg-accent-primary text-bg-primary' : 'bg-bg-surface border border-border-default'}`}>2</span>
              <span>VERIFY_MISSION</span>
            </li>
          </ol>
        </nav>

        {error && (
          <div className="p-3 mb-5 bg-accent-danger/10 border border-accent-danger/30 rounded-sm text-accent-danger text-xs font-mono flex items-start space-x-2">
            <ShieldAlert className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* STEP 1: INPUT PARAMETERS */}
        {step === 1 && (
          <form onSubmit={handleNextStep} className="space-y-6">
            <div>
              <h1 className="text-xl font-bold tracking-wider font-mono uppercase">CONSTRUCT_ANALYSIS_JOB</h1>
              <p className="text-[10px] text-text-secondary font-mono mt-1">// TARGET SECTOR AND PARAMETERS RESOLUTION</p>
            </div>

            {/* Select AOI */}
            <div className="space-y-1.5">
              <label htmlFor="aoi-select" className="block text-xs font-mono uppercase tracking-wider text-text-secondary">
                Target Sector (AOI)
              </label>
              <select
                id="aoi-select"
                value={selectedAoiId}
                onChange={(e) => setSelectedAoiId(e.target.value)}
                className="w-full bg-bg-surface border border-border-default rounded-sm px-3 py-2 text-sm text-text-primary font-mono focus:outline-none focus:border-accent-primary transition-colors cursor-pointer min-h-[44px]"
              >
                {aois.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name.toUpperCase()} ({a.area_ha} ha)
                  </option>
                ))}
              </select>
            </div>

            {/* Mode toggle */}
            <div className="flex justify-between items-center border-t border-border-subtle pt-4">
              <span className="text-xs font-mono uppercase tracking-wider text-text-secondary">
                Advanced manual overrides
              </span>
              <button
                type="button"
                onClick={() => setAdvancedMode(!advancedMode)}
                className={`border px-2 py-1 text-[10px] font-mono cursor-pointer transition-colors ${
                  advancedMode 
                    ? 'bg-accent-primary text-bg-primary font-bold border-accent-primary' 
                    : 'bg-bg-surface text-text-secondary border-border-default'
                }`}
              >
                {advancedMode ? 'OVERRIDE_ACTIVE' : 'AUTO_TRANSLATE'}
              </button>
            </div>

            {/* AI Prompter Mode */}
            {!advancedMode ? (
              <div className="space-y-2">
                <label htmlFor="ai-prompt" className="block text-xs font-mono uppercase tracking-wider text-text-secondary">
                  Natural Language Prompt Instruction
                </label>
                <textarea
                  id="ai-prompt"
                  rows={4}
                  required
                  placeholder="e.g. Check crop chlorophyll indices for the last month and check for anomalies."
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  className="w-full bg-bg-surface border border-border-default rounded-sm px-3 py-2.5 text-xs text-text-primary font-mono placeholder:text-text-muted focus:outline-none focus:border-accent-primary transition-colors resize-none leading-relaxed"
                />
                <p className="text-[9px] text-text-muted font-mono leading-normal">
                  // Prompt translates using GPT-4o into specific indexes, bounding orbits and timestamps.
                </p>
              </div>
            ) : (
              /* Manual Mode Form */
              <div className="space-y-4 border border-border-subtle rounded-sm p-4 bg-bg-surface">
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label htmlFor="analysis-type" className="block text-[9px] font-mono uppercase text-text-secondary">
                      Analysis Index
                    </label>
                    <select
                      id="analysis-type"
                      value={analysisType}
                      onChange={(e) => setAnalysisType(e.target.value)}
                      className="w-full bg-bg-secondary border border-border-default rounded-sm px-2 py-1 text-xs font-mono focus:outline-none focus:border-accent-primary cursor-pointer min-h-[34px]"
                    >
                      <option value="ndvi">SENTINEL-2 NDVI (VEGETATION)</option>
                      <option value="ndwi">SENTINEL-2 NDWI (WATER)</option>
                      <option value="radiometric">SENTINEL-1 SAR DB (MOISTURE)</option>
                      <option value="polarimetric">SENTINEL-1 POLSAR (BIOMASS)</option>
                      <option value="interferometric">SENTINEL-1 INSAR (SUBSIDENCE)</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="polarization" className="block text-[9px] font-mono uppercase text-text-secondary">
                      Polarization (SAR)
                    </label>
                    <select
                      id="polarization"
                      value={polarization}
                      onChange={(e) => setPolarization(e.target.value)}
                      className="w-full bg-bg-secondary border border-border-default rounded-sm px-2 py-1 text-xs font-mono focus:outline-none focus:border-accent-primary cursor-pointer min-h-[34px]"
                      disabled={analysisType !== 'radiometric' && analysisType !== 'polarimetric'}
                    >
                      <option value="VV">VV (VERT SINGLE)</option>
                      <option value="VH">VH (CROSS POL)</option>
                      <option value="VV+VH">VV+VH (DUAL POL)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label htmlFor="start-date" className="block text-[9px] font-mono uppercase text-text-secondary">
                      Start Date
                    </label>
                    <input
                      id="start-date"
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full bg-bg-secondary border border-border-default rounded-sm px-2 py-1 text-xs font-mono focus:outline-none focus:border-accent-primary min-h-[34px]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="end-date" className="block text-[9px] font-mono uppercase text-text-secondary">
                      End Date
                    </label>
                    <input
                      id="end-date"
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full bg-bg-secondary border border-border-default rounded-sm px-2 py-1 text-xs font-mono focus:outline-none focus:border-accent-primary min-h-[34px]"
                    />
                  </div>
                </div>

              </div>
            )}

            <button
              type="submit"
              disabled={orchestrating}
              className="w-full bg-accent-primary hover:bg-accent-primary/95 text-bg-primary font-bold py-2.5 px-4 rounded-sm text-xs tracking-wider uppercase flex items-center justify-center transition-colors disabled:opacity-50 cursor-pointer min-h-[44px]"
            >
              {orchestrating ? (
                <span className="font-mono text-xs animate-pulse">ORCHESTRATING MISSION TACTICS...</span>
              ) : (
                <>
                  <span>Compile Mission Parameters</span>
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </button>
          </form>
        )}

        {/* STEP 2: CONFIRMATION MISSION */}
        {step === 2 && parsedParams && (
          <div className="space-y-6">
            <div>
              <h1 className="text-xl font-bold tracking-wider font-mono uppercase">CONFIRM_TELEMETRY_MISSION</h1>
              <p className="text-[10px] text-text-secondary font-mono mt-1">// DISPATCH_VERIFICATION_CHECK</p>
            </div>

            {/* AI Human Summary */}
            <div className="bg-bg-surface border border-border-default rounded-sm p-5 space-y-2">
              <h3 className="text-[10px] font-mono uppercase text-accent-primary tracking-wider flex items-center">
                <Zap className="w-3.5 h-3.5 mr-1" />
                Operational Mission Summary
              </h3>
              <p className="text-xs text-text-primary leading-relaxed">
                {parsedParams.human_summary}
              </p>
            </div>

            {/* Compiled parameters details */}
            <div className="border border-border-default rounded-sm bg-bg-surface/50 p-4 font-mono text-[10px] text-text-secondary space-y-2.5">
              <div className="flex justify-between border-b border-border-subtle pb-1.5">
                <span>ANALYSIS_INDEX_TYPE:</span>
                <span className="font-bold text-text-primary">{parsedParams.analysis_type.toUpperCase()}</span>
              </div>
              <div className="flex justify-between border-b border-border-subtle pb-1.5">
                <span>CHRONOLOGICAL_RANGE:</span>
                <span className="font-bold text-text-primary">
                  {parsedParams.date_range.start} – {parsedParams.date_range.end}
                </span>
              </div>
              <div className="flex justify-between border-b border-border-subtle pb-1.5">
                <span>POLARIZATION / ORBIT:</span>
                <span className="font-bold text-text-primary">
                  {parsedParams.polarization} // {parsedParams.orbit_direction}
                </span>
              </div>
              <div className="flex justify-between border-b border-border-subtle pb-1.5">
                <span>ALERT_TRIGGER_THRESHOLD:</span>
                <span className="font-bold text-accent-warning">
                  {parsedParams.alert_threshold !== null ? parsedParams.alert_threshold : 'NONE'}
                </span>
              </div>
              <div className="flex justify-between border-b border-border-subtle pb-1.5">
                <span>SECTOR MONITORED SIZE:</span>
                <span className="font-bold text-text-primary">{analysisSize} ha</span>
              </div>
              <div className="flex justify-between">
                <span>PLAN QUOTA IMPACT:</span>
                <span className={`font-bold ${isQuotaExceeded ? 'text-accent-danger' : 'text-accent-primary'}`}>
                  {hectareUsed + analysisSize} / {hectareQuota} ha
                </span>
              </div>
            </div>

            {/* Error or caution if quota exceeded */}
            {isQuotaExceeded && (
              <div className="p-3 bg-accent-danger/10 border border-accent-danger/30 rounded-sm text-accent-danger text-xs font-mono">
                [QUOTA_ERROR] // The selected sector size exceeds your remaining monthly plan hectares.
              </div>
            )}

            <div className="flex space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                disabled={submitting}
                className="flex-1 bg-bg-surface hover:bg-bg-elevated border border-border-default text-text-primary py-2.5 px-4 rounded-sm text-xs font-mono uppercase transition-colors cursor-pointer min-h-[44px]"
              >
                Modify Params
              </button>
              
              <button
                type="button"
                onClick={handleConfirmAnalysis}
                disabled={submitting || isQuotaExceeded}
                className="flex-1 bg-accent-primary hover:bg-accent-primary/95 text-bg-primary font-bold py-2.5 px-4 rounded-sm text-xs tracking-wider uppercase flex items-center justify-center transition-colors disabled:opacity-50 cursor-pointer min-h-[44px]"
              >
                {submitting ? (
                  <span className="font-mono text-xs animate-pulse">DISPATCHING TELEMETRY...</span>
                ) : (
                  <>
                    <span>Dispatch Mission</span>
                    <Target className="w-4 h-4 ml-2" />
                  </>
                )}
              </button>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}

export default function NewAnalysisPage() {
  return (
    <Suspense fallback={<div className="flex-1 flex justify-center items-center bg-bg-primary font-mono text-xs text-accent-primary">CONNECTING_CHANNELS...</div>}>
      <AnalysisNewWizard />
    </Suspense>
  );
}
