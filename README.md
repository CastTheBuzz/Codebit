# Codebit

Your own programming course on phone and PC: a roadmap, theory for every stage, and 247 code tasks plus 51 hands-on DevOps labs, with no paywall. Hints stay hidden unless you press the button. Code runs on your device, even offline. Runs free on Cloudflare (personal account, same as Vaultbit and Readbit).

## Setup / update
Double-click **deploy.bat**. Run it again any time to publish an update.
- `deploy.bat passphrase` — choose a new passphrase

First run: installs the tools and languages, creates the database, uploads about 60 MB, then asks you to pick a passphrase.

## On the phone
Open the link from CODEBIT-LINK.txt in Chrome → ⋮ → **Install app**. Sign in once. Under **You**, press **Download** to use every language offline.

## How it works
- **Today**: three tasks a day: next in your track, next in Problem solving, and a review when one is due.
- **Roadmap**: Python, JavaScript, C++, C, SQL, Cloud and DevOps, Problem solving. Each stop has theory, then tasks, and each language ends in a project built in steps.
- **Tasks**: Write, Fix (broken code) and Read it (work out the output without running it). Check runs all tests. Hidden tests show only that they failed.
- **Reviews**: solved tasks come back from a blank page after 3, 7, 21, 60 and 150 days.

## Files
- `src/worker.js` server (sign-in and sync only)
- `public/` the app: `app.js` screens, `runner.js` + `rt/*.worker.js` run code, `store.js` sync, `course.json` the course
- `setup/` deploy script. `public/rt/py, sql, cc` are generated, don't edit
- `dev/` scripts that add hints, the DevOps track and worked examples to `course.json`. The course source with reference solutions is kept private, off GitHub
