import { createServerSideClient } from '@/lib/supabase-server';
import { NextResponse } from 'next/server';
import { MOCK_RADIOMETRIC_RESULT } from '@/lib/mocks/gee';
import { runGeeAnalysis } from '@/lib/gee-server';

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

      // 2. Fetch analysis record
      const { data: analysis, error: fetchErr } = await supabase
        .from('analyses')
        .select('*')
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
          phase: 'Fetching Sentinel-1/2 coordinate overlays...',
        });
      } else if (elapsedSec < 4) {
        return NextResponse.json({
          status: 'processing',
          progress: 50,
          phase: 'Processing raw dielectric & optical spectral bands...',
        });
      } else if (elapsedSec < 6) {
        return NextResponse.json({
          status: 'processing',
          progress: 80,
          phase: 'Computing physics-based indices & compiling report...',
        });
      } else {
        // Complete the mock analysis! Generate metrics based on type
        const type = analysis.analysis_type;
        let finalData: any = {};

        if (type === 'ndvi') {
          finalData = {
            analysis_type: 'ndvi',
            date_range: analysis.parameters?.date_range || { start: '2026-05-26', end: '2026-06-09' },
            scenes_count: 2,
            mean_ndvi: 0.72,
            min_ndvi: 0.35,
            max_ndvi: 0.88,
            trend_14d: 0.08, // positive growth
            alert_status: 'NOMINAL',
            geotiff_preview_url: '/mock/ndvi_layer.tif',
            timeseries: [
              { date: '2026-05-26', ndvi: 0.64, ndwi: 0.15 },
              { date: '2026-06-02', ndvi: 0.68, ndwi: 0.19 },
              { date: '2026-06-09', ndvi: 0.72, ndwi: 0.21 },
            ],
            ai_summary: 'NDVI crop health analysis reports healthy vegetative growth (+8% trend) across the sector. Biomass density and chlorophyll absorption are optimal. No immediate irrigation intervention is required.',
          };
        } else if (type === 'ndwi') {
          finalData = {
            analysis_type: 'ndwi',
            date_range: analysis.parameters?.date_range || { start: '2026-05-26', end: '2026-06-09' },
            scenes_count: 3,
            mean_ndwi: 0.11,
            min_ndwi: -0.05,
            max_ndwi: 0.28,
            trend_14d: -0.15, // severe moisture loss
            alert_status: 'DROUGHT RISK',
            geotiff_preview_url: '/mock/ndwi_layer.tif',
            timeseries: [
              { date: '2026-05-26', ndvi: 0.78, ndwi: 0.26 },
              { date: '2026-06-02', ndvi: 0.75, ndwi: 0.18 },
              { date: '2026-06-09', ndvi: 0.73, ndwi: 0.11 },
            ],
            ai_summary: 'Critical warning: Leaf water content (NDWI) has depreciated by 15% to 0.11 over the past two weeks. Mild canopy dehydration is visible. Highly recommend scheduling irrigation in the western quadrant within 48 hours.',
          };
        } else {
          // default/radiometric backscatter
          finalData = MOCK_RADIOMETRIC_RESULT;
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
          metadata: { analysis_type: type },
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
  // If we had the GEE project URL, we would query:
  // GET https://earthengine.googleapis.com/v1/projects/{project}/operations/{operationId}
  // For dev stability, we return completed or processing mock values.
  return { done: false };
}
