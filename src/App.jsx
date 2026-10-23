import { useCallback, useEffect, useState } from 'react';
import { supabase, hasSupabaseConfig } from './supabaseClient.js';
import Auth from './components/Auth.jsx';
import Onboarding from './components/Onboarding.jsx';
import Today from './components/Today.jsx';
import Plan from './components/Plan.jsx';
import Subjects from './components/Subjects.jsx';
import Settings from './components/Settings.jsx';
import {
  addSubject,
  addTopics,
  deleteSubject,
  deleteTopic,
  loadAll,
  loadProfile,
  regeneratePlan,
  saveProfile,
  setPlanItemDone,
  updateSubjectExam,
} from './lib/data.js';

const TABS = [
  { id: 'hoy', label: 'Hoy', icon: '🏠' },
  { id: 'plan', label: 'Plan', icon: '📅' },
  { id: 'materias', label: 'Materias', icon: '📖' },
  { id: 'ajustes', label: 'Ajustes', icon: '⚙️' },
];

export default function App() {
  if (!hasSupabaseConfig) return <MissingConfig />;
  return <AuthGate />;
}

function MissingConfig() {
  return (
    <div className="auth-wrap">
      <div className="card auth-card stack">
        <h1 className="logo">📚 Estudio</h1>
        <p className="msg error">Faltan las claves de Supabase.</p>
        <p className="small">
          Creá un archivo <code>.env</code> en la raíz del proyecto con estas dos variables (copiá el
          formato de <code>.env.example</code>):
        </p>
        <pre className="code">
{`VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...`}
        </pre>
        <p className="small muted">Después reiniciá el servidor de desarrollo.</p>
      </div>
    </div>
  );
}

function AuthGate() {
  const [session, setSession] = useState(undefined); // undefined = cargando

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s ?? null));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (session === undefined) return <div className="center-screen">Cargando…</div>;
  if (!session) return <Auth />;
  return <Main key={session.user.id} user={session.user} />;
}

function Main({ user }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [profile, setProfile] = useState(null);
  const [data, setData] = useState({ subjects: [], topics: [], planItems: [] });
  const [tab, setTab] = useState('hoy');
  const [warnings, setWarnings] = useState([]);

  const refresh = useCallback(async () => {
    const all = await loadAll(user.id);
    setData(all);
    return all;
  }, [user.id]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const p = await loadProfile(user.id);
        if (cancelled) return;
        setProfile(p);
        if (p?.onboarded) await refresh();
      } catch (err) {
        if (!cancelled) setError(friendlyError(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user.id, refresh]);

  // Reorganiza el plan con los datos más recientes
  async function rebuild(settings, subjects, topics) {
    const { warnings: w } = await regeneratePlan(user.id, subjects, topics, settings);
    setWarnings(w);
    await refresh();
  }

  async function handleOnboardingFinish({ studying, weekly_hours, study_days, subjects }) {
    for (const s of subjects) {
      await addSubject(user.id, s);
    }
    const saved = await saveProfile(user.id, { studying, weekly_hours, study_days, onboarded: true });
    const all = await refresh();
    setProfile(saved);
    await rebuild(saved, all.subjects, all.topics);
  }

  async function handleToggle(item) {
    const done = !item.done;
    // actualización inmediata en pantalla
    setData((d) => ({
      ...d,
      planItems: d.planItems.map((p) => (p.id === item.id ? { ...p, done } : p)),
      topics:
        item.kind === 'estudio' && item.topic_id
          ? d.topics.map((t) => (t.id === item.topic_id ? { ...t, done } : t))
          : d.topics,
    }));
    try {
      await setPlanItemDone(item, done);
    } catch (err) {
      setError(friendlyError(err));
      await refresh();
    }
  }

  async function handleAddSubject(values) {
    await addSubject(user.id, values);
    const all = await refresh();
    await rebuild(profile, all.subjects, all.topics);
  }

  async function handleDeleteSubject(subject) {
    await deleteSubject(subject.id);
    const all = await refresh();
    await rebuild(profile, all.subjects, all.topics);
  }

  async function handleAddTopics(subject, startPosition, names) {
    await addTopics(user.id, subject.id, startPosition, names);
    const all = await refresh();
    await rebuild(profile, all.subjects, all.topics);
  }

  async function handleDeleteTopic(topic) {
    await deleteTopic(topic.id);
    const all = await refresh();
    await rebuild(profile, all.subjects, all.topics);
  }

  async function handleChangeExam(subject, examDate) {
    await updateSubjectExam(subject.id, examDate);
    const all = await refresh();
    await rebuild(profile, all.subjects, all.topics);
  }

  async function handleSaveSettings(values) {
    const saved = await saveProfile(user.id, { ...values, onboarded: true });
    setProfile(saved);
    await rebuild(saved, data.subjects, data.topics);
  }

  async function handleRegenerate() {
    try {
      await rebuild(profile, data.subjects, data.topics);
    } catch (err) {
      setError(friendlyError(err));
    }
  }

  if (loading) return <div className="center-screen">Cargando…</div>;

  if (error && !profile) {
    return (
      <div className="auth-wrap">
        <div className="card auth-card stack">
          <p className="msg error">{error}</p>
          <button className="btn" onClick={() => supabase.auth.signOut()}>
            Cerrar sesión
          </button>
        </div>
      </div>
    );
  }

  if (!profile?.onboarded) {
    return <Onboarding onFinish={handleOnboardingFinish} />;
  }

  return (
    <div className="shell">
      <main className="page">
        {error && (
          <div className="card warn row between">
            <span className="small">{error}</span>
            <button className="btn small" onClick={() => setError('')}>
              Cerrar
            </button>
          </div>
        )}
        {tab === 'hoy' && (
          <Today
            subjects={data.subjects}
            planItems={data.planItems}
            onToggle={handleToggle}
            onRegenerate={handleRegenerate}
            warnings={warnings}
          />
        )}
        {tab === 'plan' && <Plan subjects={data.subjects} planItems={data.planItems} onToggle={handleToggle} />}
        {tab === 'materias' && (
          <Subjects
            subjects={data.subjects}
            topics={data.topics}
            onAddSubject={handleAddSubject}
            onDeleteSubject={handleDeleteSubject}
            onAddTopics={handleAddTopics}
            onDeleteTopic={handleDeleteTopic}
            onChangeExam={handleChangeExam}
          />
        )}
        {tab === 'ajustes' && (
          <Settings
            email={user.email}
            profile={profile}
            onSave={handleSaveSettings}
            onSignOut={() => supabase.auth.signOut()}
          />
        )}
      </main>

      <nav className="tabbar">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>
            <span className="tab-icon">{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

function friendlyError(err) {
  const msg = err?.message ?? String(err);
  if (msg.includes('relation') && msg.includes('does not exist')) {
    return 'Faltan crear las tablas en Supabase. Ejecutá el archivo supabase.sql en el SQL Editor.';
  }
  return msg;
}