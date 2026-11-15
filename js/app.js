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
    this.selectedIndex = 0;
    this.openedIndex = 0;
    this.view = 'browse';
    this.busy = false;
    this.pendingBrowse = false;
    this.root = select('.experience');
    this.track = select('.card-track');
    this.stage = select('.landscapes');
    this.reveal = select('.reveal-layer');
    this.revealImage = select('.reveal-image');
    this.cards = [];
    this.layers = [];
    this.images = [];
    this.cardAnimations = new Map();
    this.trackAnimation = null;
    this.carouselStep = 0;
    this.layoutMode = 'browse';
    this.cardInstances = [];
    this.selectionMotion = Promise.resolve();
    this.build();
    this.updateScene(this.openedIndex);
    this.updateSelection();
    this.setView('browse');
    this.selectionMotion = this.layoutCards(this.selectedIndex, 'browse', 0);
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
      card.setAttribute('aria-label', `Enter ${destination.name.join(' ')} — ${destination.location}`);
      card.setAttribute('aria-pressed', String(index === 0));
      card.innerHTML = `<div class="card-art" style="background-image:url('${image.src}')"></div>
        <div class="card-top"><span class="orb"></span><span class="card-number">0${index + 1} / 04</span></div>
        <div class="card-info"><h2><span>${destination.name[0]}</span><span>${destination.name[1]}</span></h2><p>${destination.location}</p></div>
        <div class="card-bottom"><span>ENTER THIS DESTINATION</span><b>↗</b></div>`;
      card.addEventListener('click', () => this.enterDestination(index, card));
      this.track.append(card);
      this.cards.push(card);

      const dot = document.createElement('button');
      dot.setAttribute('aria-label', `Select ${destination.name.join(' ')}`);
      dot.setAttribute('aria-current', String(index === 0));
      dot.addEventListener('click', () => this.selectDestination(index));
      select('.destination-dots').append(dot);
    });
    this.dots = [...select('.destination-dots').children];
    // Offscreen guard copies extend the same four destinations into a seamless loop.
    this.cards.forEach((card, index) => this.cardInstances.push({ card, index, slot: index }));
    for (const cycle of [-2, -1, 1, 2]) {
      this.cards.forEach((source, index) => {
        const card = source.cloneNode(true);
        card.tabIndex = -1;
        card.setAttribute('aria-hidden', 'true');
        card.addEventListener('click', () => this.enterDestination(index, card));
        this.track.append(card);
        this.cardInstances.push({ card, index, slot: index + cycle * destinations.length });
      });
    }
  }

  get durationScale() { return motionPreference.matches ? 0 : 1; }

  // Scene animations are serialized by entering/returning, independently of selection.
  async animate(element, frames, duration, easing = cinematicEase) {
    const animation = element.animate(frames, {
      duration: Math.max(1, duration * this.durationScale), easing, fill: 'both'
    });
    try {
      await animation.finished;
      Object.assign(element.style, frames[frames.length - 1]);
    } finally {
      animation.cancel();
    }
  }

  async moveCard(card, to, duration) {
    const computed = getComputedStyle(card);
    const from = {
      transform: computed.transform === 'none' ? to.transform : computed.transform,
      opacity: computed.opacity
    };
    this.cardAnimations.get(card)?.cancel();
    this.cardAnimations.delete(card);
    if (duration === 0) {
      Object.assign(card.style, to);
      return;
    }
    const animation = card.animate([from, to], {
      duration: Math.max(1, duration * this.durationScale), easing: cinematicEase, fill: 'both'
    });
    this.cardAnimations.set(card, animation);
    try {
      await animation.finished;
      if (this.cardAnimations.get(card) === animation) Object.assign(card.style, to);
    } catch (error) {
      if (error.name !== 'AbortError') throw error;
    } finally {
      if (this.cardAnimations.get(card) === animation) {
        this.cardAnimations.delete(card);
        animation.cancel();
      }
    }
  }

  trackOffset() {
    const transform = getComputedStyle(this.track).transform;
    return transform === 'none' ? 0 : new DOMMatrixReadOnly(transform).m41;
  }

  async moveTrack(fromPosition, targetPosition, step, duration) {
    this.trackAnimation?.cancel();
    this.trackAnimation = null;
    const from = `translate3d(${-fromPosition * step}px, 0, 0)`;
    const to = `translate3d(${-targetPosition * step}px, 0, 0)`;
    this.track.style.transform = from;
    const normalized = (targetPosition % destinations.length + destinations.length) % destinations.length;
    const settled = `translate3d(${-normalized * step}px, 0, 0)`;
    if (duration === 0) {
      this.track.style.transform = settled;
      this.updateCardAccessibility(normalized);
      return;
    }
    const animation = this.track.animate([{ transform: from }, { transform: to }], {
      duration: Math.max(1, duration * this.durationScale),
      easing: 'cubic-bezier(.25, .1, .25, 1)', fill: 'both'
    });
    this.trackAnimation = animation;
    try {
      await animation.finished;
      if (this.trackAnimation === animation) {
        this.track.style.transform = settled;
        this.updateCardAccessibility(normalized);
      }
    } catch (error) {
      if (error.name !== 'AbortError') throw error;
    } finally {
      if (this.trackAnimation === animation) {
        this.trackAnimation = null;
        animation.cancel();
      }
    }
  }

  updateCardAccessibility(position) {
    this.cardInstances.forEach(({ card, index, slot }) => {
      const accessibleSlot = index + Math.round((position - index) / destinations.length) * destinations.length;
      card.tabIndex = slot === accessibleSlot ? 0 : -1;
      card.setAttribute('aria-hidden', String(slot !== accessibleSlot));
    });
  }

  prepareBrowseCopies(center) {
    // The scene preview may need a guard slot when returning near the loop seam.
    this.cards.forEach((source, index) => {
      const slot = index + Math.round((center - index) / destinations.length) * destinations.length;
      const target = this.cardInstances.find(instance => instance.slot === slot).card;
      if (source === target) return;
      const computed = getComputedStyle(source);
      Object.assign(target.style, { transform: computed.transform, opacity: computed.opacity });
      source.style.opacity = '0';
    });
  }

  async layoutCards(center, mode, duration = 550, direction = 0) {
    const width = this.root.clientWidth;
    const cardWidth = this.cards[0].offsetWidth;
    const gap = width < 600 ? 22 : Math.min(55, width * .038);
    const step = cardWidth + gap;
    const centerX = width * (width < 600 ? .47 : .48) - cardWidth / 2;
    if (mode === 'browse') {
      const count = destinations.length;
      const rawPosition = this.carouselStep ? -this.trackOffset() / this.carouselStep : 0;
      const currentPosition = (rawPosition % count + count) % count;
      let targetPosition = center + Math.round((currentPosition - center) / count) * count;
      if (direction > 0 && targetPosition < currentPosition - .0001) targetPosition += count;
      if (direction < 0 && targetPosition > currentPosition + .0001) targetPosition -= count;
      if (this.layoutMode !== 'browse') {
        targetPosition = center;
        this.prepareBrowseCopies(center);
      }
      const fromPosition = this.layoutMode === 'browse' ? currentPosition : 0;
      this.layoutMode = 'browse';
      this.carouselStep = step;
      const motions = this.cardInstances.map(({ card, index, slot }) => {
        const accessibleSlot = index + Math.round((targetPosition - index) / count) * count;
        card.tabIndex = slot === accessibleSlot ? 0 : -1;
        card.setAttribute('aria-hidden', String(slot !== accessibleSlot));
        card.style.pointerEvents = 'auto';
        // Copies have fixed slots. One shared track supplies all horizontal movement.
        const scale = index === center ? 1 : .97;
        return this.moveCard(card, {
          transform: `translate3d(${centerX + slot * step}px, 0, 0) scale(${scale})`,
          opacity: '1'
        }, duration);
      });
      await Promise.all([this.moveTrack(fromPosition, targetPosition, step, duration), ...motions]);
      return;
    }

    this.layoutMode = 'immersed';
    const motions = this.cardInstances.map(({ card, index, slot }) => {
      const isOriginal = slot === index;
      const isPreview = isOriginal && index === wrap(center + 1);
      const x = isPreview ? width * (width < 600 ? .91 : .94) : index === center ? -cardWidth - 90 : width + step * (index + 1);
      card.tabIndex = isPreview ? 0 : -1;
      card.style.pointerEvents = isPreview ? 'auto' : 'none';
      card.setAttribute('aria-hidden', String(!isPreview));
      return this.moveCard(card, {
        transform: `translate3d(${x}px, 0, 0) rotateY(-3deg) scale(.98)`,
        opacity: isPreview ? '.9' : '0'
      }, isOriginal ? duration : 0);
    });
    await Promise.all(motions);
  }

  destinationCard(index) {
    const stage = this.root.getBoundingClientRect();
    const middle = stage.left + stage.width / 2;
    return this.cardInstances.filter(instance => instance.index === index).reduce((nearest, instance) => {
      const bounds = instance.card.getBoundingClientRect();
      const distance = Math.abs(bounds.left + bounds.width / 2 - middle);
      return distance < nearest.distance ? { card: instance.card, distance } : nearest;
    }, { card: this.cards[index], distance: Infinity }).card;
  }

  updatePlaceLabel() {
    const browsing = this.view === 'browse' || this.view === 'returning';
    const index = browsing ? this.selectedIndex : this.view === 'entering' ? this.enteringIndex : this.openedIndex;
    const destination = destinations[index];
    select('#place').replaceChildren(document.createTextNode(destination.name[0]), document.createElement('br'), document.createTextNode(destination.name[1]));
    select('.current-place .eyebrow').textContent = browsing ? 'SELECTED EXPEDITION' : 'THE CURRENT EXPEDITION';
    select('.current-place').setAttribute('aria-label', browsing ? 'Selected destination' : 'Opened destination');
  }

  updateSelection() {
    const index = this.selectedIndex;
    this.root.dataset.selectedDestination = destinations[index].slug;
    select('#index').textContent = `0${index + 1}`;
    this.cardInstances.forEach(({ card, index: destinationIndex }) => {
      card.classList.toggle('active', destinationIndex === index);
      card.setAttribute('aria-pressed', String(destinationIndex === index));
    });
    this.dots.forEach((dot, i) => dot.setAttribute('aria-current', String(i === index)));
    this.updatePlaceLabel();
    if (this.view === 'browse') this.updateButton();
  }

  // Only an explicit entry changes these: photograph, story, metrics and lighting.
  updateScene(index) {
    const destination = destinations[index];
    select('.scene-title span').textContent = destination.phrase[0];
    select('.scene-title strong').textContent = destination.phrase[1];
    select('#location').textContent = destination.location.toUpperCase();
    select('#distance').textContent = destination.distance;
    select('#elevation').textContent = destination.elevation;
    select('#duration').textContent = `${destination.days} DAYS IN THE WILD`;
    select('.metrics').setAttribute('aria-label', `${destination.name.join(' ')} expedition statistics`);
    select('.terrain-orb').style.backgroundImage = `url('${this.images[index].src}')`;
    this.root.dataset.destination = destination.slug;
    this.root.style.setProperty('--scene-ink', destination.sceneInk);
    this.root.style.setProperty('--traveler-light', destination.light);
  }

  updateButton() {
    const browsing = this.view === 'browse' || this.view === 'returning';
    const button = select('.browse-toggle');
    button.disabled = this.busy;
    button.setAttribute('aria-expanded', String(browsing));
    button.setAttribute('aria-label', browsing ? `Enter the landscape: ${destinations[this.selectedIndex].name.join(' ')}` : 'Explore destinations');
    select('.browse-toggle span').textContent = browsing ? 'ENTER THE LANDSCAPE ↗' : 'EXPLORE DESTINATIONS ↔';
  }

  setView(view) {
    this.view = view;
    this.root.dataset.view = view;
    this.root.setAttribute('aria-busy', String(this.busy));
    select('.intro').setAttribute('aria-hidden', String(view !== 'immersed'));
    select('.interaction-hint').innerHTML = view === 'browse' || view === 'returning' ? 'SELECT A WORLD <b>↔</b>' : 'EXPLORE THE NEXT ROAD <b>↔</b>';
    this.updatePlaceLabel();
    this.updateButton();
  }

  async selectDestination(index) {
    const delta = index - this.selectedIndex;
    const direction = Math.abs(delta) === 1 ? Math.sign(delta) : 0;
    this.selectedIndex = wrap(index);
    this.updateSelection();
    select('#announcement').textContent = `${destinations[this.selectedIndex].name.join(' ')} selected. Use Enter the landscape to open it.`;
    if (this.view === 'entering') {
      // Navigation during entry requests browse afterwards, never another entry.
      this.pendingBrowse = true;
      return;
    }
    if (this.view === 'immersed') {
      await this.returnToBrowse();
      return;
    }
    this.selectionMotion = this.layoutCards(this.selectedIndex, 'browse', 550, direction);
    await this.selectionMotion;
  }

  async waitForSelection() {
    let motion;
    do {
      motion = this.selectionMotion;
      await motion;
    } while (motion !== this.selectionMotion);
  }

  async returnToBrowse() {
    if (this.view === 'entering') { this.pendingBrowse = true; return; }
    if (this.view === 'browse' || this.view === 'returning') return;
    this.busy = true;
    this.setView('returning');
    this.selectionMotion = this.layoutCards(this.selectedIndex, 'browse', 550);
    try {
      await Promise.all([
        this.animate(select('.intro'), [{ opacity: select('.intro').style.opacity || '1', transform: 'translateY(0)' }, { opacity: 0, transform: 'translateY(-8px)' }], 350),
        this.waitForSelection()
      ]);
    } finally {
      this.busy = false;
      this.setView('browse');
      this.selectionMotion = this.layoutCards(this.selectedIndex, 'browse', 0);
    }
  }

  freezeCards(sourceCard) {
    const trackX = this.trackOffset();
    // Transfer each visible copy to its original without changing its screen position.
    const frames = this.cards.map((card, index) => {
      const source = sourceCard && index === this.enteringIndex ? sourceCard : this.destinationCard(index);
      const computed = getComputedStyle(source);
      const matrix = new DOMMatrix(computed.transform === 'none' ? undefined : computed.transform);
      matrix.m41 += trackX;
      return { transform: matrix.toString(), opacity: computed.opacity };
    });
    this.trackAnimation?.cancel();
    this.trackAnimation = null;
    this.track.style.transform = 'translate3d(0, 0, 0)';
    this.cardInstances.forEach(({ card, index, slot }) => {
      this.cardAnimations.get(card)?.cancel();
      Object.assign(card.style, frames[index]);
      if (slot !== index) {
        card.style.opacity = '0';
        card.style.pointerEvents = 'none';
        card.tabIndex = -1;
        card.setAttribute('aria-hidden', 'true');
      }
    });
    this.cardAnimations.clear();
    this.layoutMode = 'scene';
  }

  async enterDestination(index = this.selectedIndex, sourceCard = null) {
    // Cards open their own index; the dedicated button opens the selection.
    if (this.busy) return;
    const next = wrap(index);
    if (this.view === 'immersed') {
      this.selectedIndex = next;
      this.updateSelection();
      await this.returnToBrowse();
      if (this.selectedIndex !== next) return;
      sourceCard = null;
    }
    if (this.view !== 'browse' || this.busy) return;
    this.selectedIndex = next;
    this.updateSelection();
    const previous = this.openedIndex;
    this.enteringIndex = next;
    this.pendingBrowse = false;
    this.busy = true;
    this.setView('entering');
    this.freezeCards(sourceCard);
    let success = false;
    const statistics = [select('.metrics'), select('.current-place')];
    try {
      await this.images[next].decode();
      select('.asset-error').hidden = true;
      // Expand from this exact card's current position, without advancing the deck.
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

      // Traveler stays fixed above the growing image, as in the original scene.
      const expansion = Promise.all([
        this.animate(this.reveal, [{ clipPath: originClip }, { clipPath: 'inset(0px 0px 0px 0px round 0px)' }], 1250),
        this.animate(this.revealImage, [{ transform: originTransform }, { transform: 'translate3d(0, 0, 0) scale(1)' }], 1250),
        this.layoutCards(next, 'immersed', 1050)
      ]);
      await Promise.all([
        expansion,
        ...statistics.map(element => this.animate(element, [{ opacity: 1, transform: 'translateY(0)' }, { opacity: 0, transform: 'translateY(8px)' }], 340))
      ]);
      this.layers[previous].classList.remove('active');
      this.layers[next].classList.add('active');
      this.openedIndex = next;
      this.updateScene(next);
      this.updatePlaceLabel();
      this.reveal.hidden = true;
      await Promise.all([
        this.animate(select('.intro'), [{ opacity: 0, transform: 'translateY(12px)', clipPath: 'inset(0 0 100% 0)' }, { opacity: 1, transform: 'translateY(0)', clipPath: 'inset(0 0 0% 0)' }], 650),
        ...statistics.map(element => this.animate(element, [{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'translateY(0)' }], 550)),
        ...[...document.querySelectorAll('.metric>svg>path:first-child')].map(element => this.animate(element, [{ strokeDasharray: '300', strokeDashoffset: '300' }, { strokeDasharray: '300', strokeDashoffset: '0' }], 800))
      ]);
      select('#announcement').textContent = `${destinations[next].name.join(' ')} opened. ${destinations[next].phrase.join(' ')}. ${destinations[next].distance} kilometers.`;
      success = true;
    } catch (error) {
      console.error('The destination transition could not complete:', error);
      select('.asset-error').hidden = false;
      this.updateScene(this.openedIndex);
      select('.intro').style.opacity = '0';
      statistics.forEach(element => { element.style.opacity = '1'; element.style.transform = ''; });
    } finally {
      this.reveal.hidden = true;
      await this.layoutCards(this.openedIndex, success ? 'immersed' : 'browse', 0);
      this.busy = false;
      this.setView(success ? 'immersed' : 'browse');
      if (this.pendingBrowse && success) {
        this.pendingBrowse = false;
        await this.returnToBrowse();
      } else if (!success) {
        this.pendingBrowse = false;
        this.selectionMotion = this.layoutCards(this.selectedIndex, 'browse', 0);
      }
    }
  }

  bind() {
    select('.previous').addEventListener('click', () => this.selectDestination(this.selectedIndex - 1));
    select('.next').addEventListener('click', () => this.selectDestination(this.selectedIndex + 1));
    select('.reset').addEventListener('click', () => this.selectDestination(0));
    select('.browse-toggle').addEventListener('click', () => {
      if (this.view === 'browse') this.enterDestination();
      else this.returnToBrowse();
    });
    document.addEventListener('keydown', event => {
      if (event.altKey || event.ctrlKey || event.metaKey || /INPUT|TEXTAREA|SELECT/.test(event.target.tagName) || event.target.isContentEditable) return;
      if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
        event.preventDefault();
        this.selectDestination(this.selectedIndex + (event.key === 'ArrowRight' ? 1 : -1));
      }
      if (event.key === 'Home') { event.preventDefault(); this.selectDestination(0); }
      if (event.key === 'End') { event.preventDefault(); this.selectDestination(3); }
      if (event.key === 'Escape') this.returnToBrowse();
    });

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
        this.selectDestination(this.selectedIndex + (dx < 0 ? 1 : -1));
      }
    });
    addEventListener('pointercancel', () => { gesture = null; suppressClick = false; });
    this.root.addEventListener('click', event => {
      if (suppressClick) { event.preventDefault(); event.stopImmediatePropagation(); suppressClick = false; }
    }, true);
    let wheelTotal = 0;
    let lastWheel = 0;
    let lastWheelSelection = -Infinity;
    this.root.addEventListener('wheel', event => {
      if (event.ctrlKey) return;
      event.preventDefault();
      const now = performance.now();
      const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
      if (now - lastWheel > 180) wheelTotal = 0;
      lastWheel = now;
      if (this.view === 'entering') { wheelTotal = 0; return; }
      wheelTotal += delta;
      if (Math.abs(wheelTotal) > 65 && now - lastWheelSelection > 180) {
        this.selectDestination(this.selectedIndex + (wheelTotal > 0 ? 1 : -1));
        wheelTotal = 0;
        lastWheelSelection = now;
      }
    }, { passive: false });

    // Parallax affects ambient light only; the road and traveler remain aligned.
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
    addEventListener('resize', () => {
      if (this.view === 'entering') return;
      this.selectionMotion = this.layoutCards(this.view === 'immersed' ? this.openedIndex : this.selectedIndex, this.view === 'immersed' ? 'immersed' : 'browse', 0);
    });
    document.addEventListener('visibilitychange', () => { if (document.hidden) gesture = null; });
  }
}

const travelSlider = new TravelSlider();
