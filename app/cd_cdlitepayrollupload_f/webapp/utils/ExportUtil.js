sap.ui.require(["sap/ui/base/Object", "sap/ui/core/util/Export", "sap/ui/core/util/ExportTypeCSV", "sap/ui/core/util/File"], function (BaseObject, Export, ExportTypeCSV, File) {
    "use strict";

    return BaseObject.extend("cd_cdlitepayrollupload_f.utils.ExportUtil", {

        constructor: function () {

        },

        exportToCSV: function (oData, sFileName, oColumns) {
            // Add Header Row
            let exportData =`${oColumns.join(",")}\r\n`;

            // Process Values
            const oDataValues = oData.map((row) => {
                let oOutput = [];
                oColumns.forEach((col)=>{
                    let rowData = row[Object.keys(row).find(key => key.toUpperCase() === col.toUpperCase())];
                    if ((rowData) && (rowData.toString().indexOf(",") > -1)){
                        rowData = `"${rowData}"`;
                    }
                    oOutput.push(rowData);
                });
                return oOutput.join(",");
            });
            exportData += oDataValues.join("\r\n");

            // Download File
            File.save(exportData, sFileName, "csv", "text/csv", "UTF-8");
        }
    });
});