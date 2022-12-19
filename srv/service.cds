using { payroll.staging as staging } from '../db/payrollstaging';
using { payroll } from '../db/payroll';
using { mapping } from '../db/mapping';

service PayrollService {
    entity StagingUploads as projection on staging.UploadHeader;
    entity StagingUploadItems as projection on staging.UploadItems;

    entity PayrollHeader as projection on payroll.PayrollHeader;
    entity PayrollDetails as projection on payroll.PayrollDetails;

    entity LegalEntityGrouping as projection on mapping.LegalEntityGrouping; 
    entity PaycodeGLMapping as projection on mapping.PaycodeGLMapping;
}