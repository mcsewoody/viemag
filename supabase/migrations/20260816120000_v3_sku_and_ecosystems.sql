-- ============================================================================
-- V3 產品編碼與七大生態
--
-- 依《VIEMAG 產品編碼手冊 V3》（2026-08-16 定案）改寫產品分類與料號：
--
--   格式  [分類1碼][電力碼選用][序號2碼][-顏色選用]
--   分類  V 車用 / D 桌面 / R 騎行 / S 創作 / B 行動電源 / P 隨身 / A 擴充配件
--   電力  Q = 無線充(Qi)、C = 有線充(Cable)、不帶電則省略
--
-- 這支 migration 做四件事：
--   1. categories 由 6 個舊分類改為 7 大生態（car-chargers 併入 vehicle）
--   2. products 重新指派 category_id、改寫 product_id / official_sku_code / slug
--   3. 新增 sub_category / use_cases / qi_id 欄位，product_development 新增 design_group
--   4. 刪除 product_scenarios —— 情境不再是產品欄位（手冊 §2）
--
-- ⚠️ 情境本身（scenarios 表）保留，改作 scenarios.html 的人工策展行銷頁。
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. categories：CAT-A~E 換成七大生態字母
-- ---------------------------------------------------------------------------

-- internal_cat_mapping 原本只收 CAT-A~E，改收生態字母。
-- 這一欄會經 export-site-data 進 js/data.js 的 `cat`，顯示在分類卡上，
-- 所以值本身要是對外可看的（生態字母沒有內部資訊，CAT-x 也沒有）。
--
-- ⚠️ 順序很重要：先「拆掉」舊約束，把所有列改成新值之後，才在本節末尾重新建立。
-- 反過來做（先建新約束再改資料）會被既有的 CAT-A~E 值當場擋下。
alter table categories drop constraint if exists categories_internal_cat_mapping_check;

-- 先把 car-chargers 的產品移到 car-mounts（兩者合併為 V 車用生態），
-- 再刪掉 car-chargers 這一列。順序不可顛倒，否則 category_id 會被設成 null。
update products
   set category_id = (select id from categories where slug = 'car-mounts')
 where category_id = (select id from categories where slug = 'car-chargers');

delete from categories where slug = 'car-chargers';

-- 既有五列就地轉成生態（保留 id，才不會動到已指向它們的 products.category_id）
update categories set
  slug = 'vehicle', category_name = 'Vehicle', internal_cat_mapping = 'V',
  name_en = 'Vehicle', name_vi = 'Ô tô', name_id = 'Mobil', name_zh = '車用生態',
  art_key = 'dash', sort_order = 1
 where slug = 'car-mounts';

update categories set
  slug = 'desk', category_name = 'Desk', internal_cat_mapping = 'D',
  name_en = 'Desk', name_vi = 'Để bàn', name_id = 'Meja', name_zh = '桌面生態',
  art_key = 'deskcharge', sort_order = 2
 where slug = 'desk-travel';

update categories set
  slug = 'studio', category_name = 'Studio', internal_cat_mapping = 'S',
  name_en = 'Studio', name_vi = 'Sáng tạo', name_id = 'Studio', name_zh = '創作生態',
  art_key = 'tripod', sort_order = 4
 where slug = 'stands-display';

update categories set
  slug = 'battery', category_name = 'Battery', internal_cat_mapping = 'B',
  name_en = 'Battery', name_vi = 'Sạc dự phòng', name_id = 'Power Bank', name_zh = '行動電源生態',
  art_key = 'powerbank', sort_order = 5
 where slug = 'portable-power';

update categories set
  slug = 'accessory', category_name = 'Accessory', internal_cat_mapping = 'A',
  name_en = 'Accessory', name_vi = 'Phụ kiện', name_id = 'Aksesori', name_zh = '擴充配件生態',
  art_key = 'ring', sort_order = 7
 where slug = 'accessories';

-- 兩個新生態。R 首年首發 2 款（手冊 §11.1），先建分類但設為 Future／Hidden，
-- 待實際品項建檔後再由 /admin 改成 Public／Published。
insert into categories (category_name, slug, internal_cat_mapping, art_key, sort_order,
                        visibility, status, name_en, name_vi, name_id, name_zh)
values
  ('Ride', 'ride', 'R', 'ride', 3, 'Future', 'Hidden',
   'Ride', 'Xe máy', 'Motor', '騎行生態'),
  ('Portable', 'portable', 'P', 'fold', 6, 'Public', 'Published',
   'Portable', 'Di động', 'Portabel', '隨身行動生態')
on conflict (slug) do nothing;

-- 所有列都已是生態字母，現在才能重新掛上約束。
alter table categories
  add constraint categories_internal_cat_mapping_check
  check (internal_cat_mapping in ('V','D','R','S','B','P','A'));

-- ---------------------------------------------------------------------------
-- 2. products：新欄位
-- ---------------------------------------------------------------------------

-- sub_category：網站導覽用的中分類。SKU 只編到生態這一層，中分類調整不動料號（手冊 §9）。
alter table products add column if not exists sub_category text;

-- use_cases：分類進了 SKU 之後是單選且永久凍結，這一欄是唯一的逃生口（手冊 §2.3）。
-- 多選、可隨時改、不進碼。承接「一款產品確實橫跨多個使用場合」。
alter table products add column if not exists use_cases text[] default '{}';

-- qi_id：Qi 認證編號。V3 的碼上不再有認證標記（`Q` 已改作無線充），
-- 認證狀態改以 qi_status = 'Certified' 為唯一真相，qi_id 是它的佐證（手冊 §7.2）。
alter table products add column if not exists qi_id text;

-- qi_status 已存在且已含 'Certified'，不另開 qi_certified 欄位——
-- 兩個欄位描述同一件事必然會不一致。

-- design_group：同外觀家族。V2 用 50-99 號段表達，V2 自己也承認那是
-- 「隱形知識、編錯了沒有機制會攔」；V3 改用欄位，由稽核腳本檢查（手冊 §6.1）。
alter table product_development add column if not exists design_group text;

-- ---------------------------------------------------------------------------
-- 3. products：重新指派生態 + 改寫料號
-- ---------------------------------------------------------------------------

-- 先把跨生態搬家的四款移到正確分類（其餘沿用原分類列轉成的生態）
update products set category_id = (select id from categories where slug = 'vehicle')
 where product_id = 'S1';        -- 鋁合金加長型萬用磁吸支架：原掛 accessories，實為車用

update products set category_id = (select id from categories where slug = 'portable')
 where product_id in ('T1','L1'); -- 旅行支架、摺疊旅充：本身不儲電 → P（手冊 §3.2）

update products set category_id = (select id from categories where slug = 'battery')
 where product_id = 'VC00110K';   -- 磁吸行動電源：本身儲電 → B

update products set category_id = (select id from categories where slug = 'studio')
 where product_id = 'VD002TRP';   -- 腳架轉接座：影像創作 → S

update products set category_id = (select id from categories where slug = 'desk')
 where product_id in ('VD001STD','VD001MDS'); -- 桌面立架 → D

-- 料號改寫。序號在同一分類碼內唯一、不分電力碼（手冊 §6）。
-- product_id 與 official_sku_code 填同一個值（手冊 §10）；slug 同步，因為
-- 產品頁網址是 ?sku=，slug 不同步會讓兩者分岔。
with remap(old_id, new_code, sub_cat) as (
  values
    -- V 車用生態：01-08 不帶電、09-12 無線充
    ('V1',        'V01',  'mounts'),           -- 出風口磁吸支架
    ('VB002DSH',  'V02',  'mounts'),           -- 儀表板磁吸支架
    ('A1',        'V03',  'mounts'),           -- 3M 膠貼磁吸支架
    ('VB003SUC',  'V04',  'mounts'),           -- 吸盤長臂磁吸支架
    ('S4',        'V05',  'mounts'),           -- 超薄吸盤式磁吸支架
    ('VB004CLP',  'V06',  'mounts'),           -- 螢幕邊磁吸支架
    ('VB006PRO',  'V07',  'mounts'),           -- Pro 強磁耐震支架
    ('S1',        'V08',  'mounts'),           -- 鋁合金加長型萬用磁吸支架
    ('VB00715W',  'VQ09', 'charging-mounts'),  -- 出風口 15W 車充支架
    ('VB00815W',  'VQ10', 'charging-mounts'),  -- 儀表板 15W 車充支架
    ('VB00925W',  'VQ11', 'charging-mounts'),  -- 25W 主動散熱車充支架
    ('VB010ARM',  'VQ12', 'charging-mounts'),  -- 長臂可調車充支架
    -- D 桌面生態
    ('VD001STD',  'D01',  'stands'),           -- 桌面磁吸立架
    ('VD001MDS',  'D02',  'stands'),           -- 磁吸式雙裝置支架
    -- P 隨身行動生態（本身不儲電）
    ('T1',        'P01',  'travel'),           -- 磁吸旅行支架
    ('L1',        'PQ02', 'travel'),           -- 摺疊旅行充電座（無線充）
    -- B 行動電源生態（本身儲電，無線＋有線 → 取 Q）
    ('VC00110K',  'BQ01', 'power'),            -- 磁吸行動電源 10K
    -- S 創作生態
    ('VD002TRP',  'S01',  'creator'),          -- 磁吸腳架轉接座
    -- A 擴充配件生態
    ('VE001RNG',  'A01',  'interface'),        -- 磁吸轉接環套組
    ('VE002KIT',  'A02',  'interface')         -- 手機殼＋轉接環組合
)
update products p set
  product_id        = r.new_code,
  official_sku_code = r.new_code,
  slug              = lower(r.new_code),
  sub_category      = r.sub_cat
from remap r
where p.product_id = r.old_id;

-- ---------------------------------------------------------------------------
-- 4. 情境與產品脫鉤
-- ---------------------------------------------------------------------------

-- 六大情境完全下架為產品欄位（手冊 §2.1）：實測 20 款中 14 款擠在 S2 通勤、
-- S1 晨起 0 款，且已有兩款根本沒填——當篩選器無意義，當管理欄位是純負擔。
-- scenarios 表本身保留，改由 combo_skus 人工策展。
drop table if exists product_scenarios;

-- scenarios.combo_skus 是人工策展的推薦組合，改版前就已經壞了：
-- deskwork 與 travel 引用 VA002DSK / VA00115W / VA003FLD 三個**不存在的料號**
-- （前一次改碼時沒同步，DAILY_LOG 早有警告「改碼時須同步更新，否則情境推薦組合會斷連」）。
-- 這裡一併改成 V3 碼並補成真實存在的品項。combo_skus 是**逗號分隔的 text**
-- （export-site-data 對它做 .split(',')），不是陣列——寫成 array[] 會壞掉。
update scenarios set combo_skus = 'V02,VQ10,A01'  where scenario_code = 'S2'; -- 通勤：儀表板支架＋儀表板車充＋轉接環
update scenarios set combo_skus = 'D01,D02,A02'   where scenario_code = 'S3'; -- 辦公：桌面立架＋雙裝置支架＋殼環組
update scenarios set combo_skus = 'PQ02,P01,A01'  where scenario_code = 'S5'; -- 差旅：摺疊旅充＋旅行支架＋轉接環
update scenarios set combo_skus = 'S01,A01'         where scenario_code = 'S6'; -- 創作：腳架轉接座＋轉接環
update scenarios set combo_skus = 'BQ01,A01'        where scenario_code = 'S1'; -- 晨起：行動電源＋轉接環（原本 0 款）
update scenarios set combo_skus = 'D01,BQ01'        where scenario_code = 'S4'; -- 居家：桌面立架＋行動電源（原本 0 款）

commit;
