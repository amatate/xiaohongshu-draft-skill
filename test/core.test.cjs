'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {allowRequest,hash,validateManifest,Journal,lock}=require('../scripts/core.cjs');const {processPost}=require('../scripts/ui.cjs');
const PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9XsAAAAASUVORK5CYII=','base64');
function temp(t){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'xhs-test-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));return dir}
function fixture(t){const dir=temp(t);fs.writeFileSync(path.join(dir,'image.png'),PNG);const p={id:'synthetic',title:'合成测试',body:'AI 辅助的测试内容。\n\n链接：https://example.test/#/work/1',aiGenerated:true,image:'image.png',sha256:hash(PNG)};const file=path.join(dir,'posts.json');const write=x=>fs.writeFileSync(file,JSON.stringify({version:1,posts:x}));write([p]);return{dir,p,file,write}}
test('manifest validates original hash, AI disclosure, title and dedupe',t=>{const f=fixture(t);assert.equal(validateManifest(f.file).length,1);f.write([{...f.p,sha256:'0'.repeat(64)}]);assert.throws(()=>validateManifest(f.file),/hash mismatch/);f.write([f.p,f.p]);assert.throws(()=>validateManifest(f.file),/duplicate/);f.write([{...f.p,body:'没有声明'}]);assert.throws(()=>validateManifest(f.file),/disclosure/);f.write([{...f.p,topics:['topic']}]);assert.throws(()=>validateManifest(f.file),/does not automate topics/);});
test('deny mutations/publication across verbs, encoded paths and lookalike hosts',()=>{
 for(const method of ['GET','POST','PUT','PATCH','DELETE','HEAD'])for(const u of ['https://edith.xiaohongshu.com/web_api/sns/v2/note','https://edith.xiaohongshu.com/api/sns/web/v1/publish','https://edith.xiaohongshu.com/api/sns/web/v1/%70ublish'])assert.equal(allowRequest(method,u,{upload:true}),false);
 assert.equal(allowRequest('POST','https://creator.xiaohongshu.com/unknown',{upload:true}),false);
 assert.equal(allowRequest('PUT','https://ros-upload-d4.xhscdn.com/a',{upload:true}),true);
 assert.equal(allowRequest('PUT','https://ros-upload-d4.xhscdn.com/a'),false);
 assert.equal(allowRequest('PUT','https://ros-upload-d4.xhscdn.com.attacker.test/a',{upload:true}),false);
 assert.equal(allowRequest('POST','http://t2.xiaohongshu.com/api/v2/collect'),false);
 assert.equal(allowRequest('POST','https://t2.xiaohongshu.com/api/v2/collect'),true);
});
test('exclusive state lock fails closed, even stale lock',t=>{const d=temp(t),release=lock(d);assert.throws(()=>lock(d),/locked/);release();lock(d)();});
function fake(){return{titles:[],uploads:0,filled:0,async list(){return this.titles},async upload(){this.uploads++},async fill(){this.filled++},async saveAndReopen(p){this.titles.push(p.title)},async open(){},async verify(){}}}
test('repeat reuses verified record; never uploads twice',async t=>{const f=fixture(t),p=validateManifest(f.file)[0],j=new Journal(path.join(f.dir,'state')),ui=fake();await processPost(ui,p,j);assert.equal((await processPost(ui,p,j)).reused,true);assert.equal(ui.uploads,1);assert.equal(ui.filled,1);});
test('crash after upload cannot be retried blindly; explicit reconcile never reuploads',async t=>{const f=fixture(t),p=validateManifest(f.file)[0],j=new Journal(path.join(f.dir,'state')),ui=fake();ui.fill=async()=>{ui.titles=[p.title];throw Error('interrupted')};await assert.rejects(()=>processPost(ui,p,j),/interrupted/);await assert.rejects(()=>processPost(ui,p,j),/reconcile/);await processPost(ui,p,j,{reconcile:true});assert.equal(ui.uploads,1);});
test('existing titles and missing recorded drafts never recreate/overwrite',async t=>{const f=fixture(t),p=validateManifest(f.file)[0],j=new Journal(path.join(f.dir,'state')),ui=fake();ui.titles=[p.title];await assert.rejects(()=>processPost(ui,p,j),/collision/);assert.equal(ui.uploads,0);j.put(p,'reopened-needs-visual-review');ui.titles=[];await assert.rejects(()=>processPost(ui,p,j),/possibly published/);assert.equal(ui.uploads,0)});
test('id change cannot bypass same-content journal; changed content under same id refused',async t=>{const f=fixture(t),p=validateManifest(f.file)[0],j=new Journal(path.join(f.dir,'state')),ui=fake();await processPost(ui,p,j);assert.equal((await processPost(ui,{...p,id:'renamed'},j)).reused,true);await assert.rejects(()=>processPost(ui,{...p,fingerprint:'changed'},j),/changed content/);assert.equal(ui.uploads,1)});
module.exports={PNG};
