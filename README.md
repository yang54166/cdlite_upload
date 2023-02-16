# Developer Setup

To run approuter locally, you need to create /app/approuter/default-env.json
```
{
  "destinations": [
    {
      "name": "srv-api",
      "url": "http://localhost:4004",
      "forwardAuthToken": true
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