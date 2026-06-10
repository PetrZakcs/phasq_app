import React from 'react';
import { notFound } from 'next/navigation';
import { getAnalysisDetailServer } from '@/lib/data-server';
import AnalysisDetailView from '@/components/AnalysisDetailView';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AnalysisDetailPage({ params }: PageProps) {
  const { id } = await params;

  const analysis = await getAnalysisDetailServer(id);
  if (!analysis) {
    notFound();
  }

  return (
    <AnalysisDetailView
      initialAnalysis={analysis}
    />
  );
}
