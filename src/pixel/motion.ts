// Live sprite animation, sampled from the approved character, with no replacement illustration.
export function prepareHands(im:CanvasImageSource){
 const clean=document.createElement('canvas');clean.width=1004;clean.height=1567;const c=clean.getContext('2d')!;c.drawImage(im,0,0,1004,1567);
 const hands=[{x:392,y:891,w:75,h:65,fill:'#e6a249'},{x:579,y:813,w:47,h:66,fill:'#352632'}].map(q=>{
  const sprite=document.createElement('canvas');sprite.width=q.w;sprite.height=q.h;const sc=sprite.getContext('2d')!;const data=c.getImageData(q.x,q.y,q.w,q.h),skin=sc.createImageData(q.w,q.h);
  for(let k=0;k<data.data.length;k+=4){const [r,g,b]=data.data.slice(k,k+3);if(r>130&&g>65&&b>80&&r>g*1.12&&r-g<110&&g>b){skin.data.set(data.data.slice(k,k+4),k);const j=k/4;c.fillStyle=q.fill;c.fillRect(q.x+j%q.w,q.y+Math.floor(j/q.w),1,1);}}
  sc.putImageData(skin,0,0);return {...q,sprite};
 });return {clean,hands};
}
export function handPose(t:number,active:boolean,reduced:boolean){if(!active||reduced)return {pick:0,fret:0,lean:0};return {pick:Math.sin(t*7)*4,fret:Math.sin(t*.7)*8,lean:Math.sin(t*.7)*.8};}
export function drawHands(c:CanvasRenderingContext2D,m:ReturnType<typeof prepareHands>,t:number,active:boolean,reduced:boolean){const p=handPose(t,active,reduced);m.hands.forEach((h,i)=>c.drawImage(h.sprite,h.x+(i?p.fret*.45:0),h.y+(i?-p.fret:p.pick)));}

// Canvas-native facial poses preserve the original approved character and seat.
export function drawSleepFace(c:CanvasRenderingContext2D,t:number,reduced:boolean){
 c.save();
 // Coordinates follow the character's original fit() transform in itemArt.ts.
 c.translate(332,699);c.scale(510/1358,510/1358);
 c.fillStyle='#ffbe8b';c.fillRect(574,326,34,51);c.fillRect(639,320,32,57);
 c.fillStyle='#3b2831';c.fillRect(578,353,26,7);c.fillRect(642,351,24,7);
 c.strokeStyle='#633c35';c.lineWidth=6;c.beginPath();c.ellipse(626,400,9,12,0,0,Math.PI*2);c.stroke();
 const phase=reduced?.5:(t%3)/3;c.globalAlpha=1-phase*.8;c.strokeStyle='#e7e4ee';c.lineWidth=4;
 c.beginPath();c.ellipse(679+phase*24,383-phase*44,7+phase*16,8+phase*18,-.3,0,Math.PI*2);c.stroke();c.restore();
}
