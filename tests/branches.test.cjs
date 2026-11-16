'use strict';
const assert=require('node:assert/strict');
const E=require('../dist/engine.js');
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-10,`${a} != ${b}`);
const binary=[{angle:30,ratio:.7,attach:1,flip:false},{angle:-30,ratio:.7,attach:1,flip:false}];
const root=E.generateBranches(binary,0);assert.deepEqual([...root.segments],[0,0,0,1]);
const first=E.generateBranches(binary,1);
assert.equal(first.count,3);assert.equal(first.segments.length,12);
assert.deepEqual([...first.segments.slice(4,6)],[0,1]);close(first.segments[6],-.35);close(first.segments[7],1+.7*Math.sqrt(3)/2);
close(first.segments[10],.35);close(first.segments[11],first.segments[7]);
// Every fork starts at its parent's endpoint. No extra stroke connects sibling tips.
const tree=E.generateBranches(binary,3);assert.equal(tree.count,15);
assert.deepEqual([...tree.segments.slice(12,14)],[first.segments[6],first.segments[7]]);
for(let i=0;i<tree.count;i++)close(Math.hypot(tree.segments[4*i+2]-tree.segments[4*i],tree.segments[4*i+3]-tree.segments[4*i+1]),tree.scales[i]);
close(tree.bounds.minX,-tree.bounds.maxX);
// A single rule gives an editable logarithmic spiral; rotations accumulate at each depth.
const spiral=[{angle:30,ratio:.87,attach:1,flip:false}];
const curl=E.generateBranches(spiral,24);assert.equal(curl.count,25);
for(let i=0;i<curl.count;i++){
  const j=i*4;close(curl.segments[j+2]-curl.segments[j],-Math.sin(i*Math.PI/6)*(.87**i));close(curl.segments[j+3]-curl.segments[j+1],Math.cos(i*Math.PI/6)*(.87**i));
}
const attached=E.generateBranches([{angle:90,ratio:.5,attach:.4,flip:false}],1);close(attached.segments[5],.4);close(attached.segments[6],-.5);close(attached.segments[7],.4);
const mirrored=E.generateBranches([{...spiral[0],flip:true}],3);assert.notDeepEqual([...mirrored.segments],[...E.generateBranches(spiral,3).segments]);
assert.notDeepEqual([...E.generateBranches(binary,3,{u:0,v:1},true).segments],[...tree.segments]);
const rotated=E.generateBranches(binary,3,{u:2,v:0});tree.segments.forEach((x,i)=>close(rotated.segments[i],i%2?-2*tree.segments[i-1]:2*tree.segments[i+1]));
const pruned=E.generateBranches([{angle:20,ratio:.5,attach:1,flip:false}],32,{u:0,v:1},false,.2);assert.equal(pruned.count,3);assert.equal(pruned.limited,false);
const capped=E.generateBranches(binary,32,{u:0,v:1},false,.0001,20);assert.equal(capped.count,15);assert.equal(capped.iterations,3);assert.equal(capped.limited,true);
const large=E.generateBranches(Array.from({length:8},(_,i)=>({...binary[0],ratio:1,angle:-105+i*30})),32);assert.ok(large.count<=E.MAX_SEGMENTS);assert.ok(large.segments.every(Number.isFinite));
const base=E.validateProject({version:1,name:'Legacy',folds:[{u:.5,v:.5}],iterations:5,palette:'lime',lineWidth:1.3});assert.equal(base.version,4);assert.equal(base.mode,'polyline');
const legacy3=E.validateProject({...base,version:3,colorStart:'#ff8800',colorEnd:'#0088ff'});assert.equal(legacy3.version,4);assert.equal(legacy3.colorStart,'#ff8800');assert.equal(legacy3.mode,'polyline');assert.deepEqual([...E.generateProject(legacy3).points],[...E.generate(base.folds,5,false).points]);
const branchProject=E.validateProject({...base,mode:'branches',branches:binary,endpoint:{u:0,v:1},iterations:24,lineWidth:11,taper:1,background:'#FFFFFF'});assert.equal(branchProject.background,'#ffffff');assert.deepEqual(E.validateProject(JSON.parse(JSON.stringify(branchProject))),branchProject);assert.equal(E.generateProject(branchProject).kind,'branches');
for(const changes of [{branches:[]},{branches:[{...binary[0],ratio:0}]},{branches:[{...binary[0],angle:NaN}]},{branches:[{...binary[0],attach:2}]},{branches:[{...binary[0],flip:1}]},{minBranch:0},{taper:-1},{iterations:33},{background:'white'},{mode:'bad'}])assert.throws(()=>E.validateProject({...branchProject,...changes}));
for(const args of [[binary,33],[binary,-1],[binary,1,{u:0,v:0}],[binary,1,{u:0,v:1},false,0]])assert.throws(()=>E.generateBranches(...args));
console.log('Branch topology, transforms, spirals, mirrors, pruning, limits and v4 migration: all checks passed.');

const radial=E.generateBranches(binary,1,{u:0,v:1},false,.003,E.MAX_SEGMENTS,6);assert.equal(radial.count,18);
for(let i=0;i<6;i++){close(radial.segments[i*4],0);close(radial.segments[i*4+1],0);close(Math.hypot(radial.segments[i*4+2],radial.segments[i*4+3]),1);}
assert.throws(()=>E.validateProject({...branchProject,radialCopies:0}));
