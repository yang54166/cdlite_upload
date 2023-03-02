
@cds.persistence.exists 
@cds.persistence.calcview 
Entity CV_JOURNALENTRY {
key     BATCHID: Integer  @title: 'BATCHID: BATCHID' ; 
key     POSTINGBATCHID: Integer  @title: 'POSTINGBATCHID: POSTINGBATCHID' ; 
        POSTINGSTATUS: String(5000)  @title: 'POSTINGSTATUS: POSTINGSTATUS' ; 
        POSTINGSTATUSMESSAGE: String(5000)  @title: 'POSTINGSTATUSMESSAGE: POSTINGSTATUSMESSAGE' ; 
        POSTINGDOCUMENT: String(5000)  @title: 'POSTINGDOCUMENT: POSTINGDOCUMENT' ; 
        COMPANYCODE: String(4)  @title: 'COMPANYCODE: COMPANYCODE' ; 
        PAYROLLDATE: Date  @title: 'PAYROLLDATE: PAYROLLDATE' ; 
        ACCOUNTINGDOCUMENTTYPE: String(5)  @title: 'AccountingDocumentType: AccountingDocumentType' ; 
        DOCUMENTREFERENCEID: String(16)  @title: 'DocumentReferenceID: DocumentReferenceID' ; 
        DOCUMENTHEADERTEXT: String(4)  @title: 'DocumentHeaderText: DocumentHeaderText' ; 
        LEDGERGROUP: String(4)  @title: 'LedgerGroup: LedgerGroup' ; 
        POSTINGDATE: Date  @title: 'PostingDate: PostingDate' ; 
        DOCUMENTDATE: Date  @title: 'DocumentDate: DocumentDate' ; 
        REFERENCE1INDOCUMENTHEADER: String(20)  @title: 'Reference1InDocumentHeader: Reference1InDocumentHeader' ; 
        REFERENCE2INDOCUMENTHEADER: String(20)  @title: 'Reference2InDocumentHeader: Reference2InDocumentHeader' ; 
        items: Association to many CV_JOURNALENTRY_ITEM on items.BATCHID = BATCHID and items.POSTINGBATCHID = POSTINGBATCHID;
};

@cds.persistence.exists 
@cds.persistence.calcview 
Entity CV_JOURNALENTRY_ITEM {
key     BATCHID:  Integer  @title: 'BATCHID: BATCHID' ; 
key     POSTINGBATCHID: Integer  @title: 'POSTINGBATCHID: POSTINGBATCHID' ; 
key     REFERENCEDOCUMENTITEM: Integer  @title: 'REFERENCEDOCUMENTITEM: REFERENCEDOCUMENTITEM' ; 
        GLACCOUNT: Integer  @title: 'GLACCOUNT: GLACCOUNT' ; 
        AMOUNTINTRANSACTIONCURRENCY: Decimal(15)  @title: 'AMOUNTINTRANSACTIONCURRENCY: AMOUNTINTRANSACTIONCURRENCY' ; 
        GLPOSTCOSTCENTER: String(8)  @title: 'GLPOSTCOSTCENTER: GLPOSTCOSTCENTER' ; 
        AMOUNTINTRANSACTIONCURRENCYCURRENCYCODE: String(4)  @title: 'AMOUNTINTRANSACTIONCURRENCYCURRENCYCODE: AMOUNTINTRANSACTIONCURRENCYCURRENCYCODE' ; 
        WBSELEMENT: String(8)  @title: 'WBSELEMENT: WBSELEMENT' ; 
        DEBITCREDITCODE: String(1)  @title: 'DEBITCREDITCODE: DEBITCREDITCODE' ; 
        DOCUMENTITEMTEXT: String(50)  @title: 'DOCUMENTITEMTEXT: DOCUMENTITEMTEXT' ; 
        ASSIGNMENTREFERENCE: String(18)  @title: 'ASSIGNMENTREFERENCE: ASSIGNMENTREFERENCE' ; 
        ADDITIONALATTRIBUTES_PERSONNELNUMBER: String(8) @title: 'ADDITIONALATTRIBUTES_PERSONNELNUMBER: ADDITIONALATTRIBUTES_PERSONNELNUMBER' ; 
        FUNCTIONALAREA: String(16)  @title: 'FUNCTIONALAREA: FUNCTIONALAREA' ; 
}

@cds.persistence.exists 
@cds.persistence.calcview 
Entity CV_AMOUNTSUMMARY {
key     BATCH_ID: Integer  @title: 'BATCH_ID: BATCH_ID' ; 
key     GLCOMPANYCODE: String(4)  @title: 'GLCOMPANYCODE: GLCOMPANYCODE' ; 
key     CURRENCYCODE: String(3)  @title: 'CURRENCYCODE: CURRENCYCODE' ; 
key     TRANSACTIONTYPE: String(2)  @title: 'TRANSACTIONTYPE: TRANSACTIONTYPE' ; 
key     GLPERIOD: String(6)  @title: 'GLPERIOD: GLPERIOD' ; 
key     EFFECTIVEPERIOD: String(6)  @title: 'EFFECTIVEPERIOD: EFFECTIVEPERIOD' ; 
key     PAYROLLDATE: Date  @title: 'PAYROLLDATE: PAYROLLDATE' ; 
key     PAYROLLCODE: String(6)  @title: 'PAYROLLCODE: PAYROLLCODE' ; 
key     PAYROLLCODESEQUENCE: Integer  @title: 'PAYROLLCODESEQUENCE: PAYROLLCODESEQUENCE' ; 
key     PAYROLLCODE_DESCRIPTION: String(5000)  @title: 'PAYROLLCODE_DESCRIPTION: PAYROLLCODE_DESCRIPTION' ; 
key     GLCOSTCENTER: String(8)  @title: 'GLCOSTCENTER: GLCOSTCENTER' ; 
key     GLACCOUNT: Integer  @title: 'GLACCOUNT: GLACCOUNT' ; 
        AMOUNT: Decimal(15)  @title: 'AMOUNT: AMOUNT' ; 
}

@cds.persistence.exists 
@cds.persistence.calcview 
Entity CV_APPROVALSUMMARY {
key     BATCH_ID: Integer  @title: 'BATCH_ID: PARENT_ID' ; 
        STATUS: String(5000)  @title: 'STATUS: STATUS' ; 
        LINES_COUNT: Integer64  @title: 'LINES_COUNT: LINES_COUNT' ; 
        FMNO_COUNT: Integer64  @title: 'FMNO_COUNT: FMNO_COUNT' ; 
}