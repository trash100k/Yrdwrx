import { fetchApi } from "../lib/api";
import { useState, useEffect } from 'react';

const cache = new Map<string, string>();

export function useTranslate(text: string, targetLanguage: string | null, sourceContext: string = '') {
  const [translated, setTranslated] = useState(text);
  const [isTranslating, setIsTranslating] = useState(false);

  useEffect(() => {
    if (!targetLanguage || targetLanguage === 'en' || !text) {
      setTranslated(text);
      return;
    }

    const cacheKey = `${targetLanguage}:${text}`;
    if (cache.has(cacheKey)) {
      setTranslated(cache.get(cacheKey)!);
      return;
    }

    const translateText = async () => {
      setIsTranslating(true);
      try {
        const response = await fetchApi('/api/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, targetLanguage, sourceContext })
        });
        
        if (response.ok) {
          const data = await response.json();
          cache.set(cacheKey, data.translatedText);
          setTranslated(data.translatedText);
        } else {
          setTranslated(text);
        }
      } catch (err) {
        console.error(err);
        setTranslated(text);
      } finally {
        setIsTranslating(false);
      }
    };

    // Debounce translation to avoid spamming the endpoint when typing/changing quickly
    const timeout = setTimeout(translateText, 300);
    return () => clearTimeout(timeout);
  }, [text, targetLanguage, sourceContext]);

  return { translatedText: translated, isTranslating };
}
