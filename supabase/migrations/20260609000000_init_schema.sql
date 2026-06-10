-- Supabase / PostgreSQL database schema for PhasQ

-- Drop existing tables if they exist
DROP TABLE IF EXISTS public.audit_log CASCADE;
DROP TABLE IF EXISTS public.sentinel_scenes CASCADE;
DROP TABLE IF EXISTS public.analyses CASCADE;
DROP TABLE IF EXISTS public.aoi CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- 1. PROFILES Table (Extends Supabase auth.users)
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  full_name TEXT,
  organization TEXT,
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'agri_basic', 'agri_pro', 'defense')),
  hectare_quota INTEGER DEFAULT 500,        -- max ha/měsíc
  hectare_used INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. AREAS OF INTEREST (AOI) Table
CREATE TABLE public.aoi (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  geometry JSONB NOT NULL,                  -- GeoJSON Polygon
  area_ha DECIMAL(10,2),                    -- vypočtená plocha v ha
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. ANALYSES Table
CREATE TABLE public.analyses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  aoi_id UUID REFERENCES public.aoi(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  analysis_type TEXT NOT NULL CHECK (analysis_type IN (
    'ndvi',             -- Sentinel-2 NDVI
    'ndwi',             -- Sentinel-2 NDWI
    'radiometric',      -- Sentinel-1 SAR Backscatter (VV/VH)
    'polarimetric',     -- Sentinel-1 PolSAR
    'interferometric'   -- Sentinel-1 InSAR
  )),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'processing', 'completed', 'failed'
  )),
  parameters JSONB,                         -- input params: date range, polarizations, etc.
  prompt_original TEXT,                     -- user input query
  prompt_parsed JSONB,                      -- OpenAI parsed params
  result_data JSONB,                        -- statistics, timeseries output
  result_geotiff_url TEXT,                  -- Cloud Storage URL for visual layer
  result_report_url TEXT,                   -- PDF report URL
  gee_task_id TEXT,                         -- GEE task ID
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. SENTINEL SCENES (Cache of available passes) Table
CREATE TABLE public.sentinel_scenes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  aoi_id UUID REFERENCES public.aoi(id) ON DELETE CASCADE,
  scene_id TEXT NOT NULL,                   -- GEE asset ID
  acquisition_date DATE NOT NULL,
  orbit_direction TEXT CHECK (orbit_direction IN ('ASCENDING', 'DESCENDING')),
  polarizations TEXT[],                     -- ['VV', 'VH']
  cloud_cover_pct DECIMAL(5,2),
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. AUDIT LOG Table
CREATE TABLE public.audit_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id UUID,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Row Level Security (RLS) Configuration

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can only access own profile" ON public.profiles
  FOR ALL USING (auth.uid() = id);

ALTER TABLE public.aoi ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can only access own AOI" ON public.aoi
  FOR ALL USING (auth.uid() = user_id);

ALTER TABLE public.analyses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can only access own analyses" ON public.analyses
  FOR ALL USING (auth.uid() = user_id);

ALTER TABLE public.sentinel_scenes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view scenes for own AOI" ON public.sentinel_scenes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.aoi 
      WHERE public.aoi.id = public.sentinel_scenes.aoi_id 
      AND public.aoi.user_id = auth.uid()
    )
  );

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own audit logs" ON public.audit_log
  FOR SELECT USING (auth.uid() = user_id);
