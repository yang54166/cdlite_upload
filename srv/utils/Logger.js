const cds = require('@sap/cds');

class LoggerUtil {
    // Types supported are info, error, debug, trace, warn

    static log(id, type, message){
        const LOG = cds.log(id, type);
        
    }
}

module.exports = { LoggerUtil };