sap.ui.define([
    "./BaseController",
    "sap/ui/model/json/JSONModel",
    "sap/ui/core/routing/History",
    "../model/formatter"
], function (BaseController, JSONModel, History, formatter) {
    "use strict";

    return BaseController.extend("com.mk.ui.mapping.controller.PayrollGLMapping", {


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
                delay: 0
            });
            this.getRouter().getRoute("payroll").attachPatternMatched(this._onObjectMatched, this);
            this.setModel(oViewModel, "mappingView");
            // var oModel = new JSONModel(sap.ui.require.toUrl("mckinsey/data/Payload.json"));
            // this.setModel(oModel);

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

        /**
         * Binds the view to the object path.
         * @function
         * @param {sap.ui.base.Event} oEvent pattern match event in route 'object'
         * @private
         */
        _onObjectMatched: function (oEvent) {
            var sObjectId = oEvent.getParameter("arguments").objectId;
            if (sObjectId) {
                this._bindView("/PaycodeGLMapping" + sObjectId);
            }else{
                var oListBinding = this.getModel().bindList("/PaycodeGLMapping");
                var oContext = oListBinding.create({
                    "legalEntityGroupCode":"",
                    "payrollCode" :"",
                    "payrollCodeSequence":""
                });
                oContext.created()
                .then(() => {
                    //Once the creation is done
                    this.getView().bindObject(oContext.getPath());
                });
            }
        },
        /**
         * Binds the view to the object path.
         * @function
         * @param {string} sObjectPath path to the object to be bound
         * @private
         */
        _bindView: function (sObjectPath) {
            var oViewModel = this.getModel("mappingView");

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
                oViewModel = this.getModel("mappingView"),
                oElementBinding = oView.getElementBinding();

            // No data for the binding
            if (!oElementBinding.getBoundContext()) {
                this.getRouter().getTargets().display("objectNotFound");
                return;
            }
            oViewModel.setProperty("/busy", false);
        },
        /**
         * Save data to backedn via API call
         * @public
         */
        onSavePayrollGLMapData: function () {
            var fnSuccess = function () {
                sap.m.MessageToast("Succesfully Updated !!");
                this.onNavBack();
            }.bind(this);
            var fnError = function () {
                sap.m.MessageToast("Error Occured  !!");
            }.bind(this);
            var oView = this.getView();
            var oObject = oView.getBindingContext().getObject();
            if (oView.getElementBinding().hasPendingChanges()) {
                oView.getModel().submitBatch("Payroll").then(fnSuccess, fnError);
            }
        }



    });

});