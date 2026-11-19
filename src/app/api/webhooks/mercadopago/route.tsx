import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { createAdminClient } from '@/lib/supabase/admin';

function verifyMercadoPagoSignature(
    request: Request,
    dataId: string,
    secret: string
): boolean {
    const xSignature = request.headers.get('x-signature');
    const xRequestId = request.headers.get('x-request-id');
    if (!xSignature) return false;

    let ts = '';
    let v1 = '';

    for (const part of xSignature.split(',')) {
        const [key, value] = part.split('=').map((s) => s.trim());
        if (key === 'ts') ts = value;
        if (key === 'v1') v1 = value;
    }

    if (!ts || !v1) return false;

    const manifestParts: string[] = [];
    if (dataId) manifestParts.push(`id:${dataId.toLowerCase()};`);
    if (xRequestId) manifestParts.push(`request-id:${xRequestId};`);
    manifestParts.push(`ts:${ts};`);

    const manifest = manifestParts.join('');
    const expected = crypto
        .createHmac('sha256', secret)
        .update(manifest)
        .digest('hex');

    const expectedBuf = Buffer.from(expected, 'hex');
    const receivedBuf = Buffer.from(v1, 'hex');

    if (expectedBuf.length !== receivedBuf.length) return false;
    return crypto.timingSafeEqual(expectedBuf, receivedBuf);
}

export async function POST(request: Request) {
    try {
        const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
        const webhookSecret = process.env.MERCADOPAGO_WEBHOOK_SECRET;

        if (!accessToken) {
            return NextResponse.json({ error: 'Token ausente' }, { status: 500 });
        }

        const url = new URL(request.url);
        const body = await request.json().catch(() => ({}));

        const topic =
            body?.type ||
            body?.topic ||
            url.searchParams.get('type') ||
            url.searchParams.get('topic');

        const paymentId = String(
            body?.data?.id ||
            url.searchParams.get('data.id') ||
            url.searchParams.get('id') ||
            ''
        );

        // Ignora eventos que não sejam de pagamento (mas devolve 200 pro MP não reenviar)
        if (!paymentId || (topic && topic !== 'payment')) {
            return NextResponse.json({ received: true, ignored: true });
        }

        // 1. Valida assinatura HMAC se o segredo estiver configurado
        if (webhookSecret) {
            const valid = verifyMercadoPagoSignature(request, paymentId, webhookSecret);
            if (!valid) {
                return NextResponse.json(
                    { error: 'Assinatura do webhook inválida' },
                    { status: 401 }
                );
            }
        }

        // 2. Consulta o status REAL direto na API do Mercado Pago (nunca confiar só no body)
        const mpRes = await fetch(
            `https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`,
            {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
                cache: 'no-store',
            }
        );

        if (!mpRes.ok) {
            return NextResponse.json({ received: true, paymentNotFound: true });
        }

        const payment = await mpRes.json();
        const mpStatus: string = payment.status; // 'approved' | 'pending' | 'rejected' | 'cancelled'
        const paidAmount = Number(payment.transaction_amount) || 0;

        if (mpStatus !== 'approved' || paidAmount <= 0) {
            return NextResponse.json({ received: true, status: mpStatus });
        }

        const supabaseAdmin = createAdminClient();

        // 3. Verifica se a doação já existe no banco
        const { data: existing } = await supabaseAdmin
            .from('donations')
            .select('id, status, profile_id, amount')
            .eq('external_payment_id', paymentId)
            .maybeSingle();

        // Já foi aprovada anteriormente -> idempotência garantida
        if (existing?.status === 'approved') {
            return NextResponse.json({ received: true, alreadyApproved: true });
        }

        let approvedProfileId: string | null = existing?.profile_id || null;

        if (existing) {
            // Atualiza para approved -> dispara automaticamente o trigger de pontos e patente!
            await supabaseAdmin
                .from('donations')
                .update({
                    status: 'approved',
                    amount: paidAmount,
                })
                .eq('id', existing.id);
        } else {
            // Fallback: caso o webhook chegue antes ou sem registro prévio
            const meta = payment.metadata || {};
            approvedProfileId = meta.profile_id || null;

            await supabaseAdmin.from('donations').insert({
                profile_id: approvedProfileId,
                donor_name: approvedProfileId
                    ? null
                    : meta.donor_name || 'Apoiador da Comunidade',
                amount: paidAmount,
                message: meta.message || null,
                status: 'approved',
                provider: 'mercadopago',
                external_payment_id: paymentId,
            });
        }

        // 4. Notifica o usuário dentro da aba /notificacoes que os pontos caíram
        if (approvedProfileId) {
            const pts = Math.floor(paidAmount);
            const text = `Seu apoio de R$ ${paidAmount.toFixed(2).replace('.', ',')} foi confirmado (+${pts} ${pts === 1 ? 'ponto' : 'pontos'
                } de contribuinte).`;

            try {
                await supabaseAdmin.from('notifications').insert({
                    recipient_id: approvedProfileId,
                    actor_id: approvedProfileId,
                    type: 'system',
                    content_preview: text,
                    message: text,
                });
            } catch {
                // Ignora erro caso a tabela notifications tenha alguma restrição de tipo
            }
        }
        return NextResponse.json({ received: true, approved: true });
    } catch (err: any) {
        return NextResponse.json(
            { error: err?.message || 'Erro ao processar webhook' },
            { status: 500 }
        );
    }
}