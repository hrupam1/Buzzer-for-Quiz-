import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export default function Home() {
  const [roomCode, setRoomCode] = useState('');
  const [teamName, setTeamName] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomCode || !teamName) {
      setError('Please enter both room code and team name.');
      return;
    }
    setError('');

    const uppercaseRoomCode = roomCode.toUpperCase();
    
    // We generate a teamId if one doesn't exist
    if (!localStorage.getItem('buzzer_teamId')) {
      localStorage.setItem('buzzer_teamId', crypto.randomUUID());
    }
    
    localStorage.setItem('buzzer_roomCode', uppercaseRoomCode);
    localStorage.setItem('buzzer_teamName', teamName);
    
    navigate(`/team/${uppercaseRoomCode}`);
  };

  const handleCreateRoom = () => {
    const newRoomCode = generateRoomCode();
    localStorage.setItem('buzzer_hostToken', crypto.randomUUID());
    localStorage.setItem('buzzer_roomCode', newRoomCode);
    navigate(`/host/${newRoomCode}`);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-4 w-full text-center z-20">
        <p className="text-slate-400/80 text-xs font-bold tracking-[0.3em] uppercase">Created by Rupam Haldar</p>
      </div>
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-primary/30 rounded-full blur-[100px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-danger/20 rounded-full blur-[100px]" />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass w-full max-w-md p-8 rounded-2xl shadow-2xl relative z-10"
      >
        <div className="text-center mb-8">
          <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-primary to-purple-500 mb-2 tracking-tight">
            QUIZ BUZZER
          </h1>
          <p className="text-slate-400 font-medium">Real-time fair competition</p>
        </div>

        {error && (
          <div className="mb-6 p-3 bg-danger/10 border border-danger/30 text-danger rounded-xl text-sm font-medium text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleJoinRoom} className="space-y-5">
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2 ml-1">ROOM CODE</label>
            <input
              type="text"
              placeholder="ABC123"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value)}
              className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3.5 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all uppercase tracking-widest font-bold"
              maxLength={6}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2 ml-1">TEAM NAME</label>
            <input
              type="text"
              placeholder="Quiz Masters"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3.5 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all font-medium"
              maxLength={20}
            />
          </div>

          <button
            type="submit"
            className="w-full bg-gradient-to-r from-primary to-primary-hover hover:from-primary-hover hover:to-blue-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-primary/25 transition-all transform active:scale-95 flex items-center justify-center gap-2"
          >
            JOIN QUIZ
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-slate-700/50 text-center">
          <p className="text-slate-400 text-sm mb-4">Are you the quiz master?</p>
          <button
            onClick={handleCreateRoom}
            className="text-primary hover:text-white font-semibold transition-colors flex items-center justify-center gap-2 mx-auto"
          >
            Create a New Room
          </button>
        </div>
      </motion.div>
    </div>
  );
}
