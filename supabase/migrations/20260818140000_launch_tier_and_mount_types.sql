-- ============================================================================
-- launch_tier 收斂為三個值；mount_type 擴充為 13 種固定方式
--
-- launch_tier 原本有四個值，其中三個什麼也不做：匯出函式只讀
-- `launch_tier === 'Future'`，而 A/B/C 的差別從未被任何程式或頁面消費過
-- （且 launch_tier 本身刻意不匯出——稽核方向 C 早就擋下它，因為把
-- 「B - 測試」「C - 展示」發到公開檔案等於告訴訪客哪些 SKU 只是試水溫）。
--
-- 收斂後三個值各有明確作用：
--   Buyable       可販售，顯示價格與購買鈕
--   Future        即將推出，隱藏價格與購買鈕
--   Discontinued  已停售，頁面留著但不能買
--
-- ⚠️ `Discontinued` 與 products.status 的同名值**語意不同，刻意並存**：
--   status = 'Discontinued'       → 整筆不上站（匯出時被 status='Published' 濾掉）
--   launch_tier = 'Discontinued'  → 頁面仍在，只是不能買
-- 後者才是常見需求：停產後保留產品頁供既有用戶查規格、保住既有的 SEO 與外部連結。
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. launch_tier
-- ---------------------------------------------------------------------------

-- 順序與 categories 那次相同：先拆約束、改完資料、才重新掛上。
-- 反過來做會被既有的 'A - Core' 等值當場擋下。
alter table products drop constraint if exists products_launch_tier_check;

-- A/B/C 三個值對程式的意義完全相同（都不是 Future，所以都是可販售），
-- 因此一律映射為 Buyable。內部上市分級如果日後真的要用來排程，
-- 應該另開 product_development 的欄位，不要再混進這個對外欄位。
update products
   set launch_tier = 'Buyable'
 where launch_tier in ('A - Core', 'B - Test', 'C - Display') or launch_tier is null;

alter table products
  add constraint products_launch_tier_check
  check (launch_tier in ('Buyable', 'Future', 'Discontinued'));

alter table products alter column launch_tier set default 'Future';

comment on column products.launch_tier is
  'Buyable / Future / Discontinued — 能不能買。與 status（要不要上站）是兩個獨立開關。'
  'Discontinued 表示頁面留著但不能買；要整筆下站請用 status = Discontinued。';

-- ---------------------------------------------------------------------------
-- 2. mount_type：6 種 → 13 種
-- ---------------------------------------------------------------------------

-- 沒有 CHECK 約束（text[]），所以資料庫端只需要更新註解；可選值由
-- admin/schema.js 的 options 控制，翻譯由 admin/option-i18n.js 與 js/i18n.js 提供。
--
-- 新增七種的定義（2026-08-18 Woody 指定）：
--   PU-Suction    奈米膠吸盤 —— 與 Suction（真空吸盤）是不同機構，並存
--   Magnetic      磁吸底座 —— 指底座以磁力吸附車體或金屬面，不是手機端的磁吸
--   Clip          彈簧式夾子
--   Clamp         旋轉式夾持 —— 與 Clip 是不同機構
--   Screw         以螺絲鎖固
--   Quarter-Inch  1/4" 相機標準螺牙（相機腳架世界的通用規格）
--   Magsafe       手機以 MagSafe 磁鑽陣列吸附
--
-- 值刻意不含空格與斜線：匯出時會小寫化後當 i18n 鍵（`t('mount.' + m)`），
-- `1/4 inch` 會變成 `mount.1/4 inch`，鍵裡帶空格與斜線雖然能用但極易出錯。
--
-- ⚠️ Magsafe 的顯示文字一律是「相容 MagSafe」而非光禿禿的「MagSafe」。
-- MagSafe 是 Apple 商標，白皮書附錄 B 與 CLAUDE.md 只允許相容性描述，
-- 不得把它當成自家品類或規格名稱。存的值是內部代號，對客顯示走 i18n。
comment on column products.mount_type is
  'Vent / Dashboard / Suction / PU-Suction / Tape / Screen / Clip / Clamp / Screw / '
  'Quarter-Inch / Magnetic / Magsafe / Desktop —— 固定方式，可複選。'
  '顯示文字由 i18n 提供；Magsafe 一律顯示為「相容 MagSafe」（商標規範）。';

commit;
