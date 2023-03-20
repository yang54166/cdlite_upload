sap.ui.define([
    "./BaseController"
], function (BaseController) {
    "use strict";

    return BaseController.extend("mck.cdlite.payrollupload.controller.App", {

        onInit : function () {
            // apply content density mode to root view
            this.getView().addStyleClass(this.getOwnerComponent().getContentDensityClass());

            var oUserAttributes = this.getOwnerComponent().getModel("userAttributes");

     /*       if(!this._validateUserAccess(oUserAttributes)){
                //this.getRouter().navTo("notFound");
                return;
            } */
        },

        _validateUserAccess :function(oUserData){
            var aScopes = oUserData.getProperty("/scopes");
            var aFoundScopes = aScopes?.filter(function(sAccess){
                return sAccess.lastIndexOf(".admin")>=0 ;
            });
            if(aFoundScopes?.length){
                return true;
            }else{
                return false;
            }
        }
    });

});