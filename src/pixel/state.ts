import { useSyncExternalStore } from 'react';
import { initialPixel, PIXEL_KEY, recover, type PixelState } from './model';
let value:PixelState=initialPixel();
let error='';
try {value=recover(JSON.parse(localStorage.getItem(PIXEL_KEY)??'null'));}catch{error='Impossibile leggere i progressi Pixel Story.';}
const listeners=new Set<()=>void>();
export const pixel = {
  reset() {
    localStorage.removeItem(PIXEL_KEY);
    value=initialPixel();error='';listeners.forEach(f=>f());
  },
  get:()=>value,
  getError:()=>error,
  update(fn:(p:PixelState)=>PixelState) {
    const next=fn(value);if(next===value)return false;
    try{localStorage.setItem(PIXEL_KEY,JSON.stringify(next));error='';}catch{error='Salvataggio non disponibile: libera spazio prima di continuare.';listeners.forEach(f=>f());return false;}
    value=next;listeners.forEach(f=>f());return true;
  },
  subscribe(fn:()=>void){listeners.add(fn);return()=>{listeners.delete(fn);};}
};
export function usePixel(){return useSyncExternalStore(pixel.subscribe,pixel.get);}
