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

// ---- Plan / fact (план/факт) ----

function getDay(iso) {
  return dateFromISO(iso).getDay();
}

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

function habitById(state, id) {
  return state.habits.find(function (h) { return h.id === id; }) || null;
}

function goodHabits(state) {
  return state.habits.filter(function (h) { return !h.archived && !h.bad; });
}

function badHabits(state) {
  return state.habits.filter(function (h) { return !h.archived && h.bad; });
}

function habitScheduledOn(habit, iso) {
  if (habit.unit !== 'weekly') return true;
  const days = habit.days && habit.days.length ? habit.days : ALL_DAYS;
  return days.indexOf(getDay(iso)) !== -1;
}

function scheduledHabits(state, iso) {
  return state.habits.filter(function (h) {
    return !h.archived && habitScheduledOn(h, iso);
  });
}

function ensurePlan(state, iso) {
  if (!state.plans[iso]) state.plans[iso] = {};
  const plan = state.plans[iso];
  scheduledHabits(state, iso).filter(function (h) { return !h.bad; }).forEach(function (h) {
    if (plan[h.id] === undefined) plan[h.id] = true;
  });
  return plan;
}

function isPlanned(state, iso, habitId) {
  return ensurePlan(state, iso)[habitId] === true;
}

function plannedGoodIds(state, iso) {
  const plan = state.plans[iso] || {};
  return Object.keys(plan).filter(function (k) {
    const h = plan[k] ? habitById(state, k) : null;
    return h && !h.bad && !h.archived;
  });
}

function planCount(state, iso) {
  return plannedGoodIds(state, iso).length;
}

function donePlannedCount(state, iso) {
  return plannedGoodIds(state, iso).filter(function (hid) {
    return (state.completions[hid] || []).indexOf(iso) !== -1;
  }).length;
}

// Результат дня: % по очкам хороших привычек (вредные исключены)
function planPercent(state, iso) {
  const ids = plannedGoodIds(state, iso);
  let total = 0;
  let done = 0;
  ids.forEach(function (hid) {
    const h = habitById(state, hid);
    const pts = h ? (h.points || 1) : 1;
    total += pts;
    if ((state.completions[hid] || []).indexOf(iso) !== -1) done += pts;
  });
  if (!total) return null;
  return Math.round(done / total * 100);
}

// Плохиши: серия не прерывается, пока привычка "сделана" подряд
function badStreak(completions, iso) {
  let n = 0;
  let d = iso;
  const set = new Set(completions || []);
  while (set.has(d)) {
    n++;
    d = shiftDate(d, -1);
  }
  return n;
}

// Какие штрафы активны на дате (серия доросла до порога)
function activePenalties(state, iso) {
  const out = [];
  badHabits(state).forEach(function (h) {
    const streak = badStreak(state.completions[h.id], iso);
    const threshold = h.penaltyAfterStreak || 3;
    if (streak >= threshold) {
      out.push({ habit: h, streak: streak, penalty: h.penalty != null ? h.penalty : 0.9 });
    }
  });
  return out;
}

function goodDayPoints(state, iso) {
  let s = 0;
  goodHabits(state).forEach(function (h) {
    if ((state.completions[h.id] || []).indexOf(iso) !== -1) s += (h.points || 0);
  });
  return s;
}

function dayResult(state, iso) {
  const points = goodDayPoints(state, iso);
  const penalties = activePenalties(state, iso);
  let mult = 1;
  penalties.forEach(function (p) { mult *= p.penalty; });
  const total = Math.round(points * mult * 100) / 100;
  return { points: points, mult: mult, total: total, penalties: penalties };
}
