import {readFileSync} from 'node:fs';
import {twoline2satrec} from 'satellite.js';
import {observe} from './tracking.mjs';
let records=[],loadedAt=0,pending=null,retryAt=0,snapshot=null,snapshotAt=0,partial=false;
try{
 const lines=readFileSync(new URL('./cache/starlink.tle',import.meta.url),'utf8').split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
 const meta=JSON.parse(readFileSync(new URL('./cache/catalog.json',import.meta.url),'utf8'));
 for(let i=0;i<lines.length-2;i+=3){const rec=twoline2satrec(lines[i+1],lines[i+2]);records.push({name:lines[i],id:String(rec.satnum),record:rec})}
 loadedAt=Date.parse(meta.downloadedAt);partial=meta.partial;retryAt=Date.now()+3600000;
}catch{ /* Cold start without cache uses the public catalog. */ }

export async function constellation(){
 const now=Date.now();
 if(now-loadedAt>4*3600000&&now>=retryAt&&!pending){
  retryAt=now+60000;
  pending=(async()=>{
   const r=await fetch('https://celestrak.org/NORAD/elements/gp.php?GROUP=starlink&FORMAT=tle',{signal:AbortSignal.timeout(25000)});
   if(!r.ok)throw new Error('Global orbital catalog unavailable');
   const lines=(await r.text()).split(/\r?\n/).map(s=>s.trim()).filter(Boolean),next=[];
   for(let i=0;i<lines.length-2;i++)if(lines[i].startsWith('STARLINK')&&lines[i+1].startsWith('1 ')&&lines[i+2].startsWith('2 ')){
    const rec=twoline2satrec(lines[i+1],lines[i+2]);next.push({name:lines[i],id:String(rec.satnum),record:rec});i+=2;
   }
   if(!next.length)throw new Error('Global orbital catalog had no valid elements');records=next;partial=false;loadedAt=Date.now();snapshot=null;
  })().finally(()=>pending=null);
 }
 if(pending){try{await pending}catch{if(!records.length)throw new Error('Global catalog is unavailable. Local tracking remains available.')}}
 if(!records.length)throw new Error('Global catalog is unavailable. Retrying shortly.');
 if(!snapshot||now-snapshotAt>10000){const date=new Date();const satellites=[];for(const s of records){const p=observe(s.record,date);if(p&&p.altitude>0)satellites.push({id:s.id,name:s.name,...p})}snapshot={satellites,source:'CelesTrak Starlink GP / SGP4',observedAt:date.toISOString(),catalogUpdatedAt:new Date(loadedAt).toISOString(),partial,catalogStale:Date.now()-loadedAt>4*3600000};snapshotAt=now}
 return snapshot;
}
