# Operational lessons and limits

## Evidence, not optimistic automation

The underlying guided workflow successfully created two one-image drafts, reopened each, inspected the correct image, read title/body and AI declaration, and handed the same profile to the user. The user later reported publication. The automation never pressed Publish. This is evidence for the workflow, **not** a claim that this rewritten CLI has passed unattended live-site acceptance.

Current package verification is isolated Node tests and real headless Chromium against a synthetic local fixture. No private artwork, accounts, profile, tokens, signed asset URLs or real-site screenshots belong in this repository. Real-site smoke tests require a new explicit scope and should begin with one disposable authorized draft, not a bulk run.

## What failed, and the narrower repair

| Failure | Observed cause or limit | Repair |
| --- | --- | --- |
| A script's `--test` appeared to succeed without a draft | It filled the editor, waited, then closed; it did not save and reopen | Require actual list + reopen + content verification. Do not use a return value as proof. |
| Upload stalled under a safety gate | The image PUT used a different first-party CDN host from the first observed host | Inspect blocked method/host/path, then narrowly allow the observed upload destination; never blanket-allow writes. |
| Topic search returned no results | Read-like topic searches used POST routes blocked by the strict gate | Classify observed routes, not “POST means publish.” Preserve deny-by-default for unknown routes. |
| A topic query polluted the artwork URL | Platform-dependent cursor shortcuts failed, and `#query` was ordinary text, not a real topic | Verify body exactly after normalization; require real topic tokens. This v0.1 intentionally leaves topics to the user. |
| Exact topic text was ambiguous | Visually similar labels contained whitespace or invisible characters | Inspect actual candidates and token metadata, not the first fuzzy result. Do not create a different topic. |
| “Save and leave” was visible in a screenshot but absent from DOM locators | The accessible/DOM surface did not expose the same footer consistently; the precise cause was not established | Use fresh visual inspection if authorized, never hardcoded blind coordinates. The CLI accepts autosave only after a successful list/reopen check; a missing draft is uncertain, not permission to retry. |
| Repeated testing risked duplicate drafts | The editor autosaved before an explicit save click | Record intent before upload, reuse/reconcile matching existing drafts, and stop on uncertainty. |
| Handoff unexpectedly required login again | A same-profile browser restart returned 401 during transition to manual use; root cause was not proven | Keep one launch method and profile, check actual login, allow normal QR re-login, then recheck drafts. Never extract cookies to “repair” it. |
| Phone did not show browser drafts | The site explicitly stores drafts in the current browser's local storage | State the limitation; keep the profile and use that browser for final review. |
| Draft-list thumbnails were placeholders | List cover rendering was not reliable, while reopening displayed the correct image | Open the editor, examine the image and preview. A title-only list is not image verification. |

## Safety boundary

Automated `draft`/`reconcile` commands have no publish operation. They block unknown non-read requests; known publication routes are denied even with a read verb. Upload PUT is narrowly enabled for the observed image hosts during the creation flow. Publication-like button clicks are also intercepted as defense in depth. This is not a sandbox for malicious pages or a guarantee against every future site implementation; fail closed on changed behavior.

`human-browser` is an explicit **manual handoff**, not an automated publishing feature. It removes automation interception so the user can log in and personally use the platform. Do not run page-editing automation in that mode. Neither the CLI nor the skill solves CAPTCHA, uses stealth plugins, exports cookies, installs browser extensions, or claims to evade AI detection.

Private state includes login sessions and content-bearing screenshots. Keep it outside Git and backups intended for sharing. The journal contains hashes/status but does not prove publication or global uniqueness. Do not clear it to bypass a collision. A lock left after a crash is intentional: inspect the prior session before manually removing only the stale `run.lock`.

## Acceptance checklist

- Original file/hash and user-approved content checked.
- No ambiguous prior draft or independently known published duplicate.
- Normal login works; no CAPTCHA/rate limit outstanding.
- One expected image visibly correct in reopened editor, title/body intact, AI declaration correct.
- Missing topics explicitly reported rather than fabricated.
- Same profile open for user; actual login and draft list verified after restart.
- Record “local draft,” not “published,” until the user or a verified platform result confirms publication.
