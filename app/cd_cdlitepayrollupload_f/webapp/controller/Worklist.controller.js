sap.ui.define([
    "./BaseController",
    "sap/ui/core/Fragment",
    "sap/ui/model/json/JSONModel",
    "../model/formatter",
    "sap/m/MessageBox",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator"
], function (BaseController, Fragment, JSONModel, formatter, MessageBox, Filter, FilterOperator) {
    "use strict";

    return BaseController.extend("cd_cdlitepayrollupload_f.controller.Worklist", {

        formatter: formatter,
        _oDialog: null,

        /* =========================================================== */
        /* lifecycle methods                                           */
        /* =========================================================== */

        /**
         * Called when the worklist controller is instantiated.
         * @public
         */
        onInit: function () {
            var oViewModel;
            this._oModel = this.getOwnerComponent().getModel();

            // keeps the search state
            this._aTableSearchState = [];

            var currentUserModel = this.getOwnerComponent().getModel("userAttributes");
            var transTypesModel = this.getOwnerComponent().getModel("transTypesData");

            var uploadRangesModel = this.getOwnerComponent().getModel("uploadRangesData");

            var oUserModel = new JSONModel({
                userUpload: false
            });


            var userScope = currentUserModel.getData().scopes;
            var aUploadScope = userScope?.findIndex(x => x === 'upload');
      
            if (aUploadScope >= 1)
                oUserModel.setProperty("/userUpload", true);


            // Model used to manipulate control states
            oViewModel = new JSONModel({
                worklistTableTitle: this.getResourceBundle().getText("worklistTableTitle"),
                shareSendEmailSubject: this.getResourceBundle().getText("shareSendEmailWorklistSubject"),
                shareSendEmailMessage: this.getResourceBundle().getText("shareSendEmailWorklistMessage", [location.href]),
                tableNoDataText: this.getResourceBundle().getText("tableNoDataText")
            });
            this.setModel(oViewModel, "worklistView");
            this.setModel(transTypesModel, "transTypes");
            this.setModel(oUserModel, "userScope");
            this.setModel(uploadRangesModel, "uploadRangesList");

            var that = this;
            this.getView().addEventDelegate({
                onAfterShow: function (oEvent) {
                    var oTable = that.byId("table");
                    oTable.getBinding("items").refresh();
                }
            });

            this.getView().byId("companyCodeList").setFilterFunction(function (sTerm, oItem) {
                return oItem.getText().match(new RegExp(sTerm, "i")) || oItem.getKey().match(new RegExp(sTerm, "i"))
            })

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

        onFiltersChange: function (oEvent) {

            var oBinding = this.byId("table").getBinding("items"),
                sSelectedKey = oEvent.getSource().getSelectedKey();

            var oCompanyCodeList = this.byId("companyCodeList");
            var oMonthYearList = this.byId("monthYearList");

            var filters = [];
            if (oCompanyCodeList.getSelectedKey().length > 0) {
                filters.push(new Filter('glCompanyCode', FilterOperator.EQ, oCompanyCodeList.getSelectedKey()));
            }
            if (oMonthYearList.getSelectedKey() !== "00") {
                const OldestDate = new Date();
                OldestDate.setDate(OldestDate.getDate() - parseInt(oMonthYearList.getSelectedKey()));
                filters.push(new Filter('createdAt', FilterOperator.GT, OldestDate.toISOString()));
            }
            oBinding.filter(filters);

        },

        onCompanyCodeValidate: function (oEvent) {

            var oInput = oEvent.getSource();
            var bValid = !oInput.getSelectedKey();
            var oButton = this.getView().byId("submitBtn");
            if (bValid) {
                oInput.setValueState("Error");
                oButton.setEnabled(false);
            } else {
                oInput.setValueState("None");
                oButton.setEnabled(true);
            }
            // oInput.setValueState(bValid ? "Error" : "None");

        },

        onCurrencyValidate: function (oEvent) {

            var oInput = oEvent.getSource();
            var bValid = !oInput.getSelectedKey();
            var oButton = this.getView().byId("submitBtn");
            if (bValid) {
                oInput.setValueState("Error");
                oButton.setEnabled(false);
            } else {
                oInput.setValueState("None");
                oButton.setEnabled(true);
            }


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

                var oFilterDesc = new Filter({
                    path: 'batchDescription',
                    operator: FilterOperator.Contains,
                    value1: sQuery,
                    caseSensitive: false
                });
                filters.push(oFilterDesc);

                if (Number.isInteger(parseInt(sQuery))) {
                    var oFilterBatchId = new Filter({
                        path: 'ID',
                        operator: FilterOperator.EQ,
                        value1: sQuery
                    });
                    filters.push(oFilterBatchId);
                }
                //filters.push(new Filter("batchDescription", FilterOperator.Contains, sQuery.toLowerCase()));
                //   filters.push(new Filter("ID", FilterOperator.EQ, sQuery));

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

            sap.ui.core.BusyIndicator.show();
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


        closeApprovalDialog: function () {
            if (this._oDialog) {
                this._oDialog.close();
                //    this._oDialog.destroy();
                //this._oDialog = null;
            }
        },

        onAfterClose: function (oEvent) {
            oEvent.getSource().destroyBeginButton();
            oEvent.getSource().destroyEndButton();
            oEvent.getSource().destroyContent();
            oEvent.getSource().destroy();
            this._oDialog = null;
        },

        onUpload: function () {
            var oView = this.getView();

            // create dialog lazily
            if (!this.byId("uploadDialog")) {
                // load asynchronous XML fragment
                Fragment.load({
                    id: oView.getId(),
                    name: "cd_cdlitepayrollupload_f.fragments.Upload",
                    controller: this
                }).then(function (oDialog) {
                    // connect dialog to the root view 
                    //of this component (models, lifecycle)
                    oView.addDependent(oDialog);
                    oView.byId("uploadCompanyCode").setFilterFunction(function (sTerm, oItem) {
                        return oItem.getText().match(new RegExp(sTerm, "i")) || oItem.getKey().match(new RegExp(sTerm, "i"))
                    })
                    oView.byId("uploadCurrency").setFilterFunction(function (sTerm, oItem) {
                        return oItem.getText().match(new RegExp(sTerm, "i")) || oItem.getKey().match(new RegExp(sTerm, "i"))
                    })
                    oDialog.open();
                });
            } else {
                this.byId("uploadDialog").open();
            }
        },

        handleUploadComplete: function (oEvent) {
            var oUploadDialog = this.byId("uploadDialog");
            var status = oEvent.getParameter("status");

            //   var iHttpStatusCode = parse.Int(oEvent.getParameter("status"));
            var sMessage,
                oContext = this.byId("table").getBinding("items").aContexts[0];

            var that = this;
            if (status === 204) {
                this.onRefresh();
                sMessage = "BATCH " + that._newBatchId + " uploaded successfully!";
                MessageBox.success(sMessage);
            } else if (status === 504 || status === 502 || status === 503) {
                sMessage = "Error occurred while processing. If batch is not yet VALIDATED, please open and click 'Revalidate'.";
                MessageBox.error(sMessage);
            } else {
                console.log(oEvent.getParameter("responseRaw"));
                var errorMsg = JSON.parse(oEvent.getParameter("responseRaw"))?.error?.message;

                oContext.delete().then(function () {
                    if (status === 400)
                        errorMsg = JSON.parse(errorMsg).join('\n');
                    MessageBox.error(`Unable to upload file: \n${errorMsg}`);
                }, function (oError) {
                    console.log(oError.message);
                })
            }

            oUploadDialog.setBusy(false);
            this.closeDialog();

        },

        submitUploads: function () {
            var oUploadDialog = this.byId("uploadDialog");
            oUploadDialog.setBusy(true);
            var sCompanyCode = this.getView().byId("uploadCompanyCode").getSelectedKey();
            var sTransType = this.getView().byId("transTypeDlg").getSelectedItem().getKey();
            //   var sCurrency = this.getView().byId("currencyDlg").getValue();
            var sCurrency = this.getView().byId("uploadCurrency").getSelectedKey();
            var sPayrollDate = this.formatPayrollDate(this.getView().byId("payrollDateDlg").getValue());
            var sGLPeriod = this.formatDateString(this.getView().byId("glPeriodDlg").getValue());
            var sEffectivePeriod = this.formatDateString(this.getView().byId("effectivePeriodDlg").getValue());
            var sBatchDesc = this.getView().byId("batchDescDlg").getValue();
            var sRemarks = "";
            var oContext = this.byId("table").getBinding("items").create({
                glCompanyCode: sCompanyCode,
                transactionType: sTransType,
                currencyCode: sCurrency,
                payrollDate: sPayrollDate,
                glPeriod: sGLPeriod,
                effectivePeriod: sEffectivePeriod,
                batchDescription: sBatchDesc,
                remarks: sRemarks
            });

            var oFileUploader = this.byId("fileUploader");

            var that = this;

            var csrfToken = this.getView().getModel().getHttpHeaders()['X-CSRF-Token'];
            var tokenParameter = new sap.ui.unified.FileUploaderParameter();
            tokenParameter.setName('x-csrf-token');
            tokenParameter.setValue(csrfToken);

            oContext.created().then(function () {
                console.log(that._uploadFileName.name);
                that._newBatchId = oContext.getProperty("ID");
                var sValue = 'form-data; filename="' + that._uploadFileName.name + '"; batchID=' + that._newBatchId;
                var headPar = new sap.ui.unified.FileUploaderParameter();
                headPar.setName('content-disposition');
                headPar.setValue(sValue);
                oFileUploader.removeHeaderParameter('content-disposition');
                oFileUploader.removeHeaderParameter('x-csrf-token');
                oFileUploader.addHeaderParameter(headPar);
                oFileUploader.addHeaderParameter(tokenParameter);
                const currentPath = that.getBaseUrl("payroll");
                console.log(currentPath);
                oFileUploader.setUploadUrl(`${currentPath}/PayrollUploadFile/content`);
                oFileUploader
                    .checkFileReadable()
                    .then(function () {
                        oFileUploader.upload();
                        /*              that.onRefresh();
                                      var sMsg = "BATCH " + sBatchId + " uploaded successfully!";
                                      MessageBox.success(sMsg);
                                      oUploadDialog.setBusy(false);
                                      that.closeDialog(); */
                    })
                    .catch(function (error) {
                        MessageBox.error("The file cannot be read.");
                        oUploadDialog.setBusy(false);
                    })

            }, function (oError) {
                MessageBox.error("The file cannot be uploaded.");
                oFileUploader.clear();

            })
        },

        convertPayrollDate: function (oEvent) {
            var sDate = oEvent.getParameter("value");
            var date = new Date(sDate);
            var formattedDate = date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-');
            this.byId("payrollDateDlg").setValue(formattedDate);
        },

        formatPayrollDate: function (sLocalDate) {
            var sArr = sLocalDate.split('-');

            var sMonth = new Date(Date.parse(sArr[1] + " 1, 2012")).getMonth() + 1;

            return sMonth.toString().length === 2 ? sArr[2] + '-' + sMonth + '-' + sArr[0] : sArr[2] + '-' + '0' + sMonth + '-' + sArr[0];

        },

        formatDateString: function (sDate) {
            var d = new Date(sDate);
            var sMonth = d.getMonth() + 1;
            var sYear = d.getFullYear();

            return sMonth.toString().length === 2 ? sYear.toString() + sMonth.toString() : sYear.toString() + '0' + sMonth.toString();

        },

        onChangeFUP: function (e) {
            this._uploadFileName = e.getParameter("files") && e.getParameter("files")[0];
        },


        closeDialog: function () {
            if (this.byId("uploadDialog")) {
                this.byId("uploadDialog").close();
                this.byId("uploadDialog").destroy();
            }
        }
     
    });
});