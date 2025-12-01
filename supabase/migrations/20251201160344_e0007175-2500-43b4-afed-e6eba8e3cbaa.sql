create table user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('admin', 'professional', 'patient')),
  created_at timestamptz not null default now(),
  unique(user_id, role)
);

alter table user_roles enable row level security;

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table profiles enable row level security;

create table businesses (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  specialty text,
  timezone text not null default 'America/Montevideo',
  public_slug text not null unique,
  contact_email text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table businesses enable row level security;

create table patients (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  full_name text not null,
  email text,
  whatsapp_phone text,
  is_active boolean not null default true,
  reason_for_consultation text,
  private_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table patients enable row level security;

create table services (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  name text not null,
  duration_minutes integer not null,
  mode text not null check (mode in ('in_person', 'online')),
  suggested_price decimal(10,2),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table services enable row level security;

create table appointments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  patient_id uuid references patients(id) on delete set null,
  service_id uuid not null references services(id) on delete restrict,
  start_datetime timestamptz not null,
  end_datetime timestamptz not null,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'cancelled', 'attended', 'no_show')),
  source text not null default 'panel' check (source in ('panel', 'public')),
  notes_internal text,
  is_new_contact boolean not null default false,
  contact_name text,
  contact_email text,
  contact_phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table appointments enable row level security;