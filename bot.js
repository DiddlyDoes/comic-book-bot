'use strict'

const crypto = require('crypto')
const jsesc = require('jsesc')
const botBuilder = require('claudia-bot-builder')
const viberTemplate = botBuilder.viberTemplate
const rp = require('minimal-request-promise')

function isUrl(url) {
  const pattern = /[-a-zA-Z0-9@:%_\+.~#?&//=]{2,256}\.[a-z]{2,63}\b(\/[-a-zA-Z0-9@:%_\+.~#?&//=]*)?/gi
  return pattern.test(url)
}

function getCharacters(name, page, env) {
  const ts = new Date().getTime()
  const hash = crypto.createHash('md5').update(ts + env.marvelPrivateKey + env.marvelPublicKey).digest('hex')
  const limit = 15
  const offset = page * limit

  let url = `https://gateway.marvel.com/v1/public/characters?apikey=${env.marvelPublicKey}&ts=${ts}&hash=${hash}`

  if (name) {
    url += '&nameStartsWith=' + encodeURIComponent(name)
  } else {
    url += `&limit=${limit}&offset=${offset}`
  }

  return rp.get(url)
    .then(res => {
      const response = JSON.parse(res.body)
      return response.data
    })
}

function getSingleCharacter(id, env) {
  const ts = new Date().getTime()
  const hash = crypto.createHash('md5').update(ts + env.marvelPrivateKey + env.marvelPublicKey).digest('hex')

  return rp.get(`https://gateway.marvel.com/v1/public/characters/${id}?apikey=${env.marvelPublicKey}&ts=${ts}&hash=${hash}`)
    .then(res => {
      const response = JSON.parse(res.body)
      return response.data.results
    })
}

function showSingleCharacter(character) {
  return [
    character.name,
    new viberTemplate.Photo(character.thumbnail.path + '.' + character.thumbnail.extension).get(),
    character.description,
    `Appeared in:\n\n- ${character.comics.available} comics\n- ${character.series.available} series\n- ${character.stories.available} stories`,
    new viberTemplate.Text(`For more info:`)
      .addReplyKeyboard(false)
        .addKeyboardButton(`<font color="#FFFFFF"><b>Visit website</b></font>`, character.urls.find(url => url.type === 'detail').url, 6, 2, {
          TextSize: 'large',
          BgColor: '#ec192d',
          BgMediaType: 'picture',
          BgMedia: character.thumbnail.path + '.' + character.thumbnail.extension
        })
        .addKeyboardButton(`<font color="#FFFFFF"><b>See all characters</b></font>`, 'ALL_CHARACTERS', 6, 2, {
          TextSize: 'large',
          BgColor: '#ec192d',
          BgMediaType: 'picture',
          BgMedia: 'https://s3.eu-central-1.amazonaws.com/comic-book-bot/comicbookbot-all.png'
        })
        .addKeyboardButton(`<font color="#FFFFFF"><b>About the bot</b></font>`, 'ABOUT', 6, 1, {
          TextSize: 'large',
          BgColor: '#ec192d',
          BgMediaType: 'picture',
          BgMedia: 'https://s3.eu-central-1.amazonaws.com/comic-book-bot/comicbookbot-about.png'
        })
        .addKeyboardButton(`<font color="#FFFFFF"><b>Help</b></font>`, 'HELP', 6, 1, {
          TextSize: 'large',
          BgColor: '#ec192d',
          BgMediaType: 'picture',
          BgMedia: 'https://s3.eu-central-1.amazonaws.com/comic-book-bot/comicbookbot-help.png'
        })
      .get()
  ]
}

function showAllCharacters(data, page) {
  console.log('Marvel results', data.results)
  const template = new viberTemplate.Text(`Here's the list of all characters`)
  template.addReplyKeyboard(false)
  data.results.forEach(character => {
    console.log(character)
    return template.addKeyboardButton(`<font color="#FFFFFF"><b>${jsesc(character.name, { json: true, quotes: 'single', wrap: false })}</b></font>`, 'VIEW|' + character.id, 2, 2, {
      TextSize: 'large',
      BgColor: '#ec192d',
      BgMediaType: 'picture',
      BgMedia: character.thumbnail.path + '.' + character.thumbnail.extension
    })
  })
  if (page > 0)
    template.addKeyboardButton(`<font color="#FFFFFF"><b>Previous (page ${page})</b></font>`, `ALL_CHARACTERS|${ page - 1 }`, 3, 1, {
      TextSize: 'large',
      BgColor: '#ec192d'
    })
  if (data.total > 15)
    template.addKeyboardButton(`<font color="#FFFFFF"><b>Next (page ${page + 2})</b></font>`, `ALL_CHARACTERS|${ page + 1 }`, page ? 3 : 6, 1, {
      TextSize: 'large',
      BgColor: '#ec192d'
    })
  template.addKeyboardButton(`<font color="#EC192D"><b>Back to main menu</b></font>`, 'MAIN_MENU', 6, 1, {
    TextSize: 'large',
    BgColor: '#FFFFFF'
  })
  return template.get()
}

const api = botBuilder((message, originalApiRequest) => {
  if (message.text === 'ALL_CHARACTERS') {
    console.log('Show all characters')
    return getCharacters('', 0, originalApiRequest.env)
      .then(characters => showAllCharacters(characters, 0))
  }

  if (/ALL_CHARACTERS\|[0-9]{1,}/i.test(message.text)) {
    const params = message.text.split('|')
    console.log('Show all characters with page', params[1])
    return getCharacters('', parseInt(params[1], 10), originalApiRequest.env)
      .then(characters => showAllCharacters(characters, parseInt(params[1], 10)))
  }

  if (/VIEW\|[0-9]{1,}/i.test(message.text)) {
    const params = message.text.split('|')
    console.log('Show single characters with id', params[1])
    return getSingleCharacter(parseInt(params[1], 10), originalApiRequest.env)
      .then(characters => showSingleCharacter(characters[0]))
  }

  if (message.text === 'ABOUT') {
    console.log('Show about page')
    return [
      `Comic Book Bot is a simple Viber chatbot connected to the Marvel API`,
      `It's created by Claudia Bot Builder team as an example Viber bot`,
      `I am Open Source, my full source is available on the Github:`,
      new viberTemplate.Url('https://github.com/stojanovic/comic-book-bot').get(),
      `Feel free to send Pull Request to improve me :)`,
      new viberTemplate.Sticker(40140)
        .addReplyKeyboard(false)
          .addKeyboardButton(`<font color="#FFFFFF"><b>See all characters</b></font>`, 'ALL_CHARACTERS', 6, 2, {
            TextSize: 'large',
            BgColor: '#ec192d',
            BgMediaType: 'picture',
            BgMedia: 'https://s3.eu-central-1.amazonaws.com/comic-book-bot/comicbookbot-all.png'
          })
          .addKeyboardButton(`<font color="#FFFFFF"><b>Help</b></font>`, 'HELP', 6, 2, {
            TextSize: 'large',
            BgColor: '#ec192d',
            BgMediaType: 'picture',
            BgMedia: 'https://s3.eu-central-1.amazonaws.com/comic-book-bot/comicbookbot-help.png'
          })
        .get()
    ]
  }

  if (message.text === 'HELP') {
    console.log('Show help page')
    return [
      `At the moment, I am very simple chatbot. You can:`,
      `- Type Hello, Hi or Ciao to get the welcome message\n\n- Type anything else and I'll search Marvel characters API\n\n- Use buttons to navigate, click on "See all characters" to get started`,
      `There's a lot of the things I still don't understand`,
      new viberTemplate.Sticker(40136).get(),
      `But I am Open Source, so feel free to improve me, for more info check the About section ;)`,
      new viberTemplate.Text(`What do you want me to do next?`)
        .addReplyKeyboard(false)
          .addKeyboardButton(`<font color="#FFFFFF"><b>See all characters</b></font>`, 'ALL_CHARACTERS', 6, 2, {
            TextSize: 'large',
            BgColor: '#ec192d',
            BgMediaType: 'picture',
            BgMedia: 'https://s3.eu-central-1.amazonaws.com/comic-book-bot/comicbookbot-all.png'
          })
          .addKeyboardButton(`<font color="#FFFFFF"><b>About the bot</b></font>`, 'ABOUT', 6, 2, {
            TextSize: 'large',
            BgColor: '#ec192d',
            BgMediaType: 'picture',
            BgMedia: 'https://s3.eu-central-1.amazonaws.com/comic-book-bot/comicbookbot-about.png'
          })
        .get()
    ]
  }

  if (message.text.toLowerCase() === 'hello' || message.text.toLowerCase() === 'hi' || message.text.toLowerCase() === 'ciao') {
    console.log('Show start')
    return new viberTemplate.Text(`Welcome to Comic Book Bot! How can I help you?`)
      .addReplyKeyboard(false)
        .addKeyboardButton(`<font color="#FFFFFF"><b>See all characters</b></font>`, 'ALL_CHARACTERS', 6, 2, {
          TextSize: 'large',
          BgColor: '#ec192d',
          BgMediaType: 'picture',
          BgMedia: 'https://s3.eu-central-1.amazonaws.com/comic-book-bot/comicbookbot-all.png'
        })
        .addKeyboardButton(`<font color="#FFFFFF"><b>About the bot</b></font>`, 'ABOUT', 6, 1, {
          TextSize: 'large',
          BgColor: '#ec192d',
          BgMediaType: 'picture',
          BgMedia: 'https://s3.eu-central-1.amazonaws.com/comic-book-bot/comicbookbot-about.png'
        })
        .addKeyboardButton(`<font color="#FFFFFF"><b>Help</b></font>`, 'HELP', 6, 1, {
          TextSize: 'large',
          BgColor: '#ec192d',
          BgMediaType: 'picture',
          BgMedia: 'https://s3.eu-central-1.amazonaws.com/comic-book-bot/comicbookbot-help.png'
        })
      .get()
  }

  if (!isUrl(message.text)) {
    console.log('Not an url')
    return getCharacters(message.text, 0, originalApiRequest.env)
      .then(characters => showAllCharacters(characters, 0))
  }
}, {
  platforms: ['viber']
})

api.addPostDeployConfig('marvelPublicKey', 'Marvel Public Key:', 'configure-bot')
api.addPostDeployConfig('marvelPrivateKey', 'Marvel Private Key:', 'configure-bot')

module.exports = api
