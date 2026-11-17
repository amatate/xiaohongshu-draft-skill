'use strict';
const fs=require('node:fs');const path=require('node:path');const crypto=require('node:crypto');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const norm=s=>String(s).replace(/\s+/gu,' ').trim();
const ORIGIN='https://creator.xiaohongshu.com';
const UPLOAD=ORIGIN+'/publish/publish?from=menu&target=image';
const WRITE_READS=new Set([
 't2.xiaohongshu.com/api/v2/collect',
 'as.xiaohongshu.com/api/p/pj','as.xiaohongshu.com/api/sec/v1/scripting',
 'as.xiaohongshu.com/api/sec/v1/sbtsource','as.xiaohongshu.com/api/sec/v1/shield/webprofile',
 'apm-fe.xiaohongshu.com/api/data','edith.xiaohongshu.com/api/redcaptcha/v2/getconfig',
 'edith.xiaohongshu.com/api/sns/web/racing_get',
 'edith.xiaohongshu.com/api/sns/v1/note/collection/pc/list_v2',
 'creator.xiaohongshu.com/api/galaxy/v2/creator/recommend/suggest/topics',
 'creator.xiaohongshu.com/api/galaxy/v2/creator/recommend/overt/topics',
 'creator.xiaohongshu.com/api/galaxy/v2/creator/servicegw/v2/search/topics'
]);
function allowRequest(method,url,{upload=false}={}){
 let u;try{u=new URL(url)}catch{return false}let p;try{p=decodeURIComponent(u.pathname)}catch{return false}
 if(u.protocol!=='https:')return false;
 // Deny note mutation/publication families even for GET, before all exceptions.
 if(/\/(?:web_api\/sns\/v\d+\/note|api\/sns\/web\/v\d+\/(?:publish|note)|api\/galaxy\/creator\/note\/publish)(?:\/|$)/i.test(p))return false;
 if(['GET','HEAD','OPTIONS'].includes(method))return true;
 if(method==='PUT'&&upload&&['ros-upload.xiaohongshu.com','ros-upload-d4.xhscdn.com'].includes(u.hostname))return true;
 return method==='POST'&&WRITE_READS.has(u.hostname+p);
}
async function installGuards(context,{isUploading=()=>false}={}){
 const blocked=[];
 await context.route('**/*',route=>{const r=route.request();if(allowRequest(r.method(),r.url(),{upload:isUploading()}))return route.fallback();const u=new URL(r.url());blocked.push({method:r.method(),host:u.hostname,path:u.pathname});return route.abort('blockedbyclient')});
 await context.addInitScript(()=>document.addEventListener('click',event=>{
  const el=event.target.closest('button,[role=button]');if(el&&/^(发布|立即发布|定时发布|Publish)$/i.test(el.textContent.trim())){event.preventDefault();event.stopImmediatePropagation();}
 },true));
 return blocked;
}
function validateManifest(file){
 const raw=JSON.parse(fs.readFileSync(file,'utf8'));if(raw.version!==1||!Array.isArray(raw.posts)||!raw.posts.length)throw Error('Expected version:1 and nonempty posts');
 const ids=new Set(),titles=new Set(),prints=new Set();
 return raw.posts.map(p=>{
  if(!p||typeof p.id!=='string'||!/^[-a-zA-Z0-9_]{1,80}$/.test(p.id)||['__proto__','prototype','constructor'].includes(p.id)||ids.has(p.id))throw Error('Invalid/duplicate id');ids.add(p.id);
  if(typeof p.title!=='string'||!p.title.trim()||p.title!==p.title.trim()||[...p.title].length>20||titles.has(p.title))throw Error('Invalid/duplicate title (max 20 codepoints)');titles.add(p.title);
  if(typeof p.body!=='string'||!p.body.trim()||[...p.body].length>1000)throw Error('Invalid body (max 1000 codepoints)');
  if(typeof p.aiGenerated!=='boolean')throw Error('Explicit aiGenerated boolean required');
  if(p.aiGenerated&&!/AI|人工智能/i.test(p.body))throw Error('AI content requires a body disclosure as well as platform declaration');
  if(p.topics?.length)throw Error('v0.1 does not automate topics. Remove only with user agreement; add manually at handoff.');
  if(typeof p.image!=='string'||!p.image||!/^[a-f0-9]{64}$/.test(p.sha256||''))throw Error('Image path and sha256 required');
  const image=path.resolve(path.dirname(file),p.image),stat=fs.statSync(image);if(!stat.isFile()||stat.size>32*1024*1024)throw Error('Image must be a regular file <=32MiB');
  const b=fs.readFileSync(image);const png=b.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex'));
  const jpeg=b[0]===255&&b[1]===216&&b[2]===255;const webp=b.subarray(0,4).toString()==='RIFF'&&b.subarray(8,12).toString()==='WEBP';
  if(!(png||jpeg||webp)||hash(b)!==p.sha256)throw Error('Unsupported image or hash mismatch');
  const fingerprint=hash(JSON.stringify([p.title,p.body,p.aiGenerated,p.sha256]));if(prints.has(fingerprint))throw Error('Duplicate post fingerprint');prints.add(fingerprint);
  return {...p,image,fingerprint};
 });
}
class Journal{
 constructor(dir){this.dir=dir;fs.mkdirSync(dir,{recursive:true,mode:0o700});this.file=path.join(dir,'journal.json');this.data=fs.existsSync(this.file)?JSON.parse(fs.readFileSync(this.file,'utf8')):{version:1,posts:{}};if(this.data.version!==1)throw Error('Unknown journal version');}
 get(p){return this.data.posts[p.id]||Object.values(this.data.posts).find(x=>x.fingerprint===p.fingerprint)}
 put(p,status,extra={}){this.data.posts[p.id]={fingerprint:p.fingerprint,status,updatedAt:new Date().toISOString(),...extra};const tmp=this.file+'.tmp';fs.writeFileSync(tmp,JSON.stringify(this.data,null,2),{mode:0o600});fs.renameSync(tmp,this.file);}
}
function lock(dir){fs.mkdirSync(dir,{recursive:true,mode:0o700});const file=path.join(dir,'run.lock');let fd;try{fd=fs.openSync(file,'wx',0o600)}catch{throw Error('State locked. Do not retry concurrently. If a prior run crashed, inspect/reconcile before removing run.lock.')}
 fs.writeFileSync(fd,String(process.pid));return()=>{fs.closeSync(fd);fs.unlinkSync(file)};
}
module.exports={norm,hash,ORIGIN,UPLOAD,allowRequest,installGuards,validateManifest,Journal,lock};
