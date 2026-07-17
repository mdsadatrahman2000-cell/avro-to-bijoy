import { unicodeToBijoyMap } from './bijoy-map';

// ============================================================================
// UNICODE → BIJOY CONVERTER
// Pipeline:
// 1. Reorder Unicode characters for Bijoy's LTR glyph ordering
// 2. Main glyph substitution via unicodeToBijoyMap (longest-match-first)
// 3. Post-fixup: trailing reph cleanup, special char swaps
// ============================================================================

// Build regex from unicode map keys (longest first)
const unicodeKeys = Object.keys(unicodeToBijoyMap).sort((a, b) => b.length - a.length);
const unicodeRegex = new RegExp(
  unicodeKeys.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'),
  'g'
);

function isBengaliConsonant(char: string): boolean {
  const code = char.charCodeAt(0);
  return code >= 0x0995 && code <= 0x09B9; // ক to হ
}

function isBengaliHalant(char: string): boolean {
  return char === '্';
}

function isBengaliPreKar(char: string): boolean {
  return 'িেৈ'.includes(char);
}

function isBengaliPostKar(char: string): boolean {
  return 'াীুূৃৗ'.includes(char);
}

// ============================================================================
// PRE-PROCESSING: Reorder Unicode characters for Bijoy's LTR glyph ordering
// In Unicode: consonant + pre-kar (e.g., ম + ি = মি)
// In Bijoy:   pre-kar + consonant (e.g., w + g = wg for মি)
// ============================================================================

function preprocessUnicode(text: string): string {
  const arr = Array.from(text);
  const result: string[] = [];
  let i = 0;

  while (i < arr.length) {
    // Handle reph (র্) - In Unicode: র্ + consonant cluster
    // In Bijoy: consonant cluster + © (reph after)
    if (arr[i] === 'র' && i + 1 < arr.length && isBengaliHalant(arr[i + 1])) {
      let j = i + 2;
      let consonants = 0;

      // Walk through the consonant cluster after reph
      while (j < arr.length && isBengaliConsonant(arr[j])) {
        consonants++;
        if (j + 1 < arr.length && isBengaliHalant(arr[j + 1])) {
          j += 2; // skip consonant + halant
        } else {
          j++;
          break;
        }
      }

      if (consonants > 0) {
        // Emit consonant cluster first, then reph
        const cluster = arr.slice(i + 2, j);
        result.push(...cluster);
        result.push('র্');
        i = j;
        continue;
      }
    }

    // Handle consonant + post-kar (e.g., ক + া = কা)
    // In Bijoy: consonant + kar (same order, just mapped)
    // This is handled by the main glyph map

    // Handle consonant cluster + pre-kar (e.g., ক্ষ + ি = ক্ষি)
    // In Bijoy: pre-kar + consonant cluster
    if (isBengaliConsonant(arr[i])) {
      // Collect the consonant cluster
      let j = i;
      while (j < arr.length && isBengaliConsonant(arr[j])) {
        if (j + 1 < arr.length && isBengaliHalant(arr[j + 1])) {
          j += 2; // skip consonant + halant
        } else {
          j++;
          break;
        }
      }

      // Check if followed by a pre-kar
      if (j < arr.length && isBengaliPreKar(arr[j])) {
        // Emit pre-kar first, then consonant cluster
        const cluster = arr.slice(i, j);
        result.push(arr[j]); // pre-kar
        result.push(...cluster); // consonant cluster
        i = j + 1;
        continue;
      }
    }

    result.push(arr[i]);
    i++;
  }

  return result.join('');
}

// ============================================================================
// MAIN GLYPH SUBSTITUTION
// ============================================================================

function applyMainGlyphMap(text: string): string {
  return text.replace(unicodeRegex, (match) => unicodeToBijoyMap[match] || match);
}

// ============================================================================
// POST-PROCESSING
// ============================================================================

function postprocess(text: string): string {
  let result = text;

  // Handle trailing reph (©)
  if (result.endsWith('©')) {
    result = result.slice(0, -1);
  }

  // Swap q‡ → ‡q and o‡ → ‡o (reph + e-kar ordering)
  result = result.replace(/q‡/g, '‡q');
  result = result.replace(/o‡/g, '‡o');

  // Move © (reph) after its base character
  result = result.replace(/©([ক-হ])/g, '$1©');

  return result;
}

// ============================================================================
// MAIN EXPORT
// ============================================================================

export function unicodeToBijoy(unicodeText: string): string {
  // Step 1: Pre-process Unicode text for Bijoy ordering
  let result = preprocessUnicode(unicodeText);

  // Step 2: Apply main glyph substitution
  result = applyMainGlyphMap(result);

  // Step 3: Post-process
  result = postprocess(result);

  return result;
}
