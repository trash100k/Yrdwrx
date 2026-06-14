import { fetchApi } from "../lib/api";
// @ts-nocheck

import {
  collection,
  query,
  where,
  getDocs,
  doc,
  writeBatch,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../lib/firebase";

export async function ingestKnowledge(
  content: string,
  context: Record<string, unknown>,
) {
  try {
    const response = await fetchApi("/api/knowledge/ingest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, context }),
    });
    const nodes = await response.json();

    // Store in Firestore using batch writes to improve performance
    // Firestore allows up to 500 operations per batch
    const BATCH_LIMIT = 500;
    const collectionRef = collection(db, "knowledge");

    for (let i = 0; i < nodes.length; i += BATCH_LIMIT) {
      const batch = writeBatch(db);
      const chunk = nodes.slice(i, i + BATCH_LIMIT);

      for (const node of chunk) {
        const newDocRef = doc(collectionRef);
        batch.set(newDocRef, {
          ...node,
          lastUpdated: new Date().toISOString(),
          relevanceCount: 0,
        });
      }

      await batch.commit();
    }

    return nodes;
  } catch (error) {
    console.error("Brain Ingestion Failed:", error);
    return [];
  }
}

export async function fetchRelevantMemory(topic: string) {
  try {
    const q = query(collection(db, "knowledge"), where("topic", "==", topic));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => doc.data().content).join("\n---\n");
  } catch (error) {
    console.error("Fetch Memory Failed:", error);
    return "";
  }
}
