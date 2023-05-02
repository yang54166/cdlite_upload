sap.ui.define([], function () {
    "use strict";

    return {

        /**
         * Rounds the number unit value to 2 digits
         * @public
         * @param {string} sValue the number string to be rounded
         * @returns {string} sValue with 2 digits rounded
         */
        numberUnit : function (sValue) {
            if (!sValue) {
                return "";
            }
            return parseFloat(sValue).toFixed(2);
        },

        highlightValid: function (sValue){
            return sValue == "VALID" ? "Information" : "None";
        },
        

        getStateForStatus: function (sValue){
            switch (sValue){
                case "ERROR":
                    return "Error";
                case "APPROVED":
                    return "Success";
                default:
                    return "None";
            }
        },

        getLocalAmount: function (sAmount) {
            var locale = navigator.language;
            return Intl.NumberFormat(locale).format(sAmount);
        }

    };

});