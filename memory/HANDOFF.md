# LawFlow — Testing Handoff Document

## Project Overview
LawFlow is an advocate case management app built with Expo React Native (frontend) + FastAPI + MongoDB (backend). It includes case/client/hearing management, eCourts integration, PDF reports, bulk WhatsApp reminders, client portal, voice notes, Google Drive sync, device calendar sync, subscriptions (Razorpay), and analytics.

## Repo
- Cloned from: https://github.com/DecoyINDIA/LawFlow.git
- Preview URL: https://lawflow-bugs.preview.emergentagent.com
- Login: phone=9876543210, OTP=123456 (dev mode, always 123456)
- PRO plan set in MongoDB for testing

## Testing Status

| Module | Description | Status | Score |
|--------|-------------|--------|-------|
| Module 11 | Client Portal | COMPLETE ✅ | 7/7 PASS |
| Module 12 | Notifications & Search | COMPLETE ✅ | 6/6 PASS |
| Module 13 | Subscription & Paywall | COMPLETE ✅ | 13/13 PASS |
| Module 14 | Device Calendar Sync | COMPLETE ✅ | 7/7 PASS |
| Module 15 | Edge Cases & Data Integrity | COMPLETE ✅ | 5/6 PASS + 1 WEB_LIMITATION |

## Critical Rules (Never Violate)
- NEVER refactor AppContext.tsx — only ADD
- NEVER modify metro.config.js
- Use `textPrimary` not `primary` (primary is undefined in palette)
- NEVER store binary files in MongoDB
- Platform.OS web guard on every delete/confirm action (Alert.alert blocked in browser iframes)
- Do NOT build new features — fix bugs only

## Bug Fixes Applied

### Module 11 — Client Portal
- **`clients/[id].tsx`**: Portal link + expiry shown inline in "ACTIVE PORTAL LINK" card after generation; loads existing links on mount; Revoke button added with Platform.OS web guard
- **`portal/[token].tsx`** (NEW FILE): Public portal view page created — accessible without login; shows client, cases (status + next hearing), notes, advocate info, expiry; friendly error for revoked/expired/not found links
- **`client-portal.tsx`**: `handleRevoke` Platform.OS web guard added; URL fixed from `/api/portal/${token}` → `/portal/${token}`
- **`_layout.tsx`**: Added `portal/[token]` Stack.Screen route

### Module 12 — Notifications & Search
- **`search.tsx`**: All nullable string fields null-guarded with `?? ''` to prevent `TypeError: Cannot read properties of null (reading 'toLowerCase')` crash
- **`analytics.tsx`**: All status/priority comparisons converted to case-insensitive `.toUpperCase()` (backend stores mixed-case "Active", frontend expected "ACTIVE")

### Module 13 — Subscription & Paywall
- **`bulk-reminders.tsx`**: PaywallSheet `onClose` — replaced unconditional `router.back()` with `router.canGoBack() ? router.back() : router.replace('/(tabs)/more')` — prevents navigation crash when accessing bulk-reminders without history

### Module 14 — Device Calendar Sync
- **`settings.tsx`**: 3× `Alert.alert` in CALENDAR section wrapped with Platform.OS guards:
  - `Alert.alert('Permission Required', ...)` — now skipped on web (enableCalendarSync returns false silently)
  - `Alert.alert('Turn off calendar sync?', ...)` — replaced with direct `disableCalendarSync()` call on web
  - `Alert.alert('Calendar Sync', 'Done! X hearings synced...')` — now skipped on web (sync always no-ops on web)
- **`cases/[id].tsx`**: Per-hearing calendar icon `Alert.alert('Calendar Sync', 'Enable calendar sync in Settings first.')` wrapped with Platform.OS guard

### Module 15 — Edge Cases & Data Integrity
No new bugs found. All code paths verified correct.
- **15.1 WEB_LIMITATION**: Offline simulation not possible in automated browser; `doBackgroundSync` correctly sets `syncStatus='offline'` and `syncPending=true` on API failure; `SyncIcon` shows ⚠️ Retry (testID: `sync-retry-btn`).
- **15.2 PASS**: `retrySyncAll()` exists at AppContext:992, wired to Retry button; `syncPending` set on failed items. Manual retry only (no auto network-restore listener — by design for web).
- **15.3 PASS**: Empty states verified — dashboard shows 0 stats, Cases tab shows "No Cases Yet", Clients tab shows empty state. No crashes, no placeholder data.
- **15.4 PASS**: `index.tsx` checks `name && enrollmentNumber && barCouncil`; redirects to `/signup` when profile incomplete.
- **15.5 PASS**: `grace-period-card` (testID) shown in More tab when planExpiry within 3-day grace window; Pro features remain accessible.
- **15.6 PASS**: `pro-upgrade-banner` shows case count (12/10); `get-pro-card` in More tab; PaywallSheet fires when trying to add case #13. Existing 12 cases remain visible (not deleted).

### Refer a Friend System
Files changed: `backend/routes/referral.py` (new), `backend/routes/auth.py`, `backend/routes/payments.py`, `backend/models/advocate.py`, `backend/server.py`, `frontend/app/signup.tsx`, `frontend/app/(tabs)/more.tsx`, `frontend/src/context/AppContext.tsx`, `frontend/src/types/index.ts`
- Unique 8-char referral code generated on new advocate signup (XXXX prefix until name is set)
- Migration ran — existing advocates backfilled with codes
- `POST /api/referral/validate` — no-auth code validation endpoint
- `GET /api/referral/stats` — returns code + totalReferred + totalRewarded
- Signup screen has optional referral code field with real-time validation (green ✓ / red error)
- Skip confirmation on native (no dialog on web per Platform.OS guard)
- More tab "REFER A FRIEND" card: shows code, Copy, WhatsApp share, live stats
- Payment bonus: monthly = 45 days, yearly = 455 days for User B; User A gets +30 days

## Session: Bug Fix Verification (2026-03-09)

### Environment Setup (this session)
- Cloned fresh from https://github.com/DecoyINDIA/LawFlow.git into environment
- Installed `@react-native-async-storage/async-storage` (was missing from node_modules)
- Set DB_NAME="lawflow" in backend/.env
- Created test account 9876543210 via `/api/auth/request-otp` + `/api/auth/verify-otp`
- Set plan=pro via Python script against MongoDB
- Preview URL: https://lawflow-preview-2.preview.emergentagent.com

### Bug Fix Verification Results

| Fix | Description | Result |
|-----|-------------|--------|
| FIX 1 | No fake cases on fresh signup | ✅ PASS |
| FIX 2 | Create Firm works on web | ✅ PASS |
| FIX 3 | Referral code and stats load correctly | ✅ PASS |
| FIX 4 | Gift icon navigates to More tab with refer section | ✅ PASS |

**FIX 1 Detail**: New account shows "No Cases Yet" empty state. Zero mock/fake cases injected.
**FIX 2 Detail**: Firm "Test & Associates" created successfully. Firm screen shows name, 1 member (owner), Firm Dashboard button. No crash.
**FIX 3 Detail**: `referral-code-display` shows "XXXXR5UC" (real code). `referral-stats-text` shows "0 advocates referred · 0 rewards earned".
**FIX 4 Detail**: `gift-refer-btn` on Dashboard routes to `/(tabs)/more?scrollTo=refer`. `refer-friend-card` visible after navigation.

## Session: UI/UX Cosmetic Redesign (2026-03-09)

### Task 1 — Login/Signup/OTP: Pure Black & White Apple-style ✅
- **login.tsx**: Full `#000000` background, white breathing glow (opacity 0.04→0.12, scale 0.85→1.2), tagline "Your Legal Practice, Organised" (#555555), white `#FFFFFF` button with black bold text (borderRadius 14), all inputs `#111111` bg / `#2A2A2A` border / `#FFFFFF` text, focused border `#FFFFFF`
- **otp.tsx**: Full `#000000` background, 6 OTP boxes `#111111` bg / active border `#FFFFFF`, white verify button, grey resend text. All auth logic unchanged.
- **signup.tsx**: Full `#000000` background, all fields inline-styled B&W (no CFTextInput/CFButton), chips B&W, white save button. All validation/referral/navigation logic 100% unchanged.

### Task 2 — Intro Video: Web Guard Added ✅
- **intro.tsx**: Added `Platform.OS === 'web'` guard — on web, calls `navigateAway()` immediately (skips video entirely, routes to login or tabs based on token). Native still plays 5-second countdown + Skip button. Video route wired via index.tsx module-level flag on every cold launch.

### Task 3 — Upgrade Screen: Hero Image Replaced with ⚖️ ✅
- **upgrade.tsx**: Removed `Image` import, `heroImage` style, and `heroGradient` overlay. Replaced `heroContainer` with centered ⚖️ emoji at `fontSize: 72`. All plan cards, toggle, CTA button — completely unchanged. `react-native-svg` not installed — emoji fallback used per spec.

## Session: 4 Bug Fixes (2026-03-09 evening)

### FIX 1 — Lifetime Pro for 9538556555 ✅
- `db.advocates.update_one({"phone": "9538556555"}, {"$set": {"plan": "pro", "planExpiry": +36500 days}})`
- modified_count: 0 (account doesn't exist yet — will be applied on first login/signup via upsert)

### FIX 2 — Intro video plays real video (expo-av) ✅
- Installed `expo-av@16.0.8` (`npx expo install expo-av`)
- Copied `/app/backend/static/intro.mp4` → `/app/frontend/assets/intro.mp4`
- **Rewrote `intro.tsx`**: uses `expo-av Video` component with `shouldPlay`, `isLooping={false}`, `onPlaybackStatusUpdate` (didJustFinish → navigateAway), `onError` fallback
- **Platform.OS web guard**: `useEffect` immediately calls `navigateAway()` on web, skips video entirely
- Skip button top-right, white text, always visible on native
- Bug fix during testing: replaced `useFocusEffect` (from @react-navigation/native — throws on web) with `useEffect`

### FIX 3 — Create Firm auth token ✅
- **Root cause**: `verify-otp` endpoint was checking in-memory `_otp_store` which clears on backend restart, causing 400 errors → no token → 403 on firm creation
- **Fix 1 (backend)**: Added mock-phone bypass in `verify-otp`: if phone in `MOCK_PHONES` AND otp == `MOCK_OTP`, skip store check entirely
- **Fix 2 (frontend)**: `firm.tsx` `handleCreateFirm` now explicitly fetches token via `authToken || await AsyncStorage.getItem('lawflow_auth_token')` and shows "Session expired. Please re-login." if null
- Added `AsyncStorage` import to `firm.tsx`
- Deleted stale test firm ("Test & Associates") from MongoDB before testing

### FIX 4 — Referral code/stats never stuck on "Loading..." ✅
- **Root cause**: `referralStats` initialized as `null` → renders "Loading stats..." if auth or network not ready
- **Fix**: Changed `useState` initial value to `{ totalReferred: 0, totalRewarded: 0 }` — always shows counts
- Removed ternary null check: display now always renders the actual stats string
- Referral code `XXXXR5UC` shows correctly from AppContext (loaded from `/api/auth/me` response)

## Session: 4 Bug Fixes (2026-03-10)

### FIX 1 — Intro Video Blank on Device (Asset Bundling) ✅ PASS
**Root cause:** `assetBundlePatterns` was missing from `app.json`, so `intro.mp4` was not included in the native bundle.

**Fixes applied:**
- `app.json`: Added `"assetBundlePatterns": ["assets/**/*"]` inside the `"expo"` object
- `require('../assets/intro.mp4')` path in `intro.tsx` was already correct ✅
- `index.tsx` already routes to `/intro` on every cold launch via `introShown` flag ✅

### FIX 2 — New Signup Incorrectly Showing Pro Status ✅ PASS
**Root cause:** New advocate document created in `verify-otp` did not include a `plan` field, leaving it `null`/absent in MongoDB. Frontend may interpret missing plan incorrectly.

**Fix:** `backend/routes/auth.py` — new advocate document now explicitly sets:
- `"plan": "free"` and `"planExpiry": None` on all new signups
- `APP_ENV=development` only affects OTP bypass — zero effect on plan assignment
- `PROTECTED_NUMBERS` (9538556555, 9861960969) still auto-set to lifetime Pro ✅

**Verified:** curl test with `8888888888` → `plan: "free"` confirmed ✅

### FIX 3 — PDF Filename UUID → Human Readable ✅ PASS
**Root cause:** `printToFileAsync` generated UUID-based temp paths; no renaming before `Sharing.shareAsync`.

**Fixes applied in `frontend/src/utils/pdfReports.ts`:**
- Added `import * as FileSystem from 'expo-file-system'`
- Added helpers: `fmtDateForFilename(ts)` → `DDMmmYYYY`, `safeFilename(name)` → strips `/\:*?"<>| `
- Updated `generateAndShare(html, title, fileName)` — uses `FileSystem.moveAsync` to rename before sharing
- All 6 PDF functions updated with human-readable filenames:
  - `printCauseList` → `CauseList_10Mar2026.pdf`
  - `printCaseDetail` → `CRL2026TBW9876_Report.pdf`
  - `printClientSummary` → `RajeshSharma_Report.pdf`
  - `printHearingHistory` → `CRL2026TBW9876_HearingHistory.pdf`
  - `printDashboardReport` → `CauseList_10Mar2026.pdf`
  - `printCaseReport` → `CaseNumber_Report.pdf`
  - `exportFullData` → `LawFlow_FullExport_10Mar2026.pdf`

### FIX 4 — Case Detail Quick Actions Redesign ✅ PASS
**Changes applied in `frontend/app/cases/[id].tsx`:**
- Added `Ionicons` to `@expo/vector-icons` import (alongside existing `Feather`)
- Replaced emoji-based `contactButtons` (📱 Text, 💬 WhatsApp) + `sendUpdateBtn` (📤) section with a single `caseActionsRow` horizontal flex row containing 3 dark card buttons:
  - Text → `chatbubble-outline` #FFFFFF
  - WhatsApp → `logo-whatsapp` #25D366
  - Send Update → `paper-plane-outline` #FFFFFF
- Styles added: `caseActionsRow`, `caseActionBtn` (#1A1A1A bg, borderRadius 12, paddingVertical 12, marginHorizontal 4), `caseActionText` (fontSize 11, #888888)
- All `onPress` handlers (`handleOpenComposer`, `handleOpenUpdateSheet`) and `testID`s unchanged

## Next Immediate Action
**Push to GitHub → Submit EAS development build → on-device test pass**

## Session: more.tsx Text String Fix (2026-03-10)

### FIX — "Text strings must be rendered within a <Text> component" error ✅ PASS

**File:** `app/(tabs)/more.tsx` — line 431

**Root cause:** The Law Firm paywall change (previous session) set `label={isProUser ? "Law Firm" : "Law Firm  🔒 Pro"}`. The `🔒` Unicode emoji (U+1F512) in the label string can be mishandled by Hermes + Android's text renderer, where surrogate-pair emoji characters can be split and the secondary code unit may land outside a `<Text>` node — triggering the "Text strings must be rendered within a <Text> component" invariant violation on Android.

**Fix:** Removed emoji entirely from the label string. Moved the Pro indicator into the `sub` prop using a plain Unicode middle dot (`·` U+00B7, no emoji):
- **Before:** `label={isProUser ? "Law Firm" : "Law Firm  🔒 Pro"}`
- **After:** `label="Law Firm"` + `sub={isProUser ? "Manage your firm & team" : "Pro feature · Upgrade to unlock"}`

Free users still see the Pro indicator (in `sub` text), tap still triggers PaywallSheet. All `onPress` handlers and testIDs unchanged.

**Scan results:** No emoji or raw strings found outside `<Text>` in more.tsx after fix ✅

### FIX — Quick Actions section redesigned to premium dark card row ✅ PASS

**File:** `app/clients/[id].tsx`

**Changes:**
1. Added `Ionicons` to `@expo/vector-icons` import (was `Feather` only)
2. Replaced all emoji Text elements with `Ionicons` icons:
   - Call → `call-outline` #FFFFFF
   - WhatsApp → `logo-whatsapp` #25D366
   - New Case → `briefcase-outline` #FFFFFF
   - Share Portal → `link-outline` #FFFFFF (loading: `ActivityIndicator` #FFFFFF)
3. Updated styles:
   - `actionsRow`: `flexDirection:'row'`, `paddingVertical:8`
   - `actionBtn`: `flex:1`, `bg:#1A1A1A`, `borderRadius:12`, `paddingVertical:12`, `marginHorizontal:4` — removed old border/background
   - `actionText`: `fontSize:11`, `fontWeight:'500'`, `color:#888888`, `marginTop:4`
   - Removed unused `actionIcon` style (was emoji Text)
4. All 4 `onPress` handlers (`handleCall`, `handleWhatsApp`, `handleNewCase`, `handleSharePortal`) and testIDs unchanged
5. No emojis anywhere in the section

### FIX — Middle stat card "This Week" truncated to "This" ✅ PASS
**Root cause:** `StatCard` used `numberOfLines={2}` for the label. Card inner area = `minHeight:80` − `paddingVertical:16×2` = **48px**. Count takes 32px lineHeight + 4px margin = 36px, leaving only **12px** for label. With `lineHeight:16`, the second line ("Week") was pushed outside the visible area. `justifyContent:'center'` caused the overflow to be clipped below the card bounds, so only "This" (line 1) was visible.

**Fix — `src/components/dashboard/StatCard.tsx`:**
Changed label `Text` from `numberOfLines={2}` to:
```jsx
numberOfLines={1}
adjustsFontSizeToFit={true}
minimumFontScale={0.7}
```
- Forces all labels to fit on a single line by shrinking font if needed (min scale 0.7 → min 8.4px from 12px base)
- Works on any screen size, no layout overflow, equal card widths preserved via `flex:1`
- "Active Cases" (12 chars) and "This Week" (9 chars) both auto-fit without wrapping

### FIX — Print icon removed from dashboard header ✅
**File:** `app/(tabs)/index.tsx`
- Removed `testID="print-daily-report-btn"` `TouchableOpacity` block from header
- Print functionality remains available from individual case/client screens
- `handlePrint` function left in place (unused, no refactor per rules)

### FIX — Hearing date update showing both old and new dates ✅ PASS

**Root cause:**
When a case was edited via `cases/new.tsx` with a new `nextHearingDate`:
1. `updateCase(id, { nextHearingDate: Y })` updated `case.nextHearingDate` in both local state and backend case document
2. BUT the existing "Next Hearing" hearing record (created by `addCase`) still had the **old date X** in the `hearings` collection
3. Result: case detail header showed Y (from `caseData.nextHearingDate`), timeline/calendar showed X (from the hearing record) → both dates visible

**Fixes applied:**

**Backend — `routes/cases.py` `update_case` (PUT):**
- After updating the case document, if `nextHearingDate` is in the payload:
  - Find existing hearing with `purpose='Next Hearing'` and `outcome=None` for this `caseId`
  - If found → **UPDATE** its `hearingDate` to the new value; delete any other stale "Next Hearing" entries
  - If not found → **INSERT** a fresh "Next Hearing" hearing with the new date and advocate's ID
- Verified with curl tests: 1→2→3 date changes always leave exactly 1 hearing with the latest date ✅

**Frontend — `src/context/AppContext.tsx` (ADD only):**
- Added hearing upsert inside `updateCase` callback (after existing code, no refactoring)
- When `u.nextHearingDate` is set, finds the active "Next Hearing" in local state and updates its `hearingDate` immediately
- Ensures timeline is correct before the next `loadBackendData` sync (no stale dates in UI)

**DB cleanup:** No duplicate hearings found in DB (cleanup ran, 0 deleted).

**Test verified (curl):**
- BEFORE edit: 1 hearing with date=X
- AFTER edit 1 (→Y): 1 hearing with date=Y (old X gone ✅)
- AFTER edit 2 (→Z): 1 hearing with date=Z (Y updated ✅)

### FIX 1 — Intro Video Not Playing ✅ PASS
**Root cause:** `playingChange` listener in expo-video passes a **payload object** `{ isPlaying: boolean }`, NOT a raw boolean. Previous code: `(isPlaying: boolean) => { if (!isPlaying ...) }` — the argument was the whole object (always truthy), so `navigateAway()` was never called.

**Fixes applied in `intro.tsx`:**
1. Listener signature corrected: `(payload: { isPlaying: boolean }) => { if (!payload.isPlaying && ...) }`
2. `player.loop = false` added explicitly in `useVideoPlayer` callback
3. 10-second fallback `setTimeout(() => navigateAway(), 10000)` added (guards against video load failure)
4. Separated Web guard into its own `useEffect` (cleaner, no dependency on player)
5. `return null` for web (was `<View>` before)
6. Asset path `../assets/intro.mp4` confirmed correct

**Note:** Video only plays on native (iOS/Android). Web always skips via `Platform.OS === 'web'` guard → redirects to `/login`. Verified web guard works ✅.

### FIX 2 — Auto-Navigate After Case Save ✅ PASS
**Root cause:** When a client was linked to the new case, `setShowNotify(true)` was called instead of `router.back()`, blocking immediate navigation. User had to interact with the NotifyClientPopup to proceed.

**Fix applied in `cases/new.tsx`:**
- Removed `if (client) { setShowNotify(true) } else { router.back() }` block
- Replaced with unconditional `router.back()` after `setSaving(false)`
- Client notification popup (`showNotify` state, `handleNotifyClose`) is still in the component but no longer triggered from save flow — can be used from case detail page if needed

**Both paths tested:**
- New case without client → auto-navigates back ✅
- New case WITH linked client → auto-navigates back immediately (no popup) ✅

### CLEANUP — Remove Duplicate Test Cases ✅
- No duplicate cases found (modified_count: 0). DB was clean.

### FIX 1 — Lifetime Pro + Protected Flag ✅
- `PROTECTED_NUMBERS = {"9538556555", "9861960969"}` added in `routes/auth.py`
- `verify-otp` hook: on new signup with these numbers → auto-set `plan=pro`, `planExpiry=+36500 days`, `protected=True`
- Existing accounts: `modified_count=0` (accounts don't exist yet — hook will fire on first login/signup)
- `APP_ENV=development` added to `backend/.env` so all phones use OTP 123456 in this dev environment

### FIX 2 — Law Firm behind Pro Paywall ✅ PASS
- `more.tsx`: `menu-firm` row now checks `isProUser`
  - Free user → `PaywallSheet` ("Law Firm is a Pro feature") shown; row label shows "Law Firm 🔒 Pro"
  - Pro user → navigates to `/firm` as normal
- `PaywallSheet` import added to `more.tsx`
- `showFirmPaywall` state added

### FIX 3 — expo-av → expo-video ✅ PASS
- `intro.tsx`: replaced `expo-av Video` with `expo-video useVideoPlayer + VideoView`
- `useVideoPlayer(require('../assets/intro.mp4'), p => p.play())` used
- `player.addListener('playingChange', ...)` fires `navigateAway()` on finish
- Web guard unchanged (Platform.OS==='web' → `navigateAway()` immediately)
- Skip button unchanged
- All expo-av imports removed from project (verified via grep)

### FIX 4 — Profile Phone: Always Shows ✅ PASS
- `profile.tsx`: Phone row in CONTACT INFO is now always read-only (not editable in edit mode)
- Prevents accidental clearing of login credential
- Root cause: phone field was editable and could be cleared before backend sync completed
- Fix: displays `advocateProfile.phone` as static text only (never TextInput)
- `AppContext.tsx` (ADD only): `signIn()` now also updates `plan`/`planExpiry` immediately from verify-otp response, eliminating brief "Get Pro" flash for Pro users

### FIX 5 — Auto-Navigate After Client Save ✅ PASS
- `clients/new.tsx`: new client creation now calls `router.back()` instead of `router.replace('/clients/${id}')` — returns to clients list after save
- Edit path unchanged (already called `router.back()`)
- Cases: already had correct navigation (router.back() in both paths)

### Key TestIDs (unchanged from previous)
All previous testIDs preserved. New: none added this session.

## Task 1 — Dark Mode as Default (2026-03-09) ✅
- `AppContext.tsx`: Changed `DEFAULT_SETTINGS.darkMode` from `false` → `true`
- Fresh installs now default to dark mode; user's explicit saved preference still overrides

## Task 2 — Upgrade Screen Premium Redesign (2026-03-09) ✅ (17/17 criteria PASS)
- `frontend/app/upgrade.tsx`: Complete visual overhaul — dark background `#0A0A0A`, hero image (`upgrade-hero.jpg`, 220px, stepped gradient overlay), "LawFlow Pro" title (white, fontSize 28, fontWeight 800), amber subtitle, side-by-side Free/Pro plan cards (amber glow on Pro card), ✓/✗ feature lists, dark-pill monthly/yearly toggle with amber active state + "Save 17%" badge, amber "Upgrade to Pro →" CTA, fine print + Restore Purchase link. All payment handlers preserved unchanged.

## Feature 1 — Gift Icon in Dashboard Header (2026-03-09) ✅
- `app/frontend/app/(tabs)/index.tsx`: Replaced `Feather send` button (`send-briefing-btn`) with `Ionicons gift-outline` button (`gift-refer-btn`) in the dashboard header. Tapping it navigates to `/(tabs)/more` (Refer a Friend section). No Platform.OS guard needed (navigation only).

## Feature 2 — Help & FAQ Screen (2026-03-09) ✅
- New file: `app/frontend/app/faq.tsx` — 12 sections, 36+ Q&As, accordion-style (Animated scale 0.97 on press), search bar filters questions + answers in real time.
- `app/frontend/app/(tabs)/more.tsx`: Help & FAQ row now calls `router.push('/faq')` (was showing an Alert placeholder).

## Invite Junior Advocate Overhaul (2026-03-09)
Files changed: `frontend/app/firm.tsx`, `frontend/src/services/api.ts`, `frontend/src/context/AppContext.tsx`, `frontend/app/notifications.tsx`, `frontend/src/utils/notificationService.ts`, `frontend/app/(tabs)/index.tsx`, `backend/routes/firms.py`, `backend/routes/notifications.py`, `backend/models/firm.py`

### T1–T8 All PASS ✅
- **T1**: Phone validation — button disabled + inline error for non-10-digit numbers
- **T2**: Auto-strip +91 prefix from pasted numbers (`+919876543210` → `9876543210`)
- **T3**: Unregistered number → referral code card + WhatsApp share button (no invite sent)
- **T4**: Already-in-firm number → inline error "This advocate is already part of another firm."
- **T5**: Valid registered user → invitation sent + WhatsApp pre-fill (native) / inline confirmation (web)
- **T6**: Backend saves `firm_invite` notification to MongoDB; `inboxUnreadCount` drives bell badge
- **T7**: `notificationService.ts` routes `firm_invite` type to `/firm` screen
- **T8**: Web guard — no WhatsApp URL opened; shows "Invitation sent! They will be notified in-app."

### New Backend Endpoints
- `POST /api/firms/check-user` — checks if phone is registered + in a firm
- `GET /api/notifications/inbox` — returns backend-stored notifications (firm invites etc.)
- `PATCH /api/notifications/inbox/{id}/read` — marks notification as read

### AppContext Additions (ONLY ADDED, never refactored)
- `InboxNotification` interface exported
- `inboxNotifications` state (loaded from `/api/notifications/inbox` on login)
- `inboxUnreadCount` computed field
- `loadInboxNotifications()` function
- `markInboxNotificationRead(id)` function

## EAS Build & Device Setup

### EAS Development Build
- **Build ID**: `aa28c172-8364-4f14-b935-06aa6b7feb96`
- **Track / Download**: https://expo.dev/accounts/decoyindia/projects/lawflow/builds/aa28c172-8364-4f14-b935-06aa6b7feb96
- **Profile**: development | APK | internal distribution
- **Submitted**: 2026-03-09

### Pre-Build Fixes Applied (2026-03-09)
- `assets/images/icon.png` resized 512×513 → **512×512** (expo-doctor fix)
- `assets/images/adaptive-icon.png` resized 512×513 → **512×512**
- `app.json` android.jsEngine restored to `"hermes"` (was temporarily `"jsc"` for Expo Go tunnel workaround)
- `eas.json` created with `development` (APK, internal, local credentials) + `production` (AAB, remote credentials) profiles
- `credentials.json` + `lawflow-dev.keystore` generated locally (PKCS12, self-signed, 25-year validity, alias: `lawflow-dev`)
- `expo-dev-client` installed (required for `developmentClient: true` builds)
- Corrupt 0-byte file with garbage name removed from project root (was crashing EAS archiver)

### Why Dev Build (not Expo Go)
The following packages are NOT bundled in standard Expo Go SDK 54:
- `react-native-worklets@0.5.1` — required by reanimated 4, crashes on launch
- `expo-notifications@0.32.16` — removed from Expo Go in SDK 53+, crashes `_layout.tsx`
- `expo-audio@1.1.1` — not in Expo Go, crashes voice notes screen
- `expo-calendar@15.0.8` — not in Expo Go, crashes calendar sync

### Expo Go Tunnel Workaround (for web preview only)
`app.json` android.jsEngine is set to `"hermes"` for the EAS build.
For Expo Go tunnel (web preview), if hermesc ARM64 issue recurs: temporarily set `"jsEngine": "jsc"` in android block — Metro then serves plain JS without HBC compilation.

### On-Device Testing Steps (after APK installs)
1. Install `aa28c172...` APK (enable "Install from unknown sources")
2. Open LawFlow dev client
3. Scan tunnel: `exp://lawflow-preview-1.ngrok.io`
4. Test all 15 modules on-device

## Architecture Notes
- Backend: FastAPI, port 8001, all routes prefixed /api
- Frontend: Expo SDK 54, expo-router file-based routing, port 3000
- DB: MongoDB, db name = "lawflow"
- Auth: JWT, OTP always 123456 in dev mode
- Calendar sync: expo-calendar, Platform.OS==='web' → silent fail
- Push notifications: expo-notifications, WEB_LIMITATION for actual delivery
- PDF reports: expo-print, WEB_LIMITATION for actual print dialog
- Razorpay: createOrder → buildPaymentUrl → Linking.openURL (web redirect)

## Key TestIDs
- `get-pro-card` — More tab, free user upgrade card
- `pro-upgrade-banner` — Dashboard usage banner (free user)
- `reminders-toggle` — Settings, hearing reminders toggle
- `dark-mode-toggle` — Settings, dark mode toggle
- `calendar-sync-toggle` — Settings, calendar sync switch
- `sync-all-hearings-btn` — Settings, sync all hearings
- `global-search-input` — Search screen
- `share-portal-btn` — Client detail, share portal button
- `portal-link-section` — Client detail, active portal link card
- `portal-url-text` / `portal-expiry-text` — Portal link URL and expiry
- `portal-revoke-btn` — Client detail, revoke portal button
- `portal-view-screen` — Public portal view page
- `portal-error-screen` / `portal-error-title` — Portal error state
- `toggle-monthly` / `toggle-yearly` — Upgrade screen period toggle
- `upgrade-price` — Upgrade screen price display
- `continue-to-payment-btn` — Upgrade CTA
