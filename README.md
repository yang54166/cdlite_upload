# Developer Setup

## CAP
To run can service locally (hybrid mode - uses CF HANA DB and UAA, but local CAP), need to run 
```
npm i
npm run login (to connect to cf)
npm run bind
npm run start-local
```


## APPROUTER
To run approuter locally, you need to create /app/approuter/default-env.json
```
{
  "destinations": [
    {
      "name": "srv-api",
      "url": "http://localhost:4004",
      "forwardAuthToken": true
    },
    {
      "name": "ui5",
      "url": "https://ui5.sap.com"
    }
  ]
}
```
and /app/approuter/default-services.json
```
{
    "uaa": {
        "url": "https://erpdevsd.authentication.eu10.hana.ondemand.com",
        "clientid": "sb-cd_compensationdetails_c-ErpDevOrg-ErpDevSpcCdApp!t126539",
        "xsappname": "cd_compensationdetails_c-ErpDevOrg-ErpDevSpcCdApp!t126539",
        "clientsecret": "<UAA Binding Client Secret>"
    }
}
```

Then you can start approuter (hybrid mode, uses local destination from default-env and UAA from cloud foundry).
In the /app/approuter folder
```
npm i
npm run start-local
```
