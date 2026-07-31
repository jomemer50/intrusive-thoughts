"use client";

import { useState, useEffect, useRef } from 'react';
import { useChat } from '@ai-sdk/react';
import { useTheme } from 'next-themes';
import { useAudioVisualizer } from '@/hooks/useAudioVisualizer';
import { Moon, Sun, ArrowLeft, Mic, MicOff, Volume2 } from 'lucide-react';
import Link from 'next/link';

export default function VoiceClient() {
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  
  // Streaming audio state
  const processedTextRef = useRef('');
  const isPlayingRef = useRef(false);
  const audioQueueRef = useRef<string[]>([]);
  
  const recognitionRef = useRef<any>(null);
  const volume = useAudioVisualizer(isListening);

  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    setMounted(true);
    setActiveConversationId(crypto.randomUUID());

    if ('speechSynthesis' in window) {
      window.speechSynthesis.getVoices();
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      // Set to true so it doesn't stop immediately
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;

      recognitionRef.current.onresult = (event: any) => {
        let finalTrans = '';
        let interimTrans = '';
        for (let i = 0; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
             finalTrans += event.results[i][0].transcript;
          } else {
             interimTrans += event.results[i][0].transcript;
          }
        }
        setTranscript(finalTrans + interimTrans);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
      
      recognitionRef.current.onerror = (event: any) => {
        console.error("Speech recognition error", event.error);
        setErrorMsg(`Mic Error: ${event.error}`);
        setIsListening(false);
      };
    }
  }, []);

  const processNextAudio = () => {
    if (isPlayingRef.current) return;
    
    if (audioQueueRef.current.length > 0) {
      isPlayingRef.current = true;
      const audioUrl = audioQueueRef.current.shift()!;
      const audio = new Audio(audioUrl);
      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
        isPlayingRef.current = false;
        processNextAudio();
      };
      audio.play().catch(e => {
        console.error("Audio playback error", e);
        isPlayingRef.current = false;
        processNextAudio();
      });
    }
  };



  const fetchTtsForSentence = async (text: string) => {
    try {
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });
      
      if (!response.ok) {
        throw new Error('TTS Failed');
      }

      const blob = await response.blob();
      const audioUrl = URL.createObjectURL(blob);
      audioQueueRef.current.push(audioUrl);
      processNextAudio();
    } catch (e) {
      console.error("TTS API Error:", e);
      // Removed fallback TTS
    }
  };

  const { messages, sendMessage, status } = useChat({
    api: '/api/chat',
    body: {
      conversationId: activeConversationId
    },
    onFinish: (event: any) => {
      // Flush any remaining text as the final sentence
      const msg = event.message;
      const fullText = msg.content || (msg.parts?.filter((p: any) => p.type === 'text').map((p: any) => p.text).join('')) || '';
      const remaining = fullText.slice(processedTextRef.current.length).trim();
      
      if (remaining.length > 0) {
        const textToSpeak = remaining.replace(/[*_~`#]/g, '');
        if (textToSpeak.length > 0) {
           fetchTtsForSentence(textToSpeak);
        }
      }
      processedTextRef.current = ''; // Reset for the next turn
    }
  } as any);

  // Monitor streaming text for completed sentences
  useEffect(() => {
    const lastMsg = messages[messages.length - 1] as any;
    if (status === 'streaming' && lastMsg?.role === 'assistant') {
      const fullText = lastMsg.content || (lastMsg.parts?.filter((p: any) => p.type === 'text').map((p: any) => p.text).join('')) || '';
      
      let unprocessed = fullText.slice(processedTextRef.current.length);
      let match = unprocessed.match(/(.*?[.!?]+[\s\n]+)(.*)/);
      
      while (match) {
        const newSentence = match[1].trim();
        processedTextRef.current += match[1]; // Track exactly what we matched to keep indices correct
        
        const textToSpeak = newSentence.replace(/[*_~`#]/g, '');
        if (textToSpeak.length > 0) {
           fetchTtsForSentence(textToSpeak);
        }
        
        unprocessed = fullText.slice(processedTextRef.current.length);
        match = unprocessed.match(/(.*?[.!?]+[\s\n]+)(.*)/);
      }
    }
  }, [messages, status]);

  // Watch for when listening stops, and if we have a transcript, submit it
  useEffect(() => {
    if (!isListening && transcript.trim().length > 0) {
      sendMessage({ role: 'user', parts: [{ type: 'text', text: transcript }] });
      setTranscript('');
    }
  }, [isListening, transcript, sendMessage]);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert("Speech recognition is not supported in this browser. Try Chrome.");
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      // Stop any current speech synthesis before listening
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      setTranscript('');
      setErrorMsg('');
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (err) {
        console.error("Failed to start recognition:", err);
      }
    }
  };

  if (!mounted) return null;

  // Calculate bubble scale based on volume (volume is 0 to 1)
  const scale = 1 + (volume * 1.5); // Max scale 2.5
  const glowOpacity = 0.2 + (volume * 0.8);

  return (
    <div className="flex h-screen bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 flex-col">
      <div className="p-4 flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center space-x-4">
          <Link href="/chat" className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors flex items-center text-zinc-600 dark:text-zinc-300">
            <ArrowLeft className="w-5 h-5 mr-2" />
            <span className="font-medium text-sm">Text Chat</span>
          </Link>
          <div className="flex items-center space-x-2 border-l pl-4 border-zinc-200 dark:border-zinc-800">
            <Volume2 className="w-5 h-5 text-zinc-500" />
            <h1 className="font-semibold">Voice Mode</h1>
          </div>
        </div>
        
        <button
          onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
          className="p-2 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
        >
          {resolvedTheme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center relative overflow-hidden">
        
        {/* Animated Background Glow */}
        <div 
          className="absolute inset-0 flex items-center justify-center pointer-events-none transition-opacity duration-75"
          style={{ opacity: isListening ? glowOpacity : 0.05 }}
        >
          <div className="w-[500px] h-[500px] bg-black dark:bg-white rounded-full blur-[100px] opacity-20" 
               style={{ transform: `scale(${scale * 1.2})` }} />
        </div>

        {/* Central Bubble */}
        <button
          onClick={toggleListening}
          className={`relative z-10 w-48 h-48 rounded-full flex items-center justify-center transition-all duration-75 ${
            isListening 
              ? 'bg-black text-white dark:bg-white dark:text-black shadow-[0_0_50px_rgba(0,0,0,0.5)] dark:shadow-[0_0_50px_rgba(255,255,255,0.5)]' 
              : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800 shadow-xl'
          }`}
          style={{ transform: `scale(${isListening ? scale : 1})` }}
        >
          <div style={{ transform: `scale(${isListening ? 1/scale : 1})` }} className="flex flex-col items-center">
            {isListening ? (
              <Mic className="w-12 h-12 mb-2" />
            ) : (
              <MicOff className="w-12 h-12 mb-2" />
            )}
            <span className="font-medium text-sm">
              {isListening ? 'Listening...' : 'Tap to Talk'}
            </span>
          </div>
        </button>

        {/* Transcript & Status Text */}
        <div className="absolute bottom-24 max-w-2xl text-center px-6">
          {errorMsg ? (
             <p className="text-red-500 font-medium text-lg">{errorMsg}</p>
          ) : status === 'streaming' || status === 'submitted' ? (
            <p className="text-zinc-500 dark:text-zinc-400 animate-pulse font-medium text-lg">AI is thinking...</p>
          ) : isListening ? (
            <p className="text-xl font-medium text-black dark:text-white min-h-[3rem]">{transcript || 'Listening...'}</p>
          ) : messages.length > 0 ? (
            <div className="flex flex-col items-center">
               <p className="text-sm text-zinc-500 mb-2">Last Message</p>
               <p className="text-lg font-medium text-zinc-700 dark:text-zinc-300 line-clamp-3">
                 {messages[messages.length - 1].role === 'assistant' ? (messages[messages.length - 1] as any).content : ''}
               </p>
            </div>
          ) : (
             <p className="text-zinc-500 dark:text-zinc-400 text-lg">Press the bubble to start a conversation.</p>
          )}
        </div>
      </div>
    </div>
  );
}
