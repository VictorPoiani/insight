-- Aparelho de push vinculado ao perfil: posts notificam só seguidores do autor
alter table public.push_subscriptions
  add column if not exists profile_id uuid references public.profiles (id) on delete cascade;
create index if not exists push_subscriptions_profile_idx on public.push_subscriptions (profile_id);
