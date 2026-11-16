/* Layout, contextual controls and exploration. The controller owns project state. */
(function(root){
  'use strict';
  root.FormaExperience=function(api){
    const $=id=>document.getElementById(id),E=root.FractalEngine,R=root.FractalRenderer,C=root.FractalConstraints,clone=value=>JSON.parse(JSON.stringify(value));
    let ifsLayout=false,layoutView=null,handleDrag=null,currentPreset=null,variants=[],transition=0,recorder=null;
    const node=(tag,className,text)=>{const n=document.createElement(tag);if(className)n.className=className;if(text!==undefined)n.textContent=text;return n;};
    const button=(id,text,action,className='quiet small')=>{const b=node('button',className,text);b.id=id;b.type='button';if(action)b.onclick=action;return b;};
    function dialog(id,title){const d=node('dialog','wide-dialog');d.id=id;const heading=node('div','dialog-heading'),h=node('h2','',title);h.id=id+'Title';const close=button(id+'Close','×',()=>d.close(),'icon-button');close.setAttribute('aria-label','Chiudi');heading.append(h,close);d.append(heading);d.setAttribute('aria-labelledby',h.id);document.body.append(d);d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();}});return d;}
    function field(parent,id,label,value,{type='number',min,max,step='any',change}={}){
      const wrap=node('label','experience-field'),caption=node('span','',label),input=document.createElement('input');input.id=id;input.type=type;input.value=value;input.step=step;if(min!==undefined)input.min=min;if(max!==undefined)input.max=max;
      input.onchange=()=>{if(type==='number'&&(!input.validity.valid||!Number.isFinite(input.valueAsNumber))){api.toast('Valore non valido: '+label);sync();return;}change?.(type==='number'?input.valueAsNumber:input.value);};wrap.append(caption,input);parent.append(wrap);return input;
    }
    function select(parent,id,label,options,change){const wrap=node('label','experience-field'),caption=node('span','',label),input=node('select');input.id=id;for(const [value,text] of options)input.add(new Option(text,value));input.onchange=()=>change(input.value);wrap.append(caption,input);parent.append(wrap);return input;}
    function toggle(parent,id,label,change){const wrap=node('label','experience-check'),input=node('input');input.type='checkbox';input.id=id;input.onchange=()=>change(input.checked);wrap.append(input,document.createTextNode(label));parent.append(wrap);return input;}
    function panel(parent,id,title,open=false){const d=node('details','experience-panel');d.id=id;d.open=open;d.append(node('summary','',title));const content=node('div','panel-content');d.append(content);parent.append(d);d.addEventListener('toggle',()=>window.dispatchEvent(new Event('resize')));return content;}
    const controls=document.querySelector('.controls'),rules=$('generatorMode').closest('section'),settings=document.querySelector('.settings-section');
    document.querySelector('.intro').hidden=true;document.querySelector('.sidebar-bottom').remove();
    const heading=node('div','lab-heading'),eyebrow=node('span','eyebrow','IL LABORATORIO'),h1=node('h1','','Disegna la tua regola');heading.append(eyebrow,h1);controls.prepend(heading);
    const actions=node('div','lab-actions'),presetButton=button('presetBtn','Scegli un esempio',()=>api.open('presetDialog'),'quiet');actions.append(presetButton,$('saveBtn'));heading.append(actions);
    const draft=node('p','draft-status');draft.id='draftStatus';heading.append(draft);
    rules.querySelector('.section-heading h2').textContent='Regola di crescita';
    for(const option of $('generatorMode').options)if(option.value==='free')option.textContent='Piega e raddoppia';
    const hint=node('p','context-hint');hint.id='methodHint';$('generatorMode').closest('label').after(hint);
    const presetsDialog=dialog('presetDialog','Trova una forma da esplorare');
    const filters=node('div','preset-filters');presetsDialog.append(filters);
    const familyFilter=select(filters,'presetFamily','Esplora',[['beginner','Per cominciare'],['all','Tutti gli esempi'],['curves','Curve e contorni'],['organic','Crescita organica'],['symmetry','Simmetrie'],['folds','Piegature e texture'],['copies','Copie autosimili'],['grammar','Grammatiche']],filterPresets);
    const search=field(filters,'presetSearch','Cerca un esempio','',{type:'search'});search.oninput=filterPresets;
    const presetSection=document.querySelector('.presets-section');presetsDialog.append(presetSection);presetSection.querySelector('.section-heading').hidden=true;presetSection.querySelector('.preset-save-row').hidden=true;
    $('presets-custom').parentElement.hidden=true;
    for(const p of root.FormaPresets.presets){const b=document.querySelector('.preset[data-id="'+p.id+'"]');const original=b.onclick;b.onclick=()=>{currentPreset=p;original();presetsDialog.close();controls.scrollTo({top:0,behavior:'smooth'});};const description=node('span','preset-description',p.hint);b.append(description);}
    function filterPresets(){const family=familyFilter.value,query=search.value.toLocaleLowerCase('it');for(const b of document.querySelectorAll('.preset:not([data-custom=true])'))b.hidden=!(family==='all'||family==='beginner'&&b.dataset.beginner==='true'||b.dataset.family===family)||!b.title.toLocaleLowerCase('it').includes(query);for(const section of presetSection.querySelectorAll('.preset-family')){if(section.contains($('presets-custom')))continue;section.hidden=![...section.querySelectorAll('.preset')].some(b=>!b.hidden);}}
    filterPresets();
    // The result and timeline have their own space; controls do not cover the drawing.
    const workspace=document.querySelector('.workspace'),surface=node('div','drawing-surface');
    while(workspace.firstChild)surface.append(workspace.firstChild);workspace.append(surface);
    const timeline=node('div','timeline');timeline.id='timeline';workspace.append(timeline);
    const iterationRow=node('div','iteration-heading'),iterationLabel=node('label','','Generazioni');iterationLabel.htmlFor='iterations';iterationRow.append(iterationLabel,$('iterationValue'));timeline.append(iterationRow,$('iterations'),document.querySelector('.playbar'));
    settings.querySelector('.section-heading').remove();settings.querySelector('.range-labels').remove();
    const playbackOptions=node('div','playback-options');timeline.append(playbackOptions);
    select(playbackOptions,'animationSpeed','Velocità',[['900','Lenta'],['650','Normale'],['300','Veloce'],['150','Molto veloce']],()=>{}).value='650';
    toggle(playbackOptions,'loopAnimation','Ripeti',()=>{});
    const mobileToggle=button('settingsToggle','Regola e stile',()=>{document.body.classList.toggle('settings-collapsed');mobileToggle.setAttribute('aria-expanded',String(!document.body.classList.contains('settings-collapsed')));window.dispatchEvent(new Event('resize'));});mobileToggle.setAttribute('aria-expanded','true');document.querySelector('.header-actions').prepend(mobileToggle);
    const style=panel(controls,'stylePanel','Colore e tratto');style.append(settings);settings.querySelectorAll('h2').forEach(h=>h.remove());
    const exploration=panel(controls,'explorationPanel','Vista e confronto dei livelli');
    exploration.append($('previousLayerControl'),$('ghostStyleControls'));
    toggle(exploration,'nextLayer','Mostra la prossima generazione',value=>{api.setView({showNext:value});});
    select(exploration,'cameraMode','Inquadratura',[['adaptive','Adatta alla crescita'],['fixed','Camera fissa']],value=>api.setView({adaptiveCamera:value==='adaptive'}));
    select(settings,'structureColor','Distribuzione del colore',[['spatial','Nello spazio'],['generation','Per generazione'],['family','Per ramo o copia']],value=>api.change(p=>p.structureColor=value,{geometry:false}));
    const construction=panel(rules,'advancedGeometry','Lunghezze, angoli e vincoli');construction.append($('polylineRules'));
    for(const detail of construction.querySelectorAll('details'))detail.open=false;
    const utilities=node('div','rule-utilities');rules.querySelector('.editor-footer').after(utilities);
    toggle(utilities,'snapPoints','Aggancia alla griglia',value=>{try{localStorage.setItem('forma.snap.v1',String(value));}catch{}});
    try{$('snapPoints').checked=localStorage.getItem('forma.snap.v1')==='true';}catch{}
    utilities.append(button('mirrorRule','Specchia regola',()=>api.change(p=>{p.folds=p.folds.map(v=>({u:v.u,v:-v.v}));p.endpoint.v=-p.endpoint.v;p.constraints=C.empty(p.folds.length);})),button('straightRule','Raddrizza',()=>api.change(p=>{p.folds=p.folds.map((_,i)=>({u:p.endpoint.u*(i+1)/(p.folds.length+1),v:p.endpoint.v*(i+1)/(p.folds.length+1)}));p.constraints=C.empty(p.folds.length);})));
    // Composition is independent from the replacement rule.
    const composition=panel(rules,'compositionPanel','Figura iniziale e simmetrie',true);
    select(composition,'compositionKind','Figura iniziale',[['segment','Segmento'],['polygon','Poligono chiuso'],['radial','Raggiera']],value=>api.change(p=>{p.composition.kind=value;if(value==='polygon')p.composition.count=Math.max(3,p.composition.count);}));
    field(composition,'compositionCount','Lati o bracci',6,{min:1,max:12,step:1,change:value=>api.change(p=>p.composition.count=value)});
    field(composition,'compositionAngle','Orientamento (°)',0,{min:-360,max:360,change:value=>api.change(p=>p.composition.angle=value)});
    toggle(composition,'compositionReflect','Specchia ogni settore',value=>api.change(p=>p.composition.reflect=value));
    toggle(composition,'compositionInward','Sviluppa verso l’interno',value=>api.change(p=>p.composition.inward=value));
    // Guided branch controls retain access to the original per-branch editor.
    const growth=panel(rules,'growthPanel','Portamento e crescita',true);
    toggle(growth,'linkedBranches','Collega i rami a coppie specchiate',value=>api.change(p=>{p.growth.linked=value;if(value)for(let i=0;i+1<p.branches.length;i+=2)p.branches[i+1]={...p.branches[i],angle:-p.branches[i].angle};}));
    for(const [id,label,key,min,max,step] of [['branchSpread','Apertura della chioma','spread',.2,2,.05],['branchDominance','Ramo dominante','dominance',.5,1.5,.05],['levelAngle','Variazione angolare per livello (°)','levelAngle',-20,20,1],['levelScale','Rapporto di scala tra livelli','levelScale',.8,1.05,.01],['branchJitter','Irregolarità','jitter',0,.3,.01],['randomSeed','Seme della crescita','seed',0,4294967295,1]])field(growth,id,label,0,{min,max,step,change:value=>api.change(p=>p.growth[key]=value)});
    toggle(growth,'alternateSectors','Alterna il verso dei bracci radiali',value=>api.change(p=>p.growth.alternate=value));
    // Piegature: fixed legacy operations remain available, sequences are explicit.
    const folding=panel(rules,'sequencePanel','Sequenza di piegature');
    folding.append(node('p','micro-hint','La sequenza si ripete a ogni generazione. Tutti gli angoli positivi sono antiorari.'));
    const sequenceList=node('div');sequenceList.id='sequenceList';folding.append(sequenceList,button('addSequenceStep','+ Passo',()=>api.change(p=>{if(p.foldSequence.length>=12)throw new Error('Sono consentiti al massimo 12 passi.');if(!p.foldSequence.length)p.foldSequence.push({kind:p.transformKind,angle:p.transformAngle});p.foldSequence.push({kind:'rotate',angle:90});})),button('clearSequence','Usa una sola trasformazione',()=>api.change(p=>p.foldSequence=[])));
    const foldNotice=node('p','context-hint');foldNotice.id='foldNotice';$('globalControls').append(foldNotice);
    const globalHint=$('globalControls').querySelector('.micro-hint');globalHint.textContent='La copia dell’intero disegno si aggancia al terminale. Rotazioni positive: antiorario. In riflessione, l’angolo orienta l’asse dorato, trascinabile nell’editor.';
    $('transformKind').options[1].textContent='Specchio · fregi';
    // IFS exposes both the seed and the layout of its copies.
    const ifsPanel=panel(rules,'ifsPanel','Copie autosimili',true);
    select(ifsPanel,'ifsEditorMode','Editor',[['seed','Disegna la forma iniziale'],['copies','Disponi le copie']],value=>{ifsLayout=value==='copies';api.draw();sync();});
    toggle(ifsPanel,'ifsClosed','Chiudi il contorno',value=>api.change(p=>p.ifs.closed=value));toggle(ifsPanel,'ifsFill','Riempi le forme',value=>api.change(p=>p.ifs.fill=value));
    ifsPanel.append(node('p','micro-hint','Nella vista delle copie trascina i punti numerati. Scala, rotazione e inclinazione sono modificabili sotto.'));
    const ifsRows=node('div');ifsRows.id='ifsRows';ifsPanel.append(ifsRows,button('addIFSCopy','+ Copia',()=>api.change(p=>{if(p.ifs.transforms.length>=8)throw new Error('Sono consentite al massimo 8 copie.');p.ifs.transforms.push({x:.25,y:.25,scaleX:.4,scaleY:.4,angle:0,shear:0,reflect:false});})));
    const grammar=panel(rules,'grammarPanel','Regole L-system',true);
    grammar.append(node('p','micro-hint','F e G disegnano, f avanza senza disegnare; + e − ruotano. [ salva la posizione, ] la ripristina. Le altre lettere vengono riscritte dalle regole.'));
    field(grammar,'lsAxiom','Assioma','F',{type:'text',change:value=>api.change(p=>p.lsystem.axiom=value.trim())});
    const production=node('label','experience-field'),productionCaption=node('span','','Una regola per riga: simbolo = sostituzione'),productionInput=node('textarea');productionInput.id='lsRules';productionInput.rows=4;productionInput.spellcheck=false;productionInput.onchange=()=>api.change(p=>{const entries=productionInput.value.split(/\r?\n/).filter(x=>x.trim()).map(line=>{const match=line.match(/^\s*([A-Za-z])\s*=\s*(.+?)\s*$/);if(!match)throw new Error('Scrivi ogni regola nella forma F = F[+F]F[-F]F');return [match[1],match[2]];});if(new Set(entries.map(e=>e[0])).size!==entries.length)throw new Error('Ogni simbolo deve avere una sola regola.');p.lsystem.rules=Object.fromEntries(entries);});production.append(productionCaption,productionInput);grammar.append(production);
    for(const [id,label,key,min,max] of [['lsAngle','Angolo di svolta (°)','angle',-180,180],['lsScale','Scala del passo a ogni livello','stepScale',.1,1],['lsHeading','Direzione iniziale (°)','heading',-360,360]])field(grammar,id,label,0,{min,max,change:value=>api.change(p=>p.lsystem[key]=value)});
    // Preset-specific controls are also useful on user-created rules.
    const macro=panel(rules,'macroPanel','Prova una variazione guidata',true);
    field(macro,'shapeHeight','Altezza rispetto ad AB (%)',30,{min:0,max:250,step:'any',change:value=>api.change(p=>{const b=p.endpoint,den=b.u*b.u+b.v*b.v,local=p.folds.map(v=>({u:(v.u*b.u+v.v*b.v)/den,v:(v.v*b.u-v.u*b.v)/den})),height=Math.max(...local.map(v=>Math.abs(v.v))),target=value/100;p.folds=local.map((v,i)=>{const y=height>1e-9?v.v*target/height:i===Math.floor(local.length/2)?target:0;return {u:v.u*b.u-y*b.v,v:v.u*b.v+y*b.u};});const solved=C.solve(p.folds,p.endpoint,p.constraints,p.origin);if(!solved.ok)throw new Error(solved.message);p.folds=solved.folds;p.endpoint=solved.endpoint;})});
    // Variation comparison preserves locked parameter categories.
    const variationPanel=panel(controls,'variationPanel','Esplora variazioni',true);
    field(variationPanel,'variationIntensity','Intensità (%)',25,{min:5,max:100,step:5});
    toggle(variationPanel,'lockVariationSeed','Proteggi la forma iniziale',()=>{});toggle(variationPanel,'lockVariationRule','Proteggi la regola di crescita',()=>{});toggle(variationPanel,'lockVariationColor','Proteggi i colori',()=>{}).checked=true;
    variationPanel.append(button('varyBtn','Confronta quattro varianti',showVariations,'accent'));
    variationPanel.append($('randomBtn'));$('randomBtn').textContent='Sorprendimi nella modalità corrente ↗';
    const oldRandom=$('randomBtn').onclick;$('randomBtn').onclick=()=>{if(['polyline','branches','free'].includes(api.get().mode)){oldRandom();return;}const matching=root.FormaPresets.presets.filter(p=>p.mode===api.get().mode);const p=matching[Math.floor(Math.random()*matching.length)];currentPreset=p;api.load(root.FormaPresets.projectForPreset(p));};
    const compareDialog=dialog('compareDialog','Scegli la prossima direzione'),variantGrid=node('div','variant-grid');variantGrid.id='variantGrid';compareDialog.append(node('p','micro-hint','Ogni variante rispetta i gruppi di parametri protetti. Puoi aprirla oppure osservare la transizione dalla forma attuale.'),variantGrid);
    const transitionStop=button('cancelTransition','Ferma la transizione',()=>{transition++;transitionStop.hidden=true;api.commit();});transitionStop.hidden=true;heading.append(transitionStop);
    function variation(project,strength,random){
      const p=clone(project),delta=()=>random()*2-1;
      if(!$('lockVariationSeed').checked&&p.mode!=='lsystem'){
        p.folds=p.folds.map(v=>({u:Math.max(-1000,Math.min(1000,v.u+delta()*.2*strength)),v:Math.max(-1000,Math.min(1000,v.v+delta()*.4*strength))}));
        if(['polyline','free'].includes(p.mode)){const solved=C.solve(p.folds,p.endpoint,p.constraints,p.origin);if(!solved.ok)throw new Error(solved.message);p.folds=solved.folds;p.endpoint=solved.endpoint;}
      }
      if(!$('lockVariationRule').checked){
        if(p.mode==='branches'){p.branches=p.branches.map(r=>({...r,angle:Math.max(-180,Math.min(180,r.angle+delta()*30*strength)),ratio:Math.max(.05,Math.min(1.25,r.ratio+delta()*.12*strength))}));if(p.growth.linked)for(let i=0;i+1<p.branches.length;i+=2)p.branches[i+1]={...p.branches[i],angle:-p.branches[i].angle};p.growth.seed=Math.floor(random()*4294967295);}
        else if(p.mode==='free'){p.transformAngle=Math.max(-360,Math.min(360,p.transformAngle+delta()*50*strength));p.foldSequence=p.foldSequence.map(s=>({...s,angle:Math.max(-360,Math.min(360,s.angle+delta()*30*strength))}));}
        else if(p.mode==='ifs')p.ifs.transforms=p.ifs.transforms.map(t=>({...t,x:Math.max(-4,Math.min(4,t.x+delta()*.3*strength)),y:Math.max(-4,Math.min(4,t.y+delta()*.3*strength)),angle:Math.max(-360,Math.min(360,t.angle+delta()*35*strength))}));
        else if(p.mode==='lsystem')p.lsystem.angle=Math.max(-180,Math.min(180,p.lsystem.angle+delta()*35*strength));
        else if(p.composition.kind!=='segment')p.composition.angle=Math.max(-360,Math.min(360,p.composition.angle+delta()*45*strength));
        else if(p.directions.length>1&&random()<strength)p.directions[Math.floor(random()*p.directions.length)]*=-1;
      }
      if(!$('lockVariationColor').checked){const hex=()=> '#'+Math.floor(random()*16777216).toString(16).padStart(6,'0');p.colorStart=R.color({...p,colorEnd:hex()},strength);p.colorEnd=hex();}
      return E.upgradeProject(p);
    }
    function showVariations(){
      if(api.isBusy()){api.toast('Attendi il completamento del disegno.');return;}
      if(!$('variationIntensity').validity.valid||!Number.isFinite($('variationIntensity').valueAsNumber)){api.toast('Scegli un’intensità tra 5% e 100%.');return;}
      if($('lockVariationSeed').checked&&$('lockVariationRule').checked&&$('lockVariationColor').checked){api.toast('Sblocca almeno un gruppo di parametri.');return;}
      api.stop();variantGrid.replaceChildren();variants=[];const random=E.rng(crypto.getRandomValues(new Uint32Array(1))[0]),source=api.get();
      for(let i=0;i<4;i++){let candidate;for(let attempt=0;attempt<20;attempt++)try{candidate=variation(source,Number($('variationIntensity').value)/100,random);break;}catch{}if(!candidate){api.toast('I vincoli attivi non consentono queste variazioni.');return;}candidate.name=(source.name+' · variante '+(i+1)).slice(0,60);variants.push(candidate);
        const card=node('article','variant-card'),preview=node('canvas');preview.width=480;preview.height=280;const g=E.generateProject({...candidate,iterations:Math.min(candidate.iterations,8)},4096);R.draw(preview.getContext('2d'),480,280,R.fit(g.bounds,480,280),g,candidate);const actions=node('div','variant-actions');actions.append(button('chooseVariant'+i,'Apri variante '+(i+1),()=>{api.resetIdentity();api.load(candidate);compareDialog.close();}),button('morphVariant'+i,'Anima transizione',()=>morphTo(candidate)));card.append(preview,actions);variantGrid.append(card);
      }api.open('compareDialog');
    }
    async function morphTo(target){
      const original=clone(api.get());if(original.mode!==target.mode||original.folds.length!==target.folds.length){api.load(target);compareDialog.close();return;}
      const token=++transition;compareDialog.close();transitionStop.hidden=false;api.resetIdentity();let expected=E.geometryKey(api.get());
      for(let frame=1;frame<=20;frame++){
        if(token!==transition||E.geometryKey(api.get())!==expected)break;
        const t=frame/20,p=clone(original),mix=(a,b)=>a+(b-a)*t;p.folds=p.folds.map((v,i)=>({u:mix(v.u,target.folds[i].u),v:mix(v.v,target.folds[i].v)}));
        p.transformAngle=mix(p.transformAngle,target.transformAngle);p.branches=p.branches.map((r,i)=>({...r,angle:mix(r.angle,target.branches[i].angle),ratio:mix(r.ratio,target.branches[i].ratio)}));p.ifs.transforms=p.ifs.transforms.map((r,i)=>({...r,x:mix(r.x,target.ifs.transforms[i].x),y:mix(r.y,target.ifs.transforms[i].y),angle:mix(r.angle,target.ifs.transforms[i].angle)}));p.lsystem.angle=mix(p.lsystem.angle,target.lsystem.angle);p.colorStart=R.color({colorStart:original.colorStart,colorEnd:target.colorStart,colorMiddle:null},t);p.colorEnd=R.color({colorStart:original.colorEnd,colorEnd:target.colorEnd,colorMiddle:null},t);
        if(['polyline','free'].includes(p.mode)){const solved=C.solve(p.folds,p.endpoint,p.constraints,p.origin);if(solved.ok){p.folds=solved.folds;p.endpoint=solved.endpoint;}}
        try{api.replaceTransient(frame===20?target:p);}catch{break;}expected=E.geometryKey(api.get());await new Promise(r=>setTimeout(r,70));
      }transitionStop.hidden=true;api.commit();
    }
    // One collection, with backup and persistent recovery.
    const galleryHeading=$('galleryDialog').querySelector('h2');galleryHeading.textContent='Le mie creazioni';
    const libraryTools=node('div','library-tools');libraryTools.append(button('backupLibrary','Scarica backup completo',()=>api.download(new Blob([JSON.stringify(api.library.backup(),null,2)],{type:'application/json'}),'raccolta.json')));$('galleryList').before(libraryTools);
    document.querySelector('.import-button').firstChild.textContent='↑ Importa progetto o backup JSON';
    const trashContent=panel($('galleryDialog'),'trashPanel','Cestino e recupero');const trashList=node('div');trashList.id='trashList';trashContent.append(trashList);
    const restoreLast=button('restoreLastDeleted','Recupera l’ultima eliminazione',async()=>{const item=api.library.trash[0];if(item)await restore(item.id);});restoreLast.hidden=true;heading.append(restoreLast);
    async function restore(id){try{await api.library.restore(id);api.refreshLibrary();api.toast('Creazione recuperata.');}catch(error){api.toast(error.message);}}
    const destination=select($('saveForm'),'saveDestination','Conserva la creazione',[['auto','Automatico'],['browser','In questo browser'],['project','Nei file del progetto locale']],()=>{});$('saveStatus').before(destination.closest('label'));
    function syncLibrary(){
      restoreLast.hidden=!api.library.trash.length;trashList.replaceChildren();
      if(!api.library.trash.length)trashList.append(node('p','micro-hint','Il cestino è vuoto.'));
      for(const item of api.library.trash){const row=node('div','trash-row');row.append(node('span','',item.project.name),button('restore-'+item.id,'Recupera',()=>restore(item.id)));trashList.append(row);}
      destination.options[2].disabled=!api.library.server;
      const status=api.library.server?'Salvataggio nei file del progetto disponibile.':'Le creazioni si salvano nel browser; usa il backup per trasferirle.';libraryTools.setAttribute('aria-label',status);$('customPresetInfo').textContent=status;
    }
    // Export controls share the same renderer as the live scene.
    const exportSettings=node('div','export-settings');$('exportDialog').querySelector('.export-options').before(exportSettings);
    field(exportSettings,'exportWidth','Larghezza (px)',2400,{min:128,max:8192,step:1});field(exportSettings,'exportHeight','Altezza (px)',1800,{min:128,max:8192,step:1});toggle(exportSettings,'exportTransparent','Sfondo trasparente',()=>{});
    select(exportSettings,'exportStroke','Tratto nell’esportazione',[['1','Come sullo schermo'],['1.5','Medio · 1,5×'],['2','Grande · 2×']],()=>{}).value='2';
    const recordButton=button('exportVideo','Registra la crescita · WebM',recordAnimation);recordButton.hidden=!(root.MediaRecorder&&$('fractal').captureStream);$('exportDialog').querySelector('.export-options').append(recordButton);
    const stopRecord=button('stopRecording','Ferma e scarica il video',()=>recorder?.stop(),'accent');stopRecord.hidden=true;timeline.append(stopRecord);
    async function recordAnimation(){
      if(api.isBusy())return;const canvas=$('fractal'),stream=canvas.captureStream(30),chunks=[];let stopTimer,poll;
      try{const mime=['video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm'].find(type=>MediaRecorder.isTypeSupported(type));if(!mime)throw new Error('Registrazione WebM non supportata.');recorder=new MediaRecorder(stream,{mimeType:mime});recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};recorder.onstop=()=>{clearTimeout(stopTimer);clearInterval(poll);stream.getTracks().forEach(track=>track.stop());stopRecord.hidden=true;api.download(new Blob(chunks,{type:mime}),'webm');recorder=null;};$('exportDialog').close();$('loopAnimation').checked=false;recorder.start();stopRecord.hidden=false;api.play();poll=setInterval(()=>{if($('playBtn').getAttribute('aria-pressed')==='false'&&recorder?.state==='recording')recorder.stop();},500);stopTimer=setTimeout(()=>{if(recorder?.state==='recording')recorder.stop();},30000);}catch(error){stream.getTracks().forEach(t=>t.stop());api.toast(error.message);}
    }
    // All dialogs have explicit names, including existing HTML dialogs.
    for(const d of document.querySelectorAll('dialog')){const h=d.querySelector('h2');if(h){h.id=h.id||d.id+'Title';d.setAttribute('aria-labelledby',h.id);}}
    const help=$('helpDialog');help.querySelector('p').textContent='Cinque modi per costruire: sostituisci i lati, fai crescere rami, piega e raddoppia, disponi copie autosimili oppure descrivi una grammatica.';
    help.querySelector('.help-steps').replaceChildren();for(const [title,text] of [['Scegli un esempio','Apri gli esempi e filtra per famiglia. La regola è subito disponibile nel pannello.'],['Modifica e confronta','Trascina i punti, usa i controlli guidati e osserva il livello successivo. Tutti gli angoli positivi sono antiorari.'],['Conserva ed esplora','Salva nella raccolta unica, confronta varianti e scarica un backup. Le eliminazioni sono recuperabili dal cestino.']]){const li=node('li');li.append(node('b','',title),node('span','',text));help.querySelector('.help-steps').append(li);}
    const helpLast=help.querySelectorAll('p');helpLast[helpLast.length-1].textContent='I progetti delle versioni precedenti vengono convertiti conservando la geometria. Le preferenze della vista restano separate dalla ricetta della forma.';
    function syncSequence(p){
      sequenceList.replaceChildren();p.foldSequence.forEach((step,i)=>{const row=node('div','sequence-row');select(row,'sequenceKind'+i,'Passo '+(i+1),[['rotate','Ruota'],['reflect','Specchia']],value=>api.change(p=>p.foldSequence[i].kind=value)).value=step.kind;field(row,'sequenceAngle'+i,'Angolo (°)',step.angle,{min:-360,max:360,change:value=>api.change(p=>p.foldSequence[i].angle=value)});row.append(button('removeSequence'+i,'−',()=>api.change(p=>p.foldSequence.splice(i,1))));sequenceList.append(row);});
    }
    function syncIFS(p){
      ifsRows.replaceChildren();p.ifs.transforms.forEach((t,i)=>{const card=node('details','ifs-card');card.open=i===0;card.append(node('summary','','Copia '+(i+1)));const body=node('div','ifs-fields');
        for(const [key,label,min,max,factor] of [['x','X',-4,4,1],['y','Y',-4,4,1],['scaleX','Scala X (%)',0,98,100],['scaleY','Scala Y (%)',0,98,100],['angle','Rotazione (°)',-360,360,1],['shear','Inclinazione',-.8,.8,1]])field(body,'ifs-'+i+'-'+key,label,t[key]*factor,{min,max,change:value=>api.change(p=>p.ifs.transforms[i][key]=value/factor)});
        toggle(body,'ifs-flip-'+i,'Specchia',value=>api.change(p=>p.ifs.transforms[i].reflect=value)).checked=t.reflect;const remove=button('removeIFSCopy'+i,'Elimina copia',()=>api.change(p=>p.ifs.transforms.splice(i,1)));remove.disabled=p.ifs.transforms.length===1;body.append(remove);card.append(body);ifsRows.append(card);});
    }
    function sync(){
      const p=api.get(),mode=p.mode,branch=mode==='branches',free=mode==='free',ifs=mode==='ifs',ls=mode==='lsystem';
      $('methodHint').textContent={polyline:'Ogni lato viene sostituito dal motivo A → B. Scegli anche la figura sulla quale applicarlo.',branches:'L’editor definisce i rami di base. Portamento e crescita ne modifica lo sviluppo; gli angoli sono relativi al padre.',free:'Duplica e piega l’intero disegno attorno al terminale, una generazione alla volta.',ifs:'Ogni copia della forma ripete la stessa disposizione in scala ridotta.',lsystem:'Le regole riscrivono i simboli; una tartaruga geometrica ne disegna il percorso.'}[mode];
      $('compositionPanel').hidden=mode!=='polyline';$('growthPanel').hidden=!branch;$('sequencePanel').hidden=!free;$('ifsPanel').hidden=!ifs;$('grammarPanel').hidden=!ls;$('advancedGeometry').hidden=!(mode==='polyline'||free);$('macroPanel').hidden=!(mode==='polyline'||free);
      $('polylineRules').hidden=branch||ifs||ls;$('branchRules').hidden=!branch;$('globalControls').hidden=!free;
      for(const selector of ['.point-controls','.editor-footer','.endpoint-readout','.rule-utilities'])rules.querySelector(selector).hidden=ls||(ifs&&ifsLayout);
      $('editorHint').textContent=ls?'L’editor mostra il primo sviluppo della grammatica.':ifs&&ifsLayout?'Trascina i punti delle copie per disporle.':$('editorHint').textContent;
      document.querySelector('.legend-directions').hidden=mode!=='polyline';
      $('compositionKind').value=p.composition.kind;$('compositionCount').value=p.composition.count;$('compositionCount').min=p.composition.kind==='polygon'?3:1;$('compositionAngle').value=p.composition.angle;$('compositionReflect').checked=p.composition.reflect;$('compositionInward').checked=p.composition.inward;
      $('compositionCount').closest('label').hidden=p.composition.kind==='segment';$('compositionAngle').closest('label').hidden=p.composition.kind==='segment';$('compositionReflect').closest('label').hidden=p.composition.kind!=='radial';$('compositionInward').closest('label').hidden=p.composition.kind!=='polygon';
      $('linkedBranches').checked=p.growth.linked;$('alternateSectors').checked=p.growth.alternate;for(const [id,key] of [['branchSpread','spread'],['branchDominance','dominance'],['levelAngle','levelAngle'],['levelScale','levelScale'],['branchJitter','jitter'],['randomSeed','seed']])$(id).value=p.growth[key];
      $('ifsEditorMode').value=ifsLayout?'copies':'seed';$('ifsClosed').checked=p.ifs.closed;$('ifsFill').checked=p.ifs.fill;$('ifsFill').disabled=!p.ifs.closed;
      $('lsAxiom').value=p.lsystem.axiom;$('lsRules').value=Object.entries(p.lsystem.rules).map(([a,b])=>a+' = '+b).join('\n');$('lsAngle').value=p.lsystem.angle;$('lsScale').value=p.lsystem.stepScale;$('lsHeading').value=p.lsystem.heading;
      if(mode==='polyline'||free){const b=p.endpoint,den=b.u*b.u+b.v*b.v;$('shapeHeight').value=Number((100*Math.max(...p.folds.map(v=>Math.abs((v.v*b.u-v.u*b.v)/den)))).toFixed(2));}
      const view=api.getView();$('nextLayer').checked=view.showNext;$('cameraMode').value=view.adaptiveCamera?'adaptive':'fixed';$('structureColor').value=p.structureColor;
      $('lineColorMode').closest('label').hidden=p.structureColor!=='spatial';
      if(free){syncSequence(p);const sequenced=p.foldSequence.length>0;$('transformKind').disabled=sequenced;$('transformAngle').disabled=sequenced;$('transformAngle').closest('label').firstChild.textContent=p.transformKind==='reflect'?'Asse dello specchio (°)':'Rotazione antioraria (°)';globalHint.textContent=sequenced?'La sequenza di piegature è attiva: modifica i singoli passi o torna a una sola trasformazione.':'La copia si aggancia al terminale. Angoli positivi: antiorario. Nello specchio puoi trascinare l’asse dorato.';}
      if(ifs)syncIFS(p);
      const saved=api.library.records.find(r=>r.id===document.querySelector('.preset[data-custom=true][aria-pressed=true]')?.dataset.id),same=saved&&JSON.stringify(saved.project)===JSON.stringify(p);draft.textContent=same?'Creazione salvata':'Bozza recuperabile in questo browser';
      if(currentPreset&&p.name===currentPreset.name)$('creationSubtitle').textContent=currentPreset.hint;else $('creationSubtitle').textContent='Una regola, una generazione alla volta.';
      document.body.dataset.mode=mode;
    }
    function drawEditor(ctx,editor,dragging){
      const p=api.get();if(p.mode!=='lsystem'&&!(p.mode==='ifs'&&ifsLayout))return false;
      const g=E.generateProject({...p,iterations:1},4096),{w,h,dpr}=editor;ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);layoutView=R.fit(g.bounds,w,h,.72);R.draw(ctx,w,h,layoutView,g,{...p,background:'#111614',lineWidth:1.3});
      if(p.mode==='ifs'){ctx.font='12px ui-monospace,Consolas,monospace';for(let i=0;i<p.ifs.transforms.length;i++){const t=p.ifs.transforms[i],x=(t.x-layoutView.x)*layoutView.scale+w/2,y=h/2-(t.y-layoutView.y)*layoutView.scale;ctx.fillStyle='#ffc2b9';ctx.beginPath();ctx.arc(x,y,6,0,Math.PI*2);ctx.fill();ctx.fillStyle='#edf5e6';ctx.fillText(String(i+1),x+9,y-9);}}return true;
    }
    function editorPointerDown(e,editor){
      const p=api.get(),r=e.currentTarget.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top;
      if(p.mode==='ifs'&&ifsLayout&&layoutView){let best=20,index=-1;p.ifs.transforms.forEach((t,i)=>{const sx=(t.x-layoutView.x)*layoutView.scale+editor.w/2,sy=editor.h/2-(t.y-layoutView.y)*layoutView.scale,d=Math.hypot(x-sx,y-sy);if(d<best){best=d;index=i;}});if(index>=0){handleDrag={kind:'ifs',index,view:{...layoutView},w:editor.w,h:editor.h};e.currentTarget.setPointerCapture(e.pointerId);e.preventDefault();}return true;}
      if(p.mode==='free'&&p.transformKind==='reflect'&&!p.foldSequence.length){
        const t={x:editor.originX+p.endpoint.u*editor.scale,y:editor.originY-p.endpoint.v*editor.scale},a=p.transformAngle*Math.PI/180,dx=x-t.x,dy=y-t.y,distance=Math.abs(dx*Math.sin(a)+dy*Math.cos(a));
        if(distance<9&&Math.hypot(dx,dy)>25){handleDrag={kind:'axis',originX:editor.originX,originY:editor.originY,scale:editor.scale};e.currentTarget.setPointerCapture(e.pointerId);e.preventDefault();return true;}
      }return false;
    }
    function editorPointerMove(e){if(!handleDrag)return false;const r=e.currentTarget.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top,d=handleDrag;
      if(d.kind==='ifs'){let u=d.view.x+(x-d.w/2)/d.view.scale,v=d.view.y-(y-d.h/2)/d.view.scale;if($('snapPoints').checked){u=Math.round(u*20)/20;v=Math.round(v*20)/20;}api.change(p=>{p.ifs.transforms[d.index].x=Math.max(-4,Math.min(4,u));p.ifs.transforms[d.index].y=Math.max(-4,Math.min(4,v));},{commit:false});}
      else{const p=api.get(),u=(x-d.originX)/d.scale-p.endpoint.u,v=(d.originY-y)/d.scale-p.endpoint.v;api.change(p=>p.transformAngle=Math.atan2(v,u)*180/Math.PI,{commit:false});}return true;
    }
    function editorPointerUp(){if(!handleDrag)return false;handleDrag=null;api.commit();api.draw();return true;}
    function geometryReady(g){$('foldNotice').textContent=g.overlap?'Le copie si sovrappongono: cambia angolo, asse dello specchio o sequenza.':api.get().mode==='free'&&api.get().transformKind==='reflect'?'Lo specchio ripetuto costruisce soprattutto fregi lungo una direzione.':'';}
    api.libraryReady.then(syncLibrary);
    return {sync,syncLibrary,drawEditor,editorPointerDown,editorPointerMove,editorPointerUp,geometryReady};
  };
})(typeof globalThis!=='undefined'?globalThis:this);
