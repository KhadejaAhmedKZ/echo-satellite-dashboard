"""Reproducible repair of the supplied notebook's v2 Random Forest pipeline."""
import argparse,json,joblib
from pathlib import Path
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import GroupShuffleSplit
from sklearn.metrics import accuracy_score,f1_score,roc_auc_score,recall_score
from features import fit_metadata,transform,NUMERIC,CATEGORIES,FEATURES
args=argparse.ArgumentParser();args.add_argument('dataset');a=args.parse_args()
base=Path(__file__).parent
print('Loading provided dataset',flush=True)
df=pd.read_parquet(a.dataset).drop_duplicates();df=df[df.hour.between(0,23)].copy()
# User-level holdout prevents one user's correlated rows appearing in both sets.
split=GroupShuffleSplit(n_splits=1,test_size=.2,random_state=42)
trainidx,testidx=next(split.split(df,groups=df.user_id));train,test=df.iloc[trainidx],df.iloc[testidx]
meta=fit_metadata(train);X=transform(train,meta);Xt=transform(test,meta)
y=train.handover_needed.astype(int);yt=test.handover_needed.astype(int)
model=RandomForestClassifier(n_estimators=300,max_depth=18,min_samples_leaf=2,class_weight='balanced_subsample',random_state=42,n_jobs=4)
print(f'Training v2 forest: {len(train)} rows, {len(test)} held-out rows',flush=True);model.fit(X,y)
p=model.predict_proba(Xt)[:,1];pred=p>=.5
report={'model':'Random Forest v2','source':'Provided ECHO notebook / unifyair mobility dataset','split':'20% user-group holdout; preprocessing fitted on training rows only','trainingRows':len(train),'testRows':len(test),'accuracy':accuracy_score(yt,pred),'f1':f1_score(yt,pred),'recall':recall_score(yt,pred),'rocAuc':roc_auc_score(yt,p),'features':FEATURES,'importance':dict(sorted(zip(FEATURES,model.feature_importances_.tolist()),key=lambda x:-x[1]))}
joblib.dump({'model':model,'metadata':meta},base/'model.joblib',compress=3)
(base/'metrics.json').write_text(json.dumps(report,indent=2))
# A balanced, deterministic selection of actual held-out rows, not fabricated inputs.
examples=pd.concat([test[test.handover_needed==False].sample(n=min(30,(test.handover_needed==False).sum()),random_state=42),test[test.handover_needed==True].sample(n=min(30,(test.handover_needed==True).sum()),random_state=42)]).sample(frac=1,random_state=7)
rows=[]
for _,r in examples.iterrows():
    inputs={c:float(r[c]) for c in NUMERIC};inputs.update({c:str(r[c]) for c in CATEGORIES})
    rows.append({'inputs':inputs,'actualHandoverNeeded':bool(r.handover_needed)})
(base/'replay.json').write_text(json.dumps(rows,indent=2))
print(json.dumps({k:v for k,v in report.items() if k not in ['importance','features']}),flush=True)
