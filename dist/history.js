/* Project identity belongs to the same history entry as its geometry. */
(function(root){
  'use strict';
  class ProjectHistory {
    constructor(limit=60){this.limit=limit;this.entries=[];this.index=-1;}
    push(project,editingId=null,presetId=''){
      const entry=JSON.parse(JSON.stringify({project,editingId,presetId}));
      if(this.index>=0&&JSON.stringify(this.entries[this.index])===JSON.stringify(entry))return false;
      this.entries=this.entries.slice(0,this.index+1);this.entries.push(entry);
      if(this.entries.length>this.limit)this.entries.shift();this.index=this.entries.length-1;return true;
    }
    move(delta){const index=this.index+delta;if(index<0||index>=this.entries.length)return null;this.index=index;return JSON.parse(JSON.stringify(this.entries[index]));}
    get canUndo(){return this.index>0;}
    get canRedo(){return this.index<this.entries.length-1;}
  }
  if(typeof module!=='undefined'&&module.exports)module.exports=ProjectHistory;else root.ProjectHistory=ProjectHistory;
})(typeof globalThis!=='undefined'?globalThis:this);
