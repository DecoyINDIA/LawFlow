# LawFlow — Product Requirements Document
# Updated: 2026-03-06 (Phase 17)

================================================================================
PROBLEM STATEMENT
================================================================================
Build a mobile legal practice management app for Indian advocates/lawyers.
Helps advocates organise their cases, clients, hearings, documents, and stay
updated with court dates. MVP → Production-ready across iOS + Android.

================================================================================
TARGET USERS
================================================================================
- Solo Indian advocates managing 50–200+ active cases
- Small law firms with 2–5 advocates
- Advocates who need eCourts integration for case status tracking

================================================================================
ARCHITECTURE
================================================================================
Frontend:   React Native / Expo SDK 54 (expo-router, TypeScript)
Backend:    FastAPI (Python 3.11) on port 8001
Database:   MongoDB (local via MONGO_URL; Atlas SRV as fallback)
Auth:       Phone OTP (MSG91 real / 123456 mock in dev mode)
State:      React Context (AppContext.tsx) + AsyncStorage (offline-first)
Push:       Expo Push Notifications (projectId: 940a89bf-27e1-44e1-b036-9f64bc3e92a4)

================================================================================
WHAT HAS BEEN IMPLEMENTED (Phases 1–16)
================================================================================

Phase 1  (Foundation)         Design system, navigation, auth screens (login/OTP)
Phase 2  (CRUD Core)          Cases, Clients, Calendar — full CRUD with backend
Phase 3  (Details)            Client Detail, Hearing management, PDF print
Phase 4  (Communication)      Message Templates, Notifications, Global Search, Docs
Phase 5  (Persistence)        AsyncStorage, Voice Notes, Case Timeline, At-Risk Cases
Phase 6  (Profile/Settings)   Profile Screen, Settings, More Tab, Tomorrow's Hearings
Phase 7  (Analytics)          Daily Briefing, Analytics Screen, Data Export, Dark Mode
Phase 8  (Push + API layer)   Push Notifications scaffold, FastAPI backend, api.ts
Phase 9  (Backend sync)       Auth flow, cases/clients/hearings/profile sync
Phase 10 (Retry + Backup)     Retry Sync button, Google Drive Backup/Restore UI
Phase 11 (Prod prep)          MongoDB Atlas, JWT secret, MSG91 code, Google OAuth guard
Phase 12 (eCourts)            CNR lookup, eCourts review screen, HTML scrape fallback
Phase 13 (CNR auto + Digest)  CNR auto-detection on case form, Daily Digest push notif
Phase 14 (Case auto-refresh)  Weekly eCourts auto-refresh cron + manual trigger endpoint
Phase 15 (Firm + Portal)      Multi-advocate firm mode, Client Portal (read-only links),
                               eCourts High Court support (5 HCs)
Phase 16 (EAS + Emergent)     EAS projectId configured, migrated to Emergent platform
Phase 17 (WhatsApp)          Hearing reminders, outcome notification, Send Update sheet
Phase 18 (Bulk Reminders)   Bulk WhatsApp screen, checkbox list, per-item preview, Send All flow

================================================================================
CORE BACKEND ROUTES (all prefixed /api)
================================================================================
/api/health                    GET  — health check
/api/auth/request-otp          POST — send OTP
/api/auth/verify-otp           POST — verify OTP, returns JWT
/api/auth/me                   GET  — current advocate profile
/api/cases                     GET/POST — list/create cases
/api/cases/{id}                GET/PUT/DELETE — case CRUD
/api/cases/{id}/assign         PUT  — assign case to firm member
/api/clients                   GET/POST — list/create clients
/api/clients/{id}              GET/PUT/DELETE — client CRUD
/api/hearings                  GET/POST — list/create hearings
/api/hearings/{id}             GET/PUT/DELETE — hearing CRUD
/api/ecourts/lookup            POST — eCourts CNR lookup
/api/ecourts/refresh-all       POST — manual case status refresh
/api/notifications/push-token  POST — save Expo push token
/api/notifications/digest/send POST — trigger daily digest manually
/api/firms                     POST — create firm
/api/firms/my                  GET  — get advocate's firm
/api/firms/invite              POST — invite member
/api/firms/accept              POST — accept invitation
/api/firms/dashboard           GET  — firm-wide dashboard
/api/portal/generate           POST — generate client portal link
/api/portal/links              GET  — list portal links
/api/portal/{token}            GET  — public portal (no auth)

================================================================================
ENVIRONMENT VARIABLES
================================================================================

Backend (/app/backend/.env):
  MONGO_URL      mongodb://localhost:27017       (Emergent local MongoDB)
  DB_NAME        lawflow
  APP_ENV        development                     (set to 'production' for prod)
  JWT_SECRET     546fa2878ca01bc92a1c77a7d88bad89a4cf83afe0938e44dac6c77d8866382b
  MSG91_AUTH_KEY       <pending — DLT registration>
  MSG91_TEMPLATE_ID    <pending>

Frontend (/app/frontend/.env) — PROTECTED:
  EXPO_TUNNEL_SUBDOMAIN          lawflow-test
  EXPO_PACKAGER_HOSTNAME         https://lawflow-test.preview.emergentagent.com
  EXPO_PUBLIC_BACKEND_URL        https://lawflow-test.preview.emergentagent.com
  EXPO_USE_FAST_RESOLVER         "1"
  METRO_CACHE_ROOT               /app/frontend/.metro-cache

================================================================================
PRIORITIZED BACKLOG
================================================================================

P0 — Blocking for production:
  [ ] MSG91 DLT registration → set MSG91_AUTH_KEY + MSG91_TEMPLATE_ID
  [ ] Replace placeholder app icons and splash screen
  [ ] Set APP_ENV=production

P1 — High value, next sprint:
  [ ] Run EAS production build: eas build --profile production
  [ ] Submit to App Store / Play Store: eas submit --profile production
  [ ] Tighten CORS (allow only frontend domain)
  [ ] Rate-limit OTP endpoint

P2 — Nice to have:
  [ ] Google Drive backup — set EXPO_PUBLIC_GOOGLE_CLIENT_ID
  [ ] Case document storage (currently local only)
  [ ] In-app push notification history screen
  [ ] Client portal — web view for clients
