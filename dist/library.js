/* One library with browser persistence, optional file persistence, backup and trash. */
(function(root){
  'use strict';
  const key='forma.library.v2',clone=value=>JSON.parse(JSON.stringify(value));
  function id(){const bytes=new Uint8Array(16);crypto.getRandomValues(bytes);return 'custom-'+[...bytes].map(x=>x.toString(16).padStart(2,'0')).join('');}
  class Library {
    constructor(engine,source){this.engine=engine;this.source=source;this.local=[];this.files=[];this.trash=[];this.server=false;this.error='';this.capacity=256;}
    validate(record,source='browser'){
      if(!record||typeof record.id!=='string'||!/^custom-[a-f0-9]{32}$/.test(record.id))throw new Error('Identificatore della creazione non valido.');
      const project=this.engine.upgradeProject(record.project);if(!project.name.trim())project.name='Creazione senza nome';
      if(['polyline','free'].includes(project.mode)&&root.FractalConstraints){const check=root.FractalConstraints.check(project.folds,project.endpoint,project.constraints,1e-5,project.origin);if(!check.ok)throw new Error(check.message);}
      return {id:record.id,project,source,date:typeof record.date==='string'?record.date:new Date().toISOString()};
    }
    get records(){const all=new Map(this.files.map(r=>[r.id,r]));for(const r of this.local)all.set(r.id,r);return [...all.values()];}
    persist(local=this.local,trash=this.trash){
      const total=new Set([...this.files,...local].map(r=>r.id)).size;
      if(total>this.capacity)throw new Error('La raccolta contiene al massimo 256 creazioni. Esporta un backup prima di liberare spazio.');
      try{localStorage.setItem(key,JSON.stringify({version:2,records:local,trash}));}catch{throw new Error('Salvataggio nel browser non disponibile o spazio esaurito. Esporta il progetto JSON.');}
      this.local=local;this.trash=trash;
    }
    async initialize(){
      try{const raw=localStorage.getItem(key);if(raw){const data=JSON.parse(raw);if(data.version!==2||!Array.isArray(data.records)||!Array.isArray(data.trash))throw new Error('Raccolta del browser non riconosciuta: i dati originali sono conservati.');this.local=data.records.map(r=>this.validate(r));this.trash=data.trash.map(r=>({...this.validate(r,r.source),deleted:r.deleted}));}}
      catch(error){this.error=error.message;this.readOnly=true;}
      try{if(this.source?.version===1&&Array.isArray(this.source.presets))this.files=this.source.presets.map(r=>this.validate(r,'project'));}catch(error){this.error=error.message;}
      if(location.protocol==='http:'&&['127.0.0.1','localhost'].includes(location.hostname)){
        try{const response=await fetch('/api/presets');if(response.ok&&response.headers.get('Content-Type')?.includes('application/json')){const data=await response.json();this.files=data.presets.map(r=>this.validate(r,'project'));this.server=true;}}catch{}
      }
      if(!this.readOnly){
        try{
          const legacy=JSON.parse(localStorage.getItem('forma.gallery.v1')||'[]'),existing=this.records;
          if(Array.isArray(legacy)){const migrated=[];for(const item of legacy){try{const project=this.engine.upgradeProject(item.project);if(!existing.concat(migrated).some(r=>JSON.stringify(r.project)===JSON.stringify(project)))migrated.push(this.validate({id:id(),project,date:item.date}));}catch{}}
            if(migrated.length)this.persist([...this.local,...migrated]);}
        }catch(error){this.error=this.error||error.message;}
      }
      return this.records;
    }
    async request(method,path,body){
      const response=await fetch(path,{method,headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined});
      if(!response.headers.get('Content-Type')?.includes('application/json'))throw new Error('Il server locale non supporta il salvataggio. Riavvia avvia-locale.cmd.');
      const data=await response.json();if(!response.ok)throw new Error(data.error||'Salvataggio non riuscito.');this.files=data.presets.map(r=>this.validate(r,'project'));return data;
    }
    async save(project,recordId=null,destination='auto'){
      if(this.readOnly)throw new Error(this.error||'La raccolta deve essere recuperata prima di salvarvi nuovi dati.');
      const current=recordId?this.records.find(r=>r.id===recordId):null;if(recordId&&!current)throw new Error('La creazione non esiste più. Salvala come nuova.');
      const validated=this.engine.upgradeProject(project);if(!validated.name.trim())throw new Error('Inserisci un nome.');
      const toFile=destination==='project'||(destination==='auto'&&this.server&&(!current||current.source==='project'));
      if(toFile){if(!this.server)throw new Error('Per salvare nei file del progetto avvia avvia-locale.cmd. Puoi salvare subito nel browser.');const data=await this.request('POST','/api/presets',{project:validated,id:current?.source==='project'?recordId:null});if(current?.source==='browser')this.persist(this.local.filter(r=>r.id!==recordId));return data.saved_id;}
      const record=this.validate({id:recordId||id(),project:validated});this.persist([...this.local.filter(r=>r.id!==record.id),record]);return record.id;
    }
    async remove(recordId){
      const record=this.records.find(r=>r.id===recordId);if(!record)throw new Error('Creazione non trovata.');
      const trash=[{...record,deleted:new Date().toISOString()},...this.trash].slice(0,32);
      // Save the recovery copy before touching the file. A failed delete remains recoverable.
      this.persist(this.local,trash);
      if(record.source==='project'&&this.server)await this.request('DELETE','/api/presets/'+record.id);
      else if(record.source==='project')throw new Error('Avvia il server locale per eliminare un preset dai file del progetto.');
      this.persist(this.local.filter(r=>r.id!==recordId),trash);return record;
    }
    async restore(recordId){
      const record=this.trash.find(r=>r.id===recordId);if(!record)throw new Error('Creazione non presente nel cestino.');
      const existing=this.records.find(r=>r.id===recordId);if(existing){this.persist(this.local,this.trash.filter(r=>r.id!==recordId));return existing.id;}
      const restoredId=await this.save(record.project,null,record.source==='project'&&this.server?'project':'browser');this.persist(this.local,this.trash.filter(r=>r.id!==recordId));return restoredId;
    }
    backup(){return {format:'forma-library',version:1,date:new Date().toISOString(),records:this.records.map(clone),trash:this.trash.map(clone)};}
    importBackup(data){
      if(this.readOnly)throw new Error(this.error);
      if(!data||data.format!=='forma-library'||data.version!==1||!Array.isArray(data.records)||data.records.length>256||!Array.isArray(data.trash??[])||(data.trash?.length??0)>32)throw new Error('Backup della raccolta non valido.');
      const validated=data.records.map(r=>this.validate(r)),deleted=(data.trash??[]).map(r=>({...this.validate(r),deleted:r.deleted})),next=[...this.local],all=this.records;let imported=0;
      for(const record of validated){const candidates=all.concat(next),fingerprint=JSON.stringify(record.project);if(candidates.some(r=>JSON.stringify(r.project)===fingerprint))continue;const existing=candidates.find(r=>r.id===record.id);if(existing)record.id=id();next.push(record);imported++;}
      const trash=[...this.trash];for(const record of deleted)if(!trash.some(r=>r.id===record.id))trash.push(record);
      this.persist(next,trash.slice(0,32));return imported;
    }
  }
  root.FormaLibrary=Library;
})(typeof globalThis!=='undefined'?globalThis:this);
