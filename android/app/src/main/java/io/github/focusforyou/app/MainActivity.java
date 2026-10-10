package io.github.focusforyou.app;
import android.app.Activity;
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
import java.nio.charset.StandardCharsets;
import android.widget.FrameLayout;
public class MainActivity extends Activity {
    private static final String HOME = "https://focusforyou.github.io/";
    private WebView web;
    private boolean errorShown = false;
    private ValueCallback<Uri[]> fileCallback;
    private String backup;
    public class BackupBridge {
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
        root.addView(web,new FrameLayout.LayoutParams(-1,-1));
        web.setBackgroundColor(Color.rgb(10,17,40));
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
                Intent intent=new Intent(Intent.ACTION_OPEN_DOCUMENT);intent.addCategory(Intent.CATEGORY_OPENABLE);intent.setType("application/json");
                try {startActivityForResult(intent,101);}catch(Exception ignored){fileCallback.onReceiveValue(null);fileCallback=null;}
                return true;
            }
        });
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                if (!request.isForMainFrame()) return false;
                Uri uri=request.getUrl();
                if ("https".equals(uri.getScheme()) && "focusforyou.github.io".equals(uri.getHost())) return false;
                if ("https".equals(uri.getScheme()) || "http".equals(uri.getScheme()) || "obtainium".equals(uri.getScheme())) {
                    try { startActivity(new Intent(Intent.ACTION_VIEW,uri)); } catch (Exception ignored) { }
                }
                return true;
            }
            @Override public void onPageStarted(WebView view,String url,android.graphics.Bitmap icon) { errorShown=false; }
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
    @Override public void onBackPressed() { if(web.canGoBack())web.goBack();else super.onBackPressed(); }
    @Override protected void onActivityResult(int request,int result,Intent data) {
        super.onActivityResult(request,result,data);
        if(request==101&&fileCallback!=null){fileCallback.onReceiveValue(result==RESULT_OK&&data!=null&&data.getData()!=null?new Uri[]{data.getData()}:null);fileCallback=null;}
        if(request==102&&backup!=null){
            if(result==RESULT_OK&&data!=null&&data.getData()!=null){
                try(OutputStream out=getContentResolver().openOutputStream(data.getData())){if(out!=null)out.write(backup.getBytes(StandardCharsets.UTF_8));}catch(Exception ignored){new AlertDialog.Builder(this).setMessage("Yedek kaydedilemedi. Tekrar dene.").setPositiveButton("Tamam",null).show();}
            }backup=null;
        }
    }
    @Override protected void onSaveInstanceState(Bundle out) { web.saveState(out);super.onSaveInstanceState(out); }
    @Override protected void onPause() { web.onPause();super.onPause(); }
    @Override protected void onResume() { super.onResume();if(web!=null)web.onResume(); }
    @Override protected void onDestroy() { if(web!=null){((FrameLayout)web.getParent()).removeView(web);web.destroy();}super.onDestroy(); }
}

