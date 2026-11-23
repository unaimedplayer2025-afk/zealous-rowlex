// WebAudio SFX + music. Tracks (OGG + MP3 fallback, picked with canPlayType):
//   audio/title-theme.{ogg,mp3}  — from THE RIFT & THE REACH title theme (John's song)
//   audio/gameplay.{ogg,mp3}     — from WADGET: Chain of Ages gameplay track (John's song)
export const AUDIO_V = 'zr-v1';
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

function pickSrc(base) {
  const a = document.createElement('audio');
  const ogg = a.canPlayType('audio/ogg; codecs="vorbis"') || a.canPlayType('audio/ogg; codecs="opus"');
  return (ogg ? base + '.ogg' : base + '.mp3') + '?v=' + AUDIO_V;
}

export const Snd = {
  ac: null, master: null, unlocked: false, muted: false, duck: 1, noiseBuf: null,
  title: null, game: null, titleVol: 0, gameVol: 0, bed: 'title',
  init() {
    if (!this.ac) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) {
        this.ac = new AC(); this.master = this.ac.createGain(); this.master.gain.value = this.muted ? 0 : 0.45; this.master.connect(this.ac.destination);
        const n = this.ac.sampleRate; this.noiseBuf = this.ac.createBuffer(1, n, n); const d = this.noiseBuf.getChannelData(0);
        for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      }
    }
    if (this.ac && this.ac.state === 'suspended') this.ac.resume().catch(() => {});
    this.unlocked = true;
    this.make('title', 'audio/title-theme');
    this.make('game', 'audio/gameplay');
    this.playCurrent();
  },
  make(which, base) {
    if (this[which]) return;
    const a = new Audio(); a.loop = true; a.preload = 'auto'; a.src = pickSrc(base); a.volume = 0;
    this[which] = a;
  },
  playCurrent() {
    if (this.muted || !this.unlocked) return;
    const a = this.bed === 'game' ? this.game : this.title;
    if (a && a.paused) { const p = a.play(); if (p && p.catch) p.catch(() => {}); }
  },
  setBed(name) { this.bed = name === 'game' ? 'game' : 'title'; this.playCurrent(); },
  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.45;
    if (m) { if (this.title) this.title.pause(); if (this.game) this.game.pause(); }
    else this.playCurrent();
  },
  toggleMute() { this.setMuted(!this.muted); if (!this.muted && !this.unlocked) this.init(); return this.muted; },
  update(dt) {
    this.duck += (1 - this.duck) * Math.min(1, dt * 2);
    const wantTitle = this.bed === 'title' && this.unlocked && !this.muted;
    const wantGame = this.bed === 'game' && this.unlocked && !this.muted;
    this.titleVol = wantTitle ? Math.min(0.65, this.titleVol + dt * 0.9) : Math.max(0, this.titleVol - dt * 0.7);
    this.gameVol = wantGame ? Math.min(0.62, this.gameVol + dt * 0.9) : Math.max(0, this.gameVol - dt * 0.7);
    if (this.title) {
      if (wantTitle && this.title.paused) this.playCurrent();
      try { this.title.volume = clamp(this.titleVol * (0.55 + 0.45 * this.duck), 0, 1); } catch (e) {}
      if (!wantTitle && this.titleVol <= 0 && !this.title.paused) this.title.pause();
    }
    if (this.game) {
      if (wantGame && this.game.paused) this.playCurrent();
      try { this.game.volume = clamp(this.gameVol * (0.55 + 0.45 * this.duck), 0, 1); } catch (e) {}
      if (!wantGame && this.gameVol <= 0 && !this.game.paused) this.game.pause();
    }
  },
  tone(f, d, type = 'square', v = 0.15, f2 = 0, delay = 0) {
    if (!this.ac || this.muted) return; this.duck = Math.min(this.duck, 0.6);
    const t = this.ac.currentTime + delay, o = this.ac.createOscillator(), g = this.ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(1, f2), t + d);
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + d);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + d + 0.05);
  },
  noise(d, v = 0.3, freq = 1000, type = 'lowpass', f2 = 0) {
    if (!this.ac || this.muted) return; this.duck = Math.min(this.duck, 0.6);
    const t = this.ac.currentTime, s = this.ac.createBufferSource(), fl = this.ac.createBiquadFilter(), g = this.ac.createGain();
    s.buffer = this.noiseBuf; fl.type = type; fl.frequency.setValueAtTime(freq, t); if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + d);
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + d);
    s.connect(fl); fl.connect(g); g.connect(this.master); s.start(t, Math.random() * 0.5); s.stop(t + d + 0.05);
  }
};

export const SFX = {
  fire()   { Snd.noise(0.08, 0.16, 2400, 'bandpass', 900); Snd.tone(420, 0.08, 'sawtooth', 0.06, 160); },
  hit()    { Snd.tone(900, 0.06, 'square', 0.07, 300); Snd.noise(0.07, 0.2, 2800); },
  headshot(){ Snd.tone(1400, 0.1, 'square', 0.1, 900); Snd.tone(2200, 0.12, 'triangle', 0.06, 1600); Snd.noise(0.1, 0.22, 5000, 'highpass'); },
  pop()    { Snd.noise(0.18, 0.28, 900, 'lowpass', 200); Snd.tone(180, 0.16, 'sawtooth', 0.08, 60); },
  hurt()   { Snd.tone(280, 0.22, 'sawtooth', 0.14, 70); Snd.noise(0.12, 0.2, 1500); },
  die()    { Snd.tone(330, 0.9, 'sawtooth', 0.18, 40); Snd.noise(0.5, 0.35, 700, 'lowpass', 100); },
  spawn()  { Snd.tone(80, 0.35, 'sawtooth', 0.07, 320); Snd.noise(0.25, 0.12, 4000, 'highpass'); },
  boss()   { Snd.tone(60, 0.8, 'sawtooth', 0.16, 40); Snd.noise(0.6, 0.3, 400, 'lowpass', 80); Snd.tone(110, 0.5, 'square', 0.06, 50, 0.15); },
  win()    { [523, 659, 784, 1046].forEach((f, i) => Snd.tone(f, 0.25, 'square', 0.08, 0, i * 0.14)); },
  pause()  { Snd.tone(220, 0.1, 'square', 0.05, 160); },
  resume() { Snd.tone(330, 0.1, 'square', 0.05, 440); },
  reveal() { [196, 247, 311, 392, 523].forEach((f, i) => Snd.tone(f, 0.28, 'sine', 0.08, f * 1.5, i * 0.12)); Snd.noise(0.5, 0.12, 2000, 'bandpass', 600); },
  portal() { Snd.tone(180, 0.2, 'sine', 0.06, 420); Snd.noise(0.15, 0.08, 3000, 'bandpass', 800); },
};
