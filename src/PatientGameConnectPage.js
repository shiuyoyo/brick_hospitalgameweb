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

function reduceGameState(prev, action) {
  const p = action.payload || {};
  const nextType = p.gameLayout || action.game_key || prev?.type || null;

  const typeChanged = prev?.type && nextType && prev.type !== nextType;

  let baseState;

  if (typeChanged) {
    if (nextType === 'single_color' || nextType === 'multi_color') {
      baseState = {
        type: nextType,
        activeIndex: 0,
        score: 0,
        mistakes: 0,
        progress: 0,
        total: 15,
        items: []
      };
    } else if (nextType === 'shapes_single') {
      baseState = {
        type: nextType,
        activeIndex: 0,
        score: 0,
        mistakes: 0,
        progress: 0,
        total: 15,
        items: []
      };
    } else if (nextType === 'shapes_multi' || nextType === 'shapes_multi_color') {
      baseState = {
        type: nextType,
        activeIndex: 0,
        score: 0,
        mistakes: 0,
        progress: 0,
        total: 15,
        items: []
      };
    } else if (nextType === 'thin_circle') {
      baseState = {
        type: nextType,
        activeIndex: 0,
        score: 0,
        mistakes: 0,
        progress: 0,
        total: 30,
        items: []
      };
    } else {
      baseState = {
        type: nextType,
        activeIndex: 0,
        score: 0,
        mistakes: 0,
        progress: 0,
        total: 0,
        items: []
      };
    }
  } else {
    baseState = prev || {
      type: nextType,
      activeIndex: 0,
      score: 0,
      mistakes: 0,
      progress: 0,
      total: 0,
      items: []
    };
  }

  let total = p.total ?? baseState.total ?? 0;

  if (!total) {
    if (nextType === 'single_color' || nextType === 'multi_color') total = 15;
    else if (nextType === 'shapes_single' || nextType === 'shapes_multi' || nextType === 'shapes_multi_color') total = 15;
    else if (nextType === 'thin_circle') total = 30;
    else total = 0;
  }

  return {
    type: nextType,
    activeIndex: p.activeIndex ?? p.currentIndex ?? baseState.activeIndex ?? 0,
    score: p.score ?? baseState.score ?? 0,
    mistakes: p.mistakes ?? baseState.mistakes ?? 0,
    progress: p.progress ?? baseState.progress ?? 0,
    total,
    items: p.items ?? baseState.items ?? []
  };
}

export default function PatientGameConnectPage({ patient, user, onBack }) {
  const [gameState, setGameState] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('waiting');
  const [latestAction, setLatestAction] = useState(null);
  const [events, setEvents] = useState([]);
  const [stats, setStats] = useState({ correct: 0, wrong: 0, autoMiss: 0, total: 0 });

  const channelRef = useRef(null);
  const sessionChannelRef = useRef(null);
  const statusRef = useRef('waiting');

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

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
      setGameState(null);
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

            setGameState((prev) => reduceGameState(prev, action));
            setLatestAction(action);
            setEvents((prev) => [action, ...prev].slice(0, 12));
            setStats((prev) => ({
              correct: prev.correct + (action.action_type === 'tap_correct' ? 1 : 0),
              wrong: prev.wrong + (action.action_type === 'tap_wrong' ? 1 : 0),
              autoMiss: prev.autoMiss + (action.action_type === 'auto_miss' ? 1 : 0),
              total: prev.total + 1
            }));

            let nextStatus = statusRef.current;
            if (action.action_type === 'start') nextStatus = 'playing';
            else if (action.action_type === 'end') nextStatus = 'ended';
            else nextStatus = statusRef.current === 'waiting' ? 'connected' : statusRef.current;

            setStatus(nextStatus);
            setSession((prev) => ({
              ...(prev || {}),
              status: nextStatus,
              current_game_key: action.game_key || prev?.current_game_key || null
            }));

            const currentGame =
              action.game_key === 'single_color' ? 1 :
              action.game_key === 'multi_color' ? 1 :
              action.game_key === 'shapes_single' ? 2 :
              (action.game_key === 'shapes_multi' || action.game_key === 'shapes_multi_color') ? 2 :
              action.game_key === 'thin_circle' ? 3 : 0;

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
          <button
            onClick={onBack}
            style={{ padding: '10px 16px', borderRadius: '8px', border: 'none', background: '#E5E7EB', cursor: 'pointer' }}
          >
            返回病患列表
          </button>
          <button
            onClick={handleReset}
            style={{ padding: '10px 16px', borderRadius: '8px', border: 'none', background: '#F59E0B', color: 'white', cursor: 'pointer' }}
          >
            重新產生配對碼
          </button>
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
        <div style={box}>
          <GameRenderer state={gameState} />
        </div>

        <p style={{ color: '#6B7280', marginTop: '8px' }}>
          這一版會直接依 App 傳來的 payload 畫出同步畫面；收到 start / tap_correct / tap_wrong / auto_miss / end 後，畫面會立即更新。
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
              <div style={{ marginTop: '6px', color: '#374151' }}>
                game_key: {event.game_key || '-'} ／ level: {event.level_name || '-'}
              </div>
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

function GameRenderer({ state }) {
  if (!state) {
    return <div>等待遊戲開始...</div>;
  }

  // ===== thin_circle：兩排圓點 + 一顆紅點 =====
  if (state.type === 'thin_circle') {
    const total = state.total || 30;
    const progress = state.progress ?? state.activeIndex ?? 0;

    const topRowCount = Math.ceil(total / 2);
    const bottomRowCount = total - topRowCount;

    return (
      <div style={{ width: 760, margin: '0 auto', padding: '12px 0' }}>
        <div
          style={{
            borderTop: '6px solid #1D4ED8',
            borderRight: '6px solid #1D4ED8',
            borderBottom: '6px solid #1D4ED8',
            padding: '20px 24px 28px 24px'
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${topRowCount}, 1fr)`,
              gap: 12,
              marginBottom: 20
            }}
          >
            {Array.from({ length: topRowCount }).map((_, i) => {
              const isActive = progress === i;
              return (
                <div
                  key={`top-${i}`}
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: '50%',
                    background: isActive ? '#F97316' : '#E5E7EB',
                    margin: '0 auto',
                    border: isActive ? '2px solid #EA580C' : '1px solid #D1D5DB'
                  }}
                />
              );
            })}
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${bottomRowCount}, 1fr)`,
              gap: 12
            }}
          >
            {Array.from({ length: bottomRowCount }).map((_, i) => {
              const absoluteIndex = topRowCount + i;
              const isActive = progress === absoluteIndex;
              return (
                <div
                  key={`bottom-${i}`}
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: '50%',
                    background: isActive ? '#F97316' : '#E5E7EB',
                    margin: '0 auto',
                    border: isActive ? '2px solid #EA580C' : '1px solid #D1D5DB'
                  }}
                />
              );
            })}
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: 12, color: '#374151', fontWeight: 600 }}>
          {progress} / {total}
        </div>
      </div>
    );
  }

  // ===== shapes_single：固定 3x5 =====
  if (state.type === 'shapes_single') {
    const activeIndex = state.activeIndex ?? 0;
    const total = 15;
    const fallbackShapes = ['hexagon', 'rect', 'triangle', 'square', 'circle'];

    return (
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 120px)',
          gap: 22,
          justifyContent: 'center',
          alignItems: 'center',
          padding: '12px 0'
        }}
      >
        {Array.from({ length: total }).map((_, i) => {
          const col = i % 5;
          const shapeType = state.items?.[i]?.type || fallbackShapes[col];
          const isActive = i === activeIndex;

          return (
            <ShapeCell
              key={i}
              type={shapeType}
              active={isActive}
              color={isActive ? '#F87171' : '#FFFFFF'}
              stroke={isActive ? '#DC2626' : '#D1D5DB'}
            />
          );
        })}
      </div>
    );
  }

  // ===== shapes_multi / shapes_multi_color：先固定 3x5 fallback =====
  if (state.type === 'shapes_multi' || state.type === 'shapes_multi_color') {
    const activeIndex = state.activeIndex ?? 0;
    const total = 15;
    const fallbackShapes = ['hexagon', 'rect', 'triangle', 'square', 'circle'];

    return (
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 120px)',
          gap: 22,
          justifyContent: 'center',
          alignItems: 'center',
          padding: '12px 0'
        }}
      >
        {Array.from({ length: total }).map((_, i) => {
          const col = i % 5;
          const item = state.items?.[i];
          const shapeType = item?.type || fallbackShapes[col];
          const color = item?.color || '#FFFFFF';
          const isActive = i === activeIndex;

          return (
            <ShapeCell
              key={i}
              type={shapeType}
              active={isActive}
              color={isActive ? color : '#FFFFFF'}
              stroke={isActive ? '#111827' : '#D1D5DB'}
            />
          );
        })}
      </div>
    );
  }

  // ===== single_color / multi_color：15 顆圓 =====
  if (state.type === 'single_color' || state.type === 'multi_color') {
    const total = state.total || 15;
    const activeIndex = state.activeIndex ?? 0;

    return (
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 110px)',
          gap: 24,
          justifyContent: 'center',
          alignItems: 'center',
          padding: '12px 0'
        }}
      >
        {Array.from({ length: total }).map((_, i) => {
          const isActive = i === activeIndex;
          return (
            <div
              key={i}
              style={{
                width: 90,
                height: 90,
                borderRadius: '50%',
                background: isActive ? '#F87171' : '#E5E7EB',
                border: isActive ? '4px solid #DC2626' : '2px solid #CFCFCF',
                boxShadow: isActive ? '0 0 0 3px rgba(239,68,68,0.15)' : 'none',
                transition: 'all 0.2s ease'
              }}
            />
          );
        })}
      </div>
    );
  }

  return (
    <div style={{ color: '#6B7280', textAlign: 'center', padding: '24px 0' }}>
      尚未支援的遊戲類型：{state.type || '-'}
    </div>
  );
}

function ShapeCell({ type, active, color, stroke }) {
  const wrapStyle = {
    width: 110,
    height: 110,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    opacity: active ? 1 : 0.95,
    transition: 'all 0.2s ease'
  };

  const svgStyle = {
    width: 96,
    height: 96,
    overflow: 'visible'
  };

  const fill = color || '#FFFFFF';
  const border = stroke || '#D1D5DB';

  if (type === 'circle') {
    return (
      <div style={wrapStyle}>
        <svg viewBox="0 0 100 100" style={svgStyle}>
          <circle cx="50" cy="50" r="38" fill={fill} stroke={border} strokeWidth="3" />
        </svg>
      </div>
    );
  }

  if (type === 'triangle') {
    return (
      <div style={wrapStyle}>
        <svg viewBox="0 0 100 100" style={svgStyle}>
          <polygon points="50,10 90,85 10,85" fill={fill} stroke={border} strokeWidth="3" />
        </svg>
      </div>
    );
  }

  if (type === 'square') {
    return (
      <div style={wrapStyle}>
        <svg viewBox="0 0 100 100" style={svgStyle}>
          <rect x="15" y="15" width="70" height="70" fill={fill} stroke={border} strokeWidth="3" />
        </svg>
      </div>
    );
  }

  if (type === 'rect') {
    return (
      <div style={wrapStyle}>
        <svg viewBox="0 0 100 100" style={svgStyle}>
          <rect x="25" y="10" width="50" height="80" fill={fill} stroke={border} strokeWidth="3" />
        </svg>
      </div>
    );
  }

  if (type === 'hexagon') {
    return (
      <div style={wrapStyle}>
        <svg viewBox="0 0 100 100" style={svgStyle}>
          <polygon
            points="50,8 84,28 84,72 50,92 16,72 16,28"
            fill={fill}
            stroke={border}
            strokeWidth="3"
          />
        </svg>
      </div>
    );
  }

  if (type === 'diamond') {
    return (
      <div style={wrapStyle}>
        <svg viewBox="0 0 100 100" style={svgStyle}>
          <polygon points="50,8 88,50 50,92 12,50" fill={fill} stroke={border} strokeWidth="3" />
        </svg>
      </div>
    );
  }

  return (
    <div style={wrapStyle}>
      <svg viewBox="0 0 100 100" style={svgStyle}>
        <rect x="15" y="15" width="70" height="70" fill={fill} stroke={border} strokeWidth="3" />
      </svg>
    </div>
  );
}
