/* Habit schedules and performance share this calendar-date model. No browser clock is used. */
(() => {
  'use strict';
  const A = window.App;
  const DEFAULT_START = '2026-01-01';
  const weekdayLabels = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const weekdayOrder = [1, 2, 3, 4, 5, 6, 0];
  const today = () => A.TODAY || '2026-10-17';
  function validDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const parsed = new Date(value + 'T12:00:00Z');
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  }
  function addDays(date, count) {
    if (!validDate(date) || !Number.isInteger(count)) return '';
    const parsed = new Date(date + 'T12:00:00Z');
    parsed.setUTCDate(parsed.getUTCDate() + count);
    return parsed.toISOString().slice(0, 10);
  }
  function weekStart(date) {
    if (!validDate(date)) return '';
    return addDays(date, -((new Date(date + 'T12:00:00Z').getUTCDay() + 6) % 7));
  }
  function days(start, end) {
    if (!validDate(start) || !validDate(end) || start > end) return [];
    const dates = [];
    for (let date = start; date <= end; date = addDays(date, 1)) dates.push(date);
    return dates;
  }
  const startDate = h => validDate(h?.startDate) ? h.startDate : DEFAULT_START;
  function normalizeSchedule(h = {}) {
    const cadence = ['daily', 'weekdays', 'weekly_target'].includes(h.cadence) ? h.cadence : 'daily';
    const selected = Array.isArray(h.weekdays) ? h.weekdays : [1, 2, 3, 4, 5];
    const weekdays = weekdayOrder.filter(day => selected.includes(day));
    const value = Number(h.weeklyTarget ?? h.goal);
    const weeklyTarget = Number.isInteger(value) && value >= 1 && value <= 7 ? value : 3;
    return { cadence, weekdays, weeklyTarget };
  }
  function normalizedHistory(h, key, normalize) {
    const snapshots = new Map();
    for (const entry of Array.isArray(h?.[key]) ? h[key] : []) {
      if (entry && validDate(entry.from)) snapshots.set(entry.from, { from: entry.from, ...normalize(entry) });
    }
    return [...snapshots.values()].sort((left, right) => left.from.localeCompare(right.from));
  }
  function scheduleAt(h, date) {
    const history = normalizedHistory(h, 'scheduleHistory', normalizeSchedule);
    let result = { from: startDate(h), ...normalizeSchedule(h) };
    for (const entry of history) if (entry.from <= date) result = entry;
    return result;
  }
  function goal(h) {
    const value = normalizeSchedule(h);
    return value.cadence === 'weekly_target' ? value.weeklyTarget : value.cadence === 'weekdays' ? value.weekdays.length : 7;
  }
  function schedule(h) {
    const value = normalizeSchedule(h);
    if (value.cadence === 'weekly_target') return value.weeklyTarget + (value.weeklyTarget === 1 ? ' vez por semana' : ' vezes por semana');
    if (value.cadence === 'weekdays') return value.weekdays.length ? value.weekdays.map(day => weekdayLabels[day]).join(', ') : 'Escolha os dias';
    return 'Todos os dias';
  }
  function eligible(h, date) {
    if (!h || !validDate(date) || date < startDate(h)) return false;
    const value = scheduleAt(h, date);
    return value.cadence !== 'weekdays' || value.weekdays.includes(new Date(date + 'T12:00:00Z').getUTCDay());
  }
  const normalizeActivity = h => ({ paused: Boolean(h.paused), archived: Boolean(h.archived) });
  function activeOn(h, date) {
    if (!h || !validDate(date) || date < startDate(h)) return false;
    const history = normalizedHistory(h, 'activityHistory', normalizeActivity);
    // Older prototypes did not date pauses. Do not apply today's flag retrospectively.
    let value = date < today() ? { paused: false, archived: false } : normalizeActivity(h);
    for (const entry of history) if (entry.from <= date) value = entry;
    return !value.paused && !value.archived;
  }
  function recorded(h, date) {
    if (!h || !validDate(date) || date > today() || date < startDate(h) || !(h.checked || []).includes(date)) return false;
    return eligible(h, date) || (Array.isArray(h.scheduleExceptions) && h.scheduleExceptions.includes(date));
  }
  function rollup(h, start, end) {
    const groups = new Map();
    let records = 0;
    for (const date of days(start, end)) {
      const done = recorded(h, date);
      if (!done && !(eligible(h, date) && activeOn(h, date))) continue;
      const entry = scheduleAt(h, date);
      // A changed schedule owns its own portion of the calendar week.
      const key = weekStart(date) + ':' + entry.from;
      const group = groups.get(key) || { available: 0, done: 0, target: entry.cadence === 'weekly_target' ? entry.weeklyTarget : 7 };
      group.available += 1;
      if (done) { group.done += 1; records += 1; }
      groups.set(key, group);
    }
    let expected = 0, done = 0;
    for (const group of groups.values()) {
      const target = Math.min(group.target, group.available);
      expected += target;
      done += Math.min(target, group.done);
    }
    return { done, expected, percent: expected ? Math.round(done / expected * 100) : 0, records };
  }
  function period(h, start, end, { through = today() } = {}) {
    if (!validDate(start) || !validDate(end)) return { done: 0, expected: 0, percent: 0, records: 0 };
    const cutoff = validDate(through) && through < today() ? through : today();
    return rollup(h, start, end < cutoff ? end : cutoff);
  }
  function planned(h, start, end) {
    return rollup(h, start, end).expected;
  }
  function dailyTotals(habits, start, end) {
    return days(start, end).map(date => {
      let done = 0, expected = 0;
      if (date <= today()) for (const habit of habits) {
        const checked = recorded(habit, date);
        if (checked) done += 1;
        if (checked || eligible(habit, date) && activeOn(habit, date)) expected += 1;
      }
      return { date, done, expected };
    });
  }
  function setSchedule(h, next, from = today()) {
    if (!validDate(from) || from < startDate(h)) return false;
    const previous = normalizeSchedule(h), replacement = normalizeSchedule(next);
    const comparable = value => JSON.stringify([value.cadence, value.cadence === 'weekdays' ? value.weekdays : [], value.cadence === 'weekly_target' ? value.weeklyTarget : null]);
    const wasRecorded = recorded(h, from);
    if (comparable(previous) !== comparable(replacement)) {
      const history = normalizedHistory(h, 'scheduleHistory', normalizeSchedule);
      if (!history.length) history.push({ from: startDate(h), ...previous });
      h.scheduleHistory = [...history.filter(entry => entry.from !== from), { from, ...replacement }].sort((left, right) => left.from.localeCompare(right.from));
    }
    Object.assign(h, replacement);
    if (wasRecorded && !eligible(h, from)) h.scheduleExceptions = [...new Set([...(h.scheduleExceptions || []), from])];
    return true;
  }
  function setActivity(h, next, from = today()) {
    if (!validDate(from) || from < startDate(h)) return false;
    const previous = normalizeActivity(h), replacement = normalizeActivity({ ...previous, ...next });
    if (previous.paused === replacement.paused && previous.archived === replacement.archived) return false;
    const history = normalizedHistory(h, 'activityHistory', normalizeActivity);
    if (!history.length) {
      history.push({ from: startDate(h), paused: false, archived: false });
      if (previous.paused || previous.archived) history.push({ from: today(), ...previous });
    }
    h.activityHistory = [...history.filter(entry => entry.from !== from), { from, ...replacement }].sort((left, right) => left.from.localeCompare(right.from));
    Object.assign(h, replacement);
    return true;
  }
  A.habitModel = { validDate, addDays, weekStart, days, schedule, scheduleAt, eligible, activeOn, recorded, goal, period, planned, dailyTotals, setSchedule, setActivity };
})();
