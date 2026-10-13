package io.github.focusforyou.app;

import android.Manifest;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;
import java.util.Map;

public final class FocusMessagingService extends FirebaseMessagingService {
    @Override public void onNewToken(String token) { FocusPush.saveToken(this, token); }
    @Override public void onMessageReceived(RemoteMessage message) {
        if (!FocusPush.initialize(this)) return;
        Map<String, String> data = message.getData();
        String room = data.get("roomId"), username = data.get("senderUsername"), id = data.get("nudgeId");
        boolean invitation = "invite".equals(data.get("kind"));
        String url = FocusPush.roomUrl(room);
        if (url == null || username == null || !username.matches("[a-z0-9_]{3,24}")) return;
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return;
        if (!NotificationManagerCompat.from(this).areNotificationsEnabled()) return;
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager == null || manager.getNotificationChannel(FocusPush.CHANNEL).getImportance() == NotificationManager.IMPORTANCE_NONE) return;
        if (!FocusPush.rememberNudge(this, id)) return;
        Intent open = new Intent(this, MainActivity.class).setData(Uri.parse(url)).putExtra("roomId", room)
            .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent click = PendingIntent.getActivity(this, room.hashCode(), open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        manager.notify(id, 2, new NotificationCompat.Builder(this, FocusPush.CHANNEL)
            .setSmallIcon(R.drawable.notification_icon).setContentTitle("@" + username + (invitation ? " seni odaya davet etti!" : " seni dürttü!"))
            .setContentText(invitation ? "Oda davetini görmek için dokun." : "Çalışma odana dönmek için dokun.").setContentIntent(click).setAutoCancel(true)
            .setSilent(!invitation && FocusPush.foregroundReceives(room))
            .setCategory(NotificationCompat.CATEGORY_SOCIAL).build());
    }
}

