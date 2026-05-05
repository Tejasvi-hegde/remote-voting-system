/**
 * Compares two ASCII fingerprint template strings.
 * Returns a similarity score between 0 and 1.
 * Threshold for a match: >= 0.85
 */
function compareTemplates(templateA, templateB) {
  if (!templateA || !templateB) return 0;

  const normalize = str => str.trim().toLowerCase().replace(/\r\n/g, '\n');
  const a = normalize(templateA).split('\n').filter(Boolean);
  const b = normalize(templateB).split('\n').filter(Boolean);

  if (a.length === 0 || b.length === 0) return 0;

  const shorter = a.length <= b.length ? a : b;
  const longer  = a.length <= b.length ? b : a;

  let matchCount = 0;
  for (const line of shorter) {
    if (longer.includes(line)) matchCount++;
  }

  return matchCount / longer.length;
}

function isMatch(templateA, templateB, threshold = 0.85) {
  return compareTemplates(templateA, templateB) >= threshold;
}

module.exports = { compareTemplates, isMatch };
