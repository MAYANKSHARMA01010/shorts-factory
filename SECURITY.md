# Security & privacy notes

## No secrets are stored in this repository

By design, every script reads credentials **at runtime** from outside the repo — never from a file
that gets committed:

| Secret | Source at runtime |
|---|---|
| YouTube OAuth client id/secret | the Postiz Docker container env |
| YouTube refresh/access token | Postiz's Postgres `Integration` table |
| Postiz org API key | `~/.config/postiz/key` |
| Gmail app password | `~/.config/shorts/email.json` (mode 600) |

This repo was scanned before publication for API keys, OAuth client secrets, access/refresh tokens,
and private keys — none are present. If you fork it, keep it that way:

- Put real keys in `~/.config/...` or an untracked `.env` (see [`.env.example`](.env.example)).
- The [`.gitignore`](.gitignore) blocks the common secret filenames as a second line of defense.
- Before your **first push**, run a scan (e.g. `gitleaks detect`) and eyeball `git diff --cached`.

## What personal data IS in this repo (intentionally)

The author chose to keep this as a transparent build-log, so it contains **real, non-credential**
data: actual channel analytics snapshots (`analytics/`), the published-video ledger
(`daily_posts_ledger.md`), learning notes (`learnings.md`), and a contact email in `notify_email.py`.
None of that can be used to access any account. If you fork this, replace those with your own or
delete them.

## Reporting

Found a leaked secret or a security issue? Open an issue (without pasting the secret) or email the
address in the repo, and rotate the affected credential immediately.
