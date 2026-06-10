import { createServerSideClient } from '@/lib/supabase-server';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { analysis_id } = await req.json();

    if (!analysis_id) {
      return NextResponse.json({ success: false, error: 'Analysis ID is required' }, { status: 400 });
    }

    const supabase = await createServerSideClient();


    // 1. Authenticate user
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Fetch analysis details
    const { data: analysis, error: fetchErr } = await supabase
      .from('analyses')
      .select('*, aoi:aoi_id(name, area_ha, geometry)')
      .eq('id', analysis_id)
      .single();

    if (fetchErr || !analysis) {
      return NextResponse.json({ success: false, error: 'Analysis not found' }, { status: 404 });
    }

    // 3. Simulate PDF compilation (usually Puppeteer/react-pdf uploads to Supabase storage)
    // We update the analysis record with a report URL
    const mockReportUrl = `/mock/reports/phasq_report_${analysis.id}.pdf`;

    const { error: updateErr } = await supabase
      .from('analyses')
      .update({ result_report_url: mockReportUrl })
      .eq('id', analysis.id);

    if (updateErr) {
      throw updateErr;
    }

    // 4. Log audit event
    await supabase.from('audit_log').insert({
      user_id: session.user.id,
      action: 'GENERATE_PDF_REPORT',
      resource_type: 'analyses',
      resource_id: analysis.id,
      metadata: { report_url: mockReportUrl },
    });

    return NextResponse.json({ success: true, report_url: mockReportUrl });
  } catch (err: any) {
    console.error('Error generating PDF report:', err);
    return NextResponse.json({ success: false, error: err.message || 'Report generation failure' }, { status: 500 });
  }
}
