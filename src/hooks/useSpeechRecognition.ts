import { useState, useEffect, useRef, useCallback } from "react";
import { useToast } from "../contexts/ToastContext";

export function useSpeechRecognition() {
  const { showToast } = useToast();
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;

      recognitionRef.current.onresult = (event: any) => {
        let currentTranscript = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          currentTranscript += event.results[i][0].transcript;
        }
        setTranscript(currentTranscript);
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error("Speech recognition error", event.error);
        setIsListening(false);
        if (event.error !== 'no-speech') {
            showToast("Microphone error: " + event.error, "error");
        }
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    } else {
        console.warn("Speech Recognition API not supported in this browser.");
    }
  }, []);

  const startListening = useCallback(() => {
    if (!recognitionRef.current) {
      showToast("Speech recognition is not supported in this browser. Please use Chrome.", "error");
      return;
    }
    setTranscript("");
    setIsListening(true);
    try {
      recognitionRef.current.start();
    } catch (e) {
      console.error(e);
      // Already started
    }
  }, [showToast]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  }, []);

  return {
    transcript,
    setTranscript,
    isListening,
    startListening,
    stopListening,
    supported: !!recognitionRef.current
  };
}
