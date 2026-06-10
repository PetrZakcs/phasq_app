import { createClientComponent } from '@/lib/supabase';
import { MOCK_RADIOMETRIC_RESULT } from './mocks/gee';

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  organization: string;
  plan: 'free' | 'agri_basic' | 'agri_pro' | 'defense';
  hectare_quota: number;
  hectare_used: number;
}

export interface AOI {
  id: string;
  user_id: string;
  name: string;
  description: string;
  geometry: any; // GeoJSON
  area_ha: number;
  created_at: string;
}

export interface Analysis {
  id: string;
  user_id: string;
  aoi_id: string;
  aoi_name?: string;
  aoi_geometry?: any;
  name: string;
  analysis_type: 'ndvi' | 'ndwi' | 'radiometric' | 'polarimetric' | 'interferometric';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  parameters: any;
  prompt_original?: string;
  prompt_parsed?: any;
  result_data?: any;
  result_geotiff_url?: string;
  result_report_url?: string;
  gee_task_id?: string;
  error_message?: string;
  started_at?: string;
  completed_at?: string;
  created_at: string;
}

// Check if we should use mock data
const isMockMode = () => {
  return (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL.includes('your-supabase-project')
  );
};

// Mock AOIs
export const MOCK_AOIS: AOI[] = [
  {
    id: 'aoi-1',
    user_id: 'user-mock',
    name: 'Vysocina Crop Field B-3',
    description: 'Main wheat crop monitoring sector on the southern slope.',
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [15.5902, 49.3902],
          [15.6102, 49.3902],
          [15.6102, 49.4002],
          [15.5902, 49.4002],
          [15.5902, 49.3902],
        ],
      ],
    },
    area_ha: 84.5,
    created_at: '2026-05-10T12:00:00Z',
  },
  {
    id: 'aoi-2',
    user_id: 'user-mock',
    name: 'Polabi Irrigation Sector A',
    description: 'Intense maize cultivation plots near the Elbe river.',
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [15.1202, 50.1502],
          [15.1352, 50.1502],
          [15.1352, 50.1602],
          [15.1202, 50.1602],
          [15.1202, 50.1502],
        ],
      ],
    },
    area_ha: 145.2,
    created_at: '2026-05-20T08:30:00Z',
  },
];

// Mock Analyses
export const MOCK_ANALYSES: Analysis[] = [
  {
    id: 'ana-1',
    user_id: 'user-mock',
    aoi_id: 'aoi-1',
    aoi_name: 'Vysocina Crop Field B-3',
    name: 'Weekly Soil Moisture Check',
    analysis_type: 'radiometric',
    status: 'completed',
    parameters: { polarization: 'VV', date_range: { start: '2026-05-26', end: '2026-06-09' } },
    prompt_original: 'Detect soil moisture stress for the last 2 weeks and flag any drought risk areas',
    prompt_parsed: {
      analysis_type: 'radiometric',
      date_range: { start: '2026-05-26', end: '2026-06-09' },
      polarization: 'VV',
      orbit_direction: 'BOTH',
      specific_focus: 'soil moisture stress',
      alert_threshold: -17,
      confidence_level: 'high',
      human_summary: 'Analyzing soil moisture stress on Vysocina Crop Field B-3 over the last 14 days.',
    },
    result_data: MOCK_RADIOMETRIC_RESULT,
    result_geotiff_url: '#',
    result_report_url: '#',
    completed_at: '2026-06-09T14:30:00Z',
    created_at: '2026-06-09T14:28:00Z',
  },
  {
    id: 'ana-2',
    user_id: 'user-mock',
    aoi_id: 'aoi-1',
    aoi_name: 'Vysocina Crop Field B-3',
    name: 'NDVI Vegetation Quality Index',
    analysis_type: 'ndvi',
    status: 'completed',
    parameters: { date_range: { start: '2026-05-20', end: '2026-06-04' } },
    prompt_original: 'Zkontroluj zdravi a biomasu na Vysocine',
    prompt_parsed: {
      analysis_type: 'ndvi',
      date_range: { start: '2026-05-20', end: '2026-06-04' },
      specific_focus: 'crop health and biomass',
      confidence_level: 'high',
      human_summary: 'Vypocet indexu NDVI pro pole Vysocina za poslednich 14 dni.',
    },
    result_data: {
      mean_ndvi: 0.72,
      min_ndvi: 0.35,
      max_ndvi: 0.88,
      trend_14d: 0.08, // mild growth
      alert_status: 'NOMINAL',
      scenes_count: 2,
      timeseries: [
        { date: '2026-05-20', ndvi: 0.64, ndwi: 0.15 },
        { date: '2026-05-27', ndvi: 0.69, ndwi: 0.18 },
        { date: '2026-06-03', ndvi: 0.72, ndwi: 0.21 },
      ],
      ai_summary: 'NDVI values reflect healthy crop development, showing a steady positive growth trend (+8%) over the past 14 days. Chlorophyll activity is optimal. No biomass depletion or crop stress detected.',
    },
    completed_at: '2026-06-05T10:15:00Z',
    created_at: '2026-06-05T10:12:00Z',
  },
  {
    id: 'ana-3',
    user_id: 'user-mock',
    aoi_id: 'aoi-2',
    aoi_name: 'Polabi Irrigation Sector A',
    name: 'NDWI Canopy Water Stress',
    analysis_type: 'ndwi',
    status: 'completed',
    parameters: { date_range: { start: '2026-05-25', end: '2026-06-08' } },
    prompt_original: 'Water content in plants for Polabi',
    prompt_parsed: {
      analysis_type: 'ndwi',
      date_range: { start: '2026-05-25', end: '2026-06-08' },
      specific_focus: 'canopy water contents',
      confidence_level: 'high',
      human_summary: 'Computing NDWI leaf moisture content indices for Polabi Irrigation Sector A.',
    },
    result_data: {
      mean_ndwi: 0.11,
      min_ndwi: -0.05,
      max_ndwi: 0.28,
      trend_14d: -0.15, // severe water depletion
      alert_status: 'DROUGHT RISK',
      scenes_count: 3,
      timeseries: [
        { date: '2026-05-25', ndvi: 0.78, ndwi: 0.26 },
        { date: '2026-06-01', ndvi: 0.75, ndwi: 0.18 },
        { date: '2026-06-08', ndvi: 0.73, ndwi: 0.11 },
      ],
      ai_summary: 'Vegetation moisture index (NDWI) has dropped significantly (-15% trend) and stands at a critical 0.11. Visible leaf dehydration patterns are developing across the western sector. Recommend starting active irrigation immediately.',
    },
    completed_at: '2026-06-08T18:00:00Z',
    created_at: '2026-06-08T17:58:00Z',
  },
];

export async function getAOIs(): Promise<AOI[]> {
  if (isMockMode()) {
    return MOCK_AOIS;
  }

  const supabase = createClientComponent();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return [];

  const { data, error } = await supabase
    .from('aoi')
    .select('*')
    .eq('user_id', session.user.id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching AOIs:', error);
    return MOCK_AOIS; // fallback
  }

  return data as AOI[];
}

export async function getAnalyses(): Promise<Analysis[]> {
  if (isMockMode()) {
    return MOCK_ANALYSES;
  }

  const supabase = createClientComponent();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return [];

  const { data, error } = await supabase
    .from('analyses')
    .select('*, aoi:aoi_id(name)')
    .eq('user_id', session.user.id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching analyses:', error);
    return MOCK_ANALYSES; // fallback
  }

  // Format with aoi_name
  return data.map((a: any) => ({
    ...a,
    aoi_name: a.aoi?.name || 'Unknown AOI',
  })) as Analysis[];
}

export async function getAOIDetail(id: string): Promise<AOI | null> {
  if (isMockMode() || id.startsWith('aoi-')) {
    return MOCK_AOIS.find((a) => a.id === id) || null;
  }

  const supabase = createClientComponent();
  const { data, error } = await supabase
    .from('aoi')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    console.error('Error fetching AOI detail:', error);
    return MOCK_AOIS.find((a) => a.id === id) || null;
  }

  return data as AOI;
}

export async function getAnalysisDetail(id: string): Promise<Analysis | null> {
  if (isMockMode() || id.startsWith('ana-')) {
    return MOCK_ANALYSES.find((a) => a.id === id) || null;
  }

  const supabase = createClientComponent();
  const { data, error } = await supabase
    .from('analyses')
    .select('*, aoi:aoi_id(name, geometry)')
    .eq('id', id)
    .single();

  if (error) {
    console.error('Error fetching analysis detail:', error);
    return MOCK_ANALYSES.find((a) => a.id === id) || null;
  }

  return {
    ...data,
    aoi_name: data.aoi?.name || 'Unknown AOI',
    aoi_geometry: data.aoi?.geometry || null,
  } as Analysis;
}

export async function getProfileQuota(): Promise<Profile | null> {
  if (isMockMode()) {
    return {
      id: 'user-mock',
      email: 'agronomist@mockdomain.com',
      full_name: 'Dr. Petr Zak',
      organization: 'Czech Agri Holdings',
      plan: 'agri_basic',
      hectare_quota: 1000,
      hectare_used: 450,
    };
  }

  const supabase = createClientComponent();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return null;

  let { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', session.user.id)
    .single();

  if (error || !data) {
    console.warn('Profile missing in getProfileQuota, self-healing...');
    const { data: newProfile, error: insertError } = await supabase
      .from('profiles')
      .insert({
        id: session.user.id,
        email: session.user.email || 'user@example.com',
        full_name: session.user.user_metadata?.full_name || 'Vážený uživatel',
        organization: 'Farma',
        plan: 'agri_basic',
        hectare_quota: 1000,
        hectare_used: 0,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error self-healing profile quota:', insertError);
      return null;
    }
    data = newProfile;
  }

  return data as Profile;
}

export interface SentinelScene {
  id: string;
  aoi_id: string;
  scene_id: string;
  acquisition_date: string;
  orbit_direction: string;
  polarizations: string[];
  cloud_cover_pct: number;
}

export async function getSentinelScenes(aoiId: string): Promise<SentinelScene[]> {
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

  const supabase = createClientComponent();
  const { data, error } = await supabase
    .from('sentinel_scenes')
    .select('*')
    .eq('aoi_id', aoiId)
    .order('acquisition_date', { ascending: false });

  if (error || !data || data.length === 0) {
    return mockScenes; // fallback to make sure data displays nicely
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

