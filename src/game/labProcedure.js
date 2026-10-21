// Derive guidance from real lab state: no separate tutorial progress to desynchronise.
const step = (id, title, text, target, selector = '', extra = {}) => ({ id, title, text, target, selector, ...extra });
const photo = (id, target, label) => step(`photo-${id}`, `Photograph ${label}`, 'Close the panel with Esc. Face the marked subject, press Q, centre it and click for a sharp photo. Q lowers the camera.', target, '', { photo: id });
export function nextLabStep(L) {
  const c = L.cyber, b = L.bio, t = L.trace, d = L.docs, r = L.reports;
  if (L.station.departureReady) return step('complete', 'Evidence delivered', 'Your next assignment is loading.');
  if (!L.station.checkedIn) return step('reception', 'Greet reception', 'Enter the station. Approach Mokoena on the left, look at the desk and press E.', 'reception');
  if (!L.signedIn) return step('intake', 'Sign the intake sheet', 'Enter the marked lab through the left doorway. Look at the intake paperwork and press E, then sign the sheet.', 'intake', '#intake-sign');
  if (!L.gloves) return step('gloves', 'Put on gloves', 'Look at the glove dispenser at the left end of intake and press E. Now you can handle the exhibits.', 'gloves');
  if (c.unlocked && !c.airplane && !c.wiped) return step('airplane', 'Airplane mode — now', 'Open the handset and click enable beside AIRPLANE MODE before the device can be wiped.', 'handset', '#ph-air', { urgent: true });
  if (!r.digital && !c.wiped) {
    if (c.staged === 'bag') return step('phone', 'Collect the phone', 'Look at the phone in its evidence bag on intake and press E.', 'phone');
    if (c.staged === 'carried') return step('shield', 'Shield the phone', 'Carry it to the silver Faraday box at the digital bench. Look at the box and press E to place it inside.', 'faraday');
    if (c.staged === 'faraday' && !L.carried) return step('retrieve', 'Take the shielded phone', 'Press E on the Faraday box again to take the phone out. Next, connect it to the cradle.', 'faraday');
    if (c.staged === 'faraday') return step('cradle', 'Connect the phone', 'Look at the cradle beside the laptop and press E to seat and cable the phone.', 'unit');
    if (!c.unlocked) {
      if (c.unitDone || c.cracked) return step('pin', 'Unlock the handset', 'Read the recovered PIN on the laptop display. Press E on the handset and enter that PIN. Do not guess; turn airplane mode on immediately after unlocking.', 'handset');
      if (c.term?.busy || c.unitRunning) return step('acquiring', 'Recovery in progress', 'Wait for the workstation to finish. The recovered PIN will appear on its display.', 'laptop');
      if (!c.term?.files?.['lock.hash']) return step('dump', 'Recover the lock record', 'Press E on the laptop. Type this command and press Enter. This copies the lock record for examination.', 'laptop', '#tm-in', { command: 'lockdump /dev/cradle0 -o lock.hash' });
      return step('crack', 'Recover the PIN', 'The dump reports a four-digit numeric PIN. Type this command and press Enter; wait for the result, then Esc closes the laptop.', 'laptop', '#tm-in', { command: 'hashcat -m 0 -a 3 lock.hash ?d?d?d?d' });
    }
    for (const [app, label] of [['messages', 'message thread'], ['maps', 'map pin'], ['contacts', 'recent contacts']]) {
      if (!c.flags.has(app)) return step(`flag-${app}`, `Record the ${label}`, `Open the handset, find ${app.toUpperCase()} using the home-page arrows, then read and scroll to its flag button. Click the flag to record this lead.`, 'handset', `[data-flag="${app}"], [data-app="${app}"]`);
    }
    if (!L._hasPhoto('unit-display')) return photo('unit-display', 'laptop', 'the laptop display');
    return step('digital-report', 'File the digital report', 'Open the handset and click Log digital report. Reading the phone and filing its report are separate actions.', 'handset', '#ph-log');
  }
  // Start the slow test early. Let players examine other exhibits while it runs.
  if (!r.dna) {
    if (!b.cut) return step('cut', 'Prepare the blood sample', 'At the biology bench, look at the stained cloth and scissors. Press E to cut a swatch.', 'cut', '#bio-cut');
    if (!b.lysis) return step('lysis', 'Treat the sample', 'Look at the lysis tube and press E. The treatment releases DNA from the sample.', 'lysis', '#bio-lysis');
    if (!b.loaded) return step('cartridge', 'Load the cartridge', 'Look at the cartridge beside the sequencer and press E to load it.', 'cartridge', '#bio-load');
    if (!b.running && !b.ready) return step('run', 'Start the DNA test', 'Press E on the green RUN button. It takes three minutes; you can work at the other benches while it runs.', 'seqrun', '#bio-run');
    if (b.ready) {
      if (!b.matched) return step('match', 'Compare the DNA profile', 'Return to biology. Press E on the blue MATCH button, then read the comparison.', 'seqmatch', '#bio-match-btn');
      if (!L._hasPhoto('sequencer')) return photo('sequencer', 'seqmatch', 'the sequencer readout');
      return step('dna-report', 'File the DNA report', 'Press E on the biology clipboard to file the completed report.', 'biopad', '#bio-log');
    }
  }
  if (!r.micro) {
    if (!t.strand) return step('strand', 'Prepare the microscope slide', 'At the trace bench, press E on the loose hair strand to place it on the slide.', 'strand', '#tr-strand');
    if (!t.cover) return step('cover', 'Add the cover slip', 'Press E on the glass cover slip beside the strand.', 'cover', '#tr-cover');
    if (!t.openRef) return step('reference', 'Choose a comparison sample', 'Press E on the microscope eyepiece. Click a reference in the rack to compare it with the unknown hair.', 'eyepiece', '[data-ref]');
    if (t.focus < 74 || t.focus > 90) return step('focus', 'Bring the hair into focus', 'In the eyepiece, adjust the FOCUS slider until it says SHARP.', 'eyepiece', '#ep-focus');
    if (t.turret !== '40x') return step('magnification', 'Increase magnification', 'Click the turret control until the objective reads 40x. Now the comparison details are visible.', 'eyepiece', '#ep-turret');
    if (!t.verdicts[t.openRef]) return step('verdict', 'Record what you observe', 'Compare the two samples: medulla, pigment and cuticle. Choose consistent, excluded or unclear based on what you see.', 'eyepiece', '[data-verdict]');
    if (Object.keys(t.verdicts).length < 2) return step('another-reference', 'Compare a second reference', 'Choose a different reference from the rack and record a verdict. One comparison is not enough.', 'eyepiece', '[data-ref]');
    if (!L._traceClaimComplete()) return step('claim', 'Make your final claim', 'Choose your supported reference and a claim, or record inconclusive if you cannot support a match. The guide will not choose a suspect for you.', 'eyepiece', '[name="claim"], [data-pick]');
    if (!t.glassUV && L.carried?.id !== 'uvwand') return step('wand', 'Pick up the UV wand', 'Close the eyepiece with Esc. At the reconstruction bench, look at the UV wand and press E to pick it up.', 'wand');
    if (!t.glassUV) return step('glass', 'Scan the guest glass', 'Press E on the guest glass at the trace bench. Move the UV beam across the rim and side until both scanned areas are complete.', 'tglass', '#lx-cv');
    if (!L._hasPhoto('microscope')) return photo('microscope', 'eyepiece', 'the microscope');
    return step('trace-report', 'File the trace report', 'Close the eyepiece with Esc. Press E on the trace clipboard to file your observations.', 'tracepad', '#tr-record');
  }
  if (!r.docs) {
    if (!d.casingRead) return step('casing', 'Examine the casing', 'At the reconstruction bench, look at the casing in its tray and press E. Read the observation.', 'casingtray');
    if (!d.trailRead) return step('trail', 'Examine the scene photograph', 'Look at the working copy of the UV-trail photograph and press E.', 'trailprints');
    if (!L._hasPhoto('casing')) return photo('casing', 'casingtray', 'the casing tray');
    if (!L._hasPhoto('trail')) return photo('trail', 'trailprints', 'the trail photograph');
    return step('docs-report', 'File the reconstruction report', 'Press E on the reconstruction clipboard. Your readings and both photographs must be recorded first.', 'docspad', '#doc-log');
  }
  if (!r.dna) return step('dna-wait', 'DNA test running', 'The other benches are complete. Wait for the sequencer to finish; you can sign the reports already filed at the report table.', 'folder', '[data-sign]:not(:disabled)', { remaining: Math.max(0, Math.ceil(180 - b.t)) });
  if (!r.digital) return step('lost-phone', 'Phone evidence unavailable', 'The phone was wiped. Press R to restart if you want to recover its evidence. Shield it and enable airplane mode immediately after unlocking.');
  if (Object.values(r).some(report => !report.signed)) return step('sign', 'Sign the report pages', 'Press E on the folder at the report table. Click Sign page on each of the four reports.', 'folder', '[data-sign]:not(:disabled)');
  if (!L.station.doorOpen) return step('office-door', 'Open the captain’s office', 'Take the completed file to the office on the right. Press E at the door to open it.', 'stationDoor');
  return step('deliver', 'Deliver the completed file', 'Approach Captain Mabaso and press E. You have examined, photographed, filed and signed the evidence.', 'captain');
}
