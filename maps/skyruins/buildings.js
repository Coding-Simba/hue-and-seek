// ============================================================================
// Celestia Sky-Ruins (Celestia) — Modular Handcrafted 3D Buildings & Landmarks Barrel
// ============================================================================

import { buildCrystalSanctuary } from './buildings/crystal_sanctuary.js?v=2';
import { buildRootConservatory } from './buildings/root_conservatory.js?v=2';
import { buildAirshipHangar } from './buildings/airship_hangar.js?v=2';
import { buildGolemWorkshop } from './buildings/golem_workshop.js?v=2';
import { buildWindBelltower } from './buildings/wind_belltower.js?v=2';
import {
  buildCrystalFountain,
  buildOrnithopterPier,
  buildSkyStall,
  buildRootBridge,
  buildUpdraftGeyser,
  buildOrbitingRunePlatform,
  buildFloatingIslet,
} from './buildings/landmarks.js?v=2';

export const BUILDING_DEFS = [
  { id: 'crystal_sanctuary', label: 'Ancient Tree-Crown Aether Observatory' },
  { id: 'root_conservatory', label: 'Botanical Sky-Orchid Conservatory' },
  { id: 'airship_hangar', label: 'Sky-Pirate Ornithopter Hangar' },
  { id: 'golem_workshop', label: 'Mossy Guardian Golem Ziggurat' },
  { id: 'wind_belltower', label: 'Temple of the Four Winds Colonnade' },
];

export {
  buildCrystalSanctuary,
  buildRootConservatory,
  buildAirshipHangar,
  buildGolemWorkshop,
  buildWindBelltower,
  buildCrystalFountain,
  buildOrnithopterPier,
  buildSkyStall,
  buildRootBridge,
  buildUpdraftGeyser,
  buildOrbitingRunePlatform,
  buildFloatingIslet,
};

export function buildBuildings(THREE) {
  const wrap = (fn) => (arg1, arg2) => {
    const isThree = arg1 && (arg1.Group || arg1.Scene || arg1.WebGLRenderer);
    return fn(THREE, isThree ? (arg2 || {}) : (arg1 || {}));
  };

  const crystalObelisk = wrap(buildCrystalFountain);
  const ornithopterPier = wrap(buildOrnithopterPier);
  const skyStall = wrap(buildSkyStall);
  const rootBridge = wrap(buildRootBridge);
  const updraftGeyser = wrap(buildUpdraftGeyser);
  const orbitingRunePlatform = wrap(buildOrbitingRunePlatform);
  const floatingIslet = wrap(buildFloatingIslet);

  return {
    crystal_sanctuary: wrap(buildCrystalSanctuary),
    root_conservatory: wrap(buildRootConservatory),
    airship_hangar: wrap(buildAirshipHangar),
    golem_workshop: wrap(buildGolemWorkshop),
    wind_belltower: wrap(buildWindBelltower),
    crystalObelisk,
    crystalFountain: crystalObelisk,
    ornithopterPier,
    skyStall,
    rootBridge,
    updraftGeyser,
    orbitingRunePlatform,
    floatingIslet,
    buildCenterpiece: crystalObelisk,
    buildStall: skyStall,
  };
}
