import fs from 'node:fs';
import path from 'node:path';
import { Resvg } from '@resvg/resvg-js';

const root = 'android/app/src/main/res';
const png = fs.readFileSync('public/icon.png').toString('base64');
const image = (x, y, size) => `<image x="${x}" y="${y}" width="${size}" height="${size}" preserveAspectRatio="xMidYMid meet" href="data:image/png;base64,${png}"/>`;
const svg = (content) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${content}</svg>`;
const render = (content, width) => new Resvg(svg(content), { fitTo: { mode: 'width', value: width } }).render().asPng();
for (const [density, icon, foreground] of [['mdpi', 48, 108], ['hdpi', 72, 162], ['xhdpi', 96, 216], ['xxhdpi', 144, 324], ['xxxhdpi', 192, 432]]) {
  const dir = path.join(root, `mipmap-${density}`);
  fs.writeFileSync(path.join(dir, 'ic_launcher.png'), render(image(0, 0, 512), icon));
  fs.writeFileSync(path.join(dir, 'ic_launcher_round.png'), render(image(0, 0, 512), icon));
  fs.writeFileSync(path.join(dir, 'ic_launcher_foreground.png'), render(image(86, 86, 340), foreground));
}
fs.writeFileSync(path.join(root, 'values/ic_launcher_background.xml'), '<?xml version="1.0" encoding="utf-8"?><resources><color name="ic_launcher_background">#075a68</color><color name="report_start_background">#b7e23e</color></resources>');
const splash = `<rect width="512" height="512" fill="#b7e23e"/>${image(160, 160, 192)}`;
for (const dir of fs.readdirSync(root).filter((name) => name.startsWith('drawable'))) {
  const file = path.join(root, dir, 'splash.png');
  if (fs.existsSync(file)) fs.writeFileSync(file, render(splash, 1080));
}
// Match Android's launch window and WebView to the app while the web bundle starts.
const styles = path.join(root, 'values/styles.xml');
let xml = fs.readFileSync(styles, 'utf8');
if (!xml.includes('<item name="android:windowBackground">@color/report_start_background</item>')) {
  xml = xml.replace('<item name="android:background">@null</item>', '<item name="android:background">@null</item>\n        <item name="android:windowBackground">@color/report_start_background</item>');
}
xml = xml.replace('<item name="android:background">@drawable/splash</item>', '<item name="windowSplashScreenBackground">@color/report_start_background</item>\n        <item name="windowSplashScreenAnimatedIcon">@mipmap/ic_launcher</item>\n        <item name="postSplashScreenTheme">@style/AppTheme.NoActionBar</item>');
if (!xml.includes('windowSplashScreenAnimatedIcon') || !xml.includes('android:windowBackground')) throw new Error('Unexpected Capacitor Android styles; could not configure launch theme.');
fs.writeFileSync(styles, xml);
const activity = 'android/app/src/main/java/dev/dandelion/store/MainActivity.java';
fs.writeFileSync(activity, `package dev.dandelion.store;

import android.graphics.Color;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().setBackgroundColor(Color.rgb(183, 226, 62));
        }
    }
}
`);
console.log('Prepared Re:Port Android icon, launch theme and WebView background.');
