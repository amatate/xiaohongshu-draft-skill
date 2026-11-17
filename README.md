# Xiaohongshu Draft Skill

A small local-first Codex skill and Playwright tool for **drafts only**. Upload an approved original image, fill a note, preserve truthful AI labeling, reopen the local draft, and hand publication back to the user.

**Status: v0.1, experimental live adapter.** The original guided workflow worked on the real website. This rewritten package has automated offline/mock coverage, but has **not** passed unattended real-site batch acceptance. It does not promise UI stability, cloud/mobile draft sync, or AI-detection avoidance.

## Install

Node.js 22+ is required. From this repository:

```sh
npm ci
npx playwright install chromium
```

Dependencies are pinned in `package-lock.json`. The browser install downloads official Playwright Chromium. No extensions, API keys, paid models, cookie export, stealth plugins or CAPTCHA solvers are needed. If using a trusted existing Playwright installation, its exact browser/version must match; do not copy another person's browser profile.

To make the skill discoverable in Codex, symlink this whole checkout into your skills directory (choose a different destination if that name already exists):

```sh
mkdir -p "$HOME/.codex/skills"
ln -s "$PWD" "$HOME/.codex/skills/xiaohongshu-draft-skill"
```

Other skill-capable clients can load `SKILL.md` and its linked references. This is a skill + CLI, not a hosted service or browser extension.

## Workflow

Prepare a **private** manifest using [the schema](references/manifest.md). Do not put your artwork or manifest in this checkout. The CLI supports one image per note. Topic automation is intentionally excluded; add real topics yourself during review.

```sh
# No network or browser operation:
node scripts/xhs-drafts.cjs validate --manifest /private/work/posts.json

# Normal user login in a dedicated profile. Close this window before automation:
node scripts/xhs-drafts.cjs human-browser --state /private/work/xhs-state

# Requires explicit user approval to upload and save these notes:
node scripts/xhs-drafts.cjs draft --manifest /private/work/posts.json --state /private/work/xhs-state

# Interrupted attempt? Reopen and check an EXISTING draft, never re-upload:
node scripts/xhs-drafts.cjs reconcile --manifest /private/work/posts.json --state /private/work/xhs-state

# Final handoff. The USER reviews and decides whether to publish:
node scripts/xhs-drafts.cjs human-browser --state /private/work/xhs-state
```

If no `--state` is supplied, private state defaults to `~/.local/share/xiaohongshu-drafts`. Always use the same state and launch method. Do not run concurrent browser sessions on that profile. The CLI intentionally refuses state inside this repository.

Read `last-result.json` and inspect every `evidence/*-reopened.png` against the original. `reopened-needs-visual-review` is **not** a full acceptance claim. Body/title/AI/image count are checked mechanically; image identity still needs human or visual-agent review. The browser draft list can show placeholder covers even when the editor image is correct.

A repeated run reopens matching recorded drafts without uploading again. An uncertain run stops until `reconcile`; a missing prior draft does not get recreated automatically because the user may already have published or deleted it. Do not reset the journal to force a retry.

## Boundaries

- Automated mode: deny unknown writes, deny known publish routes, no Publish command.
- `human-browser`: explicit user-only handoff, **no interception** and no automated editing or submission. Normal user controls are available. A restart can require scanning the login QR again.
- Drafts live in this browser profile, not a guaranteed phone/cloud inbox. Do not clear browser data.
- Manual publishing is for review and control, not an AI-detection bypass. Keep accurate AI disclosure and platform labels.
- A manifest, screenshot, profile or auth state is private. None is included in this repo.

## Tests

```sh
npm run check
npm test
```

Tests exercise a real Chromium browser against an isolated synthetic fixture with all external traffic blocked, plus input hashing, network gates, concurrency locks, duplicate prevention and interrupted-run recovery. They do not log into or mutate Xiaohongshu.

See [the operating lessons](references/operating-notes.md) for the failure modes that shaped this tool. If the site changes, inspect the UI and fix the narrow adapter; never “fix” it by broadly allowing writes or guessing clicks.
