import assert from 'node:assert/strict';
import test from 'node:test';
import { gardenClock, headerView, LOCATION_PROMPT } from './gardenHeader.js';

const noonUtc = new Date('2026-10-31T12:00:00Z');

const moon = {
  name: 'Last quarter',
  illumination: 66,
  icon: 'moon-last-quarter',
};

test('the clock is the garden minute in 24-hour time', () => {
  assert.equal(gardenClock(noonUtc, 'Asia/Kolkata'), '17:30');
  assert.equal(gardenClock(noonUtc, 'UTC'), '12:00');
});

test('a blank name reads My garden and a blank subtitle is omitted', () => {
  const view = headerView({
    garden: { name: '  ', subtitle: '  ', timezone: 'Asia/Kolkata' },
    sky: { moon },
    now: noonUtc,
    browserZone: 'UTC',
  });
  assert.equal(view.name, 'My garden');
  assert.equal(view.subtitle, '');
  assert.equal(view.prompt, LOCATION_PROMPT);
  assert.deepEqual(view.items.map((item) => item.id), ['time', 'zone', 'moon']);
  assert.equal(view.items[1].text, 'Asia/Kolkata');
  assert.equal(view.items[2].text, 'Last quarter 66%');
});

test('without a saved place the clock uses the browser zone', () => {
  const view = headerView({
    garden: null,
    sky: { moon },
    now: noonUtc,
    browserZone: 'UTC',
  });
  assert.equal(view.items[0].text, '12:00');
  assert.equal(view.items[1].text, 'UTC');
  assert.equal(view.located, false);
});

test('a placed garden shows weather, wind, sun, and moon', () => {
  const view = headerView({
    garden: {
      name: "SANI's garden",
      subtitle: 'A small plot at home',
      latitude: 21.15,
      longitude: 79.09,
      timezone: 'Asia/Kolkata',
    },
    sky: {
      weather: { temperature: 28.6, phrase: 'Partly cloudy', icon: 'partly-cloudy-day' },
      wind: { speed: 1.34, icon: 'wind' },
      sunrise: '06:15',
      sunset: '17:38',
      moon,
    },
    now: noonUtc,
    browserZone: 'UTC',
  });
  assert.equal(view.name, "SANI's garden");
  assert.equal(view.subtitle, 'A small plot at home');
  assert.equal(view.prompt, '');
  assert.deepEqual(
    view.items.map((item) => item.text),
    [
      '17:30',
      'Asia/Kolkata',
      '29°C',
      '1.3 m/s',
      '06:15',
      '17:38',
      'Last quarter 66%',
    ],
  );
  assert.equal(view.items[0].strong, true);
  assert.equal(view.items[2].strong, true);
  assert.equal(view.items[2].aside, 'Partly cloudy');
  assert.equal(view.items[3].icon, 'wind');
  assert.equal(view.items[4].kind, 'sunrise');
});

test('a failed weather reading keeps the sun and the moon', () => {
  const view = headerView({
    garden: {
      name: 'Plot',
      subtitle: '',
      latitude: 21.15,
      longitude: 79.09,
      timezone: 'Asia/Kolkata',
    },
    sky: {
      weatherUnavailable: true,
      weather: null,
      wind: null,
      sunrise: '06:15',
      sunset: '17:38',
      moon,
    },
    now: noonUtc,
    browserZone: 'UTC',
  });
  assert.deepEqual(view.items.map((item) => item.id), [
    'time',
    'zone',
    'weather',
    'sunrise',
    'sunset',
    'moon',
  ]);
  assert.equal(view.items[2].text, 'Weather unavailable');
});

test('weather stays off the row until the sky reading arrives', () => {
  const view = headerView({
    garden: {
      latitude: 21.15,
      longitude: 79.09,
      timezone: 'Asia/Kolkata',
    },
    sky: null,
    now: noonUtc,
    browserZone: 'UTC',
  });
  assert.deepEqual(view.items.map((item) => item.id), ['time', 'zone']);
});
