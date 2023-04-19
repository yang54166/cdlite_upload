const cds = require('@sap/cds');

class Logger {
    // Types supported are info, error, debug, trace, warn

    static log(id, type, message){
        const LOG = cds.log(id, type);
        LOG.log(message);
    }
}

module.exports = Logger;