package com.anwar.mofakira

import android.app.Activity
import android.content.Intent
import android.os.Bundle

/** Launch the original Anwar notebook as the first screen. */
class MainActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        startActivity(Intent(this, NativeNotebookActivity::class.java))
        finish()
    }
}
