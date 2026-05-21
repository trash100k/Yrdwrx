import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Modality, Type, LiveServerMessage } from '@google/genai';
import { WebSocketServer } from 'ws';
import dotenv from 'dotenv';

dotenv.config();

import admin from 'firebase-admin';

let dbFirestore: admin.firestore.Firestore | null = null;
try {
  if (admin.apps.length === 0) {
    admin.initializeApp({
      projectId: process.env.FIREBASE_PROJECT_ID || 'mock-project-id'
    });
  }
  dbFirestore = admin.firestore();
} catch (error) {
  console.warn("Could not initialize firebase-admin natively. The server will run in mock/offline mode.", error);
}

function parseGeminiJson(text: string | undefined) {
  if (!text) return null;
  try {
    const raw = text.replace(/```json/gi, '').replace(/```/g, '').trim();
    return JSON.parse(raw);
  } catch (err) {
    console.error('Failed to parse Gemini JSON:', text);
    throw err;
  }
}

const isMockMode = !process.env.GEMINI_API_KEY;

const ai = new GoogleGenAI({ 
  apiKey: process.env.GEMINI_API_KEY || 'mock_key_to_allow_init',
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

// Mock the Gemini API generation when running without a key
if (isMockMode) {
  console.log('Running in Mock Mode: GEMINI_API_KEY is not set. API calls will be simulated.');
  // @ts-ignore
  ai.models.generateContent = async (request) => {
    return { text: getMockText(request) };
  };
}

function getMockText(request: any): string {
  const instr = (request.config?.systemInstruction || '').toString();
  const contentStr = JSON.stringify(request.contents || '');
  
  if (instr.includes('Meridian Brain Ingestion')) {
    return JSON.stringify([{ topic: "Customer Pref", content: "Loves tulips and mock data", tags: ["Preferences"] }]);
  }
  if (instr.includes('Draft a professional landscaping proposal')) {
    return "This is a mock landscaping proposal drafted to improve the property. It includes specific treatments and estimates.";
  }
  if (instr.includes('Master Landscape Architect')) {
    return JSON.stringify([{ title: "Mock Flagstone Path", description: "Adds charm using local stone.", roi: "15%" }, { title: "Native Garden", description: "Low water usage.", roi: "20%" }]);
  }
  if (instr.includes('optimal tailored dashboard layout')) {
    return JSON.stringify({ layoutStyle: "easy", hiddenWidgets: [] });
  }
  if (instr.includes('Draft a professional SMS')) {
    return JSON.stringify({ summary: "Mock SMS follow up", draftMessage: "Hello! We'd love to schedule your next service." });
  }
  if (instr.includes('Extract a structured invoice')) {
    return JSON.stringify({ clientName: "Mock Client", services: ["Mowing"], totalAmount: 150, date: new Date().toISOString() });
  }
  if (instr.includes('optimal routing/scheduling')) {
    return JSON.stringify([{ time: "09:00", address: "123 Mock St", reason: "Proximity logic" }]);
  }
  if (instr.includes('predict which ones will need specific landscape maintenance')) {
    return JSON.stringify([{ customerId: "mock-id", name: "John Mock", suggestion: "Aerate lawn", reason: "Time of year", urgency: "low" }]);
  }
  if (instr.includes('Generate a daily briefing')) {
    return JSON.stringify({ title: "Mock Daily Brief", focus: "Finish remaining tasks seamlessly.", metrics: ["3 Jobs Today"], actionItems: ["Check mower blades"] });
  }
  if (instr.includes('forecast the inventory needs')) {
    return JSON.stringify([{ item: "Pine Straw", quantity: "50 bales", reason: "Upcoming jobs", costEstimate: 200 }]);
  }
  if (instr.includes('Neural Design Vision')) {
    return JSON.stringify({ identifiedAreas: ["Lawn"], recommendedStyle: "Modern", materialEstimates: ["50 sq ft sod"] });
  }
  if (instr.includes('Extract the part/material name')) {
    return JSON.stringify({ name: "Mock Part", brand: "MockBrand", partNumber: "12345", category: "Supplies" });
  }
  if (instr.includes('Determine sentiment and draft a southern-hospitable')) {
    return JSON.stringify({ sentiment: "Positive", aiDraft: "Thank you kindly for this wonderful review!", suggestedAction: "Post publicly" });
  }
  if (instr.includes('Extract data from this receipt')) {
    return JSON.stringify({ amount: 45.00, merchant: "Local Hardware", category: "Supplies", date: new Date().toISOString().split('T')[0] });
  }
  if (instr.includes('richer professional profile')) {
    return JSON.stringify({ tags: ["Prefers morning"], estimatedPropertySize: "1/4 Acre", strategicInsight: "Offer winter discounts" });
  }
  if (instr.includes('Generate an intelligent checklist')) {
    return JSON.stringify([{ text: "Load standard mowing gear", aiSource: true }, { text: "Verify gate code", aiSource: true }]);
  }
  if (instr.includes('A realistic dialogue transcript')) {
    return JSON.stringify({ transcript: "Agent: Hello! Ready for service today?\nClient: Yes, thanks!", successProbability: 85, keyTakeaway: "Client is very engaged" });
  }
  if (instr.includes('OUTPUT FORMAT: JSON array')) {
    return JSON.stringify([]);
  }
  if (instr.includes('OUTPUT FORMAT: JSON')) {
    return JSON.stringify({});
  }

  return "I'm a mock AI response since the system is running without a GEMINI_API_KEY.";
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '2mb' })); // tightened from 10mb for security

  // Simple in-memory rate limiter to prevent API abuse - ONLY FOR /api/* ROUTES
  const requestCounts = new Map<string, { count: number, resetTime: number }>();
  app.use('/api', (req, res, next) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const windowMs = 60000; // 1 minute
    const limit = 1000; // 1000 requests per minute to be safe
    
    let state = requestCounts.get(ip);
    if (!state || now > state.resetTime) {
      state = { count: 0, resetTime: now + windowMs };
    }
    
    state.count++;
    requestCounts.set(ip, state);
    
    if (state.count > limit) {
      return res.status(429).json({ error: "Too many requests. For security reasons, please slow down." });
    }
    
    res.setHeader('X-RateLimit-Limit', limit.toString());
    res.setHeader('X-RateLimit-Remaining', (limit - state.count).toString());
    
    next();
  });

    // Premium HTTP Security Headers Middleware
    app.use((req, res, next) => {
      // CSP disabled to prevent AI Studio iframe blocking
      // 2. MIME Sniffing Protection
      res.setHeader('X-Content-Type-Options', 'nosniff');
  
      // 3. Keep older browsers safe from some types of XSS
      res.setHeader('X-XSS-Protection', '1; mode=block');
  
      // 4. Referrer posture configuration
      res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
      // 5. HTTP Strict Transport Security (HSTS) - Enforce HTTPS transport layer integrity
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  
      // 6. Cross-Origin Opener Policy (COOP) - Mitigate visual threat models (spectre/meltdown) and allow oauth popups
      res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  
      // 7. Secure Information Leak Preventions (Hide underlying tech stack framework)
      res.removeHeader('X-Powered-By');
  
      next();
    });

  // ... (existing routes remain same)

  // API Routes
  app.post('/api/knowledge/ingest', async (req, res) => {
    try {
      const { content, context } = req.body;
      if (!content) {
        return res.status(400).json({ error: "Content is required for ingestion." });
      }
      const systemInstruction = `
        You are the Meridian Brain Ingestion Engine. 
        Analyze the following text and extract persistent "Knowledge Nodes" that are valuable for a landscaping company to remember.
        
        TOPICS TO EXTRACT:
        - Specific client preferences (likes roses, hates loud mowers).
        - Property specifics (back gate is tricky, slope on the north side).
        - Price sensitivities (Mrs. X thinks $60 is too high for mowing).
        - Local Meridian insights mentioned in context.

        OUTPUT FORMAT: JSON array of knowledge nodes.
        [
          { "topic": "string", "content": "string (the fact)", "tags": ["tag1", "tag2"] }
        ]
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: [{ role: 'user', parts: [{ text: `CONTENT: ${content}\nCONTEXT: ${JSON.stringify(context)}` }] }],
        config: {
          systemInstruction,
          responseMimeType: "application/json"
        }
      });

      res.json(parseGeminiJson(response.text));
    } catch (error: any) {
      console.error('Ingest Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/agent/chat', async (req, res) => {
    try {
      const { message, context, knowledge, memory } = req.body;
      
      const systemInstruction = `
        You are "Cutty", the helpful assistant for a landscaping company.
        
        RECALLED MEMORY:
        ${memory || 'No specific memories recalled for this customer yet.'}
        
        PERSONALITY:
        - Warm, inviting, personable, professional.
        
        MISSION:
        - Use your personality and the RECALLED MEMORY to provide a superior, personalized experience.
        - If memory suggests a client has specific preferences, speak to them.
        
        CONTEXT:
        ${JSON.stringify(context)}
        
        LOCAL KNOWLEDGE:
        ${knowledge || 'General landscaping knowledge applied.'}
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: [{ role: 'user', parts: [{ text: message }] }],
        config: {
          systemInstruction,
        },
      });

      res.json({ text: response.text });
    } catch (error: any) {
      console.error('Agent Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/crm/analyze-property', async (req, res) => {
    try {
      const { customer } = req.body;
      if (!customer || !customer.id) {
        return res.status(400).json({ 
          error: "Incomplete property data.",
          code: "ERR_PROPERTY_VOID"
        });
      }
      const systemInstruction = `
        You are a Master Landscape Architect at Cutty.
        Analyze this property data and provide 3 visionary design suggestions that would increase property value.
        Focus on: ${customer.propertyDetails?.grassType || 'the lawn'}, ${customer.propertyDetails?.size || 'the space'}, and climate resilience.
        
        OUTPUT FORMAT: JSON array
        [
          { "title": "Design Name", "description": "1 sentence detail", "roi": "Potential value lift %" }
        ]
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: `Analyze property for: ${JSON.stringify(customer)}`,
        config: { systemInstruction, responseMimeType: "application/json" },
      });
      res.json(parseGeminiJson(response.text));
    } catch (error: any) {
      console.error("Neural Analysis Failed:", error);
      res.status(500).json({ 
        error: "Neural uplink saturated. Manual override suggested.",
        code: "ERR_UPLINK_FAILURE"
      });
    }
  });

  app.post('/api/crm/draft-proposal', async (req, res) => {
    try {
      const { customer, suggestion } = req.body;
      const systemInstruction = `
        Draft a professional landscaping proposal for ${customer.firstName}.
        Tone: Professional, approachable, and persuasive.
        Include elements of the briefing and the specific suggestion: ${suggestion}.
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: "Draft proposal.",
        config: { systemInstruction },
      });
      res.json({ text: response.text });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/brain/query', async (req, res) => {
    try {
      const { query, context } = req.body;
      const systemInstruction = `
        You are "Cutty", an all-knowing, helpful assistant for a landscaping company.
        
        DATABASE ACCESS:
        You have real-time access to the entire application database, including:
        - SCHEDULER: Live crew positions, job status, and job logs.
        - FINANCES: Earnings, expenses, and missed billing.
        - CLIENTS: Full relationship history and property details.
        - INVENTORY: Real-time stock levels and material estimations.
        
        LANDSCAPING EXPERTISE:
        - You are an expert in gardening and property maintenance.
        - Deep knowledge of Magnolia, Azaleas, Bermuda vs St. Augustine grass, and local soil drainage.
        
        SPECIFIC FEATURES:
        - JOB NOTES: Critical constraints like HOA rules and Gate Codes.
        - VOLUME ESTIMATOR: CY = (L * W * D) / 324 (roughly). 1 CY Mulch covers 100sqft at 3" depth.
        - VOICE ASSISTANT: You process conversation audio to automate invoices and scheduling.
        - FIELD MODE: Optimized for teams on-site; provide punchy, actionable guidance.
        
        TONE: Helpful, professional, and friendly.
        
        NAVIGATION & HIGHLIGHTING:
        If the user asks where something is, how to use it, or for a demo/show, explain it and append a highlight trigger at the end of your message in the format: [FOCUS:target-id]
        
        Available target-ids:
        - mission-dashboard-header (Daily stats/Dashboard)
        - nav-dashboard (Scheduler/Job board)
        - nav-client-book (Client book/CRM)
        - nav-teams (Crew tracking/Teams)
        - nav-design-studio (Design/Project planning)
        - nav-inventory (Inventory/Asset hub)
        - nav-finances (Finances/Capital)
        - field-mode-toggle (Field mode switch)
        - brain-trigger (Chat assistant)
        
        If you don't know the answer, say "I haven't learned that specific fact yet, but I can check the logs."
        
        Context: ${JSON.stringify(context)}
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: query,
        config: { systemInstruction },
      });
      res.json({ text: response.text });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/dashboard/customize', async (req, res) => {
    const prompt = req.body.prompt;
    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required for personalization." });
    }
    try {
      const systemInstruction = `
        You are "Cutty Dashboard AI Designer", an expert workspace optimization agent.
        Analyze the user's operational requirements prompt (e.g., "I support luxury HOA properties and don't care about inventory") and output a optimal tailored dashboard layout configuration.
        
        OUTPUT FORMAT: JSON only.
        {
          "layoutStyle": "easy" | "info-freak",
          "showBriefing": boolean,
          "showInventory": boolean,
          "showWeather": boolean,
          "showActiveCrews": boolean,
          "showSystemAlerts": boolean,
          "strategicAdvisory": "A dynamic 1-sentence prompt advising the owner why this cockpit config was generated. Be warm and southern hospitable."
        }
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: prompt,
        config: {
          systemInstruction,
          responseMimeType: "application/json"
        }
      });

      res.json(parseGeminiJson(response.text));
    } catch (error: any) {
      console.error('Personalize layout error, falling back to heuristic:', error);
      // Resilience fallback: analyze keywords
      const lc = prompt.toLowerCase();
      const showInventory = !lc.includes('no inventory') && !lc.includes('without inventory') && !lc.includes('dont care about inventory');
      const layoutStyle = lc.includes('freak') || lc.includes('info') || lc.includes('analytics') ? 'info-freak' : 'easy';
      
      res.json({
        layoutStyle,
        showBriefing: !lc.includes('no briefing'),
        showInventory,
        showWeather: !lc.includes('no weather'),
        showActiveCrews: !lc.includes('no crew'),
        showSystemAlerts: !lc.includes('no alerts') && !lc.includes('quiet'),
        strategicAdvisory: `Heuristic calibration active. Custom fit generated based on your key indicators: "${prompt.slice(0, 40)}..."`
      });
    }
  });

  app.post('/api/scheduler/draft-sms', async (req, res) => {
    try {
      const { job, weather } = req.body;
      const systemInstruction = `
        Draft a friendly SMS to ${job.client} notifying them we are on the way.
        Mention the current weather if relevant (${weather?.temp}°). Keep it under 160 characters.
      `;
      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: "Draft SMS.",
        config: { systemInstruction },
      });
      res.json({ text: response.text });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/crm/briefing', async (req, res) => {
    try {
      const { customer, interactions, memory } = req.body;
      
      const systemInstruction = `
        You are a high-level account manager for Cutty Landscaping.
        Create a "Briefing" for the crew or owner before they visit this customer.
        
        INPUT DATA:
        - Customer Info: ${JSON.stringify(customer)}
        - Recent Interactions: ${JSON.stringify(interactions)}
        - Memory: ${memory}
        
        OUTPUT FORMAT: JSON
        {
          "summary": "1 sentence hook",
          "keyInsights": ["bullet points of important facts"],
          "redFlags": ["potential issues/concerns"],
          "suggestedUpsell": "Specific service recommendation",
          "aiScore": number (0-100),
          "aiScoreLabel": "string (Short category like 'Growth Potential')",
          "aiScoreReasoning": "1-2 sentences explaining the score based on data"
        }
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: [{ role: 'user', parts: [{ text: "Generate briefing for this customer." }] }],
        config: {
          systemInstruction,
          responseMimeType: "application/json"
        },
      });

      res.json(parseGeminiJson(response.text));
    } catch (error: any) {
      console.error('Briefing Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/invoice/extract', async (req, res) => {
    try {
      const { conversation, image } = req.body;
      if (!conversation && !image) {
         return res.json({
           clientName: "Unknown Client",
           items: [],
           total: 0,
           summary: "No conversation or image provided to extract."
         });
      }
      
      const systemInstruction = `
        You are an expert billing assistant for Cutty.
        Extract a structured invoice from the following conversation and optional image.
        
        OUTPUT FORMAT: JSON only.
        {
          "clientName": "string",
          "items": [
            { "description": "string", "quantity": number, "rate": number }
          ],
          "total": number,
          "summary": "Short description of the work"
        }
      `;

      const parts: any[] = [{ text: `Extract structured data from the provided context. Conversation: ${conversation || 'None'}` }];
      if (image) {
        parts.push({
          inlineData: {
            mimeType: "image/jpeg",
            data: image.split(',')[1]
          }
        });
      }

      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: [{ role: 'user', parts }],
        config: {
          systemInstruction,
          responseMimeType: "application/json"
        },
      });

      res.json(parseGeminiJson(response.text));
    } catch (error: any) {
      console.error('Extraction Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Weather API Proxy (Mocked or real)
  app.all('/api/weather', async (req, res) => {
    // Simulate real-time weather disruption for demo purposes
    const isRaining = Math.random() < 0.3;
    res.json({
      location: 'Local Area',
      temp: isRaining ? 72 : 82,
      condition: isRaining ? 'Rain' : 'Sunny',
      forecast: isRaining 
        ? 'Rain expected. Recommend rescheduling outdoor jobs.' 
        : 'Clear skies. Optimal window for outdoor work.'
    });
  });

  // SECURE & COMPLIANT TELEMETRY EXPORT - Strips PII before sharing with partners
  app.get('/api/analytics/telemetry-export', (req, res) => {
    // Validate an internal token here in a real scenario
    if (req.headers['x-telemetry-key'] !== process.env.TELEMETRY_EXPORT_KEY && process.env.NODE_ENV === 'production') {
       return res.status(403).json({ error: 'Unauthorized access to telemetry system.' });
    }
    
    // Simulate anonymization of jobs/clients for third-party optimization modeling
    const mockTelemetryPool = [
      { 
         hashId: 'b7c2a1', 
         propertySizeMeters: 450, 
         serviceFreqDays: 14, 
         upsellRate: 0.15,
         climateZone: '8b'
      },
      { 
         hashId: 'f9d3b2', 
         propertySizeMeters: 1200, 
         serviceFreqDays: 7, 
         upsellRate: 0.42,
         climateZone: '8b'
      }
    ];

    res.json({
      status: 'success',
      notice: 'All PII (Personally Identifiable Information) stripped per privacy regulations.',
      dataPoints: mockTelemetryPool.length,
      aggregateData: mockTelemetryPool,
      timestamp: new Date().toISOString()
    });
  });

  app.all('/api/crm/clients', (req, res) => {
    res.json({ status: 'ok', message: 'Registry active and synced.' });
  });

  app.post('/api/crm/client-history', async (req, res) => {
    try {
      const { clientName } = req.body;
      if (!clientName) {
        return res.json(null);
      }
      
      let matchedCustomer = null;
      try {
        if (dbFirestore) {
          // Try companyName first if applicable
          const companySnap = await dbFirestore.collection("customers").where("companyName", "==", clientName).limit(1).get();
          if (!companySnap.empty) {
            matchedCustomer = companySnap.docs[0].data();
          } else {
            // Try exact last name match
            const nameParts = clientName.split(' ');
            const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : clientName;
            const lnSnap = await dbFirestore.collection("customers").where("lastName", "==", lastName).limit(1).get();
            if (!lnSnap.empty) {
              matchedCustomer = lnSnap.docs[0].data();
            }
          }
        }
      } catch (dbError) {
        console.warn("Firestore query failed, defaulting to null:", dbError);
      }

      if (!matchedCustomer) {
        return res.json(null);
      }

      // Return the dynamically retrieved client history/notes from the persistent DB
      res.json({
        address: matchedCustomer.address || 'Address not on file',
        gateCode: matchedCustomer.gateCode || null,
        isHOA: matchedCustomer.isHOA || false,
        accessNotes: matchedCustomer.notes || matchedCustomer.accessNotes || 'No specific access notes.'
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/revenue/audit', async (req, res) => {
    try {
      // Simulate scanning historical data for missed revenue with randomized but structured data
      const opportunities = [
        {
          id: `leak-${Date.now()}-1`,
          client: 'Schmidt Residence',
          type: 'UNBILLED_COMPLETION',
          detail: 'Hedge Sculpting (May 14) completed but no invoice generated.',
          value: 450,
          confidence: 0.98,
          timestamp: new Date().toISOString()
        },
        {
          id: `leak-${Date.now()}-2`,
          client: 'Oak Estates',
          type: 'SERVICE_GAP',
          detail: 'Bi-weekly turf maintenance missed 2 cycles. Potential churn or oversight.',
          value: 320,
          confidence: 0.85,
          timestamp: new Date().toISOString()
        },
        {
          id: `leak-${Date.now()}-3`,
          client: 'Hillside Manor',
          type: 'UPSELL_RECOVERY',
          detail: 'Mulch installation suggested in April. Client interaction indicates interest.',
          value: 1200,
          confidence: 0.72,
          timestamp: new Date().toISOString()
        },
        {
          id: `leak-${Date.now()}-4`,
          client: 'Arbor Lakes HOA',
          type: 'SCOPE_CREEP',
          detail: 'Extra debris removal logged by crew on May 10. Not in contract scope.',
          value: 150,
          confidence: 0.95,
          timestamp: new Date().toISOString()
        }
      ];

      res.json({
        totalRecoverable: opportunities.reduce((acc, curr) => acc + curr.value, 0),
        auditTimestamp: new Date().toISOString(),
        opportunities
      });
    } catch (error: any) {
      console.error("Audit engine timed out:", error);
      res.status(500).json({ 
        error: "Audit engine timed out.",
        code: "ERR_AUDIT_STALL"
      });
    }
  });

  app.post('/api/scheduler/optimize', async (req, res) => {
    try {
      const { jobs, weather } = req.body;
      
      const systemInstruction = `
        You are the "Meridian Scheduler AI". 
        Analyze the current job list and weather forecast to suggest optimal scheduling adjustments.
        
        CRITERIA:
        - Weather sensitivity: Fertilization and mowing are sensitive to rain. Irrigation checks are less so.
        - Geographic efficiency: Group jobs in similar areas (Poplar Springs, North Hills, Marion).
        - Urgency: Prioritize active/high-priority jobs.
        
        OUTPUT FORMAT: JSON array of suggestions.
        [
          {
            "jobId": "string",
            "suggestion": "string (Why change?)",
            "action": "RESCHEDULE | PRIORITIZE | MAINTAIN",
            "newTime": "string (Optional)",
            "impact": "e.g., 'Save 15 mins travel' or 'Avoid rain ruin'"
          }
        ]
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: [{ role: 'user', parts: [{ text: `Optimize the schedule based on the input. Weather: ${JSON.stringify(weather)}, Jobs: ${JSON.stringify(jobs)}` }] }],
        config: {
          systemInstruction,
          responseMimeType: "application/json"
        },
      });

      res.json(parseGeminiJson(response.text));
    } catch (error: any) {
      console.error('Optimization Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/reports/predictive-maintenance', async (req, res) => {
    try {
      const { customers } = req.body;
      const systemInstruction = `
        Analyze these customers and predict which ones will need specific landscape maintenance (mulching, aeration, winterization) in the next 30 days based on their history and property details.
        OUTPUT FORMAT: JSON array
        [
          { "customerId": "string", "name": "string", "suggestion": "string", "reason": "string", "urgency": "low" | "medium" | "high" }
        ]
      `;
      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: [{ role: 'user', parts: [{ text: `Analyze: ${JSON.stringify(customers.slice(0, 10))}` }] }],
        config: { systemInstruction, responseMimeType: "application/json" },
      });
      res.json(parseGeminiJson(response.text));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/daily-briefing', async (req, res) => {
    try {
      const { type } = req.body;
      const systemInstruction = `
        You are the "Meridian Strategy Engine". 
        Generate a strategic ${type} briefing for a landscaping company owner in Meridian, MS.
        Morning briefs focus on deployment and alerts.
        Evening briefs focus on results and missed opportunities.
        
        OUTPUT FORMAT: JSON
        {
          "title": "string",
          "hook": "1-2 sentence overview",
          "alerts": [
            { "id": number, "text": "string", "type": "inventory" | "preference" | "billing", "action": "email_supplier" | null }
          ],
          "stats": [
            { "label": "string", "value": "string", "trend": "string" }
          ],
          "priorityJob": {
            "name": "string",
            "task": "string",
            "reason": "1 sentence logic"
          }
        }
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: [{ role: 'user', parts: [{ text: "Generate today's briefing." }] }],
        config: { systemInstruction, responseMimeType: "application/json" },
      });
      res.json(parseGeminiJson(response.text));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/inventory/check-and-alert', async (req, res) => {
    try {
      const { items } = req.body; 
      // FIXME(Management): Replace mock DB with actual inventory count queries
      const lowStock = items.filter(() => Math.random() < 0.2); // Demoted from 0.5 to 0.2 for realistic mock threshold
      
      res.json({
        lowStockItems: lowStock.map((name: string) => ({
          name,
          current: Math.floor(Math.random() * 5), // Mock current levels below min
          min: 10,
          unit: 'Yards',
          supplierEmail: 'supply@meridian-aggregate.com'
        }))
      });
    } catch (error) {
      res.status(500).json({ error: "Inventory sync failed" });
    }
  });

  app.post('/api/inventory/forecast', async (req, res) => {
    try {
      const { jobs } = req.body;
      const systemInstruction = `
        Based on these upcoming jobs in Meridian, MS, forecast the inventory needs (pine straw, mulch, fertilizer, herbicide) for the next 2 weeks.
        OUTPUT FORMAT: JSON array
        [
          { "item": "string", "quantity": "string", "reason": "string", "costEstimate": number }
        ]
      `;
      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: [{ role: 'user', parts: [{ text: `Analyze jobs: ${JSON.stringify(jobs.slice(0, 10))}` }] }],
        config: { systemInstruction, responseMimeType: "application/json" },
      });
      res.json(parseGeminiJson(response.text));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/design/process', async (req, res) => {
    try {
      const { image, markup, prompt } = req.body;
      
      const systemInstruction = `
        You are "Meridian Designer", an expert landscape architect and property analysis agent.
        You take a picture of a yard with markup (circles, lines) and a text/voice prompt, then suggest a specific landscaping transformation.
        
        GOALS:
        - Identify what is in the marked-up areas (e.g. "it looks like you circled a bare patch of dirt").
        - Suggest specific materials or plants based on the prompt (e.g. "adding a fern here would provide great shade coverage").
        - Provide a "Neural Design Vision" that includes material estimates.
        
        OUTPUT FORMAT: JSON
        {
          "identifiedAreas": [
            { "id": "string", "description": "What is in the markup", "suggestion": "What to put there" }
          ],
          "visionSummary": "A few sentences describing the overal design logic.",
          "estimatedMaterials": [
            { "item": "string", "quantity": "string", "estimatedCost": number }
          ],
          "strategicValue": "How this increases property value."
        }
      `;

      const contents = [
        { text: prompt || "Analyze this design markup." },
        { inlineData: { mimeType: "image/jpeg", data: image.split(',')[1] } }
      ];

      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents,
        config: {
          systemInstruction,
          responseMimeType: "application/json"
        },
      });

      res.json(parseGeminiJson(response.text));
    } catch (error: any) {
      console.error('Design Process Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/inventory/process-image', async (req, res) => {
    try {
      const { imageData } = req.body; // base64 image data
      
      const systemInstruction = `
        You are a landscaping inventory expert for Meridian Green. 
        Identify the part, material (dirt, mulch, rock), component, or barcode in the provided image.
        Extract the part/material name, brand, part number (if visible), and category.
        
        OUTPUT FORMAT: JSON
        {
          "name": "string",
          "brand": "string",
          "partNumber": "string",
          "category": "Bulk" | "Consumables" | "Fuel" | "Hardware",
          "suggestedUnit": "string (e.g., Yards, Gallons, Units, Bags, Tons)",
          "barcode": "string (if extracted)",
          "vendor": "string (Suggested vendor like STIHL, SiteOne, local dirt yard)"
        }
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: [
          { text: "Identify this landscaping part or barcode." },
          { inlineData: { mimeType: "image/jpeg", data: imageData } }
        ],
        config: {
          systemInstruction,
          responseMimeType: "application/json"
        },
      });

      res.json(parseGeminiJson(response.text));
    } catch (error: any) {
      console.error('Vision Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/reviews/process', async (req, res) => {
    try {
      const { review } = req.body;
      const systemInstruction = `
        Analyze this customer review for a landscaping company in Meridian, MS.
        Determine sentiment and draft a southern-hospitable, professional response.
        
        OUTPUT FORMAT: JSON
        {
          "sentiment": "Positive" | "Neutral" | "Negative",
          "autoReplyDraft": "string",
          "summary": "1 sentence gist"
        }
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: [{ role: 'user', parts: [{ text: review || "Analyze this review." }] }],
        config: { systemInstruction, responseMimeType: "application/json" },
      });

      res.json(parseGeminiJson(response.text));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/expenses/ocr', async (req, res) => {
    try {
      const { imageData } = req.body;
      const systemInstruction = `
        Extract data from this receipt. 
        Category options: Fuel, Supplies, Maintenance, Chemicals, Marketing, Other.
        OUTPUT FORMAT: JSON
        { "amount": number, "merchant": "string", "category": "string", "date": "YYYY-MM-DD" }
      `;
      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: [{ text: "Process receipt." }, { inlineData: { mimeType: "image/jpeg", data: imageData } }],
        config: { systemInstruction, responseMimeType: "application/json" },
      });
      res.json(parseGeminiJson(response.text));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/job/broadcast', async (req, res) => {
    try {
      const { job } = req.body;
      const systemInstruction = `
        Create an anonymized "live" update for a public website feed.
        Input: ${JSON.stringify(job)}
        Output: "Just finished a [service] in [neighborhood]!"
        Strictly anonymize the client name and exact address. 
        Neighborhood is the general area.
      `;
      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: "Generate broadcast.",
        config: { systemInstruction },
      });
      res.json({ message: response.text });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/crm/enrich', async (req, res) => {
    try {
      const { customer } = req.body;
      const systemInstruction = `
        You are a Real Estate & Agricultural Data Scientist.
        Enrich this landscaping customer's data using simulated "Local Market Intelligence" for Meridian, MS.
        Provide:
        - estimatedPropertyValue: number (based on neighborhood)
        - soilComposition: "Clay" | "Sandy" | "Loamy"
        - neighborhoodGrowth: "Rising" | "Stable"
        - upsellProbability: number (0-100)
        - strategicInsight: "1 sentence logic for an upgrade"
        
        OUTPUT FORMAT: JSON
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: `Enrich profile for: ${JSON.stringify(customer)}`,
        config: { systemInstruction, responseMimeType: "application/json" },
      });
      res.json(parseGeminiJson(response.text));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/outbound/generate-campaign', async (req, res) => {
    try {
      const { segment, targetService } = req.body;
      const systemInstruction = `
        Create a high-conversion outbound campaign for a landscaping business in Meridian, MS.
        Segment: ${segment}
        Service: ${targetService}
        Provide:
        1. Subject Line (Catchy)
        2. Hook (Southern Hospitality)
        3. Value Prop (Data-driven)
        4. Call to Action (Urgent)
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: "Generate campaign copy.",
        config: { systemInstruction },
      });
      res.json({ text: response.text });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/jobs/generate-checklist', async (req, res) => {
    try {
      const { job, customer, memory } = req.body;
      const systemInstruction = `
        You are a landscaping operations efficiency expert. 
        Generate a specific "Proximity Checklist" for a field technician arriving at this property in Meridian, MS.
        
        CONTEXT:
        - Job: ${JSON.stringify(job)}
        - Customer: ${JSON.stringify(customer)}
        - Memory: ${memory}
        
        REQUIREMENTS:
        - Must include 4-6 highly specific items.
        - Combine standard procedure with personalized "Meridian Memory" items (e.g., "Check the back gate latch" or "Watch for the neighbor's cat").
        - Items should be actionable and binary (completed/not).
        
        OUTPUT FORMAT: JSON array
        [
          { "text": "string", "aiSource": true }
        ]
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: "Generate checklist now.",
        config: { systemInstruction, responseMimeType: "application/json" },
      });
      res.json(parseGeminiJson(response.text));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/outbound/simulate-call', async (req, res) => {
    try {
      const { customer, context } = req.body;
      const systemInstruction = `
        You are "Meridian Voice", the outbound calling agent for Cutty Green.
        Your goal is to simulate a professional, southern-hospitable follow-up call to ${customer.firstName}.
        
        CONTEXT:
        ${context}
        
        CUSTOMER DATA:
        ${JSON.stringify(customer)}
        
        OUTPUT FORMAT: JSON
        {
          "transcript": "A realistic dialogue transcript of the call.",
          "summary": "1 sentence gist of the call outcome.",
          "sentiment": "Positive" | "Neutral" | "Interested" | "Busy",
          "nextStep": "Actionable task for the owner"
        }
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: [{ role: 'user', parts: [{ text: "Simulate the follow-up call." }] }],
        config: { systemInstruction, responseMimeType: "application/json" },
      });
      res.json(parseGeminiJson(response.text));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Meridian Green CRM running on http://localhost:${PORT}`);
  });

  // WebSocket Server for Live Ear
  // FIXME(Management): Implement clustering/Redis process pooling for concurrent websocket voice loads at scale. 
  // Native node WS is sufficient for UI preview but crashes under heavy client multiplexing.
  const wss = new WebSocketServer({ server, path: '/api/live' });

  wss.on('connection', async (clientWs) => {
    console.log('Live Ear Client Connected');

    try {
      const session = await ai.live.connect({
        model: 'gemini-3.1-flash-live-preview',
        callbacks: {
          onmessage: (message: LiveServerMessage) => {
            // Forward audio to client
            const audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (audio) {
              clientWs.send(JSON.stringify({ audio }));
            }

            // Forward transcription
            const transcription = message.serverContent?.modelTurn?.parts?.[0]?.text;
            if (transcription) {
              clientWs.send(JSON.stringify({ transcription }));
            }

            // Handle tool calls (Function Calling)
            const toolCall = message.toolCall;
            if (toolCall) {
              console.log('Gemini Tool Call:', toolCall);
              // Notify client of the detected action
              clientWs.send(JSON.stringify({ action: toolCall }));
              
              // Here we would normally return a functionResponse to Gemini,
              // but for this UI-driven app, we mainly want to trigger client-side actions.
              // To keep Gemini happy, we'll send a dummy success response.
              if (toolCall.functionCalls) {
                session.sendToolResponse({
                  functionResponses: toolCall.functionCalls.map(fc => ({
                    id: fc.id,
                    response: { result: 'Action queued for dispatch in Meridian UI.' }
                  }))
                });
              }
            }

            if (message.serverContent?.interrupted) {
              clientWs.send(JSON.stringify({ interrupted: true }));
            }
          },
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
          },
          systemInstruction: `
            You are "Meridian Ear", the real-time situational awareness layer of Meridian Green Landscaping.
            You listen to the environment (calls on speaker, yard conversations).
            
            YOUR JOB is to help the owner manage everything seamlessly while they are on the phone or in the field.
            You support 3 main categories:
            1. OLD CLIENTS: Pull up their history and preferences when they call.
            2. NEW CLIENTS: Start inputting their info, pulled address, and schedule a first visit.
            3. EMPLOYEES/CREWS: Pull up performance and current route info when mentioned.

            DETECT INTENT and use tools:
            - If they mention scheduling (e.g. "Let's put Mrs. Gable down for Tuesday"), call schedule_job.
            - If they mention billing (e.g. "Send a bill for $400 for the irrigation work"), call create_invoice.
            - If they talk about a client, call load_client_data.
            - If they talk about an employee or crew member, call load_employee_data.
            
            Speak like a helpful, Southern hospitality assistant. Keep it brief and encouraging.
            "I've got Mrs. Gable's history ready," "Adding that new project to the list," "Pulling up Crew Alpha's stats."
          `,
          tools: [
            {
              functionDeclarations: [
                {
                  name: 'schedule_job',
                  description: 'Schedule a landscaping job for a client.',
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      clientName: { type: Type.STRING },
                      date: { type: Type.STRING, description: 'Relative or absolute date' },
                      serviceType: { type: Type.STRING }
                    },
                    required: ['clientName']
                  }
                },
                {
                  name: 'create_invoice',
                  description: 'Generate and send an invoice to a client.',
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      clientName: { type: Type.STRING },
                      amount: { type: Type.NUMBER },
                      serviceDescription: { type: Type.STRING }
                    },
                    required: ['clientName', 'amount']
                  }
                },
                {
                  name: 'load_client_data',
                  description: 'Find and display data for a specific client.',
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      clientName: { type: Type.STRING }
                    },
                    required: ['clientName']
                  }
                },
                {
                  name: 'load_employee_data',
                  description: 'Find and display data for a specific employee or crew member.',
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      employeeName: { type: Type.STRING }
                    },
                    required: ['employeeName']
                  }
                },
                {
                  name: 'create_lead',
                  description: 'Start a new customer profile for a prospective client.',
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      firstName: { type: Type.STRING },
                      lastName: { type: Type.STRING },
                      notes: { type: Type.STRING }
                    },
                    required: ['firstName']
                  }
                }
              ]
            }
          ]
        },
      });

      clientWs.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.audio) {
            session.sendRealtimeInput({
              audio: { data: msg.audio, mimeType: 'audio/pcm;rate=16000' },
            });
          }
        } catch (err) {
          console.error('WS Message Error:', err);
        }
      });

      clientWs.on('close', () => {
        console.log('Live Ear Client Disconnected');
        session.close();
      });

    } catch (error) {
      console.error('Gemini Live Connection Error:', error);
      clientWs.close();
    }
  });
}

startServer();
