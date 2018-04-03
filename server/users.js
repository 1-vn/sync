'use strict'

const Express = require('express')
const requestVerifier = require('./lib/request-verifier.js')
const router = Express.Router()
const serializer = require('../lib/serializer.js')
const config = require('config')
// TODO: This returns a Promise; we may want to block requests until it resolves
serializer.init()

const UserAwsCredentialGenerator = require('./lib/user-aws-credential-generator')
const UserAwsS3PostAuthenticator = require('./lib/user-aws-s3-post-authenticator')
const UserAwsS3BucketConfiguration = require('./lib/user-aws-s3-bucket-configuration')

const BUCKET = config.awsS3Bucket
const REGION = config.awsRegion

router.param('userId', requestVerifier)

// Generate temporary AWS credentials allowing user to access their Sync data.
router.post('/:userId/credentials', (request, response) => {
  const credentialPromise = new UserAwsCredentialGenerator(request.userId, BUCKET).perform()
  const postAuthenticatorPromise = new Promise((resolve, reject) => {
    try {
      const s3PostParams = new UserAwsS3PostAuthenticator(request.userId, BUCKET).perform()
      resolve(s3PostParams)
    } catch (exception) {
      reject(exception)
    }
  })

  Promise.all([credentialPromise, postAuthenticatorPromise])
    .then(([aws, s3Post]) => {
      const serialized = serializer.serializer.credentialsToByteArray({aws, s3Post, bucket: BUCKET, region: REGION})
      response.send(serialized)
    })
    .catch((error) => { response.send(error) })
})

// Put s3 bucket notification configuration.
router.post('/:userId/:topicARN/:prefix/bucket_notification', (request, response) => {
  new UserAwsS3BucketConfiguration(request.userId, BUCKET, request.topicARN, request.prefix).perform()
    .then((data) => {
      response.status(200)
      response.send('')
    })
})

router.get('/', (_request, response) => {
  response.send('☁️🎬✌️')
})

module.exports = router
