import React from 'react';
import { useTranslate } from '../hooks/useTranslate';
import { Loader2 } from 'lucide-react';
import { useTenant } from '../contexts/TenantContext';

interface TranslatedMessageBubbleProps {
  text: string;
  sender: 'user' | 'bot';
  targetLanguage: string;
}

export function TranslatedMessageBubble({ text, sender, targetLanguage }: TranslatedMessageBubbleProps) {
  const { tenant } = useTenant();
  const isTranslationEnabled = tenant?.settings?.features?.aiOmnilingual && tenant?.settings?.subFeatures?.autoTranslateChat;
  
  // If we are the sender, do we translate our own outgoing message? Usually we want to translate inbound messages,
  // or everything to the selected target language.
  const { translatedText, isTranslating } = useTranslate(
    text, 
    isTranslationEnabled ? targetLanguage : null, 
    "Chat Assistant Direct Message"
  );
  
  return (
    <div
      className={`relative max-w-[70%] px-6 py-4 rounded-[28px] text-sm leading-relaxed shadow-xl ${
        sender === "user"
          ? "bg-forest-600 text-white"
          : "bg-white/5 border border-white/5 text-white/80"
      }`}
    >
      {isTranslating ? (
        <span className="flex items-center gap-2 opacity-50">
          <Loader2 size={12} className="animate-spin" /> Translating...
        </span>
      ) : (
        <span>{translatedText}</span>
      )}
    </div>
  );
}
