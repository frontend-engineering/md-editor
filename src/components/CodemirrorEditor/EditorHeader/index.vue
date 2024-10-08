<!-- eslint-disable unicorn/prefer-dom-node-text-content -->
<!-- eslint-disable antfu/top-level-function -->
<script setup>
import { computed, nextTick, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { ElNotification } from 'element-plus'
import CodeMirror from 'codemirror'

import PostInfo from './PostInfo.vue'
import FileDropdown from './FileDropdown.vue'
import HelpDropdown from './HelpDropdown.vue'
import StyleDropdown from './StyleDropdown.vue'
import EditDropdown from './EditDropdown.vue'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

import { mergeCss, solveWeChatImage } from '@/utils'
import { useStore } from '@/stores'

const emit = defineEmits([
  `addFormat`,
  `formatContent`,
  `startCopy`,
  `endCopy`,
])
async function sleep(timeout) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(``)
    }, timeout || 3000)
  })
}
const loading = ref(false)
const haltPosting = ref(false)
const countDown = ref(10)

const defaultKeyMap = CodeMirror.keyMap.default
const modPrefix
  = defaultKeyMap === CodeMirror.keyMap.macDefault ? `Cmd` : `Ctrl`

const formatItems = [
  {
    label: `加粗`,
    kbd: `${modPrefix} + B`,
    emitArgs: [`addFormat`, `${modPrefix}-B`],
  },
  {
    label: `斜体`,
    kbd: `${modPrefix} + I`,
    emitArgs: [`addFormat`, `${modPrefix}-I`],
  },
  {
    label: `删除线`,
    kbd: `${modPrefix} + D`,
    emitArgs: [`addFormat`, `${modPrefix}-D`],
  },
  {
    label: `超链接`,
    kbd: `${modPrefix} + K`,
    emitArgs: [`addFormat`, `${modPrefix}-K`],
  },
  {
    label: `行内代码`,
    kbd: `${modPrefix} + E`,
    emitArgs: [`addFormat`, `${modPrefix}-E`],
  },
  {
    label: `格式化`,
    kbd: `${modPrefix} + F`,
    emitArgs: [`formatContent`],
  },
]

const store = useStore()
// const { output, editor, editorContent, isShowCssEditor } = storeToRefs(store)
const {
  isDark,
  isCiteStatus,
  output,
  editor,
  editorContent,
} = storeToRefs(store)

const {
  toggleDark,
  editorRefresh,
  citeStatusChanged,
} = store

async function auth() {
  const search = new URLSearchParams(window.location.search)
  const user = search.get(`user`)
  const pw = search.get(`pw`)
  return fetch(`https://api.webinfra.cloud/cms-admin-api/user/login`, {
    method: `POST`,
    headers: {
      'Content-Type': `application/json`,
    },
    body: JSON.stringify({
      username: import.meta.env.VITE_CMS_USER || user,
      password: import.meta.env.VITE_CMS_PW || pw,
    }),
  }).then(resp => resp.json())
    .then((resp) => {
      console.log(`auth resp: `, resp)
      return resp?.at.token
    })
}

async function getRandomImgs() {
  const token = await auth()
  if (!token)
    return
  return fetch(`https://api.webinfra.cloud/cms-admin-api/apps/getRandomImages?tag=warehouse&count=1`, {
    method: `GET`,
    headers: {
      'Content-Type': `application/json`,
      'Authorization': `Bearer ${token}`,
    },
  })
    .then(resp => resp.json())
    .then((resp) => {
      console.log(`get remote images: `, resp)
      return resp?.map(img => img?.urls?.regular?.replace(`assets-1306445775.cos.ap-shanghai.myqcloud.com`, `assets.greatermaker.cn`))
    })
}

async function loadRmoteByChannel(channel) {
  let method = '',promotion = '',promotionDetail = ''
  if(channel === 'zhihu') {
    method = 'zhihuUnpublishedPost'
    promotion = '更多详情请关注<span><a href=\"https://wms.webinfra.cloud?from=zhihu\"><b>只冲WMS官网</b></a></span>'
  } else {
    method = 'baijiahaoUnpublishedPost'
    promotion = '更多详情请关注只冲WMS官网[https://wms.webinfra.cloud?from=baijiahao](https://wms.webinfra.cloud?from=baijiahao)'
  }
  promotionDetail = `**关于只冲WMS**\n\n只冲WMS在仓储行业拥有多年的洞察经验，以及十年以上的信息技术积累，致力于为仓储企业的管理者、员工、合作伙伴提供强大高效的仓库管理系统。${promotion}`
  const postPromise = fetch(`https://my.webinfra.cloud/api/${method}`)
    .then(response => response.json())
  return Promise.all([getRandomImgs(), postPromise])
    .then(async (resp) => {
      const [urls, postData] = resp
      const searchText = "关于只冲WMS"
      console.log(`loadRmoteByChannel: `, channel, urls, postData)
      if (!postData)
        return null
      const { content: apiResponseText, title, id } = postData
      const editorDom = document.querySelector(`#editor`)
      const captainImg = `\n\n ![${title}](${urls[0]})`
      if (apiResponseText.includes(searchText)) {
        editorDom.value = `# ${title}${captainImg}\n\n${apiResponseText}\n\n${promotion}\n\n`
      } else {
        editorDom.value = `# ${title}${captainImg}\n\n${apiResponseText}\n\n${promotionDetail}\n\n`
      }
      // const editor = CodeMirror.fromTextArea(editorDom, {})
      // editor.value = `fdsafdsafds`
      editor.value = CodeMirror.fromTextArea(editorDom, {
        mode: `text/x-markdown`,
        theme: `xq-light`,
        lineNumbers: false,
        lineWrapping: true,
        styleActiveLine: true,
        autoCloseBrackets: true,
        extraKeys: {
          [`${modPrefix}-F`]: function autoFormat(editor) {
            const doc = formatDoc(editor.getValue(0))
            editor.setValue(doc)
          },
          [`${modPrefix}-B`]: function bold(editor) {
            const selected = editor.getSelection()
            editor.replaceSelection(`**${selected}**`)
          },
          [`${modPrefix}-I`]: function italic(editor) {
            const selected = editor.getSelection()
            editor.replaceSelection(`*${selected}*`)
          },
          [`${modPrefix}-D`]: function del(editor) {
            const selected = editor.getSelection()
            editor.replaceSelection(`~~${selected}~~`)
          },
          [`${modPrefix}-K`]: function italic(editor) {
            const selected = editor.getSelection()
            editor.replaceSelection(`[${selected}]()`)
          },
          [`${modPrefix}-E`]: function code(editor) {
            const selected = editor.getSelection()
            editor.replaceSelection(`\`${selected}\``)
          },
          // 预备弃用
          [`${modPrefix}-L`]: function code(editor) {
            const selected = editor.getSelection()
            editor.replaceSelection(`\`${selected}\``)
          },
        },
      })

      editorContent.value = editor.value
      await editorRefresh()
      return id
    })
}

async function loadRemote(isTuwen) {
  const postPromise = fetch(`https://my.webinfra.cloud/api/${isTuwen ? `publishedOncePost` : `rewritedButUnpublishedPost`}`)
    .then(response => response.json())
  return Promise.all([isTuwen ? Promise.resolve([]) : getRandomImgs(), postPromise])
    .then(async (resp) => {
      const [urls, postData] = resp
      console.log(`load remote data: `, urls, postData)
      if (!postData)
        return null
      const { content: apiResponseText, title, id } = postData
      const editorDom = document.querySelector(`#editor`)
      const captainImg = `\n\n ![${title}](${urls[0]})`
      editorDom.value = `# ${title}${isTuwen ? `` : captainImg}\n\n${apiResponseText}`
      // const editor = CodeMirror.fromTextArea(editorDom, {})
      // editor.value = `fdsafdsafds`
      editor.value = CodeMirror.fromTextArea(editorDom, {
        mode: `text/x-markdown`,
        theme: `xq-light`,
        lineNumbers: false,
        lineWrapping: true,
        styleActiveLine: true,
        autoCloseBrackets: true,
        extraKeys: {
          [`${modPrefix}-F`]: function autoFormat(editor) {
            const doc = formatDoc(editor.getValue(0))
            editor.setValue(doc)
          },
          [`${modPrefix}-B`]: function bold(editor) {
            const selected = editor.getSelection()
            editor.replaceSelection(`**${selected}**`)
          },
          [`${modPrefix}-I`]: function italic(editor) {
            const selected = editor.getSelection()
            editor.replaceSelection(`*${selected}*`)
          },
          [`${modPrefix}-D`]: function del(editor) {
            const selected = editor.getSelection()
            editor.replaceSelection(`~~${selected}~~`)
          },
          [`${modPrefix}-K`]: function italic(editor) {
            const selected = editor.getSelection()
            editor.replaceSelection(`[${selected}]()`)
          },
          [`${modPrefix}-E`]: function code(editor) {
            const selected = editor.getSelection()
            editor.replaceSelection(`\`${selected}\``)
          },
          // 预备弃用
          [`${modPrefix}-L`]: function code(editor) {
            const selected = editor.getSelection()
            editor.replaceSelection(`\`${selected}\``)
          },
        },
      })

      editorContent.value = editor.value
      await editorRefresh()
      return id
    })
}

async function doSubmit(article) {
  function getPost(tuwen) {
    const post = { article }
    post.title = article.title
    if (article.content) {
      if (tuwen) {
        const parser = new DOMParser()
        const doc = parser.parseFromString(article.content, `text/html`)
        console.log(`parsed doc: `, doc)
        console.log(`parsed doc: `, doc.body, doc?.body.innerText)
        const txt = doc?.body?.innerText.slice(0, 900)
        post.content = `${txt} 阅读更多...`
        // post.thumb = `https://assets.greatermaker.cn/images/unsplash-photo-1590496793929-36417d3117de-regular.jpeg`
      }
      else {
        post.content = article.content
      }
    }
    else if (article.markdown) {
      post.markdown = article.content
    }
    if (article.thumb) {
      post.thumb = article.thumb
    }

    post.desc = article.desc
      ? article.desc
      : article.content.substring(0, 20)
    // post.desc = document.body.getAttribute('data-msg_desc');
    post.isTuWenType = !!tuwen
    console.log(post)
    return post
  }

  function getPostByChannel(channel) {
    const post = { article }
    post.title = article.title
    if (article.content) {
      post.content = article.content
    }
    else if (article.markdown) {
      post.markdown = article.content
    }
    if (article.thumb) {
      post.thumb = article.thumb
    }

    post.desc = article.desc
      ? article.desc
      : article.content.substring(0, 20)
    // post.desc = document.body.getAttribute('data-msg_desc');
    console.log('getPostByChannel: ', post)
    return post
  }

  const getSelectedAc = async () => {
    return new Promise((resolve) => {
      window.$syncer.getAccounts((resp) => {
        console.log(`allAccounts`, resp)
        resolve(resp)
      })
    }).then(list => list.filter(item => item.type === `weixin`))
  }

  const getSelectedAcByChannel = async (channel) => {
    console.log('---getSelectedAcByChannel: ', channel)
    return new Promise((resolve) => {
      window.$syncer.getAccounts((resp) => {
        console.log(`getSelectedAcByChannel allAccounts`, resp)
        resolve(resp)
      })
    }).then(list => list.filter(item => item.type === channel))
  }

  let selectedAc
  if (article.channel) {
    selectedAc = await getSelectedAcByChannel(article.channel)
  } else {
    selectedAc = await getSelectedAc()
  }
  //const selectedAc = await getSelectedAc()

  return new Promise((resolve) => {
    window.$syncer.addTask(
      {
        post: article.channel ? getPostByChannel(article.channel) : getPost(article?.isTuwen),
        accounts: selectedAc,
      },
      (status) => {
        console.log(`status1 - `, status)
        if (status?.status === `done`) {
          resolve(status)
        }
        else if (status?.status !== `uploading`) {
          rejects(status)
        }
      },
      () => {
        console.log(`send`)
      },
    )
  })
}

async function loadRemoteAndPostZhihu() {
  return loadRemoteAndPostByChannel('zhihu')
}

async function loadRemoteAndPostZhihuInARow() {
  return loadRemoteAndPostByChannelInARow('zhihu')
}

async function loadRemoteAndPostBaijiahao() {
  return loadRemoteAndPostByChannel('baijiahao')
}

async function loadRemoteAndPostBaijiahaoInARow() {
  return loadRemoteAndPostByChannelInARow('baijiahao')
}

async function loadRemoteAndPostTuwen() {
  return loadRemoteAndPost(true)
}

async function loadRemoteAndPostByChannel(channel) {
  loading.value = true
  try {
    const postId = await loadRmoteByChannel(channel)
    if (!postId) {
      // all post published
      haltPosting.value = true
    }
    await sleep(1000)

    const auto = {
      thumb: document.querySelector(`#output img`)?.src,
      title: [1, 2, 3, 4, 5, 6]
        .map(h => document.querySelector(`#output h${h}`))
        .filter(h => h)[0].textContent,
      desc: document.querySelector(`#output p`)?.textContent
      || document.querySelector(`#output h2`)?.textContent || ``,
      content: output.value,
    }
    console.log(`sync auto: `, auto)
    await doSubmit({
      thumb: auto.thumb,
      title: auto.title,
      desc: auto.desc,
      content: auto.content,
      channel,
    })
    let method = '', channelName = ''
    if (channel === 'zhihu') {
      method = 'zhihuPublish'
      channelName = '知乎'
    } else {
      method = 'baijiahaoPublish'
      channelName = '百家号'
    }
    return fetch(`https://my.webinfra.cloud/api/post/${postId}/${method}`, {
      method: `POST`,
      headers: {
        'Content-Type': `application/json`,
      },
    })
      .then(response => response.json())
      .then((resp) => {
        console.log(`publish resp: `, resp)
        loading.value = false

        ElNotification({
          title: `${channelName}消息发布成功`,
          message: `${resp.id} 成功发布到${channelName}草稿箱`,
          type: `success`,
        })
      })
  }
  catch (error) {
    console.error(`catched: `, error)
    loading.value = false
  }
}

async function loadRemoteAndPost(isTuwen) {
  loading.value = true
  try {
    const postId = await loadRemote(isTuwen)
    if (!postId) {
      // all post published
      haltPosting.value = true
    }
    await sleep(1000)

    const auto = {
      thumb: document.querySelector(`#output img`)?.src,
      title: [1, 2, 3, 4, 5, 6]
        .map(h => document.querySelector(`#output h${h}`))
        .filter(h => h)[0].textContent,
      desc: document.querySelector(`#output p`)?.textContent
      || document.querySelector(`#output h2`)?.textContent || ``,
      content: output.value,
    }
    console.log(`sync auto: `, auto)
    await doSubmit({
      thumb: auto.thumb,
      title: auto.title,
      desc: auto.desc,
      content: auto.content,
      isTuwen,
    })
    return fetch(`https://my.webinfra.cloud/api/post/${postId}/${isTuwen ? `tuwenPublish` : `publish`}`, {
      method: `POST`,
      headers: {
        'Content-Type': `application/json`,
      },
    })
      .then(response => response.json())
      .then((resp) => {
        console.log(`publish resp: `, resp)
        loading.value = false

        ElNotification({
          title: `${isTuwen ? `图文消息` : `消息`}发布成功`,
          message: `${resp.id} 成功发布到微信草稿箱`,
          type: `success`,
        })
      })
  }
  catch (error) {
    console.error(`catched: `, error)
    loading.value = false
  }
  return
  window.syncPost({
    thumb: auto.thumb,
    title: auto.title,
    desc: auto.desc,
    content: auto.content,
  })
  return
  const container = document.querySelector(`.header-container`)
  const postBtn = container.children[5]
  console.log(`post btn: `, postBtn)
  postBtn.click()

  // 点击发布
  await sleep(1000)
  const confirmBtn = document.querySelectorAll(`div[aria-label='发布'] .el-dialog__footer > button`)[1]
  confirmBtn.click()

  // 选择微信channel
  await sleep(1000)
  const accountList = [...document.querySelector(`.all-pubaccounts`).children]
  const account = accountList.find(item => item.querySelector(`span > img`).src === `https://mp.weixin.qq.com/favicon.ico`)
  console.log(`accoutn `, account)
  if (!account)
    return
  account.querySelector(`span`).click()

  // 点击同步
  const syncBtn = document.querySelector(`div[aria-label='同步文章'] .el-dialog__footer button`)
  syncBtn.click()
}

async function loadRemoteAndPostInARow(isTuwen) {
  haltPosting.value = false
  while (!haltPosting.value) {
    await loadRemoteAndPost(isTuwen)
    countDown.value -= 1
    console.log(`-----count down: `, countDown.value)
    if (countDown.value <= 0) {
      haltPosting.value = true
      loading.value = false
      countDown.value = 10
      console.log('自动发布每次只能发布十篇文章，结束后请再次点击自动发布')
    }
    await sleep(1000)
  }
}

async function loadRemoteAndPostTuwenInARow() {
  return loadRemoteAndPostInARow(true)
}

async function loadRemoteAndPostByChannelInARow(channel) {
  haltPosting.value = false
  while (!haltPosting.value) {
    await loadRemoteAndPostByChannel(channel)
    countDown.value -= 1
    console.log(`-----count down: `, countDown.value)
    if (countDown.value <= 0) {
      haltPosting.value = true
      loading.value = false
      countDown.value = 10
      console.log('自动发布每次只能发布十篇文章，结束后请再次点击自动发布')
    }
    await sleep(1000)
  }
}

// async function inputTxt() {
//   const txt = await navigator.clipboard.readText()
//   const editorDom = document.querySelector(`#editor`)
//   editorDom.value = txt
//   // const editor = CodeMirror.fromTextArea(editorDom, {})
//   // editor.value = `fdsafdsafds`
//   editor.value = CodeMirror.fromTextArea(editorDom, {
//     mode: `text/x-markdown`,
//     theme: `xq-light`,
//     lineNumbers: false,
//     lineWrapping: true,
//     styleActiveLine: true,
//     autoCloseBrackets: true,
//     extraKeys: {
//       [`${modPrefix}-F`]: function autoFormat(editor) {
//         const doc = formatDoc(editor.getValue(0))
//         editor.setValue(doc)
//       },
//       [`${modPrefix}-B`]: function bold(editor) {
//         const selected = editor.getSelection()
//         editor.replaceSelection(`**${selected}**`)
//       },
//       [`${modPrefix}-I`]: function italic(editor) {
//         const selected = editor.getSelection()
//         editor.replaceSelection(`*${selected}*`)
//       },
//       [`${modPrefix}-D`]: function del(editor) {
//         const selected = editor.getSelection()
//         editor.replaceSelection(`~~${selected}~~`)
//       },
//       [`${modPrefix}-K`]: function italic(editor) {
//         const selected = editor.getSelection()
//         editor.replaceSelection(`[${selected}]()`)
//       },
//       [`${modPrefix}-E`]: function code(editor) {
//         const selected = editor.getSelection()
//         editor.replaceSelection(`\`${selected}\``)
//       },
//       // 预备弃用
//       [`${modPrefix}-L`]: function code(editor) {
//         const selected = editor.getSelection()
//         editor.replaceSelection(`\`${selected}\``)
//       },
//     },
//   })

//   editorContent.value = editor.value
//   editorRefresh()
// }

// 复制到微信公众号
function copy() {
  emit(`startCopy`)
  setTimeout(() => {
    function modifyHtmlStructure(htmlString) {
      // 创建一个 div 元素来暂存原始 HTML 字符串
      const tempDiv = document.createElement(`div`)
      tempDiv.innerHTML = htmlString

      const originalItems = tempDiv.querySelectorAll(`li > ul, li > ol`)

      originalItems.forEach((originalItem) => {
        originalItem.parentElement.insertAdjacentElement(
          `afterend`,
          originalItem,
        )
      })

      // 返回修改后的 HTML 字符串
      return tempDiv.innerHTML
    }

    // 如果是深色模式，复制之前需要先切换到白天模式
    const isBeforeDark = isDark.value
    if (isBeforeDark) {
      toggleDark()
    }

    nextTick(() => {
      solveWeChatImage()

      const clipboardDiv = document.getElementById(`output`)
      clipboardDiv.innerHTML = mergeCss(clipboardDiv.innerHTML)
      clipboardDiv.innerHTML = modifyHtmlStructure(clipboardDiv.innerHTML)

      // 调整 katex 公式元素为行内标签，目的是兼容微信公众号渲染
      clipboardDiv.innerHTML = clipboardDiv.innerHTML
        .replace(
          /class="base"( style="display: inline")*/g,
          `class="base" style="display: inline"`,
        )
      // 公众号不支持 position， 转换为等价的 translateY
        .replace(/top:(.*?)em/g, `transform: translateY($1em)`)
      // 适配主题中的颜色变量
        .replaceAll(`var(--el-text-color-regular)`, `#3f3f3f`)
      clipboardDiv.focus()
      window.getSelection().removeAllRanges()
      const range = document.createRange()

      range.setStartBefore(clipboardDiv.firstChild)
      range.setEndAfter(clipboardDiv.lastChild)
      window.getSelection().addRange(range)
      document.execCommand(`copy`)
      window.getSelection().removeAllRanges()
      clipboardDiv.innerHTML = output.value

      if (isBeforeDark) {
        nextTick(() => toggleDark())
      }

      // 输出提示
      ElNotification({
        showClose: true,
        message: `已复制渲染后的文章到剪贴板，可直接到公众号后台粘贴`,
        offset: 80,
        duration: 1600,
        type: `success`,
      })

      editorRefresh()
      emit(`endCopy`)
    })
  }, 350)
}
</script>

<template>
  <div class="header-container">
    <el-space class="dropdowns flex-auto" size="large">
      <FileDropdown />
      <DropdownMenu>
        <DropdownMenuTrigger class="flex items-center">
          格式
          <el-icon class="ml-2">
            <ElIconArrowDown />
          </el-icon>
        </DropdownMenuTrigger>
        <DropdownMenuContent class="w-60">
          <DropdownMenuItem v-for="{ label, kbd, emitArgs } in formatItems" :key="kbd" @click="$emit(...emitArgs)">
            <el-icon class="mr-2 h-4 w-4" />
            {{ label }}
            <DropdownMenuShortcut>
              {{ kbd }}
            </DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem @click="citeStatusChanged">
            <el-icon class="mr-2 h-4 w-4" :class="{ 'opacity-0': !isCiteStatus }">
              <ElIconCheck />
            </el-icon>
            微信外链转底部引用
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <EditDropdown />
      <StyleDropdown />
      <HelpDropdown />
    </el-space>
    <div class="btn-wapper">
      <div>
        <el-button plain type="primary" :loading="loading" @click="() => loadRmoteByChannel('zhihu')">
          远程加载
        </el-button>
        <el-button plain type="primary" :loading="loading" @click="loadRemoteAndPostInARow">
          自动发布
        </el-button>
        <el-button plain type="primary" :loading="loading" @click="loadRemoteAndPost">
          单次发布
        </el-button>
        <el-button plain type="primary" :loading="loading" @click="loadRemoteAndPostTuwenInARow">
          自动发布图文
        </el-button>
        <el-button plain type="primary" :loading="loading" @click="loadRemoteAndPostTuwen">
          单次发布图文
        </el-button>
        <el-button plain type="primary" @click="copy">
          复制
        </el-button>
      </div>
      <div>
        <el-button plain type="primary" :loading="loading" @click="loadRemoteAndPostZhihuInARow">
          知乎自动发布
        </el-button>
        <el-button plain type="primary" :loading="loading" @click="loadRemoteAndPostZhihu">
          知乎单次发布
        </el-button>
        <el-button plain type="primary" :loading="loading" @click="loadRemoteAndPostBaijiahaoInARow">
          百家号自动发布
        </el-button>
        <el-button plain type="primary" :loading="loading" @click="loadRemoteAndPostBaijiahao">
          百家号单次发布
        </el-button>
        <PostInfo />
      </div>
    </div>
  </div>
</template>

<style lang="less" scoped>
.header-container {
  display: flex;
  justify-content: space-around;
  align-items: center;
  height: 100%;
  padding: 0 20px;
}
.btn-wapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
}
</style>
