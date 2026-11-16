/* Shared Canvas/SVG rendering, including structural colors and filled IFS shapes. */
(function(root){
  'use strict';
  let cache=new WeakMap();
  function fit(bounds,w,h,padding=.82){return {x:(bounds.minX+bounds.maxX)/2,y:(bounds.minY+bounds.maxY)/2,scale:Math.min(w*padding/Math.max(.05,bounds.maxX-bounds.minX),h*padding/Math.max(.12,bounds.maxY-bounds.minY))};}
  function axis(g){const b=g.bounds;return b.maxX-b.minX>=b.maxY-b.minY?[b.minX,b.minY,b.maxX,b.minY]:[b.minX,b.minY,b.minX,b.maxY];}
  function mix(a,b,t){return '#'+[1,3,5].map(i=>Math.round(parseInt(a.slice(i,i+2),16)*(1-t)+parseInt(b.slice(i,i+2),16)*t).toString(16).padStart(2,'0')).join('');}
  function color(p,t){return p.colorMiddle?(t<=.5?mix(p.colorStart,p.colorMiddle,t*2):mix(p.colorMiddle,p.colorEnd,(t-.5)*2)):mix(p.colorStart,p.colorEnd,t);}
  function groups(g,p,lines){
    const taper=p.mode==='branches'?p.taper:0,structure=p.structureColor??'spatial',key=[lines,taper,structure].join(':');
    let entries=cache.get(g);if(!entries){entries=new Map();cache.set(g,entries);}if(entries.has(key))return entries.get(key);
    const map=new Map(),values=structure==='generation'?g.depths:g.families;let max=1;
    if(structure!=='spatial'&&values)for(const v of values)max=Math.max(max,v);
    for(let i=0;i<g.count;i++){
      const width=p.mode==='branches'||p.mode==='free'?Math.max(.25,Math.round(lines*Math.pow(g.scales?.[i]??1,taper)*8)/8):lines,bucket=structure==='spatial'?0:(values?.[i]??0),id=width+':'+bucket;
      if(!map.has(id))map.set(id,{width,t:bucket/max,path:new Path2D(),indices:[]});
      const item=map.get(id);item.indices.push(i);
      if(g.segments){const j=i*4;item.path.moveTo(g.segments[j],g.segments[j+1]);item.path.lineTo(g.segments[j+2],g.segments[j+3]);}
      else{const j=i*2;if(item.indices.length===1)item.path.moveTo(g.points[j],g.points[j+1]);item.path.lineTo(g.points[j+2],g.points[j+3]);}
    }
    if(entries.size>5)entries.clear();entries.set(key,map);return map;
  }
  function linePaint(ctx,g,p){if(p.colorMode==='solid')return p.colorStart;const gradient=ctx.createLinearGradient(...axis(g));gradient.addColorStop(0,p.colorStart);if(p.colorMiddle)gradient.addColorStop(.5,p.colorMiddle);gradient.addColorStop(1,p.colorEnd);return gradient;}
  function draw(ctx,w,h,view,g,p,{background=true,lines=p.lineWidth}={}){
    if(background){ctx.fillStyle=p.background;ctx.fillRect(0,0,w,h);}
    ctx.save();ctx.translate(w/2,h/2);ctx.scale(view.scale,-view.scale);ctx.translate(-view.x,-view.y);ctx.lineJoin='round';ctx.lineCap='round';
    const spatial=(p.structureColor??'spatial')==='spatial',paint=spatial?linePaint(ctx,g,p):null;
    if(g.fill&&g.polygonSize){
      for(let i=0;i<g.count;i+=g.polygonSize){ctx.beginPath();const j=i*4;ctx.moveTo(g.segments[j],g.segments[j+1]);for(let k=0;k<g.polygonSize;k++)ctx.lineTo(g.segments[(i+k)*4+2],g.segments[(i+k)*4+3]);ctx.closePath();ctx.fillStyle=spatial?paint:color(p,(g.families?.[i]??0)/Math.max(1,p.ifs.transforms.length-1));ctx.fill();}
    }
    for(const item of groups(g,p,lines).values()){ctx.lineWidth=item.width/view.scale;ctx.strokeStyle=spatial?paint:color(p,item.t);ctx.stroke(item.path);}ctx.restore();
  }
  function overlay(ctx,w,h,view,g,stroke,width=1.5,{alpha=.4,dashed=true}={}){
    if(!g)return;ctx.save();ctx.translate(w/2,h/2);ctx.scale(view.scale,-view.scale);ctx.translate(-view.x,-view.y);ctx.globalAlpha=alpha;ctx.lineWidth=width/view.scale;ctx.strokeStyle=stroke;if(dashed)ctx.setLineDash([6/view.scale,5/view.scale]);
    const paths=groups(g,{mode:'polyline',taper:0,structureColor:'spatial'},width);for(const item of paths.values())ctx.stroke(item.path);ctx.restore();
  }
  function svg(g,p,{width=1600,height=1200,transparent=false,strokeScale=1.5}={}){
    const view=fit(g.bounds,width,height),sx=x=>(x-view.x)*view.scale+width/2,sy=y=>height/2-(y-view.y)*view.scale,coordinate=(x,y)=>sx(x).toFixed(4)+','+sy(y).toFixed(4);
    const [x1,y1,x2,y2]=axis(g),gradient=p.colorMode==='gradient'&&(p.structureColor??'spatial')==='spatial';
    const defs=gradient?`<defs><linearGradient id="lineGradient" gradientUnits="userSpaceOnUse" x1="${sx(x1)}" y1="${sy(y1)}" x2="${sx(x2)}" y2="${sy(y2)}"><stop offset="0" stop-color="${p.colorStart}"/>${p.colorMiddle?`<stop offset="0.5" stop-color="${p.colorMiddle}"/>`:''}<stop offset="1" stop-color="${p.colorEnd}"/></linearGradient></defs>`:'';
    const paint=gradient?'url(#lineGradient)':p.colorStart,spatial=(p.structureColor??'spatial')==='spatial';let paths='';
    if(g.fill&&g.polygonSize)for(let i=0;i<g.count;i+=g.polygonSize){let d='M'+coordinate(g.segments[i*4],g.segments[i*4+1]);for(let k=0;k<g.polygonSize;k++)d+='L'+coordinate(g.segments[(i+k)*4+2],g.segments[(i+k)*4+3]);paths+=`<path d="${d}Z" fill="${spatial?paint:color(p,(g.families?.[i]??0)/Math.max(1,p.ifs.transforms.length-1))}" stroke="none"/>`;}
    for(const item of groups(g,p,p.lineWidth*strokeScale).values()){
      let d='';for(const i of item.indices){if(g.segments){const j=i*4;d+='M'+coordinate(g.segments[j],g.segments[j+1])+'L'+coordinate(g.segments[j+2],g.segments[j+3]);}else{const j=i*2;if(!d)d='M'+coordinate(g.points[j],g.points[j+1]);d+='L'+coordinate(g.points[j+2],g.points[j+3]);}}
      paths+=`<path d="${d}" fill="none" stroke="${spatial?paint:color(p,item.t)}" stroke-width="${item.width}"/>`;
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${defs}${transparent?'':`<rect width="100%" height="100%" fill="${p.background}"/>`}<g stroke-linejoin="round" stroke-linecap="round">${paths}</g></svg>`;
  }
  const api={fit,axis,draw,overlay,svg,groups,color,clear:()=>{cache=new WeakMap();}};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.FractalRenderer=api;
})(typeof globalThis!=='undefined'?globalThis:this);
