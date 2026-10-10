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
export function camera(width:number,height:number){const scale=Math.min(width/ART_W,height/ART_H);const spare=height-ART_H*scale;return {scale,x:(width-ART_W*scale)/2,y:Math.min(60,Math.max(0,spare*.25))};}
export function hasAllArt(owned:string[]){return ['rug','desk','shelf','guitar','art','records','plant','curtains','cat'].every(id=>owned.includes(id));}
