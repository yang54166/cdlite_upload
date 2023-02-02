const utils = {
    convertPeriodToDate : (period)=>{
        const yyyy = parseInt(period.substr(0,4));
        const mm = parseInt(period.substr(4,2));
        return new Date(yyyy,mm,0).toISOString().substring(0,10);
    },

    convertDateToPayPeriod : (payrollDate)=>{
        const yy = payrollDate.getUTCFullYear().toString().slice(-2);
        const mmm = ('00' + (payrollDate.getUTCMonth() + 1)).slice(-3);
        const currentDayOfMonth = payrollDate.getUTCDate();
        const lastDayOfMonth = new Date(payrollDate.getUTCFullYear(),payrollDate.getUTCMonth() + 1, 0).getUTCDate();
        const cycleThisMonth = lastDayOfMonth / currentDayOfMonth <= 2 ? 2 : 1;
        const cc = ('0' + ((payrollDate.getUTCMonth() * 2) + cycleThisMonth)).slice(-2);
        return `${mmm}-${yy}-${cc}`;
    },

    parseUploadPayload: (payload)=>{
        
    }
};

module.exports = utils;