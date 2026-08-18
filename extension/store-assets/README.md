# Store listing assets

`screenshots/` — five 1280×800 PNGs for the Chrome Web Store listing's screenshot
carousel, generated from the actual built extension (`extension/dist`) running
against the live Railway API, not mockups:

1. `1-login.png` — login screen
2. `2-signup.png` — signup screen, filled in
3. `3-login-error.png` — a real "Invalid email or password" response
4. `4-projects.png` — organisation switcher + real project list
5. `5-selected.png` — a project selected, with the Phase 1 scope note

**Before uploading:** these were captured using a test account (name "Deploy
Test", org "Deploy Test Org"). Regenerate with more presentable data before a
real public listing — either create a clean demo account first, or ask for a
regenerate with specific name/org values. The generation script lives outside
this repo (scratch tooling); ask for it to be rebuilt if needed rather than
hand-editing these PNGs.

Note screenshot 5 explicitly states this build only covers sign-in and project
selection, no bug-reporting flow yet — accurate to what's shipped, and Chrome's
listing policy requires screenshots not overstate functionality. Swap it out
once Phase 2 ships if you'd rather not show that caveat to Store visitors.
