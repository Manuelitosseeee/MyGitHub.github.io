// Coordinates belong to the approved 1004 × 1567 composition. No sprite rescaling.
export const ART_W = 1004;
export const ART_H = 1567;
export const ITEM_AREAS: Record<string, number[][]> = {
 rug: [[118,1146,812,160]], desk: [[0,812,328,340]], shelf: [[735,346,269,684]],
 guitar: [[810,744,152,383]], art: [[30,240,128,139],[611,374,107,133],[573,524,148,140]],
 records: [[0,1340,369,227]], plant: [[0,385,110,193],[554,223,146,155],[902,180,102,132],[801,313,101,159],[926,411,78,157],[916,783,88,343],[0,1103,232,438]],
 curtains: [[190,184,351,30],[194,200,76,387],[462,200,76,387]], cat: [[96,433,69,60]],
};
export const CORE_PATH = [[429,708],[474,697],[519,713],[550,741],[556,768],[542,789],[539,812],[576,798],[629,749],[656,744],[686,776],[657,815],[635,836],[628,894],[626,937],[581,974],[577,1035],[594,1109],[611,1125],[611,1152],[588,1160],[615,1208],[545,1210],[533,1160],[515,1154],[535,1128],[524,1097],[523,1077],[477,1075],[474,1167],[435,1208],[352,1209],[354,1184],[360,1150],[365,1105],[356,1068],[353,1026],[351,970],[336,936],[333,865],[347,846],[390,819],[425,816],[424,781],[418,750]];
export const HOTSPOTS = {
 clock:[690,238,170,75], metro:[657,871,108,124], rain:[263,238,207,296],
 fire:[19,624,116,167], lamp:[853,263,45,49], deskLight:[138,724,145,112], cat:[96,433,69,60],
} as const;
// Fit the complete composition. Cover would crop the furniture on narrow phones.
export function camera(width:number,height:number){const scale=Math.min(width/ART_W,height/ART_H);return {scale,x:(width-ART_W*scale)/2,y:(height-ART_H*scale)/2};}
// Continue only the empty room's edge textures, at their original scale, around
// the fitted scene. Never stretch furniture, repeat purchased sprites or add a
// foreign floor. The central composition always remains fully visible.
export function drawRoomEdges(c:CanvasRenderingContext2D,base:CanvasImageSource,width:number,height:number,cam:ReturnType<typeof camera>){
 const band=64,step=band*cam.scale,rw=ART_W*cam.scale,rh=ART_H*cam.scale;
 c.save();c.imageSmoothingEnabled=false;
 for(let y=cam.y-step;y>-step;y-=step)c.drawImage(base,0,0,ART_W,band,cam.x,y,rw,step+1);
 for(let y=cam.y+rh;y<height;y+=step)c.drawImage(base,0,ART_H-band,ART_W,band,cam.x,y,rw,step+1);
 for(let x=cam.x-step;x>-step;x-=step)c.drawImage(base,0,0,band,ART_H,x,cam.y,step+1,rh);
 for(let x=cam.x+rw;x<width;x+=step)c.drawImage(base,ART_W-band,0,band,ART_H,x,cam.y,step+1,rh);
 c.restore();
}
export function visibleHotspot(cam:ReturnType<typeof camera>,width:number,height:number,q:readonly number[]){const w=Math.min(q[2]*cam.scale,width-24),h=Math.min(q[3]*cam.scale,height-24);return {x:Math.max(12,Math.min(width-w-12,cam.x+q[0]*cam.scale)),y:Math.max(12,Math.min(height-h-12,cam.y+q[1]*cam.scale)),w,h};}
export function hasAllArt(owned:string[]){return ['rug','desk','shelf','guitar','art','records','plant','curtains','cat'].every(id=>owned.includes(id));}
