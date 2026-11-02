package it.myguitarhub.widgets;
import android.app.*;
import android.appwidget.*;
import android.content.*;
import android.graphics.*;
import android.net.Uri;
import android.view.View;
import android.widget.RemoteViews;
import android.util.Base64;
import org.json.JSONObject;
import java.net.*;
import javax.net.ssl.HttpsURLConnection;
import java.io.*;
public class GuitarWidget extends AppWidgetProvider {
 static final String REFRESH="it.myguitarhub.widgets.REFRESH";
 static void refresh(Context c,int[] ids){c.sendBroadcast(new Intent(c,GuitarWidget.class).setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE).putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS,ids));}
 @Override public void onReceive(Context c,Intent i){
  if(AppWidgetManager.ACTION_APPWIDGET_UPDATE.equals(i.getAction())||REFRESH.equals(i.getAction())){
   int[] ids=i.getIntArrayExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS);if(ids==null)ids=AppWidgetManager.getInstance(c).getAppWidgetIds(new ComponentName(c,GuitarWidget.class));
   final int[] selected=ids;final PendingResult result=goAsync();final Context app=c.getApplicationContext();
   new Thread(()->{try{for(int id:selected)update(app,id);}finally{result.finish();}}).start();
  }else super.onReceive(c,i);
 }
 @Override public void onDeleted(Context c,int[] ids){for(int id:ids)c.getSharedPreferences("widgets",Context.MODE_PRIVATE).edit().remove("widget-"+id).apply();}
 static void update(Context c,int id){
  RemoteViews views=new RemoteViews(c.getPackageName(),R.layout.widget);String url="https://myguitarhub.pages.dev/";
  views.setViewVisibility(R.id.room,View.GONE);
  try{
   String raw=c.getSharedPreferences("widgets",Context.MODE_PRIVATE).getString("widget-"+id,null);if(raw==null)throw new IOException("Apri l’app per configurare il widget.");
   JSONObject config=new JSONObject(raw);HttpsURLConnection connection=(HttpsURLConnection)new URL(ConfigureActivity.API).openConnection();
   connection.setConnectTimeout(4000);connection.setReadTimeout(4000);connection.setRequestProperty("Authorization","Bearer "+config.getString("token"));connection.setUseCaches(false);
   try{
    int code=connection.getResponseCode();if(code==401||code==403){c.getSharedPreferences("widgets",Context.MODE_PRIVATE).edit().remove("widget-"+id).apply();throw new IOException("Amicizia rimossa o widget revocato.");}
    if(code!=200)throw new IOException("Connessione non disponibile.");
    byte[] bytes;try(InputStream in=connection.getInputStream();ByteArrayOutputStream out=new ByteArrayOutputStream()){byte[] buffer=new byte[4096];int count;while((count=in.read(buffer))!=-1){out.write(buffer,0,count);if(out.size()>800000)throw new IOException("Risposta non valida.");}bytes=out.toByteArray();}
    JSONObject data=new JSONObject(new String(bytes,java.nio.charset.StandardCharsets.UTF_8));views.setTextViewText(R.id.nickname,data.getString("nickname"));views.setTextViewText(R.id.status,data.getBoolean("studying")?"Sta studiando":"Si riposa");
    String image=data.optString("snapshot","");if(image.startsWith("data:image/png;base64,")){byte[] png=Base64.decode(image.substring(image.indexOf(',')+1),Base64.DEFAULT);Bitmap bitmap=BitmapFactory.decodeByteArray(png,0,png.length);if(bitmap!=null){views.setImageViewBitmap(R.id.room,bitmap);views.setViewVisibility(R.id.room,View.VISIBLE);}}
    long updated=data.optLong("updated",0);views.setTextViewText(R.id.updated,updated>0?"Ultimo contatto "+android.text.format.DateFormat.format("HH:mm",updated):"In attesa della stanza");
    String candidate=data.optString("openURL",url);if(candidate.startsWith("https://myguitarhub.pages.dev/"))url=candidate;
   }finally{connection.disconnect();}
  }catch(Exception e){views.setTextViewText(R.id.status,e instanceof IOException?e.getMessage():"Configurazione non disponibile.");views.setTextViewText(R.id.updated,"Tocca ↻ per riprovare");}
  Intent open=new Intent(Intent.ACTION_VIEW,Uri.parse(url));views.setOnClickPendingIntent(R.id.widget_root,PendingIntent.getActivity(c,id,open,PendingIntent.FLAG_IMMUTABLE|PendingIntent.FLAG_UPDATE_CURRENT));
  Intent refresh=new Intent(c,GuitarWidget.class).setAction(REFRESH).putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS,new int[]{id}).setData(Uri.parse("myguitarhub://refresh/"+id));views.setOnClickPendingIntent(R.id.refresh,PendingIntent.getBroadcast(c,id,refresh,PendingIntent.FLAG_IMMUTABLE|PendingIntent.FLAG_UPDATE_CURRENT));
  AppWidgetManager.getInstance(c).updateAppWidget(id,views);
 }
}
