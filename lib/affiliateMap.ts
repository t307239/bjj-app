/**
 * BJJ Fanatics Affiliate Link Mapper
 * Maps technique names to BJJ Fanatics DVD products
 * Usage: getAffiliateLink(techniqueName) returns URL or null
 *        getAffiliateInfo(techniqueName) returns {url, title, instructor} or null
 */

export const AFF_CODE = "bjjapp";
const BASE = "https://bjjfanatics.com/products";

export type AffiliateInfo = {
  url: string;
  title: string;
  instructor: string;
};

/**
 * Full product info map: technique keyword -> {url, title, instructor}
 */
const affiliateInfoMap: Record<string, AffiliateInfo> = {
  // Guard systems
  "closed guard": { url: `${BASE}/closed-guard-leg-lock-system-by-john-danaher?aff=${AFF_CODE}`, title: "Closed Guard Leg Lock System", instructor: "John Danaher" },
  "half guard": { url: `${BASE}/half-guard-a-complete-system-by-bernardo-faria?aff=${AFF_CODE}`, title: "Half Guard: A Complete System", instructor: "Bernardo Faria" },
  "spider guard": { url: `${BASE}/spider-web-guard-series-by-marcelo-garcia?aff=${AFF_CODE}`, title: "Spider Web Guard Series", instructor: "Marcelo Garcia" },
  "de la riva": { url: `${BASE}/de-la-riva-guard-system-by-guillermo-maldonado?aff=${AFF_CODE}`, title: "De La Riva Guard System", instructor: "Guillermo Maldonado" },
  "dela riva": { url: `${BASE}/de-la-riva-guard-system-by-guillermo-maldonado?aff=${AFF_CODE}`, title: "De La Riva Guard System", instructor: "Guillermo Maldonado" },
  "dlr": { url: `${BASE}/de-la-riva-guard-system-by-guillermo-maldonado?aff=${AFF_CODE}`, title: "De La Riva Guard System", instructor: "Guillermo Maldonado" },
  "butterfly guard": { url: `${BASE}/advanced-butterfly-guard-by-marcelo-garcia?aff=${AFF_CODE}`, title: "Advanced Butterfly Guard", instructor: "Marcelo Garcia" },
  "x guard": { url: `${BASE}/x-guard-system-by-rafael-mendes?aff=${AFF_CODE}`, title: "X-Guard System", instructor: "Rafael Mendes" },
  "collar sleeve": { url: `${BASE}/collar-sleeve-guard-by-lachlan-giles?aff=${AFF_CODE}`, title: "Collar Sleeve Guard", instructor: "Lachlan Giles" },
  "lasso guard": { url: `${BASE}/lasso-guard-by-marcelo-garcia?aff=${AFF_CODE}`, title: "Lasso Guard", instructor: "Marcelo Garcia" },
  "rubber guard": { url: `${BASE}/rubber-guard-system-by-eddie-bravo?aff=${AFF_CODE}`, title: "Rubber Guard System", instructor: "Eddie Bravo" },
  "deep half guard": { url: `${BASE}/deep-half-guard-by-jeff-glover?aff=${AFF_CODE}`, title: "Deep Half Guard", instructor: "Jeff Glover" },

  // Submissions - Chokes
  "triangle choke": { url: `${BASE}/triangle-choke-system-by-john-danaher?aff=${AFF_CODE}`, title: "Triangle: Enter the System", instructor: "John Danaher" },
  "triangle": { url: `${BASE}/triangle-choke-system-by-john-danaher?aff=${AFF_CODE}`, title: "Triangle: Enter the System", instructor: "John Danaher" },
  "rear naked choke": { url: `${BASE}/rear-naked-choke-system-by-john-danaher?aff=${AFF_CODE}`, title: "Rear Naked Choke: Enter the System", instructor: "John Danaher" },
  "rnc": { url: `${BASE}/rear-naked-choke-system-by-john-danaher?aff=${AFF_CODE}`, title: "Rear Naked Choke: Enter the System", instructor: "John Danaher" },
  "collar choke": { url: `${BASE}/collar-choke-system-by-john-danaher?aff=${AFF_CODE}`, title: "Collar Choke System", instructor: "John Danaher" },
  "collar drag": { url: `${BASE}/collar-drag-by-marcelo-garcia?aff=${AFF_CODE}`, title: "Collar Drag", instructor: "Marcelo Garcia" },
  "guillotine": { url: `${BASE}/guillotine-choke-system-by-john-danaher?aff=${AFF_CODE}`, title: "Guillotine: Enter the System", instructor: "John Danaher" },
  "d'arce choke": { url: `${BASE}/darce-choke-system-by-john-danaher?aff=${AFF_CODE}`, title: "D'Arce & Anaconda System", instructor: "John Danaher" },
  "darce": { url: `${BASE}/darce-choke-system-by-john-danaher?aff=${AFF_CODE}`, title: "D'Arce & Anaconda System", instructor: "John Danaher" },
  "anaconda": { url: `${BASE}/anaconda-choke-system-by-john-danaher?aff=${AFF_CODE}`, title: "D'Arce & Anaconda System", instructor: "John Danaher" },
  "arm triangle": { url: `${BASE}/arm-triangle-choke-by-craig-jones?aff=${AFF_CODE}`, title: "Arm Triangle Choke", instructor: "Craig Jones" },
  "bow and arrow": { url: `${BASE}/bow-and-arrow-choke-by-neil-melanson?aff=${AFF_CODE}`, title: "Bow & Arrow Choke", instructor: "Neil Melanson" },
  "baseball bat choke": { url: `${BASE}/baseball-bat-choke-by-lachlan-giles?aff=${AFF_CODE}`, title: "Baseball Bat Choke", instructor: "Lachlan Giles" },
  "cross collar": { url: `${BASE}/cross-collar-choke-by-marcelo-garcia?aff=${AFF_CODE}`, title: "Cross Collar Choke", instructor: "Marcelo Garcia" },
  "ezekiel choke": { url: `${BASE}/ezekiel-choke-system-by-john-danaher?aff=${AFF_CODE}`, title: "Ezekiel Choke System", instructor: "John Danaher" },

  // Submissions - Arm attacks
  "armbar": { url: `${BASE}/armbar-system-by-john-danaher?aff=${AFF_CODE}`, title: "Armbar: Enter the System", instructor: "John Danaher" },
  "arm bar": { url: `${BASE}/armbar-system-by-john-danaher?aff=${AFF_CODE}`, title: "Armbar: Enter the System", instructor: "John Danaher" },
  "kimura": { url: `${BASE}/kimura-system-by-john-danaher?aff=${AFF_CODE}`, title: "Kimura: Enter the System", instructor: "John Danaher" },
  "omoplata": { url: `${BASE}/omoplata-system-by-john-danaher?aff=${AFF_CODE}`, title: "Omoplata: Enter the System", instructor: "John Danaher" },
  "gogoplata": { url: `${BASE}/gogoplata-system-by-john-danaher?aff=${AFF_CODE}`, title: "Gogoplata System", instructor: "John Danaher" },
  "gogo plata": { url: `${BASE}/gogoplata-system-by-john-danaher?aff=${AFF_CODE}`, title: "Gogoplata System", instructor: "John Danaher" },
  "wrist lock": { url: `${BASE}/wrist-locks-from-everywhere-by-neil-melanson?aff=${AFF_CODE}`, title: "Wrist Locks From Everywhere", instructor: "Neil Melanson" },

  // Submissions - Leg attacks
  "heel hook": { url: `${BASE}/leg-locks-enter-the-system-by-john-danaher?aff=${AFF_CODE}`, title: "Leg Locks: Enter the System", instructor: "John Danaher" },
  "heel hooks": { url: `${BASE}/leg-locks-enter-the-system-by-john-danaher?aff=${AFF_CODE}`, title: "Leg Locks: Enter the System", instructor: "John Danaher" },
  "leg lock": { url: `${BASE}/leg-locks-enter-the-system-by-john-danaher?aff=${AFF_CODE}`, title: "Leg Locks: Enter the System", instructor: "John Danaher" },
  "ankle lock": { url: `${BASE}/leg-locks-enter-the-system-by-john-danaher?aff=${AFF_CODE}`, title: "Leg Locks: Enter the System", instructor: "John Danaher" },
  "foot lock": { url: `${BASE}/leg-locks-enter-the-system-by-john-danaher?aff=${AFF_CODE}`, title: "Leg Locks: Enter the System", instructor: "John Danaher" },
  "knee reap": { url: `${BASE}/leg-locks-enter-the-system-by-john-danaher?aff=${AFF_CODE}`, title: "Leg Locks: Enter the System", instructor: "John Danaher" },
  "kneebar": { url: `${BASE}/leg-locks-enter-the-system-by-john-danaher?aff=${AFF_CODE}`, title: "Leg Locks: Enter the System", instructor: "John Danaher" },
  "calf slicer": { url: `${BASE}/leg-locks-enter-the-system-by-john-danaher?aff=${AFF_CODE}`, title: "Leg Locks: Enter the System", instructor: "John Danaher" },
  "straight foot lock": { url: `${BASE}/leg-locks-enter-the-system-by-john-danaher?aff=${AFF_CODE}`, title: "Leg Locks: Enter the System", instructor: "John Danaher" },
  "toe hold": { url: `${BASE}/leg-locks-enter-the-system-by-john-danaher?aff=${AFF_CODE}`, title: "Leg Locks: Enter the System", instructor: "John Danaher" },
  "saddle": { url: `${BASE}/leg-locks-enter-the-system-by-john-danaher?aff=${AFF_CODE}`, title: "Leg Locks: Enter the System", instructor: "John Danaher" },
  "ashi garami": { url: `${BASE}/leg-locks-enter-the-system-by-john-danaher?aff=${AFF_CODE}`, title: "Leg Locks: Enter the System", instructor: "John Danaher" },

  // Passing
  "guard passing": { url: `${BASE}/guard-passing-the-torreando-by-bernardo-faria?aff=${AFF_CODE}`, title: "Guard Passing: The Torreando", instructor: "Bernardo Faria" },
  "guard pass": { url: `${BASE}/guard-passing-the-torreando-by-bernardo-faria?aff=${AFF_CODE}`, title: "Guard Passing: The Torreando", instructor: "Bernardo Faria" },
  "torreando": { url: `${BASE}/guard-passing-the-torreando-by-bernardo-faria?aff=${AFF_CODE}`, title: "Guard Passing: The Torreando", instructor: "Bernardo Faria" },
  "leg drag": { url: `${BASE}/leg-drag-pass-by-marcelo-garcia?aff=${AFF_CODE}`, title: "Leg Drag Pass", instructor: "Marcelo Garcia" },
  "smash pass": { url: `${BASE}/guard-passing-the-torreando-by-bernardo-faria?aff=${AFF_CODE}`, title: "Guard Passing System", instructor: "Bernardo Faria" },
  "knee slice": { url: `${BASE}/knee-slice-passing-by-gordon-ryan?aff=${AFF_CODE}`, title: "Knee Slice Passing", instructor: "Gordon Ryan" },
  "stack pass": { url: `${BASE}/guard-passing-the-torreando-by-bernardo-faria?aff=${AFF_CODE}`, title: "Guard Passing System", instructor: "Bernardo Faria" },
  "pressure passing": { url: `${BASE}/guard-passing-the-torreando-by-bernardo-faria?aff=${AFF_CODE}`, title: "Pressure Passing", instructor: "Bernardo Faria" },

  // Back attacks
  "back control": { url: `${BASE}/back-attacks-enter-the-system-by-john-danaher?aff=${AFF_CODE}`, title: "Back Attacks: Enter the System", instructor: "John Danaher" },
  "back attack": { url: `${BASE}/back-attacks-enter-the-system-by-john-danaher?aff=${AFF_CODE}`, title: "Back Attacks: Enter the System", instructor: "John Danaher" },
  "body triangle": { url: `${BASE}/back-attacks-enter-the-system-by-john-danaher?aff=${AFF_CODE}`, title: "Back Attacks: Enter the System", instructor: "John Danaher" },
  "seat belt": { url: `${BASE}/back-attacks-enter-the-system-by-john-danaher?aff=${AFF_CODE}`, title: "Back Attacks: Enter the System", instructor: "John Danaher" },

  // Mount attacks
  "mount": { url: `${BASE}/mount-attacks-enter-the-system-by-john-danaher?aff=${AFF_CODE}`, title: "Mount Attacks: Enter the System", instructor: "John Danaher" },
  "s-mount": { url: `${BASE}/mount-attacks-enter-the-system-by-john-danaher?aff=${AFF_CODE}`, title: "Mount Attacks: Enter the System", instructor: "John Danaher" },
  "high mount": { url: `${BASE}/mount-attacks-enter-the-system-by-john-danaher?aff=${AFF_CODE}`, title: "Mount Attacks: Enter the System", instructor: "John Danaher" },

  // Takedowns
  "double leg": { url: `${BASE}/the-wrestling-system-by-gordon-ryan?aff=${AFF_CODE}`, title: "The Wrestling System", instructor: "Gordon Ryan" },
  "single leg": { url: `${BASE}/the-wrestling-system-by-gordon-ryan?aff=${AFF_CODE}`, title: "The Wrestling System", instructor: "Gordon Ryan" },
  "takedown": { url: `${BASE}/the-wrestling-system-by-gordon-ryan?aff=${AFF_CODE}`, title: "The Wrestling System", instructor: "Gordon Ryan" },
  "wrestling": { url: `${BASE}/the-wrestling-system-by-gordon-ryan?aff=${AFF_CODE}`, title: "The Wrestling System", instructor: "Gordon Ryan" },
  "front headlock": { url: `${BASE}/front-headlock-system-by-neil-melanson?aff=${AFF_CODE}`, title: "Front Headlock System", instructor: "Neil Melanson" },
  "bodylock": { url: `${BASE}/the-wrestling-system-by-gordon-ryan?aff=${AFF_CODE}`, title: "The Wrestling System", instructor: "Gordon Ryan" },

  // Sweeps
  "sweep": { url: `${BASE}/butterfly-guard-and-sweeps-by-adam-wardzinski?aff=${AFF_CODE}`, title: "Butterfly Guard & Sweeps", instructor: "Adam Wardzinski" },
  "hip bump": { url: `${BASE}/butterfly-guard-and-sweeps-by-adam-wardzinski?aff=${AFF_CODE}`, title: "Butterfly Guard & Sweeps", instructor: "Adam Wardzinski" },
  "scissor sweep": { url: `${BASE}/butterfly-guard-and-sweeps-by-adam-wardzinski?aff=${AFF_CODE}`, title: "Butterfly Guard & Sweeps", instructor: "Adam Wardzinski" },
  "flower sweep": { url: `${BASE}/butterfly-guard-and-sweeps-by-adam-wardzinski?aff=${AFF_CODE}`, title: "Butterfly Guard & Sweeps", instructor: "Adam Wardzinski" },

  // Escapes & Defense
  "escape": { url: `${BASE}/escape-from-everywhere-by-tom-deblass?aff=${AFF_CODE}`, title: "Escape From Everywhere", instructor: "Tom DeBlass" },
  "defense": { url: `${BASE}/defensive-guard-by-gordon-ryan?aff=${AFF_CODE}`, title: "Defensive Guard", instructor: "Gordon Ryan" },
  "mount escape": { url: `${BASE}/escape-from-everywhere-by-tom-deblass?aff=${AFF_CODE}`, title: "Escape From Everywhere", instructor: "Tom DeBlass" },
  "side control escape": { url: `${BASE}/escape-from-everywhere-by-tom-deblass?aff=${AFF_CODE}`, title: "Escape From Everywhere", instructor: "Tom DeBlass" },

  // Conditioning & Mindset
  "conditioning": { url: `${BASE}/bjj-strength-and-conditioning-by-tom-deblass?aff=${AFF_CODE}`, title: "BJJ Strength & Conditioning", instructor: "Tom DeBlass" },
  "strength training": { url: `${BASE}/bjj-strength-and-conditioning-by-tom-deblass?aff=${AFF_CODE}`, title: "BJJ Strength & Conditioning", instructor: "Tom DeBlass" },
  "competition": { url: `${BASE}/competition-preparation-by-gordon-ryan?aff=${AFF_CODE}`, title: "Competition Preparation", instructor: "Gordon Ryan" },

  // High-level instructors (as catch-all for their system)
  "gordon ryan": { url: `${BASE}/gordon-ryan-instructionals?aff=${AFF_CODE}`, title: "Gordon Ryan Complete System", instructor: "Gordon Ryan" },
  "marcelo garcia": { url: `${BASE}/marcelo-garcia-instructionals?aff=${AFF_CODE}`, title: "Marcelo Garcia System", instructor: "Marcelo Garcia" },
  "rickson": { url: `${BASE}/rickson-gracie-instructionals?aff=${AFF_CODE}`, title: "Rickson Gracie System", instructor: "Rickson Gracie" },
  "john danaher": { url: `${BASE}/danaher-fundamentals?aff=${AFF_CODE}`, title: "Fundamentals of BJJ", instructor: "John Danaher" },
  "craig jones": { url: `${BASE}/craig-jones-instructionals?aff=${AFF_CODE}`, title: "Craig Jones System", instructor: "Craig Jones" },
  "lachlan giles": { url: `${BASE}/lachlan-giles-instructionals?aff=${AFF_CODE}`, title: "Lachlan Giles System", instructor: "Lachlan Giles" },
  "bernardo faria": { url: `${BASE}/bernardo-faria-instructionals?aff=${AFF_CODE}`, title: "Bernardo Faria System", instructor: "Bernardo Faria" },
  "tom deblass": { url: `${BASE}/tom-deblass-instructionals?aff=${AFF_CODE}`, title: "Tom DeBlass System", instructor: "Tom DeBlass" },
};

// Legacy URL-only map derived from the info map for backward compatibility
const affiliateMap: Record<string, string> = Object.fromEntries(
  Object.entries(affiliateInfoMap).map(([k, v]) => [k, v.url])
);

/**
 * Get full affiliate info (url + title + instructor) for a technique
 * Returns null if no match found
 */
export function getAffiliateInfo(techniqueName: string): AffiliateInfo | null {
  if (!techniqueName || typeof techniqueName !== "string") return null;

  const lower = techniqueName.toLowerCase().trim();

  for (const [key, info] of Object.entries(affiliateInfoMap)) {
    if (lower === key) return info;
  }
  for (const [key, info] of Object.entries(affiliateInfoMap)) {
    if (lower.includes(key)) return info;
  }
  for (const [key, info] of Object.entries(affiliateInfoMap)) {
    if (key.includes(lower) && lower.length > 3) return info;
  }

  return null;
}

/**
 * Get affiliate link for a technique (backward compat)
 * @param techniqueName - The technique name to search for
 * @returns BJJ Fanatics URL with affiliate code, or null if not found
 */
export function getAffiliateLink(techniqueName: string): string | null {
  if (!techniqueName || typeof techniqueName !== "string") return null;

  const lower = techniqueName.toLowerCase().trim();

  for (const [key, url] of Object.entries(affiliateMap)) {
    if (lower === key) return url;
  }
  for (const [key, url] of Object.entries(affiliateMap)) {
    if (lower.includes(key)) return url;
  }
  for (const [key, url] of Object.entries(affiliateMap)) {
    if (key.includes(lower) && lower.length > 3) return url;
  }

  return null;
}
