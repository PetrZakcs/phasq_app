import { createServerSideClient } from '@/lib/supabase-server';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { aoi_id, params, prompt } = await req.json();

    if (!aoi_id || !params) {
      return NextResponse.json({ success: false, error: 'AOI ID and params are required' }, { status: 400 });
    }

    const supabase = await createServerSideClient();


    // 1. Get session user
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Fetch AOI detail to check existence and area
    const { data: aoi, error: aoiError } = await supabase
      .from('aoi')
      .select('*')
      .eq('id', aoi_id)
      .single();

    if (aoiError || !aoi) {
      return NextResponse.json({ success: false, error: 'AOI not found' }, { status: 404 });
    }

    // 3. Quota checking
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ success: false, error: 'Profile not found' }, { status: 404 });
    }

    const requestedHa = Number(aoi.area_ha);
    if (profile.hectare_used + requestedHa > profile.hectare_quota) {
      return NextResponse.json({
        success: false,
        error: `Quota exceeded: ${profile.hectare_used}/${profile.hectare_quota} ha used. Analysis requires ${requestedHa} ha.`
      }, { status: 403 });
    }

    // 4. Create analysis record in pending status
    const analysisName = `${params.analysis_type.toUpperCase()} - ${aoi.name}`;
    const { data: analysis, error: analysisError } = await supabase
      .from('analyses')
      .insert({
        user_id: session.user.id,
        aoi_id: aoi.id,
        name: analysisName,
        analysis_type: params.analysis_type,
        status: 'processing',
        parameters: params,
        prompt_original: prompt || null,
        prompt_parsed: params,
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (analysisError || !analysis) {
      throw analysisError;
    }

    // 5. Determine if we are using Mock or Real GEE
    const useMock = 
      process.env.NEXT_PUBLIC_USE_MOCK_GEE === 'true' ||
      !process.env.GEE_SERVICE_ACCOUNT_EMAIL ||
      process.env.GEE_SERVICE_ACCOUNT_EMAIL.includes('your-project');

    let taskId = '';
    if (useMock) {
      // Create a mock GEE task ID
      taskId = `mock-task-${analysis.id}`;
    } else {
      // Real GEE task ID linked to analysis ID
      taskId = `gee-task-${analysis.id}`;
    }

    // 6. Update database with GEE task ID
    await supabase
      .from('analyses')
      .update({ gee_task_id: taskId })
      .eq('id', analysis.id);

    // 7. Update profile quota usage
    await supabase
      .from('profiles')
      .update({ hectare_used: profile.hectare_used + requestedHa })
      .eq('id', session.user.id);

    // 8. Add audit log
    await supabase.from('audit_log').insert({
      user_id: session.user.id,
      action: 'TRIGGER_ANALYSIS',
      resource_type: 'analyses',
      resource_id: analysis.id,
      metadata: { analysis_type: params.analysis_type, area_ha: requestedHa, task_id: taskId },
    });

    return NextResponse.json({ success: true, analysis_id: analysis.id, task_id: taskId });
  } catch (err: any) {
    console.error('Analysis trigger endpoint error:', err);
    return NextResponse.json({ success: false, error: err.message || 'Database transaction error' }, { status: 500 });
  }
}

// Dummy helper representing Google Earth Engine REST API calls
// Returns an operation ID from Google GEE API
async function triggerRealGeeTask(geometry: any, params: any): Promise<string> {
  // If we had the GEE client loaded we could:
  // 1. Authenticate with Service Account credentials
  // 2. Build the image collection graph
  // 3. Call ee.data.startTableExport or ee.data.startImageExport to batch execute
  // For REST api we make a POST request to:
  // https://earthengine.googleapis.com/v1/projects/{project}/imageCollections:computeImages
  
  // We return a mock-looking operation task that the status route can poll
  return `gee-op-${Math.random().toString(36).substring(7)}`;
}
