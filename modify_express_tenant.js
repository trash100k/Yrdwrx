const fs = require('fs');

let serverCode = fs.readFileSync('server.ts', 'utf8');

// A helper to inject tenant config automatically to all express routes
// We can use a middleware that patches the req object, or patch the route handler, but let's actually just override the `ai.models.generateContent` call globally to pull from an async context, or modify all instances in the code.
// Since modifying 30+ instances via regex might break things, AsyncLocalStorage is a cleaner approach to pass req.user.tenantId (or similar) down to the `generateContent` interceptor!
