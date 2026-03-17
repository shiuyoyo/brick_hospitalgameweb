import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabaseClient';

const gameKeyLabels = {
  single_color: '單色積木',
  multi_color: '多色積木',
  shapes_single: '形狀單色',
  shapes_multi_color: '形狀多色',
  thin_circle: '細圓遊戲',
};

const gameKeyColor = {
  single_color: '#6366F1',
  multi_color: '#8B5CF6',
  shapes_single: '#0EA5E9',
  shapes_multi_color: '#06B6D4',
  thin_circle: '#10B981',
};

// ─── SVG Bar Chart ──────────────────────────────────────────────────────────
function ProgressChart({ chartData }) {
  if (chartData.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '40px', color: '#9CA3AF' }}>
        尚無已完成的遊戲紀錄，完成遊戲後圖表將顯示於此。
      </div>
    );
  }

  const W = 560;
  const H = 180;
  const padL = 44;
  const padB = 32;
  const plotW = W - padL - 8;
  const barW = Math.max(12, Math.min(36, plotW / chartData.length - 6));

  return (
    <svg
      width="100%"
      viewBox={`0 0 ${W} ${H + padB}`}
      style={{ fontFamily: 'sans-serif', display: 'block' }}
    >
      {/* gridlines */}
      {[0, 25, 50, 75, 100].map((v) => {
        const y = H - (v / 100) * H;
        return (
          <g key={v}>
            <line x1={padL} y1={y} x2={W} y2={y} stroke="#E5E7EB" strokeWidth={1} />
            <text x={padL - 4} y={y + 4} textAnchor="end" fontSize={9} fill="#9CA3AF">
              {v}%
            </text>
          </g>
        );
      })}
      {/* bars */}
      {chartData.map((item, i) => {
        const slotW = plotW / chartData.length;
        const x = padL + i * slotW + (slotW - barW) / 2;
        const barH = Math.max(2, (item.rate / 100) * H);
        const y = H - barH;
        const color =
          item.rate >= 80 ? '#10B981' : item.rate >= 50 ? '#F59E0B' : '#EF4444';
        return (
          <g key={i}>
            <rect x={x} y={y} width={barW} height={barH} rx={4} fill={color} opacity={0.85} />
            {item.rate > 0 && (
              <text
                x={x + barW / 2}
                y={y - 3}
                textAnchor="middle"
                fontSize={9}
                fill={color}
                fontWeight="bold"
              >
                {item.rate}%
              </text>
            )}
            <text
              x={x + barW / 2}
              y={H + padB - 4}
              textAnchor="middle"
              fontSize={8}
              fill="#6B7280"
            >
              {item.date}
            </text>
          </g>
        );
      })}
      {/* legend */}
      <rect x={padL} y={H + 2} width={10} height={10} rx={2} fill="#10B981" />
      <text x={padL + 14} y={H + 11} fontSize={9} fill="#6B7280">≥80% 優良</text>
      <rect x={padL + 60} y={H + 2} width={10} height={10} rx={2} fill="#F59E0B" />
      <text x={padL + 74} y={H + 11} fontSize={9} fill="#6B7280">50-79% 普通</text>
      <rect x={padL + 128} y={H + 2} width={10} height={10} rx={2} fill="#EF4444" />
      <text x={padL + 142} y={H + 11} fontSize={9} fill="#6B7280">&lt;50% 需加強</text>
    </svg>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────
export default function RehabRecords({ patient, isDoctor, onBack }) {
  const [sessions, setSessions] = useState([]);
  const [sessionStats, setSessionStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [doctorNotes, setDoctorNotes] = useState('');
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesDraft, setNotesDraft] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [notesError, setNotesError] = useState('');
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'sessions'

  const loadData = useCallback(async () => {
    if (!patient) return;
    setLoading(true);
    try {
      const patientId = patient.id;

      // Game sessions (ended only)
      const { data: sessionsData, error: sessErr } = await supabase
        .from('game_sessions')
        .select('*')
        .eq('patient_id', patientId)
        .eq('status', 'ended')
        .order('created_at', { ascending: false });

      if (sessErr) {
        console.error('載入遊戲記錄錯誤:', sessErr);
      }

      const loaded = sessionsData || [];
      setSessions(loaded);

      // Game actions for stat aggregation
      if (loaded.length > 0) {
        const ids = loaded.map((s) => s.id);
        const { data: actionsData } = await supabase
          .from('game_actions')
          .select('session_id, action_type')
          .in('session_id', ids);

        if (actionsData) {
          const statsMap = {};
          actionsData.forEach((a) => {
            if (!statsMap[a.session_id]) {
              statsMap[a.session_id] = { correct: 0, wrong: 0, autoMiss: 0, total: 0 };
            }
            if (a.action_type === 'tap_correct') statsMap[a.session_id].correct++;
            else if (a.action_type === 'tap_wrong') statsMap[a.session_id].wrong++;
            else if (a.action_type === 'auto_miss') statsMap[a.session_id].autoMiss++;
            if (['tap_correct', 'tap_wrong', 'auto_miss'].includes(a.action_type)) {
              statsMap[a.session_id].total++;
            }
          });
          setSessionStats(statsMap);
        }
      }

      // Doctor notes
      const { data: healthData } = await supabase
        .from('user_health_records')
        .select('doctor_notes')
        .eq('user_id', patientId)
        .maybeSingle();

      const notes = healthData?.doctor_notes || '';
      setDoctorNotes(notes);
      setNotesDraft(notes);
    } catch (err) {
      console.error('載入復健記錄異常:', err);
    } finally {
      setLoading(false);
    }
  }, [patient]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSaveNotes = async () => {
    setSavingNotes(true);
    setNotesError('');
    try {
      const patientId = patient.id;

      // Upsert doctor notes into user_health_records
      const { data: existing } = await supabase
        .from('user_health_records')
        .select('id')
        .eq('user_id', patientId)
        .maybeSingle();

      let err;
      if (existing) {
        const { error } = await supabase
          .from('user_health_records')
          .update({ doctor_notes: notesDraft })
          .eq('id', existing.id);
        err = error;
      } else {
        const { error } = await supabase
          .from('user_health_records')
          .insert({ user_id: patientId, doctor_notes: notesDraft });
        err = error;
      }

      if (err) {
        console.error('儲存備註錯誤:', err);
        setNotesError(`儲存失敗：${err.message}（請確認資料庫已新增 doctor_notes 欄位）`);
      } else {
        setDoctorNotes(notesDraft);
        setEditingNotes(false);
      }
    } catch (err) {
      console.error('儲存備註異常:', err);
      setNotesError('儲存失敗，請稍後再試');
    } finally {
      setSavingNotes(false);
    }
  };

  // ── Derived stats ──────────────────────────────────────────────────────────
  const totalSessions = sessions.length;
  const allStats = Object.values(sessionStats);
  const totalCorrect = allStats.reduce((s, v) => s + v.correct, 0);
  const totalWrong = allStats.reduce((s, v) => s + v.wrong, 0);
  const totalAutoMiss = allStats.reduce((s, v) => s + v.autoMiss, 0);
  const totalActions = allStats.reduce((s, v) => s + v.total, 0);
  const overallRate = totalActions > 0 ? Math.round((totalCorrect / totalActions) * 100) : 0;

  // Unique game types played
  const gameCounts = {};
  sessions.forEach((s) => {
    const k = s.current_game_key || 'unknown';
    gameCounts[k] = (gameCounts[k] || 0) + 1;
  });

  // Chart data: last 10 sessions, oldest → newest
  const chartData = sessions
    .slice(0, 10)
    .reverse()
    .map((session) => {
      const st = sessionStats[session.id] || { correct: 0, total: 0 };
      const rate = st.total > 0 ? Math.round((st.correct / st.total) * 100) : 0;
      return {
        date: new Date(session.created_at).toLocaleDateString('zh-TW', {
          month: 'numeric',
          day: 'numeric',
        }),
        rate,
        gameKey: session.current_game_key,
      };
    });

  // ── Styles ─────────────────────────────────────────────────────────────────
  const s = {
    wrap: { background: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '24px' },
    title: { margin: 0, color: '#1F2937', fontSize: '20px', fontWeight: 700 },
    subtitle: { margin: '4px 0 0', color: '#6B7280', fontSize: '14px' },
    backBtn: { padding: '8px 16px', borderRadius: '8px', border: 'none', background: '#E5E7EB', cursor: 'pointer', fontWeight: 500 },
    tabs: { display: 'flex', gap: '8px', marginBottom: '24px', borderBottom: '2px solid #E5E7EB' },
    tab: (active) => ({
      padding: '10px 20px', border: 'none', cursor: 'pointer', fontWeight: 500,
      borderRadius: '8px 8px 0 0',
      background: active ? '#4F46E5' : 'transparent',
      color: active ? 'white' : '#6B7280',
    }),
    statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px', marginBottom: '24px' },
    statCard: (color) => ({
      background: color + '10', border: `1px solid ${color}30`,
      borderRadius: '12px', padding: '16px', textAlign: 'center',
    }),
    statNum: (color) => ({ fontSize: '28px', fontWeight: 700, color, lineHeight: 1 }),
    statLabel: { fontSize: '12px', color: '#6B7280', marginTop: '6px' },
    section: { marginBottom: '24px' },
    sectionTitle: { fontSize: '15px', fontWeight: 600, color: '#374151', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' },
    chartBox: { background: '#F9FAFB', borderRadius: '12px', padding: '16px' },
    gameTagsWrap: { display: 'flex', flexWrap: 'wrap', gap: '8px' },
    gameTag: (key) => ({
      background: (gameKeyColor[key] || '#6B7280') + '15',
      color: gameKeyColor[key] || '#6B7280',
      border: `1px solid ${gameKeyColor[key] || '#6B7280'}40`,
      borderRadius: '999px', padding: '4px 12px', fontSize: '13px', fontWeight: 500,
    }),
    table: { width: '100%', borderCollapse: 'collapse', fontSize: '14px' },
    th: { textAlign: 'left', padding: '10px 12px', borderBottom: '2px solid #E5E7EB', color: '#6B7280', fontWeight: 600, fontSize: '12px' },
    td: { padding: '12px', borderBottom: '1px solid #F3F4F6', color: '#1F2937' },
    badge: (rate) => ({
      display: 'inline-block', padding: '2px 8px', borderRadius: '999px', fontSize: '12px', fontWeight: 600,
      background: rate >= 80 ? '#D1FAE5' : rate >= 50 ? '#FEF3C7' : '#FEE2E2',
      color: rate >= 80 ? '#065F46' : rate >= 50 ? '#92400E' : '#991B1B',
    }),
    notesBox: { background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '12px', padding: '16px' },
    notesText: { color: '#374151', lineHeight: 1.7, whiteSpace: 'pre-wrap', minHeight: '48px' },
    notesEmpty: { color: '#9CA3AF', fontStyle: 'italic' },
    notesTextarea: {
      width: '100%', padding: '12px', border: '1px solid #D1D5DB', borderRadius: '8px',
      fontSize: '14px', lineHeight: 1.7, minHeight: '120px', resize: 'vertical', boxSizing: 'border-box',
    },
    editBtn: { padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 500, background: '#4F46E5', color: 'white' },
    saveBtn: { padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 500, background: '#10B981', color: 'white' },
    cancelBtn: { padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 500, background: '#E5E7EB', color: '#374151' },
    errorText: { color: '#DC2626', fontSize: '13px', marginTop: '8px' },
  };

  if (loading) {
    return (
      <div style={s.wrap}>
        <div style={{ textAlign: 'center', padding: '60px', color: '#9CA3AF' }}>載入中...</div>
      </div>
    );
  }

  return (
    <div style={s.wrap}>
      {/* Header */}
      <div style={s.header}>
        <div>
          <h2 style={s.title}>復健記錄</h2>
          <p style={s.subtitle}>
            {patient.full_name || patient.username || '病患'}
            {patient.patient_number ? `　病患編號：${patient.patient_number}` : ''}
          </p>
        </div>
        <button onClick={onBack} style={s.backBtn}>
          {isDoctor ? '返回病患列表' : '返回'}
        </button>
      </div>

      {/* Tabs */}
      <div style={s.tabs}>
        <button style={s.tab(activeTab === 'overview')} onClick={() => setActiveTab('overview')}>
          總覽
        </button>
        <button style={s.tab(activeTab === 'sessions')} onClick={() => setActiveTab('sessions')}>
          運動紀錄 ({totalSessions})
        </button>
      </div>

      {/* ── Overview Tab ── */}
      {activeTab === 'overview' && (
        <div>
          {/* 完成度統計 */}
          <div style={s.section}>
            <div style={s.sectionTitle}>
              <span>📊</span> 完成度統計
            </div>
            <div style={s.statsGrid}>
              <div style={s.statCard('#4F46E5')}>
                <div style={s.statNum('#4F46E5')}>{totalSessions}</div>
                <div style={s.statLabel}>總遊戲次數</div>
              </div>
              <div style={s.statCard('#10B981')}>
                <div style={s.statNum('#10B981')}>{overallRate}%</div>
                <div style={s.statLabel}>整體正確率</div>
              </div>
              <div style={s.statCard('#10B981')}>
                <div style={s.statNum('#10B981')}>{totalCorrect}</div>
                <div style={s.statLabel}>正確點擊</div>
              </div>
              <div style={s.statCard('#F59E0B')}>
                <div style={s.statNum('#F59E0B')}>{totalWrong}</div>
                <div style={s.statLabel}>錯誤點擊</div>
              </div>
              <div style={s.statCard('#EF4444')}>
                <div style={s.statNum('#EF4444')}>{totalAutoMiss}</div>
                <div style={s.statLabel}>自動 Miss</div>
              </div>
              <div style={s.statCard('#6B7280')}>
                <div style={s.statNum('#6B7280')}>{totalActions}</div>
                <div style={s.statLabel}>總動作數</div>
              </div>
            </div>
          </div>

          {/* 運動項目 */}
          <div style={s.section}>
            <div style={s.sectionTitle}>
              <span>🎮</span> 運動項目記錄
            </div>
            {Object.keys(gameCounts).length === 0 ? (
              <p style={{ color: '#9CA3AF' }}>尚無運動項目記錄。</p>
            ) : (
              <div style={s.gameTagsWrap}>
                {Object.entries(gameCounts).map(([key, count]) => (
                  <span key={key} style={s.gameTag(key)}>
                    {gameKeyLabels[key] || key} × {count} 次
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* 復健進度圖表 */}
          <div style={s.section}>
            <div style={s.sectionTitle}>
              <span>📈</span> 復健進度圖表
              <span style={{ fontSize: '12px', color: '#9CA3AF', fontWeight: 400 }}>（最近 10 次）</span>
            </div>
            <div style={s.chartBox}>
              <ProgressChart chartData={chartData} />
            </div>
          </div>

          {/* 醫師評估備註 */}
          <div style={s.section}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div style={s.sectionTitle}>
                <span>📝</span> 醫師評估備註
              </div>
              {isDoctor && !editingNotes && (
                <button
                  style={s.editBtn}
                  onClick={() => {
                    setNotesDraft(doctorNotes);
                    setEditingNotes(true);
                    setNotesError('');
                  }}
                >
                  {doctorNotes ? '編輯備註' : '新增備註'}
                </button>
              )}
            </div>

            <div style={s.notesBox}>
              {editingNotes ? (
                <div>
                  <textarea
                    value={notesDraft}
                    onChange={(e) => setNotesDraft(e.target.value)}
                    placeholder="請輸入對此病患的復健評估與建議..."
                    style={s.notesTextarea}
                  />
                  {notesError && <div style={s.errorText}>{notesError}</div>}
                  <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                    <button onClick={handleSaveNotes} disabled={savingNotes} style={s.saveBtn}>
                      {savingNotes ? '儲存中...' : '儲存'}
                    </button>
                    <button
                      onClick={() => {
                        setEditingNotes(false);
                        setNotesDraft(doctorNotes);
                        setNotesError('');
                      }}
                      style={s.cancelBtn}
                    >
                      取消
                    </button>
                  </div>
                </div>
              ) : (
                <div style={doctorNotes ? s.notesText : s.notesEmpty}>
                  {doctorNotes || (isDoctor ? '尚未新增評估備註，點擊「新增備註」開始輸入。' : '醫師尚未新增評估備註。')}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Sessions Tab ── */}
      {activeTab === 'sessions' && (
        <div style={s.section}>
          {sessions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px', color: '#9CA3AF' }}>
              尚無已完成的遊戲記錄。
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={s.table}>
                <thead>
                  <tr>
                    <th style={s.th}>日期時間</th>
                    <th style={s.th}>遊戲項目</th>
                    <th style={s.th}>正確</th>
                    <th style={s.th}>錯誤</th>
                    <th style={s.th}>Miss</th>
                    <th style={s.th}>總計</th>
                    <th style={s.th}>正確率</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((session) => {
                    const st = sessionStats[session.id] || { correct: 0, wrong: 0, autoMiss: 0, total: 0 };
                    const rate = st.total > 0 ? Math.round((st.correct / st.total) * 100) : 0;
                    const gameKey = session.current_game_key || 'unknown';
                    return (
                      <tr key={session.id}>
                        <td style={s.td}>
                          {new Date(session.created_at).toLocaleString('zh-TW', {
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td style={s.td}>
                          <span style={s.gameTag(gameKey)}>
                            {gameKeyLabels[gameKey] || gameKey}
                          </span>
                        </td>
                        <td style={{ ...s.td, color: '#10B981', fontWeight: 600 }}>{st.correct}</td>
                        <td style={{ ...s.td, color: '#F59E0B', fontWeight: 600 }}>{st.wrong}</td>
                        <td style={{ ...s.td, color: '#EF4444', fontWeight: 600 }}>{st.autoMiss}</td>
                        <td style={s.td}>{st.total}</td>
                        <td style={s.td}>
                          <span style={s.badge(rate)}>{st.total > 0 ? `${rate}%` : '-'}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
