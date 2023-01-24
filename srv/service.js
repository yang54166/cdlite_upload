const cds = require('@sap/cds');
const utils = require('./utils');
const { HANAUtils } = require('./utils/HANAUtils');


class PayrollService extends cds.ApplicationService {
    async init() {
        const db = await cds.connect.to('db')
        const fdm = await cds.connect.to('fdm_masterdata');

        const { PayrollHeader, PayrollDetails } = db.entities('payroll');
        const { UploadHeader, UploadItems } = db.entities('payroll.staging');
        const { PaycodeGLMapping } = db.entities('mapping');
        const { FMNO_MASTER_PAS } = fdm.entities;

        this.before("CREATE", "StagingUploads", async (context) => {
            const batchId = await HANAUtils.getNextBatchId(db);
            context.data.ID = batchId;
        });

        this.on('PUT', "PayrollUpload", async (req, next) => {
            console.log("upload started");
            if (req.data.file) {
                var entity = req.headers.slug;
                const stream = new PassThrough();
                var buffers = [];
                req.data.file.pipe(stream);
                await new Promise((resolve, reject) => {
                    stream.on('data', dataChunk => {
                        buffers.push(dataChunk);
                    });
                    stream.on('end', async () => {
                        var buffer = Buffer.concat(buffers);
                        // var workbook = XLSX.read(buffer, { type: "buffer", cellText: true, cellDates: true, dateNF: 'dd"."mm"."yyyy', cellNF: true, rawNumbers: false });
                        // let data = []
                        // const sheets = workbook.SheetNames
                        // for (let i = 0; i < sheets.length; i++) {
                        //     const temp = XLSX.utils.sheet_to_json(
                        //         workbook.Sheets[workbook.SheetNames[i]], { cellText: true, cellDates: true, dateNF: 'dd"."mm"."yyyy', rawNumbers: false })
                        //     temp.forEach((res, index) => {
                        //         if (index === 0) return;
                        //         data.push(JSON.parse(JSON.stringify(res)))
                        //     })
                        // }
                        if (data) {
                            const responseCall = await CallEntity(entity, data);
                            if (responseCall == -1)
                                reject(req.error(400, JSON.stringify(data)));
                            else {
                                resolve(req.notify({
                                    message: 'Upload Successful',
                                    status: 200
                                }));
                            }
                        }
                    });
                });
            } else {
                return next();
            }
        });

        this.on('enrich', async req =>{
            const [batchID] = req.params;
            const result = await fdm.get(`/FMNO_MASTER_PAS(IP_PERIOD='202301')/Set`);
               
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
                        postingBatchID: batchToApprove,
                        postingBatchLineNumner: lineCounter,
                        fmno: item.fmno,
                        payrollCode: item.payrollCode,
                        payrollCodeSequence: item.payrollCodeSequence,
                        sourceAmount: item.amount,
                        paymentID: item.paymentID,
                        projectCode: item.projectCode,
                        glAccount: item.glAccount,
                        glPostCostCenter: item.glCostCenter,
                        postingAggregation: dataMapping.find((mapItem)=> mapItem.payrollCode = item.payrollCode).aggregation
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