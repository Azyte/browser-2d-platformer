import { describe, it, expect, beforeEach } from 'vitest';
import { SoundSynthesizer } from './SoundSynthesizer';

describe('SoundSynthesizer - Procedural Web Audio Engine', () => {
  let synth: SoundSynthesizer;

  beforeEach(() => {
    // Inisialisasi synthesizer dalam mode headless / test
    synth = new SoundSynthesizer({ enabled: true, headless: true });
  });

  it('should initialize with default volume and enabled state', () => {
    expect(synth.isEnabled).toBe(true);
    expect(synth.volume).toBeGreaterThan(0);
    expect(synth.volume).toBeLessThanOrEqual(1.0);
  });

  it('should toggle mute state correctly', () => {
    expect(synth.isMuted).toBe(false);

    synth.toggleMute();
    expect(synth.isMuted).toBe(true);

    synth.toggleMute();
    expect(synth.isMuted).toBe(false);
  });

  it('should safely play sound effects without error in headless mode', () => {
    expect(() => synth.playAttack()).not.toThrow();
    expect(() => synth.playHit()).not.toThrow();
    expect(() => synth.playCrit()).not.toThrow();
    expect(() => synth.playWhirlwind()).not.toThrow();
    expect(() => synth.playPotion()).not.toThrow();
    expect(() => synth.playLevelUp()).not.toThrow();
    expect(() => synth.playQuestComplete()).not.toThrow();
    expect(() => synth.playLootPickup()).not.toThrow();
  });

  it('should clamp volume between 0.0 and 1.0', () => {
    synth.setVolume(1.5);
    expect(synth.volume).toBe(1.0);

    synth.setVolume(-0.5);
    expect(synth.volume).toBe(0.0);

    synth.setVolume(0.75);
    expect(synth.volume).toBe(0.75);
  });
});
