/** JSK OS Build 1025 deterministic security assertion manifest. Local test only. */

var BUILD1025_ASSERTION_IDS = (function () {
  var groups = { A: 15, B: 11, C: 17, D: 13, E: 12, F: 15 };
  var ids = [];
  Object.keys(groups).forEach(function (prefix) {
    for (var index = 1; index <= groups[prefix]; index += 1) {
      ids.push(prefix + String(index).padStart(2, '0'));
    }
  });
  return Object.freeze(ids);
})();

function testBuild1025AssertionCoverage(results) {
  var observed = {};
  (results || []).forEach(function (result) {
    (result.assertions || []).forEach(function (id) { observed[id] = true; });
  });
  var missing = BUILD1025_ASSERTION_IDS.filter(function (id) { return !observed[id]; });
  var unknown = Object.keys(observed).filter(function (id) {
    return BUILD1025_ASSERTION_IDS.indexOf(id) === -1;
  });
  if (missing.length || unknown.length) {
    throw new Error('Build 1025 assertion coverage mismatch. Missing: ' + missing.join(', ') + '; unknown: ' + unknown.join(', '));
  }
  return { success: true, expected: BUILD1025_ASSERTION_IDS.length, observed: Object.keys(observed).length };
}
