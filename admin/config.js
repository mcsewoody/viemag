/* VIEMAG Admin — Supabase connection config.
   The anon key is safe to ship in client code: it identifies the
   project, not a secret grant. Every real permission check happens
   in Postgres Row Level Security, gated by Supabase Auth login
   (see supabase/migrations/20260728035523_rls_policies.sql).
   Never put the service_role key here or in any file under /admin. */
window.VIEMAG_ADMIN_CONFIG = {
  supabaseUrl: 'https://zqmpjenlpzmeozoufvzy.supabase.co',
  supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpxbXBqZW5scHptZW96b3Vmdnp5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUyMTAzMjgsImV4cCI6MjEwMDc4NjMyOH0.tfhZXgjqQnrKx2sNiBkRYQp-L42CLHtmsVPm2ZQtGtg',
  mediaBucket: 'viemag-media',
  /* Private, owners only, read through short-lived signed URLs. Product photos
     must load on viemag.biz without a login, so mediaBucket is public — which is
     exactly why drawings and supplier documents cannot go there. Never call
     getPublicUrl() on this one; it would hand back a URL that 400s, and treating
     the two buckets alike is the mistake this split exists to prevent. */
  privateBucket: 'viemag-private',
};
