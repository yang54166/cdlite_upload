using {staging} from '../db/staging';
using {payroll} from '../db/payroll';
using {mapping} from '../db/mapping';
using {
    CV_JOURNALENTRY,
    CV_JOURNALENTRY_ITEM,
    CV_JOURNALENTRY_CB,
    CV_JOURNALENTRY_ITEM_CB,
    CV_AMOUNTSUMMARY,
    CV_APPROVALSUMMARY,
    CV_PARTNER_COMP_DATA
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
        action trigger();
    };
    entity StagingUploadItems  as projection on staging.UploadItems;

    // Payroll (Persistent)
    entity PayrollHeader       as projection on payroll.PayrollHeader;
    entity PayrollDetails      as projection on payroll.PayrollDetails;
    entity PostingBatch        as projection on payroll.PostingBatch
        excluding {postingType};

    // Mapping
    entity LegalEntityGrouping as projection on mapping.LegalEntityGrouping ;
    entity PaycodeGLMapping    as projection on mapping.PaycodeGLMapping;
    entity TransactionTypes as projection on mapping.PayrollLedgerControl;
    action deleteAllMapping(mappingTable: String);

    // JournalEntries for Posting
    @readonly entity JournalEntry        as projection on CV_JOURNALENTRY;
    @readonly entity JournalEntryItem    as projection on CV_JOURNALENTRY_ITEM;
    @readonly entity JournalEntryCB        as projection on CV_JOURNALENTRY_CB;
    @readonly entity JournalEntryItemCB    as projection on CV_JOURNALENTRY_ITEM_CB;
    @readonly entity ApprovalSummary as projection on CV_APPROVALSUMMARY;
    @readonly entity AmountSummary as projection on CV_AMOUNTSUMMARY;
    @readonly entity PartnerCompData(IP_PERIOD : String(13)) as select from CV_PARTNER_COMP_DATA(
        IP_PERIOD : : IP_PERIOD
    ) {*};

    // Masterdata from FDM & Value Helps
    @readonly entity CompanyCodes as projection on fdm_masterdata.COMPANY_CODE_API;
    @readonly entity Currency as projection on fdm_masterdata.CURRENCY_API;
    @readonly entity LegalEntityGroups as SELECT DISTINCT(legalEntityGroupCode) from mapping.LegalEntityGrouping order by legalEntityGroupCode;
    @readonly entity PayrollCodes as SELECT DISTINCT(payrollCode) from mapping.PaycodeGLMapping order by payrollCode;
    @readonly entity PayrollCodeSequences as SELECT DISTINCT(payrollCodeSequence) from mapping.PaycodeGLMapping order by payrollCodeSequence;
}
