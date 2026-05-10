# Crane v1.0 — Test Plan

---

## 1. Auth
- [ ] Sign up with a new email → confirm you get a verification email
- [ ] Try to log in before verifying → should show a clear error, not a crash
- [ ] Verify email → should land on onboarding, not a blank screen
- [ ] Complete onboarding (name, role, first job) → should land on Board with that job visible
- [ ] Sign out → should return to login screen
- [ ] Sign in again → board should still show your jobs
- [ ] Try wrong password → should show "invalid credentials", not crash

---

## 2. User Isolation
- [ ] Open an incognito window, create a second account
- [ ] Add a job in Account A, check Account B's board → Account B should see nothing
- [ ] Add a job in Account B → Account A should not see it

---

## 3. Board (Manual Jobs)
- [ ] Click **+ Add a job** → fill in company, position, status → job appears on board
- [ ] Try adding the same company + position twice → should show a duplicate error
- [ ] Change a job's status by clicking the status pill → should update immediately
- [ ] Add a job with status "Applied" → check that `date_applied` is set (visible in CSV export)
- [ ] Delete a job → should disappear from board

---

## 4. Find (Scraping)
Run each of these searches and for every result check:
- Job title matches what's on LinkedIn
- Company name is correct
- Clicking the job opens the right LinkedIn posting

**Searches to run:**
- [ ] "Software Engineer" in "San Francisco" — no filters
- [ ] "Product Manager" in "New York" — filter: Full-time only
- [ ] "Data Analyst" in "Remote" — filter: Entry level
- [ ] Any search with **Easy Apply** toggled on → results should all have Easy Apply badge
- [ ] Any search with **Date Posted: Past 24 hours**

For each search:
- [ ] Are there duplicates in the results?
- [ ] Do all jobs have a company name (nothing blank)?
- [ ] Do all jobs have a position title (nothing blank)?
- [ ] Does "Add X jobs" actually add them to the board?
- [ ] After adding, going to Board shows those jobs?

---

## 5. Export
- [ ] Click **Export CSV** → file downloads
- [ ] Open the file → all columns present (company, position, status, date_added, date_applied, url, deadline, notes)
- [ ] Jobs added from Find have a URL filled in

---

## 6. Edge Cases
- [ ] Add a job, close the browser, reopen → job still there
- [ ] Add 20+ jobs — board still loads quickly
- [ ] Search for something obscure on Find that returns 0 results → empty state, not crash
- [ ] Click **Clear all jobs** → board goes empty, no errors
