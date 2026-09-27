export const AGENTS=[
 ['watcher','Watcher','What does every network and edge look like right now?'],
 ['predictor','Predictor','Where is each one heading?'],
 ['intent','Intent','What is the user actually doing?'],
 ['decision','Decision','Which network + edge pair costs least?'],
 ['orchestrator','Orchestrator','Act on that now, or hold — and how cheaply?'],
 ['handoff','Handoff','Move the session early, and reversibly.'],
 ['recovery','Recovery','The handoff failed — now what?'],
 ['troubleshooter','Troubleshooter','It feels bad and nothing switched. Why?'],
 ['explainer','Explainer','Say it in one sentence.']
];
const STATES=new Set(['idle','running','complete','error','waiting','disabled']);
export function normalizeAgents(payload){
 const entries=Array.isArray(payload?.agents)?payload.agents:[];
 return AGENTS.map(([id,name,description])=>{const a=entries.find(a=>a?.id===id);return {id,name,description,state:STATES.has(a?.state)?a.state:'idle',reported:!!a&&STATES.has(a.state),detail:typeof a?.detail==='string'?a.detail:'No runtime events received',durationMs:Number.isFinite(a?.durationMs)&&a.durationMs>=0?a.durationMs:null}});
}
export function mountAgents(){
 const panel=document.createElement('aside');panel.className='panel agent-pipeline';panel.setAttribute('aria-label','Agent pipeline');
 panel.innerHTML=`<div class="pipeline-title"><span class="eyebrow">ECHO / CONTROL PLANE</span><span class="pipeline-mark">◈</span></div><h2>Agent pipeline</h2><div class="pipeline-meta"><span>250 ms <small>target cycle</small></span><span id="pipeline-state">NOT CONNECTED</span></div><ol class="agent-list"></ol><div class="pipeline-foot"><span class="pipeline-dot"></span><p id="pipeline-note">Awaiting agent runtime. Idle states are placeholders until telemetry arrives.</p></div>`;
 document.querySelector('main').append(panel);
 const list=panel.querySelector('ol');let selected=null;
 for(const [id,name,description] of AGENTS){
  const li=document.createElement('li');li.dataset.agent=id;li.dataset.state='idle';
  const btn=document.createElement('button');btn.className='agent-row';btn.setAttribute('aria-expanded','false');
  btn.innerHTML=`<span class="agent-number">${String(AGENTS.findIndex(a=>a[0]===id)+1).padStart(2,'0')}</span><span class="agent-content"><span class="agent-heading"><strong>${name}</strong><span class="agent-status">idle</span></span><span class="agent-description">${description}</span></span>`;
  const detail=document.createElement('div');detail.className='agent-detail';detail.hidden=true;detail.textContent='No runtime events received';
  btn.onclick=()=>{selected=selected===id?null:id;for(const row of list.children){const active=row.dataset.agent===selected;row.querySelector('button').setAttribute('aria-expanded',String(active));row.querySelector('.agent-detail').hidden=!active}};
  li.append(btn,detail);list.append(li);
 }
 let failures=0,stopped=false;
 function render(payload){
  const agents=normalizeAgents(payload),connected=agents.some(a=>a.reported);
  for(const a of agents){const row=list.querySelector(`[data-agent="${a.id}"]`);row.dataset.state=a.state;row.querySelector('.agent-status').textContent=a.state;row.querySelector('.agent-detail').textContent=a.detail+(a.durationMs===null?'':` · ${a.durationMs.toFixed(1)} ms`)}
  panel.dataset.connected=String(connected);panel.querySelector('#pipeline-state').textContent=connected?'RUNTIME CONNECTED':'NOT CONNECTED';
  panel.querySelector('#pipeline-note').textContent=connected?'States reported by the ECHO agent runtime. Select an agent for details.':'Awaiting agent runtime. Idle states are placeholders until telemetry arrives.';
 }
 async function poll(){
  if(stopped)return;
  try{const r=await fetch('/api/agents/status',{cache:'no-store',signal:AbortSignal.timeout(3000)});if(!r.ok)throw new Error();const d=await r.json();if(!Array.isArray(d.agents))throw new Error();render(d);failures=0}
  catch{failures++;render(null)}
  // Never overlap polls; back off while the orchestration runtime is absent.
  setTimeout(poll,failures?Math.min(15000,1000*2**Math.min(failures,4)):250);
 }
 render(null);poll();addEventListener('pagehide',()=>stopped=true,{once:true});
}
