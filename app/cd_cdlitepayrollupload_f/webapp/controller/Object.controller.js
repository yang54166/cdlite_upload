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
    "sap/ui/core/util/ExportTypeCSV"
], function (BaseController, JSONModel, History, formatter, Filter, FilterOperator, MessageBox, ODataModel, Fragment, exportLibrary, Spreadsheet, Export, ExportTypeCSV) {
    "use strict";

    var EdmType = exportLibrary.EdmType;

    return BaseController.extend("batchuploads.controller.Object", {

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
                enableButton: true
            });
            this._oModel = this.getOwnerComponent().getModel();
            var summaryDataModel = this.getOwnerComponent().getModel("summaryData");
            this.setModel(summaryDataModel, "summaryView");
            var oTable = this.getView().byId("lineItemsList");

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
            var sPostingURL = 'payroll/PostingBatch' + "?$filter=batchId eq " + parseInt(this._ID);
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
            var oAllCurrentContexts = oItemsBinding.getAllCurrentContexts();
            this._oAllCurrentObjs = oAllCurrentContexts.map(oContext => oContext.getObject());

            // only update the counter if the length is final
            if (iTotalItems && oItemsBinding.isLengthFinal()) {

                sTitle = this.getResourceBundle().getText("detailLineItemTableHeadingCount", [iTotalItems]);
                oViewModel.setProperty("/countAll", iTotalItems);
                var succCnt = 0, errorCnt = 0;

                if (this._sHeaderStatus.toUpperCase() === 'VALIDATED')
                    oViewModel.setProperty("/enableButton", true);
                else oViewModel.setProperty("/enableButton", false);

                if (this._sHeaderStatus.toUpperCase() === 'APPROVED') {
                    var succCnt = this.getFilteredCnt(this._oAllCurrentObjs, "APPROVED");
                    var errorCnt = this.getFilteredCnt(this._oAllCurrentObjs, "SKIPPED");


                } else {
                    var succCnt = this.getFilteredCnt(this._oAllCurrentObjs, "VALID");
                    var errorCnt = this.getFilteredCnt(this._oAllCurrentObjs, "INVALID");

                }

                oViewModel.setProperty("/success", succCnt);
                oViewModel.setProperty("/inError", errorCnt);


            } else {
                //Display 'Line Items' instead of 'Line items (0)'
                if (sKey === 'success')
                    sTitle = this.getResourceBundle().getText("detailLineItemTableHeadingCount", [oViewModel.getProperty("/success")]);
                else if (sKey === 'inError')
                    sTitle = this.getResourceBundle().getText("detailLineItemTableHeadingCount", [oViewModel.getProperty("/inError")]);
                else
                    sTitle = this.getResourceBundle().getText("detailLineItemTableHeading");
            }
            oViewModel.setProperty("/lineItemListTitle", sTitle);

            sap.ui.core.BusyIndicator.hide();
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
            oTable.getBinding("items").refresh();
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

        _onPressApprove: function (oEvent) {

            var oView = this.getView();

            var oTemplate = new sap.m.ColumnListItem({
                cells: [
                    new sap.m.Text({ text: "{STATUS}" }),
                    new sap.m.Text({ text: "{LINES_COUNT}" }),
                    new sap.m.Text({ text: "{FMNO_COUNT}" }),
                    new sap.m.Text({ text: "{TOTAL_AMOUNT}" })
                ]
            });
            var that = this;
            var sID = that._ID;

            var sApproveFilter = new Filter('BATCH_ID', FilterOperator.EQ, parseInt(sID));


            var sBatchDesc = oView.byId("snappedHeadingSubTitle").getText();
            var sGLCompanyCode = oView.byId("companyCodeTxt").getText();
            var sCurrencyCode = oView.byId("currencyCodeTxt").getText();
            var sPayrollDate = oView.byId("payrollDateTxt").getText();
            var sEffectivePeriod = oView.byId("effectivePeriodTxt").getText();

            // create dialog lazily
            if (!that.byId("approveDialog")) {
                // load asynchronous XML fragment
                Fragment.load({
                    id: oView.getId(),
                    name: "batchuploads.fragments.Approve",
                    controller: that
                }).then(function (oDialog) {
                    oView.addDependent(oDialog);
                    oView.byId("approvePageTitle").setText("Upload Batch " + sID + " Summary");
                    oView.byId("approveDesc").setText(sBatchDesc);
                    oView.byId("aprroveCurrency").setText(sCurrencyCode);
                    oView.byId("approveCompanyCode").setText(sGLCompanyCode);
                    oView.byId("approvePayrollDate").setText(sPayrollDate);
                    oView.byId("approveEffectivePeriod").setText(sEffectivePeriod);
                    var oTable = oView.byId("approveSummaryList");
                    oTable.bindItems({ path: '/ApprovalSummary', template: oTemplate, filters: sApproveFilter });
                    var sButton = oView.byId("approveBtn");
                    /*                    var validLst = objArr.filter(x => x.STATUS === 'VALID');
                                        if (validLst.length === 0) {
                                            sButton.setEnabled(false);
                                            var sHTML = "<h4>No Valid Line Items</h4>";
                                        } else {
                                            for (var i = 0; i < validLst.length; i++) {
                                                if (validLst[i].AMOUNT !== '0') {
                                                    var sHTML = "<h4>Total Valid Amount is not 0</h4>";
                                                    sButton.setEnabled(false);
                                                    break;
                                                }
                                            }
                    
                                        }
                    
                                        var oViewModel = new JSONModel({
                                            HTML: sHTML
                                        });
                    
                                        that.setModel(oViewModel, "totalAmt"); */
                    oDialog.setInitialFocus(sButton);

                    oDialog.open();
                });
            } else {
                that.byId("approveDialog").open();
            }


        },

        approveViewModel: function (objArr) {
            var validLst = objArr.filter(x => x.STATUS === 'VALID');
            var totalLst = objArr.filter(x => x.STATUS === 'TOTAL');
            var disableFlag = true;
            if (validLst.length > 0) {
                if (totalLst.length > 0) {
                    if (parseFloat(totalLst[0].TOTAL_AMOUNT) !== 0) {
                        var sHTML = "<h4>Total Valid Amount is not 0</h4>";
                        disableFlag = false;
                    }
                }
            }
            else {
                disableFlag = false;
                var sHTML = "<h4>No Valid Line Items</h4>";
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

            var oApprovalData = new JSONModel();
            oApprovalData.setData(that.testSummaryAmout());
            that.setModel(oApprovalData, "approvalView");
            var sApproveFilter = new Filter('BATCH_ID', FilterOperator.EQ, parseInt(sID));
            var oApprovalList = oModel.bindList('/ApprovalSummary', undefined, undefined, sApproveFilter, undefined);
            var oApprovalData = new JSONModel();
            //   setTimeout(function () { arr = that.testSummaryAmout(); }, 500); 
            oApprovalList.requestContexts().then(function (aContexts) {
                var objArr = aContexts.map(oContext => oContext.getObject());
                oApprovalData.setData(objArr);
                that.setModel(oApprovalData, "approvalView");

                that.setModel(that.approveViewModel(objArr), "totalAmt");
                var sBatchDesc = oView.byId("snappedHeadingSubTitle").getText();
                var sGLCompanyCode = oView.byId("companyCodeTxt").getText();
                var sCurrencyCode = oView.byId("currencyCodeTxt").getText();
                var sPayrollDate = oView.byId("payrollDateTxt").getText();
                var sEffectivePeriod = oView.byId("effectivePeriodTxt").getText();

                // create dialog lazily
                if (!that.byId("approveDialog")) {
                    // load asynchronous XML fragment
                    Fragment.load({
                        id: oView.getId(),
                        name: "batchuploads.fragments.Approve",
                        controller: that
                    }).then(function (oDialog) {
                        oView.addDependent(oDialog);
                        oView.byId("approvePageTitle").setText("Upload Batch " + sID + " Summary");
                        oView.byId("approveDesc").setText(sBatchDesc);
                        oView.byId("aprroveCurrency").setText(sCurrencyCode);
                        oView.byId("approveCompanyCode").setText(sGLCompanyCode);
                        oView.byId("approvePayrollDate").setText(sPayrollDate);
                        oView.byId("approveEffectivePeriod").setText(sEffectivePeriod);

                        var sButton = oView.byId("approveBtn");

                        /*         var validLst = objArr.filter(x => x.STATUS === 'VALID');
                                 var totalLst = objArr.filter(x => x.STATUS === 'TOTAL');
                                 if (validLst.length > 0) {
                                     if (totalLst.length > 0) {
                                         if (parseFloat(totalLst[0].TOTAL_AMOUNT) !== 0) {
                                             var sHTML = "<h4>Total Valid Amount is not 0</h4>";
                                             sButton.setEnabled(false);
                                         }
                                     }
                                 }
                                 else {
                                     sButton.setEnabled(false);
                                     var sHTML = "<h4>No Valid Line Items</h4>";
                                 }
         
                                 var oViewModel = new JSONModel({
                                     HTML: sHTML
                                 });
         
                                 that.setModel(oViewModel, "totalAmt"); */
                        oDialog.setInitialFocus(sButton);
                        oDialog.addEventDelegate({
                            onBeforeRendering: function () {
                                //oView.byId("approveSummaryList").removeSelections(true);
                                console.log("test");
                            }.bind(that)
                        })
                        oDialog.open();
                    });
                } else {
                    that.byId("approveDialog").open();
                }

            });

        },


        createTotalTable: function () {
            var oTable = this.byId("approveSummaryList");
            var col1 = new sap.m.Column("col1", {
                width: "4rem",
                header: new sap.m.Label({
                    text: ""
                })
            });
            var col2 = new sap.m.Column("col2", {
                width: "4rem",
                header: new sap.m.Label({
                    text: "Number of Lines"
                })
            });
            var col3 = new sap.m.Column("col3", {
                width: "4rem",
                header: new sap.m.Label({
                    text: "Number of FMNO's"
                })
            });
            oTable.addColumn(col1);
            oTable.addColumn(col2);
            oTable.addColumn(col3);
            oTable.bindItems("summaryView>/", new sap.m.ColumnListItem({
                cells: [
                    new sap.m.Text({
                        text: "{summaryView>rowHeader}"
                    }),
                    new sap.m.Text({
                        text: "{summaryView>lineCnt}"
                    }),
                    new sap.m.Text({
                        text: "{summaryView>fmnoCnt}"
                    })
                ]
            }))
            //   oTable.removeSelections(true);

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

        testAmt: function () {

        },

        testSummaryAmout: function () {
            var sURL = 'payroll/ApprovalSummary' + "?$filter=BATCH_ID eq " + parseInt(this._ID);
            var oView = this.getView();
            var sBatchDesc = oView.byId("snappedHeadingSubTitle").getText();
            var sGLCompanyCode = oView.byId("companyCodeTxt").getText();
            var sCurrencyCode = oView.byId("currencyCodeTxt").getText();
            var sPayrollDate = oView.byId("payrollDateTxt").getText();
            var sEffectivePeriod = oView.byId("effectivePeriodTxt").getText();

            var oApprovalData = new JSONModel();
            var that = this;
            jQuery.ajax({
                url: sURL,
                type: "GET",
                async: true,
                dataType: "json",
                success: function (result) {
                    var objArr = JSON.stringify(result.value);
                    //       var validLst = objArr.filter(x => x.STATUS === 'VALID');
                    oApprovalData.setData(objArr);
                    oView.setModel(oApprovalData, "approvalView");
                    // create dialog lazily
                    if (!that.byId("approveDialog")) {
                        // load asynchronous XML fragment
                        Fragment.load({
                            id: oView.getId(),
                            name: "batchuploads.fragments.Approve",
                            controller: that
                        }).then(function (oDialog) {
                            oView.addDependent(oDialog);
                            oView.byId("approvePageTitle").setText("Upload Batch " + that._ID + " Summary");
                            oView.byId("approveDesc").setText(sBatchDesc);
                            oView.byId("aprroveCurrency").setText(sCurrencyCode);
                            oView.byId("approveCompanyCode").setText(sGLCompanyCode);
                            oView.byId("approvePayrollDate").setText(sPayrollDate);
                            oView.byId("approveEffectivePeriod").setText(sEffectivePeriod);

                            var sButton = oView.byId("approveBtn");

                            /*                if (validLst.length === 0) {
                                                sButton.setEnabled(false);
                                                var sHTML = "<h4>No Valid Line Items</h4>";
                                            } else {
                                                for (var i = 0; i < validLst.length; i++) {
                                                    if (validLst[i].AMOUNT !== '0') {
                                                        var sHTML = "<h4>Total Valid Amount is not 0</h4>";
                                                        sButton.setEnabled(false);
                                                        break;
                                                    }
                                                }
                
                                            } 
                
                                            var oViewModel = new JSONModel({
                                                HTML: sHTML
                                            });
                
                                            that.setModel(oViewModel, "totalAmt"); */
                            oDialog.setInitialFocus(sButton);

                            oDialog.open();
                        });
                    } else {
                        that.byId("approveDialog").open();
                    }


                },

                error: function (e) {
                    console.log(e.message);
                }
            })
            console.log("test");

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
                    /*    var sFilter = new Filter('batchId', FilterOperator.EQ, parseInt(that._ID));
                        var oList = that._oModel.bindList('/PostingBatch', undefined, undefined, sFilter, undefined);
                        var oPostingData = new JSONModel();
                   
                        oList.requestContexts().then(function (aContexts) {
                   
                            oPostingData.setData(aContexts.map(oContext => oContext.getObject()));
                            that.setModel(oPostingData, "postingView");
                            oApprovalDialog.setBusy(false);
                            var sMsg = "BATCH " + that._ID + " approved successfully!";
                            MessageBox.success(sMsg);
                            that.closeApprovalDialog();
            
                        }); */

                    oApprovalDialog.setBusy(false);
                    var sMsg = "BATCH " + that._ID + " approved successfully!";
                    MessageBox.success(sMsg);
                    that.closeApprovalDialog();
                },

                error: function (e) {
                    console.log(e.message);
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
            /*        var oExport = new sap.ui.core.util.Export({
                        exportType: new sap.ui.core.util.ExportTypeCSV({
                            separatorChar: ";",
                            charset: "utf-8",
                        }),
                        models: this.getView().getModel(),
                        rows: {
                            path: oTable.getBinding("items").getPath(),
                        },
                        columns: aColumns
                    });
        
                  oExport.saveFile().always(function () {
                        this.destroy();
                    }); */
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
                oControl = oEvent.getSource(),
                oView = this.getView();

            // create popover
            if (!this._pPopover) {
                this._pPopover = Fragment.load({
                    id: oView.getId(),
                    name: "batchuploads.fragments.Popover",
                    controller: this
                }).then(function (oPopover) {
                    oView.addDependent(oPopover);
                    oView.byId("popGLAct").setValue(oCtx.getProperty("glAccount"));
                    oView.byId("popCurrencyCode").setValue(oCtx.getProperty("glCurrencyCode"));
                    oView.byId("popFCAT").setValue(oCtx.getProperty("fcat"));
                    oView.byId("popGLCostCenter").setValue(oCtx.getProperty("glCostCenter"));
                    oView.byId("popLocCode").setValue(oCtx.getProperty("locationCode"));
                    oView.byId("popPernr").setValue(oCtx.getProperty("pernr"));
                    oView.byId("popSkillCode").setValue(oCtx.getProperty("skillCode"));
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
