package com.anouar.mofakira

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.union
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.anouar.mofakira.data.Note
import com.anouar.mofakira.data.NoteDao
import com.anouar.mofakira.data.NotesDatabase
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.FlowPreview
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.collect
import kotlinx.coroutines.flow.debounce
import kotlinx.coroutines.flow.drop
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

private val Petal = Color(0xFF80558F)
private val Canvas = Color(0xFFFBF8FC)
private val Ink = Color(0xFF302638)
private val MutedInk = Color(0xFF756B79)

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val dao = NotesDatabase.get(applicationContext).noteDao()
        setContent {
            CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Rtl) {
                MaterialTheme(
                    colorScheme = lightColorScheme(
                        primary = Petal,
                        onPrimary = Color.White,
                        secondary = Petal,
                        background = Canvas,
                        surface = Color.White,
                        onSurface = Ink
                    )
                ) {
                    NotesApp(dao = dao)
                }
            }
        }
    }
}

@Composable
private fun NotesApp(dao: NoteDao) {
    var query by remember { mutableStateOf("") }
    var selectedNote by remember { mutableStateOf<Note?>(null) }
    var selectedIsDraft by remember { mutableStateOf(false) }
    val notesFlow: Flow<List<Note>> = remember(query) { dao.search(query.trim()) }
    val notes by notesFlow.collectAsState(initial = emptyList())

    if (selectedNote != null) {
        EditorScreen(
            note = selectedNote!!,
            isDraft = selectedIsDraft,
            persistNote = { note ->
                val saved = note.copy(updatedAt = System.currentTimeMillis())
                if (saved.id == 0L) {
                    val id = withContext(Dispatchers.IO) { dao.insert(saved) }
                    saved.copy(id = id)
                } else {
                    withContext(Dispatchers.IO) { dao.update(saved) }
                    saved
                }
            },
            deleteNote = { note -> withContext(Dispatchers.IO) { dao.delete(note) } },
            onExit = { selectedNote = null }
        )
    } else {
        NotesListScreen(
            query = query,
            onQueryChange = { query = it },
            notes = notes,
            onCreate = {
                selectedNote = Note()
                selectedIsDraft = true
            },
            onOpen = { note ->
                selectedNote = note
                selectedIsDraft = false
            }
        )
    }
}

@Composable
private fun NotesListScreen(
    query: String,
    onQueryChange: (String) -> Unit,
    notes: List<Note>,
    onCreate: () -> Unit,
    onOpen: (Note) -> Unit
) {
    Scaffold(
        containerColor = Canvas,
        contentWindowInsets = WindowInsets.statusBars.union(WindowInsets.navigationBars)
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(horizontal = 20.dp, vertical = 14.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text("مفكرة أنوار", fontSize = 28.sp, fontWeight = FontWeight.Bold, color = Ink)
                    Text("مساحة هادئة لأفكارك", fontSize = 14.sp, color = Petal)
                }
                Text("🌷", fontSize = 34.sp)
            }

            Spacer(Modifier.height(20.dp))
            OutlinedTextField(
                value = query,
                onValueChange = onQueryChange,
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                placeholder = { Text("ابحث في ملاحظاتك") },
                leadingIcon = { Icon(Icons.Default.Search, contentDescription = "بحث") },
                shape = RoundedCornerShape(18.dp)
            )
            Spacer(Modifier.height(16.dp))

            if (notes.isEmpty()) {
                Box(
                    modifier = Modifier.weight(1f).fillMaxWidth(),
                    contentAlignment = Alignment.Center
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text("🌷", fontSize = 48.sp)
                        Spacer(Modifier.height(8.dp))
                        Text(
                            if (query.isBlank()) "ابدأ بكتابة ملاحظتك الأولى" else "لا توجد نتائج مطابقة",
                            color = MutedInk
                        )
                    }
                }
            } else {
                LazyColumn(
                    modifier = Modifier.weight(1f),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    items(notes, key = { it.id }) { note ->
                        NoteCard(note = note, onClick = { onOpen(note) })
                    }
                }
            }

            Spacer(Modifier.height(12.dp))
            Button(
                onClick = onCreate,
                modifier = Modifier.fillMaxWidth().height(52.dp),
                shape = RoundedCornerShape(16.dp)
            ) {
                Icon(Icons.Default.Add, contentDescription = null)
                Text("ملاحظة جديدة", modifier = Modifier.padding(start = 8.dp))
            }
        }
    }
}

@Composable
private fun NoteCard(note: Note, onClick: () -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth().clickable(onClick = onClick),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        shape = RoundedCornerShape(18.dp),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Column(Modifier.padding(16.dp)) {
            Text(
                note.title.ifBlank { "ملاحظة بلا عنوان" },
                fontWeight = FontWeight.Bold,
                color = Ink,
                fontSize = 16.sp,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
            if (note.body.isNotBlank()) {
                Spacer(Modifier.height(6.dp))
                Text(note.body, color = MutedInk, maxLines = 2, overflow = TextOverflow.Ellipsis)
            }
            Spacer(Modifier.height(8.dp))
            Text(formatDate(note.updatedAt), color = Petal, fontSize = 11.sp)
        }
    }
}

private enum class SaveState { READY, SAVING, SAVED, FAILED }

@OptIn(FlowPreview::class)
@Composable
private fun EditorScreen(
    note: Note,
    isDraft: Boolean,
    persistNote: suspend (Note) -> Note,
    deleteNote: suspend (Note) -> Unit,
    onExit: () -> Unit
) {
    var title by remember(note.id) { mutableStateOf(note.title) }
    var body by remember(note.id) { mutableStateOf(note.body) }
    var workingNote by remember(note.id) { mutableStateOf(note) }
    var draft by remember(note.id) { mutableStateOf(isDraft) }
    var lastSavedTitle by remember(note.id) { mutableStateOf(note.title) }
    var lastSavedBody by remember(note.id) { mutableStateOf(note.body) }
    var saveState by remember(note.id) {
        mutableStateOf(if (isDraft) SaveState.READY else SaveState.SAVED)
    }
    var showDeleteConfirmation by remember(note.id) { mutableStateOf(false) }

    val scope = rememberCoroutineScope()
    val saveMutex = remember(note.id) { Mutex() }
    val latestPersist by rememberUpdatedState(persistNote)
    val latestDelete by rememberUpdatedState(deleteNote)
    val latestExit by rememberUpdatedState(onExit)

    suspend fun saveCurrent(): Boolean = saveMutex.withLock {
        val hasContent = title.isNotBlank() || body.isNotBlank()
        if (draft && !hasContent) return@withLock true
        if (title == lastSavedTitle && body == lastSavedBody) return@withLock true

        saveState = SaveState.SAVING
        try {
            val saved = latestPersist(
                workingNote.copy(
                    title = title,
                    body = body,
                    updatedAt = System.currentTimeMillis()
                )
            )
            workingNote = saved
            draft = false
            lastSavedTitle = title
            lastSavedBody = body
            saveState = SaveState.SAVED
            true
        } catch (_: Exception) {
            saveState = SaveState.FAILED
            false
        }
    }

    suspend fun saveThenExit() {
        if (saveCurrent()) latestExit()
    }

    BackHandler {
        scope.launch { saveThenExit() }
    }

    LaunchedEffect(note.id) {
        snapshotFlow { title to body }
            .drop(1)
            .debounce(550)
            .collect {
                saveCurrent()
            }
    }

    if (showDeleteConfirmation) {
        AlertDialog(
            onDismissRequest = { showDeleteConfirmation = false },
            title = { Text("حذف الملاحظة؟") },
            text = { Text("لن تتمكن من استعادتها بعد الحذف.") },
            confirmButton = {
                TextButton(onClick = {
                    scope.launch {
                        latestDelete(workingNote)
                        latestExit()
                    }
                }) {
                    Text("حذف", color = Color(0xFFB34D61))
                }
            },
            dismissButton = {
                TextButton(onClick = { showDeleteConfirmation = false }) { Text("إلغاء") }
            }
        )
    }

    Scaffold(
        containerColor = Canvas,
        contentWindowInsets = WindowInsets.statusBars.union(WindowInsets.navigationBars)
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .imePadding()
                .padding(horizontal = 18.dp, vertical = 10.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                IconButton(onClick = { scope.launch { saveThenExit() } }) {
                    Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "رجوع")
                }
                Column(modifier = Modifier.weight(1f)) {
                    Text("محرر الملاحظات", fontWeight = FontWeight.Bold, color = Ink, fontSize = 19.sp)
                    Text(
                        when (saveState) {
                            SaveState.READY -> if (draft) "اكتب بحرية؛ سيُحفظ تلقائياً" else "تغييرات بانتظار الحفظ"
                            SaveState.SAVING -> "جارٍ الحفظ..."
                            SaveState.SAVED -> "تم الحفظ تلقائياً"
                            SaveState.FAILED -> "تعذّر الحفظ؛ حاول الرجوع مجدداً"
                        },
                        color = if (saveState == SaveState.FAILED) Color(0xFFB34D61) else Petal,
                        fontSize = 11.sp
                    )
                }
                if (!draft) {
                    IconButton(onClick = { showDeleteConfirmation = true }) {
                        Icon(Icons.Default.Delete, contentDescription = "حذف الملاحظة", tint = Color(0xFFB34D61))
                    }
                }
            }

            Spacer(Modifier.height(18.dp))
            OutlinedTextField(
                value = title,
                onValueChange = { title = it; saveState = SaveState.READY },
                modifier = Modifier.fillMaxWidth(),
                placeholder = { Text("العنوان") },
                singleLine = true,
                shape = RoundedCornerShape(15.dp),
                textStyle = MaterialTheme.typography.titleMedium.copy(
                    fontWeight = FontWeight.SemiBold,
                    color = Ink
                )
            )
            Spacer(Modifier.height(12.dp))
            OutlinedTextField(
                value = body,
                onValueChange = { body = it; saveState = SaveState.READY },
                modifier = Modifier.weight(1f).fillMaxWidth(),
                placeholder = { Text("اكتب أفكارك هنا...") },
                shape = RoundedCornerShape(15.dp),
                textStyle = MaterialTheme.typography.bodyLarge.copy(color = Ink)
            )
            Spacer(Modifier.height(8.dp))
            Text(
                "${body.length} حرف",
                color = MutedInk,
                fontSize = 11.sp,
                modifier = Modifier.align(Alignment.Start)
            )
        }
    }
}

private fun formatDate(timestamp: Long): String =
    SimpleDateFormat("yyyy/MM/dd · HH:mm", Locale("ar")).format(Date(timestamp))
