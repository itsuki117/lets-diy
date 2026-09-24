import { create } from 'zustand';
import { buildMotionModel, type MotionModel, type MotionState } from '../core/motion/dynamics';
import { isMovableJoint, type JointId } from '../core/types';
import { jointLatches, latchValue } from '../core/motion/limits';
import { simJointValue, simLimits, simSetJointValue } from './commands/simulationCommands';
import { useSimulationStore, workingProject } from './useSimulationStore';

/**
 * 動作確認の「手」と「手を離したあとの動き」（設計書 DESIGN_V2 §9.4）。
 *
 * - つかむ: スライダーやボタンで、手が金物の許す範囲の中で動かす
 * - 離す: 重力・ガス圧・減衰・摩擦で、止まるまで動く
 * 動作確認の写し（useSimulationStore）の上だけで動かす。設計データにも履歴にも残さない。
 */

type Phase = 'idle' | 'hand' | 'handMove' | 'free';

interface MotionPlayer {
  phase: Phase;
  jointId: JointId | null;
  /** 重力とガス圧を反映するか。オフなら手を離した位置で止まる（形だけの確認） */
  physics: boolean;
  /** 直近の速度（度/s または mm/s）。表示用 */
  velocity: number;
  /** 最後に当たり止めに当たった理由 */
  lastStop: string | null;
  setPhysics: (on: boolean) => void;
  grab: (jointId: JointId) => void;
  drag: (value: number) => void;
  release: () => void;
  /**
   * 手で目的の位置まで動かす。着いたら手を離す。
   * latchId を渡すと、着いた位置でそのドアロック（スライドボルトなど）を手で掛けてから離す
   */
  moveTo: (jointId: JointId, target: number, latchId?: string) => void;
  /** 動きを止めて、今の位置で確定する */
  settle: () => void;
}

const HAND_SPEED = { revolute: 90, prismatic: 300 };
const MAX_STEP_S = 1 / 1000;
const REST_SECONDS = 0.35;

let frame = 0;
let model: MotionModel | null = null;
let state: MotionState = { q: 0, v: 0, restTime: 0, hitStop: false };
let handSamples: Array<{ t: number; q: number }> = [];
let handTarget = 0;
let lastTime = 0;

const currentValue = simJointValue;

function writeValue(jointId: JointId, value: number): void {
  simSetJointValue(jointId, value, false);
}

/** 自動のドアロック。ロック位置に届いた（または通り過ぎた）ら、その位置で掛かる */
function autoLatchHit(jointId: JointId, from: number, to: number): { value: number; hardwareId: string } | null {
  const current = workingProject();
  const joint = current.joints.find((item) => item.id === jointId);
  if (!joint || !isMovableJoint(joint)) return null;
  for (const hardware of jointLatches(current, jointId)) {
    if (!hardware.latch || hardware.latch.engaged || hardware.preset.latchMode === 'manual') continue;
    const lock = latchValue(current, joint, hardware.latch.at);
    const tolerance = joint.kind === 'revolute' ? 0.2 : 0.5;
    const reached = hardware.latch.at === 'max'
      ? to >= lock - tolerance && from < to + 1e-9
      : to <= lock + tolerance && from > to - 1e-9;
    if (reached) return { value: lock, hardwareId: hardware.id };
  }
  return null;
}

function engageLatch(jointId: JointId, hit: { value: number; hardwareId: string }): void {
  useSimulationStore.getState().update((draft) => {
    const joint = draft.joints.find((item) => item.id === jointId);
    if (joint && isMovableJoint(joint)) joint.value = hit.value;
    const hardware = draft.hardware.find((item) => item.id === hit.hardwareId);
    if (hardware?.latch) hardware.latch.engaged = true;
  });
}

const cancelFrame = (): void => {
  if (frame) cancelAnimationFrame(frame);
  frame = 0;
};

export const useMotionPlayer = create<MotionPlayer>((set, get) => {
  // 動作確認の世界の中だけで動くので、履歴にも設計データにも残さない
  const finish = (): void => {
    cancelFrame();
    set({ phase: 'idle', velocity: 0 });
  };

  const startFree = (jointId: JointId, v0: number): void => {
    model = buildMotionModel(workingProject(), jointId);
    if (!model || !get().physics) {
      finish();
      return;
    }
    state = { q: currentValue(jointId), v: v0, restTime: 0, hitStop: false };
    lastTime = performance.now();
    set({ phase: 'free', lastStop: null });
    const tick = (now: number): void => {
      if (get().phase !== 'free' || !model) return;
      // タブが裏に回ってフレームが間引かれても、実時間どおりに進める（上限 0.25 秒）
      let remaining = Math.min((now - lastTime) / 1000, 0.25);
      lastTime = now;
      let stop: string | null = null;
      while (remaining > 1e-9) {
        const dt = Math.min(MAX_STEP_S, remaining);
        const before = state.q;
        state = model.step(state, dt);
        const hit = autoLatchHit(jointId, before, state.q);
        if (hit) {
          engageLatch(jointId, hit);
          set({ velocity: 0, lastStop: 'ドアロックが掛かった位置' });
          finish();
          return;
        }
        if (state.hitStop) {
          const atMax = state.q >= model.limits.max - 1e-6;
          stop = (atMax ? model.limits.maxReason : model.limits.minReason) ?? (atMax ? '可動範囲の端' : '閉じた位置');
        }
        remaining -= dt;
      }
      writeValue(jointId, state.q);
      set({ velocity: state.v, ...(stop ? { lastStop: stop } : {}) });
      if (state.restTime >= REST_SECONDS) {
        finish();
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
  };

  return {
    phase: 'idle',
    jointId: null,
    physics: true,
    velocity: 0,
    lastStop: null,

    setPhysics: (physics) => set({ physics }),

    grab: (jointId) => {
      cancelFrame();
      handSamples = [{ t: performance.now(), q: currentValue(jointId) }];
      set({ phase: 'hand', jointId, velocity: 0, lastStop: null });
    },

    drag: (value) => {
      const { jointId, phase } = get();
      if (!jointId || phase !== 'hand') return;
      const before = currentValue(jointId);
      simSetJointValue(jointId, value);
      const hit = autoLatchHit(jointId, before, currentValue(jointId));
      if (hit) {
        // 手で押し込んでロックが掛かったら、そこから先は動かない
        engageLatch(jointId, hit);
        set({ lastStop: 'ドアロックが掛かった位置' });
        finish();
        return;
      }
      const now = performance.now();
      handSamples = [...handSamples.filter((sample) => now - sample.t < 120), { t: now, q: currentValue(jointId) }];
    },

    release: () => {
      const { jointId, phase } = get();
      if (!jointId || phase !== 'hand') return;
      const first = handSamples[0];
      const last = handSamples[handSamples.length - 1];
      const span = first && last ? (last.t - first.t) / 1000 : 0;
      const v0 = span > 0.01 && first && last ? (last.q - first.q) / span : 0;
      startFree(jointId, Math.max(Math.min(v0, 400), -400));
    },

    moveTo: (jointId, target, latchId) => {
      cancelFrame();
      const joint = workingProject().joints.find((item) => item.id === jointId);
      if (!joint || !isMovableJoint(joint)) return;
      const range = simLimits(joint);
      handTarget = Math.min(Math.max(target, range.min), range.max);
      const speed = HAND_SPEED[joint.kind];
      lastTime = performance.now();
      set({ phase: 'handMove', jointId, lastStop: null });
      const tick = (now: number): void => {
        if (get().phase !== 'handMove') return;
        const dt = Math.min((now - lastTime) / 1000, 0.25);
        lastTime = now;
        const q = currentValue(jointId);
        const step = Math.sign(handTarget - q) * Math.min(Math.abs(handTarget - q), speed * dt);
        writeValue(jointId, q + step);
        const hit = autoLatchHit(jointId, q, q + step);
        if (hit) {
          engageLatch(jointId, hit);
          set({ velocity: 0, lastStop: 'ドアロックが掛かった位置' });
          finish();
          return;
        }
        set({ velocity: step / Math.max(dt, 1e-6) });
        if (Math.abs(handTarget - (q + step)) < 1e-6) {
          if (latchId) {
            // 支えたまま掛けるので、落ちずにその位置で止まる
            engageLatch(jointId, { value: handTarget, hardwareId: latchId });
            set({ velocity: 0, lastStop: 'ドアロックを掛けた位置' });
            finish();
            return;
          }
          // 目的の位置まで動かしたら手を離す
          startFree(jointId, 0);
          return;
        }
        frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    },

    settle: () => {
      if (get().phase === 'idle') return;
      finish();
    },
  };
});
