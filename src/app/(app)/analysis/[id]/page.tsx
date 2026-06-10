import React from 'react';
import { notFound } from 'next/navigation';
import { getAnalysisDetail } from '@/lib/data';
import AnalysisDetailView from '@/components/AnalysisDetailView';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AnalysisDetailPage({ params }: PageProps) {
  const { id } = await params;

  const analysis = await getAnalysisDetail(id);
  if (!analysis) {
    notFound();
  }

  return (
    <AnalysisDetailView
      initialAnalysis={analysis}
    />
  );
}
