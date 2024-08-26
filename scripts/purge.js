const Refresher = require(`tencent-cdn-refresh`)

const refresher = new Refresher({
  SecretId: process.env.TENCENT_SEC_ID,
  SecretKey: process.env.TENCENT_SEC_KEY,
})

refresher.purgeDirsCache(process.env.DOMAIN).then((resp) => {
  console.log(`purge resp: `, resp)
})
