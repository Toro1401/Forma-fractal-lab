'use strict';
const assert=require('node:assert/strict'),E=require('../dist/generators.js'),History=require('../dist/history.js');
global.FractalEngine=E;require('../dist/presets.js');
const preset=id=>FormaPresets.projectForPreset(FormaPresets.presets.find(p=>p.id===id));
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
// A history snapshot restores both geometry and the correct update destination.
const h=new History(3);h.push({name:'Alpha'},'alpha','alpha');h.push({name:'Beta'},'beta','beta');assert.equal(h.move(-1).editingId,'alpha');assert.equal(h.move(1).editingId,'beta');h.move(-1);h.push({name:'Gamma'},'gamma');assert.equal(h.canRedo,false);
// Version 1–4 migrations preserve clockwise rotations and counterclockwise mirror axes.
const old=E.validateProject({version:1,name:'Legacy',folds:[{u:1,v:0}],iterations:3});
for(const kind of ['rotate','reflect'])for(const angle of [-90,0,30,90]){
  const p={...old,mode:'free',transformKind:kind,transformAngle:angle,endpoint:{u:1,v:1}},before=E.generateProject(p),modern=E.upgradeProject(p),after=E.generateProject(modern);
  before.segments.forEach((x,i)=>close(x,after.segments[i]));assert.deepEqual(E.validateProject(JSON.parse(JSON.stringify(modern))),modern);
}
const line=preset('koch'),radial=E.generateProject({...line,composition:{...line.composition,kind:'radial',count:6}});assert.equal(radial.count,6*4**5);assert.equal(radial.families.at(-1),5);
const mirrored=E.generateProject({...line,composition:{...line.composition,kind:'radial',count:6,reflect:true}});assert.equal(mirrored.count,12*4**5);
const snow=E.generateProject(preset('koch-snowflake'));assert.equal(snow.count,3*4**5);assert.equal(snow.closed,true);assert.equal(snow.count%3,0);
// The final endpoint of each side meets the start of the next side, with no extra connectors.
const perSide=snow.count/3;for(let side=0;side<3;side++){const last=((side+1)*perSide-1)*4,next=((side+1)%3)*perSide*4;close(snow.segments[last+2],snow.segments[next]);close(snow.segments[last+3],snow.segments[next+1]);}
const cap=E.generateProject({...preset('mirror-mandala'),iterations:10});assert.ok(cap.count<=131072);assert.equal(cap.count,16*3**cap.iterations);
// Stochastic growth is stable across generation and round-trip; a different seed changes it.
const wind=preset('wind-tree'),first=E.generateProject(wind),again=E.generateProject(E.validateProject(JSON.parse(JSON.stringify(wind))));assert.deepEqual(first.segments,again.segments);
assert.notDeepEqual(first.segments,E.generateProject({...wind,growth:{...wind.growth,seed:2027}}).segments);
const tree=E.generateProject(preset('linked-tree'));assert.equal(tree.depths[0],0);assert.ok(tree.depths.some(x=>x===11));
// IFS counts, geometry and contractivity.
const triangle=E.generateProject({...preset('ifs-triangle'),iterations:1});assert.equal(triangle.count,9);assert.equal(triangle.polygonSize,3);assert.equal(triangle.fill,true);
const carpet=E.generateProject(preset('ifs-carpet'));assert.equal(carpet.count,4*8**4);assert.ok(carpet.segments.every(Number.isFinite));
assert.throws(()=>E.validateProject({...preset('ifs-triangle'),ifs:{...E.defaults.ifs,transforms:[{x:0,y:0,scaleX:.98,scaleY:.98,angle:0,shear:.8,reflect:false}]}}),/piccola/);
// Turtle stack restores position/direction rather than joining separate branch tips.
const turtle={...preset('ls-tree'),iterations:0,lsystem:{axiom:'F[+F]F',rules:{F:'F'},angle:90,stepScale:1,heading:0}},drawing=E.generateProject(turtle);
assert.equal(drawing.count,3);[0,0,1,0,1,0,1,1,1,0,2,0].forEach((x,i)=>close(x,drawing.segments[i]));
assert.throws(()=>E.validateProject({...turtle,lsystem:{...turtle.lsystem,axiom:'F]'}}),/bilanciate/);
const huge=E.generateProject({...preset('ls-tree'),iterations:10});assert.ok(huge.count<=131072);assert.ok(huge.iterations<10);
const reflected=E.generateProject({...preset('elbow-dragon'),endpoint:{u:1,v:0},transformKind:'reflect',transformAngle:0,iterations:9});assert.equal(reflected.overlap,true);
const sequence=preset('sequence-fold'),copies=E.generateProject(sequence);assert.equal(copies.count,2*2**10);assert.equal(copies.pivots.length,11);
for(const p of FormaPresets.presets){const project=FormaPresets.projectForPreset(p),r=E.generateProject(project);assert.ok(r.count>0,p.id);assert.ok(r.count<=(project.mode==='free'?1048576:131072),p.id);assert.ok((r.segments??r.points).every(Number.isFinite),p.id);assert.deepEqual(E.validateProject(JSON.parse(JSON.stringify(project))),project);}
console.log('History identity, migrations, radial/polygon symmetry, seeded growth, IFS, L-systems and all 40 presets passed.');
