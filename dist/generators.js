/* Version 5 projects and additional generators. Works in the browser, worker and Node. */
(function(root){
  'use strict';
  const E=typeof module!=='undefined'&&module.exports?require('./engine.js'):root.FractalEngine;
  const legacyValidate=E.validateProject,legacyGenerate=E.generateProject;
  const clone=value=>JSON.parse(JSON.stringify(value));
  const modes=['polyline','branches','free','ifs','lsystem'];
  const defaults={
    composition:{kind:'segment',count:6,angle:0,reflect:false,inward:false},
    growth:{linked:false,spread:1,dominance:1,levelAngle:0,levelScale:1,jitter:0,seed:1,alternate:false},
    foldSequence:[],
    ifs:{closed:true,fill:false,transforms:[{x:0,y:0,scaleX:.5,scaleY:.5,angle:0,shear:0,reflect:false},{x:.5,y:0,scaleX:.5,scaleY:.5,angle:0,shear:0,reflect:false},{x:.25,y:Math.sqrt(3)/4,scaleX:.5,scaleY:.5,angle:0,shear:0,reflect:false}]},
    lsystem:{axiom:'F',rules:{F:'F[+F]F[-F]F'},angle:25,stepScale:.7,heading:90},
    structureColor:'spatial'
  };
  function numeric(value,min,max,label){if(!Number.isFinite(value)||value<min||value>max)throw new Error(label+' non valido.');return value;}
  function integer(value,min,max,label){numeric(value,min,max,label);if(!Number.isInteger(value))throw new Error(label+' deve essere intero.');return value;}
  function flag(value,label){if(typeof value!=='boolean')throw new Error(label+' non valido.');return value;}
  function settings(input,key,baseline){const supplied=input[key];if(supplied!==undefined&&(!supplied||typeof supplied!=='object'||Array.isArray(supplied)))throw new Error('Impostazioni non valide: '+key);const copy=clone(baseline);for(const name of Object.keys(copy))if(supplied&&Object.hasOwn(supplied,name))copy[name]=supplied[name];return copy;}
  function grammar(text,label,max=512){
    if(typeof text!=='string'||!text.length||text.length>max||!/^[A-Za-z+\-\[\]]+$/.test(text))throw new Error(label+': usa lettere, +, − e parentesi quadre.');
    let depth=0;for(const token of text){if(token==='[')depth++;if(token===']'&&--depth<0)throw new Error(label+': parentesi non bilanciate.');}if(depth)throw new Error(label+': parentesi non bilanciate.');return text;
  }
  function upgradeProject(input){
    if(!input||![1,2,3,4,5].includes(input.version))throw new Error('Versione del progetto non supportata.');
    const modern=input.version===5,mode=modern?input.mode:(input.version===4?input.mode:'polyline');
    if(!modes.includes(mode))throw new Error('Modalità del generatore non valida.');
    const max=mode==='branches'?32:mode==='free'?20:10;
    integer(input.iterations,0,max,'Numero di iterazioni');
    const base=legacyValidate(modern?{...input,version:4,mode:mode==='ifs'||mode==='lsystem'?'polyline':mode,iterations:Math.min(input.iterations,mode==='branches'?32:mode==='free'?20:10)}:input);
    const c=settings(modern?input:{},'composition',defaults.composition);
    if(!['segment','radial','polygon'].includes(c.kind))throw new Error('Composizione non valida.');
    integer(c.count,c.kind==='polygon'?3:1,12,'Numero di settori');numeric(c.angle,-360,360,'Orientamento');flag(c.reflect,'Settori specchiati');flag(c.inward,'Verso del contorno');
    const g=settings(modern?input:{},'growth',defaults.growth);
    flag(g.linked,'Coppie collegate');flag(g.alternate,'Settori alternati');numeric(g.spread,.2,2,'Apertura');numeric(g.dominance,.5,1.5,'Dominanza');numeric(g.levelAngle,-20,20,'Variazione angolare');numeric(g.levelScale,.8,1.05,'Scala per livello');numeric(g.jitter,0,.3,'Irregolarità');integer(g.seed,0,4294967295,'Seme casuale');
    const sequence=modern?(input.foldSequence??[]):[];
    if(!Array.isArray(sequence)||sequence.length>12)throw new Error('Sono consentiti al massimo 12 passi nella sequenza.');
    const foldSequence=sequence.map(step=>{if(!step||!['rotate','reflect'].includes(step.kind))throw new Error('Operazione della sequenza non valida.');return {kind:step.kind,angle:numeric(step.angle,-360,360,'Angolo della sequenza')};});
    const i=settings(modern?input:{},'ifs',defaults.ifs);
    flag(i.closed,'Forma chiusa');flag(i.fill,'Riempimento');
    if(!Array.isArray(i.transforms)||i.transforms.length<1||i.transforms.length>8)throw new Error('Definisci da 1 a 8 copie IFS.');
    i.transforms=i.transforms.map(t=>{
      if(!t||typeof t!=='object')throw new Error('Copia IFS non valida.');
      const r={x:numeric(t.x,-4,4,'Posizione X'),y:numeric(t.y,-4,4,'Posizione Y'),scaleX:numeric(t.scaleX,0,.98,'Scala X'),scaleY:numeric(t.scaleY,0,.98,'Scala Y'),angle:numeric(t.angle,-360,360,'Rotazione'),shear:numeric(t.shear??0,-.8,.8,'Inclinazione'),reflect:flag(t.reflect??false,'Specchio')};
      const trace=r.scaleX*r.scaleX+r.scaleY*r.scaleY+r.shear*r.shear,det=r.scaleX*r.scaleY;
      if(Math.sqrt((trace+Math.sqrt(Math.max(0,trace*trace-4*det*det)))/2)>=.9999)throw new Error('Ogni copia IFS deve essere più piccola della forma iniziale: riduci scala o inclinazione.');return r;
    });
    const l=settings(modern?input:{},'lsystem',defaults.lsystem);grammar(l.axiom,'Assioma',128);
    if(!l.rules||typeof l.rules!=='object'||Array.isArray(l.rules)||Object.keys(l.rules).length<1||Object.keys(l.rules).length>6)throw new Error('Definisci da 1 a 6 regole L-system.');
    l.rules=Object.fromEntries(Object.entries(l.rules).map(([symbol,value])=>{if(!/^[A-Za-z]$/.test(symbol))throw new Error('Ogni simbolo deve essere una lettera.');return [symbol,grammar(value,'Regola '+symbol)];}));
    numeric(l.angle,-180,180,'Angolo L-system');numeric(l.stepScale,.1,1,'Scala dei passi');numeric(l.heading,-360,360,'Direzione iniziale');
    const structureColor=modern?(input.structureColor??'spatial'):'spatial';if(!['spatial','generation','family'].includes(structureColor))throw new Error('Colorazione della struttura non valida.');
    return {...base,version:5,mode,iterations:input.iterations,transformAngle:(modern||base.transformKind==='reflect'?base.transformAngle:-base.transformAngle)||0,composition:c,growth:g,foldSequence,ifs:i,lsystem:l,structureColor};
  }
  function validateProject(data){return data?.version===5?upgradeProject(data):legacyValidate(data);}
  function rng(seed){let a=seed>>>0;return ()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};}
  function boundsOf(segments){let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;for(let j=0;j<segments.length;j+=2){const x=segments[j],y=segments[j+1];if(!Number.isFinite(x)||!Number.isFinite(y))throw new Error('La costruzione supera i limiti numerici.');minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}return segments.length?{minX,maxX,minY,maxY}:{minX:0,maxX:1,minY:0,maxY:1};}
  function result(segments,iterations,extra={}){const array=segments instanceof Float64Array?segments:new Float64Array(segments);return {kind:'branches',segments:array,count:array.length/4,scales:new Float64Array(array.length/4).fill(1),iterations,bounds:boundsOf(array),...extra};}
  function composedLine(p,limit){
    const c=p.composition,copies=c.kind==='segment'?1:c.count*(c.reflect&&c.kind==='radial'?2:1),localLimit=Math.floor(limit/copies);
    if(copies>limit)throw new Error('Il limite è inferiore al numero dei settori iniziali.');
    const base=E.generate(p.folds,p.iterations,p.mirror,Math.max(1,localLimit),p.directions,p.endpoint,p.origin);
    if(c.kind==='segment')return {...base,depths:new Uint8Array(base.count).fill(base.iterations),families:new Uint8Array(base.count)};
    const segments=new Float64Array(base.count*copies*4),families=new Uint8Array(base.count*copies);let out=0,index=0;
    const bx=p.endpoint.u,by=p.endpoint.v,den=bx*bx+by*by,angle=c.angle*Math.PI/180;
    for(let sector=0;sector<c.count;sector++){
      const a=angle+(c.kind==='polygon'?-1:1)*sector*2*Math.PI/c.count;
      for(let mirrored=0;mirrored<(c.reflect&&c.kind==='radial'?2:1);mirrored++){
        let sx=0,sy=0,dx=bx*Math.cos(a)-by*Math.sin(a),dy=bx*Math.sin(a)+by*Math.cos(a);
        if(c.kind==='polygon'){const radius=Math.hypot(bx,by)/(2*Math.sin(Math.PI/c.count));sx=radius*Math.cos(a);sy=radius*Math.sin(a);const end=a-2*Math.PI/c.count;dx=radius*Math.cos(end)-sx;dy=radius*Math.sin(end)-sy;}
        for(let j=0;j<base.points.length-2;j+=2){
          for(const k of [j,j+2]){const x=base.points[k],y=base.points[k+1],u=(x*bx+y*by)/den,v=(y*bx-x*by)/den*(mirrored?-1:1)*(c.kind==='polygon'&&c.inward?-1:1);segments[out++]=sx+u*dx-v*dy;segments[out++]=sy+u*dy+v*dx;}families[index++]=sector;
        }
      }
    }
    return result(segments,base.iterations,{depths:new Uint8Array(index).fill(base.iterations),families,closed:c.kind==='polygon'});
  }
  function grownBranches(p,limit){
    const g=p.growth,random=rng(g.seed),segments=[],scales=[],depths=[],families=[];let frontier=[];
    const count=p.radialCopies??1;
    for(let i=0;i<count;i++){const a=(p.composition.angle+i*360/count)*Math.PI/180,dx=p.endpoint.u*Math.cos(a)-p.endpoint.v*Math.sin(a),dy=p.endpoint.u*Math.sin(a)+p.endpoint.v*Math.cos(a);frontier.push({x:0,y:0,dx,dy,scale:1,hand:g.alternate&&i%2?-1:1,family:i});segments.push(0,0,dx,dy);scales.push(1);depths.push(0);families.push(i);}
    let iterations=p.iterations,limited=false,stopped=null;
    for(let depth=1;depth<=p.iterations&&frontier.length;depth++){
      const next=[];let overflow=false;
      for(const parent of frontier){for(let i=0;i<p.branches.length;i++){
        const rule=p.branches[i],noise=g.jitter?(random()*2-1)*g.jitter:0;
        const ratio=Math.min(1.25,Math.max(.02,rule.ratio*Math.pow(g.levelScale,depth-1)*(Math.abs(rule.angle)<1?g.dominance:1/g.dominance)*(1+noise)));
        const scale=parent.scale*ratio;if(scale<p.minBranch)continue;
        if(scales.length+next.length>=limit){overflow=true;break;}
        const angle=(rule.angle*g.spread+(depth-1)*g.levelAngle+noise*45)*parent.hand*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle);
        next.push({x:parent.x+parent.dx*rule.attach,y:parent.y+parent.dy*rule.attach,dx:(parent.dx*c-parent.dy*s)*ratio,dy:(parent.dx*s+parent.dy*c)*ratio,scale,hand:parent.hand*(rule.flip?-1:1)*(p.mirror&&i%2?-1:1),family:depth===1?i:parent.family});
      }if(overflow)break;}
      if(overflow){iterations=depth-1;limited=true;break;}
      if(!next.length){iterations=depth-1;stopped='threshold';break;}
      for(const item of next){segments.push(item.x,item.y,item.x+item.dx,item.y+item.dy);scales.push(item.scale);depths.push(depth);families.push(item.family);}frontier=next;
    }
    return result(segments,iterations,{limited,stopped,scales:new Float64Array(scales),depths:new Uint8Array(depths),families:new Uint8Array(families)});
  }
  function foldedCopies(p,limit){
    const seed=[p.origin,...p.folds,p.endpoint],seedCount=seed.length-1;let count=seedCount,iterations=0;
    while(iterations<p.iterations&&count*2<=limit){count*=2;iterations++;}
    const segments=new Float64Array(count*4),depths=new Uint8Array(count),families=new Uint8Array(count);
    for(let j=0;j<seedCount;j++)segments.set([seed[j].u,seed[j].v,seed[j+1].u,seed[j+1].v],j*4);
    let tip={...p.endpoint},length=seedCount*4;const pivots=[{...tip}];let overlap=false;
    for(let depth=0;depth<iterations;depth++){
      const step=p.foldSequence.length?p.foldSequence[depth%p.foldSequence.length]:{kind:p.transformKind,angle:p.transformAngle};
      const a=step.angle*Math.PI/180,reflect=step.kind==='reflect',c=Math.cos(reflect?2*a:a),s=Math.sin(reflect?2*a:a);
      let write=length;for(let j=length-4;j>=0;j-=4){for(const k of [j+2,j]){const x=segments[k]-tip.u,y=segments[k+1]-tip.v;segments[write++]=tip.u+c*x+(reflect?s:-s)*y;segments[write++]=tip.v+s*x+(reflect?-c:c)*y;}}
      const nextTip={u:tip.u-c*tip.u-(reflect?s:-s)*tip.v,v:tip.v-s*tip.u-(reflect?-c:c)*tip.v};
      if(!p.foldSequence.length&&reflect&&Math.hypot(nextTip.u,nextTip.v)<1e-9)overlap=true;
      if(!p.foldSequence.length&&!reflect&&Math.abs(Math.sin(a/2))<1e-10)overlap=true;
      depths.fill(depth+1,length/4,length/2);families.fill((depth+1)%12,length/4,length/2);length*=2;tip=nextTip;pivots.push({...tip});
    }
    return result(segments,iterations,{depths,families,endpoint:tip,pivots,overlap});
  }
  function generateIFS(p,limit){
    const vertices=[p.origin,...p.folds,p.endpoint],seedCount=vertices.length-(p.ifs.closed?0:1),n=p.ifs.transforms.length;let copies=1,iterations=0;
    while(iterations<p.iterations&&copies*n*seedCount<=limit){copies*=n;iterations++;}
    let current=new Float64Array(seedCount*4);for(let j=0;j<seedCount;j++){const a=vertices[j],b=vertices[(j+1)%vertices.length];current.set([a.u,a.v,b.u,b.v],j*4);}
    let families=new Uint8Array(seedCount);
    for(let depth=0;depth<iterations;depth++){
      const next=new Float64Array(current.length*n),nextFamilies=new Uint8Array(current.length/4*n);let out=0;
      for(let index=0;index<n;index++){
        const t=p.ifs.transforms[index],a=t.angle*Math.PI/180,c=Math.cos(a),s=Math.sin(a);
        for(let j=0;j<current.length;j+=2){const x=t.scaleX*current[j]+t.shear*current[j+1],y=t.scaleY*(t.reflect?-1:1)*current[j+1];next[out++]=t.x+c*x-s*y;next[out++]=t.y+s*x+c*y;}
        nextFamilies.fill(index,index*current.length/4,(index+1)*current.length/4);
      }current=next;families=nextFamilies;
    }
    return result(current,iterations,{families,depths:new Uint8Array(current.length/4).fill(iterations),polygonSize:p.ifs.closed?seedCount:0,fill:p.ifs.closed&&p.ifs.fill});
  }
  function generateLSystem(p,limit){
    const l=p.lsystem;let text=l.axiom,iterations=0;
    for(let depth=0;depth<p.iterations;depth++){
      let length=0,draws=0,overflow=false;const chunks=[];
      for(const token of text){const chunk=l.rules[token]??token;length+=chunk.length;if(length>1048576){overflow=true;break;}for(const ch of chunk)if(ch==='F'||ch==='G')draws++;if(draws>limit){overflow=true;break;}chunks.push(chunk);}
      if(overflow)break;text=chunks.join('');iterations++;
    }
    let x=0,y=0,heading=l.heading*Math.PI/180,depth=0;const step=Math.pow(l.stepScale,iterations),stack=[],segments=[],depths=[],families=[];
    for(const token of text){
      if(token==='F'||token==='G'||token==='f'){const nx=x+step*Math.cos(heading),ny=y+step*Math.sin(heading);if(token!=='f'){if(segments.length/4>=limit)throw new Error('Assioma troppo complesso.');segments.push(x,y,nx,ny);depths.push(Math.min(255,depth));families.push(token==='G'?1:0);}x=nx;y=ny;}
      else if(token==='+')heading+=l.angle*Math.PI/180;else if(token==='-')heading-=l.angle*Math.PI/180;else if(token==='['){stack.push({x,y,heading,depth});depth++;}else if(token===']'){const previous=stack.pop();if(!previous)throw new Error('Parentesi L-system non bilanciate.');({x,y,heading,depth}=previous);}
    }
    return result(segments,iterations,{depths:new Uint8Array(depths),families:new Uint8Array(families),tokens:text.length});
  }
  function generateProject(project,limit){
    if(project.version!==5)return legacyGenerate(project,limit);
    const p=project;limit??=p.mode==='free'?1048576:131072;
    if(!Number.isInteger(limit)||limit<12||limit>(p.mode==='free'?1048576:131072))throw new Error('Limite di segmenti non valido.');
    switch(p.mode){case 'polyline':return composedLine(p,limit);case 'branches':return grownBranches(p,limit);case 'free':return foldedCopies(p,limit);case 'ifs':return generateIFS(p,limit);case 'lsystem':return generateLSystem(p,limit);default:throw new Error('Generatore sconosciuto.');}
  }
  function geometryKey(p){return JSON.stringify([p.mode,p.folds,p.iterations,p.mirror,p.directions,p.endpoint,p.origin,p.branches,p.minBranch,p.transformKind,p.transformAngle,p.radialCopies,p.composition,p.growth,p.foldSequence,p.ifs,p.lsystem]);}
  function transferables(r){return [...new Set(Object.values(r).filter(value=>ArrayBuffer.isView(value)).map(value=>value.buffer))];}
  Object.assign(E,{validateProject,upgradeProject,generateProject,geometryKey,rng,defaults,transferables,modes});
  if(typeof module!=='undefined'&&module.exports)module.exports=E;
})(typeof globalThis!=='undefined'?globalThis:this);
