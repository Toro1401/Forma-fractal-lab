'use strict';
const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),{webcrypto}=require('node:crypto'),E=require('../dist/generators.js'),C=require('../dist/constraints.js');
const source=fs.readFileSync(require.resolve('../dist/library.js'),'utf8');
function environment(seed={}){const data=new Map(Object.entries(seed)),storage={getItem:k=>data.get(k)??null,setItem(k,value){if(storage.fail)throw new Error('quota');data.set(k,String(value));}};const context=vm.createContext({localStorage:storage,crypto:webcrypto,location:{protocol:'file:',hostname:''},FractalConstraints:C,fetch:()=>{throw new Error('Unexpected network access');}});vm.runInContext(source,context);return {Library:context.FormaLibrary,storage,data};}
const project=name=>E.upgradeProject(E.validateProject({version:1,name,folds:[{u:.5,v:.5}],iterations:5}));
(async()=>{
 const old=project('Precedente'),file={id:'custom-'+'a'.repeat(32),project:project('File')},env=environment({'forma.gallery.v1':JSON.stringify([{id:'legacy',project:old}])});let library=new env.Library(E,{version:1,presets:[file]});await library.initialize();assert.equal(library.records.length,2);assert.ok(env.data.has('forma.gallery.v1'));
 const localId=await library.save(project('Locale'));assert.equal(library.records.length,3);assert.equal(library.records.find(r=>r.id===localId).source,'browser');
 await library.remove(localId);assert.equal(library.trash.length,1);library=new env.Library(E,{version:1,presets:[file]});await library.initialize();assert.equal(library.trash.length,1);await library.restore(localId);assert.equal(library.records.length,3);assert.equal(library.trash.length,0);
 const backup=JSON.parse(JSON.stringify(library.backup()));assert.equal(library.importBackup(backup),0);
 const collision=JSON.parse(JSON.stringify(backup));collision.records[0].project.name='Conserva entrambe';assert.equal(library.importBackup(collision),1);assert.ok(library.records.some(r=>r.project.name==='File'));assert.ok(library.records.some(r=>r.project.name==='Conserva entrambe'));
 const before=env.data.get('forma.library.v2');assert.throws(()=>library.importBackup({format:'forma-library',version:1,records:[{id:'bad',project:{}}]}));assert.equal(env.data.get('forma.library.v2'),before);
 env.storage.fail=true;await assert.rejects(()=>library.save(project('Quota')),/esaurito/);assert.equal(env.data.get('forma.library.v2'),before);assert.equal(library.records.some(r=>r.project.name==='Quota'),false);env.storage.fail=false;
 const broken=environment({'forma.library.v2':'{damaged'}),readonly=new broken.Library(E,{version:1,presets:[file]});await readonly.initialize();await assert.rejects(()=>readonly.save(project('Unsafe')));assert.equal(broken.data.get('forma.library.v2'),'{damaged');
 console.log('Unified library migration, static saving, persistent trash, backup collisions, atomic failures and corrupt-store preservation passed.');
})().catch(error=>{console.error(error);process.exitCode=1;});
