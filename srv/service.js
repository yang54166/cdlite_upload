const cds = require('@sap/cds');
const logger = require("./utils/Logger");
const utils = require('./utils/utils');
const { HANAUtils } = require('./utils/HANAUtils');
const { FDMUtils } = require('./utils/FDMUtils');

class PayrollService extends cds.ApplicationService {
    async init() {
        const db = await cds.connect.to('db')
        const fdm = await cds.connect.to('fdm_masterdata');
        const cpi = await cds.connect.to('cpi');

        const { PostingBatch: PostingBatchConfig } = db.entities('config');
        const { PayrollHeader, PayrollDetails, PostingBatch } = db.entities('payroll');
        const { UploadHeader, UploadItems } = db.entities('staging');
        const { LegalEntityGrouping, PaycodeGLMapping, PayrollLedgerControl } = db.entities('mapping');

        this.on("READ", "CurrentUser", async (req) => {
            let currentUser = new cds.User(req.user);
            let scopes = [];
            if (currentUser.is("admin")) { scopes.push("admin") };
            if (currentUser.is("upload")) { scopes.push("upload") };
            if (currentUser.is("delete")) { scopes.push("delete") };
            if (currentUser.is("approve")) { scopes.push("approve") };
            return {
                id: currentUser.id,
                companycode: currentUser.attr.companycode,
                scopes: scopes
            };
        });

        this.on("PUT", "PayrollUploadFile", async (req) => {
            if (req.data.content) {
                try {
                    const contentType = req._.req.headers['content-type'];
                    const contentPropertyMap = new Map(req.headers['content-disposition'].split(";").map((row) => {
                        return row.split("=").map((item) => item.replace(/["]+/g, '').trim());
                    }));
                    const batchID = contentPropertyMap.get("batchID");
                    const fileName = contentPropertyMap.get("filename");

                    logger.log("cds","debug",`Upload started for batch ${batchID}.`);
                    let content = await utils.readUploadStream(req.data.content);
                    logger.log("cds","debug",`Upload complete for batch ${batchID}.  Starting to parse file content.`);

                    const dataToImport = utils.parseCDUpload(content, batchID);
                    const validationResult = utils.validateEntities(dataToImport, UploadItems);
                    if (validationResult.isValid) {
                        const result = await HANAUtils.callStoredProc(
                            db.options.credentials,
                            db.options.credentials.schema,
                            "SP_UPLOADINSERT",
                            dataToImport
                        );
                        logger.log("cds","debug",`data posted to db with result: ${JSON.stringify(result)} `);

                        //await this.emit("enrich", { batchID });
                        await enrichBatch(req, batchID);

                        // Update filename
                        return UPDATE(UploadHeader).set({ FILENAME: fileName }).where({ ID: batchID });
                    } else {
                        logger.log("cds","error", validationResult.errorMessage);
                        return req.error({ code: 1, status: 400, message: validationResult.errorMessage, target: 'PayrollUploadFile' });
                    }
                } catch (ex) {
                    logger.log("cds","error", `Error while uploading file: ${ex.message}`);
                    req.error({ code: 1, status: 400, message: `Error while uploading file: ${ex.message}` });
                }
            }
        });

        this.on("PUT", "MappingUploadFile", async (req) => {
            if (req.data.content) {
                try {
                    const contentType = req._.req.headers['content-type'];
                    const contentPropertyMap = new Map(req.headers['content-disposition'].split(";").map((row) => {
                        return row.split("=").map((item) => item.replace(/["]+/g, '').trim());
                    }));
                    const mappingTable = contentPropertyMap.get("mappingTable");
                    const fileName = contentPropertyMap.get("filename");

                    logger.log("cds","debug",`DEBUG: Upload started for mappingTable ${mappingTable}.`);
                    let content = await utils.readUploadStream(req.data.content);
                    logger.log("cds","debug",`DEBUG: Upload complete for mappingTable ${mappingTable}.  Starting to parse file content.`);

                    const entityType = (() => {
                        switch (mappingTable.toUpperCase()) {
                            case "LEGALENTITYGROUPING":
                                return LegalEntityGrouping
                            case "PAYCODEGLMAPPING":
                                return PaycodeGLMapping;
                            case "PAYROLLLEDGERCONTROL":
                                return PayrollLedgerControl;
                        }
                    })();
                    const mappingDBTable = utils.getMappingDBTable(mappingTable);
                    if (mappingDBTable) {
                        const dataToImport = utils.parseMappingUpload(content, mappingDBTable);
                        const validationResult = utils.validateEntities(dataToImport, entityType);
                        if (validationResult.isValid) {
                            const result = await HANAUtils.callStoredProc(
                                db.options.credentials,
                                db.options.credentials.schema,
                                `SP_UPSERT_${mappingDBTable}`,
                                dataToImport
                            );
                            logger.log("cds","debug", `Data posted to db with result: ${JSON.stringify(result)} `);
                            return;
                        } else {
                            logger.log("cds","error", validationResult.errorMessage);
                            return req.error({ code: 3, status: 400, message: validationResult.errorMessage, target: 'MappingUploadFile' });
                        }
                    } else {
                        logger.log("cds","error", `Invalid mappingTable : ${mappingTable}.`);
                        req.error({ code: 2, status: 400, message: `Invalid mappingTable : ${mappingTable}.` });
                    }
                } catch (ex) {
                    logger.log("cds","error", `Error while uploading file: ${ex.message}`);
                    req.error({ code: 1, status: 400, message: `Error while uploading file: ${ex.message}` });
                }
            }
        });

        this.before("CREATE", "StagingUploads", async (context) => {
            const batchId = await HANAUtils.getNextBatchId(db);
            context.data.ID = batchId;
        });

        const enrichBatch = async (req, batchID) => {
            try {
                // Get Staging Data
                const stagingHeader = await SELECT.one.from(UploadHeader).where({ ID: batchID });
                const stagingDataItems = await SELECT.from(UploadItems)
                    .columns("PARENT_ID", "ROW", "STATUS", "STATUSMESSAGE", "FMNO", "PAYROLLCODE", "PAYROLLCODESEQUENCE",
                        "NAME", "AMOUNT", "PAYMENTNUMBER", "PAYMENTID", "PAYMENTFORM", "USERFIELD1", "USERFIELD2", "REMARKS",
                        "LOANADVANCEREFERENCENUMBER", "PROJECTCODE", "PROJECTTASK", "GLACCOUNT", "GLCOSTCENTER", "FCAT")
                    .where({ PARENT_ID: batchID });

                // Update Header with Payroll Period
                const resultsHeaderUpdate = await UPDATE(UploadHeader).set({ payrollPeriod: utils.convertDateToPayPeriod(new Date(stagingHeader.payrollDate)) }).where({ ID: batchID });

                // Get Info from FDM
                const fdmUtils = new FDMUtils(fdm);
                await fdmUtils.getEmployeeData(stagingHeader.glCompanyCode);
                await fdmUtils.getGLAccounts();
                await fdmUtils.getCompanyCodes();
                await fdmUtils.getWbsElements(stagingHeader.glCompanyCode);

                // Get Mapping Data
                const le = await SELECT.one.from(LegalEntityGrouping).columns('LEGALENTITYGROUPCODE').where({ COMPANYCODE: stagingHeader.glCompanyCode });
                const mappingData = await SELECT.from(PaycodeGLMapping).where({ LEGALENTITYGROUPCODE: le.LEGALENTITYGROUPCODE });

                let fmnoErrorList = [];
                let fmnoTotals = new Map();

                // Update Staging Data
                let updatedItems = stagingDataItems.map((item) => {
                    let errorsForRow = [];
                    const employeeObj = fdmUtils.findEmployeeByFMNO(item.FMNO, stagingHeader.payrollDate);
                    let userFCAT = employeeObj?.fcat ?
                        employeeObj?.fcat?.split(" ")[0].toString().substring(0, 3) :
                        null;

                    // Validations
                    if (!employeeObj) {
                        errorsForRow.push(`FMNO ${item.FMNO} not found in ${stagingHeader.glCompanyCode}, or invalid.`);
                    } else {
                        if (!employeeObj.costCenterCode || employeeObj.costCenterCode == "") {
                            errorsForRow.push(`FMNO ${item.FMNO} does not have cost center.`);
                        } else if (!userFCAT || userFCAT == "" || userFCAT == "000") {
                            errorsForRow.push(`FMNO ${item.FMNO} does not have a valid FCAT (${userFCAT})`);
                        } else if (new Date(employeeObj.effectiveStartDate) > new Date(stagingHeader.payrollDate)) {
                            errorsForRow.push(`FMNO ${item.FMNO} was not active for payroll date.`);
                        }
                    }

                    // Get Mapping
                    const mappedAccount = mappingData.find((mappingRow) =>
                        (mappingRow.payrollCode == item.PAYROLLCODE)
                        && (mappingRow.payrollCodeSequence == (item.PAYROLLCODESEQUENCE))
                    );
                    if (!mappedAccount) {
                        errorsForRow.push(`Unable to find GL account mapping for PayrollCode ${item.PAYROLLCODE} and Sequence ${item.PAYROLLCODESEQUENCE}.`);
                    } else {
                        if (mappedAccount.payrollCodeClass == "ADVANCE" || mappedAccount.payrollCodeClass == "LOAN") {
                            if (!item.LOANADVANCEREFERENCENUMBER) {
                                errorsForRow.push(`PayrollCodeClass ${mappedAccount.payrollCodeClass} requires a reference number, which is not present.`);
                            }
                        }
                        if (mappedAccount.payrollCodeClass == "PROJECT") {
                            if (!item.PROJECTCODE) {
                                errorsForRow.push(`PayrollCodeClass ${mappedAccount.payrollCodeClass} requires a project code, which is not present.`);
                            }
                        }
                    }

                    // GL Accounts
                    const glAccountObj = fdmUtils.getGLAccount(mappedAccount?.glAccount);
                    const glAccountCBObj = fdmUtils.getGLAccount(mappedAccount?.glAccountCB);
                    if (mappedAccount?.payrollCodeType != "NOTIONAL") {
                        if (!glAccountObj || glAccountObj.accountMarkedForDeletion == 'X' || glAccountObj.accountBlockedForPosting == 'X') {
                            errorsForRow.push(`Invalid GL account ${mappedAccount?.glAccount}.`);
                        }
                        if (!glAccountCBObj || glAccountCBObj.accountMarkedForDeletion == 'X' || glAccountCBObj.accountBlockedForPosting == 'X') {
                            errorsForRow.push(`Invalid GL CB account ${mappedAccount?.glAccountCB}.`);
                        }
                    }

                    // Company Info
                    const companyCode = fdmUtils.getCompanyCode(stagingHeader.glCompanyCode);
                    if (new Date(companyCode.validFrom) > new Date() || new Date(companyCode.validTo) < new Date()) {
                        errorsForRow.push(`Company Code ${companyCode.companyCode} is not valid.`);
                    }
                    //const companyCodeForEmployee = fdmUtils.getCompanyCode(employeeObj?.branchId || stagingHeader.glCompanyCode);

                    // Validate Project Code / WBS 
                    if (item.PROJECTCODE) {
                        const projectCode = fdmUtils.getWbsElement(item.PROJECTCODE);
                        if (!projectCode) {
                            errorsForRow.push(`WBS Element (Project) ${item.PROJECTCODE} is not valid.`);
                        }
                    }

                    // Default to INVALID, and only mark valid if confirmed no errors.
                    let rowStatus = { STATUS: 'INVALID', STATUSMESSAGE: `${errorsForRow.join(',')}` }
                    if (!errorsForRow.length) {
                        // VALID
                        rowStatus.STATUS = 'VALID';
                        rowStatus.STATUSMESSAGE = ''
                    } else {
                        // Keep list of fmnos with errors
                        if (fmnoErrorList.indexOf(item.FMNO) < 0) {
                            fmnoErrorList.push(item.FMNO);
                        }
                    }

                    // Update fmno totals for NET ZERO
                    if (item.PAYROLLCODETYPE != "NOTIONAL") {
                        const newTotal = ((parseFloat(fmnoTotals.get(item.FMNO)) || 0) + parseFloat(item.AMOUNT)).toFixed(2);
                        fmnoTotals.set(item.FMNO, newTotal);
                    }

                    return {
                        ...item,
                        STATUS: rowStatus.STATUS,
                        STATUSMESSAGE: rowStatus.STATUSMESSAGE,
                        GLCOSTCENTER: employeeObj?.costCenterCode,
                        GLACCOUNT: glAccountObj?.glAccount || null,
                        GLACCOUNTCB: glAccountCBObj?.glAccount || null,
                        GLACCOUNTTYPE: glAccountObj?.glAccountType || null,
                        GLCURRENCYCODE: companyCode?.currencyCode,
                        FCAT: userFCAT,
                        PERNR: employeeObj?.personidExt,
                        LOCATIONCODE: employeeObj?.userLocation,
                        SKILLCODE: employeeObj?.skillCode,
                        CHARGECOMPANY: companyCode?.companyCode
                    }
                });

                // Mark rows invalid if any errors for that FMNO
                updatedItems = updatedItems.map((item) => {
                    let errorMessage = undefined;
                    if (fmnoErrorList.indexOf(item.FMNO) > -1) {
                        errorMessage = 'FMNO skipped due to errors in other rows.';
                    }

                    // NET ZERO validation for FMNO
                    if (utils.validateTransactionTypeShouldNetZero(stagingHeader.transactionType)) {
                        const fmnoTotal = parseFloat(fmnoTotals.get(item.FMNO));
                        if (fmnoTotal !== 0) {
                            errorMessage = `FMNO skipped due to non-zero balance for sum of all rows. ${fmnoTotal}`;
                        }
                    }

                    return {
                        ...item,
                        STATUS: errorMessage ? 'INVALID' : item.STATUS,
                        STATUSMESSAGE: errorMessage ? (item.STATUSMESSAGE || errorMessage) : item.STATUSMESSAGE
                    }
                });

                // Save back to DB
                const resultSave = await HANAUtils.callStoredProc(
                    db.options.credentials,
                    db.options.credentials.schema,
                    "SP_UPLOADINSERT",
                    updatedItems
                );

                // Update Header Status
                const resultValidatedHeader = await UPDATE(UploadHeader).set({ STATUS: 'VALIDATED' }).where({ ID: batchID });
                logger.log("cds","info","Enrichment complete. Set batch to VALIDATED.");

                return resultSave;
            } catch (ex) {
                logger.log("cds","error", `Error while enriching batch ID:${batchID}: ${ex.message}`);
                req.error({ code: 400, message: `Error while enriching batch ID:${batchID}: ${ex.message}` });
            }
        };

        this.on('enrich', async req => {
            const batchID = req.data.batchID || req.params[0];
            logger.log("cds","info","Enriching batchId: " + batchID);

            return enrichBatch(req, batchID);
        });

        this.on('approve', async req => {
            const [batchToApprove] = req.params;
            try {
                // If already approved just trigger CPI
                const currentBatchStatus = await SELECT.one.from(UploadHeader).columns("STATUS").where({ ID: batchToApprove });
                if (currentBatchStatus.STATUS != 'APPROVED') {

                    // Mark records approved
                    const resultApproveHeader = await UPDATE(UploadHeader).set({ STATUS: 'APPROVED' }).where({ ID: batchToApprove });
                    const resultApproveItems = await UPDATE(UploadItems).set({ STATUS: 'APPROVED' }).where({ PARENT_ID: batchToApprove, STATUS: 'VALID' });
                    const resultSkipItems = await UPDATE(UploadItems).set({ STATUS: 'SKIPPED' }).where({ PARENT_ID: batchToApprove, STATUS: 'INVALID' });

                    if (resultApproveHeader > 0 && resultApproveItems > 0) {
                        // Get Posting Config
                        const postingConfig = await SELECT.one.from(PostingBatchConfig);

                        // Get Data to Copy
                        const dataHeader = await SELECT.one.from(UploadHeader).where({ ID: batchToApprove, STATUS: 'APPROVED' });
                        const dataItems = (await SELECT.from(UploadItems).where({ PARENT_ID: batchToApprove, STATUS: 'APPROVED' }).orderBy(`FMNO asc`));

                        // Get FDM Data
                        const fdmUtils = new FDMUtils(fdm);
                        await fdmUtils.getExchangeRates(dataHeader.currencyCode, dataHeader.payrollDate);
                        if (fdmUtils.exchangeRates.length == 0) {
                            throw ({ message: `Exchange Rates not found for ${dataHeader.currencyCode} and payrollDate ${dataHeader.payrollDate}` });
                        }

                        // Get Mapping Data
                        const le = await SELECT.one.from(LegalEntityGrouping).columns('LEGALENTITYGROUPCODE').where({ COMPANYCODE: dataHeader.glCompanyCode });
                        const dataMapping = await SELECT.from(PaycodeGLMapping).where({ LEGALENTITYGROUPCODE: le.LEGALENTITYGROUPCODE });
                        const ledgerControl = await SELECT.one.from(PayrollLedgerControl).where({ TRANSACTIONTYPE: dataHeader.transactionType });

                        if (dataHeader) {
                            // COPY DATA TO PERSISTENT TABLES
                            await cds.tx(async () => {
                                // HEADER
                                const { createdAt, createdBy, modifiedAt, modifiedBy, glCompanyCode, batchDescription, transactionType, currencyCode, payrollDate, glPeriod, effectivePeriod, filename, remarks } = dataHeader;
                                const payloadHeader = {
                                    batchID: dataHeader.ID,
                                    createdAt,
                                    createdBy,
                                    modifiedAt,
                                    modifiedBy,
                                    batchDescription,
                                    batchStatus: 'APPROVED',
                                    approvedAt: new Date(),
                                    approvedBy: req.user.id,
                                    cdTransactionType: transactionType,
                                    controlAmount: dataItems.reduce((prev, curr) => (parseFloat(prev) + parseFloat(curr.amount)).toFixed(2), 0),
                                    controlCount: dataItems.length || 0,
                                    effectiveDate: utils.convertPeriodToDate(effectivePeriod),
                                    glDate: utils.convertPeriodToDate(glPeriod),
                                    payrollDate,
                                    payrollPeriod: utils.convertDateToPayPeriod(new Date(payrollDate)),
                                    sourceSystem: 'PAYROLL',
                                    companyCode: glCompanyCode
                                };
                                const resultCopyHeader = await INSERT.into(PayrollHeader).entries(payloadHeader);
                                logger.log("cds","debug",`Header added to results table: ${resultCopyHeader.results.length}`);

                                // ITEMS
                                let lineCounter = 0;
                                let fmnoList = [];
                                let postingBatches = 1;
                                const payloadItems = dataItems.map((item) => {
                                    const fmnoActiveInBatch = (fmnoList.indexOf(item.fmno) > -1);
                                    if (!fmnoActiveInBatch) {
                                        if (fmnoList.length > postingConfig.maxFMNO_perPostingBatch) {
                                            postingBatches = Math.ceil(fmnoList.length / postingConfig.maxFMNO_perPostingBatch) || 1;
                                        }
                                        fmnoList.push(item.fmno);
                                    };

                                    const mapObj = dataMapping.find((mapItem) => (mapItem.payrollCode == item.payrollCode) && (mapItem.payrollCodeSequence == item.payrollCodeSequence));
                                    if (!mapObj) { logger.log("cds","error",`Unable to find mapping for ${item.payrollCode} : ${item.payrollCodeSequence}`) };

                                    const glExchangeRateSourceToUSD = fdmUtils.getExchangeRate(currencyCode, 'USD');
                                    const glExchangeRateSourceToCompany = fdmUtils.getExchangeRate(currencyCode, item.glCurrencyCode);
                                    if (!glExchangeRateSourceToCompany) {
                                        throw ({ message: `Unable to approve Batch ID:${batchToApprove}. Exchange Rate does not exist for ${currencyCode} to ${item.glCurrencyCode}` });
                                    }
                                    //const glExchangeRateSourceToChargeCompany = fdmUtils.getExchangeRate(item.glCurrencyCode, currencyCode);

                                    const aggregationType = (() => {
                                        if (mapObj.payrollCodeClass == 'ADVANCE' || mapObj.payrollCodeClass == 'LOAN') {
                                            return "NONE";
                                        } else if (item.glAccountType == 'Balance Sheet Account') {
                                            return "GLACCOUNT";
                                        } else if (mapObj.payrollCodeType == 'NOTIONAL') {
                                            return "SKIP"
                                        } else {
                                            return "BUSINESSAREA";
                                        }
                                    })();

                                    const glPostCostCenter = mapObj.defaultDepartment ? (`${employeeObj.costCenter.substring(0, 3)}${mapObj.defaultDepartment}`) : item.glCostCenter;

                                    return {
                                        batchID_batchID: batchToApprove,
                                        batchLineNumber: lineCounter += 1,
                                        postingBatchID: ledgerControl ? `${postingBatches}.1` : null,
                                        postingBatchIDCBLedger: ledgerControl?.ledgerGroupCB ? `${postingBatches}.2` : null,
                                        fcat: item.fcat,
                                        fmno: item.fmno,
                                        paymentID: item.paymentId,
                                        payrollCode: item.payrollCode,
                                        payrollCodeSequence: item.payrollCodeSequence,
                                        payrollCodeClass: mapObj.payrollCodeClass,
                                        payrollCodeType: mapObj.payrollCodeType,
                                        sourceAmount: item.amount,
                                        sourceCurrencyCode: currencyCode,
                                        sourceCompany: glCompanyCode,
                                        pernr: item.pernr,
                                        legalEntityGroupCode: le.LEGALENTITYGROUPCODE,
                                        locationCode: item.locationCode,
                                        skillCode: item.skillCode,
                                        projectCode: item.projectCode,
                                        qualifiedCompensation: mapObj.qualifiedCompensation,
                                        cashAmount: item.amount,
                                        chargeAmount: utils.convertAmountByExchangeRate(item.amount, glExchangeRateSourceToCompany.exchangeRate),
                                        chargeCompany: glCompanyCode,
                                        chargeConversionDate: utils.convertPeriodToDate(glExchangeRateSourceToCompany.period),
                                        chargeConversionRate: glExchangeRateSourceToCompany.exchangeRate,
                                        chargeConversionType: "M",
                                        chargeCostCenter: item.glCostCenter,
                                        chargeCurrencyCode: item.glCurrencyCode,
                                        chargeDepartment: item.glCostCenter.slice(-5),
                                        chargeGoc: item.glCostCenter.substring(0, 3),
                                        glAccount: item.glAccount,
                                        glAccountCBLedger: item.glAccountCB,
                                        glPostAmount: utils.convertAmountByExchangeRate(item.amount, glExchangeRateSourceToCompany.exchangeRate),
                                        glPostCompany: glCompanyCode,
                                        glPostCostCenter: glPostCostCenter,
                                        glPostDepartment: glPostCostCenter.slice(-5),
                                        glPostGoc: glPostCostCenter.substring(0, 3),
                                        glConversionRate: glExchangeRateSourceToCompany.exchangeRate,
                                        glCurrencyCode: item.glCurrencyCode,
                                        postingAggregation: aggregationType,
                                        advanceNumber: mapObj.payrollCodeClass == 'ADVANCE' ? item.loanAdvanceReferenceNumber : null,
                                        loanNumber: mapObj.payrollCodeClass == 'LOAN' ? item.loanAdvanceReferenceNumber : null,
                                        usdAmount: utils.convertAmountByExchangeRate(item.amount, glExchangeRateSourceToUSD.exchangeRate),
                                        usdConversionRate: glExchangeRateSourceToUSD.exchangeRate,
                                        usdConversionType: "M",
                                        usPsrpReportingCode: mapObj.usPsrpCategory,
                                        vendorReference: mapObj.vendorReference
                                    }
                                });

                                const resultCopyItems = await INSERT.into(PayrollDetails).entries(payloadItems);
                                logger.log("cds","debug",`Details added to results table: ${resultCopyItems.results.length}`);

                                for (var postingBatchID = 1; postingBatchID <= postingBatches; postingBatchID += 1) {
                                    const resultCreatePostingBatch = await INSERT.into(PostingBatch).entries({
                                        batchId: dataHeader.ID,
                                        postingBatchId: `${postingBatchID}.1`,
                                        postingStatus: "PENDING",
                                        postingStatusMessage: "Posting to S/4HANA pending.",
                                        postingType: "STANDARD"
                                    });

                                    if (ledgerControl?.ledgerGroupCB) {
                                        const resultCreatePostingBatchCB = await INSERT.into(PostingBatch).entries({
                                            batchId: dataHeader.ID,
                                            postingBatchId: `${postingBatchID}.2`,
                                            postingStatus: "PENDING",
                                            postingStatusMessage: "Posting to S/4HANA CB Ledger pending.",
                                            postingType: "CBLEDGER"
                                        });
                                    }
                                }
                            });
                            // previous tx logic ensures commit before trigger
                            await this.emit("trigger", { batchToApprove });

                        } else {
                            req.error({ code: 404, message: `Batch ID:${batchToApprove} does not exist` });
                        }
                    } else {
                        req.error({ code: 400, message: `Unable to approve batch ID:${batchToApprove}.` });
                    }
                }
            
            } catch (ex) {
                req.error({ code: 400, message: `Error while approving batch ID:${batchToApprove}: ${ex.message}` });
            }
        });

        this.on("trigger", async req => {
            const batchId = req.data.batchToApprove || req.params[0];
            logger.log("cpi","info",`CPI Trigger - Starting for batch ${batchId}`);
            const resultTrigger = await cpi.send({ path: `/cd_payroll_trigger?BatchID=${batchId}&$format=json`, headers: { Accept: "application/json" } });
            logger.log("cpi","info",`CPI Response: ${resultTrigger.substring(0, 500)}`);
            return true;
        });

        this.after("READ", "StagingUploads", async (result) => {
            if (result.items) {
                result = result.items.map((item) => ({ ...item, "items@odata.count": result.items.length }));
            };
            return result;
        });

        this.after("READ", "ApprovalSummary", async (results) => {
            // Apply custom sort, so TOTAL is at the end.
            const sortedList = results.sort((a, b) => {
                if ((b.STATUS == "TOTAL") || (a.STATUS < b.STATUS)) {
                    return -1;
                } else if ((a.STATUS == "TOTAL") || (a.STATUS > b.STATUS)) {
                    return 1;
                } else {
                    return 0;
                }
            });
            return sortedList;
        });

        this.on("READ", "CompanyCodes", async (req) => {
            const permittedCompanyCodes = req.user.is("admin") ? "*" : req.user.attr.companycode || [];
            const fdmUtils = new FDMUtils(fdm);
            const allCompanyCodes = await fdmUtils.getCompanyCodes();

            // Return all for admin, filter for everyone else.
            return allCompanyCodes.filter((cc) => {
                return (permittedCompanyCodes == "*") || (permittedCompanyCodes.indexOf(cc.companyCode) > -1);
            })
        });

        this.on("READ", "Currency", async (req) => {
            const fdmUtils = new FDMUtils(fdm);
            return fdmUtils.getCurrency();
        });

        this.on('deleteAllMapping', async req => {
            const mappingTableToDelete = req.data.mappingTable;
            logger.log("cds","info",`deleteAllMapping for ${JSON.stringify(req.data)}`);
            let realTable = "";
            switch (mappingTableToDelete) {
                case "LegalEntityGrouping":
                    realTable = "MAPPING_LEGALENTITYGROUPING";
                    break;
                case "PaycodeGLMapping":
                    realTable = "MAPPING_PAYCODEGLMAPPING";
                    break;
                case "TransactionTypes":
                    realTable = "MAPPING_PAYROLLLEDGERCONTROL";
                    break;
                default:
                    return req.error({ code: 1, status: 400, message: `Invalid mappingTable specified: ${mappingTableToDelete}`, target: 'deleteAllMapping' });
            }

            //Start Deleting
            const deleteResult = await HANAUtils.execQuery(db.options.credentials, `DELETE FROM "${realTable}"`);
            return true;
        });

        // required
        await super.init()
    }
};

module.exports = PayrollService;