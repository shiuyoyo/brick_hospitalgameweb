
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from './supabaseClient';

const randomCode = () => String(Math.floor(100000 + Math.random() * 900000));

const box = {
  background: 'white',
  borderRadius: '12px',
  padding: '24px',
  boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
};

const badgeColor = (status) => {
  if (status === 'waiting') return '#F59E0B';
  if (status === 'connected') return '#0EA5E9';
  if (status === 'playing') return '#10B981';
  if (status === 'ended') return '#6B7280';
  return '#6B7280';
};

export default function PatientGameConnectPage({ patient, user, onBack }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('waiting');
  const [latestAction, setLatestAction] = useState(null);
  const [events, setEvents] = useState([]);
  const [stats, setStats] = useState({ correct: 0, wrong: 0, autoMiss: 0, total: 0 });
  const channelRef = useRef(null);
  const sessionChannelRef = useRef(null);

  const monitor = useMemo(() => {
    const gameKey = latestAction?.game_key || session?.current_game_key || '-';
    return {
      gameKey,
      correct: stats.correct,
      wrong: stats.wrong,
      autoMiss: stats.autoMiss,
      total: stats.total,
      latestType: latestAction?.action_type || '-',
      latestAt: latestAction?.created_at ? new Date(latestAction.created_at).toLocaleString() : '-',
      levelName: latestAction?.level_name || '-',
      userId: latestAction?.user_id || patient?.user_id || patient?.id || '-'
    };
  }, [latestAction, session, stats, patient]);

 useEffect(() => {
  if (!patient) return;
  let isMounted = true;

  const cleanup = async () => {
    if (!isMounted) return;

    if (channelRef.current) {
      await supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    if (sessionChannelRef.current) {
      await supabase.removeChannel(sessionChannelRef.current);
      sessionChannelRef.current = null;
    }
  };


    const createSession = async () => {
      setLoading(true);
      setError('');
      setSession(null);
      setStatus('waiting');
      setLatestAction(null);
      setEvents([]);
      setStats({ correct: 0, wrong: 0, autoMiss: 0, total: 0 });
      await cleanup();

      let inserted = null;
      for (let i = 0; i < 5 && !inserted; i += 1) {
        const code = randomCode();
        const payload = {
          code,
          status: 'waiting',
          patient_id: patient?.user_id || patient?.id || null,
          patient_name: patient?.full_name || patient?.surname || null,
          doctor_user_id: user?.id || null,
          current_game: 0,
          current_game_key: null
        };

        const { data, error: insertError } = await supabase
          .from('game_sessions')
          .insert(payload)
          .select('*')
          .single();

        if (!insertError && data) {
          inserted = data;
        }
      }

      if (!isMounted) return;

      if (!inserted) {
        setError('無法建立配對碼，請稍後再試。');
        setLoading(false);
        return;
      }

      setSession(inserted);
      setStatus(inserted.status || 'waiting');
      setLoading(false);

      sessionChannelRef.current = supabase
        .channel(`game-session-${inserted.id}`)
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'game_sessions', filter: `id=eq.${inserted.id}` },
          (payload) => {
            const next = payload.new;
            setSession((prev) => ({ ...(prev || {}), ...next }));
            setStatus(next.status || 'waiting');
          }
        )
        .subscribe();

      channelRef.current = supabase
        .channel(`game-actions-${inserted.id}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'game_actions', filter: `session_id=eq.${inserted.id}` },
          async (payload) => {
            const action = payload.new;
            setLatestAction(action);
            setEvents((prev) => [action, ...prev].slice(0, 12));
            setStats((prev) => ({
              correct: prev.correct + (action.action_type === 'tap_correct' ? 1 : 0),
              wrong: prev.wrong + (action.action_type === 'tap_wrong' ? 1 : 0),
              autoMiss: prev.autoMiss + (action.action_type === 'auto_miss' ? 1 : 0),
              total: prev.total + 1
            }));

            let nextStatus;
            setStatus(prevStatus => {
              nextStatus = action.action_type === 'start' ? 'playing'
                : action.action_type === 'end' ? 'ended'
                : prevStatus === 'waiting' ? 'connected' : prevStatus;
              return nextStatus;
            });
            setSession((prev) => ({
              ...(prev || {}),
              status: nextStatus,
              current_game_key: action.game_key || prev?.current_game_key || null
            }));

            const currentGame = action.game_key === 'single_color' ? 1 : action.game_key === 'multi_color' ? 1 : action.game_key === 'shapes_single' ? 2 : action.game_key === 'shapes_multi_color' ? 2 : action.game_key === 'thin_circle' ? 3 : 0;

            await supabase
              .from('game_sessions')
              .update({
                status: nextStatus,
                current_game: currentGame,
                current_game_key: action.game_key || null,
                last_action_type: action.action_type || null,
                last_action_at: action.created_at || new Date().toISOString(),
                updated_at: new Date().toISOString()
              })
              .eq('id', inserted.id);
          }
        )
        .subscribe();
    };

    createSession();
    return () => {
      isMounted = false;
      cleanup();
    };
  }, [patient, user]);

  const handleReset = async () => {
    if (!session?.id) return;
    setLoading(true);
    await supabase.from('game_sessions').delete().eq('id', session.id);
    setLoading(false);
    window.location.reload();
  };

  return (
    <div style={box}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: 0, color: '#1F2937' }}>病患遊戲連線</h2>
          <p style={{ marginTop: '8px', color: '#6B7280' }}>
            病患：{patient?.full_name || patient?.surname || '-'} ／ 身分證：{patient?.username || '-'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={onBack} style={{ padding: '10px 16px', borderRadius: '8px', border: 'none', background: '#E5E7EB', cursor: 'pointer' }}>返回病患列表</button>
          <button onClick={handleReset} style={{ padding: '10px 16px', borderRadius: '8px', border: 'none', background: '#F59E0B', color: 'white', cursor: 'pointer' }}>重新產生配對碼</button>
        </div>
      </div>

      {error ? <div style={{ marginTop: '16px', color: '#DC2626' }}>{error}</div> : null}

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px', marginTop: '24px' }}>
        <div style={{ border: '1px solid #E5E7EB', borderRadius: '16px', padding: '24px', background: '#F9FAFB' }}>
          <div style={{ color: '#6B7280', fontSize: '14px', marginBottom: '8px' }}>配對碼</div>
          <div style={{ fontSize: '56px', fontWeight: 700, letterSpacing: '10px', color: '#111827' }}>
            {loading ? '......' : session?.code || '------'}
          </div>
          <div style={{ marginTop: '16px', display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderRadius: '999px', background: '#fff', border: '1px solid #E5E7EB' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: badgeColor(status), display: 'inline-block' }} />
            <span style={{ color: '#374151', fontWeight: 600 }}>狀態：{status}</span>
          </div>
          <div style={{ marginTop: '16px', color: '#6B7280', lineHeight: 1.8 }}>
            <div>waiting：等待 App 輸入配對碼</div>
            <div>connected：已配對，等待遊戲開始</div>
            <div>playing：遊戲進行中</div>
            <div>ended：本局已結束</div>
          </div>
        </div>

        <div style={{ border: '1px solid #E5E7EB', borderRadius: '16px', padding: '24px', background: '#FFFFFF' }}>
          <h3 style={{ marginTop: 0, color: '#1F2937' }}>即時監看面板</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div><strong>目前遊戲：</strong><br />{monitor.gameKey}</div>
            <div><strong>目前關卡：</strong><br />{monitor.levelName}</div>
            <div><strong>正確：</strong><br />{monitor.correct}</div>
            <div><strong>錯誤：</strong><br />{monitor.wrong}</div>
            <div><strong>自動 miss：</strong><br />{monitor.autoMiss}</div>
            <div><strong>總事件：</strong><br />{monitor.total}</div>
            <div><strong>最新事件：</strong><br />{monitor.latestType}</div>
            <div><strong>最新時間：</strong><br />{monitor.latestAt}</div>
          </div>
        </div>
      </div>

      <div style={{ marginTop: '24px', border: '1px solid #E5E7EB', borderRadius: '16px', padding: '24px', background: '#FFFFFF' }}>
        <h3 style={{ marginTop: 0, color: '#1F2937' }}>遊戲畫面同步區（事件版）</h3>
        <p style={{ color: '#6B7280', marginTop: '8px' }}>
          這一版先顯示病患端的即時事件與狀態；收到 App 的 start / tap_correct / tap_wrong / auto_miss / end 後，畫面會立即更新。
        </p>
        <div style={{ marginTop: '16px', display: 'grid', gap: '10px' }}>
          {events.length === 0 ? (
            <div style={{ padding: '20px', borderRadius: '12px', background: '#F9FAFB', color: '#6B7280' }}>
              尚未收到遊戲事件。請在 App 端輸入配對碼後開始遊戲。
            </div>
          ) : events.map((event) => (
            <div key={event.id} style={{ border: '1px solid #E5E7EB', borderRadius: '12px', padding: '14px 16px', background: '#F9FAFB' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
                <strong>{event.action_type}</strong>
                <span style={{ color: '#6B7280' }}>{new Date(event.created_at).toLocaleTimeString()}</span>
              </div>
              <div style={{ marginTop: '6px', color: '#374151' }}>game_key: {event.game_key || '-'} ／ level: {event.level_name || '-'}</div>
              <pre style={{ marginTop: '10px', padding: '12px', borderRadius: '8px', background: '#111827', color: '#F9FAFB', overflowX: 'auto', fontSize: '12px' }}>
{JSON.stringify(event.payload || {}, null, 2)}
              </pre>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
