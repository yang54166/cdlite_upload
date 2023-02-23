sap.ui.define([
    "./BaseController",
    "sap/ui/model/json/JSONModel",
    "../model/formatter",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/MessageToast",
    "sap/m/MessageBox"
], function (BaseController, JSONModel, formatter, Filter, FilterOperator,MessageToast,MessageBox) {
    "use strict";

    return BaseController.extend("com.mk.ui.mapping.controller.Worklist", {

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

                if (sQuery && sQuery.length > 0) {
                    aTableSearchState = [new Filter("companyCode", FilterOperator.Contains, sQuery)];
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
            this.getRouter().navTo("payroll", {
                objectId: oItem.getBindingContext().getPath().substring("/LegalEntityGrouping".length)
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



        /// Event handlers for table actions 

        onAddLegalEntry: function (oEvent) {
               // open a dialoag to add an entry
               if (!this.oLEDialog) {
                this.oLEDialog = this.loadFragment({
                    name: "com.mk.ui.mapping.fragments.AddnEditLE"
                });
            }
            this.oLEDialog.then(function (oDialog) {
                oDialog.setModel(new JSONModel({ "isAdd": true }), "fragmentModel");
                oDialog.open();
                this.getView().addDependent(oDialog);
            }.bind(this));
        },
        onEditLegalEntry: function (oEvent) {
            if (this.byId("tblLEData").getSelectedItems().length === 1) {
                var oBindingContext = this.byId("tblLEData").getSelectedItems()[0].getBindingContext().getObject();

                // open a dialoag to edit an entry
                if (!this.oLEDialog) {
                    this.oLEDialog = this.loadFragment({
                        name: "com.mk.ui.mapping.fragments.AddnEditLE"
                    });
                }
                this.oLEDialog.then(function (oDialog) {
                    oDialog.open();
                    oDialog.setModel(new JSONModel(oBindingContext), "fragmentModel");
                    oDialog.getModel("fragmentModel").setProperty("/isAdd", false);
                    this.getView().addDependent(oDialog);
                }.bind(this));

            }
        },

        onDeleteLegalEntry: function () {
            var that = this ;
            var aSelectedItmes = this.byId("tblLEData").getSelectedItems();
            MessageBox.warning("Are you sure you want deleted selected mappings ? ", {
                actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
                onClose: function (sAction) {
                    that._deleteContextEntries(aSelectedItems);
                }
            });

        },
        onCancelLE: function () {
            this.oLEDialog.then(function (oDialog) {
                oDialog.close();
            });
        },
        onAddnEditLE: function () {

            var fnSuccess = function () {
                MessageToast.show("Succesfully Updated !!");
            //this.onNavBack();
            }.bind(this);
            var fnError = function () {
                MessageToast.show("Error Occured  !!");
            }.bind(this);
            this.oLEDialog.then(function (oDialog) {
                // Make service call here 
                var data = oDialog.getModel("fragmentModel").getData();
                if (data.isAdd) {
                    var oContext = this.byId("tblLEData").getBinding("items").create({
                        legalEntityGroupCode: data.legalEntityGroupCode,
                        companyCode: data.companyCode
                    });
                    oContext.created().then(function()  {
                        MessageToast.show("Succesfully Created !!");
                        oContext
                    });
                }else{
                    var vContextPath =  this.byId("tblLCData").getSelectedItems()[0].getBindingContext().getPath();

                    this.byId("tblLEData").getSelectedItems()[0].getBindingContext().setProperty(vContextPath+"/legalEntityGroupCode",data.legalEntityGroupCode);
                    this.byId("tblLEData").getSelectedItems()[0].getBindingContext().setProperty(vContextPath+"/companyCode",data.companyCode);
                    this.getModel().submitBatch("ServiceGroupId").then(fnSuccess, fnError);
                }
                oDialog.close();

            }.bind(this));
        },
        // LC related
        onAddLedgeControl: function () {
            if (!this.oLCDialog) {
                this.oLCDialog = this.loadFragment({
                    name: "com.mk.ui.mapping.fragments.AddnEditLC"
                });
            }
            this.oLCDialog.then(function (oDialog) {
                oDialog.setModel(new JSONModel({ "isAdd": true }), "fragmentModel");
                oDialog.open();
                this.getView().addDependent(oDialog);
            }.bind(this));
        },
        onEditLedgeControl: function () {
            if (this.byId("tblLCData").getSelectedItems().length === 1) {
                var oBindingContext = this.byId("tblLCData").getSelectedItems()[0].getBindingContext().getObject();

                // open a dialoag to edit an entry
                if (!this.oLCDialog) {
                    this.oLCDialog = this.loadFragment({
                        name: "com.mk.ui.mapping.fragments.AddnEditLC"
                    });
                }
                this.oLCDialog.then(function (oDialog) {
                    oDialog.open();
                    oDialog.setModel(new JSONModel(oBindingContext), "fragmentModel");
                    this.getView().addDependent(oDialog);
                }.bind(this));

            }
        },
        _deleteContextEntries:function(aSelectedItems){
            var fnError = function () {
                MessageToast.show("Error Occured  !!");
            }.bind(this);
            var fnSuccess = function () {
                MessageToast.show("Succesfully Updated !!");
            //this.onNavBack();
            }.bind(this);
            aSelectedItems.forEach(function(oItem){
               var oContext = oItem.getBindingContext();
                oContext.delete().then(fnSuccess,fnError);
            })
            this.getModel().submitBatch("ServiceGroupId");

        },
        onDeleteLedgeControl: function () {
            var that = this ;
            var aSelectedItems = this.byId("tblLCData").getSelectedItems();
            sap.m.MessageBox.warning("Are you sure you want deleted selected mappings ? ", {
                actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
                onClose: function (sAction) {
                   that._deleteContextEntries(aSelectedItems);
                    //sap.m.MessageToast.show("Action selected: " + sAction);
                }
            });
        },

        onCancelLC: function () {
            this.oLCDialog.then(function (oDialog) {
                oDialog.close();
            });
        },
        onAddnEditLC: function () {
            var that = this;
            var fnSuccess = function () {
                // MessageToast.show("Batch call finished sucessfully !!");
                console.log("Batch call finished successfully for ledger control !!")
            }.bind(this);
            var fnError = function () {
                MessageToast.show("Error Occured  !!");
            }.bind(this);
            this.oLCDialog.then(function (oDialog) {
                // Make service call here 
                var data = oDialog.getModel("fragmentModel").getData();
                if (data.isAdd) {
                    var oContext = this.byId("tblLCData").getBinding("items").create({
                        transactionType: data.transactionType,
                        docType: data.docType,
                        ledgerGroup:data.ledgerGroup,
                        docHeaderText:data.docHeaderText
                    });
                    oContext.created().then(function() {
                        MessageToast.show("Succesfully Created Entity !!");
                    });
                    that.getModel().submitBatch("ServiceGroupId").then(fnSuccess,fnError);

                }else{
                    var vContextPath =  this.byId("tblLCData").getSelectedItems()[0].getBindingContext().getPath();

                    this.byId("tblLCData").getSelectedItems()[0].getBindingContext().setProperty(vContextPath+"/docType",data.docType);
                    this.byId("tblLCData").getSelectedItems()[0].getBindingContext().setProperty(vContextPath+"/ledgerGroup",data.ledgerGroup);
                    this.byId("tblLCData").getSelectedItems()[0].getBindingContext().setProperty(vContextPath+"/docHeaderText",data.docHeaderText);

                    this.getModel().submitBatch("ServiceGroupId").then(fnSuccess, fnError);
                }
                oDialog.close();

            }.bind(this));
        },

        // Payroll to GL mapping 

        onAddPayrollGLEntry: function () { //tblPCGAData
            this.getRouter().navTo("payroll");
        },
        onEditPayrollGLEntry: function () {
            var sPath = this.byId("tblPCGAData").getSelectedItems()[0].getBindingContext().getPath().substring("/PaycodeGLMapping".length)
            this.getRouter().navTo("payroll", {
                objectId: sPath

            });
        },
        onDeletePayrollGLEntry: function () {
            var that = this ;
            var aSelectedItems = this.byId("tblPCGAData").getSelectedItems();
            sap.m.MessageBox.warning("Are you sure you want deleted selected mappings ? ", {
                actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
                onClose: function (sAction) {
                   that._deleteContextEntries(aSelectedItems);
                }
            });
        }



    });
});
