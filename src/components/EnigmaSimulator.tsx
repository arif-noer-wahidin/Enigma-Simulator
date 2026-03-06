import React, { useState, useEffect, useCallback, useRef } from 'react';
import { EnigmaMachine, EnigmaConfig, ROTORS, REFLECTORS, i2c, c2i, ALPHABET } from '../lib/enigma';
import { cn } from '../lib/utils';
import { Settings, RefreshCw, X, HelpCircle, Volume2, VolumeX, Lock, Share2, Download, Copy, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Sound effects (using simple oscillator for now or placeholder)
const playClickSound = (enabled: boolean) => {
  if (!enabled) return;
  // In a real app, we'd load an audio file. 
  // For now, we'll just use a very short beep if we could, but browsers block auto-audio.
  // We will skip actual audio implementation for this text-based response unless requested,
  // but I'll leave the hook for it.
};

const INITIAL_CONFIG: EnigmaConfig = {
  rotors: [
    { type: 'I', position: 0, ringSetting: 0 },
    { type: 'II', position: 0, ringSetting: 0 },
    { type: 'III', position: 0, ringSetting: 0 },
  ],
  reflector: 'B',
  plugboard: {},
};

export default function EnigmaSimulator() {
  const [config, setConfig] = useState<EnigmaConfig>(INITIAL_CONFIG);
  // Track the "Session Start" configuration (before typing)
  const [initialConfig, setInitialConfig] = useState<EnigmaConfig>(INITIAL_CONFIG);
  
  const [inputLog, setInputLog] = useState<string>('');
  const [outputLog, setOutputLog] = useState<string>('');
  const [activeLamp, setActiveLamp] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  
  // Secure Comm State
  const [importString, setImportString] = useState('');
  const [batchInput, setBatchInput] = useState('');
  const [batchOutput, setBatchOutput] = useState('');

  // Ref to hold the machine instance
  const machineRef = useRef(new EnigmaMachine(INITIAL_CONFIG));

  const handleKeyPress = useCallback((char: string) => {
    if (!ALPHABET.includes(char)) return;

    // Ensure machine has current config
    machineRef.current.setConfig(config);
    
    const { encryptedChar, newConfig } = machineRef.current.pressKey(char);
    
    playClickSound(soundEnabled);
    setConfig(newConfig); // Only update current config, NOT initialConfig
    setActiveLamp(encryptedChar);
    setInputLog(prev => prev + char);
    setOutputLog(prev => prev + encryptedChar);

    setTimeout(() => setActiveLamp(null), 200);
  }, [config, soundEnabled]);

  // Keyboard listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      // Don't trigger if typing in inputs
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      
      const char = e.key.toUpperCase();
      if (ALPHABET.includes(char)) {
        handleKeyPress(char);
      } else if (e.key === 'Backspace') {
        // Optional: Handle backspace
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyPress]);

  const updateRotor = (index: number, updates: Partial<typeof config.rotors[0]>) => {
    const newRotors = [...config.rotors];
    newRotors[index] = { ...newRotors[index], ...updates };
    const newConfig = { ...config, rotors: newRotors as [any, any, any] };
    setConfig(newConfig);
    setInitialConfig(newConfig); // Update base config on manual change
    machineRef.current.setConfig(newConfig);
  };

  const updatePlugboard = (char1: string, char2: string) => {
    const newPlugboard = { ...config.plugboard };
    
    const areAlreadyConnected = newPlugboard[char1] === char2;

    // Remove existing connections for these chars
    const removeConnection = (c: string) => {
      if (newPlugboard[c]) {
        const partner = newPlugboard[c];
        delete newPlugboard[c];
        delete newPlugboard[partner];
      }
    };

    removeConnection(char1);
    removeConnection(char2);

    // Only connect if they weren't already connected (toggle behavior)
    if (char1 !== char2 && !areAlreadyConnected) {
      newPlugboard[char1] = char2;
      newPlugboard[char2] = char1;
    }

    const newConfig = { ...config, plugboard: newPlugboard };
    setConfig(newConfig);
    setInitialConfig(newConfig); // Update base config on manual change
    machineRef.current.setConfig(newConfig);
  };

  const clearLogs = () => {
    setInputLog('');
    setOutputLog('');
  };

  const resetMachine = () => {
    setConfig(INITIAL_CONFIG);
    setInitialConfig(INITIAL_CONFIG); // Reset base
    machineRef.current.setConfig(INITIAL_CONFIG);
    clearLogs();
  };
  
  const resetToSessionStart = () => {
    setConfig(initialConfig);
    machineRef.current.setConfig(initialConfig);
    clearLogs();
  };

  // --- Secure Comm Functions ---

  const getExportString = () => {
    try {
      // Export the INITIAL config (Session Start), not the current drifted state
      return btoa(JSON.stringify(initialConfig));
    } catch (e) {
      return '';
    }
  };

  const handleImport = () => {
    try {
      if (!importString) return;
      const json = atob(importString);
      const newConfig = JSON.parse(json);
      // Basic validation
      if (newConfig.rotors && newConfig.rotors.length === 3 && newConfig.reflector) {
        setConfig(newConfig);
        setInitialConfig(newConfig); // Set as new base
        machineRef.current.setConfig(newConfig);
        alert('Settings loaded successfully!');
      } else {
        alert('Invalid settings format.');
      }
    } catch (e) {
      alert('Failed to import settings. Check the key string.');
    }
  };

  const handleBatchProcess = () => {
    if (!batchInput) return;
    
    // Use INITIAL config for batch processing to ensure consistent decryption
    // regardless of what the user has typed in the main UI
    const tempMachine = new EnigmaMachine(initialConfig);
    
    let result = '';
    for (const char of batchInput.toUpperCase()) {
      if (ALPHABET.includes(char)) {
        const { encryptedChar } = tempMachine.pressKey(char);
        result += encryptedChar;
      } else {
        result += char; // Pass through non-enigma chars (spaces, numbers)
      }
    }
    
    setBatchOutput(result);
  };

  return (
    <div className="min-h-screen bg-[#1a1b1e] text-gray-200 font-sans selection:bg-amber-500/30 flex flex-col items-center py-8 px-4">
      
      {/* Header */}
      <header className="w-full max-w-4xl flex justify-between items-center mb-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-amber-600 rounded-lg flex items-center justify-center shadow-lg shadow-amber-900/20">
            <span className="font-mono font-bold text-xl text-black">E</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-100">Enigma <span className="text-amber-600">M3</span></h1>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setIsHelpOpen(true)}
            className="p-2 rounded-full hover:bg-white/5 transition-colors text-gray-400 hover:text-gray-200"
            title="Panduan Penggunaan"
          >
            <HelpCircle size={20} />
          </button>
          <button 
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-2 rounded-full hover:bg-white/5 transition-colors text-gray-400 hover:text-gray-200"
            title={soundEnabled ? "Mute Sound" : "Enable Sound"}
          >
            {soundEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
          </button>
          <button 
            onClick={() => setIsSettingsOpen(true)}
            className="p-2 rounded-full hover:bg-white/5 transition-colors text-gray-400 hover:text-gray-200"
            title="Settings"
          >
            <Settings size={20} />
          </button>
        </div>
      </header>

      <main className="w-full max-w-4xl flex flex-col gap-8 pb-20">
        
        {/* Machine Interface */}
        <div className="bg-[#25262b] rounded-3xl p-8 shadow-2xl border border-white/5 relative overflow-hidden">
          {/* Background Texture/Gradient */}
          <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />
          
          {/* Rotors Section */}
          <div className="flex justify-center gap-4 mb-12 relative z-10">
            <div className="bg-black/40 p-4 rounded-xl border border-white/10 flex gap-4 shadow-inner">
              {config.rotors.map((rotor, index) => (
                <RotorUnit 
                  key={index} 
                  rotor={rotor} 
                  index={index} 
                  onChange={(updates) => updateRotor(index, updates)}
                />
              ))}
            </div>
          </div>

          {/* Lampboard */}
          <div className="mb-12 relative z-10">
            <KeyboardLayout 
              type="lamp" 
              activeKey={activeLamp} 
            />
          </div>

          {/* Keyboard */}
          <div className="relative z-10">
            <KeyboardLayout 
              type="input" 
              onKeyPress={handleKeyPress} 
            />
          </div>
          
          {/* Branding Plate */}
          <div className="absolute bottom-4 right-6 text-[10px] font-mono text-white/20 tracking-widest uppercase pointer-events-none">
            Enigma Simulator v1.0
          </div>
        </div>

        {/* Logs / Output */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-[#25262b] rounded-2xl p-6 border border-white/5">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider">Input</h3>
              <div className="flex gap-2">
                <button onClick={resetToSessionStart} className="text-xs text-gray-500 hover:text-gray-300 transition-colors" title="Reset rotors to session start">
                  <RefreshCw size={12} className="inline mr-1" /> Reset Rotors
                </button>
                <button onClick={clearLogs} className="text-xs text-amber-600 hover:text-amber-500 transition-colors">Clear</button>
              </div>
            </div>
            <div className="font-mono text-lg break-all min-h-[100px] text-gray-300">
              {inputLog || <span className="text-gray-700 italic">Type to start...</span>}
            </div>
          </div>
          <div className="bg-[#25262b] rounded-2xl p-6 border border-white/5">
            <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-4">Output</h3>
            <div className="font-mono text-lg break-all min-h-[100px] text-amber-500">
              {outputLog}
            </div>
          </div>
        </div>

        {/* Secure Communication Section */}
        <div className="bg-[#25262b] rounded-3xl p-8 shadow-2xl border border-white/5 mt-4">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-white/5">
                <div className="p-2 bg-amber-900/30 rounded-lg text-amber-500">
                    <Lock size={20} />
                </div>
                <div>
                    <h2 className="text-lg font-bold text-gray-100">Secure Communication</h2>
                    <p className="text-xs text-gray-500">Exchange keys and decrypt messages securely</p>
                </div>
            </div>
            
            {/* Key Management */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                <div className="space-y-3">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                        <Share2 size={12} /> Current Settings Key
                    </label>
                    <div className="flex gap-2">
                        <div className="flex-1 bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-gray-400 truncate select-all">
                            {getExportString()}
                        </div>
                        <button 
                            onClick={() => {
                                navigator.clipboard.writeText(getExportString());
                                // Could add toast here
                            }}
                            className="bg-amber-600 hover:bg-amber-700 text-white px-3 py-2 rounded-lg text-xs font-medium transition-colors flex items-center gap-2 whitespace-nowrap"
                        >
                            <Copy size={14} /> Copy
                        </button>
                    </div>
                    <p className="text-[10px] text-gray-600">
                        Copy this key and send it to your recipient so they can configure their machine exactly like yours.
                    </p>
                </div>

                <div className="space-y-3">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                        <Download size={12} /> Import Settings Key
                    </label>
                    <div className="flex gap-2">
                        <input 
                            value={importString}
                            onChange={(e) => setImportString(e.target.value)}
                            placeholder="Paste key here..."
                            className="flex-1 bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-gray-200 focus:border-amber-600 outline-none"
                        />
                        <button 
                            onClick={handleImport}
                            className="bg-white/10 hover:bg-white/20 text-white px-3 py-2 rounded-lg text-xs font-medium transition-colors flex items-center gap-2 whitespace-nowrap"
                        >
                            Load Key
                        </button>
                    </div>
                    <p className="text-[10px] text-gray-600">
                        Paste a key received from someone else to align your machine settings with theirs.
                    </p>
                </div>
            </div>

            {/* Batch Processing */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Message Translator</label>
                    <span className="text-[10px] text-amber-500 bg-amber-900/20 px-2 py-1 rounded border border-amber-900/50">
                      Uses Session Start Settings (Ignores current typing)
                    </span>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-[1fr,auto,1fr] gap-4 items-center">
                    <div className="relative group">
                        <textarea 
                            value={batchInput}
                            onChange={(e) => setBatchInput(e.target.value)}
                            className="w-full h-32 bg-black/20 border border-white/10 rounded-xl p-4 font-mono text-sm text-gray-300 focus:border-amber-600 outline-none resize-none transition-colors"
                            placeholder="Paste encrypted message here..."
                        />
                        <div className="absolute top-2 right-2 text-[10px] text-gray-600 bg-black/40 px-2 py-1 rounded pointer-events-none">Input</div>
                    </div>

                    <div className="flex justify-center">
                        <button 
                            onClick={handleBatchProcess}
                            className="bg-amber-600 hover:bg-amber-700 text-white p-3 rounded-full shadow-lg shadow-amber-900/20 transition-all hover:scale-110 active:scale-95"
                            title="Process Message"
                        >
                            <ArrowRight size={20} />
                        </button>
                    </div>

                    <div className="relative group">
                        <div className="w-full h-32 bg-black/40 border border-white/5 rounded-xl p-4 font-mono text-sm text-amber-500 overflow-y-auto select-all">
                            {batchOutput || <span className="text-gray-700 italic opacity-50">Decrypted text will appear here...</span>}
                        </div>
                        <div className="absolute top-2 right-2 text-[10px] text-gray-600 bg-black/40 px-2 py-1 rounded pointer-events-none">Result</div>
                    </div>
                </div>
            </div>
        </div>

      </main>

      {/* Settings Modal */}
      <AnimatePresence>
        {isSettingsOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setIsSettingsOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#25262b] w-full max-w-2xl rounded-2xl shadow-2xl border border-white/10 overflow-hidden flex flex-col max-h-[90vh]"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-6 border-b border-white/10 flex justify-between items-center">
                <h2 className="text-xl font-bold text-gray-100 flex items-center gap-2">
                  <Settings className="text-amber-600" /> Machine Configuration
                </h2>
                <button onClick={() => setIsSettingsOpen(false)} className="text-gray-400 hover:text-white">
                  <X size={24} />
                </button>
              </div>
              
              <div className="p-6 overflow-y-auto space-y-8">
                {/* Rotor Selection */}
                <section>
                  <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4">Rotor Selection</h3>
                  <div className="grid grid-cols-3 gap-4">
                    {config.rotors.map((rotor, index) => (
                      <div key={index} className="space-y-2">
                        <label className="text-xs text-gray-400">Slot {index + 1}</label>
                        <select 
                          value={rotor.type}
                          onChange={(e) => updateRotor(index, { type: e.target.value })}
                          className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-amber-600 outline-none"
                        >
                          {Object.keys(ROTORS).map(type => (
                            <option key={type} value={type}>Rotor {type}</option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                </section>

                {/* Reflector Selection */}
                <section>
                  <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4">Reflector</h3>
                  <div className="flex gap-4">
                    {Object.keys(REFLECTORS).map(type => (
                      <button
                        key={type}
                        onClick={() => {
                          const newConfig = { ...config, reflector: type };
                          setConfig(newConfig);
                          setInitialConfig(newConfig);
                          machineRef.current.setConfig(newConfig);
                        }}
                        className={cn(
                          "px-4 py-2 rounded-lg text-sm font-medium border transition-all",
                          config.reflector === type 
                            ? "bg-amber-600 border-amber-500 text-white" 
                            : "bg-black/20 border-white/10 text-gray-400 hover:bg-white/5"
                        )}
                      >
                        Reflector {type}
                      </button>
                    ))}
                  </div>
                </section>

                {/* Plugboard */}
                <section>
                  <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4">Steckerbrett (Plugboard)</h3>
                  <PlugboardEditor config={config} onConnect={updatePlugboard} />
                </section>
              </div>
              
              <div className="p-6 border-t border-white/10 bg-black/20 flex justify-between items-center">
                <button 
                  onClick={resetMachine}
                  className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1"
                >
                  <RefreshCw size={14} /> Reset to Default
                </button>
                <button 
                  onClick={() => setIsSettingsOpen(false)}
                  className="bg-white text-black px-6 py-2 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                >
                  Done
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {isHelpOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setIsHelpOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#25262b] w-full max-w-2xl rounded-2xl shadow-2xl border border-white/10 overflow-hidden flex flex-col max-h-[90vh]"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-6 border-b border-white/10 flex justify-between items-center">
                <h2 className="text-xl font-bold text-gray-100 flex items-center gap-2">
                  <HelpCircle className="text-amber-600" /> Panduan Penggunaan
                </h2>
                <button onClick={() => setIsHelpOpen(false)} className="text-gray-400 hover:text-white">
                  <X size={24} />
                </button>
              </div>
              
              <div className="p-6 overflow-y-auto space-y-6 text-gray-300 text-sm leading-relaxed">
                <section>
                  <h3 className="text-amber-500 font-bold mb-2 flex items-center gap-2">
                    <span className="bg-amber-900/30 w-6 h-6 rounded-full flex items-center justify-center text-xs">1</span>
                    Dasar Penggunaan
                  </h3>
                  <ul className="list-disc pl-9 space-y-1 text-gray-400">
                    <li>Ketik huruf menggunakan keyboard fisik Anda atau klik tombol pada layar.</li>
                    <li>Lampu yang menyala menunjukkan hasil enkripsi dari huruf yang ditekan.</li>
                    <li>Setiap ketikan akan memutar rotor satu langkah, mengubah pola enkripsi untuk huruf berikutnya.</li>
                  </ul>
                </section>

                <section>
                  <h3 className="text-amber-500 font-bold mb-2 flex items-center gap-2">
                    <span className="bg-amber-900/30 w-6 h-6 rounded-full flex items-center justify-center text-xs">2</span>
                    Pengaturan Mesin (Settings)
                  </h3>
                  <ul className="list-disc pl-9 space-y-1 text-gray-400">
                    <li>Klik ikon <Settings size={14} className="inline" /> di pojok kanan atas.</li>
                    <li><strong>Rotors:</strong> Atur jenis rotor (I-VIII) dan posisi awal ring.</li>
                    <li><strong>Reflector:</strong> Pilih jenis reflektor (B atau C) yang memantulkan sinyal kembali.</li>
                    <li><strong>Plugboard:</strong> Klik satu huruf lalu huruf lain untuk menghubungkan kabel. Ini menukar huruf sebelum masuk ke rotor.</li>
                  </ul>
                </section>

                <section>
                  <h3 className="text-amber-500 font-bold mb-2 flex items-center gap-2">
                    <span className="bg-amber-900/30 w-6 h-6 rounded-full flex items-center justify-center text-xs">3</span>
                    Komunikasi Rahasia
                  </h3>
                  <div className="pl-9 space-y-4">
                    <div className="bg-black/20 p-3 rounded-lg border border-white/5">
                      <strong className="text-gray-200 block mb-1">Mengirim Pesan:</strong>
                      <ol className="list-decimal pl-4 space-y-1 text-gray-400">
                        <li>Atur mesin sesuai keinginan (Rotor, Plugboard).</li>
                        <li>Salin <strong>"Current Settings Key"</strong> dan kirim ke teman Anda.</li>
                        <li>Ketik pesan rahasia di kolom <strong>"Message Translator"</strong> (Input).</li>
                        <li>Klik tombol panah <ArrowRight size={12} className="inline" />.</li>
                        <li>Salin hasil (Result) dan kirim ke teman Anda.</li>
                      </ol>
                    </div>
                    <div className="bg-black/20 p-3 rounded-lg border border-white/5">
                      <strong className="text-gray-200 block mb-1">Menerima Pesan:</strong>
                      <ol className="list-decimal pl-4 space-y-1 text-gray-400">
                        <li>Minta <strong>Key</strong> dari pengirim.</li>
                        <li>Tempel Key di kolom <strong>"Import Settings Key"</strong> dan klik <strong>"Load Key"</strong>.</li>
                        <li>Tempel pesan terenkripsi di kolom <strong>"Message Translator"</strong> (Input).</li>
                        <li>Klik tombol panah <ArrowRight size={12} className="inline" /> untuk membaca pesan asli.</li>
                      </ol>
                    </div>
                  </div>
                </section>

                <section>
                  <h3 className="text-amber-500 font-bold mb-2 flex items-center gap-2">
                    <span className="bg-amber-900/30 w-6 h-6 rounded-full flex items-center justify-center text-xs">4</span>
                    Tips Tambahan
                  </h3>
                  <ul className="list-disc pl-9 space-y-1 text-gray-400">
                    <li>Gunakan tombol <strong>"Reset Rotors"</strong> untuk mengembalikan posisi rotor ke awal sesi tanpa mengubah pengaturan kabel atau jenis rotor.</li>
                    <li>Enigma bersifat <em>reciprocal</em>: Jika A menjadi X, maka X akan menjadi A (dengan pengaturan yang sama).</li>
                  </ul>
                </section>
              </div>
              
              <div className="p-6 border-t border-white/10 bg-black/20 flex justify-end">
                <button 
                  onClick={() => setIsHelpOpen(false)}
                  className="bg-white text-black px-6 py-2 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                >
                  Tutup
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// --- Subcomponents ---

function RotorUnit({ rotor, index, onChange }: { rotor: any, index: number, onChange: (u: any) => void }) {
  const handleScroll = (e: React.WheelEvent) => {
    e.preventDefault();
    const direction = e.deltaY > 0 ? 1 : -1;
    const newPos = (rotor.position + direction + 26) % 26;
    onChange({ position: newPos });
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="text-xs font-mono text-gray-500 uppercase">Rotor {['L', 'M', 'R'][index]}</div>
      <div 
        className="w-16 h-24 bg-gradient-to-b from-[#1a1a1a] via-[#333] to-[#1a1a1a] rounded-lg border-x-2 border-gray-700 shadow-xl flex flex-col items-center justify-center relative overflow-hidden cursor-ns-resize group"
        onWheel={handleScroll}
      >
        {/* Visual representation of the wheel */}
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20"></div>
        
        {/* Previous Letter */}
        <div className="text-gray-600 font-mono text-sm blur-[1px] -translate-y-6 absolute">
          {i2c((rotor.position - 1 + 26) % 26)}
        </div>
        
        {/* Current Letter */}
        <div className="text-2xl font-mono font-bold text-white z-10 bg-black/50 w-full text-center py-1 border-y border-white/10">
          {i2c(rotor.position)}
        </div>
        
        {/* Next Letter */}
        <div className="text-gray-600 font-mono text-sm blur-[1px] translate-y-6 absolute">
          {i2c((rotor.position + 1) % 26)}
        </div>

        {/* Controls for non-mouse-wheel users */}
        <div className="absolute inset-0 flex flex-col opacity-0 group-hover:opacity-100 transition-opacity">
          <button 
            className="flex-1 bg-white/5 hover:bg-white/10 active:bg-white/20"
            onClick={() => onChange({ position: (rotor.position - 1 + 26) % 26 })}
          />
          <button 
            className="flex-1 bg-white/5 hover:bg-white/10 active:bg-white/20"
            onClick={() => onChange({ position: (rotor.position + 1) % 26 })}
          />
        </div>
      </div>
      <div className="text-[10px] text-gray-500 font-mono">
        {rotor.type} / {i2c(rotor.ringSetting)}
      </div>
    </div>
  );
}

function KeyboardLayout({ type, activeKey, onKeyPress }: { type: 'input' | 'lamp', activeKey?: string | null, onKeyPress?: (c: string) => void }) {
  const rows = [
    'QWERTZUIO',
    'ASDFGHJK',
    'PYXCVBNML'
  ]; // Enigma layout is slightly different usually QWERTZUIO ASDFGHJK PYXCVBNML

  return (
    <div className="flex flex-col gap-3 items-center select-none">
      {rows.map((row, rowIndex) => (
        <div key={rowIndex} className="flex gap-3">
          {row.split('').map((char) => (
            <Key 
              key={char} 
              char={char} 
              type={type} 
              active={activeKey === char}
              onClick={() => onKeyPress?.(char)}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function Key({ char, type, active, onClick }: { char: string, type: 'input' | 'lamp', active: boolean, onClick?: () => void }) {
  if (type === 'lamp') {
    return (
      <div 
        className={cn(
          "w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg transition-all duration-100 border-2",
          active 
            ? "bg-amber-400 border-amber-300 text-amber-900 shadow-[0_0_20px_rgba(251,191,36,0.8)] scale-105 z-10" 
            : "bg-black/40 border-white/10 text-white/20 shadow-inner"
        )}
      >
        {char}
      </div>
    );
  }

  return (
    <button
      onMouseDown={onClick}
      className={cn(
        "w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg transition-all duration-75 border-4 relative",
        "bg-gray-200 border-[#4a4a4a] text-gray-800 shadow-[0_4px_0_#2a2a2a] active:shadow-none active:translate-y-[4px]",
        "hover:bg-white"
      )}
    >
      {char}
    </button>
  );
}

function SettingsModal({ 
  config, 
  onClose, 
  onUpdateRotor, 
  onUpdatePlugboard, 
  onUpdateReflector,
  onReset
}: { 
  config: EnigmaConfig, 
  onClose: () => void, 
  onUpdateRotor: (i: number, u: any) => void,
  onUpdatePlugboard: (a: string, b: string) => void,
  onUpdateReflector: (r: string) => void,
  onReset: () => void
}) {
  return (
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
        className="bg-[#1a1b1e] w-full max-w-2xl rounded-2xl border border-white/10 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6 border-b border-white/10 flex justify-between items-center bg-[#25262b]">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Settings className="text-amber-600" /> Machine Settings
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X /></button>
        </div>

        <div className="p-6 overflow-y-auto space-y-8 custom-scrollbar">
          
          {/* Rotor Selection */}
          <section>
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Rotors & Ring Settings</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {config.rotors.map((rotor, index) => (
                <div key={index} className="bg-black/20 p-4 rounded-xl border border-white/5">
                  <div className="text-xs text-amber-600 font-bold mb-2 uppercase">Position {['Left', 'Middle', 'Right'][index]}</div>
                  
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Rotor Type</label>
                      <select 
                        value={rotor.type}
                        onChange={(e) => onUpdateRotor(index, { type: e.target.value })}
                        className="w-full bg-[#25262b] border border-white/10 rounded px-2 py-1 text-sm text-gray-200 focus:border-amber-600 outline-none"
                      >
                        {Object.keys(ROTORS).map(type => (
                          <option key={type} value={type}>Rotor {type}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Ring Setting (Ringstellung)</label>
                      <select 
                        value={rotor.ringSetting}
                        onChange={(e) => onUpdateRotor(index, { ringSetting: parseInt(e.target.value) })}
                        className="w-full bg-[#25262b] border border-white/10 rounded px-2 py-1 text-sm text-gray-200 focus:border-amber-600 outline-none"
                      >
                        {ALPHABET.split('').map((char, i) => (
                          <option key={i} value={i}>{char} ({i + 1})</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Reflector */}
          <section>
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Reflector (Umkehrwalze)</h3>
            <div className="flex gap-4">
              {Object.keys(REFLECTORS).map(type => (
                <button
                  key={type}
                  onClick={() => onUpdateReflector(type)}
                  className={cn(
                    "px-4 py-2 rounded-lg border text-sm font-medium transition-colors",
                    config.reflector === type 
                      ? "bg-amber-600 border-amber-500 text-white" 
                      : "bg-black/20 border-white/10 text-gray-400 hover:bg-white/5"
                  )}
                >
                  Reflector {type}
                </button>
              ))}
            </div>
          </section>

          {/* Plugboard */}
          <section>
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Plugboard (Steckerbrett)</h3>
            <div className="bg-black/20 p-6 rounded-xl border border-white/5">
              <PlugboardEditor config={config} onConnect={onUpdatePlugboard} />
            </div>
          </section>

          {/* Danger Zone */}
          <section className="pt-4 border-t border-white/10">
             <button 
               onClick={() => { onReset(); onClose(); }}
               className="w-full py-3 rounded-lg border border-red-900/50 text-red-500 hover:bg-red-900/20 transition-colors text-sm font-medium"
             >
               Reset Machine to Defaults
             </button>
          </section>
        </div>
      </motion.div>
    </motion.div>
  );
}

function PlugboardEditor({ config, onConnect }: { config: EnigmaConfig, onConnect: (a: string, b: string) => void }) {
  const [selected, setSelected] = useState<string | null>(null);

  const rows = [
    'QWERTZUIO',
    'ASDFGHJK',
    'PYXCVBNML'
  ];

  // Helper to get coordinates (0-100 scale)
  const getPos = (char: string) => {
    const rowIndex = rows.findIndex(r => r.includes(char));
    if (rowIndex === -1) return { x: 0, y: 0 };
    
    const row = rows[rowIndex];
    const charIndex = row.indexOf(char);
    
    // Row 1 (9 chars): 10% to 90%
    // Row 2 (8 chars): 15% to 85%
    // Row 3 (9 chars): 10% to 90%
    
    const y = 20 + (rowIndex * 30); // 20, 50, 80
    
    let x = 0;
    if (rowIndex === 0 || rowIndex === 2) {
      // 9 items
      const step = 100 / 9;
      x = (charIndex * step) + (step / 2);
    } else {
      // 8 items
      const step = 100 / 8; // Spread slightly wider? Or keep tight?
      // To stagger nicely like a keyboard:
      // Row 1 centers: 5.5, 16.6, 27.7...
      // Row 2 centers should be between Row 1.
      // Let's just use a simple spread for now.
      // 8 items centered in 100% width.
      // Margin left/right to center the block of 8.
      const widthOfBlock = 8 * (100/9); // Same key spacing as row 1
      const startX = (100 - widthOfBlock) / 2;
      x = startX + (charIndex * (100/9)) + ((100/9)/2);
    }
    
    return { x, y };
  };

  const handleSelect = (char: string) => {
    if (selected === null) {
      setSelected(char);
    } else if (selected === char) {
      setSelected(null);
    } else {
      onConnect(selected, char);
      setSelected(null);
    }
  };

  const isConnected = (char: string) => !!config.plugboard[char];
  const getConnection = (char: string) => config.plugboard[char];

  // Get unique pairs for lines
  const pairs: [string, string][] = [];
  const seen = new Set<string>();
  Object.entries(config.plugboard).forEach(([a, b]) => {
    if (!seen.has(a) && !seen.has(b)) {
      pairs.push([a, b]);
      seen.add(a);
      seen.add(b);
    }
  });

  return (
    <div className="flex flex-col gap-4">
      {/* Connection List */}
      <div className="flex flex-wrap gap-2 min-h-[24px] text-sm font-mono text-amber-500 justify-end">
        {pairs.map(([a, b]) => (
          <span key={a+b} className="bg-amber-900/30 px-2 py-0.5 rounded border border-amber-700/50">
            {a}{b}
          </span>
        ))}
        {pairs.length === 0 && <span className="text-gray-600 italic">No connections</span>}
      </div>

      {/* Visual Board */}
      <div className="relative w-full aspect-[2/1] bg-[#1a1b1e] rounded-xl border border-white/10 shadow-inner overflow-hidden select-none">
        
        {/* SVG Layer for Lines */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
          {pairs.map(([a, b]) => {
            const start = getPos(a);
            const end = getPos(b);
            
            // Calculate control point for curve
            // If on same row, curve down/up. If different, curve slightly.
            const midX = (start.x + end.x) / 2;
            const midY = (start.y + end.y) / 2;
            
            // Add some curve intensity based on distance
            const dist = Math.sqrt(Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2));
            const curveOffset = 10 + (dist * 0.2); 
            
            // Direction of curve
            const controlY = midY + curveOffset;

            return (
              <path
                key={a+b}
                d={`M ${start.x}% ${start.y}% Q ${midX}% ${controlY}% ${end.x}% ${end.y}%`}
                fill="none"
                stroke="#f59e0b" // amber-500
                strokeWidth="3"
                strokeLinecap="round"
                className="opacity-80"
              />
            );
          })}
          {/* Active selection line (optional, follows mouse? too complex for now. Just highlight start) */}
        </svg>

        {/* Buttons Layer */}
        {rows.map(row => row.split('').map(char => {
          const pos = getPos(char);
          const connectedTo = getConnection(char);
          const isSel = selected === char;
          const isConn = !!connectedTo;

          return (
            <button
              key={char}
              onClick={() => handleSelect(char)}
              style={{ 
                left: `${pos.x}%`, 
                top: `${pos.y}%`,
                transform: 'translate(-50%, -50%)'
              }}
              className={cn(
                "absolute w-10 h-10 md:w-12 md:h-12 rounded-full flex flex-col items-center justify-center text-sm font-bold border-2 transition-all z-10 shadow-lg",
                isSel ? "bg-white text-black border-white scale-110 ring-4 ring-amber-500/50" :
                isConn ? "bg-amber-950 border-amber-600 text-amber-500" :
                "bg-[#25262b] border-white/10 text-gray-400 hover:border-gray-400 hover:bg-[#2c2e33]"
              )}
            >
              <span>{char}</span>
              {connectedTo && <span className="text-[8px] leading-none opacity-70 mt-[-2px]">{connectedTo}</span>}
            </button>
          );
        }))}
      </div>
      
      <div className="text-center text-xs text-gray-500">
        Click a letter to select, then click another to connect. Click a connected letter to disconnect.
      </div>
    </div>
  );
}
