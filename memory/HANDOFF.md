# LawFlow — Emergent Platform Handoff
# Last Updated: 2026-03-06 (Phase 16)

This is a mirror of the full HANDOFF.md stored in the GitHub repo.
Full document: https://github.com/DecoyINDIA/LawFlow/blob/main/memory/HANDOFF.md

================================================================================
EMERGENT ENVIRONMENT
================================================================================

Preview URL:    https://lawflow-test.preview.emergentagent.com
Backend port:   8001 (supervisor-managed)
MongoDB:        Local (mongodb://localhost:27017) via MONGO_URL env var
Backend .env:   /app/backend/.env
Frontend .env:  /app/frontend/.env  ← PROTECTED, never modify

Test credentials:
  Phone: 9876543210   OTP: 123456 (mock, always works in dev mode)

Restart commands:
  sudo supervisorctl restart backend
  sudo supervisorctl restart expo

IMPORTANT: After clearing metro cache fully, pre-warm before starting expo:
  cd /app/frontend && yarn expo export --platform web && sudo supervisorctl start expo

================================================================================
CURRENT STATUS — Phase 16 COMPLETE
================================================================================

Phase 15 — Multi-Advocate Firm Mode, Client Portal, eCourts High Court   COMPLETE
Phase 16 — EAS projectId + Emergent platform migration                   COMPLETE
Phase 17 — WhatsApp Integration for Hearing Reminders                    COMPLETE
Phase 18 — Bulk WhatsApp Reminder Screen                                 COMPLETE
  - New screen: /bulk-reminders (expo-router)
  - Entry: Dashboard "📤 Bulk Remind" button (Tomorrow's Hearings card)
  - Entry: More tab → TOOLS → "📤 Bulk Reminders"
  - Checkbox list of tomorrow's hearings with per-row preview/edit modal
  - "Send All" flow: opens WhatsApp one-by-one with "Mark as Sent?" confirmation overlay
  - AsyncStorage per-case-per-day sent status (auto-resets next day)
  - Empty state: "🎉 No hearings tomorrow!" when no hearings
  - Feature 1: Green reminder banner on Case Detail (today/tomorrow hearings)
  - Feature 2: Enhanced outcome notification with outcome text + next date
  - Feature 3: Send Update sheet with 3 templates (General, Doc Request, Next Hearing)
  - Backend Job 3: APScheduler 8 PM IST evening reminder + manual /reminders/send endpoint
  - 8 unit tests in backend/tests/test_scheduler_reminders.py (all passing)
  - EAS projectId: 940a89bf-27e1-44e1-b036-9f64bc3e92a4
  - Owner: decoyindia
  - EAS Project: https://expo.dev/accounts/decoyindia/projects/lawflow
  - Migrated all frontend + backend code to Emergent environment
  - database.py updated to use MONGO_URL (Emergent local MongoDB)

================================================================================
REMAINING PRODUCTION CONFIG ITEMS
================================================================================

1. App icons/splash — replace placeholder images:
   /app/frontend/assets/images/icon.png
   /app/frontend/assets/images/splash-image.png
   /app/frontend/assets/images/adaptive-icon.png

2. MSG91 SMS OTP — set these in /app/backend/.env:
   MSG91_AUTH_KEY=<your_key>
   MSG91_TEMPLATE_ID=<your_template_id>
   (DLT registration pending)

3. Run production EAS build:
   cd /app/frontend && eas build --profile production --platform android
   cd /app/frontend && eas build --profile production --platform ios

================================================================================
CRITICAL RULES
================================================================================

1. NEVER refactor AppContext.tsx — only ADD
2. NEVER modify metro.config.js
3. NEVER modify EXPO_PACKAGER_HOSTNAME or EXPO_PUBLIC_BACKEND_URL in frontend/.env
4. Backend routes MUST be prefixed with /api
5. Pre-warm metro cache before starting expo after full cache clear
