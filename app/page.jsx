"use client";

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const welcomeMessage = [
  'Welcome to TerminalX!',
  'Connected to Python backend. Press Tab for auto-completion.',
  ''
];

export default function HomePage() {
  const [history, setHistory] = useState(welcomeMessage);
  const [command, setCommand] = useState('');
  const [commandHistory, setCommandHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [currentPath, setCurrentPath] = useState('~'); 
  
  const inputRef = useRef(null);
  const endOfHistoryRef = useRef(null);

  useEffect(() => {
    const focusInput = () => inputRef.current?.focus();
    window.addEventListener('click', focusInput);
    focusInput();
    return () => window.removeEventListener('click', focusInput);
  }, []);

  useEffect(() => {
    endOfHistoryRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history]);

  const processCommand = async (cmd) => {
    if (cmd.trim() === 'clear') {
      setHistory([]);
      return;
    }
    
    if (cmd.trim().startsWith('theme')) {
        const themeName = cmd.trim().split(' ')[1];
        const themes = ['light', 'dark', 'emerald', 'corporate', 'pastel', 'black', 'autumn', 'nord', 'silk', 'abyss'];
        if (themes.includes(themeName)) {
            document.documentElement.setAttribute('data-theme', themeName);
            return `Theme set to '${themeName}'`;
        }
        return `Theme '${themeName}' not found.`;
    }

    try {
      const res = await fetch('/api/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: cmd, cwd: currentPath }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        return errorData.error || `HTTP error! status: ${res.status}`;
      }

      const data = await res.json();
      setCurrentPath(data.new_cwd); 
      
      return data.output || data.error;
    } catch (error) {
      return `Failed to connect to backend: ${error.message}`;
    }
  };

  // --- NEW Auto-completion handler ---
  const handleAutoComplete = async () => {
    if (command.trim() === '') return;

    try {
        const res = await fetch('/api/autocomplete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: command, cwd: currentPath }),
        });
        const suggestions = await res.json();

        if (suggestions.length === 1) {
            const parts = command.split(' ');
            parts[parts.length - 1] = suggestions[0];
            setCommand(parts.join(' '));
        } else if (suggestions.length > 1) {
            const prompt = `user@host:${currentPath}$ ${command}`;
            const suggestionsLine = `<div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-x-4">${suggestions.map(s => `<span>${s}</span>`).join('')}</div>`;
            setHistory(prev => [...prev, prompt, suggestionsLine]);
        }
    } catch (error) {
        console.error("Autocomplete failed:", error);
    }
  };

  const handleKeyDown = async (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (command.trim() === '') {
        setHistory(prev => [...prev, `user@host:${currentPath}$ `]);
        return;
      }

      const prompt = `user@host:${currentPath}$`;
      const output = await processCommand(command);
      
      const newHistory = [...history, `${prompt} ${command}`];
      if (output) newHistory.push(output);
      
      setHistory(newHistory);
      
      if (command.trim() !== '') setCommandHistory(prev => [command, ...prev]);
      
      setHistoryIndex(-1);
      setCommand('');
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (historyIndex < commandHistory.length - 1) {
        const newIndex = historyIndex + 1;
        setHistoryIndex(newIndex);
        setCommand(commandHistory[newIndex]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setCommand(commandHistory[newIndex]);
      } else {
        setHistoryIndex(-1);
        setCommand('');
      }
    } else if (e.key === 'Tab') { // --- ADDED Tab handler ---
        e.preventDefault();
        await handleAutoComplete();
    }
  };

  const pathString = `user@host:${currentPath}$`;
  const animationProps = {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0 },
    transition: { duration: 0.2 }
  };

  return (
    <main 
      className="min-h-screen bg-base-300 text-base-content font-mono p-4 flex items-center justify-center transition-colors duration-500"
      onClick={() => inputRef.current?.focus()}
    >
      <div className="w-full max-w-5xl h-[85vh] shadow-2xl rounded-lg bg-base-100/90 backdrop-blur-sm border border-white/10">
        <div className="mockup-code h-full overflow-y-auto">
          <AnimatePresence>
            {history.map((line, index) => (
              <motion.div key={index} {...animationProps}>
                <pre dangerouslySetInnerHTML={{ __html: line.replace(/</g, '&lt;').replace(/>/g, '&gt;') }} />
              </motion.div>
            ))}
          </AnimatePresence>
          <div className="flex items-center">
            <pre><span className="text-success">{pathString}</span> </pre>
            <input
              ref={inputRef}
              type="text"
              className="flex-1 bg-transparent border-0 outline-none focus:ring-0 p-0 caret-primary"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              onKeyDown={handleKeyDown}
              autoComplete="off"
              spellCheck="false"
            />
          </div>
          <div ref={endOfHistoryRef} />
        </div>
      </div>
    </main>
  );
}
