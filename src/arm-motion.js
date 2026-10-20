import { emotionArms, EMOTIONS } from './emotions.js';
import { receiveWrists } from './receive-pose.js';
// Presentation only: a complete pose blends back to the current locomotion pose.
const clamp = (v, min = 0, max = 1) => Math.max(min, Math.min(max, v));
const ease = (v) => {
  const t = clamp(v);
  return t * t * (3 - 2 * t);
};
const mix = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
const pairMix = (a, b, t) => a.map((point, i) => mix(point, b[i], t));
const lowerOverheadHand = (from, to, t, side, scale) => {
  const u = 1 - t;
  const outside = to.x + side * 10 * Math.max(1, scale);
  return {
    x: u ** 3 * from.x + 3 * u * t * outside + t ** 3 * to.x,
    y:
      u ** 3 * from.y +
      3 * u * u * t * Math.min(from.y, -49 * Math.max(1, scale)) +
      (3 * u * t * t + t ** 3) * to.y,
  };
};
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
  diveTarget = null,
  bodyTilt = 0,
  bodyOffsetY = 0,
  recoveryPose = null,
  step = 0,
  contactPoint = null,
  receiveHoldPoint = null,
  serve = null,
  serveSupport = null,
  localVelocity = null,
  localIncomingVelocity = null,
  actionDirection = kind === 'back' ? -1 : 1,
  receiveAim = null,
  emotion = null,
  shoulderLift = 0,
}) {
  const power = clamp(charge?.power ?? serve?.power ?? swing?.power ?? 0.35),
    amp = 1.3 * power * config.armPowerMotion;
  const scale = spec.size * (config.armLength ?? 1);
  const scaled = (points) =>
    points.map((p, i) => ({
      x: (i ? 6 : -6) + (p.x - (i ? 6 : -6)) * scale,
      y: -20 + (p.y + 20) * scale,
    }));
  let base = idle.map((p, i) => ({
      ...p,
      x: p.x + (i ? 1 : -1) * step * 1.4,
      y: p.y - Math.abs(step) * 0.25,
    })),
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
      { x: 2, y: -43 },
      { x: 8, y: -43 },
    ];
    stage = 'Блок';
  }
  base = scaled(base);
  // Keep the reach horizontal in world space while the torso tips forward.
  if (diving && (diveForward || diveTarget)) {
    base = [-1, 1].map((side) => ({
      x: side * 3 + 25 * Math.cos(bodyTilt),
      y: -20 - 25 * Math.sin(bodyTilt),
    }));
    stage = 'Руки вперёд';
    if (diveTarget) base = [-1, 1].map((side) => ({ x: diveTarget.x + side * 2, y: diveTarget.y }));
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
    travel = (config.armFollowThrough ?? 5) * scale;
  const upperReceive = kind === 'loft' && !serve && !swing?.serve;
  const strokeTime = upperReceive
    ? Math.min(0.035, speed > 0 ? travel / speed : 0)
    : speed > 0
      ? travel / speed
      : 0.08;
  const follow = (hit, age, indices = [0, 1]) =>
    hit.map((p, i) => {
      const time = Math.min(Math.max(age, 0), strokeTime);
      return indices.includes(i) ? { x: p.x + velocity.x * time, y: p.y + velocity.y * time } : p;
    });
  const recoveryStart = Math.max(0.09, strokeTime);

  const reception =
    !serve && !swing?.serve && !diving
      ? receiveWrists(kind, receiveAim, amp, actionDirection)
      : null;
  const gentleLoft = kind === 'loft' && !!(charge?.aim?.soft || swing?.aim?.soft);
  const powerDrive =
    kind === 'drive' &&
    !serve &&
    !swing?.serve &&
    !!(charge?.aim?.fast || swing?.aim?.fast) &&
    !(charge?.aim?.soft || swing?.aim?.soft);
  const oneHand = kind !== 'loft' && !!(charge?.aim?.soft || swing?.aim?.soft);
  const activeHands = oneHand ? [1] : reception?.hands || [0, 1];
  const ready =
    diving && (diveForward || diveTarget)
      ? base
      : scaled(
          reception
            ? reception.wrists
            : diving
              ? [
                  { x: 6, y: -39 },
                  { x: 10, y: -40 },
                ]
              : kind === 'back'
                ? [
                    { x: actionDirection * 9, y: -33 - amp },
                    { x: actionDirection * 3, y: -36 - amp },
                  ]
                : kind === 'low'
                  ? [
                      { x: 5, y: -11 - amp * 2 },
                      { x: 9, y: -11 - amp * 2 },
                    ]
                  : kind === 'loft'
                    ? [
                        { x: 1, y: -38 - amp * 0.5 },
                        { x: 7, y: -38 - amp * 0.5 },
                      ]
                    : [
                        { x: 12, y: -27 },
                        { x: actionDirection * (-8 - amp * 2), y: -33 - amp },
                      ],
        );
  if (gentleLoft)
    for (let i = 0; i < 2; i++) {
      ready[i].x += (i ? 1 : -1) * 2 * scale;
      ready[i].y -= 2 * scale;
    }
  if (powerDrive) {
    [ready[0], ready[1]] = [ready[1], ready[0]];
  }
  if (charge) {
    activity = ease((charge.age ?? 0.1) / config.armWindup);
    wrists = pairMix(base, ready, activity);
    stage = 'Подготовка';
    if (charge.receiveHold && receiveHoldPoint && ['low', 'loft'].includes(kind)) {
      const spread = kind === 'low' ? 2 : gentleLoft ? 5.5 : 3.5;
      const below = kind === 'low' ? 3 : 2;
      const target = [-1, 1].map((side) => ({
        x: receiveHoldPoint.x + side * spread,
        y: receiveHoldPoint.y + below - shoulderLift,
      }));
      activity = 1;
      wrists = pairMix(base, target, activity);
      stage = 'Сопровождение мяча';
    }
  }
  if (swing && !charge && !block && kind !== 'block') {
    const age = swing.age;
    if (!swing.hit) {
      const recoil = scaled(
        kind === 'back'
          ? [
              { x: actionDirection * 5, y: -29 },
              { x: 0, y: -32 },
            ]
          : kind === 'drive'
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
        kind === 'back'
          ? [
              { x: actionDirection * 23, y: -39 },
              { x: actionDirection * 17, y: -42 },
            ]
          : kind === 'drive'
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
      if (powerDrive) {
        [recoil[0], recoil[1]] = [recoil[1], recoil[0]];
        [end[0], end[1]] = [end[1], end[0]];
      }
      const stroke = reception
        ? follow(ready, age, activeHands)
        : age < 0.035
          ? pairMix(ready, recoil, ease(age / 0.035))
          : pairMix(recoil, end, ease((age - 0.035) / 0.065));
      activity = 1 - ease((age - 0.1) / 0.15);
      wrists = pairMix(base, stroke, activity);
      stage = age < 0.1 ? 'Взмах после отпускания' : activity > 0 ? 'Возврат' : stage;
    } else {
      const point = contactPoint || { x: 10, y: kind === 'low' ? -14 : -40 };
      const hand = swing.hand ?? (point.x < 0 ? 0 : 1);
      const hit =
        kind === 'back'
          ? base.map((p, i) => (i === hand ? { ...point } : p))
          : kind === 'drive'
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
                  { x: point.x - (gentleLoft ? 5.5 : 3.5), y: point.y + 2 },
                  { x: point.x + (gentleLoft ? 5.5 : 3.5), y: point.y + 2 },
                ];
      if (powerDrive) [hit[0], hit[1]] = [hit[1], hit[0]];
      const stroke = follow(
        hit,
        age,
        kind === 'back' ? [hand] : kind === 'drive' ? [powerDrive ? 0 : 1] : [0, 1],
      );
      if (kind === 'low' && !diving && !swing.serve && localIncomingVelocity) {
        // A short visual cushion, then a push. Logical contact and ball motion
        // still happen immediately and use the existing contact checks.
        const incomingSpeed = Math.hypot(localIncomingVelocity.x, localIncomingVelocity.y);
        const cushion = incomingSpeed ? Math.min(2 * scale, incomingSpeed * 0.018) : 0;
        const pull = ease(age / 0.035) * (1 - ease((age - 0.035) / 0.05));
        const push = ease((age - 0.035) / 0.05);
        for (const i of activeHands) {
          stroke[i].x =
            hit[i].x +
            (incomingSpeed ? (localIncomingVelocity.x / incomingSpeed) * cushion * pull : 0) +
            (stroke[i].x - hit[i].x) * push;
          stroke[i].y =
            hit[i].y +
            (incomingSpeed ? (localIncomingVelocity.y / incomingSpeed) * cushion * pull : 0) +
            (stroke[i].y - hit[i].y) * push;
        }
      }
      const overhead = kind === 'loft';
      activity =
        1 - ease((age - (overhead ? strokeTime : recoveryStart)) / (overhead ? 0.22 : 0.23));
      wrists = overhead
        ? stroke.map((point, i) =>
            lowerOverheadHand(point, base[i], 1 - activity, i ? 1 : -1, scale),
          )
        : pairMix(base, stroke, activity);
      stage =
        age < strokeTime
          ? 'Контакт!'
          : !overhead && age < recoveryStart
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
      {
        x:
          actionDirection *
          (type === 'low' ? -9 : type === 'back' ? -14 : type === 'drive' ? -15 : -8),
        y: type === 'low' ? -7 : type === 'back' ? -10 : type === 'drive' ? -42 : -35,
      },
    ])[1];
    const readyServe = scaled([
      { x: -9, y: -18 },
      { x: 10, y: -18 },
    ]);
    readyServe[hand] = strikeReady;
    if (type === 'back' && serve) {
      // The free hand tosses low, then drops while the striking hand waits below.
      const toss = Math.sin(Math.PI * clamp(age / 0.32));
      readyServe[1 - hand] = { x: 9 * actionDirection, y: -17 - 8 * toss };
    }
    if (serve) {
      wrists = pairMix(base, readyServe, ease(age / 0.4));
      stage =
        type === 'low'
          ? 'Нижняя подача'
          : type === 'back'
            ? 'Подброс и подсечка снизу'
            : type === 'drive'
              ? 'Разбег и прыжок'
              : 'Верхняя подача';
    } else if (!swing.hit) {
      const end = base.map((p, i) =>
        i === hand
          ? { x: type === 'back' ? 19 : 13, y: type === 'low' ? -17 : type === 'back' ? -19 : -40 }
          : p,
      );
      const stroke = pairMix(readyServe, end, ease(swing.age / 0.1));
      activity = 1 - ease((swing.age - 0.1) / 0.23);
      wrists = pairMix(base, stroke, activity);
      stage = activity > 0 ? 'Промах на подаче' : stage;
    } else {
      const point = contactPoint || {
        x: 15,
        y: type === 'low' ? -12 : type === 'back' ? -19 : -40,
      };
      const hit = base.map((p, i) => (i === hand ? { x: point.x, y: point.y } : p));
      const upperServe = type === 'loft' || type === 'drive';
      // A serve is a compact palm strike, not the longer rally follow-through.
      // Keep the exact contact point, then release the arm promptly instead
      // of stretching it another five rig pixels and holding it above the head.
      const serveFollow = upperServe
        ? hit.map((p, i) => {
            const time = Math.min(Math.max(swing.age, 0), speed > 0 ? (1.4 * scale) / speed : 0);
            return i === hand ? { x: p.x + velocity.x * time, y: p.y + velocity.y * time } : p;
          })
        : follow(hit, swing.age, [hand]);
      activity = upperServe
        ? 1 - ease((swing.age - 0.035) / 0.18)
        : 1 - ease((swing.age - recoveryStart) / 0.23);
      wrists = pairMix(base, serveFollow, activity);
      stage = activity > 0 ? 'Подача одной рукой' : stage;
    }
    if (serve) activity = 1;
  }
  if (emotion) {
    wrists = emotionArms(emotion, base);
    stage = EMOTIONS[emotion.kind];
    activity = 0;
  }
  if (oneHand && !serve && !swing?.serve) wrists[0] = { ...base[0] };
  wrists = wrists.map((p) => ({ ...p, y: p.y + shoulderLift }));
  if (serveSupport) {
    const { hand, point, weight } = serveSupport;
    wrists[hand] = mix(wrists[hand], point, weight);
    if (serveSupport.attached) stage = serve ? 'Подброс с ладони' : 'Мяч на ладони';
  }

  if (recoveryPose) {
    wrists = base;
    activity = 0;
  }
  const elbows = wrists
    .map((p, i) => {
      const shoulder = { x: i ? spec.shoulder : -spec.shoulder, y: -20 + shoulderLift };
      const serveKind = serve?.kind || (swing?.serve ? kind : serveSupport ? 'low' : null);
      const lowerServe = {
        x: shoulder.x + (p.x - shoulder.x) * 0.52 + (i ? 2 : -2),
        y: shoulder.y + (p.y - shoulder.y) * 0.52 + 2,
      };
      if (serveKind === 'low' || serveKind === 'back') return lowerServe;
      const rest = {
        x: (shoulder.x + p.x) / 2 + (i ? 1 : -1) * (block ? 3 : 6) * config.armBend,
        y: (shoulder.y + p.y) / 2 + 5 * config.armBend,
      };
      if (serveKind) {
        const transition = serve ? ease((serve.age || 0) / 0.4) : 1;
        const upperServe = {
          ...rest,
          x: rest.x + (i ? 1 : -1) * amp * 3 * config.armBend * activity,
        };
        return mix(lowerServe, upperServe, transition);
      }
      if (block) return { x: i ? 10 : -3, y: -31 + shoulderLift };
      if (kind === 'loft' && !serve && !swing?.serve)
        return mix(
          rest,
          {
            x: (i ? 11 + (gentleLoft ? 3 : 0) : -9 - (gentleLoft ? 3 : 0)) * config.armBend,
            y: (shoulder.y + p.y) / 2 + 2,
          },
          activity,
        );
      return { ...rest, x: rest.x + (i ? 1 : -1) * amp * 3 * config.armBend * activity };
    })
    .map((p, i) => ({
      ...p,
      x: p.x + (i ? 1 : -1) * 10 * ((config.armLength ?? 1) - 1),
      y: p.y - (config.elbowHeight || 0),
    }));
  const shoulders = [
    { x: -spec.shoulder, y: -20 + shoulderLift },
    { x: spec.shoulder, y: -20 + shoulderLift },
  ];
  return {
    wrists,
    activeHands,
    elbows,
    shoulders,
    power: activity > 0 ? power : 0.35,
    stage,
    cup: kind === 'loft' && !serve && !swing?.serve ? activity : 0,
    snap: !!swing?.hit && swing.age < 0.055,
  };
}
