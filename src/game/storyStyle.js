// Shared cinematic dialogue presentation for every level.
export const storyStyle = `
      .ch-bars:before,.ch-bars:after{content:'';position:fixed;left:0;right:0;height:11vh;background:#000;z-index:63}
      .ch-bars:before{top:0}.ch-bars:after{bottom:0}
      .ch-story{position:fixed;left:50%;bottom:13vh;transform:translateX(-50%);z-index:64;width:min(760px,90vw);
        box-sizing:border-box;background:var(--game-panel);border:1px solid var(--game-border);border-radius:var(--game-radius);padding:18px 22px 14px;
        font-family:var(--game-font);color:var(--game-paper);cursor:pointer}
      .ch-story .t{font-size:clamp(15px,2.2vw,19px);line-height:1.7;min-height:5.1em}
      .ch-story .f{display:flex;justify-content:space-between;align-items:center;margin-top:10px;font-size:12px;letter-spacing:2px}
      .ch-story .d span{color:var(--game-accent);margin-right:5px}.ch-story .d span.dim{color:#3c4656}
      .ch-story .n{color:var(--game-accent)}
      .ch-title{position:fixed;top:14vh;left:0;right:0;text-align:center;z-index:64;pointer-events:none;
        font-family:var(--game-font);color:#f2e6c8;letter-spacing:6px;font-size:clamp(14px,2vw,18px)}
    `;
