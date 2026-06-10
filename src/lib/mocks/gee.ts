export const MOCK_RADIOMETRIC_RESULT = {
  analysis_type: 'radiometric',
  date_range: { start: '2026-05-26', end: '2026-06-09' },
  scenes_count: 3,
  mean_backscatter_vv: -12.4,    // dB
  min_backscatter_vv: -18.7,
  max_backscatter_vv: -8.2,
  std_dev_vv: 2.1,
  trend_14d: -2.3,               // dB pokles za 14 dní
  moisture_estimate_pct: 23.4,   // % objemová vlhkost
  drought_risk: true,
  alert_message: 'Soil moisture -17% below seasonal baseline. Yield risk in 14 days.',
  geotiff_preview_url: '/mock/vysocina_backscatter.tif',
  timeseries: [
    { date: '2026-05-26', vv_db: -10.1, vh_db: -17.3 },
    { date: '2026-06-02', vv_db: -11.4, vh_db: -18.1 },
    { date: '2026-06-09', vv_db: -12.4, vh_db: -19.2 },
  ],
  ai_summary: 'Soil moisture in Sector B-3 has declined 17% below seasonal average. Recommend initiating irrigation within 3–5 days to prevent yield loss.'
};
