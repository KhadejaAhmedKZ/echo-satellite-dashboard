import json,joblib,os
from pathlib import Path
from http.server import BaseHTTPRequestHandler,HTTPServer
from features import transform,NUMERIC,CATEGORIES
base=Path(__file__).parent
bundle=joblib.load(base/'model.joblib');model=bundle['model'];meta=bundle['metadata']
metrics=json.loads((base/'metrics.json').read_text());examples=json.loads((base/'replay.json').read_text())
def predict(inputs):
    missing=[k for k in NUMERIC+CATEGORIES if k not in inputs]
    if missing:raise ValueError('Missing telemetry: '+', '.join(missing))
    p=float(model.predict_proba(transform([inputs],meta))[0,list(model.classes_).index(1)])
    return {'probability':p,'handoverNeeded':p>=.5,'threshold':.5,'inputs':inputs,'model':'Random Forest v2'}
class Handler(BaseHTTPRequestHandler):
    def log_message(self,*args):pass
    def send(self,code,data):
        raw=json.dumps(data).encode();self.send_response(code);self.send_header('Content-Type','application/json');self.send_header('Content-Length',str(len(raw)));self.end_headers();self.wfile.write(raw)
    def do_GET(self):
        if self.path=='/health':return self.send(200,{'ready':True,'metrics':metrics})
        if self.path.startswith('/replay/'):
            try:
                index=int(self.path.rsplit('/',1)[1])%len(examples);e=examples[index]
                return self.send(200,{**predict(e['inputs']),'mode':'recorded-data','sample':index+1,'sampleCount':len(examples),'actualHandoverNeeded':e['actualHandoverNeeded'],'metrics':metrics})
            except (ValueError,KeyError):return self.send(400,{'error':'Invalid sample'})
        return self.send(404,{'error':'Not found'})
    def do_POST(self):
        if self.path!='/predict':return self.send(404,{'error':'Not found'})
        try:
            length=int(self.headers.get('Content-Length',0))
            if length<=0 or length>16384:raise ValueError('Invalid request size')
            data=json.loads(self.rfile.read(length));result=predict(data)
            self.send(200,{**result,'mode':'supplied-telemetry'})
        except (ValueError,KeyError,TypeError) as e:self.send(422,{'error':str(e)})
HTTPServer(('127.0.0.1',int(os.getenv('ML_PORT','3102'))),Handler).serve_forever()
