2026-01-09 08:55:02.362 http [HTTP] → POST /api/v1/establishments
{
"correlationId": "48e1b7ff-71f9-4c2c-922e-ea57bde21085",
"userId": "6960ab833c50312c1e3500b7",
"method": "POST",
"path": "/api/v1/establishments"
}
[Nest] 21352 - 09/01/2026, 08:55:02 DEBUG [EstablishmentsController] Received createEstablishmentDto:
[Nest] 21352 - 09/01/2026, 08:55:02 DEBUG [EstablishmentsController] {
"name": "movenpick",
"description": "A great place to get surplus food at discounted prices",
"type": "hotel",
"address": {
"street": "kantoui sousse zone touristique",
"city": "sousse",
"postalCode": "4013",
"country": "tunisia",
"coordinates": {
"type": "Point",
"coordinates": [
"10.62796",
"35.84159"
]
}
},
"phoneNumber": "24201314",
"email": "restaurant@example.com"
}
[Nest] 21352 - 09/01/2026, 08:55:02 DEBUG [EstablishmentsController] Received files: 1
[Nest] 21352 - 09/01/2026, 08:55:02 DEBUG [EstablishmentsController] File details: [{"originalname":"social.png","mimetype":"image/png","size":733457}]
[Nest] 21352 - 09/01/2026, 08:55:02 LOG [FirebaseStorageService] ✅ Firebase Storage initialized with bucket: waste-food-d479c.appspot.com[Nest] 21352 - 09/01/2026, 08:55:03 ERROR [FirebaseStorageService] ❌ Failed to upload file:
[Nest] 21352 - 09/01/2026, 08:55:03 ERROR [FirebaseStorageService] GaxiosError: {
"error": {
"code": 404,
"message": "The specified bucket does not exist.",
"errors": [
{
"message": "The specified bucket does not exist.",
"domain": "global",
"reason": "notFound"
}
]
}
}

    at Gaxios._request (C:\WFA\node_modules\.pnpm\gaxios@6.7.1\node_modules\gaxios\src\gaxios.ts:146:15)
    at process.processTicksAndRejections (node:internal/process/task_queues:103:5)
    at async JWT.requestAsync (C:\WFA\node_modules\.pnpm\google-auth-library@9.15.1\node_modules\google-auth-library\build\src\auth\oauth2client.js:429:18)
    at async Upload.makeRequest (C:\WFA\node_modules\.pnpm\@google-cloud+storage@7.17.2\node_modules\@google-cloud\storage\build\cjs\src\resumable-upload.js:769:21)
    at async uri.retries (C:\WFA\node_modules\.pnpm\@google-cloud+storage@7.17.2\node_modules\@google-cloud\storage\build\cjs\src\resumable-upload.js:435:29)
    at async Upload.createURIAsync (C:\WFA\node_modules\.pnpm\@google-cloud+storage@7.17.2\node_modules\@google-cloud\storage\build\cjs\src\resumable-upload.js:432:21) {

config: {
method: 'POST',
url: 'https://storage.googleapis.com/upload/storage/v1/b/waste-food-d479c.appspot.com/o?name=establishments%2Fsocial_1767945302733_b1cac63c.jpg&uploadType=resumable&predefinedAcl=publicRead',
params: {
name: 'establishments/social_1767945302733_b1cac63c.jpg',
uploadType: 'resumable',
predefinedAcl: 'publicRead'
},
data: {
metadata: {
originalName: 'social.png',
uploadedAt: '2026-01-09T07:55:02.734Z',
uploadedBy: '6960ab833c50312c1e3500b7',
category: 'establishment-image',
establishmentName: 'movenpick',
establishmentType: 'hotel'
}
},
headers: {
'User-Agent': 'gcloud-node-storage/7.17.2 google-api-nodejs-client/9.15.1',
'x-goog-api-client': 'gl-node/24.11.1 gccl/7.17.2-CJS gccl-invocation-id/e85a0ebc-c9c4-46dc-a0f6-67e12855c478',
'X-Upload-Content-Type': 'image/jpeg',
Authorization: '<<REDACTED> - See `errorRedactor` option in `gaxios` for configuration>.',
'Content-Type': 'application/json'
},
validateStatus: [Function (anonymous)],
paramsSerializer: [Function: paramsSerializer],
body: '{"metadata":{"originalName":"social.png","uploadedAt":"2026-01-09T07:55:02.734Z","uploadedBy":"6960ab833c50312c1e3500b7","category":"establishment-image","establishmentName":"movenpick","establishmentType":"hotel"}}',
responseType: 'unknown',
errorRedactor: [Function: defaultErrorRedactor]
},
response: {
config: {
method: 'POST',
url: 'https://storage.googleapis.com/upload/storage/v1/b/waste-food-d479c.appspot.com/o?name=establishments%2Fsocial_1767945302733_b1cac63c.jpg&uploadType=resumable&predefinedAcl=publicRead',
params: {
name: 'establishments/social_1767945302733_b1cac63c.jpg',
uploadType: 'resumable',
predefinedAcl: 'publicRead'
},
data: {
metadata: {
originalName: 'social.png',
uploadedAt: '2026-01-09T07:55:02.734Z',
uploadedBy: '6960ab833c50312c1e3500b7',
category: 'establishment-image',
establishmentName: 'movenpick',
establishmentType: 'hotel'
}
},
headers: {
'User-Agent': 'gcloud-node-storage/7.17.2 google-api-nodejs-client/9.15.1',
'x-goog-api-client': 'gl-node/24.11.1 gccl/7.17.2-CJS gccl-invocation-id/e85a0ebc-c9c4-46dc-a0f6-67e12855c478',
'X-Upload-Content-Type': 'image/jpeg',
Authorization: '<<REDACTED> - See `errorRedactor` option in `gaxios` for configuration>.',
'Content-Type': 'application/json'
},
validateStatus: [Function (anonymous)],
paramsSerializer: [Function: paramsSerializer],
body: '{"metadata":{"originalName":"social.png","uploadedAt":"2026-01-09T07:55:02.734Z","uploadedBy":"6960ab833c50312c1e3500b7","category":"establishment-image","establishmentName":"movenpick","establishmentType":"hotel"}}',
responseType: 'unknown',
errorRedactor: [Function: defaultErrorRedactor]
},
data: '{\n "error": {\n "code": 404,\n "message": "The specified bucket does not exist.",\n "errors": [\n {\n "message": "The specified bucket does not exist.",\n "domain": "global",\n "reason": "notFound"\n }\n ]\n }\n}\n',
headers: {
'alt-svc': 'h3=":443"; ma=2592000,h3-29=":443"; ma=2592000',
'cache-control': 'no-cache, no-store, max-age=0, must-revalidate',
'content-length': '247',
'content-type': 'text/html; charset=UTF-8',
date: 'Fri, 09 Jan 2026 07:55:04 GMT',
expires: 'Mon, 01 Jan 1990 00:00:00 GMT',
pragma: 'no-cache',
server: 'UploadServer',
vary: 'Origin, X-Origin',
'x-guploader-uploadid': 'AHVrFxOAauIr-hh_nRMSLrZBjmOshhjs6yHmZOm5PcYdR7ujSfkWXOvhrNXtP85grr54XpnfYgSczy1QQ5Lp2Vp_kImWoLSRPJYrKeg-IzzjeA'
},
status: 404,
statusText: 'Not Found',
request: {
responseURL: 'https://storage.googleapis.com/upload/storage/v1/b/waste-food-d479c.appspot.com/o?name=establishments%2Fsocial_1767945302733_b1cac63c.jpg&uploadType=resumable&predefinedAcl=publicRead'
}
},
error: undefined,
status: 404,
Symbol(gaxios-gaxios-error): '6.7.1'
}
[Nest] 21352 - 09/01/2026, 08:55:03 ERROR [FirebaseStorageService] Failed to upload file 1:
[Nest] 21352 - 09/01/2026, 08:55:03 ERROR [FirebaseStorageService] InternalServerErrorException: File upload failed: {
"error": {
"code": 404,
"message": "The specified bucket does not exist.",
"errors": [
{
"message": "The specified bucket does not exist.",
"domain": "global",
"reason": "notFound"
}
]
}
}

    at FirebaseStorageService.uploadFile (C:\WFA\apps\food-waste-backend\src\common\services\firebase-storage.service.ts:157:13)
    at process.processTicksAndRejections (node:internal/process/task_queues:103:5)
    at async Promise.allSettled (index 0)
    at async FirebaseStorageService.uploadFiles (C:\WFA\apps\food-waste-backend\src\common\services\firebase-storage.service.ts:175:23)
    at async EstablishmentsController.create (C:\WFA\apps\food-waste-backend\src\establishments\establishments.controller.ts:105:39) {

response: {
message: 'File upload failed: {\n "error": {\n "code": 404,\n "message": "The specified bucket does not exist.",\n "errors": [\n
{\n "message": "The specified bucket does not exist.",\n "domain": "global",\n "reason": "notFound"\n }\n ]\n }\n}\n',
error: 'Internal Server Error',
statusCode: 500
},
status: 500,
options: {}
}
[Nest] 21352 - 09/01/2026, 08:55:03 WARN [FirebaseStorageService] Some files failed to upload: File 1: File upload failed: {
"error": {
"code": 404,
"message": "The specified bucket does not exist.",
"errors": [
{
"message": "The specified bucket does not exist.",
"domain": "global",
"reason": "notFound"
}
]
}
}

[Nest] 21352 - 09/01/2026, 08:55:03 LOG [FirebaseStorageService] ✅ Uploaded 0/1 files successfully
[Nest] 21352 - 09/01/2026, 08:55:03 DEBUG [EstablishmentsController] Uploaded 0 images for establishment
[Nest] 21352 - 09/01/2026, 08:55:04 DEBUG [EstablishmentsController] Establishment created successfully:
[Nest] 21352 - 09/01/2026, 08:55:04 DEBUG [EstablishmentsController] {
"name": "movenpick",
"description": "A great place to get surplus food at discounted prices",
"ownerId": "6960ab833c50312c1e3500b7",
"type": "hotel",
"status": "pending",
"address": {
"street": "kantoui sousse zone touristique",
"city": "sousse",
"postalCode": "4013",
"country": "tunisia",
"coordinates": {
"type": "Point",
"coordinates": [
10.62796,
35.84159
]
},
"\_id": "6960b4576e2c9a783c053711"
},
"phoneNumber": "24201314",
"email": "restaurant@example.com",
"images": [],
"cuisineTypes": [],
"averageRating": 0,
"totalReviews": 0,
"totalOffers": 0,
"completedOrders": 0,
"isActive": true,
"isVerified": false,
"acceptsReservations": false,
"metadata": {
"scheduledReactivation": {
"status": "pending"
},
"\_id": "6960b4576e2c9a783c05370f"
},
"isDeleted": false,
"\_id": "6960b4576e2c9a783c053710",
"createdAt": "2026-01-09T07:55:03.914Z",
"updatedAt": "2026-01-09T07:55:03.914Z",
"\_\_v": 0
}
2026-01-09 08:55:04.159 http [HTTP] ✓ POST /api/v1/establishments 201 - 1868ms
{
"correlationId": "48e1b7ff-71f9-4c2c-922e-ea57bde21085",
"userId": "6960ab833c50312c1e3500b7",
"method": "POST",
"path": "/api/v1/establishments",
"statusCode": 201,
"duration": 1868
}
