export class DebouncedWriter{
 constructor({save,persist=()=>{},status=()=>{},delay=650}){Object.assign(this,{save,persist,status,delay});this.latest=null;this.version=0;this.busy=null;this.timer=null;}
 get dirty(){return this.latest!==null;}
 queue(value){this.latest=structuredClone(value);this.version++;this.persist(this.latest);clearTimeout(this.timer);this.status('pending');this.timer=setTimeout(()=>this.flush().catch(()=>{}),this.delay);}
 invalidate(){clearTimeout(this.timer);this.latest=null;this.version++;this.status('invalid');}
 async flush(){clearTimeout(this.timer);if(this.busy)return this.busy;if(!this.dirty)return;
 this.busy=(async()=>{while(this.latest!==null){const value=structuredClone(this.latest),version=this.version;this.status('saving');try{await this.save(value);}catch(e){this.status('error',e);throw e;}if(version===this.version){this.latest=null;this.persist(null);this.status('saved');}}})();
 try{return await this.busy;}finally{this.busy=null;}
 }
}

