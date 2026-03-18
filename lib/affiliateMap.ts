/**
 * BJJ Fanatics Affiliate Link Mapper
 * Maps technique names to BJJ Fanatics DVD products
 * Usage: getAffiliateLink(techniqueName) returns URL or null
 */

export const AFF_CODE = "bjjapp";
const BASE = "https://bjjfanatics.com/products";

/**
 * Affiliate map: technique keyword -> BJJ Fanatics product URL
 * Uses partial string matching (case-insensitive)
 */
const affiliateMap: Record<string, string> = {
  // Guard systems
  "closed guard": `${BASE}/closed-guard-leg-lock-system-by-john-danaher?aff=${AFF_CODE}`,
  "half guard": `${BASE}/half-guard-by-craig-jones?aff=${AFF_CODE}`,
  "spider guard": `${BASE}/spider-web-guard-series-by-marcelo-garcia?aff=${AFF_CODE}`,
  "de la riva": `${BASE}/de-la-riva-guard-system-by-guillermo-maldonado?aff=${AFF_CODE}`,
  "dela riva": `${BASE}/de-la-riva-guard-system-by-guillermo-maldonado?aff=${AFF_CODE}`,
  "dlr": `${BASE}/de-la-riva-guard-system-by-guillermo-maldonado?aff=${AFF_CODE}`,
  "butterfly guard": `${BASE}/butterfly-guard-system-by-marcelo-garcia?aff=${AFF_CODE}`,
  "x guard": `${BASE}/x-guard-system-by-rafael-mendes?aff=${AFF_CODE}`,
  "collar sleeve": `${BASE}/collar-sleeve-guard-by-lachlan-giles?aff=${AFF_CODE}`,
  "lasso guard": `${BASE}/lasso-guard-by-marcelo-garcia?aff=${AFF_CODE}`,
  "rubber guard": `${BASE}/rubber-guard-system-by-eddie-bravo?aff=${AFF_CODE}`,
  "foot lock": `${BASE}/leg-lock-system-by-john-danaher?aff=${AFF_CODE}`,

  // Submissions - Chokes
  "triangle choke": `${BASE}/triangle-choke-system-by-john-danaher?aff=${AFF_CODE}`,
  "triangle": `${BASE}/triangle-choke-system-by-john-danaher?aff=${AFF_CODE}`,
  "rear naked choke": `${BASE}/rear-naked-choke-system-by-john-danaher?aff=${AFF_CODE}`,
  "rnc": `${BASE}/rear-naked-choke-system-by-john-danaher?aff=${AFF_CODE}`,
  "collar choke": `${BASE}/collar-choke-system-by-john-danaher?aff=${AFF_CODE}`,
  "collar drag": `${BASE}/collar-drag-by-marcelo-garcia?aff=${AFF_CODE}`,
  "guillotine": `${BASE}/guillotine-choke-system-by-john-danaher?aff=${AFF_CODE}`,
  "d'arce choke": `${BASE}/darce-choke-system-by-john-danaher?aff=${AFF_CODE}`,
  "darce": `${BASE}/darce-choke-system-by-john-danaher?aff=${AFF_CODE}`,
  "anaconda": `${BASE}/anaconda-choke-system-by-john-danaher?aff=${AFF_CODE}`,
  "arm triangle": `${BASE}/arm-triangle-choke-by-craig-jones?aff=${AFF_CODE}`,
  "bow and arrow": `${BASE}/bow-and-arrow-choke-by-neil-melanson?aff=${AFF_CODE}`,
  "baseball bat choke": `${BASE}/baseball-bat-choke-by-lachlan-giles?aff=${AFF_CODE}`,
  "cross collar": `${BASE}/cross-collar-choke-by-marcelo-garcia?aff=${AFF_CODE}`,
  "ezekiel choke": `${BASE}/ezekiel-choke-system-by-john-danaher?aff=${AFF_CODE}`,

  // Submissions - Arm attacks
  "armbar": `${BASE}/armbar-system-by-john-danaher?aff=${AFF_CODE}`,
  "arm bar": `${BASE}/armbar-system-by-john-danaher?aff=${AFF_CODE}`,
  "kimura": `${BASE}/kimura-system-by-john-danaher?aff=${AFF_CODE}`,
  "omoplata": `${BASE}/omoplata-system-by-john-danaher?aff=${AFF_CODE}`,
  "gogoplata": `${BASE}/gogoplata-system-by-john-danaher?aff=${AFF_CODE}`,
  "gogo plata": `${BASE}/gogoplata-system-by-john-danaher?aff=${AFF_CODE}`,

  // Submissions - Leg attacks
  "heel hook": `${BASE}/leg-lock-system-by-john-danaher?aff=${AFF_CODE}`,
  "heel hooks": `${BASE}/leg-lock-system-by-john-danaher?aff=${AFF_CODE}`,
  "leg lock": `${BASE}/leg-lock-system-by-john-danaher?aff=${AFF_CODE}`,
  "ankle lock": `${BASE}/leg-lock-system-by-john-danaher?aff=${AFF_CODE}`,
  "knee reap": `${BASE}/leg-lock-system-by-john-danaher?aff=${AFF_CODE}`,
  "kneebar": `${BASE}/leg-lock-system-by-john-danaher?aff=${AFF_CODE}`,
  "calf slicer": `${BASE}/leg-lock-system-by-john-danaher?aff=${AFF_CODE}`,
  "straight foot lock": `${BASE}/leg-lock-system-by-john-danaher?aff=${AFF_CODE}`,
  "toe hold": `${BASE}/leg-lock-system-by-john-danaher?aff=${AFF_CODE}`,
  "saddle": `${BASE}/leg-lock-system-by-john-danaher?aff=${AFF_CODE}`,
  "ashi garami": `${BASE}/leg-lock-system-by-john-danaher?aff=${AFF_CODE}`,

  // Passing
  "guard passing": `${BASE}/guard-passing-system-by-john-danaher?aff=${AFF_CODE}`,
  "guard pass": `${BASE}/guard-passing-system-by-john-danaher?aff=${AFF_CODE}`,
  "leg drag": `${BASE}/leg-drag-pass-by-marcelo-garcia?aff=${AFF_CODE}`,
  "smash pass": `${BASE}/guard-passing-system-by-john-danaher?aff=${AFF_CODE}`,
  "knee slice": `${BASE}/guard-passing-system-by-john-danaher?aff=${AFF_CODE}`,
  "stack pass": `${BASE}/guard-passing-system-by-john-danaher?aff=${AFF_CODE}`,
  "pressure passing": `${BASE}/guard-passing-system-by-john-danaher?aff=${AFF_CODE}`,

  // Back attacks
  "back control": `${BASE}/back-control-system-by-john-danaher?aff=${AFF_CODE}`,
  "back attack": `${BASE}/back-control-system-by-john-danaher?aff=${AFF_CODE}`,
  "body triangle": `${BASE}/back-control-system-by-john-danaher?aff=${AFF_CODE}`,
  "seat belt": `${BASE}/back-control-system-by-john-danaher?aff=${AFF_CODE}`,

  // Mount attacks
  "mount": `${BASE}/mount-attack-system-by-john-danaher?aff=${AFF_CODE}`,
  "s-mount": `${BASE}/mount-attack-system-by-john-danaher?aff=${AFF_CODE}`,
  "high mount": `${BASE}/mount-attack-system-by-john-danaher?aff=${AFF_CODE}`,

  // Takedowns
  "double leg": `${BASE}/double-leg-takedown-by-gordon-ryan?aff=${AFF_CODE}`,
  "single leg": `${BASE}/single-leg-takedown-system-by-marcelo-garcia?aff=${AFF_CODE}`,
  "takedown": `${BASE}/takedown-system-by-john-danaher?aff=${AFF_CODE}`,
  "wrestling": `${BASE}/wrestling-fundamentals-by-gordon-ryan?aff=${AFF_CODE}`,
  "front headlock": `${BASE}/front-headlock-system-by-neil-melanson?aff=${AFF_CODE}`,

  // Sweeps
  "sweep": `${BASE}/sweep-system-by-marcelo-garcia?aff=${AFF_CODE}`,
  "hip bump": `${BASE}/sweep-system-by-marcelo-garcia?aff=${AFF_CODE}`,
  "scissor sweep": `${BASE}/sweep-system-by-marcelo-garcia?aff=${AFF_CODE}`,
  "flower sweep": `${BASE}/sweep-system-by-marcelo-garcia?aff=${AFF_CODE}`,

  // Escapes & Defense
  "escape": `${BASE}/escape-system-by-neil-melanson?aff=${AFF_CODE}`,
  "defense": `${BASE}/defensive-system-by-neil-melanson?aff=${AFF_CODE}`,
  "mount escape": `${BASE}/escape-system-by-neil-melanson?aff=${AFF_CODE}`,
  "side control escape": `${BASE}/escape-system-by-neil-melanson?aff=${AFF_CODE}`,

  // High-level instructors (as catch-all for their system)
  "gordon ryan": `${BASE}/gordon-ryan-instructionals?aff=${AFF_CODE}`,
  "marcelo garcia": `${BASE}/marcelo-garcia-instructionals?aff=${AFF_CODE}`,
  "rickson": `${BASE}/rickson-gracie-instructionals?aff=${AFF_CODE}`,
  "john danaher": `${BASE}/danaher-fundamentals?aff=${AFF_CODE}`,
  "craig jones": `${BASE}/craig-jones-instructionals?aff=${AFF_CODE}`,
  "lachlan giles": `${BASE}/lachlan-giles-instructionals?aff=${AFF_CODE}`,
};

/**
 * Get affiliate link for a technique
 * @param techniqueName - The technique name to search for
 * @returns BJJ Fanatics URL with affiliate code, or null if not found
 *
 * @example
 * getAffiliateLink("triangle choke")
 * // Returns: "https://bjjfanatics.com/products/triangle-choke-system-by-john-danaher?aff=bjjapp"
 *
 * getAffiliateLink("some random technique")
 * // Returns: null
 */
export function getAffiliateLink(techniqueName: string): string | null {
  if (!techniqueName || typeof techniqueName !== "string") return null;

  const lower = techniqueName.toLowerCase().trim();

  // Try exact match first
  for (const [key, url] of Object.entries(affiliateMap)) {
    if (lower === key) return url;
  }

  // Try partial match (key contained in techniqueName)
  for (const [key, url] of Object.entries(affiliateMap)) {
    if (lower.includes(key)) return url;
  }

  // Try reverse (techniqueName contained in key)
  for (const [key, url] of Object.entries(affiliateMap)) {
    if (key.includes(lower)) return url;
  }

  return null;
}
