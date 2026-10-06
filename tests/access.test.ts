import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { canAccess, visibleData, allowedPatch, STATE_FIELDS, type AccessProfile } from '../src/accessPolicy';
import { createAccessRouter } from '../src/server/accessRouter';
const user = (overrides: Partial<AccessProfile> = {}): AccessProfile => ({ uid: 'member', displayName: 'Test', email: 'test@example.com', username: null, role: 'viewer', status: 'active', permissions: {}, createdAt: '2026-01-01', ...overrides });
test('pending and disabled accounts have no access, including administrators', () => {
 for (const status of ['pending','disabled'] as const) for (const section of ['hub','accessi','mensile']) assert.equal(canAccess(user({role:'admin',status}),section,true),false);
});
test('viewer cannot write, editor requires per-function permission, access management requires admin', () => {
 assert.equal(canAccess(user({permissions:{mensile:'write'}}),'mensile',true),false);
 const editor=user({role:'editor',permissions:{mensile:'write',domenica:'read'}});
 assert.equal(canAccess(editor,'mensile',true),true); assert.equal(canAccess(editor,'domenica',true),false);
 assert.equal(canAccess(editor,'domenica'),true); assert.equal(canAccess(editor,'accessi'),false);
 assert.equal(canAccess(editor,'anagrafica'),false); assert.equal(canAccess(editor,'all',true),false);
 assert.equal(canAccess(user({role:'admin'}),'accessi',true),true);
});
const raw={state:{people:[{id:'a',name:'Persona',phone:'123',email:'private@example.com',roles:{lettore:true}}],vitaEMinistero:{meetings:[{private:'ministry'}]},mensileArchives:[{id:'archive'}],adminPin:'secret',programResponsibles:{x:'a'}},activePrograms:{menRows:[{id:1}],domRows:[{id:2}]}};
test('programme users receive only authorized programmes and minimal shared people',()=>{
 const result=visibleData(user({permissions:{mensile:'read'}}),raw);
 assert.equal(result.state.people[0].phone,undefined); assert.equal(result.state.people[0].email,undefined);
 assert.equal(result.state.vitaEMinistero,undefined); assert.equal(result.state.adminPin,undefined);
 assert.equal(result.state.programResponsibles,undefined); assert.equal(result.activePrograms.domRows,undefined);
 assert.deepEqual(result.activePrograms.menRows,[{id:1}]);
});
test('no function permissions disclose no people or programmes; admin keeps full records',()=>{
 assert.deepEqual(visibleData(user(),raw).state.people,[]);
 assert.deepEqual(visibleData(user(),raw).activePrograms,{});
 assert.equal(visibleData(user({role:'admin'}),raw).state.people[0].phone,'123');
});
test('patch whitelist blocks privilege escalation and unauthorized fields',()=>{
 assert.deepEqual(allowedPatch(user({role:'editor',permissions:{mensile:'write'}}),{people:[],mensileArchives:[],role:'admin',adminPin:'0000'},STATE_FIELDS),{mensileArchives:[]});
 assert.deepEqual(allowedPatch(user({permissions:{mensile:'write'}}),{mensileArchives:[]},STATE_FIELDS),{});
});
async function endpoint(t: any, profile: AccessProfile | null, action: (url:string, documents:Map<string,any>)=>Promise<void>, account: any = {}) {
 const documents=new Map<string,any>([['congregationData/main',raw]]); if(profile)documents.set('accessUsers/member',profile);
 const ref=(path:string)=>({path,get:async()=>snap(path)});
 const snap=(path:string)=>({exists:documents.has(path),data:()=>documents.get(path),get:(key:string)=>documents.get(path)?.[key]});
 const provider=()=>({
 auth:{verifyIdToken:async(token:string)=>{if(token!=='valid')throw Object.assign(new Error('bad'),{code:'auth/invalid-id-token'});return {uid:'member',firebase:{sign_in_provider:'password'}};},getUser:async()=>({uid:'member',email:'test@example.com',emailVerified:false,...account})},
 db:{doc:ref,collection:(name:string)=>({doc:(id:string)=>ref(name+'/'+id)}),runTransaction:async(fn:any)=>fn({get:async(r:any)=>snap(r.path),set:(r:any,data:any)=>documents.set(r.path,data),update:(r:any,data:any)=>documents.set(r.path,{...documents.get(r.path),...data})})}
 });
 const app=express();app.use(express.json());app.use('/api/access',createAccessRouter(provider as any));
 const server=app.listen(0);await new Promise<void>(resolve=>server.once('listening',resolve));t.after(()=>new Promise<void>(resolve=>server.close(()=>resolve())));
 const address=server.address() as {port:number};await action(`http://127.0.0.1:${address.port}/api/access`,documents);
}
const headers={Authorization:'Bearer valid','Content-Type':'application/json'};
test('API rejects unauthenticated requests with JSON before reading service credentials',async t=>endpoint(t,null,async url=>{
 for(const [path,method] of [['/users','GET'],['/users','POST'],['/data','GET'],['/data','PATCH'],['/me','GET']]) {const r=await fetch(url+path,{method});assert.equal(r.status,401);assert.match((await r.json()).error,/Accesso/);}
}));
test('API rejects pending, disabled and non-admin user administration',async t=>{
 for(const profile of [user({status:'pending'}),user({status:'disabled'}),user()])await endpoint(t,profile,async url=>{assert.equal((await fetch(url+'/users',{headers})).status,403);});
});
test('registration creates pending viewer without permissions',async t=>endpoint(t,null,async(url,documents)=>{
 const r=await fetch(url+'/me',{headers});assert.equal(r.status,200);const {user:created}=await r.json();assert.equal(created.status,'pending');assert.equal(created.role,'viewer');assert.deepEqual(created.permissions,{});assert.equal(documents.get('accessUsers/member').status,'pending');
}));
test('bootstrap admin requires verified email; verification promotes only eligible pending account',async t=>{
 const previous=process.env.ACCESS_BOOTSTRAP_ADMIN_EMAIL;process.env.ACCESS_BOOTSTRAP_ADMIN_EMAIL='bootstrap@example.com';
 try {await endpoint(t,null,async(url,documents)=>{const r=await fetch(url+'/me',{headers});assert.equal((await r.json()).user.status,'pending');assert.equal(documents.get('accessUsers/member').bootstrapEligible,true);},{email:'bootstrap@example.com'});
 await endpoint(t,null,async url=>{const r=await fetch(url+'/me',{headers});assert.equal((await r.json()).user.role,'admin');},{email:'bootstrap@example.com',emailVerified:true});
 await endpoint(t,user({status:'disabled',role:'admin'}),async url=>{const r=await fetch(url+'/me',{headers});assert.equal((await r.json()).user.status,'disabled');},{email:'bootstrap@example.com',emailVerified:true});
 } finally {if(previous===undefined)delete process.env.ACCESS_BOOTSTRAP_ADMIN_EMAIL;else process.env.ACCESS_BOOTSTRAP_ADMIN_EMAIL=previous;}
});
test('server filters data and refuses read-only writes regardless of client UI',async t=>endpoint(t,user({permissions:{mensile:'read'}}),async url=>{
 const data=await (await fetch(url+'/data',{headers})).json();assert.equal(data.state.people[0].phone,undefined);assert.equal(data.activePrograms.domRows,undefined);
 assert.equal((await fetch(url+'/data',{method:'PATCH',headers,body:JSON.stringify({section:'mensile',state:{mensileArchives:[]}})})).status,403);
}));
test('editor cannot write another function or inject account permissions',async t=>endpoint(t,user({role:'editor',permissions:{mensile:'write'}}),async(url,documents)=>{
 assert.equal((await fetch(url+'/data',{method:'PATCH',headers,body:JSON.stringify({section:'anagrafica',state:{people:[]}})})).status,403);
 const r=await fetch(url+'/data',{method:'PATCH',headers,body:JSON.stringify({section:'mensile',state:{mensileArchives:[],people:[],role:'admin'}})});assert.equal(r.status,200);assert.equal(documents.get('congregationData/main').state.people[0].phone,'123');assert.equal(documents.get('accessUsers/member').role,'editor');
}));
