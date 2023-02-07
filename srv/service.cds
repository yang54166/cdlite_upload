using {staging} from '../db/staging';
using {payroll} from '../db/payroll';
using {mapping} from '../db/mapping';
using {
    CV_JOURNALENTRY,
    CV_JOURNALENTRY_ITEM
} from '../db/virtual';
using {fdm_masterdata} from './external/fdm_masterdata';

service PayrollService {
    @cds.persistence.skip
    @odata.singleton
    entity PayrollUploadFile {
        @Core.MediaType : mediaType content : LargeBinary;
        @Core.IsMediaType: true mediaType: String;
    };

    entity StagingUploads      as projection on staging.UploadHeader actions {
        action approve();
        action enrich();
    };

    entity StagingUploadItems  as projection on staging.UploadItems;
    entity PayrollHeader       as projection on payroll.PayrollHeader;
    entity PayrollDetails      as projection on payroll.PayrollDetails;
    entity PostingBatch        as projection on payroll.PostingBatch;
    entity LegalEntityGrouping as projection on mapping.LegalEntityGrouping;
    entity PaycodeGLMapping    as projection on mapping.PaycodeGLMapping;

    @readonly
    entity JournalEntry        as projection on CV_JOURNALENTRY;

    @readonly
    entity JournalEntryItem    as projection on CV_JOURNALENTRY_ITEM;


}
