const cds = require('@sap/cds');
const { PassThrough } = require('node:stream');
const xsenv = require("@sap/xsenv")
const axios = require("axios");
const { response } = require('express');
const utils = require('./utils/utils');
const { HANAUtils } = require('./utils/HANAUtils');
const { SecurityUtils } = require('./utils/SecurityUtils');

class PayrollService extends cds.ApplicationService {
    async init() {
        const db = await cds.connect.to('db')
        const fdm = await cds.connect.to('fdm_masterdata');

        const { PayrollHeader, PayrollDetails, PostingBatch } = db.entities('payroll');
        const { UploadHeader, UploadItems } = db.entities('staging');
        const { LegalEntityGrouping, PaycodeGLMapping } = db.entities('mapping');
        const { FMNO_MASTER_PAS } = fdm.entities;

        this.on("PUT", "PayrollUploadFile", async (req) => {
            if (req.data.content) {
                const contentType = req._.req.headers['content-type'];
                const contentPropertyMap = new Map(req.headers['content-disposition'].split(";").map((row) => {
                    return row.split("=").map((item) => item.replace(/["]+/g, '').trim());
                }));
                const batchID = contentPropertyMap.get("batchID");
                const fileName = contentPropertyMap.get("filename");
                let content = '';
                const stream = new PassThrough();
                req.data.content.pipe(stream, { end: false });

                console.log(`DEBUG: Upload started for batch ${batchID}.`);
                await new Promise((resolve, reject) => {
                    try {
                        // Read stream
                        req.data.content.on("data", dataChunk => {
                            content += dataChunk;
                            stream.resume();
                        });

                        // Output stream
                        req.data.content.on("end", async () => {
                            console.log(`DEBUG: Upload complete for batch ${batchID}.  Starting to parse file content.`);
                            const fileRows = content.split("\r\n").filter((row) => row != '');
                            let lineNum = 0;

                            let dataToImport = fileRows.map((line) => {
                                let arrCols = line.split('\t');
                                return {
                                    PARENT_ID: batchID,
                                    ROW: lineNum += 1,
                                    FMNO: arrCols[0],
                                    PAYROLLCODE: arrCols[1],
                                    PAYROLLCODESEQUENCE: arrCols[2] || null,
                                    NAME: arrCols[3],
                                    AMOUNT: arrCols[4],
                                    PAYMENTNUMBER: arrCols[5] || null,
                                    PAYMENTID: arrCols[6],
                                    PAYMENTFORM: arrCols[7],
                                    USERFIELD1: arrCols[8],
                                    USERFIELD2: arrCols[9],
                                    REMARKS: arrCols[10],
                                    LOANADVANCEREFERENCENUMBER: arrCols[11],
                                    PROJECTCODE: arrCols[12],
                                    PROJECTTASK: arrCols[13]
                                };
                            });

                            console.log(`DEBUG: File parsed for batch ${batchID}.`);
                            const result = await HANAUtils.callStoredProc(
                                db.options.credentials,
                                db.options.credentials.schema,
                                "SP_UPLOADINSERT",
                                dataToImport
                            );
                            console.log(`DEBUG: data posted to db with result: ${JSON.stringify(result)} `);

                            this.emit("enrich", { batchID });
                            console.log("enrich triggered. Now returning result.")

                            // Update filename
                            const resultUpdate = await UPDATE(UploadHeader).set({ FILENAME: fileName }).where({ ID: batchID });

                            resolve(result);
                        });
                    } catch (ex) {
                        reject(ex);
                    }
                });
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

            let resultUsers = [];
            try {
                let result = await fdm.get(`/S4_FMNO_MASTER_API?$filter=client eq '200' and branchId eq '${stagingHeader.glCompanyCode}'`);
                resultUsers.push(...result);
                while (result.$nextLink) {
                    result = await fdm.get(`/${result.$nextLink}`);
                    resultUsers.push(...result);
                }
            } catch (ex) {
                console.log("error retrieving data from FDM");
            };

            // Get Mapping Data
            const le = await SELECT.one.from(LegalEntityGrouping).columns('LEGALENTITYGROUPCODE').where({ COMPANYCODE: stagingHeader.glCompanyCode });
            const mappingData = await SELECT.from(PaycodeGLMapping).where({ LEGALENTITYGROUPCODE: le.LEGALENTITYGROUPCODE });

            // Update Staging Data
            let updatedItems = stagingDataItems.map((item) => {
                let errorsForRow = [];
                const userObj = resultUsers.find((user) => user.fmno == item.FMNO);//.padStart(8, '0'));
                let userFCAT = "0";

                // Validations
                if (!userObj) {
                    errorsForRow.push(`User ${item.FMNO} not found or invalid.`);
                } else if (!userObj.costCenter || userObj.costCenter == "") {
                    errorsForRow.push(`User ${item.FMNO} does not have cost center.`);
                } else if (!userObj.groupId || userObj.groupId == "") {
                    errorsForRow.push(`User ${item.FMNO} does not have FCAT.`);
                }

                // TODO: This is temporary logic for determing an FMNO
                switch (userObj?.groupId) {
                    case "F":
                        userFCAT = "400";
                        break;
                    case "1":
                    case "N":
                    case "G":
                    case "I":
                        userFCAT = "300";
                        break;
                    case "C":
                    case "D":
                    case "H":
                        userFCAT = "200";
                    case "P":
                        userFCAT = "100";
                        break;
                    default:
                        userFCAT = "0";
                }

                const mappedAccount = mappingData.find((mappingRow) =>
                    (mappingRow.payrollCode == item.PAYROLLCODE)
                    && (mappingRow.payrollCodeSequence == (item.PAYROLLCODESEQUENCE || 1)));

                if (!mappedAccount) {
                    errorsForRow.push(`Unable to find GL account for PayrollCode ${item.PAYROLLCODE} and Sequence ${item.PAYROLLCODESEQUENCE}.`);
                }

                if (errorsForRow.length) {
                    return { ...item, STATUS: 'INVALID', STATUSMESSAGE: `${errorsForRow.join(',')}` }
                } else {
                    return { ...item, STATUS: 'VALID', STATUSMESSAGE: '', GLCOSTCENTER: userObj.costCenter, GLACCOUNT: mappedAccount.glAccount, FCAT: userFCAT }
                }
            });

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

            const cpiTrigger = async () => {
                const cpiToken = await SecurityUtils.getOauthTokenClientCredentials('https://erpdevsd.authentication.eu10.hana.ondemand.com/oauth/token', 'sb-e73d3295-550c-4a6a-b1ff-523a54304a70!b126539|it-rt-erpdevsd!b117912', '07754849-2615-4a5e-9486-dc0517b2f7dd$k1-FSYAD72_lVn2kIF2QaW_dUDag1KqjSRhHdXsNrlc=');
                try {
                    axios.defaults.baseURL = `https://erpdevsd.it-cpi018-rt.cfapps.eu10-003.hana.ondemand.com/http`;
                    axios.defaults.headers.common = { 'Authorization': `Bearer ${cpiToken}` };
                    const cpiURL = `https://erpdevsd.it-cpi018-rt.cfapps.eu10-003.hana.ondemand.com/http/cd_lass_payroll_trigger?BatchID=${batchToApprove}`;
                    const responseCPI = await axios.get(cpiURL);
                    console.log(`CPI Result: ${cpiURL}:${responseCPI.status}:${responseCPI.statusText}`);
                } catch (ex) {
                    console.log("error retrieving data from FDM");
                };
            }

            // If already approved just trigger CPI
            const currentBatchStatus = await SELECT.one.from(UploadHeader).columns("STATUS").where({ ID: batchToApprove });
            if (currentBatchStatus.STATUS != 'APPROVED') {

                // Mark records approved
                const resultApproveHeader = await UPDATE(UploadHeader).set({ STATUS: 'APPROVED' }).where({ ID: batchToApprove });
                const resultApproveItems = await UPDATE(UploadItems).set({ STATUS: 'APPROVED' }).where({ PARENT_ID: batchToApprove, STATUS: 'VALID' });
                const resultSkipItems = await UPDATE(UploadItems).set({ STATUS: 'SKIPPED' }).where({ PARENT_ID: batchToApprove, STATUS: 'INVALID' });

                if (resultApproveHeader > 0 && resultApproveItems > 0) {
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

                        // ITEMS
                        let lineCounter = 0;
                        const payloadItems = dataItems.map((item) => {
                            const mapObj = dataMapping.find((mapItem) => (mapItem.payrollCode == item.payrollCode) && (mapItem.payrollCodeSequence == item.payrollCodeSequence));

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
                                paymentID: item.paymentID,
                                projectCode: item.projectCode,
                                glAccount: item.glAccount,
                                glPostCostCenter: item.glCostCenter,
                                glCurrencyCode: currencyCode,
                                postingAggregation: (mapObj.payrollCodeClass == 'ADVANCE' || mapObj.payrollCodeClass == 'LOAN') ? false : true,
                                advanceNumber: mapObj.payrollCodeClass == 'ADVANCE' ? item.loanAdvanceReferenceNumber : null,
                                loanNumber: mapObj.payrollCodeClass == 'LOAN' ? item.loanAdvanceReferenceNumber : null,
                            }
                        });

                        const resultCopyItems = await INSERT.into(PayrollDetails).entries(payloadItems);
                        await cpiTrigger();

                        return true;
                    } else {
                        req.error({ code: 404, message: `Batch ID:${batchToApprove} does not exist` });
                    }
                } else {
                    req.error({ code: 400, message: `Unable to approve batch ID:${batchToApprove}.` });
                }
            } else {
                console.log("Already approved, just triggering CPI again.");
                cpiTrigger();
                return true;
            }
        });

        // this.on("READ", "StagingUploads", async (req) =>{
        //     //console.log(req);
        //     const tx = db.tx(req);
        //     const query = req.query;
        //     //query.SELECT.count = true;
        //     return tx.run(query);
        // }); 

        this.after("READ", "StagingUploads", async (result) => {
            if (result.items) {
                result = result.items.map((item) => ({ ...item, "items@odata.count": result.items.length }));
            };
            return result;
        });

        // required
        await super.init()
    }
};

module.exports = PayrollService;