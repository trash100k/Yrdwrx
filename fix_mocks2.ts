import fs from "fs";

function removeMocks(filePath: string) {
  let content = fs.readFileSync(filePath, "utf8");

  // CRM.tsx
  // Replace fallback to mockCustomers with just docs
  content = content.replace(/setCustomers\(docs\.length > 0 \? docs : mockCustomers\);/g, "setCustomers(docs);");
  // Remove fallback in catch
  content = content.replace(/setCustomers\(mockCustomers\);/g, "/* setCustomers(mockCustomers) removed for strict data model */");
  
  // Remove mockCustomers definition array completely
  content = content.replace(/const mockCustomers = \[\s*\{[\s\S]*\}\s*\];/g, "");
  // Replace usages of mockCustomers with customers
  content = content.replace(/mockCustomers\.map/g, "customers.map");
  content = content.replace(/mockCustomers\.filter/g, "customers.filter");

  // CrewSuite.tsx
  content = content.replace(/setCrews\(docs\.length > 0 \? docs : mockCrews\);/g, "setCrews(docs);");
  content = content.replace(/setCrews\(mockCrews\);/g, "/* setCrews(mockCrews) removed */");
  // Remove definition
  content = content.replace(/const mockCrews = \[\s*\{[\s\S]*\}\s*\];/g, "");
  // Replace usages string
  content = content.replace(/mockCrews\.map/g, "crews.map");

  // Invoices.tsx
  // We leave the voice invoice generation alone for now unless it has an explicit array of invoices.

  // Dashboard.tsx
  content = content.replace(/setCrews\(data\.length > 0 \? data : mockCrews\);/g, "setCrews(data);");
  content = content.replace(/setHotLeads\(data\.length > 0 \? data : mockHotLeads\);/g, "setHotLeads(data);");
  content = content.replace(/setVendors\(data\.length > 0 \? data : mockVendors\);/g, "setVendors(data);");
  content = content.replace(/mockCrews/g, "crews");
  content = content.replace(/mockHotLeads/g, "hotLeads");
  content = content.replace(/mockVendors/g, "vendors");

  fs.writeFileSync(filePath, content);
}

["src/pages/CRM.tsx", "src/pages/CrewSuite.tsx", "src/pages/Dashboard.tsx"].forEach((f) => {
  if (fs.existsSync(f)) {
    removeMocks(f);
    console.log(`Cleaned ${f}`);
  }
});
