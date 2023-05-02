const logger = require("./Logger");

class FDMUtils {
    apiService;
    sapClient = '100';
    employeeData = [];
    glAccounts = [];
    companyCodes = [];
    wbsElements = [];
    exchangeRates = [];
    currencyCodes = [];

    constructor(remoteService) {
        this.apiService = remoteService;
        this.sapClient = process.env.SAP_CLIENT.toString();
        logger.log("fdm","info",`SAP_CLIENT=${this.sapClient}`);
    };

    async getEmployeeData(companyCode) {
        let result = await this.apiService.get("S4_FMNO_MASTER_HISTORY_API").where({ client: this.sapClient, branchId: companyCode });
        this.employeeData.push(...result);
        while (result.$nextLink) {
            result = await this.apiService.get(`/${result.$nextLink}`);
            this.employeeData.push(...result);
        }
        logger.log("fdm","info",`Found ${this.employeeData.length} FMNOs for client ${this.sapClient} and companyCode ${companyCode}`);
        return this.employeeData;
    };

    findEmployeeByFMNO(fmno, payrollDate) {
        const matchingEmployees = this.employeeData
            .filter((employee) => employee.fmno === fmno);
        if (matchingEmployees.length > 1) {
            return matchingEmployees.reduce((final, current) => {
                const currentStartDate = new Date(current.effectiveStartDate.substring(0, 4) + "-" + current.effectiveStartDate.substring(4, 6) + 
                    "-" + current.effectiveStartDate.substring(6, 8));
                const finalStartDate = final ? new Date(final.effectiveStartDate.substring(0, 4) + "-" + final.effectiveStartDate.substring(4, 6) + 
                    "-" + final.effectiveStartDate.substring(6, 8)) : null;
                if (currentStartDate < new Date(payrollDate)) {
                    if (!final || (currentStartDate > finalStartDate)) {
                        return current;
                    } else {
                        return final
                    }
                }
            }, null);
        } else {
            return matchingEmployees[0];
        }
    };

    async getGLAccounts() {
        let result = await this.apiService.get("GL_ACCT_API").where({ client: this.sapClient });
        this.glAccounts.push(...result);
        while (result.$nextLink) {
            result = await this.apiService.get(`/${result.$nextLink}`);
            this.glAccounts.push(...result);
        }
        logger.log("fdm","info",`Found ${this.glAccounts.length} gLAccounts for client ${this.sapClient}`);
        return this.glAccounts;
    };

    getGLAccount(glaccount) {
        return this.glAccounts.find((account) => account.glAccount == glaccount);
    };

    async getCompanyCodes() {
        let result = await this.apiService.get("COMPANY_CODE_API").where({ mandt: this.sapClient });
        this.companyCodes.push(...result);
        while (result.$nextLink) {
            result = await this.apiService.get(`/${result.$nextLink}`);
            this.companyCodes.push(...result);
        }
        logger.log("fdm","info",`Found ${this.companyCodes.length} companyCodes for client ${this.sapClient}`);
        return this.companyCodes;
    };

    getCompanyCode(companycode) {
        return this.companyCodes.find((company) => company.companyCode == companycode);
    };

    async getWbsElements(companyCode) {
        let result = await this.apiService.get("PROJECT_WBS_MASTER_API").where({ companyCode: companyCode, client: this.sapClient });
        this.wbsElements.push(...result);
        while (result.$nextLink) {
            result = await this.apiService.get(`/${result.$nextLink}`);
            this.wbsElements.push(...result);
        }
        logger.log("fdm","info",`Found ${this.wbsElements.length} wbsElements for companyCode ${companyCode} and client ${this.sapClient}`);
        return this.wbsElements;
    };

    getWbsElement(wbsElementCode) {
        return this.wbsElements.find((proj) => proj.posid == wbsElementCode);
    };

    async getExchangeRates(currencyCode, payrollDate) {
        const getRatePeriod = (payrollDate) => {
            const d = new Date(payrollDate);
            return `${d.getFullYear().toString()}${(d.getMonth() + 1).toString().padStart(2, 0)}`
        };
        let result = await this.apiService.get("MNTHLY_EXCHG_RATE_API").where({
            client: this.sapClient,
            and: {
                period: getRatePeriod(payrollDate),
                and: {
                    fromCurrency: currencyCode,
                    or: {
                        toCurrency: currencyCode
                    }
                }
            }
        });
        this.exchangeRates.push(...result);
        while (result.$nextLink) {
            result = await this.apiService.get(`/${result.$nextLink}`);
            this.exchangeRates.push(...result);
        }
        logger.log("fdm","info",`Found ${this.exchangeRates.length} exchangeRates for client ${this.sapClient}`);
        return this.exchangeRates;
    };

    getExchangeRate(sourceCurrency, targetCurrency) {
        if (sourceCurrency == targetCurrency) {
            return { exchangeRate: 1.00, period: this.exchangeRates[0].period }
        }
        else {
            return this.exchangeRates.find((rate) => ((rate.fromCurrency == sourceCurrency) && (rate.toCurrency == targetCurrency)));
        }
    };

    async getCurrency() {
        let result = await this.apiService.get("CURRENCY_API");
        this.currencyCodes.push(...result);
        while (result.$nextLink) {
            result = await this.apiService.get(`/${result.$nextLink}`);
            this.currencyCodes.push(...result);
        }
        logger.log("fdm","info",`Found ${this.currencyCodes.length} currencyCodes.`);
        return this.currencyCodes;
    };
};

module.exports = { FDMUtils };
