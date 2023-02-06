sap.ui.define([
    "./BaseController",
    "sap/ui/core/Fragment",
    "sap/ui/model/json/JSONModel",
    "../model/formatter",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator"
], function (BaseController, Fragment, JSONModel, formatter, Filter, FilterOperator) {
    "use strict";

    return BaseController.extend("batchuploads.controller.Worklist", {

        formatter: formatter,

        /* =========================================================== */
        /* lifecycle methods                                           */
        /* =========================================================== */

        /**
         * Called when the worklist controller is instantiated.
         * @public
         */
        onInit: function () {
            var oViewModel;

            // keeps the search state
            this._aTableSearchState = [];

            // Model used to manipulate control states
            oViewModel = new JSONModel({
                worklistTableTitle: this.getResourceBundle().getText("worklistTableTitle"),
                shareSendEmailSubject: this.getResourceBundle().getText("shareSendEmailWorklistSubject"),
                shareSendEmailMessage: this.getResourceBundle().getText("shareSendEmailWorklistMessage", [location.href]),
                tableNoDataText: this.getResourceBundle().getText("tableNoDataText")
            });
            this.setModel(oViewModel, "worklistView");

        },

        /* =========================================================== */
        /* event handlers                                              */
        /* =========================================================== */

        /**
         * Triggered by the table's 'updateFinished' event: after new table
         * data is available, this handler method updates the table counter.
         * This should only happen if the update was successful, which is
         * why this handler is attached to 'updateFinished' and not to the
         * table's list binding's 'dataReceived' method.
         * @param {sap.ui.base.Event} oEvent the update finished event
         * @public
         */
        onUpdateFinished: function (oEvent) {
            // update the worklist's object counter after the table update
            var sTitle,
                oTable = oEvent.getSource(),
                iTotalItems = oEvent.getParameter("total");
            // only update the counter if the length is final and
            // the table is not empty
            if (iTotalItems && oTable.getBinding("items").isLengthFinal()) {
                sTitle = this.getResourceBundle().getText("worklistTableTitleCount", [iTotalItems]);
            } else {
                sTitle = this.getResourceBundle().getText("worklistTableTitle");
            }
            this.getModel("worklistView").setProperty("/worklistTableTitle", sTitle);
        },

        /**
         * Event handler when a table item gets pressed
         * @param {sap.ui.base.Event} oEvent the table selectionChange event
         * @public
         */
        onPress: function (oEvent) {
            // The source is the list item that got pressed
            this._showObject(oEvent.getSource());
        },

        /**
         * Event handler for navigating back.
         * Navigate back in the browser history
         * @public
         */
        onNavBack: function () {
            // eslint-disable-next-line sap-no-history-manipulation
            history.go(-1);
        },


        onSearch: function (oEvent) {
            if (oEvent.getParameters().refreshButtonPressed) {
                // Search field's 'refresh' button has been pressed.
                // This is visible if you select any main list item.
                // In this case no new search is triggered, we only
                // refresh the list binding.
                this.onRefresh();
            } else {
                var aTableSearchState = [];
                var sQuery = oEvent.getParameter("query");

                var filters = [];
            
                filters.push(new Filter("batchDescription", FilterOperator.Contains, sQuery));
                filters.push(new Filter("companyCode", FilterOperator.Contains, sQuery));

                var orFilters = new Filter(filters, false);
                if (sQuery && sQuery.length > 0) {
                    aTableSearchState = orFilters;
                }
                
                this._applySearch(aTableSearchState);
            }

        },

        /**
         * Event handler for refresh event. Keeps filter, sort
         * and group settings and refreshes the list binding.
         * @public
         */
        onRefresh: function () {
            var oTable = this.byId("table");
            oTable.getBinding("items").refresh();
        },

        /* =========================================================== */
        /* internal methods                                            */
        /* =========================================================== */

        /**
         * Shows the selected item on the object page
         * @param {sap.m.ObjectListItem} oItem selected Item
         * @private
         */
        _showObject: function (oItem) {
            this.getRouter().navTo("object", {
                objectId: oItem.getBindingContext().getPath().substring("/StagingUploads".length)
            });
        },

        /**
         * Internal helper method to apply both filter and search state together on the list binding
         * @param {sap.ui.model.Filter[]} aTableSearchState An array of filters for the search
         * @private
         */
        _applySearch: function (aTableSearchState) {
            var oTable = this.byId("table"),
                oViewModel = this.getModel("worklistView");
            oTable.getBinding("items").filter(aTableSearchState, "Application");
            // changes the noDataText of the list in case there are no filter results
            if (aTableSearchState.length !== 0) {
                oViewModel.setProperty("/tableNoDataText", this.getResourceBundle().getText("worklistNoDataWithSearchText"));
            }
        },

        onUpload: function () {
            var oView = this.getView();

            // create dialog lazily
            if (!this.byId("uploadDialog")) {
                // load asynchronous XML fragment
                Fragment.load({
                    id: oView.getId(),
                    name: "batchuploads.fragments.Upload",
                    controller: this
                }).then(function (oDialog) {
                    // connect dialog to the root view 
                    //of this component (models, lifecycle)
                    oView.addDependent(oDialog);
                    oDialog.open();
                });
            } else {
                this.byId("uploadDialog").open();
            }
        },


        submitUploads: function () {
            var sCompanyCode = this.getView().byId("companyCode").getValue();
            var sTransType = this.getView().byId("transType").getSelectedItem().getText();
       //     var sCurrency = this.getView().byId("currency").getValue();
            var sPayrollDate = this.getView().byId("payrollDate").getValue();
            var sGLPeriod = this.getView().byId("glPeriod").getValue();
            var sEffectivePeriod = this.getView().byId("effectivePeriod").getValue();
            //    var sBatchNo = this.getView().byId("batchNo").getValue();
            var sBatchDesc = this.getView().byId("batchDesc").getValue();
    //        var sRemarks = this.getView().byId("uploadRemarks").getValue();

            var oUploadData = {
                "batchDescription": sBatchDesc,
                "BATCHNUMBER": this._newID,
      //          "CURRENCYCODE": sCurrency,
                "effectiveDate": sEffectivePeriod,
                "companyCode": sCompanyCode,
                "glDate": sGLPeriod,
                "ID": this._newID.toString(),
                "payrollDate": sPayrollDate,
       //         "REMARKS": sRemarks,
                "batchStatus": "STAGED",
          //      "STATUSMESSAGE": "Uploaded",
          //      "TRANSACTIONTYPE": sTransType
            };

            var oModel = this.getView().getModel();
            var oModelData = oModel.getProperty("/");
            oModelData.push(oUploadData);
            oModel.setProperty("/", oModelData);

            if (this.byId("uploadDialog")) {
                this.byId("uploadDialog").close();
                this.byId("uploadDialog").destroy();
            }
        },
        
        closeDialog: function () {
            if (this.byId("uploadDialog")) {
                this.byId("uploadDialog").close();
                this.byId("uploadDialog").destroy();
            }
        }

    });
});
