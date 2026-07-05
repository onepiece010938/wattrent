<!--
Google Play launch — master fill-in template.
Copy this file to google-play-launch-<app>.md, replace every [FILL: ...],
then paste each field into Play Console. Delete guidance you don't need.
Write user-facing store copy in the app's primary store language (zh-TW for Taiwan).
-->

# Google Play 上架填寫表 — [FILL: App 名稱]

> 套件名稱 / applicationId（**上傳後永久不可改**）：`[FILL: e.g. app.example]`
> 預設商店語言：`[FILL: 繁體中文 (台灣)]`

---

## 1. 商店資訊 Store listing（全部用預設語言 zh-TW）

**應用程式名稱 App name**（≤ 30 字）
```
[FILL: 例如「電費快拍 WattRent｜AI電表辨識、自動算電費」]
```
- 不要放 emoji、全大寫、價格/「免費下載」、「第一」、假評價、下載呼籲、對手名稱、關鍵字堆疊。

**簡短說明 Short description**（≤ 80 字，會顯示在最上方）
```
[FILL: 一句話講清楚「這個 App 幫使用者做什麼」，把主要關鍵字自然放進去]
```

**完整說明 Full description**（≤ 4000 字）
```
[FILL: 建議結構]
[開頭 1–2 句價值主張：對誰、解決什麼問題]

【主要功能】
• [功能 1]
• [功能 2]
• …

【適合誰用】
• [目標族群 1]
• …

【運作方式】
1. […]
2. […]

【關於隱私】
• 你可以隨時在 App 內刪除帳號與所有資料（[路徑]）。
• 隱私權政策：[FILL: URL]

如有問題或建議，歡迎來信 [FILL: contact email]。
```

### 圖像 Graphics（需自行產生圖檔）
| 項目 | 規格 | 狀態 |
|---|---|---|
| 應用程式圖示 App icon | 512×512 PNG/JPEG，≤1MB | [FILL] |
| 主題圖片 Feature graphic | 1024×500 PNG/JPEG，≤15MB | [FILL] |
| 手機螢幕截圖 | 2–8 張，16:9 或 9:16，每邊 320–3840px（宣傳資格需 ≥4 張、單邊 ≥1080px） | [FILL] |
| 7 吋平板截圖（選填） | 最多 8 張 | [FILL] |
| 10 吋平板截圖（選填） | 最多 8 張，單邊 1080–7680px | [FILL] |
| 宣傳影片 YouTube（選填） | 公開/不公開、關廣告、無年齡限制 | [FILL] |

---

## 2. 應用程式內容 App content

**隱私權政策 URL**：`[FILL: https://…/privacy/]`
**帳號刪除網址 Account deletion URL**：`[FILL: https://…/privacy/#delete-account]`
> 必須是公開頁面，載明：App 名稱、開發者、App 內刪除路徑、Email 申請方式、會刪除/保留哪些資料。

**廣告 Ads**：`[FILL: 有 / 無]`（有接任何廣告 SDK → 有）

**App access（應用程式存取權）**
- 若全部功能需登入 → 提供審核用測試帳號：
  - 帳號：`[FILL: reviewer email]`　密碼：`[FILL: 放密碼管理器，勿寫進版控]`
  - 操作說明：`[FILL: 如何登入 + 到達主要功能；SSO-only 要提供 email/密碼路徑]`

**內容分級 Content rating（IARC 問卷）**
- 類別：`[FILL: 例如 工具/生產力]`；暴力/性/賭博/藥物…：`[FILL: 一般工具全選無]`

**目標對象與內容 Target audience**
- 年齡層：`[FILL: 有廣告建議只勾 18+ / 或 13+]`；是否以兒童為目標：`[FILL: 否]`

**其他聲明**：政府 App `[FILL: 否]`／金融功能 `[FILL: 否]`／健康 `[FILL: 否]`

---

## 3. 資料安全 Data safety

> 逐一針對每個「有收集」的資料類型作答。四個問題：
> (a) 收集/分享？　(b) 暫時性處理？　(c) 需要 vs 可選？　(d) 用途（可複選）
>
> **關鍵：什麼算「分享」** — 只有「第三方拿去做自己用途」才算分享。
> 你自己的後端 / Firebase / GCP、Sentry（代你處理的服務供應商）= **不算分享**。
> 廣告 SDK 拿到廣告 ID = **算分享**。免費 AI/OCR API 可能拿內容訓練 = **算分享**
> （改用付費/已 opt-out 方案則不算）。

| 資料類型 | 收集 | 分享 | 暫時性 | 需要/可選 | 用途 |
|---|---|---|---|---|---|
| 名稱 Name | [FILL: 是] | [FILL: 否] | 否 | [FILL: 可選] | 帳戶管理 |
| 電子郵件 Email | [FILL: 是] | [FILL: 否] | 否 | [FILL: 需要] | 帳戶管理＋應用程式功能 |
| 使用者 ID User ID | [FILL: 是] | [FILL: 否] | 否 | [FILL: 需要] | 帳戶管理＋應用程式功能＋數據分析* |
| 相片 Photos | [FILL: 是/否] | [FILL: 見上方 AI 規則] | 否 | [FILL: 可選] | 應用程式功能 |
| 當機記錄 Crash logs | [FILL: 是] | 否 | 否 | 需要 | 數據分析 |
| 裝置或其他 ID（廣告 ID） | [FILL: 是] | **是**（給廣告 SDK） | 否 | 需要 | 廣告或行銷＋詐欺防範/安全性 |
| 位置 / 聯絡人 / 其他 | [FILL: 視 App] | … | … | … | … |

\* User ID 若有附在當機事件（Sentry 等）→ 加勾「數據分析」。Email/名稱通常沒有。

---

## 4. 廣告 ID 聲明 Advertising ID declaration（App content 內獨立表單）

- 應用程式是否使用廣告 ID？ **[FILL: 是]**
  > 有接 AdMob / Google Mobile Ads SDK → 一定選「是」（SDK 會自動併入 `AD_ID`
  > 權限）。選「否」會讓廣告 ID 變成一串零、廣告投放/收益壞掉。
- 用途（可複選）：
  - [x] 廣告或行銷（必選）
  - [x] 詐欺防範、安全性和法規遵循（AdMob 偵測無效流量）
  - [ ] 數據分析（可選）
  - 其他（應用程式功能/開發人員通知/個人化/帳戶管理）**不要勾**。
- 要跟第 3 節「裝置或其他 ID → 分享」一致。

---

## 5. 送審前檢查

- [ ] Store listing 三欄文字都填、字數在上限內
- [ ] 圖示 + 主題圖片 + ≥2（宣傳需 ≥4）張截圖已上傳
- [ ] 隱私權政策 URL + 帳號刪除網址可公開開啟
- [ ] App 內真的有「刪除帳號」功能（不是假按鈕）
- [ ] Data safety 只有「廣告 ID」（必要時加「相片」）標分享，其餘只收集
- [ ] 廣告 ID 聲明 = 是；用途含 廣告或行銷
- [ ] 內容分級 / 目標對象 / App access 測試帳號都完成
- [ ] targetSdk ≥ 33 → 廣告 ID 聲明為必填
