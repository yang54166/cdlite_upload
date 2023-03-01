sap.ui.define(["./BaseController","sap/ui/model/json/JSONModel","sap/ui/core/routing/History","../model/formatter","sap/ui/model/Filter","sap/ui/model/FilterOperator","sap/m/MessageBox","sap/ui/model/odata/v4/ODataModel","sap/ui/core/Fragment","sap/ui/export/library","sap/ui/export/Spreadsheet","sap/ui/core/util/Export","sap/ui/core/util/ExportTypeCSV"],function(e,t,r,n,a,o,i,s,l,d,u,p,c){"use strict";var g=d.EdmType;return e.extend("batchuploads.controller.Object",{formatter:n,onInit:function(){var e=new t({busy:true,delay:0,lineItemListTitle:this.getResourceBundle().getText("detailLineItemTableHeading"),tableNoDataText:this.getResourceBundle().getText("tableNoDataText"),showExport:false,tableBusyDelay:0,inError:0,success:0,countAll:0});this._oModel=this.getOwnerComponent().getModel();var r=this.getOwnerComponent().getModel("summaryData");this.setModel(r,"summaryView");var n=this.getView().byId("lineItemsList");this._oTable=n;this.getRouter().getRoute("object").attachPatternMatched(this._onObjectMatched,this);this.setModel(e,"objectView")},onBeforeRendering:function(){},onNavBack:function(){var e=r.getInstance().getPreviousHash();if(e!==undefined){history.go(-1)}else{this.getRouter().navTo("worklist",{},true)}},_onObjectMatched:function(e){var r=e.getParameter("arguments").objectId;this._ID=r.replace(/[{()}]/g,"");this._bindView("/StagingUploads"+r);var n="payroll/PostingBatch"+"?$filter=batchId eq "+parseInt(this._ID);var i=new t;var s=this;var l=new a("batchId",o.EQ,parseInt(this._ID));var d=this._oModel.bindList("/PostingBatch",undefined,undefined,l,undefined);var i=new t;d.requestContexts().then(function(e){i.setData(e.map(e=>e.getObject()));s.setModel(i,"postingView")})},getPostingData:function(e){var r=new a("batchId",o.EQ,e);var n=this._oModel.bindList("/PostingBatch",undefined,undefined,r,undefined);var i=new t;var s=[];n.requestContexts().then(function(e){i.setData(e.map(e=>e.getObject()));that.getView().setModel(i,"postingView")})},_bindView:function(e){var t=this.getModel("objectView");this.getView().bindElement({path:e,events:{change:this._onBindingChange.bind(this),dataRequested:function(){t.setProperty("/busy",true)},dataReceived:function(){t.setProperty("/busy",false)}}})},_onBindingChange:function(){var e=this.getView(),t=this.getModel("objectView"),r=e.getElementBinding();if(!r.getBoundContext()){this.getRouter().getTargets().display("objectNotFound");return}var n=this.getResourceBundle(),a=e.getBindingContext().getObject();t.setProperty("/busy",false)},onQuickFilter:function(e){var t=this.getModel("objectView");var r=t.getProperty("/inError");var n=this.getView().byId("lineItemsList").getBinding("items"),i=e.getParameter("selectedKey");var s=this._sHeaderStatus;if(s.toUpperCase()==="APPROVED")this._mFilters={success:[new a("status",o.EQ,"APPROVED")],inError:[new a("status",o.EQ,"SKIPPED")],all:[]};else this._mFilters={success:[new a("status",o.EQ,"VALID")],inError:[new a("status",o.EQ,"INVALID")],all:[]};if(i==="inError"&&parseInt(r)>0){t.setProperty("/showExport",true)}else{t.setProperty("/showExport",false)}n.filter(this._mFilters[i]);this.onListUpdateFinished()},onSummaryListFinished:function(e){var t=e.getSource();t.removeSelections(true)},getFilteredCnt:function(e,t){var r=e.filter(e=>e.status===t);return r.length},onListUpdateFinished:function(e){var t,r=e.getParameter("total"),n=this.getModel("objectView"),a=e.getSource().getBinding("items"),o=this.byId("iconTabBar");this._sHeaderStatus=this.byId("detailStatusTxt").getText();var i=o.getSelectedKey();var s=a.getAllCurrentContexts();this._oAllCurrentObjs=s.map(e=>e.getObject());if(r&&a.isLengthFinal()){t=this.getResourceBundle().getText("detailLineItemTableHeadingCount",[r]);n.setProperty("/countAll",r);var l=0,d=0;if(this._sHeaderStatus.toUpperCase()==="APPROVED"){var l=this.getFilteredCnt(this._oAllCurrentObjs,"APPROVED");var d=this.getFilteredCnt(this._oAllCurrentObjs,"SKIPPED")}else{var l=this.getFilteredCnt(this._oAllCurrentObjs,"VALID");var d=this.getFilteredCnt(this._oAllCurrentObjs,"INVALID")}n.setProperty("/success",l);n.setProperty("/inError",d)}else{if(i==="success")t=this.getResourceBundle().getText("detailLineItemTableHeadingCount",[n.getProperty("/success")]);else if(i==="inError")t=this.getResourceBundle().getText("detailLineItemTableHeadingCount",[n.getProperty("/inError")]);else t=this.getResourceBundle().getText("detailLineItemTableHeading")}n.setProperty("/lineItemListTitle",t);sap.ui.core.BusyIndicator.hide()},onDownload:function(){var e=this.byId("lineItemsList").getBinding("items");var t=this;e.requestContexts(0,Infinity).then(function(e){var r=[];for(var n=0;n<e.length;n++){var a={FMNO:e[n].getObject().fmno,PAYROLLCODE:e[n].getObject().payrollCode,PAYROLLCODESEQUENCE:e[n].getObject().payrollCodeSequence,NAME:"",AMOUNT:parseFloat(e[n].getObject().amount).toFixed(2),PAYMENTNUMBER:e[n].getObject().paymentNumber,PAYMENTID:e[n].getObject().pyamentId,PAYMENTFORM:e[n].getObject().paymentForm,USERFIELD1:"",USERFIELD2:"",REMARKS:"",LOANADVANCEREFERENCENUMBER:e[n].getObject().loadAdvanceReferenceNumber,PROJECTCODE:e[n].getObject().projectCode,PROJECTTASK:e[n].getObject().projectTask,STATUSMESSAGE:e[n].getObject().statusMessage};r.push(a)}var o=t.convertToCSV(r);t.writeToCSV(o)})},writeToCSV:function(e){var t=new Blob([e],{type:"text/csv;charset=utf-8;"});if(navigator.msSaveBlob){navigator.msSaveBlob(t,exportedFilenmae)}else{var r=document.createElement("a");if(r.download!==undefined){var n=URL.createObjectURL(t);r.setAttribute("href",n);r.setAttribute("download","data.csv");r.style.visibility="hidden";document.body.appendChild(r);r.click();document.body.removeChild(r)}}},convertToCSV(e){const t=[Object.keys(e[0])].concat(e);return t.map(e=>Object.values(e).join(",").toString()).join("\n")},onSearch:function(e){if(e.getParameters().refreshButtonPressed){this.onRefresh()}else{var t=[];var r=e.getParameter("query");var n=new a("fmno",o.EQ,r);if(r&&r.length>0){t=n}this._applySearch(t)}},_applySearch:function(e){var t=this.byId("lineItemsList"),r=this.getModel("objectView");t.getBinding("items").filter(e,"Application");if(e.length!==0){r.setProperty("/tableNoDataText",this.getResourceBundle().getText("itemlistNoDataWithSearchText"))}},onRefresh:function(){var e=this.byId("lineItemsList");e.getBinding("items").refresh()},onPressApprove:function(e){if(this.byId("detailStatusTxt").getText()==="APPROVED"){var r="BATCH "+this._ID+" has been approved already";i.warning(r)}else{var n=new t({HTML:"<h3>Total Amount: 0</h3>"});this.setModel(n,"totalAmt");var a=this.getView();var o=this;var s=o._ID;var d=a.byId("snappedHeadingSubTitle").getText();var u=a.byId("companyCodeTxt").getText();var p=a.byId("currencyCodeTxt").getText();var c=a.byId("payrollDateTxt").getText();var g=a.byId("effectivePeriodTxt").getText();if(!o.byId("approveDialog")){l.load({id:a.getId(),name:"batchuploads.fragments.Approve",controller:o}).then(function(e){a.addDependent(e);a.byId("approvePageTitle").setText("Upload Batch "+s+" Summary");a.byId("approveDesc").setText(d);a.byId("aprroveCurrency").setText(p);a.byId("approveCompanyCode").setText(u);a.byId("approvePayrollDate").setText(c);a.byId("approveEffectivePeriod").setText(g);setTimeout(function(){o.createTotalTable()},500);var t=a.byId("approveBtn");e.setInitialFocus(t);e.open()})}else{o.byId("approveDialog").open()}}},createTotalTable:function(){var e=this.byId("approveSummaryList");var t=new sap.m.Column("col1",{width:"4rem",header:new sap.m.Label({text:""})});var r=new sap.m.Column("col2",{width:"4rem",header:new sap.m.Label({text:"Number of Lines"})});var n=new sap.m.Column("col3",{width:"4rem",header:new sap.m.Label({text:"Number of FMNO's"})});e.addColumn(t);e.addColumn(r);e.addColumn(n);e.bindItems("summaryView>/",new sap.m.ColumnListItem({cells:[new sap.m.Text({text:"{summaryView>rowHeader}"}),new sap.m.Text({text:"{summaryView>lineCnt}"}),new sap.m.Text({text:"{summaryView>fmnoCnt}"})]}))},onPressDelete:function(){var e=this.getView().getBindingContext();var t="Delete BATCH "+this._ID+" ?";var r=this;i.confirm(t,{title:"Confirm",actions:[i.Action.OK,i.Action.CANCEL],onClose:function(t){if(t===i.Action.OK){e.delete().then(function(){r.getRouter().navTo("worklist")})}}.bind(r)})},approveUploads:function(){var e=this.getView().getBindingContext().sPath;var t=this.getView().getModel().getHttpHeaders()["X-CSRF-Token"];var r={"content-type":"application/json","x-csrf-token":`${t}`};var n=this.byId("approveDialog");n.setBusy(true);var a=this;jQuery.ajax({url:"payroll"+e+"/approve",type:"POST",async:true,data:{},dataType:"json",headers:r,success:function(e){n.setBusy(false);var t="BATCH "+a._ID+" approved successfully!";i.success(t);a.closeApprovalDialog()},error:function(e){console.log(e.message)}});console.log("test")},closeApprovalDialog:function(){if(this.byId("approveDialog")){this.byId("approveDialog").close();this.byId("approveDialog").destroy()}},createColumnConfig:function(){var e=[];e.push({property:"FMNO",type:g.String});e.push({label:"Payroll Code",property:"payrollCode",type:g.String});e.push({label:"Payroll Code Sequence",property:"payrollCodeSequence",type:g.String});e.push({label:"Amount",property:"amount",type:g.String});e.push({label:"Cost Center",property:"glCostCenter",type:g.String});e.push({label:"Payment No",property:"paymentNumber",type:g.String});e.push({label:"Payment Id",property:"paymentId",type:g.String});e.push({label:"Payment Form",property:"paymentForm",type:g.String});e.push({label:"Load Advance Reference Number",property:"loanAdvanceReferenceNumber",type:g.String});e.push({label:"Project Code",property:"projectCode",type:g.String});e.push({label:"Project Task",property:"projectTask",type:g.String});e.push({label:"Status",property:"status",type:g.String});e.push({label:"Status Message",property:"statusMessage",type:g.String});return e},onExport:function(){var e,t,r,n;if(!this._oTable){this._oTable=this.byId("lineItemsList")}n=this._oTable;e=this.createColumnConfig();t={workbook:{columns:e,hierarchyLevel:"Level"},dataSource:n.getBinding("items"),fileName:"Table export sample.xlsx",worker:false};r=new u(t);r.build().finally(function(){r.destroy()})},doExport:function(e){var t=this.getColumns(e)},handleExport:function(e){var t=this.getView().byId("lineItemsList");this.doExport(t)},getColumns:function(e){console.log(this._errorData);var t=e.getColumns();var r=e.getItems();var n=[];for(var a=0;a<t.length;a++){var o={name:t[a].getHeader().getText(),template:{content:{path:null}}};if(r.length>0){o.template.content.path=r[0].getCells()[a].getBinding("text").getPath()}n.push(o)}return n},onDataExport:function(e){var t=this.getView().byId("lineItemsList");var r=new p({exportType:new c({fileExtension:"csv",separatorChar:";"}),models:this.getView().getModel(),rows:{path:t.getBinding("items").getPath()},columns:[{name:"FMNO",template:{content:"{fmno}"}}]});r.saveFile().catch(function(e){i.error("Error when downloading data. Browser might not be supported!\n\n"+e)}).then(function(){r.destroy()})}})});