# Scheduled publishing / 定时发布

[English](#english) · [简体中文](#简体中文)

## English

An **experimental, separately opted-in** command schedules one existing image draft per invocation. The original draft CLI and its publication-blocking guards are unchanged. No command publishes by default. This is not a background timer: Xiaohongshu receives the scheduled submission, then controls review and release. Closing the computer after a confirmed platform submission does not cancel the platform's schedule.

### Before running

Obtain explicit approval for the destination account, exact images/copy, and scheduled dates. Upload authorization alone is not publication authorization. Review the original against the loaded draft image, current account, full copy, true AI declaration, real topic tokens (if any), and existing published/scheduled posts. The local intent ledger cannot detect another device's posts or identify an image by pixels. Never suppress AI disclosure or circumvent CAPTCHA/rate limits.

The reused manifest validator supports one image and no automatic topics. A draft edited manually must exactly match the approved manifest or verification stops. Do not delete user edits or real topics just to pass validation. Such cases need a manual handoff.

Add `scheduleAt` to every post in the normal private [manifest](manifest.md):

```json
{ "scheduleAt": "2030-01-02 11:30" }
```

This is a field fragment, **not a complete manifest**. Replace the illustrative date with an approved future time. Times are explicitly **Asia/Shanghai (UTC+08:00)**, independent of your computer's timezone. The observed UI window was 1 hour–14 days ahead, as of November 2026; the tool conservatively checks it but current platform limits must also be reviewed. Revalidate when executing, not just when planning. Duplicate times in one manifest are rejected. Remove already completed/expired entries from the input plan if necessary, but retain all private state/ledgers.

```sh
# Offline only. No browser, login or write to Xiaohongshu.
node scripts/xhs-schedule.cjs validate --manifest /private/work/posts.json

# Use the SAME state/profile originally used to draft and log in.
# Sets the schedule UI and captures evidence; never submits.
node scripts/xhs-schedule.cjs prepare --manifest /private/work/posts.json \
  --state /private/work/state --id example

# ONLY after explicit authorization and original-image/account/management review.
node scripts/xhs-schedule.cjs submit --manifest /private/work/posts.json \
  --state /private/work/state --id example --reviewed
```

`prepare` can change/autosave the schedule setting of that local draft. It does not submit. Inspect `evidence/example-schedule-prepared.png` against the original. `--reviewed` is an operator attestation, not a substitute for permission and not machine proof of image identity.

### Submission and recovery

- `submit` opens the one matching existing draft and rechecks content, decoded image, AI label, enabled scheduling and the exact time. It does not upload images, rewrite copy or create new drafts.
- It requires the observed `xhs-publish-btn` host to say **定时发布** and be enabled. It clicks that observed DOM host, not hard-coded screenshot coordinates, never an immediate-publish fallback. Changed DOM stops the run.
- Before the click, it fsyncs a private submission-intent record. Prior id, fingerprint, image hash or title in this ledger blocks another attempt. The exclusive shared state lock prevents concurrent use by these CLIs. Do not run other browser scripts with that profile simultaneously.
- **Unlike draft/prepare, submit does not install the draft-only network guard.** This is a deliberate consequential mode, not a security sandbox. It can submit the note and relies on the reviewed, unchanged creator UI. Do not browse unrelated pages while it runs.
- A click yields only `submission-attempted-needs-management-review`. The browser stays open. Check the platform success page and **Note Management's exact title and scheduled time**, then close the browser. Neither a click, HTTP response, nor screenshot of the editor proves scheduling. A scheduled/reviewing note also does not guarantee eventual public visibility.
- On failure, disconnect, missing success page or uncertain management result, STOP. Inspect management and the durable ledger. Never clear state, change ids, repeat the command, or fall back to immediate publication. There is intentionally no automatic retry or “force” flag. A genuinely failed intent requires human investigation and a separate recovery decision.
- Screenshots, manifest, ledger and browser profile are private and must remain outside the repository. The code does not store cookies in the public repository or require a paid model API.

### What was tested

The original **guided auxiliary runner** scheduled real existing drafts and verified the success page plus management entries. Its recorded response listener did not reliably observe publish responses, so no undocumented API success contract is claimed. That runner used manually inspected coordinates; this package instead uses the verified host element and is tested against a closed-shadow DOM fixture.

The reusable scheduling CLI has **offline unit and real Chromium fixture tests only**, including dates, opt-in arguments, duplicate intent, interruption, closed-shadow click and no network in the fixture. It has **not** passed unattended real-site batch acceptance. CI does not log into Xiaohongshu and does not publish. Site changes, moderation, account restrictions and platform policies remain the operator's responsibility. No promise of anti-detection, guaranteed reach or long-term selector compatibility is made.

## 简体中文

这是**单独显式启用的实验性功能**，每次处理一篇已有图文草稿。原草稿命令及其禁止发布的保护保持不变，默认仍只做本地验证。它不是电脑后台计时器：提交成功后由小红书管理审核及定时发布，平台确认提交后关电脑不会撤销平台定时。

### 使用前

必须获准向指定账号发布指定原图、文案及日期时间。上传授权不等于发布授权。先核对当前账号、原图与已加载的草稿图片、全文、真实 AI 声明、需要的话题，以及管理页已有发布／定时记录。本地日志不知道其他设备是否已经发过，也不能通过图片像素证明身份。不关闭 AI 声明，不绕过验证码或限流。

沿用普通私有清单，每篇新增 `scheduleAt` 字段，例如上面的 `2030-01-02 11:30`。这只是字段片段，不是完整清单；须换成已获准的未来日期。统一按**北京时间 Asia/Shanghai（UTC+08:00）**解释，不依赖电脑时区。2026 年 11 月观察到的范围是未来 1 小时至 14 天，程序保守校验此范围，但仍需核对平台当时实际限制。执行时重新检查，不能只在规划时检查。清单内重复时刻会被拒绝。若清单含已完成／过期条目，可从输入计划移除，但不得清除历史状态与防重日志。

命令见上方：

1. `validate` 仅本地检查，不打开浏览器。
2. `prepare` 用原草稿同一 `--state` 及 `--id` 打开草稿、设置定时时刻、保存截图后关闭。可能触发本地草稿自动保存，**不会提交**。核对截图与原图。
3. 明确得到发布授权并完成账号、原图、管理页去重检查后，才运行 `submit ... --reviewed`。这个标志是操作者声明，不是图像已被机器识别，也不能代替用户授权。

沿用的校验器只支持每篇一张图、不自动添加话题。用户手动修改的正文／真实话题必须与认可清单匹配，否则停止。不能为了通过校验而删掉用户修改；此时应手动交接。

### 提交与恢复

程序不重新上传、不重写内容、不创建草稿。提交前重新核对文案、已解码图片、AI 标识、定时开关及精确时刻；只有页面唯一启用的 `xhs-publish-btn` 明确标示“定时发布”才点击。点击当前 DOM 宿主，不硬编码截图坐标，不降级成“立即发布”。

点击前落盘并同步提交意图。相同 ID、内容指纹、图片哈希或标题曾有意图就阻止再次提交；同状态目录使用互斥锁。不要让其他脚本同时使用该浏览器目录。

**submit 不安装草稿模式的网络拦截器，会真的提交笔记。** 这是有明确授权的高后果模式，不是安全沙箱，依赖当前页面与已核对的内容；运行期间不要浏览无关页面。原来的 draft 与 prepare 仍保留拦截。

点击之后只报告 `submission-attempted-needs-management-review`，浏览器保持打开。须查看成功页，以及**笔记管理页里对应的精确标题和定时时间**，核验后关闭浏览器。点击、HTTP 回应或编辑器截图都不是定时成功的证明；“定时／审核中”也不保证最终公开成功。

断线、异常或状态不明时立即停止，查看管理页和意图日志。不得清除状态、换 ID、重新提交或改成立即发布。没有自动重试及强制按钮；确实失败的意图也需要人工调查与单独恢复决定。私有清单、原图、截图、日志和登录目录不得提交到仓库。

### 验证范围

原始**人工引导辅助脚本**已在实站安排已有草稿，并通过成功页和管理页核对。其回应监听未可靠捕获发布请求，因此不宣称任何未公开接口的成功协议。原脚本使用当场查看的坐标，公开代码改用当前 DOM 宿主，已用闭合 Shadow DOM 离线页面测试。

新整理的通用命令仅通过**离线单元测试与真实 Chromium 模拟页面测试**，覆盖日期、显式启用、防重、断线意图和闭合 Shadow DOM 点击，**尚未通过无人值守实站批量验收**。CI 不登录、不发布。页面变动、平台规则、审核和账号限制仍需人工判断，不承诺规避识别、流量或长期兼容。
