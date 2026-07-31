-- VIEMAG — server-side upload limits on the PUBLIC bucket
--
-- Open since the bucket was created on 2026-07-28 and flagged in the architecture
-- review the same day: viemag-media had allowed_mime_types = null and
-- file_size_limit = null, so the only filter was accept="image/*,.pdf" on the
-- file input — a hint to the file-picker dialog, not a rule. Anything at all
-- could be uploaded to a bucket that serves to the public internet.
--
-- The two buckets are treated differently ON PURPOSE (Woody, 2026-07-30):
--
--   viemag-media   PUBLIC, served to visitors. Restricted tightly. It receives
--                  six image fields and two document fields (spec_sheet_url,
--                  report_file_url — dealers are meant to download those), so
--                  four types cover every real use.
--
--   viemag-private OWNERS ONLY, never served to the public, read through signed
--                  URLs. Left unrestricted for TYPE, deliberately:
--                    1. Browsers report application/octet-stream for .dwg /
--                       .step / .dxf, so an allowlist would block legitimate PM
--                       work with an error nobody can interpret.
--                    2. The realistic bad case here is an owner uploading
--                       something odd and then opening it themselves, which a
--                       type allowlist does nothing about.
--                  Its size limit also stays null so it follows the project
--                  default rather than pinning a number that would need
--                  maintaining when the platform default moves.
--
-- SVG is excluded from the public list specifically. An SVG can carry <script>,
-- and this bucket hands files out with a real content type over HTTP. Nothing
-- needs it: the site's illustrations are inline SVG written in js/main.js and
-- selected by art_key, never uploaded.
--
-- WHAT THIS DOES AND DOES NOT DO. Storage validates the Content-Type the client
-- DECLARES, not the bytes. A renamed executable announced as image/png still
-- passes. This stops accidents and casual misuse; it is not content inspection,
-- and it should not be described as though it were.
--
-- Existing objects are not re-validated, so nothing already uploaded breaks.
-- admin/admin.js's accept attribute is narrowed to the same four types in the
-- same commit — a dialog that offers a file the server will reject is worse than
-- no limit at all, because the failure arrives after the work.

begin;

update storage.buckets
   set allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
       file_size_limit    = 15728640          -- 15 MiB
 where id = 'viemag-media';

-- viemag-private: no type restriction, size follows the project default.
-- Written as an explicit no-op statement rather than left unmentioned, so the
-- next person reading this file knows it was a decision and not an oversight.
update storage.buckets
   set allowed_mime_types = null,
       file_size_limit    = null
 where id = 'viemag-private';

commit;
