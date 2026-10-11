package io.github.focusforyou.app;

public final class FocusApplication extends android.app.Application {
    @Override public void onCreate() {
        super.onCreate();
        // Also runs when FCM wakes a process with no Activity or WebView.
        FocusPush.initialize(this);
    }
}
