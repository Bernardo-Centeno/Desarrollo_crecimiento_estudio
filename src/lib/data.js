import { supabase } from '../supabaseClient.js';
import { generatePlan } from './planner.js';
import { todayISO } from './dates.js';

function check(result) {
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

// Supabase devuelve como máximo 1000 filas por consulta: se pide de a páginas
async function fetchAll(build) {
  const pageSize = 1000;
  const rows = [];
  let start = 0;
  for (;;) {
    const page = check(await build().range(start, start + pageSize - 1));
    rows.push(...page);
    if (page.length < pageSize) break;
    start += pageSize;
  }
  return rows;
}

// ---------- Carga de datos ----------

export async function loadProfile(userId) {
  return check(await supabase.from('profiles').select('*').eq('id', userId).maybeSingle());
}

export async function saveProfile(userId, values) {
  return check(
    await supabase.from('profiles').upsert({ id: userId, ...values }).select().single()
  );
}

export async function loadAll(userId) {
  const [subjects, topics, exams, examTopics, planItems] = await Promise.all([
    fetchAll(() =>
      supabase.from('subjects').select('*').eq('user_id', userId).order('created_at').order('id')
    ),
    fetchAll(() =>
      supabase.from('topics').select('*').eq('user_id', userId).order('position').order('id')
    ),
    fetchAll(() =>
      supabase.from('exams').select('*').eq('user_id', userId).order('exam_date').order('id')
    ),
    fetchAll(() =>
      supabase.from('exam_topics').select('*').eq('user_id', userId).order('exam_id').order('topic_id')
    ),
    fetchAll(() =>
      supabase.from('plan_items').select('*').eq('user_id', userId).order('date').order('id')
    ),
  ]);
  return { subjects, topics, exams, examTopics, planItems };
}

// ---------- Materias, temas y exámenes ----------

async function linkTopics(userId, examId, topicIds) {
  if (topicIds.length === 0) return;
  check(
    await supabase
      .from('exam_topics')
      .insert(topicIds.map((id) => ({ exam_id: examId, topic_id: id, user_id: userId })))
  );
}

/**
 * values: { name, type, topicNames, exams: [{ name, exam_date, topicIdx: [índices en topicNames] }] }
 */
export async function addSubject(userId, { name, type, topicNames, exams }) {
  const subject = check(
    await supabase.from('subjects').insert({ user_id: userId, name, type }).select().single()
  );

  let topicRows = [];
  if (topicNames.length > 0) {
    topicRows = check(
      await supabase
        .from('topics')
        .insert(
          topicNames.map((t, i) => ({
            user_id: userId,
            subject_id: subject.id,
            name: t,
            position: i,
          }))
        )
        .select()
    );
    topicRows.sort((a, b) => a.position - b.position);
  }

  for (const ex of exams) {
    const exam = check(
      await supabase
        .from('exams')
        .insert({ user_id: userId, subject_id: subject.id, name: ex.name, exam_date: ex.exam_date })
        .select()
        .single()
    );
    const ids = ex.topicIdx.map((i) => topicRows[i]?.id).filter(Boolean);
    await linkTopics(userId, exam.id, ids);
  }
  return subject;
}

export async function deleteSubject(subjectId) {
  check(await supabase.from('subjects').delete().eq('id', subjectId));
}

/**
 * Agrega temas a una materia y los incluye en los exámenes indicados (examIds).
 */
export async function addTopics(userId, subjectId, startPosition, topicNames, examIds) {
  if (topicNames.length === 0) return;
  const rows = check(
    await supabase
      .from('topics')
      .insert(
        topicNames.map((t, i) => ({
          user_id: userId,
          subject_id: subjectId,
          name: t,
          position: startPosition + i,
        }))
      )
      .select()
  );
  for (const examId of examIds) {
    await linkTopics(
      userId,
      examId,
      rows.map((r) => r.id)
    );
  }
}

export async function deleteTopic(topicId) {
  check(await supabase.from('topics').delete().eq('id', topicId));
}

/**
 * values: { name, exam_date, topicIds }
 */
export async function addExam(userId, subjectId, { name, exam_date, topicIds }) {
  const exam = check(
    await supabase
      .from('exams')
      .insert({ user_id: userId, subject_id: subjectId, name, exam_date })
      .select()
      .single()
  );
  await linkTopics(userId, exam.id, topicIds);
  return exam;
}

export async function updateExam(userId, examId, { name, exam_date, topicIds }) {
  check(await supabase.from('exams').update({ name, exam_date }).eq('id', examId));
  check(await supabase.from('exam_topics').delete().eq('exam_id', examId));
  await linkTopics(userId, examId, topicIds);
}

export async function deleteExam(examId) {
  check(await supabase.from('exams').delete().eq('id', examId));
}

// ---------- Plan ----------

export async function setPlanItemDone(item, done) {
  check(await supabase.from('plan_items').update({ done }).eq('id', item.id));
  // Si es una sesión de estudio, el tema queda marcado como visto
  if (item.kind === 'estudio' && item.topic_id) {
    check(await supabase.from('topics').update({ done }).eq('id', item.topic_id));
  }
}

/**
 * Regenera el plan desde hoy. Conserva lo ya hecho (que además usa como historial
 * para no perder los repasos pendientes) y reemplaza todo lo que quedaba pendiente,
 * incluidas las tareas atrasadas.
 * all: { subjects, topics, exams, examTopics, planItems }
 * Devuelve { warnings }.
 */
export async function regeneratePlan(userId, all, settings) {
  const today = todayISO();

  check(
    await supabase.from('plan_items').delete().eq('user_id', userId).eq('done', false)
  );

  const history = all.planItems.filter((p) => p.done);
  const { items, warnings } = generatePlan(
    all.subjects,
    all.topics,
    all.exams,
    all.examTopics,
    settings,
    { from: today, history }
  );

  if (items.length > 0) {
    const rows = items.map((it) => ({ ...it, user_id: userId }));
    // Inserta de a tandas para no pasarse del tamaño de la consulta
    for (let i = 0; i < rows.length; i += 200) {
      check(await supabase.from('plan_items').insert(rows.slice(i, i + 200)));
    }
  }
  return { warnings };
}