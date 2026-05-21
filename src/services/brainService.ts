
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../lib/firebase";

export async function ingestKnowledge(
  content: string,
  context: Record<string, unknown>,
) {
  try {
    const response = await fetch("/api/knowledge/ingest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, context }),
    });
    const nodes = await response.json();

    // Store in Firestore
    for (const node of nodes) {
      await addDoc(collection(db, "knowledge"), {
        ...node,
        lastUpdated: new Date().toISOString(),
        relevanceCount: 0,
      });
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
