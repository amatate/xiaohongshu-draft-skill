'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {chromium}=require('playwright');
const {scheduleTime,validatePlan,SubmissionLedger,ScheduleUI}=require('../scripts/schedule.cjs');
const {args}=require('../scripts/xhs-schedule.cjs');
const now=Date.parse('2030-01-01T00:00:00Z');
test('strict Beijing calendar and 1h–14d window independent of local TZ',()=>{
 assert.equal(scheduleTime('2030-01-01 09:00',now),now+3600000);
 for(const v of ['2030-01-01 08:59','2030-01-15 08:01','2030-02-30 12:00','2030-01-01 24:00','2030-01-01T09:00','2030-01-01 09:00+08:00'])assert.throws(()=>scheduleTime(v,now));
 assert.throws(()=>validatePlan([{scheduleAt:'2030-01-01 09:00'},{scheduleAt:'2030-01-01 09:00'}],now),/Duplicate/);
});
test('CLI defaults local-only and requires explicit submission review, item and state',()=>{
 assert.equal(args(['--manifest','/private/posts.json']).command,'validate');
 assert.throws(()=>args(['submit','--manifest','a','--state','b','--id','a']),/reviewed/);
 assert.throws(()=>args(['submit','--manifest','a','--reviewed']),/state/);
 assert.throws(()=>args(['validate','--manifest','a','--manifest','b']),/duplicate/);
 assert.equal(args(['submit','--manifest','a','--state','b','--id','a','--reviewed']).command,'submit');
});
test('durable intent blocks id/content/image/title reuse, including reopened ledger',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'xhs-schedule-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const p={id:'sample',title:'Synthetic sample',fingerprint:'fp',sha256:'sha',scheduleAt:'2030-01-01 09:00'};new SubmissionLedger(dir).reserve(p);
 for(const x of [p,{...p,id:'other'},{...p,fingerprint:'changed'},{...p,id:'new',fingerprint:'new',title:'new'}])assert.throws(()=>new SubmissionLedger(dir).reserve(x),/Prior/);
});
test('Chromium fixture prepares and clicks closed-shadow schedule host, recording intent first; zero outbound',async()=>{
 const browser=await chromium.launch({headless:true}),context=await browser.newContext();let outbound=0;
 const html=`<meta charset="utf-8"><div><div><span>定时发布</span></div><input type="checkbox"><div class="d-switch" onclick="document.querySelector('input').checked=true">switch</div></div><input id="date" value="2030-01-01 09:00"><button>更多设置</button><xhs-publish-btn submit-text="定时发布" submit-disabled="false" style="display:block;width:200px;height:50px"></xhs-publish-btn><script>document.querySelector('xhs-publish-btn').attachShadow({mode:'closed'}).innerHTML='<button style="width:100%;height:100%" onclick="window.clicked=true">定时发布</button>'</script>`;
 await context.route('**/*',r=>r.request().url()==='https://creator.xiaohongshu.com/fixture'?r.fulfill({body:html,contentType:'text/html'}):(outbound++,r.abort()));
 try{const page=await context.newPage();await page.goto('https://creator.xiaohongshu.com/fixture');const post={title:'Example',scheduleAt:new Date(Date.now()+8*3600000+2*3600000).toISOString().slice(0,16).replace('T',' ')};
 const ui=new ScheduleUI({page,async list(){return ['Example']},async open(){},async verify(){}});await ui.prepare(post);assert.equal(await page.locator('#date').inputValue(),post.scheduleAt);assert.equal(await page.evaluate(()=>window.clicked),undefined);
 await page.locator('#date').fill('2030-01-01 09:00');await assert.rejects(()=>ui.verify(post),/value mismatch/);await page.locator('#date').fill(post.scheduleAt);
 await page.locator('input[type=checkbox]').uncheck();await assert.rejects(()=>ui.verify(post),/value mismatch/);await page.locator('input[type=checkbox]').check();
 await page.locator('xhs-publish-btn').evaluate(e=>e.setAttribute('submit-disabled','true'));await assert.rejects(()=>ui.button(),/timed-submit/);await page.locator('xhs-publish-btn').evaluate(e=>e.setAttribute('submit-disabled','false'));
 let intent=false;const result=await ui.submit(post,{reserve(){intent=true}});assert.ok(intent);assert.equal(await page.evaluate(()=>window.clicked),true);assert.match(result.status,/needs-management-review/);assert.equal(outbound,0);
 await page.locator('xhs-publish-btn').evaluate(e=>e.setAttribute('submit-text','立即发布'));await assert.rejects(()=>ui.submit(post,{reserve(){throw Error('must not reserve')}}),/timed-submit/);
 }finally{await context.close();await browser.close()}
});
test('failed click leaves durable intent and refuses a second attempt',async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'xhs-crash-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));const ledger=new SubmissionLedger(dir);const p={id:'example',fingerprint:'example',sha256:'example',title:'Example'};
 const ui=new ScheduleUI({page:{url:()=> 'https://creator.xiaohongshu.com/test',locator:()=>({innerText:async()=>''})}});ui.verify=async()=>{};ui.button=async()=>({click:async()=>{throw Error('connection lost')}});
 await assert.rejects(()=>ui.submit(p,ledger),/connection lost/);await assert.rejects(()=>ui.submit(p,ledger),/Prior/);
});
