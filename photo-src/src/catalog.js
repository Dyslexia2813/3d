/* =========================================================================
   Photoreal planner — furniture catalogue.
   Every model is parametric (built from code, scaled to the item's real
   width/depth/height), so any item can be resized in the properties panel.
   Convention: origin at floor centre of the item, front faces +Z, back -Z.
   ========================================================================= */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { finishMat, utilMat, colorMat, applyBoxUV, rugTexture, artTexture, floorMat, FINISHES } from './materials.js';

/* ---------------- finish groups ---------------- */
const UPH = ['fabric', 'velvet', 'boucle', 'leather'];
const WOOD = ['oak', 'oaklight', 'walnut', 'ash', 'oakgray', 'teak'];
const CASE = ['matte', 'gloss', 'oak', 'oaklight', 'walnut', 'ash', 'oakgray'];
const LEGS = ['oak', 'walnut', 'black', 'brass', 'chrome', 'steel'];
const HANDLES = ['black', 'brass', 'chrome', 'steel'];
const TOPS = ['marble', 'marblewarm', 'marbledark', 'concrete', 'oak', 'walnut', 'matte'];
const TABLETOP = ['oak', 'oaklight', 'walnut', 'ash', 'marble', 'marbledark', 'concrete', 'glass', 'matte'];
const METAL = ['black', 'brass', 'chrome', 'steel', 'matte'];
const SANIT = ['ceramic', 'matte'];
const BED = ['fabric', 'velvet', 'boucle', 'leather', 'oak', 'walnut', 'ash'];

export const CATEGORY_LABELS = {
  living: 'Гостиная', bedroom: 'Спальня', kitchen: 'Кухня', dining: 'Столовая', office: 'Кабинет',
  kids: 'Детская', hallway: 'Прихожая', bathroom: 'Ванная', light: 'Свет', decor: 'Декор', finish: 'Отделка'
};
export const CATEGORY_ORDER = ['living', 'bedroom', 'kitchen', 'dining', 'office', 'kids', 'hallway', 'bathroom', 'light', 'decor', 'finish'];

/* item definition fields:
   key, cat, label, w,d,h,z (cm), b (builder), o (builder options),
   finish + fin[] (main surface), frame + frm[] (legs / handles / frame), top + tops[] (countertop/tabletop),
   color (tint for tintable finishes), fl/rl/tl (slot labels) */
const C = [];
function add(cat, key, label, w, d, h, b, extra) { C.push(Object.assign({ key, cat, label, w, d, h, z: 0, b, o: {} }, extra || {})); }

/* ---- living ---- */
add('living', 'lv_sofa3', 'Диван 3-местный', 230, 95, 82, 'sofa', { finish: 'fabric', fin: UPH, color: '#b7ab98', frame: 'oak', frm: LEGS, o: { seats: 3 } });
add('living', 'lv_sofa2', 'Диван 2-местный', 175, 92, 80, 'sofa', { finish: 'velvet', fin: UPH, color: '#4f6b5c', frame: 'brass', frm: LEGS, o: { seats: 2, legStyle: 'round' } });
add('living', 'lv_corner', 'Диван угловой', 280, 170, 82, 'sofa', { finish: 'fabric', fin: UPH, color: '#8c8f8d', frame: 'black', frm: LEGS, o: { corner: true, seats: 3 } });
add('living', 'lv_modular', 'Диван модульный низкий', 260, 105, 70, 'sofa', { finish: 'boucle', fin: UPH, color: '#ece6da', frame: 'oak', frm: LEGS, o: { seats: 3, legH: 3, armW: 26, soft: true } });
add('living', 'lv_chester', 'Диван кожаный', 210, 92, 78, 'sofa', { finish: 'leather', fin: UPH, color: '#7a4a2c', frame: 'walnut', frm: LEGS, o: { seats: 2, legStyle: 'round' } });
add('living', 'lv_arm', 'Кресло', 85, 85, 82, 'sofa', { finish: 'fabric', fin: UPH, color: '#c4a77d', frame: 'oak', frm: LEGS, o: { seats: 1, armW: 16, legStyle: 'round' } });
add('living', 'lv_lounge', 'Кресло лаунж', 78, 84, 78, 'lounge', { finish: 'boucle', fin: UPH, color: '#efe9de', frame: 'oak', frm: WOOD.concat(['black']), rl: 'Каркас' });
add('living', 'lv_rattan', 'Кресло ротанг', 72, 75, 80, 'lounge', { finish: 'fabric', fin: UPH, color: '#e7ddcc', frame: 'rattan', frm: ['rattan', 'oak', 'black'], rl: 'Каркас', o: { rattan: true } });
add('living', 'lv_pouf', 'Пуф', 55, 55, 42, 'pouf', { finish: 'boucle', fin: UPH, color: '#d8cbb6' });
add('living', 'lv_ottoman', 'Банкетка', 110, 45, 45, 'bench', { finish: 'velvet', fin: UPH, color: '#7b5e4d', frame: 'brass', frm: LEGS, o: { uph: true } });
add('living', 'lv_coffee', 'Журнальный стол', 110, 60, 40, 'table', { top: 'oak', tops: TABLETOP, frame: 'black', frm: LEGS, o: { legs: 'four', topT: 3, shelf: true } });
add('living', 'lv_coffeer', 'Журнальный стол круглый', 85, 85, 38, 'table', { top: 'marble', tops: TABLETOP, frame: 'brass', frm: LEGS, o: { shape: 'round', legs: 'pedestal', topT: 2.5 } });
add('living', 'lv_side', 'Приставной столик', 45, 45, 55, 'table', { top: 'marbledark', tops: TABLETOP, frame: 'black', frm: LEGS, o: { shape: 'round', legs: 'tripod', topT: 2 } });
add('living', 'lv_tvstand', 'ТВ-тумба', 180, 42, 50, 'case', { finish: 'oak', fin: CASE, color: '#efede8', frame: 'black', frm: LEGS, rl: 'Ножки', o: { legs: 12, fronts: 'doors', n: 3, handle: 'none', slats: true } });
add('living', 'lv_tv', 'Телевизор 65"', 146, 26, 92, 'tv', { o: { stand: true } });
add('living', 'lv_tvwall', 'Телевизор на стене', 146, 5, 84, 'tv', { z: 95 });
add('living', 'lv_bookcase', 'Стеллаж с книгами', 100, 35, 200, 'shelf', { finish: 'oak', fin: CASE, color: '#f1efe9', o: { shelves: 5, books: true } });
add('living', 'lv_shelfwall', 'Полка настенная', 120, 24, 4, 'wallshelf', { z: 140, finish: 'oak', fin: CASE, color: '#f1efe9' });
add('living', 'lv_sideboard', 'Комод-буфет', 160, 45, 80, 'case', { finish: 'walnut', fin: CASE, color: '#2f3a3d', frame: 'black', frm: LEGS, rl: 'Ножки', o: { legs: 18, fronts: 'doors', n: 3, handle: 'none', slats: true } });
add('living', 'lv_fireplace', 'Биокамин', 120, 35, 100, 'fireplace', { finish: 'marble', fin: ['marble', 'marblewarm', 'marbledark', 'concrete', 'matte'], color: '#eae6de' });

/* ---- bedroom ---- */
add('bedroom', 'bd_bed160', 'Кровать 160×200', 170, 215, 110, 'bed', { finish: 'fabric', fin: BED, color: '#b9ae9e', frame: 'oak', frm: LEGS, rl: 'Ножки' });
add('bedroom', 'bd_bed180', 'Кровать 180×200', 190, 215, 120, 'bed', { finish: 'velvet', fin: BED, color: '#5a6a72', frame: 'brass', frm: LEGS, rl: 'Ножки', o: { tall: true } });
add('bedroom', 'bd_bedwood', 'Кровать деревянная', 172, 212, 95, 'bed', { finish: 'oak', fin: BED, color: '#c19a6b', frame: 'oak', frm: LEGS, rl: 'Ножки', o: { duvet: '#e8e2d6', throw: '#8c9a86' } });
add('bedroom', 'bd_bed90', 'Кровать односпальная', 100, 210, 90, 'bed', { finish: 'ash', fin: BED, color: '#e6dccd', frame: 'ash', frm: LEGS, rl: 'Ножки' });
add('bedroom', 'bd_night', 'Прикроватная тумба', 50, 40, 50, 'case', { finish: 'oak', fin: CASE, color: '#efede8', frame: 'brass', frm: LEGS, rl: 'Ножки/ручки', o: { legs: 14, fronts: 'drawers', rows: 2, handle: 'knob' } });
add('bedroom', 'bd_dresser', 'Комод', 120, 48, 85, 'case', { finish: 'matte', fin: CASE, color: '#d9d2c5', frame: 'brass', frm: HANDLES, rl: 'Ручки', o: { plinth: 6, fronts: 'drawers', rows: 4, cols: 2, handle: 'bar' } });
add('bedroom', 'bd_wardrobe', 'Шкаф распашной', 160, 60, 230, 'case', { finish: 'matte', fin: CASE, color: '#e9e5dc', frame: 'black', frm: HANDLES, rl: 'Ручки', o: { plinth: 6, fronts: 'doors', handle: 'long' } });
add('bedroom', 'bd_slide', 'Шкаф-купе с зеркалом', 200, 62, 240, 'slider', { finish: 'oakgray', fin: CASE, color: '#e9e5dc' });
add('bedroom', 'bd_vanity', 'Туалетный столик', 100, 45, 76, 'desk', { finish: 'ash', fin: CASE, color: '#f1efe9', frame: 'brass', frm: LEGS, o: { drawer: true, mirror: true } });
add('bedroom', 'bd_mirror', 'Зеркало напольное', 60, 6, 180, 'mirror', { finish: 'brass', fin: METAL.concat(WOOD), rl: 'Рама', o: { floor: true } });
add('bedroom', 'bd_bench', 'Банкетка у кровати', 140, 42, 46, 'bench', { finish: 'boucle', fin: UPH, color: '#e8dfd1', frame: 'oak', frm: LEGS, o: { uph: true } });

/* ---- kitchen ---- */
add('kitchen', 'kf_cabinet', 'Шкаф напольный', 60, 60, 90, 'case', { finish: 'matte', fin: CASE, color: '#dfe2dc', frame: 'black', frm: HANDLES, top: 'marble', tops: TOPS, rl: 'Ручки', o: { plinth: 10, counter: true, fronts: 'doors', handle: 'bar' } });
add('kitchen', 'kf_drawers', 'Тумба с ящиками', 60, 60, 90, 'case', { finish: 'matte', fin: CASE, color: '#dfe2dc', frame: 'black', frm: HANDLES, top: 'marble', tops: TOPS, rl: 'Ручки', o: { plinth: 10, counter: true, fronts: 'drawers', rows: 3, handle: 'bar' } });
add('kitchen', 'kf_wallcab', 'Шкаф подвесной', 60, 35, 72, 'case', { z: 145, finish: 'matte', fin: CASE, color: '#dfe2dc', frame: 'black', frm: HANDLES, rl: 'Ручки', o: { fronts: 'doors', handle: 'bar', handleBottom: true } });
add('kitchen', 'kf_wallopen', 'Полка открытая', 80, 30, 72, 'shelf', { z: 145, finish: 'oak', fin: CASE, color: '#dfe2dc', o: { shelves: 2, decor: true, noBack: false } });
add('kitchen', 'kf_tall', 'Пенал-колонна', 60, 60, 220, 'case', { finish: 'matte', fin: CASE, color: '#dfe2dc', frame: 'black', frm: HANDLES, rl: 'Ручки', o: { plinth: 10, fronts: 'tall', handle: 'bar' } });
add('kitchen', 'kf_oven', 'Колонна с духовкой', 60, 60, 220, 'case', { finish: 'matte', fin: CASE, color: '#dfe2dc', frame: 'black', frm: HANDLES, rl: 'Ручки', o: { plinth: 10, fronts: 'oven', handle: 'bar' } });
add('kitchen', 'kf_sink', 'Мойка с тумбой', 80, 60, 90, 'sinkunit', { finish: 'matte', fin: CASE, color: '#dfe2dc', frame: 'black', frm: HANDLES.concat([]), top: 'marble', tops: TOPS, rl: 'Ручки и смеситель' });
add('kitchen', 'kf_stove', 'Плита с духовкой', 60, 60, 90, 'stove', { finish: 'matte', fin: CASE, color: '#dfe2dc', frame: 'steel', frm: HANDLES, top: 'marble', tops: TOPS, rl: 'Ручки' });
add('kitchen', 'kf_hood', 'Вытяжка', 60, 50, 90, 'hood', { z: 160, finish: 'steel', fin: ['steel', 'black', 'matte'], color: '#e8e8e6' });
add('kitchen', 'kf_fridge', 'Холодильник', 70, 68, 200, 'fridge', { finish: 'steel', fin: ['steel', 'matte', 'gloss', 'black'], color: '#eceeed', frame: 'steel', frm: HANDLES });
add('kitchen', 'kf_fridge2', 'Холодильник Side-by-Side', 91, 72, 178, 'fridge', { finish: 'steel', fin: ['steel', 'matte', 'gloss', 'black'], color: '#eceeed', frame: 'steel', frm: HANDLES, o: { sbs: true } });
add('kitchen', 'kf_dish', 'Посудомоечная машина', 60, 60, 90, 'case', { finish: 'matte', fin: CASE, color: '#dfe2dc', frame: 'black', frm: HANDLES, top: 'marble', tops: TOPS, rl: 'Ручки', o: { plinth: 10, counter: true, fronts: 'single', handle: 'bar' } });
add('kitchen', 'kf_island', 'Кухонный остров', 200, 95, 92, 'island', { finish: 'walnut', fin: CASE, color: '#2f3a3d', top: 'marble', tops: TOPS });
add('kitchen', 'kf_micro', 'Микроволновка', 50, 38, 30, 'micro', { z: 90 });
add('kitchen', 'kf_coffee', 'Кофемашина', 26, 40, 36, 'coffee', { z: 90 });
add('kitchen', 'kf_barstool', 'Барный стул', 42, 42, 98, 'chair', { finish: 'leather', fin: UPH.concat(WOOD), color: '#6a4a33', frame: 'black', frm: METAL, o: { style: 'bar' } });
add('kitchen', 'kf_table', 'Стол кухонный', 120, 80, 75, 'table', { top: 'oak', tops: TABLETOP, frame: 'oak', frm: LEGS, o: { legs: 'four' } });
add('kitchen', 'kf_chair', 'Стул', 45, 50, 82, 'chair', { finish: 'oak', fin: WOOD.concat(['matte']), color: '#3b3b3b', frame: 'oak', frm: LEGS, o: { style: 'wood' } });

/* ---- dining ---- */
add('dining', 'dn_table6', 'Стол обеденный на 6', 200, 95, 75, 'table', { top: 'oak', tops: TABLETOP, frame: 'black', frm: LEGS, o: { legs: 'sled', topT: 4 } });
add('dining', 'dn_round', 'Стол круглый', 120, 120, 75, 'table', { top: 'oaklight', tops: TABLETOP, frame: 'oaklight', frm: LEGS, o: { shape: 'round', legs: 'pedestal' } });
add('dining', 'dn_oval', 'Стол овальный', 180, 100, 75, 'table', { top: 'marble', tops: TABLETOP, frame: 'walnut', frm: LEGS, o: { shape: 'round', legs: 'twin' } });
add('dining', 'dn_chair', 'Стул мягкий', 50, 55, 85, 'chair', { finish: 'velvet', fin: UPH, color: '#8a6a4f', frame: 'black', frm: LEGS, o: { style: 'uph' } });
add('dining', 'dn_chairw', 'Стул деревянный', 46, 50, 80, 'chair', { finish: 'walnut', fin: WOOD.concat(['matte']), color: '#333', frame: 'walnut', frm: LEGS, o: { style: 'wood' } });
add('dining', 'dn_armchair', 'Полукресло', 56, 55, 78, 'chair', { finish: 'boucle', fin: UPH, color: '#e6ddd0', frame: 'oak', frm: LEGS, o: { style: 'tub' } });
add('dining', 'dn_buffet', 'Буфет', 180, 45, 85, 'case', { finish: 'oak', fin: CASE, color: '#2f3a3d', frame: 'brass', frm: LEGS, rl: 'Ножки', o: { legs: 16, fronts: 'doors', n: 4, handle: 'none', slats: true } });
add('dining', 'dn_vitrine', 'Витрина', 90, 42, 190, 'vitrine', { finish: 'walnut', fin: CASE, color: '#2f3a3d', frame: 'brass', frm: LEGS });

/* ---- office ---- */
add('office', 'of_desk', 'Письменный стол', 140, 70, 75, 'desk', { finish: 'oak', fin: CASE, color: '#f1efe9', frame: 'black', frm: LEGS, o: { drawer: false, metal: true } });
add('office', 'of_desk2', 'Стол с тумбой', 150, 70, 75, 'desk', { finish: 'walnut', fin: CASE, color: '#f1efe9', frame: 'black', frm: LEGS, o: { pedestal: true } });
add('office', 'of_chair', 'Кресло офисное', 62, 62, 110, 'officechair', { finish: 'fabric', fin: UPH, color: '#3a3d42', frame: 'black', frm: ['black', 'chrome', 'steel'] });
add('office', 'of_monitor', 'Монитор', 62, 20, 50, 'monitor', { z: 75 });
add('office', 'of_laptop', 'Ноутбук', 34, 24, 22, 'laptop', { z: 75 });
add('office', 'of_shelf', 'Стеллаж открытый', 80, 38, 180, 'shelf', { finish: 'black', fin: ['black', 'oak', 'walnut', 'matte'], color: '#f1efe9', o: { shelves: 5, books: true, frameOnly: true } });
add('office', 'of_cabinet', 'Тумба для документов', 45, 55, 62, 'case', { finish: 'matte', fin: CASE, color: '#f1efe9', frame: 'black', frm: HANDLES, rl: 'Ручки', o: { plinth: 4, fronts: 'drawers', rows: 3, handle: 'bar' } });

/* ---- kids ---- */
add('kids', 'kd_bed', 'Детская кровать', 96, 196, 80, 'kidbed', { finish: 'ash', fin: WOOD.concat(['matte']), color: '#f2efe9' });
add('kids', 'kd_bunk', 'Двухъярусная кровать', 100, 205, 170, 'bunk', { finish: 'oaklight', fin: WOOD.concat(['matte']), color: '#f2efe9' });
add('kids', 'kd_desk', 'Детский стол', 100, 60, 64, 'desk', { finish: 'matte', fin: CASE, color: '#f4f1ea', frame: 'oaklight', frm: LEGS, o: { drawer: true } });
add('kids', 'kd_chair', 'Детский стул', 36, 38, 62, 'chair', { finish: 'matte', fin: WOOD.concat(['matte']), color: '#a7c4c9', frame: 'oaklight', frm: LEGS, o: { style: 'wood', seatH: 34 } });
add('kids', 'kd_toy', 'Ящик для игрушек', 70, 40, 45, 'case', { finish: 'matte', fin: CASE, color: '#e8c9a8', frame: 'oaklight', frm: LEGS, rl: 'Ножки', o: { legs: 5, fronts: 'single', handle: 'cutout' } });
add('kids', 'kd_teepee', 'Вигвам', 120, 120, 160, 'teepee', { finish: 'fabric', fin: ['fabric'], color: '#f0e8da' });
add('kids', 'kd_wardrobe', 'Шкаф детский', 100, 52, 180, 'case', { finish: 'matte', fin: CASE, color: '#cfe0df', frame: 'oaklight', frm: LEGS, rl: 'Ножки/ручки', o: { legs: 10, fronts: 'doors', n: 2, handle: 'knob' } });
add('kids', 'kd_rug', 'Детский ковёр', 150, 150, 1, 'rug', { o: { pattern: 'round', round: true, a: '#e9ddc7', b: '#9db7b2' } });

/* ---- hallway ---- */
add('hallway', 'hw_wardrobe', 'Шкаф-купе', 150, 60, 230, 'slider', { finish: 'oak', fin: CASE, color: '#8a7256' });
add('hallway', 'hw_shoe', 'Обувница', 90, 32, 100, 'case', { finish: 'matte', fin: CASE, color: '#eeebe4', frame: 'black', frm: HANDLES, rl: 'Ручки', o: { plinth: 4, fronts: 'doors', n: 2, handle: 'edge' } });
add('hallway', 'hw_bench', 'Скамья', 100, 38, 46, 'bench', { finish: 'oak', fin: WOOD.concat(UPH), color: '#8a6d4f', frame: 'black', frm: LEGS });
add('hallway', 'hw_coat', 'Вешалка напольная', 50, 50, 178, 'coatstand', { finish: 'oak', fin: WOOD.concat(['black', 'brass']) });
add('hallway', 'hw_hooks', 'Вешалка настенная', 90, 10, 30, 'hooks', { z: 150, finish: 'oak', fin: WOOD.concat(['black']) });
add('hallway', 'hw_mirror', 'Зеркало настенное', 70, 4, 100, 'mirror', { z: 85, finish: 'black', fin: METAL.concat(WOOD), rl: 'Рама' });
add('hallway', 'hw_console', 'Консоль', 110, 35, 80, 'table', { top: 'walnut', tops: TABLETOP, frame: 'brass', frm: LEGS, o: { legs: 'four', topT: 3, thin: true } });

/* ---- bathroom ---- */
add('bathroom', 'bt_bath', 'Ванна встраиваемая', 170, 75, 58, 'bath', { finish: 'ceramic', fin: SANIT, color: '#f7f7f5' });
add('bathroom', 'bt_freebath', 'Ванна отдельностоящая', 170, 80, 60, 'freebath', { finish: 'ceramic', fin: SANIT, color: '#f7f7f5', frame: 'chrome', frm: METAL, rl: 'Смеситель' });
add('bathroom', 'bt_shower', 'Душевая кабина', 90, 90, 200, 'shower', { frame: 'chrome', frm: METAL, rl: 'Профиль' });
add('bathroom', 'bt_walkin', 'Душ walk-in', 120, 90, 200, 'shower', { frame: 'black', frm: METAL, rl: 'Профиль', o: { walkin: true } });
add('bathroom', 'bt_toilet', 'Унитаз', 38, 62, 80, 'toilet', { finish: 'ceramic', fin: SANIT, color: '#f7f7f5' });
add('bathroom', 'bt_toiletw', 'Унитаз подвесной', 37, 54, 100, 'toilet', { finish: 'ceramic', fin: SANIT, color: '#f7f7f5', o: { wall: true } });
add('bathroom', 'bt_sink', 'Раковина с тумбой', 80, 48, 85, 'vanity', { finish: 'oak', fin: CASE, color: '#f1efe9', frame: 'chrome', frm: METAL, rl: 'Смеситель', top: 'marble', tops: TOPS });
add('bathroom', 'bt_sinkw', 'Раковина подвесная', 60, 45, 85, 'washbasin', { finish: 'ceramic', fin: SANIT, color: '#f7f7f5', frame: 'chrome', frm: METAL, rl: 'Смеситель' });
add('bathroom', 'bt_washer', 'Стиральная машина', 60, 60, 85, 'washer', { finish: 'matte', fin: ['matte', 'black', 'steel'], color: '#f3f4f4' });
add('bathroom', 'bt_mirror', 'Зеркало с подсветкой', 80, 4, 70, 'mirror', { z: 110, finish: 'black', fin: METAL, rl: 'Рама', o: { glow: true, round: false } });
add('bathroom', 'bt_mirrorr', 'Зеркало круглое', 70, 4, 70, 'mirror', { z: 110, finish: 'brass', fin: METAL.concat(WOOD), rl: 'Рама', o: { round: true } });
add('bathroom', 'bt_rail', 'Полотенцесушитель', 50, 10, 80, 'towelrail', { z: 60, frame: 'chrome', frm: METAL, rl: 'Металл' });
add('bathroom', 'bt_cab', 'Шкафчик навесной', 60, 18, 70, 'case', { z: 120, finish: 'matte', fin: CASE, color: '#f1efe9', frame: 'chrome', frm: HANDLES, rl: 'Ручки', o: { fronts: 'doors', handle: 'none', mirrorDoors: true } });

/* ---- lighting ---- */
add('light', 'lt_floor', 'Торшер', 45, 45, 165, 'floorlamp', { frame: 'brass', frm: METAL });
add('light', 'lt_arc', 'Торшер-дуга', 120, 40, 200, 'arclamp', { frame: 'chrome', frm: METAL });
add('light', 'lt_table', 'Настольная лампа', 30, 30, 50, 'tablelamp', { z: 50, finish: 'ceramic', fin: ['ceramic', 'brass', 'black', 'concrete'], color: '#d9c6a6' });
add('light', 'lt_pendant', 'Подвесной светильник', 45, 45, 35, 'pendant', { z: 180, finish: 'black', fin: METAL.concat(['ceramic']), color: '#efe9de' });
add('light', 'lt_pendant3', 'Подвесы над столом (3)', 150, 30, 30, 'pendant', { z: 175, finish: 'brass', fin: METAL.concat(['ceramic']), color: '#efe9de', o: { count: 3, globe: true } });
add('light', 'lt_chand', 'Люстра', 80, 80, 50, 'chandelier', { z: 200, frame: 'brass', frm: METAL });
add('light', 'lt_sconce', 'Бра', 20, 18, 25, 'sconce', { z: 170, frame: 'brass', frm: METAL });
add('light', 'lt_spot', 'Точечный светильник', 10, 10, 2, 'spot', { z: 268 });

/* ---- decor ---- */
add('decor', 'dc_plant', 'Растение большое', 70, 70, 170, 'plant', { o: { type: 'tree' } });
add('decor', 'dc_plantm', 'Растение в кашпо', 50, 50, 90, 'plant', { o: { type: 'bush' } });
add('decor', 'dc_snake', 'Сансевиерия', 30, 30, 70, 'plant', { o: { type: 'snake' } });
add('decor', 'dc_plants', 'Цветок настольный', 20, 20, 30, 'plant', { z: 75, o: { type: 'small' } });
add('decor', 'dc_rug', 'Ковёр прямоугольный', 240, 170, 1, 'rug', { o: { pattern: 'border', a: '#d8cfc0', b: '#8b7f6e' } });
add('decor', 'dc_rug2', 'Ковёр с орнаментом', 200, 140, 1, 'rug', { o: { pattern: 'geo', a: '#ece6da', b: '#3c3c3c' } });
add('decor', 'dc_rugr', 'Ковёр круглый', 160, 160, 1, 'rug', { o: { pattern: 'round', round: true, a: '#e4d9c6', b: '#9c7b5b' } });
add('decor', 'dc_rugab', 'Ковёр абстрактный', 230, 160, 1, 'rug', { o: { pattern: 'abstract', a: '#e8e1d5', b: '#c9b9a2' } });
add('decor', 'dc_runner', 'Дорожка', 80, 220, 1, 'rug', { o: { pattern: 'stripes', a: '#d9d2c6', b: '#9a8f80' } });
add('decor', 'dc_art', 'Картина абстракция', 90, 4, 120, 'art', { z: 110, frame: 'oak', frm: ['oak', 'walnut', 'black', 'brass', 'matte'], rl: 'Рама', o: { style: 'abstract' } });
add('decor', 'dc_art2', 'Картина пейзаж', 120, 4, 80, 'art', { z: 120, frame: 'black', frm: ['oak', 'walnut', 'black', 'brass', 'matte'], rl: 'Рама', o: { style: 'landscape' } });
add('decor', 'dc_art3', 'Постер в раме', 50, 3, 70, 'art', { z: 130, frame: 'black', frm: ['oak', 'walnut', 'black', 'brass', 'matte'], rl: 'Рама', o: { style: 'lines' } });
add('decor', 'dc_curtain', 'Шторы', 200, 14, 265, 'curtains', { finish: 'velvet', fin: ['fabric', 'velvet', 'linen'], color: '#b7a58c', o: {} });
add('decor', 'dc_tulle', 'Тюль', 200, 8, 265, 'curtains', { o: { sheerOnly: true } });
add('decor', 'dc_vase', 'Ваза с ветками', 25, 25, 90, 'vase', { finish: 'ceramic', fin: ['ceramic', 'glass', 'concrete', 'black'], color: '#cdbca3' });
add('decor', 'dc_books', 'Стопка книг', 30, 22, 14, 'bookstack', { z: 40 });
add('decor', 'dc_bowl', 'Декор: чаша и свечи', 40, 25, 15, 'decorset', { z: 75 });

/* ---- finishes / engineering ---- */
add('finish', 'fz_tile', 'Пол: плитка (зона)', 200, 200, 1, 'floorzone', { o: { floor: 'tile60' } });
add('finish', 'fz_marble', 'Пол: мрамор (зона)', 200, 200, 1, 'floorzone', { o: { floor: 'marble' } });
add('finish', 'fz_mosaic', 'Пол: мозаика (зона)', 180, 180, 1, 'floorzone', { o: { floor: 'mosaic' } });
add('finish', 'fz_dark', 'Пол: тёмная плитка (зона)', 180, 180, 1, 'floorzone', { o: { floor: 'hexdark' } });
add('finish', 'fz_wood', 'Пол: паркет орех (зона)', 300, 300, 1, 'floorzone', { o: { floor: 'walnut' } });
add('finish', 'fz_wall', 'Стеновая панель (плитка)', 200, 2, 260, 'wallpanel', { o: { floor: 'tile60' } });
add('finish', 'fz_wallm', 'Стеновая панель (мрамор)', 200, 2, 260, 'wallpanel', { o: { floor: 'marble' } });
add('finish', 'fz_slats', 'Рейки на стену', 200, 3, 260, 'slats', { finish: 'oak', fin: WOOD.concat(['black', 'matte']), color: '#2f3a3d' });
add('finish', 'fz_radiator', 'Радиатор', 80, 10, 55, 'radiator', { z: 12 });
add('finish', 'fz_ac', 'Кондиционер', 85, 25, 30, 'aircon', { z: 225 });

/* ---- legacy keys (projects saved in the classic planner) ---- */
const LEGACY = {
  rm_shelf:  ['living', 'Стеллаж', 'shelf', { finish: 'oak', fin: CASE, color: '#a9835a', o: { shelves: 5, books: true } }],
  rm_sofa:   ['living', 'Диван', 'sofa', { finish: 'fabric', fin: UPH, color: '#5c7c8a', frame: 'oak', frm: LEGS, o: { seats: 3 } }],
  rm_table:  ['living', 'Стол', 'table', { top: 'oak', tops: TABLETOP, frame: 'oak', frm: LEGS, o: { legs: 'four' } }],
  rm_chair:  ['living', 'Кресло', 'sofa', { finish: 'fabric', fin: UPH, color: '#5c7c8a', frame: 'oak', frm: LEGS, o: { seats: 1, armW: 16 } }],
  hw_bench:  null, bt_toilet: null, bt_shower: null, bt_washer: null, bt_sink: null, bt_bath: null,
  kf_table: null, kf_chair: null, kf_fridge: null, kf_sink: null, kf_cabinet: null, kf_wallcab: null, kf_stove: null, hw_wardrobe: null
};

export const FURNITURE_CATALOG = C;
export const FURNITURE_BY_KEY = {};
C.forEach(f => FURNITURE_BY_KEY[f.key] = f);
Object.keys(LEGACY).forEach(k => {
  if (FURNITURE_BY_KEY[k] || !LEGACY[k]) return;
  const [cat, label, b, extra] = LEGACY[k];
  FURNITURE_BY_KEY[k] = Object.assign({ key: k, cat, label, w: 100, d: 50, h: 80, z: 0, b, o: {}, hidden: true }, extra);
});

/** colour used for the item in the 2D plan */
export function planColor(item) {
  const def = FURNITURE_BY_KEY[item.key] || {};
  const fin = item.finish || def.finish;
  if (fin && FINISHES[fin] && !FINISHES[fin].tint) return FINISHES[fin].swatch || item.color;
  if (fin) return item.color;
  if (def.b === 'rug') return (def.o && def.o.a) || '#d8cfc0';
  if (def.b === 'floorzone' || def.b === 'wallpanel') return '#e3ded6';
  if (def.b === 'plant') return '#6f9160';
  const top = item.top || def.top;
  if (top && FINISHES[top]) return FINISHES[top].swatch || item.color || '#c9b49a';
  return item.color || '#c9b49a';
}

/* =========================================================================
   geometry helpers
   ========================================================================= */
function finalize(m, keepUV) {
  if (!keepUV) applyBoxUV(m.geometry);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}
function B(g, w, h, d, mat, x, y, z) {
  const m = finalize(new THREE.Mesh(new THREE.BoxGeometry(Math.max(0.2, w), Math.max(0.2, h), Math.max(0.2, d)), mat));
  m.position.set(x || 0, y || 0, z || 0); g.add(m); return m;
}
function R(g, w, h, d, r, mat, x, y, z, seg) {
  w = Math.max(0.4, w); h = Math.max(0.4, h); d = Math.max(0.4, d);
  r = Math.min(r, Math.min(w, h, d) / 2 - 0.05);
  if (r <= 0.1) return B(g, w, h, d, mat, x, y, z);
  const m = finalize(new THREE.Mesh(new RoundedBoxGeometry(w, h, d, seg || 3, r), mat));
  m.position.set(x || 0, y || 0, z || 0); g.add(m); return m;
}
function Cy(g, rt, rb, h, mat, x, y, z, seg, open) {
  const m = finalize(new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, Math.max(0.2, h), seg || 24, 1, !!open), mat));
  m.position.set(x || 0, y || 0, z || 0); g.add(m); return m;
}
function Sp(g, r, mat, x, y, z, sx, sy, sz) {
  const m = finalize(new THREE.Mesh(new THREE.SphereGeometry(r, 24, 16), mat));
  m.position.set(x || 0, y || 0, z || 0); m.scale.set(sx || 1, sy || 1, sz || 1); g.add(m); return m;
}
function La(g, pts, mat, x, y, z, seg) {
  const m = finalize(new THREE.Mesh(new THREE.LatheGeometry(pts.map(p => new THREE.Vector2(p[0], p[1])), seg || 48), mat));
  m.position.set(x || 0, y || 0, z || 0); g.add(m); return m;
}
function Tu(g, pts, r, mat, seg) {
  const curve = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(p[0], p[1], p[2])));
  const m = finalize(new THREE.Mesh(new THREE.TubeGeometry(curve, seg || 32, r, 12, false), mat));
  g.add(m); return m;
}
function To(g, R0, r, mat, x, y, z, rx) {
  const m = finalize(new THREE.Mesh(new THREE.TorusGeometry(R0, r, 12, 48), mat));
  m.position.set(x || 0, y || 0, z || 0); if (rx !== undefined) m.rotation.x = rx; g.add(m); return m;
}
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/** four legs in the corners of a spanW×spanD rectangle */
function legs(g, spanW, spanD, h, mat, style, y0) {
  y0 = y0 || 0;
  [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([sx, sz]) => {
    const x = sx * spanW / 2, z = sz * spanD / 2;
    if (style === 'round') Cy(g, 1.8, 1.2, h, mat, x, y0 + h / 2, z, 16);
    else if (style === 'metal') Cy(g, 0.9, 0.9, h, mat, x, y0 + h / 2, z, 12);
    else if (style === 'tapered') { const m = Cy(g, 2.2, 1.3, h, mat, x, y0 + h / 2, z, 16); m.rotation.z = -sx * 0.06; m.rotation.x = sz * 0.06; }
    else if (style === 'block') B(g, 5, h, 5, mat, x, y0 + h / 2, z);
    else B(g, 3.6, h, 3.6, mat, x, y0 + h / 2, z);
  });
}

function handle(g, type, mat, x, y, z, len, vertical) {
  if (type === 'none' || type === 'cutout') return;
  if (type === 'knob') { Sp(g, 1.6, mat, x, y, z + 1.4); return; }
  if (type === 'edge') { B(g, vertical ? 1.2 : len, vertical ? len : 1.2, 2, mat, x, y, z + 1); return; }
  const L = len || 14;
  if (vertical) {
    Cy(g, 0.6, 0.6, L, mat, x, y, z + 2.6, 12);
    B(g, 1, 1, 2.4, mat, x, y + L / 2 - 1, z + 1.3); B(g, 1, 1, 2.4, mat, x, y - L / 2 + 1, z + 1.3);
  } else {
    const m = Cy(g, 0.6, 0.6, L, mat, x, y, z + 2.6, 12); m.rotation.z = Math.PI / 2;
    B(g, 1, 1, 2.4, mat, x + L / 2 - 1, y, z + 1.3); B(g, 1, 1, 2.4, mat, x - L / 2 + 1, y, z + 1.3);
  }
}

/** a row of n cushions filling x0..x1 × z0..z1 at seat height y */
function cushions(g, x0, x1, z0, z1, y, t, n, mat, r) {
  const gap = 0.6, cw = (x1 - x0 - gap * (n - 1)) / n;
  for (let i = 0; i < n; i++) {
    const cx = x0 + cw / 2 + i * (cw + gap);
    R(g, cw, t, z1 - z0, r || 5, mat, cx, y + t / 2, (z0 + z1) / 2, 4);
  }
  return cw;
}

/** merged random books for a shelf of width W at height y */
function addBooks(g, x0, x1, y, depth, maxH, zBack, seed) {
  let rnd = seed * 9301 + 49297;
  const rand = () => { rnd = (rnd * 9301 + 49297) % 233280; return rnd / 233280; };
  const pal = ['#2f3e46', '#8c6a4f', '#c9b79c', '#5b6c5d', '#a3472c', '#e7e1d6', '#3c4f76', '#1f1f1f', '#b08d57', '#7b8f8a'];
  const geos = [];
  let x = x0 + 2 + rand() * 10;
  const end = x1 - 2;
  while (x < end) {
    if (rand() < 0.16) { x += 8 + rand() * 14; continue; } // gap for decor
    const groupN = 3 + Math.floor(rand() * 9);
    for (let i = 0; i < groupN && x < end; i++) {
      const bw = 1.8 + rand() * 2.8, bh = Math.min(maxH - 1.5, 17 + rand() * 12), bd = Math.min(depth - 3, 13 + rand() * 9);
      if (x + bw > end) break;
      const geo = new THREE.BoxGeometry(bw, bh, bd);
      geo.translate(x + bw / 2, y + bh / 2, zBack + bd / 2 + 1);
      const c = new THREE.Color(pal[Math.floor(rand() * pal.length)]).multiplyScalar(0.85 + rand() * 0.25);
      const cols = new Float32Array(geo.attributes.position.count * 3);
      for (let k = 0; k < cols.length; k += 3) { cols[k] = c.r; cols[k + 1] = c.g; cols[k + 2] = c.b; }
      geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
      geos.push(geo);
      x += bw + 0.1;
    }
    x += 3 + rand() * 6;
  }
  if (!geos.length) return;
  const merged = mergeGeometries(geos);
  const m = new THREE.Mesh(merged, booksMat());
  m.castShadow = m.receiveShadow = true;
  g.add(m);
}
let _booksMat = null;
function booksMat() {
  if (!_booksMat) { _booksMat = colorMat('#ffffff', 0.75).clone(); _booksMat.vertexColors = true; _booksMat.color.set('#ffffff'); }
  return _booksMat;
}

/** curved leaf geometry, length 1 along +Y */
function leafGeo(width, bend) {
  const geo = new THREE.PlaneGeometry(1, 1, 4, 6);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), v = p.getY(i) + 0.5;
    p.setXYZ(i, x * width * Math.sin(Math.PI * Math.min(1, v * 1.05)) , v, -bend * v * v + Math.abs(x) * 0.15 * width);
  }
  geo.computeVertexNormals();
  return geo;
}

/* =========================================================================
   builders: (group, w, d, h, ctx, opts)
   ctx: { main, frame, top, color, item, def }
   ========================================================================= */
const BUILD = {};

BUILD.sofa = (g, w, d, h, c, o) => {
  const legH = o.legH !== undefined ? o.legH : 11;
  const armW = o.armW || clamp(w * 0.085, 13, 24);
  const backT = clamp(d * 0.2, 15, 22);
  const seatTop = Math.min(h * 0.53, 46);
  const baseTop = seatTop - 15;
  const corner = !!o.corner;
  const sd = corner ? Math.min(98, d * 0.6) : d;            // depth of the main run
  const cw = corner ? clamp(w * 0.36, 80, 110) : 0;           // chaise width
  const zBack = -d / 2;
  if (legH > 0) {
    legs(g, w - 12, sd - 12, legH, c.frame, o.legStyle || 'tapered', 0);
    g.children.slice(-4).forEach(m => { m.position.z += zBack + sd / 2; });
    if (corner) { const m1 = B(g, 4, legH, 4, c.frame, w / 2 - 6, legH / 2, d / 2 - 6); m1.geometry.computeBoundingBox(); }
  }
  const r = o.soft ? 7 : 3;
  // base
  R(g, w, baseTop - legH, sd, r, c.main, 0, legH + (baseTop - legH) / 2, zBack + sd / 2);
  if (corner) R(g, cw, baseTop - legH, d - sd + 4, r, c.main, w / 2 - cw / 2, legH + (baseTop - legH) / 2, zBack + sd + (d - sd) / 2 - 2);
  // back frame
  const backH = h - legH;
  R(g, w, backH, backT, o.soft ? 8 : 4, c.main, 0, legH + backH / 2, zBack + backT / 2);
  // arms
  const armH = Math.min(h * 0.72, seatTop + 20) - legH;
  R(g, armW, armH, sd, o.soft ? 9 : 5, c.main, -w / 2 + armW / 2, legH + armH / 2, zBack + sd / 2);
  if (corner) R(g, armW, armH, d, 5, c.main, w / 2 - armW / 2, legH + armH / 2, 0);
  else R(g, armW, armH, sd, o.soft ? 9 : 5, c.main, w / 2 - armW / 2, legH + armH / 2, zBack + sd / 2);
  // seat cushions
  const seats = o.seats || clamp(Math.round((w - 2 * armW) / 70), 1, 4);
  const cz0 = zBack + backT + 15, cz1 = zBack + sd - 1;
  const xr = corner ? w / 2 - cw : w / 2 - armW;
  cushions(g, -w / 2 + armW + 0.5, xr - 0.5, zBack + backT - 0.5, cz1, baseTop, seatTop - baseTop, corner ? Math.max(1, seats - 1) : seats, c.main, o.soft ? 7 : 5);
  if (corner) R(g, cw - armW - 1, seatTop - baseTop, d - backT - 2, 5, c.main, w / 2 - cw / 2 - armW / 2, baseTop + (seatTop - baseTop) / 2, zBack + backT + (d - backT) / 2 - 1, 4);
  // back cushions
  const bcH = h - seatTop - 3, bcT = 17;
  const bx0 = -w / 2 + armW + 0.5, bx1 = w / 2 - armW - 0.5;
  const nb = seats, bw = (bx1 - bx0 - 0.6 * (nb - 1)) / nb;
  for (let i = 0; i < nb; i++) {
    const m = R(g, bw, bcH, bcT, 7, c.main, bx0 + bw / 2 + i * (bw + 0.6), seatTop + bcH / 2 - 1, zBack + backT + bcT / 2 - 3, 4);
    m.rotation.x = -0.13;
  }
  void cz0;
  // throw pillows
  if (w > 120) {
    const pm = finishMat(o.pillowFin || 'velvet', o.pillow || '#d8c8ad');
    [-1, 1].forEach(s => {
      const p = R(g, 44, 42, 13, 6.5, pm, s * (w / 2 - armW - 26), seatTop + 21, zBack + backT + 14, 4);
      p.rotation.set(-0.32, s * 0.18, s * -0.08);
    });
  }
};

BUILD.lounge = (g, w, d, h, c, o) => {
  // wooden frame armchair with loose cushions
  const seatH = 40, legT = 3.6;
  const fm = c.frame;
  [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([sx, sz]) => {
    const m = B(g, legT, sz < 0 ? h * 0.9 : 58, legT, fm, sx * (w / 2 - legT / 2), (sz < 0 ? h * 0.9 : 58) / 2, sz * (d / 2 - legT / 2));
    if (sz < 0) m.rotation.x = -0.12;
  });
  [-1, 1].forEach(sx => B(g, 5, 3, d, fm, sx * (w / 2 - 2.5), 58, 0)); // arm rests
  B(g, w - 8, 4, d - 8, fm, 0, seatH - 14, 0);
  if (o.rattan) {
    const rm = finishMat('rattan');
    const back = B(g, w - 8, h * 0.62, 2, rm, 0, seatH + h * 0.25, -d / 2 + 6); back.rotation.x = -0.12;
  }
  R(g, w - 9, 14, d - 10, 5, c.main, 0, seatH - 5, 1, 4);
  const bc = R(g, w - 12, h - seatH - 4, 14, 6, c.main, 0, seatH + (h - seatH) / 2, -d / 2 + 12, 4); bc.rotation.x = -0.16;
};

BUILD.pouf = (g, w, d, h, c) => {
  const m = R(g, w, h, d, Math.min(w, d) * 0.3, c.main, 0, h / 2, 0, 6);
  m.scale.set(1, 1, 1);
};

BUILD.bench = (g, w, d, h, c, o) => {
  if (o.uph || FINISHES[c.item.finish] && FINISHES[c.item.finish].tint) {
    legs(g, w - 10, d - 8, h - 14, c.frame, 'tapered');
    R(g, w, 14, d, 5, c.main, 0, h - 7, 0, 4);
  } else {
    const t = 4;
    B(g, w, t, d, c.main, 0, h - t / 2, 0);
    [-1, 1].forEach(s => B(g, 3, h - t, d - 6, c.frame, s * (w / 2 - 8), (h - t) / 2, 0));
    B(g, w - 16, 2, d - 10, c.main, 0, 12, 0);
  }
};

BUILD.table = (g, w, d, h, c, o) => {
  const topT = o.topT || 3.5;
  const tm = c.top || c.main;
  const shape = o.shape || 'rect';
  if (shape === 'round') {
    const m = Cy(g, w / 2, w / 2 - 0.3, topT, tm, 0, h - topT / 2, 0, 72);
    m.scale.z = d / w;
  } else {
    R(g, w, topT, d, 0.8, tm, 0, h - topT / 2, 0, 2);
  }
  const lh = h - topT;
  const L = o.legs || 'four';
  if (L === 'four') {
    const inset = o.thin ? 4 : 6;
    legs(g, w - inset * 2, d - inset * 2, lh, c.frame, o.thin ? 'metal' : 'tapered');
    if (!o.thin) { B(g, w - inset * 2 - 4, 7, 2, c.frame, 0, lh - 3.5, -d / 2 + inset); B(g, w - inset * 2 - 4, 7, 2, c.frame, 0, lh - 3.5, d / 2 - inset); }
    if (o.shelf) B(g, w - inset * 2, 2, d - inset * 2, tm, 0, lh * 0.35, 0);
  } else if (L === 'pedestal') {
    const r = Math.min(w, d) * 0.14;
    Cy(g, r * 0.55, r * 0.55, lh - 3, c.frame, 0, (lh - 3) / 2 + 3, 0, 32);
    Cy(g, Math.min(w, d) * 0.3, Math.min(w, d) * 0.32, 3, c.frame, 0, 1.5, 0, 48);
  } else if (L === 'twin') {
    [-1, 1].forEach(s => {
      Cy(g, 5, 7, lh - 2, c.frame, s * w * 0.25, (lh - 2) / 2 + 2, 0, 32);
      const b = Cy(g, 18, 20, 2, c.frame, s * w * 0.25, 1, 0, 48); b.scale.z = 0.8;
    });
  } else if (L === 'tripod') {
    for (let i = 0; i < 3; i++) {
      const a = i * Math.PI * 2 / 3, rr = Math.min(w, d) * 0.32;
      const m = Cy(g, 0.8, 0.8, lh * 1.03, c.frame, Math.cos(a) * rr * 0.5, lh / 2, Math.sin(a) * rr * 0.5, 10);
      m.rotation.z = Math.cos(a) * 0.18; m.rotation.x = -Math.sin(a) * 0.18;
    }
  } else if (L === 'sled') {
    [-1, 1].forEach(s => {
      const x = s * (w / 2 - 14);
      B(g, 4, lh, 4, c.frame, x, lh / 2, -d / 2 + 10); B(g, 4, lh, 4, c.frame, x, lh / 2, d / 2 - 10);
      B(g, 4, 4, d - 16, c.frame, x, 2, 0); B(g, 4, 4, d - 16, c.frame, x, lh - 2, 0);
    });
  }
};

BUILD.chair = (g, w, d, h, c, o) => {
  const st = o.style || 'wood';
  if (st === 'bar') {
    const seatH = h - 12;
    for (let i = 0; i < 4; i++) {
      const a = Math.PI / 4 + i * Math.PI / 2, rr = Math.min(w, d) * 0.36;
      const m = Cy(g, 1, 1.1, seatH, c.frame, Math.cos(a) * rr * 0.86, seatH / 2, Math.sin(a) * rr * 0.86, 10);
      m.rotation.z = Math.cos(a) * 0.08; m.rotation.x = -Math.sin(a) * 0.08;
    }
    To(g, Math.min(w, d) * 0.33, 0.8, c.frame, 0, seatH * 0.32, 0, Math.PI / 2);
    const s = Cy(g, w / 2 - 2, w / 2 - 3, 6, c.main, 0, seatH + 3, 0, 40);
    s.geometry.computeVertexNormals();
    const back = R(g, w * 0.7, 12, 4, 2, c.main, 0, h - 6, -d / 2 + 6, 3); back.rotation.x = -0.15;
    Cy(g, 0.8, 0.8, 10, c.frame, -w * 0.25, seatH + 6, -d / 2 + 6, 8); Cy(g, 0.8, 0.8, 10, c.frame, w * 0.25, seatH + 6, -d / 2 + 6, 8);
    return;
  }
  const seatH = o.seatH || 46;
  if (st === 'wood') {
    legs(g, w - 6, d - 6, seatH - 3, c.frame, 'tapered');
    R(g, w, 3, d - 2, 1, c.main, 0, seatH - 1.5, 1, 2);
    [-1, 1].forEach(s => B(g, 3.2, h - seatH + 3, 3.2, c.frame, s * (w / 2 - 3), seatH + (h - seatH) / 2 - 1.5, -d / 2 + 3));
    const bk = R(g, w - 2, 12, 2.4, 1, c.main, 0, h - 8, -d / 2 + 2.6, 2); bk.rotation.x = -0.08;
    B(g, w - 6, 2, 2, c.frame, 0, seatH + 12, -d / 2 + 3);
  } else if (st === 'uph') {
    legs(g, w - 8, d - 8, seatH - 8, c.frame, 'tapered');
    R(g, w, 9, d - 2, 3.5, c.main, 0, seatH - 4.5, 1, 4);
    const bk = R(g, w - 2, h - seatH + 4, 6, 3, c.main, 0, seatH + (h - seatH) / 2, -d / 2 + 4, 4); bk.rotation.x = -0.1;
  } else if (st === 'tub') {
    legs(g, w - 10, d - 10, seatH - 10, c.frame, 'tapered');
    R(g, w - 4, 10, d - 6, 4, c.main, 0, seatH - 5, 2, 4);
    const back = new THREE.Mesh(new THREE.CylinderGeometry(w / 2, w / 2 - 2, h - seatH + 10, 40, 1, true, Math.PI * 0.55, Math.PI * 0.9), c.main);
    finalize(back); back.material = c.main; back.position.set(0, seatH + (h - seatH) / 2 - 3, 2); back.scale.z = (d - 4) / w;
    back.rotation.y = Math.PI; g.add(back);
    const back2 = back.clone(); back2.scale.set(0.9, 1, back.scale.z * 0.9); back2.position.y += 0.5; g.add(back2);
    const rim = To(g, w / 2 - 1.4, 2.2, c.main, 0, h - 1, 2, Math.PI / 2); rim.scale.y = (d - 4) / w;
    rim.geometry = new THREE.TorusGeometry(w / 2 - 1.4, 2.2, 10, 40, Math.PI * 0.9); applyBoxUV(rim.geometry);
    rim.rotation.set(Math.PI / 2, 0, Math.PI * 1.05);
  }
};

BUILD.case = (g, w, d, h, c, o) => {
  const plinth = o.plinth || 0, legH = o.legs || 0;
  const counter = o.counter ? 4 : 0;
  const y0 = plinth + legH;
  const bodyH = h - y0 - counter;
  const fT = 1.8, gap = 0.35;
  const body = c.main;
  const bodyD = d - fT - (counter ? 2 : 0);
  B(g, w, bodyH, bodyD, body, 0, y0 + bodyH / 2, -d / 2 + bodyD / 2);
  if (plinth) B(g, w - 1, plinth, d - 7, utilMat('plastic'), 0, plinth / 2, -3.5);
  if (legH) legs(g, w - 10, d - 10, legH, c.frame, o.legStyle || 'tapered');
  if (counter) B(g, w, counter, d, c.top || finishMat('marble'), 0, h - counter / 2, 0);
  else if (!o.handleBottom && legH) B(g, w, 1.8, d, body, 0, h - 0.9, 0);
  const zf = -d / 2 + bodyD + fT / 2 - (counter ? 0 : 0);
  const fronts = []; // {x,y,w,h, kind:'door'|'drawer'}
  const H = bodyH, W = w;
  const fr = o.fronts || 'doors';
  if (fr === 'doors' || fr === 'tall') {
    const n = o.n || Math.max(1, Math.round(W / (fr === 'tall' ? 60 : 55)));
    for (let i = 0; i < n; i++) fronts.push({ x: -W / 2 + W / n * (i + 0.5), y: y0 + H / 2, w: W / n, h: H, kind: 'door', side: n === 1 ? 1 : (i % 2 ? 1 : -1) });
  } else if (fr === 'drawers') {
    const rows = o.rows || 3, cols = o.cols || 1;
    for (let r = 0; r < rows; r++) for (let k = 0; k < cols; k++) {
      const fh = H / rows;
      fronts.push({ x: -W / 2 + W / cols * (k + 0.5), y: y0 + H - fh * (r + 0.5), w: W / cols, h: fh, kind: 'drawer' });
    }
  } else if (fr === 'single') {
    fronts.push({ x: 0, y: y0 + H / 2, w: W, h: H, kind: 'drawer' });
  } else if (fr === 'oven') {
    // drawer bottom, oven middle, door top
    const dh = 30, ovH = 60;
    fronts.push({ x: 0, y: y0 + dh / 2, w: W, h: dh, kind: 'drawer' });
    const oy = y0 + dh + ovH / 2;
    B(g, W - 1, ovH - 1, 2.2, utilMat('blackGlass'), 0, oy, zf + 0.3);
    B(g, W - 8, 1.6, 1, finishMat('steel'), 0, oy + ovH / 2 - 7, zf + 2.6);
    B(g, W - 10, 8, 0.3, colorMat('#1a1a1a', 0.2), 0, oy + ovH / 2 - 3, zf + 1.6);
    fronts.push({ x: 0, y: y0 + dh + ovH + (H - dh - ovH) / 2, w: W, h: H - dh - ovH, kind: 'door', side: 1, handleLow: true });
  }
  const hm = c.frame || finishMat('black');
  fronts.forEach(f => {
    const fm = o.mirrorDoors ? finishMat('mirror') : body;
    B(g, f.w - gap * 2, f.h - gap * 2, fT, fm, f.x, f.y, zf);
    if (o.mirrorDoors) B(g, f.w - gap * 2 + 0.2, f.h - gap * 2 + 0.2, fT - 0.4, body, f.x, f.y, zf - 0.3);
    if (o.slats && f.kind === 'door') {
      const n = Math.floor((f.w - 2) / 3.2);
      for (let i = 0; i < n; i++) B(g, 1.6, f.h - 3, 0.9, body, f.x - f.w / 2 + 2.4 + i * 3.2, f.y, zf + fT / 2 + 0.45);
    }
    const ht = o.handle || 'bar';
    if (f.kind === 'drawer') handle(g, ht, hm, f.x, f.y + f.h * 0.25, zf + fT / 2, Math.min(f.w * 0.5, 32), false);
    else {
      const hx = f.x + (f.side > 0 ? -1 : 1) * (f.w / 2 - 4);
      const long = ht === 'long';
      const hy = f.handleLow ? f.y + f.h / 2 - 8 : o.handleBottom ? f.y - f.h / 2 + 10 : (y0 + H > 120 && !long ? y0 + Math.min(H * 0.5, 105) : f.y + (y0 + H < 100 ? f.h * 0.3 : 0));
      handle(g, long ? 'bar' : ht, hm, hx, hy, zf + fT / 2, long ? Math.min(f.h * 0.45, 90) : Math.min(f.h * 0.4, 16), true);
    }
  });
};

BUILD.slider = (g, w, d, h, c) => {
  const body = c.main;
  B(g, w, h, d - 6, body, 0, h / 2, -3);
  const n = w > 170 ? 3 : 2, pw = w / n + 3;
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + pw / 2 + i * (w - pw) / (n - 1);
    const zz = d / 2 - (i % 2 ? 1.5 : 4.5);
    B(g, pw, h - 10, 2, body, x, h / 2, zz);
    if (i === Math.floor(n / 2)) B(g, pw - 10, h - 24, 0.4, finishMat('mirror'), x, h / 2, zz + 1.2);
    B(g, 1.2, h - 10, 2.6, finishMat('black'), x + pw / 2 - 0.6, h / 2, zz + 0.2);
  }
  B(g, w, 5, 7, finishMat('black'), 0, h - 2.5, d / 2 - 3.5);
  B(g, w, 5, 7, finishMat('black'), 0, 2.5, d / 2 - 3.5);
};

BUILD.shelf = (g, w, d, h, c, o) => {
  const t = 2;
  const m = c.main;
  if (o.frameOnly) {
    legs(g, w - 2, d - 2, h, m, 'metal');
    g.children.slice(-4).forEach(x => { x.geometry = new THREE.BoxGeometry(2, h, 2); applyBoxUV(x.geometry); });
  } else {
    [-1, 1].forEach(s => B(g, t, h, d, m, s * (w / 2 - t / 2), h / 2, 0));
    B(g, w, h, 0.8, m, 0, h / 2, -d / 2 + 0.4);
  }
  const n = o.shelves || 4;
  const shelfMat = o.frameOnly ? finishMat('oak') : m;
  for (let i = 0; i <= n; i++) {
    const y = i === 0 ? (o.frameOnly ? 6 : t / 2) : (h - t) * i / n + t / 2;
    B(g, w - (o.frameOnly ? 0 : t * 2), t, d - 1, shelfMat, 0, y, 0.4);
    if (i < n && (o.books || o.decor)) {
      const top = (h - t) * (i + 1) / n;
      const space = top - y - t;
      if (o.books && (i % 3 !== 2 || n < 3)) addBooks(g, -w / 2 + t, w / 2 - t, y + t / 2, d, space, -d / 2 + 1, i + 3 + Math.round(w));
      else decorItems(g, -w / 2 + t, w / 2 - t, y + t / 2, d, space, i);
    }
  }
};

function decorItems(g, x0, x1, y, d, space, seed) {
  const vm = finishMat('ceramic', ['#e8e2d6', '#3d4a4c', '#c98f6b'][seed % 3]);
  const w = x1 - x0;
  La(g, [[0, 0], [5, 0], [6, 4], [4.5, Math.min(space - 4, 20)], [3, Math.min(space - 3, 22)], [0, Math.min(space - 3, 22)]], vm, x0 + w * 0.25, y, 0, 32);
  Sp(g, Math.min(6, space / 3), finishMat('ceramic', '#d9d2c4'), x0 + w * 0.7, y + Math.min(6, space / 3), 0);
  B(g, 18, 3, 14, colorMat('#6b7a6b', 0.8), x0 + w * 0.48, y + 1.5, 0);
  B(g, 16, 2.5, 12, colorMat('#d9cdb8', 0.8), x0 + w * 0.48, y + 4.2, 0);
}

BUILD.wallshelf = (g, w, d, h, c) => {
  B(g, w, h, d, c.main, 0, h / 2, 0);
  addBooks(g, -w / 2 + 2, w * 0.15, h, d, 26, -d / 2, 7);
  decorItems(g, w * 0.15, w / 2 - 2, h, d, 30, 1);
};

BUILD.tv = (g, w, d, h, c, o) => {
  const sh = o.stand ? h - 8 : h;
  const screenD = 2.6;
  const zs = o.stand ? 0 : -d / 2 + screenD / 2 + 1.5;
  R(g, w, sh, screenD, 0.4, utilMat('plastic'), 0, (o.stand ? 8 : 0) + sh / 2, zs, 2);
  const scr = B(g, w - 1.2, sh - 1.2, 0.2, utilMat('screen'), 0, (o.stand ? 8 : 0) + sh / 2, zs + screenD / 2 + 0.05);
  scr.castShadow = false;
  if (o.stand) {
    [-1, 1].forEach(s => { const f = B(g, 3, 8, Math.min(d, 24), finishMat('black'), s * w * 0.38, 4, 0); f.rotation.z = s * 0.2; });
  }
};

BUILD.desk = (g, w, d, h, c, o) => {
  const topT = 3;
  B(g, w, topT, d, c.main, 0, h - topT / 2, 0);
  if (o.pedestal) {
    const pw = 42;
    B(g, pw, h - topT, d - 4, c.main, w / 2 - pw / 2 - 1, (h - topT) / 2, 0);
    for (let i = 0; i < 3; i++) handle(g, 'bar', c.frame, w / 2 - pw / 2 - 1, (h - topT) * (i + 0.7) / 3, d / 2 - 2, 14, false);
    [0, 1, 2].forEach(i => B(g, pw - 1, 0.3, 0.3, colorMat('#222'), w / 2 - pw / 2 - 1, (h - topT) * (i + 1) / 3, d / 2 - 1.8));
    B(g, 4, h - topT, d - 6, c.frame, -w / 2 + 4, (h - topT) / 2, 0);
    B(g, 4, 4, d - 6, c.frame, -w / 2 + 4, 2, 0);
  } else if (o.metal) {
    [-1, 1].forEach(s => {
      B(g, 3, h - topT, 3, c.frame, s * (w / 2 - 5), (h - topT) / 2, -d / 2 + 6);
      B(g, 3, h - topT, 3, c.frame, s * (w / 2 - 5), (h - topT) / 2, d / 2 - 6);
      B(g, 3, 3, d - 12, c.frame, s * (w / 2 - 5), h - topT - 1.5, 0);
    });
    B(g, w - 10, 3, 3, c.frame, 0, h - topT - 1.5, -d / 2 + 6);
  } else {
    legs(g, w - 8, d - 8, h - topT, c.frame, 'tapered');
  }
  if (o.drawer) {
    B(g, w * 0.5, 9, d - 8, c.main, 0, h - topT - 4.5, 0);
    handle(g, 'knob', c.frame, 0, h - topT - 4.5, (d - 8) / 2, 0, false);
  }
  if (o.mirror) {
    const mh = Math.min(70, w * 0.6);
    const mm = Cy(g, mh / 2, mh / 2, 1.5, finishMat('mirror'), 0, h + mh / 2 + 5, -d / 2 + 5, 48); mm.rotation.x = Math.PI / 2;
    const fr = To(g, mh / 2, 1, c.frame, 0, h + mh / 2 + 5, -d / 2 + 5.6);
    void fr;
    B(g, 3, 6, 3, c.frame, 0, h + 3, -d / 2 + 5);
  }
};

BUILD.mirror = (g, w, d, h, c, o) => {
  const fm = c.main;
  if (o.round) {
    const m = Cy(g, Math.min(w, h) / 2 - 1.5, Math.min(w, h) / 2 - 1.5, 1, finishMat('mirror'), 0, h / 2, 0.5, 64); m.rotation.x = Math.PI / 2;
    To(g, Math.min(w, h) / 2 - 1, 1.6, fm, 0, h / 2, 0.6);
    return;
  }
  const fw = 2.2;
  B(g, w, h, 1.6, fm, 0, h / 2, -d / 2 + 0.8);
  B(g, w - fw * 2, h - fw * 2, 0.4, finishMat('mirror'), 0, h / 2, -d / 2 + 1.8);
  if (o.glow) B(g, w + 1, h + 1, 0.6, utilMat('bulb'), 0, h / 2, -d / 2 + 0.2).castShadow = false;
  if (o.floor) {
    const m = g.children[g.children.length - 2]; void m;
    g.children.forEach(ch => { ch.rotation.x = -0.1; ch.position.z += 6; });
    B(g, 3, h * 0.6, 3, fm, 0, h * 0.3, -d / 2 - 6).rotation.x = 0.3;
  }
};

BUILD.bed = (g, w, d, h, c, o) => {
  const frameH = 30, legH = 9;
  const hbT = 9;
  const mattressT = 22;
  legs(g, w - 14, d - 20, legH, c.frame, 'tapered');
  R(g, w, frameH - legH, d - hbT, 2, c.main, 0, legH + (frameH - legH) / 2, hbT / 2, 3);
  // headboard
  const hb = R(g, w + 2, h - legH, hbT, o.tall ? 4 : 3, c.main, 0, legH + (h - legH) / 2, -d / 2 + hbT / 2, 4);
  void hb;
  if (o.tall && FINISHES[c.item.finish] && FINISHES[c.item.finish].tint) {
    const n = Math.max(3, Math.round(w / 30));
    for (let i = 0; i < n; i++) R(g, (w - 4) / n - 0.6, h - frameH - 14, 4, 2, c.main, -w / 2 + 2 + (w - 4) / n * (i + 0.5), frameH + (h - frameH - 14) / 2 + 6, -d / 2 + hbT + 1.5, 3);
  }
  const mw = w - 6, md = d - hbT - 6, mz = hbT / 2 + 0;
  R(g, mw, mattressT, md, 5, utilMat('mattress'), 0, frameH + mattressT / 2, mz, 4);
  // duvet covering lower 70%
  const duvet = finishMat('fabric', o.duvet || '#f2efe9');
  const dl = md * 0.7;
  R(g, mw + 3, mattressT + 6, dl, 4, duvet, 0, frameH + mattressT / 2 + 1.5, mz + md / 2 - dl / 2 + 1.5, 4);
  R(g, mw + 3.4, 7, 16, 3.5, duvet, 0, frameH + mattressT + 3, mz + md / 2 - dl + 7, 3); // folded edge
  // throw
  R(g, mw + 4.5, mattressT + 7, 42, 3, finishMat('fabric', o.throw || '#b6a486'), 0, frameH + mattressT / 2 + 2, mz + md / 2 - 21 + 2.5, 3);
  // pillows
  const np = w >= 120 ? 2 : 1, pw = Math.min(70, (mw - 10) / np);
  for (let i = 0; i < np; i++) {
    const x = np === 1 ? 0 : (i ? 1 : -1) * (pw / 2 + 2);
    const p = R(g, pw, 14, 42, 7, utilMat('linen'), x, frameH + mattressT + 9, -d / 2 + hbT + 26, 4);
    p.rotation.x = -0.35;
  }
  if (np === 2) {
    const dp = R(g, 45, 30, 10, 5, finishMat('velvet', o.throw || '#b6a486'), 0, frameH + mattressT + 14, -d / 2 + hbT + 42, 4);
    dp.rotation.x = -0.3;
  }
};

BUILD.kidbed = (g, w, d, h, c) => {
  const m = c.main;
  [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([sx, sz]) => B(g, 5, sz < 0 ? h : h * 0.7, 5, m, sx * (w / 2 - 2.5), (sz < 0 ? h : h * 0.7) / 2, sz * (d / 2 - 2.5)));
  B(g, w - 2, 12, d - 6, m, 0, 26, 0);
  R(g, w - 8, 15, d - 12, 4, utilMat('mattress'), 0, 39, 0, 4);
  R(g, w - 6, 18, (d - 12) * 0.65, 4, finishMat('fabric', '#cfe0e3'), 0, 40, (d - 12) * 0.175, 4);
  R(g, 55, 12, 36, 6, utilMat('linen'), 0, 52, -d / 2 + 26, 4).rotation.x = -0.3;
  // rails
  [-1, 1].forEach(sz => B(g, w - 8, 3, 3, m, 0, sz < 0 ? h - 6 : h * 0.7 - 6, sz * (d / 2 - 2.5)));
  B(g, 3, 3, d * 0.55, m, w / 2 - 2.5, 60, -d * 0.15);
  for (let i = 0; i < 6; i++) B(g, 2, 24, 2, m, w / 2 - 2.5, 47, -d * 0.4 + i * d * 0.1);
};

BUILD.bunk = (g, w, d, h, c) => {
  const m = c.main;
  [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([sx, sz]) => B(g, 6, h, 6, m, sx * (w / 2 - 3), h / 2, sz * (d / 2 - 3)));
  [22, 120].forEach((y, k) => {
    B(g, w - 4, 10, d - 4, m, 0, y, 0);
    R(g, w - 10, 14, d - 12, 4, utilMat('mattress'), 0, y + 12, 0, 4);
    R(g, w - 8, 16, (d - 12) * 0.62, 4, finishMat('fabric', k ? '#d7c7b1' : '#b9cbd0'), 0, y + 13, (d - 12) * 0.19, 4);
    R(g, 50, 11, 34, 5, utilMat('linen'), 0, y + 24, -d / 2 + 24, 4).rotation.x = -0.3;
  });
  // upper rails
  [-1, 1].forEach(sx => B(g, 3, 3, d - 6, m, sx * (w / 2 - 3), h - 5, 0));
  B(g, w - 6, 3, 3, m, 0, h - 5, -d / 2 + 3);
  B(g, w - 6, 3, 3, m, 0, h - 5, d / 2 - 3);
  // ladder at foot
  for (let i = 0; i < 4; i++) B(g, 3, 3, 30, m, w / 2 + 1, 40 + i * 26, d / 2 - 22);
  [-1, 1].forEach(s => B(g, 4, 140, 4, m, w / 2 + 1, 70, d / 2 - 22 + s * 15));
};

BUILD.teepee = (g, w, d, h, c) => {
  const cone = new THREE.Mesh(new THREE.ConeGeometry(w / 2, h * 0.85, 6, 1, true, 0.5, Math.PI * 1.7), c.main);
  cone.material = finishMat('fabric', c.color); finalize(cone);
  cone.material.side = THREE.FrontSide;
  cone.position.y = h * 0.425; g.add(cone);
  const inner = cone.clone(); inner.scale.set(0.985, 1, 0.985); inner.material = finishMat('fabric', c.color); g.add(inner);
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * Math.PI * 2;
    const m = Cy(g, 1.2, 1.2, h * 1.02, finishMat('oaklight'), Math.cos(a) * w * 0.2, h / 2, Math.sin(a) * w * 0.2, 8);
    m.rotation.z = Math.cos(a) * -0.3; m.rotation.x = Math.sin(a) * 0.3;
  }
  R(g, w * 0.7, 6, w * 0.7, 3, finishMat('boucle', '#ede6da'), 0, 3, 0, 3);
};

BUILD.sinkunit = (g, w, d, h, c) => {
  BUILD.case(g, w, d, h, c, { plinth: 10, counter: true, fronts: 'doors', handle: 'bar' });
  const bw = Math.min(w - 16, 56), bd = d - 22;
  B(g, bw, 0.6, bd, finishMat('steel'), 0, h + 0.05, 2);
  B(g, bw - 3, 0.4, bd - 3, colorMat('#77797b', 0.4, 0.8), 0, h + 0.3, 2);
  // faucet
  const fm = c.frame || finishMat('chrome');
  const fx = 0, fz = -d / 2 + 7;
  Cy(g, 2.2, 2.4, 3, fm, fx, h + 1.5, fz, 24);
  Tu(g, [[fx, h + 2, fz], [fx, h + 26, fz], [fx, h + 33, fz + 6], [fx, h + 26, fz + 14]], 1.1, fm, 40);
  Cy(g, 0.5, 0.5, 8, fm, fx + 3.5, h + 6, fz, 8).rotation.z = Math.PI / 2.4;
};

BUILD.stove = (g, w, d, h, c) => {
  BUILD.case(g, w, d, h, c, { plinth: 10, counter: true, fronts: 'oven', handle: 'bar' });
  const ch = h + 0.3;
  B(g, w - 4, 0.6, d - 8, utilMat('blackGlass'), 0, ch, 1);
  [[-0.24, -0.2, 9], [0.24, -0.2, 7], [-0.24, 0.22, 7], [0.24, 0.22, 9]].forEach(([fx, fz, r]) => {
    To(g, r, 0.15, colorMat('#5a5d61', 0.4), w * fx, ch + 0.35, d * fz, Math.PI / 2);
  });
};

BUILD.hood = (g, w, d, h, c) => {
  const m = c.main;
  const boxH = 12;
  B(g, w, boxH, d, m, 0, boxH / 2, 0);
  const hood = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1, 4, 1), m);
  void hood;
  const geo = new THREE.BufferGeometry();
  // trapezoid canopy as a lathe-free extruded shape
  const sh = new THREE.Shape();
  sh.moveTo(-w / 2, 0); sh.lineTo(w / 2, 0); sh.lineTo(13, 22); sh.lineTo(-13, 22); sh.closePath();
  const eg = new THREE.ExtrudeGeometry(sh, { depth: d - 10, bevelEnabled: false });
  eg.translate(0, boxH, -(d - 10) / 2 - 5);
  const mm = finalize(new THREE.Mesh(eg, m)); g.add(mm);
  void geo;
  B(g, 26, h - boxH - 22, 24, m, 0, boxH + 22 + (h - boxH - 22) / 2, -d / 2 + 12);
  B(g, w - 6, 0.4, d - 6, colorMat('#555', 0.5, 0.8), 0, 0, 0);
};

BUILD.fridge = (g, w, d, h, c, o) => {
  const m = c.main;
  const bodyD = d - 5;
  R(g, w, h, bodyD, 1.5, m, 0, h / 2, -d / 2 + bodyD / 2, 3);
  if (o.sbs) {
    [-1, 1].forEach(s => {
      R(g, w / 2 - 0.4, h - 2, 4.4, 1.2, m, s * w / 4, h / 2 + 1, d / 2 - 2.2, 3);
      handle(g, 'bar', c.frame, s * 3.2, h * 0.55, d / 2, h * 0.45, true);
    });
    B(g, 22, 34, 0.6, utilMat('blackGlass'), -w / 4, h * 0.62, d / 2 + 0.2);
  } else {
    const split = h * 0.36;
    R(g, w - 0.6, h - split - 1, 4.4, 1.2, m, 0, split + (h - split) / 2 + 0.5, d / 2 - 2.2, 3);
    R(g, w - 0.6, split - 3, 4.4, 1.2, m, 0, split / 2 - 0.5, d / 2 - 2.2, 3);
    handle(g, 'bar', c.frame, -w / 2 + 5, split + 30, d / 2, 40, true);
    handle(g, 'bar', c.frame, -w / 2 + 5, split - 18, d / 2, 26, true);
  }
};

BUILD.island = (g, w, d, h, c) => {
  const counter = 4, over = 25;
  const bodyD = d - over;
  BUILD.case(g, w, bodyD, h - counter, Object.assign({}, c, { frame: finishMat('black') }), { plinth: 10, fronts: 'drawers', rows: 3, cols: Math.max(1, Math.round(w / 70)), handle: 'edge' });
  g.children.forEach(ch => { ch.position.z += -over / 2; });
  B(g, w + 6, counter, d, c.top || finishMat('marble'), 0, h - counter / 2, 0);
};

BUILD.micro = (g, w, d, h) => {
  R(g, w, h, d, 1.2, finishMat('steel'), 0, h / 2, 0, 2);
  B(g, w * 0.72, h - 6, 0.4, utilMat('blackGlass'), -w * 0.12, h / 2, d / 2 + 0.1);
  B(g, w * 0.18, h - 6, 0.4, colorMat('#2a2b2d', 0.3), w * 0.37, h / 2, d / 2 + 0.1);
};

BUILD.coffee = (g, w, d, h) => {
  R(g, w, h, d, 2, utilMat('plastic'), 0, h / 2, 0, 3);
  B(g, w - 2, 1, d * 0.5, finishMat('steel'), 0, 2, d * 0.2);
  Cy(g, 3.4, 2.6, 8, finishMat('ceramic', '#ffffff'), 0, 7, d * 0.25, 24);
  B(g, w - 4, h * 0.2, 0.5, finishMat('steel'), 0, h * 0.8, d / 2 + 0.1);
};

BUILD.officechair = (g, w, d, h, c) => {
  const fm = c.frame;
  for (let i = 0; i < 5; i++) {
    const a = i / 5 * Math.PI * 2;
    const arm = B(g, w * 0.42, 2.5, 4, fm, Math.cos(a) * w * 0.21, 7, Math.sin(a) * w * 0.21);
    arm.rotation.y = -a;
    Sp(g, 2.8, utilMat('plastic'), Math.cos(a) * w * 0.42, 2.8, Math.sin(a) * w * 0.42);
  }
  Cy(g, 3, 3.5, 6, fm, 0, 8, 0, 20);
  Cy(g, 1.8, 1.8, 30, finishMat('chrome'), 0, 25, 0, 16);
  R(g, w * 0.8, 9, d * 0.78, 4, c.main, 0, 46, 2, 4);
  const bk = R(g, w * 0.76, h - 58, 6, 4, c.main, 0, 54 + (h - 58) / 2, -d / 2 + 8, 4); bk.rotation.x = -0.1;
  B(g, 4, 18, 3, fm, 0, 48, -d / 2 + 6);
  [-1, 1].forEach(s => { B(g, 3, 18, 3, fm, s * w * 0.4, 56, 0); R(g, 5, 2.5, 24, 1, utilMat('plastic'), s * w * 0.4, 66, 0, 2); });
};

BUILD.monitor = (g, w, d, h) => {
  const sh = h - 12;
  R(g, w, sh, 2, 0.6, utilMat('plastic'), 0, 12 + sh / 2, 0, 2);
  B(g, w - 1.4, sh - 1.4, 0.2, utilMat('screen'), 0, 12 + sh / 2, 1.05);
  B(g, 4, 18, 2, finishMat('steel'), 0, 9, -3);
  R(g, 22, 1.2, 16, 0.5, finishMat('steel'), 0, 0.6, -2, 2);
  R(g, 44, 1.6, 14, 0.5, utilMat('plasticWhite'), 0, 0.8, d / 2 + 12, 2);
};

BUILD.laptop = (g, w, d, h) => {
  R(g, w, 1.6, d, 0.6, finishMat('steel'), 0, 0.8, 0, 2);
  const lid = new THREE.Group(); lid.position.set(0, 1.6, -d / 2); lid.rotation.x = -0.32; g.add(lid);
  R(lid, w, d * 0.95, 0.7, 0.4, finishMat('steel'), 0, d * 0.475, 0, 2);
  B(lid, w - 2, d * 0.95 - 2, 0.1, utilMat('screen'), 0, d * 0.475, 0.4);
};

BUILD.coatstand = (g, w, d, h, c) => {
  const m = c.main;
  Cy(g, 1.8, 1.8, h, m, 0, h / 2, 0, 16);
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2 + 0.4;
    const l = Cy(g, 1.2, 1.2, w * 0.55, m, Math.cos(a) * w * 0.22, 9, Math.sin(a) * w * 0.22, 10);
    l.rotation.z = Math.cos(a) * 1.1; l.rotation.x = -Math.sin(a) * 1.1;
    const hk = Cy(g, 0.8, 0.8, 12, m, Math.cos(a) * 6, h - 12, Math.sin(a) * 6, 8);
    hk.rotation.z = Math.cos(a) * -0.8; hk.rotation.x = Math.sin(a) * 0.8;
  }
  coat(g, 6, h - 14, 0, finishMat('fabric', '#6b6f73'), 0.3);
  coat(g, -5, h - 14, 2, finishMat('fabric', '#a28666'), -0.4);
};
function coat(g, x, y, z, mat, ry) {
  const grp = new THREE.Group(); grp.position.set(x, y, z); grp.rotation.y = ry; g.add(grp);
  const body = R(grp, 38, 85, 14, 6, mat, 0, -48, 6, 3); body.rotation.x = 0.06;
  R(grp, 46, 12, 15, 6, mat, 0, -8, 5, 3);
}

BUILD.hooks = (g, w, d, h, c) => {
  B(g, w, 10, 2, c.main, 0, h - 5, -d / 2 + 1);
  const n = Math.max(2, Math.round(w / 18));
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + w / n * (i + 0.5);
    Cy(g, 0.9, 0.9, 7, finishMat('black'), x, h - 5, -d / 2 + 5, 10).rotation.x = Math.PI / 2;
  }
  const cg = new THREE.Group(); cg.position.set(-w * 0.2, 0, 0); g.add(cg);
  coat(cg, 0, h - 5, -d / 2 + 2, finishMat('fabric', '#3f4a52'), 0);
};

BUILD.bath = (g, w, d, h, c) => {
  const m = c.main, t = 6;
  R(g, w, h - 3, d, 1.5, finishMat('matte', '#efeeea'), 0, (h - 3) / 2, 0, 3); // tiled apron
  // rim
  B(g, w, 3, t, m, 0, h - 1.5, -d / 2 + t / 2); B(g, w, 3, t, m, 0, h - 1.5, d / 2 - t / 2);
  B(g, t, 3, d, m, -w / 2 + t / 2, h - 1.5, 0); B(g, t, 3, d, m, w / 2 - t / 2, h - 1.5, 0);
  // inner basin (slightly lower, rounded)
  R(g, w - t * 2, 1, d - t * 2, 0.3, m, 0, h - 0.4, 0, 2);
  const inner = R(g, w - t * 2 - 4, 2, d - t * 2 - 4, 0.5, utilMat('water'), 0, h - 12, 0, 2);
  inner.castShadow = false;
  const fm = finishMat('chrome');
  Tu(g, [[-w / 2 + 4, h, 0], [-w / 2 + 4, h + 10, 0], [-w / 2 + 10, h + 12, 0], [-w / 2 + 16, h + 8, 0]], 1, fm, 20);
};

BUILD.freebath = (g, w, d, h, c) => {
  const r = 50;
  const pts = [[0, 0], [r * 0.72, 0], [r * 0.86, h * 0.12], [r * 0.97, h * 0.6], [r, h], [r - 3.5, h], [r * 0.92 - 3, h * 0.6], [r * 0.78 - 3, h * 0.2], [r * 0.6, 7], [0, 7]];
  const m = La(g, pts, c.main, 0, 0, 0, 64);
  m.scale.set(w / (2 * r), 1, d / (2 * r));
  const wtr = Cy(g, r * 0.86, r * 0.86, 0.5, utilMat('water'), 0, h * 0.62, 0, 48); wtr.scale.set(w / (2 * r), 1, d / (2 * r)); wtr.castShadow = false;
  const fm = c.frame || finishMat('chrome');
  Cy(g, 1.6, 1.6, h + 22, fm, -w / 2 - 12, (h + 22) / 2, 0, 16);
  Tu(g, [[-w / 2 - 12, h + 21, 0], [-w / 2 - 10, h + 26, 0], [-w / 2 + 2, h + 24, 0], [-w / 2 + 6, h + 18, 0]], 1.2, fm, 20);
};

BUILD.shower = (g, w, d, h, c, o) => {
  const fm = c.frame;
  R(g, w, 5, d, 1, finishMat('ceramic', '#f5f5f3'), 0, 2.5, 0, 2);
  B(g, 8, 0.4, 8, finishMat('steel'), 0, 5.1, 0);
  const glass = finishMat('glass');
  const gh = h - 10;
  if (o.walkin) {
    B(g, w * 0.55, gh, 0.8, glass, -w / 2 + w * 0.275, 5 + gh / 2, d / 2 - 1).castShadow = false;
    B(g, w * 0.55, 2, 2, fm, -w / 2 + w * 0.275, 5 + gh, d / 2 - 1);
    B(g, 2, 2, d, fm, w * 0.05, 5 + gh, 0);
    B(g, 2, gh, 2, fm, -w / 2 + 1, 5 + gh / 2, d / 2 - 1);
  } else {
    B(g, w - 2, gh, 0.6, glass, 0, 5 + gh / 2, d / 2 - 1).castShadow = false;
    B(g, 0.6, gh, d - 2, glass, -w / 2 + 1, 5 + gh / 2, 0).castShadow = false;
    [[-1, 1], [1, 1], [-1, -1]].forEach(([sx, sz]) => B(g, 1.6, gh, 1.6, fm, sx * (w / 2 - 0.8), 5 + gh / 2, sz * (d / 2 - 0.8)));
    B(g, w, 1.6, 1.6, fm, 0, 5 + gh, d / 2 - 0.8); B(g, 1.6, 1.6, d, fm, -w / 2 + 0.8, 5 + gh, 0);
    handle(g, 'bar', fm, w * 0.15, 105, d / 2 - 1, 30, true);
  }
  // rain head + rail
  Cy(g, 1, 1, h - 20, fm, w / 2 - 6, (h - 20) / 2 + 5, -d / 2 + 4, 10);
  B(g, 2, 2, 22, fm, w / 2 - 6, h - 14, -d / 2 + 14);
  Cy(g, 13, 13, 1, fm, w / 2 - 6, h - 16, -d / 2 + 24, 40);
  B(g, 8, 10, 3, fm, w / 2 - 6, 105, -d / 2 + 2);
};

BUILD.toilet = (g, w, d, h, c, o) => {
  const m = c.main;
  const seatH = o.wall ? 42 : 40;
  const yb = o.wall ? 18 : 0;
  // bowl as squashed lathe
  const pts = [[0, 0], [10, 0], [13, (seatH - yb) * 0.4], [18, seatH - yb - 3], [19, seatH - yb], [0, seatH - yb]];
  const bowl = La(g, pts, m, 0, yb, 0, 40);
  bowl.scale.set(w / 38, 1, (d - 18) / 38);
  bowl.position.z = d / 2 - (d - 18) / 2 - 1;
  const seat = R(g, w - 1, 2.6, d - 20, 9, m, 0, seatH + 1.3, bowl.position.z, 4);
  void seat;
  if (o.wall) {
    B(g, w + 8, h - yb, 14, finishMat('matte', '#efeeea'), 0, (h) / 2 + 9, -d / 2 + 7);
    R(g, 22, 1, 14, 0.3, finishMat('chrome'), 0, h * 0.85, -d / 2 + 14.1, 2).rotation.x = Math.PI / 2;
  } else {
    R(g, w - 2, h - seatH - 2, 18, 4, m, 0, seatH + (h - seatH) / 2 - 1, -d / 2 + 9, 4);
    Cy(g, 2.2, 2.2, 0.8, finishMat('chrome'), 0, h - 2.6, -d / 2 + 9, 24);
    R(g, w * 0.7, seatH - 4, 20, 6, m, 0, (seatH - 4) / 2, -d / 2 + 18, 4);
  }
};

BUILD.vanity = (g, w, d, h, c) => {
  const cabH = h - 12;
  const sub = new THREE.Group(); sub.position.y = 12; g.add(sub);
  BUILD.case(sub, w, d, cabH, Object.assign({}, c, { frame: finishMat('black') }), { counter: true, fronts: 'drawers', rows: 2, handle: 'none' });
  // basin vessel
  const bpts = [[0, 0], [14, 0], [19, 4], [21, 13], [19.5, 13], [17.6, 4.5], [13, 1.8], [0, 1.8]];
  const bsn = La(g, bpts, finishMat('ceramic', '#f7f7f5'), 0, h, 2, 48);
  bsn.scale.set(Math.min(1, (w - 14) / 42), 1, Math.min(1, (d - 10) / 42));
  const fm = c.frame;
  Cy(g, 1.6, 1.8, 4, fm, 0, h + 2, -d / 2 + 6, 20);
  Tu(g, [[0, h + 3, -d / 2 + 6], [0, h + 26, -d / 2 + 6], [0, h + 29, -d / 2 + 10], [0, h + 25, -d / 2 + 16]], 1, fm, 30);
};

BUILD.washbasin = (g, w, d, h, c) => {
  const m = c.main;
  R(g, w, 14, d, 5, m, 0, h - 7, 0, 4);
  R(g, w - 8, 1, d - 12, 4, colorMat('#e9e9e6', 0.15), 0, h - 0.3, 2, 3);
  Cy(g, 3, 3, h - 30, m, 0, (h - 30) / 2 + 15, -d / 2 + 8, 20);
  const fm = c.frame;
  Cy(g, 1.6, 1.8, 4, fm, 0, h + 2, -d / 2 + 5, 20);
  Tu(g, [[0, h + 3, -d / 2 + 5], [0, h + 16, -d / 2 + 5], [0, h + 18, -d / 2 + 9], [0, h + 14, -d / 2 + 14]], 1, fm, 30);
};

BUILD.washer = (g, w, d, h, c) => {
  R(g, w, h, d, 2, c.main, 0, h / 2, 0, 3);
  const r = Math.min(w, h) * 0.26;
  To(g, r, 2.4, finishMat('chrome'), 0, h * 0.44, d / 2 + 0.5);
  const gl = Cy(g, r - 1, r - 1, 1, utilMat('blackGlass'), 0, h * 0.44, d / 2 + 0.3, 40); gl.rotation.x = Math.PI / 2;
  B(g, w - 4, 10, 0.4, colorMat('#d8dadb', 0.3), 0, h - 7, d / 2 + 0.1);
  Cy(g, 3, 3, 1.6, finishMat('chrome'), w * 0.3, h - 7, d / 2 + 0.6, 24).rotation.x = Math.PI / 2;
};

BUILD.towelrail = (g, w, d, h, c) => {
  const fm = c.frame;
  [-1, 1].forEach(s => Cy(g, 1.4, 1.4, h, fm, s * (w / 2 - 1.5), h / 2, 0, 16));
  const n = Math.max(4, Math.round(h / 11));
  for (let i = 0; i < n; i++) Cy(g, 0.8, 0.8, w - 3, fm, 0, 4 + (h - 8) * i / (n - 1), 0, 10).rotation.z = Math.PI / 2;
  R(g, w * 0.7, h * 0.45, 3, 1.4, finishMat('fabric', '#e9e2d6'), 0, h * 0.62, 2.5, 3);
};

BUILD.floorlamp = (g, w, d, h, c) => {
  const fm = c.frame;
  Cy(g, w * 0.32, w * 0.34, 2.5, fm, 0, 1.25, 0, 40);
  Cy(g, 1, 1, h - 30, fm, 0, (h - 30) / 2, 0, 12);
  const shade = Cy(g, w * 0.32, w / 2, 32, utilMat('shadeGlow'), 0, h - 16, 0, 40, true);
  shade.castShadow = false;
  Sp(g, 4, utilMat('bulb'), 0, h - 20, 0).castShadow = false;
  g.userData.lights = [{ x: 0, y: h - 20, z: 0, power: 1 }];
};

BUILD.arclamp = (g, w, d, h, c) => {
  const fm = c.frame;
  R(g, 30, 8, 30, 1, finishMat('marble'), -w / 2 + 15, 4, 0, 2);
  Tu(g, [[-w / 2 + 15, 8, 0], [-w / 2 + 18, h * 0.6, 0], [-w / 2 + w * 0.45, h, 0], [w / 2 - 20, h - 4, 0], [w / 2 - 18, h - 20, 0]], 1.1, fm, 64);
  const shade = La(g, [[0, 0], [20, -2], [20.5, -2.5], [22, -14], [21, -14], [19, -3], [0, -1]], fm, w / 2 - 18, h - 18, 0, 48);
  void shade;
  Sp(g, 4, utilMat('bulb'), w / 2 - 18, h - 26, 0).castShadow = false;
  g.userData.lights = [{ x: w / 2 - 18, y: h - 28, z: 0, power: 1.2 }];
};

BUILD.tablelamp = (g, w, d, h, c) => {
  const pts = [[0, 0], [6, 0], [9, 4], [10, h * 0.25], [6, h * 0.5], [2, h * 0.55], [0, h * 0.55]];
  La(g, pts, c.main, 0, 0, 0, 40);
  const shade = Cy(g, w * 0.32, w / 2, h * 0.42, utilMat('shadeGlow'), 0, h - h * 0.21, 0, 40, true);
  shade.castShadow = false;
  Sp(g, 3, utilMat('bulb'), 0, h * 0.68, 0).castShadow = false;
  g.userData.lights = [{ x: 0, y: h * 0.7, z: 0, power: 0.5 }];
};

BUILD.pendant = (g, w, d, h, c, o) => {
  const n = o.count || 1;
  const lights = [];
  for (let i = 0; i < n; i++) {
    const x = n === 1 ? 0 : -w / 2 + w / n * (i + 0.5);
    const cl = Math.max(0.5, c.ceilAbove); const cord = Cy(g, 0.3, 0.3, cl, colorMat('#111'), x, h + cl / 2, 0, 6); cord.castShadow = false;
    if (o.globe) {
      const gl = Sp(g, Math.min(d / 2, 15), utilMat('shadeGlow'), x, h / 2, 0); gl.castShadow = false;
      Cy(g, 3, 3, 4, c.main, x, h, 0, 16);
    } else {
      const r = Math.min(w, d) / 2;
      La(g, [[0, h], [3, h], [5, h - 3], [r * 0.6, h - h * 0.45], [r, 0.5], [r - 0.5, 0], [r * 0.6 - 0.6, h - h * 0.45 - 0.5], [3, h - 4], [0, h - 4]], c.main, x, 0, 0, 48);
    }
    Sp(g, 3.5, utilMat('bulb'), x, o.globe ? h / 2 : 6, 0).castShadow = false;
    lights.push({ x, y: o.globe ? h / 2 : 4, z: 0, power: n > 1 ? 0.6 : 1 });
  }
  g.userData.lights = lights;
};

BUILD.chandelier = (g, w, d, h, c) => {
  const fm = c.frame;
  const cl = Math.max(0.5, c.ceilAbove); Cy(g, 0.6, 0.6, cl, fm, 0, h + cl / 2, 0, 8).castShadow = false;
  Cy(g, 6, 6, 3, fm, 0, h, 0, 24);
  const n = 8, r = w / 2 - 4;
  To(g, r * 0.6, 0.8, fm, 0, h * 0.35, 0, Math.PI / 2);
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2, x = Math.cos(a) * r, z = Math.sin(a) * r;
    Tu(g, [[0, h * 0.9, 0], [x * 0.5, h * 0.4, z * 0.5], [x, h * 0.35, z], [x, h * 0.45, z]], 0.6, fm, 16);
    Sp(g, 3, utilMat('bulb'), x, h * 0.45 + 3, z).castShadow = false;
  }
  g.userData.lights = [{ x: 0, y: h * 0.4, z: 0, power: 1.6 }];
};

BUILD.sconce = (g, w, d, h, c) => {
  const fm = c.frame;
  Cy(g, 5, 5, 1, fm, 0, h / 2, -d / 2 + 0.5, 24).rotation.x = Math.PI / 2;
  Tu(g, [[0, h / 2, -d / 2], [0, h / 2 + 2, -d / 2 + 8], [0, h / 2 + 4, d / 2 - 6]], 0.6, fm, 12);
  const s = Sp(g, 7, utilMat('shadeGlow'), 0, h / 2 + 6, d / 2 - 7); s.castShadow = false;
  g.userData.lights = [{ x: 0, y: h / 2 + 6, z: d / 2 - 7, power: 0.4 }];
};

BUILD.spot = (g, w, d, h) => {
  Cy(g, w / 2, w / 2, 1.2, finishMat('matte', '#f5f5f3'), 0, h, 0, 24);
  const b = Cy(g, w / 2 - 1.5, w / 2 - 1.5, 0.4, utilMat('bulb'), 0, h - 0.7, 0, 24); b.castShadow = false;
  g.userData.lights = [{ x: 0, y: h - 6, z: 0, power: 0.35, spot: true }];
};

BUILD.plant = (g, w, d, h, c, o) => {
  const t = o.type;
  const potH = t === 'small' ? h * 0.38 : t === 'tree' ? 38 : t === 'snake' ? 26 : h * 0.4;
  const potR = Math.min(w, d) * (t === 'tree' ? 0.3 : 0.36);
  const potMat = finishMat('ceramic', t === 'tree' ? '#e9e3d8' : t === 'snake' ? '#2d2f31' : '#c7a385');
  La(g, [[0, 0], [potR * 0.78, 0], [potR, potH * 0.95], [potR - 1, potH], [potR - 1.5, potH * 0.92], [0, potH * 0.92]], potMat, 0, 0, 0, 40);
  Cy(g, potR - 1.5, potR - 1.5, 1, utilMat('soil'), 0, potH - 2, 0, 32);
  let s = 1;
  const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const leaves = [];
  const addLeaf = (geo, pos, dir, len, roll) => {
    const gg = geo.clone();
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    const rq = new THREE.Quaternion().setFromAxisAngle(dir.clone().normalize(), roll);
    m4.compose(pos, rq.multiply(q), new THREE.Vector3(len, len, len));
    gg.applyMatrix4(m4);
    leaves.push(gg);
  };
  if (t === 'tree') {
    // fiddle leaf: trunk + clusters
    const trunk = Tu(g, [[0, potH - 2, 0], [2, h * 0.45, 1], [-1, h * 0.75, -1], [1, h * 0.92, 0]], 1.6, colorMat('#6a5541', 0.9), 24);
    void trunk;
    const geo = leafGeo(0.62, 0.12);
    for (let i = 0; i < 70; i++) {
      const y = h * (0.42 + rnd() * 0.55);
      const a = rnd() * Math.PI * 2, rr = (w * 0.12) * (0.4 + rnd()) * (1 - (y / h - 0.42));
      const pos = new THREE.Vector3(Math.cos(a) * rr * 0.4, y, Math.sin(a) * rr * 0.4);
      const dir = new THREE.Vector3(Math.cos(a), 0.4 + rnd() * 0.9, Math.sin(a));
      addLeaf(geo, pos, dir, 16 + rnd() * 12, rnd() * 3);
    }
  } else if (t === 'snake') {
    const geo = leafGeo(0.12, 0.05);
    for (let i = 0; i < 14; i++) {
      const a = rnd() * Math.PI * 2, rr = rnd() * potR * 0.5;
      addLeaf(geo, new THREE.Vector3(Math.cos(a) * rr, potH - 3, Math.sin(a) * rr), new THREE.Vector3(Math.cos(a) * 0.15, 1, Math.sin(a) * 0.15), (h - potH) * (0.6 + rnd() * 0.45), rnd() * 3);
    }
  } else {
    const geo = leafGeo(0.55, 0.2);
    const n = t === 'small' ? 22 : 46;
    for (let i = 0; i < n; i++) {
      const a = rnd() * Math.PI * 2;
      const up = 0.3 + rnd() * 1.2;
      addLeaf(geo, new THREE.Vector3(Math.cos(a) * 2, potH - 2, Math.sin(a) * 2), new THREE.Vector3(Math.cos(a), up, Math.sin(a)), (h - potH) * (0.55 + rnd() * 0.6), rnd() * 3);
    }
  }
  if (leaves.length) {
    const half = Math.floor(leaves.length / 2);
    const m1 = new THREE.Mesh(mergeGeometries(leaves.slice(0, half)), utilMat('leaf'));
    const m2 = new THREE.Mesh(mergeGeometries(leaves.slice(half)), utilMat(t === 'snake' ? 'leaf' : 'leafLight'));
    [m1, m2].forEach(m => { m.castShadow = m.receiveShadow = true; g.add(m); });
  }
};

BUILD.vase = (g, w, d, h, c) => {
  const vh = h * 0.42, r = Math.min(w, d) / 2;
  La(g, [[0, 0], [r * 0.6, 0], [r, vh * 0.35], [r * 0.85, vh * 0.8], [r * 0.45, vh], [r * 0.4, vh], [0, vh]], c.main, 0, 0, 0, 40);
  const bm = colorMat('#5a4636', 0.9);
  for (let i = 0; i < 5; i++) {
    const a = i * 1.3;
    Tu(g, [[0, vh - 4, 0], [Math.cos(a) * 6, vh + 20, Math.sin(a) * 6], [Math.cos(a) * 14, h * 0.8, Math.sin(a) * 12], [Math.cos(a) * 20, h, Math.sin(a) * 18]], 0.4, bm, 16);
  }
  const lm = utilMat('leafLight');
  const geo = leafGeo(0.5, 0.1);
  const leaves = [];
  for (let i = 0; i < 40; i++) {
    const a = (i % 5) * 1.3, t = 0.3 + (i / 40) * 0.7;
    const gg = geo.clone();
    const m4 = new THREE.Matrix4().compose(new THREE.Vector3(Math.cos(a) * 20 * t, vh + (h - vh) * t, Math.sin(a) * 18 * t), new THREE.Quaternion().setFromEuler(new THREE.Euler(i, i * 2.1, i * 0.7)), new THREE.Vector3(5, 5, 5));
    gg.applyMatrix4(m4); leaves.push(gg);
  }
  const lmM = new THREE.Mesh(mergeGeometries(leaves), lm); lmM.castShadow = true; g.add(lmM);
};

BUILD.bookstack = (g, w, d, h) => {
  const pal = ['#2f3e46', '#c9b79c', '#8c6a4f', '#e7e1d6'];
  let y = 0;
  for (let i = 0; i < 4 && y < h; i++) {
    const bh = 2.5 + (i % 2) * 1.2;
    const b = B(g, w - i * 3, bh, d - i * 2, colorMat(pal[i], 0.8), i * 0.8, y + bh / 2, 0);
    b.rotation.y = (i % 2 ? 0.08 : -0.05);
    y += bh;
  }
};

BUILD.decorset = (g, w, d, h) => {
  La(g, [[0, 0], [5, 0], [11, 4], [14, 8], [13.4, 8], [10.5, 4.5], [0, 1.4]], finishMat('ceramic', '#e6dfd2'), -w / 2 + 14, 0, 0, 48);
  [[8, 12], [14, 8], [19, 10]].forEach(([x, ch]) => {
    Cy(g, 2.4, 2.4, ch, colorMat('#f3eee4', 0.6), x, ch / 2, 0, 20);
    Cy(g, 0.15, 0.15, 1.2, colorMat('#111'), x, ch + 0.6, 0, 6);
  });
};

BUILD.rug = (g, w, d, h, c, o) => {
  const tex = rugTexture(o.pattern || 'border', c.item.color && c.item.colorA ? c.item.colorA : (o.a || '#d8cfc0'), o.b || '#8b7f6e');
  const mat = new THREE.MeshPhysicalMaterial({ map: tex, roughness: 1, sheen: 0.6, sheenRoughness: 0.8, sheenColor: new THREE.Color('#ffffff') });
  mat.envMapIntensity = 0.4;
  const geo = o.round ? new THREE.CircleGeometry(0.5, 64) : new THREE.PlaneGeometry(1, 1);
  geo.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(geo, mat);
  m.scale.set(w, 1, d);
  m.position.y = 1.0; m.receiveShadow = true; g.add(m);
  const edge = o.round ? new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1, 64, 1, true), mat) : new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat);
  edge.scale.set(w, 0.95, d); edge.position.y = 0.48; edge.receiveShadow = true; g.add(edge);
  g.userData.noShadow = true;
};

BUILD.art = (g, w, d, h, c, o) => {
  const fm = c.frame;
  const fw = 3;
  B(g, w, fw, d, fm, 0, h - fw / 2, 0); B(g, w, fw, d, fm, 0, fw / 2, 0);
  B(g, fw, h - fw * 2, d, fm, -w / 2 + fw / 2, h / 2, 0); B(g, fw, h - fw * 2, d, fm, w / 2 - fw / 2, h / 2, 0);
  B(g, w - fw * 2, h - fw * 2, 0.5, utilMat('paper'), 0, h / 2, -d / 2 + 0.5);
  const art = new THREE.Mesh(new THREE.PlaneGeometry(w - fw * 2 - 12, h - fw * 2 - 12), new THREE.MeshStandardMaterial({ map: artTexture(o.style || 'abstract'), roughness: 0.8 }));
  art.position.set(0, h / 2, -d / 2 + 0.8); art.receiveShadow = true; g.add(art);
};

BUILD.curtains = (g, w, d, h, c, o) => {
  const rodY = h - 3;
  Cy(g, 1, 1, w + 16, finishMat('black'), 0, rodY, 0, 12).rotation.z = Math.PI / 2;
  const mk = (pw, ph, mat, x, z, amp, folds) => {
    const geo = new THREE.PlaneGeometry(pw, ph, Math.max(16, Math.round(pw / 2)), 8);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const xx = p.getX(i);
      p.setZ(i, Math.sin(xx / pw * Math.PI * 2 * folds) * amp);
    }
    geo.computeVertexNormals(); applyBoxUV(geo);
    const m = new THREE.Mesh(geo, mat); m.position.set(x, rodY - ph / 2 - 1, z);
    m.castShadow = true; m.receiveShadow = true; g.add(m);
  };
  mk(w, h - 6, utilMat('sheer'), 0, -d / 4, 1.6, w / 14);
  if (!o.sheerOnly) {
    const fin = c.item.finish === 'linen' ? 'fabric' : c.item.finish;
    const dm = finishMat(fin || 'velvet', c.color);
    dm.side = THREE.DoubleSide;
    const pw = Math.min(70, w * 0.3);
    mk(pw, h - 4, dm, -w / 2 + pw / 2 - 4, d / 4, 3.5, pw / 16);
    mk(pw, h - 4, dm, w / 2 - pw / 2 + 4, d / 4, 3.5, pw / 16);
  }
};

BUILD.fireplace = (g, w, d, h, c) => {
  const m = c.main;
  B(g, w, h, d, m, 0, h / 2, 0);
  const fh = h * 0.42, fw = w * 0.62;
  B(g, fw, fh, 2, utilMat('blackGlass'), 0, h * 0.42, d / 2 + 0.1);
  B(g, fw - 6, 2, 6, colorMat('#2a2a2a', 0.5, 0.6), 0, h * 0.25, d / 2 - 3);
  const fl = B(g, fw - 14, fh * 0.35, 0.3, new THREE.MeshStandardMaterial({ color: '#ff9a40', emissive: '#ff7a1a', emissiveIntensity: 3 }), 0, h * 0.25 + fh * 0.2, d / 2 + 0.3);
  fl.castShadow = false;
  B(g, w + 6, 4, d + 4, m, 0, h + 2, 0);
  g.userData.lights = [{ x: 0, y: h * 0.35, z: d / 2 + 10, power: 0.35, color: '#ff9a50' }];
};

BUILD.vitrine = (g, w, d, h, c) => {
  const m = c.main;
  legs(g, w - 8, d - 8, 14, c.frame, 'tapered');
  B(g, w, h - 14, 1.6, m, 0, 14 + (h - 14) / 2, -d / 2 + 0.8);
  [-1, 1].forEach(s => B(g, 2, h - 14, d, m, s * (w / 2 - 1), 14 + (h - 14) / 2, 0));
  B(g, w, 2, d, m, 0, h - 1, 0); B(g, w, 2, d, m, 0, 15, 0);
  for (let i = 1; i < 4; i++) {
    const y = 15 + (h - 16) * i / 4;
    B(g, w - 4, 0.8, d - 3, finishMat('glass'), 0, y, 0).castShadow = false;
    for (let k = 0; k < 4; k++) {
      Cy(g, 3.4, 2.6, 9, finishMat('glass'), -w / 2 + 12 + k * (w - 24) / 3, y + 5, 0, 20).castShadow = false;
    }
  }
  B(g, w - 4, h - 18, 0.6, finishMat('glass'), 0, 14 + (h - 14) / 2, d / 2 - 0.3).castShadow = false;
  B(g, 1, h - 18, 1.2, c.frame, 0, 14 + (h - 14) / 2, d / 2);
};

BUILD.floorzone = (g, w, d, h, c, o) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, Math.max(0.6, h), d), floorMat(o.floor || 'tile60'));
  // UV in metres in world-ish (local) space so tiles stay true to scale
  applyBoxUV(m.geometry);
  m.position.y = Math.max(0.6, h) / 2; m.receiveShadow = true; g.add(m);
  g.userData.noShadow = true;
};

BUILD.wallpanel = (g, w, d, h, c, o) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), floorMat(o.floor || 'tile60'));
  applyBoxUV(m.geometry);
  m.position.y = h / 2; m.receiveShadow = true; m.castShadow = true; g.add(m);
};

BUILD.slats = (g, w, d, h, c) => {
  B(g, w, h, 0.8, colorMat('#222', 0.9), 0, h / 2, -d / 2 + 0.4);
  const n = Math.floor(w / 5);
  for (let i = 0; i < n; i++) B(g, 3, h, d - 1, c.main, -w / 2 + 2.5 + i * w / n, h / 2, 0.5);
};

BUILD.radiator = (g, w, d, h) => {
  const n = Math.max(3, Math.round(w / 8));
  const m = finishMat('matte', '#f5f5f3');
  for (let i = 0; i < n; i++) R(g, w / n - 1, h, d - 2, 1.2, m, -w / 2 + w / n * (i + 0.5), h / 2, 0, 2);
  B(g, w, 3, 3, m, 0, h - 4, 0); B(g, w, 3, 3, m, 0, 4, 0);
};

BUILD.aircon = (g, w, d, h) => {
  const m = utilMat('plasticWhite');
  R(g, w, h, d, 5, m, 0, h / 2, 0, 4);
  B(g, w - 8, 3, 1, colorMat('#d9dbdc', 0.5), 0, 5, d / 2 - 2).rotation.x = -0.6;
  B(g, 6, 1.2, 0.2, utilMat('bulb'), w / 2 - 10, h * 0.6, d / 2 + 0.05).castShadow = false;
};

/* =========================================================================
   public: build an item's 3D group
   ========================================================================= */
export function buildFurniture(item, env) {
  const def = FURNITURE_BY_KEY[item.key] || { b: 'box', o: {} };
  const ctx = {
    item, def,
    color: item.color || def.color || '#bbbbbb',
    main: finishMat(item.finish || def.finish || 'matte', item.color || def.color || '#bbbbbb'),
    frame: finishMat(item.frame || def.frame || 'black', '#222'),
    top: finishMat(item.top || def.top || 'marble', '#ddd'),
    ceilAbove: ((env && env.ceiling) || 270) - (item.z || 0) - item.h
  };
  const g = new THREE.Group();
  const fn = BUILD[def.b];
  try {
    if (fn) fn(g, item.w, item.d, item.h, ctx, def.o || {});
    else B(g, item.w, item.h, item.d, ctx.main, 0, item.h / 2, 0);
  } catch (e) {
    console.warn('builder failed', def.b, e);
    while (g.children.length) g.remove(g.children[0]);
    B(g, item.w, item.h, item.d, ctx.main, 0, item.h / 2, 0);
  }
  return g;
}
