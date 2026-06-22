
| Test File Header | Exact `schema.ts` Label |
| :--- | :--- |
| `SupplierIdentifier` | **Supplier ID** |
| `OrganizationTitle` | **Supplier Name** |
| `streetaddress` | **Street Address** |
| `townshipandprovince` | **City State** |
| `postalroutingcode` | **Postal Code** |
| `RepublicName` | **Country** |
| `cellphonenumber` | **Phone Number** |
| `emailinbox` | **Email Address** |
| `taxvatidentifier` | **Tax Id** |
| `creditdueterms` | **Payment Terms** |
| `paymentmodality` | **Payment Method** |
| `FXCurrency` | **Currency** |
| `GivenName` | *(No exact schema equivalent - likely unmapped or fuzzy matches Supplier Alias)* |
| `FamilySurname` | *(No exact schema equivalent - likely unmapped or fuzzy matches Supplier Legal name)* |
| `totalinvoices` | **Total Number of Invoices** |
| `totalinvoice` | **Total Amount of Invoices** |
| `purchaseorderstally` | **Total Number of Purchase Orders** |
| `purchaseordervalue` | **Total Amount of Purchase Orders** |
| `completedpaymentsnumber` | **Total Number of Payments Paid** |
| `remittedpaymentsamount` | **Total Amount of Payments Paid** |
| `pendingpaymentscount` | **Total Number of Payments Due** |
| `outstandingpaymentvalue` | **Total Amount of Payments Due** |
| `unsettledpaymentsnumber` | **Total Number of Payments Open** |
| `unpaidpaymentsbalance` | **Total Amount of Payments Open** |
| `transactionvolume` | **Transaction Count** |
| `yearlybudgetgoal` | **Annual Target Spend** |

*(Note: `GivenName` and `FamilySurname` were included as trick headers, as `schema.ts` actually uses `Supplier Alias` and `Supplier Legal name` instead of First/Last Name!)*