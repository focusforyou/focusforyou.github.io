package io.github.focusforyou.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import com.google.firebase.messaging.FirebaseMessaging;
import java.util.ArrayList;
import java.util.List;
import java.util.function.Consumer;

final class FocusPush {
    static final String CHANNEL = "focus_nudges";
    private static boolean enabled;
    // Updated only by the resumed, trusted Activity; FCM runs on a different thread.
    private static volatile String foregroundRoom = "";
    static void setForegroundRoom(String room) { foregroundRoom = validRoom(room) ? room : ""; }
    static boolean foregroundReceives(String room) { return room != null && !room.isEmpty() && room.equals(foregroundRoom); }
    private static SharedPreferences prefs(Context context) { return context.getSharedPreferences("focus_push", Context.MODE_PRIVATE); }
    static synchronized boolean initialize(Context context) {
        if (enabled) return true;
        if (BuildConfig.FIREBASE_APP_ID.isEmpty() || BuildConfig.FIREBASE_API_KEY.isEmpty()
            || BuildConfig.FIREBASE_PROJECT_ID.isEmpty() || BuildConfig.FIREBASE_SENDER_ID.isEmpty()) return false;
        if (!BuildConfig.FIREBASE_APP_ID.matches("1:[0-9]+:android:[A-Za-z0-9]+")) return false;
        try {
            try { FirebaseApp.getInstance(); }
            catch (IllegalStateException absent) {
                FirebaseApp.initializeApp(context.getApplicationContext(), new FirebaseOptions.Builder()
                    .setApplicationId(BuildConfig.FIREBASE_APP_ID).setApiKey(BuildConfig.FIREBASE_API_KEY)
                    .setProjectId(BuildConfig.FIREBASE_PROJECT_ID).setGcmSenderId(BuildConfig.FIREBASE_SENDER_ID).build());
            }
            NotificationManager manager = context.getSystemService(NotificationManager.class);
            if (manager != null) manager.createNotificationChannel(new NotificationChannel(CHANNEL, "Arkadaş dürtmeleri", NotificationManager.IMPORTANCE_DEFAULT));
            FirebaseMessaging.getInstance().setAutoInitEnabled(true);
            enabled = true;
            return true;
        } catch (RuntimeException unavailable) { return false; }
    }
    static void saveToken(Context context, String token) {
        if (token != null && !token.isEmpty() && token.length() <= 4096) prefs(context).edit().putString("token", token).apply();
    }
    static void requestToken(Context context, Consumer<String> result) {
        if (!initialize(context)) { result.accept(""); return; }
        FirebaseMessaging.getInstance().getToken().addOnCompleteListener(task -> {
            if (task.isSuccessful()) { String token = task.getResult(); saveToken(context, token); result.accept(token == null ? "" : token); }
            else result.accept(""); // Never register a potentially rotated, stale cached token.
        });
    }
    static boolean validRoom(String room) {
        return room != null && room.matches("(?:YKS|LGS|TUS|[1-9][0-9]{4}|[1-9][0-9]{7}|[A-Za-z0-9_-]{16,40})");
    }
    static String roomUrl(String room) {
        return validRoom(room) ? Uri.parse("https://focusforyou.github.io/").buildUpon().appendQueryParameter("club", room).fragment("lobi").build().toString() : null;
    }
    static String destination(Intent intent) {
        // FCM notification+data messages put their data in launcher extras when tapped.
        return intent == null ? null : roomUrl(intent.getStringExtra("roomId"));
    }
    static synchronized boolean rememberNudge(Context context, String id) {
        if (id == null || !id.matches("[A-Za-z0-9_-]{8,160}")) return false;
        SharedPreferences store = prefs(context);
        List<String> ids = new ArrayList<>();
        for (String old : store.getString("seen_nudges", "").split(",")) if (!old.isEmpty()) ids.add(old);
        if (ids.contains(id)) return false;
        ids.add(id);
        while (ids.size() > 64) ids.remove(0);
        // Commit before notifying so a process restart cannot replay the same foreground event.
        return store.edit().putString("seen_nudges", String.join(",", ids)).commit();
    }
}
