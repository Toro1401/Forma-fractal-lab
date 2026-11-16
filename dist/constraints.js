/* Open-chain construction: A anchors the rule, B follows lengths and angles. */
(function(root){
  'use strict';
  const radians=Math.PI/180;
  const empty=count=>({lengths:Array(count+1).fill(null),groups:Array(count+1).fill(0),turns:Array(count).fill(null),heading:null});
  function measure(folds,endpoint={u:1,v:0},origin={u:0,v:0}){
    const points=[origin,...folds,endpoint];
    const vectors=points.slice(1).map((p,i)=>({u:p.u-points[i].u,v:p.v-points[i].v}));
    const lengths=vectors.map(p=>Math.hypot(p.u,p.v));
    const turns=vectors.slice(1).map((b,i)=>{const a=vectors[i];return Math.atan2(a.u*b.v-a.v*b.u,a.u*b.u+a.v*b.v)/radians;});
    return {points,lengths,turns,heading:Math.atan2(vectors[0].v,vectors[0].u)/radians};
  }
  // Construct the open chain from A. Unlocked dimensions retain their measured values.
  function solve(folds,endpoint,c,origin={u:0,v:0}){
    const current=measure(folds,endpoint,origin),fail=message=>({ok:false,message});
    if(current.lengths.some(x=>x<1e-7))return fail('Un lato ha lunghezza zero: separa i punti prima di applicare i vincoli.');
    const lengths=c.lengths.map((x,i)=>x??current.lengths[i]);
    for(let group=1;group<=3;group++){
      const members=c.groups.map((value,i)=>value===group?i:-1).filter(i=>i>=0);
      if(members.length<2)continue;
      const locked=members.filter(i=>c.lengths[i]!==null);
      if(locked.some(i=>Math.abs(c.lengths[i]-c.lengths[locked[0]])>1e-8*Math.max(1,c.lengths[i],c.lengths[locked[0]])))return fail(`Vincoli incompatibili: i lati del gruppo ${String.fromCharCode(64+group)} hanno lunghezze imposte diverse. Sblocca una lunghezza o cambia gruppo.`);
      const reference=lengths[locked[0]??members[0]];members.forEach(i=>lengths[i]=reference);
    }
    const message='Vincoli rispettati. A resta fisso; B segue la costruzione.';
    if(check(folds,endpoint,c,1e-8,origin).ok)return {ok:true,folds:folds.map(p=>({...p})),endpoint:{...endpoint},message};
    let angle=(c.heading??current.heading)*radians,x=origin.u,y=origin.v;
    const points=lengths.map((length,i)=>{
      if(i)angle+=(c.turns[i-1]??current.turns[i-1])*radians;
      x+=length*Math.cos(angle);y+=length*Math.sin(angle);return {u:x,v:y};
    });
    if(points.some(p=>!Number.isFinite(p.u)||!Number.isFinite(p.v)||Math.abs(p.u)>1000||Math.abs(p.v)>1000))return fail('La costruzione supera il limite delle coordinate (±1000).');
    const end=points.pop();
    if(Math.hypot(end.u-origin.u,end.v-origin.v)<.0001)return fail('La costruzione porterebbe B su A. Modifica una lunghezza o un angolo.');
    const verified=check(points,end,c,1e-8,origin);
    return verified.ok?{ok:true,folds:points,endpoint:end,message}:fail(verified.message);
  }
  function check(folds,endpoint,c,tolerance=1e-5,origin={u:0,v:0}){
    const m=measure(folds,endpoint,origin);
    const errors=[];
    const angleDiff=(a,b)=>Math.abs(Math.atan2(Math.sin((a-b)*radians),Math.cos((a-b)*radians))/radians);
    c.lengths.forEach((x,i)=>{if(x!==null&&Math.abs(x-m.lengths[i])>tolerance*Math.max(1,x))errors.push(`lunghezza S${i+1}`);});
    c.turns.forEach((x,i)=>{if(x!==null&&(m.lengths[i]<1e-7||m.lengths[i+1]<1e-7||angleDiff(x,m.turns[i])>tolerance))errors.push(`angolo P${i+1}`);});
    if(c.heading!==null&&angleDiff(c.heading,m.heading)>tolerance)errors.push('orientamento iniziale');
    for(let g=1;g<=3;g++){const members=c.groups.map((x,i)=>x===g?i:-1).filter(i=>i>=0);if(members.some(i=>Math.abs(m.lengths[i]-m.lengths[members[0]])>tolerance*Math.max(1,m.lengths[i])))errors.push(`gruppo ${String.fromCharCode(64+g)}`);}
    return {ok:!errors.length,message:errors.length?`Il progetto non rispetta i vincoli: ${errors.join(', ')}.`:'Vincoli rispettati.'};
  }
  const api={empty,measure,solve,check};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.FractalConstraints=api;
})(typeof globalThis!=='undefined'?globalThis:this);
