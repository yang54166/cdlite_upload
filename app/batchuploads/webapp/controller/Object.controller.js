sap.ui.define([
    "./BaseController",
    "sap/ui/model/json/JSONModel",
    "sap/ui/core/routing/History",
    "../model/formatter",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/MessageBox",
    "sap/ui/core/Fragment",
    "sap/ui/export/library",
    "sap/ui/export/Spreadsheet",
    "sap/ui/core/util/Export",
    "sap/ui/core/util/ExportTypeCSV"
], function (BaseController, JSONModel, History, formatter, Filter, FilterOperator, MessageBox, Fragment, exportLibrary, Spreadsheet, Export, ExportTypeCSV) {
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
                countAll: 0
            });
            var summaryDataModel = this.getOwnerComponent().getModel("summaryData");
            this.setModel(summaryDataModel, "summaryView");
            var oTable = this.getView().byId("lineItemsList");

            this._oTable = oTable;

            this.getRouter().getRoute("object").attachPatternMatched(this._onObjectMatched, this);
            this.setModel(oViewModel, "objectView");

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
            console.log(this._errorData);
            var oViewModel = this.getModel("objectView");
            var oBinding = this._oTable.getBinding("items"),
                sKey = oEvent.getParameter("selectedKey");

            this._mFilters = {
                "success": [new Filter('status', FilterOperator.EQ, 'VALID')],
                "inError": [new Filter('status', FilterOperator.EQ, 'INVALID')],
                "all": []
            };
            if (sKey === "inError") {
                oViewModel.setProperty("/showExport", true);
            } else {
                oViewModel.setProperty("/showExport", false);
            }
            oBinding.filter(this._mFilters[sKey]);
        },

        onSummaryListFinished: function (oEvent) {
            var oTable = oEvent.getSource();
            oTable.removeSelections(true);
        },

        onListUpdateFinished: function (oEvent) {

            var sTitle,
                iTotalItems = oEvent.getParameter("total"),
                oViewModel = this.getModel("objectView"),
                oItemsBinding = oEvent.getSource().getBinding("items");
            //   var existingFilter = oItemsBinding.mAggregatedQueryOptions.$filter;
            //     var successFilter = new Filter('status', FilterOperator.EQ, 'APPROVED');
            //     var errorFilter = new Filter('status', FilterOperator.EQ, 'INVALID');

            // only update the counter if the length is final
            if (iTotalItems && oItemsBinding.isLengthFinal()) {

                sTitle = this.getResourceBundle().getText("detailLineItemTableHeadingCount", [iTotalItems]);
                oViewModel.setProperty("/countAll", iTotalItems);

                //            var nSuccess = oItemsBinding.filter(successFilter).getLength();
                //            console.log(nSuccess);

                this._sURL = oItemsBinding.sReducedPath;
       //         this._postURL = oItemsBinding.oContext.sPath;
                var sApprovedURL = '/payroll' + this._sURL + "?$filter=status eq '" + 'VALID' + "'";
                var sErrorURL = '/payroll' + this._sURL + "?$filter=status eq '" + 'INVALID' + "'";
                /*       if (existingFilter || existingFilter !== undefined) {
                           sApprovalURL = sApprovedURL + ' and ' + existingFilter;
                           sErrorURL = sErrorURL + ' and ' + existingFilter;
                       } */
                $.get({
                    url: sApprovedURL,
                    success: function (succData) {
                        oViewModel.setProperty("/success", succData.value.length);
                    },
                    error: function (error) {

                    }
                });

                $.get({
                    url: sErrorURL,
                    success: function (errorData) {
                        oViewModel.setProperty("/inError", errorData.value.length);
                        //      this._errorData = errorData.value;

                    },
                    error: function (error) {

                    }
                });

            } else {
                //Display 'Line Items' instead of 'Line items (0)'
                sTitle = this.getResourceBundle().getText("detailLineItemTableHeading");
            }
            oViewModel.setProperty("/lineItemListTitle", sTitle);
        },

        onDownload: function () {
            var oBinding = this.byId("lineItemsList").getBinding("items");
            var that = this;
            oBinding.requestContexts().then(function (aContexts) {
                var arr = [];
                for (var i = 0; i < aContexts.length; i++) {
                    arr.push(aContexts[i].getObject());
                }
                var sCSV = that.convertToCSV(arr);
                that.writeToCSV(sCSV);
            });
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
                return Object.values(it).toString()
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

        onPressApprove: function (oEvent) {

            var oViewModel = new JSONModel({
               HTML: "<h3>Total Amount: 0</h3>"
            });

            this.setModel(oViewModel, "totalAmt");
            var oView = this.getView();
            var that = this;
            var sID = that._ID;
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
                    setTimeout(function() {that.createTotalTable();}, 500);
         /*           oDialog.addEventDelegate({
                        onAfterRendering: function() {
                            oView.byId("approveSummaryList").removeSelections(true);
                        }.bind(that)
                    }) */
                    oDialog.open();
                });
            } else {
                that.byId("approveDialog").open();
            }
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

        approveUploads: function () {
            var sPath = this.getView().getBindingContext().sPath;
            var sHeaders = {"content-type": "application/json"};
            var that = this;
            jQuery.ajax({
                url: "/payroll" + sPath + "/approve",
                type: "POST",
                async: false,
                data: {},
                dataType: "json",
                headers: sHeaders,
                success: function (result) {
                    that.closeApprovalDialog();
                    var sMsg = "BATCH " + this._ID + " approved successfully!";
                    MessageBox.success(sMsg);
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
