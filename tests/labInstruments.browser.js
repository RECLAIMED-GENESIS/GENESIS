// Development browser regression: await import this module with Level 2 active.
export function checkLabInstruments(L) {
  const check = (ok, message) => { if (!ok) throw new Error(message); results.push(message); }, results = [];
  const saved = { signedIn: L.signedIn, gloves: L.gloves, carried: L.carried, docs: { ...L.docs }, trace: { ...L.trace }, collected: { ...L.collected }, progress: L._examinationProgress };
  L._briefing?.cancel(); L.signedIn = L.gloves = true; L.collected.glass = L.collected.casing = L.collected.trail = true;
  L.trace.glassUV = false; L.docs.casingRead = L.docs.trailRead = false; L._examinationProgress = {};
  try {
    L.carried = { id: 'uvwand' }; L.docs.lightsOff = false;
    L._interact({ kind: 'tglass' }); check(L._deviceMode !== 'glassscan', 'Room lights must be off for UV scanning');
    L.docs.lightsOff = true; L._interact({ kind: 'tglass' });
    let view = L._examinationView;
    check(!!view?.renderer.domElement.isConnected, 'Glass opens a rendered instrument view');
    view.record(); check(!L.trace.glassUV, 'Opening the instrument does not automatically record evidence');
    view.buttons[0].click(); for (let i=0;i<12;i++) view.update(.05);
    L._closeDevice(); check(view.disposed && !window.__uiCapture, 'Closing the view releases renderer and input capture');
    L._openDevice('glassscan'); view=L._examinationView;
    check(view.progress.coverage.Rim===1, 'Partial scan coverage survives closing and reopening');
    view.buttons[1].click(); for(let i=0;i<12;i++)view.update(.05);
    check(!L.trace.glassUV && !view.recordButton.disabled, 'Completed UV inspection waits for explicit recording');
    view.recordButton.click(); check(L.trace.glassUV,'Recording the scan updates the trace report prerequisites'); L._closeDevice();
    L.docs.lightsOff=false;L._openDevice('glassscan');check(L._deviceMode!== 'glassscan','Recorded glass cannot bypass the lights-off rule');
    L._openDevice('trail');check(L._deviceMode!== 'trail','Trace surface also requires lights off');
    L.docs.lightsOff=true;
    for(const [kind,mode,flag] of [['casingtray','casing','casingRead'],['trailprints','trail','trailRead']]) {
      L._interact({kind}); view=L._examinationView;
      check(L._deviceMode===mode&&!L.docs[flag], `${mode} interaction opens the exhibit without awarding a finding`);
      for(const button of view.buttons) { button.click(); for(let i=0;i<24;i++)view.update(.05); }
      check(!view.recordButton.disabled, `${mode} features can all be inspected`);
      view.recordButton.click(); check(L.docs[flag], `${mode} finding is recorded after inspection`);
      L._closeDevice(); check(view.disposed, `${mode} renderer is disposed on close`);
    }
    return results;
  } finally {
    L._closeDevice(); L.signedIn=saved.signedIn; L.gloves=saved.gloves; L.carried=saved.carried;
    Object.assign(L.docs,saved.docs); Object.assign(L.trace,saved.trace); Object.assign(L.collected,saved.collected); L._examinationProgress=saved.progress;
    L._applyDocsMood(); L._refreshCounter(); clearTimeout(L._toastTimer); L.ui.toast.style.opacity=0;
  }
}
