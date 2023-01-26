const cds = require('@sap/cds');
const utils = require('./utils');
const { HANAUtils } = require('./utils/HANAUtils');


class PayrollService extends cds.ApplicationService {
    async init() {
        const db = await cds.connect.to('db')
        const fdm = await cds.connect.to('fdm_masterdata');

        const { PayrollHeader, PayrollDetails, PostingBatch } = db.entities('payroll');
        const { UploadHeader, UploadItems } = db.entities('payroll.staging');
        const { LegalEntityGrouping, PaycodeGLMapping } = db.entities('mapping');
        const { FMNO_MASTER_PAS } = fdm.entities;

        this.before("CREATE", "StagingUploads", async (context) => {
            const batchId = await HANAUtils.getNextBatchId(db);
            context.data.ID = batchId;
        });

        // this.after("CREATE", "StagingUploads", async (req)=>{
        //     this.emit("enrich", { batchID: req.ID });
        // });

        this.on('enrich', async req =>{
            const [batchID] = req.data.batchId || req.params;
            // TODO:  Calculate Period
            // Get User Info from FDM
            const resultUsers = await fdm.get(`/FMNO_MASTER_PAS(IP_PERIOD='202301')/Set`);
            
            // Get Staging Data
            const stagingHeader = await SELECT.one.from(UploadHeader).where({ ID: batchID});
            const stagingDataItems = await SELECT.from(UploadItems)
                .columns("PARENT_ID","ROW","STATUS","STATUSMESSAGE","FMNO","PAYROLLCODE","PAYROLLCODESEQUENCE",
                "NAME","AMOUNT","PAYMENTNUMBER","PAYMENTID","PAYMENTFORM","USERFIELD1","USERFIELD2","REMARKS",
                "LOANADVANCEREFERENCENUMBER","PROJECTCODE","PROJECTTASK","GLACCOUNT","GLCOSTCENTER")
                .where({ PARENT_ID: batchID});

            // Get Mapping Data
            const le = await SELECT.one.from(LegalEntityGrouping).columns('LEGALENTITYGROUPCODE').where({ COMPANYCODE: stagingHeader.glCompanyCode});
            const mappingData = await SELECT.from(PaycodeGLMapping).where({ LEGALENTITYGROUPCODE: le.LEGALENTITYGROUPCODE});
            
            // Update Staging Data
            let updatedItems = stagingDataItems.map((item) => {
                let errorsForRow = [];
                const userObj = resultUsers.find((user)=>user.fmno == item.FMNO.padStart(8,'0'));
                if (!userObj) {
                    errorsForRow.push(`User ${item.FMNO} not found or invalid.`);
                }
                const mappedAccount = mappingData.find((mappingRow)=>
                    (mappingRow.payrollCode == item.PAYROLLCODE) 
                    && (mappingRow.payrollCodeSequence == (item.PAYROLLCODESEQUENCE || 1) ));
                
                if (!mappedAccount) {
                    errorsForRow.push(`Unable to find GL account for PayrollCode ${item.PAYROLLCODE} and Sequence ${item.PAYROLLCODESEQUENCE}.`);
                }
                
                if (errorsForRow.length) {
                    return {...item, STATUS: 'INVALID', STATUSMESSAGE: `${errorsForRow.join(',')}`}
                } else {
                    return {...item, STATUS: 'VALID', STATUSMESSAGE: '', GLCOSTCENTER: userObj.costCenter, GLACCOUNT: mappedAccount.glAccount}
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

            // Mark records approved
            const resultApproveHeader = await UPDATE(UploadHeader).set({ STATUS: 'APPROVED' }).where({ ID: batchToApprove });
            const resultApproveItems = await UPDATE(UploadItems).set({ STATUS: 'APPROVED' }).where({ PARENT_ID: batchToApprove, STATUS: 'VALID' });

            if (resultApproveHeader > 0 && resultApproveItems > 0) {
                // Get Data to Copy
                const dataHeader = await SELECT.one.from(UploadHeader).where({ ID: batchToApprove, STATUS: 'APPROVED'});
                const dataItems = await SELECT.from(UploadItems).where({ PARENT_ID: batchToApprove, STATUS: 'APPROVED'});
                const dataMapping = await SELECT.from(PaycodeGLMapping).where({ LEGALENTITYGROUPCODE: dataHeader.glCompanyCode});

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
                        controlAmount: dataItems.reduce((prev, curr)=> (parseFloat(prev) + parseFloat(curr.amount)).toFixed(2), 0),
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
                    const payloadItems = dataItems.map((item) =>({
                        batchID_batchID: batchToApprove,
                        batchLineNumber: lineCounter +=1,
                        postingBatchID: postingBatch,
                        postingBatchLineNumber: lineCounter,
                        fmno: item.fmno,
                        payrollCode: item.payrollCode,
                        payrollCodeSequence: item.payrollCodeSequence,
                        sourceAmount: item.amount,
                        paymentID: item.paymentID,
                        projectCode: item.projectCode,
                        glAccount: item.glAccount,
                        glPostCostCenter: item.glCostCenter,
                        postingAggregation: (()=>{
                            const mapObj = dataMapping.find((mapItem)=> (mapItem.payrollCode == item.payrollCode) && (mapItem.payrollCodeSequence == item.payrollCodeSequence));
                            if ((mapObj.payrollCodeSequence == 'ADVANCE') || mapObj.payrollCodeSequence == 'LOAN') { return false } else { return true }
                        })()
                    }));
                    const resultCopyItems = await INSERT.into(PayrollDetails).entries(payloadItems);

                    return;
                } else {
                    req.error({ code: 404, message: `Batch ID:${batchToApprove} does not exist` });
                }
            } else {
                req.error({ code: 400, message: `Unable to approve batch ID:${batchToApprove}.` });
            }
        });

        // required
        await super.init()
    }
};

module.exports = PayrollService;