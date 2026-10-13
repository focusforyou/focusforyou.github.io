package io.github.focusforyou.app;

import android.app.*;
import android.content.*;
import android.content.pm.ServiceInfo;
import android.os.*;
import androidx.core.app.NotificationCompat;
import androidx.core.app.ServiceCompat;

/** Keeps the user-started study session alive while the activity is in the background. */
public class FocusService extends Service {
    static Runnable heartbeat;
    static Runnable toggle;
    static boolean active;
    private static final String CHANNEL="focus_session";
    private static final int ID=21;
    private final Handler handler=new Handler(Looper.getMainLooper());
    private PowerManager.WakeLock wake;
    private boolean running;
    private String phase="Odak",room="";
    private long end;
    private long remaining;
    private boolean completionPlayed;
    private final Runnable pulse=new Runnable() {
        @Override public void run() {
            if(heartbeat==null){stopSelf();return;}
            if(running&&!completionPlayed&&SystemClock.elapsedRealtime()>=end){completionPlayed=true;FocusSound.play("Odak".equals(phase)?"break":"focus");}
            if(wake!=null){if((running||!room.isEmpty())&&!wake.isHeld())wake.acquire(10*60*1000L);else if(!running&&room.isEmpty()&&wake.isHeld())wake.release();}
            heartbeat.run();
            handler.postDelayed(this,1000);
        }
    };
    @Override public void onCreate() {
        super.onCreate();
        NotificationChannel channel=new NotificationChannel(CHANNEL,"Çalışma ve oda",NotificationManager.IMPORTANCE_LOW);
        channel.setDescription("Aktif sayaç ve oda bağlantısı");channel.setSound(null,null);
        getSystemService(NotificationManager.class).createNotificationChannel(channel);
        wake=((PowerManager)getSystemService(POWER_SERVICE)).newWakeLock(PowerManager.PARTIAL_WAKE_LOCK,"FocusForYou:session");
        wake.setReferenceCounted(false);
    }
    private PendingIntent open() {
        Intent intent=new Intent(this,MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP|Intent.FLAG_ACTIVITY_CLEAR_TOP);
        return PendingIntent.getActivity(this,0,intent,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
    }
    private Notification notification() {
        Intent action=new Intent(this,FocusService.class).setAction("toggle");
        PendingIntent button=PendingIntent.getService(this,1,action,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
        NotificationCompat.Builder builder=new NotificationCompat.Builder(this,CHANNEL)
            .setSmallIcon(io.github.focusforyou.app.R.drawable.notification_icon)
            .setContentTitle(running?phase+" sayacı çalışıyor":phase+" · "+String.format(java.util.Locale.ROOT,"%02d:%02d",remaining/60,remaining%60)+" · duraklatıldı")
            .setContentText(room.isEmpty()?"Kendi ritminde odaklan":"Oda "+room+" · bağlantı açık")
            .setContentIntent(open()).setOngoing(true).setOnlyAlertOnce(true).setSilent(true)
            .setShowWhen(false).setCategory(NotificationCompat.CATEGORY_PROGRESS)
            .addAction(0,running?"Duraklat":"Devam ettir",button)
            .addAction(0,"Uygulamayı aç",open());
        if(running){builder.setWhen(System.currentTimeMillis()+Math.max(0,end-SystemClock.elapsedRealtime()))
            .setShowWhen(true).setUsesChronometer(true).setChronometerCountDown(true);}
        return builder.build();
    }
    @Override public int onStartCommand(Intent intent,int flags,int startId) {
        if(intent==null||heartbeat==null){stopSelf();return START_NOT_STICKY;}
        if("toggle".equals(intent.getAction())){if(toggle!=null)toggle.run();return START_NOT_STICKY;}
        running=intent.getBooleanExtra("running",false);
        remaining=intent.getLongExtra("remaining",0);
        room=intent.getStringExtra("room");if(room==null)room="";
        phase=intent.getBooleanExtra("break",false)?"Mola":"Odak";
        long deadline=intent.getLongExtra("deadline",System.currentTimeMillis());
        end=SystemClock.elapsedRealtime()+Math.max(0,deadline-System.currentTimeMillis());
        if(!running||end>SystemClock.elapsedRealtime()+1500)completionPlayed=false;
        if(!intent.getBooleanExtra("active",false)){stopSelf();return START_NOT_STICKY;}
        ServiceCompat.startForeground(this,ID,notification(),Build.VERSION.SDK_INT>=34?ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE:0);
        if(!active){active=true;handler.post(pulse);}
        return START_NOT_STICKY;
    }
    @Override public void onTaskRemoved(Intent rootIntent){stopSelf();}
    @Override public void onDestroy(){active=false;handler.removeCallbacks(pulse);if(wake!=null&&wake.isHeld())wake.release();stopForeground(STOP_FOREGROUND_REMOVE);super.onDestroy();}
    @Override public IBinder onBind(Intent intent){return null;}
}

