export const PALETTE = Object.freeze({
  eyeBlack: 0x1b1b24,
  shirtWhite: 0xf3f1ea,
  darkTrousers: 0x2f3442,
  shoe: 0x3a2618,
  navySuit: 0x26355e,
  redTie: 0xc8323c,
  beigeTrenchCoat: 0xb8925a,
  brownHat: 0x5b3a22,
  hatBand: 0x2a1a10,
  yellowHelmet: 0xf2c12e,
  helmetShade: 0xd9a514,
  blueprintBlue: 0x3b6fd1,
  blueprintLight: 0xdfe9fb,
  orangeVest: 0xf47c20,
  vestStripe: 0xe8e8e0,
  lightWood: 0xb07d48,
  darkWood: 0x6e4a2c,
  woodTop: 0xc28d55,
  greyMetal: 0x8e96a3,
  darkMetal: 0x3c4250,
  monitorScreen: 0x5ad1e6,
  monitorFrame: 0x22262f,
  keyboard: 0xb9bec8,
  chairFabric: 0x4a5d7a,
  whiteboard: 0xf4f4f0,
  blueMarker: 0x2f6fdf,
  redMarker: 0xd94141,
  greenMarker: 0x2e9e5a,
  rackDark: 0x1f2430,
  rackDrawer: 0x2d3446,
  greenLed: 0x39ff88,
  amberLed: 0xffb02e,
  ocean: 0x2f7fd8,
  land: 0x4caf50,
  skyGlass: 0x9fd8f5,
  skyGlassLight: 0xc9ecfb,
  redPhone: 0xa8323a,
  terracotta: 0xb5562f,
  leafGreen: 0x3f9b4b,
  leafLight: 0x62bf5e,
  envelopePaper: 0xf7f3e8,
  envelopeFold: 0xd8d0bc,
  redSeal: 0xc0392b,
  greenSeal: 0x27ae60,
  crumpledPaper: 0xbfbfb5,
  brassRim: 0xc9a227,
  lensGlass: 0xbfe6ff,
  coffeeMachineBody: 0x2a2c33,
  darkCoffee: 0x4a2c17,
  mugWhite: 0xf3f1ea,
  coffeeMachineLight: 0xff3b30,
})

/**
 * Mixes two 0xRRGGBB colors.
 * @param {number} colorA
 * @param {number} colorB
 * @param {number} amountOfB 0 keeps colorA, 1 gives colorB.
 * @returns {number}
 * @example blend(0x000000, 0xffffff, 0.5) // 0x808080
 */
export function blend(colorA, colorB, amountOfB) {
  /** @param {number} shift */
  const channel = shift => {
    const a = (colorA >> shift) & 0xff
    const b = (colorB >> shift) & 0xff
    return Math.round(a * (1 - amountOfB) + b * amountOfB)
  }
  return (channel(16) << 16) | (channel(8) << 8) | channel(0)
}

/**
 * FNV-1a hash, used to give each agent a stable look from its id.
 * @param {string} text
 * @returns {number} Unsigned 32-bit hash.
 * @example hashString('agent-1') === hashString('agent-1') // true
 */
export function hashString(text) {
  let hash = 2166136261
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}
