/* VIEMAG public site — Supabase connection config, used only by pages
   that write directly to Supabase (Dealer/Support forms). The anon key
   is safe to ship client-side: it identifies the project, not a secret
   grant — every real permission check happens in Postgres Row Level
   Security (anon may INSERT dealer_leads/support_cases only, no SELECT
   anywhere). See supabase/migrations/20260728035523_rls_policies.sql. */
window.VIEMAG_SUPABASE = {
  url: 'https://zqmpjenlpzmeozoufvzy.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpxbXBqZW5scHptZW96b3Vmdnp5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUyMTAzMjgsImV4cCI6MjEwMDc4NjMyOH0.tfhZXgjqQnrKx2sNiBkRYQp-L42CLHtmsVPm2ZQtGtg',
};
