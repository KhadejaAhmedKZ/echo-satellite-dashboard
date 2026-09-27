export const STATION={lat:24.4539,lng:54.3773};
const R=6371,rad=Math.PI/180;
// Spherical Earth ENU -> Earth-centered coordinates; range is slant range in km.
export function position(s){
 if(!Number.isFinite(s.elevation)||s.elevation<0||s.elevation>90)return null;
 if(!Number.isFinite(s.azimuth)||!Number.isFinite(s.range)||s.range<=0)return null;
 const lat=STATION.lat*rad,lon=STATION.lng*rad,e=s.elevation*rad,a=s.azimuth*rad;
 const east=s.range*Math.cos(e)*Math.sin(a),north=s.range*Math.cos(e)*Math.cos(a),up=s.range*Math.sin(e);
 const x=(R+up)*Math.cos(lat)*Math.cos(lon)-east*Math.sin(lon)-north*Math.sin(lat)*Math.cos(lon);
 const y=(R+up)*Math.cos(lat)*Math.sin(lon)+east*Math.cos(lon)-north*Math.sin(lat)*Math.sin(lon);
 const z=(R+up)*Math.sin(lat)+north*Math.cos(lat);
 const r=Math.hypot(x,y,z);
 return {lat:Math.asin(z/r)/rad,lng:Math.atan2(y,x)/rad,altitude:(r-R)/R};
}
export function validate(raw){
 const states=['nominal','handoff-imminent','handoff-in-progress','handoff-complete'];
 if(!raw||!states.includes(raw.status))throw new Error('Unrecognized API status');
 return {...raw,visibleSatellites:Array.isArray(raw.visibleSatellites)?raw.visibleSatellites:[]};
}
