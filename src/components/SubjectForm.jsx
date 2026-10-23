import { useState } from 'react';
import { SUBJECT_TYPES, TYPE_KEYS, guessType } from '../lib/profiles.js';
import { addDays, todayISO } from '../lib/dates.js';

export function parseTopics(text) {
  return text
    .split('\n')
    .map((l) => l.replace(/^[\s\-*•\d.)]+/, '').trim())
    .filter(Boolean);
}

// Igual que parseTopics pero sin repetidos (sin importar mayúsculas)
function uniqueTopics(text) {
  const seen = new Set();
  const out = [];
  for (const t of parseTopics(text)) {
    const k = t.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(t);
  }
  return out;
}

let nextKey = 1;
function newExam() {
  // selected guarda nombres de temas (solo se usa cuando "all" está apagado)
  return { key: nextKey++, name: '', date: '', all: true, selected: [] };
}

/**
 * Formulario para cargar una materia con sus temas y sus exámenes.
 * onSubmit recibe { name, type, topicNames, exams: [{ name, exam_date, topicIdx }] }
 * y devuelve una promesa.
 */
export default function SubjectForm({ onSubmit, submitLabel = 'Agregar materia', onCancel }) {
  const [name, setName] = useState('');
  const [type, setType] = useState('teoria');
  const [typeTouched, setTypeTouched] = useState(false);
  const [topicsText, setTopicsText] = useState('');
  const [exams, setExams] = useState(() => [newExam()]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const topicNames = uniqueTopics(topicsText);

  function handleName(value) {
    setName(value);
    if (!typeTouched && value.trim().length > 2) setType(guessType(value));
  }

  function updateExam(key, patch) {
    setExams((list) => list.map((e) => (e.key === key ? { ...e, ...patch } : e)));
  }

  function toggleTopic(exam, topicName) {
    const selected = exam.selected.includes(topicName)
      ? exam.selected.filter((n) => n !== topicName)
      : [...exam.selected, topicName];
    updateExam(exam.key, { selected });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!name.trim()) return setError('Ponele un nombre a la materia.');
    if (topicNames.length === 0) return setError('Cargá al menos un tema (uno por línea).');

    const payload = [];
    for (let i = 0; i < exams.length; i++) {
      const ex = exams[i];
      const label = ex.name.trim() || (exams.length === 1 ? 'Examen' : `Examen ${i + 1}`);
      if (!ex.date) return setError(`Elegí la fecha de "${label}".`);
      if (ex.date <= todayISO()) return setError(`La fecha de "${label}" tiene que ser posterior a hoy.`);
      const topicIdx = ex.all
        ? topicNames.map((_, k) => k)
        : topicNames.map((n, k) => (ex.selected.includes(n) ? k : -1)).filter((k) => k >= 0);
      if (topicIdx.length === 0) return setError(`Elegí al menos un tema para "${label}".`);
      payload.push({ name: label, exam_date: ex.date, topicIdx });
    }

    setSaving(true);
    try {
      await onSubmit({ name: name.trim(), type, topicNames, exams: payload });
      setName('');
      setType('teoria');
      setTypeTouched(false);
      setTopicsText('');
      setExams([newExam()]);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="stack card">
      <label>
        Nombre de la materia
        <input
          value={name}
          onChange={(e) => handleName(e.target.value)}
          placeholder="Ej: Anatomía, Contabilidad II, Inglés B2"
        />
      </label>

      <div>
        <span className="label">Tipo de estudio</span>
        <div className="type-grid">
          {TYPE_KEYS.map((key) => (
            <button
              type="button"
              key={key}
              className={type === key ? 'type-option active' : 'type-option'}
              onClick={() => {
                setType(key);
                setTypeTouched(true);
              }}
            >
              <strong>{SUBJECT_TYPES[key].label}</strong>
              <small>{SUBJECT_TYPES[key].examples}</small>
            </button>
          ))}
        </div>
        <p className="muted small">{SUBJECT_TYPES[type].description}</p>
      </div>

      <label>
        Temas de la materia (uno por línea)
        <textarea
          rows={6}
          value={topicsText}
          onChange={(e) => setTopicsText(e.target.value)}
          placeholder={'Unidad 1: Introducción\nUnidad 2: Sistema nervioso\nUnidad 3: ...'}
        />
      </label>

      <div className="stack">
        <span className="label">Exámenes de esta materia</span>
        {exams.map((ex, i) => (
          <div className="exam-box stack" key={ex.key}>
            <div className="row between">
              <strong className="small">Examen {i + 1}</strong>
              {exams.length > 1 && (
                <button
                  type="button"
                  className="link-btn"
                  onClick={() => setExams((list) => list.filter((e) => e.key !== ex.key))}
                >
                  Quitar
                </button>
              )}
            </div>

            <label>
              Nombre
              <input
                value={ex.name}
                onChange={(e) => updateExam(ex.key, { name: e.target.value })}
                placeholder="Ej: 1er parcial, 2do parcial, Final"
              />
            </label>

            <label>
              Fecha
              <input
                type="date"
                value={ex.date}
                min={addDays(todayISO(), 1)}
                onChange={(e) => updateExam(ex.key, { date: e.target.value })}
              />
            </label>

            <label className="check-row">
              <input
                type="checkbox"
                checked={ex.all}
                onChange={(e) => updateExam(ex.key, { all: e.target.checked })}
              />
              <span>Entran todos los temas</span>
            </label>

            {!ex.all &&
              (topicNames.length === 0 ? (
                <p className="muted small">Cargá primero los temas de la materia para poder elegirlos.</p>
              ) : (
                <div className="check-list">
                  {topicNames.map((n) => (
                    <label className="check-row" key={n}>
                      <input
                        type="checkbox"
                        checked={ex.selected.includes(n)}
                        onChange={() => toggleTopic(ex, n)}
                      />
                      <span>{n}</span>
                    </label>
                  ))}
                </div>
              ))}
          </div>
        ))}
        <button type="button" className="btn small" onClick={() => setExams((list) => [...list, newExam()])}>
          + Agregar otro examen
        </button>
      </div>

      {error && <p className="msg error">{error}</p>}
      <div className="row">
        <button className="btn primary" disabled={saving}>
          {saving ? 'Guardando…' : submitLabel}
        </button>
        {onCancel && (
          <button type="button" className="btn" onClick={onCancel}>
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
}