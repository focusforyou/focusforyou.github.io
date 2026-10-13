package io.github.focusforyou.app;

import android.media.AudioManager;
import android.media.ToneGenerator;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;

/** Shares alert throttling between WebView completion and the native background timer. */
final class FocusSound {
    private static long lastAlarm=-10000,lastNudge=-10000;
    private FocusSound() {}
    static synchronized void play(String kind) {
        final boolean alarm="alarm".equals(kind)||"focus".equals(kind)||"break".equals(kind);
        if(!alarm&&!"nudge".equals(kind))return;
        long now=SystemClock.elapsedRealtime();
        if(now-(alarm?lastAlarm:lastNudge)<1500)return;
        if(alarm)lastAlarm=now;else lastNudge=now;
        ToneGenerator tone=null;
        try {
            tone=new ToneGenerator(alarm?AudioManager.STREAM_ALARM:AudioManager.STREAM_NOTIFICATION,65);
            int duration=alarm?1100:350;
            int sound="focus".equals(kind)?ToneGenerator.TONE_PROP_ACK:"break".equals(kind)?ToneGenerator.TONE_PROP_PROMPT:alarm?ToneGenerator.TONE_CDMA_ALERT_CALL_GUARD:ToneGenerator.TONE_PROP_BEEP2;
            boolean started=tone.startTone(sound,duration);
            if(!started){tone.release();return;}
            final ToneGenerator playing=tone;
            new Handler(Looper.getMainLooper()).postDelayed(playing::release,duration+150);
        } catch(RuntimeException ignored) {
            if(tone!=null)tone.release();
            // Devices without an available audio output keep the timer running normally.
        }
    }
}

