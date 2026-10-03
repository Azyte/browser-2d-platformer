import { describe, it, expect, beforeEach } from 'vitest';
import { DayNightSystem } from './DayNightSystem';

describe('DayNightSystem', () => {
  let dayNight: DayNightSystem;

  beforeEach(() => {
    // 24 detik untuk 24 jam game (1 detik = 1 jam in-game)
    dayNight = new DayNightSystem({
      cycleDurationSeconds: 24,
      initialHour: 12, // Mulai di tengah hari (12:00)
    });
  });

  it('harus menginisialisasi waktu dan fase siang dengan benar', () => {
    expect(dayNight.currentHour).toBe(12);
    expect(dayNight.getPhase()).toBe('day');
    expect(dayNight.getTimeString()).toBe('12:00');
    expect(dayNight.getAmbientDarkness()).toBeCloseTo(0.0, 1);
  });

  it('harus bergulir ke sore (dusk) dan malam (night) seiring berjalannya waktu', () => {
    // Maju 6 detik = 6 jam (18:00 -> Dusk)
    dayNight.update(6);
    expect(dayNight.currentHour).toBeCloseTo(18, 1);
    expect(dayNight.getPhase()).toBe('dusk');
    expect(dayNight.getAmbientDarkness()).toBeGreaterThan(0.1);

    // Maju 4 detik lagi = 22:00 -> Night
    dayNight.update(4);
    expect(dayNight.currentHour).toBeCloseTo(22, 1);
    expect(dayNight.getPhase()).toBe('night');
    expect(dayNight.getAmbientDarkness()).toBeGreaterThan(0.5);
  });

  it('harus bergulir melewati tengah malam dan kembali ke fajar (dawn)', () => {
    // Maju 12 detik = 24:00 / 00:00 (Midnight)
    dayNight.update(12);
    expect(dayNight.currentHour).toBeCloseTo(0, 1);
    expect(dayNight.getPhase()).toBe('night');

    // Maju 6 detik lagi = 06:00 (Dawn)
    dayNight.update(6);
    expect(dayNight.currentHour).toBeCloseTo(6, 1);
    expect(dayNight.getPhase()).toBe('dawn');
  });

  it('harus memformat string jam dan menit secara rapi (HH:MM)', () => {
    dayNight.setTime(8.5); // 08:30
    expect(dayNight.getTimeString()).toBe('08:30');

    dayNight.setTime(21.75); // 21:45
    expect(dayNight.getTimeString()).toBe('21:45');
  });
});
