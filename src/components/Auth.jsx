import { useState } from 'react';
import { supabase } from '../supabaseClient.js';

export default function Auth() {
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setInfo('');
    setLoading(true);
    try {
      if (mode === 'signup') {
        const { data, error: err } = await supabase.auth.signUp({ email, password });
        if (err) throw err;
        if (!data.session) {
          setInfo('Te enviamos un mail para confirmar la cuenta. Tocá el link y después iniciá sesión.');
          setMode('login');
        }
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw err;
      }
    } catch (err) {
      setError(translateError(err.message));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-wrap">
      <div className="card auth-card">
        <h1 className="logo">📚 Estudio</h1>
        <p className="muted center">Tu plan de estudio personalizado, en la compu y en el celu.</p>

        <div className="tabs-inline">
          <button
            type="button"
            className={mode === 'login' ? 'active' : ''}
            onClick={() => setMode('login')}
          >
            Iniciar sesión
          </button>
          <button
            type="button"
            className={mode === 'signup' ? 'active' : ''}
            onClick={() => setMode('signup')}
          >
            Crear cuenta
          </button>
        </div>

        <form onSubmit={handleSubmit} className="stack">
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </label>
          <label>
            Contraseña
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              minLength={6}
              required
            />
          </label>
          {error && <p className="msg error">{error}</p>}
          {info && <p className="msg ok">{info}</p>}
          <button className="btn primary" disabled={loading}>
            {loading ? 'Un momento…' : mode === 'signup' ? 'Crear cuenta' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}

function translateError(message) {
  const m = message.toLowerCase();
  if (m.includes('invalid login')) return 'Email o contraseña incorrectos.';
  if (m.includes('email not confirmed')) return 'Primero tenés que confirmar el mail que te enviamos.';
  if (m.includes('already registered')) return 'Ese email ya tiene una cuenta. Probá iniciar sesión.';
  if (m.includes('rate limit')) return 'Demasiados intentos seguidos. Esperá un rato y probá de nuevo.';
  if (m.includes('password')) return 'La contraseña tiene que tener al menos 6 caracteres.';
  return message;
}