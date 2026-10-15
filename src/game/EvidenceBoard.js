// ============================================================
// EvidenceBoard.js — case board overlay UI
// ============================================================
import { normId, normEvId } from './investigation.js';

export class EvidenceBoard {
  constructor(opts) {
    this.opts = opts;
    this.open_ = false;
    this.selected = null;
    this._build();
  }

  _build() {
    const root = document.createElement('div');
    root.style.cssText = `position:fixed;inset:0;display:none;background:rgba(3,4,7,.96);
      z-index:9998;font-family:"Courier New",monospace;color:#e9d9b0;pointer-events:auto;overflow:auto;`;
    root.innerHTML = `
      <div style="position:absolute;inset:0;pointer-events:none;
                  background:radial-gradient(ellipse at 30% 40%, rgba(90,60,20,.08), transparent 60%)"></div>
      <div style="max-width:1320px;margin:3vh auto;padding:0 24px;position:relative">
        <div style="display:flex;justify-content:space-between;align-items:baseline">
          <h2 style="letter-spacing:6px;color:#f2b84b;margin:0">THE BOARD</h2>
          <span style="font-size:12px;opacity:.7">click evidence → click a mugshot &nbsp;·&nbsp; [B / Esc] close</span>
        </div>
        <p style="opacity:.7;margin:6px 0 18px;font-size:13px">
          Link what you have to who it points at. Green string lands. Red snaps back — and costs you rank.
        </p>
        <div style="display:grid;grid-template-columns:260px 1fr;gap:22px">
          <div id="eb-rail"></div>
          <div id="eb-mugs" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:14px"></div>
        </div>
        <div id="eb-captain" style="margin-top:22px;text-align:right"></div>
      </div>
      <svg id="eb-strings" style="position:fixed;inset:0;pointer-events:none;z-index:9999"></svg>`;
    document.body.appendChild(root);
    this.root = root;
    this.rail = root.querySelector('#eb-rail');
    this.mugs = root.querySelector('#eb-mugs');
    this.captain = root.querySelector('#eb-captain');
    this.svg = root.querySelector('#eb-strings');

    this._onMouse = (e) => this._drawFromCursor(e.clientX, e.clientY);
    this._onKey = (e) => {
      if ((e.code === 'KeyB' || e.code === 'Escape') && this.open_) {
        e.stopPropagation();
        this.close();
      }
    };
  }

  open() {
    this.open_ = true;
    this.root.style.display = 'block';
    this._render();
    window.__uiCapture = true;
    document.addEventListener('mousemove', this._onMouse);
    document.addEventListener('keydown', this._onKey, true);
    if (document.exitPointerLock) document.exitPointerLock();
  }

  close() {
    this.open_ = false;
    this.root.style.display = 'none';
    this._clearSelection();
    this.svg.innerHTML = '';
    window.__uiCapture = false;
    document.removeEventListener('mousemove', this._onMouse);
    document.removeEventListener('keydown', this._onKey, true);
    if (this.opts.onClose) this.opts.onClose();
  }

  refresh() { if (this.open_) this._render(); }

  _render() {
    const evidence = this.opts.getEvidence();
    const suspects = this.opts.getSuspects();
    const board = this.opts.getBoard();
    const summary = this.opts.getSummary();

    this.rail.innerHTML = `<h3 style="letter-spacing:3px;color:#f2b84b;margin:0 0 10px;font-size:13px">EVIDENCE (${evidence.length})</h3>`;
    for (const e of evidence) {
      const card = document.createElement('div');
      card.className = 'eb-ev';
      card.dataset.id = e.id;
      card.style.cssText = `padding:9px 12px;margin:0 0 8px;background:${e.from==='l1'?'#171410':'#0f1520'};
        border-left:3px solid ${e.from==='l1'?'#f2b84b':'#7fd4ff'};cursor:pointer;font-size:13px;position:relative`;
      card.innerHTML = `${e.name}<span style="position:absolute;right:8px;top:9px;font-size:10px;opacity:.55">${e.from}</span>`;
      card.addEventListener('click', () => this._selectEvidence(e.id, card));
      this.rail.appendChild(card);
    }

    this.mugs.innerHTML = '';
    for (const s of suspects) {
      const sid = normId(s.id);
      const sum = summary[sid] || { kinds: [], score: 0, strong: 0, byKind: {} };
      const linked = (board[sid] || []).length;
      const card = document.createElement('div');
      card.className = 'eb-mug';
      card.dataset.id = sid;
      card.style.cssText = `padding:14px 16px;background:#0e1018;border:1px solid #2a2f3c;cursor:pointer;position:relative`;
      const icon = (k, on, strong) => on
        ? `<span style="display:inline-block;width:26px;height:26px;line-height:26px;text-align:center;
             border:1px solid ${strong?'#3fa87a':'#5a6b8a'};background:${strong?'rgba(63,168,122,.15)':'rgba(90,107,138,.1)'};
             color:${strong?'#3fa87a':'#8ba0c0'};font-weight:bold;font-size:11px;margin-right:6px">${k}</span>`
        : `<span style="display:inline-block;width:26px;height:26px;line-height:26px;text-align:center;
             border:1px dashed #2a3342;color:#2a3342;font-size:11px;margin-right:6px">${k}</span>`;
      card.innerHTML = `
        <div style="font-size:15px;letter-spacing:1px;color:#f2b84b">${s.name}</div>
        <div style="font-size:11px;opacity:.6;margin-bottom:10px">${s.role}</div>
        <div style="margin-bottom:8px">
          ${icon('M', sum.byKind.means > 0, sum.byKind.means >= 1)}
          ${icon('Mo', sum.byKind.motive > 0, sum.byKind.motive >= 1)}
          ${icon('O', sum.byKind.opportunity > 0, sum.byKind.opportunity >= 1)}
        </div>
        <div style="font-size:11px;opacity:.7">${linked} link${linked===1?'':'s'} · score ${sum.score.toFixed(1)}</div>
        <button data-cap="${sid}" style="margin-top:10px;font:inherit;font-size:12px;padding:6px 12px;
          background:${linked?'#a1241c':'#2a2f3a'};color:${linked?'#fff':'#8b93a3'};border:0;
          cursor:${linked?'pointer':'default'}" ${linked?'':'disabled'}>Take to captain</button>`;
      card.addEventListener('click', (ev) => {
        if (ev.target.dataset.cap) return;
        this._dropOn(sid, card);
      });
      const capBtn = card.querySelector('[data-cap]');
      capBtn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        if (this.opts.onTakeToCaptain) this.opts.onTakeToCaptain(sid);
      });
      this.mugs.appendChild(card);
    }
    this._drawStrings();
  }

  _selectEvidence(id, el) {
    this._clearSelection();
    this.selected = { id, el };
    el.style.outline = '2px solid #7fd4ff';
  }

  _clearSelection() {
    if (this.selected && this.selected.el) this.selected.el.style.outline = '';
    this.selected = null;
    this.svg.innerHTML = '';
  }

  _drawFromCursor(x, y) {
    if (!this.selected) return;
    const r = this.selected.el.getBoundingClientRect();
    this.svg.innerHTML = `<line x1="${r.right}" y1="${r.top + r.height/2}" x2="${x}" y2="${y}"
      stroke="#7fd4ff" stroke-width="2" stroke-dasharray="4 3" opacity=".8"/>`;
  }

  _dropOn(suspectId, mugEl) {
    if (!this.selected) return;
    const res = this.opts.tryLink(this.selected.id, suspectId);
    const ok = !!(res && res.ok);
    const r1 = this.selected.el.getBoundingClientRect();
    const r2 = mugEl.getBoundingClientRect();
    if (ok) {
      this._flashLine(r1, r2, '#3fa87a');
      if (this.opts.onChange) this.opts.onChange();
      setTimeout(() => this._render(), 220);
    } else {
      this._flashLine(r1, r2, '#a1241c');
      mugEl.animate([{transform:'translateX(-5px)'},{transform:'translateX(5px)'},{transform:'translateX(0)'}], {duration:280});
      if (this.opts.onChange) this.opts.onChange({ failed: true });
      setTimeout(() => this._clearSelection(), 300);
    }
  }

  _flashLine(r1, r2, color) {
    this.svg.innerHTML = `<line x1="${r1.right}" y1="${r1.top+r1.height/2}"
      x2="${r2.left}" y2="${r2.top+r2.height/2}"
      stroke="${color}" stroke-width="3" opacity="1">
      <animate attributeName="opacity" from="1" to="0" dur="0.45s" fill="freeze"/></line>`;
  }

  _drawStrings() {
    const board = this.opts.getBoard();
    const html = [];
    for (const sid of Object.keys(board)) {
      const mug = this.mugs.querySelector(`[data-id="${normId(sid)}"]`);
      if (!mug) continue;
      const mr = mug.getBoundingClientRect();
      for (const eid of board[sid]) {
        const ev = this.rail.querySelector(`[data-id="${eid}"]`);
        if (!ev) continue;
        const er = ev.getBoundingClientRect();
        html.push(`<path d="M ${er.right} ${er.top+er.height/2} C ${(er.right+mr.left)/2} ${er.top+er.height/2}, ${(er.right+mr.left)/2} ${mr.top+mr.height/2}, ${mr.left} ${mr.top+mr.height/2}"
          stroke="#3fa87a" stroke-width="1.6" fill="none" opacity=".55"/>`);
      }
    }
    this.svg.innerHTML = html.join('');
  }

  dispose() { this.close(); this.root.remove(); }
}
