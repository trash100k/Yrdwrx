import { fetchApi } from "../lib/api";
// @ts-nocheck

import { knowledgeRepo } from "../lib/repos";

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

    // Persist each knowledge node via the Supabase repo (RLS stamps tenant).
    for (const node of nodes) {
      await knowledgeRepo.create({
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
    // Repo is tenant-scoped by RLS; pull the full list and filter/score in JS.
    const rows = await knowledgeRepo.list();
    return rows
      .filter((r: any) => r.topic === topic)
      .map((r: any) => r.content)
      .filter(Boolean)
      .join("\n---\n");
  } catch (error) {
    console.error("Fetch Memory Failed:", error);
    return "";
  }
}
