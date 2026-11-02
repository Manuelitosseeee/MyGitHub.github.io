package it.myguitarhub.widgets;
import android.content.*;
import android.appwidget.AppWidgetManager;
public class PinReceiver extends BroadcastReceiver {
 @Override public void onReceive(Context context,Intent intent){
  int id=intent.getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID,AppWidgetManager.INVALID_APPWIDGET_ID);
  if(id==AppWidgetManager.INVALID_APPWIDGET_ID||intent.getAction()==null)return;
  SharedPreferences p=context.getSharedPreferences("widgets",Context.MODE_PRIVATE);String config=p.getString(intent.getAction(),null);if(config==null)return;
  ConfigureActivity.store(context,id,config);p.edit().remove(intent.getAction()).apply();GuitarWidget.refresh(context,new int[]{id});
 }
}
