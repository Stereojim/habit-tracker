'use strict';

const LOCAL_STORAGE_KEY = 'habit-tracker-data';
const PROFILE_REGISTRY_KEY = 'habit-tracker-profiles';
const DATA_VERSION = 1;

function pad2(n) {
  return n < 10 ? '0' + n : '' + n;
}

function today() {
  const d = new Date();
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
}

function dateFromISO(iso) {
  const parts = iso.split('-');
  return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
}

function toISO(d) {
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
}

function shiftDate(dateISO, days) {
  const d = dateFromISO(dateISO);
  d.setDate(d.getDate() + days);
  return toISO(d);
}

function nextDate(prev) {
  return shiftDate(prev, 1);
}

function sortedUnique(dates) {
  const set = new Set(dates);
  return Array.from(set).sort();
}

function includesDate(dates, dateISO) {
  return dates.indexOf(dateISO) !== -1;
}

function toggleCompletion(completions, dateISO) {
  const idx = completions.indexOf(dateISO);
  if (idx === -1) {
    completions.push(dateISO);
  } else {
    completions.splice(idx, 1);
  }
  return sortedUnique(completions);
}

function streakCompletions(completions, todayISO) {
  const set = new Set(completions);
  let count = 0;
  if (set.has(todayISO)) {
    let d = todayISO;
    while (set.has(d)) {
      count++;
      d = shiftDate(d, -1);
    }
  } else {
    let d = shiftDate(todayISO, -1);
    while (set.has(d)) {
      count++;
      d = shiftDate(d, -1);
    }
  }
  return count;
}

function countDates(completions) {
  return completions ? completions.length : 0;
}

function countInWindow(completions, startISO, endISO) {
  let n = 0;
  for (const c of completions) {
    if (c >= startISO && c <= endISO) n++;
  }
  return n;
}

function countLast7(completions, todayISO) {
  return countInWindow(completions, shiftDate(todayISO, -6), todayISO);
}

function weeklyStreak(completions, todayISO, timesPerWeek) {
  const t = timesPerWeek || 1;
  let windowEnd = todayISO;
  if (countLast7(completions, todayISO) < t) {
    windowEnd = shiftDate(todayISO, -7);
  }
  let count = 0;
  let end = windowEnd;
  while (countInWindow(completions, shiftDate(end, -6), end) >= t) {
    count++;
    end = shiftDate(end, -7);
  }
  return count;
}

function streakForHabit(habit, completions, todayISO) {
  if (habit && habit.unit === 'weekly') {
    return weeklyStreak(completions, todayISO, habit.timesPerWeek || 1);
  }
  return streakCompletions(completions, todayISO);
}

function levelFor(habit, streak) {
  const levels = (habit && habit.levels || [])
    .slice()
    .sort(function (a, b) { return a.streak - b.streak; });
  let cur = null;
  for (const lv of levels) {
    if (streak >= lv.streak) cur = lv;
    else break;
  }
  return cur;
}

function pointsForHabit(habit, completions) {
  const n = countDates(completions);
  const sign = habit.bad ? -1 : 1;
  return sign * n * (habit.points || 0);
}

function totalPoints(habits, completions) {
  let total = 0;
  for (const habit of habits) {
    total += pointsForHabit(habit, completions[habit.id] || []);
  }
  return total;
}
