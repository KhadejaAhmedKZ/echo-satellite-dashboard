export function mountML(){
 const panel=document.createElement('section');panel.className='panel ml-panel';
 panel.innerHTML=`<div class="ml-top"><p class="eyebrow">03 / ML HANDOVER PREDICTOR</p><span class="ml-tag">unifyair/mobility_data</span></div><div class="ml-value"><strong id="ml-probability">—</strong><span>predicted handover<br>probability</span></div><div class="ml-meter"><i id="ml-bar"></i></div><p id="ml-decision">Loading trained model…</p><div class="ml-evidence"><span id="ml-signal">Signal —</span><span id="ml-sinr">SINR —</span></div><p id="ml-metrics" class="muted"></p><div class="ml-bottom"><span id="ml-sample">Held-out dataset example</span><button id="ml-next">Next sample →</button></div><p class="ml-disclosure">Held-out cellular-mobility examples · not live satellite telemetry</p>`;
 document.querySelector('#telemetry-rail').append(panel);let sample=0;
 async function load(){
  const button=panel.querySelector('#ml-next');button.disabled=true;
  try{
   const r=await fetch(`/api/ml/status?sample=${sample}`,{signal:AbortSignal.timeout(15000)});if(!r.ok)throw new Error();const d=await r.json();
   panel.querySelector('#ml-probability').textContent=(d.probability*100).toFixed(1)+'%';panel.querySelector('#ml-bar').style.width=d.probability*100+'%';
   panel.dataset.risk=d.handoverNeeded?'high':'low';
   panel.querySelector('#ml-decision').textContent=d.handoverNeeded?'Model recommends a handover':'Model recommends staying connected';
   panel.querySelector('#ml-signal').textContent=`Signal ${d.inputs.signal_strength.toFixed(1)} dBm`;panel.querySelector('#ml-sinr').textContent=`SINR ${d.inputs.sinr.toFixed(1)} dB`;
   panel.querySelector('#ml-metrics').textContent=`Held-out F1 ${d.metrics.f1.toFixed(3)} · ROC-AUC ${d.metrics.rocAuc.toFixed(3)}`;
   panel.querySelector('#ml-sample').textContent=`Sample ${d.sample}/${d.sampleCount} · actual: ${d.actualHandoverNeeded?'handover':'stay'}`;
  }catch{panel.querySelector('#ml-decision').textContent='ML service is starting or unavailable';}
  finally{button.disabled=false}
 }
 panel.querySelector('#ml-next').onclick=()=>{sample++;load()};load();
}
