class LocalSabhaMeter extends AudioWorkletProcessor {
  constructor() {
    super();
    this.frames = 0;
    this.sumSquares = 0;
    this.samples = 0;
  }
  process(inputs, outputs) {
    const input = inputs[0];
    const output = outputs[0];
    if (output) for (const channel of output) channel.fill(0);
    if (input && input[0]) {
      const samples = input[0];
      for (let i = 0; i < samples.length; i++) {
        const value = samples[i];
        this.sumSquares += value * value;
        this.samples++;
      }
      this.frames++;
      if (this.frames >= 8 && this.samples) {
        const rms = Math.sqrt(this.sumSquares / this.samples);
        this.port.postMessage({ type: "level", rms });
        this.frames = 0;
        this.sumSquares = 0;
        this.samples = 0;
      }
    }
    return true;
  }
}
registerProcessor("local-sabha-meter", LocalSabhaMeter);