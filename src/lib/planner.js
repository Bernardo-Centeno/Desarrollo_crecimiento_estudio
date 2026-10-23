import { addDays, diffDays, todayISO, weekday } from './dates.js';
import { SUBJECT_TYPES } from './profiles.js';

/**
 * Genera el plan de estudio.
 *
 * subjects: [{ id, name, type, exam_date }]
 * topics:   [{ id, subject_id, name, position, done }]   (se usan solo los pendientes)
 * settings: { weekly_hours, study_days }                 (study_days: 0 = domingo ... 6 = sábado)
 * options:  { from } fecha de inicio (por defecto hoy)
 *
 * Devuelve { items, overloadedMinutes, warnings }
 *   items: [{ subject_id, topic_id, date, kind, title, minutes }]
 */
export function generatePlan(subjects, topics, settings, options = {}) {
  const from = options.from ?? todayISO();
  const studyDays = settings.study_days?.length ? settings.study_days : [1, 2, 3, 4, 5];
  const dailyBudget = Math.max(15, Math.round((Number(settings.weekly_hours) * 60) / studyDays.length));

  const warnings = [];
  const tasks = [];

  const activeSubjects = subjects
    .filter((s) => diffDays(from, s.exam_date) >= 1)
    .sort((a, b) => a.exam_date.localeCompare(b.exam_date));

  for (const subject of activeSubjects) {
    const profile = SUBJECT_TYPES[subject.type] ?? SUBJECT_TYPES.teoria;
    const lastStudyDay = addDays(subject.exam_date, -1);

    // Días disponibles para esta materia (desde hoy hasta la víspera del examen)
    const days = [];
    for (let d = from; d <= lastStudyDay; d = addDays(d, 1)) {
      if (studyDays.includes(weekday(d))) days.push(d);
    }
    if (days.length === 0) {
      warnings.push(`${subject.name}: no hay días de estudio disponibles antes del examen.`);
      continue;
    }

    const pending = topics
      .filter((t) => t.subject_id === subject.id && !t.done)
      .sort((a, b) => a.position - b.position);

    // Repaso general en los últimos 2 días disponibles (si hay suficientes días)
    const tailCount = days.length >= 6 ? 2 : days.length >= 3 ? 1 : 0;
    const studyWindow = tailCount > 0 ? days.slice(0, days.length - tailCount) : days;
    const tailDays = tailCount > 0 ? days.slice(days.length - tailCount) : [];

    if (pending.length > studyWindow.length * 3) {
      warnings.push(`${subject.name}: son muchos temas (${pending.length}) para los días que quedan. Conviene sumar horas o días de estudio.`);
    }

    pending.forEach((topic, i) => {
      const idx = Math.min(studyWindow.length - 1, Math.floor((i * studyWindow.length) / pending.length));
      const date = studyWindow[idx];
      tasks.push({
        subject_id: subject.id,
        topic_id: topic.id,
        date,
        kind: 'estudio',
        title: `Estudiar: ${topic.name}`,
        minutes: profile.studyMinutes,
        exam: subject.exam_date,
      });

      // Repasos espaciados (solo si caen antes del examen)
      for (const offset of profile.reviewOffsets) {
        const target = addDays(date, offset);
        if (target >= subject.exam_date) continue;
        tasks.push({
          subject_id: subject.id,
          topic_id: topic.id,
          date: target,
          kind: 'repaso',
          title: `Repasar: ${topic.name}`,
          minutes: profile.reviewMinutes,
          exam: subject.exam_date,
        });
      }
    });

    tailDays.forEach((date) => {
      tasks.push({
        subject_id: subject.id,
        topic_id: null,
        date,
        kind: 'repaso_general',
        title: `Repaso general de ${subject.name}`,
        minutes: 60,
        exam: subject.exam_date,
      });
    });
  }

  // Prioridad: examen más cercano primero, luego fecha objetivo, estudio antes que repaso
  const kindOrder = { estudio: 0, repaso_general: 1, repaso: 2 };
  tasks.sort(
    (a, b) =>
      a.exam.localeCompare(b.exam) ||
      a.date.localeCompare(b.date) ||
      kindOrder[a.kind] - kindOrder[b.kind]
  );

  // Asignación respetando el presupuesto diario
  const used = {};
  const items = [];
  let overloadedMinutes = 0;

  const fits = (date, minutes) => (used[date] ?? 0) + minutes <= dailyBudget;
  const isStudyDay = (date) => studyDays.includes(weekday(date));

  const studyPlaced = {}; // topic_id -> día en que quedó la sesión de estudio

  for (const task of tasks) {
    const lastDay = addDays(task.exam, -1);
    let placed = null;

    // Un repaso nunca puede ir antes (ni el mismo día) que el estudio de su tema
    let minDay = from;
    if (task.kind === 'repaso' && studyPlaced[task.topic_id]) {
      minDay = addDays(studyPlaced[task.topic_id], 1);
    }
    // El repaso general solo puede ir en los días finales previos al examen
    if (task.kind === 'repaso_general') minDay = task.date;
    if (minDay > lastDay) continue; // no queda lugar antes del examen para este repaso

    const start = task.date < minDay ? minDay : task.date;

    // 1) desde la fecha objetivo hacia adelante
    for (let d = start; d <= lastDay; d = addDays(d, 1)) {
      if (isStudyDay(d) && fits(d, task.minutes)) {
        placed = d;
        break;
      }
    }
    // 2) hacia atrás (sin pasar de minDay)
    if (!placed) {
      for (let d = addDays(start, -1); d >= minDay; d = addDays(d, -1)) {
        if (isStudyDay(d) && fits(d, task.minutes)) {
          placed = d;
          break;
        }
      }
    }
    // 3) si no entra en ningún lado, va al día de estudio menos cargado (el más cercano
    //    a su fecha objetivo si hay empate) y se marca como sobrecarga
    if (!placed) {
      let best = null;
      let bestLoad = Infinity;
      let bestDist = Infinity;
      for (let d = minDay; d <= lastDay; d = addDays(d, 1)) {
        if (!isStudyDay(d)) continue;
        const load = used[d] ?? 0;
        const dist = Math.abs(diffDays(start, d));
        if (load < bestLoad || (load === bestLoad && dist < bestDist)) {
          best = d;
          bestLoad = load;
          bestDist = dist;
        }
      }
      placed = best ?? task.date;
      overloadedMinutes += task.minutes;
    }

    used[placed] = (used[placed] ?? 0) + task.minutes;
    if (task.kind === 'estudio') studyPlaced[task.topic_id] = placed;
    items.push({
      subject_id: task.subject_id,
      topic_id: task.topic_id,
      date: placed,
      kind: task.kind,
      title: task.title,
      minutes: task.minutes,
    });
  }

  if (overloadedMinutes > 0) {
    const hours = Math.round((overloadedMinutes / 60) * 10) / 10;
    warnings.push(`Hay unas ${hours} h que no entran en tu disponibilidad actual. Sumá horas por semana o días de estudio.`);
  }

  items.sort((a, b) => a.date.localeCompare(b.date));
  return { items, overloadedMinutes, warnings };
}