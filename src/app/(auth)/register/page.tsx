'use client';

import React, { useState, useActionState } from 'react';
import Link from 'next/link';
import { signupAction } from '@/app/auth-actions';
import { Terminal, Shield, ArrowRight, Check, Target } from 'lucide-react';

const initialState = {
  error: null as string | null,
};

const PLANS = [
  {
    id: 'free',
    name: 'FREE NODE',
    price: '€0',
    quota: '100 ha',
    desc: 'Basic agronomic checkups.',
    features: ['Radiometric SAR', 'Sentinel-2 NDVI/NDWI', '3 analyses / month', 'Community support'],
    badge: 'Standard',
  },
  {
    id: 'agri_basic',
    name: 'AGRI BASIC',
    price: '€49',
    quota: '1,000 ha',
    desc: 'For medium-scale operations.',
    features: ['Radiometric + Polarimetric', 'Sentinel-2 NDVI/NDWI', '20 analyses / month', 'Email support (24h)'],
    badge: 'Popular',
  },
  {
    id: 'agri_pro',
    name: 'AGRI PRO',
    price: '€149',
    quota: '10,000 ha',
    desc: 'For large agricultural holdings.',
    features: ['Full SAR (InSAR included)', 'Sentinel-2 NDVI/NDWI', 'Unlimited analyses', 'Priority Support'],
    badge: 'Pro Tier',
  },
  {
    id: 'defense',
    name: 'DEFENSE',
    price: 'Custom',
    quota: 'Unlimited',
    desc: 'For defense & civil surveillance.',
    features: ['All analysis tools + custom models', 'Priority processing queue', 'Dedicated cluster deployment', 'SLA 99.9% support'],
    badge: 'Enterprise',
  },
];

export default function RegisterPage() {
  const [selectedPlan, setSelectedPlan] = useState('free');
  const [state, formAction, isPending] = useActionState(signupAction, initialState);

  return (
    <div className="flex min-h-screen flex-col bg-bg-primary text-text-primary font-display relative select-none">
      
      {/* Header Console */}
      <header className="z-10 w-full px-6 py-4 flex justify-between items-center border-b border-border-default bg-bg-secondary">
        <Link href="/" className="flex items-center space-x-2 group">
          <Terminal className="w-4 h-4 text-accent-primary" />
          <span className="font-mono text-sm font-bold tracking-wider text-text-primary">
            PHAS<span className="text-accent-primary">Q</span>
          </span>
          <span className="font-mono text-[9px] px-1 py-0.2 border border-border-default text-text-secondary bg-bg-primary rounded-sm">
            APP.V1
          </span>
        </Link>
        <span className="font-mono text-[10px] text-text-muted">
          NODE: DEPLOYMENT_SETUP // TACTICAL_INTERFACE
        </span>
      </header>

      {/* Main Container */}
      <main className="z-10 flex-1 flex flex-col justify-center items-center px-4 py-8 max-w-6xl mx-auto w-full">
        <div className="text-center mb-6">
          <h1 className="text-lg font-bold font-mono tracking-wider uppercase">Deploy Operator License</h1>
          <p className="text-[10px] text-text-secondary font-mono mt-1">// CONVERT HARDWARE ASSETS INTO ACTIVE NODES</p>
        </div>

        <form action={formAction} className="w-full grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          
          {/* Plan Selection Card Grid */}
          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-[9px] font-mono uppercase tracking-wider text-text-secondary px-1">
              1. SELECT OPERATIONS LICENSE TIER
            </h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {PLANS.map((p) => {
                const isSelected = selectedPlan === p.id;
                return (
                  <div
                    key={p.id}
                    onClick={() => setSelectedPlan(p.id)}
                    className={`border rounded-sm p-4 cursor-pointer transition-colors bg-bg-secondary flex flex-col justify-between h-[180px] ${
                      isSelected
                        ? 'border-accent-primary bg-bg-elevated'
                        : 'border-border-default hover:border-text-muted hover:bg-bg-elevated/40'
                    }`}
                  >
                    <div>
                      <div className="flex justify-between items-start mb-1.5">
                        <span className="font-mono text-[9px] text-text-muted uppercase tracking-wider">{p.badge}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-accent-primary" />}
                      </div>
                      <h3 className="font-bold font-mono tracking-wide text-xs">{p.name}</h3>
                      <p className="text-[10px] text-text-secondary mt-1 h-[28px] line-clamp-2">{p.desc}</p>
                      
                      <div className="flex items-baseline space-x-1.5 mt-2 border-t border-border-subtle/50 pt-2">
                        <span className="text-lg font-bold font-mono tracking-tight text-text-primary">{p.price}</span>
                        {p.price !== 'Custom' && <span className="text-[9px] text-text-muted font-mono">/ mo</span>}
                      </div>
                    </div>

                    <div className="text-[9px] font-mono text-accent-primary flex items-center justify-between border-t border-border-subtle pt-2 bg-bg-secondary/10">
                      <span>PLAN_QUOTA:</span>
                      <span className="font-bold">{p.quota}</span>
                    </div>
                  </div>
                );
              })}
            </div>
            
            {/* Display plan features */}
            <div className="bg-bg-secondary border border-border-default rounded-sm p-4">
              <h3 className="text-[9px] font-mono text-text-secondary uppercase tracking-wider mb-2 flex items-center">
                <Target className="w-3.5 h-3.5 text-accent-primary mr-1.5" />
                License Capabilities & Analytics Channels
              </h3>
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[10px] font-mono text-text-secondary">
                {PLANS.find((p) => p.id === selectedPlan)?.features.map((f, i) => (
                  <li key={i} className="flex items-center space-x-2">
                    <span className="w-1 h-1 bg-accent-primary rounded-none" />
                    <span>{f.toUpperCase()}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Form details side */}
          <div className="bg-bg-secondary border border-border-default rounded-sm p-5 shadow-sm space-y-4">
            <h2 className="text-[9px] font-mono uppercase tracking-wider text-text-secondary">
              2. OPERATOR SECURITY PROTOCOL
            </h2>

            {state?.error && (
              <div className="p-3 bg-accent-danger/10 border border-accent-danger/20 rounded-sm text-accent-danger text-[10px] font-mono">
                [ERROR] // {state.error}
              </div>
            )}

            {/* Hidden Input for Selected Plan */}
            <input type="hidden" name="plan" value={selectedPlan} />

            <div className="space-y-3">
              <div className="space-y-1">
                <label htmlFor="fullName" className="block text-[9px] font-mono uppercase tracking-wider text-text-secondary">
                  Operator Full Name
                </label>
                <input
                  id="fullName"
                  name="fullName"
                  type="text"
                  required
                  placeholder="e.g. Petr Zak"
                  className="w-full bg-bg-surface border border-border-default rounded-sm px-3 py-1.5 text-xs text-text-primary font-mono placeholder:text-text-muted focus:outline-none focus:border-text-secondary transition-colors min-h-[38px]"
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="organization" className="block text-[9px] font-mono uppercase tracking-wider text-text-secondary">
                  Organization
                </label>
                <input
                  id="organization"
                  name="organization"
                  type="text"
                  placeholder="e.g. Agronomical Group"
                  className="w-full bg-bg-surface border border-border-default rounded-sm px-3 py-1.5 text-xs text-text-primary font-mono placeholder:text-text-muted focus:outline-none focus:border-text-secondary transition-colors min-h-[38px]"
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="email" className="block text-[9px] font-mono uppercase tracking-wider text-text-secondary">
                  Operator Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="name@organization.com"
                  className="w-full bg-bg-surface border border-border-default rounded-sm px-3 py-1.5 text-xs text-text-primary font-mono placeholder:text-text-muted focus:outline-none focus:border-text-secondary transition-colors min-h-[38px]"
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="password" className="block text-[9px] font-mono uppercase tracking-wider text-text-secondary">
                  Access Key Passphrase
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  placeholder="Min. 8 characters"
                  minLength={8}
                  className="w-full bg-bg-surface border border-border-default rounded-sm px-3 py-1.5 text-xs text-text-primary font-mono placeholder:text-text-muted focus:outline-none focus:border-text-secondary transition-colors min-h-[38px]"
                />
              </div>

              <button
                type="submit"
                disabled={isPending}
                className="w-full bg-accent-primary hover:bg-accent-primary/90 text-bg-primary font-bold py-2.5 px-4 rounded-sm text-xs tracking-wider uppercase flex items-center justify-center transition-colors disabled:opacity-50 cursor-pointer min-h-[40px] mt-1"
              >
                {isPending ? (
                  <span className="font-mono text-xs animate-pulse">CREATING SECURE NODE...</span>
                ) : (
                  <>
                    <span>REGISTER NODE</span>
                    <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                  </>
                )}
              </button>
            </div>

            <div className="text-center border-t border-border-subtle pt-3">
              <p className="text-[10px] text-text-secondary font-mono">
                Existing node?{' '}
                <Link href="/login" className="text-accent-primary hover:underline font-bold">
                  AUTHENTICATE
                </Link>
              </p>
            </div>
          </div>
        </form>
      </main>

      {/* Footer */}
      <footer className="z-10 w-full px-6 py-4 flex justify-between items-center border-t border-border-subtle text-text-muted font-mono text-[9px] bg-bg-secondary/20">
        <span>© {new Date().getFullYear()} PHASQ. ALL RIGHTS RESERVED.</span>
        <span>SECURITY: CLASSIFIED // DATA: RESTRICTED</span>
      </footer>
    </div>
  );
}
