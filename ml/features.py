import numpy as np
import pandas as pd
NUMERIC=['x','y','velocity','heading','signal_strength','sinr','network_load','hour']
CATEGORIES=['pattern_type','connected_cell','device_type']
FEATURES=NUMERIC+['hour_sin','hour_cos','vx','vy','dist_to_cell_center','signal_sinr_ratio','load_x_velocity','pattern_type_enc','connected_cell_enc','device_type_enc']

def fit_metadata(train):
    return {'clips':{c:[float(train[c].quantile(.01)),float(train[c].quantile(.99))] for c in ['velocity','signal_strength','sinr','network_load']},
            'categories':{c:sorted(train[c].astype(str).unique().tolist()) for c in CATEGORIES},
            'centers':{str(k):[float(v['x']),float(v['y'])] for k,v in train.groupby('connected_cell')[['x','y']].mean().to_dict('index').items()}}

def transform(data,meta):
    df=pd.DataFrame(data).copy()
    for c in NUMERIC:
        df[c]=pd.to_numeric(df[c],errors='raise')
        if not np.isfinite(df[c]).all(): raise ValueError('Non-finite '+c)
    for c in CATEGORIES:
        mapping={v:i for i,v in enumerate(meta['categories'][c])}
        df[c+'_enc']=df[c].astype(str).map(mapping)
        if df[c+'_enc'].isna().any(): raise ValueError('Unknown category: '+c)
    if not df['hour'].between(0,23).all():raise ValueError('hour must be between 0 and 23')
    for c,bounds in meta['clips'].items():df[c]=df[c].clip(*bounds)
    df['hour_sin']=np.sin(2*np.pi*df.hour/24);df['hour_cos']=np.cos(2*np.pi*df.hour/24)
    # Preserve the notebook assumption that heading is in radians.
    df['vx']=df.velocity*np.cos(df.heading);df['vy']=df.velocity*np.sin(df.heading)
    centers=np.array([meta['centers'][str(c)] for c in df.connected_cell])
    df['dist_to_cell_center']=np.hypot(df.x-centers[:,0],df.y-centers[:,1])
    df['signal_sinr_ratio']=np.divide(df.signal_strength,df.sinr,out=np.zeros(len(df)),where=np.abs(df.sinr)>1e-6)
    df['load_x_velocity']=df.network_load*df.velocity
    return df[FEATURES]
