'use strict';

const Store = (function () {
  function newId() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  function emptyState() {
    return {
      version: DATA_VERSION,
      habits: [],
      completions: {}
    };
  }

  function load() {
    let state;
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
      state = raw ? JSON.parse(raw) : null;
    } catch (e) {
      state = null;
    }
    if (!state || !Array.isArray(state.habits) || typeof state.completions !== 'object') {
      state = emptyState();
    }
    if (!state.completions) state.completions = {};
    return state;
  }

  function save(state) {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state));
  }

  function getHabit(state, id) {
    return state.habits.find(function (h) { return h.id === id; }) || null;
  }

  function addHabit(state, habitData) {
    const habit = {
      id: newId(),
      title: (habitData.title || '').trim(),
      points: habitData.points || 1,
      bad: !!habitData.bad,
      unit: habitData.unit === 'weekly' ? 'weekly' : 'daily',
      timesPerWeek: habitData.unit === 'weekly' ? (habitData.timesPerWeek || 1) : null,
      levels: habitData.levels || [],
      archived: false,
      sortOrder: state.habits.length,
      createdAt: new Date().toISOString()
    };
    state.habits.push(habit);
    state.completions[habit.id] = [];
    return habit;
  }

  function updateHabit(state, id, patch) {
    const habit = getHabit(state, id);
    if (!habit) return false;
    if (patch.title !== undefined) habit.title = patch.title.trim();
    if (patch.points !== undefined) habit.points = patch.points;
    if (patch.archived !== undefined) habit.archived = patch.archived;
    if (patch.bad !== undefined) habit.bad = !!patch.bad;
    if (patch.unit !== undefined) {
      habit.unit = patch.unit === 'weekly' ? 'weekly' : 'daily';
    }
    if (patch.timesPerWeek !== undefined) {
      habit.timesPerWeek = (patch.timesPerWeek || 1);
    }
    if (habit.unit === 'daily' && patch.unit === 'daily') {
      habit.timesPerWeek = null;
    }
    if (patch.levels !== undefined) habit.levels = patch.levels || [];
    return true;
  }

  function replaceHabit(state, habit) {
    state.habits[state.habits.indexOf(habit)] = habit;
  }

  function removeHabit(state, id) {
    state.habits = state.habits.filter(function (h) { return h.id !== id; });
    delete state.completions[id];
  }

  function toggle(state, id, dateISO) {
    if (!state.completions[id]) state.completions[id] = [];
    state.completions[id] = toggleCompletion(state.completions[id], dateISO);
  }

  return {
    load: load,
    save: save,
    getHabit: getHabit,
    addHabit: addHabit,
    updateHabit: updateHabit,
    replaceHabit: replaceHabit,
    removeHabit: removeHabit,
    toggle: toggle,
    newId: newId
  };
})();
