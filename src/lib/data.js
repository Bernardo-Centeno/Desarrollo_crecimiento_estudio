import { supabase } from '../supabaseClient.js';
import { generatePlan } from './planner.js';
import { todayISO } from './dates.js';

function check(result) {
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

// ---------- Carga de datos ----------

export async function loadProfile(userId) {
  const data = check(await supabase.from('profiles').select('*').eq('id', userId).maybeSingle());
  return data;
}

export async function saveProfile(userId, values) {
  return check(
    await supabase.from('profiles').upsert({ id: userId, ...values }).select().single()
  );
}

export async function loadAll(userId) {
  const [subjects, topics, planItems] = await Promise.all([
    supabase.from('subjects').select('*').eq('user_id', userId).order('exam_date'),
    supabase.from('topics').select('*').eq('user_id', userId).order('position'),
    supabase.from('plan_items').select('*').eq('user_id', userId).order('date'),
  ]);
  return {
    subjects: check(subjects),
    topics: check(topics),
    planItems: check(planItems),
  };
}

// ---------- Materias y temas ----------

export async function addSubject(userId, { name, type, exam_date, topicNames }) {
  const subject = check(
    await supabase
      .from('subjects')
      .insert({ user_id: userId, name, type, exam_date })
      .select()
      .single()
  );
  if (topicNames.length > 0) {
    check(
      await supabase.from('topics').insert(
        topicNames.map((t, i) => ({
          user_id: userId,
          subject_id: subject.id,
          name: t,
          position: i,
        }))
      )
    );
  }
  return subject;
}

export async function addTopics(userId, subjectId, startPosition, topicNames) {
  if (topicNames.length === 0) return;
  check(
    await supabase.from('topics').insert(
      topicNames.map((t, i) => ({
        user_id: userId,
        subject_id: subjectId,
        name: t,
        position: startPosition + i,
      }))
    )
  );
}

export async function updateSubjectExam(subjectId, exam_date) {
  check(await supabase.from('subjects').update({ exam_date }).eq('id', subjectId));
}

export async function deleteSubject(subjectId) {
  check(await supabase.from('subjects').delete().eq('id', subjectId));
}

export async function deleteTopic(topicId) {
  check(await supabase.from('topics').delete().eq('id', topicId));
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
 * Regenera el plan desde hoy. Conserva lo ya hecho y reemplaza lo pendiente.
 * Devuelve { warnings }.
 */
export async function regeneratePlan(userId, subjects, topics, settings) {
  const today = todayISO();

  // Borra lo pendiente de hoy en adelante (lo hecho se conserva como historial)
  check(
    await supabase
      .from('plan_items')
      .delete()
      .eq('user_id', userId)
      .eq('done', false)
      .gte('date', today)
  );

  const { items, warnings } = generatePlan(subjects, topics, settings, { from: today });

  if (items.length > 0) {
    const rows = items.map((it) => ({ ...it, user_id: userId }));
    // Inserta de a tandas para no pasarse del tamaño de la consulta
    for (let i = 0; i < rows.length; i += 200) {
      check(await supabase.from('plan_items').insert(rows.slice(i, i + 200)));
    }
  }
  return { warnings };
}