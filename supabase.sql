-- Cole e execute este arquivo no Supabase SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.services (
 id uuid primary key default gen_random_uuid(),
 name text not null,
 description text,
 price numeric(10,2) not null default 0,
 active boolean not null default true,
 created_at timestamptz not null default now()
);

create table if not exists public.clients (
 id uuid primary key default gen_random_uuid(),
 name text not null,
 phone text not null unique,
 created_at timestamptz not null default now()
);

create table if not exists public.appointments (
 id uuid primary key default gen_random_uuid(),
 client_name text not null,
 phone text not null,
 service_id uuid references public.services(id) on delete set null,
 date date not null,
 time time not null,
 status text not null default 'booked'
   check(status in ('booked','confirmed','completed','cancelled')),
 created_at timestamptz not null default now()
);

create unique index if not exists one_active_appointment_per_slot
on public.appointments(date,time) where status <> 'cancelled';

create table if not exists public.business_hours (
 id uuid primary key default gen_random_uuid(),
 weekday int not null check(weekday between 0 and 6),
 open_time time not null,
 close_time time not null,
 active boolean not null default true,
 unique(weekday)
);

create table if not exists public.photos (
 id uuid primary key default gen_random_uuid(),
 url text not null,
 caption text,
 active boolean not null default true,
 created_at timestamptz not null default now()
);

insert into public.services(name,description,price) values
('Corte Masculino','Máquina, tesoura e acabamento.',35),
('Corte + Barba','Visual completo com acabamento.',55),
('Barba','Modelagem e acabamento.',25)
on conflict do nothing;

insert into public.business_hours(weekday,open_time,close_time) values
(1,'09:00','18:30'),(2,'09:00','18:30'),(3,'09:00','18:30'),
(4,'09:00','18:30'),(5,'09:00','18:30'),(6,'09:00','16:00')
on conflict (weekday) do nothing;

alter table public.services enable row level security;
alter table public.clients enable row level security;
alter table public.appointments enable row level security;
alter table public.business_hours enable row level security;
alter table public.photos enable row level security;

drop policy if exists "public read services" on public.services;
drop policy if exists "public read hours" on public.business_hours;
drop policy if exists "public read photos" on public.photos;
drop policy if exists "public create appointments" on public.appointments;

create policy "public read services" on public.services for select using (active=true);
create policy "public read hours" on public.business_hours for select using (active=true);
create policy "public read photos" on public.photos for select using (active=true);
create policy "public create appointments" on public.appointments for insert with check(status='booked');

drop policy if exists "authenticated all services" on public.services;
drop policy if exists "authenticated all clients" on public.clients;
drop policy if exists "authenticated all appointments" on public.appointments;
drop policy if exists "authenticated all hours" on public.business_hours;
drop policy if exists "authenticated all photos" on public.photos;

create policy "authenticated all services" on public.services for all to authenticated using(true) with check(true);
create policy "authenticated all clients" on public.clients for all to authenticated using(true) with check(true);
create policy "authenticated all appointments" on public.appointments for all to authenticated using(true) with check(true);
create policy "authenticated all hours" on public.business_hours for all to authenticated using(true) with check(true);
create policy "authenticated all photos" on public.photos for all to authenticated using(true) with check(true);

insert into storage.buckets(id,name,public)
values('barbearia-fotos','barbearia-fotos',true)
on conflict(id) do nothing;

drop policy if exists "public read barbearia photos" on storage.objects;
drop policy if exists "authenticated upload barbearia photos" on storage.objects;
drop policy if exists "authenticated update barbearia photos" on storage.objects;
drop policy if exists "authenticated delete barbearia photos" on storage.objects;

create policy "public read barbearia photos" on storage.objects for select using(bucket_id='barbearia-fotos');
create policy "authenticated upload barbearia photos" on storage.objects for insert to authenticated with check(bucket_id='barbearia-fotos');
create policy "authenticated update barbearia photos" on storage.objects for update to authenticated using(bucket_id='barbearia-fotos') with check(bucket_id='barbearia-fotos');
create policy "authenticated delete barbearia photos" on storage.objects for delete to authenticated using(bucket_id='barbearia-fotos');

-- CONTROLE FINANCEIRO (executar também em projetos que já possuem as tabelas acima)
create table if not exists public.financial_transactions (
 id uuid primary key default gen_random_uuid(),
 appointment_id uuid references public.appointments(id) on delete set null,
 type text not null check(type in ('income','expense')),
 category text not null,
 description text,
 amount numeric(10,2) not null check(amount > 0),
 transaction_date date not null default current_date,
 created_at timestamptz not null default now()
);

create index if not exists financial_transactions_date_idx
on public.financial_transactions(transaction_date desc);

create unique index if not exists one_financial_entry_per_appointment
on public.financial_transactions(appointment_id) where appointment_id is not null;

alter table public.financial_transactions enable row level security;

drop policy if exists "authenticated all financial transactions" on public.financial_transactions;
create policy "authenticated all financial transactions"
on public.financial_transactions for all to authenticated using(true) with check(true);


-- Pacotes e assinaturas exibidos aos clientes.
create table if not exists public.membership_packages (
 id uuid primary key default gen_random_uuid(),
 name text not null,
 description text,
 price numeric(10,2) not null default 0 check(price >= 0),
 period text not null default 'por mês',
 image_url text,
 active boolean not null default true,
 created_at timestamptz not null default now()
);

create index if not exists membership_packages_active_idx
on public.membership_packages(active, created_at);

alter table public.membership_packages enable row level security;

drop policy if exists "public read active membership packages" on public.membership_packages;
create policy "public read active membership packages"
on public.membership_packages for select to anon, authenticated using(active=true);

drop policy if exists "authenticated all membership packages" on public.membership_packages;
create policy "authenticated all membership packages"
on public.membership_packages for all to authenticated using(true) with check(true);
