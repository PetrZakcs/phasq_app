'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createClientComponent } from '@/lib/supabase';
import { logoutAction } from '@/app/auth-actions';
import { Terminal, LayoutDashboard, Map, BarChart3, FileText, Settings, LogOut, ChevronDown } from 'lucide-react';

interface Profile {
  email: string;
  full_name: string;
  plan: string;
  hectare_quota: number;
  hectare_used: number;
}

export default function Navigation() {
  const pathname = usePathname();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const supabase = createClientComponent();

  useEffect(() => {
    async function loadProfile() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      const { data } = await supabase
        .from('profiles')
        .select('email, full_name, plan, hectare_quota, hectare_used')
        .eq('id', session.user.id)
        .single();

      if (data) {
        setProfile(data as Profile);
      }
    }
    loadProfile();
  }, [supabase]);

  // Links definitions
  const links = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/aoi', label: 'AOI Sectors', icon: Map },
    { href: '/analysis/new', label: 'New Analysis', icon: BarChart3 },
    { href: '/reports', label: 'Reports', icon: FileText },
    { href: '/settings', label: 'Settings', icon: Settings },
  ];

  const quotaPercent = profile ? Math.min(100, Math.round((profile.hectare_used / profile.hectare_quota) * 100)) : 0;

  return (
    <header className="z-20 w-full border-b border-border-default bg-bg-secondary sticky top-0 select-none">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-12 flex items-center justify-between">
        
        {/* Logo and branding */}
        <div className="flex items-center space-x-5">
          <Link href="/dashboard" className="flex items-center space-x-2">
            <Terminal className="w-4 h-4 text-accent-primary" />
            <span className="font-mono text-sm font-bold tracking-wider text-text-primary">
              PHAS<span className="text-accent-primary">Q</span>
            </span>
            <span className="font-mono text-[9px] text-accent-primary border border-accent-primary/20 px-1 py-0.2 rounded-sm bg-accent-primary/5">
              console
            </span>
          </Link>

          {/* Navigation Links */}
          <nav className="hidden md:flex space-x-0.5">
            {links.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href || (link.href !== '/dashboard' && pathname.startsWith(link.href));
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 border-b-2 text-[10px] font-mono tracking-wider transition-colors ${
                    isActive
                      ? 'text-accent-primary bg-bg-primary/20 border-accent-primary font-bold'
                      : 'text-text-secondary border-transparent hover:text-text-primary hover:bg-bg-surface/30'
                  }`}
                >
                  <Icon className="w-3 h-3" />
                  <span>{link.label.toUpperCase()}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right tools (quota badge, user profile) */}
        <div className="flex items-center space-x-4">
          
          {/* Quota Gauge */}
          {profile && (
            <div className="hidden lg:flex flex-col text-right font-mono text-[9px] min-w-[130px] pr-2 border-r border-border-subtle">
              <div className="flex justify-between text-text-secondary mb-0.5">
                <span>PLAN_QUOTA:</span>
                <span className="font-bold text-text-primary">
                  {profile.hectare_used} / {profile.hectare_quota} ha
                </span>
              </div>
              <div className="w-full bg-bg-primary h-1 rounded-sm overflow-hidden border border-border-subtle">
                <div
                  className={`h-full transition-all duration-300 ${
                    quotaPercent > 90 ? 'bg-accent-danger' : quotaPercent > 75 ? 'bg-accent-warning' : 'bg-accent-primary'
                  }`}
                  style={{ width: `${quotaPercent}%` }}
                />
              </div>
            </div>
          )}

          {/* User Profile Dropdown */}
          {profile && (
            <div className="relative">
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center space-x-1.5 px-2.5 py-1 border border-border-default bg-bg-surface hover:bg-bg-elevated rounded-sm text-[10px] font-mono text-text-primary transition-colors cursor-pointer min-h-[28px]"
              >
                <span>{profile.full_name.toUpperCase()}</span>
                <ChevronDown className="w-3 h-3 text-text-secondary" />
              </button>

              {dropdownOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setDropdownOpen(false)} />
                  <div className="absolute right-0 mt-1 w-48 bg-bg-secondary border border-border-default rounded-sm shadow-md z-40 py-1 font-mono text-[10px]">
                    <div className="px-3 py-1.5 border-b border-border-subtle">
                      <p className="text-[8px] text-text-muted">OPERATOR:</p>
                      <p className="font-semibold text-text-primary truncate">{profile.email}</p>
                      <p className="text-[8px] text-accent-primary mt-1 font-bold">
                        PLAN: {profile.plan.toUpperCase()}
                      </p>
                    </div>
                    <Link
                      href="/settings"
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center space-x-1.5 px-3 py-1.5 text-text-secondary hover:text-text-primary hover:bg-bg-surface transition-colors"
                    >
                      <Settings className="w-3 h-3" />
                      <span>SETTINGS</span>
                    </Link>
                    <form action={logoutAction} className="w-full">
                      <button
                        type="submit"
                        className="w-full text-left flex items-center space-x-1.5 px-3 py-1.5 text-accent-danger hover:bg-bg-surface transition-colors cursor-pointer"
                      >
                        <LogOut className="w-3 h-3" />
                        <span>LOGOUT</span>
                      </button>
                    </form>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
      
      {/* Mobile navigation bar */}
      <div className="md:hidden border-t border-border-subtle bg-bg-surface py-1 flex justify-around">
        {links.map((link) => {
          const Icon = link.icon;
          const isActive = pathname === link.href || (link.href !== '/dashboard' && pathname.startsWith(link.href));
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`p-1.5 flex flex-col items-center text-[9px] font-mono tracking-wider ${
                isActive ? 'text-accent-primary font-bold' : 'text-text-secondary'
              }`}
            >
              <Icon className="w-3.5 h-3.5 mb-0.5" />
              <span>{link.label.split(' ')[0].toUpperCase()}</span>
            </Link>
          );
        })}
      </div>
    </header>
  );
}
