export async function mountWeather(){
 const panel=document.createElement('section');panel.className='panel weather-panel';
 panel.innerHTML=`<p class="eyebrow">SPACE WEATHER / DONKI</p><span class="weather-tag">HISTORICAL EXAMPLE · 2016</span><div class="weather-reading"><strong id="weather-kp">—</strong><span>Kp index<small id="weather-source"></small></span></div><div class="kp-scale" aria-hidden="true">${Array.from({length:9},()=>'<i></i>').join('')}</div><p class="weather-date" id="weather-time"></p><p class="muted" id="weather-detail">Loading supplied record…</p><details><summary>Related events & notifications</summary><div id="weather-events"></div></details><p class="weather-disclaimer">Archived context only. Not current conditions or evidence of a link failure.</p>`;
 const rail=document.querySelector('#telemetry-rail');rail.insertBefore(panel,rail.querySelector('.ml-panel'));
 try{
  const r=await fetch('/data/donki-gst-example.json');if(!r.ok)throw new Error();const d=await r.json();const event=d.events?.[0],observation=event?.allKpIndex?.[0];
  if(d.mode!=='historical-example'||!Number.isFinite(observation?.kpIndex)||observation.kpIndex<0||observation.kpIndex>9)throw new Error();
  panel.querySelector('#weather-kp').textContent=observation.kpIndex.toFixed(1);panel.querySelector('#weather-source').textContent=observation.source;
  panel.querySelectorAll('.kp-scale i').forEach((bar,i)=>bar.classList.toggle('filled',i<observation.kpIndex));
  panel.querySelector('#weather-time').textContent=new Date(observation.observedTime).toLocaleString('en-GB',{timeZone:'UTC',day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})+' UTC';
  panel.querySelector('#weather-detail').textContent='Geomagnetic storm record supplied for the demo. Linked events: coronal mass ejection and high-speed stream.';
  const list=panel.querySelector('#weather-events');
  for(const item of event.linkedEvents){const p=document.createElement('p');p.textContent=item.activityID;list.append(p)}
  function link(label,url){const u=new URL(url);if(u.protocol!=='https:'||u.hostname!=='webtools.ccmc.gsfc.nasa.gov')return;const a=document.createElement('a');a.textContent=label;a.href=u.href;a.target='_blank';a.rel='noopener noreferrer';list.append(a)}
  link('View original DONKI record ↗',event.link);for(const n of event.sentNotifications)link(n.messageID+' ↗',n.messageURL);
 }catch{panel.querySelector('#weather-detail').textContent='The historical record could not be loaded.'}
}
