import express from 'express';
import {constellation} from './constellation.mjs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {makeTracker} from './tracking.mjs';
const tracker=makeTracker(process.env.N2YO_API_KEY);
const app=express();
const mlBase=`http://127.0.0.1:${Number(process.env.ML_PORT)||3102}`;
// ECHO_BACKEND_URL historically switched every proxied route at once. The real
// ECHO orchestrator serves agent telemetry but does not track satellites, so
// the two are now addressed separately. ECHO_AGENTS_URL points the nine-agent
// sidebar at the live ECHO runtime while orbital prediction stays local.
// Either variable alone keeps the previous behaviour for its own route.
const agentsBase=process.env.ECHO_AGENTS_URL||process.env.ECHO_BACKEND_URL;
const trackingBase=process.env.ECHO_TRACKING_URL||process.env.ECHO_BACKEND_URL;
app.get('/api/satellite/constellation',async(req,res)=>{res.set('Cache-Control','no-store');try{res.json(await constellation())}catch(error){res.status(503).json({error:error.message})}});
app.get('/api/satellite/status',async(req,res)=>{
 res.set('Cache-Control','no-store');
 if(!trackingBase){
  try{return res.json(await tracker.status())}catch(error){return res.status(503).json({error:error.message})}
 }
 // ECHO 03 owns the nine agents, not satellite tracking. If it serves a
 // satellite route, prefer it; otherwise fall back to our own tracker so the
 // dashboard behaves identically embedded in the hub and standalone.
 try{
  const upstream=await fetch(new URL('/api/satellite/status',trackingBase),{signal:AbortSignal.timeout(7000)});
  if(upstream.ok)return res.json(await upstream.json());
 }catch{/* upstream down: fall through to the local tracker */}
 try{res.json(await tracker.status())}
 catch(error){res.status(503).json({error:error.message})}
});
app.get('/api/agents/status',async(req,res)=>{
 res.set('Cache-Control','no-store');
 if(!agentsBase)return res.status(503).json({error:'Agent runtime not connected'});
 try{const r=await fetch(new URL('/api/agents/status',agentsBase),{signal:AbortSignal.timeout(2500)});if(!r.ok)throw new Error();res.json(await r.json())}
 catch{res.status(502).json({error:'Agent runtime unavailable'})}
});
app.use(express.json({limit:'16kb'}));
app.get('/api/ml/status',async(req,res)=>{
 try{
  const index=Math.max(0,Number.parseInt(req.query.sample??'0',10)||0);
  const r=await fetch(`${mlBase}/replay/${index}`,{signal:AbortSignal.timeout(5000)});
  res.status(r.status).json(await r.json());
 }catch{res.status(503).json({error:'ML model is training or unavailable'})}
});
app.post('/api/ml/predict',async(req,res)=>{
 try{const r=await fetch(`${mlBase}/predict`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(req.body),signal:AbortSignal.timeout(5000)});res.status(r.status).json(await r.json())}
 catch{res.status(503).json({error:'ML inference unavailable'})}
});
app.use(express.static(path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../dist')));
const port=Number(process.env.PORT)||3103;
app.listen(port,'127.0.0.1',error=>{if(error){console.error('ECHO gateway could not bind to its port');process.exit(1)}console.log(`ECHO gateway ready on ${port}`)});
