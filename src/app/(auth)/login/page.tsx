'use client';

import React, { useActionState } from 'react';
import Link from 'next/link';
import { loginAction } from '@/app/auth-actions';
import { Terminal, Shield, ArrowRight } from 'lucide-react';

const initialState = {
  error: null as string | null,
};

export default function LoginPage() {
  const [state, formAction, isPending] = useActionState(loginAction, initialState);

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
          NODE: TERMINAL_LINK_DISCONNECT // LATENCY: 0ms
        </span>
      </header>

      {/* Main Container */}
      <main className="z-10 flex-1 flex flex-col justify-center items-center px-4 py-12">
        <div className="w-full max-w-[380px] bg-bg-secondary border border-border-default rounded-sm p-6 shadow-sm">
          
          <div className="flex flex-col items-center mb-6 text-center">
            <Shield className="w-6 h-6 text-text-secondary mb-2" />
            <h1 className="text-sm font-bold font-mono tracking-wider text-text-primary uppercase">Sign In to Console</h1>
            <p className="text-[10px] text-text-secondary font-mono mt-1">// ENTER OPERATOR ACCESS CREDENTIALS</p>
          </div>

          <form action={formAction} className="space-y-4">
            {state?.error && (
              <div className="p-3 bg-accent-danger/10 border border-accent-danger/20 rounded-sm text-accent-danger text-[10px] font-mono">
                [ERROR] // {state.error}
              </div>
            )}

            <div className="space-y-1">
              <label htmlFor="email" className="block text-[9px] font-mono uppercase tracking-wider text-text-secondary">
                Security Account Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="operator@domain.com"
                className="w-full bg-bg-surface border border-border-default rounded-sm px-3 py-1.5 text-xs text-text-primary font-mono placeholder:text-text-muted focus:outline-none focus:border-text-secondary transition-colors min-h-[38px]"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="password" className="block text-[9px] font-mono uppercase tracking-wider text-text-secondary">
                Passphrase
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                placeholder="••••••••••••"
                className="w-full bg-bg-surface border border-border-default rounded-sm px-3 py-1.5 text-xs text-text-primary font-mono placeholder:text-text-muted focus:outline-none focus:border-text-secondary transition-colors min-h-[38px]"
              />
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="w-full bg-accent-primary hover:bg-accent-primary/90 text-bg-primary font-bold py-2.5 px-4 rounded-sm text-xs tracking-wider uppercase flex items-center justify-center transition-colors disabled:opacity-50 cursor-pointer min-h-[40px]"
            >
              {isPending ? (
                <span className="font-mono text-xs animate-pulse">ESTABLISHING LINK...</span>
              ) : (
                <>
                  <span>AUTHENTICATE</span>
                  <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                </>
              )}
            </button>
          </form>

          <div className="mt-5 text-center border-t border-border-subtle pt-4">
            <p className="text-[10px] text-text-secondary font-mono">
              Unregistered hardware?{' '}
              <Link href="/register" className="text-accent-primary hover:underline font-bold">
                INIT_LICENSE
              </Link>
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="z-10 w-full px-6 py-4 flex justify-between items-center border-t border-border-subtle text-text-muted font-mono text-[9px] bg-bg-secondary/20">
        <span>© {new Date().getFullYear()} PHASQ. ALL RIGHTS RESERVED.</span>
        <span>SECURITY: CLASSIFIED // DATA: RESTRICTED</span>
      </footer>
    </div>
  );
}
