'use strict';

(function () {
  let state = Store.load();
  let editingId = null;

  const els = {
    list: document.getElementById('habit-list'),
    balance: document.getElementById('balance'),
    addBtn: document.getElementById('add-habit'),
    exportBtn: document.getElementById('export'),
    modal: document.getElementById('habit-modal'),
    modalTitle: document.getElementById('modal-title'),
    titleInput: document.getElementById('habit-title'),
    pointsInput: document.getElementById('habit-points'),
    badInput: document.getElementById('habit-bad'),
    unitInput: document.getElementById('habit-unit'),
    timesInput: document.getElementById('habit-times'),
    timesLabel: document.getElementById('times-label'),
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
  const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

  const DEMO = [
    { title: 'Вода', points: 1 },
    { title: 'Чтение 30 мин', points: 2, levels: [{ name: 'Читатель', streak: 7 }, { name: 'Книжный червь', streak: 30 }] },
    { title: 'Зал', points: 3, unit: 'weekly', timesPerWeek: 3 },
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
    renderList();
    renderCalendar();
  }

  function renderBalance() {
    els.balance.textContent = 'Баллы: ' + totalPoints(visibleHabits(), state.completions);
  }

  function renderList() {
    const list = visibleHabits();
    els.list.innerHTML = '';
    if (list.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'empty';
      empty.textContent = 'Нет привычек. Добавьте новую.';
      els.list.appendChild(empty);
      return;
    }
    const t = today();
    list.forEach(function (habit, i) {
      const dates = state.completions[habit.id] || [];
      const done = includesDate(dates, t);
      const row = document.createElement('div');
      row.className = 'habit-row' + (habit.bad ? ' bad' : '');

      const chk = document.createElement('input');
      chk.type = 'checkbox';
      chk.className = 'habit-check';
      chk.checked = done;
      chk.addEventListener('change', function () {
        Store.toggle(state, habit.id, t);
        Store.save(state);
        rerender();
      });

      const info = document.createElement('div');
      info.className = 'habit-info';

      const titleRow = document.createElement('div');
      titleRow.className = 'habit-title-row';

      const title = document.createElement('div');
      title.className = 'habit-title';
      title.textContent = habit.title;

      titleRow.appendChild(title);

      if (habit.levels && habit.levels.length) {
        const lv = levelFor(habit, streakForHabit(habit, dates, t));
        const badge = document.createElement('span');
        badge.className = 'level-badge';
        badge.textContent = lv ? lv.name : 'Без уровня';
        badge.title = 'Текущий уровень';
        titleRow.appendChild(badge);
      }

      const todayCount = includesDate(dates, t);
      let metaText =
        'Отметок: ' + countDates(dates) +
        ' · Серия: ' + streakForHabit(habit, dates, t);

      if (habit.unit === 'weekly') {
        metaText += ' (7дн: ' + countLast7(dates, t) + '/' + habit.timesPerWeek + ')';
      }

      metaText += ' · Баллы: ' + pointsForHabit(habit, dates);

      const meta = document.createElement('div');
      meta.className = 'habit-meta';
      meta.textContent = metaText;

      info.appendChild(titleRow);
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

      row.appendChild(chk);
      row.appendChild(info);
      row.appendChild(actions);
      els.list.appendChild(row);
    });
  }

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

      const h = visibleHabits();
      const allDone = h.length > 0 && h.every(function (hh) {
        return includesDate(state.completions[hh.id] || [], iso);
      });
      const anyDone = h.some(function (hh) {
        return includesDate(state.completions[hh.id] || [], iso);
      });
      if (allDone) cell.classList.add('done-all');
      else if (anyDone) cell.classList.add('done-part');

      if (iso === today()) cell.classList.add('today');

      cell.title = 'Все: ' + (allDone ? 'да' : 'нет') + ' · Частично: ' + (anyDone ? 'да' : 'нет');

      cell.addEventListener('click', function () {
        openDayDetail(year, month, d, iso);
      });
      els.calRow.appendChild(cell);
    }
  }

  function openDayDetail(year, month, d, iso) {
    const title = d + ' ' + MONTHS[month] + ' ' + year;
    const habits = visibleHabits();
    const body = document.createElement('div');

    habits.forEach(function (habit) {
      const label = document.createElement('label');
      label.className = 'day-habit';

      const chk = document.createElement('input');
      chk.type = 'checkbox';
      chk.checked = includesDate(state.completions[habit.id] || [], iso);
      chk.addEventListener('change', function () {
        Store.toggle(state, habit.id, iso);
        Store.save(state);
      });

      const span = document.createElement('span');
      span.textContent = habit.title;

      label.appendChild(chk);
      label.appendChild(span);
      body.appendChild(label);
    });

    openModal(els.confirmModal, title, body, 'Готово', function (ok) {
      if (ok) rerender();
    });
  }

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
    els.unitInput.value = habit && habit.unit === 'weekly' ? 'weekly' : 'daily';
    els.timesInput.value = habit && habit.unit === 'weekly' ? (habit.timesPerWeek || 1) : 2;
    currentLevels = (habit && habit.levels) ? habit.levels.slice() : [];
    updateUnitVisibility();
    renderLevels();
    els.modal.style.display = 'block';
    els.titleInput.focus();
  }

  function updateUnitVisibility() {
    const weekly = els.unitInput.value === 'weekly';
    els.timesLabel.style.display = weekly ? 'block' : 'none';
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

  els.addBtn.addEventListener('click', function () { openEdit(null); });

  els.badInput.addEventListener('change', function () { renderLevels(); });
  els.unitInput.addEventListener('change', function () { updateUnitVisibility(); renderLevels(); });

  els.saveBtn.addEventListener('click', function () {
    const title = els.titleInput.value.trim();
    if (!title) { els.titleInput.focus(); return; }
    const points = Math.max(0, parseInt(els.pointsInput.value, 10) || 1);
    const bad = els.badInput.value === '1';
    const unit = els.unitInput.value;
    const timesPerWeek = unit === 'weekly' ? (parseInt(els.timesInput.value, 10) || 1) : 1;
    const levels = bad ? [] : collectLevels();
    const data = { title: title, points: points, bad: bad, unit: unit, timesPerWeek: timesPerWeek, levels: levels };
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
    a.download = 'habit-tracker-backup.json';
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
