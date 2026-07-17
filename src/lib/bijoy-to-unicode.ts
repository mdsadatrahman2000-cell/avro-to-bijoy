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

function collapseDoubleHalant(s: string): string {
  return s.replace(/্্/g, '্');
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

function movePreKars(s: string): string {
  const arr = Array.from(s);
  const result: string[] = [];
  let i = 0;

  while (i < arr.length) {
    if (isPreKar(arr[i]) && i + 1 < arr.length && arr[i + 1] !== ' ') {
      // Found pre-kar - walk past the consonant cluster
      let j = 1;
      while (i + j < arr.length && isConsonant(arr[i + j])) {
        if (i + j + 1 < arr.length && arr[i + j + 1] === '্') {
          j += 2; // skip consonant + halant
        } else {
          break;
        }
      }

      const cluster = arr.slice(i + 1, i + j + 1);
      let emittedKar = arr[i];
      let skipExtra = 0;

      // Check for e-kar + aa-kar combination → o-kar
      if (arr[i] === 'ে' && i + j + 1 < arr.length && arr[i + j + 1] === 'া') {
        emittedKar = 'ো';
        skipExtra = 1;
      }
      // Check for e-kar + ou-kar combination → ou-kar
      else if (arr[i] === 'ে' && i + j + 1 < arr.length && arr[i + j + 1] === 'ৗ') {
        emittedKar = 'ৌ';
        skipExtra = 1;
      }

      result.push(...cluster);
      result.push(emittedKar);
      i += j + 1 + skipExtra;
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
  result = movePreKars(result);
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
