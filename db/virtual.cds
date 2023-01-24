
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
        DOCUMENTHEADERTEXT: String(25)  @title: 'DocumentHeaderText: DocumentHeaderText' ; 
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