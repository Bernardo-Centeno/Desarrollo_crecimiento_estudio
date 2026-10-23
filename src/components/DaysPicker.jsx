import { DIAS_CORTOS } from '../lib/dates.js';

// Orden de la semana para mostrar: lunes a domingo
const ORDER = [1, 2, 3, 4, 5, 6, 0];

export default function DaysPicker({ value, onChange }) {
  function toggle(day) {
    if (value.includes(day)) {
      if (value.length === 1) return; // al menos un día
      onChange(value.filter((d) => d !== day));
    } else {
      onChange([...value, day].sort((a, b) => a - b));
    }
  }

  return (
    <div className="days-picker">
      {ORDER.map((day) => (
        <button
          type="button"
          key={day}
          className={value.includes(day) ? 'chip active' : 'chip'}
          onClick={() => toggle(day)}
        >
          {DIAS_CORTOS[day]}
        </button>
      ))}
    </div>
  );
}