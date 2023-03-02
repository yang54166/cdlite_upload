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
      "name": "cd_cdlitepayrollupload_f-api",
      "url": "https://erpdevorg-erpdevspccdapp-cd-cdlitepayrollupload-fs-srv.cfapps.eu10.hana.ondemand.com",
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
        "clientid": "<clientid>",
        "xsappname": "<xsappname>",
        "clientsecret": "<clientsecret>"
    }
}
```

Then you can start approuter (hybrid mode, uses local destination from default-env and UAA from cloud foundry).
In the /app/approuter folder
```
npm i
npm run start-local
```
