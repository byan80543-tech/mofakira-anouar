package com.anwar.mofakira

import android.app.Activity
import android.content.Intent
import android.os.Bundle

/**
 * Launch the gradually migrated native Android notebook.
 * The complete original web experience remains available from the services gateway.
 */
class MainActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        startActivity(Intent(this, NativeNotebookActivity::class.java))
        finish()
    }
}
