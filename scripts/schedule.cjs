'use strict';
const fs=require('node:fs'),path=require('node:path');
const {humanCheck,visible}=require('./ui.cjs');
// The creator UI was observed to use Beijing time. No host-local date parsing.
function scheduleTime(value,now=Date.now()){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(value))throw Error('Expected YYYY-MM-DD HH:mm in Asia/Shanghai');
 const epoch=Date.parse(value.replace(' ','T')+':00+08:00');
 if(!Number.isFinite(epoch)||new Date(epoch+8*3600000).toISOString().slice(0,16).replace('T',' ')!==value)throw Error('Invalid calendar date');
 if(epoch-now<3600000||epoch-now>14*86400000)throw Error('Schedule must be 1 hour to 14 days ahead (also check current platform limits)');
 return epoch;
}
function validatePlan(posts,now=Date.now()){
 const times=new Set();for(const post of posts){scheduleTime(post.scheduleAt,now);if(times.has(post.scheduleAt))throw Error('Duplicate schedule slot');times.add(post.scheduleAt)}return posts;
}
class SubmissionLedger{
 constructor(dir){this.dir=path.join(dir,'schedule-intents');fs.mkdirSync(this.dir,{recursive:true,mode:0o700})}
 check(post){
  // A single append-only file and state lock cover id changes and content changes.
  const file=path.join(this.dir,'intents.jsonl');
  const rows=fs.existsSync(file)?fs.readFileSync(file,'utf8').trim().split('\n').filter(Boolean).map(JSON.parse):[];
  if(rows.some(r=>r.id===post.id||r.fingerprint===post.fingerprint||r.sha256===post.sha256||r.title===post.title))throw Error('Prior submission intent exists; inspect management, never blindly retry or clear state');
 }
 reserve(post){
  this.check(post);const file=path.join(this.dir,'intents.jsonl');
  const fd=fs.openSync(file,'a',0o600);try{fs.writeSync(fd,JSON.stringify({id:post.id,title:post.title,fingerprint:post.fingerprint,sha256:post.sha256,scheduleAt:post.scheduleAt,status:'submission-intent',at:new Date().toISOString()})+'\n');fs.fsyncSync(fd)}finally{fs.closeSync(fd)}
 }
}
class ScheduleUI{
 constructor(ui){this.ui=ui;this.page=ui.page}
 card(){return this.page.getByText('定时发布',{exact:true}).locator('..').locator('..')}
 async fields(){
  const card=this.card();if(await card.count()!==1)throw Error('Schedule control changed/ambiguous');
  const enabled=card.locator('input[type="checkbox"]');if(await enabled.count()!==1)throw Error('Schedule checkbox changed');
  const inputs=await visible(this.page.locator('input'));const dates=[];
  for(const input of inputs)if(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(await input.inputValue()))dates.push(input);
  if(dates.length!==1)throw Error('Schedule date input changed/ambiguous');return {enabled,date:dates[0]};
 }
 async prepare(post){
  scheduleTime(post.scheduleAt);const titles=await this.ui.list();if(titles.filter(t=>t===post.title).length!==1)throw Error('Existing draft missing/ambiguous; never recreate');
  await this.ui.open(post.title);await this.ui.verify(post);
  const card=this.card();if(await card.count()!==1)throw Error('Schedule control changed/ambiguous');
  const checkbox=card.locator('input[type="checkbox"]');if(await checkbox.count()!==1)throw Error('Schedule checkbox changed');
  if(!await checkbox.isChecked()){const toggle=card.locator('.d-switch');if(await toggle.count()!==1)throw Error('Schedule switch changed');await toggle.click()}
  const {date}=await this.fields();await date.fill(post.scheduleAt);
  await this.page.getByText('更多设置',{exact:true}).click();await this.verify(post);
 }
 async verify(post){
  scheduleTime(post.scheduleAt);await this.ui.verify(post);const {enabled,date}=await this.fields();
  if(!await enabled.isChecked()||await date.inputValue()!==post.scheduleAt)throw Error('Schedule value mismatch');
 }
 async button(){
  const host=this.page.locator('xhs-publish-btn');
  if(await host.count()!==1||!await host.isVisible()||await host.getAttribute('submit-text')!=='定时发布'||await host.getAttribute('submit-disabled')!=='false')throw Error('Enabled timed-submit control not found; do not substitute immediate publish');
  return host;
 }
 async submit(post,ledger){
  await this.verify(post);await humanCheck(this.page);const host=await this.button();
  // The real control has a closed shadow root; click its observed host, not saved screen coordinates.
  ledger.reserve(post);await host.click();
  // A click or response is not proof of a scheduled note. Never retry this item.
  return {id:post.id,scheduleAt:post.scheduleAt,status:'submission-attempted-needs-management-review'};
 }
}
module.exports={scheduleTime,validatePlan,SubmissionLedger,ScheduleUI};
