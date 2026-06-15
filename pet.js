(function () {
  'use strict';

  const api = window.mrwuPet || {
    setIgnoreMouseEvents() {},
    showContextMenu() {},
    async getScale() { return 1; },
    async setScale(scale) { return scale; },
    onScaleChanged() { return () => {}; }
  };
  const petEl = document.getElementById('pet');
  const petSprite = document.getElementById('petSprite');
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
    PET_ACTION: 'pet-action',
    COOL: 'cool',
    FALL: 'fall',
    DRAG: 'drag'
  });

  const BEHAVIOR_STATES = Object.freeze({
    IDLE: 'idle',
    MOVE: 'move',
    GROOM: 'groom',
    ALERT: 'alert',
    FEED: 'feed',
    REST: 'rest',
    SOCIAL: 'social',
    PLAY: 'play',
    SPECIAL: 'special'
  });

  const ACTION_TAXONOMY = Object.freeze({
    walk: BEHAVIOR_STATES.MOVE,
    scratch: BEHAVIOR_STATES.GROOM,
    eat: BEHAVIOR_STATES.FEED,
    sleep: BEHAVIOR_STATES.REST,
    sniff: BEHAVIOR_STATES.ALERT,
    alert: BEHAVIOR_STATES.ALERT,
    dig: BEHAVIOR_STATES.PLAY,
    yawn: BEHAVIOR_STATES.REST,
    cheer: BEHAVIOR_STATES.SOCIAL,
    sign: BEHAVIOR_STATES.SPECIAL,
    applaud: BEHAVIOR_STATES.SOCIAL,
    drink: BEHAVIOR_STATES.FEED
  });

  const groundGap = 6;
  const walkFrameMs = 150;
  const runFrameMs = 70;
  const coolFrameMs = 42;
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
  const walkFrameKeys = ['walk1', 'walk2', 'walk3'];
  const coolFrameKeys = Array.from({ length: 121 }, (_value, index) => {
    return `cool_${String(index).padStart(3, '0')}`;
  });
  if (coolFrameKeys[0] !== 'cool_000' || coolFrameKeys[coolFrameKeys.length - 1] !== 'cool_120') {
    throw new Error('Invalid cool frame range');
  }
  const coolFrameSources = coolFrameKeys.reduce((sources, key) => {
    sources[key] = `assets/cool/${key}.png`;
    return sources;
  }, {});
  const frameSources = { ...baseFrameSources, ...coolFrameSources };
  const frameKeys = ['idle', 'walk1', 'walk2', 'walk3', 'sit', ...coolFrameKeys];
  const frames = {};
  const generatedActions = {};

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

  const BEHAVIOR_TREE_CONFIG = Object.freeze({
    crossFadeMs: 150,
    idleBiasAfterMs: sleepAfterMs,
    states: {
      [BEHAVIOR_STATES.IDLE]: {
        durationMs: [1800, 5200],
        actions: [
          { state: STATES.IDLE_LOOK, weight: 76 },
          { state: STATES.STRETCH, weight: 24 }
        ],
        transitions: [
          { state: BEHAVIOR_STATES.IDLE, weight: 33 },
          { state: BEHAVIOR_STATES.MOVE, weight: 24 },
          { state: BEHAVIOR_STATES.GROOM, weight: 15 },
          { state: BEHAVIOR_STATES.PLAY, weight: 13 },
          { state: BEHAVIOR_STATES.REST, weight: 8 },
          { state: BEHAVIOR_STATES.ALERT, weight: 5 },
          { state: BEHAVIOR_STATES.SPECIAL, weight: 2 }
        ]
      },
      [BEHAVIOR_STATES.MOVE]: {
        durationMs: [2600, 7600],
        actions: [
          { action: 'walk', weight: 58, loop: true },
          { state: STATES.WALK, weight: 20 },
          { state: STATES.PEEK, weight: 14 },
          { state: STATES.RUN, weight: 8 }
        ],
        transitions: [
          { state: BEHAVIOR_STATES.IDLE, weight: 24 },
          { state: BEHAVIOR_STATES.REST, weight: 24 },
          { state: BEHAVIOR_STATES.GROOM, weight: 16 },
          { state: BEHAVIOR_STATES.ALERT, weight: 12 },
          { state: BEHAVIOR_STATES.PLAY, weight: 10 },
          { state: BEHAVIOR_STATES.FEED, weight: 6 },
          { state: BEHAVIOR_STATES.SOCIAL, weight: 5 },
          { state: BEHAVIOR_STATES.SPECIAL, weight: 3 }
        ]
      },
      [BEHAVIOR_STATES.GROOM]: {
        durationMs: [2400, 6800],
        actions: [
          { action: 'scratch', weight: 78, loop: true },
          { state: STATES.SCRATCH, weight: 22 }
        ],
        transitions: [
          { state: BEHAVIOR_STATES.IDLE, weight: 54 },
          { state: BEHAVIOR_STATES.REST, weight: 20 },
          { state: BEHAVIOR_STATES.MOVE, weight: 10 },
          { state: BEHAVIOR_STATES.ALERT, weight: 8 },
          { state: BEHAVIOR_STATES.SOCIAL, weight: 6 },
          { state: BEHAVIOR_STATES.SPECIAL, weight: 2 }
        ]
      },
      [BEHAVIOR_STATES.ALERT]: {
        durationMs: [1700, 5200],
        actions: [
          { action: 'sniff', weight: 44, loop: true },
          { action: 'alert', weight: 40, loop: true },
          { state: STATES.IDLE_LOOK, weight: 16 }
        ],
        transitions: [
          { state: BEHAVIOR_STATES.IDLE, weight: 62 },
          { state: BEHAVIOR_STATES.MOVE, weight: 18 },
          { state: BEHAVIOR_STATES.GROOM, weight: 8 },
          { state: BEHAVIOR_STATES.REST, weight: 5 },
          { state: BEHAVIOR_STATES.PLAY, weight: 5 },
          { state: BEHAVIOR_STATES.SPECIAL, weight: 2 }
        ]
      },
      [BEHAVIOR_STATES.FEED]: {
        durationMs: [3600, 8600],
        actions: [
          { action: 'eat', weight: 56, loop: true },
          { action: 'drink', weight: 38, loop: true },
          { state: STATES.REST, weight: 6 }
        ],
        transitions: [
          { state: BEHAVIOR_STATES.GROOM, weight: 90 },
          { state: BEHAVIOR_STATES.REST, weight: 6 },
          { state: BEHAVIOR_STATES.IDLE, weight: 4 }
        ]
      },
      [BEHAVIOR_STATES.REST]: {
        durationMs: [5200, 18000],
        actions: [
          { action: 'sleep', weight: 46, loop: true },
          { action: 'yawn', weight: 28 },
          { state: STATES.REST, weight: 18 },
          { state: STATES.SLEEP, weight: 8 }
        ],
        transitions: [
          { state: BEHAVIOR_STATES.REST, weight: 88 },
          { state: BEHAVIOR_STATES.IDLE, weight: 7 },
          { state: BEHAVIOR_STATES.GROOM, weight: 2 },
          { state: BEHAVIOR_STATES.MOVE, weight: 1 },
          { state: BEHAVIOR_STATES.ALERT, weight: 1 },
          { state: BEHAVIOR_STATES.SPECIAL, weight: 1 }
        ]
      },
      [BEHAVIOR_STATES.SOCIAL]: {
        durationMs: [2800, 7600],
        actions: [
          { action: 'cheer', weight: 48 },
          { action: 'applaud', weight: 44 },
          { state: STATES.IDLE_LOOK, weight: 8 }
        ],
        transitions: [
          { state: BEHAVIOR_STATES.IDLE, weight: 45 },
          { state: BEHAVIOR_STATES.PLAY, weight: 24 },
          { state: BEHAVIOR_STATES.GROOM, weight: 10 },
          { state: BEHAVIOR_STATES.MOVE, weight: 10 },
          { state: BEHAVIOR_STATES.SPECIAL, weight: 6 },
          { state: BEHAVIOR_STATES.REST, weight: 5 }
        ]
      },
      [BEHAVIOR_STATES.PLAY]: {
        durationMs: [2600, 7200],
        actions: [
          { action: 'dig', weight: 76, loop: true },
          { state: STATES.RUN, weight: 24 }
        ],
        transitions: [
          { state: BEHAVIOR_STATES.IDLE, weight: 30 },
          { state: BEHAVIOR_STATES.REST, weight: 22 },
          { state: BEHAVIOR_STATES.MOVE, weight: 18 },
          { state: BEHAVIOR_STATES.SOCIAL, weight: 12 },
          { state: BEHAVIOR_STATES.GROOM, weight: 8 },
          { state: BEHAVIOR_STATES.ALERT, weight: 6 },
          { state: BEHAVIOR_STATES.SPECIAL, weight: 4 }
        ]
      },
      [BEHAVIOR_STATES.SPECIAL]: {
        durationMs: [4200, 8200],
        actions: [
          { action: 'sign', weight: 58 },
          { state: STATES.COOL, weight: 42 }
        ],
        transitions: [
          { state: BEHAVIOR_STATES.IDLE, weight: 70 },
          { state: BEHAVIOR_STATES.SOCIAL, weight: 10 },
          { state: BEHAVIOR_STATES.REST, weight: 8 },
          { state: BEHAVIOR_STATES.MOVE, weight: 6 },
          { state: BEHAVIOR_STATES.GROOM, weight: 4 },
          { state: BEHAVIOR_STATES.ALERT, weight: 2 }
        ]
      }
    }
  });

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
    animation: null,
    fall: null,
    behaviorState: BEHAVIOR_STATES.MOVE,
    behaviorStartedAt: 0,
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
  let petScale = 1;
  const frameFadeImage = petImage.cloneNode(false);
  let frameFadeAnimation = null;
  let pendingFrameCrossFade = false;

  frameFadeImage.removeAttribute('id');
  frameFadeImage.setAttribute('aria-hidden', 'true');
  frameFadeImage.style.position = 'absolute';
  frameFadeImage.style.left = '50%';
  frameFadeImage.style.bottom = '0';
  frameFadeImage.style.opacity = '0';
  frameFadeImage.style.transform = 'translateX(-50%)';
  frameFadeImage.style.pointerEvents = 'none';
  if (petSprite) {
    petSprite.appendChild(frameFadeImage);
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function normalizePetScale(value) {
    const scale = Number(value);
    return Number.isFinite(scale) ? clamp(scale, 0.5, 3) : 1;
  }

  function setPetScale(value) {
    const nextScale = normalizePetScale(value);
    if (Math.abs(petScale - nextScale) < 0.001) {
      return;
    }

    petScale = nextScale;
    if (Object.keys(frames).length > 0) {
      measurePet();
    }
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

  function setBehaviorState(behaviorState, now) {
    if (!behaviorState) {
      return;
    }

    pet.behaviorState = behaviorState;
    pet.behaviorStartedAt = now;
  }

  function inferBehaviorStateForState(state) {
    if (state === STATES.WALK || state === STATES.RUN || state === STATES.PEEK) {
      return BEHAVIOR_STATES.MOVE;
    }
    if (state === STATES.SCRATCH) {
      return BEHAVIOR_STATES.GROOM;
    }
    if (state === STATES.REST || state === STATES.SLEEP) {
      return BEHAVIOR_STATES.REST;
    }
    if (state === STATES.COOL) {
      return BEHAVIOR_STATES.SPECIAL;
    }
    if (state === STATES.IDLE_LOOK || state === STATES.STRETCH) {
      return BEHAVIOR_STATES.IDLE;
    }
    if (state === STATES.DRAG || state === STATES.FALL) {
      return BEHAVIOR_STATES.ALERT;
    }
    return null;
  }

  function inferBehaviorStateForAction(actionName) {
    return ACTION_TAXONOMY[actionName] || null;
  }

  function queueFrameCrossFade() {
    pendingFrameCrossFade = true;
  }

  function fadePreviousFrame(previousSrc) {
    if (!previousSrc || !petSprite || !frameFadeImage.animate) {
      return;
    }

    if (frameFadeAnimation) {
      frameFadeAnimation.cancel();
    }

    frameFadeImage.src = previousSrc;
    frameFadeImage.style.opacity = '1';
    frameFadeAnimation = frameFadeImage.animate(
      [{ opacity: 1 }, { opacity: 0 }],
      {
        duration: BEHAVIOR_TREE_CONFIG.crossFadeMs,
        easing: 'ease-out',
        fill: 'forwards'
      }
    );
    frameFadeAnimation.onfinish = () => {
      frameFadeImage.style.opacity = '0';
      frameFadeImage.removeAttribute('src');
      frameFadeAnimation = null;
    };
  }

  function frameFileFromPattern(pattern, index) {
    const padded = String(index).padStart(3, '0');
    if (pattern.includes('%03d')) {
      return pattern.replace('%03d', padded);
    }
    if (pattern.includes('{index}')) {
      return pattern.replace('{index}', padded);
    }
    return pattern;
  }

  function registerGeneratedActionManifest(manifest) {
    const actions = manifest && manifest.actions ? manifest.actions : {};

    for (const [actionName, entry] of Object.entries(actions)) {
      const frameCount = Number(entry.frameCount) || 0;
      const fps = Number(entry.fps || manifest.fps || 12);
      const framePattern = entry.framePattern || `${actionName}_%03d.png`;
      const framesForAction = [];

      for (let index = 0; index < frameCount; index += 1) {
        const key = `action_${actionName}_${String(index).padStart(3, '0')}`;
        frameSources[key] = `${entry.framesDir}/${frameFileFromPattern(framePattern, index)}`;
        frameKeys.push(key);
        framesForAction.push(key);
      }

      if (framesForAction.length > 0) {
        generatedActions[actionName] = {
          name: actionName,
          frames: framesForAction,
          fps,
          frameMs: Math.max(1, Math.round(1000 / fps)),
          durationMs: Math.max(1, Math.round((framesForAction.length * 1000) / fps))
        };
      }
    }
  }

  async function loadGeneratedActionManifest() {
    try {
      const response = await fetch('assets/animations.json', { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      registerGeneratedActionManifest(await response.json());
    } catch (error) {
      console.warn('Generated action manifest unavailable; using built-in frames only.', error);
    }
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
      STATES.PET_ACTION,
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
    petEl.dataset.action = pet.animation ? pet.animation.name : '';
    petEl.classList.toggle('walking', pet.state === STATES.WALK);
    petEl.classList.toggle('running', pet.state === STATES.RUN);
    petEl.classList.toggle('idle-look', pet.state === STATES.IDLE_LOOK);
    petEl.classList.toggle('resting', pet.state === STATES.REST);
    petEl.classList.toggle('sleeping', pet.state === STATES.SLEEP);
    petEl.classList.toggle('stretching', pet.state === STATES.STRETCH);
    petEl.classList.toggle('scratching', pet.state === STATES.SCRATCH);
    petEl.classList.toggle('peeking', pet.state === STATES.PEEK);
    petEl.classList.toggle('action-playing', pet.state === STATES.PET_ACTION);
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
    const baseHeight = clamp(Math.round(viewportHeight * 0.16), minPetHeight, maxPetHeight);
    const height = Math.max(1, Math.round(baseHeight * petScale));
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
      pendingFrameCrossFade = false;
      return;
    }

    const previousSrc = petImage.currentSrc || petImage.src;
    const shouldCrossFade = pendingFrameCrossFade;
    pendingFrameCrossFade = false;
    currentFrameKey = frameKey;
    petImage.src = frame.src;
    petEl.dataset.frame = frameKey;
    if (shouldCrossFade) {
      fadePreviousFrame(previousSrc);
    }
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
      setFrame('cool_000');
      return;
    }

    while (now >= pet.action.nextFrameAt && pet.action.frameIndex < pet.action.frames.length - 1) {
      pet.action.frameIndex += 1;
      pet.action.nextFrameAt += coolFrameMs;
    }

    setFrame(pet.action.frames[pet.action.frameIndex]);
  }

  function clearGeneratedAnimation() {
    pet.animation = null;
  }

  function setGeneratedAnimation(actionName, now, options = {}) {
    const action = generatedActions[actionName];
    if (!action) {
      return false;
    }

    pet.animation = {
      name: actionName,
      frames: action.frames,
      frameIndex: 0,
      nextFrameAt: now + (options.frameMs || action.frameMs),
      frameMs: options.frameMs || action.frameMs,
      loop: Boolean(options.loop)
    };
    if (options.crossFade) {
      queueFrameCrossFade();
    }
    setFrame(action.frames[0]);
    return true;
  }

  function syncGeneratedFrame(now) {
    if (!pet.animation || !Array.isArray(pet.animation.frames)) {
      return false;
    }

    while (now >= pet.animation.nextFrameAt) {
      if (pet.animation.frameIndex >= pet.animation.frames.length - 1) {
        if (!pet.animation.loop) {
          break;
        }
        pet.animation.frameIndex = 0;
      } else {
        pet.animation.frameIndex += 1;
      }
      pet.animation.nextFrameAt += pet.animation.frameMs;
    }

    setFrame(pet.animation.frames[pet.animation.frameIndex]);
    return true;
  }

  function syncFrame(now) {
    if (syncGeneratedFrame(now)) {
      return;
    }

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
    clearGeneratedAnimation();
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
    setGeneratedAnimation('walk', now, { loop: true });
  }

  function startRun(now, forcedDuration) {
    clearGeneratedAnimation();
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
    setGeneratedAnimation('walk', now, { frameMs: runFrameMs, loop: true });
  }

  function startIdleLook(now, forcedDuration) {
    clearGeneratedAnimation();
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
    clearGeneratedAnimation();
    pet.state = STATES.REST;
    pet.idleFrame = 'sit';
    pet.action = null;
    pet.fall = null;
    setStateUntil(STATES.REST, now, forcedDuration);
  }

  function startSleep(now, forcedDuration) {
    clearGeneratedAnimation();
    pet.state = STATES.SLEEP;
    pet.idleFrame = 'sit';
    pet.action = null;
    pet.fall = null;
    setStateUntil(STATES.SLEEP, now, forcedDuration);
    setGeneratedAnimation('sleep', now, { loop: true });
    showSleepZzz();
  }

  function startStretch(now, forcedDuration) {
    clearGeneratedAnimation();
    pet.state = STATES.STRETCH;
    pet.idleFrame = 'idle';
    pet.action = null;
    pet.fall = null;
    setStateUntil(STATES.STRETCH, now, forcedDuration);
  }

  function startScratch(now, forcedDuration) {
    clearGeneratedAnimation();
    pet.state = STATES.SCRATCH;
    pet.idleFrame = 'idle';
    pet.action = null;
    pet.fall = null;
    setStateUntil(STATES.SCRATCH, now, forcedDuration);
    setGeneratedAnimation('scratch', now, { loop: true });
  }

  function startPeek(now, forcedDuration) {
    clearGeneratedAnimation();
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

  function buildCoolSequence() {
    return coolFrameKeys;
  }

  function startCool(now, _forcedDuration, options = {}) {
    const coolFrames = buildCoolSequence();

    clearGeneratedAnimation();
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
    clearGeneratedAnimation();
    setBehaviorState(BEHAVIOR_STATES.ALERT, now);
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

  function startPetAction(actionName, now, forcedDuration, options = {}) {
    const behaviorState = options.behaviorState || inferBehaviorStateForAction(actionName);
    setBehaviorState(behaviorState, now);

    const generated = generatedActions[actionName];
    if (!generated) {
      startState(STATES.IDLE_LOOK, now, rand(900, 1600), { behaviorState });
      return false;
    }

    if (actionName === 'walk') {
      startWalk(now, forcedDuration || generated.durationMs);
      return true;
    }
    if (actionName === 'sleep') {
      startSleep(now, forcedDuration || Math.max(generated.durationMs, 3000));
      return true;
    }
    if (actionName === 'scratch') {
      startScratch(now, forcedDuration || generated.durationMs);
      return true;
    }

    clearGeneratedAnimation();
    hideSleepZzz();
    pet.state = STATES.PET_ACTION;
    pet.idleFrame = 'idle';
    pet.action = { actionName };
    pet.fall = null;
    if (Math.random() < 0.35) {
      pet.dir = chooseDirection();
    }
    const duration = forcedDuration || generated.durationMs + 120;
    pet.stateUntil = now + (options.loop ? duration : Math.max(duration, generated.durationMs + 120));
    setGeneratedAnimation(actionName, now, {
      loop: Boolean(options.loop),
      crossFade: Boolean(options.crossFade)
    });
    return true;
  }

  function startState(state, now, forcedDuration, options = {}) {
    setBehaviorState(options.behaviorState || inferBehaviorStateForState(state), now);
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

  function actionPoolAvailable(pool) {
    return pool.filter((item) => {
      return item.state || (item.action && generatedActions[item.action]);
    });
  }

  function behaviorConfigFor(behaviorState) {
    return (
      BEHAVIOR_TREE_CONFIG.states[behaviorState] ||
      BEHAVIOR_TREE_CONFIG.states[BEHAVIOR_STATES.IDLE]
    );
  }

  function contextTransitions(transitions, now) {
    const inactiveFor = now - pet.lastInteractionAt;
    if (inactiveFor <= BEHAVIOR_TREE_CONFIG.idleBiasAfterMs) {
      return transitions;
    }

    return transitions.map((entry) => {
      let weight = entry.weight;
      if (entry.state === BEHAVIOR_STATES.REST) {
        weight *= 2.4;
      } else if (
        entry.state === BEHAVIOR_STATES.PLAY ||
        entry.state === BEHAVIOR_STATES.SOCIAL ||
        entry.state === BEHAVIOR_STATES.SPECIAL
      ) {
        weight *= 0.55;
      } else if (entry.state === BEHAVIOR_STATES.MOVE) {
        weight *= 0.75;
      }
      return { state: entry.state, weight };
    });
  }

  function chooseBehaviorAction(config) {
    const available = actionPoolAvailable(config.actions);
    if (available.length > 0) {
      return weightedRandom(available);
    }
    return { state: STATES.IDLE_LOOK };
  }

  function chooseNextBehaviorState(now) {
    const config = behaviorConfigFor(pet.behaviorState);
    return weightedRandom(contextTransitions(config.transitions, now)).state;
  }

  function startBehaviorState(behaviorState, now, forcedDuration, options = {}) {
    const config = behaviorConfigFor(behaviorState);
    const duration = forcedDuration || rand(config.durationMs[0], config.durationMs[1]);
    const entry = chooseBehaviorAction(config);

    setBehaviorState(behaviorState, now);
    queueFrameCrossFade();

    if (entry.action) {
      startPetAction(entry.action, now, duration, {
        behaviorState,
        loop: Boolean(entry.loop),
        crossFade: true
      });
      return;
    }

    startState(entry.state, now, duration, {
      ...options,
      behaviorState
    });
  }

  function startNextState(now) {
    startBehaviorState(chooseNextBehaviorState(now), now);
  }

  function maybeStartRandomCool(now) {
    if (
      now - pet.lastCoolAt >= coolRandomCooldownMs &&
      Math.random() < coolRandomChance
    ) {
      queueFrameCrossFade();
      startState(STATES.COOL, now, null, {
        behaviorState: BEHAVIOR_STATES.SPECIAL,
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

  function updateWalkLike(now, dt) {
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
      if (edgeHit) {
        startBehaviorState(
          Math.random() < 0.65 ? BEHAVIOR_STATES.GROOM : BEHAVIOR_STATES.ALERT,
          now,
          rand(1800, 3600)
        );
        return;
      }
      startNextState(now);
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
      startNextState(now);
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
        updateWalkLike(now, dt);
      } else if (pet.state === STATES.RUN) {
        updateWalkLike(now, dt);
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
      } else if (pet.state === STATES.PET_ACTION) {
        if (now >= pet.stateUntil) {
          startNextState(now);
        }
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
    setBehaviorState(BEHAVIOR_STATES.ALERT, now);
    pet.idleFrame = 'idle';
    pet.action = null;
    clearGeneratedAnimation();
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
    queueFrameCrossFade();
    startState(STATES.COOL, now, null, {
      behaviorState: BEHAVIOR_STATES.SPECIAL,
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
      BEHAVIOR_STATES,
      ACTION_TAXONOMY,
      behaviorTree: BEHAVIOR_TREE_CONFIG,
      actions: Object.keys(generatedActions),
      snapshot() {
        return {
          state: pet.state,
          behaviorState: pet.behaviorState,
          frame: currentFrameKey,
          action: pet.animation ? pet.animation.name : null,
          actionFrameIndex: pet.animation ? pet.animation.frameIndex : null,
          coolFrameIndex: pet.state === STATES.COOL && pet.action ? pet.action.frameIndex : null,
          x: Math.round(pet.x),
          y: Math.round(pet.y),
          scale: petScale,
          width: pet.width,
          height: pet.height,
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
        if (
          Object.values(STATES).includes(state) &&
          state !== STATES.PET_ACTION &&
          state !== STATES.FALL &&
          state !== STATES.DRAG
        ) {
          startState(state, performance.now());
          applyPet();
        }
      },
      forceBehaviorState(behaviorState) {
        if (BEHAVIOR_TREE_CONFIG.states[behaviorState]) {
          startBehaviorState(behaviorState, performance.now());
          applyPet();
          return true;
        }
        return false;
      },
      forceAction(actionName) {
        if (generatedActions[actionName]) {
          startPetAction(actionName, performance.now());
          applyPet();
          return true;
        }
        return false;
      }
    };
  }

  async function boot() {
    await loadGeneratedActionManifest();
    await loadFrames();
    try {
      petScale = normalizePetScale(await api.getScale());
      api.onScaleChanged(setPetScale);
    } catch (error) {
      console.warn('Pet scale setting unavailable; using 1x.', error);
      petScale = 1;
    }
    const now = performance.now();
    setFrame('idle');
    measurePet();
    pet.x = rand(20, Math.max(21, maxX() - 20));
    pet.y = groundY();
    pet.lastInteractionAt = now;
    startBehaviorState(BEHAVIOR_STATES.MOVE, now);
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
