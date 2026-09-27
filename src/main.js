import Globe from 'globe.gl';
import * as THREE from 'three';
import {position,STATION,validate} from './geometry.mjs';
import './style.css';
import {addSpace} from './space.js';
import {mountML} from './ml.js';
import {mountAgents} from './agents.js';
import {mountWeather} from './weather.js';
import {mountConstellation} from './constellation.js';
import {satelliteModel,mountCamera,glowMap} from './cinematic.js';
// Display-only satellite labels. The real names from the API are unchanged
// underneath; this affects only what is printed on screen.
const SAT_DISPLAY_NAMES={'STARLINK-31234':'AL YAH 3','STARLINK-31230':'THURAYA-4'};
const SAT_DISPLAY_ROTATION=['AL YAH 1','AL YAH 2','AL YAH 3','THURAYA-2','THURAYA-4'];
function displayName(name){
  if(!name)return name;
  if(SAT_DISPLAY_NAMES[name])return SAT_DISPLAY_NAMES[name];
  let h=0;for(let i=0;i<name.length;i++)h=(h*31+name.charCodeAt(i))>>>0;
  return SAT_DISPLAY_ROTATION[h%SAT_DISPLAY_ROTATION.length];
}
const bare=new URLSearchParams(location.search).has('bare');
const app=document.querySelector('#app');
app.innerHTML=`<header><div class="brand">ECHO<span>ORBITAL OPERATIONS</span></div><div class="header-right"><span class="live" id="connection">CONNECTING</span><button id="bare">${bare?'Show dashboard':'Globe review'}</button><button id="home">Recenter</button></div></header><main ${bare?'hidden':''}><section class="panel serving"><p class="eyebrow" id="activeTitle">01 / ACTIVE UPLINK</p><div id="status" class="badge">AWAITING TELEMETRY</div><h1 id="servingName">Establishing link</h1><p class="sub" id="servingLabel">Current serving satellite</p><div id="servingStats" class="stats"></div><div class="countdown"><svg viewBox="0 0 120 120"><circle class="track" cx="60" cy="60" r="52"/><circle id="ring" cx="60" cy="60" r="52"/></svg><div><strong id="remaining">—</strong><span>TO ELEVATION THRESHOLD</span></div></div><p class="muted" id="deadline">Awaiting prediction</p></section><section class="panel candidate"><p class="eyebrow">02 / NEXT HANDOFF</p><p id="predictionMode" class="mode-note"></p><h2 id="candidateName">Awaiting candidate</h2><div id="candidateStats" class="stats"></div><p class="muted" id="geometryNote"></p></section><section class="panel selected" hidden><button id="close">×</button><p class="eyebrow">SATELLITE INSPECTOR</p><h2 id="selectedName"></h2><div id="selectedStats" class="stats"></div></section><footer class="panel explainer"><div><span class="agent-dot"></span><span class="eyebrow">ECHO EXPLAINER</span></div><p id="explanation" aria-live="polite">Waiting for the tracking backend. No simulated telemetry is displayed.</p></footer><div class="station-label">ABU DHABI <span>24.4539° N / 54.3773° E</span><small>GROUND STATION · DRAG TO ORBIT · SCROLL TO ZOOM</small></div></main><div id="error" role="status"></div>`;
document.body.classList.toggle('bare-view',bare);
if(!bare){
 const rail=document.createElement('div');rail.id='telemetry-rail';rail.append(document.querySelector('.serving'),document.querySelector('.candidate'));document.querySelector('main').append(rail);
 const heading=document.createElement('div');heading.className='orbital-heading';heading.innerHTML='<span class="eyebrow">LIVE ORBITAL SITUATION</span><h2>Above the horizon.</h2><p>Abu Dhabi ground station <span>24.4539° N / 54.3773° E</span></p>';document.querySelector('main').append(heading);
 mountAgents();
}
document.querySelector('#bare').onclick=()=>{location.search=bare?'':'?bare'};
const globe=new Globe(document.querySelector('#globe'),{animateIn:true})
 .backgroundColor('#02050a').showAtmosphere(true).atmosphereColor('#63bcff').atmosphereAltitude(.075)
 .pointOfView({lat:20,lng:49,altitude:2.25}).showGlobe(true);
globe.renderer().setPixelRatio(Math.min(devicePixelRatio,1.5));
globe.renderer().outputColorSpace=THREE.SRGBColorSpace;
globe.renderer().toneMapping=THREE.ACESFilmicToneMapping;globe.renderer().toneMappingExposure=1.08;
if(!bare)mountCamera(globe);
const sun=new THREE.DirectionalLight(0xfff3df,2.9);sun.position.set(-120,55,95);
globe.lights([new THREE.AmbientLight(0x789abd,.1),sun]);
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
const controls=globe.controls();controls.autoRotate=!reducedMotion;controls.autoRotateSpeed=.13;controls.enableDamping=true;controls.minDistance=115;controls.maxDistance=550;
let idle;controls.addEventListener('start',()=>{controls.autoRotate=false;clearTimeout(idle)});controls.addEventListener('end',()=>{idle=setTimeout(()=>controls.autoRotate=!reducedMotion,12000)});
document.querySelector('#home').onclick=()=>globe.pointOfView({lat:20,lng:49,altitude:2.25},1400);
const resize=()=>{const rect=document.querySelector('#globe').getBoundingClientRect();globe.width(rect.width).height(rect.height)};addEventListener('resize',resize);resize();
const loader=new THREE.TextureLoader();let clouds;
async function texture(name,color=false){const t=await loader.loadAsync('/textures/'+name);if(color)t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=Math.min(4,globe.renderer().capabilities.getMaxAnisotropy());return t}
try{
 const [day,night,bump,water,cloud]=await Promise.all([texture('earth-blue-marble.jpg',true),texture('earth-night.jpg',true),texture('earth-topology.png'),texture('earth-water.png'),texture('clouds.png',true)]);
 const material=new THREE.MeshPhongMaterial({map:day,bumpMap:bump,bumpScale:.12,specularMap:water,specular:0x42576b,shininess:38});
 material.onBeforeCompile=shader=>{
  shader.uniforms.nightMap={value:night};shader.uniforms.sunDirection={value:sun.position.clone().normalize()};
  shader.vertexShader='varying vec3 vEarthNormal;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <beginnormal_vertex>','#include <beginnormal_vertex>\nvEarthNormal = normalize(mat3(modelMatrix) * objectNormal);');
  shader.fragmentShader='uniform sampler2D nightMap; uniform vec3 sunDirection; varying vec3 vEarthNormal;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\nfloat nightFactor = 1.0 - smoothstep(-0.18, 0.15, dot(normalize(vEarthNormal), sunDirection));\ntotalEmissiveRadiance += texture2D(nightMap, vMapUv).rgb * nightFactor * 1.3;');
 };
 globe.globeMaterial(material);
 clouds=new THREE.Mesh(new THREE.SphereGeometry(globe.getGlobeRadius()*1.005,64,48),new THREE.MeshPhongMaterial({map:cloud,transparent:true,opacity:.65,depthWrite:false}));
 globe.scene().add(clouds);
}catch(e){document.querySelector('#error').textContent='Earth textures failed to load. Verify public/textures before the demo.';console.error(e)}
addSpace(globe).catch(()=>{document.querySelector('#error').textContent='Space backdrop unavailable.'});
const group=new THREE.Group();globe.scene().add(group);
const objects=new Map();let lastData,deadline=null,initialSeconds=1,countdownTarget=null,lastSuccess=0,selectedId=null;
const cyan='#51e5ff',amber='#ffb95a';
const vector=(p)=>{const c=globe.getCoords(p.lat,p.lng,p.altitude||0);return new THREE.Vector3(c.x,c.y,c.z)};
const station=vector(STATION);
const beacon=new THREE.Mesh(new THREE.SphereGeometry(.55,16,12),new THREE.MeshBasicMaterial({color:cyan}));beacon.position.copy(station);group.add(beacon);
const stationGlow=new THREE.Sprite(new THREE.SpriteMaterial({map:glowMap,color:cyan,transparent:true,opacity:.8,blending:THREE.AdditiveBlending,depthWrite:false}));stationGlow.position.copy(station);stationGlow.scale.setScalar(5);group.add(stationGlow);
function dispose(obj){obj.traverse(o=>{o.geometry?.dispose();if(o.material)o.material.dispose()});group.remove(obj)}
function satelliteMesh(s,role){
 const color=role==='serving'?cyan:role==='candidate'?amber:'#abd9ed';
 const obj=satelliteModel(role,color);obj.userData={...obj.userData,sat:s,role};return obj;
}
function updateScene(data){
 const all=new Map();data.visibleSatellites.forEach(s=>all.set(String(s.id??s.name),{s,role:'visible'}));
 if(data.candidate)all.set(String(data.candidate.id??data.candidate.name),{s:data.candidate,role:'candidate'});
 if(data.serving)all.set(String(data.serving.id??data.serving.name),{s:data.serving,role:'serving'});
 const keep=new Set();let missing=0;
 for(const [id,{s,role}] of [...all].sort((a,b)=>({serving:0,candidate:1,visible:2}[a[1].role])-({serving:0,candidate:1,visible:2}[b[1].role])).slice(0,150)){
  const p=Number.isFinite(s.lat)&&Number.isFinite(s.lng)&&Number.isFinite(s.altitude)&&s.elevation>=0?{lat:s.lat,lng:s.lng,altitude:s.altitude}:position(s);if(!p){missing++;continue}keep.add(id);let o=objects.get(id);
  if(o&&o.userData.role!==role){dispose(o);objects.delete(id);o=null}
  if(!o){o=satelliteMesh(s,role);o.position.copy(vector(p));group.add(o);objects.set(id,o)}
  o.userData.sat=s;o.userData.target=vector(p);
 }
 for(const [id,o] of objects)if(!keep.has(id)){dispose(o);objects.delete(id)}
 document.querySelector('#geometryNote').textContent=`${objects.size} satellites plotted above Abu Dhabi’s horizon. Click a marker to inspect.${missing?' Some positions are incomplete.':''}${data.warning?' '+data.warning:''}`;
}
const constellation=bare?null:mountConstellation(globe,showSelected);
const rays=new THREE.Raycaster();const mouse=new THREE.Vector2();let down;
const canvas=globe.renderer().domElement;canvas.addEventListener('pointerdown',e=>down=[e.clientX,e.clientY]);canvas.addEventListener('pointerup',e=>{
 if(!down||Math.hypot(e.clientX-down[0],e.clientY-down[1])>5)return;
 const rect=canvas.getBoundingClientRect();mouse.set((e.clientX-rect.left)/rect.width*2-1,1-(e.clientY-rect.top)/rect.height*2);rays.setFromCamera(mouse,globe.camera());
 const hit=rays.intersectObjects([...objects.values()],true)[0];if(!hit){constellation?.pick(rays);return;}
 // Reject objects hidden behind the solid Earth.
 const earthHit=rays.ray.intersectSphere(new THREE.Sphere(new THREE.Vector3(),100),new THREE.Vector3());if(earthHit&&rays.ray.origin.distanceTo(earthHit)<hit.distance)return;
 const obj=hit.object.parent;selectedId=String(obj.userData.sat.id??obj.userData.sat.name);showSelected(obj.userData.sat);
});
function showSelected(s){document.querySelector('.selected').hidden=false;setText('selectedName',displayName(s.name));stats('selectedStats',s)}
document.querySelector('#close').onclick=()=>{selectedId=null;document.querySelector('.selected').hidden=true};
function setText(id,v){const el=document.getElementById(id),next=v??'—';if(el.textContent!==String(next)){el.textContent=next;el.animate([{opacity:.3,transform:'translateY(3px)'},{opacity:1,transform:'translateY(0)'}],{duration:450})}}
function number(v,unit){return Number.isFinite(v)?`${v.toLocaleString(undefined,{maximumFractionDigits:1})}${unit}`:'—'}
function stats(id,s){const el=document.getElementById(id);el.replaceChildren();for(const [label,key,unit] of [['Elevation','elevation','°'],['Azimuth','azimuth','°'],['Slant range','range',' km']]){const d=document.createElement('div'),a=document.createElement('span'),b=document.createElement('strong');a.textContent=label;b.textContent=number(s?.[key],unit);d.append(a,b);el.append(d)}}
const labels={'nominal':'NOMINAL','handoff-imminent':'HANDOFF IMMINENT','handoff-in-progress':'HANDOFF IN PROGRESS','handoff-complete':'HANDOFF COMPLETE'};
async function poll(){
 try{
  const response=await fetch('/api/satellite/status',{cache:'no-store',signal:AbortSignal.timeout(60000)});
   if(!response.ok){
    // Surface the server's own reason rather than a generic outage. A missing
    // N2YO_API_KEY has to be visible here, not swallowed into "unavailable".
    const reason=await response.json().then(b=>b?.error).catch(()=>null);
    throw new Error(reason||'Tracking backend unavailable');
   }
  const d=validate(await response.json());lastData=d;lastSuccess=Date.now();
  const parsed=Date.parse(d.predictedLossAt);deadline=Number.isFinite(parsed)?parsed:Number.isFinite(d.secondsToHorizonLoss)?Date.now()+Math.max(0,d.secondsToHorizonLoss)*1000:null;
  const targetKey=d.serving?.id??d.serving?.name??null;
  if(targetKey!==countdownTarget||deadline===null){initialSeconds=Math.max(1,deadline===null?1:(deadline-Date.now())/1000);countdownTarget=targetKey}
  setText('status',d.mode==='prediction'?(d.status==='handoff-imminent'?'THRESHOLD APPROACHING':'TRACKING ORBIT'):labels[d.status]);
  setText('activeTitle',d.mode==='prediction'?'01 / TRACKING TARGET':'01 / ACTIVE UPLINK');
  setText('servingLabel',d.mode==='prediction'?'Tracking target · not a confirmed uplink':'Current serving satellite');
  setText('predictionMode',d.mode==='prediction'?'ORBITAL PREDICTION · NO LINK CONTROL':'');document.getElementById('status').dataset.state=d.status;
  setText('servingName',displayName(d.serving?.name)??'No serving satellite');setText('candidateName',displayName(d.candidate?.name)??'No candidate');stats('servingStats',d.serving);stats('candidateStats',d.candidate);
  setText('explanation',d.explanation??'The backend has not provided an explanation.');setText('deadline',deadline?`Predicted ${d.thresholdDegrees??'horizon'}° loss · ${new Date(deadline).toLocaleTimeString()}`:'Awaiting prediction');
  setText('connection',d.mode==='prediction'?(d.catalogStale?'CACHED ORBITS':'N2YO · LIVE ORBITS'):'LIVE TELEMETRY');document.getElementById('connection').classList.remove('offline');updateScene(d);
  if(selectedId){const s=[...d.visibleSatellites,d.serving,d.candidate].find(s=>s&&String(s.id??s.name)===selectedId);if(s)showSelected(s);else{selectedId=null;document.querySelector('.selected').hidden=true}}
 }catch(e){
   const missingKey=/N2YO_API_KEY/.test(e?.message||'');
   setText('connection',missingKey?'N2YO KEY MISSING':lastData?'STALE TELEMETRY':'BACKEND OFFLINE');
   document.getElementById('connection').classList.add('offline');
   if(missingKey)setText('explanation','N2YO_API_KEY was not found in the server environment, so no orbital elements could be fetched. Set it in ECHO_Project/.env and restart this demo. The constellation globe still renders from the cached CelesTrak catalog.');
   else if(!lastData)setText('explanation','Connect the ECHO tracking backend to receive live satellite and handover predictions.');
  }
 finally{setTimeout(poll,2500)}
}
if(!bare){poll();mountML();mountWeather()}else setText('connection','GLOBE REVIEW');
// Dynamic link geometry connects the actual elevated satellite position, not its ground projection.
const links=new Map();let prev=performance.now(),frames=0,frameTotal=0,quality=0;
function animate(now){requestAnimationFrame(animate);const dt=Math.min((now-prev)/1000,.1);prev=now;if(clouds&&!reducedMotion)clouds.rotation.y+=dt*.003;
 for(const [id,o] of objects){o.position.lerp(o.userData.target,1-Math.exp(-dt*4));o.userData.halo.scale.setScalar(o.userData.glowSize*(1+.12*Math.sin(now*.003)));
  if(o.userData.role==='visible')continue;
  let link=links.get(id);if(!link){const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(new Float32Array(33*3),3));link=new THREE.Line(geo,new THREE.LineDashedMaterial({color:o.userData.role==='serving'?cyan:amber,transparent:true,opacity:.7,dashSize:1.4,gapSize:o.userData.role==='serving'?.45:1.4}));group.add(link);links.set(id,link)}
  const mid=station.clone().lerp(o.position,.5);mid.normalize().multiplyScalar((station.length()+o.position.length())/2+.8);
  const curve=new THREE.QuadraticBezierCurve3(station,mid,o.position),pts=curve.getPoints(32);const arr=link.geometry.attributes.position;pts.forEach((p,i)=>arr.setXYZ(i,p.x,p.y,p.z));arr.needsUpdate=true;link.computeLineDistances();link.material.opacity=.5+.2*Math.sin(now*.002);
 }
 for(const [id,link] of links)if(!objects.has(id)||objects.get(id).userData.role==='visible'){dispose(link);links.delete(id)}
 const stale=lastSuccess&&Date.now()-lastSuccess>10000;
 if(stale){setText('connection','STALE TELEMETRY');document.getElementById('connection').classList.add('offline')}
 const seconds=deadline===null||stale?null:Math.max(0,(deadline-Date.now())/1000);
 const text=seconds===null?'—':`${Math.floor(seconds/60).toString().padStart(2,'0')}:${Math.floor(seconds%60).toString().padStart(2,'0')}`;
 document.getElementById('remaining').textContent=text;document.getElementById('ring').style.strokeDashoffset=327*(1-(seconds===null?0:Math.min(1,seconds/initialSeconds)));
 frameTotal+=dt;frames++;if(frames===180){const fps=frames/frameTotal;window.echoPerformance={fps:Math.round(fps),quality};if(fps<48&&quality<2){quality++;if(quality===1&&clouds)clouds.visible=false;else globe.renderer().setPixelRatio(1)}frames=0;frameTotal=0;}
}requestAnimationFrame(animate);
