import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { socket } from '../lib/socket';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Play, Square, RotateCcw, ChevronRight, Volume2, VolumeX, ShieldAlert, Trash2 } from 'lucide-react';
import { playWinnerSound } from '../lib/sounds';

export default function HostDashboard() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const navigate = useNavigate();
  const [roomState, setRoomState] = useState<any>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [error, setError] = useState('');

  // Sounds handled by Web Audio API

  useEffect(() => {
    const hostToken = localStorage.getItem('buzzer_hostToken');
    
    if (!hostToken || !roomCode) {
      navigate('/');
      return;
    }

    if (!socket.connected) {
      socket.connect();
    }

    const onConnect = () => {
      // Reconnect host
      socket.emit('host:reconnect', { roomCode, hostToken }, (response: any) => {
        if (response.success) {
          setRoomState(response.room);
        } else {
          setError(response.message);
          setTimeout(() => navigate('/'), 2000);
        }
      });
    };

    const onStateUpdate = (newRoomState: any) => {
      setRoomState(newRoomState);
    };

    const onWinnerDeclared = () => {
      if (soundEnabled) {
        playWinnerSound();
      }
    };

    socket.on('connect', onConnect);
    socket.on('room:stateUpdate', onStateUpdate);
    socket.on('room:winnerDeclared', onWinnerDeclared);

    if (socket.connected) {
      onConnect();
    }

    return () => {
      socket.off('connect', onConnect);
      socket.off('room:stateUpdate', onStateUpdate);
      socket.off('room:winnerDeclared', onWinnerDeclared);
    };
  }, [roomCode, navigate, soundEnabled]);

  const handleActivate = () => socket.emit('host:activateBuzzer', { roomCode });
  const handleLock = () => socket.emit('host:lockBuzzer', { roomCode });
  const handleReset = () => socket.emit('host:resetBuzzer', { roomCode });
  const handleNextQuestion = () => socket.emit('host:nextQuestion', { roomCode });
  
  const handleUpdateScore = (teamId: string, scoreDelta: number) => {
    socket.emit('host:updateScore', { roomCode, teamId, scoreDelta });
  };
  
  const handleRemoveTeam = (teamId: string) => {
    if(window.confirm('Remove this team?')) {
      socket.emit('host:removeTeam', { roomCode, teamId });
    }
  };

  if (error) {
    return <div className="min-h-screen flex items-center justify-center text-danger font-bold">{error}</div>;
  }

  if (!roomState) {
    return <div className="min-h-screen flex items-center justify-center text-slate-400">Loading Dashboard...</div>;
  }

  const teamsList = Object.values(roomState.teams) as any[];
  const connectedTeamsCount = teamsList.filter(t => t.connected).length;
  
  // Find current question's buzzes to show history
  const currentQuestionBuzzes = roomState.buzzHistory
    .filter((b: any) => b.questionNumber === roomState.currentQuestion)
    .sort((a: any, b: any) => a.sequenceNumber - b.sequenceNumber);

  const winnerTeam = roomState.winnerTeamId ? roomState.teams[roomState.winnerTeamId] : null;

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row">
      
      {/* Sidebar / Team List */}
      <div className="w-full md:w-80 bg-slate-900 border-r border-slate-800 flex flex-col">
        <div className="p-6 border-b border-slate-800">
          <h1 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-primary to-purple-500 mb-1">
            QUIZ NIGHT
          </h1>
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xs uppercase font-bold text-slate-500">Room</span>
            <span className="bg-slate-800 px-2 py-1 rounded text-primary font-mono font-bold tracking-widest">{roomCode}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <div className="w-2 h-2 bg-success rounded-full"></div>
            Connected: <span className="text-white font-bold">{connectedTeamsCount}</span> teams
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Leaderboard</h3>
          {teamsList.sort((a,b) => b.score - a.score).map((team) => (
            <div key={team.id} className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-3 flex items-center justify-between group">
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${team.connected ? 'bg-success' : 'bg-danger'}`} />
                <div>
                  <div className="font-bold text-white text-sm truncate max-w-[120px]">{team.name}</div>
                  <div className="text-xs text-slate-500 font-mono">pts: {team.score}</div>
                </div>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => handleUpdateScore(team.id, -5)} className="w-6 h-6 rounded bg-danger/20 text-danger flex items-center justify-center hover:bg-danger/40 transition">-</button>
                <button onClick={() => handleUpdateScore(team.id, 10)} className="w-6 h-6 rounded bg-success/20 text-success flex items-center justify-center hover:bg-success/40 transition">+</button>
                <button onClick={() => handleRemoveTeam(team.id)} className="w-6 h-6 ml-1 rounded text-slate-500 hover:text-danger flex items-center justify-center transition"><Trash2 size={14}/></button>
              </div>
            </div>
          ))}
          {teamsList.length === 0 && (
            <div className="text-center py-8 text-slate-500 text-sm">
              <Users className="mx-auto mb-2 opacity-50" size={24} />
              Waiting for teams to join...
            </div>
          )}
        </div>

        <div className="p-4 border-t border-slate-800">
          <button 
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
          >
            {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
            Sound: {soundEnabled ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>

      {/* Main Control Area */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden relative">
        {/* Background glow based on state */}
        <div className="absolute inset-0 z-0 pointer-events-none transition-colors duration-1000" style={{
          background: roomState.buzzerActive 
            ? 'radial-gradient(circle at center, rgba(34,197,94,0.1) 0%, transparent 70%)' 
            : roomState.winnerTeamId
            ? 'radial-gradient(circle at center, rgba(59,130,246,0.15) 0%, transparent 70%)'
            : 'radial-gradient(circle at center, rgba(15,23,42,1) 0%, transparent 100%)'
        }} />

        <div className="p-8 z-10 flex flex-col h-full">
          
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-3xl font-black text-white flex items-center gap-4">
              QUESTION <span className="bg-slate-800 px-4 py-1 rounded-xl text-primary">{roomState.currentQuestion}</span>
            </h2>
            <button 
              onClick={handleNextQuestion}
              className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg font-bold transition"
            >
              Next Question <ChevronRight size={18} />
            </button>
          </div>

          {/* Winner Display Area */}
          <div className="flex-1 flex flex-col items-center justify-center mb-8 min-h-[300px]">
            <AnimatePresence mode="wait">
              {winnerTeam ? (
                <motion.div 
                  key="winner"
                  initial={{ scale: 0.8, opacity: 0, y: 20 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  className="w-full max-w-2xl bg-gradient-to-br from-primary/20 to-blue-900/40 border border-primary/50 rounded-3xl p-12 text-center shadow-[0_0_50px_rgba(59,130,246,0.3)] glass relative overflow-hidden"
                >
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary to-transparent" />
                  <h3 className="text-primary font-black uppercase tracking-[0.3em] mb-4 text-sm">First to Buzz</h3>
                  <div className="text-6xl font-black text-white mb-6 tracking-tight drop-shadow-md">
                    {winnerTeam.name}
                  </div>
                  
                  {/* Action buttons for host to evaluate */}
                  <div className="flex items-center justify-center gap-4 mt-8">
                    <button 
                      onClick={() => handleUpdateScore(winnerTeam.id, 10)}
                      className="bg-success/20 hover:bg-success text-success hover:text-white border border-success/50 font-bold px-6 py-3 rounded-xl transition-all"
                    >
                      ✓ Correct (+10)
                    </button>
                    <button 
                      onClick={() => handleUpdateScore(winnerTeam.id, -5)}
                      className="bg-danger/20 hover:bg-danger text-danger hover:text-white border border-danger/50 font-bold px-6 py-3 rounded-xl transition-all"
                    >
                      ✗ Wrong (-5)
                    </button>
                  </div>
                </motion.div>
              ) : (
                <motion.div 
                  key="idle"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center"
                >
                  <div className={`w-32 h-32 mx-auto rounded-full flex items-center justify-center mb-6 transition-all duration-500 ${
                    roomState.buzzerActive 
                      ? 'bg-success/20 shadow-[0_0_40px_rgba(34,197,94,0.4)] animate-pulse' 
                      : 'bg-slate-800 shadow-inner'
                  }`}>
                    <ShieldAlert size={48} className={roomState.buzzerActive ? 'text-success' : 'text-slate-600'} />
                  </div>
                  <h3 className={`text-2xl font-black tracking-widest uppercase ${
                    roomState.buzzerActive ? 'text-success' : 'text-slate-500'
                  }`}>
                    {roomState.buzzerActive ? 'Buzzer is Active' : 'Waiting...'}
                  </h3>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Big Controls Area */}
          <div className="grid grid-cols-3 gap-4 h-32 shrink-0">
            {!roomState.buzzerActive && !roomState.winnerTeamId ? (
              <button 
                onClick={handleActivate}
                className="col-span-3 bg-gradient-to-r from-success to-green-600 hover:from-green-500 hover:to-green-700 text-white text-2xl font-black rounded-2xl shadow-xl shadow-success/20 transition-transform active:scale-95 flex items-center justify-center gap-3 uppercase tracking-wider"
              >
                <Play fill="currentColor" /> Activate Buzzer
              </button>
            ) : roomState.buzzerActive ? (
              <button 
                onClick={handleLock}
                className="col-span-3 bg-gradient-to-r from-danger to-red-600 hover:from-red-500 hover:to-red-700 text-white text-2xl font-black rounded-2xl shadow-xl shadow-danger/20 transition-transform active:scale-95 flex items-center justify-center gap-3 uppercase tracking-wider"
              >
                <Square fill="currentColor" /> Lock Buzzer
              </button>
            ) : (
              <button 
                onClick={handleReset}
                className="col-span-3 bg-gradient-to-r from-slate-700 to-slate-800 hover:from-slate-600 hover:to-slate-700 text-white text-2xl font-black rounded-2xl shadow-xl shadow-slate-900/50 transition-transform active:scale-95 flex items-center justify-center gap-3 uppercase tracking-wider"
              >
                <RotateCcw /> Reset Buzzer
              </button>
            )}
          </div>
          
          {/* Buzz History (Optional for bottom area) */}
          {currentQuestionBuzzes.length > 0 && (
            <div className="mt-8 pt-6 border-t border-slate-800/50">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Buzz Order</h4>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {currentQuestionBuzzes.map((buzz: any, index: number) => {
                  const team = roomState.teams[buzz.teamId];
                  if (!team) return null;
                  return (
                    <div key={buzz.id} className={`shrink-0 px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 border ${
                      buzz.result === 'winner' ? 'bg-primary/20 border-primary text-primary' :
                      buzz.result === 'late' ? 'bg-slate-800 border-slate-700 text-slate-400' :
                      'bg-danger/10 border-danger/30 text-danger'
                    }`}>
                      <span className="opacity-50">#{index + 1}</span>
                      {team.name}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
