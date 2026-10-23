import { useState } from 'react';
import DaysPicker from './DaysPicker.jsx';
import SubjectForm from './SubjectForm.jsx';
import { typeLabel } from '../lib/profiles.js';
import { formatShort } from '../lib/dates.js';

/**
 * Asistente inicial en 3 pasos:
 * 1) qué estudia  2) disponibilidad  3) materias
 * onFinish recibe { studying, weekly_hours, study_days, subjects: [...] }
 */
export default function Onboarding({ onFinish }) {
  const [step, setStep] = useState(1);
  const [studying, setStudying] = useState('');
  const [weeklyHours, setWeeklyHours] = useState(10);
  const [studyDays, setStudyDays] = useState([1, 2, 3, 4, 5]);
  const [subjects, setSubjects] = useState([]);
  const [finishing, setFinishing] = useState(false);
  const [error, setError] = useState('');

  async function finish() {
    setError('');
    setFinishing(true);
    try {
      await onFinish({
        studying: studying.trim(),
        weekly_hours: Number(weeklyHours),
        study_days: studyDays,
        subjects,
      });
    } catch (err) {
      setError(err.message);
      setFinishing(false);
    }
  }

  return (
    <div className="page narrow">
      <div className="steps">
        {[1, 2, 3].map((n) => (
          <span key={n} className={n === step ? 'dot active' : n < step ? 'dot done' : 'dot'} />
        ))}
      </div>

      {step === 1 && (
        <div className="stack">
          <h1>¡Hola! Vamos a armar tu plan 👋</h1>
          <p className="muted">Primero contame qué estudiás, así lo adapto a vos.</p>
          <div className="card stack">
            <label>
              ¿Qué estudiás?
              <input
                value={studying}
                onChange={(e) => setStudying(e.target.value)}
                placeholder="Ej: Medicina, Abogacía, Contador, Inglés, concurso docente…"
                autoFocus
              />
            </label>
            <p className="muted small">
              Después cargás tus materias o temas y yo les asigno técnicas de estudio según el tipo de contenido.
            </p>
          </div>
          <button className="btn primary" disabled={!studying.trim()} onClick={() => setStep(2)}>
            Siguiente
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="stack">
          <h1>¿Cuánto tiempo tenés?</h1>
          <p className="muted">Con esto reparto los temas en los días que te quedan.</p>
          <div className="card stack">
            <label>
              Horas de estudio por semana: <strong>{weeklyHours} h</strong>
              <input
                type="range"
                min="2"
                max="50"
                step="1"
                value={weeklyHours}
                onChange={(e) => setWeeklyHours(e.target.value)}
              />
            </label>
            <div>
              <span className="label">Días en los que podés estudiar</span>
              <DaysPicker value={studyDays} onChange={setStudyDays} />
            </div>
          </div>
          <div className="row">
            <button className="btn" onClick={() => setStep(1)}>
              Atrás
            </button>
            <button className="btn primary" onClick={() => setStep(3)}>
              Siguiente
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="stack">
          <h1>Tus materias y exámenes</h1>
          <p className="muted">Cargá una por una. Con una alcanza para arrancar y después sumás más.</p>

          {subjects.length > 0 && (
            <div className="stack">
              {subjects.map((s, i) => (
                <div className="card row between" key={i}>
                  <div>
                    <strong>{s.name}</strong>
                    <div className="muted small">
                      {typeLabel(s.type)} · examen {formatShort(s.exam_date)} · {s.topicNames.length} temas
                    </div>
                  </div>
                  <button
                    className="btn small danger"
                    onClick={() => setSubjects(subjects.filter((_, j) => j !== i))}
                  >
                    Quitar
                  </button>
                </div>
              ))}
            </div>
          )}

          <SubjectForm
            submitLabel={subjects.length === 0 ? 'Agregar materia' : 'Agregar otra materia'}
            onSubmit={async (values) => setSubjects([...subjects, values])}
          />

          {error && <p className="msg error">{error}</p>}
          <div className="row">
            <button className="btn" onClick={() => setStep(2)} disabled={finishing}>
              Atrás
            </button>
            <button
              className="btn primary"
              disabled={subjects.length === 0 || finishing}
              onClick={finish}
            >
              {finishing ? 'Armando tu plan…' : 'Generar mi plan'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}