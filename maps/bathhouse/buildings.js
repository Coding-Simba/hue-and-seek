// ============================================================================
// Yu-Machi Spirit Bathhouse — Modular Handcrafted 3D Buildings & Landmarks Barrel
// Each building has its own dedicated hero_cottage.js / turret.js-grade module!
// ============================================================================

import { buildOnsenPavilion } from './buildings/onsen_pavilion.js?v=54';
import { buildRamenIzakaya } from './buildings/ramen_izakaya.js?v=54';
import { buildBoilerTower } from './buildings/boiler_tower.js?v=54';
import { buildKimonoTeahouse } from './buildings/kimono_teahouse.js?v=54';
import { buildShrineGatehouse } from './buildings/shrine_gatehouse.js?v=54';
import {
  buildDragonFountain,
  buildBellPavilion,
  buildSpiritStall,
  buildRedBridge,
  buildToriiGate,
  buildRotenburo,
  buildPulleyLift,
  buildStoneStaircase,
} from './buildings/landmarks.js?v=54';

export const BUILDING_DEFS = [
  { id: 'onsen_pavilion', label: 'Grand Vermilion Bathhouse Pavilion' },
  { id: 'ramen_izakaya', label: 'Spirit Ramen & Steamed-Bun Izakaya' },
  { id: 'boiler_tower', label: 'Old Herbal Boiler & Waterwheel Mill' },
  { id: 'kimono_teahouse', label: 'Wisteria & Silk Kimono Teahouse' },
  { id: 'shrine_gatehouse', label: 'Moonlit Taiko Shrine Gatehouse' },
];

export {
  buildOnsenPavilion,
  buildRamenIzakaya,
  buildBoilerTower,
  buildKimonoTeahouse,
  buildShrineGatehouse,
  buildDragonFountain,
  buildBellPavilion,
  buildSpiritStall,
  buildRedBridge,
  buildToriiGate,
  buildRotenburo,
  buildPulleyLift,
  buildStoneStaircase,
};

export function buildBuildings(THREE) {
  const wrap = (fn) => (arg1, arg2) => {
    const isThree = arg1 && (arg1.Group || arg1.Scene || arg1.WebGLRenderer);
    return fn(THREE, isThree ? (arg2 || {}) : (arg1 || {}));
  };
  const dragonFountain = wrap(buildDragonFountain);
  const bellPavilion = wrap(buildBellPavilion);
  const spiritStall = wrap(buildSpiritStall);
  const redBridge = wrap(buildRedBridge);
  const toriiGate = wrap(buildToriiGate);
  const rotenburo = wrap(buildRotenburo);
  const pulleyLift = wrap(buildPulleyLift);
  const stoneStaircase = wrap(buildStoneStaircase);

  return {
    onsen_pavilion: wrap(buildOnsenPavilion),
    ramen_izakaya: wrap(buildRamenIzakaya),
    boiler_tower: wrap(buildBoilerTower),
    kimono_teahouse: wrap(buildKimonoTeahouse),
    shrine_gatehouse: wrap(buildShrineGatehouse),
    dragonFountain,
    bellPavilion,
    spiritStall,
    redBridge,
    toriiGate,
    rotenburo,
    pulleyLift,
    stoneStaircase,
    buildCenterpiece: dragonFountain,
    buildStall: spiritStall,
  };
}
