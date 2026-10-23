import { addDays, diffDays, todayISO, weekday } from './dates.js';
import { SUBJECT_TYPES } from './profiles.js';

/**
 * Genera el plan de estudio.
 *
 * subjects:   [{ id, name, type }]
 * topics:     [{ id, subject_id, name, position, done }]
 * exams:      [{ id, subject_id, name, exam_date }]
 * examTopics: [{ exam_id, topic_id }]   qué temas entran en cada examen
 * settings:   { weekly_hours, study_days }   (study_days: 0 = domingo ... 6 = sábado)
 * options:    { from, history }
 *   from:    fecha de inicio (por defecto hoy)
 *   history: items del plan ya hechos (sirven para saber cuándo se estudió cada tema
 *            y qué repasos faltan)
 *
 * Reglas principales:
 * - Cada tema se estudia una sola vez, para el primer examen que lo incluye.
 * - Los repasos espaciados van siempre después del estudio y antes del examen.
 * - Cada examen tiene repaso general en sus últimos días.
 *
 * Devuelve { items, overloadedMinutes, warnings }
 *   items: [{ subject_id, topic_id, exam_id, date, kind, title, minutes }]
 */
export function generatePlan(subjects, topics, exams, examTopics, settings, options = {}) {
  const from = options.from ?? todayISO();
  const history = options.history ?? [];
  const studyDays = settings.study_days?.length ? settings.study_days : [1, 2, 3, 4, 5];
  const dailyBudget = Math.max(15, Math.round((Number(settings.weekly_hours) * 60) / studyDays.length));

  const warnings = [];
  const tasks = [];

  const subjectById = Object.fromEntries(subjects.map((s) => [s.id, s]));
  const topicById = Object.fromEntries(topics.map((t) => [t.id, t]));

  // Temas incluidos en cada examen
  const topicIdsByExam = {};
  for (const et of examTopics) {
    if (!topicIdsByExam[et.exam_id]) topicIdsByExam[et.exam_id] = new Set();
    topicIdsByExam[et.exam_id].add(et.topic_id);
  }

  // Lo ya hecho: cuándo se estudió cada tema y cuántos repasos lleva
  const studiedOn = {};
  const reviewsDone = {};
  for (const h of history) {
    if (!h.done || !h.topic_id) continue;
    if (h.kind === 'estudio') studiedOn[h.topic_id] = h.date;
    else if (h.kind === 'repaso') reviewsDone[h.topic_id] = (reviewsDone[h.topic_id] ?? 0) + 1;
  }

  // Materias sin ningún examen cargado
  const subjectsWithExams = new Set(exams.map((e) => e.subject_id));
  for (const s of subjects) {
    if (!subjectsWithExams.has(s.id)) {
      warnings.push(`${s.name}: no tiene exámenes cargados, así que no hay plan para esa materia.`);
    }
  }

  const activeExams = exams
    .filter((e) => subjectById[e.subject_id] && diffDays(from, e.exam_date) >= 1)
    .sort((a, b) => a.exam_date.localeCompare(b.exam_date));

  // Cada tema se estudia para el primer examen (el más cercano) que lo incluye
  const effective = {};
  for (const exam of activeExams) {
    for (const topicId of topicIdsByExam[exam.id] ?? []) {
      if (!effective[topicId]) effective[topicId] = exam.id;
    }
  }

  for (const exam of activeExams) {
    const subject = subjectById[exam.subject_id];
    const profile = SUBJECT_TYPES[subject.type] ?? SUBJECT_TYPES.teoria;
    const label = `${subject.name} – ${exam.name}`;
    const lastStudyDay = addDays(exam.exam_date, -1);

    // Días disponibles para este examen (desde hoy hasta la víspera)
    const days = [];
    for (let d = from; d <= lastStudyDay; d = addDays(d, 1)) {
      if (studyDays.includes(weekday(d))) days.push(d);
    }
    if (days.length === 0) {
      warnings.push(`${label}: no hay días de estudio disponibles antes del examen.`);
      continue;
    }

    const examTopicList = [...(topicIdsByExam[exam.id] ?? [])]
      .map((id) => topicById[id])
      .filter(Boolean)
      .sort((a, b) => a.position - b.position);

    // Temas que se estudian para ESTE examen (los demás ya se cubrieron en uno anterior)
    const mine = examTopicList.filter((t) => effective[t.id] === exam.id);
    const pending = mine.filter((t) => !t.done);
    const alreadyStudied = mine.filter((t) => t.done);

    // Repaso general en los últimos días disponibles (si hay suficientes)
    const tailCount = days.length >= 6 ? 2 : days.length >= 3 ? 1 : 0;
    const studyWindow = tailCount > 0 ? days.slice(0, days.length - tailCount) : days;
    const tailDays = tailCount > 0 ? days.slice(days.length - tailCount) : [];

    if (pending.length > studyWindow.length * 3) {
      warnings.push(`${label}: son muchos temas (${pending.length}) para los días que quedan. Conviene sumar horas o días de estudio.`);
    }

    // Estudio de temas nuevos + sus repasos espaciados
    pending.forEach((topic, i) => {
      const idx = Math.min(studyWindow.length - 1, Math.floor((i * studyWindow.length) / pending.length));
      const date = studyWindow[idx];
      tasks.push({
        subject_id: subject.id,
        topic_id: topic.id,
        exam_id: exam.id,
        date,
        kind: 'estudio',
        title: `Estudiar: ${topic.name}`,
        minutes: profile.studyMinutes,
        examDate: exam.exam_date,
      });

      for (const offset of profile.reviewOffsets) {
        const target = addDays(date, offset);
        if (target >= exam.exam_date) continue;
        tasks.push({
          subject_id: subject.id,
          topic_id: topic.id,
          exam_id: exam.id,
          date: target,
          kind: 'repaso',
          title: `Repasar: ${topic.name}`,
          minutes: profile.reviewMinutes,
          examDate: exam.exam_date,
        });
      }
    });

    // Temas ya estudiados: se conservan los repasos que todavía faltan
    for (const topic of alreadyStudied) {
      const base = studiedOn[topic.id] ?? addDays(from, -1);
      const already = reviewsDone[topic.id] ?? 0;
      const seen = new Set();
      profile.reviewOffsets.slice(already).forEach((offset) => {
        let target = addDays(base, offset);
        if (target < from) target = from; // repaso atrasado: pasa a hoy
        if (seen.has(target)) return; // varios atrasados se juntan en uno solo
        seen.add(target);
        if (target > lastStudyDay) return;
        tasks.push({
          subject_id: subject.id,
          topic_id: topic.id,
          exam_id: exam.id,
          date: target,
          kind: 'repaso',
          title: `Repasar: ${topic.name}`,
          minutes: profile.reviewMinutes,
          examDate: exam.exam_date,
        });
      });
    }

    // Repaso general: más largo cuanto más temas incluye el examen
    const generalMinutes = Math.min(120, 45 + 5 * examTopicList.length);
    tailDays.forEach((date) => {
      tasks.push({
        subject_id: subject.id,
        topic_id: null,
        exam_id: exam.id,
        date,
        kind: 'repaso_general',
        title: `Repaso general: ${label}`,
        minutes: generalMinutes,
        examDate: exam.exam_date,
      });
    });
  }

  // Prioridad: examen más cercano primero, luego fecha objetivo, estudio antes que repaso
  const kindOrder = { estudio: 0, repaso_general: 1, repaso: 2 };
  tasks.sort(
    (a, b) =>
      a.examDate.localeCompare(b.examDate) ||
      a.date.localeCompare(b.date) ||
      kindOrder[a.kind] - kindOrder[b.kind]
  );

  // Asignación respetando el presupuesto diario
  const used = {};
  const items = [];
  let overloadedMinutes = 0;
  const studyPlaced = {}; // topic_id -> día en que quedó la sesión de estudio

  const fits = (date, minutes) => (used[date] ?? 0) + minutes <= dailyBudget;
  const isStudyDay = (date) => studyDays.includes(weekday(date));

  for (const task of tasks) {
    const lastDay = addDays(task.examDate, -1);
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
      exam_id: task.exam_id,
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