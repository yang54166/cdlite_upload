const xssec = require("@sap/xssec");
const xsenv = require("@sap/xsenv");
const util = require("util");
const createSecurityContext = util.promisify(xssec.createSecurityContext);
const axios = require("axios");
const logger = require("Logger");

class SecurityUtils {
  static async getOauthTokenClientCredentials(tokenUrl, clientId, clientSecret){
    const formData = new URLSearchParams();
    formData.append("grant_type", "client_credentials");

    const tokenResponse = await axios.request({
      method: "post",
      url: `${tokenUrl}`,
      auth: {
        username: clientId,
        password: clientSecret,
      },
      data: formData,
    });
    return tokenResponse.data.access_token;
  };

  static async checkScope(requiredScope, req) {
    try {
      var token = req.headers.authorization.replace("Bearer ", "");
      var config = xsenv.getServices({ xsuaa: { tag: "xsuaa" } }).xsuaa;
      const xsappname = config.xsappname;

      const securityContext = await createSecurityContext(token, config);
      const jwtScopes = securityContext.getTokenInfo().getPayload().scope;
      logger.log("sec","debug","Scopes:" + jwtScopes);

      const hasScope = securityContext.checkScope(
        `${xsappname}.${requiredScope}`
      );
      logger.log("sec","debug",`hasScope ${xsappname}.${requiredScope} == ${hasScope}`);

      return hasScope;
    } catch (ex) {
      logger.log("sec","error", ex);
      return false;
    }
  }
}

module.exports = { SecurityUtils };
