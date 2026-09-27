// Keep the optional Python inference worker alongside the HTTP gateway.
import {spawn} from 'node:child_process';
import {existsSync} from 'node:fs';
import path from 'node:path';
const python=process.env.ECHO_PYTHON||path.resolve('.venv/bin/python');
let child;
if(existsSync(python)&&existsSync('ml/model.joblib')){
 child=spawn(python,['ml/service.py'],{stdio:'inherit'});
 child.on('error',()=>console.error('ML service could not start'));
}
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{child?.kill(signal);process.exit(0)});
await import('./index.mjs');
