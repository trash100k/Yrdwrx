export async function playVoice(text: string) {
  try {
    const res = await fetch("/api/agent/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text })
    });
    const data = await res.json();
    if (data.audio) {
      // Decode base64 audio into a playable Blob URL
      // According to the skill, it's sample rate 24000 PCM, wait it might be raw PCM or WAV.
      // Wait, skill says:
      // "Return this base64 audio to the client for playback (sample rate 24000)"
      // Usually it's encoded as WAV or PCM. We'll use the raw web audio API or just HTMLAudioElement if it's WAV.
      // If the SDK returns PCM 16-bit 24000Hz, we must create a WAV header or decode it properly.
      
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      const binaryStr = atob(data.audio);
      // Construct Float32Array from Int16Array
      const len = binaryStr.length / 2;
      const buffer = audioCtx.createBuffer(1, len, 24000);
      const channelData = buffer.getChannelData(0);
      for (let i = 0; i < len; i++) {
        const int16 = binaryStr.charCodeAt(i*2) + (binaryStr.charCodeAt(i*2 + 1) << 8);
        const signedInt16 = int16 >= 32768 ? int16 - 65536 : int16;
        channelData[i] = signedInt16 / 32768;
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
