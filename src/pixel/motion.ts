// Live sprite animation, sampled from the approved character, with no replacement illustration.
export function prepareHands(im:HTMLImageElement){
 const clean=document.createElement('canvas');clean.width=1004;clean.height=1567;const c=clean.getContext('2d')!;c.drawImage(im,0,0,1004,1567);
 const hands=[{x:392,y:891,w:75,h:65,fill:'#e6a249'},{x:579,y:813,w:47,h:66,fill:'#352632'}].map(q=>{
  const sprite=document.createElement('canvas');sprite.width=q.w;sprite.height=q.h;const sc=sprite.getContext('2d')!;const data=c.getImageData(q.x,q.y,q.w,q.h),skin=sc.createImageData(q.w,q.h);
  for(let k=0;k<data.data.length;k+=4){const [r,g,b]=data.data.slice(k,k+3);if(r>130&&g>65&&b>80&&r>g*1.12&&r-g<110&&g>b){skin.data.set(data.data.slice(k,k+4),k);const j=k/4;c.fillStyle=q.fill;c.fillRect(q.x+j%q.w,q.y+Math.floor(j/q.w),1,1);}}
  sc.putImageData(skin,0,0);return {...q,sprite};
 });return {clean,hands};
}
export function handPose(t:number,active:boolean,reduced:boolean){if(!active||reduced)return {pick:0,fret:0,lean:0};const cycle=t%14;return {pick:cycle<7?Math.sin(t*5)*2:0,fret:cycle>8&&cycle<11?Math.sin((cycle-8)*Math.PI/3)*3:0,lean:Math.sin(t*.7)*.8};}
export function drawHands(c:CanvasRenderingContext2D,m:ReturnType<typeof prepareHands>,t:number,active:boolean,reduced:boolean){const p=handPose(t,active,reduced);m.hands.forEach((h,i)=>c.drawImage(h.sprite,h.x+(i?p.fret*.45:0),h.y+(i?-p.fret:p.pick)));}
