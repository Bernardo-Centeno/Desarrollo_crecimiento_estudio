import { useMemo } from 'react';
import { SUBJECT_TYPES } from '../lib/profiles.js';
import { diffDays, formatLong, todayISO } from '../lib/dates.js';

const KIND_LABEL = {
  estudio: 'Estudio',
  repaso: 'Repaso',
  repaso_general: 'Repaso general',
};

export default function Today({ subjects, planItems, onToggle, onRegenerate, warnings }) {
  const today = todayISO();

  const subjectById = useMemo(() => Object.fromEntries(subjects.map((s) => [s.id, s])), [subjects]);

  const todayItems = planItems.filter((p) => p.date === today);
  const overdue = planItems.filter((p) => p.date < today && !p.done);

  const totalMin = todayItems.reduce((a, p) => a + p.minutes, 0);
  const doneMin = todayItems.filter((p) => p.done).reduce((a, p) => a + p.minutes, 0);
  const progress = totalMin > 0 ? Math.round((doneMin / totalMin) * 100) : 0;

  // Próximos exámenes
  const upcoming = subjects
    .filter((s) => diffDays(today, s.exam_date) >= 0)
    .sort((a, b) => a.exam_date.localeCompare(b.exam_date))
    .slice(0, 3);

  // Técnicas de las materias que se estudian hoy
  const todaySubjectIds = [...new Set(todayItems.map((p) => p.subject_id))];

  return (
    <div className="stack">
      <div>
        <h1>Hoy</h1>
        <p className="muted">{formatLong(today)}</p>
      </div>

      {warnings.length > 0 && (
        <div className="card warn stack">
          {warnings.map((w, i) => (
            <p key={i} className="small">
              ⚠️ {w}
            </p>
          ))}
        </div>
      )}

      {upcoming.length > 0 && (
        <div className="exam-strip">
          {upcoming.map((s) => {
            const d = diffDays(today, s.exam_date);
            return (
              <div className="exam-pill" key={s.id}>
                <strong>{s.name}</strong>
                <span>{d === 0 ? 'es hoy' : d === 1 ? 'mañana' : `en ${d} días`}</span>
              </div>
            );
          })}
        </div>
      )}

      {overdue.length > 0 && (
        <div className="card warn row between">
          <span className="small">
            Tenés {overdue.length} {overdue.length === 1 ? 'tarea atrasada' : 'tareas atrasadas'}.
          </span>
          <button className="btn small" onClick={onRegenerate}>
            Reorganizar plan
          </button>
        </div>
      )}

      {todayItems.length === 0 ? (
        <div className="card center stack">
          <p>
            <strong>No tenés nada planificado para hoy.</strong>
          </p>
          <p className="muted small">
            Puede ser un día libre según tu disponibilidad. Mirá la pestaña Plan para ver lo que viene.
          </p>
        </div>
      ) : (
        <>
          <div className="card stack">
            <div className="row between">
              <span>
                {Math.round(doneMin)} de {totalMin} min
              </span>
              <strong>{progress}%</strong>
            </div>
            <div className="bar">
              <div className="bar-fill" style={{ width: `${progress}%` }} />
            </div>
          </div>

          <div className="stack">
            {todayItems.map((item) => (
              <PlanRow key={item.id} item={item} subject={subjectById[item.subject_id]} onToggle={onToggle} />
            ))}
          </div>

          {todaySubjectIds.length > 0 && (
            <div className="stack">
              <h2>Cómo estudiar hoy</h2>
              {todaySubjectIds.map((id) => {
                const subject = subjectById[id];
                if (!subject) return null;
                const profile = SUBJECT_TYPES[subject.type];
                return (
                  <div className="card stack" key={id}>
                    <strong>{subject.name}</strong>
                    {profile.techniques.map((t) => (
                      <div key={t.name}>
                        <div className="technique">{t.name}</div>
                        <p className="muted small">{t.tip}</p>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function PlanRow({ item, subject, onToggle }) {
  return (
    <label className={item.done ? 'plan-row done' : 'plan-row'}>
      <input type="checkbox" checked={item.done} onChange={() => onToggle(item)} />
      <div className="plan-row-body">
        <div className="plan-row-title">{item.title}</div>
        <div className="muted small">
          {subject?.name ?? 'Materia'} · {KIND_LABEL[item.kind]} · {item.minutes} min
        </div>
      </div>
    </label>
  );
}