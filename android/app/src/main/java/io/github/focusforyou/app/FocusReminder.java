package io.github.focusforyou.app;

import android.app.AlarmManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import org.json.JSONObject;

/** User-opted-in, device-local reminders. No network or exact-alarm permission. */
public final class FocusReminder extends BroadcastReceiver {
    private static final String CHANNEL="focus_study_events";
    private static SharedPreferences prefs(Context c){return c.getSharedPreferences("focus_study_reminders",Context.MODE_PRIVATE);}
    private static boolean valid(String key){return key!=null&&key.matches("[A-Za-z0-9_-]{1,64}_[a-f0-9]{20}");}
    private static PendingIntent pending(Context c,String key){
        Intent i=new Intent(c,FocusReminder.class).setAction("io.github.focusforyou.STUDY_EVENT").setData(Uri.parse("focus-reminder://event/"+key));
        return PendingIntent.getBroadcast(c,0,i,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
    }
    static synchronized void schedule(Context c,String key,long when,String title){
        if(!valid(key)||title==null||title.trim().isEmpty()||title.length()>80||when<=System.currentTimeMillis()||when>System.currentTimeMillis()+90L*86400000L)return;
        SharedPreferences p=prefs(c);if(!p.contains(key)&&p.getAll().size()>=64)return;
        try{JSONObject data=new JSONObject().put("when",when).put("title",title);p.edit().putString(key,data.toString()).apply();AlarmManager alarms=c.getSystemService(AlarmManager.class);if(alarms!=null)alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,when,pending(c,key));}catch(Exception ignored){}
    }
    static synchronized void cancel(Context c,String key){if(!valid(key))return;AlarmManager alarms=c.getSystemService(AlarmManager.class);if(alarms!=null)alarms.cancel(pending(c,key));prefs(c).edit().remove(key).apply();}
    static synchronized void clear(Context c){for(String key:prefs(c).getAll().keySet())cancel(c,key);}
    @Override public void onReceive(Context c,Intent intent){
        if(Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction())){for(String key:prefs(c).getAll().keySet()){try{JSONObject d=new JSONObject(prefs(c).getString(key,""));if(d.getLong("when")>System.currentTimeMillis())schedule(c,key,d.getLong("when"),d.getString("title"));else cancel(c,key);}catch(Exception ignored){cancel(c,key);}}return;}
        String key=intent.getData()==null?null:intent.getData().getLastPathSegment();if(!valid(key))return;
        try{String raw=prefs(c).getString(key,"");if(raw.isEmpty())return;JSONObject data=new JSONObject(raw);if(data.getLong("when")>System.currentTimeMillis()+30000)return;
            NotificationManager manager=c.getSystemService(NotificationManager.class);if(manager==null)return;
            manager.createNotificationChannel(new NotificationChannel(CHANNEL,"Çalışma randevuları",NotificationManager.IMPORTANCE_DEFAULT));
            Intent open=new Intent(c,MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK|Intent.FLAG_ACTIVITY_CLEAR_TOP);
            PendingIntent content=PendingIntent.getActivity(c,key.hashCode(),open,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
            if(android.os.Build.VERSION.SDK_INT<33||c.checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS)==android.content.pm.PackageManager.PERMISSION_GRANTED){manager.notify(key.hashCode(),new android.app.Notification.Builder(c,CHANNEL).setSmallIcon(R.drawable.notification_icon).setContentTitle("Çalışma randevun başladı!").setContentText(data.getString("title")).setContentIntent(content).setAutoCancel(true).build());}
        }catch(Exception ignored){}finally{cancel(c,key);}
    }
}
