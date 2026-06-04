import { fetchApi } from "../lib/api";
// @ts-nocheck

import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  serverTimestamp,
  writeBatch,
  doc,
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

    // Store in Firestore
    // Firestore batch writes are limited to 500 operations
    const BATCH_SIZE_LIMIT = 500;

    for (let i = 0; i < nodes.length; i += BATCH_SIZE_LIMIT) {
      const batch = writeBatch(db);
      const chunk = nodes.slice(i, i + BATCH_SIZE_LIMIT);

      for (const node of chunk) {
        const docRef = doc(collection(db, "knowledge"));
        batch.set(docRef, {
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
