import pandas as pd, numpy as np, lightgbm as lgb
from sklearn.metrics import mean_absolute_error, mean_squared_error
from pathlib import Path
D=Path(__file__).parent
df=pd.read_csv(D/"demand_history.csv",parse_dates=["date"]).sort_values(["hospital_id","medicine_id","date"])
g=df.groupby(["hospital_id","medicine_id"],group_keys=False)
for lag in [1,2,3,7,14,28]: df[f"lag_{lag}"]=g.quantity_consumed.shift(lag)
for w in [7,14,28]:
    df[f"rolling_mean_{w}"]=g.quantity_consumed.transform(lambda s:s.shift(1).rolling(w).mean())
    df[f"rolling_std_{w}"]=g.quantity_consumed.transform(lambda s:s.shift(1).rolling(w).std())
df["day_of_week"]=df.date.dt.dayofweek; df["month"]=df.date.dt.month; df["weekend"]=(df.day_of_week>=5).astype(int)
df["target"]=g.quantity_consumed.shift(-1)
for c in ["hospital_id","medicine_id"]: df[c]=df[c].astype("category")
features=[c for c in df if c.startswith("lag_") or c.startswith("rolling_")]+["day_of_week","month","weekend","patient_load","emergency_cases","outbreak_signal","hospital_id","medicine_id"]
df=df.dropna(subset=features+["target"]); ds=df.date.sort_values().unique(); c1=ds[int(.70*len(ds))]; c2=ds[int(.85*len(ds))]
tr=df[df.date<c1]; va=df[(df.date>=c1)&(df.date<c2)]; te=df[df.date>=c2]
model=lgb.LGBMRegressor(objective="regression",n_estimators=1000,learning_rate=.03,num_leaves=31,subsample=.8,colsample_bytree=.8,reg_alpha=.1,reg_lambda=.1,random_state=42)
model.fit(tr[features],tr.target,eval_set=[(va[features],va.target)],callbacks=[lgb.early_stopping(80,verbose=False)])
p=model.predict(te[features]); base=te.rolling_mean_7
for name,y in [("LightGBM",p),("7-day baseline",base)]:
    print(name,"MAE",mean_absolute_error(te.target,y),"RMSE",mean_squared_error(te.target,y)**.5,"WAPE",np.abs(te.target-y).sum()/np.abs(te.target).sum())
