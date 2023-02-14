
class FDMUtils {
    apiService;
    sapClient='100';
    userData=[];
    glAccounts=[];
    companyCodes=[];
    wbsElements=[];
    exchangeRates=[];

    constructor(remoteService){
        this.apiService = remoteService;
        this.sapClient = remoteService.options.credentials.queries["sap-client"];
    };

    async getUserData(companyCode) {
        let result = await this.apiService.get("S4_FMNO_MASTER_API").where({ client: this.sapClient, branchId: companyCode});
        this.userData.push(...result);
        while (result.$nextLink) {
            result = await this.apiService.get(`/${result.$nextLink}`);
            this.userData.push(...result);
        }
        console.log(`Found ${this.userData.length} FMNOs for companyCode ${companyCode} and client ${this.sapClient}`);
        return this.userData;
    };

    findUserByFMNO(fmno) {
        const matchingUser = this.userData.find((user) => user.fmno === fmno);
        return matchingUser;
    };

    async getGLAccounts() {
        let result = await this.apiService.get("GL_ACCT_API").where({ client: this.sapClient });
        this.glAccounts.push(...result);
        while (result.$nextLink) {
            result = await this.apiService.get(`/${result.$nextLink}`);
            this.glAccounts.push(...result);
        }
        console.log(`Found ${this.glAccounts.length} gLAccounts for client ${this.sapClient}`);
        return this.glAccounts;
    };

    async getCompanyCodes() {
        let result = await this.apiService.get("COMPANY_CODE_API");//.where({ mandt: this.sapClient });
        this.companyCodes.push(...result);
        while (result.$nextLink) {
            result = await this.apiService.get(`/${result.$nextLink}`);
            this.companyCodes.push(...result);
        }
        console.log(`Found ${this.companyCodes.length} companyCodes.`);
        return this.companyCodes;
    };

    async getWbsElements(companyCode) {
        let result = await this.apiService.get("PROJECT_API").where({ companyCode: companyCode });
        this.wbsElements.push(...result);
        while (result.$nextLink) {
            result = await this.apiService.get(`/${result.$nextLink}`);
            this.wbsElements.push(...result);
        }
        console.log(`Found ${this.wbsElements.length} wbsElements for companyCode ${companyCode}.`);
        return this.wbsElements;
    };

    async getExchangeRates() {
        let result = await this.apiService.get("MNTHLY_EXCHG_RATE_API");//.where({ mandt: this.sapClient });
        this.exchangeRates.push(...result);
        while (result.$nextLink) {
            result = await this.apiService.get(`/${result.$nextLink}`);
            this.exchangeRates.push(...result);
        }
        console.log(`Found ${this.exchangeRates.length} exchangeRates.`);
        return this.exchangeRates;
    };
};

module.exports = { FDMUtils };