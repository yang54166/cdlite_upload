using { payroll.db as db } from '../db/schema';

service PayrollService {
    entity PayrollUpload as projection on db.PayrollUpload;
    entity PayrollUploadItems as projection on db.PayrollUploadItems;
}