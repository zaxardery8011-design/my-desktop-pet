(function () {
  'use strict';

  const api = window.mrwuPet || {
    setIgnoreMouseEvents() {},
    showContextMenu() {}
  };
  const petEl = document.getElementById('pet');
  const petImage = document.getElementById('petImage');
  const bubble = document.getElementById('bubble');
  const sleepZzz = document.getElementById('sleepZzz');
  const alphaCanvas = document.createElement('canvas');
  const alphaCtx = alphaCanvas.getContext('2d', { willReadFrequently: true });

  const STATES = Object.freeze({
    WALK: 'walk',
    RUN: 'run',
    IDLE_LOOK: 'idle-look',
    REST: 'rest',
    SLEEP: 'sleep',
    STRETCH: 'stretch',
    SCRATCH: 'scratch',
    PEEK: 'peek',
    COOL: 'cool',
    FALL: 'fall',
    DRAG: 'drag'
  });

  const groundGap = 6;
  const walkFrameMs = 150;
  const runFrameMs = 70;
  const coolFrameMs = 90;
  const coolRandomChance = 0.035;
  const coolRandomCooldownMs = 75000;
  const sleepAfterMs = 45000;
  const gravityPx = 2100;
  const minPetHeight = 120;
  const maxPetHeight = 160;
  const baseFrameSources = {
    idle: 'assets/frames/idle.png',
    walk1: 'assets/frames/walk1.png',
    walk2: 'assets/frames/walk2.png',
    walk3: 'assets/frames/walk3.png',
    sit: 'assets/frames/sit.png'
  };
  const coolFrameSources = {
    cool_00: 'assets/cool/cool_00.png',
    cool_01: 'assets/cool/cool_01.png',
    cool_02: 'assets/cool/cool_02.png',
    cool_03: 'assets/cool/cool_03.png',
    cool_04: 'assets/cool/cool_04.png',
    cool_05: 'assets/cool/cool_05.png',
    cool_06: 'assets/cool/cool_06.png',
    cool_07: 'assets/cool/cool_07.png',
    cool_08: 'assets/cool/cool_08.png',
    cool_09: 'assets/cool/cool_09.png',
    cool_10: 'assets/cool/cool_10.png',
    cool_11: 'assets/cool/cool_11.png',
    cool_12: 'assets/cool/cool_12.png',
    cool_13: 'assets/cool/cool_13.png',
    cool_14: 'assets/cool/cool_14.png',
    cool_15: 'assets/cool/cool_15.png',
    cool_16: 'assets/cool/cool_16.png',
    cool_17: 'assets/cool/cool_17.png',
    cool_18: 'assets/cool/cool_18.png',
    cool_19: 'assets/cool/cool_19.png',
    cool_20: 'assets/cool/cool_20.png',
    cool_21: 'assets/cool/cool_21.png',
    cool_22: 'assets/cool/cool_22.png',
    cool_23: 'assets/cool/cool_23.png'
  };
  const frameSources = { ...baseFrameSources, ...coolFrameSources };
  const walkFrameKeys = ['walk1', 'walk2', 'walk3'];
  const coolFrameKeys = [
    'cool_00',
    'cool_01',
    'cool_02',
    'cool_03',
    'cool_04',
    'cool_05',
    'cool_06',
    'cool_07',
    'cool_08',
    'cool_09',
    'cool_10',
    'cool_11',
    'cool_12',
    'cool_13',
    'cool_14',
    'cool_15',
    'cool_16',
    'cool_17',
    'cool_18',
    'cool_19',
    'cool_20',
    'cool_21',
    'cool_22',
    'cool_23'
  ];
  const frameKeys = ['idle', 'walk1', 'walk2', 'walk3', 'sit', ...coolFrameKeys];
  const frames = {};

  const stateDurations = {
    [STATES.WALK]: [2600, 7200],
    [STATES.RUN]: [620, 1250],
    [STATES.IDLE_LOOK]: [950, 2800],
    [STATES.REST]: [3300, 7800],
    [STATES.SLEEP]: [12000, 28000],
    [STATES.STRETCH]: [900, 1250],
    [STATES.SCRATCH]: [650, 1050],
    [STATES.PEEK]: [3200, 5400]
  };

  const calmBehaviorWeights = [
    { state: STATES.WALK, weight: 42 },
    { state: STATES.IDLE_LOOK, weight: 27 },
    { state: STATES.REST, weight: 16 },
    { state: STATES.STRETCH, weight: 5 },
    { state: STATES.SCRATCH, weight: 5 },
    { state: STATES.RUN, weight: 3 },
    { state: STATES.PEEK, weight: 2 }
  ];

  const sleepyBehaviorWeights = [
    { state: STATES.SLEEP, weight: 54 },
    { state: STATES.REST, weight: 21 },
    { state: STATES.IDLE_LOOK, weight: 12 },
    { state: STATES.WALK, weight: 7 },
    { state: STATES.STRETCH, weight: 3 },
    { state: STATES.SCRATCH, weight: 2 },
    { state: STATES.RUN, weight: 1 }
  ];

  const speechPool = [
    '嗯？',
    '摸摸？',
    '我在巡邏',
    '肚子餓了',
    '狐獴出動！',
    '今天也要可愛',
    '不要偷懶喔',
    '我有在看',
    '先坐一下',
    '啾咪'
  ];
  const coolSpeechPool = [
    '😎',
    '太陽好大',
    '酷吧'
  ];

  const pet = {
    x: 80,
    y: 0,
    width: 300,
    height: 148,
    dir: 1,
    visualDir: 1,
    lookDir: 1,
    lookUntil: 0,
    speed: 70,
    state: STATES.WALK,
    stateUntil: 0,
    idleFrame: 'idle',
    action: null,
    fall: null,
    lastInteractionAt: 0,
    lastCoolAt: -Infinity,
    nextCursorLookAt: 0
  };

  let currentFrameKey = '';
  let walkFrameIndex = 0;
  let nextWalkFrameAt = 0;
  let lastFrame = 0;
  let ignoreMouse = true;
  let dragging = null;
  let bubbleTimer = null;

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  function pickRandom(items) {
    return items[Math.floor(Math.random() * items.length)];
  }

  function weightedRandom(options) {
    const total = options.reduce((sum, option) => sum + option.weight, 0);
    let cursor = Math.random() * total;

    for (const option of options) {
      cursor -= option.weight;
      if (cursor <= 0) {
        return option;
      }
    }

    return options[options.length - 1];
  }

  function maxX() {
    return Math.max(0, window.innerWidth - pet.width);
  }

  function maxY() {
    return Math.max(0, window.innerHeight - pet.height);
  }

  function groundY() {
    return Math.max(0, window.innerHeight - pet.height - groundGap);
  }

  function setPassthrough(ignore) {
    if (ignoreMouse === ignore) {
      return;
    }

    ignoreMouse = ignore;
    api.setIgnoreMouseEvents(ignore);
  }

  function canUseCursorLook() {
    return ![
      STATES.WALK,
      STATES.RUN,
      STATES.PEEK,
      STATES.COOL,
      STATES.FALL,
      STATES.DRAG
    ].includes(pet.state);
  }

  function currentVisualDir(now = performance.now()) {
    if (canUseCursorLook() && pet.lookUntil > now) {
      return pet.lookDir;
    }

    return pet.dir;
  }

  function syncFloatingLabels() {
    const bubbleX = clamp(
      Math.round(pet.x + pet.width * 0.56),
      8,
      Math.max(8, window.innerWidth - 170)
    );
    const bubbleY = clamp(Math.round(pet.y - 18), 6, Math.max(6, window.innerHeight - 64));
    bubble.style.setProperty('--bubble-x', `${bubbleX}px`);
    bubble.style.setProperty('--bubble-y', `${bubbleY}px`);

    if (sleepZzz) {
      const zzzX = clamp(
        Math.round(pet.x + pet.width * 0.62),
        8,
        Math.max(8, window.innerWidth - 120)
      );
      const zzzY = clamp(Math.round(pet.y - 26), 6, Math.max(6, window.innerHeight - 64));
      sleepZzz.style.setProperty('--zzz-x', `${zzzX}px`);
      sleepZzz.style.setProperty('--zzz-y', `${zzzY}px`);
    }
  }

  function applyPet() {
    pet.x = clamp(pet.x, 0, maxX());
    pet.y = clamp(pet.y, 0, maxY());
    pet.visualDir = currentVisualDir();

    petEl.style.setProperty('--pet-x', `${Math.round(pet.x)}px`);
    petEl.style.setProperty('--pet-y', `${Math.round(pet.y)}px`);
    petEl.style.setProperty('--pet-flip', pet.visualDir < 0 ? '-1' : '1');
    petEl.dataset.state = pet.state;
    petEl.classList.toggle('walking', pet.state === STATES.WALK);
    petEl.classList.toggle('running', pet.state === STATES.RUN);
    petEl.classList.toggle('idle-look', pet.state === STATES.IDLE_LOOK);
    petEl.classList.toggle('resting', pet.state === STATES.REST);
    petEl.classList.toggle('sleeping', pet.state === STATES.SLEEP);
    petEl.classList.toggle('stretching', pet.state === STATES.STRETCH);
    petEl.classList.toggle('scratching', pet.state === STATES.SCRATCH);
    petEl.classList.toggle('peeking', pet.state === STATES.PEEK);
    petEl.classList.toggle('cooling', pet.state === STATES.COOL);
    petEl.classList.toggle('falling', pet.state === STATES.FALL);
    petEl.classList.toggle('dragging', Boolean(dragging));
    petEl.classList.toggle('landing', Boolean(pet.fall && pet.fall.landedAt));
    syncFloatingLabels();
  }

  function frameAspect(frame) {
    return frame.naturalWidth / frame.naturalHeight;
  }

  function measurePet() {
    const viewportHeight = window.innerHeight || 720;
    const height = clamp(Math.round(viewportHeight * 0.16), minPetHeight, maxPetHeight);
    const maxAspect = frameKeys.reduce((max, key) => Math.max(max, frameAspect(frames[key])), 1);
    pet.width = Math.ceil(height * maxAspect);
    pet.height = height;
    petEl.style.setProperty('--pet-width', `${pet.width}px`);
    petEl.style.setProperty('--pet-height', `${pet.height}px`);
    petEl.style.setProperty('--frame-height', `${height}px`);
    pet.x = clamp(pet.x, 0, maxX());
    if (!dragging && pet.state !== STATES.FALL) {
      pet.y = groundY();
    }
    applyPet();
  }

  function buildAlphaMap(frame) {
    alphaCanvas.width = frame.naturalWidth;
    alphaCanvas.height = frame.naturalHeight;
    alphaCtx.clearRect(0, 0, alphaCanvas.width, alphaCanvas.height);
    alphaCtx.drawImage(frame.image, 0, 0);
  }

  function setFrame(frameKey) {
    const frame = frames[frameKey];
    if (!frame || currentFrameKey === frameKey) {
      return;
    }

    currentFrameKey = frameKey;
    petImage.src = frame.src;
    petEl.dataset.frame = frameKey;
    buildAlphaMap(frame);
  }

  function isWalkFrameState() {
    return (
      pet.state === STATES.WALK ||
      pet.state === STATES.RUN ||
      (pet.state === STATES.PEEK && pet.action && pet.action.phase === 'move')
    );
  }

  function syncCoolFrame(now) {
    if (!pet.action || !Array.isArray(pet.action.frames)) {
      setFrame('cool_00');
      return;
    }

    while (now >= pet.action.nextFrameAt && pet.action.frameIndex < pet.action.frames.length - 1) {
      pet.action.frameIndex += 1;
      pet.action.nextFrameAt += coolFrameMs;
    }

    setFrame(pet.action.frames[pet.action.frameIndex]);
  }

  function syncFrame(now) {
    if (pet.state === STATES.COOL) {
      syncCoolFrame(now);
      return;
    }

    if (isWalkFrameState()) {
      const frameMs = pet.state === STATES.RUN ? runFrameMs : walkFrameMs;
      if (!walkFrameKeys.includes(currentFrameKey) || now >= nextWalkFrameAt) {
        setFrame(walkFrameKeys[walkFrameIndex]);
        walkFrameIndex = (walkFrameIndex + 1) % walkFrameKeys.length;
        nextWalkFrameAt = now + frameMs;
      }
      return;
    }

    setFrame(pet.idleFrame === 'sit' ? 'sit' : 'idle');
  }

  function hitTest(clientX, clientY) {
    const rect = petImage.getBoundingClientRect();
    if (
      clientX < rect.left ||
      clientX > rect.right ||
      clientY < rect.top ||
      clientY > rect.bottom ||
      rect.width <= 0 ||
      rect.height <= 0 ||
      alphaCanvas.width <= 0
    ) {
      return false;
    }

    let u = (clientX - rect.left) / rect.width;
    if (pet.visualDir < 0) {
      u = 1 - u;
    }
    const v = (clientY - rect.top) / rect.height;
    const px = clamp(Math.floor(u * alphaCanvas.width), 0, alphaCanvas.width - 1);
    const py = clamp(Math.floor(v * alphaCanvas.height), 0, alphaCanvas.height - 1);
    return alphaCtx.getImageData(px, py, 1, 1).data[3] > 30;
  }

  function chooseDirection() {
    if (pet.x < 20) {
      return 1;
    }
    if (pet.x > maxX() - 20) {
      return -1;
    }
    return Math.random() < 0.5 ? -1 : 1;
  }

  function hideSleepZzz() {
    if (sleepZzz) {
      sleepZzz.classList.remove('show');
    }
  }

  function showSleepZzz() {
    if (sleepZzz) {
      sleepZzz.classList.add('show');
    }
  }

  function setStateUntil(state, now, forcedDuration) {
    const duration = forcedDuration || rand(stateDurations[state][0], stateDurations[state][1]);
    pet.stateUntil = now + duration;
  }

  function startWalk(now, forcedDuration) {
    pet.state = STATES.WALK;
    pet.idleFrame = 'idle';
    pet.action = {
      startX: pet.x,
      distance: rand(140, 460)
    };
    pet.fall = null;
    pet.dir = chooseDirection();
    pet.speed = rand(42, 88);
    setStateUntil(STATES.WALK, now, forcedDuration);
    walkFrameIndex = 0;
    nextWalkFrameAt = now;
  }

  function startRun(now, forcedDuration) {
    pet.state = STATES.RUN;
    pet.idleFrame = 'idle';
    pet.action = {
      startX: pet.x,
      distance: rand(120, 280)
    };
    pet.fall = null;
    pet.dir = chooseDirection();
    pet.speed = rand(165, 230);
    setStateUntil(STATES.RUN, now, forcedDuration);
    walkFrameIndex = 0;
    nextWalkFrameAt = now;
  }

  function startIdleLook(now, forcedDuration) {
    pet.state = STATES.IDLE_LOOK;
    pet.idleFrame = 'idle';
    pet.action = {
      nextLookAt: now + rand(320, 820)
    };
    pet.fall = null;
    if (Math.random() < 0.45) {
      pet.dir = chooseDirection();
    }
    setStateUntil(STATES.IDLE_LOOK, now, forcedDuration);
  }

  function startRest(now, forcedDuration) {
    pet.state = STATES.REST;
    pet.idleFrame = 'sit';
    pet.action = null;
    pet.fall = null;
    setStateUntil(STATES.REST, now, forcedDuration);
  }

  function startSleep(now, forcedDuration) {
    pet.state = STATES.SLEEP;
    pet.idleFrame = 'sit';
    pet.action = null;
    pet.fall = null;
    setStateUntil(STATES.SLEEP, now, forcedDuration);
    showSleepZzz();
  }

  function startStretch(now, forcedDuration) {
    pet.state = STATES.STRETCH;
    pet.idleFrame = 'idle';
    pet.action = null;
    pet.fall = null;
    setStateUntil(STATES.STRETCH, now, forcedDuration);
  }

  function startScratch(now, forcedDuration) {
    pet.state = STATES.SCRATCH;
    pet.idleFrame = 'idle';
    pet.action = null;
    pet.fall = null;
    setStateUntil(STATES.SCRATCH, now, forcedDuration);
  }

  function startPeek(now, forcedDuration) {
    const targetEdge = Math.random() < 0.5 ? 'left' : 'right';
    const targetX = targetEdge === 'left' ? 0 : maxX();

    pet.state = STATES.PEEK;
    pet.idleFrame = 'idle';
    pet.action = {
      phase: 'move',
      edge: targetEdge,
      targetX,
      nextLookAt: 0,
      peekUntil: 0
    };
    pet.fall = null;
    pet.dir = targetEdge === 'left' ? -1 : 1;
    pet.speed = rand(64, 96);
    setStateUntil(STATES.PEEK, now, forcedDuration);
    walkFrameIndex = 0;
    nextWalkFrameAt = now;
  }

  function buildCoolSequence(loopCount) {
    const pingPong = coolFrameKeys.concat(coolFrameKeys.slice(0, -1).reverse());
    const sequence = [];

    for (let index = 0; index < loopCount; index += 1) {
      sequence.push(...pingPong);
    }

    return sequence;
  }

  function startCool(now, _forcedDuration, options = {}) {
    const loops = options.loops || (Math.random() < 0.28 ? 2 : 1);
    const coolFrames = buildCoolSequence(loops);

    pet.state = STATES.COOL;
    pet.idleFrame = 'idle';
    pet.action = {
      frames: coolFrames,
      frameIndex: 0,
      nextFrameAt: now + coolFrameMs
    };
    pet.fall = null;
    pet.stateUntil = now + coolFrames.length * coolFrameMs + 80;
    pet.lastCoolAt = now;
    petEl.classList.remove('reacting');
    setFrame(coolFrames[0]);

    if (options.speak) {
      showSpeech(pickRandom(coolSpeechPool));
    }
  }

  function startFall(now, initialVelocity) {
    pet.state = STATES.FALL;
    pet.idleFrame = 'idle';
    pet.action = null;
    pet.stateUntil = Infinity;
    pet.fall = {
      velocityY: clamp(initialVelocity || 0, 0, 820),
      landedAt: 0,
      landDuration: 430
    };
    hideSleepZzz();
  }

  function startState(state, now, forcedDuration, options = {}) {
    hideSleepZzz();

    if (state === STATES.WALK) {
      startWalk(now, forcedDuration);
    } else if (state === STATES.RUN) {
      startRun(now, forcedDuration);
    } else if (state === STATES.IDLE_LOOK) {
      startIdleLook(now, forcedDuration);
    } else if (state === STATES.REST) {
      startRest(now, forcedDuration);
    } else if (state === STATES.SLEEP) {
      startSleep(now, forcedDuration);
    } else if (state === STATES.STRETCH) {
      startStretch(now, forcedDuration);
    } else if (state === STATES.SCRATCH) {
      startScratch(now, forcedDuration);
    } else if (state === STATES.PEEK) {
      startPeek(now, forcedDuration);
    } else if (state === STATES.COOL) {
      startCool(now, forcedDuration, options);
    }
  }

  function chooseNextState(now) {
    const inactiveFor = now - pet.lastInteractionAt;
    const pool = inactiveFor > sleepAfterMs ? sleepyBehaviorWeights : calmBehaviorWeights;
    return weightedRandom(pool).state;
  }

  function startNextState(now) {
    startState(chooseNextState(now), now);
  }

  function maybeStartRandomCool(now) {
    if (
      now - pet.lastCoolAt >= coolRandomCooldownMs &&
      Math.random() < coolRandomChance
    ) {
      startState(STATES.COOL, now, null, {
        speak: Math.random() < 0.55
      });
      return true;
    }

    return false;
  }

  function showSpeech(text) {
    bubble.textContent = text;
    syncFloatingLabels();
    bubble.classList.remove('show');
    void bubble.offsetWidth;
    bubble.classList.add('show');
    window.clearTimeout(bubbleTimer);
    bubbleTimer = window.setTimeout(() => {
      bubble.classList.remove('show');
      petEl.classList.remove('reacting');
    }, 2600);
  }

  function react(now) {
    petEl.classList.remove('reacting');
    void petEl.offsetWidth;
    petEl.classList.add('reacting');
    showSpeech(pickRandom(speechPool));
    pet.lookUntil = now + 1200;
  }

  function markInteraction(now) {
    pet.lastInteractionAt = now;
    if (pet.state === STATES.SLEEP) {
      hideSleepZzz();
      showSpeech('嗯？醒了');
    }
  }

  function updateWalkLike(now, dt, nextWhenDone) {
    const before = pet.x;
    pet.x += pet.dir * pet.speed * dt;
    const edgeHit = pet.x <= 0 || pet.x >= maxX();
    pet.x = clamp(pet.x, 0, maxX());

    const distance = pet.action ? Math.abs(pet.x - pet.action.startX) : 0;
    const targetReached = pet.action && distance >= pet.action.distance;
    if (edgeHit || targetReached || now >= pet.stateUntil) {
      if (edgeHit && pet.state === STATES.WALK) {
        pet.dir *= -1;
      } else if (pet.x !== before) {
        pet.dir = pet.x > before ? 1 : -1;
      }
      startState(nextWhenDone, now, rand(850, 2100));
    }
  }

  function updateIdleLook(now) {
    if (pet.action && now >= pet.action.nextLookAt) {
      pet.dir = Math.random() < 0.62 ? pet.dir * -1 : chooseDirection();
      pet.action.nextLookAt = now + rand(520, 1250);
    }

    if (now >= pet.stateUntil) {
      if (maybeStartRandomCool(now)) {
        return;
      }
      startNextState(now);
    }
  }

  function updatePeek(now, dt) {
    if (!pet.action) {
      startNextState(now);
      return;
    }

    if (pet.action.phase === 'move') {
      pet.x += pet.dir * pet.speed * dt;
      const reachedLeft = pet.action.edge === 'left' && pet.x <= pet.action.targetX;
      const reachedRight = pet.action.edge === 'right' && pet.x >= pet.action.targetX;
      if (reachedLeft || reachedRight || now >= pet.stateUntil - 1500) {
        pet.x = pet.action.targetX;
        pet.action.phase = 'look';
        pet.action.peekUntil = now + rand(1200, 2400);
        pet.action.nextLookAt = now + rand(240, 620);
        pet.dir = pet.action.edge === 'left' ? 1 : -1;
      }
      return;
    }

    if (now >= pet.action.nextLookAt) {
      pet.dir = pet.action.edge === 'left' ? (pet.dir > 0 ? -1 : 1) : (pet.dir < 0 ? 1 : -1);
      pet.action.nextLookAt = now + rand(360, 800);
    }

    if (now >= pet.action.peekUntil || now >= pet.stateUntil) {
      startNextState(now);
    }
  }

  function updateFall(now, dt) {
    if (!pet.fall) {
      startNextState(now);
      return;
    }

    if (pet.fall.landedAt) {
      if (now - pet.fall.landedAt >= pet.fall.landDuration) {
        pet.fall = null;
        startState(STATES.IDLE_LOOK, now, rand(1100, 2200));
      }
      return;
    }

    pet.fall.velocityY += gravityPx * dt;
    pet.y += pet.fall.velocityY * dt;
    if (pet.y >= groundY()) {
      pet.y = groundY();
      pet.fall.landedAt = now;
      pet.fall.velocityY = 0;
    }
  }

  function updateCool(now) {
    if (!pet.action || now >= pet.stateUntil) {
      startState(STATES.IDLE_LOOK, now, rand(900, 1700));
    }
  }

  function maybeLookAtCursor(event, now) {
    const centerX = pet.x + pet.width * 0.5;
    const centerY = pet.y + pet.height * 0.52;
    const distance = Math.hypot(event.clientX - centerX, event.clientY - centerY);
    if (
      distance > 210 ||
      !canUseCursorLook() ||
      now < pet.nextCursorLookAt
    ) {
      return;
    }

    pet.nextCursorLookAt = now + rand(1400, 3400);
    if (Math.random() < 0.68) {
      pet.lookDir = event.clientX >= centerX ? 1 : -1;
      pet.lookUntil = now + rand(700, 1500);
      applyPet();
    }
  }

  function update(now) {
    const dt = Math.min((now - lastFrame) / 1000 || 0, 0.05);
    lastFrame = now;

    if (!dragging) {
      if (pet.state === STATES.WALK) {
        updateWalkLike(now, dt, STATES.IDLE_LOOK);
      } else if (pet.state === STATES.RUN) {
        updateWalkLike(now, dt, STATES.IDLE_LOOK);
      } else if (pet.state === STATES.IDLE_LOOK) {
        updateIdleLook(now);
      } else if (pet.state === STATES.REST) {
        if (now >= pet.stateUntil) {
          startNextState(now);
        }
      } else if (pet.state === STATES.SLEEP) {
        showSleepZzz();
        if (now >= pet.stateUntil) {
          startNextState(now);
        }
      } else if (pet.state === STATES.STRETCH || pet.state === STATES.SCRATCH) {
        if (now >= pet.stateUntil) {
          startNextState(now);
        }
      } else if (pet.state === STATES.PEEK) {
        updatePeek(now, dt);
      } else if (pet.state === STATES.COOL) {
        updateCool(now);
      } else if (pet.state === STATES.FALL) {
        updateFall(now, dt);
      }
    }

    syncFrame(now);
    applyPet();
    window.requestAnimationFrame(update);
  }

  function onMouseMove(event) {
    const now = performance.now();

    if (dragging) {
      const nextX = event.clientX - dragging.offsetX;
      const nextY = event.clientY - dragging.offsetY;
      const moved = Math.hypot(event.clientX - dragging.startX, event.clientY - dragging.startY);
      const elapsed = Math.max(16, now - dragging.lastAt);
      dragging.moved = dragging.moved || moved > 5;
      dragging.velocityY = ((nextY - dragging.lastY) / elapsed) * 1000;
      dragging.lastY = nextY;
      dragging.lastAt = now;
      pet.x = clamp(nextX, 0, maxX());
      pet.y = clamp(nextY, 0, maxY());
      pet.dir = event.clientX >= dragging.startX ? 1 : -1;
      applyPet();
      setPassthrough(false);
      event.preventDefault();
      return;
    }

    const hittingPet = hitTest(event.clientX, event.clientY);
    maybeLookAtCursor(event, now);
    setPassthrough(!hittingPet);
  }

  function onMouseDown(event) {
    if (event.button !== 0 || !hitTest(event.clientX, event.clientY)) {
      return;
    }

    const now = performance.now();
    const rect = petEl.getBoundingClientRect();
    markInteraction(now);
    dragging = {
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      startX: event.clientX,
      startY: event.clientY,
      lastY: pet.y,
      lastAt: now,
      velocityY: 0,
      moved: false
    };
    pet.state = STATES.DRAG;
    pet.idleFrame = 'idle';
    pet.action = null;
    pet.fall = null;
    hideSleepZzz();
    setFrame('idle');
    setPassthrough(false);
    applyPet();
    event.preventDefault();
  }

  function onMouseUp(event) {
    if (!dragging) {
      return;
    }

    const now = performance.now();
    const releasedDrag = dragging;
    const wasClick = !releasedDrag.moved;
    dragging = null;
    markInteraction(now);

    if (wasClick) {
      pet.y = Math.min(pet.y, groundY());
      react(now);
      startState(STATES.IDLE_LOOK, now, rand(1100, 1900));
    } else if (pet.y < groundY() - 24 || releasedDrag.velocityY > 180) {
      startFall(now, releasedDrag.velocityY);
    } else {
      pet.y = groundY();
      startState(STATES.IDLE_LOOK, now, rand(900, 1800));
    }

    setPassthrough(!hitTest(event.clientX, event.clientY));
    applyPet();
    event.preventDefault();
  }

  function onDoubleClick(event) {
    if (event.button !== 0 || !hitTest(event.clientX, event.clientY)) {
      return;
    }

    const now = performance.now();
    markInteraction(now);
    startState(STATES.COOL, now, null, {
      loops: 2,
      speak: true
    });
    setPassthrough(false);
    applyPet();
    event.preventDefault();
  }

  function onContextMenu(event) {
    if (!hitTest(event.clientX, event.clientY)) {
      return;
    }

    event.preventDefault();
    setPassthrough(false);
    api.showContextMenu({ x: event.clientX, y: event.clientY });
  }

  function loadFrame(key) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      const src = frameSources[key];

      image.onload = () => {
        resolve({
          key,
          src,
          image,
          naturalWidth: image.naturalWidth,
          naturalHeight: image.naturalHeight
        });
      };
      image.onerror = () => {
        reject(new Error(`Failed to load pet frame: ${src}`));
      };
      image.decoding = 'async';
      image.src = src;
    });
  }

  async function loadFrames() {
    const loadedFrames = await Promise.all(frameKeys.map(loadFrame));
    for (const frame of loadedFrames) {
      frames[frame.key] = frame;
    }
  }

  function exposeDebugState() {
    window.__mrwuPetDebug = {
      STATES,
      snapshot() {
        return {
          state: pet.state,
          frame: currentFrameKey,
          coolFrameIndex: pet.state === STATES.COOL && pet.action ? pet.action.frameIndex : null,
          x: Math.round(pet.x),
          y: Math.round(pet.y),
          dir: pet.dir,
          visualDir: pet.visualDir,
          bubble: bubble.textContent,
          zzzVisible: Boolean(sleepZzz && sleepZzz.classList.contains('show')),
          ignoredMouse: ignoreMouse
        };
      },
      alphaProbe() {
        const rect = petImage.getBoundingClientRect();
        let opaquePoint = null;

        for (let y = 0; y < alphaCanvas.height && !opaquePoint; y += 4) {
          for (let x = 0; x < alphaCanvas.width; x += 4) {
            if (alphaCtx.getImageData(x, y, 1, 1).data[3] > 30) {
              opaquePoint = { x, y };
              break;
            }
          }
        }

        if (!opaquePoint) {
          return {
            frame: currentFrameKey,
            opaque: false,
            transparentTopLeft: hitTest(rect.left + 1, rect.top + 1)
          };
        }

        const sourceU = (opaquePoint.x + 0.5) / alphaCanvas.width;
        const renderedU = pet.visualDir < 0 ? 1 - sourceU : sourceU;
        const clientX = rect.left + renderedU * rect.width;
        const clientY = rect.top + ((opaquePoint.y + 0.5) / alphaCanvas.height) * rect.height;

        return {
          frame: currentFrameKey,
          opaque: hitTest(clientX, clientY),
          transparentTopLeft: hitTest(rect.left + 1, rect.top + 1),
          opaquePoint
        };
      },
      forceState(state) {
        if (Object.values(STATES).includes(state) && state !== STATES.FALL && state !== STATES.DRAG) {
          startState(state, performance.now());
          applyPet();
        }
      }
    };
  }

  async function boot() {
    await loadFrames();
    const now = performance.now();
    setFrame('idle');
    measurePet();
    pet.x = rand(20, Math.max(21, maxX() - 20));
    pet.y = groundY();
    pet.lastInteractionAt = now;
    startState(STATES.WALK, now);
    if (new URLSearchParams(window.location.search).has('debug')) {
      exposeDebugState();
    }
    api.setIgnoreMouseEvents(true);
    window.addEventListener('mousemove', onMouseMove, true);
    window.addEventListener('mousedown', onMouseDown, true);
    window.addEventListener('mouseup', onMouseUp, true);
    window.addEventListener('dblclick', onDoubleClick, true);
    window.addEventListener('contextmenu', onContextMenu, true);
    window.addEventListener('mouseleave', () => {
      if (!dragging) {
        pet.lookUntil = 0;
        setPassthrough(true);
        applyPet();
      }
    });
    window.addEventListener('resize', measurePet);
    window.requestAnimationFrame(update);
  }

  boot().catch((error) => {
    console.error(error);
    api.setIgnoreMouseEvents(true);
  });
})();
