package de.dbttagebuch.app;

import android.content.Context;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.webkit.WebView;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Öffnet den Android-Druckdialog für die aktuelle Ansicht (PDF-Bericht).
 * Dort kann man „Als PDF speichern“ wählen. Kein Netzwerk, keine Berechtigungen.
 */
@CapacitorPlugin(name = "Drucken")
public class DruckPlugin extends Plugin {
    @PluginMethod
    public void drucken(PluginCall call) {
        String name = call.getString("name", "Diary-Card");
        getActivity().runOnUiThread(() -> {
            WebView webView = getBridge().getWebView();
            PrintManager pm = (PrintManager) getActivity().getSystemService(Context.PRINT_SERVICE);
            PrintDocumentAdapter adapter = webView.createPrintDocumentAdapter(name);
            PrintAttributes attrs = new PrintAttributes.Builder()
                .setMediaSize(PrintAttributes.MediaSize.ISO_A4.asLandscape())
                .build();
            pm.print(name, adapter, attrs);
            call.resolve();
        });
    }
}
