import { createServerSideClient } from '@/lib/supabase-server';
import { NextResponse } from 'next/server';
import { runGeeAnalysis } from '@/lib/gee-server';

function getDayOfYear(dateStr: string): number {
  const date = new Date(dateStr);
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  const oneDay = 1000 * 60 * 60 * 24;
  return Math.floor(diff / oneDay);
}

function getCropFromDescription(name: string, description: string): string {
  const text = `${name} ${description || ''}`.toLowerCase();
  if (text.includes('pšenic') || text.includes('wheat') || text.includes('psenice')) {
    return 'Pšenice ozimá';
  }
  if (text.includes('kukuřic') || text.includes('maize') || text.includes('corn') || text.includes('kukurice')) {
    return 'Kukuřice setá';
  }
  if (text.includes('řepk') || text.includes('rapeseed') || text.includes('oilseed') || text.includes('repka')) {
    return 'Řepka olejka';
  }
  if (text.includes('ječme') || text.includes('barley') || text.includes('jecmen')) {
    return 'Ječmen jarní';
  }
  if (text.includes('brambor') || text.includes('potato')) {
    return 'Brambory';
  }
  if (text.includes('cukrov') || text.includes('beet')) {
    return 'Cukrová řepa';
  }
  if (text.includes('trav') || text.includes('louka') || text.includes('pastv') || text.includes('grass')) {
    return 'Trvalý travní porost';
  }
  return 'Nespecifikovaná plodina';
}

function generateDatePoints(startStr: string, endStr: string): string[] {
  const start = new Date(startStr);
  const end = new Date(endStr);
  const dates: string[] = [];
  const curr = new Date(start);
  while (curr <= end) {
    dates.push(curr.toISOString().split('T')[0]);
    curr.setDate(curr.getDate() + 5); // every 5 days
  }
  const lastDate = end.toISOString().split('T')[0];
  if (dates.length === 0 || dates[dates.length - 1] !== lastDate) {
    dates.push(lastDate);
  }
  return dates;
}

function simulateCropIndex(crop: string, type: 'ndvi' | 'ndwi' | 'radiometric', dateStr: string, seed: number): number {
  const doy = getDayOfYear(dateStr);
  let baseVal = 0.5;
  
  // Use coordinates seed to add stable variation per field
  const randomOffset = Math.sin(seed + doy) * 0.05; // deterministic per day/field
  
  if (type === 'ndvi') {
    if (crop === 'Pšenice ozimá') {
      if (doy < 90) baseVal = 0.3 + doy * 0.001; // winter dormancy
      else if (doy < 155) baseVal = 0.38 + (doy - 90) * 0.007; // rapid greenup
      else if (doy < 185) baseVal = 0.83 - (doy - 155) * 0.005; // grain filling
      else if (doy < 215) baseVal = 0.68 - (doy - 185) * 0.015; // senescence & harvest
      else baseVal = 0.22; // stubble
    } else if (crop === 'Kukuřice setá') {
      if (doy < 120) baseVal = 0.2;
      else if (doy < 190) baseVal = 0.2 + (doy - 120) * 0.008; // late growth
      else if (doy < 235) baseVal = 0.78 + Math.sin(doy * 0.1) * 0.03; // peak
      else if (doy < 275) baseVal = 0.75 - (doy - 235) * 0.012; // dry down
      else baseVal = 0.25;
    } else if (crop === 'Řepka olejka') {
      if (doy < 90) baseVal = 0.35;
      else if (doy < 125) baseVal = 0.35 + (doy - 90) * 0.01; // spring growth
      else if (doy < 140) baseVal = 0.60; // temporary dip during yellow bloom
      else if (doy < 165) baseVal = 0.78 + (doy - 140) * 0.002; // pod development
      else if (doy < 200) baseVal = 0.75 - (doy - 165) * 0.015; // harvest prep
      else baseVal = 0.20;
    } else {
      // General crop curve
      baseVal = 0.3 + Math.sin(((doy - 80) / 200) * Math.PI) * 0.45;
      if (baseVal < 0.2) baseVal = 0.2;
      if (baseVal > 0.85) baseVal = 0.85;
    }
    return Math.max(0.1, Math.min(0.95, baseVal + randomOffset));
  } else if (type === 'ndwi') {
    const ndvi = simulateCropIndex(crop, 'ndvi', dateStr, seed);
    baseVal = (ndvi - 0.2) * 0.6 - 0.05;
    if (doy > 160 && doy < 240) {
      baseVal -= 0.08; // dry summer effect
    }
    return Math.max(-0.2, Math.min(0.5, baseVal + randomOffset * 0.5));
  } else {
    // Radiometric backscatter (Sentinel-1 soil moisture)
    if (doy > 90 && doy < 150) baseVal = -11.0;
    else if (doy >= 150 && doy < 240) baseVal = -15.5; // summer dryness
    else baseVal = -12.5; // autumn rain
    
    const rain = Math.sin(doy * 0.5) * 2.0;
    return Math.max(-20, Math.min(-5, baseVal + rain + randomOffset * 5));
  }
}

function generateCzechSummaryAndRecommendations(
  crop: string,
  type: string,
  meanVal: number,
  trend: number,
  areaHa: number,
  aoiName: string
): string {
  const trendWord = trend >= 0 ? 'nárůst' : 'pokles';
  const trendAbs = Math.abs(trend).toFixed(2);
  const trendPercent = Math.abs(trend * 100).toFixed(0);
  const areaStr = areaHa ? `${areaHa.toFixed(1)} ha` : '';

  let summary = '';

  if (type === 'ndvi') {
    summary += `Analýza vegetačního indexu NDVI pro sektor "${aoiName}" (${areaStr}, plodina: ${crop}) dokončena. `;
    summary += `Aktuální průměrná hodnota NDVI je ${meanVal.toFixed(2)}. `;
    summary += `Za posledních 14 dní byl zaznamenán ${trendWord} o ${trendAbs} (tj. ${trend >= 0 ? '+' : '-'}${trendPercent} %). `;
    
    if (meanVal >= 0.70) {
      summary += `Porost vykazuje vynikající vitalitu s vysokým obsahem chlorofylu a optimální hustotou listové plochy. `;
      if (crop === 'Pšenice ozimá') {
        summary += `U pšenice ozimé tato fáze indikuje úspěšné nalévání zrna. Doporučujeme sledovat porost z hlediska poléhání stébel a plánovat termín žní na základě dozrávání klasu.`;
      } else if (crop === 'Kukuřice setá') {
        summary += `Kukuřice setá prochází fází intenzivního vegetativního růstu. Doporučujeme provést kontrolu zaplevelení v okrajových částech sektoru.`;
      } else {
        summary += `Pokračujte v zavedeném agrotechnickém plánu bez nutnosti mimořádných zásahů.`;
      }
    } else if (meanVal >= 0.45) {
      summary += `Porost vykazuje průměrnou vitalitu s mírnou heterogenitou v rámci půdního bloku. `;
      if (crop === 'Pšenice ozimá') {
        summary += `Pšenice může vykazovat lokální nedostatek dusíku nebo rané známky dozrávání na sušších místech. Doporučujeme zvážit cílené hnojení na list u zaostávajících zón pro podporu bílkovin.`;
      } else {
        summary += `Doporučujeme provést vizuální kontrolu porostu v místech s nižším indexem a ověřit dostupnost klíčových živin.`;
      }
    } else {
      summary += `VAROVÁNÍ: Nízká úroveň NDVI (${meanVal.toFixed(2)}) značí vážně oslabenou vegetaci, řídký porost nebo poškození. `;
      summary += `Doporučujeme okamžitou fyzickou obchůzku sektoru k identifikaci příčiny (napadení škůdci, patogeny nebo poškození zvěří) a aplikaci nápravných opatření.`;
    }
  } else if (type === 'ndwi') {
    summary += `Analýza indexu vodního stresu NDWI pro sektor "${aoiName}" (${areaStr}, plodina: ${crop}) dokončena. `;
    summary += `Aktuální průměrná hodnota NDWI je ${meanVal.toFixed(2)}. `;
    summary += `Za sledované období 14 dní byl zaznamenán ${trendWord} obsahu vody v listech o ${trendAbs}. `;

    if (meanVal >= 0.15) {
      summary += `Zásobení rostlin vodou je plně dostačující. Pletiva vykazují optimální turgor. `;
      summary += `Závlaha není nutná. Monitorujte výskyt plísňových chorob z důvodu vyšší vlhkosti v mikroklimatu hustého porostu.`;
    } else if (meanVal >= 0.02) {
      summary += `Porost vykazuje počínající známky mírného vodního stresu. Obsah vody v pletivech je hraniční. `;
      summary += `Sledujte předpověď srážek. U citlivých plodin (zejména kukuřice v období metání a kvetení) zvažte spuštění závlahového systému pro zabránění redukce výnosu.`;
    } else {
      summary += `KRITICKÉ VAROVÁNÍ: Průměrné NDWI kleslo na ${meanVal.toFixed(2)}, což značí akutní suchý stres. `;
      summary += `Rostliny uzavírají průduchy, dochází k vadnutí a zastavení fotosyntézy. Pokud je dostupný závlahový systém, okamžitě jej aktivujte. Vyhněte se aplikaci minerálních hnojiv, hrozí popálení listů.`;
    }
  } else {
    // Soil moisture / radiometric backscatter
    const moisturePct = (meanVal + 20) * 3;
    const moisturePctRound = Math.max(0, Math.min(50, Math.round(moisturePct * 10) / 10));

    summary += `Radarová analýza půdní vlhkosti (Sentinel-1 SAR VV backscatter) pro sektor "${aoiName}" (${areaStr}, plodina: ${crop}) dokončena. `;
    summary += `Průměrný odraz VV je ${meanVal.toFixed(1)} dB, což odpovídá odhadované objemové vlhkosti půdy ${moisturePctRound} %. `;
    summary += `Během 14 dní došlo k ${trend >= 0 ? 'nasycení' : 'vysychání'} ornice (změna o ${trend.toFixed(1)} dB). `;

    if (moisturePctRound >= 28) {
      summary += `Půda je silně nasycená, v depresních místech hrozí zamokření. `;
      summary += `Doporučujeme odložit pojezdy těžké techniky, aby nedocházelo k nežádoucímu utužování půdy (kompaktaci) a zničení půdní struktury. Zkontrolujte funkčnost drenážních prvků.`;
    } else if (moisturePctRound >= 18) {
      summary += `Vlhkost ornice je v optimálním rozmezí pro rozvoj kořenového systému a příjem živin z půdního roztoku. `;
      summary += `Podmínky jsou ideální pro mechanickou kultivaci (např. plečkování) nebo aplikaci ochranných a výživových postřiků.`;
    } else {
      summary += `VAROVÁNÍ: Nízká úroveň půdní vlhkosti (${moisturePctRound} %) značí sucho v povrchové vrstvě ornice. Kořeny mají zhoršený přístup k živinám (zejména fosforu a draslíku). `;
      summary += `Doporučujeme minimalizovat jakékoliv kypření půdy, které by zvýšilo odpar zbylé vody. Uplatněte půdoochranné postupy (ponechání mulče na povrchu, minimalizace zpracování).`;
    }
  }

  return summary;
}

export async function GET(req: Request, { params }: { params: Promise<{ taskId: string }> }) {
  try {
    const { taskId } = await params;
    
    const supabase = await createServerSideClient();

    // 1. Authenticate user
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Check if task is mock
    if (taskId.startsWith('mock-task-')) {
      const analysisId = taskId.replace('mock-task-', '');

      // 2. Fetch analysis record with related AOI
      const { data: analysis, error: fetchErr } = await supabase
        .from('analyses')
        .select('*, aoi:aoi_id (*)')
        .eq('id', analysisId)
        .single();

      if (fetchErr || !analysis) {
        return NextResponse.json({ status: 'failed', error: 'Analysis not found' }, { status: 404 });
      }

      // If already completed or failed, return immediately
      if (analysis.status === 'completed') {
        return NextResponse.json({ status: 'completed', result: analysis.result_data });
      }
      if (analysis.status === 'failed') {
        return NextResponse.json({ status: 'failed', error: analysis.error_message });
      }

      // Compute elapsed time (seconds)
      const startTime = new Date(analysis.started_at).getTime();
      const now = new Date().getTime();
      const elapsedSec = (now - startTime) / 1000;

      if (elapsedSec < 2) {
        return NextResponse.json({
          status: 'processing',
          progress: 20,
          phase: 'Načítání družicových překryvů Sentinel-1/2...',
        });
      } else if (elapsedSec < 4) {
        return NextResponse.json({
          status: 'processing',
          progress: 50,
          phase: 'Zpracování surových spektrálních a dielektrických pásem...',
        });
      } else if (elapsedSec < 6) {
        return NextResponse.json({
          status: 'processing',
          progress: 80,
          phase: 'Výpočet fyzikálních indexů a generování agronomického reportu...',
        });
      } else {
        // Complete the mock analysis! Generate metrics based on type and crop
        const type = analysis.analysis_type;
        const start = analysis.parameters?.date_range?.start || '2026-05-26';
        const end = analysis.parameters?.date_range?.end || '2026-06-09';
        const aoiName = analysis.aoi?.name || 'Sektor';
        const aoiDescription = analysis.aoi?.description || '';
        const crop = getCropFromDescription(aoiName, aoiDescription);
        
        // Seed calculation for deterministic results
        const seed = analysis.aoi?.id 
          ? analysis.aoi.id.split('').reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0)
          : 42;

        let finalData: any = {};

        if (type === 'ndvi') {
          const dates = generateDatePoints(start, end);
          const timeseries = dates.map(date => {
            const ndviVal = simulateCropIndex(crop, 'ndvi', date, seed);
            const ndwiVal = simulateCropIndex(crop, 'ndwi', date, seed);
            return { date, ndvi: ndviVal, ndwi: ndwiVal };
          });

          const latest = timeseries[timeseries.length - 1];
          const earliest = timeseries[0];
          const meanNdvi = latest.ndvi;
          const minNdvi = Math.min(...timeseries.map(t => t.ndvi));
          const maxNdvi = Math.max(...timeseries.map(t => t.ndvi));
          const trend = latest.ndvi - earliest.ndvi;
          const isAlert = meanNdvi < 0.4;

          const summary = generateCzechSummaryAndRecommendations(
            crop,
            'ndvi',
            meanNdvi,
            trend,
            Number(analysis.aoi?.area_ha || 0),
            aoiName
          );

          finalData = {
            analysis_type: 'ndvi',
            date_range: { start, end },
            scenes_count: timeseries.length,
            mean_ndvi: meanNdvi,
            min_ndvi: minNdvi,
            max_ndvi: maxNdvi,
            trend_14d: trend,
            alert_status: isAlert ? 'DROUGHT RISK' : 'NOMINAL',
            geotiff_preview_url: '/mock/ndvi_layer.tif',
            timeseries,
            ai_summary: summary,
          };
        } else if (type === 'ndwi') {
          const dates = generateDatePoints(start, end);
          const timeseries = dates.map(date => {
            const ndviVal = simulateCropIndex(crop, 'ndvi', date, seed);
            const ndwiVal = simulateCropIndex(crop, 'ndwi', date, seed);
            return { date, ndvi: ndviVal, ndwi: ndwiVal };
          });

          const latest = timeseries[timeseries.length - 1];
          const earliest = timeseries[0];
          const meanNdwi = latest.ndwi;
          const minNdwi = Math.min(...timeseries.map(t => t.ndwi));
          const maxNdwi = Math.max(...timeseries.map(t => t.ndwi));
          const trend = latest.ndwi - earliest.ndwi;
          const isAlert = meanNdwi < 0.15;

          const summary = generateCzechSummaryAndRecommendations(
            crop,
            'ndwi',
            meanNdwi,
            trend,
            Number(analysis.aoi?.area_ha || 0),
            aoiName
          );

          finalData = {
            analysis_type: 'ndwi',
            date_range: { start, end },
            scenes_count: timeseries.length,
            mean_ndwi: meanNdwi,
            min_ndwi: minNdwi,
            max_ndwi: maxNdwi,
            trend_14d: trend,
            alert_status: isAlert ? 'DROUGHT RISK' : 'NOMINAL',
            geotiff_preview_url: '/mock/ndwi_layer.tif',
            timeseries,
            ai_summary: summary,
          };
        } else {
          // Radiometric / Polarimetric / Interferometric backscatter (Sentinel-1)
          const dates = generateDatePoints(start, end);
          const timeseries = dates.map(date => {
            const vv_db = simulateCropIndex(crop, 'radiometric', date, seed);
            const vh_db = vv_db - 6.0; // standard offset
            return { date, vv_db, vh_db };
          });

          const latest = timeseries[timeseries.length - 1];
          const earliest = timeseries[0];
          const meanBackscatter = latest.vv_db;
          const minBackscatter = Math.min(...timeseries.map(t => t.vv_db));
          const maxBackscatter = Math.max(...timeseries.map(t => t.vv_db));
          const trend = latest.vv_db - earliest.vv_db;
          const moisturePct = (meanBackscatter + 20) * 3;
          const moisturePctRound = Math.max(0, Math.min(50, Math.round(moisturePct * 10) / 10));
          const isAlert = moisturePctRound < 18;

          const summary = generateCzechSummaryAndRecommendations(
            crop,
            type,
            meanBackscatter,
            trend,
            Number(analysis.aoi?.area_ha || 0),
            aoiName
          );

          finalData = {
            analysis_type: type,
            date_range: { start, end },
            scenes_count: timeseries.length,
            mean_backscatter_vv: meanBackscatter,
            min_backscatter_vv: minBackscatter,
            max_backscatter_vv: maxBackscatter,
            std_dev_vv: 1.8 + (seed % 5) * 0.1,
            trend_14d: trend,
            moisture_estimate_pct: moisturePctRound,
            drought_risk: isAlert,
            alert_message: isAlert 
              ? `Riziko sucha: Půdní vlhkost v ornici je kriticky nízká (${moisturePctRound} %).`
              : 'Vlhkostní poměry v normě.',
            geotiff_preview_url: '/mock/vysocina_backscatter.tif',
            timeseries,
            ai_summary: summary,
          };
        }

        // Save results to database
        const { error: updateErr } = await supabase
          .from('analyses')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            result_data: finalData,
          })
          .eq('id', analysisId);

        if (updateErr) {
          throw updateErr;
        }

        // Add audit log
        await supabase.from('audit_log').insert({
          user_id: session.user.id,
          action: 'COMPLETE_ANALYSIS',
          resource_type: 'analyses',
          resource_id: analysisId,
          metadata: { analysis_type: type, source: 'mock_dynamic' },
        });

        return NextResponse.json({ status: 'completed', result: finalData });
      }
    } else if (taskId.startsWith('gee-task-')) {
      const analysisId = taskId.replace('gee-task-', '');

      // Fetch analysis record with its AOI geometry
      const { data: analysis, error: fetchErr } = await supabase
        .from('analyses')
        .select('*, aoi:aoi_id (*)')
        .eq('id', analysisId)
        .single();

      if (fetchErr || !analysis) {
        return NextResponse.json({ status: 'failed', error: 'Analysis not found' }, { status: 404 });
      }

      // If already completed or failed, return immediately
      if (analysis.status === 'completed') {
        return NextResponse.json({ status: 'completed', result: analysis.result_data });
      }
      if (analysis.status === 'failed') {
        return NextResponse.json({ status: 'failed', error: analysis.error_message });
      }

      // Run live Google Earth Engine computation
      try {
        const aoiObj = analysis.aoi as any;
        if (!aoiObj || !aoiObj.geometry) {
          throw new Error('AOI geometry is missing.');
        }

        const geeResult = await runGeeAnalysis(aoiObj.geometry, analysis.parameters);

        // Enrich GEE result with our localized Czech agronomical summary
        const crop = getCropFromDescription(aoiObj.name || '', aoiObj.description || '');
        const type = analysis.analysis_type;
        
        let meanVal = 0;
        if (type === 'ndvi') {
          meanVal = geeResult.mean_ndvi || 0;
        } else if (type === 'ndwi') {
          meanVal = geeResult.mean_ndwi || 0;
        } else {
          meanVal = geeResult.mean_backscatter_vv || 0;
        }

        geeResult.ai_summary = generateCzechSummaryAndRecommendations(
          crop,
          type,
          meanVal,
          geeResult.trend_14d || 0,
          Number(aoiObj.area_ha || 0),
          aoiObj.name || 'Sektor'
        );

        // Update database to completed
        const { error: updateErr } = await supabase
          .from('analyses')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            result_data: geeResult,
          })
          .eq('id', analysisId);

        if (updateErr) {
          throw updateErr;
        }

        // Add audit log
        await supabase.from('audit_log').insert({
          user_id: session.user.id,
          action: 'COMPLETE_ANALYSIS',
          resource_type: 'analyses',
          resource_id: analysisId,
          metadata: { analysis_type: analysis.analysis_type, engine: 'gee_real' },
        });

        return NextResponse.json({ status: 'completed', result: geeResult });
      } catch (err: any) {
        console.error('Real GEE computation failed:', err);

        // Update database to failed
        await supabase
          .from('analyses')
          .update({
            status: 'failed',
            error_message: err.message || 'Chyba při zpracování v Google Earth Engine'
          })
          .eq('id', analysisId);

        return NextResponse.json({ status: 'failed', error: err.message || 'GEE analysis execution failed' });
      }
    } else {
      // Real Google Earth Engine Status check (fallback for older operations)
      const eeResult = await pollRealGeeOperation(taskId);
      
      if (eeResult.done) {
        if (eeResult.error) {
          await supabase
            .from('analyses')
            .update({ status: 'failed', error_message: eeResult.error })
            .eq('gee_task_id', taskId);
            
          return NextResponse.json({ status: 'failed', error: eeResult.error });
        }

        return NextResponse.json({ status: 'completed', result: eeResult.response });
      }

      return NextResponse.json({ status: 'processing', progress: 50, phase: 'Running GEE Operation...' });
    }
  } catch (err: any) {
    console.error('Polling endpoint error:', err);
    return NextResponse.json({ status: 'failed', error: err.message || 'Polling handler failure' }, { status: 500 });
  }
}

// Dummy helper representing active polling of the GEE REST Operations API
async function pollRealGeeOperation(operationId: string): Promise<{ done: boolean; error?: string; response?: any }> {
  return { done: false };
}
