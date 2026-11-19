import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { createAdminClient } from '@/lib/supabase/admin';

function resolveValidNotificationUrl(request: Request): string | undefined {
  const hostHeader = request.headers.get('host') || '';
  const fallbackFromHost =
    hostHeader && !hostHeader.includes('localhost') && !hostHeader.includes('127.0.0.1')
      ? `https://${hostHeader}`
      : '';

  const rawEnv = (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    ''
  ).trim();

  // Extrai URL limpa mesmo se houver caracteres extras ou formato markdown
  const urlMatch = rawEnv.match(/https?:\/\/[^\s)\]]+/i);
  const candidate = urlMatch ? urlMatch[0] : rawEnv || fallbackFromHost;

  if (!candidate || candidate.includes('localhost') || candidate.includes('127.0.0.1')) {
    return undefined;
  }

  const withProtocol = /^https?:\/\//i.test(candidate)
    ? candidate
    : `https://${candidate}`;

  try {
    const parsed = new URL(withProtocol);
    if (parsed.protocol !== 'https:') return undefined;
    // Garante que existe um TLD válido (ex: .com, .br, .app)
    if (!parsed.hostname.includes('.')) return undefined;
    return `${parsed.origin}/api/webhooks/mercadopago`;
  } catch {
    return undefined;
  }
}

export async function POST(request: Request) {
  try {
    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN?.trim().replace(
      /^["']|["']$/g,
      ''
    );

    if (!accessToken) {
      return NextResponse.json(
        { error: 'MERCADOPAGO_ACCESS_TOKEN não configurado no servidor.' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const amount = Number(body.amount);
    const profileId: string | null = body.profileId || null;
    const donorName: string | null = body.donorName?.trim() || null;
    const message: string | null = body.message?.trim()?.slice(0, 140) || null;
    const payerEmail: string =
      body.email?.trim() || 'apoiador@insight.app.br';

    if (!Number.isFinite(amount) || amount < 1) {
      return NextResponse.json(
        { error: 'O valor mínimo para gerar o PIX automático é R$ 1,00.' },
        { status: 400 }
      );
    }

    const notificationUrl = resolveValidNotificationUrl(request);
    const idempotencyKey = crypto.randomUUID();
    const roundedAmount = Number(amount.toFixed(2));

    const paymentBody: Record<string, any> = {
      transaction_amount: roundedAmount,
      description: `Apoio Insight* (+${Math.floor(roundedAmount)} pts)`,
      payment_method_id: 'pix',
      payer: {
        email: payerEmail,
      },
      metadata: {
        profile_id: profileId,
        donor_name: donorName,
        message,
      },
    };

    if (notificationUrl) {
      paymentBody.notification_url = notificationUrl;
    }

    // 1. Cria a cobrança PIX na API do Mercado Pago
    const mpResponse = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify(paymentBody),
    });

    const mpData = await mpResponse.json();

    if (!mpResponse.ok || !mpData?.id) {
      return NextResponse.json(
        {
          error:
            mpData?.message || 'Erro ao gerar cobrança PIX no Mercado Pago.',
          sentNotificationUrl: notificationUrl || null,
        },
        { status: 502 }
      );
    }

    const txData = mpData.point_of_interaction?.transaction_data;
    if (!txData?.qr_code) {
      return NextResponse.json(
        { error: 'O provedor não retornou o código PIX Copia e Cola.' },
        { status: 502 }
      );
    }

    // 2. Registra a intenção de doação como pendente no Supabase
    const supabaseAdmin = createAdminClient();
    const { data: donation, error: dbError } = await supabaseAdmin
      .from('donations')
      .insert({
        profile_id: profileId,
        donor_name: profileId ? null : donorName || 'Apoiador da Comunidade',
        amount: roundedAmount,
        message,
        status: 'pending',
        provider: 'mercadopago',
        external_payment_id: String(mpData.id),
      })
      .select('id, status')
      .single();

    if (dbError) {
      return NextResponse.json(
        {
          error:
            'PIX gerado, mas houve erro ao registrar no banco: ' +
            dbError.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      donationId: donation.id,
      paymentId: String(mpData.id),
      amount: roundedAmount,
      qrCode: txData.qr_code,
      qrCodeBase64: txData.qr_code_base64 || null,
      expiresAt: mpData.date_of_expiration || null,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Erro interno ao gerar PIX.' },
      { status: 500 }
    );
  }
}