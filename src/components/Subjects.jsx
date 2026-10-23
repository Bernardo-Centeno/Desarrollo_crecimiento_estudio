import { useState } from 'react';
import SubjectForm, { parseTopics } from './SubjectForm.jsx';
import { SUBJECT_TYPES, typeLabel } from '../lib/profiles.js';
import { addDays, diffDays, formatShort, todayISO } from '../lib/dates.js';

export default function Subjects({
  subjects,
  topics,
  exams,
  examTopics,
  onAddSubject,
  onDeleteSubject,
  onAddTopics,
  onDeleteTopic,
  onAddExam,
  onUpdateExam,
  onDeleteExam,
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
        const subjectTopics = topics
          .filter((t) => t.subject_id === s.id)
          .sort((a, b) => a.position - b.position);
        const subjectExams = exams
          .filter((e) => e.subject_id === s.id)
          .sort((a, b) => a.exam_date.localeCompare(b.exam_date));
        const doneCount = subjectTopics.filter((t) => t.done).length;
        const next = subjectExams.find((e) => diffDays(todayISO(), e.exam_date) >= 0);
        const isOpen = openId === s.id;

        let examSummary = 'Sin exámenes';
        if (subjectExams.length > 0) {
          examSummary = `${subjectExams.length} ${subjectExams.length === 1 ? 'examen' : 'exámenes'}`;
          if (next) {
            const d = diffDays(todayISO(), next.exam_date);
            examSummary += ` · próximo: ${next.name} ${formatShort(next.exam_date)} (${
              d === 0 ? 'hoy' : d === 1 ? 'mañana' : `en ${d} días`
            })`;
          } else {
            examSummary += ' · todos pasaron';
          }
        }

        return (
          <div className="card stack" key={s.id}>
            <button className="subject-head" onClick={() => setOpenId(isOpen ? null : s.id)}>
              <div>
                <strong>{s.name}</strong>
                <div className="muted small">
                  {typeLabel(s.type)} · {examSummary}
                </div>
              </div>
              <div className="muted small nowrap">
                {doneCount}/{subjectTopics.length} temas
              </div>
            </button>

            {isOpen && (
              <SubjectDetail
                subject={s}
                topics={subjectTopics}
                exams={subjectExams}
                examTopics={examTopics}
                onDeleteSubject={onDeleteSubject}
                onAddTopics={onAddTopics}
                onDeleteTopic={onDeleteTopic}
                onAddExam={onAddExam}
                onUpdateExam={onUpdateExam}
                onDeleteExam={onDeleteExam}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function SubjectDetail({
  subject,
  topics,
  exams,
  examTopics,
  onDeleteSubject,
  onAddTopics,
  onDeleteTopic,
  onAddExam,
  onUpdateExam,
  onDeleteExam,
}) {
  const [newTopics, setNewTopics] = useState('');
  const [excluded, setExcluded] = useState([]); // exámenes donde NO entran los temas nuevos
  const [showAddExam, setShowAddExam] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const profile = SUBJECT_TYPES[subject.type];

  const linkedIds = (examId) =>
    examTopics.filter((et) => et.exam_id === examId).map((et) => et.topic_id);

  async function addMore() {
    const existing = new Set(topics.map((t) => t.name.toLowerCase()));
    const names = parseTopics(newTopics).filter((n) => !existing.has(n.toLowerCase()));
    if (names.length === 0) {
      setError('No hay temas nuevos para agregar (o ya existen en la materia).');
      return;
    }
    const includeIn = exams.filter((e) => !excluded.includes(e.id)).map((e) => e.id);
    const start = topics.reduce((m, t) => Math.max(m, t.position), -1) + 1;
    setBusy(true);
    setError('');
    try {
      await onAddTopics(subject, start, names, includeIn);
      setNewTopics('');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      <div className="stack">
        <span className="label">Exámenes</span>
        {exams.length === 0 && (
          <p className="muted small">Esta materia no tiene exámenes, así que no entra en el plan. Agregá uno.</p>
        )}
        {exams.map((ex) => {
          const linked = linkedIds(ex.id);
          // Al guardar cambia la clave y el editor se reinicia con los datos nuevos
          const sig = `${ex.id}|${ex.name}|${ex.exam_date}|${[...linked].sort().join(',')}`;
          return (
            <ExamEditor
              key={sig}
              exam={ex}
              topics={topics}
              linked={linked}
              onSave={onUpdateExam}
              onDelete={onDeleteExam}
            />
          );
        })}
        {showAddExam ? (
          <AddExamForm
            topics={topics}
            onCancel={() => setShowAddExam(false)}
            onSubmit={async (values) => {
              await onAddExam(subject, values);
              setShowAddExam(false);
            }}
          />
        ) : (
          <div>
            <button className="btn small" onClick={() => setShowAddExam(true)} disabled={topics.length === 0}>
              + Agregar examen
            </button>
            {topics.length === 0 && <p className="muted small">Primero agregá temas a la materia.</p>}
          </div>
        )}
      </div>

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
          {topics.map((t) => {
            const inExams = exams
              .filter((ex) => examTopics.some((et) => et.exam_id === ex.id && et.topic_id === t.id))
              .map((ex) => ex.name);
            return (
              <li key={t.id} className={t.done ? 'done' : ''}>
                <div>
                  <div>
                    {t.done ? '✓ ' : ''}
                    {t.name}
                  </div>
                  <div className="muted small">
                    {inExams.length > 0 ? `Entra en: ${inExams.join(', ')}` : 'Sin examen: no entra en el plan'}
                  </div>
                </div>
                <button className="link-btn" onClick={() => onDeleteTopic(t)}>
                  Quitar
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="stack">
        <label>
          Agregar más temas (uno por línea)
          <textarea rows={3} value={newTopics} onChange={(e) => setNewTopics(e.target.value)} />
        </label>
        {exams.length > 0 && (
          <div>
            <span className="label">Incluir en estos exámenes</span>
            <div className="check-list">
              {exams.map((ex) => (
                <label className="check-row" key={ex.id}>
                  <input
                    type="checkbox"
                    checked={!excluded.includes(ex.id)}
                    onChange={() =>
                      setExcluded((list) =>
                        list.includes(ex.id) ? list.filter((id) => id !== ex.id) : [...list, ex.id]
                      )
                    }
                  />
                  <span>
                    {ex.name} ({formatShort(ex.exam_date)})
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}
        {error && <p className="msg error">{error}</p>}
        <div className="row">
          <button className="btn small" onClick={addMore} disabled={busy || !newTopics.trim()}>
            {busy ? 'Agregando…' : 'Agregar temas'}
          </button>
          <button
            className="btn small danger"
            onClick={() => {
              if (window.confirm(`¿Borrar "${subject.name}" con todos sus exámenes y su plan?`)) {
                onDeleteSubject(subject);
              }
            }}
          >
            Borrar materia
          </button>
        </div>
      </div>
    </div>
  );
}

function TopicChecklist({ topics, selected, onChange }) {
  function toggle(id) {
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  }
  return (
    <div className="check-list">
      <div className="row">
        <button type="button" className="link-btn plain" onClick={() => onChange(topics.map((t) => t.id))}>
          Todos
        </button>
        <button type="button" className="link-btn plain" onClick={() => onChange([])}>
          Ninguno
        </button>
      </div>
      {topics.map((t) => (
        <label className="check-row" key={t.id}>
          <input type="checkbox" checked={selected.includes(t.id)} onChange={() => toggle(t.id)} />
          <span>{t.name}</span>
        </label>
      ))}
    </div>
  );
}

function ExamEditor({ exam, topics, linked, onSave, onDelete }) {
  const [name, setName] = useState(exam.name);
  const [date, setDate] = useState(exam.exam_date);
  const [selected, setSelected] = useState(linked);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const sameSelection =
    selected.length === linked.length && selected.every((id) => linked.includes(id));
  const dirty = name !== exam.name || date !== exam.exam_date || !sameSelection;
  const days = date ? diffDays(todayISO(), date) : null;

  async function save() {
    setError('');
    if (!name.trim()) return setError('Poné un nombre al examen.');
    if (!date) return setError('Elegí la fecha.');
    if (selected.length === 0) return setError('Elegí al menos un tema.');
    setBusy(true);
    try {
      await onSave(exam, { name: name.trim(), exam_date: date, topicIds: selected });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="exam-box stack">
      <label>
        Nombre
        <input value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label>
        Fecha {days !== null && <span className="muted small">({days >= 0 ? `en ${days} días` : 'ya pasó'})</span>}
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </label>

      <button type="button" className="link-btn plain left" onClick={() => setOpen(!open)}>
        {open ? '▾' : '▸'} Temas del examen: {selected.length} de {topics.length}
      </button>
      {open && <TopicChecklist topics={topics} selected={selected} onChange={setSelected} />}

      {error && <p className="msg error">{error}</p>}
      <div className="row">
        {dirty && (
          <button className="btn small primary" onClick={save} disabled={busy}>
            {busy ? 'Guardando…' : 'Guardar cambios'}
          </button>
        )}
        <button
          className="btn small danger"
          onClick={() => {
            if (window.confirm(`¿Borrar el examen "${exam.name}"?`)) onDelete(exam);
          }}
        >
          Borrar examen
        </button>
      </div>
    </div>
  );
}

function AddExamForm({ topics, onSubmit, onCancel }) {
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [selected, setSelected] = useState(topics.map((t) => t.id));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    setError('');
    if (!name.trim()) return setError('Poné un nombre al examen.');
    if (!date) return setError('Elegí la fecha.');
    if (date <= todayISO()) return setError('La fecha tiene que ser posterior a hoy.');
    if (selected.length === 0) return setError('Elegí al menos un tema.');
    setBusy(true);
    try {
      await onSubmit({ name: name.trim(), exam_date: date, topicIds: selected });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="exam-box stack">
      <strong className="small">Nuevo examen</strong>
      <label>
        Nombre
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: 2do parcial, Final" />
      </label>
      <label>
        Fecha
        <input type="date" value={date} min={addDays(todayISO(), 1)} onChange={(e) => setDate(e.target.value)} />
      </label>
      <div>
        <span className="label">Temas que entran</span>
        <TopicChecklist topics={topics} selected={selected} onChange={setSelected} />
      </div>
      {error && <p className="msg error">{error}</p>}
      <div className="row">
        <button className="btn small primary" onClick={submit} disabled={busy}>
          {busy ? 'Guardando…' : 'Agregar examen'}
        </button>
        <button className="btn small" onClick={onCancel} disabled={busy}>
          Cancelar
        </button>
      </div>
    </div>
  );
}