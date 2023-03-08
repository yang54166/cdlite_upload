const dbClass = require("sap-hdbext-promisfied");
const hdbext = require("@sap/hdbext");

class HANAUtils {
  static async callStoredProc(db, schemaName, procName, inputParams) {
    try {
      let dbConn = new dbClass(
        await dbClass.createConnection(db)
      );
      const sp = await dbConn.loadProcedurePromisified(
        hdbext,
        schemaName,
        procName
      );
      const output = await dbConn.callProcedurePromisified(sp, inputParams);
      return output;
    } catch (ex) {
      throw ex;
    }
  }

  static async execQuery(db, query) {
    try {
      let dbConn = new dbClass(
        await dbClass.createConnection(db)
      );
      const statement = await dbConn.preparePromisified(query);
      const results = await dbConn.statementExecPromisified(statement, []);
      return results;
    } catch (ex) {
      throw ex;
    }
  }

  static async getNextBatchId(db,) {
    return new Promise((resolve, reject) => {
      let nextNumber = 0;

      db.run(`SELECT "BATCHID".NEXTVAL FROM DUMMY`)
        .then(result => {
          nextNumber = result[0][`BATCHID.NEXTVAL`];
          resolve(nextNumber);
        })
        .catch(error => {
          reject(error);
        });

    });
  };
}

module.exports = { HANAUtils };
