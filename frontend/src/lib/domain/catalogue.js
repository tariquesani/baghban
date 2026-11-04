/** Label lists shared with the API. The file is the only copy. */

import catalogue from '../../../../shared/catalogue.json' with { type: 'json' };

/** @type {{ value: string, label: string }[]} */
export const CARE_ACTIONS = catalogue.careActions;

/** @type {string[]} */
export const CROP_CATEGORIES = catalogue.cropCategories;

/** @type {{ value: string, label: string }[]} */
export const SUNS = catalogue.sun;

/** @type {{ value: string, label: string }[]} */
export const WATERS = catalogue.water;
