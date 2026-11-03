/* Forma: buildless, local-first fractal playground. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const clone = value => JSON.parse(JSON.stringify(value));
  const E = window.FractalEngine;
  const presets = [
    {id:'koch',label:'Koch',name:'Curva di Koch',folds:[{u:1/3,v:0},{u:.5,v:Math.sqrt(3)/6},{u:2/3,v:0}],iterations:5},
    {id:'levy',label:'Lévy',name:'Curva di Lévy',folds:[{u:.5,v:.5}],iterations:10},
    {id:'minkowski',label:'Minkowski',name:'Curva di Minkowski',folds:[{u:.25,v:0},{u:.25,v:.25},{u:.5,v:.25},{u:.5,v:0},{u:.5,v:-.25},{u:.75,v:-.25},{u:.75,v:0}],iterations:4},
    {id:'z',label:'Zig zag',name:'Onda a zig zag',folds:[{u:1/3,v:.35},{u:2/3,v:-.35}],iterations:6},
    {id:'tent',label:'Triangolo',name:'Picco triangolare',folds:[{u:.5,v:.65}],iterations:8},
    {id:'wave',label:'Onda',name:'Onda morbida',folds:[{u:.25,v:.18},{u:.5,v:0},{u:.75,v:-.18}],iterations:5}
  ];
  const palettes = {
    lime:{label:'Lime',stops:['#769b5a','#c9ef80','#e9ffd0']},
    aurora:{label:'Aurora',stops:['#75e5cc','#94b3fa','#db8bdd']},
    ocean:{label:'Oceano',stops:['#387caf','#6ed8dc','#cdf2da']},
    ember:{label:'Brace',stops:['#f47872','#f3b06a','#f4e8a4']},
    chalk:{label:'Gesso',stops:['#a9b9a7','#f1f2e7','#a9b9a7']}
  };
  const storage = {draft:'forma.draft.v1',gallery:'forma.gallery.v1'};
  let state = {version:1,name:'Curva di Koch',folds:clone(presets[0].folds),iterations:5,mirror:false,palette:'lime',lineWidth:1.3};
  let selectedPreset = 'koch', selected = 1, grid = true;
  let geometry = E.generate(state.folds,state.iterations,state.mirror);
  let geometryKey = '', busy = false, queued = null, worker = null, needsFit = true;
  let frame = 0, toastTimer, saveTimer, animation = null;
  let history = [], historyIndex = -1;
  let gallery = [];
  const camera = {x:.5,y:.1,scale:400};
  const canvas = $('fractal'), ctx = canvas.getContext('2d');
  const gen = $('generator'), gctx = gen.getContext('2d');
  let viewport = {w:1,h:1,dpr:1}, editor = {w:1,h:1,dpr:1,pad:30,scale:200};
  let dragging = false, dragChanged = false;
  const pointers = new Map();
  let gesture = null;
  try {const draft = localStorage.getItem(storage.draft); if(draft){state = E.validateProject(JSON.parse(draft));selectedPreset=presets.find(p=>!state.mirror&&JSON.stringify(p.folds)===JSON.stringify(state.folds))?.id||'';}} catch { /* An unavailable store does not prevent exploration. */ }
  try {const saved = JSON.parse(localStorage.getItem(storage.gallery) || '[]'); if(Array.isArray(saved)) gallery = saved.slice(0,24).flatMap(item => {try{return [{id:String(item.id),project:E.validateProject(item.project),thumbnail:typeof item.thumbnail === 'string' && item.thumbnail.startsWith('data:image/jpeg;base64,') && item.thumbnail.length < 150000 ? item.thumbnail : '',date:typeof item.date === 'string' ? item.date : ''}];}catch{return [];}});}catch{}

  function colors(t) {
    const stops = palettes[state.palette].stops;
    const value = Math.max(0,Math.min(1,t)) * (stops.length-1), i = Math.min(stops.length-2,Math.floor(value)), f = value-i;
    const a = stops[i].match(/[a-f\d]{2}/gi).map(x => parseInt(x,16));
    const b = stops[i+1].match(/[a-f\d]{2}/gi).map(x => parseInt(x,16));
    return `rgb(${a.map((x,k) => Math.round(x+(b[k]-x)*f)).join(',')})`;
  }
  function fitFor(bounds,w,h,padding=.76) {
    return {x:(bounds.minX+bounds.maxX)/2,y:(bounds.minY+bounds.maxY)/2,scale:Math.min(w*padding/Math.max(.05,bounds.maxX-bounds.minX),h*padding/Math.max(.12,bounds.maxY-bounds.minY))};
  }
  function fit() {
    const c = fitFor(geometry.bounds,viewport.w,Math.max(150,viewport.h-240),.79);
    Object.assign(camera,c); updateZoom(); scheduleRender();
  }
  function paint(target,w,h,view,{background=true,lines=state.lineWidth}={}) {
    if(background){target.fillStyle='#111515';target.fillRect(0,0,w,h);}
    target.save();target.translate(w/2,h/2);target.scale(view.scale,-view.scale);target.translate(-view.x,-view.y);
    target.lineWidth=lines/view.scale;target.lineJoin='round';target.lineCap='round';
    const pts=geometry.points, count=geometry.count, batches=Math.min(96,count);
    for(let part=0;part<batches;part++){
      const start=Math.floor(part*count/batches),end=Math.floor((part+1)*count/batches);
      target.strokeStyle=colors(part/Math.max(1,batches-1));target.beginPath();target.moveTo(pts[start*2],pts[start*2+1]);
      for(let i=start+1;i<=end;i++) target.lineTo(pts[i*2],pts[i*2+1]);
      target.stroke();
    }
    target.restore();
  }
  function renderGrid() {
    const {w,h}=viewport;
    const raw=65/camera.scale, power=Math.pow(10,Math.floor(Math.log10(raw))), step=Math.ceil(raw/power)*power;
    const left=camera.x-w/2/camera.scale,bottom=camera.y-h/2/camera.scale;
    ctx.lineWidth=1;ctx.strokeStyle='#263127';ctx.beginPath();
    for(let x=Math.ceil(left/step)*step;x<=left+w/camera.scale;x+=step){const sx=(x-camera.x)*camera.scale+w/2;ctx.moveTo(sx,0);ctx.lineTo(sx,h);}
    for(let y=Math.ceil(bottom/step)*step;y<=bottom+h/camera.scale;y+=step){const sy=h/2-(y-camera.y)*camera.scale;ctx.moveTo(0,sy);ctx.lineTo(w,sy);}
    ctx.globalAlpha=.47;ctx.stroke();ctx.globalAlpha=1;
    const sx=(.5-camera.x)*camera.scale+w/2,sy=h/2+camera.y*camera.scale;
    ctx.strokeStyle='#3b4637';ctx.setLineDash([3,6]);ctx.beginPath();ctx.moveTo(sx,0);ctx.lineTo(sx,h);ctx.moveTo(0,sy);ctx.lineTo(w,sy);ctx.stroke();ctx.setLineDash([]);
  }
  function render() {
    frame=0;const {w,h,dpr}=viewport;ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle='#111515';ctx.fillRect(0,0,w,h);
    const glow=ctx.createRadialGradient(w*.48,h*.43,0,w*.48,h*.43,Math.max(w,h)*.65);glow.addColorStop(0,'#23312555');glow.addColorStop(1,'#11151500');ctx.fillStyle=glow;ctx.fillRect(0,0,w,h);
    if(grid)renderGrid();paint(ctx,w,h,camera,{background:false});
  }
  function scheduleRender(){if(!frame)frame=requestAnimationFrame(render);}
  function applyGeometry(result) {
    geometry=result;
    $('segmentCount').textContent=result.count.toLocaleString('it-IT');
    $('multiplier').textContent=`×${state.folds.length+1}`;
    $('renderStatus').textContent='Pronto a esplorare';
    const limited=result.iterations<state.iterations;
    $('complexityNotice').hidden=!limited;
    $('complexityNotice').textContent=`Dettaglio adattato a ${result.iterations} iterazioni (${result.count.toLocaleString('it-IT')} segmenti). Riduci i punti per esplorare più livelli.`;
    $('iterationValue').textContent=limited?`${result.iterations} / ${state.iterations}`:state.iterations;
    if(needsFit){needsFit=false;fit();}updateZoom();scheduleRender();
  }
  function sendJob(job) {
    busy=true;$('renderStatus').textContent='La forma sta nascendo…';
    if(worker)worker.postMessage(job);
    else setTimeout(()=>{try{finishJob(E.generate(job.folds,job.iterations,job.mirror));}catch(error){failJob(error);}},0);
  }
  function finishJob(result) {
    busy=false;
    if(queued){const latest=queued;queued=null;sendJob(latest);return;}
    applyGeometry(result);
  }
  function failJob(error) {busy=false;queued=null;$('renderStatus').textContent='Calcolo non riuscito';toast(error.message || 'Impossibile generare questa forma.');}
  function requestGeometry(autoFit=false) {
    needsFit ||= autoFit;
    const key=JSON.stringify([state.folds,state.iterations,state.mirror]);
    if(key===geometryKey){if(needsFit && !busy){needsFit=false;fit();}return;}
    geometryKey=key;
    const job={folds:clone(state.folds),iterations:state.iterations,mirror:state.mirror};
    if(busy)queued=job;else sendJob(job);
  }
  try {
    const blob=new Blob([`const generate=${E.generate.toString()};self.onmessage=e=>{try{const r=generate(e.data.folds,e.data.iterations,e.data.mirror);self.postMessage(r,[r.points.buffer]);}catch(error){self.postMessage({error:error.message});}};`],{type:'text/javascript'});
    const url=URL.createObjectURL(blob);worker=new Worker(url);URL.revokeObjectURL(url);
    worker.onmessage=e=>e.data.error?failJob(new Error(e.data.error)):finishJob(e.data);
    worker.onerror=()=>{worker.terminate();worker=null;busy=false;queued=null;geometryKey='';requestGeometry();};
  }catch{worker=null;}

  function resize() {
    const r=canvas.getBoundingClientRect(),gr=gen.getBoundingClientRect(),dpr=Math.min(2,window.devicePixelRatio||1);
    const relativeZoom=viewport.w>1?camera.scale/fitFor(geometry.bounds,viewport.w,Math.max(150,viewport.h-240),.79).scale:1;
    const wasSized=viewport.w>1;
    viewport={w:Math.max(1,r.width),h:Math.max(1,r.height),dpr};
    if(wasSized)camera.scale=Math.max(5,Math.min(200000,fitFor(geometry.bounds,viewport.w,Math.max(150,viewport.h-240),.79).scale*relativeZoom));
    canvas.width=Math.round(viewport.w*dpr);canvas.height=Math.round(viewport.h*dpr);
    editor={w:Math.max(1,gr.width),h:Math.max(1,gr.height),dpr,pad:30,scale:Math.max(1,gr.width-60)};
    canvas.style.width='';canvas.style.height='';gen.width=Math.round(editor.w*dpr);gen.height=Math.round(editor.h*dpr);
    drawGenerator();updateZoom();scheduleRender();
  }
  function editorPos(p){return {x:editor.pad+p.u*editor.scale,y:editor.originY-p.v*editor.scale};}
  function editorWorld(e){const r=gen.getBoundingClientRect();return {u:Math.max(.01,Math.min(.99,(e.clientX-r.left-editor.pad)/editor.scale)),v:Math.max(-1.5,Math.min(1.5,(editor.originY-e.clientY+r.top)/editor.scale))};}
  function drawGenerator(){
    const {w,h,dpr}=editor;
    if(!dragging){const minV=Math.min(0,...state.folds.map(p=>p.v)),maxV=Math.max(0,...state.folds.map(p=>p.v));editor.scale=Math.min(w-60,(h-38)/Math.max(.15,maxV-minV));editor.pad=(w-editor.scale)/2;editor.originY=h/2+(maxV+minV)/2*editor.scale;}
    gctx.setTransform(dpr,0,0,dpr,0,0);gctx.clearRect(0,0,w,h);
    gctx.strokeStyle='#232c24';gctx.lineWidth=1;gctx.beginPath();
    for(let x=editor.pad;x<w;x+=editor.scale/8){gctx.moveTo(x,0);gctx.lineTo(x,h);}for(let y=h/2%20;y<h;y+=20){gctx.moveTo(0,y);gctx.lineTo(w,y);}gctx.stroke();
    gctx.strokeStyle='#56624c';gctx.setLineDash([3,5]);gctx.beginPath();gctx.moveTo(editor.pad,editor.originY);gctx.lineTo(w-editor.pad,editor.originY);gctx.stroke();gctx.setLineDash([]);
    const points=[{u:0,v:0},...state.folds,{u:1,v:0}].map(editorPos);
    gctx.fillStyle='#c9ef800a';gctx.beginPath();points.forEach((p,i)=>i?gctx.lineTo(p.x,p.y):gctx.moveTo(p.x,p.y));gctx.closePath();gctx.fill();
    gctx.strokeStyle='#b8df85';gctx.lineWidth=1.6;gctx.beginPath();points.forEach((p,i)=>i?gctx.lineTo(p.x,p.y):gctx.moveTo(p.x,p.y));gctx.stroke();
    points.forEach((p,i)=>{const endpoint=i===0||i===points.length-1,active=i===selected+1;gctx.beginPath();gctx.arc(p.x,p.y,endpoint?3:active?6:4.5,0,Math.PI*2);gctx.fillStyle=endpoint?'#697c60':active?'#deffab':'#a9cf78';gctx.fill();if(active){gctx.beginPath();gctx.arc(p.x,p.y,10,0,Math.PI*2);gctx.strokeStyle='#c9ef8055';gctx.lineWidth=1;gctx.stroke();}});
  }
  function syncPoint() {
    selected=Math.max(0,Math.min(state.folds.length-1,selected));
    $('pointSelect').replaceChildren(...state.folds.map((_,i)=>new Option(String(i+1),String(i))));$('pointSelect').value=selected;
    $('pointX').value=Number(state.folds[selected].u.toFixed(3));$('pointY').value=Number(state.folds[selected].v.toFixed(3));
    $('foldCount').textContent=`${state.folds.length} ${state.folds.length===1?'punto':'punti'} di piega`;
    $('addFold').disabled=state.folds.length>=8;$('removeFold').disabled=state.folds.length<=1;
  }
  function syncUI() {
    $('creationName').textContent=state.name;$('iterations').value=state.iterations;$('iterationValue').textContent=state.iterations;
    $('mirror').checked=state.mirror;$('lineWidth').value=state.lineWidth;
    document.querySelectorAll('.preset').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.id===selectedPreset)));
    document.querySelectorAll('.swatch').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.id===state.palette)));
    syncPoint();drawGenerator();updateHistoryButtons();
  }
  function markCustom(){selectedPreset='';state.name='Forme in libertà';$('creationName').textContent=state.name;document.querySelectorAll('.preset').forEach(b=>b.setAttribute('aria-pressed','false'));}
  function commit() {
    if(historyIndex>=0 && JSON.stringify(history[historyIndex])===JSON.stringify(state))return;
    history=history.slice(0,historyIndex+1);history.push(clone(state));if(history.length>60)history.shift();historyIndex=history.length-1;updateHistoryButtons();persistDraft();
  }
  function persistDraft(){clearTimeout(saveTimer);saveTimer=setTimeout(()=>{try{localStorage.setItem(storage.draft,JSON.stringify({...state,iterations:animation?animation.target:state.iterations}));}catch{}},250);}
  function updateHistoryButtons(){$('undoBtn').disabled=historyIndex<=0;$('redoBtn').disabled=historyIndex>=history.length-1;}
  function undo(direction){stopAnimation();const next=historyIndex+direction;if(next<0||next>=history.length)return;historyIndex=next;state=clone(history[next]);selectedPreset='';syncUI();requestGeometry();persistDraft();}
  function loadProject(project){stopAnimation();state=E.validateProject(project);selectedPreset='';selected=0;syncUI();requestGeometry(true);commit();}
  function toast(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,3600);}
  function updateZoom(){const fitScale=fitFor(geometry.bounds,viewport.w,Math.max(150,viewport.h-240),.79).scale;$('zoomValue').textContent=`${Math.round(camera.scale/fitScale*100)}%`;}
  function zoom(factor,px=viewport.w/2,py=viewport.h/2){const x=camera.x+(px-viewport.w/2)/camera.scale,y=camera.y-(py-viewport.h/2)/camera.scale;camera.scale=Math.max(5,Math.min(200000,camera.scale*factor));camera.x=x-(px-viewport.w/2)/camera.scale;camera.y=y+(py-viewport.h/2)/camera.scale;updateZoom();scheduleRender();}

  // Presets and palettes are real controls, with previews generated by the same geometry engine.
  for(const preset of presets){
    const b=document.createElement('button');b.className='preset';b.dataset.id=preset.id;b.title=preset.name;b.setAttribute('aria-pressed',String(preset.id===selectedPreset));
    const r=E.generate(preset.folds,2,false),f=fitFor(r.bounds,72,30,.85);let path='';for(let i=0;i<r.points.length;i+=2)path+=`${i?'L':'M'}${((r.points[i]-f.x)*f.scale+36).toFixed(2)},${(15-(r.points[i+1]-f.y)*f.scale).toFixed(2)}`;
    b.innerHTML=`<svg viewBox="0 0 72 30" aria-hidden="true"><path d="${path}"/></svg><span></span>`;b.querySelector('span').textContent=preset.label;
    b.onclick=()=>{stopAnimation();Object.assign(state,{name:preset.name,folds:clone(preset.folds),iterations:preset.iterations,mirror:false});selectedPreset=preset.id;selected=0;syncUI();requestGeometry(true);commit();};$('presets').append(b);
  }
  for(const [id,palette] of Object.entries(palettes)){const b=document.createElement('button');b.className='swatch';b.dataset.id=id;b.title=palette.label;b.setAttribute('aria-label',`Palette ${palette.label}`);b.style.background=`linear-gradient(135deg,${palette.stops.join(',')})`;b.onclick=()=>{stopAnimation();state.palette=id;syncUI();scheduleRender();commit();};$('palettes').append(b);}

  // Generator editing: pointer capture supports mouse, pen, and touch without losing the drag.
  gen.addEventListener('pointerdown',e=>{
    if(e.button!==0)return;stopAnimation();const rect=gen.getBoundingClientRect(),x=e.clientX-rect.left,y=e.clientY-rect.top;
    let nearest=-1,best=18;state.folds.forEach((p,i)=>{const s=editorPos(p),d=Math.hypot(s.x-x,s.y-y);if(d<best){nearest=i;best=d;}});
    dragChanged=false;
    if(nearest<0){if(state.folds.length>=8){toast('Fino a 8 punti: prova a spostare quelli che hai già.');return;}const p=editorWorld(e);state.folds.push(p);state.folds.sort((a,b)=>a.u-b.u);nearest=state.folds.indexOf(p);markCustom();dragChanged=true;requestGeometry();}
    selected=nearest;dragging=true;gen.setPointerCapture(e.pointerId);syncPoint();drawGenerator();e.preventDefault();
  });
  gen.addEventListener('pointermove',e=>{if(!dragging)return;const p=editorWorld(e);Object.assign(state.folds[selected],p);dragChanged=true;markCustom();syncPoint();drawGenerator();requestGeometry();});
  function endDrag(){if(!dragging)return;dragging=false;const p=state.folds[selected];state.folds.sort((a,b)=>a.u-b.u);selected=state.folds.indexOf(p);syncPoint();drawGenerator();if(dragChanged){requestGeometry();commit();}}
  gen.addEventListener('pointerup',endDrag);gen.addEventListener('pointercancel',endDrag);gen.addEventListener('lostpointercapture',endDrag);
  $('pointSelect').onchange=e=>{selected=Number(e.target.value);syncPoint();drawGenerator();};
  for(const [id,key] of [['pointX','u'],['pointY','v']]) $(id).addEventListener('change',e=>{stopAnimation();const value=e.target.valueAsNumber;if(!Number.isFinite(value)){syncPoint();return;}state.folds[selected][key]=key==='u'?Math.max(.01,Math.min(.99,value)):Math.max(-1.5,Math.min(1.5,value));const p=state.folds[selected];state.folds.sort((a,b)=>a.u-b.u);selected=state.folds.indexOf(p);markCustom();syncPoint();drawGenerator();requestGeometry();commit();});
  $('addFold').onclick=()=>{if(state.folds.length>=8)return;stopAnimation();const pts=[{u:0,v:0},...state.folds,{u:1,v:0}];let index=0,gap=0;for(let i=0;i<pts.length-1;i++){const d=Math.hypot(pts[i+1].u-pts[i].u,pts[i+1].v-pts[i].v);if(d>gap){gap=d;index=i;}}const a=pts[index],b=pts[index+1],p={u:Math.max(.01,Math.min(.99,(a.u+b.u)/2)),v:Math.max(-1.5,Math.min(1.5,(a.v+b.v)/2+.08))};state.folds.push(p);state.folds.sort((a,b)=>a.u-b.u);selected=state.folds.indexOf(p);markCustom();syncPoint();drawGenerator();requestGeometry();commit();};
  $('removeFold').onclick=()=>{if(state.folds.length<=1)return;stopAnimation();state.folds.splice(selected,1);markCustom();syncPoint();drawGenerator();requestGeometry();commit();};
  $('randomBtn').onclick=()=>{stopAnimation();const count=1+Math.floor(Math.random()*4);state.folds=Array.from({length:count},(_,i)=>({u:(i+1)/(count+1),v:Math.round((Math.random()-.5)*110)/100}));state.iterations=count<2?9:5;state.name='Felice imprevisto';state.mirror=Math.random()>.6;selectedPreset='';selected=0;syncUI();requestGeometry(true);commit();};
  $('iterations').oninput=e=>{const n=Number(e.target.value);stopAnimation();state.iterations=n;$('iterations').value=n;$('iterationValue').textContent=n;requestGeometry();};
  $('iterations').onchange=commit;
  $('mirror').onchange=e=>{const checked=e.target.checked;stopAnimation();state.mirror=checked;requestGeometry();commit();};
  $('lineWidth').oninput=e=>{stopAnimation();state.lineWidth=Number(e.target.value);scheduleRender();};$('lineWidth').onchange=commit;
  $('undoBtn').onclick=()=>undo(-1);$('redoBtn').onclick=()=>undo(1);

  // Camera: anchored wheel zoom, drag pan, and two-finger pinch.
  function startGesture(){const values=[...pointers.values()];if(values.length>=2){const [a,b]=values;gesture={type:'pinch',distance:Math.max(1,Math.hypot(a.x-b.x,a.y-b.y)),x:(a.x+b.x)/2,y:(a.y+b.y)/2,cam:{...camera}};}else if(values.length===1){gesture={type:'pan',x:values[0].x,y:values[0].y,cam:{...camera}};}else gesture=null;}
  canvas.addEventListener('pointerdown',e=>{if(e.button!==0)return;const r=canvas.getBoundingClientRect();pointers.set(e.pointerId,{x:e.clientX-r.left,y:e.clientY-r.top});canvas.setPointerCapture(e.pointerId);startGesture();});
  canvas.addEventListener('pointermove',e=>{if(!pointers.has(e.pointerId)||!gesture)return;const r=canvas.getBoundingClientRect();pointers.set(e.pointerId,{x:e.clientX-r.left,y:e.clientY-r.top});const values=[...pointers.values()];if(gesture.type==='pinch'&&values.length>=2){const[a,b]=values,px=(a.x+b.x)/2,py=(a.y+b.y)/2;camera.scale=Math.max(5,Math.min(200000,gesture.cam.scale*Math.hypot(a.x-b.x,a.y-b.y)/gesture.distance));const wx=gesture.cam.x+(gesture.x-viewport.w/2)/gesture.cam.scale,wy=gesture.cam.y-(gesture.y-viewport.h/2)/gesture.cam.scale;camera.x=wx-(px-viewport.w/2)/camera.scale;camera.y=wy+(py-viewport.h/2)/camera.scale;}else{camera.x=gesture.cam.x-(values[0].x-gesture.x)/camera.scale;camera.y=gesture.cam.y+(values[0].y-gesture.y)/camera.scale;}updateZoom();scheduleRender();});
  function releasePointer(e){pointers.delete(e.pointerId);startGesture();}canvas.addEventListener('pointerup',releasePointer);canvas.addEventListener('pointercancel',releasePointer);canvas.addEventListener('lostpointercapture',releasePointer);
  canvas.addEventListener('wheel',e=>{e.preventDefault();const r=canvas.getBoundingClientRect();zoom(Math.exp(-Math.max(-100,Math.min(100,e.deltaY))*.0025),e.clientX-r.left,e.clientY-r.top);},{passive:false});
  $('zoomIn').onclick=()=>zoom(1.3);$('zoomOut').onclick=()=>zoom(1/1.3);$('fitBtn').onclick=fit;
  $('gridBtn').onclick=()=>{grid=!grid;$('gridBtn').setAttribute('aria-pressed',String(grid));scheduleRender();};
  $('fullscreenBtn').hidden=!document.fullscreenEnabled;
  $('fullscreenBtn').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.querySelector('.workspace').requestFullscreen();}catch{toast('Schermo intero non disponibile in questa finestra.');}};
  function stopAnimation(){if(!animation)return;clearTimeout(animation.timer);state.iterations=animation.target;animation=null;$('playIcon').textContent='▶';$('playLabel').textContent='Guarda come nasce';$('playBtn').setAttribute('aria-pressed','false');$('iterations').value=state.iterations;$('iterationValue').textContent=state.iterations;requestGeometry();}
  function toggleAnimation(){
    if(animation){stopAnimation();return;}
    const max=E.generate(state.folds,state.iterations,state.mirror).iterations;
    if(max===0){toast('Aumenta le iterazioni per animare la costruzione.');return;}
    animation={target:state.iterations,step:0,timer:null};$('playIcon').textContent='Ⅱ';$('playLabel').textContent='La forma sta nascendo';$('playBtn').setAttribute('aria-pressed','true');
    const tick=()=>{if(!animation)return;if(busy){animation.timer=setTimeout(tick,100);return;}if(animation.step>max){animation.timer=setTimeout(()=>{stopAnimation();},900);return;}state.iterations=animation.step++;$('iterations').value=state.iterations;requestGeometry();animation.timer=setTimeout(tick,850);};tick();
  }
  $('playBtn').onclick=toggleAnimation;document.addEventListener('visibilitychange',()=>{if(document.hidden)stopAnimation();});

  // Dialogs, local collection, and portable project files.
  function openDialog(id){stopAnimation();$(id).showModal();}
  document.querySelectorAll('.close-dialog').forEach(b=>b.onclick=()=>b.closest('dialog').close());
  document.querySelectorAll('dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();}}));
  $('helpBtn').onclick=()=>openDialog('helpDialog');
  $('saveBtn').onclick=()=>{openDialog('saveDialog');$('saveName').value=state.name;$('saveName').focus();$('saveName').select();};
  function thumbnail(){const c=document.createElement('canvas');c.width=480;c.height=300;paint(c.getContext('2d'),480,300,fitFor(geometry.bounds,480,300,.8),{lines:1.2});return c.toDataURL('image/jpeg',.65);}
  function saveGallery(next){try{localStorage.setItem(storage.gallery,JSON.stringify(next));gallery=next;updateGalleryCount();return true;}catch{toast('Spazio del browser esaurito. Esporta il progetto JSON per conservarlo.');return false;}}
  function updateGalleryCount(){$('galleryCount').textContent=gallery.length;}
  $('saveForm').onsubmit=e=>{e.preventDefault();if(busy){toast('Attendi un momento: il disegno si sta aggiornando.');return;}if(gallery.length>=24){toast('Raccolta piena: esporta o elimina una creazione per fare spazio.');return;}const name=$('saveName').value.trim();if(!name){$('saveName').focus();return;}const project=clone({...state,name});const next=[{id:crypto.randomUUID?crypto.randomUUID():`${Date.now()}-${Math.random()}`,project,thumbnail:thumbnail(),date:new Date().toISOString()},...gallery];if(saveGallery(next)){state.name=name;syncUI();commit();$('saveDialog').close();toast('Creazione salvata nella tua raccolta.');}};
  function renderGallery(){const list=$('galleryList');list.replaceChildren();if(!gallery.length){const empty=document.createElement('div');empty.className='empty-gallery';empty.textContent='La tua raccolta comincia da una piega. Salva una creazione e la ritroverai qui.';list.append(empty);}for(const item of gallery){const card=document.createElement('article');card.className='gallery-card';const open=document.createElement('button');open.className='gallery-open';open.setAttribute('aria-label',`Apri ${item.project.name}`);const img=document.createElement('img');img.src=item.thumbnail;img.alt='';if(!item.thumbnail)img.hidden=true;const name=document.createElement('strong');name.textContent=item.project.name;open.append(img,name);open.onclick=()=>{loadProject(item.project);$('galleryDialog').close();toast('Creazione riaperta. Continua a esplorare.');};const footer=document.createElement('div');footer.className='gallery-card-footer';const date=document.createElement('span');date.textContent=Number.isFinite(Date.parse(item.date))?new Date(item.date).toLocaleDateString('it-IT'):'';const remove=document.createElement('button');remove.textContent='Elimina';remove.setAttribute('aria-label',`Elimina ${item.project.name}`);remove.onclick=()=>{if(saveGallery(gallery.filter(g=>g.id!==item.id))){renderGallery();toast('Creazione rimossa dalla raccolta.');}};footer.append(date,remove);card.append(open,footer);list.append(card);}}
  $('galleryBtn').onclick=()=>{renderGallery();openDialog('galleryDialog');};
  document.querySelector('.import-button').addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();$('importFile').click();}});
  $('importFile').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>32768)throw new Error('Il progetto è troppo grande (massimo 32 KB).');const project=E.validateProject(JSON.parse(await file.text()));loadProject(project);$('galleryDialog').close();toast('Progetto importato. Salvalo per aggiungerlo alla raccolta.');}catch(error){toast(error instanceof SyntaxError?'Il file non contiene JSON valido.':error.message);}e.target.value='';};
  $('exportBtn').onclick=()=>{if(busy){toast('Attendi il completamento del disegno.');return;}openDialog('exportDialog');};
  function download(blob,extension){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`forma-${state.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'creazione'}.${extension}`;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);}
  function exportReady(){if(busy){toast('Il disegno si sta aggiornando. Riprova tra un momento.');return false;}return true;}
  $('exportPng').onclick=()=>{if(!exportReady())return;const c=document.createElement('canvas');c.width=2400;c.height=1800;paint(c.getContext('2d'),2400,1800,fitFor(geometry.bounds,2400,1800,.82),{lines:state.lineWidth*2});c.toBlob(blob=>{if(blob){download(blob,'png');toast('Immagine PNG esportata.');}else toast('Esportazione non riuscita.');},'image/png');};
  $('exportSvg').onclick=()=>{if(!exportReady())return;const w=1600,h=1200,view=fitFor(geometry.bounds,w,h,.82),pts=geometry.points,count=geometry.count,batches=Math.min(count,96);let paths='';for(let part=0;part<batches;part++){const start=Math.floor(part*count/batches),end=Math.floor((part+1)*count/batches);let d='';for(let i=start;i<=end;i++){const x=(pts[i*2]-view.x)*view.scale+w/2,y=h/2-(pts[i*2+1]-view.y)*view.scale;d+=`${i===start?'M':'L'}${x.toFixed(3)},${y.toFixed(3)}`;}paths+=`<path d="${d}" stroke="${colors(part/Math.max(1,batches-1))}"/>`;}download(new Blob([`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="100%" height="100%" fill="#111515"/><g fill="none" stroke-width="${state.lineWidth*1.5}" stroke-linejoin="round" stroke-linecap="round">${paths}</g></svg>`],{type:'image/svg+xml'}),'svg');toast('Disegno vettoriale esportato.');};
  $('exportJson').onclick=()=>{download(new Blob([JSON.stringify(state,null,2)],{type:'application/json'}),'json');toast('Progetto esportato. Puoi reimportarlo dalla raccolta.');};
  document.addEventListener('keydown',e=>{const editing=e.target.closest('input,select,textarea,[contenteditable]');if(editing||document.querySelector('dialog[open]'))return;if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();undo(e.shiftKey?1:-1);}else if(e.key.toLowerCase()==='f'&&!e.ctrlKey&&!e.metaKey){e.preventDefault();fit();}else if(e.code==='Space'&&e.target===document.body||e.code==='Space'&&e.target===canvas){e.preventDefault();toggleAnimation();}else if(e.key==='?'){openDialog('helpDialog');}});
  new ResizeObserver(()=>{resize();updateZoom();}).observe(document.querySelector('main'));
  window.addEventListener('resize',resize);document.addEventListener('fullscreenchange',resize);
  window.addEventListener('pagehide',()=>{try{localStorage.setItem(storage.draft,JSON.stringify({...state,iterations:animation?animation.target:state.iterations}));}catch{}});
  resize();syncUI();commit();updateGalleryCount();requestGeometry(true);
})();
