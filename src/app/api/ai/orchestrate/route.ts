import OpenAI from 'openai';
import { NextResponse } from 'next/server';

const SYSTEM_PROMPT = `You are PhasQ's analysis orchestrator. You translate user requests about agricultural land and satellite telemetry into precise analysis parameters.

CONTEXT:
- PhasQ analyzes land telemetry using physics-based satellite indices (optical NDVI/NDWI and radar Sentinel-1 SAR). NO generative AI is used in calculations.
- Analysis types:
  * "ndvi": Sentinel-2 Normalized Difference Vegetation Index (for crop health, vigor, chlorophyll activity).
  * "ndwi": Sentinel-2 Normalized Difference Water Index (for canopy water stress, plant leaf moisture content).
  * "radiometric": Sentinel-1 SAR backscatter amplitude (for soil moisture estimates).
  * "polarimetric": Sentinel-1 dual-polarization index (for biomass and crop structure).
  * "interferometric": Sentinel-1 InSAR phase differences (for land subsidence, micro-movements).
- You ONLY determine parameters. You do NOT perform the analysis.

OUTPUT: Respond ONLY with valid JSON. No markdown, no explanation.

JSON SCHEMA:
{
  "analysis_type": "ndvi" | "ndwi" | "radiometric" | "polarimetric" | "interferometric",
  "date_range": {
    "start": "YYYY-MM-DD",
    "end": "YYYY-MM-DD"
  },
  "polarization": "VV" | "VH" | "VV+VH",
  "orbit_direction": "ASCENDING" | "DESCENDING" | "BOTH",
  "specific_focus": string,          // description of what to monitor
  "alert_threshold": number | null,  // alert trigger value (e.g., -17 for backscatter decline in dB, or 0.3 for NDVI stress threshold)
  "confidence_level": "high" | "medium" | "low",
  "human_summary": string            // 1 sentence summary of planned actions in user language (EN/CZ)
}

RULES:
- Default date_range: last 14 days unless specified.
- For crop health/vigor: use "ndvi".
- For vegetation water content/canopy dehydration: use "ndwi".
- For soil moisture/dielectric constant: use "radiometric" + "VV" polarization.
- If request is ambiguous, choose "ndvi" as default.
- TODAY is: 2026-06-09. All date calculations must be relative to this date.`;

export async function POST(req: Request) {
  try {
    const { prompt, language = 'en' } = await req.json();

    if (!prompt) {
      return NextResponse.json({ success: false, error: 'Prompt is required' }, { status: 400 });
    }

    // Check if OpenAI key is missing or default placeholder
    const apiKey = process.env.OPENAI_API_KEY;
    const isMockKey = !apiKey || apiKey.startsWith('sk-your-');

    if (isMockKey) {
      console.log('OpenAI key missing or mock. Running regex-based heuristic orchestrator fallback.');
      const parsed = runHeuristicFallback(prompt, language);
      return NextResponse.json({ success: true, params: parsed });
    }

    const openai = new OpenAI({ apiKey });
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt }
      ],
      temperature: 0,
      max_tokens: 500,
    });

    const content = completion.choices[0].message.content || '{}';
    // Clean potential markdown wrapped blocks
    const cleanedJson = content.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleanedJson);

    return NextResponse.json({ success: true, params: parsed });
  } catch (err: any) {
    console.error('AI Orchestrator error:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to parse AI response' },
      { status: 500 }
    );
  }
}

// Fail-safe heuristic parser if OpenAI key is not configured
function runHeuristicFallback(prompt: string, lang: string) {
  const norm = prompt.toLowerCase();
  
  let analysis_type: 'ndvi' | 'ndwi' | 'radiometric' | 'polarimetric' | 'interferometric' = 'ndvi';
  let specific_focus = 'crop health check';
  let human_summary = 'Analyzing crop health and NDVI vigor indices over the last 14 days.';
  let alert_threshold: number | null = 0.35; // NDVI stress baseline
  let polarization: 'VV' | 'VH' | 'VV+VH' = 'VV';

  const todayStr = '2026-06-09';
  const startStr = '2026-05-26'; // 14 days prior

  if (norm.includes('ndwi') || norm.includes('water') || norm.includes('vlhkost rostlin') || norm.includes('hydrat') || norm.includes('canopy')) {
    analysis_type = 'ndwi';
    specific_focus = 'canopy water contents';
    human_summary = lang === 'cz' || norm.includes('zkontr')
      ? 'Vypočet indexu NDWI pro stanovení vodního deficitu v listech rostlin.'
      : 'Computing NDWI vegetation canopy moisture content indices.';
    alert_threshold = 0.15;
  } else if (norm.includes('moisture') || norm.includes('soil') || norm.includes('půd') || norm.includes('vlhkost') || norm.includes('radar') || norm.includes('backscatter') || norm.includes('radiometric')) {
    analysis_type = 'radiometric';
    specific_focus = 'soil dielectric constant';
    human_summary = lang === 'cz' || norm.includes('zkontr')
      ? 'Analýza vlhkosti půdy pomocí amplitudového zpětného rozptylu (SAR).'
      : 'Analyzing soil moisture profiles using radar backscatter amplitude.';
    alert_threshold = -17; // dB threshold
  } else if (norm.includes('biomass') || norm.includes('polar') || norm.includes('biomas')) {
    analysis_type = 'polarimetric';
    specific_focus = 'crop structure and biomass';
    human_summary = 'Analyzing crop structure and biomass using dual-polarization indexes.';
    alert_threshold = null;
  } else if (norm.includes('subsidence') || norm.includes('insar') || norm.includes('pohyb') || norm.includes('interfer')) {
    analysis_type = 'interferometric';
    specific_focus = 'ground subsidence and micro-movements';
    human_summary = 'Analyzing interferometric InSAR phases to measure surface deformation.';
    alert_threshold = null;
  } else {
    // default is ndvi
    human_summary = lang === 'cz' || norm.includes('zkontr')
      ? 'Výpočet indexu NDVI pro kontrolu hustoty a zdraví vegetace.'
      : 'Analyzing crop health and NDVI vigor indices over the last 14 days.';
  }

  return {
    analysis_type,
    date_range: {
      start: startStr,
      end: todayStr
    },
    polarization,
    orbit_direction: 'BOTH',
    specific_focus,
    alert_threshold,
    confidence_level: 'high',
    human_summary
  };
}
