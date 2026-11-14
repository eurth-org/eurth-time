/**
 * The invented calendars Time's examples and tests are dated in. They are four of the presets
 * of @eurth/calendar, copied here as plain data until that package is released; from then on
 * this file re-exports the package's own (roadmap.md, step 4h).
 */

/** Thirteen months of 28 days, and a Midyear Day outside the week every fifth year. Linked to Earth. */
export const SELUNNAN = {
  v: 1,
  name: 'Selunnan Reckoning',
  era: 'FS',
  eraBefore: 'Before the Founding',
  months: ['Frostmoon', 'Thawmoon', 'Seedmoon', 'Rainmoon', 'Bloommoon', 'Sunmoon', 'Highmoon', 'Ripemoon', 'Harvestmoon', 'Mistmoon', 'Leafmoon', 'Embermoon', 'Darkmoon'].map(
    (name) => ({ name, days: 28 }),
  ),
  intercalary: [{ name: 'Midyear Day', after: 7, days: 0, inWeek: false }],
  weekdays: ['Solday', 'Monday', 'Tideday', 'Windday', 'Hearthday', 'Fieldday', 'Restday'],
  firstWeekday: 1,
  leap: [{ every: 5, except: [], days: 1, to: { intercalary: 1 } }],
  epoch: '1008-02-15',
  moons: [
    { name: 'Selen', period: 29.5, phase: 0 },
    { name: 'Kair', period: 41, phase: 0.5 },
  ],
  holidays: [],
};

/** A lunar calendar: twelve months of 30 and 29 days, a year of 354 or 355. No link to Earth. */
export const TIDEWATCH = {
  v: 1,
  name: 'Tidewatch Count',
  era: 'TC',
  eraBefore: 'before the Count',
  months: ['Ashar', 'Belen', 'Corun', 'Dessa', 'Enil', 'Farrow', 'Ghal', 'Hesk', 'Ilun', 'Jorra', 'Kesh', 'Lumen'].map((name, i) => ({
    name,
    days: i % 2 === 0 ? 30 : 29,
  })),
  intercalary: [],
  weekdays: ['Ebbday', 'Neapday', 'Floodday', 'Springday', 'Saltday', 'Netday', 'Stillday'],
  firstWeekday: 1,
  leap: [
    { every: 3, except: [], days: 1, to: { month: 12 } },
    { every: 30, except: [], days: 1, to: { month: 6 } },
  ],
  epoch: null,
  moons: [{ name: 'Ila', period: 29.530556, phase: 0 }],
  holidays: [],
};

/** Twelve months of 30 days and five festival days at the year's end, six in a leap year. Linked to Earth. */
export const MERIDIAN = {
  v: 1,
  name: 'Meridian Republican Calendar',
  era: 'YR',
  eraBefore: 'before the Republic',
  months: ['Vintage', 'Fogmonth', 'Frostmonth', 'Snowmonth', 'Rainmonth', 'Windmonth', 'Budmonth', 'Flowermonth', 'Meadowmonth', 'Reapmonth', 'Heatmonth', 'Fruitmonth'].map(
    (name) => ({ name, days: 30 }),
  ),
  intercalary: [{ name: 'Festival', after: 12, days: 5, inWeek: false }],
  weekdays: ['Firstday', 'Seconday', 'Thirday', 'Fourthday', 'Fifthday', 'Sixthday', 'Sevenday', 'Eighthday', 'Ninthday', 'Tenthday'],
  firstWeekday: 1,
  leap: [{ every: 4, except: [128], days: 1, to: { intercalary: 1 } }],
  epoch: '1792-09-22',
  moons: [{ name: 'Moon', period: 29.530588, phase: 0.191934 }],
  holidays: [],
};

/** Another world: a year of 412 days, ten months of 41, a day before them and a day after. No link to Earth, no name for the time before year 1. */
export const KHARAN = {
  v: 1,
  name: 'Kharan Long Year',
  era: 'KY',
  eraBefore: '',
  months: ['Arrak', 'Besht', 'Chol', 'Dunn', 'Eshk', 'Farr', 'Ghesh', 'Hadd', 'Ikkar', 'Jurn'].map((name) => ({ name, days: 41 })),
  intercalary: [
    { name: 'Dawnturn', after: 0, days: 1, inWeek: true },
    { name: 'Duskturn', after: 10, days: 1, inWeek: true },
  ],
  weekdays: ['Onesun', 'Twosun', 'Threesun', 'Foursun', 'Fivesun', 'Sixsun', 'Sevensun', 'Darksun'],
  firstWeekday: 1,
  leap: [{ every: 3, except: [60], days: 1, to: { month: 10 } }],
  epoch: null,
  moons: [
    { name: 'Aru', period: 12.25, phase: 0 },
    { name: 'Besh', period: 33, phase: 0.25 },
    { name: 'Tolu', period: 97.6, phase: 0.5 },
  ],
  holidays: [],
};
