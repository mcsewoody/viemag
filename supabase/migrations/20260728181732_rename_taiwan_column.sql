-- ============================================================
-- Rename support_cases.escalate_to_taiwan -> escalate_to_hq
--
-- CLAUDE.md lists 台灣/Taiwan as a hard 禁用詞 and requires that nothing
-- external can trace VIEMAG back to the parent company. This column name
-- was the single occurrence of "taiwan" in any tracked file, and it was
-- being served publicly: /admin/schema.js re-declares the whole schema and
-- is fetchable at https://viemag.biz/admin/schema.js (verified HTTP 200).
--
-- Safe rename: support_cases has 0 rows, and the only readers are
-- admin/schema.js (updated in the same change) and 後台.md ch.7.
-- ============================================================

alter table support_cases rename column escalate_to_taiwan to escalate_to_hq;
