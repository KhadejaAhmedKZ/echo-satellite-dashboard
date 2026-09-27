import * as THREE from 'three';
export function mountConstellation(globe,onSelect){
 const ui=document.createElement('div');ui.className='constellation-controls';ui.innerHTML='<div class="view-switch"><button class="active" data-view="global">Global constellation</button><button data-view="local">Abu Dhabi links</button></div><p id="constellation-state">Loading global orbital catalog…</p>';
 document.querySelector('main').append(ui);
 const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{size:{value:3.4}},vertexShader:'uniform float size;void main(){gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_PointSize=size;}',fragmentShader:'void main(){float r=length(gl_PointCoord-.5)*2.;if(r>1.)discard;gl_FragColor=vec4(.38,.72,.9,(1.-smoothstep(.35,1.,r))*.7);}'});
 const points=new THREE.Points(new THREE.BufferGeometry(),material);globe.scene().add(points);
 let data=[],global=true,lastSuccess=0,stopped=false,target=null,lastFrame=performance.now();
 points.onBeforeRender=()=>{const now=performance.now(),alpha=1-Math.exp(-Math.min((now-lastFrame)/1000,.1)*3);lastFrame=now;const attr=points.geometry.attributes.position;if(target&&attr){for(let i=0;i<target.length;i++)attr.array[i]+=(target[i]-attr.array[i])*alpha;attr.needsUpdate=true}};
 const state=ui.querySelector('p');
 for(const button of ui.querySelectorAll('button'))button.onclick=()=>{global=button.dataset.view==='global';points.visible=global;ui.querySelectorAll('button').forEach(b=>b.classList.toggle('active',b===button));state.textContent=global?(data.length?`${data.length.toLocaleString()} Emirati satellites (Al Yah / Thuraya) · orbital positions`:'Global catalog unavailable'):'Local links and satellites visible from Abu Dhabi';};
 async function poll(){
  if(stopped)return;
  try{const r=await fetch('/api/satellite/constellation',{signal:AbortSignal.timeout(30000)});if(!r.ok)throw new Error();const d=await r.json();if(!Array.isArray(d.satellites))throw new Error();data=d.satellites;const coords=new Float32Array(data.length*3);data.forEach((s,i)=>{const p=globe.getCoords(s.lat,s.lng,s.altitude);coords.set([p.x,p.y,p.z],i*3)});target=coords;if(points.geometry.attributes.position?.count===data.length){lastSuccess=Date.now();if(global)state.textContent=`${data.length.toLocaleString()} Emirati satellites (Al Yah / Thuraya) · ${d.partial?'partial CelesTrak catalog':'CelesTrak / SGP4'}`;return;}points.geometry.dispose();points.geometry=new THREE.BufferGeometry();points.geometry.setAttribute('position',new THREE.BufferAttribute(coords,3));points.geometry.computeBoundingSphere();lastSuccess=Date.now();points.visible=global;if(global)state.textContent=`${data.length.toLocaleString()} Emirati satellites (Al Yah / Thuraya) · ${d.partial?'partial CelesTrak catalog':d.catalogStale?'cached catalog':'CelesTrak / SGP4'}`}
  catch{if(global)state.textContent='Global catalog unavailable · local tracking continues';if(Date.now()-lastSuccess>45000){points.visible=false;data=[]}}
  finally{setTimeout(poll,15000)}
 }
 poll();addEventListener('pagehide',()=>{stopped=true},{once:true});
 return {pick(raycaster){if(!global||!points.visible)return false;raycaster.params.Points.threshold=.6;const hits=raycaster.intersectObject(points);if(!hits.length)return false;const hit=hits[0],earth=raycaster.ray.intersectSphere(new THREE.Sphere(new THREE.Vector3(),100),new THREE.Vector3());if(earth&&raycaster.ray.origin.distanceTo(earth)<hit.distance)return false;const s=data[hit.index];if(s){onSelect(s);return true}return false}};
}
