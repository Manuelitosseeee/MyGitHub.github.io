/**
 * Pixel Story guitarist: preserve the approved actor and animate only the
 * fingers and the nylon strings. Scene coordinates are on a 1004×1567 canvas.
 * The previous pixel-colour removal touched x=579..626 / y=813..879, an area
 * containing the face; the source sprite is now entirely READ-ONLY.
 */
const DIGITS=[
 {side:'pick',x:508,y:921,w:18,h:18,index:0},
 {side:'pick',x:518,y:929,w:15,h:13,index:1},
 {side:'fret',x:629,y:842,w:19,h:13,index:0},
 {side:'fret',x:625,y:853,w:18,h:13,index:1},
 {side:'fret',x:620,y:864,w:17,h:12,index:2},
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
 if(intensity<.015)return;
 c.save();
 // The vibration is clipped to the sound hole, never the body or face.
 c.beginPath();c.moveTo(509,945);c.lineTo(540,910);
 c.lineTo(562,914);c.lineTo(542,946);c.closePath();c.clip();
 c.lineWidth=1.15;c.lineCap='round';
 for(let string=0;string<6;string++){
  const shift=(string-2.5)*1.9,amplitude=(1.1+string%3*.5)*intensity;
  c.strokeStyle=string%2?'rgba(254,230,191,.64)':'rgba(240,226,207,.53)';
  c.beginPath();
  for(let step=0;step<=13;step++){
   const u=step/13,x=504+49*u+shift,y=951-39*u+shift*.66;
   const wave=Math.sin(u*Math.PI*5-t*41+string*.7)*Math.sin(u*Math.PI)*amplitude;
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
 const stroke=Math.sin(pose.beat*Math.PI*2);
 c.fillStyle='#ffbf88';
 c.fillRect(Math.round(522+stroke*3),Math.round(933+stroke*2),5,3);
 c.fillStyle='#d97b59';
 c.fillRect(Math.round(525+stroke*3),Math.round(936+stroke*2),3,2);
 // Three fingertips physically touch/release the angled fingerboard.
 const anchors=[
  {x:647,y:848,tipX:639,tipY:847},
  {x:643,y:859,tipX:633,tipY:858},
  {x:640,y:870,tipX:627,tipY:867},
 ];
 for(const digit of m.digits){
  if(digit.side!=='fret')continue;
  const press=Math.max(0,Math.sin(t*4.5+digit.index*1.7));
  const dx=Math.round(pose.fret*.35-press*1.25);
  const dy=Math.round(-pose.fret*.4+press*1.5);
  const a=anchors[digit.index];
  c.save();c.strokeStyle='#faaf78';c.lineWidth=5;c.lineCap='round';
  c.beginPath();c.moveTo(a.x,a.y);
  c.lineTo(a.tipX+dx,a.tipY+dy);c.stroke();c.restore();
  c.drawImage(digit.sprite,digit.x+dx,digit.y+dy);
  const x=Math.round(digit.x+4+dx-2*press);
  const y=Math.round(digit.y+5+dy+press);
  c.fillStyle='#ffc28c';c.fillRect(x,y,5,3);
  c.fillStyle='#cf7c60';c.fillRect(x+1,y+3,3,1);
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
