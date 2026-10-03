// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { InputManager } from './InputManager';

describe('InputManager', () => {
  let input: InputManager;

  beforeEach(() => {
    input = new InputManager();
  });

  afterEach(() => {
    input.stopListening();
  });

  it('harus mendeteksi isActionDown saat tombol ditekan', () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyD' }));
    expect(input.isActionDown('right')).toBe(true);
    expect(input.isActionDown('left')).toBe(false);

    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyD' }));
    expect(input.isActionDown('right')).toBe(false);
  });

  it('harus mendukung multiple key bindings untuk satu action (misal: ArrowLeft dan KeyA)', () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowLeft' }));
    expect(input.isActionDown('left')).toBe(true);

    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'ArrowLeft' }));
    expect(input.isActionDown('left')).toBe(false);

    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA' }));
    expect(input.isActionDown('left')).toBe(true);
  });

  it('harus melacak isActionJustPressed dan membersihkannya setelah endFrame', () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
    expect(input.isActionJustPressed('jump')).toBe(true);
    expect(input.isActionDown('jump')).toBe(true);

    // Simulasi akhir tick
    input.endFrame();

    // Di frame berikutnya, tombol masih ditahan tapi status justPressed sudah hilang
    expect(input.isActionJustPressed('jump')).toBe(false);
    expect(input.isActionDown('jump')).toBe(true);
  });

  it('harus melacak isActionJustReleased saat tombol dilepas dan dibersihkan setelah endFrame', () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
    input.endFrame();

    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space' }));
    expect(input.isActionJustReleased('jump')).toBe(true);
    expect(input.isActionDown('jump')).toBe(false);

    input.endFrame();
    expect(input.isActionJustReleased('jump')).toBe(false);
  });

  it('harus mengabaikan event keydown repeat agar tidak memicu isActionJustPressed berkali-kali', () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', repeat: false }));
    expect(input.isActionJustPressed('jump')).toBe(true);

    input.endFrame();

    // Browser menembakkan keydown repeat saat tombol ditahan terus
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', repeat: true }));
    expect(input.isActionJustPressed('jump')).toBe(false);
    expect(input.isActionDown('jump')).toBe(true);
  });

  it('harus mereset seluruh tombol saat window kehilangan fokus (blur event)', () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyD' }));
    expect(input.isActionDown('right')).toBe(true);

    // Simulasi user alt-tab / switch window
    window.dispatchEvent(new Event('blur'));

    expect(input.isActionDown('right')).toBe(false);
    expect(input.isActionJustPressed('right')).toBe(false);
  });

  it('harus mendukung setVirtualAction untuk touch controls virtual', () => {
    input.setVirtualAction('attack', true);
    expect(input.isActionDown('attack')).toBe(true);
    expect(input.isActionJustPressed('attack')).toBe(true);

    input.endFrame();
    expect(input.isActionDown('attack')).toBe(true);
    expect(input.isActionJustPressed('attack')).toBe(false);

    input.setVirtualAction('attack', false);
    expect(input.isActionDown('attack')).toBe(false);
    expect(input.isActionJustReleased('attack')).toBe(true);
  });
});
