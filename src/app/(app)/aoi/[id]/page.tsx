import React from 'react';
import { notFound } from 'next/navigation';
import { getAOIDetailServer, getSentinelScenesServer, getAnalysesServer } from '@/lib/data-server';
import AoiDetailView from '@/components/AoiDetailView';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AoiDetailPage({ params }: PageProps) {
  const { id } = await params;

  // Fetch all details server-side
  const aoi = await getAOIDetailServer(id);
  if (!aoi) {
    notFound();
  }

  const scenes = await getSentinelScenesServer(id);
  const allAnalyses = await getAnalysesServer();
  const aoiAnalyses = allAnalyses.filter((a) => a.aoi_id === id);

  return (
    <AoiDetailView
      aoi={aoi}
      scenes={scenes}
      analyses={aoiAnalyses}
    />
  );
}
