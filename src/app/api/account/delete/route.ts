import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerSupabase } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Exclusão definitiva da conta: confirma a senha, apaga o perfil (posts e
 * respostas vão em cascata/limpeza) e o usuário de autenticação.
 */
export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return NextResponse.json({ error: 'Faça login.' }, { status: 401 });

  const { password, confirmation } = await req.json().catch(() => ({}));
  if (confirmation !== 'EXCLUIR MINHA CONTA') {
    return NextResponse.json({ error: 'Digite a frase de confirmação.' }, { status: 400 });
  }

  // reautenticação num cliente isolado (não mexe nos cookies da sessão)
  const check = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: pwError } = await check.auth.signInWithPassword({ email: user.email, password: String(password || '') });
  if (pwError) return NextResponse.json({ error: 'Senha incorreta.' }, { status: 403 });

  const admin = createAdminClient();
  const { data: prof } = await admin
    .from('profiles')
    .select('id, role')
    .or(`user_id.eq.${user.id},id.eq.${user.id}`)
    .maybeSingle();
  if (prof?.role === 'admin') {
    return NextResponse.json({ error: 'Contas de administrador não podem ser autoexcluídas.' }, { status: 403 });
  }

  if (prof) {
    await admin.from('posts').delete().or(`profile_id.eq.${prof.id},author_id.eq.${prof.id}`);
    await admin.from('replies').delete().eq('profile_id', prof.id);
    await admin.from('profiles').delete().eq('id', prof.id);
  }
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) return NextResponse.json({ error: 'Não foi possível concluir a exclusão.' }, { status: 500 });

  await supabase.auth.signOut();
  return NextResponse.json({ deleted: true });
}
