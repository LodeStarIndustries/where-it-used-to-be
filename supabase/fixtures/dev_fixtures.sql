-- Development fixtures. Every name starts with TEST: and every place is made up.
--
-- NEVER run this against production. It refuses to run unless this database's
-- app_settings.environment is 'development', and the database itself rejects any
-- TEST: name outside a development database (hard rule 8).
--
-- Run with:  npm run db:fixtures   (see SETUP.md)
-- Safe to run more than once.

do $$
begin
  if private.app_environment() <> 'development' then
    raise exception 'Refusing to load TEST: fixtures: this database is "%", not "development". See SETUP.md.',
      private.app_environment();
  end if;
end;
$$;

-- 22 sites spread across Uptown, the North End, the West Side and the East side.
insert into public.sites (id, lat, lng, address_text, neighbourhood, current_use) values
('00000000-0000-4000-8000-000000000001', 45.266450, -66.069250, 'TEST: 100 Example St', 'Uptown', 'TEST: Pharmacy'),
('00000000-0000-4000-8000-000000000002', 45.279750, -66.063750, 'TEST: 103 Example St', 'North End', 'TEST: Parking lot'),
('00000000-0000-4000-8000-000000000003', 45.251550, -66.085650, 'TEST: 106 Example St', 'West Side', 'TEST: Coffee shop'),
('00000000-0000-4000-8000-000000000004', 45.292350, -66.013550, 'TEST: 109 Example St', 'East', 'TEST: Bank'),
('00000000-0000-4000-8000-000000000005', 45.269750, -66.063450, 'TEST: 112 Example St', 'Uptown', 'TEST: Vacant lot'),
('00000000-0000-4000-8000-000000000006', 45.281050, -66.075350, 'TEST: 115 Example St', 'North End', 'TEST: Apartment building lobby'),
('00000000-0000-4000-8000-000000000007', 45.252850, -66.097250, 'TEST: 118 Example St', 'West Side', 'TEST: Gym'),
('00000000-0000-4000-8000-000000000008', 45.295650, -66.007750, 'TEST: 121 Example St', 'East', 'TEST: Office space'),
('00000000-0000-4000-8000-000000000009', 45.271050, -66.057650, 'TEST: 124 Example St', 'Uptown', 'TEST: Convenience store'),
('00000000-0000-4000-8000-000000000010', 45.284350, -66.069550, 'TEST: 127 Example St', 'North End', 'TEST: Dental office'),
('00000000-0000-4000-8000-000000000011', 45.254150, -66.091450, 'TEST: 130 Example St', 'West Side', 'TEST: Parking garage'),
('00000000-0000-4000-8000-000000000012', 45.296950, -66.019350, 'TEST: 133 Example St', 'East', 'TEST: Hotel'),
('00000000-0000-4000-8000-000000000013', 45.274350, -66.069250, 'TEST: 136 Example St', 'Uptown', 'TEST: Pharmacy'),
('00000000-0000-4000-8000-000000000014', 45.285650, -66.063750, 'TEST: 139 Example St', 'North End', 'TEST: Parking lot'),
('00000000-0000-4000-8000-000000000015', 45.257450, -66.085650, 'TEST: 142 Example St', 'West Side', 'TEST: Coffee shop'),
('00000000-0000-4000-8000-000000000016', 45.298250, -66.013550, 'TEST: 145 Example St', 'East', 'TEST: Bank'),
('00000000-0000-4000-8000-000000000017', 45.275650, -66.063450, 'TEST: 148 Example St', 'Uptown', 'TEST: Vacant lot'),
('00000000-0000-4000-8000-000000000018', 45.288950, -66.075350, 'TEST: 151 Example St', 'North End', 'TEST: Apartment building lobby'),
('00000000-0000-4000-8000-000000000019', 45.258750, -66.097250, 'TEST: 154 Example St', 'West Side', 'TEST: Gym'),
('00000000-0000-4000-8000-000000000020', 45.301550, -66.007750, 'TEST: 157 Example St', 'East', 'TEST: Office space'),
('00000000-0000-4000-8000-000000000021', 45.276950, -66.057650, 'TEST: 160 Example St', 'Uptown', 'TEST: Convenience store'),
('00000000-0000-4000-8000-000000000022', 45.290250, -66.069550, 'TEST: 163 Example St', 'North End', 'TEST: Dental office')
on conflict (id) do nothing;

-- One site with no pin yet, for the admin "needs pin" flow.
insert into public.sites (id, address_text, neighbourhood, current_use) values
('00000000-0000-4000-8000-000000000099', 'TEST: Somewhere on Example Ave', 'Uptown', null)
on conflict (id) do nothing;

-- 24 places: four per decade plus four for the fallback card (1960s, 2020s or no era).
-- The last two share sites with the first two, so the scheduler's "no shared site" rules get exercised.
insert into public.places (id, site_id, name, category, year_opened, year_closed, era, fact, difficulty) values
('00000000-0000-4000-9000-000000000001', '00000000-0000-4000-8000-000000000001', 'TEST: Diner A', 'restaurant', 1958, 1970, '1970s', 'TEST fact: this place is made up for development and never ships.', 1),
('00000000-0000-4000-9000-000000000002', '00000000-0000-4000-8000-000000000002', 'TEST: Tavern B', 'bar', 1971, 1983, '1980s', 'TEST fact: this place is made up for development and never ships.', 2),
('00000000-0000-4000-9000-000000000003', '00000000-0000-4000-8000-000000000003', 'TEST: Five and Dime C', 'retail', 1984, 1996, '1990s', 'TEST fact: this place is made up for development and never ships.', 3),
('00000000-0000-4000-9000-000000000004', '00000000-0000-4000-8000-000000000004', 'TEST: Corner Grocery D', 'grocery', 1997, 2009, '2000s', 'TEST fact: this place is made up for development and never ships.', 1),
('00000000-0000-4000-9000-000000000005', '00000000-0000-4000-8000-000000000005', 'TEST: Cinema E', 'entertainment', 2000, 2012, '2010s', 'TEST fact: this place is made up for development and never ships.', 2),
('00000000-0000-4000-9000-000000000006', '00000000-0000-4000-8000-000000000006', 'TEST: Repair Shop F', 'service', 1953, 1965, null, 'TEST fact: this place is made up for development and never ships.', 3),
('00000000-0000-4000-9000-000000000007', '00000000-0000-4000-8000-000000000007', 'TEST: Garage G', 'automotive', 1966, 1978, '1970s', 'TEST fact: this place is made up for development and never ships.', 1),
('00000000-0000-4000-9000-000000000008', '00000000-0000-4000-8000-000000000008', 'TEST: Arcade H', 'other', 1969, 1981, '1980s', 'TEST fact: this place is made up for development and never ships.', 2),
('00000000-0000-4000-9000-000000000009', '00000000-0000-4000-8000-000000000009', 'TEST: Pizzeria I', 'restaurant', 1982, 1994, '1990s', 'TEST fact: this place is made up for development and never ships.', 3),
('00000000-0000-4000-9000-000000000010', '00000000-0000-4000-8000-000000000010', 'TEST: Lounge J', 'bar', 1995, 2007, '2000s', 'TEST fact: this place is made up for development and never ships.', 1),
('00000000-0000-4000-9000-000000000011', '00000000-0000-4000-8000-000000000011', 'TEST: Department Store K', 'retail', 1998, 2010, '2010s', 'TEST fact: this place is made up for development and never ships.', 2),
('00000000-0000-4000-9000-000000000012', '00000000-0000-4000-8000-000000000012', 'TEST: Market L', 'grocery', 1953, 1965, null, 'TEST fact: this place is made up for development and never ships.', 3),
('00000000-0000-4000-9000-000000000013', '00000000-0000-4000-8000-000000000013', 'TEST: Bowling Alley M', 'entertainment', 1964, 1976, '1970s', 'TEST fact: this place is made up for development and never ships.', 1),
('00000000-0000-4000-9000-000000000014', '00000000-0000-4000-8000-000000000014', 'TEST: Shoe Repair N', 'service', 1977, 1989, '1980s', 'TEST fact: this place is made up for development and never ships.', 2),
('00000000-0000-4000-9000-000000000015', '00000000-0000-4000-8000-000000000015', 'TEST: Gas Bar O', 'automotive', 1980, 1992, '1990s', 'TEST fact: this place is made up for development and never ships.', 3),
('00000000-0000-4000-9000-000000000016', '00000000-0000-4000-8000-000000000016', 'TEST: Record Shop P', 'other', 1993, 2005, '2000s', 'TEST fact: this place is made up for development and never ships.', 1),
('00000000-0000-4000-9000-000000000017', '00000000-0000-4000-8000-000000000017', 'TEST: Bakery Q', 'restaurant', 2006, 2018, '2010s', 'TEST fact: this place is made up for development and never ships.', 2),
('00000000-0000-4000-9000-000000000018', '00000000-0000-4000-8000-000000000018', 'TEST: Pub R', 'bar', 1953, 1965, null, 'TEST fact: this place is made up for development and never ships.', 3),
('00000000-0000-4000-9000-000000000019', '00000000-0000-4000-8000-000000000019', 'TEST: Hardware S', 'retail', 1962, 1974, '1970s', 'TEST fact: this place is made up for development and never ships.', 1),
('00000000-0000-4000-9000-000000000020', '00000000-0000-4000-8000-000000000020', 'TEST: Video Store T', 'grocery', 1975, 1987, '1980s', 'TEST fact: this place is made up for development and never ships.', 2),
('00000000-0000-4000-9000-000000000021', '00000000-0000-4000-8000-000000000021', 'TEST: Drive-In U', 'entertainment', 1978, 1990, '1990s', 'TEST fact: this place is made up for development and never ships.', 3),
('00000000-0000-4000-9000-000000000022', '00000000-0000-4000-8000-000000000022', 'TEST: Laundromat V', 'service', 1991, 2003, '2000s', 'TEST fact: this place is made up for development and never ships.', 1),
('00000000-0000-4000-9000-000000000023', '00000000-0000-4000-8000-000000000001', 'TEST: Car Wash W', 'automotive', 2004, 2016, '2010s', 'TEST fact: this place is made up for development and never ships.', 2),
('00000000-0000-4000-9000-000000000024', '00000000-0000-4000-8000-000000000002', 'TEST: Bookshop X', 'other', 1953, 1965, null, 'TEST fact: this place is made up for development and never ships.', 3)
on conflict (id) do nothing;

-- A long name to test era-card shrinking and wrapping.
insert into public.places (id, site_id, name, category, year_opened, year_closed, era, fact, difficulty) values
('00000000-0000-4000-9000-000000000025', '00000000-0000-4000-8000-000000000021',
 'TEST: The Extremely Long-Named Family Restaurant and Lounge', 'restaurant', 1979, 1991, '1980s',
 'TEST fact: a long name for checking how the era card shrinks and wraps.', 2)
on conflict (id) do nothing;

-- Sources for every TEST place.
update public.places
set sources = '[{"label": "TEST source (not real)", "url": "https://example.com/"}]'::jsonb
where name like 'TEST:%' and sources = '[]'::jsonb;

-- Make them all live and verified so the puzzle generator has a pool to work with.
update public.places
set verified_at = coalesce(verified_at, now()), status = 'live'
where name like 'TEST:%' and status = 'draft'
  and exists (select 1 from public.sites s where s.id = places.site_id and s.lat is not null);

-- A draft with no pin, for the admin "needs pin" flow.
insert into public.places (id, site_id, name, category, era, difficulty) values
('00000000-0000-4000-9000-000000000099', '00000000-0000-4000-8000-000000000099',
 'TEST: Draft Without A Pin', 'other', '1990s', 2)
on conflict (id) do nothing;
