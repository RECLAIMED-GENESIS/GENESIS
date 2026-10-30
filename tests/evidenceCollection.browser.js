// Run on a disposable Level 1 development run; exercises real collection gates.
export function checkEvidenceCollection(L, player, camera) {
  const results=[]; const check=(ok,message)=>{if(!ok)throw new Error(message);results.push(message);};
  L._briefing?.cancel(); L._timeUp=false;
  for(const id of ['phone','casing','handkerchief']) {
    const clue=L.clues.find(c=>c.id===id);clue.found=false;clue.photo=false;clue.group.visible=true;
    L._collect(clue);check(!L._pickupAnimation.active&&!clue.found,`${id}: photograph is still required`);
    clue.photo=true;L.tool=clue.tool;L._collect(clue);
    check(L._pickupAnimation.active&&clue.found,`${id}: correct tool begins the physical pickup`);
    const animation=L._pickupAnimation;animation.update(.4,player,camera,L._view);
    check(clue.group.visible,`${id}: exhibit stays on the surface while the tool reaches it`);
    animation.update(.5,player,camera,L._view);
    check(!clue.group.visible&&animation.sample.visible,`${id}: actual exhibit is lifted into the collection sequence`);
    for(let i=0;i<40;i++)animation.update(.05,player,camera,L._view);
    check(!animation.active&&window.__caseProgress.l1[id],`${id}: sealed exhibit remains logged for the lab`);
  }
  clearTimeout(L._toastTimer);L.ui.toast.style.display='none';return results;
}
