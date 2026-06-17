import { useRef, useEffect, useState, useCallback } from 'react';

interface UseSpeechRecognitionOptions {
  continuous?: boolean;
  interimResults?: boolean;
  lang?: string;
  onResult?: (event: SpeechRecognitionEvent) => void;
  onError?: (event: SpeechRecognitionErrorEvent) => void;
  onEnd?: () => void;
  onStart?: () => void;
}

export function useSpeechRecognition({
  continuous = false,
  interimResults = false,
  lang = 'en-US',
  onResult,
  onError,
  onEnd,
  onStart
}: UseSpeechRecognitionOptions = {}) {
  const [isListening, setIsListening] = useState(false);
  const [supported, setSupported] = useState(true);
  const recognitionRef = useRef<SpeechRecognitionType | null>(null);

  // Stable callbacks using refs to avoid re-binding on every render if options change,
  // although providing them in the dependency array of useEffect is also an option.
  const callbacksRef = useRef({ onResult, onError, onEnd, onStart });

  useEffect(() => {
    callbacksRef.current = { onResult, onError, onEnd, onStart };
  }, [onResult, onError, onEnd, onStart]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      setSupported(false);
      return;
    }

    const SpeechRecognitionConstructor =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognitionConstructor) {
      setSupported(false);
      return;
    }

    try {
      const recognition = new SpeechRecognitionConstructor();
      recognitionRef.current = recognition;
      recognition.continuous = continuous;
      recognition.interimResults = interimResults;
      recognition.lang = lang;

      recognition.onstart = () => {
        setIsListening(true);
        if (callbacksRef.current.onStart) {
          callbacksRef.current.onStart();
        }
      };

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        if (callbacksRef.current.onResult) {
          callbacksRef.current.onResult(event);
        }
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        setIsListening(false);
        if (callbacksRef.current.onError) {
          callbacksRef.current.onError(event);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
        if (callbacksRef.current.onEnd) {
          callbacksRef.current.onEnd();
        }
      };
    } catch (e) {
      console.error("Failed to initialize SpeechRecognition", e);
      setSupported(false);
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          // ignore cleanup errors
        }
      }
    };
  }, [continuous, interimResults, lang]);

  const start = useCallback(() => {
    if (!supported || !recognitionRef.current) {
      console.warn("Speech recognition is not supported or not initialized.");
      alert("Speech recognition is not supported in this browser. Please use Chrome or Safari.");
      return;
    }
    try {
      recognitionRef.current.start();
    } catch (e) {
      console.error("Error starting speech recognition", e);
    }
  }, [supported]);

  const stop = useCallback(() => {
    if (!supported || !recognitionRef.current) {
      return;
    }
    try {
      recognitionRef.current.stop();
      setIsListening(false);
    } catch (e) {
      console.error("Error stopping speech recognition", e);
    }
  }, [supported]);

  return {
    isListening,
    supported,
    start,
    stop,
    recognition: recognitionRef.current
  };
}
