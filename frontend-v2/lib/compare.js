"use client";

export function getNextCompareQueue(currentIds = [], listingId) {
  const current = Array.isArray(currentIds) ? currentIds.filter(Boolean) : [];
  if (!listingId) return current.slice(0, 3);

  if (current.includes(listingId)) {
    return current.filter((id) => id !== listingId).slice(0, 3);
  }

  if (current.length >= 3) {
    return [...current.slice(1), listingId];
  }

  return [...current, listingId].slice(0, 3);
}

function compareAffinity(left, right) {
  if (!left || !right) return -1;

  let score = 0;
  if (left.category && right.category && left.category === right.category) score += 5;
  if (left.mode && right.mode && left.mode === right.mode) score += 3;
  if (left.area && right.area && left.area === right.area) score += 1;
  if (left.condition && right.condition && left.condition === right.condition) score += 1;

  const leftPrice = Number(left.price || left.rentDetails?.dailyRate || 0);
  const rightPrice = Number(right.price || right.rentDetails?.dailyRate || 0);
  if (leftPrice > 0 && rightPrice > 0) {
    const delta = Math.abs(leftPrice - rightPrice) / Math.max(leftPrice, rightPrice);
    if (delta <= 0.2) score += 3;
    else if (delta <= 0.4) score += 2;
    else if (delta <= 0.7) score += 1;
  }

  return score;
}

export function pickBestComparePair(listings = []) {
  if (listings.length <= 2) return listings.slice(0, 2);

  let bestPair = listings.slice(0, 2);
  let bestScore = compareAffinity(bestPair[0], bestPair[1]);

  for (let leftIndex = 0; leftIndex < listings.length - 1; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < listings.length; rightIndex += 1) {
      const score = compareAffinity(listings[leftIndex], listings[rightIndex]);
      if (score > bestScore) {
        bestScore = score;
        bestPair = [listings[leftIndex], listings[rightIndex]];
      }
    }
  }

  return bestPair;
}
