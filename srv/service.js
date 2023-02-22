const { PassThrough } = require('node:stream');
const cds = require('@sap/cds');
const axios = require("axios");

const utils = require('./utils/utils');
const { HANAUtils } = require('./utils/HANAUtils');
const { SecurityUtils } = require('./utils/SecurityUtils');
const { FDMUtils } = require('./utils/FDMUtils');

class PayrollService extends cds.ApplicationService {
    async init() {
        const db = await cds.connect.to('db')
        const fdm = await cds.connect.to('fdm_masterdata');

        const { PayrollHeader, PayrollDetails, PostingBatch } = db.entities('payroll');
        const { UploadHeader, UploadItems } = db.entities('staging');
        const { LegalEntityGrouping, PaycodeGLMapping } = db.entities('mapping');

        this.on("PUT", "PayrollUploadFile", async (req) => {
            if (req.data.content) {
                const contentType = req._.req.headers['content-type'];
                const contentPropertyMap = new Map(req.headers['content-disposition'].split(";").map((row) => {
                    return row.split("=").map((item) => item.replace(/["]+/g, '').trim());
                }));
                const batchID = contentPropertyMap.get("batchID");
                const fileName = contentPropertyMap.get("filename");

                console.log(`DEBUG: Upload started for batch ${batchID}.`);
                let content = await utils.readUploadStream(req.data.content);
                console.log(`DEBUG: Upload complete for batch ${batchID}.  Starting to parse file content.`);

                const dataToImport = utils.parseCDUpload(content, batchID);
                const result = await HANAUtils.callStoredProc(
                    db.options.credentials,
                    db.options.credentials.schema,
                    "SP_UPLOADINSERT",
                    dataToImport
                );
                console.log(`DEBUG: data posted to db with result: ${JSON.stringify(result)} `);

                await this.emit("enrich", { batchID });
                console.log("enrich completed.")

                // Update filename
                return UPDATE(UploadHeader).set({ FILENAME: fileName }).where({ ID: batchID });
            }
        });

        this.on("PUT", "MappingUploadFile", async (req) => {
            if (req.data.content) {
                const contentType = req._.req.headers['content-type'];
                const contentPropertyMap = new Map(req.headers['content-disposition'].split(";").map((row) => {
                    return row.split("=").map((item) => item.replace(/["]+/g, '').trim());
                }));
                const mappingTable = contentPropertyMap.get("mappingTable");
                const fileName = contentPropertyMap.get("filename");

                console.log(`DEBUG: Upload started for mappingTable ${mappingTable}.`);
                let content = await utils.readUploadStream(req.data.content);
                console.log(`DEBUG: Upload complete for mappingTable ${mappingTable}.  Starting to parse file content.`);

                const mappingDBTable = utils.getMappingDBTable(mappingTable);
                if (mappingDBTable) {
                    const dataToImport = utils.parseMappingUpload(content, mappingDBTable);
                    const result = await HANAUtils.callStoredProc(
                        db.options.credentials,
                        db.options.credentials.schema,
                        `SP_UPSERT_${mappingDBTable}`,
                        dataToImport
                    );
                    console.log(`DEBUG: data posted to db with result: ${JSON.stringify(result)} `);
                    return;
                } else {
                    req.error({ code: 400, message: `Invalid mappingTable : ${mappingTable}.` });
                }
            }
        });

        this.before("CREATE", "StagingUploads", async (context) => {
            const batchId = await HANAUtils.getNextBatchId(db);
            context.data.ID = batchId;
        });

        this.on('enrich', async req => {
            const batchID = req.data.batchID || req.params[0];
            console.log("enriching batchId: " + batchID);

            // Get Staging Data
            const stagingHeader = await SELECT.one.from(UploadHeader).where({ ID: batchID });
            const stagingDataItems = await SELECT.from(UploadItems)
                .columns("PARENT_ID", "ROW", "STATUS", "STATUSMESSAGE", "FMNO", "PAYROLLCODE", "PAYROLLCODESEQUENCE",
                    "NAME", "AMOUNT", "PAYMENTNUMBER", "PAYMENTID", "PAYMENTFORM", "USERFIELD1", "USERFIELD2", "REMARKS",
                    "LOANADVANCEREFERENCENUMBER", "PROJECTCODE", "PROJECTTASK", "GLACCOUNT", "GLCOSTCENTER", "FCAT")
                .where({ PARENT_ID: batchID });


            // Get Info from FDM
            const fdmUtils = new FDMUtils(fdm);
            await fdmUtils.getUserData(stagingHeader.glCompanyCode);
            await fdmUtils.getGLAccounts();
            await fdmUtils.getCompanyCodes();
            await fdmUtils.getWbsElements(stagingHeader.glCompanyCode);
            //await fdmUtils.getExchangeRates();

            // Get Mapping Data
            const le = await SELECT.one.from(LegalEntityGrouping).columns('LEGALENTITYGROUPCODE').where({ COMPANYCODE: stagingHeader.glCompanyCode });
            const mappingData = await SELECT.from(PaycodeGLMapping).where({ LEGALENTITYGROUPCODE: le.LEGALENTITYGROUPCODE });

            let fmnoErrorList = [];
            // Update Staging Data
            let updatedItems = stagingDataItems.map((item) => {
                let errorsForRow = [];
                const userObj = fdmUtils.findUserByFMNO(item.FMNO);
                let userFCAT = userObj?.fcat ?
                    parseInt(userObj?.fcat?.split(" ")[0]).toString().substring(0,2) :
                    null;

                // Validations
                if (!userObj) {
                    errorsForRow.push(`FMNO ${item.FMNO} not found or invalid.`);
                } else {
                    if (!userObj.costCenter || userObj.costCenter == "") {
                        errorsForRow.push(`FMNO ${item.FMNO} does not have cost center.`);
                    } else if (!userFCAT || userFCAT == "" || userFCAT == "000") {
                       errorsForRow.push(`FMNO ${item.FMNO} does not have a valid FCAT (${userFCAT})`);
                    } else if (new Date(userObj.effectiveStartDate) > new Date(stagingHeader.payrollDate)) {
                        errorsForRow.push(`FMNO ${item.FMNO} was not active for payroll date.`);
                    }
                }

                const mappedAccounts = mappingData.filter((mappingRow) =>
                    (mappingRow.payrollCode == item.PAYROLLCODE)
                    && (mappingRow.payrollCodeSequence == (item.PAYROLLCODESEQUENCE || 1))
                    && (new Date(mappingRow.effectiveDate) < new Date()));
                // Get newest by EffectiveDate
                const newestEfectiveDate = new Date(Math.max(...mappedAccounts.map(a => new Date(a.effectiveDate))));
                const mappedAccount = mappedAccounts.find(a => new Date(a.effectiveDate).valueOf() == newestEfectiveDate.valueOf());
                if (!mappedAccount) {
                    errorsForRow.push(`Unable to find GL account mapping for PayrollCode ${item.PAYROLLCODE} and Sequence ${item.PAYROLLCODESEQUENCE}.`);
                } else {
                    if (mappedAccount.payrollCodeClass == "ADVANCE" || mappedAccount.payrollCodeClass == "LOAN") {
                        if (!item.LOANADVANCEREFERENCENUMBER) {
                            errorsForRow.push(`PayrollCodeClass ${mappedAccount.payrollCodeClass} requires a reference number, which is not present.`);
                        }
                    }
                }

                const glAccountObj = fdmUtils.getGLAccount(mappedAccount.glAccount);
                if (!glAccountObj || glAccountObj.accountMarkedForDeletion == 'X' || glAccountObj.accountBlockedForPosting == 'X') {
                    errorsForRow.push(`Invalid GL account ${glAccountObj.glAccount}.`);
                }

                const companyCode = fdmUtils.getCompanyCode(stagingHeader.glCompanyCode);
                if (new Date(companyCode.validFrom) > new Date() || new Date(companyCode.validTo) < new Date()) {
                    errorsForRow.push(`Company Code ${companyCode.companyCode} is not valid.`);
                }

                if (item.projectCode) {
                    const projectCode = fdmUtils.getWbsElement(item.projectCode);
                    // TODO: More Checks for validity?
                    if (!projectCode) {
                        errorsForRow.push(`WBS Element (Project) ${item.projectCode} is not valid.`);
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

                return {
                    ...item,
                    STATUS: rowStatus.STATUS,
                    STATUSMESSAGE: rowStatus.STATUSMESSAGE,
                    GLCOSTCENTER: userObj?.costCenter,
                    GLACCOUNT: glAccountObj?.glAccount | null,
                    GLCURRENCYCODE: companyCode?.currencyCode,
                    FCAT: userFCAT,
                    PERNR: userObj?.personidExt,
                    LOCATIONCODE: userObj?.userLocation,
                    SKILLCODE: userObj?.skillCode,
                }
            });

            // Mark rows invalid if any errors for that FMNO
            updatedItems = updatedItems.map((item)=> ({...item, 
                STATUS: fmnoErrorList.indexOf(item.FMNO) > -1 ? 'INVALID' : item.STATUS,
                STATUSMESSAGE: fmnoErrorList.indexOf(item.FMNO) > -1 ? (item.STATUSMESSAGE || 'FMNO skipped due to errors in other rows.'): item.STATUSMESSAGE
            }));

            // Save back to DB
            return HANAUtils.callStoredProc(
                db.options.credentials,
                db.options.credentials.schema,
                "SP_UPLOADINSERT",
                updatedItems
            );
        });

        this.on('approve', async req => {
            const [batchToApprove] = req.params;
            console.log(batchToApprove);

            // If already approved just trigger CPI
            const currentBatchStatus = await SELECT.one.from(UploadHeader).columns("STATUS").where({ ID: batchToApprove });
            if (currentBatchStatus.STATUS != 'APPROVED') {

                // Mark records approved
                const resultApproveHeader = await UPDATE(UploadHeader).set({ STATUS: 'APPROVED' }).where({ ID: batchToApprove });
                const resultApproveItems = await UPDATE(UploadItems).set({ STATUS: 'APPROVED' }).where({ PARENT_ID: batchToApprove, STATUS: 'VALID' });
                const resultSkipItems = await UPDATE(UploadItems).set({ STATUS: 'SKIPPED' }).where({ PARENT_ID: batchToApprove, STATUS: 'INVALID' });

                if (resultApproveHeader > 0 && resultApproveItems > 0) {
                    // Get FDM Data
                    const fdmUtils = new FDMUtils(fdm);
                    await fdmUtils.getExchangeRates();

                    // Get Data to Copy
                    const dataHeader = await SELECT.one.from(UploadHeader).where({ ID: batchToApprove, STATUS: 'APPROVED' });
                    const dataItems = await SELECT.from(UploadItems).where({ PARENT_ID: batchToApprove, STATUS: 'APPROVED' });

                    // Get Mapping Data
                    const le = await SELECT.one.from(LegalEntityGrouping).columns('LEGALENTITYGROUPCODE').where({ COMPANYCODE: dataHeader.glCompanyCode });
                    const dataMapping = await SELECT.from(PaycodeGLMapping).where({ LEGALENTITYGROUPCODE: le.LEGALENTITYGROUPCODE });

                    if (dataHeader) {
                        // COPY DATA TO PERSISTENT TABLES
                        // POSTING BATCH
                        const postingBatch = 1;
                        const resultCreatePostingBatch = await INSERT.into(PostingBatch).entries({
                            batchId: dataHeader.ID,
                            postingBatchId: postingBatch
                        });

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
                        console.log(`Header added to results table: ${resultCopyHeader.results.length}`);

                        // ITEMS
                        let lineCounter = 0;
                        const payloadItems = dataItems.map((item) => {
                            const mapObj = dataMapping.find((mapItem) => (mapItem.payrollCode == item.payrollCode) && (mapItem.payrollCodeSequence == item.payrollCodeSequence));

                            const glExchangeRate = fdmUtils.getExchangeRate(currencyCode, item.glCurrencyCode);

                            return {
                                batchID_batchID: batchToApprove,
                                batchLineNumber: lineCounter += 1,
                                postingBatchID: postingBatch,
                                postingBatchLineNumber: lineCounter,
                                fcat: item.fcat,
                                fmno: item.fmno,
                                payrollCode: item.payrollCode,
                                payrollCodeSequence: item.payrollCodeSequence,
                                sourceAmount: item.amount,
                                sourceCurrencyCode: currencyCode,
                                sourceCompany: glCompanyCode,
                                paymentID: item.paymentID,
                                pernr: item.pernr,
                                locationCode: item.locationCode,
                                skillCode: item.skilCode,
                                projectCode: item.projectCode,
                                glAccount: item.glAccount,
                                glPostCostCenter: item.glCostCenter,
                                glCurrencyCode: currencyCode,
                                postingAggregation: (mapObj.payrollCodeClass == 'ADVANCE' || mapObj.payrollCodeClass == 'LOAN') ? false : true,
                                advanceNumber: mapObj.payrollCodeClass == 'ADVANCE' ? item.loanAdvanceReferenceNumber : null,
                                loanNumber: mapObj.payrollCodeClass == 'LOAN' ? item.loanAdvanceReferenceNumber : null,
                                usdAmount: utils.convertAmountByExchangeRate(item.amount, glExchangeRate),
                                usdConversionRate: glExchangeRate,
                                usPsrpReportingCode: mapObj.usPsrpCategory
                            }
                        });

                        const resultCopyItems = await INSERT.into(PayrollDetails).entries(payloadItems);
                        console.log(`Details added to results table: ${resultCopyItems.results.length}`);

                        // Commit before trigger
                        const tx = cds.tx()
                        await tx.commit();
                        this.emit("trigger", { batchToApprove });

                        return batchToApprove;
                    } else {
                        req.error({ code: 404, message: `Batch ID:${batchToApprove} does not exist` });
                    }
                } else {
                    req.error({ code: 400, message: `Unable to approve batch ID:${batchToApprove}.` });
                }
            } else {
                console.log("Already approved, just triggering CPI again.");
                this.emit("trigger", { batchToApprove });
                return batchToApprove;
            }
        });

        this.on("trigger", async req => {
            const batchId = req.data.batchToApprove;
            const cpiTrigger = () => {
                return new Promise(async (resolve, reject) => {
                    setTimeout(async () => {
                        console.log(`CPI Trigger - Starting for batch ${batchId}`);
                        const cpiToken = await SecurityUtils.getOauthTokenClientCredentials('https://erpdevsd.authentication.eu10.hana.ondemand.com/oauth/token', 'sb-e73d3295-550c-4a6a-b1ff-523a54304a70!b126539|it-rt-erpdevsd!b117912', '07754849-2615-4a5e-9486-dc0517b2f7dd$k1-FSYAD72_lVn2kIF2QaW_dUDag1KqjSRhHdXsNrlc=');
                        try {
                            axios.defaults.baseURL = `https://erpdevsd.it-cpi018-rt.cfapps.eu10-003.hana.ondemand.com/http`;
                            axios.defaults.headers.common = { 'Authorization': `Bearer ${cpiToken}` };
                            const cpiURL = `https://erpdevsd.it-cpi018-rt.cfapps.eu10-003.hana.ondemand.com/http/cd_lass_payroll_trigger?BatchID=${batchId}`;
                            const responseCPI = await axios.get(cpiURL);
                            console.log(`CPI Trigger - Result: ${cpiURL}:${responseCPI.status}:${responseCPI.statusText}`);
                            resolve(responseCPI);
                        } catch (ex) {
                            console.log("CPI Trigger - Error:: " + ex.message);
                        };
                    }, 3000);
                })
            };
            await cpiTrigger();
        });

        this.after("READ", "StagingUploads", async (result) => {
            if (result.items) {
                result = result.items.map((item) => ({ ...item, "items@odata.count": result.items.length }));
            };
            return result;
        });

        this.on("READ", "CompanyCodes", async (result)=>{
            const fdmUtils = new FDMUtils(fdm);
            return fdmUtils.getCompanyCodes();
        });

        this.on("READ", "Currency", async (result)=>{
            const fdmUtils = new FDMUtils(fdm);
            return fdmUtils.getCurrency();
        });

        // required
        await super.init()
    }
};

module.exports = PayrollService;