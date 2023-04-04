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
    "sap/ui/core/format/DateFormat",
    "cd_cdlitepayrollupload_f/utils/ExportUtil"
], function (BaseController, JSONModel, History, formatter, Filter, FilterOperator, MessageBox, ODataModel, Fragment, exportLibrary, Spreadsheet, Export, ExportTypeCSV, BusyIndicator, Text, Column, ColumnListItem, Label, DateFormat, ExportUtil) {
    "use strict";

    var EdmType = exportLibrary.EdmType;

    return BaseController.extend("cd_cdlitepayrollupload_f.controller.Object", {
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
            var currentUserModel = this.getOwnerComponent().getModel("userAttributes");
            var userScope = currentUserModel.getData().scopes;
            this._userDelete =  userScope?.includes('delete') || false;
            this._userApprove = userScope?.includes('approve') || false;

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

        onDownloadSummary: function(oEvent){
            const oBoundObject = this.getView().getBindingContext().getObject()
            const dataExport = this.getView().getModel("costCenterView").getData();
            const oExportUtil = new ExportUtil();
            oExportUtil.exportToCSV(dataExport, `Summary-Batch-${oBoundObject?.ID}`,[
                "PAYROLLPERIOD","PAYROLLCODETYPE","PAYROLLCODE","PAYROLLCODESEQUENCE","PAYROLLCODE_DESCRIPTION","GLACCOUNT","GLCOSTCENTER","AMOUNT"
            ]);
        },

        onQuickFilter: function (oEvent) {

            var oViewModel = this.getModel("objectView");
            var nErrorCnt = oViewModel.getProperty("/inError");
            var nSuccessCnt = oViewModel.getProperty("/success");

            var oBinding = this.getView().byId("lineItemsList").getBinding("items"),
                sTitle,
                sKey = oEvent.getParameter("selectedKey");
            var sHeaderStatus = this._sHeaderStatus;

            if (['APPROVED','POSTED','ERROR'].includes(sHeaderStatus.toUpperCase()))
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
            if (['APPROVED','POSTED','ERROR'].includes(that._sHeaderStatus.toUpperCase())) {
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
                        if (this._userDelete)
                            oViewModel.setProperty("/enableDeleteButton", true);

                        oViewModel.setProperty("/enableRevalButton", true);

                        if (this._userApprove)
                            oViewModel.setProperty("/enableApproveButton", true);

                        break;
                    case "STAGED":
                        if (this._userDelete)
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

                    if (['APPROVED','POSTED','ERROR'].includes(that._sHeaderStatus.toUpperCase())) {
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
            const oBoundObject = this.getView().getBindingContext().getObject()
            const oExportUtil = new ExportUtil();
            oExportUtil.exportToCSV(this._allErrorObjs, `Errors-Batch-${oBoundObject?.ID}`,[
                "FMNO","PAYROLLCODE","PAYROLLCODESEQUENCE","NAME","AMOUNT","PAYMENTNUMBER","PAYMENTID","PAYMENTFORM",
                "USERFIELD1","USERFIELD2","REMARKS","LOANADVANCEREFERENCENUMBER","PROJECTVODE","PROJECTTASK","STATUSMESSAGE"
            ]);

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
                
                oView.getBindingContext().refresh();
            
            }, 1000);

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
                        name: "cd_cdlitepayrollupload_f.fragments.Approve",
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
            const enrichUrl =  `${that.getBaseUrl("payroll")}${sPath}/enrich`
            console.log(enrichUrl);
            jQuery.ajax({
                url: enrichUrl,
                type: "POST",
                async: true,
                data: {},
                dataType: "json",
                headers: sHeaders,
                success: function (result) {
                    sap.ui.core.BusyIndicator.hide();
                    that.getView().getModel().refresh();
                    var sMsg = "BATCH " + that._ID + " was revalidated successfully!";
                    MessageBox.success(sMsg);
                    that.getView().getBindingContext().refresh();
                },
                error: function (e) {
                    sap.ui.core.BusyIndicator.hide();
                    var sMsg = "Error while performing revalidation";
                    MessageBox.error(sMsg);
                    that.getView().getBindingContext().refresh();
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
            const approveUrl =  `${that.getBaseUrl("payroll")}${sPath}/approve`
            console.log(approveUrl);
            jQuery.ajax({
                url: approveUrl,
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
                    var sMsg = `${e?.responseJSON?.error?.message || JSON.stringify(e, null, 2)}`;
                    MessageBox.error(sMsg);
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

        handlePopoverPress: function (oEvent) {
            var oCtx = oEvent.getSource().getBindingContext(),

                sPath = oEvent.getSource().getParent().getBindingContextPath(),
                oControl = oEvent.getSource(),
                oView = this.getView();

            // create popover
            if (!this._pPopover) {
                this._pPopover = Fragment.load({
                    id: oView.getId(),
                    name: "cd_cdlitepayrollupload_f.fragments.Popover",
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


    });

});
