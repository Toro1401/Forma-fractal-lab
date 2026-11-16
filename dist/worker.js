/* The worker imports the same engine as the UI; no function serialization. */
importScripts('engine.js?v=20261113-1','generators.js?v=20261113-1','renderer.js?v=20261113-1');
let retained=null;
self.onmessage=event=>{
  if(event.data.type==='raster'){
    const {id,key,project,view,w,h,dpr,ghostColor,ghostWidth}=event.data;
    try{
      if(!retained||FractalEngine.geometryKey(retained.project)!==FractalEngine.geometryKey(project)){self.postMessage({type:'raster',id,key,cancelled:true});return;}
      const canvas=new OffscreenCanvas(Math.max(1,Math.round(w*dpr)),Math.max(1,Math.round(h*dpr))),ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);
      if(retained.previous)FractalRenderer.overlay(ctx,w,h,view,retained.previous,ghostColor,ghostWidth*.12,{alpha:.3});
      if(retained.next)FractalRenderer.overlay(ctx,w,h,view,retained.next,'#f6bc7d',1.4,{alpha:.45});
      FractalRenderer.draw(ctx,w,h,view,retained.geometry,project,{background:false});
      const bitmap=canvas.transferToImageBitmap();self.postMessage({type:'raster',id,key,bitmap,view,w,h,dpr},[bitmap]);
    }catch(error){self.postMessage({type:'raster',id,key,error:error.message});}return;
  }
  const {id,project,previous,next}=event.data;
  try{
    const geometry=FractalEngine.generateProject(project),bundle={id,geometry};
    if(previous&&geometry.iterations>0)bundle.previous=FractalEngine.generateProject({...project,iterations:geometry.iterations-1});
    if(next&&geometry.iterations===project.iterations){const candidate=FractalEngine.generateProject({...project,iterations:Math.min(project.mode==='branches'?32:project.mode==='free'?20:10,geometry.iterations+1)});if(candidate.iterations>geometry.iterations)bundle.next=candidate;}
    retained={...bundle,project};
    // Retain geometry in the worker for nonblocking redraws. Structured cloning gives
    // the UI its own exact buffers for exports, without detaching the worker's copy.
    self.postMessage(bundle);
  }catch(error){self.postMessage({id,error:error.message});}
};
