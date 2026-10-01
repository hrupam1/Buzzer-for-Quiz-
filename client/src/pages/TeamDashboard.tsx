import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { Wifi, WifiOff } from 'lucide-react';
import { playBuzzSound, playLockSound } from '../lib/sounds';

export default function TeamDashboard() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const navigate = useNavigate();
  const [isConnected, setIsConnected] = useState(false);
  const [roomState, setRoomState] = useState<any>(null);
  
  const savedTeamId = localStorage.getItem('buzzer_teamId');
  const savedName = localStorage.getItem('buzzer_teamName') || 'Unknown Team';
  
  const [buzzStatus, setBuzzStatus] = useState<'idle' | 'sending' | 'locked' | 'winner'>('idle');
  const channelRef = useRef<any>(null);

  useEffect(() => {
    if (!savedTeamId || !roomCode) {
      navigate('/');
      return;
    }

    const channel = supabase.channel(`room:${roomCode}`);
    channelRef.current = channel;

    channel
      .on('broadcast', { event: 'sync' }, ({ payload }) => {
        setRoomState(payload);
        
        if (payload.buzzerActive) {
          setBuzzStatus('idle');
        } else if (payload.winnerTeamId === savedTeamId) {
          setBuzzStatus('winner');
        } else {
          setBuzzStatus('locked');
        }
      })
      .on('broadcast', { event: 'winnerDeclared' }, ({ payload }) => {
        if (payload.teamId === savedTeamId) {
           setBuzzStatus('winner');
        } else {
           setBuzzStatus('locked');
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          setIsConnected(true);
          await channel.track({ teamId: savedTeamId, teamName: savedName });
          // Request current state from host
          channel.send({ type: 'broadcast', event: 'requestSync', payload: {} });
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          setIsConnected(false);
        }
      });

    return () => {
      channel.unsubscribe();
    };
  }, [roomCode, navigate, savedTeamId, savedName]);

  const handleBuzz = () => {
    if (buzzStatus !== 'idle' || !roomState?.buzzerActive || !channelRef.current) return;
    
    setBuzzStatus('sending');
    playBuzzSound();
    
    channelRef.current.send({
      type: 'broadcast',
      event: 'buzz',
      payload: { teamId: savedTeamId }
    }).then(() => {
       // We don't get a direct callback for success, but the host will send a sync or winnerDeclared
       // If no response within a short time, the host might be lagging
    }).catch(() => {
       setBuzzStatus('locked');
    });
  };

  if (!roomState) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="animate-pulse flex flex-col items-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-slate-400 font-medium">Connecting to host...</p>
          <p className="text-slate-500 text-sm mt-2">Make sure the Host is currently in the room.</p>
        </div>
      </div>
    );
  }

  const isBuzzerActive = roomState.buzzerActive;
  const isWinner = roomState.winnerTeamId === savedTeamId;
  const hasWinner = roomState.winnerTeamId !== null;

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background selection:bg-primary/30">
      <header className="p-4 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between sticky top-0 z-50 glass">
        <div>
          <h2 className="font-bold text-white text-lg tracking-tight truncate max-w-[200px] uppercase">
            {savedName}
          </h2>
          <div className="flex items-center text-xs font-medium mt-1">
            {isConnected ? (
              <span className="text-success flex items-center gap-1"><Wifi size={12} /> Connected</span>
            ) : (
              <span className="text-danger flex items-center gap-1"><WifiOff size={12} /> Reconnecting...</span>
            )}
            <span className="mx-2 text-slate-600">|</span>
            <span className="text-slate-400">Score: <span className="text-white font-bold">{roomState.teams[savedTeamId || '']?.score || 0}</span></span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-slate-400 font-semibold mb-1 uppercase tracking-wider">Room</div>
          <div className="font-mono text-sm font-bold bg-slate-800 px-2 py-1 rounded text-primary border border-slate-700">
            {roomCode}
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-6 relative overflow-hidden">
        <div className="absolute top-8 left-0 w-full text-center z-10 px-4">
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-[0.2em] mb-2">
            Question {roomState.currentQuestion}
          </h3>
          <AnimatePresence mode="wait">
            {!isBuzzerActive && !hasWinner && (
              <motion.div
                key="waiting"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="inline-block bg-slate-800/80 px-4 py-2 rounded-full border border-slate-700 shadow-lg"
              >
                <span className="text-slate-300 font-semibold flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse"></span>
                  WAITING FOR HOST
                </span>
              </motion.div>
            )}
            {isBuzzerActive && (
              <motion.div
                key="active"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="inline-block bg-success/20 px-4 py-2 rounded-full border border-success/30 shadow-[0_0_15px_rgba(34,197,94,0.3)]"
              >
                <span className="text-success font-bold flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-success"></span>
                  BUZZ NOW!
                </span>
              </motion.div>
            )}
            {hasWinner && !isWinner && (
              <motion.div
                key="locked"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="inline-block bg-danger/20 px-4 py-2 rounded-full border border-danger/30"
              >
                <span className="text-danger font-bold flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-danger"></span>
                  BUZZER LOCKED
                </span>
              </motion.div>
            )}
            {isWinner && (
              <motion.div
                key="winner"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="inline-block bg-primary/20 px-4 py-2 rounded-full border border-primary/50 shadow-[0_0_20px_rgba(59,130,246,0.5)]"
              >
                <span className="text-primary font-black uppercase tracking-widest flex items-center gap-2">
                  🌟 FIRST TO BUZZ
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="relative w-full max-w-sm aspect-square mt-12 flex items-center justify-center">
          {isBuzzerActive && (
             <motion.div 
               animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.6, 0.3] }} 
               transition={{ repeat: Infinity, duration: 2 }}
               className="absolute inset-0 bg-success/20 rounded-full blur-3xl z-0" 
             />
          )}
          {isWinner && (
             <motion.div 
               animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.8, 0.5], rotate: [0, 90, 0] }} 
               transition={{ repeat: Infinity, duration: 4 }}
               className="absolute inset-0 bg-primary/30 rounded-full blur-3xl z-0" 
             />
          )}
          
          <motion.button
            whileTap={isBuzzerActive && buzzStatus === 'idle' ? { scale: 0.92 } : {}}
            onClick={handleBuzz}
            disabled={!isBuzzerActive || buzzStatus !== 'idle' || !isConnected}
            className={`relative z-10 w-full h-full rounded-full flex items-center justify-center shadow-2xl transition-all duration-300 border-8 ${
              isBuzzerActive && buzzStatus === 'idle'
                ? 'bg-gradient-to-b from-success to-green-700 border-green-400 shadow-[0_20px_50px_rgba(34,197,94,0.5),inset_0_10px_20px_rgba(255,255,255,0.3)] hover:brightness-110 active:shadow-[0_5px_15px_rgba(34,197,94,0.5),inset_0_2px_5px_rgba(0,0,0,0.5)]'
                : isWinner
                ? 'bg-gradient-to-b from-primary to-blue-700 border-blue-400 shadow-[0_0_60px_rgba(59,130,246,0.6),inset_0_10px_20px_rgba(255,255,255,0.4)]'
                : 'bg-slate-800 border-slate-700 shadow-inner opacity-80 cursor-not-allowed'
            }`}
          >
            <span className={`text-4xl sm:text-6xl font-black uppercase tracking-wider ${
              isBuzzerActive || isWinner ? 'text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)]' : 'text-slate-600'
            }`}>
              {isWinner ? 'YOU!' : 'BUZZ'}
            </span>
          </motion.button>
        </div>

        <div className="mt-12 text-center h-20">
          <AnimatePresence mode="wait">
            {hasWinner && !isWinner && (
               <motion.div 
                 key="lost"
                 initial={{ opacity: 0, y: 10 }}
                 animate={{ opacity: 1, y: 0 }}
                 className="bg-slate-800/50 rounded-xl p-4 border border-slate-700"
               >
                 <p className="text-slate-300 mb-1">
                   <span className="font-bold text-white">{roomState.teams[roomState.winnerTeamId]?.name || 'Another team'}</span> buzzed first.
                 </p>
                 <p className="text-xs text-slate-500 uppercase font-bold tracking-widest">Wait for host</p>
               </motion.div>
            )}
            {isWinner && (
               <motion.div 
                key="won"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-primary/10 rounded-xl p-4 border border-primary/30"
               >
                 <p className="text-primary-100 font-bold mb-1 text-lg">
                   You got it!
                 </p>
                 <p className="text-xs text-primary/70 uppercase font-bold tracking-widest">Wait for host's decision</p>
               </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
