package com.pjneha66.boxofficewar;

import android.content.Context;
import android.content.SharedPreferences;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(android.os.Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    // App data (including the WebView's HTTP cache) survives an APK update,
    // and the bundled assets carry a fixed Last-Modified so the WebView treats
    // cached copies as fresh forever. Drop the whole cache whenever the
    // version changes so a new APK always renders its own code.
    try {
      SharedPreferences prefs = getSharedPreferences("bow_app", Context.MODE_PRIVATE);
      String seen = prefs.getString("ver", "");
      String cur = getPackageManager().getPackageInfo(getPackageName(), 0).versionName;
      if (!cur.equals(seen)) {
        prefs.edit().putString("ver", cur).apply();
        if (bridge != null && bridge.getWebView() != null) {
          bridge.getWebView().clearCache(true);
        }
      }
    } catch (Exception e) {
      // never block startup over cache hygiene
    }
  }
}
