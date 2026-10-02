import { emotionArms, EMOTIONS } from './emotions.js';
// Presentation only: a complete pose blends back to the current locomotion pose.
const clamp = (v, min = 0, max = 1) => Math.max(min, Math.min(max, v));
const ease = (v) => {
  const t = clamp(v);
  return t * t * (3 - 2 * t);
};
const mix = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
const pairMix = (a, b, t) => a.map((point, i) => mix(point, b[i], t));
const idle = [
  { x: -9, y: -12 },
  { x: 10, y: -12 },
];

export function expressivePose({
  spec,
  config,
  kind,
  charge,
  swing,
  jump,
  block = false,
  diving = false,
  diveForward = false,
  bodyTilt = 0,
  bodyOffsetY = 0,
  recoveryPose = null,
  step = 0,
  contactPoint = null,
  serve = null,
  localVelocity = null,
  actionDirection = 1,
  emotion = null,
  shoulderLift = 0,
}) {
  const power = clamp(charge?.power ?? serve?.power ?? swing?.power ?? 0.35),
    amp = 1.3 * power * config.armPowerMotion;
  const scale = spec.size * config.armScale;
  const scaled = (points) =>
    points.map((p, i) => ({
      x: (i ? 6 : -6) + (p.x - (i ? 6 : -6)) * scale,
      y: -20 + (p.y + 20) * scale,
    }));
  let base = idle.map((p, i) => ({ ...p, x: p.x + (i ? 1 : -1) * step * 0.5 })),
    stage = 'Покой';
  if (jump) {
    const { profile, time } = jump,
      air = time - profile.windup;
    let jumpPose;
    if (air < 0) {
      const t = ease(time / Math.max(0.001, profile.windup));
      jumpPose = [
        { x: -9 - t, y: -12 + 6 * t },
        { x: 10 + t, y: -12 + 6 * t },
      ];
      stage = 'Толчок';
    } else if (air < profile.rise) {
      const t = ease(air / profile.rise);
      jumpPose = pairMix(
        [
          { x: -10, y: -6 },
          { x: 11, y: -6 },
        ],
        [
          { x: -10, y: -39 },
          { x: 11, y: -41 },
        ],
        t,
      );
      stage = 'Взлёт';
    } else {
      const t = ease((air - profile.rise - profile.hang) / profile.fall);
      jumpPose = pairMix(
        [
          { x: -10, y: -39 },
          { x: 11, y: -41 },
        ],
        idle,
        t,
      );
      stage = 'Приземление';
    }
    base = pairMix(base, jumpPose, config.armJumpMotion);
  }
  if (block) {
    base = [
      { x: -6, y: -43 },
      { x: 7, y: -43 },
    ];
    stage = 'Блок';
  }
  base = scaled(base);
  // Keep the reach horizontal in world space while the torso tips forward.
  if (diving && diveForward) {
    base = [-1, 1].map((side) => ({
      x: side * 3 + 25 * Math.cos(bodyTilt),
      y: -20 - 25 * Math.sin(bodyTilt),
    }));
    stage = 'Руки вперёд';
  }
  if (recoveryPose) {
    const t = clamp(recoveryPose.progress);
    const support = [8, 16].map((x) => {
      const y = 5 * Math.sin(bodyTilt);
      return {
        x: x * Math.cos(bodyTilt) + y * Math.sin(bodyTilt),
        y: -x * Math.sin(bodyTilt) + y * Math.cos(bodyTilt) - bodyOffsetY,
      };
    });
    base = pairMix(support, base, ease((t - 0.55) / 0.45));
    stage = t < 0.55 ? 'Опора руками' : 'Подъём';
  }
  let wrists = base,
    activity = 0;
  // Short, straight follow-through at the outgoing ball's local velocity.
  // Stop after a few pixels: speed changes the duration, never arm reach.
  const velocity = localVelocity || {
    x: 90 + power * 100,
    y: kind === 'drive' ? 70 + power * 50 : -100 - power * 80,
  };
  const speed = Math.hypot(velocity.x, velocity.y),
    travel = 5 * scale;
  const strokeTime = speed > 0 ? travel / speed : 0.08;
  const follow = (hit, age, indices = [0, 1]) =>
    hit.map((p, i) => {
      const time = Math.min(Math.max(age, 0), strokeTime);
      return indices.includes(i) ? { x: p.x + velocity.x * time, y: p.y + velocity.y * time } : p;
    });
  const recoveryStart = Math.max(0.09, strokeTime);

  const ready =
    diving && diveForward
      ? base
      : scaled(
          diving
            ? [
                { x: 6, y: -39 },
                { x: 10, y: -40 },
              ]
            : kind === 'low'
              ? [
                  { x: 10, y: -9 - amp * 2 },
                  { x: 14, y: -9 - amp * 2 },
                ]
              : kind === 'loft'
                ? [
                    { x: 0, y: -37 - amp * 0.5 },
                    { x: 7, y: -36 + amp * 2 },
                  ]
                : [
                    { x: 12, y: -27 },
                    { x: actionDirection * (-8 - amp * 2), y: -33 - amp },
                  ],
        );
  if (charge) {
    activity = ease((charge.age ?? 0.1) / config.armWindup);
    wrists = pairMix(base, ready, activity);
    stage = 'Подготовка';
  }
  if (swing && !charge && !block && kind !== 'block') {
    const age = swing.age;
    if (!swing.hit) {
      const recoil = scaled(
        kind === 'drive'
          ? [
              { x: 11, y: -28 },
              { x: actionDirection * (-11 - amp * 2), y: -35 - amp },
            ]
          : kind === 'loft'
            ? [
                { x: 0, y: -33 },
                { x: 7, y: -33 },
              ]
            : [
                { x: 6, y: -6 },
                { x: 10, y: -6 },
              ],
      );
      const end = scaled(
        kind === 'drive'
          ? [
              { x: 10, y: -23 },
              { x: actionDirection * 15, y: -29 },
            ]
          : kind === 'loft'
            ? [
                { x: 1, y: -44 },
                { x: 8, y: -44 },
              ]
            : [
                { x: 18, y: -17 },
                { x: 22, y: -17 },
              ],
      );
      const stroke =
        age < 0.035
          ? pairMix(ready, recoil, ease(age / 0.035))
          : pairMix(recoil, end, ease((age - 0.035) / 0.065));
      activity = 1 - ease((age - 0.1) / 0.15);
      wrists = pairMix(base, stroke, activity);
      stage = age < 0.1 ? 'Взмах после отпускания' : activity > 0 ? 'Возврат' : stage;
    } else {
      const point = contactPoint || { x: 10, y: kind === 'low' ? -14 : -40 };
      const hit =
        kind === 'drive'
          ? [
              { x: 11, y: -25 },
              { x: point.x, y: point.y },
            ]
          : kind === 'low'
            ? [
                { x: point.x - 2, y: point.y + 3 },
                { x: point.x + 2, y: point.y + 3 },
              ]
            : [
                { x: point.x - 3.5, y: point.y + 2 },
                { x: point.x + 3.5, y: point.y + 2 },
              ];
      const stroke = follow(hit, age, kind === 'drive' ? [1] : [0, 1]);
      activity = 1 - ease((age - recoveryStart) / 0.23);
      wrists = pairMix(base, stroke, activity);
      stage =
        age < strokeTime
          ? 'Контакт!'
          : age < recoveryStart
            ? 'Проводка'
            : activity > 0
              ? 'Возврат'
              : stage;
    }
  }
  if (serve || swing?.serve) {
    const type = serve?.kind || kind,
      age = serve?.age || 0;
    const hand = serve?.hand ?? swing?.hand ?? 1;
    const strikeReady = scaled([
      { x: 0, y: 0 },
      { x: actionDirection * (type === 'low' ? -9 : -8), y: type === 'low' ? -7 : -35 },
    ])[1];
    const readyServe = scaled([
      { x: -9, y: -18 },
      { x: 10, y: -18 },
    ]);
    readyServe[hand] = strikeReady;
    if (serve) {
      wrists = pairMix(base, readyServe, ease(age / 0.4));
      stage =
        type === 'low' ? 'Нижняя подача' : type === 'drive' ? 'Разбег и прыжок' : 'Верхняя подача';
    } else {
      const point = contactPoint || { x: 15, y: type === 'low' ? -12 : -40 };
      const hit = base.map((p, i) => (i === hand ? { x: point.x, y: point.y } : p));
      activity = 1 - ease((swing.age - recoveryStart) / 0.23);
      wrists = pairMix(base, follow(hit, swing.age, [hand]), activity);
      stage = activity > 0 ? 'Подача одной рукой' : stage;
    }
    if (serve) activity = 1;
  }
  if (emotion) {
    wrists = emotionArms(emotion, base);
    stage = EMOTIONS[emotion.kind];
    activity = 0;
  }
  wrists = wrists.map((p) => ({ ...p, y: p.y + shoulderLift }));

  if (recoveryPose) {
    wrists = base;
    activity = 0;
  }
  const elbows = wrists
    .map((p, i) => {
      const shoulder = { x: i ? spec.shoulder : -spec.shoulder, y: -20 + shoulderLift };
      const rest = {
        x: (shoulder.x + p.x) / 2 + (i ? 1 : -1) * (block ? 3 : 6) * config.armBend,
        y: (shoulder.y + p.y) / 2 + 5 * config.armBend,
      };
      if (kind === 'loft' && !serve && !swing?.serve)
        return mix(
          rest,
          { x: (i ? 11 : -9) * config.armBend, y: (shoulder.y + p.y) / 2 + 2 },
          activity,
        );
      return { ...rest, x: rest.x + (i ? 1 : -1) * amp * 3 * config.armBend * activity };
    })
    .map((p) => ({ ...p, y: p.y - (config.elbowHeight || 0) }));
  const shoulders = [
    { x: -spec.shoulder, y: -20 + shoulderLift },
    { x: spec.shoulder, y: -20 + shoulderLift },
  ];
  return {
    wrists,
    elbows,
    shoulders,
    power: activity > 0 ? power : 0.35,
    stage,
    cup: kind === 'loft' && !serve && !swing?.serve ? activity : 0,
    snap: !!swing?.hit && swing.age < 0.055,
  };
}
