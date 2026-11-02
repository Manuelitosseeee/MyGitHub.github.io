// Live sprite animation, sampled from the approved character, with no replacement illustration.
export function prepareHands(im:CanvasImageSource){
 const clean=document.createElement('canvas');clean.width=1004;clean.height=1567;const c=clean.getContext('2d')!;c.drawImage(im,0,0,1004,1567);
 const hands=[{x:477,y:914,w:48,h:34,fill:'#e6a249'},{x:643,y:841,w:31,h:50,fill:'#352632'}].map(q=>{
  const sprite=document.createElement('canvas');sprite.width=q.w;sprite.height=q.h;const sc=sprite.getContext('2d')!;const data=c.getImageData(q.x,q.y,q.w,q.h),skin=sc.createImageData(q.w,q.h);
  for(let k=0;k<data.data.length;k+=4){const [r,g,b]=data.data.slice(k,k+3);if(r>130&&g>65&&b>80&&r>g*1.12&&r-g<110&&g>b){skin.data.set(data.data.slice(k,k+4),k);const j=k/4;c.fillStyle=q.fill;c.fillRect(q.x+j%q.w,q.y+Math.floor(j/q.w),1,1);}}
  sc.putImageData(skin,0,0);return {...q,sprite};
 });return {clean,hands};
}
export function handPose(t:number,active:boolean,reduced:boolean){if(!active||reduced)return {pick:0,fret:0,lean:0};return {pick:Math.sin(t*8)*3,fret:Math.sin(t*1.1)*8,lean:Math.sin(t*.7)*.8};}
export function drawHands(c:CanvasRenderingContext2D,m:ReturnType<typeof prepareHands>,t:number,active:boolean,reduced:boolean){const p=handPose(t,active,reduced);m.hands.forEach((h,i)=>c.drawImage(h.sprite,h.x+(i?p.fret*.45:0),h.y+(i?-p.fret:p.pick)));}

// Facial edits use the original character's source coordinates and pixel scale.
export function drawSleep(c:CanvasRenderingContext2D,t:number,reduced:boolean){
 c.save();c.translate(332,699);c.scale(510/1358,510/1358);
 c.fillStyle='#ffbd86';c.fillRect(585,331,23,46);c.fillRect(644,330,25,47);
 c.fillStyle='#4c302e';c.fillRect(583,354,27,6);c.fillRect(642,354,29,6);
 c.strokeStyle='#77453b';c.lineWidth=5;c.beginPath();c.ellipse(620,402,10,13,0,0,Math.PI*2);c.stroke();
 const phase=reduced?.35:(t%3)/3;
 c.strokeStyle=`rgba(215,230,246,${.8-phase*.55})`;c.lineWidth=4;c.beginPath();c.ellipse(645+phase*25,374-phase*36,7+phase*15,9+phase*18,0,0,Math.PI*2);c.stroke();c.restore();
}
