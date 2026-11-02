// MyGuitarHub Room · Scriptable iOS/iPadOS Home Screen Widget
// Paste into the Scriptable app, then set its Widget Parameter to the
// 64-character private widget token created by your friend in MyGuitarHub.
// Token authorizes THIS widget only, not your own profile.
const BASE="https://myguitarhub-room-widget.manuelitosmurf.workers.dev";
const token=String(args.widgetParameter||"").trim();
const w=new ListWidget();
w.backgroundColor=new Color("#1c171a");
w.url="https://myguitarhub.pages.dev/?tab=amici";
w.refreshAfterDate=new Date(Date.now()+5*60*1000);
function message(text){
 w.addSpacer();
 const t=w.addText(text);t.textColor=new Color("#ffdaaa");
 t.font=Font.systemFont(12);t.centerAlignText();
 w.addSpacer();
}
if(!/^[a-f0-9]{64}$/.test(token)){
 message("Configura il codice widget nelle impostazioni di Scriptable");
}else{
 try{
  const uri=BASE+"/image?token="+encodeURIComponent(token);
  const req=new Request(uri);req.timeoutInterval=12;
  const image=await req.loadImage();
  w.backgroundImage=image;
  w.addSpacer();
 }catch(e){
  message("Stanza non disponibile. Apri MyGuitarHub e verifica l'amicizia.");
 }
}
if(config.runsInWidget)Script.setWidget(w);
else await w.presentMedium();
Script.complete();
