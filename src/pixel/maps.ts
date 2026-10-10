export const MAPS = [
 {id:'home',name:'Casa di legno',subtitle:'Il tuo primo angolo di musica',color:'#51302b',floor:1004},
 {id:'studio',name:'Studio di registrazione',subtitle:'Legno, mixer e notti in studio',color:'#44312d',floor:958},
 {id:'shop',name:'Negozio di musica',subtitle:'Tra strumenti e piccole scoperte',color:'#693c2c',floor:1025},
 {id:'rehearsal',name:'Sala prove',subtitle:'Il tuo rifugio per suonare insieme',color:'#57302e',floor:930},
 {id:'stage',name:'Palco musicale',subtitle:'La tua musica sotto le luci',color:'#272039',floor:1090},
] as const;
export type MapId = typeof MAPS[number]['id'];
export const mapInfo=(id:string)=>MAPS.find(m=>m.id===id)??MAPS[0];
