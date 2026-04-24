package com.pinnacle.billing

import android.os.Bundle
import com.getcapacitor.BridgeActivity

class MainActivity : BridgeActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        registerPlugin(AppHttpPlugin::class.java)
        super.onCreate(savedInstanceState)
    }
}
