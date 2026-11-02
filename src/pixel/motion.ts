/**
 * Pixel Story guitarist: preserve the approved actor and animate only the
 * fingers and the nylon strings. Scene coordinates are on a 1004×1567 canvas.
 * The previous pixel-colour removal touched x=579..626 / y=813..879, an area
 * containing the face; the source sprite is now entirely READ-ONLY.
 */
const DIGITS=[
 {side:'pick',x:508,y:921,w:18,h:18,index:0},
 {side:'pick',x:518,y:929,w:15,h:13,index:1},
] as const;
type Finger=(typeof DIGITS)[number]&{sprite:HTMLCanvasElement};
export interface GuitarMotion{clean:HTMLCanvasElement;digits:Finger[];}
const skin=(r:number,g:number,b:number,a:number)=>
 a>90&&r>204&&g>119&&g<213&&b>68&&b<169&&r-g>38&&g-b>21;

/** Exact original character: do not erase skin pixels or translate the head. */
export function prepareHands(source:CanvasImageSource):GuitarMotion{
 const clean=document.createElement('canvas');
 clean.width=1004;clean.height=1567;
 const c=clean.getContext('2d',{willReadFrequently:true})!;
 c.imageSmoothingEnabled=false;
 c.drawImage(source,0,0,1004,1567);
 const digits:Finger[]=DIGITS.map(d=>{
  const sprite=document.createElement('canvas');
  sprite.width=d.w;sprite.height=d.h;
  const sc=sprite.getContext('2d')!;
  const input=c.getImageData(d.x,d.y,d.w,d.h);
  const output=sc.createImageData(d.w,d.h);
  for(let i=0;i<input.data.length;i+=4){
   const r=input.data[i],g=input.data[i+1],b=input.data[i+2],a=input.data[i+3];
   if(!skin(r,g,b,a))continue;
   output.data[i]=r;output.data[i+1]=g;output.data[i+2]=b;output.data[i+3]=a;
  }
  sc.putImageData(output,0,0);
  return {...d,sprite};
 });
 return {clean,digits};
}
export function handPose(t:number,active:boolean,reduced:boolean){
 if(!active||reduced)return {pick:0,fret:0,lean:0,vibration:0,beat:0};
 const beat=t*3.2%1;
 const fret=[0,2,-1,3,1][Math.floor(t/2.7)%5];
 return {pick:Math.sin(beat*Math.PI*2)*3.4,fret,lean:0,vibration:(1-beat)**3,beat};
}
function vibratingStrings(c:CanvasRenderingContext2D,t:number,intensity:number){
 if(intensity<.025)return;
 c.save();
 // The real strings are already bright in the source image: adding pale lines
 // made the sound hole flash white. Multiplication can only gently darken them.
 c.beginPath();c.moveTo(529,944);c.lineTo(541,919);
 c.lineTo(561,917);c.lineTo(550,944);c.closePath();c.clip();
 c.globalCompositeOperation='multiply';
 c.lineCap='round';c.lineWidth=.85;
 c.globalAlpha=.32*intensity;
 for(let string=0;string<6;string++){
  const shift=(string-2.5)*1.7;
  const amplitude=(.6+(string%3)*.14)*intensity;
  c.strokeStyle=string%2?'#a88052':'#c0a06a';
  c.beginPath();
  for(let step=0;step<=13;step++){
   const u=step/13,x=522+43*u+shift,y=953-43*u+shift*.65;
   const wave=Math.sin(u*Math.PI*5-t*36+string*.7)*Math.sin(u*Math.PI)*amplitude;
   if(step===0)c.moveTo(x+wave,y+wave);else c.lineTo(x+wave,y+wave);
  }
  c.stroke();
 }
 c.restore();
}
/** Individual finger presses and alternating plucks, not body translation. */
export function drawHands(c:CanvasRenderingContext2D,m:GuitarMotion,t:number,active:boolean,reduced:boolean){
 if(!active||reduced)return;
 const pose=handPose(t,active,reduced);
 vibratingStrings(c,t,pose.vibration);
 for(const digit of m.digits){
  if(digit.side!=='pick')continue;
  const phase=pose.beat*Math.PI*2-digit.index*1.8;
  const dx=Math.round(Math.sin(phase)*2.6);
  const dy=Math.round((1-Math.cos(phase))*1.3);
  c.drawImage(digit.sprite,digit.x+dx,digit.y+dy);
 }
 // The left hand is kept as one intact piece of the approved sprite.
 // The old overlapping 17–19 px finger cutouts looked like disconnected
 // extra fingers. Instead, move only 1–3 connected fingertip pixels toward
 // the strings, anchored directly to already-painted skin.
 const contacts=[
  {x:650,y:845,offset:0},
  {x:644,y:853,offset:1.55},
  {x:640,y:861,offset:3.1},
 ] as const;
 for(const finger of contacts){
  const press=Math.max(0,Math.sin(t*3.55+finger.offset));
  const reach=Math.round(press*3);
  if(reach===0)continue;
  c.save();
  c.fillStyle='#d68b66';c.fillRect(finger.x,finger.y,1,2);
  c.fillStyle='#f6b681';
  for(let i=1;i<=reach;i++)c.fillRect(finger.x-i,finger.y,1,2);
  c.fillStyle='#c57855';c.fillRect(finger.x-reach,finger.y+1,1,1);
  c.restore();
 }

}

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
