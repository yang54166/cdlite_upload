using {staging} from '../db/staging';
using {payroll} from '../db/payroll';
using {mapping} from '../db/mapping';
using {
    CV_JOURNALENTRY,
    CV_JOURNALENTRY_ITEM
} from '../db/virtual';
using {fdm_masterdata} from './external/fdm_masterdata';

service PayrollService  @(requires: 'authenticated-user') {
    // For Upload Only, not persisted to db as binary
    @cds.persistence.skip
    @odata.singleton
    entity PayrollUploadFile {
        @Core.MediaType : mediaType content : LargeBinary;
        @Core.IsMediaType: true mediaType: String;
    };

    @cds.persistence.skip
    @odata.singleton
    entity MappingUploadFile {
        @Core.MediaType : mediaType content : LargeBinary;
        @Core.IsMediaType: true mediaType: String;
    };

    // Staging
    entity StagingUploads      as projection on staging.UploadHeader actions {
        action approve();
        action enrich();
    };
    entity StagingUploadItems  as projection on staging.UploadItems;

    // Payroll (Persistent)
    entity PayrollHeader       as projection on payroll.PayrollHeader;
    entity PayrollDetails      as projection on payroll.PayrollDetails;
    entity PostingBatch        as projection on payroll.PostingBatch;

    // Mapping
    entity LegalEntityGrouping as projection on mapping.LegalEntityGrouping;
    entity PaycodeGLMapping    as projection on mapping.PaycodeGLMapping;
    entity TransactionTypes as projection on mapping.PayrollLedgerControl;

    // JournalEntries for Posting
    @readonly
    entity JournalEntry        as projection on CV_JOURNALENTRY;
    @readonly
    entity JournalEntryItem    as projection on CV_JOURNALENTRY_ITEM;

    @readonly entity CompanyCodes as projection on fdm_masterdata.COMPANY_CODE_API;
    @readonly entity Currency as projection on fdm_masterdata.CURRENCY_API;
}
