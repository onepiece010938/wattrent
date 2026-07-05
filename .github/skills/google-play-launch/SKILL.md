---
name: google-play-launch
description: 'Generate a complete, fill-in-the-blank Google Play launch document that covers EVERY Play Console form needed to publish an Android app — store listing (app name / short & full description / graphics specs), Data safety (per-data-type table + sharing logic), Advertising ID declaration, Content rating (IARC), Target audience, App access (reviewer test account), Ads declaration, and the required Privacy policy + account-deletion URLs. USE WHEN the user says: "上架 Google Play", "填 Play Console", "商店資訊怎麼填", "Data safety / 資料安全表", "廣告 ID 聲明", "內容分級", "store listing", "prepare Play Store submission", or is launching a new app to Google Play. Interviews the user (or reads the codebase) then writes one ready-to-paste Markdown doc. NOT for Apple App Store (use apple-appstore-reviewer) or Microsoft Store (use msstore-cli).'
---

# Google Play Launch Document Generator

Produce ONE Markdown document that the user can copy field-by-field into Google
Play Console to publish an Android app. The goal: the user should be able to
paste each answer with zero further thinking.

Bundled asset: [references/listing-template.md](./references/listing-template.md) —
the master template with every Play Console field, char limits, and the tricky
decision logic (Data safety "sharing" rules, Ad ID purposes, deletion URL).

## When to use

The user is preparing a Google Play submission and needs help filling any of:
store listing text, graphics specs, Data safety form, Advertising ID
declaration, content rating, target audience, App access (reviewer login),
ads declaration, or the privacy-policy / account-deletion URLs.

## Output language

Default to the app's primary store language. For Taiwan apps that is
**繁體中文 (zh-TW)** — write all user-facing store copy in zh-TW. Keep the
document's section labels bilingual so the user can map them to Play Console.

## Workflow

1. **Gather facts.** Interview the user (use the ask-questions tool if
   available) OR read the codebase. You need:
   - App name ideas + the permanent `applicationId` (package name).
   - What the app does, target users, key features, how it works.
   - Auth methods (email/password, Google, LINE, Apple…).
   - Data the app collects: account fields (email/name/uid), photos/media,
     location, contacts, crash logs, etc. — and **where each goes** (own
     backend, Firebase/GCP, Sentry, an AI/OCR API, ad SDK…).
   - Ad SDKs (AdMob / other) → these collect the Advertising ID.
   - Analytics / crash SDKs (Sentry, Firebase Analytics…).
   - Any AI/ML API that receives user content (photos, text) — and whether it
     is the **paid/opted-out** tier or a **free tier that may train on data**.
   - The hosted Privacy policy URL + account-deletion URL/anchor.
   - Whether there is a reviewer test account (App access).

2. **Fill the template.** Copy `references/listing-template.md`, replace every
   `[FILL: …]`, and delete guidance the user doesn't need. Write the output to
   `google-play-launch-<app>.md` in the repo (or a docs folder). Never leave a
   `[FILL]` unresolved — if unknown, ask or mark `(需確認)`.

3. **Apply the decision rules below** — these are the parts people get wrong.

4. **Hand off.** Tell the user which fields still need a human (screenshots,
   final graphics, reviewer password) and which URLs to paste where.

## Decision rules (the parts people get wrong)

### Store listing text (metadata policy)
- App name ≤ 30 chars; short description ≤ 80; full description ≤ 4000.
- NO in title/description: emojis-as-decoration, ALL-CAPS, price/"免費下載",
  "No.1"/"最佳", fake testimonials, "download now" CTAs, competitor names,
  or keyword stuffing. Write honest, benefit-led copy.
- Put the primary keyword phrase naturally in the first line of both the short
  and full description (ASO), not as a keyword dump.

### Data safety — "Collected" vs "Shared" (most common mistake)
- **Collected** = data leaves the device to the developer or a third party
  (includes storing it in your own backend). Almost always Yes if you have a
  backend.
- **Shared** = transferred to a third party who uses it **for their own
  purposes**. It is **NOT "sharing"** when the third party is a *service
  provider / processor* acting only on your behalf. So:
  - Firebase/GCP, your own Cloud backend → NOT sharing.
  - Sentry / crash-reporting service provider → NOT sharing.
  - **Ad SDK (AdMob) receiving the Advertising ID → IS sharing** (Google uses
    it for ads). This is usually the ONLY "shared" row.
  - **AI/OCR API on a FREE tier that may use content to improve its models →
    IS sharing** (it uses your users' data for its own purposes). If the app
    uses the **paid/opted-out** tier (e.g. Vertex AI, paid Gemini), it is a
    processor → NOT sharing. Flag this choice to the user explicitly, because
    it changes whether "photos" must be declared as shared.
- **Temporary processing** = Yes only if data lives in memory just long enough
  to serve the request. Anything stored in a DB/bucket → No.
- **Required vs optional**: core identifiers (email, user ID) = required;
  user-provided extras (a photo the user chooses to take, an optional display
  name) = optional.
- **Purposes**: account fields → 帳戶管理 (+ 應用程式功能). A user ID attached to
  crash events also → 數據分析. Crash logs → 數據分析. Advertising ID → 廣告或行銷
  (+ 詐欺防範/安全性).
- **False declarations are an enforcement risk** (rejection → warning →
  removal → account termination). Never advise "say not-shared while actually
  sharing." If the user wants a clean "not shared", advise switching the AI
  backend to the paid/opted-out tier.

### Advertising ID declaration (App content)
- If the app bundles AdMob / Google Mobile Ads SDK (or any ad SDK), answer
  **Yes** — the SDK auto-merges the `com.google.android.gms.permission.AD_ID`
  permission even if you didn't add it. Answering No zeroes the ad ID and
  breaks ad revenue.
- Purposes: **廣告或行銷** (required) + **詐欺防範、安全性和法規遵循** (AdMob invalid-
  traffic detection); 數據分析 optional. Do NOT tick app-functionality/account/
  personalization for the ad ID.
- Keep this consistent with the Data safety "裝置 ID 或其他 ID → shared" row.

### Account deletion (required for account-based apps)
- Data safety asks for an account-deletion URL. It must be a public page (an
  anchor is fine, e.g. `/privacy/#delete-account`) stating: app name,
  developer, in-app deletion path, an email fallback, and what data is
  deleted/kept. Confirm the app also has a real in-app delete flow.

### App access (reviewer login)
- If all features are behind login, provide a reviewer email+password and clear
  steps. Note that SSO-only (Google/LINE) needs a plain email/password path for
  the reviewer, or the review gets blocked.

## Portability

This skill is workspace-scoped. To reuse it for another app, copy the whole
`.github/skills/google-play-launch/` folder into that repo. (Skills don't roam
via user settings sync; a user-level `.prompt.md` does if cross-workspace
availability is needed.)
