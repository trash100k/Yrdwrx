export async function playVoice(text: string) {
  try {
    const res = await fetch("/api/agent/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text })
    });
    const data = await res.json();
    if (data.audio) {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      
      const b64 = data.audio.replace(/[\s\r\n]+$/, ''); // clear trailing lines
      const binaryStr = window.atob(b64);
      const bytesCount = binaryStr.length;
      const samplesCount = Math.floor(bytesCount / 2);
      
      const buffer = audioCtx.createBuffer(1, samplesCount, 24000);
      const channelData = buffer.getChannelData(0);
      
      for (let i = 0; i < samplesCount; i++) {
        const byte0 = binaryStr.charCodeAt(i * 2);
        const byte1 = binaryStr.charCodeAt(i * 2 + 1);
        
        let val = byte0 | (byte1 << 8);
        if (val & 0x8000) {
          val -= 0x10000;
        }
        channelData[i] = val / 32768.0;
      }
      
      const source = audioCtx.createBufferSource();
      source.buffer = buffer;
      source.connect(audioCtx.destination);
      source.start();
    }
  } catch (err) {
    console.error("Voice playback failed", err);
  }
}
