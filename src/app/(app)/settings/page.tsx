'use client';

import React, { useEffect, useState } from 'react';
import { getProfileQuota, Profile } from '@/lib/data';
import { Terminal, Shield, Key, Eye, EyeOff, Save, CheckCircle, Mail, Bell } from 'lucide-react';
import { createClientComponent } from '@/lib/supabase';

export default function SettingsPage() {
  const supabase = createClientComponent();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Form profile states
  const [fullName, setFullName] = useState('');
  const [organization, setOrganization] = useState('');

  // API Key States
  const [apiKey, setApiKey] = useState('pq_live_7c92b8d0e514f0a73b98c92a');
  const [showKey, setShowKey] = useState(false);

  // Notification states
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [weeklyDigest, setWeeklyDigest] = useState(false);

  useEffect(() => {
    async function loadSettings() {
      try {
        const data = await getProfileQuota();
        if (data) {
          setProfile(data);
          setFullName(data.full_name);
          setOrganization(data.organization || '');
        }
      } catch (err) {
        console.error('Error loading settings', err);
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, []);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error('No session');

      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: fullName,
          organization,
        })
        .eq('id', session.user.id);

      if (error) throw error;
      
      setMessage('Profile updated successfully.');
    } catch (err: any) {
      console.error(err);
      setMessage(`Failed to update profile: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleRegenerateKey = () => {
    const randomHex = Array.from({ length: 24 }, () => 
      Math.floor(Math.random() * 16).toString(16)
    ).join('');
    setApiKey(`pq_live_${randomHex}`);
    setMessage('API token regenerated successfully.');
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col justify-center items-center bg-bg-primary font-mono text-xs text-accent-primary">
        <span>CONNECTING_SETTINGS_PANEL...</span>
      </div>
    );
  }

  const quotaPercent = profile ? Math.min(100, Math.round((profile.hectare_used / profile.hectare_quota) * 100)) : 0;

  return (
    <div className="flex-1 bg-bg-primary py-8 px-4 sm:px-6 lg:px-8 font-display select-none">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Title */}
        <div className="border-b border-border-default pb-5">
          <h1 className="text-2xl font-bold tracking-wider font-mono">NODE_SETTINGS_CONSOLE</h1>
          <p className="text-xs text-text-secondary font-mono mt-1">// CONFIGURATION & ACCESS CONTROL</p>
        </div>

        {message && (
          <div className="p-3 bg-accent-primary/10 border border-accent-primary/30 rounded-sm text-accent-primary text-xs font-mono flex items-center space-x-2">
            <CheckCircle className="w-4 h-4" />
            <span>{message}</span>
          </div>
        )}

        {/* 2-Column layout */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Left: profile & settings form */}
          <div className="md:col-span-2 space-y-6">
            
            {/* Profile configuration */}
            <div className="bg-bg-secondary border border-border-default rounded-sm p-6 relative">
              
              <h2 className="text-xs font-mono uppercase tracking-wider text-text-secondary mb-4 flex items-center">
                <Shield className="w-4 h-4 text-accent-primary mr-2" />
                Operator Profile
              </h2>

              <form onSubmit={handleSaveProfile} className="space-y-4">
                
                <div className="space-y-1">
                  <label className="block text-[10px] font-mono uppercase text-text-secondary">Email</label>
                  <input
                    type="text"
                    disabled
                    value={profile?.email || ''}
                    className="w-full bg-bg-primary border border-border-subtle rounded-sm px-3 py-2 text-sm text-text-muted font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label htmlFor="full-name" className="block text-[10px] font-mono uppercase text-text-secondary">Full Name</label>
                  <input
                    id="full-name"
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full bg-bg-surface border border-border-default focus:border-accent-primary rounded-sm px-3 py-2 text-sm text-text-primary font-mono focus:outline-none transition-colors min-h-[42px]"
                  />
                </div>

                <div className="space-y-1">
                  <label htmlFor="org" className="block text-[10px] font-mono uppercase text-text-secondary">Organization</label>
                  <input
                    id="org"
                    type="text"
                    value={organization}
                    onChange={(e) => setOrganization(e.target.value)}
                    className="w-full bg-bg-surface border border-border-default focus:border-accent-primary rounded-sm px-3 py-2 text-sm text-text-primary font-mono focus:outline-none transition-colors min-h-[42px]"
                  />
                </div>

                <button
                  type="submit"
                  disabled={saving}
                  className="bg-accent-primary hover:bg-accent-primary/95 text-bg-primary font-bold py-2 px-4 rounded-sm text-xs tracking-wider uppercase flex items-center justify-center transition-colors disabled:opacity-50 cursor-pointer min-h-[38px] mt-2"
                >
                  <Save className="w-3.5 h-3.5 mr-1.5" />
                  <span>{saving ? 'SAVING_CHANGES...' : 'Save Profile'}</span>
                </button>

              </form>
            </div>

            {/* API access control */}
            <div className="bg-bg-secondary border border-border-default rounded-sm p-6 relative">
              
              <h2 className="text-xs font-mono uppercase tracking-wider text-text-secondary mb-4 flex items-center">
                <Key className="w-4 h-4 text-accent-primary mr-2" />
                API Credentials
              </h2>

              <p className="text-[10px] text-text-muted mb-4 font-mono">
                Use this token to query GEE telemetry, register AOIs, and pull PDF results programmatically.
              </p>

              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <div className="relative flex-1">
                    <input
                      type={showKey ? 'text' : 'password'}
                      readOnly
                      value={apiKey}
                      className="w-full bg-bg-surface border border-border-default rounded-sm px-3 py-2.5 text-xs text-accent-primary font-mono tracking-wider focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowKey(!showKey)}
                      className="absolute right-3 top-2.5 text-text-secondary hover:text-text-primary cursor-pointer"
                    >
                      {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={handleRegenerateKey}
                    className="bg-bg-surface hover:bg-bg-elevated border border-border-default text-text-primary px-3 py-2.5 rounded-sm text-xs font-mono cursor-pointer transition-colors"
                  >
                    REGENERATE
                  </button>
                </div>
              </div>
            </div>

          </div>

          {/* Right side: subscription plan progress info & notifications */}
          <div className="space-y-6">
            
            {/* Plan box */}
            <div className="bg-bg-secondary border border-border-default rounded-sm p-5">
              <h3 className="text-xs font-mono uppercase tracking-wider text-text-secondary mb-3 border-b border-border-subtle pb-2">
                Deployment License
              </h3>
              
              {profile && (
                <div className="space-y-4 font-mono">
                  <div>
                    <span className="text-[10px] text-text-muted">ACTIVE_TIER:</span>
                    <p className="text-base font-bold text-accent-primary mt-0.5">{profile.plan.toUpperCase()}</p>
                  </div>

                  <div>
                    <div className="flex justify-between text-[10px] mb-1">
                      <span className="text-text-muted">HECTARES_USED:</span>
                      <span className="text-text-primary font-bold">{quotaPercent}%</span>
                    </div>
                    <div className="w-full bg-bg-primary h-2 rounded-none overflow-hidden border border-border-subtle">
                      <div className="h-full bg-accent-primary" style={{ width: `${quotaPercent}%` }} />
                    </div>
                    <p className="text-[9px] text-text-muted mt-1.5 text-right">
                      {profile.hectare_used} / {profile.hectare_quota} ha quota
                    </p>
                  </div>

                  <button
                    type="button"
                    className="w-full bg-bg-surface hover:bg-bg-elevated border border-border-default hover:border-text-secondary text-text-primary py-2 px-3 rounded-sm text-[10px] font-bold uppercase transition-colors cursor-pointer text-center"
                  >
                    UPGRADE_LICENSE
                  </button>
                </div>
              )}
            </div>

            {/* Notification preferences */}
            <div className="bg-bg-secondary border border-border-default rounded-sm p-5">
              <h3 className="text-xs font-mono uppercase tracking-wider text-text-secondary mb-4 border-b border-border-subtle pb-2">
                Operational Alerts
              </h3>
              
              <div className="space-y-4 text-xs font-mono">
                
                {/* Switch 1 */}
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-0.5 max-w-[80%]">
                    <label className="font-semibold text-text-primary block" htmlFor="email-alert-toggle">Email Alert Triggers</label>
                    <span className="text-[10px] text-text-muted font-mono leading-relaxed block">
                      Instantly notify when soil dryness (SAR) or vegetation stress (NDVI/NDWI) exceeds alert threshold.
                    </span>
                  </div>
                  <button
                    type="button"
                    id="email-alert-toggle"
                    onClick={() => setEmailAlerts(!emailAlerts)}
                    className={`border px-2 py-1 text-[10px] font-mono cursor-pointer transition-colors min-w-[70px] text-center ${
                      emailAlerts 
                        ? 'bg-accent-primary text-bg-primary font-bold border-accent-primary' 
                        : 'bg-bg-primary text-text-secondary border-border-default'
                    }`}
                  >
                    {emailAlerts ? 'ON' : 'OFF'}
                  </button>
                </div>

                {/* Switch 2 */}
                <div className="flex items-start justify-between border-t border-border-subtle/50 pt-4 gap-4">
                  <div className="space-y-0.5 max-w-[80%]">
                    <label className="font-semibold text-text-primary block" htmlFor="weekly-digest-toggle">Weekly Digest Logs</label>
                    <span className="text-[10px] text-text-muted font-mono leading-relaxed block">
                      Receive compiled sector telemetry summaries each Monday.
                    </span>
                  </div>
                  <button
                    type="button"
                    id="weekly-digest-toggle"
                    onClick={() => setWeeklyDigest(!weeklyDigest)}
                    className={`border px-2 py-1 text-[10px] font-mono cursor-pointer transition-colors min-w-[70px] text-center ${
                      weeklyDigest 
                        ? 'bg-accent-primary text-bg-primary font-bold border-accent-primary' 
                        : 'bg-bg-primary text-text-secondary border-border-default'
                    }`}
                  >
                    {weeklyDigest ? 'ON' : 'OFF'}
                  </button>
                </div>

              </div>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
}
