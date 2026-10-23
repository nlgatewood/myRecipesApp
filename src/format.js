// src/format.js  Display helpers shared across pages

//90 -> "1 hr 30 min". Returns null when there's no value
export function formatMinutes(minutes) {

   if (minutes === null || minutes === undefined) return null;

   const hrs = Math.floor(minutes / 60);
   const mins = minutes % 60;

   if (!hrs) return `${mins} min`;
   return mins ? `${hrs} hr ${mins} min` : `${hrs} hr`;
}

//Common kitchen fractions, used to show 1.5 as "1 1/2" instead of "1.500"
const FRACTIONS = [[1/8, '1/8'], [1/4, '1/4'], [1/3, '1/3'], [3/8, '3/8'], [1/2, '1/2'],
                   [5/8, '5/8'], [2/3, '2/3'], [3/4, '3/4'], [7/8, '7/8']];

export function formatQuantity(value) {

   if (value === null || value === undefined) return '';

   const n = Number(value);
   const whole = Math.floor(n);
   const match = FRACTIONS.find(([f]) => Math.abs(n - whole - f) < 0.01);

   if (match) return whole ? `${whole} ${match[1]}` : match[1];

   return String(Number(n.toFixed(3)));   // drops trailing zeros: "2.000" -> "2"
}

//Prep + cook time, or null if neither is set
export function totalMinutes(prepTime, cookTime) {

   if (prepTime === null && cookTime === null) return null;
   return (prepTime ?? 0) + (cookTime ?? 0);
}
