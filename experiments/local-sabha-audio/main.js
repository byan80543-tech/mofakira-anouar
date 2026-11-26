(() => {
  const $ = (id) => document.getElementById(id);
  let stream = null, context = null, source = null, worklet = null, silent = null;
  let count = 0;
  const status = (message) => { $("status").textContent = message; };
  const setCount = () => { $("count").textContent = String(count); };
  async function stop() {
    if (worklet) { worklet.port.onmessage = null; worklet.disconnect(); worklet = null; }
    if (source) { source.disconnect(); source = null; }
    if (silent) { silent.disconnect(); silent = null; }
    if (stream) { for (const track of stream.getTracks()) track.stop(); stream = null; }
    if (context) { try { await context.close(); } catch (_) {} context = null; }
    $("start").disabled = false;
    $("stop").disabled = true;
    $("meter").style.width = "0%";
    status("الحالة: متوقف، وتم إغلاق مسارات الميكروفون.");
  }
  async function start() {
    $("start").disabled = true;
    try {
      if (!navigator.mediaDevices?.getUserMedia || !window.AudioWorkletNode) {
        throw new Error("المتصفح لا يدعم واجهات التقاط الصوت المطلوبة.");
      }
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: false },
        video: false
      });
      context = new AudioContext();
      await context.audioWorklet.addModule("./processor.js");
      await context.resume();
      source = context.createMediaStreamSource(stream);
      worklet = new AudioWorkletNode(context, "local-sabha-meter", {
        numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1]
      });
      silent = context.createGain();
      silent.gain.value = 0;
      worklet.port.onmessage = (event) => {
        if (event.data?.type !== "level") return;
        const rms = Number(event.data.rms) || 0;
        $("meter").style.width = Math.min(100, rms * 500) + "%";
      };
      source.connect(worklet);
      worklet.connect(silent);
      silent.connect(context.destination);
      $("stop").disabled = false;
      status("الحالة: يلتقط المتصفح الإشارة ويحسب مستوى شدتها محلياً. لا يوجد تعرف على الكلمات في هذه المرحلة.");
    } catch (error) {
      await stop();
      status("تعذر بدء الاختبار: " + (error?.message || "خطأ غير معروف"));
    }
  }
  $("start").addEventListener("click", start);
  $("stop").addEventListener("click", stop);
  $("manual").addEventListener("click", () => { count++; setCount(); });
  window.addEventListener("pagehide", () => {
    if (stream) for (const track of stream.getTracks()) track.stop();
  });
})();