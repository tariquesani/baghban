/** @typedef {{ title: string, tips: string[] }} ScreenHelp */

/** @type {Record<string, ScreenHelp>} */
const screens = {
  '/': {
    title: 'Dashboard',
    tips: [
      'The header shows this garden’s name, the local time, and the sky once a place is saved in Settings',
      'Currently Growing lists sowings that are still in the ground',
      'Coming up is this month. Choose a day to open that date on the calendar',
      'Overdue and Today open that entry here. Coming up opens the calendar on that date',
      'Photos in the gallery come from calendar entries',
    ],
  },
  '/calendar': {
    title: 'Calendar',
    tips: [
      'Filter the year by sowing, care, pest control, harvest, or diary',
      'The years beside the heading move to the previous or next year',
      'Choose a day, a crop, or one cell. The panel below lists those entries',
      'Add a sowing, care, harvest, pest control, or diary note from the sidebar',
      'Open an entry to read it, then edit it or remove it',
    ],
  },
  '/crops': {
    title: 'Crops',
    tips: [
      'Search by name or alias, then filter by category',
      'Show archived crops when you need a crop you put away',
      'Add a crop and set its sun, water, spacing, and days to maturity',
      'Companions, and plants to avoid, are saved on the crop',
      'Archive hides a crop from the usual list. Open it while archived crops are shown, then restore it',
    ],
  },
  '/planner': {
    title: 'Planner',
    tips: [
      'Drag an item to move it. Drag empty ground to pan',
      'Arrow keys nudge the selection by one screen pixel. A selected corner moves on its own',
      'Hold Space, or use the middle mouse button, to pan from anywhere',
      'Drag the ↻ handle to rotate; hold Shift to snap to 15°',
      'Recalibrate a plan from Settings if the scale looks wrong',
      'Plot a bed by clicking corners',
      'Double-click to close a polygon',
      'Double-click an edge of a selected bed to add a corner',
    ],
  },
  '/settings': {
    title: 'Settings',
    tips: [
      'Name and subtitle are what the dashboard shows for this garden',
      'Place is a latitude and longitude. The timezone comes from that place',
      'With dimensions as the scale, Size is the width and length in feet',
      'A plan scale is recalibrated from the planner. Settings links you there',
      'Start again clears the beds, plants, obstacles, plan photo, and scale. The name and place stay',
    ],
  },
};

const fallback = {
  title: 'Baghban',
  tips: [
    'Dashboard, Calendar, Crops, Planner, and Settings each have their own tips',
    'Open Help again after you change section',
  ],
};

/**
 * Tips for the screen at this path.
 * @param {string} path
 * @returns {ScreenHelp}
 */
export function helpForPath(path) {
  return screens[path] ?? fallback;
}
