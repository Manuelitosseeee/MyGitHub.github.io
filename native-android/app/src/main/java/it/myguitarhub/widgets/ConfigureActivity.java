package it.myguitarhub.widgets;
import android.app.*;
import android.appwidget.*;
import android.content.*;
import android.os.Bundle;
import android.graphics.Color;
import android.net.Uri;
import android.widget.*;
import org.json.JSONObject;
public class ConfigureActivity extends Activity {
 static final String API="https://myguitarhub-friends.manuelitosmurf.workers.dev/v1/widget";
 int widgetId;
 @Override public void onCreate(Bundle saved){
  super.onCreate(saved);setResult(RESULT_CANCELED);
  widgetId=getIntent().getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID,AppWidgetManager.INVALID_APPWIDGET_ID);
  LinearLayout box=new LinearLayout(this);box.setOrientation(LinearLayout.VERTICAL);box.setPadding(32,70,32,32);box.setBackgroundColor(Color.rgb(18,18,18));
  TextView title=new TextView(this);title.setText("La stanza del tuo amico");title.setTextColor(Color.WHITE);title.setTextSize(25);box.addView(title);
  TextView help=new TextView(this);help.setText("In MyGuitarHub apri Altro → Amici, entra nella stanza e copia la configurazione widget. Incollala qui.\n\nIl widget mostra l’immagine originale anche a sito chiuso. Android ne regola gli aggiornamenti; tocca ↻ per aggiornare subito. Non è un’animazione continua.");help.setTextColor(Color.LTGRAY);help.setPadding(0,20,0,20);box.addView(help);
  EditText input=new EditText(this);input.setHint("Incolla configurazione JSON");input.setTextColor(Color.WHITE);input.setHintTextColor(Color.GRAY);input.setInputType(android.text.InputType.TYPE_CLASS_TEXT|android.text.InputType.TYPE_TEXT_FLAG_MULTI_LINE);box.addView(input,new LinearLayout.LayoutParams(-1,150));
  Button save=new Button(this);save.setText(widgetId==AppWidgetManager.INVALID_APPWIDGET_ID?"Aggiungi widget alla Home":"Salva widget");box.addView(save);
  save.setOnClickListener(v->{try{
   JSONObject config=new JSONObject(input.getText().toString());if(!API.equals(config.getString("api"))||config.getString("token").length()<40)throw new Exception();
   String raw=config.toString();
   if(widgetId!=AppWidgetManager.INVALID_APPWIDGET_ID){store(this,widgetId,raw);GuitarWidget.refresh(this,new int[]{widgetId});setResult(RESULT_OK,new Intent().putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID,widgetId));finish();}
   else{AppWidgetManager manager=AppWidgetManager.getInstance(this);if(!manager.isRequestPinAppWidgetSupported()){Toast.makeText(this,"Tieni premuta la Home → Widget → MyGuitarHub Widget.",Toast.LENGTH_LONG).show();return;}
    String pending=java.util.UUID.randomUUID().toString();getSharedPreferences("widgets",MODE_PRIVATE).edit().putString(pending,raw).apply();
    Intent callback=new Intent(this,PinReceiver.class).setAction(pending);PendingIntent pi=PendingIntent.getBroadcast(this,0,callback,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_MUTABLE);
    manager.requestPinAppWidget(new ComponentName(this,GuitarWidget.class),null,pi);Toast.makeText(this,"Conferma il widget nella finestra di Android.",Toast.LENGTH_LONG).show();
   }
  }catch(Exception e){Toast.makeText(this,"Configurazione non valida. Copiala dalla stanza dell’amico.",Toast.LENGTH_LONG).show();}});
  Button open=new Button(this);open.setText("Apri MyGuitarHub");open.setOnClickListener(v->startActivity(new Intent(Intent.ACTION_VIEW,Uri.parse("https://myguitarhub.pages.dev/"))));box.addView(open);ScrollView scroll=new ScrollView(this);scroll.addView(box);setContentView(scroll);
 }
 static void store(Context context,int id,String config){context.getSharedPreferences("widgets",MODE_PRIVATE).edit().putString("widget-"+id,config).apply();}
}
