-- ============================================================================
-- 刪除 products.consumer_pain_point
--
-- 這是「刪除資料庫欄位必須分兩次上線」規則的第二步（CLAUDE.md）。
-- 第一步在 2026-08-18 的 commit cc72cbb：用戶端（admin/schema.js、三份 i18n、
-- export-site-data、js/main.js 的 painChips()、product.html）先停止讀寫這一欄，
-- 等 4 小時讓 max-age=14400 的快取過期，本步驟才真正拿掉欄位。
--
-- 為什麼刪：
--   - 20 筆只有 2 筆填了值
--   - 它是固定 5 個選項（Dropping/Heat/Loose/Compatibility/Cable Mess），
--     品類一多必然失真——一條傳輸線的痛點不在這五個裡面
--   - 與 claim 重複：每個產品都有一句話賣點、四語、100% 都填了，
--     而全站又已經在講四支柱（磁吸更穩固／固定更牢靠／結構更耐用／充電更安心）。
--     痛點 chips 等於用更弱的形式重述同一件事
--
-- 它是第三個因「要求主觀判斷、判斷錯了沒有症狀」而沒人填的欄位，
-- 前兩個是 product_scenarios（已刪）與 use_cases（已刪）。見 CLAUDE.md
-- 「產品層的情境標記：失敗兩次，不要嘗試第三次」。
--
-- ⚠️ 欄位已於 2026-08-18 由 Woody 以臨時查詢先行刪除；本檔補記於 migration
-- 歷史，讓從 migration 重建的資料庫與正式庫一致。`if exists` 使它可重複執行。
-- ============================================================================

begin;

alter table products drop column if exists consumer_pain_point;

commit;
