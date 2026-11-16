/* Geometry is independent of the DOM and is also used inside the worker. */
(function (root) {
  'use strict';
  const MAX_SEGMENTS = 131072;
  function generate(folds, requestedIterations, mirror, limit = 131072, directions = [], endpoint = {u:1,v:0}, origin = {u:0,v:0}) {
    if (!Array.isArray(folds) || folds.length < 1 || folds.length > 8 || folds.some(p => !p || !Number.isFinite(p.u) || !Number.isFinite(p.v) || Math.abs(p.u) > 1000 || Math.abs(p.v) > 1000)) throw new Error('Punti non validi');
    if (!origin || !Number.isFinite(origin.u) || !Number.isFinite(origin.v) || Math.abs(origin.u)>1000 || Math.abs(origin.v)>1000 || !endpoint || !Number.isFinite(endpoint.u) || !Number.isFinite(endpoint.v) || Math.abs(endpoint.u)>1000 || Math.abs(endpoint.v)>1000 || Math.hypot(endpoint.u-origin.u,endpoint.v-origin.v)<.0001) throw new Error('A e B devono essere distinti e avere coordinate valide');
    if (!Array.isArray(directions) || (directions.length && directions.length !== folds.length+1) || directions.some(d=>d!==1&&d!==-1)) throw new Error('Versi dei lati non validi');
    if (!Number.isInteger(requestedIterations) || requestedIterations < 0 || requestedIterations > 10) throw new Error('Iterazioni non valide');
    if (!Number.isFinite(limit) || limit < 1 || limit > 131072) throw new Error('Limite non valido');
    const multiplier = folds.length + 1;
    let iterations = 0;
    while (iterations < requestedIterations && Math.pow(multiplier, iterations + 1) <= limit) iterations++;
    const bx=endpoint.u-origin.u,by=endpoint.v-origin.v,chordSquared=bx*bx+by*by;
    const localFolds=folds.map(p=>({u:((p.u-origin.u)*bx+(p.v-origin.v)*by)/chordSquared,v:((p.v-origin.v)*bx-(p.u-origin.u)*by)/chordSquared}));
    let points = new Float64Array([origin.u, origin.v, endpoint.u, endpoint.v]);
    let flips = new Uint8Array(1);
    for (let depth = 0; depth < iterations; depth++) {
      const count = points.length / 2 - 1;
      const next = new Float64Array((count * multiplier + 1) * 2);
      const nextFlips = new Uint8Array(count * multiplier);
      let offset = 0;
      for (let i = 0; i < count; i++) {
        const x = points[i * 2], y = points[i * 2 + 1];
        const dx = points[i * 2 + 2] - x, dy = points[i * 2 + 3] - y;
        next[offset++] = x; next[offset++] = y;
        for (const f of localFolds) {
          const v = f.v * (flips[i] ? -1 : 1);
          next[offset++] = x + f.u * dx - v * dy;
          next[offset++] = y + f.u * dy + v * dx;
        }
        for (let j = 0; j < multiplier; j++) nextFlips[i * multiplier + j] = flips[i] ^ (directions[j]===-1?1:0) ^ (mirror ? j%2 : 0);
      }
      next[offset++] = points[points.length - 2];
      next[offset] = points[points.length - 1];
      points = next; flips = nextFlips;
    }
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (let i = 0; i < points.length; i += 2) {
      minX = Math.min(minX, points[i]); maxX = Math.max(maxX, points[i]);
      minY = Math.min(minY, points[i + 1]); maxY = Math.max(maxY, points[i + 1]);
    }
    return {points, iterations, count: points.length / 2 - 1, bounds: {minX, maxX, minY, maxY}};
  }
  function generateBranches(rules, requestedIterations, endpoint={u:0,v:1}, mirror=false, minBranch=.003, limit=131072, radialCopies=1) {
    if(!Array.isArray(rules)||rules.length<1||rules.length>8||rules.some(r=>!r||!Number.isFinite(r.angle)||Math.abs(r.angle)>180||!Number.isFinite(r.ratio)||r.ratio<.05||r.ratio>1.25||!Number.isFinite(r.attach)||r.attach<0||r.attach>1||typeof r.flip!=='boolean'))throw new Error('Regole dei rami non valide.');
    if(!endpoint||!Number.isFinite(endpoint.u)||!Number.isFinite(endpoint.v)||Math.abs(endpoint.u)>1000||Math.abs(endpoint.v)>1000||Math.hypot(endpoint.u,endpoint.v)<.0001)throw new Error('Tronco non valido.');
    if(!Number.isInteger(requestedIterations)||requestedIterations<0||requestedIterations>32||!Number.isFinite(minBranch)||minBranch<.0001||minBranch>.25||!Number.isInteger(limit)||limit<1||limit>131072)throw new Error('Dettaglio dei rami non valido.');
    if(!Number.isInteger(radialCopies)||radialCopies<1||radialCopies>12||radialCopies>limit)throw new Error('Simmetria radiale non valida.');
    const segments=[],scales=[],roots=[];
    for(let i=0;i<radialCopies;i++){const a=i*2*Math.PI/radialCopies,dx=endpoint.u*Math.cos(a)-endpoint.v*Math.sin(a),dy=endpoint.u*Math.sin(a)+endpoint.v*Math.cos(a);segments.push(0,0,dx,dy);scales.push(1);roots.push({x:0,y:0,dx,dy,scale:1,hand:1});}
    let frontier=roots,iterations=requestedIterations,limited=false;
    const rotations=rules.map(r=>({c:Math.cos(r.angle*Math.PI/180),s:Math.sin(r.angle*Math.PI/180)}));
    for(let depth=1;depth<=requestedIterations&&frontier.length;depth++){
      const next=[];let overflow=false;
      for(const parent of frontier){
        for(let i=0;i<rules.length;i++){
          const rule=rules[i],scale=parent.scale*rule.ratio;if(scale<minBranch)continue;
          if(scales.length+next.length>=limit){overflow=true;break;}
          const {c,s}=rotations[i],sine=s*parent.hand;
          next.push({x:parent.x+parent.dx*rule.attach,y:parent.y+parent.dy*rule.attach,dx:(parent.dx*c-parent.dy*sine)*rule.ratio,dy:(parent.dx*sine+parent.dy*c)*rule.ratio,scale,hand:parent.hand*(rule.flip?-1:1)*(mirror&&i%2?-1:1)});
        }
        if(overflow)break;
      }
      // Keep complete levels; a limit must never silently remove one side of the tree.
      if(overflow){iterations=depth-1;limited=true;break;}
      for(const p of next){segments.push(p.x,p.y,p.x+p.dx,p.y+p.dy);scales.push(p.scale);}
      frontier=next;
    }
    let minX=0,maxX=0,minY=0,maxY=0;
    for(let i=0;i<segments.length;i+=2){minX=Math.min(minX,segments[i]);maxX=Math.max(maxX,segments[i]);minY=Math.min(minY,segments[i+1]);maxY=Math.max(maxY,segments[i+1]);}
    return {kind:'branches',segments:new Float64Array(segments),scales:new Float64Array(scales),iterations,limited,count:scales.length,bounds:{minX,maxX,minY,maxY}};
  }
  // Keep B fixed. Reverse the rotated copy at the current pivot: B, A-prime, A-double-prime...
  function generateFree(project,limit=1048576){
    const seed=[project.origin,...project.folds,project.endpoint],seedCount=seed.length-1;
    if(!Number.isInteger(project.iterations)||project.iterations<0||project.iterations>20||!Number.isInteger(limit)||limit<seedCount||limit>1048576)throw new Error('Dettaglio delle copie non valido.');
    let iterations=0,count=seedCount;while(iterations<project.iterations&&count*2<=limit){iterations++;count*=2;}
    // Allocate once: large generations do not require growing JavaScript arrays or a second full copy.
    const segments=new Float64Array(count*4),scales=new Float64Array(count);scales.fill(1);
    for(let i=0;i<seedCount;i++)segments.set([seed[i].u,seed[i].v,seed[i+1].u,seed[i+1].v],i*4);
    const angle=(project.transformAngle??45)*Math.PI/180,reflection=project.transformKind==='reflect',c=Math.cos(reflection?2*angle:angle),s=Math.sin(reflection?2*angle:-angle);
    let tip={...project.endpoint},length=seedCount*4;const pivots=[{...tip}];
    for(let depth=0;depth<iterations;depth++){
      let write=length;
      for(let i=length-4;i>=0;i-=4){
        for(const j of [i+2,i]){const x=segments[j]-tip.u,y=segments[j+1]-tip.v;segments[write++]=tip.u+c*x+(reflection?s:-s)*y;segments[write++]=tip.v+s*x+(reflection?-c:c)*y;}
      }
      length*=2;tip={u:tip.u-c*tip.u-(reflection?s:-s)*tip.v,v:tip.v-s*tip.u-(reflection?-c:c)*tip.v};pivots.push({...tip});
    }
    let minX=0,maxX=0,minY=0,maxY=0;for(let i=0;i<segments.length;i+=2){minX=Math.min(minX,segments[i]);maxX=Math.max(maxX,segments[i]);minY=Math.min(minY,segments[i+1]);maxY=Math.max(maxY,segments[i+1]);}
    return {kind:'branches',endpoint:tip,pivots,segments,scales,iterations,count,bounds:{minX,maxX,minY,maxY}};
  }
  function generateProject(project,limit){
    limit??=project.mode==='free'?1048576:131072;
    if(project.mode==='free')return generateFree(project,limit);
    return project.mode==='branches'?generateBranches(project.branches,project.iterations,project.endpoint,project.mirror,project.minBranch,limit,project.radialCopies??1):generate(project.folds,project.iterations,project.mirror,limit,project.directions,project.endpoint,project.origin);
  }
  function validateProject(data) {
    if (!data || ![1,2,3,4].includes(data.version) || !Array.isArray(data.folds) || data.folds.length < 1 || data.folds.length > 8) throw new Error('Il file non è un progetto Forma valido.');
    const mode=data.version===4?data.mode:'polyline';
    if(!['polyline','branches','free'].includes(mode))throw new Error('Modalità del generatore non valida.');
    const folds = data.folds.map(p => ({u: p?.u, v: p?.v}));
    if (folds.some(p => !Number.isFinite(p.u) || !Number.isFinite(p.v) || Math.abs(p.u)>1000 || Math.abs(p.v)>1000)) throw new Error('Le coordinate del progetto non sono valide.');
    if (!Number.isInteger(data.iterations) || data.iterations < 0 || data.iterations > (mode==='branches'?32:mode==='free'?20:10)) throw new Error('Numero di iterazioni non valido.');
    const palette = ['lime','aurora','ocean','ember','chalk'].includes(data.palette) ? data.palette : 'lime';
    const origin=data.version>=3?{u:data.origin?.u,v:data.origin?.v}:{u:0,v:0};
    const endpoint=data.version>=2?{u:data.endpoint?.u,v:data.endpoint?.v}:{u:1,v:0};
    if(!Number.isFinite(origin.u)||!Number.isFinite(origin.v)||Math.abs(origin.u)>1000||Math.abs(origin.v)>1000)throw new Error('Coordinate dell’estremo A non valide.');
    if(!Number.isFinite(endpoint.u)||!Number.isFinite(endpoint.v)||Math.abs(endpoint.u)>1000||Math.abs(endpoint.v)>1000||Math.hypot(endpoint.u-origin.u,endpoint.v-origin.v)<.0001)throw new Error('Estremo B non valido: deve essere distinto da A.');
    // Older projects may have a movable A: translate the complete rule without changing its shape.
    if(origin.u!==0||origin.v!==0){
      for(const point of [...folds,endpoint]){point.u-=origin.u;point.v-=origin.v;}
      origin.u=0;origin.v=0;
      if([...folds,endpoint].some(p=>Math.abs(p.u)>1000||Math.abs(p.v)>1000))throw new Error('La traslazione di A all’origine supera il limite delle coordinate (±1000).');
    }
    const size=folds.length+1;
    const directions=data.version>=2?data.directions:Array(size).fill(1);
    if(!Array.isArray(directions)||directions.length!==size||directions.some(d=>d!==1&&d!==-1))throw new Error('Versi dei lati non validi.');
    const empty={lengths:Array(size).fill(null),groups:Array(size).fill(0),turns:Array(size-1).fill(null),heading:null};
    const c=data.version>=2?data.constraints:empty;
    if(!c||!Array.isArray(c.lengths)||c.lengths.length!==size||c.lengths.some(x=>x!==null&&(!Number.isFinite(x)||x<=0||x>1000))||!Array.isArray(c.groups)||c.groups.length!==size||c.groups.some(x=>!Number.isInteger(x)||x<0||x>3)||!Array.isArray(c.turns)||c.turns.length!==size-1||c.turns.some(x=>x!==null&&(!Number.isFinite(x)||Math.abs(x)>180))||(c.heading!==null&&(!Number.isFinite(c.heading)||Math.abs(c.heading)>360)))throw new Error('Vincoli geometrici non validi.');
    const defaults={lime:['#769b5a','#e9ffd0'],aurora:['#75e5cc','#db8bdd'],ocean:['#387caf','#cdf2da'],ember:['#f47872','#f4e8a4'],chalk:['#a9b9a7','#f1f2e7']}[palette];
    const colorMode=data.version>=3?data.colorMode:'gradient',colorStart=data.version>=3?data.colorStart:defaults[0],colorEnd=data.version>=3?data.colorEnd:defaults[1];
    if(!['solid','gradient'].includes(colorMode)||typeof colorStart!=='string'||typeof colorEnd!=='string'||!/^#[0-9a-f]{6}$/i.test(colorStart)||!/^#[0-9a-f]{6}$/i.test(colorEnd))throw new Error('Stile o colori della linea non validi.');
    const branches=data.version===4?data.branches:[{angle:30,ratio:.7,attach:1,flip:false},{angle:-30,ratio:.7,attach:1,flip:false}];
    if(!Array.isArray(branches)||branches.length<1||branches.length>8||branches.some(r=>!r||!Number.isFinite(r.angle)||Math.abs(r.angle)>180||!Number.isFinite(r.ratio)||r.ratio<.05||r.ratio>1.25||!Number.isFinite(r.attach)||r.attach<0||r.attach>1||typeof r.flip!=='boolean'))throw new Error('Regole dei rami non valide.');
    const minBranch=data.version===4?data.minBranch:.003,taper=data.version===4?data.taper:0,background=data.version===4?data.background:'#111515';
    if(!Number.isFinite(minBranch)||minBranch<.0001||minBranch>.25||!Number.isFinite(taper)||taper<0||taper>1.5||typeof background!=='string'||!/^#[0-9a-f]{6}$/i.test(background))throw new Error('Dettaglio o stile dei rami non valido.');
    const radialCopies=data.radialCopies??1;if(!Number.isInteger(radialCopies)||radialCopies<1||radialCopies>12)throw new Error('Simmetria radiale non valida.');
    const transformKind=data.transformKind??'rotate',transformAngle=data.transformAngle??45,colorMiddle=data.colorMiddle??null;
    if(!['rotate','reflect'].includes(transformKind)||!Number.isFinite(transformAngle)||Math.abs(transformAngle)>360||(colorMiddle!==null&&(typeof colorMiddle!=='string'||!/^#[0-9a-f]{6}$/i.test(colorMiddle))))throw new Error('Trasformazione o colore intermedio non valido.');
    return {version:4, mode,radialCopies,transformKind,transformAngle,colorMiddle:colorMiddle?.toLowerCase()??null, name: typeof data.name === 'string' ? data.name.slice(0,60) : 'Forma importata', folds, origin, endpoint, directions:[...directions], constraints:{lengths:[...c.lengths],groups:[...c.groups],turns:[...c.turns],heading:c.heading}, branches:branches.map(r=>({angle:r.angle,ratio:r.ratio,attach:r.attach,flip:r.flip})),minBranch,taper,background:background.toLowerCase(),iterations:data.iterations, mirror: data.mirror === true, palette, colorMode,colorStart:colorStart.toLowerCase(),colorEnd:colorEnd.toLowerCase(), lineWidth: typeof data.lineWidth === 'number' && Number.isFinite(data.lineWidth) ? Math.max(.5,Math.min(data.version===4?12:3,data.lineWidth)) : 1.3};
  }
  const api = {MAX_COPY_SEGMENTS:1048576,generate,generateBranches,generateFree,generateProject,validateProject,MAX_SEGMENTS};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.FractalEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
