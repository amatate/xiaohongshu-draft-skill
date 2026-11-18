---
name: xiaohongshu-draft-skill
description: Prepare and verify Xiaohongshu image-note drafts in a dedicated local browser, then hand control to the user for manual review and publication. Use when draft automation is explicitly requested; draft mode does not publish; a separately authorized scheduling mode is experimental. Never bypass AI labels, login checks, or CAPTCHAs.
---

# Xiaohongshu local drafts

The default workflow produces a small batch of **verified local drafts**, not published notes. Scheduling is a separate explicitly authorized workflow; see the final section. Read [operating notes](references/operating-notes.md) before live work; they explain the observed failures and verification limits.

## Before modifying the platform

- Confirm which works, original images, titles/body and account are in scope. A request to draft copy is not authorization to upload it. Existing manual-only workflows remain in force unless the current request authorizes this specific draft test.
- Check existing delivery/publishing records as well as visible platform drafts. The tool's private journal is a second line of defense, not proof the user has never posted something elsewhere.
- v0.1 supports one image per note and **no automatic topics**. If topics matter, ask whether the user will add them manually. Do not silently discard required topics or write fake hashtags to resemble platform tokens.
- Use the original image and its SHA-256; never upload a screenshot of the artwork. Keep the manifest, profile, journal, logs and evidence outside this public skill folder. See [manifest format](references/manifest.md).

## Run

Prerequisites: Node 22+ and the pinned Playwright dependency from `package.json`, plus its Chromium browser. Use a trusted installed copy where available; do not install unknown forks. See the repository README for installation and commands.

1. `node scripts/xhs-drafts.cjs validate --manifest /private/path/posts.json` performs only local validation.
2. `node scripts/xhs-drafts.cjs human-browser --state /private/path/state` opens the dedicated profile for normal user login. It does not automate edits or publish; the user has normal browser control. Close that browser before starting the draft command. Keep the **same launch method and profile** for login, automation and handoff.
3. After explicit upload/draft authorization, run `draft --manifest … --state …`. Automated mode blocks unknown write requests and has no publication command. It stops on login, CAPTCHA, duplicate/uncertain history, changed UI or verification errors. Never broaden the network allowlist just to make a run green.
4. Read the result AND examine the reopened screenshots against the original images. The status `reopened-needs-visual-review` is intentional: the tool verifies title, body, image count and AI declaration, not exact image pixels. A click, elapsed debounce interval, upload success or nonempty draft list is not sufficient proof.
5. If interrupted after upload, do not start over with a new id or clean state. Inspect the existing draft and private journal. `reconcile` only opens a matching existing draft and verifies it; it never uploads. A missing record may mean it was published or deleted, not permission to recreate it.
6. Open `human-browser` with the same state for handoff. Verify the user is still logged in and both intended titles are visible. If login expired, ask the user to scan again and recheck. Leave the draft list open. Do not click Publish.

## Truthful reporting

State exactly which items were saved, which were visually checked, whether topics are missing, and what remains blocked. Drafts are local to this browser profile; never promise phone/cloud synchronization. Tell the user not to clear browser data.

Manual publication is for human review and control. It does **not** guarantee reduced AI detection or bypass platform policies. Preserve truthful AI disclosure in the body and the platform's “笔记含AI合成内容” declaration when applicable. Never disable that label to disguise AI-assisted work.

The original guided workflow was exercised on the real site. This packaged v0.1 is tested against isolated mocked pages; its unattended live batch behavior has **not** been validated. Treat changed selectors/endpoints as a request to inspect the actual UI, not to invent a successful result.

## Explicitly authorized scheduling

When the user explicitly asks to schedule publication, read [the scheduling guide](references/scheduling.md) in full. This is a separate consequential command for existing drafts, not permission inferred from draft/upload requests. Preserve draft-only defaults. Validate locally, prepare and visually review, and only submit the specifically authorized account/content/time using `--reviewed`. Never claim success until Note Management confirms the title and time. Never retry uncertain intent or bypass the ledger. The reusable adapter is offline-tested, not live-batch accepted.
