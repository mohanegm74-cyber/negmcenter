create table public.paper_exams (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  grade text, term text, subject text, lessons text,
  source_ids uuid[] not null default '{}',
  spec jsonb not null,
  sections jsonb not null,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.paper_exams enable row level security;
grant all on public.paper_exams to service_role;