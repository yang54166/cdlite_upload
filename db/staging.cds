using { managed } from '@sap/cds/common';

namespace staging;

entity UploadHeader: managed {
    key ID: Integer;
    status: String;
    statusMessage: String;
    deleted: Boolean;
    glCompanyCode: String(4);
    transactionType: String(2); //01 Regular, 02 Taxes, 03 Adjustments
    currencyCode : String(3);
    payrollDate: Date;
    glPeriod: String(6);  //YYYYMM
    effectivePeriod: String(6); //YYYYMM
    batchNumber: Integer;
    batchDescription: String;
    fileName: String;
    remarks: String;
    items: Composition of many UploadItems on items.parent = $self;
};

entity UploadItems: managed {
    key parent: Association to UploadHeader;
    key row: Integer not null;
    status: String;
    statusMessage: String;
    deleted: Boolean;
    fmno: String(6);
    payrollCode: String(6);
    payrollCodeSequence: Integer;
    name: String;
    amount: Decimal(15,2);
    paymentNumber: Integer;
    paymentId: String(10);
    paymentForm: String(10);
    userField1: String(15); // needed?
    userField2: String(15); // needed?
    remarks: String(30);    //needed?
    loanAdvanceReferenceNumber: String(20);
    projectCode: String(8);
    projectTask: String(2);
    glAccount: Integer;     // 8
    glCurrencyCode: String(3);
    glCostCenter: String(8);
    fcat: String(3);
    pernr: String(8);
    locationCode: String(4);
    skillCode: String(4);
};