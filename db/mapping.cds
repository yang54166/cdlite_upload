using { cuid, managed } from '@sap/cds/common';

namespace mapping;

entity LegalEntityGrouping {
   key legalEntityGroupCode: String(4);
   key companyCode: String(4);
}

entity PaycodeGLMapping: managed {
    key legalEntityGroupCode: String(4);
    key payrollCode: String(10);
    key payrollCodeSequence: Integer default 1;
    defaultDepartment: String(5);
    description: String;
    effectiveDate: Date;
    endDate: Date;
    glAccount: Integer;
    payrollCodeClass: String(10);
    payrollCodeType: String(10);
    qualifiedCompensation: String(1);
    transactionDescription: String(240);
    usPsrpCategory: String(10);
}

entity PayrollLedgerControl: managed {
    key transactionType: String(02);
        docType: String(10);
        ledgerGroup: String(4);
        docHeaderText: String(25);
}