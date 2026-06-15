const cloud = require('wx-server-sdk')
const https = require('https')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

// 企业微信 Webhook
const WECOM_WEBHOOK = 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=6c88fc3a-577d-4d74-acc5-6349a5b128e9'

function postWebhook(data) {
  return new Promise((resolve, reject) => {
    const url = new URL(WECOM_WEBHOOK)
    const payload = JSON.stringify(data)
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    }
    const req = https.request(options, (res) => {
      let body = ''
      res.on('data', chunk => body += chunk)
      res.on('end', () => resolve(JSON.parse(body)))
    })
    req.on('error', reject)
    req.write(payload)
    req.end()
  })
}

exports.main = async (event, context) => {
  const now = new Date()
  const timeStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`

  const browser = event.browser || '未知'
  const os = event.os || '未知'

  try {
    // 1. 写入数据库记录
    const dbResult = await db.collection('register_logs').add({
      data: {
        time: timeStr,
        browser: browser,
        os: os,
        createdAt: db.serverDate()
      }
    })
    console.log('数据库写入成功:', dbResult._id)
  } catch (dbErr) {
    console.error('数据库写入失败:', dbErr)
  }

  // 2. 发送企业微信通知
  const wecomPayload = {
    msgtype: 'markdown',
    markdown: {
      content: `### 📬 美羊新手向导通知\n> **有人点击了「前往注册」**\n\n**时间：** ${timeStr}\n**浏览器：** ${browser}\n**系统：** ${os}\n**页面：** 美羊AI学习力系统新手向导`
    }
  }

  try {
    const wecomResult = await postWebhook(wecomPayload)
    console.log('企业微信推送成功:', JSON.stringify(wecomResult))
  } catch (wecomErr) {
    console.error('企业微信推送失败:', wecomErr)
  }

  return {
    success: true,
    time: timeStr,
    message: '通知已发送'
  }
}
