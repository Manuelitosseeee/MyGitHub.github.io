import NewScene from './NewScene';
import {ITEM_ART,itemId,sourceFrame,SOURCE_RECT,SOURCE_POLY} from './itemArt';
import dimensions from './itemDimensions.json';
import {MAPS} from './maps';
export function Sprite({id}:{id:string}){
 if(id==='fire')return <svg viewBox="0 0 96 110" aria-hidden="true" role="img"><path fill="#704531" d="M12 86h64v8H12zm12 10h64v8H24z"/><path fill="#a6693b" d="M16 86h56v4H16zm12 10h56v4H28z"/><path fill="#ed7824" d="M20 82V62h8V46h8V28h8V8h8v30h8v14h8V40h8v24h4v18z"/><path fill="#ffbd37" d="M28 82V64h8V50h8V34h8v20h8v12h8v16z"/><path fill="#ffe18a" d="M36 82V70h8V58h8v12h8v12z"/></svg>;
 if(id==='lamp')return <svg viewBox="0 0 96 110" aria-hidden="true" role="img"><path fill="#5a3828" d="M32 10h32v8H32zm-8 8h48v8H24zm-8 8h64v10H16zm8 10h48v56H24zm-8 56h64v10H16z"/><path fill="#c79247" d="M28 38h40v48H28z"/><path fill="#ffe5a0" d="M34 42h28v38H34z"/><path fill="#91603a" d="M44 36h8v52h-8zM20 92h56v4H20z"/><path fill="#e4b568" d="M32 26h32v4H32z"/></svg>;
 const map=MAPS.find(m=>Object.keys(ITEM_ART[m.id]).some(key=>itemId(m.id,key)===id))?.id;
 if(!map)return null;
 const key=map==='home'?id:id.split(':')[1],p=ITEM_ART[map][key]?.[0];
 if(p&&(SOURCE_RECT[p.asset]||SOURCE_POLY[p.asset])){const [x,y,w,h]=sourceFrame(p.asset),poly=SOURCE_POLY[p.asset],clip=`sprite-${p.asset}`;return <svg viewBox={`${x} ${y} ${w} ${h}`} aria-hidden="true" style={{width:'100%',height:110,imageRendering:'pixelated'}}>{poly&&<defs><clipPath id={clip}><polygon points={poly.map(q=>q.join(',')).join(' ')}/></clipPath></defs>}<image width={dimensions[p.asset as keyof typeof dimensions].width} height={dimensions[p.asset as keyof typeof dimensions].height} href={`/pixel/items/${p.asset}.png`} clipPath={poly?`url(#${clip})`:undefined}/></svg>;}
 return p?<img src={`/pixel/items/${p.asset}.png`} alt="" aria-hidden="true" style={{width:'100%',height:110,objectFit:'contain',imageRendering:'pixelated'}}/>:null;
}
export default function Scene(props:Omit<Parameters<typeof NewScene>[0],'mapId'>){return <NewScene {...props} mapId={props.state.mapId}/>;}
