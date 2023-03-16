sap.ui.define([
    "./BaseController",
    "sap/ui/model/json/JSONModel",
    "sap/ui/core/routing/History",
    "../model/formatter",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/MessageBox",
    "sap/ui/model/odata/v4/ODataModel",
    "sap/ui/core/Fragment",
    "sap/ui/export/library",
    "sap/ui/export/Spreadsheet",
    "sap/ui/core/util/Export",
    "sap/ui/core/util/ExportTypeCSV",
    "sap/ui/core/BusyIndicator",
    "sap/m/Text",
    "sap/m/Column",
    "sap/m/ColumnListItem",
    "sap/m/Label",
    "sap/ui/core/format/DateFormat"
], function (BaseController, JSONModel, History, formatter, Filter, FilterOperator, MessageBox, ODataModel, Fragment, exportLibrary, Spreadsheet, Export, ExportTypeCSV, BusyIndicator, Text, Column, ColumnListItem, Label, DateFormat) {
    "use strict";

    var EdmType = exportLibrary.EdmType;

    return BaseController.extend("mck.cdlite.payrollupload.controller.Object", {

        formatter: formatter,

        /* =========================================================== */
        /* lifecycle methods                                           */
        /* =========================================================== */

        /**
         * Called when the worklist controller is instantiated.
         * @public
         */
        onInit: function () {
            // Model used to manipulate control states. The chosen values make sure,
            // detail page shows busy indication immediately so there is no break in
            // between the busy indication for loading the view's meta data
            var oViewModel = new JSONModel({
                busy: true,
                delay: 0,
                lineItemListTitle: this.getResourceBundle().getText("detailLineItemTableHeading"),
                tableNoDataText: this.getResourceBundle().getText("tableNoDataText"),
                showExport: false,
                tableBusyDelay: 0,
                inError: 0,
                success: 0,
                countAll: 0,
                enableApproveButton: false,
                enableDeleteButton: false,
                enableReValButton: false
            });
            this._oModel = this.getOwnerComponent().getModel();
            var summaryDataModel = this.getOwnerComponent().getModel("summaryData");
            this.setModel(summaryDataModel, "summaryView");
            var oTable = this.getView().byId("lineItemsList");
            this._succCnt = 0;
            this._allCnt = 0;
            this._errorCnt = 0;
            this._oTable = oTable;

            this.getRouter().getRoute("object").attachPatternMatched(this._onObjectMatched, this);
            this.setModel(oViewModel, "objectView");

        },

        onBeforeRendering: function () {


        },
        /* =========================================================== */
        /* event handlers                                              */
        /* =========================================================== */


        /**
         * Event handler  for navigating back.
         * It there is a history entry we go one step back in the browser history
         * If not, it will replace the current entry of the browser history with the worklist route.
         * @public
         */
        onNavBack: function () {
            var sPreviousHash = History.getInstance().getPreviousHash();
            if (sPreviousHash !== undefined) {
                // eslint-disable-next-line sap-no-history-manipulation
                history.go(-1);
            } else {
                this.getRouter().navTo("worklist", {}, true);

            }

        },

        /* =========================================================== */
        /* internal methods                                            */
        /* =========================================================== */

        /**
         * Binds the view to the object path.
         * @function
         * @param {sap.ui.base.Event} oEvent pattern match event in route 'object'
         * @private
         */
        _onObjectMatched: function (oEvent) {

            var sObjectId = oEvent.getParameter("arguments").objectId;
            this._ID = sObjectId.replace(/[{()}]/g, '');
            this._bindView("/StagingUploads" + sObjectId);
            /*    var allContexts = this._oModel.bindList("/StagingUploads" + sObjectId, undefined, undefined, undefined, undefined);
                allContexts.requestContexts().then(function (aContexts) {
                    this._allObjects = aContexts.map(oContext => oContext.getObject());
    
                }); */
            //   var sPostingURL = 'payroll/PostingBatch' + "?$filter=batchId eq " + parseInt(this._ID);
            var oPostingData = new JSONModel();
            var that = this;
            //   that.getPostingData(parseInt(this._ID));

            var sPostingFilter = new Filter('batchId', FilterOperator.EQ, parseInt(this._ID));
            var sCostCenterFilter = new Filter('BATCH_ID', FilterOperator.EQ, parseInt(this._ID));
            var oPostingList = this._oModel.bindList('/PostingBatch', undefined, undefined, sPostingFilter, undefined);
            var oCostCenterList = this._oModel.bindList('/AmountSummary', undefined, undefined, sCostCenterFilter, undefined);
            var oPostingData = new JSONModel();
            var oSummaryData = new JSONModel();

            oCostCenterList.requestContexts().then(function (aContexts) {

                oSummaryData.setData(aContexts.map(oContext => oContext.getObject()));
                that.setModel(oSummaryData, "costCenterView");

            });

            oPostingList.requestContexts().then(function (aContexts) {

                oPostingData.setData(aContexts.map(oContext => oContext.getObject()));
                that.setModel(oPostingData, "postingView");

            });


        },

        getPostingData: function (batchId) {
            var sFilter = new Filter('batchId', FilterOperator.EQ, batchId);
            var oList = this._oModel.bindList('/PostingBatch', undefined, undefined, sFilter, undefined);
            var oPostingData = new JSONModel();
            var arr = [];
            oList.requestContexts().then(function (aContexts) {


                oPostingData.setData(aContexts.map(oContext => oContext.getObject()));
                that.getView().setModel(oPostingData, "postingView");

            });
        },

        /**
         * Binds the view to the object path.
         * @function
         * @param {string} sObjectPath path to the object to be bound
         * @private
         */
        _bindView: function (sObjectPath) {
            var oViewModel = this.getModel("objectView");

            this.getView().bindElement({
                path: sObjectPath,
                events: {
                    change: this._onBindingChange.bind(this),
                    dataRequested: function () {
                        oViewModel.setProperty("/busy", true);
                    },
                    dataReceived: function () {
                        oViewModel.setProperty("/busy", false);
                    }
                }
            });
        },

        _onBindingChange: function () {
            var oView = this.getView(),
                oViewModel = this.getModel("objectView"),
                oElementBinding = oView.getElementBinding();


            // No data for the binding
            if (!oElementBinding.getBoundContext()) {
                this.getRouter().getTargets().display("objectNotFound");
                return;
            }

            var oResourceBundle = this.getResourceBundle(),
                oObject = oView.getBindingContext().getObject();


            oViewModel.setProperty("/busy", false);

        },


        onQuickFilter: function (oEvent) {

            var oViewModel = this.getModel("objectView");
            var nErrorCnt = oViewModel.getProperty("/inError");
            var nSuccessCnt = oViewModel.getProperty("/success");

            var oBinding = this.getView().byId("lineItemsList").getBinding("items"),
                sTitle,
                sKey = oEvent.getParameter("selectedKey");
            var sHeaderStatus = this._sHeaderStatus;

            if (sHeaderStatus.toUpperCase() === 'APPROVED')
                this._mFilters = {
                    "success": [new Filter('status', FilterOperator.EQ, 'APPROVED')],
                    "inError": [new Filter('status', FilterOperator.EQ, 'SKIPPED')],
                    "all": []
                };
            else
                this._mFilters = {
                    "success": [new Filter('status', FilterOperator.EQ, 'VALID')],
                    "inError": [new Filter('status', FilterOperator.EQ, 'INVALID')],
                    "all": []
                };

            if (sKey === "inError" && parseInt(nErrorCnt) > 0) {
                oViewModel.setProperty("/showExport", true);
            } else {
                oViewModel.setProperty("/showExport", false);

            }
            oBinding.filter(this._mFilters[sKey]);
            if (sKey === 'success')
                sTitle = this.getResourceBundle().getText("detailLineItemTableHeadingCount", [nSuccessCnt]);
            else if (sKey === 'inError')
                sTitle = this.getResourceBundle().getText("detailLineItemTableHeadingCount", [nErrorCnt]);
            else
                sTitle = this.getResourceBundle().getText("detailLineItemTableHeading");

            oViewModel.setProperty("/lineItemListTitle", sTitle);


        },

        onSummaryListFinished: function (oEvent) {
            var oTable = oEvent.getSource();
            oTable.removeSelections(true);
        },

        getSuccCnt: function (oCurrntObjs) {
            var filteredData = oCurrntObjs.filter(data => (data.status === 'APPROVED' || data.status === 'VALID'));
            this._succCnt = filteredData.length;

        },

        getErrorCnt: function (oCurrntObjs) {
            var filteredData = oCurrntObjs.filter(data => (data.status === 'SKIPPED' || data.status === 'INVALID'));
            this._errorCnt = filteredData.length;

        },

        getFilteredCnt: function (oCurrntObjs, status) {
            var filteredData = oCurrntObjs.filter(data => (data.status === status));
            if (status === 'SKIPPED' || status === 'INVALID')
                this._allErrorObjs = filteredData;
            return filteredData.length;
        },

        onListUpdateFinished: function (oEvent) {

            var sTitle,
                iTotalItems = oEvent.getParameter("total"),
                oViewModel = this.getModel("objectView"),
                oItemsBinding = oEvent.getSource().getBinding("items"),
                oIconFilter = this.byId("iconTabBar");

            this._sHeaderStatus = this.byId("detailStatusTxt").getText();
            var sKey = oIconFilter.getSelectedKey();
            var sFilter = oItemsBinding.mAggregatedQueryOptions.$filter;
            var oAllCurrentContexts = oItemsBinding.getAllCurrentContexts();
            this._oAllCurrentObjs = oAllCurrentContexts.map(oContext => oContext.getObject());
            var that = this;
            if (that._sHeaderStatus.toUpperCase() === 'APPROVED' || that._sHeaderStatus.toUpperCase() === 'POSTED' || that._sHeaderStatus.toUpperCase() === 'ERROR' ) {
                var oApproveList = that._oModel.bindContext("/PayrollHeader(" + that._ID + ")");
                oApproveList.requestObject().then(function (sObject) {
                    //  console.log(sObject);
                    that.getView().byId("approvedByTxt").setText(sObject.approvedBy);
                    var oDateFormatter = DateFormat.getDateTimeInstance();
                    that.getView().byId("approvedAtTxt").setText(oDateFormatter.format(new Date(sObject.approvedAt)));
                });
            } else {
                that.getView().byId("approvedByTxt").setText("");
                that.getView().byId("approvedAtTxt").setText("");
            }

            // only update the counter if the length is final
            if (iTotalItems && oItemsBinding.isLengthFinal()) {

                sTitle = that.getResourceBundle().getText("detailLineItemTableHeadingCount", [iTotalItems]);

                switch (that._sHeaderStatus.toUpperCase()) {
                    case "VALIDATED":
                        oViewModel.setProperty("/enableDeleteButton", true);
                        oViewModel.setProperty("/enableRevalButton", true);
                        oViewModel.setProperty("/enableApproveButton", true);
                        break;
                    case "STAGED":
                        oViewModel.setProperty("/enableDeleteButton", true);
                        oViewModel.setProperty("/enableRevalButton", true);
                        oViewModel.setProperty("/enableApproveButton", false);
                        break;
                    case "APPROVED":
                        oViewModel.setProperty("/enableDeleteButton", false);
                        oViewModel.setProperty("/enableRevalButton", false);
                        oViewModel.setProperty("/enableApproveButton", false);
                        break;
                    case "POSTED":
                        oViewModel.setProperty("/enableDeleteButton", false);
                        oViewModel.setProperty("/enableRevalButton", false);
                        oViewModel.setProperty("/enableApproveButton", false);
                        break;
                    case "ERROR":
                        oViewModel.setProperty("/enableDeleteButton", false);
                        oViewModel.setProperty("/enableRevalButton", false);
                        oViewModel.setProperty("/enableApproveButton", false);
                        break;
                    default:
                        oViewModel.setProperty("/enableDeleteButton", false);
                        oViewModel.setProperty("/enableRevalButton", false);
                        oViewModel.setProperty("/enableApproveButton", false);
                }


                if (sFilter === undefined) {
                    oViewModel.setProperty("/countAll", iTotalItems);
                    var succCnt = 0, errorCnt = 0;

                    if (that._sHeaderStatus.toUpperCase() === 'APPROVED') {
                        var succCnt = that.getFilteredCnt(that._oAllCurrentObjs, "APPROVED");
                        var errorCnt = that.getFilteredCnt(that._oAllCurrentObjs, "SKIPPED");


                    } else {
                        var succCnt = that.getFilteredCnt(that._oAllCurrentObjs, "VALID");
                        var errorCnt = that.getFilteredCnt(that._oAllCurrentObjs, "INVALID");

                    }


                    oViewModel.setProperty("/success", succCnt);
                    oViewModel.setProperty("/inError", errorCnt);
                }


            } else {
                //Display 'Line Items' instead of 'Line items (0)'
                if (sKey === 'success')
                    sTitle = that.getResourceBundle().getText("detailLineItemTableHeadingCount", [oViewModel.getProperty("/success")]);
                else if (sKey === 'inError')
                    sTitle = that.getResourceBundle().getText("detailLineItemTableHeadingCount", [oViewModel.getProperty("/inError")]);
                else
                    sTitle = that.getResourceBundle().getText("detailLineItemTableHeading");
            }
            oViewModel.setProperty("/lineItemListTitle", sTitle);

            BusyIndicator.hide();
        },

        onDownload: function () {
            // var oBinding = this.byId("lineItemsList").getBinding("items");
            // var that = this;
            //  console.log(this._allErrorObjs);
            //  oBinding.requestContexts(0, Infinity).then(function (aContexts) {
            var arr = [];
            for (var i = 0; i < this._allErrorObjs.length; i++) {
                var obj = {
                    "FMNO": this._allErrorObjs[i].fmno,
                    "PAYROLLCODE": this._allErrorObjs[i].payrollCode,
                    "PAYROLLCODESEQUENCE": this._allErrorObjs[i].payrollCodeSequence,
                    "NAME": "",
                    "AMOUNT": parseFloat(this._allErrorObjs[i].amount),
                    "PAYMENTNUMBER": this._allErrorObjs[i].paymentNumber,
                    "PAYMENTID": this._allErrorObjs[i].pyamentId,
                    "PAYMENTFORM": this._allErrorObjs[i].paymentForm,
                    "USERFIELD1": "",
                    "USERFIELD2": "",
                    "REMARKS": "",
                    "LOANADVANCEREFERENCENUMBER": this._allErrorObjs[i].loadAdvanceReferenceNumber,
                    "PROJECTCODE": this._allErrorObjs[i].projectCode,
                    "PROJECTTASK": this._allErrorObjs[i].projectTask,
                    "STATUSMESSAGE": this._allErrorObjs[i].statusMessage
                };
                arr.push(obj);
            }
            var sCSV = this.convertToCSV(arr);
            this.writeToCSV(sCSV);
            //   });
        },

        writeToCSV: function (sCSV) {
            var blob = new Blob([sCSV], { type: 'text/csv;charset=utf-8;' });
            if (navigator.msSaveBlob) { // IE 10+
                navigator.msSaveBlob(blob, exportedFilenmae);
            } else {
                var link = document.createElement("a");
                if (link.download !== undefined) { // feature detection
                    // Browsers that support HTML5 download attribute
                    var url = URL.createObjectURL(blob);
                    link.setAttribute("href", url);
                    link.setAttribute("download", 'data.csv');
                    link.style.visibility = 'hidden';
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                }
            }
        },

        convertToCSV(arr) {
            const array = [Object.keys(arr[0])].concat(arr)

            return array.map(it => {
                return Object.values(it).join(',').toString()
            }).join('\n')
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

                var fmnoFilter = new Filter('fmno', FilterOperator.EQ, sQuery);

                if (sQuery && sQuery.length > 0) {
                    aTableSearchState = fmnoFilter;
                }

                this._applySearch(aTableSearchState);
            }

        },
        _applySearch: function (aTableSearchState) {
            var oTable = this.byId("lineItemsList"),
                oViewModel = this.getModel("objectView");
            oTable.getBinding("items").filter(aTableSearchState, "Application");
            // changes the noDataText of the list in case there are no filter results
            if (aTableSearchState.length !== 0) {
                oViewModel.setProperty("/tableNoDataText", this.getResourceBundle().getText("itemlistNoDataWithSearchText"));
            }
        },
        onRefresh: function () {
            var oTable = this.byId("lineItemsList");
            oTable.getBinding("items").refresh(true);

        },

        onPressRefresh: function () {
            var oView = this.getView();
            var listPostingSummary = this.getView().byId("postingSummaryList");
            listPostingSummary.setBusy(true);

            window.setTimeout(() => {
                var batchId = this.getView().getBindingContext().getObject().ID
                var sPostingFilter = new Filter('batchId', FilterOperator.EQ, parseInt(batchId));
                var oPostingList = this._oModel.bindList('/PostingBatch', undefined, undefined, sPostingFilter, undefined);
                var oPostingData = new JSONModel();
                oPostingList.requestContexts().then(function (aContexts) {
                    oPostingData.setData(aContexts.map(oContext => oContext.getObject()));
                    oView.setModel(oPostingData, "postingView");

                    listPostingSummary.setBusy(false);
                });
            }, 1000);

        },

        getValidTotalAmt: function (arr) {
            var validLst = arr.filter(x => x.STATUS === 'VALID');
            var invalidLst = arr.filter(x => x.STATUS === 'INVALID');
            var validTotalAmt = 0;
            this._enableApprove = true;
            if (validLst.length > 0) {
                for (var i = 0; i < validLst.length; i++) {
                    validTotalAmt += parseFloat(validLst[i].AMOUNT);
                }
            } else {
                this._enableApprove = false;
            }

            return validTotalAmt;
        },

        approveViewModel: function (objArr, sTransType) {
            var validLst = objArr.filter(x => x.STATUS === 'VALID');
            var totalLst = objArr.filter(x => x.STATUS === 'TOTAL');
            var disableFlag = true;
            var sHTML = "";
            if (sTransType === '02') {
                sHTML = "Transaction Type is Taxes";
                disableFlag = true;
            } else {
                if (validLst.length > 0) {
                    if (totalLst.length > 0) {
                        if (parseFloat(totalLst[0].TOTAL_AMOUNT) !== 0) {
                            sHTML = "<h4>Total Valid Amount is not 0</h4>";
                            disableFlag = false;
                        }
                    }
                }
                else {
                    disableFlag = false;
                    sHTML = "<h4>No Valid Line Items</h4>";
                }
            }

            var oViewModel = new JSONModel({
                HTML: sHTML,
                approvalDisabled: disableFlag
            });

            return oViewModel;
        },

        onPressApprove: function (oEvent) {

            var oView = this.getView();
            var oModel = this.getOwnerComponent().getModel();

            var that = this;
            var sID = that._ID;

            var sApproveFilter = new Filter('BATCH_ID', FilterOperator.EQ, parseInt(sID));
            var oApprovalList = oModel.bindList('/ApprovalSummary', undefined, undefined, sApproveFilter, undefined);
            var oApprovalData = new JSONModel();

            oApprovalList.requestContexts().then(function (aContexts) {
                var sTransType = oView.byId("detailTransTypeTxt").getText();
                var objArr = aContexts.map(oContext => oContext.getObject());
                oApprovalData.setData(objArr);
                that.setModel(oApprovalData, "approvalView");
                that.setModel(that.approveViewModel(objArr, sTransType), "totalAmt");

                if (!that.byId("approveDialog")) {
                    // load asynchronous XML fragment
                    Fragment.load({
                        id: oView.getId(),
                        name: "mck.cdlite.payrollupload.fragments.Approve",
                        controller: that
                    }).then(function (oDialog) {
                        oView.addDependent(oDialog);
                        oDialog.open();
                    });
                } else {
                    that.byId("approveDialog").open();
                }

            });

        },

        onPressDelete: function () {
            var oContext = this.getView().getBindingContext();
            var sMessage = "Delete BATCH " + this._ID + " ?";
            var that = this;
            MessageBox.confirm(sMessage, {
                title: "Confirm",
                actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
                onClose: function (sAction) {
                    if (sAction === MessageBox.Action.OK) {
                        oContext.delete().then(function () {
                            //that.onNavBack();
                            that.getRouter().navTo("worklist");

                        })
                    }
                }.bind(that)
            });

        },

        revalUploads: function () {
            var sPath = this.getView().getBindingContext().sPath;
            var csrfToken = this.getView().getModel().getHttpHeaders()['X-CSRF-Token'];
            var sHeaders = { "content-type": "application/json", "x-csrf-token": `${csrfToken}` };
            sap.ui.core.BusyIndicator.show();
            var that = this;
            jQuery.ajax({
                url: "payroll" + sPath + "/enrich",
                type: "POST",
                async: true,
                data: {},
                dataType: "json",
                headers: sHeaders,
                success: function (result) {
                    sap.ui.core.BusyIndicator.hide();
                    var sMsg = "BATCH " + that._ID + " was revalidated successfully!";
                    MessageBox.success(sMsg);
                },
                error: function (e) {
                    sap.ui.core.BusyIndicator.hide();
                    var sMsg = "Error while performing revalidation";
                    MessageBox.error(sMsg);
                }
            })

        },

        approveUploads: function () {
            var sPath = this.getView().getBindingContext().sPath;
            var csrfToken = this.getView().getModel().getHttpHeaders()['X-CSRF-Token'];
            var sHeaders = { "content-type": "application/json", "x-csrf-token": `${csrfToken}` };
            var oApprovalDialog = this.byId("approveDialog");
            oApprovalDialog.setBusy(true);
            var that = this;
            jQuery.ajax({
                url: "payroll" + sPath + "/approve",
                type: "POST",
                async: true,
                data: {},
                dataType: "json",
                headers: sHeaders,
                success: function (result) {

                    that.closeApprovalDialog();
                    oApprovalDialog.setBusy(false);
                    that.getView().getModel().refresh();
                    var sMsg = "BATCH " + that._ID + " approved successfully!";
                    MessageBox.success(sMsg);

                },

                error: function (e) {
                    that.closeApprovalDialog();
                    oApprovalDialog.setBusy(false);
                    MessageBox.error("Service is not available, please try later!");
                }
            })
            console.log("test");
        },

        closeApprovalDialog: function () {

            if (this.byId("approveDialog")) {
                this.byId("approveDialog").close();
                this.byId("approveDialog").destroy();
            }
        },

        createColumnConfig: function () {
            var aCols = [];

            aCols.push({
                property: 'FMNO',
                type: EdmType.String
            });

            aCols.push({
                label: 'Payroll Code',
                property: 'payrollCode',
                type: EdmType.String
            });

            aCols.push({
                label: 'Payroll Code Sequence',
                property: 'payrollCodeSequence',
                type: EdmType.String
            });

            aCols.push({
                label: 'Amount',
                property: 'amount',
                type: EdmType.String
            });

            aCols.push({
                label: 'Cost Center',
                property: 'glCostCenter',
                type: EdmType.String
            });

            aCols.push({
                label: 'Payment No',
                property: 'paymentNumber',
                type: EdmType.String
            });

            aCols.push({
                label: 'Payment Id',
                property: 'paymentId',
                type: EdmType.String
            });

            aCols.push({
                label: 'Payment Form',
                property: 'paymentForm',
                type: EdmType.String
            });

            aCols.push({
                label: 'Load Advance Reference Number',
                property: 'loanAdvanceReferenceNumber',
                type: EdmType.String
            });

            aCols.push({
                label: 'Project Code',
                property: 'projectCode',
                type: EdmType.String
            });

            aCols.push({
                label: 'Project Task',
                property: 'projectTask',
                type: EdmType.String
            });

            aCols.push({
                label: 'Status',
                property: 'status',
                type: EdmType.String
            });

            aCols.push({
                label: 'Status Message',
                property: 'statusMessage',
                type: EdmType.String
            });


            return aCols;
        },

        onExport: function () {
            var aCols, oSettings, oSheet, oTable;

            if (!this._oTable) {
                this._oTable = this.byId('lineItemsList');
            }

            oTable = this._oTable;
            aCols = this.createColumnConfig();

            oSettings = {
                workbook: {
                    columns: aCols,
                    hierarchyLevel: 'Level'
                },
                dataSource: oTable.getBinding("items"),
                fileName: 'Table export sample.xlsx',
                worker: false // We need to disable worker because we are using a MockServer as OData Service
            };

            oSheet = new Spreadsheet(oSettings);
            oSheet.build().finally(function () {
                oSheet.destroy();
            });
        },

        doExport: function (oTable) {
            var aColumns = this.getColumns(oTable);

        },

        handleExport: function (oEvent) {
            var oTable = this.getView().byId("lineItemsList");

            this.doExport(oTable);
        },

        getColumns: function (oTable) {
            console.log(this._errorData);
            var aColumns = oTable.getColumns();
            var aItems = oTable.getItems();
            var aTemplate = [];

            for (var i = 0; i < aColumns.length; i++) {
                var oColumn = {
                    name: aColumns[i].getHeader().getText(),
                    template: {
                        content: {
                            path: null
                        }
                    }
                };
                if (aItems.length > 0) {
                    oColumn.template.content.path = aItems[0].getCells()[i].getBinding("text").getPath();
                }
                aTemplate.push(oColumn);
            }
            return aTemplate;
        },

        handlePopoverPress: function (oEvent) {
            var oCtx = oEvent.getSource().getBindingContext(),

                sPath = oEvent.getSource().getParent().getBindingContextPath(),
                oControl = oEvent.getSource(),
                oView = this.getView();

            // create popover
            if (!this._pPopover) {
                this._pPopover = Fragment.load({
                    id: oView.getId(),
                    name: "mck.cdlite.payrollupload.fragments.Popover",
                    controller: this
                }).then(function (oPopover) {
                    oView.addDependent(oPopover);

                    oPopover.attachAfterOpen(function () {
                        this.disablePointerEvents();
                    }, this);
                    oPopover.attachAfterClose(function () {
                        this.enablePointerEvents();
                    }, this);
                    return oPopover;
                }.bind(this));
            }
            this._pPopover.then(function (oPopover) {
                oPopover.bindElement(oCtx.getPath());
                oView.byId("popGLAct").setValue(oCtx.getProperty("glAccount"));
                oView.byId("popGLActCB").setValue(oCtx.getProperty("glAccountCB"));
                oView.byId("popCurrencyCode").setValue(oCtx.getProperty("glCurrencyCode"));
                oView.byId("popFCAT").setValue(oCtx.getProperty("fcat"));
                oView.byId("popGLCostCenter").setValue(oCtx.getProperty("glCostCenter"));
                oView.byId("popLocCode").setValue(oCtx.getProperty("locationCode"));
                oView.byId("popPernr").setValue(oCtx.getProperty("pernr"));
                oView.byId("popSkillCode").setValue(oCtx.getProperty("skillCode"));
                oPopover.openBy(oControl);
            });
        },

        disablePointerEvents: function () {
            this.byId("lineItemsList").getDomRef().style["pointer-events"] = "none";
        },

        enablePointerEvents: function () {
            this.byId("lineItemsList").getDomRef().style["pointer-events"] = "auto";
        },

        handleActionPress: function () {
            // note: We don't need to chain to the _pPopover promise, since this event-handler
            // is only called from within the loaded dialog itself.
            this.byId("myPopover").close();

        },

        onDataExport: function (oEvent) {
            var oTable = this.getView().byId("lineItemsList");
            var oExport = new Export({

                // Type that will be used to generate the content. Own ExportType's can be created to support other formats
                exportType: new ExportTypeCSV({
                    fileExtension: "csv",
                    separatorChar: ";"
                }),

                // Pass in the model created above
                models: this.getView().getModel(),

                // binding information for the rows aggregation
                rows: {
                    path: oTable.getBinding("items").getPath(),
                },

                columns: [
                    {
                        name: "FMNO",
                        template: {
                            content: "{fmno}"
                        }
                    }
                ]

                // column definitions with column name and binding info for the content

                /*            columns: [{
                                name: "FMNO",
                                template: {
                                    content: "{fmno}"
                                }
                            }, {
                                name: "Payroll Code",
                                template: {
                                    content: "{payrollCode}"
                                }
                            }, {
                                name: "Payroll Code Sequence",
                                template: {
                                    content: "{payrollCodeSequence}"
                                }
                            }, {
                                name: "Amount",
                                template: {
                                    content: "{amount}"
                                }
                            }, {
                                name: "Cost Center",
                                template: {
                                    content: "{glCostCenter}"
                                }
                            }, {
                                name: "Payment No",
                                template: {
                                    content: "{paymentNumber}"
                                }
                            }, {
                                name: "Payment ID",
                                template: {
                                    content: "{paymentId}"
                                }
                            }, {
                                name: "Payment Form",
                                template: {
                                    content: "{paymentForm}"
                                }
                            }, {
                                name: "Load Advance Reference Number",
                                template: {
                                    content: "{loanAdvanceReferenceNumber}"
                                }
                            }, {
                                name: "Project Code",
                                template: {
                                    content: "{projectCode}"
                                }
                            }, {
                                name: "Project Task",
                                template: {
                                    content: "{projectTask}"
                                }
                            }, {
                                name: "Status",
                                template: {
                                    content: "{status}"
                                }
                            }, {
                                name: "Status Message",
                                template: {
                                    content: "{statusMessage}"
                                }
                            }] */
            });

            oExport.saveFile().catch(function (oError) {
                MessageBox.error("Error when downloading data. Browser might not be supported!\n\n" + oError);
            }).then(function () {
                oExport.destroy();
            });
        },


    });

});
