package ir.datagraphlist.app;

import android.app.*;
import androidx.activity.ComponentActivity;
import androidx.activity.OnBackPressedCallback;
import android.os.Bundle;
import android.content.*;
import android.net.Uri;
import android.print.*;
import android.webkit.*;
import android.view.View;
import android.widget.Toast;
import android.util.Base64;
import androidx.core.splashscreen.SplashScreen;
import androidx.webkit.*;
import java.util.Set;
import java.io.OutputStream;

public class MainActivity extends ComponentActivity {
    private WebView web;
    private ValueCallback<Uri[]> fileCallback;
    private byte[] pendingExport;
    private static boolean trusted(Uri u) {
        return "https".equals(u.getScheme()) && ("datagraphlist.ir".equals(u.getHost()) || "www.datagraphlist.ir".equals(u.getHost()));
    }
    @Override public void onCreate(Bundle state) {
        SplashScreen.installSplashScreen(this);
        super.onCreate(state);
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override public void handleOnBackPressed() { if (web != null && web.canGoBack()) web.goBack(); else finish(); }
        });
        web = new WebView(this);
        setContentView(web);
        web.setOnApplyWindowInsetsListener((v, insets) -> { v.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(), insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom()); return insets; });
        web.requestApplyInsets();
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true); s.setDomStorageEnabled(true);
        s.setAllowFileAccess(false); s.setAllowContentAccess(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        s.setSupportMultipleWindows(false);
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
                Uri u = r.getUrl();
                if (trusted(u)) return false;
                String scheme = u.getScheme();
                if (Set.of("tel", "mailto", "https").contains(scheme == null ? "" : scheme)) external(u);
                return true;
            }
            @Override public void onPageFinished(WebView v, String url) {
                if (!trusted(Uri.parse(url))) return;
                // This bridge is registered ONLY for the two HTTPS production origins.
                v.evaluateJavascript("if(window.DatagraphNative){window.print=function(){window.dispatchEvent(new Event('beforeprint'));window.DatagraphNative.postMessage('print:'+ (document.documentElement.dataset.paper||'A5'));setTimeout(function(){window.dispatchEvent(new Event('afterprint'))},2000)};document.addEventListener('click',function(e){var a=e.target.closest('a');if(a&&a.href.startsWith('data:image/png;base64,')){e.preventDefault();window.DatagraphNative.postMessage(a.href)}},true)}", null);
            }
            @Override public void onReceivedError(WebView v, WebResourceRequest r, WebResourceError e) {
                if (r.isForMainFrame()) Toast.makeText(MainActivity.this, "اتصال اینترنت را بررسی کنید و دوباره برنامه را باز کنید.", Toast.LENGTH_LONG).show();
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onShowFileChooser(WebView v, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("*/*");
                startActivityForResult(i, 10); return true;
            }
        });
        if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
            WebViewCompat.addWebMessageListener(web, "DatagraphNative", Set.of("https://datagraphlist.ir", "https://www.datagraphlist.ir"), (view, message, origin, mainFrame, reply) -> {
                if (!mainFrame || !trusted(origin)) return;
                String data = message.getData();
                if ("print:A5".equals(data) || "print:A4".equals(data)) {
                    PrintManager pm = (PrintManager)getSystemService(PRINT_SERVICE);
                    pm.print("Datagraphlist", web.createPrintDocumentAdapter("Datagraphlist"), new PrintAttributes.Builder().setMediaSize("print:A4".equals(data) ? PrintAttributes.MediaSize.ISO_A4 : PrintAttributes.MediaSize.ISO_A5).build());
                } else if (data != null && data.startsWith("data:image/png;base64,") && data.length() < 35000000 && pendingExport == null) {
                    try {
                        pendingExport = Base64.decode(data.substring(data.indexOf(',')+1), Base64.DEFAULT);
                        startActivityForResult(new Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("image/png").putExtra(Intent.EXTRA_TITLE, "Datagraphlist-invoice.png"), 11);
                    } catch (IllegalArgumentException e) { pendingExport = null; }
                }
            });
        }
        web.setDownloadListener((url, ua, disposition, mime, length) -> { if (url.startsWith("https://")) external(Uri.parse(url)); });
        Uri deep = getIntent().getData();
        web.loadUrl(deep != null && trusted(deep) ? deep.toString() : "https://datagraphlist.ir/");
    }
    private void external(Uri uri) {
        try { startActivity(new Intent("tel".equals(uri.getScheme()) ? Intent.ACTION_DIAL : Intent.ACTION_VIEW, uri).addCategory(Intent.CATEGORY_BROWSABLE)); }
        catch (ActivityNotFoundException e) { Toast.makeText(this, "برنامه مناسب نصب نشده است", Toast.LENGTH_SHORT).show(); }
    }
    @Override protected void onActivityResult(int request, int result, Intent data) {
        super.onActivityResult(request, result, data);
        if (request == 10 && fileCallback != null) { fileCallback.onReceiveValue(result == RESULT_OK && data != null && data.getData() != null ? new Uri[]{data.getData()} : null); fileCallback = null; }
        if (request == 11 && pendingExport != null) {
            if (result == RESULT_OK && data != null && data.getData() != null) {
                try (OutputStream out = getContentResolver().openOutputStream(data.getData())) { if (out != null) out.write(pendingExport); }
                catch (Exception e) { Toast.makeText(this, "ذخیره تصویر ناموفق بود", Toast.LENGTH_SHORT).show(); }
            }
            pendingExport = null;
        }
    }
    @Override protected void onDestroy() { web.destroy(); super.onDestroy(); }
}
