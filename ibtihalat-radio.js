/* Curated Sayyid al-Naqshbandi devotional recordings for Anwar Radio. */
(() => {
  'use strict';

  const section = document.getElementById('anwarIbtihalat');
  if (!section) return;

  const audio = section.querySelector('#ibtihalatAudio');
  const nowPlaying = section.querySelector('#ibtihalatNowPlaying');
  const status = section.querySelector('#ibtihalatStatus');
  const buttons = Array.from(section.querySelectorAll('[data-ibtihalat-track]'));
  if (!audio || !nowPlaying || !status || buttons.length !== 2) return;

  const archiveBase = 'https://archive.org/download/20240309_20240309_1714/';
  const tracks = Object.freeze({
    'ya-rab': Object.freeze({
      title: 'يا رب إن عظمت ذنوبي',
      file: '004  الشيخ سيد النقشبندى, يا رب ان عظمت ذنوبى كثرة.mp3',
      sourceLabel: 'الملف 004'
    }),
    'aghayb': Object.freeze({
      title: 'أغيب وذو اللطائف لا يغيب',
      file: '007  مجموعه ابتهالات مختارة نادرة جدا للشيخ النقشبندى.mp3',
      sourceLabel: 'ضمن المجموعة الصوتية · الملف 007'
    })
  });

  let currentTrackId = '';

  function setStatus(message) {
    status.textContent = message;
  }

  function syncButtons() {
    buttons.forEach(button => {
      const selected = button.dataset.ibtihalatTrack === currentTrackId;
      const playing = selected && !audio.paused && !audio.ended;
      button.setAttribute('aria-pressed', String(selected));
      button.dataset.playing = String(playing);
      const playMark = button.querySelector('.anwar-ibtihalat-play');
      if (playMark) playMark.textContent = playing ? 'Ⅱ' : '▶';
    });
  }

  async function playTrack(trackId) {
    const track = tracks[trackId];
    if (!track) return;

    if (currentTrackId === trackId && audio.src) {
      if (!audio.paused && !audio.ended) {
        audio.pause();
        setStatus('أُوقف الابتهال مؤقتاً. اضغط على زر التشغيل في المشغل للمتابعة.');
        syncButtons();
        return;
      }

      try {
        await audio.play();
      } catch (error) {
        setStatus('تعذّر بدء التشغيل. تحقق من اتصال الإنترنت ثم اضغط تشغيل من المشغل.');
      }
      syncButtons();
      return;
    }

    audio.pause();
    currentTrackId = trackId;
    nowPlaying.textContent = track.title;
    audio.dataset.ibtihalatTrack = trackId;
    audio.src = archiveBase + encodeURIComponent(track.file);
    audio.load();
    setStatus('جارٍ تجهيز «' + track.title + '» من Internet Archive…');
    syncButtons();

    try {
      await audio.play();
    } catch (error) {
      setStatus('تم اختيار «' + track.title + '». اضغط تشغيل من المشغل إذا لم يبدأ الصوت تلقائياً.');
    }
    syncButtons();
  }

  buttons.forEach(button => {
    const trackId = button.dataset.ibtihalatTrack;
    button.addEventListener('click', () => playTrack(trackId));
  });

  audio.addEventListener('playing', () => {
    const track = tracks[currentTrackId];
    if (track) setStatus('يُشغّل الآن: ' + track.title);
    syncButtons();
  });

  audio.addEventListener('pause', () => {
    if (currentTrackId && !audio.ended) {
      setStatus('أُوقف التشغيل مؤقتاً. يمكنك المتابعة من المشغل.');
    }
    syncButtons();
  });

  audio.addEventListener('ended', () => {
    const track = tracks[currentTrackId];
    if (track) setStatus('انتهى «' + track.title + '». اختر الابتهال الآخر للاستماع إليه.');
    syncButtons();
  });

  audio.addEventListener('error', () => {
    const track = tracks[currentTrackId];
    if (track) setStatus('تعذّر تحميل «' + track.title + '» من الأرشيف. تحقق من الاتصال أو افتح صفحة المصدر.');
    syncButtons();
  });

  audio.addEventListener('play', syncButtons);
  syncButtons();
})();
