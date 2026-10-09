/**
 * Web Audio API synthesized sound generator for Leadloop Rollercoaster Circuit.
 * Uses zero external asset files: 100% synthesized in real-time in the browser.
 */

class CoasterAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private trackNoiseGain: GainNode | null = null;
  private trackFilter: BiquadFilterNode | null = null;
  private noiseSource: AudioBufferSourceNode | null = null;
  private isRunning = false;
  private lastClickTime = 0;

  /** Initialize or resume Web Audio Context on user gesture */
  public init(): boolean {
    if (typeof window === 'undefined') return false;

    try {
      if (!this.ctx) {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        this.ctx = new AudioContextClass();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(0.4, this.ctx.currentTime);
        this.masterGain.connect(this.ctx.destination);
      }

      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }

      if (!this.isRunning) {
        this.startTrackRumble();
        this.isRunning = true;
      }

      return true;
    } catch (e) {
      console.warn('[Audio] Could not initialize Web Audio', e);
      return false;
    }
  }

  /** Continuous synthesized ambient rail noise and wind whoosh */
  private startTrackRumble() {
    if (!this.ctx || !this.masterGain) return;

    try {
      // 2 seconds of pink/white noise buffer looped
      const bufferSize = this.ctx.sampleRate * 2;
      const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);

      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        // Pink noise filter approximation
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.08;
        b6 = white * 0.115926;
      }

      this.noiseSource = this.ctx.createBufferSource();
      this.noiseSource.buffer = noiseBuffer;
      this.noiseSource.loop = true;

      // Bandpass/Lowpass filter for mechanical rail whoosh
      this.trackFilter = this.ctx.createBiquadFilter();
      this.trackFilter.type = 'bandpass';
      this.trackFilter.frequency.setValueAtTime(450, this.ctx.currentTime);
      this.trackFilter.Q.setValueAtTime(2.0, this.ctx.currentTime);

      this.trackNoiseGain = this.ctx.createGain();
      this.trackNoiseGain.gain.setValueAtTime(0.08, this.ctx.currentTime);

      this.noiseSource.connect(this.trackFilter);
      this.trackFilter.connect(this.trackNoiseGain);
      this.trackNoiseGain.connect(this.masterGain);

      this.noiseSource.start(0);
    } catch {
      // Audio buffer setup fallback
    }
  }

  /**
   * Modulate track rumble based on coaster speed / elevation
   * @param speedNormalized 0.0 (slow climb) to 1.0 (steep drop)
   */
  public updatePhysics(speedNormalized: number, isLiftHill: boolean) {
    if (!this.ctx || !this.trackFilter || !this.trackNoiseGain) return;

    try {
      const now = this.ctx.currentTime;
      // High speed = higher pitch wind rush and more volume
      const targetFreq = 300 + speedNormalized * 850;
      const targetGain = 0.04 + speedNormalized * 0.14;

      this.trackFilter.frequency.setTargetAtTime(targetFreq, now, 0.08);
      this.trackNoiseGain.gain.setTargetAtTime(targetGain, now, 0.08);

      // Play chain lift mechanical clicks when climbing Station 1 lift hill
      if (isLiftHill && now - this.lastClickTime > 0.14) {
        this.playMechanicalClick();
        this.lastClickTime = now;
      }
    } catch {
      // Ignore
    }
  }

  /** Mechanical chain-lift ratchet click */
  private playMechanicalClick() {
    if (!this.ctx || !this.masterGain) return;

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const now = this.ctx.currentTime;

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(950, now);
      osc.frequency.exponentialRampToValueAtTime(150, now + 0.025);

      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.025);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now);
      osc.stop(now + 0.025);
    } catch {
      // Ignore
    }
  }

  /** Play dynamic futuristic chime when arriving at a station */
  public playStationArrival(stationIndex: number) {
    if (!this.ctx || !this.masterGain) return;

    try {
      const now = this.ctx.currentTime;

      // Unique harmonic frequencies for each station
      const stationTones: [number, number][] = [
        [523.25, 659.25],  // 1. Capture: C5 + E5 (Ingestion)
        [659.25, 783.99],  // 2. Respond: E5 + G5 (Sub-minute reply)
        [783.99, 987.77],  // 3. Qualify: G5 + B5 (AI Intelligence)
        [880.00, 1046.50], // 4. Score & Route: A5 + C6 (High Intent Alert)
        [987.77, 1174.66], // 5. Follow up: B5 + D6 (Cadence SLA)
        [1046.50, 1318.51] // 6. Recover: C6 + E6 (Recovery Surge)
      ];

      const [freq1, freq2] = stationTones[stationIndex % stationTones.length];

      // Two harmonic oscillators for crystalline futuristic chime
      [freq1, freq2].forEach((freq, idx) => {
        if (!this.ctx || !this.masterGain) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = idx === 0 ? 'sine' : 'triangle';
        osc.frequency.setValueAtTime(freq, now);

        // Gentle vibrato
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.65);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start(now);
        osc.stop(now + 0.65);
      });

      // Special victory arpeggio on Station 6 (Recovered lead loops back into funnel!)
      if (stationIndex === 5) {
        this.playRecoveryTriumph(now);
      }
    } catch {
      // Ignore
    }
  }

  /** Euphoric multi-tone celebration chord for Station 6 (Recover) */
  private playRecoveryTriumph(startTime: number) {
    if (!this.ctx || !this.masterGain) return;

    const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51];
    notes.forEach((freq, i) => {
      if (!this.ctx || !this.masterGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const noteTime = startTime + i * 0.07;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, noteTime);

      gain.gain.setValueAtTime(0.09, noteTime);
      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(noteTime);
      osc.stop(noteTime + 0.8);
    });

    // Trigger the iconic coaster celebration "WOHOOO!"
    this.playWoohoo(startTime);
  }

  /**
   * Energetic "WOHOOO!" celebratory sound effect
   * Combines synthesized vocal formant pitch swoops with native speech synthesis
   */
  public playWoohoo(startTime?: number) {
    // 1. Browser vocal exclamation "Woohoo!"
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance('Woohoo!');
        utter.pitch = 1.7; // excited high pitch
        utter.rate = 1.35; // fast energetic delivery
        utter.volume = 1.0;
        window.speechSynthesis.speak(utter);
      } catch {
        // Fallback to Web Audio synthesis
      }
    }

    // 2. Synthesized vocal formant "Woo-Hooo!" curve
    if (!this.ctx || !this.masterGain) return;

    try {
      const now = startTime ?? this.ctx.currentTime;

      // "WOO" part (rising vocal curve 380Hz -> 620Hz)
      const osc1 = this.ctx.createOscillator();
      const gain1 = this.ctx.createGain();
      const filter1 = this.ctx.createBiquadFilter();

      filter1.type = 'bandpass';
      filter1.Q.setValueAtTime(3.5, now);
      filter1.frequency.setValueAtTime(600, now);
      filter1.frequency.linearRampToValueAtTime(900, now + 0.18);

      osc1.type = 'sawtooth';
      osc1.frequency.setValueAtTime(380, now);
      osc1.frequency.exponentialRampToValueAtTime(620, now + 0.18);

      gain1.gain.setValueAtTime(0.001, now);
      gain1.gain.linearRampToValueAtTime(0.18, now + 0.04);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

      osc1.connect(filter1);
      filter1.connect(gain1);
      gain1.connect(this.masterGain);

      osc1.start(now);
      osc1.stop(now + 0.22);

      // "HOOO!" part (soaring curve 700Hz -> 1080Hz -> 680Hz)
      const tHoo = now + 0.22;
      const osc2 = this.ctx.createOscillator();
      const gain2 = this.ctx.createGain();
      const filter2 = this.ctx.createBiquadFilter();

      filter2.type = 'bandpass';
      filter2.Q.setValueAtTime(4.0, tHoo);
      filter2.frequency.setValueAtTime(1100, tHoo);
      filter2.frequency.linearRampToValueAtTime(1500, tHoo + 0.2);
      filter2.frequency.linearRampToValueAtTime(950, tHoo + 0.55);

      osc2.type = 'sawtooth';
      osc2.frequency.setValueAtTime(700, tHoo);
      osc2.frequency.exponentialRampToValueAtTime(1080, tHoo + 0.16);
      osc2.frequency.exponentialRampToValueAtTime(680, tHoo + 0.55);

      gain2.gain.setValueAtTime(0.001, tHoo);
      gain2.gain.linearRampToValueAtTime(0.22, tHoo + 0.06);
      gain2.gain.exponentialRampToValueAtTime(0.001, tHoo + 0.55);

      osc2.connect(filter2);
      filter2.connect(gain2);
      gain2.connect(this.masterGain);

      osc2.start(tHoo);
      osc2.stop(tHoo + 0.55);

      // Sparkle shimmer tone
      const shimmer = this.ctx.createOscillator();
      const shimmerGain = this.ctx.createGain();
      shimmer.type = 'sine';
      shimmer.frequency.setValueAtTime(1318.51, tHoo);
      shimmer.frequency.exponentialRampToValueAtTime(1760, tHoo + 0.4);
      shimmerGain.gain.setValueAtTime(0.08, tHoo);
      shimmerGain.gain.exponentialRampToValueAtTime(0.0001, tHoo + 0.5);

      shimmer.connect(shimmerGain);
      shimmerGain.connect(this.masterGain);

      shimmer.start(tHoo);
      shimmer.stop(tHoo + 0.5);
    } catch {
      // Ignore
    }
  }

  /** Set master volume (0.0 to 1.0) */
  public setVolume(vol: number) {
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(Math.max(0, Math.min(1, vol)), this.ctx.currentTime, 0.05);
    }
  }

  /** Stop / Pause all audio */
  public mute() {
    this.setVolume(0);
  }

  public unmute() {
    this.setVolume(0.35);
  }
}

export const coasterAudio = new CoasterAudioEngine();
