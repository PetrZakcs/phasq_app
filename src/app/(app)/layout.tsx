import React from 'react';
import Navigation from '@/components/Navigation';

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-screen flex flex-col bg-bg-primary text-text-primary">
      <Navigation />
      <main className="flex-1 flex flex-col relative">
        {children}
      </main>
    </div>
  );
}
