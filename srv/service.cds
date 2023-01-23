using { payroll.staging as staging } from '../db/payrollstaging';
using { payroll } from '../db/payroll';
using { mapping } from '../db/mapping';
using { CV_JOURNALENTRY, CV_JOURNALENTRY_ITEM } from '../db/virtual';

service PayrollService {
    entity StagingUploads as projection on staging.UploadHeader 
        actions{
            action approve();
        };
    entity StagingUploadItems as projection on staging.UploadItems;

    entity PayrollHeader as projection on payroll.PayrollHeader;
    entity PayrollDetails as projection on payroll.PayrollDetails;

    entity LegalEntityGrouping as projection on mapping.LegalEntityGrouping; 
    entity PaycodeGLMapping as projection on mapping.PaycodeGLMapping;

   @readonly
   entity JournalEntry as projection on CV_JOURNALENTRY;
   @readonly
   entity JournalEntryItem as projection on CV_JOURNALENTRY_ITEM;
    
}