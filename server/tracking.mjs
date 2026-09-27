import {twoline2satrec,propagate,gstime,eciToEcf,eciToGeodetic,ecfToLookAngles,geodeticToEcf} from 'satellite.js';
const rad=Math.PI/180;
const observer={latitude:24.4539*rad,longitude:54.3773*rad,height:0};
export function observe(record,date=new Date()){
 const state=propagate(record,date);if(!state?.position)return null;
 const gmst=gstime(date),geo=eciToGeodetic(state.position,gmst),look=ecfToLookAngles(observer,eciToEcf(state.position,gmst));
 if(![geo.latitude,geo.longitude,geo.height,look.elevation,look.azimuth,look.rangeSat].every(Number.isFinite))return null;
 return {lat:geo.latitude/rad,lng:geo.longitude/rad,altitude:geo.height/6371,elevation:look.elevation/rad,azimuth:look.azimuth/rad,range:look.rangeSat};
}
export function horizonLoss(record,now,threshold=10){
 const initial=observe(record,new Date(now));if(!initial||initial.elevation<=threshold)return now;
 for(let sec=10;sec<=1800;sec+=10){const p=observe(record,new Date(now+sec*1000));if(!p)return null;if(p.elevation<=threshold){let lo=now+(sec-10)*1000,hi=now+sec*1000;while(hi-lo>250){const mid=(lo+hi)/2,m=observe(record,new Date(mid));if(!m)return null;if(m.elevation>threshold)lo=mid;else hi=mid}return hi}}
 return null;
}
export function makeTracker(key){
 let records=new Map(),lastDiscovery=0,nextAttempt=0,refreshPromise=null,targetId=null,warning=null;
 async function api(path){
  // Never log the URL: N2YO authentication lives in its query string.
  let res;try{res=await fetch(`https://api.n2yo.com/rest/v1/satellite/${path}/&apiKey=${encodeURIComponent(key)}`,{signal:AbortSignal.timeout(15000)})}catch{throw new Error('N2YO connection unavailable')}
  if(!res.ok)throw new Error(`N2YO returned HTTP ${res.status}`);
  const data=await res.json();if(data.error)throw new Error('N2YO rejected the request; check key or request quota');return data;
 }
 async function refresh(){
  const now=Date.now();if(now<nextAttempt)return;if(refreshPromise)return refreshPromise;
  nextAttempt=now+120000;
  refreshPromise=(async()=>{
   const data=await api('above/24.4539/54.3773/0/90/52');if(!Array.isArray(data.above))throw new Error('N2YO returned no satellite catalog');
   const candidates=data.above.map(s=>{
    if(![s.satlat,s.satlng,s.satalt].every(Number.isFinite))return null;
    const look=ecfToLookAngles(observer,geodeticToEcf({latitude:s.satlat*rad,longitude:s.satlng*rad,height:s.satalt}));
    return {...s,elevation:look.elevation/rad};
   }).filter(s=>s&&s.elevation>=0).sort((a,b)=>b.elevation-a.elevation).slice(0,16);
   let failed=0;
   // Four parallel requests at most; TLE cache avoids repeated upstream requests.
   for(let i=0;i<candidates.length;i+=4){await Promise.all(candidates.slice(i,i+4).map(async s=>{
    const old=records.get(s.satid);if(old&&now-old.loaded<21600000)return;
    try{const payload=await api(`tle/${s.satid}`);const lines=payload.tle?.trim().split(/\r?\n/);if(lines?.length!==2)throw new Error();const rec=twoline2satrec(lines[0],lines[1]);if(!observe(rec))throw new Error();records.set(s.satid,{id:s.satid,name:s.satname,record:rec,loaded:now,tleEpoch:new Date((rec.jdsatepoch-2440587.5)*86400000).toISOString()})}catch{failed++}
   }))}
   for(const [id,s] of records)if(now-s.loaded>21600000)records.delete(id);
   lastDiscovery=Date.now();warning=failed?'Some orbital elements could not be refreshed.':null;
  })().catch(error=>{warning=error.message}).finally(()=>{refreshPromise=null});return refreshPromise;
 }
 return {async status(){
  if(!key)throw new Error('N2YO_API_KEY is not configured');
  // Initial discovery is awaited; subsequent refreshes do not delay local predictions.
  if(!records.size)await refresh();else void refresh();
  const now=Date.now();if(!records.size)throw new Error(warning||'No usable orbital elements returned');
  const sats=[...records.values()].map(s=>{const p=observe(s.record,new Date(now));return p?{id:s.id,name:s.name,...p,tleEpoch:s.tleEpoch}:null}).filter(s=>s&&s.elevation>=0).sort((a,b)=>b.elevation-a.elevation);
  let serving=sats.find(s=>s.id===targetId&&s.elevation>=10);if(!serving){serving=sats.find(s=>s.elevation>=10)||null;targetId=serving?.id??null}
  const loss=serving?horizonLoss(records.get(serving.id).record,now):null;
  const candidates=sats.filter(s=>s.id!==targetId&&s.elevation>=10).map(s=>{const at=observe(records.get(s.id).record,new Date(loss??now));return {...s,elevationAtHandoff:at?.elevation??null}}).filter(s=>s.elevationAtHandoff>=10).sort((a,b)=>b.elevationAtHandoff-a.elevationAtHandoff);
  const candidate=candidates[0]??null,remaining=loss===null?null:Math.max(0,(loss-now)/1000);
  const status=remaining!==null&&remaining<60?'handoff-imminent':'nominal';
  return {mode:'prediction',source:'N2YO orbital elements / SGP4',status,serving,candidate,visibleSatellites:sats.slice(0,150),thresholdDegrees:10,predictedLossAt:loss===null?null:new Date(loss).toISOString(),secondsToHorizonLoss:remaining,observedAt:new Date(now).toISOString(),catalogUpdatedAt:new Date(lastDiscovery||now).toISOString(),catalogStale:!lastDiscovery||now-lastDiscovery>300000,warning,
   explanation:serving?`${serving.name} is the tracking target. ${remaining===null?'No threshold crossing found within 30 minutes.':`It is predicted to cross the 10° elevation threshold in ${Math.ceil(remaining)} seconds.`} ${candidate?`${candidate.name} is the next recommendation among tracked satellites.`:'No suitable next satellite is currently tracked.'} Prediction only; ECHO link control is not connected.`:'No tracked satellite is above the 10° handover threshold. Waiting for the next pass. Prediction only; ECHO link control is not connected.'};
 }};
}
