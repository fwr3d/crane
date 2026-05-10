# Crane v1.1 — Test Plan

_Covers everything new or changed since v1.0. Run top to bottom on the live app._

---

## 1. Navigation

- [ ] Sidebar shows: Dashboard, Jobs, Find, **Stats**, **Account**
- [ ] Clicking Stats loads the Stats page (not a blank screen)
- [ ] Clicking Account loads the Account page
- [ ] Active nav item is highlighted correctly on each page

---

## 2. Stats Page

- [ ] Page loads without errors
- [ ] Top metrics show correct counts (Total, Applied, Response rate, Offer rate)
- [ ] Application velocity section renders (chart or list)
- [ ] Source breakdown section renders — manual-added jobs show as "Manual"
- [ ] Adding a job via Find (LinkedIn) then checking Stats → source shows as "LinkedIn" (not blank)
- [ ] Page is usable on mobile (no overflow, readable)

---

## 3. Account Page

- [ ] Name, target role, location fields pre-filled from onboarding values
- [ ] Edit name → Save → reload page → name persists
- [ ] Edit target role → Save → persists
- [ ] Dark mode toggle button visible and works (board switches to dark, toggle again → light)
- [ ] Dark mode preference persists after page reload
- [ ] "Send password reset email" → confirmation message appears, email arrives
- [ ] "Export CSV" → file downloads with all expected columns
- [ ] "Clear all jobs" → confirm dialog → board goes empty → Stats page shows zeros
- [ ] Page is usable on mobile

---

## 4. Board — Inline Editing (v1.1 additions)

- [ ] Click a card's status pill → status updates immediately, column changes
- [ ] Edit deadline inline → value saves without opening a modal
- [ ] Edit notes inline → saves
- [ ] Edit URL inline → saves, link opens correctly
- [ ] Stale badge: add a job with `date_applied` > 14 days ago → amber "X days" badge appears
- [ ] Deadline badge: set a deadline in the past → badge appears on card
- [ ] Multi-select: shift-click or checkbox two cards → floating action bar appears
- [ ] Bulk status update via action bar → both cards move columns

---

## 5. Board — Search & Filter

- [ ] Search bar: type company name → only matching cards shown
- [ ] Search bar: type position keyword → matches
- [ ] Clear search → all cards return
- [ ] Search with 0 matches → empty state message, not a blank column

---

## 6. Find Page

- [ ] LinkedIn search still works (streaming results appear)
- [ ] Results show company name, position, and a clickable link
- [ ] Link opens the correct LinkedIn posting (direct URL, not a search fallback)
- [ ] "Add X jobs" → jobs appear on Board with `source = linkedin`
- [ ] Duplicate: add the same job twice → duplicate error shown, not a second card

---

## 7. Mobile Layout

- [ ] Resize browser to ~390px wide (or use DevTools mobile emulation)
- [ ] Sidebar is hidden by default
- [ ] Hamburger menu button visible → tap opens sidebar overlay
- [ ] Tap a nav item → sidebar closes, correct page loads
- [ ] Board columns scroll horizontally or stack vertically (no content clipped)
- [ ] Stats and Account pages readable on mobile
- [ ] Add job form usable on mobile (fields not cut off)

---

## 8. Offline Draft Queue

- [ ] In DevTools → Network tab, set to Offline
- [ ] Try to add a job → should queue it locally (toast or indicator)
- [ ] Go back online → draft should sync to board automatically

---

## 9. Auth (regression)

- [ ] Sign out → redirected to login
- [ ] Sign in → board loads your data, not another user's
- [ ] Try accessing `/` while logged out → redirected to login

---

## 10. Sentry (if DSN configured)

- [ ] Check Sentry dashboard after a test session → no unexpected errors
- [ ] (Optional) Trigger a known recoverable error → ErrorBoundary catches it, page doesn't crash

