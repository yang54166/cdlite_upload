sap.ui.define([
    "./BaseController",
    "sap/ui/model/json/JSONModel",
    "sap/ui/core/routing/History",
    "../model/formatter",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/MessageBox",
    "sap/ui/export/library",
    "sap/ui/export/Spreadsheet",
    "sap/ui/core/util/Export",
    "sap/ui/core/util/ExportTypeCSV"
], function (BaseController, JSONModel, History, formatter, Filter, FilterOperator, MessageBox, exportLibrary, Spreadsheet, Export, ExportTypeCSV) {
    "use strict";

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

            var oTable = this.getView().byId("lineItemsList");

            this._oTable = oTable;

            this._mFilters = {
                "success": [new Filter("STATUS", FilterOperator.EQ, 'APPROVED')],
                "inError": [new Filter("STATUS", FilterOperator.EQ, 'ERROR')],
                "all": []
            };
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
      
            var oViewModel = this.getModel("objectView");
            var oBinding = this._oTable.getBinding("items"),
                sKey = oEvent.getParameter("selectedKey");

            if (sKey === "inError") {
                oViewModel.setProperty("/showExport", true);
            } else {
                oViewModel.setProperty("/showExport", false);
            }
            oBinding.filter(this._mFilters[sKey]);
        },

        onListUpdateFinished: function (oEvent) {

            var sTitle,
                iTotalItems = oEvent.getParameter("total"),
                oViewModel = this.getModel("objectView"),
                oItemsBinding = oEvent.getSource().getBinding("items");
          
            // only update the counter if the length is final
            if (iTotalItems && oItemsBinding.isLengthFinal()) {

                sTitle = this.getResourceBundle().getText("detailLineItemTableHeadingCount", [iTotalItems]);
                oViewModel.setProperty("/countAll", iTotalItems);

                this._sURL = oItemsBinding.sReducedPath;
                var sURL = '/payroll' + this._sURL + "?$filter=fmno eq '" + '101118' + "'";
                $.get({
                    url: sURL,
                    success: function(data) {
                        oViewModel.setProperty("/success", data.value.length);
                    },
                    error: function(error) {

                    }
                });
             
            } else {
                //Display 'Line Items' instead of 'Line items (0)'
                sTitle = this.getResourceBundle().getText("detailLineItemTableHeading");
            }
            oViewModel.setProperty("/lineItemListTitle", sTitle);
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

                var companyCodeFilter = new Filter({
                    path: this._sURL,
                    operator: FilterOperator.Any,
                    variable: "details",
                    condition: new Filter("glPostCostCenter", FilterOperator.Contains, sQuery)
                });
               // console.log(this._sURL);
             //   filters.push(new Filter(this._sURL + '/glPostCostCenter', FilterOperator.Contains, sQuery));
             //   filters.push(new Filter(this._sURL + '/payrollCode', FilterOperator.Contains, sQuery));

      //          var orFilters = new Filter(filters, false);
                if (sQuery && sQuery.length > 0) {
                    aTableSearchState = companyCodeFilter;
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
    });

});
