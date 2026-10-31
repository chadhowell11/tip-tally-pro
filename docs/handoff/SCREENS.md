# Screen inventory and real capture register

Snapshot 2026-10-31. Each numbered entry specifies route, steps and expected screenshot. **Only01–06 were captured**: actual running app, no mocked rendering, no sessions, no financial/database writes. Each PNG was opened and visually inspected. Chromium screenshots: desktop1280×1800; mobile390×844. Public captures produced no browser page errors. The password-reveal shot uses an EMPTY input, not a secret. Authenticated capture is blocked: requesting user's own managed session could not be minted because no matching account exists. No arbitrary other user's account was selected. All remaining states are source-derived **UNVERIFIED / SKIPPED**, not placeholder images.

## Safe reproduction
Use isolated test environment with intercepted reads/writes and outbound SMS/OAuth blocked BEFORE opening shift forms (autosave writes), invite routes (autoaccept), or inline admin controls (on-blur writes). Do not enter synthetic shifts into production. Freeze test date2026-08-19 with explicit timezoneAmerica/New_York. Staff fixture Avery101 server, Blair102 server, Casey201/Drew202 bartender, Ellis runner, Finley busser, Gray bar_back, Harper hostess, River inactive, Morgan manager. Settings bar10%,server support15%,bar support10%,cap30%,none rounding,tips basis; weights1/1/.5/.5. Server cash40/tips200/LBW300/sales1000; bartender cash25/tips150/sales700; support hours6/4/5/3. Derive money via actual calculation module, not assumed equal cross-report results: current defects are documented. No real credentials needed. Native dialogs/provider consent/OS install/physical printing cannot be truthfully represented by fabricated screenshots.

An entry with several variants requires a separate capture per variant (suffixes a,b...). Responsive/permission matrix entries explicitly apply to EVERY preceding applicable state, not just default page. Screenshots currently absent are deliberately not generated. Expected content is not runtime evidence.

## 01. Home mobile

- **Route:** `/`
- **Steps:** Open home signed out at390×844.
- **Screenshot should show:** Fallback cocktail mark, Tip Share, seven navigation actions.
- **Status:** REAL CAPTURE, visually inspected; `screenshots/01-home-mobile.png`.

## 02. Sign in desktop

- **Route:** `/auth`
- **Steps:** Fresh context1280×1800; open auth.
- **Screenshot should show:** Blank signin form, Google, email/password, remember checkbox.
- **Status:** REAL CAPTURE, visually inspected; `screenshots/02-signin-desktop.png`.

## 03. Create account desktop

- **Route:** `/auth`
- **Steps:** Click First time? Create account.
- **Screenshot should show:** Create Account heading/form and signin mode switch.
- **Status:** REAL CAPTURE, visually inspected; `screenshots/03-signup-desktop.png`.

## 04. Create account mobile

- **Route:** `/auth`
- **Steps:** Set390×844 after switching signup.
- **Screenshot should show:** Narrow signup card and all controls.
- **Status:** REAL CAPTURE, visually inspected; `screenshots/04-signup-mobile.png`.

## 05. Sign in mobile

- **Route:** `/auth`
- **Steps:** 390×844; click Have an account? Sign in.
- **Screenshot should show:** Mobile signin form.
- **Status:** REAL CAPTURE, visually inspected; `screenshots/05-signin-mobile.png`.

## 06. Password reveal mobile

- **Route:** `/auth`
- **Steps:** At05 click Show password; keep input blank.
- **Screenshot should show:** Hide toggle label; password field type text, no credential disclosure.
- **Status:** REAL CAPTURE, visually inspected; `screenshots/06-password-visible-mobile.png`.

## 07. Home branded

- **Route:** `/`
- **Steps:** In isolated fixture return Harbor Lantern Demo settings+logo.
- **Screenshot should show:** Company logo/name, navigation, install prompt when eligible.
- **Status:** UNVERIFIED / SKIPPED; source-derived capture plan, no image.

## 08. Home loading/fallback/error

- **Route:** `/`
- **Steps:** Delay settings then return none/error in isolated fixture.
- **Screenshot should show:** Cocktail fallback; no dedicated fetch error card.
- **Status:** UNVERIFIED / SKIPPED; source-derived capture plan, no image.

## 09. Home role navigation

- **Route:** `/`
- **Steps:** Repeat home as signedout,staff,manager,admin,owner.
- **Screenshot should show:** Same navigation links; link visibility is not authorization.
- **Status:** UNVERIFIED / SKIPPED; source-derived capture plan, no image.

## 10. Not found desktop/mobile

- **Route:** `/missing-fixture`
- **Steps:** Open unknown path.
- **Screenshot should show:** 404, Page not found, Go home.
- **Status:** UNVERIFIED / SKIPPED; source-derived capture plan, no image.

## 11. Root error/recovery

- **Route:** `any`
- **Steps:** In isolated runtime inject render error then remove and Try again.
- **Screenshot should show:** This page didn't load, retry/home.
- **Status:** UNVERIFIED / SKIPPED; source-derived capture plan, no image.

## 12. Auth filled/revealed/remembered

- **Route:** `/auth`
- **Steps:** Use fabricated owner@example.test and nonsecret demo password only in isolated mock; toggle Show/remember.
- **Screenshot should show:** Filled/revealed/masked values, remember states; do not capture real passwords.
- **Status:** UNVERIFIED / SKIPPED; source-derived capture plan, no image.

## 13. Native auth validation

- **Route:** `/auth`
- **Steps:** Submit empty, not-an-email, five-character fake password without real requests.
- **Screenshot should show:** Browser required/email/minlength validation.
- **Status:** UNVERIFIED / SKIPPED; source-derived capture plan, no image.

## 14. Auth pending/rejection

- **Route:** `/auth`
- **Steps:** Mock delayed signin then Invalid login credentials.
- **Screenshot should show:** Disabled/pending submission then inline error.
- **Status:** UNVERIFIED / SKIPPED; source-derived capture plan, no image.

## 15. Signup confirmation

- **Route:** `/auth`
- **Steps:** Mock signup success without session.
- **Screenshot should show:** Account created, check email message.
- **Status:** UNVERIFIED / SKIPPED; source-derived capture plan, no image.

## 16. Existing session auth

- **Route:** `/auth`
- **Steps:** Mock existing synthetic session.
- **Screenshot should show:** Already signed in banner, Continue/Start a new account.
- **Status:** UNVERIFIED / SKIPPED; source-derived capture plan, no image.

## 17. Switch account/destination

- **Route:** `/auth`
- **Steps:** Mock signout then continue with/without membership.
- **Screenshot should show:** Cleared signup form; admin or onboarding destination.
- **Status:** UNVERIFIED / SKIPPED; source-derived capture plan, no image.

## 18. Google handoff/failure

- **Route:** `/auth`
- **Steps:** Mock OAuth error; do not contact Google.
- **Screenshot should show:** Inline provider error; external consent unavailable.
- **Status:** UNVERIFIED / SKIPPED; source-derived capture plan, no image.

## 19. Admin loading/redirect

- **Route:** `/admin`
- **Steps:** Delay session/membership checks; missing membership/signedout.
- **Screenshot should show:** Loading then auth/onboarding.
- **Status:** UNVERIFIED / SKIPPED; source-derived capture plan, no image.

## 20. Admin denied

- **Route:** `/admin`
- **Steps:** Mock membership but has_role admin=false.
- **Screenshot should show:** Not an admin, Go home.
- **Status:** UNVERIFIED / SKIPPED; source-derived capture plan, no image.

## 21. Admin owner/admin tabs

- **Route:** `/admin`
- **Steps:** Mock global admin and location owner/admin.
- **Screenshot should show:** Staff Team Settings Audit tabs.
- **Status:** UNVERIFIED / SKIPPED; source-derived capture plan, no image.

## 22. Admin manager shell

- **Route:** `/admin`
- **Steps:** Mock global admin plus local manager.
- **Screenshot should show:** Staff Team Settings; read-only Settings, no Audit.
- **Status:** UNVERIFIED / SKIPPED; source-derived capture plan, no image.

## 23. Staff active filled

- **Route:** `/admin`
- **Steps:** Staff tab with Avery#101 and Blair#102 active.
- **Screenshot should show:** Add/import, counts, contacts, numbers, positions.
- **Status:** UNVERIFIED / SKIPPED; source-derived capture plan, no image.

## 24. Staff active/inactive empty

- **Route:** `/admin`
- **Steps:** Return no active then inactive records.
- **Screenshot should show:** No active staff yet / No inactive staff.
- **Status:** UNVERIFIED / SKIPPED; source-derived capture plan, no image.

## 25. Staff inactive filled

- **Route:** `/admin`
- **Steps:** Switch Inactive with River Demo.
- **Screenshot should show:** Inactive list, reactivate, editable contacts.
- **Status:** UNVERIFIED / SKIPPED; source-derived capture plan, no image.

## 26. Staff add/errors

- **Route:** `/admin`
- **Steps:** Add Taylor#103 server in isolated write mock; reject insert/no location.
- **Screenshot should show:** Cleared successful form or inline error; blank name silently ignored.
- **Status:** UNVERIFIED / SKIPPED; source-derived capture plan, no image.

## 27. Staff inline edit/positions

- **Route:** `/admin`
- **Steps:** Edit Avery name/number/email/phone then blur; add bartender qualification.
- **Screenshot should show:** Saved-looking fields, position chips; last role cannot be removed.
- **Status:** UNVERIFIED / SKIPPED; source-derived capture plan, no image.

## 28. Staff manager/active toggles

- **Route:** `/admin`
- **Steps:** Mock manager/active writes.
- **Screenshot should show:** Badges and movement between Active/Inactive lists.
- **Status:** UNVERIFIED / SKIPPED; source-derived capture plan, no image.

## 29. Staff remove confirmation

- **Route:** `/admin`
- **Steps:** Remove Taylor, cancel then mock success.
- **Screenshot should show:** Native confirmation, removed row after success.
- **Status:** UNVERIFIED / SKIPPED; source-derived capture plan, no image.

## 30. Staff history fallback

- **Route:** `/admin`
- **Steps:** Mock FK rejection on removal, accept/cancel inactive fallback.
- **Screenshot should show:** Second native confirmation; inactive/error variants.
- **Status:** UNVERIFIED / SKIPPED; source-derived capture plan, no image.

## 31. Import initial

- **Route:** `/admin`
- **Steps:** Staff→Import from Excel.
- **Screenshot should show:** Choose file/template, supported columns, dialog.
- **Status:** UNVERIFIED / SKIPPED; source-derived capture plan, no image.

## 32. Import valid preview

- **Route:** `/admin`
- **Steps:** Mock/isolated file Name,Number,Positions,Email,Phone; Avery101 server+bartender; Ellis runner+busser.
- **Screenshot should show:** Parsed filename/count/preview/import.
- **Status:** UNVERIFIED / SKIPPED; source-derived capture plan, no image.

## 33. Import invalid preview

- **Route:** `/admin`
- **Steps:** Add blank name and astronaut role; then all-invalid file.
- **Screenshot should show:** Missing name/No valid positions, count, disabled zero-valid action.
- **Status:** UNVERIFIED / SKIPPED; source-derived capture plan, no image.

## 34. Import parse/write errors

- **Route:** `/admin`
- **Steps:** Corrupt file; mock delayed/rejected import.
- **Screenshot should show:** Parser/DB errors and importing.
- **Status:** UNVERIFIED / SKIPPED; source-derived capture plan, no image.

## 35. Import success/template

- **Route:** `/admin`
- **Steps:** Mock success; local template download.
- **Screenshot should show:** Dialog closes/refreshed list; template is local file, not screen.
- **Status:** UNVERIFIED / SKIPPED; source-derived capture plan, no image.

## 36. Team loading

- **Route:** `/admin`
- **Steps:** Team tab delay location.
- **Screenshot should show:** Loading.
- **Status:** UNVERIFIED / SKIPPED; source-derived capture plan, no image.

## 37. Team incomplete checklist

- **Route:** `/admin`
- **Steps:** Mock missing setup flags/logo/staff/team/pay period.
- **Screenshot should show:** Finish setting up checklist with complete/unfinished steps.
- **Status:** UNVERIFIED / SKIPPED; source-derived capture plan, no image.

## 38. Team complete profile

- **Route:** `/admin`
- **Steps:** Return completed setup with/without logo.
- **Screenshot should show:** Name/type/address/timezone/profile/logo fallback; checklist absent.
- **Status:** UNVERIFIED / SKIPPED; source-derived capture plan, no image.

## 39. Profile save/upload feedback

- **Route:** `/admin`
- **Steps:** Mock profile save, fake PNG upload success/failure.
- **Screenshot should show:** Saved/logo-updated/error messages; no real upload.
- **Status:** UNVERIFIED / SKIPPED; source-derived capture plan, no image.

## 40. Team invite roles

- **Route:** `/admin`
- **Steps:** Mock add invitee@example.test as Admin/Manager/Staff.
- **Screenshot should show:** Role selector and copied-link invitation creation feedback.
- **Status:** UNVERIFIED / SKIPPED; source-derived capture plan, no image.

## 41. Team invitation states

- **Route:** `/admin`
- **Steps:** Mock pending/accepted/expired-unaccepted.
- **Screenshot should show:** Joined or Copy/Revoke; expired not separately labeled.
- **Status:** UNVERIFIED / SKIPPED; source-derived capture plan, no image.

## 42. Team copy/revoke/empty

- **Route:** `/admin`
- **Steps:** Mock clipboard and revocation; empty invites.
- **Screenshot should show:** List refresh/no dedicated success modal.
- **Status:** UNVERIFIED / SKIPPED; source-derived capture plan, no image.

## 43. Settings loading/editable

- **Route:** `/admin`
- **Steps:** Owner/admin Settings; delay then load baseline.
- **Screenshot should show:** Establishment/pay periods/features/tip rules/rounding/weights/SMS.
- **Status:** UNVERIFIED / SKIPPED; source-derived capture plan, no image.

## 44. Manager read-only settings

- **Route:** `/admin`
- **Steps:** Local manager with global admin gate satisfied.
- **Screenshot should show:** Disabled fieldset/read-only message.
- **Status:** UNVERIFIED / SKIPPED; source-derived capture plan, no image.

## 45. Settings pay periods

- **Route:** `/admin`
- **Steps:** Select weekly,biweekly,semimonthly,monthly; anchor2026-08-03.
- **Screenshot should show:** Conditional anchor for weekly/biweekly.
- **Status:** UNVERIFIED / SKIPPED; source-derived capture plan, no image.

## 46. Settings tax

- **Route:** `/admin`
- **Steps:** Toggle net-sales; enter8.25 whole-percent tax.
- **Screenshot should show:** Sales tax field expanded/off hidden.
- **Status:** UNVERIFIED / SKIPPED; source-derived capture plan, no image.

## 47. Settings fee/manager exclusion

- **Route:** `/admin`
- **Steps:** Toggle fee2.5 and manager exclusion.
- **Screenshot should show:** Expanded fee; selected exclusion.
- **Status:** UNVERIFIED / SKIPPED; source-derived capture plan, no image.

## 48. Settings tip basis

- **Route:** `/admin`
- **Steps:** Switch Tips/Gross sales, rates10/15/10/cap30.
- **Screenshot should show:** Basis labels and whole-percent values.
- **Status:** UNVERIFIED / SKIPPED; source-derived capture plan, no image.

## 49. Settings rounding/weights

- **Route:** `/admin`
- **Steps:** Select none/nearest/up/down; runner1,busser1,barback.5,hostess.5.
- **Screenshot should show:** Selected controls and four weights.
- **Status:** UNVERIFIED / SKIPPED; source-derived capture plan, no image.

## 50. Settings SMS states

- **Route:** `/admin`
- **Steps:** Enable fake sender/breakdown with provider requests blocked.
- **Screenshot should show:** Sender/breakdown expanded; off variant.
- **Status:** UNVERIFIED / SKIPPED; source-derived capture plan, no image.

## 51. Settings save/upload error

- **Route:** `/admin`
- **Steps:** Mock delayed/success/rejected settings/logo update.
- **Screenshot should show:** Pending/saved/error states; no invented validation.
- **Status:** UNVERIFIED / SKIPPED; source-derived capture plan, no image.

## 52. Audit access

- **Route:** `/audit`
- **Steps:** Mock no membership,manager,owner,admin.
- **Screenshot should show:** Loading/redirect/owner-admin denial or AuditPanel.
- **Status:** UNVERIFIED / SKIPPED; source-derived capture plan, no image.

## 53. Audit tips populated

- **Route:** `/audit`
- **Steps:** Return synthetic override10→12, rangeAug1–19.
- **Screenshot should show:** When Shift Staff Adjusted Previous New By.
- **Status:** UNVERIFIED / SKIPPED; source-derived capture plan, no image.

## 54. Audit settings populated

- **Route:** `/audit`
- **Steps:** Mock fraction.10→.12, false→true, null→value.
- **Screenshot should show:** Formatted setting percentage/boolean/null.
- **Status:** UNVERIFIED / SKIPPED; source-derived capture plan, no image.

## 55. Audit loading/empty/error

- **Route:** `/audit`
- **Steps:** Delay then empty/reject both tabs.
- **Screenshot should show:** Loading/empty text; no dedicated read error UI.
- **Status:** UNVERIFIED / SKIPPED; source-derived capture plan, no image.

## 56. Audit export/print/limit

- **Route:** `/audit`
- **Steps:** Mock501 records/read cap, export each tab, local print preview.
- **Screenshot should show:** Up to500 newest, exact CSV columns; browser printing unverified.
- **Status:** UNVERIFIED / SKIPPED; source-derived capture plan, no image.

## 57. Shift listing loading/empty

- **Route:** `/shifts`
- **Steps:** Delay then empty.
- **Screenshot should show:** Loading/No shifts saved yet.
- **Status:** UNVERIFIED / SKIPPED; source-derived capture plan, no image.

## 58. Shift listing filled periods

- **Route:** `/shifts`
- **Steps:** Mock AM-only,PM-only,both dates.
- **Screenshot should show:** Descending grouped days and edit/Print daily/Delete day.
- **Status:** UNVERIFIED / SKIPPED; source-derived capture plan, no image.

## 59. Delete day dialog/results

- **Route:** `/shifts`
- **Steps:** Delete August18 in isolated mock; cancel/pending/fail/success.
- **Screenshot should show:** Affected whole-day warning and destructive action, result.
- **Status:** UNVERIFIED / SKIPPED; source-derived capture plan, no image.

## 60. Shift loading/missing settings

- **Route:** `/shift/new`
- **Steps:** Delay/no settings.
- **Screenshot should show:** Loading; missing settings can remain loading.
- **Status:** UNVERIFIED / SKIPPED; source-derived capture plan, no image.

## 61. Shift empty form

- **Route:** `/shift/new?date=2026-08-18&period=PM`
- **Steps:** Mock staff/settings; block autosave first.
- **Screenshot should show:** Date/period, server/bar/support add, notes/save/deposit.
- **Status:** UNVERIFIED / SKIPPED; source-derived capture plan, no image.

## 62. Shift AM/PM query states

- **Route:** `/shift/new`
- **Steps:** Open with AM then PM search params.
- **Screenshot should show:** Selected date/period; no third period.
- **Status:** UNVERIFIED / SKIPPED; source-derived capture plan, no image.

## 63. Shift edit populated

- **Route:** `/shift/fixture-id/edit`
- **Steps:** Mock saved rows/settings and no real writes.
- **Screenshot should show:** Restored date/period/notes/splits/overrides, delete.
- **Status:** UNVERIFIED / SKIPPED; source-derived capture plan, no image.

## 64. Server single

- **Route:** `/shift/new`
- **Steps:** Mock writes; add Avery cash40,credit200,LBW300.
- **Screenshot should show:** Calculated bar/support/takehome%, inputs.
- **Status:** UNVERIFIED / SKIPPED; source-derived capture plan, no image.

## 65. Server split shared

- **Route:** `/shift/new`
- **Steps:** Select shared/equal, Avery+Blair.
- **Screenshot should show:** Members, equal shares, no hours.
- **Status:** UNVERIFIED / SKIPPED; source-derived capture plan, no image.

## 66. Server split weighted

- **Route:** `/shift/new`
- **Steps:** Select weighted/hours6 and4; then zero/blank.
- **Screenshot should show:** Hours/shares and zero-hour equal fallback.
- **Status:** UNVERIFIED / SKIPPED; source-derived capture plan, no image.

## 67. Bartender single

- **Route:** `/shift/new`
- **Steps:** Add Casey cash25,credit150.
- **Screenshot should show:** From servers/support/takehome%, house cash.
- **Status:** UNVERIFIED / SKIPPED; source-derived capture plan, no image.

## 68. Bartender shared/weighted

- **Route:** `/shift/new`
- **Steps:** Casey+Drew equal then6/4 hours.
- **Screenshot should show:** Uniform split control/member shares; add/remove/return individual.
- **Status:** UNVERIFIED / SKIPPED; source-derived capture plan, no image.

## 69. Sales basis shift

- **Route:** `/shift/new`
- **Steps:** Mock rb_basis sales; server sales1000/bar700.
- **Screenshot should show:** Conditional total sales fields and calculated support.
- **Status:** UNVERIFIED / SKIPPED; source-derived capture plan, no image.

## 70. Manual overrides

- **Route:** `/shift/fixture-id/edit`
- **Steps:** Edit server bar12/support18/bar support; clear.
- **Screenshot should show:** Override editor/effective red fields/reset calculation; audited changes mocked.
- **Status:** UNVERIFIED / SKIPPED; source-derived capture plan, no image.

## 71. Support weighted

- **Route:** `/shift/new`
- **Steps:** Ellis runner6,Finley busser4,Gray barback5,Harper hostess3.
- **Screenshot should show:** Position/hours/weighted payout/pool.
- **Status:** UNVERIFIED / SKIPPED; source-derived capture plan, no image.

## 72. Support shared/zero

- **Route:** `/shift/new`
- **Steps:** Toggle shared; remove all then zero-hours weighted.
- **Screenshot should show:** Equal payouts, no hours requirement; zero/empty variants.
- **Status:** UNVERIFIED / SKIPPED; source-derived capture plan, no image.

## 73. Selectors inactive/manager/multirole

- **Route:** `/shift/new`
- **Steps:** Mock inactive/excluded managers/multiple qualifications.
- **Screenshot should show:** Only qualified active/exclusion-eligible choices.
- **Status:** UNVERIFIED / SKIPPED; source-derived capture plan, no image.

## 74. PM cash AM refresh

- **Route:** `/shift/new`
- **Steps:** PM plus saved AM cash; delay/fail/refocus AM read.
- **Screenshot should show:** AM subtotal loading/zero/nonzero and day deposit.
- **Status:** UNVERIFIED / SKIPPED; source-derived capture plan, no image.

## 75. Shift notes dirty/save

- **Route:** `/shift/new`
- **Steps:** Type synthetic training note with write mock; before/after1500ms, explicit save.
- **Screenshot should show:** Dirty/saving/saved statuses.
- **Status:** UNVERIFIED / SKIPPED; source-derived capture plan, no image.

## 76. Shift save failure/no location

- **Route:** `/shift/new`
- **Steps:** Reject mocked save or no membership.
- **Screenshot should show:** Error and source reassuring rollback wording (not guarantee).
- **Status:** UNVERIFIED / SKIPPED; source-derived capture plan, no image.

## 77. Duplicate shift

- **Route:** `/shift/new`
- **Steps:** Mock existing date/PM during save.
- **Screenshot should show:** Existing-shift message/open edit instead.
- **Status:** UNVERIFIED / SKIPPED; source-derived capture plan, no image.

## 78. Period switching

- **Route:** `/shift/fixture-id/edit`
- **Steps:** Switch AM/PM with existing/missing/rejected lookup.
- **Screenshot should show:** Edit/new navigation, busy/error, possibly unsaved dialog.
- **Status:** UNVERIFIED / SKIPPED; source-derived capture plan, no image.

## 79. Unsaved exit

- **Route:** `/shift/fixture-id/edit`
- **Steps:** Hold saves while dirty, click Home.
- **Screenshot should show:** Save and leave/leave/stay; native reload prompt separate.
- **Status:** UNVERIFIED / SKIPPED; source-derived capture plan, no image.

## 80. Date move single period

- **Route:** `/shift/fixture-id/edit`
- **Steps:** Change populated date toAug19 in mock.
- **Screenshot should show:** Change shift date warning, save&move/cancel.
- **Status:** UNVERIFIED / SKIPPED; source-derived capture plan, no image.

## 81. Date move both periods

- **Route:** `/shift/fixture-id/edit`
- **Steps:** Source AM+PM, chooseAug19.
- **Screenshot should show:** Both-period move warning.
- **Status:** UNVERIFIED / SKIPPED; source-derived capture plan, no image.

## 82. Date move pending/collision/failure

- **Route:** `/shift/fixture-id/edit`
- **Steps:** Hold writes, occupiedAug20, rejection.
- **Screenshot should show:** Saving&moving/error naming occupied periods.
- **Status:** UNVERIFIED / SKIPPED; source-derived capture plan, no image.

## 83. Delete shift dialog

- **Route:** `/shift/fixture-id/edit`
- **Steps:** Click Delete shift and cancel.
- **Screenshot should show:** Date/period destructive warning.
- **Status:** UNVERIFIED / SKIPPED; source-derived capture plan, no image.

## 84. Delete shift pending/failure/success

- **Route:** `/shift/fixture-id/edit`
- **Steps:** Mock each result separately.
- **Screenshot should show:** Deleting/error/postdelete navigation.
- **Status:** UNVERIFIED / SKIPPED; source-derived capture plan, no image.

## 85. Print now shift

- **Route:** `/shift/fixture-id/edit`
- **Steps:** Mock save and click Print now; no physical printer.
- **Screenshot should show:** Daily date/report flow; print success UNVERIFIED.
- **Status:** UNVERIFIED / SKIPPED; source-derived capture plan, no image.

## 86. Daily filled

- **Route:** `/daily?date=2026-08-18`
- **Steps:** Mock AM+PM baseline.
- **Screenshot should show:** Branding/AM-PM/person totals/deposit/cashouts/net house.
- **Status:** UNVERIFIED / SKIPPED; source-derived capture plan, no image.

## 87. Daily empty/loading/missing period

- **Route:** `/daily`
- **Steps:** Delay, no shifts, AM-only,PM-only.
- **Screenshot should show:** Loading/no shift/missing period; read failure may appear empty.
- **Status:** UNVERIFIED / SKIPPED; source-derived capture plan, no image.

## 88. Daily split/multirole

- **Route:** `/daily`
- **Steps:** Mock shared/weighted participants with support.
- **Screenshot should show:** Distributed person rows; see financial audit for discrepancies.
- **Status:** UNVERIFIED / SKIPPED; source-derived capture plan, no image.

## 89. Daily print all/person sheets

- **Route:** `/daily`
- **Steps:** Use local browser print only; choose Avery/support person.
- **Screenshot should show:** Full versus one-person-page output; no real captured print.
- **Status:** UNVERIFIED / SKIPPED; source-derived capture plan, no image.

## 90. Daily SMS off/on

- **Route:** `/daily`
- **Steps:** Mock sms_enabled off/on.
- **Screenshot should show:** Text action hidden/present; outbound provider blocked.
- **Status:** UNVERIFIED / SKIPPED; source-derived capture plan, no image.

## 91. Daily SMS pending/mixed/error

- **Route:** `/daily`
- **Steps:** Mock server function sent/skipped/failed/missing phone.
- **Screenshot should show:** Sending/result/error feedback, not actual delivery.
- **Status:** UNVERIFIED / SKIPPED; source-derived capture plan, no image.

## 92. Payroll filled range

- **Route:** `/reports`
- **Steps:** Mock rangeAug1–19 with known staff.
- **Screenshot should show:** Table/cash deposit/grand totals/print/export.
- **Status:** UNVERIFIED / SKIPPED; source-derived capture plan, no image.

## 93. Payroll presets

- **Route:** `/reports`
- **Steps:** This/Last period each of4 types with frozen date/anchor.
- **Screenshot should show:** Changed From/To dates per pay-period code.
- **Status:** UNVERIFIED / SKIPPED; source-derived capture plan, no image.

## 94. Payroll empty/loading

- **Route:** `/reports`
- **Steps:** Delay then no shifts.
- **Screenshot should show:** Loading/empty table, no fake money.
- **Status:** UNVERIFIED / SKIPPED; source-derived capture plan, no image.

## 95. Payroll setup/record retry

- **Route:** `/reports`
- **Steps:** Reject setup then shifts, restore and Try again.
- **Screenshot should show:** Distinct error and retry, recovered results.
- **Status:** UNVERIFIED / SKIPPED; source-derived capture plan, no image.

## 96. Payroll invalid/racing date

- **Route:** `/reports`
- **Steps:** Clear/reverse range; mock old response after new.
- **Screenshot should show:** No new invalid query; latest sequence wins.
- **Status:** UNVERIFIED / SKIPPED; source-derived capture plan, no image.

## 97. Payroll person selection

- **Route:** `/reports`
- **Steps:** Select Avery then Show Everyone.
- **Screenshot should show:** Visible rows filtered; grand/CSV still all as code.
- **Status:** UNVERIFIED / SKIPPED; source-derived capture plan, no image.

## 98. Payroll CSV/print variants

- **Route:** `/reports`
- **Steps:** Mock data, download, Print all/individual sheets.
- **Screenshot should show:** Ordered CSV fields/TOTAL and per-shift personal details; print unverified.
- **Status:** UNVERIFIED / SKIPPED; source-derived capture plan, no image.

## 99. Individual filled

- **Route:** `/individual`
- **Steps:** Choose Avery/rangeAug1–19.
- **Screenshot should show:** Name/emphasis/brand, per-shift lines/totals/average/%.
- **Status:** UNVERIFIED / SKIPPED; source-derived capture plan, no image.

## 100. Individual alternate/splits

- **Route:** `/individual`
- **Steps:** Choose Casey/Ellis/multirole.
- **Screenshot should show:** Role-relevant amounts; actual omissions in financial audit.
- **Status:** UNVERIFIED / SKIPPED; source-derived capture plan, no image.

## 101. Individual loading/no staff/no shifts

- **Route:** `/individual`
- **Steps:** Delay, no staff, River no shifts.
- **Screenshot should show:** Loading/No staff yet/No shifts for person.
- **Status:** UNVERIFIED / SKIPPED; source-derived capture plan, no image.

## 102. Individual presets/errors/export/print

- **Route:** `/individual`
- **Steps:** Current/Last dates, rejected read, CSV/local print.
- **Screenshot should show:** Selected range/person export; no payroll-style retry.
- **Status:** UNVERIFIED / SKIPPED; source-derived capture plan, no image.

## 103. Trends weekly

- **Route:** `/trends`
- **Steps:** Mock multiple observed weeks positive/negative/flat.
- **Screenshot should show:** House bars/table/latest/previous/change/sparkline.
- **Status:** UNVERIFIED / SKIPPED; source-derived capture plan, no image.

## 104. Trends monthly/history

- **Route:** `/trends`
- **Steps:** Monthly/Weekly, Last4/8/12/26.
- **Screenshot should show:** Bucket labels/history selector and reset.
- **Status:** UNVERIFIED / SKIPPED; source-derived capture plan, no image.

## 105. Trends detail

- **Route:** `/trends`
- **Steps:** Select Avery twice then Casey.
- **Screenshot should show:** Highlighted detail/collapse/changed staff.
- **Status:** UNVERIFIED / SKIPPED; source-derived capture plan, no image.

## 106. Trends deltas/zero previous

- **Route:** `/trends`
- **Steps:** Mock increase/decrease/unchanged/prev0.
- **Screenshot should show:** Arrow colors/delta/null percentage.
- **Status:** UNVERIFIED / SKIPPED; source-derived capture plan, no image.

## 107. Trends loading/empty/failure

- **Route:** `/trends`
- **Steps:** Delay/no history/reject.
- **Screenshot should show:** Loading/No history; no dedicated retry.
- **Status:** UNVERIFIED / SKIPPED; source-derived capture plan, no image.

## 108. Onboarding loading/member

- **Route:** `/onboarding`
- **Steps:** Mock lookup delay/member present.
- **Screenshot should show:** Ellipsis then admin navigation.
- **Status:** UNVERIFIED / SKIPPED; source-derived capture plan, no image.

## 109. Onboarding invite offer

- **Route:** `/onboarding`
- **Steps:** Mock valid pending invite before lookup.
- **Screenshot should show:** Invited role, Join/no thanks.
- **Status:** UNVERIFIED / SKIPPED; source-derived capture plan, no image.

## 110. Onboarding join/decline

- **Route:** `/onboarding`
- **Steps:** Mock pending/error/success; decline separate.
- **Screenshot should show:** Joining/error/home or establishment wizard.
- **Status:** UNVERIFIED / SKIPPED; source-derived capture plan, no image.

## 111. Wizard establishment

- **Route:** `/onboarding`
- **Steps:** No membership; Harbor Lantern Demo,Restaurant,123 Example Lane,NY timezone; blank name first.
- **Screenshot should show:** Welcome/progress/fields/name validation.
- **Status:** UNVERIFIED / SKIPPED; source-derived capture plan, no image.

## 112. Wizard logo

- **Route:** `/onboarding`
- **Steps:** Continue; fake local PNG preview without uploading.
- **Screenshot should show:** Optional logo/no logo/preview, Back/Continue.
- **Status:** UNVERIFIED / SKIPPED; source-derived capture plan, no image.

## 113. Wizard team

- **Route:** `/onboarding`
- **Steps:** Stage manager@example.test and staff@example.test, remove/invalid/duplicate.
- **Screenshot should show:** Invite rows; no Admin choice in wizard.
- **Status:** UNVERIFIED / SKIPPED; source-derived capture plan, no image.

## 114. Wizard pay period

- **Route:** `/onboarding`
- **Steps:** All4 types, anchorAug3.
- **Screenshot should show:** Anchor conditional and state persists navigating Back.
- **Status:** UNVERIFIED / SKIPPED; source-derived capture plan, no image.

## 115. Wizard tip rules

- **Route:** `/onboarding`
- **Steps:** Enter fractions.10/.15/.30.
- **Screenshot should show:** Fraction fields and whole-percent helper unlike admin Settings.
- **Status:** UNVERIFIED / SKIPPED; source-derived capture plan, no image.

## 116. Wizard staff

- **Route:** `/onboarding`
- **Steps:** Zero staff then Avery101 server/bartender.
- **Screenshot should show:** Mandatory finish disabled/enabled, position chips/list.
- **Status:** UNVERIFIED / SKIPPED; source-derived capture plan, no image.

## 117. Wizard staff validation

- **Route:** `/onboarding`
- **Steps:** Blank name/no positions/remove last.
- **Screenshot should show:** Enter a name/Pick position errors.
- **Status:** UNVERIFIED / SKIPPED; source-derived capture plan, no image.

## 118. Wizard finish partial/errors

- **Route:** `/onboarding`
- **Steps:** Block all real writes; delay/reject location/member/staff then success separately.
- **Screenshot should show:** Saving/error/admin destination; no atomic guarantee.
- **Status:** UNVERIFIED / SKIPPED; source-derived capture plan, no image.

## 119. Invite autoaccept pending

- **Route:** `/invite/synthetic-token`
- **Steps:** Mock acceptance BEFORE navigation.
- **Screenshot should show:** Joining your team.
- **Status:** UNVERIFIED / SKIPPED; source-derived capture plan, no image.

## 120. Invite success destination

- **Route:** `/invite/synthetic-token`
- **Steps:** Mock valid acceptance.
- **Screenshot should show:** Home destination, not dedicated success page.
- **Status:** UNVERIFIED / SKIPPED; source-derived capture plan, no image.

## 121. Invite invalid/expired/mismatch/reused

- **Route:** `/invite/synthetic-token`
- **Steps:** Return distinct controlled RPC errors.
- **Screenshot should show:** Invitation problem/error/recovery.
- **Status:** UNVERIFIED / SKIPPED; source-derived capture plan, no image.

## 122. PWA Chromium prompt

- **Route:** `/`
- **Steps:** Only isolated event mock, clean dismissal storage.
- **Screenshot should show:** Install App card; eligibility not verified.
- **Status:** UNVERIFIED / SKIPPED; source-derived capture plan, no image.

## 123. PWA accept/cancel/installed

- **Route:** `/`
- **Steps:** Mock choice/appinstalled/standalone.
- **Screenshot should show:** Prompt removed; native install dialog not captured.
- **Status:** UNVERIFIED / SKIPPED; source-derived capture plan, no image.

## 124. PWA Safari/dismiss

- **Route:** `/`
- **Steps:** Real eligible staging Safari or mock UA conditions; dismiss/reload.
- **Screenshot should show:** Share→Add to Home Screen/no Chrome button; persistent dismissal.
- **Status:** UNVERIFIED / SKIPPED; source-derived capture plan, no image.

## 125. PWA offline shell

- **Route:** `/`
- **Steps:** Inspect manifest/icons; isolated offline test.
- **Screenshot should show:** No guaranteed offline data support or purpose-built offline page.
- **Status:** UNVERIFIED / SKIPPED; source-derived capture plan, no image.

## 126. Mobile home/auth/wizard/invite matrix

- **Route:** `multiple`
- **Steps:** Repeat states01–18 and108–118 at390×844, plus320×740.
- **Screenshot should show:** Wrapping/keyboard reachability; no new invented navigation.
- **Status:** UNVERIFIED / SKIPPED; source-derived capture plan, no image.

## 127. Mobile admin/import/audit matrix

- **Route:** `/admin,/audit`
- **Steps:** Repeat all tabs/dialogs as owner/manager at390 and320.
- **Screenshot should show:** Stacked fields/chips, bottom import, scroll tables; unavailable real session.
- **Status:** UNVERIFIED / SKIPPED; source-derived capture plan, no image.

## 128. Mobile shift and dialogs matrix

- **Route:** `/shift/new,/shift/id/edit`
- **Steps:** Repeat empty/filled/shared/weighted/support/exit/date/delete states at390/320.
- **Screenshot should show:** Field/member wrapping, full destructive warnings, monetary readability.
- **Status:** UNVERIFIED / SKIPPED; source-derived capture plan, no image.

## 129. Mobile report matrix

- **Route:** `/daily,/reports,/individual`
- **Steps:** Repeat filled/loading/empty/error/selection, scroll tables left/right at390.
- **Screenshot should show:** Filters/table overflow/identity; no mock screenshot generated.
- **Status:** UNVERIFIED / SKIPPED; source-derived capture plan, no image.

## 130. Mobile trends matrix

- **Route:** `/trends`
- **Steps:** 26 buckets, detail at390/320.
- **Screenshot should show:** Bar density/labels/table overflow.
- **Status:** UNVERIFIED / SKIPPED; source-derived capture plan, no image.

## 131. Permissions complete matrix

- **Route:** `all protected`
- **Steps:** Isolated mocked signedout/unassigned/staff/manager/admin/owner direct navigation and mutations.
- **Screenshot should show:** Route versus RLS enforcement distinction; runtime permissions UNVERIFIED.
- **Status:** UNVERIFIED / SKIPPED; source-derived capture plan, no image.

