package com.anwar.mofakira

import android.app.Activity
import android.content.Intent
import android.os.Bundle

/**
 * The app opens the complete original Anwar PWA in one packaged WebView shell.
 * Native Android services (including scheduled adhan) remain attached through
 * LegacyWebActivity's origin-restricted bridge.
 */
class MainActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        startActivity(Intent(this, LegacyWebActivity::class.java))
        finish()
    }
}
