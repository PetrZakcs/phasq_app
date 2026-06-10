import React from 'react';
import { notFound } from 'next/navigation';
import { getAOIDetail, getSentinelScenes, getAnalyses } from '@/lib/data';
import AoiDetailView from '@/components/AoiDetailView';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AoiDetailPage({ params }: PageProps) {
  const { id } = await params;

  // Fetch all details server-side
  const aoi = await getAOIDetail(id);
  if (!aoi) {
    notFound();
  }

  const scenes = await getSentinelScenes(id);
  const allAnalyses = await getAnalyses();
  const aoiAnalyses = allAnalyses.filter((a) => a.aoi_id === id);

  return (
    <AoiDetailView
      aoi={aoi}
      scenes={scenes}
      analyses={aoiAnalyses}
    />
  );
}
