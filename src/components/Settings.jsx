import { useState } from 'react';
import DaysPicker from './DaysPicker.jsx';

export default function Settings({ email, profile, onSave, onSignOut }) {
  const [studying, setStudying] = useState(profile.studying ?? '');
  const [weeklyHours, setWeeklyHours] = useState(Number(profile.weekly_hours));
  const [studyDays, setStudyDays] = useState(profile.study_days);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  async function save() {
    setSaving(true);
    setSaved(false);
    setError('');
    try {
      await onSave({
        studying: studying.trim(),
        weekly_hours: Number(weeklyHours),
        study_days: studyDays,
      });
      setSaved(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="stack">
      <h1>Ajustes</h1>

      <div className="card stack">
        <label>
          ¿Qué estudiás?
          <input value={studying} onChange={(e) => setStudying(e.target.value)} />
        </label>
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
          <span className="label">Días de estudio</span>
          <DaysPicker value={studyDays} onChange={setStudyDays} />
        </div>
        {error && <p className="msg error">{error}</p>}
        {saved && <p className="msg ok">Guardado y plan reorganizado.</p>}
        <button className="btn primary" onClick={save} disabled={saving}>
          {saving ? 'Guardando…' : 'Guardar y reorganizar plan'}
        </button>
      </div>

      <div className="card stack">
        <p className="muted small">Sesión iniciada como {email}</p>
        <button className="btn" onClick={onSignOut}>
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}