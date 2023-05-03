const cds = require('@sap/cds');

class Logger {
    // Types supported are info, error, debug, trace, warn

    static log(id, type, message){
        const LOG = cds.log(id);
        switch (type){
            case "debug":
                LOG.debug(message);
                break;
            case "error": 
                LOG.error(message);
                break;
            case "warn": 
                LOG.warn(message);
                break;
            case "trace":
                LOG.trace(message);
                break;
            default: 
                LOG.info(message);
                break;
        }
    }
}

module.exports = Logger;