import type { Instincts } from './Instincts';
import { TRAP_INFO, type TrapType } from './Trap';

// DOM-based heads-up display overlay.
export class HUD {
  root: HTMLDivElement;
  private healthFill!: HTMLSpanElement;
  private energyFill!: HTMLSpanElement;
  private healthVal!: HTMLSpanElement;
  private energyVal!: HTMLSpanElement;
  private suitMode!: HTMLElement;
  private objText!: HTMLElement;
  private levelName!: HTMLElement;
  private fragments!: HTMLElement;
  private trapCount!: HTMLElement;
  private detection!: HTMLElement;
  private detFill!: HTMLSpanElement;
  private detLabel!: HTMLElement;
  private powersTray!: HTMLElement;
  private powerEls = new Map<string, { root: HTMLElement; cd: HTMLElement }>();
  private subtitle!: HTMLElement;
  private prompt!: HTMLElement;
  private vignette!: HTMLElement;
  private banner!: HTMLElement;
  private subtitleTimer = 0;
  private bannerTimer = 0;

  constructor(instincts: Instincts) {
    this.root = document.createElement('div');
    this.root.id = 'hud';
    this.root.className = 'hud-hidden';
    this.root.innerHTML = `
      <div id="crosshair"></div>
      <div id="vignette"></div>

      <div id="objective">
        <div class="obj-title">Objective</div>
        <div class="obj-text"></div>
      </div>

      <div id="meta">
        <div id="level-name"></div>
        <div id="fragments"></div>
        <div id="trap-count"></div>
      </div>

      <div id="detection">
        <div class="det-label">Detected</div>
        <div class="det-bar"><span></span></div>
      </div>

      <div id="status">
        <div>
          <div class="bar-label"><span>Integrity</span><span class="hp-val">100</span></div>
          <div class="bar health"><span></span></div>
        </div>
        <div>
          <div class="bar-label"><span>Suit Energy</span><span class="en-val">100</span></div>
          <div class="bar energy"><span></span></div>
        </div>
        <div id="suit-mode">Suit: <b>ARMOR</b></div>
      </div>

      <div id="powers"></div>
      <div id="subtitle"></div>
      <div id="prompt"></div>
      <div id="banner"><div class="b-main"></div><div class="b-sub"></div></div>
    `;
    document.body.appendChild(this.root);

    this.healthFill = this.root.querySelector('.bar.health > span')!;
    this.energyFill = this.root.querySelector('.bar.energy > span')!;
    this.healthVal = this.root.querySelector('.hp-val')!;
    this.energyVal = this.root.querySelector('.en-val')!;
    this.suitMode = this.root.querySelector('#suit-mode b')!;
    this.objText = this.root.querySelector('#objective .obj-text')!;
    this.levelName = this.root.querySelector('#level-name')!;
    this.fragments = this.root.querySelector('#fragments')!;
    this.trapCount = this.root.querySelector('#trap-count')!;
    this.detection = this.root.querySelector('#detection')!;
    this.detFill = this.root.querySelector('#detection .det-bar > span')!;
    this.detLabel = this.root.querySelector('#detection .det-label')!;
    this.powersTray = this.root.querySelector('#powers')!;
    this.subtitle = this.root.querySelector('#subtitle')!;
    this.prompt = this.root.querySelector('#prompt')!;
    this.vignette = this.root.querySelector('#vignette')!;
    this.banner = this.root.querySelector('#banner')!;

    // Build power slots.
    for (const p of instincts.powers) {
      const el = document.createElement('div');
      el.className = 'power locked';
      el.innerHTML = `<span class="p-key">${p.keyLabel}</span><span class="p-icon">${p.icon}</span><span class="p-cd"></span>`;
      el.title = `${p.name} — ${p.description}`;
      this.powersTray.appendChild(el);
      this.powerEls.set(p.id, { root: el, cd: el.querySelector('.p-cd')! });
    }
  }

  show() {
    this.root.classList.remove('hud-hidden');
  }
  hide() {
    this.root.classList.add('hud-hidden');
  }

  setLevel(name: string, objective: string) {
    this.levelName.textContent = name;
    this.objText.textContent = objective;
  }

  setHealth(hp: number, max: number) {
    const r = Math.max(0, hp / max);
    this.healthFill.style.transform = `scaleX(${r})`;
    this.healthVal.textContent = String(Math.ceil(hp));
  }

  setEnergy(en: number, max: number) {
    const r = Math.max(0, en / max);
    this.energyFill.style.transform = `scaleX(${r})`;
    this.energyVal.textContent = String(Math.ceil(en));
  }

  setSuit(mode: string, cloaked: boolean) {
    this.suitMode.textContent = cloaked ? 'CLOAK' : mode.toUpperCase();
    this.suitMode.style.color = cloaked ? '#38b6ff' : '#fff';
  }

  setFragments(got: number, total: number) {
    this.fragments.textContent = `◆ Memories ${got}/${total}`;
  }

  setTrap(type: TrapType, count: number) {
    const info = TRAP_INFO[type];
    this.trapCount.innerHTML = `${info.icon} ${info.name} ×${count} <span style="opacity:.55">[G to swap]</span>`;
  }

  setDetection(level: number, anyAlert: boolean) {
    const pct = Math.min(100, level * 100);
    this.detFill.style.width = `${pct}%`;
    if (anyAlert) {
      this.detFill.style.background = '#ff3b4e';
      this.detLabel.textContent = 'Detected';
    } else if (level > 0.05) {
      this.detFill.style.background = '#ffb02e';
      this.detLabel.textContent = 'Suspicious';
    }
    this.detection.classList.toggle('visible', level > 0.05);
  }

  updatePowers(instincts: Instincts) {
    for (const p of instincts.powers) {
      const el = this.powerEls.get(p.id)!;
      el.root.classList.toggle('locked', !p.unlocked);
      el.root.classList.toggle('active', p.active);
      const cdRatio = p.cooldown > 0 ? p.cd / p.cooldown : 0;
      el.cd.style.height = `${cdRatio * 100}%`;
    }
  }

  setVignette(hurt: number, alarm: boolean) {
    this.vignette.classList.toggle('hurt', hurt > 0.15);
    this.vignette.classList.toggle('alarm', alarm);
  }

  showSubtitle(text: string, who = '', duration = 5) {
    this.subtitle.innerHTML = who ? `<span class="who">${who}:</span> ${text}` : text;
    this.subtitle.classList.add('visible');
    this.subtitleTimer = duration;
  }

  showPrompt(html: string) {
    this.prompt.innerHTML = html;
    this.prompt.classList.add('visible');
  }
  hidePrompt() {
    this.prompt.classList.remove('visible');
  }

  showBanner(main: string, sub: string, kind: 'good' | 'danger' | 'neutral', duration = 2.5) {
    this.banner.querySelector('.b-main')!.textContent = main;
    this.banner.querySelector('.b-sub')!.textContent = sub;
    this.banner.className = '';
    this.banner.classList.add('visible');
    if (kind !== 'neutral') this.banner.classList.add(kind);
    this.bannerTimer = duration;
  }

  update(dt: number) {
    if (this.subtitleTimer > 0) {
      this.subtitleTimer -= dt;
      if (this.subtitleTimer <= 0) this.subtitle.classList.remove('visible');
    }
    if (this.bannerTimer > 0) {
      this.bannerTimer -= dt;
      if (this.bannerTimer <= 0) this.banner.classList.remove('visible');
    }
  }
}
