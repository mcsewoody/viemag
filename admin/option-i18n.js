/* VIEMAG Admin — select/multiselect OPTION VALUE translations (2026-08-06).
   Found during a full i18n audit: renderFieldInput() was displaying every
   select/multiselect option as its raw stored value (esc(o)) with no
   translation layer at all — so every dropdown and checkbox list showed
   English regardless of the admin UI language, even though field labels and
   descriptions were fully translated. This file is that missing layer.

   Structure mirrors field-i18n.js: [lang][table][field][raw stored value] ->
   translated label. Falls back to the raw value when a language/table/field/
   value combination has no entry — same fallback discipline as fieldDesc().

   CONSISTENCY RULE: wherever a value is ALSO shown on the public site, the
   wording here is copied verbatim from js/i18n.js (mount.*, pain.*, qi.*,
   badge.*, cats.soon, insights.cat.*) or from export-site-data's STATIC.personas
   — never re-invented. A PM reading the admin dropdown in Chinese and a
   visitor reading the same concept on the live site should see the same word.
   Where a value never reaches the site (products.status internal states,
   test_reports fields, the two inbox tables, etc.), the wording below is
   authored fresh for this file.

   DELIBERATELY NOT translated — these are codes, not labels, and translating
   them would make them harder to match against source documents, not easier:
     products.art_key              (illustration slugs — internal asset keys)
     categories.internal_cat_mapping (CAT-A..E — the White Paper's own codes)
     scenarios.scenario_code        (S1..S6 — the IA's own codes)
     products.charging_watt's 15W/25W (a wattage number, language-neutral)
*/
window.VIEMAG_OPTION_I18N = {
  'zh-Hant': {
    products: {
      status: { Development: '開發中', Draft: '草稿', Review: '審核中', Published: '已發佈', Hidden: '隱藏', Discontinued: '已停產' },
      launch_tier: { 'A - Core': 'A - 核心', 'B - Test': 'B - 測試', 'C - Display': 'C - 展示', Future: '即將推出' },
      persona: { commuter: '科技通勤族', homeoffice: '居家辦公專業者', traveler: '差旅商務人士', creator: '戶外/影像創作者' },
      consumer_pain_point: { Dropping: '手機掉落', Heat: '充電發熱', Loose: '吸不牢', Compatibility: '相容性問題', 'Cable Mess': '線材雜亂' },
      mount_type: { Vent: '出風口', Dashboard: '儀表板', Suction: '吸盤', Tape: '3M 貼片', Screen: '螢幕邊夾', Desktop: '桌面' },
      charging_watt: { None: '無', TBD: '待定' },
      qi_status: { 'Not applicable': '無充電功能', Compatible: '依 Qi2 標準設計', Testing: '依 Qi2.2 標準設計（認證進行中）', Certified: 'Qi2 認證', Pending: '待定' },
      badge: { bestseller: '人氣', new: '新品', soon: '即將推出' },
    },
    categories: {
      visibility: { Public: '公開', Internal: '內部', Future: '即將推出' },
      status: { Published: '已發佈', Hidden: '隱藏' },
    },
    scenarios: {
      status: { Primary: '主要', Secondary: '次要', Supporting: '輔助', Future: '即將推出', Hidden: '隱藏' },
      proof_needed: { Vibration: '震動', Heat: '過熱', Magnetic: '磁力', Durability: '耐用度' },
    },
    test_reports: {
      test_type: { Vibration: '震動', Heat: '過熱', Drop: '跌落', 'Magnetic Force': '磁力', Lifecycle: '壽命', Qi: 'Qi 無線充電' },
      evidence_level: { 'Third-party': '第三方', 'Internal Lab': '內部實驗室', 'Factory Test': '工廠測試', Pending: '待定' },
      public_status: { Public: '公開', 'Internal Only': '僅限內部', Pending: '待定' },
    },
    guides: {
      category: { 'Magnetic Technology': '磁吸科技', 'Charging Standards': '充電標準', 'Apple Ecosystem': 'Apple 生態', 'Industry Trends': '產業趨勢', 'Tech Explained': '技術解讀' },
      status: { Idea: '構想', Draft: '草稿', Review: '審核中', Published: '已發佈' },
      funnel_stage: { Awareness: '認知階段', Consideration: '考慮階段', Conversion: '轉換階段', Support: '售後支援' },
      cta: { Shopee: 'Shopee', Product: '產品頁', Dealer: '經銷商頁', Support: '支援頁' },
    },
    assets: {
      asset_type: { 'Product Image': '產品圖', Lifestyle: '情境圖', 'Test Graphic': '測試圖表', Video: '影片', Packaging: '包裝', Icon: '圖示' },
      language: { VI: '越南文', EN: '英文', ZH: '中文', Universal: '通用' },
      usage_rights: { Owned: '自有', Licensed: '授權取得', KOL: 'KOL 提供', Pending: '待定' },
      status: { Draft: '草稿', Approved: '已核准', 'Needs Retouch': '需要修圖', Archived: '已封存' },
    },
    faq: {
      category: { Installation: '安裝', Compatibility: '相容性', Warranty: '保固', Charging: '充電', Heat: '發熱', Return: '退換貨' },
      status: { Draft: '草稿', Published: '已發佈', Archived: '已封存' },
    },
    dealer_leads: {
      channel_type: { Shopee: 'Shopee', Retail: '實體零售', Distributor: '經銷商', 'Car Accessories': '汽車配件', 'Mobile Accessories': '手機配件' },
      first_order_readiness: { Ready: '可下單', 'Need Samples': '需要樣品', 'Just Researching': '還在了解' },
      status: { New: '新申請', Contacted: '已聯繫', 'Sample Sent': '已寄樣', Negotiating: '洽談中', Won: '已成交', Lost: '已流失' },
    },
    support_cases: {
      purchase_channel: { Shopee: 'Shopee', Dealer: '經銷商', Website: '官網', Other: '其他' },
      issue_type: { DOA: '到貨即故障', Heat: '發熱', Drop: '摔落損壞', Charging: '充電問題', 'Mount Loose': '吸附鬆脫', Compatibility: '相容性問題', Other: '其他' },
      warranty_status: { 'Within 14 Days': '14 天內', 'Within 12 Months': '12 個月內', 'Out of Warranty': '已過保固', Unknown: '未知' },
      resolution: { Replace: '換貨', Guide: '指導排除', Reject: '拒絕', Pending: '待定' },
      cost_owner: { VIEMAG: 'VIEMAG', Customer: '客戶', Shared: '共同分攤', Dealer: '經銷商' },
      status: { New: '新案件', Reviewing: '審查中', Resolved: '已解決', Escalated: '已升級處理' },
    },
  },

  'zh-Hans': {
    products: {
      status: { Development: '开发中', Draft: '草稿', Review: '审核中', Published: '已发布', Hidden: '隐藏', Discontinued: '已停产' },
      launch_tier: { 'A - Core': 'A - 核心', 'B - Test': 'B - 测试', 'C - Display': 'C - 展示', Future: '即将推出' },
      persona: { commuter: '科技通勤族', homeoffice: '居家办公专业者', traveler: '差旅商务人士', creator: '户外/影像创作者' },
      consumer_pain_point: { Dropping: '手机掉落', Heat: '充电发热', Loose: '吸不牢', Compatibility: '兼容性问题', 'Cable Mess': '线材杂乱' },
      mount_type: { Vent: '出风口', Dashboard: '仪表板', Suction: '吸盘', Tape: '3M 贴片', Screen: '屏幕边夹', Desktop: '桌面' },
      charging_watt: { None: '无', TBD: '待定' },
      qi_status: { 'Not applicable': '无充电功能', Compatible: '依 Qi2 标准设计', Testing: '依 Qi2.2 标准设计（认证进行中）', Certified: 'Qi2 认证', Pending: '待定' },
      badge: { bestseller: '人气', new: '新品', soon: '即将推出' },
    },
    categories: {
      visibility: { Public: '公开', Internal: '内部', Future: '即将推出' },
      status: { Published: '已发布', Hidden: '隐藏' },
    },
    scenarios: {
      status: { Primary: '主要', Secondary: '次要', Supporting: '辅助', Future: '即将推出', Hidden: '隐藏' },
      proof_needed: { Vibration: '振动', Heat: '过热', Magnetic: '磁力', Durability: '耐用度' },
    },
    test_reports: {
      test_type: { Vibration: '振动', Heat: '过热', Drop: '跌落', 'Magnetic Force': '磁力', Lifecycle: '寿命', Qi: 'Qi 无线充电' },
      evidence_level: { 'Third-party': '第三方', 'Internal Lab': '内部实验室', 'Factory Test': '工厂测试', Pending: '待定' },
      public_status: { Public: '公开', 'Internal Only': '仅限内部', Pending: '待定' },
    },
    guides: {
      category: { 'Magnetic Technology': '磁吸科技', 'Charging Standards': '充电标准', 'Apple Ecosystem': 'Apple 生态', 'Industry Trends': '产业趋势', 'Tech Explained': '技术解读' },
      status: { Idea: '构想', Draft: '草稿', Review: '审核中', Published: '已发布' },
      funnel_stage: { Awareness: '认知阶段', Consideration: '考虑阶段', Conversion: '转换阶段', Support: '售后支持' },
      cta: { Shopee: 'Shopee', Product: '产品页', Dealer: '经销商页', Support: '支持页' },
    },
    assets: {
      asset_type: { 'Product Image': '产品图', Lifestyle: '情境图', 'Test Graphic': '测试图表', Video: '视频', Packaging: '包装', Icon: '图标' },
      language: { VI: '越南文', EN: '英文', ZH: '中文', Universal: '通用' },
      usage_rights: { Owned: '自有', Licensed: '授权取得', KOL: 'KOL 提供', Pending: '待定' },
      status: { Draft: '草稿', Approved: '已核准', 'Needs Retouch': '需要修图', Archived: '已封存' },
    },
    faq: {
      category: { Installation: '安装', Compatibility: '兼容性', Warranty: '保修', Charging: '充电', Heat: '发热', Return: '退换货' },
      status: { Draft: '草稿', Published: '已发布', Archived: '已封存' },
    },
    dealer_leads: {
      channel_type: { Shopee: 'Shopee', Retail: '实体零售', Distributor: '经销商', 'Car Accessories': '汽车配件', 'Mobile Accessories': '手机配件' },
      first_order_readiness: { Ready: '可下单', 'Need Samples': '需要样品', 'Just Researching': '还在了解' },
      status: { New: '新申请', Contacted: '已联系', 'Sample Sent': '已寄样', Negotiating: '洽谈中', Won: '已成交', Lost: '已流失' },
    },
    support_cases: {
      purchase_channel: { Shopee: 'Shopee', Dealer: '经销商', Website: '官网', Other: '其他' },
      issue_type: { DOA: '到货即故障', Heat: '发热', Drop: '摔落损坏', Charging: '充电问题', 'Mount Loose': '吸附松脱', Compatibility: '兼容性问题', Other: '其他' },
      warranty_status: { 'Within 14 Days': '14 天内', 'Within 12 Months': '12 个月内', 'Out of Warranty': '已过保修', Unknown: '未知' },
      resolution: { Replace: '换货', Guide: '指导排除', Reject: '拒绝', Pending: '待定' },
      cost_owner: { VIEMAG: 'VIEMAG', Customer: '客户', Shared: '共同分摊', Dealer: '经销商' },
      status: { New: '新案件', Reviewing: '审查中', Resolved: '已解决', Escalated: '已升级处理' },
    },
  },

  vi: {
    products: {
      status: { Development: 'Đang phát triển', Draft: 'Bản nháp', Review: 'Đang xét duyệt', Published: 'Đã xuất bản', Hidden: 'Đã ẩn', Discontinued: 'Ngừng kinh doanh' },
      launch_tier: { 'A - Core': 'A - Cốt lõi', 'B - Test': 'B - Thử nghiệm', 'C - Display': 'C - Trưng bày', Future: 'Sắp ra mắt' },
      persona: { commuter: 'Người đi làm yêu công nghệ', homeoffice: 'Chuyên gia làm việc tại nhà', traveler: 'Doanh nhân hay công tác', creator: 'Nhà sáng tạo ngoài trời' },
      consumer_pain_point: { Dropping: 'Điện thoại bị rơi', Heat: 'Nóng khi sạc', Loose: 'Giữ không chắc', Compatibility: 'Không tương thích', 'Cable Mess': 'Dây cáp rối' },
      mount_type: { Vent: 'Cửa gió', Dashboard: 'Táp-lô', Suction: 'Đế hút', Tape: 'Dán 3M', Screen: 'Kẹp màn hình', Desktop: 'Để bàn' },
      charging_watt: { None: 'Không có', TBD: 'Chưa xác định' },
      qi_status: { 'Not applicable': 'Không sạc', Compatible: 'Thiết kế theo chuẩn Qi2', Testing: 'Thiết kế theo chuẩn Qi2.2 (đang kiểm định)', Certified: 'Chứng nhận Qi2', Pending: 'Đang chờ' },
      badge: { bestseller: 'Được chọn nhiều', new: 'Mới', soon: 'Sắp ra mắt' },
    },
    categories: {
      visibility: { Public: 'Công khai', Internal: 'Nội bộ', Future: 'Sắp ra mắt' },
      status: { Published: 'Đã xuất bản', Hidden: 'Đã ẩn' },
    },
    scenarios: {
      status: { Primary: 'Chính', Secondary: 'Phụ', Supporting: 'Hỗ trợ', Future: 'Sắp ra mắt', Hidden: 'Đã ẩn' },
      proof_needed: { Vibration: 'Rung động', Heat: 'Quá nhiệt', Magnetic: 'Lực từ', Durability: 'Độ bền' },
    },
    test_reports: {
      test_type: { Vibration: 'Rung động', Heat: 'Quá nhiệt', Drop: 'Rơi', 'Magnetic Force': 'Lực từ', Lifecycle: 'Tuổi thọ', Qi: 'Qi' },
      evidence_level: { 'Third-party': 'Bên thứ ba', 'Internal Lab': 'Phòng lab nội bộ', 'Factory Test': 'Kiểm tra tại nhà máy', Pending: 'Đang chờ' },
      public_status: { Public: 'Công khai', 'Internal Only': 'Chỉ nội bộ', Pending: 'Đang chờ' },
    },
    guides: {
      category: { 'Magnetic Technology': 'Công nghệ nam châm', 'Charging Standards': 'Chuẩn sạc', 'Apple Ecosystem': 'Hệ sinh thái Apple', 'Industry Trends': 'Xu hướng ngành', 'Tech Explained': 'Giải thích công nghệ' },
      status: { Idea: 'Ý tưởng', Draft: 'Bản nháp', Review: 'Đang xét duyệt', Published: 'Đã xuất bản' },
      funnel_stage: { Awareness: 'Nhận biết', Consideration: 'Cân nhắc', Conversion: 'Chuyển đổi', Support: 'Hỗ trợ' },
      cta: { Shopee: 'Shopee', Product: 'Trang sản phẩm', Dealer: 'Trang đại lý', Support: 'Trang hỗ trợ' },
    },
    assets: {
      asset_type: { 'Product Image': 'Ảnh sản phẩm', Lifestyle: 'Ảnh tình huống', 'Test Graphic': 'Biểu đồ kiểm nghiệm', Video: 'Video', Packaging: 'Bao bì', Icon: 'Biểu tượng' },
      language: { VI: 'Tiếng Việt', EN: 'Tiếng Anh', ZH: 'Tiếng Trung', Universal: 'Dùng chung' },
      usage_rights: { Owned: 'Sở hữu', Licensed: 'Có giấy phép', KOL: 'KOL cung cấp', Pending: 'Đang chờ' },
      status: { Draft: 'Bản nháp', Approved: 'Đã duyệt', 'Needs Retouch': 'Cần chỉnh sửa', Archived: 'Đã lưu trữ' },
    },
    faq: {
      category: { Installation: 'Lắp đặt', Compatibility: 'Tương thích', Warranty: 'Bảo hành', Charging: 'Sạc', Heat: 'Nhiệt độ', Return: 'Đổi trả' },
      status: { Draft: 'Bản nháp', Published: 'Đã xuất bản', Archived: 'Đã lưu trữ' },
    },
    dealer_leads: {
      channel_type: { Shopee: 'Shopee', Retail: 'Bán lẻ', Distributor: 'Nhà phân phối', 'Car Accessories': 'Phụ kiện ô tô', 'Mobile Accessories': 'Phụ kiện điện thoại' },
      first_order_readiness: { Ready: 'Sẵn sàng đặt hàng', 'Need Samples': 'Cần mẫu thử', 'Just Researching': 'Đang tìm hiểu' },
      status: { New: 'Mới', Contacted: 'Đã liên hệ', 'Sample Sent': 'Đã gửi mẫu', Negotiating: 'Đang đàm phán', Won: 'Đã chốt', Lost: 'Đã mất' },
    },
    support_cases: {
      purchase_channel: { Shopee: 'Shopee', Dealer: 'Đại lý', Website: 'Website', Other: 'Khác' },
      issue_type: { DOA: 'Hỏng ngay khi nhận', Heat: 'Nóng', Drop: 'Rơi vỡ', Charging: 'Vấn đề sạc', 'Mount Loose': 'Lỏng khớp hút', Compatibility: 'Không tương thích', Other: 'Khác' },
      warranty_status: { 'Within 14 Days': 'Trong 14 ngày', 'Within 12 Months': 'Trong 12 tháng', 'Out of Warranty': 'Hết bảo hành', Unknown: 'Chưa rõ' },
      resolution: { Replace: 'Đổi hàng', Guide: 'Hướng dẫn xử lý', Reject: 'Từ chối', Pending: 'Đang chờ' },
      cost_owner: { VIEMAG: 'VIEMAG', Customer: 'Khách hàng', Shared: 'Chia sẻ', Dealer: 'Đại lý' },
      status: { New: 'Mới', Reviewing: 'Đang xem xét', Resolved: 'Đã giải quyết', Escalated: 'Đã chuyển cấp trên' },
    },
  },
};
