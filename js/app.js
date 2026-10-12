'use strict';

(function () {
  let state = Store.load();
  let editingId = null;
  let currentMode = 'plan';
  let currentDays = [];

  const els = {
    list: document.getElementById('plan-list'),
    todayTitle: document.getElementById('today-title'),
    autoPlan: document.getElementById('auto-plan'),
    planProgress: document.getElementById('plan-progress'),
    dayCircles: document.getElementById('day-circles'),
    moodBlock: document.querySelector('.mood-block'),
    moodPicker: document.getElementById('mood-picker'),
    modeSwitch: document.getElementById('mode-switch'),
    modeLabel: document.getElementById('mode-label'),
    modeLabel2: document.getElementById('mode-label2'),
    balance: document.getElementById('balance'),
    addBtn: document.getElementById('add-habit'),
    addBtn2: document.getElementById('add-habit2'),
    habitList: document.getElementById('habit-list'),
    exportBtn: document.getElementById('export'),
    modal: document.getElementById('habit-modal'),
    modalTitle: document.getElementById('modal-title'),
    titleInput: document.getElementById('habit-title'),
    pointsInput: document.getElementById('habit-points'),
    badInput: document.getElementById('habit-bad'),
    unitInput: document.getElementById('habit-unit'),
    timesInput: document.getElementById('habit-times'),
    timesLabel: document.getElementById('times-label'),
    penaltyBlock: document.getElementById('penalty-block'),
    penaltyInput: document.getElementById('habit-penalty'),
    penaltyStreakInput: document.getElementById('habit-penalty-streak'),
    daysBlock: document.getElementById('days-block'),
    daysPills: document.getElementById('days-pills'),
    levelsBlock: document.getElementById('levels-block'),
    levelsContainer: document.getElementById('levels-container'),
    saveBtn: document.getElementById('save-habit'),
    cancelBtn: document.getElementById('cancel-habit'),
    confirmModal: document.getElementById('confirm-modal'),
    confirmText: document.getElementById('confirm-text'),
    confirmOk: document.getElementById('confirm-ok'),
    confirmCancel: document.getElementById('confirm-cancel'),
    calRow: document.getElementById('calendar-row'),
    monthLabel: document.getElementById('month-label'),
    prevMonth: document.getElementById('prev-month'),
    nextMonth: document.getElementById('next-month'),
    profileBtn: document.getElementById('profile-btn'),
    profileModal: document.getElementById('profile-modal'),
    profileList: document.getElementById('profile-list'),
    profileName: document.getElementById('profile-name'),
    profileAdd: document.getElementById('profile-add'),
    profileClose: document.getElementById('profile-close')
  };

  let pendingDelete = null;
  let pendingDeleteProfile = null;
  let calOffset = 0;
  let currentLevels = [];

  const MONTHS = [
    'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
    'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
  ];
  const DOW_SHORT = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
  const DOW_PILL_ORDER = [1, 2, 3, 4, 5, 6, 0];
  const MOOD = [
    { v: 1, emoji: '😞', label: 'Плохо' },
    { v: 2, emoji: '😕', label: 'Средне' },
    { v: 3, emoji: '😐', label: 'Нормально' },
    { v: 4, emoji: '🙂', label: 'Хорошо' },
    { v: 5, emoji: '😄', label: 'Отлично' }
  ];

  const DEMO = [
    { title: 'Вода', points: 1 },
    { title: 'Чтение 30 мин', points: 2, levels: [{ name: 'Читатель', streak: 7 }, { name: 'Книжный червь', streak: 30 }] },
    { title: 'Зал', points: 3, unit: 'weekly', timesPerWeek: 3, days: [1, 3, 5] },
    { title: 'Чипсы', points: 2, bad: true }
  ];

  function ensureDemo() {
    if (state.habits.length === 0) {
      DEMO.forEach(function (d) {
        Store.addHabit(state, d);
      });
      Store.save(state);
    }
  }

  function ensureProfile() {
    let profiles = Store.listProfiles();
    if (!profiles || profiles.length === 0) {
      const id = Store.createProfile('Пользователь');
      Store.setCurrentProfile(id);
    }
  }

  function reloadProfile() {
    state = Store.load();
    renderProfileList();
    if (els.profileModal.style.display === 'block') {
      els.profileName.value = '';
      els.profileName.focus();
    }
    rerender();
  }

  function renderProfileList() {
    const profiles = Store.listProfiles() || [];
    const active = Store.activeProfile();
    els.profileList.innerHTML = '';
    if (profiles.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'empty';
      empty.textContent = 'Профилей нет.';
      els.profileList.appendChild(empty);
      return;
    }
    profiles.forEach(function (p) {
      const item = document.createElement('div');
      item.className = 'profile-item' + (active && p.id === active.id ? ' active' : '');

      const nameWrap = document.createElement('div');
      nameWrap.className = 'profile-name-wrap';

      const name = document.createElement('span');
      name.className = 'profile-name';
      name.textContent = p.name;
      nameWrap.appendChild(name);

      const nameInput = document.createElement('input');
      nameInput.type = 'text';
      nameInput.className = 'profile-name-input';
      nameInput.value = p.name;
      nameInput.style.display = 'none';
      nameWrap.appendChild(nameInput);

      item.appendChild(nameWrap);

      const selectBtn = document.createElement('button');
      selectBtn.textContent = active && p.id === active.id ? 'Текущий' : 'Открыть';
      selectBtn.disabled = active && p.id === active.id;
      selectBtn.addEventListener('click', function () {
        Store.setCurrentProfile(p.id);
        reloadProfile();
      });
      item.appendChild(selectBtn);

      const renameBtn = document.createElement('button');
      renameBtn.textContent = 'Изм.';
      renameBtn.addEventListener('click', function () {
        name.style.display = 'none';
        nameInput.style.display = 'block';
        nameInput.focus();
        nameInput.select();
      });
      item.appendChild(renameBtn);

      const finishRename = function () {
        const val = nameInput.value.trim();
        if (val && val !== p.name) {
          Store.renameProfile(p.id, val);
        }
        renderProfileList();
      };
      nameInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') finishRename();
        if (e.key === 'Escape') renderProfileList();
      });
      nameInput.addEventListener('blur', finishRename);

      if (!(active && p.id === active.id) || profiles.length > 1) {
        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'Удал.';
        deleteBtn.className = 'danger';
        deleteBtn.addEventListener('click', function () {
          pendingDeleteProfile = p.id;
          openModal(els.confirmModal, 'Удалить профиль?',
            'Удалить профиль «' + p.name + '» и все его данные? Это действие необратимо.',
            'Удалить',
            function (ok) {
              if (ok) {
                Store.deleteProfile(pendingDeleteProfile);
                pendingDeleteProfile = null;
                reloadProfile();
              }
            });
        });
        item.appendChild(deleteBtn);
      }

      els.profileList.appendChild(item);
    });
  }

  function visibleHabits() {
    return state.habits
      .filter(function (h) { return !h.archived; })
      .sort(function (a, b) { return a.sortOrder - b.sortOrder; });
  }

  function allHabitsSorted() {
    return state.habits.slice().sort(function (a, b) { return a.sortOrder - b.sortOrder; });
  }

  function rerender() {
    renderBalance();
    renderToday();
    renderHabitList();
    renderCalendar();
  }

  function renderBalance() {
    els.balance.textContent = 'Баллы: ' + totalPoints(visibleHabits(), state.completions);
  }

  function renderHabitList() {
    const list = visibleHabits();
    els.habitList.innerHTML = '';
    if (list.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'empty';
      empty.textContent = 'Нет привычек. Добавьте новую.';
      els.habitList.appendChild(empty);
      return;
    }
    list.forEach(function (habit) {
      const dates = state.completions[habit.id] || [];
      const row = document.createElement('div');
      row.className = 'habit-row' + (habit.bad ? ' bad' : '');

      const info = document.createElement('div');
      info.className = 'habit-info';

      const titleRow = document.createElement('div');
      titleRow.className = 'habit-title-row';

      const title = document.createElement('div');
      title.className = 'habit-title';
      title.textContent = habit.title;
      titleRow.appendChild(title);

      if (habit.levels && habit.levels.length) {
        const lv = levelFor(habit, streakForHabit(habit, dates, today()));
        const badge = document.createElement('span');
        badge.className = 'level-badge';
        badge.textContent = lv ? lv.name : 'Без уровня';
        titleRow.appendChild(badge);
      }

      info.appendChild(titleRow);

      let metaText;
      if (habit.bad) {
        const st = badStreak(dates, today());
        metaText = 'Серия: ' + st + ' дн.';
        if (habit.penaltyAfterStreak) {
          metaText += ' · штраф с ' + habit.penaltyAfterStreak + ' дн. ×' + (habit.penalty != null ? habit.penalty : 0.9);
        }
        metaText += ' · нарушений: ' + countDates(dates);
      } else {
        metaText = 'Отметок: ' + countDates(dates) + ' · Серия: ' + streakForHabit(habit, dates, today());
        if (habit.unit === 'weekly') {
          metaText += ' (7дн: ' + countLast7(dates, today()) + '/' + habit.timesPerWeek + ')';
          metaText += ' · Дни: ' + (habit.days && habit.days.length ? habit.days.map(function (n) { return DOW_SHORT[n]; }).join(', ') : 'Все');
        }
        metaText += ' · Баллы: ' + pointsForHabit(habit, dates);
      }

      const meta = document.createElement('div');
      meta.className = 'habit-meta';
      meta.textContent = metaText;
      info.appendChild(meta);

      const actions = document.createElement('div');
      actions.className = 'habit-actions';

      function actBtn(label, fn) {
        const b = document.createElement('button');
        b.textContent = label;
        b.addEventListener('click', fn);
        actions.appendChild(b);
      }

      actBtn('↑', function () { move(habit, -1); });
      actBtn('↓', function () { move(habit, 1); });
      actBtn('Изм.', function () { openEdit(habit); });
      actBtn('Архив', function () { archive(habit); });
      actBtn('Удалить', function () { requestDelete(habit); });

      row.appendChild(info);
      row.appendChild(actions);
      els.habitList.appendChild(row);
    });
  }

  // ---- Plan / Fact (план / факт) ----

  function setIsPlanned(habitId, on) {
    const t = today();
    if (!state.plans[t]) state.plans[t] = {};
    state.plans[t][habitId] = !!on;
    Store.save(state);
  }

  function setMode(mode) {
    currentMode = mode;
    els.modeSwitch.checked = mode === 'fact';
    renderToday();
  }

  function renderToday() {
    if (currentMode === 'plan') {
      renderPlan();
    } else {
      renderResult();
    }
    renderCircles();
  }

  function renderCircles() {
    const t = today();
    els.dayCircles.innerHTML = '';
    const pct = planPercent(state, t);
    const r = dayResult(state, t);

    const good = document.createElement('div');
    good.className = 'circle';
    const goodG = document.createElement('div');
    goodG.className = 'circle-ring';
    const goodVal = document.createElement('div');
    goodVal.className = 'circle-val';
    goodVal.textContent = pct != null ? pct + '%' : '–';
    goodG.appendChild(goodVal);
    good.appendChild(goodG);
    const goodLbl = document.createElement('div');
    goodLbl.className = 'circle-label';
    goodLbl.textContent = 'План';
    good.appendChild(goodLbl);
    if (pct != null) {
      goodG.style.background =
        'conic-gradient(var(--primary) ' + pct * 3.6 + 'deg, #eef2f7 0deg)';
    }
    good.title = pct != null
      ? 'Выполнено плана: ' + pct + '% (по очкам)'
      : 'Нет плана на сегодня';

    els.dayCircles.appendChild(good);

    const bad = document.createElement('div');
    bad.className = 'circle';
    const badG = document.createElement('div');
    badG.className = 'circle-ring';
    const badVal = document.createElement('div');
    badVal.className = 'circle-val';
    badVal.textContent = r.mult < 1 ? '×' + r.mult : '✓';
    badG.appendChild(badVal);
    bad.appendChild(badG);
    const badLbl = document.createElement('div');
    badLbl.className = 'circle-label';
    badLbl.textContent = 'Бонус';
    bad.appendChild(badLbl);

    if (r.mult < 1) {
      badG.classList.add('penalized');
      const active = r.penalties.map(function (p) {
        return p.habit.title + ' (серия ' + p.streak + ') ×' + p.penalty;
      }).join(', ');
      bad.title = 'Штраф: ' + active;
    } else {
      badG.classList.add('clean');
      const streaks = badHabits(state).map(function (h) {
        return h.title + ': ' + badStreak(state.completions[h.id], t) + ' дн.';
      });
      bad.title = streaks.length
        ? 'Чисто сегодня. Серии: ' + streaks.join(', ')
        : 'Нет плохих привычек';
    }

    els.dayCircles.appendChild(bad);
  }

  function makeRow(habitId, checked) {
    const habit = Store.getHabit(state, habitId);
    const row = document.createElement('div');
    row.className = 'plan-row' + (habit && habit.bad ? ' bad' : '');

    const chk = document.createElement('input');
    chk.type = 'checkbox';
    chk.className = 'habit-check';
    chk.checked = checked;
    row.appendChild(chk);

    const info = document.createElement('div');
    info.className = 'habit-info';

    const title = document.createElement('div');
    title.className = 'habit-title';
    title.textContent = habit ? habit.title : '?';
    info.appendChild(title);

    if (habit && habit.unit === 'weekly') {
      const meta = document.createElement('div');
      meta.className = 'habit-meta';
      meta.textContent = 'Раз в неделю · ' + (habit.timesPerWeek || 1) + '×';
      info.appendChild(meta);
    }

    row.appendChild(info);
    return { row: row, chk: chk };
  }

  function renderPlan() {
    const t = today();
    const scheduled = scheduledHabits(state, t).filter(function (h) { return !h.bad; })
      .slice().sort(function (a, b) { return a.sortOrder - b.sortOrder; });

    els.todayTitle.textContent = 'План на сегодня';
    els.list.innerHTML = '';

    if (scheduled.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'empty';
      empty.textContent = 'На сегодня нет запланированных привычек.';
      els.list.appendChild(empty);
      els.planProgress.textContent = '';
      els.moodBlock.style.display = 'none';
      return;
    }

    ensurePlan(state, t);

    scheduled.forEach(function (habit) {
      const on = isPlanned(state, t, habit.id);
      const parts = makeRow(habit.id, on);
      parts.chk.addEventListener('change', function () {
        setIsPlanned(habit.id, parts.chk.checked);
        renderToday();
      });
      els.list.appendChild(parts.row);
    });

    const n = planCount(state, t);
    els.planProgress.textContent = 'В плане: ' + n;
    els.moodBlock.style.display = 'none';
  }

  function renderResult() {
    const t = today();
    els.todayTitle.textContent = 'Результат — что сделано';
    els.list.innerHTML = '';

    const todayPlanned = Object.keys(state.plans[t] || {}).filter(function (k) {
      const h = Store.getHabit(state, k);
      return state.plans[t][k] && h && !h.bad;
    }).sort(function (a, b) {
      const ha = Store.getHabit(state, a);
      const hb = Store.getHabit(state, b);
      return (ha ? ha.sortOrder : 0) - (hb ? hb.sortOrder : 0);
    });

    let groups = [];

    if (todayPlanned.length) {
      const wrap = document.createElement('div');
      const head = document.createElement('div');
      head.className = 'fact-head';
      head.textContent = 'Сегодня (по плану)';
      wrap.appendChild(head);
      todayPlanned.forEach(function (hid) {
        const parts = makeRow(hid, includesDate(state.completions[hid] || [], t));
        parts.chk.addEventListener('change', function () {
          Store.toggle(state, hid, t);
          Store.save(state);
          renderToday();
        });
        wrap.appendChild(parts.row);
      });
      groups.push(wrap);
    }

    const y = shiftDate(t, -1);
    const yPlanned = Object.keys(state.plans[y] || {}).filter(function (k) {
      const h = Store.getHabit(state, k);
      return state.plans[y][k] && h && !h.bad;
    }).sort(function (a, b) {
      const ha = Store.getHabit(state, a);
      const hb = Store.getHabit(state, b);
      return (ha ? ha.sortOrder : 0) - (hb ? hb.sortOrder : 0);
    });

    if (yPlanned.length) {
      const wrap = document.createElement('div');
      const head = document.createElement('div');
      head.className = 'fact-head';
      head.textContent = 'Вчера (подтвердить)';
      wrap.appendChild(head);
      yPlanned.forEach(function (hid) {
        const parts = makeRow(hid, includesDate(state.completions[hid] || [], y));
        parts.chk.addEventListener('change', function () {
          Store.toggle(state, hid, y);
          Store.save(state);
          renderToday();
        });
        wrap.appendChild(parts.row);
      });
      groups.push(wrap);
    }

    const badList = badHabits(state).sort(function (a, b) { return a.sortOrder - b.sortOrder; });
    if (badList.length) {
      const wrap = document.createElement('div');
      const head = document.createElement('div');
      head.className = 'fact-head bad-head';
      head.textContent = 'Плохиши (сегодня)';
      wrap.appendChild(head);
      badList.forEach(function (h) {
        const on = includesDate(state.completions[h.id] || [], t);
        const st = badStreak(state.completions[h.id], t);
        const parts = makeRow(h.id, on);
        parts.chk.addEventListener('change', function () {
          Store.toggle(state, h.id, t);
          Store.save(state);
          renderToday();
        });
        const meta = parts.row.querySelector('.habit-meta');
        const sm = document.createElement('div');
        sm.className = 'habit-meta';
        sm.textContent = 'Серия: ' + st + ' дн.' + (h.penaltyAfterStreak ? ' · штраф с ' + h.penaltyAfterStreak + ' дн. ×' + (h.penalty != null ? h.penalty : 0.9) : '');
        if (meta) meta.replaceWith(sm); else parts.row.querySelector('.habit-info').appendChild(sm);
        wrap.appendChild(parts.row);
      });
      groups.push(wrap);
    }

    if (groups.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'empty';
      empty.textContent = 'Нет плана. Переключитесь на «План» и отметьте привычки на сегодня.';
      els.list.appendChild(empty);
    } else {
      groups.forEach(function (g) { els.list.appendChild(g); });
    }

    const pct = planPercent(state, t);
    const doneCount = donePlannedCount(state, t);
    const total = planCount(state, t);
    const r = dayResult(state, t);
    let progress = total
      ? 'Выполнено ' + doneCount + ' из ' + total + (pct != null ? ' · ' + pct + '%' : '')
      : '';
    if (r.mult < 1) {
      progress += ' · ×' + r.mult + ' (штраф)';
    }
    els.planProgress.textContent = progress;

    renderMood();
    els.moodBlock.style.display = 'block';
  }

  function renderMood() {
    const t = today();
    const current = state.mood[t] || null;
    els.moodPicker.innerHTML = '';
    MOOD.forEach(function (m) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'mood-btn' + (current === m.v ? ' on' : '');
      btn.textContent = m.emoji;
      btn.title = m.label;
      btn.addEventListener('click', function () {
        if (state.mood[t] === m.v) {
          Store.setMood(state, t, null);
        } else {
          Store.setMood(state, t, m.v);
        }
        Store.save(state);
        renderMood();
      });
      els.moodPicker.appendChild(btn);
    });
  }

  // ---- Calendar ----

  function renderCalendar() {
    const now = new Date();
    now.setDate(1);
    now.setMonth(now.getMonth() + calOffset);
    const year = now.getFullYear();
    const month = now.getMonth();

    els.monthLabel.textContent = MONTHS[month] + ' ' + year;

    const date = new Date(year, month, 1);
    const firstDow = (date.getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    els.calRow.innerHTML = '';
    for (let i = 0; i < firstDow; i++) {
      const empty = document.createElement('div');
      empty.className = 'cal-day empty';
      els.calRow.appendChild(empty);
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const iso = year + '-' + pad2(month + 1) + '-' + pad2(d);
      const cell = document.createElement('div');
      cell.className = 'cal-day';
      cell.textContent = d;

      const pct = planPercent(state, iso);
      if (pct === 100) {
        cell.classList.add('done-all');
      } else if (pct != null && pct > 0) {
        cell.classList.add('done-part');
      } else if (planCount(state, iso) > 0) {
        cell.classList.add('planned');
      }

      const pTotal = planCount(state, iso);
      const pDone = donePlannedCount(state, iso);
      const r = dayResult(state, iso);
      const mult = r.mult;
      if (mult < 1) {
        const dot = document.createElement('span');
        dot.className = 'cal-bad-dot';
        dot.title = 'Штраф: ×' + mult;
        cell.appendChild(dot);
      }

      const mood = state.mood[iso];
      if (mood) cell.classList.add('mood-' + mood);

      if (iso === today()) cell.classList.add('today');

      let tip = 'План: ' + pTotal + ' · Факт: ' + pDone + (pct != null ? ' · ' + pct + '%' : '');
      if (r.mult < 1) tip += ' · штраф ×' + r.mult;
      if (mood) tip += ' · Настроение: ' + mood + '/5';
      cell.title = tip;

      cell.addEventListener('click', function () {
        openDayDetail(year, month, d, iso);
      });
      els.calRow.appendChild(cell);
    }
  }

  function openDayDetail(year, month, d, iso) {
    const title = d + ' ' + MONTHS[month] + ' ' + year;
    const body = document.createElement('div');

    const pTotal = planCount(state, iso);
    const pDone = donePlannedCount(state, iso);
    const pct = planPercent(state, iso);
    const mood = state.mood[iso];
    const r = dayResult(state, iso);

    const stats = document.createElement('div');
    stats.className = 'day-stats';
    let s = 'План: ' + pTotal + ' · Факт: ' + pDone +
      (pct != null ? ' · ' + pct + '%' : '');
    if (r.mult < 1) {
      s += ' · Баллы: ' + r.points + ' × ' + r.mult + ' = ' + r.total;
    } else {
      s += ' · Баллы: ' + r.points;
    }
    if (mood) s += ' · Настроение: ' + mood + '/5';
    stats.textContent = s;
    body.appendChild(stats);

    if (r.penalties.length) {
      const pen = document.createElement('div');
      pen.className = 'penalty-details';
      pen.textContent = r.penalties.map(function (p) {
        return '«' + p.habit.title + '»: серия ' + p.streak + ' дн. → ×' + p.penalty;
      }).join('; ');
      body.appendChild(pen);
    }

    const goodScheduled = scheduledHabits(state, iso).filter(function (h) {
      return !h.bad;
    }).sort(function (a, b) { return a.sortOrder - b.sortOrder; });

    function checkRow(habit, checked, onChange) {
      const label = document.createElement('label');
      label.className = 'day-habit';
      const chk = document.createElement('input');
      chk.type = 'checkbox';
      chk.checked = checked;
      chk.addEventListener('change', onChange);
      const span = document.createElement('span');
      span.textContent = habit.title;
      if (habit.unit === 'weekly') {
        span.textContent += ' (раз в неделю)';
      }
      label.appendChild(chk);
      label.appendChild(span);
      return label;
    }

    if (goodScheduled.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'empty';
      empty.textContent = 'На этот день нет запланированных привычек. Сначала задайте план на сегодня.';
      body.appendChild(empty);
    } else {
      const noPlan = planCount(state, iso) === 0;

      const planHead = document.createElement('div');
      planHead.className = 'day-section-head';
      planHead.textContent = 'План';
      body.appendChild(planHead);

      if (noPlan) {
        const hint = document.createElement('div');
        hint.className = 'empty no-edge';
        hint.textContent = 'Плана нет — отметьте, что запланировать на этот день.';
        body.appendChild(hint);
      }

      goodScheduled.forEach(function (habit) {
        const on = isPlanned(state, iso, habit.id);
        body.appendChild(checkRow(habit, on, function (e) {
          if (!state.plans[iso]) state.plans[iso] = {};
          state.plans[iso][habit.id] = e.target.checked;
          Store.save(state);
        }));
      });

      const resHead = document.createElement('div');
      resHead.className = 'day-section-head';
      resHead.textContent = 'Результат';
      body.appendChild(resHead);

      const plannedIds = plannedGoodIds(state, iso);
      if (plannedIds.length === 0) {
        const hint = document.createElement('div');
        hint.className = 'empty no-edge';
        hint.textContent = 'Отметьте план выше — здесь появится список для проставления результата.';
        body.appendChild(hint);
      }
      plannedIds.forEach(function (hid) {
        const habit = Store.getHabit(state, hid);
        if (!habit) return;
        body.appendChild(checkRow(habit, includesDate(state.completions[hid] || [], iso), function (e) {
          Store.toggle(state, hid, iso);
          Store.save(state);
        }));
      });

      const badOnDay = badHabits(state).sort(function (a, b) { return a.sortOrder - b.sortOrder; });
      if (badOnDay.length) {
        const badHead = document.createElement('div');
        badHead.className = 'day-section-head bad-head';
        badHead.textContent = 'Плохиши (нарушения)';
        body.appendChild(badHead);
        badOnDay.forEach(function (habit) {
          body.appendChild(checkRow(habit, includesDate(state.completions[habit.id] || [], iso), function () {
            Store.toggle(state, habit.id, iso);
            Store.save(state);
          }));
        });
      }
    }

    openModal(els.confirmModal, title, body, 'Готово', function (ok) {
      if (ok) rerender();
    });
  }

  // ---- Habit CRUD ----

  function move(habit, dir) {
    const list = allHabitsSorted();
    const idx = list.indexOf(habit);
    const swap = list[idx + dir];
    if (!swap) return;
    const tmp = habit.sortOrder;
    habit.sortOrder = swap.sortOrder;
    swap.sortOrder = tmp;
    Store.save(state);
    rerender();
  }

  function archive(habit) {
    Store.updateHabit(state, habit.id, { archived: true });
    Store.save(state);
    rerender();
  }

  function requestDelete(habit) {
    pendingDelete = habit.id;
    openModal(els.confirmModal, 'Удалить привычку?',
      'Удалить «' + habit.title + '» и все её отметки? Это действие необратимо.',
      'Удалить',
      function (ok) {
        if (ok) {
          Store.removeHabit(state, pendingDelete);
          pendingDelete = null;
          Store.save(state);
          rerender();
        }
      });
  }

  function openEdit(habit) {
    editingId = habit ? habit.id : null;
    els.modalTitle.textContent = habit ? 'Изменить привычку' : 'Новая привычка';
    els.titleInput.value = habit ? habit.title : '';
    els.pointsInput.value = habit ? habit.points : 1;
    els.badInput.value = habit && habit.bad ? '1' : '0';
    els.penaltyInput.value = habit && habit.bad && habit.penalty != null ? habit.penalty : 0.9;
    els.penaltyStreakInput.value = habit && habit.bad && habit.penaltyAfterStreak ? habit.penaltyAfterStreak : 3;
    els.unitInput.value = habit && habit.unit === 'weekly' ? 'weekly' : 'daily';
    els.timesInput.value = habit && habit.unit === 'weekly' ? (habit.timesPerWeek || 1) : 2;
    currentDays = habit && habit.unit === 'weekly' && habit.days && habit.days.length
      ? habit.days.slice()
      : DOW_PILL_ORDER.slice();
    currentLevels = (habit && habit.levels) ? habit.levels.slice() : [];
    updateUnitVisibility();
    updatePenaltyVisibility();
    renderLevels();
    renderDayPills();
    els.modal.style.display = 'block';
    els.titleInput.focus();
  }

  function updateUnitVisibility() {
    const weekly = els.unitInput.value === 'weekly';
    els.timesLabel.style.display = weekly ? 'block' : 'none';
    els.daysBlock.style.display = weekly ? 'block' : 'none';
  }

  function updatePenaltyVisibility() {
    const bad = els.badInput.value === '1';
    els.penaltyBlock.style.display = bad ? 'block' : 'none';
  }

  function renderDayPills() {
    els.daysPills.innerHTML = '';
    DOW_PILL_ORDER.forEach(function (dayNum) {
      const on = currentDays.indexOf(dayNum) !== -1;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'day-pill' + (on ? ' on' : '');
      btn.textContent = DOW_SHORT[dayNum];
      btn.addEventListener('click', function () {
        const idx = currentDays.indexOf(dayNum);
        if (idx === -1) currentDays.push(dayNum);
        else currentDays.splice(idx, 1);
        renderDayPills();
      });
      els.daysPills.appendChild(btn);
    });
  }

  function renderLevels() {
    els.levelsContainer.innerHTML = '';
    els.levelsBlock.style.display = 'block';
    currentLevels.slice().sort(function (a, b) { return a.streak - b.streak; })
      .forEach(function (lv, i) {
        const row = document.createElement('div');
        row.className = 'level-row';

        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.value = lv.name;
        nameInput.placeholder = 'Название';
        nameInput.className = 'level-name';

        const streakInput = document.createElement('input');
        streakInput.type = 'number';
        streakInput.min = '1';
        streakInput.value = lv.streak;
        streakInput.className = 'level-streak';

        const del = document.createElement('button');
        del.type = 'button';
        del.textContent = '×';
        del.className = 'level-del';
        del.addEventListener('click', function () {
          currentLevels.splice(currentLevels.indexOf(lv), 1);
          renderLevels();
        });

        row.appendChild(nameInput);
        row.appendChild(streakInput);
        row.appendChild(del);
        els.levelsContainer.appendChild(row);
      });

    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.textContent = '+ Уровень';
    addBtn.className = 'level-add';
    addBtn.addEventListener('click', function () {
      currentLevels.push({ name: 'Уровень ' + (currentLevels.length + 1), streak: currentLevels.length * 5 + 1 });
      renderLevels();
    });
    els.levelsContainer.appendChild(addBtn);
  }

  function collectLevels() {
    const rows = els.levelsContainer.querySelectorAll('.level-row');
    const out = [];
    rows.forEach(function (row) {
      const name = row.querySelector('.level-name').value.trim();
      const streak = parseInt(row.querySelector('.level-streak').value, 10);
      if (name && streak > 0) {
        out.push({ name: name, streak: streak });
      }
    });
    out.sort(function (a, b) { return a.streak - b.streak; });
    return out;
  }

  function openModal(modal, titleText, bodyContent, okLabel, onDone) {
    modal._onDone = onDone;
    const titleEl = modal.querySelector('.modal-title');
    const bodyEl = modal.querySelector('.modal-body');
    const okBtn = modal.querySelector('.modal-ok');
    if (titleEl) titleEl.textContent = titleText;
    if (bodyEl) {
      bodyEl.innerHTML = '';
      if (typeof bodyContent === 'string') {
        bodyEl.textContent = bodyContent;
      } else if (bodyContent) {
        bodyEl.appendChild(bodyContent);
      }
    }
    if (okBtn) okBtn.textContent = okLabel;
    modal.style.display = 'block';
  }

  function closeModal(modal) {
    modal.style.display = 'none';
    const done = modal._onDone;
    modal._onDone = null;
    return done;
  }

  // ---- Events ----

  els.addBtn.addEventListener('click', function () { openEdit(null); });
  els.addBtn2.addEventListener('click', function () { openEdit(null); });

  els.badInput.addEventListener('change', function () { updatePenaltyVisibility(); renderLevels(); });
  els.unitInput.addEventListener('change', function () { updateUnitVisibility(); renderLevels(); });

  els.modeSwitch.addEventListener('change', function () {
    setMode(els.modeSwitch.checked ? 'fact' : 'plan');
  });

  els.autoPlan.addEventListener('click', function () {
    const t = today();
    if (!state.plans[t]) state.plans[t] = {};
    scheduledHabits(state, t).filter(function (h) { return !h.bad; }).forEach(function (h) {
      state.plans[t][h.id] = true;
    });
    Store.save(state);
    renderToday();
  });

  els.saveBtn.addEventListener('click', function () {
    const title = els.titleInput.value.trim();
    if (!title) { els.titleInput.focus(); return; }
    const points = Math.max(0, parseInt(els.pointsInput.value, 10) || 1);
    const bad = els.badInput.value === '1';
    const unit = els.unitInput.value;
    const timesPerWeek = unit === 'weekly' ? (parseInt(els.timesInput.value, 10) || 1) : 1;
    const levels = bad ? [] : collectLevels();
    const days = unit === 'weekly' && currentDays.length ? currentDays.slice().sort() : null;
    const penalty = bad ? (parseFloat(els.penaltyInput.value) || 0.9) : null;
    const penaltyAfterStreak = bad ? (parseInt(els.penaltyStreakInput.value, 10) || 3) : null;
    const data = { title: title, points: points, bad: bad, unit: unit, timesPerWeek: timesPerWeek, levels: levels, days: days, penalty: penalty, penaltyAfterStreak: penaltyAfterStreak };
    if (editingId) {
      Store.updateHabit(state, editingId, data);
    } else {
      Store.addHabit(state, data);
    }
    editingId = null;
    Store.save(state);
    els.modal.style.display = 'none';
    rerender();
  });

  els.cancelBtn.addEventListener('click', function () {
    els.modal.style.display = 'none';
    editingId = null;
  });

  els.confirmCancel.addEventListener('click', function () {
    const done = closeModal(els.confirmModal);
    if (done) done(false);
  });

  els.confirmOk.addEventListener('click', function () {
    const done = closeModal(els.confirmModal);
    if (done) done(true);
  });

  els.prevMonth.addEventListener('click', function () {
    calOffset--;
    renderCalendar();
  });
  els.nextMonth.addEventListener('click', function () {
    calOffset++;
    renderCalendar();
  });

  els.exportBtn.addEventListener('click', function () {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'whatson-backup.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });

  els.profileBtn.addEventListener('click', function () {
    renderProfileList();
    els.profileName.value = '';
    els.profileModal.style.display = 'block';
    els.profileName.focus();
  });

  els.profileClose.addEventListener('click', function () {
    els.profileModal.style.display = 'none';
  });

  els.profileModal.addEventListener('click', function (e) {
    if (e.target === els.profileModal) els.profileModal.style.display = 'none';
  });

  els.profileAdd.addEventListener('click', function () {
    const name = els.profileName.value.trim();
    Store.createProfile(name);
    reloadProfile();
  });

  els.profileName.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      const name = els.profileName.value.trim();
      Store.createProfile(name);
      reloadProfile();
    }
  });

  ensureProfile();
  ensureDemo();
  setMode('plan');
  rerender();
  registerSW();
})();

function registerSW() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function (e) {
        console.error('SW registration failed', e);
      });
    });
  }
}
