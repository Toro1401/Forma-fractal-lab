/* Forma: buildless, local-first fractal playground. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const clone = value => JSON.parse(JSON.stringify(value));
  const E = window.FractalEngine;
  const C = window.FractalConstraints;
  function validatedProject(data){const project=E.upgradeProject(data);if(['polyline','free'].includes(project.mode)){const check=C.check(project.folds,project.endpoint,project.constraints,1e-5,project.origin);if(!check.ok)throw new Error(check.message);}return project;}
  const {presets,projectForPreset}=window.FormaPresets;
  const palettes = {
    lime:{label:'Lime',stops:['#769b5a','#c9ef80','#e9ffd0']},
    aurora:{label:'Aurora',stops:['#75e5cc','#94b3fa','#db8bdd']},
    ocean:{label:'Oceano',stops:['#387caf','#6ed8dc','#cdf2da']},
    ember:{label:'Brace',stops:['#f47872','#f3b06a','#f4e8a4']},
    chalk:{label:'Gesso',stops:['#a9b9a7','#f1f2e7','#a9b9a7']}
  };
  const storage = {draft:'forma.draft.v1',gallery:'forma.gallery.v1'};
  let state = validatedProject({version:1,name:'Curva di Koch',folds:clone(presets[0].folds),iterations:5,mirror:false,palette:'lime',lineWidth:1.3});
  let selectedPreset = 'koch', selected = 1, grid = true;
  let geometry = E.generateProject(state);
  let rasterCache=null,rasterPending=null,rasterQueued=null,rasterSerial=0,rasterTimer=null,rasterSupported=typeof OffscreenCanvas!=='undefined';
  let branchPathCache=new Map();
  let geometryKey = '', busy = false, queued = null, worker = null, needsFit = true;
  let showPrevious=false,showNext=false,adaptiveCamera=true,previousGeometry=null,nextGeometry=null,ghostColor='#90a4ae',ghostWidth=10,zoomFactor=1;
  try{const v=JSON.parse(localStorage.getItem('forma.view.v1')||'{}');showPrevious=v.showPrevious===true;showNext=v.showNext===true;adaptiveCamera=v.adaptiveCamera!==false;if(/^#[0-9a-f]{6}$/i.test(v.ghostColor))ghostColor=v.ghostColor;if(Number.isFinite(v.ghostWidth))ghostWidth=Math.max(5,Math.min(100,Math.round(v.ghostWidth/5)*5));if(Number.isFinite(v.zoomFactor)&&v.zoomFactor>0&&v.zoomFactor<1e6)zoomFactor=v.zoomFactor;}catch{}
  function persistView(){try{localStorage.setItem('forma.view.v1',JSON.stringify({showPrevious,showNext,adaptiveCamera,ghostColor,ghostWidth,zoomFactor}));}catch{}}
  const sliderPercent=(value,max)=>Math.max(0,Math.min(100,Math.round(value/max*20)*5));
  const iterationLimit=()=>state.mode==='branches'?32:state.mode==='free'?20:10;
  function syncSliders(){$('iterations').max=iterationLimit();$('iterations').value=state.iterations;$('iterationValue').textContent=`${state.iterations} iter.`;$('lineWidth').value=Math.max(5,sliderPercent(state.lineWidth,12));$('widthValue').textContent=`${$('lineWidth').value}%`;$('taper').value=sliderPercent(state.taper,1.5);$('taperValue').textContent=`${$('taper').value}%`;}


  let frame = 0, toastTimer, saveTimer, animation = null;
  const projectHistory=new window.ProjectHistory();
  let experience=null;
  let userPresets=[],editingPresetId=null,savingPreset=false;
  const camera = {x:.5,y:.1,scale:400};
  const canvas = $('fractal'), ctx = canvas.getContext('2d');
  const gen = $('generator'), gctx = gen.getContext('2d');
  let viewport = {w:1,h:1,dpr:1}, editor = {w:1,h:1,dpr:1,pad:30,scale:200};
  let dragging = false, dragChanged = false;
  let arrowTargets=[], constraintDraft=null, constraintDraftDirty=false;
  const pointers = new Map();
  let gesture = null;
  try {const draft = localStorage.getItem(storage.draft); if(draft){state = validatedProject(JSON.parse(draft));selectedPreset=presets.find(p=>JSON.stringify(projectForPreset(p))===JSON.stringify(state))?.id||'';}} catch { /* An unavailable store does not prevent exploration. */ }
  try{const context=JSON.parse(localStorage.getItem('forma.draft-context.v1')||'{}');editingPresetId=typeof context.editingPresetId==='string'?context.editingPresetId:null;selectedPreset=context.selectedPreset||selectedPreset;}catch{}
  const library=new window.FormaLibrary(E,globalThis.FORMA_USER_PRESETS);
  let libraryReady=library.initialize().then(()=>{userPresets=library.records;if(editingPresetId&&!userPresets.some(r=>r.id===editingPresetId))editingPresetId=null;renderCustomPresets();updateGalleryCount();if(library.error)toast(library.error);experience?.syncLibrary();});

  function fitFor(bounds,w,h,padding=.76) {
    return {x:(bounds.minX+bounds.maxX)/2,y:(bounds.minY+bounds.maxY)/2,scale:Math.min(w*padding/Math.max(.05,bounds.maxX-bounds.minX),h*padding/Math.max(.12,bounds.maxY-bounds.minY))};
  }
  function cameraFit(){return fitFor(geometry.bounds,Math.max(40,viewport.w-32),Math.max(40,viewport.h-150),.88);}
  function reframe(){const c=cameraFit();Object.assign(camera,c,{scale:c.scale*zoomFactor});}
  function fit(){zoomFactor=1;reframe();updateZoom();scheduleRender();}
  function paint(target,w,h,view,options={}){window.FractalRenderer.draw(target,w,h,view,geometry,state,options);}
  function renderGrid() {
    const {w,h}=viewport;
    const raw=65/camera.scale, power=Math.pow(10,Math.floor(Math.log10(raw))), step=Math.ceil(raw/power)*power;
    const left=camera.x-w/2/camera.scale,bottom=camera.y-h/2/camera.scale;
    ctx.lineWidth=1;ctx.strokeStyle=isLightBackground()?'#7a8a7c':'#263127';ctx.beginPath();
    for(let i=0,count=Math.min(256,Math.ceil(w/(step*camera.scale))+2);i<count;i++){const x=(Math.ceil(left/step)+i)*step,sx=(x-camera.x)*camera.scale+w/2;ctx.moveTo(sx,0);ctx.lineTo(sx,h);}
    for(let i=0,count=Math.min(256,Math.ceil(h/(step*camera.scale))+2);i<count;i++){const y=(Math.ceil(bottom/step)+i)*step,sy=h/2-(y-camera.y)*camera.scale;ctx.moveTo(0,sy);ctx.lineTo(w,sy);}
    ctx.globalAlpha=.47;ctx.stroke();ctx.globalAlpha=1;
    const sx=-camera.x*camera.scale+w/2,sy=h/2+camera.y*camera.scale;
    ctx.strokeStyle='#3b4637';ctx.setLineDash([3,6]);ctx.beginPath();ctx.moveTo(sx,0);ctx.lineTo(sx,h);ctx.moveTo(0,sy);ctx.lineTo(w,sy);ctx.stroke();ctx.setLineDash([]);
  }
  function render() {
    frame=0;const {w,h,dpr}=viewport;ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle=state.background;ctx.fillRect(0,0,w,h);
    if(state.background==='#111515'){const glow=ctx.createRadialGradient(w*.48,h*.43,0,w*.48,h*.43,Math.max(w,h)*.65);glow.addColorStop(0,'#23312555');glow.addColorStop(1,'#11151500');ctx.fillStyle=glow;ctx.fillRect(0,0,w,h);}
    if(grid)renderGrid();
    if(heavyScene())paintRaster();else{
      if(showPrevious)window.FractalRenderer.overlay(ctx,w,h,camera,previousGeometry,ghostColor,ghostWidth*.12,{alpha:.3});
      if(showNext)window.FractalRenderer.overlay(ctx,w,h,camera,nextGeometry,'#f6bc7d',1.4,{alpha:.45});
      paint(ctx,w,h,camera,{background:false});
    }
  }
  function heavyScene(){return geometry.count>65536||(showNext&&nextGeometry?.count>65536)||(showPrevious&&previousGeometry?.count>65536);}
  function rasterKey(){return E.geometryKey(state)+JSON.stringify([state.colorMode,state.colorStart,state.colorMiddle,state.colorEnd,state.lineWidth,state.taper,state.structureColor,showPrevious,showNext,ghostColor,ghostWidth]);}
  function rasterJob(){return {type:'raster',id:++rasterSerial,key:rasterKey(),project:clone(state),view:{...camera},w:viewport.w,h:viewport.h,dpr:viewport.dpr,ghostColor,ghostWidth};}
  function sameRaster(a,b){return a&&b&&a.key===b.key&&a.w===b.w&&a.h===b.h&&a.dpr===b.dpr&&a.view.x===b.view.x&&a.view.y===b.view.y&&a.view.scale===b.view.scale;}
  function postRaster(job){if(worker&&rasterSupported){rasterPending=job;worker.postMessage(job);}else{
      const c=document.createElement('canvas');c.width=Math.round(job.w*job.dpr);c.height=Math.round(job.h*job.dpr);const target=c.getContext('2d');target.setTransform(job.dpr,0,0,job.dpr,0,0);
      if(showPrevious)window.FractalRenderer.overlay(target,job.w,job.h,job.view,previousGeometry,ghostColor,ghostWidth*.12,{alpha:.3});if(showNext)window.FractalRenderer.overlay(target,job.w,job.h,job.view,nextGeometry,'#f6bc7d',1.4,{alpha:.45});paint(target,job.w,job.h,job.view,{background:false});rasterCache?.bitmap?.close?.();rasterCache={...job,bitmap:c};if(!busy)$('renderStatus').textContent='Pronto a esplorare';
    }}
  function receiveRaster(data){
    if(!rasterPending||data.id!==rasterPending.id){data.bitmap?.close();return;}
    rasterPending=null;
    if(data.error){rasterSupported=false;rasterQueued=null;scheduleRender();return;}
    if(!data.cancelled){rasterCache?.bitmap?.close?.();rasterCache=data;}
    if(rasterQueued){const latest=rasterQueued;rasterQueued=null;postRaster(latest);}
    else if(!busy)$('renderStatus').textContent='Pronto a esplorare';scheduleRender();
  }
  function paintRaster(){
    const desired=rasterJob(),cache=rasterCache;
    if(!busy&&!sameRaster(cache,desired)){
      if(!cache||cache.key!==desired.key){if(!rasterPending)postRaster(desired);else if(!sameRaster(rasterPending,desired))rasterQueued=desired;}
      else if(!rasterPending&&!rasterTimer){rasterTimer=setTimeout(()=>{rasterTimer=null;if(!busy&&heavyScene()){const job=rasterJob();if(rasterPending)rasterQueued=job;else postRaster(job);}},90);}
      else if(rasterPending&&!sameRaster(rasterPending,desired))rasterQueued=desired;
    }
    const image=rasterCache;if(image){const scale=camera.scale/image.view.scale,x=viewport.w/2+(image.view.x-camera.x)*camera.scale-image.w*scale/2,y=viewport.h/2-(image.view.y-camera.y)*camera.scale-image.h*scale/2;ctx.drawImage(image.bitmap,x,y,image.w*scale,image.h*scale);}
  }
  function scheduleRender(){if(!frame)frame=requestAnimationFrame(render);}
  function applyGeometry(result) {
    geometry=result;branchPathCache.clear();
    $('segmentCount').textContent=result.count.toLocaleString('it-IT');
    $('multiplier').textContent=state.mode==='branches'?`+${state.branches.length} rami`:state.mode==='free'?'×2':state.mode==='ifs'?`×${state.ifs.transforms.length}`:state.mode==='lsystem'?'Regole':`×${state.folds.length+1}`;
    $('renderStatus').textContent=heavyScene()&&worker&&rasterSupported?'Disegno in corso…':'Pronto a esplorare';
    const limited=result.iterations<state.iterations;
    $('complexityNotice').hidden=!limited;
    const suggestion={polyline:'Riduci i punti, i lati o i bracci per esplorare più livelli.',branches:'Riduci i rami o aumenta la lunghezza minima per esplorare più livelli.',free:'Semplifica il motivo iniziale per esplorare più piegature.',ifs:'Riduci il numero di copie o semplifica la forma iniziale.',lsystem:'Abbrevia le produzioni per esplorare più generazioni.'}[state.mode];
    $('complexityNotice').textContent=`Dettaglio adattato a ${result.iterations} iterazioni (${result.count.toLocaleString('it-IT')} segmenti). ${suggestion}`;
    if(result.stopped==='threshold')$('complexityNotice').textContent=`Crescita completa a ${result.iterations} livelli: i rami successivi sono sotto la lunghezza minima. Abbassa la soglia per continuare.`;
    if(result.count===0){$('complexityNotice').hidden=false;$('complexityNotice').textContent='Questo livello non contiene tratti da disegnare. Aumenta le generazioni o aggiungi F o G alla grammatica.';}
    syncSliders();if(limited)$('iterationValue').textContent+=` / ${result.iterations} effettive`;
    if(adaptiveCamera||needsFit)reframe();needsFit=false;updateZoom();scheduleRender();experience?.geometryReady(result);
  }
  let jobSerial=0,activeJob=0,activeStarted=0;
  function createWorker(){try{worker=new Worker('worker.js?v=20261113-1');worker.onmessage=e=>{if(e.data.type==='raster'){receiveRaster(e.data);return;}if(e.data.id!==activeJob)return;e.data.error?failJob(new Error(e.data.error)):finishJob(e.data);};worker.onerror=()=>{worker?.terminate();worker=null;rasterPending=null;rasterQueued=null;busy=false;queued=null;geometryKey='';requestGeometry();};}catch{worker=null;}}
  function sendJob(project){
    busy=true;activeStarted=performance.now();const id=++jobSerial;activeJob=id;$('renderStatus').textContent='La forma sta nascendo…';
    const job={id,project,previous:showPrevious,next:showNext};
    if(worker)worker.postMessage(job);
    else setTimeout(()=>{if(id!==activeJob)return;try{const geometry=E.generateProject(project),bundle={id,geometry};if(showPrevious&&geometry.iterations>0)bundle.previous=E.generateProject({...project,iterations:geometry.iterations-1});if(showNext&&geometry.iterations===project.iterations&&geometry.iterations<iterationLimit()){const candidate=E.generateProject({...project,iterations:geometry.iterations+1});if(candidate.iterations>geometry.iterations)bundle.next=candidate;}finishJob(bundle);}catch(error){failJob(error);}},0);
  }
  function finishJob(bundle){busy=false;if(queued){const latest=queued;queued=null;sendJob(latest);return;}previousGeometry=bundle.previous??null;nextGeometry=bundle.next??null;applyGeometry(bundle.geometry);}
  function failJob(error){busy=false;geometryKey='';if(queued){const latest=queued;queued=null;sendJob(latest);return;}$('renderStatus').textContent='Calcolo non riuscito';toast(error.message||'Impossibile generare questa forma.');}
  function requestGeometry(autoFit=false){
    needsFit||=autoFit;const key=E.geometryKey(state)+':'+showPrevious+':'+showNext;
    if(key===geometryKey){if(needsFit&&!busy){needsFit=false;reframe();updateZoom();scheduleRender();}return;}
    geometryKey=key;const job=clone(state);
    if(rasterPending&&worker){worker.terminate();worker=null;rasterPending=null;rasterQueued=null;createWorker();}
    if(busy){if(worker&&performance.now()-activeStarted>120){worker.terminate();worker=null;queued=null;busy=false;createWorker();sendJob(job);}else queued=job;}else sendJob(job);
  }
  if(location.protocol!=='file:')createWorker();

  function resize() {
    const r=canvas.getBoundingClientRect(),gr=gen.getBoundingClientRect(),dpr=Math.min(2,window.devicePixelRatio||1);
    viewport={w:Math.max(1,r.width),h:Math.max(1,r.height),dpr};
    if(adaptiveCamera||needsFit)reframe();
    canvas.width=Math.round(viewport.w*dpr);canvas.height=Math.round(viewport.h*dpr);
    editor={w:Math.max(1,gr.width),h:Math.max(1,gr.height),dpr,pad:30,scale:Math.max(1,gr.width-60)};
    canvas.style.width='';canvas.style.height='';gen.width=Math.round(editor.w*dpr);gen.height=Math.round(editor.h*dpr);
    drawGenerator();updateZoom();scheduleRender();
  }
  function editorPos(p){return {x:editor.originX+p.u*editor.scale,y:editor.originY-p.v*editor.scale};}
  function editorWorld(e){const r=gen.getBoundingClientRect(),snap=value=>$('snapPoints')?.checked?Math.round(value*20)/20:value;return {u:Math.max(-1000,Math.min(1000,snap((e.clientX-r.left-editor.originX)/editor.scale))),v:Math.max(-1000,Math.min(1000,snap((editor.originY-e.clientY+r.top)/editor.scale)))};}
  function drawGenerator(){
    if(experience?.drawEditor(gctx,editor,dragging))return;
    if(state.mode==='branches'){drawBranchGenerator();return;}
    const {w,h,dpr}=editor;
    const raw=[state.origin,...state.folds,state.endpoint];
    if(!dragging){const minU=Math.min(...raw.map(p=>p.u)),maxU=Math.max(...raw.map(p=>p.u)),minV=Math.min(...raw.map(p=>p.v)),maxV=Math.max(...raw.map(p=>p.v));editor.scale=Math.min((w-76)/Math.max(.1,maxU-minU),(h-76)/Math.max(.3,maxV-minV));editor.originX=w/2-(minU+maxU)/2*editor.scale;editor.originY=h/2+(maxV+minV)/2*editor.scale;}
    gctx.setTransform(dpr,0,0,dpr,0,0);gctx.clearRect(0,0,w,h);
    gctx.strokeStyle='#232c24';gctx.lineWidth=1;gctx.beginPath();
    const spacing=Math.max(20,editor.scale/4);
    for(let x=((editor.originX%spacing)+spacing)%spacing;x<w;x+=spacing){gctx.moveTo(x,0);gctx.lineTo(x,h);}for(let y=((editor.originY%spacing)+spacing)%spacing;y<h;y+=spacing){gctx.moveTo(0,y);gctx.lineTo(w,y);}gctx.stroke();
    const points=raw.map(editorPos);
    gctx.strokeStyle='#56624c';gctx.setLineDash([3,5]);gctx.beginPath();gctx.moveTo(points[0].x,points[0].y);const reference=points.at(-1);gctx.lineTo(reference.x,reference.y);gctx.stroke();gctx.setLineDash([]);
    gctx.fillStyle='#c9ef800a';gctx.beginPath();points.forEach((p,i)=>i?gctx.lineTo(p.x,p.y):gctx.moveTo(p.x,p.y));gctx.closePath();gctx.fill();
    gctx.strokeStyle='#ed8a80';gctx.lineWidth=1.8;gctx.beginPath();points.forEach((p,i)=>i?gctx.lineTo(p.x,p.y):gctx.moveTo(p.x,p.y));gctx.stroke();
    if(state.mode==='free'&&state.transformKind==='reflect'&&!state.foldSequence.length){const t=editorPos(state.endpoint),a=state.transformAngle*Math.PI/180;gctx.save();gctx.strokeStyle='#e5bc7a';gctx.setLineDash([5,4]);gctx.beginPath();gctx.moveTo(t.x-Math.cos(a)*w,t.y+Math.sin(a)*w);gctx.lineTo(t.x+Math.cos(a)*w,t.y-Math.sin(a)*w);gctx.stroke();gctx.restore();}
    arrowTargets=[];gctx.font='9px ui-monospace,Consolas,monospace';
    for(let i=0;i<points.length-1;i++){
      if(state.mode==='free')continue;
      const a=points[i],b=points[i+1],dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy);if(len<1e-5)continue;
      const sign=state.directions[i],nx=dy/len*sign,ny=-dx/len*sign,mx=(a.x+b.x)/2,my=(a.y+b.y)/2;
      const sx=mx+nx*8,sy=my+ny*8,ex=mx+nx*30,ey=my+ny*30;
      gctx.strokeStyle='#7cbded';gctx.lineWidth=1.6;gctx.beginPath();gctx.moveTo(sx,sy);gctx.lineTo(ex,ey);gctx.moveTo(ex-nx*6-ny*4,ey-ny*6+nx*4);gctx.lineTo(ex,ey);gctx.lineTo(ex-nx*6+ny*4,ey-ny*6-nx*4);gctx.stroke();
      arrowTargets.push({index:i,x:(sx+ex)/2,y:(sy+ey)/2});gctx.fillStyle='#c77d75';gctx.fillText(`S${i+1}`,mx-nx*13-5,my-ny*13+3);
    }
    for(let i=1;i<points.length-1;i++){const p=points[i],a=points[i-1],b=points[i+1],start=Math.atan2(a.y-p.y,a.x-p.x),end=Math.atan2(b.y-p.y,b.x-p.x),delta=Math.atan2(Math.sin(end-start),Math.cos(end-start));const radius=Math.min(16,Math.hypot(a.x-p.x,a.y-p.y)*.25,Math.hypot(b.x-p.x,b.y-p.y)*.25);if(radius>2){gctx.strokeStyle='#a7d86b';gctx.lineWidth=1.3;gctx.beginPath();gctx.arc(p.x,p.y,radius,start,start+delta,delta<0);gctx.stroke();}}
    points.forEach((p,i)=>{const endpoint=i===0||i===points.length-1,active=i===selected+1;gctx.beginPath();gctx.arc(p.x,p.y,active?6:4.5,0,Math.PI*2);gctx.fillStyle=active?'#ffc2b9':endpoint?'#a8b6a3':'#ed8a80';gctx.fill();if(active){gctx.beginPath();gctx.arc(p.x,p.y,10,0,Math.PI*2);gctx.strokeStyle='#ee8a8055';gctx.lineWidth=1;gctx.stroke();}gctx.fillStyle=endpoint?'#a8b6a3':'#e9a59d';gctx.fillText(i===0?'A':i===points.length-1?'B':`P${i}`,p.x+9,p.y-9);});
  }
  function branchHandles(){
    const b=state.endpoint;
    return state.branches.map(rule=>{const a=rule.angle*Math.PI/180,start={u:b.u*rule.attach,v:b.v*rule.attach};return {start,end:{u:start.u+(b.u*Math.cos(a)-b.v*Math.sin(a))*rule.ratio,v:start.v+(b.u*Math.sin(a)+b.v*Math.cos(a))*rule.ratio}};});
  }
  function drawBranchGenerator(){
    const {w,h,dpr}=editor,handles=branchHandles(),raw=[state.origin,state.endpoint,...handles.flatMap(p=>[p.start,p.end])];
    if(!dragging){const us=raw.map(p=>p.u),vs=raw.map(p=>p.v),minU=Math.min(...us),maxU=Math.max(...us),minV=Math.min(...vs),maxV=Math.max(...vs);editor.scale=Math.min((w-76)/Math.max(.1,maxU-minU),(h-76)/Math.max(.3,maxV-minV));editor.originX=w/2-(minU+maxU)/2*editor.scale;editor.originY=h/2+(minV+maxV)/2*editor.scale;}
    gctx.setTransform(dpr,0,0,dpr,0,0);gctx.clearRect(0,0,w,h);gctx.font='10px ui-monospace,Consolas,monospace';arrowTargets=[];
    const line=(a,b,color,width=1.5)=>{a=editorPos(a);b=editorPos(b);gctx.strokeStyle=color;gctx.lineWidth=width;gctx.beginPath();gctx.moveTo(a.x,a.y);gctx.lineTo(b.x,b.y);gctx.stroke();};
    line(state.origin,state.endpoint,'#ed8a80',2.5);
    handles.forEach((p,i)=>{line(p.start,p.end,selected===i+1?'#ffc2b9':'#7cbded',2);const s=editorPos(p.start),e=editorPos(p.end),angle=-Math.atan2(state.endpoint.v,state.endpoint.u),turn=-state.branches[i].angle*Math.PI/180;gctx.strokeStyle='#a7d86b';gctx.lineWidth=1;gctx.beginPath();gctx.arc(s.x,s.y,13+i*3,angle,angle+turn,turn<0);gctx.stroke();gctx.fillStyle='#a7d86b';gctx.fillText(`${Number(state.branches[i].angle.toFixed(1))}°`,(s.x+e.x)/2+5,(s.y+e.y)/2);});
    [state.origin,state.endpoint,...handles.map(p=>p.end)].forEach((p,i)=>{const s=editorPos(p),active=i>0&&selected===i-1;gctx.beginPath();gctx.arc(s.x,s.y,active?6:4.5,0,Math.PI*2);gctx.fillStyle=active?'#ffc2b9':i<2?'#a8b6a3':'#7cbded';gctx.fill();gctx.fillStyle='#c9d3c7';gctx.fillText(i===0?'A':i===1?'B':`R${i-1}`,s.x+9,s.y-9);});
  }
  function syncPoint() {
    if(state.mode==='branches'){
      selected=Math.max(0,Math.min(state.branches.length,selected));
      $('pointSelect').replaceChildren(new Option('B · tronco','0'),...state.branches.map((_,i)=>new Option(`R${i+1}`,String(i+1))));$('pointSelect').value=selected;
      const point=selectedPoint();$('pointX').value=Number(point.u.toFixed(2));$('pointY').value=Number(point.v.toFixed(2));
      $('foldCount').textContent=`${state.branches.length} ${state.branches.length===1?'ramo figlio':'rami figli'}`;$('addFold').disabled=state.branches.length>=8;$('removeFold').disabled=selected===0||state.branches.length<=1;
      $('originValue').textContent='(0, 0)';$('endpointValue').textContent=`(${Number(state.endpoint.u.toFixed(2))}, ${Number(state.endpoint.v.toFixed(2))})`;
      document.querySelectorAll('.branch-card').forEach((card,i)=>card.classList.toggle('active',selected===i+1));return;
    }
    selected=Math.max(0,Math.min(state.folds.length,selected));
    $('pointSelect').replaceChildren(...state.folds.map((_,i)=>new Option(`P${i+1}`,String(i))),new Option('B',String(state.folds.length)));$('pointSelect').value=selected;
    const point=selectedPoint();$('pointX').value=Number(point.u.toFixed(2));$('pointY').value=Number(point.v.toFixed(2));
    $('foldCount').textContent=`${state.folds.length} ${state.folds.length===1?'punto':'punti'} di piega`;
    $('addFold').disabled=state.folds.length>=8;$('removeFold').disabled=state.folds.length<=1||selected<0||selected===state.folds.length;
    $('originValue').textContent=`(${Number(state.origin.u.toFixed(2))}, ${Number(state.origin.v.toFixed(2))})`;
    $('endpointValue').textContent=`(${Number(state.endpoint.u.toFixed(2))}, ${Number(state.endpoint.v.toFixed(2))})`;
  }
  function syncUI() {
    const branching=state.mode==='branches';$('generatorMode').value=state.mode;$('globalControls').hidden=state.mode!=='free';$('mirror').closest('.toggle-row').hidden=state.mode==='free';document.querySelector('.legend-directions').hidden=state.mode==='free';$('polylineRules').dataset.mode=state.mode;$('transformKind').value=state.transformKind;$('transformAngle').value=Number(state.transformAngle.toFixed(2));$('polylineRules').hidden=branching;$('branchRules').hidden=!branching;
    $('editorHint').textContent=state.mode==='free'?'La copia si aggancia al terminale e diventa il nuovo estremo. Angoli positivi: antiorario.':branching?'A è fisso. Trascina B per il tronco o R1, R2… per angoli e proporzioni dei rami.':'Ordine A → P1 → P2 → … → B, anche tornando indietro su X.';
    $('addFold').textContent=branching?'+ Ramo':'+ Punto';$('removeFold').textContent=branching?'− Ramo':'− Punto';$('removeFold').title=branching?'Rimuovi il ramo selezionato':'Rimuovi il punto selezionato';
    $('iterations').max=iterationLimit();$('mirrorLabel').textContent=branching?'Specchia sottoalberi alterni':'Specchia segmenti alterni';
    $('creationName').textContent=state.name;syncSliders();
    $('previousLayerControl').hidden=false;$('previousLayer').checked=showPrevious;$('ghostStyleControls').hidden=!showPrevious;$('ghostColor').value=ghostColor;$('ghostWidth').value=ghostWidth;$('ghostWidthValue').textContent=`${ghostWidth}%`;
    $('mirror').checked=state.mirror;
    document.querySelectorAll('.preset').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.id===selectedPreset)));
    document.querySelectorAll('.swatch').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.id===state.palette)));
    syncPoint();drawGenerator();renderConstruction();syncColorControls();updateHistoryButtons();experience?.sync();
  }
  function markCustom(){selectedPreset='';if(!editingPresetId)state.name='Forme in libertà';$('creationName').textContent=state.name;document.querySelectorAll('.preset').forEach(b=>b.setAttribute('aria-pressed','false'));}
  function commit(){projectHistory.push(state,editingPresetId,selectedPreset);updateHistoryButtons();persistDraft();}
  function persistDraft(){clearTimeout(saveTimer);saveTimer=setTimeout(()=>{try{localStorage.setItem(storage.draft,JSON.stringify(state));localStorage.setItem('forma.draft-context.v1',JSON.stringify({editingPresetId,selectedPreset}));}catch{}},250);}
  function updateHistoryButtons(){$('undoBtn').disabled=!projectHistory.canUndo;$('redoBtn').disabled=!projectHistory.canRedo;}
  function undo(direction){stopAnimation();const entry=projectHistory.move(direction);if(!entry)return;state=entry.project;editingPresetId=entry.editingId;selectedPreset=entry.presetId;syncUI();requestGeometry();persistDraft();}
  function loadProject(project,presetId=null){const validated=validatedProject(project);stopAnimation();state=validated;selectedPreset=presetId||'';editingPresetId=presetId;selected=0;syncUI();requestGeometry(true);commit();}
  function toast(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,3600);}
  function updateZoom(){const fitScale=cameraFit().scale;zoomFactor=camera.scale/fitScale;$('zoomValue').textContent=`${Math.round(zoomFactor*100)}%`;persistView();}
  function zoom(factor,px=viewport.w/2,py=viewport.h/2){const x=camera.x+(px-viewport.w/2)/camera.scale,y=camera.y-(py-viewport.h/2)/camera.scale;camera.scale=Math.max(1e-9,Math.min(1e9,camera.scale*factor));camera.x=x-(px-viewport.w/2)/camera.scale;camera.y=y+(py-viewport.h/2)/camera.scale;updateZoom();scheduleRender();}

  for(const [id,label] of [['ifs','Copie autosimili'],['lsystem','Grammatiche']]){const family=document.createElement('div');family.className='preset-family';const title=document.createElement('h3');title.textContent=label;const grid=document.createElement('div');grid.id='presets-'+id;grid.className='preset-grid';family.append(title,grid);$('presets-custom').parentElement.before(family);}
  // Presets and palettes are real controls, with previews generated by the same geometry engine.
  function previewPath(project){
    const r=E.generateProject({...project,iterations:Math.min(project.iterations,project.mode==='free'?8:project.mode==='branches'?7:4)},4096),f=fitFor(r.bounds,72,30,.85),x=value=>((value-f.x)*f.scale+36).toFixed(2),y=value=>(15-(value-f.y)*f.scale).toFixed(2);let path='';
    if(r.kind==='branches'){for(let i=0;i<r.segments.length;i+=4)path+=`M${x(r.segments[i])},${y(r.segments[i+1])}L${x(r.segments[i+2])},${y(r.segments[i+3])}`;}
    else for(let i=0;i<r.points.length;i+=2)path+=`${i?'L':'M'}${x(r.points[i])},${y(r.points[i+1])}`;return path;
  }
  for(const preset of presets){
    const b=document.createElement('button');b.className='preset';b.dataset.id=preset.id;b.title=preset.name+' — '+preset.hint;b.dataset.family=preset.family;b.dataset.beginner=String(preset.beginner);b.setAttribute('aria-pressed',String(preset.id===selectedPreset));
    const path=previewPath(projectForPreset(preset));
    b.innerHTML=`<svg viewBox="0 0 72 30" aria-hidden="true"><path d="${path}"/></svg><span></span>`;b.querySelector('span').textContent=preset.label;
    b.onclick=()=>{stopAnimation();state=projectForPreset(preset);if(state.mode==='branches'){grid=false;$('gridBtn').setAttribute('aria-pressed','false');}selectedPreset=preset.id;editingPresetId=null;selected=0;syncUI();requestGeometry(true);commit();};$('presets-'+(preset.mode||'polyline')).append(b);
  }
  function renderCustomPresets(){
    document.querySelectorAll('.preset[data-custom=true]').forEach(b=>b.remove());
    for(const record of userPresets){const p=record.project,b=document.createElement('button');b.className='preset';b.dataset.id=record.id;b.dataset.custom='true';b.title=`Apri e modifica ${p.name}`;b.setAttribute('aria-label',`Preset personale: ${p.name}`);b.setAttribute('aria-pressed',String(selectedPreset===record.id));
      const d=previewPath(p);
      b.innerHTML=`<svg viewBox="0 0 72 30" aria-hidden="true"><path d="${d}"/></svg><span></span>`;b.querySelector('span').textContent=p.name;b.onclick=()=>loadProject(p,record.id);$('presets-custom').append(b);
    }
    $('customPresetInfo').textContent=userPresets.length?`${userPresets.length} creazioni nella tua raccolta.`:'Salva una creazione per ritrovarla nella raccolta.';
  }
  renderCustomPresets();
  for(const [id,palette] of Object.entries(palettes)){const b=document.createElement('button');b.className='swatch';b.dataset.id=id;b.title=palette.label;b.setAttribute('aria-label',`Palette ${palette.label}`);b.style.background=`linear-gradient(135deg,${palette.stops.join(',')})`;b.onclick=()=>{stopAnimation();state.palette=id;state.colorStart=palette.stops[0];state.colorEnd=palette.stops.at(-1);if(state.colorMiddle)state.colorMiddle=palette.stops[1];syncColorControls();scheduleRender();commit();};$('palettes').append(b);}

  function syncColorControls(){
    const uniform=state.colorMode==='solid'&&state.structureColor==='spatial';
    $('backgroundColor').value=state.background;document.querySelector('.workspace').classList.toggle('light-canvas',isLightBackground());
    $('lineColorMode').value=state.colorMode;$('colorStart').value=state.colorStart;$('colorEnd').value=state.colorEnd;
    $('middleColorControl').hidden=uniform;$('middleColorEnabled').checked=!!state.colorMiddle;$('colorMiddle').value=state.colorMiddle||'#c9ef80';$('colorMiddle').disabled=!state.colorMiddle;
    $('endColorControl').hidden=uniform;$('colorEnd').disabled=uniform;$('startColorLabel').textContent=uniform?'Colore':'Da';
    document.querySelectorAll('.swatch').forEach(b=>{const p=palettes[b.dataset.id];b.setAttribute('aria-pressed',String(b.dataset.id===state.palette&&state.colorStart===p.stops[0]&&state.colorEnd===p.stops.at(-1)));});
  }
  function isLightBackground(){const c=state.background;return .2126*parseInt(c.slice(1,3),16)+.7152*parseInt(c.slice(3,5),16)+.0722*parseInt(c.slice(5,7),16)>150;}
  $('backgroundColor').oninput=e=>{stopAnimation();state.background=e.target.value;syncColorControls();scheduleRender();};$('backgroundColor').onchange=commit;
  $('lineColorMode').onchange=e=>{stopAnimation();state.colorMode=e.target.value;syncColorControls();scheduleRender();commit();};
  $('middleColorEnabled').onchange=e=>{stopAnimation();state.colorMiddle=e.target.checked?$('colorMiddle').value:null;syncColorControls();scheduleRender();commit();};
  for(const id of ['colorStart','colorMiddle','colorEnd']){$(id).oninput=e=>{stopAnimation();state[id]=e.target.value;syncColorControls();scheduleRender();};$(id).onchange=commit;}

  function constraintStatus(message,kind='ok'){$('constraintStatus').textContent=message;$('constraintStatus').dataset.state=kind;}
  function pendingConstraints(){constraintDraftDirty=true;$('applyConstraints').disabled=false;constraintStatus('Modifiche da applicare. La costruzione partirà da A fisso e B si adatterà ai vincoli.','pending');}
  function setNumber(input,value){input.dataset.exact=String(value);input.dataset.edited='false';const rounded=Number(value.toFixed(2));input.value=value!==0&&rounded===0?value.toExponential(2):rounded;input.dataset.formatted=input.value;input.title='Valore esatto: '+value;}
  function readNumber(input){return input.dataset.edited!=='true'&&input.value===input.dataset.formatted?Number(input.dataset.exact):input.valueAsNumber;}
  function numberField(value,label){const input=document.createElement('input');input.type='number';input.step='any';setNumber(input,value);input.setAttribute('aria-label',label);return input;}

  function branchEdited(){stopAnimation();markCustom();syncPoint();drawGenerator();renderConstruction();requestGeometry(true);commit();}
  function renderBranchRules(){
    $('branchRows').replaceChildren();$('minBranch').value=Number((state.minBranch*100).toFixed(2));$('taper').value=sliderPercent(state.taper,1.5);$('radialCopies').value=state.radialCopies;
    state.branches.forEach((rule,i)=>{
      const card=document.createElement('div');card.className='branch-card';card.classList.toggle('active',selected===i+1);
      const heading=document.createElement('div');heading.className='branch-card-heading';const choose=document.createElement('button');choose.className='text-button';choose.textContent=`R${i+1}`;choose.setAttribute('aria-label',`Seleziona ramo ${i+1}`);choose.onclick=()=>{selected=i+1;syncPoint();drawGenerator();};
      const flipLabel=document.createElement('label');flipLabel.className='branch-mirror';const flip=document.createElement('input');flip.type='checkbox';flip.checked=rule.flip;flip.dataset.branchFlip=i;flip.setAttribute('aria-label',`Specchia sottoalbero ramo ${i+1}`);flip.onchange=()=>{rule.flip=flip.checked;branchEdited();};flipLabel.append(flip,document.createTextNode('Specchia figli'));heading.append(choose,flipLabel);
      const fields=document.createElement('div');fields.className='branch-fields';
      for(const [key,label,min,max,factor] of [['angle','Angolo (°)',-180,180,1],['ratio','Scala (%)',5,125,100],['attach','Innesto (%)',0,100,100]]){
        const box=document.createElement('label');box.textContent=label;const input=numberField(rule[key]*factor,`${label} ramo ${i+1}`);input.min=min;input.max=max;input.dataset[`branch${key[0].toUpperCase()+key.slice(1)}`]=i;
        input.onchange=()=>{if(!input.validity.valid||!Number.isFinite(input.valueAsNumber)){constraintStatus(`Valore non valido: ${label} tra ${min} e ${max}.`,'error');input.value=Number((rule[key]*factor).toFixed(2));return;}rule[key]=input.valueAsNumber/factor;linkPartner(i);branchEdited();};box.append(input);fields.append(box);
      }
      card.append(heading,fields);$('branchRows').append(card);
    });
  }
  function linkPartner(index){if(!state.growth.linked)return;const partner=index%2?index-1:index+1;if(partner>=state.branches.length)return;state.branches[partner]={...state.branches[index],angle:-state.branches[index].angle};}
  function moveBranchPoint(index,point){
    if(index<0)return false;
    if(index===0){if(Math.hypot(point.u,point.v)<.0001){constraintStatus('A e B devono restare distinti.','error');return false;}state.endpoint={...point};}
    else{
      const rule=state.branches[index-1],b=state.endpoint,dx=point.u-b.u*rule.attach,dy=point.v-b.v*rule.attach,ratio=Math.hypot(dx,dy)/Math.hypot(b.u,b.v);
      if(ratio<.05||ratio>1.25){constraintStatus('La lunghezza del ramo deve essere tra il 5% e il 125% del tronco.','error');return false;}
      const angle=Math.atan2(b.u*dy-b.v*dx,b.u*dx+b.v*dy)*180/Math.PI;rule.angle=angle;rule.ratio=ratio;linkPartner(index-1);
    }
    markCustom();syncPoint();drawGenerator();requestGeometry();return true;
  }
  for(const id of ['transformKind','transformAngle'])$(id).onchange=e=>{if(id==='transformAngle'&&(!e.target.validity.valid||!Number.isFinite(e.target.valueAsNumber))){syncUI();return;}stopAnimation();state[id]=id==='transformAngle'?e.target.valueAsNumber:e.target.value;markCustom();requestGeometry(true);commit();};
  $('generatorMode').onchange=e=>{
    if(!canEditGeometry()){e.target.value=state.mode;return;}stopAnimation();state.mode=e.target.value;state.constraints=C.empty(state.folds.length);state.iterations=Math.min(state.iterations,iterationLimit());selected=0;markCustom();syncUI();requestGeometry(true);commit();
  };
  $('minBranch').onchange=e=>{const input=e.target;if(!input.validity.valid||!Number.isFinite(input.valueAsNumber)){input.value=state.minBranch*100;constraintStatus('La lunghezza minima deve essere tra 0,01% e 25% del tronco.','error');return;}state.minBranch=input.valueAsNumber/100;branchEdited();};
  $('radialCopies').onchange=e=>{state.radialCopies=Number(e.target.value);branchEdited();};
  $('taper').oninput=e=>{stopAnimation();state.taper=Number(e.target.value)*1.5/100;$('taperValue').textContent=`${e.target.value}%`;branchPathCache.clear();scheduleRender();};$('taper').onchange=commit;
  function renderConstruction(message){
    if(state.mode==='branches'){renderBranchRules();constraintDraftDirty=false;constraintStatus(message||'Le regole si applicano a ogni ramo, mantenendo tutti i livelli precedenti.');return;}
    const measures=C.measure(state.folds,state.endpoint,state.origin);constraintDraft=clone(state.constraints);constraintDraftDirty=false;$('applyConstraints').disabled=true;
    $('sideRows').replaceChildren();$('angleRows').replaceChildren();
    measures.lengths.forEach((length,i)=>{
      const row=document.createElement('div');row.className='side-row';
      const label=document.createElement('span');label.textContent=`S${i+1}`;label.title=`${i===0?'A':`P${i}`} → ${i===measures.lengths.length-1?'B':`P${i+1}`}`;
      const input=numberField(state.constraints.lengths[i]??length,`Lunghezza lato ${i+1}`);input.min='0.000001';input.max='1000';input.dataset.length=i;
      const locked=document.createElement('input');locked.type='checkbox';locked.checked=state.constraints.lengths[i]!==null;locked.dataset.lockLength=i;locked.setAttribute('aria-label',`Blocca lunghezza lato ${i+1}`);
      const group=document.createElement('select');group.dataset.group=i;group.setAttribute('aria-label',`Gruppo di congruenza lato ${i+1}`);['—','A','B','C'].forEach((text,value)=>group.add(new Option(text,String(value))));group.value=state.constraints.groups[i];
      const direction=document.createElement('button');direction.className='direction-toggle';direction.dataset.direction=i;direction.title=`Inverti sviluppo S${i+1}`;direction.onclick=()=>flipDirection(i);
      const split=document.createElement('button');split.className='side-split';split.textContent='+';split.title=`Dividi S${i+1} a metà`;split.setAttribute('aria-label',`Dividi lato ${i+1}`);split.disabled=state.folds.length>=8;split.onclick=()=>{if(!canEditGeometry())return;stopAnimation();const points=C.measure(state.folds,state.endpoint,state.origin).points,a=points[i],b=points[i+1];insertFold(i,{u:(a.u+b.u)/2,v:(a.v+b.v)/2});commit();};
      input.onchange=()=>{locked.checked=true;constraintDraft.lengths[i]=input.validity.valid?readNumber(input):NaN;pendingConstraints();};locked.onchange=()=>{constraintDraft.lengths[i]=locked.checked?(input.validity.valid?readNumber(input):NaN):null;pendingConstraints();};group.onchange=()=>{constraintDraft.groups[i]=Number(group.value);pendingConstraints();};
      row.append(label,input,locked,group,direction,split);$('sideRows').append(row);
    });
    measures.turns.forEach((turn,i)=>{
      const row=document.createElement('div');row.className='angle-row';const label=document.createElement('span');label.textContent=`P${i+1}`;
      const target=state.constraints.turns[i]??turn;
      const input=numberField(180-Math.abs(target),`Angolo interno punto ${i+1}`);input.min='0';input.max='180';input.dataset.angle=i;
      const locked=document.createElement('input');locked.type='checkbox';locked.checked=state.constraints.turns[i]!==null;locked.dataset.lockAngle=i;locked.setAttribute('aria-label',`Blocca angolo punto ${i+1}`);
      const bend=document.createElement('select');bend.dataset.bend=i;bend.setAttribute('aria-label',`Svolta al punto ${i+1}`);bend.add(new Option('Sinistra','1'));bend.add(new Option('Destra','-1'));bend.value=target<0?'-1':'1';
      const stage=()=>{locked.checked=true;constraintDraft.turns[i]=input.validity.valid?Number(bend.value)*(180-readNumber(input)):NaN;pendingConstraints();};input.onchange=stage;bend.onchange=stage;locked.onchange=()=>{constraintDraft.turns[i]=locked.checked?(input.validity.valid?Number(bend.value)*(180-readNumber(input)):NaN):null;pendingConstraints();};
      row.append(label,input,locked,bend);$('angleRows').append(row);
    });
    setNumber($('startHeading'),state.constraints.heading??measures.heading);$('lockHeading').checked=state.constraints.heading!==null;
    updateDirections();
    const hasLocks=state.constraints.heading!==null||state.constraints.lengths.some(x=>x!==null)||state.constraints.turns.some(x=>x!==null)||state.constraints.groups.some(x=>x!==0);
    constraintStatus(message||(hasLocks?'Vincoli attivi. A fisso in (0, 0); B segue la costruzione.':'A fisso in (0, 0), B mobile. Nessun vincolo dimensionale.'));
  }
  function updateDirections(){document.querySelectorAll('[data-direction]').forEach(b=>{const i=Number(b.dataset.direction),negative=state.directions[i]===-1;b.textContent=negative?'↙':'↗';b.setAttribute('aria-pressed',String(negative));b.setAttribute('aria-label',`Sviluppo S${i+1}: ${negative?'destra':'sinistra'}. Inverti`);});}
  function flipDirection(i){stopAnimation();state.directions[i]*=-1;markCustom();updateDirections();drawGenerator();requestGeometry();commit();}
  function canEditGeometry(){if(constraintDraftDirty){toast('Applica o libera i vincoli in sospeso prima di modificare i punti.');return false;}return true;}
  function selectedPoint(){if(state.mode==='branches')return selected===0?state.endpoint:branchHandles()[selected-1].end;return selected===-1?state.origin:selected===state.folds.length?state.endpoint:state.folds[selected];}
  function movePoint(index,point){
    if(state.mode==='branches')return moveBranchPoint(index,point);
    if(index<0){constraintStatus('A resta fisso in (0, 0). Modifica B o i punti intermedi.','error');return false;}
    const candidate=clone(state.folds),origin={u:0,v:0},endpoint=index===candidate.length?point:{...state.endpoint};
    if(index>=0&&index<candidate.length)candidate[index]=point;
    if(Math.hypot(endpoint.u-origin.u,endpoint.v-origin.v)<.0001){constraintStatus('A e B devono restare distinti.','error');return false;}
    const result=C.solve(candidate,endpoint,state.constraints,origin);
    if(!result.ok){constraintStatus(result.message,'error');return false;}
    state.origin={...origin};state.folds=result.folds;state.endpoint=result.endpoint;markCustom();syncPoint();drawGenerator();requestGeometry();return true;
  }
  function insertFold(edge,point){
    state.folds.splice(edge,0,point);state.directions.splice(edge,1,state.directions[edge],state.directions[edge]);state.constraints=C.empty(state.folds.length);selected=edge;
    markCustom();syncPoint();drawGenerator();renderConstruction('Punto inserito nella sequenza. Vincoli dimensionali azzerati; versi conservati.');requestGeometry();
  }
  $('applyConstraints').onclick=()=>{
    stopAnimation();try{
      const proposed=E.validateProject({...state,constraints:constraintDraft});const result=C.solve(state.folds,state.endpoint,proposed.constraints,state.origin);
      if(!result.ok){constraintStatus(result.message,'error');return;}
      state.constraints=proposed.constraints;state.folds=result.folds;state.endpoint=result.endpoint;markCustom();syncPoint();drawGenerator();renderConstruction(result.message);requestGeometry(true);commit();
    }catch(error){constraintStatus(error.message,'error');}
  };
  $('clearConstraints').onclick=()=>{stopAnimation();state.constraints=C.empty(state.folds.length);renderConstruction('Vincoli liberati. La forma corrente è conservata.');commit();};
  $('equalSides').onclick=()=>{constraintDraft.groups.fill(1);document.querySelectorAll('[data-group]').forEach(s=>s.value='1');pendingConstraints();};
  $('startHeading').onchange=()=>{$('lockHeading').checked=true;constraintDraft.heading=readNumber($('startHeading'));pendingConstraints();};
  $('lockHeading').onchange=()=>{constraintDraft.heading=$('lockHeading').checked?readNumber($('startHeading')):null;pendingConstraints();};

  // Sequence editing never sorts by X: indices identify the path, including backwards edges.
  gen.addEventListener('pointerdown',e=>{
    if(experience?.editorPointerDown(e,editor))return;
    if(state.mode==='lsystem')return;
    if(e.button!==0)return;stopAnimation();const rect=gen.getBoundingClientRect(),x=e.clientX-rect.left,y=e.clientY-rect.top;
    if(state.mode==='branches'){
      let nearest=-2,best=18;[state.origin,state.endpoint,...branchHandles().map(p=>p.end)].forEach((p,i)=>{const s=editorPos(p),distance=Math.hypot(s.x-x,s.y-y);if(distance<best){best=distance;nearest=i-1;}});
      if(nearest<0){toast(nearest===-1?'A resta fisso in (0, 0).':'Trascina B o la punta di un ramo. Usa + Ramo per aggiungerne uno.');return;}
      selected=nearest;dragging=true;dragChanged=false;gen.setPointerCapture(e.pointerId);syncPoint();drawGenerator();e.preventDefault();return;
    }
    let nearest=null,best=18;[state.origin,...state.folds,state.endpoint].forEach((p,i)=>{const s=editorPos(p),d=Math.hypot(s.x-x,s.y-y);if(d<best){nearest=i-1;best=d;}});
    if(nearest===-1){toast('A resta fisso in (0, 0). Puoi spostare B e i punti intermedi.');return;}
    if(nearest===null){const arrow=arrowTargets.find(p=>Math.hypot(p.x-x,p.y-y)<13);if(arrow){flipDirection(arrow.index);return;}}
    if(!canEditGeometry())return;
    dragChanged=false;
    if(nearest===null){if(state.folds.length>=8){toast('Fino a 8 punti: prova a spostare quelli che hai già.');return;}const points=C.measure(state.folds,state.endpoint,state.origin).points.map(editorPos);let edge=0,distance=Infinity;for(let i=0;i<points.length-1;i++){const a=points[i],b=points[i+1],dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((x-a.x)*dx+(y-a.y)*dy)/(dx*dx+dy*dy||1))),d=Math.hypot(x-a.x-t*dx,y-a.y-t*dy);if(d<distance){distance=d;edge=i;}}insertFold(edge,editorWorld(e));nearest=edge;dragChanged=true;}
    selected=nearest;dragging=true;gen.setPointerCapture(e.pointerId);syncPoint();drawGenerator();e.preventDefault();
  });
  gen.addEventListener('pointermove',e=>{if(experience?.editorPointerMove(e,editor))return;if(!dragging)return;if(movePoint(selected,editorWorld(e)))dragChanged=true;});
  function endDrag(){if(experience?.editorPointerUp())return;if(!dragging)return;dragging=false;syncPoint();drawGenerator();if(dragChanged){renderConstruction();requestGeometry();commit();}}
  gen.addEventListener('pointerup',endDrag);gen.addEventListener('pointercancel',endDrag);gen.addEventListener('lostpointercapture',endDrag);
  $('pointSelect').onchange=e=>{selected=Number(e.target.value);syncPoint();drawGenerator();};
  for(const [id,key] of [['pointX','u'],['pointY','v']]) $(id).addEventListener('change',e=>{stopAnimation();const value=e.target.valueAsNumber;if(!canEditGeometry()||!Number.isFinite(value)||Math.abs(value)>1000){constraintStatus('Applica i vincoli in sospeso e usa coordinate finite tra −1000 e 1000.','error');syncPoint();return;}if(movePoint(selected,{...selectedPoint(),[key]:value})){renderConstruction();commit();}syncPoint();});
  $('addFold').onclick=()=>{if(state.mode==='branches'){if(state.branches.length>=8)return;stopAnimation();state.branches.push({angle:0,ratio:.6,attach:1,flip:false});selected=state.branches.length;branchEdited();return;}if(state.folds.length>=8||!canEditGeometry())return;stopAnimation();const pts=C.measure(state.folds,state.endpoint,state.origin).points,index=Math.min(selected+1,state.folds.length),a=pts[index],b=pts[index+1];insertFold(index,{u:(a.u+b.u)/2,v:(a.v+b.v)/2});commit();};
  $('removeFold').onclick=()=>{if(state.mode==='branches'){if(state.branches.length<=1||selected===0)return;stopAnimation();state.branches.splice(selected-1,1);selected=Math.min(selected,state.branches.length);branchEdited();return;}if(state.folds.length<=1||selected<0||selected>=state.folds.length||!canEditGeometry())return;stopAnimation();state.folds.splice(selected,1);state.directions.splice(selected,2,state.directions[selected]);state.constraints=C.empty(state.folds.length);selected=Math.min(selected,state.folds.length-1);markCustom();syncPoint();drawGenerator();renderConstruction('Punto rimosso. Vincoli dimensionali azzerati; versi conservati.');requestGeometry();commit();};
  $('randomBtn').onclick=()=>{stopAnimation();if(state.mode==='branches'){state.branches=Array.from({length:2+Math.floor(Math.random()*2)},(_,i)=>({angle:Math.round((i-1)*45+(Math.random()-.5)*40),ratio:.4+Math.random()*.4,attach:1,flip:Math.random()>.8}));state.iterations=16;editingPresetId=null;selected=0;branchEdited();return;}const count=1+Math.floor(Math.random()*4);state.folds=Array.from({length:count},(_,i)=>({u:(i+1)/(count+1),v:Math.round((Math.random()-.5)*110)/100}));state.origin={u:0,v:0};state.endpoint={u:1,v:0};state.directions=Array(count+1).fill(1);state.constraints=C.empty(count);state.iterations=count<2?9:5;state.name='Felice imprevisto';editingPresetId=null;state.mirror=Math.random()>.6;selectedPreset='';selected=0;syncUI();requestGeometry(true);commit();};
  $('iterations').oninput=e=>{const depth=Number(e.target.value);stopAnimation();state.iterations=depth;syncSliders();requestGeometry();};
  $('iterations').onchange=commit;
  $('mirror').onchange=e=>{const checked=e.target.checked;stopAnimation();state.mirror=checked;requestGeometry();commit();};
  $('lineWidth').oninput=e=>{stopAnimation();state.lineWidth=Number(e.target.value)*12/100;$('widthValue').textContent=`${e.target.value}%`;scheduleRender();};$('lineWidth').onchange=commit;
  $('undoBtn').onclick=()=>undo(-1);$('redoBtn').onclick=()=>undo(1);

  // Camera: anchored wheel zoom, drag pan, and two-finger pinch.
  function startGesture(){const values=[...pointers.values()];if(values.length>=2){const [a,b]=values;gesture={type:'pinch',distance:Math.max(1,Math.hypot(a.x-b.x,a.y-b.y)),x:(a.x+b.x)/2,y:(a.y+b.y)/2,cam:{...camera}};}else if(values.length===1){gesture={type:'pan',x:values[0].x,y:values[0].y,cam:{...camera}};}else gesture=null;}
  canvas.addEventListener('pointerdown',e=>{if(e.button!==0)return;const r=canvas.getBoundingClientRect();pointers.set(e.pointerId,{x:e.clientX-r.left,y:e.clientY-r.top});canvas.setPointerCapture(e.pointerId);startGesture();});
  canvas.addEventListener('pointermove',e=>{if(!pointers.has(e.pointerId)||!gesture)return;const r=canvas.getBoundingClientRect();pointers.set(e.pointerId,{x:e.clientX-r.left,y:e.clientY-r.top});const values=[...pointers.values()];if(gesture.type==='pinch'&&values.length>=2){const[a,b]=values,px=(a.x+b.x)/2,py=(a.y+b.y)/2;camera.scale=Math.max(1e-9,Math.min(1e9,gesture.cam.scale*Math.hypot(a.x-b.x,a.y-b.y)/gesture.distance));const wx=gesture.cam.x+(gesture.x-viewport.w/2)/gesture.cam.scale,wy=gesture.cam.y-(gesture.y-viewport.h/2)/gesture.cam.scale;camera.x=wx-(px-viewport.w/2)/camera.scale;camera.y=wy+(py-viewport.h/2)/camera.scale;}else{camera.x=gesture.cam.x-(values[0].x-gesture.x)/camera.scale;camera.y=gesture.cam.y+(values[0].y-gesture.y)/camera.scale;}updateZoom();scheduleRender();});
  function releasePointer(e){pointers.delete(e.pointerId);startGesture();}canvas.addEventListener('pointerup',releasePointer);canvas.addEventListener('pointercancel',releasePointer);canvas.addEventListener('lostpointercapture',releasePointer);
  canvas.addEventListener('wheel',e=>{e.preventDefault();const r=canvas.getBoundingClientRect();zoom(Math.exp(-Math.max(-100,Math.min(100,e.deltaY))*.0025),e.clientX-r.left,e.clientY-r.top);},{passive:false});
  $('zoomIn').onclick=()=>zoom(1.3);$('zoomOut').onclick=()=>zoom(1/1.3);$('fitBtn').onclick=fit;
  $('gridBtn').onclick=()=>{grid=!grid;$('gridBtn').setAttribute('aria-pressed',String(grid));scheduleRender();};
  $('fullscreenBtn').hidden=!document.fullscreenEnabled;
  $('fullscreenBtn').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.querySelector('.workspace').requestFullscreen();}catch{toast('Schermo intero non disponibile in questa finestra.');}};
  let playbackPaused=false,playbackTarget=0;
  function stopAnimation(pause=false){if(!pause)playbackPaused=false;if(!animation)return;clearTimeout(animation.timer);animation=null;playbackPaused=pause;$('playIcon').textContent='▶';$('playLabel').textContent=pause?'Riprendi la crescita':'Guarda come nasce';$('playBtn').setAttribute('aria-pressed','false');syncSliders();commit();}
  function toggleAnimation(){
    if(animation){stopAnimation(true);return;}if(busy){toast('Attendi il completamento del disegno.');return;}
    const max=playbackPaused?playbackTarget:geometry.iterations;
    if(max===0){toast('Aumenta le iterazioni per animare la costruzione.');return;}
    const start=playbackPaused?state.iterations+1:0;playbackTarget=max;playbackPaused=false;
    animation={target:max,step:start,timer:null};$('playIcon').textContent='Ⅱ';$('playLabel').textContent='La forma sta nascendo';$('playBtn').setAttribute('aria-pressed','true');
    const tick=()=>{if(!animation)return;if(busy){animation.timer=setTimeout(tick,50);return;}if(animation.step>max){if($('loopAnimation')?.checked)animation.step=0;else{stopAnimation();return;}}state.iterations=animation.step++;syncSliders();requestGeometry();animation.timer=setTimeout(tick,Number($('animationSpeed')?.value||650));};tick();
  }
  $('previousLayer').onchange=e=>{showPrevious=e.target.checked;$('ghostStyleControls').hidden=!showPrevious;persistView();requestGeometry();};
  $('ghostColor').oninput=e=>{ghostColor=e.target.value;persistView();scheduleRender();};
  $('ghostWidth').oninput=e=>{ghostWidth=Number(e.target.value);$('ghostWidthValue').textContent=`${ghostWidth}%`;persistView();scheduleRender();};
  function stepIteration(delta){stopAnimation();state.iterations=Math.max(0,Math.min(iterationLimit(),state.iterations+delta));syncSliders();requestGeometry();commit();}
  $('previousIteration').onclick=()=>stepIteration(-1);$('nextIteration').onclick=()=>stepIteration(1);
  // Formatting never changes numeric values before a change handler reads them.
  document.addEventListener('input',e=>{if(e.target.dataset?.exact!==undefined)e.target.dataset.edited='true';},true);
  $('playBtn').onclick=toggleAnimation;document.addEventListener('visibilitychange',()=>{if(document.hidden)stopAnimation();});

  // Dialogs, local collection, and portable project files.
  function openDialog(id){stopAnimation();$(id).showModal();}
  document.querySelectorAll('.close-dialog').forEach(b=>b.onclick=()=>b.closest('dialog').close());
  document.querySelectorAll('dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();}}));
  $('helpBtn').onclick=()=>openDialog('helpDialog');
  $('saveBtn').onclick=()=>{
    if(!canEditGeometry())return;openDialog('saveDialog');const record=userPresets.find(p=>p.id===editingPresetId);
    $('saveName').value=record?record.project.name:state.name;$('updatePresetOption').disabled=!record;$('updatePresetOption').textContent=record?`Aggiorna: ${record.project.name}`:'Aggiorna il preset aperto';$('saveMode').value=record?'update':'new';$('deletePreset').hidden=!record;$('saveStatus').textContent='';$('saveName').focus();$('saveName').select();
  };
  $('saveMode').onchange=()=>{$('deletePreset').hidden=$('saveMode').value!=='update'||!editingPresetId;};
  function updateGalleryCount(){$('galleryCount').textContent=library.records.length;}
  function setSaving(value){savingPreset=value;$('savePresetSubmit').disabled=value;$('deletePreset').disabled=value;$('savePresetSubmit').textContent=value?'Salvataggio…':'Salva creazione ↗';}
  $('saveDialog').addEventListener('cancel',e=>{if(savingPreset)e.preventDefault();});
  $('saveForm').onsubmit=async e=>{
    e.preventDefault();if(savingPreset)return;await libraryReady;if(busy){$('saveStatus').textContent='Attendi il completamento del disegno.';return;}
    const name=$('saveName').value.trim();if(!name){$('saveName').focus();return;}
    let project;try{project=validatedProject({...state,name});}catch(error){$('saveStatus').textContent=error.message;return;}
    const targetId=$('saveMode').value==='update'?editingPresetId:null;setSaving(true);$('saveStatus').textContent='Salvataggio in corso…';
    try{const id=await library.save(project,targetId,$('saveDestination')?.value||'auto');userPresets=library.records;editingPresetId=id;selectedPreset=id;state=project;renderCustomPresets();syncUI();commit();updateGalleryCount();$('saveDialog').close();toast(targetId?'Creazione aggiornata.':'Creazione aggiunta alla raccolta.');}
    catch(error){$('saveStatus').textContent=error.message;$('saveStatus').dataset.state='error';}finally{setSaving(false);}
  };
  async function deleteCreation(id){try{await library.remove(id);if(editingPresetId===id){editingPresetId=null;selectedPreset='';commit();}userPresets=library.records;renderCustomPresets();updateGalleryCount();renderGallery();experience?.syncLibrary();toast('Creazione nel cestino. Puoi recuperarla dalla raccolta.');}catch(error){toast(error.message);}}
  $('deletePreset').onclick=async()=>{if(savingPreset||!editingPresetId)return;setSaving(true);await deleteCreation(editingPresetId);$('saveDialog').close();setSaving(false);};
  function renderGallery(){
    const list=$('galleryList');list.replaceChildren();const records=library.records;
    if(!records.length){const empty=document.createElement('p');empty.className='empty-gallery';empty.textContent='Qui ritroverai tutte le tue creazioni. Puoi anche importare un progetto o un backup.';list.append(empty);}
    for(const item of records){
      const card=document.createElement('article');card.className='gallery-card';const open=document.createElement('button');open.className='gallery-open';open.setAttribute('aria-label','Apri '+item.project.name);
      const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 72 30');svg.setAttribute('aria-hidden','true');const path=document.createElementNS(svg.namespaceURI,'path');path.setAttribute('d',previewPath(item.project));svg.append(path);const name=document.createElement('strong');name.textContent=item.project.name;open.append(svg,name);open.onclick=()=>{loadProject(item.project,item.id);$('galleryDialog').close();};
      const footer=document.createElement('div');footer.className='gallery-card-footer';const source=document.createElement('span');source.textContent=item.source==='project'?'Nel progetto':'In questo browser';
      const duplicate=document.createElement('button');duplicate.textContent='Duplica';duplicate.onclick=async()=>{try{await library.save({...item.project,name:(item.project.name+' · copia').slice(0,60)},null,'browser');userPresets=library.records;renderCustomPresets();updateGalleryCount();renderGallery();}catch(error){toast(error.message);}};
      const rename=document.createElement('button');rename.textContent='Rinomina';rename.onclick=()=>{loadProject(item.project,item.id);$('galleryDialog').close();$('saveBtn').click();};
      const remove=document.createElement('button');remove.textContent='Elimina';remove.setAttribute('aria-label','Elimina '+item.project.name);remove.onclick=()=>deleteCreation(item.id);footer.append(source,duplicate,rename,remove);card.append(open,footer);list.append(card);
    }experience?.syncLibrary();
  }
  $('galleryBtn').onclick=async()=>{await libraryReady;renderGallery();openDialog('galleryDialog');};
  document.querySelector('.import-button').addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();$('importFile').click();}});
  $('importFile').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>2097152)throw new Error('Il file è troppo grande (massimo 2 MB).');const data=JSON.parse(await file.text());if(data.format==='forma-library'){const count=library.importBackup(data);userPresets=library.records;renderCustomPresets();updateGalleryCount();renderGallery();toast(count+' creazioni importate; gli originali sono conservati.');e.target.value='';return;}const project=validatedProject(data);loadProject(project);$('galleryDialog').close();toast('Progetto importato. Salva creazione per aggiungerlo alla raccolta.');}catch(error){toast(error instanceof SyntaxError?'Il file non contiene JSON valido.':error.message);}e.target.value='';};
  $('exportBtn').onclick=()=>{if(busy){toast('Attendi il completamento del disegno.');return;}openDialog('exportDialog');};
  function download(blob,extension){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`forma-${state.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'creazione'}.${extension}`;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);}
  function exportReady(){if(busy){toast('Il disegno si sta aggiornando. Riprova tra un momento.');return false;}return true;}
  function exportOptions(){return {width:Number($('exportWidth')?.value||2400),height:Number($('exportHeight')?.value||1800),transparent:$('exportTransparent')?.checked===true,strokeScale:Number($('exportStroke')?.value||2)};}
  $('exportPng').onclick=()=>{if(!exportReady())return;const options=exportOptions();if(!Number.isInteger(options.width)||!Number.isInteger(options.height)||options.width<128||options.height<128||options.width>8192||options.height>8192||options.width*options.height>33554432){toast('Scegli dimensioni tra 128 e 8192 px, entro 32 megapixel.');return;}const c=document.createElement('canvas');c.width=options.width;c.height=options.height;paint(c.getContext('2d'),c.width,c.height,fitFor(geometry.bounds,c.width,c.height,.82),{background:!options.transparent,lines:state.lineWidth*options.strokeScale});c.toBlob(blob=>{if(blob){download(blob,'png');toast('Immagine PNG esportata.');}else toast('Esportazione non riuscita.');},'image/png');};
  $('exportSvg').onclick=()=>{if(!exportReady())return;const options=exportOptions();if(!Number.isFinite(options.width)||!Number.isFinite(options.height)||options.width<128||options.height<128||options.width>8192||options.height>8192){toast('Dimensioni di esportazione non valide.');return;}download(new Blob([window.FractalRenderer.svg(geometry,state,options)],{type:'image/svg+xml'}),'svg');toast('Disegno vettoriale esportato.');};
  $('exportJson').onclick=()=>{download(new Blob([JSON.stringify(state,null,2)],{type:'application/json'}),'json');toast('Progetto esportato. Puoi reimportarlo dalla raccolta.');};
  document.addEventListener('keydown',e=>{const editing=e.target.closest('input,select,textarea,[contenteditable]');if(editing||document.querySelector('dialog[open]'))return;if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();undo(e.shiftKey?1:-1);}else if(e.key.toLowerCase()==='f'&&!e.ctrlKey&&!e.metaKey){e.preventDefault();fit();}else if(e.code==='Space'&&e.target===document.body||e.code==='Space'&&e.target===canvas){e.preventDefault();toggleAnimation();}else if(e.key==='?'){openDialog('helpDialog');}});
  new ResizeObserver(()=>{resize();updateZoom();}).observe(document.querySelector('main'));
  window.addEventListener('resize',resize);document.addEventListener('fullscreenchange',resize);
  window.addEventListener('pagehide',()=>{try{localStorage.setItem(storage.draft,JSON.stringify(state));localStorage.setItem('forma.draft-context.v1',JSON.stringify({editingPresetId,selectedPreset}));}catch{}});
  experience=window.FormaExperience({
    get:()=>state,getGeometry:()=>geometry,isBusy:()=>busy,library,libraryReady,
    change(mutator,options={}){if(!canEditGeometry())return false;stopAnimation();const candidate=clone(state);try{mutator(candidate);state=validatedProject(candidate);}catch(error){toast(error.message);syncUI();return false;}if(options.mark!==false)markCustom();syncUI();if(options.geometry!==false)requestGeometry();else scheduleRender();if(options.commit!==false)commit();return true;},
    load:loadProject,commit,draw:drawGenerator,render:scheduleRender,toast,open:openDialog,download,fit,renderGallery,
    getView:()=>({showPrevious,showNext,adaptiveCamera,ghostColor,ghostWidth,zoomFactor}),
    setView(values){({showPrevious,showNext,adaptiveCamera}={showPrevious,showNext,adaptiveCamera,...values});persistView();requestGeometry();scheduleRender();},
    stop:stopAnimation,play:toggleAnimation,
    refreshLibrary(){userPresets=library.records;renderCustomPresets();updateGalleryCount();renderGallery();},
    replaceTransient(project){state=validatedProject(project);syncUI();requestGeometry();},
    resetIdentity(){editingPresetId=null;selectedPreset='';}
  });
  window.FormaApp={getProject:()=>clone(state),getGeometry:()=>geometry,getCamera:()=>({...camera}),loadProject,library,ready:libraryReady};
  resize();syncUI();commit();updateGalleryCount();requestGeometry(true);
})();
