import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabaseClient';

const GAME_NAMES = {
  single_color: '單色積木',
  multi_color: '多色積木',
  shapes_single: '形狀單色',
  shapes_multi_color: '形狀多色',
  thin_circle: '細圓',
};

// SVG Line Chart (patient version — same logic, slightly different style)
const LineChart = ({ data }) => {
  if (!data || data.length < 1) {
    return <div style={{ color: '#9CA3AF', textAlign: 'center', padding: '32px 0' }}>尚無圖表資料</div>;
  }

  const W = 520, H = 180;
  const pad = { top: 16, right: 20, bottom: 44, left: 44 };
  const cW = W - pad.left - pad.right;
  const cH = H - pad.top - pad.bottom;
  const xOf = (i) => data.length > 1 ? (i / (data.length - 1)) * cW : cW / 2;
  const yOf = (v) => cH - (v / 100) * cH;
  const linePts = data.map((d, i) => `${xOf(i)},${yOf(d.rate)}`).join(' ');
  const areaPts = `0,${cH} ${linePts} ${xOf(data.length - 1)},${cH}`;

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id="patGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#10B981" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#10B981" stopOpacity="0.01" />
        </linearGradient>
      </defs>
      <g transform={`translate(${pad.left},${pad.top})`}>
        {[0, 50, 100].map((v) => (
          <g key={v}>
            <line x1={0} y1={yOf(v)} x2={cW} y2={yOf(v)} stroke="#E5E7EB" strokeWidth={1} />
            <text x={-6} y={yOf(v)} textAnchor="end" dominantBaseline="middle" fontSize={11} fill="#9CA3AF">
              {v}%
            </text>
          </g>
        ))}
        <polygon points={areaPts} fill="url(#patGrad)" />
        {data.length > 1 && (
          <polyline points={linePts} fill="none" stroke="#10B981" strokeWidth={2.5} strokeLinejoin="round" />
        )}
        {data.map((d, i) => (
          <g key={i}>
            <circle cx={xOf(i)} cy={yOf(d.rate)} r={5} fill="white" stroke="#10B981" strokeWidth={2.5} />
            <text x={xOf(i)} y={yOf(d.rate) - 10} textAnchor="middle" fontSize={10} fill="#059669" fontWeight="600">
              {d.rate}%
            </text>
          </g>
        ))}
        {data.map((d, i) => (
          <text key={i} x={xOf(i)} y={cH + 18} textAnchor="middle" fontSize={10} fill="#9CA3AF">
            {d.label}
          </text>
        ))}
        <line x1={0} y1={cH} x2={cW} y2={cH} stroke="#E5E7EB" strokeWidth={1} />
      </g>
    </svg>
  );
};

const getStats = (session) => {
  const actions = session.game_actions || [];
  const correct = actions.filter((a) => a.action_type === 'tap_correct').length;
  const wrong = actions.filter((a) => a.action_type === 'tap_wrong').length;
  const miss = actions.filter((a) => a.action_type === 'auto_miss').length;
  const total = correct + wrong + miss;
  return { correct, wrong, miss, total, rate: total > 0 ? Math.round((correct / total) * 100) : 0 };
};

const fmtDate = (iso) => {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' });
};

export default function PatientDashboard({ user, onLogout }) {
  const [profile, setProfile] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  const loadAll = useCallback(async () => {
    setLoading(true);

    // Load patient profile
    const { data: profileData } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    setProfile(profileData);

    if (!profileData) {
      setLoading(false);
      return;
    }

    // Query game_sessions using both possible patient IDs
    const pid = profileData.user_id || profileData.id;
    let q = supabase
      .from('game_sessions')
      .select('*, game_actions(*)')
      .order('created_at', { ascending: true });

    if (profileData.user_id && profileData.user_id !== profileData.id) {
      q = q.or(`patient_id.eq.${profileData.user_id},patient_id.eq.${profileData.id}`);
    } else {
      q = q.eq('patient_id', pid);
    }

    const { data: sessData } = await q;
    setSessions(sessData || []);

    // Load doctor notes for this patient
    const { data: notesData } = await supabase
      .from('rehab_notes')
      .select('*')
      .eq('patient_id', profileData.id)
      .order('created_at', { ascending: false });
    setNotes(notesData || []);

    setLoading(false);
  }, [user]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const endedSessions = sessions.filter((s) => s.status === 'ended');

  const lineData = endedSessions.map((s) => ({
    label: new Date(s.created_at).toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' }),
    rate: getStats(s).rate,
  }));

  const avgRate =
    lineData.length > 0
      ? Math.round(lineData.reduce((sum, d) => sum + d.rate, 0) / lineData.length)
      : 0;

  const latestRate = lineData.length > 0 ? lineData[lineData.length - 1].rate : null;

  const totalActions = endedSessions.reduce((s, sess) => s + getStats(sess).total, 0);

  const rateColor = (r) => (r >= 70 ? '#059669' : r >= 40 ? '#D97706' : '#DC2626');
  const rateLabel = (r) => (r >= 70 ? '優良' : r >= 40 ? '進步中' : '需加強');

  return (
    <div style={ps.page}>
      {/* Navbar */}
      <nav style={ps.nav}>
        <div style={ps.navInner}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={ps.navIcon}>
              <span style={{ color: 'white', fontWeight: 'bold', fontSize: '14px' }}>積</span>
            </div>
            <span style={{ fontWeight: '700', fontSize: '18px', color: '#1F2937' }}>積木復健系統</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ color: '#6B7280', fontSize: '14px' }}>
              {profile?.full_name || user?.user_metadata?.full_name} 您好
            </span>
            <button onClick={onLogout} style={ps.logoutBtn}>登出</button>
          </div>
        </div>
      </nav>

      <div style={ps.container}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '48px', color: '#6B7280' }}>載入中...</div>
        ) : (
          <>
            {/* Welcome banner */}
            <div style={ps.banner}>
              <div>
                <h2 style={{ margin: 0, fontSize: '22px', fontWeight: '700', color: '#1F2937' }}>
                  我的復健記錄
                </h2>
                <p style={{ margin: '4px 0 0', color: '#6B7280', fontSize: '14px' }}>
                  主治醫師：{profile?.assigned_doctor || '未指定'}
                </p>
              </div>
              {latestRate !== null && (
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '36px', fontWeight: '800', color: rateColor(latestRate) }}>
                    {latestRate}%
                  </div>
                  <div style={{ fontSize: '13px', color: rateColor(latestRate), fontWeight: '600' }}>
                    {rateLabel(latestRate)} — 最新完成率
                  </div>
                </div>
              )}
            </div>

            {/* Tabs */}
            <div style={ps.tabs}>
              {['overview', 'history', 'notes'].map((tab) => (
                <button key={tab} onClick={() => setActiveTab(tab)} style={ps.tab(activeTab === tab)}>
                  {{ overview: '📊 我的進度', history: '📋 運動記錄', notes: '💬 醫師評語' }[tab]}
                </button>
              ))}
            </div>

            {/* ── TAB: overview ── */}
            {activeTab === 'overview' && (
              <div style={ps.card}>
                <div style={ps.statsRow}>
                  <PStat label="復健次數" value={endedSessions.length} unit="次" color="#4F46E5" />
                  <PStat label="平均完成率" value={avgRate} unit="%" color="#10B981" />
                  <PStat label="總操作次數" value={totalActions} unit="次" color="#F59E0B" />
                  <PStat label="醫師評語" value={notes.length} unit="筆" color="#8B5CF6" />
                </div>

                <div style={ps.chartBox}>
                  <h4 style={ps.chartTitle}>我的復健進度（完成率趨勢）</h4>
                  <LineChart data={lineData} />
                </div>

                {/* Progress bar for avg rate */}
                <div style={{ marginTop: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ fontSize: '14px', color: '#374151', fontWeight: '500' }}>整體平均完成率</span>
                    <span style={{ fontSize: '14px', fontWeight: '700', color: rateColor(avgRate) }}>{avgRate}%</span>
                  </div>
                  <div style={{ background: '#E5E7EB', borderRadius: '999px', height: '10px' }}>
                    <div
                      style={{
                        width: `${avgRate}%`,
                        background: rateColor(avgRate),
                        height: '10px',
                        borderRadius: '999px',
                        transition: 'width 0.5s ease',
                      }}
                    />
                  </div>
                  <div style={{ marginTop: '6px', fontSize: '12px', color: '#9CA3AF' }}>
                    {avgRate >= 70 ? '您的復健表現非常好！繼續保持 💪' : avgRate >= 40 ? '您正在進步中，加油！🌟' : '持續練習，您一定做得到！🎯'}
                  </div>
                </div>
              </div>
            )}

            {/* ── TAB: history ── */}
            {activeTab === 'history' && (
              <div style={ps.card}>
                <h4 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: '600', color: '#1F2937' }}>
                  運動項目記錄（共 {endedSessions.length} 次）
                </h4>
                {endedSessions.length === 0 ? (
                  <div style={ps.empty}>尚無運動記錄，請進行遊戲復健後再來查看。</div>
                ) : (
                  <div style={{ display: 'grid', gap: '10px' }}>
                    {[...endedSessions].reverse().map((sess, idx) => {
                      const st = getStats(sess);
                      const gameName = GAME_NAMES[sess.current_game_key] || sess.current_game_key || '未知遊戲';
                      return (
                        <div key={sess.id} style={ps.histCard}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <span style={ps.histIdx}>#{endedSessions.length - idx}</span>
                              <span style={{ fontWeight: '600', color: '#1F2937' }}>{gameName}</span>
                            </div>
                            <span style={{ color: '#9CA3AF', fontSize: '13px' }}>
                              {fmtDate(sess.created_at)}
                            </span>
                          </div>
                          <div style={ps.histStats}>
                            <HistStat label="正確" value={st.correct} color="#10B981" />
                            <HistStat label="錯誤" value={st.wrong} color="#EF4444" />
                            <HistStat label="未接" value={st.miss} color="#F59E0B" />
                            <div
                              style={{
                                ...ps.histStatBox,
                                background: st.rate >= 70 ? '#ECFDF5' : st.rate >= 40 ? '#FFFBEB' : '#FEF2F2',
                                borderColor: rateColor(st.rate) + '30',
                              }}
                            >
                              <span style={{ fontSize: '18px', fontWeight: '800', color: rateColor(st.rate) }}>
                                {st.rate}%
                              </span>
                              <span style={{ fontSize: '11px', color: '#9CA3AF' }}>完成率</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ── TAB: notes ── */}
            {activeTab === 'notes' && (
              <div style={ps.card}>
                <h4 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: '600', color: '#1F2937' }}>
                  醫師評估評語（共 {notes.length} 筆）
                </h4>
                {notes.length === 0 ? (
                  <div style={ps.empty}>目前醫師尚未留下評語。</div>
                ) : (
                  <div style={{ display: 'grid', gap: '12px' }}>
                    {notes.map((note) => (
                      <div key={note.id} style={ps.noteCard}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                          <span style={{ fontWeight: '600', color: '#374151', fontSize: '14px' }}>
                            👨‍⚕️ {note.doctor_name || '醫師'}
                          </span>
                          <span style={{ color: '#9CA3AF', fontSize: '13px' }}>
                            {fmtDate(note.note_date || note.created_at)}
                          </span>
                        </div>
                        <p style={{ margin: 0, color: '#374151', lineHeight: '1.7', whiteSpace: 'pre-wrap', fontSize: '14px' }}>
                          {note.content}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function PStat({ label, value, unit, color }) {
  return (
    <div style={{ flex: '1', minWidth: '100px', background: `${color}10`, border: `1px solid ${color}30`, borderRadius: '12px', padding: '14px 12px', textAlign: 'center' }}>
      <div style={{ fontSize: '26px', fontWeight: '800', color }}>
        {value}<span style={{ fontSize: '13px', fontWeight: '500' }}>{unit}</span>
      </div>
      <div style={{ fontSize: '12px', color: '#6B7280', marginTop: '4px' }}>{label}</div>
    </div>
  );
}

function HistStat({ label, value, color }) {
  return (
    <div style={ps.histStatBox}>
      <span style={{ fontSize: '18px', fontWeight: '700', color }}>{value}</span>
      <span style={{ fontSize: '11px', color: '#9CA3AF' }}>{label}</span>
    </div>
  );
}

const ps = {
  page: { minHeight: '100vh', background: '#F0FDF4' },
  nav: { background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', padding: '14px 24px' },
  navInner: { maxWidth: '900px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  navIcon: { width: '34px', height: '34px', background: 'linear-gradient(135deg,#10B981,#059669)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  logoutBtn: { padding: '7px 14px', background: '#EF4444', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '500', fontSize: '14px' },
  container: { maxWidth: '900px', margin: '0 auto', padding: '24px 16px' },
  banner: { background: 'white', borderRadius: '14px', padding: '24px', marginBottom: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' },
  tabs: { display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' },
  tab: (active) => ({
    padding: '9px 18px',
    border: 'none',
    borderRadius: '8px',
    background: active ? '#10B981' : 'white',
    color: active ? 'white' : '#6B7280',
    fontWeight: active ? '600' : '400',
    cursor: 'pointer',
    boxShadow: active ? '0 2px 8px rgba(16,185,129,0.3)' : '0 1px 3px rgba(0,0,0,0.08)',
    fontSize: '14px',
    transition: 'all 0.15s',
  }),
  card: { background: 'white', borderRadius: '14px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' },
  statsRow: { display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' },
  chartBox: { background: '#F9FAFB', borderRadius: '10px', padding: '20px', border: '1px solid #E5E7EB' },
  chartTitle: { margin: '0 0 12px', fontSize: '14px', fontWeight: '600', color: '#374151' },
  empty: { padding: '32px', background: '#F9FAFB', borderRadius: '10px', color: '#9CA3AF', textAlign: 'center', fontSize: '14px' },
  histCard: { background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '10px', padding: '14px' },
  histIdx: { background: '#10B98120', color: '#059669', borderRadius: '4px', padding: '2px 6px', fontSize: '11px', fontWeight: '700' },
  histStats: { display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' },
  histStatBox: { display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'white', border: '1px solid #E5E7EB', borderRadius: '8px', padding: '7px 12px', minWidth: '52px' },
  noteCard: { background: '#F0FDF4', border: '1px solid #D1FAE5', borderRadius: '10px', padding: '16px' },
};
