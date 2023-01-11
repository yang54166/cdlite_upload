
@cds.persistence.exists 
@cds.persistence.calcview 
Entity CV_JOURNALENTRY {
key     BATCHID: Integer  @title: 'BATCHID: BATCHID' ; 
        COMPANYCODE: String(4)  @title: 'COMPANYCODE: COMPANYCODE' ; 
        PAYROLLDATE: Date  @title: 'PAYROLLDATE: PAYROLLDATE' ; 
        POSTINGBATCHID: Integer  @title: 'POSTINGBATCHID: POSTINGBATCHID' ; 
        POSTINGSTATUS: String(5000)  @title: 'POSTINGSTATUS: POSTINGSTATUS' ; 
        POSTINGSTATUSMESSAGE: String(5000)  @title: 'POSTINGSTATUSMESSAGE: POSTINGSTATUSMESSAGE' ; 
        POSTINGDOCUMENT: String(5000)  @title: 'POSTINGDOCUMENT: POSTINGDOCUMENT' ; 
        AccountingDocumentType: String(5)  @title: 'AccountingDocumentType: AccountingDocumentType' ; 
        DocumentReferenceID: String(16)  @title: 'DocumentReferenceID: DocumentReferenceID' ; 
        DocumentHeaderText: String(25)  @title: 'DocumentHeaderText: DocumentHeaderText' ; 
        PostingDate: Date  @title: 'PostingDate: PostingDate' ; 
        DocumentDate: Date  @title: 'DocumentDate: DocumentDate' ; 
        Reference1InDocumentHeader: String(20)  @title: 'Reference1InDocumentHeader: Reference1InDocumentHeader' ; 
        Reference2InDocumentHeader: String(20)  @title: 'Reference2InDocumentHeader: Reference2InDocumentHeader' ; 
};

@cds.persistence.exists 
@cds.persistence.calcview 
Entity CV_JOURNALENTRY_ITEM {
key     BATCHID: Integer  @title: 'BATCHID: BATCHID' ;
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
        FUNCTIONALAREA: String(16)  @title: 'FUNCTIONALAREA: FUNCTIONALAREA' ; 
}