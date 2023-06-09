const { PassThrough } = require('node:stream');
const monthNames = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

const utils = {
    convertPeriodToDate: (period) => {
        const yyyy = parseInt(period.substr(0, 4));
        const mm = parseInt(period.substr(4, 2));
        return new Date(yyyy, mm, 0).toISOString().substring(0, 10);
    },

    convertExcelDateStringToDBDateString: (dateStr)=>{
        const dateObj = new Date(dateStr);
        if (dateObj.toString() !== "Invalid Date") { 
            return `${dateObj.getFullYear()}-${(dateObj.getMonth() + 1).toString().padStart(2,0)}-${dateObj.getDate().toString().padStart(2,0)}` 
        }
        else { return null }
    },

    convertDateToPayPeriod: (payrollDate) => {
        const yy = payrollDate.getUTCFullYear().toString().slice(-2);
        const monthName = monthNames[payrollDate.getUTCMonth()];
        const currentDayOfMonth = payrollDate.getUTCDate();
        const lastDayOfMonth = new Date(payrollDate.getUTCFullYear(), payrollDate.getUTCMonth() + 1, 0).getUTCDate();
        const cycleThisMonth = lastDayOfMonth / currentDayOfMonth <= 2 ? 2 : 1;
        const cc = ('0' + ((payrollDate.getUTCMonth() * 2) + cycleThisMonth)).slice(-2);
        return `${monthName}-${yy}-${cc}`;
    },

    convertAmountByExchangeRate: (amount, exchangeRate) => {
        return (amount * exchangeRate).toFixed(2);
    },

    isDecimal: (value, precision, scale) => {
        const regexDecimal = new RegExp(`^[+-]?[0-9]{1,${precision}}(?:\.[0-9]{1,${scale}})?$`);
        return regexDecimal.test(value);
    },

    CSVtoArray: (text) => {
        // var re_valid = /^\s*(?:'[^'\\]*(?:\\[\S\s][^'\\]*)*'|"[^"\\]*(?:\\[\S\s][^"\\]*)*"|[^,'"\s\\]*(?:\s+[^,'"\s\\]+)*)\s*(?:,\s*(?:'[^'\\]*(?:\\[\S\s][^'\\]*)*'|"[^"\\]*(?:\\[\S\s][^"\\]*)*"|[^,'"\s\\]*(?:\s+[^,'"\s\\]+)*)\s*)*$/;
        // var re_value = /(?!\s*$)\s*(?:'([^'\\]*(?:\\[\S\s][^'\\]*)*)'|"([^"\\]*(?:\\[\S\s][^"\\]*)*)"|([^,'"\s\\]*(?:\s+[^,'"\s\\]+)*))\s*(?:,|$)/g;
        // // Return NULL if input string is not well formed CSV string.
        // if (!re_valid.test(text)) return null;
        // var a = [];                     // Initialize array to receive values.
        // text.replace(re_value, // "Walk" the string using replace with callback.
        //     function (m0, m1, m2, m3) {
        //         // Remove backslash from \' in single quoted values.
        //         if (m1 !== undefined) a.push(m1.replace(/\\'/g, "'"));
        //         // Remove backslash from \" in double quoted values.
        //         else if (m2 !== undefined) a.push(m2.replace(/\\"/g, '"'));
        //         else if (m3 !== undefined) a.push(m3);
        //         return ''; // Return empty string.
        //     });
        // // Handle special case of empty last value.
        // if (/,\s*$/.test(text)) a.push('');
        //var a = text.split(",");
        var a = text.match(/(?:,|\n|^)("(?:(?:"")*[^"]*)*"|[^",\n]*|(?:\n|$))/g)
            .map((s)=>(s.replace(/(^,)/,"")));
        
        return a;
    },

    readUploadStream: async (binaryFile) => {
        let content = '';
        const stream = new PassThrough();
        binaryFile.pipe(stream, { end: false });

        return new Promise((resolve, reject) => {
            try {
                // Read stream
                binaryFile.on("data", dataChunk => {
                    content += dataChunk;
                    stream.resume();
                });
                // Output stream
                binaryFile.on("end", async () => {
                    resolve(content);
                });
            } catch (ex) {
                reject(ex);
            }
        });
    },

    parseCDUpload: (payload, batchID) => {
        const fileRows = payload.split("\r\n").filter((row) => row != '');
        let lineNum = 0;

        return fileRows.map((line) => {
            let arrCols = line.split('\t');
            return {
                PARENT_ID: batchID,
                ROW: lineNum += 1,
                FMNO: arrCols[0],
                PAYROLLCODE: arrCols[1],
                PAYROLLCODESEQUENCE: arrCols[2] || '1',
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
    },

    validateTransactionTypeShouldNetZero: (transactionType)=> {
        return ['01', '03', '04'].includes(transactionType)
    },

    validateEntities: (entityList, entityType) => {
        let result = { isValid: true, errorMessage: "" };
        let errorList = [];
        let rowNumber = 0;

        // Collect keys for check
        let keys = [];
        for (const prop in entityType.keys){
            const elem = entityType.elements[prop];
            if (elem.type != 'cds.Association') { keys.push(elem.name) }; 
        }
        let keysFound = [];

        entityList.forEach((row) => {
            rowNumber += 1;
            const keyString = keys.reduce((acc,value)=> acc + "-" + row[value.toUpperCase()], 'PK');
            if (keysFound.includes(keyString)) { 
                errorList.push(`Duplicate key ${keyString} on row ${rowNumber}`);
            } else { keysFound.push( keyString) };

            for (const [key, value] of Object.entries(row)) {
                if (value) {
                    const elemType = entityType.elements[Object.keys(entityType.elements).find((el) => el.toLowerCase() == key.toLowerCase())];
                    switch (elemType.type) {
                        case "cds.String":
                            if (value.length > elemType.length) {
                                errorList.push(`Row ${rowNumber}: Error on ${elemType.name}, value (${value}) longer than ${elemType.length}.`);
                            }
                            break;
                        case "cds.Integer":
                            if (!Number.isInteger(parseInt(value))) {
                                errorList.push(`Row ${rowNumber}: Error on ${elemType.name}, value (${value}) not an valid integer.`);
                            }
                            break;
                        case "cds.Decimal":
                            if (!utils.isDecimal(value, elemType.precision, elemType.scale)) {
                                errorList.push(`Row ${rowNumber}: Error on ${elemType.name}, value (${value}) not a valid decimal.`);
                            }
                            break;
                    }
                }
            }
        });

        if (errorList.length > 0) {
            result = { isValid: false, errorMessage: JSON.stringify(errorList) }
        }
        return result;
    },

    getMappingDBTable: (mappingTable) => {
        switch (mappingTable) {
            case "LegalEntityGrouping":
                return "MAPPING_LEGALENTITYGROUPING";
            case "PaycodeGLMapping":
                return "MAPPING_PAYCODEGLMAPPING";
            case "PayrollLedgerControl":
                return "MAPPING_PAYROLLLEDGERCONTROL";
            default:
                return null;
        }
    },

    parseMappingUpload: (payload, mappingTable) => {
        let fileRows = payload.split("\r\n").filter((row) => row != '');
        fileRows.shift(); // Remove header row
        let lineNum = 0;

        let mappedResult = [];
        switch (mappingTable) {
            case "MAPPING_LEGALENTITYGROUPING":
                return fileRows.map((line) => {
                    let arrCols = utils.CSVtoArray(line);
                    if (arrCols) {
                        return {
                            LEGALENTITYGROUPCODE: arrCols[0],
                            COMPANYCODE: arrCols[1]
                        };
                    }
                });
            case "MAPPING_PAYCODEGLMAPPING":
                return fileRows.map((line) => {
                    let arrCols = utils.CSVtoArray(line);
                    if (arrCols && (arrCols.length == 15)) {
                        return {
                            LEGALENTITYGROUPCODE: arrCols[0],
                            PAYROLLCODE: arrCols[1],
                            PAYROLLCODESEQUENCE: arrCols[2],
                            DEFAULTDEPARTMENT: arrCols[3],
                            DESCRIPTION: arrCols[4],
                            EFFECTIVEDATE: utils.convertExcelDateStringToDBDateString(arrCols[5]),
                            ENDDATE:  utils.convertExcelDateStringToDBDateString(arrCols[6]),
                            GLACCOUNT: arrCols[7] || null,
                            GLACCOUNTCB: arrCols[8] || null,
                            PAYROLLCODECLASS: arrCols[9],
                            PAYROLLCODETYPE: arrCols[10],
                            QUALIFIEDCOMPENSATION: arrCols[11],
                            TRANSACTIONDESCRIPTION: arrCols[12],
                            USPSRPCATEGORY: arrCols[13],
                            VENDORREFERENCE: arrCols[14]
                        };
                    } else {
                        throw({message: `Unable to parse file. Check for empty rows or invalid number of columns. LINE: ${line}`});
                    }
                });
            case "MAPPING_PAYROLLLEDGERCONTROL":
                return fileRows.map((line) => {
                    let arrCols = utils.CSVtoArray(line);
                    if (arrCols) {
                        return {
                            TRANSACTIONTYPE: arrCols[0],
                            DOCTYPE: arrCols[1],
                            LEDGERGROUP: arrCols[2],
                            LEDGERGROUPCB: arrCols[3],
                            DOCHEADERTEXT: arrCols[4]
                        };
                    }
                });
        }
        return mappedResult;
    }
};

module.exports = utils;