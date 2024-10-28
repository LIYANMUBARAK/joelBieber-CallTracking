import express from 'express'
import { formSubmit, getForm, getPayload, viewTableData } from '../controllers/controller'
import { captureCode, formSubmission, getAccessToken, initiateAuth } from '../controllers/authController'
const router = express.Router()

router.get('/form',getForm)
router.get('/table',viewTableData)
router.post('/formSubmit',formSubmit)

router.get('/',getAccessToken)
router.get('/initiateAuth',initiateAuth)        //to initiate the connection and get the auth code
router.get('/capturecode',captureCode)
router.post('/submit',formSubmission)

router.post("/getpayload",getPayload)

export default router