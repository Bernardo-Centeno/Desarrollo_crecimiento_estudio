import { useMemo } from 'react';
import { PlanRow } from './Today.jsx';
import { relativeLabel, todayISO } from '../lib/dates.js';

export default function Plan({ subjects, planItems, onToggle }) {
  const today = todayISO();
  const subjectById = useMemo(() => Object.fromEntries(subjects.map((s) => [s.id, s])), [subjects]);

  const groups = useMemo(() => {
    const map = new Map();
    planItems
      .filter((p) => p.date >= today)
      .forEach((p) => {
        if (!map.has(p.date)) map.set(p.date, []);
        map.get(p.date).push(p);
      });
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [planItems, today]);

  return (
    <div className="stack">
      <h1>Plan</h1>
      {groups.length === 0 ? (
        <div className="card center">
          <p className="muted">Todavía no hay tareas planificadas. Cargá una materia en la pestaña Materias.</p>
        </div>
      ) : (
        groups.map(([date, items]) => {
          const total = items.reduce((a, p) => a + p.minutes, 0);
          return (
            <section key={date} className="stack">
              <div className="row between day-header">
                <h2>{relativeLabel(date)}</h2>
                <span className="muted small">
                  {Math.round((total / 60) * 10) / 10} h
                </span>
              </div>
              {items.map((item) => (
                <PlanRow key={item.id} item={item} subject={subjectById[item.subject_id]} onToggle={onToggle} />
              ))}
            </section>
          );
        })
      )}
    </div>
  );
}