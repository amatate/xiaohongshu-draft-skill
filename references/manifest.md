# Private input format

Save JSON outside the repository. Version 1 supports exactly one original image per post (PNG/JPEG/WebP, at most 32 MiB). Hash must match local bytes. Paths resolve relative to the manifest file. The file is never uploaded as a whole.

```json
{
  "version": 1,
  "posts": [{
    "id": "example-001",
    "title": "示例标题",
    "body": "画面描述。\n\nAI 辅助创作，说明真实媒介与图像设定。",
    "image": "original.png",
    "sha256": "REPLACE_WITH_64_LOWERCASE_HEX_DIGITS",
    "aiGenerated": true
  }]
}
```

The example is not a runnable manifest; supply your own approved original and hash. Use `shasum -a 256 original.png` on macOS or `sha256sum original.png` on Linux. Title limit is 20 Unicode codepoints, body 1000; the site remains authoritative if its counting rules differ. `aiGenerated` must explicitly be true or false; true requires an AI disclosure in body. Nonempty `topics` is rejected rather than silently omitted. Do not mark AI-generated content false to get past validation.

Keep ids stable. Content changes under an existing id require manual reconciliation. A changed id with identical title/body/AI/image fingerprint still maps to the previous journal record. Title collision without matching history stops before upload. These checks cannot discover independently published work; the operator still checks the user's publishing history.
