'use strict';

// Original photographic assets are local. Route statistics are illustrative.
const destinations = [
  { name: ['Patagonia', 'Express'], slug: 'patagonia', phrase: ['Hiking the', 'Glaciers'], location: 'Tierra del Fuego, Chile', coordinate: '50°56′ S / 73°24′ W', distance: '20.5', elevation: '950', days: 14, cardInk: '#18212a', sceneInk: '#fff', light: .9 },
  { name: ['Arctic', 'Voyage'], slug: 'arctic', phrase: ['Traverse the', 'Borealis'], location: 'Tromsø, Norway', coordinate: '69°39′ N / 18°57′ E', distance: '45.5', elevation: '620', days: 12, cardInk: '#fff1e5', sceneInk: '#fff3ec', light: .68 },
  { name: ['Tundra', 'Road'], slug: 'tundra', phrase: ['Into the', 'Wilderness'], location: 'Icelandic Highlands', coordinate: '64°45′ N / 19°12′ W', distance: '32.8', elevation: '1,240', days: 9, cardInk: '#163b87', sceneInk: '#153449', light: .96 },
  { name: ['Vulcan', 'Hunt'], slug: 'vulcan', phrase: ['Chasing', 'the Fire'], location: 'Kamchatka Peninsula', coordinate: '56°03′ N / 160°38′ E', distance: '28.4', elevation: '2,850', days: 11, cardInk: '#75243c', sceneInk: '#341c39', light: .78 }
];
const select = selector => document.querySelector(selector);
const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
const wrap = index => (index % destinations.length + destinations.length) % destinations.length;
const cinematicEase = 'cubic-bezier(.22, 1, .28, 1)';

class TravelSlider {
  constructor() {
    this.active = 0;
    this.target = 0;
    this.busy = false;
    this.view = 'browse';
    this.pendingBrowse = false;
    this.root = select('.experience');
    this.track = select('.card-track');
    this.stage = select('.landscapes');
    this.reveal = select('.reveal-layer');
    this.revealImage = select('.reveal-image');
    this.cards = [];
    this.layers = [];
    this.images = [];
    this.cardPositions = [];
    this.build();
    this.updateContent(0);
    this.layoutCards(0, 'browse', 0);
    this.bind();
  }

  build() {
    destinations.forEach((destination, index) => {
      const image = new Image();
      image.src = `assets/images/${destination.slug}.png`;
      this.images.push(image);
      const landscape = document.createElement('div');
      landscape.className = `landscape${index === 0 ? ' active' : ''}`;
      landscape.style.backgroundImage = `url('${image.src}')`;
      this.stage.append(landscape);
      this.layers.push(landscape);

      const card = document.createElement('button');
      card.className = `destination${index === 0 ? ' active' : ''}`;
      card.dataset.destination = destination.slug;
      card.style.setProperty('--image', `url('${image.src}')`);
      card.style.setProperty('--card-ink', destination.cardInk);
      card.setAttribute('aria-label', `Explore ${destination.name.join(' ')} — ${destination.location}`);
      card.setAttribute('aria-pressed', String(index === 0));
      card.innerHTML = `<div class="card-art" style="background-image:url('${image.src}')"></div>
        <div class="card-top"><span class="orb"></span><span class="card-number">0${index + 1} / 04</span></div>
        <div class="card-info"><h2><span>${destination.name[0]}</span><span>${destination.name[1]}</span></h2><p>${destination.location}</p></div>
        <div class="card-bottom"><span>OPEN THE EXPEDITION</span><b>↗</b></div>`;
      card.addEventListener('click', () => this.go(index));
      this.track.append(card);
      this.cards.push(card);

      const dot = document.createElement('button');
      dot.setAttribute('aria-label', destination.name.join(' '));
      dot.setAttribute('aria-current', String(index === 0));
      dot.addEventListener('click', () => this.go(index));
      select('.destination-dots').append(dot);
    });
    this.dots = [...select('.destination-dots').children];
  }

  get durationScale() { return motionPreference.matches ? 0 : 1; }

  // Awaited animation promises are the only transition clock. No timeout chains.
  async animate(element, frames, duration, easing = cinematicEase) {
    const last = frames[frames.length - 1];
    const animation = element.animate(frames, {
      duration: Math.max(1, duration * this.durationScale), easing, fill: 'both'
    });
    try {
      await animation.finished;
      Object.entries(last).forEach(([property, value]) => {
        if (!['offset', 'easing', 'composite'].includes(property)) element.style[property] = value;
      });
    } finally {
      animation.cancel();
    }
  }

  async layoutCards(center, mode, duration = 500) {
    const width = this.root.clientWidth;
    const cardWidth = this.cards[0].offsetWidth;
    const gap = width < 600 ? 22 : Math.min(55, width * .038);
    const step = cardWidth + gap;
    const centerX = width * (width < 600 ? .47 : .48) - cardWidth / 2;
    const transitions = this.cards.map((card, index) => {
      let offset = wrap(index - center);
      if (offset === 3) offset = -1;
      let x = centerX + offset * step;
      let opacity = 1;
      let scale = offset === 0 ? 1 : .98;
      let rotation = offset === 0 ? 0 : offset < 0 ? 2 : -2;
      if (mode === 'immersed') {
        const isPreview = index === wrap(center + 1);
        x = isPreview ? width * (width < 600 ? .91 : .94) : index === center ? -cardWidth - 90 : width + step * (index + 1);
        opacity = isPreview ? .9 : 0;
        scale = .98;
        rotation = -3;
        card.tabIndex = isPreview ? 0 : -1;
        card.style.pointerEvents = isPreview ? 'auto' : 'none';
        card.setAttribute('aria-hidden', String(!isPreview));
      } else {
        card.tabIndex = 0;
        card.style.pointerEvents = 'auto';
        card.removeAttribute('aria-hidden');
      }
      const transform = `translate3d(${x}px, 0, 0) rotateY(${rotation}deg) scale(${scale})`;
      const previous = { transform: card.style.transform || transform, opacity: card.style.opacity || '1' };
      this.cardPositions[index] = { transform, opacity };
      if (duration === 0) {
        card.style.transform = transform;
        card.style.opacity = String(opacity);
        return Promise.resolve();
      }
      return this.animate(card, [previous, { transform, opacity }], duration);
    });
    await Promise.all(transitions);
  }

  updateContent(index) {
    const destination = destinations[index];
    select('#place').replaceChildren(document.createTextNode(destination.name[0]), document.createElement('br'), document.createTextNode(destination.name[1]));
    select('.scene-title span').textContent = destination.phrase[0];
    select('.scene-title strong').textContent = destination.phrase[1];
    select('#location').textContent = destination.location.toUpperCase();
    select('#distance').textContent = destination.distance;
    select('#elevation').textContent = destination.elevation;
    select('#duration').textContent = `${destination.days} DAYS IN THE WILD`;
    select('#index').textContent = `0${index + 1}`;
    select('.terrain-orb').style.backgroundImage = `url('${this.images[index].src}')`;
    this.root.dataset.destination = destination.slug;
    this.root.style.setProperty('--scene-ink', destination.sceneInk);
    this.root.style.setProperty('--traveler-light', destination.light);
    this.cards.forEach((card, i) => {
      card.classList.toggle('active', i === index);
      card.setAttribute('aria-pressed', String(i === index));
      this.dots[i].setAttribute('aria-current', String(i === index));
    });
  }

  setView(view) {
    this.view = view;
    this.root.dataset.view = view;
    select('.browse-toggle').setAttribute('aria-expanded', String(view === 'browse'));
    select('.browse-toggle span').textContent = view === 'browse' ? 'ENTER THE LANDSCAPE' : 'EXPLORE DESTINATIONS';
    select('.browse-toggle').setAttribute('aria-label', view === 'browse' ? 'Enter the current landscape' : 'Explore destinations');
    select('.interaction-hint').innerHTML = view === 'browse' ? 'SELECT A WORLD <b>↗</b>' : 'EXPLORE THE NEXT ROAD <b>↔</b>';
  }

  async openBrowse() {
    if (this.busy) { this.pendingBrowse = true; return; }
    this.busy = true;
    this.setView('browse');
    await Promise.all([
      this.animate(select('.intro'), [{ opacity: select('.intro').style.opacity || '1', transform: 'translateY(0)' }, { opacity: 0, transform: 'translateY(-8px)' }], 350),
      this.layoutCards(this.active, 'browse', 700)
    ]);
    this.busy = false;
    this.drainQueue();
  }

  async go(index) {
    this.target = wrap(index);
    if (this.busy) return;
    if (this.target === this.active && this.view === 'immersed') return;
    this.busy = true;
    const next = this.target;
    const previous = this.active;
    let success = false;
    try {
      await this.images[next].decode();
      select('.asset-error').hidden = true;
      // Phase 1: focus the selected card while keeping the old landscape intact.
      this.setView('focusing');
      await Promise.all([
        this.animate(select('.intro'), [{ opacity: select('.intro').style.opacity || '0', transform: 'translateY(0)' }, { opacity: 0, transform: 'translateY(-10px)' }], 240),
        this.layoutCards(next, 'browse', 360)
      ]);

      // Phase 2: read the real on-screen card rectangle, never a guessed origin.
      const card = this.cards[next];
      const bounds = card.getBoundingClientRect();
      const stageBounds = this.root.getBoundingClientRect();
      const width = this.root.clientWidth;
      const height = this.root.clientHeight;
      const left = bounds.left - stageBounds.left;
      const top = bounds.top - stageBounds.top;
      const right = width - left - bounds.width;
      const bottom = height - top - bounds.height;
      const sourceWidth = this.images[next].naturalWidth;
      const sourceHeight = this.images[next].naturalHeight;
      const cardCoverScale = Math.max(bounds.width / sourceWidth, bounds.height / sourceHeight);
      const viewportCoverScale = Math.max(width / sourceWidth, height / sourceHeight);
      const imageScale = cardCoverScale / viewportCoverScale;
      const imageX = left + bounds.width / 2 - width / 2;
      const imageY = top + bounds.height / 2 - height / 2;
      const originClip = `inset(${top}px ${right}px ${bottom}px ${left}px round 5px)`;
      const originTransform = `translate3d(${imageX}px, ${imageY}px, 0) scale(${imageScale})`;
      this.reveal.style.clipPath = originClip;
      this.revealImage.style.backgroundImage = `url('${this.images[next].src}')`;
      this.revealImage.style.transform = originTransform;
      this.reveal.hidden = false;
      this.setView('opening');

      // Phase 3: the same photograph grows from card-crop to viewport-crop.
      // Traveler remains above this layer; its pose and position never change.
      const expansion = Promise.all([
        this.animate(this.reveal, [{ clipPath: originClip }, { clipPath: 'inset(0px 0px 0px 0px round 0px)' }], 1250),
        this.animate(this.revealImage, [{ transform: originTransform }, { transform: 'translate3d(0, 0, 0) scale(1)' }], 1250),
        this.layoutCards(next, 'immersed', 1050)
      ]);
      const statistics = [select('.metrics'), select('.current-place')];
      await Promise.all(statistics.map(element => this.animate(element, [{ opacity: 1, transform: 'translateY(0)' }, { opacity: 0, transform: 'translateY(8px)' }], 340)));
      this.updateContent(next);
      await expansion;

      // Phase 4: atomically commit the expanded image as the settled background.
      this.layers[previous].classList.remove('active');
      this.layers[next].classList.add('active');
      this.active = next;
      this.reveal.hidden = true;
      this.setView('immersed');
      await Promise.all([
        this.animate(select('.intro'), [{ opacity: 0, transform: 'translateY(12px)', clipPath: 'inset(0 0 100% 0)' }, { opacity: 1, transform: 'translateY(0)', clipPath: 'inset(0 0 0% 0)' }], 650),
        ...statistics.map(element => this.animate(element, [{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'translateY(0)' }], 550)),
        ...[...document.querySelectorAll('.metric>svg>path:first-child')].map(element => this.animate(element, [{ strokeDasharray: '300', strokeDashoffset: '300' }, { strokeDasharray: '300', strokeDashoffset: '0' }], 800))
      ]);
      select('#announcement').textContent = `${destinations[next].name.join(' ')}. ${destinations[next].phrase.join(' ')}. ${destinations[next].distance} kilometers.`;
      success = true;
    } catch (error) {
      console.error('The destination transition could not complete:', error);
      select('.asset-error').hidden = false;
      this.target = this.active;
      this.setView('browse');
      this.updateContent(this.active);
      select('.intro').style.opacity = '0';
      [select('.metrics'), select('.current-place')].forEach(element => { element.style.opacity = '1'; element.style.transform = ''; });
    } finally {
      this.reveal.hidden = true;
      await this.layoutCards(this.active, success ? 'immersed' : 'browse', 0);
      this.busy = false;
      this.drainQueue();
    }
  }

  drainQueue() {
    if (this.target !== this.active) {
      this.go(this.target);
    } else if (this.pendingBrowse) {
      this.pendingBrowse = false;
      this.openBrowse();
    }
  }

  bind() {
    select('.previous').addEventListener('click', () => this.go(this.target - 1));
    select('.next').addEventListener('click', () => this.go(this.target + 1));
    select('.reset').addEventListener('click', () => { this.pendingBrowse = true; if (this.active === 0 && !this.busy) { this.target = 0; this.pendingBrowse = false; this.openBrowse(); } else this.go(0); });
    select('.browse-toggle').addEventListener('click', () => this.view === 'browse' && !this.busy ? this.go(this.active) : this.openBrowse());
    document.addEventListener('keydown', event => {
      if (event.altKey || event.ctrlKey || event.metaKey || /INPUT|TEXTAREA|SELECT/.test(event.target.tagName) || event.target.isContentEditable) return;
      if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') { event.preventDefault(); this.go(this.target + (event.key === 'ArrowRight' ? 1 : -1)); }
      if (event.key === 'Home') { event.preventDefault(); this.go(0); }
      if (event.key === 'End') { event.preventDefault(); this.go(3); }
      if (event.key === 'Escape') this.openBrowse();
    });

    // Swipe is captured at the scene level, including between the floating cards.
    let gesture = null;
    let suppressClick = false;
    this.root.addEventListener('pointerdown', event => {
      if (event.button !== 0 || event.target.closest('a, .journey-footer, .site-header, .journey-tools')) return;
      gesture = { x: event.clientX, y: event.clientY, id: event.pointerId };
      suppressClick = false;
    });
    addEventListener('pointerup', event => {
      if (!gesture || event.pointerId !== gesture.id) return;
      const dx = event.clientX - gesture.x;
      const dy = event.clientY - gesture.y;
      gesture = null;
      if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.3) {
        suppressClick = true;
        this.go(this.target + (dx < 0 ? 1 : -1));
      }
    });
    addEventListener('pointercancel', () => { gesture = null; suppressClick = false; });
    this.root.addEventListener('click', event => {
      if (suppressClick) { event.preventDefault(); event.stopImmediatePropagation(); suppressClick = false; }
    }, true);
    let wheelTotal = 0;
    let lastWheel = 0;
    this.root.addEventListener('wheel', event => {
      if (event.ctrlKey) return;
      event.preventDefault();
      const now = performance.now();
      const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
      if (now - lastWheel > 180) wheelTotal = 0;
      lastWheel = now;
      if (this.busy) { wheelTotal = 0; return; }
      wheelTotal += delta;
      if (Math.abs(wheelTotal) > 65) { this.go(this.target + (wheelTotal > 0 ? 1 : -1)); wheelTotal = 0; }
    }, { passive: false });

    // Parallax only touches ambient light, keeping road, traveler and reveal aligned.
    let frame = 0;
    this.root.addEventListener('pointermove', event => {
      if (motionPreference.matches || event.pointerType === 'touch') return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const x = (event.clientX / this.root.clientWidth - .5) * 14;
        const y = (event.clientY / this.root.clientHeight - .5) * 5;
        select('.ambient-light').style.transform = `translate3d(${x}px, ${y}px, 0)`;
      });
    });
    addEventListener('resize', () => { if (!this.busy) this.layoutCards(this.active, this.view === 'browse' ? 'browse' : 'immersed', 0); });
    document.addEventListener('visibilitychange', () => { if (document.hidden) gesture = null; });
  }
}

const travelSlider = new TravelSlider();
