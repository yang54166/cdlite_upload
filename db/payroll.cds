using { cuid, managed } from '@sap/cds/common';

namespace payroll;

entity PayrollHeader: managed {
    key batchId: Integer;
    batchDescription: String;
    batchStatus: String;
    approvedAt: Timestamp;
    approvedBy: String;
    cdTransactionType: String(2);
    controlAmount: Integer;
    controlCount: Integer;
    effectiveDate: Date;
    glDate: Date;
    payrollDate: Date;
    payrollPeriod: String;      //MMM-YY-CC cycle is 01-24 per year
    sourceSystem: String(10);   //Payroll/AP/AR
    companyCode: String(4);
    details: Composition of many PayrollDetails on details.batchId = $self;
};

entity PayrollDetails: managed {
    key batchId: Association to PayrollHeader;
    key batchLineNumber: Integer;
    postingAggregation: String;
    postingBatchId: String;
    postingBatchLineNumber: Integer;
    postingBatchIdCBLedger: String;
    postingDocument: String;
    advanceNumber: String(20);
    apArId: String(20);      //future?
    cashAmount: Decimal(15,2);
    chargeAmount: Decimal(15,2);
    chargeCompany: String;
    chargeConversionDate: Date;
    chargeConversionRate:  Decimal(9,5);
    chargeConversionType: String(20);
    chargeCostCenter: String(8);
    chargeCurrencyCode: String(3);
    chargeDepartment: String(5);
    chargeGOC: String(3);
    fcat: String(3);
    fmno: String(9);
    glAccount: Integer;
    glAccountCBLedger: Integer;
    glCurrencyCode: String(4);
    glConversionRate: Decimal(9,5);
    glPostAmount: Decimal(15,2);
    glPostCompany: String(4);
    glPostCostCenter: String(8);
    glPostDepartment: String(5);
    glPostGOC: String(3);
    legalEntityGroupCode: String(4);
    loanNumber: String(20);
    locationCode: String(4);
    paymentId: String(10);
    payrollCode: String(10);
    payrollCodeSequence: Integer;
    payrollCodeClass: String(10);
    payrollCodeType: String(10);
    pernr: String(8);
    projectCode: String(8);
    qualifiedCompensation: String(1);
    shadowProcess: String(1);
    skillCode: String (4);
    sourceAmount: Decimal(15,2);
    sourceCompany: String(4);
    sourceCurrencyCode: String(4);
    usdAmount: Decimal(15,2);
    usdConversionRate:  Decimal(9,5);
    usdConversionType: String(20);
    usPsrpReportingCode: String(10);
    vendorReference: String(10);
};

entity PostingBatch : managed {
    key batchId: Integer;
    key postingBatchId: String;
        postingStatus: String;
        postingStatusMessage: String;
        postingDocument: String;
        postingType: String;
};
