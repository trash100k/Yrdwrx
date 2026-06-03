const http = require('http');

const payloads = [
  { name: 'Valid Translate', path: '/api/translate', method: 'POST', body: { text: "Hello", targetLanguage: "es", sourceContext: "Test" }, expectedStatus: 200 },
  { name: 'DAX Injection', path: '/api/translate', method: 'POST', body: { text: "evaluate filter(table)", targetLanguage: "es" }, expectedStatus: 403 },
  { name: 'Path Traversal Body', path: '/api/translate', method: 'POST', body: { text: "Test", targetLanguage: "../../../../etc/passwd" }, expectedStatus: 403 },
  { name: 'File Ext Block (.pbix)', path: '/api/translate/malicious.pbix', method: 'POST', body: { text: "Test" }, expectedStatus: 403 },
  { name: 'File Ext Block (.ps1)', path: '/api/upload/script.ps1', method: 'POST', body: { text: "Test" }, expectedStatus: 403 },
  { name: 'File Ext Block (.php)', path: '/api/upload/shell.php', method: 'POST', body: { text: "Test" }, expectedStatus: 403 },
  { name: 'File Ext Block (.env)', path: '/api/config/.env', method: 'POST', body: { text: "Test" }, expectedStatus: 403 },
  { name: 'File Ext Block (.sql)', path: '/api/dump.sql', method: 'POST', body: { text: "Test" }, expectedStatus: 403 },
  { name: 'SQL Injection', path: '/api/translate', method: 'POST', body: { text: "drop table users;", targetLanguage: "es" }, expectedStatus: 403 },
  { name: 'Invalid Language Format', path: '/api/translate', method: 'POST', body: { text: "Test", targetLanguage: "es; DROP TABLE users" }, expectedStatus: 403 }, // Blocked by DAX/SQL rules first or route rules second
  { name: 'Non-JSON Lineage', path: '/api/translate', method: 'POST', body: "this is raw text, not json", headers: { 'content-type': 'text/plain' }, expectedStatus: 415 }
];

async function runTests() {
  console.log("🚀 Initiating Enterprise Security Gauntlet...\n");
  for (const test of payloads) {
    // console.log(`\nTesting: ${test.name}`);
    await new Promise(resolve => {
        const bodyContent = typeof test.body === 'string' ? test.body : JSON.stringify(test.body || {});
        const req = http.request({
            hostname: 'localhost',
            port: 3000,
            path: test.path,
            method: test.method,
            headers: test.headers || {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(bodyContent)
            }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                const passed = res.statusCode === test.expectedStatus ? "✅ PASS" : "❌ FAIL";
                console.log(`${passed} | ${test.name} | Expected: ${test.expectedStatus}, Got: ${res.statusCode} | Output: ${data.trim().substring(0, 80)}`);
                resolve();
            });
        });
        
        req.on('error', (e) => {
           console.error(`❌ FAIL | ${test.name} | Request error: ${e.message}`);
           resolve();
        });
        
        req.write(bodyContent);
        req.end();
    });
  }
}

runTests();
