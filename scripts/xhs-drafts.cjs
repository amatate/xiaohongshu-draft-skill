#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {validateManifest,installGuards,Journal,lock,UPLOAD}=require('./core.cjs');const {XhsUI,processPost}=require('./ui.cjs');
const usage=`Usage:
 node scripts/xhs-drafts.cjs validate --manifest /absolute/path/posts.json
 node scripts/xhs-drafts.cjs draft --manifest /absolute/path/posts.json --state /private/path/state
 node scripts/xhs-drafts.cjs reconcile --manifest /absolute/path/posts.json --state /private/path/state
 node scripts/xhs-drafts.cjs human-browser --state /private/path/state

Default: validate only. One original image per post. No automatic publication.
Draft/reconcile require prior user authorization; human-browser explicitly hands
control to the user with NO network interception. Use this same launch method
for login and manual publishing, then close it before starting draft automation.
State/profile/evidence are PRIVATE. Never commit or clear them accidentally.`;
async function main(){
 const args=process.argv.slice(2);if(args.includes('--help')){console.log(usage);return}
 const command=args[0]&&!args[0].startsWith('--')?args.shift():'validate';if(!['validate','draft','reconcile','human-browser'].includes(command))throw Error('Unsupported command (publication is not implemented)');
 const opts={};while(args.length){const k=args.shift(),v=args.shift();if(!['--manifest','--state'].includes(k)||!v||v.startsWith('--')||opts[k])throw Error('Unknown/duplicate argument');opts[k]=v;}
 let posts;if(command!=='human-browser'){if(!opts['--manifest'])throw Error('Missing --manifest');posts=validateManifest(path.resolve(opts['--manifest']));}
 if(command==='validate'){console.log(JSON.stringify({valid:true,count:posts.length,ids:posts.map(p=>p.id)}));return}
 let state=path.resolve(opts['--state']||path.join(os.homedir(),'.local','share','xiaohongshu-drafts'));
 fs.mkdirSync(state,{recursive:true,mode:0o700});state=fs.realpathSync(state);
 const repo=fs.realpathSync(path.resolve(__dirname,'..'));if(state===repo||state.startsWith(repo+path.sep))throw Error('Private state must be OUTSIDE the repository');
 const release=lock(state);let context;
 try{
  const {chromium}=require('playwright');
  context=await chromium.launchPersistentContext(path.join(state,'profile'),{headless:false,serviceWorkers:'block',viewport:{width:1280,height:900},locale:'zh-CN'});
  const page=context.pages()[0]||await context.newPage();page.setDefaultTimeout(15000);page.setDefaultNavigationTimeout(30000);
  if(command==='human-browser'){
   await page.goto(UPLOAD);console.log('Human handoff open. No automated editing, uploads or publication; close browser when finished.');
   await new Promise(resolve=>context.on('close',resolve));context=null;return;
  }
  let upload=false;const blocked=await installGuards(context,{isUploading:()=>upload});
  const ui=new XhsUI(page),originalUpload=ui.upload.bind(ui);
  ui.upload=async p=>{upload=true;await originalUpload(p)};
  const originalSave=ui.saveAndReopen.bind(ui);ui.saveAndReopen=async p=>{try{await originalSave(p)}finally{upload=false}};
  const journal=new Journal(state),evidence=path.join(state,'evidence');fs.mkdirSync(evidence,{recursive:true,mode:0o700});
  const results=[];
  const report=(error=null)=>{const tmp=path.join(state,'last-result.json.tmp');fs.writeFileSync(tmp,JSON.stringify({results,blocked,at:new Date().toISOString(),error,imageIdentity:'NOT machine-verified: inspect reopened screenshots against originals',draftScope:'current browser local storage only'},null,2),{mode:0o600});fs.renameSync(tmp,path.join(state,'last-result.json'));};
  report();
  for(const p of posts){
   try{
    results.push(await processPost(ui,p,journal,{reconcile:command==='reconcile',capture:async post=>{await page.screenshot({path:path.join(evidence,post.id+'-reopened.png'),fullPage:true})}}));report();
   }catch(e){
    const failureImage=path.join(evidence,p.id+'-failed.png');
    try{await page.screenshot({path:failureImage,fullPage:true})}catch{}
    report({id:p.id,message:e.message,attemptStatus:journal.get(p)?.status||'stopped-before-upload',screenshot:fs.existsSync(failureImage)?failureImage:null});throw e;
   }
  }
  console.log(JSON.stringify({results,evidence,blockedCount:blocked.length,needsVisualReview:true},null,2));
 }finally{if(context)await context.close();release()}
}
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1});
module.exports={main};
