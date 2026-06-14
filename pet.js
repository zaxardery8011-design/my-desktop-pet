(function () {
  'use strict';

  const api = window.mrwuPet || {
    setIgnoreMouseEvents() {},
    showContextMenu() {}
  };
  const petEl = document.getElementById('pet');
  const petImage = document.getElementById('petImage');
  const bubble = document.getElementById('bubble');
  const alphaCanvas = document.createElement('canvas');
  const alphaCtx = alphaCanvas.getContext('2d', { willReadFrequently: true });
  const groundGap = 6;
  const walkFrameMs = 150;
  const minPetHeight = 120;
  const maxPetHeight = 160;
  const frameSources = {
    idle: 'assets/frames/idle.png',
    walk1: 'assets/frames/walk1.png',
    walk2: 'assets/frames/walk2.png',
    walk3: 'assets/frames/walk3.png',
    sit: 'assets/frames/sit.png'
  };
  const walkFrameKeys = ['walk1', 'walk2', 'walk3'];
  const frameKeys = ['idle', 'walk1', 'walk2', 'walk3', 'sit'];
  const frames = {};

  const pet = {
    x: 80,
    y: 0,
    width: 300,
    height: 148,
    dir: 1,
    speed: 70,
    mode: 'walk',
    modeUntil: 0,
    idleFrame: 'idle',
    settle: null
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

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
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

  function shouldFlipCurrentFrame() {
    return pet.mode === 'walk' && pet.dir < 0;
  }

  function applyPet() {
    pet.x = clamp(pet.x, 0, maxX());
    pet.y = clamp(pet.y, 0, maxY());
    petEl.style.setProperty('--pet-x', `${Math.round(pet.x)}px`);
    petEl.style.setProperty('--pet-y', `${Math.round(pet.y)}px`);
    petEl.style.setProperty('--pet-flip', shouldFlipCurrentFrame() ? '-1' : '1');
    petEl.classList.toggle('walking', pet.mode === 'walk');
    petEl.classList.toggle('idle', pet.mode === 'idle' || pet.mode === 'settle' || pet.mode === 'drag');
    petEl.classList.toggle('dragging', Boolean(dragging));
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
    if (!dragging && pet.mode !== 'settle') {
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

  function syncFrame(now) {
    if (pet.mode === 'walk') {
      if (!walkFrameKeys.includes(currentFrameKey) || now >= nextWalkFrameAt) {
        setFrame(walkFrameKeys[walkFrameIndex]);
        walkFrameIndex = (walkFrameIndex + 1) % walkFrameKeys.length;
        nextWalkFrameAt = now + walkFrameMs;
      }
      return;
    }

    setFrame(pet.mode === 'idle' && pet.idleFrame === 'sit' ? 'sit' : 'idle');
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
    if (walkFrameKeys.includes(currentFrameKey) && pet.dir < 0) {
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

  function startWalk(now) {
    pet.mode = 'walk';
    pet.idleFrame = 'idle';
    pet.settle = null;
    pet.dir = chooseDirection();
    pet.speed = rand(45, 92);
    pet.modeUntil = now + rand(2600, 6800);
    walkFrameIndex = 0;
    nextWalkFrameAt = now;
  }

  function startIdle(now) {
    const duration = rand(750, 2300);
    pet.mode = 'idle';
    pet.idleFrame = duration > 1450 && Math.random() < 0.28 ? 'sit' : 'idle';
    pet.settle = null;
    pet.modeUntil = now + (pet.idleFrame === 'sit' ? Math.max(duration, rand(1500, 2600)) : duration);
  }

  function settleToGround(now) {
    pet.mode = 'settle';
    pet.idleFrame = 'idle';
    setFrame('idle');
    pet.settle = {
      start: now,
      duration: rand(320, 540),
      fromX: pet.x,
      fromY: pet.y,
      toX: clamp(pet.x, 0, maxX()),
      toY: groundY()
    };
  }

  function react() {
    const icons = ['✨', '♪', '!', '?'];
    bubble.textContent = icons[Math.floor(Math.random() * icons.length)];
    bubble.style.setProperty('--bubble-x', `${Math.round(pet.x + pet.width * 0.56)}px`);
    bubble.style.setProperty('--bubble-y', `${Math.round(Math.max(8, pet.y - 16))}px`);
    bubble.classList.remove('show');
    petEl.classList.remove('reacting');
    void bubble.offsetWidth;
    void petEl.offsetWidth;
    bubble.classList.add('show');
    petEl.classList.add('reacting');
    window.clearTimeout(bubbleTimer);
    bubbleTimer = window.setTimeout(() => {
      bubble.classList.remove('show');
      petEl.classList.remove('reacting');
    }, 1100);
  }

  function update(now) {
    const dt = Math.min((now - lastFrame) / 1000 || 0, 0.05);
    lastFrame = now;

    if (!dragging) {
      if (pet.mode === 'walk') {
        pet.x += pet.dir * pet.speed * dt;
        if (pet.x <= 0 || pet.x >= maxX()) {
          pet.x = clamp(pet.x, 0, maxX());
          pet.dir *= -1;
          startIdle(now);
        } else if (now >= pet.modeUntil) {
          startIdle(now);
        }
      } else if (pet.mode === 'idle') {
        if (now >= pet.modeUntil) {
          startWalk(now);
        }
      } else if (pet.mode === 'settle' && pet.settle) {
        const t = clamp((now - pet.settle.start) / pet.settle.duration, 0, 1);
        const eased = easeOutCubic(t);
        pet.x = pet.settle.fromX + (pet.settle.toX - pet.settle.fromX) * eased;
        pet.y = pet.settle.fromY + (pet.settle.toY - pet.settle.fromY) * eased;
        if (t >= 1) {
          startIdle(now);
        }
      }
    }

    syncFrame(now);
    applyPet();
    window.requestAnimationFrame(update);
  }

  function onMouseMove(event) {
    if (dragging) {
      const nextX = event.clientX - dragging.offsetX;
      const nextY = event.clientY - dragging.offsetY;
      const moved = Math.hypot(event.clientX - dragging.startX, event.clientY - dragging.startY);
      dragging.moved = dragging.moved || moved > 5;
      pet.x = clamp(nextX, 0, maxX());
      pet.y = clamp(nextY, 0, maxY());
      applyPet();
      setPassthrough(false);
      event.preventDefault();
      return;
    }

    setPassthrough(!hitTest(event.clientX, event.clientY));
  }

  function onMouseDown(event) {
    if (event.button !== 0 || !hitTest(event.clientX, event.clientY)) {
      return;
    }

    const rect = petEl.getBoundingClientRect();
    dragging = {
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      startX: event.clientX,
      startY: event.clientY,
      moved: false
    };
    pet.mode = 'drag';
    setFrame('idle');
    setPassthrough(false);
    applyPet();
    event.preventDefault();
  }

  function onMouseUp(event) {
    if (!dragging) {
      return;
    }

    const wasClick = !dragging.moved;
    dragging = null;
    if (wasClick) {
      react();
    }
    settleToGround(performance.now());
    setPassthrough(!hitTest(event.clientX, event.clientY));
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

  async function boot() {
    await loadFrames();
    setFrame('idle');
    measurePet();
    pet.x = rand(20, Math.max(21, maxX() - 20));
    pet.y = groundY();
    startWalk(performance.now());
    api.setIgnoreMouseEvents(true);
    window.addEventListener('mousemove', onMouseMove, true);
    window.addEventListener('mousedown', onMouseDown, true);
    window.addEventListener('mouseup', onMouseUp, true);
    window.addEventListener('contextmenu', onContextMenu, true);
    window.addEventListener('mouseleave', () => {
      if (!dragging) {
        setPassthrough(true);
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
