'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {chromium}=require('playwright');const {XhsUI,processPost}=require('../scripts/ui.cjs');const {Journal,UPLOAD,hash,installGuards}=require('../scripts/core.cjs');
const html=fs.readFileSync(path.join(__dirname,'fixture.html'),'utf8');
test('real Chromium offline fixture: upload/fill/AI/save/reopen/repeat; no publication or outbound network',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'xhs-browser-'));const browser=await chromium.launch({headless:true});const context=await browser.newContext({serviceWorkers:'block'});let outbound=0;
 await context.route('**/*',r=>{if(r.request().url()===UPLOAD&&r.request().method()==='GET')return r.fulfill({contentType:'text/html',body:html});outbound++;return r.abort()});
 try{const p={id:'fixture',fingerprint:'fixture-hash',title:'离线原图测试',body:'AI 辅助创作。\n\n只存草稿\nhttps://example.test/#/works/a',aiGenerated:true,image:path.join(dir,'one.png')};fs.writeFileSync(p.image,Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9XsAAAAASUVORK5CYII=','base64'));
 p.sha256=hash(fs.readFileSync(p.image));
 const page=await context.newPage(),ui=new XhsUI(page,{stabilizeMs:0}),journal=new Journal(path.join(dir,'state'));await processPost(ui,p,journal);assert.equal((await processPost(ui,p,journal)).reused,true);assert.equal(await page.evaluate(()=>localStorage.getItem('uploads')),'1');assert.equal(await page.evaluate(()=>localStorage.getItem('published')),null);assert.equal(outbound,0);
 // A changed declaration or stray query must fail verification, not be called saved.
 await page.locator('[contenteditable=true]').fill(p.body+'#accidental');await assert.rejects(()=>ui.verify(p),/Body mismatch/);
 await page.goto(UPLOAD);await page.evaluate(()=>localStorage.setItem('drafts','[]'));await assert.rejects(()=>processPost(ui,p,journal),/possibly published/);assert.equal(await page.evaluate(()=>localStorage.getItem('uploads')),'1');
 }finally{await context.close();await browser.close();fs.rmSync(dir,{recursive:true,force:true})}
});

test('real browser installs production guards: publish click and direct mutations are blocked',async()=>{
 const browser=await chromium.launch({headless:true});const context=await browser.newContext({serviceWorkers:'block'});let reachedServer=0;
 await context.route('**/*',r=>{if(r.request().url()===UPLOAD)return r.fulfill({contentType:'text/html',body:'<meta charset="utf-8"><button id="publish">发布</button><script>window.clicked=0;document.querySelector("button").onclick=()=>window.clicked++;</script>'});reachedServer++;return r.fulfill({status:200,body:'unexpected'})});
 const blocked=await installGuards(context);
 try{const page=await context.newPage();await page.goto(UPLOAD);await page.getByRole('button',{name:'发布',exact:true}).click();assert.equal(await page.evaluate(()=>window.clicked),0);
 const responses=await page.evaluate(async()=>{const targets=[['POST','/api/sns/web/v1/publish'],['GET','/api/sns/web/v1/%70ublish'],['POST','/unrecognized-write']];return Promise.all(targets.map(async([method,u])=>{try{await fetch(u,{method});return 'sent'}catch{return 'blocked'}}))});assert.deepEqual(responses,['blocked','blocked','blocked']);assert.equal(reachedServer,0);assert.equal(blocked.length,3);
 }finally{await context.close();await browser.close()}
});

test('missing save control relies on verified autosave, not elapsed time; non-AI declaration stays off',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'xhs-autosave-'));const browser=await chromium.launch({headless:true});const context=await browser.newContext({serviceWorkers:'block'});
 const auto=html.replace("<button id=\"save\">暂存离开</button>","<button id=\"save\" hidden>暂存离开</button>");
 await context.route('**/*',r=>r.request().url()===UPLOAD?r.fulfill({contentType:'text/html',body:auto}):r.abort());
 try{const image=path.join(dir,'sample.png');fs.writeFileSync(image,Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9XsAAAAASUVORK5CYII=','base64'));const p={id:'nonai',fingerprint:'nonai-fingerprint',title:'非生成图像测试',body:'原创摄影的测试描述。',aiGenerated:false,image,sha256:hash(fs.readFileSync(image))};const page=await context.newPage(),ui=new XhsUI(page,{stabilizeMs:0});await processPost(ui,p,new Journal(path.join(dir,'state')));await ui.verify(p);assert.equal(await page.evaluate(()=>localStorage.getItem('published')),null);
 }finally{await context.close();await browser.close();fs.rmSync(dir,{recursive:true,force:true})}
});


test('preview verification rejects missing/broken images and waits for delayed decode',async()=>{
 const browser=await chromium.launch({headless:true});const context=await browser.newContext({serviceWorkers:'block'});
 await context.route('**/*',r=>r.request().url()===UPLOAD?r.fulfill({contentType:'text/html',body:'<meta charset="utf-8"><input placeholder="填写标题会有更多赞哦" value="预览测试"><div contenteditable="true">AI 辅助创作</div><div>笔记含AI合成内容</div><span>1/18</span><img id="creator-preview-image-0" src="data:image/png;base64,broken">'}):r.abort());
 try{const page=await context.newPage();await page.goto(UPLOAD);const ui=new XhsUI(page,{previewTimeoutMs:300});const p={title:'预览测试',body:'AI 辅助创作',aiGenerated:true};
 await assert.rejects(()=>ui.verify(p),/Image preview did not finish loading/);
 await page.locator('#creator-preview-image-0').evaluate(e=>e.remove());await assert.rejects(()=>ui.verify(p),/missing reopened image preview/);
 await page.evaluate(()=>{const i=document.createElement('img');i.id='creator-preview-image-0';document.body.append(i);setTimeout(()=>{i.src='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9XsAAAAASUVORK5CYII='},250)});
 await new XhsUI(page,{previewTimeoutMs:2000}).verify(p);assert.ok(await page.locator('#creator-preview-image-0').evaluate(e=>e.complete&&e.naturalWidth>0));
 }finally{await context.close();await browser.close()}
});
