import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabaseClient';

const GAME_KEY_LABELS = {
  single_color: '單色積木',
  multi_color: '多色積木',
  shapes_single: '圖形（單色）',
  shapes_multi_color: '圖形（多色）',
  thin_circle: '細圓環',
};

const STATUS_LABELS = {
  waiting: '等待連線',
  connected: '已連線',
  playing: '遊戲中',
  ended: '已完成',
};

const statusColor = (status) => {
  if (status === 'waiting') return '#F59E0B';
  if (status === 'connected') return '#0EA5E9';
  if (status === 'playing') return '#10B981';
  if (status === 'ended') return '#6B7280';
  return '#6B7280';
};

const RehabDashboard = ({ user, onLogout }) => {
  const [sessions, setSessions] = useState([]);
  const [sessionStats, setSessionStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState(null);
  const [actions, setActions] = useState([]);
  const [actionsLoading, setActionsLoading] = useState(false);
  const [profile, setProfile] = useState(null);

  const patientId = user?.id;
  const username = user?.user_metadata?.username || '';
  const fullName = user?.user_metadata?.full_name || '用戶';

  const loadProfile = useCallback(async () => {
    const { data } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', patientId)
      .single();
    if (data) setProfile(data);
  }, [patientId]);

  const loadSessions = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('game_sessions')
        .select('*')
        .or(`patient_id.eq.${patientId},patient_id.eq.${username}`)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('載入遊戲記錄錯誤:', error);
        setSessions([]);
      } else {
        setSessions(data || []);

        // 為每個 session 計算統計
        if (data && data.length > 0) {
          const statsMap = {};
          await Promise.all(
            data.map(async (s) => {
              const { data: acts } = await supabase
                .from('game_actions')
                .select('action_type')
                .eq('session_id', s.id);
              if (acts) {
                statsMap[s.id] = acts.reduce(
                  (acc, a) => {
                    if (a.action_type === 'tap_correct') acc.correct += 1;
                    else if (a.action_type === 'tap_wrong') acc.wrong += 1;
                    else if (a.action_type === 'auto_miss') acc.autoMiss += 1;
                    acc.total += 1;
                    return acc;
                  },
                  { correct: 0, wrong: 0, autoMiss: 0, total: 0 }
                );
              }
            })
          );
          setSessionStats(statsMap);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [patientId, username]);

  const loadActions = useCallback(async (sessionId) => {
    setActionsLoading(true);
    const { data } = await supabase
      .from('game_actions')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });
    setActions(data || []);
    setActionsLoading(false);
  }, []);

  useEffect(() => {
    loadProfile();
    loadSessions();
  }, [loadProfile, loadSessions]);

  const handleSessionClick = (session) => {
    setSelectedSession(session);
    loadActions(session.id);
  };

  // 計算整體統計
  const overallStats = sessions.reduce(
    (acc, s) => {
      const st = sessionStats[s.id];
      if (st) {
        acc.correct += st.correct;
        acc.wrong += st.wrong;
        acc.autoMiss += st.autoMiss;
        acc.total += st.total;
      }
      if (s.status === 'ended') acc.completedSessions += 1;
      return acc;
    },
    { correct: 0, wrong: 0, autoMiss: 0, total: 0, completedSessions: 0 }
  );

  const accuracy =
    overallStats.correct + overallStats.wrong > 0
      ? Math.round((overallStats.correct / (overallStats.correct + overallStats.wrong)) * 100)
      : 0;

  const styles = {
    page: { minHeight: '100vh', backgroundColor: '#F3F4F6' },
    navbar: {
      backgroundColor: 'white',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      padding: '16px 24px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    navTitle: { fontWeight: '700', fontSize: '18px', color: '#4F46E5' },
    navUser: { display: 'flex', alignItems: 'center', gap: '12px' },
    logoutBtn: {
      background: 'none',
      border: '1px solid #E5E7EB',
      borderRadius: '8px',
      padding: '6px 14px',
      cursor: 'pointer',
      color: '#DC2626',
      fontSize: '14px',
    },
    container: { maxWidth: '960px', margin: '0 auto', padding: '24px 16px' },
    greeting: { fontSize: '22px', fontWeight: '700', color: '#1F2937', marginBottom: '4px' },
    subGreeting: { fontSize: '14px', color: '#6B7280', marginBottom: '24px' },
    statsRow: { display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' },
    statCard: (color) => ({
      flex: '1 1 160px',
      backgroundColor: 'white',
      borderRadius: '12px',
      padding: '20px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
      borderTop: `4px solid ${color}`,
    }),
    statValue: { fontSize: '32px', fontWeight: '800', color: '#1F2937' },
    statLabel: { fontSize: '13px', color: '#6B7280', marginTop: '4px' },
    sectionTitle: { fontSize: '16px', fontWeight: '700', color: '#1F2937', marginBottom: '12px' },
    sessionList: { display: 'flex', flexDirection: 'column', gap: '10px' },
    sessionCard: (selected) => ({
      backgroundColor: 'white',
      borderRadius: '10px',
      padding: '16px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
      cursor: 'pointer',
      border: selected ? '2px solid #4F46E5' : '2px solid transparent',
      transition: 'border-color 0.15s',
    }),
    badge: (color) => ({
      display: 'inline-block',
      backgroundColor: color + '20',
      color: color,
      borderRadius: '6px',
      padding: '2px 10px',
      fontSize: '12px',
      fontWeight: '600',
    }),
    detailPanel: {
      backgroundColor: 'white',
      borderRadius: '12px',
      padding: '20px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
      marginTop: '20px',
    },
    actionRow: (type) => ({
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      padding: '8px 0',
      borderBottom: '1px solid #F3F4F6',
      color:
        type === 'tap_correct'
          ? '#10B981'
          : type === 'tap_wrong'
          ? '#EF4444'
          : type === 'auto_miss'
          ? '#F59E0B'
          : '#6B7280',
    }),
  };

  const actionLabel = (type) => {
    if (type === 'tap_correct') return '✅ 正確';
    if (type === 'tap_wrong') return '❌ 錯誤';
    if (type === 'auto_miss') return '⏱ 超時';
    if (type === 'start') return '▶ 開始';
    if (type === 'end') return '⏹ 結束';
    return type;
  };

  return (
    <div style={styles.page}>
      {/* 導覽列 */}
      <nav style={styles.navbar}>
        <span style={styles.navTitle}>積木復健系統</span>
        <div style={styles.navUser}>
          <span style={{ fontSize: '14px', color: '#374151' }}>
            {fullName}（{username}）
          </span>
          <button onClick={onLogout} style={styles.logoutBtn}>
            登出
          </button>
        </div>
      </nav>

      <div style={styles.container}>
        <p style={styles.greeting}>您好，{fullName} 👋</p>
        <p style={styles.subGreeting}>
          以下是您的復健遊戲記錄，共 {sessions.length} 次訓練
          {profile?.disability_level !== undefined && profile?.disability_level !== null
            ? `，動作障礙等級：等級 ${profile.disability_level}`
            : ''}
        </p>

        {/* 整體統計 */}
        <div style={styles.statsRow}>
          <div style={styles.statCard('#4F46E5')}>
            <div style={styles.statValue}>{sessions.length}</div>
            <div style={styles.statLabel}>總訓練次數</div>
          </div>
          <div style={styles.statCard('#10B981')}>
            <div style={styles.statValue}>{overallStats.completedSessions}</div>
            <div style={styles.statLabel}>完成場次</div>
          </div>
          <div style={styles.statCard('#0EA5E9')}>
            <div style={styles.statValue}>{overallStats.correct}</div>
            <div style={styles.statLabel}>正確次數</div>
          </div>
          <div style={styles.statCard('#EF4444')}>
            <div style={styles.statValue}>{overallStats.wrong + overallStats.autoMiss}</div>
            <div style={styles.statLabel}>錯誤 / 超時</div>
          </div>
          <div style={styles.statCard('#F59E0B')}>
            <div style={styles.statValue}>{accuracy}%</div>
            <div style={styles.statLabel}>正確率</div>
          </div>
        </div>

        {/* 訓練記錄列表 */}
        <p style={styles.sectionTitle}>訓練記錄</p>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#6B7280' }}>
            載入中...
          </div>
        ) : sessions.length === 0 ? (
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              padding: '40px',
              textAlign: 'center',
              color: '#6B7280',
              boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
            }}
          >
            尚無訓練記錄，請聯繫您的醫師進行配對訓練。
          </div>
        ) : (
          <div style={styles.sessionList}>
            {sessions.map((s) => {
              const st = sessionStats[s.id] || { correct: 0, wrong: 0, autoMiss: 0, total: 0 };
              const acc =
                st.correct + st.wrong > 0
                  ? Math.round((st.correct / (st.correct + st.wrong)) * 100)
                  : null;
              const color = statusColor(s.status);
              return (
                <div
                  key={s.id}
                  style={styles.sessionCard(selectedSession?.id === s.id)}
                  onClick={() => handleSessionClick(s)}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      flexWrap: 'wrap',
                      gap: '8px',
                    }}
                  >
                    <div>
                      <span style={styles.badge(color)}>
                        {STATUS_LABELS[s.status] || s.status}
                      </span>
                      <span
                        style={{ marginLeft: '10px', fontSize: '14px', color: '#1F2937', fontWeight: '600' }}
                      >
                        {s.current_game_key
                          ? GAME_KEY_LABELS[s.current_game_key] || s.current_game_key
                          : '配對碼：' + s.code}
                      </span>
                    </div>
                    <span style={{ fontSize: '12px', color: '#9CA3AF' }}>
                      {s.created_at ? new Date(s.created_at).toLocaleString('zh-TW') : ''}
                    </span>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      gap: '16px',
                      marginTop: '10px',
                      fontSize: '13px',
                      color: '#374151',
                    }}
                  >
                    <span>✅ 正確 {st.correct}</span>
                    <span>❌ 錯誤 {st.wrong}</span>
                    <span>⏱ 超時 {st.autoMiss}</span>
                    {acc !== null && <span style={{ fontWeight: '700', color: '#4F46E5' }}>正確率 {acc}%</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 詳細動作記錄 */}
        {selectedSession && (
          <div style={styles.detailPanel}>
            <p style={{ ...styles.sectionTitle, marginBottom: '4px' }}>
              詳細動作記錄
            </p>
            <p style={{ fontSize: '13px', color: '#6B7280', marginBottom: '14px' }}>
              配對碼：{selectedSession.code}｜
              遊戲：{GAME_KEY_LABELS[selectedSession.current_game_key] || selectedSession.current_game_key || '—'}｜
              時間：{selectedSession.created_at ? new Date(selectedSession.created_at).toLocaleString('zh-TW') : ''}
            </p>
            {actionsLoading ? (
              <div style={{ textAlign: 'center', padding: '20px', color: '#6B7280' }}>載入中...</div>
            ) : actions.length === 0 ? (
              <div style={{ color: '#9CA3AF', fontSize: '14px' }}>此場次無動作記錄</div>
            ) : (
              <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
                {actions.map((a, i) => (
                  <div key={a.id || i} style={styles.actionRow(a.action_type)}>
                    <span style={{ minWidth: '70px', fontWeight: '600' }}>{actionLabel(a.action_type)}</span>
                    {a.level_name && (
                      <span style={{ color: '#374151', fontSize: '13px' }}>關卡：{a.level_name}</span>
                    )}
                    {a.game_key && (
                      <span style={{ color: '#6B7280', fontSize: '12px' }}>
                        {GAME_KEY_LABELS[a.game_key] || a.game_key}
                      </span>
                    )}
                    <span style={{ marginLeft: 'auto', fontSize: '12px', color: '#9CA3AF' }}>
                      {a.created_at ? new Date(a.created_at).toLocaleTimeString('zh-TW') : ''}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default RehabDashboard;
