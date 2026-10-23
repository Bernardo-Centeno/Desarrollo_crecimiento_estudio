import { useState } from 'react';
import SubjectForm, { parseTopics } from './SubjectForm.jsx';
import { SUBJECT_TYPES, typeLabel } from '../lib/profiles.js';
import { addDays, diffDays, formatShort, todayISO } from '../lib/dates.js';

export default function Subjects({
  subjects,
  topics,
  onAddSubject,
  onDeleteSubject,
  onAddTopics,
  onDeleteTopic,
  onChangeExam,
}) {
  const [showForm, setShowForm] = useState(false);
  const [openId, setOpenId] = useState(null);

  return (
    <div className="stack">
      <div className="row between">
        <h1>Materias</h1>
        {!showForm && (
          <button className="btn primary small" onClick={() => setShowForm(true)}>
            + Nueva
          </button>
        )}
      </div>

      {showForm && (
        <SubjectForm
          onCancel={() => setShowForm(false)}
          onSubmit={async (values) => {
            await onAddSubject(values);
            setShowForm(false);
          }}
        />
      )}

      {subjects.length === 0 && !showForm && (
        <div className="card center">
          <p className="muted">Todavía no cargaste materias.</p>
        </div>
      )}

      {subjects.map((s) => {
        const subjectTopics = topics.filter((t) => t.subject_id === s.id);
        const doneCount = subjectTopics.filter((t) => t.done).length;
        const days = diffDays(todayISO(), s.exam_date);
        const isOpen = openId === s.id;
        return (
          <div className="card stack" key={s.id}>
            <button className="subject-head" onClick={() => setOpenId(isOpen ? null : s.id)}>
              <div>
                <strong>{s.name}</strong>
                <div className="muted small">
                  {typeLabel(s.type)} · examen {formatShort(s.exam_date)}
                  {days >= 0 ? ` (en ${days} días)` : ' (ya pasó)'}
                </div>
              </div>
              <div className="muted small">
                {doneCount}/{subjectTopics.length} temas
              </div>
            </button>

            {isOpen && (
              <SubjectDetail
                subject={s}
                topics={subjectTopics}
                onDeleteSubject={onDeleteSubject}
                onAddTopics={onAddTopics}
                onDeleteTopic={onDeleteTopic}
                onChangeExam={onChangeExam}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function SubjectDetail({ subject, topics, onDeleteSubject, onAddTopics, onDeleteTopic, onChangeExam }) {
  const [newTopics, setNewTopics] = useState('');
  const [busy, setBusy] = useState(false);
  const profile = SUBJECT_TYPES[subject.type];

  async function addMore() {
    const names = parseTopics(newTopics);
    if (names.length === 0) return;
    setBusy(true);
    try {
      await onAddTopics(subject, topics.length, names);
      setNewTopics('');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      <label>
        Fecha del examen
        <input
          type="date"
          value={subject.exam_date}
          min={addDays(todayISO(), 1)}
          onChange={(e) => e.target.value && onChangeExam(subject, e.target.value)}
        />
      </label>

      <div>
        <span className="label">Técnicas recomendadas</span>
        <ul className="tips">
          {profile.techniques.map((t) => (
            <li key={t.name}>
              <strong>{t.name}:</strong> {t.tip}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <span className="label">Temas</span>
        <ul className="topic-list">
          {topics.map((t) => (
            <li key={t.id} className={t.done ? 'done' : ''}>
              <span>
                {t.done ? '✓ ' : ''}
                {t.name}
              </span>
              <button className="link-btn" onClick={() => onDeleteTopic(t)}>
                Quitar
              </button>
            </li>
          ))}
        </ul>
      </div>

      <label>
        Agregar más temas (uno por línea)
        <textarea rows={3} value={newTopics} onChange={(e) => setNewTopics(e.target.value)} />
      </label>
      <div className="row">
        <button className="btn small" onClick={addMore} disabled={busy || !newTopics.trim()}>
          Agregar temas
        </button>
        <button
          className="btn small danger"
          onClick={() => {
            if (window.confirm(`¿Borrar "${subject.name}" y todo su plan?`)) onDeleteSubject(subject);
          }}
        >
          Borrar materia
        </button>
      </div>
    </div>
  );
}