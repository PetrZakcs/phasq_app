import { createServerSideClient } from '@/lib/supabase-server';
import { AOI, SentinelScene, Analysis, MOCK_AOIS, MOCK_ANALYSES } from './data';

const isMockMode = () => {
  return (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL.includes('your-supabase-project')
  );
};

export async function getAOIDetailServer(id: string): Promise<AOI | null> {
  if (isMockMode() || id.startsWith('aoi-')) {
    return MOCK_AOIS.find((a) => a.id === id) || null;
  }

  const supabase = await createServerSideClient();
  const { data, error } = await supabase
    .from('aoi')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    console.error('Error fetching AOI detail server:', error);
    return null;
  }

  return data as AOI;
}

export async function getAnalysisDetailServer(id: string): Promise<Analysis | null> {
  if (isMockMode() || id.startsWith('ana-')) {
    return MOCK_ANALYSES.find((a) => a.id === id) || null;
  }

  const supabase = await createServerSideClient();
  const { data, error } = await supabase
    .from('analyses')
    .select('*, aoi:aoi_id(name, geometry)')
    .eq('id', id)
    .single();

  if (error) {
    console.error('Error fetching analysis detail server:', error);
    return null;
  }

  return {
    ...data,
    aoi_name: data.aoi?.name || 'Unknown AOI',
    aoi_geometry: data.aoi?.geometry || null,
  } as Analysis;
}

export async function getSentinelScenesServer(aoiId: string): Promise<SentinelScene[]> {
  const mockScenes: SentinelScene[] = [
    {
      id: 'sc-1',
      aoi_id: aoiId,
      scene_id: 'COPERNICUS/S2_SR_HARMONIZED/20260608T100231_T33UXQ',
      acquisition_date: '2026-06-08',
      orbit_direction: 'DESCENDING',
      polarizations: [],
      cloud_cover_pct: 1.2,
    },
    {
      id: 'sc-2',
      aoi_id: aoiId,
      scene_id: 'COPERNICUS/S1_GRD/S1A_IW_GRDH_1SDV_20260609T051214',
      acquisition_date: '2026-06-09',
      orbit_direction: 'ASCENDING',
      polarizations: ['VV', 'VH'],
      cloud_cover_pct: 0,
    },
    {
      id: 'sc-3',
      aoi_id: aoiId,
      scene_id: 'COPERNICUS/S2_SR_HARMONIZED/20260603T100231_T33UXQ',
      acquisition_date: '2026-06-03',
      orbit_direction: 'DESCENDING',
      polarizations: [],
      cloud_cover_pct: 12.4,
    },
    {
      id: 'sc-4',
      aoi_id: aoiId,
      scene_id: 'COPERNICUS/S1_GRD/S1A_IW_GRDH_1SDV_20260602T051214',
      acquisition_date: '2026-06-02',
      orbit_direction: 'ASCENDING',
      polarizations: ['VV', 'VH'],
      cloud_cover_pct: 0,
    },
  ];

  if (isMockMode()) {
    return mockScenes;
  }

  const supabase = await createServerSideClient();
  const { data, error } = await supabase
    .from('sentinel_scenes')
    .select('*')
    .eq('aoi_id', aoiId)
    .order('acquisition_date', { ascending: false });

  if (error || !data || data.length === 0) {
    return mockScenes;
  }

  return data.map((d: any) => ({
    id: d.id,
    aoi_id: d.aoi_id,
    scene_id: d.scene_id,
    acquisition_date: d.acquisition_date,
    orbit_direction: d.orbit_direction || 'N/A',
    polarizations: d.polarizations || [],
    cloud_cover_pct: Number(d.cloud_cover_pct) || 0,
  }));
}

export async function getAnalysesServer(): Promise<Analysis[]> {
  if (isMockMode()) {
    return MOCK_ANALYSES;
  }

  const supabase = await createServerSideClient();
  const { data, error } = await supabase
    .from('analyses')
    .select('*, aoi:aoi_id(name)')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching analyses server:', error);
    return [];
  }

  return data.map((a: any) => ({
    ...a,
    aoi_name: a.aoi?.name || 'Unknown AOI',
  })) as Analysis[];
}
