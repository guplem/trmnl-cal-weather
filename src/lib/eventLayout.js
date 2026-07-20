// Pure event time-and-layout helpers, copied verbatim from the inline JS in
// `src/full.liquid` so they can run under `bun test`. There is no build step,
// so the template keeps its own inline copy; the two MUST stay in sync (see
// src/AGENTS.md and adr/0006-extracted-testable-helpers-with-inline-copies.md).

/**
 * Parse an event start time to minutes-since-midnight. Prefers the `start_full`
 * ISO timestamp; falls back to a bare `HH:MM` or AM/PM `start` field. Returns
 * -1 when there is no usable time (all-day events).
 * @param {string} startField - AM/PM or HH:MM string, e.g. "9:00 AM" or "09:00"
 * @param {string} fullField - ISO timestamp, e.g. "2026-04-09T08:55:00.000+02:00"
 * @returns {number} minutes since midnight, or -1
 */
export function toMin(startField, fullField) {
  // Prefer start_full ISO timestamp
  if (fullField && fullField.length > 16) {
    var tp = fullField.substring(11, 16).split(":");
    return +tp[0] * 60 + +tp[1];
  }
  if (!startField) return -1;
  // Handle AM/PM format
  var s = startField.trim().toUpperCase();
  var pm = s.indexOf("PM") > -1, am = s.indexOf("AM") > -1;
  s = s.replace(/[AP]M/gi, "").trim();
  var p = s.split(":");
  var h = +p[0], m = +p[1] || 0;
  if (pm && h < 12) h += 12;
  if (am && h === 12) h = 0;
  return h * 60 + m;
}

/**
 * Pack overlapping events into side-by-side columns. Mutates `evts` in place:
 * sorts it, and sets `.col` (column index) and `.totalCols` (columns in the
 * event's overlap cluster) on each element. Each element must have `.sm`
 * (start minute) and `.em` (end minute).
 * @param {Array<{sm:number, em:number, col?:number, totalCols?:number}>} evts
 * @returns {void}
 */
export function layoutOverlaps(evts) {
  evts.sort(function(a,b){return a.sm-b.sm||(b.em-b.sm)-(a.em-a.sm);});
  var clusters=[];
  for(var i=0;i<evts.length;i++){
    var e=evts[i],placed=false;
    for(var ci=0;ci<clusters.length;ci++){
      if(e.sm<clusters[ci].end){clusters[ci].events.push(e);if(e.em>clusters[ci].end)clusters[ci].end=e.em;placed=true;break;}
    }
    if(!placed) clusters.push({end:e.em,events:[e]});
  }
  for(var ci=0;ci<clusters.length;ci++){
    var ce=clusters[ci].events,cols=[];
    for(var i=0;i<ce.length;i++){
      var p=false;
      for(var c=0;c<cols.length;c++){if(ce[i].sm>=cols[c]){cols[c]=ce[i].em;ce[i].col=c;p=true;break;}}
      if(!p){ce[i].col=cols.length;cols.push(ce[i].em);}
    }
    for(var i=0;i<ce.length;i++) ce[i].totalCols=cols.length;
  }
}
