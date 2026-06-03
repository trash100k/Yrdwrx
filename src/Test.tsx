import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';

function App() {
  const [isSaving, setIsSaving] = useState(false);
  
  const handleClick = async () => {
    setIsSaving(true);
    try {
      if (true) {
        return;
      }
    } finally {
      setIsSaving(false);
    }
  };
  
  return <button onClick={handleClick}>{isSaving ? "Saving..." : "Click"}</button>;
}
