import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabaseClient';

const GAME_NAMES = {
  single_color: '單色積木',
  multi_color: '多色積木',
  shapes_single: '形狀單色',
  shapes_multi_color: '形狀多色',
  thin_circle: '細圓',
};

// SVG Line Chart
const LineChart = ({ data }) => {
  if (!data || data.length < 1) {
    return (
      <div style={{ textAlign: 'center', color: '#9CA3AF', padding: '40px 0' }}>
        尚無圖表資料
      </div>
    );
  }

  const W = 560, H = 200;
  const pad = { top: 16, right: 24, bottom: 44, left: 48 };
  const cW = W - pad.left - pad.right;
  const cH = H - pad.top - pad.bottom;

  const xStep = data.length > 1 ? cW / (data.length - 1) : cW / 2;
  const xOf = (i) => data.length > 1 ? i * xStep : cW / 2;
  const yOf = (v) => cH - (v / 100) * cH;

  const linePts = data.map((d, i) => `${xOf(i)},${yOf(d.rate)}`).join(' ');
  const areaPts = `0,${cH} ${linePts} ${xOf(data.length - 1)},${cH}`;

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4F46E5" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#4F46E5" stopOpacity="0.01" />
        </linearGradient>
      </defs>
      <g transform={`translate(${pad.left},${pad.top})`}>
        {/* grid lines */}
        {[0, 25, 50, 75, 100].map((v) => (
          <g key={v}>
            <line x1={0} y1={yOf(v)} x2={cW} y2={yOf(v)} stroke="#E5E7EB" strokeWidth={1} />
            <text x={-8} y={yOf(v)} textAnchor="end" dominantBaseline="middle" fontSize={11} fill="#9CA3AF">
              {v}%
            </text>
          </g>
        ))}
        {/* area fill */}
        <polygon points={areaPts} fill="url(#areaGrad)" />
        {/* line */}
        {data.length > 1 && (
          <polyline points={linePts} fill="none" stroke="#4F46E5" strokeWidth={2.5} strokeLinejoin="round" />
        )}
        {/* dots */}
        {data.map((d, i) => (
          <g key={i}>
            <circle cx={xOf(i)} cy={yOf(d.rate)} r={5} fill="white" stroke="#4F46E5" strokeWidth={2.5} />
            <text x={xOf(i)} y={yOf(d.rate) - 10} textAnchor="middle" fontSize={10} fill="#4F46E5" fontWeight="600">
              {d.rate}%
            </text>
          </g>
        ))}
        {/* x-axis labels */}
        {data.map((d, i) => (
          <text key={i} x={xOf(i)} y={cH + 20} textAnchor="middle" fontSize={10} fill="#9CA3AF">
            {d.label}
          </text>
        ))}
        {/* x-axis line */}
        <line x1={0} y1={cH} x2={cW} y2={cH} stroke="#E5E7EB" strokeWidth={1} />
      </g>
    </svg>
  );
};

// SVG Bar Chart (completion per game type)
const BarChart = ({ data }) => {
  if (!data || data.length === 0) return null;
  const W = 480, H = 160;
  const pad = { top: 16, right: 16, bottom: 44, left: 48 };
  const cW = W - pad.left - pad.right;
  const cH = H - pad.top - pad.bottom;
  const barW = Math.min(40, (cW / data.length) - 8);
  const gap = cW / data.length;

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible' }}>
      <g transform={`translate(${pad.left},${pad.top})`}>
        {[0, 50, 100].map((v) => (
          <g key={v}>
            <line x1={0} y1={cH - (v / 100) * cH} x2={cW} y2={cH - (v / 100) * cH} stroke="#E5E7EB" strokeWidth={1} />
            <text x={-8} y={cH - (v / 100) * cH} textAnchor="end" dominantBaseline="middle" fontSize={11} fill="#9CA3AF">
              {v}%
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const barH = (d.rate / 100) * cH;
          const x = i * gap + (gap - barW) / 2;
          return (
            <g key={i}>
              <rect x={x} y={cH - barH} width={barW} height={barH} rx={4} fill="#10B981" opacity={0.85} />
              <text x={x + barW / 2} y={cH - barH - 6} textAnchor="middle" fontSize={10} fill="#059669" fontWeight="600">
                {d.rate}%
              </text>
              <text x={x + barW / 2} y={cH + 18} textAnchor="middle" fontSize={9} fill="#9CA3AF">
                {d.name}
              </text>
            </g>
          );
        })}
        <line x1={0} y1={cH} x2={cW} y2={cH} stroke="#E5E7EB" strokeWidth={1} />
      </g>
    </svg>
  );
};

const getSessionStats = (session) => {
  const actions = session.game_actions || [];
  const correct = actions.filter((a) => a.action_type === 'tap_correct').length;
  const wrong = actions.filter((a) => a.action_type === 'tap_wrong').length;
  const miss = actions.filter((a) => a.action_type === 'auto_miss').length;
  const total = correct + wrong + miss;
  const rate = total > 0 ? Math.round((correct / total) * 100) : 0;
  return { correct, wrong, miss, total, rate };
};

const fmtDate = (iso) => {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' });
};
const fmtTime = (iso) => {
  if (!iso) return '-';
  return new Date(iso).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' });
};

export default function RehabRecords({ patient, doctorProfile }) {
  const [sessions, setSessions] = useState([]);
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notesError, setNotesError] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [editNoteContent, setEditNoteContent] = useState('');
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'exercises' | 'notes'

  const loadData = useCallback(async () => {
    if (!patient) return;
    setLoading(true);

    // patient_id in game_sessions was set as patient.user_id || patient.id
    const pid1 = patient.user_id;
    const pid2 = patient.id;

    let sessQuery = supabase
      .from('game_sessions')
      .select('*, game_actions(*)')
      .order('created_at', { ascending: true });

    if (pid1 && pid1 !== pid2) {
      sessQuery = sessQuery.or(`patient_id.eq.${pid1},patient_id.eq.${pid2}`);
    } else {
      sessQuery = sessQuery.eq('patient_id', pid2);
    }

    const { data: sessData } = await sessQuery;
    setSessions(sessData || []);

    // load rehab notes (table may not exist yet)
    const { data: notesData, error: notesErr } = await supabase
      .from('rehab_notes')
      .select('*')
      .eq('patient_id', patient.id)
      .order('created_at', { ascending: false });

    if (notesErr) {
      setNotesError(true);
      setNotes([]);
    } else {
      setNotes(notesData || []);
    }

    setLoading(false);
  }, [patient]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const endedSessions = sessions.filter((s) => s.status === 'ended');

  // --- chart data ---
  const lineData = endedSessions.map((s, i) => ({
    label: new Date(s.created_at).toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' }),
    rate: getSessionStats(s).rate,
    idx: i,
  }));

  // per game type stats
  const gameStats = {};
  endedSessions.forEach((s) => {
    const key = s.current_game_key || 'unknown';
    if (!gameStats[key]) gameStats[key] = { correct: 0, wrong: 0, miss: 0, total: 0 };
    const st = getSessionStats(s);
    gameStats[key].correct += st.correct;
    gameStats[key].wrong += st.wrong;
    gameStats[key].miss += st.miss;
    gameStats[key].total += st.total;
  });
  const barData = Object.entries(gameStats)
    .filter(([, v]) => v.total > 0)
    .map(([key, v]) => ({
      name: GAME_NAMES[key] || key,
      rate: Math.round((v.correct / v.total) * 100),
    }));

  const avgRate =
    lineData.length > 0
      ? Math.round(lineData.reduce((s, d) => s + d.rate, 0) / lineData.length)
      : 0;

  const totalActions = endedSessions.reduce((s, sess) => s + getSessionStats(sess).total, 0);

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    setSavingNote(true);
    const { error } = await supabase.from('rehab_notes').insert({
      patient_id: patient.id,
      doctor_id: doctorProfile?.id,
      doctor_name: doctorProfile?.full_name || '醫師',
      content: newNote.trim(),
      note_date: new Date().toISOString().split('T')[0],
    });
    if (!error) {
      setNewNote('');
      loadData();
    }
    setSavingNote(false);
  };

  const handleDeleteNote = async (id) => {
    if (!window.confirm('確定要刪除此評估備註？')) return;
    await supabase.from('rehab_notes').delete().eq('id', id);
    loadData();
  };

  const handleUpdateNote = async (id) => {
    if (!editNoteContent.trim()) return;
    await supabase.from('rehab_notes').update({ content: editNoteContent.trim() }).eq('id', id);
    setEditingNoteId(null);
    setEditNoteContent('');
    loadData();
  };

  if (loading) {
    return (
      <div style={s.card}>
        <div style={{ color: '#6B7280', textAlign: 'center', padding: '48px' }}>載入中...</div>
      </div>
    );
  }

  return (
    <div style={s.card}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h3 style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: '#1F2937' }}>
          復健紀錄 — {patient?.full_name}
        </h3>
        <p style={{ margin: '4px 0 0', color: '#6B7280', fontSize: '14px' }}>
          病患編號：{patient?.patient_number || patient?.username}
        </p>
      </div>

      {/* Inner Tabs */}
      <div style={s.innerTabs}>
        {['overview', 'exercises', 'notes'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={s.innerTab(activeTab === tab)}
          >
            {{ overview: '📊 進度總覽', exercises: '🏋️ 運動記錄', notes: '📝 醫師評估' }[tab]}
          </button>
        ))}
      </div>

      {/* ── TAB: overview ── */}
      {activeTab === 'overview' && (
        <div>
          {/* Stats Row */}
          <div style={s.statsRow}>
            <StatCard label="完成次數" value={endedSessions.length} unit="次" color="#4F46E5" />
            <StatCard label="平均完成率" value={avgRate} unit="%" color="#10B981" />
            <StatCard label="總操作次數" value={totalActions} unit="次" color="#F59E0B" />
            <StatCard
              label="最新完成率"
              value={lineData.length > 0 ? lineData[lineData.length - 1].rate : '-'}
              unit={lineData.length > 0 ? '%' : ''}
              color="#8B5CF6"
            />
          </div>

          {/* Progress Line Chart */}
          <div style={s.section}>
            <h4 style={s.sectionTitle}>復健進度圖表（完成率趨勢）</h4>
            {lineData.length === 0 ? (
              <div style={s.emptyNote}>尚無結束的遊戲紀錄</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <LineChart data={lineData} />
              </div>
            )}
          </div>

          {/* Bar Chart by game type */}
          {barData.length > 0 && (
            <div style={s.section}>
              <h4 style={s.sectionTitle}>各遊戲項目完成度統計</h4>
              <div style={{ overflowX: 'auto' }}>
                <BarChart data={barData} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TAB: exercises ── */}
      {activeTab === 'exercises' && (
        <div>
          <h4 style={s.sectionTitle}>運動項目記錄（共 {endedSessions.length} 次）</h4>
          {endedSessions.length === 0 ? (
            <div style={s.emptyNote}>尚無運動記錄</div>
          ) : (
            <div style={{ display: 'grid', gap: '12px' }}>
              {[...endedSessions].reverse().map((sess, idx) => {
                const st = getSessionStats(sess);
                const gameName = GAME_NAMES[sess.current_game_key] || sess.current_game_key || '未知遊戲';
                return (
                  <div key={sess.id} style={s.exerciseCard}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                      <div>
                        <span style={s.exerciseIndex}>#{endedSessions.length - idx}</span>
                        <span style={{ fontWeight: '600', color: '#1F2937', marginLeft: '8px' }}>{gameName}</span>
                      </div>
                      <div style={{ textAlign: 'right', color: '#6B7280', fontSize: '13px' }}>
                        <div>{fmtDate(sess.created_at)}</div>
                        <div>{fmtTime(sess.created_at)}</div>
                      </div>
                    </div>
                    <div style={s.exerciseStats}>
                      <ExStat label="正確" value={st.correct} color="#10B981" />
                      <ExStat label="錯誤" value={st.wrong} color="#EF4444" />
                      <ExStat label="未接" value={st.miss} color="#F59E0B" />
                      <ExStat label="總計" value={st.total} color="#6B7280" />
                      <div style={{ ...s.exStatBox, background: st.rate >= 70 ? '#ECFDF5' : st.rate >= 40 ? '#FFFBEB' : '#FEF2F2' }}>
                        <span style={{ fontSize: '18px', fontWeight: '700', color: st.rate >= 70 ? '#059669' : st.rate >= 40 ? '#D97706' : '#DC2626' }}>
                          {st.rate}%
                        </span>
                        <span style={{ fontSize: '11px', color: '#6B7280' }}>完成率</span>
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
        <div>
          {notesError ? (
            <div style={{ ...s.emptyNote, color: '#EF4444', background: '#FEF2F2' }}>
              ⚠️ 醫師評估備註功能需要先在 Supabase 建立 rehab_notes 資料表。
              <br />
              請參考專案根目錄的 <code>supabase/migrations/rehab_notes.sql</code> 檔案執行 SQL。
            </div>
          ) : (
            <>
              {/* Add note */}
              <div style={s.noteInputArea}>
                <h4 style={{ ...s.sectionTitle, marginBottom: '12px' }}>新增醫師評估備註</h4>
                <textarea
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="輸入評估內容、治療建議或觀察紀錄..."
                  style={s.noteTextarea}
                  rows={4}
                />
                <button
                  onClick={handleAddNote}
                  disabled={savingNote || !newNote.trim()}
                  style={s.saveBtn(savingNote || !newNote.trim())}
                >
                  {savingNote ? '儲存中...' : '儲存備註'}
                </button>
              </div>

              {/* Notes list */}
              <h4 style={s.sectionTitle}>歷史備註（共 {notes.length} 筆）</h4>
              {notes.length === 0 ? (
                <div style={s.emptyNote}>尚無評估備註</div>
              ) : (
                <div style={{ display: 'grid', gap: '12px' }}>
                  {notes.map((note) => (
                    <div key={note.id} style={s.noteCard}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                        <div style={{ fontSize: '13px', color: '#6B7280' }}>
                          <span style={{ fontWeight: '600', color: '#374151' }}>
                            {note.doctor_name || '醫師'}
                          </span>
                          　{fmtDate(note.note_date || note.created_at)}
                        </div>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            onClick={() => { setEditingNoteId(note.id); setEditNoteContent(note.content); }}
                            style={s.noteActionBtn('#3B82F6')}
                          >
                            編輯
                          </button>
                          <button
                            onClick={() => handleDeleteNote(note.id)}
                            style={s.noteActionBtn('#EF4444')}
                          >
                            刪除
                          </button>
                        </div>
                      </div>
                      {editingNoteId === note.id ? (
                        <div style={{ marginTop: '10px' }}>
                          <textarea
                            value={editNoteContent}
                            onChange={(e) => setEditNoteContent(e.target.value)}
                            style={s.noteTextarea}
                            rows={3}
                          />
                          <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                            <button onClick={() => handleUpdateNote(note.id)} style={s.saveBtn(false)}>
                              確認修改
                            </button>
                            <button
                              onClick={() => setEditingNoteId(null)}
                              style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #D1D5DB', background: 'white', cursor: 'pointer', fontSize: '14px' }}
                            >
                              取消
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p style={{ margin: '10px 0 0', color: '#374151', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
                          {note.content}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// Small helper components
function StatCard({ label, value, unit, color }) {
  return (
    <div style={{ background: 'white', border: `2px solid ${color}20`, borderRadius: '12px', padding: '16px', textAlign: 'center', flex: '1', minWidth: '100px' }}>
      <div style={{ fontSize: '28px', fontWeight: '800', color }}>{value}<span style={{ fontSize: '14px', fontWeight: '500' }}>{unit}</span></div>
      <div style={{ fontSize: '12px', color: '#6B7280', marginTop: '4px' }}>{label}</div>
    </div>
  );
}

function ExStat({ label, value, color }) {
  return (
    <div style={s.exStatBox}>
      <span style={{ fontSize: '20px', fontWeight: '700', color }}>{value}</span>
      <span style={{ fontSize: '11px', color: '#6B7280' }}>{label}</span>
    </div>
  );
}

// Styles
const s = {
  card: {
    backgroundColor: 'white',
    padding: '24px',
    borderRadius: '12px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
  },
  innerTabs: {
    display: 'flex',
    gap: '8px',
    marginBottom: '24px',
    borderBottom: '2px solid #E5E7EB',
    paddingBottom: '0',
  },
  innerTab: (active) => ({
    padding: '8px 18px',
    border: 'none',
    borderBottom: active ? '2px solid #4F46E5' : '2px solid transparent',
    marginBottom: '-2px',
    background: 'transparent',
    color: active ? '#4F46E5' : '#6B7280',
    fontWeight: active ? '600' : '400',
    cursor: 'pointer',
    fontSize: '14px',
    transition: 'all 0.15s',
  }),
  statsRow: {
    display: 'flex',
    gap: '12px',
    marginBottom: '24px',
    flexWrap: 'wrap',
  },
  section: {
    marginBottom: '24px',
    padding: '20px',
    background: '#F9FAFB',
    borderRadius: '10px',
    border: '1px solid #E5E7EB',
  },
  sectionTitle: {
    margin: '0 0 16px',
    fontSize: '15px',
    fontWeight: '600',
    color: '#374151',
  },
  emptyNote: {
    padding: '24px',
    background: '#F9FAFB',
    borderRadius: '8px',
    color: '#9CA3AF',
    textAlign: 'center',
    fontSize: '14px',
  },
  exerciseCard: {
    background: '#F9FAFB',
    border: '1px solid #E5E7EB',
    borderRadius: '10px',
    padding: '16px',
  },
  exerciseIndex: {
    background: '#4F46E520',
    color: '#4F46E5',
    borderRadius: '4px',
    padding: '2px 6px',
    fontSize: '12px',
    fontWeight: '700',
  },
  exerciseStats: {
    display: 'flex',
    gap: '10px',
    marginTop: '12px',
    flexWrap: 'wrap',
  },
  exStatBox: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    background: 'white',
    border: '1px solid #E5E7EB',
    borderRadius: '8px',
    padding: '8px 14px',
    minWidth: '56px',
  },
  noteInputArea: {
    background: '#F9FAFB',
    border: '1px solid #E5E7EB',
    borderRadius: '10px',
    padding: '20px',
    marginBottom: '24px',
  },
  noteTextarea: {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid #D1D5DB',
    borderRadius: '6px',
    fontSize: '14px',
    resize: 'vertical',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
    lineHeight: '1.6',
  },
  saveBtn: (disabled) => ({
    marginTop: '10px',
    padding: '10px 20px',
    background: disabled ? '#D1D5DB' : '#4F46E5',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontWeight: '600',
    fontSize: '14px',
  }),
  noteCard: {
    background: '#F9FAFB',
    border: '1px solid #E5E7EB',
    borderRadius: '10px',
    padding: '16px',
  },
  noteActionBtn: (color) => ({
    padding: '4px 10px',
    border: `1px solid ${color}40`,
    borderRadius: '4px',
    background: `${color}10`,
    color,
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: '500',
  }),
};
