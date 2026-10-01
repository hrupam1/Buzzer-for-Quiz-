// Web Audio API simple synthesizers

const createOscillator = (freq: number, type: OscillatorType, duration: number, vol: number = 0.1) => {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch (e) {
    console.error('Audio playback failed', e);
  }
};

export const playBuzzSound = () => {
  createOscillator(440, 'square', 0.2, 0.2); // A4
  setTimeout(() => createOscillator(554.37, 'square', 0.3, 0.2), 50); // C#5
};

export const playLockSound = () => {
  createOscillator(150, 'sawtooth', 0.15, 0.2);
};

export const playWinnerSound = () => {
  createOscillator(523.25, 'sine', 0.2, 0.3); // C5
  setTimeout(() => createOscillator(659.25, 'sine', 0.2, 0.3), 150); // E5
  setTimeout(() => createOscillator(783.99, 'sine', 0.4, 0.3), 300); // G5
  setTimeout(() => createOscillator(1046.50, 'sine', 0.6, 0.3), 450); // C6
};
