.panel-label { font-size: 11px; font-weight: 700; letter-spacing: .17em; }
.panel-label span { font-size: 17px; margin-left: 10px; }
.bar { width: 190px; max-width: 35vw; height: 5px; background: #39403b; margin: 8px 0; }
.health-fill { height: 100%; width: 100%; background: #c7d5bd; transition: width .15s; }
.small-status { font-size: 9px; letter-spacing: .14em; color: #9ca59e; }
.weapon-panel { text-align: right; border-left: 0; border-right: 2px solid var(--orange); background: linear-gradient(270deg, rgba(5,10,11,.8), rgba(5,10,11,.28)); }
.weapon-name { font: 700 22px 'Barlow Condensed', sans-serif; letter-spacing: .08em; }
.ammo { font: 700 29px 'Barlow Condensed', sans-serif; }
.ammo span { color: #89938d; font-size: 17px; }
.weapon-hint { font-size: 9px; letter-spacing: .08em; color: #8c9890; }
.toast { position: absolute; top: 23%; left: 50%; transform: translateX(-50%); font-size: 13px; font-weight: 700; letter-spacing: .14em; color: #ffb08d; text-align: center; text-shadow: 0 2px 8px #000; opacity: 0; transition: opacity .2s; white-space: pre-line; }
.toast.visible { opacity: 1; }
#damage-flash { position: absolute; inset: 0; opacity: 0; background: radial-gradient(ellipse at center, transparent 30%, rgba(175,15,8,.75)); transition: opacity .18s; }
.pause-label { position: absolute; left: 50%; top: 38%; transform: translate(-50%,-50%); background: rgba(0,0,0,.75); padding: 14px 22px; border: 1px solid #69716b; color: white; letter-spacing: .15em; font-weight: 700; white-space: nowrap; }
#error-panel { position: absolute; z-index: 99; left: 10px; right: 10px; bottom: 10px; background: #4d1111; color: #fff; padding: 12px; white-space: pre-wrap; font: 12px monospace; }
.mobile-controls { display: none; }
@media (max-width: 700px), (pointer: coarse) {
  .menu-content { margin: 0 auto; width: 86vw; }
  .studio-mark { margin-bottom: 38px; }
  .story-copy { font-size: 11px; }
  .menu-foot { flex-direction: column; gap: 8px; margin-top: 30px; }
  .menu-side-label { display: none; }
  .hud-top { top: 13px; left: 13px; right: 13px; }
  .hud-bottom { bottom: 12px; left: 10px; right: 10px; }
  .health-panel, .weapon-panel { min-width: 0; padding: 9px; }
  .bar { width: 120px; }
  .weapon-name { font-size: 18px; }
  .ammo { font-size: 24px; }
  .weapon-hint { display: none; }
  .mobile-controls { display: block; }
  .stick-zone { pointer-events: auto; position: absolute; left: 22px; bottom: 100px; width: 116px; height: 116px; border: 1px solid rgba(235,240,230,.32); border-radius: 50%; background: rgba(10,15,15,.28); touch-action: none; }
  #stick-knob { position: absolute; left: 34px; top: 34px; width: 46px; height: 46px; border-radius: 50%; background: rgba(220,230,215,.35); border: 1px solid rgba(255,255,255,.5); }
  .mobile-actions { position: absolute; right: 22px; bottom: 105px; display: flex; align-items: center; gap: 12px; pointer-events: auto; }
  .mobile-actions button { border: 1px solid rgba(255,255,255,.55); color: white; background: rgba(10,15,15,.55); border-radius: 50%; width: 54px; height: 54px; font-weight: 800; touch-action: none; }
  .mobile-actions #mobile-fire { width: 72px; height: 72px; border-color: var(--orange); background: rgba(240,100,50,.82); color: #111; }
}
