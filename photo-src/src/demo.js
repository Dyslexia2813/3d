/* Furnished sample apartment (≈ 11.5 × 7.8 m) to show off the photoreal renderer. */
const EXT = '#3a4552', INT = '#8b96a3';
let n = 0;
const id = p => p + 'demo' + (n++);

const walls = [
  { id: 'wT', type: 'exterior', x1: 0, y1: 0, x2: 1150, y2: 0, thickness: 25, color: EXT },
  { id: 'wR', type: 'exterior', x1: 1150, y1: 0, x2: 1150, y2: 780, thickness: 25, color: EXT },
  { id: 'wB', type: 'exterior', x1: 1150, y1: 780, x2: 0, y2: 780, thickness: 25, color: EXT },
  { id: 'wL', type: 'exterior', x1: 0, y1: 780, x2: 0, y2: 0, thickness: 25, color: EXT },
  { id: 'wA', type: 'interior', x1: 0, y1: 480, x2: 1150, y2: 480, thickness: 10, color: INT },
  { id: 'wBk', type: 'interior', x1: 700, y1: 0, x2: 700, y2: 480, thickness: 10, color: INT },
  { id: 'wC', type: 'interior', x1: 320, y1: 480, x2: 320, y2: 780, thickness: 10, color: INT },
  { id: 'wD', type: 'interior', x1: 800, y1: 480, x2: 800, y2: 780, thickness: 10, color: INT }
];

const W = (wallId, kind, pos, width, height, sill, extra) => Object.assign({ id: id('o'), wallId, kind, pos, width, height, sill, color: kind === 'window' ? '#7fa8b8' : '#8a6d4f', hinge: 'left' }, extra || {});
const openings = [
  W('wT', 'window', 80, 260, 210, 30),
  W('wT', 'window', 430, 140, 150, 85),
  W('wT', 'doorsliding', 850, 160, 220, 0),
  W('wR', 'window', 560, 70, 60, 150),
  W('wB', 'doorswing', 540, 92, 210, 0, { finish: 'walnut' }),
  W('wB', 'window', 910, 160, 150, 85),
  W('wA', 'arch', 400, 120, 220, 0),
  W('wA', 'doorswing', 720, 80, 205, 0),
  W('wC', 'doorswing', 40, 80, 205, 0, { hinge: 'right' }),
  W('wD', 'doorswing', 40, 80, 205, 0)
];

const F = (key, x, y, rotation, extra) => Object.assign({ id: id('f'), key, x, y, rotation }, extra || {});
const furniture = [
  // living room
  F('dc_rug', 175, 240, 90),
  F('lv_tvstand', 34, 240, 270),
  F('lv_tv', 31, 240, 270, { z: 50 }),
  F('lv_sofa3', 300, 240, 90),
  F('lv_coffeer', 172, 240, 0),
  F('lv_lounge', 110, 400, 150),
  F('lv_side', 300, 100, 0),
  F('lt_table', 300, 100, 0, { z: 55 }),
  F('lt_floor', 335, 405, 0),
  F('dc_plant', 48, 52, 0),
  F('dc_curtain', 210, 22, 0, { w: 300 }),
  F('dc_tulle', 500, 20, 0, { w: 170 }),
  F('dc_books', 172, 240, 20, { z: 38 }),
  // dining
  F('dn_table6', 490, 240, 90),
  F('lt_pendant3', 490, 240, 90),
  F('dn_chair', 415, 180, 270), F('dn_chair', 415, 240, 270), F('dn_chair', 415, 300, 270),
  F('dn_chair', 565, 180, 90), F('dn_chair', 565, 240, 90), F('dn_chair', 565, 300, 90),
  F('dc_bowl', 490, 240, 90, { z: 75 }),
  F('dc_plantm', 640, 455, 0),
  // kitchen along the partition
  F('kf_fridge', 661, 50, 90),
  F('kf_oven', 665, 115, 90),
  F('kf_drawers', 665, 175, 90),
  F('kf_sink', 665, 245, 90),
  F('kf_dish', 665, 315, 90),
  F('kf_stove', 665, 375, 90),
  F('kf_cabinet', 665, 430, 90, { w: 50 }),
  F('kf_wallcab', 677, 175, 90), F('kf_wallcab', 677, 245, 90, { w: 80 }), F('kf_wallcab', 677, 315, 90),
  F('kf_wallopen', 680, 430, 90, { w: 50 }),
  F('kf_hood', 670, 375, 90),
  F('kf_coffee', 674, 170, 90),
  // bedroom
  F('dc_rug2', 1000, 250, 90, { w: 260, d: 200 }),
  F('bd_bed180', 1030, 250, 90),
  F('bd_night', 1117, 123, 90), F('bd_night', 1117, 377, 90),
  F('lt_table', 1117, 123, 90, { z: 50 }), F('lt_table', 1117, 377, 90, { z: 50 }),
  F('dc_art2', 1136, 250, 90, { z: 135 }),
  F('bd_slide', 736, 115, 270),
  F('bd_dresser', 729, 340, 270),
  F('dc_vase', 729, 310, 0, { z: 85 }),
  F('dc_curtain', 930, 22, 0, { w: 210, color: '#8f9c94' }),
  F('dc_snake', 1112, 455, 0),
  // bathroom
  F('fz_marble', 971, 626, 0, { w: 332, d: 282 }),
  F('bt_bath', 1052, 730, 180),
  F('bt_sink', 900, 509, 0),
  F('bt_mirror', 900, 487, 0),
  F('bt_washer', 985, 517, 0),
  F('bt_toiletw', 1110, 590, 90),
  F('bt_rail', 808, 690, 270),
  F('lt_spot', 970, 620, 0),
  // hallway
  F('dc_runner', 560, 640, 90),
  F('hw_wardrobe', 355, 685, 270),
  F('hw_mirror', 610, 486, 0),
  F('hw_bench', 610, 506, 0),
  F('hw_coat', 765, 735, 0),
  F('dc_plantm', 440, 735, 0),
  F('lt_spot', 560, 560, 0), F('lt_spot', 560, 700, 0),
  // study
  F('dc_rugr', 150, 640, 0),
  F('of_desk2', 160, 732, 180),
  F('of_monitor', 160, 742, 180, { z: 75 }),
  F('of_chair', 160, 680, 0),
  F('lv_bookcase', 297, 690, 90),
  F('of_shelf', 32, 600, 270),
  F('dc_snake', 40, 512, 0),
  F('lt_floor', 45, 740, 0),
  // balcony
  F('lv_rattan', 965, -62, 160),
  F('dc_plantm', 860, -70, 0)
];

const balconies = [{ id: 'b1', x: 930, y: -12.5, width: 240, depth: 110, rotation: -90, parapet: 105, color: '#9aa5b1' }];

export const DEMO_PROJECT = {
  app: 'ASP Studio', fileSchema: 1, variant: 'photo',
  project: {
    schema: 1, name: 'Пример: квартира 85 м²', ceilingHeight: 270,
    floor: 'oak', wallPaint: '#f1eee8', facade: '#e4e1dc', showCeiling: true, darkCaps: true,
    walls, openings, balconies, furniture
  }
};
