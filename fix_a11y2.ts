import * as fs from 'fs';

function addKeydown(file: string) {
  let content = fs.readFileSync(file, 'utf8');

  // Dashboard.tsx manual replacements
  content = content.replace(
    /onClick=\{\(\) => setOnboardingAnswers\(prev => \(\{ \.\.\.prev, viewStyle: 'easy' \}\)\)\}/,
    `onClick={() => setOnboardingAnswers(prev => ({ ...prev, viewStyle: 'easy' }))} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOnboardingAnswers(prev => ({ ...prev, viewStyle: 'easy' })); } }}`
  );

  content = content.replace(
    /onClick=\{\(\) => setOnboardingAnswers\(prev => \(\{ \.\.\.prev, viewStyle: 'info-freak' \}\)\)\}/,
    `onClick={() => setOnboardingAnswers(prev => ({ ...prev, viewStyle: 'info-freak' }))} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOnboardingAnswers(prev => ({ ...prev, viewStyle: 'info-freak' })); } }}`
  );

  content = content.replace(
    /onClick=\{\(\) => \{\n\s*setActiveDrawer\('jobs'\);\n\s*setSelectedCrewForSMS\(null\);\n\s*setSmsDraft\(''\);\n\s*\}\}/,
    `onClick={() => {\n                setActiveDrawer('jobs');\n                setSelectedCrewForSMS(null);\n                setSmsDraft('');\n              }}\n              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setActiveDrawer('jobs'); setSelectedCrewForSMS(null); setSmsDraft(''); } }}`
  );

  content = content.replace(
    /onClick=\{\(\) => \{\n\s*setActiveDrawer\('leads'\);\n\s*setSelectedLead\(null\);\n\s*setCallOutcome\(null\);\n\s*\}\}/,
    `onClick={() => {\n                setActiveDrawer('leads');\n                setSelectedLead(null);\n                setCallOutcome(null);\n              }}\n              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setActiveDrawer('leads'); setSelectedLead(null); setCallOutcome(null); } }}`
  );

  content = content.replace(
    /onClick=\{\(\) => \{\n\s*setIsScanning\(true\);\n\s*setParsedScanResult\(null\);\n\s*\}\}/,
    `onClick={() => {\n                setIsScanning(true);\n                setParsedScanResult(null);\n              }}\n              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setIsScanning(true); setParsedScanResult(null); } }}`
  );

  content = content.replace(
    /onClick=\{\(\) => \{\n\s*const next = \{ \.\.\.activeWidgets, \[w\.key\]: !activeWidgets\[w\.key\] \};\n\s*saveWidgetState\(next\);\n\s*\}\}/,
    `onClick={() => { const next = { ...activeWidgets, [w.key]: !activeWidgets[w.key] }; saveWidgetState(next); }} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); const next = { ...activeWidgets, [w.key]: !activeWidgets[w.key] }; saveWidgetState(next); } }}`
  );

  content = content.replace(
    /onClick=\{integration\.status === 'syncing' \|\| integration\.status === 'sending' \|\| integration\.status === 'working' \? undefined : integration\.action\}/,
    `onClick={integration.status === 'syncing' || integration.status === 'sending' || integration.status === 'working' ? undefined : integration.action} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (integration.status !== 'syncing' && integration.status !== 'sending' && integration.status !== 'working') integration.action(); } }}`
  );

  fs.writeFileSync(file, content);
}

function addKeydownScheduler(file: string) {
  let content = fs.readFileSync(file, 'utf8');

  content = content.replace(
    /onClick=\{\(\) => setSelectedJob\(isExpanded \? null : job\)\}/,
    `onClick={() => setSelectedJob(isExpanded ? null : job)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedJob(isExpanded ? null : job); } }}`
  );

  fs.writeFileSync(file, content);
}

addKeydown('src/pages/Dashboard.tsx');
addKeydownScheduler('src/pages/Scheduler.tsx');
