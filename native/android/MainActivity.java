package de.dbttagebuch.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(DruckPlugin.class); // eigener Baustein: Druckdialog für den PDF-Bericht
        super.onCreate(savedInstanceState);
    }
}
