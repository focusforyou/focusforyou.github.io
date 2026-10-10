package io.github.focusforyou.app;
import android.app.Activity;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.app.AlertDialog;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.view.WindowInsets;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.ValueCallback;
import android.webkit.JavascriptInterface;
import java.io.OutputStream;
import java.io.File;
import android.provider.MediaStore;
import android.content.ClipData;
import androidx.core.content.FileProvider;
import java.nio.charset.StandardCharsets;
import android.widget.FrameLayout;
import androidx.credentials.*;
import androidx.credentials.exceptions.*;
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption;
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential;
import android.os.CancellationSignal;
import org.json.JSONObject;
public class MainActivity extends Activity {
    private static final String HOME = "https://focusforyou.github.io/";
    private WebView web;
    private SensorManager skySensors;
    private Sensor skySensor;
    private boolean motionRequested=false;
    private long lastMotion=0;
    private final float[] gravity=new float[3];
    private final SensorEventListener skyListener=new SensorEventListener(){
        public void onAccuracyChanged(Sensor sensor,int accuracy){}
        public void onSensorChanged(SensorEvent event){
            if(!resumed||!motionRequested||!trustedPage())return;
            for(int i=0;i<3;i++)gravity[i]=event.sensor.getType()==Sensor.TYPE_ACCELEROMETER?.85f*gravity[i]+.15f*event.values[i]:event.values[i];
            if(event.timestamp-lastMotion<50000000L)return;lastMotion=event.timestamp;
            double beta=Math.toDegrees(Math.atan2(-gravity[1],gravity[2])),gamma=Math.toDegrees(Math.atan2(gravity[0],Math.hypot(gravity[1],gravity[2])));
            if(!Double.isFinite(beta)||!Double.isFinite(gamma))return;
            int angle=getWindowManager().getDefaultDisplay().getRotation()*90;
            web.evaluateJavascript("window.FocusMotion?.receive("+beta+","+gamma+","+angle+")",null);
        }
    };
    private void updateMotion(){if(skySensors==null)return;skySensors.unregisterListener(skyListener);lastMotion=0;java.util.Arrays.fill(gravity,0);if(resumed&&motionRequested&&trustedPage()&&skySensor!=null)skySensors.registerListener(skyListener,skySensor,SensorManager.SENSOR_DELAY_UI);}
    private boolean errorShown = false;
    private ValueCallback<Uri[]> fileCallback;
    private String backup;
    private Uri cameraUri;
    private File cameraFile;
    private boolean resumed=false,notificationAsked=false,keepSession=false;
    private String sessionState="";
    private CancellationSignal signInCancellation;
    private boolean signingIn=false;
    private static final String GOOGLE_CLIENT="718275780283-9clat2fbif7idmrh7ddm06vlg1m2rmlo.apps.googleusercontent.com";
    private void googleResult(String token,String error){runOnUiThread(()->{signingIn=false;signInCancellation=null;if(trustedPage())web.evaluateJavascript("window.FocusGoogleResult?.("+JSONObject.quote(token)+","+JSONObject.quote(error)+")",null);});}
    private boolean trustedPage(){if(web==null||web.getUrl()==null)return false;Uri u=Uri.parse(web.getUrl());return "https".equals(u.getScheme())&&"focusforyou.github.io".equals(u.getHost());}
    private void nativeTick(){if(trustedPage())web.evaluateJavascript("window.FocusNative?.heartbeat()",null);}
    private void nativeToggle(){if(trustedPage())web.evaluateJavascript("window.FocusNative?.toggle()",null);}
    private void chooseFile(WebChromeClient.FileChooserParams params) {
        boolean image=false;for(String type:params.getAcceptTypes())if(type!=null&&type.startsWith("image/"))image=true;
        Intent pick=new Intent(Intent.ACTION_OPEN_DOCUMENT);pick.addCategory(Intent.CATEGORY_OPENABLE);pick.setType(image?"image/*":"application/json");
        if(image&&android.os.Build.VERSION.SDK_INT>=33){pick=new Intent(MediaStore.ACTION_PICK_IMAGES);pick.setType("image/*");}
        final Intent picker=pick;
        if(image&&params.isCaptureEnabled()) {
            try {
                Intent capture=new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
                if(capture.resolveActivity(getPackageManager())==null)throw new IllegalStateException("No camera app");
                File directory=new File(getCacheDir(),"photos");if(!directory.exists()&&!directory.mkdirs())throw new IllegalStateException("No photo directory");
                if(cameraFile!=null)cameraFile.delete();
                cameraFile=File.createTempFile("focus-", ".jpg",directory);
                cameraUri=FileProvider.getUriForFile(this,getPackageName()+".photos",cameraFile);
                capture.putExtra(MediaStore.EXTRA_OUTPUT,cameraUri);capture.setClipData(ClipData.newRawUri("photo",cameraUri));
                capture.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION|Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
                startActivityForResult(capture,103);return;
            } catch(Exception ignored) {
                cameraUri=null;
                new AlertDialog.Builder(this).setMessage("Kamera açılamadı. Galeriden bir fotoğraf seçebilirsin.").setPositiveButton("Galeri",(dialog,which)->{
                    try{startActivityForResult(picker,101);}catch(Exception error){if(fileCallback!=null)fileCallback.onReceiveValue(null);fileCallback=null;}
                }).setNegativeButton("İptal",(dialog,which)->{if(fileCallback!=null)fileCallback.onReceiveValue(null);fileCallback=null;}).setOnCancelListener(dialog->{if(fileCallback!=null)fileCallback.onReceiveValue(null);fileCallback=null;}).show();return;
            }
        }
        try{startActivityForResult(pick,101);}catch(Exception ignored){if(fileCallback!=null)fileCallback.onReceiveValue(null);fileCallback=null;}
    }
    public class BackupBridge {
        @JavascriptInterface public void motion(boolean enabled){runOnUiThread(()->{if(!trustedPage())return;motionRequested=enabled;updateMotion();});}
        @JavascriptInterface public void googleSignIn(String clientId){
            runOnUiThread(()->{
                if(!trustedPage()||!resumed||signingIn||!GOOGLE_CLIENT.equals(clientId))return;
                signingIn=true;signInCancellation=new CancellationSignal();
                GetSignInWithGoogleOption option=new GetSignInWithGoogleOption.Builder(GOOGLE_CLIENT).build();
                GetCredentialRequest request=new GetCredentialRequest.Builder().addCredentialOption(option).build();
                try{CredentialManager.create(MainActivity.this).getCredentialAsync(MainActivity.this,request,signInCancellation,Runnable::run,
                    new CredentialManagerCallback<GetCredentialResponse,GetCredentialException>(){
                        @Override public void onResult(GetCredentialResponse result){try{if(!(result.getCredential() instanceof CustomCredential))throw new IllegalArgumentException();GoogleIdTokenCredential token=GoogleIdTokenCredential.createFrom(result.getCredential().getData());googleResult(token.getIdToken(),"");}catch(Exception ignored){googleResult("","Google giriş sonucu okunamadı. Tekrar dene.");}}
                        @Override public void onError(GetCredentialException error){googleResult("",error instanceof GetCredentialCancellationException?"Google girişi iptal edildi.":"Google girişi açılamadı. Google Play Hizmetlerini güncelle veya e-postayla giriş yap.");}
                    });}catch(Exception ignored){googleResult("","Google girişi açılamadı. E-postayla giriş yapabilirsin.");}
            });
        }
        @JavascriptInterface public void clearGoogleSession(){runOnUiThread(()->{if(!trustedPage())return;CredentialManager.create(MainActivity.this).clearCredentialStateAsync(new ClearCredentialStateRequest(),null,Runnable::run,new CredentialManagerCallback<Void,ClearCredentialException>(){public void onResult(Void result){}public void onError(ClearCredentialException error){}});});}
        @JavascriptInterface public void session(boolean active,boolean running,boolean rest,long deadline,long remaining,String room) {
            final String code=room!=null&&room.matches("[1-9][0-9]{4}")?room:"";
            runOnUiThread(()->{
                if(!trustedPage())return;
                keepSession=active;
                String state=active+":"+running+":"+rest+":"+(deadline/1000)+":"+(running?0:remaining)+":"+code;
                if(state.equals(sessionState))return;
                if(!active){sessionState=state;stopService(new Intent(MainActivity.this,FocusService.class));return;}
                if(!resumed&&!FocusService.active)return;
                if(android.os.Build.VERSION.SDK_INT>=33&&resumed&&!notificationAsked&&checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS)!=android.content.pm.PackageManager.PERMISSION_GRANTED){notificationAsked=true;requestPermissions(new String[]{android.Manifest.permission.POST_NOTIFICATIONS},201);}
                Intent intent=new Intent(MainActivity.this,FocusService.class).putExtra("active",active).putExtra("running",running).putExtra("break",rest).putExtra("deadline",deadline).putExtra("remaining",Math.max(0,Math.min(10800,remaining))).putExtra("room",code);
                try{startForegroundService(intent);sessionState=state;}catch(IllegalStateException|SecurityException ignored){sessionState="";}
            });
        }
        @JavascriptInterface public void saveBackup(String value) {
            if(value==null || value.length()>1000000) return;
            runOnUiThread(()->{
                if(backup!=null)return;
                backup=value;
                Intent intent=new Intent(Intent.ACTION_CREATE_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);intent.setType("application/json");
                intent.putExtra(Intent.EXTRA_TITLE,"focus-yedek.json");
                try {startActivityForResult(intent,102);}catch(Exception ignored){backup=null;}
            });
        }
    }
    @Override public void onCreate(Bundle saved) {
        super.onCreate(saved);
        skySensors=(SensorManager)getSystemService(SENSOR_SERVICE);if(skySensors!=null){skySensor=skySensors.getDefaultSensor(Sensor.TYPE_GRAVITY);if(skySensor==null)skySensor=skySensors.getDefaultSensor(Sensor.TYPE_ACCELEROMETER);}
        File photoDirectory=new File(getCacheDir(),"photos");File[] oldPhotos=photoDirectory.listFiles();if(oldPhotos!=null)for(File photo:oldPhotos)if(System.currentTimeMillis()-photo.lastModified()>86400000)photo.delete();
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.rgb(10,17,40));
        setContentView(root);
        root.setOnApplyWindowInsetsListener((v,insets) -> {
            int left,top,right,bottom;
            if (android.os.Build.VERSION.SDK_INT >= 30) {
                android.graphics.Insets bars=insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout() | WindowInsets.Type.ime());
                left=bars.left;top=bars.top;right=bars.right;bottom=bars.bottom;
            } else {
                left=insets.getSystemWindowInsetLeft();top=insets.getSystemWindowInsetTop();
                right=insets.getSystemWindowInsetRight();bottom=insets.getSystemWindowInsetBottom();
            }
            v.setPadding(left,top,right,bottom);
            return insets;
        });
        root.requestApplyInsets();
        web = new WebView(this);
        FocusService.heartbeat=this::nativeTick;FocusService.toggle=this::nativeToggle;
        root.addView(web,new FrameLayout.LayoutParams(-1,-1));
        web.setBackgroundColor(Color.rgb(10,17,40));
        if (getPreferences(MODE_PRIVATE).getInt("tap_ui_revision",0)<1) {
            web.clearCache(true);
            getPreferences(MODE_PRIVATE).edit().putInt("tap_ui_revision",1).apply();
        }
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setMediaPlaybackRequiresUserGesture(true);
        settings.setUserAgentString(settings.getUserAgentString()+" FocusForYou/1");
        web.addJavascriptInterface(new BackupBridge(),"FocusAndroid");
        web.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onShowFileChooser(WebView view,ValueCallback<Uri[]> callback,FileChooserParams params) {
                if(fileCallback!=null)fileCallback.onReceiveValue(null);
                fileCallback=callback;
                chooseFile(params);
                return true;
            }
        });
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                if (!request.isForMainFrame()) return false;
                Uri uri=request.getUrl();
                if ("https".equals(uri.getScheme()) && "focusforyou.github.io".equals(uri.getHost())) return false;
                if ("mailto".equals(uri.getScheme())) {
                    try { startActivity(new Intent(Intent.ACTION_SENDTO,uri)); }
                    catch (Exception ignored) { new AlertDialog.Builder(MainActivity.this).setTitle("E-posta uygulaması bulunamadı").setMessage("Talebini kullandığın e-posta hizmetinden t1orstudios@proton.me adresine gönderebilirsin.").setPositiveButton("Tamam",null).show(); }
                    return true;
                }
                if ("https".equals(uri.getScheme()) || "http".equals(uri.getScheme()) || "obtainium".equals(uri.getScheme())) {
                    try { startActivity(new Intent(Intent.ACTION_VIEW,uri)); } catch (Exception ignored) { }
                }
                return true;
            }
            @Override public void onPageStarted(WebView view,String url,android.graphics.Bitmap icon) { errorShown=false;motionRequested=false;updateMotion(); }
            @Override public void onPageFinished(WebView view,String url) {
                super.onPageFinished(view,url);
                Uri uri=Uri.parse(url);
                if (!"https".equals(uri.getScheme()) || !"focusforyou.github.io".equals(uri.getHost())) return;
                view.evaluateJavascript("(function(){var s=document.getElementById('focus-native-tap-style');if(!s){s=document.createElement('style');s.id='focus-native-tap-style';document.head.appendChild(s);}s.textContent='*{-webkit-tap-highlight-color:transparent !important}';})()",null);
            }
            @Override public void onReceivedError(WebView view,WebResourceRequest request,WebResourceError error) {
                if (!request.isForMainFrame() || errorShown || isFinishing()) return;
                errorShown=true;
                new AlertDialog.Builder(MainActivity.this).setTitle("Bağlantı kurulamadı")
                    .setMessage("İnternet bağlantını kontrol edip tekrar dene.")
                    .setPositiveButton("Tekrar dene",(dialog,which)->web.loadUrl(HOME))
                    .setNegativeButton("Kapat",null).show();
            }
        });
        if (saved==null || web.restoreState(saved)==null) web.loadUrl(HOME);
    }
    @Override public void onBackPressed() { if(web.canGoBack())web.goBack();else if(keepSession||FocusService.active)moveTaskToBack(true);else super.onBackPressed(); }
    @Override protected void onActivityResult(int request,int result,Intent data) {
        super.onActivityResult(request,result,data);
        if(request==101&&fileCallback!=null){fileCallback.onReceiveValue(result==RESULT_OK&&data!=null&&data.getData()!=null?new Uri[]{data.getData()}:null);fileCallback=null;}
        if(request==103){if(fileCallback!=null){fileCallback.onReceiveValue(result==RESULT_OK&&cameraUri!=null&&cameraFile!=null&&cameraFile.length()>0?new Uri[]{cameraUri}:null);fileCallback=null;}cameraUri=null;}
        if(request==102&&backup!=null){
            if(result==RESULT_OK&&data!=null&&data.getData()!=null){
                try(OutputStream out=getContentResolver().openOutputStream(data.getData())){if(out!=null)out.write(backup.getBytes(StandardCharsets.UTF_8));}catch(Exception ignored){new AlertDialog.Builder(this).setMessage("Yedek kaydedilemedi. Tekrar dene.").setPositiveButton("Tamam",null).show();}
            }backup=null;
        }
    }
    @Override protected void onSaveInstanceState(Bundle out) { web.saveState(out);super.onSaveInstanceState(out); }
    @Override protected void onPause() { resumed=false;updateMotion();if(!keepSession&&!FocusService.active)web.onPause();super.onPause(); }
    @Override protected void onResume() { super.onResume();resumed=true;updateMotion();if(web!=null){web.onResume();nativeTick();} }
    @Override protected void onDestroy() { resumed=false;updateMotion();if(signInCancellation!=null)signInCancellation.cancel();stopService(new Intent(this,FocusService.class));FocusService.heartbeat=null;FocusService.toggle=null;if(web!=null){if(trustedPage())web.evaluateJavascript("typeof flush==='function'&&flush()",null);((FrameLayout)web.getParent()).removeView(web);web.destroy();}super.onDestroy(); }
}

