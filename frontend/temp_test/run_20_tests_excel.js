const fs = require('fs');
const xlsx = require('xlsx');
const { runDeepScanEngine } = require('./mappingEngine.js');

const testSets = [
    {
        name: "File 1: Perfect Exact Matches",
        headers: ["supplier id", "supplier name", "supplier alias", "supplier legal name", "street address", "city state", "postal code", "country", "phone number", "email address", "tax id", "payment terms", "payment method", "currency", "total number of invoices", "total amount of invoices", "total number of purchase orders", "total amount of purchase orders", "total number of payments paid", "total amount of payments paid", "total number of payments due", "total amount of payments due", "total number of payments open", "total amount of payments open", "transaction count", "annual target spend"]
    },
    {
        name: "File 2: Simple CamelCase",
        headers: ["SupplierId", "SupplierName", "SupplierAlias", "SupplierLegalName", "StreetAddress", "CityState", "PostalCode", "Country", "PhoneNumber", "EmailAddress", "TaxId", "PaymentTerms", "PaymentMethod", "Currency", "TotalInvoices", "TotalAmountInvoices", "TotalPurchaseOrders", "TotalAmountPurchaseOrders", "TotalPaymentsPaid", "TotalAmountPaymentsPaid", "TotalPaymentsDue", "TotalAmountPaymentsDue", "TotalPaymentsOpen", "TotalAmountPaymentsOpen", "TransactionCount", "AnnualTargetSpend"]
    },
    {
        name: "File 3: Heavy Underscores",
        headers: ["vendor_id_number", "vendor_org_name", "vendor_dba_alias", "vendor_registered_name", "street_location_address", "town_and_province", "zip_routing_code", "nation_statehood", "telephone_contact_number", "contact_email_address", "vat_tax_identifier", "net_credit_terms", "mode_of_payment", "fx_tender_currency", "count_of_all_invoices", "sum_value_of_invoices", "qty_of_purchase_orders", "cost_of_purchase_orders", "settled_payments_tally", "remitted_payments_value", "payable_payments_freq", "owed_payments_balance", "unresolved_payments_qty", "pending_payments_amount", "transfer_activity_count", "projected_yearly_spend"]
    },
    {
        name: "File 4: Absolute Concatenation Nightmare",
        headers: ["vendoridentifier", "companytitle", "dbanickname", "corporateentity", "buildingroad", "municipalityregion", "pincode", "republic", "mobilecell", "e-mailinbox", "gsttin", "dueagreements", "wirecheque", "ccymoney", "billingtally", "billingsum", "requisitionsfreq", "requisitionscost", "cleareddisbursedqty", "fulfilledclosedfunds", "maturingexpectedcount", "scheduledupcomingmonies", "outstandingarrearsvolume", "unpaidunsettledprice", "movementrecord", "ytdforecastoutlay"]
    },
    {
        name: "File 5: Legacy ERP Export (Short abbreviations)",
        headers: ["SUPP_ID", "SUPP_NAME", "DBA", "LEG_NAME", "STR_ADDR", "CITY_ST", "ZIP", "CTRY", "TEL", "EMAIL", "TIN", "TERMS", "PAY_METH", "CCY", "INV_QTY", "INV_AMT", "PO_QTY", "PO_AMT", "PD_QTY", "PD_AMT", "DUE_QTY", "DUE_AMT", "OPN_QTY", "OPN_AMT", "TXN_CNT", "ANN_SPEND"]
    },
    {
        name: "File 6: Excessive Noise Words",
        headers: ["the supplier identification number for the record", "all business organization name details", "known as trading alias information", "official registered corporate entity data", "hq location avenue and street details", "municipality and territory details", "area routing pin code data", "nation or republic information", "dial contact fax mobile info", "e-mail inbox address details", "ssn or ein tax id information", "net due days and credit conditions", "ach or wire transfer mode way", "money or fx currency data", "gross count of all billing statements", "cumulative sum of all invoice bills", "total frequency of po requisitions", "overall cost of all pos", "tally of disbursed and cleared payments", "aggregate funds of completed payments", "upcoming expected payment frequency", "payable monies for scheduled payments", "unresolved arrears volume", "outstanding unpaid balance", "movement activity record qty", "planned 12-month expenditure goal"]
    },
    {
        name: "File 7: Plural vs Singular grammatical stress test",
        headers: ["vendor id", "vendor name", "vendor alias", "vendor legal", "street", "city state", "zipcode", "nation", "phone", "email", "taxid", "term", "method", "fx", "invoice", "invoices", "order", "orders", "payment settled", "payments settled", "payment payable", "payments payable", "payment outstanding", "payments outstanding", "transaction", "annual target"]
    },
    {
        name: "File 8: Foreign/Alternative Spellings",
        headers: ["payee ref", "merchant enterprise", "short name display", "tax name incorporated", "line1 line2", "suburb prefecture", "postcode", "statehood", "contact number", "mail", "ein", "conditions of pay", "channel type", "tender", "statements volume", "statements price", "pos tally", "pos spend", "closed freq", "closed cost", "maturing qty", "maturing value", "pending volume", "pending amt", "txn trans", "per year goal"]
    },
    {
        name: "File 9: Synonyms Only",
        headers: ["biller account", "org firm", "display name", "registered entity", "location apt", "metro district", "routing code", "republic", "mobile", "inbox", "gst", "agreements", "card", "money", "bills count", "bills sum", "requisitions qty", "requisitions value", "fulfilled count", "fulfilled sum", "scheduled qty", "scheduled value", "unsettled count", "unsettled sum", "activity volume", "budget expenditure"]
    },
    {
        name: "File 10: Completely Random Order + Noise",
        headers: ["info supplier id data", "info name company data", "data alias vendor info", "data legal corp info", "info street hq data", "data city region info", "info zip pin data", "data country nation info", "info phone cell data", "data email mail info", "info tax ssn data", "data terms net info", "info method wire data", "data currency fx info", "info invoices count data", "data invoices amount info", "info orders qty data", "data orders cost info", "info paid payment qty data", "data paid payment sum info", "info due payment count data", "data due payment value info", "info open payment tally data", "data open payment balance info", "info transaction count data", "data spend annual info"]
    }
];

// Duplicate 10 to make 20 for sheer volume testing (with slight variations)
for (let i = 0; i < 10; i++) {
    const clone = {
        name: `File ${i + 11}: Variant of ${testSets[i].name}`,
        headers: testSets[i].headers.map(h => h.replace(/a/g, 'e').replace(/o/g, 'u')) // simulate typos
    };
    testSets.push(clone);
}

const headerSheetData = [];
const mappingSheetData = [];

for (const set of testSets) {
    const headerRow = { "File Name": set.name };
    set.headers.forEach((h, i) => {
        headerRow[`Header ${i + 1}`] = h;
    });
    headerSheetData.push(headerRow);

    const result = runDeepScanEngine(set.headers, 0.4);
    const mappedSources = new Set();
    
    for (const [targetId, sources] of Object.entries(result.mappings)) {
        if (sources.length > 0) {
            const source = sources[0];
            mappedSources.add(source);
            const score = result.confidenceScores[targetId];
            mappingSheetData.push({
                "File Name": set.name,
                "Original Source Header": source,
                "Mapped Target Schema": targetId,
                "Confidence Score": `${(score * 100).toFixed(1)}%`,
                "Mapping Status": "✅ Successfully Mapped"
            });
        }
    }
    
    const unmapped = set.headers.filter(h => !mappedSources.has(h));
    for (const h of unmapped) {
        mappingSheetData.push({
            "File Name": set.name,
            "Original Source Header": h,
            "Mapped Target Schema": "N/A",
            "Confidence Score": "0.0%",
            "Mapping Status": "❌ Failed to map"
        });
    }
}

const wb = xlsx.utils.book_new();
const wsHeaders = xlsx.utils.json_to_sheet(headerSheetData);
const wsMappings = xlsx.utils.json_to_sheet(mappingSheetData);

xlsx.utils.book_append_sheet(wb, wsHeaders, "Original Headers");
xlsx.utils.book_append_sheet(wb, wsMappings, "Mapping Results Detailed");

const outputPathExcel = 'd:/Study/SmartBridge/test_data/header_mapping/V2_Batch_Results.xlsx';
xlsx.writeFile(wb, outputPathExcel);
console.log(`Success! Wrote Excel file to ${outputPathExcel}`);

const outputPathHeadersCSV = 'd:/Study/SmartBridge/test_data/header_mapping/V2_Batch_Headers.csv';
const outputPathMappingsCSV = 'd:/Study/SmartBridge/test_data/header_mapping/V2_Batch_Mappings.csv';
fs.writeFileSync(outputPathHeadersCSV, xlsx.utils.sheet_to_csv(wsHeaders));
fs.writeFileSync(outputPathMappingsCSV, xlsx.utils.sheet_to_csv(wsMappings));
console.log(`Success! Wrote CSV files as well.`);
