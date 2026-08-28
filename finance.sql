-- Execute este arquivo uma única vez no SQL Editor do Supabase.
-- Ele adiciona apenas a área de contabilidade ao banco existente.

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

-- Compatibilidade com bancos que já tinham a tabela financeira criada.
alter table public.financial_transactions
add column if not exists appointment_id uuid references public.appointments(id) on delete set null;

-- Impede que um mesmo agendamento gere duas entradas financeiras.
create unique index if not exists one_financial_entry_per_appointment
on public.financial_transactions(appointment_id) where appointment_id is not null;

alter table public.financial_transactions enable row level security;

drop policy if exists "authenticated all financial transactions" on public.financial_transactions;
create policy "authenticated all financial transactions"
on public.financial_transactions for all to authenticated using(true) with check(true);
