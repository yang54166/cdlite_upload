using { cuid, Currency } from '@sap/cds/common';

namespace payroll.db;

entity PayrollUpload: cuid {
    payrollCurrencyCode : Currency;
    payrollDate: Date;
    glPeriod: String;
    effectivePeriod: String;
    batchNumber: Integer;
    batchDescription: String;
    remarks: String;
    postingFileType: String(2); //01 Regular, 02 Taxes, 03 Adjustments
    items: Composition of many PayrollUploadItems on items.parent = $self;
};

entity PayrollUploadItems {
    parent: Association to PayrollUpload;
    fmno: String(6);
    payrollCode: String(6);
    payrollCodeSequence: Integer;
    name: String;
    amount: Decimal(12,2);
    paymentNumber: Integer;
    paymentID: String(10);
    paymentForm: String(10);
    userField1: String(15);
    userField2: String(15);
    remarks: String(30);
    loadAdvanceNumber: String(30);
    projectCode: String(8);
    projectTask: String(2);
};