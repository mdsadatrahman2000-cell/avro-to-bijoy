import {
  bijoyToUnicodeMap,
  preConversionMap,
  postConversionMap,
  proConversionMap,
  protectedUrlRegex,
  isConsonant,
  isKar,
  isPreKar,
  isPostKar,
} from './bijoy-map';

// ============================================================================
// BIJOY → UNICODE CONVERTER
// Pipeline:
// 1. Mask URLs/emails with PUA sentinels
// 2. Normalize with preConversionMap
// 3. Substitute with bijoyToUnicodeMap
// 4. Reorder passes (reph, halant, pre-kars, nukta)
// 5. Post-fixup with postConversionMap
// 6. Restore URLs/emails
// ============================================================================

const SENTINEL_BASE = 0xe000;

function maskProtectedContent(text: string): { masked: string; restore: (s: string) => string } {
  const matches: string[] = [];
  const masked = text.replace(protectedUrlRegex, (match) => {
    matches.push(match);
    return String.fromCharCode(SENTINEL_BASE + matches.length - 1);
  });

  return {
    masked,
    restore: (s: string) => {
      return s.replace(/[\uE000-\uE0FF]/g, (ch) => {
        const idx = ch.charCodeAt(0) - SENTINEL_BASE;
        return matches[idx] || ch;
      });
    },
  };
}

// Build regex from bijoy map keys (longest first)
const bijoyKeys = Object.keys(bijoyToUnicodeMap).sort((a, b) => b.length - a.length);
const bijoyRegex = new RegExp(
  bijoyKeys.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'),
  'g'
);

function applyMainGlyphMap(text: string): string {
  return text.replace(bijoyRegex, (match) => bijoyToUnicodeMap[match] || match);
}

// ============================================================================
// REORDER PASSES
// ============================================================================

function moveReph(s: string): string {
  const arr = Array.from(s);
  const result: string[] = [];
  let i = 0;

  while (i < arr.length) {
    if (
      arr[i] === 'র' &&
      i + 1 < arr.length &&
      arr[i + 1] === '্' &&
      (i === 0 || arr[i - 1] !== '্')
    ) {
      // Found reph (র্) - find the consonant cluster it modifies
      let j = 1;
      let consonantCount = 0;

      while (i - j >= 0) {
        if (isConsonant(arr[i - j]) && i - j - 1 >= 0 && arr[i - j - 1] === '্') {
          j += 2; // skip consonant + halant pair
          consonantCount++;
        } else if (j === 1 && isKar(arr[i - j])) {
          j++; // skip kar that may precede the cluster
        } else {
          break;
        }
      }

      if (consonantCount > 0) {
        // Move reph before the cluster
        const clusterStart = i - j;
        const cluster = arr.slice(clusterStart, i);
        result.splice(clusterStart, result.length - clusterStart + clusterStart);
        for (let k = clusterStart; k < result.length; k++) {
          result.pop();
        }
        result.push('র্');
        result.push(...cluster);
        i += 2;
      } else {
        result.push(arr[i]);
        i++;
      }
    } else {
      result.push(arr[i]);
      i++;
    }
  }

  return result.join('');
}

function swapHalantAfterKar(s: string): string {
  const arr = Array.from(s);
  const result: string[] = [];
  let i = 0;

  while (i < arr.length) {
    if (
      i + 1 < arr.length &&
      arr[i + 1] === '্' &&
      (isKar(arr[i]) || arr[i] === 'ঁ')
    ) {
      // kar + halant + consonant → halant + consonant + kar
      if (i + 2 < arr.length) {
        result.push(arr[i + 1]); // halant
        result.push(arr[i + 2]); // consonant
        result.push(arr[i]);     // kar
        i += 3;
      } else {
        result.push(arr[i]);
        i++;
      }
    } else {
      result.push(arr[i]);
      i++;
    }
  }

  return result.join('');
}

function swapRaHalantKar(s: string): string {
  // RA + Halant + Kar (with no halant before RA) → Kar + RA + Halant
  const arr = Array.from(s);
  let i = 1;
  while (i < arr.length - 1) {
    if (
      arr[i] === '্' &&
      arr[i - 1] === 'র' &&
      (i - 2 < 0 || arr[i - 2] !== '্') &&
      isKar(arr[i + 1])
    ) {
      // Swap: kar comes before RA + halant
      [arr[i - 1], arr[i], arr[i + 1]] = [arr[i + 1], arr[i - 1], arr[i]];
      i += 2;
      continue;
    }
    i++;
  }
  return arr.join('');
}

function moveAllKars(s: string): string {
  // In Bijoy byte order, kars appear BEFORE the consonant they modify.
  // After glyph substitution, some kars are already in correct Unicode position
  // (after their consonant), while others still precede their consonant.
  //
  // Key insight: if a kar is already preceded by a consonant, it's correctly placed.
  // Otherwise, move it after the next consonant cluster.
  //
  // Special: e-kar (ে) + aa-kar (া) or ou-kar (ৗ) → o-kar (ো) or ou-kar (ৌ)
  const arr = Array.from(s);
  const result: string[] = [];
  let i = 0;

  while (i < arr.length) {
    if (isKar(arr[i])) {
      // Post-kars (া, ী, ু, ূ, ৃ, ৗ) that are already after a consonant are correctly placed.
      // Pre-kars (ি, ে, ৈ) always need to be moved after the consonant cluster.
      if (isPostKar(arr[i]) && i > 0 && isConsonant(arr[i - 1])) {
        result.push(arr[i]);
        i++;
        continue;
      }

      // Collect consecutive kars before the consonant
      const kars: string[] = [];
      let k = i;
      while (k < arr.length && isKar(arr[k])) {
        kars.push(arr[k]);
        k++;
      }

      // After the kars, expect a consonant cluster
      if (k >= arr.length || !isConsonant(arr[k])) {
        for (const kch of kars) result.push(kch);
        i = k;
        continue;
      }

      // Walk past the consonant cluster
      let j = k;
      while (j < arr.length && isConsonant(arr[j])) {
        if (j + 1 < arr.length && arr[j + 1] === '্') {
          j += 2;
        } else {
          j++;
          break;
        }
      }

      // Don't let kars leak past sentence boundaries
      if (j < arr.length && (arr[j] === '।' || arr[j] === '.' || arr[j] === '\n' || arr[j] === '\r')) {
        for (const kch of kars) result.push(kch);
        i = k;
        continue;
      }

      // Combine kars:
      // Case 1: consecutive kars ে+া or ে+ৗ before consonant (†vK = ে+া+ক → কো)
      // Case 2: e-kar before consonant, aa-kar/ou-kar after (†mv = ে+স+া → সো)
      let combinedKar = kars[0];
      let karSkip = 0;
      if (kars.length >= 2 && kars[0] === 'ে') {
        if (kars[1] === 'া') {
          combinedKar = 'ো';
          karSkip = 1;
        } else if (kars[1] === 'ৗ') {
          combinedKar = 'ৌ';
          karSkip = 1;
        }
      } else if (kars.length === 1 && kars[0] === 'ে' && j < arr.length) {
        if (arr[j] === 'া') {
          combinedKar = 'ো';
          karSkip = 1;
        } else if (arr[j] === 'ৗ') {
          combinedKar = 'ৌ';
          karSkip = 1;
        }
      }

      // Emit consonant cluster, then the kar
      const cluster = arr.slice(k, j);
      result.push(...cluster);
      result.push(combinedKar);
      i = j + karSkip;
    } else {
      result.push(arr[i]);
      i++;
    }
  }

  return result.join('');
}

function moveNuktaAfterKar(s: string): string {
  const arr = Array.from(s);
  const result: string[] = [];
  let i = 0;

  while (i < arr.length) {
    if (arr[i] === 'ঁ' && i + 1 < arr.length && isPostKar(arr[i + 1])) {
      // Swap nukta after post-kar
      result.push(arr[i + 1]);
      result.push(arr[i]);
      i += 2;
    } else {
      result.push(arr[i]);
      i++;
    }
  }

  return result.join('');
}

function reorder(text: string): string {
  let result = text;
  result = moveReph(result);
  for (const [pattern, replacement] of proConversionMap) {
    result = result.replace(pattern, replacement);
  }
  result = swapHalantAfterKar(result);
  result = swapRaHalantKar(result);
  result = moveAllKars(result);
  result = moveNuktaAfterKar(result);
  return result;
}

// ============================================================================
// MAIN EXPORT
// ============================================================================

export function bijoyToUnicode(bijoyText: string): string {
  // Step 1: Mask URLs/emails
  const { masked, restore } = maskProtectedContent(bijoyText);

  // Step 2: Pre-conversion normalization
  let result = masked;
  for (const [pattern, replacement] of preConversionMap) {
    result = result.replace(pattern, replacement);
  }

  // Step 3: Main glyph substitution
  result = applyMainGlyphMap(result);

  // Step 4: Reorder passes
  result = reorder(result);

  // Step 5: Post-conversion fixups
  for (const [pattern, replacement] of postConversionMap) {
    result = result.replace(pattern, replacement);
  }

  // Step 6: Restore URLs/emails
  result = restore(result);

  return result;
}
