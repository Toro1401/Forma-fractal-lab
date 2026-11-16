const assert=require('node:assert/strict'),E=require('../dist/engine.js');
const seed=E.validateProject({version:1,folds:[{u:.5,v:.5}],iterations:1});
const p={...seed,mode:'free',transformKind:'rotate',transformAngle:90};
const r=E.generateProject(p);assert.equal(r.count,4);
assert.deepEqual([...r.segments.slice(0,8)],[0,0,.5,.5,.5,.5,1,0]);
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-10);
close(r.segments[10],1.5);close(r.segments[11],.5);close(r.segments[14],1);close(r.segments[15],1);
const reflected=E.generateProject({...p,transformKind:'reflect',transformAngle:0});
close(reflected.segments[10],.5);close(reflected.segments[11],-.5);
// Every generation attaches the whole previous copy at its current terminal B.
for(const kind of ['rotate','reflect'])for(let n=1;n<=5;n++){
 const before=E.generateProject({...p,transformKind:kind,iterations:n-1}),after=E.generateProject({...p,transformKind:kind,iterations:n});
 assert.equal(after.count,before.count*2);assert.deepEqual([...after.segments.slice(0,before.segments.length)],[...before.segments]);
 close(after.segments[before.segments.length],before.endpoint.u);close(after.segments[before.segments.length+1],before.endpoint.v);
 close(after.segments.at(-2),after.endpoint.u);close(after.segments.at(-1),after.endpoint.v);
}
const capped=E.generateProject({...p,iterations:10},7);assert.equal(capped.count,4);assert.equal(capped.iterations,1);
const colored=E.validateProject({...p,colorMiddle:'#FF00FF'});assert.equal(colored.colorMiddle,'#ff00ff');assert.deepEqual(E.validateProject(JSON.parse(JSON.stringify(colored))),colored);
for(const change of [{transformKind:'bad'},{transformAngle:Infinity},{colorMiddle:'red'}])assert.throws(()=>E.validateProject({...p,...change}));
console.log('Global whole-structure attachment, rotation, reflection, doubling, limits and gradient persistence passed.');

// The user's exact red/orange drawing: a right-angle seed continues left, then up.
const elbow={...p,folds:[{u:1,v:0}],endpoint:{u:1,v:1},iterations:1};
const staircase=E.generateProject(elbow),expected=[0,0,1,0,1,0,1,1,1,1,0,1,0,1,0,2];
staircase.segments.forEach((x,i)=>close(x,expected[i]));close(staircase.endpoint.u,0);close(staircase.endpoint.v,2);
for(let n=1;n<=6;n++){
 const before=E.generateProject({...elbow,iterations:n-1}),after=E.generateProject({...elbow,iterations:n});
 const pivot=before.endpoint;close(after.pivots[n-1].u,pivot.u);close(after.pivots[n-1].v,pivot.v);
 // The cloned original A becomes the next endpoint, rotating clockwise about the current pivot.
 close(after.endpoint.u,pivot.u-pivot.v);close(after.endpoint.v,pivot.v+pivot.u);
}
console.log('Exact elbow drawing and successive B / A-prime pivots passed.');

const high=E.generateProject(E.validateProject({...elbow,iterations:20}));
assert.equal(high.count,1048576);assert.equal(high.iterations,19);assert.equal(high.segments.length,4194304);assert.ok(high.segments.every(Number.isFinite));
const explicit=E.generateProject({...elbow,iterations:20},131072);assert.equal(explicit.count,131072);assert.equal(explicit.iterations,16);
assert.throws(()=>E.validateProject({...elbow,iterations:21}));
console.log('One-million-segment copy budget and complete-level capping passed.');
