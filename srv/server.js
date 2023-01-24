const cds = require("@sap/cds");
const fileUpload = require("express-fileupload");
const { data } = require("hdb/lib/protocol");
const xsenv = require("@sap/xsenv");
const hdb = xsenv.getServices({ hana: { tag: "hana" } }).hana;
const { HANAUtils } = require('./utils/HANAUtils');

cds.on('bootstrap', app => {
    app.use(fileUpload());

    app.post("/upload/:id", async (req, res) => {
        try {
            if (!req.files) {
                return res.status(400).send("No files were uploaded.");
            }
            const batchId = req.params.id;
            let dataToImport = [];

            // Parse Upload File
            const uploadFileObj = req.files.content;
            const fileName = uploadFileObj.name;
            const fileData = uploadFileObj.data;
            const sLines = fileData.toString().split('\r\n');
            dataToImport = sLines.map((line) => {
                arrCols = line.split('\t');
                return {
                    PARENT_ID: batchId,
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
            console.log(dataToImport);
            const result = await HANAUtils.callStoredProc(
                hdb,
                hdb.schema,
                "SP_UPLOADINSERT",
                dataToImport
            );
            return res.send({ status: "success" });

        } catch (err) {
            console.log(err);
        }
    });
});