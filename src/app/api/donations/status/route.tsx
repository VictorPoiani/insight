import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const donationId = searchParams.get('donationId');

    if (!donationId) {
      return NextResponse.json({ error: 'donationId obrigatório' }, { status: 400 });
    }

    const supabaseAdmin = createAdminClient();
    const { data: donation, error } = await supabaseAdmin
      .from('donations')
      .select('id, status, external_payment_id, amount')
      .eq('id', donationId)
      .maybeSingle();

    if (error || !donation) {
      return NextResponse.json({ status: 'not_found' }, { status: 404 });
    }

    if (donation.status === 'approved') {
      return NextResponse.json({ status: 'approved' });
    }

    // Pergunta diretamente ao Mercado Pago se o PIX já foi pago
    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN?.trim().replace(
      /^["']|["']$/g,
      ''
    );

    if (accessToken && donation.external_payment_id) {
      const mpRes = await fetch(
        `https://api.mercadopago.com/v1/payments/${encodeURIComponent(
          donation.external_payment_id
        )}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          cache: 'no-store',
        }
      );

      if (mpRes.ok) {
        const mpPayment = await mpRes.json();
        if (mpPayment.status === 'approved') {
          await supabaseAdmin
            .from('donations')
            .update({ status: 'approved' })
            .eq('id', donation.id);

          return NextResponse.json({ status: 'approved' });
        }
      }
    }

    return NextResponse.json({ status: donation.status });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Erro ao verificar status' },
      { status: 500 }
    );
  }
}