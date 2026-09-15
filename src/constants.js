/* Values shared by the simulation, the renderer and the network code.
   These are the tuned numbers. Do not change them without being asked. */

export const COLS = 15, ROWS = 13, TS = 40;
export const BAR = 40;                       // HUD height in pixels
export const W = COLS * TS, H = ROWS * TS + BAR;

export const EMPTY = 0, SOLID = 1, SOFT = 2;

export const PU = ['bomb','range','speed','shield','kick','fuse','skull','random'];
export const PU_WEIGHT = [22,22,14,8,10,8,10,6];

export const SLOT_COLOR = ['#dfe6ec','#6fcf82','#f2c14e','#ef7fa8'];
export const SLOT_NAME  = ['Silver','Green','Amber','Rose'];

export const BUILD = 'build 12';
