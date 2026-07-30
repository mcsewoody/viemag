-- VIEMAG — close a hole opened by 20260730120000: the read-only view was writable
--
-- Found during the post-change state check, not by the audit. product_sales_cost
-- exists to let sales READ one number from behind the owner-only wall. It was
-- granted SELECT to authenticated — but Supabase grants ALL on every new object
-- in `public` to anon and authenticated by default, and 20260730120000 only
-- revoked those defaults from ANON on the view. `authenticated` kept
-- INSERT/UPDATE/DELETE.
--
-- That was exploitable, not merely untidy. Postgres reports the view as
-- is_updatable = YES (single FROM entry, no aggregates), and the view runs with
-- its owner's privileges because security_invoker stays false — which is the
-- very property that lets it read past the owner-only policy. So a DELETE issued
-- through the view would have been executed as the view's owner and bypassed the
-- RLS policy entirely: an editor could not read a supplier, but could have
-- deleted the whole cost record.
--
-- The base table was correct: 20260730120000 revoked the defaults from
-- authenticated there before re-granting. The same two lines were simply not
-- repeated for the view. Worth remembering as a rule rather than a one-off:
-- `revoke all from anon` and `revoke all from authenticated` belong on EVERY new
-- object in public, views included, before any grant is written.

begin;

revoke all on public.product_sales_cost from anon;
revoke all on public.product_sales_cost from authenticated;
grant select on public.product_sales_cost to authenticated;

comment on view public.product_sales_cost is
  'READ-ONLY by grant: SELECT to authenticated only. Writes must never be possible here — the view bypasses product_development''s owner-only RLS by design (security_invoker = false), so a write privilege on it is a way around the wall, not a convenience.';

commit;
