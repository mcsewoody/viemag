-- ============================================================================
-- 兩軸資訊架構：生態 × 情境
--
-- 網站原本以三軸組織（Persona × 分類 × 情境）。三軸互相高度相關，因為
-- Persona 其實是「情境」的另一種說法——「通勤族」不是人格特質，是處在通勤
-- 情境裡的人。資料也證實了：知道生態就能推出 Persona（V→通勤族 79%、
-- S→創作者 100%、B→差旅 100%）。
--
-- 這支 migration 收斂為兩軸：
--   軸一 生態  = 這是什麼產品（分類、SKU 第 1 碼，單選、凍結）
--   軸二 情境  = 什麼場合用（人工策展的組合，可跨生態）
--
-- 做四件事：
--   1. 刪 products.persona   —— Persona 完全退為行銷層，不再是產品欄位
--   2. 刪 products.use_cases —— 「每個產品標情境」這件事失敗兩次（見下）
--   3. 刪 scenarios.scenario_code —— S1-S6 全面退役，slug 才是識別碼
--   4. 六情境重整：刪 morning、creator 改名、新增 outdoor
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. Persona 退為行銷層
-- ---------------------------------------------------------------------------

-- 白皮書那套 Persona 研究（年齡層、需求、痛點）仍然有價值，但它的用處是
-- 寫文案、下廣告、決定拍什麼照片——不是讓訪客在網站上按按鈕篩選。
-- 留在白皮書與行銷企劃裡，不當資料欄位。
alter table products drop column if exists persona;

-- ---------------------------------------------------------------------------
-- 2. 產品層的情境標記：失敗兩次，不再嘗試第三次
-- ---------------------------------------------------------------------------

-- 第一次是 product_scenarios 關聯表（2026-08-16 刪除）：20 款裡 14 款擠在
-- S2、S1 一款都沒有、兩款完全空白。
-- 第二次是 use_cases 欄位（2026-08-16 建立，本日刪除）：**20 筆填了 0 筆**。
--
-- 兩次都不是紀律問題，是這種欄位天生不會有人維護——它要求每個建檔的人對
-- 每一款產品做一次主觀判斷，而判斷錯了不會有任何症狀。
--
-- 改為只留 scenarios.combo_skus：6 個人工策展組合，一個人顧。維護量從
-- 「20 產品 × 標籤」降到「6 個組合」。
--
-- 代價要說清楚：情境**不再能篩選產品**，它只是 6 個組合，不是瀏覽維度。
-- 以現在 20 個 SKU 來說 7 個生態桶已經夠細。日後真的需要情境篩選時，
-- combo_skus 本身就是「產品↔情境」的關聯（只是存在情境那一側），可以
-- 從它反推，不必重新加欄位。
alter table products drop column if exists use_cases;

-- ---------------------------------------------------------------------------
-- 3. S1-S6 代號退役
-- ---------------------------------------------------------------------------

-- scenario_code 已經沒有消費端：對訪客不顯示（2026-08-17 移除頁面上的
-- 「S5 · 輔助」抬頭），而 slug 才是真正的識別碼（網頁錨點 #driving 用它、
-- js/data.js 的 id 也是它）。依專案規則，沒有消費端的欄位就該刪掉。
--
-- 刻意不「把騰出來的 S1 給新情境」——重用退役代號會讓舊文件反著讀，
-- 跟料號凍結是同一條紀律。整組退役最乾淨。
alter table scenarios drop column if exists scenario_code;

-- ---------------------------------------------------------------------------
-- 4. 六情境重整
-- ---------------------------------------------------------------------------

-- 晨起・梳妝刪除：它跟居家・休憩的差別只在時段（早上 vs 休憩），而**產品
-- 需求完全相同**——床邊要的就是一個立架或充電座。改版前它也是唯一一個
-- 0 款產品的情境，從未撐起自己的位置。
delete from scenarios where slug = 'morning';

-- 戶外・創作拆成兩個。原本把「地點」和「目的」綁在一起：戶外是你人在哪裡，
-- 創作是你在做什麼，兩者互相獨立（在家直播＝創作不戶外，露營看導航＝
-- 戶外不創作）。現有這一筆的組合是腳架＋轉接環，本來就偏創作，留給創作。
update scenarios set
  slug = 'creator', scenario_name = 'Record & Create',
  name_en = 'Record & create', name_vi = 'Ghi lại & sáng tạo',
  name_id = 'Rekam & berkarya', name_zh = '紀錄・創作',
  desc_en = 'Filming, livestreaming and tripod work — for anyone recording, not just professionals.',
  desc_vi = 'Quay phim, livestream và chân máy — cho bất kỳ ai muốn ghi lại, không chỉ dân chuyên.',
  desc_id = 'Merekam, livestream, dan tripod — untuk siapa saja, bukan hanya profesional.',
  desc_zh = '拍攝、直播與腳架應用。「紀錄」不限專業創作者——拍小孩、錄一趟路程都算。',
  priority = 6
 where slug = 'creator';

-- 戶外・出遊新增。與差旅・出差的分界是**有沒有插座**：飯店有電，行李要輕，
-- 所以差旅要摺疊旅充；戶外沒有電，所以要自帶電的行動電源與耐候。越南的
-- 機車出遊自然落在這裡。
insert into scenarios (scenario_name, slug, priority, status, icon, combo_skus,
                       name_en, name_vi, name_id, name_zh,
                       desc_en, desc_vi, desc_id, desc_zh)
values ('Outdoors & Trips', 'outdoor', 5, 'Supporting', 'sun', 'BQ01,V08,A01',
        'Outdoors & trips', 'Ngoài trời & du ngoạn', 'Luar ruang & jalan-jalan', '戶外・出遊',
        'No power outlet for hours — the difference from business travel is bringing your own.',
        'Không có ổ điện trong nhiều giờ — khác với công tác, bạn phải tự mang điện theo.',
        'Tanpa colokan listrik berjam-jam — bedanya dengan perjalanan bisnis: bawa daya sendiri.',
        '一整天沒有插座可用——與差旅的差別就在於電要自己帶。')
on conflict (slug) do nothing;

-- combo_skus 之前是以 scenario_code 為鍵設定的；該欄位已刪除，此後一律以
-- slug 為鍵。順手確認留下的五筆都還指向存在的料號。
update scenarios set combo_skus = 'V02,VQ10,A01' where slug = 'driving';
update scenarios set combo_skus = 'D01,D02,A02'  where slug = 'deskwork';
update scenarios set combo_skus = 'D01,BQ01'     where slug = 'home';
update scenarios set combo_skus = 'PQ02,P01,A01' where slug = 'travel';
update scenarios set combo_skus = 'S01,A01'      where slug = 'creator';

commit;
