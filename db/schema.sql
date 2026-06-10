-- Elsewhere backend schema. Idempotent: safe to re-apply.

create table if not exists metros (
  id                  text primary key,        -- slug "denver-co"
  cbsa                text unique,             -- CBSA FIPS (pipeline join key)
  name                text not null,
  short               text not null,
  states              text[] not null,
  pop                 integer,
  rpp_overall         numeric,
  rpp_housing         numeric,
  rpp_goods           numeric,
  rpp_other_services  numeric,
  politics            numeric,
  temp_f              numeric,
  humidity            numeric,
  aqi                 numeric,
  risk                numeric,
  rent                numeric,                  -- typical monthly rent (Zillow ZORI, all homes)
  updated_at          timestamptz not null default now()
);

create table if not exists cities (
  metro_id            text primary key references metros(id) on delete cascade,
  wikipedia_url       text,
  blurb               text,
  summary_source      text,
  summary_updated_at  timestamptz
);

create index if not exists metros_pop_idx on metros (pop desc nulls last);

-- migrations for databases created before these columns existed
alter table metros add column if not exists rent numeric;
