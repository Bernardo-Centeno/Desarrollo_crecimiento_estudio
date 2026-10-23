import { useState } from 'react';
import { SUBJECT_TYPES, TYPE_KEYS, guessType } from '../lib/profiles.js';
import { addDays, todayISO } from '../lib/dates.js';

export function parseTopics(text) {
  return text
    .split('\n')
    .map((l) => l.replace(/^[\s\-*•\d.)]+/, '').trim())
    .filter(Boolean);
}

/**
 * Formulario para cargar una materia.
 * onSubmit recibe { name, type, exam_date, topicNames } y devuelve una promesa.
 */
export default function SubjectForm({ onSubmit, submitLabel = 'Agregar materia', onCancel }) {
  const [name, setName] = useState('');
  const [type, setType] = useState('teoria');
  const [typeTouched, setTypeTouched] = useState(false);
  const [examDate, setExamDate] = useState('');
  const [topicsText, setTopicsText] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  function handleName(value) {
    setName(value);
    if (!typeTouched && value.trim().length > 2) setType(guessType(value));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    const topicNames = parseTopics(topicsText);
    if (!name.trim()) return setError('Ponele un nombre a la materia.');
    if (!examDate) return setError('Elegí la fecha del examen.');
    if (examDate <= todayISO()) return setError('La fecha del examen tiene que ser posterior a hoy.');
    if (topicNames.length === 0) return setError('Cargá al menos un tema (uno por línea).');

    setSaving(true);
    try {
      await onSubmit({ name: name.trim(), type, exam_date: examDate, topicNames });
      setName('');
      setType('teoria');
      setTypeTouched(false);
      setExamDate('');
      setTopicsText('');
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
        Fecha del examen
        <input
          type="date"
          value={examDate}
          min={addDays(todayISO(), 1)}
          onChange={(e) => setExamDate(e.target.value)}
        />
      </label>

      <label>
        Temas (uno por línea)
        <textarea
          rows={6}
          value={topicsText}
          onChange={(e) => setTopicsText(e.target.value)}
          placeholder={'Unidad 1: Introducción\nUnidad 2: Sistema nervioso\nUnidad 3: ...'}
        />
      </label>

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