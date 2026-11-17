'use strict';
const fs=require('node:fs'),path=require('node:path');
const {norm,hash,UPLOAD}=require('./core.cjs');
async function humanCheck(page){
 if(!page.url().startsWith('https://creator.xiaohongshu.com/')||page.url().includes('/login'))throw Error('Login required. Use human-browser in the SAME profile; never export cookies.');
 const text=await page.locator('body').innerText();
 if(/请完成安全验证|拖动滑块|请完成验证|访问过于频繁/.test(text))throw Error('Human verification/rate limit: stop, no CAPTCHA automation or retry.');
}
async function one(loc,label){if(await loc.count()!==1)throw Error('Ambiguous/missing '+label);return loc;}
async function visible(loc){const out=[];for(const l of await loc.all())if(await l.isVisible())out.push(l);return out;}
async function waitFor(check,message,timeout=10000){const end=Date.now()+timeout;do{if(await check())return;await new Promise(r=>setTimeout(r,150));}while(Date.now()<end);throw Error(message);}
class XhsUI{
 constructor(page,{stabilizeMs=1800}={}){this.page=page;this.stabilizeMs=stabilizeMs;}
 async list(){
  const p=this.page;await p.goto(UPLOAD,{waitUntil:'domcontentloaded'});
  await p.getByText(/^草稿箱\(\d+\)$/).waitFor({state:'visible'});await humanCheck(p);
  await (await one(p.getByText(/^草稿箱\(\d+\)$/),'draft entry')).click();
  const tab=await one(p.getByText(/^图文笔记\(\d+\)$/),'image draft tab');await tab.click();
  await waitFor(async()=>{const s=await p.locator('body').innerText();return /草稿存储于当前使用的浏览器本地/.test(s)&&/图文笔记最多支持/.test(s)},'Draft list not ready');
  return p.locator('.draft-title-text').allTextContents();
 }
 async open(title){
  const row=this.page.locator('.draft-info').filter({has:this.page.locator('.draft-title-text').filter({hasText:new RegExp('^'+title.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'$')})});
  await (await one(row,'draft title')).getByText('编辑',{exact:true}).click();
  await this.title().waitFor({state:'visible'});await humanCheck(this.page);
 }
 title(){return this.page.getByPlaceholder('填写标题会有更多赞哦',{exact:true})}
 body(){return this.page.locator('[contenteditable="true"]')}
 async upload(post){
  await this.page.goto(UPLOAD,{waitUntil:'domcontentloaded'});
  const file=this.page.locator('input[type=file]');await file.waitFor({state:'attached'});await humanCheck(this.page);
  const bytes=fs.readFileSync(post.image);if(hash(bytes)!==post.sha256)throw Error('Original changed since validation; upload stopped');
  const mimeType=bytes.subarray(0,8).toString('hex')==='89504e470d0a1a0a'?'image/png':bytes[0]===255?'image/jpeg':'image/webp';
  await (await one(file,'image upload input')).setInputFiles({name:path.basename(post.image),mimeType,buffer:bytes});
  await this.title().waitFor({state:'visible'});await humanCheck(this.page);
 }
 async fill(post){
  await humanCheck(this.page);await (await one(this.title(),'title')).fill(post.title);await (await one(this.body(),'body')).fill(post.body);
  if(post.aiGenerated){
   const chooser=this.page.getByText('添加内容类型声明',{exact:true});const options=await visible(chooser);
   if(options.length!==1)throw Error('AI chooser changed: inspect, do not guess');await options[0].click();
   const ai=await visible(this.page.getByText('笔记含AI合成内容',{exact:true}));if(ai.length!==1)throw Error('AI option ambiguous');await ai[0].click();
  }
  await this.verify(post);
 }
 async verify(post){
  await humanCheck(this.page);
  if(await (await one(this.title(),'title')).inputValue()!==post.title)throw Error('Title mismatch');
  const body=await (await one(this.body(),'body')).innerText();if(norm(body)!==norm(post.body))throw Error('Body mismatch (including accidental hashtag/query text)');
  const ai=await visible(this.page.getByText('笔记含AI合成内容',{exact:true}));
  const chooser=await visible(this.page.getByText('添加内容类型声明',{exact:true}));
  if(post.aiGenerated?(ai.length===0||chooser.length>0):ai.length>0)throw Error('AI declaration mismatch');
  // This proves image count, NOT pixel identity. Screenshot review is mandatory.
  const count=await visible(this.page.getByText(/^1\s*\/\s*18$/));if(count.length!==1)throw Error('Expected exactly one image in editor');
 }
 async saveAndReopen(post){
  await this.verify(post);
  // An observed DOM save control is preferred. Never click arbitrary coordinates.
  const save=await visible(this.page.getByText(/^(暂存离开|保存草稿)$/));
  if(save.length>1)throw Error('Ambiguous save control');
  if(save.length===1)await save[0].click();
  // Local autosave is real but debounce is not proof. Only reopen is evidence.
  await new Promise(r=>setTimeout(r,this.stabilizeMs));
  const titles=await this.list();if(titles.filter(t=>t===post.title).length!==1)throw Error('Saved draft absent/ambiguous. State uncertain; do NOT upload again.');
  await this.open(post.title);await this.verify(post);
 }
}
async function processPost(ui,post,journal,{reconcile=false,capture=async()=>{}}={}){
 const prior=journal.get(post);
 if(prior&&prior.fingerprint!==post.fingerprint)throw Error('Existing id has changed content; inspect before proceeding');
 const titles=await ui.list(),matches=titles.filter(t=>t===post.title);
 if(matches.length>1)throw Error('Multiple drafts share title; stop for manual reconciliation');
 if(prior){
  if(prior.status!=='reopened-needs-visual-review'&&!reconcile)throw Error('Prior attempt may have side effects. Run reconcile; never blindly retry.');
  if(matches.length!==1)throw Error('Recorded draft missing (possibly published/deleted); do not recreate automatically.');
  await ui.open(post.title);await ui.verify(post);await capture(post);
  journal.put(post,'reopened-needs-visual-review',{reused:true});return {id:post.id,reused:true,status:'reopened-needs-visual-review'};
 }
 if(reconcile)throw Error('No journal entry to reconcile');
 if(matches.length)throw Error('Existing draft title collision: do not overwrite or create duplicate');
 // Record intent BEFORE upload; an interrupted attempt must never silently repeat.
 journal.put(post,'editing');
 try{await ui.upload(post);await ui.fill(post);await ui.saveAndReopen(post);await capture(post);journal.put(post,'reopened-needs-visual-review');return {id:post.id,reused:false,status:'reopened-needs-visual-review'};}
 catch(e){journal.put(post,'uncertain',{reason:e.message});throw e}
}
module.exports={XhsUI,processPost,humanCheck,visible,waitFor};
