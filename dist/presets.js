/* Curated examples and their editable recipes. */
(function(root){
  'use strict';
  const E=root.FractalEngine,clone=value=>JSON.parse(JSON.stringify(value));
  const presets = [
    {id:'koch',label:'Koch',name:'Curva di Koch',folds:[{u:1/3,v:0},{u:.5,v:Math.sqrt(3)/6},{u:2/3,v:0}],iterations:5},
    {id:'levy',label:'Lévy',name:'Curva di Lévy',folds:[{u:.5,v:.5}],iterations:10},
    {id:'minkowski',label:'Minkowski',name:'Curva di Minkowski',folds:[{u:.25,v:0},{u:.25,v:.25},{u:.5,v:.25},{u:.5,v:0},{u:.5,v:-.25},{u:.75,v:-.25},{u:.75,v:0}],iterations:4},
    {id:'z',label:'Zig zag',name:'Onda a zig zag',folds:[{u:1/3,v:.35},{u:2/3,v:-.35}],iterations:6},
    {id:'tent',label:'Picco',name:'Picco triangolare',folds:[{u:.5,v:.65}],iterations:8},
    {id:'wave',label:'Onda',name:'Onda ricorsiva',folds:[{u:.25,v:.18},{u:.5,v:0},{u:.75,v:-.18}],iterations:5},
    {id:'tree',label:'Albero',name:'Albero simmetrico',mode:'branches',iterations:12,branches:[{angle:30,ratio:.7,attach:1,flip:false},{angle:-30,ratio:.7,attach:1,flip:false}],lineWidth:1.2,taper:0},
    {id:'spiral-tree',label:'Spirale',name:'Albero a spirale',mode:'branches',iterations:28,branches:[{angle:30,ratio:.87,attach:1,flip:false},{angle:-60,ratio:.5,attach:1,flip:false}],lineWidth:11,taper:1,minBranch:.006}
  ];
  presets.push(
    {id:'sharp-koch',label:'Koch acuto',name:'Variante di Koch acuta',folds:[{u:1/3,v:0},{u:.5,v:.55},{u:2/3,v:0}],iterations:5},
    {id:'square-tooth',label:'Dente quadro',name:'Dente quadro ricorsivo',folds:[{u:.25,v:0},{u:.25,v:.5},{u:.75,v:.5},{u:.75,v:0}],iterations:5}
  );
  for(const [id,label,angles,ratios,attach] of [
    ['fern','Felce stilizzata',[0,55,-55],[.8,.4,.4],[1,.6,.6]],
    ['pine','Pino',[0,75,-75],[.65,.48,.48],[1,.75,.75]],
    ['trident','Tridente',[0,40,-40],[.6,.6,.6],[1,1,1]],
    ['coral','Corallo',[20,-55],[.73,.62],[1,1]],
    ['snowflake','Fiocco radiale',[0,60,-60],[.45,.35,.35],[1,.65,.65]],
    ['canopy','Chioma larga',[50,-50],[.68,.68],[1,1]]
  ])presets.push({id,label,name:label,mode:'branches',radialCopies:id==='snowflake'?6:1,iterations:18,minBranch:.008,lineWidth:4,taper:1,branches:angles.map((angle,i)=>({angle,ratio:ratios[i],attach:attach[i],flip:false}))});
  presets.push(
    {id:'elbow-dragon',label:'Drago a L',name:'Drago a L (90 gradi)',mode:'free',iterations:13,transformKind:'rotate',transformAngle:90,folds:[{u:1,v:0}],endpoint:{u:1,v:1},lineWidth:1.2,colorStart:'#00e51b',colorMiddle:'#e6ba00',colorEnd:'#ff3030'},
    {id:'rosette',label:'Reticolo esag.',name:'Reticolo esagonale',mode:'free',iterations:9,transformKind:'rotate',transformAngle:60,folds:[{u:.25,v:.43},{u:.75,v:.43}]},
    {id:'golden-fold',label:'Cristallo',name:'Cristallo a 108 gradi',mode:'free',iterations:12,transformKind:'rotate',transformAngle:108,folds:[{u:.4,v:.6},{u:.8,v:.2}]},
    {id:'paperfold',label:'Fisarmonica',name:'Piegatura a fisarmonica',mode:'free',iterations:12,transformKind:'rotate',transformAngle:90,folds:[{u:.25,v:.25},{u:.5,v:0},{u:.75,v:-.25}]},
    {id:'hooks',label:'Uncini',name:'Mosaico di uncini',mode:'free',iterations:11,transformKind:'rotate',transformAngle:90,folds:[{u:1,v:0},{u:1,v:.6},{u:.6,v:.6},{u:.6,v:1}],endpoint:{u:1,v:1}},
    {id:'triangle-fold',label:'Triangoli',name:'Piegatura triangolare',mode:'free',iterations:12,transformKind:'rotate',transformAngle:120,folds:[{u:.5,v:.87}]},
    {id:'spiral-fold',label:'Vortice',name:'Vortice a 135 gradi',mode:'free',iterations:12,transformKind:'rotate',transformAngle:135,folds:[{u:.35,v:.5},{u:.75,v:-.15}]},
    {id:'mirror-frieze',label:'Friso',name:'Friso specchiato',mode:'free',iterations:7,transformKind:'reflect',transformAngle:30,folds:[{u:.25,v:.4},{u:.5,v:-.2},{u:.75,v:.4}]}
  );

  const extra=(id,label,mode,options,hint)=>presets.push({id,label,name:label,mode,iterations:5,...options,hint,modern:true});
  const koch=clone(presets.find(p=>p.id==='koch').folds);
  extra('koch-snowflake','Fiocco di Koch','polyline',{folds:koch,composition:{kind:'polygon',count:3}},'Inverti lo sviluppo per scavare il contorno.');
  extra('koch-inward','Fiocco interno','polyline',{folds:koch,composition:{kind:'polygon',count:3,inward:true}},'Confronta le punte interne ed esterne.');
  extra('square-island','Isola quadrata','polyline',{folds:clone(presets.find(p=>p.id==='square-tooth').folds),composition:{kind:'polygon',count:4},iterations:4},'Cambia il numero di lati della figura iniziale.');
  extra('rosette-six','Rosetta a sei bracci','polyline',{folds:[{u:.5,v:.3}],composition:{kind:'radial',count:6},iterations:8},'Sposta il punto e osserva tutti i bracci.');
  extra('mirror-mandala','Mandala specchiato','polyline',{folds:[{u:.3,v:.2},{u:.65,v:.1}],composition:{kind:'radial',count:8,reflect:true},iterations:5},'Disattiva i settori specchiati per confrontare la simmetria.');
  extra('linked-tree','Albero guidato','branches',{endpoint:{u:0,v:1},branches:[{angle:32,ratio:.7,attach:1,flip:false},{angle:-32,ratio:.7,attach:1,flip:false}],growth:{linked:true},iterations:11,taper:1,lineWidth:4},'Apri la chioma: i due rami restano collegati.');
  extra('wind-tree','Albero al vento','branches',{endpoint:{u:0,v:1},branches:[{angle:20,ratio:.72,attach:1,flip:false},{angle:-35,ratio:.65,attach:.9,flip:false}],growth:{jitter:.12,seed:2026,levelAngle:1.5},iterations:13,taper:1,lineWidth:4},'Cambia il seme per una nuova crescita riproducibile.');
  extra('alternating-coral','Corallo radiale','branches',{endpoint:{u:0,v:1},radialCopies:7,branches:[{angle:22,ratio:.62,attach:1,flip:false},{angle:-45,ratio:.5,attach:.65,flip:false}],growth:{alternate:true},iterations:10,taper:1,lineWidth:3},'Alterna il verso dei settori.');
  extra('sequence-fold','Pieghe alternate','free',{folds:[{u:1,v:0}],endpoint:{u:1,v:1},transformAngle:-90,foldSequence:[{kind:'rotate',angle:-90},{kind:'rotate',angle:-90},{kind:'rotate',angle:90}],iterations:10},'Modifica un passo della sequenza e confronta il risultato.');
  const triangle=[{u:.5,v:Math.sqrt(3)/2}];
  extra('ifs-triangle','Triangolo di Sierpiński','ifs',{folds:triangle,ifs:{fill:true},iterations:7},'Trascina le copie nell’editor delle trasformazioni.');
  const carpet=[];for(let y=0;y<3;y++)for(let x=0;x<3;x++)if(x!==1||y!==1)carpet.push({x:x/3,y:y/3,scaleX:1/3,scaleY:1/3,angle:0,shear:0,reflect:false});
  extra('ifs-carpet','Tappeto di Sierpiński','ifs',{folds:[{u:0,v:1},{u:1,v:1}],ifs:{fill:true,transforms:carpet},iterations:4},'Rimuovi una copia per cambiare i vuoti del tappeto.');
  extra('ifs-spiral','Spirali autosimili','ifs',{folds:triangle,ifs:{transforms:[{x:0,y:0,scaleX:.65,scaleY:.65,angle:25,shear:0,reflect:false},{x:.7,y:.15,scaleX:.3,scaleY:.3,angle:-20,shear:0,reflect:false}]},iterations:9},'Varia scala e rotazione della copia dominante.');
  function affine(a,b,c,d,x,y){const sx=Math.hypot(a,c),angle=Math.atan2(c,a),co=Math.cos(angle),si=Math.sin(angle),sy=co*d-si*b;return {x,y,scaleX:sx,scaleY:Math.abs(sy),angle:angle*180/Math.PI,shear:co*b+si*d,reflect:sy<0};}
  extra('ifs-fern','Felce affine','ifs',{folds:[{u:0,v:10}],endpoint:{u:3,v:0},ifs:{transforms:[affine(0,0,0,.16,0,0),affine(.85,.04,-.04,.85,0,1.6),affine(.2,-.26,.23,.22,0,1.6),affine(-.15,.28,.26,.24,0,.44)]},iterations:7,lineWidth:.6},'Le copie usano scale diverse e inclinazioni affini.');
  extra('ls-tree','Albero a grammatica','lsystem',{lsystem:{axiom:'F',rules:{F:'F[+F]F[-F]F'},angle:25,stepScale:.65,heading:90},iterations:4,structureColor:'generation'},'F avanza, + e − ruotano, [ e ] aprono e chiudono un ramo.');
  extra('ls-hilbert','Curva di Hilbert','lsystem',{lsystem:{axiom:'A',rules:{A:'+BF-AFA-FB+',B:'-AF+BFB+FA-'},angle:90,stepScale:.5,heading:0},iterations:5},'Due regole diverse costruiscono un percorso continuo.');
  extra('ls-plant','Pianta a grammatica','lsystem',{lsystem:{axiom:'X',rules:{X:'F+[[X]-X]-F[-FX]+X',F:'FF'},angle:25,stepScale:.5,heading:90},iterations:5},'Modifica l’angolo per cambiare il portamento della pianta.');
  function projectForPreset(p){
    const base=E.upgradeProject(E.validateProject({version:1,name:p.name,folds:clone(p.folds||[{u:.5,v:.5}]),iterations:Math.min(10,p.iterations),mirror:false,palette:'lime',lineWidth:p.lineWidth??1.3}));
    const mode=p.mode||'polyline';
    const options={...base,mode,iterations:p.iterations,endpoint:p.endpoint??(mode==='branches'?{u:0,v:1}:base.endpoint),lineWidth:p.lineWidth??base.lineWidth,branches:p.branches??base.branches,radialCopies:p.radialCopies??1,taper:p.taper??0,minBranch:p.minBranch??.003,transformKind:p.transformKind??'rotate',transformAngle:p.transformAngle===undefined?-90:p.modern||p.transformKind==='reflect'?p.transformAngle:-p.transformAngle,colorStart:p.colorStart??(mode==='branches'?'#c9ef80':base.colorStart),colorMiddle:p.colorMiddle??null,colorEnd:p.colorEnd??base.colorEnd,colorMode:mode==='branches'?'solid':'gradient',structureColor:p.structureColor??'spatial'};
    for(const key of ['composition','growth','ifs','lsystem'])options[key]={...clone(E.defaults[key]),...(p[key]||{})};
    options.foldSequence=p.foldSequence??[];return E.upgradeProject(options);
  }
  for(const p of presets){p.family=p.family??(p.composition&&p.composition.kind==='radial'?'symmetry':p.mode==='branches'?'organic':p.mode==='free'?'folds':p.mode==='ifs'?'copies':p.mode==='lsystem'?'grammar':'curves');p.beginner=['koch','tree','elbow-dragon','ifs-triangle','ls-tree'].includes(p.id);p.hint=p.hint??(p.mode==='free'?'Osserva la prossima copia e prova un altro angolo.':p.mode==='branches'?'Modifica apertura, scala e innesto dei rami.':'Trascina un punto e osserva come cambia la regola.');}
  root.FormaPresets={presets,projectForPreset};
})(typeof globalThis!=='undefined'?globalThis:this);
