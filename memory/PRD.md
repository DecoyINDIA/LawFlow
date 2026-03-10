# LawFlow — Product Requirements Document

## Overview
LawFlow is a mobile-first advocate case management app for Indian lawyers. Built with Expo React Native (frontend) + FastAPI (backend) + MongoDB (database).

## Architecture
- **Frontend**: Expo SDK 54, expo-router file-based routing, port 3000
- **Backend**: FastAPI, port 8001, all routes prefixed `/api`
- **Database**: MongoDB, db name = `lawflow`
- **Auth**: JWT, OTP-based; OTP always `123456` in dev mode
- **Test user**: phone=9876543210, OTP=123456

## Core Features
- Case management (CRUD, status, priority, hearing dates)
- Client management with portal link sharing
- Hearing tracking with calendar sync (expo-calendar)
- eCourts integration for live case status lookup
- PDF report generation (expo-print) — WEB_LIMITATION
- Bulk WhatsApp hearing reminders
- Voice notes (expo-audio)
- Document management with Google Drive sync
- Push notifications (expo-notifications) — WEB_LIMITATION for delivery
- Analytics dashboard
- Global search
- Firm mode (multi-member law firm)
- Razorpay subscription: Free (10 cases/clients) vs Pro (unlimited)
- Device calendar sync (expo-calendar) — WEB_LIMITATION
- Public client portal (shareable link)
- Offline-first with syncPending flag + manual retry
- **Refer a Friend**: unique 8-char referral code per advocate; referral input on signup; More tab card with Copy/WhatsApp share + live stats; payment bonus (monthly: +15 days for User B, +30 days for User A; yearly: +90 days for User B, +30 days for User A)

## What's Been Implemented
All core features are implemented. Testing across 15 modules completed.

## Testing Progress — ALL 15 MODULES COMPLETE ✅

| Module | Description | Status | Score |
|--------|-------------|--------|-------|
| Module 11 | Client Portal | COMPLETE ✅ | 7/7 PASS |
| Module 12 | Notifications & Search | COMPLETE ✅ | 6/6 PASS |
| Module 13 | Subscription & Paywall | COMPLETE ✅ | 13/13 PASS |
| Module 14 | Device Calendar Sync | COMPLETE ✅ | 7/7 PASS |
| Module 15 | Edge Cases & Data Integrity | COMPLETE ✅ | 5/6 PASS + 1 WEB_LIMITATION |
| Refer a Friend | Referral system | COMPLETE ✅ | 10/10 PASS |

### Module 15 — Edge Cases & Data Integrity Detail (completed 2026-03-09)
- **15.1 WEB_LIMITATION**: Offline mode browser simulation not possible; code logic verified correct (syncStatus='offline', sync-retry-btn).
- **15.2 PASS**: retrySyncAll() wired to Retry button; syncPending set on failed items.
- **15.3 PASS**: Empty states verified — no fake/placeholder data. Dashboard, Cases, Clients all show graceful empty states.
- **15.4 PASS**: Incomplete signup guard in index.tsx — checks name+enrollmentNumber+barCouncil, redirects to /signup.
- **15.5 PASS**: Grace period UI (grace-period-card) shown in More tab; Pro features accessible during 3-day grace window.
- **15.6 PASS**: Free plan enforcement working — pro-upgrade-banner shows case count, PaywallSheet fires on case #11+, existing cases NOT deleted.

## Known WEB_LIMITATIONs (on-device testing needed)
- Push notification delivery (expo-notifications)
- PDF print dialog (expo-print)
- Device calendar sync (expo-calendar)
- Offline mode simulation (browser DevTools cannot simulate native network)
- Razorpay in-app SDK (uses Linking.openURL redirect on web)

## Bug Fixes Applied (2026-03-09)
- **Case Delete Crash (FIXED)**: `printingHistory` useState was declared after early return in `cases/[id].tsx`, causing React hooks violation crash. Moved to before early return.
- **Duplicate Upcoming Hearings (FIXED)**: `upcomingFromCases` now deduplicates against `upcomingHearings` using `coveredCaseIds` Set in `(tabs)/index.tsx`.
- **Firm Dashboard Names (FIXED)**: Backend `/api/firms/dashboard` now enriches members with names from `advocates` collection. Frontend renders `m.name || m.phone`.
- **expo-dev-client version (FIXED)**: Downgraded to `~6.0.20` compatible with Expo SDK 54.

## Invite Junior Advocate Overhaul (2026-03-09) — All T1–T8 PASS ✅
- Phone validation: 10 digits only, +91 stripped, button disabled, inline errors
- `POST /api/firms/check-user` new endpoint — registered/already-in-firm check
- Smart 3-case invite flow (unregistered→referral share, in-firm→error, available→invite+WhatsApp)
- Backend saves `firm_invite` notification to MongoDB on invite
- `GET /api/notifications/inbox` + `PATCH /api/notifications/inbox/{id}/read` new endpoints
- AppContext extended: `InboxNotification`, `inboxNotifications`, `inboxUnreadCount`, etc. (ADDED only)
- notifications.tsx unified to show local + inbox notifications; firm_invite tap → /firm
- Dashboard bell badge = `unreadNotificationCount + inboxUnreadCount`

## Pending Production Items (P0 before launch)
- [ ] **On-device testing** — install dev build APK (build ID: `aa28c172-8364-4f14-b935-06aa6b7feb96`), scan tunnel, verify all 15 modules
- [ ] Set `JWT_SECRET` env var (currently uses dev fallback — INSECURE)
- [ ] Set `MSG91_AUTH_KEY` + `MSG91_TEMPLATE_ID` for real OTP delivery
- [ ] Set `APP_ENV=production` to disable mock OTP
- [ ] Set up Razorpay production keys
- [ ] Configure MongoDB Atlas connection (URL hardcoded as fallback in database.py)
- [ ] Run `eas build --profile production` for Play Store AAB
- [ ] Revert `app.json` android.jsEngine from `"jsc"` back to `"hermes"` (already done — restore if accidentally changed again)

## EAS Build Setup (completed 2026-03-09)
- `eas.json`: development (APK, internal, local creds) + production (AAB, remote creds) profiles
- `credentials.json` + `lawflow-dev.keystore`: PKCS12, self-signed, 25-year, alias=lawflow-dev, pw=lawflow123
- `expo-dev-client` installed
- Dev build submitted: `aa28c172-8364-4f14-b935-06aa6b7feb96`
- Build URL: https://expo.dev/accounts/decoyindia/projects/lawflow/builds/aa28c172-8364-4f14-b935-06aa6b7feb96

## P1 Backlog
- [ ] Automatic network restore listener (currently manual retry via ⚠️ Retry button)
- [ ] Biometric / PIN app lock
- [ ] Multi-language support (Hindi, Tamil, etc.)
- [ ] Court date scraping improvements

## P2 Backlog
- [ ] Web portal for desktop access
- [ ] Team-level analytics in Firm mode
- [ ] Document e-signing integration
