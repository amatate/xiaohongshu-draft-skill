#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path');
const {validateManifest,installGuards,lock,UPLOAD}=require('./core.cjs');
const {XhsUI}=require('./ui.cjs');const {validatePlan,SubmissionLedger,ScheduleUI}=require('./schedule.cjs');
const HELP=`Experimental scheduled publishing of EXISTING drafts only.
 node scripts/xhs-schedule.cjs validate --manifest /private/posts.json
 node scripts/xhs-schedule.cjs prepare --manifest /private/posts.json --state /private/state --id example
 node scripts/xhs-schedule.cjs submit --manifest /private/posts.json --state /private/state --id example --reviewed
Default: local validate. Each post requires scheduleAt: "YYYY-MM-DD HH:mm" (Asia/Shanghai).
Prepare may autosave the schedule setting but cannot publish. It captures a preview and closes.
Submit needs explicit account/content/time authorization AND visual/management review.
--reviewed attests original-image, account, duplicate/history and platform-limit review.
Submit has NO draft-only network guard; it can publish. One item per invocation.
It records durable intent before the click. Success must be checked in Note Management.
Never retry an uncertain attempt, clear its ledger, or use new state to bypass it.`;
function args(argv){
 const a=[...argv];const command=a[0]&&!a[0].startsWith('--')?a.shift():'validate';
 if(!['validate','prepare','submit'].includes(command))throw Error('Unknown command');const o={};
 while(a.length){const k=a.shift();if(!['--manifest','--state','--id','--reviewed'].includes(k)||Object.hasOwn(o,k))throw Error('Unknown/duplicate argument');if(k==='--reviewed'){o[k]=true;continue}const v=a.shift();if(!v||v.startsWith('--'))throw Error('Missing argument value');o[k]=v}
 if(!o['--manifest'])throw Error('Missing --manifest');if(command!=='validate'&&(!o['--state']||!o['--id']))throw Error('Explicit --state and --id required');
 if(command==='submit'&&!o['--reviewed'])throw Error('Submit requires --reviewed after authorization and visual/management checks');return{command,o};
}
async function main(argv=process.argv.slice(2)){
 if(argv.includes('--help')){console.log(HELP);return}
 const {command,o}=args(argv),posts=validatePlan(validateManifest(path.resolve(o['--manifest'])));
 if(command==='validate'){console.log(JSON.stringify({valid:true,count:posts.length,timeZone:'Asia/Shanghai'}));return}
 const post=posts.find(p=>p.id===o['--id']);if(!post)throw Error('Unknown post id');
 const state=path.resolve(o['--state']);if(!fs.existsSync(path.join(state,'profile')))throw Error('Existing dedicated state/profile required; log in with xhs-drafts human-browser first');
 const real=fs.realpathSync(state),repo=fs.realpathSync(path.resolve(__dirname,'..'));if(real===repo||real.startsWith(repo+path.sep))throw Error('Private state must be outside repository');
 const release=lock(real);let context;try{
  const ledger=new SubmissionLedger(real);ledger.check(post);
  const {chromium}=require('playwright');context=await chromium.launchPersistentContext(path.join(real,'profile'),{headless:false,serviceWorkers:'block',viewport:{width:1280,height:900},locale:'zh-CN',timezoneId:'Asia/Shanghai'});
  if(command==='prepare')await installGuards(context);
  const page=context.pages()[0]||await context.newPage();page.setDefaultTimeout(15000);page.setDefaultNavigationTimeout(30000);
  await page.goto(UPLOAD,{waitUntil:'domcontentloaded'});const ui=new ScheduleUI(new XhsUI(page));await ui.prepare(post);
  const evidence=path.join(real,'evidence');fs.mkdirSync(evidence,{recursive:true,mode:0o700});await page.screenshot({path:path.join(evidence,post.id+'-schedule-prepared.png'),fullPage:true});
  const result=command==='submit'?await ui.submit(post,ledger):{id:post.id,scheduleAt:post.scheduleAt,status:'prepared-not-submitted'};
  if(command==='submit'){
   result.successPageObserved=await page.waitForURL(url=>url.origin==='https://creator.xiaohongshu.com'&&url.pathname==='/publish/success',{timeout:20000}).then(()=>true,()=>false);
   await page.screenshot({path:path.join(evidence,post.id+'-schedule-after-click.png'),fullPage:true}).catch(()=>{});
  }
  fs.writeFileSync(path.join(real,'schedule-last-result.json'),JSON.stringify(result,null,2),{mode:0o600});console.log(JSON.stringify(result));
  if(command==='submit'){
   console.log('Do not repeat. Browser stays open for Note Management verification; close it when finished. Scheduled/under-review is not proof of eventual public visibility.');
   await new Promise(resolve=>context.on('close',resolve));context=null;
  }
 }finally{if(context)await context.close();release()}
}
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1});
module.exports={args,main};
