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
      completions: {},
      plans: {},
      mood: {}
    };
  }

  function migrate(state) {
    if (state && !state.plans) state.plans = {};
    if (state && !state.mood) state.mood = {};
    if (state && Array.isArray(state.habits)) {
      state.habits.forEach(function (h) {
        if (h && h.bad) {
          if (h.penalty == null) h.penalty = 0.9;
          if (h.penaltyAfterStreak == null) h.penaltyAfterStreak = 3;
        }
      });
    }
    return state;
  }

  function profileKey(id) {
    return LOCAL_STORAGE_KEY + '-' + id;
  }

  function listProfiles() {
    try {
      const raw = localStorage.getItem(PROFILE_REGISTRY_KEY);
      const list = raw ? JSON.parse(raw) : null;
      if (Array.isArray(list)) {
        return list.filter(function (p) { return p && p.id; });
      }
    } catch (e) { /* ignore */ }
    return null;
  }

  function currentProfileId() {
    try {
      return localStorage.getItem('habit-tracker-current-profile');
    } catch (e) {
      return null;
    }
  }

  function activeProfile() {
    const id = currentProfileId();
    const list = listProfiles();
    if (id && list) {
      const found = list.find(function (p) { return p.id === id; });
      if (found) return found;
    }
    if (list && list.length) return list[0];
    return null;
  }

  function load() {
    const profile = activeProfile();
    const key = profile ? profileKey(profile.id) : LOCAL_STORAGE_KEY;
    let state;
    try {
      const raw = localStorage.getItem(key);
      state = raw ? JSON.parse(raw) : null;
    } catch (e) {
      state = null;
    }
    if (!state || !Array.isArray(state.habits) || typeof state.completions !== 'object') {
      state = emptyState();
    }
    if (!state.completions) state.completions = {};
    state = migrate(state);
    return state;
  }

  function save(state) {
    const profile = activeProfile();
    const key = profile ? profileKey(profile.id) : LOCAL_STORAGE_KEY;
    localStorage.setItem(key, JSON.stringify(state));
  }

  function saveProfiles(list) {
    localStorage.setItem(PROFILE_REGISTRY_KEY, JSON.stringify(list));
  }

  function createProfile(name) {
    const clean = (name || '').trim() || 'Пользователь';
    const id = newId();
    const list = listProfiles() || [];
    list.push({ id: id, name: clean });
    saveProfiles(list);
    localStorage.setItem('habit-tracker-current-profile', id);
    return id;
  }

  function setCurrentProfile(id) {
    const list = listProfiles();
    if (list && list.some(function (p) { return p.id === id; })) {
      localStorage.setItem('habit-tracker-current-profile', id);
      return true;
    }
    return false;
  }

  function renameProfile(id, name) {
    const list = listProfiles();
    if (!list) return false;
    const p = list.find(function (x) { return x.id === id; });
    if (!p) return false;
    p.name = (name || '').trim() || p.name;
    saveProfiles(list);
    return true;
  }

  function deleteProfile(id) {
    const list = listProfiles();
    if (!list) return false;
    const idx = list.findIndex(function (p) { return p.id === id; });
    if (idx === -1) return false;
    list.splice(idx, 1);
    saveProfiles(list);
    try {
      localStorage.removeItem(profileKey(id));
    } catch (e) { /* ignore */ }
    if (currentProfileId() === id) {
      if (list.length) {
        localStorage.setItem('habit-tracker-current-profile', list[0].id);
      } else {
        try { localStorage.removeItem('habit-tracker-current-profile'); } catch (e) { /* ignore */ }
      }
    }
    return true;
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
      days: habitData.days && habitData.days.length ? habitData.days.slice() : null,
      levels: habitData.levels || [],
      penalty: habitData.penalty != null ? habitData.penalty : 0.9,
      penaltyAfterStreak: habitData.penaltyAfterStreak || 3,
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
    if (patch.days !== undefined) {
      habit.days = patch.days && patch.days.length ? patch.days.slice() : null;
    }
    if (habit.unit === 'daily' && patch.unit === 'daily') {
      habit.timesPerWeek = null;
    }
    if (patch.levels !== undefined) habit.levels = patch.levels || [];
    if (patch.penalty !== undefined) habit.penalty = patch.penalty;
    if (patch.penaltyAfterStreak !== undefined) habit.penaltyAfterStreak = patch.penaltyAfterStreak;
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

  function setMood(state, iso, value) {
    if (value == null) {
      delete state.mood[iso];
    } else {
      state.mood[iso] = value;
    }
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
    setMood: setMood,
    newId: newId,
    listProfiles: listProfiles,
    activeProfile: activeProfile,
    createProfile: createProfile,
    setCurrentProfile: setCurrentProfile,
    renameProfile: renameProfile,
    deleteProfile: deleteProfile
  };
})();
