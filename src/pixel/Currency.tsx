const numbers = new Intl.NumberFormat('it-IT', {minimumFractionDigits:2,maximumFractionDigits:2,useGrouping:false});
const pickNumber=(cents:number)=>numbers.format(cents/100).replace(/\B(?=(\d{3})+(?!\d))/g,'.');
export function PickIcon(){return <svg className="px-pick-icon" viewBox="470 210 580 640" aria-hidden="true"><image href="/pixel/plectri.png" width="1536" height="1024"/></svg>;}
export function Picks({cents}:{cents:number}){return <span className="px-picks" aria-label={`${pickNumber(cents)} plettri`}><span>{pickNumber(cents)}</span><PickIcon/></span>;}
export function PickWallet(){return <img className="px-pick-wallet" src="/pixel/plectri.png" alt="Plettri dorati"/>;}
const thumbs=[[60,518,130,133],[465,518,130,133],[60,703,130,133],[465,703,130,133],[60,889,130,133]];
export function MapThumbnail({index}:{index:number}){const q=thumbs[index];return <svg className="px-map-thumb" viewBox={q.join(' ')} aria-hidden="true"><image href="/pixel/map-thumbnails.png" width="878" height="1791"/></svg>;}
