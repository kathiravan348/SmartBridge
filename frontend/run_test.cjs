const fs = require('fs');
const { runDeepScanEngine } = require('./temp_test/mappingEngine.js');

const testHeaders = [
  "supplieridentificationcode",
  "corporateorganizationtitle",
  "streetandavenueaddress",
  "townshipandregion",
  "postalroutingpin",
  "nationorrepublic",
  "cellulardialnumber",
  "contactemailinbox",
  "taxvatidentifier",
  "creditdueterms",
  "paymentmodality",
  "fxtendercurrency",
  "totalinvoicestally",
  "totalinvoicevalue",
  "purchaseorderstally",
  "purchaseordervalue",
  "completedpaymentsnumber",
  "remittedpaymentsamount",
  "unpaidpaymentsbalance",
  "unsettledpaymentsnumber",
  "yearlybudgetgoal"
];

const result = runDeepScanEngine(testHeaders, 0.4);

let doc = "# V2 Engine Execution Results\n\n";
doc += "I built a script to directly test the **Deep Scan Engine (v2)** against 21 heavily concatenated edge-case headers to verify our improvements to the `matching_engine_config.json`.\n\n";
doc += "| Original Header | Mapped Target | Confidence Score |\n";
doc += "| :--- | :--- | :--- |\n";

const allMappedSources = new Set();

for (const [targetId, sources] of Object.entries(result.mappings)) {
    if (sources.length > 0) {
        const source = sources[0];
        allMappedSources.add(source);
        const score = result.confidenceScores[targetId];
        doc += `| \`${source}\` | **${targetId}** | ${(score * 100).toFixed(1)}% |\n`;
    }
}

const unmapped = testHeaders.filter(h => !allMappedSources.has(h));

if (unmapped.length > 0) {
    doc += "\n## Unmapped Headers (Failed)\n";
    for (const h of unmapped) {
        doc += `- \`${h}\`\n`;
    }
}

fs.writeFileSync('C:/Users/kathiravan/.gemini/antigravity-ide/brain/4dad766f-99cd-4c82-bd00-805769f3d5eb/v2_test_results.md', doc);
console.log("Success! Wrote results to v2_test_results.md");
