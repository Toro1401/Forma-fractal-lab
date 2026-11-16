// End-to-end regressions and new experiences. All writes target an isolated project copy.
import {spawn} from 'node:child_process';
import {cpSync,mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {resolve,dirname,sep} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import {cpus} from 'node:os';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),temp=mkdtempSync(resolve(root,'.qa-features-'));
mkdirSync(resolve(root,'.qa-browser'),{recursive:true});
cpSync(resolve(root,'dist'),resolve(temp,'dist'),{recursive:true});cpSync(resolve(root,'serve.py'),resolve(temp,'serve.py'));
writeFileSync(resolve(temp,'dist/user-presets.js'),'// Preset personali di Forma. Questo file fa parte del progetto.\nglobalThis.FORMA_USER_PRESETS = {"version":1,"presets":[]};\n');
const server=spawn(process.env.PYTHON_PATH||'python',['-u',resolve(temp,'serve.py'),'--port','0'],{windowsHide:true,stdio:['ignore','pipe','pipe']});
let log='';server.stderr.on('data',c=>log+=c);
const ready=new Promise((ok,fail)=>{const timer=setTimeout(()=>fail(new Error(log||'Server timeout')),15000);server.on('error',e=>{clearTimeout(timer);fail(e);});server.stdout.on('data',c=>{const match=String(c).match(/http:\/\/127\.0\.0\.1:\d+/);if(match){clearTimeout(timer);ok(match[0]);}});});
const child=spawn(process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless','--disable-gpu','--no-first-run','--no-default-browser-check','--user-data-dir='+resolve(temp,'profile'),'--remote-debugging-port=9349','about:blank'],{stdio:'ignore',windowsHide:true});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));let socket;
try{
 const appURL=await ready;let tabs;
 for(let i=0;i<100;i++){try{tabs=await(await fetch('http://127.0.0.1:9349/json/list')).json();break;}catch{await sleep(100);}}
 assert.ok(tabs);socket=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise((ok,fail)=>{socket.addEventListener('open',ok,{once:true});socket.addEventListener('error',fail,{once:true});});
 let id=0;const pending=new Map(),errors=[];
 socket.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);if(!p)return;pending.delete(m.id);m.error?p.reject(new Error(JSON.stringify(m.error))):p.resolve(m.result);}if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text);});
 const cdp=(method,params={})=>new Promise((resolve,reject)=>{const key=++id;pending.set(key,{resolve,reject});socket.send(JSON.stringify({id:key,method,params}));});
 const evaluate=async expression=>{const r=await cdp('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
 const wait=async expression=>{for(let i=0;i<200;i++){if(await evaluate(expression))return;await sleep(60);}throw new Error('Timeout: '+expression);};
 const idle=()=>wait("document.getElementById('renderStatus')?.textContent==='Pronto a esplorare'");
 const click=async id=>{await evaluate(`document.getElementById(${JSON.stringify(id)}).click()`);await idle();};
 const preset=async id=>{await evaluate(`document.querySelector('[data-id="${id}"]').click()`);await idle();};
 const set=async(id,value,event='change')=>{await evaluate(`document.getElementById(${JSON.stringify(id)}).value=${JSON.stringify(String(value))};document.getElementById(${JSON.stringify(id)}).dispatchEvent(new Event(${JSON.stringify(event)},{bubbles:true}));`);await idle();};
 const project=()=>evaluate('FormaApp.getProject()');
 const reload=async()=>{const time=await evaluate('performance.timeOrigin');await cdp('Page.reload');await wait(`performance.timeOrigin!==${time}&&!!window.FormaApp`);await evaluate('FormaApp.ready');await idle();};
 const save=async name=>{await click('saveBtn');await evaluate(`document.getElementById('saveName').value=${JSON.stringify(name)};document.getElementById('saveForm').requestSubmit()`);await wait("!document.getElementById('saveDialog').open");await idle();};
 await cdp('Runtime.enable');await cdp('Page.enable');await cdp('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});await cdp('Page.navigate',{url:appURL});await wait('!!window.FormaApp');await evaluate('FormaApp.ready');await idle();
 assert.equal(await evaluate("document.getElementById('generator').getBoundingClientRect().bottom<innerHeight"),true);
 assert.equal(await evaluate("[...document.querySelectorAll('dialog')].every(d=>!!document.getElementById(d.getAttribute('aria-labelledby'))?.textContent)"),true);
 console.log('PASS visible rule editor and named dialogs');
 // Exact measures must survive the checkbox, despite two-decimal display formatting.
 const before=await project();await evaluate("document.querySelector('[data-lock-length=\"0\"]').click()");await click('applyConstraints');const locked=await project();assert.ok(Math.abs(locked.constraints.lengths[0]-1/3)<1e-12);assert.deepEqual(locked.folds,before.folds);assert.deepEqual(locked.endpoint,before.endpoint);
 await set('pointX','0.123456');assert.ok(Math.abs((await project()).folds[1].u-.123456)<1e-12);
 console.log('PASS exact locking and unrounded coordinate input');
 await preset('koch');await save('Alpha');await preset('levy');await save('Beta');
 const recordIds=await evaluate("Object.fromEntries(FormaApp.library.records.map(r=>[r.project.name,r.id]))");
 await preset(recordIds.Alpha);await preset(recordIds.Beta);await click('undoBtn');await click('saveBtn');assert.equal(await evaluate("document.getElementById('saveName').value"),'Alpha');assert.equal(await evaluate("document.getElementById('saveMode').value"),'update');await evaluate("document.getElementById('saveForm').requestSubmit()");await wait("!document.getElementById('saveDialog').open");
 assert.equal(await evaluate("FormaApp.library.records.find(r=>r.project.name==='Beta').project.folds.length"),1);await reload();assert.equal(await evaluate("document.getElementById('creationName').textContent"),'Alpha');
 console.log('PASS undo restores the preset update destination and draft context');
 await preset('koch-snowflake');assert.equal((await project()).composition.kind,'polygon');assert.equal(await evaluate('FormaApp.getGeometry().count'),3072);await save('Contorno chiuso');await reload();assert.equal((await project()).composition.count,3);
 await set('compositionKind','radial');await set('compositionCount',6);await click('compositionReflect');assert.equal(await evaluate('FormaApp.getGeometry().count'),12288);await click('undoBtn');assert.equal((await project()).composition.reflect,false);
 await preset('linked-tree');await evaluate("document.querySelector('[data-branch-angle=\"0\"]').value=41;document.querySelector('[data-branch-angle=\"0\"]').dispatchEvent(new Event('change'))");await idle();assert.equal((await project()).branches[1].angle,-41);
 await preset('wind-tree');const wind=await evaluate('Array.from(FormaApp.getGeometry().segments.slice(0,200))');await save('Crescita riproducibile');await reload();assert.deepEqual(await evaluate('Array.from(FormaApp.getGeometry().segments.slice(0,200))'),wind);
 console.log('PASS polygon/radial composition, linked branches and reproducible growth');
 await preset('elbow-dragon');await set('transformKind','reflect');await set('transformAngle',45);assert.equal(await evaluate('FormaApp.getGeometry().overlap'),true);assert.ok(await evaluate("document.getElementById('foldNotice').textContent.includes('sovrappongono')"));
 const axisHandle=await evaluate("(()=>{const c=document.getElementById('generator');c.scrollIntoView({block:'center'});const r=c.getBoundingClientRect(),w=r.width,h=r.height,scale=Math.min(w-76,h-76),x=w/2+scale/2,y=h/2-scale/2;return {x:r.x+x+30/Math.sqrt(2),y:r.y+y-30/Math.sqrt(2),targetX:r.x+x+35,targetY:r.y+y+20};})()");await cdp('Input.dispatchMouseEvent',{type:'mousePressed',x:axisHandle.x,y:axisHandle.y,button:'left',clickCount:1});await cdp('Input.dispatchMouseEvent',{type:'mouseMoved',x:axisHandle.targetX,y:axisHandle.targetY,button:'left',buttons:1});await cdp('Input.dispatchMouseEvent',{type:'mouseReleased',x:axisHandle.targetX,y:axisHandle.targetY,button:'left',clickCount:1});await idle();assert.ok((await project()).transformAngle<0);
 await preset('sequence-fold');await click('addSequenceStep');assert.equal((await project()).foldSequence.length,4);await save('Sequenza personale');await reload();assert.equal((await project()).foldSequence.length,4);
 await preset('ifs-triangle');await set('ifs-0-x',.1);await save('Copie personali');await reload();assert.equal((await project()).ifs.transforms[0].x,.1);
 await set('ifsEditorMode','copies');const copyHandle=await evaluate("(()=>{const c=document.getElementById('generator');c.scrollIntoView({block:'center'});const r=c.getBoundingClientRect(),p=FormaApp.getProject(),g=FractalEngine.generateProject({...p,iterations:1},4096),f=FractalRenderer.fit(g.bounds,r.width,r.height,.72),t=p.ifs.transforms[0];return {x:r.x+(t.x-f.x)*f.scale+r.width/2,y:r.y+r.height/2-(t.y-f.y)*f.scale};})()");await cdp('Input.dispatchMouseEvent',{type:'mousePressed',x:copyHandle.x,y:copyHandle.y,button:'left',clickCount:1});await cdp('Input.dispatchMouseEvent',{type:'mouseMoved',x:copyHandle.x+15,y:copyHandle.y-10,button:'left',buttons:1});await cdp('Input.dispatchMouseEvent',{type:'mouseReleased',x:copyHandle.x+15,y:copyHandle.y-10,button:'left',clickCount:1});await idle();assert.ok((await project()).ifs.transforms[0].x>.1);
 await preset('ls-hilbert');await set('lsAngle',85);await save('Grammatica personale');await reload();assert.equal((await project()).lsystem.angle,85);const good=(await project()).lsystem.axiom;await set('lsAxiom','F]');assert.equal((await project()).lsystem.axiom,good);
 console.log('PASS reflection feedback, sequences, IFS and L-system file persistence');
 // Camera fixed mode must preserve all camera coordinates while geometry changes.
 await preset('tree');await set('cameraMode','fixed');const camera=await evaluate('FormaApp.getCamera()');await click('nextIteration');assert.deepEqual(await evaluate('FormaApp.getCamera()'),camera);await set('cameraMode','adaptive');
 await click('nextLayer');await sleep(100);const withNext=await evaluate("document.getElementById('fractal').toDataURL()");await click('nextLayer');await sleep(100);assert.notEqual(await evaluate("document.getElementById('fractal').toDataURL()"),withNext);
 await set('structureColor','family');assert.equal((await project()).structureColor,'family');
 // Starting playback must not invoke the main-thread geometry engine.
 await preset('koch');await set('animationSpeed',150);await evaluate("window.__engine=FractalEngine.generateProject;FractalEngine.generateProject=()=>{throw new Error('Unexpected main-thread generation')}");await click('playBtn');await sleep(220);await click('playBtn');const paused=await project();assert.ok(paused.iterations<5);await evaluate('FractalEngine.generateProject=window.__engine');await click('playBtn');await wait("document.getElementById('playBtn').getAttribute('aria-pressed')==='false'");assert.equal((await project()).iterations,5);
 console.log('PASS fixed camera, next-level preview, structural colors and worker-only playback with resume');
 // Comparison and morph are user-visible operations, followed by ordinary undo.
 await click('varyBtn');assert.equal(await evaluate("document.querySelectorAll('.variant-card').length"),4);await click('chooseVariant0');await click('undoBtn');await click('varyBtn');await click('morphVariant1');await wait("document.getElementById('cancelTransition').hidden");assert.ok((await project()).name.includes('variante'));await idle();
 console.log('PASS protected variations, comparison, selection and animated transition');
 // Backup restore is atomic and does not overwrite a collision with different content.
 const backup=await evaluate('FormaApp.library.backup()'),count=await evaluate('FormaApp.library.records.length');
 await evaluate("(async()=>{const record=FormaApp.library.records[0];await FormaApp.library.remove(record.id)})()");await click('galleryBtn');assert.equal(await evaluate('FormaApp.library.trash.length'),1);await click('restoreLastDeleted');await wait(`FormaApp.library.records.length===${count}`);
 await evaluate(`window.__backup=${JSON.stringify(backup)}`);const imported=await evaluate('FormaApp.library.importBackup(window.__backup)');assert.ok(imported<=1);const stable=await evaluate('JSON.stringify(FormaApp.library.backup().records)');
 await evaluate("try{FormaApp.library.importBackup({format:'forma-library',version:1,records:[{id:'bad',project:{}}]})}catch{window.__badBackupRejected=true}");assert.equal(await evaluate('window.__badBackupRejected'),true);assert.equal(await evaluate('JSON.stringify(FormaApp.library.backup().records)'),stable);
 await evaluate("document.getElementById('galleryDialog').close()");console.log('PASS unified collection, persistent trash, recovery and atomic backup merge');
 // Transparent exports and configurable dimensions use the actual project colors.
 await preset('ifs-carpet');await evaluate("window.__downloads=[];window.__blobs=new Map();const create=URL.createObjectURL.bind(URL);URL.createObjectURL=b=>{const url=create(b);window.__blobs.set(url,b);return url;};HTMLAnchorElement.prototype.click=function(){window.__downloads.push({name:this.download,url:this.href});}");
 await click('exportBtn');await set('exportWidth',640);await set('exportHeight',480);await click('exportTransparent');await click('exportSvg');
 const svg=await evaluate("(async()=>{const text=await window.__blobs.get(window.__downloads[0].url).text(),doc=new DOMParser().parseFromString(text,'image/svg+xml');return {width:doc.documentElement.getAttribute('width'),rect:!!doc.querySelector('rect'),filled:doc.querySelectorAll('path[stroke=none]').length,error:!!doc.querySelector('parsererror')};})()");assert.equal(svg.width,'640');assert.equal(svg.rect,false);assert.equal(svg.error,false);assert.ok(svg.filled>0);
 await click('exportPng');await wait('window.__downloads.length===2');const png=await evaluate("(async()=>{const image=await createImageBitmap(window.__blobs.get(window.__downloads[1].url)),c=document.createElement('canvas');c.width=image.width;c.height=image.height;const ctx=c.getContext('2d');ctx.drawImage(image,0,0);return {width:image.width,height:image.height,alpha:ctx.getImageData(0,0,1,1).data[3]};})()");assert.deepEqual(png,{width:640,height:480,alpha:0});await evaluate("document.getElementById('exportDialog').close()");
 console.log('PASS transparent PNG/SVG, configurable dimensions and filled IFS export');
 if(!await evaluate("document.getElementById('exportVideo').hidden")){await preset('koch');await set('iterations',3,'input');await click('exportBtn');await click('exportVideo');await wait("window.__downloads.some(d=>d.name.endsWith('.webm'))");assert.ok(await evaluate("window.__blobs.get(window.__downloads.find(d=>d.name.endsWith('.webm')).url).size>100"));console.log('PASS recorded WebM growth animation');}
 // Small screens expose the rule panel and can dedicate the whole viewport to the result.
 await cdp('Emulation.setDeviceMetricsOverride',{width:390,height:700,deviceScaleFactor:1,mobile:true});await sleep(150);assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true);await click('settingsToggle');assert.equal(await evaluate("getComputedStyle(document.querySelector('.controls')).display"),'none');await click('settingsToggle');
 writeFileSync(resolve(root,'.qa-browser/features-mobile.png'),Buffer.from((await cdp('Page.captureScreenshot',{format:'png'})).data,'base64'));
 await cdp('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});await sleep(100);
 await preset('koch-snowflake');writeFileSync(resolve(root,'.qa-browser/features-desktop.png'),Buffer.from((await cdp('Page.captureScreenshot',{format:'png'})).data,'base64'));
 await preset('elbow-dragon');await evaluate("window.__detailStart=performance.now();document.getElementById('iterations').value=20;document.getElementById('iterations').dispatchEvent(new Event('input'))");await idle();const detailMs=await evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r(performance.now()-window.__detailStart))))');const zoomSamples=[];for(let i=0;i<3;i++)zoomSamples.push(await evaluate("new Promise(r=>{const start=performance.now();document.getElementById('zoomIn').click();requestAnimationFrame(()=>requestAnimationFrame(()=>r(performance.now()-start)));})"));const performanceReport={environment:'Chromium headless, GPU disabled',cpu:cpus()[0]?.model,segments:await evaluate('FormaApp.getGeometry().count'),detailMs,zoomSamplesMs:zoomSamples};writeFileSync(resolve(root,'.qa-browser/performance.json'),JSON.stringify(performanceReport,null,2));console.log('PERFORMANCE',JSON.stringify(performanceReport));
 // Static/file use can save locally and reopen without the Python API.
 await cdp('Page.navigate',{url:pathToFileURL(resolve(temp,'dist/index.html')).href});await wait('!!window.FormaApp');await evaluate('FormaApp.ready');await idle();await preset('ifs-triangle');await save('Offline nel browser');await reload();assert.equal(await evaluate("FormaApp.library.records.some(r=>r.project.name==='Offline nel browser'&&r.source==='browser')"),true);
 assert.deepEqual(errors,[]);console.log('PASS mobile controls, static/file browser persistence and no uncaught exceptions');
 await cdp('Browser.close');socket.close();socket=null;
}finally{
 if(socket)socket.close();child.kill();server.kill();await Promise.all([child,server].map(p=>new Promise(ok=>{if(p.exitCode!==null)return ok();p.once('close',ok);})));if(!temp.startsWith(root+sep+'.qa-features-'))throw new Error('Invalid cleanup path');rmSync(temp,{recursive:true,force:true,maxRetries:10,retryDelay:100});
}
