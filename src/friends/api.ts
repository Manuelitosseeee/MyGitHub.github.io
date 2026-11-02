/** Device-local private credential. A display nickname never authenticates a user. */
const KEY = 'mygithub.friends.identity.v1';
export type Identity = {id:string;nickname:string;token:string};
export type Room = {mapId:string;owned:string[];lampOn:boolean;deskLightOn:boolean;fireOn:boolean;rainOn:boolean;activeMs:number};
export type Friend = {id:string;nickname:string;room:Room|null;studying:boolean;weekKey:string|null;weekSeconds:number;updatedAt:number};
export type FriendRequest = {id:string;sender_id:string;recipient_id:string;nickname:string;created_at:number};
export function getIdentity():Identity|null {try {const value=JSON.parse(localStorage.getItem(KEY)??'null') as Identity|null;return value?.token?.startsWith('gh1.')?value:null;}catch{return null;}}
export function clearIdentity(){localStorage.removeItem(KEY);}
export async function requestFriends<T>(path:string,method='GET',data?:object,token=getIdentity()?.token):Promise<T>{
 const res=await fetch('/api/friends/'+path,{method,headers:{...(token?{authorization:'Bearer '+token}:{}),...(data?{'content-type':'application/json'}:{})},...(data?{body:JSON.stringify(data)}:{}),cache:'no-store'});
 let json:Record<string,unknown>={};try{json=await res.json() as Record<string,unknown>;}catch{throw new Error('Impossibile raggiungere il servizio Amici. Controlla la connessione e la configurazione Cloudflare.');}
 if(!res.ok)throw new Error(String(json.error||'Servizio Amici non disponibile.'));
 return json as T;
}
export async function createIdentity(nickname:string):Promise<Identity>{
 const bytes=crypto.getRandomValues(new Uint8Array(32));const token='gh1.'+btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
 const response=await requestFriends<{id:string;nickname:string}>('identity','POST',{nickname,token},undefined);
 const identity={...response,token};localStorage.setItem(KEY,JSON.stringify(identity));window.dispatchEvent(new Event("mygithub:identity-changed"));return identity;
}
export async function updateNickname(nickname:string):Promise<Identity>{
 const result=await requestFriends<{id:string;nickname:string}>('profile','PATCH',{nickname});const current=getIdentity();if(!current)throw new Error('Devi prima creare il tuo profilo.');const next={...current,...result};localStorage.setItem(KEY,JSON.stringify(next));window.dispatchEvent(new Event("mygithub:identity-changed"));return next;
}
export const inviteParam=()=>new URL(location.href).searchParams.get('friend_invite');
export const friendParam=()=>new URL(location.href).searchParams.get('friend_id');
export function clearFriendParams(){const url=new URL(location.href);url.searchParams.delete('friend_invite');url.searchParams.delete('friend_id');history.replaceState(null,'',url.pathname+url.search+url.hash);}
