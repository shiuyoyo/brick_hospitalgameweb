import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from './sharedSupabaseClient';
import LiveGameBoard from './LiveGameBoard';
import './UnifiedApp.css';

const API = 'https://healthy-system-nu.vercel.app/api/auth/patient-login';
const randomCode = () => {
  const values = new Uint32Array(1);
  window.crypto.getRandomValues(values);
  return String(values[0] % 900000 + 100000);
};

function Brand() {
  return <div className="brand"><span className="brand-mark">✦</span><span><strong>HEALTHY SYSTEM</strong><small>積木復健・醫病連線</small></span></div>;
}

function Login({ onSignedIn }) {
  const [account, setAccount] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (account.includes('@')) {
        const { data, error: authError } = await supabase.auth.signInWithPassword({ email: account.trim(), password });
        if (authError || !data.user) throw new Error('帳號或密碼錯誤');
        onSignedIn(data.user);
      } else {
        const response = await fetch(API, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nationalId: account.trim().toUpperCase(), password }),
        });
        if (!response.ok) throw new Error('身分證字號或密碼錯誤');
        const session = await response.json();
        const { data, error: sessionError } = await supabase.auth.setSession({
          access_token: session.access_token, refresh_token: session.refresh_token,
        });
        if (sessionError || !data.user) throw new Error('無法建立登入狀態');
        onSignedIn(data.user);
      }
    } catch (cause) { setError(cause.message || '登入失敗，請稍後再試'); }
    finally { setBusy(false); }
  }

  return <main className="login-shell"><div className="login-art"><Brand /><div className="orb" aria-hidden="true">▣</div><h1>讓每一步練習<br />都看得見進步。</h1><p>病人與醫師同步練習、即時掌握積木任務表現。</p></div><form className="login-card" onSubmit={submit}><span className="eyebrow">WELCOME BACK</span><h2>登入積木復健</h2><p>病人使用身分證字號；醫師使用 Healthy-System Email。</p><label>帳號<input autoComplete="username" value={account} onChange={event => setAccount(event.target.value)} placeholder="身分證字號或 Email" required /></label><label>密碼<input type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} required /></label>{error && <div className="error" role="alert">{error}</div>}<button className="primary" disabled={busy}>{busy ? '登入中…' : '登入'}</button><a href="https://healthy-system-nu.vercel.app/forgot-password">忘記密碼？</a><small>新病人請由 Healthy-System 管理員建檔；醫師帳號由管理員開通。</small></form></main>;
}

function PatientHome({ profile }) {
  const [account, setAccount] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [runs, setRuns] = useState([]);
  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase.rpc('breathing_my_account');
      const patient = data?.[0];
      if (!active || !patient) return;
      setAccount(patient);
      const { data: recent } = await supabase.from('brick_game_sessions')
        .select('id,status,current_game_key,created_at')
        .eq('participant_id', patient.participant_id).order('created_at', { ascending: false }).limit(8);
      if (active) setSessions(recent || []);
      const { data: trainingRuns } = await supabase.from('brick_training_runs')
        .select('id,game_key,level_name,started_at,status,correct_count,wrong_count,missed_count')
        .eq('participant_id', patient.participant_id).order('started_at', { ascending: false }).limit(8);
      if (active) setRuns(trainingRuns || []);
    })();
    return () => { active = false; };
  }, []);
  return <div className="content"><div className="welcome"><span className="eyebrow">PATIENT HOME</span><h1>你好，{account?.display_name || profile.full_name || '使用者'}</h1><p>今天也一起練習。醫師建立配對碼後，請在積木 App 輸入代碼。</p></div><div className="grid-two"><section className="panel"><h2>我的帳號</h2><p>身分證：{account?.masked_id || '尚未綁定'}</p><p>與呼吸訓練、五十肩使用同一組 Healthy-System 帳號。</p></section><section className="panel"><h2>最近訓練</h2>{runs.length ? runs.map(item => <div className="session-row" key={item.id}><span>{item.level_name || item.game_key}</span><span>{item.status === 'completed' ? '已完成' : '進行中'} · 正確 {item.correct_count} / 錯誤 {item.wrong_count}</span><time>{new Date(item.started_at).toLocaleString('zh-TW')}</time></div>) : <p>目前沒有已上傳的積木訓練。</p>}<h2>最近連線</h2>{sessions.length ? sessions.map(item => <div className="session-row" key={item.id}><span>{item.current_game_key || '等待遊戲'}</span><span>{item.status}</span><time>{new Date(item.created_at).toLocaleDateString('zh-TW')}</time></div>) : <p>目前沒有積木連線紀錄。</p>}</section></div></div>;
}

function DoctorHome({ user, profile }) {
  const [patients, setPatients] = useState([]);
  const [selected, setSelected] = useState(null);
  const [session, setSession] = useState(null);
  const [actions, setActions] = useState([]);
  const [shoulder, setShoulder] = useState([]);
  const [runs, setRuns] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (['admin', 'supervisor', 'doctor_all'].includes(profile.role)) {
        const { data, error: loadError } = await supabase.from('participants').select('id,name,participant_code').order('name');
        if (active) { setPatients(data || []); if (loadError) setError('無法讀取病人清單'); }
      } else {
        const { data, error: loadError } = await supabase.from('patient_assignments')
          .select('participant_id,participants(id,name,participant_code)').eq('user_id', user.id);
        if (active) { setPatients((data || []).map(row => row.participants).filter(Boolean)); if (loadError) setError('無法讀取病人清單'); }
      }
    })();
    return () => { active = false; };
  }, [profile.role, user.id]);

  useEffect(() => {
    setSession(null);
    setActions([]);
    setShoulder([]);
    setRuns([]);
    if (!selected) return;
    let active = true;
    supabase.from('shoulder_training_entries').select('id,movement_no,created_at,completed_reps,target_reps,pain_score')
      .eq('participant_id', selected.id).order('created_at', { ascending: false }).limit(5)
      .then(({ data }) => { if (active) setShoulder(data || []); });
    supabase.from('brick_training_runs').select('id,game_key,level_name,started_at,status,correct_count,wrong_count,missed_count')
      .eq('participant_id', selected.id).order('started_at', { ascending: false }).limit(8)
      .then(({ data }) => { if (active) setRuns(data || []); });
    supabase.from('brick_game_sessions').select('id,code,status,current_game_key,created_at')
      .eq('participant_id', selected.id).in('status', ['waiting', 'connected', 'playing'])
      .order('created_at', { ascending: false }).limit(1)
      .then(({ data }) => { if (active && data?.[0]) setSession(data[0]); });
    return () => { active = false; };
  }, [selected]);

  const loadActions = useCallback(async sessionId => {
    const { data } = await supabase.from('brick_game_actions')
      .select('id,game_key,level_name,action_type,created_at')
      .eq('session_id', sessionId).order('created_at', { ascending: false }).limit(50);
    setActions(data || []);
  }, []);

  useEffect(() => {
    if (!session?.id) return;
    loadActions(session.id);
    const channel = supabase.channel(`brick-${session.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'brick_game_actions', filter: `session_id=eq.${session.id}` }, payload =>
        setActions(previous => [payload.new, ...previous].slice(0, 50)))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'brick_game_sessions', filter: `id=eq.${session.id}` }, payload =>
        setSession(previous => ({ ...previous, ...payload.new })))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [session?.id, loadActions]);

  async function createSession() {
    if (!selected) return;
    setBusy(true); setError('');
    try {
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const { data, error: createError } = await supabase.from('brick_game_sessions')
          .insert({ participant_id: selected.id, doctor_id: user.id, code: randomCode() })
          .select('id,code,status,current_game_key,created_at').single();
        if (!createError && data) { setSession(data); setActions([]); return; }
      }
      setError('無法建立配對碼，請確認你已被指派照護這位病人。');
    } finally { setBusy(false); }
  }

  const correct = actions.filter(action => action.action_type === 'tap_correct').length;
  const wrong = actions.filter(action => action.action_type === 'tap_wrong').length;
  const missed = actions.filter(action => action.action_type === 'auto_miss').length;
  return <div className="content"><div className="welcome"><span className="eyebrow">CLINICIAN WORKSPACE</span><h1>病人練習總覽</h1><p>選擇病人、產生連線碼，並即時查看積木練習表現。</p></div>{error && <div className="error" role="alert">{error}</div>}<div className="doctor-layout"><section className="panel patient-list"><h2>我的病人 <small>{patients.length} 位</small></h2>{patients.length ? patients.map(patient => <button key={patient.id} className={`patient-choice ${selected?.id === patient.id ? 'active' : ''}`} onClick={() => setSelected(patient)}><span>{patient.name || '未命名病人'}</span><small>{patient.participant_code}</small></button>) : <p>目前沒有被指派的病人。</p>}</section><div className="detail-stack">{selected ? <><section className="panel hero-panel"><div><span className="eyebrow">SELECTED PATIENT</span><h2>{selected.name || '未命名病人'}</h2><p>{selected.participant_code}</p></div>{profile.role === 'doctor_all' ? <span className="eyebrow">全病人唯讀帳號；配對請使用受指派醫師帳號</span> : <button className="primary" onClick={createSession} disabled={busy}>{busy ? '建立中…' : '建立配對碼'}</button>}</section><div className="grid-two"><section className="panel"><h2>即時連線</h2>{session ? <><div className="pair-code">{session.code}</div><p>狀態：{session.status}　關卡：{session.current_game_key || '尚未開始'}</p><div className="metric-row"><span>正確 <strong>{correct}</strong></span><span>錯誤 <strong>{wrong}</strong></span><span>逾時 <strong>{missed}</strong></span></div></> : <p>按「建立配對碼」後，請病人在 App 輸入六位數代碼。</p>}</section><section className="panel"><h2>五十肩近期表現</h2>{shoulder.length ? shoulder.map(item => <div className="session-row" key={item.id}><time>{new Date(item.created_at).toLocaleDateString('zh-TW')}</time><span>動作 {item.movement_no}　{item.completed_reps}/{item.target_reps} 下</span><strong>疼痛 {item.pain_score ?? '未填'}</strong></div>) : <p>目前尚無可顯示的五十肩訓練結果。</p>}</section></div><section className="panel"><h2>最近積木訓練</h2>{runs.length ? runs.map(run => <div className="session-row" key={run.id}><time>{new Date(run.started_at).toLocaleString('zh-TW')}</time><span>{run.level_name || run.game_key} · {run.status === 'completed' ? '已完成' : '進行中'}</span><strong>正確 {run.correct_count} / 錯誤 {run.wrong_count} / 逾時 {run.missed_count}</strong></div>) : <p>目前沒有已上傳的積木訓練。</p>}</section><section className="panel"><h2>同步遊戲畫面</h2><LiveGameBoard action={actions[0]} status={session?.status} /></section><section className="panel"><h2>即時事件</h2>{actions.length ? actions.map(action => <div className="session-row" key={action.id}><time>{new Date(action.created_at).toLocaleTimeString('zh-TW')}</time><span>{action.game_key}／{action.level_name || '練習'}</span><strong>{action.action_type}</strong></div>) : <p>等待 App 傳入練習事件。</p>}</section></> : <section className="panel empty-state">請先從左側選擇一位病人。</section>}</div></div></div>;
}

export default function UnifiedApp() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(({ data }) => { if (active) { setUser(data.user || null); setLoading(false); } });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) { setUser(session?.user || null); setLoading(false); }
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, []);
  useEffect(() => {
    setProfile(null);
    if (!user) return;
    let active = true;
    supabase.from('profiles').select('id,full_name,role,is_active').eq('id', user.id).single()
      .then(({ data }) => { if (active) setProfile(data || { id: user.id, role: 'unavailable', is_active: false }); });
    return () => { active = false; };
  }, [user]);
  if (loading) return <div className="loading-screen">載入中…</div>;
  if (!user) return <Login onSignedIn={setUser} />;
  return <div className="app-shell"><header className="topbar"><Brand /><div><span>{profile?.full_name || user.email || '使用者'}</span><button onClick={() => supabase.auth.signOut()}>登出</button></div></header>{!profile ? <div className="loading-screen">載入帳號資料…</div> : !profile.is_active ? <div className="content"><section className="panel">帳號尚未啟用或尚未建檔，請聯絡管理員。</section></div> : profile.role === 'patient' ? <PatientHome profile={profile} /> : ['doctor','doctor_all','therapist','admin','supervisor'].includes(profile.role) ? <DoctorHome user={user} profile={profile} /> : <div className="content"><section className="panel">此帳號沒有醫療或病人權限。</section></div>}</div>;
}


