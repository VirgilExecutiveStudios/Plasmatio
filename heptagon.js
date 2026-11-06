'use strict';

/**
 * Seven behaviors shared by controls, lettering and decorative artwork.
 *
 * const heptagon = new Heptagon({ root: document });
 * heptagon.register(element); // Optional { visualTarget: childElement }
 * await heptagon.enter();     // Call after registering a new page.
 * await heptagon.leave();     // Await before removing the page / closing.
 * heptagon.unregisterAll();   // Before registering replacement page nodes.
 * heptagon.dispose();         // On application teardown.
 *
 * Each behavior contains one animation and one named synthesized sound.
 * Presence has a continuous visual cycle and a shared quiet audio bed. Sounds
 * with the same name triggered together share a voice, so a page containing
 * many decorative elements does not multiply the volume. Browsers may defer
 * audio until the first gesture; Electron can enable autoplay in its main file.
 *
 * `heptagon:behavior` events and data-heptagon-state expose the applied state.
 * Layer positioning is untouched: effects only animate filter and opacity.
 */
(function defineHeptagon(global) {
  const STATES = Object.freeze([
    'presence', 'proximity', 'hover', 'click', 'other-click', 'page-leave', 'page-enter',
  ]);
  const BEHAVIORS = Object.freeze({
    presence: Object.freeze({ sound: 'presence', frequency: 110, gain: 0.006, duration: 4200 }),
    proximity: Object.freeze({ sound: 'proximity', frequency: 260, gain: 0.012, duration: 190 }),
    hover: Object.freeze({ sound: 'hover', frequency: 390, gain: 0.016, duration: 160 }),
    click: Object.freeze({ sound: 'click', frequency: 620, gain: 0.022, duration: 180 }),
    'other-click': Object.freeze({ sound: 'other-click', frequency: 180, gain: 0.009, duration: 180 }),
    'page-leave': Object.freeze({ sound: 'page-leave', frequency: 210, gain: 0.018, duration: 180 }),
    'page-enter': Object.freeze({ sound: 'page-enter', frequency: 440, gain: 0.018, duration: 180 }),
  });

  class Heptagon {
    static states = STATES;
    static behaviors = BEHAVIORS;

    constructor({ root = document, nearDistance = 80 } = {}) {
      this.root = root;
      this.nearDistance = nearDistance;
      this.records = new Map();
      this.abort = new AbortController();
      this.pointer = null;
      this.pointerFrame = 0;
      this.transition = null;
      this.transitionId = 0;
      this.lastSounds = new Map();
      this.voices = new Set();
      this.reducedMotion = global.matchMedia('(prefers-reduced-motion: reduce)');
      this.audio = null;
      this.presenceVoice = null;
      this.disposed = false;
      const options = { signal: this.abort.signal };
      root.addEventListener('pointermove', event => {
        this.pointer = { x: event.clientX, y: event.clientY };
        if (!this.pointerFrame) this.pointerFrame = requestAnimationFrame(() => {
          this.pointerFrame = 0;
          this.updatePointer();
        });
      }, options);
      root.addEventListener('pointerleave', () => {
        this.pointer = null;
        this.updatePointer();
      }, options);
      root.addEventListener('pointerdown', () => this.unlockAudio(), { ...options, capture: true });
      root.addEventListener('keydown', () => this.unlockAudio(), { ...options, capture: true });
      // Capture fires before a navigation handler can remove its page.
      root.addEventListener('click', event => this.handleClick(event), { ...options, capture: true });
      root.addEventListener('focusin', event => {
        const record = this.findRecord(event);
        if (record) {
          record.focused = true;
          this.apply(record, 'hover');
        }
      }, options);
      root.addEventListener('focusout', event => {
        const record = this.findRecord(event);
        if (record) {
          record.focused = false;
          this.settle(record);
        }
      }, options);
      global.addEventListener('blur', () => {
        this.pointer = null;
        this.updatePointer();
        if (this.audio?.state === 'running') this.audio.suspend().catch(() => {});
      }, options);
      global.addEventListener('focus', () => this.unlockAudio(), options);
      // Autoplay-capable desktop runtimes can begin presence immediately.
      this.unlockAudio();
    }

    register(element, { visualTarget = element } = {}) {
      if (this.disposed) throw new Error('Cannot register with a disposed Heptagon instance.');
      if (this.records.has(element)) return element;
      const record = { element, visualTarget, state: null, near: false, hovered: false, focused: false, animation: null, timer: null };
      this.records.set(element, record);
      element.dataset.heptagon = '';
      this.apply(record, 'presence');
      this.updatePresenceAudio();
      return element;
    }

    unregister(element) {
      const record = this.records.get(element);
      if (!record) return;
      record.animation?.cancel();
      clearTimeout(record.timer);
      delete element.dataset.heptagon;
      delete element.dataset.heptagonState;
      this.records.delete(element);
      this.updatePresenceAudio();
    }

    unregisterAll() {
      for (const element of [...this.records.keys()]) this.unregister(element);
      this.pointer = null;
    }

    findRecord(event) {
      for (const node of event.composedPath()) {
        if (this.records.has(node)) return this.records.get(node);
      }
      return null;
    }

    handleClick(event) {
      if (this.transition || this.disposed) return;
      this.unlockAudio();
      const clicked = this.findRecord(event);
      for (const record of this.records.values()) {
        this.apply(record, record === clicked ? 'click' : 'other-click', true);
      }
    }

    updatePointer() {
      if (this.disposed || this.transition) return;
      // Only the foremost registered element is hovered. The background still
      // receives proximity, other-click and lifecycle behaviors independently.
      let hovered = null;
      if (this.pointer) {
        let node = document.elementFromPoint(this.pointer.x, this.pointer.y);
        while (node && !hovered) {
          hovered = this.records.get(node) || null;
          node = node.parentElement;
        }
      }
      for (const record of this.records.values()) {
        const rect = record.element.getBoundingClientRect();
        if (!rect.width || !rect.height) continue;
        const point = this.pointer;
        record.hovered = record === hovered;
        record.near = Boolean(point && Math.hypot(
          Math.max(rect.left - point.x, 0, point.x - rect.right),
          Math.max(rect.top - point.y, 0, point.y - rect.bottom),
        ) <= this.nearDistance);
        if (record.state !== 'click' && record.state !== 'other-click') this.settle(record);
      }
    }

    settle(record) {
      if (this.transition || this.disposed || !this.records.has(record.element)) return;
      const state = record.hovered || record.focused ? 'hover' : record.near ? 'proximity' : 'presence';
      this.apply(record, state);
    }

    frames(state) {
      const reduced = this.reducedMotion.matches;
      switch (state) {
        case 'presence': return reduced
          ? [{ opacity: 1 }, { opacity: 0.985 }, { opacity: 1 }]
          : [{ filter: 'brightness(1)', opacity: 1 }, { filter: 'brightness(1.035)', opacity: 0.985 }, { filter: 'brightness(1)', opacity: 1 }];
        case 'proximity': return [{ filter: 'brightness(1)', opacity: 1 }, { filter: 'brightness(1.10)', opacity: 0.96 }];
        case 'hover': return [{ filter: 'brightness(1)' }, { filter: 'brightness(1.22) drop-shadow(0 0 3px rgb(255 255 255 / 0.35))' }];
        case 'click': return [{ opacity: 1 }, { opacity: 0.64, offset: 0.35 }, { opacity: 1 }];
        case 'other-click': return [{ opacity: 1 }, { opacity: 0.88, offset: 0.45 }, { opacity: 1 }];
        case 'page-leave': return [{ opacity: 1 }, { opacity: 0 }];
        case 'page-enter': return [{ opacity: 0 }, { opacity: 1 }];
        default: throw new Error(`Unknown Heptagon state: ${state}`);
      }
    }

    apply(record, state, repeat = false) {
      if (this.disposed || (!repeat && record.state === state)) return;
      if (this.transition && state !== 'page-enter' && state !== 'page-leave') return;
      record.animation?.cancel();
      clearTimeout(record.timer);
      record.state = state;
      record.element.dataset.heptagonState = state;
      const behavior = BEHAVIORS[state];
      record.element.dispatchEvent(new CustomEvent('heptagon:behavior', {
        bubbles: true,
        detail: { state, sound: behavior.sound, duration: behavior.duration },
      }));
      this.playSound(state);
      record.animation = record.visualTarget.animate(this.frames(state), {
        duration: behavior.duration,
        iterations: state === 'presence' ? Infinity : 1,
        easing: 'ease-in-out',
        fill: 'both',
      });
      if (state === 'click' || state === 'other-click') {
        record.timer = setTimeout(() => this.settle(record), behavior.duration);
      }
    }

    async enter() {
      if (this.disposed) return;
      const transitionId = ++this.transitionId;
      this.transition = 'page-enter';
      for (const record of this.records.values()) this.apply(record, 'page-enter', true);
      this.updatePresenceAudio();
      await Promise.all([...this.records.values()].map(record => record.animation.finished.catch(() => {})));
      if (this.transitionId !== transitionId || this.transition !== 'page-enter' || this.disposed) return;
      this.transition = null;
      for (const record of this.records.values()) this.settle(record);
      this.updatePointer();
    }

    async leave() {
      if (this.disposed) return;
      ++this.transitionId;
      this.transition = 'page-leave';
      for (const record of this.records.values()) this.apply(record, 'page-leave', true);
      this.updatePresenceAudio();
      await Promise.all([...this.records.values()].map(record => record.animation.finished.catch(() => {})));
      // Keep leave active until enter() so animations cannot revive old artwork.
    }

    unlockAudio() {
      if (this.disposed) return;
      try {
        if (!this.audio) {
          const Audio = global.AudioContext || global.webkitAudioContext;
          if (!Audio) return;
          this.audio = new Audio();
          this.master = this.audio.createGain();
          this.master.gain.value = 0.28;
          this.master.connect(this.audio.destination);
          const oscillator = this.audio.createOscillator();
          const gain = this.audio.createGain();
          oscillator.type = 'sine';
          oscillator.frequency.value = BEHAVIORS.presence.frequency;
          gain.gain.value = 0;
          oscillator.connect(gain).connect(this.master);
          oscillator.start();
          this.presenceVoice = { oscillator, gain };
        }
        if (this.audio.state === 'suspended') this.audio.resume().then(() => this.updatePresenceAudio()).catch(() => {});
        this.updatePresenceAudio();
      } catch {
        // A system with no audio device still renders all seven visual states.
      }
    }

    updatePresenceAudio() {
      if (!this.audio || !this.presenceVoice || this.audio.state === 'closed') return;
      const active = this.records.size > 0 && this.transition !== 'page-leave' && !this.disposed;
      this.presenceVoice.gain.gain.setTargetAtTime(active ? BEHAVIORS.presence.gain : 0, this.audio.currentTime, 0.04);
    }

    playSound(state) {
      if (state === 'presence') return this.updatePresenceAudio();
      if (!this.audio || this.audio.state !== 'running') return;
      const now = this.audio.currentTime;
      if (now - (this.lastSounds.get(state) ?? -Infinity) < 0.045) return;
      this.lastSounds.set(state, now);
      const behavior = BEHAVIORS[state];
      const duration = Math.min(behavior.duration / 1000, 0.18);
      const oscillator = this.audio.createOscillator();
      const gain = this.audio.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(behavior.frequency, now);
      oscillator.frequency.exponentialRampToValueAtTime(
        behavior.frequency * (state === 'page-leave' || state === 'other-click' ? 0.65 : 1.12), now + duration,
      );
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(behavior.gain, now + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      oscillator.connect(gain).connect(this.master);
      this.voices.add(oscillator);
      oscillator.onended = () => {
        this.voices.delete(oscillator);
        oscillator.disconnect();
        gain.disconnect();
      };
      oscillator.start(now);
      oscillator.stop(now + duration + 0.01);
    }

    dispose() {
      if (this.disposed) return;
      this.unregisterAll();
      this.disposed = true;
      this.abort.abort();
      cancelAnimationFrame(this.pointerFrame);
      for (const voice of this.voices) { try { voice.stop(); } catch {} }
      this.presenceVoice?.oscillator.stop();
      this.audio?.close().catch(() => {});
    }
  }

  global.Heptagon = Heptagon;
})(window);
