import NewScene from './NewScene';
import {ITEM_ART,itemId} from './itemArt';
import {MAPS} from './maps';
export function Sprite({id}:{id:string}){const map=MAPS.find(m=>Object.keys(ITEM_ART[m.id]).some(key=>itemId(m.id,key)===id))?.id;if(!map)return <span aria-hidden="true">✦</span>;const key=map==='home'?id:id.split(':')[1];const p=ITEM_ART[map][key]?.[0];return p?<img src={`/pixel/items/${p.asset}.png`} alt="" aria-hidden="true" style={{width:'100%',height:'100%',objectFit:'contain',imageRendering:'pixelated'}}/>:null;}
export default function Scene(props:Omit<Parameters<typeof NewScene>[0],'mapId'>){return <NewScene {...props} mapId={props.state.mapId}/>;}
